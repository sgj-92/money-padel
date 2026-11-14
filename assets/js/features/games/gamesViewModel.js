// ===================== GAMES: VIEW-MODEL =====================
// The contract between the Games data and whatever screen draws it.
//
// A screen asks for plain data and draws it; it never filters or tallies for
// itself:
//
//   const games  = filteredGames(filters);          // the final filtered set
//   const record = playerRecord(games, 'Rishi');    // W/D/L over exactly those
//
// or all of it at once with getFilteredGamesViewModel(). The rules live in
// domain/matches/gamesFilter.js; this file only binds them to the app's
// record (approved games, historical tiers, canonical ids). Owned jointly:
// the redesign may reshape what it returns for its screens, but never
// re-derive what the domain module decides.

// The Games screen's own filter state, as the filter object the domain reads.
function gamesFilterState(){
  return { month: gamesMonth, type: gamesType, playerIds: gamesPlayerIds.slice() };
}

// Everything a Games list needs, for `filters` (default: the Games screen's
// current filters).
//   games        the final filtered set, newest first
//   typeOptions  the game types worth offering under the OTHER filters
//   type         the type actually applied (after the fallback)
//   focusId      the one selected player's id, or null
//   record       that player's W/D/L over `games`, or null
//   records      every selected player's W/D/L over `games`, in filter order
function getFilteredGamesViewModel(filters){
  const f = filters || gamesFilterState();
  const approved = getDisplayMatches().filter(m => m._status === 'approved');
  const r = GamesFilter.apply(approved, f, {
    gameTypeOf, toId: playerIdFor,
    GameType: (typeof GameType !== 'undefined') ? GameType : null,
    PlayerFilter,
  });
  const ids = f.playerIds || [];
  const focusId = ids.length === 1 ? ids[0] : null;
  return {
    games: r.games, typeOptions: r.typeOptions, type: r.type, focusId,
    record: focusId === null ? null : GamesFilter.record(r.games, focusId, playerIdFor, MatchOutcome),
    records: ids.map(id => ({ id, name: displayNameFor(id), rec: GamesFilter.record(r.games, id, playerIdFor, MatchOutcome) })),
  };
}

function filteredGames(filters){
  return getFilteredGamesViewModel(filters).games;
}

// `player` is a name as shown on screen; the record matches by canonical id.
function playerRecord(games, player){
  return GamesFilter.record(games, playerIdFor(player), playerIdFor, MatchOutcome);
}
