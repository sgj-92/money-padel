// Tests for the production match-facts importer.
//
// The importer's job is to be safe to run twice, to refuse rather than guess,
// and to preserve exactly what production recorded. These check those three
// things against the real export rather than a toy fixture.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const I = require('../scripts/moneypadel/import-production-matches.js');
const Store = require('../assets/js/ratingStore.js');
const Engine = require('../assets/js/ratingEngine.js');
const D = require('./helpers/dataset.js');

// The v3 record as the seed builds it: the same 150 rated matches the beta
// holds, without needing the network.
function storedMatchDocs() {
  return D.loadAllMatches().map(Store.toMatchDoc);
}

const EXPORT_FIXTURE = path.join(__dirname, 'fixtures', 'production-matches-export.json');
const haveExport = fs.existsSync(EXPORT_FIXTURE);
const skip = haveExport ? false : 'the production export fixture is not present';
const load = () => JSON.parse(fs.readFileSync(EXPORT_FIXTURE, 'utf8')).map(I.normaliseExportRecord);

test('identity ignores which side each system happened to store first', () => {
  const a = I.factsKey('2026-06-02', ['Rishi', 'Jords'], ['Tarique', 'Harry'],
    [[4, 6], [6, 3], [7, 5]], Engine.OUTCOME.A_WINS);
  // The same match, recorded from the other side: sides swapped, sets flipped,
  // and the outcome expressed as a win for the side now listed second.
  const b = I.factsKey('2026-06-02', ['Harry', 'Tarique'], ['Jords', 'Rishi'],
    [[6, 4], [3, 6], [5, 7]], Engine.OUTCOME.B_WINS);
  assert.strictEqual(a, b);
});

test('identity separates the same four players playing twice on one day', () => {
  const first = I.factsKey('2026-06-07', ['Stormzy', 'Len'], ['Rishi', 'Antz'],
    [[6, 3], [6, 0]], Engine.OUTCOME.A_WINS);
  const second = I.factsKey('2026-06-07', ['Rishi', 'Antz'], ['Stormzy', 'Len'],
    [[7, 6], [4, 6], [6, 3]], Engine.OUTCOME.A_WINS);
  assert.notStrictEqual(first, second, 'a rematch must not collapse into its first leg');
});

// A reversed result on the same fixture is a different match, not a conflict:
// both sides won once.
test('the same fixture with the result reversed is two distinct matches', () => {
  const won = I.factsKey('2026-04-30', ['Alfie', 'Manny'], ['Kaz', 'Twoshay'],
    [[6, 4], [6, 4]], Engine.OUTCOME.A_WINS);
  const lost = I.factsKey('2026-04-30', ['Kaz', 'Twoshay'], ['Alfie', 'Manny'],
    [[4, 6], [4, 6]], Engine.OUTCOME.A_WINS);
  assert.notStrictEqual(won, lost);
});

test('a decided match is never re-read from the orientation of its score', () => {
  // Production records this as a win for the first-listed side although that
  // side took fewer games. Reading the winner off the score would invert it.
  const r = I.normaliseExportRecord({
    matchId: 'base_0', date: '2026-07-02', type: 'doubles',
    team1Players: ['Len', 'Eli'], team2Players: ['Shaun', 'Osh'],
    sets: [[0, 6], [6, 3], [6, 4]], winner: 'team1', status: null,
  }, 0);
  assert.strictEqual(r.outcome, Engine.OUTCOME.A_WINS);
  const games = r.sets.reduce((acc, s) => [acc[0] + s[0], acc[1] + s[1]], [0, 0]);
  assert.ok(games[0] < games[1], 'this is the case under test: the winner took fewer games');

  const m = I.toV3Match(r, 1);
  assert.strictEqual(m.outcome, Engine.OUTCOME.A_WINS);
  assert.deepStrictEqual(m.teamA, ['Len', 'Eli'], 'team1 becomes team A unchanged');
  assert.deepStrictEqual(m.sets, [[0, 6], [6, 3], [6, 4]], 'the score arrays are carried across as stored');
});

test('a draw is carried across as a draw, with its side assignment marked arbitrary', () => {
  const r = I.normaliseExportRecord({
    matchId: 'sub_x', date: '2026-09-17', type: 'doubles',
    team1Players: ['Eli', 'Len'], team2Players: ['Kaz', 'Rishi'],
    sets: [[4, 6], [6, 3]], winner: 'draw', status: 'approved',
  }, 0);
  assert.strictEqual(r.outcome, Engine.OUTCOME.DRAW);
  const m = I.toV3Match(r, 1);
  assert.strictEqual(m.outcome, Engine.OUTCOME.DRAW);
  assert.strictEqual(m.drawSideAssignmentArbitrary, true);
});

test('an unrecognised winner flag is a problem, never a guess', () => {
  const r = I.normaliseExportRecord({
    matchId: 'x', date: '2026-09-17', team1Players: ['A', 'B'], team2Players: ['C', 'D'],
    sets: [[6, 0]], winner: 'whoever',
  }, 0);
  assert.strictEqual(r.outcome, null);
  assert.ok(r.problems.some((p) => /winner/.test(p)));
});

// `team2` does not occur in the export seen so far. It is still read correctly,
// so a later export that uses it cannot be misfiled as a team1 win.
test('a team2 win is read as a team2 win', () => {
  const r = I.normaliseExportRecord({
    matchId: 'x', date: '2026-09-17', team1Players: ['A', 'B'], team2Players: ['C', 'D'],
    sets: [[2, 6]], winner: 'team2',
  }, 0);
  assert.strictEqual(r.outcome, Engine.OUTCOME.B_WINS);
  assert.deepStrictEqual(r.problems, []);
});

test('new match ids continue their own date\'s sequence', () => {
  const docs = [
    { id: '2026-09-16-1', date: '2026-09-16' },
    { id: '2026-09-16-2', date: '2026-09-16' },
    { id: '2026-09-15-9', date: '2026-09-15' },
  ];
  const next = I.nextIndexes(docs);
  assert.strictEqual(next['2026-09-16'], 2);
  assert.strictEqual(next['2026-09-15'], 9);
  assert.strictEqual(next['2026-09-17'], undefined, 'a date with no matches starts from nothing');
});

test('the whole export deduplicates against the seeded record', { skip }, () => {
  const exported = load().filter((r) => r.date >= I.RATING_EPOCH);
  const stored = storedMatchDocs();
  const r = I.compare(exported, stored);

  assert.strictEqual(r.conflicts.length, 0, 'the two systems must agree on every shared fixture');
  assert.strictEqual(r.alreadyPresent.length, stored.length,
    'every stored match should be found in the export');
  assert.strictEqual(r.onlyInV3.length, 0);
  assert.strictEqual(r.alreadyPresent.length + r.brandNew.length, exported.length,
    'every eligible export record is either present or new — nothing may be dropped');

  // Each stored match is claimed at most once.
  const claimed = r.alreadyPresent.map((p) => p.stored.id);
  assert.strictEqual(new Set(claimed).size, claimed.length, 'a stored match was paired twice');
});

test('pre-June records are never eligible for the rating record', { skip }, () => {
  const all = load();
  const pre = all.filter((r) => r.date < I.RATING_EPOCH);
  assert.ok(pre.length > 0, 'the export under test carries pre-June rows');
  const eligible = all.filter((r) => r.date >= I.RATING_EPOCH);
  assert.ok(eligible.every((r) => r.date >= '2026-06-01'));
  // And none of them would ever be offered as new, because they never reach compare.
  const r = I.compare(eligible, storedMatchDocs());
  assert.ok(r.brandNew.every((m) => m.date >= I.RATING_EPOCH));
});

// The point of the whole exercise: running it again must find nothing to do.
test('the import is idempotent — a second run finds no new matches', { skip }, () => {
  const exported = load().filter((r) => r.date >= I.RATING_EPOCH);
  const stored = storedMatchDocs();

  const first = I.compare(exported, stored);
  assert.ok(first.brandNew.length > 0, 'the fixture must actually have something to import');

  // Apply the import the way the script would, then compare again.
  const next = I.nextIndexes(stored);
  const appended = [...first.brandNew]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.index - b.index))
    .map((r) => {
      next[r.date] = (next[r.date] || 0) + 1;
      return Store.toMatchDoc(I.toV3Match(r, next[r.date]));
    });
  assert.strictEqual(new Set(appended.map((d) => d.id)).size, appended.length, 'ids must be unique');

  const second = I.compare(exported, stored.concat(appended));
  assert.strictEqual(second.brandNew.length, 0, 'a second run must import nothing');
  assert.strictEqual(second.conflicts.length, 0);
  assert.strictEqual(second.onlyInV3.length, 0);
  assert.strictEqual(second.alreadyPresent.length, exported.length);
});

// The conflict rule exists so a changed score is never appended as if it were a
// different match, and never silently overwrites what is stored.
test('a changed score on an existing fixture is reported as a conflict', () => {
  const stored = [Store.toMatchDoc({
    id: '2026-06-02-1', sourceIndex: 1, date: '2026-06-02',
    teamA: ['Rishi', 'Jords'], teamB: ['Tarique', 'Harry'],
    sets: [[4, 6], [6, 3], [7, 5]], outcome: Engine.OUTCOME.A_WINS,
    type: 'doubles', drawSideAssignmentArbitrary: false,
  })];
  const exported = [I.normaliseExportRecord({
    matchId: 'base_79', date: '2026-06-02', type: 'doubles',
    team1Players: ['Rishi', 'Jords'], team2Players: ['Tarique', 'Harry'],
    sets: [[4, 6], [6, 3], [7, 6]], winner: 'team1', status: null,   // last set differs
  }, 0)];

  const r = I.compare(exported, stored);
  assert.strictEqual(r.conflicts.length, 1, 'a differing score must conflict, not append');
  assert.strictEqual(r.brandNew.length, 0);
  assert.strictEqual(r.alreadyPresent.length, 0);
  assert.strictEqual(r.conflicts[0].stored.id, '2026-06-02-1');
  assert.strictEqual(r.conflicts[0].exported.productionId, 'base_79');
});

test('a changed winner on an existing fixture is reported as a conflict', () => {
  const stored = [Store.toMatchDoc({
    id: '2026-06-02-1', sourceIndex: 1, date: '2026-06-02',
    teamA: ['Rishi', 'Jords'], teamB: ['Tarique', 'Harry'],
    sets: [[6, 4], [6, 3]], outcome: Engine.OUTCOME.A_WINS,
    type: 'doubles', drawSideAssignmentArbitrary: false,
  })];
  const exported = [I.normaliseExportRecord({
    matchId: 'base_79', date: '2026-06-02', type: 'doubles',
    team1Players: ['Rishi', 'Jords'], team2Players: ['Tarique', 'Harry'],
    sets: [[6, 4], [6, 3]], winner: 'draw', status: null,
  }, 0)];

  const r = I.compare(exported, stored);
  assert.strictEqual(r.conflicts.length, 1, 'a differing outcome must conflict');
  assert.strictEqual(r.brandNew.length, 0);
});
