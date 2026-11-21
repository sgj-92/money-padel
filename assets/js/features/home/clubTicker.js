// ===================== THE CLUB TICKER =====================
// Shaun, 21 Nov (from LPT Sports' app): "the floating thing with information
// at the top ... slowly moves across the screen". A strip under the header
// that scrolls the club's news: players, games this period, the most active,
// the race leader, the top rating, the next booked game, the latest result,
// doughnuts. Everything comes from what the app already holds; a fact that
// cannot be worked out is left out, never guessed. A pause button stops it,
// and a reader who asks their phone for less motion gets it still.
// Declarations only; drawn by renderClubTicker() after each recompute.

let clubTickerPaused = (() => { try { return localStorage.getItem('clubTickerPaused') === '1'; } catch(e){ return false; } })();

function clubTickerItems(){
  const items = [];
  const add = (fn) => { try { const x = fn(); if(x) items.push(x); } catch(e){ /* that fact is left out */ } };
  const period = typeof currentMonthKey === 'function' ? currentMonthKey() : null;
  const noun = (CLUB.period && CLUB.period.noun) || 'month';
  const inPeriod = (m) => period && Period.of(m.date) === period;
  const games = getAllApprovedMatches();
  const thisPeriod = games.filter(inPeriod);

  add(() => { const n = entryPlayerNames().length; return n ? { icon: '👥', label: 'Players', value: String(n) } : null; });
  add(() => thisPeriod.length ? { icon: '🎾', label: `This ${noun}`, value: `${thisPeriod.length} game${thisPeriod.length === 1 ? '' : 's'}` } : null);
  add(() => {
    const count = {};
    thisPeriod.forEach(m => m.winners.concat(m.losers).forEach(n => { count[n] = (count[n] || 0) + 1; }));
    const top = Object.entries(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return top ? { icon: '⚡', label: 'Most active', value: `${top[0]} · ${top[1]} game${top[1] === 1 ? '' : 's'}` } : null;
  });
  add(() => {
    if(!period || typeof buildMonthlyRace !== 'function') return null;
    const lead = MonthlyRace.overall(buildMonthlyRace(period).table, raceMinMatches()).find(r => r.qualified);
    return lead ? { icon: '🏁', label: 'Leading the race', value: `${lead.playerId} ${racePoints(lead.score)}` } : null;
  });
  add(() => {
    const top = PLAYERS.filter(p => isRankingEligible(p.name)).sort((a, b) => b.rating - a.rating)[0];
    return top ? { icon: '👑', label: 'Top rating', value: `${top.name} ${Math.round(top.rating)}` } : null;
  });
  add(() => {
    if(typeof canSeeTab === 'function' && !canSeeTab('upcoming')) return null;
    const today = localIsoToday(), now = new Date().toISOString();
    const next = gameRequestsState.filter(r => FixtureFlow.isAgreed(r) && FixtureFlow.stage(r, now) === FixtureFlow.STAGE.UPCOMING && r.preferredDate && r.preferredDate >= today)
      .sort(FixtureFlow.upcomingOrder)[0];
    if(!next) return null;
    const [a, b] = requestTeams(next);
    return { icon: '📅', label: 'Next game', value: `${fmtFixtureDate(next.preferredDate)}${next.preferredTime ? ` ${next.preferredTime}` : ''} · ${a.join(' & ')} v ${b.join(' & ')}` };
  });
  add(() => {
    const last = games.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
    return last ? { icon: '🔥', label: 'Latest', value: `${MatchOutcome.describe(last)} ${last.sets.map(s => s.join('-')).join(' ')}` } : null;
  });
  add(() => {
    const d = thisPeriod.reduce((n, m) => n + (m.sets || []).filter(([a, b]) => (a === 6 && b === 0) || (a === 0 && b === 6)).length, 0);
    return d ? { icon: '🍩', label: `Doughnuts this ${noun}`, value: String(d) } : null;
  });
  return items;
}

function clubTickerEl(){
  const header = document.querySelector('.shell-header');
  let el = document.getElementById('clubTicker');
  // Straight under the header, whatever has been added since.
  if(el){ if(header && header.nextElementSibling !== el) header.parentNode.insertBefore(el, header.nextSibling); return el; }
  if(!header) return null;
  el = document.createElement('div');
  el.id = 'clubTicker';
  el.className = 'club-ticker';
  el.setAttribute('role', 'marquee');
  el.setAttribute('aria-label', `${CLUB.name} news`);
  header.parentNode.insertBefore(el, header.nextSibling);
  return el;
}

function renderClubTicker(){
  if(typeof isStandingsMode === 'function' && isStandingsMode()) return;
  const el = clubTickerEl();
  if(!el) return;
  const items = clubTickerItems();
  if(items.length < 2){ el.style.display = 'none'; return; }
  el.style.display = '';
  const run = items.map(it => `<span class="club-ticker-item"><span class="club-ticker-icon" aria-hidden="true">${it.icon}</span>${escapeHtml(it.label)} <b>${escapeHtml(it.value)}</b></span><span class="club-ticker-dot" aria-hidden="true">•</span>`).join('');
  // Twice over, so the strip loops without a gap.
  el.innerHTML = `<div class="club-ticker-window"><div class="club-ticker-track${clubTickerPaused ? ' is-paused' : ''}">${run}<span aria-hidden="true" class="club-ticker-copy">${run}</span></div></div>
    <button type="button" class="club-ticker-pause" aria-label="${clubTickerPaused ? 'Play' : 'Pause'} the news">${clubTickerPaused ? '▶' : '❚❚'}</button>`;
  const track = el.querySelector('.club-ticker-track');
  // A steady reading pace, however much there is to say.
  requestAnimationFrame(() => { track.style.animationDuration = `${Math.max(20, Math.round(track.scrollWidth / 2 / 40))}s`; });
  el.querySelector('.club-ticker-pause').onclick = () => {
    clubTickerPaused = !clubTickerPaused;
    try { localStorage.setItem('clubTickerPaused', clubTickerPaused ? '1' : '0'); } catch(e){ /* not kept: fine */ }
    track.classList.toggle('is-paused', clubTickerPaused);
    const b = el.querySelector('.club-ticker-pause');
    b.textContent = clubTickerPaused ? '▶' : '❚❚';
    b.setAttribute('aria-label', `${clubTickerPaused ? 'Play' : 'Pause'} the news`);
  };
}
