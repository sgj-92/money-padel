// ===================== PREDICT A MATCHUP =====================
// Admin's matchup tool, opened from the top of More (Admin only -- Shaun,
// 21 Sep and 4 Oct: players agree a game first, then send him the four names;
// exposing predictions would let people dodge or cherry-pick games).
//
// A match is predicted once all four players are chosen -- never from a
// partial match, and never with one player in two places (PredictionBatch).
// Until then the screen says what it needs and shows no card.
//
// One prediction is a Matchup Card that is already share-ready: the two teams,
// the call ("Projected favourites: …" / "Slight edge: …" / "Too close to
// call"), and the share of the games each side is expected to take. Share
// matchup sends the same card as a picture (CardPainter.matchup); Copy image
// puts it on the clipboard where the browser allows, and copies the card as
// text where it does not. "Add to Upcoming" is unchanged (predictionCard.js).
//
// Up to five predictions can be made in one go (Shaun, 10 Oct): "+ Add
// another prediction" once the first is complete. With more than one, each
// finished match folds to a numbered line that can be edited or removed, and
// they share as ONE condensed card (MatchupCard.buildMany ->
// CardPainter.matchups), built from the very same per-match cards.
//
// Every prediction is predictMatchup() -> MatchPrediction.build, untouched;
// each card is MatchupCard.build. Nothing is recorded.
//
// Owning stream: functional (the card look is the redesign's to restyle).
// Loads before app.js; declarations only.

let predictShare = { key: null, ready: null, message: '' };

// The matches being predicted, as typed, and which one is open for editing.
// Kept across redraws of the sheet (Add to Upcoming redraws it).
let predictBatch = { matches: [{ a1: '', a2: '', b1: '', b2: '' }], open: 0 };

function predictCanonicalName(n){
  const key = String(n || '').trim().toLowerCase();
  if(!key) return null;
  const p = PLAYERS.find(x => x.name.toLowerCase() === key);
  return p ? p.name : null;
}

function predictEvaluate(match){
  return PredictionBatch.evaluate(match, { canonical: predictCanonicalName, predict: predictMatchup });
}

function matchupCardFor(pred){
  return MatchupCard.build(pred, {
    tierOf: (n) => { const p = PLAYERS.find(x => x.name.toLowerCase() === String(n).toLowerCase()); return p ? p.tier : null; },
  });
}

// The card on screen. `detail` adds what the picture leaves out.
function matchupCardHtml(card, { detail = false } = {}){
  const ratingOf = (n) => { const p = PLAYERS.find(x => x.name.toLowerCase() === String(n).toLowerCase()); return p ? Math.round(p.rating) : null; };
  const team = (players, side) => `<div class="mu-team${card.call.favoured === side ? ' is-favoured' : ''}">${players.map(p =>
    `<span class="mu-player"><span class="mu-name">${escapeHtml(p.name)}</span>${p.tier ? `<span class="mu-tier">${escapeHtml(p.tier)}</span>` : ''}${detail && ratingOf(p.name) !== null ? `<span class="mu-rating">${ratingOf(p.name)}</span>` : ''}</span>`).join('<span class="mu-amp">&amp;</span>')}</div>`;
  const label = (players) => players.map(p => escapeHtml(p.name)).join(' & ');
  return `<div class="mu-card" id="matchupCard" data-call="${card.call.kind}">
    <div class="mu-eyebrow">Predicted matchup</div>
    ${team(card.teamA, 'A')}
    <div class="mu-vs">vs</div>
    ${team(card.teamB, 'B')}
    <div class="mu-call">
      <div class="mu-call-kicker">${escapeHtml(card.call.kicker)}</div>
      ${card.call.names ? `<div class="mu-call-names">${escapeHtml(card.call.names)}</div>` : ''}
    </div>
    <div class="mu-games">
      <div class="mu-games-label">Expected share of games</div>
      <div class="mu-games-row">
        <div class="mu-games-side"><div class="mu-games-num">${card.share.a}%</div><div class="mu-games-who">${label(card.teamA)}</div></div>
        <div class="mu-games-dash">–</div>
        <div class="mu-games-side"><div class="mu-games-num">${card.share.b}%</div><div class="mu-games-who">${label(card.teamB)}</div></div>
      </div>
    </div>
    ${detail ? `<div class="mu-detail">${card.call.kind === 'level' ? 'Level on current ratings' : `Favoured by ${card.gap} rating point${card.gap === 1 ? '' : 's'}`}</div>` : ''}
    <div class="mu-foot">${escapeHtml(card.foot)}</div>
  </div>`;
}

// One side of a match on a line: names with their tiers.
function matchupSideHtml(players){
  return players.map(p => `<span class="mu-player"><span class="mu-name">${escapeHtml(p.name)}</span>${p.tier ? `<span class="mu-tier">${escapeHtml(p.tier)}</span>` : ''}</span>`)
    .join('<span class="mu-amp">&amp;</span>');
}

// Several predictions on one condensed card -- what is shared as one picture.
function matchupsCardHtml(view){
  return `<div class="mu-card mu-multi" id="matchupsCard">
    <div class="mu-eyebrow">${escapeHtml(view.title)}</div>
    <div class="mu-games-label mu-multi-sub">Expected share of games</div>
    ${view.matches.map(m => `<div class="mu-row" data-n="${m.n}">
      <div class="mu-row-n">${m.n}</div>
      <div class="mu-row-body">
        <div class="mu-row-side${m.call.favoured === 'A' ? ' is-favoured' : ''}"><div class="mu-row-team">${matchupSideHtml(m.teamA)}</div><div class="mu-row-pct">${m.share.a}%</div></div>
        <div class="mu-row-vs">vs</div>
        <div class="mu-row-side${m.call.favoured === 'B' ? ' is-favoured' : ''}"><div class="mu-row-team">${matchupSideHtml(m.teamB)}</div><div class="mu-row-pct">${m.share.b}%</div></div>
      </div>
    </div>`).join('')}
    <div class="mu-foot">${escapeHtml(view.foot)}</div>
  </div>`;
}

// What Share and Copy act on: the one prediction, or every finished one in
// the batch on one card.
function predictShareSubject(){
  const preds = predictBatch.matches.map(predictEvaluate).filter(e => e.ok).map(e => e.prediction);
  if(!preds.length) return null;
  if(predictBatch.matches.length === 1) return { kind: 'one', preds, key: predictShareKey(preds[0]) };
  return { kind: 'many', preds, key: preds.map(predictShareKey).join(';') };
}

function predictShareKey(pred){ return pred ? pred.teamA.join('&') + '|' + pred.teamB.join('&') : null; }

function predictActionsHtml(){
  const subject = predictShareSubject();
  const mine = !!subject && predictShare.key === subject.key;
  const many = subject && subject.kind === 'many';
  return `<div id="predActions"><div class="mu-actions">
    <button type="button" class="mu-action mu-action-primary" id="predShare">${mine && predictShare.ready ? 'Tap to share' : (many ? 'Share predictions' : 'Share matchup')}</button>
    <button type="button" class="mu-action" id="predCopy">Copy image</button>
  </div>
  <div class="mu-message" id="predShareMessage">${mine ? escapeHtml(predictShare.message) : ''}</div></div>`;
}

// Only the buttons and their message are redrawn after a share or a copy, so
// anything typed into "Add to Upcoming" below stays put.
function renderPredictActions(){
  const el = document.getElementById('predActions');
  if(!el || !predictShareSubject()) return;
  el.outerHTML = predictActionsHtml();
  wirePredictActions();
}
function wirePredictActions(){
  const share = document.getElementById('predShare');
  const copy = document.getElementById('predCopy');
  if(share) share.onclick = () => sharePredictedMatchup(renderPredictActions);
  if(copy) copy.onclick = () => copyPredictedMatchup(renderPredictActions);
}

async function predictPicture(subject){
  const brand = await CardPainter.loadImage(CLUB.logo);
  const slug = (team) => team.join('-').replace(/[^A-Za-z0-9-]+/g, '');
  if(subject.kind === 'many'){
    const view = MatchupCard.buildMany(subject.preds.map(matchupCardFor));
    return { cv: CardPainter.matchups(view, { brand }), name: `${CLUB.fileSlug}-predictions-${view.matches.length}-matches.png`,
      title: view.title, text: MatchupCard.summaryTextMany(view) };
  }
  const pred = subject.preds[0];
  const card = matchupCardFor(pred);
  return { cv: CardPainter.matchup(card, { brand }), name: `${CLUB.fileSlug}-matchup-${slug(pred.teamA)}-vs-${slug(pred.teamB)}.png`,
    title: 'Predicted matchup', text: MatchupCard.summaryText(card) };
}

// Share: the picture through the share sheet (WhatsApp is on it), or saved
// where a browser cannot share files -- the Match Result Card's path.
async function sharePredictedMatchup(redraw){
  const subject = predictShareSubject();
  if(!subject || !canSeePredictions()) return;
  if(predictShare.key !== subject.key) predictShare = { key: subject.key, ready: null, message: '' };
  const say = (m) => { predictShare.message = m; if(redraw) redraw(); };
  try {
    let pending = predictShare.ready;
    if(!pending){
      const { cv, name, title, text } = await predictPicture(subject);
      pending = { files: [await CardPainter.toFile(cv, name)], meta: { title, text } };
    }
    const outcome = await CardPainter.share(pending.files, pending.meta);
    predictShare.ready = outcome === 'ready' ? pending : null;
    say(outcome === 'shared' ? 'Shared.' : outcome === 'saved' ? 'Saved to this device — post it from your photos.' : '');
  } catch(e){
    predictShare.ready = null;
    say('Could not make the picture: ' + (e && e.message ? e.message : String(e)));
  }
}

// Copy image: the picture onto the clipboard, ready to paste into WhatsApp
// (Chrome, Edge, Safari and Android Chrome allow it). The clipboard is asked
// for straight away, with the picture still being painted, so Safari still
// counts it as part of the tap. Where images cannot be copied, the card is
// copied as text instead, and the message says so.
async function copyPredictedMatchup(redraw){
  const subject = predictShareSubject();
  if(!subject || !canSeePredictions()) return;
  if(predictShare.key !== subject.key) predictShare = { key: subject.key, ready: null, message: '' };
  const say = (m) => { predictShare.message = m; if(redraw) redraw(); };
  const picture = predictPicture(subject);
  const canCopyImage = typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.write
    && typeof ClipboardItem !== 'undefined';
  if(canCopyImage){
    try {
      const blob = picture.then(p => CardPainter.toBlob(p.cv));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      say('Image copied — paste it into WhatsApp.');
      return;
    } catch(e){ /* falls through to text */ }
  }
  const { text } = await picture;
  const ok = await copyText(text);
  const what = subject.kind === 'many' ? 'predictions were' : 'matchup was';
  say(ok ? `This browser can’t copy pictures, so the ${what} copied as text. Use Share for the picture.` : 'Could not copy — use Share instead.');
}

// ---- The sheet ---------------------------------------------------------------

function predictSlotInput(slot, label, value){
  return `<input id="pred${slot.toUpperCase()}" data-slot="${slot}" list="predNamesList" class="fg-select pred-slot" placeholder="${label}" autocomplete="off" autocapitalize="words" value="${escapeHtml(value || '')}" />
    <div class="pred-slot-note" data-slot-note="${slot}"></div>`;
}

// A finished (or set-aside) match, folded to one numbered line.
function predictFoldedHtml(i, ev, { actions = true } = {}){
  const line = ev.ok
    ? (() => { const c = matchupCardFor(ev.prediction); return `<span class="pred-fold-teams">${matchupSideHtml(c.teamA)} <span class="mu-amp">vs</span> ${matchupSideHtml(c.teamB)}</span><span class="pred-fold-pct">${c.share.a}% – ${c.share.b}%</span>`; })()
    : `<span class="pred-fold-teams pred-fold-todo">Not finished — ${escapeHtml(ev.reason || PredictionBatch.PROMPT)}</span>`;
  return `<div class="pred-fold" data-match="${i}">
    <div class="pred-fold-n">${i + 1}</div>
    <div class="pred-fold-body">${line}</div>
    ${actions ? `<div class="pred-fold-actions">
      <button type="button" class="preset-btn" data-pred-edit="${i}">Edit</button>
      <button type="button" class="preset-btn" data-pred-remove="${i}" aria-label="Remove prediction ${i + 1}">Remove</button>
    </div>` : ''}
  </div>`;
}

function predictEditorHtml(i){
  const m = predictBatch.matches[i];
  const many = predictBatch.matches.length > 1;
  return `<div class="pred-editor" data-match="${i}">
    ${many ? `<div class="pred-editor-head"><span>Match ${i + 1}</span><button type="button" class="preset-btn" data-pred-remove="${i}">Remove</button></div>` : ''}
    <div class="fg-controls mu-form">
      <div class="fg-row"><label class="fg-label">Team A</label>
        ${predictSlotInput('a1', 'Player', m.a1)}
        ${predictSlotInput('a2', 'Partner', m.a2)}
      </div>
      <div class="fg-row"><label class="fg-label">Team B</label>
        ${predictSlotInput('b1', 'Player', m.b1)}
        ${predictSlotInput('b2', 'Partner', m.b2)}
      </div>
    </div>
    <div id="predResult"></div>
  </div>`;
}

function renderPredictBody(){
  const body = document.getElementById('predictModalBody');
  if(!body) return;
  if(!canSeePredictions()){ body.innerHTML = ''; return; }
  const { matches, open } = predictBatch;
  const evs = matches.map(predictEvaluate);
  body.innerHTML = `<div class="section-sub" style="font-size:11.5px; margin-bottom:10px;">Pick the four players. ${matches.length > 1 ? 'The predictions share as one card.' : 'The card is ready to share with the group.'} Admin only — nothing is recorded.</div>
    <datalist id="predNamesList"></datalist>
    <div class="pred-batch">${matches.map((m, i) => i === open ? predictEditorHtml(i) : predictFoldedHtml(i, evs[i])).join('')}</div>
    <div id="predAdd"></div>
    <div id="predMany"></div>`;
  // Any change reads all four, so what is on screen and what is predicted
  // can never differ (autofill can fill several at once).
  body.querySelectorAll('.pred-slot').forEach(inp => inp.addEventListener('input', () => {
    const m = predictBatch.matches[predictBatch.open];
    body.querySelectorAll('.pred-slot').forEach(x => { m[x.dataset.slot] = x.value; });
    renderPredictResult();
  }));
  body.querySelectorAll('[data-pred-edit]').forEach(b => b.onclick = () => { predictBatch.open = Number(b.dataset.predEdit); renderPredictBody(); });
  body.querySelectorAll('[data-pred-remove]').forEach(b => b.onclick = () => removePrediction(Number(b.dataset.predRemove)));
  renderPredictResult();
}

function addPrediction(){
  const evs = predictBatch.matches.map(predictEvaluate);
  if(!PredictionBatch.canAdd(evs)) return;
  predictBatch.matches = PredictionBatch.add(predictBatch.matches);
  predictBatch.open = predictBatch.matches.length - 1;
  renderPredictBody();
  const first = document.getElementById('predA1');
  if(first) first.focus();
}

function removePrediction(i){
  predictBatch.matches = PredictionBatch.remove(predictBatch.matches, i);
  // The open match keeps its place in the list; removing it opens none, unless
  // only one is left, which is always open.
  const open = predictBatch.open;
  predictBatch.open = predictBatch.matches.length === 1 ? 0 : (open === i ? -1 : (open > i ? open - 1 : open));
  renderPredictBody();
}

// Everything that follows from what is typed in the open match: its slot
// notes, its result, the Add button and the combined card. The inputs
// themselves are never redrawn, so typing keeps its place.
function renderPredictResult(){
  const box = document.getElementById('predResult');
  const { matches, open } = predictBatch;
  const single = matches.length === 1;
  const ev = open >= 0 && matches[open] ? predictEvaluate(matches[open]) : null;

  // The names already in this match are not offered again.
  const list = document.getElementById('predNamesList');
  if(list && open >= 0){
    const taken = new Set(PredictionBatch.taken(matches[open], null, predictCanonicalName).map(n => n.toLowerCase()));
    list.innerHTML = allPlayerNames().filter(n => !taken.has(n.toLowerCase())).map(n => `<option value="${escapeHtml(n)}">`).join('');
  }
  if(ev){
    PredictionBatch.SLOTS.forEach(s => {
      const note = document.querySelector(`[data-slot-note="${s}"]`);
      const inp = document.querySelector(`.pred-slot[data-slot="${s}"]`);
      const dup = ev.slots[s].state === 'duplicate';
      if(note) note.textContent = dup ? `${ev.slots[s].name} is already in this match.` : '';
      if(inp) inp.classList.toggle('is-invalid', dup);
    });
  }

  // Add to Upcoming takes the one prediction on screen.
  predictionDraft = single && ev && ev.ok ? ev.prediction : null;
  if(box && ev){
    if(!ev.ok){
      box.innerHTML = `<div class="pred-prompt${ev.reason ? ' is-problem' : ''}">${escapeHtml(ev.reason || ev.prompt)}</div>`;
    } else if(single){
      box.innerHTML = matchupCardHtml(matchupCardFor(ev.prediction), { detail: true }) + predictActionsHtml() + buildPredictionToUpcomingHtml(ev.prediction);
      wirePredictActions();
      wirePredictionToUpcoming(box, renderPredictBody);
    } else {
      // In a batch the open match previews as its line on the combined card.
      box.innerHTML = `<div class="pred-preview">${predictFoldedHtml(open, ev, { actions: false })}</div>
        <button type="button" class="preset-btn pred-done" id="predDone">Done</button>`;
      const done = document.getElementById('predDone');
      if(done) done.onclick = () => { predictBatch.open = -1; renderPredictBody(); };
    }
  }

  const evs = matches.map(predictEvaluate);
  const add = document.getElementById('predAdd');
  if(add){
    add.innerHTML = matches.length >= PredictionBatch.MAX
      ? `<div class="pred-max">That’s the maximum of ${PredictionBatch.MAX} predictions.</div>`
      : (PredictionBatch.canAdd(evs) ? `<button type="button" class="preset-btn pred-add" id="predAddBtn">+ Add another prediction</button>` : '');
    const btn = document.getElementById('predAddBtn');
    if(btn) btn.onclick = addPrediction;
  }

  const many = document.getElementById('predMany');
  if(many){
    if(single){ many.innerHTML = ''; return; }
    const done = evs.filter(e => e.ok);
    const view = MatchupCard.buildMany(done.map(e => matchupCardFor(e.prediction)));
    const left = evs.length - done.length;
    many.innerHTML = view
      ? `${matchupsCardHtml(view)}${left ? `<div class="pred-max">${left === 1 ? 'One match isn’t' : `${left} matches aren’t`} finished and ${left === 1 ? 'is' : 'are'} left off the card.</div>` : ''}${predictActionsHtml()}`
      : '';
    if(view) wirePredictActions();
  }
}

function openPredictMatchup(){
  // Admin only, whatever route asked.
  if(!canSeePredictions()) return;
  let modal = document.getElementById('predictModal');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'shell-more-sheet';
    modal.id = 'predictModal';
    modal.innerHTML = `<div class="shell-more-panel mu-panel">
      <div class="msc-title-row"><h3>Predict a Matchup</h3><button type="button" class="msc-close" data-predict-close aria-label="Close">✕</button></div>
      <div id="predictModalBody"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if(e.target === modal || (e.target.closest && e.target.closest('[data-predict-close]'))) modal.classList.remove('show');
    });
  }
  renderPredictBody();
  modal.classList.add('show');
}
