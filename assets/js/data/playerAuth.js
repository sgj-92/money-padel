// ===================== DATA: PLAYER CODES =====================
// Shaun, 19 Nov: "accounts for players so they can put their schedule for
// when they can play, receive notifications and request games ... not full
// accounts with email address and passwords, but perhaps a unique code they
// enter when clicking on their name. Then they can stay saved on their
// device." Decided: a personal code; Padel Championships first.
//
// A code IS a sign-in: each player has an ordinary account in the
// community's own Firebase project (Authentication, email + password -- the
// provider the Admin accounts already use). Its email is made up and is not a
// mailbox; its password is the player's code. The player never sees either:
// they tap their name, type their code once, and Firebase keeps them signed
// in on that device.
//
//   code      KZ7P-42QM  (8 letters/digits from an Admin, no look-alikes), or
//             6 digits the player chose instead (Shaun, 19 Nov)
//   email     p<random>@<PLAYER_EMAIL_DOMAIN>
//
//   playerLogins/{player}   { email, own, changedAt }       anyone may get; Admin writes;
//                                                           the player may mark `own`
//   playerAccounts/{uid}    { player: 'Kaz', createdAt, by } self + Admin read; Admin write
//   playerCodes/{player}    { code, uid, email, createdAt }  Admin only (to re-send it)
//
// Which player an account is, is said ONLY by the Admin-written entry in
// playerAccounts; the login entry only says which account to try.
//
// A reset makes a new account and moves the entry to it; the old code's
// account is left with no entry, so it can sign in to nothing. The database
// rules (firestore.rules) are the security; the app only says who is who.
//
// Loads after adminAuth.js (it shares Firebase Authentication); declarations only.

const PLAYER_ACCOUNTS_COLLECTION = 'playerAccounts';
const PLAYER_CODES_COLLECTION = 'playerCodes';
const PLAYER_LOGINS_COLLECTION = 'playerLogins';
const PLAYER_EMAIL_DOMAIN = 'players.sgj.luxe';
// No 0/O, 1/I/L, 5/S, 2/Z: read off a phone, typed into a phone.
const PLAYER_CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXY346789';

// The player signed in on this device with a code, or null. { uid, name }
let signedInPlayer = null;

function playerAccountsOn(){ return !!CLUB.playerAccounts; }

// "kz7p 42qm", "KZ7P-42QM" and "kz7p42qm" are the same code.
function normalisePlayerCode(raw){
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function formatPlayerCode(code){
  const c = normalisePlayerCode(code);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}
function makePlayerLoginEmail(){
  const bytes = new Uint8Array(10);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return `p${[...bytes].map(b => (b % 36).toString(36)).join('')}@${PLAYER_EMAIL_DOMAIN}`;
}
// A chosen code: 6 digits, and not one anybody would guess first.
function ownCodeProblem(pin){
  if(!/^\d{6}$/.test(pin)) return 'Your own code is 6 digits.';
  if(/^(\d)\1{5}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'Too easy to guess — choose 6 digits that aren’t a run or all the same.';
  return null;
}
function makePlayerCode(){
  const bytes = new Uint8Array(8);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return [...bytes].map(b => PLAYER_CODE_ALPHABET[b % PLAYER_CODE_ALPHABET.length]).join('');
}

// Which player this account is, from the Admin-written entry; null if none.
async function playerEntryFor(user){
  if(!user || !db) return null;
  try {
    const doc = await db.collection(PLAYER_ACCOUNTS_COLLECTION).doc(user.uid).get();
    if(!doc.exists) return null;
    const d = doc.data() || {};
    return d.player ? { uid: user.uid, name: d.player } : null;
  } catch(e){
    console.error('reading the player account failed', e);
    return null;
  }
}

// Start-up: the player still signed in on this device, if any. An Admin's
// own account is never a player account (signedInAdmin covers it).
async function loadSignedInPlayer(){
  if(!playerAccountsOn()) return null;
  const user = await restoredUser();
  if(!user || !String(user.email || '').endsWith('@' + PLAYER_EMAIL_DOMAIN)) return null;
  return playerEntryFor(user);
}

// The name this device speaks for, proven: a signed-in player, or an Admin's
// own player (admins/{uid}.name). null when nobody is proven.
function verifiedPlayerName(){
  if(signedInPlayer) return signedInPlayer.name;
  if(signedInAdmin && signedInAdmin.name && entryPlayerNames().includes(signedInAdmin.name)) return signedInAdmin.name;
  return null;
}

// Which account a player signs in to; null if they have no code yet.
async function playerLoginFor(name){
  try {
    const doc = await db.collection(PLAYER_LOGINS_COLLECTION).doc(name).get();
    return doc.exists ? (doc.data() || null) : null;
  } catch(e){ console.error('reading the player login failed', e); return null; }
}

// -> { ok: true, player } or { ok: false, message }
async function playerSignIn(name, rawCode){
  const auth = adminAuthApi();
  if(!auth || !db) return { ok: false, message: 'Sign-in is not available: no connection to the club’s database.' };
  const code = normalisePlayerCode(rawCode);
  if(code.length !== 8 && !/^\d{6}$/.test(code)) return { ok: false, message: 'Enter your code: 8 letters and numbers from your Admin, or the 6 digits you chose.' };
  const login = await playerLoginFor(name);
  if(!login || !login.email) return { ok: false, message: `${name} has no code yet. Ask your Admin for one.` };
  let cred;
  try { cred = await auth.signInWithEmailAndPassword(login.email, code); }
  catch(e){
    const c = (e && e.code) || '';
    if(/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return { ok: false, message: 'That code isn’t right. Check it, or ask your Admin for a new one.' };
    return { ok: false, message: adminSignInMessage(e) };
  }
  const player = await playerEntryFor(cred && cred.user);
  if(!player || player.name !== name){
    try { await auth.signOut(); } catch(e){ /* nothing to undo */ }
    return { ok: false, message: 'That code has been replaced. Ask your Admin for your new one.' };
  }
  signedInPlayer = player;
  signedInAdmin = null;   // one account per device: this one is now the player's
  if(typeof forgetStarterBefore === 'function') forgetStarterBefore(name, login.resetAt);
  return { ok: true, player };
}

// The signed-in player swaps their code for 6 digits of their own. Signing in
// again with the current code first is what Firebase asks before a password
// changes (a sign-in from weeks ago is not "recent").
async function changeOwnCode(currentCode, pin){
  const auth = adminAuthApi();
  if(!auth || !signedInPlayer) return { ok: false, message: 'Sign in with your code first.' };
  const bad = ownCodeProblem(pin);
  if(bad) return { ok: false, message: bad };
  const name = signedInPlayer.name;
  const login = await playerLoginFor(name);
  if(!login || !login.email) return { ok: false, message: 'Your sign-in couldn’t be found. Ask your Admin for a new code.' };
  try { await auth.signInWithEmailAndPassword(login.email, normalisePlayerCode(currentCode)); }
  catch(e){ return { ok: false, message: 'Your current code isn’t right.' }; }
  try { await auth.currentUser.updatePassword(pin); }
  catch(e){ return { ok: false, message: 'Couldn’t change it just now' + ((e && e.code) ? ` (${e.code})` : '') + '. Try again.' }; }
  // Tell the Admin's list it is the player's own now (their old code is gone).
  try { await db.collection(PLAYER_LOGINS_COLLECTION).doc(name).set({ ...login, own: true, changedAt: new Date().toISOString() }); }
  catch(e){ console.error('marking the code as chosen failed', e); }
  return { ok: true, message: 'Done. Your code is now the 6 digits you chose.' };
}

async function playerSignOut(){
  const auth = adminAuthApi();
  if(auth && auth.currentUser){
    try { await auth.signOut(); } catch(e){ console.error('sign out failed', e); }
  }
  signedInPlayer = null;
}

// ---- Admin: making and replacing codes -----------------------------------
// A new account is made in a second Firebase app, so the Admin stays signed
// in on their own: making an account in the main app would sign them out.
let playerCodesApp = null;
function playerCodesAuth(){
  if(typeof firebase === 'undefined') return null;
  try {
    if(!playerCodesApp) playerCodesApp = firebase.initializeApp(CLUB.firebase, 'playerCodes');
    return playerCodesApp.auth();
  } catch(e){ console.error('player codes app failed', e); return null; }
}

// Every player's current code, for the Admin: { name: { code, uid, email, createdAt, own } }
// `own`: the player has since chosen their own 6 digits, so `code` no longer works.
async function loadPlayerCodes(){
  const [codes, logins] = await Promise.all([db.collection(PLAYER_CODES_COLLECTION).get(), db.collection(PLAYER_LOGINS_COLLECTION).get()]);
  const own = {};
  logins.docs.forEach(d => { const v = d.data() || {}; own[d.id] = !!v.own; });
  const out = {};
  codes.docs.forEach(d => { out[d.id] = { ...d.data(), own: !!own[d.id] }; });
  return out;
}

// A new code for a player (their first, or a replacement). -> { ok, code } | { ok: false, message }
async function issuePlayerCode(name, existing){
  const second = playerCodesAuth();
  if(!second || !db) return { ok: false, message: 'Not available: no connection to the club’s database.' };
  if(!signedInAdmin) return { ok: false, message: 'Sign in with your Admin account to make codes.' };
  let code = null, user = null, email = null;
  for(let tries = 0; tries < 3 && !user; tries++){
    code = makePlayerCode(); email = makePlayerLoginEmail();
    try { user = (await second.createUserWithEmailAndPassword(email, code)).user; }
    catch(e){
      if(/email-already-in-use/.test((e && e.code) || '')) continue;   // astronomically rare: try another
      if(/operation-not-allowed|admin-restricted/.test((e && e.code) || '')) return { ok: false, message: 'Firebase isn’t letting the app make accounts (Authentication › Settings › User actions: allow creation).' };
      return { ok: false, message: 'Could not make the code: ' + ((e && e.code) || (e && e.message) || 'unknown error') };
    }
  }
  try { await second.signOut(); } catch(e){ /* the second app only made the account */ }
  if(!user) return { ok: false, message: 'Could not make a code just now. Try again.' };
  const now = new Date().toISOString(), by = signedInAdmin.name || signedInAdmin.email || 'Admin';
  try {
    const batch = db.batch();
    batch.set(db.collection(PLAYER_ACCOUNTS_COLLECTION).doc(user.uid), { player: name, createdAt: now, by });
    batch.set(db.collection(PLAYER_CODES_COLLECTION).doc(name), { code, uid: user.uid, email, createdAt: now, by });
    batch.set(db.collection(PLAYER_LOGINS_COLLECTION).doc(name), { email, own: false, changedAt: now });
    // The old code stops working: its account no longer says who it is.
    if(existing && existing.uid) batch.delete(db.collection(PLAYER_ACCOUNTS_COLLECTION).doc(existing.uid));
    await batch.commit();
  } catch(e){
    return { ok: false, message: 'The code was made but not saved. Publish the latest database rules (docs/PLAYER_CODES.md), then try again.' };
  }
  return { ok: true, code };
}

// What an Admin sends a player on WhatsApp.
function playerCodeMessage(name, code){
  const site = (typeof location !== 'undefined' && location.host) ? `https://${location.host}` : '';
  return `Hi ${name}, here's your ${CLUB.name} code: ${formatPlayerCode(code)}\n\nOpen ${site || 'the app'}, tap your name, and enter it once. You'll stay signed in on this phone. You can then change it to 6 digits of your own. Keep it to yourself.`;
}
