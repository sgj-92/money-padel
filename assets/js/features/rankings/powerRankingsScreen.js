// ===================== RANKINGS: POWER RANKINGS LIST =====================
// Rankings › Power and W/L: the ranked list (render), its sort orders, the
// month-view monthly stories (Key takeaways, Monthly Performance and the four
// folded parts) and the Meaningful Month note. The Rankings month
// (selectedMonth) is declared in app.js; only Rankings code may touch it
// (tests/monthScope.test.js). shell.js still wraps render() at start-up to add
// the eligibility marks, podium and Kings panel.
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: redesign. Loads before app.js; declarations only.

// The monthly stories panel. Four separate views, deliberately separated by
// heading so Monthly Performance is never read as rating movement or vice
// versa. League Table is untouched and stays on its own tab.
// Independent of the League table disclosures: collapsing one says nothing
// about the other. Not persisted -- the month should open the same way each
// time it is chosen. Closed by default (Shaun, 1 Nov): it filled the screen
// between the month's honours and the list.
let monthlySummaryOpen = false;

function buildMonthlyStoriesHtml(month){
  // The stories themselves are monthlyStories() (monthlyStoryData.js): the
  // Admin Board Pack reads the same derivation.
  const stories = monthlyStories(month);
  if(!stories) return '';
  const label = monthLabel(month);
  const { perf, risers, fallers, climbers, sliders, idleMovers, crossovers } = stories;

  const line = (main, sub) => `<div class="ms-line"><span class="ms-main">${main}</span><span class="ms-sub">${sub}</span></div>`;
  const block = (title, explain, body) => body
    ? `<div class="ms-block"><div class="ms-title">${title}</div><div class="ms-explain">${explain}</div>${body}</div>` : '';

  const perfBody = perf.map(r=>line(r.playerId,
    `<span class="${r.monthlyPerformance>0?'perf-pos':'perf-neg'}">${r.performancePct>0?'+':''}${r.performancePct}%</span> vs expectation · ${r.matches} games`)).join('');
  // A rating can move without anyone playing: a club reassessment does it by
  // decision. Saying so here stops a decision reading as a month's form.
  const moveLine = r => line(r.playerId,
    `${Math.round(r.startRating)} → ${Math.round(r.endRating)} · <span class="${r.ratingChange>=0?'perf-pos':'perf-neg'}">${r.ratingChange>0?'+':''}${r.ratingChange} pts</span>`
    + (r.reassessmentChange ? ` <span class="ms-idle">(${r.reassessmentChange>0?'+':''}${r.reassessmentChange} by club decision)</span>` : ''));
  const rankLine = r => line(r.playerId + (r.played ? '' : ' <span class="ms-idle">(no games)</span>'),
    `#${r.startRankOverall} → #${r.endRankOverall} · <span class="${r.rankChangeOverall>0?'perf-pos':'perf-neg'}">${r.rankChangeOverall>0?'▲':'▼'}${Math.abs(r.rankChangeOverall)}</span>`);
  const riseBody = risers.map(moveLine).join('') + fallers.map(moveLine).join('');
  const climbBody = climbers.map(rankLine).join('') + sliders.map(rankLine).join('');
  const idleBody = idleMovers.map(rankLine).join('');
  const crossBody = crossovers.map(c=>line(`${c.overtook} passed ${c.overtaken}`, '')).join('');

  // Collapsible, and collapsible with <details> rather than a toggle this file
  // would have to re-wire on every render. Nothing is removed: all four
  // concepts keep their own heading and their own explanation, they just no
  // longer all compete for the top of the screen.
  const foldBlock = (title, explain, body) => body
    ? `<details class="ms-fold"><summary class="ms-fold-summary">
         <span class="ms-fold-title">${title}</span>
         <span class="ms-fold-explain">${explain}</span>
       </summary><div class="ms-fold-body">${body}</div></details>` : '';

  // Key takeaways deliberately does NOT repeat one table: it takes the single
  // strongest line out of three different stories, so the summary says
  // something the sections below do not each say on their own.
  const takeaways = [];
  if(perf.length){
    takeaways.push({ value: `${perf[0].performancePct>0?'+':''}${perf[0].performancePct}%`,
      positive: perf[0].monthlyPerformance > 0,
      name: perf[0].playerId, note: `Strongest performance (${perf[0].matches} games)` });
  }
  if(risers.length){
    takeaways.push({ value: `${risers[0].ratingChange>0?'+':''}${risers[0].ratingChange} pts`,
      positive: true, name: risers[0].playerId,
      note: risers[0].reassessmentChange ? 'Biggest riser — mostly by club decision' : 'Biggest rating riser' });
  }
  if(climbers.length){
    takeaways.push({ value: `▲${Math.abs(climbers[0].rankChangeOverall)}`, positive: true,
      name: climbers[0].playerId,
      note: `Biggest climb · #${climbers[0].startRankOverall} → #${climbers[0].endRankOverall}` });
  }
  const takeawaysHtml = takeaways.length ? `<div class="ms-takeaways">
    <div class="ms-takeaways-head">Key takeaways</div>
    ${takeaways.map(t=>`<div class="ms-takeaway">
      <span class="ms-takeaway-value ${t.positive?'perf-pos':'perf-neg'}">${t.value}</span>
      <span class="ms-takeaway-name">${t.name}</span>
      <span class="ms-takeaway-note">${t.note}</span>
    </div>`).join('')}
  </div>` : '';

  // The whole summary folds as one. It defaults OPEN -- unlike the League
  // explanation, this is content rather than an explanation of content, and a
  // reader arriving at the month wants it. The chevron is the only thing added
  // to the heading: same type, same colour, same spacing, and deliberately not
  // the bordered card treatment that was rejected during the League work.
  const body = `${takeawaysHtml}
    ${block('Monthly Performance', 'Who most beat their pre-match expectation. Its own measure: Kings of Tiers and the list rank on rating, not on this.', perfBody)}
    ${foldBlock('Rating Movement', 'How far the real Power Rating actually moved — risers and fallers. Not the same question as performance.', riseBody)}
    ${foldBlock('Ranking Movement', 'Overall rank at the start and end of the month — climbs and slides both.', climbBody)}
    ${foldBlock('Moved without playing', 'Rank can move while a player sits out, because others moved around them. Their rating did not change.', idleBody)}
    ${foldBlock('Crossovers', 'Who overtook whom during the month.', crossBody)}
    <div class="ms-foot">League points are a separate record — see the League tab.</div>`;

  // Expanded, this is a content card and stays one -- that treatment was never
  // the objection. Collapsed, a card containing nothing but its own heading IS
  // the bordered dropdown Shaun rejected during the League work, so the chrome
  // comes off and it becomes a tappable line.
  return `<div class="monthly-stories${monthlySummaryOpen ? '' : ' is-collapsed'}">
    <button type="button" class="ms-head ms-head-toggle" id="monthlySummaryToggle"
      aria-expanded="${monthlySummaryOpen}" aria-controls="monthlySummaryBody">
      <span>${label} — monthly summary</span>
      <span class="lg-inline-chev" aria-hidden="true">${monthlySummaryOpen ? '⌄' : '›'}</span>
    </button>
    ${monthlySummaryOpen ? `<div id="monthlySummaryBody">${body}</div>` : ''}
  </div>`;
}

// The rows the Power leaderboard last drew: the leader cards read them.
let powerRowsShown = [];

function rankArrowHtml(change){
  if(change === null || change === undefined || change === 0) return '';
  const up = change > 0;
  return ` · <span class="${up?'perf-pos':'perf-neg'}">${up?'▲':'▼'}${Math.abs(change)}</span>`;
}

function sortRows(rows){
  const arr = [...rows];
  if(activeTab==='wl'){
    if(activeSort==='winpct') arr.sort((a,b)=> b.winpct - a.winpct || b.total - a.total);
    else if(activeSort==='total') arr.sort((a,b)=> b.total - a.total);
    else if(activeSort==='wins') arr.sort((a,b)=> b.wins - a.wins);
    else if(activeSort==='name') arr.sort((a,b)=> a.name.localeCompare(b.name));
  } else {
    // "Rating" always represents the ranking basis for whatever scope is currently selected --
    // season-long normally, or that month's own rating when a month is selected, so it matches
    // whichever number is actually shown as the big rating figure on each row.
    if(activeSortP==='rating') arr.sort((a,b)=>{
      const av = selectedMonth !== 'all' ? (a.month_rating ?? -Infinity) : a.rating;
      const bv = selectedMonth !== 'all' ? (b.month_rating ?? -Infinity) : b.rating;
      return bv - av;
    });
    else if(activeSortP==='month_rating') arr.sort((a,b)=> (b.month_rating ?? -Infinity) - (a.month_rating ?? -Infinity));
    else if(activeSortP==='recent_form') arr.sort((a,b)=> {
      // Stale form (no game in a while) shouldn't outrank someone who's actually active right now.
      if(a.recent_form_stale !== b.recent_form_stale) return a.recent_form_stale ? 1 : -1;
      return (b.recent_form_wins ?? -999) - (a.recent_form_wins ?? -999) || (b.recent_form ?? -999) - (a.recent_form ?? -999);
    });
    else if(activeSortP==='avg_match_strength') arr.sort((a,b)=> b.avg_match_strength - a.avg_match_strength);
    else if(activeSortP==='avg_overperf_pct') arr.sort((a,b)=> b.avg_overperf_pct - a.avg_overperf_pct);
    else if(activeSortP==='upset_total') arr.sort((a,b)=> b.upset_rate - a.upset_rate || b.upset_total - a.upset_total);
    else if(activeSortP==='name') arr.sort((a,b)=> a.name.localeCompare(b.name));
  }
  return arr;
}

function renderRankingsMonthNote(){
  const host = document.getElementById('rankingsMonthNoteHost');
  if(!host) return;
  host.innerHTML = rankingsMonthChoice === null
    ? meaningfulMonthNoteHtml(rankingsMonthDefault, selectedMonth, 'rankingsMonth')
    : '';
  wireMeaningfulMonthNote('rankingsMonth', (month)=>{
    rankingsMonthChoice = month;
    applyRankingsMonth(month);
    rerenderCurrentTab();
  });
}

function render(){
  // A sort button, a min-games preset or the search box can all be pressed
  // while the record is still arriving. Drawing an empty rankings list and an
  // "empty" message in answer is worse than saying nothing: it reads as a
  // finished screen with no players in the club.
  if(!DATA_READY){ showBootPlaceholder(); return; }
  syncRankingsFilterDot();
  renderRankingsMonthNote();
  const monthRatingBtn = document.getElementById('sortMonthRatingBtn');
  if(monthRatingBtn){
    const showIt = selectedMonth !== 'all';
    monthRatingBtn.style.display = showIt ? '' : 'none';
    if(!showIt && activeSortP === 'month_rating'){
      // The month filter was cleared while sorted by it -- fall back to the season rating.
      activeSortP = 'rating';
      document.querySelectorAll('#sortbarPower .sortbtn').forEach(b=> b.classList.toggle('active', b.dataset.sortp==='rating'));
    }
  }

  let rows = PLAYERS.filter(matchesActiveTier);
  let monthlyRatings = {};
  if(selectedMonth !== 'all'){
    const monthly = computeMonthlyStats(selectedMonth);
    monthlyRatings = monthEndRatings(selectedMonth);
    const movement = monthlyMovementIndex(selectedMonth);
    rows = rows.map(p => {
      const mv = movement[p.name] || null;
      return {...p, ...(monthly[p.name] || ZERO_MONTH_STATS),
        month_rating: (p.name in monthlyRatings) ? Math.round(monthlyRatings[p.name]*10)/10 : null,
        // The three monthly stories, kept as distinct fields so no screen can
        // quietly present one as another.
        month_rating_change: mv ? mv.ratingChange : null,
        month_rank_change: mv ? mv.rankChangeOverall : null,
        month_rank_change_tier: mv ? mv.rankChangeInTier : null,
        month_performance_pct: mv ? mv.performancePct : null,
        month_performance_provisional: mv ? mv.provisional : true};
    });
  }
  const beforeMinimum = rows;
  rows = rows.filter(p => p.total >= minGames);
  // The visible pool. Ranked and Active always; the other two only when asked
  // for, and then as full members of the same ordered list.
  const inPool = (p) => {
    const st = playerStateOf(p.name);
    if(!st) return true;
    // Archived players have left the group: never in the current (All time)
    // list, whatever the toggles say. A past month is history, and they stay
    // in it exactly as before -- with the temporarily inactive toggle.
    if(st.archived && selectedMonth === 'all') return false;
    if(st.participation === 'INACTIVE') return includeInactive;
    return st.ranking === 'RANKED' || includeIdle;
  };
  rows = rows.filter(inPool);
  if(query) rows = rows.filter(p => p.name.toLowerCase().includes(query));
  rows = sortRows(rows);
  if(activeTab === 'power') powerRowsShown = rows;

  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  list.innerHTML = '';
  // Only the rankings list owns this message; a render that lands while
  // another screen is showing (the data arriving under League) must not leak it.
  empty.style.display = (rows.length || list.style.display === 'none') ? 'none' : 'block';
  const waiting = awaitingFirstGame();
  empty.innerHTML = (!PLAYERS.length && waiting.length) ? `No ratings yet.${awaitingFirstGameHtml()}` : powerEmptyHtml(beforeMinimum, inPool);
  wirePowerEmpty();

  // The period's methodology note and summary sit under the table on Power
  // (Shaun's 22 Nov design: the leaderboard straight under its heading).
  let notesHost = list;
  if(activeTab === 'power'){
    let host = document.getElementById('rankingsPeriodNotes');
    if(!host){ host = document.createElement('div'); host.id = 'rankingsPeriodNotes'; }
    if(host.previousElementSibling !== list) list.insertAdjacentElement('afterend', host);
    host.innerHTML = '';
    notesHost = host;
  } else {
    const host = document.getElementById('rankingsPeriodNotes');
    if(host) host.innerHTML = '';
  }
  if(selectedMonth !== 'all'){
    const noteWrapper = document.createElement('div');
    const noteToggle = document.createElement('button');
    noteToggle.className = 'month-note-toggle';
    noteToggle.textContent = `${monthLabel(selectedMonth)} ranking methodology  ⓘ`;
    const note = document.createElement('div');
    note.className = 'section-sub';
    note.style.cssText = 'padding:8px 2px; display:none;';
    note.innerHTML = activeTab==='power'
      ? `Showing <b style="color:var(--text);">${monthLabel(selectedMonth)}</b> only — record, avg opp., clutch and upsets are for this month. The big number is your <b style="color:var(--text);">real Power Rating as it stood at the end of ${monthLabel(selectedMonth)}</b>, not a separate monthly score: there is one continuous rating and this is where it had reached. Underneath it, the points figure is how far it moved during the month, and the arrow is rank movement. <b style="color:var(--text);">Performance</b> is a different question again — how far above or below pre-match expectation you played.`
      : `Showing <b style="color:var(--text);">${monthLabel(selectedMonth)}</b> only.`;
    noteToggle.onclick = ()=>{
      const isOpen = note.style.display !== 'none';
      note.style.display = isOpen ? 'none' : 'block';
      noteToggle.classList.toggle('open', !isOpen);
    };
    noteWrapper.appendChild(noteToggle);
    noteWrapper.appendChild(note);
    notesHost.appendChild(noteWrapper);

    if(activeTab==='power'){
      const stories = buildMonthlyStoriesHtml(selectedMonth);
      if(stories){
        const wrap = document.createElement('div');
        wrap.innerHTML = stories;
        notesHost.appendChild(wrap);
        const msToggle = wrap.querySelector('#monthlySummaryToggle');
        if(msToggle) msToggle.onclick = ()=>{ monthlySummaryOpen = !monthlySummaryOpen; render(); };
      }
    }
  }

  const rotationsBy = typeof rotationCounts === 'function' ? rotationCounts(selectedMonth) : {};
  // On All time the change column is this period's (Shaun's 22 Nov design: "Δ (QTR)").
  const leaderPeriod = selectedMonth !== 'all' ? selectedMonth : (typeof currentMonthKey === 'function' ? currentMonthKey() : null);
  const periodMove = (activeTab === 'power' && selectedMonth === 'all' && leaderPeriod && typeof monthlyMovementIndex === 'function') ? monthlyMovementIndex(leaderPeriod) : {};
  const allMatches = activeTab === 'power' ? getAllApprovedMatches() : [];
  rows.forEach((p, i)=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.onclick = ()=>{
      if(activeTab==='power' && selectedMonth!=='all' && p.month_rating!==null && p.month_rating!==undefined && typeof openMonthlyRatingBreakdown==='function'){
        openMonthlyRatingBreakdown(p.name, selectedMonth);
      } else {
        openSheet(p.name);
      }
    };
    if(activeTab==='wl'){
      row.innerHTML = `
        <div class="rank">${i+1}</div>
        <div class="badge ${p.tier}">${p.tier}</div>
        <div class="namecol">
          <div class="nm">${p.name}</div>
          <div class="meta">${p.total} game${p.total===1?'':'s'} played</div>
        </div>
        <div class="wl">
          <div class="pct">${p.winpct}%</div>
          <div class="rec"><span class="w">${p.wins}W</span>${p.draws ? ` · <span class="d">${p.draws}D</span>` : ''} · <span class="l">${p.losses}L</span></div>
        </div>
      `;
    } else {
      const perfClass = p.avg_overperf_pct > 0.5 ? 'perf-pos' : (p.avg_overperf_pct < -0.5 ? 'perf-neg' : '');
      const perfSign = p.avg_overperf_pct > 0 ? '+' : '';

      const inMonthView = selectedMonth !== 'all';
      const hasMonthGames = inMonthView && p.month_rating !== null && p.month_rating !== undefined;
      const bigNumberHtml = (inMonthView && hasMonthGames)
        ? `<div class="rating-big">${Math.round(p.month_rating)}</div>`
        : (inMonthView
            ? `<div class="rating-big" style="color:var(--text-dim); font-size:20px;">–</div>`
            : `<div class="rating-big">${Math.round(p.rating)}</div>`);
      const chg = p.month_rating_change;
      const moveHtml = (inMonthView && hasMonthGames && chg !== null)
        ? `<div class="rating-sub" style="font-size:10px;"><span class="${chg>0?'perf-pos':(chg<0?'perf-neg':'')}">${chg>0?'+':''}${chg} pts</span>${rankArrowHtml(p.month_rank_change)}</div>`
        : '';
      const seasonSubHtml = inMonthView
        ? moveHtml + `<div class="rating-sub" style="font-size:10px; color:var(--text-dim);">overall: ${Math.round(p.rating)}</div>`
        : '';
      const monthRatingHtml = (inMonthView && !hasMonthGames)
        ? `<div class="rating-sub" style="font-size:10px; color:var(--text-dim);">no games this month</div>`
        : '';
      const wlHtml = inMonthView ? ` · <span style="color:var(--green);">${p.wins}W</span>-${p.draws ? `<span style="color:var(--draw);">${p.draws}D</span>-` : ''}<span style="color:var(--red);">${p.losses}L</span>` : '';

      // Progressive disclosure: the row's one secondary "meta" line shows whichever stat the
      // current sort is actually about -- everything else stays reachable by tapping into the
      // full profile, rather than all appearing on the row at once.
      let metaHtml;
      const rotsOf = rotationsBy[String(p.name).toLowerCase()] || 0;
      if(activeSortP === 'avg_match_strength'){
        metaHtml = `avg opp. ${Math.round(p.avg_match_strength)}${wlHtml}`;
      } else if(activeSortP === 'upset_total'){
        metaHtml = `<span class="upset-drill" data-player="${p.name}" data-kind="upset_wins">${p.upset_wins} upset win${p.upset_wins===1?'':'s'}</span> · <span class="upset-drill" data-player="${p.name}" data-kind="upset_losses">${p.upset_losses} upset loss${p.upset_losses===1?'':'es'}</span>`;
      } else {
        const rots = rotationsBy[String(p.name).toLowerCase()] || 0;
        metaHtml = `${p.total} game${p.total===1?'':'s'}${rots ? ` · ${rots} rotation${rots===1?'':'s'}` : ''}${wlHtml}`;
      }

      // Form: one compact line (record + a trend glyph) instead of a full sentence; a stale
      // player gets a quiet dot rather than an explanatory paragraph on every row.
      let formLine = '';
      if(p.recent_form !== null && p.recent_form !== undefined){
        if(p.recent_form_stale){
          formLine = `<div class="rating-sub" style="font-size:10px; color:var(--text-dim); opacity:0.6;">Form ${PlayerForm.recordShort({ wins: p.recent_form_wins, draws: p.recent_form_draws, losses: p.recent_form_losses })} <span title="stale -- last played ${fmtDaysAgo(p.recent_form_days_ago)}">·</span></div>`;
        } else {
          const trend = p.recent_form > 3 ? '↑' : (p.recent_form < -3 ? '↓' : '→');
          const trendClass = p.recent_form > 3 ? 'perf-pos' : (p.recent_form < -3 ? 'perf-neg' : '');
          formLine = `<div class="rating-sub" style="font-size:10px;">Form ${PlayerForm.recordShort({ wins: p.recent_form_wins, draws: p.recent_form_draws, losses: p.recent_form_losses })} <span class="${trendClass}">${trend}</span></div>`;
        }
      }

      // The badge has to describe the SAME moment as the number beside it.
      // It used to render today's tier against the selected month's closing
      // rating, so a player promoted in September was shown as a Tier A player
      // holding the rating they had while they were a B -- which is the
      // complaint, in its general form. `tierInScope` is the month-aware
      // answer the tier filter already uses; falling back to the current tier
      // only where a month has no row for them.
      const rowTier = tierInScope(p) || p.tier;

      // The leaderboard row (Shaun's 22 Nov design): position (laurels for
      // the top three), name, tier, rating, its change this period, the last
      // five results, and a chevron. The sort's own figure appears under the
      // name only when sorted by something other than Rating.
      const shownRating = inMonthView ? (hasMonthGames ? Math.round(p.month_rating) : null) : Math.round(p.rating);
      const mv = inMonthView ? p.month_rating_change : ((periodMove[p.name] || {}).ratingChange ?? null);
      const delta = (mv === null || mv === undefined) ? '<span class="rk-delta is-none">–</span>'
        : `<span class="rk-delta ${mv > 0 ? 'is-up' : mv < 0 ? 'is-down' : 'is-flat'}"><span class="rk-tri" aria-hidden="true">${mv > 0 ? '▲' : mv < 0 ? '▼' : ''}</span>${mv > 0 ? '+' : mv < 0 ? '−' : ''}${Math.abs(Math.round(mv))}</span>`;
      const recent = PlayerForm.recent(allMatches, p.name, 5);
      const run = recent ? recent.run : [];
      const formHtml = `<span class="rk-form" aria-label="Last ${run.length} result${run.length === 1 ? '' : 's'}: ${run.join(' ') || 'none'}">${Array.from({ length: 5 }, (_, k) => {
        const r = run[k - (5 - run.length)];
        return `<i class="rk-f ${r === 'W' ? 'is-w' : r === 'L' ? 'is-l' : r === 'D' ? 'is-d' : 'is-none'}"></i>`;
      }).join('')}</span>`;
      const pos = i + 1;
      row.classList.add('rk-row');
      if(pos <= 3) row.classList.add('rk-top', `rk-top-${pos}`);
      row.innerHTML = `
        <div class="rank">${pos <= 3 ? RK_LAUREL : ''}<span class="rk-pos">${pos}</span></div>
        <div class="namecol">
          <div class="nm">${p.name}</div>
          <div class="meta">${(activeSortP !== 'rating' || rotsOf) ? metaHtml : ''}</div>
        </div>
        <span class="tier-badge tier-${rowTier.toLowerCase()}">${rowTier}</span>
        <div class="rating-big${shownRating === null ? ' is-none' : ''}">${shownRating === null ? '–' : shownRating}</div>
        ${delta}
        ${formHtml}
        <span class="rk-chev" aria-hidden="true">›</span>
      `;
    }
    list.appendChild(row);
    row.querySelectorAll('.upset-drill').forEach(el=>{
      el.onclick = (e)=>{
        e.stopPropagation();
        openSheet(el.dataset.player, el.dataset.kind);
      };
    });
  });
}

// An empty list says why, and offers the way out (Shaun, 15 Nov: a new
// community -- Padel Championships -- where nobody has 10 rated games yet
// read "No players match that filter" with ten players in the club).
function powerEmptyHtml(beforeMinimum, inPool){
  const named = (p) => !query || p.name.toLowerCase().includes(query);
  const underMinimum = beforeMinimum.filter(p => p.total < minGames && inPool(p) && named(p)).length;
  if(minGames > 0 && underMinimum){
    return `Nobody here has ${minGames}+ rated games yet. <button type="button" class="link-btn" id="powerShowAllGames">Show all ${underMinimum} player${underMinimum === 1 ? '' : 's'}</button>`;
  }
  const idle = beforeMinimum.filter(p => p.total >= minGames && named(p) && !inPool(p)
    && playerStateOf(p.name) && playerStateOf(p.name).participation !== 'INACTIVE' && !playerStateOf(p.name).archived).length;
  if(!includeIdle && idle){
    return `Nobody is ranked right now: that takes ${PlayerState.thresholdText()}. <button type="button" class="link-btn" id="powerShowIdle">Show ${idle} unranked player${idle === 1 ? '' : 's'}</button>`;
  }
  return 'No players match that filter.';
}

function wirePowerEmpty(){
  const all = document.getElementById('powerShowAllGames');
  if(all) all.onclick = () => { setMinGames(0); render(); };
  const idle = document.getElementById('powerShowIdle');
  if(idle) idle.onclick = () => {
    includeIdle = true;
    document.querySelectorAll('#stateFilterRow .state-toggle[data-toggle="idle"]').forEach(b => b.classList.add('active'));
    render();
  };
}
