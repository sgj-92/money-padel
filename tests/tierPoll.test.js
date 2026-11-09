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

test('counting: one ballot per voter (the latest), skips are not votes, the middle vote is suggested, a split goes down', () => {
  const players = ['Shaun', 'George', 'Fred'];
  const t = T.tally(players, [
    { voter: 'George', votes: { Shaun: 'A', Fred: 'S' }, updatedAt: '2026-11-09T10:00' },
    { voter: 'george', votes: { Shaun: 'S', Fred: 'S' }, updatedAt: '2026-11-09T11:00' },  // replaces the one above
    { voter: 'Fred', votes: { Shaun: 'B', Nobody: 'A', George: 'X' }, updatedAt: '2026-11-09T10:00' },
    { voter: 'Shaun', votes: { Fred: 'A', George: 'C' }, updatedAt: '2026-11-09T10:00' },
  ]);
  assert.deepStrictEqual(t.voters, ['Fred', 'george', 'Shaun']);
  const row = (p) => t.rows.find((r) => r.player === p);
  assert.deepStrictEqual(row('Shaun').counts, { S: 1, A: 0, B: 1, C: 0 });
  assert.strictEqual(row('Shaun').suggested, 'B', 'an even split goes to the lower tier');
  assert.deepStrictEqual([row('Fred').votes, row('Fred').suggested], [2, 'A'], 'S and A: the lower, A');
  assert.deepStrictEqual([row('George').votes, row('George').suggested], [1, 'C'], 'an invalid tier is not a vote');
  assert.strictEqual(T.median(['S', 'S', 'C']), 'S', 'one outlier does not move it');
});

test('the rules: anyone may cast a ballot of the right shape; only an Admin reads ballots or changes the list', () => {
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/tierPoll\/\{id\}\s*\{ allow read: if true; allow write: if isAdmin\(\); \}/);
  const ballots = rules.split('match /tierPollBallots/{id}')[1].split('}')[0];
  assert.match(ballots, /allow create, update: if request\.resource\.data\.keys\(\)\.hasOnly\(\['poll', 'voter', 'votes', 'updatedAt'\]\)/);
  assert.match(ballots, /allow read, delete: if isAdmin\(\);/);
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

maybe('the page: an Admin lists the players and opens it; a player votes; the Admin sees the counts and sets the starting tiers', async () => {
  const accounts = { 'shaun@example.com': { password: 'pw', uid: 'u1' } };
  const admins = { u1: { role: 'owner', name: 'Shaun' } };
  const app = await H.open({ path: 'poll/index.html?club=padelchampionships', readyWhen: () => window.__pollReady, accounts, admins, viewport: { width: 390, height: 844 } });
  try {
    const page = app.page;
    const before = await app.run(() => ({ text: document.getElementById('pollMain').innerText, title: document.title }));
    // The Admin.
    await page.click('#pollAdminOpen');
    await page.fill('#pollEmail', 'shaun@example.com'); await page.fill('#pollPassword', 'pw');
    await page.click('#pollSignIn');
    await page.waitForSelector('#pollPlayers');
    await page.fill('#pollPlayers', 'Shaun\nGeorge\nFred\nJeremy');
    await page.click('#pollSave');
    await page.waitForFunction(() => /closed/.test(document.getElementById('pollAdminMsg').innerText));
    await page.click('#pollToggle');
    await page.waitForFunction(() => /open/.test(document.getElementById('pollAdminMsg').innerText) && !!document.getElementById('pollVoter'));
    // A player.
    await page.selectOption('#pollVoter', 'George');
    await page.click('.poll-row[data-player="Shaun"] [data-tier="A"]');
    await page.click('.poll-row[data-player="Fred"] [data-tier="B"]');
    await page.click('.poll-row[data-player="Jeremy"] [data-tier="S"]');
    await page.click('.poll-row[data-player="Jeremy"] [data-tier="S"]');   // tapped again: skipped
    await page.click('#pollSend');
    await page.waitForFunction(() => /Saved/.test(document.getElementById('pollMsg').innerText));
    const ballot = await app.run(() => window.__writes.filter((w) => w.collection === 'tierPollBallots').map((w) => w.doc));
    // Results, then starting tiers.
    // Closing and reopening redraws the Admin panel with the new ballot counted.
    await page.click('#pollToggle'); await page.click('#pollToggle');
    await page.waitForFunction(() => /1 voter/.test(document.getElementById('pollAdmin').innerText));
    const results = await app.run(() => [...document.querySelectorAll('.poll-results tbody tr')].map((tr) => [...tr.children].map((td) => td.innerText)));
    await page.click('#pollUse');
    await page.waitForFunction(() => /Set as starting tiers/.test(document.getElementById('pollUseMsg').innerText));
    const tags = await app.run(() => JSON.parse(window.__writes.filter((w) => w.collection === 'moneypadel' && w.id === 'moneypadel_player_tags').slice(-1)[0].doc.value));
    assert.match(before.text, /isn’t ready yet/);
    assert.strictEqual(before.title, 'Padel Championships · Tier poll');
    assert.strictEqual(ballot.length, 1);
    assert.deepStrictEqual([ballot[0].voter, ballot[0].votes], ['George', { Shaun: 'A', Fred: 'B' }]);
    assert.deepStrictEqual(Object.keys(ballot[0]).sort(), ['poll', 'updatedAt', 'voter', 'votes'], 'exactly the fields the rules allow');
    assert.deepStrictEqual(results.find((r) => r[0] === 'Shaun'), ['Shaun', '·', '1', '·', '·', 'Tier A']);
    assert.deepStrictEqual(results.find((r) => r[0] === 'Jeremy'), ['Jeremy', '·', '·', '·', '·', '—']);
    assert.deepStrictEqual(tags, { Shaun: { tier: 'A', active: true }, Fred: { tier: 'B', active: true } });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
