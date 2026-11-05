// ===================== PLAYER MONTHLY PACK: THE DECK =====================
// One player's month as a Share Deck: the same slide shape as the club's
// Monthly Review (domain/boardPack/shareDeck.js), so the same drawing, the
// same pictures and the same publishing serve both. Each slide is short --
// a headline, the top few, the sample behind them -- and every figure comes
// from the module data it is given. Nothing is calculated here.
//
// Pure: no page, no app state.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlayerDeck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // The community (config/club.js): the page's, or Money Padel in Node.
  const club = () => (typeof CLUB !== 'undefined' ? CLUB : require('../../config/club.js').CLUB);
  const ROWS = 5;
  const NOTE_MAX = 600;
  const record = (t) => `${t.wins}W ${t.draws}D ${t.losses}L`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n * 10) / 10)}`;
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = (ymd) => { const [, m, d] = String(ymd).split('-'); return `${Number(d)} ${MONTHS[Number(m) - 1]}`; };
  const score = (sets) => (sets || []).map((s) => `${s[0]}–${s[1]}`).join(' ');
  const vs = (m) => `${m.partners.length ? `with ${m.partners.join(' & ')} ` : ''}v ${m.opponents.join(' & ')}`;

  const BUILD = {
    overview: (d) => {
      const r = d.record;
      const lines = [];
      d.league.forEach((l) => lines.push(`League: ${ordinal(l.position)} of ${l.of} in Tier ${l.tier} (${plural(l.points, 'pt')})`));
      d.race.forEach((x) => lines.push(x.qualified ? `Monthly Race: ${ordinal(x.position)} in Tier ${x.tier}` : `Monthly Race: provisional in Tier ${x.tier}`));
      return {
        eyebrow: 'Month at a glance', title: 'Your month',
        stats: [{ value: String(r.played), label: r.played === 1 ? 'Match' : 'Matches' }, { value: `${r.wins}–${r.draws}–${r.losses}`, label: 'Won · Drawn · Lost' }, { value: `${r.winpct}%`, label: 'Win rate' }],
        foot: lines.join(' · '),
        summary: [`${plural(r.played, 'match', 'matches')}: ${record(r)} (${r.winpct}%)`].concat(lines.slice(0, 1)),
      };
    },
    matchups: (d) => {
      if (!d.rows.length) return null;
      const rows = d.rows.slice(0, ROWS).map((t) => ({ label: t.label, name: record(t), value: `${t.winpct}%`, sub: plural(t.played, 'match', 'matches') }));
      return { eyebrow: 'Matchup types', title: 'How each matchup went', groups: [{ rows }],
        foot: 'Your team’s tiers v theirs, on the day', summary: [] };
    },
    partners: (d) => {
      if (!d.rows.length) return null;
      const rows = d.rows.slice(0, 3).map((t) => ({ name: t.name, value: record(t), sub: `${plural(t.played, 'match', 'matches')} together` }));
      return { eyebrow: 'Partners', title: 'Who you played with', groups: [{ rows }],
        foot: d.strongest ? `Best chemistry: ${d.strongest.partner} (${signed(d.strongest.chemistry)}%, ${plural(d.strongest.decided, 'game')})` : '',
        summary: [`Most played partner: ${d.rows[0].name} (${record(d.rows[0])})`] };
    },
    rivals: (d) => {
      const rows = [];
      const add = (label, t) => { if (t) rows.push({ label, name: t.name, value: record(t), sub: plural(t.played, 'match', 'matches') }); };
      add('Most played', d.mostPlayed);
      add('Best record', d.best);
      add('Toughest record', d.toughest);
      if (d.closest && ![d.mostPlayed, d.best, d.toughest].some((t) => t && t.name === d.closest.name)) add('Closest', d.closest);
      if (!rows.length) return null;
      return { eyebrow: 'Head-to-head', title: 'Your opponents', groups: [{ rows }],
        foot: `Records over ${d.min}+ matches`, summary: rows.slice(0, 1).map((r) => `${r.label} opponent: ${r.name} (${r.value})`) };
    },
    best: (d) => {
      const rows = [];
      if (d.hardestWin) rows.push({ label: 'Hardest win', name: vs(d.hardestWin), value: score(d.hardestWin.sets), sub: `${day(d.hardestWin.date)} · ${d.hardestWin.mine} vs ${d.hardestWin.theirs}` });
      if (d.biggestGain) rows.push({ label: 'Biggest rating gain', name: vs(d.biggestGain), value: signed(d.biggestGain.ratingDelta), sub: day(d.biggestGain.date) });
      if (d.bestShare) rows.push({ label: 'Best game share', name: vs(d.bestShare), value: `${d.bestShare.share}%`, sub: `${score(d.bestShare.sets)} · ${day(d.bestShare.date)}` });
      if (d.winRun) rows.push({ label: 'Winning run', name: plural(d.winRun.length, 'win') + ' in a row', value: '', sub: `${day(d.winRun.from)} – ${day(d.winRun.to)}` });
      if (!rows.length) return null;
      return { eyebrow: 'Best results', title: 'Your highlights', groups: [{ rows: rows.slice(0, 4) }], summary: [] };
    },
    weaker: (d) => {
      const rows = [];
      if (d.matchup) rows.push({ label: 'Matchup', name: d.matchup.label, value: record(d.matchup), sub: plural(d.matchup.played, 'match', 'matches') });
      if (d.opponent) rows.push({ label: 'Opponent', name: d.opponent.name, value: record(d.opponent), sub: plural(d.opponent.played, 'match', 'matches') });
      if (d.partner) rows.push({ label: 'Partnership', name: d.partner.name, value: record(d.partner), sub: plural(d.partner.played, 'match', 'matches') });
      if (!rows.length) return null;
      return { eyebrow: 'To work on', title: 'Where results were weaker', groups: [{ rows }], foot: `Only where there were ${d.min}+ matches`, summary: [] };
    },
    movement: (d) => {
      if (!d.power) return null;
      const p = d.power;
      const stats = [{ value: signed(p.change), label: 'Power Rating moved' }, { value: String(Math.round(p.start)), label: 'Start' }, { value: String(Math.round(p.end)), label: 'End' }];
      const foot = [p.tierRank ? `Tier ${p.tierEnd} rank at month end: ${ordinal(p.tierRank)}` : '',
        p.rankChange ? `overall rank ${p.rankChange > 0 ? 'up' : 'down'} ${Math.abs(p.rankChange)}` : '',
        p.byDecision ? `${signed(p.byDecision)} by club decision` : ''].filter(Boolean).join(' · ');
      return { section: 'power', eyebrow: 'Power Rating', title: 'Your movement', stats, foot,
        summary: [`Power Rating: ${Math.round(p.start)} → ${Math.round(p.end)} (${signed(p.change)})`] };
    },
    targets: (d) => {
      if (!d.rows.length) return null;
      const rows = d.rows.map((t, i) => ({ rank: String(i + 1), name: t.title, value: '', sub: t.reason }));
      return { eyebrow: 'Next month', title: 'Ideas for next month', layout: 'targets', groups: [{ rows }],
        foot: 'From this month’s record — what to play, not a forecast', summary: d.rows.map((t) => `• ${t.title}`) };
    },
  };

  function slideFor(item, data, ctx) {
    if (item.kind === 'note') {
      const body = String(item.body || '').trim();
      const title = String(item.title || '').trim();
      if (!body && !title) return null;
      return { id: `note:${item.id}`, kind: 'note', section: null, eyebrow: 'Admin note', title: title || 'From the club',
        body: body.length > NOTE_MAX ? body.slice(0, NOTE_MAX - 1).trimEnd() + '…' : body, summary: [] };
    }
    const build = BUILD[item.id];
    if (!build || !data) return null;
    const out = build(data, ctx);
    if (!out) return null;
    if (item.id === 'targets') out.title = `Ideas for ${ctx.nextMonthName}`;
    return Object.assign({ id: item.id, kind: 'module', section: null, groups: [], stats: [], foot: '', summary: [] }, out);
  }

  const NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // [{ item, data }] in the pack's order -> a deck with the player's cover.
  function build({ player, month, monthLabel, entries }) {
    // The period after this one: "November", or a quarter's "Jan–Mar".
    const period = typeof Period !== 'undefined' ? Period : require('../../config/period.js');
    const ctx = { nextMonthName: period.MONTHS === 1 ? NAMES[Number(month.split('-')[1]) % 12] : period.name(period.next(month)) };
    return {
      version: 1, kind: 'player', month, player,
      title: `${player} · ${monthLabel}`, monthLabel,
      cover: { title: player, sub: `${monthLabel} · Monthly Pack` },
      closing: { title: `That’s your ${period.MONTHS === 1 ? NAMES[Number(month.split('-')[1]) - 1] : period.name(month)}.`, text: 'Every game, every table and your full record are in ' + club().name + '.' },
      summaryTitle: `${player} — ${monthLabel}`, linkLabel: 'Your full monthly pack:',
      slides: entries.map(({ item, data }) => slideFor(item, data, ctx)).filter(Boolean),
    };
  }

  return { ROWS, slideFor, build };
});
