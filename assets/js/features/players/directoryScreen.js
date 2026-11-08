// ===================== PLAYERS: DIRECTORY =====================
// Players › Directory: the quiet filter line, tier / status chips, A-Z /
// Power Rating sort, letter headings and the player rows.
// Owning stream: redesign. Loads before app.js; declarations only.
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).

let playersTierFilter = 'All';

let playersActiveFilter = 'all'; // 'all' | 'active' | 'inactive'

let playersSortBy = 'name';      // 'name' | 'rating'

// Secondary filters stay folded until asked for. Not persisted: the Directory
// should open the same way every time.
let playersFiltersOpen = false;

function renderPlayersTab(){
  const box = document.getElementById('playersView');

  // The group as it is now: archived players are not in the directory.
  let rows = livePlayers();
  if(playersTierFilter !== 'All') rows = rows.filter(p => p.tier === playersTierFilter);
  if(playersActiveFilter === 'active') rows = rows.filter(p => p.active);
  else if(playersActiveFilter === 'inactive') rows = rows.filter(p => !p.active);
  if(query) rows = rows.filter(p => p.name.toLowerCase().includes(query));

  if(playersSortBy === 'rating') rows.sort((a,b)=> b.rating - a.rating);
  else rows.sort((a,b)=> a.name.localeCompare(b.name));

  // What the folded control says, so the filter state is legible without
  // opening it. Anything other than "everyone" is worth announcing.
  const tierText = playersTierFilter === 'All' ? 'All tiers' : `Tier ${playersTierFilter}`;
  const statusText = playersActiveFilter === 'all' ? 'all players'
    : (playersActiveFilter === 'active' ? 'active only' : 'temporarily inactive only');
  const filtered = playersTierFilter !== 'All' || playersActiveFilter !== 'all';

  // The filter is a line of text you can tap, the same quiet disclosure the
  // Games, League and Requests screens use. It was a bordered card with a
  // dropdown arrow -- the treatment rejected on the League screen and replaced
  // everywhere else, which this screen predated and never caught up with.
  let html = `<button type="button" class="pdir-filter-line${filtered ? ' is-on' : ''}" id="playersFilterToggle"
      aria-expanded="${playersFiltersOpen}" aria-controls="playersFilterPanel">
      Filters · <span class="pdir-filter-state">${tierText}, ${statusText}</span>
      <span class="lg-inline-chev" aria-hidden="true">${playersFiltersOpen ? '⌄' : '›'}</span>
    </button>`;

  if(playersFiltersOpen){
    html += `<div class="pdir-filters" id="playersFilterPanel">
      <div class="fg-row"><label class="fg-label">Tier</label>
        <div class="pdir-tierbar" id="playersTierBar"></div>
      </div>
      <div class="fg-row"><label class="fg-label">Status</label>
        <div class="fg-toggle" id="playersActiveToggle">
          <button class="fg-toggle-btn ${playersActiveFilter==='all'?'active':''}" data-active="all">All</button>
          <button class="fg-toggle-btn ${playersActiveFilter==='active'?'active':''}" data-active="active">Active</button>
          <button class="fg-toggle-btn ${playersActiveFilter==='inactive'?'active':''}" data-active="inactive">Temporarily inactive</button>
        </div>
      </div>
    </div>`;
  }

  if(rows.length === 0){
    html += `<div class="pdir-countbar"><span class="pdir-count">0 players · filtered</span></div>`;
    html += `<div class="section-sub">${!PLAYERS.length && awaitingFirstGame().length ? 'No ratings yet.' : 'No players match that filter.'}</div>${awaitingFirstGameHtml()}`;
    box.innerHTML = html;
    wirePlayersControls();
    return;
  }

  // Count on the left, sort on the right: one slim line where there used to
  // be a count under two full-width form buttons.
  html += `<div class="pdir-countbar">
    <span class="pdir-count">${rows.length} player${rows.length===1?'':'s'}${filtered ? ' · filtered' : ''}</span>
    <div class="pdir-seg" id="playersSortToggle" role="group" aria-label="Sort players">
      <button type="button" class="fg-toggle-btn ${playersSortBy==='name'?'active':''}" data-sortby="name" aria-pressed="${playersSortBy==='name'}">A–Z</button>
      <button type="button" class="fg-toggle-btn ${playersSortBy==='rating'?'active':''}" data-sortby="rating" aria-pressed="${playersSortBy==='rating'}">Power Rating</button>
    </div>
  </div>`;

  // Letter headings only make sense alphabetically. Sorted by rating they
  // would mark divisions that are not there.
  let lastLetter = '';
  rows.forEach(p=>{
    if(playersSortBy === 'name'){
      const letter = p.name[0].toUpperCase();
      if(letter !== lastLetter){
        html += `<div class="pdir-letter">${escapeHtml(letter)}</div>`;
        lastLetter = letter;
      }
    }
    // Active is the normal state and does not need to shout on every row;
    // inactive is the one worth noticing, and the whole row quietens with it.
    const inactive = p.active ? '' : `<span class="pdir-inactive">Temporarily inactive</span>`;
    const tierKey = String(p.tier || '').toLowerCase();
    // A player card, not a record: the same initials avatar Home uses for the
    // people in a suggested game, tinted by the club's own tier colours, so a
    // glance down the list reads tiers before it reads a single word.
    html += `<button type="button" class="pdir-row pdir-tier-${escapeHtml(tierKey)}${p.active ? '' : ' is-inactive'}" data-player="${escapeHtml(p.name)}">
      <span class="pdir-avatar" aria-hidden="true">${escapeHtml(initials(p.name))}</span>
      <span class="pdir-main">
        <span class="pdir-name">${escapeHtml(p.name)}</span>
        <span class="pdir-meta">Tier ${escapeHtml(p.tier)} · <b>${Math.round(p.rating)}</b></span>
      </span>
      <span class="pdir-right">${inactive}<span class="pdir-chev" aria-hidden="true">›</span></span>
    </button>`;
  });

  box.innerHTML = html;
  wirePlayersControls();
}

function wirePlayersControls(){
  // The tier chips only exist while the filters are open.
  const bar = document.getElementById('playersTierBar');
  if(bar){
    TIERS.forEach(t=>{
      const b = document.createElement('button');
      b.className = 'tierbtn' + (t===playersTierFilter ? ' active' : '');
      b.textContent = t === 'All' ? 'All' : 'Tier ' + t;
      b.onclick = ()=>{ playersTierFilter = t; renderPlayersTab(); };
      bar.appendChild(b);
    });
  }
  const toggle = document.getElementById('playersFilterToggle');
  if(toggle) toggle.onclick = ()=>{ playersFiltersOpen = !playersFiltersOpen; renderPlayersTab(); };

  document.querySelectorAll('#playersActiveToggle .fg-toggle-btn').forEach(b=>{
    b.onclick = ()=>{ playersActiveFilter = b.dataset.active; renderPlayersTab(); };
  });
  document.querySelectorAll('#playersSortToggle .fg-toggle-btn').forEach(b=>{
    b.onclick = ()=>{ playersSortBy = b.dataset.sortby; renderPlayersTab(); };
  });
  // A row is a button now, so the name no longer has to survive being spliced
  // into an inline onclick -- it is read back from the element.
  document.querySelectorAll('#playersView .pdir-row').forEach(el=>{
    el.onclick = ()=> openSheet(el.dataset.player);
  });
}
