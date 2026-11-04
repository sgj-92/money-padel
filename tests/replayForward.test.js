// A rating is not a stored fact you can edit; it is the end of a sequence. The
// only honest way to change one match is to re-derive every rating that
// followed from it.
//
// The foundation of all of this is the no-op: replaying the stored record with
// NO change must reproduce it exactly. If that ever fails, every planned edit
// is being computed on top of a record the engine no longer agrees with, and
// nothing else in this file means anything.

const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../assets/js/ratingEngine.js');
const Store = require('../assets/js/ratingStore.js');
const RF = require('../assets/js/replayForward.js');
const BD = require('../assets/js/betaDiagnostics.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');

let cached = null;
function record() {
  if (!cached) {
    const b = buildBackfill();
    const plan = Store.buildWritePlan({
      matches: b.matches, journey: b.replay.journey, state: b.replay.state, provenance: b.provenance,
    });
    cached = { plan, provenance: b.provenance };
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
const APPENDED = {
  id: '2026-09-18-1', date: '2026-09-18', sourceIndex: 1,
  teamA: ['Shaun', 'Tom'], teamB: ['Max', 'KC'],
  sets: [[6, 3], [6, 4]], outcome: Engine.OUTCOME.A_WINS, type: 'doubles',
};

test('replaying the record with no change reproduces it exactly', () => {
  const { stored, provenance } = record();
  const v = RF.verifyNoOp(stored, provenance);
  assert.strictEqual(v.count, 0, v.differences.join('\n'));
  assert.strictEqual(v.identical, true);
});

test('the inputs are rebuilt from the record, not inferred', () => {
  const { stored } = record();
  const inputs = RF.inputsFromRecord(stored);
  assert.strictEqual(inputs.matches.length, 150);
  assert.strictEqual(inputs.initialisations.length, 34);
  // The three authoritative tier changes, and nothing else.
  assert.strictEqual(inputs.events.length, 3);
  assert.deepStrictEqual(inputs.events.map((e) => e.playerId), ['Shaun', 'Tom', 'Fatch']);

  // Provisional status survives. Dropping it silently promotes every
  // provisional player and the correction that follows then throws.
  const shaun = inputs.initialisations.find((i) => i.playerId === 'Shaun');
  assert.strictEqual(shaun.classificationStatus, 'PROVISIONAL');
  assert.strictEqual(shaun.tier, 'C');
});

test('a tier-only event is replayed without a reliability change', () => {
  const { stored } = record();
  const inputs = RF.inputsFromRecord(stored);
  // Recorded events always carry newReliability; feeding it back would invert
  // it through reliability = e/(e+10) and lose a bit (Open Question 11). An
  // event is replayed as changing reliability only if it actually did.
  inputs.events.forEach((e) => {
    assert.strictEqual(e.newReliability, undefined, `${e.playerId} ${e.eventType}`);
    assert.strictEqual(e.newPowerRating, undefined, `${e.playerId} ${e.eventType}`);
    assert.ok(e.newTier);
  });
});

test('a club reassessment IS replayed as changing the rating', () => {
  const { stored } = record();
  stored.journey.push({
    id: '2026-09-17__Shaun__CLUB_RATING_REASSESSMENT',
    playerId: 'Shaun', eventType: Engine.EVENT.CLUB_RATING_REASSESSMENT,
    effectiveDate: '2026-09-17', previousPowerRating: 1000, newPowerRating: 1200,
    previousReliability: 0.5, newReliability: 0.5, newTier: null,
  });
  const e = RF.inputsFromRecord(stored).events.find((x) => x.eventType === Engine.EVENT.CLUB_RATING_REASSESSMENT);
  assert.strictEqual(e.newPowerRating, 1200);
  assert.strictEqual(e.newReliability, undefined, 'it did not change reliability, so it must not claim to');
});

test('appending a match touches only that match and its four players', () => {
  const { stored, provenance } = record();
  const p = RF.plan({ stored, change: { type: 'append', match: APPENDED }, provenance });
  assert.strictEqual(p.documentsToDelete, 0);
  // 1 match + 4 journey events + 4 player documents.
  assert.strictEqual(p.documentsToWrite, 9);
  assert.deepStrictEqual(p.playersMoved.map((m) => m.playerId).sort(), ['KC', 'Max', 'Shaun', 'Tom']);
  // Forward-only: nothing before it is rewritten.
  assert.strictEqual(p.writes[Store.COLLECTIONS.matches].length, 1);
  assert.strictEqual(p.writes[Store.COLLECTIONS.journey].length, 4);
});

test('editing an early match re-derives everything that followed', () => {
  const { stored, provenance } = record();
  const early = stored.matches.find((m) => m.date === '2026-06-02');
  const edited = { ...Store.matchFromDoc(early), sets: [[6, 0], [6, 0]] };
  const p = RF.plan({ stored, change: { type: 'edit', match: edited }, provenance });
  // One June result reaches everybody, which is the whole point of replaying.
  assert.strictEqual(p.playersMoved.length, 34);
  assert.ok(p.documentsToWrite > 500, `expected a wide ripple, got ${p.documentsToWrite}`);
  assert.strictEqual(p.documentsToDelete, 0);
});

test('deleting a match removes its events rather than leaving them beside the new ones', () => {
  const { stored, provenance } = record();
  const early = stored.matches.find((m) => m.date === '2026-06-02');
  const p = RF.plan({ stored, change: { type: 'delete', matchId: early.id }, provenance });
  assert.strictEqual(p.deletes[Store.COLLECTIONS.matches].length, 1);
  assert.strictEqual(p.deletes[Store.COLLECTIONS.matches][0], early.id);
  assert.strictEqual(p.deletes[Store.COLLECTIONS.journey].length, 4);
  p.deletes[Store.COLLECTIONS.journey].forEach((id) => assert.ok(id.startsWith(early.id)));
  assert.strictEqual(p.deletes[Store.COLLECTIONS.players].length, 0, 'nobody is deleted by a match deletion');
});

test('a player the record has never seen is refused, not silently seeded', () => {
  const { stored, provenance } = record();
  const withNew = { ...APPENDED, teamB: ['Newcomer', 'KC'] };
  assert.throws(() => RF.plan({ stored, change: { type: 'append', match: withNew }, provenance }),
    (e) => {
      assert.match(e.message, /never been initialised/);
      assert.deepStrictEqual(e.unseen.map((u) => u.playerId), ['Newcomer']);
      return true;
    });
});

test('no change can be planned on a record that does not replay to itself', () => {
  const { stored, provenance } = record();
  // Tamper with a stored rating, as a bad write would.
  stored.players.find((p) => p.id === 'Shaun').rating += 5;
  assert.throws(() => RF.plan({ stored, change: { type: 'append', match: APPENDED }, provenance }),
    /stored ratings and the stored history have diverged/);
});

test('appending the same match twice, or editing one that is not there, is refused', () => {
  const { stored, provenance } = record();
  const existing = Store.matchFromDoc(stored.matches[0]);
  assert.throws(() => RF.plan({ stored, change: { type: 'append', match: existing }, provenance }),
    /already in the record/);
  assert.throws(() => RF.plan({ stored, change: { type: 'edit', match: { ...APPENDED } }, provenance }),
    /is not in the record/);
  assert.throws(() => RF.plan({ stored, change: { type: 'delete', matchId: 'nope' }, provenance }),
    /is not in the record/);
});

test('the committed result is a sound record, and replays to itself again', async () => {
  const { stored, provenance } = record();
  const backend = Store.memoryBackend();
  for (const [c, docs] of Object.entries({
    [Store.COLLECTIONS.matches]: stored.matches,
    [Store.COLLECTIONS.journey]: stored.journey,
    [Store.COLLECTIONS.players]: stored.players,
  })) {
    for (const d of docs) await backend.set(c, d.id, d);
  }

  const p = RF.plan({ stored, change: { type: 'append', match: APPENDED }, provenance });
  const res = await RF.commit(backend, p);
  assert.strictEqual(res.written, 9);
  assert.strictEqual(res.deleted, 0);

  const after = {
    matches: await backend.getAll(Store.COLLECTIONS.matches),
    journey: await backend.getAll(Store.COLLECTIONS.journey),
    players: await backend.getAll(Store.COLLECTIONS.players),
  };
  assert.strictEqual(after.matches.length, 151);
  assert.strictEqual(after.journey.length, 637);

  // Diagnostics must pass on the result.
  const playersById = {};
  after.players.forEach((d) => { playersById[d.id] = d; });
  const report = BD.run({ players: playersById, matches: after.matches, journey: after.journey });
  assert.ok(report.healthy, report.checks.filter((c) => c.status === 'fail').map((c) => c.name).join(', '));

  // And the new record is itself replayable, so the next edit can be planned.
  assert.strictEqual(RF.verifyNoOp(after, provenance).count, 0);
});

test('a deletion commits deletes before writes, so stale events never sit beside fresh ones', async () => {
  const { stored, provenance } = record();
  const early = stored.matches.find((m) => m.date === '2026-06-02');
  const p = RF.plan({ stored, change: { type: 'delete', matchId: early.id }, provenance });
  const order = [];
  const spy = {
    async set() { order.push('set'); },
    async remove() { order.push('remove'); },
  };
  await RF.commit(spy, p);
  assert.strictEqual(order.indexOf('remove'), 0);
  assert.ok(order.lastIndexOf('remove') < order.indexOf('set'),
    'every delete must precede every write');
});

// Both of these were found by the no-op check failing, not by reasoning about
// the code, and both would have made every edit rewrite the entire database.
test('documents are compared by what they say, not by key order', () => {
  const a = { id: 'x', rating: 1, tier: 'B' };
  const b = { tier: 'B', id: 'x', rating: 1 };
  assert.ok(RF.sameDoc(a, b));
  assert.ok(!RF.sameDoc(a, { ...a, tier: 'A' }));
});

test('numbers agree within a tolerance, because Node and the browser disagree in the last bit', () => {
  // A real pair: the same expectation, seeded by Node and replayed in Chromium.
  assert.ok(RF.sameDoc({ id: 'x', e: 0.4803169324020399 }, { id: 'x', e: 0.48031693240203976 }));
  // The tolerance is relative, so it scales with the number: at a rating of
  // 1400 it is about 1.4e-6, which is still five orders of magnitude below the
  // 0.1 the app displays. Anything that could change what a player sees is
  // caught.
  assert.ok(!RF.sameDoc({ id: 'x', r: 1400 }, { id: 'x', r: 1400.001 }));
  assert.ok(!RF.sameDoc({ id: 'x', r: 1400 }, { id: 'x', r: 1400.05 }));
  assert.ok(RF.sameDoc({ id: 'x', r: 1400 }, { id: 'x', r: 1400.0000001 }));
  assert.ok(RF.EPSILON <= 1e-9);
  // Nested values too: a set score is a map, and arrays of them must compare.
  assert.ok(RF.sameDoc({ id: 'x', sets: [{ teamA: 6, teamB: 3 }] }, { id: 'x', sets: [{ teamA: 6, teamB: 3 }] }));
  assert.ok(!RF.sameDoc({ id: 'x', sets: [{ teamA: 6, teamB: 3 }] }, { id: 'x', sets: [{ teamA: 6, teamB: 4 }] }));
});

test('an untouched event keeps the attribution it was written with', () => {
  const { stored, provenance } = record();
  const p = RF.plan({
    stored,
    change: { type: 'append', match: APPENDED },
    // A different operator, appending today.
    provenance: { createdBy: 'Someone Else', recordedAt: '2026-09-18T00:00:00Z', source: 'Approved from a submission' },
  });
  // Only the new match's events are written, and they carry the new operator.
  p.writes[Store.COLLECTIONS.journey].forEach((d) => {
    assert.strictEqual(d.createdBy, 'Someone Else');
    assert.ok(d.id.startsWith(APPENDED.id));
  });
  // Nothing from the season was rewritten -- restamping every event would have
  // recorded the whole history as created by whoever approved one game.
  assert.strictEqual(p.writes[Store.COLLECTIONS.journey].length, 4);
  assert.strictEqual(provenance.createdBy, 'seed-beta');
});

// ---------------------------------------------------------------------------
// Repairing a half-finished replay.
//
// Found in the live beta, not here: a removal wrote part of its ~500 documents
// and stopped, leaving the tail of the journey and the player state holding
// pre-change values. Every match was intact; only the derived numbers were
// half-written. plan() then refused every further edit, correctly and
// permanently -- nothing in the app could clear it.

test('a record whose replay was half-written can be repaired without touching a match', async () => {
  const { stored, provenance } = record();

  // Write a change in full, into memory, so we have a correct "after".
  const change = { type: 'delete', matchId: stored.matches[10].id };
  const planned = RF.plan({ stored, change, provenance });
  const after = JSON.parse(JSON.stringify(stored));
  const applyTo = (rec, writes, deletes) => {
    Object.entries(deletes || {}).forEach(([c, ids]) => {
      const key = c === Store.COLLECTIONS.journey ? 'journey' : c;
      rec[key] = rec[key].filter((d) => !ids.includes(d.id));
    });
    Object.entries(writes || {}).forEach(([c, docs]) => {
      const key = c === Store.COLLECTIONS.journey ? 'journey' : c;
      const by = {}; rec[key].forEach((d) => { by[d.id] = d; });
      docs.forEach((d) => { by[d.id] = d; });
      rec[key] = Object.values(by);
    });
  };
  applyTo(after, planned.writes, planned.deletes);
  assert.strictEqual(RF.verifyNoOp(after, provenance).count, 0, 'the fully applied change must verify');

  // Now the half-written record: the deletes and the first half of the writes
  // landed; the rest never did.
  const half = JSON.parse(JSON.stringify(stored));
  const allWrites = [];
  Object.entries(planned.writes).forEach(([c, docs]) => docs.forEach((d) => allWrites.push([c, d])));
  const landed = allWrites.slice(0, Math.floor(allWrites.length / 2));
  const partial = {};
  landed.forEach(([c, d]) => { (partial[c] = partial[c] || []).push(d); });
  applyTo(half, partial, planned.deletes);

  const broken = RF.verifyNoOp(half, provenance);
  assert.ok(broken.count > 0, 'a half-written replay must not verify');
  assert.throws(() => RF.plan({ stored: half, change: { type: 'delete', matchId: half.matches[0].id }, provenance }),
    /does not reproduce it/, 'and no further edit may be planned on top of it');

  // The repair.
  const repair = RF.planRepair(half, provenance);
  assert.strictEqual(repair.wouldDelete.length, 0, 'a partial write is repaired by writing, never by deleting');
  assert.strictEqual(repair.documentsToDelete, 0);
  assert.strictEqual(repair.documentsToWrite, broken.count,
    'every disagreement, and nothing else, is rewritten');

  const repaired = JSON.parse(JSON.stringify(half));
  applyTo(repaired, repair.writes, repair.deletes);
  assert.strictEqual(RF.verifyNoOp(repaired, provenance).count, 0, 'the repaired record replays to itself');

  // It finishes the change that was interrupted -- it does not undo it, and it
  // invents nothing: the result is the record the completed write would have left.
  assert.strictEqual(repaired.matches.length, after.matches.length);
  const ratingOf = (rec, id) => rec.players.find((p) => p.id === id).rating;
  repaired.players.forEach((p) => {
    assert.ok(Math.abs(p.rating - ratingOf(after, p.id)) < RF.EPSILON,
      `${p.id} must end where the completed write would have left them`);
  });

  // And the diagnostics agree.
  const players = {};
  repaired.players.forEach((p) => { players[p.id] = p; });
  assert.strictEqual(BD.run({ players, matches: repaired.matches, journey: repaired.journey }).healthy, true);
});

test('repairing a healthy record is a no-op', () => {
  const { stored, provenance } = record();
  const repair = RF.planRepair(stored, provenance);
  assert.strictEqual(repair.documentsToWrite, 0);
  assert.strictEqual(repair.playersMoved.length, 0);
  assert.strictEqual(repair.wouldDelete.length, 0);
});

// A superseded club decision is stored but never replayed, so a rebuild does
// not contain it. verifyNoOp already excludes it; a repair must too, or the
// first repair after any correction would quietly delete the audit trail that
// superseding rather than overwriting exists to protect.
test('a repair never proposes removing a superseded decision', () => {
  const { stored, provenance } = record();
  const HA = require('../assets/js/historicalAdjustment.js');

  // A real correction, made through the supported path.
  const adjustment = {
    playerId: 'Shaun', effectiveDate: '2026-07-01', tierEvent: 'PROMOTION', newTier: 'B',
    ratingDecision: 'CORRECT_INITIAL_CLASSIFICATION', correctedRating: 1400,
    reason: 'Board: entered C as an unknown; the initial estimate was wrong.', createdBy: 'Board',
  };
  const first = HA.plan({ stored, adjustment, provenance });

  const corrected = JSON.parse(JSON.stringify(stored));
  const by = {}; corrected.journey.forEach((d) => { by[d.id] = d; });
  (first.writes[Store.COLLECTIONS.journey] || []).forEach((d) => { by[d.id] = d; });
  corrected.journey = Object.values(by);
  const byP = {}; corrected.players.forEach((d) => { byP[d.id] = d; });
  (first.writes[Store.COLLECTIONS.players] || []).forEach((d) => { byP[d.id] = d; });
  corrected.players = Object.values(byP);

  const superseded = corrected.journey.filter((e) => e.supersedes).map((e) => e.supersedes);
  assert.ok(superseded.length > 0, 'this test is pointless unless something was actually superseded');

  const repair = RF.planRepair(corrected, provenance);
  superseded.forEach((id) => {
    assert.ok(!repair.wouldDelete.some((d) => d.endsWith('/' + id)),
      `a repair must not propose removing the superseded ${id}`);
  });
});
