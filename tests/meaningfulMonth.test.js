// ===================== MEANINGFUL MONTH =====================
// A monthly competitive view opens on the current month once it holds five
// canonical matches, and on the most recently completed month until then.
//
// It replaced "always last month", which solved the empty-1st problem by the
// calendar rather than by the data -- and so opened August on the 25th of
// September, weeks after September had become the month worth reading.
//
// What the rule must never do, and what most of these tests are about:
// override somebody's choice, or move the page under a reader because a
// fifth game was approved while they were looking at it.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');
const MM = require('../assets/js/meaningfulMonth.js');

const maybe = H.available() ? test : test.skip;

// --- the rule, on its own ----------------------------------------------------

const game = (date, i, extra) => ({ id: `${date}-${i}`, date, winners: ['A', 'B'], losers: ['C', 'D'], ...extra });
const august = [...Array(12)].map((_, i) => game(`2026-08-${String(i + 1).padStart(2, '0')}`, i));
const september = (n, extra) => [...Array(n)].map((_, i) => game(`2026-09-${String(i + 1).padStart(2, '0')}`, i, extra));
const on20thSept = new Date(2026, 8, 20, 12, 0, 0);

test('the threshold is five matches', () => {
  assert.strictEqual(MM.THRESHOLD, 5);
});

[
  [0, '2026-08', 'current-too-thin'],
  [1, '2026-08', 'current-too-thin'],
  [4, '2026-08', 'current-too-thin'],
  [5, '2026-09', 'current'],
  [6, '2026-09', 'current'],
].forEach(([n, month, reason]) => {
  test(`${n} match${n === 1 ? '' : 'es'} this month opens on ${month}`, () => {
    const r = MM.evaluate({ now: on20thSept, matches: august.concat(september(n)) });
    assert.strictEqual(r.month, month);
    assert.strictEqual(r.reason, reason);
    assert.strictEqual(r.current, '2026-09');
    assert.strictEqual(r.currentCount, n);
  });
});

test('matches are counted, not the players in them', () => {
  // One doubles match is four appearances and one match.
  const one = [game('2026-09-01', 0, { winners: ['A', 'B'], losers: ['C', 'D'] })];
  assert.strictEqual(MM.countInMonth(one, '2026-09'), 1);
});

test('the same match counted twice is one match', () => {
  const g = game('2026-09-01', 0);
  assert.strictEqual(MM.countInMonth([g, { ...g }, { ...g }], '2026-09'), 1);
  // And without an id, identical fixtures are still one.
  const bare = { date: '2026-09-02', winners: ['B', 'A'], losers: ['D', 'C'] };
  const same = { date: '2026-09-02', winners: ['A', 'B'], losers: ['C', 'D'] };
  assert.strictEqual(MM.countInMonth([bare, same], '2026-09'), 1);
});

test('a drawn match is a played match and counts', () => {
  const r = MM.evaluate({ now: on20thSept, matches: august.concat(september(4), [game('2026-09-19', 99, { isDraw: true })]) });
  assert.strictEqual(r.currentCount, 5);
  assert.strictEqual(r.month, '2026-09', 'four decided and one drawn is five');
});

test('the current month is decided in the reader\'s own calendar', () => {
  // Month boundaries, to the second. Local time: the Date is built from local
  // parts, which is what the app's `new Date()` gives a reader.
  assert.strictEqual(MM.monthKey(new Date(2026, 8, 30, 23, 59, 59)), '2026-09');
  assert.strictEqual(MM.monthKey(new Date(2026, 9, 1, 0, 0, 0)), '2026-10');
  // And across a year.
  assert.strictEqual(MM.monthKey(new Date(2026, 11, 31, 23, 59, 59)), '2026-12');
  assert.strictEqual(MM.monthKey(new Date(2027, 0, 1, 0, 0, 0)), '2027-01');
});

test('on the 1st, the month that just ended is the default', () => {
  const sept = september(20);
  const lastSecond = MM.evaluate({ now: new Date(2026, 8, 30, 23, 59, 59), matches: august.concat(sept) });
  const firstSecond = MM.evaluate({ now: new Date(2026, 9, 1, 0, 0, 0), matches: august.concat(sept) });
  assert.strictEqual(lastSecond.month, '2026-09');
  assert.strictEqual(lastSecond.reason, 'current');
  assert.strictEqual(firstSecond.month, '2026-09', 'October has nothing yet, so September');
  assert.strictEqual(firstSecond.reason, 'current-too-thin');
  assert.strictEqual(firstSecond.current, '2026-10');
});

test('across a new year, December is the completed month', () => {
  const dec = [...Array(8)].map((_, i) => game(`2026-12-${String(i + 1).padStart(2, '0')}`, i));
  const jan = [game('2027-01-02', 0), game('2027-01-03', 1)];
  const r = MM.evaluate({ now: new Date(2027, 0, 5), matches: dec.concat(jan) });
  assert.strictEqual(r.month, '2026-12');
  assert.strictEqual(r.currentCount, 2);
});

test('a month the club did not play in is skipped, not opened on', () => {
  // Nothing in August: the most recently completed month WITH games is July.
  const july = [...Array(6)].map((_, i) => game(`2026-07-${String(i + 1).padStart(2, '0')}`, i));
  const r = MM.evaluate({ now: on20thSept, matches: july.concat(september(2)) });
  assert.strictEqual(r.month, '2026-07');
});

// Shaun, 19 Nov: "Default to the latest quarter in championships."
test('a club in its first period opens on it, however few its games; All time only with no games at all', () => {
  const r = MM.evaluate({ now: on20thSept, matches: september(3) });
  assert.strictEqual(r.month, '2026-09');
  assert.strictEqual(r.reason, 'first-period');
  const none = MM.evaluate({ now: on20thSept, matches: [] });
  assert.strictEqual(none.month, 'all');
  assert.strictEqual(none.reason, 'no-completed-month');
});

// --- the screens -------------------------------------------------------------
// The fixture's September holds 28 matches, five of them draws. Trimming it to
// exactly k gives real, rated September matches to count -- every journey
// event stays, so nothing about the rest of the record changes.

const withSeptember = (k, opts) => {
  const f = H.fixture();
  const sep = f.matches.filter((m) => m.date.startsWith('2026-09'))
    .filter((m) => !(opts && opts.decidedOnly) || m.outcome !== 'DRAW')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sourceIndex - b.sourceIndex));
  const keep = new Set(sep.slice(0, k).map((m) => m.id));
  if (opts && opts.plusDraw) {
    keep.add(f.matches.find((m) => m.date.startsWith('2026-09') && m.outcome === 'DRAW').id);
  }
  return {
    players: f.players, ratingJourney: f.ratingJourney,
    matches: f.matches.filter((m) => !m.date.startsWith('2026-09') || keep.has(m.id)),
  };
};
const NOW = '2026-09-20T12:00:00';

const monthsOnEveryScreen = () => {
  goToSection('rankings');
  const rankings = selectedMonth;
  const rankingsNote = (document.getElementById('rankingsMonthNote') || {}).textContent || '';
  document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
  const league = summaryMonth;
  const leagueNote = (document.getElementById('summaryMonthNote') || {}).textContent || '';
  goToSection('home');
  return { rankings, league, home: homeMonth(), rankingsNote, leagueNote };
};

[
  [0, '2026-08', null],
  [1, '2026-08', 'September is taking shape · 1 of 5 games'],
  [4, '2026-08', 'September is taking shape · 4 of 5 games'],
  [5, '2026-09', null],
  [6, '2026-09', null],
].forEach(([k, expected, note]) => {
  maybe(`with ${k} September match${k === 1 ? '' : 'es'}, Rankings, League and Home all open on ${expected}`, async () => {
    const app = await H.open({ record: withSeptember(k), now: NOW });
    try {
      const r = await app.run(monthsOnEveryScreen);
      assert.strictEqual(r.rankings, expected, 'Rankings');
      assert.strictEqual(r.league, expected, 'League');
      assert.strictEqual(r.home, expected, 'Home');
      if (note) {
        assert.strictEqual(r.rankingsNote.replace(/\s+/g, ' ').trim(), note);
        assert.strictEqual(r.leagueNote.replace(/\s+/g, ' ').trim(), note);
      } else {
        assert.strictEqual(r.rankingsNote, '', 'no explanation needed');
        assert.strictEqual(r.leagueNote, '');
      }
      assert.deepStrictEqual(app.pageErrors, []);
    } finally { await app.close(); }
  });
});

// Shaun, 19 Nov (Padel Championships): "Default to the latest quarter." A
// club whose only games are in the period being played opens This Quarter on
// it; Power stays on All time, where the whole club is listed.
maybe('a club in its first period: League opens on it, Power stays on All time', async () => {
  const sep = withSeptember(2);
  const app = await H.open({ record: { ...sep, matches: sep.matches.filter((m) => m.date.startsWith('2026-09')) }, now: NOW });
  try {
    const r = await app.run(monthsOnEveryScreen);
    assert.strictEqual(r.league, '2026-09', 'League / This Quarter');
    assert.strictEqual(r.rankings, 'all', 'Power');
    assert.strictEqual(r.home, '2026-09');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('four decided matches and one draw make five', async () => {
  const app = await H.open({ record: withSeptember(4, { decidedOnly: true, plusDraw: true }), now: NOW });
  try {
    const r = await app.run(() => ({
      month: selectedMonth,
      count: rankingsMonthDefault.currentCount,
      draws: getAllApprovedMatches().filter((m) => m.date.startsWith('2026-09') && m.isDraw).length,
    }));
    assert.strictEqual(r.draws, 1, 'the fixture kept exactly one draw');
    assert.strictEqual(r.count, 5);
    assert.strictEqual(r.month, '2026-09');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a pending submission is not a played match', async () => {
  const app = await H.open({ record: withSeptember(4), now: NOW });
  try {
    const r = await app.run(() => {
      extraMatchesState.push({ id: 'sub_pending', date: '2026-09-19', status: 'pending',
        winners: [PLAYERS[0].name, PLAYERS[1].name], losers: [PLAYERS[2].name, PLAYERS[3].name],
        sets: [[6, 3], [6, 4]], type: 'doubles' });
      // A fresh evaluation, as a new arrival would make.
      return meaningfulMonthNow();
    });
    assert.strictEqual(r.currentCount, 4, 'pending submissions are not counted');
    assert.strictEqual(r.month, '2026-08');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('the current month can be chosen before it reaches five', async () => {
  const app = await H.open({ record: withSeptember(3), now: NOW });
  try {
    const r = await app.run(() => {
      goToSection('rankings');
      const inSelect = [...document.getElementById('monthSelect').options].map((o) => o.value).includes('2026-09');
      // The quiet link in the note chooses it, exactly as the control would.
      document.getElementById('rankingsMonthCurrent').click();
      const afterLink = { month: selectedMonth, choice: rankingsMonthChoice,
        note: (document.getElementById('rankingsMonthNote') || {}).textContent || '' };
      // And in League, through its own control.
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      const sel = document.getElementById('summaryMonthSelect');
      sel.value = '2026-09'; sel.dispatchEvent(new Event('change'));
      return { inSelect, afterLink, league: summaryMonth, leagueChoice: summaryMonthChoice };
    });
    assert.strictEqual(r.inSelect, true, 'September is offered with only three games');
    assert.strictEqual(r.afterLink.month, '2026-09');
    assert.strictEqual(r.afterLink.choice, '2026-09', 'tapping it is a choice, and recorded as one');
    assert.strictEqual(r.afterLink.note, '', 'the explanation goes once the reader has chosen');
    assert.strictEqual(r.league, '2026-09');
    assert.strictEqual(r.leagueChoice, '2026-09');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a fifth game landing mid-read does not move the page; arriving again does', async () => {
  // Four September games: Rankings opens on August. The fifth is approved
  // while the reader is looking -- the record is re-read and every screen
  // redrawn, exactly as an approval does -- and August must stay put.
  const full = H.fixture();
  const fifth = full.matches.filter((m) => m.date.startsWith('2026-09'))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sourceIndex - b.sourceIndex))[4];
  const app = await H.open({ record: withSeptember(4), now: NOW });
  try {
    const r = await app.run(async (fifthDoc) => {
      goToSection('rankings');
      const before = selectedMonth;
      window.__data.matches[fifthDoc.id] = fifthDoc;
      await loadV3State();
      dataChanged();
      const whileReading = selectedMonth;
      const countNow = meaningfulMonthNow().currentCount;
      // Leave, and come back: that is a fresh arrival.
      goToSection('players');
      goToSection('rankings');
      return { before, whileReading, countNow, afterReturning: selectedMonth };
    }, fifth);
    assert.strictEqual(r.before, '2026-08');
    assert.strictEqual(r.countNow, 5, 'the fifth game really is in the record now');
    assert.strictEqual(r.whileReading, '2026-08', 'the page did not jump under the reader');
    assert.strictEqual(r.afterReturning, '2026-09', 'arriving again picks up the new default');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('an explicit choice outlives navigation and is never overridden', async () => {
  const app = await H.open({ record: withSeptember(6), now: NOW });
  try {
    const r = await app.run(() => {
      goToSection('rankings');
      const opened = selectedMonth;
      const sel = document.getElementById('monthSelect');
      sel.value = '2026-07'; sel.dispatchEvent(new Event('change'));
      goToSection('players');
      goToSection('home');
      goToSection('rankings');
      const afterRoundTrip = selectedMonth;
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      return { opened, afterRoundTrip, league: summaryMonth, home: homeMonth() };
    });
    assert.strictEqual(r.opened, '2026-09');
    assert.strictEqual(r.afterRoundTrip, '2026-07', 'the reader\'s July survives leaving and coming back');
    assert.strictEqual(r.league, '2026-09', 'and is Rankings\' alone: League keeps its own default');
    assert.strictEqual(r.home, '2026-09', 'as does Home');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('month-scoped features stay independent while moving between them', async () => {
  const app = await H.open({ record: withSeptember(2), now: NOW });
  try {
    const r = await app.run(() => {
      const seen = {};
      goToSection('rankings'); seen.rankings = selectedMonth;
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      const sel = document.getElementById('summaryMonthSelect');
      sel.value = '2026-06'; sel.dispatchEvent(new Event('change'));
      seen.leagueChosen = summaryMonth;
      goToSection('play'); document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      seen.games = gamesMonth;
      goToSection('players');
      openSheet(PLAYERS[0].name); seen.profile = profileMonth; closeSheet();
      document.querySelector('#tabrow .tab-btn[data-tab="h2h"]').click(); seen.compare = h2hMonth;
      goToSection('rankings'); seen.rankingsAgain = selectedMonth;
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click(); seen.leagueAgain = summaryMonth;
      return seen;
    });
    assert.strictEqual(r.rankings, '2026-08', 'Rankings: Meaningful Month (2 of 5)');
    assert.strictEqual(r.leagueChosen, '2026-06');
    assert.strictEqual(r.games, 'all', 'Games: All time, its own');
    assert.strictEqual(r.profile, 'all', 'Profile: All time, its own');
    assert.strictEqual(r.compare, 'all', 'Compare: All time, its own');
    assert.strictEqual(r.rankingsAgain, '2026-08', 'League\'s choice never reached Rankings');
    assert.strictEqual(r.leagueAgain, '2026-06', 'and League kept it');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('at midnight on the 1st, the reader\'s own time zone decides the month', async () => {
  // 23:30 UTC on 30 September is 00:30 on 1 October in London (BST).
  const instant = '2026-09-30T23:30:00Z';
  const inLondon = await H.open({ now: instant, timezoneId: 'Europe/London' });
  const inUtc = await H.open({ now: instant, timezoneId: 'UTC' });
  try {
    const london = await inLondon.run(() => ({ ...meaningfulMonthNow(), shown: selectedMonth }));
    const utc = await inUtc.run(() => ({ ...meaningfulMonthNow(), shown: selectedMonth }));
    assert.strictEqual(london.current, '2026-10', 'in London it is already October');
    assert.strictEqual(london.shown, '2026-09', '...with no October games, so September');
    assert.strictEqual(london.reason, 'current-too-thin');
    assert.strictEqual(utc.current, '2026-09', 'in UTC it is still September');
    assert.strictEqual(utc.reason, 'current');
    assert.deepStrictEqual(inLondon.pageErrors, []);
  } finally { await inLondon.close(); await inUtc.close(); }
});

maybe('rolling and current views are untouched by the rule', async () => {
  const app = await H.open({ record: withSeptember(2), now: NOW });
  try {
    const r = await app.run(() => {
      // Somebody who actually played in (thin) September.
      const sep = getAllApprovedMatches().find((m) => m.date.startsWith('2026-09') && !m.isDraw);
      const name = sep.winners[0];
      // Last 10 is each player's own latest games, across months.
      const l10 = LastTen.build(leagueAppearances()).find((row) => row.name === name);
      // The profile's current state and results.
      openSheet(name);
      const profile = { month: profileMonth, heroRating: (document.querySelector('.pp-hero-rating') || {}).textContent || '' };
      closeSheet();
      const p = PLAYERS.find((x) => x.name === name);
      return { l10From: l10.from, l10To: l10.to, profile, rating: Math.round(p.rating), rankings: selectedMonth };
    });
    assert.strictEqual(r.rankings, '2026-08');
    assert.ok(r.l10To >= '2026-09-01', `Last 10 still reaches into September (${r.l10From} → ${r.l10To})`);
    assert.strictEqual(r.profile.month, 'all');
    assert.strictEqual(r.profile.heroRating.trim(), String(r.rating), 'the profile shows today\'s rating');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('View Full Review opens the month the Home card is about', async () => {
  const app = await H.open({ record: withSeptember(6), now: NOW });
  try {
    const r = await app.run(() => {
      // A League choice made earlier must not hijack the review...
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      const sel = document.getElementById('summaryMonthSelect');
      sel.value = '2026-07'; sel.dispatchEvent(new Event('change'));
      setCurrentViewer(PLAYERS[0].name);
      goToSection('home');
      const card = homeMonth();
      document.getElementById('homeFullReviewBtn').click();
      const review = document.getElementById('summaryMonthSelect').value;
      return { card, review, leagueChoiceKept: summaryMonthChoice };
    });
    assert.strictEqual(r.card, '2026-09');
    assert.strictEqual(r.review, r.card, 'the review is of the month named above the button');
    assert.strictEqual(r.leagueChoiceKept, '2026-07', '...and League\'s own choice is left as it was');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
