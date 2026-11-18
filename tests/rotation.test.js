// ===================== ROTATIONS =====================
// Shaun, 14-15 Nov (Padel Championships): four players swap partners each set.
//   Khalid x Azzu 4-6 David x Nilesh
//   Khalid x David 6-3 Azzu x Nilesh
//   Khalid x Nilesh 6-2, 10-6 tie-break Azzu x David
// Decided (Shaun): each pairing rated on its own games, the session worth
// about one match; not in any table; its own section in Results; head to
// head lists its sets as history, with no win or loss. A tie-break is a set
// won, no games.

const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../assets/js/ratingEngine.js');
const Store = require('../assets/js/ratingStore.js');
const RF = require('../assets/js/replayForward.js');
const BD = require('../assets/js/betaDiagnostics.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const provenance = { createdBy: 'Shaun', recordedAt: '2026-11-15T10:00:00.000Z', source: 'test' };

test('the engine: a pairing moves ratings and evidence by its share; the session counts once', () => {
  const fresh = () => { const s = {}; ['A1', 'A2', 'B1', 'B2'].forEach((n, i) => { s[n] = { ...Engine.initialisePlayer({ tier: 'B' }), rating: 1400 + i * 20 }; }); return s; };
  const m = { id: 'm', date: '2026-11-14', teamA: ['A1', 'A2'], teamB: ['B1', 'B2'], sets: [[6, 3]], outcome: Engine.OUTCOME.A_WINS };
  const full = fresh(); Engine.processMatch(full, m);
  const third = fresh(); Engine.processMatch(third, { ...m, rotation: { session: 's', part: 1, of: 3, weight: 1 / 3 } });
  const later = fresh(); Engine.processMatch(later, { ...m, rotation: { session: 's', part: 2, of: 3, weight: 1 / 3 } });
  ['A1', 'A2', 'B1', 'B2'].forEach((n, i) => {
    const start = 1400 + i * 20;
    assert.ok(Math.abs((third[n].rating - start) - (full[n].rating - start) / 3) < 1e-9, `${n}: a third of the move`);
    assert.ok(Math.abs(third[n].effectiveEvidence - 1 / 3) < 1e-12);
  });
  assert.deepStrictEqual([third.A1.lifetimeMatches, later.A1.lifetimeMatches], [1, 0], 'counted on the first pairing only');
});

test('stored and replayed: only rotation pairings carry the field; the record is sound and replays to itself', async () => {
  const b = buildBackfill();
  const plan = Store.buildWritePlan({ matches: b.matches, journey: b.replay.journey, state: b.replay.state, provenance: b.provenance });
  assert.ok(plan[Store.COLLECTIONS.matches].every((d) => !('rotation' in d)));
  const backend = Store.memoryBackend();
  for (const c of [Store.COLLECTIONS.matches, Store.COLLECTIONS.journey, Store.COLLECTIONS.players]) for (const d of plan[c]) await backend.set(c, d.id, d);
  const read = async () => ({ matches: await backend.getAll('matches'), journey: await backend.getAll('ratingJourney'), players: await backend.getAll('players') });
  const before = await read();
  const last = before.matches.map((m) => m.date).sort().slice(-1)[0];
  const date = last.slice(0, 8) + String(Math.min(28, Number(last.slice(8)) + 1)).padStart(2, '0');
  const [k, a, d, n] = ['Max', 'Jords', 'PDM', 'Stormzy'];
  const rot = (i, teamA, teamB, sets, outcome) => ({ id: `${date}-${i}`, date, sourceIndex: i, teamA, teamB, sets, outcome, type: 'doubles', drawSideAssignmentArbitrary: false,
    rotation: { session: `${date}-R1`, part: i, of: 3, weight: 1 / 3 } });
  const matches = [rot(1, [d, n], [k, a], [[6, 4]], 'A_WINS'), rot(2, [k, d], [a, n], [[6, 3]], 'A_WINS'), rot(3, [k, n], [a, d], [[6, 2], [1, 0]], 'A_WINS')];
  const p = RF.plan({ stored: before, change: { type: 'appendMany', matches }, provenance });
  await RF.commit(backend, p);
  const after = await read();
  assert.deepStrictEqual(after.matches.filter((m) => m.rotation).map((m) => m.rotation.part).sort(), [1, 2, 3]);
  const players = {}; after.players.forEach((x) => { players[x.id] = x; });
  assert.strictEqual(BD.run({ players, matches: after.matches, journey: after.journey }).healthy, true);
  assert.strictEqual(RF.verifyNoOp(after, provenance).identical, true);
  const life = (rec, id) => rec.players.find((x) => x.id === id).lifetimeMatches;
  assert.strictEqual(life(after, k), life(before, k) + 1, 'one match for the session');
});


maybe('Admin records a rotation: a tie-break is a set, ratings move, tables do not, it has its own section and head to head lists it as history', async () => {
  const app = await H.open({ now: '2026-09-30T10:00:00.000Z', viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click(); gamesMonth = 'all';
      const [K, A, D, N] = ['Max', 'Jords', 'PDM', 'Stormzy'];
      const played = (x) => matchesIncludingDraws().filter((m) => m.winners.includes(x) || m.losers.includes(x)).length;
      const before = { played: [K, A, D, N].map(played), ratings: [K, A, D, N].map((x) => PLAYERS.find((p) => p.name === x).rating), race: JSON.stringify(buildMonthlyRace('2026-09').table.map((x) => [x.playerId, x.played])) };
      addGameExpanded = false; renderGamesTab();
      document.getElementById('addGameToggle').click();
      document.querySelector('[data-add-kind="rotation"]').click();
      document.getElementById('rotationDate').value = '2026-09-29';
      const rows = [...document.querySelectorAll('[data-rot-row]')];
      const fill = (row, a1, a2, b1, b2, score) => { const set = (k, v) => { row.querySelector(`[data-rot="${k}"]`).value = v; }; set('a1', a1); set('a2', a2); set('b1', b1); set('b2', b2); set('score', score); };
      fill(rows[0], K, A, D, N, '4-6');
      fill(rows[1], K, D, A, N, '6-3');
      fill(rows[2], K, N, A, D, '6-2 10-6');
      await stageRotation();
      const preview = document.getElementById('gamesView').innerText;
      await commitRotation();
      await new Promise((res) => setTimeout(res, 50));
      renderGamesTab();
      gamesMonth = '2026-09'; renderGamesTab();
      const card = document.querySelector('#gamesView .rot-card') ? document.querySelector('#gamesView .rot-card').innerText : '';
      // On its day, among the games: the day heading comes just before it.
      const head = document.querySelector('#gamesView .rot-card').previousElementSibling.innerText;
      const after = { played: [K, A, D, N].map(played), ratings: [K, A, D, N].map((x) => PLAYERS.find((p) => p.name === x).rating), race: JSON.stringify(buildMonthlyRace('2026-09').table.map((x) => [x.playerId, x.played])) };
      const sess = rotationSessions()[0];
      const stats = rotationStats(sess);
      h2hPlayerA = K; h2hPlayerB = N; h2hMonth = 'all';
      renderH2H();
      const h2h = document.getElementById('h2hView') ? document.getElementById('h2hView').innerText : document.body.innerText;
      // Rankings: games and, beside them, rotations (Shaun, 18 Nov).
      document.querySelector('#tabrow .tab-btn[data-tab="power"]').click(); selectedMonth = 'all'; recomputeAll();
      const metaOf = (x) => { const row = [...document.querySelectorAll('.row')].find((el) => el.querySelector('.nm') && el.querySelector('.nm').textContent === x); return row ? row.querySelector('.meta').textContent : ''; };
      const rankMeta = { max: metaOf(K), other: metaOf('Rhys') };
      // Removed again, exactly: ratings back where they were.
      const ratingsWith = [K, A, D, N].map((x) => PLAYERS.find((p) => p.name === x).rating);
      document.querySelector('[data-rot-remove]').click();
      for (let k = 0; k < 100 && !rotationRemove; k++) await new Promise((res) => setTimeout(res, 20));
      document.querySelector('[data-rot-remove-yes]').click();
      for (let k = 0; k < 100 && !/removed/.test(rotationMessage); k++) await new Promise((res) => setTimeout(res, 20));
      const removed = { left: rotationSessions().length, ratings: [K, A, D, N].map((x) => PLAYERS.find((p) => p.name === x).rating), ratingsWith };
      return { rankMeta, head, removed, preview, card, before, after, parts: sess.parts.map((m) => [m.winners, m.sets, m.rotation.weight]), stats: [K, A, D, N].map((x) => [stats[x].won, stats[x].lost]), h2h, wide: document.documentElement.scrollWidth };
    });
    assert.match(r.preview, /Max & Stormzy 6-2 1-0 Jords & PDM/, 'the tie-break is a set won, no games');
    assert.match(r.rankMeta.max, /^\d+ games · 1 rotation( · |$)/, r.rankMeta.max);
    assert.doesNotMatch(r.rankMeta.other, /rotation/, 'nothing said for a player with none');
    assert.match(r.preview, /each worth 1\/3 of a match/);
    assert.match(r.head, /29 Sep/i);
    assert.strictEqual(r.removed.left, 0);
    r.removed.ratings.forEach((x, i) => assert.ok(Math.abs(x - r.before.ratings[i]) < 1e-6, 'removing it puts every rating back'));
    assert.deepStrictEqual(r.parts.map((p) => [p[0], p[1]]), [[['PDM', 'Stormzy'], [[6, 4]]], [['Max', 'PDM'], [[6, 3]]], [['Max', 'Stormzy'], [[6, 2], [1, 0]]]]);
    assert.ok(r.parts.every((p) => Math.abs(p[2] - 1 / 3) < 1e-12));
    assert.deepStrictEqual(r.after.played, r.before.played, 'no table counts it');
    assert.strictEqual(r.after.race, r.before.race, 'nor the race');
    assert.ok(r.after.ratings.some((x, i) => x !== r.before.ratings[i]), 'ratings move');
    assert.deepStrictEqual(r.stats, [[3, 1], [0, 4], [2, 2], [3, 1]], 'Max 3-1, Jords 0-4, PDM 2-2, Stormzy 3-1 in sets');
    assert.match(r.card, /Rotation · 3 pairings/i);
    assert.match(r.card, /Max 3–1 sets/);
    assert.match(r.h2h, /In rotations/);
    assert.match(r.h2h, /Max & Stormzy 6-2 1-0 Jords & PDM\s*Together/);
    assert.match(r.h2h, /PDM & Stormzy 4-6 Max & Jords|PDM & Stormzy 6-4 Max & Jords/);
    assert.strictEqual(r.wide, 390);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('games already entered can be made a rotation: they leave the tables and keep their scores', async () => {
  const app = await H.open({ now: '2026-09-30T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click(); gamesMonth = 'all';
      const byDate = {};
      getAllApprovedMatches().filter((m) => m.winners.length === 2 && !m.forfeit && !m.late).forEach((m) => { (byDate[m.date] = byDate[m.date] || []).push(m); });
      const date = Object.keys(byDate).filter((d) => byDate[d].length >= 2).sort().slice(-1)[0];
      const games = byDate[date].slice(0, 2);
      const total = getAllApprovedMatches().length;
      addGameExpanded = true; addGameKind = 'rotation'; ensureRotationDraft(); renderGamesTab();
      const dateBox = document.getElementById('rotationDate');
      dateBox.value = date; dateBox.dispatchEvent(new Event('change'));
      games.forEach((g) => { document.querySelector(`[data-rot-convert][value="${g.id}"]`).checked = true; });
      await stageRotation();
      await commitRotation();
      await new Promise((res) => setTimeout(res, 50));
      const sess = rotationSessions().find((s) => s.date === date);
      return { total, after: getAllApprovedMatches().length, ids: sess ? sess.parts.map((m) => m.id).sort() : null, want: games.map((g) => g.id).sort(),
        scores: sess ? sess.parts.map((m) => JSON.stringify(m.sets)).sort() : null, wantScores: games.map((g) => JSON.stringify(g.sets)).sort(), msg: rotationMessage };
    });
    assert.match(r.msg, /^Rotation recorded\./);
    assert.strictEqual(r.after, r.total - 2, 'out of the tables');
    assert.deepStrictEqual(r.ids, r.want);
    assert.deepStrictEqual(r.scores, r.wantScores);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a rotation can be corrected: Edit fills the form, a wrong score is fixed, the same pairings are re-rated as if entered right', async () => {
  const run = (fixFirst) => H.open({ now: '2026-09-30T10:00:00.000Z' }).then(async (app) => {
    try {
      return await app.run(async (fix) => {
        isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
        document.querySelector('#tabrow .tab-btn[data-tab="games"]').click(); gamesMonth = 'all';
        addGameExpanded = true; addGameKind = 'rotation'; ensureRotationDraft(); rotationDraft.date = '2026-09-29'; renderGamesTab();
        const rows = [...document.querySelectorAll('[data-rot-row]')];
        const fill = (row, v) => ['a1', 'a2', 'b1', 'b2', 'score'].forEach((k, i) => { row.querySelector(`[data-rot="${k}"]`).value = v[i]; });
        fill(rows[0], ['Max', 'Jords', 'PDM', 'Stormzy', '4-6']);
        fill(rows[1], ['Max', 'PDM', 'Jords', 'Stormzy', '6-3']);
        fill(rows[2], ['Max', 'Stormzy', 'Jords', 'PDM', fix ? '6-2 10-6' : '6-2']);
        await stageRotation(); await commitRotation();
        await new Promise((res) => setTimeout(res, 50));
        const idsBefore = rotationSessions()[0].parts.map((m) => m.id);
        let form = null;
        if (!fix) {
          gamesMonth = 'all'; renderGamesTab();
          document.querySelector('[data-rot-edit]').click();
          form = [...document.querySelectorAll('[data-rot-row]')].map((row) => [...row.querySelectorAll('[data-rot]')].map((i) => i.value));
          document.querySelectorAll('[data-rot-row]')[2].querySelector('[data-rot="score"]').value = '6-2 10-6';
          await stageRotation();
          const preview = document.getElementById('gamesView').innerText;
          await commitRotation();
          await new Promise((res) => setTimeout(res, 50));
          form = { form, preview: /Preview changes/.test(preview) || /Confirm/.test(preview) };
        }
        const s = rotationSessions()[0];
        return { form, msg: rotationMessage, ids: s.parts.map((m) => m.id), idsBefore, count: rotationSessions().length,
          sets: s.parts.map((m) => m.sets), ratings: ['Max', 'Jords', 'PDM', 'Stormzy'].map((x) => PLAYERS.find((p) => p.name === x).rating) };
      }, fixFirst);
    } finally { await app.close(); }
  });
  const corrected = await run(false);
  const rightFirstTime = await run(true);
  assert.deepStrictEqual(corrected.form.form, [['PDM', 'Stormzy', 'Max', 'Jords', '6-4'], ['Max', 'PDM', 'Jords', 'Stormzy', '6-3'], ['Max', 'Stormzy', 'Jords', 'PDM', '6-2']], 'filled in as stored, winners first');
  assert.strictEqual(corrected.msg, 'Rotation corrected.');
  assert.deepStrictEqual(corrected.ids, corrected.idsBefore, 'the same pairings, corrected in place');
  assert.strictEqual(corrected.count, 1);
  assert.deepStrictEqual(corrected.sets[2], [[6, 2], [1, 0]]);
  corrected.ratings.forEach((x, i) => assert.ok(Math.abs(x - rightFirstTime.ratings[i]) < 1e-9, 'exactly as if entered right first time'));
});
