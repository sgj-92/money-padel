// The Rating Journey shown to a player must BE the recorded history -- not a
// second calculation that has to be caveated. These tests hold that line: the
// journey's last point is the Power Rating, nothing is reordered, and the two
// event kinds that are not results (tier changes, club reassessments) can never
// be presented as if they were.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../assets/js/ratingEngine.js');
const JV = require('../assets/js/journeyView.js');
const D = require('./helpers/dataset.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');

const ROOT = path.join(__dirname, '..');

let cached = null;
function replay() {
  if (!cached) cached = buildBackfill().replay;
  return cached;
}
function playersWithJourneys() {
  const r = replay();
  return Object.keys(r.state).map((name) => JV.forPlayer(r.journey, name)).filter(Boolean);
}

test('a player with no recorded events gets null, never an invented starting point', () => {
  assert.strictEqual(JV.forPlayer(replay().journey, 'Nobody At All'), null);
  assert.strictEqual(JV.forPlayer([], 'Shaun'), null);
});

test('the journey ends exactly on the Power Rating -- there is no gap to disclaim', () => {
  const r = replay();
  Object.entries(r.state).forEach(([name, s]) => {
    const j = JV.forPlayer(r.journey, name);
    assert.ok(j, `${name} has no journey`);
    assert.strictEqual(j.endRating, s.rating,
      `${name}: the journey's last point must BE the Power Rating, not an estimate of it`);
  });
});

test('every step joins up: each event starts where the previous one finished', () => {
  playersWithJourneys().forEach((j) => {
    j.entries.forEach((e, i) => {
      if (i === 0 || e.previousRating === null) return;
      assert.ok(Math.abs(e.previousRating - j.entries[i - 1].rating) < 1e-9,
        `${j.playerId} event ${i} (${e.eventType}) starts at ${e.previousRating} but the previous event left it at ${j.entries[i - 1].rating}`);
    });
  });
});

test('ordering matches the engine: same-day state events land before that day\'s matches', () => {
  const j = JV.forPlayer(replay().journey, 'Shaun');
  const correction = j.entries.findIndex((e) => e.kind === 'correction');
  assert.ok(correction >= 0, 'Shaun should carry the initial-classification correction');
  const sameDayMatch = j.entries.findIndex((e) => e.kind === 'match' && e.date === j.entries[correction].date);
  if (sameDayMatch >= 0) {
    assert.ok(correction < sameDayMatch,
      'the engine applies pending state events before the matches on that date; the display must not reverse it');
  }
  // And the whole list is non-decreasing by date.
  j.entries.forEach((e, i) => {
    if (i === 0) return;
    assert.ok(e.date >= j.entries[i - 1].date, `dates went backwards at ${i}`);
  });
});

test('same-day matches keep the export\'s own sequence, not retrieval order', () => {
  const j = JV.forPlayer(replay().journey, 'Rishi');
  const ids = j.entries.filter((e) => e.kind === 'match').map((e) => e.matchId);
  const sorted = ids.slice().sort((a, b) => (a.slice(0, 10) < b.slice(0, 10) ? -1
    : a.slice(0, 10) > b.slice(0, 10) ? 1
    : Number(a.slice(11)) - Number(b.slice(11))));
  assert.deepStrictEqual(ids, sorted);
});

test('a tier change moves no rating and no reliability -- a promotion never looks earned', () => {
  const seen = [];
  playersWithJourneys().forEach((j) => {
    assert.ok(JV.tierEventsAreRatingNeutral(j), `${j.playerId} shows rating movement on a tier event`);
    j.entries.filter((e) => e.kind === 'tier' || e.kind === 'correction').forEach((e) => {
      seen.push(e);
      assert.strictEqual(e.delta, 0, `${j.playerId}: ${e.eventType} must show 0 pts`);
      assert.strictEqual(e.reliability, e.previousReliability,
        `${j.playerId}: ${e.eventType} must leave reliability untouched`);
    });
  });
  assert.ok(seen.length >= 3, 'the authoritative tier changes should be present to test against');
});

test('a match entry reports the engine\'s own delta for that player, not a team figure', () => {
  const r = replay();
  const byKey = {};
  r.journey.filter((e) => e.eventType === Engine.EVENT.MATCH_UPDATE)
    .forEach((e) => { byKey[`${e.matchId}|${e.playerId}`] = e; });
  playersWithJourneys().forEach((j) => {
    j.entries.filter((e) => e.kind === 'match').forEach((e) => {
      const src = byKey[`${e.matchId}|${j.playerId}`];
      assert.ok(src, `no source event for ${e.matchId}/${j.playerId}`);
      assert.strictEqual(e.delta, Math.round(src.ratingDelta * 10) / 10);
      assert.strictEqual(e.rating, src.postMatchRating);
      assert.strictEqual(e.expected, src.preMatchExpectedScore);
      assert.strictEqual(e.actual, src.actualScore);
    });
  });
});

test('the two players in one match can move by different amounts, and each sees their own', () => {
  const r = replay();
  const shaun = JV.forPlayer(r.journey, 'Shaun');
  const shared = shaun.entries.filter((e) => e.kind === 'match').find((e) => {
    const others = r.journey.filter((x) => x.matchId === e.matchId && x.playerId !== 'Shaun');
    return others.some((o) => Math.abs(Math.abs(o.ratingDelta) - Math.abs(e.delta)) > 0.05);
  });
  assert.ok(shared, 'K is per-player, so at least one match should move two players differently');
});

test('the journey never reaches April or May -- excluded data cannot enter it', () => {
  playersWithJourneys().forEach((j) => {
    j.entries.forEach((e) => {
      assert.ok(e.date >= '2026-06-01',
        `${j.playerId}: ${e.date} predates the rated period; April/May is display-only`);
    });
  });
});

test('the chart marks decisions and tier changes distinctly from results', () => {
  playersWithJourneys().forEach((j) => {
    JV.chartSeries(j).forEach((s) => {
      assert.strictEqual(s.isJump, s.kind === 'reassessment');
      assert.strictEqual(s.isAnnotation, s.kind === 'tier' || s.kind === 'correction');
      if (s.isAnnotation) assert.strictEqual(s.delta, 0, 'an annotation must carry no movement');
      if (s.isJump || s.isAnnotation) assert.notStrictEqual(s.kind, 'match');
    });
  });
});

test('a club reassessment is shaped as its own event, with reliability, not as match movement', () => {
  const r = replay();
  const base = r.journey.filter((e) => e.playerId === 'Shaun');
  const at = base.filter((e) => e.eventType === Engine.EVENT.MATCH_UPDATE).slice(-1)[0];
  const decision = {
    playerId: 'Shaun',
    eventType: Engine.EVENT.CLUB_RATING_REASSESSMENT,
    effectiveDate: '2026-09-30',
    previousPowerRating: at.postMatchRating,
    newPowerRating: at.postMatchRating + 25,
    previousReliability: at.newReliability,
    newReliability: at.newReliability,
    decisionType: 'ACCEPTED',
    notes: 'Club reassessment.',
  };
  const j = JV.forPlayer(base.concat([decision]), 'Shaun');
  const last = j.entries[j.entries.length - 1];
  assert.strictEqual(last.kind, 'reassessment');
  assert.strictEqual(last.delta, 25);
  assert.strictEqual(last.reliability, at.newReliability);
  assert.strictEqual(last.previousReliability, at.newReliability);
  assert.strictEqual(j.reassessmentCount, 1);
  assert.strictEqual(JV.chartSeries(j).slice(-1)[0].isJump, true);
  // It counts as a rating change without a ball being hit, so it must not be
  // folded into the match tally.
  assert.strictEqual(j.matchCount, base.filter((e) => e.eventType === Engine.EVENT.MATCH_UPDATE).length);
});

test('the UI no longer carries a reconstruction or its disclaimer', () => {
  // Every application script: the profile may live outside shell.js.
  const all = require('./helpers/appSource.js').readAllAppSource();
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter((l) => !l.trim().startsWith('//')).join('\n');

  assert.ok(!/computePlayerJourney/.test(code(all)),
    'the fabricated player journey must be gone, not merely unused');
  assert.ok(!/Story estimate/.test(all),
    'the "story estimate" disclaimer existed only because a second calculation did');
  assert.ok(/playerJourney\(name\)/.test(code(all).slice(code(all).indexOf('function renderPremiumProfile'))),
    'the premium profile must read the persisted journey');
  assert.ok(html.includes('assets/js/journeyView.js'), 'journeyView.js must be loaded by the page');
});

// Found by looking at a screenshot: the correction card said "Power Rating
// unchanged at 1400" about an event that had just moved the rating by +263.2,
// and the legend under a visible leap in the chart read "no rating movement".
// Both dated from when a correction could only change a tier.
test('a correction is drawn and described by what it did, not by what it is called', () => {
  const r = replay();
  const base = r.journey.filter((e) => e.playerId === 'Shaun');
  const init = base.find((e) => e.eventType === Engine.EVENT.PLAYER_INITIALISED);

  const tierOnly = {
    playerId: 'Shaun', eventType: Engine.EVENT.INITIAL_CLASSIFICATION_CORRECTION,
    effectiveDate: '2026-06-08', previousTier: 'C', newTier: 'B',
    previousPowerRating: init.newPowerRating, newPowerRating: init.newPowerRating,
    previousReliability: 0, newReliability: 0,
  };
  const movedRating = { ...tierOnly, newPowerRating: init.newPowerRating + 263.2 };

  const quiet = JV.forPlayer([init, tierOnly], 'Shaun');
  const loud = JV.forPlayer([init, movedRating], 'Shaun');
  assert.strictEqual(quiet.entries[1].delta, 0);
  assert.strictEqual(loud.entries[1].delta, 263.2);

  // Annotated only when it moved nothing; drawn as a jump when it moved.
  const quietMark = JV.chartSeries(quiet)[1];
  const loudMark = JV.chartSeries(loud)[1];
  assert.strictEqual(quietMark.isAnnotation, true);
  assert.strictEqual(quietMark.isJump, false);
  assert.strictEqual(loudMark.isAnnotation, false, 'a correction that moved the rating is not an annotation');
  assert.strictEqual(loudMark.isJump, true);

  // The tier-neutrality invariant still holds where it should: a PROMOTION is
  // never points, whatever a correction may do.
  assert.ok(JV.tierEventsAreRatingNeutral(loud));
  const promoted = JV.forPlayer([init, {
    playerId: 'Shaun', eventType: Engine.EVENT.PROMOTION, effectiveDate: '2026-06-08',
    previousTier: 'C', newTier: 'B',
    previousPowerRating: init.newPowerRating, newPowerRating: init.newPowerRating + 50,
    previousReliability: 0, newReliability: 0,
  }], 'Shaun');
  assert.strictEqual(JV.tierEventsAreRatingNeutral(promoted), false,
    'a promotion carrying points must still be caught');
});

// ---------------------------------------------------------------------------
// A superseded decision stays in the record -- that is what makes a correction
// auditable rather than a rewrite. It must never become the player's current
// explanation. Shaun reported seeing Tom and Fatch described as reassessed "to
// Jords' level" after the board had re-anchored them to the Tier B baseline;
// this is the guard that the old wording cannot reach a player's journey.

const supersededPair = () => ([
  { id: 'init', playerId: 'P', eventType: 'PLAYER_INITIALISED', effectiveDate: '2026-06-01',
    newPowerRating: 1100, newReliability: 0 },
  // What the board decided first, and later replaced.
  { id: 'v1', playerId: 'P', eventType: 'CLUB_RATING_REASSESSMENT', effectiveDate: '2026-07-01',
    previousPowerRating: 1100, newPowerRating: 1352.5,
    previousReliability: 0.28, newReliability: 0.10,
    notes: "Club override anchored to Jords' Power Rating immediately before this review (1352.5)." },
  // And what replaced it.
  { id: 'v2', playerId: 'P', eventType: 'CLUB_RATING_REASSESSMENT', effectiveDate: '2026-07-01',
    supersedes: 'v1', revision: 2,
    previousPowerRating: 1100, newPowerRating: 1400,
    previousReliability: 0.28, newReliability: 0.20,
    notes: 'Board correction: re-anchored to the standard Tier B baseline of 1400.' },
]);

test('a superseded decision never becomes the current explanation', () => {
  const j = JV.forPlayer(supersededPair(), 'P');
  assert.ok(j, 'the player must have a journey');

  const decisions = j.entries.filter((e) => e.eventType === 'CLUB_RATING_REASSESSMENT');
  assert.strictEqual(decisions.length, 1, 'only the decision in force is part of the story');
  assert.strictEqual(decisions[0].rating, 1400);
  assert.ok(Math.abs(decisions[0].reliability - 0.20) < 1e-9);

  // The replaced wording must not surface anywhere in what a player is shown.
  const everything = JSON.stringify(j);
  assert.doesNotMatch(everything, /Jords/,
    'the superseded comparator wording must not reach the journey');
  assert.doesNotMatch(everything, /1352\.5/,
    'nor the anchor it was replaced by');
  assert.match(decisions[0].notes, /Tier B baseline of 1400/);
});

test('the journey still joins up once a decision has been superseded', () => {
  const j = JV.forPlayer(supersededPair(), 'P');
  // Showing both would tell the player their rating moved twice and the chain
  // would visibly fail to meet.
  const ratings = j.entries.map((e) => e.rating).filter((r) => typeof r === 'number');
  assert.deepStrictEqual(ratings, [1100, 1400]);
});
