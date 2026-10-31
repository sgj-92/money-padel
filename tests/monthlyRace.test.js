// ===================== MONTHLY RACE (Best Month) — TRIAL =====================
// Everyone in a tier starts the month on 0; each match carries stakes set by
// how hard it was for an ordinary player of that tier with the actual partner
// against the actual opponents. Approved 26 Sep 2026 as a trial, from the
// analysis in BEST_MONTH_ANALYSIS.md.
//
// What these tests hold the race to:
//   - the stakes: even is +10/-10, harder wins earn more, harder losses cost less;
//   - no reason to duck: whoever you play or partner, the expected gain is the same;
//   - your own rating never sets your stakes (that would be Monthly Performance);
//   - draws, the 5-match qualification, provisional players, split tier spells,
//     a tier with no qualifier;
//   - a drill-down that adds up to the score it explains;
//   - and nothing it sits beside -- ratings, League, Merit, Monthly
//     Performance -- moves because it exists.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./helpers/uiHarness.js');
const Race = require('../assets/js/monthlyRace.js');

const maybe = H.available() ? test : test.skip;
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// --- the stakes ----------------------------------------------------------------

test('the approved constants: K 20, results-fitted curve 250, 5 matches, a draw is half', () => {
  assert.strictEqual(Race.K, 20);
  assert.strictEqual(Race.WIN_SCALE, 250);
  assert.strictEqual(Race.MIN_MATCHES, 5);
  assert.strictEqual(Race.DRAW_RESULT, 0.5);
});

test('an even match is +10 for a win, 0 for a draw, -10 for a loss', () => {
  assert.deepStrictEqual(Race.stakesFor(Race.winChance(1400, 1400)), { win: 10, draw: 0, loss: -10 });
});

test('harder matches offer more for a win and cost less for a loss; easier the reverse', () => {
  const hard = Race.stakesFor(Race.winChance(1400, 1550));
  const even = Race.stakesFor(Race.winChance(1400, 1400));
  const easy = Race.stakesFor(Race.winChance(1400, 1250));
  assert.ok(hard.win > even.win && even.win > easy.win);
  assert.ok(hard.loss > even.loss && even.loss > easy.loss, 'a loss costs less the harder the match');
  // Every match risks exactly K between winning and losing.
  [hard, even, easy].forEach((s) => assert.ok(close(s.win - s.loss, Race.K, 0.11)));
});

test('the win curve is fitted to results, steeper than the engine\'s game-share curve', () => {
  const Engine = require('../assets/js/ratingEngine.js');
  assert.ok(Race.winChance(1500, 1400) > Engine.expectedScore(1500, 1400));
});

// --- no reason to duck ---------------------------------------------------------
// A player's expected gain from a match is K x (true chance - par chance).
// For the race to be neutral, that must not depend on who they choose to play.

const expectedGain = (me, partner, opponents, par) =>
  Race.K * (Race.winChance((me + partner) / 2, opponents) - Race.winChance((par + partner) / 2, opponents));

test('choosing easier opponents gains nothing: the expected race gain is the same against any pair', () => {
  const gains = [1250, 1300, 1350, 1400, 1450, 1500, 1550].map((opp) => expectedGain(1450, 1400, opp, 1400));
  const spread = Math.max(...gains) - Math.min(...gains);
  assert.ok(spread < 0.5, `gains ${gains.map((g) => g.toFixed(2)).join(', ')}`);
  // And it is a GAIN: a better-than-par player is rewarded wherever they play.
  gains.forEach((g) => assert.ok(g > 0));
});

test('choosing a stronger partner gains nothing either', () => {
  const gains = [1300, 1400, 1500].map((partner) => expectedGain(1450, partner, 1420, 1400));
  assert.ok(Math.max(...gains) - Math.min(...gains) < 0.5, gains.join(', '));
});

test('an ordinary player of the tier expects exactly 0 from any match', () => {
  [1250, 1400, 1550].forEach((opp) => assert.ok(close(expectedGain(1400, 1400, opp, 1400), 0)));
});

// --- building a month ----------------------------------------------------------

// A small month: `ratings` is everyone's pre-match rating; `tiers` their tier
// (optionally changing on a date).
function month(matches, ratings, tiers) {
  const tierAt = (n, d) => {
    const t = tiers[n];
    if (typeof t === 'string') return t;
    return d >= t.from ? t.to : t.before;
  };
  return Race.build({ matches, tierAt, preRating: (id, n) => (ratings[n] === undefined ? null : ratings[n]) });
}
let seq = 0;
const game = (date, winners, losers, isDraw) => ({ id: `m${++seq}`, date, winners, losers, isDraw: !!isDraw });

test('par is the mean month-opening rating of the players who played in that tier', () => {
  const r = month([game('2026-09-01', ['a', 'b'], ['c', 'd'])], { a: 1300, b: 1400, c: 1500, d: 1600 },
    { a: 'B', b: 'B', c: 'B', d: 'B' });
  assert.strictEqual(r.par.B, 1450);
});

test('your own rating never sets your stakes -- only tier par, partner and opponents do', () => {
  // x and y are in the same tier, have partners rated the same, and face
  // pairs rated the same. x is rated 1550 and y 1250: their stakes must match.
  const ratings = { x: 1550, y: 1250, px: 1400, py: 1400, o1: 1420, o2: 1380, o3: 1420, o4: 1380 };
  const tiers = Object.fromEntries(Object.keys(ratings).map((k) => [k, 'B']));
  const r = month([game('2026-09-01', ['x', 'px'], ['o1', 'o2']), game('2026-09-02', ['y', 'py'], ['o3', 'o4'])], ratings, tiers);
  const stakes = (n) => r.table.find((row) => row.playerId === n).matches[0].stakes;
  assert.deepStrictEqual(stakes('x'), stakes('y'));
});

test('a draw earns K x (0.5 - par): nothing in an even match, something in a hard one', () => {
  const ratings = { a: 1400, b: 1400, c: 1400, d: 1400, e: 1300, f: 1300, g: 1600, h: 1600 };
  const tiers = Object.fromEntries(Object.keys(ratings).map((k) => [k, 'B']));
  const r = month([game('2026-09-01', ['a', 'b'], ['c', 'd'], true), game('2026-09-02', ['e', 'f'], ['g', 'h'], true)], ratings, tiers);
  const row = (n) => r.table.find((x) => x.playerId === n);
  assert.strictEqual(row('a').draws, 1);
  assert.ok(Math.abs(row('a').score - Race.stakesFor(row('a').matches[0].parWin).draw) < 1e-9);
  assert.ok(row('e').score > 0, 'the underdog pair gains from a draw');
  assert.ok(row('g').score < 0, 'the favourite pair loses from one');
});

test('five matches in a tier qualify; four are provisional and ranked below every qualifier', () => {
  const ratings = { q: 1400, p: 1400, x: 1400, y: 1400, z: 1400 };
  const tiers = Object.fromEntries(Object.keys(ratings).map((k) => [k, 'B']));
  const ms = [];
  for (let i = 1; i <= 5; i++) ms.push(game(`2026-09-0${i}`, ['q', 'x'], ['y', 'z']));
  for (let i = 1; i <= 4; i++) ms.push(game(`2026-09-1${i}`, ['p', 'x'], ['y', 'z']));
  const r = month(ms, ratings, tiers);
  const q = r.table.find((x) => x.playerId === 'q'), p = r.table.find((x) => x.playerId === 'p');
  assert.strictEqual(q.qualified, true);
  assert.strictEqual(p.qualified, false);
  // x played nine and won them all, and sits above q on score; y and z lost
  // nine each. The provisional p (4-0) must rank below every qualifier.
  const firstProvisional = r.table.findIndex((x) => !x.qualified);
  assert.ok(r.table.slice(0, firstProvisional).every((x) => x.qualified));
  assert.ok(r.table.indexOf(p) >= firstProvisional);
});

test('a mid-month tier change makes two races; nothing moves into the new tier', () => {
  const ratings = { mover: 1450, a: 1400, b: 1400, c: 1400, d: 1650, e: 1650, f: 1650 };
  const tiers = { mover: { before: 'B', from: '2026-09-20', to: 'A' }, a: 'B', b: 'B', c: 'B', d: 'A', e: 'A', f: 'A' };
  const r = month([
    game('2026-09-02', ['mover', 'a'], ['b', 'c']),
    game('2026-09-10', ['mover', 'a'], ['b', 'c']),
    game('2026-09-21', ['d', 'e'], ['mover', 'f']),
  ], ratings, tiers);
  const spells = r.table.filter((x) => x.playerId === 'mover');
  assert.deepStrictEqual(spells.map((s) => [s.tier, s.played]).sort(), [['A', 1], ['B', 2]]);
  const bSpell = spells.find((s) => s.tier === 'B'), aSpell = spells.find((s) => s.tier === 'A');
  assert.ok(bSpell.matches.every((m) => m.date < '2026-09-20'));
  assert.ok(aSpell.matches.every((m) => m.date >= '2026-09-20'));
  // Each spell starts from 0: the A spell is exactly its own one match.
  assert.strictEqual(aSpell.score, aSpell.matches[0].points);
});

test('a tier where nobody reaches five has no qualifier', () => {
  const ratings = { c1: 1100, c2: 1100, c3: 1100, c4: 1100 };
  const tiers = Object.fromEntries(Object.keys(ratings).map((k) => [k, 'C']));
  const r = month([game('2026-09-01', ['c1', 'c2'], ['c3', 'c4'])], ratings, tiers);
  assert.strictEqual(r.table.filter((x) => x.tier === 'C' && x.qualified).length, 0);
  assert.strictEqual(r.table.filter((x) => x.tier === 'C').length, 4, 'still shown, provisionally');
});

test('the drill-down adds up: a score is exactly the sum of the points listed under it', () => {
  const ratings = { a: 1500, b: 1350, c: 1420, d: 1380, e: 1460, f: 1330 };
  const tiers = Object.fromEntries(Object.keys(ratings).map((k) => [k, 'B']));
  const ms = [game('2026-09-01', ['a', 'b'], ['c', 'd']), game('2026-09-02', ['c', 'a'], ['e', 'f']),
    game('2026-09-03', ['e', 'f'], ['a', 'd'], true), game('2026-09-04', ['b', 'd'], ['a', 'f'])];
  const r = month(ms, ratings, tiers);
  r.table.forEach((row) => {
    const sum = Math.round(row.matches.reduce((s, m) => s + m.points, 0) * 10) / 10;
    assert.strictEqual(row.score, sum, row.playerId);
    row.matches.forEach((m) => {
      const expected = m.result === 'W' ? m.stakes.win : m.result === 'D' ? m.stakes.draw : m.stakes.loss;
      assert.strictEqual(m.points, expected);
    });
  });
});

test('a match nobody can rate or tier is reported, never guessed at', () => {
  const r = month([game('2026-09-01', ['a', 'b'], ['c', 'ghost'])], { a: 1400, b: 1400, c: 1400 },
    { a: 'B', b: 'B', c: 'B', ghost: 'B' });
  assert.strictEqual(r.unresolved.length, 1);
  assert.strictEqual(r.table.length, 0);
});

test('the race reads persisted facts and never reaches into sequential-v1', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'monthlyRace.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(src, /require\(|processMatch|replay|applyStateEvent|RatingEngine|\.set\(|\.update\(|batch/);
});

// --- in the app ------------------------------------------------------------------

const NOW = '2026-09-26T12:00:00';
// Opens the League screen on the race. Installed in the page, where the test
// bodies run.
const withRace = async (options) => {
  const app = await H.open(options);
  await app.run(() => {
    window.openRace = () => {
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      summaryMode = 'race'; renderSummary();
    };
  });
  return app;
};

maybe('the Monthly Race is a view on the League screen, first, then Merit and League', async () => {
  const app = await withRace({ now: NOW });
  try {
    const r = await app.run(() => {
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      return [...document.querySelectorAll('#summaryModeSelect option')].map((o) => o.value);
    });
    assert.deepStrictEqual(r, ['race', 'merit', 'league', 'information'], 'in order of importance (Shaun, 31 Oct)');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('each tier shows its qualifiers in race order, provisional players apart, and "No qualifier" where nobody reached five', async () => {
  const app = await withRace({ now: NOW });
  try {
    const r = await app.run(() => {
      openRace();
      // Open every tier, the one-player ones included.
      TIER_ORDER_LIST.forEach((t) => { raceTierOpen[t] = true; });
      renderMonthlyRace();
      const { table } = buildMonthlyRace(summaryMonth);
      const out = {};
      TIER_ORDER_LIST.forEach((t) => {
        const body = document.getElementById('raceTierBody' + t);
        if (!body) return;
        const tables = body.querySelectorAll('table');
        const names = (tb) => tb ? [...tb.querySelectorAll('tbody tr:not(.merit-drill) .request-player-link')].map((e) => e.textContent) : [];
        const hasNoq = !!body.querySelector('.race-noq');
        out[t] = {
          noq: hasNoq,
          shownQualified: hasNoq ? [] : names(tables[0]),
          shownProvisional: names(hasNoq ? tables[0] : tables[1]),
          qualified: table.filter((x) => x.tier === t && x.qualified).map((x) => x.playerId),
          provisional: table.filter((x) => x.tier === t && !x.qualified).map((x) => x.playerId),
        };
      });
      return { month: summaryMonth, out };
    });
    assert.strictEqual(r.month, '2026-09');
    for (const [t, v] of Object.entries(r.out)) {
      assert.deepStrictEqual(v.shownQualified, v.qualified, `Tier ${t} qualifiers`);
      assert.deepStrictEqual(v.shownProvisional, v.provisional, `Tier ${t} provisional`);
      assert.strictEqual(v.noq, v.qualified.length === 0, `Tier ${t} "No qualifier this month"`);
    }
    assert.ok(r.out.A.qualified.length > 0 && r.out.B.qualified.length > 0);
    assert.strictEqual(r.out.C.noq, true, 'Tier C is not merged into B; it simply has no qualifier');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('tapping a score opens the matches behind it, and what is shown adds up to the score', async () => {
  const app = await withRace({ now: NOW });
  try {
    const r = await app.run(() => {
      openRace();
      const btn = [...document.querySelectorAll('.race-score')][0];
      const score = btn.textContent.trim();
      btn.click();
      const pts = [...document.querySelectorAll('.race-drill-row .race-pts')].map((e) => e.textContent.trim());
      const num = (s) => Number(s.replace('−', '-'));
      const sum = Math.round(pts.reduce((a, s) => a + num(s), 0) * 10) / 10;
      const rows = [...document.querySelectorAll('.race-drill-row')];
      return { score, total: document.querySelector('.race-drill-total').textContent.trim(), sum,
        played: Number(btn.closest('tr').children[2].textContent), listed: rows.length,
        meta: rows[0].querySelector('.race-drill-meta').textContent };
    });
    assert.strictEqual(r.total, `Total ${r.score}`);
    assert.strictEqual(Number(r.score.replace('−', '-')), r.sum);
    assert.strictEqual(r.listed, r.played, 'every match in the spell is listed');
    assert.match(r.meta, /Stakes: win [+−]\d+\.\d · draw [+−]?\d+\.\d · lose [+−]?\d+\.\d/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('All Time has no race: it asks for a month', async () => {
  const app = await withRace({ now: NOW });
  try {
    const text = await app.run(() => { openRace(); summaryMonth = 'all'; summaryMonthChoice = 'all'; renderSummary();
      return document.getElementById('summaryContent').textContent; });
    assert.match(text, /starts again every month/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('opening the race changes nothing it sits beside: ratings, League, Merit, Monthly Performance', async () => {
  const app = await withRace({ now: NOW });
  try {
    const snap = () => {
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      const views = {};
      for (const mode of ['league', 'merit']) { summaryMode = mode; renderSummary(); views[mode] = document.getElementById('summaryContent').innerHTML; }
      return {
        views,
        ratings: JSON.stringify(PLAYERS.map((p) => [p.name, p.rating])),
        performance: JSON.stringify(MonthlyViews.performanceTable(MONTHLY_VIEWS, summaryMonth)),
        journey: V3_JOURNEY.length,
        writes: window.__writes.length,
      };
    };
    const before = await app.run(snap);
    await app.run(() => { openRace(); document.querySelectorAll('.race-score')[0].click(); });
    const after = await app.run(snap);
    assert.deepStrictEqual(after, before);
    assert.strictEqual(after.writes, 0, 'the race writes nothing');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 31 Oct: the Monthly Race is the centrepiece of the month -- the League
// screen opens on it, and Home's hero tells it (raceStandingOf).
maybe('the League screen opens on the Monthly Race', async () => {
  const app = await H.open({ now: NOW });
  try {
    const r = await app.run(() => {
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      return { mode: summaryMode, select: document.getElementById('summaryModeSelect').value,
        heading: document.querySelector('#summaryContent .section-heading').textContent };
    });
    assert.deepStrictEqual([r.mode, r.select], ['race', 'race']);
    assert.match(r.heading, /Monthly Race/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('raceStandingOf places a player exactly as the Race table does', async () => {
  const app = await H.open({ now: NOW });
  try {
    const r = await app.run(() => {
      const month = '2026-09';
      const table = buildMonthlyRace(month).table;
      return [...new Set(table.map((x) => x.playerId))].map((name) => ({ name, got: raceStandingOf(name, month),
        want: table.filter((x) => x.playerId === name).map((x) => {
          const ranked = table.filter((y) => y.tier === x.tier && y.qualified);
          return { tier: x.tier, qualified: x.qualified, position: x.qualified ? ranked.indexOf(x) + 1 : null, score: x.score, games: x.played };
        }) }));
    });
    assert.ok(r.length > 5);
    r.forEach(({ name, got, want }) => assert.deepStrictEqual(
      got.map((g) => ({ tier: g.tier, qualified: g.qualified, position: g.position, score: g.score, games: g.games })), want, name));
    const prov = r.flatMap((x) => x.got).find((g) => !g.qualified);
    assert.ok(prov && prov.position === null && prov.toQualify > 0, 'a provisional player has no place, and is told how many to go');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 31 Oct: "hide the stakes and % info unless we tap a button/chevron".
maybe('a match\'s stakes and win chance stay hidden until its Details button is tapped, in the Race and on the Merit Table', async () => {
  const app = await withRace({ now: NOW });
  try {
    const r = await app.run(() => {
      const shown = (row) => getComputedStyle(row.querySelector('.race-drill-meta')).display !== 'none';
      openRace();
      document.querySelector('.race-score').click();
      const rows = [...document.querySelectorAll('.race-drill-row')];
      const before = rows.map(shown);
      const btn = rows[0].querySelector('.race-stakes-toggle');
      btn.click();
      const afterOne = rows.map(shown);
      const expanded = btn.getAttribute('aria-expanded');
      btn.click();
      const closed = shown(rows[0]);
      // The Merit Table's Race column opens the same rows.
      summaryMode = 'merit'; leagueGrouped = false; meritDrill = null; renderSummary();
      document.querySelector('#summaryContent .merit-count[data-kind="race"]').click();
      const mRow = document.querySelector('#summaryContent .race-drill-row');
      const mBefore = shown(mRow);
      mRow.querySelector('.race-stakes-toggle').click();
      return { before, afterOne, expanded, closed, mBefore, mAfter: shown(mRow) };
    });
    assert.ok(r.before.length > 1 && r.before.every((x) => !x), 'hidden by default');
    assert.deepStrictEqual(r.afterOne, r.before.map((_, i) => i === 0), 'one tap shows that match only');
    assert.strictEqual(r.expanded, 'true');
    assert.strictEqual(r.closed, false, 'a second tap hides it again');
    assert.deepStrictEqual([r.mBefore, r.mAfter], [false, true]);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
