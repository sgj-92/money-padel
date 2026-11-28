// ===================== A GOOGLE MAPS LINK FOR THE VENUE =====================
// Shaun, 28 Nov: "I want to be able to add a Google location too for the club
// we're playing at."

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const src = fs.readFileSync(path.join(__dirname, '..', 'assets/js/features/play/venueMaps.js'), 'utf8');
const ctx = { URL, escapeHtml: (s) => String(s), console };
vm.createContext(ctx); vm.runInContext(src, ctx);

test('only a Google Maps link is accepted, pulled out of pasted Share text', () => {
  const ok = ['https://maps.app.goo.gl/AbC123', 'Club 15 Padel https://maps.app.goo.gl/AbC123', 'https://www.google.com/maps/place/Club+15/@51.5,-0.1,17z', 'https://maps.google.co.uk/?q=Club+15', 'https://goo.gl/maps/xyz'];
  ok.forEach((t) => assert.ok(ctx.googleMapsUrlFrom(t), t));
  assert.strictEqual(ctx.googleMapsUrlFrom('Club 15 Padel https://maps.app.goo.gl/AbC123'), 'https://maps.app.goo.gl/AbC123');
  ['', 'Club 15', 'https://evil.example/maps', 'https://www.google.com/search?q=x', 'javascript:alert(1)', 'https://google.com.evil.io/maps'].forEach((t) => assert.strictEqual(ctx.googleMapsUrlFrom(t), null, t));
});

test('without a pinned place, Directions searches Google Maps for the venue', () => {
  assert.strictEqual(ctx.venueMapUrl('Club 15'), 'https://www.google.com/maps/search/?api=1&query=Club%2015');
  assert.strictEqual(ctx.venueMapUrl(''), '');
});

const P4 = ['Shaun', 'Tom', 'Max', 'KC'];
const fx = (id, location) => ({ id, requestedBy: 'Board', requestedAt: '2026-09-21T09:00:00.000Z', agreedAt: '2026-09-21T09:00:00.000Z',
  players: P4.slice(), teams: [['Shaun', 'Tom'], ['Max', 'KC']], preferredDate: '2026-09-29', preferredTime: '20:00', location,
  confirmations: Object.fromEntries(P4.map((n) => [n, true])), status: 'confirmed', courtBookingMade: true });

maybe('an Admin pastes the venue\'s Google Maps link once; every game there opens that place; a wrong link is refused', async () => {
  const app = await H.open({ now: '2026-09-27T12:00:00.000Z', mobile: true, club: { moneypadel_game_requests: [fx('a', 'Club 15'), fx('b', 'club 15 ')] } });
  try {
    const r = await app.run(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      isUnlocked = true; currentUserName = 'Shaun';
      openGameSheet('a'); await wait(150);
      const before = document.querySelector('#gameSheet .venue-link').getAttribute('href');
      document.querySelector('#gameSheet .game-admin').click(); await wait(100);
      const panel = () => document.querySelector('#gameSheet .fx-manage');
      panel().querySelector('.fx-m-map').value = 'https://example.com/not-maps';
      panel().querySelector('.fx-m-save').click(); await wait(150);
      const refused = { msg: panel().textContent.includes('isn’t a Google Maps link'), stored: window.__writes.some((w) => w.id === 'moneypadel_venues') };
      panel().querySelector('.fx-m-map').value = 'Club 15 Padel https://maps.app.goo.gl/AbC123';
      panel().querySelector('.fx-m-save').click(); await wait(200);
      const saved = JSON.parse(window.__writes.filter((w) => w.id === 'moneypadel_venues').pop().doc.value);
      openGameSheet('b'); await wait(150);
      const other = document.querySelector('#gameSheet .venue-link');
      return { before, refused, saved, otherHref: other.getAttribute('href'), otherText: other.textContent.replace(/\s+/g, ' ').trim(), target: other.getAttribute('target') };
    });
    assert.match(r.before, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Club%2015$/);
    assert.deepStrictEqual(r.refused, { msg: true, stored: false });
    assert.strictEqual(r.saved['club 15'].url, 'https://maps.app.goo.gl/AbC123');
    assert.strictEqual(r.saved['club 15'].name, 'Club 15');
    assert.strictEqual(r.otherHref, 'https://maps.app.goo.gl/AbC123', 'the same venue, however it is typed, opens the pinned place');
    assert.match(r.otherText, /club 15\s*Directions ›/);
    assert.strictEqual(r.target, '_blank');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
