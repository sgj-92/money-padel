// ===================== PLAY: MY GAMES, CLUB, GAME SHEET, ARRANGE (PHASE 2) =====================
// Player Experience Reset, Phase 2. Acceptance (map §7.1): My Games shows
// Needs you, Upcoming, Called out, Waiting on others and Archived as sections
// of one list; Arrange a Game reaches all three modes; no player sees a
// favourite call or a percentage (D4, in auditFixes); every lifecycle rule
// stays in fixtureFlow.js -- these screens only draw PlayView and act through
// commitFixtureChange.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');
const FF = require('../assets/js/fixtureFlow.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-28T12:00:00.000Z';
const T = (d) => new Date(Date.parse('2026-09-20T10:00:00Z') + d * 864e5).toISOString();

function fixtures() {
  const req = (id, players, by, d, extra) => FF.createRequest({ players, requestedBy: by, at: T(d), id, ...(extra || {}) });
  const agree = (r, d) => { r.players.forEach((n) => { if (!r.confirmations[n]) FF.respond(r, n, 'in', T(d)); }); return r; };
  const wait = req('fxWait', ['Rishi', 'Erf', 'PDM', 'KC'], 'Rishi', 6, { preferredDate: '2026-10-03' });
  const called = agree(req('fxCalled', ['PDM', 'Len', 'Osh', 'KC'], 'PDM', 5, { preferredDate: '2026-10-02', preferredTime: '19:00' }), 5.5);
  const booked = agree(req('fxBooked', ['PDM', 'Kaz', 'Tom', 'Eli'], 'Kaz', 0, { preferredDate: '2026-10-06' }), 0.3);
  FF.setCourtBooking(booked, { isAdmin: true, booked: true, by: 'Shaun', at: T(1) });
  const attn = agree(req('fxAttn', ['Osh', 'PDM', 'Len', 'Kaz'], 'Osh', 0), 0.5);
  FF.respond(attn, 'Len', 'cant', T(2));
  const mine = req('fxMine', ['PDM', 'Tom', 'Osh', 'Eli'], 'PDM', 7);
  const old = agree(req('fxOld', ['PDM', 'Tom', 'Rishi', 'Erf'], 'Tom', -20), -19);
  return [wait, called, booked, attn, mine, old];
}
const open = (opts) => H.open({ now: NOW, club: { moneypadel_game_requests: fixtures() }, ...(opts || {}) });
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 250));

maybe('Play opens on My Games: one list by what needs doing, from PlayView', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('PDM');
      goToSection('play');
      const box = document.getElementById('myGamesView');
      const section = (title) => {
        const head = [...box.querySelectorAll('.mp-section-head')].find((h) => h.textContent.startsWith(title));
        const list = head && head.nextElementSibling;
        return list ? [...list.querySelectorAll('.play-row')].map((x) => x.dataset.fixtureId) : [];
      };
      const g = myGamesFor('PDM');
      return {
        screen: activeShellScreen, control: [...document.querySelectorAll('#sectionSubnav .section-subnav-item')].map((b) => b.textContent),
        arrange: !!document.getElementById('arrangeGameBtn'),
        needs: section('Needs you'), upcoming: section('Upcoming'), called: section('Called out'), waiting: section('Waiting on others'),
        model: { needs: g.needsYou.map((x) => x.req.id), upcoming: g.upcoming.map((x) => x.id), called: g.calledOut.map((x) => x.id), waiting: g.waitingOnOthers.map((x) => x.id) },
        archivedFolded: !!box.querySelector('.play-archived-toggle[aria-expanded="false"]'),
        respondOn: [...box.querySelectorAll('.fx-respond')].map((b) => b.dataset.fixtureId + ':' + b.dataset.response),
        youFirst: box.querySelector('.play-row[data-fixture-id="fxWait"] .mp-game-row-teams').textContent,
        pills: ['fxBooked', 'fxCalled', 'fxAttn'].map((id) => box.querySelector(`.play-row[data-fixture-id="${id}"] .mp-pill`).textContent),
      };
    });
    assert.strictEqual(r.screen, 'mygames');
    assert.deepStrictEqual(r.control, ['My Games', 'Club']);
    assert.strictEqual(r.arrange, true);
    assert.deepStrictEqual(r.needs, r.model.needs);
    assert.deepStrictEqual(r.needs.slice().sort(), ['fxAttn', 'fxWait']);
    assert.deepStrictEqual([r.upcoming, r.called, r.waiting], [r.model.upcoming, r.model.called, r.model.waiting]);
    assert.deepStrictEqual([r.upcoming, r.called, r.waiting], [['fxBooked'], ['fxCalled'], ['fxMine']]);
    assert.strictEqual(r.archivedFolded, true, 'archived call-outs arrive folded');
    assert.deepStrictEqual(r.respondOn, ['fxWait:in', 'fxWait:cant'], 'answer buttons only where the answer is theirs to give');
    assert.strictEqual(r.youFirst, 'You & KC v Rishi & Erf');
    assert.deepStrictEqual(r.pills, ['Court booked', 'No court', 'Needs attention']);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('answering from My Games acts for the chosen player only, and the list and badge follow', async () => {
  const app = await open();
  try {
    await app.run(() => { setCurrentViewer('PDM'); goToSection('play'); });
    await app.run(() => document.querySelector('#myGamesView .play-row[data-fixture-id="fxWait"] .fx-respond[data-response="in"]').click());
    await tick();
    const r = await app.run(() => {
      const fx = gameRequestsState.find((x) => x.id === 'fxWait');
      return { pdm: fx.confirmations.PDM, others: ['Rishi', 'Erf', 'KC'].map((n) => fx.confirmations[n]),
        last: fx.history.at(-1), badge: document.getElementById('playNavBadge').textContent,
        stillNeeds: !!document.querySelector('#myGamesView .fx-respond[data-fixture-id="fxWait"]'),
        waiting: !!document.querySelector('#myGamesView .play-row[data-fixture-id="fxWait"]') };
    });
    assert.strictEqual(r.pdm, true);
    assert.deepStrictEqual(r.others, [true, false, false], 'Rishi asked; nobody else was answered for');
    assert.strictEqual(r.last.by, 'PDM');
    assert.strictEqual(r.badge, '1');
    assert.strictEqual(r.stillNeeds, false);
    assert.strictEqual(r.waiting, true, 'now under Waiting on others');
  } finally { await app.close(); }
});

maybe('Club: four counters that filter, every open fixture once, and the booking review for an admin only', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Tom');
      goToSection('play');
      document.querySelector('#sectionSubnav [data-screen="club"]').click();
      const box = () => document.getElementById('clubView');
      const counters = () => Object.fromEntries([...box().querySelectorAll('.mp-counter')].map((b) => [b.dataset.clubFilter, +b.querySelector('.mp-counter-num').textContent]));
      const rows = () => [...box().querySelectorAll('.play-counters ~ .play-list .play-row')].map((x) => x.dataset.fixtureId);
      const out = { screen: activeShellScreen, counters: counters(), first: rows() };
      out.lists = {};
      for (const k of ['attention', 'upcoming', 'calledOut', 'requests']) {
        box().querySelector(`[data-club-filter="${k}"]`).click();
        out.lists[k] = rows();
      }
      // A game from before bookings were recorded: nothing says either way.
      const legacy = JSON.parse(JSON.stringify(gameRequestsState.find((x) => x.id === 'fxCalled')));
      legacy.id = 'fxLegacy'; delete legacy.courtBookingMade;
      gameRequestsState.push(legacy);
      renderClub();
      out.reviewPlayer = box().textContent.includes('Court bookings to record');
      out.previous = [...box().querySelectorAll('[data-play]')].map((b) => b.textContent.trim());
      isUnlocked = true; renderClub();
      out.reviewAdmin = box().textContent.includes('Court bookings to record')
        && !!box().querySelector('.fx-book-set[data-fixture-id="fxLegacy"][data-booked="true"]');
      return out;
    });
    assert.strictEqual(r.screen, 'club');
    assert.deepStrictEqual(r.counters, { attention: 1, upcoming: 1, calledOut: 1, requests: 2 });
    assert.deepStrictEqual(r.first, ['fxAttn'], 'opens on Attention when something needs it');
    assert.deepStrictEqual(r.lists, { attention: ['fxAttn'], upcoming: ['fxBooked'], calledOut: ['fxCalled'], requests: ['fxMine', 'fxWait'] });
    assert.strictEqual(r.reviewPlayer, false, 'not for a player');
    assert.strictEqual(r.reviewAdmin, true, 'an admin answers unrecorded bookings from Club, as from Upcoming');
    assert.deepStrictEqual(r.previous, ['Upcoming, as before', 'Requests, as before'], 'the old screens stay reachable until accepted');
  } finally { await app.close(); }
});

maybe('the game sheet: the stepper, the fixture card Upcoming draws, and Add result', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('PDM');
      goToSection('play');
      const at = (id) => { openGameSheet(id); const s = document.getElementById('gameSheet');
        return { open: s.classList.contains('show'), step: (s.querySelector('.mp-step.is-current') || {}).textContent || null,
          card: !!s.querySelector(`.fx-card[data-fixture-id="${id}"]`), head: getComputedStyle(s.querySelector('.fx-card')).display !== 'none' && !!s.querySelector('.fx-head') && getComputedStyle(s.querySelector('.fx-head')).display }; };
      const out = { wait: at('fxWait'), called: at('fxCalled'), booked: at('fxBooked'), attn: at('fxAttn') };
      document.querySelector('#gameSheet .request-addresult-btn').click();
      out.addResult = { tab: activeTab, sheetClosed: !document.getElementById('gameSheet').classList.contains('show') };
      return out;
    });
    assert.deepStrictEqual([r.wait.step, r.called.step, r.booked.step, r.attn.step], ['Requested', 'Agreed', 'Booked', 'Agreed']);
    assert.ok(r.wait.open && r.wait.card && r.called.card && r.booked.card);
    assert.strictEqual(r.called.head, 'none', 'the card\'s fold head is not shown inside the sheet');
    assert.deepStrictEqual(r.addResult, { tab: 'games', sheetClosed: true }, 'Add result hands off to the result form, as from Upcoming');
  } finally { await app.close(); }
});

maybe('DQ6: a player in a Called Out game records the court booking -- confirmed, attributed, and the game is Upcoming', async () => {
  const app = await open();
  try {
    const offered = await app.run(() => {
      setCurrentViewer('Tom');
      openGameSheet('fxCalled');
      const tom = !!document.querySelector('#gameSheet .game-book');
      setCurrentViewer('PDM');
      openGameSheet('fxBooked');
      const booked = !!document.querySelector('#gameSheet .game-book');
      openGameSheet('fxCalled');
      return { tom, booked, pdm: !!document.querySelector('#gameSheet .game-book') };
    });
    assert.deepStrictEqual(offered, { tom: false, booked: false, pdm: true }, 'only a player in the game, and only while there is no court');
    await app.run(() => document.querySelector('#gameSheet .game-book').click());
    const confirm = await app.run(() => document.querySelector('#bookingSheet').textContent);
    assert.match(confirm, /recorded under your name, and only an admin can undo it/);
    assert.doesNotMatch(confirm, /tell|notif/i, 'no notification is promised');
    await app.run(() => document.querySelector('#bookingSheet .booking-yes').click());
    await tick(400);
    const r = await app.run(() => {
      const fx = gameRequestsState.find((x) => x.id === 'fxCalled');
      return { stage: FixtureFlow.stage(fx), last: fx.history.at(-1), toast: document.getElementById('playToast').textContent,
        saved: JSON.parse(window.__writes.filter((w) => w.id === 'moneypadel_game_requests').at(-1).doc.value).find((x) => x.id === 'fxCalled').courtBookingMade };
    });
    assert.strictEqual(r.stage, 'upcoming');
    assert.strictEqual(r.last.by, 'PDM');
    assert.strictEqual(r.last.byPlayer, true);
    assert.strictEqual(r.saved, true);
    assert.match(r.toast, /Court booked/);
  } finally { await app.close(); }
});

maybe('Arrange a Game: three modes; a request carries its optional time and venue (DQ9); the button says what is missing', async () => {
  const app = await open();
  try {
    const r = await app.run(async () => {
      setCurrentViewer('PDM');
      goToSection('play');
      document.getElementById('arrangeGameBtn').click();
      const out = { modes: [...document.querySelectorAll('#arrangeSheet .mp-seg-item')].map((b) => b.textContent) };
      openArrangeGame('request');
      const p = document.querySelector('#arrangeSheet .arrange-sheet');
      const names = p.querySelectorAll('.arrange-name');
      const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); };
      out.first = [names[0].value, p.querySelector('.arrange-send').textContent, p.querySelector('.arrange-send').disabled];
      set(names[1], 'Rishi'); set(names[2], 'Erf');
      out.oneLeft = p.querySelector('.arrange-send').textContent;
      set(names[3], 'Rishi');
      out.dupe = p.querySelector('.arrange-send').textContent;
      p.querySelector('.arrange-send').click();
      await new Promise((res) => setTimeout(res, 200));
      out.dupeMsg = p.querySelector('.arrange-msg').textContent;
      set(names[3], 'Len');
      set(p.querySelector('.arrange-date'), '2026-10-09'); set(p.querySelector('.arrange-time'), '20:30'); set(p.querySelector('.arrange-venue'), 'PadelX');
      p.querySelector('.arrange-send').click();
      await new Promise((res) => setTimeout(res, 400));
      const made = gameRequestsState.at(-1);
      out.made = { players: made.players, date: made.preferredDate, time: made.preferredTime, venue: made.location, in: made.confirmations.PDM };
      out.after = { screen: activeShellScreen, sheet: document.getElementById('arrangeSheet').classList.contains('show'),
        waiting: !!document.querySelector(`#myGamesView .play-row[data-fixture-id="${made.id}"]`) };
      openArrangeGame('find');
      document.querySelector('#arrangeSheet .arrange-use').click();
      out.fromSuggestion = [...document.querySelectorAll('#arrangeSheet .arrange-name')].map((i) => i.value);
      openArrangeGame('paste');
      document.querySelector('#arrangeSheet [data-arrange="paste"]').click();
      out.paste = { tab: activeTab, bulkOpen: requestSectionOpen.bulk };
      return out;
    });
    assert.deepStrictEqual(r.modes, ['Find a game', 'Request', 'Paste a list']);
    assert.deepStrictEqual(r.first, ['PDM', 'Add 3 more players', true]);
    assert.strictEqual(r.oneLeft, 'Add 1 more player');
    assert.strictEqual(r.dupe, 'Send request');
    assert.strictEqual(r.dupeMsg, 'The same name appears more than once.', 'the one path\'s checks, as the form has');
    assert.deepStrictEqual(r.made, { players: ['PDM', 'Rishi', 'Erf', 'Len'], date: '2026-10-09', time: '20:30', venue: 'PadelX', in: true });
    assert.deepStrictEqual(r.after, { screen: 'mygames', sheet: false, waiting: true });
    assert.strictEqual(r.fromSuggestion.length, 4);
    assert.strictEqual(r.fromSuggestion[0], 'PDM');
    assert.deepStrictEqual(r.paste, { tab: 'wishlist', bulkOpen: true });
  } finally { await app.close(); }
});

maybe('visibility settings shape Play: requests and agreed games each follow their own (D4)', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('PDM');
      const rows = () => [...document.querySelectorAll('#myGamesView .play-row')].map((x) => x.dataset.fixtureId).sort();
      const out = {};
      visibilityState = { ...VISIBILITY_DEFAULTS, wishlist: false }; applyTabVisibility();
      goToSection('play'); out.noRequests = { rows: rows(), modes: arrangeModesVisible().map((m) => m.id) };
      visibilityState = { ...VISIBILITY_DEFAULTS, upcoming: false }; applyTabVisibility();
      goToSection('play'); out.noAgreed = rows();
      visibilityState = { ...VISIBILITY_DEFAULTS, upcoming: false, wishlist: false }; applyTabVisibility();
      goToSection('play'); out.neither = { screen: activeShellScreen, tab: activeTab };
      return out;
    });
    assert.deepStrictEqual(r.noRequests.rows, ['fxAttn', 'fxBooked', 'fxCalled']);
    assert.deepStrictEqual(r.noRequests.modes, ['find']);
    assert.deepStrictEqual(r.noAgreed, ['fxMine', 'fxWait']);
    assert.deepStrictEqual(r.neither, { screen: null, tab: 'findgame' }, 'no list to show: Play falls back to the screens it had');
  } finally { await app.close(); }
});

maybe('Back closes the game sheet and Arrange a Game, and returns from My Games to where you were', async () => {
  const app = await open();
  try {
    const p = app.page;
    const back = async () => { await p.goBack({ waitUntil: 'commit' }).catch(() => {}); await p.waitForTimeout(150); };
    const st = () => app.run(() => ({ screen: activeShellScreen, section: activeSection, sheets: [...document.querySelectorAll('.shell-more-sheet.show')].map((e) => e.id) }));
    await app.run(() => { setCurrentViewer('PDM'); goToSection('rankings'); });
    await app.run(() => goToSection('play')); await p.waitForTimeout(30);
    await app.run(() => openGameSheet('fxCalled')); await p.waitForTimeout(30);
    assert.deepStrictEqual((await st()).sheets, ['gameSheet']);
    await back();
    assert.deepStrictEqual(await st(), { screen: 'mygames', section: 'play', sheets: [] });
    await app.run(() => document.querySelector('#sectionSubnav [data-screen="club"]').click()); await p.waitForTimeout(30);
    await app.run(() => document.getElementById('arrangeGameBtn').click()); await p.waitForTimeout(30);
    await back();
    assert.deepStrictEqual(await st(), { screen: 'club', section: 'play', sheets: [] });
    await back();
    assert.deepStrictEqual(await st(), { screen: 'mygames', section: 'play', sheets: [] });
    await back();
    assert.deepStrictEqual(await st(), { screen: null, section: 'rankings', sheets: [] });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('Play at 375: every row and control is a 44px target and nothing scrolls sideways', async () => {
  const app = await open();
  try {
    await app.page.setViewportSize({ width: 375, height: 812 });
    const r = await app.run(() => {
      setCurrentViewer('PDM');
      goToSection('play');
      const h = (el) => Math.round(el.getBoundingClientRect().height);
      const small = (sel) => [...document.querySelectorAll(sel)].filter((el) => el.offsetParent && h(el) < 44).map((el) => el.className);
      const out = { mine: small('#myGamesView .mp-game-row, #myGamesView .fx-respond, #myGamesView .mp-list-row, #arrangeGameBtn'), w1: document.documentElement.scrollWidth };
      document.querySelector('#sectionSubnav [data-screen="club"]').click();
      out.club = small('#clubView .mp-counter, #clubView .mp-game-row, #clubView .mp-list-row');
      out.w2 = document.documentElement.scrollWidth;
      openArrangeGame('request');
      out.arrange = small('#arrangeSheet .mp-seg, #arrangeSheet .arrange-send, #arrangeSheet .mp-sheet-close');
      return out;
    });
    assert.deepStrictEqual([r.mine, r.club, r.arrange], [[], [], []]);
    assert.ok(r.w1 <= 375 && r.w2 <= 375, JSON.stringify(r));
  } finally { await app.close(); }
});

// Shaun, 19 Nov: "it's still quite inaccessible to quickly add agreed games
// that we have sorted on WhatsApp. I need a button so I can note the games
// faster." Arrange a Game opens on Agreed game for an Admin; a save keeps the
// date, venue and booking for the next one.
maybe('an Admin adds agreed games straight from Arrange a Game, one after another', async () => {
  const app = await open();
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      setCurrentViewer('Shaun');
      goToSection('play');
      const before = gameRequestsState.length;
      document.getElementById('arrangeGameBtn').click();
      const sheet = document.getElementById('arrangeSheet');
      const opensOn = (sheet.querySelector('.mp-seg-item[aria-selected="true"]') || {}).textContent;
      const fill = (names) => sheet.querySelectorAll('.agreed-name').forEach((el, i) => { el.value = names[i]; el.dispatchEvent(new Event('input')); });
      const wait = () => new Promise((res) => setTimeout(res, 40));
      fill(['shaun', 'Tom', 'Max', 'Nobody']);
      sheet.querySelector('.agreed-save').click(); await wait();
      const refused = sheet.querySelector('.agreed-msg').textContent;
      fill(['shaun', 'Tom', 'Max', 'KC']);
      const date = sheet.querySelector('.agreed-date'); date.value = '2026-09-30'; date.dispatchEvent(new Event('input'));
      const venue = sheet.querySelector('.agreed-venue'); venue.value = 'Origin'; venue.dispatchEvent(new Event('input'));
      const booked = sheet.querySelector('.agreed-booked'); booked.checked = true; booked.dispatchEvent(new Event('change'));
      sheet.querySelector('.agreed-save').click(); await wait();
      const first = gameRequestsState.at(-1);
      const after = { msg: sheet.querySelector('.agreed-msg').textContent, open: sheet.classList.contains('show'),
        names: [...sheet.querySelectorAll('.agreed-name')].map((el) => el.value), date: sheet.querySelector('.agreed-date').value,
        venue: sheet.querySelector('.agreed-venue').value, booked: sheet.querySelector('.agreed-booked').checked };
      fill(['Len', 'Kaz', 'PDM', 'Rhys']);
      sheet.querySelector('.agreed-save').click(); await wait();
      const second = gameRequestsState.at(-1);
      const S = FixtureFlow.STAGE, now = new Date().toISOString();
      return { opensOn, refused, added: gameRequestsState.length - before, after,
        first: { players: first.players, stage: FixtureFlow.stage(first, now), venue: first.location, date: first.preferredDate },
        second: { players: second.players, stage: FixtureFlow.stage(second, now), venue: second.location }, upcoming: S.UPCOMING };
    });
    assert.strictEqual(r.opensOn, 'Agreed');
    assert.match(r.refused, /Unrecognized name: Nobody/);
    assert.strictEqual(r.added, 2);
    assert.deepStrictEqual(r.first, { players: ['Shaun', 'Tom', 'Max', 'KC'], stage: r.upcoming, venue: 'Origin', date: '2026-09-30' }, 'written in the club\'s own spelling');
    assert.match(r.after.msg, /Added: Shaun & Tom v Max & KC — in Upcoming\. Add another, or close\./);
    assert.ok(r.after.open, 'the sheet stays open for the next one');
    assert.deepStrictEqual(r.after.names, ['', '', '', '']);
    assert.deepStrictEqual([r.after.date, r.after.venue, r.after.booked], ['2026-09-30', 'Origin', true], 'date, venue and booking carry over');
    assert.deepStrictEqual(r.second, { players: ['Len', 'Kaz', 'PDM', 'Rhys'], stage: r.upcoming, venue: 'Origin' });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 19 Nov: availability shows when a game is arranged.
maybe('Arrange a Game shows who is free as the date and time are filled in', async () => {
  const app = await H.open({ path: 'index.html?club=padelchampionships', record: { players: [], matches: [], ratingJourney: [] }, now: '2026-11-19T10:00:00.000Z',
    club: { moneypadel_player_tags: { Shaun: { tier: 'A', active: true }, Kaz: { tier: 'A', active: true }, Len: { tier: 'B', active: true }, Max: { tier: 'B', active: true } } },
    documents: { availability: { Kaz: { weekly: { mon: ['evening'] }, exceptions: [] }, Len: { weekly: { mon: ['evening'] }, exceptions: [] }, Max: { weekly: { mon: ['morning'] }, exceptions: [] } } } });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      goToSection('play');
      document.getElementById('arrangeGameBtn').click();
      const sheet = document.getElementById('arrangeSheet');
      const before = sheet.querySelector('.agreed-hint').textContent.trim();
      const names = sheet.querySelectorAll('.agreed-name');
      ['Shaun', 'Kaz', 'Max', ''].forEach((n, i) => { names[i].value = n; names[i].dispatchEvent(new Event('input')); });
      const date = sheet.querySelector('.agreed-date'); date.value = '2026-11-23'; date.dispatchEvent(new Event('input'));
      const time = sheet.querySelector('.agreed-time'); time.value = '21:00'; time.dispatchEvent(new Event('input'));
      return { before, after: sheet.querySelector('.agreed-hint').textContent.replace(/\s+/g, ' ').trim() };
    });
    assert.strictEqual(r.before, '', 'nothing until there is a date');
    assert.match(r.after, /Mon 23 Nov 9pm: \? Shaun ✓ Kaz ✗ Max/);
    assert.match(r.after, /Also free: Len/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
