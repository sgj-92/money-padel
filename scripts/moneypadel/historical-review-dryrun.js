#!/usr/bin/env node
// Phase B dry run: what the three historical tier changes would become under
// the board's corrected account of them. Writes NOTHING, ever. There is no
// --write flag and no backend call in this file.
//
//   node scripts/moneypadel/historical-review-dryrun.js
//
// The board's factual position (PROJECT_LEDGER.md Open Question 17):
//   * Shaun, 1 Jul 2026 — he entered Tier C only because his level was unknown.
//     The club concluded the initial estimate was wrong. That is an
//     INITIAL_CLASSIFICATION_CORRECTION to the normal B baseline of 1400. June
//     is preserved exactly; the estimate is corrected on 1 July.
//   * Tom, 1 Jul 2026 and Fatch, 1 Aug 2026 — genuine promotions. They get the
//     same statistical reassessment a promotion would get today, calculated
//     from the shared pre-review snapshot at their own review date. They are
//     NOT re-seeded to 1400.
//
// Each recommendation is drawn from the state as it stood BEFORE that review
// date, so Shaun's correction on 1 July cannot change what Tom is offered on
// the same day.

const Engine = require('../../assets/js/ratingEngine.js');
const Store = require('../../assets/js/ratingStore.js');
const MR = require('../../assets/js/monthlyReview.js');
const RF = require('../../assets/js/replayForward.js');
const { buildBackfill } = require('./seed-beta.js');

const NORMAL_B_BASELINE = 1400;

const PLAN = [
  { playerId: 'Shaun', date: '2026-07-01', fromTier: 'C', toTier: 'B', kind: 'correction' },
  { playerId: 'Tom', date: '2026-07-01', fromTier: 'C', toTier: 'B', kind: 'promotion' },
  { playerId: 'Fatch', date: '2026-08-01', fromTier: 'C', toTier: 'B', kind: 'promotion' },
];

function f1(v) { return v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toFixed(1); }
function pct(v) { return v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`; }

function run() {
  const b = buildBackfill();
  const journey = b.replay.journey;
  const lines = [];
  const rows = [];

  // One snapshot per review date, shared by everyone reviewed on it.
  const snapshots = {};
  [...new Set(PLAN.map((p) => p.date))].forEach((d) => { snapshots[d] = MR.preReviewSnapshot(journey, d); });

  PLAN.forEach((p) => {
    const snap = snapshots[p.date];
    const s = snap[p.playerId];
    const before = {
      rating: s.rating,
      reliability: Engine.reliability(s.effectiveEvidence),
      evidence: s.effectiveEvidence,
      matches: s.lifetimeMatches,
      tier: s.tier,
      status: s.classificationStatus,
    };

    const rec = MR.recommendationFor(snap, {
      playerId: p.playerId, fromTier: p.fromTier, toTier: p.toTier, eventType: 'PROMOTION',
    });

    let proposed, eventType, decisionType, rationale;
    if (p.kind === 'correction') {
      eventType = Engine.EVENT.INITIAL_CLASSIFICATION_CORRECTION;
      decisionType = MR.DECISION.CORRECT_INITIAL_CLASSIFICATION;
      proposed = { rating: NORMAL_B_BASELINE, reliability: null };
      rationale = 'Board decision, fixed: the initial estimate was wrong, so the normal B baseline applies. '
        + 'Not a statistical reassessment, and not a reward for development.';
    } else {
      eventType = Engine.EVENT.CLUB_RATING_REASSESSMENT;
      decisionType = MR.DECISION.ACCEPT_RECOMMENDATION;
      proposed = { rating: rec.recommended ? rec.recommendationRating : null, reliability: null };
      rationale = rec.recommended ? rec.reason : `No recommendation available: ${rec.reason}`;
    }

    rows.push({ ...p, before, rec, proposed, eventType, decisionType, rationale });
  });

  lines.push('# Phase B — historical reassessment dry run');
  lines.push('');
  lines.push('**Nothing here has been written.** These are the numbers Shaun asked to see before any');
  lines.push('historical event is recorded. This script has no write path.');
  lines.push('');
  lines.push(`Engine \`${Engine.RATING_MODEL_VERSION}\`, recommendation method \`${require('../../assets/js/reassessment.js').RECOMMENDATION_METHOD_VERSION}\`.`);
  lines.push('');
  lines.push('## What this dry run found');
  lines.push('');
  const noRec = rows.filter((r) => r.kind === 'promotion' && !(r.rec && r.rec.recommended));
  if (noRec.length) {
    lines.push(`**The statistical reassessment declines to recommend anything for ${noRec.map((r) => r.playerId).join(' or ')}.**`);
    lines.push('');
    lines.push('The brief asks what the current recommendation system *would have produced* at those review');
    lines.push('dates. The answer is: nothing. At each date Tier C held too few **established** players to');
    lines.push('place a boundary — the method needs three either side and found ' + noRec.map((r) => `${r.rec.establishedFrom} for ${r.playerId}`).join(' and ') + '.');
    lines.push('The module refuses rather than inventing a target from a thin pool, which is the behaviour');
    lines.push('Shaun approved when the threshold was set.');
    lines.push('');
    lines.push('That is a real answer, not a gap. It means the honest historical record for');
    lines.push(`${noRec.map((r) => r.playerId).join(' and ')} is a promotion plus **keep the current rating** — the explicit decision`);
    lines.push('Phase A now requires — unless the board prefers to record a club override, which it may.');
    lines.push('**Claude Code will not choose between those; it is exactly the decision the workflow exists to capture.**');
  } else {
    lines.push('All three reviews produced a statistical recommendation.');
  }
  lines.push('');

  rows.forEach((r) => {
    lines.push(`## ${r.playerId} — ${r.date} (${r.fromTier} → ${r.toTier})`);
    lines.push('');
    lines.push(`- **Treated as:** ${r.kind === 'correction' ? 'initial classification correction' : 'genuine promotion, statistically reassessed'}`);
    lines.push(`- **Event type:** \`${r.eventType}\`, decision \`${r.decisionType}\``);
    lines.push(`- **State before the review** (as of ${r.before.tier && r.rec && r.rec.currentRating !== undefined ? '' : ''}${snapshots[r.date][r.playerId].asOfDate}): Tier ${r.before.tier}, rating **${f1(r.before.rating)}**, reliability **${pct(r.before.reliability)}** (${r.before.evidence} evidence, ${r.before.matches} matches), ${r.before.status}`);
    if (r.rec && r.rec.recommended) {
      lines.push(`- **Statistical recommendation:** ${f1(r.rec.recommendationRating)} (${r.rec.ratingDelta >= 0 ? '+' : ''}${f1(r.rec.ratingDelta)}), from boundary T2 ${f1(r.rec.t2)} with ${r.rec.establishedFrom} established in ${r.fromTier} and ${r.rec.establishedTo} in ${r.toTier}, alpha ${r.rec.alpha}`);
    } else {
      lines.push(`- **Statistical recommendation:** none — ${r.rec ? r.rec.reason : 'not calculated'}`);
    }
    lines.push(`- **Proposed new rating:** **${f1(r.proposed.rating)}**`);
    lines.push(`- **Proposed reliability:** ${r.proposed.reliability === null ? '**unchanged** — see the open question below' : pct(r.proposed.reliability)}`);
    lines.push(`- **Why:** ${r.rationale}`);
    lines.push('');
  });

  lines.push('## Reliability — a decision Shaun still has to make');
  lines.push('');
  lines.push('The brief asks for a reliability recommendation rather than an invented one. There is not');
  lines.push('one to give: `reassessment.js` returns `recommendationReliability: null` by design, because');
  lines.push('**no validated method exists for recommending a reliability change on a tier move.** The');
  lines.push('module says so in its own words and offers an override to the board instead.');
  lines.push('');
  lines.push('So the three proposals above leave reliability untouched, which means the evidence each');
  lines.push('player had already earned is kept. For Shaun that is the question worth a moment: his');
  lines.push('rating is being corrected to a baseline as though the estimate restarted, while his five');
  lines.push('June matches of evidence stay. Those are separable, and leaving evidence alone is the more');
  lines.push('conservative of the two readings — but it is a board decision, not an implementation one.');
  lines.push('');
  lines.push('| Player | Reliability before | If left alone | If reset to zero evidence |');
  lines.push('|---|---:|---:|---:|');
  rows.forEach((r) => {
    lines.push(`| ${r.playerId} | ${pct(r.before.reliability)} | ${pct(r.before.reliability)} | 0% |`);
  });
  lines.push('');

  lines.push('## Blast radius');
  lines.push('');
  lines.push('Applying these three events changes the inputs to every match that followed them, so the');
  lines.push('whole record from 1 July onward is re-derived. The figures below come from replaying the');
  lines.push('real record with the three events in place.');
  lines.push('');
  return { lines, rows, snapshots, backfill: b };
}

// The actual replay, so the report states measured consequences rather than
// predicted ones.
function withBlastRadius() {
  const { lines, rows, backfill: b } = run();
  const plan = Store.buildWritePlan({
    matches: b.matches, journey: b.replay.journey, state: b.replay.state, provenance: b.provenance,
  });
  const stored = {
    matches: plan[Store.COLLECTIONS.matches],
    journey: plan[Store.COLLECTIONS.journey],
    players: plan[Store.COLLECTIONS.players],
  };

  // Replace the three recorded tier events with the corrected versions.
  const inputs = RF.inputsFromRecord(stored);
  const byKey = {};
  rows.forEach((r) => { byKey[`${r.playerId}|${r.date}`] = r; });

  const revised = inputs.events.map((e) => {
    const r = byKey[`${e.playerId}|${e.effectiveDate}`];
    if (!r) return e;
    if (r.kind === 'correction') {
      return { ...e, eventType: Engine.EVENT.INITIAL_CLASSIFICATION_CORRECTION, newPowerRating: r.proposed.rating };
    }
    return e; // the promotion itself is unchanged; its rating decision is added below
  });
  rows.filter((r) => r.kind === 'promotion' && r.proposed.rating !== null).forEach((r) => {
    revised.push({
      playerId: r.playerId,
      eventType: Engine.EVENT.CLUB_RATING_REASSESSMENT,
      effectiveDate: r.date,
      newPowerRating: r.proposed.rating,
      decisionType: r.decisionType,
      reasonCode: 'HISTORICAL_REVIEW_CORRECTION',
    });
  });

  const before = Engine.replay(inputs);
  const after = Engine.replay({ ...inputs, events: revised });

  const moved = Object.keys(after.state)
    .map((n) => ({
      playerId: n,
      from: before.state[n] ? before.state[n].rating : null,
      to: after.state[n].rating,
    }))
    .filter((m) => m.from === null || Math.abs(m.from - m.to) > 0.05)
    .map((m) => ({ ...m, delta: m.from === null ? null : Math.round((m.to - m.from) * 10) / 10 }))
    .sort((a, c) => Math.abs(c.delta || 0) - Math.abs(a.delta || 0));

  lines.push(`**${moved.length} of ${Object.keys(after.state).length} players end on a different Power Rating.**`);
  lines.push('');
  lines.push('| Player | Now | After | Change |');
  lines.push('|---|---:|---:|---:|');
  moved.forEach((m) => {
    lines.push(`| ${m.playerId} | ${(Math.round(m.from * 10) / 10).toFixed(1)} | ${(Math.round(m.to * 10) / 10).toFixed(1)} | ${m.delta > 0 ? '+' : ''}${m.delta.toFixed(1)} |`);
  });
  lines.push('');
  lines.push('## What happens next');
  lines.push('');
  lines.push('Claude Code will not write any of this until Shaun confirms the numbers, and needs an');
  lines.push('answer on reliability before it can. Once confirmed: apply the three events in date order,');
  lines.push('replay forward, run diagnostics, and regenerate the comparison report.');
  return lines.join('\n') + '\n';
}

if (require.main === module) {
  process.stdout.write(withBlastRadius());
  console.error('\n(dry run — this script has no write path)');
}
module.exports = { run, withBlastRadius, PLAN, NORMAL_B_BASELINE };
