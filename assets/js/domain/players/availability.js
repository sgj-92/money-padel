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
// Half-hour blocks where a player asks for them (Shaun, 19 Nov: "Split into
// half an hour blocks if the player requests it. So for me I can do 8:30pm
// onwards"). Everything is stored in half-hours (unit: 'half'): 20.5 is
// 8:30–9pm. An hour on the hourly grid is its two halves. Entries saved
// before (whole hours, or morning / afternoon / evening) read as the
// half-hours they covered. Nothing set means unknown, never "busy".
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
  const HALVES = HOURS.flatMap((h) => [h, h + 0.5]);   // 8, 8.5 … 21.5
  const LEGACY = { morning: [8, 9, 10, 11], afternoon: [12, 13, 14, 15, 16], evening: [17, 18, 19, 20, 21] };

  // 8 -> '8am', 12 -> '12pm', 21 -> '9pm', 20.5 -> '8:30pm', 22 -> '10pm'
  function hourLabel(h) {
    const whole = Math.floor(h), half = h !== whole ? ':30' : '';
    const ampm = whole >= 12 ? 'pm' : 'am', shown = whole > 12 ? whole - 12 : whole;
    return `${shown}${half}${ampm}`;
  }

  // "21:00" -> 21, "20:30" -> 20.5, "20:45" -> 20.5. No time -> null.
  function hourOfTime(time) {
    const m = String(time || '').match(/^(\d{1,2})(?::(\d{2}))?/);
    if (!m) return null;
    return Number(m[1]) + (Number(m[2] || 0) >= 30 ? 0.5 : 0);
  }
  // 'YYYY-MM-DD' -> 'mon'..'sun' (the date as written, not the reader's zone).
  function dayOf(date) {
    const d = new Date(`${date}T12:00:00Z`);
    return DAYS[(d.getUTCDay() + 6) % 7];
  }

  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  // Half-hour blocks, in order. In half-hour entries a number is its own
  // half; in older ones a whole number is the whole hour (both halves), and a
  // part-of-day name is the hours it covered.
  function blocksIn(a, halves) {
    const set = new Set();
    (a || []).forEach((x) => {
      if (LEGACY[x]) { LEGACY[x].forEach((h) => { set.add(h); set.add(h + 0.5); }); return; }
      const n = Number(x);
      if (!HALVES.includes(n)) return;
      set.add(n);
      if (!halves && Number.isInteger(n)) set.add(n + 0.5);
    });
    return HALVES.filter((h) => set.has(h));
  }

  // What is stored: half-hours, only known days and blocks, one exception per
  // date, sorted; and whether the player asked for the half-hour grid.
  function clean(entry) {
    const halves = !!(entry && entry.unit === 'half');
    const weekly = {};
    DAYS.forEach((d) => { const s = blocksIn(entry && entry.weekly && entry.weekly[d], halves); if (s.length) weekly[d] = s; });
    const seen = {};
    ((entry && entry.exceptions) || []).forEach((x) => { if (x && isDate(x.date)) seen[x.date] = { date: x.date, free: blocksIn(x.free, halves) }; });
    return { unit: 'half', halfHourGrid: !!(entry && entry.halfHourGrid), weekly, exceptions: Object.values(seen).sort((a, b) => (a.date < b.date ? -1 : 1)) };
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
      if (!HALVES.includes(hour)) return 'unknown';
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

  // Half-hours -> ranges: [9, 9.5, 10, 10.5, 20.5, 21, 21.5] -> '9–11am, 8:30–10pm'
  function rangesText(blocks) {
    const b = HALVES.filter((h) => (blocks || []).map(Number).includes(h)), runs = [];
    b.forEach((h) => { const r = runs[runs.length - 1]; if (r && r[1] === h - 0.5) r[1] = h; else runs.push([h, h]); });
    return runs.map(([a, z]) => {
      const end = z + 0.5, from = hourLabel(a), to = hourLabel(end);
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

  return { DAYS, DAY_LABEL, HOURS, HALVES, FIRST_HOUR, LAST_HOUR, hourLabel, hourOfTime, dayOf, clean, hasAny, freeOn, statusOn, whoIsFree, rangesText, summary };
});
