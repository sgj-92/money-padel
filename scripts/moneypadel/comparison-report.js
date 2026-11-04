#!/usr/bin/env node
// Generate COMPARISON_REPORT.md: v3 beta against the frozen production snapshot.
//
//   node scripts/moneypadel/comparison-report.js                  # from the seeded baseline
//   node scripts/moneypadel/comparison-report.js --live           # from the live beta record
//   node scripts/moneypadel/comparison-report.js --live --write   # ... and write the file
//
// The BASIS matters and is printed in the report. The seeded baseline is the
// CSV replayed with no club decisions; the live record includes every decision
// the board has since recorded. Once a historical adjustment exists the two are
// materially different, and a report that did not say which one it came from
// would be quietly wrong.
//
// WHAT THIS IS AND IS NOT. The two systems rate DIFFERENT MATCH SETS with
// DIFFERENT ENGINES, so a per-player difference is not an error in either. The
// point of the report is to make the differences legible and say which are
// explained, not to drive them toward zero. A report that presented these as a
// reconciliation would be the most misleading thing in the repository.
//
// The snapshot is read-only reference data and goes stale: production keeps
// receiving matches. Every figure below is printed with its date.

const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../../assets/js/ratingEngine.js');
const Store = require('../../assets/js/ratingStore.js');
const { PRODUCTION_SNAPSHOT } = require('../../assets/js/clubs/moneypadel/productionSnapshot.js');
const { buildBackfill } = require('./seed-beta.js');

const ROOT = path.join(__dirname, '..', '..');

function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
function signed(v) { const r = Math.round(v * 10) / 10; return (r > 0 ? '+' : '') + r.toFixed(1); }

// `record` is an optional { state, matchCount, drawCount } read from the live
// beta. Without it the report describes the seeded baseline.
function build(record) {
  const b = buildBackfill();
  const state = record ? record.state : b.replay.state;
  const basis = record ? 'live' : 'baseline';
  const matchCount = record ? record.matchCount : b.matches.length;
  const drawCount = record ? record.drawCount : b.matches.filter((m) => m.outcome === Engine.OUTCOME.DRAW).length;
  const meta = PRODUCTION_SNAPSHOT.snapshot_metadata;

  const prod = {};
  PRODUCTION_SNAPSHOT.players.forEach((p) => { prod[p.name] = p; });

  // The tier each player STARTED at. v3 seeds from the tier that was true when
  // they first played; production seeds from the tier they hold now. For anyone
  // whose tier has since changed, the two begin 300 points apart before a ball
  // is struck, which dominates every other difference.
  const startTier = {};
  b.replay.journey.filter((e) => e.eventType === Engine.EVENT.PLAYER_INITIALISED)
    .forEach((e) => { startTier[e.playerId] = e.newTier; });

  const rows = Object.entries(state).map(([name, s]) => {
    const p = prod[name];
    const reliability = Engine.reliability(s.effectiveEvidence);
    return {
      name,
      tier: s.tier,
      v3: s.rating,
      v3Matches: s.lifetimeMatches,
      reliability,
      prod: p ? p.power_rating : null,
      prodTier: p ? p.tier : null,
      prodMatches: p ? p.total_matches : null,
      delta: p ? s.rating - p.power_rating : null,
      matchDelta: p ? s.lifetimeMatches - p.total_matches : null,
      startTier: startTier[name] || s.tier,
      reseeded: (startTier[name] || s.tier) !== s.tier,
    };
  }).sort((a, b2) => b2.v3 - a.v3);

  const onlyProd = Object.keys(prod).filter((n) => !b.replay.state[n]);
  const compared = rows.filter((r) => r.prod !== null);
  const deltas = compared.map((r) => r.delta);
  const absMean = deltas.reduce((s2, d) => s2 + Math.abs(d), 0) / (deltas.length || 1);
  const tierDisagree = compared.filter((r) => r.tier !== r.prodTier);
  const countDisagree = compared.filter((r) => r.matchDelta !== 0);

  const reseeded = compared.filter((r) => r.reseeded);
  return { b, meta, rows, compared, onlyProd, absMean, tierDisagree, countDisagree, reseeded, basis, matchCount, drawCount };
}

function report(record) {
  const d = build(record);
  const L = [];
  const today = new Date().toISOString().slice(0, 10);

  L.push('# Money Padel Prestige v3 — comparison report');
  L.push('');
  L.push(`Generated ${today} by \`scripts/moneypadel/comparison-report.js\`. Regenerate rather than edit.`);
  L.push('');
  L.push(d.basis === 'live'
    ? '**Basis: the live beta record**, including every club decision the board has recorded.'
    : '**Basis: the seeded baseline** \u2014 the CSV replayed with no club decisions applied.');
  L.push('');
  L.push('## Read this first');
  L.push('');
  L.push('**These two systems are not supposed to agree, and a difference is not a defect in either.**');
  L.push('They rate different match sets with different engines. The purpose of this report is to make');
  L.push('the differences legible and say which are explained — not to drive them toward zero.');
  L.push('');
  L.push('| | v3 beta | Legacy production |');
  L.push('|---|---|---|');
  L.push(`| Engine | \`${Engine.RATING_MODEL_VERSION}\` — sequential, one pass, applied per match | Iterative joint-equilibrium solver, K=28, 300 epochs over the whole set |`);
  L.push(`| Matches rated | ${d.matchCount} | ${d.meta.total_matches_used_in_rating_engine} |`);
  L.push(`| Draws rated | ${d.drawCount} | 0 — the legacy solver cannot rate a match with no winner |`);
  L.push('| Rating moves | Once, when the match is played, weighted by how established the player is | Re-solved from scratch across every match on every computation |');
  L.push('| Monthly figures | A window on one continuous rating | A separate rating solved from that month alone |');
  L.push(`| Snapshot taken | live | ${d.meta.export_timestamp_utc} |`);
  L.push(`| Players | ${d.rows.length} | ${d.meta.total_players_exported} |`);
  L.push('');
  L.push(`The production figures are a **frozen snapshot from ${d.meta.export_timestamp_utc.slice(0, 10)}** and go stale: production keeps`);
  L.push('receiving matches. They are reference data and are never an input to anything in v3.');
  L.push('');

  L.push('## What is already known not to reconcile');
  L.push('');
  L.push(`- **Match counts differ for ${d.countDisagree.length} of ${d.compared.length} players.** v3 rates ${d.matchCount} matches, the snapshot ${d.meta.total_matches_used_in_rating_engine}.`);
  L.push('  Not explained by draws alone. Recorded in `PROJECT_LEDGER.md` as an approximate reference, not a reconcilable truth.');
  L.push('- **The snapshot has no join key.** Every `player_id` is `null`, so players are matched by name. All');
  L.push(`  ${d.compared.length} map today; a rename would break it silently.`);
  if (d.onlyProd.length) L.push(`- **In the snapshot but not in v3:** ${d.onlyProd.join(', ')}.`);
  const onlyV3 = d.rows.filter((r) => r.prod === null).map((r) => r.name);
  if (onlyV3.length) L.push(`- **In v3 but not in the snapshot:** ${onlyV3.join(', ')}.`);
  L.push('');

  L.push('## Summary');
  L.push('');
  L.push(`- Players compared: **${d.compared.length}**`);
  L.push(`- Mean absolute difference: **${f1(d.absMean)} points**`);
  L.push(`- Largest difference: **${d.compared.map((r) => Math.abs(r.delta)).sort((a, b2) => b2 - a).slice(0, 1).map(f1)[0]} points**`);
  L.push(`- Tier disagreements: **${d.tierDisagree.length}**${d.tierDisagree.length ? ' — ' + d.tierDisagree.map((r) => `${r.name} (v3 ${r.tier}, snapshot ${r.prodTier})`).join(', ') : ''}`);
  L.push('');
  if (d.reseeded.length) {
    const biggest = d.compared.slice().sort((a, b2) => Math.abs(b2.delta) - Math.abs(a.delta)).slice(0, d.reseeded.length);
    const allTop = d.reseeded.every((r) => biggest.some((x) => x.name === r.name));
    L.push(allTop
      ? `**The ${d.reseeded.length} largest differences are explained before any match is played.**`
      : `**${d.reseeded.length} players are seeded differently by the two systems.**`);
    L.push(`${d.reseeded.map((r) => `${r.name} (started Tier ${r.startTier}, now Tier ${r.tier}, ${signed(r.delta)})`).join('; ')}.`);
    L.push('v3 seeds a player at the tier that was true when they first played; production seeds from the');
    L.push('tier they hold today. For these players the two systems begin 300 points apart, and evidence has');
    L.push(`damped rather than erased that gap.${allTop
      ? ' They are exactly the largest differences in the table.'
      : ' They are no longer the largest differences: a club decision has since been recorded for each of them, which supersedes the seeding gap as the explanation.'}`);
    L.push('');
    const rest = d.compared.filter((r) => !r.reseeded);
    const restMean = rest.reduce((s2, r) => s2 + Math.abs(r.delta), 0) / (rest.length || 1);
    L.push(`Excluding them, the mean absolute difference is **${f1(restMean)} points** across ${rest.length} players.`);
    L.push('');
  }
  L.push('A tier disagreement is expected where v3 recorded a promotion after the snapshot was taken.');
  L.push('');

  L.push('## Per player');
  L.push('');
  L.push('Sorted by v3 Power Rating. "Evidence" is the reliability v3 holds for that player: a low');
  L.push('figure means v3 has deliberately moved them less, so a large difference there is the two');
  L.push('systems disagreeing about confidence, not about ability.');
  L.push('');
  L.push('| Player | Tier | Started | v3 | Snapshot | Diff | v3 matches | Snapshot matches | Reliability |');
  L.push('|---|---|---|---:|---:|---:|---:|---:|---:|');
  d.rows.forEach((r) => {
    L.push(`| ${r.name} | ${r.tier}${r.prodTier && r.prodTier !== r.tier ? ` (was ${r.prodTier})` : ''} | ${r.reseeded ? `**${r.startTier}**` : r.startTier} | ${f1(r.v3)} | ${r.prod === null ? '—' : f1(r.prod)} | ${r.delta === null ? '—' : signed(r.delta)} | ${r.v3Matches} | ${r.prodMatches === null ? '—' : r.prodMatches}${r.matchDelta ? ` (${signed(r.matchDelta).replace('.0', '')})` : ''} | ${Math.round(r.reliability * 100)}% |`);
  });
  L.push('');

  L.push('## How to read a large difference');
  L.push('');
  L.push('In order of how often it is the answer:');
  L.push('');
  L.push('1. **They started at a different tier.** v3 seeds from the tier that was true when the player');
  L.push('   first played; production seeds from the tier they hold now. A C-to-B correction is a 300 point');
  L.push('   head start in production terms. This explains the largest differences in the table.');
  L.push('2. **The two rated different matches for that player.** Check the match-count columns first.');
  L.push('3. **v3 weights early results more.** A newer player moves by up to 40 points a match while');
  L.push('   production moves everyone by the same K. Low reliability plus a large difference is this.');
  L.push('4. **v3 rates draws.** Production cannot, so anyone in a drawn match differs for that reason alone.');
  L.push('5. **The snapshot is older than the v3 record.** Matches played since are in v3 only.');
  L.push('6. **A club decision moved the v3 rating.** Recorded in the Rating Journey as its own event.');
  L.push('');
  L.push('None of these is a defect. If a difference survives all six, that is worth investigating —');
  L.push('and worth recording in `PROJECT_LEDGER.md` rather than resolving quietly.');
  return L.join('\n') + '\n';
}

async function liveRecord() {
  const Store = require('../../assets/js/ratingStore.js');
  const { PROJECT_ID } = require('./seed-beta.js');
  const backend = Store.firestoreRestBackend({ projectId: PROJECT_ID });
  const [players, matches] = await Promise.all([
    backend.getAll(Store.COLLECTIONS.players),
    backend.getAll(Store.COLLECTIONS.matches),
  ]);
  const state = {};
  players.forEach((p) => {
    state[p.id] = {
      rating: p.rating, effectiveEvidence: p.effectiveEvidence,
      lifetimeMatches: p.lifetimeMatches, tier: p.tier,
    };
  });
  return { state, matchCount: matches.length, drawCount: matches.filter((m) => m.outcome === 'DRAW').length };
}

async function main() {
  const record = process.argv.includes('--live') ? await liveRecord() : null;
  const text = report(record);
  if (process.argv.includes('--write')) {
    const at = path.join(ROOT, 'COMPARISON_REPORT.md');
    fs.writeFileSync(at, text);
    console.log('Written to ' + path.relative(ROOT, at));
  } else {
    process.stdout.write(text);
    console.error('\n(nothing written — re-run with --write)');
  }
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exitCode = 1; });
module.exports = { build, report, liveRecord };
