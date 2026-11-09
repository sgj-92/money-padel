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
    await page.click('.poll-codes [data-copy^="George|"]');
    await page.click('#pollCopyAll');
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
    await page.click('.poll-row[data-player="Jeremy"] [data-tier="S"]');
    await page.click('.poll-row[data-player="Jeremy"] [data-tier="S"]');   // tapped again: skipped
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
    assert.match(copied[0], new RegExp(`/poll/(index\\.html)?\\?code=${codes.George}$`));
    assert.strictEqual(copied[1].split('\n').length, 4);
    assert.deepStrictEqual(rows, ['Shaun', 'Fred', 'Jeremy'], 'George is not on his own ballot');
    assert.strictEqual(ballot.length, 1, 'one vote per code');
    assert.deepStrictEqual([ballot[0].id, ballot[0].voter, ballot[0].votes], [codes.George, 'George', { Shaun: 'A', Fred: 'B' }]);
    assert.deepStrictEqual(Object.keys(ballot[0]).filter((k) => k !== 'id').sort(), ['createdAt', 'poll', 'voter', 'votes'], 'exactly the fields the rules allow');
    assert.match(georgeRow, /✔/);
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
