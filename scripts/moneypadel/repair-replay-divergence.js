#!/usr/bin/env node
// Bring the record back into agreement with its own history.
//
//   node scripts/moneypadel/repair-replay-divergence.js            # dry run
//   node scripts/moneypadel/repair-replay-divergence.js --write
//
// Dry run is the default and writes nothing.
//
// WHAT THIS IS FOR. Every rating in the record is derived from the stored
// matches by replaying them in order. If the stored ratings and the stored
// history ever stop agreeing, the app refuses to plan any further edit -- it
// will not build a change on top of numbers the history does not support. That
// refusal is correct, and it is also a dead end: nothing in the app can clear
// it.
//
// The failure it was written for: a replay that wrote part of its output and
// stopped. Before writes were batched, one removal sent ~500 documents one at a
// time; closing the app part-way through left the earlier documents rewritten
// and the later ones holding pre-change values. The record is not corrupt --
// every match is intact -- but the derived numbers are half-finished.
//
// WHAT IT DOES NOT DO. It changes no match, adds none, removes none. The
// matches are the record. This only finishes the arithmetic that hangs off
// them, so its result is whatever the record already implies. It is write-only
// by design: if the repair would need to DELETE a document, that is not a
// partial write, and it stops and says so instead.
//
// Idempotent. Run it on a healthy record and it reports nothing to do.

const Store = require('../../assets/js/ratingStore.js');
const Replay = require('../../assets/js/replayForward.js');
const Diagnostics = require('../../assets/js/betaDiagnostics.js');
const { PROJECT_ID } = require('./seed-beta.js');

const WRITE = process.argv.includes('--write');

function backendFor() {
  return Store.firestoreRestBackend({ projectId: PROJECT_ID });
}

// The journey is the expensive read and the one that gets rate limited. A 429
// is a wait, not a failure.
async function read(backend, collection) {
  for (let attempt = 1; ; attempt++) {
    try { return await backend.getAll(collection); } catch (e) {
      if (!/\b429\b/.test(e.message) || attempt >= 6) throw e;
      const waitMs = 2000 * attempt;
      console.log(`  ${collection}: rate limited, retrying in ${waitMs / 1000}s`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

async function readRecord(backend) {
  const players = await read(backend, Store.COLLECTIONS.players);
  const matches = await read(backend, Store.COLLECTIONS.matches);
  const journey = await read(backend, Store.COLLECTIONS.journey);
  return { players, matches, journey };
}

function describe(stored, repair, check) {
  console.log('');
  console.log(`Record: ${stored.matches.length} matches · ${stored.journey.length} journey events · ${stored.players.length} players`);
  console.log(`Replaying it unchanged disagrees in ${check.count} place(s).`);
  console.log('');

  if (!repair.documentsToWrite) {
    console.log('Nothing to repair: the stored state already matches a replay of the stored history.');
    return;
  }

  Object.entries(repair.staleByCollection).forEach(([collection, n]) => {
    if (n) console.log(`  ${collection}: ${n} document(s) hold values the history does not produce`);
  });

  const journeyDocs = repair.writes[Store.COLLECTIONS.journey] || [];
  if (journeyDocs.length) {
    const dates = journeyDocs.map((d) => d.effectiveDate).sort();
    console.log(`  affected dates: ${dates[0]} → ${dates[dates.length - 1]}`);
    const stale = new Set(journeyDocs.map((d) => d.id));
    const untouched = stored.journey.filter((d) => !stale.has(d.id) && d.effectiveDate >= dates[0]).length;
    console.log(`  events on or after ${dates[0]} that are already correct: ${untouched}`);
  }

  console.log('');
  console.log(`${repair.playersMoved.length} player(s) end on a different rating:`);
  repair.playersMoved.forEach((m) => {
    const d = m.delta === null ? 'new' : (m.delta > 0 ? '+' : '') + m.delta;
    console.log(`  ${m.playerId.padEnd(12)} ${String(d).padStart(5)} → ${Math.round(m.to * 10) / 10}`
      + (m.from === null ? '' : `   (currently ${Math.round(m.from * 10) / 10})`));
  });

  console.log('');
  console.log(`${repair.documentsToWrite} document(s) would be written. None deleted.`);
}

(async () => {
  const backend = backendFor();
  console.log(`Reading ${PROJECT_ID} ...`);
  const stored = await readRecord(backend);

  const check = Replay.verifyNoOp(stored, {});
  const repair = Replay.planRepair(stored, {});
  describe(stored, repair, check);

  if (repair.wouldDelete.length) {
    console.error('');
    console.error('STOPPING. The repair would remove documents, which a partial write cannot explain:');
    repair.wouldDelete.slice(0, 20).forEach((id) => console.error('  ' + id));
    console.error('Look at this by hand rather than writing.');
    process.exitCode = 1;
    return;
  }

  if (!repair.documentsToWrite) return;

  if (!WRITE) {
    console.log('');
    console.log('Dry run. Nothing was written. Re-run with --write to apply.');
    return;
  }

  console.log('');
  console.log('Writing ...');
  const result = await Replay.commit(backend, repair, {
    onProgress: (done, total) => { if (done === total || done % 50 === 0) console.log(`  ${done} / ${total}`); },
  });
  console.log(`Wrote ${result.written}, deleted ${result.deleted}.`);

  console.log('');
  console.log('Re-reading and verifying ...');
  const after = await readRecord(backend);
  const verify = Replay.verifyNoOp(after, {});
  console.log(`  replay-to-self differences: ${verify.count}`);
  const players = {};
  after.players.forEach((p) => { players[p.id] = p; });
  const report = Diagnostics.run({ players, matches: after.matches, journey: after.journey });
  const failed = report.checks.filter((c) => c.status === 'fail');
  console.log(`  diagnostics: ${report.checks.length - failed.length} / ${report.checks.length} passing`);
  failed.forEach((c) => console.log(`    FAIL ${c.name}: ${c.detail || ''}`));
  if (verify.count || failed.length) {
    console.error('The record still does not verify. Do not use the app until this is understood.');
    process.exitCode = 1;
  } else {
    console.log('');
    console.log('The record replays to itself and diagnostics pass.');
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exitCode = 1; });
