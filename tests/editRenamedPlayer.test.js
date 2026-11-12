// ===================== EDIT GAME WITH A RENAMED PLAYER =====================
// Shaun, 12 Nov: "Save changes isn't showing the next stage right after
// pressing the button. Not sure where it's went." The game had Stormzy, now
// shown as "Stormz": the editor filled in the display name, the correction
// was planned with it, and the record refused "Stormz" as a player it did
// not know -- in a message at the top of the screen, out of sight.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

function renamed(id, shown) {
  const r = H.fixture();
  r.players = r.players.map((p) => (p.id === id ? { ...p, displayName: shown, previousDisplayNames: [id] } : p));
  return r;
}

maybe('a game with a renamed player is corrected under their identity, and the confirmation is brought into view', async () => {
  const app = await H.open({ record: renamed('Stormzy', 'Stormz'), viewport: { width: 390, height: 844 }, now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun'; gamesMonth = 'all';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      const m = getAllApprovedMatches().filter((x) => !x.isDraw && x.winners.concat(x.losers).includes('Stormz') && !x.forfeit).slice(-1)[0];
      managingGameId = m.id; renderGamesTab();
      openGameEditor(m.id);
      const shown = ['edA1', 'edA2', 'edB1', 'edB2'].map((i) => document.getElementById(i).value);
      document.getElementById('edSubmit').click();
      for (let k = 0; k < 150 && !matchFixPlan && !/club yet|fail/i.test(matchFixMessage || ''); k++) await new Promise((res) => setTimeout(res, 20));
      await new Promise((res) => setTimeout(res, 100));
      const btn = document.getElementById('matchFixCommitBtn');
      const rect = btn && btn.getBoundingClientRect();
      return { shown, planned: !!matchFixPlan, msg: matchFixMessage, inView: !!rect && rect.top >= 0 && rect.bottom <= innerHeight };
    });
    assert.ok(r.shown.includes('Stormz'), 'the form shows the name everyone sees');
    assert.strictEqual(r.msg, '', r.msg);
    assert.strictEqual(r.planned, true, 'the correction is staged, not refused');
    assert.ok(r.inView, 'the confirmation is on screen');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a refused correction says why beside Save changes, not only at the top of the screen', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun'; gamesMonth = 'all';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      const m = getAllApprovedMatches().filter((x) => !x.isDraw && !x.forfeit).slice(-1)[0];
      managingGameId = m.id; renderGamesTab();
      openGameEditor(m.id);
      document.getElementById('edA1').value = 'Nobody Known';
      document.getElementById('edSubmit').click();
      for (let k = 0; k < 150 && !/club yet/i.test(matchFixMessage || ''); k++) await new Promise((res) => setTimeout(res, 20));
      await new Promise((res) => setTimeout(res, 100));
      const near = document.getElementById('edMessage');
      const rect = near.getBoundingClientRect();
      return { near: near.innerText, inView: rect.top >= 0 && rect.bottom <= innerHeight };
    });
    assert.match(r.near, /Nobody Known isn’t in the club yet/);
    assert.ok(r.inView, 'and it is on screen');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
