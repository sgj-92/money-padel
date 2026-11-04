#!/usr/bin/env node
// Re-anchor Tom (1 Jul 2026) and Fatch (1 Aug 2026) to the standard Tier B
// baseline of 1400, superseding the comparator-based anchors applied on
// 18 Sep 2026.
//
//   node scripts/moneypadel/correct-tom-fatch-anchors.js            # preview (default)
//   node scripts/moneypadel/correct-tom-fatch-anchors.js --write    # apply to the beta
//
// Board decision, Shaun, 20 Sep 2026: anchoring a promoted player to one
// individual B with a genuinely poor record distorted how far they sat from
// the rest of the tier. Both are re-anchored to 1400. The previously decided
// 10% Reliability is unchanged.
//
// Nothing is deleted. Each correction supersedes the decision it replaces,
// through the same audited Historical Club Adjustment path, and everything
// after it is replayed chronologically.
//
// The preview is complete, unlike the original run. Both anchors are literals
// now, so Fatch no longer depends on Tom's corrected July having been written
// first -- the corrected record can be built in memory and reported on in full
// before anything is committed.

const Store = require('../../assets/js/ratingStore.js');
const Review = require('../../assets/js/monthlyReview.js');
const HA = require('../../assets/js/historicalAdjustment.js');
const RF = require('../../assets/js/replayForward.js');
const BD = require('../../assets/js/betaDiagnostics.js');
const Engine = require('../../assets/js/ratingEngine.js');
const { PROJECT_ID } = require('./seed-beta.js');

const BASELINE = 1400;            // standard Tier B baseline
// Shaun, 20 Sep 2026, changing the previously decided 10%: both reopen at 20%.
// A re-anchor of this size is past the full-reopen distance, so this is also
// exactly what the move-scaled rule recommends -- the board and the system now
// agree, and the record shows that rather than an override.
const RELIABILITY = 0.20;
const BOARD = 'Shaun (board decision, 20 Sep 2026)';
const REASON = 'Board correction: re-anchored to the standard Tier B baseline of 1400. '
  + 'The previous comparator anchor rested on one individual B with a genuinely poor record, '
  + 'which distorted how far the promoted player sat from the rest of the tier. '
  + 'Reliability reopened at 20%, superseding the earlier 10% decision and matching '
  + 'the move-scaled recommendation for a re-anchor of this size.';

const CORRECTIONS = [
  { playerId: 'Tom', effectiveDate: '2026-07-01' },
  { playerId: 'Fatch', effectiveDate: '2026-08-01' },
];

const f1 = (v) => (v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toFixed(1));
const pc = (r) => (r === null || r === undefined ? '—' : Math.round(r * 100) + '%');

async function read(backend) {
  const [matches, journey, players] = await Promise.all([
    backend.getAll(Store.COLLECTIONS.matches),
    backend.getAll(Store.COLLECTIONS.journey),
    backend.getAll(Store.COLLECTIONS.players),
  ]);
  return { matches, journey, players };
}

// Apply a plan to an in-memory record, so the next correction is planned
// against the state the first one actually produces. This is what makes a
// complete preview possible without writing anything.
function applyInMemory(stored, plan) {
  const key = { [Store.COLLECTIONS.matches]: 'matches', [Store.COLLECTIONS.journey]: 'journey', [Store.COLLECTIONS.players]: 'players' };
  const next = { matches: stored.matches.slice(), journey: stored.journey.slice(), players: stored.players.slice() };
  Object.entries(plan.deletes || {}).forEach(([c, ids]) => {
    const k = key[c]; if (!k) return;
    next[k] = next[k].filter((d) => !ids.includes(d.id));
  });
  Object.entries(plan.writes || {}).forEach(([c, docs]) => {
    const k = key[c]; if (!k) return;
    const by = {}; next[k].forEach((d) => { by[d.id] = d; });
    docs.forEach((d) => { by[d.id] = d; });
    next[k] = Object.values(by);
  });
  return next;
}

// The anchor a player is on now: the live rating decision this correction
// replaces, read back rather than assumed.
function currentAnchor(journey, playerId, date) {
  const superseded = {};
  journey.forEach((e) => { if (e.supersedes) superseded[e.supersedes] = true; });
  return journey
    .filter((e) => e.playerId === playerId && e.effectiveDate === date && !superseded[e.id])
    .filter((e) => e.newPowerRating !== null && e.newPowerRating !== undefined)
    .sort((a, b) => (b.revision || 1) - (a.revision || 1))[0] || null;
}

function ranking(players) {
  return players.slice()
    .sort((a, b) => b.rating - a.rating)
    .map((p, i) => ({ id: p.id, rank: i + 1, rating: p.rating }));
}

async function main() {
  const write = process.argv.includes('--write');
  const backend = Store.firestoreRestBackend({ projectId: PROJECT_ID });

  console.log(`Tom / Fatch anchor correction — ${write ? 'WRITE' : 'PREVIEW (nothing will change)'}`);
  console.log(`  project: ${PROJECT_ID}`);
  console.log(`  new anchor for both: ${BASELINE} (standard Tier B baseline)`);
  console.log(`  reliability: ${pc(RELIABILITY)} (Shaun, 20 Sep — supersedes the earlier 10%)`);

  const before = await read(backend);
  console.log(`  record: ${before.matches.length} matches · ${before.journey.length} journey events · ${before.players.length} players`);

  const noop = RF.verifyNoOp(before, {});
  console.log(`  replays to itself: ${noop.identical ? 'yes' : 'NO — ' + noop.count + ' differences'}`);
  if (!noop.identical) {
    console.error('\nThe record does not replay to itself, so no correction can be planned on it.');
    console.error('Run scripts/moneypadel/repair-replay-divergence.js first.');
    process.exitCode = 1;
    return;
  }

  console.log('\nWHAT IS BEING REPLACED');
  CORRECTIONS.forEach((c) => {
    const a = currentAnchor(before.journey, c.playerId, c.effectiveDate);
    if (!a) { console.log(`  ${c.playerId}: no live rating decision on ${c.effectiveDate} — nothing to supersede.`); return; }
    console.log(`  ${c.playerId} (${c.effectiveDate}): ${a.eventType} anchored ${f1(a.previousPowerRating)} → ${f1(a.newPowerRating)}`
      + `, reliability ${pc(a.previousReliability)} → ${pc(a.newReliability)}`);
    console.log(`    becomes: → ${f1(BASELINE)} (${(BASELINE - a.newPowerRating) >= 0 ? '+' : ''}${f1(BASELINE - a.newPowerRating)} on the anchor), reliability ${pc(RELIABILITY)}`);
  });

  // ---- Plan both, chronologically, in memory --------------------------------
  const plans = [];
  let working = before;
  for (const c of CORRECTIONS) {
    const adjustment = {
      playerId: c.playerId, effectiveDate: c.effectiveDate, tierEvent: 'PROMOTION', newTier: 'B',
      ratingDecision: Review.DECISION.CLUB_OVERRIDE,
      overrideRating: BASELINE, overrideReliability: RELIABILITY,
      reason: REASON, createdBy: BOARD,
    };
    const plan = HA.plan({
      stored: working, adjustment,
      provenance: { createdBy: BOARD, recordedAt: new Date().toISOString(), source: 'Historical Club Adjustment' },
    });
    plans.push({ c, plan });
    working = applyInMemory(working, plan);
  }

  console.log('\nTHE CORRECTION, STEP BY STEP');
  plans.forEach(({ c, plan }) => {
    console.log(`\n  ${c.playerId} — effective ${c.effectiveDate}`);
    console.log(`    ${plan.summary}`);
    plan.events.forEach((e) => {
      console.log(`    ${e.eventType}${e.supersedes ? ` supersedes ${e.supersedes} (revision ${e.revision})` : ''}`);
    });
    console.log(`    ${plan.documentsToWrite} documents rewritten, ${plan.documentsToDelete} removed`);
  });

  // ---- The blast radius ----------------------------------------------------
  const was = {}; before.players.forEach((p) => { was[p.id] = p; });
  const moved = working.players
    .map((p) => ({ id: p.id, from: was[p.id] ? was[p.id].rating : null, to: p.rating }))
    .filter((m) => m.from === null || Math.abs(m.to - m.from) > 1e-9)
    .map((m) => ({ ...m, delta: m.from === null ? null : Math.round((m.to - m.from) * 10) / 10 }))
    .sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0));

  const docs = RF.diffDocs(
    { [Store.COLLECTIONS.matches]: before.matches, [Store.COLLECTIONS.journey]: before.journey, [Store.COLLECTIONS.players]: before.players },
    { [Store.COLLECTIONS.matches]: working.matches, [Store.COLLECTIONS.journey]: working.journey, [Store.COLLECTIONS.players]: working.players });

  console.log('\nBLAST RADIUS');
  console.log(`  ${docs.changed} documents written in total, ${docs.removed} removed`);
  Object.entries(docs.writes).forEach(([c, d]) => { if (d.length) console.log(`    ${c}: ${d.length}`); });
  console.log(`  ${moved.length} of ${working.players.length} players end on a different rating`);
  moved.forEach((m) => {
    const tag = ['Tom', 'Fatch'].includes(m.id) ? '  ← re-anchored' : '';
    console.log(`    ${m.id.padEnd(12)} ${((m.delta > 0 ? '+' : '') + m.delta).padStart(7)}   ${f1(m.from)} → ${f1(m.to)}${tag}`);
  });

  // Ranking movement, which is what the club actually reads.
  const rankBefore = {}; ranking(before.players).forEach((r) => { rankBefore[r.id] = r.rank; });
  const rankAfter = ranking(working.players);
  const rankMoves = rankAfter
    .filter((r) => rankBefore[r.id] && rankBefore[r.id] !== r.rank)
    .map((r) => ({ id: r.id, from: rankBefore[r.id], to: r.rank }))
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
  console.log(`\n  ${rankMoves.length} player(s) change rank`);
  rankMoves.forEach((r) => console.log(`    ${r.id.padEnd(12)} #${r.from} → #${r.to}`));

  // What the board chose against what the rule would now recommend.
  console.log('\n  RELIABILITY, RECORDED BOTH WAYS');
  plans.forEach(({ c, plan }) => {
    const ev = plan.events.find((e) => e.newReliability !== null && e.newReliability !== undefined);
    if (!ev) return;
    console.log(`    ${c.playerId}: board ${pc(ev.newReliability)}`
      + (ev.recommendationReliability != null ? `, system recommended ${pc(ev.recommendationReliability)}` : '')
      + ' — the board decision stands and both are stored.');
  });

  // ---- Does the corrected record hold together? ---------------------------
  const after = RF.verifyNoOp(working, {});
  const players = {}; working.players.forEach((p) => { players[p.id] = p; });
  const health = BD.run({ players, matches: working.matches, journey: working.journey });
  console.log('\nTHE CORRECTED RECORD');
  console.log(`  replays to itself: ${after.identical ? 'yes' : 'NO — ' + after.count + ' differences'}`);
  console.log(`  diagnostics: ${health.checks.filter((c) => c.status !== 'fail').length} / ${health.checks.length} passing`);
  health.checks.filter((c) => c.status === 'fail').forEach((c) => console.log(`    FAIL ${c.name}: ${c.detail || ''}`));
  const supersededKept = working.journey.filter((e) => e.supersedes).length;
  console.log(`  superseded decisions still in the record: ${supersededKept}`);

  if (!after.identical || !health.healthy) {
    console.error('\nThe corrected record does not hold together. Nothing will be applied.');
    process.exitCode = 1;
    return;
  }

  if (!write) {
    console.log('\nPreview only. Nothing was written. Re-run with --write once Shaun has approved this exact correction.');
    return;
  }

  console.log('\nWriting ...');
  let live = before;
  for (const { c, plan } of plans) {
    // Re-plan against the live record as it now stands, so what is written is
    // built on what is actually there rather than on the preview's copy.
    const adjustment = {
      playerId: c.playerId, effectiveDate: c.effectiveDate, tierEvent: 'PROMOTION', newTier: 'B',
      ratingDecision: Review.DECISION.CLUB_OVERRIDE,
      overrideRating: BASELINE, overrideReliability: RELIABILITY,
      reason: REASON, createdBy: BOARD,
    };
    const fresh = HA.plan({
      stored: live, adjustment,
      provenance: { createdBy: BOARD, recordedAt: new Date().toISOString(), source: 'Historical Club Adjustment' },
    });
    const res = await RF.commit(backend, fresh, {
      onProgress: (done, total) => { if (done === total) console.log(`  ${c.playerId}: ${done}/${total} documents`); },
    });
    console.log(`  ${c.playerId}: wrote ${res.written}, removed ${res.deleted}.`);
    live = await read(backend);
  }

  console.log('\nRe-reading and verifying ...');
  const final = await read(backend);
  const finalNoop = RF.verifyNoOp(final, {});
  const finalPlayers = {}; final.players.forEach((p) => { finalPlayers[p.id] = p; });
  const finalHealth = BD.run({ players: finalPlayers, matches: final.matches, journey: final.journey });
  console.log(`  replay-to-self differences: ${finalNoop.count}`);
  console.log(`  diagnostics: ${finalHealth.checks.filter((c) => c.status !== 'fail').length} / ${finalHealth.checks.length} passing`);
  ['Tom', 'Fatch'].forEach((n) => {
    const p = finalPlayers[n];
    if (p) console.log(`  ${n}: ${f1(p.rating)}, reliability ${pc(Engine.reliability(p.effectiveEvidence))}`);
  });
  if (finalNoop.count || !finalHealth.healthy) {
    console.error('\nThe record does not verify after the write. Do not use the app until this is understood.');
    process.exitCode = 1;
  } else {
    console.log('\nApplied. The record replays to itself and diagnostics pass.');
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exitCode = 1; });
