// ===================== ASK CLAUDE: THE CLUB'S DATA, AS FILES =====================
// Shaun, 13 Nov: Admins ask Claude questions about the data -- the occasional
// question a player asks that no screen answers. Claude works them out with
// code over these files rather than by eye, so a count is a count.
//
// What goes in is the club's own record, as the app reads it: players,
// every rated match with its sets, the rating journey, and the Admin's notes
// on results. Display names throughout (a renamed player is shown as the
// club sees them). Nothing else -- no accounts, codes or settings.
//
// PURE: the record is passed in; the files come back as text.

'use strict';

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(header, rows) {
  return [header.join(',')].concat(rows.map((r) => r.map(csvCell).join(','))).join('\n') + '\n';
}
const round = (v, dp) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(dp)) : '');

function build({ players, matches, journey, notes, tags }) {
  const shown = {};
  (players || []).forEach((p) => { shown[p.id] = (p.displayName && String(p.displayName).trim()) || p.id; });
  const name = (id) => shown[id] || id;
  const tagOf = (n) => {
    const key = Object.keys(tags || {}).find((k) => k.toLowerCase() === String(n).toLowerCase());
    return key ? tags[key] : null;
  };

  const playersCsv = csv(
    ['player', 'tier', 'power_rating', 'reliability', 'rated_matches', 'status', 'active'],
    (players || []).slice().sort((a, b) => name(a.id).localeCompare(name(b.id))).map((p) => {
      const t = tagOf(p.id) || tagOf(name(p.id));
      return [name(p.id), p.tier, round(p.rating, 1), round(p.reliability, 3), p.lifetimeMatches, p.classificationStatus,
        t && (t.archived || t.active === false) ? 'no' : 'yes'];
    }));

  const ordered = (matches || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.sourceIndex || 0) - (b.sourceIndex || 0)));
  const matchesCsv = csv(
    ['match_id', 'date', 'type', 'side_a_1', 'side_a_2', 'side_b_1', 'side_b_2', 'result', 'sets', 'sets_a', 'sets_b', 'games_a', 'games_b',
      'forfeit_by', 'forfeit_partner_left_out', 'late_by', 'late_on_time_partner', 'late_played_result', 'asterisk', 'note'],
    ordered.map((m) => {
      const sets = (m.sets || []).map((s) => [s.teamA, s.teamB]);
      const n = (notes || {})[m.id] || null;
      const played = m.late && m.late.playedOutcome;
      return [m.id, m.date, m.type || 'doubles', name(m.teamA[0]), m.teamA[1] ? name(m.teamA[1]) : '', name(m.teamB[0]), m.teamB[1] ? name(m.teamB[1]) : '',
        m.outcome === 'DRAW' ? 'draw (not finished)' : 'side A won',
        sets.map((s) => s.join('-')).join(' '),
        sets.filter((s) => s[0] > s[1]).length, sets.filter((s) => s[1] > s[0]).length,
        sets.reduce((t, s) => t + s[0], 0), sets.reduce((t, s) => t + s[1], 0),
        m.forfeit ? name(m.forfeit.by) : '', m.forfeit ? (m.forfeit.unaffected || []).map(name).join(' & ') : '',
        m.late ? (m.late.by || []).map(name).join(' & ') : '', m.late ? (m.late.onTime || []).map(name).join(' & ') : '',
        played ? (played === 'DRAW' ? 'draw' : played === 'A_WINS' ? 'side A won' : 'side B won') : '',
        n && n.asterisk ? 'yes' : '', n && n.note ? n.note : ''];
    }));

  const journeyCsv = csv(
    ['date', 'player', 'event', 'match_id', 'side', 'tier_at_event', 'rating_before', 'rating_after', 'rating_change', 'expected_score', 'actual_score', 'new_tier', 'reason'],
    (journey || []).slice().sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : a.effectiveDate > b.effectiveDate ? 1 : String(a.id).localeCompare(String(b.id))))
      .map((e) => {
        const match = e.eventType === 'MATCH_UPDATE';
        return [e.effectiveDate, name(e.playerId), e.eventType, e.matchId || '', e.side || '', e.tierAtEvent || e.previousTier || '',
          round(match ? e.preMatchRating : e.previousPowerRating, 1), round(match ? e.postMatchRating : e.newPowerRating, 1),
          match ? round(e.ratingDelta, 2) : (typeof e.newPowerRating === 'number' && typeof e.previousPowerRating === 'number' ? round(e.newPowerRating - e.previousPowerRating, 2) : ''),
          match ? round(e.preMatchExpectedScore, 3) : '', match ? round(e.actualScore, 3) : '', e.newTier || '', e.reasonCode || e.decisionType || ''];
      }));

  return [
    { filename: 'players.csv', text: playersCsv },
    { filename: 'matches.csv', text: matchesCsv },
    { filename: 'rating_journey.csv', text: journeyCsv },
  ];
}

module.exports = { build, csv };
