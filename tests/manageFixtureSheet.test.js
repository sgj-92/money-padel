// ===================== MANAGE FIXTURE, IN THE GAME SHEET =====================
// Shaun, 28 Nov: "This screen needs to be visually enhanced. The tick isn't
// tickable, the sizing and formatting etc doesnt match the rest of the
// updated app. You can't see the names when you click manage fixture."

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-27T12:00:00.000Z';
const P4 = ['Shaun', 'Tom', 'Max', 'KC'];
const fixture = {
  id: 'fxM', requestedBy: 'Board', requestedAt: '2026-09-21T09:00:00.000Z', agreedAt: '2026-09-21T09:00:00.000Z',
  players: P4.slice(), teams: [['Shaun', 'Tom'], ['Max', 'KC']],
  preferredDate: '2026-09-29', preferredTime: '20:00', location: 'PadelX',
  confirmations: Object.fromEntries(P4.map((n) => [n, true])), status: 'confirmed', courtBookingMade: false,
};

maybe('the names show in full, answers are pills under them, the booking is a switch that stays as set through a redraw, and saves', async () => {
  const app = await H.open({ now: NOW, mobile: true, viewport: { width: 390, height: 844 }, club: { moneypadel_game_requests: [fixture] } });
  try {
    const r = await app.run(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      isUnlocked = true; currentUserName = 'Shaun';
      openGameSheet('fxM'); await wait(100);
      document.querySelector('#gameSheet .game-admin').click(); await wait(150);
      const panel = () => document.querySelector('#gameSheet .fx-manage');
      const seats = [...panel().querySelectorAll('.fx-m-seat')];
      const names = seats.map((s) => ({ v: s.value, wide: s.getBoundingClientRect().width }));
      const pills = [...panel().querySelectorAll('.fx-m-seat-card .seg-pills')].map((p) => p.textContent.replace(/\s+/g, ' ').trim());
      const sw = panel().querySelector('.fx-m-booked');
      const swBox = sw.getBoundingClientRect();
      // Tap the row's text, as a thumb would.
      panel().querySelector('.fx-m-switch-text').click();
      const tapped = panel().querySelector('.fx-m-booked').checked;
      panel().querySelector('.fx-m-venue').value = 'Rise';
      dataChanged(); await wait(100);   // a live update redraws the sheet
      const kept = { booked: panel().querySelector('.fx-m-booked').checked, venue: panel().querySelector('.fx-m-venue').value };
      panel().querySelector('.fx-m-save').click(); await wait(200);
      return { names, pills, swBox: [Math.round(swBox.width), Math.round(swBox.height)], tapped, kept, saved: [gameRequestsState[0].courtBookingMade, gameRequestsState[0].location],
        wide: document.documentElement.scrollWidth, appearance: getComputedStyle(sw).appearance };
    });
    assert.deepStrictEqual(r.names.map((n) => n.v), P4);
    assert.ok(r.names.every((n) => n.wide > 250), 'each name has the full width');
    assert.strictEqual(r.pills.length, 4);
    assert.ok(r.pills.every((p) => /In.*Waiting.*Backed out/.test(p)));
    assert.deepStrictEqual(r.swBox, [51, 31]);
    assert.ok(r.tapped, 'tapping the row ticks the switch');
    assert.deepStrictEqual(r.kept, { booked: true, venue: 'Rise' }, 'a redraw keeps what was set');
    assert.deepStrictEqual(r.saved, [true, 'Rise']);
    assert.strictEqual(r.wide, 390);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('Remove fixture: a thumb-sized button; the question comes into view; Remove takes it off and closes the sheet', async () => {
  const app = await H.open({ now: NOW, mobile: true, viewport: { width: 390, height: 844 }, club: { moneypadel_game_requests: [{ ...fixture, id: 'fxR' }] } });
  try {
    await app.run(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      isUnlocked = true; currentUserName = 'Shaun';
      openGameSheet('fxR'); await wait(100);
      document.querySelector('#gameSheet .game-admin').click(); await wait(150);
      const p = document.querySelector('#gameSheet .game-sheet'); p.scrollTop = p.scrollHeight; await wait(100);
    });
    const box = await app.page.locator('#gameSheet .fx-remove-arm').boundingBox();
    assert.ok(box.height >= 44 && box.width > 250, `a real target, not a 23px link (${box.width}×${box.height})`);
    await app.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await app.run(() => new Promise((res) => setTimeout(res, 500)));
    const yes = await app.page.locator('#gameSheet .fx-remove-yes').boundingBox();
    assert.ok(yes && yes.y + yes.height <= 844, 'Remove fixture (the second tap) is on screen');
    await app.page.touchscreen.tap(yes.x + yes.width / 2, yes.y + yes.height / 2);
    const r = await app.run(async () => { await new Promise((res) => setTimeout(res, 300));
      return { status: gameRequestsState[0].status, open: document.getElementById('gameSheet').classList.contains('show') }; });
    assert.deepStrictEqual(r, { status: 'removed', open: false });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
