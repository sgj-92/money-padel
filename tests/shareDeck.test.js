// ===================== SHARE DECK: THE SLIDES =====================
// domain/boardPack/shareDeck.js turns the Board Pack's selected modules into
// the players' Monthly Review: one slide per module, in the pack's order,
// formatted and render-ready, so a published review can be stored as shown.

const test = require('node:test');
const assert = require('node:assert');
const SD = require('../assets/js/domain/boardPack/shareDeck.js');
const BP = require('../assets/js/domain/boardPack/boardPackConfig.js');

const M = '2026-09';
const item = (id, options) => ({ kind: 'module', id, enabled: true, options: Object.assign(BP.defaultOptions(id), options || {}) });
const stats = (name, games, wins, draws, losses) => ({ name, games, wins, draws, losses, points: 3 * wins + draws,
  winpct: Math.round(1000 * wins / games) / 10, losspct: Math.round(1000 * losses / games) / 10, hardness: 5.1 });

const DATA = {
  overview: { games: 28, draws: 5, players: 25 },
  kings: { minGames: 5, kings: { A: { name: 'Kaz', rating: 1735 }, B: { name: 'Rishi', rating: 1439 }, _fieldSize: { S: 1, A: 6, B: 5, C: 0 } } },
  league: { tiers: [{ tier: 'A', rows: [stats('Len', 10, 7, 1, 2), stats('KC', 6, 5, 0, 1)] }, { tier: 'B', rows: [stats('Rishi', 17, 8, 2, 7)] }] },
  most_wins: { groups: [{ rank: 1, names: ['Rishi'], value: 26 }, { rank: 2, names: ['Len'], value: 22 }], stats: { Rishi: stats('Rishi', 17, 8, 2, 7), Len: stats('Len', 10, 7, 1, 2) } },
  rating_movers: { risers: [{ playerId: 'KC', startRating: 1701.6, endRating: 1721, ratingChange: 19.4 }], fallers: [{ playerId: 'Ant', startRating: 1500, endRating: 1468.9, ratingChange: -31.1 }] },
  doughnuts: { received: [], given: [] },
  over_80: { min: 3, won: [], lost: [] },
  results_table: { sort: 'points', tiers: [{ tier: null, rows: Array.from({ length: 9 }, (_, i) => stats(`P${i}`, 5, 5 - Math.min(i, 5), 0, Math.min(i, 5))) }] },
};

test('one slide per selected module, in the pack\'s order; nothing to say, no slide', () => {
  const entries = ['kings', 'overview', 'doughnuts', 'league', 'over_80', 'most_wins'].map((id) => ({ item: item(id), data: DATA[id] }));
  entries.splice(2, 0, { item: { kind: 'note', id: 'n1', title: 'Chair', body: 'Well played.' }, data: null });
  const deck = SD.build(M, entries);
  assert.strictEqual(deck.title, 'September 2026 Review');
  assert.deepStrictEqual(deck.slides.map((s) => s.id), ['kings', 'overview', 'note:n1', 'league:A', 'league:B', 'most_wins'], 'empty Doughnuts and over-80% are left out; the League, a slide per tier');
  const note = deck.slides[2];
  assert.deepStrictEqual([note.kind, note.title, note.body], ['note', 'Chair', 'Well played.']);
});

test('slides carry the module\'s own figures, formatted, and never a full table', () => {
  const s = (id, o) => SD.slideFor(item(id, o), DATA[id], M);
  assert.deepStrictEqual(s('overview').stats, [{ value: '28', label: 'Games played' }, { value: '25', label: 'Players' }, { value: '5', label: 'Draws' }]);
  assert.deepStrictEqual(s('kings').groups[0].rows.map((r) => [r.label, r.name, r.value]), [['Tier A', 'Kaz', '1735'], ['Tier B', 'Rishi', '1439']]);
  assert.deepStrictEqual(s('league', { slides: 'leaders' }).groups[0].rows.map((r) => [r.label, r.name, r.value, r.sub]), [['Tier A', 'Len', '22 pts', '7W 1D 2L'], ['Tier B', 'Rishi', '26 pts', '8W 2D 7L']]);
  assert.deepStrictEqual(s('rating_movers').groups.map((g) => [g.label, g.rows[0].name, g.rows[0].value]), [['Risers', 'KC', '+19.4'], ['Fallers', 'Ant', '−31.1']]);
  assert.strictEqual(s('results_table').groups[0].rows.length, SD.ROWS, 'a table becomes its top five');
  assert.strictEqual(s('kings').section, 'power');
  assert.strictEqual(s('league').section, null);
  // Render-ready: every value a string, so the stored slide is the slide shown.
  const deck = SD.build(M, Object.keys(DATA).map((id) => ({ item: item(id), data: DATA[id] })));
  deck.slides.forEach((sl) => (sl.stats || []).concat(...(sl.groups || []).map((g) => g.rows)).forEach((r) => assert.strictEqual(typeof r.value, 'string', sl.id)));
});

test('a long note is shortened for its card; an empty one is left out', () => {
  const long = SD.slideFor({ kind: 'note', id: 'n', title: 'T', body: 'x'.repeat(2000) }, null, M);
  assert.strictEqual(long.body.length, SD.NOTE_BODY_MAX);
  assert.ok(long.body.endsWith('…'));
  assert.strictEqual(SD.slideFor({ kind: 'note', id: 'n', title: ' ', body: '' }, null, M), null);
});

test('players do not see slides on a section the club has made Admin only', () => {
  const deck = SD.build(M, ['overview', 'kings', 'rating_movers', 'league'].map((id) => ({ item: item(id), data: DATA[id] })));
  const shown = SD.visibleSlides(deck, (k) => k !== 'power').map((s) => s.id);
  assert.deepStrictEqual(shown, ['overview', 'league:A', 'league:B']);
});

test('the WhatsApp summary: the headline of each slide, then the link', () => {
  const deck = SD.build(M, ['overview', 'kings', 'most_wins', 'rating_movers'].map((id) => ({ item: item(id), data: DATA[id] })));
  const text = SD.summaryText(deck, { link: 'https://example.test/review/?m=2026-09' });
  assert.strictEqual(text, [
    '*Money Padel — September 2026*',
    '28 games played · 25 players · 5 draws',
    'Tier A King: Kaz', 'Tier B King: Rishi',
    'Most wins: Rishi (8 wins)',
    'Biggest riser: KC (+19.4 pts)', 'Biggest faller: Ant (−31.1 pts)',
    '', 'Full September review:', 'https://example.test/review/?m=2026-09',
  ].join('\n'));
  assert.ok(!SD.summaryText(deck, { canSee: (k) => k !== 'power' }).includes('King'), 'hidden slides stay out of the summary too');
});

test('publishing: revisions count up, the first date is kept, and the deck is stored as it reads', () => {
  const deck = SD.build(M, [{ item: item('overview'), data: DATA.overview }]);
  const first = SD.publication({ deck, by: 'Shaun', at: '2026-10-01T09:00:00Z', basis: { games: 28, fingerprint: 'f' } });
  assert.deepStrictEqual([first.revision, first.firstPublishedAt, first.publishedAt, first.publishedBy, first.month], [1, '2026-10-01T09:00:00Z', '2026-10-01T09:00:00Z', 'Shaun', M]);
  assert.strictEqual(first.deck, deck);
  const second = SD.publication({ deck, by: 'Board', at: '2026-10-03T09:00:00Z', previous: JSON.parse(JSON.stringify(first)) });
  assert.deepStrictEqual([second.revision, second.firstPublishedAt, second.publishedAt], [2, '2026-10-01T09:00:00Z', '2026-10-03T09:00:00Z']);
  assert.ok(SD.sameDeck(first.deck, JSON.parse(JSON.stringify(deck))));
  assert.ok(!SD.sameDeck(first.deck, SD.build(M, [{ item: item('kings'), data: DATA.kings }])));
  assert.strictEqual(SD.storageKey(M), 'moneypadel_review_2026-09');
  assert.throws(() => SD.storageKey('all'));
});

test('Kings of Tiers is drawn as the app\'s crowned tiles, one per tier', () => {
  const s = SD.slideFor(item('kings'), DATA.kings, M);
  assert.strictEqual(s.layout, 'kings');
  assert.deepStrictEqual(s.groups[0].rows.map((r) => r.tier), ['A', 'B']);
});

test('unpublishing keeps the review, marked withdrawn; publishing again brings it back as the next revision', () => {
  const deck = SD.build(M, [{ item: item('overview'), data: DATA.overview }]);
  const first = SD.publication({ deck, by: 'Shaun', at: '2026-10-01T09:00:00Z' });
  assert.ok(SD.isLive(first));
  const gone = SD.withdrawal(first, { by: 'Board', at: '2026-10-02T09:00:00Z' });
  assert.deepStrictEqual([gone.withdrawn, gone.withdrawnBy, gone.withdrawnAt, gone.revision], [true, 'Board', '2026-10-02T09:00:00Z', 1]);
  assert.strictEqual(gone.deck, deck, 'nothing is deleted');
  assert.ok(!SD.isLive(gone));
  const back = SD.publication({ deck, by: 'Shaun', at: '2026-10-03T09:00:00Z', previous: gone });
  assert.deepStrictEqual([back.revision, back.firstPublishedAt, 'withdrawn' in back], [2, '2026-10-01T09:00:00Z', false]);
  assert.ok(SD.isLive(back));
  assert.ok(!SD.isLive(null));
});

test('winning and losing are separate slides, each with its own threshold; Highest loss % has its own', () => {
  const won = SD.slideFor(item('over_80', { threshold: '60' }), { min: 3, threshold: 60, won: [stats('Len', 5, 3, 1, 1)] }, M);
  const lost = SD.slideFor(item('lost_pct', { threshold: '50' }), { min: 3, threshold: 50, lost: [stats('Ant', 4, 1, 1, 2), stats('Bo', 5, 2, 0, 3)] }, M);
  assert.deepStrictEqual([won.title, won.groups.length, won.groups[0].rows.map((r) => [r.name, r.value, r.sub])], ['Won 60% or more', 1, [['Len', '60%', '3W 1D 1L of 5']]]);
  assert.deepStrictEqual([lost.title, lost.groups[0].rows.map((r) => [r.name, r.value, r.sub])], ['Lost 50% or more', [['Ant', '50%', '1W 1D 2L of 4'], ['Bo', '60%', '2W 0D 3L of 5']]]);
  assert.deepStrictEqual(lost.summary, ['Lost 50% or more: Ant (50%), Bo (60%)']);
  assert.strictEqual(SD.slideFor(item('lost_pct', { threshold: '100' }), { min: 3, threshold: 100, lost: [stats('Cy', 3, 0, 0, 3)] }, M).title, 'Lost every match');
  assert.strictEqual(SD.slideFor(item('lost_pct'), { min: 3, threshold: 80, lost: [] }, M), null, 'nobody, no slide');
  const worst = SD.slideFor(item('worst_record'), { minGames: 3, groups: [{ rank: 1, names: ['Bo'], value: 60 }], stats: { Bo: stats('Bo', 5, 2, 0, 3) } }, M);
  assert.deepStrictEqual([worst.title, worst.groups[0].rows[0].name, worst.groups[0].rows[0].value, worst.groups[0].rows[0].sub, worst.foot],
    ['Highest loss %', 'Bo', '60%', '2W 0D 3L', '3+ games played · draws count as games']);
});

test('split by tier: a slide per tier, each with that tier\'s list; one list stays one slide', () => {
  const T = (tier, rows) => ({ tier, rows });
  const league = SD.slidesFor(item('league'), DATA.league, M);
  assert.deepStrictEqual(league.map((x) => [x.id, x.tier, x.title, x.groups[0].rows.map((r) => [r.rank, r.name, r.value])]), [
    ['league:A', 'A', 'League table · Tier A', [['1', 'Len', '22 pts'], ['2', 'KC', '15 pts']]],
    ['league:B', 'B', 'League table · Tier B', [['1', 'Rishi', '26 pts']]],
  ]);
  assert.deepStrictEqual(league.map((x) => x.summary), [['League Tier A: Len (22 pts)'], ['League Tier B: Rishi (26 pts)']]);
  assert.deepStrictEqual(SD.slidesFor(item('league', { slides: 'leaders' }), DATA.league, M).map((x) => x.id), ['league']);

  const power = { minGames: 5, players: 'all', tiers: [T('A', [{ name: 'Kaz', tier: 'A', rating: 1735.2, ratingChange: 4 }, { name: 'Len', tier: 'A', rating: 1700, ratingChange: null }]), T('B', [{ name: 'Rishi', tier: 'B', rating: 1439, ratingChange: -2 }])] };
  const ps = SD.slidesFor(item('power'), power, M);
  assert.deepStrictEqual(ps.map((x) => [x.id, x.section, x.title, x.groups[0].rows.map((r) => [r.rank, r.name, r.value, r.sub])]), [
    ['power:A', 'power', 'At month end · Tier A', [['1', 'Kaz', '1735', '+4 pts'], ['2', 'Len', '1700', '']]],
    ['power:B', 'power', 'At month end · Tier B', [['1', 'Rishi', '1439', '−2 pts']]],
  ]);
  const one = SD.slidesFor(item('power', { split: 'one' }), { minGames: 5, players: 'all', tiers: [T(null, power.tiers.flatMap((t) => t.rows))] }, M);
  assert.deepStrictEqual([one.length, one[0].id, one[0].title, one[0].groups[0].rows[2].sub], [1, 'power', 'At month end', 'Tier B · −2 pts']);

  const results = SD.slidesFor(item('results_table'), { sort: 'points', tiers: [T('A', [stats('Len', 10, 7, 1, 2)]), T('C', [stats('Fee', 4, 1, 0, 3)])] }, M);
  assert.deepStrictEqual(results.map((x) => [x.id, x.title, x.groups[0].rows[0].name]), [['results_table:A', 'Top of the table · Tier A', 'Len'], ['results_table:C', 'Top of the table · Tier C', 'Fee']]);
  const race = SD.slidesFor(item('race'), { minMatches: 5, tiers: [T('A', [{ playerId: 'Kaz', qualified: true, score: 41.2, played: 6 }, { playerId: 'Eli', qualified: false, score: 50, played: 3 }])] }, M);
  assert.deepStrictEqual(race[0].groups[0].rows.map((r) => [r.rank, r.name, r.sub]), [['1', 'Kaz', '6 matches'], ['–', 'Eli', 'provisional']]);
  // A tier with nothing to show has no slide; a module with no tiers, none.
  assert.deepStrictEqual(SD.slidesFor(item('league'), { tiers: [T('A', [])] }, M), []);
  assert.strictEqual(SD.slideFor(item('league'), { tiers: [] }, M), null);
});
