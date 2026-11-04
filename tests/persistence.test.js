const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../assets/js/ratingEngine.js');
const Store = require('../assets/js/ratingStore.js');
const TierHistory = require('../assets/js/tierHistory.js');
const D = require('./helpers/dataset.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');

const ROOT = path.join(__dirname, '..');

// ---------- §9.1 temporal tiers ----------

test('tierAsOf returns the tier that applied at the time, not today', () => {
  const h = TierHistory.create({ currentTiers: D.loadBaseTiers() });
  assert.strictEqual(h.tierAsOf('Shaun', '2026-06-30'), 'C');
  assert.strictEqual(h.tierAsOf('Shaun', '2026-07-01'), 'B'); // in force on the day itself
  assert.strictEqual(h.tierAsOf('Shaun', '2026-09-30'), 'B');
  assert.strictEqual(h.tierAsOf('Fatch', '2026-07-15'), 'C');
  assert.strictEqual(h.tierAsOf('Fatch', '2026-08-01'), 'B');
  assert.strictEqual(h.tierAsOf('Rishi', '2026-06-01'), 'B'); // never changed
  assert.strictEqual(h.tierAsOf('Manny', '2026-06-01'), 'S');
});

test('initial tiers are derived by walking the changes backwards', () => {
  const h = TierHistory.create({ currentTiers: D.loadBaseTiers() });
  assert.strictEqual(h.initialTiers.Shaun, 'C');
  assert.strictEqual(h.initialTiers.Tom, 'C');
  assert.strictEqual(h.initialTiers.Fatch, 'C');
  assert.strictEqual(h.initialTiers.Rishi, 'B');
});

test('a tier history that contradicts the current tier is rejected, not guessed', () => {
  assert.throws(() => TierHistory.create({
    currentTiers: { Shaun: 'A' }, // history says Shaun ends at B
    changes: TierHistory.AUTHORITATIVE_TIER_CHANGES.filter((c) => c.playerId === 'Shaun'),
  }), /do not guess/);
});

test('the authoritative history is exactly the three §5.3 changes', () => {
  assert.strictEqual(TierHistory.AUTHORITATIVE_TIER_CHANGES.length, 3);
  assert.deepStrictEqual(
    TierHistory.AUTHORITATIVE_TIER_CHANGES.map((c) => `${c.playerId}@${c.effectiveDate}`),
    ['Shaun@2026-07-01', 'Tom@2026-07-01', 'Fatch@2026-08-01']);
});

// ---------- the April/May block is structurally separated ----------

function loadHistoricalDisplayMatches() {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'clubs', 'moneypadel', 'historicalDisplayMatches.js'), 'utf8');
  return new Function(src + '; return HISTORICAL_DISPLAY_MATCHES;')();
}

test('the April/May block lives outside BASE_MATCHES entirely', () => {
  const base = require('../assets/js/clubs/moneypadel/history.js').CLUB_HISTORY.baseMatches;
  assert.strictEqual(base.length, 127);
  assert.ok(base.every((m) => m.date >= '2026-06-01'), 'no April/May match may remain in BASE_MATCHES');
  assert.ok(base.every((m) => m.verified !== false), 'no unverified match may remain in BASE_MATCHES');

  const display = loadHistoricalDisplayMatches();
  assert.strictEqual(display.length, 50);
  assert.ok(display.every((m) => m.date <= '2026-05-01'));
});

test('no calculation path can reach the display-only block', () => {
  const stripComments = (s) => s.replace(/^\s*\/\/.*$/gm, '');
  const app = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'app.js'), 'utf8');
  const uses = stripComments(app).split('\n').filter((l) => /HISTORICAL_DISPLAY_MATCHES/.test(l)).length;
  assert.strictEqual(uses, 1, 'it may be referenced by exactly one line of code, in getDisplayMatches');
  const inDisplayFn = /function getDisplayMatches\(\)\{[\s\S]*?HISTORICAL_DISPLAY_MATCHES[\s\S]*?\n\}/.test(app);
  assert.ok(inDisplayFn, 'the only reference must be inside getDisplayMatches');

  // The rating engine and the store never mention it at all.
  ['ratingEngine.js', 'ratingStore.js', 'reassessment.js', 'tierHistory.js'].forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', f), 'utf8');
    assert.ok(!src.includes('HISTORICAL_DISPLAY_MATCHES'), f + ' must not reference display-only data');
  });
  const seed = stripComments(fs.readFileSync(path.join(ROOT, 'scripts', 'moneypadel', 'seed-beta.js'), 'utf8'));
  assert.ok(!seed.includes('HISTORICAL_DISPLAY_MATCHES'),
    'the seed script must not read display-only data');
});

test('the six display-only players have no rating, no reliability, no journey', () => {
  const ORPHANS = ['Twoshay', 'Alfie', 'Abby', 'Kam', 'Kevin', 'bruh'];
  const { replay } = buildBackfill();

  // They really do appear in the display-only block, so this test is meaningful.
  const display = loadHistoricalDisplayMatches();
  const inDisplay = new Set();
  display.forEach((m) => { m.winners.forEach((n) => inDisplay.add(n)); m.losers.forEach((n) => inDisplay.add(n)); });
  ORPHANS.forEach((n) => assert.ok(inDisplay.has(n), n + ' should appear in the display-only block'));

  ORPHANS.forEach((name) => {
    assert.strictEqual(replay.state[name], undefined, name + ' must have no rating state at all');
    const events = replay.journey.filter((e) => e.playerId === name);
    assert.strictEqual(events.length, 0, name + ' must have no Rating Journey events');
  });

  // And nothing about them reaches the write plan.
  const plan = Store.buildWritePlan({ matches: D.loadAllMatches(), journey: replay.journey, state: replay.state });
  const planText = JSON.stringify(plan);
  ORPHANS.forEach((name) => {
    assert.ok(!plan[Store.COLLECTIONS.players].some((p) => p.id === name), name + ' must not be written');
    assert.ok(!planText.includes(`"${name}"`), name + ' must not appear anywhere in the write plan');
  });
});

// ---------- the write plan ----------

test('journey document ids are deterministic, so re-seeding overwrites', () => {
  const a = Store.buildWritePlan(planInput());
  const b = Store.buildWritePlan(planInput());
  assert.deepStrictEqual(a, b);

  const backend = Store.memoryBackend();
  return Store.writePlan(backend, a)
    .then(() => Store.writePlan(backend, b))
    .then(async () => {
      const journey = await backend.getAll(Store.COLLECTIONS.journey);
      assert.strictEqual(journey.length, a[Store.COLLECTIONS.journey].length,
        'seeding twice must not duplicate documents');
    });
});

function planInput() {
  const { matches, replay, provenance } = buildBackfill();
  return { matches, journey: replay.journey, state: replay.state, provenance };
}

test('every journey document carries the full §11 record', () => {
  const plan = Store.buildWritePlan(planInput());
  const docs = plan[Store.COLLECTIONS.journey];
  assert.ok(docs.length > 0);
  docs.forEach((d) => {
    Store.JOURNEY_FIELDS.forEach((f) => assert.ok(f in d, `${d.id} is missing ${f}`));
    assert.strictEqual(d.ratingModelVersion, Engine.RATING_MODEL_VERSION);
    assert.strictEqual(d.schemaVersion, Store.SCHEMA_VERSION);
    assert.strictEqual(d.createdBy, 'seed-beta', d.id + ' has no provenance');
    assert.ok(d.recordedAt, d.id + ' has no recordedAt');
  });
  docs.filter((d) => d.eventType === Engine.EVENT.MATCH_UPDATE).forEach((d) => {
    Store.MATCH_EVENT_FIELDS.forEach((f) => assert.ok(f in d, `${d.id} is missing ${f}`));
    assert.ok(typeof d.preMatchExpectedScore === 'number', 'pre-match expectation must be persisted');
    // Match records are referenced, never copied into the event.
    assert.ok(!('sets' in d) && !('teamA' in d));
  });
});

test('player state is fully rebuildable from the journey', () => {
  const { replay } = buildBackfill();
  const plan = Store.buildWritePlan(planInput());
  plan[Store.COLLECTIONS.players].forEach((p) => {
    const s = replay.state[p.id];
    assert.strictEqual(p.rating, s.rating);
    assert.strictEqual(p.effectiveEvidence, s.effectiveEvidence);
    assert.strictEqual(p.lifetimeMatches, s.lifetimeMatches);
    assert.strictEqual(p.reliability, Engine.reliability(s.effectiveEvidence));
    assert.strictEqual(p.ratingModelVersion, 'sequential-v1');
  });
});

test('the backfill reads the full export and marks the draws', () => {
  const plan = Store.buildWritePlan(planInput());
  const matches = plan[Store.COLLECTIONS.matches];
  assert.strictEqual(matches.length, 150);
  assert.strictEqual(matches.filter((m) => m.outcome === Engine.OUTCOME.DRAW).length, 5);
  matches.filter((m) => m.outcome === Engine.OUTCOME.DRAW)
    .forEach((m) => assert.strictEqual(m.drawSideAssignmentArbitrary, true,
      'a draw must record that its side assignment was arbitrary'));
});

test('the backfill records the three tier events without moving any rating', () => {
  const { replay } = buildBackfill();
  const tierEvents = replay.journey.filter((e) =>
    TierHistory.TIER_CHANGE_EVENTS.includes(e.eventType));
  assert.strictEqual(tierEvents.length, 3);
  tierEvents.forEach((e) => {
    assert.strictEqual(e.newPowerRating, e.previousPowerRating);
    assert.strictEqual(e.newReliability, e.previousReliability);
    assert.strictEqual(e.source, 'Money Padel Prestige v3 specification §5.3');
  });
});

test('Firestore field encoding round-trips', () => {
  const doc = { a: 'x', b: 12, c: 1.5, d: true, e: null, f: [1, 'two'], g: { h: 3 } };
  const round = Store.fromFirestoreFields(Store.toFirestoreFields(doc));
  assert.deepStrictEqual(round, doc);
});

test('the seed plan is the canonical ordering, not the experiment tie-break', () => {
  const { replay } = buildBackfill();
  // Canonical ordering gives Rishi 5.78% in June; the experiment tie-break gives 5.81%.
  const pct = Engine.calculateMonthlyPerformance(replay.journey)
    .find((x) => x.playerId === 'Rishi' && x.month === '2026-06').monthlyPerformance * 100;
  assert.strictEqual(Math.round(pct * 100) / 100, 5.78);
});

test('an undated non-match event is rejected rather than given a "null" id', () => {
  assert.throws(() => Store.eventId({
    eventType: Engine.EVENT.PLAYER_INITIALISED, playerId: 'X', effectiveDate: null,
  }), /has no effectiveDate/);
  assert.strictEqual(
    Store.eventId({ eventType: Engine.EVENT.PLAYER_INITIALISED, playerId: 'X', effectiveDate: '2026-06-02' }),
    '2026-06-02__X__PLAYER_INITIALISED');
});

test('every planned document id is a legal, non-null Firestore id', () => {
  const plan = Store.buildWritePlan(planInput());
  Object.values(plan).flat().forEach((d) => {
    assert.ok(d.id && typeof d.id === 'string', 'missing id');
    assert.ok(!d.id.includes('null'), 'id contains "null": ' + d.id);
    assert.ok(!d.id.includes('/') && !d.id.includes('undefined'), 'illegal id: ' + d.id);
  });
});

// ---------- --limit sampling ----------

test('a limited plan caps the total and still covers every collection', () => {
  const full = Store.buildWritePlan(planInput());
  const ten = Store.limitPlan(full, 10);
  const total = Object.values(ten).reduce((s, d) => s + d.length, 0);
  assert.strictEqual(total, 10);
  Object.keys(full).forEach((c) => assert.ok(ten[c].length > 0, c + ' must be represented'));
});

test('a limited plan is a true subset — same ids, same content', () => {
  const full = Store.buildWritePlan(planInput());
  const sample = Store.limitPlan(full, 12);
  Object.entries(sample).forEach(([c, docs]) => {
    docs.forEach((d) => {
      const original = full[c].find((x) => x.id === d.id);
      assert.ok(original, d.id + ' is not in the full plan');
      assert.deepStrictEqual(d, original, d.id + ' differs from the full plan');
    });
  });
});

test('the sample spans event types rather than taking the first N', () => {
  const full = Store.buildWritePlan(planInput());
  const types = new Set(Store.limitPlan(full, 10)[Store.COLLECTIONS.journey].map((d) => d.eventType));
  assert.ok(types.size > 1, 'a 10-document sample should show more than one event type');
});

test('limiting is deterministic and degrades sensibly at the edges', () => {
  const full = Store.buildWritePlan(planInput());
  assert.deepStrictEqual(Store.limitPlan(full, 10), Store.limitPlan(full, 10));
  assert.strictEqual(Object.values(Store.limitPlan(full, 1)).reduce((s, d) => s + d.length, 0), 1);
  assert.strictEqual(Object.values(Store.limitPlan(full, 0)).reduce((s, d) => s + d.length, 0), 0);
  assert.deepStrictEqual(Store.limitPlan(full, 99999), full, 'a limit above the total returns everything');
});

test('a full seed overwrites everything a limited seed wrote', async () => {
  const full = Store.buildWritePlan(planInput());
  const backend = Store.memoryBackend();
  await Store.writePlan(backend, Store.limitPlan(full, 10));
  await Store.writePlan(backend, full);
  for (const [c, docs] of Object.entries(full)) {
    assert.strictEqual((await backend.getAll(c)).length, docs.length,
      c + ' should hold exactly the full plan, with no orphans from the sample');
  }
});

// ---------- Firestore compatibility ----------

test('no planned document contains a nested array', () => {
  // Firestore rejects arrays of arrays; a set score is stored as a map per set.
  const plan = Store.buildWritePlan(planInput());
  const match = plan[Store.COLLECTIONS.matches][0];
  assert.ok(!Array.isArray(match.sets[0]), 'set scores must not be raw arrays');
  assert.deepStrictEqual(match.sets[0], { teamA: 4, teamB: 6 });
  Object.entries(plan).forEach(([c, docs]) =>
    docs.forEach((d) => assert.doesNotThrow(() => Store.assertFirestoreSafe(d, c))));
});

test('the safety check actually catches a nested array', () => {
  assert.throws(() => Store.assertFirestoreSafe({ id: 'x', sets: [[1, 2]] }, 'matches'), /Nested array/);
  assert.throws(() => Store.assertFirestoreSafe({ id: 'x', n: Infinity }, 'matches'), /Non-finite/);
  assert.doesNotThrow(() => Store.assertFirestoreSafe({ id: 'x', a: ['p', 'q'], b: { c: [1, 2] } }, 'matches'));
});

test('a stored match round-trips back to the engine shape', () => {
  const original = D.loadAllMatches()[0];
  const restored = Store.matchFromDoc(Store.toMatchDoc(original));
  assert.deepStrictEqual(restored.sets, original.sets);
  assert.deepStrictEqual(restored.teamA, original.teamA);
  assert.strictEqual(restored.outcome, original.outcome);
  assert.strictEqual(restored.id, original.id);
});

// ---------- pagination ----------

test('a REST collection read follows nextPageToken to the end', async () => {
  // Firestore pages by response size as well as pageSize. A reader that ignores
  // the token silently truncates, which looks exactly like missing data.
  const pages = [
    { documents: [{ fields: { id: { stringValue: 'a' } } }, { fields: { id: { stringValue: 'b' } } }], nextPageToken: 't1' },
    { documents: [{ fields: { id: { stringValue: 'c' } } }], nextPageToken: 't2' },
    { documents: [{ fields: { id: { stringValue: 'd' } } }] },
  ];
  const seen = [];
  let call = 0;
  const fetchImpl = async (url) => {
    seen.push(url);
    const body = pages[call++];
    return { ok: true, json: async () => body };
  };
  const backend = Store.firestoreRestBackend({ projectId: 'test', fetchImpl });
  const docs = await backend.getAll('ratingJourney');

  assert.deepStrictEqual(docs.map((d) => d.id), ['a', 'b', 'c', 'd'],
    'every page must be read, not just the first');
  assert.strictEqual(seen.length, 3);
  assert.ok(!seen[0].includes('pageToken'), 'the first request carries no token');
  assert.ok(seen[1].includes('pageToken=t1'));
  assert.ok(seen[2].includes('pageToken=t2'));
});

test('a failed page surfaces as an error rather than a short read', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, text: async () => 'nope' });
  const backend = Store.firestoreRestBackend({ projectId: 'test', fetchImpl });
  await assert.rejects(() => backend.getAll('matches'), /read matches failed: 503/);
});
