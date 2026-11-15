// ===================== COURTS BOOKED, PLAYERS TO CONFIRM =====================
// Shaun, 15 Nov: "I also need somewhere to add where courts have been booked
// but games are yet to be confirmed." Admin adds and fills; four names make
// it an ordinary booked game.

const test = require('node:test');
const assert = require('node:assert');
const CB = require('../assets/js/domain/fixtures/courtBookings.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-21T10:00:00.000Z';   // a Monday: next week is 28 Sep – 4 Oct

test('a court needs a date, takes up to four different names, and says how many it needs', () => {
  assert.strictEqual(CB.problem({ date: '', players: [] }), 'no-date');
  assert.strictEqual(CB.problem({ date: '2026-09-29', players: ['A', 'B', 'C', 'D', 'E'] }), 'too-many');
  assert.strictEqual(CB.problem({ date: '2026-09-29', players: ['Max', 'max'] }), 'duplicate');
  assert.strictEqual(CB.problem({ date: '2026-09-29', players: [] }), null, 'no names yet is fine');
  const c = CB.create({ date: '2026-09-29', time: '19:00', venue: ' Padel Haus ', players: ['Shaun', ' ', 'Max'], by: 'Shaun', at: NOW });
  assert.deepStrictEqual(c.players, ['Shaun', 'Max']);
  assert.strictEqual(c.venue, 'Padel Haus');
  assert.strictEqual(CB.needed(c), 2);
  assert.strictEqual(CB.namesLine(c), 'Shaun, Max + 2 needed');
  assert.strictEqual(CB.namesLine({ players: [] }), '4 players needed');
  CB.update(c, { date: '2026-09-30', players: ['Shaun', 'Max', 'KC', 'Tom'], by: 'Shaun', at: NOW });
  assert.ok(CB.isFull(c));
  assert.deepStrictEqual(c.history.map((h) => h.action), ['added', 'edited']);
  const sorted = [{ id: 'b', date: '2026-09-29' }, { id: 'a', date: '2026-09-29', time: '18:00' }, { id: 'c', date: '2026-09-28' }].sort(CB.order);
  assert.deepStrictEqual(sorted.map((x) => x.id), ['c', 'a', 'b']);
});

maybe('admin adds a booked court with two names, everyone sees it needs two, and four names make it a booked game', async () => {
  const app = await H.open({ now: NOW });
  try {
    const r = await app.run(async () => {
      const settle = () => new Promise((res) => setTimeout(res, 30));
      const goUpcoming = () => { document.querySelector('#tabrow .tab-btn[data-tab="findgame"]').click(); document.querySelector('#tabrow .tab-btn[data-tab="upcoming"]').click(); };
      isUnlocked = true; currentUserName = 'Shaun';
      goUpcoming();
      document.getElementById('courtAddToggle').click();
      const set = (id, v) => { document.getElementById(id).value = v; };
      // No date: refused, in words.
      document.getElementById('courtSave').click(); await settle();
      const noDate = document.getElementById('courtMsg').textContent;
      set('courtDate', '2026-09-29'); set('courtTime', '19:00'); set('courtVenue', 'Padel Haus');
      set('courtP1', 'Shaun'); set('courtP2', 'Max');
      document.getElementById('courtSave').click(); await settle();
      const card = document.querySelector('.court-card');
      const added = { text: card && card.textContent, stored: window.__writes.filter((w) => w.id === 'moneypadel_court_bookings').length };
      // A member sees it too, without the admin buttons.
      isUnlocked = false; renderUpcoming();
      const member = { card: !!document.querySelector('.court-card'), edit: !!document.querySelector('.court-edit'), add: !!document.getElementById('courtAddToggle') };
      isUnlocked = true; renderUpcoming();
      // Fill it: four names, an ordinary booked game in Upcoming, and the court goes.
      document.querySelector('.court-edit').click();
      const prefilled = document.getElementById('courtP2').value;
      set('courtP3', 'KC'); set('courtP4', 'Tom');
      document.getElementById('courtSave').click(); await settle();
      const game = gameRequestsState.at(-1);
      const stage = FixtureFlow.stage(game, new Date().toISOString());
      return { noDate, added, member, prefilled, courts: courtBookingsState.length, game: { players: game.players, date: game.preferredDate, time: game.preferredTime, venue: game.location, booked: game.courtBookingMade }, stage,
        upcoming: document.getElementById('upFoldUpcomingBody').textContent.includes('Shaun') };
    });
    assert.match(r.noDate, /Choose the date/);
    assert.match(r.added.text, /Shaun, Max \+ 2 needed/);
    assert.match(r.added.text, /Needs 2/);
    assert.match(r.added.text, /19:00 · Padel Haus/);
    assert.ok(r.added.stored >= 1, 'saved in its own document');
    assert.deepStrictEqual(r.member, { card: true, edit: false, add: false });
    assert.strictEqual(r.prefilled, 'Max');
    assert.strictEqual(r.courts, 0, 'the court record goes once it is a game');
    assert.deepStrictEqual(r.game, { players: ['Shaun', 'Max', 'KC', 'Tom'], date: '2026-09-29', time: '19:00', venue: 'Padel Haus', booked: true });
    assert.strictEqual(r.stage, 'upcoming');
    assert.ok(r.upcoming);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a court is removed only on the second tap', async () => {
  const court = { id: 'court_1', date: '2026-09-30', time: '', venue: '', players: ['Len'], createdBy: 'Shaun', createdAt: NOW, history: [] };
  const app = await H.open({ now: NOW, club: { moneypadel_court_bookings: [court] } });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Shaun';
      document.querySelector('#tabrow .tab-btn[data-tab="findgame"]').click(); document.querySelector('#tabrow .tab-btn[data-tab="upcoming"]').click();
      const loaded = courtBookingsState.length;
      document.querySelector('.court-remove').click();
      const armed = document.querySelector('.court-remove').textContent;
      const still = courtBookingsState.length;
      document.querySelector('.court-remove').click();
      await new Promise((res) => setTimeout(res, 30));
      return { loaded, armed, still, after: courtBookingsState.length, msg: (document.getElementById('courtFlash') || {}).textContent };
    });
    assert.strictEqual(r.loaded, 1);
    assert.match(r.armed, /Tap again/);
    assert.strictEqual(r.still, 1);
    assert.strictEqual(r.after, 0);
    assert.match(r.msg, /Court removed/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 15 Nov: "I want the weekly recap to link to upcoming games so I can
// share that with the group" -- answered: put the fixtures in the recap.
maybe('next week\'s fixtures, booked courts included, go out with the recap picture and text unless unticked', async () => {
  const court = { id: 'court_1', date: '2026-09-30', time: '20:00', venue: 'Padel Haus', players: ['Len', 'Kaz'], createdBy: 'Shaun', createdAt: NOW, history: [] };
  const app = await H.open({ now: NOW, club: { moneypadel_court_bookings: [court] } });
  try {
    const r = await app.run(async () => {
      const shared = [], copied = [];
      CardPainter.share = async (files) => { shared.push(files[0].name); return 'shared'; };
      window.copyText = async (t) => { copied.push(t); return true; };
      gameRequestsState = [FixtureFlow.createAgreed({ id: 'fx-a', players: ['Shaun', 'Max', 'KC', 'Tom'], by: 'Shaun', at: '2026-09-20T09:00:00.000Z', preferredDate: '2026-09-29', courtBookingMade: true })];
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      summaryMode = 'weekly'; renderSummary();
      const list = [...document.querySelectorAll('#recapFixtures .recap-game')].map((x) => x.textContent);
      const label = document.querySelector('.recap-with-fixtures').textContent;
      document.getElementById('recapCopy').click(); await new Promise((res) => setTimeout(res, 30));
      const both = await buildRecapPicture('both', recapData().recap);
      const withH = await createImageBitmap(both.file).then((b) => b.height);
      const box = document.getElementById('recapWithFixtures');
      box.checked = false; box.dispatchEvent(new Event('change'));
      document.getElementById('recapCopy').click(); await new Promise((res) => setTimeout(res, 30));
      const without = await buildRecapPicture('both', recapData().recap);
      const withoutH = await createImageBitmap(without.file).then((b) => b.height);
      return { list, label, copied, withH, withoutH, kept: localStorage.getItem('recapWithFixtures') };
    });
    assert.strictEqual(r.list.length, 2);
    assert.match(r.list[1], /Court booked: Len, Kaz \+ 2 needed.*20:00 · Padel Haus.*Needs 2/);
    assert.match(r.label, /next week’s fixtures \(1 game · 1 court needing players\)/);
    assert.match(r.copied[0], /📆 Next week's fixtures · 28 Sep – 4 Oct 2026\nTue 29 Sep\n {2}Shaun & Max vs KC & Tom/);
    assert.match(r.copied[0], /Wed 30 Sep\n {2}Court booked · 20:00 · Padel Haus · Len, Kaz \+ 2 needed/);
    assert.ok(!/fixtures/.test(r.copied[1]), 'unticked: left off the text');
    assert.ok(r.withH > r.withoutH + 200, 'and off the picture');
    assert.strictEqual(r.kept, 'off');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
