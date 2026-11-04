// ===================== ADMIN: PLAYER MONTHLY PACKS (SCREEN) =====================
// Admin / Manage › Monthly Board Pack › Player packs: for the chosen month,
// Generate all makes a draft pack for every player who played; open one to
// review it, switch modules on and off, reorder them, add an Admin note,
// preview it as a report or as the player's deck, publish it to its private
// link, and share it -- the link, the summary, or pictures. The editor, the
// deck and the pictures are the club pack's own (boardPackScreen.js).
//
// Owning stream: functional. Loads before app.js; declarations only.

let ppDrafts = {};            // month -> normalised drafts
let ppLoading = null;
let ppOpenName = null;        // the player whose pack is open
let ppPublications = {};      // token -> publication, once read
let ppPreviewOpen = false;
let ppPreviewMode = 'pack';
let ppConfirm = false;        // 'publish' | 'unpublish' | false
let ppSaveTimer = null;
let ppSaving = false;
let ppDeckCtl = null;

function playerPackOpen(name){
  ppOpenName = name;
  ppConfirm = false;
  boardPackMessage = '';
}

// The open player's config: their saved draft, or the default pack.
function ppConfig(month, name){
  const d = ppDrafts[month];
  return (d && d.players[name]) || BoardPack.PLAYER.defaultConfig(month);
}

function ppSetConfig(month, name, config){
  const d = ppDrafts[month];
  d.players[name] = config;
}

async function ppEnsureLoaded(){
  const month = boardPackMonth;
  if(!month || ppDrafts[month] || ppLoading === month) return;
  ppLoading = month;
  ppDrafts[month] = await loadPlayerPackDrafts(month);
  ppLoading = null;
  if(adminOpenSections.boardpack && boardPackView === 'players') renderManage();
}

async function ppEnsurePublication(token){
  if(!token || ppPublications[token] !== undefined) return;
  ppPublications[token] = null;
  try { const v = await fsGetIn(PLAYER_PACKS_COLLECTION, token); ppPublications[token] = v ? JSON.parse(v) : null; } catch(e){ ppPublications[token] = null; }
  if(adminOpenSections.boardpack && boardPackView === 'players') renderManage();
}

// ---- Saving as you go (as the club pack does) ----------------------------
function ppShowStatus(){
  const el = document.getElementById('ppStatus');
  if(el) el.textContent = ppStatusText();
}
function ppStatusText(){
  if(ppSaveTimer || ppSaving) return 'Saving…';
  const d = ppDrafts[boardPackMonth];
  if(!d || !ppOpenName) return '';
  return d.players[ppOpenName] ? 'Draft saved — changes save as you make them.' : 'Not saved yet — showing the default pack. Changes save as you make them.';
}
function playerPackQueueSave(){
  clearTimeout(ppSaveTimer);
  ppSaveTimer = setTimeout(ppSaveDraft, 600);
  ppShowStatus();
}
// Save a change still waiting on the timer now (leaving the player or month).
async function playerPackSaveNow(){
  if(ppSaveTimer) await ppSaveDraft();
}
async function ppSaveDraft(){
  clearTimeout(ppSaveTimer);
  ppSaveTimer = null;
  const d = ppDrafts[boardPackMonth];
  if(!d) return;
  ppSaving = true; ppShowStatus();
  const res = await savePlayerPackDrafts(d);
  ppSaving = false;
  if(!res.ok){ boardPackMessage = res.message; const m = document.getElementById('bpMessage'); if(m) m.textContent = res.message; }
  ppShowStatus();
}

// ---- The report: blocks, as the club pack draws them -----------------------
const ppRec = (t) => `${t.wins}W ${t.draws}D ${t.losses}L`;
const ppMatches = (n) => `${n} match${n === 1 ? '' : 'es'}`;
const ppVs = (m) => `${m.partners.length ? `with ${m.partners.join(' & ')} ` : ''}v ${m.opponents.join(' & ')}`;
const ppScore = (sets) => (sets || []).map(s => `${s[0]}–${s[1]}`).join(' ');

function playerPackBlocks(){ return {
  overview: (d) => {
    const r = d.record;
    const rows = [];
    d.league.forEach(l => rows.push({ rank: '•', name: `League · Tier ${l.tier}`, value: `${PP_ORDINAL(l.position)} of ${l.of} · ${l.points} pts` }));
    d.merit.forEach(l => rows.push({ rank: '•', name: `Merit · Tier ${l.tier}`, value: `${PP_ORDINAL(l.position)} of ${l.of} · ${l.points} pts` }));
    d.race.forEach(x => rows.push({ rank: '•', name: `Monthly Race · Tier ${x.tier}`, value: x.qualified ? `${PP_ORDINAL(x.position)} of ${x.of} qualifiers · ${bpSigned(x.score)}` : `provisional (${ppMatches(x.played)}) · ${bpSigned(x.score)}` }));
    if(d.power) rows.push({ rank: '•', name: 'Power Rating', value: `${Math.round(d.power.start)} → ${Math.round(d.power.end)} (${bpSigned(d.power.change)})` });
    if(d.power && d.power.tierRank) rows.push({ rank: '•', name: `Tier ${d.power.tierEnd} rank at month end`, value: PP_ORDINAL(d.power.tierRank) });
    rows.push({ rank: '•', name: 'Games won – lost', value: `${r.gf} – ${r.ga} (${bpSigned(r.gd)})` });
    return [{ type: 'stats', items: [{ value: String(r.played), label: 'Played' }, { value: ppRec(r), label: 'Record' }, { value: `${r.winpct}%`, label: 'Win %' }] },
      { type: 'list', rows }, bpFoot(`League points ${d.points} (3 a win, 1 a draw). Win % counts draws as games.`)];
  },
  matchups: (d) => (d.rows.length
    ? [bpTable(['#', 'Matchup', 'P', 'W', 'D', 'L', 'Win %', 'Games'], d.rows.map((t, i) => [i + 1, t.label, t.played, t.wins, t.draws, t.losses, `${t.winpct}%`, `${t.gf}–${t.ga}`]))]
    : [bpEmpty('No matches this month.')])
    .concat([bpFoot('Your team’s tiers v theirs, each on the match’s own date (S > A > B > C). A single match is shown, but is one match, not a trend.')]),
  partners: (d) => (d.rows.length
    ? [bpTable(['#', 'Partner', 'P', 'W', 'D', 'L', 'Games', 'Chem.'], d.rows.map((t, i) => [i + 1, t.name, t.played, t.wins, t.draws, t.losses, `${t.gf}–${t.ga}`, t.chemistry === undefined ? '–' : `${bpSigned(t.chemistry)}%`]))]
    : [bpEmpty('No partners this month.')])
    .concat([bpFoot(d.strongest ? `Strongest partnership by chemistry: ${d.strongest.partner} (${bpSigned(d.strongest.chemistry)}%, ${d.strongest.decided} games). Chemistry is the Insights measure, over 2+ games together.` : 'Chemistry is the Insights measure and needs 2+ games together.')]),
  rivals: (d) => {
    const named = [['Most played', d.mostPlayed], ['Best record', d.best], ['Toughest record', d.toughest], ['Closest', d.closest]]
      .filter(([, t]) => t).map(([label, t]) => ({ rank: '•', name: `${label}: ${t.name}`, value: `${ppRec(t)} · ${ppMatches(t.played)}` }));
    return (d.rows.length ? [bpTable(['#', 'Opponent', 'P', 'W', 'D', 'L', 'Games'], d.rows.map((t, i) => [i + 1, t.name, t.played, t.wins, t.draws, t.losses, `${t.gf}–${t.ga}`]))] : [bpEmpty('No opponents this month.')])
      .concat(named.length ? [bpSub(`Head-to-head (${d.min}+ matches)`), { type: 'list', rows: named }] : [])
      .concat([bpFoot(`Best, toughest and closest are named only with ${d.min}+ matches against the same player.`)]);
  },
  best: (d) => {
    const rows = [];
    if(d.hardestWin) rows.push({ rank: '•', name: 'Hardest win', value: `${ppVs(d.hardestWin)} · ${ppScore(d.hardestWin.sets)} · ${d.hardestWin.mine} vs ${d.hardestWin.theirs} (Merit: ${d.hardestWin.merit.steps} tier-step${d.hardestWin.merit.steps === 1 ? '' : 's'})` });
    if(d.bestVsExpectation) rows.push({ rank: '•', name: 'Furthest above expectation', value: `${ppVs(d.bestVsExpectation)} · ${ppScore(d.bestVsExpectation.sets)} · performance ${bpSigned(Math.round(d.bestVsExpectation.residual * 1000) / 10)} pts` });
    if(d.biggestGain) rows.push({ rank: '•', name: 'Biggest rating gain', value: `${ppVs(d.biggestGain)} · ${bpSigned(d.biggestGain.ratingDelta)}` });
    if(d.bestShare) rows.push({ rank: '•', name: 'Best game share', value: `${ppVs(d.bestShare)} · ${ppScore(d.bestShare.sets)} · ${d.bestShare.share}%` });
    if(d.winRun) rows.push({ rank: '•', name: 'Winning run', value: `${d.winRun.length} in a row (${dayLabel(d.winRun.from)} – ${dayLabel(d.winRun.to)})` });
    return rows.length ? [{ type: 'list', rows }, bpFoot('Rating and expectation figures are the engine’s own, stored with each match.')] : [bpEmpty('No results to highlight yet.')];
  },
  weaker: (d) => {
    const rows = [];
    if(d.matchup) rows.push({ rank: '•', name: `Matchup: ${d.matchup.label}`, value: `${ppRec(d.matchup)} · ${ppMatches(d.matchup.played)}` });
    if(d.opponent) rows.push({ rank: '•', name: `Opponent: ${d.opponent.name}`, value: `${ppRec(d.opponent)} · ${ppMatches(d.opponent.played)}` });
    if(d.partner) rows.push({ rank: '•', name: `Partnership: ${d.partner.name}`, value: `${ppRec(d.partner)} · ${ppMatches(d.partner.played)}` });
    if(d.biggestDrop) rows.push({ rank: '•', name: 'Biggest rating drop', value: `${ppVs(d.biggestDrop)} · ${bpSigned(d.biggestDrop.ratingDelta)}` });
    return (rows.length ? [{ type: 'list', rows }] : [bpEmpty(`Nothing stood out over ${d.min}+ matches.`)])
      .concat([bpFoot(`Only records over ${d.min}+ matches with more losses than wins are listed: one match is not a pattern.`)]);
  },
  movement: (d) => {
    if(!d.power) return [bpEmpty('No Power Rating movement recorded.')];
    const p = d.power;
    const rows = [];
    if(p.rankStart && p.rankEnd) rows.push({ rank: '•', name: 'Overall rank', value: `#${p.rankStart} → #${p.rankEnd}` });
    if(p.tierStart || p.tierEnd) rows.push({ rank: '•', name: 'Tier', value: p.tierStart && p.tierStart !== p.tierEnd ? `${p.tierStart} → ${p.tierEnd}` : `${p.tierEnd}${p.tierRank ? ` · ${PP_ORDINAL(p.tierRank)} at month end` : ''}` });
    if(p.byDecision) rows.push({ rank: '•', name: 'By club decision', value: bpSigned(p.byDecision) });
    if(d.up) rows.push({ rank: '•', name: 'Biggest single gain', value: `${bpSigned(d.up.ratingDelta)} · ${ppVs(d.up)} · ${dayLabel(d.up.date)}` });
    if(d.down) rows.push({ rank: '•', name: 'Biggest single drop', value: `${bpSigned(d.down.ratingDelta)} · ${ppVs(d.down)} · ${dayLabel(d.down.date)}` });
    return [{ type: 'stats', items: [{ value: String(Math.round(p.start)), label: 'Start' }, { value: String(Math.round(p.end)), label: 'End' }, { value: bpSigned(p.change), label: 'Net' }] },
      { type: 'list', rows }, bpFoot('Power Rating movement only — League, Merit and Race places are in Month at a glance.')];
  },
  targets: (d) => (d.rows.length
    ? [{ type: 'list', rows: d.rows.map((t, i) => ({ rank: String(i + 1), name: t.title, value: t.reason })) }]
    : [bpEmpty('Not enough this month to suggest anything.')])
    .concat([bpFoot('Each comes from this month’s record by a fixed rule (rematch, partner, thin evidence, own tier) — what to play, never a forecast.')]),
}; }

function playerPackSheet(item, pack, config){
  if(item.kind === 'note') return { title: item.title || 'Admin note', tag: 'Admin note', month: `${pack.player} · ${pack.label}`, blocks: [{ type: 'text', text: item.body }] };
  return { title: BoardPack.PLAYER.BY_ID[item.id].title, month: `${pack.player} · ${pack.label}`, blocks: playerPackBlocks()[item.id](playerPackModuleData(item, pack, config), pack.month) };
}

function playerPackReportHtml(pack, config){
  const blocks = playerPackBlocks();
  const parts = BoardPack.PLAYER.selected(config).map(it => {
    if(it.kind === 'note') return `<section class="bp-module bp-note" data-note="${escapeHtml(it.id)}">
      <div class="bp-note-tag">Admin note</div>
      ${it.title ? `<div class="bp-module-title">${escapeHtml(it.title)}</div>` : ''}
      ${bpBlocksHtml([{ type: 'text', text: it.body }])}
      <button type="button" class="preset-btn bp-share-img" data-pp-share-item="note:${escapeHtml(it.id)}">Share image</button></section>`;
    return `<section class="bp-module" data-module="${it.id}"><div class="bp-module-title">${escapeHtml(BoardPack.PLAYER.BY_ID[it.id].title)}</div>
      ${bpBlocksHtml(blocks[it.id](playerPackModuleData(it, pack, config), pack.month))}
      <button type="button" class="preset-btn bp-share-img" data-pp-share-item="${it.id}">Share image</button></section>`;
  });
  return `<div class="bp-pack"><div class="bp-pack-head">${escapeHtml(pack.player)} · ${escapeHtml(pack.label)} · Player Pack</div>${parts.join('') || bpBlocksHtml([bpEmpty('Nothing selected.')])}</div>`;
}

// ---- The section -----------------------------------------------------------
function ppStatusLabel(d, name){
  const link = d.links[name];
  if(link) return link.withdrawn ? 'Unpublished' : `Published · rev ${link.revision}`;
  return d.players[name] ? 'Draft' : 'No draft yet';
}

function ppPublishHtml(d, name, liveDeck){
  const link = d.links[name];
  const pub = link ? ppPublications[link.token] : null;
  const live = !!link && !link.withdrawn;
  let state;
  if(!link) state = `<b>Draft.</b> Not published — it has no link until you publish.`;
  else if(!live) state = `<b>Unpublished.</b> The link says the pack is no longer available. Publishing again brings it back on the same link.`;
  else state = `<b>Published</b> · revision ${link.revision} · ${escapeHtml(boardPackWhen(link.publishedAt))}. `
    + (pub && liveDeck && !ShareDeck.sameDeck(pub.deck, liveDeck) ? '<span class="bp-publish-differs">This pack now differs from what the link shows. It keeps showing the published pack until you republish.</span>' : 'The link shows this pack.');
  let html = `<div class="bp-publish"><div class="section-heading" style="margin-top:14px;">${escapeHtml(name)}’s private link</div>
    <div class="section-sub" id="ppPublishState">${state}</div>`;
  if(ppConfirm === 'publish'){
    html += `<div class="bp-confirm"><div class="section-sub">${live ? 'Republish' : 'Publish'} ${escapeHtml(name)}’s ${escapeHtml(monthLabel(d.month))} pack? Whoever has the link can open it, without unlocking; it cannot be found by changing a name or a month in an address. What it shows is fixed until you publish again.</div>
      <div class="fg-row bp-actions"><button type="button" class="preset-btn active" id="ppPublishConfirm">${live ? 'Republish now' : 'Publish now'}</button><button type="button" class="preset-btn" id="ppCancel">Cancel</button></div></div>`;
  } else if(ppConfirm === 'unpublish'){
    html += `<div class="bp-confirm"><div class="section-sub">Unpublish ${escapeHtml(name)}’s pack? The link stops showing it straight away. Nothing is deleted; publishing again brings it back on the same link.</div>
      <div class="fg-row bp-actions"><button type="button" class="preset-btn active" id="ppUnpublishConfirm">Unpublish now</button><button type="button" class="preset-btn" id="ppCancel">Cancel</button></div></div>`;
  } else {
    html += `<div class="fg-row bp-actions"><button type="button" class="preset-btn" id="ppPublish">${live ? 'Republish pack' : link ? 'Publish again' : 'Publish pack'}</button>${live ? `<button type="button" class="preset-btn" id="ppUnpublish">Unpublish</button>` : ''}</div>`;
  }
  if(live){
    const url = playerPackUrl(link.token);
    html += `<div class="bp-share-row">
      <a class="preset-btn" id="ppOpenLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open pack</a>
      ${typeof navigator !== 'undefined' && navigator.share ? `<button type="button" class="preset-btn" id="ppShare">Share</button>` : ''}
      <button type="button" class="preset-btn" id="ppCopyLink">Copy link</button>
      <button type="button" class="preset-btn" id="ppCopySummary">Copy summary</button>
    </div><div class="section-sub bp-review-url">${escapeHtml(url)}</div>`;
  }
  return html + `</div>`;
}

function buildPlayerPacksHtml(){
  const month = boardPackMonth;
  const d = ppDrafts[month];
  let html = `<div class="section-sub">One pack per player: their month from their side — record and places, matchup types, partners, opponents, best and weaker results, movement and ideas for next month. Each published pack has its own private link, made of a random key, so one player’s pack cannot be reached by changing a name or a month in someone else’s.</div>`;
  if(!d) return html + `<div class="section-sub" id="ppLoading">Loading…</div>`;
  const players = playerPackPlayers(month);
  html += `<div id="bpMessage" class="section-sub">${escapeHtml(boardPackMessage)}</div>`;
  if(boardPackShareReady) html += `<div class="bp-share-ready" id="bpShareReady"><span>${escapeHtml(boardPackShareReady.label)} ready.</span>
      <button type="button" class="preset-btn active" id="bpShareNow">Share</button><button type="button" class="preset-btn" id="bpSaveNow">Save</button></div>`;
  if(!ppOpenName){
    const drafted = players.filter(n => d.players[n]).length;
    html += `<div class="fg-row bp-actions"><button type="button" class="preset-btn" id="ppGenerate">Generate all player packs</button></div>
      <div class="section-sub">${players.length} player${players.length === 1 ? '' : 's'} played in ${escapeHtml(monthLabel(month))} · ${drafted} with a draft. Generate all makes the rest; nothing is published.</div>
      <div class="pp-list">${players.map(n => `<button type="button" class="pp-row" data-pp-open="${escapeHtml(n)}">
        <span class="pp-name">${escapeHtml(n)}</span><span class="pp-state">${escapeHtml(ppStatusLabel(d, n))}</span></button>`).join('')}</div>`;
    return html;
  }
  const name = ppOpenName;
  const config = ppConfig(month, name);
  const pack = playerMonthlyPack(name, month);
  const link = d.links[name];
  const live = link && !link.withdrawn;
  const liveDeck = (live || (ppPreviewOpen && ppPreviewMode === 'deck')) ? playerPackDeck(name, month, config, pack) : null;
  // Editor and preview side by side on a laptop or monitor (bp-split).
  if(ppPreviewOpen) html += `<div class="bp-split"><div class="bp-split-edit">`;
  html += `<div class="pp-head"><button type="button" class="preset-btn" id="ppBack">‹ All players</button>
    <span class="pp-title">${escapeHtml(name)} · ${escapeHtml(monthLabel(month))}</span></div>
    <div class="section-sub" id="ppStatus">${escapeHtml(ppStatusText())}</div>
    <div class="section-sub">${ppMatches(pack.model.record.played)} · ${ppRec(pack.model.record)}</div>
    <div class="bp-items">${config.items.map((it, i) => boardPackItemHtml(it, i, config.items.length, BoardPack.PLAYER)).join('')}</div>
    <div class="fg-row"><button type="button" class="preset-btn" id="bpAddNote">+ Add Admin note</button></div>
    <div class="fg-row bp-actions"><button type="button" class="preset-btn${ppPreviewOpen ? ' active' : ''}" id="ppPreviewBtn" aria-expanded="${ppPreviewOpen}">${ppPreviewOpen ? 'Hide preview' : 'Preview'}</button></div>
    ${BoardPack.PLAYER.selected(config).length ? bpSaveAllHtml('pp', 'pack') : ''}`;
  html += ppPublishHtml(d, name, liveDeck);
  if(ppPreviewOpen){
    html += `</div><div class="bp-split-preview">`;
    html += `<div class="fg-toggle bp-preview-mode" role="group" aria-label="Preview" style="margin:12px 0 4px;">
      <button type="button" class="fg-toggle-btn ${ppPreviewMode === 'pack' ? 'active' : ''}" id="ppModePack" aria-pressed="${ppPreviewMode === 'pack'}">Pack</button>
      <button type="button" class="fg-toggle-btn ${ppPreviewMode === 'deck' ? 'active' : ''}" id="ppModeDeck" aria-pressed="${ppPreviewMode === 'deck'}">Share Deck</button>
    </div>`;
    if(ppPreviewMode === 'deck'){
      const shown = ShareDeck.visibleSlides(liveDeck, boardPackPlayerCanSee);
      html += `<div id="ppPreview" data-mode="deck"><div class="bp-deck-frame" id="ppDeckFrame">${DeckView.html(liveDeck, shown, { brandSrc: CLUB.logo, crownSrc: 'assets/rankings/podium-crown-laurel.png', appLink: '' })}</div>
        <div class="bp-share-row bp-deck-share">
          <button type="button" class="preset-btn" id="ppShareSlide">Share this slide</button>
          <button type="button" class="preset-btn" id="ppShareSlides">Share all slides</button>
          <button type="button" class="preset-btn" id="ppCopyDeckSummary">Copy summary</button>
        </div><div class="section-sub">Pictures and the summary can be shared now, before publishing. The private link needs Publish.</div></div>`;
    } else {
      html += `<div id="ppPreview" data-mode="pack">${playerPackReportHtml(pack, config)}</div>`;
    }
    html += `</div></div>`;
  }
  return html;
}

// The deck's pictures: the player's cover, their slides, the closing card.
function ppDeckPictures(name, month){
  const deck = playerPackDeck(name, month, ppConfig(month, name));
  const shown = ShareDeck.visibleSlides(deck, boardPackPlayerCanSee);
  return { deck, cards: [{ id: 'cover', kind: 'cover', title: deck.cover.title, sub: deck.cover.sub }].concat(shown, [{ id: 'end', kind: 'note', eyebrow: '', title: deck.closing.title, body: deck.closing.text, foot: '' }]) };
}

function wirePlayerPacks(box){
  const month = boardPackMonth;
  if(!ppDrafts[month]){ ppEnsureLoaded(); return; }
  const d = ppDrafts[month];
  const gen = document.getElementById('ppGenerate');
  if(gen) gen.onclick = async () => {
    gen.disabled = true;
    const { drafts, added } = generateAllPlayerPacks(ppDrafts[month], month);
    const res = await savePlayerPackDrafts(drafts);
    if(res.ok){ ppDrafts[month] = drafts; boardPackMessage = added.length ? `Drafts made for ${added.length} player${added.length === 1 ? '' : 's'}. Nothing is published.` : 'Every player already has a draft.'; }
    else boardPackMessage = res.message;
    renderManage();
  };
  box.querySelectorAll('[data-pp-open]').forEach(el => { el.onclick = () => { playerPackOpen(el.dataset.ppOpen); ppPreviewOpen = false; renderManage(); }; });
  wireBoardPackPictures(box);   // the "ready to share" bar
  if(!ppOpenName) return;

  const name = ppOpenName;
  const link = d.links[name];
  if(link) ppEnsurePublication(link.token);
  const back = document.getElementById('ppBack');
  if(back) back.onclick = async () => { await playerPackSaveNow(); playerPackOpen(null); renderManage(); };
  wirePackEditor(box, {
    cat: BoardPack.PLAYER, get: () => ppConfig(month, name),
    set: (next) => { ppSetConfig(month, name, next); boardPackMessage = ''; },
    queueSave: playerPackQueueSave, previewOpen: () => ppPreviewOpen,
  });
  const preview = document.getElementById('ppPreviewBtn');
  if(preview) preview.onclick = () => { ppPreviewOpen = !ppPreviewOpen; renderManage(); };
  const mp = document.getElementById('ppModePack');
  if(mp) mp.onclick = () => { ppPreviewMode = 'pack'; renderManage(); };
  const md = document.getElementById('ppModeDeck');
  if(md) md.onclick = () => { ppPreviewMode = 'deck'; renderManage(); };
  const frame = document.getElementById('ppDeckFrame');
  ppDeckCtl = frame ? DeckView.mount(frame) : null;

  const say = (text) => { boardPackMessage = text; const m = document.getElementById('bpMessage'); if(m) m.textContent = text; };
  const on = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
  on('ppPublish', () => { ppConfirm = 'publish'; renderManage(); });
  on('ppUnpublish', () => { ppConfirm = 'unpublish'; renderManage(); });
  on('ppCancel', () => { ppConfirm = false; renderManage(); });
  on('ppPublishConfirm', async () => {
    clearTimeout(ppSaveTimer); ppSaveTimer = null;
    const res = await publishPlayerPack(ppDrafts[month], name);
    ppConfirm = false;
    if(res.ok){ ppDrafts[month] = res.drafts; ppPublications[res.publication.token] = res.publication; boardPackMessage = `Published — revision ${res.publication.revision}.`; }
    else boardPackMessage = res.message;
    renderManage();
  });
  on('ppUnpublishConfirm', async () => {
    const res = await unpublishPlayerPack(ppDrafts[month], name);
    ppConfirm = false;
    if(res.ok){ ppDrafts[month] = res.drafts; ppPublications[res.publication.token] = res.publication; boardPackMessage = 'Unpublished — the link no longer shows the pack.'; }
    else boardPackMessage = res.message;
    renderManage();
  });
  const pub = link ? ppPublications[link.token] : null;
  const summaryOf = () => pub ? ShareDeck.summaryText(pub.deck, { link: playerPackUrl(link.token), canSee: boardPackPlayerCanSee }) : '';
  on('ppShare', () => { if(pub) navigator.share({ title: pub.deck.title, text: summaryOf() }).catch(() => {}); });
  on('ppCopyLink', () => copyText(playerPackUrl(link.token)).then(ok => say(ok ? 'Link copied.' : 'Could not copy — the link is shown below.')));
  on('ppCopySummary', () => copyText(summaryOf()).then(ok => say(ok ? 'Summary copied — paste it into WhatsApp.' : 'Could not copy the summary.')));
  on('ppCopyDeckSummary', () => {
    const text = (link && !link.withdrawn && pub) ? summaryOf() : ShareDeck.summaryText(playerPackDeck(name, month, ppConfig(month, name)), { canSee: boardPackPlayerCanSee });
    copyText(text).then(ok => say(ok ? 'Summary copied — paste it into WhatsApp.' : 'Could not copy the summary.'));
  });

  const slug = bpSlug(name);
  const title = `${name} — ${monthLabel(month)}`;
  on('ppShareSlide', () => {
    const { cards } = ppDeckPictures(name, month);
    const i = Math.min(ppDeckCtl ? ppDeckCtl.index() : 0, cards.length - 1);
    boardPackShare(images => [[CardPainter.slide(cards[i], { brand: images.brand, crown: images.crown, month: monthLabel(month) }), `${CLUB.fileSlug}-${month}-${slug}-${String(i + 1).padStart(2, '0')}-${bpSlug(cards[i].id)}.png`]], 'Slide picture', title);
  });
  on('ppShareSlides', () => {
    const { cards } = ppDeckPictures(name, month);
    boardPackShare(images => cards.map((c, i) => [CardPainter.slide(c, { brand: images.brand, crown: images.crown, month: monthLabel(month) }), `${CLUB.fileSlug}-${month}-${slug}-${String(i + 1).padStart(2, '0')}-${bpSlug(c.id)}.png`]), `${cards.length} slide pictures`, title);
  });
  // The whole pack at once: a contents page and every module, as one PDF or
  // as pictures; or every slide as one PDF.
  const allSheets = () => {
    const config = ppConfig(month, name);
    const pack = playerMonthlyPack(name, month);
    const items = BoardPack.PLAYER.selected(config);
    const sheets = items.map(it => ({ item: it, sheet: playerPackSheet(it, pack, config) }));
    return { sheets, contents: boardPackContentsSheet(`${name} — Monthly Pack`, month, sheets.map(x => x.sheet.title)) };
  };
  const whole = (id, run) => { const el = document.getElementById(id); if(el) el.onclick = () => { el.disabled = true; run(); }; };
  whole('ppPackPdf', () => {
    const { sheets, contents } = allSheets();
    boardPackShareFiles(async images => [await CardPainter.toPdf([contents].concat(sheets.map(x => x.sheet)).map(sh => CardPainter.sheet(sh, images)),
      `${CLUB.fileSlug}-${month}-${slug}-pack.pdf`, `${title} Monthly Pack`)], 'Pack PDF', title);
  });
  whole('ppSlidesPdf', () => {
    const { cards } = ppDeckPictures(name, month);
    boardPackShareFiles(async images => [await CardPainter.toPdf(cards.map(c => CardPainter.slide(c, { brand: images.brand, crown: images.crown, month: monthLabel(month) })),
      `${CLUB.fileSlug}-${month}-${slug}-slides.pdf`, `${title} slides`)], 'Slides PDF', title);
  });
  whole('ppPackPictures', () => {
    const { sheets } = allSheets();
    boardPackShare(images => sheets.map(x => [CardPainter.sheet(x.sheet, images), `${CLUB.fileSlug}-${month}-${slug}-${bpSlug(x.item.kind === 'note' ? 'note' : x.item.id)}.png`]), `${sheets.length} pack pictures`, title);
  });

  box.querySelectorAll('[data-pp-share-item]').forEach(el => {
    el.onclick = () => {
      const key = el.dataset.ppShareItem;
      const config = ppConfig(month, name);
      const item = BoardPack.PLAYER.selected(config).find(it => (it.kind === 'note' ? `note:${it.id}` : it.id) === key);
      if(!item) return;
      el.disabled = true;
      const sheet = playerPackSheet(item, playerMonthlyPack(name, month), config);
      boardPackShare(images => [[CardPainter.sheet(sheet, images), `${CLUB.fileSlug}-${month}-${slug}-${bpSlug(item.kind === 'note' ? 'note' : item.id)}.png`]], `${sheet.title} picture`, title);
    };
  });
}
