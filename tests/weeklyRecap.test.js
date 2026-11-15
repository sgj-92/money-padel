// ===================== THE WEEKLY RECAP =====================
// Shaun, 15 Nov: "a weekly recap, showing the number of games played, who had
// the most wins, biggest shock, number of doughnuts and who gave/received the
// most, if anyone had a bad week."

const test = require('node:test');
const assert = require('node:assert');
const R = require('../assets/js/domain/recap/weeklyRecap.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

test('a week is Monday to Sunday', () => {
  assert.deepStrictEqual(['2026-11-09', '2026-11-12', '2026-11-15', '2026-11-16'].map(R.weekStart), ['2026-11-09', '2026-11-09', '2026-11-09', '2026-11-16']);
  assert.strictEqual(R.weekEnd('2026-11-09'), '2026-11-15');
  assert.deepStrictEqual(R.weeks([{ date: '2026-11-03' }, { date: '2026-11-14' }, { date: '2026-11-10' }]), ['2026-11-09', '2026-11-02']);
});

test('the recap: games, most wins, the biggest shock, doughnuts both ways, and a bad week only when it is one', () => {
  const m = (id, date, winners, losers, sets, isDraw) => ({ id, date, winners, losers, sets, isDraw: !!isDraw });
  const matches = [
    m('a', '2026-11-09', ['Kaz', 'Len'], ['Osh', 'Eli'], [[6, 0], [6, 2]]),
    m('b', '2026-11-11', ['Kaz', 'Eli'], ['Len', 'Osh'], [[6, 4], [0, 6], [6, 3]]),
    m('c', '2026-11-15', ['Osh', 'Rishi'], ['Kaz', 'Len'], [[7, 5]]),          // the upset
    m('d', '2026-11-13', ['Len', 'Rishi'], ['Kaz', 'Osh'], [[3, 6]], true),      // a draw
    m('x', '2026-11-16', ['Eli', 'Rishi'], ['Kaz', 'Len'], [[6, 0]]),          // next week
  ];
  const ev = (matchId, date, playerId, pre, delta) => ({ eventType: 'MATCH_UPDATE', matchId, effectiveDate: date, playerId, preMatchRating: pre, ratingDelta: delta });
  const journey = [
    ev('a', '2026-11-09', 'Osh', 1500, -4), ev('a', '2026-11-09', 'Eli', 1500, -4),
    ev('b', '2026-11-11', 'Osh', 1496, -2), ev('b', '2026-11-11', 'Len', 1600, -1),
    ev('c', '2026-11-15', 'Osh', 1300, 6), ev('c', '2026-11-15', 'Rishi', 1400, 6), ev('c', '2026-11-15', 'Kaz', 1700, -9), ev('c', '2026-11-15', 'Len', 1600, -9),
    ev('x', '2026-11-16', 'Kaz', 1690, -30),
  ];
  const r = R.build({ matches, journey, start: '2026-11-09' });
  assert.deepStrictEqual([r.games, r.players], [4, 5]);
  assert.deepStrictEqual(r.mostWins, { names: ['Kaz'], value: 2 });
  assert.deepStrictEqual(r.mostLosses, { names: ['Len', 'Osh'], value: 2 }, 'a draw is not a loss');
  assert.deepStrictEqual([r.shock.match.id, r.shock.gap], ['c', 300], 'rated 1350 against 1650');
  assert.strictEqual(r.doughnuts, 2);
  assert.deepStrictEqual(r.gaveMost, { names: ['Len'], value: 2 }, 'Kaz & Len gave one, Len & Osh the other');
  assert.deepStrictEqual(r.receivedMost, { names: ['Eli'], value: 2 }, 'Osh & Eli took one, Kaz & Eli the other');
  assert.deepStrictEqual(r.bad, { name: 'Len', change: -10, record: { w: 1, d: 1, l: 2 } }, 'the biggest fall this week; next week\'s is not counted');
  const quiet = R.build({ matches: [matches[0]], journey: [ev('a', '2026-11-09', 'Osh', 1500, -4)], start: '2026-11-09' });
  assert.strictEqual(quiet.bad, null, `a 4-point dip is not a bad week (${R.BAD_WEEK_POINTS} or more)`);
});

maybe('Rankings › Weekly recap: the latest week with games, any week on request, and copied for WhatsApp', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z', viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      const copied = [];
      window.copyText = async (t) => { copied.push(t); return true; };
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      summaryMode = 'weekly'; renderSummary();
      const monthHidden = getComputedStyle(document.querySelector('.lg-controls .fg-row')).display === 'none';
      const weeks = [...document.querySelectorAll('#recapWeekSelect option')].map((o) => o.value);
      const latest = weeks[0];
      const games = getAllApprovedMatches().filter((m) => WeeklyRecap.weekStart(m.date) === latest).length;
      const items = [...document.querySelectorAll('#weeklyRecap .recap-item')].map((e) => e.innerText.replace(/\s+/g, ' ').trim());
      const sel = document.getElementById('recapWeekSelect');
      sel.value = weeks[1]; sel.dispatchEvent(new Event('change'));
      const heading = document.querySelector('#summaryContent .section-heading').innerText;
      document.getElementById('recapCopy').click();
      await new Promise((res) => setTimeout(res, 50));
      return { monthHidden, weeks, latest, games, items, heading, second: recapRangeLabel(weeks[1], WeeklyRecap.weekEnd(weeks[1])), copied, wide: document.documentElement.scrollWidth };
    });
    assert.ok(r.monthHidden, 'no Month: the recap picks its own week');
    assert.ok(r.weeks.length > 1 && r.weeks.every((w, i) => i === 0 || w < r.weeks[i - 1]), 'newest first');
    assert.match(r.items[0], new RegExp(`^🎾 Games ${r.games} games? · \\d+ players?`, 'i'));
    assert.deepStrictEqual(r.items.map((x) => x.split(' ')[1].toLowerCase()).filter((w) => w !== 'most' && w !== 'biggest'), ['games', 'doughnuts', 'bad'], 'games, doughnuts and bad week always; most wins and shock when there are any');
    assert.strictEqual(r.heading, `📅 Weekly recap · ${r.second}`);
    assert.match(r.copied[0], new RegExp(`^Money Padel · Weekly recap · ${r.second}\\n\\n🎾 Games: `));
    assert.match(r.copied[0], /\n🍩 Doughnuts: /);
    assert.match(r.copied[0], /\n📉 Bad week: /);
    assert.strictEqual(r.wide, 390);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('the recap and the week\'s games can be shared as pictures, and the games copied as a list', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z', viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      const shared = [], copied = [];
      CardPainter.share = async (files) => { shared.push({ name: files[0].name, size: files[0].size }); return 'shared'; };
      window.copyText = async (t) => { copied.push(t); return true; };
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      summaryMode = 'weekly'; renderSummary();
      const { recap } = recapData();
      const wait = async (n) => { for (let k = 0; k < 400 && shared.length < n; k++) await new Promise((res) => setTimeout(res, 20)); };
      document.getElementById('recapPicture').click(); await wait(1);
      document.getElementById('recapGamesPicture').click(); await wait(2);
      document.getElementById('recapGamesCopy').click();
      await new Promise((res) => setTimeout(res, 50));
      const listed = [...document.querySelectorAll('#recapGames .recap-game')].length;
      const games = getAllApprovedMatches().filter((m) => m.date >= recap.start && m.date <= recap.end).length;
      return { shared, copied, listed, games, start: recap.start, msg: document.getElementById('recapCopyMsg').textContent };
    });
    assert.deepStrictEqual(r.shared.map((x) => x.name), [`money-padel-weekly-recap-${r.start}.png`, `money-padel-week-games-${r.start}.png`]);
    assert.ok(r.shared.every((x) => x.size > 1000));
    assert.strictEqual(r.listed, r.games, 'every game of the week is listed');
    assert.strictEqual(r.copied[0].split('\n').filter((l) => /^ {2}\S/.test(l)).length, r.games, 'and copied');
    assert.match(r.copied[0], /^Money Padel · Games · /);
    assert.match(r.msg, /Games list copied/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 15 Nov: "Open the share sheet when I press share recap picture. And
// allow me to include or deselect each metric before sending."
maybe('the recap picture opens the share sheet straight from the tap, with only the lines left ticked', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z', viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      const shared = [];
      navigator.canShare = () => true;
      navigator.share = (data) => { shared.push(data.files.map((f) => f.name)); return Promise.resolve(); };
      const copied = [];
      window.copyText = async (t) => { copied.push(t); return true; };
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      summaryMode = 'weekly'; renderSummary();
      const { recap } = recapData();
      // Untick Bad week (and the shock, if there is one this week).
      const bad = document.querySelector('[data-recap-line="bad"]');
      bad.checked = false; bad.dispatchEvent(new Event('change'));
      // Wait for the picture to be made in advance.
      for (let k = 0; k < 400 && !(recapReady.recap && recapReady.recap.file); k++) await new Promise((res) => setTimeout(res, 20));
      const drawn = recapChosen(recap).map((l) => l.key);
      document.getElementById('recapPicture').click();
      const atOnce = shared.length;    // no waiting: the sheet opens inside the tap
      await new Promise((res) => setTimeout(res, 50));
      document.getElementById('recapCopy').click();
      await new Promise((res) => setTimeout(res, 50));
      const faded = document.querySelector('[data-recap-line="bad"]').closest('.recap-item').classList.contains('is-off');
      return { atOnce, shared, drawn, copied, faded, msg: document.getElementById('recapCopyMsg').textContent, kept: localStorage.getItem('recapLinesOff') };
    });
    assert.strictEqual(r.atOnce, 1, 'the share sheet is asked for in the same moment as the tap');
    assert.ok(!r.drawn.includes('bad'), 'Bad week is left off the picture');
    assert.ok(r.drawn.includes('games'));
    assert.ok(!/Bad week/.test(r.copied[0]), 'and off the copied text');
    assert.ok(r.faded);
    assert.strictEqual(r.kept, '["bad"]', 'remembered on this device');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 15 Nov: "Allow me to combine the weekly recap summary and games
// played into one picture too. I also want to share upcoming fixtures for the
// following week."
maybe('the recap and the games share as one picture, and next week\'s fixtures as a picture and a list', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z', viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      const shared = [], copied = [];
      CardPainter.share = async (files) => { shared.push({ name: files[0].name, size: files[0].size }); return 'shared'; };
      window.copyText = async (t) => { copied.push(t); return true; };
      const at = '2026-09-20T09:00:00.000Z';
      const agreed = (id, players, date, booked, extra = {}) => ({ ...FixtureFlow.createAgreed({ id, players, by: 'Shaun', at, preferredDate: date, courtBookingMade: booked, ...extra }) });
      gameRequestsState = [
        agreed('fx-a', ['Shaun', 'Max', 'KC', 'Tom'], '2026-09-29', true, { preferredTime: '19:00', location: 'Padel Haus' }),
        agreed('fx-b', ['Erf', 'Eli', 'Osh', 'Len'], '2026-10-02', false),
        agreed('fx-c', ['Kaz', 'PDM', 'Rhys', 'Omar'], '2026-09-23', true),
        agreed('fx-d', ['Jams', 'Jords', 'Tee', 'MK'], '', false),
      ];
      document.querySelector('#tabrow .tab-btn[data-tab="summary"]').click();
      summaryMode = 'weekly'; renderSummary();
      const { recap } = recapData();
      const wait = async (n) => { for (let k = 0; k < 400 && shared.length < n; k++) await new Promise((res) => setTimeout(res, 20)); };
      document.getElementById('recapBothPicture').click(); await wait(1);
      const nextList = [...document.querySelectorAll('#recapFixtures .recap-game')].map((x) => x.textContent);
      const heading = [...document.querySelectorAll('.section-heading')].map((x) => x.textContent).find((t) => /fixtures/.test(t));
      const note = document.getElementById('summaryContent').textContent.includes('1 agreed game has no date yet');
      document.getElementById('recapFixturesPicture').click(); await wait(2);
      document.getElementById('recapFixturesCopy').click();
      await new Promise((res) => setTimeout(res, 50));
      const msg = document.getElementById('recapFixturesMsg').textContent;
      const sel = document.getElementById('recapFixturesWeek');
      sel.value = 'this'; sel.dispatchEvent(new Event('change'));
      const thisList = [...document.querySelectorAll('#recapFixtures .recap-game')].map((x) => x.textContent);
      return { shared, copied, nextList, thisList, heading, note, msg, start: recap.start };
    });
    assert.deepStrictEqual(r.shared.map((x) => x.name), [`money-padel-weekly-recap-games-${r.start}.png`, 'money-padel-fixtures-2026-09-28.png']);
    assert.ok(r.shared.every((x) => x.size > 1000));
    assert.match(r.heading, /Next week’s fixtures · 2/);
    assert.strictEqual(r.nextList.length, 2);
    assert.match(r.nextList[0], /Shaun & Max vs KC & Tom.*19:00 · Padel Haus.*Booked/);
    assert.match(r.nextList[1], /Erf & Eli vs Osh & Len.*Called out/);
    assert.ok(r.note, 'undated agreed games are mentioned, not listed');
    assert.match(r.copied[0], /^Money Padel · Next week's fixtures · 28 Sep – 4 Oct 2026/);
    assert.match(r.copied[0], /Tue 29 Sep\n {2}Shaun & Max vs KC & Tom · 19:00 · Padel Haus\n/);
    assert.match(r.copied[0], /Erf & Eli vs Osh & Len · Time and venue TBC \(court not booked yet\)/);
    assert.match(r.msg, /Fixtures copied/);
    assert.deepStrictEqual(r.thisList.length, 1, 'the rest of this week instead');
    assert.match(r.thisList[0], /Kaz & PDM vs Rhys & Omar/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
