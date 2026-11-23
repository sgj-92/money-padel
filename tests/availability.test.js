// ===================== WHEN A PLAYER CAN PLAY =====================
// Shaun, 19 Nov: players "put their schedule for when they can play".
// Decided: a weekly pattern plus exceptions; Padel Championships first.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const A = require('../assets/js/domain/players/availability.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const RULES = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const EMPTY = { players: [], matches: [], ratingJourney: [] };
const TAGS = { moneypadel_player_tags: { Shaun: { tier: 'A', active: true }, Kaz: { tier: 'A', active: true }, Len: { tier: 'B', active: true }, Max: { tier: 'B', active: true } } };

test('hourly blocks 8am–10pm; a date that is different replaces the week; nothing said is unknown, never busy', () => {
  // Shaun, 19 Nov: "hourly blocks they can tap from 8am to 9pm at night for each day".
  assert.deepStrictEqual([A.HOURS[0], A.HOURS[A.HOURS.length - 1], A.HOURS.length], [8, 21, 14], 'the last block starts at 9pm, so a 9pm game has one');
  const kaz = { weekly: { mon: [21, 19, 20, 22, 7], thu: ['evening'], xyz: [19] },
    exceptions: [{ date: '2026-11-26', free: [] }, { date: '2026-11-29', free: [9, 10] }, { date: 'soon', free: [] }] };
  const h = (...hours) => hours.flatMap((x) => [x, x + 0.5]);   // whole hours as their halves
  assert.deepStrictEqual(A.clean(kaz).weekly, { mon: h(19, 20, 21), thu: h(17, 18, 19, 20, 21) }, 'saved before as hours: each is its two halves; the old "evening" reads as 5–10pm');
  // Shaun, 19 Nov: "half an hour blocks if the player requests it ... I can do 8:30pm onwards".
  const shaun = { unit: 'half', halfHourGrid: true, weekly: { mon: [20.5, 21, 21.5] } };
  assert.deepStrictEqual(A.clean(shaun).weekly, { mon: [20.5, 21, 21.5] }, 'in half-hours, a number is its own half');
  assert.strictEqual(A.clean(shaun).halfHourGrid, true);
  assert.strictEqual(A.statusOn(shaun, '2026-11-23', A.hourOfTime('20:00')), 'busy');
  assert.strictEqual(A.statusOn(shaun, '2026-11-23', A.hourOfTime('20:30')), 'free');
  assert.strictEqual(A.summary(shaun), 'Mon 8:30–10pm');
  assert.strictEqual(A.hourOfTime('20:30'), 20.5);
  assert.strictEqual(A.clean(kaz).exceptions.length, 2);
  assert.strictEqual(A.dayOf('2026-11-23'), 'mon');
  assert.strictEqual(A.hourOfTime('21:00'), 21);
  assert.strictEqual(A.hourOfTime(''), null);
  assert.strictEqual(A.statusOn(kaz, '2026-11-23', 21), 'free', 'a Monday at 9pm');
  assert.strictEqual(A.statusOn(kaz, '2026-11-23', 18), 'busy');
  assert.strictEqual(A.statusOn(kaz, '2026-11-23', 6), 'unknown', 'outside the blocks: never asked');
  assert.strictEqual(A.statusOn(kaz, '2026-11-26', 19), 'busy', 'a Thursday he said he cannot make');
  assert.strictEqual(A.statusOn(kaz, '2026-11-29', 10), 'free', 'a Sunday he added');
  assert.strictEqual(A.statusOn(kaz, '2026-11-24'), 'busy', 'Tuesday, nothing in his week');
  assert.strictEqual(A.statusOn(undefined, '2026-11-24', 19), 'unknown');
  assert.strictEqual(A.statusOn({ weekly: {}, exceptions: [] }, '2026-11-24'), 'unknown', 'an empty week says nothing');
  const w = A.whoIsFree({ Kaz: kaz, Len: { weekly: { mon: [9] } } }, ['Kaz', 'Len', 'Max'], '2026-11-23', '21:00');
  assert.deepStrictEqual([w.free, w.busy, w.unknown, w.hour], [['Kaz'], ['Len'], ['Max'], 21]);
  assert.strictEqual(A.rangesText(h(9, 10, 19, 20, 21)), '9–11am, 7–10pm');
  assert.strictEqual(A.rangesText(h(11, 12)), '11am–1pm');
  assert.strictEqual(A.rangesText([12.5, 13]), '12:30–1:30pm');
  assert.strictEqual(A.summary(kaz), 'Mon 7–10pm · Thu 5–10pm');
  assert.strictEqual(A.summary({ weekly: { mon: [19, 20], wed: [19, 20] } }), 'Mon, Wed 7–9pm');
  const late = [20.5, 21, 21.5];
  assert.strictEqual(A.summary({ unit: 'half', weekly: { mon: late, tue: late, wed: late, thu: late, fri: late } }), 'Mon–Fri 8:30–10pm', 'a run of days, briefly');
  assert.strictEqual(A.summary({ unit: 'half', weekly: Object.fromEntries(A.DAYS.map((d) => [d, late])) }), 'Every day 8:30–10pm');
  assert.strictEqual(A.summary({ unit: 'half', weekly: { mon: late, tue: late, thu: late } }), 'Mon, Tue, Thu 8:30–10pm');
});

test('everyone may read it; only that player (by their code) or an Admin may change it', () => {
  assert.match(RULES, /match \/availability\/\{player\}\s*\{\s*allow read: if true;\s*allow write: if isAdmin\(\) \|\| \(request\.auth != null\s*&& get\(\/databases\/\$\(database\)\/documents\/playerAccounts\/\$\(request\.auth\.uid\)\)\.data\.player == player\);/);
});

maybe('a signed-in player sets their week and a date that is different; it is saved for them, and shown when a game is arranged', async () => {
  const email = 'pkazkazkaz1@players.sgj.luxe';
  const accounts = { [email]: { password: '472915', uid: 'uid-kaz' } };
  const docs = { playerAccounts: { 'uid-kaz': { player: 'Kaz' } }, playerLogins: { Kaz: { email, own: true } },
    availability: { Len: { weekly: { mon: [21] }, exceptions: [] } } };
  const app = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, club: TAGS, accounts, documents: docs, signedIn: email, now: '2026-11-19T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      for (let k = 0; k < 100 && !signedInPlayer; k++) await new Promise((res) => setTimeout(res, 20));
      const lenLoaded = !!availabilityState.Len;
      buildViewerSelector();
      document.getElementById('playerAvailBtn').click();
      await new Promise((res) => setTimeout(res, 300));
      const sheet = document.getElementById('availabilitySheet');
      const title = sheet.querySelector('h3').textContent;
      sheet.querySelector('[data-av-day="mon"][data-av-hour="21"]').click();
      document.querySelector('#availabilitySheet [data-av-day="mon"][data-av-hour="20"]').click();
      document.querySelector('#availabilitySheet [data-av-col="sat"]').click();   // all of Saturday
      const s2 = document.getElementById('availabilitySheet');
      s2.querySelector('.av-add-date').value = '2026-11-26';
      s2.querySelector('.av-add-kind').value = 'none';
      s2.querySelector('.av-add-btn').click();
      document.querySelector('#availabilitySheet .av-save').click();
      await new Promise((res) => setTimeout(res, 50));
      const saved = window.__writes.filter((w) => w.collection === 'availability').pop();
      const msg = document.querySelector('#availabilitySheet .av-msg').textContent;
      // The half-hour grid: 8pm–8:30pm off, so Monday is from 8:30pm.
      const half = document.querySelector('#availabilitySheet .av-half-toggle'); half.checked = true; half.dispatchEvent(new Event('change'));
      const halfRows = document.querySelectorAll('#availabilitySheet .av-grid .av-row.is-half').length;
      document.querySelector('#availabilitySheet [data-av-day="mon"][data-av-hour="20"]').click();
      document.querySelector('#availabilitySheet .av-save').click();
      await new Promise((res) => setTimeout(res, 50));
      const halfSaved = window.__writes.filter((w) => w.collection === 'availability').pop().doc;
      // Arranging a Monday-evening game: Kaz and Len free, Max has not said.
      const monday = availabilityHintHtml(['Kaz', 'Max'], '2026-11-23', '21:00');
      const thursday = availabilityHintHtml(['Kaz'], '2026-11-26', '21:00');
      // Not signed in as Len: Kaz cannot open Len's.
      openAvailabilitySheet('Len');
      const lenTitle = document.querySelector('#availabilitySheet h3').textContent;
      return { lenLoaded, title, saved: saved && { id: saved.id, weekly: saved.doc.weekly, exceptions: saved.doc.exceptions, by: saved.doc.by }, msg, monday, thursday, lenTitle,
        half: halfSaved.weekly, halfGrid: halfSaved.halfHourGrid, halfRows };
    });
    assert.ok(r.lenLoaded, 'everyone\'s is read at start-up');
    assert.strictEqual(r.title, 'When I can play');
    const halves = (...hours) => hours.flatMap((x) => [x, x + 0.5]);
    assert.deepStrictEqual(r.saved, { id: 'Kaz', weekly: { mon: halves(20, 21), sat: A.HALVES }, exceptions: [{ date: '2026-11-26', free: [] }], by: 'Kaz' });
    assert.deepStrictEqual(r.half, { mon: [20.5, 21, 21.5], sat: A.HALVES }, 'half-hour grid: 8–8:30 cleared, the rest kept');
    assert.strictEqual(r.halfRows, 28);
    assert.strictEqual(r.msg, 'Saved.');
    assert.match(r.monday, /Mon 23 Nov 9pm/);
    assert.match(r.monday, /✓ Kaz/);
    assert.match(r.monday, /\? Max/);
    assert.match(r.monday, /Also free: Len/);
    assert.match(r.thursday, /✗ Kaz/, 'the Thursday he cannot make');
    assert.strictEqual(r.lenTitle, 'When I can play', 'Len\'s did not open: still his own sheet');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 23 Nov: "When I tap a block on my phone, it jumps to the top of the
// page rather than keeping me there to continue."
maybe('tapping a block keeps the sheet where it is: the cell changes in place, the summary follows', async () => {
  const app = await H.open({ path: 'index.html?club=padelchampionships', viewport: { width: 390, height: 700 }, mobile: true });
  try {
    const r = await app.run(() => {
      isUnlocked = true;
      openAvailabilitySheet('Kaz');
      const panel = document.querySelector('#availabilitySheet .av-panel');
      document.querySelector('#availabilitySheet .av-half-toggle').click();
      const panel2 = document.querySelector('#availabilitySheet .av-panel');
      panel2.scrollTop = 600;
      const before = panel2.scrollTop;
      const cell = panel2.querySelector('[data-av-day="tue"][data-av-hour="20.5"]');
      cell.click();
      const after = { top: document.querySelector('#availabilitySheet .av-panel').scrollTop, same: cell.isConnected, on: cell.classList.contains('is-on'),
        summary: document.querySelector('#availabilitySheet .av-summary').textContent };
      panel2.querySelector('[data-av-col="sat"]').click();
      const col = { top: document.querySelector('#availabilitySheet .av-panel').scrollTop, summary: document.querySelector('#availabilitySheet .av-summary').textContent };
      return { before, after, col, keptOnToggle: panel !== panel2 };
    });
    assert.ok(r.before > 0);
    assert.strictEqual(r.after.top, r.before, 'not back at the top');
    assert.ok(r.after.same, 'the same cell, changed in place');
    assert.ok(r.after.on);
    assert.match(r.after.summary, /Tue 8:30–9pm/);
    assert.strictEqual(r.col.top, r.before);
    assert.match(r.col.summary, /Sat 8am–10pm/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
