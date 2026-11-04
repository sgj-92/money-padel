// A club decision is the only thing in this system that changes a rating
// without a ball being hit. It is also the only write path, and there is no
// replay-forward, so a decision recorded against a date that already has
// history would leave the stored ratings no longer following from the stored
// events. These tests hold the refusals that prevent that.

const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../assets/js/ratingEngine.js');
const Store = require('../assets/js/ratingStore.js');
const CD = require('../assets/js/clubDecision.js');
const R = require('../assets/js/reassessment.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');

const TODAY = '2026-09-18';
const RECORDED = '2026-09-18T00:00:00Z';

let cached = null;
function fresh() {
  if (!cached) cached = buildBackfill();
  // A deep-enough copy that a test cannot leak state into the next one.
  const state = {};
  Object.entries(cached.replay.state).forEach(([k, v]) => { state[k] = { ...v }; });
  return { state, journey: cached.replay.journey.slice() };
}
function base(over) {
  return {
    playerId: 'Shaun',
    eventType: Engine.EVENT.CLUB_RATING_REASSESSMENT,
    effectiveDate: TODAY,
    newPowerRating: 1200,
    decisionType: 'OVERRIDE',
    createdBy: 'Board',
    ...over,
  };
}
function prep(decision, ctx) {
  const c = ctx || fresh();
  return CD.prepare({ state: c.state, journey: c.journey, decision, today: TODAY, recordedAt: RECORDED });
}
function problems(decision, ctx) {
  const c = ctx || fresh();
  return CD.validate({ state: c.state, journey: c.journey, decision, today: TODAY });
}

test('a decision cannot be backdated over history that already exists', () => {
  const p = problems(base({ effectiveDate: '2026-07-01' }));
  assert.ok(p.some((x) => /before Shaun's last recorded event/.test(x)), p.join(' | '));
  assert.throws(() => prep(base({ effectiveDate: '2026-07-01' })), /replaying them forward is not built yet/);
});

test('a decision cannot be dated into the future', () => {
  assert.ok(problems(base({ effectiveDate: '2026-12-01' })).some((x) => /in the future/.test(x)));
});

test('a tier change carries no rating and no reliability', () => {
  const tierMove = { playerId: 'Shaun', eventType: Engine.EVENT.PROMOTION, effectiveDate: TODAY,
    newTier: 'A', decisionType: 'ACCEPT', createdBy: 'Board' };
  assert.deepStrictEqual(problems(tierMove), []);
  const withRating = problems({ ...tierMove, newPowerRating: 1500 });
  assert.ok(withRating.some((x) => /tier change moves no Power Rating/.test(x)));
  const withRel = problems({ ...tierMove, newReliability: 0.9 });
  assert.ok(withRel.some((x) => /tier change moves no Reliability/.test(x)));

  // And the applied event really does move neither.
  const p = prep(tierMove);
  assert.strictEqual(p.before.rating, p.after.rating);
  assert.strictEqual(p.before.reliability, p.after.reliability);
  assert.strictEqual(p.event.previousPowerRating, p.event.newPowerRating);
  assert.strictEqual(p.event.previousReliability, p.event.newReliability);
  assert.match(p.summary, /Tier B → Tier A\.$/);
});

test('a rating reassessment does not move tier, and must move something', () => {
  assert.ok(problems(base({ newTier: 'A' })).some((x) => /does not change tier/.test(x)));
  assert.ok(problems(base({ newPowerRating: null })).some((x) => /must change the Power Rating/.test(x)));
});

test('reliability is bounded below 1, because it never reaches it', () => {
  assert.ok(problems(base({ newPowerRating: null, newReliability: 1 })).some((x) => /below 1/.test(x)));
  assert.ok(problems(base({ newPowerRating: null, newReliability: -0.1 })).some((x) => /at least 0/.test(x)));
  assert.deepStrictEqual(problems(base({ newPowerRating: null, newReliability: 0.8 })), []);
});

test('every decision records who made it and what it did to the recommendation', () => {
  assert.ok(problems(base({ createdBy: null })).some((x) => /who made it/.test(x)));
  assert.ok(problems(base({ decisionType: null })).some((x) => /accepted, overrode or declined/.test(x)));
});

test('the same decision cannot be recorded twice on the same day', () => {
  const ctx = fresh();
  const p = prep(base(), ctx);
  // Simulate it having been written.
  ctx.journey.push(p.event);
  assert.ok(problems(base(), ctx).some((x) => /already recorded/.test(x)));
  // A later date is fine.
  assert.deepStrictEqual(problems(base({ effectiveDate: '2026-09-19' }), ctx).filter((x) => /already recorded/.test(x)), []);
});

test('preparing a decision does not touch live state — only committing does', () => {
  const ctx = fresh();
  const wasRating = ctx.state.Shaun.rating;
  const wasTier = ctx.state.Shaun.tier;
  prep(base({ newPowerRating: 1600 }), ctx);
  prep({ playerId: 'Shaun', eventType: Engine.EVENT.PROMOTION, effectiveDate: TODAY, newTier: 'A',
    decisionType: 'ACCEPT', createdBy: 'Board' }, ctx);
  assert.strictEqual(ctx.state.Shaun.rating, wasRating);
  assert.strictEqual(ctx.state.Shaun.tier, wasTier);
});

test('a recommendation is recorded alongside the decision, including when overridden', () => {
  const ctx = fresh();
  const rec = R.getRecommendation({
    state: ctx.state, tierOf: (n) => ctx.state[n].tier, subject: 'Shaun',
    fromTier: 'B', toTier: 'A', eventType: 'PROMOTION',
  });
  assert.ok(rec.recommended);
  const p = prep(base({ newPowerRating: rec.recommendationRating + 100, recommendation: rec }), ctx);
  assert.strictEqual(p.journeyDoc.recommendationRating, rec.recommendationRating);
  assert.strictEqual(p.journeyDoc.recommendationMethodVersion, R.RECOMMENDATION_METHOD_VERSION);
  assert.strictEqual(p.journeyDoc.decisionType, 'OVERRIDE');
  // The override is what was applied, not the recommendation.
  assert.strictEqual(p.playerDoc.rating, rec.recommendationRating + 100);
});

test('the written documents carry full provenance and are Firestore-safe', () => {
  const p = prep(base({ notes: 'Board review, Sept.' }));
  assert.strictEqual(p.journeyDoc.createdBy, 'Board');
  assert.strictEqual(p.journeyDoc.recordedAt, RECORDED);
  assert.strictEqual(p.journeyDoc.source, 'Admin Monthly Review');
  assert.strictEqual(p.journeyDoc.notes, 'Board review, Sept.');
  assert.strictEqual(p.journeyDoc.schemaVersion, Store.SCHEMA_VERSION);
  assert.doesNotThrow(() => Store.assertFirestoreSafe(p.journeyDoc, Store.COLLECTIONS.journey));
  assert.doesNotThrow(() => Store.assertFirestoreSafe(p.playerDoc, Store.COLLECTIONS.players));
});

test('committing writes the journey event first, so history survives a failed state write', async () => {
  const p = prep(base());
  const order = [];
  const failing = {
    async set(collection, id) {
      order.push(collection);
      if (collection === Store.COLLECTIONS.players) throw new Error('network');
    },
  };
  await assert.rejects(() => CD.commit(failing, p), (e) => {
    assert.strictEqual(e.journeyWritten, true);
    assert.match(e.message, /history is intact/);
    assert.match(e.message, /Do not record the decision again/);
    return true;
  });
  assert.deepStrictEqual(order, [Store.COLLECTIONS.journey, Store.COLLECTIONS.players]);
});

test('a committed decision replays back to exactly the state that was written', async () => {
  const ctx = fresh();
  const p = prep(base({ newPowerRating: 1250 }), ctx);
  const backend = Store.memoryBackend();
  await CD.commit(backend, p);

  const journeyDocs = await backend.getAll(Store.COLLECTIONS.journey);
  assert.strictEqual(journeyDocs.length, 1);
  // Replaying the event onto the pre-decision state must reproduce the player
  // document stored beside it. If these disagree, the stored rating has stopped
  // following from the stored history.
  const replayState = { Shaun: { ...cached.replay.state.Shaun } };
  Engine.applyStateEvent(replayState, journeyDocs[0]);
  const rebuilt = Store.toPlayerDoc('Shaun', replayState.Shaun);

  assert.strictEqual(rebuilt.rating, p.playerDoc.rating);
  assert.strictEqual(rebuilt.tier, p.playerDoc.tier);
  assert.strictEqual(rebuilt.classificationStatus, p.playerDoc.classificationStatus);
  assert.strictEqual(rebuilt.lifetimeMatches, p.playerDoc.lifetimeMatches);
  assert.strictEqual(rebuilt.reliability, p.playerDoc.reliability);
  // Evidence is compared with a tolerance, deliberately -- see the next test.
  assert.ok(Math.abs(rebuilt.effectiveEvidence - p.playerDoc.effectiveEvidence) < 1e-9,
    `${rebuilt.effectiveEvidence} vs ${p.playerDoc.effectiveEvidence}`);
});

// Discovered while building the write path. Recorded as a test so that
// replay-forward, which will replay these documents for real, meets it
// deliberately instead of being surprised by it. See PROJECT_LEDGER.md.
// Was a KNOWN limitation; fixed with Shaun's approval on 18 Sep 2026.
// `applyStateEvent` preferred the derived reliability over the exact evidence
// recorded beside it, so replaying a stored event sent the number back through
// reliability = e / (e + 10) inverted and lost a bit. Evidence of 21 replayed
// as 20.999999999999996, which meant a replayed record was never quite the
// record. Replay-forward routed around it; the engine now simply prefers the
// lossless representation.
test('the exact evidence wins over the derived reliability, so a replay is exact', () => {
  const state = () => ({ X: { rating: 1400, effectiveEvidence: 21, lifetimeMatches: 21, tier: 'B', classificationStatus: 'ESTABLISHED' } });
  const event = {
    playerId: 'X', eventType: Engine.EVENT.CLUB_RATING_REASSESSMENT, effectiveDate: '2026-09-18',
    newReliability: Engine.reliability(21),
  };

  // Reliability alone still works, and is still lossy -- that is arithmetic,
  // not a defect, and is why the exact value is preferred when present.
  const derived = state();
  Engine.applyStateEvent(derived, { ...event });
  assert.notStrictEqual(derived.X.effectiveEvidence, 21);
  assert.ok(Math.abs(derived.X.effectiveEvidence - 21) < 1e-9);

  // With both, the exact one wins and the replay is exact.
  const exact = state();
  Engine.applyStateEvent(exact, { ...event, newEffectiveEvidence: 21 });
  assert.strictEqual(exact.X.effectiveEvidence, 21);

  // No mathematics changed: the two representations still describe the same
  // number, and K is identical either way.
  assert.strictEqual(Engine.kFactor(Engine.reliability(derived.X.effectiveEvidence)),
    Engine.kFactor(Engine.reliability(exact.X.effectiveEvidence)));
});

// Replay-forward passes the exact evidence for any event that changed it, so a
// record containing a reliability change still reproduces itself exactly.
test('a reliability change survives a replay without drifting', () => {
  const RF = require('../assets/js/replayForward.js');
  const ctx = fresh();
  const decision = base({ newPowerRating: null, newReliability: 0.10 });
  const p = CD.prepare({ state: ctx.state, journey: ctx.journey, decision, today: TODAY, recordedAt: RECORDED });
  const stored = { journey: ctx.journey.concat([{ ...p.event, id: p.journeyDoc.id }]) };
  const input = RF.inputsFromRecord(stored).events.find((e) => e.effectiveDate === TODAY && e.playerId === 'Shaun');
  assert.ok(input, 'the decision should be replayed');
  assert.strictEqual(input.newEffectiveEvidence, p.event.effectiveEvidenceAfter);
  assert.strictEqual(input.newReliability, 0.10);
});

test('a decision is undone by recording its reversal, never by deleting it', async () => {
  const ctx = fresh();
  const before = ctx.state.Shaun.rating;
  const p = prep(base({ newPowerRating: 1250 }), ctx);

  // Apply it for real, as the app would after a successful commit.
  Engine.applyStateEvent(ctx.state, p.event);
  ctx.journey.push(p.event);
  assert.strictEqual(ctx.state.Shaun.rating, 1250);

  const reversal = CD.reversalOf(p, { effectiveDate: '2026-09-19', createdBy: 'Board' });
  assert.strictEqual(reversal.decisionType, 'REVERSAL');
  assert.strictEqual(reversal.newPowerRating, before);
  const p2 = CD.prepare({ state: ctx.state, journey: ctx.journey, decision: reversal,
    today: '2026-09-19', recordedAt: RECORDED });
  assert.ok(Math.abs(p2.after.rating - before) < 1e-9, 'a reversal restores the previous rating');
  // Both remain in the ledger.
  assert.notStrictEqual(p2.journeyDoc.id, p.journeyDoc.id);
});

test('a tier decision is reversed as the opposite tier move, carrying no points', () => {
  const ctx = fresh();
  const p = prep({ playerId: 'Shaun', eventType: Engine.EVENT.PROMOTION, effectiveDate: TODAY,
    newTier: 'A', decisionType: 'ACCEPT', createdBy: 'Board' }, ctx);
  const reversal = CD.reversalOf(p, { effectiveDate: '2026-09-19', createdBy: 'Board' });
  assert.strictEqual(reversal.eventType, Engine.EVENT.DEMOTION);
  assert.strictEqual(reversal.newTier, 'B');
  assert.strictEqual(reversal.newPowerRating, null);
  assert.strictEqual(reversal.newReliability, null);
});

test('an unknown player, or a non-decision event type, is refused', () => {
  assert.ok(problems(base({ playerId: 'Nobody At All' })).some((x) => /no rating record/.test(x)));
  assert.ok(problems(base({ eventType: Engine.EVENT.MATCH_UPDATE })).some((x) => /is not a club decision/.test(x)));
});

// Before the write path existed no reassessment could occur, so the monthly
// views had nothing to distinguish. Now they do: a rating that moved by
// decision must not be presented as a month's form.
test('monthly rating movement separates club decisions from play', () => {
  const MV = require('../assets/js/monthlyViews.js');
  const TH = require('../assets/js/tierHistory.js');
  const D = require('./helpers/dataset.js');
  const ctx = fresh();
  const p = prep(base({ newPowerRating: ctx.state.Shaun.rating + 40 }), ctx);

  const history = TH.create({ currentTiers: D.loadBaseTiers() });
  const withDecision = ctx.journey.concat([p.event]);
  const v = MV.build(withDecision, { tierAsOf: history.tierAsOf });
  const row = MV.playerMonth(v, '2026-09', 'Shaun');

  assert.ok(Math.abs(row.reassessmentChange - 40) < 0.05,
    `expected 40 pts of the month's movement to be by decision, got ${row.reassessmentChange}`);
  // It is part of the month's movement, not separate from it -- the point is
  // that the two can be told apart, not that the decision is hidden.
  assert.ok(row.ratingChange !== 0);

  // And with no decision recorded, every row reports zero rather than nothing.
  const plain = MV.build(ctx.journey, { tierAsOf: history.tierAsOf });
  plain.months.forEach((m) => {
    plain.byMonth[m].rows.concat(plain.byMonth[m].inactiveRows).forEach((r) => {
      assert.strictEqual(r.reassessmentChange, 0, `${r.playerId} ${m}`);
    });
  });
});
