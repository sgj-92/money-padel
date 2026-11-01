// ===================== BOARD PACK: THE SHARE DECK =====================
// The player-facing Monthly Review: the Board Pack's selected modules, in the
// Board Pack's order, each told as one slide -- a headline, a few big
// figures, no tables. Built from the SAME module data the Board Pack draws
// (features/admin/boardPackData.js); this file only chooses what a slide
// shows and formats it. It calculates nothing.
//
// A slide is plain, render-ready data, so a published review can be stored
// exactly as it was shown and shown again months later unchanged:
//
//   { id, kind: 'module' | 'note', section,        // section: the visibility
//     eyebrow, title,                              //   setting that governs it
//     stats:  [{ value, label }],                  // big numbers, or
//     groups: [{ label, rows: [{ rank, label, name, value, sub }] }],  // lists, or
//     body,                                        // a note's text
//     foot, summary: [line] }                      // summary: its WhatsApp lines
//
// Pure: no page, no app state.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShareDeck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const VERSION = 1;
  // No slide lists more than this many rows: a slide is a headline, and the
  // full table is one tap away in the app.
  const ROWS = 5;
  const NOTE_BODY_MAX = 600;

  // Which visibility setting governs a slide. A slide built on a section the
  // club has made Admin-only is not shown to players.
  const SECTION = {
    power: 'power', kings: 'power', rating_movers: 'power', rank_movers: 'power',
    performance: 'power', crossovers: 'power', partnerships: 'chemistry',
  };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function monthLabel(month) {
    const [y, m] = String(month).split('-');
    return `${LONG[Number(m) - 1]} ${y}`;
  }
  const monthName = (month) => LONG[Number(String(month).split('-')[1]) - 1];
  const day = (ymd) => { const [, m, d] = String(ymd).split('-'); return `${Number(d)} ${MONTHS[Number(m) - 1]}`; };
  const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const record = (s) => `${s.wins}W ${s.draws}D ${s.losses}L`;
  const names = (list) => list.join(' / ');

  function storageKey(month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) throw new Error(`ShareDeck: not a month: ${month}`);
    return `moneypadel_review_${month}`;
  }

  const groupRows = (groups, fmt) => (groups || []).slice(0, ROWS).map((g) => Object.assign({ rank: String(g.rank), name: names(g.names) }, fmt(g)));
  const listRows = (rows, fmt) => (rows || []).slice(0, ROWS).map((r, i) => Object.assign({ rank: String(i + 1) }, fmt(r)));
  const nonEmpty = (groups) => groups.filter((g) => g.rows.length);

  // One slide per tier, leader first: which tier, who, and their figure.
  function tierLeaders(tiers, fmt) {
    return (tiers || []).filter((t) => t.rows.length).map((t) => Object.assign({ label: `Tier ${t.tier}` }, fmt(t.rows[0])));
  }

  // A slide per tier section -- every tier in the pack, each with its own
  // top five -- or the one slide when the list is not split. `make(rows,
  // tier)` builds a slide's fields; the tier's slide is `<module>:<tier>`.
  function perTier(tiers, make) {
    return (tiers || []).filter((t) => t.rows.length).map((t) => {
      const out = make(listRows(t.rows, (r) => r), t.tier);
      return t.tier === null ? out : Object.assign({ tier: t.tier }, out, { title: `${out.title} · Tier ${t.tier}` });
    });
  }

  // "Won (or Lost) N% or more": one slide, or nothing when nobody reached it.
  function thresholdSlide(d, what, list, pct, eyebrow, everyTitle) {
    const t = d.threshold || 80;
    const label = t === 100 ? `${what} every match` : `${what} ${t}% or more`;
    const rows = listRows(list, (s) => ({ name: s.name, value: `${s[pct]}%`, sub: `${record(s)} of ${s.games}` }));
    if (!rows.length) return null;
    return {
      eyebrow, title: t === 100 ? everyTitle : label, groups: [{ rows }],
      foot: d.min > 1 ? `${d.min}+ matches played` : '',
      summary: [`${label}: ${rows.map((r) => `${r.name} (${r.value})`).join(', ')}`],
    };
  }

  // module id -> (data, options, month) -> slide fields, or null when there is
  // nothing to say (an empty slide is left out of the deck).
  const BUILD = {
    overview: (d, o, month) => ({
      eyebrow: 'At a glance', title: `${monthName(month)} in numbers`,
      stats: [{ value: String(d.games), label: 'Games played' }, { value: String(d.players), label: 'Players' }, { value: String(d.draws), label: 'Draws' }],
      summary: [`${plural(d.games, 'game')} played · ${plural(d.players, 'player')} · ${plural(d.draws, 'draw')}`],
    }),

    results_table: (d, o) => {
      const by = o.sort === 'games' ? 'games' : o.sort === 'difficulty' ? 'difficulty' : 'points';
      const value = { points: (r) => `${r.points} pts`, games: (r) => plural(r.games, 'game'), difficulty: (r) => Number(r.hardness).toFixed(1) }[by];
      const title = { points: 'Top of the table', games: 'Most games played', difficulty: 'Toughest schedules' }[by];
      return perTier(d.tiers, (list, tier) => {
        const rows = list.map((r) => ({ rank: r.rank, name: r.name, value: value(r), sub: `${record(r)}${by === 'difficulty' ? ` · ${plural(r.games, 'game')}` : ''}` }));
        return {
          eyebrow: 'The month’s results', title, groups: [{ rows }],
          foot: by === 'points' ? '3 points a win, 1 a draw' : by === 'difficulty' ? 'Average strength of the games played ÷ 300' : '',
          summary: [`${title}${tier ? ` (Tier ${tier})` : ''}: ${rows[0].name} (${rows[0].value})`],
        };
      });
    },

    over_80: (d) => thresholdSlide(d, 'Won', d.won, 'winpct', 'Out on their own', 'Perfect months'),
    lost_pct: (d) => thresholdSlide(d, 'Lost', d.lost, 'losspct', 'Loss rate', 'Lost every match'),

    information: (d) => {
      const rows = [];
      const s = (g) => d.stats[g.names[0]];
      // Only once the group has chosen: the award, not the points leader.
      const potm = d.playerOfMonth && d.playerOfMonth.state === 'confirmed' ? d.playerOfMonth : null;
      if (potm) rows.push({ label: 'Player of the Month', name: names(potm.names), value: '👑', sub: (potm.winner && potm.winner.title) || '' });
      if (d.mostGames[0]) rows.push({ label: 'Most games', name: names(d.mostGames[0].names), value: String(d.mostGames[0].value) });
      if (d.highestWinPct[0]) rows.push({ label: 'Highest win %', name: names(d.highestWinPct[0].names), value: `${d.highestWinPct[0].value}%` });
      if (d.hardestGames[0]) rows.push({ label: 'Hardest games', name: names(d.hardestGames[0].names), value: String(d.hardestGames[0].value) });
      if (d.mostDoughnuts.length) rows.push({ label: 'Most doughnuts', name: names(d.mostDoughnuts), value: `×${d.doughnutMax}` });
      if (!rows.length) return null;
      return {
        eyebrow: 'Monthly awards', title: 'The month’s honours', groups: [{ rows }],
        summary: potm ? [`Player of the Month: ${names(potm.names)}`] : [],
      };
    },

    power: (d) => perTier(d.tiers, (list, tier) => {
      const rows = list.map((r) => ({ rank: r.rank, name: r.name, value: String(Math.round(r.rating)),
        sub: `${tier ? '' : `Tier ${r.tier || '–'}`}${r.ratingChange === null ? '' : `${tier ? '' : ' · '}${signed(r.ratingChange)} pts`}` }));
      return {
        eyebrow: 'Power Rankings', title: 'At month end', groups: [{ rows }],
        foot: `${d.minGames}+ game${d.minGames === 1 ? '' : 's'} in the month`
          + (d.players === 'ranked' ? ' \u00b7 Ranked players' : d.players === 'active' ? ' \u00b7 inactive left out' : ''),
        summary: [`Power Rankings${tier ? ` Tier ${tier}` : ''} #1: ${rows[0].name} (${rows[0].value})`],
      };
    }),

    kings: (d) => {
      if (!d.kings) return null;
      const rows = ['S', 'A', 'B', 'C'].filter((t) => d.kings[t]).map((t) => ({ tier: t, label: `Tier ${t}`, name: d.kings[t].name, value: String(d.kings[t].rating) }));
      if (!rows.length) return null;
      // Drawn as the app's Kings of Tiers: a crowned tile per tier, sized to
      // fill the card whether there are two kings or four.
      return {
        layout: 'kings', eyebrow: 'Kings of Tiers', title: 'Top of each tier', groups: [{ rows }],
        foot: 'Highest Power Rating in each tier at month end',
        summary: rows.map((r) => `${r.label} King: ${r.name}`),
      };
    },

    league: (d, o) => {
      if (o.slides !== 'leaders') return perTier(d.tiers, (list, tier) => ({ eyebrow: 'League', title: 'League table',
        groups: [{ rows: list.map((r) => ({ rank: r.rank, name: r.name, value: `${r.points} pts`, sub: record(r) })) }], foot: '3 points a win, 1 a draw',
        summary: [`League Tier ${tier}: ${list[0].name} (${list[0].points} pts)`] }));
      const rows = tierLeaders(d.tiers, (r) => ({ name: r.name, value: `${r.points} pts`, sub: record(r) }));
      if (!rows.length) return null;
      return { eyebrow: 'League', title: 'League leaders', groups: [{ rows }], foot: '3 points a win, 1 a draw',
        summary: rows.map((r) => `League ${r.label}: ${r.name} (${r.value})`) };
    },

    merit: (d, o) => {
      if (o.slides !== 'leaders') return perTier(d.tiers, (list, tier) => ({ eyebrow: 'Merit', title: 'Merit table',
        groups: [{ rows: list.map((r) => ({ rank: r.rank, name: r.playerId, value: `${r.merit} pts`, sub: plural(r.hardWins, 'hard win') })) }], foot: 'Harder wins earn more',
        summary: [`Merit Tier ${tier}: ${list[0].playerId} (${list[0].merit} pts)`] }));
      const rows = tierLeaders(d.tiers, (r) => ({ name: r.playerId, value: `${r.merit} pts`, sub: plural(r.hardWins, 'hard win') }));
      if (!rows.length) return null;
      return { eyebrow: 'Merit', title: 'Merit leaders', groups: [{ rows }], foot: 'Harder wins earn more',
        summary: rows.map((r) => `Merit ${r.label}: ${r.name} (${r.value})`) };
    },

    race: (d, o) => {
      if (o.slides !== 'leaders') return perTier(d.tiers, (list, tier) => ({ eyebrow: 'Monthly Race', title: 'Best month',
        groups: [{ rows: list.map((r) => ({ rank: r.qualified ? r.rank : '–', name: r.playerId, value: signed(r.score), sub: r.qualified ? plural(r.played, 'match', 'matches') : 'provisional' })) }],
        foot: `${d.minMatches}+ matches to qualify`, summary: [`Race Tier ${tier}: ${list[0].playerId} (${signed(list[0].score)})`] }));
      const rows = tierLeaders(d.tiers, (r) => ({ name: r.playerId, value: signed(r.score), sub: r.qualified ? plural(r.played, 'match', 'matches') : 'provisional' }));
      if (!rows.length) return null;
      return { eyebrow: 'Monthly Race', title: 'Best month', groups: [{ rows }], foot: `${d.minMatches}+ matches to qualify`,
        summary: rows.map((r) => `Race ${r.label}: ${r.name} (${r.value})`) };
    },

    most_wins: (d) => {
      const rows = groupRows(d.groups, (g) => ({ value: plural(d.stats[g.names[0]].wins, 'win'), sub: `${g.value} pts` }));
      if (!rows.length) return null;
      return { eyebrow: 'Most wins', title: 'Winning the most', groups: [{ rows }], summary: [`Most wins: ${rows[0].name} (${rows[0].value})`] };
    },

    best_record: (d) => {
      const rows = groupRows(d.groups, (g) => ({ value: `${g.value}%`, sub: record(d.stats[g.names[0]]) }));
      if (!rows.length) return null;
      return { eyebrow: 'Win rate', title: 'Best records', groups: [{ rows }], foot: `${d.minGames}+ games played`,
        summary: [`Best win rate: ${rows[0].name} (${rows[0].value})`] };
    },

    worst_record: (d) => {
      const rows = groupRows(d.groups, (g) => ({ value: `${g.value}%`, sub: record(d.stats[g.names[0]]) }));
      if (!rows.length) return null;
      return { eyebrow: 'Loss rate', title: 'Highest loss %', groups: [{ rows }], foot: `${d.minGames}+ games played · draws count as games`,
        summary: [`Highest loss rate: ${rows[0].name} (${rows[0].value})`] };
    },

    most_games: (d) => {
      const rows = groupRows(d.groups, (g) => ({ value: plural(g.value, 'game') }));
      if (!rows.length) return null;
      return { eyebrow: 'Most games', title: 'On court the most', groups: [{ rows }], summary: [`Most games: ${rows[0].name} (${rows[0].value})`] };
    },

    rating_movers: (d) => {
      const row = (r) => ({ name: r.playerId, value: `${signed(r.ratingChange)}`, sub: `${Math.round(r.startRating)} → ${Math.round(r.endRating)}` });
      const groups = nonEmpty([
        { label: 'Risers', rows: listRows(d.risers.slice(0, 3), row) },
        { label: 'Fallers', rows: listRows(d.fallers.slice(0, 3), row) },
      ]);
      if (!groups.length) return null;
      const summary = [];
      if (d.risers[0]) summary.push(`Biggest riser: ${d.risers[0].playerId} (${signed(d.risers[0].ratingChange)} pts)`);
      if (d.fallers[0]) summary.push(`Biggest faller: ${d.fallers[0].playerId} (${signed(d.fallers[0].ratingChange)} pts)`);
      return { eyebrow: 'Power Rating', title: 'Biggest movers', groups, foot: 'Points moved during the month', summary };
    },

    rank_movers: (d) => {
      const row = (r) => ({ name: r.playerId, value: `${r.rankChangeOverall > 0 ? '▲' : '▼'}${Math.abs(r.rankChangeOverall)}`, sub: `#${r.startRankOverall} → #${r.endRankOverall}` });
      const groups = nonEmpty([
        { label: 'Climbers', rows: listRows(d.climbers.slice(0, 3), row) },
        { label: 'Sliders', rows: listRows(d.sliders.slice(0, 3), row) },
      ]);
      if (!groups.length) return null;
      return { eyebrow: 'Rankings', title: 'On the move', groups,
        summary: d.climbers[0] ? [`Biggest climb: ${d.climbers[0].playerId} (▲${d.climbers[0].rankChangeOverall})`] : [] };
    },

    performance: (d) => {
      const rows = listRows(d.rows, (r) => ({ name: r.playerId, value: `${signed(r.performancePct)}%`, sub: plural(r.matches, 'game') }));
      if (!rows.length) return null;
      return { eyebrow: 'Performance', title: 'Beat expectations', groups: [{ rows }], foot: 'How far above pre-match expectation they played',
        summary: [`Beat expectations most: ${rows[0].name} (${rows[0].value})`] };
    },

    form: (d) => {
      const rows = listRows(d.rows, (r) => ({ name: r.name, value: `${r.points} pts`, sub: `${r.wins}W ${r.draws}D ${r.losses}L in ${r.games}` }));
      if (!rows.length) return null;
      return { eyebrow: 'Form', title: 'In form', groups: [{ rows }], foot: `Last ${d.window} games at month end`, summary: [`In form: ${rows[0].name}`] };
    },

    hard_wins: (d) => {
      const groups = nonEmpty([
        { label: 'Hard wins', rows: groupRows((d.hard || []).slice(0, 3), (g) => ({ value: String(g.value) })) },
        { label: 'Favoured wins', rows: groupRows((d.favoured || []).slice(0, 3), (g) => ({ value: String(g.value) })) },
      ]);
      if (!groups.length) return null;
      return { eyebrow: 'Merit', title: 'Wins that counted', groups, foot: 'Hard: beat a stronger pairing',
        summary: d.hard && d.hard[0] ? [`Most hard wins: ${names(d.hard[0].names)} (${d.hard[0].value})`] : [] };
    },

    doughnuts: (d) => {
      const groups = nonEmpty([
        { label: 'Received', rows: groupRows((d.received || []).slice(0, 3), (g) => ({ value: `×${g.value}` })) },
        { label: 'Given', rows: groupRows((d.given || []).slice(0, 3), (g) => ({ value: `×${g.value}` })) },
      ]);
      if (!groups.length) return null;
      return { eyebrow: 'Doughnuts', title: '6–0 sets', groups,
        summary: d.received && d.received[0] ? [`Most doughnuts received: ${names(d.received[0].names)} (×${d.received[0].value})`] : [] };
    },

    partnerships: (d) => {
      const rows = listRows(d.rows, (p) => ({ name: `${p.pair[0]} & ${p.pair[1]}`, value: `${signed(p.avg_overperf)}%`, sub: `${p.wins}W ${p.draws || 0}D ${p.losses}L together` }));
      if (!rows.length) return null;
      return { eyebrow: 'Partnerships', title: 'Best pairings', groups: [{ rows }], foot: 'Chemistry: how far a pair beat what the matchup predicted',
        summary: [`Best pairing: ${rows[0].name}`] };
    },

    tier_moves: (d) => {
      const rows = (d.rows || []).slice(0, ROWS).map((c) => ({ name: c.name, value: `${c.fromTier} → ${c.toTier}`, sub: day(c.date) }));
      if (!rows.length) return null;
      return { eyebrow: 'Tiers', title: 'Tier moves', groups: [{ rows }],
        summary: rows.map((r) => `${r.name}: Tier ${r.value.replace(' → ', ' → Tier ')}`) };
    },

    crossovers: (d) => {
      const rows = (d.rows || []).slice(0, ROWS).map((c) => ({ name: `${c.overtook} passed ${c.overtaken}`, value: '' }));
      if (!rows.length) return null;
      return { eyebrow: 'Rankings', title: 'Crossovers', groups: [{ rows }], summary: [] };
    },
  };

  // One Board Pack item and its module data -> a slide, or null.
  // A module's slides: most make one; a list split by tier makes one per
  // tier (`<module>:<tier>`). Empty, none.
  function slidesFor(item, data, month) {
    if (item.kind === 'note') { const n = slideFor(item, data, month); return n ? [n] : []; }
    const build = BUILD[item.id];
    if (!build || !data) return [];
    const out = build(data, item.options || {}, month);
    return (Array.isArray(out) ? out : [out]).filter(Boolean).map((x) => Object.assign(
      { id: x.tier ? `${item.id}:${x.tier}` : item.id, kind: 'module', section: SECTION[item.id] || null, groups: [], stats: [], foot: '', summary: [] }, x));
  }

  // One slide: a note's, or a module's first.
  function slideFor(item, data, month) {
    if (item.kind === 'note') {
      const body = String(item.body || '').trim();
      const title = String(item.title || '').trim();
      if (!body && !title) return null;
      return {
        id: `note:${item.id}`, kind: 'note', section: null, eyebrow: 'From the club', title: title || 'A word from the club',
        body: body.length > NOTE_BODY_MAX ? body.slice(0, NOTE_BODY_MAX - 1).trimEnd() + '…' : body, summary: [],
      };
    }
    return slidesFor(item, data, month)[0] || null;
  }

  // The deck for a month: [{ item, data }] in the Board Pack's order.
  function build(month, entries) {
    return {
      version: VERSION, month, title: `${monthLabel(month)} Review`,
      slides: entries.flatMap(({ item, data }) => slidesFor(item, data, month)),
    };
  }

  // What a player may see: slides on a section the club has made Admin-only
  // are left out.
  function visibleSlides(deck, canSee) {
    return deck.slides.filter((s) => !s.section || canSee(s.section));
  }

  // What is stored when a review is published: the deck exactly as shown,
  // and who published it, when, and which revision this is.
  function publication({ deck, by, at, basis, previous }) {
    return {
      version: VERSION, month: deck.month,
      revision: (previous && previous.revision ? previous.revision : 0) + 1,
      firstPublishedAt: (previous && previous.firstPublishedAt) || at,
      publishedAt: at, publishedBy: by || null, basis: basis || null,
      deck,
    };
  }

  // Unpublishing: the review stays stored, marked withdrawn, so the link
  // stops showing it at once and publishing again brings it back as the
  // next revision. Nothing is deleted.
  function withdrawal(previous, { by, at }) {
    return Object.assign({}, previous, { withdrawn: true, withdrawnAt: at, withdrawnBy: by || null });
  }

  const isLive = (pub) => !!(pub && pub.deck && !pub.withdrawn);

  // Same slides, same order, same words: nothing to republish.
  function sameDeck(a, b) {
    return !!a && !!b && JSON.stringify(a.slides) === JSON.stringify(b.slides);
  }

  // The WhatsApp text: plain lines, the headline of each slide, then the link.
  function summaryText(deck, { link, canSee } = {}) {
    const lines = [`*${deck.summaryTitle || `Money Padel — ${monthLabel(deck.month)}`}*`];
    visibleSlides(deck, canSee || (() => true)).forEach((s) => s.summary.forEach((l) => lines.push(l)));
    if (link) lines.push('', deck.linkLabel || `Full ${monthName(deck.month)} review:`, link);
    return lines.join('\n');
  }

  return { VERSION, ROWS, NOTE_BODY_MAX, SECTION, monthLabel, storageKey, slideFor, slidesFor, build, visibleSlides, publication, withdrawal, isLive, sameDeck, summaryText };
});
