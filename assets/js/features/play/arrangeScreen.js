// ===================== PLAY: ARRANGE A GAME =====================
// Player Experience Reset, Phase 2 (map §4.8, §4.9, §4.16). One entry point for
// the three ways a game gets going:
//   Find a game   Match Ideas -- a suggested matchup for you (DQ32) -- and the
//                 full Find a Game screen, one tap on
//   Request       name four players; optional date, time and venue (DQ9)
//   Paste a list  the existing Add multiple games check (restyled in Phase 6)
//
// Presentation only. A suggestion is computeMatchToMake (Home's Match ideas);
// a request is submitGameRequest -- the one path Requests' form also uses.
// No player sees a predicted split or a favourite call (D4): the split shows
// for an admin only, as everywhere else.
//
// Owning stream: redesign. Loads before app.js; declarations only.

let arrangeMode = null;
let arrangeDraft = null; // { names: [4], date, time, venue }
// Agreed game (Admin; Shaun, 19 Nov: "quite inaccessible to quickly add agreed
// games that we have sorted on WhatsApp"). Date, venue and the booking stay
// after a save, so a run of games is quick; the names clear.
let agreedDraft = null;  // { names: [4], date, time, venue, booked }
let agreedFlash = '';

// The modes this reader may use: finding follows Find a Game's setting,
// requesting follows Requests'.
function arrangeModesVisible(){
  const modes = [];
  // An Admin's own fast path comes first, so Arrange a Game opens on it.
  if(isUnlocked) modes.push({ id: 'agreed', label: 'Agreed' });
  if(canSeeTab('findgame')) modes.push({ id: 'find', label: 'Find a game' });
  if(canSeeTab('wishlist')){
    modes.push({ id: 'request', label: 'Request' });
    modes.push({ id: 'paste', label: 'Paste a list' });
  }
  // Four do not fit a phone's width in full: one word each.
  if(modes.length > 3) modes.forEach(m => { m.label = { find: 'Find', paste: 'Paste' }[m.id] || m.label; });
  return modes;
}

function openArrangeGame(mode, draft){
  const modes = arrangeModesVisible();
  if(!modes.length) return;
  const has = (m) => modes.some(x => x.id === m);
  arrangeMode = has(mode) ? mode : has(arrangeMode) ? arrangeMode : modes[0].id;
  if(draft) arrangeDraft = draft;
  agreedFlash = '';
  renderArrange(true);
}

function arrangeFindHtml(viewer){
  if(!viewer) return playWhoAreYouHtml();
  const m = computeMatchToMake(viewer.name);
  const suggestion = m ? `<div class="mp-card-standard arrange-suggestion">
      <div class="mp-section-label">Suggested for you</div>
      <div class="arrange-teams">You &amp; ${escapeHtml(m.partner.name)} <span class="arrange-v">v</span> ${escapeHtml(m.opponents[0].name)} &amp; ${escapeHtml(m.opponents[1].name)}</div>
      <div class="arrange-why">A well-balanced matchup, from Find a Game's own pairing.</div>
      ${canSeePredictions() ? `<div class="arrange-admin">${mpPillHtml('Admin', 'admin')} Expected to win about ${m.pctFor}% of the games, against ${m.pctAgainst}%</div>` : ''}
      <button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent arrange-use"
        data-names="${escapeHtml(JSON.stringify([viewer.name, m.partner.name, m.opponents[0].name, m.opponents[1].name]))}">Request this game</button>
    </div>` : `<div class="play-empty-sub play-empty-line">Not enough eligible players to suggest a matchup right now.</div>`;
  return suggestion + `<div class="shell-list arrange-onward">${mpListRowHtml({ label: 'Open Find a Game', meta: 'filters, partners, rematches', data: { arrange: 'finder' } })}</div>`;
}

// The four, laid out as Add a game lays them out (Shaun, 23 Nov: "can the
// arrange a game match the format as the add a game does"): Team A over Team
// B, a full-width box each, Player name and Partner.
function arrangeTeamsHtml(names, cls, listId, firstLabel){
  const box = (i, placeholder, last) => `<input class="fg-select ${cls}" data-seat="${i}" list="${listId}" value="${escapeHtml(names[i] || '')}" placeholder="${placeholder}" autocomplete="off" aria-label="${placeholder}"${last ? '' : ' style="margin-bottom:6px;"'}>`;
  return `<div class="arrange-form">
    <div class="fg-row"><label class="fg-label">${firstLabel}</label>${box(0, 'Player name')}${box(1, 'Partner', true)}</div>
    <div class="arrange-vs" aria-hidden="true">v</div>
    <div class="fg-row"><label class="fg-label">Team B</label>${box(2, 'Player name')}${box(3, 'Partner', true)}</div>`;
}
const arrangeRowHtml = (label, input) => `<div class="fg-row"><label class="fg-label">${label}</label>${input}</div>`;

function arrangeRequestHtml(viewer){
  if(!viewer) return playWhoAreYouHtml();
  const d = arrangeDraft || { names: [viewer.name, '', '', ''], date: '', time: '', venue: '' };
  arrangeDraft = d;
  return `<div class="play-note">You're in as soon as you ask; the other three answer from Needs you.</div>
    <datalist id="arrangeNames">${allPlayerNames().map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>
    ${arrangeTeamsHtml(d.names, 'arrange-name', 'arrangeNames', 'Team A (you)')}
    <div class="mp-section-label arrange-optional">Suggest a time and place — optional</div>
    <div class="arrange-when">
      ${arrangeRowHtml('Date', `<input type="date" class="fg-select arrange-date" value="${escapeHtml(d.date || '')}">`)}
      ${arrangeRowHtml('Time', `<input type="time" class="fg-select arrange-time" value="${escapeHtml(d.time || '')}">`)}
    </div>
    <div class="arrange-hint">${typeof availabilityHintHtml === 'function' ? availabilityHintHtml(d.names, d.date, d.time) : ''}</div>
    ${arrangeRowHtml('Venue', `<input class="fg-select arrange-venue" value="${escapeHtml(d.venue || '')}" placeholder="Court or venue">`)}
    <button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent arrange-send"></button>
    <div class="play-flash arrange-msg" role="status"></div>
    </div>`;
}

function arrangeAgreedHtml(){
  const d = agreedDraft || { names: ['', '', '', ''], date: '', time: '', venue: '', booked: false };
  agreedDraft = d;
  return `<div class="play-note">Already agreed in WhatsApp: nobody is asked to confirm.</div>
    <datalist id="agreedNames">${entryPlayerNames().map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>
    ${arrangeTeamsHtml(d.names, 'agreed-name', 'agreedNames', 'Team A')}
    <div class="arrange-when">
      ${arrangeRowHtml('Date', `<input type="date" class="fg-select agreed-date" value="${escapeHtml(d.date || '')}">`)}
      ${arrangeRowHtml('Time', `<input type="time" class="fg-select agreed-time" value="${escapeHtml(d.time || '')}">`)}
    </div>
    <div class="agreed-hint">${typeof availabilityHintHtml === 'function' ? availabilityHintHtml(d.names, d.date, d.time) : ''}</div>
    ${arrangeRowHtml('Venue', `<input class="fg-select agreed-venue" value="${escapeHtml(d.venue || '')}" placeholder="Court or venue">`)}
    <label class="fx-m-booking fx-m-switch-row"><span class="fx-m-switch-text"><b>Court booked</b><span class="fx-m-sub">Goes straight to Upcoming; otherwise Called Out.</span></span>
      <input type="checkbox" role="switch" class="mp-switch agreed-booked"${d.booked ? ' checked' : ''}></label>
    <button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent agreed-save">Add agreed game</button>
    <button type="button" class="preset-btn agreed-suggest">Not agreed yet? Suggest it to all four</button>
    <div class="play-note agreed-suggest-note">They each get a notification and say whether they'd play it.</div>
    <div class="play-flash agreed-msg" role="status">${escapeHtml(agreedFlash)}</div>
    </div>
    <div class="shell-list arrange-onward">${mpListRowHtml({ label: 'Several at once? Paste a list', data: { arrange: 'paste' } })}</div>`;
}

function arrangePasteHtml(){
  return `<div class="play-note">Paste a list of games from WhatsApp. Each line is checked — names are matched exactly and never guessed — and nothing is sent until you have reviewed it.</div>
    <div class="shell-list">${mpListRowHtml({ label: 'Open Add multiple games', data: { arrange: 'paste' } })}</div>`;
}

// The button says what is missing, or what it will do.
function arrangeSendLabel(){
  const missing = (arrangeDraft ? arrangeDraft.names : []).filter(n => !String(n || '').trim()).length;
  return missing ? `Add ${missing} more player${missing > 1 ? 's' : ''}` : 'Send request';
}

function renderArrange(show){
  const sheet = playSheet('arrangeSheet');
  const modes = arrangeModesVisible();
  if(!modes.length){ sheet.classList.remove('show'); return; }
  const viewer = getCurrentViewer();
  const body = arrangeMode === 'agreed' ? arrangeAgreedHtml()
    : arrangeMode === 'find' ? arrangeFindHtml(viewer)
    : arrangeMode === 'request' ? arrangeRequestHtml(viewer) : arrangePasteHtml();
  sheet.innerHTML = `<div class="shell-more-panel arrange-sheet" role="dialog" aria-label="Arrange a Game">
    <div class="game-sheet-head"><h3>Arrange a Game</h3><button type="button" class="mp-sheet-close arrange-close" aria-label="Close">×</button></div>
    ${modes.length > 1 ? mpSegmentedHtml(modes, arrangeMode, 'Arrange a Game') : ''}
    ${typeof whosFreeOn === 'function' && whosFreeOn() ? `<button type="button" class="wf-browse wf-arrange" data-free-day="">See who's free this week ›</button>` : ''}
    <div class="arrange-body">${body}</div>
  </div>`;
  const panel = sheet.querySelector('.arrange-sheet');
  panel.querySelector('.arrange-close').onclick = () => sheet.classList.remove('show');
  panel.querySelectorAll('.mp-seg-item').forEach(b => { b.onclick = () => { arrangeMode = b.dataset.seg; renderArrange(false); }; });
  panel.querySelectorAll('.play-choose').forEach(b => { b.onclick = () => buildViewerSelector(); });
  panel.querySelectorAll('.arrange-use').forEach(b => {
    b.onclick = () => { arrangeDraft = { names: JSON.parse(b.dataset.names), date: '', time: '', venue: '' }; arrangeMode = 'request'; renderArrange(false); };
  });
  panel.querySelectorAll('[data-arrange]').forEach(b => {
    b.onclick = () => {
      sheet.classList.remove('show');
      if(b.dataset.arrange === 'finder'){ const t = legacyTabBtn('findgame'); if(t) t.click(); }
      else {
        requestSectionOpen.bulk = true;
        const t = legacyTabBtn('wishlist'); if(t) t.click();
        const fold = document.getElementById('reqFoldBulk');
        if(fold) fold.scrollIntoView({ block: 'start' });
      }
    };
  });
  const save = panel.querySelector('.agreed-save');
  if(save){
    const read = () => {
      agreedDraft = { names: [...panel.querySelectorAll('.agreed-name')].map(i => i.value),
        date: panel.querySelector('.agreed-date').value, time: panel.querySelector('.agreed-time').value,
        venue: panel.querySelector('.agreed-venue').value, booked: panel.querySelector('.agreed-booked').checked };
      const hint = panel.querySelector('.agreed-hint');
      if(hint && typeof availabilityHintHtml === 'function') hint.innerHTML = availabilityHintHtml(agreedDraft.names, agreedDraft.date, agreedDraft.time);
    };
    panel.querySelectorAll('input').forEach(i => { i.addEventListener('input', read); i.addEventListener('change', read); });
    save.onclick = async () => {
      read();
      const msg = panel.querySelector('.agreed-msg');
      save.disabled = true;
      const r = await addAgreedGame({ ...agreedDraft, by: fixtureAdminName() });
      save.disabled = false;
      if(!r.ok){ msg.textContent = r.message; return; }
      const [a, b] = requestTeams(r.req);
      agreedFlash = `Added: ${a.join(' & ')} v ${b.join(' & ')} — ${r.message.replace(/^Added to /, 'in ').replace(/\.$/, '')}. Add another, or close.`;
      agreedDraft = { ...agreedDraft, names: ['', '', '', ''] };
      dataChanged();
      renderArrange(false);
      const first = playSheet('arrangeSheet').querySelector('.agreed-name');
      if(first) first.focus();
    };
    // Suggest it instead (Shaun, 25 Nov): all four are asked, nobody is in yet.
    const suggest = panel.querySelector('.agreed-suggest');
    if(suggest) suggest.onclick = async () => {
      read();
      const msg = panel.querySelector('.agreed-msg');
      suggest.disabled = true;
      const r = await suggestGame({ ...agreedDraft, by: fixtureAdminName() });
      suggest.disabled = false;
      if(!r.ok){ msg.textContent = r.message; return; }
      const [a, b] = requestTeams(r.req);
      agreedFlash = `Suggested: ${a.join(' & ')} v ${b.join(' & ')}. All four are asked; it's a game when they all say yes.`;
      agreedDraft = { ...agreedDraft, names: ['', '', '', ''] };
      dataChanged();
      renderArrange(false);
    };
  }
  const send = panel.querySelector('.arrange-send');
  if(send){
    const sync = () => {
      arrangeDraft.names = [...panel.querySelectorAll('.arrange-name')].map(i => i.value);
      arrangeDraft.date = panel.querySelector('.arrange-date').value;
      arrangeDraft.time = panel.querySelector('.arrange-time').value;
      arrangeDraft.venue = panel.querySelector('.arrange-venue').value;
      const hint = panel.querySelector('.arrange-hint');
      if(hint && typeof availabilityHintHtml === 'function') hint.innerHTML = availabilityHintHtml(arrangeDraft.names, arrangeDraft.date, arrangeDraft.time);
      send.textContent = arrangeSendLabel();
      send.disabled = send.textContent !== 'Send request';
    };
    panel.querySelectorAll('input').forEach(i => { i.oninput = sync; });
    sync();
    send.onclick = async () => {
      sync();
      if(send.disabled) return;
      const msg = panel.querySelector('.arrange-msg');
      const r = await submitGameRequest({ names: arrangeDraft.names, requestedBy: submissionIdentity(),
        date: arrangeDraft.date, time: arrangeDraft.time, venue: arrangeDraft.venue });
      if(!r.ok){ msg.textContent = r.message; return; }
      arrangeDraft = null;
      sheet.classList.remove('show');
      dataChanged();
      enterShellScreen('mygames');
      showPlayToast('Requested — it is under Waiting on others', 'View', () => openGameSheet(r.req.id));
    };
  }
  if(show) sheet.classList.add('show');
}
