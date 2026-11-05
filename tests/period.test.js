// ===================== THE COMMUNITY'S PERIOD =====================
// Shaun, 5 Nov: Padel Championships is judged by the quarter -- one length for
// the League, the Race, Champions and the honours -- with 4 matches to
// qualify. Money Padel stays monthly with 5. config/period.js says which
// dates belong to which period; nothing else slices a date into a month.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../assets/js/config/period.js');
const H = require('./helpers/uiHarness.js');
const { appScriptFiles } = require('./helpers/appSource.js');

const maybe = H.available() ? test : test.skip;
const ROOT = path.join(__dirname, '..');

test('Money Padel\'s period is the calendar month, exactly as before', () => {
  assert.strictEqual(P.MONTHS, 1);
  assert.strictEqual(P.of('2026-10-31'), '2026-10');
  assert.strictEqual(P.end('2024-02'), '2024-02-29');
  assert.strictEqual(P.label('2026-10'), 'October 2026');
  assert.strictEqual(P.name('2026-10'), 'October');
  assert.deepStrictEqual([P.prev('2026-01'), P.next('2026-12')], ['2025-12', '2027-01']);
  assert.strictEqual(P.Adjective, 'Monthly');
});

test('a quarter: Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec, named by its first month', () => {
  const Q = P.make({ months: 3, noun: 'quarter' });
  assert.deepStrictEqual(['2026-01-01', '2026-03-31', '2026-04-01', '2026-09-30', '2026-11-05', '2026-12-31'].map(Q.of),
    ['2026-01', '2026-01', '2026-04', '2026-07', '2026-10', '2026-10']);
  assert.strictEqual(Q.start('2026-10'), '2026-10-01');
  assert.strictEqual(Q.end('2026-10'), '2026-12-31');
  assert.strictEqual(Q.end('2026-01'), '2026-03-31');
  assert.strictEqual(Q.label('2026-07'), 'Jul–Sep 2026');
  assert.deepStrictEqual([Q.prev('2026-01'), Q.next('2026-10')], ['2025-10', '2027-01']);
  assert.strictEqual(Q.current(new Date(2026, 10, 5)), '2026-10');
  assert.deepStrictEqual([Q.noun, Q.Noun, Q.Adjective], ['quarter', 'Quarter', 'Quarterly']);
  assert.ok(Q.contains('2026-10', '2026-12-15'));
  assert.ok(!Q.contains('2026-10', '2027-01-01'));
});

test('the app never slices a date into a month itself: it asks the period', () => {
  const files = appScriptFiles().map((f) => path.join('assets/js', f))
    .concat(['assets/js/monthlyViews.js', 'assets/js/meaningfulMonth.js', 'assets/js/journeyView.js', 'review/review.js']);
  const found = [];
  files.forEach((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (/[dD]ate\)?\.slice\(0, ?7\)|month \+ '-31'|getMonth\(\) - i/.test(code)) found.push(`${f}:${i + 1}  ${line.trim()}`);
  }));
  assert.deepStrictEqual(found, []);
});

test('the quarter\'s snapshots: one per quarter, closing on its last day', () => {
  const MV = require('../assets/js/monthlyViews.js');
  const E = require('../assets/js/ratingEngine.js');
  const ev = (playerId, date, post) => ({ eventType: E.EVENT.MATCH_UPDATE, playerId, effectiveDate: date, postMatchRating: post,
    previousRating: post - 10, actualScore: 1, preMatchExpectedScore: 0.5 });
  const events = [ev('A', '2026-10-02', 1500), ev('A', '2026-11-20', 1520), ev('A', '2026-12-30', 1540), ev('A', '2027-01-05', 1550)];
  global.Period = P.make({ months: 3 });
  try {
    const views = MV.build(events);
    assert.deepStrictEqual(Object.keys(views.byMonth).sort(), ['2026-10', '2027-01']);
    assert.strictEqual(MV.monthEndRatings(views, '2026-10').A, 1540, 'Oct–Dec closes on 31 December');
  } finally { delete global.Period; }
});

maybe('Padel Championships: periods are quarters, the League and Race cover all three months, 4 matches qualify', async () => {
  const app = await H.open({ path: 'index.html?club=padelchampionships', now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(() => {
      const months = getAvailableMonths();
      const q = '2026-07';
      const inQuarter = matchesIncludingDraws().filter((m) => m.date >= '2026-07-01' && m.date <= '2026-09-30').length;
      const race = buildMonthlyRace(q);
      const raced = new Set(race.table.flatMap((row) => row.matches.map((m) => m.id))).size;
      const minPlayed = Math.min(...race.table.filter((row) => row.qualified).map((row) => row.played));
      const shortOf = race.table.filter((row) => !row.qualified).every((row) => row.played < 4);
      return { months, label: monthLabel(q), current: currentMonthKey(), inQuarter, raced, minPlayed, shortOf,
        rankMin: defaultRankingMinGames(q), races: Period.MONTHS };
    });
    assert.ok(r.months.length > 0);
    r.months.forEach((k) => assert.match(k, /^\d{4}-(01|04|07|10)$/, `${k} starts a quarter`));
    assert.strictEqual(r.label, 'Jul–Sep 2026');
    assert.strictEqual(r.current, '2026-07');
    assert.ok(r.inQuarter > 0);
    assert.strictEqual(r.raced, r.inQuarter, 'the Race counts every match of July, August and September');
    assert.ok(r.minPlayed >= 4, 'qualified means 4 or more');
    assert.ok(r.shortOf);
    assert.strictEqual(r.rankMin, 4);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('Money Padel: still months, still 5 to qualify', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(() => ({ months: getAvailableMonths().includes('2026-08'), label: monthLabel('2026-08'),
      rankMin: defaultRankingMinGames('2026-08'), minPlayed: Math.min(...buildMonthlyRace('2026-08').table.filter((x) => x.qualified).map((x) => x.played)) }));
    assert.deepStrictEqual({ ...r, minPlayed: r.minPlayed >= 5 }, { months: true, label: 'August 2026', rankMin: 5, minPlayed: true });
  } finally { await app.close(); }
});

test('the community\'s words: a quarter reads "Quarterly" and "quarter"; a length of time and Money Padel are untouched', () => {
  const W = require('../assets/js/ui/components/clubWords.js');
  assert.strictEqual(W.active, false, 'Money Padel: nothing is rewritten');
  assert.strictEqual(W.text('Monthly Race · this month'), 'Monthly Race · this month');
  const Q = W.make(P.make({ months: 3, noun: 'quarter' }));
  assert.strictEqual(Q.text('Monthly Race · Player of the Month · this month\'s best'), 'Quarterly Race · Player of the Quarter · this quarter\'s best');
  assert.strictEqual(Q.text('MONTHLY REVIEW'), 'QUARTERLY REVIEW');
  assert.strictEqual(Q.text('the last 3 months, a 12-month view, 1 month, October'), 'the last 3 months, a 12-month view, 1 month, October');
  assert.strictEqual(Q.text('Jul–Sep 2026 Monthly Race'), 'Jul–Sep 2026 Quarterly Race', 'a year is not a length of time');
});

test('a picture is measured and drawn in the community\'s words', () => {
  const W = require('../assets/js/ui/components/clubWords.js');
  const P3 = P.make({ months: 3, noun: 'quarter' });
  global.Period = P3;
  try {
    delete require.cache[require.resolve('../assets/js/ui/components/clubWords.js')];
    const Q = require('../assets/js/ui/components/clubWords.js');
    const drawn = [], measured = [];
    const ctx = Q.canvas({ measureText: (t) => { measured.push(t); return { width: t.length }; }, fillText: (t) => drawn.push(t) });
    ctx.measureText('Monthly Race'); ctx.fillText('Player of the Month', 0, 0);
    assert.deepStrictEqual([measured, drawn], [['Quarterly Race'], ['Player of the Quarter']]);
  } finally {
    delete global.Period;
    delete require.cache[require.resolve('../assets/js/ui/components/clubWords.js')];
    assert.strictEqual(W.active, false);
  }
});

maybe('Padel Championships\' screens say quarter, never month; Money Padel\'s still say month', async () => {
  const words = async (pathName) => {
    const app = await H.open({ path: pathName, now: '2026-09-21T10:00:00.000Z' });
    try {
      return await app.run(async () => {
        const seen = [];
        for (const tab of ['summary', 'power', 'games']) {
          const b = typeof legacyTabBtn === 'function' ? legacyTabBtn(tab) : null;
          if (b) b.click();
          await new Promise((r) => setTimeout(r, 50));
          seen.push(document.body.innerText);
        }
        const text = seen.join('\n');
        const plain = text.replace(/\b\d{1,2}[\s-]months?\b/gi, '');
        return { month: (plain.match(/\bmonth(ly|s)?\b/gi) || []).length, quarter: (text.match(/\bquarter(ly|s)?\b/gi) || []).length };
      });
    } finally { await app.close(); }
  };
  const pc = await words('index.html?club=padelchampionships');
  const mp = await words('index.html');
  assert.strictEqual(pc.month, 0, 'no "month" on Padel Championships\' screens');
  assert.ok(pc.quarter > 0);
  assert.ok(mp.month > 0);
  assert.strictEqual(mp.quarter, 0);
});
