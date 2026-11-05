// ===================== PLAYERS: HEAD TO HEAD =====================
// Players › Compare: two players' meetings as opponents and as partners, all
// time or one month (its month, h2hMonth, stays in app.js).
// Owning stream: redesign. Loads before app.js; declarations only.
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).

let h2hPlayerA = null;

let h2hPlayerB = null;

// Player B can be "Everyone": Player A's head-to-head record against every
// opponent at once (Shaun, 2 Nov -- for promotion and relegation checks).
const H2H_EVERYONE = '__everyone__';

function renderH2H(){
  const box = document.getElementById('h2hView');
  // The group as it is now -- plus a player already chosen (say, from an old
  // result), so a comparison opened from history still shows who it is about.
  const names = livePlayerNames();
  [h2hPlayerA, h2hPlayerB].forEach(n => { if(n && n !== H2H_EVERYONE && !names.includes(n) && PLAYERS.some(p => p.name === n)) names.push(n); });
  if(!h2hPlayerA) h2hPlayerA = names[0];
  // Pick a player, see their record against everyone; pick a second player
  // for the full one-on-one.
  if(!h2hPlayerB) h2hPlayerB = H2H_EVERYONE;

  let html = `<div class="fg-controls">
    <div class="fg-row"><label class="fg-label">Player A</label>
      <select id="h2hSelectA" class="fg-select"></select>
    </div>
    <div class="fg-row"><label class="fg-label">Player B</label>
      <select id="h2hSelectB" class="fg-select"></select>
    </div>
    <div class="fg-row"><label class="fg-label">Month</label>
      <select id="h2hMonthSelect" class="fg-select"></select>
    </div>
  </div>`;

  if(h2hPlayerB === H2H_EVERYONE){
    html += h2hEveryoneHtml();
    box.innerHTML = html;
    populateMonthSelect(document.getElementById('h2hMonthSelect'), h2hMonth);
    document.getElementById('h2hMonthSelect').addEventListener('change', e=>{ h2hMonth = e.target.value; renderH2H(); });
    wireH2HSelects(names);
    wireH2HEveryone(box);
    return;
  }

  if(h2hPlayerA === h2hPlayerB){
    html += `<div class="section-sub">Pick two different players to compare.</div>`;
    box.innerHTML = html;
    populateMonthSelect(document.getElementById('h2hMonthSelect'), h2hMonth);
    document.getElementById('h2hMonthSelect').addEventListener('change', e=>{ h2hMonth = e.target.value; renderH2H(); });
    wireH2HSelects(names);
    return;
  }

  const monthActive = h2hMonth !== 'all';

  if(monthActive){
    const monthlyRatings = monthEndRatings(h2hMonth);
    const monthlyStatsAll = computeMonthlyStats(h2hMonth);
    const aHas = h2hPlayerA in monthlyRatings, bHas = h2hPlayerB in monthlyRatings;
    const aOverall = PLAYERS.find(p=>p.name===h2hPlayerA).rating;
    const bOverall = PLAYERS.find(p=>p.name===h2hPlayerB).rating;
    const aMonth = aHas ? Math.round(monthlyRatings[h2hPlayerA]) : null;
    const bMonth = bHas ? Math.round(monthlyRatings[h2hPlayerB]) : null;
    const aAhead = aHas && bHas && aMonth > bMonth;
    const bAhead = aHas && bHas && bMonth > aMonth;
    const aStats = monthlyStatsAll[h2hPlayerA];
    const bStats = monthlyStatsAll[h2hPlayerB];
    const aWL = aStats ? `<span style="color:var(--green);">${aStats.wins}W</span>-<span style="color:var(--red);">${aStats.losses}L</span>` : '0W-0L';
    const bWL = bStats ? `<span style="color:var(--green);">${bStats.wins}W</span>-<span style="color:var(--red);">${bStats.losses}L</span>` : '0W-0L';

    html += `<div class="section-heading" style="margin-top:6px;">📊 Power Rating — ${monthLabel(h2hMonth)}</div>`;
    html += `<div class="matchup-vs" style="padding:12px;">
      <div style="display:flex; justify-content:space-around; text-align:center;">
        <div>
          <div style="font-weight:700; margin-bottom:2px;">${h2hPlayerA}</div>
          <div style="font-size:24px; font-weight:700; color:${aAhead?'var(--gold-bright)':'var(--text)'};">${aMonth !== null ? aMonth : '–'}</div>
          <div style="font-size:11px; margin-top:2px;">${aWL}</div>
          <div style="font-size:10px; color:var(--text-dim);">overall: ${Math.round(aOverall)}</div>
        </div>
        <div style="align-self:center; color:var(--text-dim); font-size:13px;">vs</div>
        <div>
          <div style="font-weight:700; margin-bottom:2px;">${h2hPlayerB}</div>
          <div style="font-size:24px; font-weight:700; color:${bAhead?'var(--gold-bright)':'var(--text)'};">${bMonth !== null ? bMonth : '–'}</div>
          <div style="font-size:11px; margin-top:2px;">${bWL}</div>
          <div style="font-size:10px; color:var(--text-dim);">overall: ${Math.round(bOverall)}</div>
        </div>
      </div>
    </div>`;

    html += `<div class="section-sub" style="padding:4px 2px;">The rating below is the continuous Power Rating, shown from where each player carried it into ${monthLabel(h2hMonth)}. It is not reset at the start of the month and not re-solved for the month: these are the moves the engine actually recorded, in order.</div>`;

    [h2hPlayerA, h2hPlayerB].forEach(pname=>{
      const monthJourney = computeMonthlyJourney(pname, h2hMonth);
      const monthEntries = monthJourney ? monthJourney.entries.filter(e=>e.kind==='match') : [];
      const startPoint = monthJourney ? Math.round(monthJourney.startRating) : null;
      html += `<div class="section-sub" style="font-weight:700; color:var(--text); margin-top:8px;">${pname}'s games this month${startPoint!==null ? ` — carried in at ${startPoint}` : ''}</div>`;
      if(monthEntries.length === 0){
        html += `<div class="section-sub">No games for ${pname} in ${monthLabel(h2hMonth)}.</div>`;
      } else {
        monthEntries.forEach(e=>{
          const m = MATCHES.find(x=>x.id===e.matchId);
          if(!m) return;
          const d = journeyMatchDescription(pname, e.matchId);
          const teamLabel = d && d.partner ? `${pname} &amp; ${d.partner}` : pname;
          const deltaClass = e.delta > 0 ? 'perf-pos' : (e.delta < 0 ? 'perf-neg' : '');
          const deltaLabel = e.delta > 0 ? `+${e.delta}` : `${e.delta}`;
          const isExpanded = expandedGameId === m.id;
          const detailContent = isExpanded ? buildMatchDetailBlock(m, true) : '';
          html += `<div class="callout-card" style="padding:8px 12px;">
            <div class="game-card-clickable h2h-month-game" data-gameid="${m.id}" style="cursor:pointer;">
              <div style="display:flex; justify-content:space-between; font-size:11.5px;">
                <span><b>${teamLabel}</b> vs ${d ? d.opponents : ''}</span>
                <span style="color:${m.isDraw?'var(--text-dim)':(d && d.won?'var(--green)':'var(--red)')};">${m.isDraw?'DRAW':(d && d.won?'WIN':'LOSS')}</span>
              </div>
              <div style="margin-top:2px; color:var(--text-dim); font-size:11px;">${e.date} · ${m.score}</div>
              <div style="margin-top:4px;"><span class="${deltaClass}" style="font-weight:700;">${deltaLabel} pts</span> <span style="color:var(--text-dim); font-size:11px;">→ ${Math.round(e.rating)}</span></div>
              ${!isExpanded ? `<div style="margin-top:2px; color:var(--text-dim); font-size:10px;">tap for this game's full breakdown</div>` : ''}
              ${detailContent}
            </div>
          </div>`;
        });
      }
    });
  }

  // Both lists come from the shared selectors, which include drawn games.
  // They were built here from `MATCHES` -- the RATED set -- so a drawn meeting
  // was not a meeting at all: two players who had drawn once and never
  // otherwise met were told they had never played each other.
  const inMonth = (m) => !monthActive || Period.of(m.date) === h2hMonth;
  const opponentMatches = h2hOpponentMatches(h2hPlayerA, h2hPlayerB)
    .filter(inMonth).sort((a,b)=> a.date < b.date ? 1 : -1);
  const teammateMatches = h2hTeammateMatches(h2hPlayerA, h2hPlayerB)
    .filter(inMonth).sort((a,b)=> a.date < b.date ? 1 : -1);

  const headToHead = MatchOutcome.tally(opponentMatches, h2hPlayerA);
  const aWins = headToHead.wins;
  const bWins = headToHead.losses;   // A's losses as opponents ARE B's wins
  const h2hDraws = headToHead.draws;

  html += `<div class="section-heading" style="margin-top:6px;">⚔️ As opponents${monthActive ? ` (${monthLabel(h2hMonth)})` : ''}</div>`;
  if(opponentMatches.length === 0){
    html += `<div class="section-sub">${h2hPlayerA} and ${h2hPlayerB} ${monthActive ? `didn't play each other in ${monthLabel(h2hMonth)}` : 'have never played against each other'}.</div>`;
  } else {
    html += `<div class="matchup-vs" style="text-align:center; font-size:16px; padding:12px;">
      <b style="color:${aWins>bWins?'var(--gold-bright)':'var(--text)'};">${h2hPlayerA} ${aWins}</b>
      <span style="color:var(--text-dim); margin:0 6px;">–</span>${h2hDraws ? `<span style="color:var(--text-dim); font-size:13px;">${h2hDraws} drawn</span><span style="color:var(--text-dim); margin:0 6px;">–</span>` : ''}
      <b style="color:${bWins>aWins?'var(--gold-bright)':'var(--text)'};">${bWins} ${h2hPlayerB}</b>
      <div style="font-size:11px; color:var(--text-dim); margin-top:4px;">${opponentMatches.length} meeting${opponentMatches.length===1?'':'s'} as opponents</div>
      <div class="h2h-export">
        <button type="button" class="preset-btn" id="h2hCopy">Copy results</button>
        <button type="button" class="preset-btn" id="h2hPicture">Share picture</button>
      </div>
      <div class="h2h-export-msg" id="h2hExportMsg" role="status"></div>
    </div>`;
    // One line per meeting, so a phone screenshot holds many (Shaun, 1 Nov).
    // "X won" is not a thing that happened in a drawn match, and saying it
    // of whichever side the record filed first is how this screen used to
    // hand one player a win and the other a loss out of a coin toss.
    html += `<div class="callout-card h2h-list">` + opponentMatches.map(m => {
      const r = h2hOpponentRow(m, h2hPlayerA, h2hPlayerB);
      return `<div class="h2h-row">
        <span class="h2h-date">${escapeHtml(h2hShortDate(m.date))}</span>
        <span class="h2h-teams"><span>${escapeHtml(r.teams)}</span><span class="h2h-score">${escapeHtml(m.score)}</span></span>
        <span class="h2h-res" style="color:${r.drew ? 'var(--text-dim)' : (r.aWon ? 'var(--green)' : 'var(--red)')};">${escapeHtml(r.result)}</span>
      </div>`;
    }).join('') + `</div>`;
  }

  html += `<div class="section-heading">🤝 As teammates${monthActive ? ` (${monthLabel(h2hMonth)})` : ''}</div>`;
  if(teammateMatches.length === 0){
    html += `<div class="section-sub">${h2hPlayerA} and ${h2hPlayerB} ${monthActive ? `didn't play together in ${monthLabel(h2hMonth)}` : 'have never partnered together'}.</div>`;
  } else {
    // `losses = total - wins` is the shape that cannot hold a draw, and it
    // filed every drawn game as a defeat for the pair.
    const together = MatchOutcome.tally(teammateMatches, h2hPlayerA);
    const partnership = PARTNERSHIPS.find(p=> p.pair.includes(h2hPlayerA) && p.pair.includes(h2hPlayerB));
    html += `<div class="matchup-vs" style="padding:10px;">
      <b>${together.wins}-${together.losses}${together.draws ? `-${together.draws}` : ''}</b> together${together.draws ? ` <span style="color:var(--text-dim); font-size:11px;">(W-L-D)</span>` : ''}${partnership ? ` · <span class="${partnership.avg_overperf>3?'perf-pos':(partnership.avg_overperf<-3?'perf-neg':'')}">${partnership.avg_overperf>=0?'+':''}${partnership.avg_overperf}% chemistry</span>` : ''}
    </div>`;
    html += `<div class="callout-card h2h-list">` + teammateMatches.map(m => {
      const sides = MatchOutcome.sidesFor(m, h2hPlayerA);
      const word = sides.outcome===MatchOutcome.DRAW ? 'Draw' : (sides.outcome===MatchOutcome.WIN ? 'Won' : 'Lost');
      return `<div class="h2h-row">
        <span class="h2h-date">${escapeHtml(h2hShortDate(m.date))}</span>
        <span class="h2h-teams"><span>v ${escapeHtml(sides.theirs.join(' & '))}</span><span class="h2h-score">${escapeHtml(m.score)}</span></span>
        <span class="h2h-res" style="color:${sides.outcome===MatchOutcome.DRAW?'var(--text-dim)':(sides.outcome===MatchOutcome.WIN?'var(--green)':'var(--red)')};">${word}</span>
      </div>`;
    }).join('') + `</div>`;
  }

  box.innerHTML = html;

  box.querySelectorAll('.h2h-edit-btn').forEach(btn=>{
    btn.onclick = ()=> navigateToGamesTabForEdit(btn.dataset.matchId);
  });
  box.querySelectorAll('.h2h-delete-btn').forEach(btn=>{
    btn.onclick = async ()=>{
      const id = btn.dataset.matchId;
      if(armedDeleteId === id){ await deleteMatch(id); renderH2H(); }
      else { armedDeleteId = id; renderH2H(); }
    };
  });
  box.querySelectorAll('.h2h-month-game').forEach(el=>{
    el.onclick = (ev)=>{
      if(ev.target.closest && ev.target.closest('details')) return; // see the note in renderGamesTab
      const id = el.dataset.gameid;
      expandedGameId = (expandedGameId === id) ? null : id;
      renderH2H();
    };
  });
  wireH2HSelects(names);
  wireH2HExport(opponentMatches, teammateMatches, monthActive);

  populateMonthSelect(document.getElementById('h2hMonthSelect'), h2hMonth);
  document.getElementById('h2hMonthSelect').addEventListener('change', e=>{
    h2hMonth = e.target.value;
    renderH2H();
  });
}

function wireH2HSelects(names){
  const selA = document.getElementById('h2hSelectA');
  const selB = document.getElementById('h2hSelectB');
  selA.innerHTML = names.map(n=>`<option value="${n}" ${n===h2hPlayerA?'selected':''}>${n}</option>`).join('');
  selB.innerHTML = `<option value="${H2H_EVERYONE}" ${h2hPlayerB===H2H_EVERYONE?'selected':''}>Everyone</option>`
    + names.map(n=>`<option value="${n}" ${n===h2hPlayerB?'selected':''}>${n}</option>`).join('');
  selA.addEventListener('change', e=>{ h2hPlayerA = e.target.value; renderH2H(); });
  selB.addEventListener('change', e=>{ h2hPlayerB = e.target.value; renderH2H(); });
}

// ---- One meeting, as a line ----------------------------------------------
const H2H_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "26 Oct", with the year only when it is not this year's.
function h2hShortDate(date){
  const [y, m, d] = date.split('-');
  return `${Number(d)} ${H2H_MONTHS[Number(m) - 1]}${Number(y) !== new Date().getFullYear() ? ` ${y}` : ''}`;
}

// A meeting as opponents, from A's side: who was on each side and who won.
function h2hOpponentRow(m, A, B){
  const sides = MatchOutcome.sidesFor(m, A);
  const drew = sides.outcome === MatchOutcome.DRAW;
  const aWon = sides.outcome === MatchOutcome.WIN;
  const aPartner = sides.mine.filter(n => n !== A)[0];
  const bPartner = sides.theirs.filter(n => n !== B)[0];
  const teams = `${aPartner ? `${A} & ${aPartner}` : A} v ${bPartner ? `${B} & ${bPartner}` : B}`;
  return { teams, drew, aWon, result: drew ? 'drew' : `${aWon ? A : B} won` };
}

// ---- Export: the whole head-to-head as text or a picture (Shaun, 1 Nov) ----
// Exactly what the screen lists, for the month chosen or all time.
function h2hExportTitle(monthActive){
  return `${h2hPlayerA} v ${h2hPlayerB} · ${monthActive ? monthLabel(h2hMonth) : 'All time'}`;
}

function h2hResultWord(outcome){
  return outcome === MatchOutcome.DRAW ? 'Draw' : (outcome === MatchOutcome.WIN ? 'Won' : 'Lost');
}

function h2hExportText(opp, team, monthActive){
  const A = h2hPlayerA, B = h2hPlayerB;
  const t = MatchOutcome.tally(opp, A);
  const lines = [CLUB.name + ' · Head to head', h2hExportTitle(monthActive), ''];
  lines.push(`As opponents: ${A} ${t.wins} – ${t.losses} ${B}${t.draws ? ` (${t.draws} drawn)` : ''} · ${opp.length} meeting${opp.length === 1 ? '' : 's'}`);
  opp.forEach(m => { const r = h2hOpponentRow(m, A, B); lines.push(`${h2hShortDate(m.date)} · ${r.drew ? 'Drew' : r.result} · ${r.teams} · ${m.score}`); });
  if(team.length){
    const tt = MatchOutcome.tally(team, A);
    lines.push('', `As teammates: ${tt.wins}W ${tt.draws ? `${tt.draws}D ` : ''}${tt.losses}L`);
    team.forEach(m => {
      const s = MatchOutcome.sidesFor(m, A);
      lines.push(`${h2hShortDate(m.date)} · ${h2hResultWord(s.outcome)} · v ${s.theirs.join(' & ')} · ${m.score}`);
    });
  }
  return lines.join('\n');
}

// The picture, drawn as the screen is (CardPainter.headToHead): the
// scoreline, then one row per meeting with the result in its colour.
function h2hExportView(opp, team, monthActive){
  const A = h2hPlayerA, B = h2hPlayerB;
  const t = MatchOutcome.tally(opp, A);
  const tone = (o) => o === MatchOutcome.DRAW ? 'draw' : (o === MatchOutcome.WIN ? 'win' : 'loss');
  const view = {
    title: `${A} v ${B}`, month: monthActive ? monthLabel(h2hMonth) : 'All time',
    score: { a: A, b: B, aWins: t.wins, bWins: t.losses, draws: t.draws, meetings: opp.length },
    rows: opp.map(m => { const r = h2hOpponentRow(m, A, B);
      return { date: h2hShortDate(m.date), teams: r.teams, score: m.score, result: r.drew ? 'Drew' : r.result, tone: r.drew ? 'draw' : (r.aWon ? 'win' : 'loss') }; }),
    teammates: null,
  };
  if(team.length){
    const tt = MatchOutcome.tally(team, A);
    view.teammates = { summary: `${tt.wins}W ${tt.draws ? `${tt.draws}D ` : ''}${tt.losses}L together`,
      rows: team.map(m => { const sd = MatchOutcome.sidesFor(m, A);
        return { date: h2hShortDate(m.date), teams: `v ${sd.theirs.join(' & ')}`, score: m.score, result: h2hResultWord(sd.outcome), tone: tone(sd.outcome) }; }) };
  }
  return view;
}

function wireH2HExport(opp, team, monthActive){
  const msg = (t) => { const el = document.getElementById('h2hExportMsg'); if(el) el.textContent = t; };
  const copyBtn = document.getElementById('h2hCopy');
  if(copyBtn) copyBtn.onclick = async () => {
    const ok = await copyText(h2hExportText(opp, team, monthActive));
    msg(ok ? 'Copied — paste it into WhatsApp.' : 'Could not copy on this device.');
  };
  const picBtn = document.getElementById('h2hPicture');
  if(picBtn) picBtn.onclick = async () => {
    picBtn.disabled = true;
    try {
      const brand = await CardPainter.loadImage(CLUB.logo);
      const cv = CardPainter.headToHead(h2hExportView(opp, team, monthActive), { brand });
      const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const file = await CardPainter.toFile(cv, `${CLUB.fileSlug}-h2h-${slug(h2hPlayerA)}-v-${slug(h2hPlayerB)}.png`);
      const outcome = await CardPainter.share([file], { title: `${CLUB.name} — ${h2hExportTitle(monthActive)}` });
      msg(outcome === 'shared' ? 'Picture shared.' : outcome === 'saved' ? 'Picture saved — post it from your photos.' : outcome === 'ready' ? 'Picture ready: tap Share picture again.' : '');
    } catch(e){ msg('Could not make the picture.'); }
    picBtn.disabled = false;
  };
}

// ---- Player A against everyone ----------------------------------------------
// Each opponent once, with A's record against them, grouped by the tier the
// opponent was in when they met (the tier they held for most of the meetings)
// -- TierRecord's counting: a match counts once for each of its two
// opponents, draws as draws. A summary line per tier heads each group. Tap an
// opponent for the full one-on-one.
function h2hEveryoneData(){
  const A = h2hPlayerA;
  const inMonth = (m) => h2hMonth === 'all' || Period.of(m.date) === h2hMonth;
  const matches = matchesIncludingDraws().filter(m => inMonth(m) && [...(m.winners || []), ...(m.losers || [])].includes(A));
  const row = TierRecord.build({ matches, tierAt: (n, d) => historicalTierOf(n, d) }).find(r => r.player === A) || null;
  const tiers = TIER_ORDER_LIST.concat(['?']).filter(t => row && row.vs[t] && row.vs[t].played);
  const groups = tiers.map(t => ({ tier: t, rec: row.vs[t],
    opponents: row.opponents.filter(o => o.tier === t).sort((a, b) => b.played - a.played || a.name.localeCompare(b.name)) }));
  return { A, matches: matches.length, overall: MatchOutcome.tally(matches, A), groups, monthActive: h2hMonth !== 'all' };
}

const h2hRec = (r) => `${r.wins}-${r.draws}-${r.losses}`;
const h2hTierName = (t) => t === '?' ? 'Tier unknown' : `Tier ${t}`;

function h2hEveryoneHtml(){
  const d = h2hEveryoneData();
  const when = d.monthActive ? monthLabel(h2hMonth) : 'all time';
  if(!d.matches) return `<div class="section-sub">${escapeHtml(d.A)} has no games ${d.monthActive ? `in ${when}` : 'yet'}.</div>`;
  let html = `<div class="section-heading" style="margin-top:6px;">⚔️ ${escapeHtml(d.A)} v everyone${d.monthActive ? ` (${monthLabel(h2hMonth)})` : ''}</div>
    <div class="matchup-vs" style="text-align:center; padding:12px;">
      <div style="font-size:16px; font-weight:700;">${d.matches} match${d.matches === 1 ? '' : 'es'} · ${d.overall.wins}W ${d.overall.draws}D ${d.overall.losses}L</div>
      <div class="h2h-tier-sum">${d.groups.map(g => `<span><b>v ${g.tier === '?' ? '?' : g.tier}</b> ${h2hRec(g.rec)} · ${TierRecord.pct(g.rec)}%</span>`).join('')}</div>
      <div style="font-size:11px; color:var(--text-dim); margin-top:6px;">Against each opponent, grouped by the tier they were in. A match counts for both opponents.</div>
      <div class="h2h-export">
        <button type="button" class="preset-btn" id="h2hCopy">Copy results</button>
        <button type="button" class="preset-btn" id="h2hPicture">Share picture</button>
      </div>
      <div class="h2h-export-msg" id="h2hExportMsg" role="status"></div>
    </div>`;
  d.groups.forEach(g => {
    html += `<div class="h2h-group-head"><span>Against ${h2hTierName(g.tier)}</span><span>${h2hRec(g.rec)} · ${TierRecord.pct(g.rec)}%</span></div>
      <div class="callout-card" style="padding:0;"><table class="h2h-all">
        <colgroup><col style="width:37%;"><col style="width:11%;"><col style="width:11%;"><col style="width:11%;"><col style="width:11%;"><col style="width:19%;"></colgroup>
        <thead><tr><th>Opponent</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Win</th></tr></thead><tbody>
        ${g.opponents.map(o => `<tr class="h2h-all-row" data-h2h-opp="${escapeHtml(o.name)}">
          <td>${escapeHtml(o.name)} <span class="h2h-all-chev" aria-hidden="true">›</span></td><td>${o.played}</td>
          <td class="w">${o.wins}</td><td class="d">${o.draws}</td><td class="l">${o.losses}</td><td class="p">${TierRecord.pct(o)}%</td></tr>`).join('')}
        </tbody></table></div>`;
  });
  return html;
}

function h2hEveryoneText(d){
  const lines = [CLUB.name + ' · Head to head', `${d.A} v everyone · ${d.monthActive ? monthLabel(h2hMonth) : 'All time'}`, '',
    `${d.matches} matches · ${d.overall.wins}W ${d.overall.draws}D ${d.overall.losses}L`];
  d.groups.forEach(g => {
    lines.push('', `v ${h2hTierName(g.tier)}: ${h2hRec(g.rec)} (${TierRecord.pct(g.rec)}%)`);
    g.opponents.forEach(o => lines.push(`${o.name} · ${h2hRec(o)} · ${TierRecord.pct(o)}%`));
  });
  return lines.join('\n');
}

function h2hEveryoneView(d){
  return {
    title: `${d.A} v everyone`, month: d.monthActive ? monthLabel(h2hMonth) : 'All time',
    headline: `${d.matches} match${d.matches === 1 ? '' : 'es'} · ${d.overall.wins}W ${d.overall.draws}D ${d.overall.losses}L`,
    tiers: d.groups.map(g => `v ${g.tier} ${h2hRec(g.rec)} · ${TierRecord.pct(g.rec)}%`).join('    '),
    groups: d.groups.map(g => ({ title: `Against ${h2hTierName(g.tier)}`, record: `${h2hRec(g.rec)} · ${TierRecord.pct(g.rec)}%`,
      rows: g.opponents.map(o => ({ name: o.name, p: o.played, w: o.wins, d: o.draws, l: o.losses, pct: `${TierRecord.pct(o)}%` })) })),
  };
}

function wireH2HEveryone(box){
  box.querySelectorAll('.h2h-all-row').forEach(tr => {
    tr.onclick = () => { h2hPlayerB = tr.dataset.h2hOpp; renderH2H(); };
  });
  const d = h2hEveryoneData();
  const msg = (t) => { const el = document.getElementById('h2hExportMsg'); if(el) el.textContent = t; };
  const copyBtn = document.getElementById('h2hCopy');
  if(copyBtn) copyBtn.onclick = async () => {
    const ok = await copyText(h2hEveryoneText(d));
    msg(ok ? 'Copied — paste it into WhatsApp.' : 'Could not copy on this device.');
  };
  const picBtn = document.getElementById('h2hPicture');
  if(picBtn) picBtn.onclick = async () => {
    picBtn.disabled = true;
    try {
      const brand = await CardPainter.loadImage(CLUB.logo);
      const cv = CardPainter.headToHeadAll(h2hEveryoneView(d), { brand });
      const slug = String(d.A).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const file = await CardPainter.toFile(cv, `${CLUB.fileSlug}-h2h-${slug}-v-everyone.png`);
      const outcome = await CardPainter.share([file], { title: `${CLUB.name} — ${d.A} v everyone` });
      msg(outcome === 'shared' ? 'Picture shared.' : outcome === 'saved' ? 'Picture saved — post it from your photos.' : outcome === 'ready' ? 'Picture ready: tap Share picture again.' : '');
    } catch(e){ msg('Could not make the picture.'); }
    picBtn.disabled = false;
  };
}
