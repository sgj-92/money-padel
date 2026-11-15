// ===================== PLAY › UPCOMING › COURTS BOOKED =====================
// Shaun, 15 Nov: "somewhere to add where courts have been booked but games are
// yet to be confirmed." Admin adds a court with the names known so far; it is
// listed for everyone as needing players (and goes out with the fixtures in
// the weekly recap). Filling the fourth name makes it an ordinary agreed,
// court-booked game in Upcoming. The rules live in domain/fixtures/courtBookings.js.
// Declarations only; drawn inside renderUpcoming().

let courtForm = null;          // null: closed; { id: null } adding; { id } editing that court
let courtRemoveArmed = null;   // the court an admin has asked to remove, waiting for the second tap
let courtMessage = '';

const COURT_PROBLEMS = {
  'no-date': 'Choose the date the court is booked for.',
  'too-many': 'A court takes four players.',
  'duplicate': 'The same name appears more than once.',
};

function courtWhenText(c){
  return [fmtFixtureDate(c.date), c.time || null, c.venue || 'Venue TBC'].filter(Boolean).join(' · ');
}

function courtsSectionHtml(){
  const courts = courtBookingsState.slice().sort(CourtBookings.order);
  if(!courts.length && !isUnlocked) return '';
  const open = upcomingSectionOpen.courts !== false;
  let h = foldHeading('upFoldCourts', `🎾 Courts booked, players needed (${courts.length})`, open, { summary: 'not confirmed yet' });
  if(!open) return h + `<div class="mp-divider"></div>`;
  const today = localIsoToday();
  h += `<div id="upFoldCourtsBody">`;
  if(isUnlocked){
    h += courtForm ? courtFormHtml() : `<button type="button" class="preset-btn court-add" id="courtAddToggle">＋ Add a booked court</button>`;
  }
  h += courts.length ? courts.map(c => {
    const id = escapeHtml(c.id), n = CourtBookings.needed(c), armed = courtRemoveArmed === c.id;
    return `<div class="court-card" data-court-id="${id}">
      <div class="court-top"><div class="fx-title">${escapeHtml(CourtBookings.namesLine(c))}</div>
        <span class="court-needs">${n ? `Needs ${n}` : 'Full'}</span></div>
      <div class="fx-meta">${escapeHtml(courtWhenText(c))}${c.date < today ? ' · <b>date passed</b>' : ''}</div>
      ${isUnlocked ? `<div class="fx-actions">
        <button type="button" class="preset-btn court-edit" data-court-id="${id}">Edit / add names</button>
        <button type="button" class="preset-btn court-remove${armed ? ' is-armed' : ''}" data-court-id="${id}">${armed ? 'Tap again to remove' : 'Remove'}</button>
      </div>` : ''}
    </div>`;
  }).join('') : `<div class="section-sub">No courts waiting for players.</div>`;
  if(courtMessage) h += `<div class="section-sub" id="courtFlash" role="status">${escapeHtml(courtMessage)}</div>`;
  h += `</div><div class="mp-divider"></div>`;
  return h;
}

function courtFormHtml(){
  const c = (courtForm.id && courtBookingsState.find(x => x.id === courtForm.id)) || { date: '', time: '', venue: '', players: [] };
  const seat = (i) => `<input id="courtP${i + 1}" list="courtNamesList" class="fg-select" placeholder="Player ${i + 1} (if known)" value="${escapeHtml(c.players[i] || '')}" style="margin-bottom:6px;" />`;
  return `<div class="court-form" id="courtForm">
    <div class="section-sub">Add the names you know. Fill all four and it becomes a booked game in Upcoming.</div>
    <div class="fg-row"><label class="fg-label" for="courtDate">Date</label><input id="courtDate" type="date" class="fg-select" value="${escapeHtml(c.date)}" /></div>
    <div class="fg-row"><label class="fg-label" for="courtTime">Time (optional)</label><input id="courtTime" type="time" class="fg-select" value="${escapeHtml(c.time || '')}" /></div>
    <div class="fg-row"><label class="fg-label" for="courtVenue">Venue (optional)</label><input id="courtVenue" class="fg-select" value="${escapeHtml(c.venue || '')}" placeholder="Venue" /></div>
    <div class="fg-row"><label class="fg-label">Players so far</label>${[0, 1, 2, 3].map(seat).join('')}</div>
    <datalist id="courtNamesList">${entryPlayerNames().map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>
    <div class="fx-actions">
      <button type="button" class="tab-btn active" id="courtSave">${courtForm.id ? 'Save court' : 'Add court'}</button>
      <button type="button" class="preset-btn" id="courtCancel">Cancel</button>
    </div>
    <div id="courtMsg" class="section-sub" role="status"></div>
  </div>`;
}

async function saveCourtForm(){
  const msg = (t) => { const el = document.getElementById('courtMsg'); if(el) el.textContent = t; };
  const val = (id) => ((document.getElementById(id) || {}).value || '').trim();
  const entry = { date: val('courtDate'), time: val('courtTime'), venue: val('courtVenue'), players: [1, 2, 3, 4].map(i => val(`courtP${i}`)).filter(Boolean) };
  const bad = CourtBookings.problem(entry);
  if(bad){ msg(COURT_PROBLEMS[bad]); return; }
  const known = entryPlayerNames().concat(archivedAmong(entry.players)).map(n => n.toLowerCase());
  const unrecognized = entry.players.filter(n => !known.includes(n.toLowerCase()));
  if(unrecognized.length){ msg(`Unrecognized name${unrecognized.length > 1 ? 's' : ''}: ${unrecognized.join(', ')}.`); return; }
  const archived = archivedAmong(entry.players);
  if(archived.length){ msg(archivedRefusal(archived)); return; }
  const by = fixtureAdminName();
  const editing = courtForm.id ? courtBookingsState.find(x => x.id === courtForm.id) : null;
  const failed = () => storageAvailable() ? `Save failed (${lastStorageError || 'unknown error'}) — try again.` : `Save failed — this page can't reach shared storage.`;

  if(entry.players.length === CourtBookings.SEATS){
    // Four names: an ordinary agreed, court-booked game.
    const game = FixtureFlow.createAgreed({ players: entry.players, teams: [entry.players.slice(0, 2), entry.players.slice(2, 4)], by,
      preferredDate: entry.date, preferredTime: entry.time, location: entry.venue, courtBookingMade: true });
    gameRequestsState.push(game);
    if(!await saveGameRequests(gameRequestsState)){ gameRequestsState.pop(); msg(failed()); return; }
    if(editing){
      const before = courtBookingsState;
      courtBookingsState = courtBookingsState.filter(x => x !== editing);
      if(!await saveCourtBookings(courtBookingsState)){ courtBookingsState = before; }
    }
    courtForm = null; courtMessage = '';
    fixtureFlashMessage = `All four in: ${entry.players.slice(0, 2).join(' & ')} vs ${entry.players.slice(2).join(' & ')} is booked and in Upcoming.`;
    dataChanged();
    return;
  }
  const before = JSON.stringify(courtBookingsState);
  if(editing) CourtBookings.update(editing, { ...entry, by });
  else courtBookingsState.push(CourtBookings.create({ ...entry, by }));
  if(!await saveCourtBookings(courtBookingsState)){ courtBookingsState = JSON.parse(before); msg(failed()); return; }
  courtForm = null;
  courtMessage = editing ? 'Court saved.' : 'Court added.';
  dataChanged();
}

function wireCourts(box){
  const fold = document.getElementById('upFoldCourts');
  if(fold) fold.onclick = () => { upcomingSectionOpen.courts = upcomingSectionOpen.courts === false; renderUpcoming(); };
  const add = document.getElementById('courtAddToggle');
  if(add) add.onclick = () => { courtForm = { id: null }; courtMessage = ''; courtRemoveArmed = null; renderUpcoming(); };
  const cancel = document.getElementById('courtCancel');
  if(cancel) cancel.onclick = () => { courtForm = null; renderUpcoming(); };
  const save = document.getElementById('courtSave');
  if(save) save.onclick = async () => { save.disabled = true; try { await saveCourtForm(); } finally { save.disabled = false; } };
  box.querySelectorAll('.court-edit').forEach(btn => {
    btn.onclick = () => {
      courtForm = { id: btn.dataset.courtId }; courtMessage = ''; courtRemoveArmed = null; renderUpcoming();
      const f = document.getElementById('courtForm'); if(f && f.scrollIntoView) f.scrollIntoView({ block: 'center' });
    };
  });
  box.querySelectorAll('.court-remove').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.courtId;
      if(courtRemoveArmed !== id){ courtRemoveArmed = id; renderUpcoming(); return; }
      courtRemoveArmed = null;
      const before = courtBookingsState;
      courtBookingsState = courtBookingsState.filter(x => x.id !== id);
      if(courtForm && courtForm.id === id) courtForm = null;
      const ok = await saveCourtBookings(courtBookingsState);
      if(!ok) courtBookingsState = before;
      courtMessage = ok ? 'Court removed.' : 'Could not remove the court — try again.';
      dataChanged();
    };
  });
}
