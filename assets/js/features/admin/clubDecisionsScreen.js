// ===================== ADMIN: CLUB DECISIONS =====================
// Historical Club Adjustment and the Admin monthly review (tier changes, the
// rating consequence, Reliability recommendation / override), and the audit
// trail rows that show them. They write club decisions through clubDecision.js
// and replayForward.js, so they are functional code.
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: functional. Loads before app.js; declarations only.

// ===================== HISTORICAL CLUB ADJUSTMENT (screen) =====================
// Admin-only. Records a club decision at a date that has already passed: a
// board decision entered late, a factual correction, or the repair of a
// mistake. Separate from historical MATCH correction, which repairs what
// happened on court -- one is a fact about a result, the other a judgement
// about a player's level, and merging them would let a rating be changed under
// cover of fixing a score.
//
// Everything downstream of the date is re-derived, so the blast radius is shown
// in full before anything is written, and nothing earlier is ever deleted.

// ===================== ADMIN MONTHLY REVIEW =====================
// The club's decision surface, and the only place the application writes a
// rating. Everything it can do goes through ClubDecision.prepare(), which
// refuses anything that would leave the stored ratings not following from the
// stored history -- so this screen shapes the request and shows exactly what
// will be written, and never decides whether it is allowed.
//
// TRUST MODEL, stated plainly: `isUnlocked` is a UI gate, not a security
// boundary. Beta Firestore has open rules and no auth by deliberate decision,
// so anyone who can reach the database can write to it regardless of this
// screen. What makes a decision safe here is that it is forward-only, fully
// attributed, and undone by recording a reversal rather than by deleting
// anything.

let histAdj = null;      // the adjustment being composed

let histCtx = null;      // reconstructed state before the chosen date

let histPlan = null;     // the replayed consequence, awaiting confirmation

let histMessage = '';

let histBusy = false;

// Moving a recorded decision to the date it really took effect
// (HistoricalAdjustment.planMove).
let moveDraft = null;    // { player, fromDate, toDate, reason }
let movePlan = null;     // the replayed consequence, awaiting confirmation
let moveMessage = '';

function histReset(){ histAdj = null; histCtx = null; histPlan = null; histMessage = ''; }

async function histLoadContext(){
  const name = (document.getElementById('histPlayer') || {}).value || '';
  const date = (document.getElementById('histDate') || {}).value || '';
  histStart(name, date);
}

// Opens the adjustment for a player at a date -- from its own form, or handed
// over by the monthly review when the decision took effect before today.
function histStart(name, date){
  const player = Object.keys(V3_STATE.players || {}).find(n => n.toLowerCase() === name.trim().toLowerCase());
  if(!player){ histMessage = name ? `No v3 record for "${name}".` : 'Enter a player name.'; renderManage(); return; }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){ histMessage = 'Enter an effective date as YYYY-MM-DD.'; renderManage(); return; }

  histAdj = { playerId: playerIdFor(player), effectiveDate: date, tierEvent: null, newTier: null,
    ratingDecision: null, overrideRating: null, overrideReliability: null, reliabilityChoice: null,
    correctedRating: null, correctedReliability: null, reason: '', createdBy: reviewActor() };
  histPlan = null; histMessage = '';
  try {
    histCtx = HistoricalAdjustment.context({ journey: (V3_RECORD && V3_RECORD.journey) || [], playerId: playerIdFor(player), effectiveDate: date, toTier: null });
  } catch(e){ histCtx = null; histMessage = e.message; }
  renderManage();
}

// Folds whatever is typed into the open fields into the draft. A field that is
// not on screen keeps whatever the draft already holds -- reading a missing
// input as empty would silently erase a value the moment the panel re-rendered
// without it.
function histDraft(){
  if(!histAdj) return null;
  const el = (id) => document.getElementById(id);
  const num = (id, fallback) => { const e = el(id); if(!e) return fallback;
    const v = e.value.trim(); return (v === '' || !isFinite(Number(v))) ? null : Number(v); };
  const pct = (id, fallback) => { const e = el(id); if(!e) return fallback;
    const v = e.value.trim(); return (v === '' || !isFinite(Number(v))) ? null : Number(v) / 100; };
  const text = (id, fallback) => { const e = el(id); return e ? e.value.trim() : fallback; };
  return {
    ...histAdj,
    overrideRating: num('histOverrideRating', histAdj.overrideRating),
    overrideReliability: pct('histOverrideRel', histAdj.overrideReliability),
    correctedRating: num('histCorrectedRating', histAdj.correctedRating),
    correctedReliability: pct('histCorrectedRel', histAdj.correctedReliability),
    reason: text('histReason', histAdj.reason) || histAdj.reason,
    createdBy: reviewActor(),
  };
}

// Reconstructs the context for the chosen tier so the recommendation is drawn
// from that historical date -- never from today's pools.
function histRefreshContext(toTier){
  histCtx = HistoricalAdjustment.context({
    journey: (V3_RECORD && V3_RECORD.journey) || [], playerId: histAdj.playerId,
    effectiveDate: histAdj.effectiveDate, toTier,
  });
}

async function histPreview(){
  histAdj = histDraft();
  histBusy = true; histMessage = 'Replaying…'; renderManage();
  try {
    const backend = RatingStore.firestoreCompatBackend(db);
    const stored = await readStoredRecord(backend);
    histPlan = HistoricalAdjustment.plan({
      stored, adjustment: histAdj,
      provenance: { createdBy: histAdj.createdBy, recordedAt: new Date().toISOString(), source: 'Historical Club Adjustment' },
    });
    histMessage = '';
  } catch(e){
    histPlan = null;
    histMessage = e.message;
  }
  histBusy = false;
  renderManage();
}

async function histCommit(){
  if(!histPlan) return;
  histBusy = true; histMessage = 'Writing…'; renderManage();
  try {
    await ReplayForward.commit(RatingStore.firestoreCompatBackend(db), histPlan);
    const summary = histPlan.summary;
    histReset();
    await loadV3State();
    histMessage = 'Recorded and replayed. ' + summary;
  } catch(e){
    histMessage = 'Write failed: ' + e.message;
  }
  histBusy = false;
  // Admin is the screen this was done from, so redrawing the active screen
  // shows the outcome message; everything derived from the record this has
  // just rewritten is rebuilt with it.
  dataChanged();
}

function buildHistoricalAdjustmentHtml(){
  // The accordion header names this section; repeating it here said it twice.
  let html = '';
  if(!V3_STATE.loaded){
    return html + `<div class="section-sub" style="color:var(--red);">Unavailable — the record could not be read.</div>`;
  }
  html += `<div class="section-sub">For a board decision entered late, a factual correction, or repairing a mistake. This is <b>not</b> for fixing a match result — that changes what happened on court, this records what the club decided about a player's level. Everything after the date is re-derived, nothing earlier is ever deleted, and you see the full consequence before anything is written.</div>`;

  if(histMessage) html += `<div class="section-sub" style="color:${/failed|cannot|No v3|Enter an/.test(histMessage)?'var(--red)':'var(--gold-bright)'};">${histMessage.replace(/\n/g,'<br/>')}</div>`;

  html += `<div class="fg-controls">
    <div class="fg-row"><label class="fg-label">Player</label><input id="histPlayer" list="playerNamesList" class="fg-select" value="${histAdj ? histAdj.playerId : ''}" placeholder="Player name" /></div>
    <div class="fg-row"><label class="fg-label">Effective date</label><input id="histDate" class="fg-select" value="${histAdj ? histAdj.effectiveDate : ''}" placeholder="YYYY-MM-DD" /></div>
    <div class="fg-row"><button class="preset-btn" id="histLoadBtn" ${histBusy?'disabled':''}>Reconstruct that date</button></div>
  </div>`;

  if(!histAdj || !histCtx) return html;

  const b = histCtx.before;
  if(!b) return html + `<div class="section-sub" style="color:var(--red);">${histAdj.playerId} has no recorded state before ${histAdj.effectiveDate}.</div>`;

  html += `<div class="callout-card" style="padding:12px; margin-top:8px;">
    <div style="font-weight:700; color:var(--text);">${histAdj.playerId} immediately before ${histAdj.effectiveDate}</div>
    <div class="section-sub" style="margin-top:2px;">Tier ${b.tier} · Power Rating <b style="color:var(--text);">${(Math.round(b.rating*10)/10).toFixed(1)}</b> · Reliability ${Math.round(Engine_reliability(b.effectiveEvidence)*100)}% (${b.effectiveEvidence} evidence, ${b.lifetimeMatches} matches) · ${b.classificationStatus || 'status unknown'}</div>
    <div class="section-sub" style="font-size:10.5px;">Last event before that date: ${b.asOfDate}. Measured against the ${histCtx.snapshotSize} players who had a record by then, not today's.</div>`;

  if(histCtx.existing.length){
    html += `<div class="section-sub" style="margin-top:6px; font-weight:700; color:var(--text);">Already recorded on this date</div>`;
    html += histCtx.existing.map(e=>buildAuditRowHtml(e, histCtx.existing)).join('');
    html += `<div class="section-sub" style="font-size:10.5px;">A decision of the same type will <b>supersede</b> the live one above. Both stay in the record; only the newer is replayed.</div>`;
  }

  // Tier
  const up = TIER_ABOVE[b.tier], down = TIER_BELOW[b.tier];
  html += `<div class="section-heading" style="margin-top:12px;">1 · Tier as at ${histAdj.effectiveDate}</div>
    <div class="difficulty-row" style="margin-top:4px;">
      ${up ? `<button class="preset-btn hist-tier ${histAdj.tierEvent==='PROMOTION'?'active':''}" data-event="PROMOTION" data-tier="${up}" style="flex:1;">Promote to ${up}</button>` : ''}
      ${down ? `<button class="preset-btn hist-tier ${histAdj.tierEvent==='DEMOTION'?'active':''}" data-event="DEMOTION" data-tier="${down}" style="flex:1;">Demote to ${down}</button>` : ''}
      <button class="preset-btn hist-tier ${histAdj.tierEvent==='TIER_RETAINED'?'active':''}" data-event="TIER_RETAINED" data-tier="${b.tier}" style="flex:1;">Retain ${b.tier}</button>
    </div>`;

  if(histAdj.tierEvent){
    const rec = histCtx.recommendation;
    html += `<div class="section-heading" style="margin-top:12px;">2 · Rating decision — required</div>`;
    if(histCtx.recommendationAbsent){
      html += `<div class="section-sub" style="color:var(--gold-bright);">No statistical recommendation is available at this date: ${histCtx.recommendationAbsentReason}</div>`;
      html += `<div class="section-sub" style="font-size:10.5px;">That is an absence, not an answer. It does not mean the board decided to keep the rating — choose keep-current or an override deliberately.</div>`;
    } else if(rec && rec.recommended){
      html += `<div class="section-sub">Recommendation at this date: <b style="color:var(--text);">${(Math.round(rec.recommendationRating*10)/10).toFixed(1)}</b> (${rec.ratingDelta>=0?'+':''}${Math.round(rec.ratingDelta*10)/10}). ${rec.reason}</div>`;
    }

    // Same rule as the live review: an unavailable branch is disabled and says
    // why, rather than offering a button that cannot do anything.
    const opt = (key, label, enabled, why) => `<div class="alpha-row${enabled ? '' : ' row-unavailable'}">
      <div class="alpha-name" style="font-size:12.5px;">${label}${why?`<div style="font-size:10px; color:var(--text-dim);">${why}</div>`:''}</div>
      <button class="preset-btn hist-decision ${histAdj.ratingDecision===key?'active':''}" data-decision="${key}" style="width:104px;" ${enabled?'':'disabled'}>${enabled ? (histAdj.ratingDecision===key?'Chosen':'Choose') : 'Unavailable'}</button>
    </div>${enabled || !why ? '' : `<div class="reason-note">ⓘ ${why}</div>`}`;
    const canAccept = !!(rec && rec.recommended);
    const provisional = b.classificationStatus === 'PROVISIONAL';
    html += opt('ACCEPT_RECOMMENDATION', 'Accept the statistical recommendation', canAccept, canAccept ? '' : 'No recommendation exists at this date. That is an absence, not a decision to keep the rating.');
    html += opt('CLUB_OVERRIDE', 'Club override', true, 'The board sets the rating and/or reliability');
    html += opt('KEEP_CURRENT_RATING', 'Keep the rating as it stood', true, 'An explicit decision, recorded as one');
    html += opt('CORRECT_INITIAL_CLASSIFICATION', 'Correct the initial classification', provisional,
      provisional ? 'The initial estimate was wrong' : `${histAdj.playerId} was already established by this date`);

    if(histAdj.ratingDecision === 'CLUB_OVERRIDE'){
      html += `<div class="fg-controls" style="margin-top:6px;">
        <div class="fg-row"><label class="fg-label">Power Rating</label><input id="histOverrideRating" class="fg-select" value="${histAdj.overrideRating ?? ''}" placeholder="leave blank to keep ${(Math.round(b.rating*10)/10).toFixed(1)}" /></div>
        <div class="fg-row"><label class="fg-label">Reliability %</label><input id="histOverrideRel" class="fg-select" value="${histAdj.overrideReliability!=null?Math.round(histAdj.overrideReliability*100):''}" placeholder="leave blank to keep ${Math.round(Engine_reliability(b.effectiveEvidence)*100)}%" /></div>
      </div>`;
    }
    if(histAdj.ratingDecision === 'CORRECT_INITIAL_CLASSIFICATION'){
      html += `<div class="fg-controls" style="margin-top:6px;">
        <div class="fg-row"><label class="fg-label">Corrected Power Rating</label><input id="histCorrectedRating" class="fg-select" value="${histAdj.correctedRating ?? ''}" placeholder="the rating the club believes was right" /></div>
        <div class="fg-row"><label class="fg-label">Reliability % (optional)</label><input id="histCorrectedRel" class="fg-select" value="${histAdj.correctedReliability!=null?Math.round(histAdj.correctedReliability*100):''}" placeholder="leave blank to keep the evidence earned" /></div>
      </div>`;
    }

    html += `<div class="fg-controls" style="margin-top:6px;">
      <div class="fg-row"><label class="fg-label">Reason — required</label><input id="histReason" class="fg-select" value="${histAdj.reason || ''}" placeholder="Why this is being recorded now" /></div>
    </div>`;
    html += `<div class="section-sub" style="font-size:10.5px;">Recorded as ${reviewActor()}.</div>`;

    html += `<div class="difficulty-row" style="margin-top:8px;">
      <button class="preset-btn" id="histPreviewBtn" style="flex:1;" ${histBusy?'disabled':''}>Preview the full consequence</button>
      <button class="preset-btn" id="histCancelBtn" style="flex:1;">Cancel</button>
    </div>`;
  }
  html += `</div>`;

  if(histPlan) html += buildHistPlanHtml();
  return html;
}

// "PDM was promoted on the 3rd, not the 5th": the decision stays exactly as
// the board made it; only the date it takes effect from moves.
function buildMoveDecisionHtml(){
  const d = moveDraft || { player: '', fromDate: '', toDate: '', reason: '' };
  const journey = (V3_RECORD && V3_RECORD.journey) || [];
  const player = d.player ? Object.keys(V3_STATE.players || {}).find(n => n.toLowerCase() === d.player.trim().toLowerCase()) : null;
  const dates = player ? HistoricalAdjustment.decisionDates(journey, playerIdFor(player)) : [];
  const describe = (date) => { const live = HistoricalAdjustment.liveDecisionsOn(journey, playerIdFor(player), date); return live.map(e => auditEventLabel(e, live)).join(' + '); };
  let html = `<div class="section-heading" style="margin-top:16px;">Move a recorded decision to another date</div>
    <div class="section-sub">For a tier change or rating recorded on the wrong date — say a promotion entered a day late, after the player had already played in their new tier. The decision stays exactly as made (tier, rating, Reliability); only its date moves, and every game from the earlier date is re-rated. The original stays in the audit trail.</div>`;
  if(moveMessage) html += `<div class="section-sub" style="color:${/failed|cannot|No |needs|already|Choose|Say why|entered the record/.test(moveMessage)?'var(--red)':'var(--gold-bright)'};">${escapeHtml(moveMessage)}</div>`;
  html += `<div class="fg-controls">
    <div class="fg-row"><label class="fg-label">Player</label><input id="movePlayer" list="playerNamesList" class="fg-select" value="${escapeHtml(d.player)}" placeholder="Player name" /></div>`;
  if(player){
    html += dates.length
      ? `<div class="fg-row"><label class="fg-label">Decision recorded on</label><select id="moveFrom" class="fg-select">${dates.map(x => `<option value="${x}" ${x === d.fromDate ? 'selected' : ''}>${escapeHtml(dayLabel(x))} — ${escapeHtml(describe(x))}</option>`).join('')}</select></div>
        <div class="fg-row"><label class="fg-label">It really took effect on</label><input id="moveTo" type="date" class="fg-select" value="${escapeHtml(d.toDate)}" /></div>
        <div class="section-sub" style="font-size:10.5px;">On that date it comes before that day's games: a promotion dated the 3rd counts for a game played on the 3rd.</div>
        <div class="fg-row"><label class="fg-label">Reason — required</label><input id="moveReason" class="fg-select" value="${escapeHtml(d.reason)}" placeholder="e.g. Promoted before his game on the 3rd; entered late" /></div>
        <div class="fg-row"><button class="preset-btn" id="movePreviewBtn" ${histBusy?'disabled':''}>Preview the full consequence</button></div>`
      : `<div class="section-sub">${escapeHtml(player)} has no tier or rating decision on record to move.</div>`;
  } else {
    html += `<div class="fg-row"><button class="preset-btn" id="moveFindBtn">Find their decisions</button></div>`;
  }
  html += `</div>`;
  if(movePlan){
    const p = movePlan;
    html += `<div class="callout-card" style="padding:12px; margin-top:10px; border-color:var(--gold-dim);">
      <div style="font-weight:700; color:var(--gold-bright);">Confirm — this re-rates every game from ${escapeHtml(p.fromDate < p.toDate ? p.fromDate : p.toDate)}</div>
      <div class="section-sub" style="margin-top:4px; color:var(--text);">${escapeHtml(p.summary)}</div>
      <div class="section-sub" style="font-size:10.5px;">${p.documentsToWrite} documents rewritten, ${p.documentsToDelete} removed. The decision on ${escapeHtml(p.fromDate)} stays in the record, superseded.</div>
      <div class="section-sub" style="margin-top:6px; font-weight:700; color:var(--text);">${p.playersMoved.length} player${p.playersMoved.length===1?'':'s'} end on a different rating</div>
      <div class="section-sub" style="font-size:10.5px; max-height:180px; overflow:auto;">${p.playersMoved.map(m=>`${escapeHtml(m.playerId)} ${m.delta>0?'+':''}${m.delta} → ${Math.round(m.to*10)/10}`).join(' &nbsp;·&nbsp; ') || 'Nobody\'s rating changes.'}</div>
      <div class="difficulty-row" style="margin-top:8px;">
        <button class="preset-btn" id="moveCommitBtn" style="flex:1;" ${histBusy?'disabled':''}>Move it and replay</button>
        <button class="preset-btn" id="moveCancelBtn" style="flex:1;">Cancel</button>
      </div>
    </div>`;
  }
  return html;
}

function moveDraftFromScreen(){
  const v = (id, fallback) => { const e = document.getElementById(id); return e ? e.value : fallback; };
  const prev = moveDraft || {};
  return { player: v('movePlayer', prev.player || '').trim(), fromDate: v('moveFrom', prev.fromDate || ''),
    toDate: v('moveTo', prev.toDate || ''), reason: v('moveReason', prev.reason || '') };
}

async function movePreview(){
  moveDraft = moveDraftFromScreen();
  movePlan = null;
  const player = Object.keys(V3_STATE.players || {}).find(n => n.toLowerCase() === moveDraft.player.toLowerCase());
  if(!player){ moveMessage = moveDraft.player ? `No record for "${moveDraft.player}".` : 'Enter a player name.'; renderManage(); return; }
  histBusy = true; moveMessage = 'Replaying…'; renderManage();
  try {
    const stored = await readStoredRecord(RatingStore.firestoreCompatBackend(db));
    movePlan = HistoricalAdjustment.planMove({ stored, playerId: playerIdFor(player), fromDate: moveDraft.fromDate, toDate: moveDraft.toDate,
      reason: moveDraft.reason, createdBy: reviewActor(),
      provenance: { createdBy: reviewActor(), recordedAt: new Date().toISOString(), source: 'Decision date correction' } });
    moveMessage = '';
  } catch(e){ movePlan = null; moveMessage = e.message; }
  histBusy = false;
  renderManage();
}

async function moveCommit(){
  if(!movePlan) return;
  histBusy = true; moveMessage = 'Writing…'; renderManage();
  try {
    await ReplayForward.commit(RatingStore.firestoreCompatBackend(db), movePlan);
    const summary = movePlan.summary;
    movePlan = null; moveDraft = null;
    await loadV3State();
    moveMessage = 'Moved and replayed. ' + summary;
  } catch(e){ moveMessage = 'Write failed: ' + e.message; }
  histBusy = false;
  dataChanged();
}

function wireMoveDecision(){
  const on = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
  on('moveFindBtn', () => { moveDraft = moveDraftFromScreen(); movePlan = null; moveMessage = ''; renderManage(); });
  const p = document.getElementById('movePlayer');
  if(p) p.onchange = () => { moveDraft = { ...moveDraftFromScreen(), fromDate: '' }; movePlan = null; moveMessage = ''; renderManage(); };
  ['moveFrom', 'moveTo'].forEach(id => { const el = document.getElementById(id); if(el) el.onchange = () => { moveDraft = moveDraftFromScreen(); movePlan = null; }; });
  on('movePreviewBtn', movePreview);
  on('moveCommitBtn', moveCommit);
  on('moveCancelBtn', () => { movePlan = null; moveMessage = 'Cancelled — nothing was written.'; renderManage(); });
}

function buildHistPlanHtml(){
  const p = histPlan;
  const moved = p.playersMoved;
  return `<div class="callout-card" style="padding:12px; margin-top:10px; border-color:var(--gold-dim);">
    <div style="font-weight:700; color:var(--gold-bright);">Confirm — this rewrites every rating after ${histAdj.effectiveDate}</div>
    <div class="section-sub" style="margin-top:4px; color:var(--text);">${p.summary}</div>
    <div class="section-sub" style="font-size:10.5px;">${p.events.map(e=>`${e.eventType}${e.supersedes?` (supersedes <code>${e.supersedes}</code>, revision ${e.revision})`:''}`).join('; ')}. ${p.documentsToWrite} documents rewritten, ${p.documentsToDelete} removed.</div>
    <div class="section-sub" style="margin-top:6px; font-weight:700; color:var(--text);">${moved.length} player${moved.length===1?'':'s'} end on a different rating</div>
    <div class="section-sub" style="font-size:10.5px; max-height:180px; overflow:auto;">${moved.map(m=>`${m.playerId} ${m.delta>0?'+':''}${m.delta} → ${Math.round(m.to*10)/10}`).join(' &nbsp;·&nbsp; ')}</div>
    <div class="difficulty-row" style="margin-top:8px;">
      <button class="preset-btn" id="histCommitBtn" style="flex:1;" ${histBusy?'disabled':''}>Record and replay</button>
      <button class="preset-btn" id="histAbandonBtn" style="flex:1;">Cancel</button>
    </div>
  </div>`;
}

function wireHistoricalAdjustment(){
  const load = document.getElementById('histLoadBtn');
  if(load) load.onclick = histLoadContext;
  const cancel = document.getElementById('histCancelBtn');
  if(cancel) cancel.onclick = ()=>{ histReset(); renderManage(); };
  const abandon = document.getElementById('histAbandonBtn');
  if(abandon) abandon.onclick = ()=>{ histPlan = null; histMessage = 'Cancelled — nothing was written.'; renderManage(); };

  document.querySelectorAll('.hist-tier').forEach(el=>{
    el.onclick = ()=>{
      histAdj = { ...histDraft(), tierEvent: el.dataset.event, newTier: el.dataset.tier, ratingDecision: null };
      histPlan = null; histMessage = '';
      histRefreshContext(el.dataset.tier);
      renderManage();
    };
  });
  document.querySelectorAll('.hist-decision').forEach(el=>{
    el.onclick = ()=>{
      if(el.disabled) return; // an unavailable branch is never recordable
      histAdj = { ...histDraft(), ratingDecision: el.dataset.decision };
      histPlan = null; histMessage = '';
      renderManage();
    };
  });
  const prev = document.getElementById('histPreviewBtn');
  if(prev) prev.onclick = histPreview;
  const commit = document.getElementById('histCommitBtn');
  if(commit) commit.onclick = histCommit;
}

let reviewSubject = null;      // player currently being reviewed

let reviewDraft = null;        // the half-made decision on screen

let reviewSnapshotCache = null; // one pre-review snapshot per effective date

let reviewEffective = null;    // the date a review decision takes effect from; null = today

// ---- Audit row ------------------------------------------------------------
// The raw record is truthful but unreadable: "CLUB_RATING_REASSESSMENT — B→B"
// tells a board member nothing, and three promotion rows in a column give no
// clue which one the engine actually replays. This says what each event is, in
// English, and marks the one that is live. It never collapses the trail into a
// single rewritten event -- every row stays, superseded ones just recede.
const AUDIT_EVENT_LABELS = {
  PLAYER_INITIALISED: 'Entered the record',
  INITIAL_CLASSIFICATION_CORRECTION: 'Initial classification corrected',
  INITIAL_CLASSIFICATION_CONFIRMED: 'Initial classification confirmed',
  PROMOTION: 'Promotion',
  DEMOTION: 'Demotion',
  TIER_RETAINED: 'Tier retained',
  CLUB_RATING_REASSESSMENT: 'Rating reassessment',
};

function auditEventLabel(e, siblings){
  const base = AUDIT_EVENT_LABELS[e.eventType] || e.eventType;
  if(e.eventType !== 'CLUB_RATING_REASSESSMENT') return base;
  // A reassessment recorded alongside a tier move is the rating half of one
  // board decision, and saying so is the difference between "why is this here"
  // and "of course".
  const live = (siblings || []).filter(x => !x.superseded);
  if(live.some(x => x.eventType === 'PROMOTION')) return base + ' after promotion';
  if(live.some(x => x.eventType === 'DEMOTION')) return base + ' after demotion';
  return base;
}

function auditTierText(e){
  if(!e.previousTier && !e.newTier) return '';
  if(e.previousTier && e.newTier && e.previousTier === e.newTier) return `tier unchanged (${e.newTier})`;
  return `${e.previousTier || '—'} → <b>${e.newTier || '—'}</b>`;
}

function auditRatingText(e){
  const fmt = (v) => v == null ? '—' : (Math.round(v*10)/10).toFixed(1);
  if(e.previousPowerRating == null && e.newPowerRating == null) return '';
  if(e.previousPowerRating != null && e.newPowerRating != null
     && Math.abs(e.previousPowerRating - e.newPowerRating) < 0.05){
    return `rating unchanged at ${fmt(e.newPowerRating)}`;
  }
  return `rating ${fmt(e.previousPowerRating)} → <b>${fmt(e.newPowerRating)}</b>`;
}

function buildAuditRowHtml(e, siblings){
  const isCorrection = e.eventType === 'INITIAL_CLASSIFICATION_CORRECTION';
  const badge = e.superseded
    ? '<span class="audit-badge audit-badge-superseded">Superseded</span>'
    : (isCorrection
      ? '<span class="audit-badge audit-badge-correction">Correction</span>'
      : '<span class="audit-badge audit-badge-active">Active</span>');
  const facts = [auditTierText(e), auditRatingText(e)].filter(Boolean).join(', ');
  return `<div class="audit-row${e.superseded ? ' audit-row-superseded' : ''}">
    <span class="audit-dot"></span>
    <div class="audit-body">
      <div class="audit-head">${auditEventLabel(e, siblings)}${badge}</div>
      ${facts ? `<div class="audit-facts">${facts}</div>` : ''}
      <div class="audit-meta">by ${e.createdBy || 'unknown'}${e.revision ? ` · revision ${e.revision}` : ''}</div>
    </div>
  </div>`;
}

function Engine_reliability(evidence){ return RatingEngine.reliability(evidence); }

// One snapshot for the whole review date. Every recommendation offered today
// comes from it, so accepting one player's decision cannot move the boundary
// used to recommend the next. Without this, reviewing Jams before Aubyn does
// not merely shift Aubyn's number -- it can empty Tier C below the minimum pool
// size and remove his recommendation altogether.
function reviewSnapshot(){
  const date = reviewToday();
  if(!reviewSnapshotCache || reviewSnapshotCache.date !== date){
    reviewSnapshotCache = { date, state: MonthlyReview.preReviewSnapshot((V3_RECORD && V3_RECORD.journey) || [], date) };
  }
  return reviewSnapshotCache.state;
}

// The draft in the shape MonthlyReview validates, with whatever the board has
// typed into the open fields folded in.
function reviewDraftForCheck(){
  if(!reviewDraft) return { playerId: reviewSubject, effectiveDate: reviewToday() };
  // A field that is not on screen keeps whatever the draft already holds.
  const el = (id) => document.getElementById(id);
  const num = (id, fallback) => { const e = el(id); if(!e) return fallback;
    const v = e.value.trim(); return (v === '' || !isFinite(Number(v))) ? null : Number(v); };
  const pct = (id, fallback) => { const e = el(id); if(!e) return fallback;
    const v = e.value.trim(); return (v === '' || !isFinite(Number(v))) ? null : Number(v) / 100; };
  const text = (id, fallback) => { const e = el(id); return e ? e.value.trim() : fallback; };
  return {
    ...reviewDraft,
    overrideRating: num('reviewOverrideRating', reviewDraft.overrideRating),
    // Two inputs can carry a Reliability override: the club-override block in
    // step 2 (which predates step 3) and step 3's own field. Whichever is on
    // screen wins; neither silently overwrites the other with a blank.
    overrideReliability: pct('reviewRelOverride', pct('reviewOverrideRel', reviewDraft.overrideReliability)),
    correctedRating: num('reviewCorrectedRating', reviewDraft.correctedRating),
    correctedReliability: pct('reviewCorrectedRel', reviewDraft.correctedReliability),
    notes: text('reviewNote', reviewDraft.notes) || reviewDraft.notes || null,
    createdBy: reviewActor(),
    // This screen asks the Reliability question, so it insists on an answer.
    requireReliabilityAnswer: true,
  };
}

let reviewPending = null;      // a prepared decision awaiting explicit confirmation

let reviewMessage = '';

const TIER_ABOVE = { C: 'B', B: 'A', A: 'S' };

const TIER_BELOW = { S: 'A', A: 'B', B: 'C' };

function reviewToday(){ return new Date().toISOString().slice(0,10); }

// Candidates are the players the ratings themselves put near a boundary. It is
// a prompt for a human look, never a queue of things to approve.
function reviewCandidates(){
  if(!V3_STATE.loaded) return [];
  // A tier review is for the group as it is: an archived player is not one.
  return livePlayers()
    .filter(p => p.risk === 'promotion_watch' || p.risk === 'demotion_watch')
    .map(p => ({
      name: p.name,
      risk: p.risk,
      fromTier: p.tier,
      toTier: p.risk === 'promotion_watch' ? TIER_ABOVE[p.tier] : TIER_BELOW[p.tier],
      gap: p.risk === 'promotion_watch' ? p.promotion_gap : p.demotion_gap,
    }))
    .filter(c => !!c.toTier)
    .sort((a,b)=> (a.gap ?? 1e9) - (b.gap ?? 1e9));
}

function reviewRecommendation(subject, fromTier, toTier, eventType){
  try {
    return Reassessment.getRecommendation({
      state: V3_STATE.players,
      tierOf: (n) => (V3_STATE.players[n] || {}).tier,
      subject, fromTier, toTier, eventType,
    });
  } catch(e){
    return { error: e.message };
  }
}

function buildReviewSectionHtml(){
  let html = '';
  if(!V3_STATE.loaded){
    return html + `<div class="section-sub" style="color:var(--red);">Unavailable — ${String(V3_STATE.error || 'v3 state is not loaded.')} Nothing can be recorded until the record can be read.</div>`;
  }
  html += `<div class="section-sub">Where the club changes a rating or a tier. Every decision is recorded against the player with who made it and what the recommendation said, takes effect from today forward, and is undone by recording a reversal — never by deleting it. A tier move and a rating change are separate decisions on purpose: a promotion awards no points.</div>`;
  html += `<div class="section-sub" style="font-size:10.5px;">The admin unlock controls what this screen shows, not who can write. Beta storage is deliberately open, so treat attribution as a record of intent, not proof of identity.</div>`;

  if(reviewMessage) html += `<div class="section-sub" style="color:var(--gold-bright);">${reviewMessage}</div>`;

  const cands = reviewCandidates();
  html += `<div class="section-sub" style="margin-top:8px; font-weight:700; color:var(--text);">Near a tier boundary (${cands.length})</div>`;
  if(cands.length === 0){
    html += `<div class="section-sub">Nobody is close enough to a boundary to flag. Any player can still be reviewed below.</div>`;
  } else {
    html += cands.map(c=>`<div class="alpha-row">
      <div class="alpha-name" style="font-size:13px;">${c.name} <span style="color:var(--text-dim); font-size:11px;">Tier ${c.fromTier} → ${c.toTier}, ${c.gap === null ? 'gap unknown' : `${Math.abs(c.gap)} pts away`}</span></div>
      <button class="preset-btn review-pick" data-player="${c.name}" style="width:96px;">Review</button>
    </div>`).join('');
  }

  html += `<div class="fg-controls" style="margin-top:8px;">
    <div class="fg-row"><label class="fg-label">Review anyone</label>
      <input id="reviewAnyName" list="playerNamesList" class="fg-select" placeholder="Player name" />
    </div>
    <div class="fg-row"><button class="preset-btn" id="reviewAnyBtn">Open review</button></div>
  </div>`;

  if(reviewSubject) html += buildReviewPanelHtml(reviewSubject);
  return html;
}

// A tier change and its rating consequence are ONE board decision, so the panel
// will not let the second half be skipped. Choosing a tier move arms the review;
// it is only recordable once the board has also said what happens to the
// rating. "Keep the current rating" is one of those answers and is recorded --
// a decision that leaves no trace is indistinguishable from the omission this
// rule exists to prevent.
function buildReviewPanelHtml(name){
  const snap = reviewSnapshot();
  const s = snap[name];
  const live = V3_STATE.players[name];
  if(!live) return `<div class="section-sub" style="color:var(--red);">${name} has no v3 record.</div>`;
  if(!s) return `<div class="section-sub" style="color:var(--red);">${name} has no recorded state before ${reviewToday()}, so there is nothing to review against.</div>`;

  const last = ClubDecision.lastEventDate((V3_RECORD && V3_RECORD.journey) || [], playerIdFor(name));
  const d = reviewDraft && reviewDraft.playerId === name ? reviewDraft : null;
  const up = TIER_ABOVE[s.tier], down = TIER_BELOW[s.tier];

  let html = `<div class="callout-card" style="padding:12px; margin-top:10px;">
    <div style="font-weight:700; color:var(--text); font-size:14px;">${name}</div>
    <div class="section-sub" style="margin-top:2px;">Tier ${s.tier} · Power Rating <b style="color:var(--text);">${(Math.round(s.rating*10)/10).toFixed(1)}</b> · Reliability ${Math.round(Engine_reliability(s.effectiveEvidence)*100)}% · ${s.lifetimeMatches} rated matches · ${s.classificationStatus || 'status unknown'}</div>
    <div class="section-sub" style="font-size:10.5px;">Figures are as they stood before ${reviewToday()} (last event ${s.asOfDate}). Everyone reviewed today is measured against this same snapshot, so the order the board works through them cannot change what anybody is offered.</div>`;

  // ---- When it takes effect ----
  // Today, normally. A decision that really took effect earlier (entered a day
  // late, after the player had already played in their new tier) is recorded
  // at that date through the Historical club adjustment, which re-rates every
  // game since and shows the consequence first.
  html += `<div class="fg-controls" style="margin-top:10px;">
    <div class="fg-row"><label class="fg-label">Takes effect from</label><input id="reviewEffective" type="date" class="fg-select" value="${reviewEffective || reviewToday()}" max="${reviewToday()}" /></div>
  </div>`;
  if(reviewEffective && reviewEffective < reviewToday()){
    html += `<div class="callout-card" style="padding:10px; margin-top:6px; border-color:var(--gold-dim);">
      <div class="section-sub" style="margin:0; color:var(--text);">Dated ${escapeHtml(dayLabel(reviewEffective))}, before today. It is recorded through the Historical club adjustment: the tier and rating are judged as they stood that day, and every game since is re-rated — you see who moves before anything is written.</div>
      <div class="difficulty-row" style="margin-top:8px;"><button class="preset-btn" id="reviewGoHistorical" style="flex:1;">Continue at ${escapeHtml(reviewEffective)}</button></div>
    </div>`;
    html += `<div style="margin-top:10px;"><button class="preset-btn" id="reviewCloseBtn" style="width:100%;">Close review</button></div></div>`;
    return html;
  }

  // ---- Step 1: the tier decision ----
  html += `<div class="section-heading" style="margin-top:12px;">1 · Tier</div>`;
  html += `<div class="difficulty-row" style="margin-top:4px;">
    ${up ? `<button class="preset-btn review-tier ${d && d.tierEvent==='PROMOTION' ? 'active':''}" data-player="${name}" data-event="PROMOTION" data-tier="${up}" style="flex:1;">Promote to ${up}</button>` : ''}
    ${down ? `<button class="preset-btn review-tier ${d && d.tierEvent==='DEMOTION' ? 'active':''}" data-player="${name}" data-event="DEMOTION" data-tier="${down}" style="flex:1;">Demote to ${down}</button>` : ''}
    <button class="preset-btn review-tier ${d && d.tierEvent==='TIER_RETAINED' ? 'active':''}" data-player="${name}" data-event="TIER_RETAINED" data-tier="${s.tier}" style="flex:1;">Retain ${s.tier}</button>
  </div>`;

  if(!d){
    html += `<div class="section-sub" style="margin-top:8px;">Choose a tier decision to begin. A tier change moves no points on its own — the rating decision below is a separate, required step.</div>`;
    html += `<div style="margin-top:10px;"><button class="preset-btn" id="reviewCloseBtn" style="width:100%;">Close review</button></div></div>`;
    return html;
  }

  // ---- Step 2: the rating decision, which cannot be skipped ----
  const rec = d.recommendation;
  html += `<div class="section-heading" style="margin-top:12px;">2 · Rating — required</div>`;
  html += `<div class="section-sub">This review cannot be recorded until the board says what happens to ${name}'s Power Rating. Leaving it unanswered is what creates a request to backdate months later.</div>`;

  if(d.tierEvent === 'TIER_RETAINED'){
    html += `<div class="section-sub" style="font-size:10.5px;">Retaining a tier crosses no boundary, so there is no statistical recommendation to offer.</div>`;
  } else if(rec && rec.recommended){
    html += `<div class="section-sub">Recommendation: <b style="color:var(--text);">${(Math.round(rec.recommendationRating*10)/10).toFixed(1)}</b> (${rec.ratingDelta>=0?'+':''}${Math.round(rec.ratingDelta*10)/10}). ${rec.reason} Boundary T2 ${rec.t2.toFixed(1)}, from ${rec.establishedFrom} established in ${rec.fromTier} and ${rec.establishedTo} in ${rec.toTier}.</div>`;
    html += `<div class="section-sub" style="font-size:10.5px;">${rec.caveats.join(' ')}</div>`;
  } else {
    html += `<div class="section-sub">No statistical recommendation: ${rec ? rec.reason : 'not calculated.'}</div>`;
  }

  // An action the board cannot take is shown, disabled, with the reason in the
  // same row -- never as a live-looking Choose button. Hiding it entirely would
  // leave the board wondering whether the branch exists at all.
  const opt = (key, label, enabled, why) => `<div class="alpha-row${enabled ? '' : ' row-unavailable'}">
    <div class="alpha-name" style="font-size:12.5px;">${label}${why ? `<div style="font-size:10px; color:var(--text-dim);">${why}</div>` : ''}</div>
    <button class="preset-btn review-decision ${d.ratingDecision===key?'active':''}" data-decision="${key}" style="width:104px;" ${enabled?'':'disabled'}>${enabled ? (d.ratingDecision===key ? 'Chosen' : 'Choose') : 'Unavailable'}</button>
  </div>${enabled ? '' : `<div class="reason-note">ⓘ ${why}</div>`}`;

  const canAccept = !!(rec && rec.recommended);
  const provisional = s.classificationStatus === 'PROVISIONAL';
  html += opt('ACCEPT_RECOMMENDATION', 'Accept the statistical recommendation', canAccept,
    canAccept ? `Moves to ${(Math.round(rec.recommendationRating*10)/10).toFixed(1)}` : 'No recommendation is available');
  html += opt('CLUB_OVERRIDE', 'Club override', true, 'The board sets the rating itself');
  html += opt('KEEP_CURRENT_RATING', 'Keep the current rating', true, `Recorded as a decision, not an omission — stays at ${(Math.round(s.rating*10)/10).toFixed(1)}`);
  html += opt('CORRECT_INITIAL_CLASSIFICATION', 'Correct the initial classification', provisional,
    provisional ? 'The initial estimate was wrong — not a reward for development'
      : `${name} is already established, so there is no initial estimate left to correct`);

  // Reliability used to be asked for here as well, which put two Reliability
  // inputs on one screen once step 3 existed -- the board could set it twice,
  // differently, and only one would win. Step 3 owns it now.
  if(d.ratingDecision === 'CLUB_OVERRIDE'){
    html += `<div class="fg-controls" style="margin-top:6px;">
      <div class="fg-row"><label class="fg-label">Power Rating</label><input id="reviewOverrideRating" class="fg-select" value="${d.overrideRating ?? ''}" placeholder="leave blank to keep ${(Math.round(s.rating*10)/10).toFixed(1)}" /></div>
    </div>`;
  }
  if(d.ratingDecision === 'CORRECT_INITIAL_CLASSIFICATION'){
    html += `<div class="fg-controls" style="margin-top:6px;">
      <div class="fg-row"><label class="fg-label">Corrected Power Rating</label><input id="reviewCorrectedRating" class="fg-select" value="${d.correctedRating ?? ''}" placeholder="the rating the club believes was right" /></div>
    </div>`;
  }

  html += `<div id="reviewReliabilityBlock">${buildReviewReliabilityHtml(d, s, snap, name)}</div>`;

  html += `<div class="fg-controls" style="margin-top:6px;">
    <div class="fg-row"><label class="fg-label">Note (recorded)</label><input id="reviewNote" class="fg-select" value="${d.notes || ''}" placeholder="Why the club decided this" /></div>
  </div>`;

  // Always rendered, even when empty: typing into a field updates this in
  // place rather than re-rendering the screen, and it has to exist to be
  // updated. Before, validation ran only at render time, so entering a valid
  // Reliability and reason left the old warnings on screen and the stage
  // button disabled until something unrelated forced a re-render.
  const missing = MonthlyReview.incompleteReasons(reviewDraftForCheck(), snap);
  html += `<div id="reviewMissing" class="section-sub" style="color:var(--gold-bright); margin-top:6px;">${missingHtml(missing)}</div>`;
  html += `<div class="difficulty-row" style="margin-top:8px;">
    <button class="preset-btn" id="reviewStageBtn" style="flex:1;" ${missing.length?'disabled':''}>Review what will be recorded</button>
    <button class="preset-btn" id="reviewCloseBtn" style="flex:1;">Close</button>
  </div>`;
  html += `</div>`;

  if(reviewPending) html += buildReviewConfirmHtml();
  return html;
}

// Re-attachable, because the Reliability block is rebuilt in place whenever the
// rating changes and its buttons go with it.
function wireReviewReliabilityChoices(){
  document.querySelectorAll('.review-reliability').forEach(el=>{
    el.onclick = ()=>{
      if(!reviewDraft) return;
      reviewDraft = { ...reviewDraftForCheck(), reliabilityChoice: el.dataset.reliability };
      reviewPending = null; reviewMessage = '';
      renderManage();
    };
  });
}

function missingHtml(missing){
  return missing.length ? missing.map(m=>`• ${m}`).join('<br/>') : '';
}

// Validation used to run only while the screen was being built, so typing a
// valid answer changed nothing until something else forced a re-render. This
// folds the fields into the draft and refreshes what the answer affects,
// WITHOUT rebuilding the screen -- a re-render on every keystroke would take
// the caret out of the field being typed into, and a re-render on blur can
// swallow the click that caused it.
//
// `fromRating` says the rating changed, which is the one case where the
// Reliability step's own content is stale too: its recommendation is priced
// against the anchor. That block is only rebuilt then, because rebuilding it
// while someone is typing INTO it would destroy the field under them.
function refreshReviewValidation({ fromRating } = {}){
  if(!reviewDraft) return;
  reviewDraft = reviewDraftForCheck();
  const snap = reviewSnapshot();
  if(!snap) return;

  if(fromRating){
    const host = document.getElementById('reviewReliabilityBlock');
    const s = snap[reviewDraft.playerId];
    if(host && s) host.innerHTML = buildReviewReliabilityHtml(reviewDraft, s, snap, reviewDraft.playerId);
    wireReviewReliabilityChoices();
  }

  const missing = MonthlyReview.incompleteReasons(reviewDraftForCheck(), snap);
  const box = document.getElementById('reviewMissing');
  if(box) box.innerHTML = missingHtml(missing);
  const stage = document.getElementById('reviewStageBtn');
  if(stage) stage.disabled = missing.length > 0;
}

// ---- Step 3: Reliability, once a rating is on the table ----
//
// Shaun's rule (20 Sep): the board should not have to invent a Reliability
// percentage. The system recommends one from how far the rating actually moves
// -- the anchor the board chose, not the one the app suggested -- and the board
// either takes it or departs from it deliberately.
//
// A departure has to say why. A percentage with no reason behind it is
// indistinguishable from a slip of the finger, and this is the permanent record.
function buildReviewReliabilityHtml(d, s, snap, name){
  const draft = reviewDraftForCheck();
  const rec = MonthlyReview.reliabilityRecommendationFor(draft, snap);
  const now = Engine_reliability(s.effectiveEvidence);
  const band = (r) => (typeof V3Bridge !== 'undefined' && V3Bridge.reliabilityBand)
    ? V3Bridge.reliabilityBand(r) : '';
  const pc = (r) => Math.round(r * 100) + '%';

  let html = `<div class="section-heading" style="margin-top:12px;">3 · Reliability</div>`;

  if(!rec){
    // Only reachable before the rating question is answered. Saying nothing
    // would read as "no change needed"; this says which it is.
    html += `<div class="section-sub">${name} stays at <b style="color:var(--text);">${pc(now)}</b> (${band(now)}). `
      + `A Reliability recommendation follows the size of the rating change, so answer the rating above first.</div>`;
    return html;
  }

  html += `<div class="section-sub">Recommended: <b style="color:var(--text);">${pc(rec.reliability)}</b> (${band(rec.reliability)}), `
    + `from ${pc(now)} (${band(now)}). ${rec.reason}</div>`;
  html += `<div class="section-sub" style="font-size:10.5px;">Reliability is how much evidence stands behind the rating, and it sets how fast results move it: `
    + `${pc(rec.reliability)} means K ${RatingEngine.kForEvidence(RatingEngine.effectiveEvidenceForReliability(rec.reliability)).toFixed(1)}, `
    + `and about ${Math.max(0, Math.ceil(RatingEngine.effectiveEvidenceForReliability(0.5) - RatingEngine.effectiveEvidenceForReliability(rec.reliability)))} matches back to 50%.</div>`;

  const choice = d.reliabilityChoice || null;
  const relOpt = (key, label, why) => `<div class="alpha-row">
    <div class="alpha-name" style="font-size:12.5px;">${label}${why ? `<div style="font-size:10px; color:var(--text-dim);">${why}</div>` : ''}</div>
    <button class="preset-btn review-reliability ${choice===key?'active':''}" data-reliability="${key}" style="width:104px;">${choice===key ? 'Chosen' : 'Choose'}</button>
  </div>`;
  html += relOpt('USE_RECOMMENDATION', 'Use the recommendation', `Records ${pc(rec.reliability)}`);
  html += relOpt('OVERRIDE', 'Override Reliability', 'The board sets it, with a reason');

  if(choice === 'OVERRIDE'){
    html += `<div class="fg-controls" style="margin-top:6px;">
      <div class="fg-row"><label class="fg-label">Reliability %</label><input id="reviewRelOverride" class="fg-select" value="${d.overrideReliability!=null ? Math.round(d.overrideReliability*100) : ''}" placeholder="the percentage the board decides" /></div>
    </div>`;
    html += `<div class="section-sub" style="font-size:10.5px;">Recorded as a club override beside the ${pc(rec.reliability)} it departs from, with the note below as its reason.</div>`;
  }
  return html;
}

// Nothing is written until this is confirmed, and it states the exact document
// id and the exact before/after rather than a reassuring summary.
function buildReviewConfirmHtml(){
  const list = reviewPending;
  return `<div class="callout-card" style="padding:12px; margin-top:10px; border-color:var(--gold-dim);">
    <div style="font-weight:700; color:var(--gold-bright);">Confirm — this writes ${list.length === 1 ? 'one event' : `${list.length} events`} to the permanent record</div>
    ${list.map((p,i)=>`<div class="section-sub" style="margin-top:4px; color:var(--text);">${i+1}. ${p.summary}</div>
      <div class="section-sub" style="font-size:10.5px;">${p.event.eventType}, effective ${p.event.effectiveDate}, as <code>${p.journeyDoc.id}</code>.</div>`).join('')}
    <div class="section-sub" style="font-size:10.5px;">Attributed to ${list[0].journeyDoc.createdBy}. Nothing here can be deleted; to undo it you record a reversal.</div>
    <div class="difficulty-row" style="margin-top:8px;">
      <button class="preset-btn" id="reviewConfirmBtn" style="flex:1;">Record it</button>
      <button class="preset-btn" id="reviewCancelBtn" style="flex:1;">Cancel</button>
    </div>
  </div>`;
}

// Every button here only ever STAGES a decision. Nothing reaches the database
// without a second, explicit confirmation showing the exact document.
function wireReviewSection(){
  document.querySelectorAll('.review-pick').forEach(el=>{
    el.onclick = ()=>{ reviewSubject = el.dataset.player; reviewDraft = null; reviewPending = null; reviewMessage = ''; renderManage(); };
  });
  const anyBtn = document.getElementById('reviewAnyBtn');
  if(anyBtn) anyBtn.onclick = ()=>{
    const raw = (document.getElementById('reviewAnyName').value || '').trim();
    const match = Object.keys(V3_STATE.players || {}).find(n => n.toLowerCase() === raw.toLowerCase());
    if(!match){ reviewMessage = raw ? `No v3 record for "${raw}".` : 'Enter a player name.'; }
    else { reviewSubject = match; reviewDraft = null; reviewPending = null; reviewMessage = ''; }
    renderManage();
  };
  const closeBtn = document.getElementById('reviewCloseBtn');
  if(closeBtn) closeBtn.onclick = ()=>{ reviewSubject = null; reviewDraft = null; reviewPending = null; reviewMessage = ''; reviewEffective = null; renderManage(); };
  const eff = document.getElementById('reviewEffective');
  if(eff) eff.onchange = ()=>{
    const v = eff.value;
    reviewEffective = (!v || v >= reviewToday()) ? null : v;
    reviewDraft = null; reviewPending = null;
    renderManage();
  };
  const goHist = document.getElementById('reviewGoHistorical');
  if(goHist) goHist.onclick = ()=>{
    const player = reviewSubject, date = reviewEffective;
    reviewSubject = null; reviewDraft = null; reviewPending = null; reviewEffective = null;
    adminOpenSections.historical = true;
    histStart(player, date);
    const sec = document.querySelector('[data-acc="historical"]');
    if(sec) sec.scrollIntoView({ block: 'start' });
  };

  // Step 1. Arms the review and computes the recommendation from the shared
  // snapshot -- never from live state, which already contains any decision
  // recorded earlier today.
  document.querySelectorAll('.review-tier').forEach(el=>{
    el.onclick = ()=>{
      const name = el.dataset.player;
      const snap = reviewSnapshot();
      const s = snap[name];
      const toTier = el.dataset.tier;
      const eventType = el.dataset.event;
      reviewDraft = {
        playerId: name,
        effectiveDate: reviewToday(),
        tierEvent: eventType,
        newTier: toTier,
        ratingDecision: null,
        overrideRating: null, overrideReliability: null,
        reliabilityChoice: null,
        correctedRating: null, correctedReliability: null,
        notes: null,
        recommendation: (eventType === 'TIER_RETAINED' || !s) ? null
          : MonthlyReview.recommendationFor(snap, {
              playerId: name, fromTier: s.tier, toTier, eventType,
            }),
      };
      reviewPending = null; reviewMessage = '';
      renderManage();
    };
  });

  // Step 2. Choosing a rating answer never writes; it only completes the draft.
  document.querySelectorAll('.review-decision').forEach(el=>{
    el.onclick = ()=>{
      if(!reviewDraft) return;
      if(el.disabled) return; // an unavailable branch is never recordable
      reviewDraft = { ...reviewDraftForCheck(), ratingDecision: el.dataset.decision };
      reviewPending = null; reviewMessage = '';
      renderManage();
    };
  });

  // Step 3. Same contract as step 2: choosing completes the draft, writes nothing.
  wireReviewReliabilityChoices();

  // Live validation. Typing is the whole point: the answer must be accepted as
  // it is given, not on the next unrelated tap.
  [
    { id: 'reviewOverrideRating', fromRating: true },
    { id: 'reviewCorrectedRating', fromRating: true },
    { id: 'reviewRelOverride', fromRating: false },
    { id: 'reviewNote', fromRating: false },
  ].forEach(({ id, fromRating })=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', ()=> refreshReviewValidation({ fromRating }));
  });

  const stageBtn = document.getElementById('reviewStageBtn');
  if(stageBtn) stageBtn.onclick = ()=>{ reviewDraft = reviewDraftForCheck(); stageReview(); };

  const diagBtn = document.getElementById('runDiagnosticsBtn');
  if(diagBtn) diagBtn.onclick = runBetaDiagnostics;

  const confirmBtn = document.getElementById('reviewConfirmBtn');
  if(confirmBtn) confirmBtn.onclick = commitReviewDecision;
  const cancelBtn = document.getElementById('reviewCancelBtn');
  if(cancelBtn) cancelBtn.onclick = ()=>{ reviewPending = null; reviewMessage = 'Cancelled — nothing was written.'; renderManage(); };
}

// Attribution is a record of intent, not proof of identity -- there is no login.
// It is still required, so a decision always says who believed they were making it.
function reviewActor(){
  return (currentUserName && currentUserName.trim()) || 'Admin (unnamed)';
}

// Builds a decision, runs it past ClubDecision, and holds it for confirmation.
// A refusal is shown verbatim: these are the reasons the record would stop
// being reconstructible, and softening them would defeat the point.
// Prepares BOTH halves of the review against the live record, applying the
// first to a working copy so the second is prepared against the state it will
// actually meet. Nothing is written.
function stageReview(){
  const snap = reviewSnapshot();
  const recordedAt = new Date().toISOString();
  try {
    const decisions = MonthlyReview.decisionsFor(reviewDraftForCheck(), snap)
      // A decision is about to become a document, so from here on the player
      // is an identity, not a label. Without this a renamed player's decision
      // would be filed under a player the record has never heard of.
      .map(d => ({ ...d, playerId: playerIdFor(d.playerId) }));
    const working = {};
    Object.entries(V3_STATE.playersById).forEach(([k,v])=>{ working[k] = {...v}; });
    const journey = ((V3_RECORD && V3_RECORD.journey) || []).slice();
    const prepared = [];
    decisions.forEach(decision=>{
      const p = ClubDecision.prepare({ state: working, journey, decision, today: reviewToday(), recordedAt });
      prepared.push(p);
      // Apply to the working copy so the next event is prepared against the
      // state it will meet, and cannot be refused as a same-day duplicate.
      RatingEngine.applyStateEvent(working, p.event);
      journey.push(p.event);
    });
    reviewPending = prepared;
    reviewMessage = '';
  } catch(e){
    reviewPending = null;
    reviewMessage = e.message;
  }
  renderManage();
}

async function commitReviewDecision(){
  const list = reviewPending;
  if(!list || !list.length) return;
  if(!db){ reviewMessage = 'No database connection — nothing was written.'; renderManage(); return; }
  const btn = document.getElementById('reviewConfirmBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Recording…'; }
  try {
    const backend = RatingStore.firestoreCompatBackend(db);
    // In order: the tier move, then the rating decision that completes it.
    for(const p of list){ await ClubDecision.commit(backend, p); }
    reviewPending = null;
    reviewDraft = null;
    reviewSnapshotCache = null;
    // Re-read rather than patch local state: the screen must show what is
    // actually stored, not what it believes it just stored.
    await loadV3State();
    reviewMessage = 'Recorded. ' + list.map(p=>p.summary).join(' ');
  } catch(e){
    reviewMessage = e.message;
  }
  dataChanged();
}
