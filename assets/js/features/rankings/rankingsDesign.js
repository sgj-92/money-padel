// ===================== RANKINGS, FROM THE CLAUDE DESIGN CANVAS =====================
// Shaun, 24 Nov: "a complete re-design of the rankings page from claude
// design" -- then, of the canvas: "i like it and it looks a lot cleaner."
// (Canvas: Rankings Redesign. This file is screens 1, 3 and 4 of it; the
// Quarter race screen follows.)
//
//   Power      "Rankings" with the period as a chip beside it; Your standing
//              (your place, rating, change, form, the gap to the next one up
//              and a Challenge); tier pills; the leaderboard with a heading
//              per tier, medal rings for the top three and your row lit;
//              who isn't ranked yet and why; the honours as two tiles.
//   Stats      what More tables held, as cards: rank the club by Form,
//              Clutch, Upsets or Win / Loss; Insights, Doughnuts, the Roll
//              of honour; How ratings work.
//   A player   tapped: a card with their figures, the gap to you, your head
//              to head, and Request a game / Compare / Full profile.
//
// Declarations only. The render hooks in shell.js call renderRankingsLeaders().

let powerRowsOverall = [];   // the Power list as last drawn on All tiers
const powerDeltaShown = {};  // name -> the period's rating change drawn on the row

const RK_MEDAL = ['var(--kings-a-bright)', 'var(--kings-b-bright)', 'var(--kings-c-bright)'];
const RK_TIER_ORDER = ['S', 'A', 'B', 'C'];

function rkBasis(p){ return selectedMonth !== 'all' ? (p.month_rating ?? null) : p.rating; }
function rkNoun(){ return (CLUB.period && CLUB.period.noun) || 'month'; }
function rkSigned(n){ return n > 0 ? `▲ ${Math.abs(Math.round(n))}` : n < 0 ? `▼ ${Math.abs(Math.round(n))}` : '0'; }
function rkForm(name, n){
  const r = PlayerForm.recent(getAllApprovedMatches(), name, n || 5);
  return r ? r.run : [];
}
function rkFormSquaresHtml(run, n){
  const k = n || 5;
  const cells = Array.from({ length: k }, (_, i) => run[i - (k - run.length)]);
  const word = { W: 'win', L: 'loss', D: 'draw' };
  return `<span class="rk2-form" aria-label="Last ${run.length}: ${run.map(x => word[x] || x).join(', ') || 'none'}">${cells.map(x => `<i class="rk2-f ${x === 'W' ? 'is-w' : x === 'L' ? 'is-l' : x === 'D' ? 'is-d' : 'is-none'}"></i>`).join('')}</span>`;
}
// The period's race, all tiers: [{ playerId, score, qualified, ... }].
function rkRace(){
  const period = rankingsLeaderPeriod();
  try {
    if(period && typeof buildMonthlyRace === 'function') return MonthlyRace.overall(buildMonthlyRace(period).table, raceMinMatches());
  } catch(e){ /* no race to show */ }
  return [];
}
function rkViewerName(){
  const v = typeof getCurrentViewer === 'function' ? getCurrentViewer() : null;
  return v ? v.name : null;
}

// ---- Your standing ------------------------------------------------------------
function rkStandingHtml(){
  const me = rkViewerName();
  if(!me) return '';
  const list = powerRowsOverall || [];
  const i = list.findIndex(p => p.name === me);
  const p = PLAYERS.find(x => x.name === me);
  if(i < 0){
    if(!p) return '';
    return `<section class="rk2-standing" aria-label="Your standing">
      <div class="rk2-st-head"><span class="rk2-eyebrow">Your standing</span><span class="rk2-st-tier">Tier ${escapeHtml(p.tier)}</span></div>
      <div class="rk2-st-none">Not ranked yet: that takes ${escapeHtml(PlayerState.thresholdText())}.</div>
      ${canSeeTab('wishlist') ? `<div class="rk2-st-foot"><span></span><button type="button" class="rk2-link" data-rk-challenge="">Find a game ›</button></div>` : ''}
    </section>`;
  }
  const row = list[i], above = list[i - 1] || null;
  const basis = rkBasis(row);
  const delta = powerDeltaShown[me];
  const gap = above && rkBasis(above) !== null && basis !== null ? Math.round(rkBasis(above) - basis) : null;
  const run = rkForm(me, 5);
  return `<section class="rk2-standing" aria-label="Your standing">
    <div class="rk2-st-head"><span class="rk2-eyebrow">Your standing</span><span class="rk2-st-tier">Tier ${escapeHtml(tierInScope(row) || row.tier)}</span></div>
    <div class="rk2-st-main">
      <div class="rk2-st-pos">#${i + 1}</div>
      <div class="rk2-st-figs">
        <span class="rk2-st-rating">${basis === null ? '–' : Math.round(basis)}</span>
        ${delta === null || delta === undefined ? '' : `<span class="rk2-st-delta ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}">${rkSigned(delta)} this ${rkNoun()}</span>`}
      </div>
      ${rkFormSquaresHtml(run, run.length || 4)}
    </div>
    <div class="rk2-st-foot">
      <span>${above ? `<b>${gap} pt${gap === 1 ? '' : 's'}</b> to pass ${escapeHtml(above.name)} for #${i}` : '<b>Top of the board.</b>'}</span>
      ${above && canSeeTab('wishlist') ? `<button type="button" class="rk2-link" data-rk-challenge="${escapeHtml(above.name)}">Challenge ›</button>` : ''}
    </div>
  </section>`;
}

// ---- Tier pills ---------------------------------------------------------------
function rkTierPillsHtml(){
  const list = powerRowsOverall || [];
  const count = (t) => t === 'All' ? list.length : list.filter(p => (tierInScope(p) || p.tier) === t).length;
  // Only tiers with someone in them (and the one chosen, so it can be unchosen).
  const tiers = ['All'].concat(RK_TIER_ORDER.filter(t => [...document.querySelectorAll('#tierbar .tierbtn')].some(b => b.dataset.tier === t) && (count(t) > 0 || activeTier === t)));
  return `<div class="rk2-tiers" role="group" aria-label="Tier">${tiers.map(t => `<button type="button" class="rk2-tier${activeTier === t ? ' is-on' : ''}" data-rk-tier="${t}" aria-pressed="${activeTier === t}">${t === 'All' ? 'All tiers' : t}<span class="rk2-tier-n">${count(t)}</span></button>`).join('')}</div>`;
}

// ---- Not ranked yet ------------------------------------------------------------
function rkUnrankedHtml(){
  if(includeIdle || selectedMonth !== 'all') return '';
  const shown = new Set((powerRowsOverall || []).map(p => p.name));
  const names = PLAYERS.filter(p => {
    const st = playerStateOf(p.name);
    return st && !st.archived && st.participation !== 'INACTIVE' && st.ranking !== 'RANKED' && !shown.has(p.name);
  }).map(p => p.name);
  if(!names.length) return '';
  return `<section class="rk2-unranked" aria-label="Not ranked yet">
    <div class="rk2-unr-title">${names.length} player${names.length === 1 ? '' : 's'} not ranked yet</div>
    <div class="rk2-unr-text">${names.map(escapeHtml).join(', ')} · ${escapeHtml(PlayerState.thresholdText())} puts you on the board.</div>
    <button type="button" class="rk2-link" data-rk-show-idle>Show them in the list ›</button>
  </section>`;
}

// ---- The honours, as tiles -------------------------------------------------------
function renderRankingsHonours(){
  ['kingsOfTiersPanel', 'monthlyChampionsPanel'].forEach(id => { const el = document.getElementById(id); if(el) el.remove(); });
  let box = document.getElementById('rankingsHonours');
  const list = document.getElementById('list');
  if(activeTab !== 'power' || !list || !DATA_READY){ if(box) box.remove(); return; }
  const kings = computeKingsOfTiers();
  const tiles = [];
  // The tiers the club shows (a hidden Tier S has no tile).
  if(kings) (typeof groupedTiers === 'function' ? groupedTiers() : RK_TIER_ORDER).forEach(t => {
    const k = kings[t];
    if(k) tiles.push(`<button type="button" class="rk2-tile" data-rk-king="${t.toLowerCase()}" data-rk-player="${escapeHtml(k.name)}">
      <span class="rk2-tile-label is-gold">King of Tier ${t}</span><span class="rk2-tile-name">${escapeHtml(k.name)}</span><span class="rk2-tile-sub">${Math.round(k.rating)} power</span></button>`);
  });
  const lead = rkRace().find(r => r.qualified);
  if(lead) tiles.push(`<button type="button" class="rk2-tile" data-rk-race>
      <span class="rk2-tile-label">Leading the ${rkNoun()}</span><span class="rk2-tile-name">${escapeHtml(lead.playerId)}</span><span class="rk2-tile-sub">${escapeHtml(raceWholePoints(lead.score))} race points ›</span></button>`);
  if(!tiles.length){ if(box) box.remove(); return; }
  if(!box){ box = document.createElement('section'); box.id = 'rankingsHonours'; box.className = 'rk2-honours'; box.setAttribute('aria-label', 'Honours'); }
  box.innerHTML = tiles.join('');
  const unr = document.getElementById('rankingsUnranked');
  const notes = document.getElementById('rankingsPeriodNotes');
  const empty = document.getElementById('empty');
  const after = [list, notes, empty, unr].filter(el => el && el.parentNode === list.parentNode)
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1).pop();
  after.insertAdjacentElement('afterend', box);
  box.querySelectorAll('[data-rk-player]').forEach(b => { b.onclick = () => openRankQuickSheet(b.dataset.rkPlayer); });
  box.querySelectorAll('[data-rk-race]').forEach(b => { b.onclick = () => openMonthlyRaceFor(rankingsLeaderPeriod()); });
}

// ---- Putting the Power screen together ------------------------------------------
function rkPlace(id, html, anchor, where){
  let el = document.getElementById(id);
  if(!html){ if(el) el.remove(); return null; }
  if(!el){ el = document.createElement('div'); el.id = id; }
  el.innerHTML = html;
  if(anchor) anchor.insertAdjacentElement(where || 'beforebegin', el);
  return el;
}

function renderRankingsLeaders(){
  const list = document.getElementById('list');
  const hero = document.getElementById('rankingsHero');
  const toolbar = document.getElementById('rankingsToolbar');
  const power = activeTab === 'power' && !!list && typeof DATA_READY !== 'undefined' && DATA_READY;
  // The period chip and Filters sit beside the title on Power; on Win / Loss
  // the bar goes back where it was, under the tabs.
  if(toolbar && hero){
    const bar = hero.querySelector('.rk2-titlebar');
    if(power && bar && toolbar.parentNode !== bar) bar.appendChild(toolbar);
    if(!power && toolbar.parentNode === bar){
      const controls = document.querySelector('.controls');
      const tabrow = document.getElementById('tabrow');
      if(controls && tabrow) controls.insertBefore(toolbar, tabrow.nextSibling);
    }
    toolbar.classList.toggle('rk2-inbar', power);
  }
  ['rankingsLeaders', 'rankingsBoardHead'].forEach(id => { const el = document.getElementById(id); if(el) el.remove(); });
  if(!power){
    ['rankingsStanding', 'rankingsTierPills', 'rankingsBoard', 'rankingsUnranked'].forEach(id => { const el = document.getElementById(id); if(el) el.remove(); });
    const notes = document.getElementById('rankingsPeriodNotes');
    if(notes) notes.style.display = 'none';
    renderRankingsHonours();
    return;
  }
  const notes = document.getElementById('rankingsPeriodNotes');
  if(notes) notes.style.display = '';
  const header = document.getElementById('rankingsColumnHeader');
  const anchor = header || list;
  rkPlace('rankingsStanding', rkStandingHtml(), anchor);
  rkPlace('rankingsTierPills', rkTierPillsHtml(), anchor);
  const sortName = { recent_form: 'Form', avg_overperf_pct: 'Clutch', upset_total: 'Upsets', avg_match_strength: 'Avg opposition', month_rating: 'Month rating', name: 'A–Z' }[activeSortP];
  rkPlace('rankingsBoard', `<div class="rk2-board-head">
      <h2 class="rk2-board-title">${sortName ? `Ranked by ${escapeHtml(sortName)}` : 'Leaderboard'}</h2>
      ${sortName ? `<button type="button" class="rk2-link" data-rk-sort="rating">Back to rating ×</button>`
        : `<button type="button" class="rk2-link rk2-how" data-rk-how>How ratings work <span class="rk-info" aria-hidden="true">i</span></button>`}
    </div>`, anchor);
  rkPlace('rankingsUnranked', rkUnrankedHtml(), null);
  const unr = document.getElementById('rankingsUnranked');
  if(unr){
    const after = [list, notes, document.getElementById('empty')].filter(el => el && el.parentNode === list.parentNode)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1).pop();
    if(unr.previousElementSibling !== after) after.insertAdjacentElement('afterend', unr);
  }
  renderRankingsHonours();
  rkWire();
}

function rkWire(){
  document.querySelectorAll('[data-rk-tier]').forEach(b => {
    b.onclick = () => { const t = document.querySelector(`#tierbar .tierbtn[data-tier="${b.dataset.rkTier}"]`); if(t) t.click(); const sel = document.getElementById('tierSelectCompact'); if(sel) sel.value = activeTier; };
  });
  document.querySelectorAll('[data-rk-challenge]').forEach(b => {
    b.onclick = () => {
      const me = rkViewerName(), them = b.dataset.rkChallenge;
      if(them) openArrangeGame('request', { names: [me, '', them, ''], date: '', time: '', venue: '' });
      else openArrangeGame();
    };
  });
  document.querySelectorAll('[data-rk-show-idle]').forEach(b => { b.onclick = () => { const t = document.querySelector('#stateFilterRow [data-toggle="idle"]'); if(t) t.click(); else { includeIdle = true; render(); } }; });
  document.querySelectorAll('[data-rk-how]').forEach(b => { b.onclick = () => { if(typeof openPowerRatingGuide === 'function') openPowerRatingGuide(); }; });
  document.querySelectorAll('[data-rk-sort]').forEach(b => { b.onclick = () => rkSortBy(b.dataset.rkSort); });
}

// Sort the Power list by a lens, through its own sort buttons (in Filters).
function rkSortBy(key){
  const b = document.querySelector(`#sortbarPower [data-sortp="${key}"]`);
  if(b) b.click();
  if(typeof syncRankingsFilterDot === 'function') syncRankingsFilterDot();
}

// ---- Stats (what More tables held) ----------------------------------------------
function rankingsStatsHtml(){
  const card = (attrs, icon, title, sub) => `<button type="button" class="rk2-stat-card" ${attrs}>${icon}<span class="rk2-stat-title">${title}</span><span class="rk2-stat-sub">${sub}</span></button>`;
  const ico = (d) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const lenses = [
    card('data-rk-lens="recent_form"', ico('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'), 'Form', 'Who’s winning lately'),
    card('data-rk-lens="avg_overperf_pct"', ico('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'), 'Clutch', 'Beating expectation'),
    card('data-rk-lens="upset_total"', ico('<path d="M13 3L4 14h7l-1 7 9-11h-7z"/>'), 'Upsets', 'Wins as the underdog'),
  ];
  if(canSeeTab('wl')) lenses.push(card('data-tab="wl"', ico('<path d="M5 20V10M12 20V4M19 20v-7"/>'), 'Win / Loss', 'Records and win rates'));
  const stories = rankingsMoreTablesVisible().filter(it => it.tab !== 'wl')
    .map(it => mpListRowHtml({ label: it.label, meta: it.special === 'doughnuts' ? 'Every 6–0, given and taken' : '', data: it.tab ? { tab: it.tab } : { special: it.special } }));
  stories.push(mpListRowHtml({ label: 'Roll of honour', meta: `Champions, ${rkNoun()} by ${rkNoun()}`, data: { special: 'honours' } }));
  return `<h3>Stats</h3>
    <div class="rk2-stats-label">Rank the club by</div>
    <div class="rk2-stats-grid">${lenses.join('')}</div>
    <div class="rk2-stats-label">Stories</div>
    <div class="shell-list">${stories.join('')}</div>
    <button type="button" class="rk2-how-card" data-rk-how>${ico('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>')}<span><b>How ratings work</b><span>Tiers, scorelines and expectation</span></span></button>`;
}

function wireRankingsStats(sheet){
  const close = () => sheet.classList.remove('show');
  sheet.querySelectorAll('[data-rk-lens]').forEach(b => {
    b.onclick = () => {
      close();
      const lens = b.dataset.rkLens;
      if(activeTab !== 'power'){ const t = legacyTabBtn('power'); if(t) t.click(); }
      rkSortBy(lens);
    };
  });
  sheet.querySelectorAll('.rk2-stat-card[data-tab], .mp-list-row').forEach(row => {
    row.onclick = () => {
      close();
      if(row.dataset.special === 'honours'){ const t = legacyTabBtn('summary'); if(t) t.click(); summaryMode = 'honours'; renderSummary(); }
      else if(row.dataset.special === 'northsouth') openNorthSouth();
      else if(row.dataset.special === 'doughnuts') openDoughnutLeaderboard();
      else if(row.dataset.tab === 'callouts') openInsightsFromTop();
      else { const t = legacyTabBtn(row.dataset.tab); if(t) t.click(); }
    };
  });
  sheet.querySelectorAll('[data-rk-how]').forEach(b => { b.onclick = () => { close(); if(typeof openPowerRatingGuide === 'function') openPowerRatingGuide(); }; });
}

// ---- A player, tapped ---------------------------------------------------------------
function openRankQuickSheet(name){
  const p = PLAYERS.find(x => x.name === name);
  if(!p) return;
  let sheet = document.getElementById('rankQuickSheet');
  if(!sheet){
    sheet = document.createElement('div');
    sheet.className = 'shell-more-sheet';
    sheet.id = 'rankQuickSheet';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if(e.target === sheet) sheet.classList.remove('show'); });
  }
  const list = powerRowsOverall || [];
  const i = list.findIndex(x => x.name === name);
  const row = i >= 0 ? list[i] : p;
  const tier = tierInScope(row) || p.tier;
  const inTier = list.filter(x => (tierInScope(x) || x.tier) === tier);
  const ti = inTier.findIndex(x => x.name === name);
  const basis = rkBasis(row);
  const delta = powerDeltaShown[name];
  const race = rkRace().find(r => r.playerId === name);
  const run = rkForm(name, 5);
  const me = rkViewerName();
  let you = '';
  if(me && me !== name){
    const mine = list.find(x => x.name === me);
    const gap = mine && basis !== null && rkBasis(mine) !== null ? Math.round(basis - rkBasis(mine)) : null;
    const h = getHeadToHeadRecord(me, name);
    const h2hText = !h.total ? 'Not met as opponents yet' : h.aWins > h.bWins ? `You lead ${h.aWins}–${h.bWins}${h.draws ? ` (${h.draws} drawn)` : ''}` : h.aWins < h.bWins ? `${escapeHtml(name)} leads ${h.bWins}–${h.aWins}${h.draws ? ` (${h.draws} drawn)` : ''}` : `Level ${h.aWins}–${h.bWins}${h.draws ? ` (${h.draws} drawn)` : ''}`;
    you = `<div class="rkq-you">
      <span class="rk2-eyebrow">You and ${escapeHtml(name)}</span>
      ${gap === null ? '' : `<span class="rkq-gap">${gap === 0 ? 'Level on rating with you' : `${escapeHtml(name)} is <b>${Math.abs(gap)} pts</b> ${gap > 0 ? 'above' : 'below'} you`}</span>`}
      <span class="rkq-h2h">Head to head: ${h2hText}</span>
    </div>`;
  }
  const word = { W: 'W', L: 'L', D: 'D' };
  sheet.innerHTML = `<div class="shell-more-panel rkq-panel" role="dialog" aria-label="${escapeHtml(name)}">
    <div class="rkq-head">
      <div class="rkq-avatar${i >= 0 && i < 3 ? ` is-medal-${i + 1}` : ''}" aria-hidden="true">${escapeHtml(name.slice(0, 1))}</div>
      <div class="rkq-who"><span class="rkq-name">${escapeHtml(name)}</span>
        <span class="rkq-sub">${i >= 0 ? `#${i + 1} overall · #${ti + 1} in Tier ${escapeHtml(tier)}` : `Tier ${escapeHtml(tier)} · not ranked`}</span></div>
      <button type="button" class="mp-sheet-close rkq-close" aria-label="Close">×</button>
    </div>
    <div class="rkq-figs">
      <div><b>${basis === null ? '–' : Math.round(basis)}</b><span>Power</span></div>
      <div><b class="${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}">${delta === null || delta === undefined ? '–' : rkSigned(delta)}</b><span>This ${rkNoun()}</span></div>
      <div><b class="is-accent">${race ? escapeHtml(raceWholePoints(race.score)) : '–'}</b><span>Race</span></div>
    </div>
    ${run.length ? `<div class="rkq-form"><span class="rk2-eyebrow">Recent form</span><span class="rkq-chips">${run.map(x => `<span class="rkq-chip ${x === 'W' ? 'is-w' : x === 'L' ? 'is-l' : 'is-d'}">${word[x] || x}</span>`).join('')}</span></div>` : ''}
    ${you}
    <div class="rkq-actions">
      ${me && me !== name && canSeeTab('wishlist') ? `<button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent rkq-request">Request a game</button>` : ''}
      ${canSeeTab('h2h') ? `<button type="button" class="preset-btn rkq-compare">Compare</button>` : ''}
    </div>
    <button type="button" class="rk2-link rkq-profile">Full profile ›</button>
  </div>`;
  const close = () => sheet.classList.remove('show');
  sheet.querySelector('.rkq-close').onclick = close;
  const req = sheet.querySelector('.rkq-request');
  if(req) req.onclick = () => { close(); openArrangeGame('request', { names: [me, '', name, ''], date: '', time: '', venue: '' }); };
  const cmp = sheet.querySelector('.rkq-compare');
  if(cmp) cmp.onclick = () => {
    close();
    h2hPlayerA = me && me !== name ? me : name;
    h2hPlayerB = me && me !== name ? name : (typeof H2H_EVERYONE !== 'undefined' ? H2H_EVERYONE : null);
    goToSection('players');
    const t = legacyTabBtn('h2h'); if(t) t.click();
  };
  sheet.querySelector('.rkq-profile').onclick = () => {
    close();
    if(selectedMonth !== 'all' && row.month_rating !== null && row.month_rating !== undefined && typeof openMonthlyRatingBreakdown === 'function') openMonthlyRatingBreakdown(name, selectedMonth);
    else openSheet(name);
  };
  sheet.classList.add('show');
}
