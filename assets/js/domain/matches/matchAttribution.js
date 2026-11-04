// ===================== MATCH ATTRIBUTION =====================
// Who put a rated game on the record, for the line under each game ("Submitted
// by Tom") and the match export.
//
// The v3 match documents are rating facts only -- they have never had a field
// for the submitter -- and approving a submission removes it once the game is
// rated. So when the Games log moved onto the v3 record (17 Sep) every game
// read "Submitted by unknown". The answer comes, in order, from:
//
//   stored       the club's `moneypadel_match_attribution` document, written
//                when a submission is approved (from 6 Oct)
//   history      (passed in) the community's own record -- for Money Padel the
//                150 games of the export the v3 record was seeded from: the 16 Sep
//                export (money_padel_matches_2026-09-16.csv), whose "Submitted
//                By" column is what the Games log showed before the move
//   the journey  a game approved in the app between those two lost its
//                submitter, but the Rating Journey still says who approved it;
//                a game brought over from the old app's match export says so
//
// and otherwise the submitter is honestly not recorded.
//
// PURE: the stored map, the history and the journey are passed in.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MatchAttribution = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'moneypadel_match_attribution';
  const HISTORICAL = 'Historical record';
  const NOT_RECORDED = null;

  // Journey `source` values that say how a game reached the record.
  const SOURCE_APPROVED = 'Approved from a submission';
  const SOURCE_IMPORTED = /^production match-facts export/;

  // The community's own record of who submitted its early games (Money
  // Padel: clubs/moneypadel/history.js), as [submitter, [match ids]] groups;
  // the submitter HISTORICAL says "Historical record", null "not recorded".
  // -> { matchId: submitter }
  function historyMap(groups) {
    const map = {};
    (groups || []).forEach(([who, ids]) => (ids || []).forEach((id) => { map[id] = who; }));
    return map;
  }

  // What one game's journey says about how it was added: { approvedBy } for a
  // game approved in the app, { imported: true } for one brought over from the
  // old app, or null. Corrections add later events; the first one that says
  // how the game arrived is the one that counts.
  function fromJourney(matchId, journey) {
    let approvedBy = null; let imported = false;
    (journey || []).forEach((e) => {
      if (!e || e.matchId !== matchId) return;
      if (e.source === SOURCE_APPROVED && e.createdBy && !approvedBy) approvedBy = e.createdBy;
      if (typeof e.source === 'string' && SOURCE_IMPORTED.test(e.source)) imported = true;
    });
    if (approvedBy) return { approvedBy };
    if (imported) return { imported: true };
    return null;
  }

  // -> { kind: 'submitted' | 'historical' | 'approved' | 'imported' | 'unknown',
  //      name, text }
  function describe(matchId, o = {}) {
    const stored = o.stored && o.stored[matchId];
    const HISTORY = o.history || {};
    if (stored && stored.submittedBy) {
      return { kind: 'submitted', name: stored.submittedBy, text: `Submitted by ${stored.submittedBy}` };
    }
    if (Object.prototype.hasOwnProperty.call(HISTORY, matchId) && HISTORY[matchId] !== NOT_RECORDED) {
      const who = HISTORY[matchId];
      return who === HISTORICAL
        ? { kind: 'historical', name: null, text: HISTORICAL }
        : { kind: 'submitted', name: who, text: `Submitted by ${who}` };
    }
    const j = fromJourney(matchId, o.journey);
    if (j && j.approvedBy) return { kind: 'approved', name: j.approvedBy, text: `Approved by ${j.approvedBy}` };
    if (j && j.imported) return { kind: 'imported', name: null, text: 'Added from the old app' };
    return { kind: 'unknown', name: null, text: 'Submitter not recorded' };
  }

  // The entry kept when a submission is approved and rated.
  function entryFor(submission, { matchId, approvedBy, approvedAt }) {
    return {
      matchId,
      submittedBy: (submission && submission.submittedBy) || null,
      submittedAt: (submission && submission.submittedAt) || null,
      approvedBy: approvedBy || null,
      approvedAt: approvedAt || null,
    };
  }

  return { STORAGE_KEY, HISTORICAL, historyMap, describe, fromJourney, entryFor };
});
