// ===================== THE WEEKLY RECAP =====================
// Shaun, 15 Nov: "a weekly recap, showing the number of games played, who had
// the most wins, biggest shock, number of doughnuts and who gave/received the
// most, if anyone had a bad week."
//
// A week is Monday to Sunday. Everything is counted from the week's rated
// games as the app holds them (sides as stored; a forfeit's or late
// arrival's on-time partner is already left out). Rotations are in no table,
// so they are not games here either; their rating moves are in the week's
// rating changes, because ratings did move.
//
//   * Biggest shock: the win by the pair rated furthest below their
//     opponents going in (the average of each pair's pre-match ratings).
//   * Doughnuts: 6-0 sets only (doughnutsData.js).
//   * A bad week: the biggest rating fall over the week, if it is a real
//     fall (BAD_WEEK_POINTS or more).
//
// PURE: matches and journey are passed in.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WeeklyRecap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BAD_WEEK_POINTS = 5;

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

  // The Monday on or before a date.
  function weekStart(date) {
    const d = new Date(`${date}T12:00:00Z`);
    const back = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - back);
    return iso(d);
  }
  function weekEnd(start) {
    const d = new Date(`${start}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 6);
    return iso(d);
  }
  // Every week with a game, newest first.
  function weeks(matches) {
    return [...new Set((matches || []).map((m) => weekStart(m.date)))].sort().reverse();
  }

  // Everyone tied at the top of a count, and the count.
  function leaders(counts) {
    const best = Math.max(0, ...Object.values(counts));
    return best > 0 ? { names: Object.keys(counts).filter((n) => counts[n] === best).sort((a, b) => a.localeCompare(b)), value: best } : null;
  }

  function build({ matches, journey, start, nameOf }) {
    const end = weekEnd(start);
    const inWeek = (date) => date >= start && date <= end;
    const name = nameOf || ((id) => id);
    const games = (matches || []).filter((m) => inWeek(m.date));
    const players = new Set();
    const record = {};
    const rec = (n) => (record[n] = record[n] || { w: 0, d: 0, l: 0 });
    const gave = {}, got = {};
    let doughnuts = 0;
    games.forEach((m) => {
      m.winners.concat(m.losers).forEach((n) => { players.add(n); rec(n); });
      m.winners.forEach((n) => { if (m.isDraw) rec(n).d++; else rec(n).w++; });
      m.losers.forEach((n) => { if (m.isDraw) rec(n).d++; else rec(n).l++; });
      (m.sets || []).forEach(([a, b]) => {
        const side = a === 6 && b === 0 ? 'A' : a === 0 && b === 6 ? 'B' : null;
        if (!side) return;
        doughnuts++;
        (side === 'A' ? m.winners : m.losers).forEach((n) => { gave[n] = (gave[n] || 0) + 1; });
        (side === 'A' ? m.losers : m.winners).forEach((n) => { got[n] = (got[n] || 0) + 1; });
      });
    });
    const wins = {};
    Object.keys(record).forEach((n) => { wins[n] = record[n].w; });

    // The rating side of the week: each player's change, and each game's
    // pre-match pair ratings for the shock.
    const byMatch = {};
    const change = {};
    (journey || []).forEach((e) => {
      if (e.eventType !== 'MATCH_UPDATE' || !inWeek(e.effectiveDate)) return;
      const n = name(e.playerId);
      change[n] = (change[n] || 0) + (e.ratingDelta || 0);
      (byMatch[e.matchId] = byMatch[e.matchId] || {})[n] = e.preMatchRating;
    });
    let shock = null;
    games.filter((m) => !m.isDraw).forEach((m) => {
      const pre = byMatch[m.id] || {};
      const avg = (side) => { const r = side.map((n) => pre[n]).filter((x) => typeof x === 'number'); return r.length === side.length ? r.reduce((a, b) => a + b, 0) / r.length : null; };
      const w = avg(m.winners), l = avg(m.losers);
      if (w === null || l === null || l <= w) return;
      if (!shock || l - w > shock.gap) shock = { match: m, gap: Math.round(l - w) };
    });

    let bad = null;
    Object.keys(change).forEach((n) => {
      const v = change[n];
      if (v <= -BAD_WEEK_POINTS && (!bad || v < bad.change)) bad = { name: n, change: Math.round(v * 10) / 10, record: record[n] || { w: 0, d: 0, l: 0 } };
    });

    return {
      start, end,
      games: games.length,
      players: players.size,
      mostWins: leaders(wins),
      shock,
      doughnuts,
      gaveMost: leaders(gave),
      receivedMost: leaders(got),
      bad,
      record,
    };
  }

  return { build, weekStart, weekEnd, weeks, BAD_WEEK_POINTS };
});
