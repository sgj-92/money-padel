// ===================== v3 PERSISTENCE (matches, journey, player state) =====================
// Storage layout for the beta project:
//
//   matches/{matchId}         one doc per match, id = the export's Match ID
//   ratingJourney/{eventId}   one doc per Rating Journey event
//   players/{playerId}        current state snapshot, rebuildable from the journey
//
// The legacy small config blobs (visibility, tags, game requests) stay in the
// `moneypadel` collection untouched. The journey gets its own collection
// because it is append-heavy: 144 matches is already 576 events and grows about
// 120 a month, which would run a single blob doc into Firestore's 1MB limit.
//
// Document ids are DETERMINISTIC so that re-running a backfill overwrites the
// same documents rather than duplicating them. Seeding twice is a no-op.

(function (root, factory) {
  const api = factory(typeof require === 'function' ? require('./ratingEngine.js') : root.RatingEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RatingStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Engine) {
  'use strict';

  const COLLECTIONS = { matches: 'matches', journey: 'ratingJourney', players: 'players' };
  const SCHEMA_VERSION = 'v3-1';

  function assertUsableId(id, event) {
    if (id.includes('/') || id === '.' || id === '..') {
      throw new Error('Illegal document id "' + id + '" for ' + event.eventType);
    }
    return id;
  }

  function eventId(event) {
    if (event.eventType === Engine.EVENT.MATCH_UPDATE) {
      return assertUsableId(`${event.matchId}__${event.playerId}`, event);
    }
    // Every non-match event must be dated. Without one the id would not be
    // stable, and an undated event has no place in a chronological ledger.
    if (!event.effectiveDate) {
      throw new Error(`${event.eventType} for ${event.playerId} has no effectiveDate`);
    }
    const base = `${event.effectiveDate}__${event.playerId}__${event.eventType}`;
    // A revision is how a superseding correction sits BESIDE the decision it
    // replaces instead of overwriting it. Without it the two share an id and
    // the earlier one silently disappears, which is exactly what an audited
    // record must never do.
    const id = event.revision ? `${base}__r${event.revision}` : base;
    return assertUsableId(id, event);
  }

  // §11: the full record. Absent optional fields are written as null rather
  // than omitted, so a reader never has to guess whether a field was missing or
  // simply not applicable.
  const JOURNEY_FIELDS = [
    'playerId', 'eventType', 'effectiveDate',
    'previousTier', 'newTier',
    'previousClassificationStatus', 'newClassificationStatus',
    'previousPowerRating', 'newPowerRating',
    'previousReliability', 'newReliability',
    'effectiveEvidenceBefore', 'effectiveEvidenceAfter',
    'lifetimeMatchesAtEvent',
    'recommendationRating', 'recommendationReliability', 'recommendationMethodVersion',
    'decisionType', 'reasonCode', 'notes',
    // `supersedes` names the event this one replaces; `revision` keeps their
    // ids distinct. Both stay in the record and the replay honours only the
    // latest.
    'supersedes', 'revision',
    'createdBy', 'recordedAt',
    'ratingModelVersion', 'source',
  ];

  // Large match records are referenced by id, never duplicated into the event.
  const MATCH_EVENT_FIELDS = [
    'matchId', 'side', 'preMatchRating', 'preMatchExpectedScore', 'actualScore',
    'performanceResidual', 'kUsed', 'ratingDelta', 'postMatchRating', 'tierAtEvent',
  ];

  function toJourneyDoc(event) {
    const doc = { id: eventId(event), schemaVersion: SCHEMA_VERSION };
    JOURNEY_FIELDS.forEach((f) => { doc[f] = event[f] === undefined ? null : event[f]; });
    if (event.eventType === Engine.EVENT.MATCH_UPDATE) {
      MATCH_EVENT_FIELDS.forEach((f) => { doc[f] = event[f] === undefined ? null : event[f]; });
    }
    return doc;
  }

  // Firestore rejects an array whose elements are themselves arrays, so a set
  // score is stored as a map per set rather than as [gamesA, gamesB]. The
  // engine's own shape is restored by matchFromDoc.
  function toMatchDoc(match) {
    return {
      id: match.id,
      schemaVersion: SCHEMA_VERSION,
      date: match.date,
      sourceIndex: match.sourceIndex ?? null,
      teamA: match.teamA,
      teamB: match.teamB,
      sets: match.sets.map((s) => ({ teamA: s[0], teamB: s[1] })),
      outcome: match.outcome,
      type: match.type ?? null,
      drawSideAssignmentArbitrary: !!match.drawSideAssignmentArbitrary,
      // Only on a forfeit, so every other stored match is exactly as before.
      ...(match.forfeit ? { forfeit: { by: match.forfeit.by, unaffected: (match.forfeit.unaffected || []).slice() } } : {}),
      // Only on a match someone arrived late for (ratingEngine.js).
      ...(match.late ? { late: lateCopy(match.late) } : {}),
    };
  }

  function lateCopy(l) {
    return { by: (l.by || []).slice(), onTime: (l.onTime || []).slice(), playedOutcome: l.playedOutcome };
  }

  function matchFromDoc(doc) {
    return {
      id: doc.id,
      sourceIndex: doc.sourceIndex,
      date: doc.date,
      teamA: doc.teamA,
      teamB: doc.teamB,
      sets: doc.sets.map((s) => [s.teamA, s.teamB]),
      outcome: doc.outcome,
      type: doc.type,
      drawSideAssignmentArbitrary: doc.drawSideAssignmentArbitrary,
      ...(doc.forfeit ? { forfeit: { by: doc.forfeit.by, unaffected: (doc.forfeit.unaffected || []).slice() } } : {}),
      ...(doc.late ? { late: lateCopy(doc.late) } : {}),
    };
  }

  // Walks a document and rejects anything Firestore will not accept. Cheap, and
  // it turns a failed network round-trip into a failing test.
  function assertFirestoreSafe(doc, collection) {
    const walk = (value, pathStr, insideArray) => {
      if (Array.isArray(value)) {
        if (insideArray) {
          throw new Error(`Nested array at ${collection}/${doc.id} ${pathStr} — Firestore rejects these.`);
        }
        value.forEach((v, i) => walk(v, `${pathStr}[${i}]`, true));
        return;
      }
      if (value && typeof value === 'object') {
        Object.entries(value).forEach(([k, v]) => walk(v, `${pathStr}.${k}`, false));
        return;
      }
      if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new Error(`Non-finite number at ${collection}/${doc.id} ${pathStr}`);
      }
    };
    Object.entries(doc).forEach(([k, v]) => walk(v, k, false));
    return doc;
  }

  function toPlayerDoc(playerId, state) {
    return {
      id: playerId,
      schemaVersion: SCHEMA_VERSION,
      rating: state.rating,
      effectiveEvidence: state.effectiveEvidence,
      reliability: Engine.reliability(state.effectiveEvidence),
      lifetimeMatches: state.lifetimeMatches,
      tier: state.tier,
      classificationStatus: state.classificationStatus,
      ratingModelVersion: Engine.RATING_MODEL_VERSION,
    };
  }

  // Turns a replay into the exact set of documents that would be written.
  // Pure: builds the plan, writes nothing.
  // `provenance` stamps createdBy/recordedAt/source onto events that do not
  // already carry them, so a backfilled record says who wrote it. recordedAt is
  // supplied by the caller rather than read from the clock, so the same replay
  // always produces the same plan.
  function buildWritePlan({ matches, journey, state, provenance }) {
    const stamp = (doc) => {
      if (!provenance) return doc;
      ['createdBy', 'recordedAt', 'source'].forEach((f) => {
        if (doc[f] === null && provenance[f] !== undefined) doc[f] = provenance[f];
      });
      return doc;
    };
    const docs = {
      [COLLECTIONS.matches]: matches.map(toMatchDoc),
      [COLLECTIONS.journey]: journey.map((e) => stamp(toJourneyDoc(e))),
      [COLLECTIONS.players]: Object.keys(state).sort().map((p) => toPlayerDoc(p, state[p])),
    };
    const ids = docs[COLLECTIONS.journey].map((d) => d.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length) throw new Error('Duplicate journey ids: ' + [...new Set(dupes)].join(', '));
    Object.entries(docs).forEach(([c, list]) => list.forEach((d) => assertFirestoreSafe(d, c)));
    return docs;
  }

  function evenlySpaced(arr, k) {
    if (k <= 0) return [];
    if (k >= arr.length) return [...arr];
    const out = [];
    for (let i = 0; i < k; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (k - 1 || 1))]);
    return out;
  }

  // A capped sample of a plan, for a smoke-test write. Documents are taken
  // round-robin across collections so a small limit still covers every
  // collection, and evenly spaced within each so the sample is not all one
  // event type. The result is a real subset: same ids, same content, so the
  // later full seed simply overwrites it.
  function limitPlan(plan, limit) {
    const names = Object.keys(plan);
    const counts = Object.fromEntries(names.map((n) => [n, 0]));
    let remaining = Math.max(0, limit);
    let progressed = true;
    while (remaining > 0 && progressed) {
      progressed = false;
      for (const n of names) {
        if (remaining === 0) break;
        if (counts[n] < plan[n].length) { counts[n]++; remaining--; progressed = true; }
      }
    }
    return Object.fromEntries(names.map((n) => [n, evenlySpaced(plan[n], counts[n])]));
  }

  function summarisePlan(plan) {
    const journey = plan[COLLECTIONS.journey];
    const byType = {};
    journey.forEach((d) => { byType[d.eventType] = (byType[d.eventType] || 0) + 1; });
    return {
      collections: Object.fromEntries(Object.entries(plan).map(([c, d]) => [c, d.length])),
      journeyByEventType: byType,
      totalDocuments: Object.values(plan).reduce((s, d) => s + d.length, 0),
      approximateBytes: JSON.stringify(plan).length,
    };
  }

  // ---------- backends ----------

  function memoryBackend() {
    const data = {};
    return {
      name: 'memory',
      async set(collection, id, doc) {
        (data[collection] = data[collection] || {})[id] = doc;
      },
      async getAll(collection) { return Object.values(data[collection] || {}); },
      async remove(collection, id) { delete (data[collection] || {})[id]; },
      // Present so the batching path is the one the tests exercise too. A batch
      // is atomic against the real backend, so it is applied here in one go
      // rather than interleaved with anything else.
      async commitBatch(ops) {
        ops.forEach((o) => {
          if (o.op === 'delete') delete (data[o.collection] || {})[o.id];
          else (data[o.collection] = data[o.collection] || {})[o.id] = o.doc;
        });
      },
      raw: data,
    };
  }

  // Firestore REST, so the seed can run from Node with no SDK install. The beta
  // project has open rules and no auth, which is why no token is attached; this
  // must never be pointed at a project that holds real credentials.
  // Browser path. The compat SDK returns a whole QuerySnapshot and handles its
  // own paging, so there is no nextPageToken to follow here.
  function firestoreCompatBackend(db) {
    return {
      name: 'firestore-compat',
      async set(collection, id, doc) { await db.collection(collection).doc(id).set(doc); },
      // Deliberately present but unused by the application. Nothing in the UI
      // deletes a document: the record is forward-only, and a decision is undone
      // by recording a reversal. This exists so the beta reset workflow can run
      // through the same backend interface as everything else.
      async remove(collection, id) { await db.collection(collection).doc(id).delete(); },
      async getAll(collection) {
        const snap = await db.collection(collection).get();
        return snap.docs.map((d) => d.data());
      },
      // A replay rewrites hundreds of documents. One batched write per 500
      // operations replaces one round trip per document, which is the
      // difference between a couple of seconds and a couple of minutes on a
      // phone. Each batch is atomic: it lands whole or not at all.
      //
      // Only offered when the SDK in use actually batches. ReplayForward.commit
      // falls back to one document at a time when this is absent, so a backend
      // without it still writes correctly -- just slowly.
      commitBatch: typeof db.batch !== 'function' ? undefined : async function (ops) {
        const batch = db.batch();
        ops.forEach((o) => {
          const ref = db.collection(o.collection).doc(o.id);
          if (o.op === 'delete') batch.delete(ref);
          else batch.set(ref, o.doc);
        });
        await batch.commit();
      },
    };
  }

  function firestoreRestBackend({ projectId, fetchImpl }) {
    const doFetch = fetchImpl || globalThis.fetch;
    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    return {
      name: 'firestore-rest:' + projectId,
      async set(collection, id, doc) {
        const res = await doFetch(`${base}/${collection}/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: toFirestoreFields(doc) }),
        });
        if (!res.ok) throw new Error(`write ${collection}/${id} failed: ${res.status} ${await res.text()}`);
      },
      async remove(collection, id) {
        const res = await doFetch(`${base}/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`delete ${collection}/${id} failed: ${res.status} ${await res.text()}`);
      },
      // Firestore caps a page by response size, not just pageSize, so a large
      // collection comes back in pieces. Following nextPageToken is required --
      // without it a read silently truncates and looks like missing data.
      async getAll(collection) {
        const out = [];
        let pageToken = null;
        do {
          const url = `${base}/${collection}?pageSize=300` + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
          const res = await doFetch(url);
          if (!res.ok) throw new Error(`read ${collection} failed: ${res.status}`);
          const body = await res.json();
          (body.documents || []).forEach((d) => out.push(fromFirestoreFields(d.fields)));
          pageToken = body.nextPageToken || null;
        } while (pageToken);
        return out;
      },
    };
  }

  function toFirestoreFields(value) {
    const enc = (v) => {
      if (v === null || v === undefined) return { nullValue: null };
      if (typeof v === 'boolean') return { booleanValue: v };
      if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
      if (typeof v === 'string') return { stringValue: v };
      if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
      return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
    };
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, enc(v)]));
  }

  function fromFirestoreFields(fields) {
    const dec = (f) => {
      if (!f) return null;
      if ('nullValue' in f) return null;
      if ('booleanValue' in f) return f.booleanValue;
      if ('integerValue' in f) return Number(f.integerValue);
      if ('doubleValue' in f) return f.doubleValue;
      if ('stringValue' in f) return f.stringValue;
      if ('arrayValue' in f) return (f.arrayValue.values || []).map(dec);
      if ('mapValue' in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, v]) => [k, dec(v)]));
      return null;
    };
    return Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, dec(v)]));
  }

  async function writePlan(backend, plan, { onProgress } = {}) {
    let written = 0;
    for (const [collection, docs] of Object.entries(plan)) {
      for (const doc of docs) {
        await backend.set(collection, doc.id, doc);
        written++;
        if (onProgress) onProgress(written, collection, doc.id);
      }
    }
    return written;
  }

  // A backend that has already asked for everything it is going to be asked
  // for.
  //
  // Loading v3 state reads three collections, and the code that reads them is
  // three `await`s in a row inside v3Bridge -- correct, readable, and three
  // round trips where the data allows one. None of the three reads is an input
  // to any other: the alias map is applied to matches and journey events AFTER
  // both have arrived, so only the mapping is ordered, never the fetching. On
  // a phone at 250ms to Firestore that ordering cost 750ms of start-up for
  // nothing.
  //
  // Rather than restructure v3Bridge (and every test that drives it) around a
  // parallel fetch, the parallelism goes here, where it is invisible: the
  // reads are started together, and `getAll` hands back the one already in
  // flight. v3Bridge still awaits three collections in order and cannot tell
  // the difference; it simply stops waiting for them.
  //
  // A collection nobody ends up asking for is still read, so this takes the
  // list explicitly rather than guessing.
  function prefetchedBackend(backend, collections) {
    const started = {};
    (collections || []).forEach((c) => {
      const p = backend.getAll(c);
      // A read whose consumer gives up early (v3Bridge returns as soon as
      // `players` fails) would otherwise surface as an unhandled rejection,
      // and in a browser as a console error for a failure already reported.
      // This marks it handled without changing what `started[c]` resolves to.
      if (p && typeof p.catch === 'function') p.catch(() => {});
      started[c] = p;
    });
    return Object.assign({}, backend, {
      getAll(collection) {
        return Object.prototype.hasOwnProperty.call(started, collection)
          ? started[collection]
          : backend.getAll(collection);
      },
    });
  }

  return {
    COLLECTIONS, SCHEMA_VERSION, JOURNEY_FIELDS, MATCH_EVENT_FIELDS,
    eventId, toJourneyDoc, toMatchDoc, matchFromDoc, toPlayerDoc, assertFirestoreSafe,
    buildWritePlan, summarisePlan, writePlan, limitPlan,
    memoryBackend, firestoreRestBackend, firestoreCompatBackend, prefetchedBackend,
    toFirestoreFields, fromFirestoreFields,
  };
});
