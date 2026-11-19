// ===================== WHEN A PLAYER CAN PLAY =====================
// Shaun, 19 Nov: players "put their schedule for when they can play".
// Decided: a weekly pattern plus exceptions. A week has three parts a day --
// morning, afternoon, evening; an exception is one date, either "not free"
// all day or free at the parts named (which then replace the week's for that
// date).
//
//   { weekly: { mon: ['evening'], thu: ['evening'], sat: ['morning'] },
//     exceptions: [{ date: '2026-11-28', free: [] },              // not free
//                  { date: '2026-11-30', free: ['morning'] }],    // free then
//     updatedAt, by }
//
// Nothing set means unknown, never "busy". Pure: no storage, no screen.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Availability = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const DAY_LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const SLOTS = ['morning', 'afternoon', 'evening'];
  const SLOT_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
  const SLOT_HINT = { morning: 'before 12', afternoon: '12–5pm', evening: 'after 5pm' };

  // "19:00" -> 'evening'. No time -> null (the whole day is asked about).
  function slotOfTime(time) {
    const m = String(time || '').match(/^(\d{1,2}):?(\d{2})?/);
    if (!m) return null;
    const h = Number(m[1]);
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  }
  // 'YYYY-MM-DD' -> 'mon'..'sun' (the date as written, not the reader's zone).
  function dayOf(date) {
    const d = new Date(`${date}T12:00:00Z`);
    return DAYS[(d.getUTCDay() + 6) % 7];
  }

  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const slotsIn = (a) => SLOTS.filter((s) => (a || []).includes(s));

  // What is stored: only known days and parts, one exception per date, sorted.
  function clean(entry) {
    const weekly = {};
    DAYS.forEach((d) => { const s = slotsIn(entry && entry.weekly && entry.weekly[d]); if (s.length) weekly[d] = s; });
    const seen = {};
    ((entry && entry.exceptions) || []).forEach((x) => { if (x && isDate(x.date)) seen[x.date] = { date: x.date, free: slotsIn(x.free) }; });
    return { weekly, exceptions: Object.values(seen).sort((a, b) => (a.date < b.date ? -1 : 1)) };
  }

  function hasAny(entry) {
    const c = clean(entry);
    return Object.keys(c.weekly).length > 0 || c.exceptions.length > 0;
  }

  // The parts of `date` a player is free: [] = not free, null = not said.
  function freeOn(entry, date) {
    if (!entry) return null;
    const c = clean(entry);
    const ex = c.exceptions.find((x) => x.date === date);
    if (ex) return ex.free;
    if (!Object.keys(c.weekly).length) return null;
    return c.weekly[dayOf(date)] || [];
  }

  // 'free' | 'busy' | 'unknown' for a date and (optionally) a part of it.
  // With no part, free at any part of the day counts as free.
  function statusOn(entry, date, slot) {
    const f = freeOn(entry, date);
    if (f === null) return 'unknown';
    if (slot) return f.includes(slot) ? 'free' : 'busy';
    return f.length ? 'free' : 'busy';
  }

  // Everyone's status for a date and time: { free, busy, unknown } of names.
  function whoIsFree(all, names, date, time) {
    const slot = slotOfTime(time);
    const out = { free: [], busy: [], unknown: [], slot };
    (names || []).forEach((n) => out[statusOn((all || {})[n], date, slot)].push(n));
    return out;
  }

  // "Mon, Thu evenings · Sat morning" -- the week, briefly.
  function summary(entry) {
    const c = clean(entry);
    const groups = {};
    DAYS.forEach((d) => { const k = (c.weekly[d] || []).join('+'); if (k) (groups[k] = groups[k] || []).push(DAY_LABEL[d]); });
    const parts = Object.entries(groups).map(([k, days]) => `${days.join(', ')} ${k.split('+').map((s) => SLOT_LABEL[s].toLowerCase() + (days.length > 1 ? 's' : '')).join(' & ')}`);
    return parts.length ? parts.join(' · ') : '';
  }

  return { DAYS, DAY_LABEL, SLOTS, SLOT_LABEL, SLOT_HINT, slotOfTime, dayOf, clean, hasAny, freeOn, statusOn, whoIsFree, summary };
});
