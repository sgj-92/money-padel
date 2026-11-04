// A tier change and its rating consequence are one board decision.
//
// The rule these tests hold is that the board may not walk away from a tier
// change without saying what happens to the rating. Silence was the problem: a
// promotion recorded with no rating decision looks complete, and months later
// somebody wants to backdate the reassessment to the review that never
// finished. "Keep the current rating" is an answer, and it is recorded.
//
// The second rule is fairness between players reviewed together: a
// recommendation comes from where everyone stood BEFORE the review began.

const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../assets/js/ratingEngine.js');
const TH = require('../assets/js/tierHistory.js');
const MR = require('../assets/js/monthlyReview.js');
const CD = require('../assets/js/clubDecision.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');

const TODAY = '2026-09-18';
let cached = null;
function backfill() { if (!cached) cached = buildBackfill(); return cached; }
function snapshot(date) { return MR.preReviewSnapshot(backfill().replay.journey, date || TODAY); }
function draft(over) {
  return {
    playerId: 'Fatch', effectiveDate: TODAY, tierEvent: 'PROMOTION', newTier: 'A',
    ratingDecision: null, createdBy: 'Board', ...over,
  };
}

test('a tier change cannot be recorded without a rating decision', () => {
  const snap = snapshot();
  const reasons = MR.incompleteReasons(draft(), snap);
  assert.ok(reasons.some((r) => /not recorded until the board says what happens to the rating/.test(r)));
  assert.throws(() => MR.decisionsFor(draft(), snap), /This review is not finished/);
});

test('accepting the recommendation records the tier move first, then the rating', () => {
  const snap = snapshot();
  const rec = MR.recommendationFor(snap, { playerId: 'Fatch', fromTier: 'B', toTier: 'A', eventType: 'PROMOTION' });
  assert.ok(rec.recommended);
  const ds = MR.decisionsFor(draft({ ratingDecision: MR.DECISION.ACCEPT_RECOMMENDATION, recommendation: rec }), snap);
  assert.deepStrictEqual(ds.map((d) => d.eventType),
    [Engine.EVENT.PROMOTION, Engine.EVENT.CLUB_RATING_REASSESSMENT]);
  assert.strictEqual(ds[0].newPowerRating, undefined, 'the tier move carries no rating');
  assert.strictEqual(ds[1].newPowerRating, rec.recommendationRating);
  assert.strictEqual(ds[1].newTier, undefined, 'the rating decision carries no tier');
});

test('keeping the current rating is recorded, not omitted', () => {
  const snap = snapshot();
  const ds = MR.decisionsFor(draft({ ratingDecision: MR.DECISION.KEEP_CURRENT_RATING }), snap);
  assert.strictEqual(ds.length, 2);
  const rating = ds[1];
  assert.strictEqual(rating.newPowerRating, null);
  assert.strictEqual(rating.decisionType, MR.DECISION.KEEP_CURRENT_RATING);
  assert.strictEqual(rating.allowNoChange, true);
  // ClubDecision normally refuses a reassessment that changes nothing. This is
  // the one case where recording no movement is the point.
  const r = backfill().replay;
  assert.doesNotThrow(() => CD.prepare({
    state: r.state, journey: r.journey, decision: rating, today: TODAY, recordedAt: TODAY + 'T00:00:00Z',
  }));
  assert.throws(() => CD.prepare({
    state: r.state, journey: r.journey, decision: { ...rating, allowNoChange: false },
    today: TODAY, recordedAt: TODAY + 'T00:00:00Z',
  }), /must change the Power Rating/);
});

test('correcting an initial classification is one event, not a promotion plus a reassessment', () => {
  const snap = snapshot('2026-07-01');
  assert.strictEqual(snap.Shaun.classificationStatus, 'PROVISIONAL');
  const ds = MR.decisionsFor({
    playerId: 'Shaun', effectiveDate: '2026-07-01', tierEvent: 'PROMOTION', newTier: 'B',
    ratingDecision: MR.DECISION.CORRECT_INITIAL_CLASSIFICATION, correctedRating: 1400, createdBy: 'Board',
  }, snap);
  assert.strictEqual(ds.length, 1);
  assert.strictEqual(ds[0].eventType, Engine.EVENT.INITIAL_CLASSIFICATION_CORRECTION);
  assert.strictEqual(ds[0].newTier, 'B');
  assert.strictEqual(ds[0].newPowerRating, 1400);
});

test('an established player has no initial estimate left to correct', () => {
  const snap = snapshot('2026-07-01');
  assert.strictEqual(snap.Tom.classificationStatus, 'ESTABLISHED');
  const reasons = MR.incompleteReasons({
    playerId: 'Tom', effectiveDate: '2026-07-01', tierEvent: 'PROMOTION', newTier: 'B',
    ratingDecision: MR.DECISION.CORRECT_INITIAL_CLASSIFICATION, correctedRating: 1400, createdBy: 'Board',
  }, snap);
  assert.ok(reasons.some((r) => /already established/.test(r)), reasons.join(' | '));
});

test('an override needs a number, and accepting needs something to accept', () => {
  const snap = snapshot();
  assert.ok(MR.incompleteReasons(draft({ ratingDecision: MR.DECISION.CLUB_OVERRIDE }), snap)
    .some((r) => /needs a rating, a Reliability, or both/.test(r)));
  assert.ok(MR.incompleteReasons(draft({ ratingDecision: MR.DECISION.ACCEPT_RECOMMENDATION, recommendation: null }), snap)
    .some((r) => /no recommendation to accept/.test(r)));
});

// The reason the shared snapshot rule exists, demonstrated rather than asserted.
test('processing order cannot change what another player is offered', () => {
  const snap = snapshot();
  const ask = (state, playerId) => MR.recommendationFor(state, { playerId, fromTier: 'C', toTier: 'B', eventType: 'PROMOTION' });
  const jams = ask(snap, 'Jams');
  const aubyn = ask(snap, 'Aubyn');
  assert.ok(jams.recommended && aubyn.recommended);

  // What would happen if the second recommendation were drawn from a state that
  // already contained the first player's accepted decision.
  const mutated = { ...snap, Jams: { ...snap.Jams, rating: jams.recommendationRating, tier: 'B' } };
  const aubynAfter = ask(mutated, 'Aubyn');
  assert.notStrictEqual(aubynAfter.recommendationRating, aubyn.recommendationRating);
  assert.strictEqual(aubynAfter.recommended, false,
    'moving Jams out of Tier C empties the pool below the minimum, so Aubyn would be offered nothing at all');

  // And the snapshot itself is a function of the date, not of who ran it.
  assert.deepStrictEqual(snapshot(), snap);
});

test('the snapshot is the state before the date, not the state now', () => {
  const july = snapshot('2026-07-01');
  const now = snapshot();
  assert.strictEqual(july.Shaun.tier, 'C', 'Shaun was Tier C before 1 July');
  assert.strictEqual(now.Shaun.tier, 'B');
  assert.ok(july.Shaun.asOfDate < '2026-07-01');
  assert.ok(Object.keys(july).length < Object.keys(now).length, 'fewer players had played by July');
});

// Recording a real promotion used to break the next page load: tier history was
// validated against a frozen three-entry list that a new promotion contradicts.
test('tier history comes from the record, so a new promotion simply appears', () => {
  const r = backfill().replay;
  const derived = TH.changesFromJourney(r.journey);
  assert.deepStrictEqual(
    derived.map((c) => [c.playerId, c.effectiveDate, c.fromTier, c.toTier]),
    TH.AUTHORITATIVE_TIER_CHANGES.map((c) => [c.playerId, c.effectiveDate, c.fromTier, c.toTier]),
    'the record must already agree with the seed list');

  // Add a promotion, as the review would.
  const promoted = r.journey.concat([{
    playerId: 'Fatch', eventType: Engine.EVENT.PROMOTION, effectiveDate: TODAY,
    previousTier: 'B', newTier: 'A',
  }]);
  const after = TH.changesFromJourney(promoted);
  assert.strictEqual(after.length, derived.length + 1);
  const currentTiers = {};
  Object.entries(r.state).forEach(([n, s]) => { currentTiers[n] = s.tier; });
  currentTiers.Fatch = 'A';
  // With the frozen list this throws; with the record it does not.
  assert.throws(() => TH.create({ currentTiers }), /Tier history for Fatch ends at B/);
  const history = TH.create({ currentTiers, changes: after });
  assert.strictEqual(history.tierAsOf('Fatch', '2026-07-15'), 'C');
  assert.strictEqual(history.tierAsOf('Fatch', '2026-08-15'), 'B');
  assert.strictEqual(history.tierAsOf('Fatch', TODAY), 'A');
});

// ---------------------------------------------------------------------------
// Step 3: Reliability. Shaun's rule, 20 Sep — the board should not have to
// invent a percentage, so the system recommends one from how far the rating
// actually moves, and the board takes it or departs from it deliberately.

const asked = (over) => draft({ requireReliabilityAnswer: true, ...over });
const relOf = (snap, id) => Engine.reliability(snap[id].effectiveEvidence);

test('the recommendation is priced against the anchor the board chose, not the one suggested', () => {
  const snap = snapshot();
  const current = snap.Fatch.rating;

  const small = MR.reliabilityRecommendationFor(
    asked({ ratingDecision: MR.DECISION.CLUB_OVERRIDE, overrideRating: current + 30 }), snap);
  const large = MR.reliabilityRecommendationFor(
    asked({ ratingDecision: MR.DECISION.CLUB_OVERRIDE, overrideRating: current + 200 }), snap);

  assert.ok(small.reliability > large.reliability, 'a bigger re-anchor keeps less');
  assert.ok(Math.abs(large.reliability - 0.20) < 1e-9, 'past the full distance it reaches the floor');
  assert.ok(small.reliability < relOf(snap, 'Fatch'), 'and it never rises');
  assert.strictEqual(small.ratingMove, 30);
  assert.strictEqual(large.ratingMove, 200);
});

test('nothing is recommended until the rating question is answered', () => {
  const snap = snapshot();
  assert.strictEqual(MR.reliabilityRecommendationFor(asked(), snap), null);
  // And once it is, a rating the board chose NOT to move is a move of zero --
  // which recommends leaving Reliability alone, and is how a confidence-only
  // change is still reachable.
  const keep = MR.reliabilityRecommendationFor(asked({ ratingDecision: MR.DECISION.KEEP_CURRENT_RATING }), snap);
  assert.ok(keep);
  assert.strictEqual(keep.ratingMove, 0);
  assert.ok(Math.abs(keep.reliability - relOf(snap, 'Fatch')) < 1e-9);
});

test('a rating that moves must be answered for; one that does not need not be', () => {
  const snap = snapshot();
  const current = snap.Fatch.rating;
  const moving = MR.incompleteReasons(
    asked({ ratingDecision: MR.DECISION.CLUB_OVERRIDE, overrideRating: current + 120 }), snap);
  assert.ok(moving.some((r) => /must say what happens to Reliability/.test(r)));

  const still = MR.incompleteReasons(asked({ ratingDecision: MR.DECISION.KEEP_CURRENT_RATING }), snap);
  assert.ok(!still.some((r) => /must say what happens to Reliability/.test(r)));
});

// Historical Club Adjustment has no Reliability step and carries its own field.
// Demanding an answer to a question that screen never asks would make it
// unusable, which is exactly what happened when this was not scoped.
test('the demand applies only where the question is actually asked', () => {
  const snap = snapshot();
  const current = snap.Fatch.rating;
  const over = { ratingDecision: MR.DECISION.CLUB_OVERRIDE, overrideRating: current + 120 };
  assert.ok(MR.incompleteReasons(draft({ ...over, requireReliabilityAnswer: true }), snap)
    .some((r) => /must say what happens to Reliability/.test(r)));
  assert.ok(!MR.incompleteReasons(draft(over), snap)
    .some((r) => /must say what happens to Reliability/.test(r)));
});

test('using the recommendation writes the recommended number', () => {
  const snap = snapshot();
  const review = asked({
    ratingDecision: MR.DECISION.CLUB_OVERRIDE,
    overrideRating: snap.Fatch.rating + 60,
    reliabilityChoice: MR.RELIABILITY_CHOICE.USE_RECOMMENDATION,
  });
  const rec = MR.reliabilityRecommendationFor(review, snap);
  assert.strictEqual(MR.chosenReliability(review, snap), rec.reliability);

  const [, rating] = MR.decisionsFor(review, snap);
  assert.strictEqual(rating.newReliability, rec.reliability);
  assert.strictEqual(rating.recommendation.recommendationReliability, rec.reliability);
  assert.strictEqual(rating.recommendation.reliabilityRule, 'move-scaled-v1');
});

test('an override needs a percentage and a reason, and both are recorded', () => {
  const snap = snapshot();
  const base = {
    ratingDecision: MR.DECISION.CLUB_OVERRIDE,
    overrideRating: snap.Fatch.rating + 60,
    reliabilityChoice: MR.RELIABILITY_CHOICE.OVERRIDE,
  };

  const noNumber = MR.incompleteReasons(asked({ ...base, notes: 'because' }), snap);
  assert.ok(noNumber.some((r) => /Overriding Reliability needs a percentage/.test(r)));

  const noReason = MR.incompleteReasons(asked({ ...base, overrideReliability: 0.4 }), snap);
  assert.ok(noReason.some((r) => /needs a reason/.test(r)),
    'a percentage with no reason is indistinguishable from a slip of the finger');

  const outOfRange = MR.incompleteReasons(asked({ ...base, overrideReliability: 1, notes: 'x' }), snap);
  assert.ok(outOfRange.some((r) => /below 100%/.test(r)));

  const good = asked({ ...base, overrideReliability: 0.4, notes: 'Board: more settled than the move implies.' });
  assert.deepStrictEqual(MR.incompleteReasons(good, snap), []);

  // Both numbers reach the record: what the board chose, and what it departed from.
  const [, rating] = MR.decisionsFor(good, snap);
  assert.strictEqual(rating.newReliability, 0.4);
  const rec = MR.reliabilityRecommendationFor(good, snap);
  assert.strictEqual(rating.recommendation.recommendationReliability, rec.reliability);
  assert.notStrictEqual(rating.newReliability, rating.recommendation.recommendationReliability);
  assert.strictEqual(rating.notes, 'Board: more settled than the move implies.');
});

// A club override that would change nothing is not a decision, it is a slip.
test('an override that changes nothing is refused', () => {
  const snap = snapshot();
  const reasons = MR.incompleteReasons(asked({
    ratingDecision: MR.DECISION.CLUB_OVERRIDE,
    reliabilityChoice: MR.RELIABILITY_CHOICE.USE_RECOMMENDATION,
  }), snap);
  assert.ok(reasons.some((r) => /would change nothing/.test(r)));
});
