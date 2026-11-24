// ===================== TIER S SECTIONS =====================
// With one Tier S player, a whole Tier S section is mostly empty screen. The
// club can hide the SECTION from tier-grouped views (Admin › Visible to
// everyone) -- the player stays in Power Rankings, the month's results table
// and everything else, and no figure changes.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-28T12:00:00.000Z';

// What every tier-grouped view shows for September, and where Manny (the
// one Tier S player) still appears.
const look = () => {
  const sections = (mode) => { summaryMonth = '2026-09'; summaryMode = mode; leagueGrouped = true; leagueLastTen = false; renderSummary();
    // The tier sections (the race's All tiers table, 21 Nov, is not a tier).
    return [...document.querySelectorAll('#summaryContent .lg-tier-head')].map((h) => h.dataset.tier).filter((t) => t !== 'ALL'); };
  const kingsStub = computeKingsOfTiers;
  // The seeded record never gives Tier S a field; give the panel one.
  computeKingsOfTiers = () => ({ S: { name: 'Manny', rating: 1800, currentTier: 'S' }, A: { name: 'Kaz', rating: 1735, currentTier: 'A' }, _fieldSize: { S: 2, A: 4 } });
  document.getElementById('rankingsHonours') && document.getElementById('rankingsHonours').remove();
  const tab = activeTab; activeTab = 'power';
  renderKingsOfTiersPanel();
  activeTab = tab;
  const kingTiles = [...document.querySelectorAll('#rankingsHonours [data-rk-king]')].map((c) => c.dataset.rkKing);
  computeKingsOfTiers = kingsStub;
  const d = (id, o) => boardPackModuleData({ id, options: Object.assign(BoardPack.defaultOptions(id), o || {}) }, '2026-09');
  return {
    league: sections('league'), merit: sections('merit'), race: sections('race'), kingTiles,
    pack: { league: d('league').tiers.map((t) => t.tier), race: d('race', { provisional: 'show' }).tiers.map((t) => t.tier), tierOption: d('league', { tier: 'S' }).tiers.length },
    // Manny is still in everything that is not a tier section.
    manny: {
      results: d('results_table', { split: 'one' }).rows.some((r) => r.name === 'Manny'),
      // Split by tier, the Tier S section follows the switch -- and says so.
      splitResults: [d('results_table').rows.some((r) => r.name === 'Manny'), d('results_table').sHidden],
      stats: !!computeMonthlySummaryStats('2026-09').Manny,
      split: leagueSplitRows('2026-09').some((r) => r.name === 'Manny'),
      race: buildMonthlyRace('2026-09').table.some((r) => r.playerId === 'Manny'),
      players: PLAYERS.some((p) => p.name === 'Manny'),
    },
  };
};

maybe('Tier S sections: shown by default, hidden club-wide from the Admin switch, and the player stays in the data', async () => {
  const app = await H.open({ now: NOW });
  try {
    const before = await app.run(look);
    assert.deepStrictEqual([before.league[0], before.merit[0], before.race[0], before.kingTiles[0], before.pack.league[0], before.pack.race[0]], ['S', 'S', 'S', 's', 'S', 'S'], 'unchanged until the club switches it off');

    await app.run(() => { isUnlocked = true; adminRole = 'owner'; legacyTabBtn('manage').click(); renderManage(); document.querySelector('[data-acc-toggle="visibility"]').click(); });
    assert.strictEqual(await app.page.textContent('#tierSToggle'), 'Shown');
    const figures = await app.run(() => JSON.stringify([computeMonthlySummaryStats('2026-09'), buildMonthlyRace('2026-09').table, PLAYERS.map((p) => [p.name, p.rating, p.tier])]));
    await app.page.click('#tierSToggle');
    await app.page.waitForFunction(() => document.getElementById('tierSToggle').textContent === 'Hidden');
    const saved = await app.run(() => JSON.parse(window.__writes.filter((w) => w.id === 'moneypadel_visibility').at(-1).doc.value));
    assert.strictEqual(saved.tierSSections, false);

    const after = await app.run(look);
    assert.ok(!after.league.includes('S') && !after.merit.includes('S') && !after.race.includes('S'), JSON.stringify(after));
    assert.deepStrictEqual([after.league.length, after.merit.length], [before.league.length - 1, before.merit.length - 1], 'only the S section went');
    assert.deepStrictEqual(after.kingTiles, ['a']);
    assert.ok(!after.pack.league.includes('S') && !after.pack.race.includes('S'));
    assert.strictEqual(after.pack.tierOption, 0);
    assert.deepStrictEqual(after.manny, { results: true, splitResults: [false, true], stats: true, split: true, race: true, players: true });
    assert.deepStrictEqual(before.manny.splitResults, [true, false], 'shown by default, in its own Tier S section');
    assert.strictEqual(await app.run(() => JSON.stringify([computeMonthlySummaryStats('2026-09'), buildMonthlyRace('2026-09').table, PLAYERS.map((p) => [p.name, p.rating, p.tier])])), figures, 'no figure changes');

    // Admins are not exempt: it is a layout choice, not a permission.
    assert.strictEqual(await app.run(() => isUnlocked), true);
    await app.page.click('#tierSToggle');
    await app.page.waitForFunction(() => document.getElementById('tierSToggle').textContent === 'Shown');
    assert.deepStrictEqual((await app.run(look)).league, before.league);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }

  // Saved hidden: a player opening the app sees it hidden too.
  const player = await H.open({ now: NOW, club: { moneypadel_visibility: { tierSSections: false } } });
  try {
    assert.strictEqual(await player.run(() => isUnlocked), false);
    const r = await player.run(look);
    assert.ok(!r.league.includes('S') && !r.race.includes('S') && !r.kingTiles.includes('s'));
  } finally { await player.close(); }
});
