#!/usr/bin/env node
// Apply the three historical club decisions Shaun authorised on 18 Sep 2026.
//
//   node scripts/moneypadel/apply-historical-decisions.js            # dry run (default)
//   node scripts/moneypadel/apply-historical-decisions.js --write    # apply to the beta
//
// Two of the three anchors are not literals — they are resolved from the record
// at a specific moment, and the moment matters:
//
//   * Shaun, 1 Jul — initial classification correction to 1400 at 10%.
//   * Tom, 1 Jul — club override to JORDS' rating immediately before the 1 Jul
//     review, at 10%. Drawn from the SHARED 1 Jul pre-review snapshot, so
//     processing Shaun first cannot move it. That is the whole reason the
//     shared-snapshot rule exists.
//   * Fatch, 1 Aug — club override to TOM's rating immediately before the
//     1 Aug review, at 10%. This one must be resolved AFTER Shaun and Tom are
//     applied and July has been replayed, because it depends on Tom's corrected
//     July trajectory. Resolving all three up front would anchor Fatch to a Tom
//     who no longer exists.
//
// So this runs in two passes with a replay between them. Everything goes
// through the audited Historical Club Adjustment path: nothing is deleted, and
// each decision supersedes the one it replaces.

const Store = require('../../assets/js/ratingStore.js');
const Review = require('../../assets/js/monthlyReview.js');
const HA = require('../../assets/js/historicalAdjustment.js');
const RF = require('../../assets/js/replayForward.js');
const BD = require('../../assets/js/betaDiagnostics.js');
const { PROJECT_ID } = require('./seed-beta.js');

const RELIABILITY = 0.10; // board decision: reopen all three so the model can move them quickly
const BOARD = 'Shaun (board decision, 18 Sep 2026)';

function f1(v) { return v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toFixed(1); }

async function read(backend) {
  const [matches, journey, players] = await Promise.all([
    backend.getAll(Store.COLLECTIONS.matches),
    backend.getAll(Store.COLLECTIONS.journey),
    backend.getAll(Store.COLLECTIONS.players),
  ]);
  return { matches, journey, players };
}

// The rating a named player carried into a given date, from that date's
// pre-review snapshot. This is what "immediately before the review" means, and
// it is read back rather than recomputed.
function anchorFrom(journey, date, anchorPlayer) {
  const snap = Review.preReviewSnapshot(journey, date);
  const s = snap[anchorPlayer];
  if (!s) throw new Error(`${anchorPlayer} has no recorded state before ${date}, so there is no anchor to use.`);
  return { rating: s.rating, asOf: s.asOfDate, tier: s.tier };
}

function planFor(stored, adjustment, provenance) {
  return HA.plan({ stored, adjustment, provenance });
}

// SUPERSEDED, 20 Sep 2026. Tom's and Fatch's anchors here were replaced by the
// Tier B baseline of 1400 at 20% (`4bbda90`, via
// scripts/moneypadel/correct-tom-fatch-anchors.js). Running this with --write would
// re-apply the comparator anchors the board has since rejected, and because it
// plans against whatever is in the record it would do so without complaint.
//
// Kept because it is the record of how the 18 September decisions were applied,
// and because its two-pass anchor resolution is the worked example of the
// shared-snapshot rule. It refuses to write.
const SUPERSEDED_NOTE =
  'This script applies the 18 Sep 2026 anchors, two of which the board has since superseded:\n'
  + '  Tom   1 Jul — was Jords\' rating (1352.5) @ 10%, now the Tier B baseline 1400 @ 20%\n'
  + '  Fatch 1 Aug — was Tom\'s rating (1358.6) @ 10%, now the Tier B baseline 1400 @ 20%\n'
  + 'Applying it would undo that correction. Use scripts/moneypadel/correct-tom-fatch-anchors.js instead.\n'
  + 'Dry run still works, as a record of what was done.';

async function main() {
  const write = process.argv.includes('--write');
  if (write) {
    console.error('REFUSING TO WRITE.\n\n' + SUPERSEDED_NOTE);
    process.exitCode = 1;
    return;
  }
  const backend = Store.firestoreCompatBackend
    ? Store.firestoreRestBackend({ projectId: PROJECT_ID })
    : null;
  console.log('SUPERSEDED — for reference only.\n' + SUPERSEDED_NOTE + '\n');
  console.log(`Historical club decisions — ${write ? 'WRITE' : 'DRY RUN (nothing will change)'}`);
  console.log('  project: ' + PROJECT_ID);
  console.log('  reliability for all three: ' + Math.round(RELIABILITY * 100) + '% (board decision)');

  let stored = await read(backend);
  console.log(`  record: ${stored.matches.length} matches, ${stored.journey.length} journey events, ${stored.players.length} players`);

  const noop = RF.verifyNoOp(stored, {});
  console.log(`  replays to itself: ${noop.identical ? 'yes' : 'NO — ' + noop.count + ' differences'}`);
  if (!noop.identical) {
    console.error('\nThe record does not replay to itself. Nothing will be applied.');
    noop.differences.slice(0, 10).forEach((d) => console.error('  - ' + d));
    process.exitCode = 1;
    return;
  }

  // ---- Pass 1: Shaun and Tom, both effective 1 July, one shared snapshot ----
  const jords = anchorFrom(stored.journey, '2026-07-01', 'Jords');
  console.log(`\nPass 1 — 1 Jul 2026 (shared pre-review snapshot)`);
  console.log(`  Jords' rating immediately before the review: ${f1(jords.rating)} (as of ${jords.asOf}, Tier ${jords.tier})`);

  const pass1 = [
    {
      label: 'Shaun — initial classification correction',
      adjustment: {
        playerId: 'Shaun', effectiveDate: '2026-07-01', tierEvent: 'PROMOTION', newTier: 'B',
        ratingDecision: Review.DECISION.CORRECT_INITIAL_CLASSIFICATION,
        correctedRating: 1400, correctedReliability: RELIABILITY,
        reason: 'Board: entered Tier C only as an unknown; the initial estimate was wrong. Normal B baseline, reliability reopened to 10%.',
        createdBy: BOARD,
      },
    },
    {
      label: `Tom — promotion + club override to Jords' pre-review rating`,
      adjustment: {
        playerId: 'Tom', effectiveDate: '2026-07-01', tierEvent: 'PROMOTION', newTier: 'B',
        ratingDecision: Review.DECISION.CLUB_OVERRIDE,
        overrideRating: jords.rating, overrideReliability: RELIABILITY,
        reason: `Board: genuine C to B promotion. Club override anchored to Jords' Power Rating immediately before this review (${f1(jords.rating)}), reliability reopened to 10%. Not a statistical recommendation — none was available.`,
        createdBy: BOARD,
      },
    },
  ];

  for (const step of pass1) {
    const p = planFor(stored, step.adjustment, { createdBy: BOARD, recordedAt: new Date().toISOString(), source: 'Historical Club Adjustment' });
    console.log(`\n  ${step.label}`);
    console.log(`    ${p.summary}`);
    console.log(`    events: ${p.events.map((e) => e.eventType + (e.supersedes ? ` (supersedes ${e.supersedes}, r${e.revision})` : '')).join('; ')}`);
    console.log(`    ${p.documentsToWrite} documents rewritten, ${p.documentsToDelete} removed, ${p.playersMoved.length} players re-derived`);
    if (write) {
      await RF.commit(backend, p);
      stored = await read(backend);
      console.log('    applied.');
    } else {
      // Keep planning against the un-applied record, but note that the next
      // plan in a dry run cannot see this one.
      console.log('    (dry run — not applied)');
    }
  }

  if (!write) {
    console.log('\nPass 2 cannot be resolved in a dry run: Fatch is anchored to Tom AFTER');
    console.log("Tom's corrected July has been replayed, which has not happened here.");
    console.log("Tom's anchor today, for reference only:");
    const tomNow = anchorFrom(stored.journey, '2026-08-01', 'Tom');
    console.log(`  Tom immediately before 1 Aug on the CURRENT record: ${f1(tomNow.rating)} (as of ${tomNow.asOf})`);
    console.log('\nNothing was changed. Re-run with --write to apply.');
    return;
  }

  // ---- Pass 2: Fatch, resolved only now that July has been replayed ----
  const tom = anchorFrom(stored.journey, '2026-08-01', 'Tom');
  console.log(`\nPass 2 — 1 Aug 2026`);
  console.log(`  Tom's rating immediately before the review, after his corrected July: ${f1(tom.rating)} (as of ${tom.asOf}, Tier ${tom.tier})`);

  const fatch = {
    playerId: 'Fatch', effectiveDate: '2026-08-01', tierEvent: 'PROMOTION', newTier: 'B',
    ratingDecision: Review.DECISION.CLUB_OVERRIDE,
    overrideRating: tom.rating, overrideReliability: RELIABILITY,
    reason: `Board: genuine C to B promotion. Club override anchored to Tom's Power Rating immediately before this review after his corrected July trajectory (${f1(tom.rating)}), reliability reopened to 10%. Not a statistical recommendation — none was available.`,
    createdBy: BOARD,
  };
  const p3 = planFor(stored, fatch, { createdBy: BOARD, recordedAt: new Date().toISOString(), source: 'Historical Club Adjustment' });
  console.log(`\n  Fatch — promotion + club override to Tom's pre-review rating`);
  console.log(`    ${p3.summary}`);
  console.log(`    events: ${p3.events.map((e) => e.eventType + (e.supersedes ? ` (supersedes ${e.supersedes}, r${e.revision})` : '')).join('; ')}`);
  console.log(`    ${p3.documentsToWrite} documents rewritten, ${p3.documentsToDelete} removed, ${p3.playersMoved.length} players re-derived`);
  await RF.commit(backend, p3);
  stored = await read(backend);
  console.log('    applied.');

  // ---- Verify ----
  console.log('\nVerifying ...');
  const players = {};
  stored.players.forEach((d) => { players[d.id] = d; });
  const report = BD.run({ players, matches: stored.matches, journey: stored.journey });
  report.checks.forEach((c) => console.log(`  ${c.status.toUpperCase().padEnd(5)} ${c.name} — ${c.detail}`));
  const after = RF.verifyNoOp(stored, {});
  console.log(`  ${after.identical ? 'OK   ' : 'FAIL '} The record still replays to itself — ${after.count} difference(s)`);

  console.log('\nResolved anchors and resulting current ratings:');
  console.log(`  Shaun  1 Jul: corrected to 1400.0 at 10%  →  now ${f1(players.Shaun.rating)} (reliability ${Math.round(players.Shaun.reliability * 100)}%)`);
  console.log(`  Tom    1 Jul: override to ${f1(jords.rating)} at 10%  →  now ${f1(players.Tom.rating)} (reliability ${Math.round(players.Tom.reliability * 100)}%)`);
  console.log(`  Fatch  1 Aug: override to ${f1(tom.rating)} at 10%  →  now ${f1(players.Fatch.rating)} (reliability ${Math.round(players.Fatch.reliability * 100)}%)`);

  if (!report.healthy || !after.identical) {
    console.error('\nApplied, but the record does not check out. Investigate before using the beta.');
    process.exitCode = 1;
    return;
  }
  console.log('\nDone.');
}

if (require.main === module) main().catch((e) => { console.error('\nFailed: ' + e.message); process.exitCode = 1; });
module.exports = { anchorFrom, RELIABILITY };
