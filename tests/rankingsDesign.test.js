// ===================== RANKINGS: SHAUN'S 22 NOV DESIGN =====================
// Underlined tabs Power | Quarter | Stats; "Rankings"; one bar with ‹ period ›,
// tier and filters; Power Leader and Quarter Leader cards; the Power
// Leaderboard: # (laurels for the top three) · player · tier · rating · Δ ·
// the last five results · ›.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-21T10:00:00.000Z';

maybe('Padel Championships: the tabs, the title, the bar, the two leaders and the leaderboard', async () => {
  const app = await H.open({ now: NOW, path: 'index.html?club=padelchampionships', viewport: { width: 390, height: 844 }, mobile: true });
  try {
    await app.run(() => goToSection('rankings'));
    // The club's own words ("Quarter") are put in once the screen is drawn.
    await app.run(() => new Promise((res) => setTimeout(res, 300)));
    const r = await app.run(() => {
      const t = (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
      const rows = [...document.querySelectorAll('#list .rk-row')];
      const first = rows[0], fourth = rows[3];
      const basis = (p) => selectedMonth !== 'all' ? (p.month_rating ?? -Infinity) : p.rating;
      const top = powerRowsShown.slice().sort((a, b) => basis(b) - basis(a))[0];
      const lead = MonthlyRace.overall(buildMonthlyRace(selectedMonth).table, raceMinMatches()).find((x) => x.qualified);
      const form = (row) => [...row.querySelectorAll('.rk-f')].map((f) => f.className.replace('rk-f ', ''));
      const name = first.querySelector('.nm').textContent;
      const run = PlayerForm.recent(getAllApprovedMatches(), name, 5).run;
      return {
        tabs: [...document.querySelectorAll('#sectionSubnav .mp-seg-item, #rankingsMoreBtn')].map((b) => b.textContent.trim()),
        title: t('.rankings-hero-title'),
        header: [...document.querySelectorAll('#rankingsColumnHeader span')].map((s) => s.textContent),
        leaders: [t('.rk-leader-power .rk-leader-label'), t('.rk-leader-power .rk-leader-name'), t('.rk-leader-power .rk-leader-value'),
          t('.rk-leader-race .rk-leader-label'), t('.rk-leader-race .rk-leader-name'), t('.rk-leader-race .rk-leader-tier')],
        want: [top.name, String(Math.round(top.month_rating)), lead.playerId],
        boardHead: t('#rankingsBoardHead .rk-board-title'),
        laurels: rows.slice(0, 4).map((row) => !!row.querySelector('.rk-laurel')),
        positions: rows.slice(0, 4).map((row) => row.querySelector('.rk-pos').textContent),
        form: form(first), run, fourthForm: form(fourth).length,
        delta: t('#list .rk-row .rk-delta'),
        chevron: !!first.querySelector('.rk-chev'),
        // The column headings never run into one another (Shaun, 23 Nov: "Δ (QTR)FORM").
        headsClear: (() => { const b = [...document.querySelectorAll('#rankingsColumnHeader > span')].filter((e) => e.textContent).map((e) => { const g = document.createRange(); g.selectNodeContents(e); return g.getBoundingClientRect(); }); return b.every((x, i) => !i || x.left >= b[i - 1].right + 2); })(),
        // An eight-letter name fits its row (Shaun's screenshot: "Jerm…").
        rowName: (() => { const n = first.querySelector('.nm'); n.textContent = 'Jermaine'; return n.scrollWidth <= n.clientWidth + 1; })(),
        // A long name is shown whole (Shaun's screenshot: "Jerm…").
        nameWhole: (() => { const n = document.querySelector('.rk-leader-power .rk-leader-name'); n.textContent = 'Jermaine-Alexander'; return n.scrollWidth <= n.clientWidth + 1 && getComputedStyle(n).textOverflow !== 'ellipsis'; })(),
        wide: document.documentElement.scrollWidth,
      };
    });
    assert.deepStrictEqual(r.tabs, ['Power', 'Quarter', 'Stats']);
    assert.strictEqual(r.title, 'Rankings');
    assert.deepStrictEqual(r.header, ['#', 'Player', 'Tier', 'Rating', 'Δ QTR', 'Form', '']);
    assert.strictEqual(r.leaders[0], 'Power Leader');
    assert.strictEqual(r.leaders[1], r.want[0]);
    assert.strictEqual(r.leaders[2], r.want[1]);
    assert.strictEqual(r.leaders[3], 'quarter Leader', 'shown in capitals by the stylesheet');
    assert.strictEqual(r.leaders[4], r.want[2], 'the quarter race leader, all tiers');
    assert.match(r.leaders[5], /^Tier [SABC]$/, 'a real tier, not "ALL"');
    assert.strictEqual(r.boardHead, 'Power Leaderboard');
    assert.deepStrictEqual(r.laurels, [true, true, true, false], 'laurels for the top three');
    assert.deepStrictEqual(r.positions, ['1', '2', '3', '4']);
    assert.strictEqual(r.form.length, 5);
    assert.deepStrictEqual(r.form.slice(5 - r.run.length), r.run.map((x) => ({ W: 'is-w', L: 'is-l', D: 'is-d' })[x]), 'oldest to newest, ending on the latest');
    assert.strictEqual(r.fourthForm, 5);
    assert.match(r.delta, /^(▲\+\d+|▼−\d+|0|–)$/);
    assert.ok(r.chevron);
    assert.ok(r.headsClear, 'headings clear of each other');
    assert.ok(r.rowName, '"Jermaine" is not cut short in the table');
    assert.ok(r.nameWhole, 'the leader\'s name is never cut short');
    assert.strictEqual(r.wide, 390);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('‹ and › step a period at a time; from All time ‹ is the latest; sorting lives in Filters and lights its dot', async () => {
  const app = await H.open({ now: NOW, viewport: { width: 390, height: 844 }, mobile: true });
  try {
    const r = await app.run(() => {
      goToSection('rankings');
      const sel = document.getElementById('monthSelect');
      const periods = [...sel.options].map((o) => o.value).filter((v) => v !== 'all').sort();
      const start = selectedMonth;
      document.getElementById('periodPrev').click();
      const back = selectedMonth;
      document.getElementById('periodNext').click();
      const fwd = selectedMonth;
      const nextDisabledAtLatest = start === periods[periods.length - 1] ? document.getElementById('periodNext').disabled : null;
      applyRankingsMonth('all'); render();
      document.getElementById('periodPrev').click();
      const fromAll = selectedMonth;
      const dotBefore = document.getElementById('openFiltersBtn').classList.contains('has-filters');
      document.querySelector('#shellFiltersSheet [data-sortp="upset_total"]').click();
      const dotAfter = document.getElementById('openFiltersBtn').classList.contains('has-filters');
      const meta = document.querySelector('#list .rk-row .meta').textContent;
      return { periods, start, back, fwd, nextDisabledAtLatest, fromAll, dotBefore, dotAfter, meta };
    });
    const i = r.periods.indexOf(r.start);
    assert.strictEqual(r.back, r.periods[i - 1]);
    assert.strictEqual(r.fwd, r.start);
    if (r.nextDisabledAtLatest !== null) assert.strictEqual(r.nextDisabledAtLatest, true);
    assert.strictEqual(r.fromAll, r.periods[r.periods.length - 1]);
    assert.strictEqual(r.dotAfter, true, 'a sort other than Rating shows on Filters');
    assert.match(r.meta, /upset/, 'and the row says the figure it is sorted by');
  } finally { await app.close(); }
});
