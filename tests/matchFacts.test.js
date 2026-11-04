// The application used to derive a match's expectation from TODAY's ratings and
// print it on a card about a match played months earlier. Two things were wrong
// with that: the project forbids recomputing historical expectations in the
// browser, and the number was unstable -- the same past match reported a
// different expectation every time anybody played.
//
// These tests hold the replacement to the engine's own record.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../assets/js/ratingEngine.js');
const MF = require('../assets/js/matchFacts.js');
const JV = require('../assets/js/journeyView.js');
const MV = require('../assets/js/monthlyViews.js');
const TH = require('../assets/js/tierHistory.js');
const D = require('./helpers/dataset.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');

const ROOT = path.join(__dirname, '..');

let cached = null;
function backfill() {
  if (!cached) {
    const b = buildBackfill();
    cached = { b, facts: MF.index(b.replay.journey) };
  }
  return cached;
}

test('every rated match has recorded facts, and they are the engine\'s own numbers', () => {
  const { b, facts } = backfill();
  assert.strictEqual(Object.keys(facts).length, b.matches.length);
  b.replay.journey.filter((e) => e.eventType === Engine.EVENT.MATCH_UPDATE).forEach((e) => {
    const f = facts[e.matchId];
    const mine = f.byPlayer[e.playerId];
    assert.strictEqual(mine.preMatchRating, e.preMatchRating);
    assert.strictEqual(mine.postMatchRating, e.postMatchRating);
    assert.strictEqual(mine.kUsed, e.kUsed);
    assert.strictEqual(f.sides[e.side].expected, e.preMatchExpectedScore);
    assert.strictEqual(f.sides[e.side].actual, e.actualScore);
  });
});

test('a match reports four players and two sides, every time', () => {
  const { facts } = backfill();
  Object.values(facts).forEach((f) => {
    const n = f.sides.A.players.length + f.sides.B.players.length;
    assert.ok(n === 4 || n === 2, `${f.matchId} has ${n} players`);
    assert.strictEqual(Object.keys(f.byPlayer).length, n);
    // The two sides' expectations and scores are complements, by construction.
    assert.ok(Math.abs(f.sides.A.expected + f.sides.B.expected - 1) < 1e-9);
    assert.ok(Math.abs(f.sides.A.actual + f.sides.B.actual - 1) < 1e-9);
    assert.ok(Math.abs(f.sides.A.residual + f.sides.B.residual) < 1e-9);
  });
});

test('the expectation is fixed to the match, not to what ratings are now', () => {
  // Re-running the backfill from the same source must give byte-identical
  // expectations. A browser-side recomputation could not promise this: it
  // moves every time anybody plays.
  const first = MF.index(buildBackfill().replay.journey);
  const second = MF.index(buildBackfill().replay.journey);
  Object.keys(first).forEach((id) => {
    assert.strictEqual(first[id].sides.A.expected, second[id].sides.A.expected);
    assert.strictEqual(first[id].sides.A.preRating, second[id].sides.A.preRating);
  });
});

test('players in one match move by different amounts -- there is no single match delta', () => {
  const { facts } = backfill();
  const differing = Object.values(facts).filter((f) => {
    const deltas = Object.values(f.byPlayer).map((p) => Math.abs(p.ratingDelta));
    return new Set(deltas).size > 1;
  });
  assert.ok(differing.length > 50,
    `K is per-player; expected many matches with unequal movement, got ${differing.length}`);
});

test('a draw is rated: it moves every player, and it is not a win for anyone', () => {
  const { b, facts } = backfill();
  const draws = b.matches.filter((m) => m.outcome === Engine.OUTCOME.DRAW);
  assert.ok(draws.length > 0, 'the dataset should contain draws to test against');
  draws.forEach((d) => {
    const f = facts[d.id];
    assert.ok(f, `draw ${d.id} has no recorded facts`);
    assert.strictEqual(Object.keys(f.byPlayer).length, 4);
    // 0.5 for the result component on both sides.
    assert.ok(Math.abs(f.sides.A.actual - f.sides.B.actual) < 0.5);
  });
  const moved = draws.some((d) => Object.values(facts[d.id].byPlayer).some((p) => Math.abs(p.ratingDelta) > 1));
  assert.ok(moved, 'at least one draw should move a rating by more than a point');
});

test('forPlayer answers by player, so a draw needs no winner/loser special case', () => {
  const { b, facts } = backfill();
  const draw = b.matches.find((m) => m.outcome === Engine.OUTCOME.DRAW);
  const who = draw.teamA[0];
  const view = MF.forPlayer(facts[draw.id], who);
  assert.ok(view);
  assert.ok(view.mine.names.includes(who));
  assert.ok(!view.theirs.names.includes(who));
  assert.strictEqual(MF.forPlayer(facts[draw.id], 'Nobody At All'), null);
});

test('a month slice is a window on the continuous rating, not a monthly re-solve', () => {
  const { b } = backfill();
  const history = TH.create({ currentTiers: D.loadBaseTiers() });
  const v = MV.build(b.replay.journey, { tierAsOf: history.tierAsOf });
  let checked = 0;
  v.months.forEach((month) => {
    v.byMonth[month].rows.forEach((row) => {
      const slice = JV.monthSlice(JV.forPlayer(b.replay.journey, row.playerId), month);
      assert.ok(slice, `${row.playerId} has no ${month} slice`);
      assert.strictEqual(slice.startRating, row.startRating,
        `${row.playerId} ${month}: the month opens where the rating already was`);
      assert.strictEqual(slice.endRating, row.endRating);
      checked++;
    });
  });
  assert.ok(checked > 90, `expected a full season of player-months, got ${checked}`);
});

test('a month never opens at a tier seed', () => {
  const { b } = backfill();
  const seeds = [1100, 1400, 1700, 2000];
  const journeys = Object.keys(b.replay.state).map((n) => JV.forPlayer(b.replay.journey, n));
  let laterMonthOpenings = 0;
  journeys.forEach((j) => {
    ['2026-07', '2026-08', '2026-09'].forEach((month) => {
      const slice = JV.monthSlice(j, month);
      if (!slice) return;
      // A player who joined mid-season legitimately opens their first month at
      // their tier's entry rating. That is an entry point, not a monthly reset.
      if (slice.entries.some((e) => e.kind === 'initialised')) return;
      laterMonthOpenings++;
      assert.ok(!seeds.includes(slice.startRating),
        `${j.playerId} opened ${month} on the seed value ${slice.startRating}`);
    });
  });
  assert.ok(laterMonthOpenings > 50);
});

test('the browser no longer recomputes a historical expectation or a fake delta', () => {
  const { appScriptFiles, readAppScript } = require('./helpers/appSource.js');
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter((l) => !l.trim().startsWith('//')).join('\n');
  const all = appScriptFiles().map((f) => code(readAppScript(f))).join('\n');

  assert.ok(!/expected_winshare|overperformance_winner/.test(all),
    'the browser-derived expectation fields must be gone, not merely unread');
  assert.ok(!/displayDeltaFromOverperf|DISPLAY_MATCH_WEIGHT/.test(all),
    'the invented per-match rating delta must be gone');
  // enrichMatches must not do logistic arithmetic of its own any more.
  const enrich = all.slice(all.indexOf('function enrichMatches'), all.indexOf('function buildPlayers'));
  assert.ok(!/Math\.pow\(10/.test(enrich), 'enrichMatches must read expectations, not derive them');
  assert.ok(/V3_MATCH_FACTS/.test(enrich), 'enrichMatches must read the engine\'s recorded facts');
  // and the legacy monthly solver must not be reachable from the monthly views.
  assert.ok(!/computeElo\(/.test(all.replace(/function computeElo\(/g, '')),
    'nothing may call the legacy joint solver');
});

test('the monthly breakdown no longer describes a solver that is not running', () => {
  // Comments stripped: several of these phrases survive on purpose as notes
  // recording what the copy used to claim and why it was wrong.
  const app = require('./helpers/appSource.js').readAllAppSource()
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter((l) => !l.trim().startsWith('//')).join('\n');
  ['K=28', '300 passes', 'solved every player', 'starts the month at their tier baseline',
   "doesn't affect any rating", 'joint rating solver'].forEach((phrase) => {
    assert.ok(!app.includes(phrase), `stale copy still present: "${phrase}"`);
  });
});
