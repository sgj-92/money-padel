#!/usr/bin/env node
// Import a production match-facts export into the v3 record.
//
//   node scripts/moneypadel/import-production-matches.js --file export.json            # dry run
//   node scripts/moneypadel/import-production-matches.js --file export.json --report r.md
//   node scripts/moneypadel/import-production-matches.js --file export.json --write
//
// Dry run is the default and writes nothing. It is exhaustive on purpose: the
// whole plan -- what already exists, what is genuinely new, what conflicts,
// who moves and by how much -- is printed before anyone can approve a write.
//
// MATCH FACTS ONLY. Production ratings, rankings, tiers and reliability are
// never read. What is imported is what happened on court.
//
// Idempotent. Re-running it after a write finds everything already present and
// reports zero new matches, so the same export can be fed in repeatedly and a
// later export that merely extends this one imports only its additions.
//
// Three rules it will not bend:
//
//   * Production's winner/draw flag is authoritative. It is never inferred
//     from, or overwritten by, the orientation of the set scores. Production
//     genuinely stores decided matches whose first-listed side has the losing
//     scoreline, and that is preserved rather than "fixed".
//   * Score arrays are carried across exactly as stored.
//   * Pre-June data is display-only and cannot enter the rating record. Those
//     rows are reported and excluded; they are not written.

const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../../assets/js/ratingEngine.js');
const Store = require('../../assets/js/ratingStore.js');
const Replay = require('../../assets/js/replayForward.js');
const { PROJECT_ID } = require('./seed-beta.js');

// The v3 rating record starts here. Anything earlier is display-only, by a
// standing decision that predates this importer.
const RATING_EPOCH = '2026-06-01';

// ---------------------------------------------------------------------------
// Identity
//
// Production ids (`base_79`, `sub_1758…`, `early_0`) and v3 ids
// (`YYYY-MM-DD-N`) share no namespace, so identity has to be factual.
//
// A match is identified by its FIXTURE: the date, and the two rosters as an
// unordered pair. That is deliberately narrower than "everything about the
// match", because an identity that included the score could never detect a
// score conflict -- a corrected score would simply look like a different
// match, and would be silently appended as a new one.
//
// Fixtures do repeat: the same four players play again the same evening. So a
// fixture key addresses a GROUP, and records inside a group are paired up by
// their full facts. What is left over after pairing is what this importer has
// to reason about.
// ---------------------------------------------------------------------------

function rosterKey(players) {
  return [...players].map((n) => String(n).trim()).sort().join('+');
}

function fixtureKey(date, sideOne, sideTwo) {
  const a = rosterKey(sideOne), b = rosterKey(sideTwo);
  return `${date}|${a < b ? a : b}|${a < b ? b : a}`;
}

// The facts, in an orientation-independent form, so two records of the same
// match agree however each store happened to order the sides.
function factsKey(date, sideOne, sideTwo, sets, outcome) {
  const a = rosterKey(sideOne), b = rosterKey(sideTwo);
  const flip = !(a < b);
  const orientedSets = (sets || []).map(([x, y]) => (flip ? [y, x] : [x, y]));
  const orientedOutcome = !flip ? outcome
    : (outcome === Engine.OUTCOME.A_WINS ? Engine.OUTCOME.B_WINS
      : outcome === Engine.OUTCOME.B_WINS ? Engine.OUTCOME.A_WINS : outcome);
  return `${fixtureKey(date, sideOne, sideTwo)}|${orientedSets.map((s) => s.join('-')).join(',')}|${orientedOutcome}`;
}

// ---------------------------------------------------------------------------
// Reading the export
// ---------------------------------------------------------------------------

function normaliseExportRecord(raw, index) {
  const problems = [];
  if (!raw.matchId) problems.push('missing matchId');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date || '')) problems.push(`bad date ${JSON.stringify(raw.date)}`);
  const one = Array.isArray(raw.team1Players) ? raw.team1Players : [];
  const two = Array.isArray(raw.team2Players) ? raw.team2Players : [];
  if (!one.length || !two.length) problems.push('missing players');
  const sets = Array.isArray(raw.sets) ? raw.sets : [];
  if (!sets.length) problems.push('missing sets');
  sets.forEach((s, i) => {
    if (!Array.isArray(s) || s.length !== 2 || !Number.isFinite(s[0]) || !Number.isFinite(s[1])) {
      problems.push(`set ${i + 1} is not a pair of numbers`);
    }
  });

  // Production's flag, read as production wrote it. `team2` is accepted even
  // though this export does not use it, so a future export that does is not
  // silently misread as a team1 win.
  let outcome = null;
  if (raw.winner === 'draw') outcome = Engine.OUTCOME.DRAW;
  else if (raw.winner === 'team1') outcome = Engine.OUTCOME.A_WINS;
  else if (raw.winner === 'team2') outcome = Engine.OUTCOME.B_WINS;
  else problems.push(`unrecognised winner ${JSON.stringify(raw.winner)}`);

  return {
    index,
    productionId: raw.matchId,
    date: raw.date,
    sideOne: one.map((n) => String(n).trim()),
    sideTwo: two.map((n) => String(n).trim()),
    sets: sets.map((s) => [s[0], s[1]]),   // exactly as stored
    outcome,
    type: raw.type || null,
    status: raw.status === undefined ? null : raw.status,
    origin: raw._origin || null,
    problems,
  };
}

function loadExport(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('The export must be a JSON array of match records.');
  return raw.map(normaliseExportRecord);
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

function compare(exported, storedMatches) {
  const stored = storedMatches.map(Store.matchFromDoc);

  const groups = {};   // fixtureKey -> { stored: [], exported: [] }
  const group = (k) => (groups[k] = groups[k] || { stored: [], exported: [] });
  stored.forEach((m) => group(fixtureKey(m.date, m.teamA, m.teamB)).stored.push(m));
  exported.forEach((r) => group(fixtureKey(r.date, r.sideOne, r.sideTwo)).exported.push(r));

  const alreadyPresent = [];   // exported record paired to a stored match
  const brandNew = [];         // exported record with no counterpart
  const conflicts = [];        // same fixture, different facts, nothing spare
  const onlyInV3 = [];         // stored match the export does not carry

  Object.entries(groups).forEach(([key, g]) => {
    const storedByFacts = new Map();
    g.stored.forEach((m) => {
      const k = factsKey(m.date, m.teamA, m.teamB, m.sets, m.outcome);
      if (!storedByFacts.has(k)) storedByFacts.set(k, []);
      storedByFacts.get(k).push(m);
    });

    const unpairedExported = [];
    g.exported.forEach((r) => {
      const k = factsKey(r.date, r.sideOne, r.sideTwo, r.sets, r.outcome);
      const bucket = storedByFacts.get(k);
      if (bucket && bucket.length) {
        alreadyPresent.push({ exported: r, stored: bucket.shift() });
      } else {
        unpairedExported.push(r);
      }
    });

    const unpairedStored = [];
    storedByFacts.forEach((bucket) => bucket.forEach((m) => unpairedStored.push(m)));

    // What is left in this fixture decides the reading. An exported record with
    // no stored counterpart is only NEW if the fixture has no leftover stored
    // match to disagree with. If both sides have leftovers, the same fixture is
    // recorded differently in the two systems -- that is a conflict, and it
    // stops the import rather than appending a near-duplicate.
    const n = Math.min(unpairedExported.length, unpairedStored.length);
    for (let i = 0; i < n; i++) {
      conflicts.push({ fixture: key, exported: unpairedExported[i], stored: unpairedStored[i] });
    }
    unpairedExported.slice(n).forEach((r) => brandNew.push(r));
    unpairedStored.slice(n).forEach((m) => onlyInV3.push(m));
  });

  brandNew.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.index - b.index));
  return { alreadyPresent, brandNew, conflicts, onlyInV3 };
}

// ---------------------------------------------------------------------------
// Turning a new production record into a v3 match
// ---------------------------------------------------------------------------

// v3 ids are `YYYY-MM-DD-N`, N being the same-date sequence. A new match
// continues its date's sequence rather than reusing a number, so ids stay
// unique and stable however many imports run.
function nextIndexes(storedMatches) {
  const highest = {};
  storedMatches.forEach((d) => {
    const n = Number(String(d.id).slice(String(d.id).lastIndexOf('-') + 1));
    if (Number.isFinite(n)) highest[d.date] = Math.max(highest[d.date] || 0, n);
  });
  return highest;
}

function toV3Match(record, sourceIndex) {
  // Team A is production's team1 and the sets keep production's orientation.
  // Neither is re-derived from the other: the winner flag is production's, and
  // a decided match whose first-listed side has the losing scoreline stays
  // exactly as production recorded it.
  return {
    id: `${record.date}-${sourceIndex}`,
    sourceIndex,
    date: record.date,
    teamA: record.sideOne,
    teamB: record.sideTwo,
    sets: record.sets.map((s) => [s[0], s[1]]),
    outcome: record.outcome,
    type: record.type,
    drawSideAssignmentArbitrary: record.outcome === Engine.OUTCOME.DRAW,
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const fmtSets = (sets) => sets.map((s) => s.join('-')).join(', ');
const fmtSide = (players) => players.join(' & ');

function describeRecord(r) {
  const verb = r.outcome === Engine.OUTCOME.DRAW ? 'vs' : 'def';
  return `${r.date}  ${fmtSide(r.sideOne)} ${verb} ${fmtSide(r.sideTwo)}  ${fmtSets(r.sets)}`
    + `  [${r.productionId}${r.type && r.type !== 'doubles' ? ', ' + r.type : ''}]`;
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const file = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
  const reportAt = args.includes('--report') ? args[args.indexOf('--report') + 1] : null;
  if (!file) { console.error('Usage: node scripts/moneypadel/import-production-matches.js --file <export.json> [--report out.md] [--write]'); process.exitCode = 1; return; }

  const lines = [];
  const say = (s = '') => { lines.push(s); console.log(s); };

  const exported = loadExport(path.resolve(file));

  say('Production match-facts import — ' + (write ? 'WRITE' : 'DRY RUN (nothing will be written)'));
  say('  project   : ' + PROJECT_ID);
  say('  export    : ' + path.resolve(file));
  say('  records   : ' + exported.length);
  say('');

  // ---- 1. the export itself -------------------------------------------
  const malformed = exported.filter((r) => r.problems.length);
  const dupIds = Object.entries(exported.reduce((acc, r) => {
    acc[r.productionId] = (acc[r.productionId] || 0) + 1; return acc;
  }, {})).filter(([, n]) => n > 1);

  say('1. EXPORT INTEGRITY');
  say(`   malformed records    : ${malformed.length}`);
  malformed.slice(0, 20).forEach((r) => say(`     ${r.productionId}: ${r.problems.join('; ')}`));
  say(`   duplicate production ids : ${dupIds.length}`);
  dupIds.slice(0, 20).forEach(([id, n]) => say(`     ${id} x${n}`));
  const byOutcome = exported.reduce((acc, r) => { acc[r.outcome] = (acc[r.outcome] || 0) + 1; return acc; }, {});
  say('   outcomes as production recorded them : '
    + Object.entries(byOutcome).map(([k, v]) => `${k} ${v}`).join(', '));
  const misoriented = exported.filter((r) => {
    if (r.outcome !== Engine.OUTCOME.A_WINS) return false;
    const a = r.sets.reduce((n, s) => n + s[0], 0), b = r.sets.reduce((n, s) => n + s[1], 0);
    return a < b;
  });
  say(`   decided matches whose first side has the losing scoreline : ${misoriented.length}`);
  say('     (production\'s winner flag is authoritative; these are preserved, not corrected)');
  if (malformed.length) {
    say('\nSTOPPED: the export has malformed records. Nothing was compared or written.');
    if (reportAt) fs.writeFileSync(path.resolve(reportAt), lines.join('\n'));
    process.exitCode = 1;
    return;
  }
  say('');

  // ---- 2. pre-June, which can never enter the rating record ------------
  const preEpoch = exported.filter((r) => r.date < RATING_EPOCH);
  const eligible = exported.filter((r) => r.date >= RATING_EPOCH);
  say('2. PRE-JUNE (display-only, excluded by standing decision)');
  say(`   records before ${RATING_EPOCH} : ${preEpoch.length}`);
  if (preEpoch.length) {
    say(`   dates ${preEpoch.map((r) => r.date).sort()[0]} .. ${preEpoch.map((r) => r.date).sort().slice(-1)[0]}`);
    say('   These are NOT imported. They are already carried by the app as');
    say('   HISTORICAL_DISPLAY_MATCHES and must never reach a rating calculation.');
  }
  say(`   records eligible for the rating record : ${eligible.length}`);
  say('');

  // ---- 3. against the live record --------------------------------------
  const backend = Store.firestoreRestBackend({ projectId: PROJECT_ID });
  return (async () => {
    const [storedMatches, storedJourney, storedPlayers] = await Promise.all([
      backend.getAll(Store.COLLECTIONS.matches),
      backend.getAll(Store.COLLECTIONS.journey),
      backend.getAll(Store.COLLECTIONS.players),
    ]);
    say('3. AGAINST THE LIVE v3 RECORD');
    say(`   v3 matches : ${storedMatches.length}   journey events : ${storedJourney.length}   players : ${storedPlayers.length}`);

    const { alreadyPresent, brandNew, conflicts, onlyInV3 } = compare(eligible, storedMatches);
    say(`   already present (deduplicated) : ${alreadyPresent.length}`);
    say(`   genuinely new                  : ${brandNew.length}`);
    say(`   conflicting                    : ${conflicts.length}`);
    say(`   in v3 but not in this export   : ${onlyInV3.length}`);
    onlyInV3.slice(0, 20).forEach((m) => say(
      `     ${m.id}  ${m.date}  ${fmtSide(m.teamA)} vs ${fmtSide(m.teamB)}  ${fmtSets(m.sets)}`));
    if (onlyInV3.length) {
      say('     (reported only — an import never deletes. Investigate separately.)');
    }
    say('');

    // ---- 4. conflicts stop the import ----------------------------------
    if (conflicts.length) {
      say('4. CONFLICTS — SAME FIXTURE, DIFFERENT FACTS');
      say('   The same date and the same four players are recorded differently in');
      say('   the two systems. This is not a new match and it is not a duplicate,');
      say('   so it is neither appended nor silently replaced.');
      conflicts.forEach((c) => {
        say('');
        say(`   fixture ${c.fixture}`);
        say(`     v3         ${c.stored.id}  ${fmtSide(c.stored.teamA)} vs ${fmtSide(c.stored.teamB)}`
          + `  ${fmtSets(c.stored.sets)}  ${c.stored.outcome}`);
        say(`     production ${c.exported.productionId}  ${fmtSide(c.exported.sideOne)} vs ${fmtSide(c.exported.sideTwo)}`
          + `  ${fmtSets(c.exported.sets)}  ${c.exported.outcome}`);
      });
      say('');
      say('STOPPED: resolve these before importing. Nothing was written.');
      if (reportAt) fs.writeFileSync(path.resolve(reportAt), lines.join('\n'));
      process.exitCode = 1;
      return;
    }
    say('4. CONFLICTS');
    say('   none — every fixture the two systems share agrees on its facts.');
    say('');

    // ---- 5. the new matches --------------------------------------------
    say('5. NEW MATCHES');
    if (!brandNew.length) {
      say('   none. The v3 record already carries every rated match in this export.');
      say('');
      say('Nothing to import.');
      if (reportAt) fs.writeFileSync(path.resolve(reportAt), lines.join('\n'));
      return;
    }
    say(`   ${brandNew.length}, from ${brandNew[0].date} to ${brandNew[brandNew.length - 1].date}`);
    say('');
    brandNew.forEach((r, i) => say(`   ${String(i + 1).padStart(3)}. ${describeRecord(r)}`));
    const newDraws = brandNew.filter((r) => r.outcome === Engine.OUTCOME.DRAW).length;
    const newPending = brandNew.filter((r) => r.status && r.status !== 'approved');
    say('');
    say(`   draws among them : ${newDraws}`);
    if (newPending.length) {
      say(`   NOT approved in production : ${newPending.length}`);
      newPending.forEach((r) => say(`     ${r.productionId} (status ${r.status})`));
      say('   A production submission that is not approved has not been accepted as a');
      say('   result, so it is excluded from this import.');
    }
    const importable = brandNew.filter((r) => !r.status || r.status === 'approved');
    say('');

    // ---- 6. player mappings --------------------------------------------
    const known = new Set(storedPlayers.map((p) => p.id));
    const unknown = {};
    importable.forEach((r) => [...r.sideOne, ...r.sideTwo].forEach((n) => {
      if (!known.has(n)) (unknown[n] = unknown[n] || []).push(`${r.date} ${r.productionId}`);
    }));
    say('6. PLAYER NAME MAPPINGS');
    say(`   distinct names in the new matches : ${new Set(importable.flatMap((r) => [...r.sideOne, ...r.sideTwo])).size}`);
    say(`   unknown to the v3 players collection : ${Object.keys(unknown).length}`);
    Object.entries(unknown).forEach(([n, where]) => say(`     ${n} — first in ${where[0]}`));
    if (Object.keys(unknown).length) {
      say('');
      say('STOPPED: a player with no v3 record has no rating to move, and a starting');
      say('   tier is a club decision, not something an importer may invent.');
      say('   Initialise them with a tier first, then re-run. Nothing was written.');
      if (reportAt) fs.writeFileSync(path.resolve(reportAt), lines.join('\n'));
      process.exitCode = 1;
      return;
    }
    say('   every name maps to an existing v3 player.');
    say('');

    // ---- 7. the replay plan --------------------------------------------
    const next = nextIndexes(storedMatches);
    const v3Matches = [];
    [...importable]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.index - b.index))
      .forEach((r) => {
        next[r.date] = (next[r.date] || 0) + 1;
        v3Matches.push({ record: r, match: toV3Match(r, next[r.date]) });
      });

    const stored = { matches: storedMatches, journey: storedJourney, players: storedPlayers };
    const provenance = {
      createdBy: 'import-production-matches',
      recordedAt: new Date().toISOString().slice(0, 10) + 'T00:00:00Z',
      source: 'production match-facts export ' + path.basename(file),
    };

    say('7. REPLAY PLAN');
    say('   Replayed chronologically through the existing replay-forward path.');
    say('   New v3 match ids continue each date\'s own sequence:');
    v3Matches.forEach(({ record, match }) => say(`     ${match.id}  <- ${record.productionId}`));
    say('');

    let planned;
    try {
      planned = Replay.plan({
        stored,
        change: { type: 'appendMany', matches: v3Matches.map((x) => x.match) },
        provenance,
      });
    } catch (e) {
      say('   REFUSED: ' + e.message);
      say('');
      say('STOPPED: nothing was written.');
      if (reportAt) fs.writeFileSync(path.resolve(reportAt), lines.join('\n'));
      process.exitCode = 1;
      return;
    }

    say(`   documents to write  : ${planned.documentsToWrite}`);
    say(`   documents to delete : ${planned.documentsToDelete}`);
    Object.entries(planned.writes).forEach(([c, docs]) => { if (docs.length) say(`     ${c.padEnd(14)} ${docs.length}`); });
    say('');
    say(`8. PROJECTED RATING CHANGES — ${planned.playersMoved.length} player(s) move`);
    planned.playersMoved.forEach((m) => say(
      `   ${String(m.playerId).padEnd(12)} ${m.from === null ? '   new' : m.from.toFixed(1).padStart(8)}`
      + ` -> ${m.to.toFixed(1).padStart(8)}  ${m.delta === null ? '' : (m.delta > 0 ? '+' : '') + m.delta}`));
    say('');

    if (!write) {
      say('Nothing was written. Re-run with --write to apply this plan.');
      if (reportAt) { fs.writeFileSync(path.resolve(reportAt), lines.join('\n')); say('Report written to ' + reportAt); }
      return;
    }

    say('Writing ...');
    const result = await Replay.commit(backend, planned);
    say(`Done. ${result.written} documents written, ${result.deleted} deleted.`);

    // Re-read and prove the record still replays to itself.
    const after = {
      matches: await backend.getAll(Store.COLLECTIONS.matches),
      journey: await backend.getAll(Store.COLLECTIONS.journey),
      players: await backend.getAll(Store.COLLECTIONS.players),
    };
    const check = Replay.verifyNoOp(after, provenance);
    say(`Post-write verification: ${check.identical ? 'the record replays to itself exactly (0 differences)'
      : check.count + ' DIFFERENCE(S) — ' + check.differences.slice(0, 10).join('; ')}`);
    say(`Record now: ${after.matches.length} matches, ${after.journey.length} journey events, ${after.players.length} players.`);
    if (!check.identical) process.exitCode = 1;
    if (reportAt) { fs.writeFileSync(path.resolve(reportAt), lines.join('\n')); say('Report written to ' + reportAt); }
  })().catch((e) => { console.error(e); process.exitCode = 1; });
}

if (require.main === module) main();
module.exports = { RATING_EPOCH, rosterKey, fixtureKey, factsKey, normaliseExportRecord, compare, toV3Match, nextIndexes };
