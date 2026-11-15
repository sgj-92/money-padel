// ===================== PREDICT A MATCHUP: FOUR PLAYERS, UP TO FIVE MATCHES =====================
// Shaun, 10 Oct: no prediction until all four players are chosen; no player
// twice in a match; up to five predictions at once, shared as one condensed
// card built from the same predictions; and no iPhone zoom on focusing a
// field (every editable control at least 16px on a phone).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./helpers/uiHarness.js');
const PB = require('../assets/js/domain/predictions/predictionBatch.js');
const MC = require('../assets/js/domain/predictions/matchupCard.js');
const MP = require('../assets/js/matchPrediction.js');

const maybe = H.available() ? test : test.skip;

const RATING = { Ann: 1500, Bob: 1400, Cat: 1300, Dan: 1250, Eve: 1450, Fay: 1350, Gus: 1200, Hal: 1100 };
const canonical = (n) => Object.keys(RATING).find((k) => k.toLowerCase() === String(n).trim().toLowerCase()) || null;
const predict = (a, b) => MP.build(a, b, (n) => RATING[n]);
const ev = (m) => PB.evaluate(m, { canonical, predict });

test('nothing is predicted until all four players are chosen', () => {
  for (const m of [{}, { a1: 'Ann' }, { a1: 'Ann', a2: 'Bob' }, { a1: 'Ann', a2: 'Bob', b1: 'Cat' }, { a1: 'Ann', b1: 'Cat', b2: 'Dan' }]) {
    const e = ev(m);
    assert.strictEqual(e.ok, false);
    assert.strictEqual(e.prediction, undefined, `a partial match must not be predicted: ${JSON.stringify(m)}`);
    assert.strictEqual(e.prompt, 'Select 4 players to generate a prediction');
  }
  const e = ev({ a1: 'ann', a2: 'Bob ', b1: 'Cat', b2: 'Dan' });
  assert.strictEqual(e.ok, true);
  assert.deepStrictEqual(e.prediction, predict(['Ann', 'Bob'], ['Cat', 'Dan']), 'the existing prediction, untouched');
});

test('the same player cannot be in a match twice, on either side, in any case', () => {
  const same = ev({ a1: 'Ann', a2: 'ann', b1: 'Cat', b2: 'Dan' });
  assert.strictEqual(same.ok, false);
  assert.strictEqual(same.slots.a2.state, 'duplicate');
  assert.match(same.reason, /only be in a match once/);
  const across = ev({ a1: 'Ann', a2: 'Bob', b1: 'Cat', b2: 'Bob' });
  assert.strictEqual(across.slots.b2.state, 'duplicate');
  assert.strictEqual(across.prediction, undefined);
  // Even before the match is complete.
  assert.strictEqual(ev({ a1: 'Ann', b1: 'Ann' }).slots.b1.state, 'duplicate');
  assert.deepStrictEqual(PB.taken({ a1: 'Ann', a2: 'bob', b1: 'Zed' }, 'b2', canonical), ['Ann', 'Bob']);
});

test('a name that is not a club player is named, not guessed', () => {
  const e = ev({ a1: 'Ann', a2: 'Bob', b1: 'Cat', b2: 'Zed' });
  assert.strictEqual(e.ok, false);
  assert.match(e.reason, /Not a club player: Zed/);
});

test('a batch holds one to five matches; another only once all are complete; removal closes up', () => {
  const full = { a1: 'Ann', a2: 'Bob', b1: 'Cat', b2: 'Dan' };
  let ms = [full];
  assert.strictEqual(PB.canAdd(ms.map(ev)), true);
  ms = PB.add(ms);
  assert.strictEqual(PB.canAdd(ms.map(ev)), false, 'not while a match is empty');
  ms = [full, full, full, full, full];
  assert.strictEqual(PB.canAdd(ms.map(ev)), false, 'five is the maximum');
  assert.strictEqual(PB.add(ms).length, 5);
  const named = [1, 2, 3].map((k) => ({ ...full, a1: ['Ann', 'Eve', 'Fay'][k - 1] }));
  assert.deepStrictEqual(PB.remove(named, 1).map((m) => m.a1), ['Ann', 'Fay']);
  assert.deepStrictEqual(PB.remove([full], 0), [PB.empty()], 'never left with nothing to fill in');
});

test('the condensed card is the single cards, numbered -- the same teams, tiers and shares', () => {
  const tierOf = (n) => (RATING[n] >= 1400 ? 'A' : 'B');
  const preds = [predict(['Ann', 'Bob'], ['Cat', 'Dan']), predict(['Eve', 'Hal'], ['Fay', 'Gus'])];
  const cards = preds.map((p) => MC.build(p, { tierOf }));
  const v = MC.buildMany(cards);
  assert.strictEqual(v.title, 'Match predictions');
  assert.deepStrictEqual(v.matches.map((m) => m.n), [1, 2]);
  v.matches.forEach((m, i) => {
    assert.deepStrictEqual(m.teamA, cards[i].teamA);
    assert.deepStrictEqual(m.teamB, cards[i].teamB);
    assert.deepStrictEqual(m.share, { a: preds[i].shareA, b: preds[i].shareB });
  });
  assert.strictEqual(MC.buildMany(Array(7).fill(cards[0])).matches.length, 5, 'never more than five');
  const text = MC.summaryTextMany(v);
  assert.match(text, /^🎾 Match predictions\n\n1\. Ann & Bob vs Cat & Dan\n\d+% – \d+%/);
  assert.match(text, /\n2\. Eve & Hal vs Fay & Gus\n/);
  assert.doesNotMatch(text, /chance|probab/i);
});

// ---- In the app, at phone size ----------------------------------------------

async function openPredict(width) {
  const app = await H.open({ viewport: { width: width || 390, height: 844 }, mobile: true });
  const names = await app.run(() => { isUnlocked = true; adminRole = 'owner'; openPredictMatchup();
    return PLAYERS.filter((p) => typeof p.rating === 'number').slice(0, 20).map((p) => p.name); });
  return { app, names };
}
const fill4 = async (page, g) => { await page.fill('#predA1', g[0]); await page.fill('#predA2', g[1]); await page.fill('#predB1', g[2]); await page.fill('#predB2', g[3]); };
const screen = (app) => app.run(() => ({
  card: !!document.getElementById('matchupCard'),
  pcts: [...document.querySelectorAll('#predictModal .mu-games-num')].map((e) => e.textContent),
  prompt: (document.querySelector('#predictModal .pred-prompt') || {}).textContent || null,
  add: !!document.getElementById('predAddBtn'),
}));

maybe('the card appears with the fourth player, never before; a repeated player stops it', async () => {
  const { app, names } = await openPredict();
  try {
    const p = app.page;
    await p.fill('#predA1', names[0]); await p.fill('#predA2', names[1]); await p.fill('#predB1', names[2]);
    let s = await screen(app);
    assert.strictEqual(s.card, false, 'no card with three players');
    assert.deepStrictEqual(s.pcts, [], 'no percentages with three players');
    assert.strictEqual(s.prompt, 'Select 4 players to generate a prediction');
    assert.strictEqual(s.add, false);
    // The names chosen are not offered again.
    const offered = await app.run(() => [...document.querySelectorAll('#predNamesList option')].map((o) => o.value));
    assert.ok(!offered.includes(names[0]) && !offered.includes(names[2]));
    await p.fill('#predB2', names[1]);
    s = await screen(app);
    assert.strictEqual(s.card, false, 'no card with a player in two places');
    assert.match(await app.run(() => document.querySelector('[data-slot-note="b2"]').textContent), /already in this match/);
    await p.fill('#predB2', names[3]);
    s = await screen(app);
    assert.strictEqual(s.card, true, 'the card appears as soon as the fourth player is in');
    const pred = await app.run((n) => { const x = predictMatchup([n[0], n[1]], [n[2], n[3]]); return [x.shareA, x.shareB]; }, names);
    assert.deepStrictEqual(s.pcts, [`${pred[0]}%`, `${pred[1]}%`], 'the existing prediction, as it was');
    assert.strictEqual(s.add, true, 'and another can be added');
    assert.ok(await app.run(() => !!document.getElementById('predUpAdd')), 'one prediction still offers Add to Upcoming');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('five predictions at most, removable and editable, shared as ONE condensed card', async () => {
  const { app, names } = await openPredict(360);
  try {
    const p = app.page;
    await fill4(p, names.slice(0, 4));
    for (let k = 1; k < 5; k++) { await p.click('#predAddBtn'); await fill4(p, names.slice(4 * k, 4 * k + 4)); }
    let r = await app.run(() => ({
      add: !!document.getElementById('predAddBtn'), max: (document.querySelector('#predAdd') || {}).textContent,
      rows: [...document.querySelectorAll('#matchupsCard .mu-row')].map((row) => ({
        n: row.querySelector('.mu-row-n').textContent,
        teams: [...row.querySelectorAll('.mu-row-team')].map((t) => [...t.querySelectorAll('.mu-name')].map((e) => e.textContent)),
        tiers: row.querySelectorAll('.mu-tier').length,
        pcts: [...row.querySelectorAll('.mu-row-pct')].map((e) => e.textContent) })),
      overflow: (() => { const el = document.querySelector('#predictModal .shell-more-panel'); return el.scrollWidth - el.clientWidth; })(),
      share: document.getElementById('predShare').textContent,
    }));
    assert.strictEqual(r.add, false, 'no sixth');
    assert.match(r.max, /maximum of 5/);
    assert.strictEqual(r.rows.length, 5);
    for (let k = 0; k < 5; k++) {
      const g = names.slice(4 * k, 4 * k + 4);
      const pred = await app.run((g) => { const x = predictMatchup([g[0], g[1]], [g[2], g[3]]); return [`${x.shareA}%`, `${x.shareB}%`]; }, g);
      assert.deepStrictEqual(r.rows[k], { n: String(k + 1), teams: [[g[0], g[1]], [g[2], g[3]]], tiers: 4, pcts: pred });
    }
    assert.ok(r.overflow <= 0, 'the five-match card fits a phone');
    assert.strictEqual(r.share, 'Share predictions');

    // One picture for all five.
    const shared = await app.run(async () => {
      const calls = []; const real = CardPainter.share;
      CardPainter.share = async (files, meta) => { calls.push({ files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })), meta }); return 'shared'; };
      try { document.getElementById('predShare').click(); for (let k = 0; k < 200 && !calls.length; k++) await new Promise((res) => setTimeout(res, 20)); }
      finally { CardPainter.share = real; }
      const s = predictShareSubject();
      const cv = CardPainter.matchups(MatchupCard.buildMany(s.preds.map(matchupCardFor)), {});
      return { calls, size: [cv.width, cv.height] };
    });
    assert.strictEqual(shared.calls.length, 1);
    assert.strictEqual(shared.calls[0].files.length, 1, 'one card, not one per match');
    assert.strictEqual(shared.calls[0].files[0].name, 'money-padel-predictions-5-matches.png');
    assert.match(shared.calls[0].meta.text, /^🎾 Match predictions\n\n1\. /);
    assert.match(shared.calls[0].meta.text, /\n5\. /);
    assert.strictEqual(shared.size[0], 1080);

    // Remove the second: the rest close up and renumber, and another may be added.
    await p.click('[data-pred-remove="1"]');
    r = await app.run(() => ({ n: [...document.querySelectorAll('.pred-fold-n')].map((e) => e.textContent),
      card: [...document.querySelectorAll('#matchupsCard .mu-row-n')].map((e) => e.textContent),
      first: [...document.querySelectorAll('#matchupsCard .mu-row')][1].querySelector('.mu-name').textContent,
      add: !!document.getElementById('predAddBtn') }));
    assert.deepStrictEqual(r.n, ['1', '2', '3', '4']);
    assert.deepStrictEqual(r.card, ['1', '2', '3', '4']);
    assert.strictEqual(r.first, names[8], 'the old third match is now second');
    assert.strictEqual(r.add, true);

    // Edit one: its players come back to be changed, and the card follows.
    await p.click('[data-pred-edit="0"]');
    assert.strictEqual(await p.inputValue('#predA1'), names[0]);
    await p.fill('#predA1', names[19]);
    const edited = await app.run(() => [...document.querySelectorAll('#matchupsCard .mu-row')][0].querySelector('.mu-name').textContent);
    assert.strictEqual(edited, names[19]);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// ---- iPhone focus zoom ---------------------------------------------------------

test('zoom is never disabled: the viewport sets no maximum scale and allows scaling', () => {
  for (const f of ['index.html', 'review/index.html']) {
    const meta = (fs.readFileSync(path.join(__dirname, '..', f), 'utf8').match(/<meta name="viewport"[^>]*>/) || [''])[0];
    assert.ok(meta, f);
    assert.doesNotMatch(meta, /maximum-scale|user-scalable/i, `${f} must not restrict pinch-zoom`);
  }
});

maybe('on a phone every editable control is at least 16px, so iOS Safari has no reason to zoom', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, mobile: true });
  try {
    const small = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner';
      const out = [];
      const check = (where) => document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=file]):not([type=button]), select, textarea')
        .forEach((e) => { const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 16) out.push(`${where}: ${e.id || e.className || e.tagName} ${fs}px`); });
      for (const b of document.querySelectorAll('#tabrow .tab-btn')) { b.click(); await new Promise((r) => setTimeout(r, 100)); check(b.dataset.tab); }
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click(); gamesFiltersOpen = true; renderGamesTab(); check('games filters');
      openPredictMatchup(); check('predict');
      return out;
    });
    assert.deepStrictEqual(small, []);
  } finally { await app.close(); }
});

// Shaun, 15 Nov: "players will ask me for 3-4 games at a time" -- paste them
// in at once, open each as a quick card, share all as one picture.
maybe('several games pasted at once: read as written, each opens as a quick card, all share as one picture', async () => {
  const { app, names } = await openPredict(390);
  try {
    const p = app.page;
    const g = names.slice(0, 16);
    const text = [
      `${g[0]} & ${g[1]} vs ${g[2]} & ${g[3]}`,
      `${g[4].toLowerCase()}/${g[5]} v ${g[6]}/${g[7]}`,
      `- ${g[8]} and ${g[9]} vs ${g[10]} + ${g[11]}`,
      `${g[12]} & ${g[13]} against ${g[14]} & ${g[15]}`,
      'see you all at 7',
    ].join('\n');
    await p.click('.pred-paste summary');
    await p.fill('#predPaste', text);
    await p.click('#predPasteGo');
    const r = await app.run(() => ({
      folds: [...document.querySelectorAll('#predictModal .pred-fold')].length,
      editors: document.querySelectorAll('#predictModal .pred-editor').length,
      rows: [...document.querySelectorAll('#matchupsCard .mu-row')].map((row) => [...row.querySelectorAll('.mu-name')].map((e) => e.textContent)),
      msg: document.querySelector('.pred-paste').innerText,
    }));
    assert.deepStrictEqual([r.folds, r.editors], [4, 0], 'four quick cards, none open for editing');
    assert.deepStrictEqual(r.rows, [0, 1, 2, 3].map((k) => g.slice(4 * k, 4 * k + 4)), 'read as written, names matched whatever the case');
    assert.match(r.msg, /Read 4 games\. Tap one to open its card\./);
    assert.match(r.msg, /Line 5: No "vs" found/);
    // Open the third: its full card, with the percentages of that match.
    await p.click('[data-pred-view="2"]');
    const opened = await app.run((gg) => {
      const card = document.querySelector('.pred-quick-card #matchupCard, .pred-quick-card .mu-card');
      const pred = predictMatchup([gg[8], gg[9]], [gg[10], gg[11]]);
      return { card: !!card, nums: [...document.querySelectorAll('.pred-quick-card .mu-games-num')].map((e) => e.textContent), want: [`${pred.shareA}%`, `${pred.shareB}%`],
        open: document.querySelectorAll('.pred-quick-card').length };
    }, g);
    assert.ok(opened.card);
    assert.strictEqual(opened.open, 1);
    assert.deepStrictEqual(opened.nums, opened.want);
    await p.click('[data-pred-view="2"]');
    assert.strictEqual(await app.run(() => document.querySelectorAll('.pred-quick-card').length), 0, 'tap again to close');
    const shared = await app.run(async () => {
      const calls = []; CardPainter.share = async (files) => { calls.push(files.map((f) => f.name)); return 'shared'; };
      document.getElementById('predShare').click();
      for (let k = 0; k < 200 && !calls.length; k++) await new Promise((res) => setTimeout(res, 20));
      return calls;
    });
    assert.deepStrictEqual(shared, [['money-padel-predictions-4-matches.png']], 'one picture for all four');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
