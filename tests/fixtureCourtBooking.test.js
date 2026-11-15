// ===================== CALLED OUT, UPCOMING AND MANAGE FIXTURE =====================
// Shaun/CGPT's fixture follow-up of 27 Sep 2026, held to account:
//
//   - A game four players have agreed is Called Out. It is Upcoming only once
//     an admin records "Court booking made". A date, time or venue is a
//     proposal and never promotes it.
//   - Someone backing out puts the fixture in Needs attention without
//     deleting it or touching the booking. An admin can replace them; the
//     replacement starts unanswered, and the fixture returns to Called Out or
//     Upcoming by the booking it kept.
//   - Admin maintains a fixture in one "Manage fixture" panel, which also
//     holds removal. Players never see it.
//   - Existing fixtures carry no booking fact, and none is invented for them.
//   - D3 is unchanged: a result is only ever a question for an admin.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');
const FF = require('../assets/js/fixtureFlow.js');

const maybe = H.available() ? test : test.skip;
const T0 = '2026-09-20T10:00:00.000Z';
const T1 = '2026-09-21T10:00:00.000Z';
const ADMIN = { isAdmin: true, by: 'Shaun', at: T1 };
const PLAYER = { isAdmin: false, by: 'Osh', at: T1 };
// Stages are read at T1. Without a date the module reads the real clock, and
// these September fixtures pass their 14-day archive window on 4 Oct 2026.

// Erf & Eli vs Osh & Stormz, as the brief tells it: requested by Erf, then
// everyone in.
const agreedFour = (extra) => {
  const r = FF.createRequest({ players: ['Erf', 'Eli', 'Osh', 'Stormz'], requestedBy: 'Erf', at: T0, id: 'fxE' });
  r.teams = [['Erf', 'Eli'], ['Osh', 'Stormz']];
  Object.assign(r, extra || {});
  ['Eli', 'Osh', 'Stormz'].forEach((n) => FF.respond(r, n, 'in', T0));
  return r;
};
const details = (r) => ({ date: r.preferredDate, time: r.preferredTime, venue: r.location });

// --- the module --------------------------------------------------------------

test('4/4 agreed with no court booking is Called Out', () => {
  const r = agreedFour();
  assert.strictEqual(r.status, 'confirmed');
  assert.strictEqual(r.courtBookingMade, false);
  assert.strictEqual(FF.stage(r, T1), FF.STAGE.CALLED_OUT);
});

test('a proposed date, time and venue do not make a fixture Upcoming', () => {
  const r = agreedFour({ preferredDate: '2026-09-29', preferredTime: '20:00', location: 'PadelX' });
  assert.strictEqual(FF.stage(r, T1), FF.STAGE.CALLED_OUT);
  const byAdmin = FF.createAgreed({ players: ['Erf', 'Eli', 'Osh', 'Stormz'], by: 'Shaun', at: T0,
    preferredDate: '2026-09-29', preferredTime: '20:00', location: 'PadelX' });
  assert.strictEqual(FF.stage(byAdmin, T1), FF.STAGE.CALLED_OUT, 'an admin-added game with every detail is still only Called Out');
});

test('4/4 agreed with the court booked is Upcoming', () => {
  // Booked while still a request: agreement then lands it straight in Upcoming.
  const r = FF.createRequest({ players: ['Erf', 'Eli', 'Osh', 'Stormz'], requestedBy: 'Erf', at: T0 });
  assert.deepStrictEqual(FF.setCourtBooking(r, { ...ADMIN, booked: true }), { ok: true, changed: true });
  assert.strictEqual(FF.stage(r, T1), FF.STAGE.PROPOSED, 'a booking does not stand in for anyone agreeing');
  ['Eli', 'Osh', 'Stormz'].forEach((n) => FF.respond(r, n, 'in', T1));
  assert.strictEqual(FF.stage(r, T1), FF.STAGE.UPCOMING);
  const byAdmin = FF.createAgreed({ players: ['Erf', 'Eli', 'Osh', 'Stormz'], by: 'Shaun', at: T0, courtBookingMade: true });
  assert.strictEqual(FF.stage(byAdmin, T1), FF.STAGE.UPCOMING);
});

test('Court booking made moves a healthy fixture Called Out → Upcoming and back, keeping its details', () => {
  const r = agreedFour({ preferredDate: '2026-09-29', preferredTime: '20:00', location: 'PadelX' });
  const id = r.id;
  FF.setCourtBooking(r, { ...ADMIN, booked: true });
  assert.strictEqual(FF.stage(r, T1), FF.STAGE.UPCOMING);
  assert.deepStrictEqual(details(r), { date: '2026-09-29', time: '20:00', venue: 'PadelX' });
  FF.setCourtBooking(r, { ...ADMIN, booked: false });
  assert.strictEqual(FF.stage(r, T1), FF.STAGE.CALLED_OUT);
  assert.deepStrictEqual(details(r), { date: '2026-09-29', time: '20:00', venue: 'PadelX' }, 'nothing erased on the way back');
  assert.strictEqual(r.id, id);
  assert.deepStrictEqual(r.history.slice(-2).map((h) => [h.by, h.action]), [['Shaun', 'court-booked'], ['Shaun', 'court-not-booked']]);
});

test("a participant's \"I can't play\" puts the fixture in Needs attention without deleting it", () => {
  const r = agreedFour();
  FF.respond(r, 'Osh', 'cant', T1);
  assert.strictEqual(r.status, 'confirmed');
  assert.strictEqual(FF.stage(r, T1), FF.STAGE.ATTENTION);
  assert.deepStrictEqual(FF.attention(r), { backedOut: ['Osh'], waiting: [] });
});

test('an admin can record that a player backed out; the booking, details and other answers are kept', () => {
  const r = agreedFour({ preferredDate: '2026-09-29', preferredTime: '20:00', location: 'PadelX' });
  FF.setCourtBooking(r, { ...ADMIN, booked: true });
  const before = JSON.stringify(r);
  assert.deepStrictEqual(FF.markBackedOut(r, 'Osh', PLAYER), { ok: false, reason: 'not-admin' });
  assert.strictEqual(JSON.stringify(r), before, 'a player cannot record it for someone');
  assert.deepStrictEqual(FF.markBackedOut(r, 'Osh', ADMIN), { ok: true, changed: true });
  assert.strictEqual(FF.stage(r, T1), FF.STAGE.ATTENTION);
  assert.strictEqual(r.courtBookingMade, true, 'the court may still be booked, so the booking stays');
  assert.deepStrictEqual(details(r), { date: '2026-09-29', time: '20:00', venue: 'PadelX' });
  assert.deepStrictEqual(r.confirmations, { Erf: true, Eli: true, Osh: false, Stormz: true });
  assert.strictEqual(r.cantPlay.Osh.wasIn, true, 'that Osh had agreed is kept');
  assert.deepStrictEqual(r.history.at(-1), { at: T1, by: 'Shaun', action: 'backed-out', player: 'Osh' });
});

// DQ6 (Shaun, 30 Sep) opened one door: a player in the game may record that
// the court IS booked (below). Unbooking, and booking by anyone outside the
// game, stay the admin's.
test('nobody but an admin can change players, sides, date, time, venue, answers or take a booking back', () => {
  const r = agreedFour();
  const before = JSON.stringify(r);
  assert.strictEqual(FF.adminEdit(r, { seats: ['Erf', 'Eli', 'Tom', 'Stormz'], date: '2026-10-01', venue: 'X' }, PLAYER).reason, 'not-admin');
  assert.strictEqual(FF.setCourtBooking(r, { ...PLAYER, booked: false }).reason, 'not-admin', 'a player cannot un-book');
  assert.strictEqual(FF.setCourtBooking(r, { isAdmin: false, by: 'Tom', at: T1, booked: true }).reason, 'not-participant', 'nor book a game they are not in');
  assert.strictEqual(FF.setAvailability(r, 'Eli', 'waiting', PLAYER).reason, 'not-admin');
  assert.strictEqual(FF.replacePlayer(r, 'Osh', 'Tom', PLAYER).reason, 'not-admin');
  assert.strictEqual(FF.adminRemove(r, { isAdmin: false, confirmed: true }).reason, 'not-admin');
  assert.strictEqual(JSON.stringify(r), before);
});

test('an admin edits players, partnerships, date, time and venue on the same fixture', () => {
  const r = agreedFour();
  const id = r.id;
  const out = FF.adminEdit(r, { seats: ['Erf', 'Osh', 'Eli', 'Stormz'], date: '2026-10-02', time: '19:30', venue: 'PadelX' }, ADMIN);
  assert.ok(out.ok && out.changes >= 2);
  assert.strictEqual(r.id, id);
  assert.deepStrictEqual(r.teams, [['Erf', 'Osh'], ['Eli', 'Stormz']], 'new partnerships');
  assert.deepStrictEqual(details(r), { date: '2026-10-02', time: '19:30', venue: 'PadelX' });
  assert.deepStrictEqual(r.confirmations, { Erf: true, Eli: true, Osh: true, Stormz: true }, 'moving seats is not a new answer');
  assert.deepStrictEqual(r.history.slice(-2).map((h) => h.action), ['sides-changed', 'details-changed']);
  // A refused edit changes nothing at all.
  const before = JSON.stringify(r);
  assert.strictEqual(FF.adminEdit(r, { seats: ['Erf', 'Erf', 'Eli', 'Stormz'] }, ADMIN).reason, 'duplicate-player');
  assert.strictEqual(FF.adminEdit(r, { seats: ['Erf', '', 'Eli', 'Stormz'] }, ADMIN).reason, 'missing-player');
  assert.strictEqual(JSON.stringify(r), before);
});

test('replacing a backed-out player keeps the fixture, starts the new player unanswered and keeps the provenance', () => {
  for (const booked of [false, true]) {
    const r = agreedFour();
    FF.setCourtBooking(r, { ...ADMIN, booked });
    const id = r.id;
    FF.respond(r, 'Osh', 'cant', T1);
    assert.deepStrictEqual(FF.replacePlayer(r, 'Osh', 'Tom', ADMIN), { ok: true });
    assert.strictEqual(r.id, id, 'same fixture identity');
    assert.deepStrictEqual(r.players, ['Erf', 'Eli', 'Tom', 'Stormz']);
    assert.deepStrictEqual(r.teams, [['Erf', 'Eli'], ['Tom', 'Stormz']], 'Tom takes Osh\'s seat on Osh\'s side');
    assert.deepStrictEqual(r.confirmations, { Erf: true, Eli: true, Tom: false, Stormz: true }, 'Tom inherits nothing; the others keep theirs');
    assert.deepStrictEqual(FF.attention(r), { backedOut: [], waiting: ['Tom'] });
    assert.strictEqual(FF.stage(r, T1), FF.STAGE.ATTENTION, 'until Tom answers');
    assert.strictEqual(r.courtBookingMade, booked);
    FF.respond(r, 'Tom', 'in', T1);
    assert.strictEqual(FF.stage(r, T1), booked ? FF.STAGE.UPCOMING : FF.STAGE.CALLED_OUT, 'back by the booking it kept');
    // Osh agreed -> Osh backed out -> Tom replaced Osh -> Tom confirmed.
    const trail = r.history.filter((h) => h.player === 'Osh' || h.by === 'Osh' || h.by === 'Tom' || h.replacement === 'Tom')
      .map((h) => [h.by, h.action, h.replacement || '']);
    assert.deepStrictEqual(trail, [['Osh', 'in', ''], ['Osh', 'cant-play', ''], ['Shaun', 'replaced', 'Tom'], ['Tom', 'in', '']]);
    assert.deepStrictEqual(r.formerPlayers, [{ name: 'Osh', replacedBy: 'Tom', at: T1, by: 'Shaun', hadConfirmed: true, backedOutAt: T1 }]);
  }
});

test('a replacement made through Manage fixture is the same replacement', () => {
  const r = agreedFour();
  FF.markBackedOut(r, 'Osh', ADMIN);
  // The panel resets a changed seat to "not answered"; the module agrees.
  const out = FF.adminEdit(r, { seats: ['Erf', 'Eli', 'Tom', 'Stormz'], availability: { Erf: 'in', Eli: 'in', Tom: 'waiting', Stormz: 'in' } }, ADMIN);
  assert.ok(out.ok);
  assert.deepStrictEqual(r.confirmations, { Erf: true, Eli: true, Tom: false, Stormz: true });
  assert.strictEqual(r.formerPlayers[0].name, 'Osh');
  assert.strictEqual(FF.adminEdit(r, { seats: ['Erf', 'Eli', 'Tom', 'Eli'] }, ADMIN).reason, 'duplicate-player', 'nobody plays twice');
});

test('a fixture from before bookings were recorded is never treated as booked, whatever it contains', () => {
  // As the live fixtures are stored: agreed, some with a date, time and venue,
  // none with a booking fact.
  const legacy = { id: 'old', requestedBy: 'Shaun', requestedAt: T0, players: ['Antz', 'Fatch', 'Jams', 'Tom'],
    teams: [['Antz', 'Fatch'], ['Jams', 'Tom']], preferredDate: '2026-09-23', preferredTime: '15:00', location: 'Epsom',
    confirmations: { Antz: true, Fatch: true, Jams: true, Tom: true }, status: 'confirmed' };
  assert.strictEqual(FF.bookingRecorded(legacy), false);
  assert.strictEqual(FF.isBooked(legacy), false);
  assert.strictEqual(FF.stage(legacy, T1), FF.STAGE.CALLED_OUT);
  assert.strictEqual(FF.agreedAt(legacy), T0, 'its age runs from when it was made');
  assert.strictEqual(legacy.courtBookingMade, undefined, 'reading it writes nothing into it');
  FF.setCourtBooking(legacy, { ...ADMIN, booked: false });
  assert.strictEqual(FF.bookingRecorded(legacy), true, 'an admin answer, even "not booked", is recorded');
  assert.strictEqual(legacy.history.at(-1).firstRecorded, true);
});

test('D3 holds for Called Out and Upcoming alike: a match is a candidate, never a closure', () => {
  for (const booked of [false, true]) {
    const r = agreedFour({ preferredDate: '2026-09-22' });
    FF.setCourtBooking(r, { ...ADMIN, booked });
    const before = JSON.stringify(r);
    const res = { id: '2026-09-22-1', date: '2026-09-22', winners: ['Erf', 'Eli'], losers: ['Osh', 'Stormz'] };
    assert.strictEqual(FF.candidatesForResult(res, [r]).length, 1);
    assert.strictEqual(JSON.stringify(r), before, 'finding it changed nothing');
    assert.strictEqual(FF.reconcile(r, { isAdmin: false, resultId: res.id }).reason, 'not-admin');
    assert.deepStrictEqual(FF.reconcile(r, { isAdmin: true, resultId: res.id, by: 'Shaun', at: T1 }), { ok: true });
    assert.deepStrictEqual([r.status, r.playedMatchId, r.id], ['played', res.id, 'fxE']);
    assert.strictEqual(FF.stage(r, T1), FF.STAGE.PLAYED);
  }
});

// --- in the app ------------------------------------------------------------------

const NOW = '2026-09-27T12:00:00.000Z';
const P4 = ['Shaun', 'Tom', 'Max', 'KC'];
const SIDES = [['Shaun', 'Tom'], ['Max', 'KC']];
const fixture = (id, extra) => ({
  id, requestedBy: 'Board', requestedAt: '2026-09-21T09:00:00.000Z', agreedAt: '2026-09-21T09:00:00.000Z',
  players: P4.slice(), teams: SIDES.map((s) => s.slice()),
  preferredDate: '2026-09-29', preferredTime: '20:00', location: 'PadelX',
  confirmations: Object.fromEntries(P4.map((n) => [n, true])), status: 'confirmed', courtBookingMade: false, ...extra,
});
const club = (requests) => ({ moneypadel_game_requests: requests });
const open = (requests) => H.open({ now: NOW, club: club(requests) });

const install = (app) => app.run(() => {
  window.goUpcoming = () => { document.querySelector('#tabrow .tab-btn[data-tab="findgame"]').click(); document.querySelector('#tabrow .tab-btn[data-tab="upcoming"]').click(); };
  window.cardFor = (id) => document.querySelector(`#upcomingView .fx-card[data-fixture-id="${id}"], #wishlistView .fx-card[data-fixture-id="${id}"]`);
  window.sectionOf = (id) => { const c = cardFor(id); const body = c && c.closest('[id$="Body"]'); return body ? body.id.replace(/Body$/, '') : null; };
  window.opened = (id) => { if (!cardFor(id).querySelector('.fx-body')) cardFor(id).querySelector('.fx-head').click(); return cardFor(id); };
  window.manage = (id) => { opened(id); cardFor(id).querySelector('.fx-manage-toggle').click(); return cardFor(id).querySelector('.fx-manage'); };
  window.settle = () => new Promise((x) => setTimeout(x, 150));
  window.writesOf = () => window.__writes.filter((w) => w.id === 'moneypadel_game_requests').length;
});

maybe('the Upcoming tab lists Needs attention, Upcoming and Called Out apart; each section and card folds on its own', async () => {
  const app = await open([
    fixture('fxBooked', { courtBookingMade: true }),
    fixture('fxCalled'),
    fixture('fxHurt', { cantPlay: { Max: { at: '2026-09-26T09:00:00.000Z' } }, confirmations: { Shaun: true, Tom: true, Max: false, KC: true } }),
  ]);
  try {
    await install(app);
    const r = await app.run(() => {
      goUpcoming();
      const where = { booked: sectionOf('fxBooked'), called: sectionOf('fxCalled'), hurt: sectionOf('fxHurt') };
      const headings = [...document.querySelectorAll('#upcomingView .section-heading')].map((h) => h.textContent.replace(/\s+/g, ' ').trim());
      const foldedCards = [...document.querySelectorAll('#upcomingView .fx-card')].filter((c) => c.querySelector('.fx-body')).length;
      document.getElementById('upFoldUpcoming').click();
      const upcomingShut = { booked: !!cardFor('fxBooked'), called: !!cardFor('fxCalled'), hurt: !!cardFor('fxHurt') };
      document.getElementById('upFoldCalledOut').click();
      const bothShut = { booked: !!cardFor('fxBooked'), called: !!cardFor('fxCalled'), hurt: !!cardFor('fxHurt') };
      document.getElementById('upFoldUpcoming').click();
      const upcomingBack = { booked: !!cardFor('fxBooked'), called: !!cardFor('fxCalled') };
      return { where, headings, foldedCards, upcomingShut, bothShut, upcomingBack };
    });
    assert.deepStrictEqual(r.where, { booked: 'upFoldUpcoming', called: 'upFoldCalledOut', hurt: 'upFoldAttention' });
    assert.match(r.headings[0], /Needs attention \(1\)/, 'Needs attention is at the top');
    assert.match(r.headings[1], /Upcoming \(1\)/);
    assert.match(r.headings[2], /Called Out \(1\)/);
    assert.strictEqual(r.foldedCards, 0, 'every card arrives folded');
    assert.deepStrictEqual(r.upcomingShut, { booked: false, called: true, hurt: true }, 'shutting Upcoming leaves Called Out open');
    assert.deepStrictEqual(r.bothShut, { booked: false, called: false, hurt: true });
    assert.deepStrictEqual(r.upcomingBack, { booked: true, called: false }, 'and each reopens on its own');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a Called Out card says what was proposed, that the court is not booked, and how long ago it was called out', async () => {
  const app = await open([fixture('fxCalled', { agreedAt: '2026-09-21T12:00:00.000Z' })]);
  try {
    await install(app);
    await app.page.setViewportSize({ width: 375, height: 812 });
    const r = await app.run(() => {
      goUpcoming();
      const c = cardFor('fxCalled');
      return { text: c.querySelector('.fx-head').textContent.replace(/\s+/g, ' ').trim(),
        overflow: c.scrollWidth > c.clientWidth + 1 || document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    assert.match(r.text, /Shaun & Tom vs Max & KC/);
    assert.match(r.text, /Proposed: Tue 29 Sep · 20:00 · PadelX/);
    assert.match(r.text, /4\/4 agreed · Court not booked · Called out 6d ago/);
    assert.strictEqual(r.overflow, false);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('Court booking made, in Manage fixture, moves the game to Upcoming and back without losing its details', async () => {
  const app = await open([fixture('fxC')]);
  try {
    await install(app);
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Shaun'; setCurrentViewer('Rishi');
      goUpcoming();
      const panel = manage('fxC');
      const copy = panel.querySelector('.fx-m-booking').textContent.replace(/\s+/g, ' ').trim();
      panel.querySelector('.fx-m-booked').checked = true;
      panel.querySelector('.fx-m-save').click();
      await settle();
      const on = { section: sectionOf('fxC'), stored: gameRequestsState[0].courtBookingMade, id: gameRequestsState[0].id,
        details: [gameRequestsState[0].preferredDate, gameRequestsState[0].preferredTime, gameRequestsState[0].location] };
      const again = manage('fxC');
      again.querySelector('.fx-m-booked').checked = false;
      again.querySelector('.fx-m-save').click();
      await settle();
      const off = { section: sectionOf('fxC'), stored: gameRequestsState[0].courtBookingMade,
        details: [gameRequestsState[0].preferredDate, gameRequestsState[0].preferredTime, gameRequestsState[0].location] };
      return { copy, on, off, records: gameRequestsState.length };
    });
    assert.match(r.copy, /Court booking made\s*Marks this game as booked and moves it to Upcoming\./);
    assert.deepStrictEqual(r.on, { section: 'upFoldUpcoming', stored: true, id: 'fxC', details: ['2026-09-29', '20:00', 'PadelX'] });
    assert.deepStrictEqual(r.off, { section: 'upFoldCalledOut', stored: false, details: ['2026-09-29', '20:00', 'PadelX'] });
    assert.strictEqual(r.records, 1, 'the same fixture throughout');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('players get no Manage fixture and no removal; an admin card keeps Remove inside Manage', async () => {
  const pending = { id: 'fxP', requestedBy: 'Shaun', requestedAt: '2026-09-21T09:00:00.000Z', players: P4.slice(), preferredDate: '',
    confirmations: { Shaun: true, Tom: false, Max: false, KC: false }, status: 'pending', courtBookingMade: false };
  const app = await open([fixture('fxC', { courtBookingMade: true }), pending]);
  try {
    await install(app);
    const r = await app.run(() => {
      requestSectionOpen.others = true; // where a request an outsider did not make is listed
      const controls = (id) => [...cardFor(id).querySelectorAll('button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim());
      const look = (viewer) => {
        setCurrentViewer(viewer); goUpcoming(); opened('fxC');
        const upcoming = controls('fxC');
        document.querySelector('#tabrow .tab-btn[data-tab="wishlist"]').click();
        return { upcoming, pending: controls('fxP') };
      };
      const participant = look('Tom');
      const outsider = look('Rishi');
      isUnlocked = true; currentUserName = 'Shaun';
      const admin = look('Rishi');
      goUpcoming();
      const panel = manage('fxC');
      return { participant, outsider, admin, inPanel: !!panel.querySelector('.fx-remove-arm') };
    });
    for (const who of ['participant', 'outsider']) {
      const all = [...r[who].upcoming, ...r[who].pending];
      assert.ok(!all.some((b) => /manage|remove|delete/i.test(b)), `${who} saw: ${all}`);
    }
    assert.ok(r.admin.upcoming.some((b) => /Manage fixture/.test(b)));
    assert.ok(r.admin.pending.some((b) => /Manage fixture/.test(b)), 'the same panel on a request');
    assert.ok(!r.admin.upcoming.some((b) => /remove/i.test(b)), `Remove is not a card action: ${r.admin.upcoming}`);
    assert.ok(r.admin.upcoming.some((b) => /Prediction available/.test(b)));
    assert.ok(r.admin.upcoming.some((b) => /Add result/.test(b)));
    assert.strictEqual(r.inPanel, true, 'Remove fixture lives inside Manage fixture');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('an admin records a backed-out player: Needs attention, booking and details kept', async () => {
  const app = await open([fixture('fxB', { courtBookingMade: true })]);
  try {
    await install(app);
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Shaun'; setCurrentViewer('Rishi');
      goUpcoming();
      const panel = manage('fxB');
      panel.querySelector('.fx-m-state[data-seat="2"]').value = 'out'; // Max
      panel.querySelector('.fx-m-save').click();
      await settle();
      const f = gameRequestsState[0];
      return { section: sectionOf('fxB'), head: cardFor('fxB').querySelector('.fx-head').textContent.replace(/\s+/g, ' '),
        booked: f.courtBookingMade, confirmations: f.confirmations, backedOut: Object.keys(f.cantPlay || {}),
        details: [f.preferredDate, f.preferredTime, f.location], last: f.history.at(-1) };
    });
    assert.strictEqual(r.section, 'upFoldAttention');
    assert.match(r.head, /Needs attention Max backed out · Court booked/);
    assert.strictEqual(r.booked, true, 'the booking is not silently dropped');
    assert.deepStrictEqual(r.confirmations, { Shaun: true, Tom: true, Max: false, KC: true });
    assert.deepStrictEqual(r.backedOut, ['Max']);
    assert.deepStrictEqual(r.details, ['2026-09-29', '20:00', 'PadelX']);
    assert.deepStrictEqual([r.last.by, r.last.action, r.last.player], ['Shaun', 'backed-out', 'Max']);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('an admin replaces a backed-out player; the newcomer confirms for themselves and the game returns to Upcoming', async () => {
  const app = await open([fixture('fxR', { courtBookingMade: true, cantPlay: { Max: { at: '2026-09-26T09:00:00.000Z', wasIn: true } },
    confirmations: { Shaun: true, Tom: true, Max: false, KC: true } })]);
  try {
    await install(app);
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Shaun'; setCurrentViewer('Rishi');
      goUpcoming();
      const panel = manage('fxR');
      const seat = panel.querySelector('.fx-m-seat[data-seat="2"]');
      seat.value = 'Rishi'; seat.dispatchEvent(new Event('change'));
      const reset = panel.querySelector('.fx-m-state[data-seat="2"]').value;
      const hint = !panel.querySelector('.fx-m-hint').hidden;
      panel.querySelector('.fx-m-save').click();
      await settle();
      const f = gameRequestsState[0];
      const replaced = { id: f.id, records: gameRequestsState.length, players: f.players.slice(), teams: JSON.parse(JSON.stringify(f.teams)),
        confirmations: { ...f.confirmations }, former: f.formerPlayers, section: sectionOf('fxR'),
        head: cardFor('fxR').querySelector('.fx-head').textContent.replace(/\s+/g, ' ') };
      // Rishi, on his own device, says he's in.
      isUnlocked = false; setCurrentViewer('Rishi'); goUpcoming(); opened('fxR');
      [...cardFor('fxR').querySelectorAll('.fx-respond')].find((b) => /i'm in/i.test(b.textContent)).click();
      await settle();
      return { reset, hint, replaced, after: { section: sectionOf('fxR'), confirmations: gameRequestsState[0].confirmations,
        trail: gameRequestsState[0].history.map((h) => [h.by, h.action, h.player || '', h.replacement || '']) } };
    });
    assert.strictEqual(r.reset, 'waiting', 'changing the seat resets the answer');
    assert.strictEqual(r.hint, true);
    assert.deepStrictEqual([r.replaced.id, r.replaced.records], ['fxR', 1], 'the same fixture, not a new one');
    assert.deepStrictEqual(r.replaced.players, ['Shaun', 'Tom', 'Rishi', 'KC']);
    assert.deepStrictEqual(r.replaced.teams, [['Shaun', 'Tom'], ['Rishi', 'KC']]);
    assert.deepStrictEqual(r.replaced.confirmations, { Shaun: true, Tom: true, KC: true, Rishi: false }, 'Rishi starts unconfirmed; nobody else changes');
    assert.deepStrictEqual(r.replaced.former.map((x) => [x.name, x.replacedBy, x.hadConfirmed]), [['Max', 'Rishi', true]]);
    assert.strictEqual(r.replaced.section, 'upFoldAttention');
    assert.match(r.replaced.head, /waiting on Rishi/);
    assert.strictEqual(r.after.section, 'upFoldUpcoming', 'the court was booked, so it is Upcoming again');
    assert.deepStrictEqual(r.after.confirmations, { Shaun: true, Tom: true, KC: true, Rishi: true });
    assert.deepStrictEqual(r.after.trail.slice(-2), [['Shaun', 'replaced', 'Max', 'Rishi'], ['Rishi', 'in', '', '']]);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('Manage fixture edits sides, date, time and venue in place', async () => {
  const app = await open([fixture('fxM')]);
  try {
    await install(app);
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Shaun'; setCurrentViewer('Rishi');
      goUpcoming();
      const panel = manage('fxM');
      const seats = [...panel.querySelectorAll('.fx-m-seat')];
      seats[1].value = 'Max'; seats[2].value = 'Tom'; // Shaun & Max vs Tom & KC
      seats.forEach((s) => s.dispatchEvent(new Event('change')));
      panel.querySelector('.fx-m-date').value = '2026-10-03';
      panel.querySelector('.fx-m-time').value = '18:00';
      panel.querySelector('.fx-m-venue').value = 'Epsom';
      panel.querySelector('.fx-m-save').click();
      await settle();
      const f = gameRequestsState[0];
      return { teams: f.teams, confirmations: f.confirmations, details: [f.preferredDate, f.preferredTime, f.location],
        section: sectionOf('fxM'), head: cardFor('fxM').querySelector('.fx-head').textContent.replace(/\s+/g, ' '), records: gameRequestsState.length };
    });
    assert.deepStrictEqual(r.teams, [['Shaun', 'Max'], ['Tom', 'KC']]);
    assert.deepStrictEqual(r.confirmations, { Shaun: true, Tom: true, Max: true, KC: true }, 'a swap of seats is not a new player');
    assert.deepStrictEqual(r.details, ['2026-10-03', '18:00', 'Epsom']);
    assert.strictEqual(r.section, 'upFoldCalledOut', 'new details are still a proposal, not a booking');
    assert.match(r.head, /Shaun & Max vs Tom & KC/);
    assert.match(r.head, /Proposed: Sat 3 Oct · 18:00 · Epsom/);
    assert.strictEqual(r.records, 1);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('existing fixtures without a booking fact are Called Out, flagged for an admin, and written only when the admin answers', async () => {
  // Shaped like the live fixtures: agreed, no booking field, no history --
  // one with a date, time and venue.
  const legacy = (id, extra) => ({ id, requestedBy: 'Shaun', requestedAt: '2026-09-21T18:07:58.218Z', players: P4.slice(),
    preferredDate: '', confirmations: Object.fromEntries(P4.map((n) => [n, true])), status: 'confirmed', ...extra });
  const app = await open([legacy('fxL1', { preferredDate: '2026-09-30', preferredTime: '15:00', location: 'Epsom' }), legacy('fxL2')]);
  try {
    await install(app);
    const r = await app.run(async () => {
      setCurrentViewer('Rishi');
      goUpcoming();
      const asPlayer = { l1: sectionOf('fxL1'), l2: sectionOf('fxL2'), review: !!document.getElementById('upFoldReview'),
        tag: /Booking not recorded/.test(document.getElementById('upcomingView').textContent) };
      isUnlocked = true; currentUserName = 'Shaun';
      goUpcoming();
      const asAdmin = { review: (document.getElementById('upFoldReview') || {}).textContent, rows: document.querySelectorAll('.fx-review-row').length,
        writes: writesOf(), stored: gameRequestsState.map((f) => f.courtBookingMade) };
      document.querySelector('.fx-review-row[data-fixture-id="fxL1"] .fx-book-set[data-booked="true"]').click();
      await settle();
      return { asPlayer, asAdmin, after: { l1: sectionOf('fxL1'), l2: sectionOf('fxL2'), stored: gameRequestsState.map((f) => f.courtBookingMade),
        rows: document.querySelectorAll('.fx-review-row').length, l1Details: [gameRequestsState[0].preferredDate, gameRequestsState[0].location] } };
    });
    assert.deepStrictEqual(r.asPlayer, { l1: 'upFoldCalledOut', l2: 'upFoldCalledOut', review: false, tag: false });
    assert.match(r.asAdmin.review, /Court bookings to record \(2\)/);
    assert.strictEqual(r.asAdmin.rows, 2);
    assert.strictEqual(r.asAdmin.writes, 0, 'loading and looking writes nothing');
    assert.deepStrictEqual(r.asAdmin.stored, [undefined, undefined], 'no booking state manufactured');
    assert.deepStrictEqual(r.after.stored, [true, undefined], 'only the fixture the admin answered for');
    assert.deepStrictEqual([r.after.l1, r.after.l2, r.after.rows], ['upFoldUpcoming', 'upFoldCalledOut', 1]);
    assert.deepStrictEqual(r.after.l1Details, ['2026-09-30', 'Epsom']);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('an admin-added game is Called Out unless Court booking made is ticked', async () => {
  const app = await open([]);
  try {
    await install(app);
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Shaun';
      document.querySelector('#tabrow .tab-btn[data-tab="wishlist"]').click();
      const add = async (booked) => {
        requestSectionOpen.adminAdd = true; renderWishlist();
        ['Shaun', 'Tom', 'Max', 'KC'].forEach((n, i) => { document.getElementById(`adminReqP${i + 1}`).value = n; });
        document.getElementById('adminReqDate').value = '2026-09-30';
        document.getElementById('adminReqTime').value = '19:00';
        document.getElementById('adminReqPlace').value = 'PadelX';
        document.getElementById('adminReqBooked').checked = booked;
        document.getElementById('adminReqSubmit').click();
        await settle();
        const f = gameRequestsState.at(-1);
        return [f.courtBookingMade, FixtureFlow.stage(f)];
      };
      return { plain: await add(false), booked: await add(true) };
    });
    assert.deepStrictEqual(r.plain, [false, 'called-out'], 'a full set of details is not a booking');
    assert.deepStrictEqual(r.booked, [true, 'upcoming']);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D3 still asks for a Called Out game, and nothing about a fixture moves a rating', async () => {
  const plans = [];
  for (const requests of [[], [fixture('fxC', { preferredDate: '2026-09-18', agreedAt: '2026-09-15T09:00:00.000Z', requestedAt: '2026-09-15T09:00:00.000Z' })],
    [fixture('fxU', { preferredDate: '2026-09-18', courtBookingMade: true, requestedAt: '2026-09-15T09:00:00.000Z' })]]) {
    const app = await open(requests);
    try {
      await install(app);
      plans.push(await app.run(async () => {
        isUnlocked = true; currentUserName = 'Shaun';
        extraMatchesState.push({ id: 'sub1', date: '2026-09-18', winners: ['Shaun', 'Tom'], losers: ['Max', 'KC'], sets: [[6, 3], [6, 4]],
          type: 'doubles', note: '', status: 'pending', submittedBy: 'Tester' });
        recomputeAll();
        await prepareApproval('sub1');
        const plan = { matchId: approvalPlan.matchId, moved: approvalPlan.planned.playersMoved, docs: approvalPlan.planned.documentsToWrite,
          cands: approvalPlan.fixtureCandidates.map((c) => c.id) };
        renderGamesTab();
        const question = ((document.querySelector('#gamesView .fx-reconcile') || {}).textContent || '').replace(/\s+/g, ' ');
        await commitApproval();
        return { plan, question, rated: ALL_MATCHES.some((m) => m.id === plan.matchId), statuses: gameRequestsState.map((f) => f.status) };
      }));
    } finally { await app.close(); }
  }
  const [none, called, booked] = plans;
  assert.deepStrictEqual(called.plan.cands, ['fxC']);
  assert.match(called.question, /Does this result belong to this Called Out game\?/);
  assert.deepStrictEqual([called.rated, called.statuses], [false, ['confirmed']], 'no answer, no rating, no closure');
  assert.deepStrictEqual([booked.rated, booked.statuses], [false, ['confirmed']]);
  const ratingPart = (p) => ({ matchId: p.plan.matchId, moved: p.plan.moved, docs: p.plan.docs });
  assert.deepStrictEqual(ratingPart(called), ratingPart(none), 'a Called Out game changes nothing about how a result is rated');
  assert.deepStrictEqual(ratingPart(booked), ratingPart(none), 'nor does an Upcoming one');
});

// --- DQ6: a player in the game records the court booking ----------------------

test('DQ6: a player in the game can record the court as booked -- attributed to them, and the game is Upcoming', () => {
  const r = agreedFour();
  const res = FF.setCourtBooking(r, { ...PLAYER, booked: true });
  assert.deepStrictEqual(res, { ok: true, changed: true });
  assert.strictEqual(r.courtBookingMade, true);
  assert.strictEqual(FF.stage(r, T1), FF.STAGE.UPCOMING);
  assert.deepStrictEqual(r.history.at(-1), { at: T1, by: 'Osh', action: 'court-booked', byPlayer: true });
  // Their name as the game stores it, whatever case they typed.
  const r2 = agreedFour();
  FF.setCourtBooking(r2, { isAdmin: false, by: 'osh', at: T1, booked: true });
  assert.strictEqual(r2.history.at(-1).by, 'Osh');
});

test('DQ6: only an admin takes a player\'s booking back', () => {
  const r = agreedFour();
  FF.setCourtBooking(r, { ...PLAYER, booked: true });
  assert.strictEqual(FF.setCourtBooking(r, { isAdmin: false, by: 'Erf', at: T1, booked: false }).reason, 'not-admin');
  assert.deepStrictEqual(FF.setCourtBooking(r, { ...ADMIN, booked: false }), { ok: true, changed: true });
  assert.strictEqual(FF.stage(r, T1), FF.STAGE.CALLED_OUT);
  assert.strictEqual(r.history.at(-1).by, 'Shaun');
});

test('DQ6: not before all four are in, not after backing out, not on an archived call-out', () => {
  const pending = FF.createRequest({ players: ['Erf', 'Eli', 'Osh', 'Stormz'], requestedBy: 'Erf', at: T0, id: 'p' });
  assert.strictEqual(FF.setCourtBooking(pending, { ...PLAYER, booked: true }).reason, 'not-agreed');
  const out = agreedFour();
  FF.respond(out, 'Osh', 'cant', T1);
  assert.strictEqual(FF.setCourtBooking(out, { ...PLAYER, booked: true }).reason, 'backed-out');
  const old = agreedFour();
  const later = new Date(Date.parse(T0) + (FF.ARCHIVE_DAYS + 1) * 864e5).toISOString();
  assert.ok(FF.archiveInfo(old, later), 'archived after the window');
  assert.strictEqual(FF.setCourtBooking(old, { isAdmin: false, by: 'Osh', at: later, booked: true }).reason, 'archived');
  for (const r of [pending, out, old]) assert.notStrictEqual(r.courtBookingMade, true);
});

test('DQ9: a plain request can carry an optional time and venue', () => {
  const r = FF.createRequest({ players: ['Erf', 'Eli', 'Osh', 'Stormz'], requestedBy: 'Erf', at: T0, id: 'tv',
    preferredDate: '2026-10-06', preferredTime: '20:00', location: '  Rocket Padel ' });
  assert.deepStrictEqual(details(r), { date: '2026-10-06', time: '20:00', venue: 'Rocket Padel' });
  const bare = FF.createRequest({ players: ['Erf', 'Eli', 'Osh', 'Stormz'], requestedBy: 'Erf', at: T0, id: 'b' });
  assert.ok(!('preferredTime' in bare) && !('location' in bare), 'nothing invented when not given');
});

// Shaun, 15 Nov: "I can't add Jeremy because he's not played a game yet."
maybe('a player added but not yet rated can be put in an agreed game, and the card draws', async () => {
  const app = await H.open({ now: NOW, club: { ...club([]), moneypadel_player_tags: { Jeremy: { tier: 'A', active: true } } } });
  try {
    await install(app);
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Shaun';
      document.querySelector('#tabrow .tab-btn[data-tab="wishlist"]').click();
      requestSectionOpen.adminAdd = true; renderWishlist();
      const offered = [...document.querySelectorAll('#playerNamesList option')].map((o) => o.value).includes('Jeremy');
      ['Shaun', 'Jeremy', 'Max', 'KC'].forEach((n, i) => { document.getElementById(`adminReqP${i + 1}`).value = n; });
      document.getElementById('adminReqBooked').checked = true;
      document.getElementById('adminReqSubmit').click();
      await settle();
      const f = gameRequestsState.at(-1);
      goUpcoming(); await settle();
      const card = cardFor(f.id);
      return { offered, players: f && f.players, msg: (document.getElementById('adminReqMessage') || {}).textContent || '', card: card ? card.innerText : '' };
    });
    assert.ok(r.offered, 'offered in the names list');
    assert.ok(r.players && r.players.includes('Jeremy'), r.msg);
    assert.ok(r.card && !/NaN|undefined/.test(r.card), r.card);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
