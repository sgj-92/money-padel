// ===================== ADMIN: ASK CLAUDE =====================
// Shaun, 13 Nov: "ask Claude questions about the data, for admins only.
// Sometimes players ask questions but they're not common enough for there to
// be a separate section to show that data."
//
// A question box in Admin. The question goes to /api/ask (api/ask.js) with
// the signed-in Admin's token; the server checks that token against this
// community's `admins`, reads the record, and has Claude work the answer out
// with code. Follow-ups carry the conversation so far. Nothing is stored.
// Loads before manageScreen.js; declarations only.

let askClaudeLog = [];        // [{ role: 'user' | 'assistant', text, card? }]
let askClaudeBusy = false;
let askClaudeError = '';
let askClaudeDraft = '';

// Saved conversations (Shaun, 13 Nov: "save previous questions"). Every
// conversation is kept, Admins only (firestore.rules: askClaude), so any
// Admin can reopen one on any device, carry on asking, or delete it.
//   askClaude/{id}  { title, turns: [{ role, text, at }], by, createdAt, updatedAt }
const ASK_CLAUDE_COLLECTION = 'askClaude';
const ASK_CLAUDE_MAX_TURNS = 40;
let askClaudeConvId = null;   // the conversation on screen, once saved
let askClaudeSaved = null;    // [{ id, title, by, updatedAt, turns }] newest first; null until read
let askClaudeSaveNote = '';

async function loadAskClaudeSaved(){
  try {
    const snap = await db.collection(ASK_CLAUDE_COLLECTION).get();
    askClaudeSaved = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(c => Array.isArray(c.turns) && c.turns.length)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  } catch(e){
    askClaudeSaved = [];
    askClaudeSaveNote = 'Saved questions couldn’t be read. Publish the latest database rules (firestore.rules) to keep them.';
  }
}

async function saveAskClaudeConversation(){
  if(!db || !askClaudeLog.length) return;
  const now = new Date().toISOString();
  const id = askClaudeConvId || `${now.replace(/[^0-9]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
  const existing = (askClaudeSaved || []).find(c => c.id === id);
  const doc = {
    title: askClaudeLog[0].text.slice(0, 200),
    turns: askClaudeLog.slice(-ASK_CLAUDE_MAX_TURNS).map(t => ({ role: t.role, text: t.text, at: t.at || now, ...(t.card ? { card: t.card } : {}) })),
    by: (existing && existing.by) || (signedInAdmin && (signedInAdmin.name || signedInAdmin.email)) || '',
    createdAt: (existing && existing.createdAt) || now,
    updatedAt: now,
  };
  try {
    await db.collection(ASK_CLAUDE_COLLECTION).doc(id).set(doc);
    askClaudeConvId = id;
    askClaudeSaved = [{ id, ...doc }].concat((askClaudeSaved || []).filter(c => c.id !== id));
    askClaudeSaveNote = '';
  } catch(e){
    askClaudeSaveNote = 'This answer wasn’t saved. Publish the latest database rules (firestore.rules) to keep questions.';
  }
}

function askClaudeWhen(iso){
  const d = new Date(iso);
  if(isNaN(d)) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function askClaudeSavedHtml(){
  if(askClaudeSaved === null) return skeletonHtml('Reading saved questions…', 3);
  const list = askClaudeSaved.filter(c => c.id !== askClaudeConvId);
  if(!list.length) return '';
  return `<div class="ask-saved"><div class="fg-label" style="margin:12px 0 6px;">Previous questions · ${list.length}</div>
    ${list.map(c => `<div class="ask-saved-row">
      <button type="button" class="ask-saved-open" data-ask-open="${escapeHtml(c.id)}">
        <span class="ask-saved-title">${escapeHtml(c.title || '')}</span>
        <span class="ask-saved-meta">${escapeHtml([askClaudeWhen(c.updatedAt), c.by, c.turns.length > 2 ? `${c.turns.length / 2 | 0} questions` : ''].filter(Boolean).join(' · '))}</span>
      </button>
      <button type="button" class="ask-saved-del" data-ask-del="${escapeHtml(c.id)}" aria-label="Delete “${escapeHtml(c.title || '')}”">✕</button>
    </div>`).join('')}</div>`;
}

function askClaudeAnswerHtml(text){
  // Plain text from Claude; **bold** is the only mark kept.
  return escapeHtml(text).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
}

function buildAskClaudeHtml(){
  if(!signedInAdmin){
    return `<div class="section-sub">Sign in with your own Admin account to ask Claude. The shared Admin password can’t be used for this.</div>`;
  }
  const turns = askClaudeLog.map((t, i) => t.role === 'user'
    ? `<div class="ask-q">${escapeHtml(t.text)}</div>`
    : `<div class="ask-a"><div class="ask-a-text">${askClaudeAnswerHtml(t.text)}</div>
        <div class="ask-a-actions"><button type="button" class="preset-btn ask-copy" data-ask-copy="${i}">Copy</button>
        <button type="button" class="preset-btn ask-pic" data-ask-pic="${i}">🖼 Share picture</button></div></div>`).join('');
  return `<div class="section-sub" style="margin-top:0;">Ask anything the record can answer: results, head to heads, streaks, scores, ratings, tiers. Claude works it out from ${escapeHtml(CLUB.name)}'s matches and ratings, with the sums done properly. An answer takes up to a minute. Each question costs a few pence.</div>
    <div class="ask-log" id="askClaudeLog">${turns}</div>
    ${askClaudeBusy ? `<div class="ask-busy" role="status">Claude is working it out…</div>` : ''}
    ${askClaudeError ? `<div class="section-sub" style="color:var(--red);" role="alert">${escapeHtml(askClaudeError)}</div>` : ''}
    ${askClaudeSaveNote ? `<div class="section-sub" style="color:var(--red);">${escapeHtml(askClaudeSaveNote)}</div>` : ''}
    <div class="fg-row"><textarea id="askClaudeQ" class="fg-select" rows="3" maxlength="2000" placeholder="${askClaudeLog.length ? 'Ask a follow-up…' : 'e.g. Who has won the most 6-0 sets this year?'}"${askClaudeBusy ? ' disabled' : ''}>${escapeHtml(askClaudeDraft)}</textarea></div>
    <div class="difficulty-row">
      <button class="tab-btn active" id="askClaudeGo" style="flex:2;"${askClaudeBusy ? ' disabled' : ''}>${askClaudeLog.length ? 'Ask' : 'Ask Claude'}</button>
      ${askClaudeLog.length ? `<button class="preset-btn" id="askClaudeNew" style="flex:1;"${askClaudeBusy ? ' disabled' : ''}>New question</button>` : ''}
    </div>
    ${askClaudeSavedHtml()}`;
}

function redrawAskClaude(){
  const body = document.querySelector('[data-acc="ask"] .admin-acc-body');
  if(!body) return;
  body.innerHTML = buildAskClaudeHtml();
  wireAskClaude();
}

async function sendAskClaude(){
  const q = (document.getElementById('askClaudeQ') || {}).value || '';
  const question = q.trim();
  if(!question || askClaudeBusy) return;
  askClaudeDraft = question; askClaudeBusy = true; askClaudeError = '';
  redrawAskClaude();
  try {
    const auth = adminAuthApi();
    const user = auth && auth.currentUser;
    if(!user) throw new Error('Sign in with your Admin account first.');
    const token = await user.getIdToken();
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question, history: askClaudeLog.map(t => ({ role: t.role, text: t.text })) }),
    });
    let body = {};
    try { body = await res.json(); } catch(e){ /* not JSON */ }
    if(!res.ok) throw new Error(body.error || `Claude couldn’t answer (${res.status}).`);
    const at = new Date().toISOString();
    askClaudeLog = askClaudeLog.concat([{ role: 'user', text: question, at }, { role: 'assistant', text: String(body.answer || ''), at, ...(body.card ? { card: body.card } : {}) }]);
    askClaudeDraft = '';
    await saveAskClaudeConversation();
  } catch(e){
    askClaudeError = (e && e.message) || 'Claude couldn’t answer just now.';
  }
  askClaudeBusy = false;
  redrawAskClaude();
  const log = document.getElementById('askClaudeLog');
  const last = log && log.lastElementChild;
  if(last && last.scrollIntoView) last.scrollIntoView({ block: 'nearest' });
}

// ---------- an answer as a picture (Shaun, 16 Nov) ----------
// "images with summaries would be nice too." Claude sends a summary card with
// each answer (lib/askClaude/ask.js); an answer saved before that, or one
// without a card, is drawn from its own text: the first sentence as the
// headline, its "- " points as the figures.
function askCardFromText(question, text){
  const lines = String(text || '').replace(/\*\*([^*\n]+)\*\*/g, '$1').split('\n').map(l => l.trim()).filter(Boolean);
  const isPoint = (l) => /^[-•*]\s+/.test(l);
  const prose = lines.filter(l => !isPoint(l));
  let items = lines.filter(isPoint).map(l => l.replace(/^[-•*]\s+/, '')).slice(0, 8).map(t => {
    const m = t.match(/^([^:]{1,30}):\s*(.+)$/);
    return m ? { icon: '', title: m[1], text: m[2] } : { icon: '', title: '', text: t };
  });
  if(!items.length) items = prose.slice(1, 5).map(t => ({ icon: '', title: '', text: t }));
  const q = String(question || '').trim();
  return { title: q.length > 60 ? `${q.slice(0, 57)}…` : q, subtitle: '', headline: prose[0] || '', items };
}
function askCardFor(i){
  const t = askClaudeLog[i];
  if(!t) return null;
  if(t.card) return t.card;
  const q = askClaudeLog.slice(0, i).reverse().find(x => x.role === 'user');
  return askCardFromText(q && q.text, t.text);
}
// Made before the tap, so a phone opens its share sheet straight away.
const askPicReady = {};   // index -> { key, file, title } | { key, pending }
async function buildAskPicture(card){
  const brand = await CardPainter.loadImage(CLUB.logo);
  const cv = CardPainter.summary({ ...card, footer: `${CLUB.name} · worked out from the match record` }, { brand });
  const slug = (card.title || 'answer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'answer';
  return { file: await CardPainter.toFile(cv, `${CLUB.fileSlug}-${slug}.png`), title: `${CLUB.name} — ${card.title}` };
}
function prepareAskPicture(i){
  const card = askCardFor(i);
  if(!card) return;
  const key = JSON.stringify(card);
  if(askPicReady[i] && askPicReady[i].key === key) return;
  askPicReady[i] = { key, pending: true };
  buildAskPicture(card).then(made => { if(askPicReady[i] && askPicReady[i].key === key) askPicReady[i] = { key, ...made }; },
    () => { if(askPicReady[i] && askPicReady[i].key === key) delete askPicReady[i]; });
}
async function shareAskPicture(i, btn){
  const card = askCardFor(i);
  if(!card) return;
  const key = JSON.stringify(card);
  const say = (t) => { btn.textContent = t; setTimeout(() => { btn.textContent = '🖼 Share picture'; }, 2500); };
  try {
    let made = askPicReady[i] && askPicReady[i].key === key && askPicReady[i].file ? askPicReady[i] : null;
    if(!made){ btn.disabled = true; made = { key, ...await buildAskPicture(card) }; askPicReady[i] = made; btn.disabled = false; }
    const outcome = await CardPainter.share([made.file], { title: made.title });
    if(outcome === 'shared') say('Shared ✓');
    else if(outcome === 'saved') say('Saved ✓');
    else if(outcome === 'ready') say('Ready: tap again');
  } catch(e){ btn.disabled = false; say('Couldn’t make it'); }
}

function wireAskClaude(){
  const go = document.getElementById('askClaudeGo');
  if(go) go.onclick = sendAskClaude;
  const box = document.getElementById('askClaudeQ');
  if(box) box.oninput = () => { askClaudeDraft = box.value; };
  const fresh = document.getElementById('askClaudeNew');
  if(fresh) fresh.onclick = () => { askClaudeLog = []; askClaudeConvId = null; askClaudeError = ''; askClaudeDraft = ''; redrawAskClaude(); };
  document.querySelectorAll('[data-ask-open]').forEach(b => {
    b.onclick = () => {
      const c = (askClaudeSaved || []).find(x => x.id === b.dataset.askOpen);
      if(!c || askClaudeBusy) return;
      askClaudeLog = c.turns.map(t => ({ role: t.role, text: t.text, at: t.at, ...(t.card ? { card: t.card } : {}) }));
      askClaudeConvId = c.id; askClaudeError = ''; askClaudeDraft = '';
      redrawAskClaude();
      const log = document.getElementById('askClaudeLog');
      if(log && log.scrollIntoView) log.scrollIntoView({ block: 'start' });
    };
  });
  document.querySelectorAll('[data-ask-del]').forEach(b => {
    b.onclick = async () => {
      const id = b.dataset.askDel;
      const c = (askClaudeSaved || []).find(x => x.id === id);
      if(!c || !await confirmSheet(`Delete “${c.title}”? This can’t be undone.`, { ok: 'Delete', danger: true })) return;
      // Gone at once; put back if the database says no.
      const before = askClaudeSaved;
      askClaudeSaved = askClaudeSaved.filter(x => x.id !== id);
      redrawAskClaude();
      try { await db.collection(ASK_CLAUDE_COLLECTION).doc(id).delete(); }
      catch(e){ askClaudeSaved = before; askClaudeSaveNote = 'Delete failed: ' + e.message; redrawAskClaude(); }
    };
  });
  // The saved list is read when the section is first shown.
  if(signedInAdmin && askClaudeSaved === null && !wireAskClaude.loading && document.querySelector('[data-acc="ask"] .admin-acc-body')){
    wireAskClaude.loading = true;
    loadAskClaudeSaved().then(() => { wireAskClaude.loading = false; redrawAskClaude(); });
  }
  Object.keys(askPicReady).forEach(k => { if(!(askClaudeLog[k] && askClaudeLog[k].role === 'assistant')) delete askPicReady[k]; });
  document.querySelectorAll('[data-ask-pic]').forEach(b => {
    const i = Number(b.dataset.askPic);
    prepareAskPicture(i);
    b.onclick = () => shareAskPicture(i, b);
  });
  document.querySelectorAll('[data-ask-copy]').forEach(b => {
    b.onclick = () => {
      const t = askClaudeLog[Number(b.dataset.askCopy)];
      if(!t || !navigator.clipboard) return;
      navigator.clipboard.writeText(t.text.replace(/\*\*([^*\n]+)\*\*/g, '*$1*')).then(() => {
        b.textContent = 'Copied ✓';
        setTimeout(() => { b.textContent = 'Copy'; }, 2000);
      }, () => {});
    };
  });
}
