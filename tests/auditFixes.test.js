// ===================== PLAYER UX AUDIT FIXES: D4, D5, D6 =====================
// Shaun's decisions of 28 Sep 2026, held to account:
//
//   D4  Find a Game is a player feature; predictions (a win percentage or a
//       favourite call for a game not yet played) are Admin-only everywhere.
//       A screen switched to Admin only is hidden by every route to it.
//   D5  Tier Rank is one number: the player's position in the current Power
//       Rankings among players in their current tier, by the list's own rules.
//   D6  P / W / D / L in the League and Merit tables open the games behind
//       them, exactly the games the cell counted, like Hard and Fav already do.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
// A fixed reader's clock, so who is Ranked or Idle cannot drift with the calendar.
const NOW = '2026-09-20T12:00:00.000Z';
const open = (opts) => H.open({ now: NOW, ...(opts || {}) });

// What a player must never be shown: a predicted split or a favourite call.
const PREDICTION_PATTERNS = [/\d+% – \d+%/, /\d+%–\d+%/, /slight edge/i, /Almost perfectly balanced/, /Expected to win about/, /shade it|should win/];
const leaks = (html) => PREDICTION_PATTERNS.filter((re) => re.test(html)).map(String);

// --- D4 ---------------------------------------------------------------------------

// Phase 2: Play opens on My Games; Find a Game is reached through Arrange a Game.
maybe('D4: a player reaches Find a Game from Play, and it recommends matchups without any prediction', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Shaun');
      goToSection('play');
      const lands = activeShellScreen;
      document.getElementById('arrangeGameBtn').click();
      const modes = [...document.querySelectorAll('#arrangeSheet .mp-seg-item')].map((b) => b.textContent.trim());
      openArrangeGame('find');
      const arrange = document.querySelector('#arrangeSheet .arrange-body').innerHTML;
      document.querySelector('#arrangeSheet [data-arrange="finder"]').click();
      const view = document.getElementById('findGameView');
      return {
        lands, modes, arrange, activeTab,
        shown: view.style.display !== 'none', html: view.innerHTML,
        recommends: !!view.querySelector('.pm-best'), teams: (view.querySelector('.pm-best') || {}).textContent || '',
      };
    });
    assert.strictEqual(r.lands, 'mygames', 'Play opens on My Games');
    assert.ok(r.modes.includes('Find a game'), `Find a game stays in player navigation: ${r.modes}`);
    assert.strictEqual(r.activeTab, 'findgame');
    assert.deepStrictEqual(leaks(r.arrange), [], 'Suggested for you shows a player no prediction');
    assert.strictEqual(r.shown, true);
    assert.strictEqual(r.recommends, true, 'it still recommends a match');
    assert.match(r.teams, /Shaun/);
    assert.deepStrictEqual(leaks(r.html), [], 'no win percentage or favourite call, not even in the hidden "See all" list');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D4: an admin still sees the prediction layer in Find a Game, Arrange a Game and a fixture card', async () => {
  const req = { id: 'fxP', requestedBy: 'Shaun', requestedAt: '2026-09-18T09:00:00.000Z', agreedAt: '2026-09-18T09:00:00.000Z',
    players: ['Shaun', 'Tom', 'Max', 'KC'], teams: [['Shaun', 'Tom'], ['Max', 'KC']], preferredDate: '', confirmations: { Shaun: true, Tom: true, Max: true, KC: true },
    status: 'confirmed', courtBookingMade: true };
  const app = await open({ club: { moneypadel_game_requests: [req] } });
  try {
    const r = await app.run(() => {
      isUnlocked = true; currentUserName = 'Shaun'; applyTabVisibility();
      setCurrentViewer('Shaun');
      document.querySelector('#tabrow .tab-btn[data-tab="findgame"]').click();
      const find = document.getElementById('findGameView').innerHTML;
      openArrangeGame('find');
      const arrange = document.querySelector('#arrangeSheet .arrange-body').textContent;
      document.getElementById('arrangeSheet').classList.remove('show');
      goToSection('home');
      const home = document.getElementById('homeDashboard').innerHTML;
      goToSection('play'); document.querySelector('#tabrow .tab-btn[data-tab="upcoming"]').click();
      document.querySelector('.fx-card[data-fixture-id="fxP"] .fx-head').click();
      document.querySelector('.fx-card[data-fixture-id="fxP"] .request-pred-toggle').click();
      return { find, arrange, home, fixture: document.querySelector('.fx-card[data-fixture-id="fxP"]').textContent.replace(/\s+/g, ' ') };
    });
    assert.match(r.find, /\d+% – \d+%/, 'Find a Game shows the split to an admin');
    assert.match(r.arrange, /Expected to win about \d+% of the games/, 'and Arrange a Game\'s suggestion does, in the approved wording');
    // Match Ideas left Home for Arrange a Game (DQ32), which is where the
    // admin's split now shows (above).
    assert.doesNotMatch(r.home, /home-matchup|homeIdeas/, 'Home no longer carries Match ideas');
    assert.match(r.fixture, /Expected to win about \d+% of the games/, 'and the fixture prediction is still there');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D4: no player surface leaks a prediction — Home, Find a Game, Requests, Upcoming, a ready challenge', async () => {
  const req = { id: 'fxP', requestedBy: 'Shaun', requestedAt: '2026-09-18T09:00:00.000Z', agreedAt: '2026-09-18T09:00:00.000Z',
    players: ['Shaun', 'Tom', 'Max', 'KC'], teams: [['Shaun', 'Tom'], ['Max', 'KC']], preferredDate: '', confirmations: { Shaun: true, Tom: true, Max: true, KC: true },
    status: 'confirmed', courtBookingMade: true };
  const app = await open({ club: { moneypadel_game_requests: [req] } });
  try {
    const r = await app.run(() => {
      setCurrentViewer('Shaun');
      const seen = {};
      goToSection('home');
      seen.home = document.getElementById('homeDashboard').innerHTML;
      goToSection('play');
      seen.mygames = document.getElementById('myGamesView').innerHTML;
      openArrangeGame('find');
      seen.arrange = document.querySelector('#arrangeSheet .arrange-body').innerHTML;
      document.getElementById('arrangeSheet').classList.remove('show');
      openGameSheet('fxP');
      seen.sheet = document.getElementById('gameSheet').innerHTML;
      document.getElementById('gameSheet').classList.remove('show');
      document.querySelector('#tabrow .tab-btn[data-tab="findgame"]').click();
      seen.find = document.getElementById('findGameView').innerHTML;
      document.querySelector('#tabrow .tab-btn[data-tab="upcoming"]').click();
      document.querySelector('.fx-card[data-fixture-id="fxP"] .fx-head').click();
      seen.upcoming = document.getElementById('upcomingView').innerHTML;
      document.querySelector('#tabrow .tab-btn[data-tab="wishlist"]').click();
      seen.requests = document.getElementById('wishlistView').innerHTML;
      // A challenge whose four are chosen, drawn as its "Match ready" card.
      const ch = createChallenge('Shaun', 'Tom', 'Shaun', null, null, 'Shaun');
      Object.assign(ch, { state: 'ready', firstPartner: 'Max', secondPartner: 'KC' });
      seen.challengeReady = !!challengeToMatchView(ch);
      seen.challenge = renderChallengeCard(ch, getCurrentViewer());
      seen.body = document.body.innerHTML;
      return seen;
    });
    assert.strictEqual(r.challengeReady, true, 'the challenge fixture must be a real ready match');
    for (const where of ['home', 'mygames', 'arrange', 'sheet', 'find', 'upcoming', 'requests', 'challenge', 'body']) {
      assert.deepStrictEqual(leaks(r[where]), [], `${where} leaked a prediction to a player`);
    }
    assert.ok(!/request-pred-toggle/.test(r.upcoming), 'no "Prediction available" fold for a player');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D4: a screen switched to Admin only is hidden by every route — sub-navigation, landing, More tables, shortcuts, direct taps', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Shaun');
      visibilityState = { ...VISIBILITY_DEFAULTS, findgame: false, callouts: false, power: false };
      applyTabVisibility();
      const out = {};
      goToSection('play');
      out.playLands = activeShellScreen;
      out.playModes = arrangeModesVisible().map((m) => m.label);
      document.querySelector('#tabrow .tab-btn[data-tab="findgame"]').click();
      out.directTap = { activeTab, findShown: document.getElementById('findGameView').style.display !== 'none' };
      goToSection('rankings');
      out.rankingsLands = activeTab;
      out.rankingsSubnav = [...document.querySelectorAll('#sectionSubnav .section-subnav-item')].map((b) => b.textContent.trim());
      // More became Me and Rankings › More tables (Phase 1); Insights lives in More tables.
      openRankingsMoreTables();
      out.more = [...document.querySelectorAll('#rankingsMoreSheet .mp-list-row')].map((b) => b.textContent.trim());
      document.getElementById('rankingsMoreSheet').classList.remove('show');
      openInsightsFromTop();
      out.insights = activeTab;
      goToSection('home');
      const home = document.getElementById('homeDashboard');
      out.home = { ideas: !!home.querySelector('#homeIdeasToggle'), insights: !!home.querySelector('#homeAllInsightsBtn') };
      openSheet('Shaun');
      out.profile = { prove: !!document.getElementById('ppProveItBtn'), text: document.getElementById('overlay').textContent.includes('Match to Prove It') };
      closeSheet();
      // The admin sees everything again, from the same rule.
      isUnlocked = true; applyTabVisibility();
      goToSection('play');
      out.admin = { lands: activeShellScreen, modes: arrangeModesVisible().map((m) => m.label) };
      openRankingsMoreTables();
      out.adminMore = [...document.querySelectorAll('#rankingsMoreSheet .mp-list-row')].map((b) => b.textContent.trim());
      document.getElementById('rankingsMoreSheet').classList.remove('show');
      return out;
    });
    // Play opens on My Games (Phase 2); Find a Game is reached only through
    // Arrange a Game, which no longer offers it.
    assert.strictEqual(r.playLands, 'mygames');
    assert.ok(!r.playModes.includes('Find a game'), `hidden from Arrange a Game: ${r.playModes}`);
    assert.deepStrictEqual(r.directTap, { activeTab: 'games', findShown: false }, 'a direct route to it is turned away');
    // Rankings' primary entries are Power | This Month (Phase 1): with Power
    // hidden it lands on This Month.
    assert.strictEqual(r.rankingsLands, 'summary');
    assert.ok(!r.rankingsSubnav.includes('Power'));
    assert.ok(r.more.length > 0);
    assert.ok(!r.more.some((t) => /Call-Outs/.test(t)), `More tables offers no hidden screen: ${r.more}`);
    assert.notStrictEqual(r.insights, 'callouts', 'Home\'s Insights shortcut cannot reach it either');
    assert.deepStrictEqual(r.home, { ideas: false, insights: false });
    assert.deepStrictEqual(r.profile, { prove: false, text: false });
    assert.strictEqual(r.admin.lands, 'mygames');
    assert.ok(r.admin.modes.includes('Find a game'));
    assert.ok(r.adminMore.some((t) => /Call-Outs/.test(t)));
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// --- D5 ---------------------------------------------------------------------------

maybe('D5: every profile\'s Tier Rank is its position on the Power Rankings page, filtered to its tier', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      // The page itself: All time, one tier, the list's own eligibility, and
      // no min-games display filter (it is not eligibility).
      document.querySelector('#tabrow .tab-btn[data-tab="power"]').click();
      const pagePosition = {};
      TIER_ORDER_LIST.forEach((tier) => {
        selectedMonth = 'all'; activeTier = tier; minGames = 0; includeIdle = false; includeInactive = false;
        render();
        [...document.querySelectorAll('#list .nm')].forEach((el, i) => { pagePosition[el.textContent.trim()] = { rank: i + 1, of: document.querySelectorAll('#list .nm').length }; });
      });
      const out = [];
      PLAYERS.forEach((p) => {
        openSheet(p.name);
        const header = document.querySelector('.pp-hero-sub').textContent;
        const analysis = [...document.querySelectorAll('.pp-analysis-card')].find((c) => /Position/.test(c.textContent)).querySelector('.pp-ac-main').textContent;
        const full = document.getElementById('ppFullAnalysisBody').textContent;
        const home = getViewerSnapshot(p.name);
        out.push({ name: p.name, tier: p.tier, page: pagePosition[p.name] || null, header, analysis, full, homeRank: home.tierRank, state: playerStateOf(p.name).ranking });
        closeSheet();
      });
      return out;
    });
    let ranked = 0, unranked = 0;
    r.forEach((p) => {
      if (p.page) {
        ranked++;
        assert.match(p.header, new RegExp(`#${p.page.rank} in Tier ${p.tier}`), `${p.name}: header`);
        assert.strictEqual(p.analysis.trim(), `#${p.page.rank} of ${p.page.of} in Tier ${p.tier}`, `${p.name}: Player Analysis`);
        assert.match(p.full, new RegExp(`Ranked #${p.page.rank} of ${p.page.of} in Tier ${p.tier}`), `${p.name}: full analysis`);
        assert.strictEqual(p.homeRank, p.page.rank, `${p.name}: Home`);
      } else {
        unranked++;
        assert.match(p.header, /Unranked/, `${p.name} is not on the page, so has no Tier Rank`);
        assert.strictEqual(p.analysis.trim(), `Not ranked · Tier ${p.tier}`);
        assert.strictEqual(p.homeRank, null);
      }
    });
    assert.ok(ranked > 10 && unranked > 0, `both kinds exercised (${ranked} ranked, ${unranked} not)`);
  } finally { await app.close(); }
});

maybe('D5: Idle and Inactive players do not count toward anyone\'s Tier Rank, as on the Power Rankings page', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      const tiers = {};
      PLAYERS.forEach((p) => { (tiers[p.tier] = tiers[p.tier] || []).push(p); });
      // A tier where someone unranked is rated above someone ranked -- the
      // case that made one profile say #8 and #9 of 9.
      for (const [tier, members] of Object.entries(tiers)) {
        const byRating = members.slice().sort((a, b) => b.rating - a.rating);
        const i = byRating.findIndex((p, idx) => !playerStateOf(p.name).rankable && byRating.slice(idx + 1).some((q) => playerStateOf(q.name).rankable));
        if (i < 0) continue;
        const below = byRating.slice(i + 1).find((q) => playerStateOf(q.name).rankable);
        return { tier, above: byRating[i].name, aboveState: playerStateOf(byRating[i].name).ranking, below: below.name,
          allMembersPosition: byRating.indexOf(below) + 1, tierRank: tierRankOf(below.name) };
      }
      return null;
    });
    assert.ok(r, 'the seed has a tier where an unranked player sits above a ranked one');
    assert.ok(r.tierRank.rank < r.allMembersPosition, `${r.below}: ${r.above} (${r.aboveState}) is not counted`);
  } finally { await app.close(); }
});

maybe('D5: other positions keep their own names — League place, Merit place and the month breakdown are not Tier Rank', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      summaryMode = 'league'; summaryMonth = '2026-09'; leagueGrouped = true; renderSummary();
      const league = document.getElementById('summaryContent').textContent;
      summaryMode = 'merit'; renderSummary();
      const merit = document.getElementById('summaryContent').textContent;
      // A League place and a Tier Rank genuinely differ for someone.
      const rows = Object.values(computeMonthlySummaryStats('2026-09', { splitByTier: true }));
      const differs = PLAYERS.some((p) => {
        const inTier = rows.filter((x) => x.segmentTier === p.tier && x.games > 0).sort((a, b) => b.points - a.points || b.gd - a.gd);
        const place = inTier.findIndex((x) => x.name === p.name) + 1;
        const tr = tierRankOf(p.name);
        return place > 0 && tr.rank && place !== tr.rank;
      });
      return { league, merit, differs };
    });
    assert.ok(!/Tier Rank/i.test(r.league) && !/Tier Rank/i.test(r.merit), 'no league or merit number calls itself Tier Rank');
    assert.strictEqual(r.differs, true, 'League place is its own metric, independent of Tier Rank');
  } finally { await app.close(); }
});

// --- D6 ---------------------------------------------------------------------------

const TIERS_OPEN = { S: true, A: true, B: true, C: true };
const KINDS = { played: 0, wins: 'W', draws: 'D', losses: 'L' };

// Open a table, then every non-zero P/W/D/L cell in it, one at a time, and
// compare what opens with the cell and with the games the context allows.
const reconcile = (app, table, month, grouped) => app.run(({ table, month, grouped, KINDS }) => {
  document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
  summaryMode = table; summaryMonth = month; leagueGrouped = grouped;
  leagueLastTen = false;
  leagueTierOpen = { S: true, A: true, B: true, C: true }; meritTierOpen = { S: true, A: true, B: true, C: true };
  leagueDrill = null; meritDrill = null;
  renderSummary();
  const all = getAllApprovedMatches().filter((m) => month === 'all' || m.date.slice(0, 7) === month);
  const problems = [];
  let opened = 0, zeroButtons = 0;
  const cells = [...document.querySelectorAll('#summaryContent .merit-count')].filter((b) => b.dataset.kind in KINDS)
    .map((b) => ({ player: b.dataset.player, tier: b.dataset.tier, kind: b.dataset.kind, n: Number(b.textContent) }));
  // Zero counts are plain text, never a button. (A Race score of 0 is not a
  // count: it has the month's matches behind it, so it opens them.)
  document.querySelectorAll('#summaryContent tbody tr:not(.merit-drill) td').forEach((td) => {
    if (td.textContent.trim() === '0' && td.querySelector('button:not([data-kind="race"])')) zeroButtons++;
  });
  cells.forEach((c) => {
    const btn = [...document.querySelectorAll('#summaryContent .merit-count')].find((b) => b.dataset.player === c.player && b.dataset.tier === c.tier && b.dataset.kind === c.kind);
    btn.click();
    opened++;
    const drills = document.querySelectorAll('#summaryContent tr.merit-drill');
    const body = drills[0];
    const rows = body ? [...body.querySelectorAll('.merit-drill-row')] : [];
    const head = body ? body.querySelector('.merit-drill-head').textContent : '';
    const label = { played: 'Played', wins: 'Wins', draws: 'Draws', losses: 'Losses' }[c.kind];
    const where = `${table}/${month}/${grouped ? 'tier ' + c.tier : 'all'}: ${c.player} ${c.kind}=${c.n}`;
    if (drills.length !== 1) problems.push(`${where}: ${drills.length} details open`);
    if (rows.length !== c.n) problems.push(`${where}: lists ${rows.length} games`);
    if (!head.includes(c.player) || !head.includes(label) || !head.includes(month === 'all' ? 'All Time' : monthLabel(month)) || !head.includes(grouped ? `Tier ${c.tier}` : 'All together')) problems.push(`${where}: heading "${head}"`);
    // Every listed game is this player's, in this month, in this tier section,
    // with the right result.
    rows.forEach((row) => {
      const date = row.querySelector('.merit-drill-date').textContent;
      const word = row.querySelector('.merit-drill-pts').textContent;
      if (month !== 'all' && date.slice(0, 7) !== month) problems.push(`${where}: ${date} is outside the month`);
      if (grouped && historicalTierOf(c.player, date) !== c.tier) problems.push(`${where}: ${date} was played in another tier`);
      if (KINDS[c.kind] && word !== { W: 'Won', D: 'Drew', L: 'Lost' }[KINDS[c.kind]]) problems.push(`${where}: a "${word}" listed`);
      if (!row.textContent.includes(c.player)) problems.push(`${where}: ${date} does not include the player`);
    });
    // Independently: the games this context allows for the player.
    if (c.kind === 'played' && table === 'league') {
      const expected = all.filter((m) => [...m.winners, ...m.losers].includes(c.player) && (!grouped || historicalTierOf(c.player, m.date) === c.tier)).length;
      if (expected !== c.n) problems.push(`${where}: context holds ${expected} games`);
    }
    btn.click(); // closes
    if (document.querySelectorAll('#summaryContent tr.merit-drill').length) problems.push(`${where}: did not close`);
  });
  return { opened, problems, zeroButtons };
}, { table, month, grouped, KINDS });

for (const table of ['merit', 'league']) {
  maybe(`D6: every ${table === 'merit' ? 'Merit' : 'League'} P/W/D/L cell opens exactly the games it counts — by month, By tier and All together`, async () => {
    const app = await open();
    try {
      for (const month of ['2026-09', '2026-08', 'all']) {
        for (const grouped of [true, false]) {
          const r = await reconcile(app, table, month, grouped);
          assert.ok(r.opened > 10, `${table} ${month} ${grouped}: exercised ${r.opened} cells`);
          assert.deepStrictEqual(r.problems, [], `${table} ${month} ${grouped ? 'By tier' : 'All together'}`);
          assert.strictEqual(r.zeroButtons, 0, 'a zero is never a button');
        }
      }
      assert.deepStrictEqual(app.pageErrors, []);
    } finally { await app.close(); }
  });
}

// Shaun, 6 Oct: the Monthly Race's P, W, D and L open the matches behind them
// too, told the Race's way (stakes and points earned); and the League reads
// P W D L like every other table.
maybe('D6: every Monthly Race P/W/D/L cell opens exactly the matches it counts, with their Race points', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      const verb = { wins: 'Won', draws: 'Drew', losses: 'Lost' };
      const problems = [];
      let opened = 0, zeroButtons = 0;
      ['2026-09', '2026-08'].forEach((month) => {
        summaryMode = 'race'; summaryMonth = month; raceTierOpen = { S: true, A: true, B: true, C: true }; raceDrill = null;
        renderSummary();
        const { table } = buildMonthlyRace(month);
        document.querySelectorAll('#summaryContent tbody tr:not(.merit-drill) td').forEach((td) => {
          if (td.textContent.trim() === '0' && td.querySelector('button')) zeroButtons++;
        });
        // P / W / D / L. Hard / Even / Fav (12 Nov) are the Merit Table's,
        // checked in monthlyRace.test.js.
        const cells = [...document.querySelectorAll('#summaryContent .merit-count[data-kind]')]
          .filter((b) => ['played', 'wins', 'draws', 'losses'].includes(b.dataset.kind))
          .map((b) => ({ player: b.dataset.player, tier: b.dataset.tier, kind: b.dataset.kind, n: Number(b.textContent) }));
        cells.forEach((c) => {
          const btn = [...document.querySelectorAll('#summaryContent .merit-count[data-kind]')].find((b) => b.dataset.player === c.player && b.dataset.tier === c.tier && b.dataset.kind === c.kind);
          btn.click(); opened++;
          const where = `${month} Tier ${c.tier}: ${c.player} ${c.kind}=${c.n}`;
          const drills = document.querySelectorAll('#summaryContent tr.merit-drill');
          const rows = drills[0] ? [...drills[0].querySelectorAll('.merit-drill-row')] : [];
          const head = drills[0] ? drills[0].querySelector('.merit-drill-head').textContent : '';
          if (drills.length !== 1) problems.push(`${where}: ${drills.length} details open`);
          if (rows.length !== c.n) problems.push(`${where}: lists ${rows.length}`);
          const label = { played: 'Played', wins: 'Wins', draws: 'Draws', losses: 'Losses' }[c.kind];
          if (!head.includes(c.player) || !head.includes(label) || !head.includes(monthLabel(month)) || !head.includes(`Tier ${c.tier}`)) problems.push(`${where}: heading "${head}"`);
          const raceRow = table.find((x) => x.playerId === c.player && x.tier === c.tier);
          let points = 0;
          rows.forEach((row) => {
            const date = row.querySelector('.merit-drill-date').textContent;
            const said = row.querySelector('.merit-drill-teams b').textContent;
            if (date.slice(0, 7) !== month) problems.push(`${where}: ${date} is outside the month`);
            if (historicalTierOf(c.player, date) !== c.tier) problems.push(`${where}: ${date} was played in another tier`);
            if (verb[c.kind] && said !== verb[c.kind]) problems.push(`${where}: a "${said}" listed`);
            if (!row.querySelector('.race-pts')) problems.push(`${where}: no Race points on ${date}`);
            points += Number(row.querySelector('.race-pts').textContent.replace('−', '-'));
          });
          // The Played list is the score's own matches: its points add up to the score.
          if (c.kind === 'played' && Math.abs(points - raceRow.score) > 0.06 * rows.length) problems.push(`${where}: points ${points} ≠ score ${raceRow.score}`);
          btn.click();
          if (document.querySelectorAll('#summaryContent tr.merit-drill').length) problems.push(`${where}: did not close`);
        });
      });
      // The score still opens its own list, and one thing is open at a time.
      summaryMonth = '2026-09'; raceDrill = null; renderSummary();
      document.querySelector('#summaryContent .race-score').click();
      const scoreOpen = document.querySelectorAll('#summaryContent tr.merit-drill').length;
      document.querySelector('#summaryContent .merit-count[data-kind="wins"]').click();
      const afterCount = document.querySelectorAll('#summaryContent tr.merit-drill').length;
      // League: P W D L, like every other table.
      summaryMode = 'league'; leagueGrouped = true; leagueLastTen = false; leagueTierOpen = { S: true, A: true, B: true, C: true }; renderSummary();
      const leagueHead = [...document.querySelector('#summaryContent thead tr').children].map((th) => th.textContent.replace(/[▾▴]/g, '').trim()).slice(2, 6);
      const firstRow = document.querySelector('#summaryContent tbody tr');
      const kindsInRow = [...firstRow.querySelectorAll('.merit-count[data-kind]')].map((b) => b.dataset.kind);
      return { opened, problems, zeroButtons, scoreOpen, afterCount, leagueHead, kindsInRow };
    });
    assert.ok(r.opened > 20, `exercised ${r.opened} cells`);
    assert.deepStrictEqual(r.problems, []);
    assert.strictEqual(r.zeroButtons, 0, 'a zero is never a button');
    assert.deepStrictEqual([r.scoreOpen, r.afterCount], [1, 1], 'one detail open at a time');
    assert.deepStrictEqual(r.leagueHead, ['P', 'W', 'D', 'L']);
    assert.deepStrictEqual(r.kindsInRow.filter((k) => k !== 'played'), ['wins', 'draws', 'losses'].filter((k) => r.kindsInRow.includes(k)), 'the cells in the same order as the heading');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D6: a mid-month mover\'s two tier rows each open only their own games, and together make the All together row', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      // A controlled tier change (as the League split test does): someone with
      // September games either side of the 10th moves B -> A on the 10th.
      const CUT = '2026-09-10';
      const sept = getAllApprovedMatches().filter((m) => m.date.slice(0, 7) === '2026-09');
      const datesOf = (n) => sept.filter((m) => m.winners.includes(n) || m.losers.includes(n)).map((m) => m.date);
      const mover = [...new Set(sept.flatMap((m) => [...m.winners, ...m.losers]))]
        .find((n) => datesOf(n).some((d) => d < CUT) && datesOf(n).some((d) => d >= CUT));
      if (!mover) return null;
      const realTier = V3_TIER_AS_OF;
      V3_TIER_AS_OF = (name, date) => (name === mover ? (date >= CUT ? 'A' : 'B') : realTier(name, date));
      const realHistory = V3_TIER_HISTORY;
      V3_TIER_HISTORY = { ...realHistory, changesFor: (name) => (name === mover
        ? [{ playerId: name, effectiveDate: CUT, fromTier: 'B', toTier: 'A' }] : realHistory.changesFor(name)) };

      // The rendered tables: open the mover's P in each tier section.
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      const shown = {};
      for (const mode of ['league', 'merit']) {
        summaryMode = mode; summaryMonth = '2026-09'; leagueGrouped = true; leagueLastTen = false;
        leagueTierOpen = { S: true, A: true, B: true, C: true }; meritTierOpen = { S: true, A: true, B: true, C: true };
        leagueDrill = null; meritDrill = null; renderSummary();
        shown[mode] = {};
        for (const tier of ['B', 'A']) {
          const btn = [...document.querySelectorAll('#summaryContent .merit-count[data-kind="played"]')].find((x) => x.dataset.player === mover && x.dataset.tier === tier);
          if (!btn) { shown[mode][tier] = null; continue; }
          const n = Number(btn.textContent);
          btn.click();
          const dates = [...document.querySelectorAll('#summaryContent tr.merit-drill .merit-drill-date')].map((d) => d.textContent);
          shown[mode][tier] = { n, dates };
          btn.click();
        }
        leagueGrouped = false; leagueDrill = null; meritDrill = null; renderSummary();
        const all = [...document.querySelectorAll('#summaryContent .merit-count[data-kind="played"]')].find((x) => x.dataset.player === mover);
        shown[mode].all = all ? Number(all.textContent) : null;
      }
      V3_TIER_AS_OF = realTier; V3_TIER_HISTORY = realHistory;
      return { mover, CUT, before: datesOf(mover).filter((d) => d < CUT).length, after: datesOf(mover).filter((d) => d >= CUT).length, shown };
    });
    assert.ok(r, 'a player with September games either side of the cut');
    for (const mode of ['league', 'merit']) {
      const s = r.shown[mode];
      assert.ok(s.B && s.A, `${mode}: ${r.mover} appears in both tier sections`);
      assert.deepStrictEqual([s.B.n, s.A.n], [r.before, r.after], `${mode}: each section counts only its own stretch`);
      assert.strictEqual(s.B.dates.length, s.B.n);
      assert.strictEqual(s.A.dates.length, s.A.n);
      assert.ok(s.B.dates.every((d) => d < r.CUT), `${mode}: Tier B lists only games before the move`);
      assert.ok(s.A.dates.every((d) => d >= r.CUT), `${mode}: Tier A lists only games after it`);
      assert.strictEqual(s.all, s.B.n + s.A.n, `${mode}: All together is both stretches`);
    }
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D6: Hard and Fav still open as before, and one count is open at a time across all six', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      summaryMode = 'merit'; summaryMonth = 'all'; leagueGrouped = false; meritDrill = null; renderSummary();
      const hard = document.querySelector('#summaryContent .merit-count[data-kind="hard"]');
      const who = hard.dataset.player;
      hard.click();
      const hardHead = document.querySelector('#summaryContent .merit-drill-head').textContent;
      const hardRows = document.querySelectorAll('#summaryContent .merit-drill-row').length;
      const hardCount = Number(document.querySelector(`#summaryContent .merit-count[data-kind="hard"][data-player="${who}"]`).textContent);
      document.querySelector(`#summaryContent .merit-count[data-kind="played"][data-player="${who}"]`).click();
      const afterPlayed = { open: document.querySelectorAll('#summaryContent tr.merit-drill').length, head: document.querySelector('#summaryContent .merit-drill-head').textContent };
      // Changing the month closes whatever was open.
      const sel = document.getElementById('summaryMonthSelect');
      sel.value = '2026-09'; sel.dispatchEvent(new Event('change'));
      return { who, hardHead, hardRows, hardCount, afterPlayed, afterMonth: document.querySelectorAll('#summaryContent tr.merit-drill').length };
    });
    assert.match(r.hardHead, new RegExp(`${r.who} · \\d+ wins? against a stronger pairing`));
    assert.strictEqual(r.hardRows, r.hardCount);
    assert.strictEqual(r.afterPlayed.open, 1, 'opening P closes Hard');
    assert.match(r.afterPlayed.head, new RegExp(`${r.who} · Played · All Time · All together`));
    assert.strictEqual(r.afterMonth, 0);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D6: the tables still fit a 375px phone with a count open', async () => {
  const app = await open();
  try {
    await app.page.setViewportSize({ width: 375, height: 812 });
    const r = await app.run(() => {
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      const out = {};
      for (const mode of ['merit', 'league']) {
        summaryMode = mode; summaryMonth = '2026-09'; leagueGrouped = true;
        leagueTierOpen = { S: true, A: true, B: true, C: true }; meritTierOpen = { S: true, A: true, B: true, C: true };
        leagueDrill = null; meritDrill = null; renderSummary();
        document.querySelector('#summaryContent .merit-count[data-kind="wins"]').click();
        const body = document.querySelector('#summaryContent .merit-drill-body').getBoundingClientRect();
        const btn = document.querySelector('#summaryContent .merit-count[data-kind="played"]').getBoundingClientRect();
        out[mode] = { pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          detailInView: body.left >= 0 && body.right <= window.innerWidth + 1, target: Math.round(btn.height) };
      }
      return out;
    });
    for (const mode of ['merit', 'league']) {
      assert.strictEqual(r[mode].pageOverflow, false, `${mode}: no sideways page scroll`);
      assert.strictEqual(r[mode].detailInView, true, `${mode}: the detail stays on screen`);
      assert.ok(r[mode].target >= 20, `${mode}: a usable tap target (${r[mode].target}px)`);
    }
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('D6: opening counts changes no score — League points and Merit points are what the counts make them', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      const bad = [];
      for (const month of ['2026-09', '2026-08', 'all']) {
        Object.values(computeMonthlySummaryStats(month, { splitByTier: true })).forEach((s) => {
          const by = (x) => s.matchList.filter((g) => g.result === x).length;
          if (s.points !== s.wins * 3 + s.draws) bad.push(`${month} ${s.name}: points`);
          if (by('W') !== s.wins || by('L') !== s.losses || by('D') !== s.draws || s.matchList.length !== s.games) bad.push(`${month} ${s.name}: list ≠ counts`);
        });
        MeritTable.build(meritMatches(month), (n, d) => historicalTierOf(n, d)).table.forEach((x) => {
          const by = (k) => x.games.filter((g) => g.result === k).length;
          if (by('W') !== x.wins || by('L') !== x.losses || by('D') !== x.draws || x.games.length !== x.played) bad.push(`${month} ${x.playerId}: merit list ≠ counts`);
          if (x.games.reduce((s, g) => s + g.points, 0) !== x.merit) bad.push(`${month} ${x.playerId}: merit points`);
        });
      }
      return bad;
    });
    assert.deepStrictEqual(r, []);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
