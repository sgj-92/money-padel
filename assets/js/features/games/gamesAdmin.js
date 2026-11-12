// ===================== GAMES: ADMIN WRITE PATHS =====================
// Approving a submission (plan an append, confirm, write), rejecting,
// editing a pending submission, and the historical match correction /
// removal with its replay blast radius. These change the record, so they are
// functional code even though the Games screen shows their controls.
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: functional. Loads before app.js; declarations only.

// ===================== HISTORICAL MATCH CORRECTION =====================
// Admin-only. Repairs what happened ON COURT: a wrong score, the wrong players,
// a game that never happened. Deliberately separate from Historical Club
// Adjustment, which records what the club decided about a player's level.
//
// Editing a rated match changes the inputs to every rating that followed it, so
// there is no such thing as a small correction here: one June result re-derives
// the whole season. The blast radius is therefore shown in full, measured by
// replaying rather than estimated, before anything is written.
//
// The controls are behind the admin unlock. That is a UI gate rather than a
// security boundary -- beta storage is open by decision -- so what actually
// protects the record is that every correction is replayed, verified, and
// leaves the history reconstructible.

// ===================== GAMES TAB =====================
// Editing and deleting a rated game are not exposed. Both change the inputs to
// every rating that followed, so they need the replay-forward review screen,
// which is not built. The controls WERE here and were worse than missing: they
// persisted an edit/deletion overlay that no v3 read has looked at since the
// match source moved to the `matches` collection, so a confirmed delete left
// the game in place, the rating unchanged, and a hidden record behind that
// would desync a match from its rating if anything ever re-applied it.
// Approved by Shaun/CGPT in PROJECT_LEDGER.md Open Question 2.
const MATCH_CORRECTION_NOTE =
  'Correcting a rated game re-derives every rating that came after it. You will see exactly who moves before anything is written.';

// Which card's admin actions are open. One at a time: the Play tab is a
// results feed first, and the correction controls are maintenance that a
// reader should have to ask for rather than scroll past under every game.
let managingGameId = null;

let matchFixPlan = null;     // a planned correction awaiting confirmation

let matchFixMessage = '';

let matchFixBusy = false;

function matchFixReset(){ matchFixPlan = null; matchFixMessage = ''; managingGameId = null; }

// The date is part of the match's identity: ids are `YYYY-MM-DD-N`, and letting
// an edit change it would leave the identifier describing a day the match no
// longer belongs to. Correcting a date is a removal and a re-entry, which the
// Admin can do as two deliberate steps.
// A game moved to another date gets a new identifier (it is built from the
// date: YYYY-MM-DD-N). What refers to the game by identifier follows it: who
// submitted it, and an Upcoming game it was reconciled with. Their history
// lines keep the identifier they were written with.
async function carryMatchIdentity(oldId, newId){
  if(MatchNote.forMatch(matchNotesState, oldId)){
    matchNotesState = MatchNote.carried(matchNotesState, oldId, newId);
    await saveMatchNotes(matchNotesState);
  }
  if(matchAttributionState && matchAttributionState[oldId]){
    const next = { ...matchAttributionState, [newId]: { ...matchAttributionState[oldId], matchId: newId } };
    delete next[oldId];
    matchAttributionState = next;
    await saveMatchAttribution(matchAttributionState);
  }
  let touched = false;
  (gameRequestsState || []).forEach(r => {
    if(r.playedMatchId === oldId){ r.playedMatchId = newId; touched = true; }
    if(Array.isArray(r.notResults) && r.notResults.includes(oldId)){ r.notResults = r.notResults.map(x => x === oldId ? newId : x); touched = true; }
  });
  if(touched) await saveGameRequests(gameRequestsState);
}

// ---- New players --------------------------------------------------------------
// A player enters the rating record with their first rated game. The rating
// engine will not rate anyone it has never seen, and the record has no other
// way in: Admin › Player tags › "Add a new player" only names them and their
// starting tier. So when a game being approved (or corrected) includes a
// player the record does not know, their entry is planned with it and written
// in the same commit -- at the tier set there, on the date of that first
// game, as the record's seed did for everyone. They enter PROVISIONAL
// (UNKNOWN_NEW_PLAYER), the record's status for a player whose starting tier
// is the club's judgement: the rating is the tier baseline either way, and it
// leaves the one-off starting-tier correction open in Club Decisions.
// `proposed` is the starting tiers a submission carries for its new players
// (gamesSubmit.js); the club's tier list wins where it already names them.
function newPlayerTier(name, proposed){
  const lookup = (map) => {
    const key = Object.keys(map || {}).find(k => k.toLowerCase() === String(name).toLowerCase());
    return key ? map[key] : null;
  };
  const tagged = lookup(tagOverridesState);
  const t = (tagged && tagged.tier) || lookup(proposed);
  return t && RatingEngine.TIER_SEED[t] !== undefined ? t : null;
}

function planIncludingNewPlayers(args, proposed){
  try {
    return ReplayForward.plan(args);
  } catch(e){
    if(!e.unseen || !e.unseen.length) throw e;
    const missing = e.unseen.filter(u => !newPlayerTier(u.playerId, proposed)).map(u => u.playerId);
    if(missing.length){
      throw new Error(`${missing.join(', ')} ${missing.length === 1 ? 'isn’t' : 'aren’t'} in the club yet. Add ${missing.length === 1 ? 'them' : 'each of them'} in More › Admin › Player tags › Add a new player, with a starting tier, then try again.`);
    }
    const initialisations = e.unseen.map(u => ({
      playerId: u.playerId, tier: newPlayerTier(u.playerId, proposed),
      classificationStatus: RatingEngine.CLASSIFICATION.PROVISIONAL,
      effectiveDate: u.firstDate, reasonCode: 'UNKNOWN_NEW_PLAYER',
    }));
    const planned = ReplayForward.plan({ ...args, change: { ...args.change, initialisations } });
    planned.newPlayers = initialisations.map(i => ({ ...i, rating: RatingEngine.TIER_SEED[i.tier] }));
    return planned;
  }
}

// One player's line in a "who moves" list. A new player has no rating to move
// from: they start at their tier's baseline.
function movedPlayerText(p, planned, html){
  const to = Math.round(p.to*10)/10;
  if(p.from === null || p.from === undefined){
    const n = ((planned && planned.newPlayers) || []).find(x => x.playerId === p.playerId);
    return `${p.playerId} (new${n ? ` · starts Tier ${n.tier} at ${n.rating}` : ''}) → ${to}`;
  }
  const d = `${p.delta>0?'+':''}${p.delta}`;
  return `${p.playerId} ${html ? `<span class="${p.delta>0?'perf-pos':'perf-neg'}">${d}</span>` : d} → ${to}`;
}

function newPlayersNoteHtml(planned){
  const list = (planned && planned.newPlayers) || [];
  if(!list.length) return '';
  return `<div class="section-sub" style="margin-top:4px; color:var(--gold-bright);">${list.map(n => `${escapeHtml(n.playerId)} joins the record here, in Tier ${n.tier} at ${n.rating}`).join('; ')}. The starting tier can be corrected once in Club Decisions if it turns out wrong.</div>`;
}

// A forfeit (Shaun, 7 Nov): the rated match as stored, with the player who
// quit on the losing side and his partner left untouched by the rating.
async function stageForfeit(matchId, quitterName){
  const raw = ((V3_RECORD && V3_RECORD.matches) || []).find(d => d.id === matchId);
  if(!raw){ matchFixMessage = 'That match is not in the record.'; renderGamesTab(); return; }
  const qid = playerIdFor(quitterName);
  const inA = raw.teamA.includes(qid);
  if(!inA && !raw.teamB.includes(qid)){ matchFixMessage = `${quitterName} did not play in this match.`; renderGamesTab(); return; }
  const sets = raw.sets.map(s => inA ? [s.teamB, s.teamA] : [s.teamA, s.teamB]);
  const teamA = inA ? raw.teamB.slice() : raw.teamA.slice();
  const teamB = inA ? raw.teamA.slice() : raw.teamB.slice();
  const unaffected = teamB.filter(n => n !== qid);
  const corrected = { id: raw.id, date: raw.date, sourceIndex: raw.sourceIndex, teamA, teamB, sets,
    outcome: RatingEngine.OUTCOME.A_WINS, type: raw.type || 'doubles', drawSideAssignmentArbitrary: false,
    forfeit: { by: qid, unaffected } };
  const show = (ids) => ids.map(id => (V3_STATE.players[id] && V3_STATE.players[id].displayName) || id).join(' & ');
  await stageMatchCorrection({ type: 'edit', match: corrected },
    `Forfeit on ${raw.date}: ${quitterName} quit. A loss for ${quitterName}${unaffected.length ? ` (${show(unaffected)} untouched)` : ''}, a win for ${show(teamA)}, at ${sets.map(s => s.join('-')).join(', ')}.`);
}

async function removeForfeit(matchId){
  const raw = ((V3_RECORD && V3_RECORD.matches) || []).find(d => d.id === matchId);
  if(!raw || !raw.forfeit) return;
  const corrected = { ...RatingStore.matchFromDoc(raw) };
  delete corrected.forfeit;
  await stageMatchCorrection({ type: 'edit', match: corrected },
    `Remove the forfeit on ${raw.date}: counted for all four players, as played.`);
}

// Late (Shaun, 11 Nov): the side with a late player starts a set down -- a
// set to the opponents, no games added. The match is stored at that result,
// turned round if the opponents now lead; the on-time partner keeps the match
// as played (late.playedOutcome, in the stored orientation).
async function stageLate(matchId, lateNames){
  const raw = ((V3_RECORD && V3_RECORD.matches) || []).find(d => d.id === matchId);
  if(!raw){ matchFixMessage = 'That match is not in the record.'; renderGamesTab(); return; }
  const ids = [...new Set(lateNames.map(playerIdFor))];
  if(!ids.length){ matchFixMessage = 'Tick who was late.'; renderGamesTab(); return; }
  const inA = ids.filter(id => raw.teamA.includes(id)), inB = ids.filter(id => raw.teamB.includes(id));
  if(inA.length + inB.length !== ids.length){ matchFixMessage = 'Everyone ticked must have played in this match.'; renderGamesTab(); return; }
  if(inA.length && inB.length){ matchFixMessage = 'Tick late players from one side only: if both sides were late, neither starts a set down.'; renderGamesTab(); return; }
  const lateA = inA.length > 0;
  const O = RatingEngine.OUTCOME;
  const setsA = raw.sets.filter(s => s.teamA > s.teamB).length, setsB = raw.sets.filter(s => s.teamB > s.teamA).length;
  const cA = setsA + (lateA ? 0 : 1), cB = setsB + (lateA ? 1 : 0);
  const turn = cB > cA;
  const flip = (o) => o === O.A_WINS ? O.B_WINS : (o === O.B_WINS ? O.A_WINS : o);
  const teamA = turn ? raw.teamB.slice() : raw.teamA.slice();
  const teamB = turn ? raw.teamA.slice() : raw.teamB.slice();
  const sets = raw.sets.map(s => turn ? [s.teamB, s.teamA] : [s.teamA, s.teamB]);
  const outcome = cA === cB ? O.DRAW : O.A_WINS;
  const lateTeam = lateA ? raw.teamA : raw.teamB;
  const corrected = { id: raw.id, date: raw.date, sourceIndex: raw.sourceIndex, teamA, teamB, sets, outcome,
    type: raw.type || 'doubles', drawSideAssignmentArbitrary: outcome === O.DRAW,
    late: { by: ids, onTime: lateTeam.filter(n => !ids.includes(n)), playedOutcome: turn ? flip(raw.outcome) : raw.outcome } };
  const show = (list) => list.map(id => (V3_STATE.players[id] && V3_STATE.players[id].displayName) || id).join(' & ');
  const counted = outcome === O.DRAW ? `a draw, ${cA}–${cB} in sets` : `${Math.max(cA, cB)}–${Math.min(cA, cB)} to ${show(teamA)}`;
  const onTime = corrected.late.onTime;
  await stageMatchCorrection({ type: 'edit', match: corrected },
    `Late on ${raw.date}: ${show(ids)} arrived late, so the side starts a set down. Counted as ${counted}${onTime.length ? `; ${show(onTime)} rated on the match as played` : ''}.`);
}

async function removeLate(matchId){
  const raw = ((V3_RECORD && V3_RECORD.matches) || []).find(d => d.id === matchId);
  if(!raw || !raw.late) return;
  const O = RatingEngine.OUTCOME;
  const played = raw.late.playedOutcome;
  const turn = played === O.B_WINS;   // the record keeps a decided match's winners as Team A
  const corrected = { id: raw.id, date: raw.date, sourceIndex: raw.sourceIndex,
    teamA: turn ? raw.teamB.slice() : raw.teamA.slice(), teamB: turn ? raw.teamA.slice() : raw.teamB.slice(),
    sets: raw.sets.map(s => turn ? [s.teamB, s.teamA] : [s.teamA, s.teamB]),
    outcome: played === O.DRAW ? O.DRAW : O.A_WINS, type: raw.type || 'doubles', drawSideAssignmentArbitrary: played === O.DRAW };
  await stageMatchCorrection({ type: 'edit', match: corrected },
    `Remove the late penalty on ${raw.date}: counted for all four players, as played.`);
}

async function stageMatchCorrection(change, describe){
  matchFixBusy = true; matchFixMessage = 'Replaying…'; renderGamesTab();
  try {
    if(!db) throw new Error('No database connection.');
    const stored = await readStoredRecord(RatingStore.firestoreCompatBackend(db));
    const planned = planIncludingNewPlayers({
      stored, change,
      provenance: { createdBy: reviewActor(), recordedAt: new Date().toISOString(), source: 'Historical Match Correction' },
    });
    matchFixPlan = { ...planned, describe };
    matchFixMessage = '';
  } catch(e){
    matchFixPlan = null;
    // A diverged record is not this edit's fault and not this operator's
    // problem to read forty document ids about. It is recorded once and
    // described at the level the reader can act on.
    if(e.divergence){
      if(!healthReport && typeof HealthReport !== 'undefined'){
        let repair = null;
        try { repair = ReplayForward.planRepair(V3_RECORD || {}, {}); } catch(x){ /* optional */ }
        healthReport = HealthReport.buildReport({
          check: e.divergence, repair, record: V3_RECORD,
          seenBy: (currentUserName && currentUserName.trim()) || null,
        });
        await storeHealthReport(healthReport);
      }
      matchFixMessage = recordHealthMessage() || e.message;
    } else {
      matchFixMessage = e.message;
    }
  }
  matchFixBusy = false;
  renderGamesTab();
}

// Progress goes straight into the panel's own line rather than through
// renderGamesTab(), which would rebuild the whole feed on every tick.
function setMatchFixProgress(text){
  matchFixMessage = text;
  const el = document.getElementById('matchFixPanelMsg');
  if(el) el.textContent = text;
}

// The outcome has to outlive the thing that produced it. A removal deletes the
// match, so its card -- and the panel the button was in -- is gone from the
// feed by the time there is anything to report. The admin line at the top of
// the tab is where this used to be said, hundreds of pixels above an operator
// scrolled deep into a match card, which is indistinguishable from nothing
// happening at all.
function showMatchFixOutcome(text, failed){
  const id = 'matchFixOutcome';
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:78px;z-index:9998;'
    + `background:${failed ? '#5b1a17' : '#1d2a1c'};color:${failed ? '#ffd9d6' : '#d7f0d2'};`
    + `border:1px solid ${failed ? '#8a2a25' : '#3d5c38'};border-radius:10px;`
    + 'padding:12px 14px;font-size:13px;line-height:1.45;display:flex;gap:12px;align-items:flex-start;';
  const msg = document.createElement('div');
  msg.style.cssText = 'flex:1; min-width:0;';
  msg.textContent = text;
  const close = document.createElement('button');
  close.className = 'preset-btn';
  close.textContent = 'Dismiss';
  close.style.cssText = 'flex:0 0 auto; padding:4px 10px; font-size:12px;';
  close.onclick = ()=> el.remove();
  el.appendChild(msg); el.appendChild(close);
  document.body.appendChild(el);
  // A success can see itself out; a failure stays until it has been read.
  if(!failed) setTimeout(()=>{ if(document.getElementById(id) === el) el.remove(); }, 12000);
  return el;
}

async function commitMatchCorrection(){
  if(!matchFixPlan) return;
  // A removal and a correction are different actions and always said
  // differently -- sharing one wording is how "Corrected and replayed" ended
  // up reporting a deletion.
  const isRemoval = !!(matchFixPlan.change && matchFixPlan.change.type === 'delete');
  const verb = isRemoval ? 'Removing' : 'Correcting';
  matchFixBusy = true; matchFixMessage = verb + '…'; renderGamesTab();
  try {
    await ReplayForward.commit(RatingStore.firestoreCompatBackend(db), matchFixPlan, {
      onProgress: (done, total)=> setMatchFixProgress(
        done >= total ? 'Written. Re-reading the record…' : `${verb}… ${done} of ${total} documents`),
    });
    const what = matchFixPlan.describe;
    const ch = matchFixPlan.change;
    if(ch && ch.type === 'redate') await carryMatchIdentity(ch.matchId, ch.match.id);
    matchFixReset();
    editingMatchId = null;
    armedDeleteId = null;
    await loadV3State();
    matchFixMessage = (isRemoval ? 'Removed and replayed. ' : 'Corrected and replayed. ') + what;
    dataChanged();
    showMatchFixOutcome(matchFixMessage, false);
  } catch(e){
    matchFixMessage = (isRemoval ? 'Removal failed: ' : 'Write failed: ') + e.message;
    showMatchFixOutcome(matchFixMessage, true);
  }
  matchFixBusy = false;
  render();
  renderGamesTab();
}

function buildMatchFixConfirmHtml(){
  const p = matchFixPlan;
  if(!p) return '';
  const moved = p.playersMoved;
  // Removing a game and correcting one have different consequences and deserve
  // different words. Sharing one confirmation for both was how "Confirm
  // removal?" ended up sitting above a button reading "Correct and replay".
  const isRemoval = !!(p.change && p.change.type === 'delete');
  const isMove = !!(p.change && p.change.type === 'redate');
  const heading = isRemoval
    ? 'Confirm removal — this deletes the match and re-derives every rating after it'
    : (isMove ? 'Confirm new date — the game moves, and every rating from the earlier date is re-derived'
      : 'Confirm correction — this re-derives every rating after this game');
  const commitLabel = isRemoval ? 'Remove and replay' : 'Correct and replay';
  const nobody = isRemoval
    ? 'Nobody — removing this match changes no rating.'
    : 'Nobody — this correction changes no rating.';
  return `<div class="callout-card" style="padding:12px; margin-top:8px; border-color:${isRemoval ? 'var(--red)' : 'var(--gold-dim)'};">
    <div style="font-weight:700; color:${isRemoval ? '#e8a5a1' : 'var(--gold-bright)'};">${heading}</div>
    <div class="section-sub" style="margin-top:4px; color:var(--text);">${p.describe}</div>
    ${isMove ? `<div class="section-sub" style="font-size:10.5px;">It becomes <code>${escapeHtml(p.change.match.id)}</code> (was <code>${escapeHtml(p.change.matchId)}</code>) — a game's identifier carries its date. Who submitted it, and any Upcoming game it settled, move with it.</div>` : ''}
    <div class="section-sub" style="font-size:10.5px;">${p.documentsToWrite} documents rewritten, ${p.documentsToDelete} removed. Nothing is silently dropped: the record is replayed from the ${isRemoval ? 'remaining' : 'corrected'} history and verified afterwards.</div>
    <div class="section-sub" style="margin-top:6px; font-weight:700; color:var(--text);">${moved.length} player${moved.length===1?'':'s'} end on a different rating</div>
    <div class="section-sub" style="font-size:10.5px; max-height:160px; overflow:auto;">${moved.length ? moved.map(m=>movedPlayerText(m, p, false)).join(' &nbsp;·&nbsp; ') : nobody}</div>
    ${newPlayersNoteHtml(p)}
    <div class="difficulty-row" style="margin-top:8px;">
      <button class="preset-btn${isRemoval ? ' match-action-destructive' : ''}" id="matchFixCommitBtn" style="flex:1;" ${matchFixBusy?'disabled':''}>${matchFixBusy ? 'Working…' : commitLabel}</button>
      <button class="preset-btn" id="matchFixCancelBtn" style="flex:1;" ${matchFixBusy?'disabled':''}>Cancel</button>
    </div>
    <div id="matchFixPanelMsg" class="section-sub" style="margin-top:6px; min-height:14px; color:var(--gold-bright);">${matchFixBusy ? matchFixMessage : ''}</div>
  </div>`;
}

// The game a staged correction is about, so its card can stay put.
function matchFixGameId(){
  const c = matchFixPlan && matchFixPlan.change;
  return c ? (c.matchId || (c.match && c.match.id) || null) : null;
}

function wireMatchFix(){
  const c = document.getElementById('matchFixCommitBtn');
  // Confirming closes the editor: back to where it was opened.
  if(c) c.onclick = ()=>{ const id = matchFixGameId(); return closeGameEditor(id, commitMatchCorrection); };
  const x = document.getElementById('matchFixCancelBtn');
  if(x) x.onclick = ()=>{ const id = matchFixGameId(); withGameAnchor(id, ()=>{ matchFixReset(); renderGamesTab(); }); };
}

// Approving a game means RATING it: it joins the v3 record, the four players'
// ratings move, and it appears in the history like any other match.
//
// It used to mean setting status='approved' in browser storage, which no
// v3 read has looked at since the match source moved to the `matches`
// collection. The game did not enter the record, was never rated, and dropped
// out of the pending list -- so it vanished. Approving is now a real write.
//
// Appending is forward-only: a match at the end of the sequence extends it and
// touches nothing before it. That is why this needs no replay of history, even
// though it goes through the same module that does.
let approvalPlan = null;   // a prepared append awaiting confirmation

let approvalMessage = '';

function nextMatchIdFor(date){
  const sameDay = V3_MATCHES.filter(m => m.date === date);
  const used = sameDay.map(m => {
    const n = Number(String(m.id).slice(date.length + 1));
    return Number.isFinite(n) ? n : 0;
  });
  return `${date}-${(used.length ? Math.max(...used) : 0) + 1}`;
}

// The pending submission in the engine's own shape. Team A is the winning side
// for a decided match, which is the convention the whole record uses.
function pendingToEngineMatch(m, id){
  return {
    id,
    date: m.date,
    sourceIndex: Number(id.slice(m.date.length + 1)),
    // Back to identities before this reaches the record.
    teamA: m.winners.map(playerIdFor),
    teamB: m.losers.map(playerIdFor),
    sets: m.sets,
    outcome: m.isDraw ? RatingEngine.OUTCOME.DRAW : RatingEngine.OUTCOME.A_WINS,
    type: m.type || 'doubles',
    drawSideAssignmentArbitrary: !!m.isDraw,
  };
}

// Plans the append and holds it. Nothing is written here: the operator sees
// which players move, and by how much, before agreeing to it.
async function prepareApproval(id){
  approvalPlan = null; approvalMessage = '';
  const name = requireName();
  if(!name) return;
  const m = extraMatchesState.find(x=>x.id===id);
  if(!m){ approvalMessage = 'That submission is no longer there.'; renderGamesTab(); return; }
  if(!db){ approvalMessage = 'No database connection — nothing can be rated.'; renderGamesTab(); return; }

  approvalMessage = 'Reading the record…';
  renderGamesTab();
  try {
    const backend = RatingStore.firestoreCompatBackend(db);
    const stored = await readStoredRecord(backend);
    const matchId = nextMatchIdFor(m.date);
    const planned = planIncludingNewPlayers({
      stored,
      change: { type: 'append', match: pendingToEngineMatch(m, matchId) },
      provenance: { createdBy: name, recordedAt: new Date().toISOString(), source: 'Approved from a submission' },
    }, m.newPlayerTiers);
    // Upcoming games this result might be. Candidates only: an admin says
    // which one, if any, before the game is rated. Same four players on
    // their own never close a fixture (D3).
    const fixtureCandidates = FixtureFlow.candidatesForResult(
      { id: matchId, date: m.date, winners: m.winners, losers: m.losers },
      gameRequestsState, { canon: playerIdFor, proposedFixtureId: m.fixtureId || null })
      .map(c => ({ id: c.fixture.id, reasons: c.reasons }));
    approvalPlan = { submissionId: id, matchId, planned, approvedBy: name,
      newPlayerTiers: m.newPlayerTiers || null,
      fixtureCandidates, fixtureChoice: null,
      result: { date: m.date, winners: m.winners.slice(), losers: m.losers.slice(), sets: m.sets, isDraw: !!m.isDraw } };
    approvalMessage = '';
  } catch(e){
    approvalMessage = e.message;
  }
  renderGamesTab();
}

async function commitApproval(){
  const a = approvalPlan;
  if(!a) return;
  if(a.fixtureCandidates && a.fixtureCandidates.length && !a.fixtureChoice){
    approvalMessage = 'Say whether this result belongs to one of the listed games first.';
    renderGamesTab();
    return;
  }
  approvalMessage = 'Rating it…';
  renderGamesTab();
  try {
    await ReplayForward.commit(RatingStore.firestoreCompatBackend(db), a.planned);
    // Who submitted it goes with the game: the rating record has no place for
    // it, and the submission is about to go (matchAttribution.js).
    const submission = extraMatchesState.find(x => x.id === a.submissionId);
    matchAttributionState = { ...matchAttributionState,
      [a.matchId]: MatchAttribution.entryFor(submission, { matchId: a.matchId, approvedBy: a.approvedBy, approvedAt: new Date().toISOString() }) };
    await saveMatchAttribution(matchAttributionState);
    // Only once it is safely in the record: the submission has served its
    // purpose and must not linger as a second copy of the same game.
    extraMatchesState = extraMatchesState.filter(x => x.id !== a.submissionId);
    await saveExtraMatches(extraMatchesState);
    // The new players the submission brought, onto the club's tier list at
    // the tier they were rated from.
    const joined = ((a.planned && a.planned.newPlayers) || []).filter(n => !Object.keys(tagOverridesState).some(k => k.toLowerCase() === n.playerId.toLowerCase()));
    if(joined.length){
      joined.forEach(n => { tagOverridesState[n.playerId] = { tier: n.tier, active: true }; });
      await saveTagOverrides(tagOverridesState);
    }
    approvalPlan = null;
    // The admin's answer about Upcoming, applied only now the game is safely
    // in the record. The chosen fixture becomes played and names this result;
    // every other candidate remembers it was not this one.
    let fixtureNote = '';
    if(a.fixtureCandidates && a.fixtureCandidates.length){
      a.fixtureCandidates.forEach(c => {
        const f = gameRequestsState.find(r => r.id === c.id);
        if(!f) return;
        if(c.id === a.fixtureChoice) FixtureFlow.reconcile(f, { isAdmin: true, resultId: a.matchId, by: a.approvedBy });
        else FixtureFlow.keepOutstanding(f, { isAdmin: true, resultId: a.matchId, by: a.approvedBy });
      });
      const saved = await saveGameRequests(gameRequestsState);
      fixtureNote = !saved ? ' The fixture link could not be saved — reconcile it from the fixture card.'
        : (a.fixtureChoice && a.fixtureChoice !== 'none' ? ' Its fixture is marked played.' : ' Fixtures left as they were.');
    }
    await loadV3State();
    approvalMessage = `Rated as ${a.matchId}. ${a.planned.playersMoved.map(p=>movedPlayerText(p, a.planned, false)).join(', ')}.${fixtureNote}`
      + ` ${scorecardButtonHtml(a.matchId)}`;
  } catch(e){
    approvalMessage = 'Nothing was rated: ' + e.message;
  }
  // After the message is composed, so the screen is drawn holding it.
  dataChanged();
}

function buildApprovalConfirmHtml(){
  const a = approvalPlan;
  if(!a) return '';
  return `<div class="callout-card" style="padding:12px; margin-top:8px; border-color:var(--gold-dim);">
    <div style="font-weight:700; color:var(--gold-bright);">Confirm — this rates the game</div>
    <div class="section-sub" style="margin-top:4px;">It joins the record as <code>${a.matchId}</code> and moves these ratings:</div>
    <div class="section-sub" style="color:var(--text);">${a.planned.playersMoved.map(p=>movedPlayerText(p, a.planned, true)).join(' &nbsp;·&nbsp; ')}</div>
    ${newPlayersNoteHtml(a.planned)}
    <div class="section-sub" style="font-size:10.5px;">${a.planned.documentsToWrite} documents. Nothing already in the record is rewritten — a new game only extends the sequence.</div>
    ${approvalFixtureChoiceHtml(a)}
    <div class="difficulty-row" style="margin-top:8px;">
      <button class="preset-btn" id="approveConfirmBtn" style="flex:1;"${a.fixtureCandidates && a.fixtureCandidates.length && !a.fixtureChoice ? ' disabled' : ''}>Rate it</button>
      <button class="preset-btn" id="approveCancelBtn" style="flex:1;">Cancel</button>
    </div>
  </div>`;
}

// Does this result belong to an agreed game? Asked only when there is a
// credible candidate, answered by the admin, and nothing is chosen for them.
function approvalFixtureChoiceHtml(a){
  const cands = (a.fixtureCandidates || []).map(c => ({ ...c, fixture: gameRequestsState.find(r => r.id === c.id) })).filter(c => c.fixture);
  if(!cands.length) return '';
  const r = a.result;
  const score = (r.sets && r.sets.length) ? r.sets.map(([x,y]) => `${x}-${y}`).join(', ') : '';
  const option = (value, body) => `<label class="fx-choice${a.fixtureChoice === value ? ' is-chosen' : ''}">
      <input type="radio" name="fxChoice" value="${escapeHtml(value)}"${a.fixtureChoice === value ? ' checked' : ''}> <span>${body}</span></label>`;
  return `<div class="fx-reconcile" style="margin-top:10px;">
    <div class="fx-reconcile-q">Does this result belong to ${cands.length === 1 ? `this ${fixtureStageWord(cands[0].fixture)}` : 'one of these games'}?</div>
    <div class="fx-reconcile-label">Result entered</div>
    <div>${escapeHtml(r.date)} · ${r.winners.map(escapeHtml).join(' &amp; ')} ${r.isDraw ? 'drew with' : 'def'} ${r.losers.map(escapeHtml).join(' &amp; ')}${score ? ' · ' + escapeHtml(score) : ''}</div>
    <div class="fx-reconcile-label" style="margin-top:8px;">Possible ${cands.length === 1 ? 'match' : 'matches'}</div>
    ${cands.map(c => {
      const f = c.fixture;
      const sum = FixtureFlow.summaryLine(f, requestTeams);
      return option(c.id, `<b>This was the game:</b> ${escapeHtml(sum.title)} · ${escapeHtml(sum.when)} · requested by ${escapeHtml(f.requestedBy)}<br><span class="fx-reconcile-why">${c.reasons.map(escapeHtml).join(' · ')}</span>`);
    }).join('')}
    ${option('none', cands.length === 1 ? `<b>${(w => w[0].toUpperCase() + w.slice(1))(fixtureStageWord(cands[0].fixture))} is still outstanding</b> — this result is a different game` : '<b>None</b> — still outstanding / unrelated result')}
  </div>`;
}

async function rejectMatch(id){
  const name = requireName();
  if(!name) return;
  extraMatchesState = extraMatchesState.filter(x=>x.id!==id);
  const ok = await saveExtraMatches(extraMatchesState);
  if(!ok){ document.getElementById('gamesMessage').textContent = storageAvailable() ? `Save failed (${lastStorageError || 'unknown error'}) — try again.` : `Save failed — this page can't reach shared storage. Open the actual published/shared claude.ai link, not a downloaded file.`;; return; }
  dataChanged();
}

// Deleting a PENDING submission is real: it is not in the record, so removing
// it removes it. Deleting a RATED game is refused rather than recorded -- the
// old path pushed an id into deletedIdsState, saved it, and changed nothing,
// which looked exactly like success.
async function deleteMatch(id){
  const name = requireName();
  if(!name) return;
  const pendingMatch = extraMatchesState.find(x=>x.id===id && x.status==='pending');
  if(!pendingMatch){
    // A rated game is removed by replaying the record without it, not by
    // hiding it. Nothing is written until the blast radius is confirmed.
    const m = MATCHES.find(x=>x.id===id) || getDisplayMatches().find(x=>x.id===id);
    await stageMatchCorrection({ type: 'delete', matchId: id },
      `Remove ${m ? `${m.winners.join(' & ')} vs ${m.losers.join(' & ')} on ${m.date}` : id} from the record.`);
    return;
  }
  extraMatchesState = extraMatchesState.filter(x=>x.id!==id);
  await saveExtraMatches(extraMatchesState);
  armedDeleteId = null;
  dataChanged();
}

function findMatchById(id){
  return getDisplayMatches().find(m=>m.id===id);
}

function buildEditFormHtml(id){
  const m = findMatchById(id);
  if(!m) return '';
  const isSingles = m.type === 'singles';
  const isDraw = !!m.isDraw;
  return `<div class="section-heading">✏️ Edit game</div>
  <div class="fg-controls">
    <div class="fg-row"><label class="fg-label">Date</label><input id="edDate" type="date" class="fg-select" value="${m.date}" /></div>
    <div class="fg-row"><label class="fg-label">Match type</label>
      <div class="fg-toggle" id="edTypeToggle">
        <button class="fg-toggle-btn ${!isSingles?'active':''}" data-type="doubles">Doubles</button>
        <button class="fg-toggle-btn ${isSingles?'active':''}" data-type="singles">Singles</button>
      </div>
    </div>
    <div class="fg-row"><label class="fg-label">Outcome</label>
      <div class="fg-toggle" id="edOutcomeToggle">
        <button class="fg-toggle-btn ${!isDraw?'active':''}" data-outcome="decisive">Finished</button>
        <button class="fg-toggle-btn ${isDraw?'active':''}" data-outcome="draw">Not finished / draw</button>
      </div>
    </div>
    <div class="fg-row"><label class="fg-label" id="edTeamALabel">Team A${isDraw?'':' (winners)'}</label>
      <input id="edA1" list="playerNamesList2" class="fg-select" style="margin-bottom:6px;" value="${m.winners[0]||''}" />
      <input id="edA2" list="playerNamesList2" class="fg-select" value="${m.winners[1]||''}" style="${isSingles?'display:none;':''}" />
    </div>
    ${swapTeamsButtonHtml('edSwapTeams')}
    <div class="fg-row"><label class="fg-label" id="edTeamBLabel">Team B${isDraw?'':' (losers)'}</label>
      <input id="edB1" list="playerNamesList2" class="fg-select" style="margin-bottom:6px;" value="${m.losers[0]||''}" />
      <input id="edB2" list="playerNamesList2" class="fg-select" value="${m.losers[1]||''}" style="${isSingles?'display:none;':''}" />
    </div>
    <datalist id="playerNamesList2">${entryPlayerNames().map(n=>`<option value="${n}">`).join('')}</datalist>
    <div class="fg-row"><label class="fg-label">Set scores</label><div id="edSets"></div></div>
    <div class="fg-row" style="display:flex; gap:8px;">
      <button class="tab-btn active" id="edSubmit" style="flex:1;">Save changes</button>
      <button class="preset-btn" id="edCancel" style="flex:1;">Cancel</button>
    </div>
    <div id="edMessage" class="section-sub"></div>
  </div>`;
}

let editSets = [];

function renderEditSets(){
  const box = document.getElementById('edSets');
  if(!box) return;
  box.innerHTML = editSets.map((s,i)=>`
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
      <input type="number" min="0" max="30" value="${s[0]}" data-idx="${i}" data-side="0" class="ed-set-input fg-select" style="width:70px;" />
      <span style="color:var(--text-dim);">–</span>
      <input type="number" min="0" max="30" value="${s[1]}" data-idx="${i}" data-side="1" class="ed-set-input fg-select" style="width:70px;" />
      ${editSets.length>1 ? `<button class="preset-btn" data-ed-remove="${i}" style="margin-left:auto;">Remove</button>` : ''}
    </div>
  `).join('') + `<button class="preset-btn" id="edAddSet" style="margin-top:4px;">+ Add set</button>`;
  box.querySelectorAll('.ed-set-input').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const idx = parseInt(e.target.dataset.idx), side = parseInt(e.target.dataset.side);
      editSets[idx][side] = parseInt(e.target.value) || 0;
    });
  });
  box.querySelectorAll('[data-ed-remove]').forEach(btn=>{
    btn.onclick = ()=>{ editSets.splice(parseInt(btn.dataset.edRemove),1); renderEditSets(); };
  });
  const addBtn = document.getElementById('edAddSet');
  if(addBtn) addBtn.onclick = ()=>{ if(editSets.length<5){ editSets.push([0,0]); renderEditSets(); } };
}

function wireEditForm(id){
  const m = findMatchById(id);
  if(!m) return;
  editSets = m.sets.map(s=>[...s]);
  renderEditSets();

  document.querySelectorAll('#edTypeToggle .fg-toggle-btn').forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll('#edTypeToggle .fg-toggle-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const isSingles = b.dataset.type==='singles';
      document.getElementById('edA2').style.display = isSingles ? 'none' : 'block';
      document.getElementById('edB2').style.display = isSingles ? 'none' : 'block';
    };
  });

  document.getElementById('edSwapTeams').onclick = ()=>{
    swapTeamInputs('ed');
    editSets = editSets.map(x => [x[1], x[0]]);
    renderEditSets();
  };

  document.querySelectorAll('#edOutcomeToggle .fg-toggle-btn').forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll('#edOutcomeToggle .fg-toggle-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const isDraw = b.dataset.outcome === 'draw';
      document.getElementById('edTeamALabel').textContent = isDraw ? 'Team A' : 'Team A (winners)';
      document.getElementById('edTeamBLabel').textContent = isDraw ? 'Team B' : 'Team B (losers)';
    };
  });

  // Cancel returns the reader to where they opened the editor (gamesScreen.js).
  document.getElementById('edCancel').onclick = ()=> closeGameEditor(id, ()=>{ editingMatchId = null; renderGamesTab(); });

  // Save: a pending submission is saved and closed, and the reader returns to
  // where they started; a rated game stages its correction in the same card,
  // which stays put while the reader confirms (wireMatchFix).
  document.getElementById('edSubmit').onclick = ()=> closeGameEditor(id, async ()=>{
    const name = requireName();
    if(!name) return;
    const msg = document.getElementById('edMessage');
    const date = document.getElementById('edDate').value;
    const isSingles = document.querySelector('#edTypeToggle .fg-toggle-btn.active').dataset.type === 'singles';
    const isDraw = document.querySelector('#edOutcomeToggle .fg-toggle-btn.active').dataset.outcome === 'draw';
    const a1 = document.getElementById('edA1').value.trim();
    const a2 = document.getElementById('edA2').value.trim();
    const b1 = document.getElementById('edB1').value.trim();
    const b2 = document.getElementById('edB2').value.trim();
    if(!date || !a1 || !b1 || (!isSingles && (!a2||!b2))){ msg.textContent='Fill in all fields.'; return; }
    const winners = isSingles ? [a1] : [a1,a2];
    const losers = isSingles ? [b1] : [b1,b2];
    const sets = editSets.filter(s=>!isNaN(s[0]) && !isNaN(s[1]));
    if(sets.length===0){ msg.textContent='Enter at least one set.'; return; }
    if(!isDraw){
      const setsWon = sets.filter(s=>s[0]>s[1]).length, setsLost = sets.filter(s=>s[1]>s[0]).length;
      if(setsWon < setsLost){ msg.textContent="Team A's scores should be the winning side, or mark this as not finished / a draw."; return; }
    }

    const editedFields = {date, winners, losers, sets, type: isSingles?'singles':'doubles', isDraw,
                           editedBy: name, editedAt: new Date().toISOString()};

    const pendingMatch = extraMatchesState.find(x=>x.id===id && x.status==='pending');
    if(pendingMatch){
      Object.assign(pendingMatch, {date, winners, losers, sets, type: isSingles?'singles':'doubles', isDraw});
      const ok = await saveExtraMatches(extraMatchesState);
      if(!ok){ msg.textContent='Save failed.'; return; }
    } else {
      // A new date means a new identifier: the game is moved, not refused
      // (Shaun, 27 Oct: change the date and let the system work it out).
      const moving = date !== m.date;
      const newId = moving ? nextMatchIdFor(date) : m.id;
      const corrected = {
        id: newId,
        date,
        sourceIndex: Number(String(newId).slice(date.length + 1)) || 1,
        // The record's own identities: the form shows display names, and a
        // renamed player (Stormzy, shown as "Stormz") is still filed under
        // their identity (12 Nov: the save was refused as a new player).
        teamA: winners.map(n => playerIdFor(canonicalPlayerName(n))), teamB: losers.map(n => playerIdFor(canonicalPlayerName(n))), sets,
        outcome: isDraw ? RatingEngine.OUTCOME.DRAW : RatingEngine.OUTCOME.A_WINS,
        type: isSingles ? 'singles' : 'doubles',
        drawSideAssignmentArbitrary: !!isDraw,
      };
      const what = `${winners.join(' & ')} vs ${losers.join(' & ')}, ${sets.map(x=>x.join('-')).join(', ')}${isDraw ? ' (draw)' : ''}`;
      await stageMatchCorrection(moving ? { type: 'redate', matchId: m.id, match: corrected } : { type: 'edit', match: corrected },
        moving ? `Move from ${m.date} to ${date}: ${what}.` : `Correct ${m.date}: ${what}.`);
      return;
    }
    editingMatchId = null;
    dataChanged();
  });
}
