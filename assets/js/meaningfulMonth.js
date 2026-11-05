// ===================== MEANINGFUL MONTH =====================
// Which month a monthly competitive view should OPEN on.
//
// It used to be "last month", always. That solved a real problem -- on the
// 1st, the current month holds one game, and a league table, a podium or a
// Player of the Month built from one game is noise -- but it solved it by the
// calendar rather than by the data, so it went on showing August on the 25th
// of September, three weeks and dozens of games after September had become the
// month worth reading.
//
// The rule now asks the data: the current month is the default once it holds
// THRESHOLD canonical matches; until then the most recently completed month
// with any matches is.
//
// This module decides a DEFAULT and nothing else. It never knows what a reader
// has chosen, and nothing here may override a choice: every screen that uses
// it keeps its own chosen month and its own default separately, and asks this
// module only when a reader arrives without having chosen (see app.js,
// "WHO OWNS WHICH MONTH"). It is also evaluated on arrival and then held, so a
// fifth game landing while somebody is reading September's-too-thin August
// does not move the page under them.
//
// COUNT MATCHES, NOT APPEARANCES. Four players in one game is one game. A
// drawn match is a played, rated match and counts. A pending submission is
// neither and does not; nor does a display-only historical row.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeaningfulMonth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const THRESHOLD = 5;
  // The community's period (config/period.js): a month for Money Padel.
  const period = () => (typeof Period !== 'undefined' ? Period : require('./config/period.js'));

  // The reader's calendar month, in their own time zone. A game at half past
  // midnight on 1 October in London is an October game, whatever UTC says --
  // and match dates are stored as the local date they were played.
  function monthKey(now) {
    return period().current(now instanceof Date ? now : new Date(now));
  }

  function monthLabel(key) {
    return period().label(key);
  }

  // Canonical matches in a month, each counted once. `id` is the record's own
  // identity; a match without one (a hand-built fixture) is keyed by what it
  // is, so it cannot be double-counted either.
  function countInMonth(matches, key) {
    const seen = new Set();
    (matches || []).forEach((m) => {
      if (!m || typeof m.date !== 'string' || period().of(m.date) !== key) return;
      const id = m.id || `${m.date}|${(m.winners || []).slice().sort().join('&')}|${(m.losers || []).slice().sort().join('&')}`;
      seen.add(id);
    });
    return seen.size;
  }

  // `matches` must already be the CANONICAL set -- rated or completed, draws
  // included, pending and display-only excluded. The caller knows its record;
  // this module only counts what it is given.
  function evaluate({ now, matches, threshold }) {
    const need = threshold || THRESHOLD;
    const current = monthKey(now || new Date());
    const currentCount = countInMonth(matches, current);

    if (currentCount >= need) {
      return { month: current, current, currentCount, threshold: need, reason: 'current' };
    }

    // The most recently completed month that actually has games. Not simply
    // "last calendar month": a month the club did not play in is not a month
    // worth opening on.
    const earlier = [...new Set((matches || [])
      .map((m) => (m && typeof m.date === 'string' ? period().of(m.date) : null))
      .filter((k) => k && k < current))].sort();
    const fallback = earlier.length ? earlier[earlier.length - 1] : null;

    return {
      month: fallback || 'all',
      current, currentCount, threshold: need,
      reason: fallback ? 'current-too-thin' : 'no-completed-month',
    };
  }

  return { THRESHOLD, monthKey, monthLabel, countInMonth, evaluate };
});
