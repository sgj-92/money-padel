// ===================== GETTING STARTED =====================
// Shaun, 20 Nov: "a profile starter checklist when people first log in. This
// asks them to set their playing hours up and request a game with someone
// (this part is optional)."

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const EMPTY = { players: [], matches: [], ratingJourney: [] };
const TAGS = { moneypadel_player_tags: { Kaz: { tier: 'A', active: true }, Len: { tier: 'B', active: true }, Max: { tier: 'B', active: true }, Tom: { tier: 'B', active: true } } };

maybe('first sign-in shows the checklist; each step ticks itself off; Hide puts it away for good', async () => {
  const email = 'pkazkazkaz1@players.sgj.luxe';
  const app = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, club: TAGS, now: '2026-11-20T10:00:00.000Z',
    accounts: { [email]: { password: '472915', uid: 'uid-kaz' } },
    documents: { playerAccounts: { 'uid-kaz': { player: 'Kaz' } }, playerLogins: { Kaz: { email, own: true } } } });
  try {
    const r = await app.run(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      buildViewerSelector();
      document.querySelector('.viewer-player-btn[data-name="Kaz"]').click();
      document.getElementById('playerCodeInput').value = '472915';
      document.getElementById('playerCodeGo').click();
      for (let k = 0; k < 100 && !document.querySelector('#starterSheet.show'); k++) await wait(20);
      const steps = () => [...document.querySelectorAll('#starterSheet [data-starter-step]')].map((b) => `${b.dataset.starterStep}:${b.classList.contains('is-done') ? 'done' : 'todo'}${/optional/.test(b.textContent) ? ':optional' : ''}`);
      const first = steps();
      // Hours: the step opens the sheet; saved, it is done.
      document.querySelector('#starterSheet [data-starter-step="hours"]').click();
      const hoursOpened = document.querySelector('#availabilitySheet.show h3').textContent;
      document.querySelector('#availabilitySheet [data-av-col="mon"]').click();
      document.querySelector('#availabilitySheet .av-save').click();
      await wait(50);
      // A request made: that step is done too.
      await submitGameRequest({ names: ['Kaz', 'Len', 'Max', 'Tom'], requestedBy: 'Kaz' });
      openStarterSheet('Kaz');
      const after = steps();
      const sub = document.querySelector('#starterSheet .starter-sub').textContent;
      document.querySelector('#starterSheet .starter-hide').click();
      const wantedAfterHide = starterWanted('Kaz');
      return { first, hoursOpened, after, sub, wantedAfterHide, kept: localStorage.getItem('starterChecklistHidden:padelchampionships:Kaz') };
    });
    assert.deepStrictEqual(r.first, ['hours:todo', 'notify:todo:optional', 'request:todo:optional'], 'playing hours, and two optional steps');
    assert.strictEqual(r.hoursOpened, 'When I can play');
    assert.deepStrictEqual(r.after, ['hours:done', 'notify:todo:optional', 'request:done:optional']);
    assert.match(r.sub, /All set/);
    assert.strictEqual(r.wantedAfterHide, false);
    assert.ok(r.kept, 'remembered on this phone (when, so a reset can bring it back)');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('nobody else is shown it: not a player browsing without a code, not Money Padel', async () => {
  const app = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, club: TAGS });
  try {
    const r = await app.run(() => ({ kaz: starterWanted('Kaz') }));
    assert.deepStrictEqual(r, { kaz: false });
  } finally { await app.close(); }
  const mp = await H.open({});
  try {
    const r = await mp.run(() => ({ shaun: starterWanted('Shaun') }));
    assert.deepStrictEqual(r, { shaun: false });
  } finally { await mp.close(); }
});

// Shaun, 26 Nov: "Notifications are on but I cannot tick this button." This
// phone had notifications on but wasn't on the list under his name.
maybe('notifications on for this phone but not on the list: the step ticks, and the phone is listed under the player', async () => {
  const email = 'pkazkazkaz1@players.sgj.luxe';
  const app = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, club: TAGS, now: '2026-11-20T10:00:00.000Z',
    accounts: { [email]: { password: '472915', uid: 'uid-kaz' } }, signedIn: email,
    documents: { playerAccounts: { 'uid-kaz': { player: 'Kaz' } }, playerLogins: { Kaz: { email, own: true } } } });
  try {
    const r = await app.run(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      for (let k = 0; k < 100 && !signedInPlayer; k++) await wait(20);
      const sub = { endpoint: 'https://push.example/kaz-phone', toJSON: () => ({ endpoint: 'https://push.example/kaz-phone', keys: { p256dh: 'p', auth: 'a' } }) };
      currentPushSubscription = async () => sub;
      starterNotifyOn = null;
      const box = document.createElement('div');
      box.innerHTML = starterChecklistHtml('Kaz');
      document.body.appendChild(box);
      wireStarterChecklist(box);
      for (let k = 0; k < 100 && starterNotifyOn !== true; k++) await wait(20);
      const saved = window.__writes.filter((w) => w.collection === 'pushSubscriptions').map((w) => w.doc.player);
      return { on: starterNotifyOn, saved, step: starterSteps('Kaz').find((s) => s.key === 'notify').done };
    });
    assert.strictEqual(r.on, true);
    assert.deepStrictEqual(r.saved, ['Kaz'], 'put on the list under the player');
    assert.strictEqual(r.step, true);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
