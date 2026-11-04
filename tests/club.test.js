// ===================== ONE APP, MANY COMMUNITIES =====================
// Shaun, 4 Nov: white-label the app for other padel communities, starting with
// Padel Championships (Dubai). Everything that is one community's lives in
// assets/js/config/club.js; these tests hold the rest of the app to that.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../assets/js/config/club.js');
const H = require('./helpers/uiHarness.js');
const { appScriptFiles } = require('./helpers/appSource.js');

const maybe = H.available() ? test : test.skip;
const ROOT = path.join(__dirname, '..');

test('the address chooses the community; every address Money Padel has used stays Money Padel', () => {
  const at = (hostname, search = '') => C.resolveClub({ hostname, search }).id;
  ['moneypadel.sgj.luxe', 'mpstandings.sgj.luxe', 'mpr.sgj.luxe', 'mp-dashboard-new-ratings.vercel.app',
    'money-padel-git-redesign-sgj-92.vercel.app', 'localhost', '127.0.0.1'].forEach((h) => assert.strictEqual(at(h), 'moneypadel', h));
  // ?club= only where no community claims the address: a laptop, the tests.
  assert.strictEqual(at('localhost', '?club=padelchampionships'), 'padelchampionships');
  assert.strictEqual(at('moneypadel.sgj.luxe', '?club=padelchampionships'), 'moneypadel', 'a community\'s own domain cannot be turned into another\'s');
  assert.strictEqual(at('localhost', '?club=nobody'), 'moneypadel');
  assert.strictEqual(C.CLUB.id, 'moneypadel', 'in Node, Money Padel');
});

test('every community says what the screens need', () => {
  Object.values(C.CLUBS).forEach((c) => {
    ['id', 'name', 'resultsGroup', 'appTitle', 'homeScreenTitle', 'productName', 'fileSlug', 'logo', 'monogram'].forEach((k) =>
      assert.ok(typeof c[k] === 'string' && c[k], `${c.id}: ${k}`));
    assert.ok(Array.isArray(c.wordmark) && c.wordmark.length, `${c.id}: wordmark`);
    assert.match(c.fileSlug, /^[a-z0-9-]+$/);
    assert.ok(fs.existsSync(path.join(ROOT, c.logo)), `${c.id}: ${c.logo} exists`);
    assert.ok(c.firebase === null || (c.firebase.projectId && c.firebase.apiKey), `${c.id}: a whole Firebase config, or none yet`);
  });
});

test('every standings domain has its redirect rule in vercel.json', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  Object.values(C.CLUBS).filter((c) => c.standingsDomain).forEach((c) => {
    assert.ok(c.standingsHosts.some((re) => re.test(c.standingsDomain)), `${c.id}: its standings domain is one of its standings hosts`);
    assert.ok((cfg.redirects || []).some((r) => (r.has || []).some((h) => h.type === 'host' && h.value === c.standingsDomain)),
      `${c.id}: vercel.json keeps ${c.standingsDomain} to the standings`);
  });
});

test('no community is named outside the settings file', () => {
  const files = appScriptFiles().map((f) => path.join('assets/js', f)).concat(['review/review.js'])
    .filter((f) => !/config\/club\.js$|productionSnapshot\.js$/.test(f));
  const found = [];
  files.forEach((f) => {
    fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (/^\s*\*/.test(line)) return;
      if (/Money Padel|MONEY PADEL|money-padel-|Money <b>Padel|mp-mark\.svg|mpstandings/.test(code)) found.push(`${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
    });
  });
  assert.deepStrictEqual(found, []);
});

maybe('Money Padel looks exactly as before', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(() => ({
      title: document.title, wordmark: document.querySelector('.brand-wordmark').innerHTML,
      logo: document.querySelector('.brand-mark img').getAttribute('src'),
      apple: document.querySelector('meta[name="apple-mobile-web-app-title"]').content,
    }));
    assert.deepStrictEqual(r, { title: 'MP Beta', wordmark: 'Money <b>Padel</b>', logo: 'assets/brand/mp-mark.svg', apple: 'MP Beta v3' });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('another community: its own name, wordmark, logo and file names, and no Money Padel anywhere on screen', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, path: 'index.html?club=padelchampionships' });
  try {
    const r = await app.run(() => {
      const shown = document.body.innerText;
      return {
        club: CLUB.id, title: document.title, wordmark: document.querySelector('.brand-wordmark').innerHTML,
        logo: document.querySelector('.brand-mark img').getAttribute('src'),
        apple: document.querySelector('meta[name="apple-mobile-web-app-title"]').content,
        moneyPadel: /money padel/i.test(shown),
        h2hText: (() => { h2hPlayerA = PLAYERS[0].name; h2hPlayerB = PLAYERS[1].name; h2hMonth = 'all'; return h2hExportText([], [], false).split('\n')[0]; })(),
      };
    });
    assert.strictEqual(r.club, 'padelchampionships');
    assert.strictEqual(r.title, 'Padel Championships');
    assert.strictEqual(r.wordmark, 'Padel <b>Championships</b>');
    assert.strictEqual(r.logo, 'assets/brand/pc-mark.svg');
    assert.strictEqual(r.apple, 'Padel Champs');
    assert.strictEqual(r.moneyPadel, false, 'no Money Padel on its screens');
    assert.strictEqual(r.h2hText, 'Padel Championships · Head to head');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
