// ===================== PLAYER OF THE MONTH: SCREENS =====================
// Admin / Manage › Player of the Month, and what everyone sees of it.
//
// Admin's flow for a finished month:
//   the app's recommended cases (each with its reasons and figures)
//   → remove any, add any other qualified player
//   → Finalise shortlist (saved; everyone can now see it and vote in WhatsApp)
//   → pick the winner of the vote, check the citation, Confirm
//   → the month joins the Player of the Month history, fixed.
//
// The cards are listed by name. Nothing here numbers the candidates or calls
// one the favourite: the shortlist is the strongest cases, and the group
// decides between them.
//
// Owning stream: functional (the card look is the redesign's to restyle).
// Loads before app.js; declarations only.

let potmMonth = null;        // the month open in Admin
let potmDraft = null;        // { month, entries } -- the shortlist being edited
let potmPick = null;         // { month, playerId, citation } -- the winner being confirmed
let potmAsk = null;          // 'confirm' | 'reopen' -- a question waiting for an answer
let potmBusy = false;
let potmMessage = null;      // { text, ok }

// The figures under a card's reasons -- the same four on every card
// (PlayerOfMonth.supportLine), so the group can compare cases at a glance.
function potmMetricsLine(m){ return PlayerOfMonth.supportLine(m); }

// A nomination card. The nomination leads: name and tier, then each reason as
// a label and one sentence about what the player did, then a short row of
// figures. `admin` adds what only Admin needs -- who added the player, the
// reasons not shown, and the controls, kept small and last.
function potmCardHtml(card, { admin = false, remove = false, pick = false, picked = false, compact = false } = {}){
  const name = potmNameOf(card.playerId) || card.name;
  const reasons = (card.stories || []).map(s => `<div class="potm-reason" data-potm-reason="${escapeHtml(s.key)}">
      <div class="potm-reason-title">${escapeHtml(s.title)}</div>
      <div class="potm-reason-line">${escapeHtml(s.line)}${s.evidence ? ` <span class="potm-reason-ev">${escapeHtml(s.evidence)}</span>` : ''}</div>
    </div>`).join('');
  const support = card.support || potmMetricsLine(card.metrics);
  const also = admin && card.alsoTitles && card.alsoTitles.length ? `<div class="potm-also">Also: ${escapeHtml(card.alsoTitles.join(' · '))}</div>` : '';
  return `<div class="potm-card${admin ? ' is-admin' : ''}${picked ? ' is-picked' : ''}" data-potm-card="${escapeHtml(card.playerId)}">
    <div class="potm-card-head">
      <span class="potm-name">${escapeHtml(name)}</span>
      ${card.tier ? `<span class="potm-tier">Tier ${escapeHtml(card.tier)}</span>` : ''}
      ${admin && card.source === 'admin' ? `<span class="potm-added">Added by Admin</span>` : ''}
    </div>
    ${reasons ? `<div class="potm-reasons">${reasons}</div>` : ''}
    ${also}
    ${compact || !support ? '' : `<div class="potm-support">${escapeHtml(support)}</div>`}
    ${remove || pick ? `<div class="potm-card-actions">
      ${pick ? `<button type="button" class="potm-action potm-pick${picked ? ' active' : ''}" data-potm-pick="${escapeHtml(card.playerId)}" aria-pressed="${picked}">${picked ? '✓ Won the vote' : 'Won the vote?'}</button>` : ''}
      ${remove ? `<button type="button" class="potm-action potm-remove" data-potm-remove="${escapeHtml(card.playerId)}">Remove</button>` : ''}
    </div>` : ''}
  </div>`;
}

// ---- The nominees as one picture, for the group's WhatsApp -----------------
// Painted by CardPainter.nominees from the same cards the screen shows (the
// players' version: no Admin extras), and shared through the phone's share
// sheet like the Match Result Card. What is shared is the finalised
// shortlist, or -- before that -- Admin's current list.
let potmShare = { month: null, ready: null, message: '' };

function potmNomineesView(month, cards){
  const monthName = monthLabel(month).split(' ')[0];
  return {
    month: monthLabel(month),
    title: `${monthName} nominees`,
    sub: 'In no particular order. Cast your vote in the group!',
    foot: CLUB.name + ' recommends · the group chooses',
    cards: cards.map(c => ({
      name: potmNameOf(c.playerId) || c.name,
      tier: c.tier || null,
      reasons: (c.stories || []).map(r => ({ title: r.title, line: r.line })),
      support: c.support || potmMetricsLine(c.metrics),
    })),
  };
}

function potmShareCards(month){
  return potmShortlistOf(month) || (potmDraft && potmDraft.month === month ? potmDraft.entries : []);
}

function potmShareHtml(month){
  if(!potmShareCards(month).length) return '';
  const mine = potmShare.month === month;
  return `<div class="potm-share-row">
    <button type="button" class="preset-btn potm-share" data-potm-share="${month}">${mine && potmShare.ready ? 'Tap to share' : '📷 Share nominees picture'}</button>
    ${mine && potmShare.message ? `<div class="section-sub potm-share-msg">${escapeHtml(potmShare.message)}</div>` : ''}
  </div>`;
}

async function sharePotmNominees(month, redraw){
  const say = (message) => { potmShare.message = message; if(redraw) redraw(); };
  if(potmShare.month !== month) potmShare = { month, ready: null, message: '' };
  try {
    let pending = potmShare.ready;
    if(!pending){
      const cards = potmShareCards(month);
      if(!cards.length) return;
      const view = potmNomineesView(month, cards);
      const brand = await CardPainter.loadImage(CLUB.logo);
      const cv = CardPainter.nominees(view, { brand });
      pending = {
        files: [await CardPainter.toFile(cv, `${CLUB.fileSlug}-player-of-the-month-${month}-nominees.png`)],
        meta: { title: `${view.month} Player of the Month nominees`,
          text: `Player of the Month — ${view.title}: ${view.cards.map(c => c.name).join(', ')}. Cast your vote!` },
      };
    }
    const outcome = await CardPainter.share(pending.files, pending.meta);
    potmShare.ready = outcome === 'ready' ? pending : null;
    say(outcome === 'shared' ? 'Shared.' : outcome === 'saved' ? 'Saved to this device — post it from your photos.' : '');
  } catch(e){
    potmShare.ready = null;
    say('Could not make the picture: ' + (e && e.message ? e.message : String(e)));
  }
}

function wirePotmShare(box, redraw){
  box.querySelectorAll('[data-potm-share]').forEach(b => { b.onclick = () => sharePotmNominees(b.dataset.potmShare, redraw); });
}

function potmHistoryHtml(){
  const hist = potmHistory();
  if(!hist.length) return `<div class="section-sub">No winners confirmed yet.</div>`;
  let html = '';
  let year = null;
  hist.forEach(a => {
    if(a.year !== year){ year = a.year; html += `<div class="potm-year">${escapeHtml(year)}</div>`; }
    html += `<div class="potm-hist-row" data-potm-month="${a.month}">
      <span class="potm-hist-month">${escapeHtml(a.label.split(' ')[0])}</span>
      <span class="potm-hist-name">${escapeHtml(a.name)}</span>
      <span class="potm-hist-title">${escapeHtml(a.title || '')}</span>
    </div>`;
  });
  return `<div class="potm-history">${html}</div>`;
}

// ---- Admin ------------------------------------------------------------------

function potmOpenMonth(month){
  potmMonth = month;
  potmDraft = null; potmPick = null; potmAsk = null; potmMessage = null;
}

function potmDraftFor(month, rec){
  if(potmDraft && potmDraft.month === month) return potmDraft;
  potmDraft = { month, entries: rec.candidates.map(c => ({ ...c, source: PlayerOfMonth.SOURCE.RECOMMENDED })) };
  return potmDraft;
}

function buildPotmSectionHtml(){
  const months = potmMonths();
  let html = `<div class="section-sub">${CLUB.name} suggests the month's strongest cases; the group chooses the winner. Each candidate is here for a reason you can read — they are listed by name, not ranked. Players need ${PlayerOfMonth.MIN_MATCHES} matches in the month to be considered.</div>`;
  if(!months.length) return html + `<div class="section-sub">No rated months yet.</div>`;
  if(!potmMonth || !months.includes(potmMonth)) potmOpenMonth(months.find(potmMonthComplete) || months[0]);
  const month = potmMonth;
  const label = monthLabel(month);
  html += `<div class="fg-controls"><div class="fg-row"><label class="fg-label" for="potmMonth">Month</label>
    <select id="potmMonth" class="fg-select">${months.map(m => {
      const r = potmRecordFor(m);
      const tag = PlayerOfMonth.isConfirmed(r) ? ` — ${r.winner.name}` : (r ? ' — shortlist out' : '');
      return `<option value="${m}" ${m === month ? 'selected' : ''}>${monthLabel(m)}${escapeHtml(tag)}</option>`;
    }).join('')}</select></div></div>`;
  if(potmMessage) html += `<div class="section-sub potm-message${potmMessage.ok ? '' : ' is-error'}" id="potmMessage">${escapeHtml(potmMessage.text)}</div>`;

  const record = potmRecordFor(month);
  const complete = potmMonthComplete(month);

  if(PlayerOfMonth.isConfirmed(record)){
    const w = record.winner;
    html += `<div class="potm-winner" id="potmWinner">
      <div class="potm-winner-kicker">${escapeHtml(label)} Player of the Month</div>
      <div class="potm-winner-name">${escapeHtml(potmNameOf(w.playerId) || w.name)}</div>
      <div class="potm-winner-citation">${escapeHtml(w.citation)}</div>
      <div class="potm-support">${escapeHtml(potmMetricsLine(w.metrics))}</div>
      <div class="section-sub" style="font-size:10.5px;">Confirmed${record.confirmedBy ? ` by ${escapeHtml(record.confirmedBy)}` : ''}${record.confirmedAt ? ` on ${escapeHtml(String(record.confirmedAt).slice(0,10))}` : ''}. Fixed: later changes to ratings, tiers or these suggestions do not alter it.</div>
    </div>`;
    html += `<div class="section-heading">The shortlist the group voted on</div>`
      + record.shortlist.map(c => potmCardHtml(c, { admin: true, compact: true })).join('');
    if(isOwnerAdmin()){
      html += potmAsk === 'reopen'
        ? `<div class="ptag-archive-confirm" id="potmReopenAsk"><b>Withdraw ${escapeHtml(w.name)} as ${escapeHtml(label)}'s winner?</b>
            <div class="section-sub">Only to correct a mistake. The shortlist stays as it is, and the withdrawn confirmation is kept in the month's log.</div>
            <div class="ptag-status-actions"><button type="button" class="preset-btn" id="potmReopenYes">Withdraw and choose again</button><button type="button" class="preset-btn" id="potmAskNo">Cancel</button></div></div>`
        : `<div class="fg-row"><button type="button" class="preset-btn" id="potmReopen">Correct a mistake…</button></div>`;
    }
  } else if(record && record.state === PlayerOfMonth.STATE.SHORTLISTED && !(potmDraft && potmDraft.month === month)){
    html += `<div class="section-heading">Shortlist for the vote</div>
      <div class="section-sub">Finalised${record.shortlistedBy ? ` by ${escapeHtml(record.shortlistedBy)}` : ''}. Everyone can see it in League › Information. When the group has voted, choose who won.</div>`;
    const pickId = potmPick && potmPick.month === month ? potmPick.playerId : null;
    html += record.shortlist.map(c => potmCardHtml(c, { admin: true, pick: complete, picked: c.playerId === pickId })).join('');
    html += potmShareHtml(month);
    if(pickId){
      const entry = record.shortlist.find(c => c.playerId === pickId);
      const name = potmNameOf(pickId) || entry.name;
      html += `<div class="fg-controls potm-confirm-box">
        <label class="fg-label" for="potmCitation">The award's words (what the history keeps)</label>
        <textarea id="potmCitation" class="fg-select" rows="4">${escapeHtml(potmPick.citation)}</textarea>
        ${potmAsk === 'confirm'
          ? `<div class="ptag-archive-confirm" id="potmConfirmAsk"><b>Confirm ${escapeHtml(name)} as ${escapeHtml(label)} Player of the Month?</b>
              <div class="section-sub">It becomes part of the permanent history and is never recalculated.</div>
              <div class="ptag-status-actions"><button type="button" class="preset-btn" id="potmConfirmYes"${potmBusy ? ' disabled' : ''}>Confirm winner</button><button type="button" class="preset-btn" id="potmAskNo">Cancel</button></div></div>`
          : `<div class="fg-row"><button type="button" class="preset-btn active" id="potmConfirm">Confirm ${escapeHtml(name)}…</button></div>`}
      </div>`;
    }
    html += `<div class="fg-row"><button type="button" class="preset-btn" id="potmEdit">Change the shortlist</button></div>`;
  } else {
    const rec = potmRecommendation(month);
    const draft = potmDraftFor(month, rec);
    html += `<div class="section-heading">The strongest cases in ${escapeHtml(label)}</div>`;
    if(rec.empty && !draft.entries.length) html += `<div class="section-sub" id="potmEmpty">${escapeHtml(rec.empty)}</div>`;
    else if(!complete) html += `<div class="section-sub">${escapeHtml(label)} isn't over yet — these are so far. The shortlist can be finalised once the month ends.</div>`;
    else html += `<div class="section-sub">Suggested from the month's figures. Remove anyone, or add another qualified player, then finalise the shortlist for the vote.</div>`;
    if(draft.entries.length > PlayerOfMonth.SHORTLIST_COMFORT){
      html += `<div class="section-sub potm-trim" id="potmTrim">${draft.entries.length} strong cases this month. A vote works best between ${PlayerOfMonth.SHORTLIST_MIN} and ${PlayerOfMonth.SHORTLIST_COMFORT} — remove any you'd leave out.</div>`;
    }
    html += `<div id="potmCandidates">${draft.entries.map(c => potmCardHtml(c, { admin: true, remove: true })).join('')}</div>`;
    html += potmShareHtml(month);
    const onList = new Set(draft.entries.map(e => e.playerId));
    const addable = potmPlayerMonths(month).filter(p => !p.archived && PlayerOfMonth.qualifies(p.metrics) && !onList.has(p.playerId))
      .sort((a, b) => a.name.localeCompare(b.name));
    if(addable.length){
      html += `<div class="fg-controls"><div class="fg-row"><label class="fg-label" for="potmAdd">Add a qualified player</label>
        <select id="potmAdd" class="fg-select"><option value="">Choose…</option>${addable.map(p => `<option value="${escapeHtml(p.playerId)}">${escapeHtml(p.name)} (${p.metrics.games} matches)</option>`).join('')}</select></div>
        <div class="fg-row"><button type="button" class="preset-btn" id="potmAddBtn">+ Add to shortlist</button></div></div>`;
    }
    if(rec.archivedQualified.length){
      html += `<div class="section-sub" id="potmArchivedNote">${escapeHtml(rec.archivedQualified.join(', '))} played enough to qualify but ${rec.archivedQualified.length > 1 ? 'are' : 'is'} archived, so not suggested. Restore them in Player tags to consider them.</div>`;
    }
    html += `<div class="section-sub" style="font-size:10.5px;">${rec.qualified.length} qualified · ${rec.notQualified} played fewer than ${rec.minMatches} matches.</div>`;
    if(draft.entries.length){
      html += `<div class="fg-row"><button type="button" class="preset-btn active" id="potmFinalise"${complete && !potmBusy ? '' : ' disabled'}>Finalise shortlist for the vote</button></div>`;
    }
    if(record && record.state === PlayerOfMonth.STATE.SHORTLISTED){
      html += `<div class="fg-row"><button type="button" class="preset-btn" id="potmEditCancel">Keep the finalised shortlist</button></div>`;
    }
  }

  html += `<div class="section-heading">Player of the Month history</div>` + potmHistoryHtml();
  return html;
}

function potmSay(text, ok){ potmMessage = { text, ok }; }

function wirePotmSection(){
  const box = document.querySelector('[data-acc="potm"] .admin-acc-body');
  if(!box) return;
  const redraw = () => renderManage();
  const on = (id, fn) => { const el = box.querySelector('#' + id); if(el) el.onclick = fn; };
  const sel = box.querySelector('#potmMonth');
  if(sel) sel.onchange = (e) => { potmOpenMonth(e.target.value); redraw(); };

  box.querySelectorAll('[data-potm-remove]').forEach(b => b.onclick = () => {
    potmDraft.entries = potmDraft.entries.filter(e => e.playerId !== b.dataset.potmRemove);
    potmMessage = null; redraw();
  });
  on('potmAddBtn', () => {
    const id = (box.querySelector('#potmAdd') || {}).value;
    if(!id) return;
    const player = potmPlayerMonths(potmMonth).find(p => p.playerId === id);
    if(!player || player.archived || !PlayerOfMonth.qualifies(player.metrics)) return;
    potmDraft.entries = potmDraft.entries.concat([PlayerOfMonth.adminEntry(potmRecommendation(potmMonth), player, potmMonth)])
      .sort((a, b) => a.name.localeCompare(b.name));
    potmMessage = null; redraw();
  });
  on('potmFinalise', () => potmFinalise());
  on('potmEdit', () => {
    const r = potmRecordFor(potmMonth);
    potmDraft = { month: potmMonth, entries: r.shortlist.map(e => ({ ...e })) };
    potmPick = null; potmAsk = null; redraw();
  });
  on('potmEditCancel', () => { potmDraft = null; redraw(); });
  box.querySelectorAll('[data-potm-pick]').forEach(b => b.onclick = () => {
    const r = potmRecordFor(potmMonth);
    const entry = r.shortlist.find(e => e.playerId === b.dataset.potmPick);
    potmPick = { month: potmMonth, playerId: entry.playerId, citation: entry.citation || '' };
    potmAsk = null; redraw();
  });
  const cite = box.querySelector('#potmCitation');
  if(cite) cite.oninput = () => { if(potmPick) potmPick.citation = cite.value; };
  on('potmConfirm', () => { potmAsk = 'confirm'; redraw(); });
  on('potmConfirmYes', () => potmConfirm());
  on('potmReopen', () => { potmAsk = 'reopen'; redraw(); });
  on('potmReopenYes', () => potmReopen());
  on('potmAskNo', () => { potmAsk = null; redraw(); });
  wirePotmShare(box, redraw);
}

function potmAdminName(){ return currentUserName || adminRole || 'admin'; }

async function potmWrite(make, done){
  if(!db){ potmSay('No database connection.', false); renderManage(); return; }
  potmBusy = true;
  try {
    const record = make();
    await savePotmRecord(record);
    done(record);
    dataChanged();
  } catch(e){
    potmSay(e && e.message ? e.message : String(e), false);
  } finally {
    potmBusy = false;
    renderManage();
  }
}

async function potmFinalise(){
  const month = potmMonth;
  if(!potmMonthComplete(month)){ potmSay(`${monthLabel(month)} isn't over yet.`, false); renderManage(); return; }
  await potmWrite(() => PlayerOfMonth.finaliseShortlist({
    previous: potmRecordFor(month), month, recommendation: potmRecommendation(month),
    entries: potmDraft.entries, by: potmAdminName(), at: new Date().toISOString(),
  }), (r) => { potmDraft = null; potmSay(`Shortlist finalised: ${r.shortlist.map(e => e.name).join(', ')}. Everyone can see it now.`, true); });
}

async function potmConfirm(){
  const month = potmMonth;
  const pick = potmPick;
  if(!pick || !potmMonthComplete(month)) return;
  await potmWrite(() => PlayerOfMonth.confirmWinner(potmRecordFor(month), {
    playerId: pick.playerId, citation: pick.citation, by: potmAdminName(), at: new Date().toISOString(),
  }), (r) => { potmPick = null; potmAsk = null; potmSay(`${r.winner.name} is ${monthLabel(month)} Player of the Month.`, true); });
}

async function potmReopen(){
  const month = potmMonth;
  if(!isOwnerAdmin()) return;
  await potmWrite(() => PlayerOfMonth.reopen(potmRecordFor(month), { by: potmAdminName(), at: new Date().toISOString() }),
    () => { potmAsk = null; potmSay('Confirmation withdrawn. Choose the winner again.', true); });
}

// ---- What everyone sees -------------------------------------------------------

// A profile's award line: "Player of the Month ×2 · Jun 2026 · Sep 2026", or
// nothing. The months come from the confirmed awards, so a later rename,
// archive or tier change does not touch them.
function potmAwardsLineHtml(name){
  const awards = potmAwardsFor(name);
  if(!awards.length) return '';
  const short = (a) => `${a.label.slice(0, 3)} ${a.year}`;
  return `<div class="pp-hero-award" id="ppPotmAwards">👑 Player of the Month${awards.length > 1 ? ` ×${awards.length}` : ''} · ${awards.map(short).map(escapeHtml).join(' · ')}</div>`;
}
// League › Information's Player of the Month block for a month: the winner,
// the shortlist being voted on, or a plain "not chosen yet".
function potmPublicHtml(month){
  let html = `<div class="section-heading">👑 Player of the Month</div>`;
  if(month === 'all'){
    return html + `<div class="section-sub">Chosen by the group each month.</div>` + potmHistoryHtml();
  }
  const w = potmWinnerOf(month);
  const list = potmShortlistOf(month);
  if(w){
    const r = potmRecordFor(month);
    html += `<div class="potm-winner" id="potmPublicWinner">
      <div class="potm-winner-name"><span class="request-player-link" data-player="${escapeHtml(w.name)}">${escapeHtml(w.name)}</span> 🏆</div>
      <div class="potm-winner-citation">${escapeHtml(w.citation)}</div>
      <div class="potm-support">${escapeHtml(potmMetricsLine(r.winner.metrics))}</div>
    </div>`;
  } else if(list){
    html += `<div class="section-sub" id="potmPublicShortlist">${escapeHtml(monthLabel(month).split(' ')[0])}'s nominees, in no particular order. Cast your vote in the group.</div>`
      + list.map(c => potmCardHtml(c)).join('') + potmShareHtml(month);
  } else {
    html += `<div class="section-sub" id="potmPublicNone">${potmMonthComplete(month) ? 'Not chosen yet. Admin puts a shortlist to the group, and the group votes.' : 'Chosen by the group once the month is over.'}</div>`;
  }
  html += `<div class="section-heading" style="font-size:12px;">Past winners</div>` + potmHistoryHtml();
  return html;
}
