// ===================== MESSAGES =====================
// Shaun, 25 Nov: "I want to set up messaging between players". Decided
// (AskUserQuestion): a chat on every game for its four players AND one-to-one
// messages between any two; readable ONLY by the players in a conversation --
// Admins see a game chat only if they are one of its four (firestore.rules,
// `threads`). Padel Championships (player codes): a player signs in with their
// code to message; an Admin messages as their own player.
//
//   threads/{id}                 { kind: 'game'|'direct', members: [names],
//                                  gameId?, lastAt, lastText, lastBy }
//   threads/{id}/messages/{auto} { by, text, at }
//
// The header's speech-bubble opens Messages (a dot while something is
// unread); a game's sheet has Chat; a tapped player's card has Message.
// What has been read is kept on this phone. Each message sends a
// notification to the others (sendNotice). Declarations only;
// messagesInstall() wires it.

const MESSAGE_MAX = 1000;
let messagesInbox = [];          // [{ id, ...thread }], newest first
let messagesInboxStop = null;    // the inbox listener
let messagesThreadStop = null;   // the open conversation's listener
let messagesOpen = null;         // { id, kind, members, gameId, title }

function messagesOn(){ return typeof playerAccountsOn === 'function' && playerAccountsOn(); }
function messagesMe(){ return typeof verifiedPlayerName === 'function' ? verifiedPlayerName() : null; }

// ---- Ids ----------------------------------------------------------------------
// A short, stable hash, so a game chat belongs to its four as they are now: if
// a seat changes, the new four get a conversation of their own.
function messagesHash(s){
  let h = 5381;
  for(let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const messagesSafe = (s) => String(s).replace(/[\/\s]+/g, '_');
function directThreadId(a, b){ return 'd_' + [a, b].map(messagesSafe).sort().join('~'); }
function gameThreadId(req){
  const members = (req.players || []).filter(Boolean).slice().sort();
  return `g_${messagesSafe(req.id)}_${messagesHash(members.join('|'))}`;
}

// ---- Reading what's been read -------------------------------------------------
function messagesSeenKey(id){ return `msgSeen:${CLUB.id || CLUB.name}:${messagesMe()}:${id}`; }
function messagesSeen(id){ try { return localStorage.getItem(messagesSeenKey(id)) || ''; } catch(e){ return ''; } }
function markMessagesSeen(id, at){ try { localStorage.setItem(messagesSeenKey(id), at || new Date().toISOString()); } catch(e){ /* not kept */ } }
function threadUnread(t){ return !!t.lastAt && t.lastBy !== messagesMe() && t.lastAt > messagesSeen(t.id); }
function messagesUnreadCount(){ return messagesInbox.filter(threadUnread).length; }

// ---- Storage --------------------------------------------------------------------
// One message: the conversation first (so its members are known to the
// rules), then the message, then a notification to the others.
async function sendChatMessage(thread, text){
  const me = messagesMe();
  const body = String(text || '').trim().slice(0, MESSAGE_MAX);
  if(!me) return { ok: false, message: 'Sign in with your code to send messages.' };
  if(!body) return { ok: false, message: '' };
  const at = new Date().toISOString();
  try {
    const ref = db.collection('threads').doc(thread.id);
    await ref.set({ kind: thread.kind, members: thread.members, ...(thread.gameId ? { gameId: thread.gameId } : {}),
      lastAt: at, lastText: body.slice(0, 120), lastBy: me }, { merge: true });
    await ref.collection('messages').add({ by: me, text: body, at });
  } catch(e){
    console.error('sending the message failed', e);
    return { ok: false, message: 'Couldn’t send. Publish the latest database rules (docs/PLAYER_CODES.md), then try again.' };
  }
  markMessagesSeen(thread.id, at);
  const to = thread.members.filter(n => n !== me);
  if(to.length && typeof sendNotice === 'function'){
    sendNotice({ to, title: thread.kind === 'game' ? `${me} · game chat` : me, body: body.slice(0, 140), tag: `msg_${thread.id}` });
  }
  return { ok: true };
}

function watchInbox(){
  const me = messagesMe();
  if(messagesInboxStop){ messagesInboxStop(); messagesInboxStop = null; }
  messagesInbox = [];
  if(!me || !messagesOn() || typeof db === 'undefined' || !db) return;
  try {
    messagesInboxStop = db.collection('threads').where('members', 'array-contains', me).onSnapshot((snap) => {
      messagesInbox = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')));
      syncMessagesBadge();
      const sheet = document.getElementById('messagesSheet');
      if(sheet && sheet.classList.contains('show') && !messagesOpen) renderInbox();
    }, (e) => { console.error('reading messages failed', e); });
  } catch(e){ console.error('reading messages failed', e); }
}

// ---- The header button -----------------------------------------------------------
function syncMessagesBadge(){
  const btn = document.getElementById('shellMessagesBtn');
  if(!btn) return;
  btn.style.display = messagesOn() ? '' : 'none';
  const n = messagesUnreadCount();
  btn.classList.toggle('has-unread', n > 0);
  btn.setAttribute('aria-label', n ? `Messages, ${n} unread` : 'Messages');
}

// ---- The sheet: the inbox, a conversation, a new message ------------------------
function messagesSheet(){
  let sheet = document.getElementById('messagesSheet');
  if(!sheet){
    sheet = document.createElement('div');
    sheet.className = 'shell-more-sheet';
    sheet.id = 'messagesSheet';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if(e.target === sheet) closeMessages(); });
  }
  return sheet;
}
function closeMessages(){
  if(messagesThreadStop){ messagesThreadStop(); messagesThreadStop = null; }
  messagesOpen = null;
  messagesSheet().classList.remove('show');
}

function openMessages(){
  messagesOpen = null;
  if(messagesThreadStop){ messagesThreadStop(); messagesThreadStop = null; }
  renderInbox();
  messagesSheet().classList.add('show');
}

// A conversation's name, from where the reader stands.
function threadTitle(t){
  const me = messagesMe();
  if(t.kind === 'game'){
    const req = (typeof gameRequestsState !== 'undefined' ? gameRequestsState : []).find(r => r && r.id === t.gameId);
    if(req && typeof playTeamsText === 'function') return playTeamsText(req, me);
    return (t.members || []).join(', ');
  }
  return (t.members || []).filter(n => n !== me).join(', ') || me;
}
function messagesWhen(iso){
  if(!iso) return '';
  const d = new Date(iso), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function renderInbox(){
  const sheet = messagesSheet(), me = messagesMe();
  const head = `<div class="game-sheet-head"><h3>Messages</h3><button type="button" class="mp-sheet-close msg-close" aria-label="Close">×</button></div>`;
  if(!me){
    sheet.innerHTML = `<div class="shell-more-panel msg-panel" role="dialog" aria-label="Messages">${head}
      <div class="msg-empty">Sign in with your code to message other players. Only the players in a conversation can read it.</div></div>`;
  } else {
    const rows = messagesInbox.map(t => `<button type="button" class="msg-row${threadUnread(t) ? ' is-unread' : ''}" data-msg-thread="${escapeHtml(t.id)}">
        <span class="msg-avatar" aria-hidden="true">${t.kind === 'game' ? '🎾' : escapeHtml(threadTitle(t).slice(0, 1))}</span>
        <span class="msg-row-main"><span class="msg-row-title">${escapeHtml(threadTitle(t))}</span>
          <span class="msg-row-last">${t.lastBy === me ? 'You: ' : t.kind === 'game' && t.lastBy ? `${escapeHtml(t.lastBy)}: ` : ''}${escapeHtml(t.lastText || '')}</span></span>
        <span class="msg-row-when">${escapeHtml(messagesWhen(t.lastAt))}</span>
        ${threadUnread(t) ? '<span class="msg-dot" aria-label="Unread"></span>' : ''}
      </button>`).join('');
    sheet.innerHTML = `<div class="shell-more-panel msg-panel" role="dialog" aria-label="Messages">${head}
      <button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent msg-new">New message</button>
      <div class="msg-list">${rows || '<div class="msg-empty">No messages yet. Start one, or open a game’s chat from Play.</div>'}</div>
      <div class="msg-private">Only the players in a conversation can read it.</div></div>`;
  }
  sheet.querySelector('.msg-close').onclick = closeMessages;
  const nw = sheet.querySelector('.msg-new');
  if(nw) nw.onclick = () => renderNewMessage('');
  sheet.querySelectorAll('[data-msg-thread]').forEach(b => {
    b.onclick = () => { const t = messagesInbox.find(x => x.id === b.dataset.msgThread); if(t) openThread({ id: t.id, kind: t.kind, members: t.members, gameId: t.gameId }); };
  });
}

function renderNewMessage(filter){
  const sheet = messagesSheet(), me = messagesMe();
  const names = entryPlayerNames().filter(n => n !== me && (!filter || n.toLowerCase().includes(filter.toLowerCase())));
  sheet.innerHTML = `<div class="shell-more-panel msg-panel" role="dialog" aria-label="New message">
    <div class="game-sheet-head"><button type="button" class="msg-back" aria-label="Back">‹</button><h3>New message</h3><button type="button" class="mp-sheet-close msg-close" aria-label="Close">×</button></div>
    <input type="search" class="fg-select msg-search" placeholder="Find a player" value="${escapeHtml(filter)}" aria-label="Find a player">
    <div class="msg-people">${names.map(n => `<button type="button" class="msg-person" data-msg-to="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join('') || '<div class="msg-empty">Nobody by that name.</div>'}</div>
  </div>`;
  sheet.querySelector('.msg-close').onclick = closeMessages;
  sheet.querySelector('.msg-back').onclick = () => renderInbox();
  const search = sheet.querySelector('.msg-search');
  search.oninput = () => { const v = search.value; renderNewMessage(v); const s = messagesSheet().querySelector('.msg-search'); s.focus(); s.setSelectionRange(v.length, v.length); };
  sheet.querySelectorAll('[data-msg-to]').forEach(b => { b.onclick = () => openDirectMessage(b.dataset.msgTo); });
}

// ---- A conversation ----------------------------------------------------------------
function openDirectMessage(name){
  const me = messagesMe();
  if(!me){ openMessages(); return; }
  openThread({ id: directThreadId(me, name), kind: 'direct', members: [me, name].sort() });
}
function openGameChat(req){
  const me = messagesMe();
  if(!me){ openMessages(); return; }
  const members = (req.players || []).filter(Boolean);
  openThread({ id: gameThreadId(req), kind: 'game', members, gameId: req.id });
}

function openThread(t){
  if(messagesThreadStop){ messagesThreadStop(); messagesThreadStop = null; }
  messagesOpen = { ...t, messages: [], loaded: false };
  renderThread();
  messagesSheet().classList.add('show');
  try {
    messagesThreadStop = db.collection('threads').doc(t.id).collection('messages').orderBy('at').limitToLast(200).onSnapshot((snap) => {
      if(!messagesOpen || messagesOpen.id !== t.id) return;
      messagesOpen.messages = snap.docs.map(d => d.data());
      messagesOpen.loaded = true;
      const last = messagesOpen.messages[messagesOpen.messages.length - 1];
      if(last) markMessagesSeen(t.id, last.at);
      renderThreadMessages();
      syncMessagesBadge();
    }, () => { if(messagesOpen) { messagesOpen.loaded = true; renderThreadMessages(); } });
  } catch(e){ messagesOpen.loaded = true; }
}

function renderThread(){
  const t = messagesOpen, sheet = messagesSheet();
  const title = threadTitle(t);
  sheet.innerHTML = `<div class="shell-more-panel msg-panel msg-thread" role="dialog" aria-label="${escapeHtml(title)}">
    <div class="game-sheet-head"><button type="button" class="msg-back" aria-label="Back to messages">‹</button>
      <h3 class="msg-thread-title">${escapeHtml(title)}</h3><button type="button" class="mp-sheet-close msg-close" aria-label="Close">×</button></div>
    ${t.kind === 'game' ? `<div class="msg-thread-sub">Game chat · ${escapeHtml(t.members.join(', '))}</div>` : ''}
    <div class="msg-bubbles" aria-live="polite"></div>
    <form class="msg-compose">
      <textarea class="fg-select msg-input" rows="1" maxlength="${MESSAGE_MAX}" placeholder="Message" aria-label="Message"></textarea>
      <button type="submit" class="mp-btn-primary mp-btn-accent msg-send" aria-label="Send">Send</button>
    </form>
    <div class="msg-error" role="status"></div>
  </div>`;
  sheet.querySelector('.msg-close').onclick = closeMessages;
  sheet.querySelector('.msg-back').onclick = () => openMessages();
  const form = sheet.querySelector('.msg-compose'), input = sheet.querySelector('.msg-input');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value;
    if(!text.trim()) return;
    input.value = '';
    // Shown at once; the conversation's listener brings it back for real.
    messagesOpen.messages = messagesOpen.messages.concat([{ by: messagesMe(), text: text.trim(), at: new Date().toISOString(), pending: true }]);
    renderThreadMessages();
    const r = await sendChatMessage(t, text);
    if(!r.ok){
      messagesOpen.messages = messagesOpen.messages.filter(m => !m.pending);
      input.value = text;
      renderThreadMessages();
      sheet.querySelector('.msg-error').textContent = r.message;
    }
  };
  renderThreadMessages();
}

function renderThreadMessages(){
  const t = messagesOpen;
  const box = messagesSheet().querySelector('.msg-bubbles');
  if(!t || !box) return;
  const me = messagesMe();
  box.innerHTML = t.messages.length ? t.messages.map((m, i) => {
    const mine = m.by === me, prev = t.messages[i - 1];
    const showName = !mine && t.kind === 'game' && (!prev || prev.by !== m.by);
    return `<div class="msg-bubble${mine ? ' is-mine' : ''}${m.pending ? ' is-pending' : ''}">
      ${showName ? `<span class="msg-by">${escapeHtml(m.by)}</span>` : ''}
      <span class="msg-text">${escapeHtml(m.text)}</span>
      <span class="msg-at">${escapeHtml(messagesWhen(m.at))}</span></div>`;
  }).join('') : `<div class="msg-empty">${t.loaded ? 'No messages yet. Say hello.' : 'Loading…'}</div>`;
  box.scrollTop = box.scrollHeight;
}

// The inbox follows whoever this phone speaks for (a code sign-in, a switch).
let messagesWatchingAs = null;
function ensureMessagesWatch(){
  const me = messagesOn() ? messagesMe() : null;
  if(me === messagesWatchingAs) return;
  messagesWatchingAs = me;
  watchInbox();
  syncMessagesBadge();
}

// ---- Wiring ------------------------------------------------------------------------
let messagesInstalled = false;
function messagesInstall(){
  if(messagesInstalled) return;
  messagesInstalled = true;
  const header = document.querySelector('.shell-header');
  const capture = document.getElementById('shellCaptureBtn');
  if(header && !document.getElementById('shellMessagesBtn')){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shell-capture-btn shell-messages-btn';
    btn.id = 'shellMessagesBtn';
    btn.setAttribute('aria-label', 'Messages');
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg><span class="msg-badge" aria-hidden="true"></span>`;
    btn.onclick = () => { ensureMessagesWatch(); openMessages(); };
    if(capture) header.insertBefore(btn, capture); else header.appendChild(btn);
  }
  syncMessagesBadge();
}
