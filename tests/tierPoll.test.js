// ===================== THE TIER POLL =====================
// Shaun, 9 Nov: "For Padel Championships, we're going to do an initial poll
// for everyone's tiers ... a new webpage on the domain for standings where I
// can add everyone's name in a list, then the rows to vote are Tier S, A, B
// and C."

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const T = require('../poll/tierPoll.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const ROOT = path.join(__dirname, '..');

test('the list: one name per line or comma, tidied, once each', () => {
  assert.deepStrictEqual(T.parsePlayers('Shaun\n George ,Fred\n\nfred\nJeremy  Smith'), ['Shaun', 'George', 'Fred', 'Jeremy Smith']);
});

test('counting: one ballot per voter, skips are not votes, a vote for oneself never counts, the middle vote is suggested, a split goes down', () => {
  const players = ['Shaun', 'George', 'Fred'];
  const t = T.tally(players, [
    { voter: 'George', votes: { Shaun: 'S', Fred: 'S', George: 'S' }, createdAt: '2026-11-09T11:00' },  // his own vote is dropped
    { voter: 'Fred', votes: { Shaun: 'B', Nobody: 'A', George: 'X' }, createdAt: '2026-11-09T10:00' },
    { voter: 'Shaun', votes: { Fred: 'A', George: 'C' }, createdAt: '2026-11-09T10:00' },
  ]);
  assert.deepStrictEqual(t.voters, ['Fred', 'George', 'Shaun']);
  const row = (p) => t.rows.find((r) => r.player === p);
  assert.deepStrictEqual(row('Shaun').counts, { S: 1, A: 0, B: 1, C: 0 });
  assert.strictEqual(row('Shaun').suggested, 'B', 'an even split goes to the lower tier');
  assert.deepStrictEqual([row('Fred').votes, row('Fred').suggested], [2, 'A'], 'S and A: the lower, A');
  assert.deepStrictEqual([row('George').votes, row('George').suggested], [1, 'C'], 'his own S and an invalid tier are not votes');
  assert.strictEqual(T.median(['S', 'S', 'C']), 'S', 'one outlier does not move it');
});

test('codes: six characters nobody misreads; typed any way, they still match', () => {
  let n = 0;
  const code = T.makeCode((k) => Array.from({ length: k }, () => n++ * 7));
  assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
  assert.ok(!/[01OIL]/.test(T.CODE_LETTERS));
  assert.strictEqual(T.normaliseCode(' k7q-m3p '), 'K7QM3P');
});

test('the rules: a code votes once, only as its own player, never for them, only while open; only an Admin lists codes or ballots', () => {
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/tierPoll\/\{id\}\s*\{ allow read: if true; allow write: if isAdmin\(\); \}/);
  assert.match(rules, /match \/tierPollCodes\/\{code\}\s*\{ allow get: if true; allow list, write: if isAdmin\(\); \}/);
  const ballots = rules.split('match /tierPollBallots/{code}')[1].split('\n    }')[0];
  assert.match(ballots, /allow get: if true;/);
  assert.match(ballots, /allow list, delete: if isAdmin\(\);/);
  assert.ok(!/update|allow read|allow write/.test(ballots), 'never changed once cast, never listed by a member');
  assert.match(ballots, /allow create: if exists\(\/databases\/\$\(database\)\/documents\/tierPollCodes\/\$\(code\)\)/);
  assert.match(ballots, /tierPoll\/current\)\.data\.open == true/);
  assert.match(ballots, /keys\(\)\.hasOnly\(\['poll', 'voter', 'votes', 'createdAt'\]\)/);
  assert.match(ballots, /request\.resource\.data\.voter == get\(\/databases\/\$\(database\)\/documents\/tierPollCodes\/\$\(code\)\)\.data\.name/);
  assert.match(ballots, /!\(request\.resource\.data\.voter in request\.resource\.data\.votes\.keys\(\)\)/);
});

test('the standings site serves the poll page; every other page still goes home', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  ['mpstandings.sgj.luxe', 'pcstandings.sgj.luxe'].forEach((host) => {
    const rule = cfg.redirects.find((r) => (r.has || []).some((h) => h.value === host));
    const re = new RegExp('^' + rule.source + '$');
    ['/poll/', '/poll', '/poll/poll.js'].forEach((p) => assert.ok(!re.test(p), `${host}${p} is served`));
    ['/admin', '/index.html', '/pollster'].forEach((p) => assert.ok(re.test(p), `${host}${p} goes home`));
  });
});

const ADMIN = { accounts: { 'shaun@example.com': { password: 'pw', uid: 'u1' } }, admins: { u1: { role: 'owner', name: 'Shaun' } } };

maybe('the page: an Admin lists the players, makes codes and opens it; a player votes once with their code, not for themselves; the Admin sees the counts and sets the starting tiers', async () => {
  const app = await H.open({ path: 'poll/index.html?club=padelchampionships', readyWhen: () => window.__pollReady, ...ADMIN, viewport: { width: 390, height: 844 } });
  try {
    const page = app.page;
    await app.run(() => {
      window.__copied = [];
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } }, configurable: true });
      window.confirm = () => true;
    });
    const before = await app.run(() => ({ text: document.getElementById('pollMain').innerText, title: document.title }));
    // The Admin.
    await page.click('#pollAdminOpen');
    await page.fill('#pollEmail', 'shaun@example.com'); await page.fill('#pollPassword', 'pw');
    await page.click('#pollSignIn');
    await page.waitForSelector('#pollPlayers');
    await page.fill('#pollPlayers', 'Shaun\nGeorge\nFred\nJeremy');
    await page.click('#pollSave');
    await page.waitForSelector('#pollMakeCodes');
    await page.click('#pollMakeCodes');
    await page.waitForFunction(() => document.querySelectorAll('.poll-codes [data-copy]').length === 4);
    const codes = await app.run(() => Object.fromEntries(window.__writes.filter((w) => w.collection === 'tierPollCodes').map((w) => [w.doc.name, w.id])));
    await page.fill('#pollMessage', 'Hey {name}! Vote here: {link} (once only)');
    await page.dispatchEvent('#pollMessage', 'change');
    await page.waitForFunction(() => /Message saved/.test((document.getElementById('pollToast') || {}).innerText || ''));
    await page.click('.poll-codes [data-copy^="George|"]');
    const signage = await app.run(() => ({ button: document.querySelector('.poll-codes [data-copy^="George|"]').innerText,
      toast: document.getElementById('pollToast').innerText }));
    await page.click('#pollCopyAll');
    await page.check('[data-sent="' + codes.George + '"]');
    await page.waitForFunction(() => /Marked George/.test(document.getElementById('pollToast').innerText));
    const sent = await app.run((c) => window.__writes.filter((w) => w.collection === 'tierPollCodes' && w.id === c).slice(-1)[0].doc, codes.George);
    await page.click('#pollToggle');
    await page.waitForFunction(() => /open/.test(document.getElementById('pollAdminMsg').innerText) && !!document.getElementById('pollCode'));
    // A wrong code.
    await page.fill('#pollCode', 'ZZZZZZ'); await page.click('#pollCodeGo');
    await page.waitForFunction(() => /isn’t right/.test(document.getElementById('pollMsg').innerText));
    // George, with his code typed loosely.
    await page.fill('#pollCode', codes.George.toLowerCase().replace(/^(...)/, '$1-')); await page.click('#pollCodeGo');
    await page.waitForSelector('#pollSend');
    const rows = await app.run(() => [...document.querySelectorAll('.poll-row[data-player]')].map((r) => r.dataset.player));
    await page.click('.poll-row[data-player="Shaun"] [data-tier="A"]');
    await page.click('.poll-row[data-player="Fred"] [data-tier="B"]');
    await page.click('#pollSend');
    await page.waitForFunction(() => /Place or skip everyone first: Jeremy/.test(document.getElementById('pollMsg').innerText));
    await page.click('.poll-row[data-player="Jeremy"] [data-tier="S"]');
    await page.click('.poll-row[data-player="Jeremy"] [data-skip]');   // can't judge him
    const counted = await app.run(() => document.getElementById('pollCount').innerText);
    await page.click('#pollSend');
    await page.waitForFunction(() => /your vote is in/.test(document.getElementById('pollMain').innerText));
    const ballot = await app.run(() => window.__writes.filter((w) => w.collection === 'tierPollBallots').map((w) => ({ id: w.id, ...w.doc })));
    // The same code again.
    await page.click('#pollToggle');
    await page.waitForFunction(() => /closed/.test(document.getElementById('pollAdminMsg').innerText));
    await page.click('#pollToggle');
    await page.waitForSelector('#pollCode');
    await page.fill('#pollCode', codes.George); await page.click('#pollCodeGo');
    await page.waitForFunction(() => /already in/.test(document.getElementById('pollMain').innerText));
    // Results, then starting tiers.
    await page.waitForFunction(() => /1 of 4 voted/.test(document.getElementById('pollAdmin').innerText));
    const results = await app.run(() => [...document.querySelectorAll('.poll-results:not(.poll-codes) tbody tr')].map((tr) => [...tr.children].map((td) => td.innerText)));
    const codeOrder = await app.run(() => [...document.querySelectorAll('.poll-codes tbody tr')].map((tr) => tr.children[0].innerText));
    const waiting = await app.run(() => document.getElementById('pollWaiting').innerText);
    const georgeRow = await app.run(() => [...document.querySelectorAll('.poll-codes tbody tr')].find((tr) => tr.children[0].innerText === 'George').innerText);
    await page.click('#pollUse');
    await page.waitForFunction(() => /Set as starting tiers/.test(document.getElementById('pollUseMsg').innerText));
    const tags = await app.run(() => JSON.parse(window.__writes.filter((w) => w.collection === 'moneypadel' && w.id === 'moneypadel_player_tags').slice(-1)[0].doc.value));
    // Reset lets the code be used again.
    await page.click('.poll-codes [data-reset]');
    await page.waitForFunction(() => document.querySelectorAll('.poll-codes [data-copy]').length === 4);
    const copied = await app.run(() => window.__copied);

    assert.match(before.text, /isn’t ready yet/);
    assert.strictEqual(before.title, 'Padel Championships · Tier poll');
    assert.deepStrictEqual(Object.keys(codes).sort(), ['Fred', 'George', 'Jeremy', 'Shaun']);
    assert.strictEqual(new Set(Object.values(codes)).size, 4, 'everyone has their own code');
    Object.values(codes).forEach((c) => assert.match(c, /^[A-HJKMNP-Z2-9]{6}$/));
    assert.match(copied[0], new RegExp(`^Hey George! Vote here: \\S+/poll/(index\\.html)?\\?code=${codes.George} \\(once only\\)$`));
    assert.strictEqual(copied[1].split('\n\n').length, 4);
    assert.match(copied[1], /^Shaun:\nHey Shaun! Vote here: /);
    assert.deepStrictEqual(signage, { button: 'Copied ✓', toast: '✓ Copied George’s link — send it to them privately.' });
    assert.deepStrictEqual([sent.name, sent.sent, typeof sent.sentAt], ['George', true, 'string'], 'the tick is kept on his code');
    assert.strictEqual(counted, '2 placed · 1 skipped · all done');
    assert.strictEqual(await app.run(async () => (await firebase.firestore().collection('tierPoll').doc('current').get()).data().message), 'Hey {name}! Vote here: {link} (once only)');
    assert.deepStrictEqual(rows, ['Shaun', 'Fred', 'Jeremy'], 'George is not on his own ballot');
    assert.strictEqual(ballot.length, 1, 'one vote per code');
    assert.deepStrictEqual([ballot[0].id, ballot[0].voter, ballot[0].votes], [codes.George, 'George', { Shaun: 'A', Fred: 'B' }]);
    assert.deepStrictEqual(Object.keys(ballot[0]).filter((k) => k !== 'id').sort(), ['createdAt', 'poll', 'voter', 'votes'], 'exactly the fields the rules allow');
    assert.match(georgeRow, /✔/);
    assert.deepStrictEqual(codeOrder, ['George', 'Shaun', 'Fred', 'Jeremy'], 'who has voted comes first');
    assert.strictEqual(waiting, '1 voted · waiting for 3');
    assert.deepStrictEqual(results.find((r) => r[0] === 'Shaun'), ['Shaun', '·', '1', '·', '·', 'Tier A']);
    assert.deepStrictEqual(results.find((r) => r[0] === 'Jeremy'), ['Jeremy', '·', '·', '·', '·', '—']);
    assert.deepStrictEqual(tags, { Shaun: { tier: 'A', active: true }, Fred: { tier: 'B', active: true } });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a personal link opens straight to that player\'s ballot', async () => {
  const app = await H.open({ path: 'poll/index.html?club=padelchampionships&code=K7QM3P', readyWhen: () => window.__pollReady,
    documents: { tierPoll: { current: { players: ['Shaun', 'George'], open: true } }, tierPollCodes: { K7QM3P: { name: 'Shaun' } } } });
  try {
    await app.page.waitForSelector('#pollSend');
    const r = await app.run(() => ({ text: document.getElementById('pollMain').innerText, rows: [...document.querySelectorAll('.poll-row[data-player]')].map((x) => x.dataset.player) }));
    assert.match(r.text, /Hi Shaun/);
    assert.deepStrictEqual(r.rows, ['George']);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('who voted what: the counted ballots both ways round — no self-votes, skips listed, strongest first', () => {
  const players = ['Shaun', 'George', 'Fred'];
  const b = T.breakdown(players, [
    { voter: 'George', votes: { Shaun: 'A', Fred: 'S', George: 'S' } },
    { voter: 'Fred', votes: { Shaun: 'B' } },
    { voter: 'Shaun', votes: { Fred: 'A', George: 'C' } },
  ]);
  const row = (p) => b.byPlayer.find((r) => r.player === p);
  assert.deepStrictEqual(row('Shaun'), { player: 'Shaun', tiers: { S: [], A: ['George'], B: ['Fred'], C: [] }, skipped: [] });
  assert.deepStrictEqual(row('George'), { player: 'George', tiers: { S: [], A: [], B: [], C: ['Shaun'] }, skipped: ['Fred'] }, 'his own S is not a vote; Fred skipped him');
  assert.deepStrictEqual(b.byVoter.map((v) => [v.voter, v.votes.map((x) => `${x.player} ${x.tier}`)]),
    [['Fred', ['Shaun B']], ['George', ['Fred S', 'Shaun A']], ['Shaun', ['Fred A', 'George C']]]);
});

maybe('the Admin sees who voted what, by player or by voter, and can copy it; a voter never does', async () => {
  const accounts = { 'shaun@example.com': { password: 'pw', uid: 'u1' } };
  const admins = { u1: { role: 'owner', name: 'Shaun' } };
  const documents = {
    tierPoll: { current: { players: ['Shaun', 'George', 'Fred'], open: true } },
    tierPollCodes: { AAAAAA: { name: 'George' }, BBBBBB: { name: 'Fred' }, CCCCCC: { name: 'Shaun' } },
    tierPollBallots: {
      AAAAAA: { poll: 'current', voter: 'George', votes: { Shaun: 'A', Fred: 'S' }, createdAt: '1' },
      BBBBBB: { poll: 'current', voter: 'Fred', votes: { Shaun: 'B' }, createdAt: '2' },
    },
  };
  const app = await H.open({ path: 'poll/index.html?club=padelchampionships', readyWhen: () => window.__pollReady, accounts, admins, documents, viewport: { width: 390, height: 844 } });
  try {
    const page = app.page;
    const voterSees = await app.run(() => document.body.innerText);
    await app.run(() => {
      window.__copied = [];
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } }, configurable: true });
    });
    await page.click('#pollAdminOpen');
    await page.fill('#pollEmail', 'shaun@example.com'); await page.fill('#pollPassword', 'pw');
    await page.click('#pollSignIn');
    await page.waitForSelector('#pollWho');
    const byPlayer = await app.run(() => document.getElementById('pollWho').innerText.replace(/\n+/g, ' | '));
    await page.click('#pollWhoVoter');
    await page.waitForFunction(() => document.getElementById('pollWhoVoter').classList.contains('poll-alt') === false);
    const byVoter = await app.run(() => document.getElementById('pollWho').innerText.replace(/\n+/g, ' | '));
    await page.click('#pollWhoCopy');
    await page.waitForFunction(() => window.__copied.length === 1);
    const copied = await app.run(() => window.__copied[0]);
    const wide = await app.run(() => document.documentElement.scrollWidth);
    assert.ok(!/Who voted what/.test(voterSees), 'not on the voters\' page');
    assert.strictEqual(byPlayer, 'Shaun | A George (1) | B Fred (1) | George | Skipped: Fred | Fred | S George (1)');
    assert.strictEqual(byVoter, 'Fred | B Shaun (1) | George | S Fred (1) | A Shaun (1)');
    assert.strictEqual(copied, 'Padel Championships · Tier poll · who voted what\n\nFred\n  B: Shaun\n\nGeorge\n  S: Fred\n  A: Shaun');
    assert.strictEqual(wide, 390);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
