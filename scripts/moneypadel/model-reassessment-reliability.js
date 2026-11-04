#!/usr/bin/env node
// Model the Recommended Reliability for a club reassessment.
//
//   node scripts/moneypadel/model-reassessment-reliability.js            # reads the live beta
//   node scripts/moneypadel/model-reassessment-reliability.js --file r.json
//
// READ-ONLY. It writes nothing, changes no engine behaviour, and recommends no
// decision. It answers one question: what do the club's own past decisions
// actually constrain?
//
// Open Question "Reassessment reliability recommendation" asks for candidate
// rules validated against the Shaun / Tom / Fatch decisions before anything is
// implemented. This is that validation.

const fs = require('node:fs');
const Engine = require('../../assets/js/ratingEngine.js');
const Store = require('../../assets/js/ratingStore.js');
const { PROJECT_ID } = require('./seed-beta.js');

// A club reassessment replaces the rating with an anchor the board chose. The
// tier move itself (PROMOTION / DEMOTION) never touches rating or reliability;
// only these events do.
const ANCHOR_EVENTS = ['CLUB_RATING_REASSESSMENT', 'INITIAL_CLASSIFICATION_CORRECTION'];

// Tier seeds are 300 apart (C 1100, B 1400, A 1700, S 2000), so 300 is one
// whole tier of rating.
const TIER_WIDTH = 300;
const REOPEN = 0.10;   // the reliability the club has used for a full reopen

const E = (rel) => Engine.effectiveEvidenceForReliability(rel);
const rel = (ev) => Engine.reliability(ev);
const k = (ev) => Engine.kForEvidence(ev);
const pct = (r) => (r * 100).toFixed(1) + '%';

// ---------------------------------------------------------------------------
// Candidate rules. Each takes what the board knows at the moment of decision
// and returns a reliability.

const RULES = {
  // What the club has actually done three times.
  flat: {
    label: 'Flat reopen — always 10%',
    explain: 'A reassessed rating starts almost fresh, whatever came before.',
    apply: ({ reliabilityBefore }) => Math.min(REOPEN, reliabilityBefore),
  },
  // Keep a fixed fraction of the evidence behind the old rating.
  proportional: (f) => ({
    label: `Proportional — keep ${(f * 100).toFixed(0)}% of prior evidence`,
    explain: 'The player\'s record is discounted but not discarded.',
    apply: ({ evidenceBefore }) => rel(evidenceBefore * f),
  }),
  // Retain prior reliability in proportion to how much of the old rating
  // survived the board's anchor. A move of `d` points or more reopens fully.
  moveScaled: (d) => ({
    label: `Move-scaled — full reopen at ${d} points`,
    explain: 'Prior evidence supported the old number. It carries across only to '
      + 'the extent the number did not move.',
    apply: ({ reliabilityBefore, ratingMove }) => {
      const survived = Math.max(0, 1 - Math.abs(ratingMove) / d);
      const out = REOPEN + (reliabilityBefore - REOPEN) * survived;
      // Reopening a rating can never make the club MORE confident in it. A
      // player already below the reopen floor stays where they are rather than
      // being promoted to 10% by a decision that only added doubt.
      return Math.min(out, reliabilityBefore);
    },
  }),
};

// ---------------------------------------------------------------------------

function decisionsFrom(journey) {
  // Superseded decisions are stored beside their replacement. The replacement
  // is what the club decided.
  const superseded = {};
  journey.forEach((e) => { if (e.supersedes) superseded[e.supersedes] = true; });
  return journey
    .filter((e) => ANCHOR_EVENTS.includes(e.eventType) && !superseded[e.id])
    .filter((e) => e.newReliability != null && e.previousReliability != null)
    .map((e) => ({
      playerId: e.playerId,
      date: e.effectiveDate,
      eventType: e.eventType,
      fromTier: e.previousTier,
      toTier: e.newTier,
      evidenceBefore: e.effectiveEvidenceBefore,
      reliabilityBefore: e.previousReliability,
      ratingBefore: e.previousPowerRating,
      ratingAfter: e.newPowerRating,
      ratingMove: e.newPowerRating - e.previousPowerRating,
      reliabilityChosen: e.newReliability,
      matchesAtEvent: e.lifetimeMatchesAtEvent,
      notes: e.notes || '',
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// What happened to the rating AFTER the board reopened it. The only outcome
// evidence there is: whether the anchor the board chose survived contact.
function aftermath(journey, d) {
  const mine = journey
    .filter((e) => e.playerId === d.playerId && e.eventType === Engine.EVENT.MATCH_UPDATE)
    .filter((e) => e.effectiveDate >= d.date)
    .sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : 1));
  const total = mine.reduce((s, m) => s + m.ratingDelta, 0);
  const first5 = mine.slice(0, 5).reduce((s, m) => s + m.ratingDelta, 0);
  return { matches: mine.length, drift: total, first5 };
}

function report(record) {
  const decisions = decisionsFrom(record.journey);

  console.log('');
  console.log('THE DECISIONS THE CLUB HAS ACTUALLY MADE');
  console.log('');
  if (!decisions.length) { console.log('  none found'); return; }

  decisions.forEach((d) => {
    const a = aftermath(record.journey, d);
    console.log(`  ${d.playerId} — ${d.date} — ${d.eventType}`);
    console.log(`    ${d.fromTier} → ${d.toTier}, anchored ${d.ratingBefore.toFixed(1)} → ${d.ratingAfter.toFixed(1)}`
      + `  (${d.ratingMove > 0 ? '+' : ''}${d.ratingMove.toFixed(1)}, ${(Math.abs(d.ratingMove) / TIER_WIDTH * 100).toFixed(0)}% of a tier)`);
    console.log(`    evidence ${d.evidenceBefore} (${pct(d.reliabilityBefore)}, K ${k(d.evidenceBefore).toFixed(1)})`
      + `  →  chose ${pct(d.reliabilityChosen)} (K ${k(E(d.reliabilityChosen)).toFixed(1)})`);
    console.log(`    afterwards: ${a.matches} matches, rating moved ${a.drift > 0 ? '+' : ''}${a.drift.toFixed(1)}`
      + ` (${a.first5 > 0 ? '+' : ''}${a.first5.toFixed(1)} over the first five)`);
    console.log('');
  });

  // ---- What the observations constrain -----------------------------------
  console.log('WHAT THESE OBSERVATIONS CAN AND CANNOT SETTLE');
  console.log('');
  const chosen = [...new Set(decisions.map((d) => d.reliabilityChosen.toFixed(4)))];
  const moves = decisions.map((d) => Math.abs(d.ratingMove));
  console.log(`  Distinct reliabilities chosen: ${chosen.map((c) => pct(Number(c))).join(', ')}`);
  console.log(`  Anchor moves: ${moves.map((m) => m.toFixed(0)).join(', ')} points`
    + `  (${(Math.min(...moves) / TIER_WIDTH * 100).toFixed(0)}–${(Math.max(...moves) / TIER_WIDTH * 100).toFixed(0)}% of a tier)`);
  console.log(`  Prior reliabilities: ${decisions.map((d) => pct(d.reliabilityBefore)).join(', ')}`);
  // Derived, never asserted. This narrative was hard-coded when all three
  // decisions happened to agree; the board then corrected two of them and the
  // prose went on claiming they agreed. Copy that describes the record has to
  // be computed from it.
  console.log('');
  const spread = Math.max(...moves) - Math.min(...moves);
  const sameSituation = spread / TIER_WIDTH < 0.25;
  const sameAnswer = chosen.length === 1;
  const evidences = decisions.map((d) => d.evidenceBefore);
  console.log(sameSituation
    ? '  Every decision is the same situation: a near-whole-tier anchor move.'
    : `  The moves vary by ${spread.toFixed(0)} points, so these are not all the same situation.`);
  console.log(sameAnswer
    ? '  All of them were answered with the same reliability, and prior evidence'
      + `\n  ranged ${Math.min(...evidences)} to ${Math.max(...evidences)} without changing it. The record therefore`
      + '\n  fixes ONE point of any rule and says nothing about a small correction.'
    : `  They were NOT answered the same way (${chosen.map((c) => pct(Number(c))).join(', ')}), so no single rule`
      + '\n  reproduces all of them unless it can produce each of those answers.'
      + '\n  Where they differ is a board decision, not a property of the data.');
  console.log('');

  // ---- Fit ----------------------------------------------------------------
  const candidates = [
    RULES.flat,
    RULES.proportional(0.25),
    RULES.proportional(0.50),
    RULES.moveScaled(150),
    RULES.moveScaled(222),
    RULES.moveScaled(300),
    RULES.moveScaled(450),
  ];

  console.log('FIT AGAINST THOSE DECISIONS');
  console.log('');
  console.log('  ' + 'rule'.padEnd(42) + decisions.map((d) => d.playerId.padStart(9)).join('') + '   worst miss');
  candidates.forEach((r) => {
    const got = decisions.map((d) => r.apply(d));
    const miss = Math.max(...got.map((g, i) => Math.abs(g - decisions[i].reliabilityChosen)));
    console.log('  ' + r.label.padEnd(42)
      + got.map((g) => pct(g).padStart(9)).join('')
      + '   ' + (miss < 0.005 ? 'exact' : (miss * 100).toFixed(1) + ' pts'));
  });
  console.log('');

  // The boundary the data implies, SEARCHED rather than assumed. This used to
  // print the smallest observed move as though it were the bound, which was
  // only true while every decision shared one answer.
  const fitting = [];
  for (let d = 50; d <= 900; d += 1) {
    const rule = RULES.moveScaled(d);
    if (decisions.every((x) => Math.abs(rule.apply(x) - x.reliabilityChosen) < 0.005)) fitting.push(d);
  }
  if (fitting.length) {
    console.log(`  A move-scaled rule reproduces all of them for a full-reopen distance`);
    console.log(`  between ${fitting[0]} and ${fitting[fitting.length - 1]} points. That range -- not a single value --`);
    console.log(`  is what the club's decisions establish.`);
  } else {
    console.log(`  NO move-scaled distance reproduces all of them, because they were not`);
    console.log(`  all answered the same way and this rule has one floor. Each decision`);
    console.log(`  that sits at a different floor needs its own, which is a board choice`);
    console.log(`  rather than something the data can settle.`);
    decisions.forEach((d) => {
      console.log(`    ${d.playerId}: moved ${Math.abs(d.ratingMove).toFixed(0)} and was answered ${pct(d.reliabilityChosen)}`);
    });
  }
  console.log('');

  // And how the rule actually in use fares, which is the question that matters
  // now that one has been chosen.
  console.log('THE RULE NOW IN USE');
  console.log('');
  const Reassessment = require('../../assets/js/reassessment.js');
  decisions.forEach((d) => {
    const got = Reassessment.recommendReliability({
      currentReliability: d.reliabilityBefore, ratingMove: d.ratingMove,
    });
    const agrees = Math.abs(got.reliability - d.reliabilityChosen) < 0.005;
    console.log(`  ${d.playerId.padEnd(7)} board ${pct(d.reliabilityChosen).padStart(6)}`
      + `   rule ${pct(got.reliability).padStart(6)}   ${agrees ? 'agrees' : 'differs — recorded as a board override'}`);
  });
  console.log('');

  // ---- Where the rules disagree ------------------------------------------
  console.log('WHERE THE CANDIDATES DISAGREE — THE CASES NOT YET MET');
  console.log('');
  const probes = [
    { label: 'settled player, small correction', evidenceBefore: 20, ratingMove: 30 },
    { label: 'settled player, 90-point move', evidenceBefore: 20, ratingMove: 90 },
    { label: 'settled player, half-tier move', evidenceBefore: 20, ratingMove: 150 },
    { label: 'settled player, whole-tier move', evidenceBefore: 20, ratingMove: 300 },
    { label: 'newer player, small correction', evidenceBefore: 4, ratingMove: 30 },
    { label: 'newer player, whole-tier move', evidenceBefore: 4, ratingMove: 300 },
    // Nobody has done this yet, and a rule has to survive it: a player with
    // almost no record at all, reassessed.
    { label: 'brand new player (1 match), big move', evidenceBefore: 1, ratingMove: 300 },
  ];
  console.log('  ' + 'case'.padEnd(36) + candidates.map((_, i) => ('R' + (i + 1)).padStart(8)).join(''));
  probes.forEach((p) => {
    const row = candidates.map((r) => pct(r.apply({ ...p, reliabilityBefore: rel(p.evidenceBefore) })).padStart(8)).join('');
    console.log('  ' + p.label.padEnd(36) + row);
  });
  console.log('');
  candidates.forEach((r, i) => console.log(`  R${i + 1} = ${r.label}`));
  console.log('');

  console.log('  Read the first row. It is the decision the club has never made and will:');
  console.log('  a player with a real record whose rating the board nudges. A flat rule');
  console.log('  throws away twenty matches of evidence to move someone 30 points.');
  console.log('');

  // ---- What a reopened reliability costs ---------------------------------
  console.log('WHAT REOPENING COSTS, IN MATCHES');
  console.log('');
  [0.10, 0.25, 0.40, 0.55].forEach((r) => {
    const start = E(r);
    const toHalf = Math.max(0, E(0.50) - start);
    console.log(`  reopened to ${pct(r).padStart(6)}  →  K ${k(start).toFixed(1).padStart(4)}`
      + `   back to 50% after ${Math.ceil(toHalf)} match${Math.ceil(toHalf) === 1 ? '' : 'es'}`);
  });
  console.log('');
  console.log('  Evidence rises by exactly 1 per match, so this is arithmetic, not a fit.');
  console.log('');
}

async function readLive() {
  const backend = Store.firestoreRestBackend({ projectId: PROJECT_ID });
  const read = async (c) => {
    for (let a = 1; ; a++) {
      try { return await backend.getAll(c); } catch (e) {
        if (!/\b429\b/.test(e.message) || a >= 6) throw e;
        await new Promise((r) => setTimeout(r, 2000 * a));
      }
    }
  };
  return { players: await read('players'), matches: await read('matches'), journey: await read('ratingJourney') };
}

// Exported so the properties below can be pinned by tests. If a rule is ever
// chosen, it moves into reassessment.js -- these properties move with it.
module.exports = { RULES, decisionsFrom, aftermath, TIER_WIDTH, REOPEN };

if (require.main !== module) return;

(async () => {
  const fileArg = process.argv.indexOf('--file');
  const record = fileArg !== -1
    ? JSON.parse(fs.readFileSync(process.argv[fileArg + 1], 'utf8'))
    : await readLive();
  report(record);
})().catch((e) => { console.error('FAILED:', e.message); process.exitCode = 1; });
