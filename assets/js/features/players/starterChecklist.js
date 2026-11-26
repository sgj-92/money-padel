// ===================== GETTING STARTED =====================
// Shaun, 20 Nov: "a profile starter checklist when people first log in. This
// asks them to set their playing hours up and request a game with someone
// (this part is optional)." Shown right after a player first signs in with
// their code, and on Home until it is done or hidden. Turning notifications on
// is offered too, also optional: it is what makes a request worth answering.
// Each step ticks itself off from what the player has actually done.
// Declarations only.

let starterNotifyOn = null;   // this phone's notifications, once checked (it is a slow question)

function starterHiddenKey(name){ return `starterChecklistHidden:${CLUB.id || CLUB.name}:${name}`; }
function starterHidden(name){ try { return !!localStorage.getItem(starterHiddenKey(name)); } catch(e){ return false; } }
function hideStarter(name){ try { localStorage.setItem(starterHiddenKey(name), new Date().toISOString()); } catch(e){ /* not kept: fine */ } }
// A player reset to new (Admin › Player codes) sees the list again: anything
// this phone remembers from before the reset is forgotten at sign-in.
function forgetStarterBefore(name, resetAt){
  starterNotifyOn = null;
  if(!resetAt) return;
  try { const v = localStorage.getItem(starterHiddenKey(name)); if(v && (v === '1' || v < resetAt)) localStorage.removeItem(starterHiddenKey(name)); } catch(e){ /* nothing kept */ }
}

function starterSteps(name){
  return [
    { key: 'hours', label: 'Set your playing hours', sub: 'So whoever arranges a game can see when you’re free.',
      done: !!(availabilityState[name] && Availability.hasAny(availabilityState[name])), optional: false },
    { key: 'notify', label: 'Turn on notifications', sub: 'Hear when someone asks you to play, and when a court is booked.',
      done: starterNotifyOn === true, optional: true },
    { key: 'request', label: 'Request a game with someone', sub: 'Pick three others; they answer from their phones.',
      done: gameRequestsState.some(r => r && r.requestedBy === name), optional: true },
  ];
}

// For the player this phone speaks for, while there is something left to do.
function starterWanted(name){
  if(!name || !playerAccountsOn() || verifiedPlayerName() !== name || starterHidden(name)) return false;
  return starterSteps(name).some(s => !s.done);
}

function starterChecklistHtml(name){
  const steps = starterSteps(name);
  const left = steps.filter(s => !s.done && !s.optional).length;
  return `<div class="starter" data-starter="${escapeHtml(name)}">
    <div class="starter-head"><b>Get started, ${escapeHtml(name)}</b><button type="button" class="link-btn starter-hide">Hide</button></div>
    <div class="starter-sub">${left ? 'One thing to do, two if you like.' : 'All set. The rest is up to you.'}</div>
    ${steps.map(s => `<button type="button" class="starter-step${s.done ? ' is-done' : ''}" data-starter-step="${s.key}">
      <span class="starter-tick" aria-hidden="true">${s.done ? '✓' : ''}</span>
      <span class="starter-text"><span class="starter-label">${escapeHtml(s.label)}${s.optional ? ' <span class="starter-opt">optional</span>' : ''}</span>
        <span class="starter-note">${escapeHtml(s.sub)}</span></span>
      <span class="starter-chev" aria-hidden="true">${s.done ? '' : '›'}</span>
    </button>`).join('')}
  </div>`;
}

function starterOpen(key, name){
  if(key === 'hours') openAvailabilitySheet(name);
  else if(key === 'notify') openNotificationsSheet();
  else if(key === 'request'){
    if(typeof openArrangeGame === 'function') openArrangeGame('request');   // the redesign
    else { requestSectionOpen.request = true; const t = document.querySelector('#tabrow .tab-btn[data-tab="wishlist"]'); if(t) t.click(); }
  }
}

function wireStarterChecklist(root, after){
  root.querySelectorAll('.starter').forEach(card => {
    const name = card.dataset.starter;
    card.querySelectorAll('[data-starter-step]').forEach(b => {
      b.onclick = () => { if(after) after('step'); starterOpen(b.dataset.starterStep, name); };
    });
    const hide = card.querySelector('.starter-hide');
    if(hide) hide.onclick = () => { hideStarter(name); if(after) after('hide'); };
  });
  // Notifications are asked about once; the card redraws when the answer is in.
  if(starterNotifyOn === null && typeof currentPushSubscription === 'function' && root.querySelector('.starter')){
    starterNotifyOn = false;
    // On only if this phone is on the list for this player (one phone can
    // serve two people, and a reset takes a player off the list).
    // On only if this phone is on the list for this player (one phone can
    // serve two people, and a reset takes a player off the list). Signed in
    // as them with this phone's notifications on, it is theirs: put it on the
    // list if it isn't (Shaun, 26 Nov: on, but the step wouldn't tick).
    const name = root.querySelector('.starter').dataset.starter;
    currentPushSubscription().then(async sub => {
      if(!sub) return;
      let listed = false;
      try {
        const doc = await db.collection(PUSH_SUBSCRIPTIONS_COLLECTION).doc(await subscriptionId(sub.endpoint)).get();
        listed = doc.exists && (doc.data() || {}).player === name;
      } catch(e){ listed = false; }
      if(!listed && verifiedPlayerName() === name && typeof savePushSubscription === 'function') listed = await savePushSubscription(name);
      if(!listed) return;
      starterNotifyOn = true;
      redrawStarterHosts();
    });
  }
}

// Wherever the list is drawn: the active tab, and Home in the redesign.
function redrawStarterHosts(){
  if(typeof renderActiveTab === 'function') renderActiveTab();
  if(typeof renderHomeDashboard === 'function') renderHomeDashboard();
}

// Right after a player first signs in with their code: the list, as a sheet.
function openStarterSheet(name){
  if(!starterWanted(name)) return;
  let sheet = document.getElementById('starterSheet');
  if(!sheet){
    sheet = document.createElement('div');
    sheet.className = 'shell-more-sheet';
    sheet.id = 'starterSheet';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if(e.target === sheet) sheet.classList.remove('show'); });
  }
  sheet.innerHTML = `<div class="shell-more-panel starter-panel" role="dialog" aria-label="Get started">${starterChecklistHtml(name)}
    <button type="button" class="viewer-skip starter-later">Later</button></div>`;
  wireStarterChecklist(sheet, () => sheet.classList.remove('show'));
  sheet.querySelector('.starter-later').onclick = () => sheet.classList.remove('show');
  sheet.classList.add('show');
}
