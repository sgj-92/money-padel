// ===================== PLAYER OF THE MONTH =====================
// Money Padel recommends candidates; the group chooses the winner.
//
// This is NOT a leaderboard and there is no Player of the Month score. A month
// can be won in different ways, so the recommendation looks for strong CASES
// of different kinds, each read from the month alone:
//
//   The month's competitions   who won a tier of the League, Merit or the
//                              Monthly Race -- the competitions' own results,
//                              handed in, never worked out here
//   Overperformer              highest average performance against expectation
//   Biggest Improver           most Power Rating gained through play
//   Strongest Results          best win rate
//   Upset Specialist           most wins as the underdog
//   Most Consistent            beat expectation in the largest share of matches
//   Most Active                most matches
//
// A competition winner is a candidate. So is whoever leads a statistical
// story; players level on it are all candidates (no tie-break is invented to
// separate them). Each statistical story has a floor below which it is not a
// case (a best win rate of 40% is not "Strongest Results"), and upsets count
// only in a month that was at or above expectation overall. Match count only
// ever earns "Most Active", so volume cannot win the month on its own. When
// fewer than three players are named, the next-best player on each statistical
// story is added until there are three. Nobody is cut to keep the list short:
// Admin trims it.
//
// Winning a competition is a strong reason, never the award: the group still
// votes.
//
// How a card reads. Each reason is a label and one sentence about what the
// player did ("Beat expectations by +7.2pp on average.") -- never a comparison
// with everyone else. Two or three competition wins are told once ("Triple
// Crown: won the League, Merit and the Monthly Race in Tier B") rather than as
// three near-identical lines. A card shows its strongest three reasons, in
// the fixed order of REASON_ORDER; anything else is listed by name only.
//
// Candidates are listed by name: the shortlist is the strongest cases, not a
// ranking. A player must have played MIN_MATCHES matches that month to be
// considered (Shaun, 4 Oct: the same 5 as the Monthly Performance podium and
// the Monthly Race).
//
// The second half of this module is the award record. A recommendation is
// recalculated whenever it is asked for; a finalised shortlist and a confirmed
// winner are SNAPSHOTS -- names, tiers, reasons and figures as they stood --
// so a confirmed award never changes when ratings, tiers, a player's status or
// these rules do.
//
// Pure: no page, no app state, no storage.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerOfMonth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Bump when the recommendation rules change. Stored with each shortlist, so a
  // past month records which rules suggested its candidates.
  const RULES_VERSION = 'potm-2';
  const MIN_MATCHES = ((typeof CLUB !== 'undefined' ? CLUB : require('../../config/club.js').CLUB).periodMinMatches) || 5;
  const SHORTLIST_MIN = 3;
  // A vote works best between a handful. More cases than this are all shown,
  // and Admin is asked to trim; nothing is cut automatically.
  const SHORTLIST_COMFORT = 5;
  const REASONS_SHOWN = 3;

  const STATE = { SHORTLISTED: 'shortlisted', CONFIRMED: 'confirmed' };
  const SOURCE = { RECOMMENDED: 'recommended', ADMIN: 'admin' };

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  // "Oct 2026" for a month; a longer period by its own label ("Oct–Dec 2026").
  const period = () => (typeof Period !== 'undefined' ? Period : require('../../config/period.js'));
  const monthLabel = (month) => (period().MONTHS === 1 ? `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}` : period().label(month));
  const monthName = (month) => MONTHS[Number(month.slice(5, 7)) - 1];

  const r1 = (v) => Math.round(v * 10) / 10;
  const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(r1(v));
  const pctOf = (n, d) => (d ? r1((100 * n) / d) : 0);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // ---- The statistical stories --------------------------------------------
  // `value` is the one figure the story is about, already on the metrics; `line`
  // says what the player did, in one sentence. Ties are judged on the figure
  // as people see it (one decimal place), so two players shown as "+12.4pp"
  // are level, whatever the float noise says.
  const STORIES = [
    {
      key: 'overperformer', title: 'Overperformer',
      value: (m) => m.performancePct,
      floor: (v) => v > 0,
      line: (m) => `Beat expectations by ${signed(m.performancePct)}pp on average.`,
    },
    {
      key: 'improver', title: 'Biggest Improver',
      value: (m) => m.ratingChangePlay,
      floor: (v) => v > 0,
      line: (m) => `Gained ${signed(m.ratingChangePlay)} Power Rating through play.`,
    },
    {
      key: 'results', title: 'Strongest Results',
      value: (m) => m.winPct,
      floor: (v) => v > 50,
      line: (m) => `Won ${m.wins} of ${m.games} matches — ${Math.round(m.winPct)}%.`,
    },
    {
      key: 'upsets', title: 'Upset Specialist',
      value: (m) => m.underdogWins,
      floor: (v) => v >= 1,
      // One good evening in a month spent below expectation is not a case:
      // the month as a whole must be at or above expectation.
      gate: (m) => typeof m.performancePct === 'number' && m.performancePct >= 0,
      // The underdog line is the engine's expected score, not a chance of
      // winning, so no "from a 37% chance" clause: it would say the wrong thing.
      line: (m) => `${plural(m.underdogWins, 'win', 'wins')} as the underdog.`,
    },
    {
      key: 'consistent', title: 'Most Consistent',
      value: (m) => (m.ratedMatches ? pctOf(m.beatExpected, m.ratedMatches) : null),
      floor: (v) => v > 50,
      line: (m) => `Beat expectation in ${m.beatExpected} of ${m.ratedMatches} matches.`,
    },
    {
      key: 'active', title: 'Most Active',
      value: (m) => m.games,
      floor: () => true,
      line: (m, month) => `Played ${m.games} matches in ${monthName(month)}.`,
    },
  ];
  const STORY = Object.fromEntries(STORIES.map((s) => [s.key, s]));

  // ---- The month's competitions -----------------------------------------------
  // metrics.competitionWins: [{ competition: 'league'|'merit'|'race', tier,
  // sharedWith: [names] }] -- the tier winners as the competitions themselves
  // decided them. Several wins are one reason, told once.
  const COMPETITIONS = ['league', 'merit', 'race'];
  const COMPETITION_TITLE = { league: 'League Winner', merit: 'Merit Winner', race: 'Monthly Race Winner' };
  const COMPETITION_NAME = { league: 'the League', merit: 'Merit', race: 'the Monthly Race' };

  function listed(parts) {
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  }

  function competitionStory(m, month) {
    const wins = (m.competitionWins || []).slice()
      .sort((a, b) => COMPETITIONS.indexOf(a.competition) - COMPETITIONS.indexOf(b.competition));
    if (!wins.length) return null;
    const kinds = [...new Set(wins.map((w) => w.competition))];
    const tiers = [...new Set(wins.map((w) => w.tier))];
    const shared = [...new Set(wins.flatMap((w) => w.sharedWith || []))];
    const joint = shared.length ? ' (shared)' : '';
    const mon = monthName(month);
    if (wins.length === 1) {
      const w = wins[0];
      const top = shared.length ? 'Joint top' : 'Top';
      const line = {
        league: `${top} of Tier ${w.tier} in the ${mon} League.`,
        merit: `${top} of Tier ${w.tier} in ${mon} Merit.`,
        race: shared.length ? `Joint winner of Tier ${w.tier} in ${mon}’s Monthly Race.` : `Won Tier ${w.tier} in ${mon}’s Monthly Race.`,
      }[w.competition];
      return { key: w.competition, title: COMPETITION_TITLE[w.competition], line, competitions: kinds, sharedWith: shared };
    }
    // Two or three wins: one line. A mid-month mover's wins can be in
    // different tiers, and the line names each.
    const title = kinds.length === 3 ? 'Triple Crown' : 'Month Champion';
    const names = wins.map((w) => COMPETITION_NAME[w.competition] + (tiers.length > 1 ? ` (Tier ${w.tier})` : ''));
    const where = tiers.length === 1 ? ` in Tier ${tiers[0]}` : '';
    return { key: kinds.length === 3 ? 'triple' : 'champion', title,
      line: `Won ${listed(names)}${where} in ${mon}${joint}.`, competitions: kinds, sharedWith: shared };
  }

  // The order reasons are told on a card: the competitions' own results
  // first, then the statistical stories as listed above. Leads before
  // next-best. Fixed, so the same month always reads the same way.
  const REASON_ORDER = ['triple', 'champion', 'league', 'merit', 'race'].concat(STORIES.map((s) => s.key));
  const reasonRank = (r) => REASON_ORDER.indexOf(r.key) + (r.place === 'next' ? REASON_ORDER.length : 0);

  const qualifies = (metrics, minMatches = MIN_MATCHES) => (metrics.games || 0) >= minMatches;

  // Players on the best figure of a story, then those on the next-best, as
  // groups. Only figures that clear the story's floor are a case.
  function placings(story, pool) {
    const scored = pool
      .filter((p) => !story.gate || story.gate(p.metrics))
      .map((p) => ({ p, v: story.value(p.metrics) }))
      .filter((x) => typeof x.v === 'number' && !Number.isNaN(x.v) && story.floor(x.v))
      .map((x) => ({ ...x, v: r1(x.v) }));
    const values = [...new Set(scored.map((x) => x.v))].sort((a, b) => b - a);
    return values.slice(0, 2).map((v) => scored.filter((x) => x.v === v).map((x) => x.p));
  }

  // One reason on a card.
  function storyEntry(story, player, place, group, month) {
    return {
      key: story.key,
      title: story.title,
      place,                                    // 'lead' | 'next'
      line: story.line(player.metrics, month),
      // Level with these players on the same figure -- kept, never broken.
      sharedWith: group.filter((g) => g.playerId !== player.playerId).map((g) => g.name),
    };
  }

  // The figures under the reasons: the same four on every card, so the group
  // can compare cases at a glance. The reasons carry anything more specific.
  function supportLine(m) {
    if (!m) return '';
    const bits = [plural(m.games, 'match', 'matches'), plural(m.wins, 'win', 'wins'), `${Math.round(m.winPct)}% win rate`];
    if (typeof m.performancePct === 'number') bits.push(`${signed(m.performancePct)}pp vs expectation`);
    return bits.join(' · ');
  }

  function cardFor(player, reasons, month) {
    const ordered = reasons.slice().sort((a, b) => reasonRank(a) - reasonRank(b));
    const shown = ordered.slice(0, REASONS_SHOWN);
    const lead = shown[0] || null;
    return {
      playerId: player.playerId,
      name: player.name,
      tier: player.metrics.tier || null,
      title: lead ? lead.title : '',
      stories: shown,
      // Further reasons, by label only: a card stays readable.
      alsoTitles: ordered.slice(REASONS_SHOWN).map((r) => r.title),
      support: supportLine(player.metrics),
      metrics: { ...player.metrics },
      citation: citationFor(player, shown, month),
    };
  }

  // The award's words -- the default an admin can edit before confirming.
  // "September 2026 — Triple Crown · Most Active. Won the League, Merit and
  // the Monthly Race in Tier B in September. Played 17 matches in September."
  function citationFor(player, reasons, month) {
    const top = (Array.isArray(reasons) ? reasons : [reasons]).filter(Boolean).slice(0, 2);
    if (!top.length) return `${monthLabel(month)}. ${supportLine(player.metrics)}.`;
    return `${monthLabel(month)} — ${top.map((r) => r.title).join(' · ')}. ${top.map((r) => r.line).join(' ')}`;
  }

  // The recommendation for a month.
  //
  //   players: [{ playerId, name, archived, metrics }]
  //   metrics: { games, wins, draws, losses, winPct, performancePct,
  //              ratedMatches, beatExpected, ratingStart, ratingEnd,
  //              ratingChangePlay, ratingChangeClub, underdogWins,
  //              majorUpsetWins, biggestUpset, tier, competitionWins }
  function recommend({ month, players, minMatches = MIN_MATCHES }) {
    const all = (players || []).filter((p) => p && p.metrics);
    const qualifiedAll = all.filter((p) => qualifies(p.metrics, minMatches));
    // Someone who has left the group is not put to the group's vote. They are
    // named, so an admin can see why and restore them first.
    const archivedQualified = qualifiedAll.filter((p) => p.archived).map((p) => p.name).sort();
    const pool = qualifiedAll.filter((p) => !p.archived);

    const picks = new Map();
    const add = (player, entry) => {
      if (!picks.has(player.playerId)) picks.set(player.playerId, { player, stories: [] });
      picks.get(player.playerId).stories.push(entry);
    };
    pool.forEach((p) => {
      const won = competitionStory(p.metrics, month);
      if (won) add(p, { ...won, place: 'lead' });
    });
    const groups = STORIES.map((s) => ({ story: s, places: placings(s, pool) }));
    groups.forEach(({ story, places }) => {
      (places[0] || []).forEach((p) => add(p, storyEntry(story, p, 'lead', places[0], month)));
    });
    // Too few distinct cases: the next-best on each story, new names only.
    for (const { story, places } of groups) {
      if (picks.size >= SHORTLIST_MIN) break;
      (places[1] || []).filter((p) => !picks.has(p.playerId))
        .forEach((p) => add(p, storyEntry(story, p, 'next', places[1], month)));
    }

    const candidates = [...picks.values()]
      .map(({ player, stories }) => cardFor(player, stories, month))
      .sort((a, b) => a.name.localeCompare(b.name));

    let empty = null;
    if (!candidates.length) {
      if (!all.length) empty = `No matches were played in ${monthLabel(month)}.`;
      else if (archivedQualified.length) empty = `Only ${archivedQualified.join(', ')} played ${minMatches} or more matches in ${monthLabel(month)}, and ${archivedQualified.length > 1 ? 'they are' : 'is'} archived. Restore them in Admin › Player tags to consider them.`;
      else empty = `Nobody played ${minMatches} or more matches in ${monthLabel(month)}, so there is no shortlist. A shortlist needs players with enough games to judge a month on.`;
    }
    return {
      month,
      rulesVersion: RULES_VERSION,
      minMatches,
      qualified: pool.map((p) => p.name).sort((a, b) => a.localeCompare(b)),
      archivedQualified,
      notQualified: all.length - qualifiedAll.length,
      candidates,
      empty,
    };
  }

  // A qualified player an admin adds by hand. If the recommendation already
  // has a card for them, that card is used; otherwise they carry their figures
  // and no story.
  function adminEntry(recommendation, player, month) {
    const card = recommendation.candidates.find((c) => c.playerId === player.playerId);
    return { ...(card || cardFor(player, [], month)), source: card ? SOURCE.RECOMMENDED : SOURCE.ADMIN };
  }

  // ---- The award record ---------------------------------------------------
  // One record per month:
  //   { version, month, state, rulesVersion, minMatches,
  //     recommended: [playerId],        what the app suggested at the time
  //     shortlist: [card + source],     what the group votes on (snapshots)
  //     shortlistedAt, shortlistedBy,
  //     winner: { playerId, name, tier, title, citation, metrics } | null,
  //     winnerId: playerId | null,      top-level, for queries
  //     confirmedAt, confirmedBy,
  //     votes: null,                    reserved for in-app voting
  //     log: [{ action, by, at, ... }] }

  function finaliseShortlist({ previous, month, recommendation, entries, by, at }) {
    if (previous && previous.state === STATE.CONFIRMED) throw new Error('The winner is already confirmed. Reopen the month first.');
    const list = entries || [];
    if (!list.length) throw new Error('A shortlist needs at least one player.');
    const ids = list.map((e) => e.playerId);
    if (new Set(ids).size !== ids.length) throw new Error('A player is on the shortlist twice.');
    return {
      version: 1,
      month,
      state: STATE.SHORTLISTED,
      rulesVersion: recommendation ? recommendation.rulesVersion : RULES_VERSION,
      minMatches: recommendation ? recommendation.minMatches : MIN_MATCHES,
      recommended: recommendation ? recommendation.candidates.map((c) => c.playerId) : [],
      shortlist: list.map((e) => JSON.parse(JSON.stringify(e))),
      shortlistedAt: at, shortlistedBy: by || null,
      winner: null, winnerId: null, confirmedAt: null, confirmedBy: null,
      votes: (previous && previous.votes) || null,
      log: ((previous && previous.log) || []).concat([{ action: 'shortlisted', by: by || null, at, players: ids }]),
    };
  }

  function confirmWinner(record, { playerId, citation, by, at }) {
    if (!record || record.state !== STATE.SHORTLISTED) throw new Error('Finalise the shortlist before confirming a winner.');
    const entry = record.shortlist.find((e) => e.playerId === playerId);
    if (!entry) throw new Error('The winner must be on the shortlist.');
    const text = String(citation === undefined ? entry.citation : citation).trim();
    return {
      ...record,
      state: STATE.CONFIRMED,
      winner: {
        playerId: entry.playerId, name: entry.name, tier: entry.tier, title: entry.title,
        citation: text, stories: entry.stories, metrics: entry.metrics,
      },
      winnerId: entry.playerId,
      confirmedAt: at, confirmedBy: by || null,
      log: (record.log || []).concat([{ action: 'confirmed', by: by || null, at, playerId }]),
    };
  }

  // Corrects a mistaken confirmation. The shortlist stays; the withdrawn
  // winner is kept in the log, never silently lost.
  function reopen(record, { by, at }) {
    if (!record || record.state !== STATE.CONFIRMED) throw new Error('Only a confirmed month can be reopened.');
    return {
      ...record,
      state: STATE.SHORTLISTED,
      winner: null, winnerId: null, confirmedAt: null, confirmedBy: null,
      log: (record.log || []).concat([{ action: 'reopened', by: by || null, at, previousWinner: record.winner }]),
    };
  }

  // ---- Reading the awards --------------------------------------------------
  // `records` is an object keyed by month, or a list. `nameOf(playerId)` gives
  // a player's name today (a rename shows through); without one, or when the
  // id is unknown, the name stored with the award is used.

  const list = (records) => (Array.isArray(records) ? records : Object.values(records || {}));
  const isConfirmed = (r) => !!(r && r.state === STATE.CONFIRMED && r.winner && r.winnerId);

  function award(r, nameOf) {
    const current = nameOf ? nameOf(r.winnerId) : null;
    return {
      month: r.month, year: r.month.slice(0, 4), label: monthLabel(r.month),
      playerId: r.winnerId, name: current || r.winner.name,
      title: r.winner.title, citation: r.winner.citation, tier: r.winner.tier,
    };
  }

  // Every confirmed award, newest first.
  function history(records, { nameOf } = {}) {
    return list(records).filter(isConfirmed).sort((a, b) => (a.month < b.month ? 1 : -1)).map((r) => award(r, nameOf));
  }

  // One player's awards, oldest first ("Mar 2026 · Jun 2026 · Sep 2026").
  function awardsFor(records, playerId, { nameOf } = {}) {
    return list(records).filter((r) => isConfirmed(r) && r.winnerId === playerId)
      .sort((a, b) => (a.month < b.month ? -1 : 1)).map((r) => award(r, nameOf));
  }

  // Most awards: count, then name. Equal counts share a place.
  function awardCounts(records, { nameOf } = {}) {
    const by = {};
    history(records, { nameOf }).forEach((a) => {
      (by[a.playerId] = by[a.playerId] || { playerId: a.playerId, name: a.name, months: [] }).months.unshift(a.month);
    });
    const rows = Object.values(by).map((r) => ({ ...r, count: r.months.length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    let place = 0;
    return rows.map((r, i) => ({ ...r, place: i && rows[i - 1].count === r.count ? place : (place = i + 1) }));
  }

  return {
    RULES_VERSION, MIN_MATCHES, SHORTLIST_MIN, SHORTLIST_COMFORT, REASONS_SHOWN, STATE, SOURCE,
    STORIES, STORY, REASON_ORDER,
    monthLabel, qualifies, recommend, adminEntry, citationFor, supportLine, competitionStory,
    finaliseShortlist, confirmWinner, reopen, isConfirmed,
    history, awardsFor, awardCounts,
  };
});
