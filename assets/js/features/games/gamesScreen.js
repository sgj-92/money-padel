// ===================== GAMES: SCREEN =====================
// Play › Games: the filters, the one-player record line, Add a game, the
// pending list and the history feed. Presentation and screen wiring only --
// the filtered set and the record come from the view-model
// (gamesViewModel.js -> domain/matches/gamesFilter.js), and the admin write
// paths (approve, edit, correct, remove) live in gamesAdmin.js.
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: redesign. Its state (gamesMonth, gamesPlayerIds, ...) is
// declared in app.js with the other per-screen months; this file only
// declares functions and loads before app.js.

// What the filters are set to, in the words the controls themselves use. It
// reads the same module state the selects are built from, so it cannot say one
// thing while the list shows another.
// The one way the Games player filter is set, from wherever: the filter panel,
// a "see their games" link, or a reset. Takes what is on screen (labels) and
// stores what the record uses (ids).
function setGamesPlayerFilter(names){
  gamesPlayerIds = PlayerFilter.normalise((names || []).map(n => playerIdFor(n)));
  gamesPlayersNote = '';
}

// Exactly one player selected means the list is THEIR list: the heading says
// so, the cards are tinted by their result and the scores are read from their
// side. Two or more is a group, which has no single point of view, so the list
// goes back to being neutral.
function gamesFocusName(){
  return gamesPlayerIds.length === 1 ? displayNameFor(gamesPlayerIds[0]) : null;
}

// What the filter is set to, as labels, for the selector and the summary.
function gamesPlayerLabels(){
  return gamesPlayerIds.map(id => displayNameFor(id));
}

// The game type as the select names it. One function, so the collapsed
// heading and the record line can never call the same filter two things.
function gamesTypeLabel(typeOptions){
  if(gamesType === 'all') return 'All game types';
  const found = typeOptions
    ? (typeOptions.categories || []).concat(typeOptions.matchups || []).find(o => o.value === gamesType)
    : null;
  return found ? found.label : gamesType;
}

function gamesMonthText(){
  return gamesMonth === 'all' ? 'All time' : monthLabel(gamesMonth);
}

function gamesFilterSummary(typeOptions){
  const playerPart = PlayerFilter.summary(gamesPlayerLabels()) || 'All players';
  return [gamesMonthText(), playerPart, gamesTypeLabel(typeOptions)].map(escapeHtml).join(' · ');
}

// The selected player's record over `matches`. The rule lives in
// domain/matches/gamesFilter.js (GamesFilter.record); this remains for callers
// that already hold a list, and is exactly what the screen shows.
function gamesFocusRecord(matches){
  if(gamesPlayerIds.length !== 1) return null;
  return GamesFilter.record(matches, gamesPlayerIds[0], playerIdFor, MatchOutcome);
}

// One compact line under the list heading, not another card. It names the
// filters it describes, so a number is never read without its context, and
// with nothing to count it says so rather than printing 0% as if it meant
// something.
function gamesRecordHtml(rec, typeOptions){
  if(!rec) return '';
  const context = [gamesFocusName()]
    .concat(gamesType === 'all' ? [] : [gamesTypeLabel(typeOptions)])
    .concat([gamesMonthText()])
    .map(escapeHtml).join(' · ');
  const attrs = `data-played="${rec.played}" data-wins="${rec.wins}" data-draws="${rec.draws}" data-losses="${rec.losses}"`;
  if(!rec.played){
    return `<div class="gp-record gp-record-empty" id="gamesRecord" ${attrs}>
      <div class="gp-record-context">${context}</div>
      <div class="gp-record-line">No games match these filters</div>
    </div>`;
  }
  const count = (n, one, many) => `<b>${n}</b> ${n === 1 ? one : many}`;
  return `<div class="gp-record" id="gamesRecord" ${attrs} data-winpct="${rec.winpct}">
    <div class="gp-record-context">${context}</div>
    <div class="gp-record-line">${[
      count(rec.played, 'played', 'played'),
      count(rec.wins, 'win', 'wins'),
      count(rec.draws, 'draw', 'draws'),
      count(rec.losses, 'loss', 'losses'),
    ].join(' · ')}</div>
    <div class="gp-record-pct">${rec.winpct}% win rate</div>
  </div>`;
}

// ---- Editing a game in place -------------------------------------------------
// The edit form opens inside the game's own card, straight under the game, and
// every redraw while editing (open, cancel, save, confirm a correction) keeps
// that card where it was on screen. It used to be appended after the whole
// list and scrolled to, so editing a game took the reader to the bottom of the
// tab and left them there.

function gameCardEl(id){
  if(!id) return null;
  return [...document.querySelectorAll('#gamesView [data-game-card]')].find(el => el.dataset.gameCard === id) || null;
}

// Runs `fn` (which redraws) and puts the game's card back at the same height
// in the viewport. If the card is no longer listed -- a filter now hides it --
// the page keeps its scroll offset instead. Works with a promise too.
function withGameAnchor(id, fn){
  const card = gameCardEl(id);
  const before = card ? card.getBoundingClientRect().top : null;
  const y = window.scrollY;
  const settle = () => {
    const now = gameCardEl(id);
    if(now && before !== null) window.scrollBy(0, now.getBoundingClientRect().top - before);
    else window.scrollTo(0, y);
  };
  const out = fn();
  if(out && typeof out.then === 'function') return out.then(v => { settle(); return v; }, e => { settle(); throw e; });
  settle();
  return out;
}

// The form must be usable without scrolling. Only when the card sat so low that
// the form starts in the bottom of the screen is the card brought up -- to the
// top, under the header (scroll-margin-top), so the game stays the anchor.
function bringEditFormIntoReach(id){
  const form = document.getElementById('editFormAnchor');
  const card = gameCardEl(id);
  if(!form || !card) return;
  if(form.getBoundingClientRect().top > window.innerHeight * 0.6) card.scrollIntoView({ block: 'start' });
}

// Where the reader was when they opened the editor: the game's height on
// screen and the page offset. Closing it -- Cancel, Save, or a confirmed
// correction -- puts them back there, however far down the form they
// scrolled to reach its buttons.
let gameEditReturn = null;

function openGameEditor(id){
  const card = gameCardEl(id);
  gameEditReturn = { id, top: card ? card.getBoundingClientRect().top : null, y: window.scrollY };
  withGameAnchor(id, ()=>{ editingMatchId = id; armedDeleteId = null; renderGamesTab(); });
  bringEditFormIntoReach(id);
}

// Closes the editor through `fn` and returns the reader to where they started.
// With no recorded start (the editor was opened from a profile), the game is
// simply kept where it is.
function closeGameEditor(id, fn){
  const back = gameEditReturn && gameEditReturn.id === id ? gameEditReturn : null;
  if(!back) return withGameAnchor(id, fn);
  const was = gameCardEl(id);
  const nowTop = was ? was.getBoundingClientRect().top : null;
  const settle = () => {
    if(editingMatchId === id){
      // Still open -- a refusal, or a correction waiting to be confirmed: the
      // game stays exactly where it is.
      const card = gameCardEl(id);
      if(card && nowTop !== null) window.scrollBy(0, card.getBoundingClientRect().top - nowTop);
      return;
    }
    gameEditReturn = null;
    const card = gameCardEl(id);
    if(card && back.top !== null) window.scrollBy(0, card.getBoundingClientRect().top - back.top);
    else window.scrollTo(0, back.y);
  };
  const out = fn();
  if(out && typeof out.then === 'function') return out.then(v => { settle(); return v; }, e => { settle(); throw e; });
  settle();
  return out;
}

// "Submitted by Tom", "Historical record", "Approved by Shaun"... for a rated game.
function matchAttributionLine(m){
  if(m.submittedBy) return `Submitted by ${m.submittedBy}`;
  return MatchAttribution.describe(m.id, { stored: matchAttributionState, history: MATCH_SUBMITTER_HISTORY, journey: V3_JOURNEY }).text;
}

function gameEditFormHtml(id){
  return `<div class="game-edit-inline" id="editFormAnchor" data-editing="${escapeHtml(id)}">${buildEditFormHtml(id)}</div>`;
}

function renderGamesTab(){
  const box = document.getElementById('gamesView');
  const pending = extraMatchesState.filter(m=>m.status==='pending' && !deletedIdsState.includes(m.id));
  // The filtered set and the one player's record come from the view-model
  // (features/games/gamesViewModel.js -> domain/matches/gamesFilter.js); this
  // screen only draws them. A game type that no longer exists under the
  // current month/player selection has already fallen back to 'all' there,
  // BEFORE filtering -- kept in this screen's state so the select agrees.
  const gamesVm = getFilteredGamesViewModel();
  gamesType = gamesVm.type;
  const gamesTypeOptions = gamesVm.typeOptions;
  const display = gamesVm.games;

  let html = '';

  html += foldHeading('gamesFiltersToggle', 'Filters', gamesFiltersOpen,
    { summary: gamesFilterSummary(gamesTypeOptions) });
  if(gamesFiltersOpen){
    html += `<div id="gamesFiltersToggleBody"><div class="fg-controls">
      <div class="fg-row"><label class="fg-label">Month</label>
        <select id="gamesMonthSelect" class="fg-select"></select>
      </div>
      <div class="fg-row">
        <div class="gp-head">
          <label class="fg-label" style="margin:0;">Players in match</label>
          ${gamesPlayerIds.length ? `<button type="button" class="gp-clear-all" id="gamesPlayersClear">Clear all</button>` : ''}
        </div>
        <div class="section-sub" style="margin:0 0 6px; font-size:10.5px;">Any combination — partnerships and sides are ignored. One name finds their games; four finds that exact group.</div>
        ${[0,1,2,3].map(i=>{
          const value = gamesPlayerLabels()[i] || '';
          return `<div class="gp-slot">
            <input id="gamesPlayer${i}" list="gamesPlayerNamesList" class="fg-select gp-field"
              placeholder="Player ${i+1}" value="${escapeHtml(value)}" />
            ${value ? `<button type="button" class="gp-remove" data-remove-player="${i}"
              aria-label="Remove ${escapeHtml(value)}">×</button>` : ''}
          </div>`;
        }).join('')}
        <datalist id="gamesPlayerNamesList">${allPlayerNames().map(n=>`<option value="${escapeHtml(n)}">`).join('')}</datalist>
        <div id="gamesPlayersMessage" class="section-sub" style="margin:2px 0 0; font-size:10.5px; color:var(--gold-bright);">${escapeHtml(gamesPlayersNote)}</div>
      </div>
      <div class="fg-row"><label class="fg-label">Game type</label>
        <select id="gamesTypeSelect" class="fg-select"></select>
      </div>
    </div></div>`;
  }

  // The standings site lists results and nothing else (siteMode.js): no
  // Add a game, no admin, no pending submissions.
  const standingsOnly = isStandingsMode();
  if(!standingsOnly){
  html += foldHeading('addGameToggle', '➕ Add a game', addGameExpanded,
    { bodyId: 'addGameBody', summary: linkedRequestId ? 'from Upcoming' : 'submit a result' });
  html += `<div id="addGameBody" style="display:${addGameExpanded ? 'block' : 'none'};">`;
  html += identityLineHtml('Adding');
  // The one place the lifecycle is visible to the person in it: this form is
  // finishing a game that already exists in Upcoming, and submitting it will
  // clear that entry rather than leave a second copy behind.
  if(linkedRequestId){
    const linked = gameRequestsState.find(r => r.id === linkedRequestId);
    if(linked){
      const [sideA, sideB] = requestTeams(linked);
      html += `<div class="section-sub" style="color:var(--gold-bright);">Recording the agreed game
        ${escapeHtml(sideA.join(' & '))} v ${escapeHtml(sideB.join(' & '))} — submitting it removes it from Upcoming.</div>`;
    }
  }
  html += `<div class="section-sub">Anyone can submit a result — it lands below as pending until an admin approves it. Paste or type the result however it was written and it fills in the form for you to check before submitting.</div>`;
  html += `<div class="fg-controls">
    <div class="fg-row"><label class="fg-label">Quick paste</label>
      <textarea id="agQuickPaste" class="fg-select" rows="5" style="width:100%; font-family:monospace; resize:vertical;" placeholder="Any of these work:
Rishi &amp; Fatch beat Tom &amp; Topsy 6-0 6-2
Tom/Topsy lost to Rishi/Fatch 6-0, 6-2
Rishi Fatch v Tom Topsy 6-0 6-2
or a team per line with 🏆 and the sets"></textarea>
    </div>
    <div class="fg-row"><button class="preset-btn" id="agQuickParse" style="width:100%;">Read result &amp; fill the form</button></div>
    <div id="agQuickMessage" class="section-sub"></div>
  </div>`;
  html += `<div class="section-sub">Or fill in the fields directly. New games go into Pending below until an admin approves them — nothing here affects ratings until then.</div>`;
  html += `<div class="fg-controls">
    <div class="fg-row"><label class="fg-label">Date</label><input id="agDate" type="date" class="fg-select" /></div>
    <div class="fg-row"><label class="fg-label">Match type</label>
      <div class="fg-toggle" id="agTypeToggle">
        <button class="fg-toggle-btn active" data-type="doubles">Doubles</button>
        <button class="fg-toggle-btn" data-type="singles">Singles</button>
      </div>
    </div>
    <div class="fg-row"><label class="fg-label">Outcome</label>
      <div class="fg-toggle" id="agOutcomeToggle">
        <button class="fg-toggle-btn active" data-outcome="decisive">Finished</button>
        <button class="fg-toggle-btn" data-outcome="draw">Not finished / draw</button>
      </div>
    </div>
    <div class="fg-row"><label class="fg-label" id="agTeamALabel">Team A (winners)</label>
      <input id="agA1" list="playerNamesList" class="fg-select" placeholder="Player name" style="margin-bottom:6px;" />
      <input id="agA2" list="playerNamesList" class="fg-select" placeholder="Partner (leave blank for singles)" />
    </div>
    <div class="fg-row"><label class="fg-label" id="agTeamBLabel">Team B (losers)</label>
      <input id="agB1" list="playerNamesList" class="fg-select" placeholder="Player name" style="margin-bottom:6px;" />
      <input id="agB2" list="playerNamesList" class="fg-select" placeholder="Partner (leave blank for singles)" />
    </div>
    <datalist id="playerNamesList">${allPlayerNames().map(n=>`<option value="${n}">`).join('')}</datalist>
    <div class="fg-row"><label class="fg-label" id="agSetsLabel">Set scores (Team A – Team B)</label>
      <div id="agSets"></div>
      <button class="preset-btn" id="agAddSet" style="margin-top:6px;">+ Add set</button>
    </div>
    <div class="fg-row" id="agNewPlayerRow" style="display:none;">
      <label class="fg-label" style="color:var(--gold-bright);">New player(s) detected — pick a starting tier</label>
      <div id="agNewPlayerTiers"></div>
    </div>
    <div class="fg-row">
      <button class="tab-btn active" id="agSubmit" style="width:100%;">Submit for approval</button>
    </div>
    <div id="agMessage" class="section-sub"></div>
  </div>`;
  html += `</div>`; // close addGameBody

  }
  if(standingsOnly){ /* no admin on the standings site */ }
  else if(!isUnlocked){
    html += `<div class="section-heading">🔒 Admin actions</div>`;
    html += `<div class="section-sub">Approving, editing, or deleting a game needs the admin password.</div>`;
    html += buildLockScreenHtml();
  } else {
    html += `<div class="fg-controls">
      <div class="fg-row"><button class="preset-btn" id="gamesLockNowBtn">🔒 Lock admin area</button></div>
      <div id="gamesMessage" class="section-sub"></div>
    </div>`;
  }

  const pendingFiltered = PlayerFilter.filter(pending, gamesPlayerIds, playerIdFor);

  // Approving the last submission empties the list above, and the outcome of
  // that approval (and its scorecard) must not vanish with it.
  if(!pendingFiltered.length && approvalMessage && isUnlocked){
    html += `<div class="section-sub approval-outcome" style="color:var(--gold-bright);">${approvalMessage}</div>`;
  }

  if(pendingFiltered.length > 0 && !standingsOnly){
    html += `<div class="section-heading">⏳ Pending approval (${pendingFiltered.length})</div>`;
    html += `<div class="section-sub">Submitted but not yet counted in any rating. Approving a game rates it: it joins the record and moves the four players' ratings.</div>`;
    if(approvalMessage) html += `<div class="section-sub" style="color:var(--gold-bright);">${approvalMessage}</div>`;
    pendingFiltered.forEach(m=>{
      const titleText = m.isDraw
        ? `${m.winners.join(' & ')} vs ${m.losers.join(' & ')} <span class="strength-pill" style="margin-left:6px;">DRAW</span>`
        : `<span style="color:var(--green);">${m.winners.join(' & ')}</span> <span style="color:var(--text-dim); font-weight:400;">def</span> <span style="color:var(--red);">${m.losers.join(' & ')}</span>`;
      let pendingCardStyle = '';
      const pendingFocus = gamesFocusName();
      if(pendingFocus && !m.isDraw){
        const playerWon = m.winners.includes(pendingFocus);
        pendingCardStyle = playerWon
          ? 'background:rgba(90,156,90,0.12); border-color:rgba(90,156,90,0.4);'
          : 'background:rgba(181,69,63,0.12); border-color:rgba(181,69,63,0.4);';
      }
      html += `<div class="callout-card" data-game-card="${escapeHtml(m.id)}" style="${pendingCardStyle}">
        <div class="cc-title">${titleText}</div>
        <div class="cc-detail">${m.date} · ${m.sets.map(s=>s.join('-')).join(', ')} · submitted by ${m.submittedBy} (${fmtRelative(m.submittedAt)})</div>
        ${isUnlocked ? `<div class="difficulty-row" style="margin-top:8px;">
          <button class="preset-btn" data-approve="${m.id}" style="flex:1; color:var(--green); border-color:var(--green);">Approve</button>
          <button class="preset-btn" data-reject="${m.id}" style="flex:1; color:#e8a5a1; border-color:var(--red);">Reject</button>
          <button class="preset-btn" data-edit="${m.id}" style="flex:1;">Edit</button>
        </div>` : `<div class="section-sub" style="margin-top:6px;">🔒 Unlock above to approve, reject, or edit</div>`}
        ${isUnlocked && editingMatchId === m.id ? gameEditFormHtml(m.id) : ''}
        ${approvalPlan && approvalPlan.submissionId === m.id ? buildApprovalConfirmHtml() : ''}
      </div>`;
    });
  }

  const focusName = gamesFocusName();
  const groupLabel = PlayerFilter.summary(gamesPlayerLabels());
  const gamesHeading = focusName
    ? `📋 ${escapeHtml(focusName)}'s games (${display.length})`
    : (groupLabel
      ? `📋 Games with ${escapeHtml(groupLabel)} (${display.length})`
      : `📋 All games (${display.length})`);
  html += `<div class="section-heading">${gamesHeading}</div><!--games-list-->`;
  // Counted by the view-model from `display` itself -- the list drawn below --
  // never re-queried.
  html += gamesRecordHtml(gamesVm.record, gamesTypeOptions);
  html += `<div class="section-sub">Newest first, grouped by day. Tap a game to see the full breakdown.</div>`;
  const idToIdx = {};
  ALL_MATCHES.forEach((m,i)=>{ idToIdx[m.id] = i; });
  let lastDate = null;
  display.forEach(m=>{
    if(m.date !== lastDate){
      html += `<div class="section-heading" style="margin-top:16px; font-size:12px; color:var(--gold-soft); text-transform:uppercase; letter-spacing:.04em;">${dayLabel(m.date)}</div>`;
      lastDate = m.date;
    }
    const isBase = m.id.startsWith('base_');
    const edit = matchEditsState[m.id];
    let metaLine = isBase ? 'Historical record' : escapeHtml(matchAttributionLine(m));
    if(edit) metaLine += ` · edited by ${edit.editedBy} (${fmtRelative(edit.editedAt)})`;
    const unverifiedTag = m.verified === false ? `<span class="strength-pill" style="color:#e8a5a1; border-color:var(--red); margin-left:6px;">Pre-June · single-sourced</span>` : '';
    const isExpanded = expandedGameId === m.id;
    // Draws are deliberately absent from MATCHES: they are not wins or losses
    // and must not enter any record. They ARE rated, though, so their detail
    // comes straight from the engine's recorded facts instead.
    const enriched = m.isDraw ? null : (MATCHES[idToIdx[m.id]] || null);
    const drawTag = m.isDraw ? `<span class="strength-pill" style="margin-left:6px;">DRAW · not finished</span>` : '';
    // Tiers as they were ON THE DAY. A player promoted in August shows as B on
    // a June card, because that is the match that was played.
    const sideA = namesWithHistoricalTier(m.winners, m.date);
    const sideB = namesWithHistoricalTier(m.losers, m.date);
    const titleText = m.isDraw
      ? `${sideA} vs ${sideB}${drawTag}${unverifiedTag}`
      : `<span style="color:var(--green);">${sideA}</span> <span style="color:var(--text-dim); font-weight:400;">def</span> <span style="color:var(--red);">${sideB}</span>${unverifiedTag}`;
    // A draw is not a win or a loss for anyone, but it IS rated: the engine
    // scores the result at 0.5 and moves every player accordingly. Saying it
    // "doesn't affect any rating" was simply untrue.
    // The scorecard is the canonical card for a played match; the expanded
    // detail opens it rather than repeating it.
    const detailContent = isExpanded
      ? `<div class="msc-open-row">${scorecardButtonHtml(m.id)}</div>`
        + (m.isDraw ? buildDrawDetailBlock(m) : (enriched ? buildMatchDetailBlock(enriched, false) : ''))
      : '';
    let cardStyle = '';
    if(focusName && !m.isDraw){
      const playerWon = m.winners.includes(focusName);
      cardStyle = playerWon
        ? 'background:rgba(90,156,90,0.12); border-color:rgba(90,156,90,0.4);'
        : 'background:rgba(181,69,63,0.12); border-color:rgba(181,69,63,0.4);';
    }
    // Filtering to one player makes this list that player's -- the card is even
    // tinted by their result -- so the score is read from their side. With no
    // filter the list is neutral: winner order, said out loud.
    const gamesViewerName = focusName;
    const scoreText = gamesViewerName
      ? scoreForViewer(m, playerIsOnStoredWinningSide(m, gamesViewerName))
      : m.sets.map(s=>s.join('-')).join(', ');
    // A decisive card's title already reads "X def Y", which binds the score
    // order on its own -- repeating it under every card is noise. A draw says
    // "X vs Y" and binds nothing, and a filtered list is read from one
    // player's side, so those two say it out loud.
    const scoreBinding = gamesViewerName
      ? ` <span style="font-size:10.5px; color:var(--text-dim);">(${gamesViewerName}'s games first)</span>`
      : (m.isDraw ? ` <span style="font-size:10.5px; color:var(--text-dim);">(${m.winners.join(' & ')} first)</span>` : '');
    // A staged correction keeps its own card open, so the blast-radius panel
    // can never be collapsed out of sight while it is waiting to be confirmed.
    const hasStagedFix = !!(matchFixPlan && matchFixPlan.change
      && (matchFixPlan.change.matchId === m.id
        || (matchFixPlan.change.match && matchFixPlan.change.match.id === m.id)));
    const isEditing = isUnlocked && editingMatchId === m.id;
    const isManaging = isUnlocked && (managingGameId === m.id || hasStagedFix || isEditing);

    // Manage sits on the submission line, not beside the matchup. On a narrow
    // iPhone a button in the title row squeezed four names into a column and
    // wrapped them; the submission line is short, already muted, and has room
    // to spare on the right.
    html += `<div class="callout-card" data-game-card="${escapeHtml(m.id)}" style="${cardStyle}">
      <div class="game-card-head">
        <div class="game-card-clickable" data-gameid="${m.id}" style="cursor:pointer; min-width:0; flex:1;">
          <div class="cc-title">${titleText}</div>
          <div class="cc-detail">${scoreText}${scoreBinding}${m.note?' · '+m.note:''}</div>
          <div class="cc-meta-row">
            <div class="cc-meta">${metaLine}</div>
            ${isUnlocked ? `<button class="game-manage-btn${isManaging ? ' open' : ''}" data-manage="${m.id}"
              aria-expanded="${isManaging}" title="${isManaging ? 'Hide admin actions' : 'Correct or remove this game'}">${isManaging ? 'Close' : '··· Manage'}</button>` : ''}
          </div>
          ${detailContent}
        </div>
      </div>
      ${isManaging ? `<div class="game-manage-body">
        ${isEditing ? gameEditFormHtml(m.id) : `<div class="difficulty-row match-action-row">
          <button class="preset-btn match-action" data-edit="${m.id}" style="flex:1;">Correct match<span class="match-action-sub">Change the score or the players</span></button>
          <button class="preset-btn match-action match-action-destructive" data-delete="${m.id}" style="flex:1;">Remove and replay<span class="match-action-sub">Delete this match from the record</span></button>
        </div>
        <div class="section-sub" style="margin-top:4px; font-size:10.5px;">${MATCH_CORRECTION_NOTE}</div>`}
        ${hasStagedFix ? buildMatchFixConfirmHtml() : ''}
      </div>` : ''}
    </div>`;
  });

  // A game being edited that the current filters do not list still gets its
  // form, at the head of the list rather than out of reach.
  if(isUnlocked && editingMatchId && !html.includes(`data-editing="${escapeHtml(editingMatchId)}"`) && findMatchById(editingMatchId)){
    const form = `<div class="callout-card" data-game-card="${escapeHtml(editingMatchId)}">${gameEditFormHtml(editingMatchId)}</div>`;
    html = html.includes('<!--games-list-->') ? html.replace('<!--games-list-->', form) : html + form;
  }

  box.innerHTML = html;

  box.querySelectorAll('.game-card-clickable').forEach(el=>{
    el.onclick = (ev)=>{
      // A disclosure inside the card is its own control. Without this, clicking
      // "See full calculation" bubbled up here, collapsed the card and
      // re-rendered it -- so the disclosure looked completely inert. It worked
      // on the profile card only because that card has no click handler.
      if(ev.target.closest && ev.target.closest('details')) return;
      // The scorecard button opens its own sheet (one delegated listener);
      // it must not also collapse the card behind it.
      if(ev.target.closest && ev.target.closest('[data-scorecard]')) return;
      const id = el.dataset.gameid;
      expandedGameId = (expandedGameId === id) ? null : id;
      renderGamesTab();
    };
  });

  document.getElementById('gamesFiltersToggle').onclick = ()=>{
    gamesFiltersOpen = !gamesFiltersOpen;
    renderGamesTab();
  };

  // A shut panel has no selects, so every one of these has to tolerate being
  // absent. The values they read and write are module state, not DOM state,
  // so nothing is lost while they are away.
  const typeSelect = document.getElementById('gamesTypeSelect');
  if(typeSelect){
    const opt = (v, label, count) => `<option value="${v}" ${v===gamesType?'selected':''}>${label}${count===undefined?'':` (${count})`}</option>`;
    let html = opt('all', 'All game types');
    if(gamesTypeOptions.categories.length){
      html += `<optgroup label="Tier make-up">` + gamesTypeOptions.categories.map(o=>opt(o.value, o.label, o.count)).join('') + `</optgroup>`;
    }
    if(gamesTypeOptions.matchups.length){
      html += `<optgroup label="Matchup">` + gamesTypeOptions.matchups.map(o=>opt(o.value, o.label, o.count)).join('') + `</optgroup>`;
    }
    typeSelect.innerHTML = html;
    typeSelect.value = gamesType;
    typeSelect.addEventListener('change', e=>{
      gamesType = e.target.value;
      renderGamesTab();
    });
  }

  const gamesMonthSelect = document.getElementById('gamesMonthSelect');
  if(gamesMonthSelect){
    populateMonthSelect(gamesMonthSelect, gamesMonth);
    gamesMonthSelect.addEventListener('change', e=>{
      gamesMonth = e.target.value;
      renderGamesTab();
    });
  }

  const playerFields = [0,1,2,3].map(i => document.getElementById(`gamesPlayer${i}`)).filter(Boolean);
  if(playerFields.length){
    const known = new Map(PLAYERS.map(p => [p.name.toLowerCase(), p.name]));
    const applyFields = ()=>{
      const message = document.getElementById('gamesPlayersMessage');
      const typed = playerFields.map(el => el.value.trim());
      const unknown = [];
      const repeated = [];
      const chosen = [];
      const seen = new Set();
      typed.forEach(v=>{
        if(!v) return;
        const canonicalLabel = known.get(v.toLowerCase());
        if(!canonicalLabel){ unknown.push(v); return; }
        // "A player must not appear twice in the selector": a repeat is a
        // filter that can never match anything, so it is refused rather than
        // quietly narrowed to nothing.
        if(seen.has(canonicalLabel)){ repeated.push(canonicalLabel); return; }
        seen.add(canonicalLabel);
        chosen.push(canonicalLabel);
      });
      setGamesPlayerFilter(chosen);   // clears the note; the new one is set below
      const notes = [];
      if(unknown.length) notes.push(`Not a player: ${unknown.join(', ')}`);
      if(repeated.length) notes.push(`${repeated.join(', ')} can only be picked once`);
      gamesPlayersNote = notes.join(' · ');
      if(message) message.textContent = gamesPlayersNote;
      return notes.length === 0;
    };
    playerFields.forEach(el=>{
      // `change` rather than `input`, so the list does not re-filter (and the
      // panel re-render does not steal focus) on every keystroke.
      el.addEventListener('change', ()=>{ applyFields(); renderGamesTab(); });
    });
    // Clear all. Only rendered while something is selected, so tapping it
    // always does something -- and it leaves Month and Game type exactly
    // where they were: this clears the player selection, not the filters.
    const clearBtn = document.getElementById('gamesPlayersClear');
    if(clearBtn) clearBtn.onclick = ()=>{
      gamesPlayerIds = [];
      gamesPlayersNote = '';
      renderGamesTab();
    };

    // And one at a time. A four-player search is usually wrong by one name,
    // and emptying a text field by hand on a phone to fix that is not a
    // remove affordance -- it is a chore with a keyboard in the way.
    document.querySelectorAll('[data-remove-player]').forEach(btn=>{
      btn.onclick = ()=>{
        const i = Number(btn.dataset.removePlayer);
        const kept = gamesPlayerLabels().filter((_, idx) => idx !== i);
        setGamesPlayerFilter(kept);
        renderGamesTab();
      };
    });
  }

  // ===== Add a game (always available, not gated by admin lock) =====
  if(standingsOnly) return;
  document.getElementById('addGameToggle').onclick = ()=>{
    addGameExpanded = !addGameExpanded;
    if(!addGameExpanded) linkedRequestId = null; // abandoning the form -- don't carry the link into an unrelated later submission
    // Re-rendered rather than shown/hidden, so the heading's chevron and its
    // summary are drawn from the same state as the body.
    renderGamesTab();
  };

  wireIdentityLines(box);

  const today = new Date().toISOString().slice(0,10);
  document.getElementById('agDate').value = today;

  document.querySelectorAll('#agTypeToggle .fg-toggle-btn').forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll('#agTypeToggle .fg-toggle-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const isSingles = b.dataset.type==='singles';
      document.getElementById('agA2').style.display = isSingles ? 'none' : 'block';
      document.getElementById('agB2').style.display = isSingles ? 'none' : 'block';
    };
  });

  function updateOutcomeLabels(isDraw){
    document.getElementById('agTeamALabel').textContent = isDraw ? 'Team A' : 'Team A (winners)';
    document.getElementById('agTeamBLabel').textContent = isDraw ? 'Team B' : 'Team B (losers)';
    document.getElementById('agSetsLabel').textContent = isDraw ? 'Set scores (Team A – Team B) — as played, doesn\'t need a winning side' : 'Set scores (Team A – Team B)';
  }
  document.querySelectorAll('#agOutcomeToggle .fg-toggle-btn').forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll('#agOutcomeToggle .fg-toggle-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      updateOutcomeLabels(b.dataset.outcome === 'draw');
    };
  });

  renderAddGameSets();
  document.getElementById('agAddSet').onclick = ()=>{
    if(addGameSets.length>=5) return;
    addGameSets.push({w:'',l:''});
    renderAddGameSets();
  };

  const readQuickPaste = ()=>{
    const msg = document.getElementById('agQuickMessage');
    const raw = document.getElementById('agQuickPaste').value;
    const result = parseQuickEntryText(raw);
    msg.style.color = '';
    // How it was read, and anything to check -- so a misreading is obvious
    // before anyone submits.
    const list = (items, cls) => items.length ? `<ul class="ag-read-list ${cls}">${items.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : '';
    if(!result.winners){
      msg.innerHTML = `<div class="ag-read is-problem">${list(result.problems, 'is-problem')}</div>`;
      return;
    }
    msg.innerHTML = `<div class="ag-read${result.ok ? '' : ' is-problem'}">
      <div class="ag-read-line">${escapeHtml(ResultParse.describe(result))}</div>
      ${list(result.problems, 'is-problem')}${list(result.warnings, 'is-warning')}${list(result.notes, 'is-note')}
      <div class="ag-read-foot">${result.ok ? 'Filled in below — check it, then Submit.' : 'Filled in what it could below — fix the above, then Submit.'}</div>
    </div>`;
    if(result.date){ const d = document.getElementById('agDate'); if(d) d.value = result.date; }

    const typeBtn = document.querySelector(`#agTypeToggle .fg-toggle-btn[data-type="${result.isSingles ? 'singles' : 'doubles'}"]`);
    if(typeBtn) typeBtn.click();

    const outcomeBtn = document.querySelector(`#agOutcomeToggle .fg-toggle-btn[data-outcome="${result.isDraw ? 'draw' : 'decisive'}"]`);
    if(outcomeBtn) outcomeBtn.click();

    document.getElementById('agA1').value = result.winners[0] || '';
    document.getElementById('agA2').value = result.winners[1] || '';
    document.getElementById('agB1').value = result.losers[0] || '';
    document.getElementById('agB2').value = result.losers[1] || '';

    addGameSets = result.sets.length ? result.sets.map(([w,l])=>({ w: String(w), l: String(l) })) : [{w:'', l:''}];
    renderAddGameSets();
    checkForNewPlayers();

  };
  document.getElementById('agQuickParse').onclick = readQuickPaste;
  // A paste is read straight away; typing waits for the button.
  document.getElementById('agQuickPaste').addEventListener('paste', ()=> setTimeout(readQuickPaste, 0));

  ['agA1','agA2','agB1','agB2'].forEach(id=>{
    document.getElementById(id).addEventListener('input', checkForNewPlayers);
  });

  document.getElementById('agSubmit').onclick = submitNewGame;

  if(!isUnlocked){
    wireLockScreen(renderGamesTab);
    return;
  }

  document.getElementById('gamesLockNowBtn').onclick = async ()=>{
    isUnlocked = false;
    adminRole = null;
    await saveMyUnlocked(false);
    applyTabVisibility();
    renderGamesTab();
  };

  wireMatchFix();
  if(matchFixMessage){
    const msg = document.getElementById('gamesMessage');
    if(msg) msg.innerHTML = `<span style="color:${/failed|cannot|Nothing was changed/.test(matchFixMessage)?'var(--red)':'var(--gold-bright)'};">${matchFixMessage}</span>`;
  }

  box.querySelectorAll('[data-approve]').forEach(btn=>{
    btn.onclick = ()=> prepareApproval(btn.dataset.approve);
  });
  const approveConfirm = document.getElementById('approveConfirmBtn');
  if(approveConfirm) approveConfirm.onclick = commitApproval;
  box.querySelectorAll('input[name="fxChoice"]').forEach(r=>{
    r.onchange = ()=>{ if(approvalPlan){ approvalPlan.fixtureChoice = r.value; renderGamesTab(); } };
  });
  const approveCancel = document.getElementById('approveCancelBtn');
  if(approveCancel) approveCancel.onclick = ()=>{ approvalPlan = null; approvalMessage = 'Cancelled — nothing was rated.'; renderGamesTab(); };
  box.querySelectorAll('[data-reject]').forEach(btn=>{
    btn.onclick = ()=> rejectMatch(btn.dataset.reject);
  });
  box.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.onclick = ()=> openGameEditor(btn.dataset.edit);
  });
  // One card's actions open at a time. Tapping Manage again closes it, and a
  // staged correction is cancelled rather than left hanging invisibly behind a
  // collapsed card.
  box.querySelectorAll('[data-manage]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.manage;
      // Close on a game being edited closes the editor too, as Cancel would.
      if(editingMatchId === id){
        closeGameEditor(id, ()=>{ managingGameId = null; editingMatchId = null; matchFixReset(); renderGamesTab(); });
        return;
      }
      if(managingGameId === id){ managingGameId = null; matchFixReset(); }
      else { managingGameId = id; matchFixPlan = null; matchFixMessage = ''; }
      renderGamesTab();
    };
  });

  // Only rated matches carry [data-delete]; a pending submission is rejected,
  // not removed. Removal no longer arms the button first: the blast-radius
  // panel IS the confirmation, and it now says "Remove and replay" in as many
  // words. Two confirmations, one of them invisible, is how a first click
  // came to look like nothing happening.
  box.querySelectorAll('[data-delete]').forEach(btn=>{
    btn.onclick = ()=>{ deleteMatch(btn.dataset.delete); };
  });

  if(editingMatchId) wireEditForm(editingMatchId);
}
