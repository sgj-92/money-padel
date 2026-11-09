// ===================== THE TIER POLL: COUNTING =====================
// Shaun, 9 Nov: Padel Championships starts with a poll of everyone's tiers --
// "add everyone's name in a list, then the rows to vote are Tier S, A, B
// and C". This counts it.
//
//   * One ballot per voter: a later ballot under the same name (any case)
//     replaces the earlier one. The poll runs on trust, like "Who are you?".
//   * A voter may skip anyone they cannot judge; a skip is not a vote.
//   * The suggested tier is the MIDDLE vote (the median, S above A above B
//     above C): one outlier cannot drag a player up or down, and a split
//     down the middle goes to the lower tier. Every count is shown beside it.
//
// PURE: players and ballots are passed in.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TierPoll = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TIERS = ['S', 'A', 'B', 'C'];
  const RANK = { S: 0, A: 1, B: 2, C: 3 };

  // The list an Admin pastes: one name per line (or commas), tidied, once each.
  function parsePlayers(text) {
    const seen = new Set();
    return String(text || '').split(/[\n,]+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((n) => {
      const k = n.toLowerCase();
      if (!n || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // The ballots that count: the latest per voter, votes only for players on
  // the list and only S/A/B/C.
  function countable(players, ballots) {
    const onList = new Map(players.map((p) => [p.toLowerCase(), p]));
    const latest = new Map();
    (ballots || []).forEach((b) => {
      if (!b || !b.voter) return;
      const k = String(b.voter).trim().toLowerCase();
      const prev = latest.get(k);
      if (!prev || String(b.updatedAt || '') >= String(prev.updatedAt || '')) latest.set(k, b);
    });
    return [...latest.values()].map((b) => {
      const votes = {};
      Object.entries(b.votes || {}).forEach(([p, t]) => {
        const name = onList.get(String(p).toLowerCase());
        if (name && RANK[t] !== undefined) votes[name] = t;
      });
      return { voter: String(b.voter).trim(), updatedAt: b.updatedAt || null, votes };
    });
  }

  function median(list) {
    if (!list.length) return null;
    const sorted = list.slice().sort((a, b) => RANK[a] - RANK[b]);
    return sorted[Math.floor(sorted.length / 2)];   // an even split goes to the lower tier
  }

  // -> { voters: [...], rows: [{ player, counts: {S,A,B,C}, votes, suggested }] }
  function tally(players, ballots) {
    const counted = countable(players, ballots);
    const rows = players.map((player) => {
      const counts = { S: 0, A: 0, B: 0, C: 0 };
      const all = [];
      counted.forEach((b) => { const t = b.votes[player]; if (t) { counts[t]++; all.push(t); } });
      return { player, counts, votes: all.length, suggested: median(all) };
    });
    return { voters: counted.map((b) => b.voter).sort((a, b) => a.localeCompare(b)), rows };
  }

  return { TIERS, parsePlayers, countable, tally, median };
});
