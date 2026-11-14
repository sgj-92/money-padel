// ===================== RESULTS: THE BREAKDOWN, FOR ANY GROUP, AS A PICTURE =====================
// Shaun, 14 Nov: "Allow me to share a picture of this breakdown when I filter
// for games regardless of number of players." One player keeps their line;
// two to four get a row each over the same games; any of them can be shared
// as a picture of the breakdown and the games behind it.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

maybe('two players: a row each over exactly the games listed, and a picture of it with the games', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      gamesMonth = 'all';
      const [a, b] = PLAYERS.slice(0, 2).map((p) => p.name);
      setGamesPlayerFilter([a, b]);
      renderGamesTab();
      const rows = [...document.querySelectorAll('#gamesGroupRecord tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
      const listed = [...document.querySelectorAll('#gamesView .game-card-clickable')].length;
      // Counted independently from the games on screen.
      const vm = getFilteredGamesViewModel();
      const own = [a, b].map((n) => { let w = 0, d = 0, l = 0; vm.games.forEach((m) => { const o = MatchOutcome.outcomeFor(m, n); if (o === 'win') w++; else if (o === 'draw') d++; else if (o === 'loss') l++; }); return [n, vm.games.length, w, d, l]; });
      const view = gamesPictureView(vm);
      let painted = null;
      const realShare = CardPainter.share;
      CardPainter.share = async (files) => { painted = { name: files[0].name, size: files[0].size }; return 'shared'; };
      document.getElementById('gamesPicture').click();
      for (let k = 0; k < 500 && !document.getElementById("gamesPictureMsg").textContent; k++) await new Promise((res) => setTimeout(res, 20));
      CardPainter.share = realShare;
      const cv = CardPainter.gamesRecord(view, {});
      return { a, b, rows, listed, own, view: { title: view.title, players: view.players.length, rows: view.rows.length, more: view.more }, painted, msg: document.getElementById('gamesPictureMsg').textContent,
        canvas: [cv.width, cv.height], personal: !!document.getElementById('gamesRecord'), wide: document.documentElement.scrollWidth };
    });
    assert.strictEqual(r.personal, false, 'a group has no single point of view');
    assert.deepStrictEqual(r.rows.map((x) => [x[0], +x[1], +x[2], +x[3], +x[4]]), r.own);
    assert.strictEqual(r.own[0][1], r.listed, 'P is the games listed');
    assert.strictEqual(r.view.title, `Games with ${r.a} + ${r.b}`, "as the list heading says it");
    assert.deepStrictEqual([r.view.players, r.view.rows + r.view.more], [2, r.listed]);
    assert.ok(r.painted && /games-.*\.png$/.test(r.painted.name) && r.painted.size > 1000);
    assert.strictEqual(r.msg, 'Picture shared.');
    assert.ok(r.canvas[1] > 600 && r.canvas[0] * r.canvas[1] < 16.7e6, 'fits what an iPhone can draw');
    assert.strictEqual(r.wide, 390);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('one player keeps their line and can share it too; no player, no picture', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(() => {
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      gamesMonth = 'all';
      setGamesPlayerFilter([]); renderGamesTab();
      const none = !!document.getElementById('gamesPicture');
      setGamesPlayerFilter([PLAYERS[0].name]); renderGamesTab();
      const view = gamesPictureView(getFilteredGamesViewModel());
      return { none, one: !!document.getElementById('gamesPicture'), line: !!document.getElementById('gamesRecord'), group: !!document.getElementById('gamesGroupRecord'),
        title: view.title, name: PLAYERS[0].name, results: [...new Set(view.rows.map((x) => x.result))].sort() };
    });
    assert.deepStrictEqual([r.none, r.one, r.line, r.group], [false, true, true, false]);
    assert.strictEqual(r.title, `${r.name}'s games`);
    assert.ok(r.results.every((x) => ['Won', 'Drew', 'Lost'].includes(x)), 'each game from their side');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
