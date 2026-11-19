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
  assert.deepStrictEqual(A.clean(kaz).weekly, { mon: [19, 20, 21], thu: [17, 18, 19, 20, 21] }, 'known blocks only, in order; the old "evening" reads as 5–10pm');
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
  assert.strictEqual(A.rangesText([9, 10, 19, 20, 21]), '9–11am, 7–10pm');
  assert.strictEqual(A.rangesText([11, 12]), '11am–1pm');
  assert.strictEqual(A.summary(kaz), 'Mon 7–10pm · Thu 5–10pm');
  assert.strictEqual(A.summary({ weekly: { mon: [19, 20], wed: [19, 20] } }), 'Mon, Wed 7–9pm');
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
      // Arranging a Monday-evening game: Kaz and Len free, Max has not said.
      const monday = availabilityHintHtml(['Kaz', 'Max'], '2026-11-23', '21:00');
      const thursday = availabilityHintHtml(['Kaz'], '2026-11-26', '21:00');
      // Not signed in as Len: Kaz cannot open Len's.
      openAvailabilitySheet('Len');
      const lenTitle = document.querySelector('#availabilitySheet h3').textContent;
      return { lenLoaded, title, saved: saved && { id: saved.id, weekly: saved.doc.weekly, exceptions: saved.doc.exceptions, by: saved.doc.by }, msg, monday, thursday, lenTitle };
    });
    assert.ok(r.lenLoaded, 'everyone\'s is read at start-up');
    assert.strictEqual(r.title, 'When I can play');
    assert.deepStrictEqual(r.saved, { id: 'Kaz', weekly: { mon: [20, 21], sat: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] }, exceptions: [{ date: '2026-11-26', free: [] }], by: 'Kaz' });
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
