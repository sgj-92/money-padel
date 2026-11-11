// ===================== RESULTS: ASTERISK AND NOTE =====================
// What a result's asterisk and note (domain/matches/matchNote.js) look like
// wherever the result is shown -- the Results card, the scorecard, head to
// head, the profile, Home -- and the Admin's editor on the Results card.
// Loads before app.js; declarations only.

function matchNoteOf(matchId){
  return MatchNote.forMatch(matchNotesState, matchId);
}

// The asterisk after a score. Its title says why, for a long-press.
function matchNoteMarkHtml(matchId){
  const e = matchNoteOf(matchId);
  if(!e || !e.asterisk) return '';
  return `<span class="match-asterisk" title="${escapeHtml(e.note || 'Marked by an Admin')}" aria-label="asterisked result">*</span>`;
}

// The note under a result.
function matchNoteLineHtml(matchId){
  const forfeit = matchForfeitLineHtml(matchId) + matchLateLineHtml(matchId);
  const e = matchNoteOf(matchId);
  if(!e || !e.note) return forfeit;
  return forfeit + `<div class="match-note"><span class="match-note-mark">${e.asterisk ? '*' : 'Note'}</span> ${escapeHtml(e.note)}</div>`;
}

// Admin › Manage on a result: the asterisk and the note, saved together.
function matchNoteEditorHtml(matchId){
  const e = matchNoteOf(matchId) || { asterisk: false, note: '' };
  return `<div class="match-note-editor" data-note-editor="${escapeHtml(matchId)}">
    <div class="fg-label" style="margin-bottom:4px;">Asterisk and note</div>
    <label class="match-note-check"><input type="checkbox" data-note-asterisk ${e.asterisk ? 'checked' : ''}> Asterisk this result</label>
    <textarea class="fg-select" rows="2" maxlength="${MatchNote.MAX_NOTE}" data-note-text placeholder="e.g. Forfeit: Rishi injured in the second set. Score agreed by both pairs.">${escapeHtml(e.note)}</textarea>
    <div class="difficulty-row" style="margin-top:6px;">
      <button class="preset-btn" data-note-save="${escapeHtml(matchId)}" style="flex:1;">Save</button>
      ${matchNoteOf(matchId) ? `<button class="preset-btn" data-note-clear="${escapeHtml(matchId)}" style="flex:1;">Remove</button>` : ''}
    </div>
    <div class="section-sub" style="font-size:10.5px; margin-top:4px;">Shown with the result to everyone, the standings site included. It changes no rating or table.</div>
    <div class="section-sub" data-note-msg></div>
  </div>`;
}

async function saveMatchNoteFrom(matchId, clear){
  const box = document.querySelector(`[data-note-editor="${CSS.escape(matchId)}"]`);
  const e = clear ? null : MatchNote.entry({
    asterisk: box && box.querySelector('[data-note-asterisk]').checked,
    note: box && box.querySelector('[data-note-text]').value,
    by: currentUserName || (signedInAdmin && signedInAdmin.name) || adminRole || 'Admin',
    at: new Date().toISOString(),
  });
  const before = matchNotesState;
  matchNotesState = MatchNote.withEntry(matchNotesState, matchId, e);
  const ok = await saveMatchNotes(matchNotesState);
  if(!ok){
    matchNotesState = before;
    const msg = box && box.querySelector('[data-note-msg]');
    if(msg) msg.textContent = `Save failed (${lastStorageError || 'unknown error'}). Try again.`;
    return false;
  }
  renderGamesTab();
  return true;
}

function wireMatchNoteEditors(root){
  (root || document).querySelectorAll('[data-note-save]').forEach(b => { b.onclick = () => saveMatchNoteFrom(b.dataset.noteSave, false); });
  (root || document).querySelectorAll('[data-note-clear]').forEach(b => { b.onclick = () => saveMatchNoteFrom(b.dataset.noteClear, true); });
}

// ===================== RESULTS: A FORFEIT =====================
// Shaun, 7 Nov: a player quit a match. A loss for him and a win for the
// opponents, at the score as it stood; his partner is untouched (ratingEngine
// processMatch: forfeit.unaffected). The rated match keeps all four players;
// the app's sides leave the partner out (v3Bridge), and `m.forfeit` says who.

function matchForfeitOf(matchId){
  if(typeof V3_MATCHES === 'undefined' || !Array.isArray(V3_MATCHES)) return null;
  if(matchForfeitOf._for !== V3_MATCHES){
    matchForfeitOf._for = V3_MATCHES;
    matchForfeitOf._map = {};
    V3_MATCHES.forEach(m => { if(m.forfeit) matchForfeitOf._map[m.id] = m.forfeit; });
  }
  return matchForfeitOf._map[matchId] || null;
}

function matchForfeitText(f){
  if(!f) return '';
  const others = (f.unaffected || []);
  return `Forfeit: ${f.by} quit. A loss for ${f.by} only${others.length ? ` — ${others.join(' & ')}'s result doesn't count` : ''}.`;
}

function matchForfeitLineHtml(matchId){
  const f = matchForfeitOf(matchId);
  if(!f) return '';
  return `<div class="match-note match-forfeit"><span class="match-note-mark">Forfeit</span> ${escapeHtml(f.by)} quit. A loss for ${escapeHtml(f.by)} only${(f.unaffected || []).length ? ` — ${escapeHtml(f.unaffected.join(' & '))}'s result doesn't count` : ''}.</div>`;
}

// Admin › Manage on a rated result: who quit. The quitter's side loses at the
// score as it stood (sides and sets turned round if they were ahead).
function matchForfeitPanelHtml(m){
  if(matchLateOf(m.id)) return '';   // one or the other
  const f = matchForfeitOf(m.id);
  if(f){
    return `<div class="match-note-editor" data-forfeit-panel="${escapeHtml(m.id)}">
      <div class="fg-label" style="margin-bottom:4px;">Forfeit</div>
      <div class="section-sub" style="margin:0 0 6px;">${escapeHtml(matchForfeitText(f))}</div>
      <button class="preset-btn" data-forfeit-remove="${escapeHtml(m.id)}" style="width:100%;">Remove the forfeit<span class="match-action-sub">${escapeHtml((f.unaffected || []).join(' & ') || 'Nobody')} counted again, as played</span></button>
    </div>`;
  }
  const raw = ((V3_RECORD && V3_RECORD.matches) || []).find(d => d.id === m.id);
  if(!raw) return '';
  const everyone = [...m.winners, ...m.losers];
  return `<div class="match-note-editor" data-forfeit-panel="${escapeHtml(m.id)}">
    <div class="fg-label" style="margin-bottom:4px;">Forfeit — a player quit</div>
    <select class="fg-select" data-forfeit-who><option value="">Who quit?</option>${everyone.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}</select>
    <button class="preset-btn" data-forfeit-stage="${escapeHtml(m.id)}" style="width:100%; margin-top:6px;">Preview the forfeit</button>
    <div class="section-sub" style="font-size:10.5px; margin-top:4px;">A loss for the player who quit and a win for the opponents, at the score as it stood. Their partner's rating and record are left untouched. You see who moves before anything is written.</div>
  </div>`;
}

// ===================== RESULTS: A LATE ARRIVAL =====================
// Shaun, 11 Nov: group rules -- more than 20 minutes late and your side
// starts a set down. The match is counted at that result (a set to the
// opponents, no games added); the late player and the opponents are rated
// and recorded on it. An on-time partner is rated on the match as played and,
// like a forfeit's partner, left out of the tables (ratingEngine processMatch:
// late; v3Bridge). `m.late` says who.

function matchLateOf(matchId){
  if(typeof V3_MATCHES === 'undefined' || !Array.isArray(V3_MATCHES)) return null;
  if(matchLateOf._for !== V3_MATCHES){
    matchLateOf._for = V3_MATCHES;
    matchLateOf._map = {};
    V3_MATCHES.forEach(m => { if(m.late) matchLateOf._map[m.id] = m; });
  }
  return matchLateOf._map[matchId] || null;
}

// Sets won by each stored side, as played, and as counted with the set given.
function matchLateSets(m){
  const a = m.sets.filter(s => s[0] > s[1]).length, b = m.sets.filter(s => s[1] > s[0]).length;
  return { played: [a, b], counted: m.late.lateSide === 'A' ? [a, b + 1] : [a + 1, b] };
}

function matchLateText(m){
  if(!m || !m.late) return '';
  const l = m.late, sets = matchLateSets(m);
  const late = l.by.join(' & ');
  const [ca, cb] = sets.counted;
  const counted = m.isDraw ? `a draw, ${ca}–${cb} in sets`
    : `${Math.max(ca, cb)}–${Math.min(ca, cb)} to ${m.winners.join(' & ')}`;
  const lateLost = !m.isDraw && m.losers.some(n => l.by.includes(n));
  const forLate = m.isDraw ? '' : (lateLost ? `, a loss for ${late}` : `, still a win for ${late}`);
  let partner = '';
  if(l.onTime.length){
    const mine = l.lateSide === 'A' ? 0 : 1;
    const [pa, pb] = sets.played;
    const res = l.playedOutcome === 'DRAW' ? 'a draw' : ((l.playedOutcome === 'A_WINS') === (mine === 0) ? 'a win' : 'a loss');
    const own = mine === 0 ? `${pa}–${pb}` : `${pb}–${pa}`;
    partner = ` ${l.onTime.join(' & ')} was on time: the result as played (${res}, ${own} in sets) counts for ${l.onTime.join(' & ')}'s rating only.`;
  }
  return `Late: ${late} arrived late, so the side started a set down. Counted as ${counted}${forLate}.${partner}`;
}

function matchLateLineHtml(matchId){
  const m = matchLateOf(matchId);
  if(!m) return '';
  return `<div class="match-note match-late"><span class="match-note-mark">Late</span> ${escapeHtml(matchLateText(m).replace(/^Late: /, ''))}</div>`;
}

// Admin › Manage on a rated result: who arrived late (one side only).
function matchLatePanelHtml(m){
  if(matchForfeitOf(m.id)) return '';   // one or the other
  const marked = matchLateOf(m.id);
  if(marked){
    return `<div class="match-note-editor" data-late-panel="${escapeHtml(m.id)}">
      <div class="fg-label" style="margin-bottom:4px;">Late arrival</div>
      <div class="section-sub" style="margin:0 0 6px;">${escapeHtml(matchLateText(marked))}</div>
      <button class="preset-btn" data-late-remove="${escapeHtml(m.id)}" style="width:100%;">Remove the late penalty<span class="match-action-sub">Counted for all four players as played</span></button>
    </div>`;
  }
  const raw = ((V3_RECORD && V3_RECORD.matches) || []).find(d => d.id === m.id);
  if(!raw) return '';
  const everyone = [...m.winners, ...m.losers];
  return `<div class="match-note-editor" data-late-panel="${escapeHtml(m.id)}">
    <div class="fg-label" style="margin-bottom:4px;">Late arrival — started a set down</div>
    <div class="late-who">${everyone.map(n => `<label class="late-pick"><input type="checkbox" data-late-who value="${escapeHtml(n)}"> ${escapeHtml(n)}</label>`).join('')}</div>
    <button class="preset-btn" data-late-stage="${escapeHtml(m.id)}" style="width:100%; margin-top:6px;">Preview the late penalty</button>
    <div class="section-sub" style="font-size:10.5px; margin-top:4px;">Tick who was late. Their side starts a set down: a set to the opponents, no games added. The late player and the opponents are rated on that result. An on-time partner is rated on the match as played, and it is left out of their tables. You see who moves before anything is written.</div>
  </div>`;
}
