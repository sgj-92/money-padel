// ===================== ADMIN: MONTHLY BOARD PACK (DATA) =====================
// What each Board Pack module shows for a month, drawn from the functions the
// rest of the app already uses -- the League, Merit and Race tables, the
// Rankings pool and Kings of Tiers, the Monthly Information review and the
// monthly stories, Doughnuts, Last 10, partnerships and the tier history. No
// figure here is worked out a second way: a module selects, groups and trims
// what those functions return, and nothing more. The options a module takes
// are presentation only (how many, which tier, which half).
//
// Also: the month list, the "has the record changed since this was saved"
// basis, and the one save path (Admin only).
//
// Owning stream: functional. Loads before app.js; declarations only.

// The months a pack can be built for: every month with games, newest first.
function boardPackMonths(){
  return getAvailableMonths().slice().reverse();
}

// Which month the section opens on: the month the monthly screens open on
// (the Meaningful Month), else the newest with games.
function boardPackDefaultMonth(){
  const months = boardPackMonths();
  const m = meaningfulMonthNow().month;
  return months.includes(m) ? m : (months[0] || null);
}

// Tier sections in the club's order, limited to the one asked for.
function boardPackTiers(tierOption){
  return groupedTiers().filter(t => tierOption === 'all' || t === tierOption);
}

// A list shown split by tier (each tier its own section, every tier
// included, `top` applying to each) or as one list (`top` over the whole).
// One list with a tier chosen is that tier's rows. Returns the sections --
// one, untitled (tier null), for a single list -- and every row shown.
function boardPackSplit(o, rows, tierOf){
  const top = BoardPack.limit(o.top);
  const one = o.split === 'one' && o.tier === 'all';
  const tiers = one
    ? [{ tier: null, rows: rows.slice(0, top) }]
    : boardPackTiers(o.tier).map(tier => ({ tier, rows: rows.filter(r => tierOf(r) === tier).slice(0, top) })).filter(t => t.rows.length);
  // Split, a hidden Tier S section (the club's switch) is left out like any
  // tier-grouped view; the report says so. One list keeps everyone.
  const sHidden = !one && !tierSSectionsShown() && (o.tier === 'all' || o.tier === 'S') && rows.some(r => tierOf(r) === 'S');
  return { split: o.split === 'one' ? 'one' : 'split', tiers, rows: tiers.flatMap(t => t.rows), sHidden };
}

function boardPackTierAt(name, date){ return historicalTierOf(name, date); }

// module id -> (month, options) -> data. A function rather than a table so
// nothing here reads app state while the script loads.
// Who reached a % of their games that month: `count` is wins or losses,
// `pct` the matching percentage to order by. The threshold is the Admin's
// choice (80% unless set) and reaching it counts -- compared in whole
// numbers, so 4 of 5 is exactly 80%. Players under `min` games are left out.
function boardPackThreshold(month, o){
  const min = Number(o.min || 3);
  const threshold = Number(o.threshold || 80);
  const played = Object.values(computeMonthlySummaryStats(month)).filter(s => s.games > 0 && s.games >= min);
  const reached = (count, pct) => played.filter(s => s[count] * 100 >= threshold * s.games)
    .sort((a, b) => b[pct] - a[pct] || b.games - a.games || a.name.localeCompare(b.name));
  return { min, threshold, reached };
}

function boardPackSources(){ return {
  overview(month){
    const approved = getAllApprovedMatches();
    const stats = Object.values(computeMonthlySummaryStats(month)).filter(s => s.games > 0);
    return {
      // The canonical match count (Home and the Meaningful Month use it):
      // each match once, draws included.
      games: MeaningfulMonth.countInMonth(approved, month),
      draws: MeaningfulMonth.countInMonth(approved.filter(m => m.isDraw), month),
      players: stats.length,
    };
  },

  // One row per player for the whole month, from the same aggregation as the
  // League (All together) and Monthly Information: games, W / D / L, points
  // at 3 / 1 / 0, and the Information review's "hardest games" measure
  // (average strength of the games played, ÷ 300). Ordered by the League's
  // own standing rule, or by games or difficulty first.
  // Split by tier, a mid-month mover is in each tier they played in, with
  // that spell's games -- the League's own split (leagueSplitRows). As one
  // list, each player is one row with the month's whole record.
  results_table(month, o){
    const key = { points: 'points', games: 'games', difficulty: 'hardness' }[o.sort] || 'points';
    const whole = o.split === 'one' && o.tier === 'all';
    const rows = whole
      ? Object.values(computeMonthlySummaryStats(month)).filter(s => s.games > 0)
        .map(s => ({ ...s, tier: tierSpellLabel(s.name, month) || tierAtMonthClose(s.name, month) || '?' }))
      : leagueSplitRows(month).filter(s => s.games > 0);
    return Object.assign({ sort: o.sort }, boardPackSplit(o, sortLeagueRows(rows, key, true), r => r.tier));
  },

  // Anyone who won the chosen % of the games they played that month OR MORE
  // (Shaun, 1 Oct: 4 of 5 is 80%, and counts at 80%). Draws are games
  // played, so they count in the denominator -- the same win % and loss % as
  // Monthly Information. `min` is the fewest games that make a percentage
  // worth reporting; 3 is Monthly Information's own rule.
  over_80(month, o){
    const t = boardPackThreshold(month, o);
    return { min: t.min, threshold: t.threshold, won: t.reached('wins', 'winpct') };
  },

  // The same for losing, with its own threshold and minimum (Shaun, 1 Oct).
  lost_pct(month, o){
    const t = boardPackThreshold(month, o);
    return { min: t.min, threshold: t.threshold, lost: t.reached('losses', 'losspct') };
  },

  information(month){
    return monthlyInformation(month);
  },

  power(month, o){
    // The Rankings month pool, with the Admin's own floor (5+ games, the
    // Rankings month default, unless set) and, if asked, without inactive or
    // idle players -- judged at the month's close: Idle is the Rankings rule
    // (2+ rated games in the 30 days) on the month's last day. Inactive is the
    // club's flag, which has no history, so it is today's.
    const minGames = Number(o.min || defaultRankingMinGames(month));
    const players = o.players || 'all';
    const [y, mo] = month.split('-').map(Number);
    const monthEnd = Date.UTC(y, mo, 1) - 1;
    const keep = (name) => {
      if(players === 'all') return true;
      const st = playerStateOf(name, monthEnd);
      if(!st) return true;
      return players === 'ranked' ? st.rankable : st.participation !== 'INACTIVE';
    };
    const moves = monthlyMovementIndex(month);
    // In rating order, so each tier's section is that tier's ranking.
    const pool = rankingPool(month, minGames)
      .filter(p => keep(p.name))
      .map(p => ({ name: p.name, tier: p.scopeTier, rating: p.scopeRating, games: p.total,
        ratingChange: moves[p.name] ? moves[p.name].ratingChange : null,
        rankChange: moves[p.name] ? moves[p.name].rankChangeOverall : null }));
    return Object.assign({ minGames, players, rankingsDefault: minGames === defaultRankingMinGames(month) }, boardPackSplit(o, pool, r => r.tier));
  },

  kings(month){
    const minGames = defaultRankingMinGames('all');
    const kings = kingsOfTiersFor(month);
    // A hidden Tier S section is hidden here too (groupedTiers).
    if(kings && !tierSSectionsShown()){
      delete kings.S;
      kings._fieldSize = Object.assign({}, kings._fieldSize, { S: 0 });
      if(!TIER_ORDER_LIST.some(t => kings[t])) return { minGames, kings: null };
    }
    return { minGames, kings };
  },

  league(month, o){
    const rows = leagueSplitRows(month).filter(s => s.games > 0);
    return { tiers: boardPackTiers(o.tier).map(tier => ({ tier,
      rows: sortLeagueRows(rows.filter(s => s.tier === tier), 'points', true).slice(0, BoardPack.limit(o.top)) }))
      .filter(t => t.rows.length) };
  },

  merit(month, o){
    const { table, unresolved } = MeritTable.build(meritMatches(month), boardPackTierAt, { tierForRow: boardPackTierAt });
    return { unresolved: unresolved.length, tiers: boardPackTiers(o.tier).map(tier => ({ tier,
      rows: table.filter(r => r.tier === tier && r.played > 0).slice(0, BoardPack.limit(o.top)) }))
      .filter(t => t.rows.length) };
  },

  race(month, o){
    const { table, unresolved } = buildMonthlyRace(month);
    return { unresolved: unresolved.length, minMatches: MonthlyRace.MIN_MATCHES, tiers: boardPackTiers(o.tier).map(tier => ({ tier,
      rows: table.filter(r => r.tier === tier && (o.provisional === 'show' || r.qualified)).slice(0, BoardPack.limit(o.top)) }))
      .filter(t => t.rows.length) };
  },

  most_wins(month, o){
    const info = monthlyInformation(month, { top: BoardPack.limit(o.top) });
    return { groups: info.mostWins, stats: info.stats };
  },

  best_record(month, o){
    const info = monthlyInformation(month, { top: BoardPack.limit(o.top) });
    return { groups: info.highestWinPct, stats: info.stats, minGames: info.minGamesForRanked };
  },

  // Losses over games played, 3+ games: Monthly Information's own list.
  worst_record(month, o){
    const info = monthlyInformation(month, { top: BoardPack.limit(o.top) });
    return { groups: info.highestLossPct, stats: info.stats, minGames: info.minGamesForRanked };
  },

  most_games(month, o){
    return { groups: monthlyInformation(month, { top: BoardPack.limit(o.top) }).mostGames };
  },

  rating_movers(month, o){
    const s = monthlyStories(month, { top: BoardPack.limit(o.top) });
    return { risers: s && o.show !== 'fallers' ? s.risers : [], fallers: s && o.show !== 'risers' ? s.fallers : [] };
  },

  rank_movers(month, o){
    const s = monthlyStories(month, { top: BoardPack.limit(o.top) });
    return { climbers: s && o.show !== 'sliders' ? s.climbers : [], sliders: s && o.show !== 'climbers' ? s.sliders : [] };
  },

  performance(month, o){
    const s = monthlyStories(month, { top: BoardPack.limit(o.top) });
    return { rows: s ? s.perf : [] };
  },

  form(month, o){
    // The players of the month, with the Last 10 they carried out of it.
    const played = new Set(Object.values(computeMonthlySummaryStats(month)).filter(s => s.games > 0).map(s => s.name));
    const rows = sortLastTenRows(lastTenAtMonthEnd(month).filter(r => played.has(r.name)), 'points', true);
    return { window: LastTen.WINDOW, rows: rows.slice(0, BoardPack.limit(o.top)) };
  },

  hard_wins(month, o){
    // Merit's own classification of every win, whole month per player.
    const { table } = MeritTable.build(meritMatches(month), boardPackTierAt);
    const rows = table.map(r => ({ name: r.playerId, hardWins: r.hardWins, easyWins: r.easyWins }));
    const n = BoardPack.limit(o.top);
    return {
      hard: o.show !== 'favoured' ? topNTied(rows.filter(r => r.hardWins > 0), 'hardWins', n, true) : [],
      favoured: o.show !== 'hard' ? topNTied(rows.filter(r => r.easyWins > 0), 'easyWins', n, true) : [],
    };
  },

  doughnuts(month, o){
    const rows = computeDoughnutStats(month);
    const n = BoardPack.limit(o.top);
    return {
      received: o.show !== 'given' ? topNTied(rows.filter(r => r.received > 0), 'received', n, true) : [],
      given: o.show !== 'received' ? topNTied(rows.filter(r => r.given > 0), 'given', n, true) : [],
    };
  },

  partnerships(month, o){
    // The chemistry measure the Insights screen ranks by, over this month's
    // rated games (2+ together). Draws are not rated, so chemistry cannot
    // include them, but they are games the pair played: each pair's record
    // carries its drawn games from the approved matches (the same draws the
    // League counts), and its win % has them in the denominator, as Monthly
    // Information's does.
    // Every game together, draws included (buildPartnerships counts them).
    const rows = buildPartnerships(matchesIncludingDraws().filter(m => m.date.slice(0,7) === month), TIER_MAP)
      .map(p => ({ ...p, played: p.games }));
    return { rows: rows.slice(0, BoardPack.limit(o.top)) };
  },

  tier_moves(month){
    const changes = V3_TIER_HISTORY ? V3_TIER_HISTORY.changes : [];
    return { rows: changes.filter(c => c.effectiveDate.slice(0,7) === month)
      .map(c => ({ name: displayNameFor(c.playerId), date: c.effectiveDate, fromTier: c.fromTier, toTier: c.toTier, eventType: c.eventType })) };
  },

  crossovers(month, o){
    const s = monthlyStories(month, { top: BoardPack.limit(o.top) });
    return { rows: s ? s.crossovers : [] };
  },
}; }

// One module's data for a month, or null for a module this build does not
// know (a config written by a newer one).
function boardPackModuleData(item, month){
  const source = boardPackSources()[item.id];
  return source ? source(month, item.options || {}) : null;
}

// What the record held for a month, reduced to a fingerprint: its matches as
// recorded, the ratings at its close and its tier changes. Stored beside a
// saved pack, so that reopening it can say when a later correction, a late
// result or a club decision has changed what the month shows. The pack's
// figures are always today's; this only says whether they still match.
function boardPackBasis(month){
  const matches = getAllApprovedMatches().filter(m => m.date.slice(0,7) === month)
    .map(m => [m.id, m.date, m.winners, m.losers, m.sets, !!m.isDraw])
    .sort((a,b) => String(a[0]).localeCompare(String(b[0])));
  const closing = monthEndRatings(month);
  const ratings = Object.keys(closing).sort().map(n => [n, Math.round(closing[n]*10)/10]);
  const tiers = boardPackSources().tier_moves(month).rows;
  return {
    games: MeaningfulMonth.countInMonth(getAllApprovedMatches(), month),
    fingerprint: simpleHash(JSON.stringify({ matches, ratings, tiers })),
  };
}

// The one way a pack is saved. Admin only: the section is behind the lock,
// and so is this.
async function saveBoardPackConfig(config){
  if(!isUnlocked) return { ok: false, message: 'Only an admin can save the Board Pack.' };
  if(!config || !BoardPack.isMonth(config.month)) return { ok: false, message: 'Choose a month first.' };
  const viewer = (typeof getCurrentViewer === 'function') ? getCurrentViewer() : null;
  const by = (currentUserName && currentUserName.trim()) || (viewer && viewer.name) || (adminRole === 'board' ? 'Board' : 'Admin');
  const stored = BoardPack.forSave(config, { by, at: new Date().toISOString(), basis: boardPackBasis(config.month) });
  const ok = await saveBoardPack(stored);
  if(!ok) return { ok: false, message: storageAvailable() ? `Save failed (${lastStorageError || 'unknown error'}) — try again.` : `Save failed — this page can't reach shared storage.` };
  return { ok: true, config: stored };
}

// ---- The Share Deck: the same pack, told to players ---------------------

// The Share Deck for a Board Pack: its selected modules and commentary, in
// its order, each from the same module data the Board Pack shows.
function boardPackDeck(config){
  const entries = BoardPack.selected(config).map(item => ({
    item, data: item.kind === 'module' ? boardPackModuleData(item, config.month) : null,
  }));
  return ShareDeck.build(config.month, entries);
}

// What a player may see -- an Admin sees everything, so the deck an Admin
// shares is filtered by the settings, not by who is holding the phone.
function boardPackPlayerCanSee(section){
  return visibilityState[section] !== false;
}

// The review's stable address: the same for every revision of the month.
// A query rather than a path, so it works on every host the app is served
// from (Vercel, GitHub Pages, a local server) without a rewrite.
function boardPackReviewUrl(month){
  return new URL(`review/?m=${month}`, new URL('.', location.href)).href;
}

function boardPackReviewSummary(publication){
  return ShareDeck.summaryText(publication.deck, { link: boardPackReviewUrl(publication.month), canSee: boardPackPlayerCanSee });
}

// Publish: save the pack, then store its Share Deck exactly as it now reads,
// as the next revision of the month's review. Admin only, and only ever on
// an explicit Publish -- editing the pack never changes what the link shows.
async function publishBoardPackReview(config){
  if(!isUnlocked) return { ok: false, message: 'Only an admin can publish the review.' };
  const saved = await saveBoardPackConfig(config);
  if(!saved.ok) return saved;
  const previous = await loadPublishedReview(config.month);
  const publication = ShareDeck.publication({ deck: boardPackDeck(saved.config), by: saved.config.updatedBy,
    at: saved.config.updatedAt, basis: saved.config.basis, previous });
  const ok = await savePublishedReview(publication);
  if(!ok) return { ok: false, config: saved.config, message: storageAvailable() ? `Publish failed (${lastStorageError || 'unknown error'}) — the pack was saved; try publishing again.` : `Publish failed — this page can't reach shared storage.` };
  return { ok: true, config: saved.config, publication };
}

// Unpublish: the link stops showing the review straight away. The review is
// kept, marked withdrawn -- nothing is deleted -- and publishing again
// brings it back as the next revision. Admin only.
async function unpublishBoardPackReview(month){
  if(!isUnlocked) return { ok: false, message: 'Only an admin can unpublish the review.' };
  const current = await loadPublishedReview(month);
  if(!ShareDeck.isLive(current)) return { ok: false, message: 'This review is not published.' };
  const viewer = (typeof getCurrentViewer === 'function') ? getCurrentViewer() : null;
  const by = (currentUserName && currentUserName.trim()) || (viewer && viewer.name) || (adminRole === 'board' ? 'Board' : 'Admin');
  const publication = ShareDeck.withdrawal(current, { by, at: new Date().toISOString() });
  const ok = await savePublishedReview(publication);
  if(!ok) return { ok: false, message: storageAvailable() ? `Unpublish failed (${lastStorageError || 'unknown error'}) — try again.` : `Unpublish failed — this page can't reach shared storage.` };
  return { ok: true, publication };
}
