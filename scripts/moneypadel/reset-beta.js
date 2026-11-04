#!/usr/bin/env node
// Return the beta project to the seeded baseline.
//
//   node scripts/moneypadel/reset-beta.js                          # dry run (default)
//   node scripts/moneypadel/reset-beta.js --write --i-mean-it      # actually do it
//
// WHAT THIS IS FOR. The seed overwrites documents by deterministic id, so
// re-running it restores anything it owns. What it CANNOT do is remove
// documents it does not own -- club decisions recorded through the Admin
// Monthly Review, or anything left behind by an experiment. Those survive a
// re-seed and keep affecting ratings. This removes them.
//
// WHAT IT DESTROYS. Every club decision ever recorded, and the player state
// that followed from it. That is the point, and it is not recoverable from
// inside the application: the record is forward-only and has no undo, so the
// only way back to the baseline is to delete. The dry run prints every
// document it would delete, by id, before anything happens.
//
// WHY TWO FLAGS. --write alone is the flag every other script in this project
// uses for something harmless. This one also requires --i-mean-it, so it can
// never be run by muscle memory or by copying a seed command.
//
// IT CANNOT REACH PRODUCTION. The project id is the beta constant imported
// from the seed script. There is no flag to point it anywhere else, and no
// production credentials exist in this repository.

const Engine = require('../../assets/js/ratingEngine.js');
const Store = require('../../assets/js/ratingStore.js');
const Diagnostics = require('../../assets/js/betaDiagnostics.js');
const { buildBackfill, PROJECT_ID } = require('./seed-beta.js');

function plannedIds() {
  const { matches, replay, provenance } = buildBackfill();
  const plan = Store.buildWritePlan({ matches, journey: replay.journey, state: replay.state, provenance });
  const ids = {};
  Object.entries(plan).forEach(([collection, docs]) => {
    ids[collection] = new Set(docs.map((d) => d.id));
  });
  return { plan, ids };
}

// Everything stored that the backfill does not own. Classified rather than
// merely counted, because "3 extra documents" and "3 club decisions that moved
// two players' ratings" deserve different amounts of hesitation.
async function survey(backend) {
  const { plan, ids } = plannedIds();
  const extras = {};
  let total = 0;
  for (const collection of Object.values(Store.COLLECTIONS)) {
    const stored = await backend.getAll(collection);
    const list = stored.filter((d) => d && d.id && !ids[collection].has(d.id));
    extras[collection] = list;
    total += list.length;
  }
  return { plan, extras, total };
}

function describeExtra(collection, doc) {
  if (collection !== Store.COLLECTIONS.journey) return doc.id;
  const moved = (typeof doc.previousPowerRating === 'number' && typeof doc.newPowerRating === 'number')
    ? ` ${doc.previousPowerRating.toFixed(1)} → ${doc.newPowerRating.toFixed(1)}`
    : '';
  return `${doc.id}  [${doc.eventType}${moved}, by ${doc.createdBy || 'unknown'}]`;
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const confirmed = args.includes('--i-mean-it');

  const backend = Store.firestoreRestBackend({ projectId: PROJECT_ID });
  console.log('Money Padel v3 beta reset — ' + (write && confirmed ? 'WRITE' : 'DRY RUN (nothing will change)'));
  console.log('  project : ' + PROJECT_ID + '   (beta only — there is no way to point this at production)');
  console.log('  engine  : ' + Engine.RATING_MODEL_VERSION + ' / schema ' + Store.SCHEMA_VERSION);

  let s;
  try {
    s = await survey(backend);
  } catch (e) {
    console.error('\nCould not read the beta database: ' + e.message);
    console.error('Nothing was changed.');
    process.exitCode = 1;
    return;
  }

  console.log('\nDocuments the backfill owns and will rewrite:');
  Object.entries(s.plan).forEach(([c, docs]) => console.log(`  ${c.padEnd(14)} ${String(docs.length).padStart(5)}`));

  console.log(`\nDocuments it does NOT own, which will be DELETED: ${s.total}`);
  if (s.total === 0) {
    console.log('  (none — the database already matches the baseline)');
  } else {
    Object.entries(s.extras).forEach(([c, docs]) => {
      if (!docs.length) return;
      console.log(`  ${c}:`);
      docs.forEach((d) => console.log('    ' + describeExtra(c, d)));
    });
  }

  if (!write || !confirmed) {
    console.log('\nNothing was changed.');
    if (write && !confirmed) console.log('--write was given without --i-mean-it. Both are required.');
    else console.log('To apply: node scripts/moneypadel/reset-beta.js --write --i-mean-it');
    return;
  }

  console.log('\nDeleting ...');
  let deleted = 0;
  for (const [collection, docs] of Object.entries(s.extras)) {
    for (const d of docs) {
      await backend.remove(collection, d.id);
      deleted++;
    }
  }
  console.log(`  ${deleted} deleted.`);

  console.log('Rewriting the baseline ...');
  const written = await Store.writePlan(backend, s.plan, {
    onProgress: (n) => { if (n % 100 === 0) process.stdout.write(`  ${n} documents\r`); },
  });
  console.log(`\n  ${written} written.`);

  // A reset that says "done" without checking is just a hope. Read it back.
  console.log('\nVerifying ...');
  const players = {}, journey = [], matches = [];
  (await backend.getAll(Store.COLLECTIONS.players)).forEach((d) => { players[d.id] = d; });
  (await backend.getAll(Store.COLLECTIONS.journey)).forEach((d) => journey.push(d));
  (await backend.getAll(Store.COLLECTIONS.matches)).forEach((d) => matches.push(d));
  const report = Diagnostics.run({ players, matches, journey });
  report.checks.forEach((c) => console.log(`  ${c.status.toUpperCase().padEnd(5)} ${c.name} — ${c.detail}`));
  const after = await survey(backend);
  console.log(`  ${after.total === 0 ? 'OK   ' : 'FAIL '} Nothing outside the baseline remains — ${after.total} extra document(s)`);

  if (!report.healthy || after.total !== 0) {
    console.error('\nThe reset finished but the database does not check out. Do not use the beta until this is understood.');
    process.exitCode = 1;
    return;
  }
  console.log('\nDone. The beta is back to the seeded baseline.');
}

if (require.main === module) main();
module.exports = { survey, plannedIds };
