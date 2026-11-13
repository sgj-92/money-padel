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

let askClaudeLog = [];        // [{ role: 'user' | 'assistant', text }]
let askClaudeBusy = false;
let askClaudeError = '';
let askClaudeDraft = '';

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
        <button type="button" class="preset-btn ask-copy" data-ask-copy="${i}">Copy</button></div>`).join('');
  return `<div class="section-sub" style="margin-top:0;">Ask anything the record can answer: results, head to heads, streaks, scores, ratings, tiers. Claude works it out from ${escapeHtml(CLUB.name)}'s matches and ratings, with the sums done properly. An answer takes up to a minute. Each question costs a few pence.</div>
    <div class="ask-log" id="askClaudeLog">${turns}</div>
    ${askClaudeBusy ? `<div class="ask-busy" role="status">Claude is working it out…</div>` : ''}
    ${askClaudeError ? `<div class="section-sub" style="color:var(--red);" role="alert">${escapeHtml(askClaudeError)}</div>` : ''}
    <div class="fg-row"><textarea id="askClaudeQ" class="fg-select" rows="3" maxlength="2000" placeholder="${askClaudeLog.length ? 'Ask a follow-up…' : 'e.g. Who has won the most 6-0 sets this year?'}"${askClaudeBusy ? ' disabled' : ''}>${escapeHtml(askClaudeDraft)}</textarea></div>
    <div class="difficulty-row">
      <button class="tab-btn active" id="askClaudeGo" style="flex:2;"${askClaudeBusy ? ' disabled' : ''}>${askClaudeLog.length ? 'Ask' : 'Ask Claude'}</button>
      ${askClaudeLog.length ? `<button class="preset-btn" id="askClaudeNew" style="flex:1;"${askClaudeBusy ? ' disabled' : ''}>New question</button>` : ''}
    </div>`;
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
      body: JSON.stringify({ question, history: askClaudeLog }),
    });
    let body = {};
    try { body = await res.json(); } catch(e){ /* not JSON */ }
    if(!res.ok) throw new Error(body.error || `Claude couldn’t answer (${res.status}).`);
    askClaudeLog = askClaudeLog.concat([{ role: 'user', text: question }, { role: 'assistant', text: String(body.answer || '') }]);
    askClaudeDraft = '';
  } catch(e){
    askClaudeError = (e && e.message) || 'Claude couldn’t answer just now.';
  }
  askClaudeBusy = false;
  redrawAskClaude();
  const log = document.getElementById('askClaudeLog');
  const last = log && log.lastElementChild;
  if(last && last.scrollIntoView) last.scrollIntoView({ block: 'nearest' });
}

function wireAskClaude(){
  const go = document.getElementById('askClaudeGo');
  if(go) go.onclick = sendAskClaude;
  const box = document.getElementById('askClaudeQ');
  if(box) box.oninput = () => { askClaudeDraft = box.value; };
  const fresh = document.getElementById('askClaudeNew');
  if(fresh) fresh.onclick = () => { askClaudeLog = []; askClaudeError = ''; askClaudeDraft = ''; redrawAskClaude(); };
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
