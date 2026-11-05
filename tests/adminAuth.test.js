// ===================== ADMIN SIGN-IN AND THE DATABASE RULES =====================
// White-label step 1c. Shaun, 5 Nov: "happy to have an actual password for
// admins, the normal way". Each Admin signs in with their own email and
// password (data/adminAuth.js); firestore.rules lets only those accounts
// change Admin data. Members, who never sign in, keep the five things they
// can do today -- and these tests hold the app to writing nothing else.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./helpers/uiHarness.js');
const C = require('../assets/js/config/club.js');

const maybe = H.available() ? test : test.skip;
const ROOT = path.join(__dirname, '..');
const RULES = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');

// The documents firestore.rules lets a member (not signed in) write.
const MEMBER_DOCS = [...RULES.matchAll(/'([a-z_]+)',?\s*\/\/ MEMBER_DOCS/g)].map((m) => m[1]);

const SHAUN = { 'shaun@example.com': { password: 'right-password', uid: 'uid-shaun' }, 'kaz@example.com': { password: 'kaz-password', uid: 'uid-kaz' } };
const ADMINS = { 'uid-shaun': { role: 'owner', name: 'Shaun' } };

test('the rules: everyone reads, Admins write, members only their four documents, nobody makes an Admin', () => {
  assert.deepStrictEqual(MEMBER_DOCS.sort(), ['moneypadel_challenges', 'moneypadel_dev_areas', 'moneypadel_extra_matches', 'moneypadel_game_requests']);
  // The member documents are the app's own storage keys, spelled the same.
  const data = fs.readFileSync(path.join(ROOT, 'assets/js/data/firebaseData.js'), 'utf8');
  MEMBER_DOCS.forEach((k) => assert.match(data, new RegExp(`= '${k}'`), `${k} is a storage key`));
  // Every collection the app writes has a rule; anything else is refused by default.
  ['moneypadel', 'matches', 'ratingJourney', 'players', 'monthlyChampions', 'playerOfTheMonth', 'playerPacks', 'healthReports', 'admins']
    .forEach((c) => assert.match(RULES, new RegExp(`match /${c}/\\{`), `${c} has a rule`));
  assert.doesNotMatch(RULES, /document=\*\*/, 'no catch-all that could open `admins`');
  assert.doesNotMatch(RULES.split('match /admins/')[1], /allow[^;]*write/, 'nothing may write admins');
  ['matches', 'ratingJourney', 'players', 'monthlyChampions', 'playerOfTheMonth'].forEach((c) =>
    assert.match(RULES, new RegExp(`match /${c}/\\{id\\}\\s*\\{ allow read: if true; allow write: if isAdmin\\(\\); \\}`), `${c}: Admin writes only`));
});

test('every community signs Admins in with accounts; none offers the old shared password (off for Money Padel, 5 Nov)', () => {
  Object.values(C.CLUBS).forEach((c) => assert.strictEqual(c.adminAccounts, true, c.id));
  Object.values(C.CLUBS).forEach((c) => assert.strictEqual(c.legacyAdminPassword, false, c.id));
});

maybe('signing in: a wrong password is refused, the right one unlocks as Owner, locking signs out', async () => {
  const app = await H.open({ accounts: SHAUN, admins: ADMINS });
  try {
    const r = await app.run(async () => {
      const before = isUnlocked;
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      const form = !!document.getElementById('lockEmail') && !!document.getElementById('lockPassword');
      const legacy = !!document.getElementById('lockPwInput');
      const tryIt = async (email, pw) => {
        document.getElementById('lockEmail').value = email;
        document.getElementById('lockPassword').value = pw;
        document.getElementById('lockSignInBtn').click();
        await new Promise((res) => setTimeout(res, 100));
        return document.getElementById('lockMessage') ? document.getElementById('lockMessage').textContent : null;
      };
      const wrong = await tryIt('shaun@example.com', 'nope');
      const wrongUnlocked = isUnlocked;
      const notAdmin = await tryIt('kaz@example.com', 'kaz-password');
      const notAdminUnlocked = isUnlocked;
      await tryIt('shaun@example.com', 'right-password');
      const after = { unlocked: isUnlocked, role: adminRole, email: signedInAdmin && signedInAdmin.email, owner: isOwnerAdmin() };
      // More › Admin shows who is signed in, and locking signs them out.
      adminOpenSections.lock = true;
      renderManage();
      const manage = document.getElementById('manageView') ? document.getElementById('manageView').innerText : document.body.innerText;
      await lockAdminArea();
      return { before, form, legacy, wrong, wrongUnlocked, notAdmin, notAdminUnlocked, after, manage: /Signed in as shaun@example\.com · Owner/.test(manage),
        locked: isUnlocked, auth: window.__auth };
    });
    assert.strictEqual(r.before, false);
    assert.ok(r.form, 'an email and password form');
    assert.strictEqual(r.wrong, 'Wrong email or password.');
    assert.strictEqual(r.wrongUnlocked, false);
    assert.match(r.notAdmin, /kaz@example\.com is not an Admin of Money Padel/);
    assert.strictEqual(r.notAdminUnlocked, false);
    assert.deepStrictEqual(r.after, { unlocked: true, role: 'owner', email: 'shaun@example.com', owner: true });
    assert.ok(r.manage, 'More › Admin says who is signed in');
    assert.strictEqual(r.locked, false);
    assert.deepStrictEqual(r.auth.filter((a) => a.signOut).map((a) => a.signOut), ['kaz@example.com', 'shaun@example.com'],
      'a non-Admin account is signed straight out again; locking signs the Admin out');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('an Admin still signed in on the phone is an Admin when the app opens; a Board account is Board', async () => {
  const app = await H.open({ accounts: SHAUN, admins: { ...ADMINS, 'uid-kaz': { role: 'board', name: 'Kaz' } }, signedIn: 'kaz@example.com' });
  try {
    const r = await app.run(() => ({ unlocked: isUnlocked, role: adminRole, owner: isOwnerAdmin() }));
    assert.deepStrictEqual(r, { unlocked: true, role: 'board', owner: false });
  } finally { await app.close(); }
});

maybe('the standings site never signs anyone in as Admin', async () => {
  const app = await H.open({ accounts: SHAUN, admins: ADMINS, signedIn: 'shaun@example.com', path: 'index.html?standings' });
  try {
    assert.strictEqual(await app.run(() => isUnlocked), false);
  } finally { await app.close(); }
});

maybe('a community without the shared password: no shared-password unlock, even one left on the device', async () => {
  const app = await H.open({ path: 'index.html?club=padelchampionships',
    club: { moneypadel_admin_pw_owner_hash: 'x' } });
  try {
    const r = await app.run(async () => {
      localStorage.setItem('moneypadel_my_unlocked', JSON.stringify({ unlocked: true, role: 'owner' }));
      return null;
    });
    assert.strictEqual(r, null);
    await app.page.reload({ waitUntil: 'domcontentloaded' });
    await app.page.waitForFunction(() => typeof DATA_READY !== 'undefined' && DATA_READY, null, { timeout: 20000 });
    const after = await app.run(() => {
      document.getElementById('viewerSelectorSheet')?.remove();
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      return { unlocked: isUnlocked, legacy: !!document.getElementById('lockPwInput'), form: !!document.getElementById('lockEmail') };
    });
    assert.deepStrictEqual(after, { unlocked: false, legacy: false, form: true });
  } finally { await app.close(); }
});

maybe('Money Padel: the shared password is gone -- not offered, its panels gone, and an old unlock on a phone no longer counts', async () => {
  const app = await H.open({ club: { moneypadel_admin_pw_owner_hash: 'x' } });
  try {
    await app.run(() => { localStorage.setItem('moneypadel_my_unlocked', JSON.stringify({ unlocked: true, role: 'owner' })); });
    await app.page.reload({ waitUntil: 'domcontentloaded' });
    await app.page.waitForFunction(() => typeof DATA_READY !== 'undefined' && DATA_READY, null, { timeout: 20000 });
    const r = await app.run(() => {
      document.getElementById('viewerSelectorSheet')?.remove();
      const unlockedAtBoot = isUnlocked;
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      const lock = { legacy: !!document.getElementById('lockPwInput'), form: !!document.getElementById('lockEmail'),
        offer: /shared Admin password/i.test(document.getElementById('gamesView').innerText) };
      // Signed in as an Admin, More › Admin has no shared-password panels.
      isUnlocked = true; adminRole = 'owner'; signedInAdmin = { uid: 'u', email: 'shaun@example.com', role: 'owner', name: 'Shaun' };
      adminOpenSections.lock = true; renderManage();
      const panels = !!document.getElementById('cpOwnerSubmit') || !!document.getElementById('cpBoardSubmit');
      return { unlockedAtBoot, ...lock, panels };
    });
    assert.deepStrictEqual(r, { unlockedAtBoot: false, legacy: false, form: true, offer: false, panels: false });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a member submitting a game with a new player writes only their submission; the Admin\'s approval adds the player to the tier list', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      const [a, b, c] = PLAYERS.slice(0, 3).map((p) => p.name);
      // The member's submission, as Add a game saves it.
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      currentUserName = 'Jords';
      set('agDate', '2026-09-20');
      set('agA1', a); set('agA2', b); set('agB1', c); set('agB2', 'Topsy');
      const tierSel = document.querySelector('.ag-new-tier[data-name="Topsy"]');
      if (tierSel) tierSel.value = 'C';
      addGameSets = [{ w: '6', l: '1' }, { w: '6', l: '2' }];
      window.__writes.length = 0;
      await submitNewGame();
      const memberWrites = window.__writes.map((w) => `${w.collection}/${w.id}`);
      const sub = extraMatchesState.find((m) => m.status === 'pending' && m.losers.includes('Topsy'));
      // The Admin approves it.
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      window.__writes.length = 0;
      await prepareApproval(sub.id);
      await commitApproval();
      const adminWrites = [...new Set(window.__writes.map((w) => `${w.collection}/${w.id}`))].filter((k) => k.startsWith('moneypadel/'));
      return { tierPicker: !!tierSel, memberWrites, carried: sub.newPlayerTiers, tags: tagOverridesState.Topsy, adminWrites,
        topsy: (PLAYERS.find((p) => p.name === 'Topsy') || {}).tier };
    });
    assert.ok(r.tierPicker, 'Add a game asks the new player\'s tier');
    assert.deepStrictEqual(r.memberWrites, ['moneypadel/moneypadel_extra_matches'], 'a member writes only the submissions');
    r.memberWrites.forEach((k) => assert.ok(MEMBER_DOCS.includes(k.split('/')[1]), `${k} is a member document in the rules`));
    assert.deepStrictEqual(r.carried, { Topsy: 'C' }, 'the tier travels with the submission');
    assert.deepStrictEqual(r.tags, { tier: 'C', active: true }, 'approval puts the new player on the tier list');
    assert.ok(r.adminWrites.includes('moneypadel/moneypadel_player_tags'));
    assert.strictEqual(r.topsy, 'C');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
