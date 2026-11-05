// ===================== MONTHLY RACE (Best Month) — TRIAL =====================
// Who had the best results this month, adjusted for how hard their matches
// actually were. A fifth story, deliberately separate from the other four:
//
//   Power Rating         who is strongest overall
//   Monthly Race         who had the best month against the matches they took
//   Monthly Performance  who most exceeded their OWN pre-match expectation
//   League               conventional result points
//   Merit                result points with a coarse tier-step adjustment
//
// THE RACE, AS PLAYERS HEAR IT. Everyone in a tier starts the month on 0.
// Each match has stakes, fixed by how hard it was for an ordinary player of
// your tier with your actual partner against your actual opponents: harder
// wins earn more, harder losses cost less. Highest qualified total at the end
// of the month had the best month.
//
// THE ARITHMETIC (approved 26 Sep; derivation in BEST_MONTH_ANALYSIS.md):
//
//   par    = chance that an ordinary member of your tier, in your seat, wins:
//            winChance( mean(tierPar, partner), mean(opponents) )
//   win    = K x (1 - par)        draw = K x (0.5 - par)        loss = -K x par
//
// "Ordinary member of your tier" is the tier's par rating for the month: the
// mean month-opening Power Rating of the players who played in that tier that
// month (a month-opening rating is the pre-match rating of a player's first
// match of the month). Your OWN rating never enters -- that is what keeps
// this a race to be best, not a race to beat your own expectation (which is
// Monthly Performance, and stays exactly as it is).
//
// WHAT IT NEVER TOUCHES. Nothing here reads or writes sequential-v1 state.
// Its inputs are canonical approved matches, the canonical historical-tier
// resolver and the persisted pre-match ratings the engine already recorded.
// It is derived on demand and never persisted.
//
// THE WIN CURVE IS NOT THE ENGINE'S. The engine's expectation predicts a
// blended score (80% game share), which is deliberately less extreme than who
// wins: favourites won 84% of matches where it predicted ~74%. A race about
// RESULTS needs a curve fitted to results, or it quietly pays for easier
// fixtures. Same Elo shape, scale 250 instead of 400, fitted to the club's 161
// decided matches (Sep 2026). A constant, never tuned by hand; refitting it is
// a methodology decision recorded in the Ledger.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MonthlyRace = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const K = 20;              // an even match is +10 / -10
  const WIN_SCALE = 250;     // results-calibrated; see above
  // Qualification, per tier spell. The default; a community with its own
  // minimum passes `minMatches` (config/club.js periodMinMatches: 4 a quarter
  // for Padel Championships, Shaun 5 Nov).
  const MIN_MATCHES = 5;
  const DRAW_RESULT = 0.5;   // a draw is half a win against par, as analysed

  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  // Points are settled to one decimal place match by match, and the total is
  // the sum of those. A drill-down then adds up on screen exactly.
  const round1 = (v) => Math.round(v * 10) / 10;

  function winChance(pairFor, pairAgainst) {
    return 1 / (1 + Math.pow(10, (pairAgainst - pairFor) / WIN_SCALE));
  }

  // What one match offers a player before it is played.
  function stakesFor(par) {
    return {
      win: round1(K * (1 - par)),
      draw: round1(K * (DRAW_RESULT - par)),
      loss: round1(-K * par),
    };
  }

  // The tier's par ratings for a month. `appearances` is every
  // (player, tier-on-the-day, pre-match rating) in date order.
  function parRatings(appearances) {
    const opening = {};
    const inTier = {};
    appearances.forEach((a) => {
      if (opening[a.player] === undefined) opening[a.player] = a.rating;
      (inTier[a.tier] = inTier[a.tier] || new Set()).add(a.player);
    });
    const par = {};
    Object.keys(inTier).forEach((t) => { par[t] = mean([...inTier[t]].map((p) => opening[p])); });
    return par;
  }

  // `matches`: ONE month of canonical approved matches, each
  //   { id, date, winners, losers, isDraw, sets? }, in the order they were played.
  // `tierAt(name, date)`: the canonical historical tier.
  // `preRating(matchId, name)`: the persisted pre-match Power Rating, or null.
  function build({ matches, tierAt, preRating, minMatches = MIN_MATCHES }) {
    const unresolved = [];
    const scored = [];
    (matches || []).forEach((m) => {
      const names = [...(m.winners || []), ...(m.losers || [])];
      if (!(m.winners || []).length || !(m.losers || []).length) return;
      const tiers = {}, ratings = {};
      let ok = true;
      names.forEach((n) => {
        tiers[n] = tierAt ? tierAt(n, m.date) : null;
        const r = preRating ? preRating(m.id, n) : null;
        ratings[n] = typeof r === 'number' && isFinite(r) ? r : null;
        if (!tiers[n] || ratings[n] === null) ok = false;
      });
      // A match nobody can be tiered or rated for is reported, never guessed at.
      if (!ok) { unresolved.push({ id: m.id, date: m.date, winners: m.winners, losers: m.losers }); return; }
      scored.push({ m, tiers, ratings });
    });

    const par = parRatings(scored.flatMap(({ m, tiers, ratings }) =>
      [...m.winners, ...m.losers].map((n) => ({ player: n, tier: tiers[n], rating: ratings[n] }))));

    const rows = {};
    scored.forEach(({ m, tiers, ratings }) => {
      const sides = [[m.winners, m.losers, m.isDraw ? 'D' : 'W'], [m.losers, m.winners, m.isDraw ? 'D' : 'L']];
      sides.forEach(([mine, theirs, result]) => mine.forEach((n) => {
        const tier = tiers[n];
        const partner = mine.filter((x) => x !== n);
        const parWin = winChance(mean([par[tier], ...partner.map((x) => ratings[x])]), mean(theirs.map((x) => ratings[x])));
        const stakes = stakesFor(parWin);
        const points = result === 'W' ? stakes.win : result === 'D' ? stakes.draw : stakes.loss;
        const key = n + '\u0000' + tier;
        const row = rows[key] || (rows[key] = {
          playerId: n, tier, played: 0, wins: 0, draws: 0, losses: 0, score: 0, matches: [],
        });
        row.played++;
        if (result === 'W') row.wins++; else if (result === 'D') row.draws++; else row.losses++;
        row.score = round1(row.score + points);
        row.matches.push({
          id: m.id, date: m.date, result, points, stakes, parWin,
          partner: partner.map((x) => ({ playerId: x, tier: tiers[x], rating: ratings[x] })),
          opponents: theirs.map((x) => ({ playerId: x, tier: tiers[x], rating: ratings[x] })),
          sets: m.sets || null,
        });
      }));
    });

    const table = Object.values(rows).map((r) => ({ ...r, qualified: r.played >= minMatches }));
    // Qualified first; within each, the race score. Ties go to more wins, then
    // fewer matches (the same total off fewer games), then name.
    table.sort((a, b) => (b.qualified - a.qualified)
      || b.score - a.score || b.wins - a.wins || a.played - b.played
      || String(a.playerId).localeCompare(String(b.playerId)));
    return { table, par, unresolved };
  }

  return { K, WIN_SCALE, MIN_MATCHES, DRAW_RESULT, winChance, stakesFor, parRatings, build };
});
