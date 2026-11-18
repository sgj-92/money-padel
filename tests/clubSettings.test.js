// ===================== RANKING SETTINGS (ADMIN) =====================
// Shaun, 18 Nov: "Allow me to change the number of idle games required to
// show in rankings, within settings. Also allow me to amend the default
// settings for minimum games for rankings, king of tier etc."

const test = require('node:test');
const assert = require('node:assert');
const S = require('../assets/js/domain/settings/clubSettings.js');
const PS = require('../assets/js/playerState.js');
const { CLUBS } = require('../assets/js/config/club.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

test('defaults come from the community, a stored value overrides them, and a bad one never does', () => {
  assert.deepStrictEqual(S.defaults(CLUBS.moneypadel), { rankedMinMatches: 2, rankedWindowDays: 30, rankingsMinAllTime: 10, rankingsMinPeriod: 5, kingMinGames: 10, raceMinMatches: 5 });
  assert.strictEqual(S.defaults(CLUBS.padelchampionships).raceMinMatches, 4, 'a quarter has its own minimum');
  const e = S.effective(CLUBS.moneypadel, { rankedMinMatches: 1, kingMinGames: 0, rankingsMinAllTime: 'x', raceMinMatches: 2.5 });
  assert.strictEqual(e.rankedMinMatches, 1);
  assert.strictEqual(e.kingMinGames, 10, 'out of range: the default');
  assert.strictEqual(e.rankingsMinAllTime, 10);
  assert.strictEqual(e.raceMinMatches, 5, 'not a whole number: the default');
  const f = S.fromForm(CLUBS.moneypadel, { rankedMinMatches: '1', rankedWindowDays: '30', kingMinGames: '6' });
  assert.deepStrictEqual(f, { store: { rankedMinMatches: 1, kingMinGames: 6 }, problems: [] }, 'only what differs from the default is kept');
  assert.match(S.fromForm(CLUBS.moneypadel, { rankedWindowDays: '3' }).problems[0], /Ranked window: a whole number from 7 to 365/);
});

test('the Ranked rule follows the setting', () => {
  const matches = [{ date: '2026-11-10', players: ['Ali'] }];
  const asOf = '2026-11-18T12:00:00Z';
  try {
    assert.strictEqual(PS.stateOf({ ratedMatches: matches, name: 'Ali', asOf }).ranking, 'IDLE');
    PS.configure({ minMatches: 1, windowDays: 30 });
    assert.strictEqual(PS.stateOf({ ratedMatches: matches, name: 'Ali', asOf }).ranking, 'RANKED');
    assert.strictEqual(PS.thresholdText(), '1+ match in the last 30 days');
    PS.configure({ minMatches: 1, windowDays: 7 });
    assert.strictEqual(PS.stateOf({ ratedMatches: matches, name: 'Ali', asOf }).ranking, 'IDLE', 'outside a 7-day window');
  } finally { PS.configure({}); }
  assert.strictEqual(PS.thresholdText(), '2+ matches in the last 30 days');
});

maybe('Admin › Ranking settings: saved for the club, in effect at once, back to defaults in one tap', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z', viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      document.querySelector('#tabrow .tab-btn[data-tab="manage"]').click();
      adminOpenSections.settings = true; renderManage();
      const ranked = () => PLAYERS.filter((p) => playerStateOf(p.name).rankable).length;
      const before = { ranked: ranked(), allMin: defaultRankingMinGames('all'), race: raceMinMatches(), kings: Object.keys(kingsOfTiersFor('all') || {}).length };
      const set = (k, v) => { document.getElementById(`cs-${k}`).value = v; };
      set('rankedMinMatches', '0');
      document.getElementById('csSave').click(); await new Promise((res) => setTimeout(res, 30));
      const refused = document.getElementById('csMessage').textContent;
      set('rankedMinMatches', '1'); set('rankingsMinAllTime', '3'); set('kingMinGames', '100'); set('raceMinMatches', '2');
      document.getElementById('csSave').click(); await new Promise((res) => setTimeout(res, 50));
      const stored = JSON.parse((window.__writes.filter((w) => w.id === 'moneypadel_settings').pop() || { doc: { value: '{}' } }).doc.value);
      const after = { ranked: ranked(), allMin: defaultRankingMinGames('all'), race: raceMinMatches(), kings: kingsOfTiersFor('all'), msg: document.getElementById('csMessage').textContent,
        listMin: document.getElementById('minGamesInput').value, rule: PlayerState.thresholdText() };
      document.getElementById('csReset').click(); await new Promise((res) => setTimeout(res, 50));
      const reset = { ranked: ranked(), allMin: defaultRankingMinGames('all'), stored: window.__writes.filter((w) => w.id === 'moneypadel_settings').pop().doc.value };
      return { before, refused, stored, after, reset };
    });
    assert.match(r.refused, /Matches to be Ranked \(not Idle\): a whole number from 1 to 20/);
    assert.deepStrictEqual(r.stored, { rankedMinMatches: 1, rankingsMinAllTime: 3, kingMinGames: 100, raceMinMatches: 2 });
    assert.ok(r.after.ranked >= r.before.ranked, 'one match in the window is enough now');
    assert.strictEqual(r.after.rule, '1+ match in the last 30 days');
    assert.strictEqual(r.after.allMin, 3);
    assert.strictEqual(r.after.race, 2);
    assert.strictEqual(r.after.kings, null, 'nobody has 100 games: no Kings');
    assert.match(r.after.msg, /Settings saved/);
    assert.strictEqual(r.reset.allMin, 10);
    assert.strictEqual(r.reset.ranked, r.before.ranked);
    assert.strictEqual(r.reset.stored, '{}');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
