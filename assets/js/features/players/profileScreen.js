// ===================== PLAYERS: PROFILE =====================
// The player profile sheet: the legacy openSheet (section builders, match log,
// Rating Journey chart and rows, the profile's own month) and the premium
// profile drawn over it (hero, facts row, analysis, partnerships, You vs X,
// results). Presentation and wiring; the journey itself is the persisted one
// (playerJourney in app.js), and profileData.js holds the lookups.
//
// Extracted from app.js and shell.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: redesign. profileMonth stays in app.js with the other per-screen
// months. Loads before app.js; declarations only. shell.js still wraps
// window.openSheet at start-up so the premium profile draws over it.

function buildProfileText(p){
  const parts = [];

  // confidence / sample size
  if(p.confidence === 'low'){
    parts.push(`Only ${p.total} game${p.total===1?'':'s'} played so far — this rating leans heavily on the Tier ${p.tier} baseline rather than on much personal evidence, so it's the least certain kind of number in this dataset.`);
  } else if(p.confidence === 'medium'){
    parts.push(`${p.total} games played — enough to start moving away from the Tier ${p.tier} baseline, but still a fairly thin sample.`);
  } else {
    parts.push(`${p.total} games played — a solid track record, so this rating is largely earned rather than assumed from the tier.`);
  }

  // position within tier -- the one Tier Rank, not a count of everyone in it
  const tr = tierRankOf(p.name);
  const rankText = tr && tr.rank ? `Ranked #${tr.rank} of ${tr.of} in Tier ${p.tier}` : `Not currently ranked in Tier ${p.tier}`;
  if(Math.abs(p.rating_vs_tier_avg) < 15){
    parts.push(`${rankText}, right around the tier average (${Math.round(p.tier_avg_rating)}).`);
  } else if(p.rating_vs_tier_avg > 0){
    parts.push(`${rankText}, ${Math.round(p.rating_vs_tier_avg)} points above the tier average (${Math.round(p.tier_avg_rating)}).`);
  } else {
    parts.push(`${rankText}, ${Math.round(Math.abs(p.rating_vs_tier_avg))} points below the tier average (${Math.round(p.tier_avg_rating)}).`);
  }

  // schedule strength
  if(Math.abs(p.opp_vs_tier_avg) < 20){
    parts.push(`Opposition faced has been about average for the tier.`);
  } else if(p.opp_vs_tier_avg > 0){
    parts.push(`Opposition faced has run tougher than the tier average by ${Math.round(p.opp_vs_tier_avg)} points — a harder schedule than most tier-mates.`);
  } else {
    parts.push(`Opposition faced has run softer than the tier average by ${Math.round(Math.abs(p.opp_vs_tier_avg))} points — an easier schedule than most tier-mates.`);
  }

  // clutch
  if(p.avg_overperf_pct > 3){
    parts.push(`Scorelines have run ahead of what the ratings predicted (+${p.avg_overperf_pct}% clutch) — results have generally been better than expected.`);
  } else if(p.avg_overperf_pct < -3){
    parts.push(`Scorelines have run behind what the ratings predicted (${p.avg_overperf_pct}% clutch) — results have generally been a bit worse than expected.`);
  } else {
    parts.push(`Scorelines have tracked expectation closely (${p.avg_overperf_pct>=0?'+':''}${p.avg_overperf_pct}% clutch) — nothing unusual going on there.`);
  }

  // upsets
  if(p.upset_wins > 0 || p.upset_losses > 0){
    parts.push(`${p.upset_wins} upset win${p.upset_wins===1?'':'s'} and ${p.upset_losses} upset loss${p.upset_losses===1?'':'es'} on record.`);
  }

  // risk verdict
  if(p.risk === 'promotion_watch'){
    parts.push(`<b>Sits within ${Math.round(p.promotion_gap)} points of the tier above's floor</b> — a decent run would make a real case for promotion.`);
  } else if(p.risk === 'demotion_watch'){
    parts.push(`<b>Sits within ${Math.round(p.demotion_gap)} points of the tier below's ceiling</b> — worth keeping an eye on, though not a clear-cut case yet.`);
  } else if(p.risk === 'unproven'){
    parts.push(`Too little data to say anything definitive about tier placement either way.`);
  } else {
    parts.push(`Comfortably clear of both tier boundaries — no case for moving either way right now.`);
  }

  // best partnership
  const bp = BEST_PARTNER[p.name];
  if(bp){
    const smallSample = bp.games < 3 ? ' (small sample)' : '';
    parts.push(`Best chemistry so far has been with <b>${bp.partner}</b> — ${PlayerForm.recordShort(bp)} together (${bp.winpct}%), ${bp.avg_overperf>=0?'+':''}${bp.avg_overperf}% ahead of what the matchups alone predicted${smallSample}.`);
  }

  return parts.join(' ');
}

function buildCallOutSection(name){
  if(!canSee('callouts')) return '';
  const relevant = [];
  WITHIN_TIER_GAMES.forEach(c=>{ if(c.a===name || c.b===name) relevant.push(c.matchup); });
  BOUNDARY_TESTS.forEach(c=>{ if(c.a===name || c.b===name) relevant.push(c.matchup); });
  CALIBRATION_GAMES.forEach(c=>{ if(c.name===name) relevant.push(c.matchup); });
  if(relevant.length === 0) return '';
  let html = `<div class="section-heading" style="margin-top:14px;">📋 Call-out for ${name}</div>`;
  relevant.forEach(m=>{
    html += `<div class="matchup-vs"><b>${m.team1[0]} &amp; ${m.team1[1]}</b> (${Math.round(m.team1_rating)}) &nbsp;vs&nbsp; <b>${m.team2[0]} &amp; ${m.team2[1]}</b> (${Math.round(m.team2_rating)})<br/><span style="color:var(--text-dim); font-size:11px;">this would help settle where ${name}'s rating actually sits</span></div>`;
  });
  return html;
}

function buildDifficultySection(name){
  if(!canSee('difficulty')) return '';
  const d = DIFFICULTY_SUGGESTIONS[name];
  if(!d || !d.easy || !d.balanced || !d.hard) return '';
  const easy = d.easy, bal = d.balanced, hard = d.hard;
  const player = PLAYERS.find(p=>p.name===name);
  const tierNote = d.withinTier
    ? `within Tier ${player ? player.tier : ''}`
    : `across any tier — not enough other Tier ${player ? player.tier : ''} players to keep this within-tier`;
  const allSame = (easy.pair.join()===bal.pair.join()) && (bal.pair.join()===hard.pair.join());

  let html = `<div class="section-heading" style="margin-top:14px;">🎮 Suggest a game for ${name}</div>`;
  if(allSame){
    html += `<div class="section-sub">${name}'s rating is far enough out on its own that there's no meaningful easy/hard range (${tierNote}) — this is simply the toughest game available.</div>
      <div class="matchup-vs"><b>${easy.pair[0]} &amp; ${easy.pair[1]}</b> (avg ${Math.round(easy.avg_rating)})</div>`;
  } else {
    html += `<div class="section-sub">Opponent pairs picked so the two-player average lands near an easy / even / hard target relative to ${name}'s own rating, ${tierNote}.</div>
      <div class="difficulty-row">
        <div class="difficulty-pill diff-easy">EASY</div>
        <div class="difficulty-pill diff-balanced">BALANCED</div>
        <div class="difficulty-pill diff-hard">HARD</div>
      </div>
      <div class="matchup-vs"><b>Easy:</b> ${easy.pair[0]} &amp; ${easy.pair[1]} (avg ${Math.round(easy.avg_rating)})</div>
      <div class="matchup-vs"><b>Balanced:</b> ${bal.pair[0]} &amp; ${bal.pair[1]} (avg ${Math.round(bal.avg_rating)})</div>
      <div class="matchup-vs"><b>Hard:</b> ${hard.pair[0]} &amp; ${hard.pair[1]} (avg ${Math.round(hard.avg_rating)})</div>`;
  }

  if(d.crossTier && (!d.withinTier || d.crossTier.pair.join() !== bal.pair.join())){
    html += `<div style="margin-top:10px; font-size:11px; color:var(--gold-soft); text-transform:uppercase; letter-spacing:.04em;">Recommended across tiers</div>
      <div class="matchup-vs"><b>${d.crossTier.pair[0]} &amp; ${d.crossTier.pair[1]}</b> (avg ${Math.round(d.crossTier.avg_rating)}) <span style="color:var(--text-dim); font-size:11px;">— closest overall rating match, any tier</span></div>`;
  }
  return html;
}

function buildRankingNeighborsSection(name){
  const target = PLAYERS.find(p=>p.name===name);
  if(!target) return '';
  const pool = PLAYERS.filter(p => p.active || p.name === name).sort((a,b)=> b.rating - a.rating);
  const idx = pool.findIndex(p=>p.name===name);
  if(idx === -1) return '';
  const above = idx > 0 ? pool[idx-1] : null;
  const below = idx < pool.length-1 ? pool[idx+1] : null;

  let html = `<div class="section-heading" style="margin-top:14px;">📊 Neighbours in the rankings</div>`;
  if(!target.active){
    html += `<div class="section-sub">${name} is ${target.status === 'archived' ? 'archived' : 'temporarily inactive'} — shown against the players playing now.</div>`;
  }
  html += `<div class="matchup-vs">`;
  if(above){
    const gap = Math.round((above.rating - target.rating)*10)/10;
    html += `<div>▲ <b>${above.name}</b> (Tier ${above.tier}, ${Math.round(above.rating)}) — ${gap} pts above</div>`;
  } else {
    html += `<div style="color:var(--text-dim);">▲ Nobody rated higher — top of the board</div>`;
  }
  html += `<div style="margin:6px 0; padding:4px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); text-align:center; color:var(--gold-bright); font-weight:700;">${name}</div>`;
  if(below){
    const gap = Math.round((target.rating - below.rating)*10)/10;
    html += `<div>▼ <b>${below.name}</b> (Tier ${below.tier}, ${Math.round(below.rating)}) — ${gap} pts below</div>`;
  } else {
    html += `<div style="color:var(--text-dim);">▼ Nobody rated lower — bottom of the board</div>`;
  }
  html += `</div>`;
  return html;
}

const JOURNEY_MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function journeyDateLabel(iso){
  if(!iso) return '';
  const parts = String(iso).split('-');
  if(parts.length < 3) return String(iso);
  return `${Number(parts[2])} ${JOURNEY_MONTH_ABBR[Number(parts[1])-1] || parts[1]}`;
}

function journeyPct(v){ return (v === null || v === undefined) ? '—' : `${Math.round(v*100)}%`; }

function journeySigned(v){
  if(v === null || v === undefined) return '';
  const r = Math.round(v*10)/10;
  return r > 0 ? `+${r}` : `${r}`;
}

function journeyDeltaHtml(v){
  if(v === null || v === undefined) return '';
  const cls = v > 0 ? 'perf-pos' : (v < 0 ? 'perf-neg' : '');
  return `<span class="${cls}" style="font-weight:700;">${journeySigned(v)} pts</span>`;
}

// The chart. A reassessment and a tier change are drawn differently from a
// match on purpose: one is a club decision, the other moves no rating at all,
// and neither should read as a result on court.
function buildV3JourneyChartSvg(journey){
  const series = JourneyView.chartSeries(journey);
  const w = 320, h = 110, padX = 8, padY = 14;
  const ratings = series.map(s=>s.rating);
  const minR = Math.min(...ratings), maxR = Math.max(...ratings);
  const range = (maxR - minR) || 1;
  const stepX = series.length > 1 ? (w - padX*2) / (series.length - 1) : 0;
  const xy = (s,i) => [padX + i*stepX, padY + (h - padY*2) * (1 - (s.rating - minR)/range)];
  const points = series.map((s,i)=> xy(s,i).map(v=>v.toFixed(1)).join(',')).join(' ');

  const marks = series.map((s,i)=>{
    const [x,y] = xy(s,i);
    if(s.isAnnotation){
      // Annotated, not plotted as movement: the rating did not change here.
      return `<line x1="${x.toFixed(1)}" y1="${(padY-8).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(h-padY+8).toFixed(1)}" stroke="#c8a96a" stroke-width="1" stroke-dasharray="2,3" opacity="0.75"/>`
        + `<rect x="${(x-2.8).toFixed(1)}" y="${(y-2.8).toFixed(1)}" width="5.6" height="5.6" fill="var(--bg, #14120f)" stroke="#c8a96a" stroke-width="1.3"/>`;
    }
    if(s.isJump){
      return `<polygon points="${x.toFixed(1)},${(y-4.4).toFixed(1)} ${(x+4.4).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(y+4.4).toFixed(1)} ${(x-4.4).toFixed(1)},${y.toFixed(1)}" fill="#7ba7d4"/>`;
    }
    const color = s.kind === 'match'
      ? (s.delta > 0 ? '#5a9c5a' : (s.delta < 0 ? '#b5453f' : '#a89c82'))
      : '#a89c82';
    const r = (i === series.length-1) ? 4 : 2.3;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}"/>`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%; height:${h}px; display:block;">
    <polyline points="${points}" fill="none" stroke="#a89c82" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" opacity="0.45"/>
    ${marks}
  </svg>`;
}

function journeyMatchDescription(name, matchId){
  const m = MATCHES.find(x => x.id === matchId);
  if(!m) return null;
  const won = m.winners.includes(name);
  const myTeam = won ? m.winners : m.losers;
  const oppTeam = won ? m.losers : m.winners;
  const partner = myTeam.filter(n => n !== name)[0] || null;
  return {
    won, partner, opponents: oppTeam.join(' & '),
    resultWord: m.isDraw ? 'Drew' : (won ? 'Beat' : 'Lost to'),
    score: m.score || '',
  };
}

// One row per event. Every row states what kind of event it was, because the
// kinds are not interchangeable: only a match is a result.
function buildJourneyEventRowHtml(name, e){
  const after = Math.round(e.rating);
  const date = journeyDateLabel(e.date);
  const row = (tag, title, detail) => `<div class="matchup-vs" style="margin-top:6px; padding:8px;">
      <div style="font-size:10px; color:var(--gold-soft); text-transform:uppercase; letter-spacing:.03em;">${date}${tag ? ` · ${tag}` : ''}</div>
      <div style="font-weight:700; color:var(--text); margin-top:2px;">${title}</div>
      <div style="font-size:11.5px; color:var(--text-dim); line-height:1.5; margin-top:2px;">${detail}</div>
    </div>`;

  if(e.kind === 'initialised'){
    return row('Joined', `Entered at Tier ${e.tier || '—'} — starting Power Rating ${after}`,
      `Reliability 0% — no evidence yet. Everything after this point was earned.`);
  }
  if(e.kind === 'tier'){
    const title = e.eventType === 'PROMOTION' ? `Promoted to Tier ${e.tier}`
      : (e.eventType === 'DEMOTION' ? `Moved down to Tier ${e.tier}`
      : `Stayed in Tier ${e.tier}`);
    return row('Tier change', title,
      `Power Rating unchanged at <b>${after}</b>, reliability unchanged at ${journeyPct(e.reliability)}. A tier change moves neither — it changes who ${name} is ranked against, not what the rating says.`);
  }
  if(e.kind === 'correction'){
    // A correction may or may not move the rating: the board is replacing an
    // initial estimate, and sometimes only the tier was wrong. Saying
    // "unchanged" either way was false the moment corrections began carrying a
    // rating decision, and it was false on the most-read screen in the app.
    const moved = !!e.delta;
    const before = e.previousRating === null || e.previousRating === undefined ? null : Math.round(e.previousRating);
    const detail = moved
      ? `Power Rating ${before === null ? '—' : before} → <b>${after}</b> (${journeyDeltaHtml(e.delta)})`
        + `, reliability ${journeyPct(e.previousReliability)} → ${journeyPct(e.reliability)}.`
        + ` The club judged the original estimate wrong and replaced it. This is a decision, not a result on court.`
      : `Power Rating unchanged at <b>${after}</b>, reliability unchanged at ${journeyPct(e.reliability)}.`
        + ` The starting tier was wrong; the evidence gathered since was not, so none of it was discarded.`;
    return row('Classification corrected', `Initial tier corrected: Tier ${e.previousTier || '—'} → Tier ${e.tier || '—'}`, detail);
  }
  if(e.kind === 'reassessment'){
    const before = e.previousRating === null ? null : Math.round(e.previousRating);
    return row('Club decision', `Club rating reassessment`,
      `Power Rating ${before === null ? '—' : before} → <b>${after}</b> (${journeyDeltaHtml(e.delta)}), reliability ${journeyPct(e.previousReliability)} → ${journeyPct(e.reliability)}. A club decision recorded against ${name}'s record, not a result on court.${e.notes ? ` ${e.notes}` : ''}`);
  }
  if(e.kind === 'match'){
    const d = journeyMatchDescription(name, e.matchId);
    const title = d ? `${d.resultWord} ${d.opponents}${d.partner ? ` (with ${d.partner})` : ''}` : `Match ${e.matchId}`;
    // Deliberately NOT called a share of games. The performance score is
    // 80% games won + 20% the result, so it is a different quantity from the
    // game-share figures on the match cards below and must not borrow their
    // wording -- two near-identical labels on one screen read as a
    // contradiction even when both numbers are right.
    const score = (v) => (v === null || v === undefined) ? '—' : v.toFixed(2);
    return row('Match', title,
      `${journeyDeltaHtml(e.delta)} → <b>${after}</b>. Performance score ${score(e.actual)} against ${score(e.expected)} expected${d && d.score ? ` (${d.score})` : ''}. Weighting K ${Math.round(e.kUsed)} · reliability ${journeyPct(e.previousReliability)} → ${journeyPct(e.reliability)}.`);
  }
  return row('', e.eventType, `Power Rating ${after}.`);
}

const JOURNEY_METHODOLOGY_TEXT = `Every point below is the number the engine recorded at the time, replayed back in order — not a re-estimate. Each match compares what was expected of you before the ball was struck with the performance score you actually delivered. That score runs 0 to 1 and is 80% the share of games you won plus 20% the result itself, so it is deliberately not the same figure as the game percentages shown on the match cards. The gap between expected and delivered is multiplied by a weighting that starts high while your rating is new and falls as evidence builds, so early matches move you further than late ones. A tier change moves no points and no reliability at all. A club reassessment does move points, and is shown as its own event so it can never be mistaken for a result.`;

function buildJourneyLegendHtml(journey){
  const series = JourneyView.chartSeries(journey);
  const bits = [`<span style="color:#5a9c5a;">●</span> match gained · <span style="color:#b5453f;">●</span> match lost ground`];
  // Described by what is actually drawn. Claiming "no rating movement" for a
  // correction that moved the rating by 263 points made the legend contradict
  // the leap in the chart directly above it.
  if(series.some(s=>s.isJump)) bits.push(`<span style="color:#7ba7d4;">◆</span> club decision (moved the rating)`);
  if(series.some(s=>s.isAnnotation)) bits.push(`<span style="color:#c8a96a;">▫</span> tier change (no rating movement)`);
  return `<div style="font-size:10.5px; color:var(--text-dim); margin-top:4px;">${bits.join(' &nbsp;·&nbsp; ')}</div>`;
}

// Shared by the legacy profile sheet and the premium profile so the two can
// never drift into showing different journeys.
// `showHeadline` is false where the caller already prints the start/end figure
// above the body, so the same number is never printed twice.
function buildJourneyBodyHtml(name, journey, showHeadline){
  const start = Math.round(journey.startRating);
  const end = Math.round(journey.endRating);
  const diff = end - start;
  const diffClass = diff > 0 ? 'perf-pos' : (diff < 0 ? 'perf-neg' : '');
  const notable = journey.entries.filter(e => e.kind !== 'match');

  const counts = [`${journey.matchCount} match${journey.matchCount === 1 ? '' : 'es'}`];
  if(journey.tierChangeCount) counts.push(`${journey.tierChangeCount} tier change${journey.tierChangeCount === 1 ? '' : 's'}`);
  if(journey.reassessmentCount) counts.push(`${journey.reassessmentCount} club reassessment${journey.reassessmentCount === 1 ? '' : 's'}`);

  const lead = showHeadline === false
    ? `Across ${counts.join(', ')}`
    : `${start} → <b>${end}</b> <span class="${diffClass}">(${diff >= 0 ? '+' : ''}${diff} pts)</span> across ${counts.join(', ')}`;
  let html = `<div class="section-sub">${lead}, from ${journeyDateLabel(journey.firstDate)} to ${journeyDateLabel(journey.lastDate)}. This is the recorded journey: the last point is the Power Rating.</div>`;
  html += `<div class="matchup-vs" style="padding:8px;">${buildV3JourneyChartSvg(journey)}</div>`;
  html += buildJourneyLegendHtml(journey);

  if(notable.length){
    html += `<div class="section-heading" style="margin-top:12px;">Milestones</div>`;
    html += notable.map(e => buildJourneyEventRowHtml(name, e)).join('');
  }

  html += `<details style="margin-top:10px;"><summary class="explainer-toggle" style="padding-left:0; cursor:pointer;">Every event (${journey.entries.length}) ›</summary>`;
  html += journey.entries.slice().reverse().map(e => buildJourneyEventRowHtml(name, e)).join('');
  html += `</details>`;

  html += `<details style="margin-top:8px;"><summary class="explainer-toggle" style="padding-left:0; cursor:pointer;">How your rating moves ›</summary>
    <div class="section-sub">${JOURNEY_METHODOLOGY_TEXT}</div></details>`;
  return html;
}

// `result` is whatever playerJourney() returned. No silent fallback: a failed
// read says so, and a player with no recorded events says that instead of
// inventing a starting point.
function buildJourneySection(name, result){
  let body;
  if(!result) body = `<div class="section-sub">Rating journey unavailable.</div>`;
  else if(result.error) body = `<div class="section-sub" style="color:var(--red);">Rating journey unavailable — ${result.error} Reload to try again.</div>`;
  else if(result.empty) body = `<div class="section-sub">No rating events recorded for ${name} yet.</div>`;
  else body = buildJourneyBodyHtml(name, result.journey);
  return `<div class="section-heading" style="margin-top:14px;">📈 Rating journey</div>` + body;
}

function buildRecentFormSection(name){
  const form = computeRecentForm(name, 10);
  if(!form || form.games < 3) return ''; // not enough recent data to be meaningful
  const isStale = form.daysSinceLastGame > RECENT_FORM_STALE_DAYS;
  const pct = form.avgPct;
  const cls = isStale ? '' : (pct > 3 ? 'perf-pos' : (pct < -3 ? 'perf-neg' : ''));
  const sign = pct >= 0 ? '+' : '';
  let note;
  if(isStale) note = `hasn't played in a while, so this doesn't reflect current form`;
  else if(pct > 8) note = 'trending up clearly — worth watching for a promotion case';
  else if(pct > 3) note = 'trending up modestly';
  else if(pct < -8) note = 'trending down clearly';
  else if(pct < -3) note = 'trending down modestly';
  else note = 'holding roughly steady';
  const staleWarning = isStale
    ? `<div class="section-sub" style="color:#e8a5a1; margin-top:4px;">⚠️ Last played ${fmtDaysAgo(form.daysSinceLastGame)} — this record is from before then, not a sign of current form.</div>`
    : '';
  return `<div class="section-heading" style="margin-top:14px;">📊 Recent form (last ${form.games} games)</div>
    <div class="matchup-vs" style="${isStale?'opacity:0.7;':''}"><span class="${cls}" style="font-weight:700; font-size:15px;">${sign}${pct}%</span> <span style="color:var(--green); font-weight:700;">${form.wins}W</span>-${form.draws ? `<span style="color:var(--draw); font-weight:700;">${form.draws}D</span>-` : ''}<span style="color:var(--red); font-weight:700;">${form.losses}L</span> <span style="color:var(--text-dim); font-size:11.5px;">average overperformance vs. expectation — ${note}. This is separate from the overall rating above and moves faster, since it's a short window.</span></div>${staleWarning}`;
}

function buildDevAreasSection(name){
  const notes = devAreasState.filter(a => a.player === name);
  let html = `<div id="devAreasSectionWrap"><div class="section-heading" style="margin-top:14px;">🎯 Development Areas</div>`;
  html += `<div class="section-sub">Freeform notes on what ${name} is working on — anyone can add one.</div>`;
  if(notes.length === 0){
    html += `<div class="section-sub">Nothing added yet.</div>`;
  } else {
    notes.slice().sort((a,b)=> a.addedAt < b.addedAt ? 1 : -1).forEach(note=>{
      const isArmed = armedDeleteId === ('dev_'+note.id);
      html += `<div class="callout-card" style="padding:10px 12px;">
        <div style="font-size:12.5px;">${note.text}</div>
        <div style="margin-top:4px; font-size:10.5px; color:var(--text-dim);">added by ${note.addedBy} (${fmtRelative(note.addedAt)})</div>
        ${isUnlocked ? `<div class="difficulty-row" style="margin-top:6px;"><button class="preset-btn dev-area-delete-btn" data-note-id="${note.id}" style="flex:1; font-size:11px; padding:6px; ${isArmed?'color:#e8a5a1; border-color:var(--red);':''}">${isArmed?'Confirm delete?':'Delete'}</button></div>` : ''}
      </div>`;
    });
  }
  html += `<div class="fg-controls" style="margin-top:6px;">
    <div class="fg-row"><textarea id="devAreaInput" class="fg-select" rows="2" placeholder="e.g. Second serve consistency, moving forward to the net sooner..." style="width:100%; resize:vertical;"></textarea></div>
    <div class="fg-row"><button class="preset-btn" id="devAreaSubmit" style="width:100%;">Add development area</button></div>
    <div id="devAreaMessage" class="section-sub"></div>
  </div></div>`;
  return html;
}

// One player's movement through the selected month: where their real Power
// Rating started and finished, how far it moved, and how their rank moved both
// overall and within their tier. Negative movement is shown exactly like
// positive; a player who sat the month out still gets their boundary state.
function buildMonthlyRatingSection(name){
  if(profileMonth === 'all' || !MONTHLY_VIEWS) return '';
  const label = monthLabel(profileMonth);
  const r = MonthlyViews.playerMonth(MONTHLY_VIEWS, profileMonth, name);
  const p = PLAYERS.find(x=>x.name===name);
  if(!r){
    return `<div class="section-heading" style="margin-top:14px;">📅 ${label}</div>
      <div class="section-sub">${name} has no rating history in ${label}.</div>`;
  }

  const sign = v => (v > 0 ? '+' : '');
  const cls = v => (v > 0 ? 'perf-pos' : (v < 0 ? 'perf-neg' : ''));
  const rankCell = (from, to, change, changed, fromTier, toTier) => {
    if(from === null || to === null) return '<span style="color:var(--text-dim);">not ranked at both ends</span>';
    if(changed) return `#${from} in Tier ${fromTier} → #${to} in Tier ${toTier} <span style="color:var(--text-dim);">— not comparable across a tier change</span>`;
    const arrow = change === 0 ? '' : ` · <span class="${cls(change)}">${change>0?'▲':'▼'}${Math.abs(change)}</span>`;
    return `#${from} → #${to}${arrow}`;
  };

  const row = (k,v) => `<div class="ms-line"><span class="ms-main">${k}</span><span class="ms-sub">${v}</span></div>`;
  const played = r.played
    ? `${r.matches} game${r.matches===1?'':'s'}`
    : '<span style="color:var(--text-dim);">no games — rating unchanged, rank moved around them</span>';

  const perf = (r.performancePct === null)
    ? '<span style="color:var(--text-dim);">n/a — no games</span>'
    : `<span class="${cls(r.monthlyPerformance)}">${sign(r.performancePct)}${r.performancePct}%</span> vs expectation`
      + (r.provisional ? ' <span style="color:var(--text-dim);">(provisional)</span>' : '');

  return `<div class="section-heading" style="margin-top:14px;">📅 ${label}</div>
    <div class="monthly-stories" style="margin:6px 0 0;">
      ${row('Played', played)}
      ${row('Power Rating', `${Math.round(r.startRating)} → ${Math.round(r.endRating)} · <span class="${cls(r.ratingChange)}">${sign(r.ratingChange)}${r.ratingChange} pts</span>`)}
      ${row('Rank overall', rankCell(r.startRankOverall, r.endRankOverall, r.rankChangeOverall, false))}
      ${row('Rank in tier', rankCell(r.startRankInTier, r.endRankInTier, r.rankChangeInTier, r.tierChanged, r.tierAtMonthStart, r.tierAtMonthEnd))}
      ${row('Monthly Performance', perf)}
      <div class="ms-foot">This is the one continuous Power Rating, not a separate monthly score. Today it stands at ${Math.round(p ? p.rating : r.endRating)}.</div>
    </div>`;
}

// The explicit month control on the profile's results. Lives here so the
// premium profile (shell.js) and anything else that shows a player's results
// draw the same control from the same state.
function profileMonthSelectHtml(){
  const months = getAvailableMonths();
  return `<select id="profileMonthSelect" class="pp-month-select" aria-label="Show results from">
    <option value="all" ${profileMonth==='all'?'selected':''}>All time</option>
    ${months.map(m=>`<option value="${m}" ${m===profileMonth?'selected':''}>${monthLabel(m)}</option>`).join('')}
  </select>`;
}

function wireProfileMonthSelect(name){
  const sel = document.getElementById('profileMonthSelect');
  if(!sel) return;
  sel.onchange = ()=>{
    profileMonth = sel.value;
    openSheet(name);   // an in-place refresh, so the choice is kept
  };
}

function profileSheetIsOpenOn(name){
  const overlay = document.getElementById('overlay');
  return profileMonthFor === name && !!overlay && overlay.classList.contains('show');
}

function openSheet(name, matchFilter){
  if(!profileSheetIsOpenOn(name)) profileMonth = 'all';
  profileMonthFor = name;
  const p = PLAYERS.find(x=>x.name===name);
  document.getElementById('sheetName').textContent = name;
  const riskInfo = RISK_LABELS[p.risk] || RISK_LABELS.stable;
  document.getElementById('sheetSub').innerHTML = `Tier ${p.tier} · ${CLUB.name} &nbsp; <span class="risk-badge ${riskInfo.cls}">${riskInfo.text}</span>`;
  document.getElementById('sheetStats').innerHTML = `
    <div><b>${Math.round(p.rating)}</b>Power rating</div>
    <div><b>${playerRecordOf(name).winpct}%</b>Win rate</div>
    <div><b>${PlayerForm.recordText(playerRecordOf(name))}</b>Record</div>
    <div><b>${p.upset_wins}-${p.upset_losses}</b>Upset W-L</div>
  `;
  const journeyResult = playerJourney(name);
  // The rating change shown on each match card is the figure the engine
  // actually applied to THIS player in that match. K is per-player, so two
  // players in the same match move by different amounts; this is their own
  // recorded number, not a team-wide estimate.
  //
  // There is no month-scoped variant any more. The rating is continuous and
  // never resets, so a match moved it by exactly one amount whichever month
  // filter happens to be active.
  const deltaByMatchId = journeyDeltasByMatchId(journeyResult.journey);

  document.getElementById('sheetProfile').innerHTML = `<div class="profile-box">${buildProfileText(p)}</div>` + buildDevAreasSection(name) + buildRecentFormSection(name) + buildMonthlyRatingSection(name) + buildJourneySection(name, journeyResult) + buildRankingNeighborsSection(name) + buildCallOutSection(name) + buildDifficultySection(name);
  // A player's own match log is a record of what they played, so it holds the
  // drawn games too. (The rated set, MATCHES, deliberately does not -- see
  // recomputeAll. Nothing below this line feeds a rating or a ranking.)
  // In PlayerForm's order -- the order the form strip above is taken in -- so
  // the first ten listed here are exactly the ten games in the strip.
  let ms = PlayerForm.gamesOf(matchesIncludingDraws(), name);

  // Scoped only by the profile's OWN month. This line used to read "if a month
  // is selected elsewhere in the app, keep this profile scoped to it too" --
  // harmless when a person chose that month, and wrong from the day Rankings
  // started choosing August automatically.
  const monthActive = profileMonth !== 'all';
  if(monthActive){
    ms = ms.filter(m => Period.of(m.date) === profileMonth);
  }

  let filterBannerHtml = '';
  const upsetFilterActive = matchFilter === 'upset_wins' || matchFilter === 'upset_losses';
  if(upsetFilterActive){
    // Whether a result was an upset is settled by the ratings the two pairings
    // carried INTO the match, which is what team_w_rating/team_l_rating now
    // are. There is no month-specific variant any more: a match was or was not
    // an upset when it was played, and no later month can change that.
    ms = ms.filter(m=>{
      // Neither an upset win nor an upset loss: nobody won it.
      if(MatchOutcome.isDraw(m)) return false;
      const won = m.winners.includes(name);
      const myTeamRating = won ? m.team_w_rating : m.team_l_rating;
      const oppTeamRating = won ? m.team_l_rating : m.team_w_rating;
      const gap = Math.abs(myTeamRating - oppTeamRating);
      const favored = myTeamRating > oppTeamRating;
      if(gap < 15) return false; // must be a genuine gap going in to count as an upset
      return matchFilter === 'upset_wins' ? (won && !favored) : (!won && favored);
    });
  }

  if(monthActive || upsetFilterActive){
    const monthPart = monthActive ? monthLabel(profileMonth) : '';
    const upsetPart = upsetFilterActive ? (matchFilter === 'upset_wins' ? 'upset wins' : 'upset losses') : '';
    let label;
    if(monthActive && upsetFilterActive) label = `${upsetPart} in ${monthPart}`;
    else if(monthActive) label = monthPart;
    else label = upsetPart;
    const clearLabel = upsetFilterActive ? 'show all games' + (monthActive ? ` in ${monthPart}` : '') : '';
    filterBannerHtml = `<div class="section-sub" style="padding:8px 2px;">Showing only ${label} for ${name}${upsetFilterActive ? ` — <span id="clearProfileFilter" style="text-decoration:underline; cursor:pointer; color:var(--gold-bright);">${clearLabel}</span>` : ''}</div>`;
    if(ms.length === 0){
      filterBannerHtml += `<div class="section-sub">No games match this.</div>`;
    }
  }

  const box = document.getElementById('sheetMatches');
  box.innerHTML = filterBannerHtml + ms.map(m=>{
    const sides = MatchOutcome.sidesFor(m, name);
    const drew = sides.outcome === MatchOutcome.DRAW;
    // On a drawn match `winners` is whichever side the record filed first, so
    // it may not be this player's. `sidesFor` picks the side they were
    // actually on, which is the only question that still has an answer.
    const won = sides.outcome === MatchOutcome.WIN;
    const onStoredWinnersSide = m.winners.includes(name);
    const myTeam = sides.mine;
    const oppTeam = sides.theirs;
    const partner = m.type==='doubles' ? sides.partner : null;

    const myTeamRating = onStoredWinnersSide ? m.team_w_rating : m.team_l_rating;
    const oppTeamRating = onStoredWinnersSide ? m.team_l_rating : m.team_w_rating;
    const favored = myTeamRating > oppTeamRating;
    const gap = Math.round(Math.abs(myTeamRating - oppTeamRating));

    const isCloseGoingIn = gap < 15;
    let upsetTag = '';
    if(!isCloseGoingIn && !drew){
      if(favored && !won) upsetTag = `<div class="upset-tag upset-bad">⚠️ UPSET LOSS — lost as the favorite</div>`;
      else if(!favored && won) upsetTag = `<div class="upset-tag upset-good">🔥 UPSET WIN — won as the underdog</div>`;
    }

    // Ratings as they were going into this match, not as they are today.
    const atTheTime = (n) => (m.deltas && m.deltas[n]) ? Math.round(m.deltas[n].preMatchRating) : ratingOf(n);
    const namesWithRatings = myTeam.map(n => `${n} (${atTheTime(n)})`).join(' &amp; ');
    const oppWithRatings = oppTeam.map(n => `${n} (${atTheTime(n)})`).join(' &amp; ');

    const delta = deltaByMatchId[m.id];
    // One place owns correction, so a blast radius is never shown twice or
    // acted on from two screens at once.
    const adminButtons = isUnlocked
      ? `<div class="section-sub" style="margin-top:8px; font-size:10.5px;">To correct or remove this game, open it in the Games tab.</div>`
      : '';

    return `<div class="match" data-match-id="${m.id}">
      <div class="top"><span>${m.date}${m.type==='singles' ? ' · Singles' : ''}</span><span style="color:${drew?'var(--text-dim)':(won?'var(--green)':'var(--red)')}">${drew?'DRAW':(won?'WIN':'LOSS')}</span></div>
      ${upsetTag}
      <div class="teams"><b>${namesWithRatings}</b> vs ${oppWithRatings}</div>
      <div class="score">${scoreForViewer(m, onStoredWinnersSide)}${matchNoteMarkHtml(m.id)}${m.note ? ' · '+m.note : ''}</div>
      ${matchNoteLineHtml(m.id)}
      ${whyYourRatingMovedHtml(m, name)}
      ${matchDeltaLineHtml(m)}
      ${adminButtons}
    </div>`;
  }).join('');
  document.getElementById('overlay').classList.add('show');

  box.querySelectorAll('.profile-edit-btn').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.matchId;
      closeSheet();
      navigateToGamesTabForEdit(id);
    };
  });
  box.querySelectorAll('.profile-delete-btn').forEach(btn=>{
    btn.onclick = async ()=>{
      const id = btn.dataset.matchId;
      if(armedDeleteId === id){
        await deleteMatch(id);
        openSheet(name); // refresh this sheet with the deletion applied
      } else {
        armedDeleteId = id;
        openSheet(name); // re-render to show "Confirm delete?"
      }
    };
  });

  wireRequestPlayerLinks(document.getElementById('sheetProfile'));

  const clearFilterEl = document.getElementById('clearProfileFilter');
  if(clearFilterEl) clearFilterEl.onclick = ()=> openSheet(name);

  const devSubmitBtn = document.getElementById('devAreaSubmit');
  if(devSubmitBtn){
    devSubmitBtn.onclick = async ()=>{
      const msg = document.getElementById('devAreaMessage');
      const text = document.getElementById('devAreaInput').value.trim();
      if(!text){ msg.textContent = 'Write something first.'; return; }
      const addedBy = requireName();
      if(!addedBy) return;
      const note = { id: 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2,8), player: name, text, addedBy, addedAt: new Date().toISOString() };
      devAreasState.push(note);
      const ok = await saveDevAreas(devAreasState);
      if(!ok){
        devAreasState.pop();
        msg.textContent = storageAvailable() ? `Save failed (${lastStorageError || 'unknown error'}) — try again.` : `Save failed — this page can't reach shared storage.`;
        return;
      }
      openSheet(name);
    };
  }
  document.querySelectorAll('.dev-area-delete-btn').forEach(btn=>{
    btn.onclick = async ()=>{
      const noteId = btn.dataset.noteId;
      const armKey = 'dev_' + noteId;
      if(armedDeleteId === armKey){
        devAreasState = devAreasState.filter(a=>a.id!==noteId);
        await saveDevAreas(devAreasState);
        armedDeleteId = null;
      } else {
        armedDeleteId = armKey;
      }
      openSheet(name);
    };
  });
}

function closeSheet(){ document.getElementById('overlay').classList.remove('show'); }

function buildProfileFactsHtml(p){
  const joined = playerJoinedLabel(p.name);
  const hasReliability = typeof p.reliabilityPct === 'number';
  const relValue = hasReliability
    ? `<div class="pp-fact-value pp-fact-value-gold">${Math.round(p.reliabilityPct)}%</div>
       <div class="pp-fact-note">${p.reliabilityBand || ''}</div>`
    : `<div class="pp-fact-value pp-fact-unavailable">—</div>
       <div class="pp-fact-note">no v3 record</div>`;
  const cell = (label, body) => `<div class="pp-fact"><div class="pp-fact-label">${label}</div>${body}</div>`;
  return `<div class="pp-hero-facts">
    ${cell('Tier', `<div class="pp-fact-value">${p.tier}</div>`)}
    ${cell('Reliability', relValue)}
    ${cell('Games', `<div class="pp-fact-value">${p.lifetimeMatches != null ? p.lifetimeMatches : p.total}</div>`)}
    ${joined ? cell('Joined', `<div class="pp-fact-value pp-fact-value-small">${joined}</div>`) : ''}
  </div>`;
}

function renderPremiumProfile(name, matchFilter){
  const p = PLAYERS.find(x=>x.name===name);
  if(!p) return;
  const snap = getViewerSnapshot(name);
  const viewer = getCurrentViewer();
  const isOwnProfile = viewer && viewer.name === name;
  const riskInfo = RISK_LABELS[p.risk] || RISK_LABELS.stable;

  const sheet = document.getElementById('sheetProfile').parentElement; // .sheet container
  let wrap = document.getElementById('premiumProfileWrap');
  if(wrap) wrap.remove(); // fully rebuilt each open/refresh, except the reparented live nodes below

  // ---- Hero ----
  // Every game, draws included; win rate = wins / games played.
  const rec = playerRecordOf(name);
  const heroHtml = `
    <div class="pp-hero">
      <div class="pp-hero-name">${name}</div>
      <div class="pp-hero-status">TIER ${p.tier} · ${riskInfo.text.toUpperCase()}</div>
      <div class="pp-hero-rating">${Math.round(p.rating)}</div>
      <div class="pp-hero-rating-label">Power Rating</div>
      <div class="pp-hero-sub">${snap.tierRank ? `#${snap.tierRank} in Tier ${escapeHtml(p.tier)}` : 'Unranked'} · ${snap.overallRank ? `#${snap.overallRank} Overall` : 'Not currently ranked'} · ${PlayerForm.recordText(rec)} · ${rec.winpct}% Win Rate</div>
      ${potmAwardsLineHtml(name)}
      ${buildProfileFactsHtml(p)}
    </div>
  `;

  // ---- Recent form (real chronological sequence, same source as Home) ----
  const seq = snap.recentForm ? snap.recentForm.run : [];
  const formHtml = snap.recentForm ? `
    <div class="pp-section">
      <div class="pp-form-seq">${seq.map(letter=>`<span class="pp-form-letter ${MatchOutcome.classFor(letter)}">${letter}</span>`).join('')}</div>
      <div class="pp-form-record">${PlayerForm.recordText(snap.recentForm)} · Last ${snap.recentForm.games}</div>
      <div class="pp-form-clutch section-sub">${p.avg_overperf_pct>=0?'+':''}${p.avg_overperf_pct}% vs expectation</div>
    </div>
  ` : '';

  // ---- Player analysis: 3 cards from existing precomputed fields ----
  const posNote = Math.abs(p.rating_vs_tier_avg) < 15
    ? `Right at tier average`
    : (p.rating_vs_tier_avg > 0 ? `${Math.round(p.rating_vs_tier_avg)} pts above tier average` : `${Math.round(Math.abs(p.rating_vs_tier_avg))} pts below tier average`);
  const schedNote = Math.abs(p.opp_vs_tier_avg) < 20
    ? `Average opposition for the tier`
    : (p.opp_vs_tier_avg > 0 ? `Tough opposition` : `Easier opposition`);
  const perfNote = p.avg_overperf_pct > 3 ? 'Overperforming expectation' : (p.avg_overperf_pct < -3 ? 'Slight underperformance' : 'Tracking expectation closely');

  const analysisHtml = `
    <div class="pp-section">
      <div class="pp-section-label">Player Analysis</div>
      <div class="pp-analysis-grid">
        <div class="pp-analysis-card">
          <div class="pp-ac-label">Position</div>
          <div class="pp-ac-main">${snap.tierRank ? `#${snap.tierRank} of ${snap.tierRankOf} in Tier ${p.tier}` : `Not ranked · Tier ${p.tier}`}</div>
          <div class="pp-ac-sub">${posNote}</div>
        </div>
        <div class="pp-analysis-card">
          <div class="pp-ac-label">Schedule</div>
          <div class="pp-ac-main">${schedNote}</div>
          <div class="pp-ac-sub">${p.opp_vs_tier_avg>=0?'+':''}${p.opp_vs_tier_avg} vs tier average</div>
        </div>
        <div class="pp-analysis-card">
          <div class="pp-ac-label">Performance</div>
          <div class="pp-ac-main">${p.avg_overperf_pct>=0?'+':''}${p.avg_overperf_pct}% vs expectation</div>
          <div class="pp-ac-sub">${perfNote}</div>
        </div>
      </div>
      <div class="pp-summary-sentence">${schedNote}, ${perfNote.toLowerCase()}, ${riskInfo.text.toLowerCase()} in Tier ${p.tier}.</div>
      <button class="explainer-toggle" id="ppFullAnalysisToggle" style="padding-left:0;">Full analysis ›</button>
      <div class="section-sub" id="ppFullAnalysisBody" style="display:none;">${buildProfileText(p)}</div>
    </div>
  `;

  // ---- Partnerships & rivals ----
  const neighbors = tierRankNeighbors(name);
  const rivalsHtml = `
    <div class="pp-section">
      <div class="pp-section-label">Partnerships &amp; Rivals</div>
      ${snap.bestPartner ? `
        <div class="pp-partner-card">
          <div class="pp-ac-label">Best Partner</div>
          <div class="pp-ac-main">${snap.bestPartner.partner}</div>
          <div class="pp-ac-sub">${snap.bestPartner.winpct}% together · Chemistry ${snap.bestPartner.avg_overperf>=0?'+':''}${snap.bestPartner.avg_overperf}%</div>
        </div>
      ` : ''}
      <div class="pp-rivals-card">
        <div class="pp-ac-label">Ranking Rivals</div>
        ${neighbors.above ? `<div class="pp-rival-row">↑ <b>${neighbors.above.name}</b> · ${Math.round(neighbors.above.rating - p.rating)} pts</div>` : `<div class="pp-rival-row section-sub">↑ Top of the board</div>`}
        <div class="pp-rival-self">${name}</div>
        ${neighbors.below ? `<div class="pp-rival-row">↓ <b>${neighbors.below.name}</b> · ${Math.round(p.rating - neighbors.below.rating)} pts</div>` : `<div class="pp-rival-row section-sub">↓ Bottom of the board</div>`}
      </div>
    </div>
  `;

  // ---- Match to prove it ----
  // Call-out content: it follows the Call-Outs setting, and its button leads to
  // Find a Game, so the button follows that one.
  const matchup = canSee('callouts') ? getMatchToProveIt(name) : null;
  const proveItHtml = matchup ? `
    <div class="pp-section">
      <div class="pp-section-label">Match to Prove It</div>
      <div class="pp-proveit-card">
        <div class="pp-proveit-team">${matchup.team1[0]} + ${matchup.team1[1]}</div>
        <div class="pp-proveit-vs">VS</div>
        <div class="pp-proveit-team">${matchup.team2[0]} + ${matchup.team2[1]}</div>
        <div class="section-sub" style="margin-top:8px;">A matchup that could help settle ${name}'s position in the rankings.</div>
        ${canSee('findgame') ? `<button class="mp-btn-primary" id="ppProveItBtn" style="width:100%; margin-top:10px;">Find This Game ›</button>` : ''}
      </div>
    </div>
  ` : '';

  // ---- Rating journey (the real, persisted one) ----
  // There is no disclaimer here any more. The journey is replayed from the
  // events the engine wrote, so its last point IS the Power Rating shown above
  // -- they cannot disagree, and there is no second estimate to caveat. If the
  // journey could not be read, that is said plainly rather than patched over.
  const journeyResult = playerJourney(name);
  let journeyHtml = '';
  if(journeyResult.journey){
    const j = journeyResult.journey;
    const start = Math.round(j.startRating), end = Math.round(j.endRating);
    const diff = end - start;
    const diffClass = diff > 0 ? 'perf-pos' : (diff < 0 ? 'perf-neg' : '');
    journeyHtml = `
      <div class="pp-section">
        <div class="pp-section-label">Rating Journey</div>
        <div class="pp-journey-headline">${start} → ${end} <span class="${diffClass}" style="font-size:14px;">(${diff>=0?'+':''}${diff} pts)</span></div>
        ${buildJourneyBodyHtml(name, j, false)}
      </div>
    `;
  } else {
    journeyHtml = `
      <div class="pp-section">
        <div class="pp-section-label">Rating Journey</div>
        ${journeyResult.error
          ? `<div class="section-sub" style="color:var(--red);">Unavailable — ${journeyResult.error} Reload to try again.</div>`
          : `<div class="section-sub">No rating events recorded for ${name} yet.</div>`}
      </div>
    `;
  }

  // ---- Viewer-relative module (item 9) ----
  let viewerRelativeHtml = '';
  if(viewer && !isOwnProfile){
    const h2h = getHeadToHeadRecord(viewer.name, name);
    const partnership = PARTNERSHIPS.find(pr => pr.pair.includes(viewer.name) && pr.pair.includes(name));
    const ratingDiff = Math.round(viewer.rating - p.rating);
    viewerRelativeHtml = `
      <div class="pp-section">
        <div class="pp-section-label">You vs ${name}</div>
        <div class="pp-viewer-rel-grid">
          <div class="pp-analysis-card"><div class="pp-ac-label">Head to Head</div><div class="pp-ac-main">${h2h.total ? `${h2h.aWins}–${h2h.bWins}${h2h.draws ? `–${h2h.draws}` : ''}` : 'Never played'}</div></div>
          <div class="pp-analysis-card"><div class="pp-ac-label">Rating Gap</div><div class="pp-ac-main">${ratingDiff>=0?'+':''}${ratingDiff}</div></div>
          ${partnership ? `<div class="pp-analysis-card"><div class="pp-ac-label">Together</div><div class="pp-ac-main">${partnership.games} games</div></div>` : ''}
        </div>
      </div>
    `;
  }
  const heroLabelHtml = isOwnProfile
    ? `<div class="pp-viewer-tag">Your Profile</div>`
    : (viewer ? `<div class="pp-viewer-tag">Player Profile</div>` : '');

  // ---- Assemble the new wrapper, insert before the legacy content ----
  wrap = document.createElement('div');
  wrap.id = 'premiumProfileWrap';
  wrap.innerHTML = heroLabelHtml + heroHtml + formHtml + analysisHtml + rivalsHtml + proveItHtml + journeyHtml + viewerRelativeHtml
    // The month control lives on the heading it scopes, and says All time
    // unless the reader chose otherwise here. It is the profile's own; see
    // `profileMonth` in app.js.
    + `<div class="pp-section"><div class="pp-results-head">
        <div class="pp-section-label" style="margin:0;">${profileMonth === 'all' ? 'Recent Results' : 'Results · ' + monthLabel(profileMonth)}</div>
        ${profileMonthSelectHtml()}
      </div><div id="ppMatchesHost"></div></div>`
    + `<div class="pp-section" id="ppDevAreasHost"></div>`;

  const sheetProfileEl = document.getElementById('sheetProfile');
  sheetProfileEl.parentNode.insertBefore(wrap, sheetProfileEl);

  // Hide (not delete) the legacy header + prose/section blocks -- their data
  // has been reused above (the old name/tier/risk + four-stat-box summary
  // otherwise duplicates the new hero); the dev-areas block and match cards
  // are reparented instead of hidden, since those still carry live
  // Firestore-write event listeners.
  sheetProfileEl.style.display = 'none';
  ['sheetName','sheetSub','sheetStats'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = 'none';
  });

  const devWrap = document.getElementById('devAreasSectionWrap');
  if(devWrap) document.getElementById('ppDevAreasHost').appendChild(devWrap);

  // Reparent each existing match card into a collapsed-by-default row --
  // wrapping, not rebuilding, so edit/delete listeners already attached to
  // these exact nodes keep working untouched.
  wireProfileMonthSelect(name);
  const matchesHost = document.getElementById('ppMatchesHost');
  const matchEls = [...document.querySelectorAll('#sheetMatches .match')];
  matchEls.forEach(matchEl=>{
    // The card below already states the outcome; this row repeats it, so it
    // must repeat it rather than re-decide it. `=== 'WIN'` followed by
    // `won ? 'WIN' : 'LOSS'` is the exact shape that turns a draw into a
    // defeat, and it did: DRAW is not 'WIN', so it came out as LOSS.
    const resultText = (matchEl.querySelector('.top span:last-child')?.textContent || '').trim();
    const resultClass = resultText === 'WIN' ? 'w' : (resultText === 'DRAW' ? 'd' : 'l');
    const dateText = matchEl.querySelector('.top span:first-child')?.textContent || '';
    const teamsText = matchEl.querySelector('.teams')?.textContent || '';
    const scoreText = matchEl.querySelector('.score')?.textContent || '';
    const parts = teamsText.split(' vs ');
    const summaryRow = document.createElement('div');
    summaryRow.className = 'pp-match-row';
    summaryRow.innerHTML = `
      <div class="pp-match-summary">
        <span class="pp-match-result ${resultClass}">${resultText || 'LOSS'}</span>
        <span class="pp-match-date">${dateText}</span>
        <span class="pp-match-teams">${parts[0]||''}</span>
        <span class="pp-match-score">${scoreText.split(' · ')[0]||''}</span>
        <span class="pp-match-opp">${parts[1]||''}</span>
        <span class="pp-match-chev">›</span>
      </div>
    `;
    matchesHost.appendChild(summaryRow);
    matchEl.classList.add('pp-match-detail');
    matchesHost.appendChild(matchEl); // reparented, listeners intact
    summaryRow.onclick = ()=>{
      const open = matchEl.style.display === 'block';
      matchEl.style.display = open ? 'none' : 'block';
      summaryRow.querySelector('.pp-match-chev').textContent = open ? '›' : '⌄';
    };
  });
  const banner = document.querySelector('#sheetMatches > .section-sub');
  if(banner) matchesHost.insertBefore(banner, matchesHost.firstChild);

  // Wire the new toggles and CTA
  const fa = document.getElementById('ppFullAnalysisToggle');
  if(fa) fa.onclick = ()=>{
    const body = document.getElementById('ppFullAnalysisBody');
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    fa.textContent = open ? 'Full analysis ›' : 'Full analysis ⌄';
  };
  const piBtn = document.getElementById('ppProveItBtn');
  if(piBtn) piBtn.onclick = ()=>{ closeSheet(); goToSection('play'); };
}
