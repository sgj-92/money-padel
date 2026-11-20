// ===================== NOTIFICATIONS =====================
// Shaun, 19 Nov: players "receive notifications". Decided: phone
// notifications, Padel Championships first. Nothing here reaches a real
// phone, Firebase or push service: they are all stand-ins.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const N = require('../assets/js/domain/fixtures/fixtureNotices.js');
const { handler } = require('../api/notify.js');
const Push = require('../lib/notify/push.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const ROOT = path.join(__dirname, '..');
const RULES = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');

const req = (over) => ({ id: 'r1', players: ['Kaz', 'Len', 'Max', 'Tom'], requestedBy: 'Kaz', status: 'pending', courtBookingMade: false, preferredDate: '2026-11-23', preferredTime: '21:00', ...over });
const when = (r) => `${r.preferredDate} ${r.preferredTime}`;

test('who is told what: a request, all four in, court booked, a cancellation; nothing for a change nobody needs to hear', () => {
  const asked = N.between([], [req()], { when });
  assert.deepStrictEqual(asked, [{ to: ['Len', 'Max', 'Tom'], tag: 'fixture-r1', title: 'Game request', body: 'Kaz asked you to play: Kaz & Len v Max & Tom · 2026-11-23 21:00. Answer in Play.' }]);
  const allIn = N.between([req()], [req({ status: 'confirmed' })], { when });
  assert.strictEqual(allIn[0].title, 'Game on');
  assert.deepStrictEqual(allIn[0].to, ['Kaz', 'Len', 'Max', 'Tom']);
  assert.match(allIn[0].body, /All four are in: .* Court not booked yet\./);
  const booked = N.between([req({ status: 'confirmed' })], [req({ status: 'confirmed', courtBookingMade: true, location: 'Origin' })], { when });
  assert.deepStrictEqual([booked[0].title, booked[0].body], ['Court booked', 'Kaz & Len v Max & Tom · 2026-11-23 21:00 · Origin.']);
  const added = N.between([], [req({ status: 'confirmed', courtBookingMade: true })], { when });
  assert.strictEqual(added[0].title, 'Court booked', 'an Admin adding an already-booked game');
  const off = N.between([req({ status: 'confirmed' })], [req({ status: 'removed' })], { when });
  assert.deepStrictEqual([off[0].title, off[0].body], ['Game cancelled', 'Kaz & Len v Max & Tom · 2026-11-23 21:00 is off.']);
  assert.deepStrictEqual(N.between([req()], [req({ preferredTime: '20:00' })], { when }), [], 'a time moved: nothing');
  assert.deepStrictEqual(N.between([req({ status: 'confirmed', courtBookingMade: true })], [req({ status: 'confirmed', courtBookingMade: true })]), [], 'no change: nothing');
});

test('the rules: phones are read and tidied by signed-in members, and signed up only for the player whose code signed in', () => {
  assert.match(RULES, /match \/pushSubscriptions\/\{id\} \{\s*allow read, delete: if isAdmin\(\) \|\| \(request\.auth != null\s*&& exists\(\/databases\/\$\(database\)\/documents\/playerAccounts\/\$\(request\.auth\.uid\)\)\);\s*allow create, update: if isAdmin\(\) \|\| \(request\.auth != null\s*&& get\(\/databases\/\$\(database\)\/documents\/playerAccounts\/\$\(request\.auth\.uid\)\)\.data\.player == request\.resource\.data\.player\);/);
  assert.ok(!/VAPID_PRIVATE_KEY\s*=\s*['"]/.test(fs.readFileSync(path.join(ROOT, 'lib/notify/push.js'), 'utf8')), 'the private key is never in the repository');
  const page = fs.readFileSync(path.join(ROOT, 'assets/js/features/players/notificationsScreen.js'), 'utf8');
  assert.ok(page.includes(`'${Push.VAPID_PUBLIC_KEY}'`), 'the page and the server use the same public key');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).functions['api/notify.js'].maxDuration, 30);
  assert.ok(fs.existsSync(path.join(ROOT, 'sw.js')), 'the phone\'s side lives at the site\'s root');
});

const jwt = (payload) => ['x', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.');
function fakeRes() { return { statusCode: 0, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = JSON.parse(b); } }; }
function firestore({ playerOf, admin, subs }) {
  const seen = [];
  const fetch = async (url, opts = {}) => {
    seen.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
    if (url.includes('/admins/')) return admin ? { ok: true, status: 200, json: async () => ({ fields: { name: { stringValue: 'Shaun' } } }) } : { ok: false, status: 403, json: async () => ({}) };
    if (url.includes('/playerAccounts/')) return playerOf ? { ok: true, status: 200, json: async () => ({ fields: { player: { stringValue: playerOf } } }) } : { ok: false, status: 404, json: async () => ({}) };
    if (url.endsWith(':runQuery')) return { ok: true, status: 200, json: async () => subs.map((s, i) => ({ document: { name: `projects/p/databases/(default)/documents/pushSubscriptions/s${i}`,
      fields: { player: { stringValue: s.player }, endpoint: { stringValue: s.endpoint }, p256dh: { stringValue: 'k' }, auth: { stringValue: 'a' } } } })) };
    if (opts.method === 'DELETE') return { ok: true, status: 200, json: async () => ({}) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetch, seen };
}
const post = (host, body, token) => ({ method: 'POST', headers: { host, authorization: token ? `Bearer ${token}` : '' }, body });

test('the server: signed-in members only, says when it is not switched on, sends to every phone of the players named, forgets phones that have gone', async () => {
  const token = jwt({ user_id: 'uid-kaz' });
  const subs = [{ player: 'Len', endpoint: 'https://push.example/len' }, { player: 'Max', endpoint: 'https://push.example/max-gone' }];
  let r = fakeRes();
  await handler({ method: 'GET', headers: {} }, r, {});
  assert.strictEqual(r.statusCode, 405);
  r = fakeRes();
  await handler(post('moneypadel.sgj.luxe', { to: ['Len'], title: 'x' }, token), r, {});
  assert.strictEqual(r.statusCode, 503, 'Money Padel has no player notifications yet');
  const nobody = firestore({ subs });
  r = fakeRes();
  await handler(post('padelchamps.sgj.luxe', { to: ['Len'], title: 'x' }, token), r, { fetch: nobody.fetch, privateKey: 'pk' });
  assert.strictEqual(r.statusCode, 403, 'a token with no player behind it');
  const fs1 = firestore({ playerOf: 'Kaz', subs });
  r = fakeRes();
  await handler(post('padelchamps.sgj.luxe', { to: ['Len'], title: 'x' }, token), r, { fetch: fs1.fetch, privateKey: '' });
  assert.strictEqual(r.statusCode, 503);
  assert.match(r.body.error, /VAPID_PRIVATE_KEY must be set/);
  const sent = [];
  const webpush = { async sendNotification(sub, payload, opts) {
    sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload), publicKey: opts.vapidDetails.publicKey, subject: opts.vapidDetails.subject });
    if (sub.endpoint.endsWith('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
  } };
  const fs2 = firestore({ playerOf: 'Kaz', subs });
  r = fakeRes();
  await handler(post('padelchamps.sgj.luxe', { to: ['Len', 'Max', 'Len'], title: 'Game request', body: 'Kaz asked you to play' }, token), r, { fetch: fs2.fetch, privateKey: 'pk', webpush });
  assert.deepStrictEqual([r.statusCode, r.body.sent, r.body.gone, r.body.phones, r.body.from], [200, 1, 1, 2, 'Kaz']);
  const query = fs2.seen.find((s) => s.url.endsWith(':runQuery')).body.structuredQuery.where.fieldFilter;
  assert.deepStrictEqual(query.value.arrayValue.values, [{ stringValue: 'Len' }, { stringValue: 'Max' }], 'each name once');
  assert.strictEqual(sent[0].payload.title, 'Padel Champs · Game request');
  assert.strictEqual(sent[0].publicKey, Push.VAPID_PUBLIC_KEY);
  assert.strictEqual(sent[0].subject, 'https://padelchamps.sgj.luxe');
  assert.ok(fs2.seen.some((s) => s.method === 'DELETE' && s.url.endsWith('/pushSubscriptions/s1')), 'the gone phone is forgotten');

  // Shaun, 20 Nov: "I still can't get notifications" -- every failure says which step.
  const none = firestore({ playerOf: 'Kaz', subs: [] });
  r = fakeRes();
  await handler(post('padelchamps.sgj.luxe', { to: ['Len'], title: 'x' }, token), r, { fetch: none.fetch, privateKey: 'pk', webpush });
  assert.deepStrictEqual([r.statusCode, r.body.phones, r.body.sent], [200, 0, 0], 'nobody signed up: said, not an error');
  const denied = firestore({ playerOf: 'Kaz', subs });
  const deniedFetch = async (url, opts) => (url.endsWith(':runQuery') ? { ok: false, status: 403, json: async () => ({}) } : denied.fetch(url, opts));
  r = fakeRes();
  await handler(post('padelchamps.sgj.luxe', { to: ['Len'], title: 'x' }, token), r, { fetch: deniedFetch, privateKey: 'pk', webpush });
  assert.strictEqual(r.statusCode, 502);
  assert.match(r.body.error, /Couldn’t read who has notifications on \(403\)\. Publish the latest database rules/);
  const refusing = { async sendNotification() { throw Object.assign(new Error('bad'), { statusCode: 403, body: 'invalid JWT' }); } };
  const fs3 = firestore({ playerOf: 'Kaz', subs: [subs[0]] });
  r = fakeRes();
  await handler(post('padelchamps.sgj.luxe', { to: ['Len'], title: 'x' }, token), r, { fetch: fs3.fetch, privateKey: 'wrong', webpush: refusing });
  assert.deepStrictEqual([r.body.sent, r.body.failed, r.body.problems], [0, 1, [{ status: 403, detail: 'invalid JWT' }]], 'what the push service said, so the test can say why');
});

const EMPTY = { players: [], matches: [], ratingJourney: [] };
const TAGS = { moneypadel_player_tags: { Kaz: { tier: 'A', active: true }, Len: { tier: 'B', active: true }, Max: { tier: 'B', active: true }, Tom: { tier: 'B', active: true } } };

maybe('a signed-in player turns notifications on, and a request they make tells the other three', async () => {
  const email = 'pkazkazkaz1@players.sgj.luxe';
  const app = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, club: TAGS, now: '2026-11-19T10:00:00.000Z',
    accounts: { [email]: { password: '472915', uid: 'uid-kaz' } }, signedIn: email, documents: { playerAccounts: { 'uid-kaz': { player: 'Kaz' } } } });
  try {
    const r = await app.run(async () => {
      for (let k = 0; k < 100 && !signedInPlayer; k++) await new Promise((res) => setTimeout(res, 20));
      // A phone that can: a stand-in service worker and push service.
      let sub = null;
      const pushManager = { async getSubscription() { return sub; }, async subscribe() { sub = { endpoint: 'https://push.example/kaz', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'pk', auth: 'au' } }; }, async unsubscribe() { sub = null; } }; return sub; } };
      Object.defineProperty(navigator, 'serviceWorker', { value: { async register() { return { pushManager }; }, ready: Promise.resolve(), async getRegistration() { return { pushManager }; } }, configurable: true });
      window.PushManager = function () {};
      window.Notification = { permission: 'default', async requestPermission() { return 'granted'; } };
      const calls = [];
      window.fetch = async (url, opts) => { calls.push({ url, auth: opts.headers.Authorization, body: JSON.parse(opts.body) }); return { ok: true, json: async () => ({ sent: 3 }) }; };
      await openNotificationsSheet();
      document.querySelector('#notificationsSheet .nt-on').click();
      for (let k = 0; k < 100 && !/are on/.test(document.querySelector('#notificationsSheet .nt-msg').textContent); k++) await new Promise((res) => setTimeout(res, 20));
      const msg = document.querySelector('#notificationsSheet .nt-msg').textContent;
      const saved = window.__writes.filter((w) => w.collection === 'pushSubscriptions').pop();
      // A request: the other three are told; Kaz is not.
      const made = await submitGameRequest({ names: ['Kaz', 'Len', 'Max', 'Tom'], requestedBy: 'Kaz', date: '2026-11-23', time: '21:00' });
      await new Promise((res) => setTimeout(res, 50));
      return { msg, saved: saved && { player: saved.doc.player, endpoint: saved.doc.endpoint, p256dh: saved.doc.p256dh }, made: made.ok, calls };
    });
    assert.match(r.msg, /Notifications are on for this phone/);
    assert.deepStrictEqual(r.saved, { player: 'Kaz', endpoint: 'https://push.example/kaz', p256dh: 'pk' });
    assert.ok(r.made);
    const notify = r.calls.filter((c) => c.url === '/api/notify');
    assert.strictEqual(notify.length, 1);
    assert.deepStrictEqual(notify[0].body.to, ['Len', 'Max', 'Tom']);
    assert.strictEqual(notify[0].body.title, 'Game request');
    assert.match(notify[0].body.body, /^Kaz asked you to play: Kaz & Len v Max & Tom · Mon 23 Nov 21:00\. Answer in Play\.$/);
    assert.strictEqual(notify[0].auth, 'Bearer token-uid-kaz');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('on an iPhone not opened from the Home Screen, it says how to add it first', async () => {
  const app = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, club: TAGS });
  try {
    const r = await app.run(async () => {
      Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', configurable: true });
      signedInPlayer = { uid: 'u', name: 'Kaz' };
      await openNotificationsSheet();
      return document.getElementById('notificationsSheet').textContent.replace(/\s+/g, ' ');
    });
    assert.match(r, /only work for the app saved to your Home Screen/);
    assert.match(r, /Tap Add to Home Screen, then Add/);
    assert.ok(!/Turn on notifications/.test(r));
  } finally { await app.close(); }
});

maybe('Send me a test puts this phone back on the list first, and says in words what went wrong', async () => {
  const email = 'pshaunshaun@players.sgj.luxe';
  const app = await H.open({ path: 'index.html?club=padelchampionships', record: EMPTY, club: TAGS,
    accounts: { [email]: { password: '472915', uid: 'uid-s' } }, signedIn: email, documents: { playerAccounts: { 'uid-s': { player: 'Kaz' } } } });
  try {
    const r = await app.run(async () => {
      for (let k = 0; k < 100 && !signedInPlayer; k++) await new Promise((res) => setTimeout(res, 20));
      const sub = { endpoint: 'https://push.example/kaz', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'pk', auth: 'au' } }; } };
      const pushManager = { async getSubscription() { return sub; } };
      Object.defineProperty(navigator, 'serviceWorker', { value: { async getRegistration() { return { pushManager }; } }, configurable: true });
      window.PushManager = function () {};
      window.Notification = { permission: 'granted' };
      const replies = [{ sent: 0, phones: 0 }, { sent: 0, phones: 1, failed: 1, problems: [{ status: 403, detail: 'x' }] }, { error: 'Notifications aren’t switched on for this deployment' }, { sent: 1, phones: 1 }];
      window.fetch = async () => ({ ok: true, status: 200, json: async () => replies.shift() });
      const said = [];
      await openNotificationsSheet();
      await new Promise((res) => setTimeout(res, 50));
      const rewrote = window.__writes.filter((w) => w.collection === 'pushSubscriptions').length;
      for (let i = 0; i < 4; i++) {
        document.querySelector('#notificationsSheet .nt-test').click();
        for (let k = 0; k < 50 && !document.querySelector('#notificationsSheet .nt-msg').textContent; k++) await new Promise((res) => setTimeout(res, 20));
        await new Promise((res) => setTimeout(res, 60));
        said.push(document.querySelector('#notificationsSheet .nt-msg').textContent);
      }
      return { rewrote, said };
    });
    assert.ok(r.rewrote >= 1, 'opening the sheet puts this phone on the list');
    assert.match(r.said[0], /No phone found for you/);
    assert.match(r.said[1], /refused the key \(403\)\. Check VAPID_PRIVATE_KEY/);
    assert.match(r.said[2], /switched on for this deployment/);
    assert.match(r.said[3], /Sent\./);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
