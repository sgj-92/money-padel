// ===================== ADMIN: PLAYER MONTHLY PACKS (DATA) =====================
// One player's month, from the club's own record: the player-month model
// (domain/playerPack/playerMonth.js) fed with the month's approved matches,
// the historical tier on each match's date, the engine's stored facts for
// each match and Merit's classification of each win; and beside it the
// player's places in the tables the app already keeps -- League and Merit by
// tier, the Monthly Race, the month-end Power Rating and tier rank -- read
// from those tables, never worked out again.
//
// Also: which players a month has, the module data, storage of drafts and
// published packs, and the private link.
//
// Owning stream: functional. Loads before app.js; declarations only.

// Every player who played in the month, by name -- less anyone archived since:
// a pack is sent to a member, and they have left the group. (Their games stay
// in everyone else's packs, which are history.)
function playerPackPlayers(month){
  return Object.values(computeMonthlySummaryStats(month)).filter(s => s.games > 0).map(s => s.name)
    .filter(n => !isArchivedPlayer(n))
    .sort((a, b) => a.localeCompare(b));
}

// What the engine stored for this player in one match: their rating change,
// and their side's expected and actual performance scores. Never computed.
function playerPackFacts(name){
  const id = (typeof playerIdFor === 'function') ? playerIdFor(name) : name;
  return (matchId) => {
    const f = V3_MATCH_FACTS && V3_MATCH_FACTS[matchId];
    const me = f && (f.byPlayer[id] || f.byPlayer[name]);
    if(!me) return null;
    const side = f.sides[me.side];
    return { ratingDelta: me.ratingDelta, expected: side.expected, actual: side.actual, residual: side.residual };
  };
}

const PP_ORDINAL = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));

// The whole month for one player: the model plus their places in the club's
// tables. Built once per pack and shared by every module.
function playerMonthlyPack(name, month){
  // Merit's own classification of each of the player's wins (hard / even /
  // favoured), from the same table the Merit screen draws.
  const meritRow = MeritTable.build(meritMatches(month), historicalTierOf).table.find(r => r.playerId === name);
  const meritById = {};
  if(meritRow) meritRow.games.forEach(g => { if(g.result === 'W') meritById[g.id] = { kind: g.kind, steps: g.steps, points: g.points }; });

  const model = PlayerMonth.build({ player: name, month, matches: getAllApprovedMatches(), tierOf: historicalTierOf,
    factsOf: playerPackFacts(name), meritOf: (id) => meritById[id] || null });

  const stats = computeMonthlySummaryStats(month)[name] || null;

  // League by tier: the player's place in each tier they played in.
  const split = leagueSplitRows(month).filter(s => s.games > 0);
  const league = split.filter(s => s.name === name).map(s => {
    const rows = sortLeagueRows(split.filter(x => x.tier === s.tier), 'points', true);
    return { tier: s.tier, position: rows.findIndex(x => x.name === name) + 1, of: rows.length, points: s.points };
  });
  // Merit by tier, in the Merit table's own order.
  const meritTable = MeritTable.build(meritMatches(month), historicalTierOf, { tierForRow: historicalTierOf }).table.filter(r => r.played > 0);
  const merit = meritTable.filter(r => r.playerId === name).map(r => {
    const rows = meritTable.filter(x => x.tier === r.tier);
    return { tier: r.tier, position: rows.indexOf(r) + 1, of: rows.length, points: r.merit };
  });
  // The Monthly Race: a place among the tier's qualifiers, or provisional.
  const race = buildMonthlyRace(month).table;
  const raceRows = race.filter(r => r.playerId === name).map(r => {
    const q = race.filter(x => x.tier === r.tier && x.qualified);
    return { tier: r.tier, qualified: r.qualified, position: r.qualified ? q.indexOf(r) + 1 : null, of: q.length, score: r.score, played: r.played };
  });
  // Power Rating over the month, from the monthly views.
  const mv = MONTHLY_VIEWS ? MonthlyViews.playerMonth(MONTHLY_VIEWS, month, name) : null;
  const power = mv ? {
    start: mv.startRating, end: mv.endRating, change: mv.ratingChange, byDecision: mv.reassessmentChange,
    tierStart: mv.tierAtMonthStart, tierEnd: mv.tierAtMonthEnd, tierRank: mv.endRankInTier,
    rankStart: mv.startRankOverall, rankEnd: mv.endRankOverall, rankChange: mv.rankChangeOverall,
  } : null;

  // The chemistry the Insights screen ranks by, over this month's games --
  // draws included -- for this player's pairs (2+ games together).
  const chemistry = buildPartnerships(matchesIncludingDraws().filter(m => Period.of(m.date) === month), TIER_MAP)
    .filter(p => p.pair.includes(name))
    .map(p => ({ partner: p.pair.find(x => x !== name), chemistry: p.avg_overperf, decided: p.games }));

  const monthEnd = Period.end(month);
  const tier = (power && power.tierEnd) || historicalTierOf(name, monthEnd);

  return { player: name, month, label: monthLabel(month), model, stats, league, merit, race: raceRows, power, chemistry, tier };
}

// module id -> (pack, options, config) -> data
function playerPackSources(){ return {
  overview: (p) => ({ record: p.model.record, points: p.stats ? p.stats.points : 0, league: p.league, merit: p.merit, race: p.race, power: p.power, tier: p.tier }),
  matchups: (p, o) => ({ rows: p.model.matchupTypes.slice(0, BoardPack.limit(o.top)), total: p.model.matchupTypes.length }),
  partners: (p, o) => {
    const best = p.chemistry.slice().sort((a, b) => b.chemistry - a.chemistry)[0] || null;
    return { rows: p.model.partners.slice(0, BoardPack.limit(o.top)).map(t => Object.assign({}, t, { chemistry: (p.chemistry.find(c => c.partner === t.name) || {}).chemistry })), strongest: best };
  },
  rivals: (p, o) => {
    const min = Number(o.min || 2);
    const list = p.model.opponents;
    const enough = list.filter(t => t.played >= min);
    const net = (t) => t.wins - t.losses;
    const pick = (f) => enough.slice().sort(f)[0] || null;
    return {
      min, rows: list.slice(0, BoardPack.limit(o.top)),
      mostPlayed: list[0] || null,
      best: (() => { const b = pick((a, b) => net(b) - net(a) || b.gd - a.gd || b.played - a.played); return b && net(b) > 0 ? b : null; })(),
      toughest: (() => { const t = pick((a, b) => net(a) - net(b) || a.gd - b.gd || b.played - a.played); return t && net(t) < 0 ? t : null; })(),
      closest: pick((a, b) => Math.abs(net(a)) - Math.abs(net(b)) || Math.abs(a.gd) - Math.abs(b.gd) || b.played - a.played),
    };
  },
  best: (p) => PlayerMonth.bestResults(p.model),
  weaker: (p, o) => PlayerMonth.weakerResults(p.model, { min: Number(o.min || 2) }),
  movement: (p) => {
    const gains = p.model.matches.filter(m => m.ratingDelta !== null);
    const up = gains.filter(m => m.ratingDelta > 0).sort((a, b) => b.ratingDelta - a.ratingDelta)[0] || null;
    const down = gains.filter(m => m.ratingDelta < 0).sort((a, b) => a.ratingDelta - b.ratingDelta)[0] || null;
    return { power: p.power, up, down };
  },
  targets: (p, o, config) => {
    const rivals = config && config.items.find(it => it.id === 'rivals');
    return { rows: PlayerMonth.targets(p.model, { minRival: Number((rivals && rivals.options.min) || 2), max: Number(o.top || 3), currentTier: p.tier }) };
  },
}; }

function playerPackModuleData(item, pack, config){
  const source = playerPackSources()[item.id];
  return source ? source(pack, item.options || {}, config) : null;
}

// ---- Storage --------------------------------------------------------------
// Drafts: one document per month (moneypadel_player_packs_YYYY-MM) holding
// every player's pack choice -- modules, order, options, Admin note -- and,
// for packs that have been published, their private link. Generate all
// writes it once.
//
// Published packs: their own collection, playerPacks, one document per pack
// named by a random token -- the link's only key. Nothing about the name of
// that document says whose pack it is or which month, so a link cannot be
// made by changing a name or a month in another one. A pack is stored as it
// was published (its slides, formatted), so the link shows the month as it
// was shared.
const PLAYER_PACKS_COLLECTION = 'playerPacks';

function playerPacksKey(month){
  if(!BoardPack.isMonth(month)) throw new Error(`not a month: ${month}`);
  return `moneypadel_player_packs_${month}`;
}

// 128 random bits, URL-safe: the private link's key.
function newPlayerPackToken(){
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const PLAYER_PACK_TOKEN = /^[A-Za-z0-9_-]{22}$/;

function playerPackUrl(token){
  return new URL(`review/?p=${token}`, new URL('.', location.href)).href;
}

// A month's drafts, made safe to edit: every player's config normalised.
function normalisePlayerPacks(raw, month){
  const out = { version: 1, month, players: {}, links: {}, generatedAt: null, generatedBy: null };
  if(!raw || raw.month !== month) return out;
  Object.entries(raw.players || {}).forEach(([name, cfg]) => { out.players[name] = BoardPack.PLAYER.normalise(cfg, month); });
  Object.entries(raw.links || {}).forEach(([name, l]) => { if(l && PLAYER_PACK_TOKEN.test(l.token)) out.links[name] = { token: l.token, revision: Number(l.revision) || 1, publishedAt: l.publishedAt || null, withdrawn: !!l.withdrawn }; });
  out.generatedAt = raw.generatedAt || null; out.generatedBy = raw.generatedBy || null;
  return out;
}

function playerPackAdminName(){
  const viewer = (typeof getCurrentViewer === 'function') ? getCurrentViewer() : null;
  return (currentUserName && currentUserName.trim()) || (viewer && viewer.name) || (adminRole === 'board' ? 'Board' : 'Admin');
}

// Generate all: a draft -- the default pack -- for every player of the month
// who has none. Drafts already made (and any edits to them) are kept.
// Nothing is published.
function generateAllPlayerPacks(drafts, month){
  const next = JSON.parse(JSON.stringify(drafts));
  const added = [];
  playerPackPlayers(month).forEach(name => {
    if(next.players[name]) return;
    next.players[name] = BoardPack.PLAYER.defaultConfig(month);
    added.push(name);
  });
  next.generatedAt = new Date().toISOString();
  next.generatedBy = playerPackAdminName();
  return { drafts: next, added };
}

async function savePlayerPackDrafts(drafts){
  if(!isUnlocked) return { ok: false, message: 'Only an admin can change Player Packs.' };
  try {
    await fsSet(playerPacksKey(drafts.month), JSON.stringify(drafts));
    return { ok: true };
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); return { ok: false, message: `Save failed (${lastStorageError}) — try again.` }; }
}

async function loadPlayerPackDrafts(month){
  try { const v = await fsGet(playerPacksKey(month)); if(v) return normalisePlayerPacks(JSON.parse(v), month); } catch(e){ console.error('load player packs failed', e); }
  return normalisePlayerPacks(null, month);
}

// The player's deck, from their pack's selected modules in its order.
function playerPackDeck(name, month, config, pack){
  const p = pack || playerMonthlyPack(name, month);
  const entries = BoardPack.PLAYER.selected(config).map(item => ({ item, data: item.kind === 'module' ? playerPackModuleData(item, p, config) : null }));
  return PlayerDeck.build({ player: name, month, monthLabel: monthLabel(month), entries });
}

// Publish: the deck exactly as it reads now, stored under the player's token
// (made on first publish, kept after, so the link never changes). Republish
// is the next revision; nothing is published without this call.
async function publishPlayerPack(drafts, name){
  if(!isUnlocked) return { ok: false, message: 'Only an admin can publish a Player Pack.' };
  const month = drafts.month;
  const config = drafts.players[name] || BoardPack.PLAYER.defaultConfig(month);
  const link = drafts.links[name];
  const token = link ? link.token : newPlayerPackToken();
  let previous = null;
  // A republish continues the stored history; if it cannot be read, stop
  // rather than start the revisions again.
  try { const v = await fsGetIn(PLAYER_PACKS_COLLECTION, token); if(v) previous = JSON.parse(v); }
  catch(e){ if(link){ lastStorageError = (e && e.message) ? e.message : String(e); return { ok: false, message: `Publish failed (${lastStorageError}) — try again.` }; } }
  const at = new Date().toISOString();
  const deck = playerPackDeck(name, month, config);
  const publication = Object.assign(ShareDeck.publication({ deck, by: playerPackAdminName(), at, previous }), { kind: 'player', player: name, token });
  try { await fsSetIn(PLAYER_PACKS_COLLECTION, token, JSON.stringify(publication)); }
  catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); return { ok: false, message: `Publish failed (${lastStorageError}) — try again.` }; }
  const next = JSON.parse(JSON.stringify(drafts));
  next.players[name] = config;
  next.links[name] = { token, revision: publication.revision, publishedAt: at, withdrawn: false };
  const saved = await savePlayerPackDrafts(next);
  if(!saved.ok) return Object.assign(saved, { publication });
  return { ok: true, drafts: next, publication };
}

// Unpublish: the link stops showing the pack at once; nothing is deleted and
// publishing again brings it back under the same link.
async function unpublishPlayerPack(drafts, name){
  if(!isUnlocked) return { ok: false, message: 'Only an admin can unpublish a Player Pack.' };
  const link = drafts.links[name];
  if(!link || link.withdrawn) return { ok: false, message: 'This pack is not published.' };
  const v = await fsGetIn(PLAYER_PACKS_COLLECTION, link.token);
  const current = v ? JSON.parse(v) : null;
  if(!ShareDeck.isLive(current)) return { ok: false, message: 'This pack is not published.' };
  const publication = ShareDeck.withdrawal(current, { by: playerPackAdminName(), at: new Date().toISOString() });
  await fsSetIn(PLAYER_PACKS_COLLECTION, link.token, JSON.stringify(publication));
  const next = JSON.parse(JSON.stringify(drafts));
  next.links[name] = Object.assign({}, link, { withdrawn: true });
  const saved = await savePlayerPackDrafts(next);
  return saved.ok ? { ok: true, drafts: next, publication } : saved;
}
