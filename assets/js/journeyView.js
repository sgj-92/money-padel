// ===================== RATING JOURNEY (display shaping) =====================
// Turns persisted ratingJourney events into the chronological story of one
// player's Power Rating. This is the REAL record, not a reconstruction: every
// figure here was written by the engine at the time and is simply read back.
//
// The disclaimer the old UI carried ("Story estimate — official Power Rating
// is X") existed because the previous journey was a separate approximation
// that could disagree with the official number. It cannot disagree now, so the
// disclaimer is gone.
//
// Two rules the display must never break:
//   * A tier change is shown as its own event and always states that the
//     Power Rating did not move. A promotion must never look like it generated
//     points.
//   * A club reassessment is shown as its own event with a distinct marker on
//     the chart. It must never masquerade as match movement.

(function (root, factory) {
  const api = factory(typeof require === 'function' ? require('./ratingEngine.js') : root.RatingEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JourneyView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Engine) {
  'use strict';

  const TIER_EVENTS = ['PROMOTION', 'DEMOTION', 'TIER_RETAINED'];

  // Grouped for a shared visual treatment. The schema keeps them as separate
  // event types on purpose -- this grouping is presentation only and must not
  // be pushed back into the stored data.
  function kindOf(event) {
    if (event.eventType === Engine.EVENT.PLAYER_INITIALISED) return 'initialised';
    if (event.eventType === Engine.EVENT.MATCH_UPDATE) return 'match';
    if (event.eventType === Engine.EVENT.CLUB_RATING_REASSESSMENT) return 'reassessment';
    if (event.eventType === Engine.EVENT.INITIAL_CLASSIFICATION_CORRECTION) return 'correction';
    if (TIER_EVENTS.includes(event.eventType)) return 'tier';
    return 'other';
  }

  // THE canonical order for events sharing a date and a player, defined once
  // here and reused by MonthlyReview and ReplayForward. A tier move is recorded
  // before the rating decision that accompanies it, because that is how a board
  // makes it. Getting this wrong does not merely look odd: the chain of
  // previous-to-new ratings stops joining up, and the record no longer
  // reproduces itself on replay.
  const SAME_DATE_ORDER = [
    'PLAYER_INITIALISED',
    'INITIAL_CLASSIFICATION_CORRECTION',
    'INITIAL_CLASSIFICATION_CONFIRMED',
    'PROMOTION',
    'DEMOTION',
    'TIER_RETAINED',
    'CLUB_RATING_REASSESSMENT',
    'MATCH_UPDATE',
  ];
  function eventRank(eventType) {
    const i = SAME_DATE_ORDER.indexOf(eventType);
    return i === -1 ? SAME_DATE_ORDER.length : i;
  }

  function chronological(events) {
    return [...events].sort((a, b) => {
      if (a.effectiveDate !== b.effectiveDate) return a.effectiveDate < b.effectiveDate ? -1 : 1;
      const ka = eventRank(a.eventType), kb = eventRank(b.eventType);
      if (ka !== kb) return ka - kb;
      // Match ids are `YYYY-MM-DD-N`, so they order matches within a day.
      return String(a.matchId || '').localeCompare(String(b.matchId || ''));
    });
  }

  function ratingAfter(event) {
    return event.eventType === Engine.EVENT.MATCH_UPDATE
      ? event.postMatchRating
      : event.newPowerRating;
  }

  // Shapes one player's events. Returns null when the player has no journey at
  // all -- the caller must say so plainly rather than invent a starting point.
  function forPlayer(allEvents, playerId) {
    // A superseded decision stays in the record -- that is what makes a
    // correction auditable rather than a rewrite -- but it is not part of the
    // player's live story. Showing both would tell them their rating moved
    // twice, and the chain would visibly fail to join up.
    const superseded = {};
    (allEvents || []).forEach((e) => { if (e.supersedes) superseded[e.supersedes] = true; });
    const mine = chronological((allEvents || [])
      .filter((e) => e.playerId === playerId)
      .filter((e) => !superseded[e.id]));
    if (!mine.length) return null;

    const entries = mine.map((e) => {
      const kind = kindOf(e);
      const rating = ratingAfter(e);
      const previous = e.previousPowerRating;
      const base = {
        kind,
        eventType: e.eventType,
        date: e.effectiveDate,
        rating: rating,
        previousRating: typeof previous === 'number' ? previous : null,
        // A tier event carries previous === new, so this is 0 by construction
        // rather than by assumption.
        delta: (typeof previous === 'number' && typeof rating === 'number')
          ? Math.round((rating - previous) * 10) / 10
          : null,
        reliability: typeof e.newReliability === 'number' ? e.newReliability : null,
        previousReliability: typeof e.previousReliability === 'number' ? e.previousReliability : null,
        tier: e.newTier || e.tierAtEvent || null,
        previousTier: e.previousTier || null,
        reasonCode: e.reasonCode || null,
        notes: e.notes || null,
        decisionType: e.decisionType || null,
      };
      if (kind === 'match') {
        return {
          ...base,
          matchId: e.matchId,
          delta: Math.round((e.ratingDelta || 0) * 10) / 10,
          previousRating: e.preMatchRating,
          preMatchRating: e.preMatchRating,
          expected: e.preMatchExpectedScore,
          actual: e.actualScore,
          residual: e.performanceResidual,
          kUsed: e.kUsed,
          side: e.side,
        };
      }
      return base;
    });

    const first = entries[0], last = entries[entries.length - 1];
    return {
      playerId,
      entries,
      startRating: first.rating,
      endRating: last.rating,
      totalChange: Math.round((last.rating - first.rating) * 10) / 10,
      matchCount: entries.filter((e) => e.kind === 'match').length,
      // Counted separately so the UI can state plainly that these moved the
      // rating without a ball being hit -- or, for tier events, did not.
      reassessmentCount: entries.filter((e) => e.kind === 'reassessment').length,
      tierChangeCount: entries.filter((e) => e.kind === 'tier' || e.kind === 'correction').length,
      firstDate: first.date,
      lastDate: last.date,
    };
  }

  // One month of a player's journey, for the monthly breakdown. The opening
  // figure is the rating carried INTO the month -- read from the first event's
  // own previousRating, which is where the engine actually started it. There is
  // no monthly seed and no monthly re-solve: a month is a window onto one
  // continuous trajectory, and this function cannot express anything else.
  function monthSlice(journey, month) {
    const period = typeof Period !== 'undefined' ? Period : require('./config/period.js');
    const entries = journey.entries.filter((e) => period.of(String(e.date)) === month);
    if (!entries.length) return null;
    const first = entries[0], last = entries[entries.length - 1];
    const opened = typeof first.previousRating === 'number' ? first.previousRating : first.rating;
    const counts = {
      matchCount: entries.filter((e) => e.kind === 'match').length,
      reassessmentCount: entries.filter((e) => e.kind === 'reassessment').length,
      tierChangeCount: entries.filter((e) => e.kind === 'tier' || e.kind === 'correction').length,
    };
    // Shown so the chart opens where the month opened rather than at the
    // player's first result, which would hide the first match's movement.
    const withOpening = (opened === first.rating && first.kind === 'initialised')
      ? entries
      : [{ kind: 'opening', eventType: 'MONTH_OPENED', date: first.date, rating: opened,
           previousRating: null, delta: null, reliability: null, previousReliability: null,
           tier: first.previousTier || first.tier || null, previousTier: null,
           reasonCode: null, notes: null, decisionType: null }].concat(entries);
    return {
      playerId: journey.playerId,
      month,
      entries: withOpening,
      startRating: opened,
      endRating: last.rating,
      totalChange: Math.round((last.rating - opened) * 10) / 10,
      ...counts,
      firstDate: first.date,
      lastDate: last.date,
    };
  }

  // A TIER MOVE must never show rating movement -- a promotion is not points.
  // A correction is different: the board may be replacing an initial estimate
  // it knows was wrong, and that legitimately moves the rating. Asserting the
  // tier rule here as well as in the engine means a display bug cannot invent
  // movement on a promotion either.
  function tierEventsAreRatingNeutral(journey) {
    return journey.entries
      .filter((e) => e.kind === 'tier')
      .every((e) => e.delta === 0 || e.delta === null);
  }

  // Points for the chart, plus the markers that must not look like match play.
  function chartSeries(journey) {
    return journey.entries.map((e, i) => ({
      i,
      date: e.date,
      rating: e.rating,
      kind: e.kind,
      delta: e.delta,
      // Drawn by what the event DID, not by what it is called. A club decision
      // that moved the rating is a jump; one that moved nothing annotates the
      // line without implying movement. A correction can be either, which is
      // why this cannot be decided from the event type alone.
      isJump: e.kind === 'reassessment' || ((e.kind === 'correction' || e.kind === 'tier') && !!e.delta),
      isAnnotation: (e.kind === 'tier' || e.kind === 'correction') && !e.delta,
    }));
  }

  return { forPlayer, monthSlice, kindOf, chronological, chartSeries, tierEventsAreRatingNeutral, TIER_EVENTS, SAME_DATE_ORDER, eventRank };
});
