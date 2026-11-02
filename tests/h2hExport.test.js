// ===================== HEAD TO HEAD: COMPACT, AND TAKEN AWAY =====================
// Shaun, 1 Nov: condense the meeting cards and drop the amendment line so a
// phone screenshot holds more, and export the whole head-to-head as text to
// paste or a picture to share.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

maybe('one line per meeting, no amendment note, and the export says exactly what the screen lists', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, mobile: true });
  try {
    const r = await app.run(() => {
      // The pair who met most often, so there is plenty to list.
      const names = PLAYERS.map((p) => p.name);
      let best = null;
      names.forEach((a) => names.forEach((b) => { if (a < b) { const n = h2hOpponentMatches(a, b).length; if (!best || n > best.n) best = { a, b, n }; } }));
      isUnlocked = true;
      document.querySelector('#tabrow .tab-btn[data-tab="h2h"]').click();
      h2hPlayerA = best.a; h2hPlayerB = best.b; h2hMonth = 'all'; renderH2H();
      const view = document.getElementById('h2hView');
      const rows = [...view.querySelectorAll('.h2h-list')[0].querySelectorAll('.h2h-row')];
      const opp = h2hOpponentMatches(best.a, best.b).sort((x, y) => x.date < y.date ? 1 : -1);
      const team = h2hTeammateMatches(best.a, best.b).sort((x, y) => x.date < y.date ? 1 : -1);
      const pic = h2hExportView(opp, team, false);
      return {
        best, rows: rows.length, rowHeight: rows[0].getBoundingClientRect().height,
        amend: /To correct or remove this game/.test(view.textContent),
        buttons: [!!document.getElementById('h2hCopy'), !!document.getElementById('h2hPicture')],
        text: h2hExportText(opp, team, false),
        sheetRows: pic.rows.length, tones: pic.rows.map((x) => x.tone),
        tally: MatchOutcome.tally(opp, best.a),
        firstTeams: h2hOpponentRow(opp[0], best.a, best.b).teams,
      };
    });
    assert.ok(r.best.n >= 3);
    assert.strictEqual(r.rows, r.best.n, 'every meeting, one row each');
    assert.ok(r.rowHeight < 60, `a row is compact (${r.rowHeight}px)`);
    assert.strictEqual(r.amend, false, 'no amendment line, even for an Admin');
    assert.deepStrictEqual(r.buttons, [true, true]);
    assert.match(r.text, new RegExp(`As opponents: ${r.best.a} ${r.tally.wins} – ${r.tally.losses} ${r.best.b}`));
    assert.strictEqual(r.text.split('\n').filter((l) => / · (\w+ won|Drew) · /.test(l)).length, r.best.n, 'the text lists every meeting');
    assert.ok(r.text.includes(r.firstTeams));
    assert.strictEqual(r.sheetRows, r.best.n, 'and so does the picture');
    // Drawn as the screen is: each result in its colour (Shaun, 2 Nov).
    assert.ok(r.tones.every((t) => ['win', 'loss', 'draw'].includes(t)) && r.tones.includes('win') && r.tones.includes('loss'));
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('the pictures are drawn in the app\'s look, sized to their rows: a pair and a player against everyone', async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      const names = PLAYERS.map((p) => p.name);
      let best = null;
      names.forEach((a) => names.forEach((b) => { if (a < b) { const n = h2hOpponentMatches(a, b).length; if (!best || n > best.n) best = { a, b, n }; } }));
      h2hPlayerA = best.a; h2hPlayerB = best.b; h2hMonth = 'all';
      const opp = h2hOpponentMatches(best.a, best.b);
      const pair = CardPainter.headToHead(h2hExportView(opp, h2hTeammateMatches(best.a, best.b), false), {});
      h2hPlayerB = H2H_EVERYONE;
      const d = h2hEveryoneData();
      const all = CardPainter.headToHeadAll(h2hEveryoneView(d), {});
      const opponents = d.groups.reduce((n, g) => n + g.opponents.length, 0);
      return { n: best.n, pair: [pair.width, pair.height], all: [all.width, all.height], opponents };
    });
    assert.strictEqual(r.pair[0], 1080);
    assert.ok(r.pair[1] > 600 + r.n * 100, `tall enough for ${r.n} meetings (${r.pair[1]}px)`);
    assert.strictEqual(r.all[0], 1080);
    assert.ok(r.all[1] > 500 + r.opponents * 70, `tall enough for ${r.opponents} opponents (${r.all[1]}px)`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
