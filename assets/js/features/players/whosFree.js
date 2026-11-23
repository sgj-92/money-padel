// ===================== WHEN I'M FREE, AND WHO ELSE IS =====================
// Shaun, 23 Nov: "add somewhere that a player can see their schedule for when
// they've said they can play, perhaps within the Next Game section. Also I
// want it all to be linked so that players (and admin) can see who else is
// available around their times so they can request games with them."
//
//   Home › Next game   the next seven days a player said they're free, each
//                      with how many others are free at the same time
//   Who's free sheet   a day at a time: everyone free then (sharing your
//                      time first), tap up to three, Request a game -- the
//                      request form opens filled in: the four, the date and
//                      the first time you're all free. An Admin who isn't
//                      playing picks four and gets the Agreed form instead.
//
// Read from availabilityState (domain/players/availability.js). Declarations
// only; whosFreeInstall() wires the taps.

const WHOS_FREE_DAYS = 7;
let whosFreeView = null;   // { date, me, picked: [] }

function whosFreeOn(){ return typeof playerAccountsOn === 'function' && playerAccountsOn(); }

// Today and the six days after, as "YYYY-MM-DD", in the reader's own calendar.
function whosFreeDates(){
  const out = [], d = new Date();
  for(let i = 0; i < WHOS_FREE_DAYS; i++){
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`);
  }
  return out;
}
// "Today", "Tomorrow", "Wed 26"
function whosFreeDayLabel(date, i){
  if(i === 0) return 'Today';
  if(i === 1) return 'Tomorrow';
  return `${Availability.DAY_LABEL[Availability.dayOf(date)]} ${Number(date.slice(8))}`;
}

// ---- Home: my week -------------------------------------------------------
function homeFreeWeekHtml(viewer){
  if(!whosFreeOn() || !viewer) return '';
  const name = viewer.name, mine = availabilityState[name];
  const canEdit = typeof canEditAvailability === 'function' && canEditAvailability(name);
  const head = `<div class="wf-head"><span class="wf-title">When you're free</span>${canEdit ? `<button type="button" class="link-btn wf-edit" data-free-edit="${escapeHtml(name)}">${mine && Availability.hasAny(mine) ? 'Edit' : 'Set'}</button>` : ''}</div>`;
  if(!mine || !Availability.hasAny(mine)){
    return `<div class="wf-week">${head}<div class="wf-empty">${canEdit ? 'Say when you can usually play, and see who else is free then.' : 'Sign in with your code to say when you can play.'}</div>
      <button type="button" class="wf-browse" data-free-day="${whosFreeDates()[0]}">See who's free this week ›</button></div>`;
  }
  const everyone = entryPlayerNames();
  const rows = whosFreeDates().map((date, i) => {
    const f = Availability.freeOn(mine, date) || [];
    if(!f.length) return '';
    const others = Availability.othersFree(availabilityState, everyone, date, name);
    const who = others.slice(0, 3).map(o => o.name).join(', ') + (others.length > 3 ? ` +${others.length - 3}` : '');
    return `<button type="button" class="wf-day" data-free-day="${date}">
      <span class="wf-day-name">${escapeHtml(whosFreeDayLabel(date, i))}</span>
      <span class="wf-day-time">${escapeHtml(Availability.rangesText(f))}</span>
      <span class="wf-day-who${others.length ? '' : ' is-none'}">${others.length ? escapeHtml(who) : 'nobody else yet'}</span>
      <span class="wf-chev" aria-hidden="true">›</span></button>`;
  }).join('');
  return `<div class="wf-week">${head}${rows || `<div class="wf-empty">Not free in the next ${WHOS_FREE_DAYS} days.</div><button type="button" class="wf-browse" data-free-day="${whosFreeDates()[0]}">See who's free this week ›</button>`}</div>`;
}

// ---- The sheet -----------------------------------------------------------
function whosFreeMe(){
  const v = typeof getCurrentViewer === 'function' ? getCurrentViewer() : null;
  return v ? v.name : null;
}

function openWhosFree(date){
  whosFreeView = { date: date || whosFreeDates()[0], me: whosFreeMe(), picked: [] };
  renderWhosFree();
  playSheet('whosFreeSheet').classList.add('show');
}

function renderWhosFree(){
  const sheet = playSheet('whosFreeSheet');
  const v = whosFreeView, A = Availability, dates = whosFreeDates();
  const everyone = entryPlayerNames();
  const me = v.me;
  const myFree = me ? (A.freeOn(availabilityState[me], v.date) || []) : null;
  const admin = !me && !!isUnlocked;
  // With me free that day: those who share my time. Otherwise everyone free.
  const list = (me && myFree.length) ? A.othersFree(availabilityState, everyone, v.date, me) : A.othersFree(availabilityState, everyone.filter(n => n !== me), v.date, null);
  const max = me ? 3 : 4;
  const chips = dates.map((d, i) => {
    const n = (me && (A.freeOn(availabilityState[me], d) || []).length) ? A.othersFree(availabilityState, everyone, d, me).length : A.othersFree(availabilityState, everyone.filter(x => x !== me), d, null).length;
    return `<button type="button" class="pp-chip wf-chip${d === v.date ? ' is-on' : ''}" data-wf-date="${d}" aria-pressed="${d === v.date}">${escapeHtml(whosFreeDayLabel(d, i))}<span class="pp-chip-n">${n}</span></button>`;
  }).join('');
  const you = me ? `<div class="wf-you">${myFree.length ? `You: <b>${escapeHtml(A.rangesText(myFree))}</b> · showing who's free then` : `You haven't said you're free this day · showing everyone who is`}</div>` : '';
  const rows = list.length ? list.map(o => {
    const on = v.picked.includes(o.name);
    const sharedText = (me && myFree.length) ? `<span class="wf-shared">With you ${escapeHtml(A.rangesText(o.shared))}</span>` : '';
    return `<button type="button" class="wf-person${on ? ' is-on' : ''}" data-wf-pick="${escapeHtml(o.name)}" aria-pressed="${on}">
      <span class="wf-tick" aria-hidden="true">${on ? '✓' : ''}</span>
      <span class="wf-person-main"><span class="wf-person-name">${escapeHtml(o.name)}</span><span class="wf-person-time">Free ${escapeHtml(A.rangesText(o.free))}</span></span>
      ${sharedText}</button>`;
  }).join('') : `<div class="wf-empty">${me && myFree.length ? 'Nobody else has said they’re free at your times this day.' : 'Nobody has said they’re free this day.'}</div>`;
  const picked = v.picked;
  const canAct = me ? picked.length >= 1 : (admin && picked.length >= 1);
  const actLabel = me
    ? (picked.length ? `Request a game with ${picked.join(', ')}` : 'Tap up to three to request a game')
    : admin ? (picked.length ? `Set up a game with ${picked.join(', ')}` : 'Tap up to four to set up a game')
    : 'Choose who you are to request a game';
  sheet.innerHTML = `<div class="shell-more-panel wf-panel" role="dialog" aria-label="Who's free">
    <div class="game-sheet-head"><h3>Who's free</h3><button type="button" class="mp-sheet-close wf-close" aria-label="Close">×</button></div>
    <div class="pp-chips wf-chips" role="group" aria-label="Day">${chips}</div>
    ${you}
    <div class="wf-list">${rows}</div>
    <div class="wf-foot">
      ${me || admin ? `<button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent wf-go"${canAct ? '' : ' disabled'}>${escapeHtml(actLabel)}</button>`
        : `<button type="button" class="preset-btn wf-who">${escapeHtml(actLabel)}</button>`}
      ${me && typeof canEditAvailability === 'function' && canEditAvailability(me) ? `<button type="button" class="link-btn wf-edit" data-free-edit="${escapeHtml(me)}">Change when I'm free</button>` : ''}
    </div>
  </div>`;
  sheet.querySelector('.wf-close').onclick = () => sheet.classList.remove('show');
  sheet.querySelectorAll('[data-wf-date]').forEach(b => { b.onclick = () => { v.date = b.dataset.wfDate; v.picked = []; renderWhosFree(); }; });
  sheet.querySelectorAll('[data-wf-pick]').forEach(b => {
    b.onclick = () => {
      const n = b.dataset.wfPick;
      if(v.picked.includes(n)) v.picked = v.picked.filter(x => x !== n);
      else if(v.picked.length < max) v.picked = v.picked.concat([n]);
      renderWhosFree();
    };
  });
  const go = sheet.querySelector('.wf-go');
  if(go) go.onclick = () => whosFreeRequest();
  const who = sheet.querySelector('.wf-who');
  if(who) who.onclick = () => { sheet.classList.remove('show'); if(typeof buildViewerSelector === 'function') buildViewerSelector(); };
  const onChip = sheet.querySelector('.wf-chip.is-on');
  if(onChip && onChip.scrollIntoView) onChip.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// The request (or, for an Admin not playing, the Agreed form), filled in.
function whosFreeRequest(){
  const v = whosFreeView;
  const four = (v.me ? [v.me] : []).concat(v.picked);
  while(four.length < 4) four.push('');
  const h = Availability.firstCommon(availabilityState, four.filter(Boolean), v.date);
  const draft = { names: four, date: v.date, time: h === null ? '' : Availability.timeOf(h), venue: '' };
  playSheet('whosFreeSheet').classList.remove('show');
  if(v.me) openArrangeGame('request', draft);
  else { agreedDraft = { ...draft, booked: false }; openArrangeGame('agreed'); }
}

// One listener for the Home rows, Edit, and the Arrange sheet's way in.
let whosFreeInstalled = false;
function whosFreeInstall(){
  if(whosFreeInstalled) return;
  whosFreeInstalled = true;
  document.addEventListener('click', (e) => {
    const day = e.target.closest && e.target.closest('[data-free-day]');
    if(day){ e.preventDefault(); const arrange = document.getElementById('arrangeSheet'); if(arrange && arrange.contains(day)) arrange.classList.remove('show'); openWhosFree(day.dataset.freeDay); return; }
    const edit = e.target.closest && e.target.closest('[data-free-edit]');
    if(edit){ e.preventDefault(); const s = document.getElementById('whosFreeSheet'); if(s) s.classList.remove('show'); openAvailabilitySheet(edit.dataset.freeEdit); }
  });
}
