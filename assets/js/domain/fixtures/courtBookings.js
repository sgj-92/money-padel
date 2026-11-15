// ===================== COURTS BOOKED, PLAYERS TO CONFIRM =====================
// Shaun, 15 Nov: "somewhere to add where courts have been booked but games
// are yet to be confirmed." An admin records a booked court (date, optional
// time and venue) with the names known so far -- none to four. It is shown,
// and shared in the fixtures, as needing players. When the admin fills the
// fourth name it becomes an ordinary agreed, court-booked game (FixtureFlow
// createAgreed), and the court record goes.
//
// Pure: no storage, no screen. Stored in its own document
// (moneypadel_court_bookings), written by an admin only.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CourtBookings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SEATS = 4;

  function cleanNames(players) {
    return (players || []).map((n) => String(n || '').trim()).filter(Boolean);
  }

  // What is wrong with a court as entered, or null.
  function problem({ date, players }) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'no-date';
    const names = cleanNames(players);
    if (names.length > SEATS) return 'too-many';
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return 'duplicate';
    return null;
  }

  function create({ id, date, time, venue, players, by, at }) {
    const when = at || new Date().toISOString();
    return {
      id: id || ('court_' + Date.parse(when) + '_' + Math.random().toString(36).slice(2, 8)),
      date, time: (time || '').trim(), venue: (venue || '').trim(),
      players: cleanNames(players),
      createdBy: by || null, createdAt: when,
      history: [{ at: when, by: by || null, action: 'added' }],
    };
  }

  function update(court, { date, time, venue, players, by, at }) {
    const when = at || new Date().toISOString();
    court.date = date;
    court.time = (time || '').trim();
    court.venue = (venue || '').trim();
    court.players = cleanNames(players);
    court.history = (court.history || []).concat([{ at: when, by: by || null, action: 'edited' }]);
    return court;
  }

  function needed(court) { return Math.max(0, SEATS - cleanNames(court.players).length); }
  function isFull(court) { return needed(court) === 0; }

  // Soonest first; a time breaks a tie, a court without one after those with.
  function order(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ta = a.time || '99:99', tb = b.time || '99:99';
    return ta < tb ? -1 : ta > tb ? 1 : String(a.id).localeCompare(String(b.id));
  }

  // "Shaun, Max + 2 needed" / "4 players needed".
  function namesLine(court) {
    const names = cleanNames(court.players), n = needed(court);
    if (!names.length) return `${n} players needed`;
    return n ? `${names.join(', ')} + ${n} needed` : names.join(', ');
  }

  return { SEATS, problem, create, update, needed, isFull, order, namesLine };
});
