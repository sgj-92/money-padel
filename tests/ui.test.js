// Regression tests for the application, not its modules.
//
// Each test here corresponds to a defect that actually shipped during the v3
// integration and was found by a person driving a browser. Every module
// involved was correct in isolation; the application wired them up wrongly, so
// no module test could have caught any of it.
//
// Skips when Playwright or a browser is unavailable. A suite that goes red for
// an absent dependency teaches people to ignore red.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');
// The same module the page loads, for assertions that compare against the rule
// rather than restating it.
const GameType = require('../assets/js/gameType.js');

const skip = H.available() ? false : 'Playwright is not available in this environment';

// One browser for the read-only checks; the ones that write get their own.
// The fixture's games end on 16 Sep. Anything here that asks what is "recent"
// (rankings, participation, the current month) is pinned inside that era, so
// the suite does not start failing as the real calendar walks away from it.
const FIXTURE_NOW = '2026-09-21T10:00:00.000Z';

let shared = null;
test.before(async () => { if (!skip) shared = await H.open({ now: FIXTURE_NOW }); });
test.after(async () => { if (shared) await shared.close(); });

test('the app loads, renders, and throws nothing', { skip }, async () => {
  const state = await shared.run(() => ({
    loaded: V3_STATE.loaded,
    error: V3_STATE.error || null,
    players: PLAYERS.length,
    matches: ALL_MATCHES.length,
    rows: document.querySelectorAll('#list .row').length,
  }));
  assert.strictEqual(state.loaded, true, state.error);
  assert.strictEqual(state.players, 34);
  assert.ok(state.rows > 0, 'the rankings list rendered nothing');
  assert.deepStrictEqual(shared.pageErrors, []);
});

// Shipped defect: MONTHLY_VIEWS was built with TIER_MAP, which is {} at that
// point, so tierAsOf answered undefined for everyone outside the three-entry
// change list. June's Tier C king vanished and nothing noticed.
test('historical tier is real in the browser, not just in Node', { skip }, async () => {
  const r = await shared.run(() => {
    const out = { counts: {}, leaks: [] };
    const june = MONTHLY_VIEWS.byMonth['2026-06'];
    june.rows.forEach((x) => { const k = String(x.tierAtMonthEnd); out.counts[k] = (out.counts[k] || 0) + 1; });
    activeTab = 'power'; activeSortP = 'rating'; query = ''; minGames = 5;
    ['2026-06', '2026-07', '2026-08'].forEach((m) => {
      selectedMonth = m;
      ['A', 'B', 'C'].forEach((t) => {
        activeTier = t;
        PLAYERS.filter(matchesActiveTier).forEach((p) => {
          if (tierInScope(p) !== t) out.leaks.push(`${m} ${t}: ${p.name}`);
        });
      });
    });
    // Kings are filed under the tier held at that month's close, not today's.
    out.kingTiers = [];
    ['2026-06', '2026-07', '2026-08', '2026-09'].forEach((m) => {
      const kings = kingsOfTiersFor(m);
      ['A', 'B', 'C'].forEach((t) => { if (kings && kings[t]) out.kingTiers.push([m, t, kings[t].name, tierAtMonthClose(kings[t].name, m)]); });
    });
    selectedMonth = 'all'; activeTier = 'All'; minGames = 10;
    return out;
  });
  assert.strictEqual(r.counts.undefined, undefined, `June rows with no tier: ${JSON.stringify(r.counts)}`);
  assert.deepStrictEqual(r.leaks, [], 'a player appeared under a tier they did not hold that month');
  assert.ok(r.kingTiers.length >= 4, JSON.stringify(r.kingTiers));
  r.kingTiers.forEach(([m, t, name, held]) => assert.strictEqual(held, t, `${m}: ${name} is Tier ${t} King but held Tier ${held}`));
});

// Shipped defect: the profile journey was a separate reconstruction that could
// disagree with the Power Rating, so the UI carried a disclaimer saying so.
test('the Rating Journey ends on the Power Rating and carries no disclaimer', { skip }, async () => {
  const r = await shared.run(() => {
    const out = { mismatched: [], disclaimer: false };
    Object.keys(V3_STATE.players).forEach((name) => {
      const j = JourneyView.forPlayer(V3_JOURNEY, name);
      if (!j) { out.mismatched.push(`${name}: no journey`); return; }
      if (Math.abs(j.endRating - V3_STATE.players[name].rating) > 1e-9) out.mismatched.push(name);
    });
    openSheet('Shaun');
    out.disclaimer = /Story estimate/.test(document.body.innerHTML);
    out.section = document.getElementById('sheetProfile').innerText;
    closeSheet();
    return out;
  });
  assert.deepStrictEqual(r.mismatched, []);
  assert.strictEqual(r.disclaimer, false);
  assert.match(r.section, /Rating journey/);
  assert.ok(!/not the official calculation/.test(r.section));
});

// Shipped defect: expectations were derived from TODAY's ratings and printed on
// cards about matches played months earlier -- forbidden, and unstable.
test('match cards show the ratings that played, and per-player movement', { skip }, async () => {
  const r = await shared.run(() => {
    selectedMonth = 'all';
    // A match where the four did NOT move by the same amount. Early-season
    // matches legitimately move everyone equally -- all four are at zero
    // evidence, so K is the same for all of them. The interesting case is once
    // reliabilities have diverged.
    const m = MATCHES.filter((x) => x.deltas && Object.keys(x.deltas).length === 4)
      .find((x) => new Set(Object.values(x.deltas).map((d) => Math.abs(d.ratingDelta))).size > 1);
    const facts = V3_MATCH_FACTS[m.id];
    const html = buildMatchDetailBlock(m, false);
    return {
      matchId: m.id,
      html,
      preMatch: Object.values(facts.byPlayer).map((p) => Math.round(p.preMatchRating)),
      deltas: Object.values(facts.byPlayer).map((p) => p.ratingDelta),
      // Today's ratings, which must NOT be what the card prints.
      currentRatings: [...m.winners, ...m.losers].map((n) => Math.round(PLAYERS.find((p) => p.name === n).rating)),
    };
  });
  assert.ok(r.matchId, 'no match with unequal movement found');
  r.preMatch.forEach((v) => assert.ok(r.html.includes(String(v)), `pre-match rating ${v} is not on the card`));
  // Each player's own figure, not one team number.
  r.deltas.forEach((d) => {
    const shown = d > 0 ? `+${d}` : `${d}`;
    assert.ok(r.html.includes(shown), `per-player delta ${shown} is not on the card`);
  });
  assert.match(r.html, /ratings going in/);
  assert.match(r.html, /Rating change, per player/);
  assert.match(r.html, /performance score/);
  // Never the game-share wording, which is a different quantity on the same card.
  assert.ok(!/expected ~\d+% of games/.test(r.html));
});

// Shipped defect: the Monthly Rating breakdown showed a real month-end figure
// under a fabricated explanation of a solver that had been retired.
test('the monthly breakdown describes the engine that actually ran', { skip }, async () => {
  const r = await shared.run(() => {
    const html = buildMonthlyRatingBreakdownHtml('Shaun', '2026-07');
    const ctx = getMonthlyRatingContext('Shaun', '2026-07');
    const row = MonthlyViews.playerMonth(MONTHLY_VIEWS, '2026-07', 'Shaun');
    return {
      html, opened: ctx.journey.startRating, ended: ctx.journey.endRating,
      rowOpened: row.startRating, rowEnded: row.endRating,
    };
  });
  ['K=28', '300 passes', 'solved every player', 'joint rating solver', 'tier baseline (']
    .forEach((p) => assert.ok(!r.html.includes(p), `stale copy on screen: "${p}"`));
  assert.match(r.html, /sequential-v1/);
  // The month is a window on one continuous rating, and the modal and the
  // monthly views must agree to the last bit about where it opened and closed.
  assert.strictEqual(r.opened, r.rowOpened);
  assert.strictEqual(r.ended, r.rowEnded);
});

test('no screen leaks a placeholder across any month and tier', { skip }, async () => {
  const bad = await shared.run(() => {
    const found = [];
    activeTab = 'power'; activeSortP = 'rating'; query = '';
    ['all', '2026-06', '2026-07', '2026-08', '2026-09'].forEach((m) => {
      ['All', 'A', 'B', 'C'].forEach((t) => {
        selectedMonth = m; activeTier = t; minGames = m === 'all' ? 10 : 5;
        render();
        const txt = document.getElementById('list').innerText;
        if (/undefined|NaN|\[object/.test(txt)) found.push(`${m}/${t}`);
      });
    });
    selectedMonth = 'all'; activeTier = 'All'; minGames = 10; render();
    return found;
  });
  assert.deepStrictEqual(bad, []);
  assert.deepStrictEqual(shared.pageErrors, []);
});

test('every player profile opens without error', { skip }, async () => {
  const broken = await shared.run(() => {
    const failed = [];
    PLAYERS.forEach((p) => {
      try { openSheet(p.name); closeSheet(); } catch (e) { failed.push(`${p.name}: ${e.message}`); }
    });
    return failed;
  });
  assert.deepStrictEqual(broken, []);
  assert.deepStrictEqual(shared.pageErrors, []);
});

// Shipped defect: approving a submission set a status nothing read any more, so
// the game disappeared from the list and was never rated. The club could not
// record a result.
test('approving a submitted game rates it', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Tester';
      extraMatchesState.push({
        id: 'usr_ui_1', date: '2026-09-18', winners: ['Shaun', 'Tom'], losers: ['Max', 'KC'],
        sets: [[6, 3], [6, 4]], type: 'doubles', note: '', status: 'pending', submittedBy: 'Tester',
      });
      recomputeAll();
      const before = PLAYERS.find((p) => p.name === 'Shaun').rating;

      await prepareApproval('usr_ui_1');
      const staged = approvalPlan ? {
        matchId: approvalPlan.matchId,
        moved: approvalPlan.planned.playersMoved.map((p) => p.playerId).sort(),
        docs: approvalPlan.planned.documentsToWrite,
      } : { error: approvalMessage };
      // Nothing may be written before the operator confirms.
      const writesBefore = window.__writes.length;

      await commitApproval();
      const after = PLAYERS.find((p) => p.name === 'Shaun').rating;
      return {
        staged, writesBefore, before, after,
        rated: ALL_MATCHES.some((m) => m.id === staged.matchId),
        submissionGone: !extraMatchesState.some((x) => x.id === 'usr_ui_1'),
        message: approvalMessage,
      };
    });
    assert.ok(!r.staged.error, r.staged.error);
    assert.strictEqual(r.writesBefore, 0, 'nothing may be written before confirmation');
    assert.deepStrictEqual(r.staged.moved, ['KC', 'Max', 'Shaun', 'Tom']);
    assert.strictEqual(r.staged.docs, 9, 'an append should touch one match, four events and four players');
    assert.strictEqual(r.rated, true, 'the approved game must be in the rated record');
    assert.notStrictEqual(r.before, r.after, "the winner's rating must move");
    assert.strictEqual(r.submissionGone, true, 'the submission must not linger as a second copy');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Correcting a rated game re-derives every rating after it, so the whole
// consequence is shown before anything is written -- and nothing is written
// until it is confirmed. The controls were once worse than missing: a confirmed
// delete persisted an overlay and changed nothing at all.
test('correcting a rated game shows the blast radius and writes only on confirmation', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Tester';
      const target = MATCHES.find((m) => m.date === '2026-06-02');
      const out = { id: target.id, writesBefore: window.__writes.length };

      // Removal: planned, not written.
      armedDeleteId = target.id;
      await deleteMatch(target.id);
      out.removeMoved = matchFixPlan ? matchFixPlan.playersMoved.length : -1;
      out.removeDeletes = matchFixPlan ? matchFixPlan.documentsToDelete : -1;
      out.writesAfterPlan = window.__writes.length;
      matchFixReset();
      out.writesAfterCancel = window.__writes.length;
      out.stillThere = ALL_MATCHES.some((m) => m.id === target.id);

      // Correction: planned, confirmed, replayed.
      await stageMatchCorrection({
        type: 'edit',
        match: {
          id: target.id, date: target.date, sourceIndex: 1,
          teamA: target.winners, teamB: target.losers, sets: [[6, 0], [6, 0]],
          outcome: RatingEngine.OUTCOME.A_WINS, type: 'doubles', drawSideAssignmentArbitrary: false,
        },
      }, 'Correct the score.');
      out.editMoved = matchFixPlan ? matchFixPlan.playersMoved.length : -1;
      await commitMatchCorrection();
      const after = MATCHES.find((m) => m.id === target.id);
      out.correctedScore = after ? after.score : null;

      const stored = await readStoredRecord(RatingStore.firestoreCompatBackend(db));
      out.replays = ReplayForward.verifyNoOp(stored, {}).count;
      const players = {};
      stored.players.forEach((d) => { players[d.id] = d; });
      out.healthy = BetaDiagnostics.run({ players, matches: stored.matches, journey: stored.journey }).healthy;
      return out;
    });
    assert.strictEqual(r.writesBefore, 0);
    assert.strictEqual(r.writesAfterPlan, 0, 'planning a removal must write nothing');
    assert.strictEqual(r.writesAfterCancel, 0, 'cancelling must write nothing');
    assert.strictEqual(r.stillThere, true, 'an unconfirmed removal must not remove anything');
    assert.ok(r.removeMoved > 20, 'removing a June game reaches most of the club');
    assert.strictEqual(r.removeDeletes, 5, 'the match and its four events');
    assert.ok(r.editMoved > 20);
    assert.strictEqual(r.correctedScore, '6-0, 6-0');
    assert.strictEqual(r.replays, 0, 'the corrected record must still replay to itself');
    assert.strictEqual(r.healthy, true);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Removing a June match rewrites ~500 documents. Sent one at a time that is
// ~500 sequential round trips -- minutes of apparently nothing happening on a
// phone, with the only progress text rendered at the top of the tab, far above
// an operator scrolled into a match card. Reported from the live beta.
test('a removal writes in batches, reports progress in its own panel, and says it removed', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Tester';
      const target = MATCHES.find((m) => m.date === '2026-06-02');
      const label = `${target.winners.join(' & ')} vs ${target.losers.join(' & ')}`;

      armedDeleteId = target.id;
      await deleteMatch(target.id);
      const planned = { write: matchFixPlan.documentsToWrite, remove: matchFixPlan.documentsToDelete };

      // The panel the operator is looking at must carry the progress itself.
      renderGamesTab();
      const panelMsgBeforeExists = !!document.getElementById('matchFixPanelMsg');

      // Capture what the progress line actually said while the write ran.
      const ticks = [];
      const realProgress = setMatchFixProgress;
      setMatchFixProgress = (text) => {
        ticks.push({ text, inPanel: !!document.getElementById('matchFixPanelMsg') });
        realProgress(text);
      };
      window.__batches = [];
      await commitMatchCorrection();
      setMatchFixProgress = realProgress;

      const banner = document.getElementById('matchFixOutcome');
      return {
        planned,
        panelMsgBeforeExists,
        ticks,
        batches: window.__batches.slice(),
        gone: !ALL_MATCHES.some((m) => m.id === target.id),
        message: matchFixMessage,
        bannerText: banner ? banner.innerText : null,
        label,
      };
    });

    assert.strictEqual(r.gone, true, 'the match must actually be removed');
    assert.ok(r.planned.write > 100, `this fixture should rewrite a lot of documents, got ${r.planned.write}`);

    // Batched, not one round trip per document.
    const ops = r.batches.reduce((n, size) => n + size, 0);
    assert.strictEqual(ops, r.planned.write + r.planned.remove,
      'every planned operation must go out in a batch');
    assert.ok(r.batches.length <= Math.ceil(ops / 500),
      `${ops} operations should need ${Math.ceil(ops / 500)} batch(es), took ${r.batches.length}`);
    r.batches.forEach((size) => assert.ok(size <= 500, `a batch of ${size} exceeds Firestore's limit`));

    // Progress, said where the button is.
    assert.strictEqual(r.panelMsgBeforeExists, true, 'the panel must have its own message line');
    assert.ok(r.ticks.length >= 2, `progress must be reported more than once, got ${r.ticks.length}`);
    r.ticks.forEach((t) => assert.strictEqual(t.inPanel, true,
      'progress must be written into the panel, not only the top of the tab'));
    assert.ok(r.ticks.some((t) => /Removing/.test(t.text)),
      `progress must name the action, got: ${r.ticks.map((t) => t.text).join(' / ')}`);
    assert.ok(r.ticks.every((t) => !/Correcting/.test(t.text)),
      'a removal must never describe itself as a correction');

    // And the outcome, which has to outlive the card it was started from.
    assert.match(r.message, /^Removed and replayed\./,
      `a removal must not report itself as corrected: "${r.message}"`);
    assert.ok(r.bannerText, 'the outcome must be shown somewhere the operator can see it');
    assert.match(r.bannerText, /Removed and replayed/);
  } finally { await app.close(); }
});

// The same path, for a correction: the wording must follow the action both ways.
test('a correction still reports itself as a correction', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Tester';
      const target = MATCHES.find((m) => m.date === '2026-06-02');
      await stageMatchCorrection({
        type: 'edit',
        match: {
          id: target.id, date: target.date, sourceIndex: 1,
          teamA: target.winners, teamB: target.losers, sets: [[6, 1], [6, 1]],
          outcome: RatingEngine.OUTCOME.A_WINS, type: 'doubles', drawSideAssignmentArbitrary: false,
        },
      }, 'Correct the score.');
      const ticks = [];
      const realProgress = setMatchFixProgress;
      setMatchFixProgress = (t) => { ticks.push(t); realProgress(t); };
      await commitMatchCorrection();
      setMatchFixProgress = realProgress;
      const banner = document.getElementById('matchFixOutcome');
      return { message: matchFixMessage, ticks, bannerText: banner ? banner.innerText : null };
    });
    assert.match(r.message, /^Corrected and replayed\./);
    assert.ok(r.ticks.some((t) => /Correcting/.test(t)));
    assert.ok(r.ticks.every((t) => !/Removing/.test(t)));
    assert.match(r.bannerText || '', /Corrected and replayed/);
  } finally { await app.close(); }
});

// A half-written replay leaves the matches intact and the derived documents
// not, after which the app refuses every edit -- correctly, and silently. It
// said nothing to anyone who was not mid-edit, and kept nothing. Found in the
// live beta the hard way.
test('a diverged record is detected, logged once, and described to each reader differently', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      // A genuine divergence: the stored state stops matching the history.
      window.__data.players.Shaun.rating += 25;
      await loadV3State();
      recomputeAll();

      healthCheckDone = false; healthReport = null;
      const writesBefore = window.__writes.length;
      const report = await runRecordHealthCheck();

      const stored = Object.values(window.__data.healthReports || {});
      return {
        found: !!report,
        id: report && report.id,
        differenceCount: report && report.differenceCount,
        playersAffected: report && report.playersAffected,
        documentsToRepair: report && report.documentsToRepair,
        storedCount: stored.length,
        storedStatus: stored[0] && stored[0].status,
        seenCount: stored[0] && stored[0].seenCount,
        // No read was spent finding this: the record was already in memory.
        writesMade: window.__writes.length - writesBefore,
        // What each reader is told.
        asBoard: (() => { isUnlocked = true; adminRole = 'board'; return recordHealthMessage(); })(),
        asOwner: (() => { isUnlocked = true; adminRole = 'owner'; return recordHealthMessage(); })(),
        ownerFlagBoard: (() => { adminRole = 'board'; return isOwnerAdmin(); })(),
        ownerFlagOwner: (() => { adminRole = 'owner'; return isOwnerAdmin(); })(),
      };
    });

    assert.strictEqual(r.found, true, 'the divergence must be detected');
    assert.match(r.id, /^REPLAY_DIVERGENCE__/);
    assert.ok(r.differenceCount > 0);
    assert.ok(r.playersAffected >= 1, 'the report must size the problem');
    assert.ok(r.documentsToRepair >= 1);

    // Written down, once.
    assert.strictEqual(r.storedCount, 1, 'exactly one report document');
    assert.strictEqual(r.storedStatus, 'OPEN');
    assert.strictEqual(r.seenCount, 1);

    // Two readers.
    assert.strictEqual(r.ownerFlagBoard, false, 'a board unlock is not an owner unlock');
    assert.strictEqual(r.ownerFlagOwner, true);
    assert.match(r.asBoard, /editing is paused/i);
    assert.ok(!/ratingJourney|players/.test(r.asBoard), `the board must not be handed internals: "${r.asBoard}"`);
    assert.match(r.asOwner, /place\(s\)/);
    assert.match(r.asOwner, /No match is affected/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// The shape it actually took in the live beta: a removal that wrote part of its
// output and stopped, leaving the matches intact and the tail of the derived
// documents holding pre-change values.
test('the half-written replay that happened in the beta is detected and sized', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      const backend = RatingStore.firestoreCompatBackend(db);
      const stored = await readStoredRecord(backend);
      const target = stored.matches.find((m) => m.date === '2026-06-02') || stored.matches[5];
      const planned = ReplayForward.plan({ stored, change: { type: 'delete', matchId: target.id }, provenance: {} });

      // The deletes land first and complete; then half the writes land and the
      // rest never do.
      Object.entries(planned.deletes).forEach(([c, ids]) => ids.forEach((id) => { delete window.__data[c][id]; }));
      const all = [];
      Object.entries(planned.writes).forEach(([c, docs]) => docs.forEach((d) => all.push([c, d])));
      all.slice(0, Math.floor(all.length / 2)).forEach(([c, d]) => { window.__data[c][d.id] = d; });

      await loadV3State();
      recomputeAll();
      healthCheckDone = false; healthReport = null;
      const report = await runRecordHealthCheck();
      isUnlocked = true; adminRole = 'owner';
      return {
        planned: { writes: planned.documentsToWrite, landed: Math.floor(all.length / 2) },
        report, owner: recordHealthMessage(),
        matchGone: !Object.values(window.__data.matches).some((m) => m.id === target.id),
        matchesLeft: Object.keys(window.__data.matches).length,
      };
    });

    // The matches are intact -- only the derived documents are half-written.
    assert.strictEqual(r.matchGone, true, 'the deletes completed, as they do');
    assert.ok(r.report, 'a half-written replay must be detected');
    assert.ok(r.report.differenceCount > 10,
      `this should be a substantial divergence, got ${r.report.differenceCount}`);
    assert.ok(r.report.staleByCollection.ratingJourney > 0, 'journey events are left stale');
    assert.ok(r.report.staleByCollection.players > 0, 'and so is the player state');
    assert.strictEqual(r.report.staleByCollection.matches, 0, 'but no match is stale');
    assert.strictEqual(r.report.wouldDelete, 0, 'a partial write is repaired by writing, never deleting');
    assert.ok(r.report.earliestAffectedDate, 'the affected span must be recorded');
    assert.match(r.owner, /No match is affected/);
    assert.match(r.owner, new RegExp(r.report.earliestAffectedDate));
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the same divergence seen again updates the one report instead of filing another', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      window.__data.players.Shaun.rating += 25;
      await loadV3State();
      recomputeAll();

      healthCheckDone = false; healthReport = null;
      await runRecordHealthCheck();
      currentUserName = 'Someone Else';
      healthCheckDone = false;                      // a second session
      await runRecordHealthCheck();

      const stored = Object.values(window.__data.healthReports || {});
      return { count: stored.length, seenCount: stored[0].seenCount, seenBy: stored[0].seenBy, firstSeenAt: stored[0].firstSeenAt, lastSeenAt: stored[0].lastSeenAt };
    });
    assert.strictEqual(r.count, 1, 'four phones must not leave four reports');
    assert.strictEqual(r.seenCount, 2);
    assert.ok(r.firstSeenAt <= r.lastSeenAt);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('a healthy record is checked and nothing is written', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      healthCheckDone = false; healthReport = null;
      const before = window.__writes.length;
      const report = await runRecordHealthCheck();
      return {
        report,
        writes: window.__writes.length - before,
        reports: Object.keys(window.__data.healthReports || {}).length,
        message: recordHealthMessage(),
        ranTwice: await runRecordHealthCheck(),   // once per session, not once per call
      };
    });
    assert.strictEqual(r.report, null, 'a sound record produces no report');
    assert.strictEqual(r.writes, 0, 'and writes nothing');
    assert.strictEqual(r.reports, 0);
    assert.strictEqual(r.message, '');
    assert.strictEqual(r.ranTwice, null);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// The refusal an operator actually meets, rather than the check that precedes it.
test('an edit refused by a diverged record explains itself at the reader\'s level', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      window.__data.players.Shaun.rating += 25;
      await loadV3State();
      recomputeAll();
      isUnlocked = true; adminRole = 'board'; currentUserName = 'Board Member';
      healthCheckDone = false; healthReport = null;

      const target = MATCHES.find((m) => m.date === '2026-06-02');
      armedDeleteId = target.id;
      await deleteMatch(target.id);
      const board = { message: matchFixMessage, planned: !!matchFixPlan };

      matchFixReset();
      adminRole = 'owner';
      await deleteMatch(target.id);
      return { board, owner: { message: matchFixMessage, planned: !!matchFixPlan },
               reports: Object.keys(window.__data.healthReports || {}).length };
    });

    assert.strictEqual(r.board.planned, false, 'no edit may be planned on a diverged record');
    assert.strictEqual(r.owner.planned, false);
    assert.match(r.board.message, /editing is paused/i);
    assert.ok(!/differs|ratingJourney/.test(r.board.message),
      `the board must not meet a wall of document ids: "${r.board.message}"`);
    assert.match(r.owner.message, /No match is affected/);
    assert.strictEqual(r.reports, 1, 'the refusal records it too, once');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Canonical tier ordering, as it actually reaches the screen. The module tests
// prove the rule; only this proves the app uses it.
test('Games reads partnerships stronger-first and orders the filter by strength', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = false;
      goToSection('play');
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      gamesMonth = 'all'; gamesType = 'all'; setGamesPlayerFilter([]);
      gamesFiltersOpen = true;   // the filter panel arrives shut; this test reads its select
      renderGamesTab();

      // Every card's partnerships, read off the rendered title.
      const cards = [...document.querySelectorAll('.cc-title')].map((el) => el.innerText.trim());
      const teams = [];
      cards.forEach((title) => {
        title.split(/\s+def\s+|\s+vs\s+/).forEach((side) => {
          const tiers = [...side.matchAll(/\(([SABC])\)/g)].map((m) => m[1]);
          if (tiers.length >= 2) teams.push({ side: side.trim(), tiers });
        });
      });

      const sel = document.getElementById('gamesTypeSelect');
      const options = [...sel.options].map((o) => ({ value: o.value, text: o.text }));
      const matchupOpts = options.filter((o) => o.value.indexOf('match:') === 0);

      return {
        cardCount: cards.length,
        teams,
        matchupLabels: matchupOpts.map((o) => o.value.slice(6)),
        matchupTexts: matchupOpts.map((o) => o.text),
        sampleTitle: cards[0] || null,
      };
    });

    assert.ok(r.cardCount > 20, `expected a real feed, got ${r.cardCount} cards`);
    assert.ok(r.teams.length > 40, `expected many partnerships, got ${r.teams.length}`);

    // Every partnership on screen reads stronger tier first.
    const strength = { S: 0, A: 1, B: 2, C: 3 };
    r.teams.forEach((t) => {
      for (let i = 1; i < t.tiers.length; i++) {
        assert.ok(strength[t.tiers[i - 1]] <= strength[t.tiers[i]],
          `"${t.side}" reads ${t.tiers.join('')} — weaker partner first`);
      }
    });

    // And the filter is in canonical order, with counts still shown.
    assert.ok(r.matchupLabels.length >= 3, `expected several matchup options, got ${r.matchupLabels.length}`);
    r.matchupLabels.forEach((label) => {
      const [a, b] = label.split(' vs ');
      assert.ok(GameType.compareTeamKeys(a, b) <= 0,
        `"${label}" names the weaker partnership first`);
    });
    const sorted = r.matchupLabels.slice().sort((x, y) => {
      const [x1, x2] = x.split(' vs '); const [y1, y2] = y.split(' vs ');
      return GameType.compareTeamKeys(x1, y1) || GameType.compareTeamKeys(x2, y2);
    });
    assert.deepStrictEqual(r.matchupLabels, sorted, 'the filter list is not in canonical order');
    assert.ok(r.matchupTexts.some((t) => /\(\d+\)|\d/.test(t)), 'counts must still be visible');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// The two SIDES are not reordered: doing so would turn a loss into a win.
// Shaun, 20 Sep, asked directly: the winners are ALWAYS on the left, whatever
// the tiers say. Canonical strength orders the players within a partnership and
// the matchup label; it never touches which side of "def" a team is on. A draw
// has no winner, so it keeps the orientation the match was stored in -- which
// is also the side the scoreline is written from, and the card says so.
test('the winners are always on the left, and a draw keeps its stored orientation', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      goToSection('play');
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      gamesMonth = 'all'; gamesType = 'all'; setGamesPlayerFilter([]);
      renderGamesTab();
      const decided = [], draws = [];
      document.querySelectorAll('.callout-card').forEach((card) => {
        const title = card.querySelector('.cc-title');
        const id = card.querySelector('[data-gameid]');
        if (!title || !id) return;
        const m = getDisplayMatches().find((x) => x.id === id.dataset.gameid);
        if (!m) return;
        const text = title.innerText;
        if (/ def /.test(text)) {
          const [left, right] = text.split(' def ');
          decided.push({ id: m.id, left, right, winners: m.winners, losers: m.losers });
        } else if (m.isDraw && / vs /.test(text)) {
          const [left, right] = text.split(' vs ');
          draws.push({
            id: m.id, left, right, stored: m.winners, other: m.losers,
            binding: (card.querySelector('.cc-detail') || {}).innerText || '',
          });
        }
      });
      return { decided, draws };
    });

    assert.ok(r.decided.length > 20, `expected decided matches, got ${r.decided.length}`);
    r.decided.forEach((row) => {
      row.winners.forEach((w) => assert.ok(row.left.includes(w),
        `${row.id}: ${w} won but is not on the left of "def" — the sides have been swapped`));
      row.losers.forEach((l) => assert.ok(row.right.includes(l),
        `${row.id}: ${l} lost but is not on the right of "def"`));
      // And nobody has crossed over.
      row.winners.forEach((w) => assert.ok(!row.right.includes(w), `${row.id}: ${w} appears on both sides`));
    });

    assert.ok(r.draws.length > 0, 'the record contains draws, and they must be covered too');
    r.draws.forEach((row) => {
      row.stored.forEach((n) => assert.ok(row.left.includes(n),
        `${row.id}: a draw must keep the side order it was stored in — ${n} moved`));
      row.other.forEach((n) => assert.ok(row.right.includes(n), `${row.id}: ${n} moved`));
      // The scoreline is written from the side shown first, and the card binds
      // it by name. If the sides were ever reordered, this would be a lie.
      if (/first\)/.test(row.binding)) {
        row.stored.forEach((n) => assert.ok(row.binding.includes(n),
          `${row.id}: the score binding names a side that is not the one shown first`));
      }
    });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Step 3 of the monthly review, as it reaches the screen. The module tests
// prove the rule; this proves the board can actually reach it.
test('the review asks for Reliability, and says what an override departed from', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      document.querySelector('#tabrow .tab-btn[data-tab="manage"]').click();
      activeTab = 'manage';
      reviewSubject = 'Ant Slice';
      // Admin/Manage opens collapsed, so open the section first -- the same
      // tap a person makes.
      adminOpenSections.review = true;
      renderManage();
      document.querySelector('.review-tier[data-event="PROMOTION"]').click();

      const out = {};
      // Before the rating question is answered there is nothing to price.
      out.beforeDecision = document.querySelectorAll('.review-reliability').length;

      [...document.querySelectorAll('.review-decision')].find((b) => b.dataset.decision === 'CLUB_OVERRIDE').click();
      // Once it is answered the question appears, even with the rating field
      // still blank: a blank rating is a move of zero, which is how the board
      // changes confidence alone.
      out.afterDecision = document.querySelectorAll('.review-reliability').length;

      // The board types an anchor 60 points up.
      const s = MonthlyReview.preReviewSnapshot(V3_JOURNEY, reviewToday())['Ant Slice'];
      document.getElementById('reviewOverrideRating').value = String(Math.round((s.rating + 60) * 10) / 10);
      reviewDraft = reviewDraftForCheck();
      renderManage();
      out.afterRating = document.querySelectorAll('.review-reliability').length;

      // The step-2 club-override block used to carry a Reliability field of its
      // own, so the board could set it twice, differently, and only one would
      // win. Step 3 owns it now, and it appears only once the board asks for it.
      const relInputs = () => document.querySelectorAll('input[id$="OverrideRel"], #reviewRelOverride').length;
      out.relInputsBeforeChoice = relInputs();

      const snap = MonthlyReview.preReviewSnapshot(V3_JOURNEY, reviewToday());
      out.recommended = MonthlyReview.reliabilityRecommendationFor(reviewDraftForCheck(), snap).reliability;

      // Unanswered, the review will not stage.
      out.blocked = MonthlyReview.incompleteReasons(reviewDraftForCheck(), snap)
        .some((x) => /must say what happens to Reliability/.test(x));
      out.stageDisabled = document.getElementById('reviewStageBtn').disabled;

      // Override it, with a reason.
      document.querySelector('.review-reliability[data-reliability="OVERRIDE"]').click();
      out.relInputsAfterChoice = relInputs();
      document.getElementById('reviewRelOverride').value = '45';
      document.getElementById('reviewNote').value = 'Board: steadier than the move suggests.';
      reviewDraft = reviewDraftForCheck();
      renderManage();
      out.chosen = MonthlyReview.chosenReliability(reviewDraftForCheck(), snap);
      out.remaining = MonthlyReview.incompleteReasons(reviewDraftForCheck(), snap);

      // Stage it and read the confirmation, which is the last thing the board
      // sees before anything is written.
      document.getElementById('reviewStageBtn').click();
      out.confirm = reviewPending ? reviewPending.map((p) => p.summary).join(' | ') : null;
      out.writes = window.__writes.length;
      return out;
    });

    assert.strictEqual(r.beforeDecision, 0, 'no Reliability question before the rating one is answered');
    assert.strictEqual(r.afterDecision, 2, 'and it appears as soon as it is');
    assert.strictEqual(r.afterRating, 2, 'use-the-recommendation and override');
    assert.strictEqual(r.relInputsBeforeChoice, 0, 'no Reliability field until the board asks to override');
    assert.strictEqual(r.relInputsAfterChoice, 1, 'and then exactly one — never two');
    assert.ok(r.recommended > 0.2 && r.recommended < 0.45, `recommended ${r.recommended}`);
    assert.strictEqual(r.blocked, true, 'a moving rating must be answered for');
    assert.strictEqual(r.stageDisabled, true);
    assert.ok(Math.abs(r.chosen - 0.45) < 1e-9, `the override is what gets written, got ${r.chosen}`);
    assert.deepStrictEqual(r.remaining, []);
    assert.ok(r.confirm, 'the review must stage');
    assert.match(r.confirm, /club override/i);
    assert.match(r.confirm, new RegExp(String(Math.round(r.recommended * 100))),
      'the confirmation must name the recommendation the board departed from');
    assert.strictEqual(r.writes, 0, 'staging writes nothing');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== ADMIN/MANAGE MOBILE REFINEMENT (20 Sep 2026) ========
// A presentation refactor, so these check layout and interaction. The data
// behaviour is covered elsewhere and must be untouched.

test('Admin/Manage opens with every section collapsed, every time', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = true; adminRole = 'owner';
      const enter = () => {
        activeTab = 'manage';
        lastRenderedTab = null;          // as if arriving from another tab
        renderActiveTab();
      };
      enter();
      const heads = [...document.querySelectorAll('[data-acc-toggle]')];
      const out = { sections: heads.length, openOnArrival: document.querySelectorAll('.admin-acc.is-open').length };

      // Opening two leaves both open.
      document.querySelector('[data-acc-toggle="players"]').click();
      document.querySelector('[data-acc-toggle="export"]').click();
      out.openedTwo = document.querySelectorAll('.admin-acc.is-open').length;
      out.bodies = document.querySelectorAll('.admin-acc-body').length;

      // Toggling one closed leaves the other alone.
      document.querySelector('[data-acc-toggle="players"]').click();
      out.afterClosingOne = [...document.querySelectorAll('.admin-acc.is-open')].map((el) => el.dataset.acc);

      // Re-rendering in place (a save, a staged decision) must NOT collapse it.
      renderManage();
      out.afterRerender = [...document.querySelectorAll('.admin-acc.is-open')].map((el) => el.dataset.acc);

      // Leaving and coming back does.
      activeTab = 'games'; renderActiveTab();
      enter();
      out.afterReturning = document.querySelectorAll('.admin-acc.is-open').length;

      out.emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(
        [...document.querySelectorAll('.admin-acc-title')].map((e) => e.textContent).join(' '));
      return out;
    });

    assert.ok(r.sections >= 8, `expected the admin sections, got ${r.sections}`);
    assert.strictEqual(r.openOnArrival, 0, 'the screen opens collapsed');
    assert.strictEqual(r.openedTwo, 2, 'multiple sections may be open at once');
    assert.strictEqual(r.bodies, 2, 'a collapsed section renders no body at all');
    assert.deepStrictEqual(r.afterClosingOne, ['export']);
    assert.deepStrictEqual(r.afterRerender, ['export'],
      're-rendering in place must not slam an open section shut');
    assert.strictEqual(r.afterReturning, 0, 'returning to the screen collapses everything again');
    assert.strictEqual(r.emoji, false, 'admin headings carry no emoji icons');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Collapsed sections are not in the DOM, so everything renderManage wires has
// to tolerate its element being absent. Before the accordion they always
// existed and nothing checked — this threw on the very first render.
test('every Admin/Manage section can be opened and used without error', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = true; adminRole = 'owner';
      activeTab = 'manage'; lastRenderedTab = null; renderActiveTab();
      const keys = [...document.querySelectorAll('[data-acc-toggle]')].map((el) => el.dataset.accToggle);
      const opened = [];
      keys.forEach((k) => {
        document.querySelector(`[data-acc-toggle="${k}"]`).click();   // open
        opened.push({ key: k, body: !!document.querySelector(`[data-acc="${k}"] .admin-acc-body`) });
        document.querySelector(`[data-acc-toggle="${k}"]`).click();   // and closed again
      });
      return { keys, opened };
    });
    assert.ok(r.keys.length >= 8);
    r.opened.forEach((o) => assert.strictEqual(o.body, true, `${o.key} did not open`));
    assert.deepStrictEqual(app.pageErrors, [], 'opening a section must not throw');
  } finally { await app.close(); }
});

test('Player tags reads as a record list and expands in place', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = true; adminRole = 'owner';
      activeTab = 'manage'; lastRenderedTab = null; renderActiveTab();
      document.querySelector('[data-acc-toggle="players"]').click();

      const rows = [...document.querySelectorAll('.ptag-row')];
      const out = {
        rows: rows.length,
        players: PLAYERS.length,
        controlsClosed: document.querySelectorAll('.ptag-controls').length,
        firstName: rows[0].querySelector('.ptag-name').textContent,
        firstMeta: rows[0].querySelector('.ptag-meta').textContent,
        hasState: !!rows[0].querySelector('.ptag-state'),
        // The maintenance list must not borrow the public serif player styling.
        // "sans-serif" contains "serif", so match the actual serif families.
        fontFamily: getComputedStyle(rows[0].querySelector('.ptag-name')).fontFamily,
      };

      const name = rows[0].dataset.row;
      document.querySelector(`[data-ptag-toggle="${name}"]`).click();
      out.openOne = document.querySelectorAll('.ptag-controls').length;
      const open = document.querySelector(`[data-row="${name}"]`);
      out.controls = {
        tier: !!open.querySelector('.ptag-tier'),
        starting: !!open.querySelector('.ptag-starting'),
        status: !!open.querySelector('.ptag-status-actions'),
      };
      // Nothing may clip at phone width.
      out.clipped = [...open.querySelectorAll('.ptag-controls select')]
        .filter((el) => el.scrollWidth > el.clientWidth + 1).length;

      document.querySelector(`[data-ptag-toggle="${name}"]`).click();
      out.closedAgain = document.querySelectorAll('.ptag-controls').length;
      return out;
    });

    assert.strictEqual(r.rows, r.players, 'every player gets a row');
    assert.strictEqual(r.controlsClosed, 0, 'rows start as summaries, not forms');
    assert.ok(r.firstName.length > 0);
    assert.match(r.firstMeta, /Tier [SABC]/, 'the summary says what they are');
    assert.strictEqual(r.hasState, true, 'and whether they are active');
    assert.doesNotMatch(r.fontFamily, /Georgia|Iowan|var\(--font-prestige\)/i,
      `admin typography, not the public player-name serif: got ${r.fontFamily}`);
    assert.match(r.fontFamily, /sans-serif|Helvetica|Arial/i);
    assert.strictEqual(r.openOne, 1, 'tapping opens exactly one row, in place');
    assert.deepStrictEqual(r.controls, { tier: true, starting: true, status: true });
    assert.strictEqual(r.clipped, 0, 'no control may be cut off at phone width');
    assert.strictEqual(r.closedAgain, 0);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('a match card gives the matchup the full width and puts Manage on the submission line', { skip }, async () => {
  const app = await H.open();
  try {
    await app.page.setViewportSize({ width: 375, height: 812 });   // iPhone SE
    const r = await app.run(() => {
      isUnlocked = true; adminRole = 'owner';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      gamesMonth = 'all'; setGamesPlayerFilter([]);
      renderGamesTab();
      const cards = [...document.querySelectorAll('#gamesView .callout-card')].slice(0, 12);
      return cards.map((c) => {
        const title = c.querySelector('.cc-title');
        const metaRow = c.querySelector('.cc-meta-row');
        const manage = c.querySelector('.game-manage-btn');
        const clickable = c.querySelector('.game-card-clickable');
        return {
          manageInMetaRow: !!(metaRow && metaRow.contains(manage)),
          manageInTitleRow: !!(title && title.contains(manage)),
          // The matchup gets the card's width: nothing sits beside it.
          titleWidth: title ? Math.round(title.getBoundingClientRect().width) : 0,
          cardWidth: clickable ? Math.round(clickable.getBoundingClientRect().width) : 0,
          titleClipped: title ? title.scrollWidth > title.clientWidth + 1 : false,
          manageRight: !!(manage && metaRow
            && manage.getBoundingClientRect().right >= metaRow.getBoundingClientRect().right - 2),
        };
      });
    });

    assert.ok(r.length >= 5, `expected a feed, got ${r.length} cards`);
    r.forEach((c, i) => {
      assert.strictEqual(c.manageInMetaRow, true, `card ${i}: Manage is not on the submission line`);
      assert.strictEqual(c.manageInTitleRow, false, `card ${i}: Manage is still in the matchup row`);
      assert.strictEqual(c.titleWidth, c.cardWidth, `card ${i}: the matchup does not get the full width`);
      assert.strictEqual(c.titleClipped, false, `card ${i}: the matchup is clipped`);
      assert.strictEqual(c.manageRight, true, `card ${i}: Manage is not right-aligned`);
    });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun found this on the live beta: Override Reliability chosen, 50 entered, a
// reason entered — and the form still showed the old warnings with
// "Review what will be recorded" disabled. Validation ran only while the screen
// was being built, so a valid answer changed nothing until something unrelated
// forced a re-render.
//
// The flow below is exactly the one reported, driven through real input events
// with NO manual re-render anywhere.
test('entering a Reliability override and a reason enables the review by itself', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      document.querySelector('#tabrow .tab-btn[data-tab="manage"]').click();
      activeTab = 'manage'; lastRenderedTab = null; renderActiveTab();
      document.querySelector('[data-acc-toggle="review"]').click();
      reviewSubject = 'Ant Slice';
      renderManage();
      document.querySelector('.review-tier[data-event="PROMOTION"]').click();
      [...document.querySelectorAll('.review-decision')].find((b) => b.dataset.decision === 'CLUB_OVERRIDE').click();

      const type = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return false;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      };
      const stage = () => document.getElementById('reviewStageBtn');
      const warnings = () => (document.getElementById('reviewMissing') || {}).innerText || '';
      const step = () => ({ disabled: stage().disabled, warnings: warnings().trim() });

      const out = { start: step() };

      // A rating, typed. The Reliability step must follow it without a
      // re-render, and its recommendation must be priced against what was typed.
      const s = MonthlyReview.preReviewSnapshot(V3_JOURNEY, reviewToday())['Ant Slice'];
      out.typedRating = Math.round((s.rating + 60) * 10) / 10;
      type('reviewOverrideRating', String(out.typedRating));
      out.afterRating = step();
      out.relButtons = document.querySelectorAll('.review-reliability').length;
      out.recommendationShown = (document.getElementById('reviewReliabilityBlock') || {}).innerText || '';

      // Override Reliability -> 50 -> a reason. Nothing else.
      document.querySelector('.review-reliability[data-reliability="OVERRIDE"]').click();
      out.afterChoosingOverride = step();
      out.typedFifty = type('reviewRelOverride', '50');
      out.afterFifty = step();
      type('reviewNote', 'Board: steadier than the move suggests.');
      out.afterReason = step();

      // And what the draft will actually record.
      const snap = MonthlyReview.preReviewSnapshot(V3_JOURNEY, reviewToday());
      out.chosen = MonthlyReview.chosenReliability(reviewDraftForCheck(), snap);
      out.missing = MonthlyReview.incompleteReasons(reviewDraftForCheck(), snap);
      out.writes = window.__writes.length;
      return out;
    });

    // The reported flow, step by step.
    assert.strictEqual(r.start.disabled, true, 'nothing is answered yet');
    assert.strictEqual(r.relButtons, 2, 'the Reliability step follows a typed rating without a re-render');
    assert.match(r.recommendationShown, /Recommended: \d+%/,
      'and its recommendation is shown for what was typed');
    assert.strictEqual(r.afterRating.disabled, true);
    assert.match(r.afterRating.warnings, /must say what happens to Reliability/,
      'the warning updates live to the next real requirement, not the stale one');
    assert.doesNotMatch(r.afterRating.warnings, /needs a rating/,
      'the rating has been given, so that warning must be gone');

    assert.strictEqual(r.typedFifty, true, 'the override field must be on screen to type into');
    assert.match(r.afterChoosingOverride.warnings, /needs a percentage/);
    assert.doesNotMatch(r.afterFifty.warnings, /needs a percentage/, '50 answered that');
    assert.match(r.afterFifty.warnings, /needs a reason/);

    // The point of the whole fix.
    assert.strictEqual(r.afterReason.warnings, '', `warnings must clear, got: ${r.afterReason.warnings}`);
    assert.strictEqual(r.afterReason.disabled, false,
      'the stage button must enable by itself, with no extra tap or reopen');

    assert.ok(Math.abs(r.chosen - 0.5) < 1e-9, `50% must be what gets recorded, got ${r.chosen}`);
    assert.deepStrictEqual(r.missing, []);
    assert.strictEqual(r.writes, 0, 'none of this writes anything');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Typing must not fight the person doing it.
test('live validation does not steal focus or lose what is being typed', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      document.querySelector('#tabrow .tab-btn[data-tab="manage"]').click();
      activeTab = 'manage'; lastRenderedTab = null; renderActiveTab();
      document.querySelector('[data-acc-toggle="review"]').click();
      reviewSubject = 'Ant Slice';
      renderManage();
      document.querySelector('.review-tier[data-event="PROMOTION"]').click();
      [...document.querySelectorAll('.review-decision')].find((b) => b.dataset.decision === 'CLUB_OVERRIDE').click();

      const s = MonthlyReview.preReviewSnapshot(V3_JOURNEY, reviewToday())['Ant Slice'];
      const el = document.getElementById('reviewOverrideRating');
      el.focus();
      // One character at a time, as a person types.
      const target = String(Math.round((s.rating + 60) * 10) / 10);
      const kept = [];
      for (const ch of target) {
        el.value += ch;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        kept.push(document.activeElement === el && document.getElementById('reviewOverrideRating') === el);
      }
      const out = { focusHeld: kept.every(Boolean), value: el.value, target };

      document.querySelector('.review-reliability[data-reliability="OVERRIDE"]').click();
      const rel = document.getElementById('reviewRelOverride');
      rel.focus();
      '50'.split('').forEach((ch) => {
        rel.value += ch;
        rel.dispatchEvent(new Event('input', { bubbles: true }));
      });
      out.relFocusHeld = document.activeElement === rel;
      out.relValue = rel.value;
      return out;
    });

    assert.strictEqual(r.focusHeld, true, 'the rating field must survive its own keystrokes');
    assert.strictEqual(r.value, r.target, 'and keep what was typed');
    assert.strictEqual(r.relFocusHeld, true, 'so must the Reliability field');
    assert.strictEqual(r.relValue, '50');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== SPLIT-MONTH LEAGUE TABLE (20 Sep 2026) =============
// A mid-month tier change used to put the whole month's points in whichever
// tier the player is in NOW. Points must stay in the tier where they were
// earned, so a player who moved appears in both tables with only that stretch.
//
// The tier boundary itself is covered in tests/leagueSplit.test.js; this drives
// the real aggregation and the rendered table with a controlled change date.
test('a mid-month tier change splits the League Table and never moves points', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      // Pick a player with September matches either side of a chosen date.
      const CUT = '2026-09-10';
      // The same two sources the aggregation uses: rated matches AND draws,
      // which are pulled separately. Counting only the rated ones here made
      // this test disagree with the code by exactly the number of draws.
      const septMatches = ALL_MATCHES.concat(getAllApprovedMatches().filter((m) => m.isDraw))
        .filter((m) => m.date.slice(0, 7) === '2026-09');
      const septOf = (name) => septMatches
        .filter((m) => m.winners.includes(name) || m.losers.includes(name))
        .map((m) => m.date).sort();
      const subject = [...new Set(septMatches.flatMap((m) => [...m.winners, ...m.losers]))]
        .find((n) => {
          const d = septOf(n);
          return d.some((x) => x < CUT) && d.some((x) => x >= CUT);
        });
      if (!subject) return { subject: null };

      // Move them B -> A on the cut date, leaving everyone else alone.
      const realTier = V3_TIER_AS_OF;
      V3_TIER_AS_OF = (name, date) => (name === subject ? (date >= CUT ? 'A' : 'B') : realTier(name, date));
      const realHistory = V3_TIER_HISTORY;
      V3_TIER_HISTORY = {
        ...realHistory,
        changesFor: (name) => (name === subject
          ? [{ playerId: name, effectiveDate: CUT, fromTier: 'B', toTier: 'A' }]
          : realHistory.changesFor(name)),
      };

      const dates = septOf(subject);
      const out = { subject, cut: CUT, before: dates.filter((d) => d < CUT).length, after: dates.filter((d) => d >= CUT).length };

      const split = computeMonthlySummaryStats('2026-09', { splitByTier: true });
      out.segments = Object.values(split).filter((x) => x.name === subject)
        .map((x) => ({ tier: x.segmentTier, games: x.games, points: x.points, gd: x.gd,
                       earliest: x.segmentDates.slice().sort()[0], latest: x.segmentDates.slice().sort().pop() }))
        .sort((a, b) => (a.earliest < b.earliest ? -1 : 1));

      const whole = Object.values(computeMonthlySummaryStats('2026-09')).find((x) => x.name === subject);
      out.whole = { games: whole.games, points: whole.points, gd: whole.gd };
      out.label = tierSpellLabel(subject, '2026-09');

      // And as it actually renders.
      summaryMonth = '2026-09'; summaryMode = 'league'; activeTab = 'summary';
      const view = document.getElementById('summaryView');
      if (view) view.style.display = 'block';
      leagueGrouped = true; renderSummary();
      const sectionsFor = () => {
        const text = document.getElementById('summaryContent').innerText;
        const lines = text.split('\n');
        const found = [];
        let tier = null;
        lines.forEach((l) => {
          const m = l.match(/^Tier ([SABC])$/);
          if (m) { tier = m[1]; return; }
          if (tier && l.includes(subject)) found.push(tier);
        });
        return found;
      };
      out.renderedTiers = sectionsFor();

      leagueGrouped = false; renderSummary();
      const allText = document.getElementById('summaryContent').innerText;
      out.allRows = allText.split('\n').filter((l) => l.includes(subject));

      V3_TIER_AS_OF = realTier; V3_TIER_HISTORY = realHistory;
      return out;
    });

    assert.ok(r.subject, 'the fixture needs a player with September matches either side of the cut');
    assert.ok(r.before > 0 && r.after > 0, `${r.subject} must play either side of ${r.cut}`);

    // Two segments, in the tiers they were played in.
    assert.strictEqual(r.segments.length, 2, `expected two segments, got ${JSON.stringify(r.segments)}`);
    assert.deepStrictEqual(r.segments.map((x) => x.tier), ['B', 'A'], 'old tier first, then new');
    assert.ok(r.segments[0].latest < r.cut, 'the first segment ends before the change');
    assert.ok(r.segments[1].earliest >= r.cut, 'the second starts on or after it');

    // Points and games stay where they were earned, and nothing is lost.
    assert.strictEqual(r.segments[0].games + r.segments[1].games, r.whole.games);
    assert.strictEqual(r.segments[0].points + r.segments[1].points, r.whole.points);
    assert.strictEqual(r.segments[0].gd + r.segments[1].gd, r.whole.gd);
    assert.strictEqual(r.segments[0].games, r.before);
    assert.strictEqual(r.segments[1].games, r.after);

    // Both rows reach the screen, one per tier.
    assert.deepStrictEqual(r.renderedTiers.sort(), ['A', 'B'],
      `${r.subject} must appear in both tier tables, got ${JSON.stringify(r.renderedTiers)}`);

    // All together is not a tier table: one row, saying what changed.
    assert.strictEqual(r.allRows.length, 1, `All together must not duplicate the player, got ${r.allRows.length} rows`);
    assert.strictEqual(r.label, 'B → A');
    assert.ok(r.allRows[0].includes('B → A'), `the row must show the transition: ${r.allRows[0]}`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// The ordinary case must not have changed: one tier all month, one row.
test('a player who does not change tier still gets exactly one League row', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const split = computeMonthlySummaryStats('2026-09', { splitByTier: true });
      const byName = {};
      Object.values(split).forEach((x) => { byName[x.name] = (byName[x.name] || 0) + 1; });
      const whole = computeMonthlySummaryStats('2026-09');
      return {
        duplicated: Object.entries(byName).filter(([, n]) => n > 1).map(([n]) => n),
        // Every segment must carry the tier it was played in.
        untiered: Object.values(split).filter((x) => !x.segmentTier).map((x) => x.name),
        // And the split must account for exactly the same games as the whole.
        gamesMatch: Object.keys(whole).every((n) => {
          const parts = Object.values(split).filter((x) => x.name === n);
          return parts.reduce((s, x) => s + x.games, 0) === whole[n].games;
        }),
      };
    });
    assert.deepStrictEqual(r.duplicated, [], 'nobody changed tier in the fixture, so nobody may be split');
    assert.deepStrictEqual(r.untiered, [], 'every segment must know its tier');
    assert.strictEqual(r.gamesMatch, true, 'splitting must not lose or invent a game');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== PLAYERS DIRECTORY REFRESH (20 Sep 2026) ============
// A public-facing directory, not an admin list. The filter panel took nearly
// half the first screen on a phone and the tier chips ran off the right edge.
// Presentation only: every filter, sort and navigation behaviour is preserved.

test('the Directory opens on players, not on a filter form', { skip }, async () => {
  const app = await H.open();
  try {
    await app.page.setViewportSize({ width: 375, height: 812 });   // iPhone SE
    // goToSection hides the shared Rankings chrome (month/tier toolbar, the
    // "# Player Rating" column header) on a setTimeout(0) off the tab click,
    // so measuring geometry in the same synchronous turn measures the screen
    // as it never appears to anyone. Let navigation settle first.
    await app.run(() => { goToSection('players'); renderPlayersTab(); });
    await app.page.waitForTimeout(50);
    const r = await app.run(() => {
      const view = document.getElementById('playersView');
      const firstRow = view.querySelector('.pdir-row');
      return {
        filtersFolded: !document.getElementById('playersTierBar'),
        summary: document.getElementById('playersFilterToggle').innerText.replace(/\s+/g, ' ').trim(),
        // How far down the screen the first player is.
        firstRowTop: Math.round(firstRow.getBoundingClientRect().top),
        viewport: window.innerHeight,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        sortVisible: !!document.getElementById('playersSortToggle'),
        compareVisible: /Compare/i.test(document.body.innerText),
      };
    });

    assert.strictEqual(r.filtersFolded, true, 'secondary filters start folded');
    assert.match(r.summary, /All tiers, all players/, 'the folded control says what is on');
    assert.ok(r.firstRowTop < r.viewport * 0.4,
      `the first player should be near the top, was ${r.firstRowTop} of ${r.viewport}`);
    assert.strictEqual(r.overflow, false, 'nothing may run off the side at 375px');
    assert.strictEqual(r.sortVisible, true, 'sort stays visible — it is the primary control');
    assert.strictEqual(r.compareVisible, true, 'Directory / Compare is preserved');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('every tier chip is reachable and nothing runs off the edge', { skip }, async () => {
  const app = await H.open();
  try {
    await app.page.setViewportSize({ width: 375, height: 812 });
    const r = await app.run(() => {
      goToSection('players');
      renderPlayersTab();
      document.getElementById('playersFilterToggle').click();
      const bar = document.getElementById('playersTierBar');
      const right = bar.getBoundingClientRect().right;
      const chips = [...bar.querySelectorAll('.tierbtn')];
      return {
        chips: chips.map((c) => c.textContent),
        // The old row was a single line that clipped "Tier C" off the screen.
        clipped: chips.filter((c) => c.getBoundingClientRect().right > right + 1).length,
        // The chips are compact enough to fit one line at 375px now, so they
        // need not wrap -- but the bar must still be ABLE to, or a narrower
        // phone or a fifth tier brings the clipping straight back.
        canWrap: getComputedStyle(bar).flexWrap === 'wrap',
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    assert.deepStrictEqual(r.chips, ['All', 'Tier S', 'Tier A', 'Tier B', 'Tier C']);
    assert.strictEqual(r.clipped, 0, 'no chip may be cut off');
    assert.strictEqual(r.canWrap, true, 'they wrap rather than scrolling out of sight when space runs out');
    assert.strictEqual(r.overflow, false);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('Active does not shout on every row; Inactive still does', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const away = PLAYERS.find((p) => p.name === 'Max'); away.status = 'temporarilyInactive'; away.active = false;   // the fixture's only flagged player is archived, so mark one away
      goToSection('players');
      renderPlayersTab();
      const view = document.getElementById('playersView');
      const rows = [...view.querySelectorAll('.pdir-row')];
      return {
        rows: rows.length,
        activePlayers: livePlayers().filter((p) => p.active).length,
        inactivePlayers: livePlayers().filter((p) => !p.active).length,
        badges: view.querySelectorAll('.pdir-inactive').length,
        saysActive: /\bACTIVE\b/i.test(view.innerText.replace(/Inactive/gi, '')),
        // Identity leads, in the public serif; the rest is interface.
        nameFont: getComputedStyle(rows[0].querySelector('.pdir-name')).fontFamily,
        metaFont: getComputedStyle(rows[0].querySelector('.pdir-meta')).fontFamily,
        metaText: rows[0].querySelector('.pdir-meta').innerText,
        hasChevron: !!rows[0].querySelector('.pdir-chev'),
      };
    });

    assert.ok(r.activePlayers > 5 && r.inactivePlayers > 0, 'the fixture needs both');
    assert.strictEqual(r.badges, r.inactivePlayers, 'exactly the inactive players are badged');
    assert.strictEqual(r.saysActive, false, 'no ACTIVE pill on every row');
    assert.match(r.nameFont, /Georgia|Iowan|serif/i, 'identity keeps the public serif');
    assert.match(r.metaFont, /Helvetica|Arial|sans-serif/i, 'metadata is interface type');
    assert.match(r.metaText, /Tier [SABC] · \d+/, 'tier and rating, concisely');
    assert.strictEqual(r.hasChevron, true, 'a row says it opens something');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('letter headings appear alphabetically and not when sorted by rating', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      goToSection('players');
      renderPlayersTab();
      const letters = () => [...document.querySelectorAll('#playersView .pdir-letter')].map((e) => e.textContent);
      const ratings = () => [...document.querySelectorAll('#playersView .pdir-meta')]
        .map((e) => Number(e.innerText.replace(/[^0-9]/g, '')));
      const az = { letters: letters(), names: [...document.querySelectorAll('.pdir-name')].map((e) => e.textContent) };
      document.querySelector('#playersSortToggle [data-sortby="rating"]').click();
      return { az, byRating: { letters: letters(), ratings: ratings() } };
    });

    assert.ok(r.az.letters.length > 5, 'A–Z is grouped');
    assert.deepStrictEqual(r.az.letters, r.az.letters.slice().sort(), 'in alphabetical order');
    assert.deepStrictEqual(r.az.names, r.az.names.slice().sort((a, b) => a.localeCompare(b)));
    assert.deepStrictEqual(r.byRating.letters, [],
      'sorted by rating, letter headings would mark divisions that are not there');
    assert.deepStrictEqual(r.byRating.ratings, r.byRating.ratings.slice().sort((a, b) => b - a));
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('filtering and profile navigation still work from the folded control', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      goToSection('players');
      renderPlayersTab();
      const rows = () => document.querySelectorAll('#playersView .pdir-row').length;
      const out = { all: rows() };

      document.getElementById('playersFilterToggle').click();
      const tierB = [...document.querySelectorAll('#playersTierBar .tierbtn')].find((b) => b.textContent === 'Tier B');
      tierB.click();
      out.tierB = rows();
      out.expectedTierB = PLAYERS.filter((p) => p.tier === 'B').length;
      out.summary = document.getElementById('playersFilterToggle').innerText.replace(/\s+/g, ' ');
      out.panelStaysOpen = !!document.getElementById('playersTierBar');

      document.querySelector('#playersActiveToggle [data-active="inactive"]').click();
      out.inactiveOnly = rows();
      out.expectedInactiveB = PLAYERS.filter((p) => p.tier === 'B' && !p.active).length;

      // Back to everyone, then open a profile.
      [...document.querySelectorAll('#playersTierBar .tierbtn')].find((b) => b.textContent === 'All').click();
      document.querySelector('#playersActiveToggle [data-active="all"]').click();
      const first = document.querySelector('#playersView .pdir-row');
      out.opened = first.dataset.player;
      first.click();
      out.sheetShows = (document.getElementById('sheetName') || {}).textContent || '';
      return out;
    });

    assert.ok(r.all > 20);
    assert.strictEqual(r.tierB, r.expectedTierB, 'the tier filter still filters');
    assert.match(r.summary, /Tier B/, 'and the folded control reports it');
    assert.strictEqual(r.panelStaysOpen, true, 'choosing a filter does not close the panel under the finger');
    assert.strictEqual(r.inactiveOnly, r.expectedInactiveB, 'status filtering still combines with tier');
    assert.ok(r.opened, 'a row carries the player it opens');
    assert.ok(r.sheetShows.includes(r.opened), `tapping the row must open ${r.opened}`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// A name is free text. The old rows spliced it into an inline onclick, which is
// one apostrophe away from a syntax error.
test('a player whose name contains quotes is still safe to render and tap', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const awkward = ["O'Neill", 'Ann "Ace" Lee', 'a<b>c'];
      PLAYERS.push(...awkward.map((name, i) => ({
        name, tier: 'B', rating: 1200 + i, active: true, total: 0, wins: 0, losses: 0, draws: 0,
      })));
      goToSection('players');
      renderPlayersTab();
      const rows = [...document.querySelectorAll('#playersView .pdir-row')];
      const found = awkward.map((n) => {
        const row = rows.find((el) => el.dataset.player === n);
        return { name: n, present: !!row, shown: row ? row.querySelector('.pdir-name').textContent : null };
      });
      const target = rows.find((el) => el.dataset.player === "O'Neill");
      target.click();
      const opened = (document.getElementById('sheetName') || {}).textContent || '';
      awkward.forEach((n) => { const i = PLAYERS.findIndex((p) => p.name === n); if (i !== -1) PLAYERS.splice(i, 1); });
      return { found, opened };
    });
    r.found.forEach((f) => {
      assert.strictEqual(f.present, true, `${f.name} must render`);
      assert.strictEqual(f.shown, f.name, `${f.name} must read as itself`);
    });
    assert.ok(r.opened.includes("O'Neill"), `tapping must open the right profile, got "${r.opened}"`);
    assert.deepStrictEqual(app.pageErrors, [], 'an awkward name must not throw');
  } finally { await app.close(); }
});

// A correction that changes the date is no longer refused: the game moves to
// the new date under a new identifier (tests/matchRedate.test.js).

test('diagnostics notices a document tampered with behind the app', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      isUnlocked = true;
      await runBetaDiagnostics();
      const clean = diagnosticsReport.healthy;
      window.__data.players.Shaun.rating += 25;
      await runBetaDiagnostics();
      return {
        clean,
        healthy: diagnosticsReport.healthy,
        failed: diagnosticsReport.checks.filter((c) => c.status === 'fail').map((c) => c.name),
      };
    });
    assert.strictEqual(r.clean, true, 'the seeded record should be sound');
    assert.strictEqual(r.healthy, false);
    assert.ok(r.failed.includes('Stored state is the end of the stored history'));
    assert.ok(r.failed.includes('What the app shows is what is stored'));
  } finally { await app.close(); }
});

// The standing rule: no silent legacy fallback. A failed v3 read must say so,
// never substitute 1400, a tier seed, or the legacy solver.
test('a failed v3 read shows an error and invents no rating', { skip }, async () => {
  const app = await H.open({ failReads: true });
  try {
    const r = await app.run(() => ({
      loaded: V3_STATE.loaded,
      error: String(V3_STATE.error || ''),
      players: PLAYERS.length,
      matches: ALL_MATCHES.length,
      banner: (document.body.innerText.match(/could not|unavailable|failed/i) || [null])[0],
      body: document.body.innerText,
    }));
    assert.strictEqual(r.loaded, false);
    assert.ok(r.error.length > 0);
    assert.strictEqual(r.players, 0, 'no player may be given a fabricated rating');
    assert.strictEqual(r.matches, 0);
    assert.ok(r.banner, 'the failure must be visible, not silent');
    assert.ok(!/\b1400\b/.test(r.body), 'the legacy default rating must never appear');
  } finally { await app.close(); }
});

// Tier S is a real tier the club uses, and Manny is in it. It must appear in
// tier-aware views -- but a "king" of a field of one has won nothing, so no
// crown is awarded and the card says why. Shaun's rule, 18 Sep 2026.
test('Tier S is supported, and a sole qualifier is not crowned', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const out = {};
      activeTab = 'power'; activeSortP = 'rating'; query = '';
      selectedMonth = 'all'; activeTier = 'All'; minGames = 10;

      out.tierFilters = [...document.querySelectorAll('.tierbtn')].map((b) => b.dataset.tier);
      out.leagueGroupsBy = TIER_ORDER_LIST.slice();
      activeTier = 'S';
      out.tierSPlayers = PLAYERS.filter(matchesActiveTier).map((p) => p.name);
      activeTier = 'All';

      // Make Manny the single qualifying Tier S player.
      const manny = PLAYERS.find((p) => p.name === 'Manny');
      manny.total = 20; manny.wins = 12; manny.losses = 8;
      window.isRankingEligible = () => true;
      const kings = computeKingsOfTiers();
      out.field = kings._fieldSize.S;
      out.crowned = kings.S ? kings.S.name : null;
      renderKingsOfTiersPanel();
      out.panel = document.getElementById('kingsOfTiersPanel').innerText.replace(/\n+/g, ' | ');
      return out;
    });
    assert.ok(r.tierFilters.includes('S'), 'Tier S must be offered as a filter');
    assert.deepStrictEqual(r.tierSPlayers, ['Manny']);
    assert.deepStrictEqual(r.leagueGroupsBy, ['S', 'A', 'B', 'C'], 'the league table must group every tier');
    assert.strictEqual(r.field, 1, 'exactly one qualifier, which is the case under test');
    assert.strictEqual(r.crowned, null, 'a sole qualifier must not be crowned');
    assert.match(r.panel, /TIER S \| only one qualified/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== CGPT VISUAL ACCEPTANCE (18 Sep 2026) =====================
// Eight presentation corrections raised against the live-record screenshots.
// Each test below is the one that would have caught the thing CGPT spotted.

// There is one continuous Power Rating. Copy that says "Monthly Rating" invites
// exactly the misreading the whole v3 rewrite exists to remove: that a separate
// score is solved each month.
test('no screen calls the month-end figure a "Monthly Rating"', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      selectedMonth = '2026-07'; minGames = 5; activeTab = 'power'; render();
      openMonthlyRatingBreakdown('Shaun', '2026-07');
      const modal = document.getElementById('monthlyRatingModal');
      const t = document.getElementById('mrbHowItWorksToggle');
      if (t) t.click();
      return { text: modal.innerText, body: document.body.innerText };
    });
    assert.doesNotMatch(r.text, /monthly rating/i,
      'the breakdown still calls it a Monthly Rating');
    assert.doesNotMatch(r.text, /how monthly ratings work/i,
      'the methodology link still calls it a monthly rating');
    assert.match(r.text, /month.end power rating/i,
      'the breakdown must name it as the Power Rating at month end');
    assert.doesNotMatch(r.body, /monthly rating/i,
      'stale Monthly Rating copy is still on screen somewhere');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Set scores are stored winner-first. Printed unchanged on a card about one
// player, a defeat reads "6-3, 6-4" next to the word LOSS.
test('a player-centric card shows the score from that player\'s side', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      selectedMonth = 'all'; minGames = 10; render();
      openSheet('Shaun');
      // renderPremiumProfile reparents these out of #sheetMatches, keeping the
      // nodes (and their .match class) intact.
      const rows = [...document.querySelectorAll('.match')];
      const read = (el) => ({
        result: el.querySelector('.top span:last-child').textContent.trim(),
        score: el.querySelector('.score').textContent.trim(),
      });
      const cards = rows.map(read);
      // The stored, un-oriented score for the same matches, for comparison.
      const stored = MATCHES
        .filter((m) => m.winners.includes('Shaun') || m.losers.includes('Shaun'))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((m) => ({ won: m.winners.includes('Shaun'), score: m.sets.map((s) => s.join('-')).join(', ') }));
      return { cards, stored };
    });

    const win = r.cards.find((c) => c.result === 'WIN');
    const loss = r.cards.find((c) => c.result === 'LOSS');
    assert.ok(win && loss, 'the fixture must contain both a win and a loss for Shaun');

    // In every set of an oriented card, the player's own games come first:
    // a win reads high-low, a loss reads low-high.
    const firstSet = (s) => s.split(', ')[0].split('-').map(Number);
    const [wa, wb] = firstSet(win.score);
    assert.ok(wa > wb, `a win must read from Shaun's side, got ${win.score}`);
    const [la, lb] = firstSet(loss.score);
    assert.ok(la < lb, `a loss must read from Shaun's side, got ${loss.score}`);

    // And the orientation is a flip of the stored score, not a different match.
    const storedLoss = r.stored.find((s) => !s.won);
    const flipped = storedLoss.score.split(', ').map((p) => p.split('-').reverse().join('-')).join(', ');
    assert.ok(r.cards.some((c) => c.score === flipped),
      'the oriented loss must be the stored score flipped, not recomputed');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Reliability is how much evidence stands behind a rating. It belongs on the
// profile at a glance -- and nowhere near rank or win rate.
test('the profile hero shows reliability with its band', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      selectedMonth = 'all'; minGames = 10; render();
      openSheet('Shaun');
      const facts = document.querySelector('.pp-hero-facts');
      const p = PLAYERS.find((x) => x.name === 'Shaun');
      return {
        text: facts ? facts.innerText.replace(/\n+/g, ' | ') : null,
        pct: p.reliabilityPct,
        band: p.reliabilityBand,
      };
    });
    assert.ok(r.text, 'the profile hero has no facts row');
    assert.match(r.text, /RELIABILITY/i);
    assert.ok(r.text.includes(`${Math.round(r.pct)}%`),
      `the hero must show the recorded reliability (${r.pct}%), got: ${r.text}`);
    assert.ok(r.text.includes(r.band), `the hero must name the band, got: ${r.text}`);
    assert.ok(['Provisional', 'Developing', 'Established', 'High Reliability'].includes(r.band),
      `unexpected band ${r.band}`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// An impossible action must not offer a live-looking button. Rishi is
// established, so there is no initial estimate left to correct.
test('an unavailable review action is disabled and says why', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = true; currentUserName = 'Board';
      const b = document.querySelector('#tabrow .tab-btn[data-tab="manage"]');
      if (b) b.click();
      adminOpenSections.review = true;
      reviewSubject = 'Rishi'; renderManage();
      document.querySelector('.review-tier').click();

      const btn = document.querySelector('.review-decision[data-decision="CORRECT_INITIAL_CLASSIFICATION"]');
      const before = reviewDraft ? reviewDraft.ratingDecision : null;
      btn.click(); // must do nothing at all
      const after = reviewDraft ? reviewDraft.ratingDecision : null;
      return {
        disabled: btn.disabled,
        label: btn.textContent.trim(),
        status: (V3_STATE.players.Rishi || {}).classificationStatus,
        reasons: [...document.querySelectorAll('.reason-note')].map((e) => e.innerText),
        before, after,
      };
    });
    assert.strictEqual(r.status, 'ESTABLISHED', 'the fixture player must be established');
    assert.strictEqual(r.disabled, true, 'the impossible branch is still clickable');
    assert.strictEqual(r.label, 'Unavailable', 'a disabled action must not read "Choose"');
    assert.ok(r.reasons.some((x) => /already established/i.test(x)),
      `the reason must be shown in the panel, got: ${JSON.stringify(r.reasons)}`);
    assert.strictEqual(r.after, r.before, 'clicking an unavailable branch changed the draft');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Removing a game and correcting one are different acts. One confirmation
// serving both is how "Confirm removal?" ended up over "Correct and replay".
test('remove and correct are separate actions with their own wording', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Board';
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      selectedMonth = 'all'; renderGamesTab();
      const yn = document.getElementById('gamesYourName'); if (yn) yn.value = 'Board';

      // The actions live behind the per-card Manage affordance now.
      document.querySelector('#gamesView [data-manage]').click();
      const correctBtn = document.querySelector('#gamesView [data-edit]');
      const removeBtn = document.querySelector('#gamesView [data-delete]');
      const labels = { correct: correctBtn.innerText.trim(), remove: removeBtn.innerText.trim() };

      // One click stages the removal: there is no invisible arming step.
      await deleteMatch(removeBtn.dataset.delete);
      const panel = [...document.querySelectorAll('#gamesView .callout-card')]
        .find((e) => /re-derives every rating/i.test(e.textContent));
      return {
        labels,
        staged: !!matchFixPlan,
        changeType: matchFixPlan ? matchFixPlan.change.type : null,
        panel: panel ? panel.innerText : null,
        commit: document.getElementById('matchFixCommitBtn').textContent.trim(),
        writes: window.__writes.length,
      };
    });
    assert.match(r.labels.correct, /^Correct match/);
    assert.match(r.labels.remove, /^Remove and replay/);
    assert.strictEqual(r.staged, true, 'one click must stage the removal');
    assert.strictEqual(r.changeType, 'delete');
    assert.match(r.panel, /Confirm removal/i, 'the removal panel must say it is a removal');
    assert.strictEqual(r.commit, 'Remove and replay',
      'a removal must not be confirmed by a button reading "Correct and replay"');
    assert.strictEqual(r.writes, 0, 'staging a removal must write nothing');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// The audit trail stays whole; it just becomes readable. Superseded events are
// still there, and the live one is identifiable without reading ids.
test('the historical audit trail labels what is active and what was replaced', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = true; currentUserName = 'Board';
      const b = document.querySelector('#tabrow .tab-btn[data-tab="manage"]');
      if (b) b.click();
      adminOpenSections.historical = true;
      renderManage();
      // A synthetic trail: one superseded promotion, one live promotion, and
      // the reassessment recorded with it.
      const existing = [
        { id: 'a', eventType: 'PROMOTION', previousTier: 'C', newTier: 'B',
          previousPowerRating: 1103.4, newPowerRating: 1103.4, createdBy: 'seed-beta', superseded: true },
        { id: 'b', eventType: 'PROMOTION', previousTier: 'C', newTier: 'B',
          previousPowerRating: 1103.4, newPowerRating: 1103.4, createdBy: 'Shaun', superseded: false, revision: 2 },
        { id: 'c', eventType: 'CLUB_RATING_REASSESSMENT', previousTier: 'B', newTier: 'B',
          previousPowerRating: 1103.4, newPowerRating: 1352.5, createdBy: 'Shaun', superseded: false },
      ];
      const host = document.createElement('div');
      host.innerHTML = existing.map((e) => buildAuditRowHtml(e, existing)).join('');
      return {
        rows: [...host.querySelectorAll('.audit-row')].map((el) => ({
          text: el.innerText.replace(/\n+/g, ' | '),
          faded: el.classList.contains('audit-row-superseded'),
        })),
      };
    });
    assert.strictEqual(r.rows.length, 3, 'every event stays in the trail');
    assert.strictEqual(r.rows[0].faded, true, 'a superseded event must recede');
    assert.match(r.rows[0].text, /Superseded/);
    assert.strictEqual(r.rows[1].faded, false, 'the live event must not be faded');
    assert.match(r.rows[1].text, /Promotion.*Active/s);
    assert.match(r.rows[1].text, /revision 2/);
    // The raw record says B -> B and 1103.4 -> 1103.4. Neither is readable.
    assert.match(r.rows[2].text, /Rating reassessment after promotion/,
      'a reassessment beside a promotion must say so');
    assert.match(r.rows[2].text, /tier unchanged \(B\)/, '"B → B" must be said in English');
    assert.match(r.rows[2].text, /1103\.4 → 1352\.5/);
    assert.doesNotMatch(r.rows[2].text, /CLUB_RATING_REASSESSMENT/,
      'a raw event constant must not be the label');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// A rating can move without anyone playing. The seeded fixture holds no club
// decisions -- they were applied to the live beta -- so the case is provoked.
test('club-decision movement stays labelled apart from movement on court', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      selectedMonth = '2026-07'; minGames = 5; activeTab = 'power'; render();
      // After render, so rebuilding MONTHLY_VIEWS cannot discard it.
      // The biggest riser, so the row is certain to be one of the three shown.
      const subject = MonthlyViews.ratingMovementTable(MONTHLY_VIEWS, '2026-07')[0];
      subject.reassessmentChange = 40.5;
      const box = document.createElement('div');
      box.innerHTML = buildMonthlyStoriesHtml('2026-07');
      document.body.appendChild(box);
      [...box.querySelectorAll('.ms-fold')].forEach((f) => { f.open = true; });
      const text = box.innerText.replace(/\n+/g, ' | ');
      box.remove();
      return { name: subject.playerId, text };
    });
    assert.match(r.text, new RegExp(`${r.name} \\| [^|]*\\(\\+40\\.5 by club decision\\)`),
      `movement by decision must be called out separately for ${r.name}, got: ${r.text}`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// All four monthly concepts survive the new hierarchy. Key takeaways summarises
// on top; nothing below it is deleted.
test('the monthly stories keep all four parts behind a takeaways summary', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      selectedMonth = '2026-07'; minGames = 5; activeTab = 'power'; render();
      const box = document.querySelector('.monthly-stories');
      const folds = [...box.querySelectorAll('.ms-fold')];
      folds.forEach((f) => { f.open = true; });
      return {
        head: box.querySelector('.ms-head').innerText,
        takeaways: [...box.querySelectorAll('.ms-takeaway')].map((e) => e.innerText.replace(/\n+/g, ' ')),
        titles: [...box.querySelectorAll('.ms-title, .ms-fold-title')].map((e) => e.innerText.trim()),
        opened: box.innerText,
      };
    });
    assert.match(r.head, /monthly summary/i);
    assert.ok(r.takeaways.length >= 2, 'Key takeaways must actually summarise something');
    assert.deepStrictEqual(r.titles, [
      'Monthly Performance', 'Rating Movement', 'Ranking Movement',
      'Moved without playing', 'Crossovers',
    ], 'no monthly concept may be dropped by the new hierarchy');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== POWER RATING GUIDE (18 Sep 2026) =====================
// The guide exists to pre-empt three complaints: small moves after a win, a
// rating rising after a loss, and a partner moving further. These check it is
// reachable, that it describes the model the app is actually running, and that
// it does not say the two things it must never say.

test('the Power Rating Guide is reachable from More', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      goToSection('more');
      const item = [...document.querySelectorAll('#shellMoreSheet .shell-more-item')]
        .find((b) => /power rating guide/i.test(b.textContent));
      if (!item) return { found: false };
      item.click();
      const modal = document.getElementById('ratingGuideModal');
      return {
        found: true,
        shown: !!modal && modal.classList.contains('show'),
        moreSheetClosed: !document.getElementById('shellMoreSheet').classList.contains('show'),
        title: modal ? modal.querySelector('h3').textContent.trim() : null,
      };
    });
    assert.strictEqual(r.found, true, 'the More sheet must offer the guide');
    assert.strictEqual(r.shown, true, 'tapping it must open the guide');
    assert.strictEqual(r.moreSheetClosed, true, 'the More sheet must close behind it');
    assert.strictEqual(r.title, 'Power Rating Guide');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the guide states sequential-v1 as the app actually runs it', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      openPowerRatingGuide();
      const modal = document.getElementById('ratingGuideModal');
      [...modal.querySelectorAll('details')].forEach((d) => { d.open = true; });
      return {
        text: modal.innerText,
        engine: {
          kMax: RatingEngine.KMAX, kMin: RatingEngine.KMIN, rc: RatingEngine.RC,
          gameWeight: RatingEngine.GAME_SHARE_WEIGHT,
          resultWeight: RatingEngine.MATCH_RESULT_WEIGHT,
          version: RatingEngine.RATING_MODEL_VERSION,
          // The comparison the guide draws, computed here from the engine.
          establishedMove: RatingEngine.kFactor(0.85) * 0.20,
          reassessedMove: RatingEngine.kFactor(0.10) * 0.20,
        },
      };
    });
    const { text, engine } = r;

    assert.match(text, /rating change = K × \(performance score − expected score\)/);
    assert.ok(text.includes(`K = ${engine.kMin} + ${engine.kMax - engine.kMin} × (1 − reliability)`),
      `the K formula must match the engine, got:\n${text.slice(0, 400)}`);
    assert.ok(text.includes(`reliability = e ÷ (e + ${engine.rc})`), 'the reliability formula must match the engine');
    assert.ok(text.includes(`${Math.round(engine.gameWeight * 100)}% the share of games`));
    assert.ok(text.includes(`${Math.round(engine.resultWeight * 100)}% the result`));
    assert.ok(text.includes(engine.version), 'the guide must name the engine it describes');

    // The worked example from the brief.
    assert.match(text, /16 × 0\.13 = \+2\.1/);

    // The comparison, and its numbers taken from the engine rather than prose.
    assert.ok(text.includes(`+${engine.establishedMove.toFixed(1)} pts`),
      `established move should read +${engine.establishedMove.toFixed(1)}`);
    assert.ok(text.includes(`+${engine.reassessedMove.toFixed(1)} pts`),
      `reassessed move should read +${engine.reassessedMove.toFixed(1)}`);
    assert.ok(engine.reassessedMove > engine.establishedMove * 2,
      'the comparison is only worth drawing if the gap is large');

    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the guide never implies a monthly reset or a reward for winning', { skip }, async () => {
  const app = await H.open();
  try {
    const text = await app.run(() => {
      openPowerRatingGuide();
      const modal = document.getElementById('ratingGuideModal');
      [...modal.querySelectorAll('details')].forEach((d) => { d.open = true; });
      return modal.innerText;
    });

    // The anchor sentence, as Shaun wrote it.
    assert.match(text, /The rating is not designed to reward wins\. It is designed to update our estimate of playing level\./);

    // The six required plain-English points, and the five distinctions.
    assert.match(text, /one continuous Power Rating/i);
    assert.match(text, /gain rating in a loss/i);
    assert.match(text, /Reliability/);
    assert.match(text, /evidence/i);
    ['Power Rating', 'Reliability', 'Monthly Performance', 'League Table', 'Tier']
      .forEach((c) => assert.ok(text.includes(c), `the guide must distinguish ${c}`));

    // Reliability must not be sold as skill or as a probability.
    assert.match(text, /Reliability is <?b?>?evidence<?\/?b?>?, not skill|Reliability is evidence, not skill/i);

    // The six questions the brief names.
    [/I won — why did I only get/i, /I lost — why did my rating go up/i,
      /why did my partner move more than me/i, /new or reassessed player/i,
      /promotion or a reclassification/i, /Do ratings reset every month/i]
      .forEach((re) => assert.match(text, re));

    // A tier change moves no points -- said, not implied.
    assert.match(text, /tier change on its own moves\s+zero\s+points/i);

    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// The explanation must describe the SAME persisted facts the card already
// shows, in two layers: padel language in front, decimals behind "See full
// calculation". If the two layers ever disagreed it would be a second
// calculation path, which is the one thing it must not be.
test('"Why your rating moved" is plain in front and exact behind', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      selectedMonth = 'all'; minGames = 10; render();
      openSheet('Shaun');
      const card = [...document.querySelectorAll('.match')].find((el) => el.querySelector('.why-moved'));
      if (!card) return { found: false };

      const matchId = MATCHES
        .filter((m) => m.winners.includes('Shaun') || m.losers.includes('Shaun'))
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0].id;
      const m = MATCHES.find((x) => x.id === matchId);
      const facts = MatchFacts.forPlayer(V3_MATCH_FACTS[matchId], 'Shaun');
      const won = m.winners.includes('Shaun');

      const why = card.querySelector('.why-moved');
      const calc = why.querySelector('.wm-calc');
      calc.open = true;

      return {
        found: true,
        plain: why.querySelector('.why-moved-body').innerText.replace(/\n+/g, ' '),
        note: why.querySelector('.why-moved-note').innerText,
        calc: calc.innerText.replace(/\n+/g, ' | '),
        recorded: {
          expected: facts.mine.expected,
          actual: facts.mine.actual,
          kUsed: facts.me.kUsed,
          delta: facts.me.ratingDelta,
          reliability: facts.me.previousReliability,
          myGames: won ? m.games_winner : m.games_loser,
          oppGames: won ? m.games_loser : m.games_winner,
        },
        won,
      };
    });

    assert.strictEqual(r.found, true, 'a profile match card must carry the explanation');
    const rec = r.recorded;

    // --- the plain layer: percentages, result, verdict, movement ---
    assert.ok(r.plain.includes(`${Math.round(rec.expected * 100)}%`),
      `must state the expected share as a whole percent, got: ${r.plain}`);
    const share = Math.round((rec.myGames / (rec.myGames + rec.oppGames)) * 100);
    assert.ok(r.plain.includes(`${share}%`),
      `must state the actual game share (${share}%), got: ${r.plain}`);
    assert.match(r.plain, r.won ? /and won the match/ : /but lost the match/);
    // The verdict is a GAME-SHARE comparison. It must never claim a
    // performance verdict the blended score alone could justify.
    assert.match(r.plain, /You (matched the game-share expectation|won (more|fewer) games than expected|won about the expected share of games)\./);
    assert.doesNotMatch(r.plain, /performed (above|below) expectation/,
      'the plain layer must not give a blended performance verdict');
    assert.match(r.plain, /The match result also contributes to the rating calculation\./);
    const deltaText = (rec.delta > 0 ? '+' : '') + rec.delta.toFixed(1);
    assert.ok(r.plain.includes(`Your rating moved ${deltaText}`),
      `must state the recorded movement ${deltaText}, got: ${r.plain}`);

    // --- and no raw performance-score sentence in front of the player ---
    assert.doesNotMatch(r.plain, /[Pp]erformance score/,
      'the plain layer must not quote the raw performance score');
    assert.doesNotMatch(r.plain, /\bK \d/, 'the plain layer must not quote K');
    assert.doesNotMatch(r.plain, /Reliability/i, 'the plain layer must not quote reliability');

    // --- the honesty note: the result is a SEPARATE input ---
    assert.match(r.note, /separate input/i);
    assert.match(r.note, /80%/);
    assert.match(r.note, /20%/);
    assert.match(r.note, /match result/i);

    // --- the exact layer, behind the disclosure ---
    assert.match(r.calc, /See full calculation/);
    assert.ok(r.calc.includes(rec.actual.toFixed(2)), 'the disclosure must carry the exact performance score');
    assert.ok(r.calc.includes(rec.expected.toFixed(2)), 'the disclosure must carry the exact expected score');
    assert.match(r.calc, /Match result contribution/, 'the 20% component must be shown as its own row');
    assert.match(r.calc, /0\.80 × .* \+ 0\.20 × /, 'the blend must be shown, not asserted');
    const k1 = String(Math.round(rec.kUsed * 10) / 10);
    assert.ok(r.calc.includes(k1), 'the disclosure must carry K');
    assert.ok(r.calc.includes(`${Math.round(rec.reliability * 100)}%`), 'the disclosure must carry reliability');
    assert.match(r.calc, new RegExp(`${k1.replace('.', '\\.')} × \\(${rec.actual.toFixed(2)} − ${rec.expected.toFixed(2)}\\)`));
    // One rounding of K, not two, inside one panel.
    assert.ok((r.calc.match(new RegExp(k1.replace('.', '\\.'), 'g')) || []).length >= 2,
      `K must read the same in the row and the arithmetic, got: ${r.calc}`);

    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// The shapes the brief names, each against a constructed case so the wording
// itself is checked rather than the mere presence of a sentence.
test('the explanation reads as padel, in the order a player thinks in', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const mk = (k, rel, delta, expected, actual, mine, theirs) => ({
        me: { playerId: 'X', kUsed: k, previousReliability: rel, newReliability: rel + 0.02, ratingDelta: delta },
        mine: { expected, actual, preRating: mine }, theirs: { preRating: theirs },
      });
      const plain = (e) => e.lines.join(' ').replace(/<\/?b>/g, '');
      return {
        more: plain(RatingExplainer.explain(mk(19, 0.6, 5.7, 0.53, 0.68, 1420, 1400), 'win', { mine: 15, theirs: 10 })),
        lossUp: plain(RatingExplainer.explain(mk(12, 0.8, 0.5, 0.18, 0.16, 1200, 1600), 'loss', { mine: 5, theirs: 20 })),
        fewer: plain(RatingExplainer.explain(mk(18, 0.65, -5.4, 0.51, 0.256, 1405, 1400), 'loss', { mine: 8, theirs: 17 })),
        note: RatingExplainer.explain(mk(19, 0.6, 5.7, 0.53, 0.68, 1420, 1400), 'win', { mine: 15, theirs: 10 }).blendNote,
      };
    });

    // Won more games than the expectation implied, and won the match.
    assert.match(r.more, /^Your team were slight favourites\./);
    assert.match(r.more, /expected to win about 53% of the games/);
    assert.match(r.more, /You won 15 of 25 games \(60%\) and won the match\./);
    assert.match(r.more, /You won more games than expected\./);
    assert.match(r.more, /Your rating moved \+5\.7\./);

    // A loss that still earned points -- the case players write in about.
    assert.match(r.lossUp, /^Your team were underdogs\./);
    assert.match(r.lossUp, /You won 5 of 25 games \(20%\) but lost the match\./);
    assert.match(r.lossUp, /You won about the expected share of games\./);
    assert.match(r.lossUp, /Your rating moved \+0\.5\./);

    // Fewer games than expected, and lost.
    assert.match(r.fewer, /^Your team were expected to be competitive\./);
    assert.match(r.fewer, /You won 8 of 25 games \(32%\) but lost the match\./);
    assert.match(r.fewer, /You won fewer games than expected\./);
    assert.match(r.fewer, /Your rating moved -5\.4\./);

    // None of them leads with a decimal, a K, a reliability -- or a blended
    // performance verdict.
    [r.more, r.lossUp, r.fewer].forEach((line) => {
      assert.doesNotMatch(line, /[Pp]erformance score/);
      assert.doesNotMatch(line, /0\.\d\d/);
      assert.doesNotMatch(line, /\bK \d/);
      assert.doesNotMatch(line, /Reliability/i);
      assert.doesNotMatch(line, /performed (above|below) expectation/);
      assert.match(line, /The match result also contributes to the rating calculation\./);
    });

    assert.match(r.note, /separate input/i);
    assert.match(r.note, /match result/i);
  } finally { await app.close(); }
});

// Shaun's case, exactly as flagged: a team matches its expected game share and
// still moves up, because the win contributes separately. Saying "performed
// above expectation" there would be false about the games.
test('matching the expected game share is never called performing above it', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      // 60% expected, 18/30 games won (60%), won the match. The blended actual
      // is 0.8 x 0.60 + 0.2 x 1 = 0.68 against 0.60 expected, so the rating
      // rises -- which is the trap.
      const view = {
        me: { playerId: 'X', kUsed: 16, previousReliability: 0.7, newReliability: 0.71, ratingDelta: 2.9 },
        mine: { expected: 0.60, actual: 0.68, preRating: 1450 },
        theirs: { preRating: 1380 },
      };
      const e = RatingExplainer.explain(view, 'win', { mine: 18, theirs: 12 });
      return { plain: e.lines.join(' ').replace(/<\/?b>/g, ''), key: e.verdictKey, delta: e.delta, residual: e.residual };
    });

    assert.ok(r.residual > 0, 'the blended residual really is positive -- this is the case under test');
    assert.ok(r.delta > 0, 'and the rating really did go up');

    assert.strictEqual(r.key, 'matched');
    assert.match(r.plain, /^Your team were favourites\./);
    assert.match(r.plain, /expected to win about 60% of the games/);
    assert.match(r.plain, /You won 18 of 30 games \(60%\) and won the match\./);
    assert.match(r.plain, /You matched the game-share expectation\./);
    assert.match(r.plain, /The match result also contributes to the rating calculation\./);
    assert.match(r.plain, /Your rating moved \+2\.9\./);

    // The forbidden readings.
    assert.doesNotMatch(r.plain, /above expectation/i);
    assert.doesNotMatch(r.plain, /exceeded expectation/i);
    assert.doesNotMatch(r.plain, /pushed you above/i);
  } finally { await app.close(); }
});

// The headline must agree with which side was actually favoured, across every
// card rather than one hand-picked example. The standing is qualitative now, so
// the check is on direction, not on a number the card no longer prints.
test('the standing headline agrees with the recorded pre-match ratings', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      selectedMonth = 'all'; minGames = 10; render();
      const out = [];
      ['Shaun', 'Rishi', 'Eli', 'Osh'].forEach((name) => {
        openSheet(name);
        [...document.querySelectorAll('.match')].forEach((card) => {
          const why = card.querySelector('.why-moved');
          if (!why) return;
          const body = why.querySelector('.why-moved-body').innerText;
          const headline = body.split('.')[0] + '.';
          const id = [...card.querySelectorAll('*')].length ? null : null;
          out.push({ name, headline });
        });
        closeSheet();
      });
      // And the same thing computed straight from the record, per player.
      // matchesIncludingDraws(), not MATCHES: a player's profile shows every
      // game they played, and a draw is rated too, so it carries a pre-match
      // standing and an explanation like any other.
      const expectations = [];
      ['Shaun', 'Rishi', 'Eli', 'Osh'].forEach((name) => {
        matchesIncludingDraws().filter((m) => m.winners.includes(name) || m.losers.includes(name))
          .sort((a, b) => (a.date < b.date ? 1 : -1))
          .forEach((m) => {
            const v = MatchFacts.forPlayer(V3_MATCH_FACTS[m.id], name);
            if (!v) return;
            expectations.push({
              name,
              headline: RatingExplainer.standingOf(v.mine.preRating, v.theirs.preRating).headline,
              gap: v.mine.preRating - v.theirs.preRating,
            });
          });
      });
      return { out, expectations };
    });

    assert.ok(r.out.length > 20, `not enough cards checked (${r.out.length})`);
    assert.strictEqual(r.out.length, r.expectations.length, 'one explanation per rated match');
    const wrong = r.out.filter((x, i) => x.headline !== r.expectations[i].headline);
    assert.deepStrictEqual(wrong, [], 'the headline must be the one the recorded ratings imply');

    // The direction is right: nobody is called a favourite while behind.
    const backwards = r.expectations.filter((e) =>
      (/favourites/.test(e.headline) && e.gap <= 0) || (/underdogs/.test(e.headline) && e.gap >= 0));
    assert.deepStrictEqual(backwards, [], 'a favourite must actually have been ahead');

    // Every shape is exercised by the real record, not just one of them.
    const kinds = new Set(r.expectations.map((e) => e.headline));
    assert.ok(kinds.size >= 3, `the record should exercise several standings, saw ${[...kinds].join(' / ')}`);

    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// The rule, swept across every normal card rather than checked on one: no raw
// performance-score sentence in front of a player, anywhere.
test('no normal card leads with a raw performance score', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const found = [];
      const scan = (where, text) => {
        if (/[Pp]erformance score \d?\d?\.\d\d against/.test(text)) found.push(where);
      };

      // Profile cards.
      selectedMonth = 'all'; minGames = 10; render();
      openSheet('Shaun');
      [...document.querySelectorAll('.match')].forEach((el, i) => {
        // The disclosure is deliberately excluded: that is where it belongs.
        const clone = el.cloneNode(true);
        [...clone.querySelectorAll('.wm-calc')].forEach((d) => d.remove());
        scan(`profile card ${i}`, clone.innerText);
      });
      closeSheet();

      // Monthly breakdown.
      selectedMonth = '2026-07'; minGames = 5; render();
      openMonthlyRatingBreakdown('Shaun', '2026-07');
      const modal = document.getElementById('monthlyRatingModal');
      const mClone = modal.cloneNode(true);
      [...mClone.querySelectorAll('.wm-calc, #mrbFullCalcBody, #mrbHowItWorksBody')].forEach((d) => d.remove());
      scan('monthly breakdown', mClone.innerText);
      modal.classList.remove('show');

      // Games feed, with a card expanded.
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      selectedMonth = 'all'; renderGamesTab();
      const first = document.querySelector('#gamesView .game-card-clickable');
      if (first) first.click();
      const gv = document.getElementById('gamesView').cloneNode(true);
      [...gv.querySelectorAll('.wm-calc')].forEach((d) => d.remove());
      scan('games feed', gv.innerText);

      return { found };
    });
    assert.deepStrictEqual(r.found, [],
      'a raw performance-score sentence is still in front of a player');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun's correction: Play -> Games opens on All time and is not aligned with
// the completed-month views.
test('the Games view opens on All time', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      const summaryWhileShut = document.getElementById('gamesFiltersToggle').textContent;
      gamesFiltersOpen = true;   // the filter panel arrives shut; this test reads its select
      renderGamesTab();
      const sel = document.getElementById('gamesMonthSelect');
      const dates = [...document.querySelectorAll('#gamesView .section-heading')]
        .map((e) => e.textContent.trim()).filter((t) => /\d{4}/.test(t));
      return {
        gamesMonth,
        // The rankings month is deliberately NOT All time, which is the whole
        // point: Games must not inherit it.
        rankingsMonth: selectedMonth,
        selectValue: sel ? sel.value : null,
        summaryWhileShut,
        months: new Set(dates.map((d) => d.slice(-4))).size,
        cards: document.querySelectorAll('#gamesView .game-card-clickable').length,
      };
    });
    assert.strictEqual(r.gamesMonth, 'all', 'Games must open on All time');
    assert.match(r.summaryWhileShut, /All time/,
      'and the shut filter panel must say so on its own heading');
    assert.notStrictEqual(r.rankingsMonth, 'all',
      'this test is only meaningful while Rankings defaults to a month');
    assert.strictEqual(r.selectValue, 'all', 'and the month control must say so');
    assert.ok(r.cards > 100, `All time should show the whole record, saw ${r.cards} cards`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== PLAY HISTORY, ADMIN SURFACE (18 Sep 2026) =============
// The Play tab is a results feed. Correction controls exist for one person and
// must not make every game read like a maintenance ticket.

test('a non-admin result card carries no correction or removal controls', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = false; currentUserName = '';
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      selectedMonth = 'all'; renderGamesTab();
      const view = document.getElementById('gamesView');
      return {
        cards: view.querySelectorAll('.game-card-clickable').length,
        edit: view.querySelectorAll('[data-edit]').length,
        del: view.querySelectorAll('[data-delete]').length,
        manage: view.querySelectorAll('[data-manage]').length,
        text: view.innerText,
      };
    });
    assert.ok(r.cards > 10, 'the feed must actually be showing games');
    assert.strictEqual(r.edit, 0, 'no correction control may be offered');
    assert.strictEqual(r.del, 0, 'no removal control may be offered');
    assert.strictEqual(r.manage, 0, 'not even the manage affordance');
    assert.doesNotMatch(r.text, /Correct match|Remove and replay/);
    assert.doesNotMatch(r.text, /re-derives every rating that came after it/,
      'the replay warning is maintenance copy and must not sit under every result');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('an admin sees a compact manage affordance, with the actions collapsed', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = true; currentUserName = 'Board';
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      selectedMonth = 'all'; renderGamesTab();
      const view = document.getElementById('gamesView');
      const manage = [...view.querySelectorAll('[data-manage]')];
      return {
        cards: view.querySelectorAll('.game-card-clickable').length,
        manage: manage.length,
        label: manage[0] ? manage[0].innerText.trim() : null,
        expanded: manage[0] ? manage[0].getAttribute('aria-expanded') : null,
        edit: view.querySelectorAll('[data-edit]').length,
        del: view.querySelectorAll('[data-delete]').length,
        bodies: view.querySelectorAll('.game-manage-body').length,
        warnings: (view.innerText.match(/re-derives every rating that came after it/g) || []).length,
      };
    });
    assert.ok(r.manage > 10, 'every card offers the affordance to an admin');
    assert.strictEqual(r.manage, r.cards, 'one per card');
    assert.match(r.label, /Manage/);
    assert.strictEqual(r.expanded, 'false');
    assert.strictEqual(r.edit, 0, 'the actions start collapsed');
    assert.strictEqual(r.del, 0, 'the actions start collapsed');
    assert.strictEqual(r.bodies, 0);
    assert.strictEqual(r.warnings, 0, 'the warning copy must not be repeated under every result');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('opening one card reveals its actions and leaves the others collapsed', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = true; currentUserName = 'Board';
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      selectedMonth = 'all'; renderGamesTab();
      const view = () => document.getElementById('gamesView');

      const first = view().querySelector('[data-manage]');
      const firstId = first.dataset.manage;
      first.click();

      const openBodies = view().querySelectorAll('.game-manage-body');
      const opened = {
        bodies: openBodies.length,
        edit: view().querySelectorAll('[data-edit]').length,
        del: view().querySelectorAll('[data-delete]').length,
        editId: view().querySelector('[data-edit]').dataset.edit,
        warnings: (view().innerText.match(/re-derives every rating that came after it/g) || []).length,
        label: view().querySelector(`[data-manage="${firstId}"]`).innerText.trim(),
        expanded: view().querySelector(`[data-manage="${firstId}"]`).getAttribute('aria-expanded'),
        others: [...view().querySelectorAll('[data-manage]')]
          .filter((el) => el.dataset.manage !== firstId)
          .every((el) => el.getAttribute('aria-expanded') === 'false'),
      };

      // A second card takes over; the first collapses.
      const second = [...view().querySelectorAll('[data-manage]')].find((el) => el.dataset.manage !== firstId);
      const secondId = second.dataset.manage;
      second.click();
      const moved = {
        bodies: view().querySelectorAll('.game-manage-body').length,
        editId: view().querySelector('[data-edit]').dataset.edit,
        firstClosed: view().querySelector(`[data-manage="${firstId}"]`).getAttribute('aria-expanded') === 'false',
      };

      // Tapping the open one again closes it.
      view().querySelector(`[data-manage="${secondId}"]`).click();
      const closed = {
        bodies: view().querySelectorAll('.game-manage-body').length,
        edit: view().querySelectorAll('[data-edit]').length,
      };

      return { firstId, secondId, opened, moved, closed, writes: window.__writes.length };
    });

    assert.strictEqual(r.opened.bodies, 1, 'exactly one card opens');
    assert.strictEqual(r.opened.edit, 1);
    assert.strictEqual(r.opened.del, 1);
    assert.strictEqual(r.opened.editId, r.firstId, 'the actions belong to the card that was opened');
    assert.strictEqual(r.opened.warnings, 1, 'the warning appears once, in the open card');
    assert.match(r.opened.label, /Close/);
    assert.strictEqual(r.opened.expanded, 'true');
    assert.strictEqual(r.opened.others, true, 'every other card stays collapsed');

    assert.strictEqual(r.moved.bodies, 1, 'still only one open');
    assert.strictEqual(r.moved.editId, r.secondId);
    assert.strictEqual(r.moved.firstClosed, true);

    assert.strictEqual(r.closed.bodies, 0, 'tapping Close collapses it again');
    assert.strictEqual(r.closed.edit, 0);

    assert.strictEqual(r.writes, 0, 'opening and closing a card writes nothing');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// The one thing collapsing must not break: a staged correction has to stay
// visible until it is confirmed or cancelled.
test('a staged correction keeps its card open and survives the collapse', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Board';
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      selectedMonth = 'all'; renderGamesTab();
      const yn = document.getElementById('gamesYourName'); if (yn) yn.value = 'Board';
      const view = () => document.getElementById('gamesView');

      const first = view().querySelector('[data-manage]');
      const id = first.dataset.manage;
      first.click();
      await deleteMatch(id);

      const staged = {
        bodies: view().querySelectorAll('.game-manage-body').length,
        panel: !!document.getElementById('matchFixCommitBtn'),
        commit: document.getElementById('matchFixCommitBtn').textContent.trim(),
      };

      // Closing the card cancels the staged plan rather than hiding it.
      view().querySelector(`[data-manage="${id}"]`).click();
      const afterClose = {
        plan: !!matchFixPlan,
        panel: !!document.getElementById('matchFixCommitBtn'),
        bodies: view().querySelectorAll('.game-manage-body').length,
      };
      return { id, staged, afterClose, writes: window.__writes.length };
    });

    assert.strictEqual(r.staged.bodies, 1, 'the managed card stays open while a fix is staged');
    assert.strictEqual(r.staged.panel, true, 'the blast-radius panel must be visible');
    assert.strictEqual(r.staged.commit, 'Remove and replay');
    assert.strictEqual(r.afterClose.plan, false, 'closing cancels rather than hides the plan');
    assert.strictEqual(r.afterClose.panel, false);
    assert.strictEqual(r.afterClose.bodies, 0);
    assert.strictEqual(r.writes, 0, 'nothing is written by staging or cancelling');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== GAMES CARD: COMPACT + WORKING DISCLOSURE ==============
// "See full calculation" was inert on the Games feed. The card wraps its body
// in .game-card-clickable, whose handler toggles the card and re-renders, so a
// click on the summary collapsed the card before the browser could open the
// details. It worked on the profile card only because that card has no handler.
test('See full calculation opens and closes on a Games card', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      renderGamesTab();
      const card = document.querySelector('#gamesView .game-card-clickable');
      const gameId = card.dataset.gameid;
      card.click();                                   // expand the card

      const details = document.querySelector('#gamesView .wm-calc');
      if (!details) return { found: false };
      const summary = details.querySelector('summary');

      const before = { open: details.open, expanded: expandedGameId };
      summary.click();                                // open the disclosure
      const opened = {
        open: document.querySelector('#gamesView .wm-calc').open,
        expanded: expandedGameId,
        text: document.querySelector('#gamesView .wm-calc').innerText.replace(/\n+/g, ' | '),
      };
      document.querySelector('#gamesView .wm-calc summary').click();   // and close it
      const closed = {
        open: document.querySelector('#gamesView .wm-calc').open,
        expanded: expandedGameId,
      };
      return { found: true, gameId, before, opened, closed };
    });

    assert.strictEqual(r.found, true, 'the expanded card must carry a disclosure');
    assert.strictEqual(r.before.open, false, 'it starts closed');
    assert.strictEqual(r.before.expanded, r.gameId, 'the card is expanded');

    assert.strictEqual(r.opened.open, true, 'clicking the summary must open it');
    assert.strictEqual(r.opened.expanded, r.gameId,
      'and must NOT collapse the card underneath it — that was the bug');

    assert.strictEqual(r.closed.open, false, 'clicking again must close it');
    assert.strictEqual(r.closed.expanded, r.gameId, 'still without collapsing the card');

    // And it contains the technical facts, from the persisted record.
    assert.match(r.opened.text, /Pre-match expected score/);
    assert.match(r.opened.text, /Share of games won/);
    assert.match(r.opened.text, /Match result contribution/);
    assert.match(r.opened.text, /Blended performance score/);
    assert.match(r.opened.text, /K \d/);
    assert.match(r.opened.text, /reliability \d+% → \d+%/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the expanded Games card stays compact', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      renderGamesTab();
      const card = document.querySelector('#gamesView .game-card-clickable');
      card.click();
      const expanded = document.querySelector('#gamesView .callout-card');
      const clone = expanded.cloneNode(true);
      [...clone.querySelectorAll('.wm-calc')].forEach((d) => d.remove());
      return {
        visible: clone.innerText.replace(/\n+/g, '\n').trim(),
        hasDisclosure: !!expanded.querySelector('.wm-calc'),
      };
    });

    // The redundant explanation between the result line and the per-player
    // movements is gone; that nuance lives in the disclosure now.
    assert.doesNotMatch(r.visible, /matched the game-share expectation/i);
    assert.doesNotMatch(r.visible, /also contributes to the rating calculation/i);
    assert.doesNotMatch(r.visible, /won (more|fewer) games than expected/i);
    assert.doesNotMatch(r.visible, /[Pp]erformance score/);

    // One line carries the expectation, what was taken, and the result.
    assert.match(r.visible, /Expected \d+% of games · won \d+\/\d+ \(\d+%\) · (won match|not finished)/);
    assert.match(r.visible, /ratings going in/);
    assert.match(r.visible, /RATING CHANGE, PER PLAYER/i);
    assert.strictEqual(r.hasDisclosure, true);

    // Trimmed: a line of indentation is not something the reader sees, and
    // counting it made this brittle to any change in how the card nests.
    const lines = r.visible.split('\n').map((l) => l.trim()).filter(Boolean);
    assert.ok(lines.length <= 12, `the expanded card should stay short, got ${lines.length} lines:\n${lines.join('\n')}`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== RANKED / IDLE / INACTIVE (19 Sep 2026) ===============
// The app used to call two different things "inactive": a player who has not
// played much lately, and a player who has left the club. These cover the
// separation, and the eligibility bug that separation exposed.

// Shaun spotted Ant Slice showing "#–" on Home despite recent activity. He has
// well over the threshold; getViewerSnapshot was additionally requiring
// total >= 10, which is the rankings list's default min-games DISPLAY filter,
// not an eligibility rule.
test('a player with recent matches gets a rank, whatever their lifetime total', { skip }, async () => {
  const app = await H.open({ now: FIXTURE_NOW });
  try {
    const r = await app.run(() => {
      const name = 'Ant Slice';
      const st = playerStateOf(name);
      const snap = getViewerSnapshot(name);
      const p = PLAYERS.find((x) => x.name === name);
      return {
        recent: st.recentMatches,
        lifetime: p.total,
        participation: st.participation,
        ranking: st.ranking,
        rankable: st.rankable,
        overallRank: snap.overallRank,
        tierRank: snap.tierRank,
        eligible: snap.eligible,
      };
    });

    assert.ok(r.recent >= 2, `the case under test needs recent matches, got ${r.recent}`);
    assert.ok(r.lifetime < 10, `and a lifetime total under the old hardcoded 10, got ${r.lifetime}`);
    assert.strictEqual(r.participation, 'ACTIVE');
    assert.strictEqual(r.ranking, 'RANKED');
    assert.strictEqual(r.rankable, true);
    assert.ok(r.overallRank > 0, 'must have an overall rank, not "#–"');
    assert.ok(r.tierRank > 0, 'must have a tier rank, not "#–"');
    assert.strictEqual(r.eligible, true);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// One helper, one dataset, every surface. A player must not be Ranked in the
// list and "#–" on their own profile.
test('Ranked/Idle state and rank availability agree across every surface', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      activeTab = 'power'; selectedMonth = 'all'; activeTier = 'All'; minGames = 0; query = '';
      includeIdle = true; includeInactive = true;   // widest pool, so every state is present
      render();

      const disagreements = [];
      let checked = 0;
      [...document.querySelectorAll('#list .row')].forEach((row) => {
        const nameEl = row.querySelector('.nm');
        const name = row.dataset.player || (nameEl ? nameEl.textContent.trim() : null);
        if (!name) return;
        checked++;
        const st = playerStateOf(name);                 // the shared helper
        const snap = getViewerSnapshot(name);           // Home + Profile
        const hasIdle = !!row.querySelector('.idle-tag');
        const hasInactive = !!row.querySelector('.inactive-tag');

        const officiallyRanked = st.ranking === 'RANKED';
        if (snap.eligible !== officiallyRanked) disagreements.push(`${name}: snapshot eligible=${snap.eligible}, helper=${st.ranking}`);
        if ((snap.overallRank !== null) !== officiallyRanked) disagreements.push(`${name}: snapshot rank=${snap.overallRank}, helper=${st.ranking}`);
        if (hasIdle !== (st.ranking === 'IDLE')) disagreements.push(`${name}: idle badge=${hasIdle}, helper=${st.ranking}`);
        if (hasInactive !== (st.participation === 'INACTIVE')) disagreements.push(`${name}: inactive badge=${hasInactive}, helper=${st.participation}`);
      });

      includeIdle = false; includeInactive = false;
      return { checked, disagreements };
    });

    assert.ok(r.checked > 25, `not enough players checked (${r.checked})`);
    assert.deepStrictEqual(r.disagreements, [],
      'Rankings, Home and Profile must agree on every player');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('an active player below the threshold reads Idle, not Inactive', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      activeTab = 'power'; selectedMonth = 'all'; activeTier = 'All'; minGames = 0; query = '';
      includeIdle = true; includeInactive = false;
      render();
      const idleRows = [...document.querySelectorAll('#list .row')].filter((el) => el.querySelector('.idle-tag'));
      const names = idleRows.map((el) => (el.dataset.player || el.querySelector('.nm').textContent).trim());
      const out = {
        idleCount: idleRows.length,
        inactiveTags: document.querySelectorAll('#list .inactive-tag').length,
        allActive: names.every((n) => playerStateOf(n).participation === 'ACTIVE'),
        badgeText: idleRows[0] ? idleRows[0].querySelector('.idle-tag').textContent : null,
        listText: document.getElementById('list').innerText,
      };
      includeIdle = false;
      return out;
    });

    assert.ok(r.idleCount > 0, 'the fixture must contain idle players');
    assert.strictEqual(r.badgeText, 'Idle');
    assert.strictEqual(r.inactiveTags, 0, 'an idle player is never tagged Inactive');
    assert.strictEqual(r.allActive, true, 'every idle player is still an active member');
    assert.doesNotMatch(r.listText, /Not currently ranked/,
      'the old wording implied missing data rather than a state');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun's correction: the toggles widen the RANKING POOL. An idle player whose
// rating belongs 5th appears 5th, not in a section underneath.
test('including idle or inactive merges them into the ranked list and renumbers it', { skip }, async () => {
  const app = await H.open({ now: FIXTURE_NOW });
  try {
    const r = await app.run(() => {
      const snap = () => {
        const rows = [...document.querySelectorAll('#list .row')];
        return {
          order: rows.map((el) => (el.dataset.player || el.querySelector('.nm').textContent).trim()),
          ranks: rows.map((el) => el.querySelector('.rank').textContent.trim()),
          idle: document.querySelectorAll('#list .idle-tag').length,
          inactive: document.querySelectorAll('#list .inactive-tag').length,
          note: (document.getElementById('eligibilityDivider') || {}).textContent || null,
        };
      };
      const away = PLAYERS.find((p) => p.name === 'Max'); away.status = 'temporarilyInactive'; away.active = false;   // the fixture's only flagged player is archived, so mark one away
      activeTab = 'power'; selectedMonth = 'all'; activeTier = 'All'; minGames = 0; query = '';
      activeSortP = 'rating';
      const out = {};
      includeIdle = false; includeInactive = false; render(); out.official = snap();
      includeIdle = true;  includeInactive = false; render(); out.withIdle = snap();
      includeIdle = false; includeInactive = true;  render(); out.withInactive = snap();
      includeIdle = true;  includeInactive = true;  render(); out.withBoth = snap();
      includeIdle = false; includeInactive = false;
      out.ratings = Object.fromEntries(PLAYERS.map((p) => [p.name, p.rating]));
      return out;
    });

    // Default: the official pool only. Nobody carries a state badge.
    assert.strictEqual(r.official.idle, 0);
    assert.strictEqual(r.official.inactive, 0);
    assert.strictEqual(r.official.note, null, 'no "including" note when nothing was included');

    // Every view is numbered 1..n with no gaps and no dashes.
    ['official', 'withIdle', 'withInactive', 'withBoth'].forEach((k) => {
      const expected = r[k].order.map((_, i) => String(i + 1));
      assert.deepStrictEqual(r[k].ranks, expected, `${k} must be numbered sequentially`);
    });

    // Including idle adds them INTO the list, in rating order.
    assert.ok(r.withIdle.idle > 0, 'the fixture must contain idle players');
    assert.strictEqual(r.withIdle.order.length, r.official.order.length + r.withIdle.idle);
    const sorted = [...r.withIdle.order].sort((a, b) => r.ratings[b] - r.ratings[a]);
    assert.deepStrictEqual(r.withIdle.order, sorted,
      'the merged list must be ordered by rating, not appended in a block');
    assert.match(r.withIdle.note, /Including idle players/);
    assert.match(r.withIdle.note, /not official ranks/);

    // And a real re-numbering happened: at least one ranked player moved down.
    const movedDown = r.official.order.filter((name, i) => r.withIdle.order.indexOf(name) > i);
    assert.ok(movedDown.length > 0,
      'merging idle players must shift the positions beneath them');

    // Inactive behaves the same way, independently.
    assert.ok(r.withInactive.inactive > 0);
    assert.strictEqual(r.withInactive.idle, 0, 'the two toggles are independent');
    assert.strictEqual(r.withInactive.order.length, r.official.order.length + r.withInactive.inactive);
    assert.match(r.withInactive.note, /Including temporarily inactive players/);

    // Both: one ordered list containing all three states.
    assert.strictEqual(r.withBoth.order.length,
      r.official.order.length + r.withIdle.idle + r.withInactive.inactive);
    assert.ok(r.withBoth.idle > 0 && r.withBoth.inactive > 0);
    const sortedBoth = [...r.withBoth.order].sort((a, b) => r.ratings[b] - r.ratings[a]);
    assert.deepStrictEqual(r.withBoth.order, sortedBoth);
    assert.match(r.withBoth.note, /Including idle and temporarily inactive players/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Turning a toggle on must not change what anybody officially is.
test('the toggles change the view, never eligibility or participation', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      activeTab = 'power'; selectedMonth = 'all'; activeTier = 'All'; minGames = 0; query = '';
      const capture = () => Object.fromEntries(PLAYERS.map((p) => {
        const st = playerStateOf(p.name);
        const snap = getViewerSnapshot(p.name);
        return [p.name, `${st.participation}/${st.ranking}/${snap.eligible}/${snap.overallRank}/${p.rating}`];
      }));
      includeIdle = false; includeInactive = false; render();
      const before = capture();
      includeIdle = true; includeInactive = true; render();
      const after = capture();
      includeIdle = false; includeInactive = false; render();
      return { before, after };
    });
    assert.deepStrictEqual(r.after, r.before,
      'official state, rank availability and ratings must be identical whatever the view shows');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the state toggles and the min-games presets do not fight', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      activeTab = 'power'; selectedMonth = 'all'; activeTier = 'All'; query = '';
      includeIdle = false; includeInactive = false;
      document.querySelectorAll('#stateFilterRow .state-toggle').forEach((b) => b.classList.remove('active'));
      document.querySelector('#minGamesRow .preset-btn[data-n="5"]').click();
      const afterMinGames = {
        minGames,
        idleOn: document.querySelector('#stateFilterRow [data-toggle="idle"]').classList.contains('active'),
      };
      document.querySelector('#stateFilterRow [data-toggle="idle"]').click();
      const afterToggle = {
        minGames,
        minGamesActive: document.querySelector('#minGamesRow .preset-btn.active').dataset.n,
        includeIdle,
        includeInactive,
        idleOn: document.querySelector('#stateFilterRow [data-toggle="idle"]').classList.contains('active'),
      };
      document.querySelector('#stateFilterRow [data-toggle="idle"]').click();
      const afterSecondPress = { includeIdle };
      includeIdle = false; includeInactive = false;
      return { afterMinGames, afterToggle, afterSecondPress };
    });

    assert.strictEqual(r.afterMinGames.minGames, 5);
    assert.strictEqual(r.afterMinGames.idleOn, false, 'a min-games press must not activate a state toggle');

    assert.strictEqual(r.afterToggle.includeIdle, true);
    assert.strictEqual(r.afterToggle.includeInactive, false, 'the toggles are independent');
    assert.strictEqual(r.afterToggle.idleOn, true);
    assert.strictEqual(r.afterToggle.minGames, 5, 'a toggle press must not corrupt minGames');
    assert.strictEqual(r.afterToggle.minGamesActive, '5');

    assert.strictEqual(r.afterSecondPress.includeIdle, false, 'pressing again turns it off');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
// ===================== GAMES CARD: COMPACT + WORKING DISCLOSURE ==============
// "See full calculation" was inert on the Games feed. The card wraps its body
// in .game-card-clickable, whose handler toggles the card and re-renders, so a
// click on the summary collapsed the card before the browser could open the
// details. It worked on the profile card only because that card has no handler.
test('See full calculation opens and closes on a Games card', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      renderGamesTab();
      const card = document.querySelector('#gamesView .game-card-clickable');
      const gameId = card.dataset.gameid;
      card.click();                                   // expand the card

      const details = document.querySelector('#gamesView .wm-calc');
      if (!details) return { found: false };
      const summary = details.querySelector('summary');

      const before = { open: details.open, expanded: expandedGameId };
      summary.click();                                // open the disclosure
      const opened = {
        open: document.querySelector('#gamesView .wm-calc').open,
        expanded: expandedGameId,
        text: document.querySelector('#gamesView .wm-calc').innerText.replace(/\n+/g, ' | '),
      };
      document.querySelector('#gamesView .wm-calc summary').click();   // and close it
      const closed = {
        open: document.querySelector('#gamesView .wm-calc').open,
        expanded: expandedGameId,
      };
      return { found: true, gameId, before, opened, closed };
    });

    assert.strictEqual(r.found, true, 'the expanded card must carry a disclosure');
    assert.strictEqual(r.before.open, false, 'it starts closed');
    assert.strictEqual(r.before.expanded, r.gameId, 'the card is expanded');

    assert.strictEqual(r.opened.open, true, 'clicking the summary must open it');
    assert.strictEqual(r.opened.expanded, r.gameId,
      'and must NOT collapse the card underneath it — that was the bug');

    assert.strictEqual(r.closed.open, false, 'clicking again must close it');
    assert.strictEqual(r.closed.expanded, r.gameId, 'still without collapsing the card');

    // And it contains the technical facts, from the persisted record.
    assert.match(r.opened.text, /Pre-match expected score/);
    assert.match(r.opened.text, /Share of games won/);
    assert.match(r.opened.text, /Match result contribution/);
    assert.match(r.opened.text, /Blended performance score/);
    assert.match(r.opened.text, /K \d/);
    assert.match(r.opened.text, /reliability \d+% → \d+%/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the expanded Games card stays compact', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      renderGamesTab();
      const card = document.querySelector('#gamesView .game-card-clickable');
      card.click();
      const expanded = document.querySelector('#gamesView .callout-card');
      const clone = expanded.cloneNode(true);
      [...clone.querySelectorAll('.wm-calc')].forEach((d) => d.remove());
      return {
        visible: clone.innerText.replace(/\n+/g, '\n').trim(),
        hasDisclosure: !!expanded.querySelector('.wm-calc'),
      };
    });

    // The redundant explanation between the result line and the per-player
    // movements is gone; that nuance lives in the disclosure now.
    assert.doesNotMatch(r.visible, /matched the game-share expectation/i);
    assert.doesNotMatch(r.visible, /also contributes to the rating calculation/i);
    assert.doesNotMatch(r.visible, /won (more|fewer) games than expected/i);
    assert.doesNotMatch(r.visible, /[Pp]erformance score/);

    // One line carries the expectation, what was taken, and the result.
    assert.match(r.visible, /Expected \d+% of games · won \d+\/\d+ \(\d+%\) · (won match|not finished)/);
    assert.match(r.visible, /ratings going in/);
    assert.match(r.visible, /RATING CHANGE, PER PLAYER/i);
    assert.strictEqual(r.hasDisclosure, true);

    // Trimmed: a line of indentation is not something the reader sees, and
    // counting it made this brittle to any change in how the card nests.
    const lines = r.visible.split('\n').map((l) => l.trim()).filter(Boolean);
    assert.ok(lines.length <= 12, `the expanded card should stay short, got ${lines.length} lines:\n${lines.join('\n')}`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== RANKED / IDLE / INACTIVE (19 Sep 2026) ===============
// The app used to call two different things "inactive": a player who has not
// played much lately, and a player who has left the club. These cover the
// separation, and the eligibility bug that separation exposed.

// Shaun spotted Ant Slice showing "#–" on Home despite recent activity. He has
// well over the threshold; getViewerSnapshot was additionally requiring
// total >= 10, which is the rankings list's default min-games DISPLAY filter,
// not an eligibility rule.
test('a player with recent matches gets a rank, whatever their lifetime total', { skip }, async () => {
  const app = await H.open({ now: FIXTURE_NOW });
  try {
    const r = await app.run(() => {
      const name = 'Ant Slice';
      const st = playerStateOf(name);
      const snap = getViewerSnapshot(name);
      const p = PLAYERS.find((x) => x.name === name);
      return {
        recent: st.recentMatches,
        lifetime: p.total,
        participation: st.participation,
        ranking: st.ranking,
        rankable: st.rankable,
        overallRank: snap.overallRank,
        tierRank: snap.tierRank,
        eligible: snap.eligible,
      };
    });

    assert.ok(r.recent >= 2, `the case under test needs recent matches, got ${r.recent}`);
    assert.ok(r.lifetime < 10, `and a lifetime total under the old hardcoded 10, got ${r.lifetime}`);
    assert.strictEqual(r.participation, 'ACTIVE');
    assert.strictEqual(r.ranking, 'RANKED');
    assert.strictEqual(r.rankable, true);
    assert.ok(r.overallRank > 0, 'must have an overall rank, not "#–"');
    assert.ok(r.tierRank > 0, 'must have a tier rank, not "#–"');
    assert.strictEqual(r.eligible, true);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});


// ===================== GAMES: HISTORICAL TIER + GAME TYPE (19 Sep 2026) =====
// The tier beside a name on a Games card is the tier that player held ON THE
// DAY. A promotion recorded later must not rewrite what an old match was.

test('Games cards label each player with their tier on the day', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      gamesMonth = 'all'; setGamesPlayerFilter([]); gamesType = 'all';
      renderGamesTab();

      // Someone whose tier actually changed during the season.
      const changed = [];
      PLAYERS.forEach((p) => {
        const early = historicalTierOf(p.name, '2026-06-05');
        const now = historicalTierOf(p.name, '2026-12-31');
        if (early && now && early !== now) changed.push({ name: p.name, early, now });
      });

      const titles = [...document.querySelectorAll('#gamesView .cc-title')].map((e) => e.textContent.trim());
      const first = document.querySelector('#gamesView .game-card-clickable');
      first.click();
      const expanded = document.querySelector('#gamesView .callout-card').innerText;
      const expandedId = first.dataset.gameid;
      const expandedMatch = getDisplayMatches().find((m) => m.id === expandedId);
      return {
        titles: titles.slice(0, 40),
        changed,
        expanded,
        expandedNames: [].concat(expandedMatch.winners, expandedMatch.losers),
        expandedDate: expandedMatch.date,
        expandedTiers: [].concat(expandedMatch.winners, expandedMatch.losers)
          .map((n) => historicalTierOf(n, expandedMatch.date)),
      };
    });

    // Every collapsed title carries a tier beside every name.
    const withTier = r.titles.filter((t) => /\([SABC]\)/.test(t));
    assert.strictEqual(withTier.length, r.titles.length, 'every card must label tiers');

    // The expanded detail uses the same labels, with the ratings going in.
    r.expandedNames.forEach((n, i) => {
      assert.ok(r.expanded.includes(`${n} (${r.expandedTiers[i]})`),
        `expanded detail must show ${n} (${r.expandedTiers[i]}), got:\n${r.expanded}`);
    });

    // And a player whose tier changed shows the OLD tier on an old card.
    assert.ok(r.changed.length > 0, 'the record must contain a tier change to test against');
    const someone = r.changed[0];
    assert.notStrictEqual(someone.early, someone.now,
      `${someone.name} moved ${someone.early} -> ${someone.now}, which is the case under test`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('a promotion does not rewrite the tier on an older card', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      // Find a player with a recorded tier change and a match on each side of it.
      let found = null;
      PLAYERS.forEach((p) => {
        if (found) return;
        const before = historicalTierOf(p.name, '2026-06-05');
        const after = historicalTierOf(p.name, '2026-12-31');
        if (!before || !after || before === after) return;
        const theirs = getDisplayMatches()
          .filter((m) => m.winners.includes(p.name) || m.losers.includes(p.name))
          .sort((a, b) => (a.date < b.date ? -1 : 1));
        const early = theirs.find((m) => historicalTierOf(p.name, m.date) === before);
        const late = theirs.find((m) => historicalTierOf(p.name, m.date) === after);
        if (early && late) found = { name: p.name, before, after, earlyDate: early.date, lateDate: late.date };
      });
      return found;
    });

    assert.ok(r, 'the record must contain a player with matches either side of a tier change');
    assert.notStrictEqual(r.before, r.after);
    assert.ok(r.earlyDate < r.lateDate,
      `${r.name} shows ${r.before} on ${r.earlyDate} and ${r.after} on ${r.lateDate}`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('Month, Player and Game type filters compose', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      const count = () => document.querySelectorAll('#gamesView .game-card-clickable').length;
      const ids = () => [...document.querySelectorAll('#gamesView .game-card-clickable')].map((e) => e.dataset.gameid);

      const out = {};
      gamesMonth = 'all'; setGamesPlayerFilter([]); gamesType = 'all'; renderGamesTab();
      out.everything = count();

      // Player alone.
      setGamesPlayerFilter(['Len']); renderGamesTab();
      out.lenAll = count();

      // Player + a specific, orientation-independent matchup.
      gamesType = 'match:AB vs BB'; renderGamesTab();
      out.lenAbBb = count();
      out.lenAbBbIds = ids();
      // Verify each survivor really is that composition, from the same source.
      out.allCorrect = ids().every((id) => {
        const m = getDisplayMatches().find((x) => x.id === id);
        const t = gameTypeOf(m);
        const hasLen = m.winners.includes('Len') || m.losers.includes('Len');
        return t && t.matchup === 'AB vs BB' && hasLen;
      });

      // Same type without the player filter must be a superset.
      setGamesPlayerFilter([]); renderGamesTab();
      out.allAbBb = count();
      out.supersetOk = out.lenAbBbIds.every((id) => ids().includes(id));

      // Add a month on top of the type.
      const month = getDisplayMatches().find((m) => gameTypeOf(m) && gameTypeOf(m).matchup === 'AB vs BB').date.slice(0, 7);
      gamesMonth = month; renderGamesTab();
      out.month = month;
      out.monthAbBb = count();
      out.monthCorrect = ids().every((id) => {
        const m = getDisplayMatches().find((x) => x.id === id);
        return m.date.slice(0, 7) === month && gameTypeOf(m).matchup === 'AB vs BB';
      });

      // A broad category filter.
      gamesMonth = 'all'; gamesType = 'cat:ALL_B'; renderGamesTab();
      out.allB = count();
      out.allBCorrect = ids().every((id) => {
        const m = getDisplayMatches().find((x) => x.id === id);
        return gameTypeOf(m).category === 'ALL_B';
      });

      gamesMonth = 'all'; setGamesPlayerFilter([]); gamesType = 'all'; renderGamesTab();
      return out;
    });

    assert.ok(r.everything > 100, `the feed must be showing the record, got ${r.everything}`);
    assert.ok(r.lenAll > 0 && r.lenAll < r.everything, 'the player filter must narrow it');
    assert.ok(r.lenAbBb > 0, 'Len must have AB vs BB matches in this record');
    assert.ok(r.lenAbBb < r.lenAll, 'the game-type filter must narrow it further');
    assert.strictEqual(r.allCorrect, true, 'every survivor must be Len AND AB vs BB');

    assert.ok(r.allAbBb >= r.lenAbBb, 'dropping the player filter must not lose matches');
    assert.strictEqual(r.supersetOk, true, "Len's AB vs BB matches must all be in the unfiltered set");

    assert.ok(r.monthAbBb > 0 && r.monthAbBb <= r.allAbBb, 'adding a month must narrow, not replace');
    assert.strictEqual(r.monthCorrect, true, `every survivor must be in ${r.month} AND AB vs BB`);

    assert.ok(r.allB > 0);
    assert.strictEqual(r.allBCorrect, true, 'every all-B survivor must really be all-B');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the game-type control offers only types the current selection contains', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const b = document.querySelector('#tabrow .tab-btn[data-tab="games"]');
      if (b) b.click();
      gamesFiltersOpen = true;   // the filter panel arrives shut; this test reads its select
      const options = () => [...document.getElementById('gamesTypeSelect').querySelectorAll('option')]
        .map((o) => ({ value: o.value, text: o.textContent }));

      gamesMonth = 'all'; setGamesPlayerFilter([]); gamesType = 'all'; renderGamesTab();
      const all = options();

      setGamesPlayerFilter(['Len']); renderGamesTab();
      const len = options();

      // Every option offered for Len must actually return matches for Len.
      const empties = [];
      len.filter((o) => o.value !== 'all').forEach((o) => {
        gamesType = o.value; renderGamesTab();
        if (document.querySelectorAll('#gamesView .game-card-clickable').length === 0) empties.push(o.value);
      });

      gamesMonth = 'all'; setGamesPlayerFilter([]); gamesType = 'all'; renderGamesTab();
      return { allCount: all.length, lenCount: len.length, empties, first: all[0], all };
    });

    assert.deepStrictEqual(r.first, { value: 'all', text: 'All game types' });
    assert.ok(r.allCount > 5, 'the record should support several game types');
    assert.ok(r.lenCount < r.allCount, "a player's own set of game types is narrower");
    assert.deepStrictEqual(r.empties, [], 'no offered game type may return an empty list');

    // The broad options the brief names are present.
    const values = r.all.map((o) => o.value);
    ['cat:ALL_A', 'cat:ALL_B', 'cat:ALL_C', 'cat:MIXED'].forEach((v) => {
      assert.ok(values.includes(v), `${v} must be offered`);
    });
    assert.ok(values.includes('match:AA vs AA'));
    assert.ok(values.includes('match:AB vs BB'));

    // And no judgements in the labels.
    const text = r.all.map((o) => o.text).join(' ').toLowerCase();
    ['easy', 'soft', 'inflated'].forEach((w) => assert.ok(!text.includes(w)));
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== HOME LOWER SECTION (19 Sep 2026) =====================

const withHome = async (app, fn) => app.run(new Function('return (' + fn.toString() + ')();'));

test('Club Pulse cards open the player they name', { skip }, async () => {
  // A fixed clock inside the seeded record's range. The pulse names ranked and
  // in-form players, both judged over the last 30 days; on the real clock the
  // record ages out of that window (from 30 Sep 2026 a card came up empty),
  // which is the test asking about the calendar rather than the cards.
  const app = await H.open({ now: '2026-09-26T12:00:00Z' });
  try {
    const r = await app.run(() => {
      render();
      setCurrentViewer('Ant Slice');
      goToSection('home');
      renderHomeDashboard();
      const cards = [...document.querySelectorAll('#homeDashboard [data-pulse-player]')];
      const names = cards.map((c) => c.dataset.pulsePlayer);
      // Each card names the player it links to.
      const labelMismatch = cards.filter((c) => !c.innerText.includes(c.dataset.pulsePlayer));
      // Clicking the second one must open that player, not the viewer.
      const target = cards[1].dataset.pulsePlayer;
      cards[1].click();
      const opened = document.getElementById('sheetName').textContent.trim();
      closeSheet();
      return { count: cards.length, names, labelMismatch: labelMismatch.length, target, opened };
    });

    assert.strictEqual(r.count, 3, 'three pulse cards');
    assert.strictEqual(r.labelMismatch, 0, 'a card must name the player it opens');
    assert.strictEqual(r.opened, r.target, `clicking the In Form card must open ${r.target}`);
    assert.ok(r.names.every(Boolean));
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('All Insights lands at the top of Insights, not part-way down', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      render();
      setCurrentViewer('Ant Slice');
      // Leave Insights scrolled well down, as a previous visit would.
      legacyTabBtn('callouts').click();
      const view = document.getElementById('calloutsView');
      window.scrollTo(0, 4000);
      const scrolledAway = window.scrollY;

      goToSection('home');
      renderHomeDashboard();
      document.getElementById('homeAllInsightsBtn').click();
      return {
        scrolledAway,
        tab: activeTab,
        scrollY: window.scrollY,
        viewScrollTop: view.scrollTop,
        visible: document.getElementById('calloutsView').style.display !== 'none',
      };
    });

    assert.ok(r.scrolledAway > 0, 'the page must actually have been scrolled first');
    assert.strictEqual(r.tab, 'callouts', 'it must open Insights');
    assert.strictEqual(r.visible, true);
    assert.strictEqual(r.scrollY, 0, 'arriving from Home must land at the top');
    assert.strictEqual(r.viewScrollTop, 0);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('Match ideas is collapsed by default and expands on demand', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      render();
      setCurrentViewer('Ant Slice');
      goToSection('home');
      homeIdeasOpen = false;
      renderHomeDashboard();

      const head = document.getElementById('homeIdeasToggle');
      const closed = {
        bodyDisplay: document.getElementById('homeIdeasBody').style.display,
        expanded: head.getAttribute('aria-expanded'),
        cta: head.innerText.replace(/\n+/g, ' '),
        matchupVisible: !!document.querySelector('#homeIdeasBody .home-matchup-card') &&
          document.getElementById('homeIdeasBody').style.display !== 'none',
      };

      document.getElementById('homeIdeasToggle').click();
      const openState = {
        bodyDisplay: document.getElementById('homeIdeasBody').style.display,
        expanded: document.getElementById('homeIdeasToggle').getAttribute('aria-expanded'),
        cta: document.getElementById('homeIdeasToggle').innerText.replace(/\n+/g, ' '),
        hasMatchup: !!document.querySelector('#homeIdeasBody .home-matchup-card, #homeIdeasBody .home-card'),
      };

      document.getElementById('homeIdeasToggle').click();
      const reclosed = document.getElementById('homeIdeasBody').style.display;
      homeIdeasOpen = false;
      return { closed, openState, reclosed };
    });

    assert.strictEqual(r.closed.bodyDisplay, 'none', 'collapsed by default');
    assert.strictEqual(r.closed.expanded, 'false');
    assert.match(r.closed.cta, /Match ideas/);
    assert.match(r.closed.cta, /Balanced games suggested for you/);
    assert.match(r.closed.cta, /Show suggestions/);
    assert.strictEqual(r.closed.matchupVisible, false);

    assert.strictEqual(r.openState.bodyDisplay, 'block', 'expands on tap');
    assert.strictEqual(r.openState.expanded, 'true');
    assert.strictEqual(r.openState.hasMatchup, true, 'the existing matchup card is what it reveals');

    assert.strictEqual(r.reclosed, 'none', 'and collapses again');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('Next on Court is gone, replaced by the latest rated result', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      render();
      const name = 'Ant Slice';
      setCurrentViewer(name);
      goToSection('home');
      renderHomeDashboard();

      const dash = document.getElementById('homeDashboard');
      const card = dash.querySelector('.home-lastresult');

      // The match the record says is their latest rated one.
      const rated = Object.values(V3_MATCH_FACTS).filter((f) => f.byPlayer && f.byPlayer[name]);
      const latest = rated.slice().sort((a, b) => (a.date !== b.date
        ? (a.date < b.date ? 1 : -1)
        : String(b.matchId).localeCompare(String(a.matchId))))[0];
      const me = latest.byPlayer[name];
      const m = getDisplayMatches().find((x) => x.id === latest.matchId);

      return {
        text: dash.innerText,
        hasCard: !!card,
        cardText: card ? card.innerText.replace(/\n+/g, ' | ') : null,
        cardMatchId: card ? card.dataset.matchId : null,
        expectedMatchId: latest.matchId,
        expectedDelta: me.ratingDelta,
        expectedDate: latest.date,
        opponents: m.winners.includes(name) ? m.losers : m.winners,
        partner: (m.winners.includes(name) ? m.winners : m.losers).filter((n) => n !== name),
        monthlyStillThere: /VIEW FULL REVIEW/i.test(dash.innerText),
      };
    });

    assert.doesNotMatch(r.text, /Next on Court/i, 'Next on Court must be gone from Home');
    assert.doesNotMatch(r.text, /Nothing booked yet/i);
    assert.strictEqual(r.hasCard, true, 'a Last Time Out card must be there instead');
    assert.match(r.text, /Last Time Out/i);

    // Sourced from the persisted facts, and pointing at that match.
    assert.strictEqual(r.cardMatchId, r.expectedMatchId);
    const deltaText = (r.expectedDelta > 0 ? '+' : '') + r.expectedDelta;
    assert.ok(r.cardText.includes(deltaText),
      `the card must show the recorded movement ${deltaText}, got: ${r.cardText}`);
    r.opponents.concat(r.partner).forEach((n) => {
      assert.ok(r.cardText.includes(n), `the card must name ${n}`);
    });
    assert.match(r.cardText, /Rating change/);

    // And the monthly snapshot is still there, as asked.
    assert.strictEqual(r.monthlyStillThere, true);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the Last Time Out commentary is one of the fixed, factual lines', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      render();
      const seen = [];
      // Several players, so more than one branch of the commentary is exercised.
      ['Ant Slice', 'Rishi', 'Eli', 'Osh', 'Len', 'Max', 'Jords'].forEach((name) => {
        setCurrentViewer(name);
        goToSection('home');
        renderHomeDashboard();
        const note = document.querySelector('#homeDashboard .lr-note');
        if (note) seen.push({ name, line: note.textContent.trim() });
      });
      return { seen, known: Object.values(LastResult.LINES) };
    });

    assert.ok(r.seen.length >= 5, `not enough players produced a card (${r.seen.length})`);
    r.seen.forEach((s) => {
      assert.ok(r.known.includes(s.line),
        `${s.name}'s line is not one of the fixed set: "${s.line}"`);
    });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// A line drawn from the fixed set is not enough: the card has to be feeding the
// module the right facts. It previously read game counts off fields that only
// exist on ENRICHED matches, while getDisplayMatches() hands back stored ones,
// so the game share arrived as null and every defeat -- however lopsided --
// fell through to the same generic line. Nothing in the module's own tests
// could see that, because they call it with the facts it documents.
test('the commentary matches the facts the record holds, not a fallback', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      render();
      const rows = [];
      ['Ant Slice', 'Rishi', 'Eli', 'Osh', 'Len', 'Max', 'Jords', 'Tom'].forEach((name) => {
        setCurrentViewer(name);
        goToSection('home');
        renderHomeDashboard();
        const note = document.querySelector('#homeDashboard .lr-note');
        if (!note) return;

        // Rebuild the facts independently of the card, straight from the record.
        const rated = Object.values(V3_MATCH_FACTS).filter((f) => f.byPlayer && f.byPlayer[name]);
        const latest = rated.slice().sort((a, b) => (a.date !== b.date
          ? (a.date < b.date ? 1 : -1)
          : String(b.matchId).localeCompare(String(a.matchId))))[0];
        const m = getDisplayMatches().find((x) => x.id === latest.matchId);
        const view = MatchFacts.forPlayer(latest, name);
        const onWinningSide = m.winners.includes(name);
        const winnerGames = m.sets.reduce((t, set) => t + set[0], 0);
        const loserGames = m.sets.reduce((t, set) => t + set[1], 0);
        const total = winnerGames + loserGames;
        const key = LastResult.commentaryKeyFor({
          result: m.isDraw ? 'draw' : (onWinningSide ? 'win' : 'loss'),
          gameShare: total ? (onWinningSide ? winnerGames : loserGames) / total : null,
          expected: view.mine.expected,
          actual: view.mine.actual,
          ratingGap: view.mine.preRating - view.theirs.preRating,
        });
        rows.push({
          name,
          shown: note.textContent.trim(),
          want: LastResult.LINES[key],
          key,
          gameShare: total ? Math.round(((onWinningSide ? winnerGames : loserGames) / total) * 100) / 100 : null,
        });
      });
      return { rows, heavyShare: LastResult.HEAVY_SHARE };
    });

    assert.ok(r.rows.length >= 5, `not enough players produced a card (${r.rows.length})`);
    r.rows.forEach((row) => {
      assert.strictEqual(row.shown, row.want,
        `${row.name}: the record says ${row.key} (game share ${row.gameShare}) but the card said "${row.shown}"`);
      assert.ok(row.gameShare !== null,
        `${row.name}: the game share reached the module as null, so the bands were never applied`);
    });
    // And the facts must actually be varying the line. If every player landed on
    // the same key, this test would pass just as happily against the fallback
    // behaviour it exists to catch.
    const keys = [...new Set(r.rows.map((row) => row.key))];
    assert.ok(keys.length >= 2,
      `every player got the same line (${keys.join(', ')}), so the branches are untested`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// A draw is rated but is deliberately absent from MATCHES, which is what the
// profile's match log is built from -- so the profile cannot show one, and the
// most recent result genuinely can be a draw. Both paths are checked.
test('View match opens the right match, whether or not it was a draw', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      render();
      const check = async (name) => {
        setCurrentViewer(name);
        goToSection('home');
        renderHomeDashboard();
        const btn = document.querySelector('#homeDashboard .lr-view');
        if (!btn) return null;
        const wantedId = btn.dataset.matchId;
        const m = getDisplayMatches().find((x) => x.id === wantedId);
        btn.click();
        await new Promise((res) => setTimeout(res, 30));

        const detail = [...document.querySelectorAll('.pp-match-detail')].find((el) => el.dataset.matchId === wantedId);
        const onProfile = !!detail && detail.style.display === 'block';
        const gamesCard = document.querySelector(`#gamesView [data-gameid="${wantedId}"]`);
        const inGames = activeTab === 'games' && !!gamesCard && expandedGameId === wantedId;
        const who = document.getElementById('sheetName').textContent.trim();
        const sheetOpen = document.getElementById('overlay').classList.contains('show');
        closeSheet();
        return { name, wantedId, isDraw: !!m.isDraw, onProfile, inGames, who, sheetOpen };
      };

      const out = [];
      // Find one player whose latest is a draw and one whose latest is not.
      for (const n of ['Ant Slice', 'Rishi', 'Eli', 'Osh', 'Len', 'Max', 'Jords', 'Kaz', 'Erf']) {
        const res = await check(n);
        if (res) out.push(res);
      }
      return out;
    });

    assert.ok(r.length >= 5, `not enough players produced a card (${r.length})`);
    r.forEach((c) => {
      assert.ok(c.onProfile || c.inGames,
        `${c.name}: View match reached neither the profile nor the Games card for ${c.wantedId}`);
      // Every match opens on the player's own profile now, drawn or not: the
      // profile's match log used to be built from the RATED set, so a draw
      // had no card to open and fell back to the Games feed. It has one.
      assert.strictEqual(c.onProfile, true,
        `${c.name}: ${c.isDraw ? 'a draw' : 'a decided match'} must open on their own profile`);
      assert.strictEqual(c.who, c.name, 'their own profile, so the card is written from their side');
    });
    assert.ok(r.some((c) => !c.isDraw), 'at least one decided match must be covered');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Removing Next on Court from Home must not have touched the feature itself.
test('Upcoming is untouched in Play', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const btn = document.querySelector('#tabrow .tab-btn[data-tab="upcoming"]');
      if (!btn) return { present: false };
      btn.click();
      const view = document.getElementById('upcomingView');
      return {
        present: true,
        tab: activeTab,
        visible: view.style.display !== 'none',
        rendered: view.innerHTML.length > 0,
        inPlaySubnav: SECTION_SUBNAV.play.some((i) => i.tab === 'upcoming'),
      };
    });
    assert.strictEqual(r.present, true, 'the Upcoming tab must still exist');
    assert.strictEqual(r.tab, 'upcoming');
    assert.strictEqual(r.visible, true);
    assert.strictEqual(r.rendered, true);
    assert.strictEqual(r.inPlaySubnav, true, 'and still be reachable from Play');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== LEAGUE SCREEN — NEXT #3 =====================
// Two disclosures and a third table. The screen's job is to show a league
// table; the explanation and four stacked tier tables were both sitting above
// one on a phone. Last 10 is a form table over each player's OWN latest ten
// rated games, which is deliberately not the selected month.
//
// Presentation and aggregation only: no rating, expectation, Reliability,
// tier-history or stored match fact is read or written by any of it.

// Put the League screen in a known state. goToSection settles the shared
// Rankings chrome a tick later, so callers wait before measuring geometry.
const openLeague = (app, opts = {}) => app.run((o) => {
  const b = document.querySelector('#tabrow .tab-btn[data-tab="summary"]');
  if (b) b.click();
  summaryMode = 'league';
  summaryMonth = o.month || '2026-08';
  leagueLastTen = o.view === 'last10';
  leagueGrouped = o.view !== 'all';
  leagueExplainerOpen = !!o.explainerOpen;
  resetLeagueTierSections();
  leagueSortKey = 'points'; leagueSortDesc = true;
  renderSummary();
}, opts);

test('the League screen opens on the table, not on an explanation', { skip }, async () => {
  const app = await H.open();
  try {
    await app.page.setViewportSize({ width: 375, height: 812 });
    await openLeague(app);
    await app.page.waitForTimeout(50);
    const r = await app.run(() => {
      const c = document.getElementById('summaryContent');
      return {
        explainerFolded: !document.getElementById('leagueExplainerToggleBody'),
        foldLabel: document.getElementById('leagueExplainerToggle').innerText.replace(/\s+/g, ' ').trim(),
        // Both controls are preserved — this was layout, not removal.
        hasMonth: !!document.getElementById('summaryMonthSelect'),
        hasView: !!document.getElementById('summaryModeSelect'),
        months: document.getElementById('summaryMonthSelect').options.length,
        // …and they now sit on one row rather than two.
        controlsOnOneRow: new Set([...document.querySelectorAll('.lg-controls .fg-row')]
          .map((e) => Math.round(e.getBoundingClientRect().top))).size === 1,
        tableTop: Math.round(c.querySelector('table').getBoundingClientRect().top),
        viewport: window.innerHeight,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    assert.strictEqual(r.explainerFolded, true, 'the explanation starts folded');
    assert.match(r.foldLabel, /How this table works/);
    assert.strictEqual(r.hasMonth, true, 'Month is kept');
    assert.strictEqual(r.hasView, true, 'View is kept');
    assert.ok(r.months > 3, 'with all its months');
    assert.strictEqual(r.controlsOnOneRow, true, 'Month and View share a row');
    assert.ok(r.tableTop < r.viewport * 0.6,
      `a league table should be on the first screen, was ${r.tableTop} of ${r.viewport}`);
    assert.strictEqual(r.overflow, false, 'nothing may run off the side at 375px');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the explanation opens and closes, and says what this table is', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const c = () => document.getElementById('summaryContent');
      const out = {};
      document.getElementById('leagueExplainerToggle').click();
      out.openText = document.getElementById('leagueExplainerToggleBody').innerText.replace(/\s+/g, ' ');
      out.openedAria = document.getElementById('leagueExplainerToggle').getAttribute('aria-expanded');
      document.getElementById('leagueExplainerToggle').click();
      // Named, because the tier-tables fold is open on this view too.
      out.closed = !document.getElementById('leagueExplainerToggleBody');
      out.tierSectionsUntouched = !!document.getElementById('leagueTierBodyA');
      // Opening the explanation must not disturb the table underneath it.
      out.rowsAfter = c().querySelectorAll('tbody tr').length;
      return out;
    }, {}, await openLeague(app));
    assert.match(r.openText, /3 points for a win, 1 for a draw/);
    assert.strictEqual(r.openedAria, 'true');
    assert.strictEqual(r.closed, true, 'and folds away again');
    assert.strictEqual(r.tierSectionsUntouched, true, 'without disturbing the tier sections');
    assert.ok(r.rowsAfter > 0, 'the table survives the disclosure');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun's 21 Sep correction. Each tier is its own competition, so each one
// collapses on its own: there is no reason hiding Tier C should hide Tier A.
// The single global `Tier tables` fold this replaces was both heavier than the
// headings it hid and wrong about what the four tables are.
test('each tier collapses on its own and leaves the others alone', { skip }, async () => {
  const app = await H.open();
  try {
    await openLeague(app, { month: '2026-09' });
    const r = await app.run(() => {
      const c = () => document.getElementById('summaryContent');
      // Which tiers currently have a table on screen.
      const shown = () => [...c().querySelectorAll('.lg-tier-head')]
        .filter((h) => document.getElementById(`leagueTierBody${h.dataset.tier}`))
        .map((h) => h.dataset.tier);
      const rowsOf = (tier) => [...(document.getElementById(`leagueTierBody${tier}`) || { querySelectorAll: () => [] })
        .querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.innerText.trim()).join('|'));

      const tiers = [...c().querySelectorAll('.lg-tier-head')].map((h) => h.dataset.tier);
      const openTiers = shown();
      const out = { tiers, openTiers, openOnEntry: openTiers,
        noGlobalFold: !document.getElementById('leagueTiersToggle') };
      // Work on sections that start open: a single-player tier arrives
      // collapsed, so tapping it would open rather than close it.
      const target = openTiers[0], other = openTiers[1];
      out.otherBefore = rowsOf(other);

      c().querySelector(`.lg-tier-head[data-tier="${target}"]`).click();
      out.afterCollapse = shown();
      out.collapsedAria = c().querySelector(`.lg-tier-head[data-tier="${target}"]`).getAttribute('aria-expanded');
      out.otherAfter = rowsOf(other);
      // The heading itself must survive collapsing — otherwise there is
      // nothing left to tap to get the table back.
      out.headingStillThere = !!c().querySelector(`.lg-tier-head[data-tier="${target}"]`);

      c().querySelector(`.lg-tier-head[data-tier="${target}"]`).click();
      out.afterReopen = shown();
      out.targetRows = rowsOf(target);
      out.stillByTier = document.getElementById('leagueGroupedBtn').classList.contains('active');
      return out;
    });

    assert.ok(r.tiers.length > 1, `the fixture needs more than one tier, got ${JSON.stringify(r.tiers)}`);
    assert.strictEqual(r.noGlobalFold, true, 'the global Tier tables fold is gone');
    assert.ok(r.openTiers.length > 1, 'the fixture needs at least two populated tier sections');
    assert.deepStrictEqual(r.afterCollapse, r.openTiers.slice(1), 'only the tapped tier collapses');
    assert.strictEqual(r.collapsedAria, 'false');
    assert.strictEqual(r.headingStillThere, true, 'the heading stays, so it can be reopened');
    assert.deepStrictEqual(r.otherAfter, r.otherBefore, 'a neighbouring tier is untouched, rows and all');
    assert.deepStrictEqual(r.afterReopen, r.openTiers, 'and it comes back');
    assert.ok(r.targetRows.length > 0, 'with its rows');
    assert.strictEqual(r.stillByTier, true, 'By tier is still the selected mode');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('several tiers can be collapsed at once, each independently', { skip }, async () => {
  const app = await H.open();
  try {
    await openLeague(app, { month: '2026-09' });
    const r = await app.run(() => {
      const c = () => document.getElementById('summaryContent');
      const state = () => Object.fromEntries([...c().querySelectorAll('.lg-tier-head')]
        .map((h) => [h.dataset.tier, h.getAttribute('aria-expanded') === 'true']));
      const tap = (t) => c().querySelector(`.lg-tier-head[data-tier="${t}"]`).click();
      const all = state();
      // Only the sections that start open — a one-player tier arrives folded.
      const tiers = Object.keys(all).filter((t) => all[t]);
      const out = { tiers, start: Object.fromEntries(tiers.map((t) => [t, all[t]])),
        collapsedOnEntry: Object.keys(all).filter((t) => !all[t]) };
      tap(tiers[0]); tap(tiers[1]);
      out.twoCollapsed = state();
      out.tablesLeft = c().querySelectorAll('table').length;
      tap(tiers[0]);
      out.oneReopened = state();
      return out;
    });
    assert.ok(r.tiers.length >= 2);
    assert.ok(Object.values(r.start).every(Boolean), 'all expanded to begin with');
    assert.strictEqual(r.twoCollapsed[r.tiers[0]], false);
    assert.strictEqual(r.twoCollapsed[r.tiers[1]], false);
    r.tiers.slice(2).forEach((t) => assert.strictEqual(r.twoCollapsed[t], true, `${t} must be untouched`));
    assert.strictEqual(r.tablesLeft, r.tiers.length - 2, 'two fewer tables on screen');
    assert.ok(r.collapsedOnEntry.length >= 0);
    assert.strictEqual(r.oneReopened[r.tiers[0]], true, 'reopening one');
    assert.strictEqual(r.oneReopened[r.tiers[1]], false, 'leaves the other collapsed');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('returning to By tier restores the expanded default', { skip }, async () => {
  const app = await H.open();
  try {
    await openLeague(app, { month: '2026-09' });
    const r = await app.run(() => {
      const c = () => document.getElementById('summaryContent');
      const state = () => Object.fromEntries([...c().querySelectorAll('.lg-tier-head')]
        .map((h) => [h.dataset.tier, h.getAttribute('aria-expanded') === 'true']));
      const entry = state();
      const tiers = Object.keys(entry).filter((t) => entry[t]);
      c().querySelector(`.lg-tier-head[data-tier="${tiers[0]}"]`).click();
      const out = { entry, collapsed: state() };
      // Away and back, both routes.
      document.getElementById('leagueAllBtn').click();
      document.getElementById('leagueGroupedBtn').click();
      out.viaAllTogether = state();
      c().querySelector(`.lg-tier-head[data-tier="${tiers[0]}"]`).click();
      document.getElementById('leagueLastTenBtn').click();
      document.getElementById('leagueGroupedBtn').click();
      out.viaLastTen = state();
      // And leaving the League screen entirely.
      c().querySelector(`.lg-tier-head[data-tier="${tiers[0]}"]`).click();
      document.querySelector('#tabrow .tab-btn[data-tab="power"]').click();
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      out.viaAnotherTab = state();
      return out;
    });
    // Returning restores the DEFAULT, which is per-section: populated tiers
    // open, a single-player tier folded.
    const restored = (st) => assert.deepStrictEqual(st, r.entry,
      `returning must restore the entry state, got ${JSON.stringify(st)}`);
    assert.ok(Object.values(r.collapsed).filter((v) => !v).length
      > Object.values(r.entry).filter((v) => !v).length, 'one more collapsed to set up');
    restored(r.viaAllTogether);
    restored(r.viaLastTen);
    restored(r.viaAnotherTab);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the disclosures carry no card, border or fill', { skip }, async () => {
  const app = await H.open();
  try {
    await openLeague(app, { month: '2026-09' });
    const r = await app.run(() => {
      const weight = (el) => {
        const s = getComputedStyle(el);
        return {
          border: s.borderTopWidth + ' ' + s.borderLeftWidth,
          radius: s.borderTopLeftRadius,
          // A transparent background is what "no card" means here.
          filled: !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor),
        };
      };
      const info = document.getElementById('leagueExplainerToggle');
      const head = document.querySelector('#summaryContent .lg-tier-head');
      return {
        info: weight(info), head: weight(head),
        // The tier heading stays a heading, not a button that looks like one.
        headIsHeading: head.classList.contains('section-heading'),
        headTag: head.tagName,
        infoText: info.innerText.replace(/\s+/g, ' ').trim(),
        sameHeadingFont: getComputedStyle(head).fontSize
          === getComputedStyle(document.querySelector('#summaryContent .section-heading')).fontSize,
      };
    });
    [['info', r.info], ['head', r.head]].forEach(([which, w]) => {
      assert.match(w.border, /^0px 0px$/, `${which} must have no border, got ${w.border}`);
      assert.strictEqual(w.filled, false, `${which} must have no fill`);
      assert.match(w.radius, /^0px$/, `${which} must not be a rounded card, got ${w.radius}`);
    });
    assert.strictEqual(r.headIsHeading, true, 'a tier heading is still a section heading');
    assert.strictEqual(r.headTag, 'BUTTON', 'and is tappable');
    assert.strictEqual(r.sameHeadingFont, true, 'at the same weight as any other heading');
    assert.match(r.infoText, /^How this table works/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('Last 10 is each player\'s own ten games, not the selected month', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      // Ground truth, walked straight from the approved record.
      const truth = (name) => {
        const ms = getAllApprovedMatches()
          .filter((m) => m.winners.includes(name) || m.losers.includes(name))
          .map((m, i) => ({ m, i }))
          .sort((a, b) => (a.m.date < b.m.date ? 1 : a.m.date > b.m.date ? -1 : b.i - a.i))
          .slice(0, 10).map((x) => x.m);
        let w = 0, l = 0, d = 0, gf = 0, ga = 0;
        ms.forEach((m) => {
          const t1 = m.sets.reduce((s, [x]) => s + x, 0);
          const t2 = m.sets.reduce((s, [, y]) => s + y, 0);
          const onT1 = m.winners.includes(name);
          gf += onT1 ? t1 : t2; ga += onT1 ? t2 : t1;
          if (m.isDraw) d++; else if (onT1) w++; else l++;
        });
        return { games: ms.length, w, l, d, gd: gf - ga, pts: w * 3 + d };
      };

      const read = () => [...document.querySelectorAll('#summaryContent tbody tr')].map((tr) => {
        const td = [...tr.children].map((x) => x.innerText.trim());
        return { name: td[1], P: parseInt(td[2], 10), W: +td[3], D: +td[4], L: +td[5], GD: parseInt(td[6], 10), Pts: +td[7] };   // P W D L
      });

      document.getElementById('leagueLastTenBtn').click();
      const inAugust = read();
      // The month selector must make no difference to this table at all.
      summaryMonth = '2026-06'; renderSummary();
      document.getElementById('leagueLastTenBtn').click();
      const inJune = read();

      return {
        heading: document.querySelector('#summaryContent .section-heading').textContent,
        columns: [...document.querySelectorAll('#summaryContent thead th')].map((e) => e.textContent.replace(/[▾▴]/g, '').trim()),
        inAugust, inJune,
        checks: inAugust.slice(0, 6).map((row) => ({ name: row.name, row, truth: truth(row.name) })),
        maxP: Math.max(...inAugust.map((r) => r.P)),
      };
    }, {}, await openLeague(app, { month: '2026-08' }));

    assert.deepStrictEqual(r.columns, ['#', 'Player', 'P', 'W', 'D', 'L', 'GD', 'Pts', 'Last 5']);
    assert.match(r.heading, /Last 10/);
    assert.doesNotMatch(r.heading, /August|June/, 'a per-player window is not a month');
    assert.deepStrictEqual(r.inJune, r.inAugust, 'changing the month must not change Last 10');
    assert.ok(r.maxP <= 10, 'the window is ten games, never more');
    r.checks.forEach((c) => {
      assert.deepStrictEqual(
        { games: c.row.P, w: c.row.W, l: c.row.L, d: c.row.D, gd: c.row.GD, pts: c.row.Pts },
        c.truth,
        `${c.name}'s row must match the record`,
      );
      assert.strictEqual(c.row.W + c.row.L + c.row.D, c.row.P, `${c.name}: W+L+D must equal P`);
      assert.strictEqual(c.row.Pts, c.row.W * 3 + c.row.D, `${c.name}: 3 a win, 1 a draw`);
    });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('a player with fewer than ten games shows the real sample, marked', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      document.getElementById('leagueLastTenBtn').click();
      const rows = [...document.querySelectorAll('#summaryContent tbody tr')];
      const read = rows.map((tr) => {
        const td = [...tr.children].map((x) => x.innerText.trim());
        return { name: td[1], pCell: td[2], P: parseInt(td[2], 10), marked: !!tr.querySelector('.l10-short') };
      });
      const counts = {};
      getAllApprovedMatches().forEach((m) => [...m.winners, ...m.losers]
        .forEach((n) => { counts[n] = (counts[n] || 0) + 1; }));
      return { read, counts };
    }, {}, await openLeague(app, { view: 'last10' }));

    const short = r.read.filter((x) => x.P < 10);
    const full = r.read.filter((x) => x.P === 10);
    assert.ok(short.length > 0 && full.length > 0, 'the fixture needs both kinds of row');

    short.forEach((x) => {
      assert.strictEqual(x.marked, true, `${x.name} has ${x.P} games and must be marked short`);
      assert.match(x.pCell, /of 10/, 'and say what the window would have been');
      // Never padded: the P shown is the player's real number of games.
      assert.strictEqual(x.P, r.counts[x.name], `${x.name}: P must be their actual game count`);
    });
    full.forEach((x) => {
      assert.strictEqual(x.marked, false, `${x.name} has a full window and must not be marked`);
      assert.ok(r.counts[x.name] >= 10);
    });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the monthly table keeps Form (10g); Last 10 does not repeat it', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const cols = () => [...document.querySelectorAll('#summaryContent thead th')]
        .map((e) => e.textContent.replace(/[▾▴]/g, '').trim());
      const byTier = cols();
      document.getElementById('leagueAllBtn').click();
      const allTogether = cols();
      document.getElementById('leagueLastTenBtn').click();
      const lastTen = cols();
      // Returning to the monthly table must not leave it sorted by a column
      // it does not have.
      document.getElementById('leagueGroupedBtn').click();
      // One table per tier, each sorted within itself — the tiers are separate
      // competitions, so rows from two of them are not one ranking.
      const perTable = [...document.querySelectorAll('#summaryContent table')]
        .map((t) => [...t.querySelectorAll('tbody tr')].map((tr) => Number(tr.children[7].innerText.trim())));
      return { byTier, allTogether, lastTen, perTable, sortKey: leagueSortKey };
    }, {}, await openLeague(app));

    assert.ok(r.byTier.includes('Form (10g)'), 'the monthly table keeps its compact Form column');
    assert.ok(r.allTogether.includes('Form (10g)'));
    assert.ok(r.allTogether.includes('Tier'), 'All together still names the tier spell');
    assert.ok(!r.lastTen.includes('Form (10g)'), 'Last 10 would be telling the same fact twice');
    assert.ok(!r.lastTen.includes('Avg Opp'));
    assert.ok(!r.lastTen.includes('Tier'), 'a form table is club-wide by nature');
    assert.strictEqual(r.sortKey, 'points', 'leaving Last 10 restores a sort the monthly table has');
    assert.ok(r.perTable.length > 1, 'By tier renders a table per tier');
    r.perTable.forEach((pts, i) => assert.deepStrictEqual(pts, pts.slice().sort((a, b) => b - a),
      `tier table ${i} must come back sorted by points`));
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('Last 10 sorts on every column it offers', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      document.getElementById('leagueLastTenBtn').click();
      const col = (i) => [...document.querySelectorAll('#summaryContent tbody tr')]
        .map((tr) => parseInt(tr.children[i].innerText.trim(), 10));
      const click = (key) => document.querySelector(`#summaryContent .league-sort-th[data-key="${key}"]`).click();
      const out = {};
      click('gd'); out.gdDesc = col(6);
      click('gd'); out.gdAsc = col(6);
      click('games'); out.games = col(2);
      document.querySelector('#summaryContent .league-sort-th[data-key="name"]').click();
      out.names = [...document.querySelectorAll('#summaryContent tbody tr')].map((tr) => tr.children[1].innerText.trim());
      return out;
    }, {}, await openLeague(app, { view: 'last10' }));

    assert.deepStrictEqual(r.gdDesc, r.gdDesc.slice().sort((a, b) => b - a), 'GD descending');
    assert.deepStrictEqual(r.gdAsc, r.gdAsc.slice().sort((a, b) => a - b), 'and a second tap reverses it');
    assert.deepStrictEqual(r.games, r.games.slice().sort((a, b) => b - a), 'P sorts too');
    assert.deepStrictEqual(r.names, r.names.slice().sort((a, b) => b.localeCompare(a)), 'and so does Player');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the League view shows one explanation, not two', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const legacy = () => {
        const w = document.getElementById('explainerWrapper');
        return w ? getComputedStyle(w).display !== 'none' : false;
      };
      const out = { onLeague: legacy() };
      // Collapsing the tier tables is what exposed the duplicate.
      const firstTier = document.querySelector('#summaryContent .lg-tier-head');
      if (firstTier) firstTier.click();
      out.onLeagueCollapsed = legacy();
      out.leagueControls = [...document.querySelectorAll('#summaryContent .lg-inline-fold')]
        .map((b) => b.innerText.replace(/\s+/g, ' ').trim());
      // Information still explains Doughnuts and Player of the Month, so it
      // keeps the legacy block.
      summaryMode = 'information'; renderSummary();
      out.onInformation = legacy();
      out.informationText = document.getElementById('explainer').innerText;
      // And every other tab gets it back.
      document.querySelector('#tabrow .tab-btn[data-tab="power"]').click();
      out.onPower = legacy();
      return out;
    }, {}, await openLeague(app));

    assert.strictEqual(r.onLeague, false, 'the League view has its own explanation');
    assert.strictEqual(r.onLeagueCollapsed, false, 'collapsing the tables must not reveal a second one');
    assert.ok(r.leagueControls.some((t) => /How this table works/.test(t)));
    assert.strictEqual(r.leagueControls.filter((t) => /how this/i.test(t)).length, 1,
      `exactly one explanation control, got ${JSON.stringify(r.leagueControls)}`);
    assert.ok(!r.leagueControls.some((t) => /Tier tables/.test(t)),
      'the global Tier tables fold is gone');
    assert.strictEqual(r.onInformation, true, 'Information keeps the block it needs');
    assert.match(r.informationText, /Doughnuts/);
    assert.strictEqual(r.onPower, true, 'and Power Rankings is unaffected');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== PREDICT A MATCHUP =====================
// Shaun's 21 Sep direction. The tool is one of the most-used Admin features
// and must STAY Admin-only: players agree a match in the group first, then
// send him the four names. Exposing it to everyone would let people dodge an
// agreed game or shop for an easy one.
//
// Copy and hierarchy only. The prediction itself still comes from
// RatingEngine.expectedScore and nothing here changes it.

// Opened the way an admin opens it: the top of More (Shaun, 4 Oct).
const openPredict = (app) => app.run(() => {
  isUnlocked = true; currentUserName = 'Board'; adminRole = 'owner';
  openMoreSheet();
  document.querySelector('#shellMoreSheet .shell-more-item[data-special="predict"]').click();
});

const predictWith = (app, names) => app.run((n) => {
  document.getElementById('predA1').value = n[0];
  document.getElementById('predA2').value = n[1] || '';
  document.getElementById('predB1').value = n[2];
  document.getElementById('predB2').value = n[3] || '';
  document.getElementById('predA1').dispatchEvent(new Event('input'));
  const box = document.getElementById('predResult');
  return { text: box.innerText.replace(/\s+/g, ' ').trim(), html: box.innerHTML };
}, names);

test('Predict a Matchup is Admin-only and unreachable when locked', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = false; currentUserName = '';
      const b = document.querySelector('#tabrow .tab-btn[data-tab="manage"]');
      if (b) b.click();
      renderManage();
      const locked = {
        form: !!document.getElementById('predA1'),
        result: !!document.getElementById('predResult'),
        body: document.getElementById('manageView').innerText,
      };
      // And it is not offered anywhere a normal player goes.
      const playerSurfaces = ['home', 'rankings', 'play', 'players'].map((sec) => {
        goToSection(sec);
        return document.body.innerText;
      }).join(' ');
      return { locked, leaksToPlayers: /Predict a matchup/i.test(playerSurfaces) };
    });
    assert.strictEqual(r.locked.form, false, 'no prediction form behind the lock screen');
    assert.strictEqual(r.locked.result, false);
    assert.doesNotMatch(r.locked.body, /Predict a matchup/i, 'not even its heading');
    assert.strictEqual(r.leaksToPlayers, false, 'and it appears on no player-facing section');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the prediction names a winner, in games not chances', { skip }, async () => {
  const app = await H.open();
  try {
    await openPredict(app);
    const r = await app.run(() => {
      // Pick a genuinely lopsided matchup from the fixture so there is a
      // winner to name.
      const sorted = [...PLAYERS].sort((a, b) => b.rating - a.rating);
      const strong = sorted.slice(0, 2).map((p) => p.name);
      const weak = sorted.slice(-2).map((p) => p.name);
      const set = (id, v) => { document.getElementById(id).value = v; };
      set('predA1', strong[0]); set('predA2', strong[1]);
      set('predB1', weak[0]); set('predB2', weak[1]);
      document.getElementById('predA1').dispatchEvent(new Event('input'));
      const box = document.getElementById('predResult');
      const ratingOf = (n) => Math.round(PLAYERS.find((p) => p.name === n).rating);
      // The card averages the real ratings and rounds once at the end;
      // averaging rounded ratings gives a different answer by a point.
      const raw = (n) => PLAYERS.find((p) => p.name === n).rating;
      const gap = Math.abs(
        (raw(strong[0]) + raw(strong[1])) / 2 - (raw(weak[0]) + raw(weak[1])) / 2,
      );
      return {
        text: box.innerText.replace(/\s+/g, ' ').trim(),
        strong, weak, gap: Math.round(gap),
        ratings: [...strong, ...weak].map(ratingOf),
      };
    });

    // 1. the predicted winner, by name
    assert.match(r.text, new RegExp(`PROJECTED FAVOURITES ${r.strong[0]} & ${r.strong[1]}`, 'i'),
      `must name the winning team: ${r.text}`);
    // 2. expected share of games, both sides
    const shares = [...r.text.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
    assert.strictEqual(shares.length, 2, `two percentages, got ${JSON.stringify(shares)}`);
    assert.strictEqual(shares[0] + shares[1], 100, 'the two sides account for all the games');
    assert.ok(shares[0] > 50, 'the favoured side is expected to take more of them');
    assert.match(r.text, /Expected share of games \d+% .* – \d+% /i);
    // 3. teams and their ratings
    r.ratings.forEach((v) => assert.ok(r.text.includes(String(v)), `rating ${v} must be shown`));
    // 4. the rating-point advantage
    assert.match(r.text, new RegExp(`favoured by ${r.gap} rating point`, 'i'),
      `must show the rating edge of ${r.gap}: ${r.text}`);
    // …and the footer, small and factual.
    assert.match(r.text, /Based on current Power Ratings · a prediction, not a result/);

    // What must NOT be there: engine terminology, and any claim of a chance.
    assert.doesNotMatch(r.text, /Expected performance score/i);
    assert.doesNotMatch(r.text, /0\.80|0\.20|80%.*game share|performance score/i);
    assert.doesNotMatch(r.text, /chance|probability|likelihood|odds/i,
      'a share of games is not a validated win probability');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('a near-even matchup is not sold as a confident call', { skip }, async () => {
  const app = await H.open();
  try {
    await openPredict(app);
    const r = await app.run(() => {
      // Two pairs deliberately built to sit within a point or two.
      const sorted = [...PLAYERS].sort((a, b) => b.rating - a.rating);
      let best = null;
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          for (let k = 0; k < sorted.length; k++) {
            for (let l = k + 1; l < sorted.length; l++) {
              const names = [sorted[i].name, sorted[j].name, sorted[k].name, sorted[l].name];
              if (new Set(names).size !== 4) continue;
              const g = Math.abs((sorted[i].rating + sorted[j].rating) / 2
                - (sorted[k].rating + sorted[l].rating) / 2);
              if (best === null || g < best.g) best = { g, names };
            }
          }
        }
      }
      const set = (id, v) => { document.getElementById(id).value = v; };
      set('predA1', best.names[0]); set('predA2', best.names[1]);
      set('predB1', best.names[2]); set('predB2', best.names[3]);
      document.getElementById('predA1').dispatchEvent(new Event('input'));
      return { gap: best.g, text: document.getElementById('predResult').innerText.replace(/\s+/g, ' ').trim() };
    });
    assert.ok(r.gap < 15, `the fixture should offer a close pairing, got ${r.gap}`);
    assert.doesNotMatch(r.text, /Projected favourites/i, 'a two-point gap is not a prediction of a win');
    assert.match(r.text, /Slight edge|Too close to call/i, `expected a hedged verdict: ${r.text}`);
    assert.match(r.text, /Based on current Power Ratings/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the prediction still comes from the engine, not from new arithmetic', { skip }, async () => {
  const app = await H.open();
  try {
    await openPredict(app);
    const r = await app.run(() => {
      const sorted = [...PLAYERS].sort((a, b) => b.rating - a.rating);
      const names = [sorted[0].name, sorted[1].name, sorted[20].name, sorted[21].name];
      const set = (id, v) => { document.getElementById(id).value = v; };
      set('predA1', names[0]); set('predA2', names[1]);
      set('predB1', names[2]); set('predB2', names[3]);
      document.getElementById('predA1').dispatchEvent(new Event('input'));
      const rat = (n) => PLAYERS.find((p) => p.name === n).rating;
      const engine = RatingEngine.expectedScore(
        (rat(names[0]) + rat(names[1])) / 2,
        (rat(names[2]) + rat(names[3])) / 2,
      );
      const shown = [...document.getElementById('predResult').innerText.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
      return { engine: Math.round(engine * 100), shown };
    });
    assert.strictEqual(r.shown[0], r.engine,
      'the percentage shown is the engine\'s own expectation, rounded');
    assert.strictEqual(r.shown[1], 100 - r.engine);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('an awkward player name survives the prediction card', { skip }, async () => {
  const app = await H.open();
  try {
    await openPredict(app);
    const r = await app.run(() => {
      PLAYERS.push({ name: 'a<b>c', tier: 'B', rating: 1400, active: true, total: 0, wins: 0, losses: 0, draws: 0 });
      const others = PLAYERS.filter((p) => p.name !== 'a<b>c').slice(0, 3).map((p) => p.name);
      const set = (id, v) => { document.getElementById(id).value = v; };
      set('predA1', 'a<b>c'); set('predA2', others[0]);
      set('predB1', others[1]); set('predB2', others[2]);
      document.getElementById('predA1').dispatchEvent(new Event('input'));
      const box = document.getElementById('predResult');
      const out = { text: box.innerText, boldCount: box.querySelectorAll('b').length };
      PLAYERS.splice(PLAYERS.findIndex((p) => p.name === 'a<b>c'), 1);
      return out;
    });
    assert.ok(r.text.includes('a<b>c'), `the name must read as itself, got: ${r.text}`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== PLAYER RENAME =====================
// Shaun: "I just need editable names with no consequences."
//
// So the identity is frozen and only the label moves. `players/{playerId}`
// keeps its document id for ever, every ratingJourney event keeps its id (which
// has the old name inside it), and every match keeps the names it was recorded
// with. A rename writes ONE field on ONE document.
//
// These tests exist to prove the "no consequences" half, because that is the
// half that would be expensive to be wrong about.

const openTags = (app) => app.run(() => {
  isUnlocked = true; currentUserName = 'Board'; adminRole = 'owner';
  const b = document.querySelector('#tabrow .tab-btn[data-tab="manage"]');
  if (b) b.click();
  adminOpenSections = { players: true };
  renderManage();
});

// Everything about a player that a rename must not disturb.
const FINGERPRINT = `(name) => {
  const p = PLAYERS.find(x => x.name === name);
  const ms = ALL_MATCHES.filter(m => m.winners.includes(name) || m.losers.includes(name));
  const j = (typeof playerJourney === 'function') ? playerJourney(name) : null;
  return {
    found: !!p,
    playerId: p && p.playerId,
    rating: p && Math.round(p.rating * 1000) / 1000,
    tier: p && p.tier,
    reliability: p && p.reliability,
    lifetimeMatches: p && p.lifetimeMatches,
    wins: p && p.wins, losses: p && p.losses, draws: p && p.draws,
    matches: ms.length,
    matchIds: ms.map(m => m.id).sort(),
    journeyPoints: j && j.journey ? j.journey.length : null,
    journeyLast: j && j.journey && j.journey.length ? Math.round(j.journey[j.journey.length - 1].rating * 1000) / 1000 : null,
  };
}`;

test('renaming a player changes the label and nothing else', { skip }, async () => {
  const app = await H.open();
  try {
    await openTags(app);
    const r = await app.run((fpSrc) => {
      const fingerprint = eval(fpSrc);
      // A player with real history, so there is something to lose.
      const subject = [...PLAYERS].sort((a, b) => b.lifetimeMatches - a.lifetimeMatches)[0].name;
      const before = fingerprint(subject);
      const recordBefore = {
        players: JSON.stringify(V3_RECORD.players),
        matches: JSON.stringify(V3_RECORD.matches),
        journey: JSON.stringify(V3_RECORD.journey),
      };
      const newName = subject + ' J';

      // Drive the real control, the way an admin does.
      openPlayerTags[subject] = true; renderPlayerTagsList();
      const input = document.querySelector(`.ptag-rename-input[data-name="${subject}"]`);
      input.value = newName;
      input.dispatchEvent(new Event('input'));
      document.querySelector(`.ptag-rename-ask[data-name="${subject}"]`).click();
      const confirmText = document.querySelector('.ptag-rename-confirm').innerText.replace(/\s+/g, ' ');
      document.querySelector(`.ptag-rename-go[data-name="${subject}"]`).click();

      return { subject, newName, before, recordBefore, confirmText,
        writes: window.__writes.map(w => ({ collection: w.collection, id: w.id, deleted: !!w.deleted })) };
    }, FINGERPRINT);

    // The confirmation says what it is about to do, in both names.
    assert.match(r.confirmText, new RegExp(`Rename ${r.subject} to ${r.newName}\\?`), r.confirmText);

    await app.page.waitForTimeout(400);
    const after = await app.run(([fpSrc, subject, newName]) => {
      const fingerprint = eval(fpSrc);
      return {
        old: fingerprint(subject),
        renamed: fingerprint(newName),
        record: {
          players: JSON.stringify(V3_RECORD.players),
          matches: JSON.stringify(V3_RECORD.matches),
          journey: JSON.stringify(V3_RECORD.journey),
        },
        writes: window.__writes.map(w => ({ collection: w.collection, id: w.id, deleted: !!w.deleted })),
        doc: (window.__data.players || {})[subject],
      };
    }, [FINGERPRINT, r.subject, r.newName]);

    // 1. Exactly one document written, and it is their own — nothing deleted.
    assert.strictEqual(after.writes.length, 1, `one write, got ${JSON.stringify(after.writes)}`);
    assert.deepStrictEqual(after.writes[0], { collection: 'players', id: r.subject, deleted: false },
      'the write goes to their ORIGINAL document id, which never moves');

    // 2. The stored record is byte-identical apart from that one document.
    assert.strictEqual(after.record.matches, r.recordBefore.matches, 'no match may change');
    assert.strictEqual(after.record.journey, r.recordBefore.journey, 'no journey event may change');
    assert.strictEqual(after.doc.displayName, r.newName);
    assert.deepStrictEqual(after.doc.previousDisplayNames, [r.subject], 'the old name is kept');
    assert.strictEqual(after.doc.id, r.subject, 'the document id is untouched');

    // 3. The player is now found under the new name, with an identical history.
    assert.strictEqual(after.old.found, false, 'the old name no longer resolves');
    assert.strictEqual(after.renamed.found, true, 'the new one does');
    const {ceremony, ...beforeRest} = r.before;
    assert.deepStrictEqual(
      { ...after.renamed, playerId: undefined },
      { ...beforeRest, playerId: undefined },
      'every number about this player must survive the rename unchanged',
    );
    assert.strictEqual(after.renamed.playerId, r.subject, 'and they are still keyed by the original name');
    assert.ok(after.renamed.matches > 5, 'the subject needs real history for this to mean anything');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('a renamed player keeps their place on every screen', { skip }, async () => {
  const app = await H.open();
  try {
    await openTags(app);
    const r = await app.run(() => {
      const subject = [...PLAYERS].sort((a, b) => b.lifetimeMatches - a.lifetimeMatches)[0].name;
      const newName = subject + ' J';
      const rank = () => [...PLAYERS].sort((a, b) => b.rating - a.rating).findIndex(p => p.lifetimeMatches
        && (p.name === subject || p.name === newName));
      const before = { rank: rank(), count: PLAYERS.length };

      openPlayerTags[subject] = true; renderPlayerTagsList();
      const input = document.querySelector(`.ptag-rename-input[data-name="${subject}"]`);
      input.value = newName; input.dispatchEvent(new Event('input'));
      document.querySelector(`.ptag-rename-ask[data-name="${subject}"]`).click();
      document.querySelector(`.ptag-rename-go[data-name="${subject}"]`).click();
      return { subject, newName, before };
    });
    await app.page.waitForTimeout(400);

    const after = await app.run(([subject, newName]) => {
      const rank = () => [...PLAYERS].sort((a, b) => b.rating - a.rating).findIndex(p => p.lifetimeMatches
        && (p.name === subject || p.name === newName));
      // The Directory, a profile, and a match card.
      goToSection('players'); renderPlayersTab();
      const inDirectory = [...document.querySelectorAll('#playersView .pdir-row')].map(e => e.dataset.player);
      openSheet(newName);
      const sheetName = document.getElementById('sheetName').textContent;
      // openSheet builds these directly, so they are what "their history is
      // still on it" actually means here.
      const statsText = document.getElementById('sheetStats').innerText.replace(/\s+/g, ' ');
      const profileText = document.getElementById('sheetProfile').innerText;
      closeSheet();
      // And a match still names them — under the new label.
      const anyMatch = ALL_MATCHES.find(m => m.winners.includes(newName) || m.losers.includes(newName));
      return {
        rank: rank(), count: PLAYERS.length,
        inDirectoryNew: inDirectory.includes(newName),
        inDirectoryOld: inDirectory.includes(subject),
        sheetName, statsText, profileLength: profileText.length,
        recordShown: /\d+-\d+/.test(statsText),
        matchNamesThem: !!anyMatch,
      };
    }, [r.subject, r.newName]);

    assert.strictEqual(after.count, r.before.count, 'no player is gained or lost');
    assert.strictEqual(after.rank, r.before.rank, 'their ranking position is unchanged');
    assert.strictEqual(after.inDirectoryNew, true, 'the Directory lists the new name');
    assert.strictEqual(after.inDirectoryOld, false, 'and not the old one');
    assert.strictEqual(after.sheetName, r.newName, 'their profile opens under the new name');
    assert.strictEqual(after.recordShown, true, `their W-L record is still on the profile: ${after.statsText}`);
    assert.ok(after.profileLength > 200, 'and the profile body is built');
    assert.strictEqual(after.matchNamesThem, true, 'and their matches still name them');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the record still replays to itself after a rename', { skip }, async () => {
  const app = await H.open();
  try {
    await openTags(app);
    const r = await app.run(() => {
      const before = ReplayForward.verifyNoOp(V3_RECORD, {});
      const subject = [...PLAYERS].sort((a, b) => b.lifetimeMatches - a.lifetimeMatches)[0].name;
      openPlayerTags[subject] = true; renderPlayerTagsList();
      const input = document.querySelector(`.ptag-rename-input[data-name="${subject}"]`);
      input.value = subject + ' J'; input.dispatchEvent(new Event('input'));
      document.querySelector(`.ptag-rename-ask[data-name="${subject}"]`).click();
      document.querySelector(`.ptag-rename-go[data-name="${subject}"]`).click();
      return { subject, beforeOk: before.identical, beforeDiffs: before.count };
    });
    await app.page.waitForTimeout(400);
    const after = await app.run(() => {
      const v = ReplayForward.verifyNoOp(V3_RECORD, {});
      return { ok: v.identical, diffs: v.count, sample: (v.differences || []).slice(0, 5) };
    });
    assert.strictEqual(r.beforeOk, true, 'the fixture replays to itself to begin with');
    assert.strictEqual(after.ok, true,
      `a rename must not break the replay precondition, got ${after.diffs}: ${JSON.stringify(after.sample)}`);
    assert.strictEqual(after.diffs, 0);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('a blank or taken name is refused before the confirmation appears', { skip }, async () => {
  const app = await H.open();
  try {
    await openTags(app);
    const r = await app.run(() => {
      const [a, b] = PLAYERS.map(p => p.name);
      const out = {};
      const attempt = (name, value) => {
        openPlayerTags[name] = true; renderPlayerTagsList();
        const input = document.querySelector(`.ptag-rename-input[data-name="${name}"]`);
        input.value = value; input.dispatchEvent(new Event('input'));
        document.querySelector(`.ptag-rename-ask[data-name="${name}"]`).click();
        return {
          confirmShown: !!document.querySelector('.ptag-rename-confirm'),
          message: (document.querySelector('.ptag-rename-note.is-bad') || {}).innerText || null,
          writes: window.__writes.length,
        };
      };
      out.blank = attempt(a, '   ');
      out.taken = attempt(a, b);
      out.sameAsNow = attempt(a, a);
      out.slash = attempt(a, 'a/b');
      out.ok = attempt(a, a + ' J');
      out.names = [a, b];
      return out;
    });

    assert.strictEqual(r.blank.confirmShown, false, 'a blank name never reaches a confirmation');
    assert.match(r.blank.message, /blank/);
    assert.strictEqual(r.taken.confirmShown, false, "another player's name is refused");
    assert.match(r.taken.message, new RegExp(`${r.names[1]} already uses that name`));
    assert.strictEqual(r.sameAsNow.confirmShown, false);
    assert.match(r.sameAsNow.message, /already their name/);
    assert.strictEqual(r.slash.confirmShown, false);
    assert.match(r.slash.message, /slash/);
    assert.strictEqual(r.ok.confirmShown, true, 'a good name does reach the confirmation');
    assert.strictEqual(r.ok.writes, 0, 'and nothing is written until it is confirmed');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('renaming is admin-only', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      isUnlocked = false; currentUserName = '';
      const b = document.querySelector('#tabrow .tab-btn[data-tab="manage"]');
      if (b) b.click();
      renderManage();
      return {
        control: !!document.querySelector('.ptag-rename-input'),
        body: document.getElementById('manageView').innerText,
      };
    });
    assert.strictEqual(r.control, false, 'no rename control behind the lock screen');
    assert.doesNotMatch(r.body, /Rename/i);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ============ MONTHLY RANKINGS COHERENCE + MONTHLY SUMMARY ============
// Shaun, 21 Sep: September's Power Rankings put Rishi in Tier A — his
// post-reassessment tier — beside 1464, his pre-reassessment rating.
//
// The module tests in tests/monthlyCoherence.test.js pin the ordering. These
// pin the thing Shaun actually saw: a rendered row whose tier and rating
// disagree. The fixture has no reassessments of its own, so the scenario is
// injected — a player promoted AND re-anchored mid-month, with the two
// decisions supplied in the unhelpful order Firestore happened to return.

test('a mid-month reassessment never shows the new tier beside the old rating', { skip }, async () => {
  const app = await H.open({ now: FIXTURE_NOW });
  try {
    const r = await app.run(() => {
      const subject = [...PLAYERS].sort((a, b) => b.lifetimeMatches - a.lifetimeMatches)[0].name;
      const sept = V3_JOURNEY.filter((e) => e.playerId === subject
        && e.eventType === 'MATCH_UPDATE' && e.effectiveDate.slice(0, 7) === '2026-09');
      if (!sept.length) return { skip: 'no September matches for the subject' };
      const last = sept[sept.length - 1];
      const oldRating = last.postMatchRating;     // where play left them
      const newRating = oldRating + 180;          // where the board re-anchors them
      const day = last.effectiveDate;

      // Rishi's actual shape: promoted and re-anchored on the day, then a match
      // played FROM the new rating. Supplied deliberately in the unhelpful
      // order — match, then reassessment, then promotion — which is how
      // Firestore returned his and what produced the bug.
      const afterRating = newRating + 1.6;
      const injected = [
        { playerId: subject, eventType: 'MATCH_UPDATE', effectiveDate: day, matchId: day + '-9',
          preMatchRating: newRating, postMatchRating: afterRating },
        { playerId: subject, eventType: 'CLUB_RATING_REASSESSMENT', effectiveDate: day,
          previousTier: 'A', newTier: 'A', previousPowerRating: oldRating, newPowerRating: newRating,
          previousReliability: 0.5, newReliability: 0.2 },
        { playerId: subject, eventType: 'PROMOTION', effectiveDate: day,
          previousTier: 'B', newTier: 'A', previousPowerRating: oldRating, newPowerRating: oldRating },
      ];
      V3_JOURNEY = V3_JOURNEY.concat(injected);
      // TierHistory refuses a history that ends anywhere but the player's
      // current tier — correctly — so the injected promotion has to be
      // reflected in current state too, exactly as a real one would be.
      V3_STATE.players[subject].tier = 'A';
      V3_TIER_HISTORY = TierHistory.create({
        currentTiers: V3Bridge.tierMap(V3_STATE),
        changes: TierHistory.changesFromJourney(V3_JOURNEY),
      });
      V3_TIER_AS_OF = V3_TIER_HISTORY.tierAsOf;
      MONTHLY_VIEWS = MonthlyViews.build(V3_JOURNEY, { tierAsOf: V3_TIER_AS_OF });

      selectedMonth = '2026-09'; activeTab = 'power'; activeTier = 'All';
      minGames = 0; activeSortP = 'rating';
      goToSection('rankings'); render();

      const row = [...document.querySelectorAll('#list .row')]
        .find((el) => (el.querySelector('.nm') || {}).textContent === subject);
      const txt = row ? row.innerText.replace(/\s+/g, ' ') : '';
      const big = row ? (row.querySelector('.rating-big') || {}).textContent : null;
      const badge = row ? (row.querySelector('.tier-badge') || {}).textContent : null;
      return {
        subject, day, oldRating: Math.round(oldRating), newRating: Math.round(afterRating),
        big: big ? Number(big) : null, badge, txt,
        monthEnd: MonthlyViews.monthEndRatings(MONTHLY_VIEWS, '2026-09')[subject],
      };
    });

    if (r.skip) { assert.ok(true, r.skip); return; }
    assert.strictEqual(r.badge, 'A', `the row should show the post-promotion tier, got ${r.badge}`);
    assert.strictEqual(Math.round(r.monthEnd), r.newRating,
      'the month must close on the re-anchored rating');
    // The defect, stated as the assertion that would have caught it.
    assert.notStrictEqual(r.big, r.oldRating,
      `Tier ${r.badge} must not be shown beside the pre-reassessment rating ${r.oldRating}: "${r.txt}"`);
    assert.strictEqual(r.big, r.newRating,
      `the month rating must be the post-reassessment one (${r.newRating}), got ${r.big}`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('Monthly Summary is expanded by default and folds as one', { skip }, async () => {
  const app = await H.open();
  try {
    await app.page.setViewportSize({ width: 375, height: 812 });
    await app.run(() => {
      selectedMonth = '2026-08'; activeTab = 'power'; activeTier = 'All'; minGames = 0;
      monthlySummaryOpen = true;
      goToSection('rankings'); render();
    });
    await app.page.waitForTimeout(50);
    const r = await app.run(() => {
      const head = document.getElementById('monthlySummaryToggle');
      const sections = () => {
        const b = document.getElementById('monthlySummaryBody');
        return b ? b.innerText.replace(/\s+/g, ' ') : null;
      };
      const open = { present: !!head, body: sections(), aria: head.getAttribute('aria-expanded') };
      head.click();
      const collapsed = {
        body: sections(),
        headStillThere: !!document.getElementById('monthlySummaryToggle'),
        aria: document.getElementById('monthlySummaryToggle').getAttribute('aria-expanded'),
        headText: document.getElementById('monthlySummaryToggle').innerText.replace(/\s+/g, ' ').trim(),
      };
      document.getElementById('monthlySummaryToggle').click();
      const reopened = { body: sections() };
      // Collapsed, it must not be a card: no border, no fill, no radius — the
      // treatment Shaun rejected during the League refinement. Checked on the
      // CONTAINER, not just the button: a plain button inside a bordered box
      // still reads as a bordered dropdown, which is how this was first built.
      const weigh = (el) => {
        const cs = getComputedStyle(el);
        return { border: cs.borderTopWidth + ' ' + cs.borderLeftWidth, radius: cs.borderTopLeftRadius,
          filled: !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) };
      };
      document.getElementById('monthlySummaryToggle').click();   // collapse again
      const weight = weigh(document.querySelector('.monthly-stories'));
      const buttonWeight = weigh(document.getElementById('monthlySummaryToggle'));
      document.getElementById('monthlySummaryToggle').click();   // and leave it open
      // …and it is independent of the League disclosures.
      return { open, collapsed, reopened, weight, buttonWeight,
        keepsMsHead: document.getElementById('monthlySummaryToggle').classList.contains('ms-head') };
    });

    assert.strictEqual(r.open.present, true, 'the Monthly Summary heading is a control');
    assert.strictEqual(r.open.aria, 'true', 'and defaults expanded');
    // innerText, so CSS text-transform applies — compare case-insensitively.
    const openBody = r.open.body.toLowerCase();
    ['Key takeaways', 'Monthly Performance', 'Rating Movement', 'Ranking Movement',
      'Moved without playing', 'Crossovers'].forEach((section) => {
      assert.ok(openBody.includes(section.toLowerCase()), `${section} should be in the open summary`);
    });
    assert.strictEqual(r.collapsed.body, null, 'collapsing hides the whole summary together');
    assert.strictEqual(r.collapsed.headStillThere, true, 'the heading stays, so it can be reopened');
    assert.strictEqual(r.collapsed.aria, 'false');
    assert.match(r.collapsed.headText, /monthly summary/i, 'and still says what it is');
    assert.strictEqual(r.reopened.body, r.open.body, 'reopening restores the content unchanged');
    assert.match(r.weight.border, /^0px 0px$/, 'collapsed, the container has no border — this is not a dropdown');
    assert.strictEqual(r.weight.filled, false, 'and no fill');
    assert.match(r.weight.radius, /^0px$/, 'and no rounded card edge');
    assert.match(r.buttonWeight.border, /^0px 0px$/, 'nor does the heading itself');
    assert.strictEqual(r.buttonWeight.filled, false);
    assert.strictEqual(r.keepsMsHead, true, 'it keeps the existing heading type and spacing');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the Monthly Summary fold is independent of the League disclosures', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      selectedMonth = '2026-08'; activeTab = 'power'; activeTier = 'All'; minGames = 0;
      monthlySummaryOpen = true;
      goToSection('rankings'); render();
      document.getElementById('monthlySummaryToggle').click();   // collapse the summary
      const summaryCollapsed = !document.getElementById('monthlySummaryBody');

      // Now go to the League screen: its own disclosures must be untouched.
      const b = document.querySelector('#tabrow .tab-btn[data-tab="summary"]');
      if (b) b.click();
      summaryMode = 'league'; summaryMonth = '2026-09';
      leagueLastTen = false; leagueGrouped = true;
      leagueExplainerOpen = false; resetLeagueTierSections();
      renderSummary();
      const tierState = () => [...document.querySelectorAll('#summaryContent .lg-tier-head')]
        .map((h) => h.dataset.tier + ':' + h.getAttribute('aria-expanded')).join(',');
      const afterSummaryFold = tierState();
      // The same screen rendered fresh, with the summary never touched.
      resetLeagueTierSections(); renderSummary();
      const tiersOpen = tierState() === afterSummaryFold;
      const explainerFolded = !document.getElementById('leagueExplainerToggleBody');

      // …and collapsing a tier does not reopen the summary.
      const firstTier = document.querySelector('#summaryContent .lg-tier-head');
      if (firstTier) firstTier.click();
      activeTab = 'power'; goToSection('rankings'); render();
      const summaryStillCollapsed = !document.getElementById('monthlySummaryBody');
      return { summaryCollapsed, tiersOpen, explainerFolded, summaryStillCollapsed };
    });
    assert.strictEqual(r.summaryCollapsed, true);
    assert.strictEqual(r.tiersOpen, true,
      'folding the Monthly Summary must not change any League tier section');
    assert.strictEqual(r.explainerFolded, true, 'and the League explanation still defaults folded');
    assert.strictEqual(r.summaryStillCollapsed, true, 'the two disclosures do not touch each other');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ===================== MERIT TABLE =====================
// An alternative league view, approved 22 Sep. Not a replacement and not a
// rating: it scores how hard the partnership you beat was, from tier on the
// day and nothing else.

const openMerit = (app, month) => app.run((m) => {
  const b = document.querySelector('#tabrow .tab-btn[data-tab="summary"]');
  if (b) b.click();
  summaryMode = 'merit'; summaryMonth = m || 'all';
  leagueGrouped = false; meritExplainerOpen = false;
  resetMeritTierSections();
  renderSummary();
}, month);

test('Merit lives behind the View select, not a fourth segmented button', { skip }, async () => {
  const app = await H.open();
  try {
    await app.page.setViewportSize({ width: 375, height: 812 });
    await app.run(() => {
      const b = document.querySelector('#tabrow .tab-btn[data-tab="summary"]');
      if (b) b.click();
      summaryMode = 'league'; summaryMonth = 'all';
      renderSummary();
    });
    await app.page.waitForTimeout(50);
    const r = await app.run(() => {
      const sel = document.getElementById('summaryModeSelect');
      const before = [...document.querySelectorAll('#summaryContent .fg-toggle-btn')].map((b) => b.textContent);
      sel.value = 'merit'; sel.dispatchEvent(new Event('change'));
      const after = [...document.querySelectorAll('#summaryContent .fg-toggle-btn')].map((b) => b.textContent);
      return {
        options: [...sel.options].map((o) => o.value),
        labels: [...sel.options].map((o) => o.text),
        leagueButtons: before, meritButtons: after,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        heading: document.querySelector('#summaryContent .section-heading').textContent,
        tagline: document.querySelector('#summaryContent .section-sub').innerText,
      };
    });
    // The Monthly Race (26 Sep trial) joined the same select rather than
    // becoming a button, for the same reason Merit did; since 31 Oct it leads
    // (Shaun: Race, then Merit, then League).
    assert.deepStrictEqual(r.options, ['race', 'merit', 'league', 'information']);
    assert.ok(r.labels.includes('Merit Table'));
    assert.deepStrictEqual(r.leagueButtons, ['By tier', 'All together', 'Last 10'],
      'the League segmented control is untouched');
    assert.deepStrictEqual(r.meritButtons, ['By tier', 'All together'],
      'and Merit does not add a fourth button to it');
    assert.strictEqual(r.overflow, false, 'nothing runs off a 375px screen');
    assert.match(r.heading, /Merit Table/);
    assert.match(r.tagline, /Harder wins earn more/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the Merit explanation is a quiet disclosure, closed by default', { skip }, async () => {
  const app = await H.open();
  try {
    await openMerit(app, 'all');
    const r = await app.run(() => {
      const head = document.getElementById('meritExplainerToggle');
      const closed = !document.getElementById('meritExplainerToggleBody');
      head.click();
      const text = document.getElementById('meritExplainerToggleBody').innerText.replace(/\s+/g, ' ');
      const cs = getComputedStyle(document.getElementById('meritExplainerToggle'));
      return { closed, text,
        weight: { border: cs.borderTopWidth, radius: cs.borderTopLeftRadius,
          filled: !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) } };
    });
    assert.strictEqual(r.closed, true, 'closed by default');
    assert.match(r.text, /An even matchup is worth 3 points for a win/,
      'the baseline is a standard League win, and the copy says so');
    assert.match(r.text, /cannot fall below 0 for a win/);
    assert.match(r.text, /Draws and losses earn 0/);
    assert.doesNotMatch(r.text, /worth 4 points|Draws are worth 1/, 'no trace of the superseded model');
    // Player-friendly: no implementation terminology on this copy.
    assert.doesNotMatch(r.text, /tier level|weight|sum of|Power Rating|expected/i);
    assert.match(r.weight.border, /^0px$/, 'a line, not a card');
    assert.strictEqual(r.weight.filled, false);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the Merit table agrees with the module, match for match', { skip }, async () => {
  const app = await H.open();
  try {
    await openMerit(app, 'all');
    const r = await app.run(() => {
      const rows = [...document.querySelectorAll('#summaryContent tbody tr')].map((tr) => {
        const td = [...tr.children].map((x) => x.innerText.trim());
        return { name: td[1], P: +td[2], W: +td[3], D: +td[4], L: +td[5], merit: +td[6] };
      });
      // Recompute independently from the canonical matches and resolver.
      const matches = getAllApprovedMatches()
        .map((m) => ({ id: m.id, date: m.date, winners: m.winners, losers: m.losers, isDraw: !!m.isDraw }));
      const truth = MeritTable.build(matches, (n, d) => historicalTierOf(n, d)).table;
      return { rows, truth: truth.map((t) => ({ name: t.playerId, P: t.played, W: t.wins, D: t.draws, L: t.losses, merit: t.merit })) };
    });
    assert.ok(r.rows.length > 10, 'the fixture produces a real table');
    assert.deepStrictEqual(r.rows, r.truth, 'the rendered table is exactly what the module computes');
    // Sanity: a table of integers, sorted by merit.
    r.rows.forEach((x) => assert.strictEqual(x.merit, Math.trunc(x.merit)));
    assert.deepStrictEqual(r.rows.map((x) => x.merit), r.rows.map((x) => x.merit).slice().sort((a, b) => b - a));
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('Merit splits by tier on the match date and collapses per tier', { skip }, async () => {
  const app = await H.open();
  try {
    await openMerit(app, 'all');
    const r = await app.run(() => {
      document.getElementById('meritGroupedBtn').click();
      const heads = [...document.querySelectorAll('#summaryContent .lg-tier-head')];
      const shown = () => heads.map((h) => h.dataset.tier)
        .filter((t) => document.getElementById(`meritTierBody${t}`));
      const openTiers = shown();
      const out = { tiers: heads.map((h) => h.dataset.tier), openTiers, openOnEntry: openTiers };
      const first = openTiers[0];
      document.querySelector(`#summaryContent .lg-tier-head[data-tier="${first}"]`).click();
      out.afterCollapse = [...document.querySelectorAll('#summaryContent .lg-tier-head')]
        .map((h) => h.dataset.tier).filter((t) => document.getElementById(`meritTierBody${t}`));
      // The split must sum back to All together.
      document.getElementById('meritAllBtn').click();
      const whole = {};
      [...document.querySelectorAll('#summaryContent tbody tr')].forEach((tr) => {
        const td = [...tr.children].map((x) => x.innerText.trim());
        whole[td[1]] = +td[6];
      });
      document.getElementById('meritGroupedBtn').click();
      // Expand everything before summing: a single-player tier arrives folded
      // and its rows are not in the DOM, which would silently drop that player
      // from the total.
      [...document.querySelectorAll('#summaryContent .lg-tier-head')]
        .filter((h) => h.getAttribute('aria-expanded') !== 'true')
        .forEach((h) => document.querySelector(`#summaryContent .lg-tier-head[data-tier="${h.dataset.tier}"]`).click());
      const split = {};
      [...document.querySelectorAll('#summaryContent tbody tr')].forEach((tr) => {
        const td = [...tr.children].map((x) => x.innerText.trim());
        split[td[1]] = (split[td[1]] || 0) + (+td[6]);
      });
      return { ...out, whole, split };
    });
    assert.ok(r.openTiers.length > 1, 'more than one populated tier section');
    assert.deepStrictEqual(r.afterCollapse, r.openTiers.slice(1), 'collapsing one leaves the rest alone');
    assert.deepStrictEqual(r.split, r.whole,
      'the tier sections must sum to the All together totals, player for player');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('Merit changes nothing about the League Table', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const b = document.querySelector('#tabrow .tab-btn[data-tab="summary"]');
      if (b) b.click();
      const readLeague = () => {
        summaryMode = 'league'; summaryMonth = '2026-08';
        leagueLastTen = false; leagueGrouped = false;
        leagueSortKey = 'points'; leagueSortDesc = true;
        renderSummary();
        return [...document.querySelectorAll('#summaryContent tbody tr')]
          .map((tr) => [...tr.children].map((x) => x.innerText.trim()).join('|'));
      };
      const before = readLeague();
      // Go to Merit and back.
      summaryMode = 'merit'; renderSummary();
      const meritRows = document.querySelectorAll('#summaryContent tbody tr').length;
      const after = readLeague();
      // And the rest of the app is where it was.
      const power = (() => {
        const pb = document.querySelector('#tabrow .tab-btn[data-tab="power"]');
        if (pb) pb.click();
        selectedMonth = 'all'; render();
        return [...document.querySelectorAll('#list .row')].slice(0, 5)
          .map((el) => (el.querySelector('.nm') || {}).textContent + ':' + (el.querySelector('.rating-big') || {}).textContent);
      })();
      return { before, after, meritRows, power };
    });
    assert.ok(r.before.length > 5, 'the League table has rows to compare');
    assert.ok(r.meritRows > 5, 'and Merit rendered a real table in between');
    assert.deepStrictEqual(r.after, r.before, 'League points are completely unchanged');
    assert.ok(r.power.every((x) => /:\d+$/.test(x)), 'and Power Rankings still shows ratings');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 22 Sep: "Tier S should be collapsed by default as there's only one
// player there." Written as the reason rather than as the letter S, so it
// holds in both directions — a section that gains a second player opens on its
// own, and any tier that thins to one folds without anybody remembering this.
test('a tier section with one player arrives collapsed; the rest do not', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const read = () => [...document.querySelectorAll('#summaryContent .lg-tier-head')].map((h) => {
        const open = h.getAttribute('aria-expanded') === 'true';
        // Count by opening it, then put it back exactly as it was.
        if (!open) h.click();
        const body = document.querySelector(`#summaryContent [id$="TierBody${h.dataset.tier}"]`);
        const rows = body ? body.querySelectorAll('tbody tr').length : 0;
        if (!open) document.querySelector(`#summaryContent .lg-tier-head[data-tier="${h.dataset.tier}"]`).click();
        return { tier: h.dataset.tier, open, rows };
      });

      const b = document.querySelector('#tabrow .tab-btn[data-tab="summary"]');
      if (b) b.click();
      summaryMode = 'league'; summaryMonth = '2026-09';
      leagueLastTen = false; leagueGrouped = true; leagueExplainerOpen = false;
      resetLeagueTierSections(); renderSummary();
      const league = read();

      summaryMode = 'merit'; summaryMonth = 'all'; leagueGrouped = true;
      resetMeritTierSections(); renderSummary();
      const merit = read();
      return { league, merit };
    });

    [['League', r.league], ['Merit', r.merit]].forEach(([which, sections]) => {
      assert.ok(sections.length > 1, `${which}: the fixture needs several tier sections`);
      const singles = sections.filter((s) => s.rows === 1);
      const many = sections.filter((s) => s.rows > 1);
      assert.ok(singles.length > 0, `${which}: the fixture needs a one-player tier (Tier S)`);
      assert.ok(many.length > 0, `${which}: and some populated ones`);
      singles.forEach((s) => assert.strictEqual(s.open, false,
        `${which}: Tier ${s.tier} has one player and must arrive collapsed`));
      many.forEach((s) => assert.strictEqual(s.open, true,
        `${which}: Tier ${s.tier} has ${s.rows} players and must arrive open`));
    });
    // The one the request named, specifically.
    assert.strictEqual(r.league.find((s) => s.tier === 'S').open, false, 'Tier S starts collapsed');
    assert.strictEqual(r.merit.find((s) => s.tier === 'S').open, false);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('a collapsed single-player tier still opens when tapped', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const b = document.querySelector('#tabrow .tab-btn[data-tab="summary"]');
      if (b) b.click();
      summaryMode = 'league'; summaryMonth = '2026-09';
      leagueLastTen = false; leagueGrouped = true; resetLeagueTierSections();
      renderSummary();
      const head = () => document.querySelector('#summaryContent .lg-tier-head[data-tier="S"]');
      const out = { headingPresent: !!head(), startsOpen: head().getAttribute('aria-expanded') === 'true' };
      head().click();
      out.afterTap = head().getAttribute('aria-expanded') === 'true';
      out.rows = document.getElementById('leagueTierBodyS').querySelectorAll('tbody tr').length;
      head().click();
      out.afterSecondTap = head().getAttribute('aria-expanded') === 'true';
      return out;
    });
    assert.strictEqual(r.headingPresent, true, 'the heading is always there — collapsed is not hidden');
    assert.strictEqual(r.startsOpen, false);
    assert.strictEqual(r.afterTap, true, 'and a tap opens it');
    assert.strictEqual(r.rows, 1, 'showing the one player it has');
    assert.strictEqual(r.afterSecondTap, false, 'and closes it again');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 22 Sep: Favoured alongside Hard, both tappable, and the drill-down
// must read the same classification the table does rather than working it out
// again for itself.

test('the Merit table shows Hard, Even and Favoured, and fits a phone', { skip }, async () => {
  const app = await H.open();
  try {
    await app.page.setViewportSize({ width: 375, height: 812 });
    await openMerit(app, 'all');
    await app.page.waitForTimeout(50);
    const r = await app.run(() => {
      const t = document.querySelector('#summaryContent table');
      const card = t.closest('.callout-card');
      const rows = [...t.querySelectorAll('tbody tr')].filter((tr) => !tr.classList.contains('merit-drill'));
      const cells = (tr) => [...tr.children].map((x) => x.innerText.trim());
      const truth = MeritTable.build(
        getAllApprovedMatches().map((m) => ({ id: m.id, date: m.date, winners: m.winners,
          losers: m.losers, isDraw: !!m.isDraw, sets: m.sets })),
        (n, d) => historicalTierOf(n, d)).table;
      return {
        headers: [...t.querySelectorAll('thead th')].map((h) => h.textContent),
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        cardScrolls: card.scrollWidth > card.clientWidth + 1,
        brokenNames: [...t.querySelectorAll('.request-player-link')].filter((l) => !/\s/.test(l.textContent) && l.getClientRects().length > 1).map((l) => l.textContent),
        rows: rows.map((tr) => { const c = cells(tr); return { name: c[1], hard: c[7], even: c[8], fav: c[9] }; }),
        truth: truth.map((x) => ({ name: x.playerId, hard: x.hardWins, fav: x.easyWins,
          wins: x.wins, even: x.evenWins })),
      };
    });

    assert.deepStrictEqual(r.headers, ['#', 'Player', 'P', 'W', 'D', 'L', 'Pts', 'Hard', 'Even', 'Fav'],
      'compact labels: Hard, Even, Favoured (Shaun, 30 Oct)');
    assert.strictEqual(r.pageOverflow, false, 'nothing runs off a 375px screen');
    assert.strictEqual(r.cardScrolls, false, 'and the table does not scroll sideways inside its card');
    assert.deepStrictEqual(r.brokenNames, [], 'no name broken mid-word');

    const byName = Object.fromEntries(r.truth.map((t) => [t.name, t]));
    r.rows.forEach((row) => {
      const t = byName[row.name];
      assert.strictEqual(row.hard, t.hard ? String(t.hard) : '–', `${row.name}: Hard`);
      assert.strictEqual(row.even, t.even ? String(t.even) : '–', `${row.name}: Even`);
      assert.strictEqual(row.fav, t.fav ? String(t.fav) : '–', `${row.name}: Fav`);
      // The three columns add up to W.
      assert.strictEqual(t.hard + t.fav + t.even, t.wins, `${row.name}: every win is in exactly one bucket`);
    });
    assert.ok(r.truth.some((t) => t.even > 0), 'the fixture has even wins, shown under Even');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('a zero count is not tappable; a real one opens its matches', { skip }, async () => {
  const app = await H.open();
  try {
    await app.page.setViewportSize({ width: 375, height: 812 });
    await openMerit(app, 'all');
    const r = await app.run(() => {
      const t = document.querySelector('#summaryContent table');
      const rows = [...t.querySelectorAll('tbody tr')].filter((tr) => !tr.classList.contains('merit-drill'));
      // Every cell showing a dash must have no control in it; every number must.
      const cellsOk = rows.every((tr) => [7, 8, 9].every((i) => {
        const td = tr.children[i];
        const hasButton = !!td.querySelector('.merit-count');
        const isDash = td.innerText.trim() === '–';
        return isDash ? !hasButton : hasButton;
      }));

      const btn = t.querySelector('.merit-count[data-kind="hard"]');
      const who = btn.dataset.player;
      const count = Number(btn.textContent);
      btn.click();
      const body = document.querySelector('#summaryContent .merit-drill-body');
      const listed = body.querySelectorAll('.merit-drill-row').length;
      const out = { cellsOk, who, count, listed,
        head: body.querySelector('.merit-drill-head').innerText,
        openBodies: document.querySelectorAll('#summaryContent .merit-drill-body').length,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1 };

      // The same tap again closes it.
      t.querySelector(`.merit-count[data-kind="hard"][data-player="${who}"]`).click();
      out.closedAgain = !document.querySelector('#summaryContent .merit-drill-body');

      // Opening Favoured for the same player replaces rather than adds.
      t.querySelector(`.merit-count[data-kind="hard"][data-player="${who}"]`).click();
      const fav = t.querySelector(`.merit-count[data-kind="favoured"][data-player="${who}"]`);
      if (fav) { fav.click(); out.afterFav = document.querySelectorAll('#summaryContent .merit-drill-body').length; }

      // Even opens exactly the even wins it counts.
      const even = t.querySelector('.merit-count[data-kind="even"]');
      out.evenCount = Number(even.textContent);
      even.click();
      const eb = document.querySelector('#summaryContent .merit-drill-body');
      out.evenListed = eb.querySelectorAll('.merit-drill-row').length;
      out.evenHead = eb.querySelector('.merit-drill-head').innerText;
      out.evenMeta = eb.querySelector('.merit-drill-meta').innerText;
      return out;
    });

    assert.strictEqual(r.cellsOk, true, 'a dash is not a control; a number is');
    assert.ok(r.count > 0);
    assert.strictEqual(r.listed, r.count, `${r.who}: the list must be exactly as long as the count`);
    assert.match(r.head, new RegExp(`${r.who}`, 'i'));
    assert.match(r.head, /stronger pairing/i);
    assert.strictEqual(r.openBodies, 1, 'one drill-down at a time');
    assert.strictEqual(r.overflow, false, 'and opening one does not push the page sideways');
    assert.strictEqual(r.closedAgain, true, 'tapping the same count closes it');
    assert.strictEqual(r.afterFav, 1, 'opening the other kind replaces rather than stacks');
    assert.ok(r.evenCount > 0);
    assert.strictEqual(r.evenListed, r.evenCount, 'Even lists exactly the wins it counts');
    assert.match(r.evenHead, /evenly matched pairing/i);
    assert.match(r.evenMeta, /evenly matched/i);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 30 Oct: the month's Monthly Race score on the Merit Table, in whole
// points, "so we can quickly see all of the context". The Race's own figures.
test('the Merit Table carries the month\'s Race score; All time has none', { skip }, async () => {
  const app = await H.open();
  try {
    await app.page.setViewportSize({ width: 360, height: 800 });
    const r = await app.run(() => {
      const month = getAvailableMonths()[0];
      const whole = (v) => { const n = Math.round(v); return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0'; };
      const race = buildMonthlyRace(month).table;
      const read = () => {
        const t = document.querySelector('#summaryContent table');
        return [...t.querySelectorAll('tbody tr')].filter((tr) => !tr.classList.contains('merit-drill'))
          .map((tr) => [tr.children[1].innerText.trim(), tr.lastElementChild.innerText.trim()]);
      };
      legacyTabBtn('summary').click();
      summaryMode = 'merit'; summaryMonth = month; meritDrill = null;

      // By tier: each row is that tier's race.
      leagueGrouped = true; resetMeritTierSections(); renderSummary();
      const byTier = [...document.querySelectorAll('#summaryContent [id^="meritTierBody"]')].flatMap((body) => {
        const tier = body.id.replace('meritTierBody', '');
        return [...body.querySelectorAll('tbody tr:not(.merit-drill)')].map((tr) => {
          const name = tr.children[1].innerText.trim();
          const e = race.find((x) => x.playerId === name && x.tier === tier);
          return { name, shown: tr.lastElementChild.innerText.trim(), want: e ? whole(e.score) : '–' };
        });
      });

      // All together: a player's races summed.
      leagueGrouped = false; renderSummary();
      const t = document.querySelector('#summaryContent table');
      const all = read().map(([name, shown]) => ({ name, shown,
        want: race.some((x) => x.playerId === name) ? whole(race.filter((x) => x.playerId === name).reduce((a, x) => a + x.score, 0)) : '–' }));
      const fits = { page: document.documentElement.scrollWidth > window.innerWidth + 1,
        cells: [...t.querySelectorAll('td, th')].filter((c) => c.scrollWidth > c.clientWidth + 1).length };
      const head = [...t.querySelectorAll('thead th')].map((h) => h.textContent);

      // A Race score opens the race's matches.
      const btn = t.querySelector('.merit-count[data-kind="race"]');
      const who = btn.dataset.player;
      btn.click();
      const body = document.querySelector('#summaryContent .merit-drill-body');
      const drill = { head: body.querySelector('.merit-drill-head').innerText, rows: body.querySelectorAll('.race-drill-row').length,
        want: race.filter((x) => x.playerId === who).reduce((a, x) => a + x.matches.length, 0) };

      // All time: no race.
      summaryMonth = 'all'; meritDrill = null; renderSummary();
      const allTime = [...document.querySelectorAll('#summaryContent table thead th')].map((h) => h.textContent);
      return { byTier, all, fits, head, drill, allTime };
    });
    assert.deepStrictEqual(r.head, ['#', 'Player', 'P', 'W', 'D', 'L', 'Pts', 'Hard', 'Even', 'Fav', 'Race']);
    assert.ok(r.byTier.length > 0 && r.all.length > 0);
    r.byTier.forEach((x) => assert.strictEqual(x.shown, x.want, `by tier, ${x.name}`));
    r.all.forEach((x) => assert.strictEqual(x.shown, x.want, `all together, ${x.name}`));
    assert.ok(r.all.some((x) => /^−/.test(x.shown)), 'a negative score reads as one');
    assert.deepStrictEqual(r.fits, { page: false, cells: 0 }, 'eleven columns fit a 360px phone');
    assert.match(r.drill.head, /race · \d+ match/i);
    assert.strictEqual(r.drill.rows, r.drill.want, 'the drill lists exactly the race\'s matches');
    assert.ok(!r.allTime.includes('Race'), 'the Race starts again every month, so All time has no column');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 31 Oct: "I have to be able to sort each column."
test('every Merit column sorts, both ways, and the # follows the order shown', { skip }, async () => {
  const app = await H.open();
  try {
    await app.page.setViewportSize({ width: 360, height: 800 });
    const r = await app.run(() => {
      legacyTabBtn('summary').click();
      summaryMode = 'merit'; summaryMonth = getAvailableMonths()[0]; leagueGrouped = false; meritDrill = null;
      meritSortKey = 'merit'; meritSortDesc = true;
      renderSummary();
      const num = (t) => (t === '–' ? null : Number(t.replace('−', '-').replace('+', '')));
      const col = (i) => [...document.querySelectorAll('#summaryContent table tbody tr:not(.merit-drill)')].map((tr) => tr.children[i].innerText.trim());
      const th = (k) => document.querySelector(`#summaryContent .merit-sort-th[data-key="${k}"]`);
      const keys = [...document.querySelectorAll('#summaryContent .merit-sort-th')].map((h) => h.dataset.key);
      const defaultPts = col(6);
      const out = { keys, defaultPts, checks: [] };
      [['played', 2], ['wins', 3], ['draws', 4], ['losses', 5], ['merit', 6], ['hardWins', 7], ['evenWins', 8], ['easyWins', 9], ['race', 10]].forEach(([k, i]) => {
        if (k !== meritSortKey) th(k).click(); else { th(k).click(); th(k).click(); }
        const down = col(i).map(num);
        const ariaDown = th(k).getAttribute('aria-sort');
        th(k).click();
        const up = col(i).map(num);
        out.checks.push({ k, down, up, ariaDown, ariaUp: th(k).getAttribute('aria-sort'), ranks: col(0) });
      });
      th('name').click();
      out.names = col(1);
      const t = document.querySelector('#summaryContent table');
      out.overflow = [...t.querySelectorAll('th')].filter((c) => c.scrollWidth > c.clientWidth + 1).length;
      th('race').click();
      summaryMonth = 'all'; renderSummary();
      out.allTimeSort = document.querySelector('#summaryContent .merit-sort-th.is-sorted').dataset.key;
      return out;
    });
    assert.deepStrictEqual(r.keys, ['name', 'played', 'wins', 'draws', 'losses', 'merit', 'hardWins', 'evenWins', 'easyWins', 'race']);
    const isSorted = (xs, desc) => xs.every((x, i) => i === 0 || (desc ? xs[i - 1] >= x : xs[i - 1] <= x));
    const dashLast = (xs) => xs.map((x) => (x === null ? 0 : x));   // a dash reads as no score: 0 for Hard/Even/Fav
    r.checks.forEach((c) => {
      const down = c.k === 'race' ? c.down.filter((x) => x !== null) : dashLast(c.down);
      const up = c.k === 'race' ? c.up.filter((x) => x !== null) : dashLast(c.up);
      assert.ok(isSorted(down, true), `${c.k}: highest first on the first tap`);
      assert.ok(isSorted(up, false), `${c.k}: lowest first on the second`);
      assert.strictEqual(c.ariaDown, 'descending'); assert.strictEqual(c.ariaUp, 'ascending');
      assert.deepStrictEqual(c.ranks, c.ranks.map((_, i) => String(i + 1)), `${c.k}: # follows the order shown`);
    });
    assert.ok(isSorted(r.defaultPts.map(Number), true), 'the default is the Merit standings');
    assert.deepStrictEqual(r.names, r.names.slice().sort((a, b) => a.localeCompare(b)), 'Player sorts A-Z');
    assert.strictEqual(r.overflow, 0, 'the sort arrow takes no width on a phone');
    assert.strictEqual(r.allTimeSort, 'merit', 'All time has no Race, so a Race sort falls back to Pts');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the drill-down is the table\'s own classification, not a second opinion', { skip }, async () => {
  const app = await H.open();
  try {
    await openMerit(app, 'all');
    const r = await app.run(() => {
      const t = document.querySelector('#summaryContent table');
      const btn = t.querySelector('.merit-count[data-kind="hard"]');
      const who = btn.dataset.player;
      btn.click();
      const shown = [...document.querySelectorAll('#summaryContent .merit-drill-row')].map((el) => ({
        text: el.innerText.replace(/\s+/g, ' '),
        date: el.querySelector('.merit-drill-date').textContent,
        pts: Number(el.querySelector('.merit-drill-pts').textContent.replace(/[^0-9]/g, '')),
      }));
      // What the canonical calculation says those matches are.
      const truth = MeritTable.build(
        getAllApprovedMatches().map((m) => ({ id: m.id, date: m.date, winners: m.winners,
          losers: m.losers, isDraw: !!m.isDraw, sets: m.sets })),
        (n, d) => historicalTierOf(n, d)).table.find((x) => x.playerId === who);
      return { who, shown, truth: truth.hard.map((d) => ({ date: d.date, pts: d.points,
        steps: d.steps, tiers: d.winnerTiers.concat(d.loserTiers) })) };
    });

    assert.strictEqual(r.shown.length, r.truth.length);
    const shownSorted = r.shown.map((s) => `${s.date}|${s.pts}`).sort();
    const truthSorted = r.truth.map((s) => `${s.date}|${s.pts}`).sort();
    assert.deepStrictEqual(shownSorted, truthSorted,
      'every listed match, and its points, come from the canonical Merit calculation');
    // Each row states the tiers used and the gap, so the reader can check it.
    r.shown.forEach((s, i) => {
      assert.match(s.text, /tier-step|even/, `row ${i} must state the gap: ${s.text}`);
      assert.match(s.text, /beat/, 'and who beat whom');
      assert.match(s.text, /pt/, 'and what it was worth');
    });
    r.truth.forEach((t) => {
      const row = r.shown.find((s) => s.date === t.date && s.pts === t.pts);
      t.tiers.forEach((tier) => assert.ok(row.text.includes(tier),
        `the historical tier ${tier} used for ${t.date} must be shown: ${row.text}`));
    });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('the drill-down respects the selected Merit period', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const b = document.querySelector('#tabrow .tab-btn[data-tab="summary"]');
      if (b) b.click();
      const listFor = (month) => {
        summaryMode = 'merit'; summaryMonth = month; leagueGrouped = false;
        meritDrill = null; resetMeritTierSections(); renderSummary();
        const btn = document.querySelector('#summaryContent .merit-count[data-kind="hard"]');
        if (!btn) return null;
        const who = btn.dataset.player;
        btn.click();
        const dates = [...document.querySelectorAll('#summaryContent .merit-drill-date')].map((e) => e.textContent);
        return { who, dates, count: Number(btn.textContent) };
      };
      return { all: listFor('all'), september: listFor('2026-09') };
    });

    assert.ok(r.all.dates.length > 0);
    assert.ok(r.september, 'September has qualifying matches in the fixture');
    assert.strictEqual(r.september.dates.length, r.september.count);
    r.september.dates.forEach((d) => assert.match(d, /^2026-09/,
      'a month view must only list that month\'s matches'));
    assert.ok(r.all.dates.some((d) => !/^2026-09/.test(d)),
      'while All time reaches outside it');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
