// ===================== THE APP ON A LAPTOP OR MONITOR =====================
// One app, two presentations (assets/css/layout/desktop.css,
// assets/js/ui/desktopShell.js). From 768px the bottom navigation is a left
// rail, content sits in a capped, centred column, sheets are dialogs; from
// 1200px Rankings, Players, Play, Home and the Board Pack use the width.
// The routes, handlers and data are the phone's own. A phone is unchanged.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-28T12:00:00.000Z';
const open = (width, height, extra) => H.open(Object.assign({ now: NOW, viewport: { width, height } }, extra || {}));

// Every main screen, as a reader reaches it.
const SCREENS = [
  ['home', () => goToSection('home')],
  ['power', () => goToSection('rankings')],
  ['wl', () => legacyTabBtn('wl').click()],
  ['league', () => legacyTabBtn('summary').click()],
  ['findgame', () => goToSection('play')],
  ['games', () => legacyTabBtn('games').click()],
  ['upcoming', () => legacyTabBtn('upcoming').click()],
  ['requests', () => legacyTabBtn('wishlist').click()],
  ['players', () => goToSection('players')],
  ['compare', () => legacyTabBtn('h2h').click()],
  ['manage', () => { isUnlocked = true; adminRole = 'owner'; legacyTabBtn('manage').click(); renderManage(); }],
];

maybe('no sideways scroll on any main screen, from a laptop to an ultrawide monitor', async () => {
  for (const [w, h] of [[1280, 800], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [1024, 768]]) {
    const app = await open(w, h);
    try {
      await app.run(() => setCurrentViewer('Rishi'));
      const over = [];
      for (const [name, go] of SCREENS) {
        await app.run(go);
        const r = await app.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        if (r.sw > r.cw) over.push(`${name}: ${r.sw} > ${r.cw}`);
      }
      assert.deepStrictEqual(over, [], `${w}×${h}`);
      assert.deepStrictEqual(app.pageErrors, []);
    } finally { await app.close(); }
  }
});

maybe('the shell: a full rail with the brand and who is viewing at 1200+, a compact rail from 768, the phone\'s bottom bar below', async () => {
  const shape = () => {
    const nav = document.querySelector('.shell-bottom-nav').getBoundingClientRect();
    const items = [...document.querySelectorAll('.shell-nav-item')].map((b) => b.getBoundingClientRect());
    return {
      layout: document.documentElement.dataset.layout || null,
      nav: [Math.round(nav.left), Math.round(nav.top), Math.round(nav.width), Math.round(nav.height)],
      vertical: items.every((r, i) => i === 0 || r.top > items[i - 1].top),
      brand: !!document.querySelector('.shell-rail-brand') && getComputedStyle(document.querySelector('.shell-rail-brand')).display !== 'none',
      viewer: document.getElementById('railViewer') ? document.getElementById('railViewer').textContent.trim() : null,
      bodyGrid: getComputedStyle(document.body).display,
      sections: [...document.querySelectorAll('.shell-nav-item')].map((b) => b.dataset.section),
    };
  };
  const desk = await open(1440, 900);
  try {
    await desk.run(() => setCurrentViewer('Rishi'));
    await desk.run(() => goToSection('home'));
    const r = await desk.run(shape);
    assert.strictEqual(r.layout, 'desktop');
    assert.deepStrictEqual(r.nav.slice(0, 2), [0, 0], 'the rail is on the left, full height');
    assert.strictEqual(r.nav[3], 900);
    assert.ok(r.nav[2] >= 200 && r.nav[2] <= 260, `rail width ${r.nav[2]}`);
    assert.deepStrictEqual([r.vertical, r.brand, r.bodyGrid], [true, true, 'grid']);
    assert.match(r.viewer, /Rishi/);
    assert.deepStrictEqual(r.sections, ['home', 'rankings', 'play', 'players', 'me'], 'the same five as the phone; Admin stays inside Me');
    // "Who are you?" from the rail: the phone's own picker, and the rail follows.
    await desk.page.click('#railViewer');
    await desk.page.click('#viewerSelectorSheet .viewer-player-btn[data-name="Kaz"]');
    assert.match(await desk.page.textContent('#railViewer'), /Kaz/);
    assert.strictEqual(await desk.run(() => getCurrentViewer().name), 'Kaz');
  } finally { await desk.close(); }

  const tab = await open(1024, 768);
  try {
    const r = await tab.run(shape);
    assert.strictEqual(r.layout, 'tablet');
    assert.ok(r.nav[2] < 120 && r.vertical && !r.brand, JSON.stringify(r));
  } finally { await tab.close(); }

  const phone = await H.open({ now: NOW, mobile: true });
  try {
    const r = await phone.run(shape);
    assert.strictEqual(r.layout, null, 'nothing desktop happens on a phone');
    assert.strictEqual(r.nav[1] + r.nav[3], 667, 'the bar is at the bottom');
    assert.deepStrictEqual([r.vertical, r.brand, r.viewer, r.bodyGrid], [false, false, null, 'block']);
    assert.strictEqual(await phone.run(() => !!document.querySelector('.shell-rail-brand, .shell-rail-foot')), false, 'no desktop pieces in the phone\'s page');
  } finally { await phone.close(); }
});

maybe('the rail is the navigation: the same routes, highlight, sub-navigation and gating as the phone, by mouse or keyboard', async () => {
  const route = async (app, section) => {
    await app.page.click(`.shell-nav-item[data-section="${section}"]`);
    return app.run(() => ({ section: activeSection, tab: activeTab, active: document.querySelector('.shell-nav-item.active').dataset.section,
      subnav: [...document.querySelectorAll('.section-subnav-item')].map((b) => b.dataset.tab), html: document.documentElement.dataset.section }));
  };
  const desk = await open(1440, 900);
  const phone = await H.open({ now: NOW, mobile: true });
  try {
    for (const s of ['rankings', 'play', 'players', 'home']) {
      const d = await route(desk, s);
      const p = await route(phone, s);
      assert.deepStrictEqual([d.section, d.tab, d.active, d.subnav], [p.section, p.tab, p.active, p.subnav], s);
      assert.strictEqual(d.html, s);
    }
    // Admin is gated as on the phone: Me, then Admin sign-in / Manage.
    const me = await route(desk, 'me');
    assert.deepStrictEqual([me.section, me.active, me.html], ['me', 'me', 'me']);
    // Keyboard: Tab reaches the rail, Enter follows it, focus is visible.
    await desk.page.keyboard.press('Escape');
    await desk.run(() => document.querySelector('.shell-nav-item[data-section="players"]').focus());
    const ring = await desk.page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    await desk.page.keyboard.press('Enter');
    assert.strictEqual(await desk.run(() => activeSection), 'players');
    assert.notStrictEqual(ring, 'none', 'a visible focus ring');
    assert.deepStrictEqual([desk.pageErrors, phone.pageErrors], [[], []]);
  } finally { await desk.close(); await phone.close(); }
});

maybe('sheets are dialogs on a monitor, bottom sheets on a phone -- the same sheet, closed by Escape, the backdrop or its button', async () => {
  const desk = await open(1440, 900);
  try {
    await desk.run(() => { goToSection('rankings'); openRankingsMoreTables(); });
    const box = await desk.page.$eval('#rankingsMoreSheet .shell-more-panel', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.bottom]; });
    assert.ok(Math.abs(box[0] - 720) < 2 && Math.abs(box[1] - 450) < 40, `centred: ${box}`);
    assert.ok(box[2] <= 560 && box[3] < 900, 'a dialog, not a full-width sheet');
    await desk.page.keyboard.press('Escape');
    assert.strictEqual(await desk.run(() => document.getElementById('rankingsMoreSheet').classList.contains('show')), false, 'Escape closes it');
    // A profile opened from Rankings slides in from the right, over the page.
    await desk.run(() => { goToSection('rankings'); openSheet('Kaz'); });
    const sheet = await desk.page.$eval('#overlay .sheet', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.right), Math.round(r.top), Math.round(r.height)]; });
    assert.deepStrictEqual(sheet, [1440, 0, 900], 'a full-height panel on the right');
    await desk.page.keyboard.press('Escape');
    assert.strictEqual(await desk.run(() => document.getElementById('overlay').classList.contains('show')), false);
    assert.deepStrictEqual(desk.pageErrors, []);
  } finally { await desk.close(); }

  const phone = await H.open({ now: NOW, mobile: true });
  try {
    await phone.run(() => { goToSection('rankings'); openRankingsMoreTables(); });
    const box = await phone.page.$eval('#rankingsMoreSheet .shell-more-panel', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.bottom)]; });
    assert.deepStrictEqual(box, [375, 667], 'a bottom sheet, edge to edge');
  } finally { await phone.close(); }
});

maybe('Rankings: Kings of Tiers beside the podium, the filters in one toolbar, the list in the column', async () => {
  const app = await open(1440, 900);
  try {
    // A month: Kings beside the month's Champions, and no podium (1 Nov).
    const month = await app.run(() => {
      goToSection('rankings');
      const b = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top) }; };
      return { month: selectedMonth, kings: b('#kingsOfTiersPanel'), champs: b('#monthlyChampionsPanel'), podium: b('#rankingsPodium') };
    });
    assert.notStrictEqual(month.month, 'all');
    assert.strictEqual(month.podium, null, 'no podium on a month');
    assert.strictEqual(month.kings.t, month.champs.t, 'Kings and Champions side by side');
    assert.ok(month.kings.r <= month.champs.l);
    const r = await app.run(() => {
      applyRankingsMonth('all'); render();
      const b = (sel) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), w: Math.round(r.width) }; };
      return { kings: b('#kingsOfTiersPanel'), podium: b('#rankingsPodium'), bar: b('#rankingsToolbar'), sort: b('#sortbarPower'), list: b('#list'),
        rows: document.querySelectorAll('#list .row').length, legacy: renderRankingsPodium.length };
    });
    assert.strictEqual(r.kings.t, r.podium.t, 'side by side');
    assert.ok(r.kings.r <= r.podium.l, 'Kings, then the podium');
    assert.ok(Math.abs(r.bar.t - r.sort.t) < 20, 'month, tier and sort on one row');
    assert.ok(r.list.w <= 1120 && r.rows > 5, `the ranking list sits in the column (${r.list.w}px, ${r.rows} rows)`);
    // Re-rendered (a month or tier change), they still pair up.
    const again = await app.run(() => { renderKingsOfTiersPanel(); renderRankingsPodium(); return [document.getElementById('kingsOfTiersPanel').getBoundingClientRect().top, document.getElementById('rankingsPodium').getBoundingClientRect().top]; });
    assert.strictEqual(again[0], again[1]);
  } finally { await app.close(); }
});

maybe('Players: the directory beside the profile -- choosing a player fills the pane, without leaving the directory', async () => {
  const app = await open(1440, 900);
  try {
    await app.run(() => goToSection('players'));
    const empty = await app.page.$eval('#overlay', (e) => getComputedStyle(e, '::before').content);
    assert.match(empty, /Choose a player/);
    const rows = await app.page.$$eval('#playersView .pdir-row', (els) => els.slice(0, 2).map((e) => e.dataset.player));
    await app.page.click(`#playersView .pdir-row[data-player="${rows[0]}"]`);
    const r = await app.run(() => {
      const dir = document.getElementById('playersView').getBoundingClientRect();
      const pane = document.querySelector('#overlay .sheet').getBoundingClientRect();
      const row = document.querySelectorAll('#playersView .pdir-row')[1].getBoundingClientRect();
      const hit = document.elementFromPoint(row.left + 20, row.top + row.height / 2);
      return { name: document.getElementById('sheetName').textContent, side: pane.left >= dir.right, rowClickable: !!(hit && hit.closest('.pdir-row')), top: Math.round(pane.top) };
    });
    assert.deepStrictEqual([r.name, r.side, r.rowClickable], [rows[0], true, true], 'the profile beside the directory; the directory still usable');
    await app.page.click(`#playersView .pdir-row[data-player="${rows[1]}"]`);
    assert.strictEqual(await app.run(() => document.getElementById('sheetName').textContent), rows[1], 'the pane follows the choice');
    // The pane stays in view while the directory scrolls.
    await app.page.evaluate(() => window.scrollTo(0, 1500));
    const top = await app.page.$eval('#overlay .sheet', (e) => Math.round(e.getBoundingClientRect().top));
    assert.ok(top >= 0 && top < 120, `sticky (${top})`);
    await app.page.keyboard.press('Escape');
    assert.strictEqual(await app.run(() => document.getElementById('overlay').classList.contains('show')), false);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }

  // On a phone it is the same sheet, over the whole screen, as before.
  const phone = await H.open({ now: NOW, mobile: true });
  try {
    await phone.run(() => goToSection('players'));
    await phone.page.click('#playersView .pdir-row');
    const r = await phone.page.$eval('#overlay', (e) => { const b = e.getBoundingClientRect(); return [getComputedStyle(e).position, Math.round(b.width), Math.round(b.height)]; });
    assert.deepStrictEqual(r, ['fixed', 375, 667]);
  } finally { await phone.close(); }
});

maybe('Play and Home use the width: Find a Game beside its results, results as a card grid, Home two-up', async () => {
  const app = await open(1440, 900);
  try {
    const r = await app.run(() => {
      setCurrentViewer('Rishi');
      const b = (e) => e.getBoundingClientRect();
      goToSection('play');
      const brief = b(document.querySelector('#findGameView .play-brief')), results = b(document.getElementById('fgResults'));
      legacyTabBtn('games').click();
      const cards = [...document.querySelectorAll('#gamesView > .callout-card')].slice(0, 2).map(b);
      goToSection('home');
      // Phase 3a: the hero across the top; Next game on the left beside Last
      // time out; Around the club underneath, its cards side by side.
      const hero = b(document.querySelector('.home-block-hero')), next = b(document.querySelector('.home-block-next')),
        last = b(document.querySelector('.home-block-last')), club = b(document.querySelector('.home-block-club'));
      const pulse = [...document.querySelectorAll('.home-club-item')].map(b);
      return { findgame: [brief.right <= results.left, Math.abs(brief.top - results.top) < 16],
        games: cards.length === 2 && Math.round(cards[0].top) === Math.round(cards[1].top) && cards[0].right <= cards[1].left,
        home: [hero.width >= last.right - next.left - 1, next.right <= last.left, Math.round(next.top) === Math.round(last.top),
          club.top >= Math.max(next.bottom, last.bottom) - 1, pulse.length > 1 && pulse.every((p) => Math.round(p.top) === Math.round(pulse[0].top))] };
    });
    assert.deepStrictEqual(r, { findgame: [true, true], games: true, home: [true, true, true, true, true] });
  } finally { await app.close(); }
});

maybe('Admin: the Board Pack and Player Pack editors sit beside their live preview, which stays in view', async () => {
  const app = await open(1440, 900);
  try {
    await app.run(() => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      legacyTabBtn('manage').click(); renderManage();
      document.querySelector('[data-acc-toggle="boardpack"]').click();
    });
    const p = app.page;
    await p.waitForSelector('#bpStatus');
    await p.click('#bpPreviewBtn');
    const side = () => app.run(() => {
      const e = document.querySelector('.bp-split-edit').getBoundingClientRect(), v = document.querySelector('.bp-split-preview').getBoundingClientRect();
      return { beside: e.right <= v.left && e.width > 300 && v.width > 300, inView: v.top < innerHeight && v.bottom > 0 };
    });
    assert.deepStrictEqual((await side()).beside, true);
    // Scrolled down the module list, the preview is still on screen.
    await p.evaluate(() => window.scrollTo(0, document.querySelector('.bp-split-edit').getBoundingClientRect().bottom + scrollY - innerHeight));
    assert.strictEqual((await side()).inView, true);
    // An edit shows in the preview at once: the same handlers as the phone.
    const idx = await p.$eval('[data-bp-module="league"]', (el) => Number(el.dataset.bpItem));
    await p.click(`[data-bp-toggle="${idx}"]`);
    assert.strictEqual(await app.run(() => !!document.querySelector('.bp-split-preview [data-module="league"]')), false, 'League off, gone from the preview');
    // Player packs: the same split.
    await p.click('#bpViewPlayers');
    await p.waitForSelector('.pp-row');
    await p.click('.pp-row');
    await p.waitForSelector('#ppPreviewBtn');
    await p.click('#ppPreviewBtn');
    assert.strictEqual((await side()).beside, true, 'Player pack');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }

  // A phone: the preview follows the editor, the wrappers have no box.
  const phone = await H.open({ now: NOW, mobile: true });
  try {
    await phone.run(() => { isUnlocked = true; adminRole = 'owner'; legacyTabBtn('manage').click(); renderManage(); document.querySelector('[data-acc-toggle="boardpack"]').click(); });
    await phone.page.waitForSelector('#bpStatus');
    await phone.page.click('#bpPreviewBtn');
    const r = await phone.run(() => ['.bp-split', '.bp-split-edit', '.bp-split-preview'].map((s) => getComputedStyle(document.querySelector(s)).display));
    assert.deepStrictEqual(r, ['contents', 'contents', 'contents']);
  } finally { await phone.close(); }
});
