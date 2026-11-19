// ===================== DATA: PLAYER CODES =====================
// Shaun, 19 Nov: "accounts for players so they can put their schedule for
// when they can play, receive notifications and request games ... not full
// accounts with email address and passwords, but perhaps a unique code they
// enter when clicking on their name. Then they can stay saved on their
// device." Decided: a personal code; Padel Championships first.
//
// A code IS a sign-in: each one is an ordinary account in the community's own
// Firebase project (Authentication, email + password -- the provider the
// Admin accounts already use), whose email and password are both made from
// the code. The player never sees an email or a password; they type the code
// once and Firebase keeps them signed in on that device.
//
//   code      KZ7P-42QM            (8 letters/digits, no look-alikes)
//   email     kz7p42qm@<PLAYER_EMAIL_DOMAIN>   (not a real mailbox)
//   password  KZ7P42QM
//
// Which player an account is, is said ONLY by an Admin-written entry:
//
//   playerAccounts/{uid}  { player: 'Kaz', createdAt, by }   self + Admin read; Admin write
//   playerCodes/{player}  { code, uid, createdAt, by }       Admin only (to re-send it)
//
// A reset makes a new account and moves the entry to it; the old code's
// account is left with no entry, so it can sign in to nothing. The database
// rules (firestore.rules) are the security; the app only says who is who.
//
// Loads after adminAuth.js (it shares Firebase Authentication); declarations only.

const PLAYER_ACCOUNTS_COLLECTION = 'playerAccounts';
const PLAYER_CODES_COLLECTION = 'playerCodes';
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
function playerCodeEmail(code){ return `${normalisePlayerCode(code).toLowerCase()}@${PLAYER_EMAIL_DOMAIN}`; }
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
  if(signedInAdmin && signedInAdmin.name && PLAYERS.some(p => p.name === signedInAdmin.name)) return signedInAdmin.name;
  return null;
}

// -> { ok: true, player } or { ok: false, message }
async function playerSignIn(rawCode){
  const auth = adminAuthApi();
  if(!auth) return { ok: false, message: 'Sign-in is not available: no connection to the club’s database.' };
  const code = normalisePlayerCode(rawCode);
  if(code.length !== 8) return { ok: false, message: 'A code is 8 letters and numbers, like KZ7P-42QM.' };
  let cred;
  try { cred = await auth.signInWithEmailAndPassword(playerCodeEmail(code), code); }
  catch(e){
    const c = (e && e.code) || '';
    if(/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return { ok: false, message: 'That code isn’t right. Check it with your Admin.' };
    return { ok: false, message: adminSignInMessage(e) };
  }
  const player = await playerEntryFor(cred && cred.user);
  if(!player){
    try { await auth.signOut(); } catch(e){ /* nothing to undo */ }
    return { ok: false, message: 'That code has been replaced. Ask your Admin for your new one.' };
  }
  signedInPlayer = player;
  signedInAdmin = null;   // one account per device: this one is now the player's
  return { ok: true, player };
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

// Every player's current code, for the Admin: { name: { code, uid, createdAt } }
async function loadPlayerCodes(){
  const snap = await db.collection(PLAYER_CODES_COLLECTION).get();
  const out = {};
  snap.docs.forEach(d => { out[d.id] = d.data(); });
  return out;
}

// A new code for a player (their first, or a replacement). -> { ok, code } | { ok: false, message }
async function issuePlayerCode(name, existing){
  const second = playerCodesAuth();
  if(!second || !db) return { ok: false, message: 'Not available: no connection to the club’s database.' };
  if(!signedInAdmin) return { ok: false, message: 'Sign in with your Admin account to make codes.' };
  let code = null, user = null;
  for(let tries = 0; tries < 3 && !user; tries++){
    code = makePlayerCode();
    try { user = (await second.createUserWithEmailAndPassword(playerCodeEmail(code), code)).user; }
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
    batch.set(db.collection(PLAYER_CODES_COLLECTION).doc(name), { code, uid: user.uid, createdAt: now, by });
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
  return `Hi ${name}, here's your ${CLUB.name} code: ${formatPlayerCode(code)}\n\nOpen ${site || 'the app'}, tap your name, and enter it once. You'll stay signed in on this phone. Keep it to yourself.`;
}
