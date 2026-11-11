// ===================== v3 READ LAYER =====================
// The single point where the existing application obtains v3 state.
//
// Reads the compact `players` collection only. It must NEVER reconstruct
// current state by scanning `ratingJourney` -- that collection is 633 documents
// and growing ~120 a month, and is for journey/event views alone.
//
// FAILURE IS LOUD. If the read fails, a document is missing, or a field is
// malformed, this reports it and the application shows an unavailable state.
// It never falls back to 1400, to the legacy solver, to a tier seed, or to a
// reconstructed value. A believable but wrong number is worse than a gap.

(function (root, factory) {
  const api = factory(
    typeof require === 'function' ? require('./ratingEngine.js') : root.RatingEngine,
    typeof require === 'function' ? require('./playerNames.js') : root.PlayerNames);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.V3Bridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Engine, Names) {
  'use strict';

  const REQUIRED_FIELDS = ['id', 'rating', 'effectiveEvidence', 'lifetimeMatches', 'tier', 'classificationStatus'];

  // Presentation bands, derived from Reliability -- never from match count,
  // because a club reassessment can change effective evidence independently of
  // lifetime matches, and a count-based label would misreport such a player.
  function reliabilityBand(reliability) {
    const pct = reliability * 100;
    if (pct < 25) return 'Provisional';
    if (pct < 50) return 'Developing';
    if (pct < 75) return 'Established';
    return 'High Reliability';
  }

  function validatePlayerDoc(doc) {
    const problems = [];
    REQUIRED_FIELDS.forEach((f) => {
      if (doc[f] === undefined || doc[f] === null) problems.push(`missing ${f}`);
    });
    if (typeof doc.rating === 'number' && !Number.isFinite(doc.rating)) problems.push('rating is not finite');
    if (typeof doc.effectiveEvidence === 'number' && doc.effectiveEvidence < 0) problems.push('negative effectiveEvidence');
    if (doc.tier && !(doc.tier in Engine.TIER_SEED)) problems.push(`unknown tier ${doc.tier}`);
    return problems;
  }

  function createState() {
    return { loaded: false, error: null, players: {}, playersById: {}, alias: null, playerCount: 0, loadedAt: null, problems: [] };
  }

  // backend: anything with getAll(collection). Browser passes a Firestore
  // compat backend; tests pass an in-memory one.
  // `allowEmpty`: a community that has not played yet (config/club.js
  // recordStartsEmpty) has an empty record, which is a start, not a failed
  // read. For a community with a record, empty still means something broke.
  async function load(backend, { allowEmpty } = {}) {
    const state = createState();
    let docs;
    try {
      docs = await backend.getAll('players');
    } catch (e) {
      state.error = 'Could not read v3 player state: ' + (e && e.message ? e.message : String(e));
      return state;
    }
    if ((!docs || docs.length === 0) && !allowEmpty) {
      state.error = 'The v3 players collection is empty. Has the backfill been run?';
      return state;
    }
    docs = docs || [];
    // The documents exactly as stored, kept beside the shapes the app uses.
    // Verifying that the record still replays to itself needs the stored form,
    // and re-reading 34 documents to get back what was just read would be a
    // read budget spent on nothing.
    state.rawPlayerDocs = docs;
    // A name is a label; `id` is the identity and never changes. The app above
    // this line works entirely in labels, so the translation happens here,
    // once, and `rawPlayerDocs` keeps the stored form for the replay verifier.
    state.alias = Names.buildAlias(docs);
    docs.forEach((d) => {
      const problems = validatePlayerDoc(d);
      if (problems.length) {
        state.problems.push(`${d.id || '(no id)'}: ${problems.join(', ')}`);
        return;
      }
      const shown = Names.displayFor(d);
      // The same state twice, under both keys. The app reads `players` and
      // talks in labels; anything preparing a document for the record reads
      // `playersById` and talks in identities. Building both here means no
      // call site has to remember to convert -- it picks the map that matches
      // what it is about to do.
      state.playersById[d.id] = {
        name: d.id,
        playerId: d.id,
        rating: d.rating,
        reliability: Engine.reliability(d.effectiveEvidence),
        reliabilityBand: reliabilityBand(Engine.reliability(d.effectiveEvidence)),
        effectiveEvidence: d.effectiveEvidence,
        lifetimeMatches: d.lifetimeMatches,
        tier: d.tier,
        classificationStatus: d.classificationStatus,
        ratingModelVersion: d.ratingModelVersion || null,
      };
      state.players[shown] = {
        name: shown,
        playerId: d.id,
        previousDisplayNames: d.previousDisplayNames || [],
        // The player's standing in the group (playerStatus.js), as stored; null
        // when the record has none, which reads as the legacy flag or active.
        status: d.status || null,
        rating: d.rating,
        reliability: Engine.reliability(d.effectiveEvidence),
        reliabilityBand: reliabilityBand(Engine.reliability(d.effectiveEvidence)),
        effectiveEvidence: d.effectiveEvidence,
        lifetimeMatches: d.lifetimeMatches,
        tier: d.tier,
        classificationStatus: d.classificationStatus,
        ratingModelVersion: d.ratingModelVersion || null,
      };
    });
    state.playerCount = Object.keys(state.players).length;
    if (state.problems.length) {
      state.error = `${state.problems.length} v3 player document(s) are malformed: ` + state.problems.join(' | ');
      return state;
    }
    state.loaded = true;
    state.loadedAt = new Date().toISOString();
    return state;
  }

  // Converts a stored v3 match into the shape the existing application reads.
  // Team A is the winning side for every decided match; a draw carries isDraw
  // and its side assignment is arbitrary but fixed.
  //
  // A forfeit (doc.forfeit): the player who quit is on the losing side; his
  // partner is left out of the sides here, so every record, table, head to
  // head and partnership counts the match for the three it affects and not
  // for him. `forfeit` says who quit and who was left out, for display.
  //
  // Late (doc.late): the match as counted -- the late side a set down. The
  // late player's on-time partner is rated on the match as played, so, as
  // with a forfeit, he is left out of the sides and every table; `late` says
  // who was late, who was on time and how it was played, for display.
  function toLegacyMatchShape(doc, alias) {
    const isDraw = doc.outcome === Engine.OUTCOME.DRAW;
    const out = new Set(((doc.forfeit && doc.forfeit.unaffected) || []).concat((doc.late && doc.late.onTime) || []));
    const shape = {
      id: doc.id,
      date: doc.date,
      sourceIndex: doc.sourceIndex,
      winners: Names.mapTeam(alias, doc.teamA.filter((n) => !out.has(n))),
      losers: Names.mapTeam(alias, doc.teamB.filter((n) => !out.has(n))),
      sets: doc.sets.map((s) => [s.teamA, s.teamB]),
      type: doc.type || 'doubles',
      note: '',
      verified: true,
      isDraw: isDraw,
      _v3: true,
    };
    if (doc.forfeit) {
      shape.forfeit = { by: Names.mapTeam(alias, [doc.forfeit.by])[0], unaffected: Names.mapTeam(alias, doc.forfeit.unaffected || []) };
    }
    if (doc.late) {
      const by = doc.late.by || [];
      shape.late = { by: Names.mapTeam(alias, by), onTime: Names.mapTeam(alias, doc.late.onTime || []),
        lateSide: doc.teamA.some((n) => by.includes(n)) ? 'A' : 'B', playedOutcome: doc.late.playedOutcome };
    }
    return shape;
  }

  // Ordering is pinned to (date, sourceIndex) exactly as the engine orders it,
  // so the application and the rating it displays walk the same sequence.
  // `collect`, when given, receives the documents as stored -- the shape the
  // replay verifier needs, which the legacy shape below has already lost.
  async function loadMatches(backend, collect, alias, { allowEmpty } = {}) {
    const docs = (await backend.getAll('matches')) || [];
    if (docs.length === 0 && !allowEmpty) throw new Error('The v3 matches collection is empty.');
    if (collect) collect.raw = docs;
    return docs
      .map((d) => toLegacyMatchShape(d, alias))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sourceIndex - b.sourceIndex));
  }

  // The Rating Journey. Read once per session for the monthly views, never for
  // ordinary player state -- that still comes from the compact `players`
  // collection. 633 documents today, growing ~120 a month.
  async function loadJourney(backend, collect, alias, { allowEmpty } = {}) {
    const docs = (await backend.getAll('ratingJourney')) || [];
    if (docs.length === 0 && !allowEmpty) throw new Error('The ratingJourney collection is empty.');
    if (collect) collect.raw = docs;
    // Every screen that reads the journey -- the Rating Journey, the monthly
    // views, tier history, match facts -- looks a player up by what they are
    // called. The document id is deliberately NOT rewritten: it is the record's
    // own key and the verifier compares against `collect.raw`.
    if (!alias) return docs;
    return docs.map((d) => (
      Object.prototype.hasOwnProperty.call(alias.toDisplay || {}, d.playerId)
        ? { ...d, playerId: alias.toDisplay[d.playerId] }
        : d));
  }

  // The map buildPlayers() consumes: name -> Power Rating. Reading this when
  // state has not loaded is a programming error, not a reason to substitute.
  function ratingsMap(state) {
    if (!state.loaded) throw new Error('v3 state is not loaded; there is no rating to supply.');
    const out = {};
    Object.values(state.players).forEach((p) => { out[p.name] = p.rating; });
    return out;
  }

  function tierMap(state) {
    if (!state.loaded) throw new Error('v3 state is not loaded; there is no tier to supply.');
    const out = {};
    Object.values(state.players).forEach((p) => { out[p.name] = p.tier; });
    return out;
  }

  // Attaches v3 fields to an existing PLAYERS[] entry plus, separately, the
  // frozen production comparison. The two never derive from one another.
  function decoratePlayer(player, state, snapshotIndex) {
    const v3 = state.players[player.name];
    if (!v3) {
      player.v3Missing = true;
      return player;
    }
    player.v3Rating = v3.rating;
    player.reliability = v3.reliability;
    player.reliabilityPct = Math.round(v3.reliability * 1000) / 10;
    player.reliabilityBand = v3.reliabilityBand;
    player.effectiveEvidence = v3.effectiveEvidence;
    player.lifetimeMatches = v3.lifetimeMatches;
    player.classificationStatus = v3.classificationStatus;
    player.ratingModelVersion = v3.ratingModelVersion;
    // The frozen identity behind the label, so anything about to touch the
    // record can find it without going back through the alias map.
    player.playerId = v3.playerId || player.name;
    player.previousDisplayNames = v3.previousDisplayNames || [];
    player.storedStatus = v3.status || null;

    // The export's only join key is the name as it was when the snapshot was
    // frozen -- which is the player's id, not whatever they are called now.
    const snap = snapshotIndex ? snapshotIndex[v3.playerId || player.name] : null;
    player.productionSnapshotRating = snap ? snap.power_rating : null;
    player.productionSnapshotMissing = !snap;
    player.productionVsV3 = snap ? Math.round((v3.rating - snap.power_rating) * 10) / 10 : null;
    return player;
  }

  // Name is the only join key: every player_id in the export is null.
  function indexSnapshot(snapshot) {
    const index = {};
    (snapshot && snapshot.players ? snapshot.players : []).forEach((p) => { index[p.name] = p; });
    return index;
  }

  function reconcileSnapshot(state, snapshot) {
    const index = indexSnapshot(snapshot);
    const v3Names = Object.keys(state.players);
    const snapNames = Object.keys(index);
    return {
      exportedAt: snapshot && snapshot.snapshot_metadata ? snapshot.snapshot_metadata.export_timestamp_utc : null,
      inV3NotSnapshot: v3Names.filter((n) => !index[n]),
      inSnapshotNotV3: snapNames.filter((n) => !state.players[n]),
      matched: v3Names.filter((n) => index[n]).length,
    };
  }

  return {
    createState, load, loadMatches, loadJourney, toLegacyMatchShape, ratingsMap, tierMap, decoratePlayer,
    indexSnapshot, reconcileSnapshot, reliabilityBand, validatePlayerDoc, REQUIRED_FIELDS,
  };
});
