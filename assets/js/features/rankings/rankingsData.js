// ===================== RANKINGS: ELIGIBILITY, PODIUM AND KINGS (DATA) =====================
// Who is eligible for a rank (the same rule as playerStateOf), and who sits on
// the podium and on each tier's throne for the Rankings scope (tierInScope).
// Competition facts: functional code. The drawing is rankingsChrome.js.
//
// Extracted from shell.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: functional. Loads before app.js; declarations only.

// ---- Ranking eligibility (All-Time only) ---------------------------------
// The group's own existing standard -- play at least 2 games to stay "in
// the group" -- wasn't actually enforced anywhere before; some genuinely
// inactive players just never got their manual active flag updated. This
// makes it automatic: computed fresh from real match dates every time,
// nobody has to remember to flag anyone, and returning is as simple as
// playing again. Applies only to the All-Time Power Rankings list -- a
// monthly leaderboard already has its own natural eligibility test
// (you have to have played in that month to appear in it at all).
// Kept as names because several call sites read better with them, but the rule
// itself now lives in PlayerState -- one definition, one dataset, every surface.
const RANKING_ELIGIBILITY_DAYS = (typeof PlayerState !== 'undefined') ? PlayerState.WINDOW_DAYS : 30;

const RANKING_ELIGIBILITY_MIN_MATCHES = (typeof PlayerState !== 'undefined') ? PlayerState.MIN_MATCHES : 2;

// "Does this player get a rank number right now?" An INACTIVE player does not,
// and neither does an idle one -- but for different reasons, which is why the
// callers that need to tell them apart ask playerStateOf() instead.
function isRankingEligible(name){
  const st = playerStateOf(name);
  return st ? st.rankable : false;
}

// ---- The ranked pool for a scope ----------------------------------------
// Who the podium and Kings of Tiers rank, and in what order, for one scope
// ('all' or a 'YYYY-MM') and qualifying threshold -- the same filter sequence
// as the list beneath them (month merge, then min-games, then a month-end
// rating in a month view, or All-Time eligibility). Each row carries the
// rating and tier FOR THAT SCOPE: the month-end rating and the tier held at
// that month's close, never today's. Highest rating first. The Rankings
// screen asks for its own month; the Admin Board Pack asks for any month.
function tierAtMonthClose(name, month){
  if(!MONTHLY_VIEWS) return null;
  const row = MonthlyViews.playerMonth(MONTHLY_VIEWS, month, name);
  return row ? row.tierAtMonthEnd : null;
}

function rankingPool(month, minGamesFloor){
  const inMonthView = month !== 'all';
  let rows = PLAYERS.slice();
  if(inMonthView){
    const monthly = computeMonthlyStats(month);
    const monthlyRatings = monthEndRatings(month);
    rows = rows.map(p => ({...p, ...(monthly[p.name] || ZERO_MONTH_STATS),
      month_rating: (p.name in monthlyRatings) ? Math.round(monthlyRatings[p.name]*10)/10 : null}));
  }
  rows = rows.filter(p => p.total >= minGamesFloor);
  if(inMonthView) rows = rows.filter(p => p.month_rating !== null && p.month_rating !== undefined);
  // All-time can only feature currently-eligible players -- same rule, same
  // test, as the list. A month's pool only has to have played that month.
  if(!inMonthView) rows = rows.filter(p => isRankingEligible(p.name));
  return rows
    .map(p => ({...p,
      scopeRating: inMonthView ? p.month_rating : p.rating,
      scopeTier: inMonthView ? tierAtMonthClose(p.name, month) : p.tier }))
    .sort((a,b)=> b.scopeRating - a.scopeRating);
}

// The default qualifying threshold differs by scope on purpose (10 for
// all-time, 5 for a single month, since monthly game counts are naturally
// lower).
// A period's own minimum (config/club.js periodMinMatches): 5 for Money
// Padel's month, 4 for a Padel Championships quarter.
function defaultRankingMinGames(month){
  return month === 'all' ? 10 : (CLUB.periodMinMatches || 5);
}

// Three honours, three sources (Shaun, 1 Nov):
//   King of a tier     the tier's leader in the All-time Power Rankings
//   Monthly Champion   the winner of the tier's Monthly Race (championsFor)
//   Player of the Month voted by the club
// A King is not a month's best: Kaz can be King while Osh wins October. So
// the King's pool is the All-time one -- Ranked, 10+ rated games -- whatever
// month is on screen. For a finished month it is that pool as it stood at the
// month's end (month-end rating, tier at the close, Ranked then); for the
// current month, or All time, it is today's.
// The current period and a period's last day (config/period.js): a month for
// Money Padel, a quarter for Padel Championships.
function currentMonthKey(){
  return Period.current(new Date());
}

function monthLastDay(month){
  return Period.end(month);
}

function kingPool(month){
  if(month === 'all' || month >= currentMonthKey()) return rankingPool('all', defaultRankingMinGames('all'));
  const last = monthLastDay(month);
  const asOf = Date.parse(last + 'T23:59:59Z');
  const ratings = monthEndRatings(month);
  const rated = v3RatedMatchList().filter(m => m.date <= last);
  return PLAYERS.filter(p => p.name in ratings)
    .filter(p => rated.filter(m => m.players.includes(p.name)).length >= defaultRankingMinGames('all'))
    .filter(p => { const st = playerStateOf(p.name, asOf); return !!(st && st.rankable); })
    .map(p => ({ ...p, scopeRating: ratings[p.name], scopeTier: tierAtMonthClose(p.name, month) }))
    .sort((a, b) => b.scopeRating - a.scopeRating);
}

// Kings of Tiers for any scope: each tier's highest-rated member of the King
// pool. A king of a field of one is not a king. Where only one player
// qualifies in a tier there is nothing to have won, so no crown is awarded and
// the card says why. This applies to every tier, not just Tier S -- the
// principle is about the size of the field, and hardcoding it to S would make
// it look like a rule about Manny.
function kingsOfTiersFor(month){
  const rows = kingPool(month);
  const MIN_FIELD = 2;
  const kings = {};
  const fieldSize = {};
  TIER_ORDER_LIST.forEach(tier=>{
    // Historical tier, not today's. Without this, June's Tier C king vanishes
    // the moment he is promoted in July and reappears in Tier B's June board.
    const tierRows = rows.filter(p=>p.scopeTier===tier);
    fieldSize[tier] = tierRows.length;
    if(tierRows.length >= MIN_FIELD){
      const p = tierRows[0];
      kings[tier] = { name: p.name, rating: Math.round(p.scopeRating),
        // Carried so the panel can say why a past king sits in a tier they are
        // no longer in, rather than leaving it looking like a bug.
        currentTier: p.tier };
    }
  });
  if(!TIER_ORDER_LIST.some(t=>kings[t])) return null;
  kings._fieldSize = fieldSize;
  return kings;
}

// Monthly Champions: each tier's Monthly Race leader among qualified runners,
// read from the Race's own table (it is sorted qualified first, then score).
// "Leading" while the month is still being played; "Champion" once it is
// over. No month, no champion. A month an Admin has confirmed answers from
// its stored record instead (championsData.js), so it never moves.
function championsFor(month){
  if(month === 'all') return null;
  return lockedChampionsFor(month) || derivedChampionsFor(month);
}

function derivedChampionsFor(month){
  if(month === 'all') return null;
  const table = buildMonthlyRace(month).table;
  const champions = {};
  TIER_ORDER_LIST.forEach(tier=>{
    const r = table.find(x => x.tier === tier && x.qualified);
    if(r) champions[tier] = { name: r.playerId, score: r.score, played: r.played };
  });
  if(!TIER_ORDER_LIST.some(t => champions[t])) return null;
  champions._final = month < currentMonthKey();
  return champions;
}

// ---- Rankings podium -----------------------------------------------------
// Podium now applies to any tier and any month (per the product change) --
// it always represents the top 3 of whatever leaderboard is currently on
// screen. Hidden only for: a non-Rating ranking mode, an active player
// search, or a non-default min-games threshold. Replicates render()'s own
// filter sequence exactly (tier -> month merge -> min-games) and the fixed
// rating sort, so the podium can never disagree with the list beneath it.
// All time only (Shaun, 1 Nov). On a month view the podium ranked the month's
// regulars by Power Rating, which is built over months: Len stood third in
// October on 0W 1D 6L. Who had the best month is the Champions panel's
// answer (the Monthly Race); the podium is the All-time Power top three.
function computeRankingsPodiumTop3(){
  if(activeTab !== 'power') return null;
  if(selectedMonth !== 'all') return null;
  if(activeSortP !== 'rating') return null;
  if(query !== '') return null;
  if(minGames !== defaultRankingMinGames(selectedMonth)) return null;

  // Tier is scope-relative: in a month view this is the tier held at that
  // month's close, so the podium's "Tier B · June 2026" caption is true.
  const sorted = rankingPool(selectedMonth, minGames)
    .filter(p => activeTier === 'All' || p.scopeTier === activeTier);
  if(sorted.length < 3) return null;
  return sorted.slice(0,3).map(p=>({ name: p.name, rating: p.scopeRating }));
}

// ---- Kings of Tiers and Monthly Champions --------------------------------
// Kings of their own divisions (Tier A/B/C), not 1st/2nd/3rd overall, and the
// month's Race winners beside them -- deliberately separate from the podium
// above, which is the top 3 of whichever tier/month scope is on screen. Shown
// with the Rating view of every tier at once, with no search: filtering to
// one tier already answers "who's #1 here". Neither depends on the list's
// min-games: a King is the All-time leader, a Champion the Race's.
function computeKingsOfTiers(){
  if(activeTab !== 'power') return null;
  if(activeSortP !== 'rating') return null;
  if(query !== '') return null;
  if(activeTier !== 'All') return null;
  return kingsOfTiersFor(selectedMonth);
}

function computeMonthlyChampions(){
  if(activeTab !== 'power' || activeSortP !== 'rating' || query !== '' || activeTier !== 'All') return null;
  return championsFor(selectedMonth);
}
