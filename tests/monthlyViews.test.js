const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../assets/js/ratingEngine.js');
const MV = require('../assets/js/monthlyViews.js');
const TH = require('../assets/js/tierHistory.js');
const D = require('./helpers/dataset.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');

const ROOT = path.join(__dirname, '..');

function views() {
  const { replay } = buildBackfill();
  const history = TH.create({ currentTiers: D.loadBaseTiers() });
  return { v: MV.build(replay.journey, { tierAsOf: history.tierAsOf }), replay };
}

test('there is no monthly rating solver — month end equals the live trajectory', () => {
  const { v, replay } = views();
  const last = v.months[v.months.length - 1];
  const ends = MV.monthEndRatings(v, last);
  Object.entries(replay.state).forEach(([name, s]) => {
    assert.strictEqual(ends[name], s.rating,
      `${name}: the final month's close must BE the player's current rating, not a re-solve`);
  });
});

test('a month opens exactly where the previous month closed', () => {
  const { v } = views();
  for (let i = 1; i < v.months.length; i++) {
    const prevClose = v.closing[v.months[i - 1]];
    v.byMonth[v.months[i]].rows.forEach((r) => {
      if (prevClose[r.playerId] !== undefined) {
        assert.strictEqual(r.startRating, prevClose[r.playerId],
          `${r.playerId} ${r.month}: no reset between months`);
      }
    });
  }
});

test('rating change is the real movement across the month', () => {
  const { v } = views();
  v.months.forEach((m) => v.byMonth[m].rows.forEach((r) => {
    assert.strictEqual(r.ratingChange, Math.round((r.endRating - r.startRating) * 10) / 10);
  }));
});

test('monthly performance is versus persisted expectation, not rating movement', () => {
  const { v } = views();
  // The two are different concepts and must be able to disagree in sign.
  const rows = v.months.flatMap((m) => v.byMonth[m].rows)
    .filter((r) => r.monthlyPerformance !== null);
  assert.ok(rows.length > 0);
  const disagree = rows.filter((r) => Math.sign(r.ratingChange) !== Math.sign(r.monthlyPerformance)
    && r.ratingChange !== 0 && r.monthlyPerformance !== 0);
  assert.ok(disagree.length > 0,
    'performance and rating movement are distinct measures and should not be interchangeable');
});

test('a reassessment would move rating without touching monthly performance', () => {
  // Rating Movement reads postMatchRating/newPowerRating; performance reads
  // actual minus expectation. A club reassessment changes only the former.
  const events = [
    { playerId: 'X', eventType: Engine.EVENT.PLAYER_INITIALISED, effectiveDate: '2026-06-01', newPowerRating: 1400 },
    { playerId: 'X', eventType: Engine.EVENT.MATCH_UPDATE, effectiveDate: '2026-06-10', matchId: 'm1',
      preMatchRating: 1400, postMatchRating: 1420, preMatchExpectedScore: 0.5, actualScore: 0.6 },
    { playerId: 'X', eventType: Engine.EVENT.CLUB_RATING_REASSESSMENT, effectiveDate: '2026-06-20',
      previousPowerRating: 1420, newPowerRating: 1500 },
  ];
  const v = MV.build(events, { tierAsOf: () => 'B' });
  const row = v.byMonth['2026-06'].rows.find((r) => r.playerId === 'X');
  assert.strictEqual(row.endRating, 1500, 'the reassessment moves the rating');
  assert.strictEqual(Math.round(row.monthlyPerformance * 1000) / 1000, 0.1,
    'performance stays 0.6 - 0.5 and is untouched by the reassessment');
});

test('rank movement uses the tier in force at the boundary', () => {
  const { v } = views();
  const history = TH.create({ currentTiers: D.loadBaseTiers() });
  // Shaun was Tier C in June and Tier B from 1 July.
  assert.strictEqual(history.tierAsOf('Shaun', '2026-06-30'), 'C');
  const june = v.byMonth['2026-06'].rows.find((r) => r.playerId === 'Shaun');
  assert.strictEqual(june.tierAtMonthEnd, 'C', 'a later promotion must not rewrite June');
  const july = v.byMonth['2026-07'].rows.find((r) => r.playerId === 'Shaun');
  assert.strictEqual(july.tierAtMonthEnd, 'B');
});

test('only players who actually played get a movement row', () => {
  const { v } = views();
  v.months.forEach((m) => {
    v.byMonth[m].rows.forEach((r) => assert.ok(r.matches > 0, `${r.playerId} ${m} has no matches`));
  });
  assert.strictEqual(v.byMonth['2026-06'].rows.length, 22);
  assert.strictEqual(v.byMonth['2026-09'].rows.length, 25);
});

test('eligibility thresholds carry through unchanged', () => {
  const { v } = views();
  v.months.forEach((m) => v.byMonth[m].rows.forEach((r) => {
    assert.strictEqual(r.provisional, r.matches <= 2);
    assert.strictEqual(r.tableEligible, r.matches >= 3);
    assert.strictEqual(r.podiumEligible, r.matches >= 5);
  }));
  assert.ok(MV.performanceTable(v, '2026-08').every((r) => r.matches >= 3));
});

test('the performance table ranks by performance, the movement table by points', () => {
  const { v } = views();
  const perf = MV.performanceTable(v, '2026-08');
  for (let i = 1; i < perf.length; i++) {
    assert.ok(perf[i - 1].monthlyPerformance >= perf[i].monthlyPerformance);
  }
  const mov = MV.ratingMovementTable(v, '2026-08');
  for (let i = 1; i < mov.length; i++) assert.ok(mov[i - 1].ratingChange >= mov[i].ratingChange);
  assert.notStrictEqual(perf[0].playerId, mov[0].playerId,
    'the best performer and the biggest riser are different questions');
});

test('crossovers are real swaps, and the first month has none to report', () => {
  const { v } = views();
  assert.strictEqual(v.byMonth['2026-06'].crossovers.length, 0, 'no prior month to move from');
  const aug = v.byMonth['2026-08'];
  assert.ok(aug.crossovers.length > 0);
  aug.crossovers.forEach((c) => {
    const open = v.closing['2026-07'], close = aug.closingRatings;
    assert.ok(open[c.overtaken] > open[c.overtook], `${c.overtook} should start behind ${c.overtaken}`);
    assert.ok(close[c.overtook] > close[c.overtaken], `${c.overtook} should finish ahead`);
  });
});

test('the legacy monthly solver is gone from the application', () => {
  const strip = (s) => s.replace(/^\s*\/\/.*$/gm, '');
  const { appScriptFiles, readAppScript } = require('./helpers/appSource.js');
  appScriptFiles().forEach((f) => {
    const src = strip(readAppScript(f));
    assert.ok(!src.includes('computeMonthlyRating'), f + ' still calls the retired monthly solver');
  });
  const mv = strip(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'monthlyViews.js'), 'utf8'));
  assert.ok(!mv.includes('computeElo'), 'monthly views must never solve a rating of their own');
});

test('monthly views read the journey, never rebuild it from matches', () => {
  const strip = (s) => s.replace(/^\s*\/\/.*$/gm, '');
  const mv = strip(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'monthlyViews.js'), 'utf8'));
  assert.ok(!mv.includes('processMatch'), 'the engine must not be re-run to build a monthly view');
  assert.ok(mv.includes('postMatchRating'), 'movement comes from persisted journey ratings');
});

// ---------- acceptance: no invented movement, no missing boundary state ----------

function tierChangeFixture() {
  const ev = [
    { playerId: 'X', eventType: Engine.EVENT.PLAYER_INITIALISED, effectiveDate: '2026-06-01', newPowerRating: 1100 },
    { playerId: 'A', eventType: Engine.EVENT.PLAYER_INITIALISED, effectiveDate: '2026-06-01', newPowerRating: 1050 },
    { playerId: 'B', eventType: Engine.EVENT.PLAYER_INITIALISED, effectiveDate: '2026-06-01', newPowerRating: 1400 },
    { playerId: 'X', eventType: Engine.EVENT.MATCH_UPDATE, effectiveDate: '2026-06-10', matchId: 'm1', preMatchRating: 1100, postMatchRating: 1120, preMatchExpectedScore: 0.5, actualScore: 0.6 },
    { playerId: 'X', eventType: Engine.EVENT.MATCH_UPDATE, effectiveDate: '2026-07-10', matchId: 'm2', preMatchRating: 1120, postMatchRating: 1130, preMatchExpectedScore: 0.5, actualScore: 0.6 },
    { playerId: 'A', eventType: Engine.EVENT.MATCH_UPDATE, effectiveDate: '2026-07-11', matchId: 'm3', preMatchRating: 1050, postMatchRating: 1060, preMatchExpectedScore: 0.5, actualScore: 0.6 },
  ];
  // X is promoted C -> B partway through July.
  const tierAsOf = (n, d) => (n === 'X' ? (d >= '2026-07-15' ? 'B' : 'C') : (n === 'B' ? 'B' : 'C'));
  return MV.build(ev, { tierAsOf });
}

test('a tier change never invents a within-tier rank movement', () => {
  const r = MV.playerMonth(tierChangeFixture(), '2026-07', 'X');
  assert.strictEqual(r.tierChanged, true);
  assert.strictEqual(r.tierAtMonthStart, 'C');
  assert.strictEqual(r.tierAtMonthEnd, 'B');
  assert.strictEqual(r.rankChangeInTier, null,
    'a rank in Tier C cannot be subtracted from a rank in Tier B');
  // The boundary ranks themselves are still reported, just not differenced.
  assert.ok(r.startRankInTier !== null && r.endRankInTier !== null);
  // Overall rank remains comparable across a tier change.
  assert.ok(r.rankChangeOverall !== null);
});

test('a player who did not play still gets their boundary state', () => {
  const v = tierChangeFixture();
  const idle = v.byMonth['2026-07'].inactiveRows.find((r) => r.playerId === 'B');
  assert.ok(idle, 'B sat July out and must still appear');
  assert.strictEqual(idle.played, false);
  assert.strictEqual(idle.matches, 0);
  assert.strictEqual(idle.ratingChange, 0, 'sitting out does not move a rating');
  assert.ok(idle.startRankOverall !== null && idle.endRankOverall !== null);
  assert.strictEqual(idle.monthlyPerformance, null, 'no games means no performance figure, not zero');
});

test('an idle player can still move rank when others move around them', () => {
  const ev = [
    { playerId: 'Idle', eventType: Engine.EVENT.PLAYER_INITIALISED, effectiveDate: '2026-06-01', newPowerRating: 1200 },
    { playerId: 'Riser', eventType: Engine.EVENT.PLAYER_INITIALISED, effectiveDate: '2026-06-01', newPowerRating: 1100 },
    { playerId: 'Riser', eventType: Engine.EVENT.MATCH_UPDATE, effectiveDate: '2026-06-02', matchId: 'a', preMatchRating: 1100, postMatchRating: 1150, preMatchExpectedScore: 0.5, actualScore: 0.9 },
    { playerId: 'Riser', eventType: Engine.EVENT.MATCH_UPDATE, effectiveDate: '2026-07-02', matchId: 'b', preMatchRating: 1150, postMatchRating: 1300, preMatchExpectedScore: 0.5, actualScore: 0.9 },
  ];
  const idle = MV.playerMonth(MV.build(ev, { tierAsOf: () => 'B' }), '2026-07', 'Idle');
  assert.strictEqual(idle.ratingChange, 0);
  assert.strictEqual(idle.startRankOverall, 1);
  assert.strictEqual(idle.endRankOverall, 2, 'overtaken while sitting out');
  assert.strictEqual(idle.rankChangeOverall, -1);
});

test('playerMonth finds both active and inactive players, and nothing else', () => {
  const v = tierChangeFixture();
  assert.ok(MV.playerMonth(v, '2026-07', 'X').played);
  assert.strictEqual(MV.playerMonth(v, '2026-07', 'B').played, false);
  assert.strictEqual(MV.playerMonth(v, '2026-07', 'Nobody'), null);
  assert.strictEqual(MV.playerMonth(v, '2099-01', 'X'), null);
});

test('the real dataset reports fallers as well as risers', () => {
  const { v } = views();
  const moves = MV.ratingMovementTable(v, '2026-08');
  assert.ok(moves.some((r) => r.ratingChange > 0), 'risers exist');
  assert.ok(moves.some((r) => r.ratingChange < 0), 'fallers exist and must be reportable');
  const ranked = v.byMonth['2026-08'].rows.filter((r) => r.rankChangeOverall !== null);
  assert.ok(ranked.some((r) => r.rankChangeOverall < 0), 'rank slides exist and must be reportable');
});

test('no user-facing copy still describes the retired monthly solver', () => {
  const { appScriptFiles, readAppScript } = require('./helpers/appSource.js');
  appScriptFiles().forEach((f) => {
    const src = readAppScript(f);
    assert.ok(!/mini-season/i.test(src), f + ' still describes a monthly mini-season');
    assert.ok(!/tier-seeded rating using only/i.test(src), f + ' still describes a monthly re-solve');
  });
});
