#!/usr/bin/env node
// Backfill the beta project from the authoritative match export.
//
//   node scripts/moneypadel/seed-beta.js                 # dry run, writes nothing
//   node scripts/moneypadel/seed-beta.js --manifest out.json
//   node scripts/moneypadel/seed-beta.js --limit 10      # preview a 10-document sample
//   node scripts/moneypadel/seed-beta.js --limit 10 --write   # smoke test: write only those 10
//   node scripts/moneypadel/seed-beta.js --write         # the full backfill
//
// Dry run is the default and is exhaustive: it prints every collection, every
// document count, and a sample document per collection, so what the write path
// would do is reviewable before anyone runs it.
//
// Input is the CSV-derived dataset ONLY. HISTORICAL_DISPLAY_MATCHES (the
// April/May block) is never read here and must never be.

const path = require('node:path');
const fs = require('node:fs');
const Engine = require('../../assets/js/ratingEngine.js');
const Store = require('../../assets/js/ratingStore.js');
const TierHistory = require('../../assets/js/tierHistory.js');
const D = require('../../tests/helpers/dataset.js');

// Money Padel's own project, from its settings (config/club.js): these scripts
// are Money Padel's and never write to another community.
const PROJECT_ID = require('../../assets/js/config/club.js').CLUBS.moneypadel.firebase.projectId;

function buildBackfill() {
  // Live v3 replay: the full export in canonical Match ID order, with the §5.3
  // historical classifications applied. Not the experiment tie-break -- that
  // exists only to prove engine equivalence against the published figures.
  const matches = D.loadAllMatches();
  const currentTiers = D.loadBaseTiers();
  const history = TierHistory.create({ currentTiers });

  const names = new Set();
  matches.forEach((m) => { m.teamA.forEach((n) => names.add(n)); m.teamB.forEach((n) => names.add(n)); });

  // A player is initialised on the date they enter the ledger -- the date of
  // their first match. Every journey event needs a real date to be placed
  // chronologically and to have a stable document id.
  const firstPlayed = {};
  [...matches].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sourceIndex - b.sourceIndex))
    .forEach((m) => {
      [...m.teamA, ...m.teamB].forEach((n) => { if (!firstPlayed[n]) firstPlayed[n] = m.date; });
    });

  const initialisations = [...names].sort().map((playerId) => ({
    playerId,
    tier: history.initialTiers[playerId] || 'B',
    classificationStatus: playerId === 'Shaun'
      ? Engine.CLASSIFICATION.PROVISIONAL
      : Engine.CLASSIFICATION.ESTABLISHED,
    effectiveDate: firstPlayed[playerId],
    reasonCode: playerId === 'Shaun' ? 'UNKNOWN_NEW_PLAYER' : null,
  }));

  const events = history.changes.map((c) => ({
    playerId: c.playerId,
    eventType: c.eventType,
    effectiveDate: c.effectiveDate,
    newTier: c.toTier,
    reasonCode: c.reasonCode || null,
    decisionType: 'historical backfill',
    source: 'Money Padel Prestige v3 specification §5.3',
    createdBy: 'seed-beta',
  }));

  const replay = Engine.replay({ matches, initialisations, events });
  // Fixed, not read from the clock, so the plan is byte-identical run to run.
  const provenance = {
    createdBy: 'seed-beta',
    recordedAt: '2026-09-16T00:00:00Z',
    source: 'backfill from money_padel_matches_2026-09-16.csv',
  };
  return { matches, replay, history, provenance };
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const manifestAt = args.includes('--manifest') ? args[args.indexOf('--manifest') + 1] : null;
  const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : null;
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    console.error('--limit needs a positive whole number.');
    process.exitCode = 1;
    return;
  }

  const { matches, replay, provenance } = buildBackfill();
  const fullPlan = Store.buildWritePlan({ matches, journey: replay.journey, state: replay.state, provenance });
  const plan = limit === null ? fullPlan : Store.limitPlan(fullPlan, limit);
  const summary = Store.summarisePlan(plan);

  console.log('Money Padel v3 backfill — ' + (write ? 'WRITE' : 'DRY RUN (nothing will be written)')
    + (limit === null ? '' : ` — SAMPLE, capped at ${limit} documents`));
  console.log('  project        :', PROJECT_ID);
  console.log('  engine version :', Engine.RATING_MODEL_VERSION);
  console.log('  schema version :', Store.SCHEMA_VERSION);
  console.log('  source         : tests/fixtures/money_padel_matches_2026-09-16.csv');
  console.log('  matches read   :', matches.length,
    `(${matches.filter((m) => m.outcome === Engine.OUTCOME.DRAW).length} draws)`);
  console.log('\nDocuments to write:');
  Object.entries(summary.collections).forEach(([c, n]) => console.log(`  ${c.padEnd(14)} ${String(n).padStart(5)}`));
  console.log('  ' + '-'.repeat(20));
  console.log('  TOTAL          '.padEnd(16) + String(summary.totalDocuments).padStart(5),
    `(~${Math.round(summary.approximateBytes / 1024)} KB)`);
  console.log('\nJourney events by type:');
  Object.entries(summary.journeyByEventType).sort().forEach(([t, n]) => console.log(`  ${t.padEnd(36)} ${String(n).padStart(5)}`));

  console.log('\nSample document per collection:');
  Object.entries(plan).forEach(([c, docs]) => {
    console.log(`\n  --- ${c}/${docs[0].id}`);
    console.log('  ' + JSON.stringify(docs[0], null, 2).split('\n').join('\n  '));
  });

  const players = plan[Store.COLLECTIONS.players];
  console.log(`\nPlayers written: ${players.length}`);
  console.log('  top 5 by rating: ' + [...players].sort((a, b) => b.rating - a.rating).slice(0, 5)
    .map((p) => `${p.id} ${p.rating.toFixed(1)}`).join(', '));

  if (manifestAt) {
    fs.writeFileSync(path.resolve(manifestAt), JSON.stringify(plan, null, 2));
    console.log('\nFull manifest written to ' + manifestAt);
  }

  if (limit !== null) {
    const full = Store.summarisePlan(fullPlan).totalDocuments;
    console.log(`\nThis is a SAMPLE of ${summary.totalDocuments} of ${full} documents. It leaves the`);
    console.log('database deliberately incomplete. Document ids are deterministic, so the');
    console.log('full seed overwrites these same documents -- there is nothing to clean up.');
  }

  if (!write) {
    console.log('\nNothing was written. Re-run with --write to apply.');
    return;
  }

  const backend = Store.firestoreRestBackend({ projectId: PROJECT_ID });
  console.log('\nWriting to ' + backend.name + ' ...');
  Store.writePlan(backend, plan, {
    onProgress: (n) => { if (n % 100 === 0) process.stdout.write(`  ${n} documents\r`); },
  }).then((n) => console.log(`\nDone. ${n} documents written.`))
    .catch((e) => { console.error('\nWrite failed:', e.message); process.exitCode = 1; });
}

if (require.main === module) main();
module.exports = { buildBackfill, PROJECT_ID };
