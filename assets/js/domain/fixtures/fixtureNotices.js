// ===================== WHAT A FIXTURE CHANGE TELLS PLAYERS =====================
// Shaun, 19 Nov: players "receive notifications". Decided: phone
// notifications. This compares the fixtures before and after a save and says
// who to tell, and what, for the moments that matter:
//
//   a request        -> the players asked (not the one asking)
//   all four in      -> the four: game on, court not booked yet
//   court booked     -> the four (also an Admin adding an already-booked game)
//   game removed     -> the four
//
// The sender leaves out whoever made the change (they know). Pure: no
// storage, no network; `when(req)` formats the date and time.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FixtureNotices = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const AGREED = 'confirmed', PENDING = 'pending', REMOVED = 'removed';

  function teamsOf(req) {
    if (Array.isArray(req.teams) && req.teams.length === 2 && req.teams[0].length && req.teams[1].length) return req.teams;
    const p = req.players || [];
    return [p.slice(0, 2), p.slice(2, 4)];
  }
  function line(req) {
    const [a, b] = teamsOf(req);
    return `${a.join(' & ')} v ${b.join(' & ')}`;
  }

  // -> [{ to: [names], title, body, tag }]
  function between(before, after, { when } = {}) {
    const at = (req) => { const w = when ? when(req) : ''; return w ? ` · ${w}` : ''; };
    const was = {};
    (before || []).forEach((r) => { if (r && r.id) was[r.id] = r; });
    const out = [];
    (after || []).forEach((r) => {
      if (!r || !r.id) return;
      const old = was[r.id];
      const players = (r.players || []).filter(Boolean);
      const venue = r.location ? ` · ${r.location}` : '';
      const tag = `fixture-${r.id}`;
      if (!old) {
        if (r.status === PENDING) {
          out.push({ to: players.filter((n) => n !== r.requestedBy), tag,
            title: 'Game request', body: `${r.requestedBy || 'Someone'} asked you to play: ${line(r)}${at(r)}. Answer in Play.` });
        } else if (r.status === AGREED) {
          out.push(r.courtBookingMade
            ? { to: players, tag, title: 'Court booked', body: `${line(r)}${at(r)}${venue}.` }
            : { to: players, tag, title: 'Game on', body: `${line(r)}${at(r)}. Court not booked yet.` });
        }
        return;
      }
      if (old.status === PENDING && r.status === AGREED) {
        out.push(r.courtBookingMade
          ? { to: players, tag, title: 'Court booked', body: `All four are in: ${line(r)}${at(r)}${venue}.` }
          : { to: players, tag, title: 'Game on', body: `All four are in: ${line(r)}${at(r)}. Court not booked yet.` });
        return;
      }
      if (old.status === AGREED && r.status === AGREED && !old.courtBookingMade && r.courtBookingMade) {
        out.push({ to: players, tag, title: 'Court booked', body: `${line(r)}${at(r)}${venue}.` });
        return;
      }
      if (old.status !== REMOVED && r.status === REMOVED) {
        out.push({ to: (old.players || players).filter(Boolean), tag, title: 'Game cancelled', body: `${line(old)}${at(old)} is off.` });
      }
    });
    return out.filter((n) => n.to.length);
  }

  return { between, line };
});
