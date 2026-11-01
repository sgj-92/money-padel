// ===================== BOARD PACK: CONFIGURATION =====================
// The Admin Monthly Board Pack is a month-end report the admin compiles from
// the club's canonical statistics. What is stored is only the admin's CHOICE
// for a month -- which modules, in what order, shown how, and any written
// commentary -- never the figures: they are drawn fresh from the record every
// time the pack is opened (features/admin/boardPackData.js).
//
// Pure: no page, no app state. The module catalogue here names each module
// and its presentation options; what each module shows is the feature layer's.
//
//   config = {
//     version: 1, month: 'YYYY-MM',
//     items: [ { kind: 'module', id, enabled, options: { key: value } }
//            | { kind: 'note', id, title, body } ],   // one ordered list
//     basis: { games, fingerprint } | null,             // what the record held when saved
//     updatedAt: ISO | null, updatedBy: name | null,
//   }
//
// Every catalogue module has one item, enabled or not, so switching a module
// off and on again keeps its place and its options. A module added to the
// catalogue later (a "Moment of the Month", say) arrives in older months'
// configs switched off, at the end. An item whose id the catalogue does not
// know is kept as it is, so a config written by a newer build is not
// silently cut down by an older one.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BoardPack = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const VERSION = 1;

  const TOP = { label: 'Show', values: ['3', '5', '10', 'all'], labels: { 3: 'Top 3', 5: 'Top 5', 10: 'Top 10', all: 'All' } };
  const top = (d) => Object.assign({}, TOP, { default: d });
  const TIER = { label: 'Tiers', values: ['all', 'S', 'A', 'B', 'C'], labels: { all: 'All tiers', S: 'Tier S', A: 'Tier A', B: 'Tier B', C: 'Tier C' }, default: 'all' };
  const show = (values, labels) => ({ label: 'Include', values, labels, default: values[0] });
  // Tiers: every tier in the pack, each in its own section (and its own
  // slide), or one list. Split by default (Shaun, 1 Oct).
  const SPLIT = { label: 'Layout', values: ['split', 'one'], labels: { split: 'Split by tier', one: 'One list' }, default: 'split' };
  const SLIDES = { label: 'Slides', values: ['each', 'leaders'], labels: { each: 'A slide per tier', leaders: 'Leaders on one slide' }, default: 'each' };

  // "Matches", not "games" (Shaun, 1 Nov): in padel a game is a part of a set.
  const THRESHOLD = { label: 'At least', values: ['50', '60', '70', '75', '80', '90', '100'], labels: { 50: '50% or more', 60: '60% or more', 70: '70% or more', 75: '75% or more', 80: '80% or more', 90: '90% or more', 100: '100% (every match)' }, default: '80' };
  const PCT_MIN = { label: 'Minimum matches', values: ['3', '1', '5'], labels: { 1: 'Everyone', 3: '3+ matches', 5: '5+ matches' }, default: '3' };

  // The catalogue, in its default order. `on` is whether a month with no
  // saved pack starts with it selected.
  const MODULES = [
    { id: 'overview', title: 'Month overview', on: true, options: {} },
    // The month's honours (Shaun, 1 Nov): each tier's Monthly Champion and the
    // club's Player of the Month.
    { id: 'champions', title: 'Monthly Champions & Player of the Month', on: true, options: {} },
    { id: 'results_table', title: 'Monthly results table', on: true, options: {
      sort: { label: 'Order by', values: ['points', 'games', 'difficulty'], labels: { points: 'Points', games: 'Games played', difficulty: 'Hardest games' }, default: 'points' },
      split: SPLIT, tier: TIER, top: top('all') } },
    // Kept as 'over_80' so packs saved before the threshold became a choice
    // still find it; 80% is the default. Winning and losing were one module
    // until 1 Oct; losing is now its own (lost_pct), with its own threshold.
    { id: 'over_80', title: 'Won a set % of matches or more', on: true, options: { threshold: THRESHOLD, min: PCT_MIN } },
    { id: 'lost_pct', title: 'Lost a set % of matches or more', on: true, splitFrom: 'over_80', options: { threshold: THRESHOLD, min: PCT_MIN } },
    { id: 'information', title: 'Monthly Information (the players’ month review)', on: false, options: {} },
    { id: 'power', title: 'Power Rankings at month end', on: true, options: { split: SPLIT, tier: TIER, top: top('10'),
      min: { label: 'Minimum games', values: ['1', '3', '5', '10'], labels: { 1: 'Any (1+)', 3: '3+ games', 5: '5+ games', 10: '10+ games' }, default: '5' },
      players: { label: 'Players', values: ['all', 'active', 'ranked'], labels: { all: 'Everyone', active: 'Leave out inactive', ranked: 'Ranked only' }, default: 'all' } } },
    { id: 'kings', title: 'Kings of Tiers', on: true, options: {} },
    { id: 'league', title: 'League table', on: true, options: { tier: TIER, top: top('all'), slides: SLIDES } },
    { id: 'merit', title: 'Merit table', on: false, options: { tier: TIER, top: top('all'), slides: SLIDES } },
    { id: 'race', title: 'Monthly Race', on: true, options: { tier: TIER, top: top('all'), slides: SLIDES,
      provisional: { label: 'Provisional', values: ['hide', 'show'], labels: { hide: 'Qualifiers only', show: 'Include provisional' }, default: 'hide' } } },
    { id: 'most_wins', title: 'Most wins & points', on: false, options: { top: top('3') } },
    { id: 'best_record', title: 'Best win % (3+ games)', on: false, options: { top: top('3') } },
    { id: 'worst_record', title: 'Highest loss % (3+ games)', on: false, options: { top: top('3') } },
    { id: 'most_games', title: 'Most games played', on: false, options: { top: top('3') } },
    { id: 'rating_movers', title: 'Power Rating risers & fallers', on: true, options: {
      show: show(['both', 'risers', 'fallers'], { both: 'Risers and fallers', risers: 'Risers', fallers: 'Fallers' }), top: top('3') } },
    { id: 'rank_movers', title: 'Ranking climbers & sliders', on: false, options: {
      show: show(['both', 'climbers', 'sliders'], { both: 'Climbers and sliders', climbers: 'Climbers', sliders: 'Sliders' }), top: top('3') } },
    { id: 'performance', title: 'Monthly Performance (vs expectation)', on: false, options: { top: top('3') } },
    { id: 'form', title: 'Form at month end (Last 10)', on: false, options: { top: top('5') } },
    { id: 'hard_wins', title: 'Hard & favoured wins', on: false, options: {
      show: show(['both', 'hard', 'favoured'], { both: 'Hard and favoured', hard: 'Hard wins', favoured: 'Favoured wins' }), top: top('3') } },
    { id: 'doughnuts', title: 'Doughnuts', on: false, options: {
      show: show(['both', 'received', 'given'], { both: 'Received and given', received: 'Received', given: 'Given' }), top: top('3') } },
    { id: 'partnerships', title: 'Partnerships of the month', on: false, options: { top: top('3') } },
    { id: 'tier_moves', title: 'Tier movements', on: true, options: {} },
    { id: 'crossovers', title: 'Crossovers', on: false, options: { top: top('5') } },
  ];

  // The Player Monthly Pack's catalogue: one player's month, from their side.
  // Same machinery as the club pack (forCatalogue below), so selecting,
  // ordering, options, notes and saving work identically.
  const rivalMin = { label: 'Head-to-head minimum', values: ['2', '1', '3'], labels: { 1: '1+ match', 2: '2+ matches', 3: '3+ matches' }, default: '2' };
  const PLAYER_MODULES = [
    { id: 'overview', title: 'Month at a glance', on: true, options: {} },
    { id: 'matchups', title: 'Matchup types', on: true, options: { top: top('all') } },
    { id: 'partners', title: 'Partners', on: true, options: { top: top('5') } },
    { id: 'rivals', title: 'Opponents and head-to-head', on: true, options: { min: rivalMin, top: top('5') } },
    { id: 'best', title: 'Best results', on: true, options: {} },
    { id: 'weaker', title: 'Where results were weaker', on: true, options: {
      min: { label: 'Minimum sample', values: ['2', '3', '1'], labels: { 1: '1+ match', 2: '2+ matches', 3: '3+ matches' }, default: '2' } } },
    { id: 'movement', title: 'Monthly movement', on: true, options: {} },
    { id: 'targets', title: 'Next-month targets', on: true, options: {
      top: { label: 'Show', values: ['3', '5'], labels: { 3: 'Up to 3', 5: 'Up to 5' }, default: '3' } } },
  ];

  const NOTE_TITLE_MAX = 120;
  const NOTE_BODY_MAX = 4000;

  const isMonth = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

  // Everything that depends on which modules exist, for one catalogue.
  function forCatalogue(MODULES) {
  const BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));

  function defaultOptions(id) {
    const def = BY_ID[id];
    return Object.fromEntries(Object.entries(def ? def.options : {}).map(([k, o]) => [k, o.default]));
  }

  // Only known keys, only allowed values; anything else is the default.
  function cleanOptions(id, options) {
    const def = BY_ID[id];
    const out = defaultOptions(id);
    Object.entries(def.options).forEach(([k, o]) => {
      const v = options && options[k] !== undefined ? String(options[k]) : undefined;
      if (v !== undefined && o.values.includes(v)) out[k] = v;
    });
    return out;
  }

  function moduleItem(id, enabled, options) {
    return { kind: 'module', id, enabled: !!enabled, options: cleanOptions(id, options) };
  }

  function cleanNote(n) {
    return {
      kind: 'note',
      id: String(n.id),
      title: String(n.title || '').slice(0, NOTE_TITLE_MAX),
      body: String(n.body || '').slice(0, NOTE_BODY_MAX),
    };
  }

  function defaultConfig(month) {
    return {
      version: VERSION, month,
      items: MODULES.map((m) => moduleItem(m.id, m.on, {})),
      basis: null, updatedAt: null, updatedBy: null,
    };
  }

  // Whatever was stored, made safe to edit and render. A missing or unreadable
  // config, or one for a different month, is the month's default.
  function normalise(raw, month) {
    if (!raw || typeof raw !== 'object' || raw.month !== month || !Array.isArray(raw.items)) return defaultConfig(month);
    const seen = new Set();
    const items = [];
    raw.items.forEach((it) => {
      if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !it.id) return;
      if (it.kind === 'note') {
        if (seen.has('note:' + it.id)) return;
        seen.add('note:' + it.id);
        items.push(cleanNote(it));
      } else if (it.kind === 'module') {
        if (seen.has(it.id)) return;
        seen.add(it.id);
        items.push(BY_ID[it.id] ? moduleItem(it.id, it.enabled, it.options) : Object.assign({}, it, { enabled: !!it.enabled }));
      }
    });
    // A module split out of another (`splitFrom`) arrives in a pack saved
    // before the split right after its parent, on or off as the parent was
    // and with its options, so the pack still shows what it showed. Any
    // other new module arrives switched off, at the end.
    MODULES.forEach((m) => {
      if (seen.has(m.id)) return;
      const at = m.splitFrom ? items.findIndex((it) => it.kind === 'module' && it.id === m.splitFrom) : -1;
      if (at === -1) { items.push(moduleItem(m.id, false, {})); return; }
      items.splice(at + 1, 0, moduleItem(m.id, items[at].enabled, items[at].options));
    });
    return {
      version: VERSION, month, items,
      basis: raw.basis && typeof raw.basis === 'object' ? { games: Number(raw.basis.games) || 0, fingerprint: String(raw.basis.fingerprint || '') } : null,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
      updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
    };
  }

  const withItems = (config, items) => Object.assign({}, config, { items });

  function move(config, index, delta) {
    const to = index + delta;
    if (index < 0 || index >= config.items.length || to < 0 || to >= config.items.length) return config;
    const items = config.items.slice();
    const [it] = items.splice(index, 1);
    items.splice(to, 0, it);
    return withItems(config, items);
  }

  function setEnabled(config, index, enabled) {
    const it = config.items[index];
    if (!it || it.kind !== 'module') return config;
    return withItems(config, config.items.map((x, i) => (i === index ? Object.assign({}, x, { enabled: !!enabled }) : x)));
  }

  function setOption(config, index, key, value) {
    const it = config.items[index];
    if (!it || it.kind !== 'module' || !BY_ID[it.id]) return config;
    const o = BY_ID[it.id].options[key];
    if (!o || !o.values.includes(String(value))) return config;
    const options = Object.assign({}, it.options, { [key]: String(value) });
    return withItems(config, config.items.map((x, i) => (i === index ? Object.assign({}, x, { options }) : x)));
  }

  // A note joins the end of the pack; move it where it belongs.
  function addNote(config, { id, title, body }) {
    return withItems(config, config.items.concat([cleanNote({ id, title, body })]));
  }

  function updateNote(config, index, { title, body }) {
    const it = config.items[index];
    if (!it || it.kind !== 'note') return config;
    const next = cleanNote({ id: it.id, title: title === undefined ? it.title : title, body: body === undefined ? it.body : body });
    return withItems(config, config.items.map((x, i) => (i === index ? next : x)));
  }

  function removeNote(config, index) {
    const it = config.items[index];
    if (!it || it.kind !== 'note') return config;
    return withItems(config, config.items.filter((_, i) => i !== index));
  }

  // What the pack shows, in order: selected modules the catalogue knows, and
  // every note.
  function selected(config) {
    return config.items.filter((it) => (it.kind === 'note') || (it.kind === 'module' && it.enabled && BY_ID[it.id]));
  }

  // The stored form: the choice, who made it, when, and what the record held.
  function forSave(config, { by, at, basis }) {
    return Object.assign({}, config, { version: VERSION, updatedBy: by || null, updatedAt: at, basis: basis || null });
  }

  // "Top N" as a number, All as no limit.
  function limit(value) {
    return value === 'all' ? Infinity : Number(value);
  }

  // Two configs make the same pack (the stamp aside) -- for "unsaved changes".
  function sameChoice(a, b) {
    return JSON.stringify(a.items) === JSON.stringify(b.items);
  }

  return {
    VERSION, MODULES, BY_ID, NOTE_TITLE_MAX, NOTE_BODY_MAX,
    isMonth, defaultOptions, defaultConfig, normalise,
    move, setEnabled, setOption, addNote, updateNote, removeNote,
    selected, forSave, limit, sameChoice,
  };
  }

  function storageKey(month) {
    if (!isMonth(month)) throw new Error(`BoardPack: not a month: ${month}`);
    return `moneypadel_board_pack_${month}`;
  }


  // The club pack is the module's own API (unchanged); the Player Pack's is
  // PLAYER.
  return Object.assign(forCatalogue(MODULES), { storageKey, forCatalogue, PLAYER: forCatalogue(PLAYER_MODULES) });
});
