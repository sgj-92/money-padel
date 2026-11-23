// ===================== A PLAYER'S GAMES, BY MONTH =====================
// Shaun, 23 Nov: "enhance the player profile section of the app, so people
// can easily see the matches they've played by month and be able to quickly
// share their games played etc. right now its fairly basic."

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-21T10:00:00.000Z';

maybe('a chip per month with its count; All groups the games under month headings with their figures', async () => {
  const app = await H.open({ now: NOW, viewport: { width: 390, height: 844 }, mobile: true });
  try {
    const r = await app.run(() => {
      openSheet('Kaz');
      const games = PlayerForm.gamesOf(matchesIncludingDraws(), 'Kaz');
      const byMonth = {};
      games.forEach((m) => { const k = m.date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + 1; });
      const chips = [...document.querySelectorAll('.pp-chip')].map((c) => [c.dataset.ppMonth, Number(c.querySelector('.pp-chip-n').textContent)]);
      const heads = [...document.querySelectorAll('.pp-month-head')].map((h) => h.querySelector('[data-pp-share-month]').dataset.ppShareMonth);
      const firstHeadFigs = document.querySelector('.pp-month-head .pp-month-figs').textContent;
      const stats = [...document.querySelectorAll('.pp-mc-stats b')].map((b) => b.textContent);
      const rec = playerRecordOf('Kaz');
      const row = document.querySelector('.pp-games .pp-match-row');
      const firstGame = games[0], sides = MatchOutcome.sidesFor(firstGame, 'Kaz');
      return { chips, byMonth, total: games.length, heads, firstHeadFigs, stats, rec,
        rowWith: row.querySelector('.pp-match-teams').textContent, rowV: row.querySelector('.pp-match-opp').textContent,
        wantWith: sides.partner ? `with ${sides.partner}` : 'Singles', wantV: `v ${sides.theirs.join(' & ')}`,
        shareButtons: document.querySelectorAll('.pp-game-share [data-scorecard]').length, cards: document.querySelectorAll('.pp-match-detail').length,
        wide: document.documentElement.scrollWidth };
    });
    assert.deepStrictEqual(r.chips[0], ['all', r.total]);
    const months = Object.keys(r.byMonth).sort().reverse();
    assert.deepStrictEqual(r.chips.slice(1), months.map((m) => [m, r.byMonth[m]]), 'newest first, each with its count');
    assert.deepStrictEqual(r.heads, months, 'a heading for each month, in order');
    assert.match(r.firstHeadFigs, new RegExp(`^${r.byMonth[months[0]]} games? · \\d+W`));
    assert.strictEqual(r.stats[0], String(r.total));
    assert.strictEqual(r.stats[1], `${r.rec.wins}-${r.rec.draws}-${r.rec.losses}`);
    assert.strictEqual(r.rowWith, r.wantWith);
    assert.strictEqual(r.rowV, r.wantV);
    assert.strictEqual(r.shareButtons, r.cards, 'every game can be shared as its result card');
    assert.strictEqual(r.wide, 390);
  } finally { await app.close(); }
});

maybe('a month chip shows that month alone, with its figures and most frequent partner; no banner', async () => {
  const app = await H.open({ now: NOW, viewport: { width: 390, height: 844 }, mobile: true });
  try {
    const r = await app.run(() => {
      openSheet('Kaz');
      const chip = document.querySelectorAll('.pp-chip')[2];
      const month = chip.dataset.ppMonth;
      chip.click();
      const g = profileGamesByMonth('Kaz').find((x) => x.month === month);
      return { month, profileMonth, n: g.games.length, cards: document.querySelectorAll('.pp-match-detail').length,
        months: [...new Set([...document.querySelectorAll('.pp-match-detail .top span:first-child')].map((e) => e.textContent.slice(0, 7)))],
        on: document.querySelector('.pp-chip.is-on').dataset.ppMonth, heading: document.querySelector('.pp-results-head .pp-section-label').textContent,
        games: document.querySelector('.pp-mc-stats b').textContent, partner: !!document.querySelector('.pp-mc-partner'),
        banner: /Showing only/.test(document.getElementById('premiumProfileWrap').textContent), heads: document.querySelectorAll('.pp-month-head').length };
    });
    assert.strictEqual(r.profileMonth, r.month);
    assert.strictEqual(r.cards, r.n);
    assert.deepStrictEqual(r.months, [r.month]);
    assert.strictEqual(r.on, r.month);
    assert.match(r.heading, /^Results · \w+ \d{4}$/);
    assert.strictEqual(r.games, String(r.n));
    assert.ok(r.partner);
    assert.strictEqual(r.banner, false);
    assert.strictEqual(r.heads, 0, 'no month headings inside one month');
  } finally { await app.close(); }
});

maybe('Share makes a picture of the month: the player, the figures and the games, scores from their side', async () => {
  const app = await H.open({ now: NOW, viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      const groups = profileGamesByMonth('Kaz');
      const g = groups.find((x) => x.l > 0) || groups[0];
      let painted = null;
      const real = CardPainter.playerGames;
      CardPainter.playerGames = (v, o) => { painted = v; return real(v, o); };
      let shared = null;
      CardPainter.share = async (files, meta) => { shared = { files: files.map((f) => [f.name, f.type, f.size > 1000]), meta }; return 'shared'; };
      openSheet('Kaz');
      document.querySelector(`.pp-chip[data-pp-month="${g.month}"]`).click();
      document.getElementById('ppShareGames').click();
      for (let k = 0; k < 100 && !shared; k++) await new Promise((res) => setTimeout(res, 20));
      const lost = g.games.find((m) => MatchOutcome.letterFor(m, 'Kaz') === 'L');
      const lostRow = lost ? painted.rows[g.games.indexOf(lost)] : null;
      const ownSets = lost ? setsForViewer(lost, lost.winners.includes('Kaz')).map((x) => x.join('-')).join('  ') : null;
      return { g: { month: g.month, n: g.games.length, w: g.w, d: g.d, l: g.l }, painted: { title: painted.title, stats: painted.stats.map((s) => s.value), rows: painted.rows.length },
        shared, note: document.getElementById('ppShareNote').textContent, lostRow, ownSets };
    });
    assert.strictEqual(r.painted.title, 'Kaz');
    assert.deepStrictEqual(r.painted.stats.slice(0, 2), [String(r.g.n), `${r.g.w}-${r.g.d}-${r.g.l}`]);
    assert.strictEqual(r.painted.rows, Math.min(15, r.g.n));
    assert.strictEqual(r.shared.files.length, 1);
    assert.match(r.shared.files[0][0], /-Kaz-\d{4}-\d{2}\.png$/);
    assert.strictEqual(r.shared.files[0][1], 'image/png');
    assert.ok(r.shared.files[0][2], 'a real picture');
    assert.match(r.shared.meta.text, new RegExp(`^Kaz · \\w+ \\d{4}: ${r.g.n} games?`));
    assert.strictEqual(r.note, 'Shared.');
    if (r.lostRow) {
      assert.strictEqual(r.lostRow.result, 'LOST');
      assert.strictEqual(r.lostRow.score, r.ownSets, 'a loss reads from the player\'s side');
    }
  } finally { await app.close(); }
});
