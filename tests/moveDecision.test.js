// ===================== MOVING A DECISION TO ITS REAL DATE =====================
// Shaun, 6 Nov: "I need to be able to set the date that a tier change occurred
// alongside the new rating. I did one rating a day late but a game had already
// been played as a player in their new tier (PDM)."
//
// A recorded tier decision (and the rating that came with it) is moved to the
// date it really took effect: recorded again there, superseding the original,
// and every game from the earlier date re-rated. Rehearsed on the seed record:
// PDM promoted to A at 1600 on 15 Sep, a day after his 14 Sep game.

const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../assets/js/ratingEngine.js');
const Store = require('../assets/js/ratingStore.js');
const RF = require('../assets/js/replayForward.js');
const HA = require('../assets/js/historicalAdjustment.js');
const BD = require('../assets/js/betaDiagnostics.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const provenance = { createdBy: 'Shaun', recordedAt: '2026-11-06T10:00:00.000Z', source: 'test' };

async function seeded() {
  const b = buildBackfill();
  const plan = Store.buildWritePlan({ matches: b.matches, journey: b.replay.journey, state: b.replay.state, provenance: b.provenance });
  const backend = Store.memoryBackend();
  for (const c of [Store.COLLECTIONS.matches, Store.COLLECTIONS.journey, Store.COLLECTIONS.players]) {
    for (const d of plan[c]) await backend.set(c, d.id, d);
  }
  return backend;
}
async function read(backend) {
  return {
    matches: await backend.getAll(Store.COLLECTIONS.matches),
    journey: await backend.getAll(Store.COLLECTIONS.journey),
    players: await backend.getAll(Store.COLLECTIONS.players),
  };
}
function healthy(stored) {
  const players = {}; stored.players.forEach((d) => { players[d.id] = d; });
  const report = BD.run({ players, matches: stored.matches, journey: stored.journey });
  return report.healthy || report.checks.filter((c) => c.status === 'fail').map((c) => c.name).join(', ');
}

// PDM promoted a day late: B -> A at 1600, recorded on the 15th.
async function promotedLate() {
  const backend = await seeded();
  const late = HA.plan({ stored: await read(backend), provenance, adjustment: {
    playerId: 'PDM', effectiveDate: '2026-09-15', tierEvent: 'PROMOTION', newTier: 'A',
    ratingDecision: 'CLUB_OVERRIDE', overrideRating: 1600, reason: 'Results and eye test.', createdBy: 'Shaun' } });
  await RF.commit(backend, late);
  return backend;
}
const gameOn14 = (stored) => stored.journey.find((e) => e.playerId === 'PDM' && e.matchId === '2026-09-14-2');

test('moved to the 14th: his game that day is played as Tier A from 1600, the original stays in the record, the record is sound', async () => {
  const backend = await promotedLate();
  const before = await read(backend);
  assert.strictEqual(gameOn14(before).tierAtEvent, 'B', 'recorded late, the game was rated in Tier B');
  assert.deepStrictEqual(HA.decisionDates(before.journey, 'PDM'), ['2026-09-15']);

  const p = HA.planMove({ stored: before, playerId: 'PDM', fromDate: '2026-09-15', toDate: '2026-09-14',
    reason: 'Promoted before his game on the 14th; entered a day late', createdBy: 'Shaun', provenance });
  assert.deepStrictEqual(p.events.map((e) => [e.eventType, e.effectiveDate, e.newTier || null, e.newPowerRating ?? null]),
    [[Engine.EVENT.PROMOTION, '2026-09-14', 'A', null], [Engine.EVENT.CLUB_RATING_REASSESSMENT, '2026-09-14', 'A', 1600]],
    'the promotion moves no points; the club\'s 1600 moves as 1600');
  assert.ok(p.events.every((e) => /^2026-09-15__PDM__/.test(e.supersedes)));
  assert.match(p.events[0].notes, /Date corrected from 2026-09-15 to 2026-09-14: Promoted before his game/);
  assert.ok(p.playersMoved.some((m) => m.playerId === 'PDM'));

  await RF.commit(backend, p);
  const after = await read(backend);
  const g = gameOn14(after);
  assert.strictEqual(g.tierAtEvent, 'A');
  assert.strictEqual(g.preMatchRating, 1600, 'the game starts from the club\'s rating');
  const ids = after.journey.map((e) => e.id);
  ['2026-09-15__PDM__PROMOTION', '2026-09-15__PDM__CLUB_RATING_REASSESSMENT'].forEach((id) => assert.ok(ids.includes(id), `${id} kept`));
  assert.deepStrictEqual(HA.decisionDates(after.journey, 'PDM'), ['2026-09-14'], 'only the moved decision is live');
  assert.strictEqual(after.players.find((d) => d.id === 'PDM').tier, 'A');
  assert.strictEqual(healthy(after), true);
});

test('what it refuses: no decision on that date, the same date, no reason, a decision already there', async () => {
  const stored = await read(await promotedLate());
  const go = (o) => () => HA.movedEvents({ journey: stored.journey, playerId: 'PDM', fromDate: '2026-09-15', toDate: '2026-09-14', reason: 'late', createdBy: 'Shaun', ...o });
  assert.throws(go({ fromDate: '2026-09-10' }), /no decision recorded on 2026-09-10/);
  assert.throws(go({ toDate: '2026-09-15' }), /different date/);
  assert.throws(go({ reason: ' ' }), /Say why/);
  assert.throws(go({ createdBy: null }), /who you are/);
  assert.throws(go({ toDate: '2026-01-01' }), /entered the record on/);
  assert.doesNotThrow(go({}));
});

maybe('Admin › Historical club adjustment: find the player\'s decision, give the real date and why, preview who moves, then move it', async () => {
  const app = await H.open({ now: '2026-11-06T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      // Promote PDM a day late, as the monthly review would have.
      const late = HistoricalAdjustment.plan({ stored: await readStoredRecord(RatingStore.firestoreCompatBackend(db)), provenance: { createdBy: 'Shaun', recordedAt: 'x', source: 'test' },
        adjustment: { playerId: 'PDM', effectiveDate: '2026-09-15', tierEvent: 'PROMOTION', newTier: 'A', ratingDecision: 'CLUB_OVERRIDE', overrideRating: 1600, reason: 'Results.', createdBy: 'Shaun' } });
      await ReplayForward.commit(RatingStore.firestoreCompatBackend(db), late);
      await loadV3State();
      adminOpenSections.historical = true;
      renderManage();
      document.getElementById('movePlayer').value = 'PDM';
      document.getElementById('moveFindBtn').click();
      const offered = [...document.getElementById('moveFrom').options].map((o) => o.textContent);
      document.getElementById('moveTo').value = '2026-09-14';
      document.getElementById('moveReason').value = 'Promoted before his game on the 14th';
      await movePreview();
      const preview = document.getElementById('manageView').innerText;
      await moveCommit();
      const stored = await readStoredRecord(RatingStore.firestoreCompatBackend(db));
      const g = stored.journey.find((e) => e.playerId === 'PDM' && e.matchId === '2026-09-14-2');
      return { offered, preview: /Confirm — this re-rates every game from 2026-09-14/.test(preview) && /moved from 2026-09-15 to 2026-09-14/.test(preview),
        message: moveMessage, tier: g.tierAtEvent, from: g.preMatchRating };
    });
    assert.strictEqual(r.offered.length, 1);
    assert.match(r.offered[0], /15 Sep 2026 — Promotion \+ /);
    assert.ok(r.preview, 'the consequence is shown before anything is written');
    assert.match(r.message, /^Moved and replayed\./);
    assert.deepStrictEqual([r.tier, r.from], ['A', 1600]);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('the monthly review asks when a decision takes effect; an earlier date continues in the Historical club adjustment', async () => {
  const app = await H.open({ now: '2026-11-06T10:00:00.000Z' });
  try {
    const r = await app.run(() => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      adminOpenSections.review = true; reviewSubject = 'PDM'; renderManage();
      const field = document.getElementById('reviewEffective');
      const today = field.value;
      field.value = '2026-09-14'; field.onchange();
      const note = document.getElementById('manageView').innerText;
      document.getElementById('reviewGoHistorical').click();
      return { today, note: /before today\. It is recorded through the Historical club adjustment/.test(note),
        hist: histAdj && [histAdj.playerId, histAdj.effectiveDate], open: !!adminOpenSections.historical, review: reviewSubject };
    });
    assert.strictEqual(r.today, '2026-11-06', 'today, by default');
    assert.ok(r.note);
    assert.deepStrictEqual(r.hist, ['PDM', '2026-09-14']);
    assert.strictEqual(r.open, true);
    assert.strictEqual(r.review, null);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
