// ===================== SEQUENTIAL RATING ENGINE (sequential-v1) =====================
// The single authoritative implementation of Money Padel Prestige v3 match
// mathematics. Pure: no DOM, no Firestore, no app globals. Loaded as a plain
// script in the browser and required directly by the Node test suite.
//
// Nothing in here may be duplicated elsewhere (Rankings, Profiles, Matchups,
// Admin all call into this). Recommendation logic lives in a separate,
// versioned module -- it must never be entangled with match mathematics.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RatingEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RATING_MODEL_VERSION = 'sequential-v1';

  const KMAX = 40;
  const KMIN = 10;
  const RC = 10;

  const TIER_SEED = { S: 2000, A: 1700, B: 1400, C: 1100 };

  const GAME_SHARE_WEIGHT = 0.80;
  const MATCH_RESULT_WEIGHT = 0.20;

  const OUTCOME = { A_WINS: 'A_WINS', B_WINS: 'B_WINS', DRAW: 'DRAW' };

  const CLASSIFICATION = { PROVISIONAL: 'PROVISIONAL', ESTABLISHED: 'ESTABLISHED' };

  const EVENT = {
    PLAYER_INITIALISED: 'PLAYER_INITIALISED',
    MATCH_UPDATE: 'MATCH_UPDATE',
    INITIAL_CLASSIFICATION_CONFIRMED: 'INITIAL_CLASSIFICATION_CONFIRMED',
    INITIAL_CLASSIFICATION_CORRECTION: 'INITIAL_CLASSIFICATION_CORRECTION',
    PROMOTION: 'PROMOTION',
    DEMOTION: 'DEMOTION',
    TIER_RETAINED: 'TIER_RETAINED',
    CLUB_RATING_REASSESSMENT: 'CLUB_RATING_REASSESSMENT',
  };

  // ---------- Reliability & K ----------

  function reliability(effectiveEvidence) {
    return effectiveEvidence / (effectiveEvidence + RC);
  }

  function kFactor(rel) {
    return KMIN + (KMAX - KMIN) * (1 - rel);
  }

  function kForEvidence(effectiveEvidence) {
    return kFactor(reliability(effectiveEvidence));
  }

  // Inverse of reliability(): what effective evidence does a target reliability
  // imply? A Reliability override must move real evidence, or it would not
  // change future K at all.
  function effectiveEvidenceForReliability(targetReliability) {
    if (targetReliability <= 0) return 0;
    if (targetReliability >= 1) throw new Error('Reliability must be < 1 (asymptotic).');
    return (RC * targetReliability) / (1 - targetReliability);
  }

  // ---------- Match mathematics (§3) ----------

  function pairRating(team, ratingOf) {
    if (!team.length) throw new Error('Team must have at least one player.');
    return team.reduce((sum, p) => sum + ratingOf(p), 0) / team.length;
  }

  function expectedScore(pairRatingA, pairRatingB) {
    return 1 / (1 + Math.pow(10, (pairRatingB - pairRatingA) / 400));
  }

  // sets are recorded from Team A's perspective: [gamesA, gamesB].
  function gameShares(sets) {
    const gamesA = sets.reduce((s, set) => s + set[0], 0);
    const gamesB = sets.reduce((s, set) => s + set[1], 0);
    const total = gamesA + gamesB;
    if (!total) return { gamesA, gamesB, shareA: 0.5, shareB: 0.5 };
    return { gamesA, gamesB, shareA: gamesA / total, shareB: gamesB / total };
  }

  function matchResultScores(outcome) {
    if (outcome === OUTCOME.A_WINS) return { a: 1.0, b: 0.0 };
    if (outcome === OUTCOME.B_WINS) return { a: 0.0, b: 1.0 };
    if (outcome === OUTCOME.DRAW) return { a: 0.5, b: 0.5 };
    throw new Error('Unknown outcome: ' + outcome);
  }

  // The one definition of actual score. Drives both Power Rating updates and
  // Monthly Performance -- Monthly Performance must never use raw game share.
  function actualScores(sets, outcome) {
    const { shareA, shareB } = gameShares(sets);
    const res = matchResultScores(outcome);
    return {
      a: GAME_SHARE_WEIGHT * shareA + MATCH_RESULT_WEIGHT * res.a,
      b: GAME_SHARE_WEIGHT * shareB + MATCH_RESULT_WEIGHT * res.b,
    };
  }

  // ---------- Player state ----------

  function initialisePlayer({ tier, classificationStatus, rating }) {
    const seed = rating !== undefined ? rating : TIER_SEED[tier];
    if (seed === undefined) throw new Error('Unknown tier: ' + tier);
    return {
      rating: seed,
      effectiveEvidence: 0,
      lifetimeMatches: 0,
      tier: tier,
      classificationStatus: classificationStatus || CLASSIFICATION.ESTABLISHED,
    };
  }

  // ---------- The authoritative match update (§3.5, §6) ----------

  function processMatch(state, match) {
    const { id, date, teamA, teamB, sets, outcome } = match;
    const ratingOf = (name) => {
      if (!state[name]) throw new Error('Player not initialised before match ' + id + ': ' + name);
      return state[name].rating;
    };

    const prA = pairRating(teamA, ratingOf);
    const prB = pairRating(teamB, ratingOf);
    const expA = expectedScore(prA, prB);
    const expB = 1 - expA;
    const actual = actualScores(sets, outcome);

    const residualA = actual.a - expA;
    const residualB = actual.b - expB; // === -residualA

    const events = [];

    function applyTo(team, teamResidual, teamExpected, teamActual, side) {
      team.forEach((name) => {
        const s = state[name];
        const preMatchRating = s.rating;
        const evidenceBefore = s.effectiveEvidence;
        const relBefore = reliability(evidenceBefore);
        const kUsed = kFactor(relBefore); // K comes from PRE-match evidence
        const ratingDelta = kUsed * teamResidual;

        s.rating = preMatchRating + ratingDelta;
        s.effectiveEvidence = evidenceBefore + 1;
        s.lifetimeMatches = s.lifetimeMatches + 1;

        events.push({
          playerId: name,
          eventType: EVENT.MATCH_UPDATE,
          effectiveDate: date,
          matchId: id,
          side: side,
          preMatchRating: preMatchRating,
          preMatchExpectedScore: teamExpected, // persisted: §6 step 5, mandatory
          actualScore: teamActual,
          performanceResidual: teamResidual,
          kUsed: kUsed,
          ratingDelta: ratingDelta,
          postMatchRating: s.rating,
          previousReliability: relBefore,
          newReliability: reliability(s.effectiveEvidence),
          effectiveEvidenceBefore: evidenceBefore,
          effectiveEvidenceAfter: s.effectiveEvidence,
          lifetimeMatchesAtEvent: s.lifetimeMatches,
          tierAtEvent: s.tier,
          ratingModelVersion: RATING_MODEL_VERSION,
        });
      });
    }

    applyTo(teamA, residualA, expA, actual.a, 'A');
    applyTo(teamB, residualB, expB, actual.b, 'B');

    return {
      matchId: id,
      date: date,
      pairRatingA: prA,
      pairRatingB: prB,
      expectedA: expA,
      expectedB: expB,
      actualA: actual.a,
      actualB: actual.b,
      residualA: residualA,
      residualB: residualB,
      events: events,
    };
  }

  // ---------- Deterministic ordering (§6.1) ----------

  // Source data has date granularity only and many matches share a date.
  // Retrieval order must never decide ratings, so ties break on an explicit
  // stable key: the match's position in the declared source order.
  // A match that carries its own `sourceIndex` (derived from its permanent
  // match id) is ordered by that, so retrieval order cannot reach the result at
  // all. Array position is only the fallback for matches without one.
  function orderMatches(matches) {
    return matches
      .map((m, position) => ({ m, key: m.sourceIndex === undefined ? position : m.sourceIndex }))
      .sort((x, y) => {
        if (x.m.date < y.m.date) return -1;
        if (x.m.date > y.m.date) return 1;
        return x.key - y.key;
      })
      .map((x) => x.m);
  }

  // ---------- Chronological replay (§6) ----------

  // events: timestamped, forward-only state transitions (reassessments, tier
  // changes) applied in date order relative to matches. A reassessment
  // effective at the start of a month lands after the previous month's last
  // match and before the new month's first.
  function replay({ matches, initialisations, events }) {
    const state = {};
    const journey = [];
    const matchRecords = [];

    (initialisations || []).forEach((init) => {
      state[init.playerId] = initialisePlayer(init);
      journey.push({
        playerId: init.playerId,
        eventType: EVENT.PLAYER_INITIALISED,
        effectiveDate: init.effectiveDate || null,
        newTier: init.tier,
        newClassificationStatus: state[init.playerId].classificationStatus,
        newPowerRating: state[init.playerId].rating,
        newReliability: 0,
        effectiveEvidenceAfter: 0,
        lifetimeMatchesAtEvent: 0,
        reasonCode: init.reasonCode || null,
        ratingModelVersion: RATING_MODEL_VERSION,
      });
    });

    const ordered = orderMatches(matches);
    const pendingEvents = (events || [])
      .slice()
      .sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : a.effectiveDate > b.effectiveDate ? 1 : 0));

    let ei = 0;
    function drainEventsBefore(date) {
      while (ei < pendingEvents.length && pendingEvents[ei].effectiveDate <= date) {
        journey.push(applyStateEvent(state, pendingEvents[ei]));
        ei++;
      }
    }

    ordered.forEach((m) => {
      drainEventsBefore(m.date);
      const rec = processMatch(state, m);
      matchRecords.push(rec);
      rec.events.forEach((e) => journey.push(e));
    });
    while (ei < pendingEvents.length) {
      journey.push(applyStateEvent(state, pendingEvents[ei]));
      ei++;
    }

    return { state: state, journey: journey, matchRecords: matchRecords };
  }

  // A tier change alone is Power Rating change = 0 and Reliability change = 0.
  function applyStateEvent(state, ev) {
    const s = state[ev.playerId];
    if (!s) throw new Error('Event for uninitialised player: ' + ev.playerId);

    const before = {
      tier: s.tier,
      classificationStatus: s.classificationStatus,
      rating: s.rating,
      reliability: reliability(s.effectiveEvidence),
      effectiveEvidence: s.effectiveEvidence,
    };

    if (ev.eventType === EVENT.INITIAL_CLASSIFICATION_CORRECTION &&
        s.classificationStatus !== CLASSIFICATION.PROVISIONAL) {
      throw new Error('INITIAL_CLASSIFICATION_CORRECTION requires PROVISIONAL status: ' + ev.playerId);
    }

    if (ev.newTier !== undefined) s.tier = ev.newTier;

    // Rating/evidence move only when the event explicitly carries them.
    if (ev.newPowerRating !== undefined) s.rating = ev.newPowerRating;
    // Evidence is the exact quantity; reliability is derived from it. When an
    // event carries both, the exact one wins. Preferring the derived value sent
    // it back through reliability = e / (e + 10) inverted, losing a last bit --
    // evidence of 21 replayed as 20.999999999999996 -- so a replayed record was
    // never quite the record. No mathematics changes here: this picks the
    // lossless of two representations of the same number.
    // Approved by Shaun, 18 Sep 2026 (PROJECT_LEDGER.md Open Question 11).
    if (ev.newEffectiveEvidence !== undefined) {
      s.effectiveEvidence = ev.newEffectiveEvidence;
    } else if (ev.newReliability !== undefined) {
      s.effectiveEvidence = effectiveEvidenceForReliability(ev.newReliability);
    }
    // lifetimeMatches is a factual record -- never altered by any event.

    if (ev.eventType === EVENT.INITIAL_CLASSIFICATION_CORRECTION ||
        ev.eventType === EVENT.INITIAL_CLASSIFICATION_CONFIRMED) {
      s.classificationStatus = CLASSIFICATION.ESTABLISHED;
    }

    return {
      playerId: ev.playerId,
      eventType: ev.eventType,
      effectiveDate: ev.effectiveDate,
      previousTier: before.tier,
      newTier: s.tier,
      previousClassificationStatus: before.classificationStatus,
      newClassificationStatus: s.classificationStatus,
      previousPowerRating: before.rating,
      newPowerRating: s.rating,
      previousReliability: before.reliability,
      newReliability: reliability(s.effectiveEvidence),
      effectiveEvidenceBefore: before.effectiveEvidence,
      effectiveEvidenceAfter: s.effectiveEvidence,
      lifetimeMatchesAtEvent: s.lifetimeMatches,
      recommendationRating: ev.recommendationRating ?? null,
      recommendationReliability: ev.recommendationReliability ?? null,
      recommendationMethodVersion: ev.recommendationMethodVersion ?? null,
      decisionType: ev.decisionType ?? null,
      reasonCode: ev.reasonCode ?? null,
      notes: ev.notes ?? null,
      createdBy: ev.createdBy ?? null,
      recordedAt: ev.recordedAt ?? null,
      ratingModelVersion: RATING_MODEL_VERSION,
      source: ev.source ?? null,
    };
  }

  // ---------- Monthly Performance (§8) ----------

  // Simple mean of (blended actual - pre-match expectation) across the
  // player's matches that month. Never game-weighted, never rating points,
  // never strength-of-schedule adjusted (opponent strength is already inside
  // the pre-match expectation; adding a bonus would double-count).
  function calculateMonthlyPerformance(journey, { provisionalMax = 2, podiumMin = 5, periodOf = (d) => d.slice(0, 7) } = {}) {
    const buckets = {};
    journey
      .filter((e) => e.eventType === EVENT.MATCH_UPDATE)
      .forEach((e) => {
        // The community's period (config/period.js); a calendar month by default.
        const month = periodOf(e.effectiveDate);
        const key = e.playerId + '|' + month;
        if (!buckets[key]) buckets[key] = { playerId: e.playerId, month: month, residuals: [] };
        buckets[key].residuals.push(e.actualScore - e.preMatchExpectedScore);
      });

    return Object.values(buckets).map((b) => {
      const matches = b.residuals.length;
      const mean = b.residuals.reduce((s, x) => s + x, 0) / matches;
      return {
        playerId: b.playerId,
        month: b.month,
        matches: matches,
        monthlyPerformance: mean,
        displayPct: Math.round(mean * 1000) / 10,
        provisional: matches <= provisionalMax,
        tableEligible: matches >= provisionalMax + 1,
        podiumEligible: matches >= podiumMin,
        ratingModelVersion: RATING_MODEL_VERSION,
      };
    });
  }

  // ---------- Legacy migration (§4) ----------

  // Legacy storage is {winners, losers}; sets are recorded winners-first.
  // Winners become Team A, losers Team B, so sets carry over unchanged. For a
  // draw the assignment is arbitrary but must be deterministic and recorded --
  // stored team1/team2 order is used and flagged.
  function fromLegacyMatch(m) {
    const isDraw = !!m.isDraw;
    return {
      id: m.id,
      date: m.date,
      teamA: m.winners,
      teamB: m.losers,
      sets: m.sets,
      outcome: isDraw ? OUTCOME.DRAW : OUTCOME.A_WINS,
      type: m.type,
      drawSideAssignmentArbitrary: isDraw,
      source: 'legacy',
    };
  }

  return {
    RATING_MODEL_VERSION,
    KMAX, KMIN, RC, TIER_SEED,
    GAME_SHARE_WEIGHT, MATCH_RESULT_WEIGHT,
    OUTCOME, CLASSIFICATION, EVENT,
    reliability, kFactor, kForEvidence, effectiveEvidenceForReliability,
    pairRating, expectedScore, gameShares, actualScores,
    initialisePlayer, processMatch, orderMatches, replay, applyStateEvent,
    calculateMonthlyPerformance, fromLegacyMatch,
  };
});
