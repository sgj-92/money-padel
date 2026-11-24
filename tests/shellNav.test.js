// ===================== SHELL NAVIGATION (PHASE 1) =====================
// Player Experience Reset, Phase 1: Home · Rankings · Play · Players · Me.
// More became Me; Rankings' primary entries are Power | This Month with the
// rest under More tables; each section's entries are one segmented control;
// Play carries a badge; the phone's Back works inside the app.
// Acceptance (docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md §7.1): every
// former More destination within two taps; visibility settings govern every
// new entry; Back never leaves the app from inside it; no screen's content
// changes (that last one is shown by scripts/behaviour-snapshot.js MODE=content).

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');
const FF = require('../assets/js/fixtureFlow.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-28T12:00:00.000Z';
const T = (d) => new Date(Date.parse('2026-09-20T10:00:00Z') + d * 864e5).toISOString();

// One request waiting on PDM, and one agreed game where Len backed out.
function fixtures() {
  const waiting = FF.createRequest({ players: ['Rishi', 'Erf', 'PDM', 'KC'], requestedBy: 'Rishi', at: T(1), id: 'fxWait' });
  const attn = FF.createRequest({ players: ['Osh', 'PDM', 'Len', 'Kaz'], requestedBy: 'Osh', at: T(0), id: 'fxAttn' });
  ['PDM', 'Len', 'Kaz'].forEach((n) => FF.respond(attn, n, 'in', T(0.5)));
  FF.respond(attn, 'Len', 'cant', T(2));
  return [waiting, attn];
}
const open = (opts) => H.open({ now: NOW, club: { moneypadel_game_requests: fixtures() }, ...(opts || {}) });
const seg = () => [...document.querySelectorAll('#sectionSubnav .section-subnav-item')].map((b) => b.textContent.trim());

maybe('five tabs -- Home, Rankings, Play, Players, Me -- and no More', async () => {
  const app = await open();
  try {
    const r = await app.run(() => ({
      tabs: [...document.querySelectorAll('.shell-nav-item')].map((b) => b.dataset.section),
      moreSheet: !!document.getElementById('shellMoreSheet'),
      moreFns: typeof openMoreSheet + typeof closeMoreSheet,
    }));
    assert.deepStrictEqual(r.tabs, ['home', 'rankings', 'play', 'players', 'me']);
    assert.strictEqual(r.moreSheet, false);
    assert.strictEqual(r.moreFns, 'undefinedundefined');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// The Claude Design canvas (Shaun, 24 Nov): one segmented control, Power |
// Month race (Quarter race at Padel Championships) | Stats, Stats being what
// More tables held -- rank-by cards, the stories, How ratings work.
maybe('Rankings is Power | Month race | Stats in one control, with the other tables under Stats', async () => {
  const app = await open();
  try {
    const r = await app.run((segSrc) => {
      const seg = eval(segSrc);
      goToSection('rankings');
      const out = { lands: activeTab, seg: seg(), role: document.querySelector('#sectionSubnav .mp-seg').getAttribute('role') };
      out.selected = [...document.querySelectorAll('#sectionSubnav [aria-selected="true"]')].map((b) => b.textContent.trim());
      document.querySelector('#sectionSubnav [data-tab="summary"]').click();
      out.thisMonth = activeTab;
      out.stats = document.getElementById('rankingsMoreBtn').textContent.trim();
      out.underline = document.getElementById('sectionSubnav').classList.contains('is-underline');
      document.getElementById('rankingsMoreBtn').click();
      out.more = [...document.querySelectorAll('#rankingsMoreSheet .mp-list-row .mp-list-row-label')].map((b) => b.textContent.trim());
      out.lenses = [...document.querySelectorAll('#rankingsMoreSheet .rk2-stat-title')].map((b) => b.textContent.trim());
      document.querySelector('#rankingsMoreSheet [data-tab="wl"]').click();
      out.wl = { tab: activeTab, section: activeSection, pressed: document.getElementById('rankingsMoreBtn').getAttribute('aria-pressed'),
        sheetOpen: document.getElementById('rankingsMoreSheet').classList.contains('show') };
      return out;
    }, `(${seg})`);
    assert.strictEqual(r.lands, 'power');
    assert.deepStrictEqual(r.seg, ['Power', 'Month race', 'Stats']);
    assert.strictEqual(r.stats, 'Stats');
    assert.ok(!r.underline);
    assert.strictEqual(r.role, 'tablist');
    assert.deepStrictEqual(r.selected, ['Power']);
    assert.strictEqual(r.thisMonth, 'summary', 'Month race is the League / Merit / Race screen');
    // North vs South lives in Admin / Manage (Shaun, 4 Oct), not in More tables.
    assert.deepStrictEqual(r.more, ['Insights / Call-Outs', 'Doughnuts', 'Roll of honour']);
    assert.deepStrictEqual(r.lenses, ['Form', 'Clutch', 'Upsets', 'Win / Loss']);
    assert.deepStrictEqual(r.wl, { tab: 'wl', section: 'rankings', pressed: 'true', sheetOpen: false });
  } finally { await app.close(); }
});

maybe('every former More destination is within two taps of Me or Rankings', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('PDM');
      const shown = (id) => { const el = document.getElementById(id); return !!el && el.classList.contains('show'); };
      const close = () => document.querySelectorAll('.shell-more-sheet.show').forEach((s) => s.classList.remove('show'));
      const viaMe = (key) => { goToSection('me'); document.querySelector(`#meView [data-me="${key}"]`).click(); };
      const out = {};
      viaMe('guide'); out.guide = shown('ratingGuideModal'); close();
      viaMe('about'); out.about = shown('aboutModal'); close();
      viaMe('datarange'); out.datarange = shown('dataRangeModal'); close();
      viaMe('doughnuts'); out.doughnutsMe = !!document.querySelector('.shell-more-sheet.show #doughnutModalBody'); close();
      viaMe('player'); out.player = shown('viewerSelectorSheet'); document.getElementById('viewerSelectorSheet').remove();
      viaMe('profile'); out.profile = document.getElementById('overlay').classList.contains('show'); closeSheet();
      viaMe('admin'); out.admin = { tab: activeTab, me: document.body.classList.contains('is-me') };
      // North vs South: Admin / Manage, behind the lock (Shaun, 4 Oct).
      goToSection('rankings'); openRankingsMoreTables();
      out.northsouthListed = !!document.querySelector('#rankingsMoreSheet [data-special="northsouth"]'); close();
      isUnlocked = true; adminRole = 'owner';
      viaMe('admin'); adminOpenSections.northsouth = true; renderManage();
      document.getElementById('openNorthSouthBtn').click();
      out.northsouthAdmin = !!document.querySelector('.shell-more-sheet.show'); close();
      isUnlocked = false; adminOpenSections.northsouth = false;
      goToSection('rankings'); openRankingsMoreTables(); document.querySelector('#rankingsMoreSheet [data-tab="callouts"]').click();
      out.insights = activeTab;
      return out;
    });
    assert.deepStrictEqual(r, {
      guide: true, about: true, datarange: true, doughnutsMe: true, player: true, profile: true,
      admin: { tab: 'manage', me: false }, northsouthListed: false, northsouthAdmin: true, insights: 'callouts',
    });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('Me: "Who are you?" with no player chosen; the player, and no sign-in, once chosen', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      const out = {};
      try { localStorage.clear(); } catch (e) { /* ignore */ }
      clearCurrentViewer();
      goToSection('me');
      out.none = { text: document.getElementById('meView').textContent, profileRow: !!document.querySelector('#meView [data-me="profile"]') };
      document.querySelector('#meView .me-choose').click();
      out.chooser = !!document.getElementById('viewerSelectorSheet');
      document.querySelector('#viewerPlayerList .viewer-player-btn[data-name="PDM"]').click();
      out.chosen = { text: document.getElementById('meView').textContent, profileRow: !!document.querySelector('#meView [data-me="profile"]') };
      return out;
    });
    assert.match(r.none.text, /Who are you\?/);
    assert.strictEqual(r.none.profileRow, false);
    assert.strictEqual(r.chooser, true, 'it opens the existing selector');
    assert.match(r.chosen.text, /PDM/);
    assert.match(r.chosen.text, /no sign-in/i);
    assert.doesNotMatch(r.chosen.text, /log ?in|password|account/i);
    assert.strictEqual(r.chosen.profileRow, true);
  } finally { await app.close(); }
});

maybe('Me keeps the screen underneath exactly as it was', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      legacyTabBtn('games').click();
      gamesMonth = '2026-09'; renderGamesTab();
      const before = document.getElementById('gamesView').innerHTML;
      goToSection('me');
      const hidden = getComputedStyle(document.getElementById('gamesView')).display;
      const meShown = getComputedStyle(document.getElementById('meView')).display;
      goToSection('play');
      legacyTabBtn('games').click();
      return { hidden, meShown, same: document.getElementById('gamesView').innerHTML === before, month: gamesMonth, meAfter: getComputedStyle(document.getElementById('meView')).display };
    });
    assert.deepStrictEqual(r, { hidden: 'none', meShown: 'block', same: true, month: '2026-09', meAfter: 'none' });
  } finally { await app.close(); }
});

maybe('the Play badge counts what the chosen player must act on, and is gone at zero', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      const badge = () => document.getElementById('playNavBadge').textContent;
      const out = {};
      setCurrentViewer('PDM'); out.pdm = [badge(), playActionCount('PDM')];
      setCurrentViewer('Len'); out.len = badge();          // he backed out himself
      setCurrentViewer('Kaz'); out.kaz = badge();          // his game needs attention
      setCurrentViewer('Tom'); out.tom = [badge(), document.querySelectorAll('#playNavBadge .mp-count-badge').length];
      setCurrentViewer('PDM');
      // Hidden Requests: the badge never points at a screen the reader cannot open.
      visibilityState = { ...VISIBILITY_DEFAULTS, wishlist: false }; applyTabVisibility();
      out.hiddenRequests = badge();
      visibilityState = { ...VISIBILITY_DEFAULTS }; applyTabVisibility();
      out.restored = badge();
      out.label = document.querySelector('#playNavBadge .mp-count-badge').getAttribute('aria-label');
      return out;
    });
    assert.deepStrictEqual(r.pdm, ['2', 2], 'one request waiting on him + one game needing attention');
    assert.strictEqual(r.len, '');
    assert.strictEqual(r.kaz, '1');
    assert.deepStrictEqual(r.tom, ['', 0], 'no badge at all at zero');
    assert.strictEqual(r.hiddenRequests, '');
    assert.strictEqual(r.restored, '2');
    assert.strictEqual(r.label, '2 things waiting on you');
  } finally { await app.close(); }
});

maybe('visibility settings govern the new entries too (D4)', async () => {
  const app = await open();
  try {
    const r = await app.run((segSrc) => {
      const seg = eval(segSrc);
      visibilityState = { ...VISIBILITY_DEFAULTS, power: false, callouts: false, players: false };
      applyTabVisibility();
      goToSection('rankings');
      const out = { lands: activeTab, seg: seg() };
      openRankingsMoreTables();
      out.more = [...document.querySelectorAll('#rankingsMoreSheet .mp-list-row')].map((b) => b.textContent.trim());
      document.getElementById('rankingsMoreSheet').classList.remove('show');
      goToSection('players');
      out.players = { lands: activeTab, seg: seg() };
      return out;
    }, `(${seg})`);
    assert.strictEqual(r.lands, 'summary');
    assert.ok(!r.seg.includes('Power'));
    assert.ok(!r.more.includes('Insights / Call-Outs'));
    assert.notStrictEqual(r.players.lands, 'players');
    assert.ok(!r.players.seg.includes('Directory'));
  } finally { await app.close(); }
});

maybe('Back closes the sheet on top, one at a time, and returns to the previous screen -- never out of the app', async () => {
  const app = await open();
  try {
    const p = app.page;
    const st = () => app.run(() => ({ section: activeSection, tab: activeTab,
      sheets: [...document.querySelectorAll('.shell-more-sheet.show, #overlay.show')].map((e) => e.id), path: location.pathname }));
    const back = async () => { await p.goBack({ waitUntil: 'commit' }).catch(() => {}); await p.waitForTimeout(150); return st(); };
    await app.run(() => { setCurrentViewer('PDM'); goToSection('rankings'); });
    await app.run(() => goToSection('play')); await p.waitForTimeout(30);
    assert.deepStrictEqual(await back(), { section: 'rankings', tab: 'power', sheets: [], path: '/index.html' });

    await app.run(() => { goToSection('me'); document.querySelector('#meView [data-me="datarange"]').click(); });
    await p.waitForTimeout(30);
    await app.run(() => document.querySelector('.dr-option[data-range="all"]').click());
    await p.waitForTimeout(30);
    assert.deepStrictEqual((await st()).sheets, ['dataRangeModal', 'fullHistoryConfirmModal']);
    assert.deepStrictEqual((await back()).sheets, ['dataRangeModal'], 'the confirm first');
    const after = await back();
    assert.deepStrictEqual([after.section, after.sheets], ['me', []], 'then Data & Rankings, and Me is still there');

    await app.run(() => { goToSection('rankings'); document.getElementById('rankingsMoreBtn').click(); });
    await p.waitForTimeout(30);
    await app.run(() => document.querySelector('#rankingsMoreSheet [data-tab="wl"]').click());
    await p.waitForTimeout(200);
    assert.strictEqual((await st()).tab, 'wl');
    assert.deepStrictEqual(await back(), { section: 'rankings', tab: 'power', sheets: [], path: '/index.html' }, 'More tables left no dead entry');

    await app.run(() => { goToSection('home'); document.getElementById('homeFullReviewBtn').click(); });
    await p.waitForTimeout(80);
    await back();
    const home = await app.run(() => ({ section: activeSection, review: document.getElementById('summaryView').style.display, dash: document.getElementById('homeDashboard').style.display }));
    assert.deepStrictEqual(home, { section: 'home', review: 'none', dash: 'block' }, 'Back from Full Review is Home');

    await app.run(() => openSheet('Rishi')); await p.waitForTimeout(30);
    const prof = await back();
    assert.deepStrictEqual([prof.section, prof.sheets], ['home', []], 'the profile closes; Home stays');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('every new entry is a 44px target, and nothing scrolls sideways at 375', async () => {
  const app = await open();
  try {
    await app.page.setViewportSize({ width: 375, height: 812 });
    const r = await app.run(() => {
      setCurrentViewer('PDM');
      const h = (el) => Math.round(el.getBoundingClientRect().height);
      const out = {};
      goToSection('play');
      out.play = { seg: h(document.querySelector('#sectionSubnav .mp-seg')), labelsFit: [...document.querySelectorAll('#sectionSubnav .mp-seg-item')].every((b) => b.scrollWidth <= b.clientWidth) };
      goToSection('rankings');
      out.more = h(document.getElementById('rankingsMoreBtn').closest('.mp-seg') || document.getElementById('rankingsMoreBtn'));
      out.nav = Math.min(...[...document.querySelectorAll('.shell-nav-item')].map(h));
      goToSection('me');
      out.rows = Math.min(...[...document.querySelectorAll('#meView .mp-list-row')].map(h));
      out.width = document.documentElement.scrollWidth;
      return out;
    });
    assert.ok(r.play.seg >= 44, `Play control ${r.play.seg}px`);
    assert.ok(r.play.labelsFit, 'Play\'s entries fit without an ellipsis');
    assert.ok(r.more >= 44 && r.rows >= 44 && r.nav >= 48, JSON.stringify(r));
    assert.ok(r.width <= 375, `page ${r.width}px wide`);
  } finally { await app.close(); }
});

