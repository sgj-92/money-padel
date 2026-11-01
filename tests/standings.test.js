// ===================== THE STANDINGS SITE =====================
// Shaun, 30 Oct: share the live standings with the WhatsApp group instead of
// screenshots, on a domain of its own (mpstandings.sgj.luxe) so nobody reaches
// the full app by trimming the URL. "This month and all historical standings
// is fine. Results too." data/siteMode.js turns the app into League, Power
// and Results only; vercel.json sends every other path on that host home.
// It hides the app; it does not secure the database -- see the Ledger.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const STANDINGS = 'index.html?standings';

test('vercel.json: on the standings host every page path goes home, the assets do not', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const rule = (cfg.redirects || []).find((r) => (r.has || []).some((h) => h.type === 'host' && h.value === 'mpstandings.sgj.luxe'));
  assert.ok(rule, 'a host rule for mpstandings.sgj.luxe');
  assert.strictEqual(rule.destination, '/');
  assert.strictEqual(rule.permanent, false);
  const re = new RegExp('^' + rule.source.replace(/^\//, '/') + '$');
  ['/preview/', '/admin', '/index.html', '/reviewer'].forEach((p) => assert.ok(re.test(p), `${p} is sent home`));
  // The published Monthly Reviews are the Monthly tab (1 Nov): read-only decks.
  ['/review/', '/review'].forEach((p) => assert.ok(!re.test(p), `${p} is served`));
  ['/assets/js/app.js', '/assets/css/shell.css', '/'].forEach((p) => assert.ok(!re.test(p), `${p} is served`));
});

maybe('opens on the League, offers League, Power and Results only, and nothing personal', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, path: STANDINGS });
  try {
    const r = await app.run(() => ({
      mode: isStandingsMode(), tab: activeTab, body: document.body.classList.contains('standings-mode'),
      subnav: [...document.querySelectorAll('#sectionSubnav [data-tab]')].map((b) => b.textContent.trim()),
      monthlyHref: document.querySelector('#sectionSubnav a[data-tab="monthly"]').getAttribute('href'),
      nav: getComputedStyle(document.querySelector('.shell-bottom-nav')).display,
      chooser: !!document.getElementById('viewerSelectorSheet'),
      moreTables: !!document.getElementById('rankingsMoreBtn'),
      empty: getComputedStyle(document.getElementById('empty')).display,
      unlocked: isUnlocked, title: document.title,
    }));
    assert.strictEqual(r.mode, true);
    assert.strictEqual(r.tab, 'summary', 'the League first');
    assert.ok(r.body);
    assert.deepStrictEqual(r.subnav, ['League', 'Power', 'Results', 'Monthly']);
    assert.strictEqual(r.monthlyHref, 'review/', 'Monthly opens the published reviews');
    assert.strictEqual(r.nav, 'none', 'no tab bar to the rest of the app');
    assert.strictEqual(r.chooser, false, 'no "who are you?"');
    assert.strictEqual(r.moreTables, false, 'no More tables');
    assert.strictEqual(r.empty, 'none', 'no stray empty-list message over the League');
    assert.strictEqual(r.unlocked, false);
    assert.strictEqual(r.title, 'Money Padel · Standings');

    // Power draws the rankings; a name opens nothing.
    await app.run(() => legacyTabBtn('power').click());
    const power = await app.run(() => { openSheet(PLAYERS[0].name); return { drawn: document.getElementById('list').children.length, sheet: document.getElementById('overlay').classList.contains('show') }; });
    assert.ok(power.drawn > 0, 'the Power screen is drawn');
    assert.strictEqual(power.sheet, false, 'no player profile');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('Results: every game, with no Add a game, no Admin lock and no pending list', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, path: STANDINGS });
  try {
    const r = await app.run(() => {
      legacyTabBtn('games').click();
      const view = document.getElementById('gamesView');
      return { cards: view.querySelectorAll('[data-game-card]').length, add: !!document.getElementById('addGameToggle'), text: view.textContent };
    });
    assert.ok(r.cards > 0, 'the results are listed');
    assert.strictEqual(r.add, false);
    assert.doesNotMatch(r.text, /Admin actions|admin password/i);
    assert.doesNotMatch(r.text, /Pending approval/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a wide screen keeps no empty column for the hidden rail', async () => {
  const app = await H.open({ viewport: { width: 1280, height: 800 }, path: STANDINGS });
  try {
    const left = await app.run(() => document.getElementById('sectionSubnav').getBoundingClientRect().left);
    assert.ok(left < 140, `content starts at ${left}px`);
  } finally { await app.close(); }
});

maybe('the full app is unchanged', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(() => ({ mode: isStandingsMode(), body: document.body.classList.contains('standings-mode'), nav: getComputedStyle(document.querySelector('.shell-bottom-nav')).display }));
    assert.deepStrictEqual(r, { mode: false, body: false, nav: r.nav });
    assert.notStrictEqual(r.nav, 'none');
  } finally { await app.close(); }
});
