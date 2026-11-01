// ===================== BOARD PACK: THE STORED CHOICE =====================
// domain/boardPack/boardPackConfig.js: what an admin's month-end Board Pack
// stores -- which modules, in what order, shown how, and their commentary --
// and nothing else. Figures are never stored.

const test = require('node:test');
const assert = require('node:assert');
const BP = require('../assets/js/domain/boardPack/boardPackConfig.js');

const M = '2026-08';
const ids = (c) => c.items.map((it) => it.id);
const at = (c, id) => c.items.findIndex((it) => it.id === id);

test('one document per month, and only a real month', () => {
  assert.strictEqual(BP.storageKey('2026-08'), 'moneypadel_board_pack_2026-08');
  for (const bad of ['all', '2026-13', '2026-8', '', null, undefined]) assert.throws(() => BP.storageKey(bad), String(bad));
});

test('a month with nothing saved starts from the catalogue, every module present once', () => {
  const c = BP.defaultConfig(M);
  assert.deepStrictEqual(ids(c), BP.MODULES.map((m) => m.id));
  assert.deepStrictEqual(c.items.filter((it) => it.enabled).map((it) => it.id), BP.MODULES.filter((m) => m.on).map((m) => m.id));
  assert.deepStrictEqual(c.items[at(c, 'power')].options, { split: 'split', tier: 'all', top: '10', min: '5', players: 'all' });
  assert.deepStrictEqual([c.updatedAt, c.updatedBy, c.basis], [null, null, null]);
  // No figure anywhere in what would be stored: every option is one of the
  // module's own presentation choices.
  c.items.forEach((it) => Object.entries(it.options).forEach(([k, v]) => assert.ok(BP.BY_ID[it.id].options[k].values.includes(v), `${it.id}.${k}`)));
});

test('the monthly results table and the over-80% list are in every new month\'s pack', () => {
  const c = BP.defaultConfig(M);
  const on = BP.selected(c).map((it) => it.id);
  assert.ok(on.includes('results_table') && on.includes('over_80'));
  assert.deepStrictEqual(c.items[at(c, 'results_table')].options, { sort: 'points', split: 'split', tier: 'all', top: 'all' });
  assert.deepStrictEqual(c.items[at(c, 'over_80')].options, { threshold: '80', min: '3' });
  assert.deepStrictEqual(BP.BY_ID.results_table.options.sort.values, ['points', 'games', 'difficulty']);
  assert.deepStrictEqual(BP.BY_ID.over_80.options.min.values, ['3', '1', '5']);
  assert.deepStrictEqual(BP.BY_ID.over_80.options.threshold.values, ['50', '60', '70', '75', '80', '90', '100'], 'the % is the Admin\'s choice');
  // A pack saved before these options existed reads with the defaults.
  const old = BP.normalise({ month: M, items: [{ kind: 'module', id: 'over_80', enabled: true, options: { min: '5' } }, { kind: 'module', id: 'power', enabled: true, options: { tier: 'A' } }] }, M);
  assert.deepStrictEqual(old.items[0].options, { threshold: '80', min: '5' });
  assert.deepStrictEqual(old.items[2].options, { split: 'split', tier: 'A', top: '10', min: '5', players: 'all' });
});

test('losing is its own module with its own threshold; a pack saved before the split keeps its losers', () => {
  const c = BP.defaultConfig(M);
  const on = BP.selected(c).map((it) => it.id);
  assert.deepStrictEqual(on.slice(on.indexOf('over_80'), on.indexOf('over_80') + 2), ['over_80', 'lost_pct'], 'on by default, right after winning');
  assert.strictEqual(BP.BY_ID.over_80.title, 'Won a set % of matches or more');
  assert.strictEqual(BP.BY_ID.lost_pct.title, 'Lost a set % of matches or more');
  assert.deepStrictEqual(BP.BY_ID.lost_pct.options.threshold.values, BP.BY_ID.over_80.options.threshold.values);
  assert.deepStrictEqual(c.items[at(c, 'lost_pct')].options, { threshold: '80', min: '3' });
  assert.strictEqual(BP.BY_ID.worst_record.title, 'Highest loss % (3+ games)');
  assert.strictEqual(c.items[at(c, 'worst_record')].enabled, false, 'off by default, like Best win %');
  assert.strictEqual(at(c, 'worst_record'), at(c, 'best_record') + 1);

  // The thresholds are independent.
  let x = BP.setOption(c, at(c, 'over_80'), 'threshold', '90');
  x = BP.setOption(x, at(x, 'lost_pct'), 'threshold', '50');
  assert.deepStrictEqual([x.items[at(x, 'over_80')].options.threshold, x.items[at(x, 'lost_pct')].options.threshold], ['90', '50']);

  // Saved before the split: losing arrives right after winning, on or off as
  // winning was, with its threshold -- the pack still shows what it showed.
  const before = (enabled) => BP.normalise({ month: M, items: [
    { kind: 'module', id: 'results_table', enabled: true, options: {} },
    { kind: 'module', id: 'over_80', enabled, options: { threshold: '70', min: '5' } },
    { kind: 'module', id: 'league', enabled: true, options: {} }] }, M);
  const a = before(true);
  assert.deepStrictEqual(a.items.slice(0, 4).map((it) => [it.id, it.enabled]), [['results_table', true], ['over_80', true], ['lost_pct', true], ['league', true]]);
  assert.deepStrictEqual(a.items[2].options, { threshold: '70', min: '5' });
  assert.strictEqual(before(false).items[2].enabled, false);
  // Any other new module still arrives off, at the end.
  assert.deepStrictEqual([a.items.find((it) => it.id === 'worst_record').enabled, a.items.findIndex((it) => it.id === 'worst_record') > 3], [false, true]);
  // Saved after the split: the Admin's own choice stands.
  const after = BP.normalise({ month: M, items: [
    { kind: 'module', id: 'over_80', enabled: true, options: { threshold: '70' } },
    { kind: 'module', id: 'league', enabled: true, options: {} },
    { kind: 'module', id: 'lost_pct', enabled: false, options: { threshold: '90' } }] }, M);
  assert.deepStrictEqual(after.items.slice(0, 3).map((it) => [it.id, it.enabled, it.options.threshold]), [['over_80', true, '70'], ['league', true, undefined], ['lost_pct', false, '90']]);
  // The player catalogue has no splits; nothing changes there.
  assert.deepStrictEqual(BP.PLAYER.defaultConfig(M).items.map((it) => it.id), BP.PLAYER.MODULES.map((m) => m.id));
});

test('select and deselect keep the module\'s place and options', () => {
  let c = BP.defaultConfig(M);
  const i = at(c, 'league');
  c = BP.setOption(c, i, 'top', '5');
  c = BP.setEnabled(c, i, false);
  assert.strictEqual(c.items[i].enabled, false);
  assert.ok(!BP.selected(c).some((it) => it.id === 'league'));
  c = BP.setEnabled(c, i, true);
  assert.deepStrictEqual([at(c, 'league'), c.items[i].options.top], [i, '5']);
  assert.ok(BP.selected(c).some((it) => it.id === 'league'));
});

test('move up and down, and never past either end', () => {
  let c = BP.defaultConfig(M);
  const first = c.items[0].id, second = c.items[1].id;
  assert.strictEqual(BP.move(c, 0, -1), c, 'the first cannot go up');
  assert.strictEqual(BP.move(c, c.items.length - 1, 1), c, 'the last cannot go down');
  c = BP.move(c, 1, -1);
  assert.deepStrictEqual([c.items[0].id, c.items[1].id], [second, first]);
  c = BP.move(c, 0, 1);
  assert.deepStrictEqual([c.items[0].id, c.items[1].id], [first, second]);
});

test('options are presentation only, and only the ones a module offers', () => {
  let c = BP.defaultConfig(M);
  const i = at(c, 'rating_movers');
  c = BP.setOption(c, i, 'show', 'fallers');
  assert.strictEqual(c.items[i].options.show, 'fallers');
  assert.strictEqual(BP.setOption(c, i, 'show', 'everyone'), c, 'an unknown value is refused');
  assert.strictEqual(BP.setOption(c, i, 'tier', 'A'), c, 'an option the module does not have is refused');
  assert.strictEqual(BP.setOption(c, at(c, 'overview'), 'top', '3'), c);
  assert.strictEqual(BP.limit('all'), Infinity);
  assert.strictEqual(BP.limit('5'), 5);
});

test('commentary: added, edited, moved and removed like any section, and marked as a note', () => {
  let c = BP.defaultConfig(M);
  c = BP.addNote(c, { id: 'n1', title: 'Chair’s note', body: 'A strong month.\nMore courts in October.' });
  const i = c.items.length - 1;
  assert.deepStrictEqual(c.items[i], { kind: 'note', id: 'n1', title: 'Chair’s note', body: 'A strong month.\nMore courts in October.' });
  c = BP.move(c, i, -(i));
  assert.strictEqual(c.items[0].id, 'n1');
  c = BP.updateNote(c, 0, { body: 'Edited' });
  assert.deepStrictEqual([c.items[0].title, c.items[0].body], ['Chair’s note', 'Edited']);
  assert.strictEqual(BP.selected(c)[0].kind, 'note');
  assert.strictEqual(BP.removeNote(c, at(c, 'league')), c, 'a module is switched off, not removed');
  assert.strictEqual(BP.setEnabled(c, 0, false), c, 'a note is not switched off, it is removed');
  c = BP.removeNote(c, 0);
  assert.ok(!c.items.some((it) => it.kind === 'note'));
  const long = BP.addNote(c, { id: 'n2', title: 'x'.repeat(500), body: 'y'.repeat(9000) }).items.at(-1);
  assert.deepStrictEqual([long.title.length, long.body.length], [BP.NOTE_TITLE_MAX, BP.NOTE_BODY_MAX]);
});

test('what is stored reads back as the same pack', () => {
  let c = BP.defaultConfig(M);
  c = BP.setEnabled(c, at(c, 'overview'), false);
  c = BP.move(c, at(c, 'merit'), -3);
  c = BP.setOption(c, at(c, 'race'), 'provisional', 'show');
  c = BP.addNote(c, { id: 'n1', title: 'T', body: 'B' });
  const saved = BP.forSave(c, { by: 'Shaun', at: '2026-09-30T12:00:00.000Z', basis: { games: 28, fingerprint: 'abc' } });
  const back = BP.normalise(JSON.parse(JSON.stringify(saved)), M);
  assert.deepStrictEqual(back, saved);
  assert.ok(BP.sameChoice(back, c));
  assert.deepStrictEqual([back.updatedBy, back.updatedAt, back.basis], ['Shaun', '2026-09-30T12:00:00.000Z', { games: 28, fingerprint: 'abc' }]);
});

test('reading defensively: wrong month, junk, duplicates, bad options', () => {
  assert.deepStrictEqual(BP.normalise(null, M), BP.defaultConfig(M));
  assert.deepStrictEqual(BP.normalise({ month: '2026-07', items: [] }, M), BP.defaultConfig(M), 'another month’s pack is not this one');
  const c = BP.normalise({ month: M, items: [
    { kind: 'module', id: 'league', enabled: true, options: { top: '7', tier: 'B', colour: 'red' } },
    { kind: 'module', id: 'league', enabled: false },
    null, { kind: 'module' }, { kind: 'banana', id: 'x' },
  ] }, M);
  assert.strictEqual(c.items[0].id, 'league');
  assert.deepStrictEqual(c.items[0].options, { tier: 'B', top: 'all', slides: 'each' });
  assert.strictEqual(c.items.filter((it) => it.id === 'league').length, 1);
  assert.strictEqual(c.items.length, BP.MODULES.length);
});

test('extensible: a module added later arrives off, at the end; one this build does not know is kept', () => {
  const stored = BP.defaultConfig(M);
  stored.items = stored.items.filter((it) => it.id !== 'crossovers');
  stored.items.unshift({ kind: 'module', id: 'moment_of_the_month', enabled: true, options: { clip: 'x' } });
  const c = BP.normalise(stored, M);
  assert.deepStrictEqual(c.items.at(-1), { kind: 'module', id: 'crossovers', enabled: false, options: { top: '5' } });
  assert.deepStrictEqual(c.items[0], { kind: 'module', id: 'moment_of_the_month', enabled: true, options: { clip: 'x' } });
  assert.ok(!BP.selected(c).some((it) => it.id === 'moment_of_the_month'), 'but it is not drawn');
});

test('tiers: split by tier (every tier, its own section and slide) by default, or one list', () => {
  const c = BP.defaultConfig(M);
  ['results_table', 'power'].forEach((id) => {
    assert.deepStrictEqual(BP.BY_ID[id].options.split.values, ['split', 'one'], id);
    assert.strictEqual(c.items[at(c, id)].options.split, 'split', `${id} splits by default`);
    assert.strictEqual(c.items[at(c, id)].options.tier, 'all', `${id} includes every tier`);
  });
  ['league', 'merit', 'race'].forEach((id) => {
    assert.deepStrictEqual(BP.BY_ID[id].options.slides.values, ['each', 'leaders'], id);
    assert.strictEqual(c.items[at(c, id)].options.slides, 'each', `${id}: a slide per tier by default`);
  });
  // A pack saved before these options gets the split, and keeps its tier.
  const old = BP.normalise({ month: M, items: [{ kind: 'module', id: 'power', enabled: true, options: { tier: 'B', top: '5' } }] }, M);
  assert.deepStrictEqual([old.items[0].options.split, old.items[0].options.tier, old.items[0].options.top], ['split', 'B', '5']);
});
