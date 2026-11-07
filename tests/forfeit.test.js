// ===================== A FORFEIT =====================
// Shaun, 7 Nov: "a player quit/forfeit a match, so we want to penalise him but
// not his opponent ... the loss to affect his record but not his team-mate."
// Decided: a loss for the player who quit and a win for the opponents, at the
// score as it stood (Shaun chose both); the partner is untouched -- no rating
// movement, no record, no match counted. The pair still counts as a pair for
// the expectation, because the pair played.

const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../assets/js/ratingEngine.js');
const Store = require('../assets/js/ratingStore.js');
const RF = require('../assets/js/replayForward.js');
const BD = require('../assets/js/betaDiagnostics.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const provenance = { createdBy: 'Shaun', recordedAt: '2026-11-07T10:00:00.000Z', source: 'test' };

test('the engine: the partner of a player who quit is untouched; everyone else is rated as usual, against the pair', () => {
  const state = {};
  ['A1', 'A2', 'B1', 'B2'].forEach((n, i) => { state[n] = { ...Engine.initialisePlayer({ tier: 'B' }), rating: 1400 + i * 20 }; });
  const match = { id: 'm', date: '2026-11-01', teamA: ['A1', 'A2'], teamB: ['B1', 'B2'], sets: [[4, 2]], outcome: Engine.OUTCOME.A_WINS };
  const plain = JSON.parse(JSON.stringify(state));
  const r1 = Engine.processMatch(plain, match);
  const r2 = Engine.processMatch(state, { ...match, forfeit: { by: 'B1', unaffected: ['B2'] } });
  assert.deepStrictEqual(r2.events.map((e) => e.playerId), ['A1', 'A2', 'B1']);
  assert.deepStrictEqual([state.B2.rating, state.B2.lifetimeMatches, state.B2.effectiveEvidence], [1460, 0, 0], 'the partner: unchanged');
  ['A1', 'A2', 'B1'].forEach((n) => assert.strictEqual(state[n].rating, plain[n].rating, `${n} rated exactly as without the forfeit`));
  assert.strictEqual(r2.expectedA, r1.expectedA, 'the expectation is still the pair\'s');
});

test('stored and replayed: only a forfeit carries the field; the record is sound and replays to itself', async () => {
  const b = buildBackfill();
  const plan = Store.buildWritePlan({ matches: b.matches, journey: b.replay.journey, state: b.replay.state, provenance: b.provenance });
  assert.ok(plan[Store.COLLECTIONS.matches].every((d) => !('forfeit' in d)), 'no other match changes shape');
  const backend = Store.memoryBackend();
  for (const c of [Store.COLLECTIONS.matches, Store.COLLECTIONS.journey, Store.COLLECTIONS.players]) for (const d of plan[c]) await backend.set(c, d.id, d);
  const read = async () => ({ matches: await backend.getAll('matches'), journey: await backend.getAll('ratingJourney'), players: await backend.getAll('players') });
  const before = await read();
  const doc = before.matches.find((m) => m.id === '2026-09-14-2');   // Max & Jords def PDM & Stormzy
  const p = RF.plan({ stored: before, change: { type: 'edit', match: { ...Store.matchFromDoc(doc), forfeit: { by: 'PDM', unaffected: ['Stormzy'] } } }, provenance });
  const stormzy = p.playersMoved.find((m) => m.playerId === 'Stormzy');
  assert.ok(stormzy && stormzy.delta > 0, 'Stormzy no longer carries the loss');
  await RF.commit(backend, p);
  const after = await read();
  assert.deepStrictEqual(after.journey.filter((e) => e.matchId === '2026-09-14-2').map((e) => e.playerId).sort(), ['Jords', 'Max', 'PDM']);
  assert.deepStrictEqual(after.matches.find((m) => m.id === '2026-09-14-2').forfeit, { by: 'PDM', unaffected: ['Stormzy'] });
  const players = {}; after.players.forEach((d) => { players[d.id] = d; });
  assert.strictEqual(BD.run({ players, matches: after.matches, journey: after.journey }).healthy, true);
  assert.strictEqual(RF.verifyNoOp(after, provenance).identical, true);
});

maybe('Admin: Results › Manage › Forfeit — who quit, preview, apply; the partner leaves the record, the line says why, and it can be undone', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun'; gamesMonth = 'all';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      const id = '2026-09-14-2';
      const stormzyBefore = PLAYERS.find((p) => p.name === 'Stormzy');
      const played = (n) => matchesIncludingDraws().filter((m) => m.winners.includes(n) || m.losers.includes(n)).length;
      const before = { stormzy: played('Stormzy'), pdm: played('PDM'), rating: stormzyBefore.rating };
      managingGameId = id; renderGamesTab();
      // PDM was on the winning side? No: Max & Jords won. Quitting puts PDM's side down either way.
      const panel = document.querySelector(`[data-forfeit-panel="${id}"]`);
      panel.querySelector('[data-forfeit-who]').value = 'PDM';
      panel.querySelector(`[data-forfeit-stage="${id}"]`).click();
      await new Promise((res) => { const t = setInterval(() => { if (matchFixPlan || /quit|failed/.test(matchFixMessage)) { clearInterval(t); res(); } }, 20); });
      const preview = document.getElementById('gamesView').innerText;
      await commitMatchCorrection();
      await new Promise((res) => setTimeout(res, 50));
      renderGamesTab();
      const m = matchesIncludingDraws().find((x) => x.id === id);
      const card = [...document.querySelectorAll('#gamesView [data-game-card]')].find((el) => el.dataset.gameCard === id);
      const after = { stormzy: played('Stormzy'), pdm: played('PDM'), rating: PLAYERS.find((p) => p.name === 'Stormzy').rating };
      // Correct match is refused until the forfeit is removed.
      managingGameId = id; renderGamesTab();
      document.querySelector(`[data-game-card="${id}"] [data-edit]`).click();
      const refused = matchFixMessage;
      // Undo.
      managingGameId = id; renderGamesTab();
      document.querySelector(`[data-forfeit-remove="${id}"]`).click();
      await new Promise((res) => { const t = setInterval(() => { if (matchFixPlan) { clearInterval(t); res(); } }, 20); });
      await commitMatchCorrection();
      await new Promise((res) => setTimeout(res, 50));
      const undone = { stormzy: played('Stormzy'), forfeit: !!matchesIncludingDraws().find((x) => x.id === id).forfeit };
      return { before, after, preview: /Forfeit on 2026-09-14: PDM quit\. A loss for PDM \(Stormzy untouched\), a win for Max & Jords/.test(preview),
        sides: [m.winners, m.losers], forfeit: m.forfeit, line: card ? card.innerText : '', refused, undone };
    });
    assert.ok(r.preview, 'the preview says what will happen before anything is written');
    assert.deepStrictEqual(r.sides, [['Max', 'Jords'], ['PDM']]);
    assert.deepStrictEqual(r.forfeit, { by: 'PDM', unaffected: ['Stormzy'] });
    assert.strictEqual(r.after.stormzy, r.before.stormzy - 1, 'Stormzy\'s record loses the match');
    assert.strictEqual(r.after.pdm, r.before.pdm, 'PDM keeps it, as a loss');
    assert.ok(r.after.rating > r.before.rating, 'Stormzy\'s rating no longer carries the loss');
    assert.match(r.line, /Forfeit PDM quit\. A loss for PDM only — Stormzy's result doesn't count\./);
    assert.match(r.refused, /Remove the forfeit first/);
    assert.deepStrictEqual(r.undone, { stormzy: r.before.stormzy, forfeit: false });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('an unfinished match (a draw) can be a forfeit too: the player who quit loses it', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun'; gamesMonth = 'all';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      const d = matchesIncludingDraws().find((m) => m.isDraw && m.winners.length === 2 && m.losers.length === 2);
      const quitter = d.winners[0], partner = d.winners[1];
      managingGameId = d.id; renderGamesTab();
      const offered = !!document.querySelector(`[data-forfeit-panel="${d.id}"]`);
      await stageForfeit(d.id, quitter); await commitMatchCorrection();
      await new Promise((res) => setTimeout(res, 50));
      const m = matchesIncludingDraws().find((x) => x.id === d.id);
      return { offered, isDraw: m.isDraw, losers: m.losers, quitter, winners: m.winners, theirs: d.losers, partnerIn: [...m.winners, ...m.losers].includes(partner) };
    });
    assert.ok(r.offered);
    assert.strictEqual(r.isDraw, false);
    assert.deepStrictEqual(r.losers, [r.quitter]);
    assert.deepStrictEqual(r.winners, r.theirs);
    assert.strictEqual(r.partnerIn, false);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
