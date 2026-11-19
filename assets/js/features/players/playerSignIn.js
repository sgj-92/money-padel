// ===================== WHO ARE YOU? › YOUR CODE =====================
// Shaun, 19 Nov: players sign in with "a unique code they enter when clicking
// on their name. Then they can stay saved on their device." Tapping a name in
// "Who are you?" asks for that player's code where the community has player
// codes (config/club.js playerAccounts); a player without one can still just
// browse as themselves, as before. The sign-in itself is data/playerAuth.js.
// Declarations only.

// Ask for a code when tapping this name? Not when this device already speaks
// for them (their code, or an Admin's own player).
function playerCodeStepWanted(name){
  return playerAccountsOn() && verifiedPlayerName() !== name;
}

// The chooser's panel becomes the code step. `choose(name)` is what the
// chooser does with a name; `back()` shows the list again.
function showPlayerCodeStep(panel, name, choose, back){
  const adminNote = signedInAdmin
    ? `<div class="viewer-code-note">You’re signed in as an Admin on this phone. Signing in as ${escapeHtml(name)} signs the Admin account out.</div>` : '';
  const switching = signedInPlayer && signedInPlayer.name !== name
    ? `<div class="viewer-code-note">${escapeHtml(signedInPlayer.name)} is signed in on this phone. ${escapeHtml(name)}’s code switches it.</div>` : '';
  panel.innerHTML = `
    <div class="mp-section-label" style="text-align:center;">${escapeHtml(CLUB.name)}</div>
    <div class="mp-display-title viewer-selector-title">Hi ${escapeHtml(name)}</div>
    <div class="viewer-selector-sub">Enter your code to sign in. You’ll stay signed in on this phone.</div>
    ${adminNote}${switching}
    <input type="text" id="playerCodeInput" class="viewer-search viewer-code-input" placeholder="KZ7P-42QM" maxlength="12"
      autocapitalize="characters" autocomplete="one-time-code" autocorrect="off" spellcheck="false" aria-label="Your code">
    <button type="button" class="mp-btn-primary mp-btn-touch viewer-code-go" id="playerCodeGo">Sign in</button>
    <div class="viewer-code-msg" id="playerCodeMsg" role="status"></div>
    <button type="button" class="viewer-skip" id="playerCodeSkip">No code yet? Just browse as ${escapeHtml(name)}</button>
    <button type="button" class="viewer-skip" id="playerCodeBack">‹ Back to players</button>`;
  const input = panel.querySelector('#playerCodeInput');
  const go = panel.querySelector('#playerCodeGo');
  const msg = panel.querySelector('#playerCodeMsg');
  const submit = async () => {
    go.disabled = true; msg.textContent = 'Signing in…';
    const r = await playerSignIn(input.value);
    go.disabled = false;
    if(!r.ok){ msg.textContent = r.message; input.focus(); return; }
    // An Admin account signed out by this is no longer Admin on this phone.
    if(!(typeof legacyAdminPasswordOn === 'function' && legacyAdminPasswordOn() && isUnlocked)) { isUnlocked = false; adminRole = null; }
    choose(r.player.name);
    if(typeof renderActiveTab === 'function') renderActiveTab();
  };
  go.onclick = submit;
  input.onkeydown = (e) => { if(e.key === 'Enter') submit(); };
  panel.querySelector('#playerCodeSkip').onclick = () => choose(name);
  panel.querySelector('#playerCodeBack').onclick = back;
  setTimeout(() => input.focus(), 50);
}

// A line for the chooser's head: who is signed in here, with Sign out.
function playerSignedInLineHtml(){
  if(!signedInPlayer) return '';
  return `<div class="viewer-code-signed">Signed in as <b>${escapeHtml(signedInPlayer.name)}</b> ✓ <button type="button" class="link-btn" id="playerSignOutBtn">Sign out</button></div>`;
}
function wirePlayerSignedInLine(root, after){
  const b = root.querySelector('#playerSignOutBtn');
  if(b) b.onclick = async () => { await playerSignOut(); clearCurrentViewer(); if(after) after(); };
}
