// ===================== HOME: THE CLUBHOUSE LOBBY (PHASE 3a) =====================
// The approved IA (Ledger, 30 Sep; DQ31) orders Home as: a compact live hero
// led by this month's League position -> Needs you -> Next game -> Last time
// out -> a light Around the club. These tests hold Home to that order, to the
// canonical sources each section reads (the League table, My Games, the
// engine's record), and to the states that must disappear rather than show
// an empty box.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-20T12:00:00.000Z';
// Opens the app with the two page-side helpers below installed in the page.
async function open(opts) {
  const app = await H.open({ now: NOW, ...(opts || {}) });
  await app.page.evaluate(`window.homeState = ${homeState.toString()}; window.seedFixtures = ${seedFixtures.toString()};`);
  return app;
}

// Fixtures for one viewer, made through FixtureFlow itself: a request waiting
// on their answer, a booked game, an agreed game with no court, and a request
// of theirs waiting on others.
function seedFixtures(viewer, opts) {
  const FF = FixtureFlow;
  const T = (d) => new Date(Date.parse('2026-09-20T12:00:00Z') + d * 864e5).toISOString();
  const req = (id, players, by, d, extra) => FF.createRequest({ players, requestedBy: by, at: T(d), id, ...(extra || {}) });
  const agree = (r, d) => { r.players.forEach((n) => { if (!r.confirmations[n]) FF.respond(r, n, 'in', T(d)); }); return r; };
  const ask = req('hl_ask', ['Rishi', 'Erf', viewer, 'KC'], 'Rishi', -0.1, { preferredDate: '2026-09-25', preferredTime: '19:30', location: 'Padel Social Club' });
  const booked = agree(req('hl_booked', [viewer, 'Denis', 'Max', 'Tom'], 'Denis', -2, { preferredDate: '2026-09-22', preferredTime: '20:00', location: 'Rocket Padel' }), -1.9);
  FF.setCourtBooking(booked, { isAdmin: true, booked: true, by: 'Shaun', at: T(-1) });
  const noCourt = agree(req('hl_nocourt', [viewer, 'Osh', 'Len', 'Kaz'], 'Osh', -1), -0.9);
  const mine = req('hl_mine', [viewer, 'Tom', 'Osh', 'PDM'], viewer, -0.5);
  gameRequestsState = [ask, booked, noCourt, mine];
  if (opts && opts.manyAsks) {
    // Three more requests waiting on the viewer: Home lists three and points on.
    ['hl_ask2', 'hl_ask3', 'hl_ask4'].forEach((id, i) => gameRequestsState.push(req(id, ['Kaz', 'Len', viewer, 'Jords'], 'Kaz', -0.2 - i * 0.1)));
  }
}

function homeState() {
  const dash = document.getElementById('homeDashboard');
  const top = (sel) => { const e = dash.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top) : null; };
  return {
    order: [...dash.children].map((c) => [...c.classList].find((k) => k.startsWith('home-block-'))).filter(Boolean),
    tops: { hero: top('.home-block-hero'), needs: top('.home-block-needs'), next: top('.home-block-next'), last: top('.home-block-last'), club: top('.home-block-club') },
    headline: (dash.querySelector('.home-month-headline') || {}).textContent || '',
    line: (dash.querySelector('.home-month-line') || {}).textContent || '',
    label: (dash.querySelector('.home-month-context') || {}).textContent || '',
    system: (dash.querySelector('.home-month-label') || {}).textContent || '',
    hero: (dash.querySelector('.home-hero') || {}).innerText || '',
    power: (dash.querySelector('.home-power') || {}).innerText || '',
    text: dash.innerText,
    html: dash.innerHTML,
  };
}

maybe('Home is in the IA\'s order: hero, Needs you, Next game, Last time out, Around the club', async () => {
  const app = await open({ viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      setCurrentViewer('Eli');
      seedFixtures('Eli');
      goToSection('home');
      // Measured with the real type, not the fallback serif.
      await document.fonts.ready;
      return homeState();
    });
    assert.deepStrictEqual(r.order, ['home-block-hero', 'home-block-power', 'home-block-needs', 'home-block-next', 'home-block-last', 'home-block-club']);
    const t = r.tops;
    assert.ok(t.hero < t.needs && t.needs < t.next && t.next < t.last && t.last < t.club, JSON.stringify(t));
    // First viewport (390 x 844): the League story, Power, Needs you and Next
    // game all begin on the first screen.
    // The club ticker is its own strip above every page, not Home's layout.
    const strip = await app.run(() => { const el = document.getElementById('clubTicker'); return el ? Math.round(el.getBoundingClientRect().height) : 0; });
    assert.ok(t.next - strip < 844 - 100, `Next game starts on the first screen: ${t.next} (strip ${strip})`);
    // Match Ideas has left Home (DQ32); the monthly recap block is absorbed.
    assert.doesNotMatch(r.html, /homeIdeas|home-matchup|Match ideas/i);
    assert.doesNotMatch(r.text, /AT MONEY PADEL|Games played\s+Most active|Player of the Month/i);
    assert.doesNotMatch(r.text, /SAME GAME\. HIGHER STANDARDS|READY FOR THE NEXT GAME/i, 'the decorative tagline is gone');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 31 Oct: the Monthly Race is the month's centrepiece; the hero tells
// it in place of the League.
maybe('the hero names the viewer\'s Monthly Race position in their tier, exactly as the Race table places them', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      const out = [];
      ['Eli', 'Rishi', 'Max', 'Jords', 'Rocky', 'Antz'].forEach((name) => {
        setCurrentViewer(name);
        goToSection('home');
        const s = homeState();
        const month = homeMonth();
        const table = buildMonthlyRace(month).table;
        const rows = table.filter((x) => x.playerId === name);
        const lastOf = (x) => x.matches.map((m) => m.date).sort().pop();
        const row = rows.slice().sort((a, b) => lastOf(a).localeCompare(lastOf(b))).pop() || null;
        const pos = row && row.qualified ? table.filter((x) => x.tier === row.tier && x.qualified).indexOf(row) + 1 : null;
        out.push({ name, month, headline: s.headline, line: s.line, label: s.label, system: s.system,
          row: row && { tier: row.tier, qualified: row.qualified, score: row.score, played: row.played, wins: row.wins, losses: row.losses }, pos });
      });
      return out;
    });
    const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
    const whole = (v) => { const n = Math.round(v); return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0'; };
    const monthName = (m) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+m.slice(5) - 1];
    let ranked = 0, provisional = 0;
    r.forEach((p) => {
      assert.strictEqual(p.label, `Your ${monthName(p.month)}`, `${p.name}: the month is named`);
      assert.strictEqual(p.system, 'Monthly Race', `${p.name}: the ranking system is named before the position`);
      if (!p.row) { assert.match(p.headline, /^No games/, `${p.name}: no rank without a game`); return; }
      if (p.row.qualified) {
        ranked++;
        assert.strictEqual(p.headline, `${ord(p.pos)} in Tier ${p.row.tier}`, `${p.name}: the Race's own order`);
      } else {
        provisional++;
        assert.strictEqual(p.headline, `Provisional in Tier ${p.row.tier}`, `${p.name}: no place before qualifying`);
        assert.match(p.line, /\d more to qualify/);
      }
      assert.ok(p.line.includes(`${whole(p.row.score)} pts`) && p.line.includes(`${p.row.played} game`), `${p.name}: ${p.line}`);
      assert.ok(p.line.includes(`${p.row.wins}W`) && p.line.includes(`${p.row.losses}L`), `${p.name}: the record is the race's`);
    });
    assert.ok(ranked >= 3, 'most of these players are qualified in September');
    assert.ok(provisional >= 1, 'and one is still provisional');
  } finally { await app.close(); }
});

maybe('the hero is the League story only; Power is its own section, named, with its position in tier -- and Home leaves the analysis to Rankings', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Max');
      goToSection('home');
      const s = homeState();
      const snap = getViewerSnapshot('Max');
      const p = PLAYERS.find((x) => x.name === 'Max');
      const gap = computePromotionGap('Max');
      document.getElementById('homeViewProfileBtn').click();
      return { ...s, snap: { rating: Math.round(p.rating), tierRank: snap.tierRank, of: snap.tierRankOf, tier: p.tier, eligible: snap.eligible },
        gap, profile: document.getElementById('overlay').classList.contains('show'),
        powerInHero: !!document.querySelector('.home-hero .home-power, .home-hero #homeViewProfileBtn') };
    });
    // The hero: greeting, month, the system's name, the position, the record -- nothing else.
    assert.doesNotMatch(r.hero, /Power|Recent form|#\d+ of/i, 'no Power standing in the hero');
    assert.strictEqual(r.powerInHero, false);
    // Power: named first, then the rating and the position within the tier.
    assert.ok(r.snap.eligible);
    const lines = r.power.split('\n').map((x) => x.trim()).filter(Boolean);
    assert.match(lines[0], /^power rating$/i);
    assert.ok(r.power.includes(String(r.snap.rating)), r.power);
    assert.ok(r.power.includes(`#${r.snap.tierRank} of ${r.snap.of} in Tier ${r.snap.tier}`), r.power);
    assert.doesNotMatch(r.text, /Overall/i, 'the tier position is never called Overall');
    assert.match(r.power, /Recent form/);
    // The analysis stays in Rankings and the profile.
    assert.doesNotMatch(r.text, /is taking shape|of 5 games/i, 'no Meaningful Month line on Home');
    assert.doesNotMatch(r.power + r.hero, /in (January|February|March|April|May|June|July|August|September|October|November|December)\b/, 'no monthly Power movement');
    assert.doesNotMatch(r.text, /lowest-rated|pts below/i, 'no gap to the next tier');
    assert.ok(r.gap, 'the gap itself still exists for Rankings and the profile');
    assert.strictEqual(r.profile, true, 'Power opens the profile');
  } finally { await app.close(); }
});

maybe('the hero opens the Monthly Race, on Home\'s month, without choosing a month for the reader', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Eli');
      summaryMode = 'merit';
      goToSection('home');
      const month = homeMonth();
      const choiceBefore = summaryMonthChoice;
      document.getElementById('homeMonthBtn').click();
      return { month, section: activeSection, tab: activeTab, summaryMonth, summaryMode, choiceBefore, choiceAfter: summaryMonthChoice,
        shown: document.getElementById('summaryView').style.display !== 'none', table: !!document.querySelector('#summaryContent table'),
        sub: [...document.querySelectorAll('#sectionSubnav .section-subnav-item.active')].map((b) => b.textContent.trim()) };
    });
    assert.deepStrictEqual([r.section, r.tab, r.summaryMonth, r.summaryMode], ['rankings', 'summary', r.month, 'race']);
    assert.strictEqual(r.choiceAfter, r.choiceBefore, 'Home hands the month over; it does not make the reader\'s choice');
    assert.deepStrictEqual(r.sub, ['Month']);
    assert.ok(r.shown && r.table);
  } finally { await app.close(); }
});

maybe('with no game in Home\'s month the hero says so in words, never a rank', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      // A current player: an archived one cannot be chosen as the viewer
      // (player status model, 6 Oct).
      const name = PLAYERS.filter((p) => p.status !== 'archived').map((p) => p.name).find((n) => !raceStandingOf(n, homeMonth()).length);
      setCurrentViewer(name);
      goToSection('home');
      return { name, ...homeState() };
    });
    assert.ok(r.name, 'the record has a player with no game this month');
    assert.match(r.headline, /^No games/);
    assert.doesNotMatch(r.headline, /\d+(st|nd|rd|th) in Tier/);
    assert.ok(r.line.length > 0);
  } finally { await app.close(); }
});

maybe('no viewer: the club\'s month and "Who are you?", and nothing personal', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      clearCurrentViewer();
      goToSection('home');
      const s = homeState();
      document.getElementById('homeChooseBtn').click();
      return { ...s, picker: !!document.querySelector('#viewerSelectorSheet.show, #viewerSelectorSheet') };
    });
    assert.deepStrictEqual(r.order, ['home-block-hero', 'home-block-club']);
    assert.match(r.text, /Select a player to personalise Home/);
    assert.match(r.headline, /\d+ games? played/);
    assert.strictEqual(r.picker, true);
  } finally { await app.close(); }
});

maybe('Needs you appears only when something waits on the viewer: a count, shut on arrival, from My Games\' own list', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Eli');
      gameRequestsState = [];
      goToSection('home');
      const without = homeState();
      seedFixtures('Eli');
      renderHomeDashboard();
      const withIt = homeState();
      const head = document.getElementById('homeNeedsToggle');
      const shut = { expanded: head.getAttribute('aria-expanded'), rows: document.querySelectorAll('#homeNeedsYou .home-game-row').length, list: !!document.getElementById('homeNeedsList') };
      const badge = (head.querySelector('.mp-count-badge') || {}).textContent;
      head.click();
      const open = { expanded: document.getElementById('homeNeedsToggle').getAttribute('aria-expanded'),
        ids: [...document.querySelectorAll('#homeNeedsYou .home-game-row')].map((e) => e.dataset.fixtureId),
        meta: [...document.querySelectorAll('#homeNeedsYou .home-game-row-meta')].map((e) => e.textContent),
        heights: [...document.querySelectorAll('#homeNeedsYou .home-game-row')].map((e) => Math.round(e.getBoundingClientRect().height)) };
      const vm = myGamesVisible('Eli', new Date().toISOString()).needsYou.map((x) => x.req.id);
      // Leaving Home and coming back shuts it again.
      goToSection('rankings'); goToSection('home');
      const again = document.getElementById('homeNeedsToggle').getAttribute('aria-expanded');
      // No answer buttons and no date boxes on Home: the summary opens the game.
      const home = document.getElementById('homeDashboard');
      const plain = { respond: home.querySelectorAll('.fx-respond').length, boxes: home.querySelectorAll('.mp-date-block-proposed').length };
      document.getElementById('homeNeedsToggle').click();
      document.querySelector('#homeNeedsYou .home-game-row').click();
      const sheet = document.getElementById('gameSheet');
      const inSheet = { open: sheet.classList.contains('show'), respond: !!sheet.querySelector('.fx-respond[data-response="in"]') };
      const playCount = playActionCount('Eli');
      // The answer is given in the game sheet, through the same controls as My Games.
      sheet.querySelector('.fx-respond[data-response="in"]').click();
      return { without, withIt, shut, badge, open, vm, again, plain, inSheet, playCount };
    });
    assert.ok(!r.without.order.includes('home-block-needs'), 'nothing waiting: no block at all');
    assert.doesNotMatch(r.without.text, /Needs you/i, 'and no empty-state card in its place');
    assert.ok(r.withIt.order.includes('home-block-needs'));
    assert.deepStrictEqual(r.shut, { expanded: 'false', rows: 0, list: false }, 'shut by default: the count is the signal');
    assert.strictEqual(r.badge, String(r.vm.length), 'the count is the Play badge\'s count');
    assert.strictEqual(r.playCount, r.vm.length);
    assert.strictEqual(r.open.expanded, 'true');
    assert.deepStrictEqual(r.open.ids, r.vm.slice(0, 3), 'the same items, in My Games\' order');
    assert.match(r.open.meta[0], /^Fri 25 Sep · 19:30 · asked by Rishi · \d+h ago · 1\/4 in$/, `a one-line summary: ${r.open.meta[0]}`);
    assert.ok(r.open.heights.every((h) => h >= 44 && h <= 72), `compact rows: ${r.open.heights}`);
    assert.strictEqual(r.again, 'false', 'shut again on the next arrival');
    assert.deepStrictEqual(r.plain, { respond: 0, boxes: 0 });
    assert.deepStrictEqual(r.inSheet, { open: true, respond: true }, 'the row opens the game, where the answer is given');
    // After answering, Home no longer asks.
    await app.page.waitForFunction(() => !document.querySelector('#homeNeedsYou'), null, { timeout: 5000 });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('Needs you: a request with no date says "Date TBC" in words; open, it lists three and points to My Games for the rest', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Eli');
      seedFixtures('Eli', { manyAsks: true });
      goToSection('home');
      document.getElementById('homeNeedsToggle').click();
      const sec = document.getElementById('homeNeedsYou');
      const out = { rows: sec.querySelectorAll('.home-game-row').length, more: (sec.querySelector('[data-home="mygames"]') || {}).textContent || '',
        tbc: [...sec.querySelectorAll('.home-game-row-meta')].map((e) => e.textContent).filter((t) => t.startsWith('Date TBC')).length,
        total: myGamesVisible('Eli', new Date().toISOString()).needsYou.length };
      sec.querySelector('[data-home="mygames"]').click();
      out.landed = activeShellScreen;
      return out;
    });
    assert.strictEqual(r.total, 4);
    assert.strictEqual(r.rows, 3);
    assert.ok(r.tbc >= 1, 'no date: "Date TBC" as text, not a box');
    assert.match(r.more, /1 more in My Games/);
    assert.strictEqual(r.landed, 'mygames');
  } finally { await app.close(); }
});

maybe('a past month names the tier the viewer played that month in, not the tier they hold now', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      // A month in which some player's League row is in a tier they no longer hold.
      for (const month of getAvailableMonths().filter((m) => m !== 'all')) {
        for (const p of PLAYERS) {
          const spells = leagueStandingOf(p.name, month);
          const spell = spells.slice().sort((a, b) => String(a.lastDate).localeCompare(String(b.lastDate))).pop();
          if (!spell || spell.tier === '?' || spell.tier === p.tier) continue;
          setCurrentViewer(p.name);
          goToSection('home');
          homeMonthDefault = { month, current: month, reason: 'test' };
          renderHomeDashboard();
          return { name: p.name, month, now: p.tier, then: spell.tier, headline: document.querySelector('#homeDashboard .home-month-headline').textContent };
        }
      }
      return null;
    });
    assert.ok(r, 'the record has a player who has changed tier since a month they played');
    assert.match(r.headline, new RegExp(`in Tier ${r.then}$`), `${r.name} in ${r.month}: ${r.headline} (now Tier ${r.now})`);
  } finally { await app.close(); }
});

maybe('Next game is the next booked game only, with its own date, time and place; otherwise one quiet line', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Eli');
      seedFixtures('Eli');
      goToSection('home');
      const sec = document.getElementById('homeNextGame');
      const out = { rows: [...sec.querySelectorAll('.home-game-row')].map((e) => e.dataset.fixtureId), text: sec.innerText.replace(/\s+/g, ' ') };
      sec.querySelector('.home-game-row').click();
      out.sheet = !!document.querySelector('#gameSheet.show');
      document.getElementById('gameSheet').classList.remove('show');
      // Only the agreed game with no court left: nothing booked.
      gameRequestsState = gameRequestsState.filter((x) => x.id === 'hl_nocourt');
      renderHomeDashboard();
      out.none = document.getElementById('homeNextGame').innerText.replace(/\s+/g, ' ');
      out.noneRows = document.querySelectorAll('#homeNextGame .home-game-row').length;
      return out;
    });
    assert.deepStrictEqual(r.rows, ['hl_booked'], 'UPCOMING only: not the request, not the game with no court');
    assert.match(r.text, /You & Denis v Max & Tom/);
    assert.match(r.text, /20:00/); assert.match(r.text, /Rocket Padel/); assert.match(r.text, /Booked/);
    assert.match(r.text, /Tomorrow|In \d+ days|Today/);
    assert.match(r.text, /1 of your requests is waiting on others/);
    assert.strictEqual(r.sheet, true, 'the row opens the game');
    assert.strictEqual(r.noneRows, 0);
    assert.match(r.none, /Nothing booked yet/);
    assert.match(r.none, /1 agreed, no court/);
  } finally { await app.close(); }
});

maybe('Needs you and Next game follow Requests and Upcoming visibility (D4)', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Eli');
      seedFixtures('Eli');
      visibilityState = { ...VISIBILITY_DEFAULTS, wishlist: false, upcoming: false };
      applyTabVisibility();
      goToSection('home');
      return homeState().order;
    });
    assert.deepStrictEqual(r, ['home-block-hero', 'home-block-power', 'home-block-last', 'home-block-club']);
  } finally { await app.close(); }
});

maybe('Around the club: a light swipeable rail of Club Pulse doors, and the month\'s review one tap away', async () => {
  const app = await open({ viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(() => {
      setCurrentViewer('Eli');
      goToSection('home');
      const rail = document.querySelector('.home-club-rail');
      const items = [...rail.querySelectorAll('.home-pulse-card')];
      const slots = rail.querySelectorAll('.home-club-item').length;
      const pulse = computeClubPulse();
      const out = { n: items.length, slots, overflow: rail.scrollWidth > rail.clientWidth, snap: getComputedStyle(rail).scrollSnapType,
        peek: items.length > 1 && items[1].getBoundingClientRect().left < innerWidth && items[1].getBoundingClientRect().right > innerWidth,
        heights: items.map((e) => Math.round(e.getBoundingClientRect().height)), names: items.map((e) => e.dataset.pulsePlayer),
        expected: [pulse.topRanked, pulse.inForm, pulse.promotionWatch].filter(Boolean).map((p) => p.name),
        emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(document.getElementById('homeDashboard').innerText) };
      items[0].click();
      out.profile = document.getElementById('overlay').classList.contains('show');
      closeSheet();
      goToSection('home');
      document.getElementById('homeFullReviewBtn').click();
      out.review = document.getElementById('summaryView').style.display === 'block' && summaryMonth === homeMonth();
      // A pulse with nobody in it (no one in form) is left out, not shown empty.
      const real = computeClubPulse;
      window.computeClubPulse = () => ({ ...real(), inForm: null });
      goToSection('home');
      out.withoutInForm = [...document.querySelectorAll('.home-club-rail .home-club-item')].map((e) => e.textContent.trim().split(/\s+/)[0]);
      window.computeClubPulse = real;
      return out;
    });
    assert.ok(r.n >= 2 && r.n <= 3, 'two or three items (DQ30)');
    assert.strictEqual(r.slots, r.n, 'a pulse with nothing to say leaves no empty slot');
    assert.deepStrictEqual(r.names, r.expected, 'Club Pulse\'s own players');
    assert.strictEqual(r.overflow, true); assert.match(r.snap, /x/);
    assert.strictEqual(r.peek, true, 'the next card shows, so the rail reads as swipeable');
    assert.ok(r.heights.every((h) => h >= 44));
    assert.strictEqual(r.emoji, false, 'no emoji as iconography');
    assert.strictEqual(r.profile, true);
    assert.strictEqual(r.review, true);
    assert.deepStrictEqual(r.withoutInForm, ['#1', 'Promotion']);
  } finally { await app.close(); }
});

maybe('Home holds at phone widths with long names: no sideways scroll, every control a comfortable target', async () => {
  for (const width of [360, 375, 390]) {
    const app = await open({ viewport: { width, height: 800 } });
    try {
      const r = await app.run(() => {
        setCurrentViewer('Ant Slice');
        seedFixtures('Ant Slice');
        goToSection('home');
        document.getElementById('homeNeedsToggle').click();
        const small = [...document.querySelectorAll('#homeDashboard button')]
          .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height < 44)
          .map((b) => `${b.className}:${Math.round(b.getBoundingClientRect().height)}`);
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, small };
      });
      assert.ok(r.sw <= r.cw, `${width}: ${r.sw} > ${r.cw}`);
      assert.deepStrictEqual(r.small, [], `${width}: targets under 44px`);
      assert.deepStrictEqual(app.pageErrors, []);
    } finally { await app.close(); }
  }
});
