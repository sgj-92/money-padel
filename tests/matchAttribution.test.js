// ===================== MATCH ATTRIBUTION =====================
// Every rated game read "Submitted by unknown" once the Games log moved onto
// the v3 record (17 Sep): the v3 match documents have no submitter, and
// approving a submission removed the only copy of it. These pin where the
// line under each game comes from now (domain/matches/matchAttribution.js),
// and that approving a game keeps its submitter.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./helpers/uiHarness.js');
const MA = require('../assets/js/domain/matches/matchAttribution.js');

const maybe = H.available() ? test : test.skip;
const CSV = path.join(__dirname, 'fixtures', 'money_padel_matches_2026-09-16.csv');
// Money Padel's own record of who submitted its early games (clubs/moneypadel).
const HISTORY = MA.historyMap(require('../assets/js/clubs/moneypadel/history.js').CLUB_HISTORY.submitters);

test('the historical table is exactly the 16 Sep export\'s "Submitted By" column', () => {
  const lines = fs.readFileSync(CSV, 'utf8').trim().split(/\r?\n/).slice(1);
  const fromCsv = {};
  // Match ID is the first column and Submitted By the last; neither is quoted.
  lines.forEach((l) => { fromCsv[l.slice(0, l.indexOf(','))] = l.slice(l.lastIndexOf(',') + 1); });
  const table = Object.fromEntries(Object.entries(HISTORY).map(([id, who]) => [id, who === null ? '' : who]));
  assert.deepStrictEqual(table, fromCsv);
  assert.strictEqual(Object.keys(table).length, 150);
});

test('a seeded game says what the Games log said before the move', () => {
  assert.deepStrictEqual(MA.describe('2026-09-02-3', { history: HISTORY }), { kind: 'submitted', name: 'Tom', text: 'Submitted by Tom' });
  assert.strictEqual(MA.describe('2026-06-02-1', { history: HISTORY }).text, 'Historical record');
  const shaun = Object.keys(HISTORY).find((id) => HISTORY[id] === 'Shaun');
  assert.strictEqual(MA.describe(shaun, { history: HISTORY }).text, 'Submitted by Shaun');
  // The export itself had no name for this one.
  assert.strictEqual(MA.describe('2026-07-20-3', { history: HISTORY }).kind, 'unknown');
});

test('a stored submitter wins; then the journey says who approved or that it was imported; never "unknown"', () => {
  const stored = { '2026-10-01-1': { submittedBy: 'Kaz' } };
  const journey = [
    { matchId: '2026-09-21-1', createdBy: 'Shaun', source: 'Approved from a submission' },
    // A later correction does not change how the game arrived.
    { matchId: '2026-09-21-1', createdBy: 'Board', source: 'Historical Match Correction' },
    { matchId: '2026-09-16-2', createdBy: 'import-production-matches', source: 'production match-facts export production-matches-export.json' },
  ];
  assert.strictEqual(MA.describe('2026-10-01-1', { stored, journey }).text, 'Submitted by Kaz');
  assert.strictEqual(MA.describe('2026-09-21-1', { stored, journey }).text, 'Approved by Shaun');
  assert.strictEqual(MA.describe('2026-09-16-2', { stored, journey }).text, 'Added from the old app');
  assert.strictEqual(MA.describe('2026-10-02-1', { stored, journey }).text, 'Submitter not recorded');
  // A stored entry beats the historical table too.
  assert.strictEqual(MA.describe('2026-06-02-1', { stored: { '2026-06-02-1': { submittedBy: 'Len' } }, history: HISTORY }).text, 'Submitted by Len');
});

test('the entry kept at approval names the submitter and the approver', () => {
  const e = MA.entryFor({ submittedBy: 'Tom', submittedAt: '2026-10-05T09:00:00.000Z' },
    { matchId: '2026-10-05-1', approvedBy: 'Shaun', approvedAt: '2026-10-05T10:00:00.000Z' });
  assert.deepStrictEqual(e, { matchId: '2026-10-05-1', submittedBy: 'Tom', submittedAt: '2026-10-05T09:00:00.000Z',
    approvedBy: 'Shaun', approvedAt: '2026-10-05T10:00:00.000Z' });
  assert.strictEqual(MA.entryFor(null, { matchId: 'x' }).submittedBy, null);
});

maybe('no rated game on the Games tab reads "Submitted by unknown"', async () => {
  const app = await H.open();
  try {
    const lines = await app.run(() => {
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      selectedMonth = 'all'; renderGamesTab();
      return [...document.querySelectorAll('#gamesView .game-card-meta, #gamesView [data-game-card]')]
        .map((e) => e.textContent.replace(/\s+/g, ' '));
    });
    assert.ok(lines.length > 0);
    assert.ok(!lines.some((t) => /Submitted by unknown/.test(t)), 'a game still reads "Submitted by unknown"');
    assert.ok(lines.some((t) => /Historical record|Submitted by \w/.test(t)), 'the seeded games say who submitted them');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('approving a submission keeps who submitted it, and the rated game says so', async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Shaun';
      extraMatchesState.push({
        id: 'usr_attr_1', date: '2026-09-18', winners: ['Shaun', 'Tom'], losers: ['Max', 'KC'],
        sets: [[6, 3], [6, 4]], type: 'doubles', note: '', status: 'pending', submittedBy: 'Tester',
        submittedAt: '2026-09-18T10:00:00.000Z',
      });
      recomputeAll();
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      selectedMonth = 'all';
      await prepareApproval('usr_attr_1');
      const matchId = approvalPlan.matchId;
      await commitApproval();
      renderGamesTab();
      const card = [...document.querySelectorAll('#gamesView [data-game-card]')].find((e) => e.dataset.gameCard === matchId);
      const saved = window.__writes.filter((w) => w.id === 'moneypadel_match_attribution').map((w) => JSON.parse(w.doc.value));
      return { matchId, card: card ? card.textContent.replace(/\s+/g, ' ') : null, saved: saved.at(-1) || null,
        pendingLeft: extraMatchesState.some((m) => m.id === 'usr_attr_1') };
    });
    assert.ok(r.saved, 'the attribution was not saved');
    assert.strictEqual(r.saved[r.matchId].submittedBy, 'Tester');
    assert.strictEqual(r.saved[r.matchId].approvedBy, 'Shaun');
    assert.match(r.card, /Submitted by Tester/);
    assert.strictEqual(r.pendingLeft, false, 'the submission still goes once it is rated');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a stored attribution is read back at start-up', async () => {
  const app = await H.open({ club: { moneypadel_match_attribution: { '2026-06-02-1': { matchId: '2026-06-02-1', submittedBy: 'Len' } } } });
  try {
    const t = await app.run(() => {
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      selectedMonth = 'all'; renderGamesTab();
      const card = [...document.querySelectorAll('#gamesView [data-game-card]')].find((e) => e.dataset.gameCard === '2026-06-02-1');
      return card ? card.textContent.replace(/\s+/g, ' ') : null;
    });
    assert.ok(t, 'the game is listed');
    assert.match(t, /Submitted by Len/);
  } finally { await app.close(); }
});
