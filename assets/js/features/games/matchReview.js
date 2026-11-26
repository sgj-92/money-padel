// ===================== A GAME'S REVIEW, AND FEEDBACK TO EACH PLAYER =====================
// Shaun, 26 Nov: "Add a review/debrief section to games. Sometimes we will
// have a recap/review on the match and they can also be individualised to
// each player as feedback. This should also feedback into their profiles
// somehow." Decided (AskUserQuestion): Admins and the four who played write
// them; the recap is public; feedback for one player is read only by that
// player, the one who wrote it and Admins (firestore.rules).
//
//   matchReviews/{matchId}                     { matchId, players[4], text, by, at }
//   matchFeedback/{matchId}__{player}__{by}   { matchId, players[4], player, by, at,
//                                               good, work, goodTags[], workTags[] }
//
// On a match: Review (Match result sheet) -- the recap, then each of the four
// with the feedback this reader may see and, for a writer, Give feedback.
// On a profile: Match reviews (public) and Feedback (private), with the
// focus areas most often named. Declarations only.

const REVIEW_TAGS = ['Serve', 'Return', 'Volleys', 'Smash', 'Lobs', 'Positioning', 'Movement', 'Shot choice', 'Communication', 'Consistency'];
const REVIEW_MAX = 2000;
const reviewCache = {};      // matchId -> { recap, feedback: [], loaded }
let reviewEditing = null;    // { matchId, kind: 'recap' } | { matchId, kind: 'fb', player }

// Who is writing or reading: a player by their code, or an Admin.
function reviewMe(){ return typeof verifiedPlayerName === 'function' ? verifiedPlayerName() : null; }
function reviewAdmin(){ return !!(typeof signedInAdmin !== 'undefined' && signedInAdmin && isUnlocked); }
function reviewAuthor(){ return reviewMe() || (reviewAdmin() ? (signedInAdmin.name || 'Admin') : null); }
function reviewMatch(matchId){ return (typeof matchesIncludingDraws === 'function' ? matchesIncludingDraws() : getAllApprovedMatches()).find(m => m.id === matchId) || null; }
function reviewPlayers(m){ return (m ? (m.winners || []).concat(m.losers || []) : []).filter(Boolean); }
function canWriteReview(m){ const me = reviewMe(); return reviewAdmin() || (!!me && reviewPlayers(m).includes(me)); }
function canReadFeedbackFor(player){ return reviewAdmin() || reviewMe() === player; }
const reviewFbId = (matchId, player, by) => `${matchId}__${player}__${by}`.replace(/[\/\s]+/g, '_');

// ---- Reading ----------------------------------------------------------------------
async function loadMatchReview(matchId){
  const m = reviewMatch(matchId);
  const entry = { recap: null, feedback: [], loaded: false };
  try {
    const d = await db.collection('matchReviews').doc(matchId).get();
    if(d.exists) entry.recap = d.data();
  } catch(e){ /* no recap readable */ }
  // Only what this reader may see: everything for an Admin; for one of the
  // four, what was written for them and what they wrote.
  const me = reviewMe(), seen = {};
  const take = (snap) => snap.docs.forEach(x => { seen[x.id] = x.data(); });
  try {
    if(reviewAdmin()) take(await db.collection('matchFeedback').where('matchId', '==', matchId).get());
    else if(me && reviewPlayers(m).includes(me)){
      take(await db.collection('matchFeedback').where('matchId', '==', matchId).where('player', '==', me).get());
      take(await db.collection('matchFeedback').where('matchId', '==', matchId).where('by', '==', me).get());
    }
  } catch(e){ /* none readable */ }
  entry.feedback = Object.values(seen).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  entry.loaded = true;
  reviewCache[matchId] = entry;
  return entry;
}

// ---- Writing -----------------------------------------------------------------------
async function saveRecap(matchId, text){
  const m = reviewMatch(matchId), by = reviewAuthor();
  if(!m || !by || !canWriteReview(m)) return { ok: false, message: 'Sign in with your code (or as an Admin) to write a review.' };
  const body = String(text || '').trim().slice(0, REVIEW_MAX);
  const doc = { matchId, players: reviewPlayers(m), text: body, by, at: new Date().toISOString() };
  try { await db.collection('matchReviews').doc(matchId).set(doc); }
  catch(e){ return { ok: false, message: 'Couldn’t save. Publish the latest database rules (docs/PLAYER_CODES.md), then try again.' }; }
  (reviewCache[matchId] = reviewCache[matchId] || { feedback: [], loaded: true }).recap = doc;
  if(body && typeof sendNotice === 'function'){
    const to = doc.players.filter(n => n !== reviewMe());
    if(to.length) sendNotice({ to, title: 'Match review', body: `${by} wrote a review of your game ${reviewMatchLine(m)}.`, tag: `review_${matchId}` });
  }
  return { ok: true };
}

async function saveFeedback(matchId, player, f){
  const m = reviewMatch(matchId), by = reviewAuthor();
  if(!m || !by || !canWriteReview(m) || !reviewPlayers(m).includes(player)) return { ok: false, message: 'Sign in with your code (or as an Admin) to give feedback.' };
  const clip = (s) => String(s || '').trim().slice(0, REVIEW_MAX);
  const tags = (t) => (t || []).filter(x => REVIEW_TAGS.includes(x));
  const doc = { matchId, players: reviewPlayers(m), player, by, at: new Date().toISOString(),
    good: clip(f.good), work: clip(f.work), goodTags: tags(f.goodTags), workTags: tags(f.workTags) };
  if(!doc.good && !doc.work && !doc.goodTags.length && !doc.workTags.length) return { ok: false, message: 'Write something, or pick a focus area.' };
  try { await db.collection('matchFeedback').doc(reviewFbId(matchId, player, by)).set(doc); }
  catch(e){ return { ok: false, message: 'Couldn’t save. Publish the latest database rules (docs/PLAYER_CODES.md), then try again.' }; }
  const entry = reviewCache[matchId] = reviewCache[matchId] || { recap: null, feedback: [], loaded: true };
  entry.feedback = entry.feedback.filter(x => !(x.player === player && x.by === by)).concat([doc]);
  if(player !== reviewMe() && typeof sendNotice === 'function'){
    sendNotice({ to: [player], title: 'Feedback on your game', body: `${by} left you feedback on ${reviewMatchLine(m)}. Only you can see it.`, tag: `fb_${matchId}` });
  }
  return { ok: true };
}

function reviewMatchLine(m){
  const d = typeof fmtFixtureDate === 'function' ? fmtFixtureDate(m.date) : m.date;
  return `${(m.winners || []).join(' & ')} v ${(m.losers || []).join(' & ')} (${d})`;
}

// ---- On a match: the Review section ---------------------------------------------------
function matchReviewSectionHtml(matchId){
  const m = reviewMatch(matchId);
  if(!m || !playerAccountsOn()) return '';
  const entry = reviewCache[matchId];
  if(!entry || !entry.loaded) return `<section class="mr" data-mr="${escapeHtml(matchId)}"><div class="mr-head">Review</div><div class="mr-muted">Loading…</div></section>`;
  const write = canWriteReview(m);
  const ed = reviewEditing && reviewEditing.matchId === matchId ? reviewEditing : null;
  const recap = entry.recap && entry.recap.text ? entry.recap : null;
  const recapHtml = ed && ed.kind === 'recap'
    ? `<div class="mr-form"><label class="mr-label" for="mrRecapText">Recap of the match</label>
        <textarea id="mrRecapText" class="fg-select mr-text" rows="4" maxlength="${REVIEW_MAX}" placeholder="How it went: the turning points, what worked, what didn't.">${escapeHtml(recap ? recap.text : '')}</textarea>
        <div class="mr-form-actions"><button type="button" class="mp-btn-primary mp-btn-accent mr-save-recap">Save recap</button><button type="button" class="preset-btn mr-cancel">Cancel</button></div></div>`
    : recap ? `<div class="mr-recap"><p class="mr-recap-text">${escapeHtml(recap.text)}</p><div class="mr-by">${escapeHtml(recap.by)} · ${escapeHtml(reviewWhen(recap.at))}</div>
        ${write ? '<button type="button" class="rk2-link mr-edit-recap">Edit recap</button>' : ''}</div>`
    : `<div class="mr-muted">No recap yet.</div>${write ? '<button type="button" class="preset-btn mr-edit-recap">Write a recap</button>' : ''}`;
  const people = reviewPlayers(m).map(p => {
    const mine = entry.feedback.filter(f => f.player === p);
    const canSee = canReadFeedbackFor(p) || mine.some(f => f.by === reviewAuthor());
    const notes = mine.filter(f => canReadFeedbackFor(p) || f.by === reviewAuthor()).map(reviewNoteHtml).join('');
    const editing = ed && ed.kind === 'fb' && ed.player === p;
    const own = mine.find(f => f.by === reviewAuthor());
    return `<div class="mr-person">
      <div class="mr-person-head"><span class="mr-person-name">${escapeHtml(p)}${p === reviewMe() ? ' (you)' : ''}</span>
        ${write && !editing ? `<button type="button" class="rk2-link mr-give" data-mr-give="${escapeHtml(p)}">${own ? 'Edit your feedback' : p === reviewMe() ? 'Note to self' : 'Give feedback'}</button>` : ''}</div>
      ${editing ? reviewFeedbackFormHtml(own) : (canSee ? (notes || '<div class="mr-muted">No feedback yet.</div>') : '')}
    </div>`;
  }).join('');
  return `<section class="mr" data-mr="${escapeHtml(matchId)}">
    <div class="mr-head">Review</div>
    ${recapHtml}
    <div class="mr-sub">Feedback for each player <span class="mr-private">private to that player and Admins</span></div>
    ${people}
    <div class="mr-msg" role="status"></div>
  </section>`;
}

function reviewWhen(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function reviewNoteHtml(f){
  const chips = (tags, cls) => (tags || []).map(t => `<span class="mr-chip ${cls}">${escapeHtml(t)}</span>`).join('');
  return `<div class="mr-note">
    ${f.good || (f.goodTags || []).length ? `<div class="mr-note-row"><span class="mr-note-label is-good">Went well</span>${f.good ? `<span class="mr-note-text">${escapeHtml(f.good)}</span>` : ''}${chips(f.goodTags, 'is-good')}</div>` : ''}
    ${f.work || (f.workTags || []).length ? `<div class="mr-note-row"><span class="mr-note-label is-work">To work on</span>${f.work ? `<span class="mr-note-text">${escapeHtml(f.work)}</span>` : ''}${chips(f.workTags, 'is-work')}</div>` : ''}
    <div class="mr-by">${escapeHtml(f.by)} · ${escapeHtml(reviewWhen(f.at))}</div>
  </div>`;
}

function reviewFeedbackFormHtml(own){
  const o = own || {};
  const chips = (kind, chosen) => `<div class="mr-chips" role="group" aria-label="${kind === 'good' ? 'Went well: focus areas' : 'To work on: focus areas'}">${REVIEW_TAGS.map(t => `<button type="button" class="mr-tag${(chosen || []).includes(t) ? ' is-on' : ''}" data-mr-tag="${kind}" data-tag="${escapeHtml(t)}" aria-pressed="${(chosen || []).includes(t)}">${escapeHtml(t)}</button>`).join('')}</div>`;
  return `<div class="mr-form">
    <label class="mr-label" for="mrGood">What went well</label>
    <textarea id="mrGood" class="fg-select mr-text" rows="2" maxlength="${REVIEW_MAX}">${escapeHtml(o.good || '')}</textarea>
    ${chips('good', o.goodTags)}
    <label class="mr-label" for="mrWork">To work on</label>
    <textarea id="mrWork" class="fg-select mr-text" rows="2" maxlength="${REVIEW_MAX}">${escapeHtml(o.work || '')}</textarea>
    ${chips('work', o.workTags)}
    <div class="mr-form-actions"><button type="button" class="mp-btn-primary mp-btn-accent mr-save-fb">Save feedback</button><button type="button" class="preset-btn mr-cancel">Cancel</button></div>
  </div>`;
}

// Draws (or redraws) the section inside `root`, loading it the first time.
function mountMatchReview(root, matchId){
  const host = root.querySelector('.msc-review');
  if(!host) return;
  host.innerHTML = matchReviewSectionHtml(matchId);
  wireMatchReview(root, matchId);
  if(!reviewCache[matchId] || !reviewCache[matchId].loaded){
    loadMatchReview(matchId).then(() => { if(root.querySelector('.msc-review')) mountMatchReview(root, matchId); });
  }
}

function wireMatchReview(root, matchId){
  const sec = root.querySelector(`.mr[data-mr="${CSS.escape(matchId)}"]`);
  if(!sec) return;
  const redraw = () => mountMatchReview(root, matchId);
  const say = (t) => { const m = sec.querySelector('.mr-msg'); if(m) m.textContent = t; };
  sec.querySelectorAll('.mr-edit-recap').forEach(b => { b.onclick = () => { reviewEditing = { matchId, kind: 'recap' }; redraw(); const t = root.querySelector('#mrRecapText'); if(t) t.focus(); }; });
  sec.querySelectorAll('[data-mr-give]').forEach(b => { b.onclick = () => { reviewEditing = { matchId, kind: 'fb', player: b.dataset.mrGive }; redraw(); }; });
  sec.querySelectorAll('.mr-cancel').forEach(b => { b.onclick = () => { reviewEditing = null; redraw(); }; });
  sec.querySelectorAll('[data-mr-tag]').forEach(b => {
    b.onclick = () => { const on = !b.classList.contains('is-on'); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); };
  });
  const saveRecapBtn = sec.querySelector('.mr-save-recap');
  if(saveRecapBtn) saveRecapBtn.onclick = async () => {
    saveRecapBtn.disabled = true;
    const r = await saveRecap(matchId, sec.querySelector('#mrRecapText').value);
    saveRecapBtn.disabled = false;
    if(!r.ok){ say(r.message); return; }
    reviewEditing = null; redraw();
  };
  const saveFbBtn = sec.querySelector('.mr-save-fb');
  if(saveFbBtn) saveFbBtn.onclick = async () => {
    const picked = (kind) => [...sec.querySelectorAll(`[data-mr-tag="${kind}"].is-on`)].map(x => x.dataset.tag);
    saveFbBtn.disabled = true;
    const r = await saveFeedback(matchId, reviewEditing.player, { good: sec.querySelector('#mrGood').value, work: sec.querySelector('#mrWork').value, goodTags: picked('good'), workTags: picked('work') });
    saveFbBtn.disabled = false;
    if(!r.ok){ say(r.message); return; }
    reviewEditing = null; redraw();
  };
}

// ---- On a profile ------------------------------------------------------------------------
// The focus areas named most often, for strengths and for what to work on.
function feedbackFocus(notes){
  const count = (key) => {
    const c = {};
    notes.forEach(n => (n[key] || []).forEach(t => { c[t] = (c[t] || 0) + 1; }));
    return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4);
  };
  return { good: count('goodTags'), work: count('workTags') };
}

async function loadPlayerFeedback(name){
  const out = { reviews: [], feedback: [] };
  try {
    const r = await db.collection('matchReviews').where('players', 'array-contains', name).get();
    out.reviews = r.docs.map(d => d.data()).filter(x => x.text).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  } catch(e){ /* none */ }
  if(canReadFeedbackFor(name)){
    try {
      const f = await db.collection('matchFeedback').where('player', '==', name).get();
      out.feedback = f.docs.map(d => d.data()).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    } catch(e){ /* none readable */ }
  }
  return out;
}

function profileFeedbackHtml(name, data){
  const matchOf = (id) => reviewMatch(id);
  const line = (id) => { const m = matchOf(id); return m ? `${typeof fmtFixtureDate === 'function' ? fmtFixtureDate(m.date) : m.date} · ${escapeHtml((m.winners || []).join(' & '))} v ${escapeHtml((m.losers || []).join(' & '))}` : ''; };
  let html = '';
  if(canReadFeedbackFor(name)){
    const focus = feedbackFocus(data.feedback);
    const chips = (list, cls) => list.map(([t, n]) => `<span class="mr-chip ${cls}">${escapeHtml(t)}${n > 1 ? ` ×${n}` : ''}</span>`).join('');
    html += `<div class="pp-fb">
      <div class="pp-fb-head"><span class="pp-section-label" style="margin:0;">Feedback</span><span class="mr-private">only ${reviewMe() === name ? 'you' : escapeHtml(name)} and Admins</span></div>
      ${data.feedback.length ? `
        ${focus.good.length ? `<div class="pp-fb-focus"><span class="mr-note-label is-good">Strengths</span>${chips(focus.good, 'is-good')}</div>` : ''}
        ${focus.work.length ? `<div class="pp-fb-focus"><span class="mr-note-label is-work">Working on</span>${chips(focus.work, 'is-work')}</div>` : ''}
        <div class="pp-fb-list">${data.feedback.slice(0, 5).map(f => `<button type="button" class="pp-fb-item" data-scorecard="${escapeHtml(f.matchId)}"><span class="pp-fb-game">${line(f.matchId)}</span>${reviewNoteHtml(f)}</button>`).join('')}</div>
        ${data.feedback.length > 5 ? `<div class="mr-muted">${data.feedback.length - 5} more, on their games.</div>` : ''}`
      : `<div class="mr-muted">No feedback yet. It appears here when someone gives ${reviewMe() === name ? 'you' : escapeHtml(name)} feedback on a game.</div>`}
    </div>`;
  }
  if(data.reviews.length){
    html += `<div class="pp-fb">
      <div class="pp-fb-head"><span class="pp-section-label" style="margin:0;">Match reviews</span><span class="mr-muted">${data.reviews.length}</span></div>
      <div class="pp-fb-list">${data.reviews.slice(0, 3).map(r => `<button type="button" class="pp-fb-item" data-scorecard="${escapeHtml(r.matchId)}"><span class="pp-fb-game">${line(r.matchId)}</span><span class="mr-recap-text">${escapeHtml(r.text.length > 180 ? r.text.slice(0, 177) + '…' : r.text)}</span><span class="mr-by">${escapeHtml(r.by)}</span></button>`).join('')}</div>
    </div>`;
  }
  return html;
}

function mountProfileFeedback(name){
  const host = document.getElementById('ppFeedbackHost');
  if(!host || !playerAccountsOn()) return;
  host.innerHTML = '';
  loadPlayerFeedback(name).then(data => {
    const h = document.getElementById('ppFeedbackHost');
    if(!h || h.dataset.player !== name) return;
    const html = profileFeedbackHtml(name, data);
    h.innerHTML = html;
    h.style.display = html ? '' : 'none';
  });
}
