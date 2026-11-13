// ===================== ASK CLAUDE: READING THE RECORD =====================
// The community's record as anyone may read it (the database rules make it
// public): players, matches and the rating journey, plus the Admin's notes on
// results and the tier list. Read fresh for every question.

'use strict';

const Store = require('../../assets/js/ratingStore.js');

async function clubDoc(projectId, key, doFetch) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/moneypadel/${encodeURIComponent(key)}`;
  const res = await doFetch(url);
  if (!res.ok) return null;
  const body = await res.json();
  const v = body.fields && body.fields.value && body.fields.value.stringValue;
  try { return v ? JSON.parse(v) : null; } catch (e) { return null; }
}

async function loadRecord({ projectId, fetchImpl }) {
  const doFetch = fetchImpl || globalThis.fetch;
  const backend = Store.firestoreRestBackend({ projectId, fetchImpl: doFetch });
  const [players, matches, journey, notes, tags] = await Promise.all([
    backend.getAll('players'), backend.getAll('matches'), backend.getAll('ratingJourney'),
    clubDoc(projectId, 'moneypadel_match_notes', doFetch), clubDoc(projectId, 'moneypadel_player_tags', doFetch),
  ]);
  return { players, matches, journey, notes: notes || {}, tags: tags || {} };
}

module.exports = { loadRecord };
