// ===================== BETA DIAGNOSTICS =====================
// Answers one question: does the stored record still hang together?
//
// Every rating in this system is the end of a recorded chain. If the chain has
// a gap, a duplicate, an orphan, or an end that disagrees with the `players`
// collection, then a number somewhere on screen is no longer explained by the
// history behind it -- and nothing else in the application would notice.
//
// Two rules this module holds to:
//
//   * It WALKS the recorded values. It never re-runs the engine. A check that
//     recomputes what it is checking cannot detect a bad write, only a bad
//     engine, and the engine already has its own tests.
//   * It reports rather than repairs. A diagnostic that quietly fixed things
//     would destroy the evidence of what went wrong.
//
// It is given RAW documents, read from the database independently, not the
// application's in-memory copies. A check run against what the app already
// believes cannot catch a bad transformation on the way in -- it would agree
// with the bug. The screen that calls this reads the three collections itself,
// on demand, which is also why this never runs at page load.

(function (root, factory) {
  const api = factory(
    typeof require === 'function' ? require('./ratingEngine.js') : root.RatingEngine,
    typeof require === 'function' ? require('./journeyView.js') : root.JourneyView
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BetaDiagnostics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Engine, JourneyView) {
  'use strict';

  // The first rated month. Anything earlier is the display-only April/May block,
  // which is structurally barred from the record.
  const RATED_FROM = '2026-06-01';

  // Evidence is compared with a tolerance because replaying a stored event
  // round-trips it through reliability and loses a last bit. See Open Question
  // 11 in PROJECT_LEDGER.md -- deliberately surfaced here rather than hidden by
  // a loose comparison everywhere else.
  const EVIDENCE_TOLERANCE = 1e-6;

  function ok(name, detail) { return { name, status: 'ok', detail }; }
  function warn(name, detail, items) { return { name, status: 'warn', detail, items: items || [] }; }
  function fail(name, detail, items) { return { name, status: 'fail', detail, items: items || [] }; }

  function verdict(items, name, okDetail, badDetail, severity) {
    if (!items.length) return ok(name, okDetail);
    return (severity === 'warn' ? warn : fail)(name, badDetail(items.length), items.slice(0, 20));
  }

  // ---- individual checks ----

  function checkIdsUnique(journey) {
    const seen = {};
    const dupes = [];
    journey.forEach((e) => {
      const id = e.id;
      if (!id) return;
      if (seen[id]) dupes.push(id); else seen[id] = true;
    });
    return verdict([...new Set(dupes)], 'Journey ids are unique',
      `${journey.length} events, no duplicate ids`,
      (n) => `${n} duplicate event id(s) — one has overwritten another`);
  }

  function checkChainJoinsUp(journey, players) {
    const broken = [];
    Object.keys(players).forEach((name) => {
      const j = JourneyView.forPlayer(journey, name);
      if (!j) return;
      j.entries.forEach((e, i) => {
        if (i === 0 || typeof e.previousRating !== 'number') return;
        const prior = j.entries[i - 1].rating;
        if (Math.abs(e.previousRating - prior) > 1e-9) {
          broken.push(`${name} ${e.date} ${e.eventType}: starts at ${e.previousRating.toFixed(3)}, previous event left ${prior.toFixed(3)}`);
        }
      });
    });
    return verdict(broken, 'Each event starts where the last one finished',
      'every recorded chain joins up',
      (n) => `${n} break(s) in the recorded chain — a rating does not follow from the event before it`);
  }

  function checkStateMatchesHistory(journey, players) {
    const off = [];
    Object.entries(players).forEach(([name, p]) => {
      const j = JourneyView.forPlayer(journey, name);
      if (!j) { off.push(`${name}: has a rating of ${p.rating} but no recorded history at all`); return; }
      if (Math.abs(j.endRating - p.rating) > 1e-9) {
        off.push(`${name}: stored rating ${p.rating} but the history ends at ${j.endRating}`);
      }
      const lastTier = [...j.entries].reverse().find((e) => e.tier);
      if (lastTier && lastTier.tier !== p.tier) {
        off.push(`${name}: stored tier ${p.tier} but the history ends in ${lastTier.tier}`);
      }
    });
    return verdict(off, 'Stored state is the end of the stored history',
      `all ${Object.keys(players).length} players reconcile`,
      (n) => `${n} player(s) whose stored state is not where their history ends`);
  }

  function checkEvidence(journey, players) {
    const off = [];
    Object.entries(players).forEach(([name, p]) => {
      const events = journey.filter((e) => e.playerId === name && e.eventType === Engine.EVENT.MATCH_UPDATE);
      if (!events.length) return;
      const last = events.map((e) => e.effectiveEvidenceAfter).filter((v) => typeof v === 'number').pop();
      if (last === undefined) return;
      // Only flagged when a later state event did not deliberately change it.
      const later = journey.some((e) => e.playerId === name && e.eventType !== Engine.EVENT.MATCH_UPDATE
        && typeof e.newReliability === 'number'
        && e.effectiveDate >= events[events.length - 1].effectiveDate);
      if (later) return;
      if (Math.abs(p.effectiveEvidence - last) > EVIDENCE_TOLERANCE) {
        off.push(`${name}: stored evidence ${p.effectiveEvidence} vs ${last} at the last match`);
      }
    });
    return verdict(off, 'Effective evidence matches the last recorded match',
      `within ${EVIDENCE_TOLERANCE} for every player`,
      (n) => `${n} player(s) whose evidence has drifted from the record`);
  }

  // Raw match documents, so teams are teamA/teamB -- the stored shape, not the
  // winners/losers shape the application maps them into.
  function checkMatchCoverage(matches, journey) {
    const byMatch = {};
    journey.filter((e) => e.eventType === Engine.EVENT.MATCH_UPDATE)
      .forEach((e) => { (byMatch[e.matchId] = byMatch[e.matchId] || []).push(e); });
    const problems = [];
    matches.forEach((m) => {
      const evs = byMatch[m.id];
      if (!evs) { problems.push(`${m.id}: rated match with no journey events`); return; }
      // A forfeit's partner is in the match but untouched by it (ratingEngine.js).
      const expected = ((m.teamA || []).length + (m.teamB || []).length) - ((m.forfeit && m.forfeit.unaffected) || []).length;
      if (evs.length !== expected) problems.push(`${m.id}: ${evs.length} events for ${expected} players`);
    });
    const matchIds = {};
    matches.forEach((m) => { matchIds[m.id] = true; });
    Object.keys(byMatch).forEach((id) => {
      if (!matchIds[id]) problems.push(`${id}: journey events for a match that is not stored`);
    });
    return verdict(problems, 'Every match and its events agree',
      `${matches.length} matches, ${Object.keys(byMatch).length} with events`,
      (n) => `${n} match(es) where the events and the match disagree`);
  }

  function checkOrphans(journey, players) {
    const orphans = [...new Set(journey.map((e) => e.playerId).filter((n) => !players[n]))];
    const silent = Object.keys(players).filter((n) => !journey.some((e) => e.playerId === n));
    const items = orphans.map((n) => `${n}: events but no player document`)
      .concat(silent.map((n) => `${n}: player document but no events`));
    return verdict(items, 'Players and events line up',
      `${Object.keys(players).length} players, all with history`,
      (n) => `${n} player(s) on only one side of the record`);
  }

  function checkNoExcludedData(journey) {
    const early = journey.filter((e) => e.effectiveDate && e.effectiveDate < RATED_FROM)
      .map((e) => `${e.playerId} ${e.effectiveDate} ${e.eventType}`);
    return verdict(early, 'No pre-June data has entered the record',
      `nothing earlier than ${RATED_FROM}`,
      (n) => `${n} event(s) before ${RATED_FROM} — the April/May block must never be rated`);
  }

  // Compares what the application is showing against what is stored. These are
  // two different objects arrived at by different paths, so a mismatch means the
  // read layer changed something on the way in.
  function checkAppAgreesWithStore(players, appPlayers) {
    if (!appPlayers) return null;
    const off = [];
    Object.entries(players).forEach(([name, stored]) => {
      const shown = appPlayers[name];
      if (!shown) { off.push(`${name}: stored but not loaded by the application`); return; }
      if (Math.abs(shown.rating - stored.rating) > 1e-9) off.push(`${name}: showing ${shown.rating}, stored ${stored.rating}`);
      if (shown.tier !== stored.tier) off.push(`${name}: showing Tier ${shown.tier}, stored Tier ${stored.tier}`);
    });
    Object.keys(appPlayers).forEach((name) => {
      if (!players[name]) off.push(`${name}: loaded by the application but not stored`);
    });
    return verdict(off, 'What the app shows is what is stored',
      `${Object.keys(players).length} players agree`,
      (n) => `${n} player(s) where the screen and the database disagree`);
  }

  function checkSchemaVersions(players, matches, journey) {
    const versions = {};
    [].concat(players, matches, journey).forEach((d) => {
      const v = (d && d.schemaVersion) || '(none)';
      versions[v] = (versions[v] || 0) + 1;
    });
    const keys = Object.keys(versions);
    if (keys.length <= 1) return ok('One schema version throughout', keys[0] || '(no documents)');
    return warn('Mixed schema versions', keys.map((k) => `${k}: ${versions[k]}`).join(', '),
      keys.map((k) => `${k}: ${versions[k]} document(s)`));
  }

  // ---- the read-strategy review trigger (Open Question 1a) ----
  // Not a health check: the measurement the Ledger asks Claude Code to record
  // before the cumulative-read exception is allowed to grow into architecture.
  function readStrategy(journey, { loadMs, matchesPerMonth } = {}) {
    const events = journey.length;
    const perMonth = matchesPerMonth ? matchesPerMonth * 4 : null;
    return {
      events,
      documentsPerSession: events,
      loadMs: typeof loadMs === 'number' ? Math.round(loadMs) : null,
      growthPerMonth: perMonth,
      monthsUntilReview: perMonth ? Math.max(0, Math.ceil((5000 - events) / perMonth)) : null,
      // 5000 is a review point, not a limit: it is roughly where a single
      // session read stops being trivially cheap and someone should choose
      // deliberately rather than drift into it.
      reviewAt: 5000,
      due: events >= 5000 || (typeof loadMs === 'number' && loadMs > 3000),
    };
  }

  // `players`, `matches` and `journey` are raw stored documents. `appPlayers`
  // is optional: the application's own loaded state, checked against them.
  function run({ players, matches, journey, appPlayers, loadMs, matchesPerMonth }) {
    const p = players || {};
    const m = matches || [];
    const j = journey || [];
    const checks = [
      checkIdsUnique(j),
      checkChainJoinsUp(j, p),
      checkStateMatchesHistory(j, p),
      checkEvidence(j, p),
      checkMatchCoverage(m, j),
      checkOrphans(j, p),
      checkNoExcludedData(j),
      checkSchemaVersions(Object.values(p), m, j),
      checkAppAgreesWithStore(p, appPlayers),
    ].filter(Boolean);
    const failed = checks.filter((c) => c.status === 'fail').length;
    const warned = checks.filter((c) => c.status === 'warn').length;
    return {
      checks,
      failed,
      warned,
      healthy: failed === 0,
      counts: { players: Object.keys(p).length, matches: m.length, journey: j.length },
      readStrategy: readStrategy(j, { loadMs, matchesPerMonth }),
    };
  }

  return { run, readStrategy, RATED_FROM, EVIDENCE_TOLERANCE };
});
