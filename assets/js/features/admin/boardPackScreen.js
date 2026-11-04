// ===================== ADMIN: MONTHLY BOARD PACK (SCREEN) =====================
// Admin / Manage › Monthly Board Pack: choose a month, choose and order the
// modules, set how each is shown, add written commentary, preview, save. The
// figures come from boardPackData.js; the choice is domain/boardPack/
// boardPackConfig.js. Monthly Information stays the players' month story --
// this is the admin's own report and replaces nothing.
//
// The current Admin visual system, compact. Owning stream: functional.
// Loads before app.js; declarations only.

// Which month is open, the pack being edited for it, and what is stored for
// each month once read (null: nothing saved yet). Not persisted: like the
// rest of Admin / Manage it opens fresh.
let boardPackMonth = null;
let boardPackDraft = null;
let boardPackStored = {};
let boardPackLoading = null;
let boardPackPreviewOpen = false;
// Which preview: the Board Pack report ('pack') or the players' Share Deck
// ('deck').
let boardPackPreviewMode = 'pack';
// The published review of each month once read (null: never published).
let boardPackPublished = {};
// Which confirmation is open: 'publish', 'unpublish' or none.
let boardPackPublishConfirm = false;
let boardPackMessage = '';
let boardPackNoteSeq = 0;
// Which pack the section shows: the club's ('club') or the players' ('players').
let boardPackView = 'club';
// The Share Deck preview's moving parts, and pictures prepared but not yet
// shared (a share sheet must open from a tap; see CardPainter.share).
let boardPackDeckCtl = null;
let boardPackShareReady = null;

// ---- Drawing the modules ---------------------------------------------------
// Each module is described once, as blocks -- big numbers, a table, a list,
// the Kings tiles, a heading, a footnote -- and drawn twice from them: as
// HTML in the report, and as a picture (features/review/cardPainter.js) when
// a table is shared. So a picture can only ever show what the report shows.
//
//   { type: 'stats', items: [{ value, label }] }
//   { type: 'table', headers: [..], rows: [[cell]] }   cell: text, or { text, strong, note }
//   { type: 'list', rows: [{ rank, name, value }] }
//   { type: 'kings', tiles: [{ tier, name, rating, none }] }
//   { type: 'sub' | 'empty' | 'foot' | 'text', text }

const bpSub = (text) => ({ type: 'sub', text });
const bpEmpty = (text) => ({ type: 'empty', text });
const bpFoot = (text) => ({ type: 'foot', text });
function bpSigned(n){ return `${n > 0 ? '+' : ''}${n}`; }
const bpNames = (names) => names.join(' / ');
const bpStrong = (text) => ({ text: String(text), strong: true });

// Tie-grouped places: "1. A / B — value".
function bpGroups(groups, fmt, emptyText){
  if(!groups || !groups.length) return [bpEmpty(emptyText || 'Not enough data.')];
  return [{ type: 'list', rows: groups.map(g => ({ rank: String(g.rank), name: bpNames(g.names), value: fmt(g) })) }];
}

// Plain lines: [{ rank?, name, value }].
function bpLines(lines, emptyText){
  if(!lines.length) return [bpEmpty(emptyText || 'Nothing this month.')];
  return [{ type: 'list', rows: lines.map((l, i) => ({ rank: String(l.rank === undefined ? i + 1 : l.rank), name: l.name, value: l.value })) }];
}

const bpTable = (headers, rows) => ({ type: 'table', headers, rows });

function bpTiers(tiers, tableFor, emptyText){
  if(!tiers.length) return [bpEmpty(emptyText || 'No games recorded.')];
  return tiers.flatMap(t => t.tier === null ? [tableFor(t.rows)] : [bpSub(`Tier ${t.tier}`), tableFor(t.rows)]);
}

// Said under a split list when the club's switch hides the Tier S section.
const bpSHiddenFoot = (d) => d.sHidden ? [bpFoot('Tier S is hidden (Admin › Visible to everyone), so its section is left out; choose One list to include Tier S players.')] : [];

function bpRatingMoveLine(r){
  return { name: r.playerId, value: `${Math.round(r.startRating)} → ${Math.round(r.endRating)} · ${bpSigned(r.ratingChange)} pts`
    + (r.reassessmentChange ? ` (${bpSigned(r.reassessmentChange)} by club decision)` : '') };
}

function bpRankMoveLine(r){
  return { name: r.playerId + (r.played ? '' : ' (no games)'),
    value: `#${r.startRankOverall} → #${r.endRankOverall} · ${r.rankChangeOverall > 0 ? '▲' : '▼'}${Math.abs(r.rankChangeOverall)}` };
}

// module id -> (data, month) -> blocks
// "Won (or Lost) N% or more": the players, their % and W-D-L, and the rule.
function bpThresholdBlocks(d, what, list, pct){
  const t = d.threshold || 80;
  const word = what.toLowerCase();
  return [bpSub(t === 100 ? `${what} every match` : `${what} ${t}% or more`),
    ...bpLines(d[list].map(s => ({ rank: '•', name: s.name, value: `${word} ${s[pct]}% · ${s.wins}W ${s.draws}D ${s.losses}L of ${s.games}` })), 'Nobody.'),
    bpFoot(`${d.min > 1 ? `Players with ${d.min}+ matches that month. ` : 'Every player who played that month. '}Draws count as matches played.${t === 80 ? ' 4 of 5 is 80% and counts.' : ''}`)];
}

function boardPackBlocks(){ return {
  overview: (d) => [{ type: 'stats', items: [{ value: String(d.games), label: 'Games' }, { value: String(d.players), label: 'Players active' }, { value: String(d.draws), label: 'Draws' }] }],

  results_table: (d) => bpTiers(d.tiers, rows => d.tiers[0].tier === null
    ? bpTable(['#', 'Player', 'Tier', 'P', 'W', 'D', 'L', 'Pts', 'Diff'], rows.map((r, i) => [i + 1, r.name, r.tier,
      r.games, r.wins, r.draws, r.losses, bpStrong(r.points), Number(r.hardness).toFixed(1)]))
    : bpTable(['#', 'Player', 'P', 'W', 'D', 'L', 'Pts', 'Diff'], rows.map((r, i) => [i + 1, r.name,
      r.games, r.wins, r.draws, r.losses, bpStrong(r.points), Number(r.hardness).toFixed(1)])))
    .concat(bpSHiddenFoot(d))
    .concat([bpFoot(`Points: 3 for a win, 1 for a draw, 0 for a loss. Diff (difficulty) is the average strength of the games played ÷ 300 — the Monthly Information “hardest games” measure; higher is harder. Ordered by ${d.sort === 'games' ? 'games played' : d.sort === 'difficulty' ? 'difficulty' : 'points, then game difference'}.${d.tiers.length && d.tiers[0].tier !== null ? ' By the tier held on each match’s date: a player who moved tier mid-month is in each tier they played in.' : ''}`)]),

  over_80: (d) => bpThresholdBlocks(d, 'Won', 'won', 'winpct'),
  lost_pct: (d) => bpThresholdBlocks(d, 'Lost', 'lost', 'losspct'),

  information: (d) => {
    if(!d.statsArr.length) return [bpEmpty('No games recorded.')];
    const s = (g) => d.stats[g.names[0]];
    return [
      bpSub('Most games played'), ...bpGroups(d.mostGames, g => `${g.value} game${g.value===1?'':'s'}`),
      bpSub('Most wins & highest points'), ...bpGroups(d.mostWins, g => `${s(g).wins} win${s(g).wins===1?'':'s'}${s(g).draws ? ` · ${s(g).draws} draw${s(g).draws===1?'':'s'}` : ''} — ${g.value} pts`),
      bpSub('Most losses'), ...bpGroups(d.mostLosses, g => `${g.value} loss${g.value===1?'':'es'}`),
      bpSub('Lowest win % (highest loss %)'), ...bpGroups(d.lowestWinPct, g => `${s(g).losspct}% loser`),
      bpSub('Highest win %'), ...bpGroups(d.highestWinPct, g => `${g.value}% wins`),
      bpSub('Most doughnuts received'), ...(d.mostDoughnuts.length ? bpLines([{ rank: 1, name: bpNames(d.mostDoughnuts), value: `x${d.doughnutMax}` }]) : [bpEmpty('Nobody got doughnut’d this month.')]),
      bpSub('Hardest games played (avg opponent strength)'), ...bpGroups(d.hardestGames, g => `${g.value}`),
      bpSub('Player of the Month'), ...(d.playerOfMonth.state === 'confirmed' ? bpLines([{ rank: '👑', name: bpNames(d.playerOfMonth.names), value: '' }]) : [bpEmpty(d.playerOfMonth.text + '.')]),
    ];
  },

  power: (d) => bpTiers(d.tiers, rows => {
    const one = d.tiers[0].tier === null;  // split: the section heading is the tier
    const month = (r) => r.ratingChange === null ? '–' : `${bpSigned(r.ratingChange)} pts${r.rankChange ? ` · ${r.rankChange > 0 ? '▲' : '▼'}${Math.abs(r.rankChange)}` : ''}`;
    return one ? bpTable(['#', 'Player', 'Tier', 'Rating', 'Month'], rows.map((r, i) => [i + 1, r.name, r.tier || '–', Math.round(r.rating), month(r)]))
      : bpTable(['#', 'Player', 'Rating', 'Month'], rows.map((r, i) => [i + 1, r.name, Math.round(r.rating), month(r)]));
  }, 'Nobody qualified.')
    .concat(bpSHiddenFoot(d))
    .concat([bpFoot(`Month-end Power Rating and the tier held at the month's close; ${d.minGames}+ game${d.minGames === 1 ? '' : 's'} in the month${d.rankingsDefault ? ' (the Rankings month default)' : ''}${d.players === 'ranked' ? '; Ranked players only (2+ rated games in the 30 days to the month\'s end, not inactive)' : d.players === 'active' ? '; inactive players left out' : ''}.`)]),

  champions: (d) => {
    if(!d.tiers.length && !d.potm) return [bpEmpty('No Champions or Player of the Month for this month yet.')];
    return [bpSub(d.final ? 'Monthly Champions — the Monthly Race winner in each tier' : 'Leading the Monthly Race'),
      ...bpLines(d.tiers.map(t => ({ rank: `Tier ${t.tier}`, name: t.name, value: `${bpSigned(Math.round(t.score))} race pts · ${t.played} match${t.played === 1 ? '' : 'es'}` })), 'Nobody reached 5 matches.'),
      bpSub('Player of the Month'),
      ...bpLines(d.potm ? [{ rank: '🏆', name: d.potm.name, value: d.potm.title }] : [], 'Not chosen yet — voted by the club.')]
      .concat(d.final && d.tiers.length && !d.locked ? [bpFoot('Champions not confirmed yet: League › Honours.')] : []);
  },

  kings: (d) => {
    if(!d.kings) return [bpEmpty('No tier had a field of two or more.')];
    const tiles = TIER_ORDER_LIST.filter(t => d.kings[t] || d.kings._fieldSize[t]).map(t => {
      const k = d.kings[t];
      return k ? { tier: t, name: k.name, rating: String(k.rating) }
               : { tier: t, name: null, rating: null, none: d.kings._fieldSize[t] === 1 ? 'only one qualified' : 'nobody qualified' };
    });
    return [{ type: 'kings', tiles }, bpFoot(`Each tier's leader in the All-time Power Rankings at the month's end (Ranked, ${d.minGames}+ rated games); a tier needs two qualifiers to crown a king.`)];
  },

  league: (d) => bpTiers(d.tiers, rows => bpTable(['#', 'Player', 'P', 'W', 'D', 'L', 'GD', 'Pts'],
    rows.map((r, i) => [i + 1, r.name, r.games, r.wins, r.draws, r.losses, bpSigned(r.gd), bpStrong(r.points)]))),

  // Hard, Even and Fav add up to W, as on the Merit Table (Shaun, 30 Oct).
  merit: (d) => bpTiers(d.tiers, rows => bpTable(['#', 'Player', 'P', 'W', 'Hard', 'Even', 'Fav', 'Pts'],
    rows.map((r, i) => [i + 1, r.playerId, r.played, r.wins, r.hardWins, r.evenWins, r.easyWins, bpStrong(r.merit)])))
    .concat(d.unresolved ? [bpFoot(`${d.unresolved} match${d.unresolved===1?'':'es'} could not be scored: a player's tier on that date is unknown.`)] : []),

  race: (d) => bpTiers(d.tiers, rows => bpTable(['#', 'Player', 'P', 'W', 'D', 'L', 'Score'],
    rows.map((r, i) => [r.qualified ? i + 1 : '–', r.qualified ? r.playerId : { text: r.playerId, note: '(provisional)' }, r.played, r.wins, r.draws, r.losses, bpStrong(bpSigned(r.score))])), 'No qualifier this month.')
    .concat([bpFoot(`Qualifying: ${d.minMatches}+ matches in the tier.`)])
    .concat(d.unresolved ? [bpFoot(`${d.unresolved} match${d.unresolved===1?'':'es'} could not be scored.`)] : []),

  most_wins: (d) => bpGroups(d.groups, g => { const s = d.stats[g.names[0]];
    return `${s.wins} win${s.wins===1?'':'s'}${s.draws ? ` · ${s.draws} draw${s.draws===1?'':'s'}` : ''} — ${g.value} pts`; }),

  best_record: (d) => bpGroups(d.groups, g => { const s = d.stats[g.names[0]];
    return `${g.value}% · ${s.wins}W ${s.draws}D ${s.losses}L`; }, `Nobody played ${d.minGames}+ games.`),

  worst_record: (d) => bpGroups(d.groups, g => { const s = d.stats[g.names[0]];
    return `${g.value}% lost · ${s.wins}W ${s.draws}D ${s.losses}L`; }, `Nobody played ${d.minGames}+ games.`)
    .concat([bpFoot(`Losses ÷ games played, ${d.minGames}+ games. Draws count as games played.`)]),

  most_games: (d) => bpGroups(d.groups, g => `${g.value} game${g.value===1?'':'s'}`),

  rating_movers: (d) => (d.risers.length || d.fallers.length ? [] : [bpEmpty('No rating movement recorded.')])
    .concat(d.risers.length ? [bpSub('Risers'), ...bpLines(d.risers.map(bpRatingMoveLine))] : [])
    .concat(d.fallers.length ? [bpSub('Fallers'), ...bpLines(d.fallers.map(bpRatingMoveLine))] : []),

  rank_movers: (d) => (d.climbers.length || d.sliders.length ? [] : [bpEmpty('No rank movement recorded.')])
    .concat(d.climbers.length ? [bpSub('Climbers'), ...bpLines(d.climbers.map(bpRankMoveLine))] : [])
    .concat(d.sliders.length ? [bpSub('Sliders'), ...bpLines(d.sliders.map(bpRankMoveLine))] : []),

  performance: (d) => bpLines(d.rows.map(r => ({ name: r.playerId,
    value: `${bpSigned(r.performancePct)}% vs expectation · ${r.matches} games` })), 'Nobody played enough games.'),

  form: (d) => (d.rows.length
    ? [bpTable(['#', 'Player', 'Games', 'W-D-L', 'Pts'], d.rows.map((r, i) => [i + 1, r.name, r.short ? { text: String(r.games), note: `of ${d.window}` } : r.games, `${r.wins}-${r.draws}-${r.losses}`, bpStrong(r.points)]))]
    : [bpEmpty('No games this month.')])
    .concat([bpFoot(`Each player's last ${d.window} rated games as they stood at the month's close.`)]),

  hard_wins: (d) => (d.hard.length || d.favoured.length ? [] : [bpEmpty('No wins recorded.')])
    .concat(d.hard.length ? [bpSub('Hard wins (beat a stronger pairing)'), ...bpGroups(d.hard, g => `${g.value} win${g.value===1?'':'s'}`)] : [])
    .concat(d.favoured.length ? [bpSub('Favoured wins (beat a weaker pairing)'), ...bpGroups(d.favoured, g => `${g.value} win${g.value===1?'':'s'}`)] : []),

  doughnuts: (d) => (d.received.length || d.given.length ? [] : [bpEmpty('No doughnuts this month.')])
    .concat(d.received.length ? [bpSub('Received'), ...bpGroups(d.received, g => `x${g.value}`)] : [])
    .concat(d.given.length ? [bpSub('Given'), ...bpGroups(d.given, g => `x${g.value}`)] : []),

  partnerships: (d) => bpLines(d.rows.map(p => ({ name: `${p.pair[0]} & ${p.pair[1]}`,
    value: `${p.wins}W ${p.draws}D ${p.losses}L (${p.winpct}%) · ${bpSigned(p.avg_overperf)}% chemistry` })), 'No pair played twice together.')
    .concat(d.rows.length ? [bpFoot('Pairs with 2+ decided games together this month, ranked by chemistry: how far they beat what the matchup predicted. Draws are in the record and the win %; chemistry comes from decided games, as draws are not rated.')] : []),

  tier_moves: (d) => bpLines(d.rows.map(c => ({ rank: '•', name: c.name,
    value: `${c.fromTier} → ${c.toTier} · ${dayLabel(c.date)}` })), 'No tier changes this month.'),

  crossovers: (d) => bpLines(d.rows.map(c => ({ rank: '•', name: `${c.overtook} passed ${c.overtaken}`, value: '' })), 'Nobody changed places.'),
}; }

// Blocks as the report's HTML.
function bpCellHtml(c){
  if(c && typeof c === 'object'){
    const text = escapeHtml(c.text);
    return (c.strong ? `<b>${text}</b>` : text) + (c.note ? ` <span class="bp-dim">${escapeHtml(c.note)}</span>` : '');
  }
  return escapeHtml(c);
}

function bpBlocksHtml(blocks){
  return blocks.map(b => {
    switch(b.type){
      case 'sub': return `<div class="bp-subhead">${escapeHtml(b.text)}</div>`;
      case 'empty': return `<div class="bp-empty">${escapeHtml(b.text)}</div>`;
      case 'foot': return `<div class="bp-foot">${escapeHtml(b.text)}</div>`;
      case 'text': return `<div class="bp-note-body">${escapeHtml(b.text).replace(/\n/g, '<br>') || '<span class="bp-dim">(empty)</span>'}</div>`;
      case 'stats': return `<div class="bp-stats">${b.items.map(x => `
    <div class="bp-stat"><div class="bp-stat-num">${escapeHtml(x.value)}</div><div class="bp-stat-label">${escapeHtml(x.label)}</div></div>`).join('')}
  </div>`;
      case 'table': return `<table class="bp-table"><thead><tr>${b.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${bpCellHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      case 'list': return `<ol class="bp-list">${b.rows.map(l => `<li><span class="bp-rank">${escapeHtml(l.rank)}</span><span class="bp-name">${escapeHtml(l.name)}</span><span class="bp-val">${escapeHtml(l.value)}</span></li>`).join('')}</ol>`;
      // The Rankings screen's own Kings of Tiers tiles: same crown, same
      // tier metals, same classes (screens/rankings.css).
      case 'kings': return `<div class="kings-row">${b.tiles.map(k => `<div class="kings-card bp-king kings-tier-${k.tier.toLowerCase()}">
        <div class="kings-crown-wrap"><img class="kings-crown" src="assets/rankings/podium-crown-laurel.png" alt="" onerror="this.style.display='none'"></div>
        ${k.name ? `<div class="kings-name">${escapeHtml(k.name)}</div><div class="kings-tier-label">Tier ${k.tier}</div><div class="kings-rating">${escapeHtml(k.rating)}</div>`
            : `<div class="kings-name kings-name-empty">—</div><div class="kings-tier-label">Tier ${k.tier}</div><div class="kings-rating bp-king-none">${escapeHtml(k.none)}</div>`}
      </div>`).join('')}</div>`;
      default: return '';
    }
  }).join('');
}

// module id -> (data, month) -> html
function boardPackRenderers(){
  const blocks = boardPackBlocks();
  return Object.fromEntries(Object.keys(blocks).map(id => [id, (d, m) => bpBlocksHtml(blocks[id](d, m))]));
}

// One module or note as a picture-ready sheet: its title, the month, and the
// same blocks the report draws.
function boardPackSheet(item, month){
  if(item.kind === 'note') return { title: item.title || 'Admin commentary', tag: 'Admin commentary', month: monthLabel(month), blocks: [{ type: 'text', text: item.body }] };
  return { title: BoardPack.BY_ID[item.id].title, month: monthLabel(month), blocks: boardPackBlocks()[item.id](boardPackModuleData(item, month), month) };
}

function boardPackNoteHtml(note){
  return `<section class="bp-module bp-note" data-note="${escapeHtml(note.id)}">
    <div class="bp-note-tag">Admin commentary</div>
    ${note.title ? `<div class="bp-module-title">${escapeHtml(note.title)}</div>` : ''}
    ${bpBlocksHtml([{ type: 'text', text: note.body }])}
    <button type="button" class="preset-btn bp-share-img" data-bp-share-item="note:${escapeHtml(note.id)}">Share image</button>
  </section>`;
}

// The whole pack for a config: its selected modules and notes, in order. Each
// part has a Share image button: the part as a picture, ready for WhatsApp.
function boardPackHtml(config){
  const month = config.month;
  const renderers = boardPackRenderers();
  const parts = BoardPack.selected(config).map(it => {
    if(it.kind === 'note') return boardPackNoteHtml(it);
    const html = renderers[it.id](boardPackModuleData(it, month), month);
    return `<section class="bp-module" data-module="${it.id}"><div class="bp-module-title">${escapeHtml(BoardPack.BY_ID[it.id].title)}</div>${html}
      <button type="button" class="preset-btn bp-share-img" data-bp-share-item="${it.id}">Share image</button></section>`;
  });
  return `<div class="bp-pack">
    <div class="bp-pack-head">${escapeHtml(CLUB.name)} · ${escapeHtml(monthLabel(month))} Board Pack</div>
    ${parts.length ? parts.join('') : bpBlocksHtml([bpEmpty('Nothing selected yet.')])}
  </div>`;
}

// ---- The Admin section -----------------------------------------------------

// The stored config for the open month, or the month's default.
function boardPackBaseline(month){
  return boardPackStored[month] || BoardPack.defaultConfig(month);
}

function boardPackOpenMonth(month){
  boardPackMonth = month;
  boardPackDraft = null;
  boardPackMessage = '';
  boardPackPublishConfirm = false;
  if(boardPackStored[month] !== undefined) boardPackDraft = boardPackBaseline(month);
}

// Read the month's pack once, then draw again.
async function boardPackEnsureLoaded(){
  const month = boardPackMonth;
  if(!month || boardPackStored[month] !== undefined || boardPackLoading === month) return;
  boardPackLoading = month;
  const [raw, published] = await Promise.all([loadBoardPack(month), loadPublishedReview(month)]);
  boardPackPublished[month] = published && published.deck ? published : null;
  boardPackStored[month] = raw ? BoardPack.normalise(raw, month) : null;
  boardPackLoading = null;
  if(boardPackMonth === month){
    boardPackDraft = boardPackBaseline(month);
    if(adminOpenSections.boardpack) renderManage();
  }
}

function boardPackStatusText(){
  if(boardPackSaveTimer || boardPackSaving) return 'Saving…';
  const stored = boardPackStored[boardPackMonth];
  const saved = stored
    ? `Saved ${stored.updatedAt ? new Date(stored.updatedAt).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : ''}${stored.updatedBy ? ` by ${stored.updatedBy}` : ''}.`
    : `Not saved yet for ${monthLabel(boardPackMonth)} — showing the default selection. Changes save as you make them.`;
  const dirty = boardPackDraft && !BoardPack.sameChoice(boardPackDraft, boardPackBaseline(boardPackMonth));
  return saved + (dirty ? ' Unsaved changes.' : '');
}

// ---- Saving as you go ------------------------------------------------------
// Every change to the pack -- a module on or off, its order, an option, a
// note -- is saved a moment after it is made, without waiting for Publish
// (which only ever changes what the review link shows). Saving does not
// redraw the section, so a note being typed keeps its place.
let boardPackSaveTimer = null;
let boardPackSaving = false;

function boardPackShowStatus(){
  const el = document.getElementById('bpStatus');
  if(el) el.textContent = boardPackStatusText();
}

function boardPackQueueSave(){
  clearTimeout(boardPackSaveTimer);
  boardPackSaveTimer = setTimeout(() => { boardPackSaveTimer = null; boardPackSaveNow(); }, 600);
  boardPackShowStatus();
}

async function boardPackSaveNow(){
  clearTimeout(boardPackSaveTimer);
  boardPackSaveTimer = null;
  const month = boardPackMonth, draft = boardPackDraft;
  if(!draft || !isUnlocked || BoardPack.sameChoice(draft, boardPackBaseline(month))){ boardPackShowStatus(); return; }
  if(boardPackSaving){ boardPackQueueSave(); return; }
  boardPackSaving = true;
  boardPackShowStatus();
  const res = await saveBoardPackConfig(draft);
  boardPackSaving = false;
  if(res.ok) boardPackStored[month] = BoardPack.normalise(res.config, month);
  else { boardPackMessage = res.message; const m = document.getElementById('bpMessage'); if(m) m.textContent = res.message; }
  boardPackShowStatus();
}

function boardPackWhen(iso){
  return iso ? new Date(iso).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
}

// Draft -> Preview -> Publish (-> Unpublish). What the review link shows
// changes only here, on an explicit Publish or Unpublish; editing the pack
// never touches it.
function boardPackPublishHtml(liveDeck){
  const month = boardPackMonth;
  const pub = boardPackPublished[month];
  const live = ShareDeck.isLive(pub);
  const label = escapeHtml(monthLabel(month));
  let state;
  if(!pub){
    state = `<b>Draft.</b> The ${label} review is not published: its link shows nothing until you publish.`;
  } else if(!live){
    state = `<b>Unpublished</b> · ${escapeHtml(boardPackWhen(pub.withdrawnAt))}${pub.withdrawnBy ? ` by ${escapeHtml(pub.withdrawnBy)}` : ''}. The link now says the ${label} review is no longer available. Publishing again brings it back as revision ${pub.revision + 1}.`;
  } else {
    const same = ShareDeck.sameDeck(pub.deck, liveDeck);
    state = `<b>Published</b> · revision ${pub.revision} · ${escapeHtml(boardPackWhen(pub.publishedAt))}${pub.publishedBy ? ` by ${escapeHtml(pub.publishedBy)}` : ''}. `
      + (same ? 'The review link shows exactly this pack.'
              : '<span class="bp-publish-differs">This pack now differs from what players see. The link keeps showing the published review until you republish.</span>');
  }
  let html = `<div class="bp-publish" id="bpPublishBlock">
    <div class="section-heading" style="margin-top:14px;">Players' Monthly Review</div>
    <div class="section-sub" id="bpPublishState">${state}</div>`;
  if(boardPackPublishConfirm === 'publish'){
    html += `<div class="bp-confirm" role="group" aria-label="Confirm publishing">
      <div class="section-sub">${live ? 'Republish' : 'Publish'} the ${label} review? Anyone with the link can open it, without unlocking. What it shows is fixed until you publish again.</div>
      <div class="fg-row bp-actions">
        <button type="button" class="preset-btn active" id="bpPublishConfirm">${live ? 'Republish now' : 'Publish now'}</button>
        <button type="button" class="preset-btn" id="bpPublishCancel">Cancel</button>
      </div>
    </div>`;
  } else if(boardPackPublishConfirm === 'unpublish'){
    html += `<div class="bp-confirm" role="group" aria-label="Confirm unpublishing">
      <div class="section-sub">Unpublish the ${label} review? The link stops showing it straight away and says it is no longer available. Messages already sent in WhatsApp keep their text. Nothing is deleted: you can publish again at any time.</div>
      <div class="fg-row bp-actions">
        <button type="button" class="preset-btn active" id="bpUnpublishConfirm">Unpublish now</button>
        <button type="button" class="preset-btn" id="bpPublishCancel">Cancel</button>
      </div>
    </div>`;
  } else {
    html += `<div class="fg-row bp-actions">
      <button type="button" class="preset-btn" id="bpPublish">${live ? 'Republish review' : pub ? 'Publish again' : 'Publish review'}</button>
      ${live ? `<button type="button" class="preset-btn" id="bpUnpublish">Unpublish</button>` : ''}
    </div>`;
  }
  if(live){
    const url = boardPackReviewUrl(month);
    html += `<div class="bp-share-row">
      <a class="preset-btn" id="bpOpenReview" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open review</a>
      ${typeof navigator !== 'undefined' && navigator.share ? `<button type="button" class="preset-btn" id="bpShare">Share</button>` : ''}
      <button type="button" class="preset-btn" id="bpCopyLink">Copy link</button>
      <button type="button" class="preset-btn" id="bpCopySummary">Copy summary</button>
    </div>
    <div class="section-sub bp-review-url">${escapeHtml(url)}</div>`;
  }
  return html + `</div>`;
}

// The players' view of the draft: exactly what Publish would store.
function boardPackDeckPreviewHtml(liveDeck){
  const shown = ShareDeck.visibleSlides(liveDeck, boardPackPlayerCanSee);
  const hidden = liveDeck.slides.filter(sl => !shown.includes(sl));
  const pub = boardPackPublished[boardPackMonth];
  const when = !ShareDeck.isLive(pub) ? 'will see when you publish' : ShareDeck.sameDeck(pub.deck, liveDeck) ? 'see on the review link' : 'will see once you republish';
  return `<div class="section-sub bp-deck-note">What players ${when}: one card per selected module, in the pack's order. Empty modules are left out.${hidden.length ? ` Left out because the section is Admin only: ${hidden.map(sl => escapeHtml(sl.title)).join(', ')}.` : ''}</div>
    <div class="bp-deck-frame" id="bpDeckFrame">${DeckView.html(liveDeck, shown, { brandSrc: CLUB.logo, crownSrc: 'assets/rankings/podium-crown-laurel.png', appLink: '' })}</div>
    <div class="bp-share-row bp-deck-share">
      <button type="button" class="preset-btn" id="bpShareSlide">Share this slide</button>
      <button type="button" class="preset-btn" id="bpShareSlides">Share all slides</button>
      <button type="button" class="preset-btn" id="bpCopyDeckSummary">Copy summary</button>
    </div>
    <div class="section-sub">Pictures and the summary can be shared now, before publishing. The review link needs Publish.</div>`;
}

function boardPackOptionsHtml(it, index, cat = BoardPack){
  const def = cat.BY_ID[it.id];
  const keys = Object.keys(def.options);
  if(!keys.length) return '';
  return `<div class="bp-opts">${keys.map(k => {
    const o = def.options[k];
    return `<label class="bp-opt"><span>${escapeHtml(o.label)}</span><select class="fg-select" data-bp-opt="${index}" data-key="${k}">
      ${o.values.map(v => `<option value="${v}" ${it.options[k] === v ? 'selected' : ''}>${escapeHtml((o.labels && o.labels[v]) || v)}</option>`).join('')}
    </select></label>`;
  }).join('')}</div>`;
}

// One row of a pack's editor. `cat` is the pack's catalogue: the club's
// (BoardPack) or a player's (BoardPack.PLAYER) -- one editor for both.
function boardPackItemHtml(it, index, count, cat = BoardPack){
  const moves = `<span class="bp-move">
    <button type="button" class="preset-btn bp-move-btn" data-bp-move="${index}" data-delta="-1" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>↑</button>
    <button type="button" class="preset-btn bp-move-btn" data-bp-move="${index}" data-delta="1" aria-label="Move down" ${index === count - 1 ? 'disabled' : ''}>↓</button>
  </span>`;
  if(it.kind === 'note'){
    return `<div class="bp-item bp-item-note" data-bp-item="${index}">
      <div class="bp-item-row"><span class="bp-note-tag">${cat === BoardPack ? 'Admin commentary' : 'Admin note'}</span>${moves}</div>
      <input class="fg-select" data-bp-note-title="${index}" maxlength="${BoardPack.NOTE_TITLE_MAX}" placeholder="Title" value="${escapeHtml(it.title)}" />
      <textarea class="fg-select bp-note-input" data-bp-note-body="${index}" maxlength="${BoardPack.NOTE_BODY_MAX}" rows="3" placeholder="Your commentary">${escapeHtml(it.body)}</textarea>
      <button type="button" class="preset-btn bp-remove" data-bp-remove="${index}">Remove ${cat === BoardPack ? 'commentary' : 'note'}</button>
    </div>`;
  }
  const def = cat.BY_ID[it.id];
  if(!def){
    return `<div class="bp-item is-unknown" data-bp-item="${index}"><div class="bp-item-row"><span class="bp-dim">${escapeHtml(it.id)} — not available in this version</span>${moves}</div></div>`;
  }
  return `<div class="bp-item${it.enabled ? ' is-on' : ''}" data-bp-item="${index}" data-bp-module="${it.id}">
    <div class="bp-item-row">
      <label class="bp-check"><input type="checkbox" data-bp-toggle="${index}" ${it.enabled ? 'checked' : ''} /> <span>${escapeHtml(def.title)}</span></label>
      ${moves}
    </div>
    ${it.enabled ? boardPackOptionsHtml(it, index, cat) : ''}
  </div>`;
}

function buildBoardPackSectionHtml(){
  if(!boardPackMonth) boardPackOpenMonth(boardPackDefaultMonth());
  const months = boardPackMonths();
  let html = `<div class="section-sub">A month-end report for the board, compiled from the club's own statistics. The figures are drawn from the record every time; only your selection, order, options and commentary are saved, as you make them. Publishing turns the same pack into the players' Monthly Review — a swipeable link for WhatsApp, fixed as published. Monthly Information stays the players' month review in the app.</div>`;
  if(!boardPackMonth){
    return html + `<div class="section-sub">No months with games yet.</div>`;
  }
  // The club's pack, or one pack per player: the same month, the same
  // editor, the same deck.
  html += `<div class="fg-toggle bp-view" role="group" aria-label="Pack" style="margin:8px 0 10px;">
    <button type="button" class="fg-toggle-btn ${boardPackView === 'club' ? 'active' : ''}" id="bpViewClub" aria-pressed="${boardPackView === 'club'}">Club pack</button>
    <button type="button" class="fg-toggle-btn ${boardPackView === 'players' ? 'active' : ''}" id="bpViewPlayers" aria-pressed="${boardPackView === 'players'}">Player packs</button>
  </div>`;
  // With the preview open, the editor and the preview sit side by side on a
  // laptop or monitor (bp-split, layout/desktop.css); on a phone the
  // wrappers have no box and the preview follows the editor as before.
  const split = boardPackView === 'club' && !!boardPackDraft && boardPackPreviewOpen;
  if(split) html += `<div class="bp-split"><div class="bp-split-edit">`;
  html += `<div class="fg-controls">
    <div class="fg-row"><label class="fg-label" for="bpMonth">Month</label>
      <select id="bpMonth" class="fg-select">${months.map(m => `<option value="${m}" ${m === boardPackMonth ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
    </div>`;
  if(boardPackView === 'players') return html + buildPlayerPacksHtml() + `</div>`;
  if(!boardPackDraft){
    return html + `<div class="section-sub" id="bpLoading">Loading ${escapeHtml(monthLabel(boardPackMonth))}…</div></div>`;
  }
  const stored = boardPackStored[boardPackMonth];
  html += `<div class="section-sub" id="bpStatus">${escapeHtml(boardPackStatusText())}</div>`;
  if(stored && stored.basis){
    const now = boardPackBasis(boardPackMonth);
    if(now.fingerprint !== stored.basis.fingerprint){
      html += `<div class="bp-warn" id="bpDrift">The record for ${escapeHtml(monthLabel(boardPackMonth))} has changed since this pack was saved (${stored.basis.games} game${stored.basis.games===1?'':'s'} then, ${now.games} now, or a later correction or club decision). The figures shown are today's.</div>`;
    }
  }
  const items = boardPackDraft.items;
  html += `<div class="bp-items">${items.map((it, i) => boardPackItemHtml(it, i, items.length)).join('')}</div>
    <div class="fg-row"><button type="button" class="preset-btn" id="bpAddNote">+ Add commentary</button></div>
    <div class="fg-row bp-actions">
      <button type="button" class="preset-btn${boardPackPreviewOpen ? ' active' : ''}" id="bpPreviewBtn" aria-expanded="${boardPackPreviewOpen}">${boardPackPreviewOpen ? 'Hide preview' : 'Preview'}</button>
    </div>
    ${BoardPack.selected(boardPackDraft).length ? bpSaveAllHtml('bp', 'Board Pack') : ''}
    <div id="bpMessage" class="section-sub">${escapeHtml(boardPackMessage)}</div>
    ${boardPackShareReady ? `<div class="bp-share-ready" id="bpShareReady">
      <span>${escapeHtml(boardPackShareReady.label)} ready.</span>
      <button type="button" class="preset-btn active" id="bpShareNow">Share</button>
      <button type="button" class="preset-btn" id="bpSaveNow">Save</button>
    </div>` : ''}`;
  // Built once per drawing: the publish state compares it with what is
  // published, and the Share Deck preview draws it.
  const liveDeck = (ShareDeck.isLive(boardPackPublished[boardPackMonth]) || (boardPackPreviewOpen && boardPackPreviewMode === 'deck')) ? boardPackDeck(boardPackDraft) : null;
  html += boardPackPublishHtml(liveDeck) + `</div>`;
  if(boardPackPreviewOpen){
    html += `</div><div class="bp-split-preview">`;
    html += `<div class="fg-toggle bp-preview-mode" role="group" aria-label="Preview" style="margin:12px 0 4px;">
      <button type="button" class="fg-toggle-btn ${boardPackPreviewMode === 'pack' ? 'active' : ''}" id="bpModePack" aria-pressed="${boardPackPreviewMode === 'pack'}">Board Pack</button>
      <button type="button" class="fg-toggle-btn ${boardPackPreviewMode === 'deck' ? 'active' : ''}" id="bpModeDeck" aria-pressed="${boardPackPreviewMode === 'deck'}">Share Deck</button>
    </div>`;
    html += `<div id="bpPreview" data-mode="${boardPackPreviewMode}">${boardPackPreviewMode === 'deck' ? boardPackDeckPreviewHtml(liveDeck) : boardPackHtml(boardPackDraft)}</div>`;
    html += `</div></div>`;
  }
  return html;
}

// The editor's controls -- on/off, move, options, notes -- for whichever
// pack is open: `ed` says which (its catalogue, how to read and replace its
// config, and how it saves).
function wirePackEditor(box, ed){
  const change = (next) => { ed.set(next); renderManage(); ed.queueSave(); };
  const index = (el, attr) => Number(el.getAttribute(attr));
  box.querySelectorAll('[data-bp-toggle]').forEach(el => {
    el.onchange = () => change(ed.cat.setEnabled(ed.get(), index(el, 'data-bp-toggle'), el.checked));
  });
  box.querySelectorAll('[data-bp-move]').forEach(el => {
    el.onclick = () => change(ed.cat.move(ed.get(), index(el, 'data-bp-move'), Number(el.dataset.delta)));
  });
  box.querySelectorAll('[data-bp-opt]').forEach(el => {
    el.onchange = () => change(ed.cat.setOption(ed.get(), index(el, 'data-bp-opt'), el.dataset.key, el.value));
  });
  box.querySelectorAll('[data-bp-remove]').forEach(el => {
    el.onclick = () => change(ed.cat.removeNote(ed.get(), index(el, 'data-bp-remove')));
  });
  // Typing edits the pack without redrawing it, so the field keeps its focus;
  // the preview catches up when the field is left.
  box.querySelectorAll('[data-bp-note-title]').forEach(el => {
    el.oninput = () => { ed.set(ed.cat.updateNote(ed.get(), index(el, 'data-bp-note-title'), { title: el.value })); ed.queueSave(); };
    el.onchange = () => { if(ed.previewOpen()) renderManage(); };
  });
  box.querySelectorAll('[data-bp-note-body]').forEach(el => {
    el.oninput = () => { ed.set(ed.cat.updateNote(ed.get(), index(el, 'data-bp-note-body'), { body: el.value })); ed.queueSave(); };
    el.onchange = () => { if(ed.previewOpen()) renderManage(); };
  });
  const add = document.getElementById('bpAddNote');
  if(add) add.onclick = () => change(ed.cat.addNote(ed.get(), { id: `note-${Date.now().toString(36)}-${++boardPackNoteSeq}`, title: '', body: '' }));
}

function wireBoardPackSection(){
  const box = document.getElementById('manageView');
  if(!box || !adminOpenSections.boardpack) return;
  const viewClub = document.getElementById('bpViewClub');
  if(viewClub) viewClub.onclick = async () => { await playerPackSaveNow(); boardPackView = 'club'; renderManage(); };
  const viewPlayers = document.getElementById('bpViewPlayers');
  if(viewPlayers) viewPlayers.onclick = async () => { await boardPackSaveNow(); boardPackView = 'players'; renderManage(); };
  const monthSel = document.getElementById('bpMonth');
  // A change still waiting to be saved belongs to the month it was made in.
  if(monthSel) monthSel.onchange = async () => { const to = monthSel.value; await boardPackSaveNow(); await playerPackSaveNow(); boardPackOpenMonth(to); playerPackOpen(null); renderManage(); };
  if(boardPackView === 'players'){ wirePlayerPacks(box); return; }
  if(!boardPackDraft){ boardPackEnsureLoaded(); }
  if(!boardPackDraft) return;

  wirePackEditor(box, {
    cat: BoardPack, get: () => boardPackDraft,
    set: (next) => { boardPackDraft = next; boardPackMessage = ''; },
    queueSave: boardPackQueueSave, previewOpen: () => boardPackPreviewOpen,
  });
  const preview = document.getElementById('bpPreviewBtn');
  if(preview) preview.onclick = () => { boardPackPreviewOpen = !boardPackPreviewOpen; renderManage(); };
  const modePack = document.getElementById('bpModePack');
  if(modePack) modePack.onclick = () => { boardPackPreviewMode = 'pack'; renderManage(); };
  const modeDeck = document.getElementById('bpModeDeck');
  if(modeDeck) modeDeck.onclick = () => { boardPackPreviewMode = 'deck'; renderManage(); };
  const frame = document.getElementById('bpDeckFrame');
  boardPackDeckCtl = frame ? DeckView.mount(frame) : null;
  wireBoardPackPictures(box);

  const month = boardPackMonth;
  const say = (text) => { boardPackMessage = text; const m = document.getElementById('bpMessage'); if(m) m.textContent = text; };
  const publish = document.getElementById('bpPublish');
  if(publish) publish.onclick = () => { boardPackPublishConfirm = 'publish'; renderManage(); };
  const unpublish = document.getElementById('bpUnpublish');
  if(unpublish) unpublish.onclick = () => { boardPackPublishConfirm = 'unpublish'; renderManage(); };
  const unconfirm = document.getElementById('bpUnpublishConfirm');
  if(unconfirm) unconfirm.onclick = async () => {
    unconfirm.disabled = true;
    const res = await unpublishBoardPackReview(month);
    boardPackPublishConfirm = false;
    if(res.ok) boardPackPublished[month] = res.publication;
    boardPackMessage = res.ok ? 'Unpublished — the link no longer shows the review.' : res.message;
    renderManage();
  };
  const cancel = document.getElementById('bpPublishCancel');
  if(cancel) cancel.onclick = () => { boardPackPublishConfirm = false; renderManage(); };
  const confirm = document.getElementById('bpPublishConfirm');
  if(confirm) confirm.onclick = async () => {
    confirm.disabled = true;
    clearTimeout(boardPackSaveTimer); boardPackSaveTimer = null;
    const res = await publishBoardPackReview(boardPackDraft);
    boardPackPublishConfirm = false;
    if(res.config){
      boardPackStored[month] = BoardPack.normalise(res.config, month);
      if(boardPackMonth === month) boardPackDraft = boardPackStored[month];
    }
    if(res.ok) boardPackPublished[month] = res.publication;
    boardPackMessage = res.ok ? `Published — revision ${res.publication.revision}.` : res.message;
    renderManage();
  };
  const pub = boardPackPublished[month];
  const share = document.getElementById('bpShare');
  if(share && pub) share.onclick = () => {
    navigator.share({ title: `${CLUB.name} — ${pub.deck.title}`, text: boardPackReviewSummary(pub) }).catch(() => {});
  };
  const copyLink = document.getElementById('bpCopyLink');
  if(copyLink && pub) copyLink.onclick = () => copyText(boardPackReviewUrl(month)).then(ok => say(ok ? 'Link copied.' : 'Could not copy — the link is shown below.'));
  const copySummary = document.getElementById('bpCopySummary');
  if(copySummary && pub) copySummary.onclick = () => copyText(boardPackReviewSummary(pub)).then(ok => say(ok ? 'Summary copied — paste it into WhatsApp.' : 'Could not copy the summary.'));
}

// ---- Pictures: a module, a slide, or the whole deck ----------------------

const BOARD_PACK_IMAGES = { brand: CLUB.logo, crown: 'assets/rankings/podium-crown-laurel.png' };

async function boardPackImages(){
  const [brand, crown] = await Promise.all([CardPainter.loadImage(BOARD_PACK_IMAGES.brand), CardPainter.loadImage(BOARD_PACK_IMAGES.crown)]);
  return { brand, crown };
}

const bpSlug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The deck's pictures: the cover, then every slide players would see.
function boardPackDeckPictures(){
  const deck = boardPackDeck(boardPackDraft);
  const shown = ShareDeck.visibleSlides(deck, boardPackPlayerCanSee);
  const label = monthLabel(deck.month);
  const end = { id: 'end', kind: 'note', eyebrow: '', title: `That’s ${label.split(' ')[0]}.`, body: 'Every table, every game and your own month are in ' + CLUB.name + '.', foot: '' };
  return { deck, label, cards: [{ id: 'cover', kind: 'cover', title: label }].concat(shown, [end]) };
}

async function boardPackShare(makeCanvases, label, title){
  return boardPackShareFiles(images => Promise.all(makeCanvases(images).map(([cv, name]) => CardPainter.toFile(cv, name))), label, title);
}

// Share (or save) whatever files `makeFiles(images)` makes -- pictures or a
// PDF -- through the phone's share sheet, with the same fallbacks.
async function boardPackShareFiles(makeFiles, label, title){
  const images = await boardPackImages();
  const files = await makeFiles(images);
  const meta = { title: title || `${CLUB.name} — ${monthLabel(boardPackMonth)}` };
  const outcome = await CardPainter.share(files, meta);
  const pdf = files.every(f => f.type === 'application/pdf');
  boardPackShareReady = outcome === 'ready' ? { files, meta, label } : null;
  boardPackMessage = outcome === 'shared' ? `${label} shared.`
    : outcome === 'saved' ? (pdf ? `${label} saved to this device — it is in your downloads.` : `${label} saved to this device — post ${files.length === 1 ? 'it' : 'them'} from your photos.`)
    : outcome === 'ready' ? '' : '';
  renderManage();
}

// ---- The whole pack, saved at once ------------------------------------------
// A contents page, then every selected module and note as its picture: the
// report exactly as the preview shows it, as one PDF or as pictures.
function boardPackContentsSheet(title, month, parts){
  return { title, month: monthLabel(month), blocks: parts.length
    ? [bpSub('Contents'), { type: 'list', rows: parts.map((t, i) => ({ rank: String(i + 1), name: t, value: '' })) }]
    : [bpEmpty('Nothing selected yet.')] };
}
function boardPackAllSheets(config){
  const month = config.month;
  const items = BoardPack.selected(config);
  const sheets = items.map(it => ({ item: it, sheet: boardPackSheet(it, month) }));
  return { month, items, sheets, contents: boardPackContentsSheet('Board Pack', month, sheets.map(x => x.sheet.title)) };
}
const bpItemSlug = (it) => bpSlug(it.kind === 'note' ? (it.title || 'commentary') : it.id);

function boardPackPackPdf(config){
  const { month, sheets, contents } = boardPackAllSheets(config);
  return boardPackShareFiles(async images => [await CardPainter.toPdf([contents].concat(sheets.map(x => x.sheet)).map(sh => CardPainter.sheet(sh, images)),
    `${CLUB.fileSlug}-${month}-board-pack.pdf`, `${CLUB.name} — ${monthLabel(month)} Board Pack`)], 'Board Pack PDF');
}
function boardPackPackPictures(config){
  const { month, sheets } = boardPackAllSheets(config);
  return boardPackShare(images => sheets.map(x => [CardPainter.sheet(x.sheet, images), `${CLUB.fileSlug}-${month}-board-pack-${bpItemSlug(x.item)}.png`]), `${sheets.length} Board Pack pictures`);
}
function boardPackSlidesPdf(){
  const { cards, label } = boardPackDeckPictures();
  const month = boardPackMonth;
  return boardPackShareFiles(async images => [await CardPainter.toPdf(cards.map(c => CardPainter.slide(c, { brand: images.brand, crown: images.crown, month: label })),
    `${CLUB.fileSlug}-${month}-review-slides.pdf`, `${CLUB.name} — ${label} Review`)], 'Slides PDF');
}

// The "save the whole pack" row, for the club pack or a player's.
function bpSaveAllHtml(prefix, what){
  return `<div class="bp-save-all">
    <div class="bp-save-all-head">Save the whole ${what}</div>
    <div class="bp-share-row">
      <button type="button" class="preset-btn" id="${prefix}PackPdf">${what === 'pack' ? 'Pack' : 'Board Pack'} as PDF</button>
      <button type="button" class="preset-btn" id="${prefix}SlidesPdf">Slides as PDF</button>
      <button type="button" class="preset-btn" id="${prefix}PackPictures">All pictures</button>
    </div>
  </div>`;
}

function wireBoardPackPictures(box){
  const month = boardPackMonth;
  box.querySelectorAll('[data-bp-share-item]').forEach(el => {
    el.onclick = () => {
      const key = el.dataset.bpShareItem;
      const item = BoardPack.selected(boardPackDraft).find(it => (it.kind === 'note' ? `note:${it.id}` : it.id) === key);
      if(!item) return;
      const sheet = boardPackSheet(item, month);
      el.disabled = true;
      boardPackShare(images => [[CardPainter.sheet(sheet, images), `${CLUB.fileSlug}-${month}-board-pack-${bpSlug(item.kind === 'note' ? (item.title || 'commentary') : item.id)}.png`]], `${sheet.title} picture`);
    };
  });
  const one = document.getElementById('bpShareSlide');
  if(one) one.onclick = () => {
    const { cards } = boardPackDeckPictures();
    const i = Math.min(boardPackDeckCtl ? boardPackDeckCtl.index() : 0, cards.length - 1);
    one.disabled = true;
    boardPackShare(images => [[CardPainter.slide(cards[i], { brand: images.brand, crown: images.crown, month: monthLabel(month) }), `${CLUB.fileSlug}-${month}-review-${String(i + 1).padStart(2, '0')}-${bpSlug(cards[i].id)}.png`]], 'Slide picture');
  };
  const all = document.getElementById('bpShareSlides');
  if(all) all.onclick = () => {
    const { cards } = boardPackDeckPictures();
    all.disabled = true;
    boardPackShare(images => cards.map((c, i) => [CardPainter.slide(c, { brand: images.brand, crown: images.crown, month: monthLabel(month) }), `${CLUB.fileSlug}-${month}-review-${String(i + 1).padStart(2, '0')}-${bpSlug(c.id)}.png`]), `${cards.length} slide pictures`);
  };
  // The whole pack at once: busy until the files are ready.
  const whole = (id, run) => { const el = document.getElementById(id); if(el) el.onclick = () => { el.disabled = true; run(); }; };
  if(boardPackView === 'club'){
    whole('bpPackPdf', () => boardPackPackPdf(boardPackDraft));
    whole('bpSlidesPdf', () => boardPackSlidesPdf());
    whole('bpPackPictures', () => boardPackPackPictures(boardPackDraft));
  }
  const summary = document.getElementById('bpCopyDeckSummary');
  if(summary) summary.onclick = () => {
    const pub = boardPackPublished[month];
    const text = ShareDeck.isLive(pub) ? boardPackReviewSummary(pub) : ShareDeck.summaryText(boardPackDeck(boardPackDraft), { canSee: boardPackPlayerCanSee });
    copyText(text).then(ok => { boardPackMessage = ok ? 'Summary copied — paste it into WhatsApp.' : 'Could not copy the summary.'; const m = document.getElementById('bpMessage'); if(m) m.textContent = boardPackMessage; });
  };
  const now = document.getElementById('bpShareNow');
  if(now && boardPackShareReady) now.onclick = () => {
    const ready = boardPackShareReady;
    navigator.share(Object.assign({ files: ready.files }, ready.meta)).then(() => { boardPackShareReady = null; boardPackMessage = `${ready.label} shared.`; renderManage(); }, () => {});
  };
  const saveNow = document.getElementById('bpSaveNow');
  if(saveNow && boardPackShareReady) saveNow.onclick = () => { CardPainter.save(boardPackShareReady.files); boardPackShareReady = null; renderManage(); };
}
