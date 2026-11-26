// ===================== A GAME'S REVIEW, AND FEEDBACK TO EACH PLAYER =====================
// Shaun, 26 Nov: "Add a review/debrief section to games ... individualised to
// each player as feedback. This should also feedback into their profiles."
// Decided: Admins and the four write; the recap is public; feedback is read
// only by that player, its writer and Admins.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const RULES = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const NOW = '2026-09-21T10:00:00.000Z';
const KAZ = { accounts: { 'pkaz@players.sgj.luxe': { password: 'AAAABBBB', uid: 'uid-kaz' } }, signedIn: 'pkaz@players.sgj.luxe' };
const docs = (extra) => ({ playerAccounts: { 'uid-kaz': { player: 'Kaz' } }, playerLogins: { Kaz: { email: 'pkaz@players.sgj.luxe' } }, ...(extra || {}) });

test('the rules: recaps are public, written by Admins or the four as themselves; feedback is private to its player, its writer and Admins', () => {
  const rv = RULES.slice(RULES.indexOf('match /matchReviews/{matchId}'), RULES.indexOf('match /matchFeedback/{id}'));
  assert.match(rv, /allow read: if true;/);
  assert.match(rv, /allow create: if isAdmin\(\) \|\| \(isMemberOf\(request\.resource\.data\.players\) && isMe\(request\.resource\.data\.by\)\);/);
  const fb = RULES.slice(RULES.indexOf('match /matchFeedback/{id}'));
  assert.match(fb, /allow read: if isAdmin\(\) \|\| isMe\(resource\.data\.player\) \|\| isMe\(resource\.data\.by\);/);
  assert.match(fb, /request\.resource\.data\.player in request\.resource\.data\.players/);
});

maybe('one of the four: writes the recap, gives a partner feedback (they are told), and sees only what is theirs', async () => {
  const app = await H.open({ now: NOW, path: 'index.html?club=padelchampionships', mobile: true, ...KAZ, documents: docs() });
  try {
    await app.run(() => new Promise((res) => setTimeout(res, 500)));
    const r = await app.run(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      const sent = []; window.sendNotice = async (n) => { sent.push(n); return { sent: 1 }; };
      const m = matchesIncludingDraws().find((x) => reviewPlayers(x).includes('Kaz'));
      const other = reviewPlayers(m).find((p) => p !== 'Kaz');
      const third = reviewPlayers(m).find((p) => p !== 'Kaz' && p !== other);
      // Someone else's note about a third player: Kaz must not see it.
      await db.collection('matchFeedback').doc(`${m.id}__${third}__Admin`).set({ matchId: m.id, players: reviewPlayers(m), player: third, by: 'Admin', good: 'Secret', work: '', goodTags: [], workTags: [], at: '2026-09-21T10:00:00.000Z' });
      openMatchScorecard(m.id);
      await wait(120);
      const sec = () => document.querySelector('#matchScorecardModal .mr');
      const before = sec().textContent.replace(/\s+/g, ' ');
      sec().querySelector('.mr-edit-recap').click();
      document.getElementById('mrRecapText').value = 'Tight first set; we served better in the second.';
      sec().querySelector('.mr-save-recap').click();
      await wait(80);
      const recap = sec().querySelector('.mr-recap-text').textContent;
      sec().querySelector(`[data-mr-give="${other}"]`).click();
      document.getElementById('mrGood').value = 'Great lobs';
      sec().querySelector('[data-mr-tag="good"][data-tag="Lobs"]').click();
      sec().querySelector('[data-mr-tag="work"][data-tag="Serve"]').click();
      sec().querySelector('.mr-save-fb').click();
      await wait(80);
      const writes = window.__writes.filter((w) => /^match(Reviews|Feedback)$/.test(w.collection)).map((w) => ({ c: w.collection, d: w.doc }));
      return { m: m.id, other, before, recap, writes, sent, after: sec().textContent.replace(/\s+/g, ' ') };
    });
    assert.doesNotMatch(r.before, /Secret/, 'another player\'s feedback stays private');
    assert.match(r.before, /No recap yet/);
    assert.strictEqual(r.recap, 'Tight first set; we served better in the second.');
    const rv = r.writes.find((w) => w.c === 'matchReviews' && w.d.by === 'Kaz');
    assert.ok(rv && rv.d.players.length >= 2 && rv.d.players.includes('Kaz'));
    const fb = r.writes.find((w) => w.c === 'matchFeedback' && w.d.by === 'Kaz');
    assert.strictEqual(fb.d.player, r.other);
    assert.deepStrictEqual([fb.d.goodTags, fb.d.workTags, fb.d.good], [['Lobs'], ['Serve'], 'Great lobs']);
    assert.ok(r.sent.some((n) => n.title === 'Match review' && !n.to.includes('Kaz')));
    assert.ok(r.sent.some((n) => n.title === 'Feedback on your game' && n.to.length === 1 && n.to[0] === r.other));
    assert.match(r.after, /Great lobs/);
    assert.match(r.after, /Edit your feedback/);
  } finally { await app.close(); }
});

maybe('the profile: their feedback with Strengths and Working on, for them only; recaps of their games for everyone', async () => {
  const app = await H.open({ now: NOW, path: 'index.html?club=padelchampionships', mobile: true, ...KAZ, documents: docs() });
  try {
    await app.run(() => new Promise((res) => setTimeout(res, 500)));
    const r = await app.run(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      const ms = matchesIncludingDraws().filter((x) => reviewPlayers(x).includes('Kaz')).slice(0, 2);
      for (const [i, m] of ms.entries()) {
        await db.collection('matchFeedback').doc(`${m.id}__Kaz__Len${i}`).set({ matchId: m.id, players: reviewPlayers(m), player: 'Kaz', by: 'Len', good: i ? '' : 'Strong at the net', work: '', goodTags: ['Volleys'], workTags: i ? ['Serve'] : [], at: `2026-09-1${i}T10:00:00.000Z` });
      }
      await db.collection('matchReviews').doc(ms[0].id).set({ matchId: ms[0].id, players: reviewPlayers(ms[0]), text: 'A great comeback.', by: 'Shaun', at: '2026-09-21T10:00:00.000Z' });
      openSheet('Kaz');
      await wait(150);
      const t = (s) => { const e = document.getElementById('ppFeedbackHost'); return e ? e.textContent.replace(/\s+/g, ' ') : ''; };
      const mine = t();
      openSheet('Len');
      await wait(150);
      return { mine, len: t(), lenShown: document.getElementById('ppFeedbackHost').style.display };
    });
    assert.match(r.mine, /Feedback\s*only you and Admins/);
    assert.match(r.mine, /Strengths\s*Volleys ×2/);
    assert.match(r.mine, /Working on\s*Serve/);
    assert.match(r.mine, /Strong at the net/);
    assert.match(r.mine, /Match reviews\s*1 .*A great comeback\./);
    assert.doesNotMatch(r.len, /Feedback\s*only/, 'nobody else sees Kaz\'s feedback section on Len');
  } finally { await app.close(); }
});
