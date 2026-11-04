// ===================== PLAY: REQUESTS AND UPCOMING SCREENS =====================
// Play › Requests (Challenges, For me, My Requests, Request a game, Add multiple
// games, Admin add, Other requests) and Play › Upcoming (Needs attention,
// Upcoming, Called Out, Archived call-outs, the Admin booking review): the
// cards, folds, Manage fixture panel and their wiring. The rules live in
// fixtureFlow.js / fixtureParse.js; the list split and the commit path in
// fixturesData.js.
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: redesign. Loads before app.js; declarations only.

// ===================== FIXTURES: REQUESTS AND UPCOMING =====================
// The rules live in fixtureFlow.js; this draws them and wires the taps.
//
//   - A player responds for themselves only -- the actor is always the player
//     selected on this device (getCurrentViewer). There is no control that
//     acts for anyone else.
//   - Only a participant sees "I'm in" / "Can't play". Nobody else sees a
//     withdrawal or removal control.
//   - Admin maintenance -- players, sides, answers, date, time, venue, court
//     booking and, last, removal -- lives in one "Manage fixture" panel.
//     Removal takes a second, explicit tap.
//   - An agreed fixture is listed by stage (FixtureFlow.stage): Needs
//     attention, Upcoming (court booked) or Called Out (not booked yet).

// A player's game requests are answered in Play > Requests, by the player
// selected on this device -- never from a profile, which would have let
// whoever opened it answer for its owner (D2, 27 Sep 2026).

// ===================== WISHLIST / UPCOMING GAME REQUESTS =====================
function fmtRequestConfirmations(req){
  const confirmedCount = req.players.filter(n=>req.confirmations[n]).length;
  const pillClass = confirmedCount === req.players.length ? 'perf-pos' : '';
  return `<div style="margin-top:6px; font-size:11.5px;">
    <span class="${pillClass}" style="font-weight:700;">${confirmedCount}/${req.players.length} confirmed</span>
    <div style="margin-top:4px; color:var(--text-dim);">
      ${req.players.map(n=> `${req.confirmations[n] ? '✅' : '⬜'} <span class="request-player-link" data-player="${n}" style="text-decoration:underline; cursor:pointer; color:var(--text);">${n}</span>`).join(' &nbsp; ')}
    </div>
  </div>`;
}

// Which sections of Requests and Upcoming are open. Both screens were a single
// scroll of stacked forms with the actual content at the bottom, which on a
// phone meant the list of open requests was below three form panels nobody had
// asked for. The lists open; the forms that create them do not. Not persisted:
// each screen should open the same way every time.
let requestSectionOpen = { challenges: true, forMe: true, mine: true, request: false, bulk: false, adminAdd: false, others: false };

let upcomingSectionOpen = { review: true, attention: true, upcoming: true, calledOut: true, archived: false };

// Which fixture cards are open. Folded by default; emptied on arrival.
let upcomingOpen = new Set();

// The fixture whose Manage panel is open, and what its last save said.
let fixtureManageOpen = null;

let fixtureManageMessage = '';

// The fixture an admin has asked to remove but not yet confirmed.
let fixtureRemoveArmed = null;

let fixtureFlashMessage = '';

function localIsoToday(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// "Tue 29 Sep" -- how the club says a date.
function fmtFixtureDate(iso){
  if(!iso) return '';
  const d = new Date(iso + 'T12:00:00Z');
  if(isNaN(d)) return iso;
  // By hand: locales disagree ("Fri, 18 Sept"), and this is the club's form.
  const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()];
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  return `${day} ${d.getUTCDate()} ${month}`;
}

function fixtureLink(n){
  return `<span class="request-player-link" data-player="${escapeHtml(n)}">${escapeHtml(n)}</span>`;
}

// The two sides, linked, or the four names when no sides were agreed.
function fixtureTeamsHtml(req){
  const [sideA, sideB] = requestTeams(req);
  return (sideA.length && sideB.length)
    ? `${sideA.map(fixtureLink).join(' &amp; ')} <span class="fx-vs">vs</span> ${sideB.map(fixtureLink).join(' &amp; ')}`
    : req.players.map(fixtureLink).join(' &amp; ');
}

// Date, time and venue in a line, with TBC where nothing is set. A Called Out
// game's details are only a proposal, and the line says so.
function fixtureWhenText(req){
  const bits = [req.preferredDate ? fmtFixtureDate(req.preferredDate) : 'Date TBC'];
  if(req.preferredTime) bits.push(req.preferredTime);
  bits.push(req.location || 'Venue TBC');
  return bits.join(' · ');
}

// Why an agreed fixture needs attention, in a phrase.
function fixtureAttentionText(req){
  const a = FixtureFlow.attention(req);
  const parts = [];
  if(a.backedOut.length) parts.push(`${a.backedOut.join(', ')} backed out`);
  if(a.waiting.length) parts.push(`waiting on ${a.waiting.join(', ')}`);
  return parts.join(' · ');
}

// Each player and where they stand: in, backed out, or not answered yet.
function fixturePlayersHtml(req){
  const cant = req.cantPlay || {};
  const agreed = FixtureFlow.isAgreed(req);
  return `<div class="fx-players">${req.players.map(n => {
    const state = cant[n] ? 'cant' : ((req.confirmations || {})[n] ? 'in' : 'waiting');
    const icon = state === 'in' ? '✅' : state === 'cant' ? '✖' : '⬜';
    const label = state === 'in' ? 'in'
      : state === 'cant' ? `${agreed ? 'backed out' : "can't play"} · ${fmtRelative(cant[n].at)}`
      : (agreed ? 'awaiting confirmation' : 'not answered');
    return `<div class="fx-player fx-state-${state}">${icon} ${fixtureLink(n)} <span class="fx-player-state">${label}</span></div>`;
  }).join('')}</div>`;
}

// What the selected player can do about this fixture -- for themselves.
function fixtureViewerActionsHtml(req){
  const me = FixtureFlow.participantName(req, fixtureActor());
  if(!me || !FixtureFlow.isOpen(req)) return '';
  const inNow = !!(req.confirmations || {})[me];
  const cantNow = !!(req.cantPlay || {})[me];
  const agreed = FixtureFlow.isAgreed(req);
  const btn = (response, label, cls) => `<button type="button" class="preset-btn fx-respond ${cls}" data-fixture-id="${escapeHtml(req.id)}" data-response="${response}">${label}</button>`;
  let body;
  if(!inNow && !cantNow) body = btn('in', "I'm in", 'fx-in') + btn('cant', "Can't play", 'fx-cant');
  else if(inNow) body = `<span class="fx-you">You're in</span>` + btn('cant', agreed ? "I can't play" : "Can't play", 'fx-cant');
  else body = `<span class="fx-you fx-you-cant">You said you can't play</span>` + btn('in', "I'm in after all", 'fx-in');
  return `<div class="fx-actions">${body}</div>`;
}

// Admin removal: two steps, inside Manage fixture, and never shown to a player.
function fixtureAdminRemoveHtml(req){
  if(!isUnlocked || !FixtureFlow.isOpen(req)) return '';
  const id = escapeHtml(req.id);
  if(fixtureRemoveArmed === req.id){
    return `<div class="fx-remove-confirm">
      <div>Remove this fixture for everyone? It leaves ${FixtureFlow.isAgreed(req) ? 'the Upcoming tab' : 'Requests'}; its history is kept.</div>
      <div class="difficulty-row" style="margin-top:8px;">
        <button type="button" class="preset-btn fx-remove-yes" data-fixture-id="${id}" style="flex:1;">Remove fixture</button>
        <button type="button" class="preset-btn fx-remove-no" data-fixture-id="${id}" style="flex:1;">Keep it</button>
      </div>
    </div>`;
  }
  return `<button type="button" class="lg-inline-fold fx-remove-arm" data-fixture-id="${id}">Remove fixture…</button>`;
}

// Manage fixture: the admin's one place to maintain a fixture -- players and
// sides, each player's answer, date, time, venue and the court booking -- and,
// set apart at the bottom, removing it. Every save edits this fixture; none
// makes a new one.
function fixtureManageHtml(req){
  if(!isUnlocked || !FixtureFlow.isOpen(req)) return '';
  const id = escapeHtml(req.id);
  const open = fixtureManageOpen === req.id;
  let html = `<button type="button" class="lg-inline-fold fx-manage-toggle" data-fixture-id="${id}" aria-expanded="${open}" aria-controls="fxManage_${id}">
      Manage fixture<span class="lg-inline-chev" aria-hidden="true">${open ? '⌄' : '›'}</span>
    </button>`;
  if(!open) return html;
  const seatList = FixtureFlow.seats(req);
  const size = Math.floor(seatList.length / 2);
  const names = allPlayerNames();
  const seatRow = (n, i) => {
    const options = (names.includes(n) ? names : [n, ...names])
      .map(x => `<option value="${escapeHtml(x)}"${x === n ? ' selected' : ''}>${escapeHtml(x)}</option>`).join('');
    const st = FixtureFlow.availabilityOf(req, n);
    const stOpt = (v, label) => `<option value="${v}"${st === v ? ' selected' : ''}>${label}</option>`;
    return `<div class="fx-m-seat-row">
      <select class="fg-select fx-m-seat" data-seat="${i}" data-original="${escapeHtml(n)}" aria-label="Player ${i + 1}">${options}</select>
      <select class="fg-select fx-m-state" data-seat="${i}" aria-label="Player ${i + 1} answer">${stOpt('in', 'In')}${stOpt('waiting', 'Not answered')}${stOpt('out', 'Backed out')}</select>
    </div>`;
  };
  const booked = req.courtBookingMade === true;
  const recorded = FixtureFlow.bookingRecorded(req);
  const answers = Object.fromEntries(req.players.map(n => [n, FixtureFlow.availabilityOf(req, n)]));
  html += `<div class="fx-manage" id="fxManage_${id}" data-fixture-id="${id}" data-answers="${escapeHtml(JSON.stringify(answers))}">
    <div class="fx-m-label">Side A</div>
    ${seatList.slice(0, size).map((n, i) => seatRow(n, i)).join('')}
    <div class="fx-m-label">Side B</div>
    ${seatList.slice(size).map((n, i) => seatRow(n, i + size)).join('')}
    <div class="fx-m-hint" hidden>A new player starts as not answered — they confirm for themselves.</div>
    <div class="fx-m-grid">
      <label class="fx-m-field"><span class="fx-m-label">Date</span><input type="date" class="fg-select fx-m-date" value="${escapeHtml(req.preferredDate || '')}"></label>
      <label class="fx-m-field"><span class="fx-m-label">Time</span><input type="time" class="fg-select fx-m-time" value="${escapeHtml(req.preferredTime || '')}"></label>
    </div>
    <label class="fx-m-field"><span class="fx-m-label">Venue</span><input class="fg-select fx-m-venue" value="${escapeHtml(req.location || '')}" placeholder="Court or venue"></label>
    <label class="fx-m-booking">
      <input type="checkbox" class="fx-m-booked" data-initial="${recorded ? String(booked) : 'unset'}"${booked ? ' checked' : ''}>
      <span><b>Court booking made</b><br><span class="fx-m-sub">Marks this game as booked and moves it to Upcoming.${recorded ? '' : ' Not recorded for this game yet.'}</span></span>
    </label>
    ${fixtureManageMessage ? `<div class="fx-note fx-note-attn">${escapeHtml(fixtureManageMessage)}</div>` : ''}
    <div class="fx-actions">
      <button type="button" class="preset-btn fx-m-save" data-fixture-id="${id}">Save changes</button>
      <button type="button" class="preset-btn fx-m-cancel" data-fixture-id="${id}">Cancel</button>
    </div>
    ${fixtureArchiveControlHtml(req)}
    <div class="fx-m-danger">${fixtureAdminRemoveHtml(req)}</div>
  </div>`;
  return html;
}

// Archive call-out / Restore to Called Out: a state change on the same
// fixture, never a copy. Offered only where it applies.
function fixtureArchiveControlHtml(req){
  const st = FixtureFlow.stage(req, new Date().toISOString());
  const id = escapeHtml(req.id);
  if(st === FixtureFlow.STAGE.CALLED_OUT){
    return `<div class="fx-m-archive"><button type="button" class="preset-btn fx-archive" data-fixture-id="${id}">Archive call-out</button>
      <div class="fx-m-sub">Takes it off the active list. Nothing is deleted; it can be restored.</div></div>`;
  }
  if(st === FixtureFlow.STAGE.ARCHIVED){
    return `<div class="fx-m-archive"><button type="button" class="preset-btn fx-in fx-restore" data-fixture-id="${id}">Restore to Called Out</button>
      <div class="fx-m-sub">Back on the active list for another ${FixtureFlow.ARCHIVE_DAYS} days.</div></div>`;
  }
  return '';
}

// A recorded result, said the way the Games list says it.
function fixtureResultLine(m){
  const score = (m.sets && m.sets.length) ? m.sets.map(([a,b]) => `${a}-${b}`).join(', ') : '';
  const verb = m.isDraw ? 'drew with' : 'def';
  return `${escapeHtml(m.date)} · ${m.winners.map(escapeHtml).join(' &amp; ')} ${verb} ${m.losers.map(escapeHtml).join(' &amp; ')}${score ? ' · ' + escapeHtml(score) : ''}`;
}

// What an agreed fixture is called where it is listed.
function fixtureStageWord(req){
  const s = FixtureFlow.stage(req);
  return s === FixtureFlow.STAGE.UPCOMING ? 'Upcoming game' : s === FixtureFlow.STAGE.CALLED_OUT ? 'Called Out game'
    : s === FixtureFlow.STAGE.ARCHIVED ? 'archived call-out' : 'game';
}

// Admin, on an agreed fixture that may already have been played: the recorded
// results that could be it, and a human decision. Nothing here runs on its
// own -- a fixture only closes when one of these buttons is pressed.
function fixtureReconcileHtml(req, ctx){
  if(!isUnlocked || !FixtureFlow.isAgreed(req)) return '';
  const cands = FixtureFlow.candidatesForFixture(req, ctx.results, { canon: playerIdFor, linkedResultIds: ctx.linked });
  if(!cands.length) return '';
  const id = escapeHtml(req.id);
  const word = fixtureStageWord(req);
  return `<div class="fx-reconcile">
    <div class="fx-reconcile-q">Does ${cands.length === 1 ? 'this recorded result' : 'one of these recorded results'} belong to this ${word}?</div>
    ${cands.map(c => `<div class="fx-reconcile-row">
      <div class="fx-reconcile-label">Result recorded</div>
      <div>${fixtureResultLine(c.result)}</div>
      <div class="fx-reconcile-why">${c.reasons.map(escapeHtml).join(' · ')}</div>
      <button type="button" class="preset-btn fx-reconcile-yes" data-fixture-id="${id}" data-result-id="${escapeHtml(c.result.id)}">This was the game</button>
    </div>`).join('')}
    <button type="button" class="preset-btn fx-reconcile-no" data-fixture-id="${id}" data-result-ids="${escapeHtml(cands.map(c => c.result.id).join(','))}">${cands.length === 1 ? `${word[0].toUpperCase() + word.slice(1)} is still outstanding` : 'None — still outstanding'}</button>
  </div>`;
}

// An unconfirmed request, as Play > Requests shows it.
function buildPendingRequestCardHtml(req){
  const attention = FixtureFlow.cantPlayers(req);
  return `<div class="callout-card fx-card${attention.length ? ' fx-attn' : ''}" data-fixture-id="${escapeHtml(req.id)}">
    <div class="cc-title">${fixtureTeamsHtml(req)}</div>
    <div class="cc-detail">${requestWhenHtml(req, { tbc: false })}requested by ${escapeHtml(req.requestedBy)} (${fmtRelative(req.requestedAt)})</div>
    <div class="fx-count">${FixtureFlow.confirmedCount(req)}/${req.players.length} confirmed${attention.length ? ` · <span class="fx-tag fx-tag-attn">Needs attention</span>` : ''}</div>
    ${fixturePlayersHtml(req)}
    ${fixtureViewerActionsHtml(req)}
    ${fixtureManageHtml(req)}
  </div>`;
}

// An agreed fixture -- Upcoming, Called Out or Needs attention: one line to
// scan when folded, everything when open.
function buildUpcomingCardHtml(req, ctx){
  const open = upcomingOpen.has(req.id);
  const now = ctx.now || new Date().toISOString();
  const stage = FixtureFlow.stage(req, now);
  const S = FixtureFlow.STAGE;
  const archive = stage === S.ARCHIVED ? FixtureFlow.archiveInfo(req, now) : null;
  const booked = FixtureFlow.isBooked(req);
  const sum = FixtureFlow.summaryLine(req, requestTeams);
  const submitted = ctx.submittedFor.has(req.id);
  const past = !!req.preferredDate && req.preferredDate < ctx.today;
  const n = req.players.length;
  const id = escapeHtml(req.id);

  // Line two of the folded card: where the fixture stands.
  const status = [];
  if(stage === S.ATTENTION){
    status.push(`<span class="fx-tag fx-tag-attn">Needs attention</span> ${escapeHtml(fixtureAttentionText(req))}`);
    status.push(booked ? 'Court booked' : 'Court not booked');
  } else if(stage === S.UPCOMING){
    status.push(`${FixtureFlow.confirmedCount(req)}/${n} confirmed`, 'Court booked');
  } else if(archive){
    status.push(`Archived ${fmtRelative(archive.at)}`, archive.auto ? `after ${FixtureFlow.ARCHIVE_DAYS} days unbooked` : `by ${escapeHtml(archive.by)}`);
  } else {
    status.push(`${FixtureFlow.confirmedCount(req)}/${n} agreed`, 'Court not booked',
      req.restoredAt ? `Restored ${fmtRelative(req.restoredAt)}` : `Called out ${fmtRelative(FixtureFlow.activeSince(req))}`);
  }
  const tags = [];
  if(submitted) tags.push(`<span class="fx-tag">Result submitted</span>`);
  else if(past) tags.push(`<span class="fx-tag fx-tag-past">Date passed</span>`);
  if(isUnlocked && !FixtureFlow.bookingRecorded(req)) tags.push(`<span class="fx-tag fx-tag-past">Booking not recorded</span>`);
  const proposed = !booked;

  let html = `<div class="callout-card fx-card fx-upcoming fx-stage-${stage}${stage === S.ATTENTION ? ' fx-attn' : ''}${open ? ' is-open' : ''}" data-fixture-id="${id}">
    <button type="button" class="fx-head" data-fixture-id="${id}" aria-expanded="${open}" aria-controls="fxBody_${id}">
      <span class="fx-head-text">
        <span class="fx-title">${escapeHtml(sum.title)}</span>
        <span class="fx-meta">${proposed ? 'Proposed: ' : ''}${escapeHtml(fixtureWhenText(req))}</span>
        <span class="fx-meta">${status.join(' · ')}${tags.length ? ' ' + tags.join(' ') : ''}</span>
      </span>
      <span class="fx-chev" aria-hidden="true">${open ? '⌄' : '›'}</span>
    </button>`;
  if(open){
    html += `<div class="fx-body" id="fxBody_${id}">
      <div class="cc-title">${fixtureTeamsHtml(req)}</div>
      <div class="cc-detail">${proposed ? 'Proposed: ' : ''}${escapeHtml(fixtureWhenText(req))} · requested by ${escapeHtml(req.requestedBy)} (${fmtRelative(req.requestedAt)})</div>
      <div class="fx-court ${booked ? 'fx-court-yes' : 'fx-court-no'}">${booked ? 'Court booked' : 'Court not booked yet'}</div>
      ${fixturePlayersHtml(req)}
      ${stage === S.ATTENTION ? `<div class="fx-note fx-note-attn">${escapeHtml(fixtureAttentionText(req))} — this game needs sorting out${booked ? ', and a court is booked' : ''}.</div>` : ''}
      ${archive ? `<div class="fx-note">Archived ${archive.auto ? `automatically, ${FixtureFlow.ARCHIVE_DAYS} days after it was ${req.restoredAt ? 'restored' : 'called out'} without a court booking` : `by ${escapeHtml(archive.by)}`}. Not cancelled and not deleted — first called out ${escapeHtml(fmtFixtureDate(FixtureFlow.calledOutAt(req).slice(0, 10)))}.${isUnlocked ? ' Restore it from Manage fixture.' : ''}</div>` : ''}
      ${submitted ? `<div class="fx-note">A result has been submitted from this game and is waiting for an admin to approve it.</div>`
        : (past ? `<div class="fx-note">The date has passed and no result is linked to this game yet.</div>` : '')}
      <div class="fx-actions">
        ${submitted ? '' : `<button type="button" class="preset-btn request-addresult-btn" data-request-id="${id}">Add result</button>`}
      </div>
      ${archive ? '' : fixtureViewerActionsHtml(req)}
      ${upcomingPredictionHtml(req)}
      ${fixtureReconcileHtml(req, ctx)}
      ${fixtureManageHtml(req)}
    </div>`;
  }
  return html + `</div>`;
}

// Every fixture control, on whichever screen drew it.
function wireFixtureControls(box){
  const find = (id) => gameRequestsState.find(r => r.id === id);
  box.querySelectorAll('.fx-head').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.fixtureId;
      if(upcomingOpen.has(id)) upcomingOpen.delete(id); else upcomingOpen.add(id);
      renderUpcoming();
    };
  });
  box.querySelectorAll('.fx-respond').forEach(btn=>{
    btn.onclick = async ()=>{
      const req = find(btn.dataset.fixtureId);
      const actor = fixtureActor();
      if(!req || !actor) return;
      await commitFixtureChange(()=> FixtureFlow.respond(req, actor, btn.dataset.response));
    };
  });
  box.querySelectorAll('.fx-manage-toggle').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.fixtureId;
      fixtureManageOpen = fixtureManageOpen === id ? null : id;
      fixtureManageMessage = '';
      fixtureRemoveArmed = null;
      renderActiveTab();
    };
  });
  // A seat's answer follows its player. Someone already in the game keeps
  // theirs when moved to another seat; a new name starts unanswered, whatever
  // the player they replace had said.
  box.querySelectorAll('.fx-m-seat').forEach(sel=>{
    sel.onchange = ()=>{
      const panel = sel.closest('.fx-manage');
      const answers = JSON.parse(panel.dataset.answers || '{}');
      const state = panel.querySelector(`.fx-m-state[data-seat="${sel.dataset.seat}"]`);
      if(state) state.value = answers[sel.value] || 'waiting';
      const hint = panel.querySelector('.fx-m-hint');
      if(hint) hint.hidden = ![...panel.querySelectorAll('.fx-m-seat')].some(s => !(s.value in answers));
    };
  });
  box.querySelectorAll('.fx-m-cancel').forEach(btn=>{
    btn.onclick = ()=>{ fixtureManageOpen = null; fixtureManageMessage = ''; fixtureRemoveArmed = null; renderActiveTab(); };
  });
  box.querySelectorAll('.fx-m-save').forEach(btn=>{
    btn.onclick = async ()=>{
      const req = find(btn.dataset.fixtureId);
      const panel = btn.closest('.fx-manage');
      if(!req || !panel) return;
      const seatsNow = [...panel.querySelectorAll('.fx-m-seat')].map(s => s.value);
      const availability = {};
      panel.querySelectorAll('.fx-m-state').forEach(s => { availability[seatsNow[+s.dataset.seat]] = s.value; });
      const booking = panel.querySelector('.fx-m-booked');
      const edit = {
        seats: seatsNow, availability,
        date: panel.querySelector('.fx-m-date').value,
        time: panel.querySelector('.fx-m-time').value,
        venue: panel.querySelector('.fx-m-venue').value,
      };
      // Left unrecorded unless the admin actually answered it.
      if(!(booking.dataset.initial === 'unset' && !booking.checked)) edit.courtBookingMade = booking.checked;
      const result = await commitFixtureChange(()=> FixtureFlow.adminEdit(req, edit, { isAdmin: isUnlocked, by: fixtureAdminName(), canon: playerIdFor }));
      if(result && result.ok && result.saved){
        fixtureManageOpen = null; fixtureManageMessage = '';
        fixtureFlashMessage = result.changes ? 'Fixture updated.' : 'Nothing changed.';
      } else {
        fixtureManageMessage = fixtureFlashMessage || 'Nothing was saved.';
      }
      renderActiveTab();
    };
  });
  box.querySelectorAll('.fx-archive').forEach(btn=>{
    btn.onclick = async ()=>{
      const req = find(btn.dataset.fixtureId);
      if(!req) return;
      fixtureManageOpen = null;
      const r = await commitFixtureChange(()=> FixtureFlow.archiveCallOut(req, { isAdmin: isUnlocked, by: fixtureAdminName() }));
      if(r && r.ok && r.saved){ fixtureFlashMessage = 'Archived. It is under Archived call-outs, and can be restored.'; renderActiveTab(); }
    };
  });
  box.querySelectorAll('.fx-restore').forEach(btn=>{
    btn.onclick = async ()=>{
      const req = find(btn.dataset.fixtureId);
      if(!req) return;
      fixtureManageOpen = null;
      const r = await commitFixtureChange(()=> FixtureFlow.restoreCallOut(req, { isAdmin: isUnlocked, by: fixtureAdminName() }));
      if(r && r.ok && r.saved){ fixtureFlashMessage = `Restored to Called Out for another ${FixtureFlow.ARCHIVE_DAYS} days.`; renderActiveTab(); }
    };
  });
  box.querySelectorAll('.fx-book-set').forEach(btn=>{
    btn.onclick = async ()=>{
      const req = find(btn.dataset.fixtureId);
      if(!req) return;
      await commitFixtureChange(()=> FixtureFlow.setCourtBooking(req, { isAdmin: isUnlocked, booked: btn.dataset.booked === 'true', by: fixtureAdminName() }));
    };
  });
  box.querySelectorAll('.fx-remove-arm').forEach(btn=>{
    btn.onclick = ()=>{ fixtureRemoveArmed = btn.dataset.fixtureId; renderActiveTab(); };
  });
  box.querySelectorAll('.fx-remove-no').forEach(btn=>{
    btn.onclick = ()=>{ fixtureRemoveArmed = null; renderActiveTab(); };
  });
  box.querySelectorAll('.fx-remove-yes').forEach(btn=>{
    btn.onclick = async ()=>{
      const req = find(btn.dataset.fixtureId);
      if(!req || fixtureRemoveArmed !== req.id) return;
      fixtureRemoveArmed = null;
      fixtureManageOpen = null;
      await commitFixtureChange(()=> FixtureFlow.adminRemove(req, { isAdmin: isUnlocked, confirmed: true, by: fixtureAdminName() }));
    };
  });
  box.querySelectorAll('.fx-reconcile-yes').forEach(btn=>{
    btn.onclick = async ()=>{
      const req = find(btn.dataset.fixtureId);
      if(!req) return;
      await commitFixtureChange(()=> FixtureFlow.reconcile(req, { isAdmin: isUnlocked, resultId: btn.dataset.resultId, by: fixtureAdminName() }));
    };
  });
  box.querySelectorAll('.fx-reconcile-no').forEach(btn=>{
    btn.onclick = async ()=>{
      const req = find(btn.dataset.fixtureId);
      if(!req) return;
      const ids = (btn.dataset.resultIds || '').split(',').filter(Boolean);
      await commitFixtureChange(()=>{
        let last = { ok: false };
        ids.forEach(resultId => { last = FixtureFlow.keepOutstanding(req, { isAdmin: isUnlocked, resultId, by: fixtureAdminName() }); });
        return last;
      });
    };
  });
}

// Date, time and place, in a line.
//
// `tbc` is for a game that is AGREED and not yet scheduled -- most of them.
// There, saying "Date TBC" is information: the game is on, the details are
// not settled, and refusing to create one without a date would make Upcoming
// describe a club that plans further ahead than it does. On a request that
// nobody has confirmed yet, the same words are noise: of course it has no
// venue, it is not a fixture.
function requestWhenHtml(req, opts){
  const tbc = !!(opts && opts.tbc);
  const bits = [];
  if(req.preferredDate) bits.push(escapeHtml(req.preferredDate));
  else if(tbc) bits.push('Date TBC');
  if(req.preferredTime) bits.push(escapeHtml(req.preferredTime));
  if(req.location) bits.push(escapeHtml(req.location));
  else if(tbc) bits.push('Venue TBC');
  return bits.length ? bits.join(' · ') + ' · ' : '';
}

// The court booking, asked for explicitly wherever an admin records an agreed
// game. Off unless ticked: a date or a venue is not a booking.
function courtBookingCheckboxHtml(id){
  return `<label class="fx-m-booking" style="margin:4px 0 8px;">
    <input type="checkbox" id="${id}">
    <span><b>Court booking made</b><br><span class="fx-m-sub">Marks this game as booked and moves it to Upcoming.</span></span>
  </label>`;
}

function wireRequestPlayerLinks(box){
  box.querySelectorAll('.request-player-link').forEach(el=>{
    el.onclick = ()=> openSheet(el.dataset.player);
  });
}

// "today", "yesterday", "3 days ago" -- by calendar day, where the reader is.
function fmtRequestedDay(iso){
  if(!iso) return '';
  const d = new Date(iso), now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const n = Math.round((day(now) - day(d)) / 86400000);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
}

// A request the selected player made: where it stands, at a glance.
function buildMyRequestCardHtml(req){
  const sum = FixtureFlow.summaryLine(req, requestTeams);
  const cant = FixtureFlow.cantPlayers(req);
  const waiting = req.players.filter(n => !(req.confirmations || {})[n] && !(req.cantPlay || {})[n]);
  const status = [`${FixtureFlow.confirmedCount(req)}/${req.players.length} agreed`];
  if(cant.length) status.unshift(`<span class="fx-tag fx-tag-attn">Needs attention</span> ${escapeHtml(cant.join(', '))} can't play`);
  if(waiting.length) status.push(`Waiting for ${escapeHtml(waiting.join(', '))}`);
  return `<div class="callout-card fx-card fx-mine${cant.length ? ' fx-attn' : ''}" data-fixture-id="${escapeHtml(req.id)}">
    <div class="cc-title">${fixtureTeamsHtml(req)}</div>
    <div class="fx-count">${status.join(' · ')}</div>
    <div class="cc-detail">Requested ${fmtRequestedDay(req.requestedAt)}${req.preferredDate ? ' · proposed ' + escapeHtml(fmtFixtureDate(req.preferredDate)) : ''}${req.batch ? ' · from a list' : ''}</div>
    ${fixtureViewerActionsHtml(req)}
    ${fixtureManageHtml(req)}
  </div>`;
}

// ---- Add multiple games: paste, review, then create ------------------------
// Nothing is written until the reviewed list is confirmed with one tap.
let bulkDraft = { text: '', rows: null, me: null, by: null, choices: {}, skip: {}, editing: {}, message: '' };

const STAGE_PLACE = { proposed: 'Requests', 'called-out': 'Called Out', upcoming: 'Upcoming', attention: 'Needs attention' };

// Every parsed row with the person's choices applied, and what would stop it.
function bulkReviewed(){
  if(!bulkDraft.rows) return [];
  const now = new Date().toISOString();
  const seen = [];
  return bulkDraft.rows.map(row => {
    const r = FixtureParse.review(row, bulkDraft.choices[row.lineNo], { canon: playerIdFor });
    const warnings = [];
    if(r.ready){
      FixtureFlow.matchupDuplicates(r.players, gameRequestsState, { canon: playerIdFor, teams: r.teams, now }).forEach(d => {
        warnings.push(`This matchup already exists in ${STAGE_PLACE[d.stage] || 'the fixtures'}${d.samePartnerships ? ', with the same partnerships' : ''}.`);
      });
      const key = r.players.map(playerIdFor).sort().join('|');
      const earlier = seen.find(x => x.key === key);
      if(earlier) warnings.push(`The same four players are on line ${earlier.lineNo} of this list.`);
      seen.push({ key, lineNo: row.lineNo });
    }
    const include = r.ready && !bulkDraft.skip[row.lineNo];
    return { row, ...r, warnings, include };
  });
}

function bulkSeatSelectHtml(row, si, pi, p, value){
  const names = allPlayerNames();
  const first = (p.options || []).filter(n => names.includes(n));
  const rest = names.filter(n => !first.includes(n));
  const opt = (n) => `<option value="${escapeHtml(n)}"${n === value ? ' selected' : ''}>${escapeHtml(n)}</option>`;
  return `<select class="fg-select fx-bulk-seat${value ? '' : ' fx-bulk-open'}" data-line="${row.lineNo}" data-side="${si}" data-seat="${pi}" aria-label="Line ${row.lineNo}, side ${si ? 'B' : 'A'}, player ${pi + 1}">
    <option value=""${value ? '' : ' selected'}>${escapeHtml(p.text ? `“${p.text}” — choose` : 'Choose')}</option>
    ${first.length ? `<optgroup label="Could be">${first.map(opt).join('')}</optgroup><optgroup label="Everyone">${rest.map(opt).join('')}</optgroup>` : names.map(opt).join('')}
  </select>`;
}

function bulkSectionHtml(){
  const who = submissionIdentity();
  let h = `<div id="reqFoldBulkBody">`;
  if(!bulkDraft.rows){
    h += `<div class="section-sub">Paste or write a list — one game per line, e.g. <i>Me &amp; PDM vs Rishi &amp; Erf</i>. “Me” is you. Nothing is sent until you have checked the list.</div>`;
    h += identityLineHtml('Requesting');
    h += `<textarea id="bulkText" class="fg-select fx-bulk-text" rows="7" placeholder="Me &amp; PDM vs Rishi &amp; Erf&#10;Shaun/PDM v Tom/Osh&#10;Me and KC against Len and Eli">${escapeHtml(bulkDraft.text)}</textarea>
      <div class="fx-actions"><button type="button" class="preset-btn" id="bulkParse">Check games</button></div>`;
    if(bulkDraft.message) h += `<div class="section-sub" style="color:var(--gold-bright);">${escapeHtml(bulkDraft.message)}</div>`;
    return h + `</div>`;
  }
  const rows = bulkReviewed();
  const ready = rows.filter(r => r.ready).length;
  const creating = rows.filter(r => r.include).length;
  const needs = rows.length - ready;
  h += `<div class="fx-bulk-summary"><b>${rows.length} game${rows.length === 1 ? '' : 's'} found</b> · ${ready} ready${needs ? ` · ${needs} need${needs === 1 ? 's' : ''} fixing` : ''}</div>`;
  h += `<div class="section-sub">Requested by ${escapeHtml(bulkDraft.by || who || '—')}${bulkDraft.me ? ` · “Me” is ${escapeHtml(bulkDraft.me)}` : ''}</div>`;
  rows.forEach(r => {
    const row = r.row;
    const fixable = !row.problems.length;
    const icon = r.ready ? (r.warnings.length ? '⚠' : '✓') : (fixable ? '⚠' : '✖');
    const title = r.ready ? `${r.teams[0].map(escapeHtml).join(' &amp; ')} vs ${r.teams[1].map(escapeHtml).join(' &amp; ')}` : escapeHtml(row.text);
    h += `<div class="fx-bulk-row ${r.ready ? 'is-ready' : 'is-blocked'}" data-line="${row.lineNo}">
      <div class="fx-bulk-head"><span class="fx-bulk-icon">${icon}</span><span class="fx-bulk-title">${title}</span>
        ${r.ready ? `<label class="fx-bulk-include"><input type="checkbox" class="fx-bulk-inc" data-line="${row.lineNo}"${r.include ? ' checked' : ''}> Create</label>` : ''}</div>
      <div class="fx-bulk-line">Line ${row.lineNo}: “${escapeHtml(row.text)}”</div>`;
    // A ready game shows its players as read; its seats open only to change
    // one. A game that needs a decision shows them straight away.
    const showSeats = fixable && (!r.ready || bulkDraft.editing[row.lineNo]);
    if(fixable && r.ready){
      h += `<button type="button" class="lg-inline-fold fx-bulk-change" data-line="${row.lineNo}" aria-expanded="${!!bulkDraft.editing[row.lineNo]}">${bulkDraft.editing[row.lineNo] ? 'Done' : 'Change players'}<span class="lg-inline-chev" aria-hidden="true">${bulkDraft.editing[row.lineNo] ? '⌄' : '›'}</span></button>`;
    }
    if(showSeats){
      h += row.sides.map((side, si) => `<div class="fx-bulk-side"><span class="fx-m-label">Side ${si ? 'B' : 'A'}</span>${
        side.map((p, pi) => bulkSeatSelectHtml(row, si, pi, p, r.teams[si][pi])).join('')}</div>`).join('');
    }
    r.issues.forEach(i => { h += `<div class="fx-note fx-note-attn">${escapeHtml(i.message)}</div>`; });
    if(!fixable) h += `<div class="fx-note">Fix this line in the list and check again.</div>`;
    r.warnings.forEach(w => { h += `<div class="fx-note fx-note-warn">⚠ ${escapeHtml(w)}</div>`; });
    h += `</div>`;
  });
  if(bulkDraft.message) h += `<div class="section-sub" style="color:var(--gold-bright);">${escapeHtml(bulkDraft.message)}</div>`;
  h += `<div class="fx-actions">
    <button type="button" class="preset-btn fx-in" id="bulkCreate"${creating ? '' : ' disabled'}>Create ${creating} request${creating === 1 ? '' : 's'}</button>
    <button type="button" class="preset-btn" id="bulkEdit">Edit list</button>
  </div>`;
  return h + `</div>`;
}

function wireBulk(box){
  const text = box.querySelector('#bulkText');
  if(text) text.oninput = ()=>{ bulkDraft.text = text.value; };
  const parseBtn = box.querySelector('#bulkParse');
  if(parseBtn) parseBtn.onclick = ()=>{
    bulkDraft.text = text ? text.value : bulkDraft.text;
    const by = submissionIdentity();
    const viewer = getCurrentViewer();
    if(!by){ bulkDraft.message = 'Choose who you are first — the games are requested in your name.'; renderWishlist(); return; }
    const rows = FixtureParse.parse(bulkDraft.text, { directory: allPlayerNames(), me: viewer ? viewer.name : null });
    if(!rows.length){ bulkDraft.message = 'Nothing to check yet — write one game per line.'; renderWishlist(); return; }
    Object.assign(bulkDraft, { rows, by, me: viewer ? viewer.name : null, choices: {}, skip: {}, editing: {}, message: '' });
    renderWishlist();
  };
  box.querySelectorAll('.fx-bulk-seat').forEach(sel=>{
    sel.onchange = ()=>{
      const line = +sel.dataset.line;
      const c = bulkDraft.choices[line] || (bulkDraft.choices[line] = [[], []]);
      c[+sel.dataset.side][+sel.dataset.seat] = sel.value || null;
      renderWishlist();
    };
  });
  box.querySelectorAll('.fx-bulk-inc').forEach(cb=>{
    cb.onchange = ()=>{ bulkDraft.skip[+cb.dataset.line] = !cb.checked; renderWishlist(); };
  });
  const edit = box.querySelector('#bulkEdit');
  if(edit) edit.onclick = ()=>{ Object.assign(bulkDraft, { rows: null, choices: {}, skip: {}, editing: {}, message: '' }); renderWishlist(); };
  box.querySelectorAll('.fx-bulk-change').forEach(btn=>{
    btn.onclick = ()=>{ const l = +btn.dataset.line; bulkDraft.editing[l] = !bulkDraft.editing[l]; renderWishlist(); };
  });
  const create = box.querySelector('#bulkCreate');
  if(create) create.onclick = async ()=>{
    const by = submissionIdentity();
    if(!by || by !== bulkDraft.by){
      bulkDraft.message = `You're now ${by || 'nobody'} — check the list again so the games are requested in the right name.`;
      bulkDraft.rows = null; renderWishlist(); return;
    }
    const go = bulkReviewed().filter(r => r.include);
    if(!go.length) return;
    const at = new Date().toISOString();
    const batchId = 'batch_' + Date.parse(at) + '_' + Math.random().toString(36).slice(2, 6);
    const made = go.map((r, i) => FixtureFlow.createRequest({
      players: r.players, teams: r.teams, requestedBy: by, at,
      batch: { id: batchId, index: i, size: go.length },
    }));
    const before = gameRequestsState.length;
    gameRequestsState.push(...made);
    const ok = await saveGameRequests(gameRequestsState);
    if(!ok){
      gameRequestsState.length = before;
      bulkDraft.message = storageAvailable() ? `Save failed (${lastStorageError || 'unknown error'}) — nothing was created. Try again.` : `Save failed — this page can't reach shared storage.`;
      renderWishlist(); return;
    }
    bulkDraft = { text: '', rows: null, me: null, by: null, choices: {}, skip: {}, editing: {}, message: '' };
    requestSectionOpen.mine = true;
    fixtureFlashMessage = `Created ${made.length} request${made.length === 1 ? '' : 's'} — they're under My Requests, and the other players answer them from For me.`;
    dataChanged();
  };
}

function renderWishlist(flashMessage, adminFlashMessage){
  const box = document.getElementById('wishlistView');
  const viewer = getCurrentViewer();

  const openChallenges = challengesState.filter(c => c.state !== 'confirmed').length;
  let html = foldHeading('reqFoldChallenges', `🎯 Challenges (${openChallenges})`, requestSectionOpen.challenges);
  if(requestSectionOpen.challenges){
    html += `<div id="reqFoldChallengesBody">${renderChallengesSection()}</div>`;
  }
  html += `<div class="mp-divider"></div>`;

  // For me, then My Requests: the two lists a player acts on.
  const lists = requestLists(viewer ? viewer.name : null);
  if(fixtureFlashMessage) html += `<div class="section-sub" style="color:var(--gold-bright);">${escapeHtml(fixtureFlashMessage)}</div>`;
  html += foldHeading('reqFoldForMe', `📨 For me (${lists.forMe.length})`, requestSectionOpen.forMe, { summary: 'waiting on your answer' });
  if(requestSectionOpen.forMe){
    html += `<div id="reqFoldForMeBody">`;
    html += !viewer ? `<div class="section-sub">Choose who you are to see the requests waiting on you.</div>`
      : lists.forMe.length ? lists.forMe.map(buildPendingRequestCardHtml).join('')
      : `<div class="section-sub">Nothing waiting on you.</div>`;
    html += `</div>`;
  }
  html += foldHeading('reqFoldMine', `📤 My Requests (${lists.mine.length})`, requestSectionOpen.mine, { summary: 'waiting on others' });
  if(requestSectionOpen.mine){
    html += `<div id="reqFoldMineBody">`;
    html += !viewer ? `<div class="section-sub">Choose who you are to see the requests you've made.</div>`
      : lists.mine.length ? lists.mine.map(buildMyRequestCardHtml).join('')
      : `<div class="section-sub">No requests of yours are waiting. Once all four are in, a game moves to the Upcoming tab.</div>`;
    html += `</div>`;
  }
  html += `<div class="mp-divider"></div>`;
  html += foldHeading('reqFoldRequest', '🙋 Request a game', requestSectionOpen.request,
    { summary: 'name four players' });
  if(requestSectionOpen.request){
  html += `<div id="reqFoldRequestBody">`;
  html += `<div class="section-sub">Name four players. You're in as soon as you ask; the other three answer from their For me list, and you can follow it under My Requests. Once all four are in it moves to the Upcoming tab as Called Out, until a court is booked.</div>`;
  html += identityLineHtml('Requesting');
  html += `<div class="fg-controls">
    <div class="fg-row"><label class="fg-label">Players</label>
      <input id="reqP1" list="playerNamesList" class="fg-select" placeholder="Player 1" style="margin-bottom:6px;" />
      <input id="reqP2" list="playerNamesList" class="fg-select" placeholder="Player 2" style="margin-bottom:6px;" />
      <input id="reqP3" list="playerNamesList" class="fg-select" placeholder="Player 3" style="margin-bottom:6px;" />
      <input id="reqP4" list="playerNamesList" class="fg-select" placeholder="Player 4" />
    </div>
    <datalist id="playerNamesList">${allPlayerNames().map(n=>`<option value="${n}">`).join('')}</datalist>
    <div class="fg-row"><label class="fg-label">Preferred date (optional)</label><input id="reqDate" type="date" class="fg-select" /></div>
    <div class="fg-row"><button class="tab-btn active" id="reqSubmit" style="width:100%;">Request this game</button></div>
    <div id="reqMessage" class="section-sub">${flashMessage || ''}</div>
  </div>`;
  html += `</div>`;
  }

  html += foldHeading('reqFoldBulk', '📋 Add multiple games', requestSectionOpen.bulk,
    { summary: bulkDraft.rows ? 'list being checked' : 'paste a list' });
  if(requestSectionOpen.bulk) html += bulkSectionHtml();

  if(isUnlocked){
    html += foldHeading('reqFoldAdmin', '⚡ Admin: add an agreed game', requestSectionOpen.adminAdd,
      { summary: 'already agreed' });
    if(requestSectionOpen.adminAdd){
    html += `<div id="reqFoldAdminBody">`;
    html += `<div class="section-sub">For a game already agreed in WhatsApp — skips the confirmation step. It is Called Out until a court is booked.</div>`;
    html += `<div class="fg-controls">
      <div class="fg-row"><label class="fg-label">Players</label>
        <input id="adminReqP1" list="playerNamesList" class="fg-select" placeholder="Player 1" style="margin-bottom:6px;" />
        <input id="adminReqP2" list="playerNamesList" class="fg-select" placeholder="Player 2" style="margin-bottom:6px;" />
        <input id="adminReqP3" list="playerNamesList" class="fg-select" placeholder="Player 3" style="margin-bottom:6px;" />
        <input id="adminReqP4" list="playerNamesList" class="fg-select" placeholder="Player 4" />
      </div>
      <div class="fg-row"><label class="fg-label">Preferred date (optional)</label><input id="adminReqDate" type="date" class="fg-select" /></div>
      <div class="fg-row"><label class="fg-label">Time (optional)</label><input id="adminReqTime" type="time" class="fg-select" /></div>
      <div class="fg-row"><label class="fg-label">Where (optional)</label><input id="adminReqPlace" class="fg-select" placeholder="Court or venue" /></div>
      ${courtBookingCheckboxHtml('adminReqBooked')}
      <div class="fg-row"><button class="preset-btn" id="adminReqSubmit" style="width:100%;">Add agreed game</button></div>
      <div id="adminReqMessage" class="section-sub">${adminFlashMessage || ''}</div>
    </div>`;
    html += `</div>`;
    }
  }

  // Everyone else's outstanding requests, newest first.
  html += `<div class="mp-divider"></div>`;
  html += foldHeading('reqFoldOthers', `⏳ Other requests (${lists.others.length})`, requestSectionOpen.others,
    { summary: 'everyone else' });
  if(requestSectionOpen.others){
    html += `<div id="reqFoldOthersBody">`;
    html += lists.others.length ? lists.others.map(buildPendingRequestCardHtml).join('')
      : `<div class="section-sub">No other open requests.</div>`;
    html += `</div>`;
  }

  box.innerHTML = html;
  wireRequestPlayerLinks(box);
  wireIdentityLines(box);
  wireFixtureControls(box);
  wireChallengeControls(box, flashMessage, adminFlashMessage);
  wireBulk(box);

  [['reqFoldChallenges','challenges'], ['reqFoldForMe','forMe'], ['reqFoldMine','mine'], ['reqFoldRequest','request'],
   ['reqFoldBulk','bulk'], ['reqFoldAdmin','adminAdd'], ['reqFoldOthers','others']].forEach(([id, key])=>{
    const el = document.getElementById(id);
    if(el) el.onclick = ()=>{ requestSectionOpen[key] = !requestSectionOpen[key]; renderWishlist(); };
  });

  // Every control below belongs to a section that may be shut, so none of them
  // can assume its element exists.
  const on = (id, fn) => { const el = document.getElementById(id); if(el) fn(el); };

  on('reqSubmit', (btn)=>{ btn.onclick = async ()=>{
    const msg = document.getElementById('reqMessage');
    const r = await submitGameRequest({
      names: ['reqP1','reqP2','reqP3','reqP4'].map(id=>document.getElementById(id).value),
      requestedBy: submissionIdentity(),
      date: document.getElementById('reqDate').value,
    });
    if(!r.ok){ msg.textContent = r.message; return; }
    requestSectionOpen.mine = true;
    dataChanged({ redraw: ()=> renderWishlist('Requested! It is under My Requests; the other players answer from For me.') });
  }; });

  on('adminReqSubmit', (adminReqSubmit)=>{
    adminReqSubmit.onclick = async ()=>{
      const msg = document.getElementById('adminReqMessage');
      const names = ['adminReqP1','adminReqP2','adminReqP3','adminReqP4'].map(id=>document.getElementById(id).value.trim());
      if(names.some(n=>!n)){ msg.textContent = 'Enter all four players.'; return; }
      if(new Set(names.map(n=>n.toLowerCase())).size !== 4){ msg.textContent = 'The same name appears more than once.'; return; }
      const unrecognized = names.filter(n => !PLAYERS.find(p=>p.name.toLowerCase()===n.toLowerCase()));
      if(unrecognized.length){ msg.textContent = `Unrecognized name${unrecognized.length>1?'s':''}: ${unrecognized.join(', ')}.`; return; }
      const archived = archivedAmong(names);
      if(archived.length){ msg.textContent = archivedRefusal(archived); return; }
      const adminName = requireName();
      if(!adminName) return;

      const booked = !!(document.getElementById('adminReqBooked') || {}).checked;
      const req = FixtureFlow.createAgreed({
        players: names, teams: [names.slice(0,2), names.slice(2,4)], by: adminName,
        preferredDate: document.getElementById('adminReqDate').value || '',
        preferredTime: (document.getElementById('adminReqTime') || {}).value || '',
        location: ((document.getElementById('adminReqPlace') || {}).value || '').trim(),
        courtBookingMade: booked,
      });
      gameRequestsState.push(req);
      const ok = await saveGameRequests(gameRequestsState);
      if(!ok){
        gameRequestsState.pop();
        msg.textContent = storageAvailable() ? `Save failed (${lastStorageError || 'unknown error'}) — try again.` : `Save failed — this page can't reach shared storage.`;
        return;
      }
      dataChanged({ redraw: ()=> renderWishlist(undefined, booked ? 'Added to Upcoming.' : 'Added to Called Out.') });
    };
  });

}

// Shared by every agreed-fixture card, wherever it is drawn (Upcoming, the
// game sheet): which fixtures already have a result waiting for approval, the
// recorded results an admin may reconcile against, and today.
function fixtureCardContext(now){
  return {
    now,
    today: localIsoToday(),
    submittedFor: new Set(extraMatchesState.filter(x => x.status === 'pending' && x.fixtureId).map(x => x.fixtureId)),
    results: isUnlocked ? getAllApprovedMatches() : [],
    linked: FixtureFlow.linkedResultIds(gameRequestsState),
  };
}

function renderUpcoming(){
  const box = document.getElementById('upcomingView');
  const S = FixtureFlow.STAGE;
  const now = new Date().toISOString();
  const agreed = gameRequestsState.filter(r => FixtureFlow.isAgreed(r));
  const byStage = (st) => agreed.filter(r => FixtureFlow.stage(r, now) === st);
  // Every list has one explicit order (FixtureFlow): Upcoming answers "what's
  // next?", soonest first; Called Out is a chasing list, newest (or newly
  // restored) first; archived, most recently archived first. Needs attention
  // keeps the newest disruption on top.
  const attention = byStage(S.ATTENTION).sort(FixtureFlow.requestOrder);
  const upcoming = byStage(S.UPCOMING).sort(FixtureFlow.upcomingOrder);
  const calledOut = byStage(S.CALLED_OUT).sort(FixtureFlow.calledOutOrder);
  const archived = byStage(S.ARCHIVED).sort(FixtureFlow.archivedOrder(now));
  // Made before court bookings were recorded: nothing says whether a court is
  // booked, so they sit in Called Out until an admin answers for each one.
  const unrecorded = isUnlocked ? agreed.filter(r => !FixtureFlow.bookingRecorded(r)) : [];

  const ctx = fixtureCardContext(now);
  const section = (key, id, label, list, empty, sub) => {
    let h = foldHeading(id, `${label} (${list.length})`, upcomingSectionOpen[key], sub ? { summary: sub } : undefined);
    if(upcomingSectionOpen[key]){
      h += `<div id="${id}Body">`;
      h += list.length ? list.map(r => buildUpcomingCardHtml(r, ctx)).join('') : `<div class="section-sub">${empty}</div>`;
      h += `</div>`;
    }
    return h;
  };

  let html = '';
  if(fixtureFlashMessage) html += `<div class="section-sub" style="color:var(--gold-bright);">${escapeHtml(fixtureFlashMessage)}</div>`;

  if(unrecorded.length){
    html += foldHeading('upFoldReview', `🗂 Court bookings to record (${unrecorded.length})`, upcomingSectionOpen.review, { summary: 'admin' });
    if(upcomingSectionOpen.review){
      html += `<div id="upFoldReviewBody">
        <div class="section-sub">These games were added before ${escapeHtml(CLUB.name)} recorded court bookings, so nothing says whether a court is booked. Until you answer, each is listed under Called Out.</div>
        ${unrecorded.map(r => {
          const sum = FixtureFlow.summaryLine(r, requestTeams);
          const id = escapeHtml(r.id);
          return `<div class="fx-review-row" data-fixture-id="${id}">
            <div class="fx-title">${escapeHtml(sum.title)}</div>
            <div class="fx-meta">${escapeHtml(fixtureWhenText(r))} · added ${fmtRelative(r.requestedAt)}</div>
            <div class="fx-actions">
              <button type="button" class="preset-btn fx-book-set" data-fixture-id="${id}" data-booked="true">Court booked</button>
              <button type="button" class="preset-btn fx-book-set" data-fixture-id="${id}" data-booked="false">Not booked yet</button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }
    html += `<div class="mp-divider"></div>`;
  }

  // Needs attention only appears when something needs it -- at the top, so a
  // disrupted game is never lost inside the ordinary lists.
  if(attention.length){
    html += section('attention', 'upFoldAttention', '⚠️ Needs attention', attention, '');
    html += `<div class="mp-divider"></div>`;
  }
  html += section('upcoming', 'upFoldUpcoming', '📅 Upcoming', upcoming,
    'No court-booked games yet. A Called Out game moves here once an admin records its court booking.', 'court booked');
  html += `<div class="mp-divider"></div>`;
  html += section('calledOut', 'upFoldCalledOut', '📣 Called Out', calledOut,
    'Nothing called out. A request lands here once all four players are in.', 'agreed, court not booked');
  // Call-outs nobody organised: 14 days without a booking, or archived by an
  // admin. Kept whole, folded away, restorable.
  html += section('archived', 'upFoldArchived', '🗃 Archived call-outs', archived,
    `Nothing archived. A Called Out game moves here after ${FixtureFlow.ARCHIVE_DAYS} days without a court booking.`, 'not deleted');

  box.innerHTML = html;
  wireRequestPlayerLinks(box);
  wireRequestPredictions(box);
  wireFixtureControls(box);

  [['upFoldReview','review'], ['upFoldAttention','attention'], ['upFoldUpcoming','upcoming'], ['upFoldCalledOut','calledOut'], ['upFoldArchived','archived']].forEach(([id, key])=>{
    const el = document.getElementById(id);
    if(el) el.onclick = ()=>{ upcomingSectionOpen[key] = !upcomingSectionOpen[key]; renderUpcoming(); };
  });

  box.querySelectorAll('.request-addresult-btn').forEach(btn=>{
    btn.onclick = ()=>{
      const req = gameRequestsState.find(r=>r.id===btn.dataset.requestId);
      if(!req) return;
      navigateToGamesTabForResult(req);
    };
  });
}
