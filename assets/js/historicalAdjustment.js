// ===================== HISTORICAL CLUB ADJUSTMENT =====================
// The Admin-only way to record a club decision at a date that has already
// passed: a board decision entered late, a factual correction, or the repair of
// a mistake. It is deliberately a permanent tool rather than a one-off script,
// because the next time this is needed nobody will remember the script existed.
//
// It is NOT historical match correction. That repairs what happened on court.
// This records what the club decided about a player's level. Keeping them apart
// matters: one is a fact about a result, the other is a judgement, and merging
// them would let a rating be changed under cover of fixing a score.
//
// Four rules it will not bend:
//
//   * A missing statistical recommendation is not a decision. When the method
//     declines -- usually because a tier pool is too thin to place a boundary --
//     that is reported as an absence. It is never quietly turned into "keep the
//     current rating", which would put words in the board's mouth.
//   * Nothing earlier is deleted or edited. A correction is a NEW event that
//     supersedes the old one; both stay in the record, and only the later is
//     replayed. An audit trail that can be rewritten is not one.
//   * A reason and a name are required. A historical change with no account of
//     why is indistinguishable from someone editing the database.
//   * The record must replay to itself before anything is planned, and the full
//     blast radius is shown before anything is written.

(function (root, factory) {
  const api = factory(
    typeof require === 'function' ? require('./ratingEngine.js') : root.RatingEngine,
    typeof require === 'function' ? require('./ratingStore.js') : root.RatingStore,
    typeof require === 'function' ? require('./monthlyReview.js') : root.MonthlyReview,
    typeof require === 'function' ? require('./replayForward.js') : root.ReplayForward
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HistoricalAdjustment = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Engine, Store, Review, Replay) {
  'use strict';

  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  // Everything the Admin needs to see before deciding: where the player stood
  // immediately before that date, what the statistical method says NOW about
  // that historical position, and what the record already contains for them on
  // that date.
  function context({ journey, playerId, effectiveDate, toTier }) {
    if (!ISO_DATE.test(effectiveDate || '')) throw new Error('An effective date (YYYY-MM-DD) is required.');
    const snapshot = Review.preReviewSnapshot(journey, effectiveDate);
    const before = snapshot[playerId] || null;

    const existing = (journey || []).filter((e) =>
      e.playerId === playerId && e.effectiveDate === effectiveDate
      && e.eventType !== Engine.EVENT.MATCH_UPDATE);

    // Already-superseded events are shown as history, not as live decisions.
    const supersededIds = {};
    (journey || []).forEach((e) => { if (e.supersedes) supersededIds[e.supersedes] = true; });

    const recommendation = (before && toTier && toTier !== before.tier)
      ? Review.recommendationFor(snapshot, {
        playerId, fromTier: before.tier, toTier,
        eventType: Review.TIER_MOVE.PROMOTION === Engine.EVENT.PROMOTION && rankOf(toTier) < rankOf(before.tier)
          ? 'PROMOTION' : 'DEMOTION',
      })
      : null;

    return {
      playerId,
      effectiveDate,
      before,
      snapshotSize: Object.keys(snapshot).length,
      existing: existing.map((e) => ({
        id: e.id || Store.eventId(e),
        eventType: e.eventType,
        previousPowerRating: e.previousPowerRating,
        newPowerRating: e.newPowerRating,
        previousTier: e.previousTier,
        newTier: e.newTier,
        decisionType: e.decisionType,
        createdBy: e.createdBy,
        superseded: !!supersededIds[e.id || Store.eventId(e)],
        revision: e.revision || null,
      })),
      recommendation,
      // Stated rather than implied: the board has to answer this itself.
      recommendationAbsent: !!(recommendation && !recommendation.recommended),
      recommendationAbsentReason: recommendation && !recommendation.recommended ? recommendation.reason : null,
    };
  }

  const TIER_RANK = { S: 0, A: 1, B: 2, C: 3 };
  function rankOf(t) { return TIER_RANK[t] === undefined ? 99 : TIER_RANK[t]; }

  // Why this adjustment cannot be planned yet. Returned rather than thrown, so
  // the screen can show what is still missing while the Admin is deciding.
  function incompleteReasons(adjustment, ctx) {
    const out = [];
    if (!ctx.before) out.push(`${adjustment.playerId} has no recorded state before ${adjustment.effectiveDate}.`);
    if (!adjustment.reason || !String(adjustment.reason).trim()) {
      out.push('A historical change needs a reason. Without one it is indistinguishable from someone editing the database.');
    }
    if (!adjustment.createdBy) out.push('A historical change must record who made it.');

    // The prospective rules apply unchanged -- this is the same decision, made
    // late, so it cannot be made to weaker standards.
    const asReview = toReview(adjustment, ctx);
    Review.incompleteReasons(asReview, { [adjustment.playerId]: ctx.before || {} })
      .filter((r) => !/no recorded state before/.test(r))
      .forEach((r) => out.push(r));

    if (adjustment.ratingDecision === Review.DECISION.ACCEPT_RECOMMENDATION && ctx.recommendationAbsent) {
      out.push('There is no statistical recommendation at this date to accept: '
        + ctx.recommendationAbsentReason
        + ' Choose keep-current or a club override — an absent recommendation is not itself a decision.');
    }
    return out;
  }

  function toReview(adjustment, ctx) {
    return {
      playerId: adjustment.playerId,
      effectiveDate: adjustment.effectiveDate,
      tierEvent: adjustment.tierEvent,
      newTier: adjustment.newTier,
      ratingDecision: adjustment.ratingDecision,
      overrideRating: adjustment.overrideRating,
      overrideReliability: adjustment.overrideReliability,
      correctedRating: adjustment.correctedRating,
      correctedReliability: adjustment.correctedReliability,
      recommendation: ctx.recommendation,
      reasonCode: adjustment.reasonCode || 'HISTORICAL_CLUB_ADJUSTMENT',
      notes: adjustment.reason,
      createdBy: adjustment.createdBy,
      source: 'Historical Club Adjustment',
    };
  }

  // The events to insert, each marked with what it supersedes. Nothing is
  // deleted: the replay simply stops honouring what was replaced.
  function eventsFor(adjustment, ctx) {
    const problems = incompleteReasons(adjustment, ctx);
    if (problems.length) {
      const err = new Error('This historical adjustment cannot be planned:\n- ' + problems.join('\n- '));
      err.problems = problems;
      throw err;
    }
    const decisions = Review.decisionsFor(toReview(adjustment, ctx), { [adjustment.playerId]: ctx.before });
    const live = ctx.existing.filter((e) => !e.superseded);
    return decisions.map((d) => {
      // What the system said, flattened onto the event.
      //
      // These decisions go STRAIGHT to the engine as replay inputs -- this path
      // does not go through ClubDecision.prepare, which is where the monthly
      // review flattens them. The engine reads scalars, so a `recommendation`
      // object was silently dropped and every historical adjustment stored a
      // null recommendation: the audit trail could not show whether the board
      // had followed the system or departed from it, which is the one question
      // it exists to answer.
      const rec = d.recommendation || null;
      const withRec = {
        ...d,
        recommendationRating: rec ? rec.recommendationRating : null,
        recommendationReliability: rec ? rec.recommendationReliability : null,
        // One field, and whichever recommendation actually exists names the
        // method behind it: the rating method where there is a rating
        // recommendation, otherwise the Reliability rule. No new stored field
        // is introduced for this.
        recommendationMethodVersion: rec ? (rec.methodVersion || rec.reliabilityRule || null) : null,
      };
      // A decision of the same type on the same date replaces the one already
      // there; anything else is simply added alongside.
      const replaced = live.find((e) => e.eventType === d.eventType);
      if (!replaced) return withRec;
      const nextRevision = (Math.max(0, ...live.filter((e) => e.eventType === d.eventType).map((e) => e.revision || 1)) + 1);
      return { ...withRec, supersedes: replaced.id, revision: nextRevision };
    });
  }

  // The full consequence, measured by replaying rather than predicted. Refuses
  // if the record does not already replay to itself -- planning a change on top
  // of a record the engine disagrees with would compound the problem.
  function plan({ stored, adjustment, provenance }) {
    const ctx = context({
      journey: stored.journey, playerId: adjustment.playerId,
      effectiveDate: adjustment.effectiveDate, toTier: adjustment.newTier,
    });
    const events = eventsFor(adjustment, ctx);
    const planned = Replay.plan({
      stored,
      change: { type: 'clubDecision', events },
      provenance,
    });
    return { ...planned, context: ctx, events, summary: Review.describe(toReview(adjustment, ctx), { [adjustment.playerId]: ctx.before }) };
  }

  // ---- Moving a recorded decision to the date it really took effect ----
  // Shaun, 6 Nov: PDM's promotion (and his new rating) was recorded a day
  // late, after he had already played a game as a Tier A player. The
  // decision is right; its date is wrong.
  //
  // The decisions recorded for the player on `fromDate` are recorded again on
  // `toDate`, each SUPERSEDING the original -- so the original stays in the
  // record, is no longer replayed, and everything from the earlier of the two
  // dates is re-derived. What moves is what the board decided: the tier, and
  // a rating or Reliability the decision actually set. A promotion moved no
  // points, so its figures are not carried; a club rating of 1620 is 1620 on
  // whichever date it applies.
  function liveDecisionsOn(journey, playerId, date) {
    const supersededIds = {};
    (journey || []).forEach((e) => { if (e.supersedes) supersededIds[e.supersedes] = true; });
    return (journey || []).filter((e) => e.playerId === playerId && e.effectiveDate === date
      && e.eventType !== Engine.EVENT.MATCH_UPDATE && e.eventType !== Engine.EVENT.PLAYER_INITIALISED
      && !supersededIds[e.id || Store.eventId(e)]);
  }

  // The dates a player has live decisions on, newest first, for the picker.
  function decisionDates(journey, playerId) {
    const dates = {};
    (journey || []).forEach((e) => {
      if (e.playerId === playerId && e.eventType !== Engine.EVENT.MATCH_UPDATE && e.eventType !== Engine.EVENT.PLAYER_INITIALISED) dates[e.effectiveDate] = true;
    });
    return Object.keys(dates).filter((d) => liveDecisionsOn(journey, playerId, d).length).sort().reverse();
  }

  function movedEvents({ journey, playerId, fromDate, toDate, reason, createdBy }) {
    if (!ISO_DATE.test(fromDate || '') || !ISO_DATE.test(toDate || '')) throw new Error('Both dates are needed, as YYYY-MM-DD.');
    if (fromDate === toDate) throw new Error('Choose a different date to move it to.');
    if (!reason || !String(reason).trim()) throw new Error('Say why the date is being corrected — it is recorded with the move.');
    if (!createdBy) throw new Error('Choose who you are first — every change is recorded against someone.');
    const live = liveDecisionsOn(journey, playerId, fromDate);
    if (!live.length) throw new Error(`${playerId} has no decision recorded on ${fromDate}.`);
    const init = (journey || []).find((e) => e.playerId === playerId && e.eventType === Engine.EVENT.PLAYER_INITIALISED);
    if (init && toDate < init.effectiveDate) throw new Error(`${playerId} entered the record on ${init.effectiveDate}; a decision cannot come before that.`);
    const clash = liveDecisionsOn(journey, playerId, toDate).filter((e) => live.some((l) => l.eventType === e.eventType));
    if (clash.length) throw new Error(`${playerId} already has a ${clash[0].eventType.toLowerCase().replace(/_/g, ' ')} on ${toDate}. Use the adjustment above to replace it instead.`);
    const changed = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) > 1e-9;
    return live.map((e) => {
      const ev = {
        playerId, eventType: e.eventType, effectiveDate: toDate,
        newTier: e.newTier ?? null,
        decisionType: e.decisionType ?? null,
        reasonCode: e.reasonCode ?? null,
        notes: `${e.notes ? e.notes + ' ' : ''}[Date corrected from ${fromDate} to ${toDate}: ${String(reason).trim()}]`,
        createdBy, source: 'Decision date correction',
        recommendationRating: e.recommendationRating ?? null,
        recommendationReliability: e.recommendationReliability ?? null,
        recommendationMethodVersion: e.recommendationMethodVersion ?? null,
        supersedes: e.id || Store.eventId(e),
        revision: (e.revision || 1) + 1,
      };
      if (e.newClassificationStatus && e.newClassificationStatus !== e.previousClassificationStatus) ev.newClassificationStatus = e.newClassificationStatus;
      if (changed(e.newPowerRating, e.previousPowerRating)) ev.newPowerRating = e.newPowerRating;
      if (changed(e.newReliability, e.previousReliability)) {
        ev.newReliability = e.newReliability;
        if (typeof e.effectiveEvidenceAfter === 'number') ev.newEffectiveEvidence = e.effectiveEvidenceAfter;
      }
      // A rating decision that set nothing ("keep the current rating") is
      // still a decision, and is recorded as one on its new date.
      if (e.eventType === Engine.EVENT.CLUB_RATING_REASSESSMENT && ev.newPowerRating === undefined && ev.newReliability === undefined) ev.allowNoChange = true;
      return ev;
    });
  }

  function planMove({ stored, playerId, fromDate, toDate, reason, createdBy, provenance }) {
    const events = movedEvents({ journey: stored.journey, playerId, fromDate, toDate, reason, createdBy })
      .sort((a, b) => Review.eventRank(a.eventType) - Review.eventRank(b.eventType));
    const planned = Replay.plan({ stored, change: { type: 'clubDecision', events }, provenance });
    const what = events.map((e) => e.eventType === Engine.EVENT.CLUB_RATING_REASSESSMENT
      ? (e.newPowerRating !== undefined ? `rating ${Math.round(e.newPowerRating * 10) / 10}` : 'rating decision')
      : `${e.eventType.toLowerCase().replace(/_/g, ' ')}${e.newTier ? ` to Tier ${e.newTier}` : ''}`).join(' and ');
    return { ...planned, events, fromDate, toDate, playerId,
      summary: `${playerId}: ${what} moved from ${fromDate} to ${toDate}. Every game from ${fromDate < toDate ? fromDate : toDate} is re-rated.` };
  }

  return { context, incompleteReasons, eventsFor, plan, toReview, liveDecisionsOn, decisionDates, movedEvents, planMove };
});
