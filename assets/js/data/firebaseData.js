// ===================== DATA: FIREBASE PERSISTENCE =====================
// The beta Firestore connection (mp-dashboard-beta-v3 -- never production),
// the storage keys and every load / save of the club's shared documents.
// Screens never talk to Firestore directly; they call these. The v3 record
// itself (matches, ratingJourney, players) is read through ratingStore.js /
// v3Bridge.js.
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: functional. Loads before app.js. Its one load-time action is
// opening the Firestore connection, which needs only the Firebase SDK in <head>.

// ===================== STORAGE (Firebase Firestore + localStorage) =====================
// Beta v3 project — deliberately NOT the live `mp---dashboard` project the
// production dashboard reads and writes. v3 must never write to production.
// This database starts empty: the Firestore overlays (approved submissions,
// match edits, deletions, tier overrides) still live in the production project
// and have not been migrated, so anything this app computes from Firestore
// alone will differ from production until that migration runs.
// The community's own Firebase project (config/club.js): each community's
// data lives apart from every other's.
const firebaseConfig = CLUB.firebase;

let db = null;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} catch(e) {
  console.error('Firebase init failed — check firebaseConfig at the top of the script.', e);
}

const FS_COLLECTION = 'moneypadel'; // one Firestore collection, one document per storage key

let lastStorageError = null;

function storageAvailable(){
  return !!db;
}

async function fsGet(key){
  const doc = await db.collection(FS_COLLECTION).doc(key).get();
  return doc.exists ? doc.data().value : null;
}

async function fsSet(key, value){
  await db.collection(FS_COLLECTION).doc(key).set({ value, updatedAt: Date.now() });
}

// The same, in another collection -- published Player Packs live in their
// own (playerPacks), named by their private token.
async function fsGetIn(collection, id){
  const doc = await db.collection(collection).doc(id).get();
  return doc.exists ? doc.data().value : null;
}

async function fsSetIn(collection, id, value){
  await db.collection(collection).doc(id).set({ value, updatedAt: Date.now() });
}

// Read one stored document and parse it, falling back to `fallback` if it is
// missing or unreadable. Every caller did exactly this; having it once is what
// makes the reads safe to fire concurrently -- a rejected promise inside a
// Promise.all would otherwise take the whole of start-up down with it, where
// the sequential version quietly logged and carried on.
async function fsGetJson(key, fallback, label){
  try {
    const v = await fsGet(key);
    if(v) return JSON.parse(v);
  } catch(e){ console.error('load ' + (label || key) + ' failed', e); }
  return fallback;
}

const STORAGE_KEY_MATCHES = 'moneypadel_extra_matches';   // pending + approved submissions
const STORAGE_KEY_TAGS = 'moneypadel_player_tags';
const STORAGE_KEY_EDITS = 'moneypadel_match_edits';        // id -> override fields
const STORAGE_KEY_DELETED = 'moneypadel_deleted_ids';      // array of ids, soft-delete
const STORAGE_KEY_VISIBILITY = 'moneypadel_visibility';    // shared: which sections non-admins can see
const STORAGE_KEY_MY_NAME = 'moneypadel_my_name';          // personal — localStorage, this device only
const STORAGE_KEY_GAME_REQUESTS = 'moneypadel_game_requests'; // shared: wishlist + upcoming games
const STORAGE_KEY_DEV_AREAS = 'moneypadel_dev_areas'; // shared: freeform per-player development notes
const STORAGE_KEY_CHALLENGES = 'moneypadel_challenges'; // shared: sequential turn-based match challenges (separate from gameRequestsState -- see buildCompleteMatchWithPartner/bridgeChallengeToRequest below for why)
const STORAGE_KEY_NS_RESULTS = 'moneypadel_north_south_results'; // shared: live results for the North vs South exhibition, keyed by fixture id -- see NORTH_SOUTH_FIXTURES above

async function loadVisibility(){
  try { const v = await fsGet(STORAGE_KEY_VISIBILITY); if(v) return {...VISIBILITY_DEFAULTS, ...JSON.parse(v)}; } catch(e){ console.error('load visibility failed', e); }
  return {...VISIBILITY_DEFAULTS};
}

async function saveVisibility(vis){
  try {
    await fsSet(STORAGE_KEY_VISIBILITY, JSON.stringify(vis));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save visibility failed', e); return false; }
}

async function loadGameRequests(){
  try { const v = await fsGet(STORAGE_KEY_GAME_REQUESTS); if(v) return JSON.parse(v); } catch(e){ console.error('load game requests failed', e); }
  return [];
}

async function saveGameRequests(requests){
  try {
    await fsSet(STORAGE_KEY_GAME_REQUESTS, JSON.stringify(requests));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save game requests failed', e); return false; }
}

async function loadDevAreas(){
  try { const v = await fsGet(STORAGE_KEY_DEV_AREAS); if(v) return JSON.parse(v); } catch(e){ console.error('load dev areas failed', e); }
  return [];
}

async function saveDevAreas(areas){
  try {
    await fsSet(STORAGE_KEY_DEV_AREAS, JSON.stringify(areas));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save dev areas failed', e); return false; }
}

async function loadChallenges(){
  try { const v = await fsGet(STORAGE_KEY_CHALLENGES); if(v) return JSON.parse(v); } catch(e){ console.error('load challenges failed', e); }
  return [];
}

async function saveChallenges(challenges){
  try {
    await fsSet(STORAGE_KEY_CHALLENGES, JSON.stringify(challenges));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save challenges failed', e); return false; }
}

async function loadNorthSouthResults(){
  try { const v = await fsGet(STORAGE_KEY_NS_RESULTS); if(v) return JSON.parse(v); } catch(e){ console.error('load north vs south results failed', e); }
  return {};
}

async function saveNorthSouthResults(results){
  try {
    await fsSet(STORAGE_KEY_NS_RESULTS, JSON.stringify(results));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save north vs south results failed', e); return false; }
}

// The Admin Monthly Board Pack: one document per month
// (moneypadel_board_pack_YYYY-MM, domain/boardPack/boardPackConfig.js), read
// when an admin opens that month's pack rather than at start-up -- no player
// ever needs it. It holds the admin's choice for the month, never figures.
async function loadBoardPack(month){
  try { const v = await fsGet(BoardPack.storageKey(month)); if(v) return JSON.parse(v); } catch(e){ console.error('load board pack failed', e); }
  return null;
}

async function saveBoardPack(config){
  try {
    await fsSet(BoardPack.storageKey(config.month), JSON.stringify(config));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save board pack failed', e); return false; }
}

// A published Monthly Review (moneypadel_review_YYYY-MM, domain/boardPack/
// shareDeck.js): the slides exactly as they were published, so the link a
// player opens months later shows the month as it was shared. Written only by
// an Admin's Publish; read by the public review page (review/) and by the
// Board Pack section.
async function loadPublishedReview(month){
  try { const v = await fsGet(ShareDeck.storageKey(month)); if(v) return JSON.parse(v); } catch(e){ console.error('load published review failed', e); }
  return null;
}

async function savePublishedReview(doc){
  try {
    await fsSet(ShareDeck.storageKey(doc.month), JSON.stringify(doc));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save published review failed', e); return false; }
}

// Four independent documents. Read together rather than one after another:
// none of them is an input to any of the others, so reading them in sequence
// only ever bought four round trips where one would do. See init() for the
// same argument applied to the whole of start-up.
async function loadStoredData(){
  const [extraMatches, tagOverrides, matchEdits, deletedIds, matchAttribution, matchNotes] = await Promise.all([
    fsGetJson(STORAGE_KEY_MATCHES, [], 'matches'),
    fsGetJson(STORAGE_KEY_TAGS, {}, 'tags'),
    fsGetJson(STORAGE_KEY_EDITS, {}, 'edits'),
    fsGetJson(STORAGE_KEY_DELETED, [], 'deleted ids'),
    fsGetJson(MatchAttribution.STORAGE_KEY, {}, 'match attribution'),
    fsGetJson(MatchNote.STORAGE_KEY, {}, 'match notes'),
  ]);
  return {extraMatches, tagOverrides, matchEdits, deletedIds, matchAttribution, matchNotes};
}

async function loadMyName(){
  try { const v = localStorage.getItem(STORAGE_KEY_MY_NAME); if(v) return JSON.parse(v); } catch(e){ /* not set yet */ }
  return '';
}

async function saveMyName(name){
  try { localStorage.setItem(STORAGE_KEY_MY_NAME, JSON.stringify(name)); } catch(e){ /* best effort */ }
}

// ===================== ADMIN LOCK (deterrent, not real security) =====================
const STORAGE_KEY_ADMIN_PW_OWNER = 'moneypadel_admin_pw_owner_hash'; // shared, in Firestore
const STORAGE_KEY_ADMIN_PW_BOARD = 'moneypadel_admin_pw_board_hash'; // shared, in Firestore
const STORAGE_KEY_MY_UNLOCKED = 'moneypadel_my_unlocked';  // personal — localStorage, this device only

async function loadPasswordHash(key){
  try { const v = await fsGet(key); if(v) return JSON.parse(v); } catch(e){ console.error('load password failed', key, e); }
  return null;
}

async function savePasswordHash(key, hash){
  try {
    await fsSet(key, JSON.stringify(hash));
    return true;
  } catch(e){
    lastStorageError = (e && e.message) ? e.message : String(e);
    console.error('savePasswordHash failed:', key, e);
    return false;
  }
}

async function loadMyUnlocked(){
  try {
    const v = localStorage.getItem(STORAGE_KEY_MY_UNLOCKED);
    if(v){
      const parsed = JSON.parse(v);
      // Older devices stored a bare boolean. An unlock with no recorded role is
      // treated as 'board': the lesser of the two, so a stale value can never
      // hand someone the owner's view.
      if(parsed === true){ adminRole = 'board'; return true; }
      if(parsed && parsed.unlocked){ adminRole = parsed.role === 'owner' ? 'owner' : 'board'; return true; }
    }
  } catch(e){ /* not set yet */ }
  adminRole = null;
  return false;
}

async function saveMyUnlocked(val, role){
  try {
    localStorage.setItem(STORAGE_KEY_MY_UNLOCKED,
      JSON.stringify(val ? { unlocked: true, role: role || adminRole || 'board' } : { unlocked: false }));
  } catch(e){ /* best effort */ }
}

async function saveExtraMatches(extraMatches){
  try {
    await fsSet(STORAGE_KEY_MATCHES, JSON.stringify(extraMatches));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save matches failed', e); return false; }
}

// Who submitted each rated game, kept beside the rating record rather than in
// it (domain/matches/matchAttribution.js). matchId -> entry.
async function saveMatchAttribution(map){
  try {
    await fsSet(MatchAttribution.STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save match attribution failed', e); return false; }
}

// A result's asterisk and note (domain/matches/matchNote.js). Admin-only.
async function saveMatchNotes(map){
  try {
    await fsSet(MatchNote.STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save match notes failed', e); return false; }
}

async function saveTagOverrides(tagOverrides){
  try {
    await fsSet(STORAGE_KEY_TAGS, JSON.stringify(tagOverrides));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save tags failed', e); return false; }
}

async function saveMatchEdits(matchEdits){
  try {
    await fsSet(STORAGE_KEY_EDITS, JSON.stringify(matchEdits));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save edits failed', e); return false; }
}

async function saveDeletedIds(deletedIds){
  try {
    await fsSet(STORAGE_KEY_DELETED, JSON.stringify(deletedIds));
    return true;
  } catch(e){ lastStorageError = (e && e.message) ? e.message : String(e); console.error('save deleted ids failed', e); return false; }
}
