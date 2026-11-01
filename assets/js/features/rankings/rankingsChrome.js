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
    const rankEl = row.querySelector('.rank');
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
    <div class="podium-caption">Money Padel · ${scopeLabel}</div>
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

  // Above the podium (if any), otherwise straight before the column
  // header/list -- an honours-board glance first, the fuller top-3 board
  // beneath it.
  const anchor = document.getElementById('rankingsPodium') || document.getElementById('rankingsColumnHeader') || list;
  anchor.parentNode.insertBefore(panel, anchor);
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
  const anchor = document.getElementById('rankingsPodium') || document.getElementById('rankingsColumnHeader') || list;
  anchor.parentNode.insertBefore(panel, anchor);
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

function buildRankingsHero(){
  const hero = document.createElement('div');
  hero.id = 'rankingsHero';
  hero.style.cssText = 'display:none; padding: var(--space-4) var(--space-4) 0;';
  hero.innerHTML = `
    <div class="mp-display-title rankings-hero-title">Power Rankings</div>
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
  const nonDefault = minGames !== (selectedMonth === 'all' ? 10 : 5)
    || (search && search.value.trim() !== '') || includeIdle || includeInactive;
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

  const monthWrap = document.createElement('div');
  monthWrap.className = 'toolbar-control';
  monthWrap.appendChild(monthSelectEl);

  const tierWrap = document.createElement('div');
  tierWrap.className = 'toolbar-control';
  tierWrap.appendChild(tierSelect);

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
  header.innerHTML = `<span>#</span><span>Player</span><span class="col-right">Rating</span><span class="col-right">Δ</span>`;
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
