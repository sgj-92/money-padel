// ===================== RESULTS: ROTATIONS =====================
// Shaun, 15 Nov: four players who swap partners each set (Padel
// Championships, 14 Nov: Khalid, Azzu, David and Nilesh). Decided (Shaun):
//
//   * Ratings: each pairing is rated on its own games, weighted so the whole
//     session counts as about one match (ratingEngine: match.rotation).
//   * Tables: none. A rotation is not in the League, Merit, Race, W/L or the
//     qualifying minimum (app.js keeps it in V3_ROTATIONS, apart from
//     V3_MATCHES).
//   * It has its own section in Results, and head to head lists its sets as
//     history, with no win or loss.
//
// Each pairing is stored as its own match with
//   rotation { session, part, of, weight: 1 / of }
// An Admin records one here, or makes games already entered into one.
// Loads before gamesScreen.js; declarations only.

let rotationsOpen = false;
let rotationFormOpen = false;
let rotationDraft = null;     // { date, rows: [{ a1, a2, b1, b2, score }], convert: [ids] }
let rotationPlan = null;      // a staged plan awaiting confirmation
let rotationMessage = '';

// A session's pairings, newest session first.
function rotationSessions(){
  const by = {};
  (typeof V3_ROTATIONS !== 'undefined' ? V3_ROTATIONS : []).forEach(m => {
    const k = m.rotation.session;
    (by[k] = by[k] || { session: k, date: m.date, parts: [] }).parts.push(m);
  });
  return Object.values(by)
    .map(s => ({ ...s, parts: s.parts.sort((a, b) => a.rotation.part - b.rotation.part) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.session.localeCompare(a.session)));
}

function rotationPlayers(s){
  return [...new Set(s.parts.flatMap(m => m.winners.concat(m.losers)))];
}

// Each player's sets and rating change over the session.
function rotationStats(s){
  const ids = new Set(s.parts.map(m => m.id));
  const out = {};
  rotationPlayers(s).forEach(n => { out[n] = { won: 0, lost: 0, delta: 0 }; });
  s.parts.forEach(m => m.sets.forEach(([a, b]) => {
    const [w, l] = a > b ? [m.winners, m.losers] : b > a ? [m.losers, m.winners] : [[], []];
    w.forEach(n => { out[n].won++; }); l.forEach(n => { out[n].lost++; });
  }));
  (typeof V3_JOURNEY !== 'undefined' ? V3_JOURNEY : []).forEach(e => {
    if(!ids.has(e.matchId) || typeof e.ratingDelta !== 'number') return;
    const n = displayNameFor(e.playerId);
    if(out[n]) out[n].delta += e.ratingDelta;
  });
  return out;
}

function rotationPairLine(m){
  const score = m.sets.map(s => s.join('-')).join(' ');
  return m.isDraw ? `${m.winners.join(' & ')} ${score} ${m.losers.join(' & ')} (level)` : `${m.winners.join(' & ')} ${score} ${m.losers.join(' & ')}`;
}

// The sessions the Results filters select: the month, and every chosen
// player in the session.
function rotationSessionsShown(){
  const chosen = (typeof gamesPlayerLabels === 'function' ? gamesPlayerLabels() : []).map(n => n.toLowerCase());
  return rotationSessions().filter(s => (gamesMonth === 'all' || Period.of(s.date) === gamesMonth)
    && chosen.every(c => rotationPlayers(s).some(p => p.toLowerCase() === c)));
}

function rotationCardHtml(s){
  const st = rotationStats(s);
  const players = rotationPlayers(s).sort((a, b) => st[b].won - st[a].won || st[a].lost - st[b].lost);
  return `<div class="rot-card" data-rotation="${escapeHtml(s.session)}">
    <div class="rot-head">${escapeHtml(dayLabel(s.date))} · Rotation · ${s.parts.length} pairings</div>
    ${s.parts.map(m => `<div class="rot-pair">${escapeHtml(rotationPairLine(m))}</div>`).join('')}
    <div class="rot-players">${players.map(n => {
      const d = Math.round(st[n].delta * 10) / 10;
      return `<span class="rot-player"><b>${escapeHtml(n)}</b> ${st[n].won}–${st[n].lost} sets <span class="${d >= 0 ? 'perf-pos' : 'perf-neg'}">${d > 0 ? '+' : ''}${d}</span></span>`;
    }).join('')}</div>
  </div>`;
}

function rotationsSectionHtml(){
  const shown = rotationSessionShownSafe();
  if(!shown.length && !isUnlocked) return '';
  let html = `<div class="rot-section">
    <button type="button" class="rot-toggle" id="rotationsToggle" aria-expanded="${rotationsOpen}">🔄 Rotations · ${shown.length} session${shown.length === 1 ? '' : 's'} <span aria-hidden="true">${rotationsOpen ? '▴' : '▾'}</span></button>`;
  if(rotationsOpen){
    html += `<div class="section-sub" style="margin-top:4px;">Partners swap each set. Each pairing moves ratings, and a whole session counts as about one match. Rotations are not in the League, Merit, Race or W/L, and head to head shows them as history only.</div>`;
    html += shown.map(rotationCardHtml).join('') || `<div class="section-sub">No rotations for these filters.</div>`;
    if(isUnlocked) html += rotationAdminHtml();
  }
  return html + `</div>`;
}
function rotationSessionShownSafe(){ try { return rotationSessionsShown(); } catch(e){ return []; } }

// ---- Admin: record a rotation, or make games already entered into one ----

function rotationAdminHtml(){
  if(!rotationFormOpen){
    return `<button type="button" class="preset-btn" id="rotationOpenForm" style="width:100%; margin-top:8px;">Record a rotation</button>`
      + (rotationMessage ? `<div class="section-sub">${rotationMessage}</div>` : '');
  }
  const d = rotationDraft;
  const onDate = V3_MATCHES.filter(m => m.date === d.date);
  const rows = d.rows.map((r, i) => `<div class="rot-row" data-rot-row="${i}">
    <div class="rot-row-label">Pairing ${i + 1}</div>
    <div class="rot-row-teams">
      <input class="fg-select" list="playerNamesList" data-rot="a1" value="${escapeHtml(r.a1)}" placeholder="Name">
      <input class="fg-select" list="playerNamesList" data-rot="a2" value="${escapeHtml(r.a2)}" placeholder="Partner">
    </div>
    <div class="rot-v">v</div>
    <div class="rot-row-teams">
      <input class="fg-select" list="playerNamesList" data-rot="b1" value="${escapeHtml(r.b1)}" placeholder="Name">
      <input class="fg-select" list="playerNamesList" data-rot="b2" value="${escapeHtml(r.b2)}" placeholder="Partner">
    </div>
    <input class="fg-select" data-rot="score" value="${escapeHtml(r.score)}" placeholder="Score, first pair first: 6-3 or 6-2 10-6">
  </div>`).join('');
  return `<div class="fg-controls rot-form">
    <div class="fg-row"><label class="fg-label">Date</label><input type="date" class="fg-select" id="rotationDate" value="${escapeHtml(d.date)}"></div>
    ${onDate.length ? `<div class="fg-row"><label class="fg-label">Games already entered on this date, to make into the rotation</label>
      ${onDate.map(m => `<label class="late-pick"><input type="checkbox" data-rot-convert value="${escapeHtml(m.id)}"${d.convert.includes(m.id) ? ' checked' : ''}> ${escapeHtml(rotationPairLine(m))}</label>`).join('')}
      <div class="section-sub" style="font-size:10.5px;">Tick them instead of typing the pairings below.</div></div>` : ''}
    <div class="fg-row"><label class="fg-label">Or enter the pairings</label>${rows}
      <button type="button" class="preset-btn" id="rotationAddRow" style="margin-top:6px;">+ Add pairing</button></div>
    <div class="section-sub" style="font-size:10.5px;">A tie-break (e.g. 10-6) counts as one set won, with no games.</div>
    <div class="difficulty-row"><button class="tab-btn active" id="rotationPreview" style="flex:2;">Preview</button>
      <button class="preset-btn" id="rotationCancel" style="flex:1;">Cancel</button></div>
    ${rotationMessage ? `<div class="section-sub" style="color:var(--gold-bright);">${rotationMessage}</div>` : ''}
    ${rotationPlan ? rotationConfirmHtml() : ''}
  </div>`;
}

function rotationConfirmHtml(){
  const p = rotationPlan.planned;
  return `<div class="callout-card" style="padding:12px; margin-top:8px; border-color:var(--gold-dim);">
    <div style="font-weight:700; color:var(--gold-bright);">Confirm: this records the rotation</div>
    ${rotationPlan.lines.map(l => `<div class="section-sub" style="color:var(--text); margin:2px 0;">${escapeHtml(l)}</div>`).join('')}
    <div class="section-sub">Rating moves: ${p.playersMoved.map(x => movedPlayerText(x, p, true)).join(' &nbsp;·&nbsp; ') || 'none'}</div>
    ${newPlayersNoteHtml(p)}
    <div class="difficulty-row" style="margin-top:8px;"><button class="preset-btn" id="rotationCommit" style="flex:1;">Record it</button></div>
  </div>`;
}

// "6-2 10-6" -> [[6,2],[1,0]]: a tie-break is a set won, no games (Shaun, 14 Nov).
function parseRotationScore(text){
  const sets = [];
  const re = /(\d{1,2})\s*[-–:]\s*(\d{1,2})/g;
  let m;
  while((m = re.exec(String(text || '')))){
    const a = Number(m[1]), b = Number(m[2]);
    if(a === b) return null;
    sets.push(Math.max(a, b) >= 10 ? (a > b ? [1, 0] : [0, 1]) : [a, b]);
  }
  return sets.length ? sets : null;
}

function readRotationForm(){
  const d = rotationDraft;
  const date = document.getElementById('rotationDate');
  if(date) d.date = date.value;
  document.querySelectorAll('[data-rot-row]').forEach(row => {
    const r = d.rows[Number(row.dataset.rotRow)];
    row.querySelectorAll('[data-rot]').forEach(inp => { r[inp.dataset.rot] = inp.value; });
  });
  d.convert = [...document.querySelectorAll('[data-rot-convert]:checked')].map(x => x.value);
}

// The pairings as stored matches (Team A the winning side), or a reason.
function rotationMatches(){
  const d = rotationDraft;
  const O = RatingEngine.OUTCOME;
  const shape = (date, id, teamA, teamB, sets) => {
    const a = sets.filter(s => s[0] > s[1]).length, b = sets.filter(s => s[1] > s[0]).length;
    const turn = b > a;
    return { id, date, sourceIndex: Number(String(id).slice(date.length + 1)),
      teamA: turn ? teamB : teamA, teamB: turn ? teamA : teamB, sets: turn ? sets.map(s => [s[1], s[0]]) : sets,
      outcome: a === b ? O.DRAW : O.A_WINS, type: 'doubles', drawSideAssignmentArbitrary: a === b };
  };
  const toId = (n) => playerIdFor(canonicalPlayerName(n));
  const sessionNo = new Set(rotationSessions().filter(s => s.date === d.date).map(s => s.session)).size + 1;
  const session = `${d.date}-R${sessionNo}`;
  let list;
  if(d.convert.length){
    if(d.convert.length < 2) return { error: 'Tick at least two games.' };
    const raw = (V3_RECORD && V3_RECORD.matches) || [];
    list = d.convert.map(id => raw.find(x => x.id === id)).filter(Boolean)
      .sort((a, b) => a.sourceIndex - b.sourceIndex)
      .map(x => RatingStore.matchFromDoc(x));
    if(list.some(x => x.forfeit || x.late)) return { error: 'A game with a forfeit or late penalty can’t be part of a rotation.' };
    return { type: 'editMany', session, matches: list.map((x, i) => ({ ...x, rotation: { session, part: i + 1, of: list.length, weight: 1 / list.length } })) };
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return { error: 'Choose the date.' };
  const filled = d.rows.filter(r => [r.a1, r.a2, r.b1, r.b2, r.score].some(v => String(v).trim()));
  if(filled.length < 2) return { error: 'Enter at least two pairings.' };
  const used = V3_MATCHES.concat(V3_ROTATIONS).filter(m => m.date === d.date)
    .map(m => Number(String(m.id).slice(d.date.length + 1))).filter(Number.isFinite);
  let next = (used.length ? Math.max(...used) : 0) + 1;
  const out = [];
  for(let i = 0; i < filled.length; i++){
    const r = filled[i];
    const names = [r.a1, r.a2, r.b1, r.b2].map(x => String(x).trim());
    if(names.some(x => !x)) return { error: `Pairing ${i + 1}: enter all four players.` };
    if(new Set(names.map(x => toId(x).toLowerCase())).size !== 4) return { error: `Pairing ${i + 1}: four different players, please.` };
    const sets = parseRotationScore(r.score);
    if(!sets) return { error: `Pairing ${i + 1}: enter the score as 6-3 (no level sets).` };
    out.push(shape(d.date, `${d.date}-${next++}`, [toId(names[0]), toId(names[1])], [toId(names[2]), toId(names[3])], sets));
  }
  return { type: 'appendMany', session, matches: out.map((x, i) => ({ ...x, rotation: { session, part: i + 1, of: out.length, weight: 1 / out.length } })) };
}

async function stageRotation(){
  readRotationForm();
  rotationPlan = null;
  const built = rotationMatches();
  if(built.error){ rotationMessage = built.error; renderGamesTab(); return; }
  const name = requireName();
  if(!name) return;
  rotationMessage = 'Working it out…'; renderGamesTab();
  try {
    const stored = await readStoredRecord(RatingStore.firestoreCompatBackend(db));
    const planned = planIncludingNewPlayers({ stored, change: { type: built.type, matches: built.matches },
      provenance: { createdBy: name, recordedAt: new Date().toISOString(), source: built.type === 'editMany' ? 'Games made a rotation' : 'Rotation recorded' } });
    const show = (ids) => ids.map(displayNameFor).join(' & ');
    rotationPlan = { planned, lines: built.matches.map(m => `${show(m.teamA)} ${m.sets.map(s => s.join('-')).join(' ')} ${show(m.teamB)}${m.outcome === RatingEngine.OUTCOME.DRAW ? ' (level)' : ''}`) };
    rotationMessage = `${built.matches.length} pairings, each worth 1/${built.matches.length} of a match.`;
  } catch(e){ rotationMessage = e.message; }
  renderGamesTab();
}

async function commitRotation(){
  if(!rotationPlan) return;
  rotationMessage = 'Recording…'; renderGamesTab();
  try {
    await ReplayForward.commit(RatingStore.firestoreCompatBackend(db), rotationPlan.planned);
    const joined = ((rotationPlan.planned && rotationPlan.planned.newPlayers) || []).filter(n => !Object.keys(tagOverridesState).some(k => k.toLowerCase() === n.playerId.toLowerCase()));
    if(joined.length){ joined.forEach(n => { tagOverridesState[n.playerId] = { tier: n.tier, active: true }; }); await saveTagOverrides(tagOverridesState); }
    rotationPlan = null; rotationFormOpen = false; rotationDraft = null; rotationsOpen = true;
    await loadV3State();
    rotationMessage = 'Rotation recorded.';
  } catch(e){ rotationMessage = 'Nothing was recorded: ' + e.message; }
  dataChanged();
}

function wireRotations(){
  const t = document.getElementById('rotationsToggle');
  if(t) t.onclick = () => { rotationsOpen = !rotationsOpen; renderGamesTab(); };
  const open = document.getElementById('rotationOpenForm');
  if(open) open.onclick = () => {
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    rotationDraft = { date: today, rows: [0, 1, 2].map(() => ({ a1: '', a2: '', b1: '', b2: '', score: '' })), convert: [] };
    rotationFormOpen = true; rotationPlan = null; rotationMessage = ''; renderGamesTab();
  };
  const cancel = document.getElementById('rotationCancel');
  if(cancel) cancel.onclick = () => { rotationFormOpen = false; rotationDraft = null; rotationPlan = null; rotationMessage = ''; renderGamesTab(); };
  const add = document.getElementById('rotationAddRow');
  if(add) add.onclick = () => { readRotationForm(); rotationDraft.rows.push({ a1: '', a2: '', b1: '', b2: '', score: '' }); renderGamesTab(); };
  const date = document.getElementById('rotationDate');
  if(date) date.onchange = () => { readRotationForm(); rotationDraft.convert = []; rotationPlan = null; renderGamesTab(); };
  const prev = document.getElementById('rotationPreview');
  if(prev) prev.onclick = stageRotation;
  const commit = document.getElementById('rotationCommit');
  if(commit) commit.onclick = commitRotation;
}

// Head to head: the rotation sets two players shared, as history only.
function rotationH2HLines(a, b){
  const out = [];
  rotationSessions().forEach(s => s.parts.forEach(m => {
    const all = m.winners.concat(m.losers);
    if(!all.includes(a) || !all.includes(b)) return;
    const together = (m.winners.includes(a) && m.winners.includes(b)) || (m.losers.includes(a) && m.losers.includes(b));
    out.push({ date: m.date, line: rotationPairLine(m), together });
  }));
  return out;
}
