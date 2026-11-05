// ===================== THE COMMUNITY'S PERIOD =====================
// Money Padel is judged month by month. Padel Championships (Shaun, 5 Nov) is
// judged by the quarter: Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec -- one length for
// the League, the Race, Champions and the honours alike.
//
// A period is named by its FIRST month, "YYYY-MM", exactly as a month always
// was: Money Padel's keys, stored documents and links are unchanged, and
// `${key}-01` is still the period's first day. What a key can no longer be
// trusted for is its END or which dates fall inside it -- ask this module:
//
//   Period.of(date)          the period a "YYYY-MM-DD" date belongs to
//   Period.start(key)        "YYYY-MM-01"
//   Period.end(key)          its last day, "YYYY-MM-DD"
//   Period.contains(key, d)  is that date in it
//   Period.label(key)        "October 2026" | "Oct–Dec 2026"
//   Period.name(key)         "October"      | "Oct–Dec"
//   Period.next / prev(key)
//   Period.noun              'month' | 'quarter'   (and Noun, Adjective)
//
// Periods are anchored to January, so none crosses a year end.
// Loads after config/club.js; in Node, require() it (the community is Money
// Padel, so every period is a month).

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Period = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const club = () => (typeof CLUB !== 'undefined' ? CLUB : require('./club.js').CLUB);

  // make({ months, noun }) -> a period. The page's is the community's; tests
  // make others.
  function make(cfg) {
    cfg = cfg || {};
    const MONTHS = [1, 2, 3, 4, 6, 12].includes(cfg.months) ? cfg.months : 1;
    const NOUN = cfg.noun || (MONTHS === 1 ? 'month' : MONTHS === 3 ? 'quarter' : 'period');
    const ADJECTIVE = MONTHS === 1 ? 'Monthly' : MONTHS === 3 ? 'Quarterly' : 'Period';

    const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n) => String(n).padStart(2, '0');
    const parts = (key) => { const [y, m] = String(key).split('-').map(Number); return [y, m]; };

    function of(date) {
      const s = String(date || '');
      if (MONTHS === 1) return s.slice(0, 7);
      const [y, m] = parts(s.slice(0, 7));
      return `${y}-${pad(Math.floor((m - 1) / MONTHS) * MONTHS + 1)}`;
    }
    // The period holding a moment, in the reader's own time zone.
    function current(now) {
      const d = now instanceof Date ? now : new Date(now || Date.now());
      return of(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`);
    }
    const start = (key) => `${key}-01`;
    function lastMonth(key) { const [y, m] = parts(key); return m + MONTHS - 1; }
    function end(key) {
      const [y] = parts(key);
      const lm = lastMonth(key);
      return `${y}-${pad(lm)}-${pad(new Date(Date.UTC(y, lm, 0)).getUTCDate())}`;
    }
    const contains = (key, date) => of(date) === key;
    function name(key) {
      const [, m] = parts(key);
      return MONTHS === 1 ? LONG[m - 1] : `${SHORT[m - 1]}–${SHORT[lastMonth(key) - 1]}`;
    }
    const label = (key) => `${name(key)} ${parts(key)[0]}`;
    function shift(key, by) {
      const [y, m] = parts(key);
      const idx = y * 12 + (m - 1) + by * MONTHS;
      return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
    }
    const next = (key) => shift(key, 1);
    const prev = (key) => shift(key, -1);

    return {
      MONTHS, noun: NOUN, Noun: NOUN[0].toUpperCase() + NOUN.slice(1), Adjective: ADJECTIVE,
      of, current, start, end, contains, name, label, next, prev, make,
    };
  }

  return make(club().period);
});
