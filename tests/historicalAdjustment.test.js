// The Admin escape hatch for a club decision at a date that has already passed.
//
// The rules it must not bend, and why each is here:
//   * An absent statistical recommendation is not a decision. Turning it into
//     "keep the current rating" would put words in the board's mouth.
//   * Nothing earlier is deleted or edited. A correction supersedes; both stay.
//   * A reason and a name are required.
//   * The record must replay to itself before a change is planned on it.

const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../assets/js/ratingEngine.js');
const Store = require('../assets/js/ratingStore.js');
const RF = require('../assets/js/replayForward.js');
const HA = require('../assets/js/historicalAdjustment.js');
const BD = require('../assets/js/betaDiagnostics.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');

let cached = null;
function record() {
  if (!cached) {
    const b = buildBackfill();
    cached = {
      plan: Store.buildWritePlan({
        matches: b.matches, journey: b.replay.journey, state: b.replay.state, provenance: b.provenance,
      }),
      provenance: b.provenance,
    };
  }
  return {
    stored: {
      matches: cached.plan[Store.COLLECTIONS.matches].map((d) => ({ ...d })),
      journey: cached.plan[Store.COLLECTIONS.journey].map((d) => ({ ...d })),
      players: cached.plan[Store.COLLECTIONS.players].map((d) => ({ ...d })),
    },
    provenance: cached.provenance,
  };
}
const SHAUN_CORRECTION = {
  playerId: 'Shaun', effectiveDate: '2026-07-01', tierEvent: 'PROMOTION', newTier: 'B',
  ratingDecision: 'CORRECT_INITIAL_CLASSIFICATION', correctedRating: 1400,
  reason: 'Board: entered C as an unknown; the initial estimate was wrong.', createdBy: 'Shaun',
};

test('the state shown is the state before the date, with what is already recorded there', () => {
  const { stored } = record();
  const ctx = HA.context({ journey: stored.journey, playerId: 'Shaun', effectiveDate: '2026-07-01', toTier: 'B' });
  assert.strictEqual(ctx.before.tier, 'C');
  assert.strictEqual(ctx.before.classificationStatus, 'PROVISIONAL');
  assert.ok(ctx.before.asOfDate < '2026-07-01');
  assert.deepStrictEqual(ctx.existing.map((e) => e.eventType), [Engine.EVENT.INITIAL_CLASSIFICATION_CORRECTION]);
  assert.strictEqual(ctx.existing[0].superseded, false);
});

test('an absent recommendation is reported as an absence, never as keep-current', () => {
  const { stored, provenance } = record();
  const ctx = HA.context({ journey: stored.journey, playerId: 'Tom', effectiveDate: '2026-07-01', toTier: 'B' });
  assert.strictEqual(ctx.recommendationAbsent, true);
  assert.match(ctx.recommendationAbsentReason, /Not enough established players/);

  // Accepting a recommendation that does not exist is refused, with the reason.
  assert.throws(() => HA.plan({
    stored, provenance,
    adjustment: {
      playerId: 'Tom', effectiveDate: '2026-07-01', tierEvent: 'PROMOTION', newTier: 'B',
      ratingDecision: 'ACCEPT_RECOMMENDATION', reason: 'late entry', createdBy: 'Board',
    },
  }), (e) => {
    assert.ok(e.problems.some((p) => /an absent recommendation is not itself a decision/.test(p)));
    return true;
  });

  // Nothing in the module maps absence to a decision on the board's behalf.
  const keep = HA.eventsFor({
    playerId: 'Tom', effectiveDate: '2026-07-01', tierEvent: 'PROMOTION', newTier: 'B',
    ratingDecision: 'KEEP_CURRENT_RATING', reason: 'board chose to keep', createdBy: 'Board',
  }, ctx);
  assert.strictEqual(keep[1].decisionType, 'KEEP_CURRENT_RATING', 'only because the board said so');
});

test('a reason and a name are required', () => {
  const { stored } = record();
  const ctx = HA.context({ journey: stored.journey, playerId: 'Shaun', effectiveDate: '2026-07-01', toTier: 'B' });
  assert.ok(HA.incompleteReasons({ ...SHAUN_CORRECTION, reason: '' }, ctx)
    .some((r) => /needs a reason/.test(r)));
  assert.ok(HA.incompleteReasons({ ...SHAUN_CORRECTION, createdBy: null }, ctx)
    .some((r) => /must record who made it/.test(r)));
});

test('a correction supersedes the earlier decision and deletes nothing', () => {
  const { stored, provenance } = record();
  const p = HA.plan({ stored, adjustment: SHAUN_CORRECTION, provenance });

  assert.strictEqual(p.events.length, 1, 'a correction is one event, not a promotion plus a reassessment');
  assert.strictEqual(p.events[0].supersedes, '2026-07-01__Shaun__INITIAL_CLASSIFICATION_CORRECTION');
  assert.strictEqual(p.events[0].revision, 2);
  assert.strictEqual(p.documentsToDelete, 0, 'nothing may be deleted by a correction');

  // The superseding document sits beside the original, not on top of it.
  const written = p.writes[Store.COLLECTIONS.journey].map((d) => d.id);
  assert.ok(written.includes('2026-07-01__Shaun__INITIAL_CLASSIFICATION_CORRECTION__r2'));
  assert.ok(!Object.values(p.deletes).flat().includes('2026-07-01__Shaun__INITIAL_CLASSIFICATION_CORRECTION'));
});

test('the correction re-derives everything after it, and the result is sound', async () => {
  const { stored, provenance } = record();
  const backend = Store.memoryBackend();
  for (const [c, docs] of Object.entries({
    [Store.COLLECTIONS.matches]: stored.matches,
    [Store.COLLECTIONS.journey]: stored.journey,
    [Store.COLLECTIONS.players]: stored.players,
  })) { for (const d of docs) await backend.set(c, d.id, d); }

  const p = HA.plan({ stored, adjustment: SHAUN_CORRECTION, provenance });
  assert.ok(p.playersMoved.length > 20, 'a July correction reaches most of the club');
  const shaun = p.playersMoved.find((m) => m.playerId === 'Shaun');
  assert.ok(shaun.delta > 180 && shaun.delta < 220, `Shaun moved ${shaun.delta}`);

  await RF.commit(backend, p);
  const after = {
    matches: await backend.getAll(Store.COLLECTIONS.matches),
    journey: await backend.getAll(Store.COLLECTIONS.journey),
    players: await backend.getAll(Store.COLLECTIONS.players),
  };
  // Both decisions are in the record.
  const ids = after.journey.map((d) => d.id);
  assert.ok(ids.includes('2026-07-01__Shaun__INITIAL_CLASSIFICATION_CORRECTION'));
  assert.ok(ids.includes('2026-07-01__Shaun__INITIAL_CLASSIFICATION_CORRECTION__r2'));

  // Diagnostics pass, and the new record still replays to itself -- so a
  // further correction can be planned on top of this one.
  const players = {};
  after.players.forEach((d) => { players[d.id] = d; });
  const report = BD.run({ players, matches: after.matches, journey: after.journey });
  assert.ok(report.healthy, report.checks.filter((c) => c.status === 'fail').map((c) => c.name).join(', '));
  assert.strictEqual(RF.verifyNoOp(after, provenance).count, 0);

  // And only the superseding decision is honoured.
  const inputs = RF.inputsFromRecord(after);
  const shaunEvents = inputs.events.filter((e) => e.playerId === 'Shaun' && e.effectiveDate === '2026-07-01');
  assert.strictEqual(shaunEvents.length, 1);
  assert.strictEqual(shaunEvents[0].newPowerRating, 1400);
});

test('a change cannot be planned on a record that does not replay to itself', () => {
  const { stored, provenance } = record();
  stored.players.find((p) => p.id === 'Tom').rating += 9;
  assert.throws(() => HA.plan({ stored, adjustment: SHAUN_CORRECTION, provenance }),
    /stored ratings and the stored history have diverged/);
});

test('historical club adjustment is separate from historical match correction', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'historicalAdjustment.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter((l) => !l.trim().startsWith('//')).join('\n');
  // It plans club decisions only. It must not be able to touch match data --
  // one repairs a result, the other records a judgement, and merging them would
  // let a rating be changed under cover of fixing a score.
  ['append', 'delete', 'matchId', 'sets'].forEach((w) => {
    assert.ok(!new RegExp(`['"\`]${w}['"\`]`).test(code), `must not deal in match data: ${w}`);
  });
  assert.ok(/type: 'clubDecision'/.test(code));
});

// These decisions go STRAIGHT to the engine as replay inputs — this path does
// not go through ClubDecision.prepare, which is where the monthly review
// flattens the recommendation onto the event. The engine reads scalars, so a
// `recommendation` object was silently dropped and every historical adjustment
// stored a null recommendation. The audit trail could not answer the one
// question it exists for: did the board follow the system, or depart from it?
test('a historical adjustment records what the system recommended, not just what the board chose', () => {
  const { stored, provenance } = record();
  const Review = require('../assets/js/monthlyReview.js');

  const adjustment = {
    playerId: 'Tom', effectiveDate: '2026-07-01', tierEvent: 'PROMOTION', newTier: 'B',
    ratingDecision: Review.DECISION.CLUB_OVERRIDE,
    overrideRating: 1400, overrideReliability: 0.10,
    reason: 'Board: re-anchored to the standard Tier B baseline.', createdBy: 'Board',
  };
  const p = HA.plan({ stored, adjustment, provenance });

  const doc = p.writes[Store.COLLECTIONS.journey]
    .find((d) => d.playerId === 'Tom' && d.effectiveDate === '2026-07-01'
      && d.eventType === 'CLUB_RATING_REASSESSMENT');
  assert.ok(doc, 'the reassessment must be written');

  // What the board chose.
  assert.ok(Math.abs(doc.newReliability - 0.10) < 1e-9);
  assert.ok(Math.abs(doc.newPowerRating - 1400) < 1e-9);

  // And what it departed from. A 297-point re-anchor is past the full-reopen
  // distance, so the rule recommends its 20% floor; the board chose 10%.
  assert.ok(typeof doc.recommendationReliability === 'number',
    `the recommendation must reach the record, got ${doc.recommendationReliability}`);
  assert.ok(Math.abs(doc.recommendationReliability - 0.20) < 1e-9,
    `expected the 20% floor, got ${doc.recommendationReliability}`);
  assert.notStrictEqual(doc.newReliability, doc.recommendationReliability,
    'this is exactly the case where the two differ, which is why both are stored');
  assert.ok(doc.recommendationMethodVersion,
    'the method behind the recommendation must be named');
});
