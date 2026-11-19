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

test('a week, three parts a day; a date that is different replaces the week; nothing said is unknown, never busy', () => {
  const kaz = { weekly: { mon: ['evening'], thu: ['evening', 'morning'], xyz: ['evening'] },
    exceptions: [{ date: '2026-11-26', free: [] }, { date: '2026-11-29', free: ['morning'] }, { date: 'soon', free: [] }] };
  assert.deepStrictEqual(A.clean(kaz).weekly, { mon: ['evening'], thu: ['morning', 'evening'] }, 'known days and parts only, in order');
  assert.strictEqual(A.clean(kaz).exceptions.length, 2);
  assert.strictEqual(A.dayOf('2026-11-23'), 'mon');
  assert.strictEqual(A.slotOfTime('21:00'), 'evening');
  assert.strictEqual(A.slotOfTime('9:30'), 'morning');
  assert.strictEqual(A.slotOfTime('14:00'), 'afternoon');
  assert.strictEqual(A.slotOfTime(''), null);
  assert.strictEqual(A.statusOn(kaz, '2026-11-23', 'evening'), 'free', 'a Monday evening');
  assert.strictEqual(A.statusOn(kaz, '2026-11-23', 'morning'), 'busy');
  assert.strictEqual(A.statusOn(kaz, '2026-11-26', 'evening'), 'busy', 'a Thursday he said he cannot make');
  assert.strictEqual(A.statusOn(kaz, '2026-11-29', 'morning'), 'free', 'a Sunday he added');
  assert.strictEqual(A.statusOn(kaz, '2026-11-24'), 'busy', 'Tuesday, nothing in his week');
  assert.strictEqual(A.statusOn(undefined, '2026-11-24', 'evening'), 'unknown');
  assert.strictEqual(A.statusOn({ weekly: {}, exceptions: [] }, '2026-11-24'), 'unknown', 'an empty week says nothing');
  const w = A.whoIsFree({ Kaz: kaz, Len: { weekly: { mon: ['morning'] } } }, ['Kaz', 'Len', 'Max'], '2026-11-23', '21:00');
  assert.deepStrictEqual([w.free, w.busy, w.unknown, w.slot], [['Kaz'], ['Len'], ['Max'], 'evening']);
  assert.strictEqual(A.summary(kaz), 'Mon evening · Thu morning & evening');
  assert.strictEqual(A.summary({ weekly: { mon: ['evening'], wed: ['evening'] } }), 'Mon, Wed evenings');
});

test('everyone may read it; only that player (by their code) or an Admin may change it', () => {
  assert.match(RULES, /match \/availability\/\{player\}\s*\{\s*allow read: if true;\s*allow write: if isAdmin\(\) \|\| \(request\.auth != null\s*&& get\(\/databases\/\$\(database\)\/documents\/playerAccounts\/\$\(request\.auth\.uid\)\)\.data\.player == player\);/);
});

maybe('a signed-in player sets their week and a date that is different; it is saved for them, and shown when a game is arranged', async () => {
  const email = 'pkazkazkaz1@players.sgj.luxe';
  const accounts = { [email]: { password: '472915', uid: 'uid-kaz' } };
  const docs = { playerAccounts: { 'uid-kaz': { player: 'Kaz' } }, playerLogins: { Kaz: { email, own: true } },
    availability: { Len: { weekly: { mon: ['evening'] }, exceptions: [] } } };
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
      sheet.querySelector('[data-av-day="mon"][data-av-slot="evening"]').click();
      document.querySelector('#availabilitySheet [data-av-day="thu"][data-av-slot="evening"]').click();
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
    assert.deepStrictEqual(r.saved, { id: 'Kaz', weekly: { mon: ['evening'], thu: ['evening'] }, exceptions: [{ date: '2026-11-26', free: [] }], by: 'Kaz' });
    assert.strictEqual(r.msg, 'Saved.');
    assert.match(r.monday, /Mon 23 Nov evening/);
    assert.match(r.monday, /✓ Kaz/);
    assert.match(r.monday, /\? Max/);
    assert.match(r.monday, /Also free: Len/);
    assert.match(r.thursday, /✗ Kaz/, 'the Thursday he cannot make');
    assert.strictEqual(r.lenTitle, 'When I can play', 'Len\'s did not open: still his own sheet');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
