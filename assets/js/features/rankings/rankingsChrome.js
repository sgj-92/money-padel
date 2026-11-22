// ===================== RANKINGS: CHROME =====================
// The Power Rankings hero, compact filter bar, column header, collapsible
// explainer, podium, Kings of Tiers panel and the Idle / Inactive row marks.
// Presentation over the rankings list (render() in app.js) and rankingsData.js.
//
// Extracted from shell.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: redesign. Built by shell.js at start-up; declarations only.

// Badges the rendered rows with their real state, and numbers the list
// sequentially over whatever pool is currently visible.
//
// This used to split the list into sections and dash out everyone below the
// divider. That answered "who else exists" when the question being asked is
// "where would they sit" -- so an Idle player whose rating belongs 5th now
// appears 5th, with an IDLE badge, and the positions beneath shift accordingly.
//
// The number is a FILTERED-VIEW position, not an official rank. Turning a
// toggle on changes nothing about eligibility, participation, stored ratings or
// history; it changes which pool is being looked at.
function applyRankingEligibility(){
  const oldDivider = document.getElementById('eligibilityDivider');
  if(oldDivider) oldDivider.remove();
  const oldInactive = document.getElementById('inactiveDivider');
  if(oldInactive) oldInactive.remove();

  if(activeTab !== 'power' || selectedMonth !== 'all') return; // month views have their own natural test

  const list = document.getElementById('list');
  if(!list) return;
  const rows = [...list.children].filter(el => el.classList.contains('row'));
  if(rows.length === 0) return;

  rows.forEach((row, i)=>{
    const nameEl = row.querySelector('.nm');
    const name = row.dataset.player || (nameEl ? nameEl.textContent.trim() : null);
    // The number only: a top-three position keeps its laurels.
    const rankEl = row.querySelector('.rk-pos') || row.querySelector('.rank');
    if(rankEl) rankEl.textContent = i + 1;

    const st = name ? playerStateOf(name) : null;
    if(!st || st.ranking === 'RANKED'){ row.classList.remove('ineligible-row'); return; }

    // Still in the list and still numbered -- but the badge says what they
    // actually are, so a filtered-view position is never mistaken for a rank
    // they hold officially.
    row.classList.add('ineligible-row');
    const tagClass = st.participation === 'INACTIVE' ? 'inactive-tag' : 'idle-tag';
    // Placed in .meta, not .nm -- .nm truncates long names with an ellipsis,
    // which could hide an appended tag entirely for anyone with a longer name.
    const metaEl = row.querySelector('.meta');
    if(metaEl && !metaEl.querySelector('.' + tagClass)){
      metaEl.insertAdjacentHTML('afterbegin', `<span class="${tagClass}">${st.label}</span> · `);
    }
  });

  // One line saying what is being looked at, so a shifted position is never a
  // surprise. Only when the pool has been widened.
  const extra = rows.filter(row=>{
    const nameEl = row.querySelector('.nm');
    const name = row.dataset.player || (nameEl ? nameEl.textContent.trim() : null);
    const st = name ? playerStateOf(name) : null;
    return st && st.ranking !== 'RANKED';
  }).length;
  if(extra > 0){
    const note = document.createElement('div');
    note.id = 'eligibilityDivider';
    note.className = 'eligibility-divider';
    const parts = [];
    if(includeIdle) parts.push('idle');
    if(includeInactive) parts.push('temporarily inactive');
    note.textContent = `Including ${parts.join(' and ')} players — positions here are for this view, not official ranks`;
    list.insertBefore(note, list.firstChild);
  }
}

function renderRankingsPodium(){
  const existing = document.getElementById('rankingsPodium');
  if(existing) existing.remove();
  // Retired (Shaun's 22 Nov design): the leader cards and the laurelled top
  // three in the leaderboard say it. Kept callable so nothing else changes.
  if(RANKINGS_PODIUM_RETIRED) return;

  const top3 = computeRankingsPodiumTop3();
  if(!top3) return;

  const list = document.getElementById('list');
  if(!list) return;

  const scopeLabel = `${activeTier === 'All' ? 'All Tiers' : 'Tier ' + activeTier} · ${selectedMonth === 'all' ? 'All Time' : monthLabel(selectedMonth)}`;

  const order = [top3[1], top3[0], top3[2]]; // visual order: 2nd, 1st, 3rd
  const slotClass = ['second','first','third'];
  const pedestalAsset = { second: 'silver', first: 'gold', third: 'bronze' };
  const podium = document.createElement('div');
  podium.className = 'rankings-podium';
  podium.id = 'rankingsPodium';
  podium.innerHTML = `
    <div class="podium-row">
      ${order.map((p,i)=> `
        <div class="podium-slot ${slotClass[i]}" data-player="${p.name}">
          ${slotClass[i]==='first' ? `
            <div class="crown-laurel-wrap">
              <img class="crown-laurel-img" src="assets/rankings/podium-crown-laurel.png" alt="" onerror="this.style.display='none'">
              <div class="rank-num gold">1</div>
            </div>
          ` : `<div class="rank-num">${slotClass[i]==='second'?'2':'3'}</div>`}
          <div class="p-name">${p.name}</div>
          <div class="p-rating">${Math.round(p.rating)}</div>
          <img class="p-pedestal" src="assets/rankings/podium-${pedestalAsset[slotClass[i]]}.png" alt="" onerror="this.style.background='var(--surface-2)'; this.style.border='1px solid var(--surface-border)';">
        </div>
      `).join('')}
    </div>
    <div class="podium-caption">${escapeHtml(CLUB.name)} · ${scopeLabel}</div>
  `;
  // Insert before the column header (if built) rather than before #list directly,
  // so the order is always: podium, then "# Player Rating Δ", then the rows.
  const colHeader = document.getElementById('rankingsColumnHeader');
  (colHeader || list).parentNode.insertBefore(podium, colHeader || list);
  podium.querySelectorAll('.podium-slot').forEach(el=>{
    el.onclick = ()=>{
      if(selectedMonth!=='all') openMonthlyRatingBreakdown(el.dataset.player, selectedMonth);
      else openSheet(el.dataset.player);
    };
  });
}

// Kings first, then the month's Champions under them, both above the podium.
function renderKingsOfTiersPanel(){
  renderKingsPanel();
  renderMonthlyChampionsPanel();
}

function renderKingsPanel(){
  const existing = document.getElementById('kingsOfTiersPanel');
  if(existing) existing.remove();

  const kings = computeKingsOfTiers();
  if(!kings) return;

  const list = document.getElementById('list');
  if(!list) return;

  const periodLabel = selectedMonth === 'all' ? 'All Time' : monthLabel(selectedMonth);
  const tierNames = Object.fromEntries(TIER_ORDER_LIST.map(t=>[t, 'Tier ' + t]));
  // A king of Tier C in June who is Tier B today is not a mistake, and the
  // panel says so rather than leaving the reader to assume it is one.
  const movedSince = groupedTiers()
    .filter(t => kings[t] && kings[t].currentTier && kings[t].currentTier !== t)
    .map(t => `${kings[t].name} is Tier ${kings[t].currentTier} now.`);

  const panel = document.createElement('div');
  panel.className = 'kings-panel';
  panel.id = 'kingsOfTiersPanel';
  panel.innerHTML = `
    <div class="kings-panel-header">
      <span class="kings-panel-title">Kings of Tiers</span>
      <span class="kings-panel-period">All-time Power · ${periodLabel}</span>
    </div>
    <div class="kings-row">
      ${groupedTiers().filter(tier=>kings[tier] || (kings._fieldSize||{})[tier]).map(tier=>{
        const k = kings[tier];
        const field = (kings._fieldSize || {})[tier] || 0;
        return `<div class="kings-card kings-tier-${tier.toLowerCase()}" ${k ? `data-player="${k.name}"` : ''}>
          <div class="kings-crown-wrap"><img class="kings-crown" src="assets/rankings/podium-crown-laurel.png" alt="" onerror="this.style.display='none'"></div>
          ${k ? `
            <div class="kings-name">${k.name}</div>
            <div class="kings-tier-label">${tierNames[tier]}</div>
            <div class="kings-rating">${k.rating}</div>
          ` : `
            <div class="kings-name kings-name-empty">—</div>
            <div class="kings-tier-label">${tierNames[tier]}</div>
            <div class="kings-rating" style="font-size:10px; font-weight:400; color:var(--text-dim);">${field === 1 ? 'only one qualified' : 'nobody qualified'}</div>
          `}
        </div>`;
      }).join('')}
    </div>
    ${movedSince.length ? `<div class="kings-panel-note">Tiers as they stood in ${periodLabel}. ${movedSince.join(' ')}</div>` : ''}
  `;

  // Under the leaderboard (Shaun's 22 Nov design puts the two leaders and
  // the table first): the honours board after the list.
  placeAfterLeaderboard(panel);
  panel.querySelectorAll('.kings-card[data-player]').forEach(el=>{
    el.onclick = ()=>{
      if(selectedMonth!=='all') openMonthlyRatingBreakdown(el.dataset.player, selectedMonth);
      else openSheet(el.dataset.player);
    };
  });
}

// Monthly Champions (Shaun, 1 Nov): each tier's Monthly Race winner, beside
// the Kings -- who lead the All-time Power Rankings -- so the two are never
// mistaken for one another. Month views only; "Leading" until the month is
// over. Tapping one opens that month's Race.
function renderMonthlyChampionsPanel(){
  const existing = document.getElementById('monthlyChampionsPanel');
  if(existing) existing.remove();
  const champs = computeMonthlyChampions();
  if(!champs) return;
  const list = document.getElementById('list');
  if(!list) return;
  const mName = monthLabel(selectedMonth).split(' ')[0];
  const tiers = groupedTiers().filter(t => champs[t]);
  if(!tiers.length) return;
  const panel = document.createElement('div');
  panel.className = 'kings-panel champions-panel';
  panel.id = 'monthlyChampionsPanel';
  panel.innerHTML = `
    <div class="kings-panel-header">
      <span class="kings-panel-title">${champs._final ? `${mName} Champions` : `Leading ${mName}`}</span>
      <span class="kings-panel-period">Monthly Race</span>
    </div>
    <div class="kings-row">
      ${tiers.map(tier=>{
        const c = champs[tier];
        return `<div class="kings-card champ-card kings-tier-${tier.toLowerCase()}" data-player="${escapeHtml(c.name)}">
          <div class="kings-name">${escapeHtml(c.name)}</div>
          <div class="kings-tier-label">Tier ${tier}</div>
          <div class="kings-rating">${raceWholePoints(c.score)}</div>
        </div>`;
      }).join('')}
    </div>`;
  placeAfterLeaderboard(panel);
  panel.querySelectorAll('.champ-card').forEach(el=>{
    el.onclick = ()=> openMonthlyRaceFor(selectedMonth);
  });
}

// The League screen on the Race for a month: Champions open here.
function openMonthlyRaceFor(month){
  const b = legacyTabBtn('summary');
  if(b) b.click();
  summaryMonth = month;
  summaryMode = 'race';
  renderSummary();
}

// ---- Shaun's 22 Nov Rankings design --------------------------------------
const RANKINGS_PODIUM_RETIRED = true;
const RK_CHEVRON_LEFT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const RK_CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const RK_ICON_CALENDAR = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
const RK_ICON_LAYERS = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>';
const RK_ICON_CROWN = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 10H5z"/></svg>';
const RK_ICON_TREND = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>';
// A laurel either side of a top-three position.
const RK_LAUREL = '<svg class="rk-laurel" viewBox="0 0 40 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 28C4 23 3 15 6 8"/><path d="M31 28c5-5 6-13 3-20"/></g><g fill="currentColor"><ellipse cx="5.2" cy="11" rx="1.6" ry="3" transform="rotate(-20 5.2 11)"/><ellipse cx="4.6" cy="17" rx="1.6" ry="3" transform="rotate(-5 4.6 17)"/><ellipse cx="6" cy="23" rx="1.6" ry="3" transform="rotate(15 6 23)"/><ellipse cx="34.8" cy="11" rx="1.6" ry="3" transform="rotate(20 34.8 11)"/><ellipse cx="35.4" cy="17" rx="1.6" ry="3" transform="rotate(5 35.4 17)"/><ellipse cx="34" cy="23" rx="1.6" ry="3" transform="rotate(-15 34 23)"/></g></svg>';

// The period the leaderboard's change column and the Quarter Leader speak
// for: the one chosen, or the current one on All time.
function rankingsLeaderPeriod(){
  return selectedMonth !== 'all' ? selectedMonth : (typeof currentMonthKey === 'function' ? currentMonthKey() : null);
}
// "QTR" / "MTH": the column's short name for a period.
function rankingsPeriodShort(){
  const noun = (CLUB.period && CLUB.period.noun) || 'month';
  return noun === 'quarter' ? 'QTR' : noun === 'month' ? 'MTH' : noun.slice(0, 3).toUpperCase();
}
function rankingsColumnHeaderHtml(){
  return `<span>#</span><span>Player</span><span class="col-center">Tier</span><span class="col-right">Rating</span><span class="col-right">Δ (${rankingsPeriodShort()})</span><span class="col-center">Form</span><span></span>`;
}

// ‹ and ›: a period earlier or later. From All time, ‹ is the latest period.
function stepRankingsPeriod(dir){
  const sel = document.getElementById('monthSelect');
  if(!sel) return;
  const periods = [...sel.options].map(o => o.value).filter(v => v !== 'all').sort();
  if(!periods.length) return;
  const i = periods.indexOf(sel.value);
  const target = i < 0 ? (dir < 0 ? periods[periods.length - 1] : null) : periods[i + dir];
  if(!target) return;
  sel.value = target;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  syncRankingsPeriodSteps();
}
function syncRankingsPeriodSteps(){
  const sel = document.getElementById('monthSelect');
  const prev = document.getElementById('periodPrev'), next = document.getElementById('periodNext');
  if(!sel || !prev || !next) return;
  const periods = [...sel.options].map(o => o.value).filter(v => v !== 'all').sort();
  const i = periods.indexOf(sel.value);
  prev.disabled = !periods.length || i === 0;
  next.disabled = i < 0 || i === periods.length - 1;
}

// The honours panels go under the leaderboard, in order: Kings, then Champions.
function placeAfterLeaderboard(panel){
  const list = document.getElementById('list');
  if(!list) return;
  const kings = document.getElementById('kingsOfTiersPanel');
  const empty = document.getElementById('empty');
  // Whichever comes last of the list, its period notes and its empty message.
  const last = [list, document.getElementById('rankingsPeriodNotes'), empty]
    .filter(el => el && el.parentNode === list.parentNode)
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1).pop();
  const after = (panel.id === 'monthlyChampionsPanel' && kings) ? kings : last;
  after.insertAdjacentElement('afterend', panel);
}

// The two leaders over the table: Power (the top of the list as it stands)
// and the period's race (all tiers). Each only where there is one.
function renderRankingsLeaders(){
  syncRankingsPeriodSteps();
  const header = document.getElementById('rankingsColumnHeader');
  if(header) header.innerHTML = rankingsColumnHeaderHtml();
  let box = document.getElementById('rankingsLeaders');
  const list = document.getElementById('list');
  const notes = document.getElementById('rankingsPeriodNotes');
  if(notes) notes.style.display = activeTab === 'power' ? '' : 'none';
  if(activeTab !== 'power' || !list || !DATA_READY){ if(box) box.remove(); const h = document.getElementById('rankingsBoardHead'); if(h) h.remove(); return; }
  const rows = (typeof powerRowsShown !== 'undefined' ? powerRowsShown : []) || [];
  const basis = (p) => selectedMonth !== 'all' ? (p.month_rating ?? -Infinity) : p.rating;
  const top = rows.slice().sort((a, b) => basis(b) - basis(a))[0];
  const power = top && isFinite(basis(top)) ? { name: top.name, tier: tierInScope(top) || top.tier, value: Math.round(basis(top)) } : null;
  let race = null;
  const period = rankingsLeaderPeriod();
  try {
    if(period && typeof buildMonthlyRace === 'function'){
      const lead = MonthlyRace.overall(buildMonthlyRace(period).table, raceMinMatches()).find(r => r.qualified);
      const p = lead && PLAYERS.find(x => x.name === lead.playerId);
      const tier = (lead && lead.tier && lead.tier !== 'ALL') ? lead.tier : (p && (tierInScope(p) || p.tier)) || '';
      if(lead) race = { name: lead.playerId, tier, value: raceWholePoints(lead.score), period };
    }
  } catch(e){ race = null; }
  const noun = (CLUB.period && CLUB.period.noun) || 'month';
  const card = (kind, icon, label, d) => d ? `<button type="button" class="rk-leader rk-leader-${kind}" data-leader="${kind}" data-player="${escapeHtml(d.name)}">
      <span class="rk-leader-label"><span class="rk-leader-icon">${icon}</span>${escapeHtml(label)}</span>
      <span class="rk-leader-name">${escapeHtml(d.name)}</span>
      <span class="rk-leader-body"><span class="rk-leader-tier">${d.tier ? `Tier ${escapeHtml(d.tier)}` : ''}</span>
      <span class="rk-leader-value">${escapeHtml(String(d.value))}</span></span></button>` : '';
  const html = card('power', RK_ICON_CROWN, 'Power Leader', power) + card('race', RK_ICON_TREND, `${noun} Leader`, race);
  if(!box){ box = document.createElement('div'); box.id = 'rankingsLeaders'; box.className = 'rk-leaders'; }
  box.innerHTML = html;
  box.style.display = html ? '' : 'none';
  let head = document.getElementById('rankingsBoardHead');
  if(!head){
    head = document.createElement('div');
    head.id = 'rankingsBoardHead'; head.className = 'rk-board-head';
    head.innerHTML = `<h2 class="rk-board-title">Power Leaderboard</h2><button type="button" class="rk-method" id="rankingsMethodBtn">Methodology <span class="rk-info" aria-hidden="true">i</span></button>`;
  }
  const anchor = header || list;
  anchor.parentNode.insertBefore(box, anchor);
  anchor.parentNode.insertBefore(head, anchor);
  head.querySelector('#rankingsMethodBtn').onclick = () => { if(typeof openPowerRatingGuide === 'function') openPowerRatingGuide(); };
  box.querySelectorAll('[data-leader]').forEach(b => {
    b.onclick = () => {
      if(b.dataset.leader === 'race') openMonthlyRaceFor(period);
      else if(selectedMonth !== 'all' && typeof openMonthlyRatingBreakdown === 'function') openMonthlyRatingBreakdown(b.dataset.player, selectedMonth);
      else openSheet(b.dataset.player);
    };
  });
}

function buildRankingsHero(){
  const hero = document.createElement('div');
  hero.id = 'rankingsHero';
  hero.style.cssText = 'display:none; padding: var(--space-4) var(--space-4) 0;';
  hero.innerHTML = `
    <h1 class="mp-display-title rankings-hero-title">Rankings</h1>
    <div class="rankings-hero-sub">A tier-anchored rating. Scoreline counts, not just who won.</div>
  `;
  const controls = document.querySelector('.controls');
  controls.parentNode.insertBefore(hero, controls);
  return hero;
}

// The gold dot on Filters: on whenever the list is narrowed or widened from
// its default. Min games defaults to 10 on All time and 5 on a month
// (applyRankingsMonth), so only a departure from the default for the month
// shown counts -- before, every month view lit it. Also run by render(), so
// arriving on a default month or changing month keeps it right.
function syncRankingsFilterDot(){
  const btn = document.getElementById('openFiltersBtn');
  const search = document.getElementById('search');
  if(!btn) return;
  // The club's own default for this view (Club settings), not a fixed 10 / 5:
  // the dot was lit at Padel Championships with nothing changed.
  const dflt = typeof defaultRankingMinGames === 'function' ? defaultRankingMinGames(selectedMonth) : (selectedMonth === 'all' ? 10 : 5);
  const nonDefault = minGames !== dflt
    || (search && search.value.trim() !== '') || includeIdle || includeInactive
    || (typeof activeSortP !== 'undefined' && activeSortP !== 'rating');
  btn.classList.toggle('has-filters', nonDefault);
}

function buildCompactFiltersBar(){
  const monthFilterRow = document.getElementById('monthFilterRow');
  const tierbar = document.getElementById('tierbar');
  const searchWrap = document.getElementById('searchWrap');
  const minGamesRow = document.getElementById('minGamesRow');
  const monthSelectEl = document.getElementById('monthSelect');

  // Tier becomes a real compact dropdown -- built fresh, but every option's
  // onchange just triggers a .click() on the real, already-wired legacy
  // button for that value. No logic duplicated. The pill strip itself is
  // retired for good (see #tierbar{display:none!important} in app.css).
  const tierSelect = document.createElement('select');
  tierSelect.id = 'tierSelectCompact';
  [...tierbar.querySelectorAll('.tierbtn')].forEach(btn=>{
    const opt = document.createElement('option');
    opt.value = btn.dataset.tier;
    // Label-only change: the compact select reads "All tiers", independent
    // of the legacy button's own "All players" text -- app.js untouched.
    opt.textContent = btn.dataset.tier === 'All' ? 'All tiers' : btn.textContent;
    tierSelect.appendChild(opt);
  });
  tierSelect.value = activeTier;
  tierSelect.onchange = ()=>{
    const btn = tierbar.querySelector(`.tierbtn[data-tier="${tierSelect.value}"]`);
    if(btn) btn.click();
  };

  // One clean row: Month | Tier | Filter icon. No leading icons (Shaun, 31
  // Oct): they left "Octob…" and "All ti…" in the boxes. Month's own "Month:"
  // label wrapper is left behind -- only the raw select moves into the toolbar.
  const toolbar = document.createElement('div');
  toolbar.id = 'rankingsToolbar';
  toolbar.className = 'rankings-toolbar';

  // One rounded bar (Shaun's 22 Nov design): ‹ period › | tier | filters.
  // The arrows step a period at a time; the period itself still opens the
  // full list (All time included).
  const monthWrap = document.createElement('div');
  monthWrap.className = 'toolbar-control toolbar-period';
  const prev = document.createElement('button');
  prev.type = 'button'; prev.className = 'period-step'; prev.id = 'periodPrev';
  prev.setAttribute('aria-label', 'Earlier'); prev.innerHTML = RK_CHEVRON_LEFT;
  const next = document.createElement('button');
  next.type = 'button'; next.className = 'period-step'; next.id = 'periodNext';
  next.setAttribute('aria-label', 'Later'); next.innerHTML = RK_CHEVRON_RIGHT;
  const cal = document.createElement('span');
  cal.className = 'toolbar-icon'; cal.innerHTML = RK_ICON_CALENDAR;
  monthWrap.append(prev, cal, monthSelectEl, next);
  prev.onclick = () => stepRankingsPeriod(-1);
  next.onclick = () => stepRankingsPeriod(1);
  monthSelectEl.dataset.native = '1';
  tierSelect.dataset.native = '1';

  const tierWrap = document.createElement('div');
  tierWrap.className = 'toolbar-control toolbar-tier';
  const layers = document.createElement('span');
  layers.className = 'toolbar-icon'; layers.innerHTML = RK_ICON_LAYERS;
  tierWrap.append(layers, tierSelect);

  toolbar.appendChild(monthWrap);
  toolbar.appendChild(tierWrap);
  const filtersBtn = document.createElement('button');
  filtersBtn.className = 'filter-btn';
  filtersBtn.id = 'openFiltersBtn';
  filtersBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" width="17" height="17"><line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2" fill="var(--surface-1)"/><line x1="4" y1="14" x2="20" y2="14"/><circle cx="15" cy="14" r="2" fill="var(--surface-1)"/><line x1="4" y1="21" x2="20" y2="21"/><circle cx="11" cy="21" r="2" fill="var(--surface-1)"/></svg><span class="filter-dot"></span>`;
  toolbar.appendChild(filtersBtn);
  document.querySelector('.controls').insertBefore(toolbar, document.getElementById('tabrow').nextSibling);
  monthFilterRow.style.display = 'none'; // now empty (its select moved out) -- keep it inert, not visible

  // Everything secondary lives in Filters: Data quality, search, min games
  // (moved fully off the main screen, per the correction), and the three
  // less-frequently-used sort modes.
  const sortbarPower = document.getElementById('sortbarPower');
  const secondarySortWrap = document.createElement('div');
  secondarySortWrap.id = 'secondarySortWrap';
  secondarySortWrap.className = 'fg-row';
  ['month_rating', 'avg_match_strength', 'name'].forEach(key=>{
    const btn = sortbarPower.querySelector(`[data-sortp="${key}"]`);
    if(btn) secondarySortWrap.appendChild(btn);
  });

  const sheet = document.createElement('div');
  sheet.className = 'shell-more-sheet';
  sheet.id = 'shellFiltersSheet';
  const panel = document.createElement('div');
  panel.className = 'shell-more-panel';
  panel.innerHTML = `<h3>Filters</h3>`;
  // Sort by: off the main screen too (Shaun's 22 Nov design shows the table
  // straight under the leaders). The dot on Filters says when it isn't Rating.
  if(sortbarPower){
    const sortLabel = document.createElement('div');
    sortLabel.className = 'section-sub';
    sortLabel.style.cssText = 'margin-top:0;';
    sortLabel.textContent = 'Sort by';
    panel.appendChild(sortLabel);
    panel.appendChild(sortbarPower);
    sortbarPower.addEventListener('click', ()=> setTimeout(syncRankingsFilterDot, 0));
  }
  panel.appendChild(searchWrap);
  panel.appendChild(minGamesRow);
  // Include idle / temporarily inactive: off the main screen (Shaun, 31 Oct --
  // too much on it), here with the other ways of widening the list. The gold
  // dot on the Filter button says when either is on.
  const stateFilterRow = document.getElementById('stateFilterRow');
  if(stateFilterRow){
    const stateLabel = document.createElement('div');
    stateLabel.className = 'section-sub';
    stateLabel.style.cssText = 'margin-top:12px;';
    stateLabel.textContent = 'Also show';
    panel.appendChild(stateLabel);
    panel.appendChild(stateFilterRow);
  }
  const secondarySortLabel = document.createElement('div');
  secondarySortLabel.className = 'section-sub';
  secondarySortLabel.style.cssText = 'margin-top:12px;';
  secondarySortLabel.textContent = 'More ways to sort';
  panel.appendChild(secondarySortLabel);
  panel.appendChild(secondarySortWrap);
  sheet.appendChild(panel);
  document.body.appendChild(sheet);
  sheet.addEventListener('click', (e)=>{ if(e.target === sheet) sheet.classList.remove('show'); });

  filtersBtn.onclick = ()=> sheet.classList.add('show');

  // Gold dot on the Filter icon whenever any non-default filter is active --
  // the only visible cue needed now that Min Games/Search aren't shown
  // permanently on screen. Data Range is deliberately NOT counted here: it's
  // an app-wide setting in More, not a Rankings filter, and it has its own
  // global indicator.
  const searchInputEl = document.getElementById('search');
  const minGamesInputEl = document.getElementById('minGamesInput');
  const updateFilterDot = syncRankingsFilterDot;
  minGamesInputEl.addEventListener('input', ()=> setTimeout(updateFilterDot, 0));
  document.querySelectorAll('.minGamesPresets .preset-btn').forEach(b=> b.addEventListener('click', ()=> setTimeout(updateFilterDot, 0)));
  searchInputEl.addEventListener('input', updateFilterDot);
  document.querySelectorAll('#stateFilterRow .state-toggle').forEach(b=> b.addEventListener('click', ()=> setTimeout(updateFilterDot, 0)));

  // Screen isolation: the toolbar belongs to Rankings (both Power Rankings
  // and Win/Loss share Month/Tier filtering) and must never persist onto
  // Play/Players/Games/etc. Controlled directly here rather than fighting
  // app.js's own per-element visibility toggling, which is what caused the
  // tier pill strip to keep reappearing before.
  function syncToolbarVisibility(){
    toolbar.style.display = (activeTab === 'power' || activeTab === 'wl') ? 'grid' : 'none';
    // .controls itself is never hidden by app.js -- it only ever hides its
    // individual children, since nothing previously sat directly beneath it
    // that would make its own padding visible as a gap. Home's edge-to-edge
    // hero now sits right there, so the container needs explicit hiding too.
    const controlsEl = document.querySelector('.controls');
    if(controlsEl) controlsEl.style.display = (activeTab === 'power' || activeTab === 'wl') ? 'flex' : 'none';
  }
  document.getElementById('tabrow').addEventListener('click', ()=> setTimeout(syncToolbarVisibility, 0));
  syncToolbarVisibility();
}

// Static column-header row for the ranking table ("# PLAYER  RATING  Δ"),
// per the approved reference. Visibility follows the same rule as the
// toolbar/segmented switcher -- Power Rankings only.
function buildRankingsColumnHeader(){
  const header = document.createElement('div');
  header.id = 'rankingsColumnHeader';
  header.className = 'rankings-col-header';
  header.innerHTML = rankingsColumnHeaderHtml();
  const list = document.getElementById('list');
  list.parentNode.insertBefore(header, list);
  function sync(){ header.style.display = (activeTab === 'power') ? 'grid' : 'none'; }
  document.getElementById('tabrow').addEventListener('click', ()=> setTimeout(sync, 0));
  sync();
}

function buildCollapsibleExplainer(){
  const explainer = document.getElementById('explainer');
  const wrapper = document.createElement('div');
  wrapper.id = 'explainerWrapper';
  explainer.parentNode.insertBefore(wrapper, explainer);
  const toggle = document.createElement('button');
  toggle.id = 'explainerToggle';
  toggle.className = 'explainer-toggle';
  toggle.textContent = 'How this works ›';
  wrapper.appendChild(toggle);
  wrapper.appendChild(explainer);
  explainer.style.display = 'none';
  toggle.onclick = ()=>{
    const isOpen = explainer.style.display !== 'none';
    explainer.style.display = isOpen ? 'none' : 'block';
    toggle.textContent = isOpen ? 'How this works ›' : 'How this works ⌄';
  };
}
