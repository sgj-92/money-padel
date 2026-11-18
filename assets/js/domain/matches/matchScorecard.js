// ===================== MATCH SCORECARD =====================
// One completed match, as one canonical card: who played, in which tier ON THE
// DAY, the score, who won, what each side was expected to take, what it took,
// the difference, and how far every player's rating moved.
//
// It calculates nothing the engine did not. Every rating figure is read back
// from what the engine recorded when it rated the match (MatchFacts, built from
// the Rating Journey's MATCH_UPDATE events):
//
//   expected    the side's preMatchExpectedScore
//   actual      the side's actualScore -- the engine's own "actual", which is a
//               PERFORMANCE score (0.80 x share of games + 0.20 x the result),
//               not a share of games. The share of games is carried beside it
//               as labelled context, never in its place.
//   vs expected actual - expected, in percentage points. The engine stored the
//               difference itself (performanceResidual); it is what K
//               multiplies, so it is also why the ratings moved.
//   movement    each player's stored ratingDelta (K is per player, so the four
//               players move by four different amounts)
//   tier        each player's tierAtEvent, written on the same event
//
// Because all of it was written when the match was rated, none of it moves when
// a rating or tier moves later: a June scorecard reads the same in December.
// A match the engine has no record for (not yet rated) gets a card that says
// so -- its rating figures are absent, never estimated.
//
// Two views are drawn from that ONE view model, never from a second source:
//
//   build(...)       the full scorecard -- the Match Analysis: both teams'
//                    expected / actual / difference, game share, and every
//                    player's movement, winners and losers alike.
//   resultCard(vm)   the Match Result Card -- the celebratory, shareable face
//                    of the same match: the winners as the heroes, the score,
//                    one story, one expected-vs-performance line, and the
//                    winners' rating gains. Every number on it is a field of
//                    the scorecard, copied, not recalculated.
//
// The story is chosen by fixed thresholds on recorded figures (STORY below),
// so the same match always tells the same story -- no generated commentary.
//
// PURE. Inputs are passed in; it reads nothing global, writes nothing, touches
// no DOM. The on-screen sheet and the shared picture (CardPainter) both draw
// these view models.

(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MatchScorecard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const lib = (name, file) => {
    if (root && root[name]) return root[name];
    if (typeof require === 'function') return require(file);
    throw new Error(`MatchScorecard needs ${name}`);
  };

  // One decimal place, without float noise ("62.4", never "62.400000001").
  const r1 = (v) => Math.round(v * 10) / 10;
  const pct = (v) => (typeof v === 'number' ? r1(v * 100) : null);

  // Builds the scorecard for one match.
  //
  //   match   the app's match: { id, date, winners, losers, sets: [[a, b]],
  //           type, isDraw }. On a decided match `winners` is the side that
  //           won; on a draw the stored orientation, which is arbitrary but
  //           fixed.
  //   facts   MatchFacts.index(journey)[match.id], or null when unrated
  //   opts    { tierOf(name, date) -> tier | null }  the historical tier
  //           resolver, used only for a player the engine has no event for.
  function build(match, facts, opts) {
    if (!match) return null;
    const Engine = lib('RatingEngine', '../../ratingEngine.js');
    const GameType = lib('GameType', '../../gameType.js');
    const tierOf = (opts && opts.tierOf) || (() => null);

    const sets = (match.sets || []).map((s) => [s[0], s[1]]);
    const shares = Engine.gameShares(sets);
    const rated = !!(facts && facts.sides && facts.byPlayer);

    // Team 1 is the stored first side -- the winners on a decided match --
    // and the engine side each team was rated as is found by who was on it,
    // not assumed.
    const sideOf = (names) => {
      if (!rated) return null;
      const s = names.map((n) => facts.byPlayer[n] && facts.byPlayer[n].side);
      return s.every((x) => x && x === s[0]) ? s[0] : null;
    };

    const team = (no, names, games, opponentGames, share) => {
      const side = sideOf(names);
      const f = side ? facts.sides[side] : null;
      const tierFor = (name) => {
        const p = rated ? facts.byPlayer[name] : null;
        return (p && p.tierAtEvent) || tierOf(name, match.date) || null;
      };
      // Within a pair, the stronger tier first -- the order every match card
      // reads a partnership in. The two TEAMS are never reordered.
      const ordered = GameType.orderTeam ? GameType.orderTeam(names, tierFor) : names;
      const players = ordered.map((name) => {
        const p = rated ? facts.byPlayer[name] : null;
        const recorded = p && p.tierAtEvent ? p.tierAtEvent : null;
        const tier = recorded || tierOf(name, match.date) || null;
        return {
          name,
          tier,
          // Where the tier came from, so a test (or a curious admin) can tell
          // the event's own snapshot from the dated tier history.
          tierSource: recorded ? 'event' : (tier ? 'history' : null),
          preRating: p ? p.preMatchRating : null,
          postRating: p ? p.postMatchRating : null,
          movement: p ? p.ratingDelta : null,
        };
      });
      const expectedPct = f ? pct(f.expected) : null;
      const actualPct = f ? pct(f.actual) : null;
      return {
        no,
        side,
        names: players.map((p) => p.name),
        players,
        won: !match.isDraw && no === 1,
        games,
        opponentGames,
        gameSharePct: pct(share),
        expected: f ? f.expected : null,
        actual: f ? f.actual : null,
        residual: f ? f.residual : null,
        expectedPct,
        actualPct,
        // The difference as the card prints it: the two printed figures,
        // subtracted. It is the stored residual to within the rounding of
        // those two figures (at most 0.1pp), and it always adds up on screen.
        vsExpectedPp: f ? r1(actualPct - expectedPct) : null,
        // The engine's own residual, unrounded, in points -- what K multiplied.
        residualPp: f ? f.residual * 100 : null,
        preRating: f ? f.preRating : null,
      };
    };

    const teams = [
      team(1, match.winners || [], shares.gamesA, shares.gamesB, shares.shareA),
      team(2, match.losers || [], shares.gamesB, shares.gamesA, shares.shareB),
    ];
    // Ratings are only shown when BOTH teams map cleanly onto the engine's two
    // sides. Anything else would be pairing one team with another's numbers.
    const complete = rated && teams[0].side && teams[1].side && teams[0].side !== teams[1].side;
    if (!complete) teams.forEach((t) => {
      t.side = null; t.expected = t.actual = t.residual = null;
      t.expectedPct = t.actualPct = t.vsExpectedPp = t.residualPp = t.preRating = null;
      t.players.forEach((p) => { p.preRating = p.postRating = p.movement = null; });
    });

    const tiersOf = (t) => t.players.map((p) => p.tier);
    const classified = GameType.classify(tiersOf(teams[0]), tiersOf(teams[1]));

    return {
      matchId: match.id,
      date: match.date,
      format: match.type === 'singles' || teams[0].players.length === 1 ? 'singles' : 'doubles',
      // The game type in tier terms, from the tiers on the card; null when any
      // tier is unknown -- a guess would file the match under the wrong type.
      matchup: classified.matchup,
      category: classified.category,
      categoryLabel: classified.category ? GameType.categoryLabel(classified.category) : null,
      sets,
      scoreText: sets.map((s) => `${s[0]}-${s[1]}`).join(', '),
      isDraw: !!match.isDraw,
      winner: match.isDraw ? null : 1,
      rated: !!complete,
      teams,
    };
  }

  // ---- The Match Result Card ---------------------------------------------
  //
  // The story thresholds, on the heroes' recorded figures. `expected` is the
  // engine's pre-match expected score, so under 50 means the engine had them
  // as underdogs. A winning side always banks the 20% result component, so a
  // winner's difference is usually positive (median about +16pp on the club's
  // record); a "statement" therefore needs a margin in the top quarter of wins.
  // On the 30 Sep record these give: delivered 59, beat the odds 39, dominant
  // 19, too close 15, job done 14, major upset 12, statement 9, all square 9.
  const STORY = {
    MAJOR_UPSET_BELOW: 35,   // expected % -- heavy underdogs who won
    UNDERDOG_BELOW: 50,      // expected % -- underdogs who won
    DOMINANT_SHARE: 75,      // % of the games won -- e.g. 6-2, 6-2
    STATEMENT_PP: 20,        // pp above expectation, as favourites
    CLOSE_SHARE: 55,         // % of the games won -- a handful in it
  };

  // One story per match, in order of how remarkable it is: the first that
  // applies is the one told. Every rule reads a field already on the card.
  function story(vm, hero) {
    if (vm.isDraw) {
      return { key: 'all_square', title: 'Honours even', line: 'Nothing to separate them on the day.' };
    }
    const E = hero.expectedPct, R = hero.vsExpectedPp, G = hero.gameSharePct;
    const rated = typeof E === 'number';
    if (rated && E < STORY.MAJOR_UPSET_BELOW) {
      return { key: 'major_upset', title: 'Major upset', line: 'Heavy underdogs going in — and they won.' };
    }
    if (rated && E < STORY.UNDERDOG_BELOW) {
      return { key: 'beat_the_odds', title: 'Beat the odds', line: 'Underdogs going in, winners coming out.' };
    }
    if (G >= STORY.DOMINANT_SHARE) {
      return { key: 'dominant', title: 'Dominant display', line: `Took ${Math.round(G)}% of the games — ${hero.games}–${hero.opponentGames}.` };
    }
    if (rated && R >= STORY.STATEMENT_PP) {
      return { key: 'statement', title: 'Statement win', line: 'Favourites, and they made it count.' };
    }
    if (G <= STORY.CLOSE_SHARE) {
      return { key: 'too_close', title: 'Too close to call', line: `Decided by a handful of games — ${hero.games}–${hero.opponentGames}.` };
    }
    if (rated && R >= 0) {
      return { key: 'delivered', title: 'Expected win, delivered', line: 'Favourites going in, and they delivered.' };
    }
    if (rated) {
      return { key: 'job_done', title: 'Job done', line: 'Favourites going in, and they got it done.' };
    }
    return { key: 'win', title: 'The win', line: `${hero.games}–${hero.opponentGames} in games.` };
  }

  // The celebratory card, from the scorecard view model and nothing else.
  //
  // Heroes: the winners. On a draw nobody won, so the card leads with the side
  // that did better than expected (the stored first side if neither did), and
  // says plainly that it was all square.
  //
  // Rewards: the heroes' own rating gains, shown only when every hero gained.
  // A favourite can win and still fall short of expectation, which moves their
  // rating DOWN; a celebratory card does not print that, and does not print a
  // partial line either. The full movement, either way, is in the analysis.
  function resultCard(vm) {
    if (!vm) return null;
    const [t1, t2] = vm.teams;
    const heroNo = vm.isDraw && typeof t2.vsExpectedPp === 'number' && t2.vsExpectedPp > t1.vsExpectedPp ? 2 : 1;
    const hero = heroNo === 1 ? t1 : t2;
    const other = heroNo === 1 ? t2 : t1;
    const person = (p) => ({ name: p.name, tier: p.tier });
    const names = hero.names.join(' & ');
    // A draw has no winners' gains to celebrate: showing one pair's movement
    // would make them look like the winners. The analysis has everyone's.
    const gains = !vm.isDraw && vm.rated && hero.players.every((p) => typeof p.movement === 'number' && p.movement > 0);
    return {
      matchId: vm.matchId,
      date: vm.date,
      format: vm.format,
      matchup: vm.matchup,
      isDraw: vm.isDraw,
      rated: vm.rated,
      headline: vm.isDraw ? `${names} and ${other.names.join(' & ')}: all square` : `${names} ${hero.names.length === 1 ? 'takes' : 'take'} the win`,
      // The card reads as one sentence: "Eli & Denis / take the win / 6–2 6–3
      // / over Rishi & Erf".
      kicker: vm.isDraw ? 'All square' : (hero.names.length === 1 ? 'Takes the win' : 'Take the win'),
      against: vm.isDraw ? 'with' : 'over',
      heroNo,
      heroes: hero.players.map(person),
      opponents: other.players.map(person),
      // The score as the heroes would say it: their games first.
      sets: vm.sets.map((s) => (heroNo === 1 ? [s[0], s[1]] : [s[1], s[0]])),
      story: story(vm, hero),
      // One line of evidence, the heroes' own. Absent, not estimated, when the
      // match has no rating record.
      stats: vm.rated ? {
        names: hero.names.slice(),
        expectedPct: hero.expectedPct,
        performancePct: hero.actualPct,
        vsExpectedPp: hero.vsExpectedPp,
        // How the actual score is made (Shaun, 18 Nov: the expected figure read
        // as a win chance beside a score that "factors in the win"). Both are
        // scores on the same scale: 80% the share of games, 20% the result.
        how: `Score = 80% games won (${hero.games}–${hero.opponentGames}, ${Math.round(hero.gameSharePct)}%) + 20% result (${vm.isDraw ? 'draw' : hero.won ? 'win' : 'loss'})`,
      } : null,
      rewards: gains ? hero.players.map((p) => ({ name: p.name, movement: p.movement })) : [],
    };
  }

  return { build, resultCard, story, STORY };
});
