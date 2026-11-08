// ==========================================================================
// PRESTIGE V1 — SHELL (Phase 1)
// This file adds the new Home/Rankings/Play/Players/More navigation on top
// of the existing app, WITHOUT renaming or altering any legacy tab identity.
// Legacy tab values (summary, power, findgame, players, wl, callouts, h2h,
// games, wishlist, upcoming, manage) are untouched -- this is a mapping layer
// only, per the agreed Phase 1 contract. Load this file after app.js.
// ==========================================================================

// SINGLE-TAB sections (no subnav): Home only.
const SECTION_TAB_MAP = { home: 'summary' };

// MULTI-TAB sections: a visible segmented subnav under the header, per the IA
// correction. First entry in each list is that section's default landing tab.
const SECTION_SUBNAV = {
  rankings: [
    { tab: 'power', label: 'Power', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 20v-6"/><path d="M12 20V8"/><path d="M18 20v-10"/><path d="M4 20h16"/></svg>' },
    { tab: 'wl', label: 'W/L', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l6 3.2"/></svg>' },
    { tab: 'summary', label: 'League', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4.5" width="16" height="15" rx="1.5"/><path d="M4 9h16"/><path d="M8 4.5v-1.5"/><path d="M16 4.5v-1.5"/></svg>' },
  ],
  play: [
    { tab: 'findgame', label: 'Find Game' },
    { tab: 'games', label: 'Games' },
    { tab: 'upcoming', label: 'Upcoming' },
    { tab: 'wishlist', label: 'Requests' },
  ],
  players: [
    { tab: 'players', label: 'Directory' },
    { tab: 'h2h', label: 'Compare' },
  ],
};

const TAB_TO_SECTION = { summary: 'home' };
Object.keys(SECTION_SUBNAV).forEach(sec=>{
  SECTION_SUBNAV[sec].forEach(item=>{ TAB_TO_SECTION[item.tab] = sec; });
});

// More is now genuinely secondary only -- everything with a real home above
// (Games, Upcoming, Requests, Compare/H2H, Win/Loss) has been moved out.
// Order (Shaun, 4 Oct): Predict a Matchup first -- Admin only, hidden from
// everyone else -- then Doughnuts, the guides, Insights, Data & Rankings; My
// Player and Admin / Manage follow. North vs South is no longer on the list:
// it lives in Admin / Manage.
const MORE_ITEMS = [
  { special: 'predict', label: 'Predict a Matchup', adminOnly: true },
  { special: 'doughnuts', label: 'Doughnuts' },
  { special: 'ratingguide', label: 'Power Rating Guide' },
  { tab: 'callouts', label: 'Insights / Call-Outs' },
  { special: 'about', label: 'About Power Rankings' },
  { special: 'datarange', label: 'Data & Rankings' },
];
const MORE_ADMIN_ITEM = { tab: 'manage', label: 'Admin / Manage' };

let activeSection = 'rankings'; // matches legacy default activeTab === 'power'

// The standings site (siteMode.js): Rankings is the whole app -- League, then
// Power, then Results (the Games log, read-only) -- with no bottom nav, no
// player chooser and no profiles. Set up before the shell builds itself.
// The page's own name and labels for the community (config/club.js) -- the
// static HTML carries Money Padel's for the very first paint.
function applyClubIdentity(){
  document.title = CLUB.appTitle;
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if(appleTitle) appleTitle.setAttribute('content', CLUB.homeScreenTitle);
  const tag = document.querySelector('#legacyHeader .tag');
  if(tag) tag.textContent = `${CLUB.name} · ${CLUB.resultsGroup}`;
}

function enterStandingsMode(){
  document.body.classList.add('standings-mode');
  const icon = (tab) => ((SECTION_SUBNAV.rankings || []).find(it => it.tab === tab) || {}).icon;
  SECTION_SUBNAV.rankings = [
    { tab: 'summary', label: 'League', icon: icon('summary') },
    { tab: 'power', label: 'Power', icon: icon('power') },
    { tab: 'games', label: 'Results', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 7h14"/><path d="M5 12h14"/><path d="M5 17h9"/></svg>' },
    // The published Monthly Reviews, each a swipeable deck (Shaun, 1 Nov). A
    // page of its own (review/), so this item goes there, not to a tab.
    { tab: 'monthly', label: 'Monthly', href: 'review/', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 3.5v17"/></svg>' },
  ];
  TAB_TO_SECTION.summary = 'rankings';
  TAB_TO_SECTION.games = 'rankings';
  document.title = CLUB.name + ' · Standings';
  // Names stay names here: a profile is the full app's.
  window.openSheet = function(){};
}

function legacyTabBtn(tab){
  return document.querySelector(`#tabrow .tab-btn[data-tab="${tab}"]`);
}

function goToSection(section){
  if(section === 'more'){
    openMoreSheet();
    return; // don't change activeSection until a specific destination is chosen
  }
  const singleTab = SECTION_TAB_MAP[section];
  const subnav = SECTION_SUBNAV[section];
  // default to the first subnav item this reader may see
  const firstVisible = subnav && subnav.find(it => canSeeTab(it.tab));
  const targetTab = singleTab || (firstVisible ? firstVisible.tab : (subnav && subnav[0].tab));
  if(targetTab){
    const btn = legacyTabBtn(targetTab);
    if(btn) btn.click(); // reuses 100% of existing tab-switch logic untouched
  }
  activeSection = section;
  updateBottomNavHighlight();
  renderSectionSubnav();
  syncPlayHeadingVisibility();
  // Tapping Home always resets to the dashboard view, even if "View Full
  // Review" was open -- an implicit "back to Home" path.
  if(section === 'home'){
    arriveAtHome();
    const backBtn = document.getElementById('homeBackFromReview');
    if(backBtn) backBtn.style.display = 'none';
    const summaryEl = document.getElementById('summaryView');
    if(summaryEl) summaryEl.style.display = 'none';
    renderHomeDashboard();
    // The dashboard element is created lazily by the first render(); Home can
    // be entered before that (deep link, scripted navigation), so build it on
    // demand rather than dereferencing null.
    const dash = document.getElementById('homeDashboard') || buildHomeDashboard();
    if(dash) dash.style.display = 'block';
  } else {
    // #homeDashboard is a new element app.js's own tab-visibility system has
    // no knowledge of, so it must be hidden explicitly here -- otherwise,
    // once Home has been visited once in a session, its content (hero,
    // Your Game card) stays visible underneath every other section
    // indefinitely, since nothing else in the app would ever hide it again.
    const dash = document.getElementById('homeDashboard');
    if(dash) dash.style.display = 'none';
  }
  updateHeaderForSection();
}

// Play heading shows for the whole Play section (any of its four sub-tabs),
// never for other sections -- kept in its own function so both the primary
// nav path (goToSection) and internal legacy navigation (the #tabrow
// listener below) stay in sync with whichever is actually active.
function syncPlayHeadingVisibility(){
  const el = document.getElementById('playHeading');
  if(el) el.style.display = (activeSection === 'play') ? 'block' : 'none';
}

// The header's right-side slot becomes the player switcher on Home
// ("Shaun ▾"), reusing the same selector the first-launch flow and My
// Player entry already use -- reverts to the plain section label elsewhere.
function updateHeaderForSection(){
  syncDesktopShell();   // the rail shows who is viewing
  const titleEl = document.getElementById('shellSectionTitle');
  if(!titleEl) return;
  if(activeSection === 'home'){
    const viewer = getCurrentViewer();
    titleEl.innerHTML = `<button id="homeViewerSwitch" class="home-viewer-switch">${viewer ? viewer.name : 'Choose player'} ▾</button>`;
    document.getElementById('homeViewerSwitch').onclick = ()=> buildViewerSelector();
  } else {
    const sectionLabels = { rankings:'Rankings', play:'Play', players:'Players', more:'More' };
    titleEl.innerHTML = sectionLabels[activeSection] || '';
  }
}

function updateBottomNavHighlight(){
  document.querySelectorAll('.shell-nav-item').forEach(el=>{
    el.classList.toggle('active', el.dataset.section === activeSection);
  });
  syncDesktopShell();
}

// The header's small section label is redundant once a screen has its own
// editorial hero (Rankings does) -- hidden there, kept as a quiet wayfinding
// cue on screens that don't have one yet (Play/Players, still legacy views).
function syncHeaderSectionTitle(){
  const titleEl = document.getElementById('shellSectionTitle');
  if(!titleEl) return;
  titleEl.style.display = (activeTab === 'power') ? 'none' : '';
}

// Renders (or hides) the visible segmented subnav for the current section.
// Not a menu -- always on-screen for sections that have one, per the "must
// be discoverable, not hidden behind another tap" requirement.
function renderSectionSubnav(){
  const container = document.getElementById('sectionSubnav');
  // Only the screens this reader may see (canSeeTab, app.js).
  const items = (SECTION_SUBNAV[activeSection] || []).filter(it => it.href || canSeeTab(it.tab));
  if(!items.length){ container.style.display = 'none'; container.innerHTML = ''; syncDesktopShell(); return; }
  container.style.display = 'grid';
  // minmax(0, 1fr), not plain 1fr -- a grid track's implicit min-width is
  // "auto" (its content's own minimum size) just like a flex item, so a
  // long label (e.g. "Monthly Summary") would force its whole track wider
  // than its equal share and overflow the page instead of actually
  // shrinking to let the span-level ellipsis do its job.
  container.style.gridTemplateColumns = `repeat(${items.length}, minmax(0, 1fr))`;
  container.innerHTML = items.map(it=> it.href
    ? `<a class="section-subnav-item" href="${it.href}" data-tab="${it.tab}">${it.icon||''}<span>${it.label}</span></a>`
    : `<button class="section-subnav-item ${it.tab===activeTab?'active':''}" data-tab="${it.tab}">${it.icon||''}<span>${it.label}</span></button>`
  ).join('');
  container.querySelectorAll('button.section-subnav-item').forEach(btn=>{
    btn.onclick = ()=>{ const b = legacyTabBtn(btn.dataset.tab); if(b) b.click(); };
  });
  syncDesktopShell();
}

// Unlocking, locking or changing a visibility setting redraws the shell's own
// navigation from the same rule, and moves a reader off a screen they may no
// longer see.
function onVisibilityChanged(){
  if(typeof renderSectionSubnav === 'function' && document.getElementById('sectionSubnav')) renderSectionSubnav();
  if(typeof activeTab !== 'undefined' && !canSeeTab(activeTab)){
    const fb = legacyTabBtn(visibleFallbackTab(activeTab));
    if(fb) fb.click();
  }
}

function openMoreSheet(){
  // More lists only what this reader may open.
  document.querySelectorAll('#shellMoreSheet .shell-more-item[data-tab]').forEach(btn=>{
    const tab = btn.dataset.tab;
    if(tab && tab !== 'manage') btn.style.display = canSeeTab(tab) ? '' : 'none';
  });
  // Admin-only items exist for an admin and for nobody else.
  document.querySelectorAll('#shellMoreSheet .shell-more-item[data-admin-only]').forEach(btn=>{
    btn.style.display = canSeePredictions() ? '' : 'none';
  });
  document.getElementById('shellMoreSheet').classList.add('show');
}
function closeMoreSheet(){
  document.getElementById('shellMoreSheet').classList.remove('show');
}

function buildShellDom(){
  // Header
  const header = document.createElement('div');
  header.className = 'shell-header';
  header.innerHTML = `
    <div class="brand-mark"><img src="${CLUB.logo}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'nav-icon-fallback',textContent:${escapeHtml(JSON.stringify(CLUB.monogram))}}))"></div>
    <div class="brand-wordmark">${clubWordmarkHtml()}</div>
    <div class="shell-section-title" id="shellSectionTitle">Rankings</div>
  `;
  document.body.insertBefore(header, document.body.firstChild);

  // Visible section subnav mount point, right under the header.
  const subnav = document.createElement('div');
  subnav.id = 'sectionSubnav';
  subnav.className = 'section-subnav';
  subnav.style.display = 'none';
  header.parentNode.insertBefore(subnav, header.nextSibling);

  // Play heading -- deliberately compact and non-personalised, distinct from
  // Home's editorial hero. No photographic artwork; a restrained geometric
  // court-line motif gives Play its own visual signature for now.
  const playHeading = document.createElement('div');
  playHeading.id = 'playHeading';
  playHeading.className = 'play-heading';
  playHeading.style.display = 'none';
  playHeading.innerHTML = `
    <svg class="play-heading-motif" viewBox="0 0 100 40" preserveAspectRatio="none"><line x1="0" y1="20" x2="100" y2="20"/><line x1="50" y1="0" x2="50" y2="40"/><rect x="2" y="8" width="96" height="24" rx="2"/></svg>
    <div class="mp-section-label">${escapeHtml(CLUB.name)}</div>
    <div class="mp-display-title" style="font-size:24px; margin-top:2px;">Play</div>
    <div class="play-heading-sub">Find the right game. Get it booked. Get on court.</div>
  `;
  subnav.parentNode.insertBefore(playHeading, subnav.nextSibling);

  // Bottom nav
  const nav = document.createElement('div');
  nav.className = 'shell-bottom-nav';
  const navItems = [
    { section: 'home', label: 'Home', icon: 'home' },
    { section: 'rankings', label: 'Rankings', icon: 'rankings' },
    { section: 'play', label: 'Play', icon: 'play' },
    { section: 'players', label: 'Players', icon: 'players' },
    { section: 'more', label: 'More', icon: 'more' },
  ];
  nav.innerHTML = navItems.map(it => `
    <button class="shell-nav-item" data-section="${it.section}">
      <span class="nav-icon-mount" data-icon="${it.icon}" data-fallback="${it.label[0]}"></span>
      <span>${it.label}</span>
    </button>
  `).join('');
  document.body.appendChild(nav);
  nav.querySelectorAll('.shell-nav-item').forEach(btn=>{
    btn.onclick = ()=> goToSection(btn.dataset.section);
  });

  // Icons are fetched and embedded as real inline <svg> elements, not
  // <img src="*.svg">. This matters: currentColor inside an externally
  // referenced SVG resolves within that SVG's own isolated document, not the
  // parent page's CSS -- so an <img>-based icon can never pick up the active
  // gold colour no matter what CSS is written. Inlining fixes this for the
  // current placeholders and will keep working unchanged once ChatGPT's
  // final icons land at the same file paths.
  nav.querySelectorAll('.nav-icon-mount').forEach(mount=>{
    const iconName = mount.dataset.icon;
    if(typeof fetch !== 'function'){
      mount.replaceWith(Object.assign(document.createElement('div'), { className: 'nav-icon-fallback', textContent: mount.dataset.fallback }));
      return;
    }
    fetch(`assets/icons/${iconName}.svg`)
      .then(r => { if(!r.ok) throw new Error('not found'); return r.text(); })
      .then(svgText => { mount.innerHTML = svgText; })
      .catch(()=>{
        mount.replaceWith(Object.assign(document.createElement('div'), { className: 'nav-icon-fallback', textContent: mount.dataset.fallback }));
      });
  });

  // More sheet
  const sheet = document.createElement('div');
  sheet.className = 'shell-more-sheet';
  sheet.id = 'shellMoreSheet';
  sheet.innerHTML = `<div class="shell-more-panel">
    <h3>More</h3>
    ${MORE_ITEMS.map(it => `<button class="shell-more-item${it.adminOnly ? ' admin-only-item' : ''}" data-tab="${it.tab||''}" data-special="${it.special||''}"${it.adminOnly ? ' data-admin-only style="display:none;"' : ''}>${it.label}<span class="chev">›</span></button>`).join('')}
    <button class="shell-more-item admin-item" data-tab="${MORE_ADMIN_ITEM.tab}">${MORE_ADMIN_ITEM.label}<span class="chev">›</span></button>
  </div>`;
  document.body.appendChild(sheet);
  sheet.addEventListener('click', (e)=>{ if(e.target === sheet) closeMoreSheet(); });
  sheet.querySelectorAll('.shell-more-item').forEach(btn=>{
    btn.onclick = ()=>{
      if(btn.dataset.special === 'ratingguide'){
        closeMoreSheet();
        openPowerRatingGuide();
        return;
      }
      if(btn.dataset.special === 'predict'){
        closeMoreSheet();
        openPredictMatchup();   // refuses anyone who is not an admin
        return;
      }
      if(btn.dataset.special === 'about'){
        closeMoreSheet();
        openAboutPowerRankings();
        return;
      }
      if(btn.dataset.special === 'doughnuts'){
        closeMoreSheet();
        openDoughnutLeaderboard();
        return;
      }
      if(btn.dataset.special === 'datarange'){
        closeMoreSheet();
        openDataRangeSheet();
        return;
      }
      const b = legacyTabBtn(btn.dataset.tab);
      if(b) b.click(); // the #tabrow capture listener already updates activeSection/subnav correctly
      closeMoreSheet();
    };
  });

  // About, Doughnuts and North vs South used to be defined here, inside
  // buildShellDom. They are features now (features/rankings/ratingGuide.js,
  // doughnutsScreen.js, northSouthScreen.js); the More sheet above still opens
  // them by name.

  // Keep bottom-nav highlight (and section subnav) in sync no matter how the
  // legacy tab changes (new nav, subnav, More sheet, or internal app.js
  // navigation like "Edit this game").
  document.getElementById('tabrow').addEventListener('click', (e)=>{
    const btn = e.target.closest('.tab-btn');
    if(!btn) return;
    const tab = btn.dataset.tab;
    activeSection = TAB_TO_SECTION[tab] || 'more';
    updateBottomNavHighlight();
    const titleEl = document.getElementById('shellSectionTitle');
    if(titleEl){
      const sectionLabels = { home:'Home', rankings:'Rankings', play:'Play', players:'Players', more:'More' };
      titleEl.textContent = sectionLabels[activeSection] || '';
    }
  }, true);

  // Separate, non-capturing listener: fires AFTER the legacy tab handler has
  // already run and updated activeTab/rendered its view, so both the podium
  // check and the subnav highlight (which reads the now-current activeTab)
  // are accurate -- this is what actually removes a stale podium when
  // navigating to a tab with its own render function (Players, Games, etc.)
  // rather than the shared render() the podium hook is attached to, and what
  // correctly highlights the just-clicked subnav item rather than the
  // previous one.
  document.getElementById('tabrow').addEventListener('click', (e)=>{
    if(!e.target.closest('.tab-btn')) return;
    renderRankingsPodium();
    renderKingsOfTiersPanel();
    renderSectionSubnav();
  });
}

// ---- Data & Rankings: the app-wide Data Range setting ---------------------
// Deliberately a setting, not a filter: it lives in More, it persists, and it
// is the only place in the app where the dataset can be changed. The two
// options map onto dataRange in app.js ('verified' | 'all'), which is applied
// in exactly one place (getAllApprovedMatches) so every screen agrees.
const DATA_RANGE_OPTIONS = [
  { value: 'verified', label: 'Verified data', sub: 'June 2026 onwards', tag: 'Recommended' },
  { value: 'all', label: 'Full history', sub: 'Includes matches before June 2026', tag: '' },
];

function openDataRangeSheet(){
  let modal = document.getElementById('dataRangeModal');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'shell-more-sheet';
    modal.id = 'dataRangeModal';
    document.body.appendChild(modal);
    modal.addEventListener('click', (e)=>{ if(e.target === modal) modal.classList.remove('show'); });
  }
  renderDataRangeSheet(modal);
  modal.classList.add('show');
}

function renderDataRangeSheet(modal){
  const rows = DATA_RANGE_OPTIONS.map(opt => `
    <button class="dr-option ${dataRange === opt.value ? 'selected' : ''}" data-range="${opt.value}">
      <span class="dr-radio" aria-hidden="true"></span>
      <span class="dr-option-text">
        <span class="dr-option-label">${opt.label}</span>
        <span class="dr-option-sub">${opt.sub}${opt.tag ? ` · <b>${opt.tag}</b>` : ''}</span>
      </span>
    </button>
  `).join('');

  modal.innerHTML = `<div class="shell-more-panel">
    <h3>Data &amp; Rankings</h3>
    <div class="mp-section-label" style="margin-bottom:8px;">Data range</div>
    <div class="dr-options">${rows}</div>
    <div class="section-sub" style="margin-top:14px;">Applies everywhere — rankings, ratings, records, form and every other statistic in the app.</div>
  </div>`;

  modal.querySelectorAll('.dr-option').forEach(btn=>{
    btn.onclick = ()=>{
      const value = btn.dataset.range;
      if(value === dataRange) return;
      // Only the step into the less-reliable dataset needs explaining, and
      // only the first time -- going back to Verified never warns.
      if(value === 'all' && !hasAcknowledgedFullHistory()){
        openFullHistoryConfirm(modal);
        return;
      }
      applyDataRangeChange(value);
      renderDataRangeSheet(modal);
    };
  });
}

function openFullHistoryConfirm(parentModal){
  let modal = document.getElementById('fullHistoryConfirmModal');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'shell-more-sheet';
    modal.id = 'fullHistoryConfirmModal';
    document.body.appendChild(modal);
    modal.addEventListener('click', (e)=>{ if(e.target === modal) modal.classList.remove('show'); });
  }
  modal.innerHTML = `<div class="shell-more-panel">
    <h3>Include historical data?</h3>
    <div class="section-sub" style="font-size:12.5px;">Matches recorded before June 2026 may contain incomplete or less reliable information. Rankings and statistics may therefore differ from the verified-data view.</div>
    <div class="dr-confirm-actions">
      <button class="mp-btn-secondary" id="drConfirmCancel">Cancel</button>
      <button class="mp-btn-primary" id="drConfirmUse">Use Full History</button>
    </div>
  </div>`;
  modal.querySelector('#drConfirmCancel').onclick = ()=> modal.classList.remove('show');
  modal.querySelector('#drConfirmUse').onclick = ()=>{
    acknowledgeFullHistory();
    applyDataRangeChange('all');
    modal.classList.remove('show');
    if(parentModal) renderDataRangeSheet(parentModal);
  };
  modal.classList.add('show');
}

// Subtle, permanent cue that the less-reliable dataset is in play. Shown only
// in Full History, never in the recommended view, and taps straight through
// to the setting that controls it -- so it explains itself rather than just
// warning.
function syncFullHistoryIndicator(){
  const header = document.querySelector('.shell-header');
  if(!header) return;
  let pill = document.getElementById('fullHistoryIndicator');
  if(dataRange !== 'all'){
    if(pill) pill.remove();
    return;
  }
  if(!pill){
    pill = document.createElement('button');
    pill.id = 'fullHistoryIndicator';
    pill.className = 'full-history-pill';
    pill.textContent = 'Full History';
    pill.title = 'Viewing full history, including pre-June 2026 matches';
    pill.onclick = ()=> openDataRangeSheet();
    // Before the section title, which holds the right edge via margin-left:auto,
    // so the pill reads as a badge on the brand rather than crowding the title.
    const title = document.getElementById('shellSectionTitle');
    header.insertBefore(pill, title || null);
  }
}


// ---- Phase 1B: Rankings hero, compact filter bar, secondary Filters sheet --
// Reparents existing (already-wired) legacy controls into new compact/secondary
// containers rather than duplicating them, so every existing event listener
// keeps working untouched -- only where each control physically lives changes.


// ==========================================================================
// VIEWER FOUNDATION -- lightweight player selection, no accounts/auth.
// Personalisation only. See privacy note on getCurrentViewer() below.
// ==========================================================================


// ---- First-launch / switchable player selector ---------------------------
function buildViewerSelector(){
  const overlay = document.createElement('div');
  overlay.className = 'shell-more-sheet';
  overlay.id = 'viewerSelectorSheet';
  const panel = document.createElement('div');
  panel.className = 'shell-more-panel viewer-selector-panel';
  panel.innerHTML = `
    <div class="mp-section-label" style="text-align:center;">Welcome to ${escapeHtml(CLUB.name)}</div>
    <div class="mp-display-title viewer-selector-title">Who are you?</div>
    <div class="viewer-selector-sub">Choose your player to personalise your experience.</div>
    <input type="text" id="viewerSearchInput" class="viewer-search" placeholder="Search players…">
    <div id="viewerPlayerList" class="viewer-player-list"></div>
    <button type="button" class="viewer-skip" id="viewerSkipBtn">Not now</button>
  `;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function renderList(filter){
    const listEl = document.getElementById('viewerPlayerList');
    // Real player data only -- never a second hard-coded list -- and only the
    // people in the group now: an archived player is not offered.
    const names = livePlayerNames();
    const filtered = filter ? names.filter(n=>n.toLowerCase().includes(filter.toLowerCase())) : names;
    listEl.innerHTML = filtered.length
      ? filtered.map(n=>`<button class="viewer-player-btn" data-name="${n}">${n}</button>`).join('')
      // A new community has nobody to choose yet (Padel Championships, 8 Nov).
      : `<div class="viewer-empty">${names.length ? 'No player by that name.' : `No players yet. An Admin adds them in More › Admin › Player tags.`}</div>`;
    listEl.querySelectorAll('.viewer-player-btn').forEach(btn=>{
      btn.onclick = ()=>{
        setCurrentViewer(btn.dataset.name);
        overlay.classList.remove('show');
        setTimeout(()=> overlay.remove(), 250);
        updateMyPlayerLabel();
      };
    });
  }
  renderList('');
  document.getElementById('viewerSearchInput').addEventListener('input', (e)=> renderList(e.target.value));
  // Never a trap: anyone can look around first, and choose later from More.
  document.getElementById('viewerSkipBtn').onclick = ()=>{
    overlay.classList.remove('show');
    setTimeout(()=> overlay.remove(), 250);
  };
  overlay.classList.add('show');
}

// ---- "My Player" entry in More -------------------------------------------
function updateMyPlayerLabel(){
  const label = document.getElementById('myPlayerLabel');
  if(!label) return;
  const viewer = getCurrentViewer();
  label.textContent = viewer ? viewer.name : 'Choose player';
}

function buildMyPlayerMoreItem(){
  const sheet = document.getElementById('shellMoreSheet');
  if(!sheet) return;
  const panel = sheet.querySelector('.shell-more-panel');
  const adminItem = panel.querySelector('.admin-item');
  const item = document.createElement('button');
  item.className = 'shell-more-item';
  item.innerHTML = `My Player<span class="my-player-value"><span id="myPlayerLabel"></span> <span class="chev">›</span></span>`;
  item.onclick = ()=>{ closeMoreSheet(); buildViewerSelector(); };
  panel.insertBefore(item, adminItem);
  updateMyPlayerLabel();
}


// ==========================================================================
// PERSONALISED HOME -- replaces the plain monthly Summary as the Home
// landing. The legacy Summary/Stats Review is fully preserved and reachable
// via "View Full Review" -- nothing deleted, just no longer the default.
// Reuses existing calculations only (ranking, eligibility, recent form,
// partnerships, H2H, monthly stats, matchmaking) -- no parallel logic.
// ==========================================================================


// Insights, from the top. The tab keeps its own scroll position, which is right
// when you return to it and wrong when you arrive at it from somewhere else.
function openInsightsFromTop(){
  const btn = legacyTabBtn('callouts');
  if(btn) btn.click();
  const view = document.getElementById('calloutsView');
  if(view && view.scrollTop !== undefined) view.scrollTop = 0;
  try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch(e){ window.scrollTo(0, 0); }
}


// The Games feed, with that one match expanded. Works for every rated match,
// draws included.
function openMatchInGames(matchId){
  const btn = legacyTabBtn('games');
  if(btn) btn.click();
  if(typeof expandedGameId !== 'undefined') expandedGameId = matchId;
  if(typeof gamesMonth !== 'undefined') gamesMonth = 'all';
  if(typeof gamesType !== 'undefined') gamesType = 'all';
  if(typeof gamesPlayerIds !== 'undefined') gamesPlayerIds = [];
  if(typeof renderGamesTab === 'function') renderGamesTab();
  const card = document.querySelector(`#gamesView [data-gameid="${matchId}"]`);
  if(card) card.scrollIntoView({ block: 'center' });
}


// ==========================================================================
// PLAYER PROFILE -- premium dossier redesign
// Reuses every existing calculation (PLAYERS fields, BEST_PARTNER, H2H,
// WITHIN_TIER_GAMES/BOUNDARY_TESTS/CALIBRATION_GAMES, playerJourney,
// buildJourneyBodyHtml, computeRecentForm) -- no parallel rating/stat logic.
// Strategy: let the legacy openSheet() run fully first (unchanged), which
// still does all data prep AND wires every interactive element (match
// edit/delete, dev-area add/delete). Then physically restructure the DOM --
// reparenting the still-live dev-areas block and match cards rather than
// rebuilding their innerHTML, which would destroy those event listeners.
// ==========================================================================


document.addEventListener('DOMContentLoaded', ()=>{
  applyClubIdentity();
  const standings = isStandingsMode();
  if(standings) enterStandingsMode();
  buildShellDom();
  const hero = buildRankingsHero();
  buildCompactFiltersBar();
  buildRankingsColumnHeader();
  buildCollapsibleExplainer();
  syncFullHistoryIndicator();

  // Wrap the legacy render() so the podium (and ranking eligibility split)
  // are (re)computed on every Power Rating re-render, without touching
  // render() itself.
  let viewerInitDone = false;
  const _originalRender = window.render;
  window.render = function(){
    _originalRender.apply(this, arguments);
    // render() declines to draw anything before the record has arrived (see
    // DATA_READY in app.js), and everything below reads PLAYERS. A sort button
    // pressed during those few hundred milliseconds would otherwise run the
    // one-time set-up here -- the viewer, the Home dashboard -- against an
    // empty club, which is the case the comment below was written to avoid and
    // could not actually prevent.
    if(typeof DATA_READY !== 'undefined' && !DATA_READY) return;
    applyRankingEligibility();
    renderRankingsPodium();
    renderKingsOfTiersPanel();
    hero.style.display = (activeTab === 'power') ? 'block' : 'none';
    syncHeaderSectionTitle();
    // Viewer foundation init happens here, on the first real render, rather
    // than directly in DOMContentLoaded: app.js's init() is async and loads
    // Firestore data before calling recomputeAll(), so PLAYERS is not
    // reliably populated yet at DOMContentLoaded time. The first render()
    // call only ever happens after that data is loaded and PLAYERS is set,
    // which is what buildViewerSelector's real player list depends on.
    if(!viewerInitDone){
      viewerInitDone = true;
      buildMyPlayerMoreItem();
      buildHomeDashboard();
      // Wrap openSheet once PLAYERS/etc are guaranteed ready -- every internal
      // call site in app.js (after edit/delete/confirm) goes through this
      // same global function, so they all pick up the premium restructuring
      // automatically without touching those call sites.
      if(!isStandingsMode()){
        const _originalOpenSheet = window.openSheet;
        window.openSheet = function(name, matchFilter){
          _originalOpenSheet.apply(this, arguments);
          renderPremiumProfile(name, matchFilter);
        };
        // Not on a community with nobody in it yet: there is no one to choose.
        if(!getCurrentViewer() && livePlayerNames().length) buildViewerSelector();
      }
      // If Home is already the active section by the time data is ready (or
      // becomes active later), keep the dashboard in sync with the viewer.
      document.addEventListener('viewerchanged', ()=>{
        updateMyPlayerLabel();
        updateHeaderForSection(); // the header's "Osh ▾" label lives outside
                                   // #homeDashboard, so re-rendering the
                                   // dashboard alone never touches it -- this
                                   // is what was actually going stale.
        if(activeSection === 'home') renderHomeDashboard();
      });
      if(activeSection === 'home') renderHomeDashboard();
    }
  };
  // The hero also needs to hide immediately when leaving Rankings via a tab
  // that doesn't call render() at all (Players, Games, etc.).
  document.getElementById('tabrow').addEventListener('click', ()=>{
    hero.style.display = (activeTab === 'power') ? 'block' : 'none';
    syncHeaderSectionTitle();
    syncPlayHeadingVisibility();
    // Same fix as goToSection: internal navigation (e.g. "Edit this game"
    // jumping tabs) can also move away from Home without ever going through
    // goToSection, so this needs covering here too.
    if(activeSection !== 'home'){
      const dash = document.getElementById('homeDashboard');
      if(dash) dash.style.display = 'none';
    }
  });

  updateBottomNavHighlight();
  renderSectionSubnav();
  // The standings site opens on the League.
  if(standings){ const lg = legacyTabBtn('summary'); if(lg) lg.click(); }
  // A laptop or a monitor gets the desktop layout; a phone, nothing new.
  initDesktopShell();
  initMatchScorecard();

  // The shell exists. If the record is already here, this is the half that
  // finished second and the first screen is drawn now; if it is not, init()
  // draws it when it arrives. See drawFirstScreen() in app.js.
  SHELL_READY = true;
  drawFirstScreen();
});
