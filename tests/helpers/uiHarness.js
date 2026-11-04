// ===================== UI HARNESS =====================
// Boots the real index.html in a real browser against a stubbed Firestore.
//
// Every UI defect found during the v3 integration -- historical tiers coming
// back undefined, expectations recomputed from today's ratings, a modal
// describing a solver that had been retired, approving a game making it vanish,
// a confirmed delete persisting an overlay and changing nothing -- was found by
// a person driving the browser. None of them could have been caught by the
// module tests, because every module was correct in isolation and the
// application wired them up wrongly. This is the layer that was missing.
//
// The stub is built from the same backfill the seed writes, so the fixture
// cannot drift from the real record and there is no data file to keep in step.
//
// It skips rather than fails when Playwright or a browser is unavailable: a
// suite that goes red on a machine without Chromium teaches people to ignore
// red.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Store = require('../../assets/js/ratingStore.js');

const ROOT = path.join(__dirname, '..', '..');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

let playwright = null;
let playwrightChecked = false;
function getPlaywright() {
  if (!playwrightChecked) {
    playwrightChecked = true;
    for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
      try { playwright = require(id); break; } catch (e) { /* try the next */ }
    }
  }
  return playwright;
}

function available() { return !!getPlaywright(); }

// The documents the seed would write. Same source as scripts/moneypadel/seed-beta.js, so
// the browser sees exactly what the beta holds.
let fixtureCache = null;
function fixture() {
  if (!fixtureCache) {
    const { buildBackfill } = require('../../scripts/moneypadel/seed-beta.js');
    const b = buildBackfill();
    const plan = Store.buildWritePlan({
      matches: b.matches, journey: b.replay.journey, state: b.replay.state, provenance: b.provenance,
    });
    fixtureCache = {
      players: plan[Store.COLLECTIONS.players],
      matches: plan[Store.COLLECTIONS.matches],
      ratingJourney: plan[Store.COLLECTIONS.journey],
    };
  }
  return fixtureCache;
}

// `files` replaces what a path serves -- the deployed build stamp, say, which
// only exists once GitHub Pages has built the site.
function serve(files = {}) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    if (Object.prototype.hasOwnProperty.call(files, rel)) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(rel)] || 'application/octet-stream' });
      res.end(files[rel]); return;
    }
    // A folder serves its index.html, as every real host does (review/).
    let file = path.join(ROOT, rel);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Opens the app, loaded and rendered, with a Firestore stub in place. Page
// errors are collected rather than swallowed: several of the defects this
// suite guards against would have thrown quietly in a real browser.
async function open(options = {}) {
  const pw = getPlaywright();
  if (!pw) throw new Error('Playwright is not available.');
  const server = await serve(options.files);
  const port = server.address().port;
  const browser = await pw.chromium.launch();
  // `timezoneId` lets a test put the reader somewhere specific -- London, say,
  // where 00:30 on 1 October is still 30 September in UTC.
  // `mobile` is a touch phone at 375 x 667 -- the Monthly Review is opened
  // from WhatsApp on one, and a swipe needs a touch screen to be a swipe.
  // `viewport` sets any other size -- a laptop or a desktop monitor, say.
  const page = await browser.newPage({
    viewport: options.viewport || (options.mobile ? { width: 375, height: 667 } : { width: 430, height: 932 }),
    ...(options.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
    ...(options.timezoneId ? { timezoneId: options.timezoneId } : {}),
  });
  // `now` fixes the reader's clock. Anything that depends on which month it
  // is -- the Meaningful Month above all -- is otherwise a test of whatever
  // day the suite happens to run on.
  if (options.now) await page.clock.setFixedTime(new Date(options.now));
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.addInitScript(({ data, failReads, readLatency, tapDuringBoot }) => {
    window.__writes = [];
    window.__data = data;
    // Every read, with the window it occupied. A test can then assert that
    // start-up's reads overlapped rather than queued -- the difference between
    // one round trip and fourteen, which is invisible to a stub that answers
    // instantly.
    window.__reads = [];
    const held = readLatency ? (() => new Promise((r) => setTimeout(r, readLatency))) : null;
    // One entry per batched write actually committed, so a test can assert that
    // a replay went out in a couple of round trips rather than hundreds.
    window.__batches = [];
    const fail = () => { throw new Error('stubbed read failure'); };
    window.firebase = {
      initializeApp() {},
      firestore() {
        return {
          collection(name) {
            return {
              doc(id) {
                return {
                  // A batch collects refs and applies them later, so a ref has
                  // to carry what it points at.
                  _collection: name, _id: id,
                  async get() {
                    const started = Date.now();
                    if (held) await held();
                    window.__reads.push({ collection: name, id, started, ended: Date.now() });
                    const v = (data[name] || {})[id]; return { exists: !!v, data: () => v };
                  },
                  async set(v) { window.__writes.push({ collection: name, id, doc: v }); (data[name] = data[name] || {})[id] = v; },
                  async delete() { window.__writes.push({ collection: name, id, deleted: true }); delete (data[name] || {})[id]; },
                };
              },
              async get() {
                const started = Date.now();
                if (held) await held();
                window.__reads.push({ collection: name, started, ended: Date.now() });
                if (failReads) fail();
                return { docs: Object.values(data[name] || {}).map((v) => ({ data: () => v })) };
              },
            };
          },
          // The application batches its replay writes, so the stub has to as
          // well: without this the tests would exercise the one-at-a-time
          // fallback while the real app takes a path nothing covers.
          batch() {
            const ops = [];
            return {
              set(ref, v) { ops.push({ op: 'set', collection: ref._collection, id: ref._id, doc: v }); },
              delete(ref) { ops.push({ op: 'delete', collection: ref._collection, id: ref._id }); },
              async commit() {
                if (ops.length > 500) throw new Error('batched write exceeds 500 operations');
                window.__batches.push(ops.length);
                ops.forEach((o) => {
                  if (o.op === 'delete') {
                    window.__writes.push({ collection: o.collection, id: o.id, deleted: true });
                    delete (data[o.collection] || {})[o.id];
                  } else {
                    window.__writes.push({ collection: o.collection, id: o.id, doc: o.doc });
                    (data[o.collection] = data[o.collection] || {})[o.id] = o.doc;
                  }
                });
              },
            };
          },
        };
      },
    };
    // A reader who taps a tab while the record is still on its way. Installed
    // here so it happens inside the loading window rather than after it: the
    // whole class of defect this guards against is a screen drawn once, from
    // nothing, and never drawn again.
    if (tapDuringBoot) {
      const tap = setInterval(() => {
        const btn = document.querySelector(`#tabrow .tab-btn[data-tab="${tapDuringBoot}"]`);
        if (!btn) return;
        // Wait for the app to be BOOTING, not merely for the button to have
        // been parsed. `#tabrow` is static markup and exists long before
        // app.js runs, so tapping on sight raced the scripts: on a loaded
        // machine the tap landed before DATA_READY existed at all, and the
        // test that checks what the reader saw mid-load saw `undefined`
        // instead of `false`. This is also what a person does -- they tap
        // once the app is on screen, not while it is still parsing.
        if (typeof DATA_READY === 'undefined') return;
        if (DATA_READY) { clearInterval(tap); return; }   // too late; nothing to observe
        clearInterval(tap);
        window.__tappedAt = Date.now();
        btn.click();
        // What the reader was actually looking at in that moment, kept so a
        // test can check the loading window itself and not only its outcome.
        const view = document.getElementById(
          (typeof TAB_VIEW_ID !== 'undefined' && TAB_VIEW_ID[tapDuringBoot]) || 'list');
        window.__atTap = {
          ready: typeof DATA_READY === 'undefined' ? null : DATA_READY,
          players: typeof PLAYERS === 'undefined' ? null : PLAYERS.length,
          notice: !!document.getElementById('bootNotice'),
          placeholder: !!(view && view.querySelector('.boot-placeholder')),
          text: view ? view.textContent.replace(/\s+/g, ' ').trim() : null,
        };
      }, 10);
    }
  }, {
    // `options.record` loads a different record than the seeded fixture -- what
    // the live beta actually holds, for instance, which is how a divergence
    // reported from a phone gets reproduced here instead of guessed at.
    data: (() => {
      const r = options.record || fixture();
      const keyed = (arr) => Object.fromEntries((arr || []).map((d) => [d.id, d]));
      return {
        players: keyed(r.players),
        matches: keyed(r.matches),
        ratingJourney: keyed(r.ratingJourney || r.journey),
        // `options.club` seeds the club's own documents (requests, submissions)
        // as the app stores them: { key: value }, each saved as { value: JSON }.
        moneypadel: Object.fromEntries(Object.entries(options.club || {})
          .map(([k, v]) => [k, { value: JSON.stringify(v), updatedAt: 0 }])),
        // `options.collections` seeds other collections stored the same way
        // (published Player Packs in playerPacks, say): { name: { id: value } }.
        ...Object.fromEntries(Object.entries(options.collections || {}).map(([name, docs]) => [name,
          Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, { value: JSON.stringify(v), updatedAt: 0 }]))])),
      };
    })(),
    failReads: !!options.failReads,
    readLatency: options.readLatency || 0,
    tapDuringBoot: options.tapDuringBoot || null,
  });

  // `path` opens another page of the site (the public Monthly Review, say),
  // and `readyWhen` says when that page is ready instead of DATA_READY.
  await page.goto(`http://127.0.0.1:${port}/${options.path || 'index.html'}`, { waitUntil: 'domcontentloaded' });
  if (options.readyWhen) {
    await page.waitForFunction(options.readyWhen, null, { timeout: 20000 });
    return {
      page, pageErrors, port,
      async close() { await browser.close(); server.close(); },
      run(fn, arg) { return page.evaluate(fn, arg); },
    };
  }
  // DATA_READY, not V3_STATE: the record arriving and the app being ready to
  // draw are two different moments, and start-up now finishes by drawing
  // whichever screen is active. Waiting on the earlier one meant waiting a
  // fixed 400ms and hoping.
  await page.waitForFunction(
    () => typeof DATA_READY !== 'undefined' && DATA_READY,
    null, { timeout: 20000 });
  await page.waitForTimeout(200);

  // The first-run player chooser is modal and covers the app. It is a real
  // feature, not a bug; it just has nothing to do with what is under test.
  await page.evaluate(() => {
    const el = document.getElementById('viewerSelectorSheet');
    if (el) el.remove();
  });

  return {
    page,
    pageErrors,
    async close() { await browser.close(); server.close(); },
    // Runs in the page and returns plain data.
    run(fn, arg) { return page.evaluate(fn, arg); },
    text(html) { return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); },
  };
}

module.exports = { open, available, fixture };
