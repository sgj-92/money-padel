// ===================== PLAYERS' OTHER SPELLINGS =====================
// Shaun, 8 Nov: "We have a player called Jords but sometimes people write
// Jordz and vice versa. Preferably I don't have to correct the name every
// time I enter a result."
//
// The club's list of other spellings: the community's own starting list
// (clubs/<id>/history.js, nameAliases -- Money Padel ships Jordz -> Jords),
// plus whatever an Admin adds in Admin › Player tags (the club's
// `moneypadel_name_aliases` document, Admin-only). A known spelling is read as
// the player wherever a result or a game is typed: Add a game, the result
// reader, Arrange a game. Loads before app.js; declarations only.

const NAME_ALIASES_KEY = 'moneypadel_name_aliases';

// { typed (lower case): player } -- the club's own list over the community's.
function clubNameAliases(){
  const out = {};
  const add = (map) => Object.entries(map || {}).forEach(([k, v]) => { if(k && v) out[String(k).trim().toLowerCase()] = String(v); });
  add(CLUB_RECORD.nameAliases);
  add(nameAliasesState);
  return out;
}

// A typed name as the club knows it: another spelling becomes the player; a
// player typed in any case becomes their name as written; anything else is
// left exactly as typed (a new player).
function canonicalPlayerName(typed){
  const t = String(typed || '').trim();
  if(!t) return t;
  const low = t.toLowerCase();
  const directory = allPlayerNames();
  const exact = directory.find(n => n.toLowerCase() === low);
  if(exact) return exact;
  const aka = clubNameAliases()[low];
  if(aka){ const p = directory.find(n => n.toLowerCase() === aka.toLowerCase()); if(p) return p; }
  return t;
}

async function saveNameAliases(map){
  try {
    await fsSet(NAME_ALIASES_KEY, JSON.stringify(map));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save name aliases failed', e); return false; }
}

// Admin › Player tags › Other spellings.
function nameSpellingsHtml(){
  const shipped = CLUB_RECORD.nameAliases || {};
  const rows = Object.entries(clubNameAliases()).sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
  return `<div class="section-heading">Other spellings</div>
    <div class="section-sub" style="font-size:10.5px;">A spelling here is read as the player wherever a result or a game is typed, so it never needs correcting and never makes a new player.</div>
    <div class="fg-controls">
      ${rows.length ? rows.map(([alias, player]) => {
        const builtIn = Object.keys(shipped).some(k => k.toLowerCase() === alias) && !(alias in (nameAliasesState || {}));
        return `<div class="alpha-row"><div class="alpha-name" style="font-size:13px;">“${escapeHtml(alias)}” → <b>${escapeHtml(player)}</b></div>
          ${builtIn ? '<span class="section-sub" style="font-size:10.5px; margin:0;">built in</span>' : `<button class="preset-btn" data-alias-remove="${escapeHtml(alias)}" style="width:84px;">Remove</button>`}</div>`;
      }).join('') : '<div class="section-sub">None yet.</div>'}
      <div class="fg-row" style="margin-top:6px;">
        <input id="aliasTyped" class="fg-select" placeholder="How it gets written, e.g. Jordz" style="margin-bottom:6px;" />
        <select id="aliasPlayer" class="fg-select"><option value="">…is this player</option>${allPlayerNames().slice().sort().map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}</select>
      </div>
      <div class="fg-row"><button class="preset-btn" id="aliasAdd">+ Add spelling</button></div>
      <div id="aliasMessage" class="section-sub"></div>
    </div>`;
}

function wireNameSpellings(){
  const msg = () => document.getElementById('aliasMessage');
  const add = document.getElementById('aliasAdd');
  if(add) add.onclick = async () => {
    const typed = document.getElementById('aliasTyped').value.trim();
    const player = document.getElementById('aliasPlayer').value;
    if(!typed || !player){ msg().textContent = 'Type the spelling and choose the player.'; return; }
    if(allPlayerNames().some(n => n.toLowerCase() === typed.toLowerCase())){ msg().textContent = `${typed} is already a player's name.`; return; }
    const next = { ...(nameAliasesState || {}), [typed.toLowerCase()]: player };
    if(!(await saveNameAliases(next))){ msg().textContent = `Save failed (${lastStorageError || 'unknown error'}).`; return; }
    nameAliasesState = next;
    renderManage();
  };
  document.querySelectorAll('[data-alias-remove]').forEach(b => { b.onclick = async () => {
    const next = { ...(nameAliasesState || {}) };
    delete next[b.dataset.aliasRemove];
    if(!(await saveNameAliases(next))) return;
    nameAliasesState = next;
    renderManage();
  }; });
}
