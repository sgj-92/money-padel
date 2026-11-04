// ===================== ME =====================
// Player Experience Reset, Phase 1 (docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md
// §4.15). Me replaces the More sheet: who you are on this device, and the
// settings, guides and tools More used to hold. Every row opens exactly what
// More opened -- only the way in has changed. The personal dashboard comes in
// Phase 5.
//
// Identity here is self-declared, never a sign-in (DQ5): with no player
// chosen, Me asks "Who are you?" and opens the existing selector.
//
// Owning stream: redesign. Loads before app.js; declarations only. The shell
// shows and hides #meView (goToSection('me')); this file only draws it.

// Where each row goes. Rows a reader may not open are not drawn.
function meRows(viewer){
  const you = viewer ? [{ me: 'profile', label: 'View my profile' }] : [];
  const settings = [
    { me: 'player', label: 'My Player', meta: viewer ? viewer.name : 'Not chosen' },
    { me: 'datarange', label: 'Data & Rankings', meta: (typeof dataRange !== 'undefined' && dataRange === 'all') ? 'Full history' : 'Verified data' },
  ];
  // The Admin screen is lock-gated, not hidden: a locked reader is offered
  // the way to sign in, an unlocked one the tools.
  if(!isUnlocked) settings.push({ me: 'admin', label: 'Admin sign-in' });
  // Predict a Matchup leads for an admin and is absent for everyone else
  // (Shaun, 4 Oct: the top of More, Admin only -- Me is More's successor).
  const admin = isUnlocked ? { title: 'Admin', rows: [
    ...(canSeePredictions() ? [{ me: 'predict', label: 'Predict a Matchup' }] : []),
    { me: 'admin', label: 'Admin / Manage' },
  ] } : null;
  const groups = [
    { title: 'You', rows: you },
    ...(admin ? [admin] : []),
    { title: 'Settings', rows: settings },
    { title: 'About the rankings', rows: [
      { me: 'guide', label: 'Power Rating Guide' },
      { me: 'about', label: 'About Power Rankings' },
    ] },
    { title: 'Club', rows: [{ me: 'doughnuts', label: 'Doughnuts' }] },
  ];
  return groups.filter(g => g.rows.length);
}

function meIdentityHtml(viewer){
  if(!viewer){
    return `<div class="mp-card-self me-identity">
      <div class="mp-serif-display me-name">Who are you?</div>
      <div class="me-identity-sub">Choose your player to see your games and your standing.</div>
      <button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent me-choose" data-me="player">Choose your player</button>
    </div>`;
  }
  return `<div class="mp-card-self me-identity">
    <div class="mp-serif-display me-name">${escapeHtml(viewer.name)}</div>
    <div class="me-identity-sub">Your player on this device. There is no sign-in — anyone can change it.</div>
  </div>`;
}

function renderMe(){
  const box = document.getElementById('meView');
  if(!box) return;
  const viewer = getCurrentViewer();
  const groups = meRows(viewer);
  box.innerHTML = `<div class="me-inner">
    <div class="mp-section-label">${escapeHtml(CLUB.name)}</div>
    <h2 class="mp-serif-display me-title">Me</h2>
    ${meIdentityHtml(viewer)}
    ${groups.map(g => `${mpSectionHeadHtml({ title: g.title })}
      <div class="shell-list">${g.rows.map(r => mpListRowHtml({ label: r.label, meta: r.meta, data: { me: r.me } })).join('')}</div>`).join('')}
  </div>`;
  box.querySelectorAll('[data-me]').forEach(el => { el.onclick = () => meOpen(el.dataset.me); });
}

// Each destination exactly as More opened it.
function meOpen(which){
  const viewer = getCurrentViewer();
  if(which === 'profile' && viewer) openSheet(viewer.name);
  else if(which === 'player') buildViewerSelector();
  else if(which === 'datarange') openDataRangeSheet();
  else if(which === 'guide') openPowerRatingGuide();
  else if(which === 'about') openAboutPowerRankings();
  else if(which === 'doughnuts') openDoughnutLeaderboard();
  else if(which === 'predict') openPredictMatchup();   // refuses anyone who is not an admin
  else if(which === 'admin'){ const b = legacyTabBtn('manage'); if(b) b.click(); }
}
