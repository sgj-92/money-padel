// ===================== WHEN A PLAYER CAN PLAY =====================
// Shaun, 19 Nov: players "put their schedule for when they can play".
// Decided: a weekly pattern plus exceptions, in hourly blocks a player taps
// (Shaun, 19 Nov: "hourly blocks they can tap from 8am to 9pm at night for
// each day"). A block is named by the hour it starts: 8 is 8–9am, 21 is
// 9–10pm, so a 9pm game has a block of its own. An exception is one date,
// either "not free" all day or free in the blocks named (which then replace
// the week's for that date).
//
//   { weekly: { mon: [18, 19, 20], sat: [8, 9, 10] },
//     exceptions: [{ date: '2026-11-28', free: [] },          // not free
//                  { date: '2026-11-30', free: [9, 10] }],    // free then
//     updatedAt, by }
//
// The first version stored morning / afternoon / evening; those read as the
// blocks they covered. Nothing set means unknown, never "busy".
// Pure: no storage, no screen.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Availability = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const DAY_LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const FIRST_HOUR = 8, LAST_HOUR = 21;   // blocks 8–9am … 9–10pm
  const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  const LEGACY = { morning: [8, 9, 10, 11], afternoon: [12, 13, 14, 15, 16], evening: [17, 18, 19, 20, 21] };

  // 8 -> '8am', 12 -> '12pm', 21 -> '9pm'
  function hourLabel(h) { return h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`; }

  // "21:00" -> 21. No time -> null (the whole day is asked about).
  function hourOfTime(time) {
    const m = String(time || '').match(/^(\d{1,2})/);
    return m ? Number(m[1]) : null;
  }
  // 'YYYY-MM-DD' -> 'mon'..'sun' (the date as written, not the reader's zone).
  function dayOf(date) {
    const d = new Date(`${date}T12:00:00Z`);
    return DAYS[(d.getUTCDay() + 6) % 7];
  }

  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  // Blocks, from hours or the old part-of-day names; known blocks only, in order.
  function blocksIn(a) {
    const set = new Set();
    (a || []).forEach((x) => {
      if (LEGACY[x]) LEGACY[x].forEach((h) => set.add(h));
      else if (Number.isInteger(Number(x)) && HOURS.includes(Number(x))) set.add(Number(x));
    });
    return HOURS.filter((h) => set.has(h));
  }

  // What is stored: only known days and blocks, one exception per date, sorted.
  function clean(entry) {
    const weekly = {};
    DAYS.forEach((d) => { const s = blocksIn(entry && entry.weekly && entry.weekly[d]); if (s.length) weekly[d] = s; });
    const seen = {};
    ((entry && entry.exceptions) || []).forEach((x) => { if (x && isDate(x.date)) seen[x.date] = { date: x.date, free: blocksIn(x.free) }; });
    return { weekly, exceptions: Object.values(seen).sort((a, b) => (a.date < b.date ? -1 : 1)) };
  }

  function hasAny(entry) {
    const c = clean(entry);
    return Object.keys(c.weekly).length > 0 || c.exceptions.length > 0;
  }

  // The blocks of `date` a player is free: [] = not free, null = not said.
  function freeOn(entry, date) {
    if (!entry) return null;
    const c = clean(entry);
    const ex = c.exceptions.find((x) => x.date === date);
    if (ex) return ex.free;
    if (!Object.keys(c.weekly).length) return null;
    return c.weekly[dayOf(date)] || [];
  }

  // 'free' | 'busy' | 'unknown' for a date and (optionally) the hour a game
  // starts. With no hour, free at any time that day counts as free; an hour
  // outside the blocks is not something a player was asked about.
  function statusOn(entry, date, hour) {
    const f = freeOn(entry, date);
    if (f === null) return 'unknown';
    if (hour !== null && hour !== undefined) {
      if (!HOURS.includes(hour)) return 'unknown';
      return f.includes(hour) ? 'free' : 'busy';
    }
    return f.length ? 'free' : 'busy';
  }

  // Everyone's status for a date and time: { free, busy, unknown } of names.
  function whoIsFree(all, names, date, time) {
    const hour = hourOfTime(time);
    const out = { free: [], busy: [], unknown: [], hour };
    (names || []).forEach((n) => out[statusOn((all || {})[n], date, hour)].push(n));
    return out;
  }

  // [18, 19, 20, 9] -> '6–9pm' style ranges: '9–10am, 6–9pm'
  function rangesText(blocks) {
    const b = blocksIn(blocks), runs = [];
    b.forEach((h) => { const r = runs[runs.length - 1]; if (r && r[1] === h - 1) r[1] = h; else runs.push([h, h]); });
    return runs.map(([a, z]) => {
      const end = z + 1, from = hourLabel(a), to = hourLabel(end);
      const sameHalf = (a < 12) === (end < 12) && end !== 12;
      return `${sameHalf ? from.replace(/am|pm/, '') : from}–${to}`;
    }).join(', ');
  }

  // "Mon, Thu 6–9pm · Sat 8–11am" -- the week, briefly.
  function summary(entry) {
    const c = clean(entry);
    const groups = {};
    DAYS.forEach((d) => { const k = rangesText(c.weekly[d] || []); if (k) (groups[k] = groups[k] || []).push(DAY_LABEL[d]); });
    return Object.entries(groups).map(([k, days]) => `${days.join(', ')} ${k}`).join(' · ');
  }

  return { DAYS, DAY_LABEL, HOURS, FIRST_HOUR, LAST_HOUR, hourLabel, hourOfTime, dayOf, clean, hasAny, freeOn, statusOn, whoIsFree, rangesText, summary };
});
