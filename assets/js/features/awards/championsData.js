// ===================== MONTHLY CHAMPIONS: THE RECORD =====================
// Shaun, 1 Nov: each finished month's Champions are locked, as Player of the
// Month is. Worked out from the games, a past Champion would quietly change
// whenever an old game was corrected; confirmed, the month's honours stand.
//
// An Admin confirms a finished month (one tap) and can reopen it (deleting
// the record, so the month reads from the games again until re-confirmed).
// Nothing is written on its own. Once a month is confirmed, championsFor()
// (rankingsData.js) answers from the record, so the Roll of Honour, the Power
// Rankings panel and anything else show the same Champions.
//
// Storage: the `monthlyChampions` collection, one document per month (id
// YYYY-MM), plain fields:
//   { month, champions: { A: { playerId, name, score, played }, ... },
//     confirmedAt, confirmedBy }
// Every tier is stored, Tier S included; whether a tier is shown is the
// screen's choice (groupedTiers). Read once at start-up with the rest of the
// record.
//
// Owning stream: functional. Loads before app.js; declarations only.

const CHAMPIONS_COLLECTION = 'monthlyChampions';
let championRecordsState = {};   // month -> stored record

async function loadChampionRecords(){
  if(!db) return {};
  try {
    const snap = await db.collection(CHAMPIONS_COLLECTION).get();
    const out = {};
    (snap.docs || []).forEach(d => {
      let v = d.data();
      if(v && typeof v.value === 'string') { try { v = JSON.parse(v.value); } catch(e){ v = null; } }
      if(v && v.month && v.champions) out[v.month] = v;
    });
    return out;
  } catch(e){ console.error('load Monthly Champions failed', e); return {}; }
}

function championRecordFor(month){ return championRecordsState[month] || null; }

// A month can be confirmed once the calendar has moved past it.
function championsConfirmable(month){ return month !== 'all' && month < currentMonthKey(); }

// The record as the games give it today, in the shape that is stored.
function championRecordFromGames(month){
  const derived = derivedChampionsFor(month);
  const champions = {};
  TIER_ORDER_LIST.forEach(t => {
    const c = derived && derived[t];
    if(c) champions[t] = { playerId: playerIdFor(c.name), name: c.name, score: Math.round(c.score * 10) / 10, played: c.played };
  });
  return { month, champions };
}

async function confirmMonthlyChampions(month){
  if(!championsConfirmable(month)) throw new Error('A month can be confirmed once it is over.');
  const record = { ...championRecordFromGames(month), confirmedAt: new Date().toISOString(), confirmedBy: currentUserName || 'Admin' };
  const doc = JSON.parse(JSON.stringify(record));   // Firestore refuses undefined
  await db.collection(CHAMPIONS_COLLECTION).doc(month).set(doc);
  championRecordsState = { ...championRecordsState, [month]: doc };
  return doc;
}

async function reopenMonthlyChampions(month){
  await db.collection(CHAMPIONS_COLLECTION).doc(month).delete();
  const next = { ...championRecordsState };
  delete next[month];
  championRecordsState = next;
}

// A confirmed record, shaped as championsFor() answers. Names follow renames
// (the stored id), falling back to the name as it was confirmed.
function lockedChampionsFor(month){
  const r = championRecordFor(month);
  if(!r) return null;
  const out = {};
  TIER_ORDER_LIST.forEach(t => {
    const c = r.champions[t];
    if(c) out[t] = { name: (c.playerId && potmNameOf(c.playerId)) || c.name, score: c.score, played: c.played };
  });
  out._final = true;
  out._locked = true;
  return out;
}

// Where a confirmed month and today's games now disagree, tier by tier --
// what an Admin is shown before deciding whether to reopen it.
function championsChangedSince(month){
  const r = championRecordFor(month);
  if(!r) return [];
  const now = championRecordFromGames(month).champions;
  return TIER_ORDER_LIST.filter(t => {
    const a = r.champions[t], b = now[t];
    return (a ? a.playerId : null) !== (b ? b.playerId : null);
  }).map(t => ({ tier: t, confirmed: r.champions[t] ? r.champions[t].name : null, now: now[t] ? now[t].name : null }));
}
