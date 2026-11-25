// ===================== MESSAGES, AND A GAME SUGGESTED BY AN ADMIN =====================
// Shaun, 25 Nov: "I want to set up messaging between players and for admin to
// be able to recommend a game to four people, they get a notification and say
// whether they'd play it or not." Decided: a chat on every game and one-to-one
// messages, readable only by the players in them.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./helpers/uiHarness.js');
const Notices = require('../assets/js/domain/fixtures/fixtureNotices.js');

const maybe = H.available() ? test : test.skip;
const RULES = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const NOW = '2026-09-21T10:00:00.000Z';
const KAZ = { accounts: { 'pkaz@players.sgj.luxe': { password: 'AAAABBBB', uid: 'uid-kaz' } }, signedIn: 'pkaz@players.sgj.luxe' };
const docs = (extra) => ({ playerAccounts: { 'uid-kaz': { player: 'Kaz' } }, playerLogins: { Kaz: { email: 'pkaz@players.sgj.luxe' } }, ...(extra || {}) });

test('the rules: only members read or write a conversation; a message is sent as yourself; members never change', () => {
  const block = RULES.slice(RULES.indexOf('match /threads/{id}'), RULES.indexOf('// Who is an Admin.'));
  assert.match(block, /allow read: if isMemberOf\(resource\.data\.members\);/);
  assert.match(block, /allow update: if isMemberOf\(resource\.data\.members\)\s*&& request\.resource\.data\.members == resource\.data\.members;/);
  assert.match(block, /match \/messages\/\{m\}[\s\S]*allow read: if isMemberOf\(get\(/);
  assert.match(block, /isMe\(request\.resource\.data\.by\)/);
  assert.doesNotMatch(block, /isAdmin\(\)/, 'Admins get no special access to messages');
});

test('an Admin\'s suggestion is announced as one, to all four', () => {
  const before = [];
  const r = { id: 'r1', status: 'pending', requestedBy: 'Shaun', recommended: true, players: ['Kaz', 'Len', 'Osh', 'Erf'], confirmations: { Kaz: false, Len: false, Osh: false, Erf: false } };
  const n = Notices.between(before, [r], { when: () => '' });
  assert.strictEqual(n.length, 1);
  assert.strictEqual(n[0].title, 'Suggested game');
  assert.deepStrictEqual(n[0].to, ['Kaz', 'Len', 'Osh', 'Erf']);
  assert.match(n[0].body, /^Shaun suggests a game: .* Would you play\? Answer in Play\.$/);
});

maybe('one-to-one: the unread dot, the conversation, a reply saved as yourself and the others told', async () => {
  const app = await H.open({ now: NOW, path: 'index.html?club=padelchampionships', mobile: true, ...KAZ, documents: docs({
    threads: { 'd_Kaz~Len': { kind: 'direct', members: ['Kaz', 'Len'], lastAt: '2026-09-21T09:00:00.000Z', lastText: 'Thursday?', lastBy: 'Len' } },
    'threads/d_Kaz~Len/messages': { m1: { by: 'Len', text: 'Thursday?', at: '2026-09-21T09:00:00.000Z' } } }) });
  try {
    await app.run(() => new Promise((res) => setTimeout(res, 500)));
    const r = await app.run(async () => {
      const sent = []; window.sendNotice = async (n) => { sent.push(n); return { sent: 1 }; };
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      const dot = document.getElementById('shellMessagesBtn').classList.contains('has-unread');
      document.getElementById('shellMessagesBtn').click();
      const rows = [...document.querySelectorAll('.msg-row')].map((x) => x.querySelector('.msg-row-title').textContent);
      document.querySelector('[data-msg-thread]').click();
      await wait(50);
      const first = [...document.querySelectorAll('.msg-bubble .msg-text')].map((x) => x.textContent);
      const input = document.querySelector('.msg-input');
      input.value = 'Yes, 8pm?';
      document.querySelector('.msg-compose').requestSubmit();
      await wait(80);
      const msgs = window.__writes.filter((w) => w.collection === 'threads/d_Kaz~Len/messages').map((w) => w.doc);
      return { dot, rows, first, msgs, sent, after: [...document.querySelectorAll('.msg-bubble.is-mine .msg-text')].map((x) => x.textContent),
        dotAfter: document.getElementById('shellMessagesBtn').classList.contains('has-unread') };
    });
    assert.ok(r.dot, 'a dot while something is unread');
    assert.deepStrictEqual(r.rows, ['Len']);
    assert.deepStrictEqual(r.first, ['Thursday?']);
    assert.strictEqual(r.msgs.length, 1);
    assert.deepStrictEqual([r.msgs[0].by, r.msgs[0].text], ['Kaz', 'Yes, 8pm?']);
    assert.deepStrictEqual(r.sent.map((n) => [n.to, n.title, n.body]), [[['Len'], 'Kaz', 'Yes, 8pm?']]);
    assert.ok(r.after.includes('Yes, 8pm?'));
    assert.strictEqual(r.dotAfter, false, 'read once opened');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a game\'s chat is for its four: Chat on the game, a conversation with all four as members', async () => {
  const app = await H.open({ now: NOW, path: 'index.html?club=padelchampionships', mobile: true, ...KAZ, documents: docs() });
  try {
    await app.run(() => new Promise((res) => setTimeout(res, 500)));
    const r = await app.run(async () => {
      window.sendNotice = async () => ({ sent: 1 });
      const req = FixtureFlow.createAgreed({ players: ['Kaz', 'Len', 'Osh', 'Erf'], by: 'Shaun', preferredDate: '2026-09-25', preferredTime: '20:00' });
      gameRequestsState.push(req);
      setCurrentViewer('Kaz');
      openGameSheet(req.id);
      const btn = document.querySelector('#gameSheet .game-chat');
      btn.click();
      await new Promise((res) => setTimeout(res, 50));
      const title = document.querySelector('.msg-thread-title').textContent;
      document.querySelector('.msg-input').value = 'Who has balls?';
      document.querySelector('.msg-compose').requestSubmit();
      await new Promise((res) => setTimeout(res, 80));
      const t = window.__writes.find((w) => w.collection === 'threads');
      return { has: !!btn, title, members: t.doc.members, kind: t.doc.kind, gameId: t.doc.gameId, id: req.id };
    });
    assert.ok(r.has);
    assert.match(r.title, /^You & \w+ v \w+ & \w+$/);
    assert.deepStrictEqual(r.members.slice().sort(), ['Erf', 'Kaz', 'Len', 'Osh']);
    assert.strictEqual(r.kind, 'game');
    assert.strictEqual(r.gameId, r.id);
  } finally { await app.close(); }
});

maybe('not signed in with a code: Messages says how to start, and nothing is sent', async () => {
  const app = await H.open({ now: NOW, path: 'index.html?club=padelchampionships', mobile: true });
  try {
    const r = await app.run(() => {
      document.getElementById('shellMessagesBtn').click();
      return { text: document.querySelector('#messagesSheet .msg-empty').textContent, newBtn: !!document.querySelector('#messagesSheet .msg-new') };
    });
    assert.match(r.text, /Sign in with your code/);
    assert.strictEqual(r.newBtn, false);
  } finally { await app.close(); }
});

maybe('Money Padel has no player codes yet: no Messages button', async () => {
  const app = await H.open({ now: NOW, mobile: true });
  try {
    assert.strictEqual(await app.run(() => getComputedStyle(document.getElementById('shellMessagesBtn')).display), 'none');
  } finally { await app.close(); }
});

maybe('an Admin suggests a game: a request with nobody in yet, marked as suggested, shown as such', async () => {
  const app = await H.open({ now: NOW, path: 'index.html?club=padelchampionships', mobile: true });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner';
      const notes = []; window.sendNotice = async (n) => { notes.push(n); return { sent: 4 }; };
      agreedDraft = { names: ['Kaz', 'Len', 'Osh', 'Erf'], date: '2026-09-25', time: '20:00', venue: 'Origin', booked: false };
      openArrangeGame('agreed');
      document.querySelector('#arrangeSheet .agreed-suggest').click();
      await new Promise((res) => setTimeout(res, 80));
      const req = gameRequestsState[gameRequestsState.length - 1];
      setCurrentViewer('Kaz');
      const line = typeof playGameRowHtml === 'function' ? playGameRowHtml(req, { viewerName: 'Kaz', now: new Date().toISOString() }) : '';
      return { status: req.status, recommended: req.recommended, conf: Object.values(req.confirmations), players: req.players, by: req.requestedBy,
        flash: agreedFlash, line, notes: notes.map((n) => n.title) };
    });
    assert.strictEqual(r.status, 'pending');
    assert.strictEqual(r.recommended, true);
    assert.deepStrictEqual(r.conf, [false, false, false, false], 'nobody is in until they say so');
    assert.deepStrictEqual(r.players, ['Kaz', 'Len', 'Osh', 'Erf']);
    assert.match(r.flash, /^Suggested: Kaz & Len v Osh & Erf\. All four are asked/);
    assert.ok(r.notes.includes('Suggested game'), JSON.stringify(r.notes));
  } finally { await app.close(); }
});
