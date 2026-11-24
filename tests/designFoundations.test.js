// ===================== REDESIGN FOUNDATIONS (PHASE 0) =====================
// Player Experience Reset, Phase 0: tokens, self-hosted fonts, primitives
// and their HTML helpers. The phase's promise is that NOTHING in the app
// changes -- the new layer sits beside the old one until a later phase
// adopts it. These tests pin both halves: the layer is what DQ20 decided,
// and the app neither uses nor downloads any of it yet.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const http = require('node:http');
const path = require('path');
const vm = require('vm');
const H = require('./helpers/uiHarness.js');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const maybe = H.available() ? test : test.skip;

const tokensCss = read('assets/css/tokens.css');
const componentsCss = read('assets/css/components.css');
const PHASE0 = componentsCss.slice(componentsCss.lastIndexOf('/*', componentsCss.indexOf('REDESIGN PRIMITIVES')));
const refPage = read('docs/design/primitives.html');

// ---------- tokens ----------

// Every custom property declared in the base and token files, in order.
function declarations() {
  const out = [];
  for (const f of ['assets/css/app.css', 'assets/css/tokens.css']) {
    for (const m of read(f).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      out.push({ file: f, name: m[1], value: m[2].trim() });
    }
  }
  return out;
}
const token = (name) => (declarations().find((d) => d.name === name) || {}).value;

function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function hue(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

test('no token is declared twice: Phase 0 adds names, it never redefines one', () => {
  const seen = {};
  const dupes = declarations().filter((d) => (seen[d.name] ? true : (seen[d.name] = true, false)));
  assert.deepStrictEqual(dupes.map((d) => d.name), []);
});

test('DQ20: the champagne accent, the fonts, and the Ledger contrast kept', () => {
  assert.strictEqual(token('--accent'), '#D5B76E');
  // Instrument Serif was retired 31 Oct (Shaun): titles are Georgia.
  assert.match(token('--font-display'), /^'Georgia'/);
  assert.match(token('--font-interface'), /^'Inter'/, 'one sans app-wide');
  assert.match(token('--font-ui'), /^'Inter'/);
  assert.match(token('--font-figures'), /^'Inter'/);
  // The existing gold and muted text are untouched in Phase 0.
  assert.strictEqual(token('--gold'), '#d4af37');
  assert.strictEqual(token('--text-dim'), '#bcb096');
  assert.doesNotMatch((tokensCss + componentsCss).replace(/\/\*[\s\S]*?\*\//g, ''), /#969188/i, 'the design\'s lighter muted grey is not adopted');
});

test('every new text colour reads on the card surface (AA), and the icon grey clears 3:1', () => {
  const bg = token('--bg1');
  for (const t of ['--accent', '--accent-bright', '--state-booked', '--state-attention', '--move-up', '--move-down', '--danger-text', '--text-dim']) {
    assert.ok(contrast(token(t), bg) >= 4.5, `${t} ${token(t)} is ${contrast(token(t), bg).toFixed(2)}:1`);
  }
  assert.ok(contrast(token('--icon-inactive'), bg) >= 3);
});

test('Booked has its own hue: not Tier B sage, not upward movement (DQ20)', () => {
  const booked = hue(token('--state-booked'));
  for (const other of ['--tier-b-text', '--move-up', '--state-attention', '--accent']) {
    const d = Math.abs(booked - hue(token(other)));
    assert.ok(Math.min(d, 360 - d) >= 45, `Booked is only ${Math.min(d, 360 - d).toFixed(0)}° from ${other}`);
  }
});

// ---------- fonts ----------

test('fonts are self-hosted WOFF2 with their OFL licences, and swap rather than block', () => {
  const faces = [...tokensCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.strictEqual(faces.length, 6, 'Inter 400/500/600; Latin and Latin Extended (Instrument Serif retired 31 Oct)');
  for (const f of faces) {
    assert.match(f, /font-display:\s*swap/);
    assert.match(f, /font-family:\s*'Inter'/);
    const url = /url\("\.\.\/fonts\/([^"]+)"\)/.exec(f);
    assert.ok(url, 'a local file');
    const file = path.join(ROOT, 'assets/fonts', url[1]);
    assert.strictEqual(fs.readFileSync(file).subarray(0, 4).toString('latin1'), 'wOF2', url[1]);
  }
  for (const dir of ['inter']) {
    assert.match(read(`assets/fonts/${dir}/OFL.txt`), /SIL Open Font License, Version 1\.1/);
  }
});

test('nothing reaches a third party for type: no web-font service, no remote url()', () => {
  const css = ['tokens.css', 'app.css', 'components.css', 'shell.css'].map((f) => read('assets/css/' + f)).join('\n');
  assert.doesNotMatch(css, /url\(\s*["']?https?:/);
  assert.doesNotMatch(read('index.html') + refPage, /fonts\.googleapis|fonts\.gstatic|use\.typekit/);
});

test('numbers that must line up use tabular Inter', () => {
  assert.match(PHASE0, /\.mp-figures\{[^}]*font-family:\s*var\(--font-figures\)[^}]*tabular-nums/);
  for (const sel of ['.mp-count-badge', '.mp-counter-num', '.mp-date-day', '.mp-player-row-rank', '.mp-player-row-value']) {
    const rule = new RegExp(sel.replace(/[.-]/g, (c) => '\\' + c) + '\\{([^}]*)\\}').exec(PHASE0);
    assert.ok(rule && /tabular-nums/.test(rule[1]) && /--font-figures/.test(rule[1]), `${sel} aligns its digits`);
  }
});

// ---------- primitives ----------

const NEW_CLASS = /^\.mp-(serif-display|figures|card-self|card-quiet|section-head|btn-(touch|accent|quiet|danger)|pill|seg|count-badge|counter|date-|game-row|player-row|move-|list-row|step|sheet|toast)/;

test('the primitives touch no existing selector: every Phase 0 rule is a new name', () => {
  const selectors = PHASE0.replace(/\/\*[\s\S]*?\*\//g, '').split('}')
    .map((b) => b.split('{')[0].trim()).filter(Boolean);
  assert.ok(selectors.length > 40);
  for (const group of selectors) {
    for (const sel of group.split(',').map((s) => s.trim())) {
      const first = sel.replace(/^button/, '');
      assert.match(first, NEW_CLASS, `"${sel}" styles something that already exists`);
    }
  }
});

test('the reference page shows every primitive, and uses no class the CSS does not define', () => {
  const defined = new Set([...PHASE0.matchAll(/\.(mp-[a-z0-9-]+)/g)].map((m) => m[1]));
  const used = new Set([...refPage.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => c.startsWith('mp-')));
  const existing = new Set(['mp-btn-primary', 'mp-btn-secondary', 'mp-card-standard']);
  for (const c of used) assert.ok(defined.has(c) || existing.has(c), `the page uses .${c}, which is not defined`);
  for (const c of defined) assert.ok(used.has(c), `.${c} is defined but not shown on the reference page`);
});

// ---------- helpers ----------

// The helpers use the app's own escapeHtml -- lifted out of app.js here so the
// test exercises the real one, not a copy.
function helpers() {
  const app = read('assets/js/app.js');
  const esc = /function escapeHtml\(value\)\{[\s\S]*?\n\}/.exec(app)[0];
  const ctx = vm.createContext({});
  vm.runInContext(esc + '\n' + read('assets/js/ui/components/primitives.js')
    + '\n;this.api = { mpCountBadgeHtml, mpPillHtml, mpDateBlockHtml, mpSegmentedHtml, mpListRowHtml, mpSectionHeadHtml, mpStepperHtml };', ctx);
  return ctx.api;
}

test('a count badge never shows 0, and caps at 99+', () => {
  const { mpCountBadgeHtml } = helpers();
  for (const n of [0, -1, NaN, null, undefined, '0', 0.4]) assert.strictEqual(mpCountBadgeHtml(n), '', String(n));
  assert.strictEqual(mpCountBadgeHtml(2, 'waiting on you'), '<span class="mp-count-badge" aria-label="2 waiting on you">2</span>');
  assert.match(mpCountBadgeHtml(140), />99\+</);
});

test('pills escape their text and fall back to neutral for an unknown state', () => {
  const { mpPillHtml } = helpers();
  assert.strictEqual(mpPillHtml('Court booked', 'booked'), '<span class="mp-pill mp-pill-booked">Court booked</span>');
  assert.strictEqual(mpPillHtml('<b>x</b>', 'shiny'), '<span class="mp-pill">&lt;b&gt;x&lt;/b&gt;</span>');
});

test('a date block reads the calendar day, says booked or proposed in words, and refuses a bad date', () => {
  const { mpDateBlockHtml } = helpers();
  const booked = mpDateBlockHtml('2026-10-06');
  assert.match(booked, /^<span class="mp-date-block">/);
  assert.match(booked, />Tue<.*>6<.*>Oct<.*>Booked</);
  const proposed = mpDateBlockHtml('2026-10-08', { proposed: true });
  assert.match(proposed, /mp-date-block-proposed/);
  assert.match(proposed, />Thu<.*>8<.*>Oct<.*>Proposed</);
  // The 1st and the 31st: no slip either side of midnight, whatever the clock's zone.
  assert.match(mpDateBlockHtml('2026-11-01'), />Sun<.*>1<.*>Nov</);
  assert.match(mpDateBlockHtml('2026-12-31'), />Thu<.*>31<.*>Dec</);
  for (const bad of ['', null, '2026-02-30', '07/10/2026', '2026-13-01']) assert.strictEqual(mpDateBlockHtml(bad), '', String(bad));
});

test('the segmented control marks exactly one tab selected and focusable', () => {
  const { mpSegmentedHtml } = helpers();
  const html = mpSegmentedHtml([{ id: 'power', label: 'Power' }, { id: 'month', label: 'This Month' }], 'month', 'Rankings');
  assert.match(html, /^<div class="mp-seg" role="tablist" aria-label="Rankings">/);
  assert.strictEqual((html.match(/aria-selected="true"/g) || []).length, 1);
  assert.match(html, /data-seg="month" aria-selected="true" tabindex="0">This Month</);
  assert.match(html, /data-seg="power" aria-selected="false" tabindex="-1">Power</);
});

test('list rows and section heads escape everything, and refuse an attribute-name injection', () => {
  const { mpListRowHtml, mpSectionHeadHtml } = helpers();
  const row = mpListRowHtml({ label: 'Kings of Tiers', meta: '"4"', data: { dest: 'kings"x' } });
  assert.match(row, /data-dest="kings&quot;x"/);
  assert.match(row, /mp-list-row-meta">&quot;4&quot;</);
  assert.throws(() => mpListRowHtml({ label: 'x', data: { 'onclick="a"': 1 } }), /bad attribute name/);
  assert.doesNotMatch(mpSectionHeadHtml({ title: 'Needs you', count: 0 }), /mp-count-badge/);
  assert.match(mpSectionHeadHtml({ title: 'Needs you', count: 2, meta: 'This week' }), /Needs you<\/h3><span class="mp-count-badge">2<\/span><span class="mp-section-head-meta">This week</);
});

test('the stepper marks the steps before the current one done, and only one current', () => {
  const { mpStepperHtml } = helpers();
  const html = mpStepperHtml(['Requested', 'Agreed', 'Booked', 'Played'], 2);
  assert.strictEqual((html.match(/is-done/g) || []).length, 2);
  assert.match(html, /<li class="mp-step is-current" aria-current="step">Booked<\/li><li class="mp-step">Played/);
  assert.doesNotMatch(mpStepperHtml(['A', 'B']), /is-current|is-done/);
});

// The helpers belong to the redesigned screens as each phase builds them;
// the legacy screens keep their own markup until their phase.
test('only redesigned screens use the helpers (Phases 1-3a): the shell, Me, Play\'s new lists and Home', () => {
  const { appScriptFiles, readAppScript } = require('./helpers/appSource.js');
  const users = appScriptFiles().filter((f) => f !== 'ui/components/primitives.js'
    && /\bmp(CountBadge|Pill|DateBlock|Segmented|ListRow|SectionHead|Stepper)Html\(/.test(readAppScript(f)));
  assert.deepStrictEqual(users.sort(), ['features/home/homeScreen.js', 'features/me/meScreen.js', 'features/play/arrangeScreen.js', 'features/play/playScreens.js', 'features/rankings/rankingsDesign.js', 'shell.js']);
});

// ---------- in a browser ----------

function host() {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Shaun, 31 Oct: "apply the fonts app-wide". Every screen is now set in the
// two families -- Inter for everything read or tapped, Georgia for titles and
// names -- and nothing else (bar a monospace figure here and there).
maybe('the app fetches only its own fonts, and every screen is set in Inter or Georgia', async () => {
  const app = await H.open();
  try {
    const fonts = [];
    app.page.on('request', (r) => { if (/\.woff2?$/.test(new URL(r.url()).pathname)) fonts.push(r.url()); });
    // Walk the sections a person would, so any screen that used a new family would fetch it.
    for (const tab of ['summary', 'wishlist', 'upcoming', 'games', 'players']) {
      await app.page.evaluate((t) => { const b = document.querySelector(`#tabrow .tab-btn[data-tab="${t}"]`); if (b) b.click(); }, tab);
      await app.page.waitForTimeout(150);
    }
    const origin = await app.run(() => location.origin);
    assert.deepStrictEqual(fonts.filter((u) => !u.startsWith(origin + '/assets/fonts/')), [], 'self-hosted only');
    const families = await app.run(() => [...new Set([...document.querySelectorAll('body *')]
      .filter((el) => el.getClientRects().length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      .map((el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim()))]);
    assert.deepStrictEqual(families.filter((f) => !/^(Inter|Georgia|ui-monospace|Menlo|monospace)$/.test(f)), [], `only Inter and Georgia: ${families.join(', ')}`);
    assert.ok(families.includes('Inter'), 'Inter is the interface face');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('the reference page loads the self-hosted fonts, same-origin only, and every control is 44px', async () => {
  let pw = null;
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { pw = require(id); break; } catch (e) { /* next */ } }
  const server = await host();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
    const offsite = [];
    const errors = [];
    page.on('request', (r) => { if (!r.url().startsWith(origin)) offsite.push(r.url()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin + '/docs/design/primitives.html');
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() => ['400 16px "Inter"', '500 16px "Inter"', '600 16px "Inter"']
      .map((f) => document.fonts.check(f)));
    assert.deepStrictEqual(loaded, [true, true, true]);
    assert.deepStrictEqual(offsite, []);
    assert.deepStrictEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 375), 'no sideways scroll at 375');
    const small = await page.evaluate(() => [...document.querySelectorAll('.mp-seg, .mp-list-row, .mp-game-row, .mp-btn-touch, .mp-btn-quiet, .mp-sheet-close, .mp-toast-action, button.mp-section-head, .mp-counter')]
      .map((el) => ({ c: el.className, h: el.getBoundingClientRect().height })).filter((x) => x.h < 43.5));
    assert.deepStrictEqual(small, []);
  } finally { await browser.close(); server.close(); }
});
