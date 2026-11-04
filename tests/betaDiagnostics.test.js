// A diagnostic that only ever passes is decoration. Each test here breaks the
// record in one specific way and checks that the corresponding check notices --
// because the whole point is to catch a bad write that nothing else would.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../assets/js/ratingEngine.js');
const Store = require('../assets/js/ratingStore.js');
const BD = require('../assets/js/betaDiagnostics.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');
const { survey, plannedIds } = require('../scripts/moneypadel/reset-beta.js');

const ROOT = path.join(__dirname, '..');

let planCache = null;
function stored() {
  if (!planCache) {
    const { matches, replay, provenance } = buildBackfill();
    planCache = Store.buildWritePlan({ matches, journey: replay.journey, state: replay.state, provenance });
  }
  const players = {};
  planCache[Store.COLLECTIONS.players].forEach((d) => { players[d.id] = { ...d }; });
  return {
    players,
    matches: planCache[Store.COLLECTIONS.matches].map((d) => ({ ...d })),
    journey: planCache[Store.COLLECTIONS.journey].map((d) => ({ ...d })),
  };
}
function check(report, name) {
  const c = report.checks.find((x) => x.name === name);
  assert.ok(c, `no check named "${name}"`);
  return c;
}

test('the seeded baseline passes every check', () => {
  const r = BD.run(stored());
  const bad = r.checks.filter((c) => c.status !== 'ok');
  assert.deepStrictEqual(bad.map((c) => `${c.name}: ${c.detail}`), []);
  assert.ok(r.healthy);
  assert.deepStrictEqual(r.counts, { players: 34, matches: 150, journey: 633 });
});

test('a rating edited in the players collection is caught', () => {
  const s = stored();
  s.players.Shaun.rating = s.players.Shaun.rating + 10;
  const r = BD.run(s);
  assert.strictEqual(r.healthy, false);
  const c = check(r, 'Stored state is the end of the stored history');
  assert.strictEqual(c.status, 'fail');
  assert.ok(c.items.some((i) => i.startsWith('Shaun:')), c.items.join(' | '));
});

test('a tier edited in the players collection is caught', () => {
  const s = stored();
  s.players.Shaun.tier = 'A';
  const c = check(BD.run(s), 'Stored state is the end of the stored history');
  assert.strictEqual(c.status, 'fail');
  assert.ok(c.items.some((i) => /stored tier A/.test(i)), c.items.join(' | '));
});

test('a break in the chain is caught, even when the endpoints still agree', () => {
  const s = stored();
  // Alter a rating mid-history without touching the final one.
  const mid = s.journey.filter((e) => e.playerId === 'Shaun' && e.eventType === Engine.EVENT.MATCH_UPDATE)[5];
  mid.postMatchRating = mid.postMatchRating + 7;
  const r = BD.run(s);
  const c = check(r, 'Each event starts where the last one finished');
  assert.strictEqual(c.status, 'fail');
  assert.ok(c.items.some((i) => i.startsWith('Shaun ')));
  // The endpoint check is undisturbed, which is why both checks exist.
  assert.strictEqual(check(r, 'Stored state is the end of the stored history').status, 'ok');
});

test('a duplicate event id is caught', () => {
  const s = stored();
  s.journey.push({ ...s.journey[10] });
  const c = check(BD.run(s), 'Journey ids are unique');
  assert.strictEqual(c.status, 'fail');
  assert.strictEqual(c.items.length, 1);
});

test('a match missing its events, or events missing their match, are both caught', () => {
  const s1 = stored();
  const victim = s1.matches[3].id;
  s1.journey = s1.journey.filter((e) => e.matchId !== victim);
  const c1 = check(BD.run(s1), 'Every match and its events agree');
  assert.strictEqual(c1.status, 'fail');
  assert.ok(c1.items.some((i) => i.includes('no journey events')));

  const s2 = stored();
  s2.matches = s2.matches.filter((m) => m.id !== victim);
  const c2 = check(BD.run(s2), 'Every match and its events agree');
  assert.ok(c2.items.some((i) => i.includes('not stored')));
});

test('a player on only one side of the record is caught', () => {
  const s1 = stored();
  delete s1.players.Shaun;
  assert.ok(check(BD.run(s1), 'Players and events line up').items.some((i) => /no player document/.test(i)));

  const s2 = stored();
  s2.journey = s2.journey.filter((e) => e.playerId !== 'Tom');
  assert.ok(check(BD.run(s2), 'Players and events line up').items.some((i) => /no events/.test(i)));
});

test('April or May data entering the record is caught', () => {
  const s = stored();
  s.journey.push({ ...s.journey[0], id: 'x', effectiveDate: '2026-05-04' });
  const c = check(BD.run(s), 'No pre-June data has entered the record');
  assert.strictEqual(c.status, 'fail');
});

test('the app disagreeing with the database is itself a finding', () => {
  const s = stored();
  const appPlayers = {};
  Object.entries(s.players).forEach(([n, p]) => { appPlayers[n] = { rating: p.rating, tier: p.tier }; });
  assert.strictEqual(BD.run({ ...s, appPlayers }).checks.find((c) => c.name === 'What the app shows is what is stored').status, 'ok');

  appPlayers.Shaun.rating += 1;
  const c = check(BD.run({ ...s, appPlayers }), 'What the app shows is what is stored');
  assert.strictEqual(c.status, 'fail');
  assert.ok(c.items.some((i) => /showing/.test(i)));
});

test('the read-strategy measurement reports, and only calls a review when due', () => {
  const small = BD.readStrategy(new Array(633), { loadMs: 800, matchesPerMonth: 40 });
  assert.strictEqual(small.events, 633);
  assert.strictEqual(small.documentsPerSession, 633);
  assert.strictEqual(small.due, false);
  assert.ok(small.monthsUntilReview > 0);

  assert.strictEqual(BD.readStrategy(new Array(6000), {}).due, true, 'past the review point');
  assert.strictEqual(BD.readStrategy(new Array(100), { loadMs: 9000 }).due, true, 'slow enough to matter');
});

test('the reset survey finds exactly what the backfill does not own', async () => {
  const { plan } = plannedIds();
  const backend = Store.memoryBackend();
  for (const [c, docs] of Object.entries(plan)) {
    for (const d of docs) await backend.set(c, d.id, d);
  }
  assert.strictEqual((await survey(backend)).total, 0, 'a freshly seeded database has nothing extra');

  await backend.set(Store.COLLECTIONS.journey, '2026-09-18__Fatch__CLUB_RATING_REASSESSMENT',
    { id: '2026-09-18__Fatch__CLUB_RATING_REASSESSMENT', eventType: Engine.EVENT.CLUB_RATING_REASSESSMENT });
  const after = await survey(backend);
  assert.strictEqual(after.total, 1);
  assert.strictEqual(after.extras[Store.COLLECTIONS.journey][0].id, '2026-09-18__Fatch__CLUB_RATING_REASSESSMENT');
  // The seeded documents are untouched by the survey.
  assert.strictEqual(after.extras[Store.COLLECTIONS.players].length, 0);
  assert.strictEqual(after.extras[Store.COLLECTIONS.matches].length, 0);
});

test('every backend offers remove, and nothing in the UI calls it', async () => {
  const mem = Store.memoryBackend();
  await mem.set('players', 'X', { id: 'X' });
  await mem.remove('players', 'X');
  assert.deepStrictEqual(await mem.getAll('players'), []);

  const calls = [];
  const rest = Store.firestoreRestBackend({
    projectId: 'beta', fetchImpl: async (url, opts) => { calls.push(opts && opts.method); return { ok: true, async text() { return ''; } }; },
  });
  await rest.remove('players', 'X');
  assert.deepStrictEqual(calls, ['DELETE']);

  // The record is forward-only: a decision is undone by recording a reversal,
  // never by deleting. Only the reset script may delete. Matched against a
  // collection argument specifically -- the app is full of DOM .remove() calls,
  // and a blanket ban on the word would be a test that fails for the wrong
  // reason and gets weakened later.
  // Every application script -- app.js, shell.js and the extracted modules.
  const appSrc = require('./helpers/appSource.js').readAllAppSource();
  const deletesADocument = /\.remove\(\s*(RatingStore\.COLLECTIONS|['"`](players|matches|ratingJourney)['"`])/;
  assert.ok(!deletesADocument.test(appSrc), 'no screen may delete a document');
  // And the reset script, which may, does.
  const reset = fs.readFileSync(path.join(ROOT, 'scripts', 'moneypadel', 'reset-beta.js'), 'utf8');
  assert.ok(/backend\.remove\(/.test(reset));
});

test('the reset script cannot be pointed anywhere but the beta project', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'moneypadel', 'reset-beta.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(/PROJECT_ID/.test(code), 'it must use the beta project constant');
  assert.ok(!/projectId:\s*['"`]/.test(code), 'no literal project id may be passed');
  assert.ok(!/--project/.test(code), 'there must be no flag to redirect it');
  // Destroying data needs two flags, so it cannot be run by muscle memory.
  assert.ok(/--i-mean-it/.test(code) && /--write/.test(code));
  assert.ok(/write && confirmed/.test(code), 'both flags must be required together');
});

// The comparison report is the artefact most likely to be read by someone who
// was not here. It must not go stale silently, and it must not read as a
// reconciliation -- the two systems rate different matches with different
// engines, and presenting the differences as errors would be the most
// misleading thing in the repository.
test('the comparison report is truthful and still matches its generator', () => {
  const { build, report } = require('../scripts/moneypadel/comparison-report.js');
  const d = build();
  const text = report();

  // It leads with why the two are not supposed to agree.
  assert.match(text, /not supposed to agree/);
  assert.match(text, /a difference is not a defect/);
  // Known caveats, not buried.
  assert.match(text, /no join key/);
  assert.match(text, /go stale/);
  assert.match(text, /frozen snapshot/);
  // The dominant effect is named, not left for the reader to infer.
  assert.strictEqual(d.reseeded.length, 3);
  assert.deepStrictEqual(d.reseeded.map((r) => r.name).sort(), ['Fatch', 'Shaun', 'Tom']);
  const biggest = d.compared.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
  assert.deepStrictEqual(biggest.map((r) => r.name).sort(), ['Fatch', 'Shaun', 'Tom'],
    'the reseeded players should be the largest differences, which is the report\'s central claim');

  // Production figures are never an input.
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'moneypadel', 'comparison-report.js'), 'utf8');
  assert.ok(!/PRODUCTION_SNAPSHOT[\s\S]{0,200}buildWritePlan/.test(src));

  // The committed report is generated from the LIVE beta, which these tests
  // cannot reach, so it is not compared byte-for-byte against a baseline
  // regeneration. What is checked is that it says which basis it came from --
  // a report that did not would be quietly wrong now that club decisions
  // exist and the two bases differ materially.
  const committed = fs.readFileSync(path.join(ROOT, 'COMPARISON_REPORT.md'), 'utf8');
  assert.match(committed, /\*\*Basis: the live beta record\*\*/,
    'the committed report must be generated with --live and say so');
  assert.match(committed, /not supposed to agree/);
  assert.match(committed, /no join key/);
  // The seeded-differently players are a fact about seeding, not about the
  // current ratings, so they hold whichever basis was used.
  d.reseeded.forEach((r) => assert.ok(committed.includes(r.name)));

  // And the baseline generator still works, since it is the fallback when the
  // beta cannot be reached.
  assert.match(text, /\*\*Basis: the seeded baseline\*\*/);
});
