// ===================== GAMES: SUBMITTING A RESULT =====================
// Add a game: the WhatsApp quick paste, the set rows, new-player detection and
// the submission itself (pending until an admin approves it). A write path,
// so functional code; the form's markup is in gamesScreen.js.
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: functional. Loads before app.js; declarations only.

// ===================== MANAGE TAB =====================
let addGameSets = [{w:'', l:''}, {w:'', l:''}];

// A result as people write it, read by ResultParse (domain/matches/
// resultParse.js) against the club's players -- current ones, and anyone just
// added in Admin who hasn't played yet. Archived players are left out, as in
// every other picker. It replaced a reader that accepted one exact layout.
function parseQuickEntryText(text){
  const archived = new Set(PLAYERS.filter(p => p.status === PlayerStatus.STATUS.ARCHIVED).map(p => p.name));
  const directory = [...new Set(PLAYERS.map(p => p.name).filter(n => !archived.has(n))
    .concat(Object.keys(tagOverridesState || {}).filter(n => !archived.has(n))))];
  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return ResultParse.parse(text, { directory, me: submissionIdentity() || null, today, aliases: clubNameAliases() });
}

// Winners and losers entered the wrong way round (Shaun, 11 Nov): one tap
// swaps the two teams, and every set score with them, so each score stays
// with the pair that won it. `prefix` is the form's ('ag' Add a game, 'ed'
// Edit).
function swapTeamsButtonHtml(id){
  return `<div class="fg-swap-row"><button type="button" class="preset-btn fg-swap" id="${id}" aria-label="Swap Team A and Team B">⇅ Swap teams</button></div>`;
}
function swapTeamInputs(prefix){
  [['A1','B1'], ['A2','B2']].forEach(([a, b]) => {
    const x = document.getElementById(prefix + a), y = document.getElementById(prefix + b);
    const v = x.value; x.value = y.value; y.value = v;
  });
}

function renderAddGameSets(){
  const box = document.getElementById('agSets');
  box.innerHTML = addGameSets.map((s,i)=>`
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
      <input type="number" min="0" max="30" value="${s.w}" data-idx="${i}" data-side="w" class="ag-set-input fg-select" style="width:70px;" placeholder="A" />
      <span style="color:var(--text-dim);">–</span>
      <input type="number" min="0" max="30" value="${s.l}" data-idx="${i}" data-side="l" class="ag-set-input fg-select" style="width:70px;" placeholder="B" />
      ${addGameSets.length>1 ? `<button class="preset-btn" data-remove="${i}" style="margin-left:auto;">Remove</button>` : ''}
    </div>
  `).join('');
  box.querySelectorAll('.ag-set-input').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const idx = parseInt(e.target.dataset.idx), side = e.target.dataset.side;
      addGameSets[idx][side] = e.target.value;
    });
  });
  box.querySelectorAll('[data-remove]').forEach(btn=>{
    btn.onclick = ()=>{ addGameSets.splice(parseInt(btn.dataset.remove),1); renderAddGameSets(); };
  });
}

function checkForNewPlayers(){
  const names = ['agA1','agA2','agB1','agB2'].map(id=>document.getElementById(id).value.trim()).filter(n=>n);
  // Someone added in Admin who hasn't played yet already has their starting
  // tier; asking again here would overwrite it with this picker's default.
  const known = new Set(PLAYERS.map(p=>p.name.toLowerCase())
    .concat(Object.keys(tagOverridesState || {}).filter(n => tagOverridesState[n] && tagOverridesState[n].tier).map(n => n.toLowerCase())));
  // Another spelling of a player is that player, and said so (nameSpellings.js).
  const readAs = names.filter(n => canonicalPlayerName(n).toLowerCase() !== n.toLowerCase());
  let note = document.getElementById('agNameNote');
  if(!note){ note = document.createElement('div'); note.id = 'agNameNote'; note.className = 'section-sub'; document.getElementById('agNewPlayerRow').before(note); }
  note.textContent = readAs.map(n => `“${n}” is read as ${canonicalPlayerName(n)}.`).join(' ');
  const newNames = names.filter(n=>!known.has(canonicalPlayerName(n).toLowerCase()));
  const row = document.getElementById('agNewPlayerRow');
  const box = document.getElementById('agNewPlayerTiers');
  if(newNames.length===0){ row.style.display='none'; box.innerHTML=''; return; }
  row.style.display = 'block';
  box.innerHTML = newNames.map(n=>`
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
      <span style="font-size:13px; flex:1;">${n}</span>
      <select class="fg-select ag-new-tier" data-name="${n}" style="width:120px;">
        <option value="S">Tier S</option><option value="A">Tier A</option>
        <option value="B" selected>Tier B</option><option value="C">Tier C</option>
      </select>
    </div>
  `).join('');
}

async function submitNewGame(){
  const msg = document.getElementById('agMessage');
  const submitter = submissionIdentity();
  if(!submitter){
    msg.textContent = 'Choose who you are first — every submission is recorded against someone.';
    return;
  }
  // Kept in step so a device that has chosen a player also has the typed
  // fallback populated, and so nothing downstream that still reads
  // currentUserName sees a different person from the one on screen.
  if(currentUserName !== submitter){ currentUserName = submitter; await saveMyName(submitter); }

  const date = document.getElementById('agDate').value;
  const isSingles = document.querySelector('#agTypeToggle .fg-toggle-btn.active').dataset.type === 'singles';
  const isDraw = document.querySelector('#agOutcomeToggle .fg-toggle-btn.active').dataset.outcome === 'draw';
  // Typed names as the club knows them: "Jordz" is Jords, "jords" is Jords.
  const a1 = canonicalPlayerName(document.getElementById('agA1').value);
  const a2 = canonicalPlayerName(document.getElementById('agA2').value);
  const b1 = canonicalPlayerName(document.getElementById('agB1').value);
  const b2 = canonicalPlayerName(document.getElementById('agB2').value);

  if(!date || !a1 || !b1 || (!isSingles && (!a2 || !b2))){
    msg.textContent = 'Fill in the date and all player names.'; return;
  }
  const winners = isSingles ? [a1] : [a1,a2];
  const losers = isSingles ? [b1] : [b1,b2];
  if(new Set([...winners,...losers].map(n=>n.toLowerCase())).size !== winners.length+losers.length){
    msg.textContent = 'The same name appears twice — check your entries.'; return;
  }
  const archived = archivedAmong([...winners, ...losers]);
  if(archived.length){ msg.textContent = archivedRefusal(archived); return; }

  const sets = [];
  for(const s of addGameSets){
    const w = parseInt(s.w), l = parseInt(s.l);
    if(isNaN(w) || isNaN(l)) continue;
    sets.push([w,l]);
  }
  if(sets.length===0){ msg.textContent = 'Enter at least one set score.'; return; }
  if(!isDraw){
    const setsWon = sets.filter(s=>s[0]>s[1]).length, setsLost = sets.filter(s=>s[1]>s[0]).length;
    if(setsWon < setsLost){
      msg.textContent = 'Team A\'s scores should be the winning side — swap the teams, check your set scores, or mark this as not finished / a draw.'; return;
    }
  }

  // New players' starting tiers travel with the submission. The tier list is
  // an Admin's to change (the database only lets Admins write it), so it is
  // written when an Admin approves the game (gamesAdmin.js commitApproval).
  const newPlayerTiers = {};
  document.querySelectorAll('.ag-new-tier').forEach(sel=>{ newPlayerTiers[sel.dataset.name] = sel.value; });

  const id = 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  const newMatch = {id, date, winners, losers, sets, type: isSingles?'singles':'doubles', note:'', isDraw,
                     status:'pending', submittedBy: submitter, submittedAt: new Date().toISOString()};
  if(Object.keys(newPlayerTiers).length) newMatch.newPlayerTiers = newPlayerTiers;
  // Submitted from an Upcoming card: the player has SAID which fixture this
  // was. That is a proposal, not a link -- an admin confirms it when
  // approving, and the fixture stays in Upcoming until then (D3).
  if(linkedRequestId) newMatch.fixtureId = linkedRequestId;
  extraMatchesState.push(newMatch);
  const ok = await saveExtraMatches(extraMatchesState);
  if(!ok){ msg.textContent = storageAvailable() ? `Save failed (${lastStorageError || 'unknown error'}) — try again.` : `Save failed — this page can't reach shared storage. Open the actual published/shared claude.ai link, not a downloaded file.`;; extraMatchesState.pop(); return; }

  let linkedNote = '';
  if(linkedRequestId){
    linkedNote = ' The game stays listed until an admin confirms this was it.';
    linkedRequestId = null;
  }

  const confirmation = isDraw
    ? `Submitted as a draw. ${winners.join(' & ')} vs ${losers.join(' & ')} — waiting for approval, won't affect any rating.${linkedNote}`
    : `Submitted. ${winners.join(' & ')} def ${losers.join(' & ')} — waiting for approval in the Games tab.${linkedNote}`;

  // The form is part of the Games screen, so redrawing that screen empties it
  // -- which is what the six lines of by-hand field clearing here used to be
  // for. The set rows are module state and have to be reset BEFORE the redraw
  // rather than after it, or the screen is rebuilt around the old ones.
  addGameSets = [{w:'',l:''},{w:'',l:''}];
  dataChanged();
  // Into the freshly drawn screen, not the one that has just been replaced.
  const freshMsg = document.getElementById('agMessage');
  if(freshMsg) freshMsg.textContent = confirmation;
}
