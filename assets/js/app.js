// ===================== THE COMMUNITY'S OWN RECORD =====================
// A community's history -- the pre-v3 base tiers and matches, the Box Office
// Cup, who submitted the early games -- lives in its own folder
// (clubs/<id>/history.js, loaded only for that community: config/club.js).
// A community without one starts empty. Nothing here is the product's.
const CLUB_RECORD = typeof CLUB_HISTORY !== 'undefined' ? CLUB_HISTORY : {};
const BASE_MATCHES = CLUB_RECORD.baseMatches || [];
const BASE_TIERS = CLUB_RECORD.baseTiers || {};
const BASE_ACTIVE = CLUB_RECORD.baseActive || {};
// Tier a player started at, if different from their current tier: seeds their
// rating at their first-ever match only.
const BASE_STARTING_TIER = CLUB_RECORD.baseStartingTier || {};

// North vs South: a one-off exhibition team event, separate from the ratings
// (features/rankings/northSouth*.js). A community without one has no event,
// and Admin offers none.
const NORTH_SOUTH = CLUB_RECORD.northSouth || null;
const NORTH_SOUTH_EVENT = NORTH_SOUTH ? NORTH_SOUTH.event : null;
const NORTH_ROSTER = NORTH_SOUTH ? NORTH_SOUTH.northRoster : [];
const SOUTH_ROSTER = NORTH_SOUTH ? NORTH_SOUTH.southRoster : [];
const NORTH_SOUTH_FIXTURES = NORTH_SOUTH ? NORTH_SOUTH.fixtures : [];

// Who submitted the games that predate the stored attribution
// (domain/matches/matchAttribution.js).
const MATCH_SUBMITTER_HISTORY = MatchAttribution.historyMap(CLUB_RECORD.submitters);

// ===================== LIVE STATE =====================
let ALL_MATCHES = [];      // BASE_MATCHES + user-added
let TIER_MAP = {};         // name -> tier (base + overrides + new players)
let ACTIVE_MAP = {};       // name -> bool
let STARTING_TIER_MAP = {};// name -> tier they started at, if different from current (used for seeding only)

let PLAYERS = [];
let MATCHES = [];
let DRAW_MATCHES = [];     // enriched draws; see recomputeAll and matchesIncludingDraws()
let PARTNERSHIPS = [];
let BEST_PARTNER = {};
let BOUNDARY_TESTS = [];
let CALIBRATION_GAMES = [];
let WITHIN_TIER_GAMES = [];
let DIFFICULTY_SUGGESTIONS = {};
let INACTIVE_PLAYERS = new Set();
let H2H = {};

const TIER_SEED = {S:2000, A:1700, B:1400, C:1100};
const TIER_ORDER_LIST = ["S","A","B","C"];
// A challenge's tier restriction: any tier, or one of them. Built from the tier
// order at load time, so it lives here rather than with the challenge code in
// features/play/findGameData.js.
const CHALLENGE_RESTRICTIONS = ['any', ...TIER_ORDER_LIST]; // 'any' | 'S' | 'A' | 'B' | 'C'
const TIER_IDX = {S:0,A:1,B:2,C:3};


let visibilityState = {...VISIBILITY_DEFAULTS};


let gameRequestsState = []; // {id, requestedBy, requestedAt, players:[4 names], confirmations:{name:bool}, status:'pending'|'confirmed'|'removed'}


let devAreasState = []; // [{id, player, text, addedBy, addedAt}]


// {id, createdAt, createdBy, challenger, challenged, firstPicker:'challenger'|'challenged',
//  firstRestriction:'any'|'S'|'A'|'B'|'C', secondRestriction: same,
//  firstPartner:null|name, secondPartner:null|name,
//  state:'waiting_first_pick'|'waiting_second_pick'|'ready'|'confirmed'|'declined'|'cancelled',
//  linkedRequestId:null|id, respondedAt:null|iso}
// Deliberately its own store rather than folded into gameRequestsState -- see the
// "Complete-match recommendations" / Challenge section below for the schema reasoning.
// No rating/balance numbers are ever stored here -- the match % is always recomputed
// live from current PLAYERS data, same as everywhere else in the app.
let challengesState = [];


// fixture id -> {sets:[[northGames,southGames],...], matchTiebreak:[n,s]|null, status:'completed'|'draw'}
let northSouthResultsState = {};


let ownerPasswordHash = null;
let boardPasswordHash = null;
// WHICH admin, not just whether. The board has a password of its own, so
// "unlocked" has never meant "this is Shaun". Anything that should reach the
// owner and not the board needs this, and until now nothing recorded it.
let adminRole = null;   // 'owner' | 'board' | null
let isUnlocked = false;


let extraMatchesState = [];   // each: {id, date, winners, losers, sets, type, note, status, submittedBy, submittedAt}
let tagOverridesState = {};
let matchAttributionState = {};   // matchId -> who submitted / approved it (MatchAttribution)
let matchEditsState = {};     // id -> {date?,winners?,losers?,sets?,type?,note?, editedBy, editedAt}
let deletedIdsState = [];
let currentUserName = '';

function rebuildMapsFromState(){
  TIER_MAP = {...BASE_TIERS};
  ACTIVE_MAP = {...BASE_ACTIVE};
  STARTING_TIER_MAP = {...BASE_STARTING_TIER};
  Object.keys(tagOverridesState).forEach(name=>{
    const o = tagOverridesState[name];
    if(o.tier) TIER_MAP[name] = o.tier;
    if(typeof o.active === 'boolean') ACTIVE_MAP[name] = o.active;
    if(o.startingTier) STARTING_TIER_MAP[name] = o.startingTier;
  });
}

// The list used for rating computation: base + approved submissions, edits applied, deletions removed.
// Every approved match, edits applied, deletions removed. Includes draws -- this is the source
// of truth for "what exists", used for display. Rating computation uses getEffectiveMatches()
// below, which filters draws out, since an unfinished game has no defined winner to rate.
function getAllApprovedMatches(){
  // The v3 `matches` collection is the match history. It is the same 150-match
  // set the engine rated, already carrying every correction and deletion that
  // was applied in production, so the record shown beside a rating and the
  // record that produced it are one history rather than two.
  //
  // BASE_MATCHES is no longer read here. It is the pre-v3 base layer: 127
  // June-August matches with no September and no draws, and reading it was the
  // cause of the 127-vs-150 divergence.
  //
  // The legacy edit/deletion overlays are likewise not applied. v3 match
  // documents are already the edited truth, and re-applying an overlay would
  // desync a match from the rating computed for it. Historical editing stays
  // unavailable until replay-forward exists.
  let all = V3_MATCHES.slice();
  // Every calculated statistic in the app -- ratings, monthly ratings,
  // win/loss, league points, form, partnerships, head-to-head,
  // recommendations, call-outs -- is derived from this function (directly, or
  // via getEffectiveMatches/getDisplayMatches), so no screen can ever end up
  // calculating against a different dataset than another.
  //
  // The Data Range setting is deliberately NOT applied here. It changes what
  // the match-history view shows and nothing else; HISTORICAL_DISPLAY_MATCHES
  // is added in getDisplayMatches() alone. No calculation can reach it.
  return all;
}

// The list used for rating computation: same as above, minus draws (no winner to rate).
function getEffectiveMatches(){
  return getAllApprovedMatches().filter(m => !m.isDraw);
}

// The list used for the Games tab display: all approved matches (including draws) + pending, never deleted.
// This is the ONLY place the Data Range setting is read, and the only place
// HISTORICAL_DISPLAY_MATCHES is surfaced. Nothing downstream of here feeds a
// rating, a Rating Journey event, or a Monthly Performance figure.
function getDisplayMatches(){
  const effective = getAllApprovedMatches().map(m=>({...m, _status:'approved'}));
  const pending = extraMatchesState.filter(m=>m.status==='pending' && !deletedIdsState.includes(m.id)).map(m=>({...m, _status:'pending'}));
  const historical = dataRange === 'all'
    ? (typeof HISTORICAL_DISPLAY_MATCHES === 'undefined' ? [] : HISTORICAL_DISPLAY_MATCHES).map(m=>({...m, _status:'approved', _displayOnly:true}))
    : [];
  return effective.concat(pending).concat(historical);
}

// ===================== LEGACY RATING ENGINE (no callers) ==================
// The pre-v3 joint solver. Nothing in the application calls it any more: the
// last two screens that did -- the Monthly Rating breakdown and the
// head-to-head month view -- now read the persisted trajectory.
//
// It is kept rather than deleted because Shaun's decision was that the legacy
// solver stays available through the beta for comparison. It is no longer
// reachable from the UI, and must not be wired back into any display: a screen
// showing a v3 rating next to a legacy-derived figure is how the "story
// estimate" problem started.
function computeElo(matches, tierMap, startingTierMap){
  startingTierMap = startingTierMap || {};
  const ratings = {};
  function R(name){
    if(!(name in ratings)) ratings[name] = TIER_SEED[startingTierMap[name] || tierMap[name] || 'B'];
    return ratings[name];
  }
  const K = 28, EPOCHS = 300;
  for(let epoch=0; epoch<EPOCHS; epoch++){
    for(const m of matches){
      const gw = m.sets.reduce((s,set)=>s+set[0],0);
      const gl = m.sets.reduce((s,set)=>s+set[1],0);
      const total = (gw+gl) || 1;
      const actual = gw/total;
      const wr = m.winners.reduce((s,p)=>s+R(p),0)/m.winners.length;
      const lr = m.losers.reduce((s,p)=>s+R(p),0)/m.losers.length;
      const expected = 1/(1+Math.pow(10,(lr-wr)/400));
      const delta = K*(actual-expected)/EPOCHS*3;
      m.winners.forEach(p=>{ ratings[p] = R(p) + delta; });
      m.losers.forEach(p=>{ ratings[p] = R(p) - delta; });
    }
  }
  return ratings;
}

// Attaches what the engine recorded for each match. Nothing here is derived
// from today's ratings: the team ratings are the ones carried INTO the match,
// and the expectation is the one the engine used at the time. Recomputing a
// historical expectation in the browser is forbidden, and it was also simply
// unstable -- the same June match reported a different expectation every time
// anybody played.
//
// `expected_score` and `actual_score` are the engine's performance scores
// (0.80 x game share + 0.20 x the result). They are NOT a share of games, and
// are named so they cannot be mistaken for `game_share_winner`, which is.
// The v3 RATED match set, in the shape PlayerState reads: every match the
// engine actually rated, draws included, with the players it moved. Built from
// the recorded MATCH_UPDATE events rather than from MATCHES, which deliberately
// excludes draws -- counting only decided games made a player's eligibility
// depend on whether their recent matches happened to finish.
// The tier a player was in ON THE DATE of a match -- not their tier today. A
// promotion recorded in August means an old June card shows the tier they were
// actually in when they played it, which is the point.
function historicalTierOf(name, date){
  if(!V3_TIER_AS_OF) return null;
  return V3_TIER_AS_OF(name, date) || null;
}

// What kind of match this was, in tier terms, from the same temporal source as
// the labels. Returns null when any player's tier is unknown at that date.
function gameTypeOf(m){
  if(typeof GameType === 'undefined' || !V3_TIER_AS_OF) return null;
  const tiersOf = (names) => names.map(n => historicalTierOf(n, m.date));
  return GameType.classify(tiersOf(m.winners), tiersOf(m.losers));
}

// "Eli (A) & Len (A)" -- names with the tier they held that day.
// Reads a partnership out in canonical order: the stronger tier first, stored
// order kept when partners share a tier. The two SIDES are never swapped --
// on a decided card the first side is the side that won, and on a draw it is
// the side the score is written from, so reordering them would turn a loss
// into a win or a scoreline inside out.
function namesWithHistoricalTier(names, date, ratings){
  const ordered = (typeof GameType !== 'undefined' && GameType.orderTeam)
    ? GameType.orderTeam(names, (n) => historicalTierOf(n, date))
    : names;
  return ordered.map(n => {
    const t = historicalTierOf(n, date);
    const tier = t ? ` <span class="hist-tier">(${t})</span>` : '';
    const r = ratings ? ratings(n) : null;
    return `${n}${tier}${r === null || r === undefined ? '' : ` ${r}`}`;
  }).join(' &amp; ');
}

function v3RatedMatchList(){
  return Object.values(V3_MATCH_FACTS || {}).map(f => ({
    date: f.date,
    players: Object.keys(f.byPlayer || {}),
  }));
}

// One player's Ranked / Idle / Inactive state, from the one helper. Every
// surface that shows a rank, a rank dash or a status tag goes through here.
function playerStateOf(name, asOf){
  if(typeof PlayerState === 'undefined') return null;
  const p = PLAYERS.find(x => x.name === name);
  return PlayerState.stateOf({
    ratedMatches: v3RatedMatchList(),
    name,
    asOf: asOf === undefined ? Date.now() : asOf,
    active: p ? p.active !== false : true,
    status: p ? p.status : undefined,
  });
}

// ===================== TIER RANK: ONE DEFINITION =====================
// Tier Rank is a player's position in the CURRENT Power Rankings among the
// players in their current tier -- the same pool and the same order as the
// Rankings list at All time:
//   pool   players who are rankable (PlayerState RANKED; Idle and Inactive
//          are not ranked). The min-games number on the list is a display
//          filter, not eligibility, so it plays no part here.
//   order  current Power Rating, highest first, the list's own comparator
//          over the same PLAYERS order (so ties fall the same way).
// Every surface that says "Tier" beside a rank reads it from here. There used
// to be a second calculation that ranked every tier member, Idle and Inactive
// included, which is how one profile said "#8" and "#9 of 9" at once.
function currentPowerRankings(){
  return PLAYERS.filter(p => { const st = playerStateOf(p.name); return !!(st && st.rankable); })
    .sort((a,b)=> b.rating - a.rating);
}
function tierRankOf(name, list){
  const ranked = list || currentPowerRankings();
  const p = PLAYERS.find(x => x.name === name);
  if(!p) return null;
  const inTier = ranked.filter(x => x.tier === p.tier);
  const idx = inTier.findIndex(x => x.name === name);
  const overall = ranked.findIndex(x => x.name === name);
  return {
    tier: p.tier,
    rank: idx >= 0 ? idx + 1 : null,      // null: not currently ranked
    of: inTier.length,                    // ranked players in the tier
    overallRank: overall >= 0 ? overall + 1 : null,
    overallOf: ranked.length,
  };
}

// Every game actually played, decided or drawn, newest-agnostic. For screens
// that DESCRIBE history. Never for anything that calculates a rating, a win
// percentage or a league point -- those read MATCHES, which is the rated set.
function matchesIncludingDraws(){
  return MATCHES.concat(DRAW_MATCHES);
}

// The meetings between two players, on opposite sides. One definition, used by
// both head-to-head surfaces, so they cannot disagree about what counts as a
// meeting -- and it includes draws, which a pair of `winners/losers` clauses
// silently dropped.
function h2hOpponentMatches(a, b){
  return matchesIncludingDraws().filter(m=>{
    const inA = m.winners.includes(a) || m.losers.includes(a);
    const inB = m.winners.includes(b) || m.losers.includes(b);
    if(!inA || !inB) return false;
    const sameSide = (m.winners.includes(a) && m.winners.includes(b))
      || (m.losers.includes(a) && m.losers.includes(b));
    return !sameSide;
  });
}

function h2hTeammateMatches(a, b){
  return matchesIncludingDraws().filter(m=>
    (m.winners.includes(a) && m.winners.includes(b))
    || (m.losers.includes(a) && m.losers.includes(b)));
}

function enrichMatches(matches){
  return matches.map(m=>{
    const gw = m.sets.reduce((s,set)=>s+set[0],0);
    const gl = m.sets.reduce((s,set)=>s+set[1],0);
    const total = (gw+gl) || 1;
    const facts = V3_MATCH_FACTS[m.id];
    // A rated match with no recorded events is a broken read, not a match to
    // draw an approximate card for.
    if(!facts) throw new Error('No recorded engine facts for match ' + m.id);
    const view = MatchFacts.forPlayer(facts, m.winners[0]);
    if(!view) throw new Error('Match ' + m.id + ' has no event for ' + m.winners[0]);
    return {
      id: m.id, date: m.date, winners: m.winners, losers: m.losers,
      // Both: `score` is the stored winner-first string every neutral caller
      // wants, `sets` is what a player-centric card needs in order to orient.
      sets: m.sets.map(s=>[...s]),
      score: m.sets.map(s=>s.join('-')).join(', '),
      type: m.type, note: m.note||'', verified: m.verified !== false,
      isDraw: !!m.isDraw,
      games_winner: gw, games_loser: gl,
      game_share_winner: Math.round((gw/total)*1000)/1000,
      expected_score: Math.round(view.mine.expected*1000)/1000,
      actual_score: Math.round(view.mine.actual*1000)/1000,
      performance_residual: Math.round(view.mine.residual*1000)/1000,
      team_w_rating: view.mine.preRating, team_l_rating: view.theirs.preRating,
      match_strength: Math.round((view.mine.preRating + view.theirs.preRating)/2*10)/10,
      // Per-player, because K is per-player: the four players in one match do
      // not move by the same amount and must never be shown as if they did.
      deltas: facts.byPlayer,
    };
  });
}

// Every rated game counts, draws included (Shaun, 15 Oct: "align everything to
// include draws"): a draw is a game played, never a win and never a loss, so
// `total` is wins + draws + losses and win % is wins / total -- the League's,
// the Games log's and the profile's definition. A draw's residual counts
// toward "vs expectation" like any game (the stored residual is the
// first-listed side's, negated for the other). It is never an upset.
function buildPlayers(enrichedMatches, ratings, tierMap, activeMap){
  const agg = {};
  function A(name){
    if(!agg[name]) agg[name] = {wins:0, draws:0, losses:0, strengths:[], overperf:[], games_w:0, games_l:0, upset_wins:0, upset_losses:0};
    return agg[name];
  }
  const GAP_THRESHOLD = 15;
  enrichedMatches.forEach(m=>{
    if(m.isDraw){
      [[m.winners, 1, m.games_winner, m.games_loser], [m.losers, -1, m.games_loser, m.games_winner]].forEach(([side, sign, gf, ga])=>side.forEach(p=>{
        const a = A(p);
        a.draws++; a.strengths.push(m.match_strength); a.overperf.push(sign * m.performance_residual);
        a.games_w += gf; a.games_l += ga;
      }));
      return;
    }
    const gap = Math.abs(m.team_w_rating - m.team_l_rating);
    const isClose = gap < GAP_THRESHOLD;
    const winnerFavored = m.team_w_rating > m.team_l_rating;
    const isUpset = !isClose && !winnerFavored;
    m.winners.forEach(p=>{
      const a = A(p);
      a.wins++; a.strengths.push(m.match_strength); a.overperf.push(m.performance_residual);
      a.games_w += m.games_winner; a.games_l += m.games_loser;
      if(isUpset) a.upset_wins++;
    });
    m.losers.forEach(p=>{
      const a = A(p);
      a.losses++; a.strengths.push(m.match_strength); a.overperf.push(-m.performance_residual);
      a.games_w += m.games_loser; a.games_l += m.games_winner;
      if(isUpset) a.upset_losses++;
    });
  });

  const allNames = Object.keys(ratings);
  const byTier = {};
  allNames.forEach(name=>{
    const t = tierMap[name] || 'B';
    (byTier[t] = byTier[t]||[]).push(name);
  });

  const tierAvgRating = {}, tierAvgOpp = {}, tierMinRating = {}, tierMaxRating = {};
  TIER_ORDER_LIST.forEach(t=>{
    const names = byTier[t] || [];
    if(names.length===0) return;
    tierAvgRating[t] = names.reduce((s,n)=>s+ratings[n],0)/names.length;
    const opps = names.map(n=>{
      const a = agg[n];
      return a && a.strengths.length ? a.strengths.reduce((s,x)=>s+x,0)/a.strengths.length : ratings[n];
    });
    tierAvgOpp[t] = opps.reduce((s,x)=>s+x,0)/opps.length;
    tierMinRating[t] = Math.min(...names.map(n=>ratings[n]));
    tierMaxRating[t] = Math.max(...names.map(n=>ratings[n]));
  });

  const PROMO_THRESHOLD = 100, DEMO_THRESHOLD = 100, MIN_GAMES_FOR_RISK = 4;

  const players = [];
  TIER_ORDER_LIST.forEach(t=>{
    const names = (byTier[t]||[]).slice().sort((a,b)=>ratings[b]-ratings[a]);
    names.forEach((name, idx)=>{
      const a = agg[name] || {wins:0,draws:0,losses:0,strengths:[],overperf:[],games_w:0,games_l:0,upset_wins:0,upset_losses:0};
      const total = a.wins + a.draws + a.losses;
      const avgStrength = a.strengths.length ? a.strengths.reduce((s,x)=>s+x,0)/a.strengths.length : ratings[name];
      const avgOverperf = a.overperf.length ? 100*a.overperf.reduce((s,x)=>s+x,0)/a.overperf.length : 0;
      const idx0 = TIER_IDX[t];
      const tierAbove = idx0>0 ? TIER_ORDER_LIST[idx0-1] : null;
      const tierBelow = idx0<3 ? TIER_ORDER_LIST[idx0+1] : null;
      const promotionGap = (tierAbove && tierMinRating[tierAbove]!==undefined) ? Math.round((tierMinRating[tierAbove]-ratings[name])*10)/10 : null;
      const demotionGap = (tierBelow && tierMaxRating[tierBelow]!==undefined) ? Math.round((ratings[name]-tierMaxRating[tierBelow])*10)/10 : null;
      const confidence = total < MIN_GAMES_FOR_RISK ? 'low' : (total < 10 ? 'medium' : 'high');
      let risk = 'stable';
      if(confidence==='low') risk='unproven';
      else if(promotionGap!==null && promotionGap<=PROMO_THRESHOLD) risk='promotion_watch';
      else if(demotionGap!==null && demotionGap<=DEMO_THRESHOLD) risk='demotion_watch';

      players.push({
        name, tier: t, rating: Math.round(ratings[name]*10)/10,
        wins: a.wins, draws: a.draws, losses: a.losses, total, winpct: total? Math.round(1000*a.wins/total)/10 : 0,
        avg_match_strength: Math.round(avgStrength*10)/10, avg_overperf_pct: Math.round(avgOverperf*10)/10,
        game_diff: a.games_w - a.games_l,
        upset_wins: a.upset_wins, upset_losses: a.upset_losses,
        upset_total: a.upset_wins+a.upset_losses,
        upset_rate: total ? Math.round(1000*(a.upset_wins+a.upset_losses)/total)/10 : 0,
        tier_avg_rating: Math.round(tierAvgRating[t]*10)/10,
        rating_vs_tier_avg: Math.round((ratings[name]-tierAvgRating[t])*10)/10,
        tier_avg_opp: Math.round(tierAvgOpp[t]*10)/10,
        opp_vs_tier_avg: Math.round((avgStrength-tierAvgOpp[t])*10)/10,
        promotion_gap: promotionGap, demotion_gap: demotionGap,
        confidence, risk, active: activeMap[name] !== false,
      });
    });
  });
  return players;
}

function buildH2H(enrichedMatches){
  const h2h = {};
  enrichedMatches.forEach(m=>{
    m.winners.forEach(a=>m.losers.forEach(b=>{
      const key=[a,b].sort().join('|');
      h2h[key]=(h2h[key]||0)+1;
    }));
  });
  return h2h;
}

function buildPartnerships(enrichedMatches, tierMap){
  const partnerships = {};
  enrichedMatches.forEach(m=>{
    [[m.winners, true],[m.losers,false]].forEach(([team,isWin])=>{
      if(team.length!==2) return;
      const key = [...team].sort().join('|');
      if(!partnerships[key]) partnerships[key] = {pair: [...team].sort(), games:0, wins:0, draws:0, losses:0, overperfSum:0};
      const p = partnerships[key];
      p.games++;
      // A draw is a game together, neither won nor lost; its residual is the
      // first-listed side's, negated for the other, like any game.
      if(m.isDraw){ p.draws++; p.overperfSum += isWin ? m.performance_residual : -m.performance_residual; }
      else if(isWin){ p.wins++; p.overperfSum += m.performance_residual; }
      else { p.losses++; p.overperfSum += -m.performance_residual; }
    });
  });
  const rows = [];
  Object.values(partnerships).forEach(p=>{
    if(p.games<2) return;
    rows.push({
      pair: p.pair, games: p.games, wins: p.wins, draws: p.draws, losses: p.losses,
      winpct: Math.round(1000*p.wins/p.games)/10,
      avg_overperf: Math.round(1000*p.overperfSum/p.games)/10,
      tier_a: tierMap[p.pair[0]], tier_b: tierMap[p.pair[1]],
    });
  });
  rows.sort((a,b)=> b.avg_overperf - a.avg_overperf);
  return rows;
}

function buildBestPartner(partnerships){
  const best = {};
  partnerships.forEach(r=>{
    r.pair.forEach((name,i)=>{
      const partner = r.pair[1-i];
      const cur = best[name];
      if(!cur || r.avg_overperf > cur.avg_overperf){
        best[name] = {partner, games:r.games, wins:r.wins, draws:r.draws, losses:r.losses, winpct:r.winpct, avg_overperf:r.avg_overperf};
      }
    });
  });
  return best;
}

function findWingman(players, targetRating, exclude, sameTier, minGames){
  let best=null;
  players.forEach(p=>{
    if(exclude.has(p.name) || p.total < minGames) return;
    if(sameTier && p.tier!==sameTier) return;
    const gap = Math.abs(p.rating-targetRating);
    if(!best || gap<best.gap) best={gap, p};
  });
  return best ? best.p : null;
}

function buildMatchup(players, focusA, focusB, globalExclude, tier){
  const byName = {}; players.forEach(p=>byName[p.name]=p);
  if(!byName[focusA] || !byName[focusB]) return null;
  const ra=byName[focusA].rating, rb=byName[focusB].rating;
  const exclude = new Set([focusA,focusB,...globalExclude]);

  // Prefer staying within the same tier even with a less-experienced wingman, over reaching
  // outside the tier for someone more proven -- especially matters for thin tiers like C.
  let wingA = tier ? findWingman(players, rb, exclude, tier, 4) : null;
  if(!wingA && tier) wingA = findWingman(players, rb, exclude, tier, 1);
  if(!wingA) wingA = findWingman(players, rb, exclude, null, 4);
  if(!wingA) return null;

  const exclude2 = new Set([...exclude, wingA.name]);
  let wingB = tier ? findWingman(players, ra, exclude2, tier, 4) : null;
  if(!wingB && tier) wingB = findWingman(players, ra, exclude2, tier, 1);
  if(!wingB) wingB = findWingman(players, ra, exclude2, null, 4);
  if(!wingB) return null;

  const team1=[focusA,wingA.name], team2=[focusB,wingB.name];
  const t1r=(ra+wingA.rating)/2, t2r=(rb+wingB.rating)/2;
  return {team1,team2, team1_rating:Math.round(t1r*10)/10, team2_rating:Math.round(t2r*10)/10,
          team_gap: Math.round(Math.abs(t1r-t2r)*10)/10,
          wingA_games: wingA.total, wingB_games: wingB.total};
}

function buildBoundaryTests(activePlayers, h2h){
  const byName = {}; activePlayers.forEach(p=>byName[p.name]=p);
  const names = activePlayers.map(p=>p.name);
  const candidates = [];
  for(let i=0;i<names.length;i++) for(let j=i+1;j<names.length;j++){
    const a=names[i], b=names[j];
    const pa=byName[a], pb=byName[b];
    if(Math.abs(TIER_IDX[pa.tier]-TIER_IDX[pb.tier]) !== 1) continue;
    const gap = Math.abs(pa.rating-pb.rating);
    if(gap>130) continue;
    const minGames = Math.min(pa.total, pb.total);
    if(minGames<3) continue;
    const played = h2h[[a,b].sort().join('|')] || 0;
    candidates.push({a,b, tier_a:pa.tier, tier_b:pb.tier, rating_a:pa.rating, rating_b:pb.rating,
                      gap: Math.round(gap*10)/10, played_before: played, games_a: pa.total, games_b: pb.total});
  }
  candidates.sort((x,y)=> (x.played_before-y.played_before) || (x.gap-y.gap));
  const top = candidates.slice(0,8);
  const focusNames = new Set(); top.forEach(c=>{ focusNames.add(c.a); focusNames.add(c.b); });
  top.forEach(c=>{
    const otherFocus = new Set([...focusNames].filter(n=>n!==c.a && n!==c.b));
    c.matchup = buildMatchup(activePlayers, c.a, c.b, otherFocus);
  });
  return top.filter(c=>c.matchup);
}

function buildCalibrationGames(activePlayers, h2h){
  const lowSample = activePlayers.filter(p=>p.total<4);
  const rows = [];
  lowSample.forEach(p=>{
    let best=null;
    activePlayers.forEach(q=>{
      if(q.name===p.name || q.total<6) return;
      const played = h2h[[p.name,q.name].sort().join('|')] || 0;
      const gap = Math.abs(p.rating-q.rating);
      const score = played*200+gap;
      if(!best || score<best.score) best={score, opponent:q.name, tier:q.tier, rating:q.rating, games:q.total, gap:Math.round(gap*10)/10, played_before:played};
    });
    if(!best) return;
    rows.push({name:p.name, tier:p.tier, rating:p.rating, games:p.total, best_anchor:best});
  });
  rows.sort((a,b)=> a.best_anchor.gap - b.best_anchor.gap);
  rows.forEach(r=>{ r.matchup = buildMatchup(activePlayers, r.name, r.best_anchor.opponent, new Set()); });
  return rows.filter(r=>r.matchup);
}

function buildWithinTierGames(activePlayers, h2h){
  const byTier = {};
  activePlayers.forEach(p=>{ (byTier[p.tier]=byTier[p.tier]||[]).push(p); });
  const picked = [];
  TIER_ORDER_LIST.forEach(t=>{
    const tp = byTier[t]||[];
    if(tp.length<2) return;
    const cands = [];
    for(let i=0;i<tp.length;i++) for(let j=i+1;j<tp.length;j++){
      const p=tp[i], q=tp[j];
      const minGames = Math.min(p.total,q.total);
      if(minGames<3) continue;
      const gap = Math.abs(p.rating-q.rating);
      const played = h2h[[p.name,q.name].sort().join('|')] || 0;
      cands.push({tier:t, a:p.name, b:q.name, rating_a:p.rating, rating_b:q.rating,
                  gap:Math.round(gap*10)/10, games_a:p.total, games_b:q.total, played_before:played});
    }
    // Balance closeness against staleness: a tiny gap that's been played many times is still
    // interesting (a settled rivalry), it shouldn't be buried just because it's not "fresh".
    cands.forEach(c=> c.score = c.gap + c.played_before * 2);
    cands.sort((x,y)=> x.score - y.score);
    picked.push(...cands.slice(0,2));
  });
  const byTierFocus = {};
  picked.forEach(c=>{ (byTierFocus[c.tier]=byTierFocus[c.tier]||new Set()).add(c.a); byTierFocus[c.tier].add(c.b); });
  picked.forEach(c=>{
    const otherFocus = new Set([...byTierFocus[c.tier]].filter(n=>n!==c.a && n!==c.b));
    c.matchup = buildMatchup(activePlayers, c.a, c.b, otherFocus, c.tier);
    if(c.matchup){
      const allP = c.matchup.team1.concat(c.matchup.team2);
      const byName = {}; activePlayers.forEach(p=>byName[p.name]=p);
      const tiersInvolved = [...new Set(allP.map(n=>byName[n].tier))].sort();
      c.matchup.pure_tier = (tiersInvolved.length===1 && tiersInvolved[0]===c.tier);
      c.matchup.tiers_involved = tiersInvolved;
      c.matchup.has_light_wingman = (c.matchup.wingA_games < 4 || c.matchup.wingB_games < 4);
    }
  });
  return picked.filter(c=>c.matchup);
}

function bestPairNear(players, targetRating, exclude){
  let best=null;
  const pool = players.filter(p=>!exclude.has(p.name));
  for(let i=0;i<pool.length;i++) for(let j=i+1;j<pool.length;j++){
    const p=pool[i], q=pool[j];
    const avg=(p.rating+q.rating)/2;
    const gap=Math.abs(avg-targetRating);
    if(!best || gap<best.gap) best={gap, pair:[p.name,q.name], avg_rating:Math.round(avg*10)/10};
  }
  return best ? {pair:best.pair, avg_rating:best.avg_rating, gap_to_target:Math.round(best.gap*10)/10} : null;
}

function buildDifficultySuggestions(allPlayers, activePlayers){
  const diff = {};
  const byTier = {};
  activePlayers.forEach(p=>{ (byTier[p.tier]=byTier[p.tier]||[]).push(p); });

  allPlayers.forEach(p=>{
    const R = p.rating;
    const exclude = new Set([p.name]);
    const tierPeers = (byTier[p.tier]||[]).filter(x=>x.name!==p.name);
    const withinTier = tierPeers.length >= 2;

    let easy, balanced, hard;
    if(withinTier){
      const tierRatings = (byTier[p.tier]||[]).map(x=>x.rating);
      const tierMin = Math.min(...tierRatings), tierMax = Math.max(...tierRatings);
      easy = bestPairNear(tierPeers, tierMin, exclude);
      balanced = bestPairNear(tierPeers, R, exclude);
      hard = bestPairNear(tierPeers, tierMax, exclude);
    } else {
      // not enough same-tier players (e.g. Manny, the only Tier S player) -- fall back to any tier
      easy = bestPairNear(activePlayers, R-150, exclude);
      balanced = bestPairNear(activePlayers, R, exclude);
      hard = bestPairNear(activePlayers, R+150, exclude);
    }

    diff[p.name] = {
      easy, balanced, hard, withinTier,
      crossTier: bestPairNear(activePlayers, R, exclude), // best overall-rating match regardless of tier
    };
  });
  return diff;
}

// ===================== v3 APPLICATION STATE =====================
// V3_STATE is loaded once at start-up from the beta `players` collection and is
// the source of every Power Rating the application shows. The legacy solver is
// still present for beta diagnostics but no longer feeds the UI.
let V3_STATE = (typeof V3Bridge !== 'undefined') ? V3Bridge.createState() : { loaded:false, error:'v3Bridge.js did not load', players:{} };
let V3_MATCHES = [];   // the v3 `matches` collection, in the shape the app reads
let V3_JOURNEY = [];   // the Rating Journey -- monthly views only, never player state
let V3_MATCH_FACTS = {}; // matchId -> what the engine did in that match, read back
// The authoritative "what tier was this player in on this date" lookup, built
// from the RECORD. Hoisted so the Games tab labels and the game-type filter use
// the same source as the monthly views -- a label and a classification that
// disagreed would be worse than either alone.
let V3_TIER_AS_OF = null;
let V3_TIER_HISTORY = null;
// The record as stored, kept for one purpose: checking that replaying it still
// reproduces it. Assembled from documents the load already read.
let V3_RECORD = null;
// The divergence found this session, if any. One check per session -- it is
// pure arithmetic over data already in memory, but it replays the whole
// history, so it runs once and off the critical path.
let healthReport = null;
let healthCheckDone = false;
let MONTHLY_VIEWS = null;
let PRODUCTION_SNAPSHOT_INDEX = (typeof PRODUCTION_SNAPSHOT !== 'undefined' && typeof V3Bridge !== 'undefined')
  ? V3Bridge.indexSnapshot(PRODUCTION_SNAPSHOT) : {};

// The frozen identity behind a display name. EVERYTHING that writes to the
// record -- a new match, a club decision, a historical adjustment -- must go
// through this first. A display name written into the record would be a new
// player as far as the engine is concerned.
function playerIdFor(name){
  if(V3_STATE && V3_STATE.alias) return PlayerNames.toId(V3_STATE.alias, name);
  return name;
}

// …and the reverse, for the rare place that holds a stored id and needs to
// show it (the admin audit trail, mostly).
function displayNameFor(playerId){
  if(V3_STATE && V3_STATE.alias) return PlayerNames.toDisplay(V3_STATE.alias, playerId);
  return playerId;
}

async function loadV3State(){
  if(!db){ V3_STATE = {loaded:false, error:'No database connection.', players:{}}; }
  else {
    // All three collections are asked for at once. v3Bridge still awaits them
    // in order -- see RatingStore.prefetchedBackend for why that is now free.
    const backend = RatingStore.prefetchedBackend(
      RatingStore.firestoreCompatBackend(db), ['players', 'matches', 'ratingJourney']);
    V3_STATE = await PerfTrace.timeAsync('read players', V3Bridge.load(backend));
    if(V3_STATE.loaded){
      try {
        const rawMatches = {};
        const rawJourney = {};
        V3_MATCHES = await PerfTrace.timeAsync('read matches', V3Bridge.loadMatches(backend, rawMatches, V3_STATE.alias));
        // Loaded at start-up rather than lazily because the app opens on a
        // monthly view, so a lazy read would fire immediately anyway.
        V3_JOURNEY = await PerfTrace.timeAsync('read ratingJourney', V3Bridge.loadJourney(backend, rawJourney, V3_STATE.alias));
        // Tiers come from v3 state, NOT from TIER_MAP. TIER_MAP is still {} at
        // this point -- rebuildMapsFromState() has not run yet -- and an empty
        // map made tierAsOf() answer `undefined` for every player who was not
        // in the authoritative change list, which silently emptied every
        // historical tier, within-tier rank and tierChanged flag in the app.
        // TierHistory.create() now rejects an empty map so this cannot recur
        // quietly, but the right source was always v3's own tiers.
        // What the engine did in each match, so no screen has to re-derive an
        // expectation, a pre-match rating or a rating change from today's state.
        V3_MATCH_FACTS = PerfTrace.time('MatchFacts.index', ()=> MatchFacts.index(V3_JOURNEY));
        // Tier changes come from the RECORD, not from the seed's frozen list.
        // With the list, the first real promotion the club records makes the
        // current tier disagree with the history and the consistency guard
        // refuses to load the app at all.
        // The whole history, not just the lookup: the League Table needs to
        // know WHEN a player changed tier, not only what they were on a given
        // day. Sampling dates to find that out would miss a second change in
        // the same month.
        V3_TIER_HISTORY = TierHistory.create({
          currentTiers: V3Bridge.tierMap(V3_STATE),
          changes: TierHistory.changesFromJourney(V3_JOURNEY),
        });
        V3_TIER_AS_OF = V3_TIER_HISTORY.tierAsOf;
        MONTHLY_VIEWS = PerfTrace.time('MonthlyViews.build', ()=> MonthlyViews.build(V3_JOURNEY, { tierAsOf: V3_TIER_AS_OF }));
        // The record in its stored form, which is what a replay is verified
        // against. Assembled from documents already read; it costs nothing.
        // The record in its STORED form -- ids, not labels. Everything above
        // works in labels; the replay verifier, the repair planner and the
        // diagnostics must see exactly what is in Firestore, or a renamed
        // player looks like a player who has vanished and been replaced.
        V3_RECORD = { matches: rawMatches.raw || [], journey: rawJourney.raw || [], players: V3_STATE.rawPlayerDocs || [] };
      }
      catch(e){
        V3_MATCHES = []; V3_JOURNEY = []; MONTHLY_VIEWS = null;
        V3_MATCH_FACTS = {}; V3_TIER_AS_OF = null; V3_TIER_HISTORY = null; V3_RECORD = null;
        V3_STATE = {...V3_STATE, loaded:false, error:'Could not read v3 history: ' + e.message};
      }
    }
  }
  if(!V3_STATE.loaded) console.error('v3 state failed to load:', V3_STATE.error);
  renderV3StatusBanner();
  return V3_STATE;
}

// Without this the app just renders "No players match that filter", which reads
// as a filter problem rather than a failed rating load. A beta comparing two
// rating systems cannot afford an ambiguous empty state.
function renderV3StatusBanner(){
  const id = 'v3StatusBanner';
  document.getElementById(id)?.remove();
  if(V3_STATE.loaded) return;
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#5b1a17;color:#ffd9d6;'
    + 'padding:10px 14px;font-size:13px;line-height:1.4;border-bottom:1px solid #8a2a25;';
  el.innerHTML = '<b>Power Ratings unavailable.</b> v3 player state could not be loaded, so no rating is shown. '
    + 'The legacy rating has deliberately not been substituted.<br><span style="opacity:.8;font-size:12px;">'
    + String(V3_STATE.error || 'Unknown error') + '</span>';
  document.body.appendChild(el);
}

function recomputeAll(){
  return PerfTrace.time('recomputeAll', recomputeAllNow);
}

function recomputeAllNow(){
  rebuildMapsFromState();
  ALL_MATCHES = getEffectiveMatches();

  // If v3 state is unavailable the application shows nothing rather than
  // something plausible. It must never quietly fall back to the legacy solver,
  // to a tier seed, or to 1400 -- a believable wrong number is the worst
  // outcome for a beta whose entire purpose is comparing two rating systems.
  if(!V3_STATE.loaded){
    PLAYERS = []; MATCHES = []; DRAW_MATCHES = []; ALL_MATCHES = []; H2H = {}; PARTNERSHIPS = []; BEST_PARTNER = {};
    BOUNDARY_TESTS = []; CALIBRATION_GAMES = []; WITHIN_TIER_GAMES = []; DIFFICULTY_SUGGESTIONS = {};
    INACTIVE_PLAYERS = new Set();
    return;
  }

  const ratings = V3Bridge.ratingsMap(V3_STATE);
  // Tier comes from v3 too, so a rating and the tier shown beside it always
  // describe the same state.
  const v3Tiers = V3Bridge.tierMap(V3_STATE);
  Object.keys(v3Tiers).forEach(n=>{ TIER_MAP[n] = v3Tiers[n]; });

  // NOTE (migration task): enrichMatches recomputes expectations from CURRENT
  // ratings. Those values are legacy-derived and are NOT v3 pre-match
  // expectations, which live in ratingJourney. They must not be presented as
  // such, and this function is scheduled for replacement.
  MATCHES = enrichMatches(ALL_MATCHES);
  // Drawn matches, enriched the same way, kept in their own list.
  //
  // MATCHES deliberately holds only the matches the RATING is computed from,
  // and a draw has no winner to rate, so it is not in there -- and must not
  // be, or every win/loss total in the club would move. But a draw is still a
  // game that was played, and a screen showing a player's history, a
  // head-to-head or a doughnut has no business pretending it did not happen.
  // So the screens that describe games ask for this as well, and the ones
  // that calculate do not.
  DRAW_MATCHES = enrichMatches(getAllApprovedMatches().filter(m => m.isDraw));
  PLAYERS = buildPlayers(matchesIncludingDraws(), ratings, TIER_MAP, ACTIVE_MAP);
  PLAYERS.forEach(p=>V3Bridge.decoratePlayer(p, V3_STATE, PRODUCTION_SNAPSHOT_INDEX));
  // Each player's standing in the group (playerStatus.js): the status on their
  // record, else the legacy Admin flag -- looked up under any name they have
  // had -- else active. `active` keeps its old meaning for every engine that
  // reads it: playing now, so not temporarily inactive and not archived.
  PLAYERS.forEach(p=>{
    const legacy = [p.name].concat(p.previousDisplayNames || []).map(n => ACTIVE_MAP[n]).find(v => typeof v === 'boolean');
    p.status = PlayerStatus.statusOf({ stored: p.storedStatus, legacyActive: legacy });
    p.active = PlayerStatus.isPlaying(p.status);
  });

  // v3 rates draws, and buildPlayers counts them, which is what makes a
  // player's record reconcile with the evidence behind their rating:
  // wins + draws + losses === lifetimeMatches.
  PLAYERS.forEach(p=>{
    p.recordTotal = p.wins + p.losses + p.draws;
    p.recordReconciles = (p.lifetimeMatches === undefined) || (p.recordTotal === p.lifetimeMatches);
  });
  PLAYERS.forEach(p=>{
    const form = computeRecentForm(p.name, 10);
    p.recent_form = form ? form.avgPct : null;
    p.recent_form_games = form ? form.games : 0;
    p.recent_form_wins = form ? form.wins : 0;
    p.recent_form_losses = form ? form.losses : 0;
    p.recent_form_draws = form ? form.draws : 0;
    p.recent_form_days_ago = form ? form.daysSinceLastGame : null;
    p.recent_form_stale = form ? form.daysSinceLastGame > RECENT_FORM_STALE_DAYS : false;
  });
  // Meetings and partnerships count every game played, draws included.
  H2H = buildH2H(matchesIncludingDraws());
  PARTNERSHIPS = buildPartnerships(matchesIncludingDraws(), TIER_MAP);
  BEST_PARTNER = buildBestPartner(PARTNERSHIPS);
  INACTIVE_PLAYERS = new Set(PLAYERS.filter(p=>!p.active).map(p=>p.name));
  const activePlayers = PLAYERS.filter(p=>p.active);
  BOUNDARY_TESTS = buildBoundaryTests(activePlayers, H2H);
  CALIBRATION_GAMES = buildCalibrationGames(activePlayers, H2H);
  WITHIN_TIER_GAMES = buildWithinTierGames(activePlayers, H2H);
  DIFFICULTY_SUGGESTIONS = buildDifficultySuggestions(PLAYERS, activePlayers);
  const monthSelectEl = document.getElementById('monthSelect');
  if(monthSelectEl) populateMonthSelect(monthSelectEl, selectedMonth);
}


const TIERS = ["All","S","A","B","C"];
let activeTab = "power";
let activeTier = "All";
let activeSort = "wins";
let activeSortP = "rating";
let query = "";
let minGames = 10;
// Two independent toggles over the ranking pool. Off, the list is the official
// current ranking pool -- Ranked and Active. On, that group is MERGED into the
// same ordered list and given a filtered-view rank position, keeping its badge
// so the real state stays visible. A separate section underneath answered a
// different question ("who else exists") than the one being asked ("where would
// they sit"), which is why this replaced it.
//
// Neither toggle changes official eligibility, participation, stored ratings or
// history. They change which pool is being looked at, and nothing else.
let includeIdle = false;
let includeInactive = false;

// ===================== WHO OWNS WHICH MONTH =====================
// `selectedMonth` belongs to POWER RANKINGS and to nothing else: the list, the
// podium, Kings of Tiers, the tier badge and the month select above them. It
// opens on the last completed month because a finished month is the
// competition Rankings is showing.
//
// Every other screen that has a month owns its own, and none of them may read
// or write this one:
//
//   Power Rankings                 selectedMonth  Meaningful Month
//   League / Merit / Information   summaryMonth   Meaningful Month
//   Home's monthly card            (no control)   Meaningful Month
//   Games                          gamesMonth     All time
//   Compare (head-to-head)         h2hMonth       All time
//   Player Profile                 profileMonth   All time, on every open
//   Last 10, current rating, the   (none)         rolling / current -- never
//   profile's current state                       a month at all
//
// MEANINGFUL MONTH (meaningfulMonth.js): the current month once it holds five
// canonical matches, otherwise the most recently completed month. It replaced
// "always last month", which solved the empty-1st-of-the-month problem by the
// calendar and so went on opening August on the 25th of September.
//
// A screen that uses it keeps TWO things apart, never one:
//   ...MonthChoice   what the reader picked with the month control, or null
//   ...MonthDefault  the Meaningful Month, evaluated when they ARRIVE and then
//                    held while they stay -- so a fifth game landing mid-read
//                    does not move the page under them
// and shows the choice if there is one, else the default. A choice lasts the
// session; arriving again without one re-evaluates the default.
//
// This was ONE variable once, set by whoever touched a month select last, and
// that was harmless while a person chose it. It stopped being harmless when
// Rankings began choosing it automatically at start-up: from then on every
// screen that shared it inherited "August" from a view the reader had never
// opened. Games was the first to show it and got its own month; Home's
// "View match" was worked around; the Player Profile went on opening as an
// August snapshot for everybody until this was fixed at the root. A
// source-level test now fails the build if anything outside Rankings touches
// `selectedMonth`.
let selectedMonth = 'all';          // what Rankings SHOWS: the choice, else the default
let rankingsMonthChoice = null;     // what the reader picked, or null
let rankingsMonthDefault = null;    // MeaningfulMonth.evaluate(), pinned on arrival
let summaryMonthChoice = null;
let summaryMonthDefault = null;
let homeMonthDefault = null;        // Home has no control: a default and nothing else

// The canonical count the rule runs on: rated/completed matches, draws
// included, pending and display-only history excluded.
function meaningfulMonthNow(){
  return MeaningfulMonth.evaluate({ now: new Date(), matches: getAllApprovedMatches() });
}

// Rankings' month moves between All time and a month by the same rule the
// month control has always followed: a month means the monthly min-games
// default, All time the overall one.
function applyRankingsMonth(month){
  const wasAll = selectedMonth === 'all';
  const isNowAll = month === 'all';
  selectedMonth = month;
  if(wasAll && !isNowAll) setMinGames(5);
  else if(!wasAll && isNowAll) setMinGames(10);
  const sel = document.getElementById('monthSelect');
  if(sel && [...sel.options].some(o => o.value === month)) sel.value = month;
}

// Arriving at Rankings. A reader who has chosen gets their choice back; one
// who has not gets the Meaningful Month as it stands NOW, which is the only
// moment it is re-evaluated.
function arriveAtRankings(){
  if(rankingsMonthChoice !== null && (rankingsMonthChoice === 'all' || getAvailableMonths().includes(rankingsMonthChoice))){
    applyRankingsMonth(rankingsMonthChoice);
    return;
  }
  rankingsMonthChoice = null;
  rankingsMonthDefault = meaningfulMonthNow();
  applyRankingsMonth(rankingsMonthDefault.month);
}

function arriveAtSummary(){
  if(summaryMonthChoice !== null && (summaryMonthChoice === 'all' || getAvailableMonths().includes(summaryMonthChoice))){
    summaryMonth = summaryMonthChoice;
    return;
  }
  summaryMonthChoice = null;
  summaryMonthDefault = meaningfulMonthNow();
  summaryMonth = summaryMonthDefault.month;
}

// Home has no month control, so it only ever shows its default -- pinned when
// Home is arrived at, held through redraws. An empty club has no completed
// month; Home then shows the current one rather than "All time", which is not
// a month a card headed "<Month> at Money Padel" can be about.
function homeMonth(){
  if(!homeMonthDefault) homeMonthDefault = meaningfulMonthNow();
  return homeMonthDefault.month === 'all' ? homeMonthDefault.current : homeMonthDefault.month;
}
function arriveAtHome(){
  homeMonthDefault = null;
  // Needs you starts shut on every arrival: its count is the signal (Phase 3a).
  if(typeof homeNeedsOpen !== 'undefined') homeNeedsOpen = false;
}

// The understated line that says why a screen opened on last month: "October
// is taking shape · 3 of 5 games". Only while the screen is showing its
// DEFAULT, only while the current month is still thin, and only once it has
// at least one game -- on the 1st there is nothing to explain and nothing to
// offer. The month name is a way in: tapping it chooses the current month.
function meaningfulMonthNoteHtml(defaultInfo, showing, choiceId, interactive){
  if(!defaultInfo || defaultInfo.reason !== 'current-too-thin') return '';
  if(showing !== defaultInfo.month) return '';
  if(defaultInfo.currentCount < 1) return '';
  const name = MeaningfulMonth.monthLabel(defaultInfo.current).split(' ')[0];
  // Home has no month control, so its line is only a line.
  const lead = interactive === false
    ? `<span>${name}</span>`
    : `<button type="button" class="mm-note-link" id="${choiceId}Current" data-month="${defaultInfo.current}">${name}</button>`;
  return `<div class="mm-note" id="${choiceId}Note">${lead} is taking shape · ${defaultInfo.currentCount} of ${defaultInfo.threshold} games</div>`;
}

// Tapping the month in that line CHOOSES it, exactly as the month control
// would -- the current month is always there to be picked, five games or not.
function wireMeaningfulMonthNote(choiceId, choose){
  const link = document.getElementById(`${choiceId}Current`);
  if(link) link.onclick = ()=> choose(link.dataset.month);
}
// The Play history keeps its OWN month, and it stays on All time. Rankings and
// the monthly views deliberately open on the last completed month; the results
// feed is a history you scroll, not a month you inspect, and Shaun's decision
// is that it does not follow them. Sharing `selectedMonth` meant the boot-time
// rankings default silently became the Games default too, so Games opened on
// August rather than All time.
let gamesMonth = 'all';
// Tier composition of the four players on the day: 'all', 'cat:ALL_A',
// 'match:AB vs BB', and so on. Layers with Month and Player rather than
// replacing either.
let gamesType = 'all';
// Up to four players, as CANONICAL IDS, in no particular order. A match has
// to contain all of them to be shown.
//
// Ids rather than the names on screen: a player's name is a label an admin can
// change, and matching on labels would mean renaming Rishi silently emptied
// every search that mentioned him. See playerFilter.js.
let gamesPlayerIds = [];
// What the selector wants to say about what was just typed -- an unrecognised
// name, or the same player twice. Held in state rather than written straight
// into the panel, because applying a filter re-renders the panel and would
// wipe the note before anybody read it.
let gamesPlayersNote = '';

// The Games filters arrive shut. Three full-width selects sat above the match
// log on every visit, and the log is what the screen is for. Not persisted:
// the screen should open the same way every time. Whatever the filters are
// set to is written on the closed heading, so shut is never silent.
let gamesFiltersOpen = false;

// ---- Data Range: app-wide dataset setting, not a per-screen filter --------
// 'verified' -- June 2026 onwards only, cross-checked. The default, and the
//               recommended experience.
// 'all'      -- full history, including pre-June 2026 matches that were
//               single-sourced and may be incomplete or less reliable.
// Lives in More > Data & Rankings, is persisted per device, and is applied in
// exactly one place (getAllApprovedMatches) so every screen agrees.
const DATA_RANGE_STORAGE_KEY = 'moneypadel_data_range';
const DATA_RANGE_ACK_KEY = 'moneypadel_data_range_full_ack';

function readStoredDataRange(){
  // localStorage can be unavailable/restricted (private browsing, PWA edge
  // cases) -- degrade to the recommended default rather than failing.
  try {
    return localStorage.getItem(DATA_RANGE_STORAGE_KEY) === 'all' ? 'all' : 'verified';
  } catch(e){ return 'verified'; }
}

let dataRange = readStoredDataRange();

function setDataRange(value){
  dataRange = (value === 'all') ? 'all' : 'verified';
  try { localStorage.setItem(DATA_RANGE_STORAGE_KEY, dataRange); } catch(e){ /* choice just won't persist */ }
}

function hasAcknowledgedFullHistory(){
  try { return localStorage.getItem(DATA_RANGE_ACK_KEY) === '1'; } catch(e){ return false; }
}

function acknowledgeFullHistory(){
  try { localStorage.setItem(DATA_RANGE_ACK_KEY, '1'); } catch(e){}
}

function getAvailableMonths(){
  const months = new Set();
  getDisplayMatches().forEach(m=> months.add(Period.of(m.date)));
  return [...months].sort();
}

// "Which month should a monthly view open on" used to live here as
// getDefaultRankingsMonth(): always the previous calendar month. It is now the
// Meaningful Month rule (meaningfulMonth.js), evaluated per screen on arrival
// -- see "WHO OWNS WHICH MONTH" above. Deleted rather than left beside it, so
// there is one rule and nothing to drift back to.

// Month selection and Data Range are deliberately separate concepts: the
// range decides which matches exist at all, the month decides which slice of
// them you're inspecting. Narrowing the range can therefore strand a month
// that no longer has any data behind it (e.g. sitting on May 2026 and
// switching back to Verified). Rather than silently widening the dataset
// again, drop back to the normal default month for whatever data is now
// available.
function reconcileSelectedMonth(){
  if(selectedMonth === 'all') return false;
  if(getAvailableMonths().includes(selectedMonth)) return false;
  // The month shown no longer exists in this dataset. If the reader chose it,
  // the choice has nothing left to point at; either way the screen goes back
  // to its default, re-evaluated.
  rankingsMonthChoice = null;
  arriveAtRankings();
  return true;
}

// "October 2026", or a quarter's "Oct–Dec 2026" (config/period.js).
function monthLabel(ym){
  return Period.label(ym);
}
function dayLabel(ymd){
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y,m,d] = ymd.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return `${days[dt.getDay()]}, ${d} ${months[m-1]} ${y}`;
}
function computeMonthlyStats(month){
  // Every rated game, draws included -- the same games buildPlayers counts.
  const all = matchesIncludingDraws();
  const filtered = month==='all' ? all : all.filter(m=>Period.of(m.date)===month);
  // Judge opponent strength and upset status using each player's rating AS OF this specific
  // month, not their season-long rating -- otherwise "avg opp." and "upset" would be judged by
  // a different yardstick than the Month Rating headline number sitting right next to them.
  const monthlyRatings = month==='all' ? {} : monthEndRatings(month);
  function ratingFor(name){
    if(name in monthlyRatings) return monthlyRatings[name];
    const p = PLAYERS.find(x=>x.name===name);
    // No silent 1400. A missing player is a real fault and must surface as one
    // rather than as a plausible-looking rating.
    if(!p) throw new Error(`No rating available for ${name} — v3 state is missing this player.`);
    return p.rating;
  }
  const agg = {};
  function A(name){
    if(!agg[name]) agg[name] = {wins:0, draws:0, losses:0, strengths:[], overperf:[], games_w:0, games_l:0, upset_wins:0, upset_losses:0};
    return agg[name];
  }
  const GAP_THRESHOLD = 15;
  filtered.forEach(m=>{
    const winnerTeamRating = m.winners[1] ? (ratingFor(m.winners[0]) + ratingFor(m.winners[1])) / 2 : ratingFor(m.winners[0]);
    const loserTeamRating = m.losers[1] ? (ratingFor(m.losers[0]) + ratingFor(m.losers[1])) / 2 : ratingFor(m.losers[0]);
    const monthMatchStrength = (winnerTeamRating + loserTeamRating) / 2;
    const gap = Math.abs(winnerTeamRating - loserTeamRating);
    const isClose = gap < GAP_THRESHOLD;
    const winnerFavored = winnerTeamRating > loserTeamRating;
    const isUpset = !isClose && !winnerFavored;
    if(m.isDraw){
      // A game played, neither won nor lost, and never an upset.
      [[m.winners, 1, m.games_winner, m.games_loser], [m.losers, -1, m.games_loser, m.games_winner]].forEach(([side, sign, gf, ga])=>side.forEach(p=>{
        const a = A(p);
        a.draws++; a.strengths.push(monthMatchStrength); a.overperf.push(sign * m.performance_residual);
        a.games_w += gf; a.games_l += ga;
      }));
      return;
    }
    m.winners.forEach(p=>{
      const a = A(p);
      a.wins++; a.strengths.push(monthMatchStrength); a.overperf.push(m.performance_residual);
      a.games_w += m.games_winner; a.games_l += m.games_loser;
      if(isUpset) a.upset_wins++;
    });
    m.losers.forEach(p=>{
      const a = A(p);
      a.losses++; a.strengths.push(monthMatchStrength); a.overperf.push(-m.performance_residual);
      a.games_w += m.games_loser; a.games_l += m.games_winner;
      if(isUpset) a.upset_losses++;
    });
  });
  const stats = {};
  Object.keys(agg).forEach(name=>{
    const a = agg[name];
    const total = a.wins+a.draws+a.losses;
    const avgStrength = a.strengths.length ? a.strengths.reduce((s,x)=>s+x,0)/a.strengths.length : 0;
    const avgOverperf = a.overperf.length ? 100*a.overperf.reduce((s,x)=>s+x,0)/a.overperf.length : 0;
    stats[name] = {
      wins:a.wins, draws:a.draws, losses:a.losses, total, winpct: total?Math.round(1000*a.wins/total)/10:0,
      avg_match_strength: Math.round(avgStrength*10)/10, avg_overperf_pct: Math.round(avgOverperf*10)/10,
      game_diff: a.games_w-a.games_l,
      upset_wins:a.upset_wins, upset_losses:a.upset_losses, upset_total:a.upset_wins+a.upset_losses,
      upset_rate: total?Math.round(1000*(a.upset_wins+a.upset_losses)/total)/10:0,
    };
  });
  return stats;
}

// A genuine tier-seeded rating computed from ONLY the given month's matches -- as if that month
// were its own month-end snapshot of the one continuous rating. (The former
// restricted match set. Players with no games that month simply won't appear in the result.
// The real Power Rating each player held at that month's close, taken from the
// chronological Sequential-v1 trajectory. This REPLACES the retired
// computeMonthlyRating, which solved a separate monthly rating of its own.
// There is no monthly solver any more and there must not be one again.
// Which tier a player was in for the scope currently on screen. In a month view
// that is the tier they held at that month's close -- the same tier the monthly
// within-tier ranks use -- never the tier they hold today. Promoting someone in
// September must not rewrite them into Tier B's June honours board.
//
// Returns null when the selected month has no record of the player, which is
// deliberate: they are then absent from a tier-filtered view rather than being
// filed under a tier they did not hold.
function tierInScope(player){
  if(selectedMonth === 'all') return player.tier;
  return tierAtMonthClose(player.name, selectedMonth);
}

function matchesActiveTier(player){
  return activeTier === 'All' || tierInScope(player) === activeTier;
}

// ---- Monthly stories -------------------------------------------------------
// Three distinct measures, never merged: where the real Power Rating stood and
// how far it moved, how the rank moved, and how far play beat expectation.
function monthlyMovementIndex(month){
  if(month === 'all' || !MONTHLY_VIEWS) return {};
  const m = MONTHLY_VIEWS.byMonth[month];
  if(!m) return {};
  const out = {};
  m.rows.forEach(r=>{ out[r.playerId] = r; });
  return out;
}


function monthEndRatings(month){
  if(month === 'all' || !MONTHLY_VIEWS) return {};
  return MonthlyViews.monthEndRatings(MONTHLY_VIEWS, month);
}

// Builds the raw ingredients for a "monthly awards" style recap: games played, wins/losses/draws
// and points (3/win, 1/draw), win% and loss% (of all games that month, draws included in the
// denominator), doughnuts conceded (any set lost 0-6 or similar), and a "hardest games" score
// (that player's average opponent strength that month, scaled down by 300 -- the same tier-gap
// unit used everywhere else in the app -- into a friendlier small number).
// Skip filtering by date when 'all' is chosen, so the same summary format also works as a
// whole-season recap, not just a single month.
// `splitByTier` files each match under the tier the player was in ON THAT
// DATE, so a mid-month tier change produces two rows rather than moving a
// month's points into whichever tier they ended in. Off by default: every
// other caller wants one row per player for the whole month.
function computeMonthlySummaryStats(month, { splitByTier } = {}){
  const agg = {};
  const identity = {};   // aggregation key -> { name, tier, dates }
  function A(name, date){
    const tier = splitByTier ? historicalTierOf(name, date) : null;
    // A match whose tier cannot be established is still the player's match.
    // It is aggregated under them without a tier rather than dropped, and the
    // grouped view simply has no tier section to put it in.
    const key = splitByTier ? LeagueSplit.keyFor(name, tier || '') : name;
    if(!agg[key]){
      agg[key] = {wins:0, losses:0, draws:0, doughnuts:0, strengths:[], games_w:0, games_l:0, list:[]};
      identity[key] = { name, tier: splitByTier ? tier : null, dates: [] };
    }
    if(date) identity[key].dates.push(date);
    return agg[key];
  }

  // Rated (non-draw) matches: ALL_MATCHES carries the raw set scores; MATCHES (same index, same
  // order) carries the computed match_strength -- combine the two rather than assuming either
  // array alone has everything needed.
  ALL_MATCHES.forEach((raw, idx)=>{
    if(month !== 'all' && Period.of(raw.date) !== month) return;
    const enriched = MATCHES[idx];
    if(!enriched) return;
    const allNames = [...new Set([...raw.winners, ...raw.losers])];
    allNames.forEach(n => A(n, raw.date).strengths.push(enriched.match_strength));
    // Each count and the game it counts, in one step: whatever opens a row's
    // P, W, L or D reads this list, so it can only ever show what was counted.
    const game = (result) => ({ id: raw.id, date: raw.date, winners: raw.winners.slice(), losers: raw.losers.slice(), sets: raw.sets, isDraw: false, result });
    raw.winners.forEach(n=>{ const a = A(n, raw.date); a.wins++; a.games_w += enriched.games_winner; a.games_l += enriched.games_loser; a.list.push(game('W')); });
    raw.losers.forEach(n=>{ const a = A(n, raw.date); a.losses++; a.games_w += enriched.games_loser; a.games_l += enriched.games_winner; a.list.push(game('L')); });
    raw.sets.forEach(([x,y])=>{
      if(y === 0) raw.losers.forEach(n=>A(n, raw.date).doughnuts++);
      if(x === 0) raw.winners.forEach(n=>A(n, raw.date).doughnuts++);
    });
  });

  // Draws are excluded from the rating engine entirely, so they're pulled separately here --
  // "winners"/"losers" on a draw just mean team1/team2, not an actual result.
  getAllApprovedMatches().filter(m => m.isDraw && (month==='all' || Period.of(m.date)===month)).forEach(m=>{
    const allNames = [...new Set([...m.winners, ...m.losers])];
    const strengthEstimate = allNames.reduce((s,n)=>{
      const p = PLAYERS.find(x=>x.name===n);
      return s + (p ? p.rating : 1400);
    }, 0) / (allNames.length || 1);
    allNames.forEach(n => A(n, m.date).strengths.push(strengthEstimate));
    const team1Games = m.sets.reduce((s,[x,y])=>s+x,0);
    const team2Games = m.sets.reduce((s,[x,y])=>s+y,0);
    const drawn = { id: m.id, date: m.date, winners: m.winners.slice(), losers: m.losers.slice(), sets: m.sets, isDraw: true, result: 'D' };
    m.winners.forEach(n=>{ const a = A(n, m.date); a.draws++; a.games_w += team1Games; a.games_l += team2Games; a.list.push(drawn); });
    m.losers.forEach(n=>{ const a = A(n, m.date); a.draws++; a.games_w += team2Games; a.games_l += team1Games; a.list.push(drawn); });
    m.sets.forEach(([x,y])=>{
      if(y === 0) m.losers.forEach(n=>A(n, m.date).doughnuts++);
      if(x === 0) m.winners.forEach(n=>A(n, m.date).doughnuts++);
    });
  });

  const out = {};
  Object.keys(agg).forEach(key=>{
    const a = agg[key];
    const who = identity[key];
    const name = who.name;
    const games = a.wins + a.losses + a.draws;
    const avgStrength = a.strengths.length ? a.strengths.reduce((s,x)=>s+x,0)/a.strengths.length : 0;
    out[key] = {
      name, games, wins: a.wins, losses: a.losses, draws: a.draws,
      // Present only when splitting; the tier this stretch of the month was
      // played in, and the dates it covers.
      segmentTier: who.tier, segmentDates: who.dates.slice(),
      // The games behind P (and, by result, W / L / D).
      matchList: a.list.slice(),
      points: a.wins*3 + a.draws*1,
      winpct: games ? Math.round(1000*a.wins/games)/10 : 0,
      losspct: games ? Math.round(1000*a.losses/games)/10 : 0,
      gd: a.games_w - a.games_l,
      doughnuts: a.doughnuts,
      hardness: Math.round((avgStrength/300)*10)/10,
      avg_opp: Math.round(avgStrength),
    };
  });
  return out;
}

// Turns a metric into a ranked, tie-grouped top-N list: {rank, names:[...], value}. Ties share a
// rank and are grouped together (e.g. two players tied for 3rd both show as rank 3).
function topNTied(statsArr, key, n, descending){
  const sorted = statsArr.slice().sort((a,b)=> descending ? b[key]-a[key] : a[key]-b[key]);
  const groups = [];
  sorted.forEach(s=>{
    const last = groups[groups.length-1];
    if(last && last.value === s[key]){
      last.names.push(s.name);
    } else {
      groups.push({ value: s[key], names: [s.name] });
    }
  });
  return groups.slice(0, n).map((g,i)=>({ rank: i+1, names: g.names, value: g.value }));
}
const ZERO_MONTH_STATS = {wins:0,draws:0,losses:0,total:0,winpct:0,avg_match_strength:0,avg_overperf_pct:0,game_diff:0,upset_wins:0,upset_losses:0,upset_total:0,upset_rate:0};

// `value` is required. It used to default to the Rankings month, which is how a
// select that forgot to say whose month it showed quietly displayed -- and
// then, via its change handler, overwrote -- somebody else's.
function populateMonthSelect(selectEl, value){
  if(!selectEl) return;
  if(value === undefined) throw new Error('populateMonthSelect: say whose month this is');
  const current = value;
  const months = getAvailableMonths();
  selectEl.innerHTML = `<option value="all">All time</option>` + months.map(m=>`<option value="${m}" ${m===current?'selected':''}>${monthLabel(m)}</option>`).join('');
  selectEl.value = current;
}

function applyTabVisibility(){
  document.querySelectorAll('#tabrow .tab-btn').forEach(btn=>{
    const tab = btn.dataset.tab;
    const visible = canSeeTab(tab);
    btn.style.display = visible ? '' : 'none';
    // if the active tab just got hidden, fall back to Win/Loss
    if(!visible && activeTab === tab){
      activeTab = 'wl';
      document.querySelectorAll('#tabrow .tab-btn').forEach(b=>b.classList.remove('active'));
      const wlBtn = document.querySelector('#tabrow .tab-btn[data-tab="wl"]');
      if(wlBtn) wlBtn.classList.add('active');
      ['calloutsView','playersView','findGameView','manageView','gamesView','h2hView','wishlistView','upcomingView'].forEach(id=>{
        const el = document.getElementById(id); if(el) el.style.display = 'none';
      });
      const listEl = document.getElementById('list'); if(listEl) listEl.style.display = 'block';
      ['tierbar','searchWrap','minGamesRow','monthFilterRow','sortbar'].forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.style.display = (id==='searchWrap') ? 'block' : 'flex';
      });
      const sp = document.getElementById('sortbarPower'); if(sp) sp.style.display = 'none';
    }
  });
  // The shell draws its own navigation from the same rule.
  if(typeof onVisibilityChanged === 'function') onVisibilityChanged();
}

function rerenderCurrentTab(){
  if(activeTab==='wl' || activeTab==='power') render();
  else if(activeTab==='games') renderGamesTab();
  else if(activeTab==='callouts') renderCallouts();
}


const tierbar = document.getElementById('tierbar');
TIERS.forEach(t=>{
  const b = document.createElement('button');
  b.className = 'tierbtn' + (t==='All' ? ' active' : '');
  b.textContent = t === 'All' ? 'All tiers' : 'Tier ' + t;
  b.dataset.tier = t;
  b.onclick = ()=>{ activeTier = t; document.querySelectorAll('.tierbtn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); render(); };
  tierbar.appendChild(b);
});

document.querySelectorAll('#tabrow .tab-btn').forEach(b=>{
  b.onclick = ()=>{
    // Every route to a screen -- shell navigation, More, Home shortcuts, a
    // button on another screen -- arrives through here. A screen switched to
    // Admin only is not drawn for a player however they got here.
    if(!canSeeTab(b.dataset.tab)){
      const fb = document.querySelector(`#tabrow .tab-btn[data-tab="${visibleFallbackTab(b.dataset.tab)}"]`);
      if(fb && fb !== b) fb.click();
      return;
    }
    const arrivingFrom = activeTab;
    activeTab = b.dataset.tab;
    // Arrival is navigation, not redrawing. dataChanged() and every other
    // redraw go through renderActiveTab and never pass here, which is what
    // keeps a default from moving while somebody is reading it. Power and
    // Win/Loss are one Rankings screen with one month; moving between them is
    // not arriving.
    const rankingsTabs = ['power', 'wl'];
    if(rankingsTabs.includes(activeTab) && !rankingsTabs.includes(arrivingFrom)) arriveAtRankings();
    if(activeTab === 'summary' && arrivingFrom !== 'summary') arriveAtSummary();
    // Upcoming opens as a list to scan: every fixture folded, each one opened
    // on its own. Redraws after an action keep what the reader opened.
    if(activeTab === 'upcoming' && arrivingFrom !== 'upcoming') upcomingOpen = new Set();
    if(activeTab !== arrivingFrom){ fixtureManageOpen = null; fixtureManageMessage = ''; fixtureRemoveArmed = null; }
    document.querySelectorAll('#tabrow .tab-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');

    const isCallouts = activeTab === 'callouts';
    const isPlayers = activeTab === 'players';
    const isFindGame = activeTab === 'findgame';
    const isManage = activeTab === 'manage';
    const isGames = activeTab === 'games';
    const isH2H = activeTab === 'h2h';
    const isWishlist = activeTab === 'wishlist';
    const isUpcoming = activeTab === 'upcoming';
    const isSummary = activeTab === 'summary';
    const isListView = !isCallouts && !isPlayers && !isFindGame && !isManage && !isGames && !isH2H && !isWishlist && !isUpcoming && !isSummary;

    document.getElementById('tierbar').style.display = isListView ? 'flex' : 'none';
    document.getElementById('searchWrap').style.display = (isListView || isPlayers) ? 'block' : 'none';
    document.getElementById('minGamesRow').style.display = isListView ? 'flex' : 'none';
    document.getElementById('monthFilterRow').style.display = isListView ? 'flex' : 'none';
    document.getElementById('sortbar').style.display = (activeTab==='wl') ? 'flex' : 'none';
    document.getElementById('sortbarPower').style.display = (activeTab==='power') ? 'flex' : 'none';
    document.getElementById('list').style.display = isListView ? 'block' : 'none';
    document.getElementById('empty').style.display = 'none';
    document.getElementById('calloutsView').style.display = isCallouts ? 'block' : 'none';
    document.getElementById('playersView').style.display = isPlayers ? 'block' : 'none';
    document.getElementById('findGameView').style.display = isFindGame ? 'block' : 'none';
    document.getElementById('manageView').style.display = isManage ? 'block' : 'none';
    document.getElementById('gamesView').style.display = isGames ? 'block' : 'none';
    document.getElementById('h2hView').style.display = isH2H ? 'block' : 'none';
    document.getElementById('wishlistView').style.display = isWishlist ? 'block' : 'none';
    document.getElementById('upcomingView').style.display = isUpcoming ? 'block' : 'none';
    document.getElementById('summaryView').style.display = isSummary ? 'block' : 'none';

    const HEADER_SUB_BY_TAB = {
      wl: 'Parsed from the group chats, June–August 2026 · tap a player for their match log',
      power: 'A tier-anchored power rating · scoreline counts, not just who won · tap a player for details',
      callouts: 'Games worth setting up next, based on what the data can\'t yet confirm',
      findgame: 'Pick a player, a scope, and a difficulty — get a complete four-player match, ready to book',
      manage: 'Add results going forward and tag who\'s active — everything above recalculates instantly',
      games: 'Every game, newest first — pending ones need approval before they count',
      h2h: 'Pick two players and see their full history, as opponents and as teammates',
      wishlist: 'Propose a game — once all four players confirm, it moves to Upcoming',
      upcoming: 'Games everyone has confirmed they\'re in for',
      summary: 'A monthly awards recap, built from the same data as everywhere else — copy it straight into WhatsApp',
      players: 'Every player, A–Z · tap a name for their full profile',
    };
    document.getElementById('headerSub').textContent = HEADER_SUB_BY_TAB[activeTab] || HEADER_SUB_BY_TAB.players;

    const EXPLAINER_BY_TAB = {
      wl: 'Built from readable trophy-emoji results across the main group chat and Results Only, with names and tiers confirmed against the group. Excludes single-set/"money game" results, matches against non-members, and a couple of results with no opponent named or a disputed winner.',
      power: 'Ratings start from the tier each player is already known to sit in (S highest, C lowest) — the tiers are treated as real signal, not something the model has to rediscover from scratch. From there, results move you based on <b>games won within each match</b>, not just who won — a close 3-set loss barely costs anything, a 6-1 6-2 loss costs a lot. A player with few games stays close to their tier baseline since there isn\'t much evidence yet to move them; a player with a long track record can drift further from it. "Avg opp." is the average strength of everyone you\'ve played with and against. "Clutch %" compares your actual scorelines to what your tier and opponents would predict. "Upset wins/losses" count matches where the underdog won outright (or the favorite lost outright) by a meaningful ratings gap — a fast way to spot giant-killers and upset-prone favorites. Use the min-games filter below to hide anyone with too few games for these numbers to mean much. "Recent Form" sorts by wins over the last 10 games first, then by average overperformance as a tiebreaker — a faster-moving signal than the overall rating, useful for spotting who\'s trending right now.',
      callouts: 'Suggested matchups are full 2v2s — a wingman is added to each side, chosen to keep team strength balanced, so these are games you could actually go and organize. This spans every tier, not just the ones with the least data — S/A near-ties get surfaced the same way as small-sample C-tier players. Every player also has their own Easy / Balanced / Hard opponent suggestions on their profile page. The Data filter above changes which matches feed these ratings — defaults to June onwards only.',
      findgame: '"Within my tier" keeps every suggested player inside your own tier — easy always means the weakest pair actually in your tier, hard the strongest, never a reach into a different tier. "Any tier" opens it up and targets a rating roughly 150 points below/above your own. Every recommendation is a full four-player match: the ranked opponent pair, plus the partner who\'d make it an even match (a proven-chemistry partner is used automatically when one is just as close). Matchups are chosen from current Power Ratings; the predicted share of games behind them is shown to admins only. Alternatives are only labeled Fresh Matchup, Proven Chemistry or Tougher Test when the data actually supports that read — "See all recommendations" has the full ranked list underneath. This is computed live, not a fixed list, so try different scopes and difficulties freely. Players who\'ve gone inactive are excluded from every suggestion here, though their history stays visible elsewhere.',
      manage: 'This data is shared — anyone who opens this artifact sees the same games and tags. Ratings, tiers, and every suggestion above recompute from scratch the moment you add a game or change a tag.',
      games: 'Editing or deleting a game recalculates every rating instantly. Every change is recorded against whoever the app currently has you signed in as — the player shown in the header, which you can change from the Add a game panel.',
      h2h: 'Opponent record only counts matches where the two were on opposite teams; teammate record only counts matches where they played together.',
      wishlist: 'Anyone can propose a game. Each of the four named players confirms it themselves from their own player profile — once all four are in, it moves to the Upcoming tab automatically.',
      upcoming: 'A game arrives here either by all four players confirming a request, or by an admin agreeing it directly — from Requests, or straight off a prediction. Date, time and venue can stay TBC until they are known. Once it has been played, "Add result" carries the same players into the Games form so nobody types them twice, and submitting the result clears it from here: there is one record of the game, in Games, not two.',
      summary: 'Points: 3 for a win, 1 for a draw. "Hardest games" is average opponent strength that month, scaled down by 300 for a friendlier number. "Doughnuts" are sets lost 0-6 or similar. Player of the Month is chosen by the group from Admin\'s shortlist of the month\'s strongest cases.',
      players: '',
    };
    document.getElementById('explainer').innerHTML = EXPLAINER_BY_TAB[activeTab] || '';
    // The League view hides this wrapper (it duplicates that screen's own
    // explanation); every other tab gets it back.
    const explainerWrap = document.getElementById('explainerWrapper');
    if(explainerWrap) explainerWrap.style.display = '';

    renderActiveTab();
  };
});

// Re-render whichever tab is currently on screen. Power Rankings and Win/Loss
// share render(); everything else has its own render function.
//
// Arriving at Admin/Manage collapses every section. That is on ENTERING the
// screen, not on every render: renderManage() runs again on each toggle, each
// staged decision and each saved setting, and resetting there would slam a
// section shut the moment it was opened.
let lastRenderedTab = null;

// ===================== WAITING FOR THE RECORD =====================
// False until init() has the whole record. Nothing may draw a screen before
// then.
//
// This is the difference between a slow screen and a permanently empty one.
// Every renderer below reads PLAYERS, ALL_MATCHES and the v3 state; run before
// those exist, they produce an empty screen and nothing ever runs them again,
// because start-up's last act redraws only the rankings list. A reader who
// tapped Players, League, Call-Outs or Head-to-Head during the second or two
// the record takes to arrive got a screen that stayed blank until they
// navigated away and came back. Measured, reproduced, and the reason this flag
// exists: a screen is either drawn from the record or it says it is waiting
// for it, and start-up draws whichever screen is in front of the reader the
// moment the record lands.
let DATA_READY = false;

// Start-up has two halves, and they no longer finish in a predictable order.
//
// The record used to take fourteen round trips, so shell.js -- parsed straight
// after app.js, and building the navigation shell, the Home dashboard and the
// wrapped render() on DOMContentLoaded -- was always ready long first, and
// init() could simply draw at the end of itself. Reading everything at once
// removed that accident: against a fast database init() can now reach its last
// line before shell.js has been parsed at all, and the screen it wants to draw
// is built in there.
//
// So neither half draws the first screen. Whichever of them finishes second
// does, exactly once.
let SHELL_READY = false;
let firstScreenDrawn = false;

function drawFirstScreen(){
  if(firstScreenDrawn || !DATA_READY || !SHELL_READY) return;
  firstScreenDrawn = true;
  clearBootNotice();
  // render() draws #list, which serves Power Rating and Win/Loss and nothing
  // else -- and it also triggers the shell's one-time first-render set-up (the
  // podium, the viewer, the Home dashboard) that the rest of the app assumes
  // has happened. So it always runs.
  PerfTrace.time('render #list', render);
  // And then whatever screen is actually in front of the reader. Start-up used
  // to end at the line above, so anyone who tapped Players, League, Call-Outs
  // or Head-to-Head while the record was still arriving got that screen drawn
  // once, from nothing, and never drawn again: blank until they navigated away
  // and back. See renderActiveTab, which now declines to draw a screen at all
  // before there is anything to draw it from.
  // A League screen opened before the record arrived (a tap during the load,
  // or the standings site, which opens on it) picked its default month from
  // an empty club -- All time, where the Monthly Race has nothing to show.
  // Pick it again now there are games; a month the reader chose is kept.
  if(activeTab === 'summary') arriveAtSummary();
  if(activeTab !== 'power' && activeTab !== 'wl') renderActiveTab();
  renderHomeDashboard(); // no-ops until the dashboard exists
  PerfTrace.mark('screen drawn');
  if(PerfTrace.enabled) PerfTrace.report();
}

// Which element each tab owns. Only used while waiting -- the renderers
// themselves know their own containers.
const TAB_VIEW_ID = {
  power: 'list', wl: 'list', summary: 'summaryView', players: 'playersView',
  games: 'gamesView', h2h: 'h2hView', callouts: 'calloutsView',
  wishlist: 'wishlistView', upcoming: 'upcomingView', manage: 'manageView',
  findgame: 'findGameView',
};

function bootNoticeEl(){ return document.getElementById('bootNotice'); }

function showBootNotice(){
  if(bootNoticeEl() || !document.body) return;
  const el = document.createElement('div');
  el.id = 'bootNotice';
  el.className = 'boot-notice';
  el.textContent = 'Loading the club record…';
  document.body.appendChild(el);
  showBootPlaceholder();
}

function clearBootNotice(){
  const el = bootNoticeEl();
  if(el) el.remove();
  // Any screen the reader landed on while waiting is about to be drawn
  // properly; a screen they merely passed through would otherwise keep the
  // placeholder until something redrew it.
  document.querySelectorAll('.boot-placeholder').forEach(x => x.remove());
}

// A deliberately non-blocking wait. The reader may still choose a screen
// while the record is arriving -- that choice is honoured, and that screen is
// the one drawn when it lands.
function showBootPlaceholder(){
  const id = TAB_VIEW_ID[activeTab];
  const box = id && document.getElementById(id);
  // Only where the screen would otherwise be empty. Find a Game and Manage
  // carry markup written into index.html, and replacing it would destroy the
  // form the reader is looking at.
  if(!box || box.firstElementChild) return;
  const ph = document.createElement('div');
  ph.className = 'boot-placeholder';
  ph.textContent = 'Loading…';
  box.appendChild(ph);
}

function renderActiveTab(){
  // Before the record exists there is nothing to draw and no honest way to
  // draw it. Start-up calls this again the moment there is.
  if(!DATA_READY){ showBootPlaceholder(); return; }
  if(activeTab === 'manage' && lastRenderedTab !== 'manage') resetAdminSections();
  lastRenderedTab = activeTab;
  PerfTrace.time('draw ' + activeTab, ()=>{
    if(activeTab === 'callouts') renderCallouts();
    else if(activeTab === 'players') renderPlayersTab();
    else if(activeTab === 'findgame') renderFindGame();
    else if(activeTab === 'manage') renderManage();
    else if(activeTab === 'games') renderGamesTab();
    else if(activeTab === 'h2h') renderH2H();
    else if(activeTab === 'wishlist') renderWishlist();
    else if(activeTab === 'upcoming') renderUpcoming();
    else if(activeTab === 'summary') renderSummary();
    else render();
  });
}

// ===================== ONE MUTATION, ONE REFRESH =====================
// Everything that changes the record ends here.
//
// It used to end wherever the author of that particular button happened to
// stop: approving a game redrew the Games tab, a tier override redrew the
// admin list, submitting a result redrew nothing at all. Derived state was
// rebuilt correctly every time -- `recomputeAll()` was never the problem --
// but the screen in front of the reader was only redrawn if the mutation
// happened to live on it. Removing one rated match from the record moved four
// players' ratings and changed nothing visible on the League Table, the Merit
// Table, the Players Directory, Call-Outs, Head-to-Head or the Wishlist. They
// stayed wrong until the reader navigated away and back, which is exactly the
// kind of wrongness nobody reports as a bug because it looks like a number
// they misread.
//
// So the rule is now one line long: if the record changed, the screen in front
// of the reader is redrawn from it.
//
// `redraw` names the exception rather than allowing one. Two controls are
// operated in a rapid sequence -- the tier and starting-tier dropdowns in the
// admin player list -- and redrawing the whole of Admin under the reader's
// finger would take the focus off the select they are still using. They pass
// the narrower redraw they want. Nothing may pass "none": a mutation that
// redraws nothing is the defect this function exists to make impossible.
function dataChanged(opts){
  recomputeAll();
  // Built from the journey, which a correction, an approval or an adjustment
  // all rewrite. Keyed by date, so a stale one survives until the same date is
  // reviewed again -- it was cleared by the review commit alone, and by
  // nothing else that changes what it was built from.
  reviewSnapshotCache = null;
  ((opts && opts.redraw) || renderActiveTab)();
  renderHomeDashboard(); // no-ops until the Home dashboard exists
}

document.querySelectorAll('#sortbar .sortbtn').forEach(b=>{
  b.onclick = ()=>{ activeSort = b.dataset.sort; document.querySelectorAll('#sortbar .sortbtn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); render(); };
});
document.querySelectorAll('#sortbarPower .sortbtn').forEach(b=>{
  b.onclick = ()=>{ activeSortP = b.dataset.sortp; document.querySelectorAll('#sortbarPower .sortbtn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); render(); };
});

document.getElementById('search').addEventListener('input', e=>{
  query = e.target.value.trim().toLowerCase();
  if(activeTab === 'players') renderPlayersTab(); else render();
});

const minGamesInput = document.getElementById('minGamesInput');
// Scoped to #minGamesRow. `.preset-btn` is a shared button style used by the
// state filters and half the Admin screen too, so an unscoped selector here
// would clear their selected state and, worse, feed parseInt(undefined) into
// minGames the moment somebody pressed one.
const MIN_GAMES_BTNS = '#minGamesRow .preset-btn';
function setMinGames(n){
  minGames = n;
  minGamesInput.value = n;
  document.querySelectorAll(MIN_GAMES_BTNS).forEach(b=> b.classList.toggle('active', parseInt(b.dataset.n)===n));
}
minGamesInput.addEventListener('input', e=>{
  minGames = Math.max(0, parseInt(e.target.value) || 0);
  document.querySelectorAll(MIN_GAMES_BTNS).forEach(b=> b.classList.toggle('active', parseInt(b.dataset.n)===minGames));
  render();
});
document.querySelectorAll(MIN_GAMES_BTNS).forEach(b=>{
  b.onclick = ()=>{
    minGames = parseInt(b.dataset.n);
    minGamesInput.value = minGames;
    document.querySelectorAll(MIN_GAMES_BTNS).forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    render();
  };
});

// Two independent toggles, not a mutually exclusive pair.
document.querySelectorAll('#stateFilterRow .state-toggle').forEach(b=>{
  b.onclick = ()=>{
    if(b.dataset.toggle === 'idle') includeIdle = !includeIdle;
    else includeInactive = !includeInactive;
    b.classList.toggle('active', b.dataset.toggle === 'idle' ? includeIdle : includeInactive);
    render();
  };
});

const monthSelect = document.getElementById('monthSelect');
monthSelect.addEventListener('change', e=>{
  // A choice, recorded as one. From here on this reader's Rankings month is
  // theirs for the session, and no default re-evaluation touches it.
  rankingsMonthChoice = e.target.value;
  applyRankingsMonth(e.target.value);
  rerenderCurrentTab();
});

// The single entry point for changing the app-wide Data Range. Everything
// downstream is rebuilt from the newly-filtered match list, so no screen can
// be left showing figures from the other dataset.
function applyDataRangeChange(value){
  const previous = dataRange;
  setDataRange(value);
  if(dataRange === previous) return false;
  recomputeAll();
  // Narrowing the range can strand the selected month (see
  // reconcileSelectedMonth) -- fix it before anything re-reads it.
  reconcileSelectedMonth();
  populateMonthSelect(document.getElementById('monthSelect'), selectedMonth);
  syncFullHistoryIndicator();
  renderActiveTab();
  renderHomeDashboard(); // no-ops if Home isn't built yet
  return true;
}


function ratingOf(n){ const x = PLAYERS.find(pl=>pl.name===n); return x ? Math.round(x.rating) : null; }

const RISK_LABELS = {
  promotion_watch: {text: "Promotion watch", cls: "risk-promotion"},
  demotion_watch: {text: "Demotion watch", cls: "risk-demotion"},
  unproven: {text: "Unproven — small sample", cls: "risk-unproven"},
  stable: {text: "Stable", cls: "risk-stable"},
};

// A player's latest rated games -- draws included -- as PlayerForm reads them
// (domain/matches/playerForm.js). It used to read MATCHES, which leaves draws
// out, so a draw was skipped and an older game slid into the ten in its
// place: Jams's form said 3–7 while his Recent Results showed three draws.
function computeRecentForm(name, windowSize){
  const r = PlayerForm.recent(matchesIncludingDraws(), name, windowSize || PlayerForm.WINDOW);
  if(!r) return null;
  const daysSinceLastGame = Math.floor((new Date() - new Date(r.lastGameDate)) / 86400000);
  return { avgPct: r.avgPct, games: r.played, wins: r.wins, draws: r.draws, losses: r.losses,
    run: r.run, lastGameDate: r.lastGameDate, daysSinceLastGame };
}

// A player's whole record and win rate (wins / games played, draws included).
function playerRecordOf(name){ return PlayerForm.record(matchesIncludingDraws(), name); }

// A player who hasn't played in a while shouldn't read as "trending" just because their last
// batch of games happened to go well -- this is the cutoff for treating Recent Form as stale.
const RECENT_FORM_STALE_DAYS = 14;
function fmtDaysAgo(days){
  if(days === 0) return 'today';
  if(days === 1) return '1 day ago';
  if(days < 14) return days + ' days ago';
  const weeks = Math.round(days/7);
  if(weeks < 8) return weeks + (weeks===1?' week ago':' weeks ago');
  const months = Math.round(days/30);
  return months + (months===1?' month ago':' months ago');
}


// A player's name is free text, and it is both rendered as text and carried in
// a data attribute, so quotes and angle brackets have to be neutralised for
// both. A name containing `<b>` is a name, not markup: without this it renders
// as "ac" and loses two characters of somebody's identity. The name is read
// back from the element rather than spliced into an inline handler, which is
// what the old rows did -- `onclick="openSheet('...')"` with an apostrophe in
// a name is one bad surname away from a syntax error.
function escapeHtml(value){
  return String(value)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// Players (directory, Head to Head), Insights and Play › Find a Game /
// Challenges now live in features/players/, features/rankings/calloutsScreen.js
// and features/play/ (findGameData.js = the engine, findGameScreen.js = the
// screens). h2hCount stays: several screens count meetings with it.
function h2hCount(a,b){ return H2H[[a,b].sort().join('|')] || 0; }


// The per-game rating weight shown to users. Derived from the real engine's K (28) times the
// A result within this band of the prediction counts as "played to expectation" -- no rating
// movement is implied either way. This is a DISPLAY band on the engine's own performance
// residual: it decides wording, never a number.
const NEUTRAL_PERFORMANCE_BAND = 0.05; // 5 points of performance score

// The player's real Rating Journey, read straight back from the persisted
// ratingJourney events. Nothing here is reconstructed: every rating, delta,
// expectation and K-factor below was written by the engine at the moment it
// happened. That is why the old "story estimate" disclaimer is gone -- there
// is no second calculation left that could disagree with the Power Rating.
//
// This costs no extra Firestore read: V3_JOURNEY is already in memory for the
// monthly views. It never falls back to a reconstruction; if the journey did
// not load, the UI says so.
function playerJourney(name){
  if(typeof JourneyView === 'undefined') return { error: 'journeyView.js did not load.' };
  if(!V3_STATE.loaded) return { error: String(V3_STATE.error || 'v3 state is not loaded.') };
  if(!V3_JOURNEY.length) return { error: 'The Rating Journey did not load.' };
  const journey = JourneyView.forPlayer(V3_JOURNEY, name);
  if(!journey) return { empty: true };
  return { journey };
}

// Real per-match rating movement for one player, keyed by match id. Used by the
// profile match cards so the figure on a card is the figure the engine applied
// for that player in that match -- not a team-wide approximation.
function journeyDeltasByMatchId(journey){
  const out = {};
  if(!journey) return out;
  journey.entries.forEach(e=>{ if(e.kind === 'match' && e.matchId) out[e.matchId] = e.delta; });
  return out;
}

// One month of a player's real trajectory, sliced out of the persisted journey.
// There is no monthly seed, no monthly re-solve and no separate monthly engine
// -- a month is a window onto one continuous rating, and this cannot express
// anything else. Returns null when the player has no events that month.
function computeMonthlyJourney(name, month){
  if(month === 'all') return null;
  const result = playerJourney(name);
  if(!result.journey) return null;
  return JourneyView.monthSlice(result.journey, month);
}

// ---- Rating journey rendering (all of it reads persisted events) ----


function computeMonthlyTierStandings(month, tier){
  if(month === 'all') return [];
  const monthlyRatings = monthEndRatings(month);
  const monthly = computeMonthlyStats(month);
  return PLAYERS.filter(p => p.tier === tier)
    .map(p => ({...p, ...(monthly[p.name] || ZERO_MONTH_STATS),
      month_rating: (p.name in monthlyRatings) ? Math.round(monthlyRatings[p.name]*10)/10 : null}))
    .filter(p => p.total >= minGames && p.month_rating !== null && p.month_rating !== undefined)
    .sort((a,b)=> b.month_rating - a.month_rating);
}

// Everything one player+month's breakdown needs, bundled once so the main
// view, "View full calculation", and the Compare view all draw from the
// same numbers rather than risk disagreeing.
function getMonthlyRatingContext(name, month){
  if(month === 'all') return null;
  const p = PLAYERS.find(x=>x.name===name);
  if(!p) return null;
  const tier = TIER_MAP[name] || p.tier;
  const standings = computeMonthlyTierStandings(month, tier);
  const idx = standings.findIndex(s=>s.name===name);
  if(idx === -1) return null; // no qualifying month-end figure for this player
  // No seed here on purpose. A month does not start anyone at a tier baseline;
  // it starts them wherever their continuous rating had reached.
  return {
    name, tier, month,
    player: standings[idx],
    rating: standings[idx].month_rating,
    position: idx+1,
    standings,
    above: idx>0 ? standings[idx-1] : null,
    below: idx<standings.length-1 ? standings[idx+1] : null,
    journey: computeMonthlyJourney(name, month),
  };
}


// ---- Score orientation ----------------------------------------------------
// Set scores are STORED from the winners' perspective: sets[i][0] is always the
// winning side's games in that set. Printed unchanged on a card that is about
// ONE player, a defeat reads "6-3, 6-4" beside the word LOSS, which looks like
// a win and is the single most confusing thing in the app. Any card written
// from a player's point of view orients the score to that player; a neutral
// card leaves it in winner order and names the winners beside it, so the two
// readings can never be confused.
function setsForViewer(match, viewerWon){
  const sets = match.sets || [];
  return viewerWon ? sets.map(s=>[...s]) : sets.map(([a,b])=>[b,a]);
}

function scoreForViewer(match, viewerWon){
  return setsForViewer(match, viewerWon).map(s=>s.join('-')).join(', ');
}

// True when `name` is on the side the score is stored for. A draw has no
// winner, but it still has a stored side order, and the player's own team is
// still the one their card should read from.
function playerIsOnStoredWinningSide(match, name){
  return (match.winners || []).includes(name);
}


// The Player Profile's own month. A profile is the player as they are: current
// rating, career record, every result. Narrowing it to one month is something
// the reader asks for, from the profile itself -- it is never inherited.
//
// It lasts for as long as the sheet stays open on the same player, because the
// sheet re-renders itself in place (confirming a delete, clearing a filter) and
// those refreshes must keep the reader's choice. Any other open -- from the
// Directory, from Rankings, from Home, from anywhere -- starts again at
// All time.
let profileMonth = 'all';
let profileMonthFor = null;


function navigateToGamesTabForEdit(matchId){
  editingMatchId = matchId;
  armedDeleteId = null;
  const gamesTabBtn = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
  if(gamesTabBtn) gamesTabBtn.click();
  // Arriving from elsewhere: the game being edited is the place to land, with
  // its form open in its own card.
  const card = gameCardEl(matchId);
  if(card) card.scrollIntoView({ block: 'start' });
}

let linkedRequestId = null;

function navigateToGamesTabForResult(req){
  linkedRequestId = req.id;
  addGameExpanded = true;
  editingMatchId = null;
  armedDeleteId = null;
  const gamesTabBtn = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
  if(gamesTabBtn) gamesTabBtn.click();

  const a1 = document.getElementById('agA1');
  if(a1){
    // The sides the game was agreed as, not the order four names happened to
    // be typed in. A singles fixture put through the old flat split would have
    // arrived as a single partnership with nobody to play.
    const [sideA, sideB] = requestTeams(req);
    a1.value = sideA[0] || '';
    document.getElementById('agA2').value = sideA[1] || '';
    document.getElementById('agB1').value = sideB[0] || '';
    document.getElementById('agB2').value = sideB[1] || '';
    const singlesBtn = document.querySelector('#agTypeToggle .fg-toggle-btn[data-type="singles"]');
    if(singlesBtn && sideA.length === 1 && sideB.length === 1) singlesBtn.click();
    if(req.preferredDate){
      const dateEl = document.getElementById('agDate');
      if(dateEl) dateEl.value = req.preferredDate;
    }
    checkForNewPlayers();
    const anchor = document.getElementById('addGameBody');
    if(anchor){ try { anchor.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e){ /* non-critical */ } }
  }
}
document.getElementById('overlay').addEventListener('click', e=>{ if(e.target.id==='overlay') closeSheet(); });


// ===================== WHO IS IN THE LIVE APP =====================
// PLAYERS is everyone the record knows, archived players included, because
// every calculation and every piece of history needs them. Anything that
// offers players as CURRENT people -- "Who are you?", the directory, a name
// field, a selector, an autocomplete, a suggestion pool -- asks here instead,
// so an archived player can never be offered by a screen that forgot to
// filter. History (results, scorecards, past tables, the Rating Journey)
// resolves names from the record and is untouched by this.
function livePlayers(){
  return PLAYERS.filter(p => PlayerStatus.isLive(p.status));
}
function livePlayerNames(){
  return livePlayers().map(p=>p.name).sort((a,b)=>a.localeCompare(b));
}
// The name older call sites use. Live players only, like livePlayerNames().
function allPlayerNames(){ return livePlayerNames(); }
// One player's status, by any name they are shown under; null if unknown.
function playerStatusOf(name){
  const p = PLAYERS.find(x => x.name === name);
  return p ? p.status : null;
}
function isArchivedPlayer(name){ return playerStatusOf(name) === PlayerStatus.STATUS.ARCHIVED; }
// The archived names among some typed names (any case), and what to say about
// them: a new game, request or result cannot include someone who has left the
// group. An admin restores them first; their history never needed it.
function archivedAmong(names){
  return (names || []).map(n => PLAYERS.find(p => p.name.toLowerCase() === String(n || '').trim().toLowerCase()))
    .filter(p => p && p.status === PlayerStatus.STATUS.ARCHIVED).map(p => p.name);
}
function archivedRefusal(names){
  return `${names.join(', ')} ${names.length > 1 ? 'are' : 'is'} archived. Restore them in Admin › Player tags to include them in a new game.`;
}

// Admin / Manage: features/admin/manageScreen.js (the accordion, settings,
// exports, player tags), clubDecisionsScreen.js (historical adjustment, the
// monthly review, the audit trail) and diagnosticsScreen.js. Submitting a
// result is features/games/gamesSubmit.js.


// ===================== INIT =====================

// Games: the screen is features/games/gamesScreen.js; approvals, edits and the
// historical match correction are features/games/gamesAdmin.js. The Games
// screen state below stays here with the other per-screen state.
let editingMatchId = null;
let armedDeleteId = null;
let expandedGameId = null;
let addGameExpanded = false;


function fmtRelative(iso){
  if(!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.round((now-d)/3600000);
  if(diffH < 1) return 'just now';
  if(diffH < 24) return diffH + 'h ago';
  const diffD = Math.round(diffH/24);
  return diffD + 'd ago';
}

// ===================== WHO IS DOING THIS =====================
// The app already knows who you are. It should not keep asking.
//
// There were two identities. `currentUserName` is a free-text label typed into
// a "Your name" box and kept on the device; the VIEWER is the player chosen in
// the header, validated against the club's actual roster, and already used for
// Home, Your Game and challenges. The Games tab carried a full-width card for
// the first one on every visit -- a read-only field, above the filters, above
// the match log, restating something the header had already established.
//
// The viewer wins where it exists, which is what the challenge code had
// already concluded for itself (`viewerNow ? viewerNow.name : currentUserName`).
// This is not a presentation change dressed up: a real player picked from the
// roster is BETTER attribution than free text, and everything written to the
// record -- `submittedBy`, the review actor, `seenBy` -- goes on being written
// exactly as before, from whichever identity is the more reliable one.
//
// The typed name survives as the fallback for a device that has never chosen a
// player, so nothing that worked before stops working.
function submissionIdentity(){
  const viewer = (typeof getCurrentViewer === 'function') ? getCurrentViewer() : null;
  if(viewer && viewer.name) return viewer.name;
  return (currentUserName && currentUserName.trim()) || '';
}

// Shown inside a flow that is about to record who did something, and nowhere
// else. `change` opens the same player chooser the header uses -- one way to
// say who you are, not two.
function identityLineHtml(verb){
  const who = submissionIdentity();
  if(!who){
    return `<div class="identity-line">Nobody chosen yet —
      <button type="button" class="identity-change" data-identity-pick>choose who you are</button></div>`;
  }
  return `<div class="identity-line">${escapeHtml(verb)} as <b>${escapeHtml(who)}</b>
    <button type="button" class="identity-change" data-identity-pick>change</button></div>`;
}

function wireIdentityLines(box){
  (box || document).querySelectorAll('[data-identity-pick]').forEach(btn=>{
    btn.onclick = ()=>{ if(typeof buildViewerSelector === 'function') buildViewerSelector(); };
  });
}

function requireName(){
  let name = submissionIdentity();
  if(!name){
    // Nothing chosen and nothing typed, anywhere in the app. Ask directly
    // rather than refusing -- this is the last resort, not the normal path.
    let typed = '';
    try { typed = (window.prompt('Enter your name so the group knows who made this change:') || '').trim(); } catch(e){ /* prompt unavailable */ }
    if(!typed) return null;
    name = typed;
  }
  currentUserName = name;
  saveMyName(name);
  return name;
}

// ===================== HEAD TO HEAD =====================
// Compare's own month. All time by default: a head-to-head is a history, the
// same reasoning Shaun applied to Games. It used to read AND write the Rankings
// month, so choosing a month here silently changed Power Rankings.
let h2hMonth = 'all';


// Play › Requests / Upcoming: the screens are features/play/fixturesScreen.js,
// the list split and commit path features/play/fixturesData.js, the admin
// prediction card features/play/predictionCard.js.


let summaryMonth = null;

// The Monthly Race is the default view (Shaun, 31 Oct): Race, then Merit, then
// League, in order of importance. 'race' | 'merit' | 'league' | 'information'.
let summaryMode = 'race';


// Rankings › League / Merit / Race / Information: the screen is
// features/rankings/leagueScreen.js, its inputs and standings order
// features/rankings/monthlyTablesData.js.


// ===================== RECORD HEALTH =====================
// Every rating in the record is derived by replaying the stored matches in
// order. If a replay is ever left half-written, the matches stay intact but the
// derived documents do not, and the app then refuses every edit -- correctly,
// and silently. It says nothing to anyone who is not trying to edit at that
// moment, and nothing is kept.
//
// This notices, and writes it down once. It does not repair: repairing is a
// decision, and it is not one to offer from a phone beside the thing it would
// rewrite.
//
// Costs no read. The record is already in memory, and the check is arithmetic.
// It replays the whole history though -- tens of milliseconds here, a few
// hundred on a phone -- so it runs once a session, after the first render.
async function runRecordHealthCheck(){
  if(healthCheckDone) return null;
  healthCheckDone = true;
  if(typeof ReplayForward === 'undefined' || typeof HealthReport === 'undefined') return null;
  if(!V3_RECORD || !V3_RECORD.matches.length || !V3_RECORD.journey.length) return null;

  let check;
  try { check = ReplayForward.verifyNoOp(V3_RECORD, {}); }
  catch(e){
    // A check that cannot run is not a clean bill of health, but it is also not
    // a divergence, and inventing one would be worse than saying nothing.
    console.error('record health check could not run:', e && e.message);
    return null;
  }
  if(check.identical) return null;

  let repair = null;
  try { repair = ReplayForward.planRepair(V3_RECORD, {}); } catch(e){ /* the counts are optional */ }

  healthReport = HealthReport.buildReport({
    check, repair, record: V3_RECORD,
    seenBy: (currentUserName && currentUserName.trim()) || getCurrentViewer()?.name || null,
  });
  await storeHealthReport(healthReport);
  return healthReport;
}

// One document per distinct divergence. Seeing the same one again updates it
// rather than filing another, so four people opening the app on four phones
// leave one report saying it was seen four times.
async function storeHealthReport(report){
  if(!report || !db) return;
  try {
    const ref = db.collection(HealthReport.COLLECTION).doc(report.id);
    const snap = await ref.get();
    const merged = snap && snap.exists ? HealthReport.merge(snap.data(), report) : report;
    healthReport = merged;
    await ref.set(merged);
  } catch(e){
    // Failing to record it must never break the app for the person who found
    // it. They are told either way; the write is the part that can fail.
    console.error('could not store the health report:', e && e.message);
  }
}

// What a refusal says, and to whom. The board holds an admin password too, so
// "admin" has never meant the owner -- see adminRole.
function recordHealthMessage(){
  if(!healthReport) return '';
  return HealthReport.messageFor(healthReport, { owner: isOwnerAdmin() });
}

async function readStoredRecord(backend){
  const [matches, journey, players] = await Promise.all([
    backend.getAll(RatingStore.COLLECTIONS.matches),
    backend.getAll(RatingStore.COLLECTIONS.journey),
    backend.getAll(RatingStore.COLLECTIONS.players),
  ]);
  return { matches, journey, players };
}


async function init(){
  PerfTrace.mark('boot starts');
  showBootNotice();
  // Everything start-up needs, asked for at once.
  //
  // These fourteen reads -- three collections and eleven single documents --
  // have no dependency on one another at all, and start-up used to await them
  // one after another. Measured against the live record, that was 14 round
  // trips in series: 1.9s on a fast connection, 3.8s at a phone's 250ms, of
  // which 16ms was computation. Fired together they cost one round trip.
  //
  // v3 state still has to be in place before the first recomputeAll, because
  // the application has no rating without it and will not invent one -- and it
  // is, because nothing below runs until every one of these has landed.
  const [ , stored, myName, ownerHash, boardHash, unlocked,
          visibility, requests, areas, challenges, northSouth, potmRecords, championRecords, admin ] =
    await PerfTrace.timeAsync('load the record', Promise.all([
      loadV3State(),
      loadStoredData(),
      loadMyName(),
      loadPasswordHash(STORAGE_KEY_ADMIN_PW_OWNER),
      loadPasswordHash(STORAGE_KEY_ADMIN_PW_BOARD),
      loadMyUnlocked(),
      loadVisibility(),
      loadGameRequests(),
      loadDevAreas(),
      loadChallenges(),
      loadNorthSouthResults(),
      loadPotmRecords(),
      loadChampionRecords(),
      loadSignedInAdmin(),
    ]));
  extraMatchesState = stored.extraMatches;
  tagOverridesState = stored.tagOverrides;
  matchAttributionState = stored.matchAttribution || {};
  matchEditsState = stored.matchEdits;
  deletedIdsState = stored.deletedIds;
  currentUserName = myName;
  ownerPasswordHash = ownerHash;
  boardPasswordHash = boardHash;
  // An Admin is someone signed in to an Admin account (data/adminAuth.js), or,
  // while the community still allows it, someone who unlocked with the old
  // shared password on this device.
  signedInAdmin = admin;
  const byPassword = unlocked && legacyAdminPasswordOn();
  if(admin) adminRole = admin.role;
  else if(!byPassword) adminRole = null;
  isUnlocked = !!(admin || byPassword) && !isStandingsMode();   // the standings site has no Admin (siteMode.js)
  visibilityState = visibility;
  gameRequestsState = requests;
  devAreasState = areas;
  challengesState = challenges;
  northSouthResultsState = northSouth;
  potmRecordsState = potmRecords;
  championRecordsState = championRecords;
  PerfTrace.mark('record ready');
  // Power Rankings opens on the most recently completed month rather than
  // All Time. getAvailableMonths() only needs the raw match state loaded
  // above (not recomputeAll()'s derived PLAYERS/ratings), so this runs
  // first -- recomputeAll() populates #monthSelect from selectedMonth, and
  // it needs to see the real default, not 'all', to render correctly.
  // The monthly min-games default (5, vs 10 for All Time) is applied here
  // too, matching exactly what the month-select's own change handler
  // already does for a manual switch.
  // Start-up is an arrival like any other: Rankings gets its Meaningful Month.
  arriveAtRankings();
  recomputeAll();
  applyTabVisibility();

  // From here on there is a record to draw, and every screen may draw itself.
  DATA_READY = true;
  drawFirstScreen();

  // After the screen exists, never before it. Whoever opens the app finds the
  // problem, so a half-written record is noticed the same day rather than
  // whenever somebody next happens to try an edit.
  const runHealthCheck = ()=>{ runRecordHealthCheck().catch(()=>{}); };
  if(typeof requestIdleCallback === 'function') requestIdleCallback(runHealthCheck, { timeout: 4000 });
  else setTimeout(runHealthCheck, 1200);

  // "New build available · Refresh" (features/updateNotice.js).
  startUpdateChecks();
}

init();

// Re-render the Requests tab live on a viewer switch, so "Your turn" /
// "Choose Partner" moves to whichever challenge card it now applies to
// without needing a manual tab reload. Also keeps Find Game's Player field
// aligned with the same global identity (see syncFindGamePlayerToViewer).
document.addEventListener('viewerchanged', ()=>{
  if(activeTab === 'wishlist') renderWishlist();
  syncFindGamePlayerToViewer();
});
