// ===================== PLAYER OF THE MONTH: DATA =====================
// What the recommendation is given, and where awards are kept. The rules
// (eligibility, stories, the award record) are domain/awards/playerOfMonth.js;
// this file only gathers each player's month from the club's canonical
// sources and reads and writes the stored records.
//
// Every figure is one the app already shows, for the target month alone:
//
//   games, W / D / L, win rate   the League's own month (computeMonthlySummaryStats)
//   performance vs expectation   MonthlyViews row (the engine's monthly performance)
//   rating start / end / change  MonthlyViews row; club decisions taken out, so
//                                a reassessment is never presented as form
//   tier                         MonthlyViews tier at the month's close (history)
//   beat expectation in X of Y   the stored residual of each of the month's matches
//   wins as the underdog         a win whose stored expected score was below the
//                                Match Result Card's underdog line (MatchScorecard.STORY)
//   competition wins             the top of each tier of the month's League
//                                (leagueSplitRows + sortLeagueRows), Merit
//                                (MeritTable.build) and Monthly Race
//                                (buildMonthlyRace, qualified rows) -- the very
//                                tables League › League / Merit / Race draw
//
// Nothing is recalculated: expectations, residuals and ratings are what the
// engine recorded at the time.
//
// Storage: the `playerOfTheMonth` collection, one document per month (id
// YYYY-MM), fields as PlayerOfMonth describes -- plain fields, so awards can be
// queried by winner later. Read once at start-up with the rest of the record.
//
// Owning stream: functional. Loads before app.js; declarations only.

const POTM_COLLECTION = 'playerOfTheMonth';
let potmRecordsState = {};   // month -> stored record

async function loadPotmRecords(){
  if(!db) return {};
  try {
    const snap = await db.collection(POTM_COLLECTION).get();
    const out = {};
    (snap.docs || []).forEach(d => {
      let v = d.data();
      // Tolerates the { value: JSON } shape the club's other documents use.
      if(v && typeof v.value === 'string') { try { v = JSON.parse(v.value); } catch(e){ v = null; } }
      if(v && v.month) out[v.month] = v;
    });
    return out;
  } catch(e){ console.error('load Player of the Month failed', e); return {}; }
}

async function savePotmRecord(record){
  // A plain-data copy: Firestore refuses `undefined` anywhere in a document.
  const doc = JSON.parse(JSON.stringify(record));
  await db.collection(POTM_COLLECTION).doc(record.month).set(doc);
  potmRecordsState = { ...potmRecordsState, [record.month]: doc };
  return doc;
}

function potmRecordFor(month){ return potmRecordsState[month] || null; }

// The month as a key in the reader's own time, as every monthly screen uses.
function potmCurrentMonth(){ return MeaningfulMonth.monthKey(new Date()); }
// A month is over once the calendar has moved past it. Only then can a
// shortlist be finalised or a winner confirmed.
function potmMonthComplete(month){ return month < potmCurrentMonth(); }

// Months the record can judge, newest first: rated months with games.
function potmMonths(){
  if(!MONTHLY_VIEWS) return [];
  return MONTHLY_VIEWS.months.filter(m => (MONTHLY_VIEWS.byMonth[m].rows || []).length).slice().reverse();
}

const potmRound1 = (v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : null);

// Who won each tier of the month's three competitions: { league|merit|race:
// { tier: [names] } }. Each table is built and ordered by its own module, as
// League › By tier shows it; this only reads its top. The tables break a tie
// last of all by name, which is no way to decide a winner, so players level on
// every other key the table orders by are joint winners.
function potmCompetitionWinners(month){
  const out = { league: {}, merit: {}, race: {} };
  const tiers = groupedTiers();
  const top = (rows, keys) => rows.length ? rows.filter(r => keys.every(k => r[k] === rows[0][k])) : [];
  const league = leagueSplitRows(month).filter(s => s.games > 0);
  const { table: merit } = MeritTable.build(meritMatches(month), historicalTierOf, { tierForRow: historicalTierOf });
  const { table: race } = buildMonthlyRace(month);
  tiers.forEach(tier => {
    out.league[tier] = top(sortLeagueRows(league.filter(s => s.tier === tier), 'points', true), ['points', 'gd']).map(r => r.name);
    out.merit[tier] = top(merit.filter(r => r.tier === tier && r.played > 0), ['merit', 'hardWins', 'wins', 'played']).map(r => r.playerId);
    // The Race is decided among those who qualified in the tier.
    out.race[tier] = top(race.filter(r => r.tier === tier && r.qualified), ['score', 'wins', 'played']).map(r => r.playerId);
  });
  return out;
}

// One player's wins from those: [{ competition, tier, sharedWith }].
function potmCompetitionWinsOf(winners, name){
  const out = [];
  ['league', 'merit', 'race'].forEach(competition => {
    Object.entries(winners[competition]).forEach(([tier, names]) => {
      if(names.includes(name)) out.push({ competition, tier, sharedWith: names.filter(n => n !== name) });
    });
  });
  return out;
}

// Each player who played in the month, with the month's figures.
function potmPlayerMonths(month){
  const view = MONTHLY_VIEWS && MONTHLY_VIEWS.byMonth[month];
  if(!view) return [];
  const league = computeMonthlySummaryStats(month);
  const approved = {};
  getAllApprovedMatches().forEach(m => { if(Period.of(m.date) === month) approved[m.id] = m; });
  const facts = Object.values(V3_MATCH_FACTS || {}).filter(f => f.date && Period.of(f.date) === month);
  const STORY = MatchScorecard.STORY;
  const names = [...new Set(Object.keys(league).concat(view.rows.map(r => r.playerId)))];
  const winners = potmCompetitionWinners(month);
  return names.map(name => {
    const L = league[name] || { games: 0, wins: 0, draws: 0, losses: 0, winpct: 0 };
    const row = view.rows.find(r => r.playerId === name) || null;
    let rated = 0, beat = 0, underdog = 0, major = 0, biggest = null;
    facts.forEach(f => {
      const side = MatchFacts.forPlayer(f, name);
      if(!side) return;
      rated++;
      if(side.mine.residual > 0) beat++;
      const m = approved[f.matchId];
      if(!m || MatchOutcome.letterFor(m, name) !== 'W' || typeof side.mine.expected !== 'number') return;
      const expectedPct = side.mine.expected * 100;
      if(expectedPct >= STORY.UNDERDOG_BELOW) return;
      underdog++;
      if(expectedPct < STORY.MAJOR_UPSET_BELOW) major++;
      if(!biggest || expectedPct < biggest.expectedPct) biggest = { matchId: f.matchId, date: f.date, expectedPct: potmRound1(expectedPct) };
    });
    return {
      playerId: playerIdFor(name),
      name,
      archived: isArchivedPlayer(name),
      metrics: {
        games: L.games, wins: L.wins, draws: L.draws, losses: L.losses, winPct: L.winpct,
        performancePct: row ? row.performancePct : null,
        ratedMatches: rated, beatExpected: beat,
        ratingStart: row ? potmRound1(row.startRating) : null,
        ratingEnd: row ? potmRound1(row.endRating) : null,
        ratingChangePlay: row ? potmRound1(row.ratingChange - row.reassessmentChange) : null,
        ratingChangeClub: row ? row.reassessmentChange : 0,
        underdogWins: underdog, majorUpsetWins: major, biggestUpset: biggest,
        tier: row ? row.tierAtMonthEnd : null,
        competitionWins: potmCompetitionWinsOf(winners, name),
      },
    };
  });
}

function potmRecommendation(month){
  return PlayerOfMonth.recommend({ month, players: potmPlayerMonths(month) });
}

// Shown under today's name (a rename shows through); the name kept with the
// award when the id is not known any more.
function potmNameOf(playerId){
  const name = displayNameFor(playerId);
  return PLAYERS.some(p => p.name === name) ? name : null;
}

// Every confirmed award, newest first.
function potmHistory(){ return PlayerOfMonth.history(potmRecordsState, { nameOf: potmNameOf }); }

// One player's awards, oldest first -- what a profile shows.
function potmAwardsFor(name){
  return PlayerOfMonth.awardsFor(potmRecordsState, playerIdFor(name), { nameOf: potmNameOf });
}

// The confirmed winner of a month, or null.
function potmWinnerOf(month){
  const r = potmRecordFor(month);
  return PlayerOfMonth.isConfirmed(r) ? PlayerOfMonth.history([r], { nameOf: potmNameOf })[0] : null;
}

// The finalised shortlist awaiting the group's vote, or null.
function potmShortlistOf(month){
  const r = potmRecordFor(month);
  return r && r.state === PlayerOfMonth.STATE.SHORTLISTED ? r.shortlist : null;
}

// One line for the places that used to name the points leader as Player of the
// Month (Board Pack, Share Deck, WhatsApp summary, Home).
function potmHeadline(month){
  const w = potmWinnerOf(month);
  if(w) return { state: 'confirmed', names: [w.name], winner: w, text: w.name };
  const list = potmShortlistOf(month);
  if(list) return { state: 'shortlisted', names: [], shortlist: list, text: 'Voting on: ' + list.map(e => potmNameOf(e.playerId) || e.name).join(', ') };
  return { state: 'none', names: [], text: 'Not chosen yet' };
}
