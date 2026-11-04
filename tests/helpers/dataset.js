// Shared fixtures for the historical replay tests: parses the authoritative
// match export, and reads BASE_TIERS straight out of app.js so the seeding
// used here can never silently drift from the seeding the app uses.

const fs = require('node:fs');
const path = require('node:path');
const E = require('../../assets/js/ratingEngine.js');

const ROOT = path.join(__dirname, '..', '..');

function parseCsv(text) {
  const rows = [];
  let field = '', row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

// Team A is the winning side for every decided match in this export, and the
// score is always recorded from Team A's perspective. For a draw the side
// assignment is whatever the export recorded -- arbitrary, but fixed and
// carried through deterministically.
function toMatch(row) {
  const isDraw = row['Draw'].trim() === 'Yes';
  const id = row['Match ID'].trim();
  return {
    id,
    // Match IDs are `YYYY-MM-DD-N`; N is the export's own same-date sequence and
    // is the explicit tie-break §6.1 requires. Retrieval order never decides it.
    sourceIndex: parseInt(id.slice(id.lastIndexOf('-') + 1), 10),
    date: row['Date'],
    teamA: row['Team A'].split('&').map((s) => s.trim()),
    teamB: row['Team B'].split('&').map((s) => s.trim()),
    sets: row['Score'].split(',').map((s) => s.trim().split('-').map(Number)),
    outcome: isDraw ? E.OUTCOME.DRAW : E.OUTCOME.A_WINS,
    type: row['Type'],
    drawSideAssignmentArbitrary: isDraw,
  };
}

function loadAllMatches() {
  const csv = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'money_padel_matches_2026-09-16.csv'), 'utf8');
  return parseCsv(csv).map(toMatch);
}

// BASE_TIERS is read out of Money Padel's own record (the file the app loads
// for it) rather than copied, so there is exactly one source of truth.
function loadBaseTiers() {
  return { ...require('../../assets/js/clubs/moneypadel/history.js').CLUB_HISTORY.baseTiers };
}

// Experiments 11 and 12 ran against the export as it stood on 2026-09-11,
// plus one 2026-09-13 match (MK & Rocky def Max & Harry) that was added by
// hand from a screenshot. That is 143 + 1 = the 144 matches the spec cites.
const EXPERIMENT_CUTOFF = '2026-09-11';

// Experiments 11/12/13B ran before the export carried Match IDs, against the
// row order of the day. On exactly three dates the new ID sequence disagrees
// with that order -- the rows submitted later now sort first, so the sequence
// is an artifact of the export, not the order the matches were played. Neither
// ordering is "true": the source has date granularity only.
//
// The engine-equivalence proof (§7.1) has to replay the ordering the
// experiments actually used, so it is recorded here rather than lost. Live v3
// replay uses plain Match ID order.
const EXPERIMENT_TIE_BREAK = {
  '2026-06-22': ['2026-06-22-2', '2026-06-22-1'],
  '2026-07-18': ['2026-07-18-2', '2026-07-18-1'],
  '2026-08-19': ['2026-08-19-3', '2026-08-19-4', '2026-08-19-1', '2026-08-19-2'],
};

function applyExperimentTieBreak(matches) {
  return matches.map((m) => {
    const order = EXPERIMENT_TIE_BREAK[m.date];
    if (!order) return m;
    const i = order.indexOf(m.id);
    if (i === -1) throw new Error('Unlisted match on a re-ordered date: ' + m.id);
    return { ...m, sourceIndex: i };
  });
}

// `ordering`: 'experiment' replays the tie-break the experiments used (for
// Stage 1 equivalence); 'canonical' (default) uses Match ID order.
function experimentDataset(ordering = 'canonical') {
  const all = loadAllMatches();
  const manual = all.find((m) => m.date === '2026-09-13' && m.teamA.join(' & ') === 'MK & Rocky');
  if (!manual) throw new Error('The manually added 2026-09-13 MK & Rocky match is missing.');
  const ds = all.filter((m) => m.date <= EXPERIMENT_CUTOFF).concat([manual]);
  return ordering === 'experiment' ? applyExperimentTieBreak(ds) : ds;
}

// Fatch is seeded at Tier C in BOTH stages: the legacy BASE_STARTING_TIER
// carried {"Fatch":"C"}, so Experiments 11/12 already used it. Only Shaun and
// Tom were seeded from their current tier in Stage 1, which is why §7.3 lists
// a final-rating shift for those two and not for Fatch.
const HISTORICAL_SEED = {
  Shaun: { tier: 'C', classificationStatus: E.CLASSIFICATION.PROVISIONAL },
  Tom: { tier: 'C' },
  Fatch: { tier: 'C' },
};

const HISTORICAL_EVENTS = [
  { playerId: 'Shaun', eventType: E.EVENT.INITIAL_CLASSIFICATION_CORRECTION, effectiveDate: '2026-07-01', newTier: 'B', reasonCode: 'UNKNOWN_NEW_PLAYER' },
  { playerId: 'Tom', eventType: E.EVENT.PROMOTION, effectiveDate: '2026-07-01', newTier: 'B' },
  { playerId: 'Fatch', eventType: E.EVENT.PROMOTION, effectiveDate: '2026-08-01', newTier: 'B' },
];

function buildInitialisations(matches, { historical }) {
  const tiers = loadBaseTiers();
  const names = new Set();
  matches.forEach((m) => { m.teamA.forEach((n) => names.add(n)); m.teamB.forEach((n) => names.add(n)); });
  return [...names].map((playerId) => {
    if (historical && HISTORICAL_SEED[playerId]) return { playerId, ...HISTORICAL_SEED[playerId] };
    if (playerId === 'Fatch') return { playerId, tier: 'C' };
    return { playerId, tier: tiers[playerId] || 'B' };
  });
}

// Stage 1 (§7.1): the experiments' own assumptions -- proves engine equivalence.
// Stage 2 (§7.3): the authoritative §5.3 historical classifications.
function replayStage(stage, matches, ordering = 'canonical') {
  const ms = matches || experimentDataset(ordering);
  const historical = stage === 2;
  return E.replay({
    matches: ms,
    initialisations: buildInitialisations(ms, { historical }),
    events: historical ? HISTORICAL_EVENTS : [],
  });
}

function monthlyPct(journey, playerId, month) {
  const row = E.calculateMonthlyPerformance(journey).find((x) => x.playerId === playerId && x.month === month);
  return row ? row.monthlyPerformance * 100 : null;
}

module.exports = {
  parseCsv, loadAllMatches, loadBaseTiers, experimentDataset, replayStage, monthlyPct,
  EXPERIMENT_CUTOFF, EXPERIMENT_TIE_BREAK, HISTORICAL_EVENTS, HISTORICAL_SEED,
};
