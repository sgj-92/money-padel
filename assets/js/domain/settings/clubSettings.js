// ===================== CLUB SETTINGS (ADMIN) =====================
// Shaun, 18 Nov: "Allow me to change the number of idle games required to
// show in rankings, within settings. Also allow me to amend the default
// settings for minimum games for rankings, king of tier etc."
//
// The numbers an Admin may change, their defaults and their limits. Defaults
// come from the community (config/club.js periodMinMatches) or the app's own
// long-standing values; a stored setting overrides a default; anything
// missing, out of range or not a whole number falls back to the default, so
// a bad save can never take a screen down.
//
// Stored in the club's own document `moneypadel_settings` (Admin writes only;
// the rules already allow it). Pure: no storage, no screen.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClubSettings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // label, help, and the range allowed. `def(club)` is the default.
  const FIELDS = [
    { key: 'rankedMinMatches', label: 'Matches to be Ranked (not Idle)', unit: 'matches', min: 1, max: 20,
      help: 'A player needs this many rated matches in the window below to hold a rank. Fewer and they show as Idle.', def: () => 2 },
    { key: 'rankedWindowDays', label: 'Ranked window', unit: 'days', min: 7, max: 365,
      help: 'How far back those matches count.', def: () => 30 },
    { key: 'rankingsMinAllTime', label: 'Rankings minimum games, All time', unit: 'games', min: 0, max: 100,
      help: 'The Rankings list opens showing players with at least this many games. Anyone can still change it on the list.', def: () => 10 },
    { key: 'rankingsMinPeriod', label: 'Rankings minimum games, one period', unit: 'games', min: 0, max: 50,
      help: 'The same, when a month (or quarter) is picked.', def: (club) => (club && club.periodMinMatches) || 5 },
    { key: 'kingMinGames', label: 'King of a tier: minimum games', unit: 'games', min: 1, max: 100,
      help: 'Rated games a Ranked player needs to be King of their tier.', def: () => 10 },
    { key: 'raceMinMatches', label: 'Race and period tables: matches to qualify', unit: 'matches', min: 1, max: 50,
      help: 'Matches in the period to qualify for the Monthly Race and the period tables (and so Champion).', def: (club) => (club && club.periodMinMatches) || 5 },
  ];

  function defaults(club) {
    const out = {};
    FIELDS.forEach((f) => { out[f.key] = f.def(club); });
    return out;
  }

  // A stored value, if it is a whole number in range; else null.
  function valid(f, v) {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    return Number.isInteger(n) && n >= f.min && n <= f.max ? n : null;
  }

  // What the app runs on: defaults, overridden by any valid stored value.
  function effective(club, stored) {
    const out = defaults(club);
    FIELDS.forEach((f) => { const v = valid(f, (stored || {})[f.key]); if (v !== null) out[f.key] = v; });
    return out;
  }

  // An Admin's entries -> what to store (only values that differ from the
  // default), or the fields that are wrong.
  function fromForm(club, entries) {
    const d = defaults(club), store = {}, problems = [];
    FIELDS.forEach((f) => {
      const raw = (entries || {})[f.key];
      if (raw === undefined || raw === null || String(raw).trim() === '') return;
      const v = valid(f, String(raw).trim());
      if (v === null) { problems.push(`${f.label}: a whole number from ${f.min} to ${f.max}`); return; }
      if (v !== d[f.key]) store[f.key] = v;
    });
    return { store, problems };
  }

  return { FIELDS, defaults, effective, fromForm };
});
