// ===================== ADMIN: BETA DIAGNOSTICS =====================
// The record-chain checks and the record-health report shown to the board
// (summary) and the owner (detail). No repair action in the app (Ledger).
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: functional. Loads before app.js; declarations only.

// ===================== BETA DIAGNOSTICS (screen) =====================
// Reads the three collections itself, on demand, and checks them against each
// other and against what the application is currently showing. Deliberately not
// part of page load: it is a full read of the database, which is exactly the
// cost the read-strategy exception is trying to avoid paying per render.
//
// Read-only. It reports and never repairs — a diagnostic that quietly fixed
// things would destroy the evidence of what went wrong. The one destructive
// operation, the beta reset, lives in scripts/moneypadel/reset-beta.js and cannot be
// triggered from here.

let diagnosticsReport = null;

let diagnosticsRunning = false;

let diagnosticsError = '';

let diagnosticsRanAt = null;

async function runBetaDiagnostics(){
  if(!db){ diagnosticsError = 'No database connection.'; renderManage(); return; }
  diagnosticsRunning = true; diagnosticsError = ''; renderManage();
  const started = Date.now();
  try {
    const backend = RatingStore.firestoreCompatBackend(db);
    const [playerDocs, matchDocs, journeyDocs] = await Promise.all([
      backend.getAll(RatingStore.COLLECTIONS.players),
      backend.getAll(RatingStore.COLLECTIONS.matches),
      backend.getAll(RatingStore.COLLECTIONS.journey),
    ]);
    const players = {};
    playerDocs.forEach(d => { if(d && d.id) players[d.id] = d; });
    diagnosticsReport = BetaDiagnostics.run({
      players, matches: matchDocs, journey: journeyDocs,
      // Compared against, not used as input: if the app's copy disagrees with
      // the database, that is itself the finding.
      appPlayers: V3_STATE.loaded ? V3_STATE.players : null,
      loadMs: Date.now() - started,
      matchesPerMonth: estimateMatchesPerMonth(),
    });
    diagnosticsRanAt = new Date().toLocaleTimeString();
  } catch(e){
    diagnosticsReport = null;
    diagnosticsError = 'Diagnostics could not read the database: ' + e.message;
  }
  diagnosticsRunning = false;
  renderManage();
}

// Recent months only: the club's rate now is a better guide to growth than an
// average that includes the months before everyone was playing.
function estimateMatchesPerMonth(){
  if(!MONTHLY_VIEWS || !MONTHLY_VIEWS.months.length) return null;
  const months = MONTHLY_VIEWS.months.slice(-3);
  const counts = months.map(m => {
    const rows = MONTHLY_VIEWS.byMonth[m].rows;
    // Each match produces an event per player; rows carry per-player counts.
    return rows.reduce((s, r) => s + r.matches, 0) / 4;
  });
  return counts.length ? Math.round(counts.reduce((a,b)=>a+b,0) / counts.length) : null;
}

// A divergence found this session, shown where an admin would look for it.
// The board is told the record needs repair and that editing is paused; the
// detail goes to the owner, who is the one who can do anything about it.
function buildRecordHealthHtml(){
  if(!healthReport) return '';
  const owner = isOwnerAdmin();
  const message = recordHealthMessage();
  return `<div class="callout-card" style="padding:12px; margin-top:8px; border-color:var(--red);">
    <div style="font-weight:700; color:#e8a5a1;">The record needs repair</div>
    <div class="section-sub" style="margin-top:4px; color:var(--text);">${message}</div>
    ${owner ? `<div class="section-sub" style="font-size:10.5px; margin-top:6px;">
      Logged as <code>${healthReport.id}</code> · first seen ${String(healthReport.firstSeenAt).slice(0,10)}
      · seen ${healthReport.seenCount} time${healthReport.seenCount===1?'':'s'}${(healthReport.seenBy||[]).length ? ' by ' + healthReport.seenBy.join(', ') : ''}.
      No match has been changed or lost: the matches are the record, and only the numbers derived from them are behind.
      Repairing it replays the stored matches and rewrites those numbers — run by Claude Code, who shows the full plan before anything is written.
    </div>` : ''}
  </div>`;
}

function buildDiagnosticsSectionHtml(){
  let html = '';
  html += buildRecordHealthHtml();
  html += `<div class="section-sub">Reads the three collections straight from the database and checks whether the record still hangs together — every rating is the end of a recorded chain, and nothing else in the app would notice if one had a gap. Read-only, and run on demand rather than at page load, because it reads everything.</div>`;
  html += `<div class="fg-controls"><div class="fg-row">
    <button class="preset-btn" id="runDiagnosticsBtn" style="width:100%;" ${diagnosticsRunning?'disabled':''}>${diagnosticsRunning ? 'Reading…' : 'Run diagnostics'}</button>
  </div></div>`;

  if(diagnosticsError) html += `<div class="section-sub" style="color:var(--red);">${diagnosticsError}</div>`;
  if(!diagnosticsReport) return html;

  const r = diagnosticsReport;
  const headline = r.healthy
    ? (r.warned ? `<span class="perf-pos">Record is sound</span> — ${r.warned} thing${r.warned===1?'':'s'} worth a look`
                : `<span class="perf-pos">Record is sound</span> — every check passed`)
    : `<span class="perf-neg">${r.failed} check${r.failed===1?'':'s'} failed</span> — a rating on screen is not explained by the history behind it`;
  html += `<div class="section-sub" style="margin-top:6px;">${headline}. ${r.counts.players} players · ${r.counts.matches} matches · ${r.counts.journey} journey events. Run at ${diagnosticsRanAt}.</div>`;

  html += r.checks.map(c=>{
    const mark = c.status === 'ok' ? '<span class="perf-pos">✔</span>'
      : (c.status === 'warn' ? '<span style="color:var(--gold-bright);">!</span>' : '<span class="perf-neg">✘</span>');
    const items = (c.items && c.items.length)
      ? `<div style="font-size:10.5px; color:var(--text-dim); margin-top:3px;">${c.items.map(i=>`• ${i}`).join('<br/>')}</div>`
      : '';
    return `<div class="matchup-vs" style="margin-top:6px; padding:8px;">
      <div style="font-size:12px;">${mark} <b style="color:var(--text);">${c.name}</b></div>
      <div style="font-size:11px; color:var(--text-dim);">${c.detail}</div>
      ${items}
    </div>`;
  }).join('');

  // The measurement Open Question 1a asks Claude Code to record before the
  // once-per-session cumulative read is allowed to become permanent.
  const rs = r.readStrategy;
  html += `<div class="section-heading" style="margin-top:12px;">Read strategy</div>`;
  html += `<div class="section-sub">Ranking Movement reads the whole journey once per session, by agreed exception while it stays small. This is the measurement that decides when that has to change.</div>`;
  html += `<div class="matchup-vs" style="padding:8px;">
    <div>Journey events: <b style="color:var(--text);">${rs.events}</b> — that is the documents read per session.</div>
    <div>This read took ${rs.loadMs === null ? '—' : rs.loadMs + ' ms'}.</div>
    <div>Growing by roughly ${rs.growthPerMonth === null ? '—' : rs.growthPerMonth} events a month.</div>
    <div style="margin-top:4px;">${rs.due
      ? `<span class="perf-neg">Review is due.</span> Record these figures in PROJECT_LEDGER.md and propose a bounded strategy before relying on this read further.`
      : `Review point is ${rs.reviewAt} events${rs.monthsUntilReview === null ? '' : `, about ${rs.monthsUntilReview} month${rs.monthsUntilReview===1?'':'s'} away`}. Not a limit — the point at which someone should choose deliberately rather than drift.`}</div>
  </div>`;

  html += `<div class="section-heading" style="margin-top:12px;">Beta reset</div>`;
  html += `<div class="section-sub">Returning the beta to its seeded baseline deletes every club decision ever recorded, and cannot be undone from inside the app — the record is forward-only and has no delete. It is deliberately not a button: run <code>node scripts/moneypadel/reset-beta.js</code> for a dry run that lists exactly what would go, then <code>--write --i-mean-it</code> to apply it.</div>`;
  return html;
}
