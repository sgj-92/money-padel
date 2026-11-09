// ===================== RANKINGS: DOUGHNUTS SHEET =====================
// By Player and the Doughnut List, one shared Month (D7). The definition is
// doughnutMatches() in doughnutsData.js; this draws it.
//
// Extracted from shell.js (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: redesign. Loads before app.js; declarations only.
// Lifted out of shell.js's buildShellDom unchanged. It is still indented as it
// was inside that function, on purpose: its HTML is built from multi-line
// template literals, and re-indenting would change their whitespace.

  // All-time leaderboard of shutout sets given and received -- rebuilt fresh
  // each time it's opened, since (unlike the static About text) this data
  // changes as new matches are added.
  let doughnutSortMode = 'total'; // 'total' | 'given' | 'received'
  // By Player or the Doughnut List -- two views of one month's doughnuts. The
  // month is shared, so switching view never changes the period.
  let doughnutView = 'player';    // 'player' | 'list'
  // The same month rule as Rankings and League: a reader's choice is kept;
  // otherwise the Meaningful Month, pinned when the sheet is opened.
  let doughnutMonth = null, doughnutMonthChoice = null, doughnutMonthDefault = null;
  function arriveAtDoughnuts(){
    if(doughnutMonthChoice !== null && (doughnutMonthChoice === 'all' || getAvailableMonths().includes(doughnutMonthChoice))){
      doughnutMonth = doughnutMonthChoice;
      return;
    }
    doughnutMonthChoice = null;
    doughnutMonthDefault = meaningfulMonthNow();
    doughnutMonth = doughnutMonthDefault.month;
  }
  function chooseDoughnutMonth(m){ doughnutMonthChoice = m; doughnutMonth = m; renderDoughnutBody(); }

  // "28 Sep" -- the list's date, the club's short form.
  function doughnutDay(iso){
    const [y, mo, d] = String(iso).split('-').map(Number);
    return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo - 1]}`;
  }

  // One doughnut as a result: winners on the left (the card convention),
  // the score between the sides with the shutout set picked out, and a draw
  // said as a draw. Tapping it opens the game where every result opens: its
  // card in Play › Games.
  function doughnutListRowHtml(m){
    const team = (names) => names.map(n => escapeHtml(n)).join(' &amp; ');
    const score = m.sets.map(([x,y])=> m.shutoutSets.includes(`${x}-${y}`)
      ? `<b class="doughnut-set">${x}–${y}</b>` : `${x}–${y}`).join(', ');
    return `<button type="button" class="doughnut-result" data-match-id="${escapeHtml(m.id)}">
      <span class="doughnut-result-date">${doughnutDay(m.date)}</span>
      <span class="doughnut-result-line">${m.isDraw ? team(m.winners) : `<b>${team(m.winners)}</b>`} <span class="doughnut-result-score">${score}</span> ${team(m.losers)}${m.isDraw ? ' <span class="doughnut-result-draw">· Drawn</span>' : ''}</span>
      <span class="doughnut-chev">›</span>
    </button>`;
  }

  // A doughnut can be handed out in a match nobody won: the list deliberately
  // includes draws (see computeDoughnutStats), and six of them are in the
  // record. Written as "def" regardless, this told a player they had lost a
  // game the record says they drew -- which is why the outcome is now asked of
  // MatchOutcome rather than read off which side a name happens to sit on.
  function formatDoughnutMatch(m){
    const scoreStr = m.sets.map(([x,y])=> m.shutoutSets.includes(`${x}-${y}`) ? `<b>${x}-${y}</b>` : `${x}-${y}`).join(', ');
    return `<div class="doughnut-game-row">
      <span class="section-sub" style="font-size:10.5px;">${dayLabel ? dayLabel(m.date) : m.date}</span>
      <span class="doughnut-game-teams">${MatchOutcome.describe(m)}</span>
      <span class="doughnut-game-score">${scoreStr}</span>
    </div>`;
  }

  function renderDoughnutBody(){
    if(!doughnutMonth) arriveAtDoughnuts();
    const month = doughnutMonth;
    const body = document.getElementById('doughnutModalBody');
    const months = getAvailableMonths();
    // Month and view first, always: an empty month still offers the way out.
    const controls = `
      <div class="fg-controls lg-controls doughnut-controls">
        <div class="fg-row"><label class="fg-label" for="doughnutMonthSelect">Month</label>
          <select id="doughnutMonthSelect" class="fg-select">
            <option value="all"${month === 'all' ? ' selected' : ''}>All time</option>
            ${months.map(m => `<option value="${m}"${m === month ? ' selected' : ''}>${monthLabel(m)}</option>`).join('')}
          </select>
        </div>
      </div>
      ${meaningfulMonthNoteHtml(doughnutMonthDefault, month, 'doughnutMonth')}
      <div class="fg-toggle doughnut-view-toggle" style="margin:8px 0 12px;">
        <button class="fg-toggle-btn ${doughnutView === 'player' ? 'active' : ''}" id="doughnutViewPlayer" aria-pressed="${doughnutView === 'player'}">By Player</button>
        <button class="fg-toggle-btn ${doughnutView === 'list' ? 'active' : ''}" id="doughnutViewList" aria-pressed="${doughnutView === 'list'}">Doughnut List</button>
      </div>`;
    const wireControls = ()=>{
      const sel = document.getElementById('doughnutMonthSelect');
      if(sel) sel.onchange = (e)=> chooseDoughnutMonth(e.target.value);
      wireMeaningfulMonthNote('doughnutMonth', chooseDoughnutMonth);
      document.getElementById('doughnutViewPlayer').onclick = ()=>{ doughnutView = 'player'; renderDoughnutBody(); };
      document.getElementById('doughnutViewList').onclick = ()=>{ doughnutView = 'list'; renderDoughnutBody(); };
    };
    const empty = `<div class="doughnut-empty">${month === 'all' ? 'No doughnuts yet.' : `No doughnuts in ${monthLabel(month)}.`} 🍩</div>`;

    if(doughnutView === 'list'){
      const list = doughnutMatches(month);
      body.innerHTML = controls + (list.length
        ? `<div class="doughnut-list-count section-sub">${list.length} doughnut${list.length === 1 ? '' : 's'} · newest first</div>
           <div class="doughnut-list">${list.map(doughnutListRowHtml).join('')}</div>`
        : empty);
      wireControls();
      body.querySelectorAll('.doughnut-result').forEach(btn=>{
        btn.onclick = ()=>{
          document.getElementById('doughnutModal').classList.remove('show');
          openMatchInGames(btn.dataset.matchId);
        };
      });
      return;
    }

    const stats = computeDoughnutStats(month);
    const sorted = stats.slice().sort((a,b)=> b[doughnutSortMode] - a[doughnutSortMode]);
    if(sorted.length === 0){
      body.innerHTML = controls + empty;
      wireControls();
      return;
    }
    body.innerHTML = controls + `
      <div class="doughnut-sort-row">
        <button class="doughnut-sort-btn ${doughnutSortMode==='total'?'active':''}" data-sort="total">Total</button>
        <button class="doughnut-sort-btn ${doughnutSortMode==='given'?'active':''}" data-sort="given">Most Given</button>
        <button class="doughnut-sort-btn ${doughnutSortMode==='received'?'active':''}" data-sort="received">Most Received</button>
      </div>
      <div class="doughnut-header-row"><span>Player</span><span>Given</span><span>Received</span></div>
    ` + sorted.map(r => `
      <div class="doughnut-row-wrap">
        <div class="doughnut-row" data-name="${r.name}">
          <span class="doughnut-name">${r.name} <span class="doughnut-chev">›</span></span>
          <span class="doughnut-given">${r.given}</span>
          <span class="doughnut-received">${r.received}</span>
        </div>
        <div class="doughnut-detail" id="doughnutDetail-${r.name.replace(/\s+/g,'_')}" style="display:none;">
          ${r.given > 0 ? `<div class="section-sub" style="font-size:10px; margin-top:8px;">GIVEN (${r.given})</div>` + r.givenMatches.map(formatDoughnutMatch).join('') : ''}
          ${r.received > 0 ? `<div class="section-sub" style="font-size:10px; margin-top:8px;">RECEIVED (${r.received})</div>` + r.receivedMatches.map(formatDoughnutMatch).join('') : ''}
        </div>
      </div>
    `).join('');

    wireControls();
    body.querySelectorAll('.doughnut-sort-btn').forEach(btn=>{
      btn.onclick = ()=>{ doughnutSortMode = btn.dataset.sort; renderDoughnutBody(); };
    });
    body.querySelectorAll('.doughnut-row').forEach(row=>{
      row.onclick = ()=>{
        const detail = document.getElementById(`doughnutDetail-${row.dataset.name.replace(/\s+/g,'_')}`);
        const open = detail.style.display !== 'none';
        detail.style.display = open ? 'none' : 'block';
        row.querySelector('.doughnut-chev').textContent = open ? '›' : '⌄';
      };
    });
  }

  function openDoughnutLeaderboard(){
    let modal = document.getElementById('doughnutModal');
    if(!modal){
      modal = document.createElement('div');
      modal.className = 'shell-more-sheet';
      modal.id = 'doughnutModal';
      modal.innerHTML = `<div class="shell-more-panel">
        <h3>Doughnuts</h3>
        <div class="section-sub" style="font-size:11.5px; margin-bottom:12px;">Every 6-0 set -- given and received. By Player totals them; the Doughnut List shows each one. Tap a player or a result to see the games.</div>
        <div id="doughnutModalBody"></div>
      </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e)=>{ if(e.target === modal) modal.classList.remove('show'); });
    }
    // Arriving: the reader's month if they chose one, else the Meaningful Month.
    arriveAtDoughnuts();
    renderDoughnutBody();
    modal.classList.add('show');
  }
