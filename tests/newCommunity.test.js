// ===================== A NEW COMMUNITY'S FIRST DAY =====================
// Padel Championships starts with an empty record (config/club.js
// recordStartsEmpty). Empty is a start, not a failed read: every screen draws,
// an Admin adds the players with their tiers, and the first approved game
// starts the record. For Money Padel an empty record is still refused.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');
const V3 = require('../assets/js/v3Bridge.js');
const Store = require('../assets/js/ratingStore.js');

const maybe = H.available() ? test : test.skip;
const EMPTY = { players: [], matches: [], ratingJourney: [] };

test('an empty record is refused for a community that has one, and is a start for a new community', async () => {
  const backend = Store.memoryBackend();
  const strict = await V3.load(backend);
  assert.match(strict.error, /players collection is empty/);
  const fresh = await V3.load(backend, { allowEmpty: true });
  assert.deepStrictEqual([fresh.loaded, fresh.error, fresh.playerCount], [true, null, 0]);
  await assert.rejects(V3.loadMatches(backend, null, null), /matches collection is empty/);
  assert.deepStrictEqual(await V3.loadMatches(backend, null, null, { allowEmpty: true }), []);
});

maybe('day one: every screen draws with nobody in it; players are added; the first approved game starts the record', async () => {
  const app = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, now: '2026-11-10T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      const seen = {};
      for (const tab of ['summary', 'power', 'games']) {
        const b = typeof legacyTabBtn === 'function' ? legacyTabBtn(tab) : null;
        if (b) b.click();
        await new Promise((res) => setTimeout(res, 50));
        seen[tab] = true;
      }
      const empty = { loaded: V3_STATE.loaded, players: PLAYERS.length, banner: /unavailable/i.test(document.body.innerText) };
      // Admin adds the four players with their starting tiers.
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      tagOverridesState = { Amir: { tier: 'A', active: true }, Bilal: { tier: 'A', active: true }, Chris: { tier: 'B', active: true }, Dev: { tier: 'B', active: true } };
      extraMatchesState.push({ id: 'sub_1', date: '2026-11-09', winners: ['Amir', 'Bilal'], losers: ['Chris', 'Dev'], sets: [[6, 3], [6, 4]],
        type: 'doubles', note: '', status: 'pending', submittedBy: 'Shaun', submittedAt: '2026-11-09T20:00:00Z' });
      legacyTabBtn('games').click();
      await prepareApproval('sub_1');
      const planned = approvalMessage;
      await commitApproval();
      return { empty, planned, message: approvalMessage, players: PLAYERS.map((p) => [p.name, p.tier, Math.round(p.rating)]).sort(),
        matches: matchesIncludingDraws().length, period: monthLabel(currentMonthKey()) };
    });
    assert.deepStrictEqual(r.empty, { loaded: true, players: 0, banner: false }, 'nobody yet, and nothing reads as broken');
    assert.strictEqual(r.planned, '', r.planned);
    assert.match(r.message, /^Rated as 2026-11-09-1\./);
    assert.deepStrictEqual(r.players.map((p) => p.slice(0, 2)), [['Amir', 'A'], ['Bilal', 'A'], ['Chris', 'B'], ['Dev', 'B']]);
    assert.strictEqual(r.matches, 1);
    assert.strictEqual(r.period, 'Oct–Dec 2026');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
