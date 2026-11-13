// ===================== ASK CLAUDE (ADMINS ONLY) =====================
// Shaun, 13 Nov: "I want to be able to ask claude questions about the data,
// for admins only." Decided (Shaun): build it, every community, his own
// Anthropic key. Nothing here calls the real API: the client, the database
// and the network are all stand-ins.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Dataset = require('../lib/askClaude/dataset.js');
const { verifyAdmin, uidOf } = require('../lib/askClaude/admin.js');
const { ask, MODEL } = require('../lib/askClaude/ask.js');
const { handler } = require('../api/ask.js');
const { CLUBS } = require('../assets/js/config/club.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const ROOT = path.join(__dirname, '..');

const jwt = (payload) => ['x', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.');
const RECORD = {
  players: [{ id: 'Stormzy', displayName: 'Stormz', tier: 'B', rating: 1382.04, reliability: 0.81, lifetimeMatches: 43, classificationStatus: 'ESTABLISHED' },
    { id: 'Rishi', tier: 'A', rating: 1700, reliability: 0.9, lifetimeMatches: 50, classificationStatus: 'ESTABLISHED' },
    { id: 'Omar', tier: 'B', rating: 1400, reliability: 0.5, lifetimeMatches: 5, classificationStatus: 'PROVISIONAL' },
    { id: 'PDM', tier: 'A', rating: 1690, reliability: 0.9, lifetimeMatches: 60, classificationStatus: 'ESTABLISHED' }],
  matches: [
    { id: '2026-11-11-2', date: '2026-11-11', sourceIndex: 2, teamA: ['Rishi', 'PDM'], teamB: ['Stormzy', 'Omar'], sets: [{ teamA: 6, teamB: 4 }, { teamA: 3, teamB: 6 }], outcome: 'A_WINS', type: 'doubles',
      late: { by: ['Omar'], onTime: ['Stormzy'], playedOutcome: 'DRAW' } },
    { id: '2026-11-11-1', date: '2026-11-11', sourceIndex: 1, teamA: ['Stormzy', 'Rishi'], teamB: ['Omar', 'PDM'], sets: [{ teamA: 6, teamB: 0 }, { teamA: 6, teamB: 2 }], outcome: 'A_WINS', type: 'doubles' },
  ],
  journey: [{ id: 'j1', eventType: 'MATCH_UPDATE', playerId: 'Stormzy', effectiveDate: '2026-11-11', matchId: '2026-11-11-1', side: 'A', tierAtEvent: 'B',
    preMatchRating: 1370, postMatchRating: 1382.04, ratingDelta: 12.04, preMatchExpectedScore: 0.41, actualScore: 0.9 }],
  notes: { '2026-11-11-1': { asterisk: true, note: 'Disputed, score agreed' } },
  tags: { Omar: { tier: 'B', active: true } },
};

test('the data: three CSV files, display names, every match with its sets, the late and the notes', () => {
  const files = Dataset.build(RECORD);
  assert.deepStrictEqual(files.map((f) => f.filename), ['players.csv', 'matches.csv', 'rating_journey.csv']);
  const [players, matches, journey] = files.map((f) => f.text.trim().split('\n'));
  assert.ok(players.some((l) => l.startsWith('Stormz,B,1382,')), 'shown under the name the club sees');
  assert.ok(!players.join('\n').includes('Stormzy'));
  assert.strictEqual(matches.length, 3);
  assert.match(matches[1], /^2026-11-11-1,2026-11-11,doubles,Stormz,Rishi,Omar,PDM,side A won,6-0 6-2,2,0,12,2,,,,,,yes,"?Disputed, score agreed"?$/, 'in played order');
  assert.match(matches[2], /,Omar,Stormz,draw,,$/, 'the late arrival: who, who was on time, as played');
  assert.match(journey[1], /^2026-11-11,Stormz,MATCH_UPDATE,2026-11-11-1,A,B,1370,1382,12.04,0.41,0.9,,$/);
});

test('who may ask: only a token the community\'s database accepts for an Admin entry', async () => {
  const calls = [];
  const fakeFetch = (status, body) => async (url, opts) => { calls.push({ url, auth: opts && opts.headers && opts.headers.Authorization }); return { ok: status === 200, status, json: async () => body }; };
  const token = jwt({ user_id: 'uid-shaun', aud: 'mp-dashboard-beta-v3' });
  assert.strictEqual(uidOf(token), 'uid-shaun');
  assert.deepStrictEqual(await verifyAdmin({ token: '', projectId: 'p', fetchImpl: fakeFetch(200, {}) }), { ok: false, status: 401, message: 'Sign in as an Admin first.' });
  assert.strictEqual((await verifyAdmin({ token: 'nonsense', projectId: 'p', fetchImpl: fakeFetch(200, {}) })).ok, false);
  assert.strictEqual(calls.length, 0, 'no token, no request');
  const ok = await verifyAdmin({ token, projectId: 'mp-dashboard-beta-v3', fetchImpl: fakeFetch(200, { fields: { name: { stringValue: 'Shaun' }, role: { stringValue: 'owner' } } }) });
  assert.deepStrictEqual(ok, { ok: true, uid: 'uid-shaun', name: 'Shaun', role: 'owner' });
  assert.strictEqual(calls[0].url, 'https://firestore.googleapis.com/v1/projects/mp-dashboard-beta-v3/databases/(default)/documents/admins/uid-shaun');
  assert.strictEqual(calls[0].auth, `Bearer ${token}`, 'asked WITH the token, so the database checks it');
  assert.deepStrictEqual(await verifyAdmin({ token, projectId: 'p', fetchImpl: fakeFetch(404, {}) }), { ok: false, status: 403, message: 'Only an Admin can ask Claude.' }, 'a member');
  assert.deepStrictEqual(await verifyAdmin({ token, projectId: 'p', fetchImpl: fakeFetch(401, {}) }), { ok: false, status: 401, message: 'Your sign-in has expired. Sign in again.' }, 'forged or expired');
});

function fakeClient({ responses, failOn }) {
  const log = { uploads: [], deleted: [], requests: [] };
  let n = 0;
  return {
    log,
    files: {
      async upload(p) { const id = `file_${log.uploads.length + 1}`; log.uploads.push({ id, name: p.file.name, expires: p.expires_in_seconds, text: await p.file.text() }); return { id }; },
      async delete(id) { log.deleted.push(id); return { id }; },
    },
    beta: { messages: { async create(params) {
      log.requests.push(JSON.parse(JSON.stringify(params)));
      if (failOn === n) { n++; throw Object.assign(new Error('boom'), { status: 500 }); }
      return responses[n++];
    } } },
  };
}

test('the call: the files go to the sandbox, the model works with code, a paused turn carries on, and the files are deleted', async () => {
  const club = CLUBS.moneypadel;
  const client = fakeClient({ responses: [
    { stop_reason: 'pause_turn', container: { id: 'cont_1' }, content: [{ type: 'text', text: 'Working…' }] },
    { stop_reason: 'end_turn', model: MODEL, container: { id: 'cont_1' }, content: [{ type: 'text', text: 'Stormz has won **2** 6-0 sets.' }] },
  ] });
  const out = await ask({ client, club, question: 'Who has the most 6-0 sets?', history: [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Hello' }],
    files: Dataset.build(RECORD), today: '2026-11-13' });
  assert.strictEqual(out.answer, 'Stormz has won **2** 6-0 sets.');
  assert.deepStrictEqual(client.log.uploads.map((u) => [u.name, u.expires]), [['players.csv', 3600], ['matches.csv', 3600], ['rating_journey.csv', 3600]]);
  const [first, second] = client.log.requests;
  assert.strictEqual(first.model, 'claude-opus-5-5');
  assert.deepStrictEqual(first.tools, [{ type: 'code_execution_20260521', name: 'code_execution' }]);
  assert.strictEqual(first.fallbacks, 'default');
  assert.match(first.system, /Money Padel/);
  assert.match(first.system, /never estimate a number/);
  const last = first.messages[first.messages.length - 1];
  assert.deepStrictEqual(last.content.slice(0, 3), ['file_1', 'file_2', 'file_3'].map((id) => ({ type: 'container_upload', file_id: id })));
  assert.match(last.content[3].text, /^Today is 2026-11-13\.\n\nWho has the most 6-0 sets\?$/);
  assert.deepStrictEqual(first.messages.slice(0, 2), [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }]);
  assert.strictEqual(second.container, 'cont_1', 'the paused turn goes back to the same sandbox');
  assert.strictEqual(second.messages[second.messages.length - 1].role, 'assistant');
  assert.deepStrictEqual(client.log.deleted.sort(), ['file_1', 'file_2', 'file_3']);

  const failing = fakeClient({ responses: [], failOn: 0 });
  await assert.rejects(ask({ client: failing, club, question: 'x', files: Dataset.build(RECORD), today: '2026-11-13' }));
  assert.strictEqual(failing.log.deleted.length, 3, 'deleted on failure too');

  const refusing = fakeClient({ responses: [{ stop_reason: 'refusal', content: [] }] });
  assert.strictEqual((await ask({ client: refusing, club, question: 'x', files: [], today: 't' })).answer, 'Claude declined to answer that question.');
});

function fakeRes() {
  const r = { statusCode: 0, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = JSON.parse(b); } };
  return r;
}
function firestoreFake({ admin }) {
  const seen = [];
  const fetch = async (url, opts) => {
    seen.push(url);
    if (url.includes('/admins/')) return admin ? { ok: true, status: 200, json: async () => ({ fields: { name: { stringValue: 'Shaun' } } }) } : { ok: false, status: 404, json: async () => ({}) };
    if (url.includes('/documents/moneypadel/')) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ documents: [] }) };
  };
  return { fetch, seen };
}

test('the endpoint: POST only, Admins only, says when it is not switched on, and asks about the community whose address it came to', async () => {
  const token = jwt({ user_id: 'uid-shaun' });
  const req = (host, extra) => ({ method: 'POST', headers: { host, authorization: `Bearer ${token}` }, body: { question: 'How many games?' }, ...extra });
  let r = fakeRes(); await handler({ method: 'GET', headers: {} }, r, {});
  assert.strictEqual(r.statusCode, 405);

  let fs1 = firestoreFake({ admin: false });
  r = fakeRes(); await handler(req('moneypadel.sgj.luxe'), r, { fetch: fs1.fetch, apiKey: 'k', ask: async () => { throw new Error('must not ask'); } });
  assert.deepStrictEqual([r.statusCode, r.body.error], [403, 'Only an Admin can ask Claude.']);

  fs1 = firestoreFake({ admin: true });
  r = fakeRes(); await handler(req('moneypadel.sgj.luxe'), r, { fetch: fs1.fetch, apiKey: '' });
  assert.strictEqual(r.statusCode, 503);
  assert.match(r.body.error, /ANTHROPIC_API_KEY/);

  const pc = firestoreFake({ admin: true });
  let asked = null;
  r = fakeRes(); await handler(req('padelchamps.sgj.luxe'), r, { fetch: pc.fetch, apiKey: 'k', client: {}, ask: async (a) => { asked = a; return { answer: 'Twelve.', model: MODEL }; } });
  assert.deepStrictEqual([r.statusCode, r.body], [200, { answer: 'Twelve.', model: MODEL }]);
  assert.strictEqual(asked.club.id, 'padelchampionships');
  assert.ok(pc.seen.every((u) => u.includes('/projects/mp---dashboard/')), 'its own database only');
  assert.strictEqual(r.headers['Cache-Control'], 'no-store');

  r = fakeRes(); await handler(req('moneypadel.sgj.luxe', { body: { question: '   ' } }), r, { fetch: firestoreFake({ admin: true }).fetch, apiKey: 'k' });
  assert.deepStrictEqual([r.statusCode, r.body.error], [400, 'Type a question first.']);
});

test('deployed: the endpoint is a Vercel function with time to work, and the standings sites leave it alone', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.strictEqual(cfg.functions['api/ask.js'].maxDuration, 120);
  cfg.redirects.filter((x) => x.has).forEach((rule) => assert.ok(!new RegExp('^' + rule.source + '$').test('/api/ask'), 'not sent home'));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies['@anthropic-ai/sdk']);
  assert.ok(!fs.readFileSync(path.join(ROOT, 'assets/js/features/admin/askClaudeScreen.js'), 'utf8').includes('sk-ant'), 'no key in the page');
});

maybe('Admin › Ask Claude: a signed-in Admin asks, the answer shows with Copy, a follow-up carries the conversation; the shared password cannot', async () => {
  const app = await H.open({ accounts: { 'shaun@example.com': { password: 'pw', uid: 'uid-shaun' } }, admins: { 'uid-shaun': { role: 'owner', name: 'Shaun' } },
    signedIn: 'shaun@example.com', viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      const sent = [];
      let reply = 0;
      window.fetch = async (url, opts) => {
        sent.push({ url, auth: opts.headers.Authorization, body: JSON.parse(opts.body) });
        reply++;
        return { ok: true, status: 200, json: async () => ({ answer: reply === 1 ? 'KC has won **3** 6-0 sets.\n- 2 in October\n- 1 in November' : 'Against Tier S, none.' }) };
      };
      for (let k = 0; k < 100 && !signedInAdmin; k++) await new Promise((res) => setTimeout(res, 20));
      isUnlocked = true; adminRole = 'owner';
      document.querySelector('#tabrow .tab-btn[data-tab="manage"]').click();
      adminOpenSections.ask = true; renderManage();
      document.getElementById('askClaudeQ').value = 'Who has the most 6-0 sets?';
      await sendAskClaude();
      const first = document.querySelector('[data-acc="ask"]').innerText;
      const bold = document.querySelector('.ask-a-text b') && document.querySelector('.ask-a-text b').textContent;
      document.getElementById('askClaudeQ').value = 'And against Tier S?';
      await sendAskClaude();
      const answers = [...document.querySelectorAll('.ask-a-text')].map((e) => e.innerText);
      // The shared password: no account, no asking.
      signedInAdmin = null; askClaudeLog = []; renderManage();
      const locked = document.querySelector('[data-acc="ask"]').innerText;
      return { sent, first, bold, answers, locked, wide: document.documentElement.scrollWidth };
    });
    assert.deepStrictEqual(r.sent.map((s) => [s.url, s.auth]), [['/api/ask', 'Bearer token-uid-shaun'], ['/api/ask', 'Bearer token-uid-shaun']]);
    assert.deepStrictEqual(r.sent[0].body, { question: 'Who has the most 6-0 sets?', history: [] });
    assert.deepStrictEqual(r.sent[1].body.history, [{ role: 'user', text: 'Who has the most 6-0 sets?' }, { role: 'assistant', text: 'KC has won **3** 6-0 sets.\n- 2 in October\n- 1 in November' }]);
    assert.match(r.first, /Who has the most 6-0 sets\?/);
    assert.match(r.first, /Copy/);
    assert.strictEqual(r.bold, '3');
    assert.strictEqual(r.answers.length, 2);
    assert.match(r.locked, /Sign in with your own Admin account to ask Claude/);
    assert.strictEqual(r.wide, 390);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('Ask Claude: a refusal from the server is shown, and the question is kept to try again', async () => {
  const app = await H.open({ accounts: { 's@x': { password: 'pw', uid: 'u1' } }, admins: { u1: { role: 'owner', name: 'Shaun' } }, signedIn: 's@x' });
  try {
    const r = await app.run(async () => {
      window.fetch = async () => ({ ok: false, status: 503, json: async () => ({ error: 'Ask Claude isn’t switched on yet: add ANTHROPIC_API_KEY in Vercel.' }) });
      for (let k = 0; k < 100 && !signedInAdmin; k++) await new Promise((res) => setTimeout(res, 20));
      isUnlocked = true; adminRole = 'owner';
      document.querySelector('#tabrow .tab-btn[data-tab="manage"]').click();
      adminOpenSections.ask = true; renderManage();
      document.getElementById('askClaudeQ').value = 'Longest winning streak?';
      await sendAskClaude();
      return { text: document.querySelector('[data-acc="ask"]').innerText, kept: document.getElementById('askClaudeQ').value };
    });
    assert.match(r.text, /isn’t switched on yet/);
    assert.strictEqual(r.kept, 'Longest winning streak?');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
