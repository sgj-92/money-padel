// ===================== DOUGHNUTS: THE DEFINITION =====================
// doughnutMatches(month) is THE doughnut definition (D7): every match, decided
// or drawn, with a set that finished with a side on 0. The By Player totals
// and the Doughnut List both read it.
//
// Extracted from shell.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: functional. Loads before app.js; declarations only.

// Reuses the same nearest-average pairing approach as the existing Find a
// Game engine (generateCandidatePairs/generateCandidatePartners) and the
// same Elo expected-score formula already used elsewhere in the app for
// predicted outcomes -- just orchestrated for "best partner + best opposing
// pair for that team", which the existing functions don't directly return.
// Doughnut leaderboard -- who's dished out and copped a 6-0 (or similar
// shutout set), all-time. Extends the existing "doughnuts received" concept
// already used in the monthly Summary (a set lost 0-x) with its natural
// missing other half, "doughnuts given" -- same underlying match data and
// the same per-set shutout check, just crediting the opposite side too.
// THE doughnut definition, once: every match -- decided or drawn -- with at
// least one set that finished with a side on 0, and in which direction. Both
// Doughnuts views read it: By Player aggregates it, the Doughnut List shows it
// as it is. `month` is 'YYYY-MM' or 'all'.
function doughnutMatches(month){
  const out = [];
  function processMatch(m){
    if(month && month !== 'all' && Period.of(m.date) !== month) return;
    // Which shutout sets exist, and in which direction, within this one match --
    // deduped so a match with two 6-0 sets the same way still counts once per
    // player per category (same total-count logic as before, just also keeping
    // the match reference now).
    let winnersGaveShutout = false, losersGaveShutout = false;
    const shutoutSets = [];
    m.sets.forEach(([x,y])=>{
      if(y === 0){ winnersGaveShutout = true; shutoutSets.push(`${x}-${y}`); }
      if(x === 0){ losersGaveShutout = true; shutoutSets.push(`${x}-${y}`); }
    });
    if(!winnersGaveShutout && !losersGaveShutout) return;
    // isDraw travels with the match. Without it the drill-down had no way to
    // know, and described every drawn game as a win for one side.
    out.push({ id: m.id, date: m.date, winners: m.winners, losers: m.losers,
      isDraw: !!m.isDraw, sets: m.sets, shutoutSets, winnersGaveShutout, losersGaveShutout });
  }
  ALL_MATCHES.forEach(processMatch);
  getAllApprovedMatches().filter(m=>m.isDraw).forEach(processMatch);
  // Newest first; the same day's games by their id, the later-recorded first,
  // so the order never depends on how storage happened to return them.
  return out.sort((a,b)=> a.date !== b.date ? (a.date < b.date ? 1 : -1)
    : String(b.id).localeCompare(String(a.id), undefined, { numeric: true }));
}

function computeDoughnutStats(month){
  const agg = {};
  function A(name){
    if(!agg[name]) agg[name] = { given: 0, received: 0, givenMatches: [], receivedMatches: [] };
    return agg[name];
  }
  doughnutMatches(month || 'all').forEach((matchInfo)=>{
    const m = matchInfo;
    const { winnersGaveShutout, losersGaveShutout } = matchInfo;
    if(winnersGaveShutout){
      m.losers.forEach(n=>{ A(n).received++; A(n).receivedMatches.push(matchInfo); });
      m.winners.forEach(n=>{ A(n).given++; A(n).givenMatches.push(matchInfo); });
    }
    if(losersGaveShutout){
      m.winners.forEach(n=>{ A(n).received++; A(n).receivedMatches.push(matchInfo); });
      m.losers.forEach(n=>{ A(n).given++; A(n).givenMatches.push(matchInfo); });
    }
  });

  return Object.keys(agg)
    .map(name => ({
      name, given: agg[name].given, received: agg[name].received, total: agg[name].given + agg[name].received,
      givenMatches: agg[name].givenMatches.sort((a,b)=> a.date < b.date ? 1 : -1),
      receivedMatches: agg[name].receivedMatches.sort((a,b)=> a.date < b.date ? 1 : -1),
    }))
    .filter(r => r.total > 0);
}
