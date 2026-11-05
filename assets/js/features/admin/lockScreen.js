// ===================== ADMIN: UNLOCK =====================
// Admin sign-in: each Admin's own email and password (data/adminAuth.js).
// While a community still allows it (CLUB.legacyAdminPassword), the old
// shared owner / board password is offered underneath -- a deterrent, not
// security, kept only until the Admin accounts and database rules are live.
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: functional. Loads before app.js; declarations only.

function buildAdminSignInHtml(){
  const legacy = legacyAdminPasswordOn() && (ownerPasswordHash || boardPasswordHash)
    ? `<details class="lock-legacy" style="margin-top:14px;">
        <summary class="section-sub" style="cursor:pointer;">Use the shared Admin password instead (until Admin accounts are set up)</summary>
        <div class="fg-row" style="margin-top:8px;"><input id="lockPwInput" type="password" class="fg-select" placeholder="Shared Admin password" autocomplete="off" /></div>
        <div class="fg-row"><button class="preset-btn" id="lockUnlockBtn" style="width:100%;">Unlock with the shared password</button></div>
      </details>`
    : '';
  return `<div class="fg-controls">
    <div class="section-heading" style="margin-top:0;">🔒 Admin sign-in</div>
    <div class="section-sub">Sign in with your Admin email and password to add, approve, edit or delete games.</div>
    <div class="fg-row"><label class="fg-label" for="lockEmail">Email</label><input id="lockEmail" type="email" class="fg-select" autocomplete="username" inputmode="email" /></div>
    <div class="fg-row"><label class="fg-label" for="lockPassword">Password</label><input id="lockPassword" type="password" class="fg-select" autocomplete="current-password" /></div>
    <div class="fg-row"><button class="tab-btn active" id="lockSignInBtn" style="width:100%;">Sign in</button></div>
    <div class="fg-row"><button type="button" class="home-card-link" id="lockForgotBtn">Forgot your password?</button></div>
    <div id="lockMessage" class="section-sub"></div>
    ${legacy}
  </div>`;
}

function buildLockScreenHtml(){
  if(adminAccountsOn()) return buildAdminSignInHtml();
  const settingNew = !ownerPasswordHash && !boardPasswordHash;
  const storageWarning = !storageAvailable()
    ? `<div class="section-sub" style="color:#e8a5a1; margin-bottom:8px;">⚠️ This page can't reach shared storage right now. That usually means you're viewing a downloaded copy of this file, or an embed, rather than the actual published/shared link on claude.ai — open that link directly and this should work.</div>`
    : '';
  if(settingNew){
    return `<div class="fg-controls">
      <div class="section-heading" style="margin-top:0;">🔒 Set an admin password</div>
      ${storageWarning}
      <div class="section-sub">No password has been set yet. Whatever you set here will be needed by anyone adding, approving, editing, or deleting games — share it with whoever should have access. You can add a second, independent password later (e.g. for the board to manage themselves) once this one is set. This is a deterrent, not real security: the result is the ledger anyway, this just avoids accidental or casual changes.</div>
      <div class="fg-row"><label class="fg-label">New password</label><input id="lockPw1" type="password" class="fg-select" /></div>
      <div class="fg-row"><label class="fg-label">Confirm password</label><input id="lockPw2" type="password" class="fg-select" /></div>
      <div class="fg-row"><button class="tab-btn active" id="lockSetBtn" style="width:100%;">Set password &amp; unlock</button></div>
      <div id="lockMessage" class="section-sub"></div>
    </div>`;
  }
  return `<div class="fg-controls">
    <div class="section-heading" style="margin-top:0;">🔒 Admin area</div>
    ${storageWarning}
    <div class="section-sub">Enter either admin password to add, approve, edit, or delete games.</div>
    <div class="fg-row"><label class="fg-label">Password</label><input id="lockPwInput" type="password" class="fg-select" /></div>
    <div class="fg-row"><button class="tab-btn active" id="lockUnlockBtn" style="width:100%;">Unlock</button></div>
    <div id="lockMessage" class="section-sub"></div>
  </div>`;
}

function wireAdminSignIn(onUnlocked){
  const msg = document.getElementById('lockMessage');
  const signIn = async ()=>{
    const btn = document.getElementById('lockSignInBtn');
    btn.disabled = true; msg.textContent = 'Signing in…';
    const r = await adminSignIn(document.getElementById('lockEmail').value, document.getElementById('lockPassword').value);
    btn.disabled = false;
    if(!r.ok){ msg.textContent = r.message; return; }
    signedInAdmin = r.admin;
    isUnlocked = true;
    adminRole = r.admin.role;
    applyTabVisibility();
    onUnlocked();
  };
  document.getElementById('lockSignInBtn').onclick = signIn;
  document.getElementById('lockPassword').onkeydown = (e)=>{ if(e.key === 'Enter') signIn(); };
  document.getElementById('lockForgotBtn').onclick = async ()=>{
    const r = await sendAdminPasswordReset(document.getElementById('lockEmail').value);
    msg.textContent = r.message;
  };
  const legacyBtn = document.getElementById('lockUnlockBtn');
  if(legacyBtn) legacyBtn.onclick = async ()=>{
    const h = simpleHash(document.getElementById('lockPwInput').value);
    if(h === ownerPasswordHash || h === boardPasswordHash){
      isUnlocked = true;
      adminRole = (h === ownerPasswordHash) ? 'owner' : 'board';
      await saveMyUnlocked(true, adminRole);
      applyTabVisibility();
      onUnlocked();
    } else {
      msg.textContent = 'Incorrect password.';
    }
  };
}

// "Lock admin area": signs the account out too, so the next person on this
// phone is not an Admin.
async function lockAdminArea(){
  isUnlocked = false;
  adminRole = null;
  signedInAdmin = null;
  await adminSignOut();
  await saveMyUnlocked(false);
  applyTabVisibility();
}

function wireLockScreen(onUnlocked){
  if(adminAccountsOn()){ wireAdminSignIn(onUnlocked); return; }
  const settingNew = !ownerPasswordHash && !boardPasswordHash;
  if(settingNew){
    document.getElementById('lockSetBtn').onclick = async ()=>{
      const p1 = document.getElementById('lockPw1').value;
      const p2 = document.getElementById('lockPw2').value;
      const msg = document.getElementById('lockMessage');
      if(!p1 || p1.length<4){ msg.textContent='Use at least 4 characters.'; return; }
      if(p1!==p2){ msg.textContent="Passwords don't match."; return; }
      const hash = simpleHash(p1);
      const ok = await savePasswordHash(STORAGE_KEY_ADMIN_PW_OWNER, hash);
      if(!ok){
        msg.textContent = storageAvailable()
          ? `Save failed (${lastStorageError || 'unknown error'}) — try again in a moment.`
          : `Save failed — this page can't reach shared storage. Make sure you're on the actual published/shared claude.ai link, not a downloaded file.`;
        return;
      }
      ownerPasswordHash = hash;
      isUnlocked = true;
      adminRole = 'owner';
      await saveMyUnlocked(true, 'owner');
      applyTabVisibility();
      onUnlocked();
    };
  } else {
    document.getElementById('lockUnlockBtn').onclick = async ()=>{
      const p = document.getElementById('lockPwInput').value;
      const msg = document.getElementById('lockMessage');
      const h = simpleHash(p);
      if(h === ownerPasswordHash || h === boardPasswordHash){
        isUnlocked = true;
        // The owner's password wins if both happen to be the same, which is the
        // safe way round: it grants more, and only to someone who knows it.
        adminRole = (h === ownerPasswordHash) ? 'owner' : 'board';
        await saveMyUnlocked(true, adminRole);
        applyTabVisibility();
        onUnlocked();
      } else {
        msg.textContent = 'Incorrect password.';
      }
    };
  }
}
