// ===================== A RESULT'S ASTERISK AND NOTE =====================
// Shaun, 6 Nov: "a few games lately with disagreements and forfeits. I want
// to be able to add an asterisk to a result and also leave a note."
//
// An Admin marks a rated result with an asterisk, a note, or both. It is an
// annotation: the result, every rating, table and race stay exactly as they
// are. Stored beside the record, never in it -- the club's
// `moneypadel_match_notes` document, { matchId: entry } -- the same way
// who-submitted-it is (matchAttribution.js). Only an Admin can write it
// (firestore.rules: not a member document).
//
// PURE: the stored map is passed in.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MatchNote = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'moneypadel_match_notes';
  const MAX_NOTE = 280;

  // What an Admin saved, tidied; null when there is nothing left to show.
  function entry({ asterisk, note, by, at } = {}) {
    const text = String(note || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE);
    if (!asterisk && !text) return null;
    return { asterisk: !!asterisk, note: text, by: by || null, at: at || null };
  }

  function forMatch(notes, matchId) {
    const e = notes && matchId ? notes[matchId] : null;
    return e && (e.asterisk || e.note) ? e : null;
  }

  // The map with one match's entry set, replaced or (null) removed.
  function withEntry(notes, matchId, e) {
    const next = { ...(notes || {}) };
    if (e) next[matchId] = e; else delete next[matchId];
    return next;
  }

  // A game corrected onto another date gets a new identifier; its note goes
  // with it.
  function carried(notes, oldId, newId) {
    if (!notes || !notes[oldId] || oldId === newId) return notes;
    const next = { ...notes, [newId]: notes[oldId] };
    delete next[oldId];
    return next;
  }

  // Plain text, for copied results: "6-4, 6-3*" and the note's own line.
  const mark = (e) => (e && e.asterisk ? '*' : '');
  function noteLine(e) {
    if (!e || !e.note) return '';
    return `${e.asterisk ? '* ' : 'Note: '}${e.note}`;
  }

  return { STORAGE_KEY, MAX_NOTE, entry, forMatch, withEntry, carried, mark, noteLine };
});
