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
  const e = matchNoteOf(matchId);
  if(!e || !e.note) return '';
  return `<div class="match-note"><span class="match-note-mark">${e.asterisk ? '*' : 'Note'}</span> ${escapeHtml(e.note)}</div>`;
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
