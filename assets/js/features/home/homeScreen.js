// ===================== HOME: SCREEN =====================
// The personalised Home: greeting, Your Game card, Club Pulse cards, Match
// ideas, Last Time Out and the monthly card with View Full Review. Presentation
// and wiring; its facts come from homeData.js and data/viewerState.js.
//
// Extracted from shell.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: redesign. The shell still routes to it (goToSection('home')).
// Loads before app.js; declarations only.

function buildHomeDashboard(){
  const dash = document.createElement('div');
  dash.id = 'homeDashboard';
  dash.style.display = 'none';
  const legacySummary = document.getElementById('summaryView');
  if(!legacySummary || !legacySummary.parentNode) return null;
  legacySummary.parentNode.insertBefore(dash, legacySummary);
  return dash;
}

// Match ideas is collapsed by default and remembers its state for the session.
let homeIdeasOpen = false;

// A Club Pulse card is a way in to that player, not a poster of them.
function pulseCardHtml(title, player, sub, subClass){
  if(!player){
    return `<div class="mp-card-standard home-pulse-card"><div class="home-pulse-title">${title}</div><div class="section-sub">Not enough data.</div></div>`;
  }
  return `<button class="mp-card-standard home-pulse-card home-pulse-clickable" data-pulse-player="${player.name}">
    <div class="home-pulse-title">${title}</div>
    <div class="home-pulse-name">${player.name}</div>
    <div class="home-pulse-sub ${subClass || ''}">${sub}</div>
    <span class="home-pulse-chev">›</span>
  </button>`;
}

// The player's most recent RATED match, described from what was recorded.
// Everything here -- the result, the scoreline, the expectation, the share of
// games and the rating movement -- is read back; nothing is recomputed, and the
// commentary is chosen deterministically from those same facts.
function buildLastResultCardHtml(name){
  const empty = (msg) => `<div class="mp-card-standard home-card"><div class="section-sub">${msg}</div></div>`;
  if(typeof LastResult === 'undefined') return empty('No recent result to show.');

  // The rated set, indexed by the engine's own record of each match.
  const rated = Object.values(V3_MATCH_FACTS || {})
    .filter(f => f.byPlayer && f.byPlayer[name])
    .map(f => ({ id: f.matchId, date: f.date, players: Object.keys(f.byPlayer), facts: f }));
  const recent = LastResult.mostRecent(rated, name);
  if(!recent) return empty(`No rated matches recorded for ${name} yet.`);
  const facts = recent.facts;

  const m = getDisplayMatches().find(x => x.id === facts.matchId);
  if(!m) return empty('That match could not be read.');

  const view = MatchFacts.forPlayer(facts, name);
  const mine = m.winners.includes(name) ? m.winners : m.losers;
  const theirs = m.winners.includes(name) ? m.losers : m.winners;
  const result = m.isDraw ? 'draw' : (m.winners.includes(name) ? 'win' : 'loss');
  const onStoredWinningSide = m.winners.includes(name);
  // getDisplayMatches() hands back stored matches, not enriched ones, so the
  // game counts are summed from the sets here rather than read off fields that
  // only exist after enrichMatches(). Sets are stored winner-first.
  const sets = Array.isArray(m.sets) ? m.sets : [];
  const winnerGames = sets.reduce((t, set) => t + set[0], 0);
  const loserGames = sets.reduce((t, set) => t + set[1], 0);
  const myGames = onStoredWinningSide ? winnerGames : loserGames;
  const total = winnerGames + loserGames;

  const commentary = LastResult.commentaryFor({
    result,
    gameShare: total ? myGames / total : null,
    expected: view ? view.mine.expected : null,
    actual: view ? view.mine.actual : null,
    ratingGap: view ? (view.mine.preRating - view.theirs.preRating) : null,
  });

  const delta = view ? view.me.ratingDelta : null;
  const deltaClass = delta > 0 ? 'perf-pos' : (delta < 0 ? 'perf-neg' : '');
  const arrow = delta > 0 ? '▲' : (delta < 0 ? '▼' : '·');
  const partner = mine.filter(n => n !== name);
  const headline = m.isDraw
    ? `${mine.join(' & ')} <span class="lr-vs">vs</span> ${theirs.join(' & ')}`
    : (onStoredWinningSide
      ? `<b>${mine.join(' & ')}</b> <span class="lr-vs">def</span> ${theirs.join(' & ')}`
      : `<b>${theirs.join(' & ')}</b> <span class="lr-vs">def</span> ${mine.join(' & ')}`);
  const tier = historicalTierOf(name, m.date);

  return `<div class="mp-card-standard home-card home-lastresult" data-match-id="${m.id}">
    <div class="lr-stamp">
      <div class="lr-date">${new Date(m.date + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }).toUpperCase()}</div>
      ${tier ? `<div class="lr-tier">Tier ${tier}</div>` : ''}
    </div>
    <div class="lr-body">
      <div class="lr-headline">${headline}</div>
      <div class="lr-score">${scoreForViewer(m, onStoredWinningSide)}${m.isDraw ? ' · not finished' : ''}</div>
      ${commentary ? `<div class="lr-note">${commentary}</div>` : ''}
      <div class="lr-foot">
        <div class="lr-delta">
          <div class="${deltaClass}"><span class="lr-arrow">${arrow}</span> ${delta === null ? '—' : (delta > 0 ? '+' : '') + delta}</div>
          <div class="section-sub">Rating change</div>
        </div>
        <button class="mp-btn-secondary lr-view" data-match-id="${m.id}" data-player="${name}">View match ›</button>
      </div>
    </div>
  </div>`;
}

function renderHomeDashboard(){
  const dash = document.getElementById('homeDashboard') || buildHomeDashboard();
  if(!dash) return;
  const viewer = getCurrentViewer();
  if(!viewer){
    dash.innerHTML = `<div class="section-sub" style="padding:24px 16px; text-align:center;">Select a player to personalise Home.</div>`;
    return;
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
  const dateLabel = now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).toUpperCase();

  const snap = getViewerSnapshot(viewer.name);
  const pulse = computeClubPulse();
  const matchup = computeMatchToMake(viewer.name);
  const currentMonth = snap.currentMonth;
  const monthStatsAll = currentMonth ? computeMonthlySummaryStats(currentMonth) : {};
  const monthStatsArr = Object.values(monthStatsAll);
  // The same canonical count the Meaningful Month rule runs on -- draws
  // included, because a drawn game was played -- so this number and the
  // "taking shape · 3 of 5" line can never disagree about how many games a
  // month holds.
  const gamesThisMonth = currentMonth ? MeaningfulMonth.countInMonth(getAllApprovedMatches(), currentMonth) : 0;
  const mostActive = monthStatsArr.length ? topNTied(monthStatsArr, 'games', 1, true)[0] : null;
  const eligibleMonth = monthStatsArr.filter(s=>s.games>=3);
  const highestWinPct = eligibleMonth.length ? topNTied(eligibleMonth, 'winpct', 1, true)[0] : null;
  // The award as the group chose it: this month's once confirmed, else the
  // most recent one, named with its month. Never the points leader.
  const potm = (currentMonth && potmWinnerOf(currentMonth)) || potmHistory()[0] || null;
  const potmSub = potm ? (potm.month === currentMonth ? 'Player of the Month' : `Player of the Month · ${potm.label.split(' ')[0]}`) : 'Player of the Month · voted monthly';

  const promoGap = computePromotionGap(viewer.name);
  let insight;
  if(promoGap && promoGap.gap > 0){
    insight = `You're just ${promoGap.gap} points off Tier ${promoGap.tierAbove}. Keep pushing.`;
  } else if(snap.recentForm && !viewer.recent_form_stale && snap.recentForm.avgPct > 3){
    insight = `You're trending up — ${PlayerForm.recordText(snap.recentForm)} in your last ${snap.recentForm.games}.`;
  } else if(snap.bestPartner){
    insight = `You and ${snap.bestPartner.partner} have won ${snap.bestPartner.winpct}% together — a partnership worth repeating.`;
  } else {
    insight = `${snap.total} games played this season. Keep building your record.`;
  }

  // Upcoming is no longer read on Home -- it is maintained by hand, and Home
  // should not depend on that being complete. The feature itself is untouched
  // and still lives in Play.

  // Each part sits in a home-block: no box on a phone (display: contents),
  // a place in the grid on a laptop or monitor (layout/desktop.css).
  dash.innerHTML = `
    <div class="home-block home-block-hero">
    <div class="home-hero">
      <div class="mp-section-label">${dateLabel}</div>
      <div class="mp-display-title home-greeting">${greeting},<br><span class="home-greeting-name">${viewer.name}.</span></div>
      <div class="home-hero-sub">READY FOR THE NEXT GAME?</div>
      <div class="home-hero-tagline">SAME GAME. HIGHER STANDARDS.</div>
    </div>
    </div>

    <div class="home-block home-block-yourgame">
    <div class="mp-card-standard home-card">
      <div class="home-card-header"><span>Your Game</span><button class="home-card-link" id="homeViewProfileBtn">View Profile ›</button></div>
      <div class="home-yourgame-group">
        <span class="tier-badge tier-${viewer.tier.toLowerCase()}" style="width:32px;height:32px;font-size:14px;">${viewer.tier}</span>
        <div class="home-tier-sub">${snap.eligible
          ? `#${snap.tierRank||'–'} in Tier ${viewer.tier} · #${snap.overallRank||'–'} Overall`
          : `Tier ${viewer.tier} · <span class="${snap.state && snap.state.participation === 'INACTIVE' ? 'inactive-tag' : 'idle-tag'}">${snap.state ? snap.state.label : 'Idle'}</span>`
        }</div>
      </div>
      <div class="home-yourgame-divider"></div>
      <div class="home-yourgame-group home-yourgame-rating">
        <div class="section-sub" style="font-size:10px;">Rating</div>
        <div class="home-rating-num">${Math.round(viewer.rating)}</div>
      </div>
      <div class="home-yourgame-divider"></div>
      <div class="home-yourgame-group home-yourgame-form">
        <div class="section-sub" style="font-size:10px;">Recent Form · Last ${snap.recentForm ? snap.recentForm.games : 0}</div>
        <div class="home-form-row">
          <div class="home-form-dots">${snap.recentForm ? computeRecentFormSequence(viewer.name, 10).map(result=>
            `<span class="form-dot ${MatchOutcome.classFor(result)}" title="${result || ''}"></span>`
          ).join('') : '—'}</div>
          <div class="home-form-record">${snap.recentForm ? PlayerForm.recordText(snap.recentForm) : 'Not enough recent games'}</div>
        </div>
      </div>
      <div class="home-insight">${insight}</div>
    </div>
    </div>

    <div class="home-block home-block-pulse">
    <div class="home-card-header home-section-header"><span>Club Pulse</span>${canSee('callouts') ? `<button class="home-card-link" id="homeAllInsightsBtn">All Insights ›</button>` : ''}</div>
    <div class="home-pulse-row">
      ${pulseCardHtml('#1 Ranked', pulse.topRanked, pulse.topRanked ? `${Math.round(pulse.topRanked.rating)}` : '', '')}
      ${pulseCardHtml('In Form', pulse.inForm, pulse.inForm ? `+${pulse.inForm.recent_form}%` : '', 'perf-pos')}
      ${pulseCardHtml('Promotion Watch', pulse.promotionWatch, pulse.promotionWatch ? `Tier ${pulse.promotionWatch.tier} · ${pulse.promotionWatch.gap} pts` : '', '')}
    </div>
    </div>

    <!-- Collapsed by default: occasionally useful, not worth permanent space.
         Matchmaking is Find a Game's content, so it follows that setting;
         its predicted split is Admin-only (canSeePredictions). -->
    ${canSee('findgame') ? `
    <div class="home-block home-block-ideas">
    <div class="mp-card-standard home-card home-ideas-head" id="homeIdeasToggle" role="button" tabindex="0" aria-expanded="${homeIdeasOpen}">
      <div class="home-ideas-icon">💡</div>
      <div class="home-ideas-text">
        <div class="home-ideas-title">Match ideas</div>
        <div class="section-sub">Balanced games suggested for you</div>
      </div>
      <div class="home-ideas-cta">${homeIdeasOpen ? 'Hide' : 'Show suggestions'} <span class="home-ideas-chev">${homeIdeasOpen ? '⌄' : '›'}</span></div>
    </div>
    <div id="homeIdeasBody" style="display:${homeIdeasOpen ? 'block' : 'none'};">
    <div class="home-card-header home-section-header"><span>Match to Make</span><button class="home-card-link" id="homeFindMoreBtn">Find More Matches ›</button></div>
    ${matchup ? `
      <div class="mp-card-standard home-card home-matchup-card">
        <div class="section-sub">A well-balanced matchup</div>
        ${canSeePredictions() ? `<div class="home-matchup-pct">${matchup.pctFor}% – ${matchup.pctAgainst}%</div>
        <div class="section-sub" style="font-size:11px; margin-top:-4px; margin-bottom:10px;">${matchup.description}</div>` : ''}
        <div class="home-matchup-players">
          <div class="home-player-block"><div class="home-avatar">${initials(viewer.name)}</div><div class="home-player-name">${viewer.name}</div></div>
          <div class="home-player-block"><div class="home-avatar">${initials(matchup.partner.name)}</div><div class="home-player-name">${matchup.partner.name}</div></div>
          <div class="home-matchup-vs">VS</div>
          <div class="home-player-block"><div class="home-avatar">${initials(matchup.opponents[0].name)}</div><div class="home-player-name">${matchup.opponents[0].name}</div></div>
          <div class="home-player-block"><div class="home-avatar">${initials(matchup.opponents[1].name)}</div><div class="home-player-name">${matchup.opponents[1].name}</div></div>
        </div>
        <button class="mp-btn-primary" id="homeViewMatchupBtn" style="width:100%; margin-top:12px;">View Matchup ›</button>
      </div>
    ` : `<div class="mp-card-standard home-card"><div class="section-sub">Not enough eligible players to suggest a matchup right now.</div></div>`}

    </div>
    </div>` : ''}

    <!-- Built automatically from the player's own most recent RATED match.
         Upcoming is maintained by hand, so Home no longer depends on it; the
         Upcoming feature itself is untouched and still lives in Play. -->
    <div class="home-block home-block-last">
    <div class="home-card-header home-section-header"><span>Last Time Out</span><button class="home-card-link" id="homeAllResultsBtn">View all results ›</button></div>
    ${buildLastResultCardHtml(viewer.name)}
    </div>

    <div class="home-block home-block-month">
    <div class="home-card-header home-section-header"><span>${currentMonth ? monthLabel(currentMonth).toUpperCase() : 'THIS MONTH'} AT ${escapeHtml(CLUB.name.toUpperCase())}</span><button class="home-card-link" id="homeFullReviewBtn">View Full Review ›</button></div>
    ${meaningfulMonthNoteHtml(homeMonthDefault, currentMonth, 'homeMonth', false)}
    <div class="mp-card-standard home-card home-monthly-grid">
      <div class="home-monthly-stat"><div class="home-monthly-num">${gamesThisMonth}</div><div class="section-sub">Games played</div></div>
      <div class="home-monthly-stat"><div class="home-monthly-num" style="font-size:16px;">${mostActive ? mostActive.names[0] : '–'}</div><div class="section-sub">Most active${mostActive ? ` · ${mostActive.value} games` : ''}</div></div>
      <div class="home-monthly-stat"><div class="home-monthly-num" style="font-size:16px;">${highestWinPct ? highestWinPct.names[0] : '–'}</div><div class="section-sub">Highest win rate${highestWinPct ? ` · ${highestWinPct.value}%` : ''}</div></div>
      <div class="home-monthly-stat"><div class="home-monthly-num" style="font-size:16px;">${potm ? escapeHtml(potm.name) : '–'}</div><div class="section-sub">${potmSub}</div></div>
    </div>
    </div>
  `;

  document.getElementById('homeViewProfileBtn').onclick = ()=> openSheet(viewer.name);
  // Insights is a long page. Arriving from Home used to inherit wherever the
  // tab had been left, which dropped the reader into the middle of it.
  const insightsBtn = document.getElementById('homeAllInsightsBtn');
  if(insightsBtn) insightsBtn.onclick = ()=>{ openInsightsFromTop(); };
  document.getElementById('homeFullReviewBtn').onclick = ()=> showFullMonthlyReview();

  const findMoreBtn = document.getElementById('homeFindMoreBtn');
  if(findMoreBtn) findMoreBtn.onclick = ()=>{ goToSection('play'); };
  const viewMatchupBtn = document.getElementById('homeViewMatchupBtn');
  if(viewMatchupBtn) viewMatchupBtn.onclick = ()=> goToSection('play');

  const ideasToggle = document.getElementById('homeIdeasToggle');
  if(ideasToggle){
    const toggle = ()=>{ homeIdeasOpen = !homeIdeasOpen; renderHomeDashboard(); };
    ideasToggle.onclick = toggle;
    ideasToggle.onkeydown = (e)=>{ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(); } };
  }

  document.querySelectorAll('#homeDashboard [data-pulse-player]').forEach(el=>{
    el.onclick = ()=> openSheet(el.dataset.pulsePlayer);
  });

  const allResultsBtn = document.getElementById('homeAllResultsBtn');
  if(allResultsBtn) allResultsBtn.onclick = ()=> openSheet(viewer.name);
  document.querySelectorAll('#homeDashboard .lr-view').forEach(el=>{
    el.onclick = ()=> openMatchFromHome(el.dataset.player, el.dataset.matchId);
  });
}

// "View match" opens the player's own profile at that match, so the card they
// land on is written from their side.
//
// One exception, and it is a real one: a DRAW is rated but is deliberately
// absent from MATCHES, which is what the profile's match log is built from. So
// the profile cannot show a draw, and the most recent result genuinely can be
// one. Rather than leave the button dead on those matches, it falls back to the
// Games feed, which does show draws. The fallback is checked, not assumed.
function openMatchFromHome(name, matchId){
  // A profile opens on All time by construction now (see `profileMonth` in
  // app.js), so the result being asked for is always in it. This used to
  // widen the Rankings month around the call and restore it -- a workaround
  // for the profile borrowing a month that was never its own.
  openSheet(name);
  setTimeout(()=>{
    const host = document.getElementById('ppMatchesHost');
    const detail = host
      ? [...host.querySelectorAll('.pp-match-detail')].find(el => el.dataset.matchId === matchId)
      : null;
    if(detail){
      const row = detail.previousElementSibling;
      if(row && row.classList.contains('pp-match-row')) row.click();
      detail.scrollIntoView({ block: 'start' });
      return;
    }
    closeSheet();
    openMatchInGames(matchId);
  }, 0);
}

// "View Full Review" -- shows the fully preserved legacy Summary view in
// place of the dashboard, without leaving Home / changing activeTab.
function showFullMonthlyReview(){
  // The review of the month the card is about. It used to unhide whatever the
  // League screen had last drawn -- on its own default, which for most of
  // every month was a different month from the one named above the button.
  // This is an explicit hand-off, not a shared variable: the League screen's
  // own choice, if the reader made one, is left exactly as it was.
  summaryMonth = homeMonth();
  document.getElementById('homeDashboard').style.display = 'none';
  document.getElementById('summaryView').style.display = 'block';
  renderSummary();
  let backBtn = document.getElementById('homeBackFromReview');
  if(!backBtn){
    backBtn = document.createElement('button');
    backBtn.id = 'homeBackFromReview';
    backBtn.className = 'explainer-toggle';
    backBtn.textContent = '‹ Back to Home';
    backBtn.style.cssText = 'padding:12px 16px; font-weight:600;';
    backBtn.onclick = ()=>{
      document.getElementById('summaryView').style.display = 'none';
      backBtn.style.display = 'none';
      document.getElementById('homeDashboard').style.display = 'block';
    };
    document.getElementById('summaryView').parentNode.insertBefore(backBtn, document.getElementById('summaryView'));
  }
  backBtn.style.display = 'block';
}
