// ===================== PLAYER STATUS: ACTIVE / TEMPORARILY INACTIVE / ARCHIVED =====================
// A player's standing in the group is one admin-set status, kept apart from
// every monthly or recent-games rule. Archived players leave every live list
// and selector and stay in their history; temporarily inactive players stay
// members (Shaun, 4 Oct: option A); a missing status is active, and the
// legacy Inactive flag reads as archived (Shaun, 4 Oct).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const PS = require('../assets/js/playerStatus.js');
const PlayerState = require('../assets/js/playerState.js');
const Engine = require('../assets/js/ratingEngine.js');
const Store = require('../assets/js/ratingStore.js');
const RF = require('../assets/js/replayForward.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');
const H = require('./helpers/uiHarness.js');

const ROOT = path.join(__dirname, '..');
const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-20T12:00:00.000Z';

// ---------- the model ----------

test('a missing status is active; the legacy Inactive flag reads as archived; a stored status wins', () => {
  assert.strictEqual(PS.statusOf({}), 'active');
  assert.strictEqual(PS.statusOf({ stored: undefined, legacyActive: true }), 'active');
  assert.strictEqual(PS.statusOf({ stored: null, legacyActive: undefined }), 'active');
  assert.strictEqual(PS.statusOf({ legacyActive: false }), 'archived');
  assert.strictEqual(PS.statusOf({ stored: 'active', legacyActive: false }), 'active', 'a restore beats the old flag');
  assert.strictEqual(PS.statusOf({ stored: 'temporarilyInactive' }), 'temporarilyInactive');
  assert.strictEqual(PS.statusOf({ stored: 'gone', legacyActive: true }), 'active', 'an unknown value is never read as anything but active');
  assert.deepStrictEqual(['active', 'temporarilyInactive', 'archived'].map(PS.isLive), [true, true, false]);
  assert.deepStrictEqual(['active', 'temporarilyInactive', 'archived'].map(PS.isPlaying), [true, false, false]);
});

test('status and the recent-games rule are separate: Idle is not a status, and a status is not a ranking', () => {
  const m = (d, players) => ({ date: d, players });
  const rated = [m('2026-09-10', ['A', 'B']), m('2026-09-12', ['A', 'B']), m('2026-09-14', ['B'])];
  const asOf = '2026-09-20T00:00:00Z';
  const idle = PlayerState.stateOf({ ratedMatches: rated, name: 'C', asOf, status: 'active' });
  assert.deepStrictEqual([idle.participation, idle.ranking, idle.label, idle.archived], ['ACTIVE', 'IDLE', 'Idle', false],
    'below the threshold: still an active member, merely Idle');
  const away = PlayerState.stateOf({ ratedMatches: rated, name: 'A', asOf, status: 'temporarilyInactive' });
  assert.deepStrictEqual([away.participation, away.rankable, away.label], ['INACTIVE', false, 'Temporarily inactive']);
  const gone = PlayerState.stateOf({ ratedMatches: rated, name: 'B', asOf, status: 'archived' });
  assert.deepStrictEqual([gone.participation, gone.rankable, gone.label, gone.archived], ['INACTIVE', false, 'Archived', true]);
});

// ---------- the record ----------

function record() {
  const b = buildBackfill();
  const plan = Store.buildWritePlan({ matches: b.matches, journey: b.replay.journey, state: b.replay.state, provenance: b.provenance });
  return { stored: { matches: plan[Store.COLLECTIONS.matches], journey: plan[Store.COLLECTIONS.journey], players: plan[Store.COLLECTIONS.players] }, provenance: b.provenance };
}

test('a status on the record survives every replay, and replaying unchanged still reproduces the record exactly', () => {
  const { stored, provenance } = record();
  const target = stored.players.find((d) => d.id === 'Max');
  Object.assign(target, { status: 'archived', statusChangedAt: '2026-10-04T10:00:00.000Z', statusChangedBy: 'Shaun' });
  assert.strictEqual(RF.verifyNoOp(stored, provenance).identical, true, 'the status is carried, not reported as a difference');
  const p = RF.plan({ stored, provenance, change: { type: 'append', match: {
    id: '2026-09-18-1', date: '2026-09-18', sourceIndex: 1, teamA: ['Shaun', 'Tom'], teamB: ['Max', 'KC'],
    sets: [[6, 3], [6, 4]], outcome: Engine.OUTCOME.A_WINS, type: 'doubles' } } });
  const written = p.writes[Store.COLLECTIONS.players].find((d) => d.id === 'Max');
  assert.ok(written, 'Max moved, so his document is rewritten');
  assert.deepStrictEqual([written.status, written.statusChangedAt, written.statusChangedBy], ['archived', '2026-10-04T10:00:00.000Z', 'Shaun']);
  // And the ratings the replay computes are the same as without a status.
  const plain = record();
  const p2 = RF.plan({ stored: plain.stored, provenance: plain.provenance, change: { type: 'append', match: {
    id: '2026-09-18-1', date: '2026-09-18', sourceIndex: 1, teamA: ['Shaun', 'Tom'], teamB: ['Max', 'KC'],
    sets: [[6, 3], [6, 4]], outcome: Engine.OUTCOME.A_WINS, type: 'doubles' } } });
  const strip = (d) => { const { status, statusChangedAt, statusChangedBy, ...rest } = d; return rest; };
  assert.deepStrictEqual(p.writes[Store.COLLECTIONS.players].map(strip), p2.writes[Store.COLLECTIONS.players].map(strip));
  assert.deepStrictEqual(p.writes[Store.COLLECTIONS.journey], p2.writes[Store.COLLECTIONS.journey]);
});

test('live surfaces ask the shared rule, never the full player list', () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  // "Who are you?", the directory, Compare and Find a Game draw their names
  // from livePlayers()/livePlayerNames(); name fields from allPlayerNames(),
  // which is the same live list.
  assert.match(read('shell.js'), /const names = livePlayerNames\(\);/);
  assert.match(read('features/players/directoryScreen.js'), /let rows = livePlayers\(\);/);
  assert.match(read('features/players/h2hScreen.js'), /const names = livePlayerNames\(\);/);
  assert.match(read('features/play/findGameScreen.js'), /livePlayers\(\)\.sort/);
  for (const f of ['shell.js', 'features/players/directoryScreen.js', 'features/players/h2hScreen.js', 'features/play/findGameScreen.js', 'features/play/fixturesScreen.js', 'features/games/gamesScreen.js']) {
    assert.doesNotMatch(read(f), /\[\.\.\.PLAYERS\]|PLAYERS\.map\(p\s*=>\s*p\.name\)/, `${f} lists every player, archived included`);
  }
  assert.match(read('app.js'), /function allPlayerNames\(\)\{ return livePlayerNames\(\); \}/);
});

// ---------- in the app ----------

async function openAdmin() {
  const app = await H.open({ now: NOW });
  await app.run(() => { isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun'; });
  return app;
}

// Everything a person could be offered as a current player, in one look.
function liveLook(name) {
  buildViewerSelector();
  const sheet = document.getElementById('viewerSelectorSheet');
  const who = [...sheet.querySelectorAll('.viewer-player-btn')].map((b) => b.dataset.name);
  sheet.remove();
  legacyTabBtn('players').click();
  const directory = document.getElementById('playersView').textContent.includes(name)
    && [...document.querySelectorAll('#playersView [data-player], #playersView .pdir-row')].some((e) => e.textContent.includes(name));
  legacyTabBtn('h2h').click();
  const compare = [...document.querySelectorAll('#h2hSelectA option')].map((o) => o.value);
  legacyTabBtn('findgame').click();
  const finder = [...document.querySelectorAll('#fgPlayerSelect option')].map((o) => o.value);
  return { who: who.includes(name), directory, compare: compare.includes(name), finder: finder.includes(name),
    names: allPlayerNames().includes(name), live: livePlayerNames().includes(name),
    rankings: (() => { legacyTabBtn('power').click(); activeTab = 'power'; selectedMonth = 'all'; activeTier = 'All'; minGames = 0; query = ''; includeInactive = true; includeIdle = true; render(); return [...document.querySelectorAll('#list .row .nm')].some((e) => e.textContent.trim() === name); })() };
}

maybe('archiving from Admin asks first, then removes the player from every live list -- and their history stays exactly as it was', async () => {
  const app = await openAdmin();
  try {
    const r = await app.run(async (liveLookSrc) => {
      const liveLookFn = new Function('return ' + liveLookSrc)();
      const name = 'Max';
      const before = { look: liveLookFn(name), rating: PLAYERS.find((p) => p.name === name).rating,
        facts: JSON.stringify(Object.values(V3_MATCH_FACTS).filter((f) => f.byPlayer[name])),
        league: JSON.stringify(leagueSplitRows('2026-09').find((s) => s.name === name)), docs: V3_STATE.rawPlayerDocs.length,
        journey: V3_JOURNEY.filter((e) => e.playerId === name).length };
      legacyTabBtn('manage').click(); renderManage();
      document.querySelector('[data-acc-toggle="players"]').click();
      document.querySelector(`[data-ptag-toggle="${name}"]`).click();
      const ask = [...document.querySelectorAll('.ptag-status-ask')].find((b) => b.dataset.playerId === 'Max');
      ask.click();
      const confirm = document.querySelector('.ptag-archive-confirm');
      const confirmText = confirm ? confirm.textContent.replace(/\s+/g, ' ').trim() : '';
      const statusBeforeYes = PLAYERS.find((p) => p.name === name).status;
      await setPlayerStatus('Max', 'archived');
      const after = { status: PLAYERS.find((p) => p.name === name).status, look: liveLookFn(name),
        rating: PLAYERS.find((p) => p.name === name).rating,
        facts: JSON.stringify(Object.values(V3_MATCH_FACTS).filter((f) => f.byPlayer[name])),
        league: JSON.stringify(leagueSplitRows('2026-09').find((s) => s.name === name)), docs: V3_STATE.rawPlayerDocs.length,
        journey: V3_JOURNEY.filter((e) => e.playerId === name).length,
        stored: V3_STATE.rawPlayerDocs.find((d) => d.id === name).status };
      // History: an old result still names him, and its scorecard opens.
      const old = getAllApprovedMatches().find((m) => m.winners.concat(m.losers).includes(name));
      legacyTabBtn('games').click();
      const games = document.getElementById('gamesView').textContent.includes(name);
      const card = matchScorecardFor(old.id);
      const inCard = card.teams.some((t) => t.players.some((p) => p.name === name && p.movement !== null));
      openSheet(name);
      const profile = document.getElementById('overlay').classList.contains('show') && document.getElementById('overlay').textContent.includes(name);
      closeSheet();
      // A new game with him is refused, in words.
      const req = await submitGameRequest({ names: ['Shaun', 'Tom', name, 'KC'], requestedBy: 'Shaun' });
      // Restored: back everywhere, the same record, no duplicate.
      await setPlayerStatus('Max', 'active');
      const restored = { status: PLAYERS.find((p) => p.name === name).status, look: liveLookFn(name), docs: V3_STATE.rawPlayerDocs.length,
        ids: V3_STATE.rawPlayerDocs.filter((d) => d.id === 'Max').length };
      return { before, after, confirmText, statusBeforeYes, games, inCard, profile, req, restored, unknown: /Unknown Player/i.test(document.body.textContent) };
    }, liveLook.toString());
    assert.match(r.confirmText, /Archive Max\?/);
    assert.match(r.confirmText, /historical matches, rankings and statistics will be preserved/);
    assert.doesNotMatch(r.confirmText, /delete/i, 'never implies deletion');
    assert.strictEqual(r.statusBeforeYes, 'active', 'nothing changes until the archive is confirmed');
    assert.deepStrictEqual(Object.values(r.before.look), [true, true, true, true, true, true, true], JSON.stringify(r.before.look));
    assert.strictEqual(r.after.status, 'archived');
    assert.strictEqual(r.after.stored, 'archived', 'written on his own record');
    assert.deepStrictEqual(r.after.look, { who: false, directory: false, compare: false, finder: false, names: false, live: false, rankings: false });
    // History and calculations are untouched.
    assert.strictEqual(r.after.rating, r.before.rating);
    assert.strictEqual(r.after.facts, r.before.facts, 'every recorded match fact is identical');
    assert.strictEqual(r.after.league, r.before.league, 'a past League row is identical');
    assert.strictEqual(r.after.journey, r.before.journey, 'the Rating Journey is intact');
    assert.strictEqual(r.after.docs, r.before.docs, 'no record removed or added');
    assert.ok(r.games && r.inCard && r.profile, 'old results, their scorecard and the profile still show him');
    assert.strictEqual(r.unknown, false);
    assert.strictEqual(r.req.ok, false);
    assert.match(r.req.message, /Max is archived/);
    assert.deepStrictEqual(Object.values(r.restored.look), [true, true, true, true, true, true, true]);
    assert.strictEqual(r.restored.status, 'active');
    assert.deepStrictEqual([r.restored.docs, r.restored.ids], [r.before.docs, 1], 'restored, not recreated');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a device that chose a player who is then archived is asked "Who are you?" again', async () => {
  const app = await openAdmin();
  try {
    const r = await app.run(async () => {
      setCurrentViewer('Max');
      const before = (getCurrentViewer() || {}).name;
      await setPlayerStatus('Max', 'archived');
      return { before, after: getCurrentViewer() };
    });
    assert.strictEqual(r.before, 'Max');
    assert.strictEqual(r.after, null);
  } finally { await app.close(); }
});

maybe('a temporarily inactive player stays a member: in "Who are you?", the directory and name fields, out of suggestions and the live ranking -- and reactivates', async () => {
  const app = await openAdmin();
  try {
    const r = await app.run(async () => {
      await setPlayerStatus('Max', 'temporarilyInactive');
      buildViewerSelector();
      const who = [...document.querySelectorAll('#viewerPlayerList .viewer-player-btn')].some((b) => b.dataset.name === 'Max');
      document.getElementById('viewerSelectorSheet').remove();
      legacyTabBtn('players').click();
      const row = [...document.querySelectorAll('#playersView .pdir-row')].find((e) => e.textContent.includes('Max'));
      const tag = row ? row.textContent.includes('Temporarily inactive') : false;
      const out = { status: PLAYERS.find((p) => p.name === 'Max').status, who, inDirectory: !!row, tag,
        names: allPlayerNames().includes('Max'), suggested: INACTIVE_PLAYERS.has('Max'),
        rankable: playerStateOf('Max').rankable, label: playerStateOf('Max').label };
      const req = await submitGameRequest({ names: ['Shaun', 'Tom', 'Max', 'KC'], requestedBy: 'Shaun' });
      out.requestOk = req.ok;
      await setPlayerStatus('Max', 'active');
      out.back = [PLAYERS.find((p) => p.name === 'Max').status, INACTIVE_PLAYERS.has('Max')];
      return out;
    });
    assert.deepStrictEqual(r, { status: 'temporarilyInactive', who: true, inDirectory: true, tag: true, names: true,
      suggested: true, rankable: false, label: 'Temporarily inactive', requestOk: true, back: ['active', false] });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('not qualifying in a month never hides a player: still active, still in every live list', async () => {
  const app = await H.open({ now: NOW });
  try {
    const r = await app.run(() => {
      const race = buildMonthlyRace('2026-09').table;
      const unq = race.find((x) => !x.qualified);
      const name = unq.playerId;
      buildViewerSelector();
      const who = [...document.querySelectorAll('#viewerPlayerList .viewer-player-btn')].some((b) => b.dataset.name === name);
      return { name, qualified: unq.qualified, status: playerStatusOf(name), who, live: livePlayerNames().includes(name) };
    });
    assert.ok(r.name);
    assert.deepStrictEqual([r.qualified, r.status, r.who, r.live], [false, 'active', true, true]);
  } finally { await app.close(); }
});
