// ===================== KING, CHAMPION, PLAYER OF THE MONTH =====================
// Shaun, 1 Nov: three honours, three sources --
//   King of Tier        the tier's leader in the All-time Power Rankings
//   Monthly Champion    the winner of the tier's Monthly Race
//   Player of the Month voted by the club
// It came up because October's Kings of Tiers crowned Osh while Kaz held the
// higher Power Rating: the King was the best rating among players with 5+
// games that month, which is neither honour.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

// The fixture's own era: its record ends in September 2026.
const NOW = '2026-09-26T12:00:00';

maybe('a King is the All-time leader of the tier, however few games they played that month', async () => {
  const app = await H.open({ now: NOW });
  try {
    const r = await app.run(() => {
      const out = [];
      getAvailableMonths().forEach((m) => {
        const kings = kingsOfTiersFor(m);
        const pool = kingPool(m);
        ['A', 'B', 'C'].forEach((t) => {
          const field = pool.filter((p) => p.scopeTier === t);
          const games = (n) => (computeMonthlyStats(m)[n] || { total: 0 }).total;
          out.push({ m, t, king: kings && kings[t] ? kings[t].name : null, top: field.length >= 2 ? field[0].name : null,
            lowInField: field.some((p) => games(p.name) < 5),
            allTen: field.every((p) => v3RatedMatchList().filter((x) => x.date <= monthLastDay(m) && x.players.includes(p.name)).length >= 10) });
        });
      });
      // Today's Kings are the All-time list's leaders.
      const now = kingsOfTiersFor('all');
      const allTime = rankingPool('all', 10);
      const today = ['A', 'B', 'C'].filter((t) => now[t]).map((t) => [now[t].name, allTime.find((p) => p.tier === t).name]);
      return { out, today };
    });
    r.out.forEach((x) => {
      assert.strictEqual(x.king, x.top, `${x.m} Tier ${x.t}: the King is the top of the All-time pool`);
      assert.ok(x.allTen, `${x.m} Tier ${x.t}: every contender has 10+ rated games by the month's end`);
    });
    assert.ok(r.out.some((x) => x.lowInField), 'players with under 5 games that month are still in the running');
    r.today.forEach(([king, leader]) => assert.strictEqual(king, leader));
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a Monthly Champion is the tier\'s Race leader among qualified players; "Leading" until the month is over', async () => {
  const app = await H.open({ now: NOW });
  try {
    const r = await app.run(() => {
      const race = buildMonthlyRace('2026-09').table;
      const champs = championsFor('2026-09');
      const want = Object.fromEntries(['A', 'B', 'C'].map((t) => [t, (race.find((x) => x.tier === t && x.qualified) || {}).playerId || null]));
      const got = Object.fromEntries(['A', 'B', 'C'].map((t) => [t, champs[t] ? champs[t].name : null]));
      legacyTabBtn('power').click();
      const panelTitle = (document.querySelector('#monthlyChampionsPanel .kings-panel-title') || {}).textContent;
      return { want, got, final: champs._final, panelTitle, august: championsFor('2026-08')._final, all: championsFor('all') };
    });
    assert.deepStrictEqual(r.got, r.want);
    assert.strictEqual(r.final, false, 'September is still being played on 26 September');
    assert.strictEqual(r.panelTitle, 'Leading September');
    assert.strictEqual(r.august, true, 'August is over: its leaders are Champions');
    assert.strictEqual(r.all, null, 'All time has no Monthly Champion');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('Power Rankings shows Kings, then the month\'s Champions; a Champion opens that month\'s Race; All time shows Kings only', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, now: NOW });
  try {
    const r = await app.run(() => {
      legacyTabBtn('power').click();
      const month = selectedMonth;
      const order = [...document.querySelectorAll('#kingsOfTiersPanel, #monthlyChampionsPanel, #rankingsPodium')].map((e) => e.id);
      const title = document.querySelector('#monthlyChampionsPanel .kings-panel-title').textContent;
      const champ = document.querySelector('#monthlyChampionsPanel .champ-card');
      const name = champ.dataset.player;
      champ.click();
      const opened = { tab: activeTab, mode: summaryMode, month: summaryMonth, heading: document.querySelector('#summaryContent .section-heading').textContent };
      legacyTabBtn('power').click();
      applyRankingsMonth('all'); render();
      return { month, order, title, name, opened, allTime: [...document.querySelectorAll('#kingsOfTiersPanel, #monthlyChampionsPanel')].map((e) => e.id) };
    });
    assert.deepStrictEqual(r.order, ['kingsOfTiersPanel', 'monthlyChampionsPanel', 'rankingsPodium']);
    assert.match(r.title, /^(Leading \w+|\w+ Champions)$/);
    assert.deepStrictEqual([r.opened.tab, r.opened.mode, r.opened.month], ['summary', 'race', r.month]);
    assert.match(r.opened.heading, /Monthly Race/);
    assert.deepStrictEqual(r.allTime, ['kingsOfTiersPanel']);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 1 Nov: "somewhere that we're recording the historical Monthly
// Champions and voted Player of the Months".
maybe('the Roll of Honour lists every month, newest first: each tier\'s Champion and the Player of the Month', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, now: NOW });
  try {
    const r = await app.run(() => {
      // A confirmed August award, made the way Admin makes one.
      const shortlist = PlayerOfMonth.finaliseShortlist({ month: '2026-08', entries: [{ playerId: 'Rishi', name: 'Rishi', tier: 'B', title: 'Strongest Results', citation: 'A month to remember.' }], by: 'test', at: 0 });
      potmRecordsState = { '2026-08': PlayerOfMonth.confirmWinner(shortlist, { playerId: 'Rishi', by: 'test', at: 0 }) };
      legacyTabBtn('summary').click();
      summaryMode = 'honours'; renderSummary();
      const cards = [...document.querySelectorAll('#summaryContent .roh-month')].map((card) => ({
        head: card.querySelector('.roh-month-head').innerText,
        rows: [...card.querySelectorAll('.roh-row')].map((row) => [...row.children].map((c) => c.innerText.trim())),
      }));
      const want = {};
      ['2026-09', '2026-08', '2026-07', '2026-06'].forEach((m) => {
        const c = championsFor(m);
        want[m] = ['A', 'B', 'C'].filter((t) => c && c[t]).map((t) => [t, c[t].name, raceWholePoints(c[t].score)]);
      });
      const monthHidden = getComputedStyle(document.querySelector('.lg-controls .fg-row')).display === 'none';
      // A Champion opens that month's Race.
      document.querySelectorAll('#summaryContent .roh-month')[2].querySelector('.roh-champ').click();
      return { cards, want, monthHidden, opened: [summaryMode, summaryMonth] };
    });
    assert.deepStrictEqual(r.cards.map((c) => c.head.split('\n')[0].toLowerCase()), ['september 2026', 'august 2026', 'july 2026', 'june 2026']);
    assert.match(r.cards[0].head, /In progress/i, 'September is still being played on 26 September');
    const months = ['2026-09', '2026-08', '2026-07', '2026-06'];
    r.cards.forEach((card, i) => {
      const champs = card.rows.filter((row) => /^Tier [ABCS] (Champion|leader)$/.test(row[0]));
      assert.deepStrictEqual(champs.map((row) => [row[0].split(' ')[1], row[1], row[2]]), r.want[months[i]], months[i]);
      assert.strictEqual(card.rows[card.rows.length - 1][0], 'Player of the Month');
    });
    assert.match(r.cards[0].rows.find((row) => row[0].startsWith('Tier'))[0], /leader$/, 'a month in progress has leaders, not Champions');
    assert.deepStrictEqual(r.cards[1].rows[r.cards[1].rows.length - 1].slice(0, 2), ['Player of the Month', 'Rishi']);
    assert.strictEqual(r.cards[2].rows[r.cards[2].rows.length - 1][1], 'Not chosen yet');
    assert.strictEqual(r.monthHidden, true, 'every month is listed: no Month box');
    assert.deepStrictEqual(r.opened, ['race', '2026-07']);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
