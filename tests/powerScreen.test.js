// ===================== POWER RANKINGS, CALMER =====================
// Shaun, 31 Oct: "This needs a redesign. Too many fonts, a lot of visual
// noise. Can't see October or all tiers inside the boxes." Approved from a
// mock: one type system (Inter; Georgia for the title and names), no eyebrow,
// whole month and tier names in their boxes, the Idle / Inactive toggles in
// Filters, and Kings of Tiers as a list rather than cards within a card.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

const openPower = (app) => app.run(async () => {
  goToSection('rankings');
  legacyTabBtn('power').click();
  await document.fonts.ready;
});

maybe('the title block is the title and one line; the screen is set in Inter and Georgia only', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, mobile: true });
  try {
    await openPower(app);
    const r = await app.run(() => {
      const hero = document.getElementById('rankingsHero');
      const scope = '#rankingsHero, .controls, #kingsOfTiersPanel, #rankingsPodium, #list';
      const fams = [...new Set([...document.querySelectorAll(scope.split(', ').map((s) => s + ' *').join(', '))]
        .filter((e) => e.getClientRects().length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
        .map((e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '')))];
      return { text: hero.innerText, eyebrow: !!hero.querySelector('.mp-section-label'),
        title: getComputedStyle(hero.querySelector('.rankings-hero-title')).fontFamily, fams };
    });
    assert.doesNotMatch(r.text, /Results only/i, 'no eyebrow: the wordmark is right above');
    assert.strictEqual(r.eyebrow, false);
    assert.match(r.title, /^Georgia/);
    assert.deepStrictEqual(r.fams.filter((f) => !/^(Inter|Georgia)$/.test(f)), [], r.fams.join(', '));
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

for (const width of [360, 390]) {
  maybe(`at ${width}px the month and tier boxes show their whole names`, async () => {
    const app = await H.open({ viewport: { width, height: 844 }, mobile: true });
    try {
      await openPower(app);
      const r = await app.run(() => {
        const c = document.createElement('canvas').getContext('2d');
        // The tier is pills on Power now (the Claude Design canvas); the period box remains.
        return ['monthSelect'].map((id) => {
          const s = document.getElementById(id);
          const cs = getComputedStyle(s);
          c.font = `${cs.fontWeight} ${cs.fontSize} Inter`;
          const room = s.clientWidth - parseFloat(cs.paddingRight);
          const longest = Math.max(...[...s.options].map((o) => c.measureText(o.text).width));
          // Shaun's 22 Nov design adds ‹ › either side of the period: they are
          // not leading icons; an icon beside the name is still not shown on a phone.
          return { id, room, longest, icons: [...s.parentElement.querySelectorAll('.toolbar-icon')].filter((e) => e.getClientRects().length).length };
        }).concat([{ page: document.documentElement.scrollWidth > window.innerWidth + 1 }]);
      });
      r.slice(0, 1).forEach((x) => {
        assert.ok(x.room >= x.longest, `${x.id}: ${Math.round(x.longest)}px of text in ${Math.round(x.room)}px`);
        assert.strictEqual(x.icons, 0, `${x.id}: no leading icon`);
      });
      assert.strictEqual(r[1].page, false);
    } finally { await app.close(); }
  });
}

maybe('Include idle / temporarily inactive live in Filters, which shows a dot while either is on', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, mobile: true });
  try {
    await openPower(app);
    const r = await app.run(async () => {
      const row = document.getElementById('stateFilterRow');
      const inSheet = !!row.closest('#shellFiltersSheet');
      const btn = document.getElementById('openFiltersBtn');
      const before = btn.classList.contains('has-filters');
      row.querySelector('[data-toggle="idle"]').click();
      await new Promise((res) => setTimeout(res, 10));
      const on = btn.classList.contains('has-filters');
      row.querySelector('[data-toggle="idle"]').click();
      await new Promise((res) => setTimeout(res, 10));
      return { inSheet, before, on, after: btn.classList.contains('has-filters'), idle: includeIdle };
    });
    assert.strictEqual(r.inSheet, true, 'off the main screen, in Filters');
    assert.deepStrictEqual([r.before, r.on, r.after, r.idle], [false, true, false, false]);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// The Claude Design canvas (Shaun, 24 Nov): the honours are tiles under the
// leaderboard -- a King of each tier, then who leads the race.
maybe('the honours are tiles under the leaderboard: King of each tier, then the race leader', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, mobile: true });
  try {
    await openPower(app);
    const r = await app.run(() => {
      const tiles = [...document.querySelectorAll('#rankingsHonours .rk2-tile')];
      const list = document.getElementById('list').getBoundingClientRect();
      return { labels: tiles.map((t) => t.querySelector('.rk2-tile-label').textContent), below: tiles.every((t) => t.getBoundingClientRect().top >= list.bottom - 1),
        sameRow: tiles.length > 1 && Math.abs(tiles[0].getBoundingClientRect().top - tiles[1].getBoundingClientRect().top) < 2 };
    });
    assert.ok(r.labels.filter((l) => /^King of Tier [SABC]$/.test(l)).length >= 2, r.labels.join(', '));
    assert.ok(r.below, 'under the leaderboard');
    assert.ok(r.sameRow, 'two to a row');
  } finally { await app.close(); }
});

// The same clipping, fixed for every dropdown in the app: a slim drawn chevron
// in place of the browser's own arrow (inputs sharing the class get none).
maybe('This Month\'s Month and View show their whole names at 360px; text inputs get no chevron', async () => {
  const app = await H.open({ viewport: { width: 360, height: 844 }, mobile: true });
  try {
    const r = await app.run(async () => {
      goToSection('rankings');
      legacyTabBtn('summary').click();
      await document.fonts.ready;
      const c = document.createElement('canvas').getContext('2d');
      const fits = ['summaryMonthSelect', 'summaryModeSelect'].map((id) => {
        const s = document.getElementById(id);
        const cs = getComputedStyle(s);
        c.font = `${cs.fontWeight} ${cs.fontSize} Inter`;
        const room = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        return { id, room, longest: Math.max(...[...s.options].map((o) => c.measureText(o.text).width)), appearance: cs.appearance };
      });
      const input = document.createElement('input');
      input.className = 'fg-select';
      document.body.appendChild(input);
      const inputBg = getComputedStyle(input).backgroundImage;
      input.remove();
      return { fits, inputBg };
    });
    r.fits.forEach((x) => {
      assert.ok(x.room >= x.longest, `${x.id}: ${Math.round(x.longest)}px of text in ${Math.round(x.room)}px`);
      assert.strictEqual(x.appearance, 'none');
    });
    assert.strictEqual(r.inputBg, 'none');
  } finally { await app.close(); }
});
