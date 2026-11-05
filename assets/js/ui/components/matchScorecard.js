// ===================== UI: MATCH RESULT CARD + MATCH ANALYSIS =====================
// A played match has two faces, drawn from ONE view model
// (domain/matches/matchScorecard.js), which reads back what the engine
// recorded when it rated the match. This file only finds the match and draws.
//
//   Match Result Card   what opens first: the winners as the heroes, the score,
//                       one story, one expected-vs-performance line and the
//                       winners' rating gains. Shareable as a picture.
//   Match Analysis      one tap behind it: both teams' expected / actual /
//                       difference, game share, and every player's movement.
//
// Opening it from another surface takes one line: put scorecardButtonHtml(id)
// in that surface's markup. A single delegated listener (initMatchScorecard,
// called once by the shell) opens the sheet for any [data-scorecard] control,
// so Games, the approval confirmation, and later Recent Results, the profile
// history or Rankings need no wiring of their own.
//
// Owning stream: functional (presentation of recorded facts).

// The scorecard view model for one match id, from the app's own match list and
// the engine's recorded facts. Null when the id is not a played match.
function matchScorecardFor(matchId){
  if(typeof MatchScorecard === 'undefined') return null;
  const m = getAllApprovedMatches().find(x => x.id === matchId);
  if(!m) return null;
  return MatchScorecard.build(m, (V3_MATCH_FACTS || {})[matchId] || null, { tierOf: historicalTierOf });
}

// The Match Result Card's view model: the same scorecard, its celebratory face.
function matchResultCardFor(matchId){
  const vm = matchScorecardFor(matchId);
  return vm ? MatchScorecard.resultCard(vm) : null;
}

function scorecardButtonHtml(matchId, label){
  return `<button type="button" class="scorecard-open" data-scorecard="${escapeHtml(matchId)}">${escapeHtml(label || '🏆 Match result')}</button>`;
}

// "+4.8", "−4.3pp" -- a real minus sign, so a negative never reads as a dash.
function scorecardSigned(v, unit){
  if(typeof v !== 'number') return '—';
  const s = v > 0 ? '+' : (v < 0 ? '−' : '±');
  return `${s}${Math.abs(v).toFixed(1)}${unit}`;
}

// "Wed 30 Sep 2026 · Doubles · AA vs AA"
function matchResultContext(card){
  const d = dayLabel(card.date).replace(/^(\w{3})\w*,/, '$1');
  return [d, card.format === 'singles' ? 'Singles' : 'Doubles', card.matchup].filter(Boolean).join(' · ');
}

const mrcTier = (t) => `<span class="mrc-tier">${t ? escapeHtml(t) : '—'}</span>`;

// ---- The Match Result Card -------------------------------------------------
function matchResultCardHtml(card){
  if(!card) return `<div class="msc-empty">That match is not in the record.</div>`;
  const side = (players) => players.map(p => `<span class="mrc-hero"><span class="mrc-hero-name">${escapeHtml(p.name)}</span>${mrcTier(p.tier)}</span>`)
    .join('<span class="mrc-amp">&amp;</span>');
  const heroes = side(card.heroes);
  const opponents = card.opponents.map(p => `<span class="mrc-opp">${escapeHtml(p.name)} ${mrcTier(p.tier)}</span>`).join(' &amp; ');
  const sets = card.sets.map(s => `<span class="mrc-set">${s[0]}–${s[1]}</span>`).join('');
  const st = card.stats;
  // A celebratory card does not paint a winner's shortfall red: the figure is
  // shown as it is, in a neutral tone (the analysis keeps the colours). On a
  // draw it says whose figures these are, since nobody won.
  const stats = st ? `${card.isDraw ? `<div class="mrc-stats-who">${st.names.map(escapeHtml).join(' &amp; ')} vs expectation</div>` : ''}<div class="mrc-stats">
      <div class="mrc-stat"><b data-fig="expected">${st.expectedPct.toFixed(1)}%</b><span>Expected</span></div>
      <div class="mrc-stat"><b data-fig="performance">${st.performancePct.toFixed(1)}%</b><span>Performance</span></div>
      <div class="mrc-stat mrc-stat-key"><b data-fig="pp" class="${st.vsExpectedPp > 0 ? 'mrc-up' : ''}">${scorecardSigned(st.vsExpectedPp, 'pp')}</b><span>vs expectation</span></div>
    </div>` : `<div class="mrc-unrated">Not rated yet — the numbers arrive once the result is approved.</div>`;
  const rewards = card.rewards.length
    ? `<div class="mrc-rewards"><span class="mrc-rewards-label">Rating</span>${card.rewards.map(r =>
        `<span class="mrc-reward" data-player="${escapeHtml(r.name)}">${escapeHtml(r.name)} <b>${scorecardSigned(r.movement, '')}</b></span>`).join('')}</div>`
    : '';
  return `<div class="mrc${card.isDraw ? ' mrc-draw' : ''}" data-match="${escapeHtml(card.matchId)}" data-story="${escapeHtml(card.story.key)}" aria-label="${escapeHtml(card.headline)}">
    <div class="mrc-top">
      <img src="${CLUB.logo}" alt="" class="mrc-mark"><span class="mrc-brand">${escapeHtml(CLUB.name)}</span>
    </div>
    <div class="mrc-when">${escapeHtml(matchResultContext(card))}${matchNoteMarkHtml(card.matchId)}</div>
    ${matchNoteLineHtml(card.matchId)}
    ${card.isDraw
      // Nobody won: both pairs alike -- same type, size and colour -- one
      // above the other, so neither reads as the winner.
      ? `<div class="mrc-heroes mrc-side">${heroes}</div>
    <div class="mrc-vs">vs</div>
    <div class="mrc-heroes mrc-side">${side(card.opponents)}</div>
    <div class="mrc-kicker">${escapeHtml(card.kicker)}</div>
    <div class="mrc-score" data-sets="${card.sets.length}">${sets}</div>`
      : `<div class="mrc-heroes">${heroes}</div>
    <div class="mrc-kicker">${escapeHtml(card.kicker)}</div>
    <div class="mrc-score" data-sets="${card.sets.length}">${sets}</div>
    <div class="mrc-against">${escapeHtml(card.against)} ${opponents}</div>`}
    <div class="mrc-story">
      <div class="mrc-story-title">${escapeHtml(card.story.title)}</div>
      <div class="mrc-story-line">${escapeHtml(card.story.line)}</div>
    </div>
    ${stats}
    ${rewards}
  </div>`;
}

// ---- The Match Analysis ----------------------------------------------------
// The full breakdown: both teams side by side, every figure the engine
// recorded, losers' movements included, and what the numbers mean.
function matchAnalysisHtml(vm){
  if(!vm) return `<div class="msc-empty">That match is not in the record.</div>`;
  const fmt1 = (v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '—');
  const toneOf = (v) => (typeof v !== 'number' || v === 0 ? '' : (v > 0 ? ' msc-pos' : ' msc-neg'));
  const result = vm.isDraw ? 'Draw' : `${vm.teams[0].names.map(escapeHtml).join(' & ')} won`;
  const context = [vm.format === 'singles' ? 'Singles' : 'Doubles', vm.matchup, vm.categoryLabel].filter(Boolean).map(escapeHtml).join(' · ');

  const teamHtml = (t) => {
    const players = t.players.map(p => `<div class="msc-player">
        <span class="msc-name">${escapeHtml(p.name)}</span>
        <span class="msc-tier" title="Tier on the day">${p.tier ? escapeHtml(p.tier) : '—'}</span>
        <span class="msc-move${toneOf(p.movement)}" title="Rating movement from this match">${typeof p.movement === 'number' ? scorecardSigned(p.movement, '') : '—'}</span>
      </div>`).join('');
    const tag = vm.isDraw ? 'Draw' : (t.won ? 'Won' : 'Lost');
    return `<div class="msc-team${t.won ? ' msc-won' : ''}" data-team="${t.no}">
      <div class="msc-team-head"><span>${t.names.map(escapeHtml).join(' & ')}</span><span class="msc-result">${tag}</span></div>
      ${players}
      <div class="msc-figs">
        <div class="msc-fig"><span>Expected</span><b data-fig="expected">${fmt1(t.expectedPct)}</b></div>
        <div class="msc-fig"><span>Performance</span><b data-fig="actual">${fmt1(t.actualPct)}</b></div>
        <div class="msc-fig"><span>vs expectation</span><b data-fig="pp" class="${toneOf(t.vsExpectedPp).trim()}">${scorecardSigned(t.vsExpectedPp, 'pp')}</b></div>
      </div>
      <div class="msc-games">Games ${t.games}–${t.opponentGames}${typeof t.gameSharePct === 'number' ? ` (${t.gameSharePct.toFixed(1)}% of games)` : ''}</div>
    </div>`;
  };

  const note = vm.rated
    ? `Expected and Performance are the rating engine's performance scores, recorded when this match was rated: 80% share of games won plus 20% the result (win 1, draw ½, loss 0). The difference, times each player's own K, is how far their rating moved. Tiers are the tiers held on the day.`
    : `This match has no rating record yet, so there is no expectation or movement to show. Nothing here is estimated.`;

  return `<div class="msc" data-match="${escapeHtml(vm.matchId)}">
    <div class="msc-head">
      <div class="msc-date">${escapeHtml(dayLabel(vm.date))}</div>
      <div class="msc-context">${context}</div>
      <div class="msc-score">${escapeHtml(vm.scoreText)}</div>
      <div class="msc-winner">${result}</div>
    </div>
    <div class="msc-teams">${vm.teams.map(teamHtml).join('')}</div>
    <div class="msc-note">${note}</div>
  </div>`;
}

// ---- The sheet ---------------------------------------------------------------
// One sheet, two views of one match: the Result Card first, the Analysis one
// tap behind it, and back again.
let matchScorecardView = { id: null, view: 'result', message: '', ready: null };

function openMatchScorecard(matchId, view){
  let modal = document.getElementById('matchScorecardModal');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'shell-more-sheet';
    modal.id = 'matchScorecardModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Match result');
    document.body.appendChild(modal);
    modal.addEventListener('click', (e)=>{
      const t = e.target;
      if(t === modal || (t.closest && t.closest('[data-scorecard-close]'))){ modal.classList.remove('show'); return; }
      const go = t.closest && t.closest('[data-scorecard-view]');
      if(go){ openMatchScorecard(matchScorecardView.id, go.dataset.scorecardView); return; }
      if(t.closest && t.closest('[data-scorecard-share]')) shareMatchResult(matchScorecardView.id);
    });
  }
  if(matchScorecardView.id !== matchId) matchScorecardView = { id: matchId, view: 'result', message: '', ready: null };
  matchScorecardView.view = view || 'result';
  renderMatchScorecardSheet(modal);
  modal.classList.add('show');
}

function renderMatchScorecardSheet(modal){
  const { id, view, message, ready } = matchScorecardView;
  const analysis = view === 'analysis';
  const card = analysis ? null : matchResultCardFor(id);
  const body = analysis ? matchAnalysisHtml(matchScorecardFor(id)) : matchResultCardHtml(card);
  const actions = analysis
    ? `<button type="button" class="msc-action" data-scorecard-view="result">← Back to result</button>`
    : (card ? `<button type="button" class="msc-action msc-action-primary" data-scorecard-share>${ready ? 'Tap to share' : 'Share result'}</button>
       <button type="button" class="msc-action" data-scorecard-view="analysis">View match analysis</button>` : '');
  modal.innerHTML = `<div class="shell-more-panel msc-panel" data-view="${analysis ? 'analysis' : 'result'}">
    <div class="msc-title-row"><h3>${analysis ? 'Match analysis' : 'Match result'}</h3><button type="button" class="msc-close" data-scorecard-close aria-label="Close">✕</button></div>
    ${body}
    <div class="msc-actions">${actions}</div>
    ${message ? `<div class="msc-message">${escapeHtml(message)}</div>` : ''}
  </div>`;
}

// ---- Sharing -------------------------------------------------------------------
// The Result Card as a picture (CardPainter.matchResult), through the phone's
// share sheet -- WhatsApp is on it -- or saved where a browser cannot share
// files. When preparing the picture used up the tap a share sheet needs, the
// button turns into "Tap to share", which shares at once.
async function shareMatchResult(matchId){
  const modal = document.getElementById('matchScorecardModal');
  const say = (msg) => { matchScorecardView.message = msg; if(modal) renderMatchScorecardSheet(modal); };
  try {
    let pending = matchScorecardView.ready;
    if(!pending){
      const card = matchResultCardFor(matchId);
      if(!card) return;
      const brand = await CardPainter.loadImage(CLUB.logo);
      const cv = CardPainter.matchResult(card, { brand, when: matchResultContext(card) });
      const name = `${CLUB.fileSlug}-${String(card.matchId).replace(/[^A-Za-z0-9_-]+/g, '-')}-result.png`;
      pending = { files: [await CardPainter.toFile(cv, name)], meta: { title: card.headline, text: `${card.headline} — ${card.sets.map(s => s.join('–')).join(', ')}. ${card.story.title}.` } };
    }
    const outcome = await CardPainter.share(pending.files, pending.meta);
    matchScorecardView.ready = outcome === 'ready' ? pending : null;
    say(outcome === 'shared' ? 'Shared.' : outcome === 'saved' ? 'Saved to this device — post it from your photos.' : '');
  } catch(e){
    matchScorecardView.ready = null;
    say('Could not make the picture: ' + e.message);
  }
}

// One listener for every result control in the app, wherever it is drawn.
function initMatchScorecard(){
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest && e.target.closest('[data-scorecard]');
    if(!btn) return;
    e.preventDefault();
    openMatchScorecard(btn.dataset.scorecard);
  });
}
