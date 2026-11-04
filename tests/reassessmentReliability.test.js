// Modelling the Recommended Reliability for a club reassessment.
//
// Nothing here ships yet: the Ledger requires the candidate rules to be
// validated against the club's own decisions before a formula is chosen. These
// tests pin what that validation found and the properties ANY chosen rule has
// to have, so whichever one is picked cannot quietly lose them on the way into
// the engine.

const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../assets/js/ratingEngine.js');
const M = require('../scripts/moneypadel/model-reassessment-reliability.js');

const rel = (e) => Engine.reliability(e);

// The three decisions the club has actually made, read out of the live record
// with `scripts/moneypadel/model-reassessment-reliability.js`.
//
// Updated 20 Sep 2026: Shaun corrected Tom's and Fatch's anchors from their
// comparator values to the Tier B baseline of 1400 and reopened both at 20%,
// superseding the earlier 10%. Shaun's own 1 Jul decision is unchanged, so the
// three no longer share one answer -- which is the point of several of the
// tests below.
const HISTORY = [
  { playerId: 'Shaun', evidenceBefore: 5, reliabilityBefore: 5 / 15, ratingMove: 263.2, chose: 0.10 },
  { playerId: 'Tom', evidenceBefore: 4, reliabilityBefore: 4 / 14, ratingMove: 296.6, chose: 0.20 },
  { playerId: 'Fatch', evidenceBefore: 14, reliabilityBefore: 14 / 24, ratingMove: 262.9, chose: 0.20 },
];

// The constants above must stay derivable from the engine, not drift into
// hand-typed numbers that no longer mean anything.
test('the recorded decisions are self-consistent with the engine', () => {
  HISTORY.forEach((h) => {
    assert.ok(Math.abs(rel(h.evidenceBefore) - h.reliabilityBefore) < 1e-12,
      `${h.playerId}: ${h.evidenceBefore} evidence is not ${h.reliabilityBefore} reliability`);
  });
});

const fits = (rule) => HISTORY.every((h) => Math.abs(rule.apply(h) - h.chose) < 0.005);

test('every decision is the same situation, and no longer the same answer', () => {
  // Every move was most of a tier: one situation.
  HISTORY.forEach((h) => {
    const share = Math.abs(h.ratingMove) / M.TIER_WIDTH;
    assert.ok(share > 0.7 && share <= 1.0, `${h.playerId} moved ${(share * 100).toFixed(0)}% of a tier`);
  });
  // Prior evidence varied by more than 3x and changed nothing either way.
  assert.ok(Math.max(...HISTORY.map((h) => h.evidenceBefore))
    >= 3 * Math.min(...HISTORY.map((h) => h.evidenceBefore)));
  // But two answers, not one — Shaun's 10% predates the 20% floor.
  const chosen = [...new Set(HISTORY.map((h) => h.chose))].sort();
  assert.deepStrictEqual(chosen, [0.10, 0.20]);
});

// While all three shared one answer, a flat reopen and a move-scaled rule at a
// 10% floor both reproduced them exactly. Neither can now, because a rule with
// one floor cannot produce two floors.
test('no single-floor rule reproduces all three any more', () => {
  assert.ok(!fits(M.RULES.flat), 'a flat 10% misses Tom and Fatch by 10 points');
  for (let d = 50; d <= 900; d += 10) {
    assert.ok(!fits(M.RULES.moveScaled(d)),
      `a move-scaled rule at ${d} points should not fit all three`);
  }
});

// Where they differ is a board decision, not something the data settles.
test('the rule in use reproduces the two decisions taken under it', () => {
  const R = require('../assets/js/reassessment.js');
  const under = HISTORY.filter((h) => h.playerId !== 'Shaun');
  under.forEach((h) => {
    const got = R.recommendReliability({ currentReliability: h.reliabilityBefore, ratingMove: h.ratingMove });
    assert.ok(Math.abs(got.reliability - h.chose) < 0.005,
      `${h.playerId}: board ${h.chose}, rule ${got.reliability}`);
  });
  // And differs on the one that predates it, which is recorded as deliberate.
  const shaun = HISTORY.find((h) => h.playerId === 'Shaun');
  const got = R.recommendReliability({ currentReliability: shaun.reliabilityBefore, ratingMove: shaun.ratingMove });
  assert.ok(Math.abs(got.reliability - 0.20) < 1e-9);
  assert.notStrictEqual(shaun.chose, 0.20);
});

// This is the one candidate the evidence actually rules out. Fatch had 14
// matches behind him and was reopened to the same figure as Tom, who had 4.
test('scaling the prior evidence cannot fit the record, and Fatch is why', () => {
  [0.25, 0.5, 0.75].forEach((f) => {
    const rule = M.RULES.proportional(f);
    assert.ok(!fits(rule), `keeping ${f * 100}% of prior evidence should not fit`);
    const fatch = HISTORY.find((h) => h.playerId === 'Fatch');
    const tom = HISTORY.find((h) => h.playerId === 'Tom');
    assert.ok(rule.apply(fatch) > rule.apply(tom) + 0.05,
      'a proportional rule must give the better-evidenced player materially more, which the club did not');
  });
});

// While all three shared one answer this established a BOUND on D. It no
// longer establishes anything, and the script now searches for a fitting
// distance rather than assuming the smallest move is one.
test('the two decisions taken at the same floor still bound a move-scaled rule', () => {
  const pair = HISTORY.filter((h) => h.chose === 0.20);
  const fitsPair = (rule) => pair.every((h) => Math.abs(rule.apply(h) - h.chose) < 0.005);
  // The shipped rule's floor IS 20%, so any distance at or below the smaller of
  // the two moves reproduces both.
  const smaller = Math.min(...pair.map((h) => Math.abs(h.ratingMove)));
  assert.ok(smaller > 200, `expected near-tier moves, got ${smaller}`);
  const R = require('../assets/js/reassessment.js');
  [100, 150, 200, Math.floor(smaller)].forEach((d) => {
    const rule = { apply: (h) => R.recommendReliability({
      currentReliability: h.reliabilityBefore, ratingMove: h.ratingMove, params: { fullReopenPoints: d },
    }).reliability };
    assert.ok(fitsPair(rule), `${d} points should reproduce both`);
  });
});

// Properties any rule must have, whichever is chosen.
test('reassessing a rating never makes the club more confident in it', () => {
  const rules = [M.RULES.flat, M.RULES.proportional(0.5), M.RULES.moveScaled(150), M.RULES.moveScaled(300)];
  for (let evidence = 0.5; evidence <= 40; evidence += 0.5) {
    for (let move = 0; move <= 400; move += 25) {
      const facts = { evidenceBefore: evidence, reliabilityBefore: rel(evidence), ratingMove: move };
      rules.forEach((r) => {
        const out = r.apply(facts);
        assert.ok(out <= facts.reliabilityBefore + 1e-9,
          `${r.label} raised reliability from ${facts.reliabilityBefore.toFixed(3)} to ${out.toFixed(3)}`
          + ` (evidence ${evidence}, move ${move})`);
        assert.ok(out > 0 && out < 1, `${r.label} produced ${out}`);
      });
    }
  }
});

test('a bigger correction never leaves more confidence than a smaller one', () => {
  [M.RULES.moveScaled(150), M.RULES.moveScaled(300)].forEach((r) => {
    for (let evidence = 1; evidence <= 30; evidence += 1) {
      let last = Infinity;
      for (let move = 0; move <= 400; move += 10) {
        const out = r.apply({ evidenceBefore: evidence, reliabilityBefore: rel(evidence), ratingMove: move });
        assert.ok(out <= last + 1e-9, `${r.label} rose at move ${move} for evidence ${evidence}`);
        last = out;
      }
    }
  });
});

test('a move-scaled rule leaves an untouched rating untouched', () => {
  [150, 300].forEach((d) => {
    for (let evidence = 1; evidence <= 30; evidence += 1) {
      const before = rel(evidence);
      const out = M.RULES.moveScaled(d).apply({ evidenceBefore: evidence, reliabilityBefore: before, ratingMove: 0 });
      assert.ok(Math.abs(out - before) < 1e-9,
        `a reassessment that moves the rating nowhere must change nothing (evidence ${evidence})`);
    }
  });
});

// The difference that matters, stated as a number rather than an opinion.
test('the candidates agree on the cases seen and disagree on the case coming', () => {
  const settled = { evidenceBefore: 20, reliabilityBefore: rel(20), ratingMove: 30 };
  const flat = M.RULES.flat.apply(settled);
  const scaled = M.RULES.moveScaled(150).apply(settled);
  assert.ok(scaled - flat > 0.4,
    `on a 30-point correction to a 20-match player the rules should differ sharply,`
    + ` got flat ${flat.toFixed(3)} vs move-scaled ${scaled.toFixed(3)}`);

  // And on the cases already decided, they do not differ at all.
  HISTORY.forEach((h) => {
    assert.ok(Math.abs(M.RULES.flat.apply(h) - M.RULES.moveScaled(150).apply(h)) < 0.005,
      `${h.playerId} must not be able to tell the two rules apart`);
  });
});

// Reopening is paid for in matches, and the cost is arithmetic.
test('what a reopened reliability costs is exact, not fitted', () => {
  const E = Engine.effectiveEvidenceForReliability;
  assert.ok(Math.abs(E(0.10) - 10 / 9) < 1e-9);
  // Evidence rises by exactly 1 a match, so 10% is nine matches short of 50%.
  assert.strictEqual(Math.ceil(E(0.50) - E(0.10)), 9);
  assert.strictEqual(Math.ceil(E(0.50) - E(0.25)), 7);
});
