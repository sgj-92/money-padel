// ===================== RECORD AGAINST EACH TIER =====================
// Shaun, 1 Nov: how a player fares against their own tier and the others, for
// promotion and relegation checks -- a summary, then each opponent.

const test = require('node:test');
const assert = require('node:assert');
const TR = require('../assets/js/domain/matches/tierRecord.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

// Tiers by date: Bo moves from B to A on 1 Sep.
const TIERS = { Al: 'A', Cy: 'B', Di: 'C', Ed: 'A' };
const tierAt = (n, d) => (n === 'Bo' ? (d < '2026-09-01' ? 'B' : 'A') : TIERS[n]);
const M = (date, winners, losers, isDraw) => ({ date, winners, losers, isDraw: !!isDraw });

test('each match counts once per opponent, under the tier they held that day; draws are draws', () => {
  const rows = TR.build({ tierAt, matches: [
    M('2026-08-10', ['Al', 'Cy'], ['Bo', 'Di']),        // Al beats Bo (B then) and Di (C)
    M('2026-09-10', ['Bo', 'Ed'], ['Al', 'Cy']),        // Al loses to Bo (A now) and Ed (A)
    M('2026-09-20', ['Al', 'Di'], ['Cy', 'Ed'], true),  // Al draws with Cy (B) and Ed (A)
  ] });
  const al = rows.find((r) => r.player === 'Al');
  assert.strictEqual(al.matches, 3, 'matches are matches');
  assert.deepStrictEqual(al.vs.A, { wins: 0, draws: 1, losses: 2, played: 3 });
  assert.deepStrictEqual(al.vs.B, { wins: 1, draws: 1, losses: 0, played: 2 });
  assert.deepStrictEqual(al.vs.C, { wins: 1, draws: 0, losses: 0, played: 1 });
  const bo = al.opponents.find((o) => o.name === 'Bo');
  assert.deepStrictEqual([bo.wins, bo.losses, bo.played], [1, 1, 2]);
  assert.deepStrictEqual(bo.tiers, { B: 1, A: 1 }, 'met once in each tier');
  assert.strictEqual(TR.pct(al.vs.B), 50, 'a draw is in the denominator');
  assert.strictEqual(TR.pct({ played: 0 }), null);
  // Every opponent result adds up: per-tier totals equal per-opponent totals.
  rows.forEach((r) => {
    const byTier = Object.values(r.vs).reduce((n, x) => n + x.played, 0);
    const byOpp = r.opponents.reduce((n, o) => n + o.played, 0);
    assert.strictEqual(byTier, byOpp, r.player);
  });
});

maybe('League › Vs Tiers: players grouped by tier, a column per tier, own tier marked; a tap opens each opponent', async () => {
  const app = await H.open({ viewport: { width: 360, height: 800 }, mobile: true });
  try {
    const r = await app.run(() => {
      legacyTabBtn('summary').click();
      summaryMonth = 'all'; summaryMode = 'vstiers'; tierRecordOpen = null; renderSummary();
      const options = [...document.querySelectorAll('#summaryModeSelect option')].map((o) => o.value);
      const tables = [...document.querySelectorAll('#summaryContent .tr-table')];
      const first = tables[0].querySelector('.tr-row');
      const name = first.dataset.trPlayer;
      const heads = [...tables[0].querySelectorAll('thead th')].map((h) => h.textContent.trim());
      const ownCol = tables[0].querySelector('th.is-own').textContent.trim();
      const want = TierRecord.build({ matches: matchesIncludingDraws(), tierAt: (n, d) => historicalTierOf(n, d) }).find((x) => x.player === name);
      const cells = [...first.querySelectorAll('.tr-cell')].map((c) => c.innerText.replace(/\s+/g, ' ').trim());
      first.click();
      const drill = document.querySelector('#summaryContent .tr-break');
      const oppRows = drill.querySelectorAll('.tr-opp').length;
      const fits = { page: document.documentElement.scrollWidth > window.innerWidth + 1, cells: [...document.querySelectorAll('#summaryContent .tr-table td, #summaryContent .tr-table th')].filter((c) => c.scrollWidth > c.clientWidth + 1).length };
      return { options, name, heads, ownCol, ownTier: tierRecordOwnTier(name, 'all'), cells, want, oppRows, fits };
    });
    assert.ok(r.options.includes('vstiers'));
    assert.strictEqual(r.heads[0], 'Player');
    assert.strictEqual(r.ownCol, `v ${r.ownTier}`, 'the own-tier column is the one marked');
    const cols = r.heads.slice(2).map((h) => h.replace('v ', ''));
    cols.forEach((t, i) => {
      const rec = r.want.vs[t];
      const want = rec && rec.played ? `${Math.round(100 * rec.wins / rec.played)}% ${rec.wins}-${rec.draws}-${rec.losses}` : '–';
      assert.strictEqual(r.cells[i], want, `${r.name} v ${t}`);
    });
    assert.strictEqual(r.oppRows, r.want.opponents.length, 'every opponent, once');
    assert.deepStrictEqual(r.fits, { page: false, cells: 0 }, 'fits a 360px phone');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
