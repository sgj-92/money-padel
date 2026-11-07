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
  const forfeit = matchForfeitLineHtml(matchId);
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
