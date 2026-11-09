// ===================== ONE APP, MANY COMMUNITIES =====================
// Shaun, 4 Nov: white-label the app for other padel communities, starting with
// Padel Championships (Dubai). Everything that is one community's lives in
// assets/js/config/club.js; these tests hold the rest of the app to that.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../assets/js/config/club.js');
const H = require('./helpers/uiHarness.js');
const { appScriptFiles } = require('./helpers/appSource.js');

const maybe = H.available() ? test : test.skip;
const ROOT = path.join(__dirname, '..');

test('the address chooses the community; every address Money Padel has used stays Money Padel', () => {
  const at = (hostname, search = '') => C.resolveClub({ hostname, search }).id;
  ['moneypadel.sgj.luxe', 'mpstandings.sgj.luxe', 'mpr.sgj.luxe', 'mp-dashboard-new-ratings.vercel.app',
    'money-padel-git-redesign-sgj-92.vercel.app', 'localhost', '127.0.0.1'].forEach((h) => assert.strictEqual(at(h), 'moneypadel', h));
  ['padelchamps.sgj.luxe', 'pcstandings.sgj.luxe'].forEach((h) => assert.strictEqual(at(h), 'padelchampionships', h));
  Object.values(C.CLUBS).forEach((c) => (c.standingsHosts || []).forEach((re) => {
    const h = re.source.replace(/^\^|\\/g, '') + 'sgj.luxe';
    assert.strictEqual(at(h), c.id, `${h}: a standings address belongs to its community`);
  }));
  // ?club= only where no community claims the address: a laptop, the tests.
  assert.strictEqual(at('localhost', '?club=padelchampionships'), 'padelchampionships');
  assert.strictEqual(at('moneypadel.sgj.luxe', '?club=padelchampionships'), 'moneypadel', 'a community\'s own domain cannot be turned into another\'s');
  assert.strictEqual(at('localhost', '?club=nobody'), 'moneypadel');
  assert.strictEqual(C.CLUB.id, 'moneypadel', 'in Node, Money Padel');
});

test('every community says what the screens need', () => {
  Object.values(C.CLUBS).forEach((c) => {
    ['id', 'name', 'resultsGroup', 'appTitle', 'homeScreenTitle', 'productName', 'fileSlug', 'logo', 'monogram'].forEach((k) =>
      assert.ok(typeof c[k] === 'string' && c[k], `${c.id}: ${k}`));
    assert.ok(Array.isArray(c.wordmark) && c.wordmark.length, `${c.id}: wordmark`);
    assert.match(c.fileSlug, /^[a-z0-9-]+$/);
    assert.ok(fs.existsSync(path.join(ROOT, c.logo)), `${c.id}: ${c.logo} exists`);
    assert.ok(c.firebase === null || (c.firebase.projectId && c.firebase.apiKey), `${c.id}: a whole Firebase config, or none yet`);
  });
});

test('a community\'s own record is its own: Money Padel\'s files exist, the shared app holds none of it', () => {
  Object.values(C.CLUBS).forEach((c) => {
    assert.ok(Array.isArray(c.dataScripts), `${c.id}: dataScripts`);
    c.dataScripts.forEach((f) => {
      assert.ok(fs.existsSync(path.join(ROOT, f)), `${c.id}: ${f} exists`);
      assert.ok(f.startsWith(`assets/js/clubs/${c.id}/`), `${c.id}: ${f} is in its own folder`);
    });
  });
  const { CLUB_HISTORY } = require('../assets/js/clubs/moneypadel/history.js');
  assert.strictEqual(CLUB_HISTORY.baseMatches.length, 127);
  assert.strictEqual(CLUB_HISTORY.northSouth.event.name, 'Box Office Cup');
  // The shared app names no player of any community: no rosters, tiers or
  // games written into it.
  const app = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');
  assert.doesNotMatch(app, /const (BASE_MATCHES|BASE_TIERS|BASE_ACTIVE) = [[{]"/);
  assert.doesNotMatch(app, /'Kaz'|"Kaz"/);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'assets/js/domain/matches/matchAttribution.js'), 'utf8'), /'2026-\d\d-\d\d-\d+'/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'assets/js/productionSnapshot.js')));
  assert.ok(!fs.existsSync(path.join(ROOT, 'assets/js/historicalDisplayMatches.js')));
});

test('every standings domain has its redirect rule in vercel.json', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  Object.values(C.CLUBS).filter((c) => c.standingsDomain).forEach((c) => {
    assert.ok(c.standingsHosts.some((re) => re.test(c.standingsDomain)), `${c.id}: its standings domain is one of its standings hosts`);
    assert.ok((cfg.redirects || []).some((r) => (r.has || []).some((h) => h.type === 'host' && h.value === c.standingsDomain)),
      `${c.id}: vercel.json keeps ${c.standingsDomain} to the standings`);
  });
});

test('no community is named outside the settings file', () => {
  const files = appScriptFiles().map((f) => path.join('assets/js', f)).concat(['review/review.js'])
    .filter((f) => !/config\/club\.js$|productionSnapshot\.js$/.test(f));
  const found = [];
  files.forEach((f) => {
    fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (/^\s*\*/.test(line)) return;
      if (/Money Padel|MONEY PADEL|money-padel-|Money <b>Padel|mp-mark\.svg|mpstandings/.test(code)) found.push(`${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
    });
  });
  assert.deepStrictEqual(found, []);
});

maybe('Money Padel looks exactly as before', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(() => ({
      title: document.title, wordmark: document.querySelector('.brand-wordmark').innerHTML,
      logo: document.querySelector('.brand-mark img').getAttribute('src'),
      apple: document.querySelector('meta[name="apple-mobile-web-app-title"]').content,
      record: performance.getEntriesByType('resource').filter((e) => /\/clubs\/moneypadel\//.test(e.name)).length,
      base: Object.keys(BASE_TIERS).length, event: NORTH_SOUTH_EVENT && NORTH_SOUTH_EVENT.name,
    }));
    assert.deepStrictEqual(r, { title: 'MP Beta', wordmark: 'Money <b>Padel</b>', logo: 'assets/brand/mp-mark.svg', apple: 'MP Beta v3',
      record: 3, base: 41, event: 'Box Office Cup' });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('another community: its own name, wordmark, logo and file names, and no Money Padel anywhere on screen', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, path: 'index.html?club=padelchampionships' });
  try {
    const r = await app.run(() => {
      const shown = document.body.innerText;
      return {
        club: CLUB.id, title: document.title, wordmark: document.querySelector('.brand-wordmark').innerHTML,
        logo: document.querySelector('.brand-mark img').getAttribute('src'),
        apple: document.querySelector('meta[name="apple-mobile-web-app-title"]').content,
        moneyPadel: /money padel/i.test(shown),
        record: performance.getEntriesByType('resource').filter((e) => /\/clubs\//.test(e.name)).map((e) => e.name),
        base: [Object.keys(BASE_TIERS).length, BASE_MATCHES.length, NORTH_SOUTH_EVENT, getDisplayMatches().filter((m) => m._displayOnly).length],
        h2hText: (() => { h2hPlayerA = PLAYERS[0].name; h2hPlayerB = PLAYERS[1].name; h2hMonth = 'all'; return h2hExportText([], [], false).split('\n')[0]; })(),
      };
    });
    assert.strictEqual(r.club, 'padelchampionships');
    assert.strictEqual(r.title, 'Padel Championships');
    assert.strictEqual(r.wordmark, 'Padel <b>Championships</b>');
    assert.strictEqual(r.logo, 'assets/brand/pc-mark.svg');
    assert.strictEqual(r.apple, 'Padel Champs');
    assert.strictEqual(r.moneyPadel, false, 'no Money Padel on its screens');
    assert.deepStrictEqual(r.record, [], 'it never fetches Money Padel\'s record');
    assert.deepStrictEqual(r.base, [0, 0, null, 0], 'and starts with none of it');
    assert.strictEqual(r.h2hText, 'Padel Championships · Head to head');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('colours: the stylesheets name no gold of their own, so a community\'s brand reaches every wash and hairline', () => {
  const found = [];
  fs.readdirSync(path.join(ROOT, 'assets/css'), { recursive: true }).filter((f) => f.endsWith('.css')).forEach((f) => {
    fs.readFileSync(path.join(ROOT, 'assets/css', f), 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*--[\w-]+\s*:/.test(line)) return; // a variable's definition is where the colour belongs
      if (/rgba\(\s*(212\s*,\s*175\s*,\s*55|245\s*,\s*213\s*,\s*118|241\s*,\s*233\s*,\s*216|240\s*,\s*223\s*,\s*160)\s*,|#(23200f|fff3c4)\b/i.test(line)) found.push(`${f}:${i + 1}`);
    });
  });
  assert.deepStrictEqual(found, []);
  const pc = C.CLUBS.padelchampionships.theme;
  ['--gold', '--gold-bright', '--bg0', '--bg2', '--text', '--text-dim', '--gold-rgb', '--text-rgb'].forEach((k) => assert.ok(pc.css[k], k));
  assert.strictEqual(C.CLUBS.moneypadel.theme, undefined, 'Money Padel is the stylesheet\'s own colours');
});

maybe('Money Padel\'s colours resolve exactly as before; Padel Championships is Royal Amethyst, from the first paint', async () => {
  const look = async (p) => {
    const app = await H.open({ viewport: { width: 390, height: 844 }, path: p });
    try {
      return await app.run(() => {
        const css = getComputedStyle(document.documentElement);
        const probe = document.createElement('div');
        probe.style.borderColor = 'rgba(var(--gold-rgb), 0.5)';
        document.body.appendChild(probe);
        const wash = getComputedStyle(probe).borderTopColor;
        probe.remove();
        return { gold: css.getPropertyValue('--gold').trim(), bg0: css.getPropertyValue('--bg0').trim(), wash,
          meta: document.querySelector('meta[name="theme-color"]').content, logo: document.querySelector('.brand-mark img').getAttribute('src') };
      });
    } finally { await app.close(); }
  };
  assert.deepStrictEqual(await look('index.html'),
    { gold: '#d4af37', bg0: '#0b0a08', wash: 'rgba(212, 175, 55, 0.5)', meta: '#0b0a08', logo: 'assets/brand/mp-mark.svg' });
  assert.deepStrictEqual(await look('index.html?club=padelchampionships'),
    { gold: '#a585ff', bg0: '#0b0812', wash: 'rgba(165, 133, 255, 0.5)', meta: '#0b0812', logo: 'assets/brand/pc-mark.svg' });
});
