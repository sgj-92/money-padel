// ===================== RANKINGS: MONTHLY TABLE INPUTS =====================
// What the League, Last 10, Merit and Monthly Race tables are built from, and
// the order their standings are listed in: the canonical match sets handed to
// LastTen.build / MeritTable.build / MonthlyRace.build, and the League and
// Last 10 tie-break rules. Competition facts, so functional code -- a
// redesigned table consumes these and never re-derives them.
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: functional. Loads before app.js; declarations only.

// Every appearance in the record, as LastTen wants them: one entry per player
// per match. Built from the same two sources the monthly aggregation uses --
// ALL_MATCHES/MATCHES for rated results and getAllApprovedMatches() for draws
// -- so the two tables can never disagree about what a game was.
// The matches a period needs to qualify: the community's own minimum
// (config/club.js periodMinMatches), else the Race's default of 5.
function raceMinMatches(){
  return CLUB.periodMinMatches || MonthlyRace.MIN_MATCHES;
}

function leagueAppearances(){
  const out = [];
  let seq = 0;
  ALL_MATCHES.forEach((raw, idx)=>{
    const enriched = MATCHES[idx];
    if(!enriched) return;
    const n = ++seq;
    raw.winners.forEach(name => out.push({ name, date: raw.date, result: 'W',
      gamesFor: enriched.games_winner, gamesAgainst: enriched.games_loser, seq: n }));
    raw.losers.forEach(name => out.push({ name, date: raw.date, result: 'L',
      gamesFor: enriched.games_loser, gamesAgainst: enriched.games_winner, seq: n }));
  });
  // Draws sit outside the rating engine, so they are read from the approved
  // matches directly -- but they are still games, and the League Table has
  // always counted them for a point.
  getAllApprovedMatches().filter(m => m.isDraw).forEach(m=>{
    const n = ++seq;
    const t1 = m.sets.reduce((a,[x])=>a+x,0);
    const t2 = m.sets.reduce((a,[,y])=>a+y,0);
    m.winners.forEach(name => out.push({ name, date: m.date, result: 'D', gamesFor: t1, gamesAgainst: t2, seq: n }));
    m.losers.forEach(name => out.push({ name, date: m.date, result: 'D', gamesFor: t2, gamesAgainst: t1, seq: n }));
  });
  return out;
}

// The League by tier for a month: each match filed under the tier the player
// held ON ITS DATE, so a mid-month mover has a row in each tier holding only
// what they earned there. `tier` is that tier ('?' where it cannot be
// established). The League's By tier view and the Board Pack read this.
function leagueSplitRows(month){
  return Object.values(computeMonthlySummaryStats(month, { splitByTier: true }))
    .map(s => ({ ...s, tier: s.segmentTier || '?' }));
}

// The same question of the Monthly Race (Home's hero, Shaun 31 Oct): one
// entry per tier the player raced in that month, placed as the Race table
// places them -- qualified players ranked by score; a provisional player (fewer
// than MonthlyRace.MIN_MATCHES matches) has no place yet, only a score.
function raceStandingOf(name, month){
  const table = buildMonthlyRace(month).table;
  return table.filter(r => r.playerId === name).map(r => {
    const ranked = table.filter(x => x.tier === r.tier && x.qualified);
    return { tier: r.tier, qualified: r.qualified,
      position: r.qualified ? ranked.findIndex(x => x.playerId === name) + 1 : null, of: ranked.length,
      score: r.score, games: r.played, wins: r.wins, draws: r.draws, losses: r.losses,
      toQualify: Math.max(0, raceMinMatches() - r.played),
      lastDate: r.matches.map(m => m.date).sort().pop() || null };
  });
}

// Last 10 as it stood at the close of a month: the same table, built from the
// record up to and including that month's last day -- so a past month's form
// is that month's, not today's.
function lastTenAtMonthEnd(month){
  const end = Period.end(month);
  return LastTen.build(leagueAppearances().filter(a => a.date <= end));
}

// The League's order. The screen sorts by whichever column the reader chose;
// anything else (the Board Pack) asks for the League's own standing order,
// points first.
function sortLeagueRows(rows, key = leagueSortKey, desc = leagueSortDesc){
  const dir = desc ? -1 : 1;
  return rows.slice().sort((a,b)=>{
    let av = a[key], bv = b[key];
    if(key === 'name') return dir * a.name.localeCompare(b.name);
    if(av === undefined || av === null) av = -Infinity;
    if(bv === undefined || bv === null) bv = -Infinity;
    if(av !== bv) return dir * (av - bv);
    // Stable tiebreak so ties don't jump around between renders.
    return b.points - a.points || b.gd - a.gd || a.name.localeCompare(b.name);
  });
}

// The Last 10 table. Deliberately a different table from the monthly one:
// no Tier column (a form table is club-wide by nature), no Avg Opp, and a
// Last 10 column in place of Form (10g) -- showing that percentage beside a
// table built from the same ten games would be the same fact told twice.
const LAST10_SORT_FALLBACK = (a,b)=> b.points - a.points || b.gd - a.gd || b.games - a.games || a.name.localeCompare(b.name);

function sortLastTenRows(rows, key = leagueSortKey, desc = leagueSortDesc){
  const dir = desc ? -1 : 1;
  return rows.slice().sort((a,b)=>{
    if(key === 'name') return dir * a.name.localeCompare(b.name);
    let av = a[key], bv = b[key];
    // This table has no avg_opp or recent_form column, so a sort key carried
    // over from the monthly table would compare undefined against undefined
    // and leave the rows in hash order. Fall back to the league's own order.
    if(av === undefined || bv === undefined) return LAST10_SORT_FALLBACK(a,b);
    if(av === null) av = -Infinity;
    if(bv === null) bv = -Infinity;
    if(av !== bv) return dir * (av - bv);
    return LAST10_SORT_FALLBACK(a,b);
  });
}

// Every approved match in a shape MeritTable understands. One source, so Merit
// and the League can never disagree about what a game was.
function meritMatches(month){
  return getAllApprovedMatches()
    .filter(m => month === 'all' || Period.of(m.date) === month)
    .map(m => ({ id: m.id, date: m.date, winners: m.winners, losers: m.losers,
      isDraw: !!m.isDraw, sets: m.sets, type: m.type }));
}

// The month's approved matches in the order they were played. Order matters:
// a tier's par is built from each player's FIRST pre-match rating of the month.
function raceMatches(month){
  return getAllApprovedMatches()
    .filter(m => Period.of(m.date) === month)
    .slice()
    .sort((a,b)=> a.date < b.date ? -1 : a.date > b.date ? 1 : (a.sourceIndex||0) - (b.sourceIndex||0))
    .map(m => ({ id: m.id, date: m.date, winners: m.winners, losers: m.losers,
      isDraw: !!m.isDraw, sets: m.sets }));
}

function buildMonthlyRace(month){
  return MonthlyRace.build({
    minMatches: raceMinMatches(),
    matches: raceMatches(month),
    tierAt: (n, d) => historicalTierOf(n, d),
    // The persisted pre-match rating, read back from the journey -- never
    // today's rating and never a second calculation.
    preRating: (id, n) => {
      const f = V3_MATCH_FACTS && V3_MATCH_FACTS[id];
      const p = f && f.byPlayer && f.byPlayer[n];
      return p ? p.preMatchRating : null;
    },
  });
}
