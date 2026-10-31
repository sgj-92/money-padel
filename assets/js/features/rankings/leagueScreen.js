// ===================== RANKINGS: LEAGUE / MERIT / RACE / INFORMATION =====================
// Rankings › League: the Month and View controls, the League (By tier / All
// together / Last 10), Merit and Monthly Race tables with their disclosures
// and drill-downs, and the Information view with its WhatsApp summary.
// Presentation and screen state; the inputs and standings order come from
// monthlyTablesData.js and the canonical modules.
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: redesign. summaryMonth / summaryMode stay in app.js with
// the other per-screen months. Loads before app.js; declarations only.

// ===================== MERIT TABLE =====================
// An alternative league view, not a replacement and not a rating. The League
// Table treats every win alike; this one asks how hard the partnership you beat
// was, using ONLY the tiers held on the day of the match.
//
// It lives behind the existing View select rather than as a fourth segmented
// button: that control already answers "which table am I looking at", and a
// fourth button on a 375px screen is the overcrowding the brief warned about.
// Everything below it -- month, By tier / All together, the independent tier
// collapses -- is the League screen's own machinery, reused.

// ===================== MONTHLY RACE (Best Month) — trial =====================
// A fourth view on the League screen, beside League and Merit, following the
// same month (Meaningful Month) and the same tier-on-the-day split. The
// arithmetic lives in monthlyRace.js and nowhere else; this only draws it.
// Tier-only by design: the race is run against a tier's par, so an "All
// together" table would compare scores measured against different standards.

function renderSummary(){
  const box = document.getElementById('summaryView');
  // Same "most recently completed month" logic as Power Rankings, so
  // Monthly Summary opens on a finished competition period too, not
  // whatever month happens to have the newest logged match.
  // Also re-checked on every render, not just the first: narrowing the Data
  // Range can strand the month this screen was last left on, and falling back
  // to the default beats rendering an empty month.
  // Normally set on arrival (see the tab handler). Two cases get here
  // without one: a first draw that did not come by navigation, and a month
  // that a narrowed Data Range has taken away -- both re-arrive.
  if(!summaryMonth || (summaryMonth !== 'all' && !getAvailableMonths().includes(summaryMonth))){
    if(summaryMonth && summaryMonthChoice === summaryMonth) summaryMonthChoice = null;
    arriveAtSummary();
  }

  // Month and View stay, both of them -- but side by side rather than stacked,
  // which is 85px of the screen back. On a phone they were pushing the table
  // itself below the fold, and the table is what the screen is for.
  let html = `<div class="fg-controls lg-controls">
    <div class="fg-row"><label class="fg-label">Month</label>
      <select id="summaryMonthSelect" class="fg-select"></select>
    </div>
    <div class="fg-row"><label class="fg-label">View</label>
      <select id="summaryModeSelect" class="fg-select">
        <option value="race">Monthly Race</option>
        <option value="merit">Merit Table</option>
        <option value="league">League Table</option>
        <option value="information">Information</option>
      </select>
    </div>
  </div>
  ${summaryMonthChoice === null ? meaningfulMonthNoteHtml(summaryMonthDefault, summaryMonth, 'summaryMonth') : ''}
  <div id="summaryContent"></div>`;

  box.innerHTML = html;
  populateSummaryMonthSelect();
  wireMeaningfulMonthNote('summaryMonth', (month)=>{
    summaryMonthChoice = month;
    summaryMonth = month;
    renderSummary();
  });
  const modeSel = document.getElementById('summaryModeSelect');
  modeSel.value = summaryMode;
  modeSel.onchange = (e)=>{ summaryMode = e.target.value; renderSummary(); };

  resetLeagueTierSections();

  const legacyExplainer = document.getElementById('explainerWrapper');
  // Merit carries its own explanation too, so the legacy per-tab block would
  // be a second one on that view as well.
  if(legacyExplainer) legacyExplainer.style.display = (summaryMode === 'league' || summaryMode === 'merit' || summaryMode === 'race') ? 'none' : '';

  if(summaryMode === 'league') renderSummaryLeagueTable();
  else if(summaryMode === 'merit') renderMeritTable();
  else if(summaryMode === 'race') renderMonthlyRace();
  else renderSummaryInformation();
}

let leagueGrouped = true;

let leagueSortKey = 'points';

let leagueSortDesc = true;

// The explanation starts closed: the point of the screen is the table, and on
// a phone the explanation was putting it below the fold. Not persisted -- the
// screen should open the same way every time.
let leagueExplainerOpen = false;

// Each tier collapses on its own. A single global `Tier tables` fold was the
// first attempt and was wrong twice over: it added a control heavier than the
// headings it hid, and it made the four tiers one thing when they are four
// separate competitions -- there is no reason hiding Tier C should hide A.
//
// Open by default, and reset to open on entry to By tier: a reader arriving at
// the screen wants the tables, not four collapsed rows to reopen.
let leagueTierOpen = {};

// Resetting means forgetting what was touched, not forcing everything open --
// the defaults above then apply again.
function resetLeagueTierSections(){
  leagueTierOpen = {};
}

// Last 10 is a third table alongside By tier / All together, not a mode of
// either: it is not scoped to the selected month at all, so it cannot share
// their month-based aggregation.
//
// Deliberately a SEPARATE flag from `leagueGrouped` rather than one
// three-valued variable. `leagueGrouped` already means "by tier or all
// together" and is written directly by tests and the capture script; a second
// variable that also encoded that fact let a caller set one and leave the
// screen contradicting itself. These two never overlap.
let leagueLastTen = false;

// Order matters here: the league-calculation fields (P/W/L/D/GD/Pts) come
// first so they're what's visible in an iPhone-width viewport without
// scrolling; Avg Opp/Form are supporting context, not part of the points
// calculation, and deliberately sit last so they're what overflows (behind
// a subtle divider -- see .league-context-col in app.css) if anything has
// to.
const LEAGUE_COLUMNS = [
  { key: null, label: '#', align: 'left' },
  { key: 'name', label: 'Player', align: 'left' },
  { key: 'games', label: 'P', align: 'center' },
  { key: 'wins', label: 'W', align: 'center' },
  { key: 'draws', label: 'D', align: 'center' },
  { key: 'losses', label: 'L', align: 'center' },
  { key: 'gd', label: 'GD', align: 'center' },
  { key: 'points', label: 'Pts', align: 'right' },
  { key: 'avg_opp', label: 'Avg Opp', align: 'center' },
  { key: 'recent_form', label: 'Form (10g)', align: 'center' },
];

// Which League count is open, if any. One at a time, as in Merit.
let leagueDrill = null;

function buildLeagueTableHtml(rows, showTierColumn){
  const sorted = sortLeagueRows(rows);
  const cols = showTierColumn ? 11 : 10;
  let html = `<div class="callout-card" style="padding:0; overflow-x:auto;">
    <table style="width:100%; border-collapse:collapse; font-size:11px; white-space:nowrap;">
      <thead><tr style="background:var(--bg2); text-align:left;">`;
  html += `<th style="padding:7px 4px 7px 8px;">#</th>`;
  html += `<th class="league-sort-th" data-key="name" style="padding:7px 4px; cursor:pointer;">Player${leagueSortKey==='name'?(leagueSortDesc?' ▾':' ▴'):''}</th>`;
  if(showTierColumn) html += `<th style="padding:7px 4px; text-align:center;">Tier</th>`;
  // Core league-calculation columns first (what an iPhone-width viewport
  // needs to show without scrolling); avg_opp/recent_form are supporting
  // context, not part of the points calculation, so they come last, and
  // avg_opp gets the separator marking where "the table" ends and
  // "context" begins -- see .league-context-col in app.css.
  // P W D L, the order every table in the app uses (Merit, the Race, the Board Pack).
  ['games','wins','draws','losses','gd','points','avg_opp','recent_form'].forEach(key=>{
    const col = LEAGUE_COLUMNS.find(c=>c.key===key);
    const arrow = leagueSortKey===key ? (leagueSortDesc?' ▾':' ▴') : '';
    const contextClass = key==='avg_opp' ? ' league-context-col' : '';
    html += `<th class="league-sort-th${contextClass}" data-key="${key}" style="padding:7px 4px; text-align:${col.align}; cursor:pointer;">${col.label}${arrow}</th>`;
  });
  html += `</tr></thead><tbody>`;
  sorted.forEach((r,i)=>{
    const formHtml = (r.recent_form !== null && r.recent_form !== undefined)
      ? (r.recent_form_stale
          ? `<span style="color:var(--text-dim); opacity:0.7;" title="stale">${r.recent_form>=0?'+':''}${r.recent_form}% (${PlayerForm.recordShort({ wins: r.recent_form_wins, draws: r.recent_form_draws, losses: r.recent_form_losses })}) ⏸</span>`
          : `<span style="color:${r.recent_form>3?'var(--green)':(r.recent_form<-3?'var(--red)':'var(--text-dim)')};">${r.recent_form>=0?'+':''}${r.recent_form}%</span> <span style="color:var(--text-dim); font-size:10px;">(${PlayerForm.recordShort({ wins: r.recent_form_wins, draws: r.recent_form_draws, losses: r.recent_form_losses })})</span>`)
      : `<span style="color:var(--text-dim);">–</span>`;
    html += `<tr style="border-top:1px solid var(--line);">
      <td style="padding:7px 4px 7px 8px; color:var(--text-dim);">${i+1}</td>
      <td style="padding:7px 4px;"><span class="request-player-link" data-player="${r.name}" style="text-decoration:underline; cursor:pointer; font-weight:700;">${r.name}</span></td>
      ${showTierColumn ? `<td style="padding:7px 4px; text-align:center;"><span class="badge ${r.tier}" style="display:inline-flex; width:20px; height:20px; font-size:10px;">${r.tier}</span></td>` : ''}
      <td style="padding:7px 4px; text-align:center;">${tableCountCell(leagueDrill, r.name, r.segmentTier, 'played', r.games, { plain: true })}</td>
      <td style="padding:7px 4px; text-align:center; color:var(--green);">${tableCountCell(leagueDrill, r.name, r.segmentTier, 'wins', r.wins, { plain: true, colour: 'var(--green)' })}</td>
      <td style="padding:7px 4px; text-align:center; color:var(--text-dim);">${tableCountCell(leagueDrill, r.name, r.segmentTier, 'draws', r.draws, { plain: true, colour: 'var(--text-dim)' })}</td>
      <td style="padding:7px 4px; text-align:center; color:var(--red);">${tableCountCell(leagueDrill, r.name, r.segmentTier, 'losses', r.losses, { plain: true, colour: 'var(--red)' })}</td>
      <td style="padding:7px 4px; text-align:center;">${r.gd>=0?'+':''}${r.gd}</td>
      <td style="padding:7px 8px 7px 4px; text-align:right; font-weight:700; color:var(--gold-bright);">${r.points}</td>
      <td class="league-context-col" style="padding:7px 4px; text-align:center;">${r.avg_opp}</td>
      <td style="padding:7px 4px; text-align:center;">${formHtml}</td>
    </tr>`;
    html += tableCountDrillHtml(leagueDrill, cols, r.name, r.segmentTier, r.matchList);
  });
  html += `</tbody></table></div>`;
  return html;
}

// The run, newest first. Points say how the ten went; this says which way
// they are going, which is the whole reason to look at form rather than a
// season table.
// The third renderer of a form run, and the reason the classification is
// shared rather than repeated: this one keyed a colour map off the raw letter,
// Home tested it for truth, and the profile lower-cased it. Three answers to
// one question is how they came to disagree.
function lastTenRunHtml(run){
  const colour = { w: 'var(--green)', l: 'var(--red)', d: 'var(--draw)', '': 'var(--text-dim)' };
  return run.slice(0, 5).map(r =>
    `<span style="display:inline-block; width:13px; text-align:center; color:${colour[MatchOutcome.classFor(r)]}; font-weight:700;">${r}</span>`
  ).join('');
}

function buildLastTenTableHtml(rows){
  const sorted = sortLastTenRows(rows);
  const cols = [
    { key: 'games', label: 'P' }, { key: 'wins', label: 'W' },
    { key: 'draws', label: 'D' }, { key: 'losses', label: 'L' },
    { key: 'gd', label: 'GD' }, { key: 'points', label: 'Pts' },
  ];
  let html = `<div class="callout-card" style="padding:0; overflow-x:auto;">
    <table style="width:100%; border-collapse:collapse; font-size:11px; white-space:nowrap;">
      <thead><tr style="background:var(--bg2); text-align:left;">
      <th style="padding:7px 4px 7px 8px;">#</th>
      <th class="league-sort-th" data-key="name" style="padding:7px 4px; cursor:pointer;">Player${leagueSortKey==='name'?(leagueSortDesc?' ▾':' ▴'):''}</th>`;
  cols.forEach(c=>{
    const arrow = leagueSortKey===c.key ? (leagueSortDesc?' ▾':' ▴') : '';
    const align = c.key==='points' ? 'right' : 'center';
    html += `<th class="league-sort-th" data-key="${c.key}" style="padding:7px 4px; text-align:${align}; cursor:pointer;">${c.label}${arrow}</th>`;
  });
  html += `<th class="league-context-col" style="padding:7px 8px 7px 4px; text-align:center;">Last 5</th>`;
  html += `</tr></thead><tbody>`;
  sorted.forEach((r,i)=>{
    // A short sample is marked ON the row, beside the P it applies to. A
    // 4-game row can top this table on points and that is not wrong -- but
    // the reader is told it is four games, not left to infer it.
    const shortMark = r.short
      ? ` <span class="l10-short" title="Fewer than ${r.window} rated games in the record">of ${r.window}</span>`
      : '';
    html += `<tr style="border-top:1px solid var(--line);">
      <td style="padding:7px 4px 7px 8px; color:var(--text-dim);">${i+1}</td>
      <td style="padding:7px 4px;"><span class="request-player-link" data-player="${escapeHtml(r.name)}" style="text-decoration:underline; cursor:pointer; font-weight:700;">${escapeHtml(r.name)}</span></td>
      <td style="padding:7px 4px; text-align:center;">${r.games}${shortMark}</td>
      <td style="padding:7px 4px; text-align:center; color:var(--green);">${r.wins}</td>
      <td style="padding:7px 4px; text-align:center; color:var(--text-dim);">${r.draws}</td>
      <td style="padding:7px 4px; text-align:center; color:var(--red);">${r.losses}</td>
      <td style="padding:7px 4px; text-align:center;">${r.gd>=0?'+':''}${r.gd}</td>
      <td style="padding:7px 4px; text-align:right; font-weight:700; color:var(--gold-bright);">${r.points}</td>
      <td class="league-context-col" style="padding:7px 8px 7px 4px; text-align:center;">${lastTenRunHtml(r.run)}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function leagueTierHeading(tier, open){
  return foldHeading(`leagueTier${escapeHtml(tier)}`, `Tier ${escapeHtml(tier)}`, open,
    { data: { tier }, bodyId: `leagueTierBody${escapeHtml(tier)}` });
}

// The tiers a player occupied across a month, as `B` or `B → A`. Built from
// the recorded tier changes rather than from the dates they happened to play,
// because occupying a tier and playing in one are different things.
//
// All Time is not a month and a whole career of moves is not a table column,
// so it falls back to where they are now.
function tierSpellLabel(name, month){
  if(!month || month === 'all' || !V3_TIER_HISTORY) return null;
  const start = month + '-01';
  const end = month + '-31';
  const dates = [start].concat(
    (V3_TIER_HISTORY.changesFor(name) || [])
      .map(c => c.effectiveDate)
      .filter(d => d >= start && d <= end));
  return LeagueSplit.transitionLabel(LeagueSplit.tiersOver(dates, (d) => historicalTierOf(name, d)));
}

function renderSummaryLeagueTable(){
  const content = document.getElementById('summaryContent');
  const label = summaryMonth === 'all' ? 'All Time' : monthLabel(summaryMonth);

  // Two different questions, so two aggregations.
  //
  //   By tier      — each match filed under the tier in force on its own date,
  //                  so a player who moved mid-month appears in both tables
  //                  with only what they earned while in each.
  //   All together — not a tier table, so one row for the whole month, with
  //                  the tier column saying what changed.
  //
  // Recent Form is always the last-10-games figure (not scoped to the selected
  // month) -- the same established meaning it has everywhere else in the app.
  const withForm = (s, tier) => {
    const form = computeRecentForm(s.name, 10);
    return {
      ...s, tier,
      recent_form: form ? form.avgPct : null,
      recent_form_wins: form ? form.wins : 0,
      recent_form_losses: form ? form.losses : 0,
      recent_form_draws: form ? form.draws : 0,
      recent_form_stale: form ? form.daysSinceLastGame > RECENT_FORM_STALE_DAYS : false,
    };
  };

  const splitRows = leagueSplitRows(summaryMonth).map(s => withForm(s, s.tier));

  const wholeRows = Object.values(computeMonthlySummaryStats(summaryMonth)).map(s => {
    // The tier column shows the month as it was LIVED, not as it was played:
    // a player promoted on the 20th occupied two tiers in September whether or
    // not they got on court again, and the row should say so.
    const p = PLAYERS.find(x=>x.name===s.name);
    const label = tierSpellLabel(s.name, summaryMonth);
    return withForm(s, label || (p ? p.tier : '?'));
  });

  const isLastTen = leagueLastTen;

  // Last 10 is club-wide and spans whatever months each player's own games
  // fall in, so the month in the heading would be a lie on that view.
  let html = `<div class="section-heading" style="margin-top:6px;">🏆 ${isLastTen ? 'Last 10' : label + ' League Table'}</div>`;

  html += leagueInlineFold('leagueExplainerToggle', 'How this table works', leagueExplainerOpen,
    isLastTen
      ? `<div class="section-sub" style="margin:0;">Each player's own most recent ${LastTen.WINDOW} rated games, wherever they fall — this table is not scoped to the selected month, so two rows cover the same number of games rather than the same number of days. Same league scoring as everywhere else: 3 points for a win, 1 for a draw, tiebreak on game difference. Anyone with fewer than ${LastTen.WINDOW} games in the record shows the games they actually have, marked <span class="l10-short">of ${LastTen.WINDOW}</span> — the sample is never padded. "Last 5" is the run, newest first. Tap a column header to sort by it.</div>`
      : `<div class="section-sub" style="margin:0;">Updates live as the month's games are added — 3 points for a win, 1 for a draw, tiebreak on game difference. Tap a column header to sort by it. "Form" is each player's last 10 games overall, not scoped to this month. Tier S isn't shown — one player can't have a table.${leagueGrouped ? ' A player who changed tier mid-month appears in both tier tables, holding only the points they earned in each.' : ''}</div>`);

  html += `<div class="fg-toggle" style="margin:8px 0 14px;">
    <button class="fg-toggle-btn ${!isLastTen && leagueGrouped?'active':''}" id="leagueGroupedBtn">By tier</button>
    <button class="fg-toggle-btn ${!isLastTen && !leagueGrouped?'active':''}" id="leagueAllBtn">All together</button>
    <button class="fg-toggle-btn ${isLastTen?'active':''}" id="leagueLastTenBtn">Last 10</button>
  </div>`;

  if(isLastTen){
    const rows = PerfTrace.time('LastTen.build', ()=> LastTen.build(leagueAppearances())).filter(r => r.games > 0);
    if(rows.length === 0) html += `<div class="section-sub">No rated games in the record yet.</div>`;
    else html += buildLastTenTableHtml(rows);
  } else if(leagueGrouped){
    // Every tier the club actually uses, so a Tier S player is not silently
    // dropped from the grouped table. Each one collapses on its own: they are
    // four separate competitions, not one block.
    let anyTierShown = false;
    groupedTiers().forEach(tier=>{
      const rows = splitRows.filter(s => s.tier === tier && s.games > 0);
      if(rows.length === 0) return;
      anyTierShown = true;
      const open = tierSectionOpen(leagueTierOpen, tier, rows.length);
      html += leagueTierHeading(tier, open);
      if(open) html += `<div id="leagueTierBody${tier}">${buildLeagueTableHtml(rows, false)}</div>`;
    });
    if(!anyTierShown) html += `<div class="section-sub">No games recorded for ${label}.</div>`;
  } else {
    const rows = wholeRows.filter(s => s.tier !== 'S' && s.games > 0);
    if(rows.length === 0) html += `<div class="section-sub">No games recorded for ${label}.</div>`;
    else html += buildLeagueTableHtml(rows, true);
  }

  content.innerHTML = html;
  wireRequestPlayerLinks(content);
  wireTableCounts(content, ()=> leagueDrill, (k)=>{ leagueDrill = k; }, renderSummaryLeagueTable);

  const setView = (lastTen, grouped)=>{
    // The two tables do not have the same columns, so a sort key picked on one
    // must not survive onto the other -- it would leave the arriving table
    // sorted by a column it does not contain, which is to say not sorted.
    if(lastTen !== isLastTen) { leagueSortKey = 'points'; leagueSortDesc = true; }
    const enteringByTier = !lastTen && grouped === true && (isLastTen || !leagueGrouped);
    leagueLastTen = lastTen;
    if(grouped !== undefined) leagueGrouped = grouped;
    // Arriving at By tier shows the tables. Whatever was collapsed on a
    // previous visit is not a preference worth restoring someone into.
    if(enteringByTier) resetLeagueTierSections();
    leagueDrill = null;
    renderSummaryLeagueTable();
  };
  document.getElementById('leagueGroupedBtn').onclick = ()=> setView(false, true);
  document.getElementById('leagueAllBtn').onclick = ()=> setView(false, false);
  // Last 10 leaves the By tier / All together choice alone, so returning from
  // it lands on whichever the reader was on.
  document.getElementById('leagueLastTenBtn').onclick = ()=> setView(true);

  const explainerBtn = document.getElementById('leagueExplainerToggle');
  if(explainerBtn) explainerBtn.onclick = ()=>{ leagueExplainerOpen = !leagueExplainerOpen; renderSummaryLeagueTable(); };
  // One tier's chevron touches that tier and nothing else.
  content.querySelectorAll('.lg-tier-head').forEach(btn=>{
    btn.onclick = ()=>{
      const t = btn.dataset.tier;
      const rowsHere = splitRows.filter(x => x.tier === t && x.games > 0).length;
      leagueTierOpen[t] = !tierSectionOpen(leagueTierOpen, t, rowsHere);
      renderSummaryLeagueTable();
    };
  });

  content.querySelectorAll('.league-sort-th').forEach(th=>{
    th.onclick = ()=>{
      const key = th.dataset.key;
      if(leagueSortKey === key) leagueSortDesc = !leagueSortDesc;
      else { leagueSortKey = key; leagueSortDesc = true; }
      renderSummaryLeagueTable();
    };
  });
}

let meritTierOpen = {};

function resetMeritTierSections(){
  meritTierOpen = {};
}

let meritExplainerOpen = false;

// One drill-down open at a time: two expanded lists on a phone is a wall.
let meritDrill = null;

// Every win falls in exactly one of three: Hard (over a stronger pairing),
// Even (an equal one -- the baseline), Fav (over a weaker one). Shaun, 30 Oct:
// Even shown too, so the three add up to W.
//
// Column labels are deliberately terse. A tenth column on a 375px screen is
// the difference between a table and a horizontal scroll, and the drill-down
// underneath says in full what the header cannot.
function meritDrillKey(row, kind){ return tableDrillKey(row.playerId, row.tier, kind); }

function meritCountCell(row, kind){
  const n = kind === 'hard' ? row.hardWins : kind === 'even' ? row.evenWins : row.easyWins;
  return tableCountCell(meritDrill, row.playerId, row.tier, kind, n,
    { zero: `<span style="color:var(--text-dim);">–</span>`, colour: kind === 'hard' ? 'var(--green)' : 'var(--text-dim)' });
}

// One qualifying match, said plainly enough that a reader can check the
// classification themselves: who played, at what tiers, how far apart those
// pairings were, and what the win was therefore worth.
function meritDrillRowHtml(d, subject){
  const side = (names, tiers) => names.map((n,i)=>
    `${escapeHtml(n)}<span class="merit-drill-tier">${escapeHtml(tiers[i] || '?')}</span>`).join(' & ');
  const score = (d.sets && d.sets.length)
    ? d.sets.map(([a,b])=>`${a}-${b}`).join(' ')
    : '';
  const gap = d.steps === 0 ? 'even' : `${d.steps} tier-step${d.steps===1?'':'s'}`;
  return `<div class="merit-drill-row">
    <div class="merit-drill-top">
      <span class="merit-drill-date">${escapeHtml(d.date)}</span>
      <span class="merit-drill-pts">${d.points} pt${d.points===1?'':'s'}</span>
    </div>
    <div class="merit-drill-teams"><b>${side(d.winners, d.winnerTiers)}</b> beat ${side(d.losers, d.loserTiers)}</div>
    <div class="merit-drill-meta">${score ? escapeHtml(score) + ' · ' : ''}${d.kind === 'even' ? 'evenly matched' : gap + ' apart'}${d.kind === 'hard' ? ' · stronger pairing' : d.kind === 'favoured' ? ' · weaker pairing' : ''}</div>
  </div>`;
}

// The layout is fixed (rankings.css), which shares the width out evenly unless
// told otherwise. With ten columns that left a name about 33px on a phone, so
// names broke mid-word; the counts are given just what they need and the name
// takes the rest.
function meritColgroupHtml(showTierColumn, withRace){
  const w = withRace
    ? ['6%', null, ...(showTierColumn ? ['8%'] : []), '7%', '7%', '6%', '7%', '7%', '9%', '9%', '8%', '10%']
    : ['6%', null, ...(showTierColumn ? ['8%'] : []), '8%', '8%', '7%', '8%', '9%', '10%', '10%', '9%'];
  return `<colgroup>${w.map(x => x ? `<col style="width:${x};">` : '<col>').join('')}</colgroup>`;
}

// The month's Monthly Race score beside each Merit row, so a glance gives
// both stories (Shaun, 30 Oct). The Race's own figures, from buildMonthlyRace,
// never recomputed. By tier, a row is one tier's race; All together, a player
// who changed tier mid-month gets the sum of their races. No month, no race.
function meritRaceIndex(month, byTier){
  if(month === 'all') return null;
  const index = {};
  buildMonthlyRace(month).table.forEach(r => {
    const key = byTier ? `${r.playerId}\u0000${r.tier}` : r.playerId;
    const e = index[key] || (index[key] = { score: 0, matches: [], tiers: [] });
    e.score += r.score;
    e.tiers.push(r.tier);
    r.matches.forEach(d => e.matches.push({ ...d, raceTier: r.tier }));
  });
  return index;
}

// Whole points here; the Race table keeps the decimal.
function raceWholePoints(v){
  const n = Math.round(v);
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

function meritRaceCellHtml(row, entry){
  if(!entry) return `<span style="color:var(--text-dim);">–</span>`;
  const key = meritDrillKey(row, 'race');
  const open = meritDrill === key;
  return `<button type="button" class="merit-count race-score${open ? ' is-open' : ''}${Math.round(entry.score) < 0 ? ' is-neg' : ''}"
    data-player="${escapeHtml(row.playerId)}" data-tier="${escapeHtml(row.tier || '')}" data-kind="race"
    aria-expanded="${open}" aria-label="${escapeHtml(`${row.playerId}: Monthly Race ${raceWholePoints(entry.score)} — show the matches`)}">${raceWholePoints(entry.score)}</button>`;
}

// Every column sorts (Shaun, 31 Oct), as the League's do: a tap sorts by it,
// highest first (names A-Z), and a second tap turns it round. The # follows
// the order shown. Ties keep the table's own order, so the default -- Pts,
// highest first -- is exactly the Merit standings. The arrow sits in the
// header's bottom padding: ten columns on a phone have no width to spare.
let meritSortKey = 'merit';
let meritSortDesc = true;

function meritSortTh(key, label, style, title){
  const on = meritSortKey === key;
  return `<th class="merit-sort-th${on ? ' is-sorted' : ''}" data-key="${key}" style="${style}"${title ? ` title="${escapeHtml(title)}"` : ''}
    aria-sort="${on ? (meritSortDesc ? 'descending' : 'ascending') : 'none'}" tabindex="0" role="button"
    ${on ? `data-arrow="${meritSortDesc ? '▾' : '▴'}"` : ''}>${label}</th>`;
}

function meritRaceEntry(race, r){
  return race ? race[r.tier ? `${r.playerId}\u0000${r.tier}` : r.playerId] : null;
}

function sortMeritRows(rows, race){
  const key = (meritSortKey === 'race' && !race) ? 'merit' : meritSortKey;
  const dir = meritSortDesc ? -1 : 1;
  const value = (r) => key === 'race' ? (meritRaceEntry(race, r) ? meritRaceEntry(race, r).score : null) : r[key];
  return rows.map((r, i) => ({ r, i })).sort((a, b) => {
    if(key === 'name'){
      const c = a.r.playerId.localeCompare(b.r.playerId);
      return (meritSortDesc ? c : -c) || a.i - b.i;
    }
    const va = value(a.r), vb = value(b.r);
    // A player with no race this month sits at the bottom either way.
    if(va === null || vb === null) return (va === null) - (vb === null) || a.i - b.i;
    return dir * (va - vb) || a.i - b.i;
  }).map(x => x.r);
}

function buildMeritTableHtml(rows, showTierColumn, race){
  rows = sortMeritRows(rows, race);
  let html = `<div class="callout-card" style="padding:0;">
    <table class="merit-table" style="width:100%; border-collapse:collapse; font-size:11px;">
      ${meritColgroupHtml(showTierColumn, !!race)}
      <thead><tr style="background:var(--bg2); text-align:left;">
      <th style="padding:7px 2px 7px 7px;">#</th>
      ${meritSortTh('name', 'Player', 'padding:7px 2px;')}
      ${showTierColumn ? `<th style="padding:7px 2px; text-align:center;">Tier</th>` : ''}
      ${meritSortTh('played', 'P', 'padding:7px 2px; text-align:center;')}
      ${meritSortTh('wins', 'W', 'padding:7px 2px; text-align:center;')}
      ${meritSortTh('draws', 'D', 'padding:7px 2px; text-align:center;')}
      ${meritSortTh('losses', 'L', 'padding:7px 2px; text-align:center;')}
      ${meritSortTh('merit', 'Pts', 'padding:7px 3px; text-align:right; color:var(--gold-bright);')}
      ${meritSortTh('hardWins', 'Hard', 'padding:7px 2px; text-align:center;', 'Wins against a stronger pairing')}
      ${meritSortTh('evenWins', 'Even', 'padding:7px 2px; text-align:center;', 'Wins against an evenly matched pairing')}
      ${meritSortTh('easyWins', 'Fav', `padding:7px ${race ? '2px' : '7px'} 7px 2px; text-align:center;`, 'Wins against a weaker pairing')}
      ${race ? meritSortTh('race', 'Race', 'padding:7px 7px 7px 2px; text-align:right; color:var(--gold-bright);', "This month's Monthly Race score") : ''}
      </tr></thead><tbody>`;
  const cols = (showTierColumn ? 11 : 10) + (race ? 1 : 0);
  rows.forEach((r,i)=>{
    html += `<tr style="border-top:1px solid var(--line);">
      <td style="padding:7px 2px 7px 7px; color:var(--text-dim);">${i+1}</td>
      <td style="padding:7px 2px;"><span class="request-player-link" data-player="${escapeHtml(r.playerId)}" style="text-decoration:underline; cursor:pointer; font-weight:700;">${escapeHtml(r.playerId)}</span></td>
      ${showTierColumn ? `<td style="padding:7px 2px; text-align:center;"><span class="badge ${r.tier}" style="display:inline-flex; width:20px; height:20px; font-size:10px;">${r.tier}</span></td>` : ''}
      <td style="padding:7px 2px; text-align:center;">${tableCountCell(meritDrill, r.playerId, r.tier, 'played', r.played, { plain: true })}</td>
      <td style="padding:7px 2px; text-align:center; color:var(--green);">${tableCountCell(meritDrill, r.playerId, r.tier, 'wins', r.wins, { plain: true, colour: 'var(--green)' })}</td>
      <td style="padding:7px 2px; text-align:center; color:var(--text-dim);">${tableCountCell(meritDrill, r.playerId, r.tier, 'draws', r.draws, { plain: true, colour: 'var(--text-dim)' })}</td>
      <td style="padding:7px 2px; text-align:center; color:var(--red);">${tableCountCell(meritDrill, r.playerId, r.tier, 'losses', r.losses, { plain: true, colour: 'var(--red)' })}</td>
      <td style="padding:7px 3px; text-align:right; font-weight:700; color:var(--gold-bright);">${r.merit}</td>
      <td style="padding:7px 2px; text-align:center;">${meritCountCell(r, 'hard')}</td>
      <td style="padding:7px 2px; text-align:center;">${meritCountCell(r, 'even')}</td>
      <td style="padding:7px ${race ? '2px' : '7px'} 7px 2px; text-align:center;">${meritCountCell(r, 'favoured')}</td>
      ${race ? `<td style="padding:7px 7px 7px 2px; text-align:right;">${meritRaceCellHtml(r, meritRaceEntry(race, r))}</td>` : ''}
    </tr>`;
    // Hard, Even and Fav keep their own wording and lines; P/W/D/L use the
    // plain game line. All of them are the same detail row.
    ['hard','even','favoured'].forEach(kind=>{
      if(meritDrill !== meritDrillKey(r, kind)) return;
      const list = r[kind];
      html += tableDrillRowHtml(cols,
        `${escapeHtml(r.playerId)} · ${list.length} win${list.length===1?'':'s'} against ${kind === 'even' ? 'an evenly matched' : kind === 'hard' ? 'a stronger' : 'a weaker'} pairing`,
        list, (d)=> meritDrillRowHtml(d, r.playerId),
        // Hard / Fav keep the order they have always listed in.
        (a,b)=> a.date < b.date ? 1 : -1);
    });
    const raceEntry = meritRaceEntry(race, r);
    if(raceEntry && meritDrill === meritDrillKey(r, 'race')){
      const tiers = raceEntry.tiers.map(t => `Tier ${escapeHtml(t)}`).join(' + ');
      html += tableDrillRowHtml(cols,
        `${escapeHtml(r.playerId)} · ${tiers} race · ${raceEntry.matches.length} match${raceEntry.matches.length===1?'':'es'} · ${raceWholePoints(raceEntry.score)}`,
        raceEntry.matches, (d)=> raceDrillRowHtml(d, d.raceTier));
    }
    html += tableCountDrillHtml(meritDrill, cols, r.playerId, r.tier, r.games);
  });
  html += `</tbody></table></div>`;
  return html;
}

function renderMeritTable(){
  const content = document.getElementById('summaryContent');
  const label = summaryMonth === 'all' ? 'All Time' : monthLabel(summaryMonth);
  const matches = meritMatches(summaryMonth);

  let html = `<div class="section-heading" style="margin-top:6px;">🥇 ${label} Merit Table</div>`;
  html += `<div class="section-sub" style="margin:2px 0 0;">Harder wins earn more.</div>`;
  html += leagueInlineFold('meritExplainerToggle', 'How points work', meritExplainerOpen,
    `<div class="section-sub" style="margin:0;">An even matchup is worth 3 points for a win. Beat a stronger pairing and you earn an extra point for each tier-step difference. Beat a weaker pairing and you earn one point less per tier-step. Merit Points cannot fall below 0 for a win. Draws and losses earn 0.${summaryMonth === 'all' ? '' : ' Race is the same player\'s Monthly Race score this month, to the nearest point; tap it for the matches behind it.'}</div>`);

  html += `<div class="fg-toggle" style="margin:8px 0 14px;">
    <button class="fg-toggle-btn ${leagueGrouped?'active':''}" id="meritGroupedBtn">By tier</button>
    <button class="fg-toggle-btn ${!leagueGrouped?'active':''}" id="meritAllBtn">All together</button>
  </div>`;

  // Same temporal rule as the League Table: a match is filed under the tier the
  // player held on its own date, so a mid-month mover appears in both sections
  // holding only what they earned in each.
  const tierAt = (n, d) => historicalTierOf(n, d);

  // Kept so the tier-heading handlers below can ask how many rows a section
  // holds without building the whole table again to count them.
  let meritRowsByTier = null;
  const race = meritRaceIndex(summaryMonth, leagueGrouped);
  // All time has no Race column, so a Race sort goes back to Pts.
  if(!race && meritSortKey === 'race'){ meritSortKey = 'merit'; meritSortDesc = true; }

  if(leagueGrouped){
    const { table, unresolved } = PerfTrace.time('MeritTable.build',
      ()=> MeritTable.build(matches, tierAt, { tierForRow: tierAt }));
    meritRowsByTier = {};
    table.forEach(r => { if(r.played > 0) meritRowsByTier[r.tier] = (meritRowsByTier[r.tier] || 0) + 1; });
    let anyShown = false;
    groupedTiers().forEach(tier=>{
      const rows = table.filter(r => r.tier === tier && r.played > 0);
      if(rows.length === 0) return;
      anyShown = true;
      const open = tierSectionOpen(meritTierOpen, tier, rows.length);
      html += leagueTierHeading(tier, open).replace('leagueTier', 'meritTier');
      if(open) html += `<div id="meritTierBody${tier}">${buildMeritTableHtml(rows, false, race)}</div>`;
    });
    if(!anyShown) html += `<div class="section-sub">No games recorded for ${label}.</div>`;
    if(unresolved.length) html += `<div class="section-sub">${unresolved.length} match${unresolved.length===1?'':'es'} could not be scored: a player's tier on that date is unknown.</div>`;
  } else {
    const { table, unresolved } = PerfTrace.time('MeritTable.build', ()=> MeritTable.build(matches, tierAt));
    const rows = table.filter(r => r.played > 0);
    if(rows.length === 0) html += `<div class="section-sub">No games recorded for ${label}.</div>`;
    else html += buildMeritTableHtml(rows, false, race);
    if(unresolved.length) html += `<div class="section-sub">${unresolved.length} match${unresolved.length===1?'':'es'} could not be scored: a player's tier on that date is unknown.</div>`;
  }

  content.innerHTML = html;
  wireRequestPlayerLinks(content);
  wireRaceStakes(content);

  document.getElementById('meritGroupedBtn').onclick = ()=>{ leagueGrouped = true; meritDrill = null; resetMeritTierSections(); renderMeritTable(); };
  document.getElementById('meritAllBtn').onclick = ()=>{ leagueGrouped = false; meritDrill = null; renderMeritTable(); };
  const ex = document.getElementById('meritExplainerToggle');
  if(ex) ex.onclick = ()=>{ meritExplainerOpen = !meritExplainerOpen; renderMeritTable(); };
  content.querySelectorAll('.lg-tier-head').forEach(btn=>{
    btn.onclick = ()=>{
      const t = btn.dataset.tier;
      const rowsHere = (meritRowsByTier && meritRowsByTier[t]) || 0;
      meritTierOpen[t] = !tierSectionOpen(meritTierOpen, t, rowsHere);
      renderMeritTable();
    };
  });
  // Tapping any count -- P, W, D, L, Hard, Even, Fav or Race -- opens the matches behind
  // it; tapping the same one again closes it.
  wireTableCounts(content, ()=> meritDrill, (k)=>{ meritDrill = k; }, renderMeritTable);
  content.querySelectorAll('.merit-sort-th').forEach(th=>{
    const sortBy = ()=>{
      const key = th.dataset.key;
      if(meritSortKey === key) meritSortDesc = !meritSortDesc;
      // Highest first for a number; A-Z for a name.
      else { meritSortKey = key; meritSortDesc = true; }
      renderMeritTable();
    };
    th.onclick = sortBy;
    th.onkeydown = (e)=>{ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); sortBy(); } };
  });
}

let raceTierOpen = {};

let raceExplainerOpen = false;

// What is open in the Race, one at a time: a score (`${player}\u0000${tier}`)
// or a P / W / D / L count (tableDrillKey).
let raceDrill = null;

function racePoints(v){
  if(v > 0) return '+' + v.toFixed(1);
  if(v < 0) return '−' + Math.abs(v).toFixed(1);
  return '0.0';
}

// The score as the player saw it: their side's games first.
function raceScoreFor(d){
  if(!d.sets || !d.sets.length) return '';
  const flip = d.result === 'L';
  return d.sets.map(([a,b]) => flip ? `${b}-${a}` : `${a}-${b}`).join(' ');
}

function raceDrillRowHtml(d, tier){
  const who = (list) => list.map(p =>
    `${escapeHtml(p.playerId)}<span class="merit-drill-tier">${escapeHtml(p.tier || '?')}</span>`).join(' & ');
  const verb = d.result === 'W' ? 'Won' : d.result === 'D' ? 'Drew' : 'Lost';
  const score = raceScoreFor(d);
  const partner = d.partner.length ? ` with ${who(d.partner)}` : '';
  return `<div class="merit-drill-row race-drill-row">
    <div class="merit-drill-top">
      <span class="merit-drill-date">${escapeHtml(d.date)}</span>
      <span class="merit-drill-pts race-pts ${d.points < 0 ? 'is-neg' : ''}">${racePoints(d.points)}</span>
    </div>
    <div class="merit-drill-teams"><b>${verb}</b>${partner} v ${who(d.opponents)}${score ? ` <span class="race-drill-score">${escapeHtml(score)}</span>` : ''}</div>
    <button type="button" class="race-stakes-toggle" aria-expanded="false">Details <span class="race-stakes-chev" aria-hidden="true">›</span></button>
    <div class="merit-drill-meta race-drill-meta">Stakes: win ${racePoints(d.stakes.win)} · draw ${racePoints(d.stakes.draw)} · lose ${racePoints(d.stakes.loss)}<br>An ordinary Tier ${escapeHtml(tier)} player wins this ${Math.round(d.parWin*100)}% of the time</div>
  </div>`;
}

// The stakes and the par win chance are the working behind a match's points:
// hidden until asked for (Shaun, 31 Oct), one match at a time, so a list of
// nine wins reads as nine results.
function wireRaceStakes(content){
  content.querySelectorAll('.race-stakes-toggle').forEach(btn=>{
    btn.onclick = ()=>{
      const row = btn.closest('.race-drill-row');
      const open = !row.classList.contains('show-stakes');
      row.classList.toggle('show-stakes', open);
      btn.setAttribute('aria-expanded', String(open));
    };
  });
}

function buildRaceTableHtml(rows, ranked){
  let html = `<div class="callout-card" style="padding:0;">
    <table class="merit-table race-table" style="width:100%; border-collapse:collapse; font-size:11px;">
      <thead><tr style="background:var(--bg2); text-align:left;">
      <th style="padding:7px 2px 7px 7px;">#</th>
      <th style="padding:7px 2px;">Player</th>
      <th style="padding:7px 2px; text-align:center;">P</th>
      <th style="padding:7px 2px; text-align:center;">W</th>
      <th style="padding:7px 2px; text-align:center;">D</th>
      <th style="padding:7px 2px; text-align:center;">L</th>
      <th style="padding:7px 7px 7px 3px; text-align:right; color:var(--gold-bright);">Race</th>
      </tr></thead><tbody>`;
  rows.forEach((r,i)=>{
    const key = `${r.playerId}\u0000${r.tier}`;
    const open = raceDrill === key;
    html += `<tr style="border-top:1px solid var(--line);">
      <td style="padding:7px 2px 7px 7px; color:var(--text-dim);">${ranked ? i+1 : '–'}</td>
      <td style="padding:7px 2px;"><span class="request-player-link" data-player="${escapeHtml(r.playerId)}" style="text-decoration:underline; cursor:pointer; font-weight:700;">${escapeHtml(r.playerId)}</span></td>
      <td style="padding:7px 2px; text-align:center;">${tableCountCell(raceDrill, r.playerId, r.tier, 'played', r.played, { plain: true })}</td>
      <td style="padding:7px 2px; text-align:center; color:var(--green);">${tableCountCell(raceDrill, r.playerId, r.tier, 'wins', r.wins, { plain: true, colour: 'var(--green)' })}</td>
      <td style="padding:7px 2px; text-align:center; color:var(--text-dim);">${tableCountCell(raceDrill, r.playerId, r.tier, 'draws', r.draws, { plain: true, colour: 'var(--text-dim)' })}</td>
      <td style="padding:7px 2px; text-align:center; color:var(--red);">${tableCountCell(raceDrill, r.playerId, r.tier, 'losses', r.losses, { plain: true, colour: 'var(--red)' })}</td>
      <td style="padding:7px 7px 7px 3px; text-align:right;"><button type="button" class="merit-count race-score${open ? ' is-open' : ''}${r.score < 0 ? ' is-neg' : ''}"
        data-player="${escapeHtml(r.playerId)}" data-tier="${escapeHtml(r.tier)}" aria-expanded="${open}">${racePoints(r.score)}</button></td>
    </tr>`;
    if(open){
      html += `<tr class="merit-drill"><td colspan="7" style="padding:0;">
        <div class="merit-drill-body">
          <div class="merit-drill-head">${escapeHtml(r.playerId)} · Tier ${escapeHtml(r.tier)} race · ${r.played} match${r.played===1?'':'es'}</div>
          ${r.matches.map(d => raceDrillRowHtml(d, r.tier)).join('')}
          <div class="race-drill-total">Total ${racePoints(r.score)}</div>
        </div>
      </td></tr>`;
    }
    // P / W / D / L open the matches behind the count, as in League and Merit,
    // each told the Race's way -- with its stakes and the points it earned.
    const kind = Object.keys(TABLE_COUNT_KINDS).find(k => raceDrill === tableDrillKey(r.playerId, r.tier, k));
    if(kind){
      const games = TABLE_COUNT_KINDS[kind].of(r.matches);
      html += tableDrillRowHtml(7,
        `${escapeHtml(r.playerId)} · ${TABLE_COUNT_KINDS[kind].label} · ${escapeHtml(tableDrillContext(r.tier))} · ${games.length} match${games.length === 1 ? '' : 'es'}`,
        games, (d) => raceDrillRowHtml(d, r.tier));
    }
  });
  html += `</tbody></table></div>`;
  return html;
}

function renderMonthlyRace(){
  const content = document.getElementById('summaryContent');
  let html = '';
  if(summaryMonth === 'all'){
    html += `<div class="section-heading" style="margin-top:6px;">🏁 Monthly Race</div>`;
    html += `<div class="section-sub">The race starts again every month. Choose a month to see it.</div>`;
    content.innerHTML = html;
    return;
  }
  const label = monthLabel(summaryMonth);
  const { table, unresolved } = PerfTrace.time('MonthlyRace.build', ()=> buildMonthlyRace(summaryMonth));

  html += `<div class="section-heading" style="margin-top:6px;">🏁 ${label} Monthly Race</div>`;
  html += `<div class="section-sub" style="margin:2px 0 0;">Best Month: harder wins earn more, harder losses cost less.</div>`;
  html += leagueInlineFold('raceExplainerToggle', 'How the race works', raceExplainerOpen,
    `<div class="section-sub" style="margin:0;">Everyone in a tier starts the month on 0. Every match has stakes, set by how hard it was for an ordinary player of your tier with your actual partner against your actual opponents, judged by their Power Ratings going in. Harder wins earn more and harder losses cost less; an even match is +10 for a win and −10 for a loss. The highest score among players with at least ${MonthlyRace.MIN_MATCHES} matches in the tier had the best month. If you change tier during the month, each tier is its own race and starts from 0. Tap a score to see every match behind it, or P, W, D or L to see those matches.</div>`);

  let anyShown = false;
  const rowsByTier = {};
  groupedTiers().forEach(tier=>{
    const rows = table.filter(r => r.tier === tier);
    if(rows.length === 0) return;
    anyShown = true;
    rowsByTier[tier] = rows.length;
    const open = tierSectionOpen(raceTierOpen, tier, rows.length);
    html += leagueTierHeading(tier, open).replace('leagueTier', 'raceTier');
    if(!open) return;
    const qualified = rows.filter(r => r.qualified);
    const provisional = rows.filter(r => !r.qualified);
    html += `<div id="raceTierBody${tier}">`;
    if(qualified.length) html += buildRaceTableHtml(qualified, true);
    else html += `<div class="race-noq">No qualifier this month</div>`;
    if(provisional.length){
      html += `<div class="race-prov-head">Provisional · fewer than ${MonthlyRace.MIN_MATCHES} matches</div>`;
      html += buildRaceTableHtml(provisional, false);
    }
    html += `</div>`;
  });
  if(!anyShown) html += `<div class="section-sub">No games recorded for ${label}.</div>`;
  if(unresolved.length) html += `<div class="section-sub">${unresolved.length} match${unresolved.length===1?'':'es'} could not be scored: a player's tier or pre-match rating on that date is unknown.</div>`;

  content.innerHTML = html;
  wireRaceStakes(content);
  wireRequestPlayerLinks(content);
  const ex = document.getElementById('raceExplainerToggle');
  if(ex) ex.onclick = ()=>{ raceExplainerOpen = !raceExplainerOpen; renderMonthlyRace(); };
  content.querySelectorAll('.lg-tier-head').forEach(btn=>{
    btn.onclick = ()=>{
      const t = btn.dataset.tier;
      raceTierOpen[t] = !tierSectionOpen(raceTierOpen, t, rowsByTier[t] || 0);
      renderMonthlyRace();
    };
  });
  // P / W / D / L counts; the Race score keeps its own drill (below).
  wireTableCounts(content, ()=> raceDrill, (k)=>{ raceDrill = k; }, renderMonthlyRace);
  content.querySelectorAll('.race-score').forEach(btn=>{
    btn.onclick = ()=>{
      const key = `${btn.dataset.player}\u0000${btn.dataset.tier}`;
      raceDrill = (raceDrill === key) ? null : key;
      renderMonthlyRace();
    };
  });
}

function renderSummaryInformation(){
  const box = document.getElementById('summaryContent');
  let html = '';

  // The review itself is monthlyInformation() (monthlyStoryData.js): the
  // Admin Board Pack reads the same derivation.
  const info = monthlyInformation(summaryMonth);
  const { stats, statsArr, minGamesForRanked, mostGames, mostWins, mostLosses, lowestWinPct,
    highestWinPct, mostDoughnuts, doughnutMax, hardestGames, playerOfMonth } = info;
  const label = summaryMonth === 'all' ? 'All Time' : monthLabel(summaryMonth);

  if(statsArr.length === 0){
    html += `<div class="section-sub">No games recorded for ${label}.</div>`;
    box.innerHTML = html;
    return;
  }

  html += `<div class="section-heading" style="margin-top:6px;">📊 ${label} Stats Review</div>`;

  function nameLinks(names){
    return names.map(n=>`<span class="request-player-link" data-player="${n}" style="text-decoration:underline; cursor:pointer;">${n}</span>`).join(' / ');
  }
  function renderGroupList(title, groups, formatFn){
    let h = `<div class="section-heading">${title}</div>`;
    if(groups.length === 0){ h += `<div class="section-sub">Not enough data.</div>`; return h; }
    groups.forEach(g=>{
      h += `<div class="matchup-vs" style="margin-bottom:6px; padding:8px 12px;">${g.rank}. ${nameLinks(g.names)} — ${formatFn(g)}</div>`;
    });
    return h;
  }

  html += renderGroupList('🎾 Most games played', mostGames, g=>`${g.value} game${g.value===1?'':'s'}`);
  html += renderGroupList('🏆 Most wins &amp; highest points', mostWins, g=>{
    const s = stats[g.names[0]];
    return `${s.wins} win${s.wins===1?'':'s'}${s.draws?` · ${s.draws} draw${s.draws===1?'':'s'}`:''} — ${g.value} pts`;
  });
  html += renderGroupList('😬 Most losses', mostLosses, g=>`${g.value} loss${g.value===1?'':'es'}`);
  html += renderGroupList('📉 Lowest win % (highest loss %)', lowestWinPct, g=>`${stats[g.names[0]].losspct}% loser`);
  html += renderGroupList('📈 Highest win %', highestWinPct, g=>`${g.value}% wins`);

  html += `<div class="section-heading">🍩 Most doughnuts received</div>`;
  if(mostDoughnuts.length === 0){
    html += `<div class="section-sub">Nobody got doughnut'd this ${summaryMonth==='all'?'season':'month'}.</div>`;
  } else {
    html += `<div class="matchup-vs" style="padding:8px 12px;">${nameLinks(mostDoughnuts)} — x${doughnutMax}</div>`;
  }

  html += renderGroupList('💪 Hardest games played (avg opponent strength)', hardestGames, g=>`${g.value}`);

  // Chosen by the group from Admin's shortlist (features/awards), never
  // worked out from this review's figures.
  html += potmPublicHtml(summaryMonth);

  html += `<div class="section-sub" style="padding:8px 2px;">Assumptions: points are 3/win, 1/draw. "Hardest games" is avg opponent strength ÷ 300. Win%/loss% include draws in the denominator. Rankings for win%/loss%/hardest require at least ${minGamesForRanked} games played.</div>`;

  html += `<div class="fg-row" style="margin-top:12px;"><button class="tab-btn active" id="copySummaryBtn" style="width:100%;">📋 Copy as WhatsApp text</button></div>
  <div id="copySummaryMessage" class="section-sub"></div>`;

  box.innerHTML = html;
  wireRequestPlayerLinks(box);
  wirePotmShare(box, renderSummaryInformation);

  document.getElementById('copySummaryBtn').onclick = ()=>{
    const text = buildWhatsAppSummaryText(summaryMonth, stats, {mostGames, mostWins, mostLosses, lowestWinPct, highestWinPct, mostDoughnuts, doughnutMax, hardestGames, playerOfMonth});
    const msg = document.getElementById('copySummaryMessage');
    const showFallback = ()=>{
      let ta = document.getElementById('summaryFallbackText');
      if(!ta){
        ta = document.createElement('textarea');
        ta.id = 'summaryFallbackText';
        ta.className = 'fg-select';
        ta.style.width = '100%';
        ta.style.marginTop = '8px';
        ta.rows = 16;
        msg.after(ta);
      }
      ta.value = text;
      msg.textContent = 'Could not copy automatically — tap the text box below, select all, and copy manually.';
    };
    try {
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(()=>{ msg.textContent = 'Copied! Paste it into WhatsApp.'; }).catch(showFallback);
      } else {
        showFallback();
      }
    } catch(e){
      showFallback();
    }
  };
}

function populateSummaryMonthSelect(){
  const sel = document.getElementById('summaryMonthSelect');
  if(!sel) return;
  const months = getAvailableMonths();
  sel.innerHTML = `<option value="all">All time</option>` + months.map(m=>`<option value="${m}" ${m===summaryMonth?'selected':''}>${monthLabel(m)}</option>`).join('');
  sel.value = summaryMonth;
  // A different month is a different set of games: close any open count.
  sel.onchange = (e)=>{ summaryMonthChoice = e.target.value; summaryMonth = e.target.value; leagueDrill = null; meritDrill = null; renderSummary(); };
}

function buildWhatsAppSummaryText(month, stats, groups){
  const label = month === 'all' ? 'All Time' : monthLabel(month);
  const lines = [];
  lines.push(`Please see the ${label} stats review`);
  lines.push('');
  lines.push('*Most games played:*');
  groups.mostGames.forEach(g=> lines.push(`${g.rank}. ${g.names.join(' / ')} ${g.value} games`));
  lines.push('');
  lines.push('*Most wins & highest points*');
  groups.mostWins.forEach(g=>{
    const s = stats[g.names[0]];
    const drawPart = s.draws ? ` ${s.draws} draw${s.draws===1?'':'s'}` : '';
    lines.push(`${g.rank} ${g.names.join(' / ')} ${s.wins} win${s.wins===1?'':'s'}${drawPart} - ${g.value} points`);
  });
  lines.push('');
  lines.push('Most losses');
  groups.mostLosses.forEach(g=> lines.push(`${g.rank}. ${g.names.join(' / ')} ${g.value} losses`));
  lines.push('');
  lines.push('Lowest win %');
  groups.lowestWinPct.forEach(g=>{
    const s = stats[g.names[0]];
    lines.push(`${g.rank}. ${s.losspct}% loser ${g.names.join(' / ')}`);
  });
  lines.push('');
  lines.push('Highest win %');
  groups.highestWinPct.forEach(g=> lines.push(`${g.rank}. ${g.names.join(' / ')} ${g.value}% wins`));
  lines.push('');
  lines.push('Most doughnuts received');
  if(groups.mostDoughnuts.length){
    lines.push(`${groups.mostDoughnuts.join(' / ')}  x${groups.doughnutMax}`);
  } else {
    lines.push('None this time!');
  }
  lines.push('');
  lines.push('Hardest games played');
  groups.hardestGames.forEach(g=> lines.push(`${g.rank}. ${g.names.join(' / ')} ${g.value}`));
  lines.push('');
  lines.push('Player of the month….');
  lines.push(groups.playerOfMonth.state === 'confirmed' ? `${groups.playerOfMonth.text} 🏆🏆🏆` : groups.playerOfMonth.text);
  return lines.join('\n');
}
