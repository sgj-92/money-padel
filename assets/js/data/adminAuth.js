// ===================== DATA: ADMIN SIGN-IN =====================
// White-label step 1c (Shaun, 5 Nov: "an actual password for admins, the
// normal way"). Each Admin has their own account -- an email and a password --
// in the community's Firebase project (Authentication), and an entry in its
// `admins` collection saying they are an Admin and which kind:
//
//   admins/{uid}  { role: 'owner' | 'board', name: 'Shaun' }
//
// Both are made by hand in the Firebase console (docs/ADMIN_SIGN_IN.md); the
// app never creates an account or makes anyone an Admin. The database rules
// (firestore.rules) let only those accounts change Admin data, so this is the
// security, where the old shared password was a deterrent.
//
// The old shared password is still offered while a community has
// `legacyAdminPassword` (config/club.js): Money Padel keeps it until its
// accounts exist and the rules are published, so no Admin is locked out in
// between. Then it goes.
//
// Loads after firebaseData.js (it needs `db`); declarations only.

const ADMINS_COLLECTION = 'admins';

// The account signed in on this device and found in `admins`, or null.
// { uid, email, role: 'owner' | 'board', name }
let signedInAdmin = null;

function adminAccountsOn(){ return !!CLUB.adminAccounts; }
function legacyAdminPasswordOn(){ return !!CLUB.legacyAdminPassword; }

function adminAuthApi(){
  if(!db || typeof firebase === 'undefined' || typeof firebase.auth !== 'function') return null;
  try { return firebase.auth(); } catch(e){ return null; }
}

// The account Firebase restores on this device, once it has restored it.
function restoredUser(){
  const auth = adminAuthApi();
  if(!auth) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const stop = auth.onAuthStateChanged((user) => {
      if(settled) return;
      settled = true;
      resolve(user || null);
      if(typeof stop === 'function') setTimeout(stop, 0);
    }, () => { if(!settled){ settled = true; resolve(null); } });
  });
}

// Is this account an Admin of this community? Only the `admins` entry says so.
async function adminEntryFor(user){
  if(!user) return null;
  try {
    const doc = await db.collection(ADMINS_COLLECTION).doc(user.uid).get();
    if(!doc.exists) return null;
    const d = doc.data() || {};
    return { uid: user.uid, email: user.email || '', role: d.role === 'owner' ? 'owner' : 'board', name: d.name || '' };
  } catch(e){
    console.error('reading the admins entry failed', e);
    return null;
  }
}

// Start-up: the Admin still signed in on this device, if any.
async function loadSignedInAdmin(){
  if(!adminAccountsOn()) return null;
  return adminEntryFor(await restoredUser());
}

function adminSignInMessage(e){
  const code = (e && e.code) || '';
  if(/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(code)) return 'Wrong email or password.';
  if(/too-many-requests/.test(code)) return 'Too many attempts. Wait a few minutes, or reset your password.';
  if(/network-request-failed/.test(code)) return 'No connection. Check your signal and try again.';
  if(/operation-not-allowed|configuration-not-found/.test(code)) return 'Email sign-in is not switched on for this club yet (Firebase console › Authentication).';
  if(/user-disabled/.test(code)) return 'This account has been switched off.';
  return 'Sign-in failed' + (code ? ` (${code})` : '') + '. Try again.';
}

// -> { ok: true, admin } or { ok: false, message }
async function adminSignIn(email, password){
  const auth = adminAuthApi();
  if(!auth) return { ok: false, message: 'Sign-in is not available: no connection to the club’s database.' };
  if(!email || !password) return { ok: false, message: 'Enter your email and password.' };
  let cred;
  try { cred = await auth.signInWithEmailAndPassword(String(email).trim(), password); }
  catch(e){ return { ok: false, message: adminSignInMessage(e) }; }
  const admin = await adminEntryFor(cred && cred.user);
  if(!admin){
    try { await auth.signOut(); } catch(e){ /* nothing to undo */ }
    return { ok: false, message: `${String(email).trim()} is not an Admin of ${CLUB.name}.` };
  }
  return { ok: true, admin };
}

async function adminSignOut(){
  const auth = adminAuthApi();
  if(auth && auth.currentUser){
    try { await auth.signOut(); } catch(e){ console.error('sign out failed', e); }
  }
}

// "Forgot your password?" and "Change my password" both send Firebase's own
// reset email: the password is only ever typed into Firebase's page.
async function sendAdminPasswordReset(email){
  const auth = adminAuthApi();
  if(!auth) return { ok: false, message: 'Not available: no connection to the club’s database.' };
  if(!email || !String(email).trim()) return { ok: false, message: 'Enter your email first.' };
  try {
    await auth.sendPasswordResetEmail(String(email).trim());
    return { ok: true, message: `If ${String(email).trim()} has an account, a reset link is on its way.` };
  } catch(e){
    if(/user-not-found/.test((e && e.code) || '')) return { ok: true, message: `If ${String(email).trim()} has an account, a reset link is on its way.` };
    return { ok: false, message: adminSignInMessage(e) };
  }
}
