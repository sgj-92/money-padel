// ===================== REPLAY FORWARD =====================
// Changing the match history means changing the inputs to everything that came
// after it. A rating is not a stored fact you can edit; it is the end of a
// sequence, and the only honest way to change one match is to re-derive every
// rating that followed from it.
//
// This module does that by rebuilding the ENGINE INPUTS from the stored record,
// applying the change, and replaying the whole thing. Not a partial replay from
// a midpoint: every input is stored, so a full re-derivation is exact and has no
// partial-state bookkeeping to get subtly wrong. 150 matches costs nothing.
//
// The proof that it can be trusted is `verifyNoOp`: replaying with NO change
// must reproduce the stored record exactly. If that ever fails, nothing else
// here means anything, so it is a test and also a runtime precondition of
// planning a real change.
//
// One subtlety, and it is the reason this module reconstructs INTENT rather
// than echoing the record. A recorded event carries `newReliability` whether or
// not it meant to change reliability, and feeding that back inverts it through
// reliability = e / (e + 10), losing a last bit (Open Question 11). So an event
// is replayed carrying a reliability change only when it actually made one.
// That is both exact and more faithful: it replays what the decision was, not
// what the arithmetic happened to record.

(function (root, factory) {
  const api = factory(
    typeof require === 'function' ? require('./ratingEngine.js') : root.RatingEngine,
    typeof require === 'function' ? require('./ratingStore.js') : root.RatingStore,
    typeof require === 'function' ? require('./monthlyReview.js') : root.MonthlyReview
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReplayForward = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Engine, Store, Review) {
  'use strict';

  const INIT = Engine.EVENT.PLAYER_INITIALISED;
  const MATCH = Engine.EVENT.MATCH_UPDATE;

  function byDateThen(a, b, key) {
    if (a.effectiveDate !== b.effectiveDate) return a.effectiveDate < b.effectiveDate ? -1 : 1;
    return String(a[key] || '').localeCompare(String(b[key] || ''));
  }

  // The engine inputs that produced the stored record. Everything here is read
  // back; nothing is inferred.
  function inputsFromRecord({ matches, journey }) {
    const matchInputs = (matches || []).map(Store.matchFromDoc);

    const initialisations = (journey || [])
      .filter((e) => e.eventType === INIT)
      .sort((a, b) => byDateThen(a, b, 'playerId'))
      .map((e) => ({
        playerId: e.playerId,
        tier: e.newTier,
        // Both matter and both are recorded. classificationStatus defaults to
        // ESTABLISHED in the engine, so dropping it silently promotes every
        // provisional player and the correction that follows then throws.
        // The starting rating is carried too, so a non-standard seed survives
        // rather than being re-derived from the tier.
        classificationStatus: e.newClassificationStatus || undefined,
        rating: typeof e.newPowerRating === 'number' ? e.newPowerRating : undefined,
        effectiveDate: e.effectiveDate,
        reasonCode: e.reasonCode || undefined,
      }));

    // Same date, same player: a tier move is recorded before the rating
    // decision that accompanies it. Sorting by event type alphabetically put
    // CLUB_RATING_REASSESSMENT before PROMOTION -- backwards from how a board
    // makes the decision, and enough to stop the record reproducing itself.
    // A superseded decision stays in the record -- deleting it would destroy
    // the audit trail of what the club originally decided -- but it is not
    // replayed. Only the event that replaced it is.
    const superseded = {};
    (journey || []).forEach((e) => { if (e.supersedes) superseded[e.supersedes] = true; });

    const events = (journey || [])
      .filter((e) => e.eventType !== INIT && e.eventType !== MATCH)
      .filter((e) => !superseded[e.id])
      .sort((a, b) => {
        if (a.effectiveDate !== b.effectiveDate) return a.effectiveDate < b.effectiveDate ? -1 : 1;
        const ra = Review.eventRank(a.eventType), rb = Review.eventRank(b.eventType);
        if (ra !== rb) return ra - rb;
        return String(a.playerId || '').localeCompare(String(b.playerId || ''));
      })
      .map((e) => {
        const input = {
          playerId: e.playerId,
          eventType: e.eventType,
          effectiveDate: e.effectiveDate,
          decisionType: e.decisionType ?? null,
          reasonCode: e.reasonCode ?? null,
          notes: e.notes ?? null,
          createdBy: e.createdBy ?? null,
          recordedAt: e.recordedAt ?? null,
          source: e.source ?? null,
          recommendationRating: e.recommendationRating ?? null,
          recommendationReliability: e.recommendationReliability ?? null,
          recommendationMethodVersion: e.recommendationMethodVersion ?? null,
        };
        input.revision = e.revision ?? null;
        input.supersedes = e.supersedes ?? null;
        if (e.newTier !== null && e.newTier !== undefined) input.newTier = e.newTier;
        // Only when the event actually moved it -- see the note at the top.
        if (typeof e.newPowerRating === 'number' && e.newPowerRating !== e.previousPowerRating) {
          input.newPowerRating = e.newPowerRating;
        }
        if (typeof e.newReliability === 'number' && e.newReliability !== e.previousReliability) {
          input.newReliability = e.newReliability;
          // The exact evidence the event recorded, so the engine does not have
          // to invert reliability to recover it. Both are passed: the engine
          // prefers this one, and newReliability stays for any reader that
          // only understands that.
          if (typeof e.effectiveEvidenceAfter === 'number') {
            input.newEffectiveEvidence = e.effectiveEvidenceAfter;
          }
        }
        return input;
      });

    return { matches: matchInputs, initialisations, events };
  }

  // A player who first appears in an appended match has no initialisation, and
  // the engine refuses to rate a player it has never seen. Rather than invent
  // one silently, this reports them so the caller must decide the tier.
  function unseenPlayers(inputs) {
    const known = {};
    inputs.initialisations.forEach((i) => { known[i.playerId] = true; });
    const missing = {};
    inputs.matches.forEach((m) => {
      [].concat(m.teamA, m.teamB).forEach((n) => {
        if (!known[n]) missing[n] = missing[n] || m.date;
      });
    });
    return Object.entries(missing).map(([playerId, firstDate]) => ({ playerId, firstDate }));
  }

  // change: { type: 'append' | 'appendMany' | 'edit' | 'redate' | 'delete', match?, matches?, matchId? }
  //         (redate: matchId is the old identifier, match the game under its new one)
  //       or: { type: 'clubDecision', events: [...] } -- one or more state
  //           events inserted at a historical date, after which everything that
  //           followed is re-derived.
  // A change may bring players into the record with it (`change.initialisations`):
  // a new player's first game is approved together with the decision about
  // where they start, so the two are written as one. A player already in the
  // record is never initialised twice.
  function applyChange(inputs, change) {
    const out = applyMatchOrDecision(inputs, change);
    const adds = change.initialisations || [];
    if (!adds.length) return out;
    const known = {};
    inputs.initialisations.forEach((i) => { known[i.playerId] = true; });
    adds.forEach((i) => {
      if (!i || !i.playerId || !i.tier) throw new Error('A new player needs a name and a starting tier.');
      if (known[i.playerId]) throw new Error(`${i.playerId} is already in the record.`);
      known[i.playerId] = true;
    });
    return { ...out, initialisations: inputs.initialisations.concat(adds) };
  }

  function applyMatchOrDecision(inputs, change) {
    if (change.type === 'clubDecision') {
      if (!change.events || !change.events.length) throw new Error('No club decision to apply.');
      const superseded = {};
      change.events.forEach((e) => { if (e.supersedes) superseded[e.supersedes] = true; });
      const kept = inputs.events.filter((e) => {
        const id = Store.eventId(e);
        return !superseded[id];
      });
      return { ...inputs, events: kept.concat(change.events) };
    }
    const matches = inputs.matches.slice();
    if (change.type === 'append') {
      if (matches.some((m) => m.id === change.match.id)) {
        throw new Error(`Match ${change.match.id} is already in the record.`);
      }
      matches.push(change.match);
    } else if (change.type === 'appendMany') {
      // An import adds many matches at once. Appending them one plan at a time
      // would replay the season once per match and, worse, would report each
      // one's blast radius against a record the previous append had already
      // moved -- so the numbers shown would not be the numbers written. They
      // go in together and are replayed once.
      if (!change.matches || !change.matches.length) throw new Error('No matches to append.');
      const seen = {};
      matches.forEach((m) => { seen[m.id] = true; });
      change.matches.forEach((m) => {
        if (seen[m.id]) throw new Error(`Match ${m.id} is already in the record.`);
        seen[m.id] = true;
        matches.push(m);
      });
    } else if (change.type === 'editMany') {
      // Several games changed together (games already entered, made into a
      // rotation): one replay, so the numbers shown are the numbers written.
      if (!change.matches || !change.matches.length) throw new Error('No matches to change.');
      change.matches.forEach((m) => {
        const i = matches.findIndex((x) => x.id === m.id);
        if (i === -1) throw new Error(`Match ${m.id} is not in the record.`);
        matches[i] = m;
      });
    } else if (change.type === 'edit') {
      const i = matches.findIndex((m) => m.id === change.match.id);
      if (i === -1) throw new Error(`Match ${change.match.id} is not in the record.`);
      matches[i] = change.match;
    } else if (change.type === 'redate') {
      // A game moved to another date. Its identifier is built from its date,
      // so it leaves under the old one and returns under a new one, in one
      // replay: everything from the earlier of the two dates is re-derived,
      // exactly as a removal and a fresh entry would, but never with the game
      // missing in between.
      const i = matches.findIndex((m) => m.id === change.matchId);
      if (i === -1) throw new Error(`Match ${change.matchId} is not in the record.`);
      if (!change.match || change.match.id === change.matchId) throw new Error('A moved game needs its new identifier.');
      if (matches.some((m) => m.id === change.match.id)) throw new Error(`Match ${change.match.id} is already in the record.`);
      matches.splice(i, 1);
      matches.push(change.match);
    } else if (change.type === 'deleteMany') {
      // A rotation removed: all its pairings go together, in one replay.
      if (!change.matchIds || !change.matchIds.length) throw new Error('No matches to remove.');
      change.matchIds.forEach((id) => {
        const i = matches.findIndex((m) => m.id === id);
        if (i === -1) throw new Error(`Match ${id} is not in the record.`);
        matches.splice(i, 1);
      });
    } else if (change.type === 'delete') {
      const i = matches.findIndex((m) => m.id === change.matchId);
      if (i === -1) throw new Error(`Match ${change.matchId} is not in the record.`);
      matches.splice(i, 1);
    } else {
      throw new Error(`Unknown change type: ${change.type}`);
    }
    return { ...inputs, matches };
  }

  function replayInputs(inputs) {
    return Engine.replay({
      matches: inputs.matches,
      initialisations: inputs.initialisations,
      events: inputs.events,
    });
  }

  // Two documents are the same document when they say the same thing. Two
  // traps make that harder than it sounds, and both were caught by the no-op
  // check rather than by reasoning:
  //
  //   * Firestore returns keys in whatever order the export produced, so
  //     comparing serialised JSON compares key order and calls every document
  //     changed.
  //   * The record was seeded by Node and is replayed in a browser, and their
  //     Math.pow results differ in the last bit. An expectation stored as
  //     0.4803169324020399 replays as 0.48031693240203976. Demanding exact
  //     equality would mean no browser replay could ever verify, and every edit
  //     would rewrite all 817 documents over differences 14 decimal places
  //     below anything the app displays.
  //
  // So: numbers agree within EPSILON, everything else must match exactly. This
  // is far tighter than anything that could reach a screen -- ratings are shown
  // to one decimal place -- while being immune to which engine did the sum.
  const EPSILON = 1e-9;

  function sameValue(a, b) {
    // The store writes null for a field that does not apply, and a document
    // stored before a field existed simply has no key. Both mean the same
    // thing, and treating them as different made every pre-existing document
    // differ from its own rebuild the moment a field was added to the schema.
    if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
    if (typeof a === 'number' && typeof b === 'number') {
      return a === b || Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
      return ka.length === kb.length && ka.every((k, i) => k === kb[i]) && ka.every((k) => sameValue(a[k], b[k]));
    }
    return a === b;
  }

  function sameDoc(a, b) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.every((k) => sameValue(a[k], b[k]));
  }

  const PROVENANCE_FIELDS = ['createdBy', 'recordedAt', 'source'];

  // A replay reconstructs ENGINE state. It must not destroy fields it does not
  // own -- and a player's display name is not engine state, it is a label the
  // engine has never heard of. Without this, the first replay after a rename
  // rebuilds the player document without its name, `verifyNoOp` reports it as a
  // difference, and the app then refuses every match edit because the record
  // no longer appears to replay to itself. The same would be true of any field
  // added to a player document later, which is why the list is a constant here
  // rather than a special case for renaming.
  // Fields an admin sets on a player's record that no replay can derive: the
  // name, and their standing in the group (playerStatus.js). Carried over as
  // stored, so an approval or a correction never resets them.
  const PLAYER_LABEL_FIELDS = ['displayName', 'previousDisplayNames', 'status', 'statusChangedAt', 'statusChangedBy'];

  // The matches written are the ones replayed, taken from the inputs. Deriving
  // them from the replay's own records would be re-reading the engine's working
  // rather than the history it was given.
  //
  // `keepProvenanceFrom` carries each existing event's original attribution
  // forward. An event that already happened was not created by whoever is
  // editing now, and restamping it would rewrite who recorded the whole season
  // -- which also made every document differ, so every edit looked like a full
  // rebuild.
  function docsOf(inputs, replay, provenance, keepProvenanceFrom, keepLabelsFrom) {
    // applyStateEvent builds its own return shape and does not carry `revision`
    // or `supersedes` through. Without re-attaching them the superseding
    // correction is written with the BASE id and overwrites the very decision
    // it was supposed to sit beside -- silently destroying the audit trail the
    // supersession model exists to protect. The engine is frozen, so the fields
    // are restored here from the inputs that produced each event.
    const pending = {};
    (inputs.events || []).forEach((e) => {
      if (e.revision === null && e.supersedes === null) return;
      if (e.revision === undefined && e.supersedes === undefined) return;
      const key = `${e.playerId}|${e.effectiveDate}|${e.eventType}`;
      (pending[key] = pending[key] || []).push(e);
    });
    const taken = {};
    (replay.journey || []).forEach((ev) => {
      if (ev.eventType === MATCH || ev.eventType === INIT) return;
      const key = `${ev.playerId}|${ev.effectiveDate}|${ev.eventType}`;
      const list = pending[key];
      if (!list || !list.length) return;
      const i = taken[key] || 0;
      const src = list[i];
      if (!src) return;
      taken[key] = i + 1;
      if (src.revision) ev.revision = src.revision;
      if (src.supersedes) ev.supersedes = src.supersedes;
    });

    const plan = Store.buildWritePlan({
      matches: inputs.matches,
      journey: replay.journey,
      state: replay.state,
      provenance,
    });
    if (keepProvenanceFrom) {
      const original = {};
      (keepProvenanceFrom || []).forEach((d) => { original[d.id] = d; });
      plan[Store.COLLECTIONS.journey].forEach((d) => {
        const was = original[d.id];
        if (!was) return;
        PROVENANCE_FIELDS.forEach((f) => { if (was[f] !== undefined) d[f] = was[f]; });
      });
    }
    if (keepLabelsFrom) {
      const original = {};
      (keepLabelsFrom || []).forEach((d) => { original[d.id] = d; });
      plan[Store.COLLECTIONS.players].forEach((d) => {
        const was = original[d.id];
        if (!was) return;
        PLAYER_LABEL_FIELDS.forEach((f) => { if (was[f] !== undefined) d[f] = was[f]; });
      });
    }
    return plan;
  }

  // Compares two sets of documents by id and reports what actually changed.
  // Only the differences are written: a replay that rewrote all 817 documents
  // to change one would make every edit look like a database rebuild and hide
  // what really moved.
  function diffDocs(before, after) {
    const writes = {}, deletes = {};
    let changed = 0, removed = 0;
    Object.keys(after).forEach((collection) => {
      const was = {};
      (before[collection] || []).forEach((d) => { was[d.id] = d; });
      const now = {};
      (after[collection] || []).forEach((d) => { now[d.id] = d; });

      writes[collection] = (after[collection] || []).filter((d) => {
        const prior = was[d.id];
        return !prior || !sameDoc(prior, d);
      });
      deletes[collection] = Object.keys(was).filter((id) => !now[id]);
      changed += writes[collection].length;
      removed += deletes[collection].length;
    });
    return { writes, deletes, changed, removed };
  }

  // The precondition: replaying the stored inputs unchanged must reproduce the
  // stored documents exactly. Anything else means the record and the engine have
  // diverged, and no change may be planned on top of that.
  function verifyNoOp(stored, provenance) {
    const inputs = inputsFromRecord(stored);
    const rebuilt = docsOf(inputs, replayInputs(inputs), provenance, stored.journey, stored.players);
    const storedDocs = {
      [Store.COLLECTIONS.matches]: stored.matches || [],
      [Store.COLLECTIONS.journey]: stored.journey || [],
      [Store.COLLECTIONS.players]: stored.players || [],
    };
    const d = diffDocs(storedDocs, rebuilt);
    // A superseded decision is stored but not replayed, so it is absent from a
    // rebuild by design. Counting it as a difference would mean any record
    // containing a correction could never verify again.
    const supersededIds = {};
    (stored.journey || []).forEach((e) => { if (e && e.supersedes) supersededIds[e.supersedes] = true; });

    const differences = [];
    Object.entries(d.writes).forEach(([c, docs]) => docs.forEach((doc) => differences.push(`${c}/${doc.id} differs`)));
    Object.entries(d.deletes).forEach(([c, ids]) => ids.forEach((id) => {
      if (supersededIds[id]) return;
      differences.push(`${c}/${id} would disappear`);
    }));
    return { identical: differences.length === 0, differences: differences.slice(0, 40), count: differences.length };
  }

  // A record whose stored state no longer agrees with a replay of its own
  // history cannot be edited: plan() refuses, and that refusal is right --
  // planning an edit on top of a disagreement would build on numbers the
  // history does not support.
  //
  // This is the way back. It builds the WRITE-ONLY plan that brings the record
  // into agreement with its own inputs: the documents a completed replay would
  // have written. It changes no input. The matches are the record; everything
  // it rewrites is derived from them, so applying it is not a decision about
  // what happened, only about finishing the arithmetic.
  //
  // Written for the failure this was found by: a replay that wrote part of its
  // output and stopped, leaving the tail of the journey and the player state
  // holding pre-change values. `wouldDelete` is reported rather than acted on,
  // because a repair that needs to delete something is not a partial write and
  // the caller should stop and look at it.
  function planRepair(stored, provenance) {
    const inputs = inputsFromRecord(stored);
    const rebuilt = docsOf(inputs, replayInputs(inputs), provenance || {}, stored.journey, stored.players);
    const storedDocs = {
      [Store.COLLECTIONS.matches]: stored.matches || [],
      [Store.COLLECTIONS.journey]: stored.journey || [],
      [Store.COLLECTIONS.players]: stored.players || [],
    };
    const d = diffDocs(storedDocs, rebuilt);

    // A superseded decision is stored but never replayed, so a rebuild does not
    // contain it. It must not be deleted -- the whole point of superseding
    // rather than overwriting is that the original stays in the record.
    const supersededIds = {};
    (stored.journey || []).forEach((e) => { if (e && e.supersedes) supersededIds[e.supersedes] = true; });
    const wouldDelete = [];
    Object.entries(d.deletes).forEach(([c, ids]) => ids.forEach((id) => {
      if (!supersededIds[id]) wouldDelete.push(`${c}/${id}`);
    }));

    const was = {};
    (stored.players || []).forEach((p) => { was[p.id] = p; });
    const moved = [];
    (rebuilt[Store.COLLECTIONS.players] || []).forEach((p) => {
      const prior = was[p.id];
      if (!prior) { moved.push({ playerId: p.id, from: null, to: p.rating, delta: null }); return; }
      if (Math.abs(prior.rating - p.rating) > EPSILON) {
        moved.push({ playerId: p.id, from: prior.rating, to: p.rating, delta: Math.round((p.rating - prior.rating) * 10) / 10 });
      }
    });
    moved.sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0));

    return {
      writes: d.writes,
      deletes: {},
      documentsToWrite: d.changed,
      documentsToDelete: 0,
      wouldDelete,
      playersMoved: moved,
      staleByCollection: Object.fromEntries(Object.entries(d.writes).map(([c, docs]) => [c, docs.length])),
    };
  }

  // The whole plan for one change: what to write, what to delete, and which
  // players' ratings move as a result. Refuses outright if a no-op replay does
  // not already reproduce the record.
  function plan({ stored, change, provenance }) {
    const check = verifyNoOp(stored, provenance);
    if (!check.identical) {
      // The document ids are carried on the error rather than concatenated
      // into it. Which of them anyone should be shown is the caller's decision:
      // the board holds an admin password too, and forty document ids tell them
      // nothing they can act on.
      const err = new Error(
        'Replaying the record unchanged does not reproduce it (' + check.count + ' difference(s)). ' +
        'The stored ratings and the stored history have diverged, so no edit can be planned on top of them.');
      err.differences = check.differences;
      err.divergence = check;
      throw err;
    }

    const inputs = inputsFromRecord(stored);
    const changed = applyChange(inputs, change);

    const unseen = unseenPlayers(changed);
    if (unseen.length) {
      const err = new Error('These players have never been initialised, so they have no rating to move: '
        + unseen.map((u) => `${u.playerId} (first appears ${u.firstDate})`).join(', ')
        + '. Initialise them with a starting tier first.');
      err.unseen = unseen;
      throw err;
    }

    const beforeDocs = docsOf(inputs, replayInputs(inputs), provenance, stored.journey, stored.players);
    const afterReplay = replayInputs(changed);
    const afterDocs = docsOf(changed, afterReplay, provenance, stored.journey, stored.players);
    const d = diffDocs(beforeDocs, afterDocs);

    // A superseded decision is deliberately not replayed, which makes it look
    // orphaned to the diff. It must NOT be deleted: the whole point of
    // superseding rather than overwriting is that what the club originally
    // decided stays in the record. Only the replay stops honouring it.
    const supersededIds = {};
    [].concat(stored.journey || [], afterDocs[Store.COLLECTIONS.journey] || [])
      .forEach((e) => { if (e && e.supersedes) supersededIds[e.supersedes] = true; });
    d.deletes[Store.COLLECTIONS.journey] = (d.deletes[Store.COLLECTIONS.journey] || [])
      .filter((id) => !supersededIds[id]);
    d.removed = Object.values(d.deletes).reduce((n, ids) => n + ids.length, 0);

    // Who this actually moves, and by how much. An edit to one June match can
    // reach dozens of people through later pairings, and the operator should
    // see that before agreeing to it.
    const moved = [];
    const was = {};
    (beforeDocs[Store.COLLECTIONS.players] || []).forEach((p) => { was[p.id] = p; });
    (afterDocs[Store.COLLECTIONS.players] || []).forEach((p) => {
      const prior = was[p.id];
      if (!prior) { moved.push({ playerId: p.id, from: null, to: p.rating, delta: null }); return; }
      if (Math.abs(prior.rating - p.rating) > 1e-9) {
        moved.push({ playerId: p.id, from: prior.rating, to: p.rating, delta: Math.round((p.rating - prior.rating) * 10) / 10 });
      }
    });
    moved.sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0));

    return {
      change,
      writes: d.writes,
      deletes: d.deletes,
      documentsToWrite: d.changed,
      documentsToDelete: d.removed,
      playersMoved: moved,
      replay: afterReplay,
    };
  }

  // Firestore's cap on the number of operations in one batched write.
  const BATCH_LIMIT = 500;

  // Removing one June match rewrites ~500 documents. Sending them one at a time
  // meant ~500 sequential round trips: on a phone that is minutes of apparently
  // nothing happening, which is how an operator concludes the button is broken
  // and starts pressing things. A backend that can batch does it in two.
  //
  // `onProgress(done, total)` is called before the first operation and after
  // each batch, so the caller can say how far along it is against a number the
  // confirmation panel already showed.
  async function commit(backend, planned, { onProgress } = {}) {
    // Deletions first: a removed match's events must not linger beside the
    // rewritten ones, where a reader would see both.
    const ops = [];
    for (const [collection, ids] of Object.entries(planned.deletes)) {
      for (const id of ids) ops.push({ op: 'delete', collection, id });
    }
    for (const [collection, docs] of Object.entries(planned.writes)) {
      for (const doc of docs) ops.push({ op: 'set', collection, id: doc.id, doc });
    }

    // diffDocs derives deletions as "in the record before, absent after", so a
    // deleted id can never also be written and the two sets are disjoint. A
    // batch applies its operations atomically rather than in sequence, so if
    // that ever stopped being true the delete-then-write ordering above would
    // quietly stop meaning anything. Checked rather than assumed.
    const writeKeys = new Set(ops.filter((o) => o.op === 'set').map((o) => o.collection + '/' + o.id));
    const clash = ops.find((o) => o.op === 'delete' && writeKeys.has(o.collection + '/' + o.id));
    if (clash) throw new Error(`plan both deletes and writes ${clash.collection}/${clash.id}`);

    const total = ops.length;
    let done = 0;
    if (onProgress) onProgress(done, total);

    const run = async (chunk) => {
      if (backend.commitBatch) await backend.commitBatch(chunk);
      else {
        for (const o of chunk) {
          if (o.op === 'delete') await backend.remove(o.collection, o.id);
          else await backend.set(o.collection, o.id, o.doc);
        }
      }
      done += chunk.length;
      if (onProgress) onProgress(done, total);
    };

    // A backend with no batching still reports progress usefully, so the
    // fallback path steps one operation at a time rather than in blocks of 500.
    const step = backend.commitBatch ? BATCH_LIMIT : 1;
    for (let i = 0; i < ops.length; i += step) await run(ops.slice(i, i + step));

    return {
      written: ops.filter((o) => o.op === 'set').length,
      deleted: ops.filter((o) => o.op === 'delete').length,
    };
  }

  return { inputsFromRecord, applyChange, plan, planRepair, commit, verifyNoOp, diffDocs, unseenPlayers, sameDoc, EPSILON, BATCH_LIMIT };
});
