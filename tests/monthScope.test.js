// ===================== WHO OWNS WHICH MONTH =====================
// Power Rankings opens on the last completed month: in September, August. That
// is correct for Rankings, which shows a finished competition. It was also, by
// accident, the month every other screen saw, because there was one month
// variable and Rankings set it at start-up.
//
// The Player Profile was the visible casualty — opened from the Directory, far
// from Rankings, it showed 18 of Rishi's 80 games under "Showing only August
// 2026", with an August section above them. Compare was quieter and worse: its
// month picker WROTE the Rankings month, so choosing a month to compare two
// players changed Power Rankings.
//
// These tests pin the ownership: each screen's month is its own.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

// Rankings' default is the Meaningful Month (see meaningfulMonth.test.js for
// the rule itself). These tests only care that each screen OWNS its month.
maybe('Power Rankings opens on its Meaningful Month', async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => ({
      rankings: selectedMonth,
      expected: meaningfulMonthNow().month,
    }));
    assert.notStrictEqual(r.rankings, 'all', 'Rankings must default to a month, not All time');
    assert.strictEqual(r.rankings, r.expected, 'and to the one the rule picks');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a profile opened after Rankings shows the whole player, not that month', async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      // Rankings has chosen its month, as it does at start-up...
      goToSection('rankings');
      const rankingsMonth = selectedMonth;
      // ...and the reader goes to Players and opens someone.
      goToSection('players');
      const busiest = PLAYERS.slice().sort((a, b) => b.total - a.total)[0].name;
      openSheet(busiest);
      const cards = [...document.querySelectorAll('.pp-match-detail, #sheetMatches .match')];
      const months = new Set(cards.map((c) => ((c.querySelector('.top span') || {}).textContent || '').slice(0, 7)));
      const played = matchesIncludingDraws().filter((m) => m.winners.includes(busiest) || m.losers.includes(busiest)).length;
      const out = {
        rankingsMonth, busiest, played,
        cards: cards.length,
        months: [...months],
        banner: /Showing only/.test(document.getElementById('premiumProfileWrap')?.textContent || document.getElementById('sheetMatches').textContent),
        monthSection: /📅/.test(document.getElementById('sheetProfile').textContent),
        profileMonth,
        control: (document.getElementById('profileMonthSelect') || {}).value || null,
        rankingsAfter: selectedMonth,
      };
      closeSheet();
      return out;
    });
    assert.strictEqual(r.profileMonth, 'all', 'the profile opens on All time');
    assert.strictEqual(r.cards, r.played,
      `${r.busiest} has played ${r.played} games and the profile showed ${r.cards}`);
    assert.ok(r.months.length > 1, `results from more than one month, got ${r.months.join(', ')}`);
    assert.strictEqual(r.banner, false, 'no "Showing only <month>" banner on a fresh profile');
    assert.strictEqual(r.monthSection, false, 'and no month section above the results');
    assert.strictEqual(r.control, 'all', 'the profile\'s own month control says All time');
    assert.strictEqual(r.rankingsAfter, r.rankingsMonth, 'opening a profile does not touch Rankings');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('the profile has its own month, and it does not leak back to Rankings', async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const rankingsMonth = selectedMonth;
      const name = PLAYERS.slice().sort((a, b) => b.total - a.total)[0].name;
      openSheet(name);
      const all = document.querySelectorAll('.pp-match-detail').length;
      const pick = getAvailableMonths()[0];
      const sel = document.getElementById('profileMonthSelect');
      sel.value = pick;
      sel.dispatchEvent(new Event('change'));
      const narrowed = {
        cards: document.querySelectorAll('.pp-match-detail').length,
        months: [...new Set([...document.querySelectorAll('.pp-match-detail .top span:first-child')]
          .map((e) => e.textContent.slice(0, 7)))],
        heading: (document.querySelector('.pp-results-head .pp-section-label') || {}).textContent || '',
      };
      const rankingsDuring = selectedMonth;
      closeSheet();
      // Reopened from anywhere, it starts again at All time.
      openSheet(name);
      const reopened = { profileMonth, cards: document.querySelectorAll('.pp-match-detail').length };
      closeSheet();
      return { rankingsMonth, rankingsDuring, all, pick, narrowed, reopened };
    });
    assert.ok(r.narrowed.cards < r.all, 'choosing a month narrows the results');
    assert.deepStrictEqual(r.narrowed.months, [r.pick], 'to exactly that month');
    assert.match(r.narrowed.heading, /Results ·/, 'and the heading says which');
    assert.strictEqual(r.rankingsDuring, r.rankingsMonth,
      'choosing a month on a profile must not change Power Rankings');
    assert.strictEqual(r.reopened.profileMonth, 'all', 'a fresh open starts at All time again');
    assert.strictEqual(r.reopened.cards, r.all);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('an in-place refresh of the profile keeps the reader\'s month', async () => {
  // The sheet re-renders itself while open (clearing a filter, confirming a
  // delete). Those are not fresh opens and must not throw the choice away.
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const name = PLAYERS.slice().sort((a, b) => b.total - a.total)[0].name;
      openSheet(name);
      const pick = getAvailableMonths()[0];
      const sel = document.getElementById('profileMonthSelect');
      sel.value = pick; sel.dispatchEvent(new Event('change'));
      openSheet(name);   // exactly what the sheet's own refreshes call
      const kept = profileMonth;
      closeSheet();
      return { pick, kept };
    });
    assert.strictEqual(r.kept, r.pick);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('Compare has its own month and never changes Rankings', async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const rankingsMonth = selectedMonth;
      document.querySelector('#tabrow .tab-btn[data-tab="h2h"]').click();
      const opened = { h2hMonth, control: document.getElementById('h2hMonthSelect').value };
      const sel = document.getElementById('h2hMonthSelect');
      const other = getAvailableMonths().find((m) => m !== rankingsMonth);
      sel.value = other; sel.dispatchEvent(new Event('change'));
      return { rankingsMonth, opened, other, h2hAfter: h2hMonth, rankingsAfter: selectedMonth };
    });
    assert.strictEqual(r.opened.h2hMonth, 'all', 'a head-to-head is a history and opens on All time');
    assert.strictEqual(r.opened.control, 'all', 'and its control says so, rather than showing Rankings\' month');
    assert.strictEqual(r.h2hAfter, r.other, 'its own month changes');
    assert.strictEqual(r.rankingsAfter, r.rankingsMonth,
      'choosing a month in Compare must not change Power Rankings');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('League, Merit and Games keep their own month behaviour', async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const rankingsMonth = selectedMonth;
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      const league = summaryMonth;
      // Move Rankings somewhere else entirely; League must not follow.
      selectedMonth = 'all';
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      const leagueAfterRankingsMoved = summaryMonth;
      summaryMode = 'merit'; renderSummary();
      const merit = summaryMonth;
      summaryMode = 'league';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      const games = gamesMonth;
      selectedMonth = rankingsMonth;
      return { rankingsMonth, league, leagueAfterRankingsMoved, merit, games,
               expectedLeague: meaningfulMonthNow().month };
    });
    assert.strictEqual(r.league, r.expectedLeague,
      'League opens on its own Meaningful Month');
    assert.strictEqual(r.leagueAfterRankingsMoved, r.league, 'and does not follow Rankings');
    assert.strictEqual(r.merit, r.league, 'Merit shares the League screen\'s month, by design');
    assert.strictEqual(r.games, 'all', 'Games opens on All time');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('moving between Rankings, Players and a profile leaks no month', async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      const trail = [];
      const snap = (where) => trail.push({ where, rankings: selectedMonth, profile: profileMonth,
        h2h: h2hMonth, games: gamesMonth, league: summaryMonth });
      const name = PLAYERS.slice().sort((a, b) => b.total - a.total)[0].name;
      const start = selectedMonth;

      goToSection('rankings'); snap('rankings');
      goToSection('players'); snap('players');
      openSheet(name); snap('profile');
      const sel = document.getElementById('profileMonthSelect');
      sel.value = getAvailableMonths()[0]; sel.dispatchEvent(new Event('change')); snap('profile, month chosen');
      closeSheet();
      goToSection('rankings'); snap('back to rankings');
      goToSection('players'); openSheet(name); snap('profile again');
      closeSheet();
      goToSection('play'); document.querySelector('#tabrow .tab-btn[data-tab="games"]').click(); snap('games');
      goToSection('rankings'); snap('rankings last');
      return { start, trail };
    });
    r.trail.forEach((t) => {
      assert.strictEqual(t.rankings, r.start, `Rankings month moved at "${t.where}"`);
      assert.strictEqual(t.games, 'all', `Games month moved at "${t.where}"`);
    });
    const again = r.trail.find((t) => t.where === 'profile again');
    assert.strictEqual(again.profile, 'all', 'a profile reopened after navigating away starts at All time');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// A source-level guard, as with recomputeAll and the form dots: the browser
// tests prove ownership today, this stops the next screen borrowing the
// Rankings month because it happened to be lying there.
test('only Power Rankings reads or writes selectedMonth', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  // Rankings, and the plumbing that exists only to serve it.
  const rankings = new Set([
    'render', 'sortRows', 'tierInScope', 'matchesActiveTier', 'reconcileSelectedMonth',
    'recomputeAll', 'recomputeAllNow', 'init', 'populateMonthSelect', 'applyDataRangeChange',
    'computeRankingsPodiumTop3', 'computeKingsOfTiers', 'renderRankingsPodium',
    'renderKingsOfTiersPanel', 'applyRankingEligibility', 'rerenderCurrentTab',
    'syncHeaderSectionTitle', 'updateRankingsHero', 'buildRankingsHero',
    'rankingsMonthSelectHandler',
    'applyRankingsMonth', 'arriveAtRankings', 'renderRankingsMonthNote',
    'syncRankingsFilterDot',
    'computeMonthlyChampions', 'renderMonthlyChampionsPanel', 'renderKingsPanel',
  ]);
  const offenders = [];
  const { appScriptFiles, readAppScript } = require('./helpers/appSource.js');
  appScriptFiles().forEach((file) => {
    const lines = readAppScript(file).split('\n');
    let fn = '(top level)';
    lines.forEach((line, i) => {
      const m = /^(?:async )?function (\w+)|^  function (\w+)/.exec(line);
      if (m) fn = m[1] || m[2];
      // Rankings' own month select is wired at the top level, not in a named
      // function; the handler is Rankings code.
      if (/^monthSelect\.addEventListener/.test(line)) fn = 'rankingsMonthSelectHandler';
      if (/^\s*(\/\/|\*)/.test(line)) return;
      if (!/\bselectedMonth\b/.test(line)) return;
      if (rankings.has(fn)) return;
      // Top-level declarations and the month-select handler are Rankings'.
      if (fn === '(top level)' && /let selectedMonth|monthSelect|selectedMonth\s*=\s*e\.target/.test(line)) return;
      offenders.push(`${file}:${i + 1}  [${fn}]  ${line.trim()}`);
    });
  });
  assert.deepStrictEqual(offenders, [],
    'selectedMonth is the Power Rankings month. Give this screen its own:\n' + offenders.join('\n'));
});
