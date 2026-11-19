// ===================== WHEN I CAN PLAY =====================
// Shaun, 19 Nov: players set when they can play -- a weekly pattern plus
// exceptions (domain/players/availability.js). A player edits their own,
// signed in with their code; an Admin may edit anyone's. Everyone sees who is
// free when arranging a game (availabilityHintHtml). Declarations only.

let availabilityDraft = null;   // { name, weekly, exceptions }

function canEditAvailability(name){
  return !!name && (isUnlocked || (signedInPlayer && signedInPlayer.name === name));
}

function availabilitySheet(){
  let sheet = document.getElementById('availabilitySheet');
  if(!sheet){
    sheet = document.createElement('div');
    sheet.className = 'shell-more-sheet';
    sheet.id = 'availabilitySheet';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if(e.target === sheet) sheet.classList.remove('show'); });
  }
  return sheet;
}

function openAvailabilitySheet(name){
  if(!canEditAvailability(name)) return;
  const c = Availability.clean(availabilityState[name] || {});
  const today = localIsoToday();
  availabilityDraft = { name, weekly: c.weekly, exceptions: c.exceptions.filter(x => x.date >= today) };
  renderAvailabilitySheet('');
  availabilitySheet().classList.add('show');
}

function fmtAvailDate(date){
  return typeof fmtFixtureDate === 'function' ? fmtFixtureDate(date) : date;
}

function renderAvailabilitySheet(message){
  const d = availabilityDraft, mine = signedInPlayer && signedInPlayer.name === d.name;
  const A = Availability;
  const grid = A.DAYS.map(day => `<div class="av-row"><span class="av-day">${A.DAY_LABEL[day]}</span>${A.SLOTS.map(slot => {
    const on = (d.weekly[day] || []).includes(slot);
    return `<button type="button" class="av-cell${on ? ' is-on' : ''}" data-av-day="${day}" data-av-slot="${slot}" aria-pressed="${on}" aria-label="${A.DAY_LABEL[day]} ${A.SLOT_LABEL[slot]}">${on ? '✓' : ''}</button>`;
  }).join('')}</div>`).join('');
  const exceptions = d.exceptions.length ? d.exceptions.map((x, i) => `<div class="av-ex">
      <span><b>${escapeHtml(fmtAvailDate(x.date))}</b> · ${x.free.length ? `free ${x.free.map(s => A.SLOT_LABEL[s].toLowerCase()).join(', ')}` : 'not free'}</span>
      <button type="button" class="av-ex-del" data-av-del="${i}" aria-label="Remove">✕</button></div>`).join('')
    : `<div class="av-empty">None. Add a date you can’t make, or an extra one you can.</div>`;
  availabilitySheet().innerHTML = `<div class="shell-more-panel av-panel" role="dialog" aria-label="When I can play">
    <div class="game-sheet-head"><h3>${mine ? 'When I can play' : `When ${escapeHtml(d.name)} can play`}</h3><button type="button" class="mp-sheet-close av-close" aria-label="Close">×</button></div>
    <div class="av-sub">Tap the times you can usually play. Everyone sees this when a game is being arranged.</div>
    <div class="av-grid"><div class="av-row av-head"><span></span>${A.SLOTS.map(s => `<span>${A.SLOT_LABEL[s]}<small>${A.SLOT_HINT[s]}</small></span>`).join('')}</div>${grid}</div>
    <div class="mp-section-label av-label">Dates that are different</div>
    <div class="av-exs">${exceptions}</div>
    <div class="av-add">
      <input type="date" class="fg-select av-add-date" min="${localIsoToday()}">
      <select class="fg-select av-add-kind">
        <option value="none">Not free</option>
        <option value="morning">Free morning</option><option value="afternoon">Free afternoon</option>
        <option value="evening">Free evening</option><option value="all">Free all day</option>
      </select>
      <button type="button" class="preset-btn av-add-btn">Add</button>
    </div>
    <button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent av-save">Save</button>
    <div class="av-msg" role="status">${escapeHtml(message || '')}</div>
  </div>`;
  wireAvailabilitySheet();
}

function wireAvailabilitySheet(){
  const sheet = availabilitySheet(), d = availabilityDraft;
  sheet.querySelector('.av-close').onclick = () => sheet.classList.remove('show');
  sheet.querySelectorAll('[data-av-day]').forEach(b => {
    b.onclick = () => {
      const day = b.dataset.avDay, slot = b.dataset.avSlot, cur = d.weekly[day] || [];
      d.weekly[day] = cur.includes(slot) ? cur.filter(s => s !== slot) : cur.concat([slot]);
      renderAvailabilitySheet('');
    };
  });
  sheet.querySelectorAll('[data-av-del]').forEach(b => {
    b.onclick = () => { d.exceptions.splice(Number(b.dataset.avDel), 1); renderAvailabilitySheet(''); };
  });
  sheet.querySelector('.av-add-btn').onclick = () => {
    const date = sheet.querySelector('.av-add-date').value, kind = sheet.querySelector('.av-add-kind').value;
    if(!date){ renderAvailabilitySheet('Choose a date first.'); return; }
    const free = kind === 'none' ? [] : kind === 'all' ? Availability.SLOTS.slice() : [kind];
    d.exceptions = d.exceptions.filter(x => x.date !== date).concat([{ date, free }]).sort((a, b) => (a.date < b.date ? -1 : 1));
    renderAvailabilitySheet('');
  };
  sheet.querySelector('.av-save').onclick = async () => {
    const btn = sheet.querySelector('.av-save');
    btn.disabled = true;
    const entry = { ...Availability.clean(d), updatedAt: new Date().toISOString(), by: verifiedPlayerName() === d.name ? d.name : ((signedInAdmin && signedInAdmin.name) || 'Admin') };
    const ok = await saveAvailability(d.name, entry);
    btn.disabled = false;
    if(!ok){ renderAvailabilitySheet(storageAvailable() ? 'Couldn’t save. Publish the latest database rules (docs/PLAYER_CODES.md), or sign in with your code.' : 'Couldn’t save: no connection.'); return; }
    availabilityState = { ...availabilityState, [d.name]: entry };
    renderAvailabilitySheet('Saved.');
    if(typeof renderActiveTab === 'function') renderActiveTab();
  };
}

// Who is free for a game: the four named (✓ free, ✗ not free, ? not said),
// then anyone else free then. '' without a date, or where nobody has said.
function availabilityHintHtml(names, date, time){
  if(!playerAccountsOn() || !date) return '';
  const chosen = (names || []).map(n => String(n || '').trim()).filter(Boolean);
  const everyone = entryPlayerNames();
  if(!everyone.some(n => availabilityState[n])) return '';
  const w = Availability.whoIsFree(availabilityState, everyone, date, time);
  const when = `${fmtAvailDate(date)}${w.slot ? ` ${Availability.SLOT_LABEL[w.slot].toLowerCase()}` : ''}`;
  const mark = (n) => w.free.includes(n) ? '✓' : w.busy.includes(n) ? '✗' : '?';
  const lower = chosen.map(n => n.toLowerCase());
  const others = w.free.filter(n => !lower.includes(n.toLowerCase()));
  const known = chosen.map(n => everyone.find(e => e.toLowerCase() === n.toLowerCase())).filter(Boolean);
  return `<div class="av-hint">
    ${known.length ? `<div><b>${escapeHtml(when)}:</b> ${known.map(n => `<span class="av-mark av-${mark(n) === '✓' ? 'free' : mark(n) === '✗' ? 'busy' : 'unknown'}">${mark(n)} ${escapeHtml(n)}</span>`).join(' ')}</div>` : `<div><b>${escapeHtml(when)}</b></div>`}
    ${others.length ? `<div class="av-others">Also free: ${others.map(escapeHtml).join(', ')}</div>` : ''}
  </div>`;
}
