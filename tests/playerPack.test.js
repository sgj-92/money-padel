// ===================== PLAYER MONTHLY PACKS =====================
// Admin -> Monthly Board Pack -> Player packs: one pack per player per month,
// read from the club's own tables, edited and previewed by an Admin, and
// shared by a private link (review/?p=<token>) that cannot be guessed from a
// name, a month or an id. A published pack is stored as it was shown.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-28T12:00:00.000Z';
const DRAFTS = (m) => `moneypadel_player_packs_${m}`;
const NO_FORECAST = /beat|likely|favourite|favorite|probab|chance|should win|underdog|odds|predict|expected to/i;

function png(file){
  const b = fs.readFileSync(file);
  assert.strictEqual(b.slice(1, 4).toString(), 'PNG');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

async function openPlayers(app, month = '2026-09'){
  await app.run(() => {
    isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
    legacyTabBtn('manage').click(); renderManage();
    document.querySelector('[data-acc-toggle="boardpack"]').click();
  });
  const p = app.page;
  await p.waitForSelector('#bpStatus');
  await p.selectOption('#bpMonth', month);
  await p.waitForSelector('#bpStatus');
  await p.click('#bpViewPlayers');
  await p.waitForSelector('#ppGenerate');
}
const openPlayer = async (app, name) => { await app.page.click(`[data-pp-open="${name}"]`); await app.page.waitForSelector('#ppBack'); };
const openReview = (token, collections, extra) => H.open(Object.assign({ path: `review/?p=${token}`, mobile: true, now: NOW, collections,
  readyWhen: () => window.REVIEW_READY }, extra || {}));

maybe('every pack reconciles with the club\'s own tables: record, games, League, Merit, Race and Power, for every player of the month', async () => {
  const app = await H.open({ now: NOW });
  try {
    const out = await app.run(() => ['2026-08', '2026-09'].map((month) => {
      const stats = computeMonthlySummaryStats(month);
      const split = leagueSplitRows(month).filter((s) => s.games > 0);
      const race = buildMonthlyRace(month).table;
      return playerPackPlayers(month).map((name) => {
        const pk = playerMonthlyPack(name, month);
        const s = stats[name], r = pk.model.record;
        const problems = [];
        const eq = (what, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${what}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
        eq('P W D L', [r.played, r.wins, r.draws, r.losses], [s.games, s.wins, s.draws, s.losses]);
        eq('W+D+L', r.wins + r.draws + r.losses, r.played);
        eq('games', [r.gd, r.gf + r.ga], [s.gd, s.matchList.reduce((n, m) => n + m.sets.reduce((k, x) => k + x[0] + x[1], 0), 0)]);
        eq('matches', pk.model.matches.map((m) => m.id).sort(), s.matchList.map((m) => m.id).sort());
        eq('month', pk.model.matches.every((m) => m.date.slice(0, 7) === month), true);
        eq('matchups add up', pk.model.matchupTypes.reduce((n, t) => n + t.played, 0), r.played);
        eq('partners add up', pk.model.partners.reduce((n, t) => n + t.played, 0), r.played);
        eq('opponents add up', pk.model.opponents.reduce((n, t) => n + t.played, 0), r.played * 2);
        eq('league tiers', pk.league.map((l) => l.tier).sort(), split.filter((x) => x.name === name).map((x) => x.tier).sort());
        pk.league.forEach((l) => {
          const rows = sortLeagueRows(split.filter((x) => x.tier === l.tier), 'points', true);
          eq(`league ${l.tier}`, [l.position, l.of, l.points], [rows.findIndex((x) => x.name === name) + 1, rows.length, rows.find((x) => x.name === name).points]);
        });
        eq('race', pk.race.map((x) => [x.tier, x.qualified, x.score]), race.filter((x) => x.playerId === name).map((x) => [x.tier, x.qualified, x.score]));
        const mv = MonthlyViews.playerMonth(MONTHLY_VIEWS, month, name);
        eq('power', pk.power && [pk.power.start, pk.power.end, pk.power.change, pk.power.tierRank], mv && [mv.startRating, mv.endRating, mv.ratingChange, mv.endRankInTier]);
        return { name, problems, played: r.played };
      });
    }));
    const flat = out.flat();
    assert.ok(out[0].length > 5 && out[1].length > 5, 'both months have players');
    assert.deepStrictEqual(flat.filter((x) => x.problems.length), [], 'every pack reconciles');
    assert.ok(flat.every((x) => x.played > 0));
  } finally { await app.close(); }
});

maybe('Generate all makes a draft for every player in one write, keeps edits already made, and publishes nothing', async () => {
  const app = await H.open({ now: NOW });
  try {
    await openPlayers(app);
    const p = app.page;
    const players = await app.run(() => playerPackPlayers('2026-09'));
    assert.deepStrictEqual(await p.$$eval('.pp-row', (els) => els.map((e) => e.dataset.ppOpen)), players);
    assert.ok((await p.$$eval('.pp-state', (els) => els.map((e) => e.textContent))).every((t) => /No draft/.test(t)));

    // One player's pack is edited first: Partners off, an Admin note.
    const first = players[0];
    await openPlayer(app, first);
    const idx = await p.$eval('[data-bp-module="partners"]', (el) => Number(el.dataset.bpItem));
    await p.click(`[data-bp-toggle="${idx}"]`);
    await p.click('#bpAddNote');
    await p.fill('[data-bp-note-title]', 'Great month');
    await p.fill('[data-bp-note-body]', 'Your first month at the club.');
    await p.waitForFunction(() => /Draft saved/.test(document.getElementById('ppStatus').textContent), null, { timeout: 5000 });
    const saved = await app.run((k) => JSON.parse(window.__writes.filter((w) => w.id === k).at(-1).doc.value), DRAFTS('2026-09'));
    assert.deepStrictEqual(Object.keys(saved.players), [first], 'only the edited player has a draft yet');
    assert.strictEqual(saved.players[first].items.find((it) => it.id === 'partners').enabled, false);
    assert.strictEqual(saved.players[first].items.find((it) => it.kind === 'note').body, 'Your first month at the club.');

    await p.click('#ppBack');
    const before = await app.run(() => window.__writes.length);
    await p.click('#ppGenerate');
    await p.waitForFunction(() => /Drafts made for/.test(document.getElementById('bpMessage').textContent));
    const r = await app.run(([b, k]) => ({ writes: window.__writes.slice(b).map((w) => [w.collection, w.id]), doc: JSON.parse(window.__writes.at(-1).doc.value), msg: document.getElementById('bpMessage').textContent }), [before, DRAFTS('2026-09')]);
    assert.deepStrictEqual(r.writes, [['moneypadel', DRAFTS('2026-09')]], 'one write, nothing to playerPacks');
    assert.deepStrictEqual(Object.keys(r.doc.players).sort(), players.slice().sort());
    assert.strictEqual(r.doc.players[first].items.find((it) => it.id === 'partners').enabled, false, 'the edit is kept');
    assert.deepStrictEqual(r.doc.links, {}, 'nothing published');
    assert.match(r.msg, new RegExp(`Drafts made for ${players.length - 1} players. Nothing is published.`));
    assert.ok((await p.$$eval('.pp-state', (els) => els.map((e) => e.textContent))).every((t) => /^Draft/.test(t)));

    // Again: nothing new to make.
    await p.click('#ppGenerate');
    await p.waitForFunction(() => /Every player already has a draft/.test(document.getElementById('bpMessage').textContent));

    // Saved choices come back after a reload.
    const doc = await app.run((k) => JSON.parse(window.__writes.filter((w) => w.id === k).at(-1).doc.value), DRAFTS('2026-09'));
    const again = await H.open({ now: NOW, club: { [DRAFTS('2026-09')]: doc } });
    try {
      await openPlayers(again);
      await openPlayer(again, first);
      assert.strictEqual(await again.page.$eval(`[data-bp-toggle="${idx}"]`, (el) => el.checked), false);
      assert.strictEqual(await again.page.$eval('[data-bp-note-body]', (el) => el.value), 'Your first month at the club.');
      assert.deepStrictEqual(again.pageErrors, []);
    } finally { await again.close(); }
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('publish: a private 128-bit link, kept on republish; unpublish withdraws it; only an Admin can do either', async () => {
  const app = await H.open({ now: NOW });
  try {
    await openPlayers(app);
    const p = app.page;
    const name = (await app.run(() => playerPackPlayers('2026-09')))[1];
    await openPlayer(app, name);
    assert.match(await p.textContent('#ppPublishState'), /Not published/);
    await p.click('#ppPublish');
    await p.click('#ppPublishConfirm');
    await p.waitForFunction(() => /Published — revision 1/.test(document.getElementById('bpMessage').textContent));
    const one = await app.run((k) => {
      const pub = window.__writes.filter((w) => w.collection === 'playerPacks');
      const drafts = JSON.parse(window.__writes.filter((w) => w.id === k).at(-1).doc.value);
      return { ids: pub.map((w) => w.id), doc: JSON.parse(pub.at(-1).doc.value), drafts };
    }, DRAFTS('2026-09'));
    const token = one.ids[0];
    assert.match(token, /^[A-Za-z0-9_-]{22}$/, '22 URL-safe characters: 128 random bits');
    assert.ok(!token.toLowerCase().includes(name.toLowerCase().replace(/\s+/g, '')) && !token.includes('2026'), 'nothing in the link names the player or month');
    assert.deepStrictEqual([one.doc.kind, one.doc.player, one.doc.token, one.doc.month, one.doc.revision, !!one.doc.withdrawn], ['player', name, token, '2026-09', 1, false]);
    assert.deepStrictEqual(one.doc.deck.slides.map((s) => s.id), await app.run(([n]) => playerPackDeck(n, '2026-09', ppConfig('2026-09', n)).slides.map((s) => s.id), [name]));
    assert.deepStrictEqual(one.drafts.links[name], { token, revision: 1, publishedAt: one.doc.publishedAt, withdrawn: false });
    assert.strictEqual(await p.$eval('#ppOpenLink', (a) => a.getAttribute('href')), await app.run((t) => playerPackUrl(t), token));
    assert.match(await app.run((t) => playerPackUrl(t), token), new RegExp(`/review/\\?p=${token}$`));

    // A second player's link is a different, unrelated token.
    const other = (await app.run(() => playerPackPlayers('2026-09')))[2];
    const tokens = await app.run(async ([n]) => { const r = await publishPlayerPack(ppDrafts['2026-09'], n); ppDrafts['2026-09'] = r.drafts; return [r.publication.token, newPlayerPackToken(), newPlayerPackToken()]; }, [other]);
    assert.strictEqual(new Set([token, ...tokens]).size, 4);

    // Republish: the same link, the next revision, the first date kept.
    await app.run(() => renderManage());
    await p.click('#ppPublish');
    await p.click('#ppPublishConfirm');
    await p.waitForFunction(() => /Published — revision 2/.test(document.getElementById('bpMessage').textContent));
    const two = await app.run((t) => JSON.parse(window.__writes.filter((w) => w.collection === 'playerPacks' && w.id === t).at(-1).doc.value), token);
    assert.deepStrictEqual([two.token, two.revision, two.firstPublishedAt], [token, 2, one.doc.firstPublishedAt]);

    // Unpublish: withdrawn, nothing deleted.
    await p.click('#ppUnpublish');
    await p.click('#ppUnpublishConfirm');
    await p.waitForFunction(() => /Unpublished/.test(document.getElementById('bpMessage').textContent));
    const gone = await app.run((t) => ({ doc: JSON.parse(window.__writes.filter((w) => w.collection === 'playerPacks' && w.id === t).at(-1).doc.value), deleted: window.__writes.some((w) => w.deleted) }), token);
    assert.deepStrictEqual([gone.doc.withdrawn, gone.doc.revision, gone.deleted], [true, 2, false]);
    assert.ok(Array.isArray(gone.doc.deck.slides), 'the snapshot is kept');

    // Not an Admin: refused, and nothing written.
    const refused = await app.run(async ([n]) => {
      isUnlocked = false;
      const before = window.__writes.length;
      const res = [await savePlayerPackDrafts(ppDrafts['2026-09']), await publishPlayerPack(ppDrafts['2026-09'], n), await unpublishPlayerPack(ppDrafts['2026-09'], n)];
      return { ok: res.map((r) => r.ok), written: window.__writes.length - before };
    }, [name]);
    assert.deepStrictEqual(refused, { ok: [false, false, false], written: 0 });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// One published pack, made once from the seeded record and reused.
let made = null;
async function publishedPack(){
  if (made) return made;
  const app = await H.open({ now: NOW });
  try {
    made = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      const name = playerPackPlayers('2026-09')[0];
      const res = await publishPlayerPack(normalisePlayerPacks(null, '2026-09'), name);
      return { name, pub: res.publication };
    });
  } finally { await app.close(); }
  return made;
}

maybe('the private link shows that one pack, as published; a wrong, unknown or withdrawn link shows nothing', async () => {
  const { name, pub } = await publishedPack();
  const t = pub.token;
  // Stability: what was stored is what is shown -- nothing is worked out again.
  const stored = JSON.parse(JSON.stringify(pub));
  stored.deck.slides[0].title = 'As published in September';
  const page = await openReview(t, { playerPacks: { [t]: stored } });
  try {
    const p = page.page;
    const r = await p.evaluate(() => ({
      title: document.getElementById('reviewTitle').textContent,
      doc: document.title,
      slides: [...document.querySelectorAll('.deck-slide')].map((s) => s.dataset.slide),
      cover: document.querySelector('.deck-cover-title').textContent,
      first: document.querySelector('.deck-slide[data-slide]:not([data-slide="cover"]) .deck-title').textContent,
      reads: window.__reads.map((x) => [x.collection, x.id]),
      engine: ['computeMonthlySummaryStats', 'playerMonthlyPack', 'PlayerMonth', 'MonthlyViews', 'publishPlayerPack'].filter((k) => typeof window[k] !== 'undefined'),
      admin: !!document.querySelector('#ppPublish, #bpPublish, [data-bp-toggle], [data-pp-open]'),
      width: document.documentElement.scrollWidth,
    }));
    assert.strictEqual(r.title, `${name} · September 2026`);
    assert.strictEqual(r.doc, `${name} · September 2026 · Money Padel`);
    assert.deepStrictEqual(r.slides, ['cover', ...pub.deck.slides.map((s) => s.id), 'end']);
    assert.strictEqual(r.cover, name);
    assert.strictEqual(r.first, 'As published in September', 'the stored slide, verbatim');
    assert.deepStrictEqual([...new Set(r.reads.map(([c, id]) => `${c}/${id}`))].sort(),
      ['moneypadel/moneypadel_visibility', `playerPacks/${t}`].sort(), 'only its own document and the club visibility');
    assert.deepStrictEqual(r.engine, [], 'no statistics on the page');
    assert.strictEqual(r.admin, false);
    assert.ok(r.width <= 375, `no sideways scroll at 375px (${r.width})`);
    assert.deepStrictEqual(page.pageErrors, []);
  } finally { await page.close(); }

  const cases = [
    ['a guessed token', 'AAAAAAAAAAAAAAAAAAAAAA', { [t]: pub }],
    ['a malformed token', 'shaun', { [t]: pub }],
    ['the player\'s name', encodeURIComponent(name), { [t]: pub }],
    ['a month', '2026-09', { [t]: pub }],
    ['a withdrawn pack', t, { [t]: Object.assign({}, pub, { withdrawn: true }) }],
    ['a document that is not a player pack', t, { [t]: Object.assign({}, pub, { kind: 'review' }) }],
    ['a pack stored under another token', t, { [t]: Object.assign({}, pub, { token: 'BBBBBBBBBBBBBBBBBBBBBB' }) }],
  ];
  for (const [what, token, docs] of cases) {
    const x = await openReview(token, { playerPacks: docs });
    try {
      const got = await x.page.evaluate(() => ({ empty: !!document.querySelector('[data-review-empty]'), slides: document.querySelectorAll('.deck-slide').length, text: document.getElementById('reviewMain').textContent }));
      assert.deepStrictEqual([got.empty, got.slides], [true, 0], what);
      assert.match(got.text, /This Monthly Pack is not available/, what);
      assert.ok(!got.text.includes(name), `${what}: the player is not named`);
    } finally { await x.close(); }
  }
});

maybe('the private link sends no referrer, and a section the club has made Admin-only stays out of a shared pack', async () => {
  const { pub } = await publishedPack();
  const t = pub.token;
  assert.ok(pub.deck.slides.some((s) => s.section === 'power'), 'the default pack has a Power slide');
  const x = await openReview(t, { playerPacks: { [t]: pub } }, { club: { moneypadel_visibility: { power: false } } });
  try {
    const r = await x.page.evaluate(() => ({ ref: document.querySelector('meta[name="referrer"]').content, slides: [...document.querySelectorAll('.deck-slide')].map((s) => s.dataset.slide) }));
    assert.strictEqual(r.ref, 'no-referrer');
    assert.ok(!r.slides.includes('movement'), JSON.stringify(r.slides));
    assert.ok(r.slides.includes('overview'));
  } finally { await x.close(); }
});

maybe('the deck, its pictures and its summary: every slide states its sample, nothing reads as a forecast, 1080 x 1350 pictures', async () => {
  const app = await H.open({ now: NOW, mobile: true });
  try {
    await openPlayers(app);
    const p = app.page;
    const name = (await app.run(() => playerPackPlayers('2026-09')))[0];
    await openPlayer(app, name);
    await p.click('#ppPreviewBtn');
    await p.click('#ppModeDeck');
    await p.waitForSelector('#ppDeckFrame .deck-slide');
    const r = await app.run(([n]) => {
      const all = playerPackPlayers('2026-09').map((x) => playerPackDeck(x, '2026-09', BoardPack.PLAYER.defaultConfig('2026-09')));
      return {
        shown: [...document.querySelectorAll('#ppDeckFrame .deck-slide')].map((s) => s.dataset.slide),
        deck: playerPackDeck(n, '2026-09', ppConfig('2026-09', n)).slides.map((s) => s.id),
        width: document.documentElement.scrollWidth,
        cover: document.querySelector('#ppDeckFrame .deck-cover-title').textContent,
        text: all.map((d) => JSON.stringify(d.slides)).join(' '),
        unsampled: all.flatMap((d) => d.slides.filter((s) => ['matchups', 'partners', 'rivals', 'weaker'].includes(s.id))
          .flatMap((s) => s.groups.flatMap((g) => g.rows)).filter((row) => !/\d+ match/.test(row.sub)).map((row) => `${d.player}: ${row.name}`)),
        targets: all.flatMap((d) => (d.slides.find((s) => s.id === 'targets') || { groups: [{ rows: [] }] }).groups[0].rows.map((row) => row.sub)),
      };
    }, [name]);
    assert.deepStrictEqual(r.shown, ['cover', ...r.deck, 'end']);
    assert.strictEqual(r.cover, name);
    assert.ok(r.width <= 375, `no sideways scroll at 375px (${r.width})`);
    assert.deepStrictEqual(r.unsampled, [], 'every row says how many matches it rests on');
    assert.ok(r.targets.length > 3);
    r.targets.forEach((t) => assert.match(t, /\d+ match/, t));
    assert.ok(!NO_FORECAST.test(r.text), `no forecasting language: ${(r.text.match(NO_FORECAST) || [])[0]}`);

    // One module as a picture from the pack view: 1080 wide.
    const got = []; p.on('download', (d) => got.push(d));
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await p.click('#ppModePack');
    await p.click('[data-pp-share-item="matchups"]');
    for (let t = 0; t < 100 && !got.length; t++) await p.waitForTimeout(100);
    assert.strictEqual(got[0].suggestedFilename(), `money-padel-2026-09-${slug}-matchups.png`);
    assert.strictEqual(png(await got[0].path()).width, 1080);
    await p.waitForTimeout(500);

    // All slides as pictures: 1080 x 1350, named for the player.
    await p.click('#ppModeDeck');
    await p.click('#ppShareSlides');
    await p.waitForFunction(() => /slide pictures saved/.test(document.getElementById('bpMessage').textContent));
    await p.waitForTimeout(300);
    const slides = got.slice(1);
    assert.strictEqual(slides.length, r.shown.length);
    slides.forEach((d, i) => assert.strictEqual(d.suggestedFilename(), `money-padel-2026-09-${slug}-${String(i + 1).padStart(2, '0')}-${r.shown[i].replace(/[^a-z0-9]+/g, '-')}.png`));
    for (const d of slides) assert.deepStrictEqual(png(await d.path()), { width: 1080, height: 1350 }, d.suggestedFilename());

    // The summary before publishing has no link; nothing was published.
    await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await p.click('#ppCopyDeckSummary');
    await p.waitForFunction(() => /Summary copied/.test(document.getElementById('bpMessage').textContent));
    const text = await p.evaluate(() => navigator.clipboard.readText());
    assert.match(text, new RegExp(`^\\*${name} — September 2026\\*\\n`));
    assert.ok(!/\?p=/.test(text));
    assert.strictEqual(await app.run(() => window.__writes.filter((w) => w.collection === 'playerPacks').length), 0);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('the club\'s Board Pack is untouched by Player Packs: its catalogue, its storage and its calculations', async () => {
  const app = await H.open({ now: NOW });
  try {
    const r = await app.run(() => {
      const before = JSON.stringify([computeMonthlySummaryStats('2026-09'), leagueSplitRows('2026-09'), buildMonthlyRace('2026-09').table, PLAYERS.map((p) => [p.name, p.rating])]);
      playerPackPlayers('2026-09').forEach((n) => playerPackDeck(n, '2026-09', BoardPack.PLAYER.defaultConfig('2026-09')));
      const after = JSON.stringify([computeMonthlySummaryStats('2026-09'), leagueSplitRows('2026-09'), buildMonthlyRace('2026-09').table, PLAYERS.map((p) => [p.name, p.rating])]);
      return { same: before === after, club: BoardPack.MODULES.length, player: BoardPack.PLAYER.MODULES.map((m) => m.id), keys: [BoardPack.storageKey('2026-09'), playerPacksKey('2026-09')], writes: window.__writes.length };
    });
    assert.strictEqual(r.same, true, 'building every pack changes no table or rating');
    assert.strictEqual(r.club, 24, 'the club catalogue: 23, plus Monthly Champions & Player of the Month (1 Nov)');
    assert.deepStrictEqual(r.player, ['overview', 'matchups', 'partners', 'rivals', 'best', 'weaker', 'movement', 'targets']);
    assert.deepStrictEqual(r.keys, ['moneypadel_board_pack_2026-09', 'moneypadel_player_packs_2026-09']);
    assert.strictEqual(r.writes, 0, 'building packs writes nothing');
  } finally { await app.close(); }
});
