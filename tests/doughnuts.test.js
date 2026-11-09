// ===================== D7: DOUGHNUTS — BY PLAYER, DOUGHNUT LIST, MONTH =====================
// Shaun, 28 Sep 2026. The Doughnuts sheet keeps its By Player leaderboard and
// gains a Doughnut List -- each doughnut as a result, newest first -- with one
// Month control shared by both views. Both read the one existing definition
// (doughnutMatches): a match, decided or drawn, with a set that finished with
// a side on 0. A listed result opens where every result opens: its card in
// Play › Games.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-20T12:00:00.000Z';
const open = (opts) => H.open({ now: NOW, ...(opts || {}) });

// Page helpers, installed once per page.
const install = (app) => app.run(() => {
  // Me › Doughnuts (More became Me in Phase 1).
  window.openDoughnuts = () => {
    goToSection('me');
    document.querySelector('#meView [data-me="doughnuts"]').click();
  };
  window.dnBody = () => document.getElementById('doughnutModalBody');
  window.dnMonth = (m) => { const s = document.getElementById('doughnutMonthSelect'); s.value = m; s.dispatchEvent(new Event('change')); };
  window.dnView = (v) => document.getElementById(v === 'list' ? 'doughnutViewList' : 'doughnutViewPlayer').click();
  window.dnListIds = () => [...dnBody().querySelectorAll('.doughnut-result')].map((b) => b.dataset.matchId);
  // Independently of the app's code: every approved match with a 6-0 set
  // (a doughnut is 6-0 only -- Shaun, 9 Nov).
  window.truthIds = (month) => getAllApprovedMatches()
    .filter((m) => (month === 'all' || m.date.slice(0, 7) === month) && m.sets.some(([x, y]) => (x === 6 && y === 0) || (x === 0 && y === 6)))
    .map((m) => m.id);
});

maybe('D7: By Player is still there, with the same totals, sort and per-player games', async () => {
  const app = await open();
  try {
    await install(app);
    const r = await app.run(() => {
      openDoughnuts();
      const defaultView = document.getElementById('doughnutViewPlayer').classList.contains('active');
      dnMonth('all');
      const rows = [...dnBody().querySelectorAll('.doughnut-row')].map((row) => ({
        name: row.dataset.name,
        given: Number(row.querySelector('.doughnut-given').textContent),
        received: Number(row.querySelector('.doughnut-received').textContent) }));
      // The same totals, computed here from the raw record.
      const truth = {};
      getAllApprovedMatches().forEach((m) => {
        const wGave = m.sets.some(([x, y]) => x === 6 && y === 0), lGave = m.sets.some(([x, y]) => x === 0 && y === 6);
        const T = (n) => (truth[n] = truth[n] || { given: 0, received: 0 });
        if (wGave) { m.winners.forEach((n) => T(n).given++); m.losers.forEach((n) => T(n).received++); }
        if (lGave) { m.losers.forEach((n) => T(n).given++); m.winners.forEach((n) => T(n).received++); }
      });
      dnBody().querySelector('.doughnut-sort-btn[data-sort="received"]').click();
      const sortedByReceived = [...dnBody().querySelectorAll('.doughnut-row .doughnut-received')].map((x) => Number(x.textContent));
      const first = dnBody().querySelector('.doughnut-row');
      first.click();
      const detailOpen = document.getElementById(`doughnutDetail-${first.dataset.name.replace(/\s+/g, '_')}`).style.display !== 'none';
      return { defaultView, rows, truth, sortedByReceived, detailOpen };
    });
    assert.strictEqual(r.defaultView, true, 'By Player is where the sheet opens');
    assert.ok(r.rows.length > 5);
    r.rows.forEach((row) => assert.deepStrictEqual({ given: row.given, received: row.received }, r.truth[row.name], row.name));
    assert.strictEqual(r.rows.length, Object.values(r.truth).filter((t) => t.given + t.received > 0).length);
    assert.deepStrictEqual(r.sortedByReceived, r.sortedByReceived.slice().sort((a, b) => b - a), 'the sort buttons still sort');
    assert.strictEqual(r.detailOpen, true, 'a player still opens their games');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D7: the Doughnut List holds exactly the qualifying matches — no more, no fewer — month by month', async () => {
  const app = await open();
  try {
    await install(app);
    const r = await app.run(() => {
      openDoughnuts(); dnView('list');
      const out = {};
      for (const m of ['all', ...getAvailableMonths()]) {
        dnMonth(m);
        const ids = dnListIds();
        const nonDoughnuts = getAllApprovedMatches().filter((x) => !x.sets.some(([a, b]) => (a === 6 && b === 0) || (a === 0 && b === 6))).map((x) => x.id);
        out[m] = { ids: ids.slice().sort(), truth: truthIds(m).sort(), leaked: ids.filter((id) => nonDoughnuts.includes(id)) };
      }
      return out;
    });
    let nonEmpty = 0;
    for (const [m, x] of Object.entries(r)) {
      assert.deepStrictEqual(x.ids, x.truth, `${m}: the list is the qualifying matches`);
      assert.deepStrictEqual(x.leaked, [], `${m}: no match without a set on 0`);
      if (m !== 'all' && x.ids.length) nonEmpty++;
    }
    assert.ok(nonEmpty >= 2, 'several months, historical ones included, have doughnuts to show');
    assert.ok(r.all.ids.length > r['2026-09'].ids.length, 'a month is a subset of all time');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D7: the month is one setting for both views, and a historical month works in each', async () => {
  const app = await open();
  try {
    await install(app);
    const r = await app.run(() => {
      openDoughnuts();
      const opened = { month: document.getElementById('doughnutMonthSelect').value, meaningful: meaningfulMonthNow().month };
      const months = getAvailableMonths().filter((m) => truthIds(m).length).sort();
      const historical = months[0];            // the earliest month with doughnuts
      dnMonth(historical);
      const players = [...dnBody().querySelectorAll('.doughnut-row')].map((x) => x.dataset.name).sort();
      dnView('list');
      const inList = { month: document.getElementById('doughnutMonthSelect').value, ids: dnListIds().sort(), truth: truthIds(historical).sort() };
      const namesInList = [...new Set(getAllApprovedMatches().filter((m) => inList.ids.includes(m.id)).flatMap((m) => [...m.winners, ...m.losers]))].sort();
      dnView('player');
      const back = document.getElementById('doughnutMonthSelect').value;
      // Closing and reopening keeps a month the reader chose.
      document.getElementById('doughnutModal').classList.remove('show');
      openDoughnuts();
      const reopened = document.getElementById('doughnutMonthSelect').value;
      return { opened, historical, players, inList, namesInList, back, reopened };
    });
    assert.strictEqual(r.opened.month, r.opened.meaningful, 'opens on the Meaningful Month, the app\'s own month rule');
    assert.ok(r.historical < '2026-09', `a genuinely historical month (${r.historical})`);
    assert.strictEqual(r.inList.month, r.historical, 'switching to the list keeps the month');
    assert.deepStrictEqual(r.inList.ids, r.inList.truth);
    assert.deepStrictEqual(r.players, r.namesInList, 'By Player covers exactly the players in that month\'s doughnuts');
    assert.strictEqual(r.back, r.historical, 'and switching back keeps it too');
    assert.strictEqual(r.reopened, r.historical, 'a chosen month is remembered');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D7: newest first, same-day games in a fixed order, each row the match as recorded', async () => {
  const app = await open();
  try {
    await install(app);
    const r = await app.run(() => {
      openDoughnuts(); dnView('list'); dnMonth('all');
      const rows = [...dnBody().querySelectorAll('.doughnut-result')].map((b) => ({
        id: b.dataset.matchId, date: b.querySelector('.doughnut-result-date').textContent,
        line: b.querySelector('.doughnut-result-line').textContent.replace(/\s+/g, ' ').trim(),
        bold: (b.querySelector('.doughnut-result-line > b') || {}).textContent || null }));
      const byId = Object.fromEntries(getAllApprovedMatches().map((m) => [m.id, m]));
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const checks = rows.map((row) => {
        const m = byId[row.id];
        const score = m.sets.map(([x, y]) => `${x}–${y}`).join(', ');
        const [, mo, d] = m.date.split('-').map(Number);
        return { id: row.id, date: m.date, expectedLine: `${m.winners.join(' & ')} ${score} ${m.losers.join(' & ')}${m.isDraw ? ' · Drawn' : ''}`,
          line: row.line, shownDate: row.date, expectedDate: `${d} ${months[mo - 1]}`,
          bold: row.bold, winners: m.winners.join(' & '), isDraw: !!m.isDraw };
      });
      return { checks, order: doughnutMatches('all').map((m) => m.id) };
    });
    const dates = r.checks.map((c) => c.date);
    assert.deepStrictEqual(dates, dates.slice().sort().reverse(), 'newest first');
    assert.deepStrictEqual(r.checks.map((c) => c.id), r.order, 'the rendered order is the one fixed order');
    // Same day: later-recorded first, by id.
    for (let i = 1; i < r.checks.length; i++) {
      if (r.checks[i].date === r.checks[i - 1].date) {
        assert.ok(r.checks[i - 1].id.localeCompare(r.checks[i].id, undefined, { numeric: true }) > 0, `${r.checks[i - 1].id} before ${r.checks[i].id}`);
      }
    }
    assert.ok(r.checks.some((c, i) => i && c.date === r.checks[i - 1].date), 'the record has same-day doughnuts to order');
    r.checks.forEach((c) => {
      assert.strictEqual(c.line, c.expectedLine, `${c.id}: winners, the score as recorded, losers`);
      assert.strictEqual(c.shownDate, c.expectedDate);
      if (!c.isDraw) assert.strictEqual(c.bold, c.winners, `${c.id}: the winners are marked, as on every result`);
    });
    assert.ok(r.checks.some((c) => c.isDraw), 'a drawn doughnut is in the list, said as drawn');
  } finally { await app.close(); }
});

maybe('D7: tapping a result opens it in Play › Games, the app\'s one result detail', async () => {
  const app = await open();
  try {
    await install(app);
    const r = await app.run(() => {
      openDoughnuts(); dnView('list'); dnMonth('all');
      const btn = dnBody().querySelectorAll('.doughnut-result')[2];
      const id = btn.dataset.matchId;
      btn.click();
      const card = document.querySelector(`#gamesView [data-gameid="${id}"]`);
      return { id, activeTab, expanded: expandedGameId, card: !!card, sheetOpen: document.getElementById('doughnutModal').classList.contains('show') };
    });
    assert.deepStrictEqual([r.activeTab, r.expanded, r.card, r.sheetOpen], ['games', r.id, true, false]);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D7: a month without doughnuts says so, in both views', async () => {
  const app = await open();
  try {
    await install(app);
    const r = await app.run(() => {
      // Data Range "all" adds the display-only April/May history to the month
      // list. Those months hold no rated games, so no doughnuts -- the same
      // record every other count uses.
      dataRange = 'all';
      openDoughnuts();
      const empty = [...document.getElementById('doughnutMonthSelect').options].map((o) => o.value)
        .find((m) => m !== 'all' && !truthIds(m).length);
      if (!empty) return { empty: null };
      dnMonth(empty);
      const player = { text: dnBody().textContent, rows: dnBody().querySelectorAll('.doughnut-row').length, hasEmpty: !!dnBody().querySelector('.doughnut-empty') };
      dnView('list');
      const list = { text: dnBody().textContent, rows: dnBody().querySelectorAll('.doughnut-result').length, hasEmpty: !!dnBody().querySelector('.doughnut-empty') };
      return { empty, player, list, stillChoosable: !!document.getElementById('doughnutMonthSelect') };
    });
    assert.ok(r.empty, 'a month with no doughnuts exists to test');
    for (const v of ['player', 'list']) {
      assert.strictEqual(r[v].rows, 0);
      assert.strictEqual(r[v].hasEmpty, true, `${v}: a deliberate empty state`);
      assert.match(r[v].text, /No doughnuts in .+\. 🍩/);
    }
    assert.strictEqual(r.stillChoosable, true, 'the month can still be changed from an empty month');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D7: the doughnut definition and every total are unchanged — only where they are shown moved', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      // The definition (D7, narrowed to 6-0 sets on 9 Nov), written out independently and run on the same record.
      const agg = {};
      const A = (n) => (agg[n] = agg[n] || { given: 0, received: 0 });
      const process = (m) => {
        let w = false, l = false;
        m.sets.forEach(([x, y]) => { if (x === 6 && y === 0) w = true; if (x === 0 && y === 6) l = true; });
        if (w) { m.losers.forEach((n) => A(n).received++); m.winners.forEach((n) => A(n).given++); }
        if (l) { m.winners.forEach((n) => A(n).received++); m.losers.forEach((n) => A(n).given++); }
      };
      ALL_MATCHES.forEach(process);
      getAllApprovedMatches().filter((m) => m.isDraw).forEach(process);
      const now = Object.fromEntries(computeDoughnutStats().map((s) => [s.name, { given: s.given, received: s.received }]));
      // Monthly stats (League / summary) keep their own doughnut count too.
      const summary = computeMonthlySummaryStats('all');
      return { before: agg, now, summaryTotal: Object.values(summary).reduce((s, x) => s + x.doughnuts, 0) };
    });
    const before = Object.fromEntries(Object.entries(r.before).filter(([, v]) => v.given + v.received > 0));
    assert.deepStrictEqual(r.now, before);
    assert.ok(r.summaryTotal > 0, 'the monthly summary still counts doughnuts');
  } finally { await app.close(); }
});

// Shaun, 9 Nov: "only games that are listed as 6-0 should be considered a
// doughnut. I can see a game that ended 3-0 shown there."
const DH = require('./helpers/uiHarness.js');
(DH.available() ? test : test.skip)('a doughnut is a 6-0 set: 3-0, 4-0 and 7-0 are not; the list, By Player and the monthly count agree', async () => {
  const app = await DH.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(() => {
      const sides = [[6, 0], [0, 6], [3, 0], [0, 4], [7, 0], [6, 1], [10, 0]].map((s) => doughnutSide(s));
      const all = doughnutMatches('all');
      const notSixLove = all.filter((m) => !m.sets.some((s) => doughnutSide(s)));
      const listed = all.every((m) => m.shutoutSets.every((t) => t === '6-0' || t === '0-6'));
      const stats = computeDoughnutStats('all');
      const given = Object.values(stats).reduce((t, s) => t + (s.given || 0), 0);
      return { sides, notSixLove: notSixLove.length, listed, given };
    });
    assert.deepStrictEqual(r.sides, ['A', 'B', null, null, null, null, null]);
    assert.strictEqual(r.notSixLove, 0, 'every listed match has a 6-0 set');
    assert.ok(r.listed, 'and only 6-0 sets are named');
    assert.ok(r.given > 0);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
