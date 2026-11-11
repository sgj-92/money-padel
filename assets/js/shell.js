// ==========================================================================
// SHELL -- Home · Rankings · Play · Players · Me
// Player Experience Reset, Phase 1 (30 Sep 2026): More became Me, Rankings'
// primary entries became Power | This Month with the rest under More tables,
// each section's entries became one segmented control, Play carries a badge,
// and the phone's Back works inside the app (ui/shellHistory.js).
// This file adds the navigation on top of the existing app, WITHOUT renaming
// or altering any legacy tab identity.
// Legacy tab values (summary, power, findgame, players, wl, callouts, h2h,
// games, wishlist, upcoming, manage) are untouched -- this is a mapping layer
// only, per the agreed Phase 1 contract. Load this file after app.js.
// ==========================================================================

// SINGLE-TAB sections (no subnav): Home only.
const SECTION_TAB_MAP = { home: 'summary' };

// MULTI-TAB sections: a visible segmented subnav under the header, per the IA
// correction. First entry in each list is that section's default landing tab.
// Rankings has two primary entries (the IA, 30 Sep): Power, current club
// strength, and This Month, the League / Merit / Race screen. Everything else
// Rankings holds is under More tables (RANKINGS_MORE_TABLES).
// Play's My Games | Club and Players' Directory -> Profile are new screens,
// built in Phases 2 and 5; until then those sections keep their existing
// destinations, drawn with the same segmented control.
const SECTION_SUBNAV = {
  rankings: [
    { tab: 'power', label: 'Power' },
    { tab: 'summary', label: 'This Month' },
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

// Rankings › More tables: the tables and stories that are not Power or This
// Month. The Power Rating Guide, About, Data & Rankings, My Player and Admin
// moved to Me (features/me/meScreen.js); Doughnuts is reachable from both.
// North vs South is not listed: it lives in Admin / Manage (Shaun, 4 Oct).
const RANKINGS_MORE_TABLES = [
  { tab: 'wl', label: 'Win / Loss' },
  { tab: 'callouts', label: 'Insights / Call-Outs' },
  { special: 'doughnuts', label: 'Doughnuts' },
];

// Which section each legacy tab belongs to -- the bottom-nav highlight and
// visibleFallbackTab (permissions.js) read it.
const TAB_TO_SECTION = { summary: 'home' };
Object.keys(SECTION_SUBNAV).forEach(sec=>{
  SECTION_SUBNAV[sec].forEach(item=>{ TAB_TO_SECTION[item.tab] = sec; });
});
RANKINGS_MORE_TABLES.forEach(item=>{ if(item.tab) TAB_TO_SECTION[item.tab] = 'rankings'; });
TAB_TO_SECTION.manage = 'me';

const SECTION_LABELS = { home:'Home', rankings:'Rankings', play:'Play', players:'Players', me:'Me' };

// Screens the shell draws over the app -- Me, and Play's My Games and Club
// (Phase 2). Each has its own view and a body class that hides the app's
// screens (shell.css), so whatever is underneath keeps its state.
const SHELL_SCREENS = {
  me: { section: 'me', cls: 'is-me', render: () => renderMe() },
  mygames: { section: 'play', cls: 'is-mygames', render: () => renderMyGames() },
  club: { section: 'play', cls: 'is-club', render: () => renderClub() },
};
// Play's primary entries (the IA): My Games | Club, with Arrange a Game beside
// them. Play's four existing screens stay reachable -- Played Games & Results
// and Find a Game from these screens, and the previous Upcoming and Requests
// until the new lists are accepted.
const SECTION_SCREENS = {
  play: [{ screen: 'mygames', label: 'My Games' }, { screen: 'club', label: 'Club' }],
};
let activeShellScreen = null;
// My Games and Club list requests and agreed games: they exist for a reader
// who may see either.
function playScreensVisible(){ return canSeeTab('wishlist') || canSeeTab('upcoming'); }

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
  applyHomeScreenIcon();
  const tag = document.querySelector('#legacyHeader .tag');
  if(tag) tag.textContent = `${CLUB.name} · ${CLUB.resultsGroup}`;
}

// A community with its own Home Screen icon (CLUB.homeIcon) replaces Money
// Padel's in the page's icon links and its manifest -- the manifest too,
// because a phone takes the saved name and icon from it as well. The links
// are replaced, not edited, so nothing holds on to the first ones.
function applyHomeScreenIcon(){
  const icon = CLUB.homeIcon;
  if(!icon) return;
  const abs = (p) => new URL(p, location.href).href;
  const swap = (rel, attrs) => {
    document.querySelectorAll(`link[rel="${rel}"]`).forEach(l => l.remove());
    const l = document.createElement('link');
    l.rel = rel;
    Object.entries(attrs).forEach(([k, v]) => l.setAttribute(k, v));
    document.head.appendChild(l);
  };
  const bg = (CLUB.theme && CLUB.theme.themeColor) || '#0b0a08';
  const manifest = { name: CLUB.homeScreenTitle, short_name: CLUB.homeScreenTitle, start_url: abs('./'), display: 'standalone',
    background_color: bg, theme_color: bg,
    icons: [{ src: abs(icon[180]), sizes: '180x180', type: 'image/png' }, { src: abs(icon[512]), sizes: '512x512', type: 'image/png' }] };
  swap('icon', { href: icon[180], type: 'image/png' });
  swap('apple-touch-icon', { href: icon[180], sizes: '180x180' });
  swap('manifest', { href: 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest)) });
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
  // The three are the whole site: no More tables either.
  RANKINGS_MORE_TABLES.length = 0;
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
  if(section === 'me'){ enterShellScreen('me'); return; }
  if(section === 'play' && playScreensVisible()){ enterShellScreen('mygames'); return; }
  leaveShellScreen();
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
  shellNavChanged();
}

// A shell screen is drawn over the app rather than through a legacy tab: its
// body class hides every app screen (shell.css), so the screen underneath --
// activeTab, its month, its filters -- is exactly as it was when the reader
// comes back.
function enterShellScreen(name){
  const s = SHELL_SCREENS[name];
  if(!s) return;
  leaveShellScreen();
  activeShellScreen = name;
  activeSection = s.section;
  document.body.classList.add(s.cls);
  s.render();
  updateBottomNavHighlight();
  renderSectionSubnav();
  syncPlayHeadingVisibility();
  updateHeaderForSection();
  try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch(e){ window.scrollTo(0, 0); }
  shellNavChanged();
}
function leaveShellScreen(){
  Object.values(SHELL_SCREENS).forEach(s => document.body.classList.remove(s.cls));
  activeShellScreen = null;
}
// Redraw whatever the shell is showing: after a change to the record, or a
// panel opened or shut inside it.
function refreshShellScreen(){
  if(activeShellScreen) SHELL_SCREENS[activeShellScreen].render();
  if(typeof refreshPlaySheets === 'function') refreshPlaySheets();
}
function enterMe(){ enterShellScreen('me'); }
function leaveMe(){ leaveShellScreen(); }

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
    titleEl.innerHTML = SECTION_LABELS[activeSection] || '';
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

// Renders (or hides) the section's segmented control (role="tablist") under
// the header -- always on screen for a section with more than one entry,
// never a hidden menu. Rankings adds its More tables button beside it.
function renderSectionSubnav(){
  const container = document.getElementById('sectionSubnav');
  // A section's own screens (Play's My Games | Club), else its legacy tabs --
  // only those this reader may see (canSeeTab, permissions.js).
  const screens = (activeSection === 'play' && playScreensVisible()) ? SECTION_SCREENS.play : [];
  const entries = screens.length
    ? screens.map(s => ({ attr: `data-screen="${s.screen}"`, label: s.label, on: activeShellScreen === s.screen }))
    : (SECTION_SUBNAV[activeSection] || []).filter(it => it.href || canSeeTab(it.tab))
        .map(it => ({ attr: `data-tab="${it.tab}"`, label: it.label, href: it.href, on: !it.href && it.tab === activeTab && !activeShellScreen }));
  const moreTables = activeSection === 'rankings' ? rankingsMoreTablesVisible() : [];
  const arrange = activeSection === 'play' ? arrangeModesVisible() : [];
  if(entries.length < 2 && !moreTables.length && !arrange.length){ container.style.display = 'none'; container.innerHTML = ''; syncDesktopShell(); return; }
  container.style.display = 'flex';
  const onMore = moreTables.some(it => it.tab === activeTab);
  container.innerHTML = `<div class="mp-seg" role="tablist" aria-label="${escapeHtml(SECTION_LABELS[activeSection] || '')}">`
    + entries.map(it => it.href
      // A page of its own (the standings site's Monthly: review/), so a link.
      ? `<a class="section-subnav-item mp-seg-item" ${it.attr} href="${it.href}" tabindex="-1">${escapeHtml(it.label)}</a>`
      : `<button type="button" role="tab" class="section-subnav-item mp-seg-item${it.on ? ' active' : ''}" ${it.attr} aria-selected="${it.on}" tabindex="${it.on ? 0 : -1}">${escapeHtml(it.label)}</button>`
    ).join('')
    + `</div>`
    + (moreTables.length ? `<button type="button" class="section-more-btn" id="rankingsMoreBtn" aria-haspopup="dialog" aria-pressed="${onMore}">More tables</button>` : '')
    + (arrange.length ? `<button type="button" class="section-more-btn section-arrange-btn" id="arrangeGameBtn" aria-haspopup="dialog">Arrange a Game</button>` : '');
  const tabs = [...container.querySelectorAll('.section-subnav-item')];
  tabs.forEach((btn, i)=>{
    if(btn.tagName === 'A') return;   // a link goes where it points
    btn.onclick = ()=>{
      if(btn.dataset.screen){ enterShellScreen(btn.dataset.screen); return; }
      const b = legacyTabBtn(btn.dataset.tab); if(b) b.click();
    };
    // Arrow keys move along the control, as a tablist should.
    btn.onkeydown = (ev)=>{
      const step = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if(!step) return;
      ev.preventDefault();
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus(); next.click();
    };
  });
  const more = document.getElementById('rankingsMoreBtn');
  if(more) more.onclick = openRankingsMoreTables;
  const arr = document.getElementById('arrangeGameBtn');
  if(arr) arr.onclick = ()=> openArrangeGame();
  syncDesktopShell();
}

function rankingsMoreTablesVisible(){
  return RANKINGS_MORE_TABLES.filter(it => !it.tab || canSeeTab(it.tab));
}

// Rankings › More tables: a sheet on the existing modal primitive, so it
// closes like every other (backdrop, Back).
function openRankingsMoreTables(){
  let sheet = document.getElementById('rankingsMoreSheet');
  if(!sheet){
    sheet = document.createElement('div');
    sheet.className = 'shell-more-sheet';
    sheet.id = 'rankingsMoreSheet';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e)=>{ if(e.target === sheet) sheet.classList.remove('show'); });
  }
  sheet.innerHTML = `<div class="shell-more-panel">
    <h3>More tables</h3>
    <div class="shell-list">${rankingsMoreTablesVisible().map(it => mpListRowHtml({ label: it.label, data: it.tab ? { tab: it.tab } : { special: it.special } })).join('')}</div>
  </div>`;
  sheet.querySelectorAll('.mp-list-row').forEach(row=>{
    row.onclick = ()=>{
      sheet.classList.remove('show');
      if(row.dataset.special === 'northsouth') openNorthSouth();
      else if(row.dataset.special === 'doughnuts') openDoughnutLeaderboard();
      else if(row.dataset.tab === 'callouts') openInsightsFromTop();
      else { const b = legacyTabBtn(row.dataset.tab); if(b) b.click(); }
    };
  });
  sheet.classList.add('show');
}

// The Play badge (DQ29): what the selected player must act on, counted on the
// functional side (playActionCount, features/play/fixturesData.js). Hidden at
// zero, with no player chosen, before the record has arrived, and whenever
// Requests or Upcoming is hidden from this reader -- it never points at a
// screen they cannot open.
function updatePlayBadge(){
  const el = document.getElementById('playNavBadge');
  if(!el) return;
  const viewer = (typeof DATA_READY !== 'undefined' && DATA_READY) ? getCurrentViewer() : null;
  const reachable = canSeeTab('wishlist') && canSeeTab('upcoming');
  const n = viewer && reachable ? playActionCount(viewer.name) : 0;
  el.innerHTML = mpCountBadgeHtml(n, n === 1 ? 'thing waiting on you' : 'things waiting on you');
}

// Unlocking, locking or changing a visibility setting redraws the shell's own
// navigation from the same rule, and moves a reader off a screen they may no
// longer see.
function onVisibilityChanged(){
  if(typeof renderSectionSubnav === 'function' && document.getElementById('sectionSubnav')) renderSectionSubnav();
  updatePlayBadge();
  // Off a Play list the reader may no longer see; otherwise redraw what is shown.
  if((activeShellScreen === 'mygames' || activeShellScreen === 'club') && !playScreensVisible()) goToSection('play');
  else refreshShellScreen();
  if(typeof activeTab !== 'undefined' && !canSeeTab(activeTab)){
    const fb = legacyTabBtn(visibleFallbackTab(activeTab));
    if(fb) fb.click();
  }
}

function buildShellDom(){
  // Header
  const header = document.createElement('div');
  header.className = 'shell-header';
  header.innerHTML = `
    <div class="brand-mark"><img src="${CLUB.logo}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'nav-icon-fallback',textContent:${escapeHtml(JSON.stringify(CLUB.monogram))}}))"></div>
    <div class="brand-wordmark">${clubWordmarkHtml()}</div>
    <div class="shell-section-title" id="shellSectionTitle">Rankings</div>
    <button type="button" class="shell-capture-btn" id="shellCaptureBtn" aria-label="Make a picture of part of the screen" title="Make a picture">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
    </button>
  `;
  document.body.insertBefore(header, document.body.firstChild);
  header.querySelector('#shellCaptureBtn').onclick = () => (captureState ? endCapture() : startCapture());

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

  // Me (features/me/meScreen.js) -- shown instead of the app's screens.
  const meView = document.createElement('div');
  meView.id = 'meView';
  playHeading.parentNode.insertBefore(meView, playHeading.nextSibling);
  // Play's My Games and Club (features/play/playScreens.js), shown the same way.
  ['clubView', 'myGamesView'].forEach(id => {
    const el = document.createElement('div');
    el.id = id;
    meView.parentNode.insertBefore(el, meView.nextSibling);
  });

  // Bottom nav
  const nav = document.createElement('div');
  nav.className = 'shell-bottom-nav';
  const navItems = [
    { section: 'home', label: 'Home', icon: 'home' },
    { section: 'rankings', label: 'Rankings', icon: 'rankings' },
    { section: 'play', label: 'Play', icon: 'play' },
    { section: 'players', label: 'Players', icon: 'players' },
    { section: 'me', label: 'Me', icon: 'me' },
  ];
  nav.innerHTML = navItems.map(it => `
    <button class="shell-nav-item" data-section="${it.section}">
      <span class="nav-icon-mount" data-icon="${it.icon}" data-fallback="${it.label[0]}"></span>
      <span>${it.label}</span>${it.section === 'play' ? '<span class="shell-nav-badge" id="playNavBadge"></span>' : ''}
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

  // About, Doughnuts and North vs South are features (features/rankings/
  // ratingGuide.js, doughnutsScreen.js, northSouthScreen.js), opened by name
  // from Me and from Rankings › More tables.

  // Keep bottom-nav highlight (and section subnav) in sync no matter how the
  // legacy tab changes (new nav, subnav, Me, More tables, or internal app.js
  // navigation like "Edit this game"). Any of them leaves Me.
  document.getElementById('tabrow').addEventListener('click', (e)=>{
    const btn = e.target.closest('.tab-btn');
    if(!btn) return;
    const tab = btn.dataset.tab;
    leaveMe();
    activeSection = TAB_TO_SECTION[tab] || 'rankings';
    updateBottomNavHighlight();
    const titleEl = document.getElementById('shellSectionTitle');
    if(titleEl) titleEl.textContent = SECTION_LABELS[activeSection] || '';
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
    updatePlayBadge();
    shellNavChanged();
  });
}

// ---- Data & Rankings: the app-wide Data Range setting ---------------------
// Deliberately a setting, not a filter: it lives in Me, it persists, and it
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
    // people in the group now: an archived player is not offered. Players
    // added but not yet rated are people too (Padel Championships, 11 Nov).
    const names = typeof entryPlayerNames === 'function' ? entryPlayerNames() : livePlayerNames();
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

// ---- The chosen player changed: what shows it follows ----------------------
// (My Player lives in Me; My Games and the Play badge are the chosen player's.)
function updateMyPlayerLabel(){
  refreshShellScreen();
  updatePlayBadge();
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
    updatePlayBadge();
    // Viewer foundation init happens here, on the first real render, rather
    // than directly in DOMContentLoaded: app.js's init() is async and loads
    // Firestore data before calling recomputeAll(), so PLAYERS is not
    // reliably populated yet at DOMContentLoaded time. The first render()
    // call only ever happens after that data is loaded and PLAYERS is set,
    // which is what buildViewerSelector's real player list depends on.
    if(!viewerInitDone){
      viewerInitDone = true;
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
        if(!getCurrentViewer() && (typeof entryPlayerNames === 'function' ? entryPlayerNames() : livePlayerNames()).length) buildViewerSelector();
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

  // Every change to the record ends at dataChanged() (app.js); the Play badge
  // follows it, as the screens do. Home's Full Review is a screen of its own
  // for Back, and its own "Back to Home" button takes that entry with it.
  const _originalDataChanged = window.dataChanged;
  window.dataChanged = function(){
    const r = _originalDataChanged.apply(this, arguments);
    updatePlayBadge();
    refreshShellScreen();
    return r;
  };
  // Panels opened or shut inside a fixture (Manage fixture, remove, answers)
  // redraw through renderActiveTab; the shell's own screens and sheets follow.
  const _originalRenderActiveTab = window.renderActiveTab;
  window.renderActiveTab = function(){
    const r = _originalRenderActiveTab.apply(this, arguments);
    refreshShellScreen();
    return r;
  };
  const _originalFullReview = window.showFullMonthlyReview;
  window.showFullMonthlyReview = function(){
    shellFlushNav(); // Home itself first, if it has only just been opened
    _originalFullReview.apply(this, arguments);
    const back = document.getElementById('homeBackFromReview');
    if(back && !back.dataset.shellHistory){
      back.dataset.shellHistory = '1';
      const own = back.onclick;
      back.onclick = function(){
        const top = history.state && history.state.mpNav;
        if(top && top.review) history.back(); else own.apply(this, arguments);
      };
    }
    shellNavChanged();
  };

  updateBottomNavHighlight();
  renderSectionSubnav();
  // The standings site opens on the League.
  if(standings){ const lg = legacyTabBtn('summary'); if(lg) lg.click(); }
  shellHistoryInstall();
  // A laptop or a monitor gets the desktop layout; a phone, nothing new.
  initDesktopShell();
  initMatchScorecard();

  // The shell exists. If the record is already here, this is the half that
  // finished second and the first screen is drawn now; if it is not, init()
  // draws it when it arrives. See drawFirstScreen() in app.js.
  SHELL_READY = true;
  drawFirstScreen();
});
