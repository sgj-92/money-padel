// ===================== PLAY: MY GAMES, CLUB AND THE GAME SHEET =====================
// Player Experience Reset, Phase 2 (docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md
// §4.6-4.12). Play's two lists, drawn by the shell over the app:
//   My Games  the chosen player's own fixtures, by what needs doing
//   Club      every open fixture, filtered by four counters
// and the game sheet a row opens: where the game is on its way (stepper), the
// fixture card Upcoming and Requests already draw -- answers, Add result, and
// for an admin the prediction, reconciliation and Manage fixture -- and, for a
// player in a Called Out game, "I've booked a court" (DQ6).
//
// Presentation only. What goes where is PlayView (domain/fixtures/playView.js)
// through myGamesFor / clubFixtures; every change goes through
// commitFixtureChange and FixtureFlow, as on the old screens.
//
// Owning stream: redesign. Loads before app.js; declarations only.

let clubFilter = null;          // 'attention' | 'upcoming' | 'calledOut' | 'requests'
let clubShowAll = false;
let clubArchivedOpen = false;
let myArchivedOpen = false;
let playSheetId = null;         // the fixture open in the game sheet
let playToastTimer = null;
const CLUB_PAGE = 8;

const playNow = () => new Date().toISOString();

// The two sides with the viewer's first, and the viewer called "You".
function playTeamsText(req, viewerName){
  const me = viewerName ? FixtureFlow.participantName(req, viewerName) : null;
  const name = (n) => (n === me ? 'You' : n);
  const meFirst = (list) => (me && list.includes(me)) ? [me, ...list.filter(n => n !== me)] : list;
  let [a, b] = requestTeams(req);
  if(a.length && b.length){
    if(me && b.includes(me)) [a, b] = [b, a];
    return `${meFirst(a).map(name).join(' & ')} v ${b.map(name).join(' & ')}`;
  }
  return meFirst(req.players.slice()).map(name).join(', ');
}

// Where the game stands, in a word and a colour -- the word carries it.
function playStateHtml(req, now){
  const S = FixtureFlow.STAGE;
  const st = FixtureFlow.stage(req, now);
  if(st === S.PROPOSED) return mpPillHtml(`${FixtureFlow.confirmedCount(req)}/${req.players.length} in`);
  if(st === S.ATTENTION) return mpPillHtml('Needs attention', 'attention');
  if(st === S.UPCOMING) return mpPillHtml('Court booked', 'booked');
  if(st === S.CALLED_OUT) return mpPillHtml('No court', 'nocourt');
  if(st === S.ARCHIVED) return mpPillHtml('Archived');
  return '';
}

function playMetaText(req, now){
  const S = FixtureFlow.STAGE;
  const st = FixtureFlow.stage(req, now);
  const bits = [];
  if(req.preferredTime) bits.push(req.preferredTime);
  if(req.location) bits.push(req.location);
  if(st === S.ATTENTION) bits.push(fixtureAttentionText(req));
  else if(st === S.PROPOSED) bits.push(req.recommended
    ? `suggested by ${req.requestedBy} ${fmtRelative(req.requestedAt)} · would you play?`
    : `asked by ${req.requestedBy} ${fmtRelative(req.requestedAt)}`);
  return bits.filter(Boolean).join(' · ');
}

// Solid for a booked court, dashed for a proposed date; a solid "TBC" with no date.
function playDateBlockHtml(req){
  const proposed = !FixtureFlow.isBooked(req);
  if(req.preferredDate){
    const block = mpDateBlockHtml(req.preferredDate, { proposed });
    if(block) return block;
  }
  // No date yet: a plain solid square that just says TBC (Shaun, 28 Nov).
  return `<span class="mp-date-block mp-date-block-tbc" role="img" aria-label="Date to be confirmed"><span class="mp-date-day play-tbc">TBC</span></span>`;
}

// One game, two lines. The row opens the game sheet; a request waiting on the
// viewer carries its answer buttons (they act for the viewer only).
function playGameRowHtml(req, opts){
  const o = opts || {};
  const id = escapeHtml(req.id);
  const actions = o.respond ? `<div class="play-row-actions">
      <button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent fx-respond" data-fixture-id="${id}" data-response="in">I'm in</button>
      <button type="button" class="mp-btn-quiet fx-respond" data-fixture-id="${id}" data-response="cant">Can't play</button>
    </div>` : (o.actions ? `<div class="play-row-actions">${o.actions}</div>` : '');
  return `<div class="play-row" data-fixture-id="${id}">
    <button type="button" class="mp-game-row play-open" data-fixture-id="${id}">
      ${playDateBlockHtml(req)}
      <span class="play-row-main">
        <span class="mp-game-row-teams">${escapeHtml(playTeamsText(req, o.viewer))}</span>
        <span class="mp-game-row-meta">${playStateHtml(req, o.now)} ${escapeHtml(playMetaText(req, o.now))}</span>
      </span>
      <span class="mp-list-row-chevron" aria-hidden="true"></span>
    </button>${actions}
  </div>`;
}

function playListHtml(list, opts){
  return `<div class="play-list">${list.map(r => playGameRowHtml(r, opts)).join('')}</div>`;
}

function playWhoAreYouHtml(){
  return `<div class="mp-card-self play-who">
    <div class="mp-serif-display play-who-title">Who are you?</div>
    <div class="play-who-sub">Choose your player to see your games.</div>
    <button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent play-choose">Choose your player</button>
  </div>`;
}

function wirePlayList(box){
  box.querySelectorAll('.play-open').forEach(b => { b.onclick = () => openGameSheet(b.dataset.fixtureId); });
  box.querySelectorAll('.play-choose').forEach(b => { b.onclick = () => buildViewerSelector(); });
  wireFixtureControls(box);
}

// ---- My Games ------------------------------------------------------------------

// My Games' lists for one player, as this reader may see them: requests and
// agreed games each follow their own visibility setting (D4). My Games and
// Home's Needs You / Next Game both read this, so they cannot disagree.
function myGamesVisible(viewerName, now){
  const canReq = canSeeTab('wishlist'), canAgreed = canSeeTab('upcoming');
  const keep = (r) => (r.status === FixtureFlow.STATUS.PENDING ? canReq : canAgreed);
  const g = myGamesFor(viewerName, now);
  return { canReq, canAgreed,
    needsYou: g.needsYou.filter(x => keep(x.req)),
    upcoming: g.upcoming.filter(keep), calledOut: g.calledOut.filter(keep),
    waitingOnOthers: g.waitingOnOthers.filter(keep), archived: g.archived.filter(keep) };
}

function renderMyGames(){
  const box = document.getElementById('myGamesView');
  if(!box) return;
  const viewer = getCurrentViewer();
  const now = playNow();
  // Requests and agreed games each follow their own visibility setting (D4).
  const canReq = canSeeTab('wishlist');
  let html = `<div class="play-inner"><div class="mp-section-label">Play</div><h2 class="mp-serif-display play-title">My Games</h2>` + playAddResultHtml();
  if(fixtureFlashMessage) html += `<div class="play-flash" role="status">${escapeHtml(fixtureFlashMessage)}</div>`;
  if(!viewer){
    html += playWhoAreYouHtml();
  } else {
    const g = myGamesVisible(viewer.name, now);
    const needs = g.needsYou, upcoming = g.upcoming, calledOut = g.calledOut;
    const waiting = g.waitingOnOthers, archived = g.archived;
    const opts = { viewer: viewer.name, now };
    if(needs.length){
      html += mpSectionHeadHtml({ title: 'Needs you', count: needs.length, countLabel: 'waiting on you' });
      html += `<div class="play-list">${needs.map(x => playGameRowHtml(x.req, { ...opts, respond: x.why === 'answer' })).join('')}</div>`;
    }
    if(upcoming.length) html += mpSectionHeadHtml({ title: 'Upcoming', meta: 'Court booked' }) + playListHtml(upcoming, opts);
    if(calledOut.length) html += mpSectionHeadHtml({ title: 'Called out', meta: 'No court yet' }) + playListHtml(calledOut, opts);
    if(waiting.length) html += mpSectionHeadHtml({ title: 'Waiting on others', meta: `${waiting.length}` }) + playListHtml(waiting, opts);
    if(!needs.length && !upcoming.length && !calledOut.length && !waiting.length){
      html += `<div class="mp-card-standard play-empty">
        <div class="play-empty-title">Nothing on your list yet.</div>
        <div class="play-empty-sub">Arrange a Game to get one going.</div>
        ${arrangeModesVisible().length ? `<button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent play-arrange">Arrange a Game</button>` : ''}
      </div>`;
    }
    if(archived.length){
      html += `<button type="button" class="mp-section-head play-archived-toggle" aria-expanded="${myArchivedOpen}"><span class="mp-section-head-title">Archived call-outs</span><span class="mp-section-head-meta">${archived.length}</span></button>`;
      if(myArchivedOpen) html += playListHtml(archived, opts);
    }
  }
  // Onward: results, and Challenges, which live in My Games' flow (DQ22).
  const onward = [];
  if(viewer && canReq){
    const open = challengesState.filter(c => c.state !== 'confirmed').length;
    onward.push({ label: 'Challenges', meta: open ? `${open} open` : '', data: { play: 'challenges' } });
  }
  if(canSeeTab('games')) onward.push({ label: 'Played games & results', data: { play: 'results' } });
  if(onward.length) html += mpSectionHeadHtml({ title: 'More' }) + `<div class="shell-list">${onward.map(mpListRowHtml).join('')}</div>`;
  html += `</div>`;
  box.innerHTML = html;
  wirePlayList(box);
  box.querySelectorAll('.play-arrange').forEach(b => { b.onclick = () => openArrangeGame(); });
  box.querySelectorAll('.play-archived-toggle').forEach(b => { b.onclick = () => { myArchivedOpen = !myArchivedOpen; renderMyGames(); }; });
  box.querySelectorAll('[data-play]').forEach(b => { b.onclick = () => playOnward(b.dataset.play); });
}

// Add a result, from My Games and Club (Shaun, 23 Nov: "add a game is hidden
// within Played games & results"): straight to the Add a game form, open.
function playAddResultHtml(){
  if(!canSeeTab('games') || (typeof isStandingsMode === 'function' && isStandingsMode())) return '';
  return `<button type="button" class="add-game-cta play-add-result" data-play="addresult">
    <span class="add-game-cta-icon" aria-hidden="true">＋</span>
    <span class="add-game-cta-text"><b>Add a result</b><span>A game you've played, or a rotation</span></span>
    <span class="add-game-cta-chev" aria-hidden="true">›</span>
  </button>`;
}
function openAddResult(){
  addGameExpanded = true;
  addGameKind = 'game';
  const b = legacyTabBtn('games');
  if(b) b.click();
  if(typeof renderGamesTab === 'function') renderGamesTab();
  const cta = document.getElementById('addGameToggle');
  if(cta && cta.scrollIntoView) cta.scrollIntoView({ block: 'start' });
}

function playOnward(which){
  if(which === 'addresult'){ openAddResult(); return; }
  if(which === 'results'){ const b = legacyTabBtn('games'); if(b) b.click(); }
  else if(which === 'challenges'){ requestSectionOpen.challenges = true; const b = legacyTabBtn('wishlist'); if(b) b.click(); }
  else if(which === 'upcoming' || which === 'wishlist'){ const b = legacyTabBtn(which); if(b) b.click(); }
}

// ---- Club ----------------------------------------------------------------------

function renderClub(){
  const box = document.getElementById('clubView');
  if(!box) return;
  const now = playNow();
  const viewer = getCurrentViewer();
  const c = clubFixtures(now);
  const canReq = canSeeTab('wishlist'), canAgreed = canSeeTab('upcoming');
  const counters = [
    { key: 'attention', label: 'Attention', list: c.attention, vis: canAgreed },
    { key: 'upcoming', label: 'Upcoming', list: c.upcoming, vis: canAgreed },
    { key: 'calledOut', label: 'Called out', list: c.calledOut, vis: canAgreed },
    { key: 'requests', label: 'Requests', list: c.requests, vis: canReq },
  ].filter(k => k.vis);
  if(!counters.some(k => k.key === clubFilter)){
    clubFilter = ((counters.find(k => k.key === 'attention' && k.list.length) || counters.find(k => k.key === 'upcoming') || counters[0]) || {}).key || null;
  }
  const current = counters.find(k => k.key === clubFilter);
  let html = `<div class="play-inner"><div class="mp-section-label">Play</div><h2 class="mp-serif-display play-title">Club</h2>` + playAddResultHtml();
  if(fixtureFlashMessage) html += `<div class="play-flash" role="status">${escapeHtml(fixtureFlashMessage)}</div>`;

  // Admin only: games whose court booking was never recorded (as in Upcoming).
  const unrecorded = (isUnlocked && canAgreed) ? gameRequestsState.filter(r => FixtureFlow.isAgreed(r) && !FixtureFlow.bookingRecorded(r)) : [];
  if(unrecorded.length){
    html += mpSectionHeadHtml({ title: 'Court bookings to record', meta: 'Admin' });
    html += `<div class="play-list">${unrecorded.map(r => {
      const id = escapeHtml(r.id);
      return playGameRowHtml(r, { viewer: viewer && viewer.name, now, actions:
        `<button type="button" class="mp-btn-secondary mp-btn-touch fx-book-set" data-fixture-id="${id}" data-booked="true">Court booked</button>
         <button type="button" class="mp-btn-quiet fx-book-set" data-fixture-id="${id}" data-booked="false">Not booked yet</button>` });
    }).join('')}</div>`;
  }

  if(counters.length){
    html += `<div class="mp-counter-row play-counters" role="group" aria-label="Fixtures by state">${counters.map(k =>
      `<button type="button" class="mp-counter" data-club-filter="${k.key}" aria-pressed="${k.key === clubFilter}"><span class="mp-counter-num">${k.list.length}</span><span class="mp-counter-label">${k.label}</span></button>`
    ).join('')}</div>`;
  }
  if(current){
    const empty = {
      attention: 'No game needs attention.',
      upcoming: 'No court-booked games yet.',
      calledOut: 'Nothing called out. A request lands here once all four players are in.',
      requests: 'No open requests.',
    }[current.key];
    const shown = clubShowAll ? current.list : current.list.slice(0, CLUB_PAGE);
    html += current.list.length ? playListHtml(shown, { viewer: viewer && viewer.name, now }) : `<div class="play-empty-sub play-empty-line">${empty}</div>`;
    if(current.list.length > shown.length) html += `<button type="button" class="mp-btn-quiet play-more">Show ${current.list.length - shown.length} more</button>`;
    if(current.key === 'calledOut' && c.archived.length){
      html += `<button type="button" class="mp-section-head play-archived-toggle" aria-expanded="${clubArchivedOpen}"><span class="mp-section-head-title">Archived call-outs</span><span class="mp-section-head-meta">${c.archived.length}</span></button>`;
      if(clubArchivedOpen) html += playListHtml(c.archived, { viewer: viewer && viewer.name, now });
    }
  }

  // The screens these replace, kept until the new lists are accepted.
  const previous = [];
  if(canAgreed) previous.push({ label: 'Upcoming, as before', data: { play: 'upcoming' } });
  if(canReq) previous.push({ label: 'Requests, as before', data: { play: 'wishlist' } });
  if(previous.length){
    html += mpSectionHeadHtml({ title: 'Previous screens', meta: 'until these are accepted' });
    html += `<div class="shell-list">${previous.map(mpListRowHtml).join('')}</div>`;
  }
  html += `</div>`;
  box.innerHTML = html;
  wirePlayList(box);
  box.querySelectorAll('[data-club-filter]').forEach(b => { b.onclick = () => { clubFilter = b.dataset.clubFilter; clubShowAll = false; renderClub(); }; });
  box.querySelectorAll('.play-more').forEach(b => { b.onclick = () => { clubShowAll = true; renderClub(); }; });
  box.querySelectorAll('.play-archived-toggle').forEach(b => { b.onclick = () => { clubArchivedOpen = !clubArchivedOpen; renderClub(); }; });
  box.querySelectorAll('[data-play]').forEach(b => { b.onclick = () => playOnward(b.dataset.play); });
}

// ---- The game sheet ------------------------------------------------------------

function playSheet(id){
  let sheet = document.getElementById(id);
  if(!sheet){
    sheet = document.createElement('div');
    sheet.className = 'shell-more-sheet';
    sheet.id = id;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if(e.target === sheet) sheet.classList.remove('show'); });
  }
  return sheet;
}

function openGameSheet(id){ playSheetId = id; renderGameSheet(true); }

function renderGameSheet(show){
  const sheet = playSheet('gameSheet');
  const req = gameRequestsState.find(r => r.id === playSheetId);
  // Played, removed or gone since it was opened: nothing left to show.
  if(!req || !FixtureFlow.isOpen(req)){ sheet.classList.remove('show'); return; }
  const now = playNow();
  const S = FixtureFlow.STAGE;
  const st = FixtureFlow.stage(req, now);
  const viewer = getCurrentViewer();
  const me = viewer ? FixtureFlow.participantName(req, viewer.name) : null;
  // DQ6: a player in an agreed game with no court yet may record the booking.
  const canBook = !!me && !(req.cantPlay || {})[me] && !FixtureFlow.isBooked(req)
    && (st === S.CALLED_OUT || st === S.ATTENTION);
  let card;
  if(FixtureFlow.isAgreed(req)){
    // The card's own open state belongs to Upcoming; borrow it for this drawing only.
    const had = upcomingOpen.has(req.id);
    upcomingOpen.add(req.id);
    card = buildUpcomingCardHtml(req, fixtureCardContext(now));
    if(!had) upcomingOpen.delete(req.id);
  } else {
    card = buildPendingRequestCardHtml(req);
  }
  const state = st === S.ATTENTION ? mpPillHtml('Needs attention', 'attention') : st === S.ARCHIVED ? mpPillHtml('Archived') : '';
  // The game's own chat, for its four (messages.js; Shaun, 25 Nov).
  const canChat = typeof messagesOn === 'function' && messagesOn() && !!messagesMe() && !!FixtureFlow.participantName(req, messagesMe());
  // Unsaved Manage fixture edits, and where the reader was, survive a redraw.
  const kept = typeof fixtureManageSnapshot === 'function' ? fixtureManageSnapshot(sheet) : null;
  const oldPanel = sheet.querySelector('.game-sheet');
  const scrollWas = oldPanel ? oldPanel.scrollTop : 0;
  sheet.innerHTML = `<div class="shell-more-panel game-sheet" role="dialog" aria-label="Game">
    <div class="game-sheet-head">
      <h3>${escapeHtml(playTeamsText(req, viewer && viewer.name))}</h3>
      <button type="button" class="mp-sheet-close game-sheet-close" aria-label="Close">×</button>
    </div>
    ${mpStepperHtml(PlayView.STEPS, PlayView.step(req, now))}
    ${state ? `<div class="game-sheet-state">${state}</div>` : ''}
    ${(canBook || isUnlocked || canChat) ? `<div class="game-sheet-actions">
      ${canBook ? `<button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent game-book">I've booked a court</button>` : ''}
      ${canChat ? `<button type="button" class="preset-btn game-chat">Chat with the four</button>` : ''}
      ${isUnlocked ? `<button type="button" class="section-more-btn game-admin" aria-label="Admin: manage this fixture">Admin ···</button>` : ''}
    </div>` : ''}
    <div class="game-sheet-card">${card}</div>
  </div>`;
  const panel = sheet.querySelector('.game-sheet');
  panel.querySelector('.game-sheet-close').onclick = () => sheet.classList.remove('show');
  const book = panel.querySelector('.game-book');
  if(book) book.onclick = () => openBookingConfirm(req.id);
  const chat = panel.querySelector('.game-chat');
  if(chat) chat.onclick = () => { sheet.classList.remove('show'); openGameChat(req); };
  const admin = panel.querySelector('.game-admin');
  if(admin) admin.onclick = () => {
    fixtureManageOpen = req.id; fixtureManageMessage = ''; fixtureRemoveArmed = null;
    renderGameSheet(false);
    const m = sheet.querySelector('.fx-manage');
    if(m) m.scrollIntoView({ block: 'start' });
  };
  wireRequestPlayerLinks(panel);
  // A profile opens under the sheets; close this one so it can be seen.
  panel.querySelectorAll('.request-player-link').forEach(el => {
    el.onclick = () => { sheet.classList.remove('show'); openSheet(el.dataset.player); };
  });
  wireRequestPredictions(panel);
  wireFixtureControls(panel);
  panel.querySelectorAll('.request-addresult-btn').forEach(b => {
    b.onclick = () => { sheet.classList.remove('show'); navigateToGamesTabForResult(req); };
  });
  if(kept && fixtureManageOpen === kept.id) fixtureManageRestore(panel, kept);
  if(!show && scrollWas) panel.scrollTop = scrollWas;
  if(show) sheet.classList.add('show');
}

// After a change to the record, or a panel opened inside the sheet.
function refreshPlaySheets(){
  const s = document.getElementById('gameSheet');
  if(s && s.classList.contains('show')) renderGameSheet(false);
}

// ---- DQ6: a player records the court booking -----------------------------------

function openBookingConfirm(id){
  const req = gameRequestsState.find(r => r.id === id);
  if(!req) return;
  const viewer = getCurrentViewer();
  const sheet = playSheet('bookingSheet');
  sheet.innerHTML = `<div class="shell-more-panel">
    <h3>Court booked?</h3>
    <div class="play-booking-game">${escapeHtml(playTeamsText(req, viewer && viewer.name))}</div>
    <div class="play-booking-when">${escapeHtml(fixtureWhenText(req))}</div>
    <p class="play-note">This moves the game to Upcoming for all four players. It is recorded under your name, and only an admin can undo it.</p>
    <div class="play-sheet-buttons">
      <button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent booking-yes">Yes, the court is booked</button>
      <button type="button" class="mp-btn-secondary mp-btn-touch booking-no">Not yet</button>
    </div>
    <div class="play-flash booking-msg" role="status"></div>
  </div>`;
  sheet.querySelector('.booking-no').onclick = () => sheet.classList.remove('show');
  sheet.querySelector('.booking-yes').onclick = async () => {
    const r = await commitFixtureChange(() => {
      const fresh = gameRequestsState.find(x => x.id === id);
      return fresh ? FixtureFlow.setCourtBooking(fresh, { isAdmin: false, booked: true, by: fixtureActor() }) : { ok: false, reason: 'closed' };
    });
    if(r && r.ok && r.saved){
      sheet.classList.remove('show');
      showPlayToast('Court booked — moved to Upcoming', 'View', () => openGameSheet(id));
    } else {
      const msg = sheet.querySelector('.booking-msg');
      if(msg) msg.textContent = fixtureFlashMessage || 'Nothing was saved.';
    }
  };
  sheet.classList.add('show');
}

// ---- Toast: what the module said happened, never invented ----------------------

function showPlayToast(message, actionLabel, action){
  let t = document.getElementById('playToast');
  if(!t){
    t = document.createElement('div');
    t.id = 'playToast';
    t.className = 'mp-toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.innerHTML = `<span>${escapeHtml(message)}</span>${actionLabel ? `<button type="button" class="mp-toast-action">${escapeHtml(actionLabel)}</button>` : ''}`;
  t.hidden = false;
  const btn = t.querySelector('.mp-toast-action');
  if(btn) btn.onclick = () => { t.hidden = true; action(); };
  clearTimeout(playToastTimer);
  playToastTimer = setTimeout(() => { t.hidden = true; }, 5000);
}
