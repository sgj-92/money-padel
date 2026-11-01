// ===================== RECORD AGAINST EACH TIER =====================
// Shaun, 1 Nov: "how a player faces up against his own (and other) tiers.
// This helps promotion and relegation checks." A summary per player -- their
// record against Tier A, B, C (and S) opponents -- then a breakdown against
// each opponent.
//
// The rule, said once:
//   * Tiers are the ones held ON THE MATCH DATE (the caller's `tierAt`), so a
//     win over someone in Tier A in August is a win over Tier A even if they
//     are in Tier B today.
//   * Each match counts once for EACH opponent. Doubles has two: beating a
//     Tier A and a Tier B player is a win against Tier A and a win against
//     Tier B. The per-tier figures are therefore results against players of
//     that tier, not matches; a player's matches are counted separately.
//   * Draws are counted as draws, never as wins or losses.
//
// Pure: given matches and a tier lookup, returns figures. No app state.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TierRecord = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const blank = () => ({ wins: 0, draws: 0, losses: 0, played: 0 });

  function add(rec, result) {
    rec.played++;
    if (result === 'W') rec.wins++;
    else if (result === 'D') rec.draws++;
    else rec.losses++;
  }

  // Win share of games against them: draws in the denominator, as every
  // record in the app has them (15 Oct).
  function pct(rec) { return rec && rec.played ? Math.round((100 * rec.wins) / rec.played) : null; }

  // matches: [{ date, winners: [..], losers: [..], isDraw }]
  // tierAt(name, date) -> 'S' | 'A' | 'B' | 'C' | null
  function build({ matches, tierAt }) {
    const players = {};
    const row = (name) => players[name] || (players[name] = { player: name, matches: 0, vs: {}, opponents: {} });
    (matches || []).forEach((m) => {
      const sides = [[m.winners || [], m.losers || [], m.isDraw ? 'D' : 'W'], [m.losers || [], m.winners || [], m.isDraw ? 'D' : 'L']];
      sides.forEach(([mine, theirs, result]) => {
        mine.forEach((name) => {
          const r = row(name);
          r.matches++;
          theirs.forEach((opp) => {
            const tier = tierAt(opp, m.date) || '?';
            add(r.vs[tier] || (r.vs[tier] = blank()), result);
            const o = r.opponents[opp] || (r.opponents[opp] = { name: opp, tiers: {}, ...blank() });
            add(o, result);
            o.tiers[tier] = (o.tiers[tier] || 0) + 1;
          });
        });
      });
    });
    return Object.values(players).map((r) => ({
      ...r,
      opponents: Object.values(r.opponents).map((o) => ({
        ...o,
        // The tier they were in most often when they met (ties: the latest
        // alphabetically is as good as any -- they are named as tiers).
        tier: Object.keys(o.tiers).sort((a, b) => o.tiers[b] - o.tiers[a] || a.localeCompare(b))[0],
      })),
    }));
  }

  return { build, pct };
});
