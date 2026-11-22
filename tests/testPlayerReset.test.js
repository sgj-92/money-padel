// ===================== RESET A TEST PLAYER TO NEW =====================
// Shaun, 22 Nov: "I made an account called Test Account, allow me to
// continuously reset that account to new so I can refine the UX for new
// players."

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const EMPTY = { players: [], matches: [], ratingJourney: [] };
const ADMIN = { accounts: { 'shaun@example.com': { password: 'pw', uid: 'uid-shaun' } }, admins: { 'uid-shaun': { role: 'owner', name: 'Shaun' } } };
const T = 'Test Account';
const req = (id, by, players) => ({ id, requestedBy: by, requestedAt: '2026-11-20T10:00:00.000Z', players, confirmations: {}, status: 'pending' });

maybe('only a test player can be reset; it clears what they set up and asked for, quietly, with a fresh code', async () => {
  const app = await H.open({
    path: 'index.html?club=padelchampionships', record: EMPTY, ...ADMIN, signedIn: 'shaun@example.com',
    club: {
      moneypadel_player_tags: { Shaun: { tier: 'A', active: true }, Kaz: { tier: 'A', active: true }, Len: { tier: 'B', active: true }, Max: { tier: 'B', active: true }, [T]: { tier: 'C', active: true } },
      moneypadel_game_requests: [req('r1', T, [T, 'Kaz', 'Len', 'Max']), req('r2', 'Kaz', ['Kaz', T, 'Len', 'Max']), req('r3', 'Kaz', ['Kaz', 'Shaun', 'Len', 'Max'])],
      moneypadel_court_bookings: [{ id: 'c1', date: '2026-11-30', time: '', venue: '', players: ['Kaz', T], history: [] }],
    },
    documents: {
      playerCodes: { [T]: { code: 'AAAABBBB', uid: 'uid-test', email: 'pold@players.sgj.luxe' }, Kaz: { code: 'CCCCDDDD', uid: 'uid-kaz', email: 'pkaz@players.sgj.luxe' } },
      playerLogins: { [T]: { email: 'pold@players.sgj.luxe', own: true }, Kaz: { email: 'pkaz@players.sgj.luxe', own: false } },
      playerAccounts: { 'uid-test': { player: T }, 'uid-kaz': { player: 'Kaz' } },
      availability: { [T]: { unit: 'half', weekly: { mon: [18, 18.5] }, exceptions: [] }, Kaz: { unit: 'half', weekly: { tue: [9] }, exceptions: [] } },
      pushSubscriptions: { s1: { player: T, endpoint: 'https://push/1' }, s2: { player: 'Kaz', endpoint: 'https://push/2' } },
    },
  });
  try {
    const r = await app.run(async (T) => {
      for (let k = 0; k < 100 && !signedInAdmin; k++) await new Promise((res) => setTimeout(res, 20));
      isUnlocked = true; adminRole = 'owner';
      const notified = []; const realFetch = window.fetch;
      window.fetch = async (url, o) => { if(String(url).includes('/api/notify')) notified.push(o.body); return realFetch(url, o); };
      window.confirm = () => true;
      document.querySelector('#tabrow .tab-btn[data-tab="manage"]').click();
      adminOpenSections.playercodes = true; renderManage();
      for (let k = 0; k < 100 && playerCodesState === null; k++) await new Promise((res) => setTimeout(res, 20));
      const buttons = [...document.querySelectorAll('[data-pc-reset]')].map((b) => b.dataset.pcReset);
      const direct = await resetPlayerToNew('Kaz', playerCodesState.Kaz);
      window.__writes.length = 0;
      document.querySelector(`[data-pc-reset="${T}"]`).click();
      for (let k = 0; k < 200 && !/new again/.test(playerCodesNote); k++) await new Promise((res) => setTimeout(res, 20));
      await new Promise((res) => setTimeout(res, 100));
      const w = window.__writes;
      return {
        buttons, direct, note: playerCodesNote, code: playerCodesState[T].code,
        oldGone: w.some((x) => x.collection === 'playerAccounts' && x.id === 'uid-test' && x.deleted),
        login: w.filter((x) => x.collection === 'playerLogins' && x.id === T).pop().doc,
        hoursGone: w.some((x) => x.collection === 'availability' && x.id === T && x.deleted),
        kazHours: !!availabilityState.Kaz, testHours: !!availabilityState[T],
        phones: w.filter((x) => x.collection === 'pushSubscriptions' && x.deleted).map((x) => x.id),
        games: gameRequestsState.map((q) => q.id),
        court: courtBookingsState[0].players,
        notified,
      };
    }, T);
    assert.deepStrictEqual(r.buttons, [T], 'only the test player has the button');
    assert.strictEqual(r.direct.ok, false, 'a real player is never reset');
    assert.match(r.note, /Test Account is new again\. Code: \w{4}-\w{4}\. Hours cleared; removed 2 games, 1 court seat, 1 phone for notifications\./);
    assert.notStrictEqual(r.code, 'AAAABBBB');
    assert.ok(r.oldGone, 'the old code (and any phone signed in with it) stops working');
    assert.strictEqual(r.login.own, false);
    assert.ok(r.login.resetAt, 'their next sign-in shows Get started again');
    assert.ok(r.hoursGone && !r.testHours && r.kazHours);
    assert.deepStrictEqual(r.phones, ['s1']);
    assert.deepStrictEqual(r.games, ['r3']);
    assert.deepStrictEqual(r.court, ['Kaz']);
    assert.deepStrictEqual(r.notified, [], 'nobody is told about the games taken away');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a hidden Get started list comes back after a reset, not before', async () => {
  const app = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY });
  try {
    const r = await app.run(() => {
      const name = 'Test Account';
      hideStarter(name);
      forgetStarterBefore(name, null);
      const keptWithoutReset = starterHidden(name);
      forgetStarterBefore(name, '2000-01-01T00:00:00.000Z');
      const keptOldReset = starterHidden(name);
      forgetStarterBefore(name, '2999-01-01T00:00:00.000Z');
      return { keptWithoutReset, keptOldReset, afterReset: starterHidden(name) };
    });
    assert.deepStrictEqual(r, { keptWithoutReset: true, keptOldReset: true, afterReset: false });
  } finally { await app.close(); }
});
