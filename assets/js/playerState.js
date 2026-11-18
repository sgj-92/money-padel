// ===================== PLAYER STATE =====================
// One place that decides whether a player is Ranked, Idle or Inactive.
//
// The app used to call two different things "inactive":
//
//   * a player who simply has not played much lately, and
//   * a player who is not part of Money Padel at the moment.
//
// The first is temporary and says nothing about the person; the second is a
// club fact. Showing the first as "Inactive" reads as "this player has left",
// which is both wrong and, for anyone sitting out a fortnight, insulting.
//
// So the two dimensions are kept apart and never derived from one another:
//
//   PARTICIPATION  ACTIVE | INACTIVE   -- explicit club status, set by an admin
//   RANKING        RANKED | IDLE       -- derived, and only for ACTIVE players
//
// A player is RANKED when they have at least MIN_MATCHES rated matches in the
// trailing WINDOW_DAYS. Everything else about them -- tier, rating, lifetime
// matches, reliability -- is irrelevant to that question and must never be
// substituted for it. In particular, a lifetime-match minimum is a DISPLAY
// FILTER on the rankings list, not an eligibility rule; conflating the two is
// what made five genuinely active players show "#–" on their own profile.
//
// The match list is the v3 RATED set, which includes draws. A draw is rated:
// it moves every player in it. Counting only wins and losses made a player's
// eligibility depend on whether their recent games happened to finish.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const WINDOW_DAYS = 30;   // the defaults; an Admin may change both (ClubSettings)
  const MIN_MATCHES = 2;
  const rule = { minMatches: MIN_MATCHES, windowDays: WINDOW_DAYS };
  function configure({ minMatches, windowDays } = {}) {
    rule.minMatches = Number.isInteger(minMatches) && minMatches > 0 ? minMatches : MIN_MATCHES;
    rule.windowDays = Number.isInteger(windowDays) && windowDays > 0 ? windowDays : WINDOW_DAYS;
  }

  const PARTICIPATION = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };
  const RANKING = { RANKED: 'RANKED', IDLE: 'IDLE' };

  // What each state is called on screen, in one place so three surfaces cannot
  // word it differently.
  // "Inactive" alone is ambiguous now that a player can be temporarily away
  // or archived (playerStatus.js), so the not-participating label says which.
  const LABEL = { RANKED: 'Ranked', IDLE: 'Idle', INACTIVE: 'Temporarily inactive', ARCHIVED: 'Archived' };

  const DAY_MS = 86400000;

  function windowStart(asOf) {
    const end = typeof asOf === 'number' ? asOf : Date.parse(asOf);
    return end - rule.windowDays * DAY_MS;
  }

  // `ratedMatches` is [{ date: 'YYYY-MM-DD', players: [...] }] -- the v3 rated
  // set, draws included. Dates are compared at UTC midnight so the same match
  // never falls in or out of the window because of the reader's timezone.
  function ratedMatchesInWindow(ratedMatches, name, asOf) {
    const cutoff = windowStart(asOf);
    return (ratedMatches || []).filter((m) =>
      m && m.players && m.players.indexOf(name) !== -1
      && Date.parse(m.date + 'T00:00:00Z') >= cutoff);
  }

  function recentCount(ratedMatches, name, asOf) {
    return ratedMatchesInWindow(ratedMatches, name, asOf).length;
  }

  // The whole state of one player, as every surface should see it.
  //
  // `active` is the explicit club status. It defaults to true: a player nobody
  // has marked inactive is active, and an absent flag must never be read as
  // "not participating".
  //
  // `status`, when given, is the player's standing in the group
  // (playerStatus.js). Temporarily inactive and archived are both not
  // participating; `archived` says which, and so does the label.
  function stateOf({ ratedMatches, name, asOf, active, status }) {
    const archived = status === 'archived';
    const away = archived || status === 'temporarilyInactive';
    const participation = (active === false || away) ? PARTICIPATION.INACTIVE : PARTICIPATION.ACTIVE;
    const recent = recentCount(ratedMatches, name, asOf);
    const meetsThreshold = recent >= rule.minMatches;

    // An inactive player has no ranking state at all -- they are not in the
    // running. They are not "idle", which would imply they are coming back.
    const ranking = participation === PARTICIPATION.INACTIVE
      ? null
      : (meetsThreshold ? RANKING.RANKED : RANKING.IDLE);

    return {
      name,
      participation,
      ranking,
      recentMatches: recent,
      // The one question every surface actually asks: does this player get a
      // rank number right now?
      rankable: ranking === RANKING.RANKED,
      archived,
      label: ranking ? LABEL[ranking] : (archived ? LABEL.ARCHIVED : LABEL.INACTIVE),
    };
  }

  // Convenience for list rendering: the states of many players at once.
  function statesOf({ ratedMatches, names, asOf, activeOf }) {
    const out = {};
    (names || []).forEach((n) => {
      out[n] = stateOf({ ratedMatches, name: n, asOf, active: activeOf ? activeOf(n) : true });
    });
    return out;
  }

  const thresholdText = () => `${rule.minMatches}+ match${rule.minMatches === 1 ? '' : 'es'} in the last ${rule.windowDays} days`;

  return {
    WINDOW_DAYS, MIN_MATCHES, rule, configure, PARTICIPATION, RANKING, LABEL,
    ratedMatchesInWindow, recentCount, stateOf, statesOf, thresholdText,
  };
});
