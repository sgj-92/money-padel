// ===================== PLAYER CODES =====================
// Shaun, 19 Nov: "accounts for players ... a unique code they enter when
// clicking on their name. Then they can stay saved on their device."
// Decided: a personal code; Padel Championships first.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./helpers/uiHarness.js');
const { CLUBS } = require('../assets/js/config/club.js');

const maybe = H.available() ? test : test.skip;
const RULES = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const EMPTY = { players: [], matches: [], ratingJourney: [] };
const TAGS = { moneypadel_player_tags: { Shaun: { tier: 'A', active: true }, Kaz: { tier: 'A', active: true }, Len: { tier: 'B', active: true } } };
const ADMIN = { accounts: { 'shaun@example.com': { password: 'pw', uid: 'uid-shaun' } }, admins: { 'uid-shaun': { role: 'owner', name: 'Shaun' } } };

test('switched on for Padel Championships only; the codes are Admins\' only and say who an account is', () => {
  assert.strictEqual(CLUBS.padelchampionships.playerAccounts, true);
  assert.ok(!CLUBS.moneypadel.playerAccounts, 'Money Padel later');
  assert.match(RULES, /match \/playerAccounts\/\{uid\}\s*\{\s*allow get: if isAdmin\(\) \|\| \(request\.auth != null && request\.auth\.uid == uid\);\s*allow list, write: if isAdmin\(\);/);
  assert.match(RULES, /match \/playerCodes\/\{player\}\s*\{ allow read, write: if isAdmin\(\); \}/);
  // The login entry: public to look up, the player may only mark their own choice.
  assert.match(RULES, /match \/playerLogins\/\{player\}[\s\S]*?affectedKeys\(\)\.hasOnly\(\['own', 'changedAt'\]\)/);
});

maybe('an Admin makes a code; the player taps their name, enters it, and stays signed in on that phone', async () => {
  // Admin's phone: make Kaz's code and copy the message.
  const admin = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, club: TAGS, ...ADMIN, signedIn: 'shaun@example.com' });
  let code, accounts, message;
  try {
    const r = await admin.run(async () => {
      for (let k = 0; k < 100 && !signedInAdmin; k++) await new Promise((res) => setTimeout(res, 20));
      isUnlocked = true; adminRole = 'owner';
      const copied = []; window.copyText = async (t) => { copied.push(t); return true; };
      document.querySelector('#tabrow .tab-btn[data-tab="manage"]').click();
      adminOpenSections.playercodes = true; renderManage();
      for (let k = 0; k < 100 && playerCodesState === null; k++) await new Promise((res) => setTimeout(res, 20));
      const before = document.querySelector('[data-pc-player="Kaz"]').textContent;
      document.querySelector('[data-pc-make="Kaz"]').click();
      for (let k = 0; k < 200 && !(playerCodesState && playerCodesState.Kaz); k++) await new Promise((res) => setTimeout(res, 20));
      document.querySelector('[data-pc-copy="Kaz"]').click(); await new Promise((res) => setTimeout(res, 30));
      const writes = window.__writes.filter((w) => ['playerAccounts', 'playerCodes', 'playerLogins'].includes(w.collection));
      return { before, code: playerCodesState.Kaz.code, copied, writes, stillAdmin: !!signedInAdmin, created: window.__auth.filter((a) => a.created) };
    });
    assert.match(r.before, /no code yet/);
    assert.match(r.code, /^[A-HJKMNPQRTUVWXY346789]{8}$/);
    assert.ok(r.stillAdmin, 'making a code never signs the Admin out');
    assert.strictEqual(r.created.length, 1);
    const acct = r.writes.find((w) => w.collection === 'playerAccounts');
    assert.strictEqual(acct.doc.player, 'Kaz');
    assert.strictEqual(r.writes.find((w) => w.collection === 'playerCodes').id, 'Kaz');
    assert.match(r.copied[0], new RegExp(`Hi Kaz, here's your Padel Championships code: ${r.code.slice(0, 4)}-${r.code.slice(4)}`));
    code = r.code; message = r.copied[0];
    const login = r.writes.find((w) => w.collection === 'playerLogins');
    assert.match(login.doc.email, /^p[a-z0-9]{10}@players\.sgj\.luxe$/, 'a made-up sign-in, not derived from the code');
    assert.strictEqual(login.id, 'Kaz');
    accounts = { [login.doc.email]: { password: code, uid: acct.id } };
    assert.deepStrictEqual(admin.pageErrors, []);
  } finally { await admin.close(); }
  assert.ok(message);

  // Kaz's phone: a wrong code is refused in words, the right one signs in.
  const email = Object.keys(accounts)[0];
  const docs = { playerAccounts: { [accounts[email].uid]: { player: 'Kaz' } }, playerLogins: { Kaz: { email, own: false } } };
  const phone = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, club: TAGS, accounts, documents: docs });
  try {
    const r = await phone.run(async (c) => {
      buildViewerSelector();
      document.querySelector('.viewer-player-btn[data-name="Kaz"]').click();
      const step = document.querySelector('.viewer-selector-title').textContent;
      const input = document.getElementById('playerCodeInput');
      input.value = 'AAAA-AAAA'; document.getElementById('playerCodeGo').click();
      for (let k = 0; k < 50 && !/isn’t right/.test(document.getElementById('playerCodeMsg').textContent); k++) await new Promise((res) => setTimeout(res, 20));
      const wrong = document.getElementById('playerCodeMsg').textContent;
      input.value = `${c.slice(0, 4).toLowerCase()} ${c.slice(4)}`;   // typed loosely
      document.getElementById('playerCodeGo').click();
      for (let k = 0; k < 100 && !signedInPlayer; k++) await new Promise((res) => setTimeout(res, 20));
      await new Promise((res) => setTimeout(res, 300));
      return { step, wrong, player: signedInPlayer && signedInPlayer.name, viewer: getCurrentViewer() && getCurrentViewer().name, verified: verifiedPlayerName() };
    }, code);
    assert.strictEqual(r.step, 'Hi Kaz');
    assert.match(r.wrong, /That code isn’t right/);
    assert.strictEqual(r.player, 'Kaz');
    assert.strictEqual(r.viewer, null, 'Kaz has no rated game in this empty record, so he is not a chosen player yet (as before codes)');
    assert.strictEqual(r.verified, 'Kaz');
    assert.deepStrictEqual(phone.pageErrors, []);
  } finally { await phone.close(); }

  // Next time on that phone: still Kaz, no code asked.
  const again = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, club: TAGS, accounts, documents: docs, signedIn: Object.keys(accounts)[0] });
  try {
    const r = await again.run(async () => {
      for (let k = 0; k < 100 && !signedInPlayer; k++) await new Promise((res) => setTimeout(res, 20));
      buildViewerSelector();
      const line = (document.querySelector('.viewer-code-signed') || {}).textContent || '';
      document.querySelector('.viewer-player-btn[data-name="Kaz"]').click();
      const asked = !!document.getElementById('playerCodeInput');
      return { player: signedInPlayer && signedInPlayer.name, line, asked };
    });
    assert.strictEqual(r.player, 'Kaz', 'Firebase kept Kaz signed in');
    assert.match(r.line, /Signed in as Kaz ✓/);
    assert.strictEqual(r.asked, false, 'their own name needs no code');
    assert.deepStrictEqual(again.pageErrors, []);
  } finally { await again.close(); }
});

maybe('a player without a code can still just browse as themselves; Money Padel asks for no code', async () => {
  const pc = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, club: TAGS });
  try {
    const r = await pc.run(() => {
      buildViewerSelector();
      document.querySelector('.viewer-player-btn[data-name="Len"]').click();
      document.getElementById('playerCodeSkip').click();
      return { viewer: getCurrentViewer() && getCurrentViewer().name, verified: verifiedPlayerName() };
    });
    assert.deepStrictEqual(r, { viewer: null, verified: null }, 'Len is unrated, so not a viewer yet; nobody verified');
  } finally { await pc.close(); }
  const mp = await H.open({});
  try {
    const r = await mp.run(() => {
      buildViewerSelector();
      document.querySelector('.viewer-player-btn[data-name="Kaz"]').click();
      return { asked: !!document.getElementById('playerCodeInput'), viewer: getCurrentViewer() && getCurrentViewer().name };
    });
    assert.deepStrictEqual(r, { asked: false, viewer: 'Kaz' });
  } finally { await mp.close(); }
});

// Shaun, 19 Nov: "Allow them to change their code to a 6 digit code of their choice too."
maybe('a signed-in player swaps their code for 6 digits of their own, and signs in with those after', async () => {
  const email = 'pabcdefghij@players.sgj.luxe';
  const accounts = { [email]: { password: 'KZ7P42QM', uid: 'uid-kaz' } };
  const docs = { playerAccounts: { 'uid-kaz': { player: 'Kaz' } }, playerLogins: { Kaz: { email, own: false } } };
  const phone = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, club: TAGS, accounts, documents: docs, signedIn: email });
  try {
    const r = await phone.run(async () => {
      for (let k = 0; k < 100 && !signedInPlayer; k++) await new Promise((res) => setTimeout(res, 20));
      buildViewerSelector();
      document.getElementById('playerChangeCodeBtn').click();
      const set = (id, v) => { document.getElementById(id).value = v; };
      const save = async () => { document.getElementById('ownCodeSave').click(); for (let k = 0; k < 50; k++) { await new Promise((res) => setTimeout(res, 20)); if (!/Saving/.test(document.getElementById('ownCodeMsg').textContent)) break; } return document.getElementById('ownCodeMsg').textContent; };
      set('ownCodeCurrent', 'KZ7P-42QM'); set('ownCodeNew', '111111'); set('ownCodeAgain', '111111');
      const easy = await save();
      set('ownCodeNew', '472915'); set('ownCodeAgain', '472916');
      const mismatch = await save();
      set('ownCodeCurrent', 'AAAA-AAAA'); set('ownCodeAgain', '472915');
      const wrongCurrent = await save();
      set('ownCodeCurrent', 'kz7p 42qm');
      const done = await save();
      const marked = window.__writes.filter((w) => w.collection === 'playerLogins').pop();
      // Signed out, then back in with the chosen digits.
      await playerSignOut();
      const old = await playerSignIn('Kaz', 'KZ7P-42QM');
      const fresh = await playerSignIn('Kaz', '472915');
      return { easy, mismatch, wrongCurrent, done, marked: marked && marked.doc, old: old.ok, fresh: fresh.ok, who: signedInPlayer && signedInPlayer.name };
    });
    assert.match(r.easy, /Too easy to guess/);
    assert.match(r.mismatch, /don’t match/);
    assert.match(r.wrongCurrent, /current code isn’t right/);
    assert.match(r.done, /Your code is now the 6 digits you chose/);
    assert.deepStrictEqual([r.marked.email, r.marked.own], [email, true], 'the Admin list learns it is their own; nothing else changes');
    assert.strictEqual(r.old, false, 'the old code stops working');
    assert.strictEqual(r.fresh, true);
    assert.strictEqual(r.who, 'Kaz');
    assert.deepStrictEqual(phone.pageErrors, []);
  } finally { await phone.close(); }
});
