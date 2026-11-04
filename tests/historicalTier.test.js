// Tier is temporal. A display that shows today's tier against a past month
// quietly rewrites history -- a June Tier C king disappears the moment he is
// promoted in July, and reappears in Tier B's June honours board.
//
// These tests exist because that is not hypothetical: the application built its
// monthly views with `TIER_MAP`, which is still empty when the v3 state loads,
// so `tierAsOf()` answered `undefined` for every player outside the
// authoritative change list. Every historical tier, within-tier rank and
// tier-change flag in the shipped app was missing, and nothing failed.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const MV = require('../assets/js/monthlyViews.js');
const TH = require('../assets/js/tierHistory.js');
const D = require('./helpers/dataset.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');

const ROOT = path.join(__dirname, '..');

let cached = null;
function views() {
  if (!cached) {
    const { replay } = buildBackfill();
    const history = TH.create({ currentTiers: D.loadBaseTiers() });
    cached = { v: MV.build(replay.journey, { tierAsOf: history.tierAsOf }), replay, history };
  }
  return cached;
}

test('an empty currentTiers map is refused, not silently answered as undefined', () => {
  assert.throws(() => TH.create({ currentTiers: {} }), /empty map silently erases/);
  assert.throws(() => TH.create({}), /requires currentTiers/);
});

test('a player who changed tier but has no current tier is an error, not a shrug', () => {
  // Shaun is in the authoritative change list; leaving him out of the current
  // tiers is exactly the gap that let an empty map pass validation.
  const partial = { ...D.loadBaseTiers() };
  delete partial.Shaun;
  assert.throws(() => TH.create({ currentTiers: partial }),
    /Shaun has a recorded tier change but no current tier/);
});

test('every monthly row carries a real historical tier -- never undefined', () => {
  const { v } = views();
  v.months.forEach((m) => {
    v.byMonth[m].rows.concat(v.byMonth[m].inactiveRows).forEach((r) => {
      assert.ok(r.tierAtMonthEnd, `${m} ${r.playerId}: tierAtMonthEnd is ${r.tierAtMonthEnd}`);
      assert.ok(r.endRankInTier > 0, `${m} ${r.playerId}: no within-tier rank`);
    });
  });
});

test('the tier shown for a past month is the tier held then, not the tier held now', () => {
  const { v } = views();
  const current = D.loadBaseTiers();
  // The three authoritative changes, each verified on both sides of its date.
  const expected = [
    ['Shaun', '2026-06', 'C'], ['Shaun', '2026-07', 'B'],
    ['Tom', '2026-06', 'C'], ['Tom', '2026-07', 'B'],
    ['Fatch', '2026-07', 'C'], ['Fatch', '2026-08', 'B'],
  ];
  expected.forEach(([who, month, tier]) => {
    const row = MV.playerMonth(v, month, who);
    assert.ok(row, `${who} has no ${month} row`);
    assert.strictEqual(row.tierAtMonthEnd, tier,
      `${who} was Tier ${tier} at the end of ${month}`);
  });
  // And each of them really does read differently today, so the test is not
  // passing by coincidence.
  ['Shaun', 'Tom', 'Fatch'].forEach((who) => {
    assert.strictEqual(current[who], 'B');
    assert.notStrictEqual(MV.playerMonth(v, '2026-06', who) && MV.playerMonth(v, '2026-06', who).tierAtMonthEnd, 'B');
  });
});

test('June has a Tier C leader, and it is the player who was Tier C in June', () => {
  const { v } = views();
  const byTier = {};
  v.byMonth['2026-06'].rows.forEach((r) => {
    (byTier[r.tierAtMonthEnd] = byTier[r.tierAtMonthEnd] || []).push(r);
  });
  ['A', 'B', 'C'].forEach((t) => {
    assert.ok(byTier[t] && byTier[t].length, `June had nobody in Tier ${t}`);
  });
  const c = byTier.C.slice().sort((a, b) => b.endRating - a.endRating)[0];
  assert.strictEqual(c.playerId, 'Shaun');
  assert.strictEqual(c.endRankInTier, 1);
});

test('the application builds its monthly views from v3 tiers, not the empty TIER_MAP', () => {
  const app = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'app.js'), 'utf8');
  const code = app.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter((l) => !l.trim().startsWith('//')).join('\n');
  const call = code.match(/TierHistory\.create\(\s*\{[^}]*\}\s*\)/);
  assert.ok(call, 'app.js must build a tier history');
  assert.ok(/V3Bridge\.tierMap/.test(call[0]),
    'currentTiers must come from v3 state; TIER_MAP is still empty at that point');
  assert.ok(!/currentTiers:\s*TIER_MAP/.test(code), 'TIER_MAP is not populated when the views are built');
});

test('the rankings filter, podium and Kings panel all scope tier to the selected month', () => {
  const { appScriptFiles, readAppScript } = require('./helpers/appSource.js');
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter((l) => !l.trim().startsWith('//')).join('\n');
  const all = appScriptFiles().map((f) => code(readAppScript(f))).join('\n');
  // The old shape compared today's tier against the selected tier filter.
  assert.ok(!/activeTier\s*===\s*'All'\s*\|\|\s*p\.tier\s*===\s*activeTier/.test(all),
    'tier filtering must go through tierInScope, not p.tier');
  assert.ok(!/rows\.filter\(p=>p\.tier===tier\)/.test(all.replace(/\s/g, '')),
    'the Kings panel must group by the tier held in the selected month');
  assert.strictEqual((all.match(/function tierInScope/g) || []).length, 1,
    'there must be exactly one answer to "which tier, in this scope"');
});
