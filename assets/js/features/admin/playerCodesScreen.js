// ===================== ADMIN: PLAYER CODES =====================
// Shaun, 19 Nov: each player signs in with their own code. Make one per
// player, copy the WhatsApp message with it, or replace it (the old one stops
// working). The sign-in is data/playerAuth.js. Declarations only.

let playerCodesState = null;   // { name: { code, uid, createdAt } }; null until read
let playerCodesNote = '';
let playerCodesBusy = null;    // the name being made a code for

// Shaun, 22 Nov: "I made an account called Test Account, allow me to
// continuously reset that account to new so I can refine the UX for new
// players." Only for a player whose name starts with "Test", so a real
// player can never be wiped from here.
function isTestPlayerName(name){ return /^test\b/i.test(String(name || '').trim()); }

// A test player back to brand new: a fresh code (the old one, and any phone
// signed in with it, stops working), and nothing they set up or asked for --
// their hours, their phones on the notification list, the games they asked
// for or were in, their seats on booked courts, their challenges. Their
// "Get started" list shows again on their next sign-in. Results are not
// touched: those are the ratings. No one is notified about the games removed.
// -> { ok, code, removed: { games, courts, challenges, phones } } | { ok: false, message }
async function resetPlayerToNew(name, existing){
  if(!isTestPlayerName(name)) return { ok: false, message: 'Only a test player can be reset.' };
  if(!signedInAdmin) return { ok: false, message: 'Sign in with your Admin account first.' };
  const same = (n) => String(n || '').trim().toLowerCase() === name.toLowerCase();
  const r = await issuePlayerCode(name, existing);
  if(!r.ok) return r;
  const removed = { games: 0, courts: 0, challenges: 0, phones: 0 };
  const problems = [];
  try { await db.collection(PLAYER_LOGINS_COLLECTION).doc(name).set({ resetAt: new Date().toISOString() }, { merge: true }); }
  catch(e){ problems.push('the sign-in note'); }
  try { await db.collection(AVAILABILITY_COLLECTION).doc(name).delete(); const next = { ...availabilityState }; delete next[name]; availabilityState = next; }
  catch(e){ problems.push('their hours'); }
  try {
    const snap = await db.collection(PUSH_SUBSCRIPTIONS_COLLECTION).where('player', '==', name).get();
    await Promise.all(snap.docs.map(d => d.ref.delete()));
    removed.phones = snap.docs.length;
  } catch(e){ problems.push('their phones'); }
  const games = gameRequestsState.filter(q => !(same(q.requestedBy) || (q.players || []).some(same)));
  if(games.length !== gameRequestsState.length){
    removed.games = gameRequestsState.length - games.length;
    // Taken away quietly: the baseline is the new list, so nobody is told.
    if(typeof noteFixturesLoaded === 'function') noteFixturesLoaded(games);
    if(await saveGameRequests(games)) gameRequestsState = games; else { removed.games = 0; problems.push('their games'); }
  }
  const courts = courtBookingsState.map(c => (c.players || []).some(same) ? { ...c, players: c.players.filter(n => !same(n)) } : c);
  removed.courts = courtBookingsState.filter(c => (c.players || []).some(same)).length;
  if(removed.courts){ if(await saveCourtBookings(courts)) courtBookingsState = courts; else { removed.courts = 0; problems.push('their courts'); } }
  const challenges = challengesState.filter(c => ![c.challenger, c.challenged, c.firstPartner, c.secondPartner].some(same));
  removed.challenges = challengesState.length - challenges.length;
  if(removed.challenges){ if(await saveChallenges(challenges)) challengesState = challenges; else { removed.challenges = 0; problems.push('their challenges'); } }
  if(signedInPlayer && same(signedInPlayer.name)) signedInPlayer = null;
  return { ok: true, code: r.code, removed, problems };
}

function resetSummary(name, r){
  const bits = [];
  if(r.removed.games) bits.push(`${r.removed.games} game${r.removed.games === 1 ? '' : 's'}`);
  if(r.removed.courts) bits.push(`${r.removed.courts} court seat${r.removed.courts === 1 ? '' : 's'}`);
  if(r.removed.challenges) bits.push(`${r.removed.challenges} challenge${r.removed.challenges === 1 ? '' : 's'}`);
  if(r.removed.phones) bits.push(`${r.removed.phones} phone${r.removed.phones === 1 ? '' : 's'} for notifications`);
  return `${name} is new again. Code: ${formatPlayerCode(r.code)}. Hours cleared${bits.length ? `; removed ${bits.join(', ')}` : ''}.`
    + (r.problems.length ? ` Couldn’t clear ${r.problems.join(', ')}.` : '');
}

function buildPlayerCodesHtml(){
  if(!signedInAdmin) return `<div class="section-sub">Sign in with your own Admin account to make player codes.</div>`;
  if(playerCodesState === null) return skeletonHtml('Reading codes…', 6);
  const names = entryPlayerNames();
  const made = names.filter(n => playerCodesState[n]).length;
  return `<div class="section-sub" style="margin-top:0;">Each player signs in once with their own code and stays signed in on their phone. Copy the message and send it to them on WhatsApp. They can then change it to 6 digits of their own. A new code (for one forgotten or shared) replaces the old one, which stops working. ${made} of ${names.length} have a code.</div>
    ${playerCodesNote ? `<div class="section-sub" role="status" id="playerCodesNote">${escapeHtml(playerCodesNote)}</div>` : ''}
    <div class="pc-list">${names.map(n => {
      const c = playerCodesState[n];
      const busy = playerCodesBusy === n;
      return `<div class="pc-row" data-pc-player="${escapeHtml(n)}">
        <div class="pc-name"><b>${escapeHtml(n)}</b>${c ? (c.own ? '<span class="pc-none">chose their own code ✓</span>' : `<span class="pc-code">${escapeHtml(formatPlayerCode(c.code))}</span>`) : '<span class="pc-none">no code yet</span>'}</div>
        <div class="pc-actions">${c ? `${c.own ? '' : `<button type="button" class="preset-btn pc-copy-code" data-pc-copy-code="${escapeHtml(n)}">Copy code</button><button type="button" class="preset-btn pc-copy" data-pc-copy="${escapeHtml(n)}">Copy message</button>`}
          <button type="button" class="preset-btn pc-new" data-pc-make="${escapeHtml(n)}"${busy ? ' disabled' : ''}>${busy ? 'Making…' : 'New code'}</button>`
          : `<button type="button" class="tab-btn active pc-make" data-pc-make="${escapeHtml(n)}"${busy ? ' disabled' : ''}>${busy ? 'Making…' : 'Make code'}</button>`}
          ${isTestPlayerName(n) ? `<button type="button" class="preset-btn pc-reset" data-pc-reset="${escapeHtml(n)}"${busy ? ' disabled' : ''}>Reset to new</button>` : ''}
          <button type="button" class="preset-btn pc-times" data-pc-times="${escapeHtml(n)}" title="When ${escapeHtml(n)} can play">Times${availabilityState[n] && Availability.hasAny(availabilityState[n]) ? ' ✓' : ''}</button></div>
      </div>`;
    }).join('')}</div>`;
}

function redrawPlayerCodes(){
  const body = document.querySelector('[data-acc="playercodes"] .admin-acc-body');
  if(!body) return;
  body.innerHTML = buildPlayerCodesHtml();
  wirePlayerCodes();
}

function wirePlayerCodes(){
  const body = document.querySelector('[data-acc="playercodes"] .admin-acc-body');
  if(!body) return;
  if(signedInAdmin && playerCodesState === null && !wirePlayerCodes.loading){
    wirePlayerCodes.loading = true;
    loadPlayerCodes().then((codes) => { playerCodesState = codes; }, () => {
      playerCodesState = {};
      playerCodesNote = 'Codes couldn’t be read. Publish the latest database rules (docs/PLAYER_CODES.md).';
    }).then(() => { wirePlayerCodes.loading = false; redrawPlayerCodes(); });
  }
  body.querySelectorAll('[data-pc-make]').forEach(b => {
    b.onclick = async () => {
      const name = b.dataset.pcMake, existing = playerCodesState && playerCodesState[name];
      if(existing && !await confirmSheet(`${existing.own ? 'The code they chose' : `Their current code (${formatPlayerCode(existing.code)})`} will stop working.`, { title: `New code for ${name}?`, ok: 'Make a new code' })) return;
      playerCodesBusy = name; playerCodesNote = ''; redrawPlayerCodes();
      const r = await issuePlayerCode(name, existing);
      playerCodesBusy = null;
      if(r.ok){
        playerCodesState = { ...playerCodesState, [name]: { code: r.code, createdAt: new Date().toISOString() } };
        // The uid is read back on the next load; a replacement made before then is still safe (it deletes by uid when known).
        try { playerCodesState = await loadPlayerCodes(); } catch(e){ /* keep what we have */ }
        playerCodesNote = `${name}’s code is ${formatPlayerCode(r.code)}. Copy the message to send it.`;
      } else playerCodesNote = r.message;
      redrawPlayerCodes();
    };
  });
  body.querySelectorAll('[data-pc-reset]').forEach(b => {
    b.onclick = async () => {
      const name = b.dataset.pcReset;
      if(!await confirmSheet('A new code is made, and their hours, notification phones, games, court seats and challenges are cleared. Results stay.', { title: `Reset ${name} to new?`, ok: 'Reset to new', danger: true })) return;
      playerCodesBusy = name; playerCodesNote = ''; redrawPlayerCodes();
      const r = await resetPlayerToNew(name, playerCodesState && playerCodesState[name]);
      playerCodesBusy = null;
      if(r.ok){
        try { playerCodesState = await loadPlayerCodes(); } catch(e){ playerCodesState = { ...playerCodesState, [name]: { code: r.code } }; }
        playerCodesNote = resetSummary(name, r);
        if(typeof dataChanged === 'function') dataChanged();
      } else playerCodesNote = r.message;
      redrawPlayerCodes();
    };
  });
  body.querySelectorAll('[data-pc-times]').forEach(b => { b.onclick = () => openAvailabilitySheet(b.dataset.pcTimes); });
  // The code alone (Shaun, 23 Nov), for pasting wherever the message isn't wanted.
  body.querySelectorAll('[data-pc-copy-code]').forEach(b => {
    b.onclick = async () => {
      const c = playerCodesState[b.dataset.pcCopyCode];
      const ok = await copyText(formatPlayerCode(c.code));
      b.textContent = ok ? 'Copied ✓' : 'Couldn’t copy';
      setTimeout(() => { b.textContent = 'Copy code'; }, 2000);
    };
  });
  body.querySelectorAll('[data-pc-copy]').forEach(b => {
    b.onclick = async () => {
      const name = b.dataset.pcCopy, c = playerCodesState[name];
      const ok = await copyText(playerCodeMessage(name, c.code));
      b.textContent = ok ? 'Copied ✓' : 'Couldn’t copy';
      setTimeout(() => { b.textContent = 'Copy message'; }, 2000);
    };
  });
}
