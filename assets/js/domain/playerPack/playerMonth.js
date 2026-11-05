// ===================== PLAYER MONTHLY PACK: ONE PLAYER'S MONTH =====================
// The month from one player's side: their record, the team-tier matchups
// they played, their partners and opponents, their best and weaker results,
// and evidence-based prompts for next month. Built from the month's approved
// matches, the historical tier on each match's own date, and the facts the
// engine stored for each match. It calculates no rating and no expectation:
// every rating figure is read from the stored facts it is given.
//
// MATCHUP COMPOSITION (defined once, here). A team's label is its players'
// tiers ON THE MATCH DATE, ordered S > A > B > C, so the label does not
// depend on who is named first: B+A and A+B are both "AB". A matchup is
// "<my team> vs <their team>" from the chosen player's side: playing with a
// B against an A and a B, a Tier B player's matchup is "BB vs AB". A tier
// that cannot be established is "?". A singles side is one letter.
//
// Pure: no page, no app state.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.PlayerMonth = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  // Who won, drew or lost is asked of MatchOutcome, never worked out here: on
  // a draw, `winners` and `losers` are only the two sides.
  const outcome = () => {
    if (root && root.MatchOutcome) return root.MatchOutcome;
    if (typeof require === 'function') return require('../../matchOutcome.js');
    throw new Error('PlayerMonth needs MatchOutcome');
  };
  const TIER_ORDER = ['S', 'A', 'B', 'C'];
  const rankOf = (t) => { const i = TIER_ORDER.indexOf(t); return i === -1 ? TIER_ORDER.length : i; };

  function teamLabel(tiers) {
    return tiers.map((t) => (TIER_ORDER.includes(t) ? t : '?')).sort((a, b) => rankOf(a) - rankOf(b)).join('');
  }

  const sum = (sets, i) => (sets || []).reduce((s, set) => s + (Number(set[i]) || 0), 0);
  const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);

  // One match from `player`'s side, or null when they did not play in it.
  function side(match, player, tierOf) {
    const MO = outcome();
    const result = MO.letterFor(match, player);
    if (!result) return null;
    const { mine, theirs } = MO.sidesFor(match, player);
    // Which column of each set is theirs: the side they were filed on.
    const onWinners = match.winners.includes(player);
    const gf = onWinners ? sum(match.sets, 0) : sum(match.sets, 1);
    const ga = onWinners ? sum(match.sets, 1) : sum(match.sets, 0);
    const myTeam = teamLabel(mine.map((n) => tierOf(n, match.date)));
    const theirTeam = teamLabel(theirs.map((n) => tierOf(n, match.date)));
    return {
      id: match.id, date: match.date, order: match.sourceIndex || 0,
      result,
      partners: mine.filter((n) => n !== player), opponents: theirs.slice(),
      myTier: tierOf(player, match.date) || null,
      mine: myTeam, theirs: theirTeam, label: `${myTeam} vs ${theirTeam}`,
      gf, ga, sets: match.sets,
    };
  }

  function tally() { return { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 }; }
  function add(t, m) {
    t.played++; t.gf += m.gf; t.ga += m.ga;
    if (m.result === 'W') t.wins++; else if (m.result === 'D') t.draws++; else t.losses++;
    return t;
  }
  function finish(t) { return Object.assign(t, { gd: t.gf - t.ga, winpct: pct(t.wins, t.played) }); }

  function groupBy(matches, keysOf) {
    const out = {};
    matches.forEach((m) => keysOf(m).forEach((k) => add(out[k] = out[k] || tally(), m)));
    return Object.entries(out).map(([key, t]) => Object.assign({ key }, finish(t)));
  }

  // ---- The month ---------------------------------------------------------
  // `matches`: the month's approved matches (draws included). `tierOf(name,
  // date)`: the historical tier. `factsOf(matchId)`: what the engine stored
  // for this player in that match -- { ratingDelta, expected, actual,
  // residual } -- or null. `meritOf(matchId)`: Merit's own classification of
  // a win -- { kind, steps, points } -- or null.
  function build({ player, month, matches, tierOf, factsOf, meritOf }) {
    const mine = (matches || [])
      .filter((m) => (typeof Period !== 'undefined' ? Period : require('../../config/period.js')).of(m.date) === month)
      .map((m) => side(m, player, tierOf))
      .filter(Boolean)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order))
      .map((m) => {
        const f = factsOf ? factsOf(m.id) : null;
        const mer = meritOf && m.result === 'W' ? meritOf(m.id) : null;
        return Object.assign(m, {
          share: m.gf + m.ga ? pct(m.gf, m.gf + m.ga) : 0,
          ratingDelta: f ? f.ratingDelta : null, residual: f ? f.residual : null,
          merit: mer || null,
        });
      });

    const record = finish(mine.reduce(add, tally()));
    const byPlayed = (a, b) => b.played - a.played || (b.wins - b.losses) - (a.wins - a.losses) || b.gd - a.gd || String(a.key).localeCompare(String(b.key));
    const matchupTypes = groupBy(mine, (m) => [m.label]).map((t) => {
      const ex = mine.find((m) => m.label === t.key);
      return Object.assign(t, { label: t.key, mine: ex.mine, theirs: ex.theirs });
    }).sort(byPlayed);
    const partners = groupBy(mine, (m) => m.partners).map((t) => Object.assign(t, { name: t.key })).sort(byPlayed);
    const opponents = groupBy(mine, (m) => m.opponents).map((t) => Object.assign(t, { name: t.key })).sort(byPlayed);

    // The longest unbroken run of wins, in the order the month was played.
    let run = 0, best = { length: 0, from: null, to: null }, start = null;
    mine.forEach((m) => {
      if (m.result === 'W') { if (!run) start = m.date; run++; if (run > best.length) best = { length: run, from: start, to: m.date }; }
      else run = 0;
    });

    return { player, month, record, matches: mine, matchupTypes, partners, opponents, winRun: best };
  }

  // ---- Best and weaker ----------------------------------------------------
  const maxBy = (list, f) => list.reduce((b, x) => (f(x) !== null && f(x) !== undefined && (b === null || f(x) > f(b)) ? x : b), null);
  const minBy = (list, f) => list.reduce((b, x) => (f(x) !== null && f(x) !== undefined && (b === null || f(x) < f(b)) ? x : b), null);

  function bestResults(model) {
    const wins = model.matches.filter((m) => m.result === 'W');
    const hard = wins.filter((m) => m.merit && m.merit.kind === 'hard');
    return {
      hardestWin: maxBy(hard, (m) => m.merit.steps * 100 + m.merit.points) || null,
      // Only a match that actually beat expectation is "above" it.
      bestVsExpectation: maxBy(model.matches.filter((m) => m.residual > 0), (m) => m.residual),
      biggestGain: maxBy(model.matches.filter((m) => m.ratingDelta > 0), (m) => m.ratingDelta),
      bestShare: maxBy(model.matches, (m) => m.share),
      winRun: model.winRun.length >= 2 ? model.winRun : null,
    };
  }

  // Weaker results are reported only with a sample of at least `min`: one
  // match is not a pattern.
  function weakerResults(model, { min = 2 } = {}) {
    const net = (t) => t.wins - t.losses;
    const enough = (list) => list.filter((t) => t.played >= min);
    const worst = (list) => { const w = minBy(enough(list), (t) => net(t) * 1000 + t.gd); return w && (w.losses > w.wins) ? w : null; };
    return {
      min,
      matchup: worst(model.matchupTypes),
      opponent: worst(model.opponents),
      partner: worst(model.partners),
      biggestDrop: minBy(model.matches.filter((m) => m.ratingDelta < 0), (m) => m.ratingDelta),
    };
  }

  // ---- Next-month targets ------------------------------------------------
  // What to play, never whom to beat. Each target is one of four transparent
  // rules over the month's own record, carries its reason and its sample, and
  // the rules are applied in this order:
  //   1 rematch    an opponent met `minRival`+ times, level or within one
  //                result (|W - L| <= 1)
  //   2 partner    a partner played with 2+ times with more wins than losses
  //   3 evidence   a matchup type played exactly once
  //   4 own tier   fewer than half of 3+ matches were all four players in the
  //                player's own month-end tier
  const recordText = (t) => `${t.wins}W ${t.draws}D ${t.losses}L`;
  const gamesText = (n) => `${n} game${n === 1 ? '' : 's'}`;

  function targets(model, { minRival = 2, max = 3, currentTier = null } = {}) {
    const out = [];
    model.opponents
      .filter((t) => t.played >= minRival && Math.abs(t.wins - t.losses) <= 1)
      .sort((a, b) => b.played - a.played || Math.abs(a.gd) - Math.abs(b.gd) || a.name.localeCompare(b.name))
      .forEach((t) => out.push({ kind: 'rematch', title: `Play ${t.name} again`, subject: t.name, sample: t.played,
        reason: `${recordText(t)} against ${t.name} this month, ${t.gd === 0 ? 'level on games' : `${gamesText(Math.abs(t.gd))} between you`} over ${t.played} matches.` }));
    model.partners
      .filter((t) => t.played >= 2 && t.wins > t.losses)
      .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || b.played - a.played || a.name.localeCompare(b.name))
      .forEach((t) => out.push({ kind: 'partner', title: `Another match with ${t.name}`, subject: t.name, sample: t.played,
        reason: `${recordText(t)} together over ${t.played} matches this month.` }));
    model.matchupTypes
      .filter((t) => t.played === 1 && !t.label.includes('?'))
      .forEach((t) => out.push({ kind: 'evidence', title: `More ${t.label}`, subject: t.label, sample: 1,
        reason: `Only 1 match in ${t.label} this month (${recordText(t)}).` }));
    if (currentTier && model.record.played >= 3) {
      const own = currentTier + currentTier;
      const inTier = model.matches.filter((m) => m.mine === own && m.theirs === own).length;
      if (inTier * 2 < model.record.played) {
        out.push({ kind: 'tier', title: `Play more within Tier ${currentTier}`, subject: currentTier, sample: model.record.played,
          reason: `${inTier} of ${model.record.played} matches this month were all-Tier ${currentTier}.` });
      }
    }
    return out.slice(0, max);
  }

  return { TIER_ORDER, teamLabel, side, build, bestResults, weakerResults, targets };
});
