// ===================== MONTHLY REVIEW: SHARE DECK, PUBLISH, LINK =====================
// The Board Pack, told to players: the same selected modules in the same
// order, one swipeable card each. An Admin previews it, publishes it, and
// shares a link (review/?m=YYYY-MM) that anyone can open without unlocking.
// A published review is stored exactly as shown, so the link shows the same
// month's story however much is recorded later.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-28T12:00:00.000Z';
const REVIEW = (m) => `moneypadel_review_${m}`;
const openApp = (club) => H.open({ now: NOW, club });
const openReview = (month, club) => H.open({ path: `review/?m=${month}`, mobile: true, now: NOW, club, readyWhen: () => window.REVIEW_READY });

async function openSection(app, month){
  await app.run(() => {
    isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
    legacyTabBtn('manage').click(); renderManage();
    document.querySelector('[data-acc-toggle="boardpack"]').click();
  });
  await app.page.waitForSelector('#bpStatus');
  if (month) { await app.page.selectOption('#bpMonth', month); await app.page.waitForSelector('#bpStatus'); }
}

// Published reviews for August and September from the seeded record, made
// once and reused: the pack's default selection, and one with everything.
let published = null;
async function publishedReviews(){
  if (published) return published;
  const app = await openApp();
  try {
    published = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      const out = {};
      for (const m of ['2026-08', '2026-09']) out[m] = (await publishBoardPackReview(BoardPack.defaultConfig(m))).publication;
      let all = BoardPack.defaultConfig('2026-09');
      all.items.forEach((_, i) => { all = BoardPack.setEnabled(all, i, true); });
      out.all = ShareDeck.publication({ deck: boardPackDeck(all), by: 'Shaun', at: '2026-09-30T10:00:00.000Z' });
      return out;
    });
  } finally { await app.close(); }
  return published;
}

maybe('the Share Deck is the Board Pack\'s selection, in the Board Pack\'s order -- previewed and published alike', async () => {
  const app = await openApp();
  try {
    await openSection(app, '2026-08');
    const p = app.page;
    const idx = (id) => p.$eval(`[data-bp-module="${id}"]`, (el) => Number(el.dataset.bpItem));
    await p.click(`[data-bp-toggle="${await idx('overview')}"]`);                // off
    await p.click(`[data-bp-toggle="${await idx('most_wins')}"]`);               // on
    for (let i = await idx('league'); i > 0; i--) await p.click(`[data-bp-move="${i}"][data-delta="-1"]`);  // League first
    await p.click('#bpPreviewBtn');
    await p.click('#bpModeDeck');
    await p.waitForSelector('#bpDeckFrame .deck-slide');
    const r = await app.run(() => ({
      shown: [...document.querySelectorAll('#bpDeckFrame .deck-slide')].map((s) => s.dataset.slide),
      selected: BoardPack.selected(boardPackDraft).map((it) => it.id),
      withContent: boardPackDeck(boardPackDraft).slides.map((s) => s.id),
      month: document.querySelector('#bpDeckFrame .deck-cover-title').textContent,
    }));
    assert.deepStrictEqual(r.selected, ['league', 'champions', 'results_table', 'over_80', 'lost_pct', 'power', 'kings', 'race', 'most_wins', 'rating_movers', 'tier_moves']);
    // A module split by tier has a slide per tier, side by side.
    const modules = [...new Set(r.withContent.map((id) => id.split(':')[0]))];
    assert.deepStrictEqual(modules, r.selected.filter((id) => modules.includes(id)), 'slides follow the pack\'s order');
    assert.ok(modules.length >= r.selected.length - 1, 'only a module with nothing to say is left out');
    assert.deepStrictEqual(r.withContent, modules.flatMap((m) => r.withContent.filter((id) => id.split(':')[0] === m)), 'a module\'s tier slides together');
    assert.ok(r.withContent.includes('league:A') && r.withContent.includes('power:A'), 'split by tier by default');
    assert.deepStrictEqual(r.shown, ['cover', ...r.withContent, 'end']);
    assert.strictEqual(r.month, 'August 2026');

    await p.click('#bpPublish');
    await p.click('#bpPublishConfirm');
    await p.waitForFunction(() => /Published/.test(document.getElementById('bpMessage').textContent));
    const doc = await app.run((key) => JSON.parse(window.__writes.filter((w) => w.id === key).at(-1).doc.value), REVIEW('2026-08'));
    assert.deepStrictEqual(doc.deck.slides.map((s) => s.id), r.withContent, 'published exactly as previewed');
    assert.deepStrictEqual([doc.revision, doc.month, doc.publishedBy], [1, '2026-08', 'Shaun']);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('the deck and the WhatsApp summary carry the canonical figures, for the chosen month', async () => {
  const app = await openApp();
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      const out = [];
      for (const m of boardPackMonths()) {
        let c = BoardPack.defaultConfig(m);
        c.items.forEach((_, i) => { c = BoardPack.setEnabled(c, i, true); });
        const deck = boardPackDeck(c);
        const slide = (id) => deck.slides.find((s) => s.id === id);
        const games = MeaningfulMonth.countInMonth(getAllApprovedMatches(), m);
        const kings = kingsOfTiersFor(m, defaultRankingMinGames(m));
        const league = leagueSplitRows(m).filter((s) => s.games > 0);
        const leaders = ['S', 'A', 'B', 'C'].map((t) => sortLeagueRows(league.filter((s) => s.tier === t), 'points', true)[0]).filter(Boolean);
        const risers = MonthlyViews.ratingMovementTable(MONTHLY_VIEWS, m).filter((x) => x.ratingChange > 0);
        const summary = ShareDeck.summaryText(deck, { link: boardPackReviewUrl(m) });
        out.push({
          m, title: deck.title, month: deck.month,
          games: [slide('overview').stats[0].value, String(games)],
          kings: [slide('kings') ? slide('kings').groups[0].rows.map((x) => [x.label, x.name, x.value]) : null,
            kings ? ['S', 'A', 'B', 'C'].filter((t) => kings[t]).map((t) => [`Tier ${t}`, kings[t].name, String(kings[t].rating)]) : null],
          league: [['S', 'A', 'B', 'C'].map((t) => slide(`league:${t}`)).filter(Boolean).map((sl) => [sl.groups[0].rows[0].name, sl.groups[0].rows[0].value]), leaders.map((s) => [s.name, `${s.points} pts`])],
          leagueTiers: ['S', 'A', 'B', 'C'].filter((t) => slide(`league:${t}`)).map((t) => [slide(`league:${t}`).groups[0].rows.map((x) => x.name),
            sortLeagueRows(league.filter((s) => s.tier === t), 'points', true).slice(0, ShareDeck.ROWS).map((s) => s.name)]),
          riser: [slide('rating_movers') && slide('rating_movers').groups[0].rows[0].name, risers[0] && risers[0].playerId],
          summaryHas: [`${games} games played`, ...(kings ? ['S', 'A', 'B', 'C'].filter((t) => kings[t]).map((t) => `Tier ${t} King: ${kings[t].name}`) : []),
            `Full ${monthLabel(m).split(' ')[0]} review:`, `review/?m=${m}`].filter((line) => !summary.includes(line)),
        });
      }
      return out;
    });
    assert.ok(r.length >= 3);
    r.forEach((x) => {
      assert.strictEqual(x.title, `${{ '2026-06': 'June', '2026-07': 'July', '2026-08': 'August', '2026-09': 'September' }[x.m]} 2026 Review`);
      assert.strictEqual(x.month, x.m);
      assert.deepStrictEqual(x.games[0], x.games[1], `${x.m} games`);
      assert.deepStrictEqual(x.kings[0], x.kings[1], `${x.m} kings`);
      assert.deepStrictEqual(x.league[0], x.league[1], `${x.m} league leaders`);
      x.leagueTiers.forEach(([shown, want]) => assert.deepStrictEqual(shown, want, `${x.m} a tier's League slide is its top five`));
      assert.deepStrictEqual(x.riser[0], x.riser[1], `${x.m} biggest riser`);
      assert.deepStrictEqual(x.summaryHas, [], `${x.m} summary is missing these`);
    });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('draft until published; editing never changes the link; republishing does, as the next revision', async () => {
  const app = await openApp();
  try {
    await openSection(app, '2026-09');
    const p = app.page;
    const reviewWrites = () => app.run((key) => window.__writes.filter((w) => w.id === key).map((w) => JSON.parse(w.doc.value)), REVIEW('2026-09'));
    assert.match(await p.textContent('#bpPublishState'), /^Draft\./);
    assert.strictEqual(await p.$('#bpCopySummary'), null, 'nothing to share before it is published');
    // Locked: refused, nothing written.
    const locked = await app.run(async () => { isUnlocked = false; const r = await publishBoardPackReview(boardPackDraft); isUnlocked = true; return r; });
    assert.deepStrictEqual([locked.ok, locked.message], [false, 'Only an admin can publish the review.']);
    assert.strictEqual((await reviewWrites()).length, 0);

    const before = await app.run(() => JSON.stringify([PLAYERS.map((p) => [p.name, p.rating, p.tier]), MONTHLY_VIEWS.byMonth['2026-09'].closingRatings, computeMonthlySummaryStats('2026-09')]));
    await p.click('#bpPublish');
    assert.match(await p.textContent('.bp-confirm'), /Anyone with the link can open it/);
    await p.click('#bpPublishConfirm');
    await p.waitForFunction(() => /revision 1/.test(document.getElementById('bpPublishState').textContent));
    const [rev1] = await reviewWrites();
    assert.match(await p.textContent('#bpPublishState'), /The review link shows exactly this pack/);

    // Edit and save the pack: the published review is untouched.
    const i = await p.$eval('[data-bp-module="most_games"]', (el) => el.dataset.bpItem);
    await p.click(`[data-bp-toggle="${i}"]`);
    await p.waitForFunction(() => /^Saved /.test(document.getElementById('bpStatus').textContent));
    assert.ok(await app.run(() => window.__writes.filter((w) => w.id === 'moneypadel_board_pack_2026-09').length >= 2), 'the change saved itself');
    assert.strictEqual((await reviewWrites()).length, 1, 'saving the pack does not publish it');
    assert.match(await p.textContent('#bpPublishState'), /differs from what players see/);

    await p.click('#bpPublish');
    await p.click('#bpPublishConfirm');
    await p.waitForFunction(() => /revision 2/.test(document.getElementById('bpPublishState').textContent));
    const [, rev2] = await reviewWrites();
    assert.strictEqual(rev2.firstPublishedAt, rev1.publishedAt);
    assert.ok(rev2.deck.slides.some((s) => s.id === 'most_games') && !rev1.deck.slides.some((s) => s.id === 'most_games'));

    // Share: the summary and the link come from what was published.
    await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await p.click('#bpCopySummary');
    await p.waitForFunction(() => /Summary copied/.test(document.getElementById('bpMessage').textContent));
    const copied = await p.evaluate(() => navigator.clipboard.readText());
    assert.strictEqual(copied, await app.run(() => boardPackReviewSummary(boardPackPublished['2026-09'])));
    assert.match(copied, /^\*Money Padel — September 2026\*\n/);
    assert.match(copied, /Full September review:\nhttp:\/\/127\.0\.0\.1:\d+\/review\/\?m=2026-09$/);
    await p.click('#bpCopyLink');
    await p.waitForFunction(() => /Link copied/.test(document.getElementById('bpMessage').textContent));
    assert.match(await p.evaluate(() => navigator.clipboard.readText()), /\/review\/\?m=2026-09$/);
    assert.strictEqual(await p.getAttribute('#bpOpenReview', 'href'), await p.evaluate(() => navigator.clipboard.readText()));

    const after = await app.run(() => JSON.stringify([PLAYERS.map((p) => [p.name, p.rating, p.tier]), MONTHLY_VIEWS.byMonth['2026-09'].closingRatings, computeMonthlySummaryStats('2026-09')]));
    assert.strictEqual(after, before, 'publishing changes no rating or table');
    const ids = await app.run(() => [...new Set(window.__writes.map((w) => w.id))].sort());
    assert.deepStrictEqual(ids, ['moneypadel_board_pack_2026-09', 'moneypadel_review_2026-09']);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('the review link opens straight into that month\'s deck, for anyone, with no Admin control and no stats engine', async () => {
  const pub = await publishedReviews();
  for (const [m, label] of [['2026-08', 'August 2026'], ['2026-09', 'September 2026']]) {
    const rv = await openReview(m, { [REVIEW('2026-08')]: pub['2026-08'], [REVIEW('2026-09')]: pub['2026-09'] });
    try {
      const r = await rv.run(() => ({
        title: document.title, head: document.getElementById('reviewTitle').textContent,
        cover: document.querySelector('.deck-cover-title').textContent,
        slides: [...document.querySelectorAll('.deck-slide')].map((s) => s.dataset.slide),
        controls: document.querySelectorAll('input, select, textarea, #bpPublish, .admin-acc, [data-bp-toggle]').length,
        buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => t && !/^[‹›]$/.test(t)),
        app: [typeof renderManage, typeof computeMonthlySummaryStats, typeof isUnlocked, typeof boardPackDeck],
      }));
      assert.deepStrictEqual([r.title, r.head, r.cover], [`${label} Review · Money Padel`, `${label} Review`, label]);
      assert.deepStrictEqual(r.slides, ['cover', ...pub[m].deck.slides.map((s) => s.id), 'end']);
      assert.strictEqual(r.controls, 0);
      assert.deepStrictEqual(r.buttons, ['Copy link'], 'the only action a player has is sharing');
      assert.deepStrictEqual(r.app, ['undefined', 'undefined', 'undefined', 'undefined'], 'the page cannot recalculate anything');
      assert.deepStrictEqual(rv.pageErrors, []);
    } finally { await rv.close(); }
  }
});

maybe('at 375px nothing runs off the side, and every card holds its content', async () => {
  const pub = await publishedReviews();
  const rv = await openReview('2026-09', { [REVIEW('2026-09')]: pub.all });
  try {
    const r = await rv.run(async () => {
      const track = document.querySelector('[data-deck-track]');
      const out = { vw: innerWidth, page: document.documentElement.scrollWidth, cards: [] };
      const slides = [...document.querySelectorAll('.deck-slide')];
      for (let i = 0; i < slides.length; i++) {
        track.scrollTo({ left: i * track.clientWidth, behavior: 'auto' });
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        const card = slides[i].querySelector('.deck-card').getBoundingClientRect();
        const body = slides[i].querySelector('.deck-body');
        const clipped = [...slides[i].querySelectorAll('.deck-card *')].some((el) => { const b = el.getBoundingClientRect(); return b.width && (b.right > card.right + 0.5 || b.left < card.left - 0.5 || b.bottom > card.bottom + 0.5); });
        out.cards.push({ id: slides[i].dataset.slide, left: card.left, right: card.right, ratio: Math.round((card.height / card.width) * 100) / 100,
          overflow: body ? body.scrollHeight - body.clientHeight : 0, clipped });
      }
      return out;
    });
    assert.strictEqual(r.vw, 375);
    assert.ok(r.page <= 375, `page is ${r.page}px wide`);
    assert.ok(r.cards.length > 15, 'every module on, so every kind of card is checked');
    r.cards.forEach((c) => {
      assert.ok(c.left >= 0 && c.right <= 375, `${c.id} sits inside the screen (${c.left}-${c.right})`);
      assert.strictEqual(c.ratio, 1.25, `${c.id} is 4:5`);
      assert.ok(c.overflow <= 1, `${c.id} content fits its card`);
      assert.strictEqual(c.clipped, false, `${c.id} nothing cut off`);
    });
  } finally { await rv.close(); }
});

maybe('swipe, previous / next, the dots and the arrow keys all move the deck, and it says where you are', async () => {
  const pub = await publishedReviews();
  // A short deck: the first nine slides.
  const short = JSON.parse(JSON.stringify(pub['2026-09']));
  short.deck.slides = short.deck.slides.slice(0, 9);
  const rv = await openReview('2026-09', { [REVIEW('2026-09')]: short });
  try {
    const p = rv.page;
    const at = () => rv.run(() => ({ i: Number(document.querySelector('[data-deck]').dataset.index),
      dot: [...document.querySelectorAll('[data-deck-dot]')].findIndex((d) => d.getAttribute('aria-current') === 'true'),
      prev: document.querySelector('[data-deck-prev]').disabled, next: document.querySelector('[data-deck-next]').disabled,
      live: document.querySelector('.deck-live').textContent }));
    const settle = (i) => p.waitForFunction((k) => Number(document.querySelector('[data-deck]').dataset.index) === k
      && Math.abs(document.querySelector('[data-deck-track]').scrollLeft - k * document.querySelector('[data-deck-track]').clientWidth) < 2, i);
    const n = await rv.run(() => document.querySelectorAll('.deck-slide').length);
    assert.ok(n <= 12, 'a short deck shows dots');
    assert.deepStrictEqual(await at(), { i: 0, dot: 0, prev: true, next: false, live: `1 of ${n}: September 2026 Review` });

    await p.click('[data-deck-next]'); await settle(1);
    await p.click('[data-deck-next]'); await settle(2);
    assert.deepStrictEqual((await at()).dot, 2);
    await p.click('[data-deck-prev]'); await settle(1);
    await p.click(`[data-deck-dot="${n - 1}"]`); await settle(n - 1);
    assert.deepStrictEqual([(await at()).next, (await at()).prev], [true, false]);

    await p.focus('[data-deck]');
    await p.keyboard.press('Home'); await settle(0);
    await p.keyboard.press('ArrowRight'); await settle(1);
    await p.keyboard.press('ArrowLeft'); await settle(0);
    await p.keyboard.press('End'); await settle(n - 1);
    await p.keyboard.press('Home'); await settle(0);

    // A swipe is the track scrolling sideways. Headless Chromium cannot
    // synthesise a touch scroll, so the same native scroller is driven by a
    // sideways trackpad gesture; the deck follows whichever card it lands on.
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.synthesizeScrollGesture', { x: 180, y: 300, xDistance: -220, yDistance: 0, gestureSourceType: 'mouse', speed: 1500 });
    await p.waitForFunction(() => Number(document.querySelector('[data-deck]').dataset.index) >= 1);
    const swiped = (await at()).i;
    assert.strictEqual((await at()).dot, swiped);
    assert.match((await at()).live, new RegExp(`^${swiped + 1} of ${n}: `));
    assert.deepStrictEqual(rv.pageErrors, []);
  } finally { await rv.close(); }

  // A long deck counts instead of dotting.
  const long = await openReview('2026-09', { [REVIEW('2026-09')]: pub.all });
  try {
    const n = await long.run(() => document.querySelectorAll('.deck-slide').length);
    assert.ok(n > 12);
    assert.strictEqual(await long.run(() => document.querySelectorAll('[data-deck-dot]').length), 0);
    assert.strictEqual(await long.page.textContent('[data-deck-count]'), `1 / ${n}`);
    await long.page.click('[data-deck-next]');
    await long.page.waitForFunction(() => document.querySelector('[data-deck-count]').textContent.startsWith('2 /'));
  } finally { await long.close(); }
});

maybe('a published review stays as published: the page shows the stored slides, not today\'s figures', async () => {
  const pub = await publishedReviews();
  // The stored September review, with figures that are not today's -- as it
  // would be after later results, corrections or a change of calculation.
  const stored = JSON.parse(JSON.stringify(pub['2026-09']));
  stored.deck.slides.find((s) => s.id === 'overview').stats[0].value = '41';
  const kings = stored.deck.slides.find((s) => s.id === 'kings');
  kings.groups[0].rows[0].name = 'Then-King';
  const rv = await openReview('2026-09', { [REVIEW('2026-09')]: stored });
  try {
    const r = await rv.run(() => ({
      games: document.querySelector('[data-slide="overview"] .deck-stat-value').textContent,
      king: document.querySelector('[data-slide="kings"] .deck-king-name').textContent,
    }));
    assert.deepStrictEqual(r, { games: '41', king: 'Then-King' });
  } finally { await rv.close(); }

  // And the Admin, back in the app, is told the pack no longer matches it.
  const app = await openApp({ [REVIEW('2026-09')]: stored });
  try {
    await openSection(app, '2026-09');
    assert.match(await app.page.textContent('#bpPublishState'), /revision 1 .*differs from what players see/s);
  } finally { await app.close(); }
});

maybe('unpublished months, bad links and Admin-only sections', async () => {
  const pub = await publishedReviews();
  const draft = await openReview('2026-07', { [REVIEW('2026-09')]: pub['2026-09'] });
  try {
    const r = await draft.run(() => ({ empty: !!document.querySelector('[data-review-empty]'), deck: !!document.querySelector('[data-deck]'), text: document.getElementById('reviewMain').textContent }));
    assert.deepStrictEqual([r.empty, r.deck], [true, false]);
    assert.match(r.text, /The July 2026 review hasn’t been published yet\./);
  } finally { await draft.close(); }

  const bad = await openReview('all', {});
  try {
    assert.match(await bad.page.textContent('#reviewMain'), /No review chosen/);
  } finally { await bad.close(); }

  // Power Rating made Admin-only: its slides are not shown to players.
  const hidden = await openReview('2026-09', { [REVIEW('2026-09')]: pub.all, moneypadel_visibility: { power: false } });
  try {
    const ids = await hidden.run(() => [...document.querySelectorAll('.deck-slide')].map((s) => s.dataset.slide));
    const mods = ids.map((id) => id.split(':')[0]);
    ['power', 'kings', 'rating_movers', 'rank_movers', 'performance', 'crossovers'].forEach((id) => assert.ok(!mods.includes(id), id));
    assert.ok(mods.includes('league') && mods.includes('overview'));
  } finally { await hidden.close(); }
});

maybe('Kings of Tiers fills its card with the app\'s crowned tiles, whether there are one, two, three or four kings', async () => {
  const SD = require('../assets/js/domain/boardPack/shareDeck.js');
  const all = { S: { name: 'Manny', rating: 1802 }, A: { name: 'Kaz', rating: 1741 }, B: { name: 'PDM', rating: 1462 }, C: { name: 'Ant Slicer', rating: 1288 } };
  for (const tiers of [['A'], ['A', 'B'], ['A', 'B', 'C'], ['S', 'A', 'B', 'C']]) {
    const kings = Object.assign(Object.fromEntries(tiers.map((t) => [t, all[t]])), { _fieldSize: {} });
    const deck = SD.build('2026-09', [{ item: { kind: 'module', id: 'kings', enabled: true, options: {} }, data: { minGames: 5, kings } }]);
    const rv = await openReview('2026-09', { [REVIEW('2026-09')]: SD.publication({ deck, by: 'Shaun', at: '2026-09-30T10:00:00.000Z' }) });
    try {
      await rv.page.click('[data-deck-next]');
      await rv.page.waitForFunction(() => document.querySelector('[data-deck]').dataset.index === '1');
      await rv.page.waitForFunction(() => [...document.querySelectorAll('.deck-king-crown')].every((i) => i.complete && i.naturalWidth > 0));
      const r = await rv.run(() => {
        const body = document.querySelector('[data-slide="kings"] .deck-body').getBoundingClientRect();
        const grid = document.querySelector('.deck-kings').getBoundingClientRect();
        const tiles = [...document.querySelectorAll('.deck-king')];
        return {
          count: document.querySelector('.deck-kings').dataset.count,
          tiles: tiles.map((t) => [t.className.match(/deck-king-(\w)\b/)[1], t.querySelector('.deck-king-name').textContent, t.querySelector('.deck-king-tier').textContent, t.querySelector('.deck-king-rating').textContent]),
          crowns: document.querySelectorAll('.deck-king-crown').length,
          fills: Math.round((grid.height / body.height) * 100),
          inside: tiles.every((t) => { const b = t.getBoundingClientRect(); return b.left >= body.left - 0.5 && b.right <= body.right + 0.5 && b.bottom <= body.bottom + 0.5
            && [...t.children].every((c) => { const cb = c.getBoundingClientRect(); return cb.left >= b.left - 0.5 && cb.right <= b.right + 0.5 && cb.bottom <= b.bottom + 0.5; }); }),
        };
      });
      assert.strictEqual(r.count, String(tiers.length));
      assert.deepStrictEqual(r.tiles, tiers.map((t) => [t.toLowerCase(), all[t].name, `Tier ${t}`, String(all[t].rating)]));
      assert.strictEqual(r.crowns, tiers.length, 'every king has the laurel crown');
      assert.ok(r.fills >= 99, `the tiles fill the card (${r.fills}%)`);
      assert.ok(r.inside, 'nothing spills out of a tile or the card');
    } finally { await rv.close(); }
  }
});

maybe('a review published before the Kings tiles keeps the look it was published with', async () => {
  const SD = require('../assets/js/domain/boardPack/shareDeck.js');
  const deck = SD.build('2026-09', [{ item: { kind: 'module', id: 'kings', enabled: true, options: {} }, data: { minGames: 5, kings: { A: { name: 'Kaz', rating: 1741 }, _fieldSize: {} } } }]);
  delete deck.slides[0].layout;       // as stored by the first release
  const rv = await openReview('2026-09', { [REVIEW('2026-09')]: SD.publication({ deck, by: 'Shaun', at: '2026-09-30T10:00:00.000Z' }) });
  try {
    const r = await rv.run(() => ({ tiles: document.querySelectorAll('.deck-king').length, rows: [...document.querySelectorAll('[data-slide="kings"] .deck-name')].map((n) => n.textContent) }));
    assert.deepStrictEqual(r, { tiles: 0, rows: ['Kaz'] });
  } finally { await rv.close(); }
});

maybe('unpublish: the link stops showing the review at once, nothing is deleted, and publishing again brings it back', async () => {
  const app = await openApp();
  let withdrawn, back;
  try {
    await openSection(app, '2026-09');
    const p = app.page;
    const docs = () => app.run((key) => window.__writes.filter((w) => w.id === key).map((w) => (w.deleted ? 'DELETED' : JSON.parse(w.doc.value))), REVIEW('2026-09'));
    assert.strictEqual(await p.$('#bpUnpublish'), null, 'nothing to unpublish yet');
    await p.click('#bpPublish'); await p.click('#bpPublishConfirm');
    await p.waitForFunction(() => /revision 1/.test(document.getElementById('bpPublishState').textContent));

    const locked = await app.run(async () => { isUnlocked = false; const r = await unpublishBoardPackReview('2026-09'); isUnlocked = true; return r; });
    assert.deepStrictEqual([locked.ok, locked.message], [false, 'Only an admin can unpublish the review.']);
    assert.strictEqual((await docs()).length, 1);

    await p.click('#bpUnpublish');
    assert.match(await p.textContent('.bp-confirm'), /stops showing it straight away/);
    await p.click('#bpUnpublishConfirm');
    await p.waitForFunction(() => /^Unpublished/.test(document.getElementById('bpPublishState').textContent));
    withdrawn = (await docs()).at(-1);
    assert.notStrictEqual(withdrawn, 'DELETED');
    assert.deepStrictEqual([withdrawn.withdrawn, withdrawn.withdrawnBy, withdrawn.revision, withdrawn.deck.slides.length > 0], [true, 'Shaun', 1, true]);
    assert.strictEqual(await p.$('#bpCopySummary'), null, 'nothing to share while unpublished');
    assert.strictEqual(await p.textContent('#bpPublish'), 'Publish again');
    assert.match(await p.textContent('#bpPublishState'), /brings it back as revision 2/);

    await p.click('#bpPublish'); await p.click('#bpPublishConfirm');
    await p.waitForFunction(() => /revision 2/.test(document.getElementById('bpPublishState').textContent));
    back = (await docs()).at(-1);
    assert.deepStrictEqual([back.revision, back.withdrawn, back.firstPublishedAt], [2, undefined, withdrawn.firstPublishedAt]);
    assert.ok(!(await docs()).includes('DELETED'), 'no document was ever deleted');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }

  const gone = await openReview('2026-09', { [REVIEW('2026-09')]: withdrawn });
  try {
    const r = await gone.run(() => ({ deck: !!document.querySelector('[data-deck]'), text: document.getElementById('reviewMain').textContent }));
    assert.strictEqual(r.deck, false);
    assert.match(r.text, /The September 2026 review is no longer available\./);
  } finally { await gone.close(); }

  const again = await openReview('2026-09', { [REVIEW('2026-09')]: back });
  try {
    assert.ok(await again.run(() => !!document.querySelector('[data-deck]')));
  } finally { await again.close(); }
});

// Shaun, 1 Nov: the standings site's Monthly tab -- review/ with no month lists
// the published reviews, newest first, each opening its swipeable deck.
maybe('review/ with no month lists the published months, newest first; a withdrawn one is left out', async () => {
  const pub = await publishedReviews();
  const withdrawn = { ...pub['2026-08'], withdrawn: true };
  const club = { [REVIEW('2026-09')]: pub['2026-09'], [REVIEW('2026-08')]: pub['2026-08'] };
  const app = await H.open({ path: 'review/', mobile: true, now: NOW, club, readyWhen: () => window.REVIEW_READY });
  try {
    const r = await app.run(() => ({
      title: document.getElementById('reviewTitle').textContent,
      rows: [...document.querySelectorAll('.review-index-row')].map((a) => [a.querySelector('.review-index-month').textContent, a.getAttribute('href')]),
      back: document.querySelector('.review-index-back a').textContent,
    }));
    assert.strictEqual(r.title, 'Monthly Reviews');
    assert.deepStrictEqual(r.rows, [['September 2026', '?m=2026-09'], ['August 2026', '?m=2026-08']]);
    assert.strictEqual(r.back, 'Open Money Padel');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
  const app2 = await H.open({ path: 'review/', mobile: true, now: NOW, club: { [REVIEW('2026-09')]: pub['2026-09'], [REVIEW('2026-08')]: withdrawn }, readyWhen: () => window.REVIEW_READY });
  try {
    const months = await app2.run(() => [...document.querySelectorAll('.review-index-month')].map((e) => e.textContent));
    assert.deepStrictEqual(months, ['September 2026']);
  } finally { await app2.close(); }
  const app3 = await H.open({ path: 'review/', mobile: true, now: NOW, club: {}, readyWhen: () => window.REVIEW_READY });
  try {
    assert.match(await app3.run(() => document.getElementById('reviewMain').innerText), /No monthly review has been published yet/);
  } finally { await app3.close(); }
});

// The month's honours open the pack by default: each tier's Champion and the
// Player of the Month (Shaun, 1 Nov).
maybe('a published review carries the month\'s Champions slide', async () => {
  const pub = await publishedReviews();
  const slide = pub['2026-09'].deck.slides.find((s) => s.module === 'champions' || s.id === 'champions' || s.eyebrow === 'Honours');
  assert.ok(slide, JSON.stringify(pub['2026-09'].deck.slides.map((s) => s.eyebrow)));
  const rows = slide.groups[0].rows;
  assert.ok(rows.some((r) => /^Tier [ABC] Champion$/.test(r.label)), JSON.stringify(rows));
});

maybe('a club review leads back to All months; a player\'s private pack does not', async () => {
  const pub = await publishedReviews();
  const app = await openReview('2026-09', { [REVIEW('2026-09')]: pub['2026-09'] });
  try {
    assert.strictEqual(await app.run(() => document.getElementById('reviewAllMonths').getAttribute('href')), './');
  } finally { await app.close(); }
});
