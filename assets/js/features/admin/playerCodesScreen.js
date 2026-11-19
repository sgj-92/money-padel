// ===================== ADMIN: PLAYER CODES =====================
// Shaun, 19 Nov: each player signs in with their own code. Make one per
// player, copy the WhatsApp message with it, or replace it (the old one stops
// working). The sign-in is data/playerAuth.js. Declarations only.

let playerCodesState = null;   // { name: { code, uid, createdAt } }; null until read
let playerCodesNote = '';
let playerCodesBusy = null;    // the name being made a code for

function buildPlayerCodesHtml(){
  if(!signedInAdmin) return `<div class="section-sub">Sign in with your own Admin account to make player codes.</div>`;
  if(playerCodesState === null) return `<div class="section-sub">Reading codes…</div>`;
  const names = entryPlayerNames();
  const made = names.filter(n => playerCodesState[n]).length;
  return `<div class="section-sub" style="margin-top:0;">Each player signs in once with their own code and stays signed in on their phone. Copy the message and send it to them on WhatsApp. A new code replaces the old one, which stops working. ${made} of ${names.length} have a code.</div>
    ${playerCodesNote ? `<div class="section-sub" role="status" id="playerCodesNote">${escapeHtml(playerCodesNote)}</div>` : ''}
    <div class="pc-list">${names.map(n => {
      const c = playerCodesState[n];
      const busy = playerCodesBusy === n;
      return `<div class="pc-row" data-pc-player="${escapeHtml(n)}">
        <div class="pc-name"><b>${escapeHtml(n)}</b>${c ? `<span class="pc-code">${escapeHtml(formatPlayerCode(c.code))}</span>` : '<span class="pc-none">no code yet</span>'}</div>
        <div class="pc-actions">${c ? `<button type="button" class="preset-btn pc-copy" data-pc-copy="${escapeHtml(n)}">Copy message</button>
          <button type="button" class="preset-btn pc-new" data-pc-make="${escapeHtml(n)}"${busy ? ' disabled' : ''}>${busy ? 'Making…' : 'New code'}</button>`
          : `<button type="button" class="tab-btn active pc-make" data-pc-make="${escapeHtml(n)}"${busy ? ' disabled' : ''}>${busy ? 'Making…' : 'Make code'}</button>`}</div>
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
      if(existing && !window.confirm(`Make a new code for ${name}? Their current code (${formatPlayerCode(existing.code)}) will stop working.`)) return;
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
  body.querySelectorAll('[data-pc-copy]').forEach(b => {
    b.onclick = async () => {
      const name = b.dataset.pcCopy, c = playerCodesState[name];
      const ok = await copyText(playerCodeMessage(name, c.code));
      b.textContent = ok ? 'Copied ✓' : 'Couldn’t copy';
      setTimeout(() => { b.textContent = 'Copy message'; }, 2000);
    };
  });
}
