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

// Shaun, 2 Nov: in Compare -- pick a player, see their record against everyone
// (grouped by the opponent's tier), tap one for the full head to head. The
// League's Vs Tiers table it replaced was "quite confusing".
maybe('Compare › Everyone: one player against every opponent, grouped by tier; a tap opens the one-on-one', async () => {
  const app = await H.open({ viewport: { width: 360, height: 800 }, mobile: true });
  try {
    const r = await app.run(() => {
      document.querySelector('#tabrow .tab-btn[data-tab="h2h"]').click();
      h2hPlayerA = null; h2hPlayerB = null; h2hMonth = 'all'; renderH2H();
      const byDefault = document.getElementById('h2hSelectB').value;
      const firstOption = document.getElementById('h2hSelectB').options[0].text;
      const A = h2hPlayerA;
      const want = TierRecord.build({ matches: matchesIncludingDraws().filter((m) => [...m.winners, ...m.losers].includes(A)), tierAt: (n, d) => historicalTierOf(n, d) }).find((x) => x.player === A);
      const heads = [...document.querySelectorAll('.h2h-group-head span:first-child')].map((e) => e.textContent);
      const rows = [...document.querySelectorAll('.h2h-all-row')].map((tr) => [...tr.children].map((c) => c.textContent.replace('›', '').trim()));
      const fits = { page: document.documentElement.scrollWidth > window.innerWidth + 1, cells: [...document.querySelectorAll('.h2h-all td, .h2h-all th')].filter((c) => c.scrollWidth > c.clientWidth + 1).length };
      const leagueOptions = (() => { legacyTabBtn('summary').click(); return [...document.querySelectorAll('#summaryModeSelect option')].map((o) => o.value); })();
      document.querySelector('#tabrow .tab-btn[data-tab="h2h"]').click();
      const target = document.querySelector('.h2h-all-row');
      const opp = target.dataset.h2hOpp;
      target.click();
      return { byDefault, firstOption, A, want, heads, rows, fits, leagueOptions, opp, nowB: h2hPlayerB, oneOnOne: /meetings? as opponents/.test(document.getElementById('h2hView').textContent) };
    });
    assert.strictEqual(r.byDefault, '__everyone__', 'Compare opens on a player against everyone');
    assert.strictEqual(r.firstOption, 'Everyone');
    assert.ok(r.heads.length >= 1 && r.heads.every((h) => /^Against Tier [SABC?]/.test(h)));
    assert.strictEqual(r.rows.length, r.want.opponents.length, 'every opponent, once');
    r.rows.forEach(([name, p, w, d, l, pct]) => {
      const o = r.want.opponents.find((x) => x.name === name);
      assert.deepStrictEqual([+p, +w, +d, +l], [o.played, o.wins, o.draws, o.losses], name);
      assert.strictEqual(pct, `${Math.round(100 * o.wins / o.played)}%`);
    });
    assert.deepStrictEqual(r.fits, { page: false, cells: 0 }, 'fits a 360px phone');
    assert.ok(!r.leagueOptions.includes('vstiers'), 'the League\'s Vs Tiers view is gone');
    assert.strictEqual(r.nowB, r.opp);
    assert.strictEqual(r.oneOnOne, true);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
