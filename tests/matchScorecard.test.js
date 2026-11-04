// The completed-match scorecard: one canonical card per rated match. Every
// rating figure on it is read back from what the engine recorded when it rated
// the match -- never recomputed in the browser -- so these tests hold it to the
// engine's own record, and to staying the same when later matches, ratings or
// tiers move.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../assets/js/ratingEngine.js');
const MF = require('../assets/js/matchFacts.js');
const SC = require('../assets/js/domain/matches/matchScorecard.js');
const { buildBackfill } = require('../scripts/moneypadel/seed-beta.js');
const H = require('./helpers/uiHarness.js');

const ROOT = path.join(__dirname, '..');
const r1 = (v) => Math.round(v * 10) / 10;

let cached = null;
function backfill() {
  if (!cached) {
    const b = buildBackfill();
    cached = { b, facts: MF.index(b.replay.journey), events: b.replay.journey.filter((e) => e.eventType === Engine.EVENT.MATCH_UPDATE) };
  }
  return cached;
}

// The app's match shape (V3Bridge.toLegacyMatchShape): team A first, which is
// the winners on a decided match.
const appMatch = (m) => ({
  id: m.id, date: m.date, winners: m.teamA, losers: m.teamB, sets: m.sets,
  type: m.type || 'doubles', isDraw: m.outcome === Engine.OUTCOME.DRAW,
});

test('every rated match: all players, the right teams, and the engine\'s own figures', () => {
  const { b, facts, events } = backfill();
  const evOf = {};
  events.forEach((e) => { evOf[e.matchId + '|' + e.playerId] = e; });
  let draws = 0;
  b.matches.forEach((m) => {
    const vm = SC.build(appMatch(m), facts[m.id], {});
    assert.strictEqual(vm.rated, true, `${m.id} is rated`);
    assert.strictEqual(vm.date, m.date);
    assert.deepStrictEqual(vm.teams[0].names.slice().sort(), m.teamA.slice().sort(), `${m.id}: team 1`);
    assert.deepStrictEqual(vm.teams[1].names.slice().sort(), m.teamB.slice().sort(), `${m.id}: team 2`);
    assert.strictEqual(vm.scoreText, m.sets.map((s) => s.join('-')).join(', '));
    if (m.outcome === Engine.OUTCOME.DRAW) { draws++; assert.strictEqual(vm.winner, null); assert.ok(vm.isDraw); assert.ok(!vm.teams[0].won && !vm.teams[1].won, 'a draw is won by nobody'); }
    else { assert.strictEqual(vm.winner, 1); assert.ok(vm.teams[0].won && !vm.teams[1].won); }

    // Expected reconciles to the engine: the logistic on the two pairs'
    // pre-match ratings, exactly as recorded on the events.
    const preOf = (t) => t.players.reduce((s, p) => s + p.preRating, 0) / t.players.length;
    const [t1, t2] = vm.teams;
    assert.ok(Math.abs(Engine.expectedScore(preOf(t1), preOf(t2)) - t1.expected) < 1e-9, `${m.id}: expected`);
    assert.ok(Math.abs(t1.expected + t2.expected - 1) < 1e-9);
    // Actual reconciles to the engine's own definition (0.80 game share +
    // 0.20 result), from the match's own sets and outcome.
    const act = Engine.actualScores(m.sets, m.outcome);
    assert.ok(Math.abs(act.a - t1.actual) < 1e-9 && Math.abs(act.b - t2.actual) < 1e-9, `${m.id}: actual`);

    vm.teams.forEach((t) => {
      // The pp maths: the printed difference is the printed actual minus the
      // printed expected, and the engine's residual to within that rounding.
      assert.strictEqual(t.expectedPct, r1(t.expected * 100));
      assert.strictEqual(t.actualPct, r1(t.actual * 100));
      assert.strictEqual(t.vsExpectedPp, r1(t.actualPct - t.expectedPct));
      assert.ok(Math.abs(t.residualPp - (t.actual - t.expected) * 100) < 1e-9);
      assert.ok(Math.abs(t.vsExpectedPp - t.residualPp) <= 0.1 + 1e-9, `${m.id}: ${t.vsExpectedPp} vs ${t.residualPp}`);
      // Game share is context, read from the same sets the engine scored.
      assert.strictEqual(t.games + t.opponentGames, m.sets.reduce((s, x) => s + x[0] + x[1], 0));
      t.players.forEach((p) => {
        const e = evOf[m.id + '|' + p.name];
        assert.ok(e, `${m.id}: ${p.name} has an event`);
        assert.strictEqual(e.side, t.side);
        assert.strictEqual(p.movement, r1(e.ratingDelta), `${m.id}: ${p.name} movement`);
        assert.strictEqual(p.preRating, e.preMatchRating);
        assert.strictEqual(p.postRating, e.postMatchRating);
        assert.strictEqual(p.tier, e.tierAtEvent);
        assert.strictEqual(p.tierSource, 'event');
        // The movement is K x the side's difference -- the residual on the card.
        assert.ok(Math.abs(e.kUsed * t.residual - e.ratingDelta) < 1e-9);
      });
    });
  });
  assert.ok(draws > 0, 'the record has draws, and they get a scorecard too');
});

test('the tier on the card is the tier held that day, and agrees with the dated tier history', () => {
  const { b, facts } = backfill();
  let moved = 0;
  b.matches.forEach((m) => {
    const vm = SC.build(appMatch(m), facts[m.id], {});
    vm.teams.forEach((t) => t.players.forEach((p) => {
      assert.strictEqual(p.tier, b.history.tierAsOf(p.name, m.date), `${m.id}: ${p.name}`);
      if (p.tier !== b.history.currentTier(p.name)) moved++;
    }));
  });
  // A resolver that only knows today's tiers is ignored when the event
  // recorded the tier: a June card does not change when someone is promoted.
  const m = b.matches[0];
  const vm = SC.build(appMatch(m), facts[m.id], { tierOf: () => 'S' });
  vm.teams.forEach((t) => t.players.forEach((p) => assert.notStrictEqual(p.tier, 'S')));
  // The record has players whose tier has since changed, so this is a real
  // test of "on the day" rather than of a tier nobody ever left.
  assert.ok(moved > 0, 'some cards show a tier the player no longer holds');
});

test('historically stable: later matches, ratings and tier moves never change an earlier scorecard', () => {
  const { b, facts } = backfill();
  // Replay only the first 40 matches: what the club's record looked like then.
  const early = b.matches.slice(0, 40);
  const then = Engine.replay({
    matches: early,
    initialisations: b.replay.journey.filter((e) => e.eventType === Engine.EVENT.PLAYER_INITIALISED && e.effectiveDate <= early[early.length - 1].date)
      .map((e) => ({ playerId: e.playerId, tier: e.newTier, classificationStatus: e.newClassificationStatus, effectiveDate: e.effectiveDate, rating: e.newPowerRating })),
    events: [],
  });
  const thenFacts = MF.index(then.journey);
  // Only matches before any tier decision are comparable on a replay that
  // carries no decisions; those are what this pins.
  const firstDecision = b.replay.journey.filter((e) => e.eventType !== Engine.EVENT.MATCH_UPDATE && e.eventType !== Engine.EVENT.PLAYER_INITIALISED)
    .map((e) => e.effectiveDate).sort()[0] || '9999';
  const checked = early.filter((m) => m.date < firstDecision);
  assert.ok(checked.length >= 10, `enough early matches to compare (${checked.length})`);
  checked.forEach((m) => {
    const now = SC.build(appMatch(m), facts[m.id], {});
    const before = SC.build(appMatch(m), thenFacts[m.id], {});
    assert.deepStrictEqual(now, before, `${m.id}: the scorecard read the same before the later matches existed`);
  });
});

test('an unrated match gets a card that says so -- nothing is estimated', () => {
  const vm = SC.build({ id: 'x', date: '2026-10-01', winners: ['Ann', 'Bob'], losers: ['Cat', 'Dan'], sets: [[6, 4], [6, 3]], type: 'doubles', isDraw: false },
    null, { tierOf: (n) => ({ Ann: 'A', Bob: 'B', Cat: 'B', Dan: 'C' })[n] });
  assert.strictEqual(vm.rated, false);
  assert.strictEqual(vm.winner, 1);
  assert.deepStrictEqual(vm.teams.map((t) => t.players.map((p) => [p.name, p.tier, p.tierSource])),
    [[['Ann', 'A', 'history'], ['Bob', 'B', 'history']], [['Cat', 'B', 'history'], ['Dan', 'C', 'history']]]);
  vm.teams.forEach((t) => {
    ['expected', 'actual', 'residual', 'expectedPct', 'actualPct', 'vsExpectedPp', 'residualPp'].forEach((k) => assert.strictEqual(t[k], null, k));
    t.players.forEach((p) => assert.strictEqual(p.movement, null));
  });
  assert.strictEqual(vm.teams[0].games, 12);
  // An unknown tier stays unknown, and so does the game type.
  const unknown = SC.build({ id: 'y', date: '2026-10-01', winners: ['Ann', 'Zed'], losers: ['Cat', 'Dan'], sets: [[6, 4]], isDraw: false }, null,
    { tierOf: (n) => ({ Ann: 'A', Cat: 'B', Dan: 'C' })[n] });
  assert.strictEqual(unknown.teams[0].players.find((p) => p.name === 'Zed').tier, null);
  assert.strictEqual(unknown.matchup, null);
});

test('facts that do not line up with the teams are not shown against the wrong team', () => {
  const { b, facts } = backfill();
  const m = b.matches.find((x) => x.outcome !== Engine.OUTCOME.DRAW);
  const swapped = { ...appMatch(m), winners: [m.teamA[0], m.teamB[0]], losers: [m.teamA[1], m.teamB[1]] };
  // Mixed both ways round: each team holds one player from each engine side.
  const crossed = { ...appMatch(m), winners: [m.teamA[0], m.teamB[0]], losers: [m.teamB[1], m.teamA[1]] };
  [swapped, crossed].forEach((x) => {
    const vm = SC.build(x, facts[m.id], {});
    assert.strictEqual(vm.rated, false);
    vm.teams.forEach((t) => { assert.strictEqual(t.expected, null); t.players.forEach((p) => assert.strictEqual(p.movement, null)); });
  });
});

test('Result Card: every figure is a field of the scorecard, copied -- one source, two views', () => {
  const { b, facts } = backfill();
  const seen = {};
  b.matches.forEach((m) => {
    const vm = SC.build(appMatch(m), facts[m.id], {});
    const card = SC.resultCard(vm);
    const hero = vm.teams[card.heroNo - 1], other = vm.teams[2 - card.heroNo];
    seen[card.story.key] = (seen[card.story.key] || 0) + 1;
    if (!vm.isDraw) assert.strictEqual(card.heroNo, 1, `${m.id}: the winners are the heroes`);
    else assert.ok(hero.vsExpectedPp >= other.vsExpectedPp, `${m.id}: a draw leads with the side that beat expectation`);
    assert.deepStrictEqual(card.heroes, hero.players.map((p) => ({ name: p.name, tier: p.tier })));
    assert.deepStrictEqual(card.opponents, other.players.map((p) => ({ name: p.name, tier: p.tier })));
    assert.deepStrictEqual(card.stats, { names: hero.names, expectedPct: hero.expectedPct, performancePct: hero.actualPct, vsExpectedPp: hero.vsExpectedPp });
    assert.deepStrictEqual(card.sets, vm.sets.map((s) => (card.heroNo === 1 ? s : [s[1], s[0]])));
    const gained = !vm.isDraw && hero.players.every((p) => p.movement > 0);
    assert.deepStrictEqual(card.rewards, gained ? hero.players.map((p) => ({ name: p.name, movement: p.movement })) : [],
      `${m.id}: rewards are the winners' own gains, or nothing -- and nothing on a draw`);
    card.rewards.forEach((rw) => assert.ok(rw.movement > 0));
    assert.strictEqual(card.headline, vm.isDraw ? `${hero.names.join(' & ')} and ${other.names.join(' & ')}: all square` : `${hero.names.join(' & ')} ${hero.names.length === 1 ? 'takes' : 'take'} the win`);
    assert.deepStrictEqual(card.story, SC.story(vm, hero), 'the same match always tells the same story');
  });
  ['beat_the_odds', 'delivered', 'dominant', 'too_close', 'job_done', 'major_upset', 'all_square'].forEach((k) =>
    assert.ok(seen[k] > 0, `the club's record has a ${k} match`));
});

test('Result Card: the story thresholds, at their edges', () => {
  const T = SC.STORY;
  const vm = { isDraw: false };
  const hero = (E, R, G) => ({ expectedPct: E, vsExpectedPp: R, gameSharePct: G, games: 12, opponentGames: 5 });
  const key = (E, R, G) => SC.story(vm, hero(E, R, G)).key;
  assert.strictEqual(key(T.MAJOR_UPSET_BELOW - 0.1, 30, 60), 'major_upset');
  assert.strictEqual(key(T.MAJOR_UPSET_BELOW, 30, 60), 'beat_the_odds');
  assert.strictEqual(key(T.UNDERDOG_BELOW - 0.1, 5, 90), 'beat_the_odds', 'an underdog win is the story even when it was dominant');
  assert.strictEqual(key(T.UNDERDOG_BELOW, 5, T.DOMINANT_SHARE), 'dominant');
  assert.strictEqual(key(60, T.STATEMENT_PP, T.DOMINANT_SHARE - 0.1), 'statement');
  assert.strictEqual(key(60, T.STATEMENT_PP - 0.1, T.CLOSE_SHARE), 'too_close');
  assert.strictEqual(key(60, 0, T.CLOSE_SHARE + 0.1), 'delivered');
  assert.strictEqual(key(80, -0.1, 60), 'job_done');
  assert.strictEqual(SC.story({ isDraw: true }, hero(30, 10, 50)).key, 'all_square');
  // Unrated: only what the score says, nothing about expectation.
  assert.strictEqual(key(null, null, 80), 'dominant');
  assert.strictEqual(key(null, null, 52), 'too_close');
  assert.strictEqual(key(null, null, 62), 'win');
  // The thresholds themselves are a product decision (Ledger, 3 Oct): a
  // change to any of them is a change to what the club's cards say.
  assert.deepStrictEqual(T, { MAJOR_UPSET_BELOW: 35, UNDERDOG_BELOW: 50, DOMINANT_SHARE: 75, STATEMENT_PP: 20, CLOSE_SHARE: 55 });
});

test('Result Card for an unrated match: the result, the people and the score -- no figures', () => {
  const vm = SC.build({ id: 'x', date: '2026-10-01', winners: ['Ann', 'Bob'], losers: ['Cat', 'Dan'], sets: [[6, 4], [6, 3]], type: 'doubles', isDraw: false },
    null, { tierOf: (n) => ({ Ann: 'A', Bob: 'B', Cat: 'B', Dan: 'C' })[n] });
  const card = SC.resultCard(vm);
  assert.strictEqual(card.rated, false);
  assert.strictEqual(card.stats, null);
  assert.deepStrictEqual(card.rewards, []);
  assert.strictEqual(card.headline, 'Ann & Bob take the win');
  assert.deepStrictEqual(card.heroes, [{ name: 'Ann', tier: 'A' }, { name: 'Bob', tier: 'B' }]);
  const singles = SC.resultCard(SC.build({ id: 's', date: '2026-10-01', winners: ['Ann'], losers: ['Cat'], sets: [[6, 4]], type: 'singles', isDraw: false }, null, {}));
  assert.strictEqual(singles.headline, 'Ann takes the win');
  assert.strictEqual(singles.kicker, 'Takes the win');
});

test('no parallel calculation: the module reads the record and never re-derives a rating figure', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets/js/domain/matches/matchScorecard.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  ['expectedScore(', 'actualScores(', 'pairRating(', 'kUsed', 'processMatch', 'document', 'window', 'V3_', 'PLAYERS']
    .forEach((w) => assert.ok(!src.includes(w), `matchScorecard.js must not reference ${w}`));
});

const skip = !H.available();

test('Games: a played match opens its Result Card first, with the Match Analysis one tap behind', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      const out = [];
      const sign = (v, u) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(1)}${u}`;
      const pct = (v) => Math.round(v * 1000) / 10;
      // A decided match and a draw.
      const ids = [getAllApprovedMatches().filter((m) => !m.isDraw).slice(-1)[0].id, getAllApprovedMatches().find((m) => m.isDraw).id];
      ids.forEach((id) => {
        expandedGameId = id; renderGamesTab();
        const btn = document.querySelector(`#gamesView [data-gameid="${id}"] [data-scorecard]`);
        btn.click();
        const modal = document.getElementById('matchScorecardModal');
        const m = getAllApprovedMatches().find((x) => x.id === id);
        const f = V3_MATCH_FACTS[id];
        const tierOf = (n) => historicalTierOf(n, m.date);

        // The Result Card, straight from the engine's record.
        const card = modal.querySelector('.mrc');
        const heroSide = (() => {
          if (!m.isDraw) return f.byPlayer[m.winners[0]].side;
          const a = f.byPlayer[m.winners[0]].side, b = a === 'A' ? 'B' : 'A';
          const diff = (s) => Math.round((pct(f.sides[s].actual) - pct(f.sides[s].expected)) * 10) / 10;
          return diff(b) > diff(a) ? b : a;
        })();
        const heroNames = Object.values(f.byPlayer).filter((p) => p.side === heroSide).map((p) => p.playerId);
        const heroes = GameType.orderTeam(m.winners.includes(heroNames[0]) ? m.winners : m.losers, tierOf);
        const hs = f.sides[heroSide];
        const e = pct(hs.expected), a = pct(hs.actual);
        const gains = !m.isDraw && heroes.every((n) => f.byPlayer[n].ratingDelta > 0);
        const others = GameType.orderTeam(m.winners.includes(heroNames[0]) ? m.losers : m.winners, tierOf);
        // On a draw both sides are drawn alike; on a win only the winners are heroes.
        const sides = [...card.querySelectorAll('.mrc-heroes')];
        const colours = sides.map((el) => getComputedStyle(el).color);
        const look = (el) => { const cs = getComputedStyle(el); return [cs.fontFamily, cs.fontSize, cs.color].join('|'); };
        const result = {
          heroes: [...card.querySelectorAll('.mrc-hero')].map((h) => [h.querySelector('.mrc-hero-name').textContent, h.querySelector('.mrc-tier').textContent]),
          kicker: card.querySelector('.mrc-kicker').textContent,
          sets: [...card.querySelectorAll('.mrc-set')].map((x) => x.textContent),
          expected: card.querySelector('[data-fig="expected"]').textContent,
          performance: card.querySelector('[data-fig="performance"]').textContent,
          pp: card.querySelector('[data-fig="pp"]').textContent,
          rewards: [...card.querySelectorAll('.mrc-reward')].map((x) => x.textContent),
          story: card.querySelector('.mrc-story-title').textContent,
          teamWords: /Team [12]/.test(card.textContent),
          analysisInCard: !!card.querySelector('.msc-team'),
          sideCount: sides.length,
          sameLook: sides.length === 2 ? look(sides[0]) === look(sides[1]) && look(sides[0].querySelector('.mrc-hero-name')) === look(sides[1].querySelector('.mrc-hero-name')) : null,
          against: !!card.querySelector('.mrc-against'),
        };
        const heroFirst = m.winners.includes(heroes[0]);
        const wantResult = {
          heroes: (m.isDraw ? heroes.concat(others) : heroes).map((n) => [n, tierOf(n)]),
          kicker: m.isDraw ? 'All square' : 'Take the win',
          sets: m.sets.map((s) => (heroFirst ? `${s[0]}–${s[1]}` : `${s[1]}–${s[0]}`)),
          expected: e.toFixed(1) + '%', performance: a.toFixed(1) + '%', pp: sign(Math.round((a - e) * 10) / 10, 'pp'),
          rewards: gains ? heroes.map((n) => `${n} ${sign(f.byPlayer[n].ratingDelta, '')}`) : [],
          story: matchResultCardFor(id).story.title,
          teamWords: false, analysisInCard: false,
          sideCount: m.isDraw ? 2 : 1,
          sameLook: m.isDraw ? true : null,
          against: !m.isDraw,
        };

        // One tap: the Match Analysis, every figure, losers included.
        modal.querySelector('[data-scorecard-view="analysis"]').click();
        const teams = [...modal.querySelectorAll('.msc-team')].map((t) => ({
          names: [...t.querySelectorAll('.msc-name')].map((n) => n.textContent),
          tiers: [...t.querySelectorAll('.msc-tier')].map((n) => n.textContent),
          moves: [...t.querySelectorAll('.msc-move')].map((n) => n.textContent),
          expected: t.querySelector('[data-fig="expected"]').textContent,
          actual: t.querySelector('[data-fig="actual"]').textContent,
          pp: t.querySelector('[data-fig="pp"]').textContent,
        }));
        const want = [m.winners, m.losers].map((names) => {
          const s = f.sides[f.byPlayer[names[0]].side];
          const e2 = pct(s.expected), a2 = pct(s.actual);
          const ordered = GameType.orderTeam(names, tierOf);
          return { names: ordered, tiers: ordered.map(tierOf),
            moves: ordered.map((n) => sign(f.byPlayer[n].ratingDelta, '')),
            expected: e2.toFixed(1) + '%', actual: a2.toFixed(1) + '%', pp: sign(Math.round((a2 - e2) * 10) / 10, 'pp') };
        });
        const analysis = { teams, score: modal.querySelector('.msc-score').textContent, winner: modal.querySelector('.msc-winner').textContent };
        modal.querySelector('[data-scorecard-view="result"]').click();
        const back = !!modal.querySelector('.mrc') && !modal.querySelector('.msc');
        out.push({ id, open: modal.classList.contains('show'), stillExpanded: expandedGameId === id, isDraw: m.isDraw, colours,
          result, wantResult, analysis, want, wantScore: m.sets.map((s) => s.join('-')).join(', '), back });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        out[out.length - 1].closed = !modal.classList.contains('show');
      });
      return out;
    });
    // The winners' gold belongs to winners: a draw's two pairs are in neither.
    const winnersGold = r.find((c) => !c.isDraw).colours[0];
    const draw = r.find((c) => c.isDraw);
    assert.strictEqual(draw.colours.length, 2);
    assert.strictEqual(draw.colours[0], draw.colours[1], 'both pairs in the same colour');
    assert.notStrictEqual(draw.colours[0], winnersGold, 'and not the winners\' gold');
    r.forEach((c) => {
      assert.ok(c.open, `${c.id}: it opens`);
      assert.ok(c.stillExpanded, `${c.id}: opening it does not collapse the card behind it`);
      assert.deepStrictEqual(c.result, c.wantResult, `${c.id}: the Result Card`);
      assert.deepStrictEqual(c.analysis.teams, c.want, `${c.id}: the analysis`);
      assert.strictEqual(c.analysis.score, c.wantScore);
      assert.strictEqual(c.analysis.winner, c.isDraw ? 'Draw' : `${c.want[0].names.join(' & ')} won`);
      assert.ok(c.back, 'Back returns to the Result Card');
      assert.ok(c.closed, 'Escape closes it');
    });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('Share result paints the Result Card and hands one picture to the share sheet', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      const id = getAllApprovedMatches().filter((m) => !m.isDraw).slice(-1)[0].id;
      const card = matchResultCardFor(id);
      const cv = CardPainter.matchResult(card, { when: matchResultContext(card) });
      const calls = [];
      const real = CardPainter.share;
      CardPainter.share = async (files, meta) => { calls.push({ files: files.map((x) => ({ name: x.name, type: x.type, size: x.size })), meta }); return calls.length === 1 ? 'ready' : 'shared'; };
      try {
        openMatchScorecard(id);
        const modal = document.getElementById('matchScorecardModal');
        await shareMatchResult(id);
        const label = modal.querySelector('[data-scorecard-share]').textContent;
        await shareMatchResult(id);
        return { size: [cv.width, cv.height], calls, label, message: modal.querySelector('.msc-message').textContent, headline: card.headline };
      } finally { CardPainter.share = real; }
    });
    assert.deepStrictEqual(r.size, [1080, 1350]);
    assert.strictEqual(r.calls.length, 2);
    assert.strictEqual(r.calls[0].files.length, 1);
    assert.strictEqual(r.calls[0].files[0].type, 'image/png');
    assert.ok(r.calls[0].files[0].size > 10000, 'a real picture');
    assert.match(r.calls[0].files[0].name, /^money-padel-.+-result\.png$/);
    assert.strictEqual(r.calls[0].meta.title, r.headline);
    assert.strictEqual(r.label, 'Tap to share', 'a share sheet that needs a fresh tap gets one');
    assert.deepStrictEqual(r.calls[1].files, r.calls[0].files, 'the tap shares the picture already made');
    assert.strictEqual(r.message, 'Shared.');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('approving a result offers its scorecard straight away, rated from the new record', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(async () => {
      isUnlocked = true; currentUserName = 'Tester';
      extraMatchesState.push({
        id: 'usr_sc_1', date: '2026-09-18', winners: ['Shaun', 'Tom'], losers: ['Max', 'KC'],
        sets: [[6, 3], [6, 4]], type: 'doubles', note: '', status: 'pending', submittedBy: 'Tester',
      });
      recomputeAll();
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      await prepareApproval('usr_sc_1');
      const matchId = approvalPlan.matchId;
      const planned = approvalPlan.planned.playersMoved.map((p) => [p.playerId, p.delta]);
      await commitApproval();
      renderGamesTab();
      const btn = document.querySelector(`#gamesView .approval-outcome [data-scorecard="${matchId}"]`);
      if (btn) btn.click();
      const vm = matchScorecardFor(matchId);
      const modal = document.getElementById('matchScorecardModal');
      return { matchId, planned, button: !!btn, open: !!modal && modal.classList.contains('show'),
        shown: modal ? modal.querySelector('.mrc').dataset.match : null,
        rated: vm.rated, moves: vm.teams.flatMap((t) => t.players.map((p) => [p.name, p.movement])) };
    });
    assert.ok(r.button, 'the approval outcome carries a scorecard button');
    assert.ok(r.open);
    assert.strictEqual(r.shown, r.matchId);
    assert.strictEqual(r.rated, true, 'the new match is rated from the record written by the approval');
    const plannedOf = Object.fromEntries(r.planned);
    r.moves.forEach(([n, d]) => assert.ok(Math.abs(d - plannedOf[n]) <= 0.05 + 1e-9, `${n}: ${d} vs planned ${plannedOf[n]}`));
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

test('in the app, a player with no rating event falls back to the dated tier history, never today\'s tier', { skip }, async () => {
  const app = await H.open();
  try {
    const r = await app.run(() => {
      // A match one of whose players has since changed tier.
      const m = getAllApprovedMatches().find((x) => x.winners.concat(x.losers)
        .some((n) => historicalTierOf(n, x.date) !== (PLAYERS.find((p) => p.name === n) || {}).tier));
      if (!m) return null;
      const keep = V3_MATCH_FACTS[m.id];
      delete V3_MATCH_FACTS[m.id];
      const vm = matchScorecardFor(m.id);
      V3_MATCH_FACTS[m.id] = keep;
      return { rated: vm.rated, tiers: vm.teams.flatMap((t) => t.players.map((p) => [p.name, p.tier])),
        want: m.winners.concat(m.losers).map((n) => [n, historicalTierOf(n, m.date)]) };
    });
    assert.ok(r, 'the record has a player whose tier has changed since a match');
    assert.strictEqual(r.rated, false);
    assert.deepStrictEqual(r.tiers.slice().sort(), r.want.slice().sort());
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Four and five sets used to break each set across two lines ("6–" over "4")
// on a phone: each set was a flex item that was allowed to wrap, at a size
// meant for three. A set is one unit, and the row fits the card.
for (const width of [360, 390]) {
  test(`a four- or five-set score stays on one line, each set whole, at ${width}px`, { skip }, async () => {
    const app = await H.open({ viewport: { width, height: 844 } });
    try {
      for (const sets of [[[4, 6], [6, 4], [6, 2], [6, 3]], [[4, 6], [6, 4], [6, 7], [7, 6], [10, 8]]]) {
        const r = await app.run((sets) => {
          const m = getAllApprovedMatches().find((x) => !x.isDraw);
          m.sets = sets;
          openMatchScorecard(m.id, 'result');
          const card = document.querySelector('#matchScorecardModal .mrc').getBoundingClientRect();
          const els = [...document.querySelectorAll('#matchScorecardModal .mrc-set')];
          const lh = parseFloat(getComputedStyle(els[0]).fontSize) * 1.6;
          return { n: els.length, tops: els.map((e) => Math.round(e.getBoundingClientRect().top)),
            tall: els.filter((e) => e.getBoundingClientRect().height > lh).length,
            out: els.filter((e) => e.getBoundingClientRect().left < card.left || e.getBoundingClientRect().right > card.right).length };
        }, sets);
        assert.strictEqual(r.n, sets.length);
        assert.strictEqual(r.tall, 0, `${sets.length} sets: a set broke across lines`);
        assert.strictEqual(new Set(r.tops).size, 1, `${sets.length} sets: the score did not fit on one line`);
        assert.strictEqual(r.out, 0, `${sets.length} sets: a set ran outside the card`);
      }
      assert.deepStrictEqual(app.pageErrors, []);
    } finally { await app.close(); }
  });
}
