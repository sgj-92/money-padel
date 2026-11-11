// ===================== A LATE ARRIVAL =====================
// Shaun, 11 Nov: group rules -- more than 20 minutes late and your side starts
// a set down. "The team who was on time gets a win/the extra set, the player
// who was on time gets the accurate result and the player who was late gets
// the extra set added/the loss to their record." Example: played 1-1 in sets,
// a Team B player late, so Team A won 2-1.
// Decided (Shaun): the set is a set, no games added; the on-time partner's
// rating moves on the match as played and the game is left out of their
// tables, as with a forfeit.

const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../assets/js/ratingEngine.js');
const Store = require('../assets/js/ratingStore.js');
const RF = require('../assets/js/replayForward.js');
const BD = require('../assets/js/betaDiagnostics.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const provenance = { createdBy: 'Shaun', recordedAt: '2026-11-11T10:00:00.000Z', source: 'test' };
const O = Engine.OUTCOME;

test('the engine: opponents and the late player on the result as counted; the on-time partner on the match as played', () => {
  const fresh = () => { const s = {}; ['A1', 'A2', 'B1', 'B2'].forEach((n, i) => { s[n] = { ...Engine.initialisePlayer({ tier: 'B' }), rating: 1400 + i * 20 }; }); return s; };
  const base = { id: 'm', date: '2026-11-11', teamA: ['A1', 'A2'], teamB: ['B1', 'B2'], sets: [[6, 4], [3, 6]] };
  const counted = fresh(); Engine.processMatch(counted, { ...base, outcome: O.A_WINS });
  const asPlayed = fresh(); Engine.processMatch(asPlayed, { ...base, outcome: O.DRAW });
  const late = fresh();
  const r = Engine.processMatch(late, { ...base, outcome: O.A_WINS, late: { by: ['B1'], onTime: ['B2'], playedOutcome: O.DRAW } });
  ['A1', 'A2', 'B1'].forEach((n) => assert.strictEqual(late[n].rating, counted[n].rating, `${n}: rated on the 2-1 as counted`));
  assert.strictEqual(late.B2.rating, asPlayed.B2.rating, 'B2: rated on the 1-1 as played');
  assert.ok(late.B1.rating - 1440 < late.B2.rating - 1460, 'the late player comes off worse than the partner');
  assert.strictEqual(r.events.length, 4, 'all four play; all four are rated');
  const b2 = r.events.find((e) => e.playerId === 'B2');
  assert.strictEqual(b2.preMatchExpectedScore, r.expectedB, 'against the same expectation');
});

test('stored and replayed: only a late match carries the field; the record is sound and replays to itself', async () => {
  const b = buildBackfill();
  const plan = Store.buildWritePlan({ matches: b.matches, journey: b.replay.journey, state: b.replay.state, provenance: b.provenance });
  assert.ok(plan[Store.COLLECTIONS.matches].every((d) => !('late' in d)), 'no other match changes shape');
  const backend = Store.memoryBackend();
  for (const c of [Store.COLLECTIONS.matches, Store.COLLECTIONS.journey, Store.COLLECTIONS.players]) for (const d of plan[c]) await backend.set(c, d.id, d);
  const read = async () => ({ matches: await backend.getAll('matches'), journey: await backend.getAll('ratingJourney'), players: await backend.getAll('players') });
  const before = await read();
  const doc = before.matches.find((m) => m.outcome === O.DRAW && m.teamA.length === 2 && m.sets.filter((s) => s.teamA > s.teamB).length === 1 && m.sets.filter((s) => s.teamB > s.teamA).length === 1);
  assert.ok(doc, 'a 1-1 draw in the record');
  const lateMatch = { ...Store.matchFromDoc(doc), outcome: O.A_WINS, drawSideAssignmentArbitrary: false, late: { by: [doc.teamB[0]], onTime: [doc.teamB[1]], playedOutcome: O.DRAW } };
  const p = RF.plan({ stored: before, change: { type: 'edit', match: lateMatch }, provenance });
  await RF.commit(backend, p);
  const after = await read();
  assert.deepStrictEqual(after.matches.find((m) => m.id === doc.id).late, { by: [doc.teamB[0]], onTime: [doc.teamB[1]], playedOutcome: O.DRAW });
  assert.strictEqual(after.journey.filter((e) => e.matchId === doc.id).length, 4);
  const players = {}; after.players.forEach((d) => { players[d.id] = d; });
  assert.strictEqual(BD.run({ players, matches: after.matches, journey: after.journey }).healthy, true);
  assert.strictEqual(RF.verifyNoOp(after, provenance).identical, true);
});

maybe('Admin: Results › Manage › Late arrival — tick who, preview, apply; shown on the result; the partner out of the tables; undone exactly', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun'; gamesMonth = 'all';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      // A 1-1 draw, as in Shaun's example.
      const d = matchesIncludingDraws().find((m) => m.isDraw && m.winners.length === 2 && m.losers.length === 2
        && m.sets.filter((s) => s[0] > s[1]).length === 1 && m.sets.filter((s) => s[1] > s[0]).length === 1);
      const [a1, a2] = d.winners, [lateOne, partner] = d.losers;
      const played = (n) => matchesIncludingDraws().filter((m) => m.winners.includes(n) || m.losers.includes(n)).length;
      const rating = (n) => PLAYERS.find((p) => p.name === n).rating;
      const before = { partner: played(partner), late: played(lateOne), lateR: rating(lateOne), partnerR: rating(partner), a1R: rating(a1) };
      const wait = (f) => new Promise((res) => { const t = setInterval(() => { if (f()) { clearInterval(t); res(); } }, 20); });
      managingGameId = d.id; renderGamesTab();
      const panel = document.querySelector(`[data-late-panel="${d.id}"]`);
      panel.querySelector(`[data-late-who][value="${lateOne}"]`).checked = true;
      panel.querySelector(`[data-late-stage="${d.id}"]`).click();
      await wait(() => matchFixPlan || /late|failed/i.test(matchFixMessage));
      const preview = document.getElementById('gamesView').innerText;
      await commitMatchCorrection();
      await new Promise((res) => setTimeout(res, 50));
      renderGamesTab();
      const m = matchesIncludingDraws().find((x) => x.id === d.id);
      const card = [...document.querySelectorAll('#gamesView [data-game-card]')].find((el) => el.dataset.gameCard === d.id);
      const after = { partner: played(partner), late: played(lateOne), lateR: rating(lateOne), partnerR: rating(partner), a1R: rating(a1) };
      managingGameId = d.id; renderGamesTab();
      document.querySelector(`[data-game-card="${d.id}"] [data-edit]`).click();
      const refused = matchFixMessage;
      const forfeitOffered = !!document.querySelector(`[data-forfeit-panel="${d.id}"]`);
      managingGameId = d.id; renderGamesTab();
      document.querySelector(`[data-late-remove="${d.id}"]`).click();
      await wait(() => matchFixPlan);
      await commitMatchCorrection();
      await new Promise((res) => setTimeout(res, 50));
      const back = matchesIncludingDraws().find((x) => x.id === d.id);
      return { names: { a1, a2, lateOne, partner }, before, after, preview, refused, forfeitOffered,
        m: { winners: m.winners, losers: m.losers, isDraw: m.isDraw, late: m.late }, line: card ? card.innerText : '',
        undone: { isDraw: back.isDraw, sides: [back.winners, back.losers], late: !!back.late, partner: played(partner), lateR: rating(lateOne), partnerR: rating(partner) },
        originalSides: [d.winners, d.losers] };
    });
    const { a1, a2, lateOne, partner } = r.names;
    assert.match(r.preview, new RegExp(`Late on .*: ${lateOne} arrived late, so the side starts a set down\\. Counted as 2–1 to ${a1} & ${a2}; ${partner} rated on the match as played`));
    assert.deepStrictEqual(r.m.winners, [a1, a2]);
    assert.deepStrictEqual(r.m.losers, [lateOne], 'the partner is out of the sides');
    assert.strictEqual(r.m.isDraw, false);
    assert.match(r.line, new RegExp(`Late ${lateOne} arrived late, so the side started a set down\\. Counted as 2–1 to ${a1} & ${a2}, a loss for ${lateOne}\\. ${partner} was on time: the result as played \\(a draw, 1–1 in sets\\) counts for ${partner}'s rating only\\.`));
    assert.strictEqual(r.after.partner, r.before.partner - 1, 'out of the partner\'s tables');
    assert.strictEqual(r.after.late, r.before.late, 'the late player keeps it, now a loss');
    assert.ok(r.after.lateR < r.before.lateR, 'the late player loses rating');
    assert.ok(r.after.a1R > r.before.a1R, 'the opponents gain');
    assert.ok(Math.abs(r.after.partnerR - r.before.partnerR) < 1e-9, 'the partner is exactly where the draw left them');
    assert.match(r.refused, /late penalty/);
    assert.strictEqual(r.forfeitOffered, false, 'a late match is not also a forfeit');
    assert.deepStrictEqual(r.undone, { isDraw: true, sides: r.originalSides, late: false, partner: r.before.partner, lateR: r.before.lateR, partnerR: r.before.partnerR });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
