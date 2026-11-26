// ===================== NOTIFICATIONS =====================
// Shaun, 19 Nov: players "receive notifications". Decided: phone
// notifications, Padel Championships first. A signed-in player (or an Admin,
// as their own player) turns them on for this phone; the phone's address is
// kept in `pushSubscriptions` under their name. After any change to the
// games is saved, the app works out who to tell (FixtureNotices) and asks the
// club's server to send it (api/notify.js). An iPhone only allows this for
// the app saved to its Home Screen and opened from there. Declarations only.

const NOTIFY_PUBLIC_KEY = 'BNDX1bn4mSdz5T4Fvh8G3mmFoSa__yXReUeukz9oEBrmixmKKP_LH-0Gg3RVhT7_2amaiNdAF0uUh8OjyjCCwAI';
const PUSH_SUBSCRIPTIONS_COLLECTION = 'pushSubscriptions';

function notificationsOn(){ return playerAccountsOn(); }

// 'ok' | 'unsupported' | 'homescreen' (an iPhone, not opened from the Home Screen) | 'blocked'
function pushCapability(){
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent || '');
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if(ios && !standalone) return 'homescreen';
  if(!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return 'unsupported';
  if(Notification.permission === 'denied') return 'blocked';
  return 'ok';
}

function keyBytes(base64url){
  const pad = '='.repeat((4 - base64url.length % 4) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
async function subscriptionId(endpoint){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(buf)].slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join('');
}

// This phone's current subscription, if notifications are on here.
async function currentPushSubscription(){
  if(pushCapability() !== 'ok') return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch(e){ return null; }
}

// This phone's subscription written under the player's name; true if saved.
async function savePushSubscription(name){
  const sub = await currentPushSubscription();
  if(!sub || !name) return false;
  try {
    const json = sub.toJSON();
    await db.collection(PUSH_SUBSCRIPTIONS_COLLECTION).doc(await subscriptionId(json.endpoint)).set({
      player: name, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth,
      createdAt: new Date().toISOString(), device: String(navigator.userAgent || '').slice(0, 160),
    });
    return true;
  } catch(e){ console.error('saving the subscription failed', e); return false; }
}

// What a test send says, in words.
function testOutcome(r, saved){
  if(!saved) return 'This phone couldn’t be added to the list. Publish the latest database rules (docs/PLAYER_CODES.md), then try again.';
  if(!r) return 'Couldn’t send it just now.';
  if(r.error) return r.error;
  if(r.sent) return 'Sent. It should arrive in a few seconds.';
  if(!r.phones) return 'No phone found for you on the list. Turn notifications off and on again.';
  const p = (r.problems || [])[0];
  if(p && (p.status === 403 || p.status === 401)) return `The push service refused the key (${p.status}). Check VAPID_PRIVATE_KEY in Vercel is exactly the key you were given, then redeploy.`;
  if(r.gone) return 'This phone’s sign-up had expired. Turn notifications off and on again.';
  return `The push service refused it${p && p.status ? ` (${p.status})` : ''}${p && p.detail ? `: ${p.detail}` : ''}.`;
}

// -> { ok, message }
async function enableNotifications(){
  const name = verifiedPlayerName();
  if(!name) return { ok: false, message: 'Sign in with your code first.' };
  const cap = pushCapability();
  if(cap === 'homescreen') return { ok: false, message: 'Add this app to your Home Screen first, then open it from there.' };
  if(cap === 'unsupported') return { ok: false, message: 'This browser can’t show notifications.' };
  if(cap === 'blocked') return { ok: false, message: 'Notifications are blocked for this app in your phone’s Settings.' };
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if(permission !== 'granted') return { ok: false, message: 'Notifications weren’t allowed. You can allow them in your phone’s Settings.' };
    const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(NOTIFY_PUBLIC_KEY) });
    const json = sub.toJSON();
    await db.collection(PUSH_SUBSCRIPTIONS_COLLECTION).doc(await subscriptionId(json.endpoint)).set({
      player: name, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth,
      createdAt: new Date().toISOString(), device: String(navigator.userAgent || '').slice(0, 160),
    });
    if(typeof starterNotifyOn !== 'undefined'){ starterNotifyOn = true; if(typeof redrawStarterHosts === 'function') redrawStarterHosts(); }
    return { ok: true, message: 'Notifications are on for this phone.' };
  } catch(e){
    console.error('turning notifications on failed', e);
    return { ok: false, message: 'Couldn’t turn them on' + (e && e.message ? `: ${e.message}` : '') + '.' };
  }
}

async function disableNotifications(){
  const sub = await currentPushSubscription();
  if(!sub) return { ok: true, message: 'Notifications are off for this phone.' };
  try { await db.collection(PUSH_SUBSCRIPTIONS_COLLECTION).doc(await subscriptionId(sub.endpoint)).delete(); } catch(e){ /* gone already, or rules */ }
  try { await sub.unsubscribe(); } catch(e){ /* best effort */ }
  if(typeof starterNotifyOn !== 'undefined') starterNotifyOn = false;
  return { ok: true, message: 'Notifications are off for this phone.' };
}

// Ask the club's server to tell these players. Never blocks the app.
async function sendNotice(notice){
  try {
    const auth = adminAuthApi();
    const user = auth && auth.currentUser;
    if(!user) return null;
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify(notice),
    });
    const body = await res.json().catch(() => null);
    return body || { error: `The server didn’t answer properly (${res.status}).` };
  } catch(e){ console.error('notify failed', e); return { error: 'Couldn’t reach the server. Check your connection.' }; }
}

// The games as last saved or read here, so the next save can say what changed.
let fixtureNoticeBaseline = null;
function noteFixturesLoaded(requests){ fixtureNoticeBaseline = JSON.parse(JSON.stringify(requests || [])); }
function noteFixturesSaved(requests){
  const before = fixtureNoticeBaseline;
  fixtureNoticeBaseline = JSON.parse(JSON.stringify(requests || []));
  if(!notificationsOn() || !before) return [];
  const actor = verifiedPlayerName() || (currentUserName && currentUserName.trim()) || null;
  const when = (r) => [r.preferredDate ? fmtFixtureDate(r.preferredDate) : '', r.preferredTime || ''].filter(Boolean).join(' ');
  const notices = FixtureNotices.between(before, requests, { when })
    .map(n => ({ ...n, to: n.to.filter(name => name !== actor) }))
    .filter(n => n.to.length);
  notices.forEach(n => { sendNotice({ to: n.to, title: n.title, body: n.body, tag: n.tag }); });
  return notices;
}

// ---- The sheet: on, off, and a test -------------------------------------
async function openNotificationsSheet(){
  let sheet = document.getElementById('notificationsSheet');
  if(!sheet){
    sheet = document.createElement('div');
    sheet.className = 'shell-more-sheet';
    sheet.id = 'notificationsSheet';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if(e.target === sheet) sheet.classList.remove('show'); });
  }
  const draw = async (message) => {
    const name = verifiedPlayerName();
    const cap = pushCapability();
    const on = !!(await currentPushSubscription());
    const steps = cap === 'homescreen'
      ? `<ol class="nt-steps"><li>Tap the <b>Share</b> button in Safari.</li><li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open ${escapeHtml(CLUB.homeScreenTitle || CLUB.name)} from your Home Screen and come back here.</li></ol>` : '';
    const state = !name ? 'Sign in with your code first (Who are you?).'
      : cap === 'homescreen' ? 'On an iPhone, notifications only work for the app saved to your Home Screen.'
      : cap === 'unsupported' ? 'This browser can’t show notifications. Try Safari (iPhone) or Chrome (Android).'
      : cap === 'blocked' ? 'Notifications are blocked for this app. Allow them in your phone’s Settings › Notifications.'
      : on ? `On for this phone, as ${escapeHtml(name)}.` : 'Off for this phone.';
    sheet.innerHTML = `<div class="shell-more-panel nt-panel" role="dialog" aria-label="Notifications">
      <div class="game-sheet-head"><h3>Notifications</h3><button type="button" class="mp-sheet-close nt-close" aria-label="Close">×</button></div>
      <div class="nt-sub">Get a notification when someone asks you to play, when all four are in, when a court is booked, and if a game is cancelled.</div>
      <div class="nt-state">${state}</div>${steps}
      ${name && cap === 'ok' ? (on
        ? `<button type="button" class="preset-btn nt-test">Send me a test</button> <button type="button" class="preset-btn nt-off">Turn off</button>`
        : `<button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent nt-on">Turn on notifications</button>`) : ''}
      <div class="nt-msg" role="status">${escapeHtml(message || '')}</div>
    </div>`;
    sheet.querySelector('.nt-close').onclick = () => sheet.classList.remove('show');
    const onBtn = sheet.querySelector('.nt-on');
    if(onBtn) onBtn.onclick = async () => { onBtn.disabled = true; const r = await enableNotifications(); draw(r.message); };
    const off = sheet.querySelector('.nt-off');
    if(off) off.onclick = async () => { const r = await disableNotifications(); draw(r.message); };
    const test = sheet.querySelector('.nt-test');
    if(test) test.onclick = async () => {
      test.disabled = true;
      // Make sure this phone is on the list first (it may have been turned
      // on before the database rules allowed it to be saved).
      const saved = await savePushSubscription(name);
      const r = await sendNotice({ to: [name], title: 'Test', body: `Notifications work, ${name}.`, tag: 'test' });
      draw(testOutcome(r, saved));
    };
  };
  // A phone turned on before the rules let it be saved is put on the list
  // now -- and the Get started step ticks once it is.
  if(verifiedPlayerName()) savePushSubscription(verifiedPlayerName()).then(ok => {
    if(ok && typeof starterNotifyOn !== 'undefined' && starterNotifyOn !== true){ starterNotifyOn = true; if(typeof redrawStarterHosts === 'function') redrawStarterHosts(); }
  });
  await draw('');
  sheet.classList.add('show');
}
