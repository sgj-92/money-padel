// ===================== SWAP TEAMS =====================
// Shaun, 11 Nov: "Allow me to quickly switch the teams if I've placed the
// winners and losers in the wrong box." One tap swaps the two pairs and every
// set score with them, so each score stays with the pair that won it.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

maybe('Add a game: Swap teams puts the pairs and their scores the other way round', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      const [a, b, c, d] = PLAYERS.slice(0, 4).map((p) => p.name);
      const set = (id, v) => { document.getElementById(id).value = v; };
      set('agA1', a); set('agA2', b); set('agB1', c); set('agB2', d);
      document.getElementById('agAddSet').click();   // two rows to start; a third
      const vals = [4, 6, 6, 2, 2, 6];
      document.querySelectorAll('#agSets input').forEach((el, i) => { el.value = vals[i]; el.dispatchEvent(new Event('input', { bubbles: true })); });
      document.getElementById('agSwapTeams').click();
      const read = () => ({ teams: ['agA1', 'agA2', 'agB1', 'agB2'].map((id) => document.getElementById(id).value),
        sets: [...document.querySelectorAll('#agSets input')].map((el) => el.value), state: addGameSets.map((s) => [s.w, s.l]) });
      return { names: [a, b, c, d], after: read() };
    });
    const [a, b, c, d] = r.names;
    assert.deepStrictEqual(r.after.teams, [c, d, a, b]);
    assert.deepStrictEqual(r.after.sets, ['6', '4', '2', '6', '6', '2'], 'each score stays with its pair');
    assert.deepStrictEqual(r.after.state, [['6', '4'], ['2', '6'], ['6', '2']], 'and that is what gets submitted');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('Edit a game: Swap teams does the same', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      selectedMonth = 'all';
      const m = getAllApprovedMatches().filter((x) => !x.isDraw && x.winners.length === 2).slice(-1)[0];
      openGameEditor(m.id);
      const sets = editSets.map((s) => s.slice());
      document.getElementById('edSwapTeams').click();
      return { m: { winners: m.winners, losers: m.losers }, sets,
        teams: ['edA1', 'edA2', 'edB1', 'edB2'].map((id) => document.getElementById(id).value),
        after: editSets, shown: [...document.querySelectorAll('#edSets input')].map((el) => Number(el.value)) };
    });
    assert.deepStrictEqual(r.teams, r.m.losers.concat(r.m.winners));
    assert.deepStrictEqual(r.after, r.sets.map(([x, y]) => [y, x]));
    assert.deepStrictEqual(r.shown, r.after.flat());
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
