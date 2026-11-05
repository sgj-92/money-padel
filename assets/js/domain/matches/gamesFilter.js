// ===================== GAMES FILTER =====================
// Which games a set of filters leaves, and one player's record over them.
//
// These are facts, not presentation, so they live here rather than inside the
// screen that happens to show them. Any screen that lists filtered games -- the
// Games log today, a redesigned Play › Results tomorrow -- asks this module and
// draws what it returns. Two screens that each filtered and tallied for
// themselves would eventually disagree about the same games.
//
// PURE. It reads nothing global: the match list, the classifier, the id
// mapping and the three helper modules it leans on are all passed in (the
// helpers default to the page's globals in the browser and to require() in
// Node). It writes nothing and never touches the DOM.
//
// Two rules carried over unchanged from the Games screen that used to hold
// this logic:
//   - every filter layers, and the game-type options offered are built from
//     what survives the OTHER filters (month and players), so the control
//     never offers a type that would show nothing; a selected type that no
//     longer exists under them falls back to 'all' BEFORE filtering;
//   - the record is counted from exactly the games returned, so P is the
//     number of rows a screen lists by construction, and W + D + L = P.

(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GamesFilter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const lib = (name, file) => {
    if (root && root[name]) return root[name];
    if (typeof require === 'function') return require(file);
    throw new Error(`GamesFilter needs ${name}`);
  };

  // The final filtered set, in the order a screen lists it (newest first).
  //
  //   matches     the approved games to choose from
  //   filters     { month: 'YYYY-MM' | 'all', type: 'all' | 'cat:…' | 'match:…',
  //                 playerIds: [canonical ids] }
  //   deps        { gameTypeOf(m) -> {matchup, category} | null, toId(name) -> id,
  //                 GameType?, PlayerFilter? }
  //
  // Returns { games, typeOptions, type } -- `type` is the filter actually
  // applied, after the fallback, so a caller can put it back in its state.
  function apply(matches, filters, deps) {
    const f = filters || {};
    const d = deps || {};
    const GameType = d.GameType || lib('GameType', '../../gameType.js');
    const PlayerFilter = d.PlayerFilter || lib('PlayerFilter', '../../playerFilter.js');
    const month = f.month || 'all';
    const playerIds = f.playerIds || [];
    let type = f.type || 'all';

    let games = (matches || []).slice();
    if (month !== 'all') {
      const period = typeof Period !== 'undefined' ? Period : require('../../config/period.js');
      games = games.filter((m) => period.of(m.date) === month);
    }

    const typeScope = PlayerFilter.filter(games, playerIds, d.toId);
    const typeOptions = GameType
      ? GameType.optionsFrom(typeScope.map(d.gameTypeOf).filter(Boolean))
      : { categories: [], matchups: [] };
    const available = ['all'].concat(
      typeOptions.categories.map((o) => o.value), typeOptions.matchups.map((o) => o.value));
    if (!available.includes(type)) type = 'all';
    if (type !== 'all' && GameType) games = games.filter((m) => GameType.matches(type, d.gameTypeOf(m)));

    games = PlayerFilter.filter(games, playerIds, d.toId);
    // The comparator the Games log has always used; kept exactly, so the order
    // of same-day games cannot change.
    games.sort((a, b) => (a.date < b.date ? 1 : -1));
    return { games, typeOptions, type };
  }

  // One player's record over EXACTLY `games`, from their own side.
  //
  // The player is matched by canonical id, as the filter matched them, so a
  // renamed player's games all count. Each result is read by MatchOutcome from
  // the recorded outcome: a draw is a draw whichever side the player was filed
  // on. Win rate is wins over games played, draws included, to 0.1 -- the
  // League's monthly win-percentage definition. Not a rating, not a table
  // figure: a count of the games handed in.
  function record(games, playerId, toId, MatchOutcomeLib) {
    const MO = MatchOutcomeLib || lib('MatchOutcome', '../../matchOutcome.js');
    const id = String(playerId).toLowerCase();
    const map = toId || ((n) => n);
    const rec = { played: 0, wins: 0, draws: 0, losses: 0, winpct: null };
    (games || []).forEach((m) => {
      const name = (m.winners || []).concat(m.losers || [])
        .find((n) => String(map(n)).toLowerCase() === id);
      const o = name ? MO.outcomeFor(m, name) : null;
      rec.played++;
      if (o === MO.WIN) rec.wins++;
      else if (o === MO.DRAW) rec.draws++;
      else if (o === MO.LOSS) rec.losses++;
    });
    if (rec.played) rec.winpct = Math.round(1000 * rec.wins / rec.played) / 10;
    return rec;
  }

  return { apply, record };
});
