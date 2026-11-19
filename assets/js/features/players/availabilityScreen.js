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
  // Days across, hours down: seven narrow columns fit a phone.
  const head = `<div class="av-row av-head"><span></span>${A.DAYS.map(day => `<button type="button" class="av-dayhead" data-av-col="${day}" aria-label="All of ${A.DAY_LABEL[day]}">${A.DAY_LABEL[day]}</button>`).join('')}</div>`;
  const grid = A.HOURS.map(h => `<div class="av-row"><span class="av-hour">${A.hourLabel(h)}</span>${A.DAYS.map(day => {
    const on = (d.weekly[day] || []).includes(h);
    return `<button type="button" class="av-cell${on ? ' is-on' : ''}" data-av-day="${day}" data-av-hour="${h}" aria-pressed="${on}" aria-label="${A.DAY_LABEL[day]} ${A.hourLabel(h)}"></button>`;
  }).join('')}</div>`).join('');
  const exceptions = d.exceptions.length ? d.exceptions.map((x, i) => `<div class="av-ex">
      <span><b>${escapeHtml(fmtAvailDate(x.date))}</b> · ${x.free.length ? `free ${A.rangesText(x.free)}` : 'not free'}</span>
      <button type="button" class="av-ex-del" data-av-del="${i}" aria-label="Remove">✕</button></div>`).join('')
    : `<div class="av-empty">None. Add a date you can’t make, or an extra one you can.</div>`;
  const hourOpts = (sel, endTimes) => A.HOURS.map(h => endTimes ? h + 1 : h).map(h => `<option value="${h}"${h === sel ? ' selected' : ''}>${A.hourLabel(h)}</option>`).join('');
  const summary = A.summary(d);
  availabilitySheet().innerHTML = `<div class="shell-more-panel av-panel" role="dialog" aria-label="When I can play">
    <div class="game-sheet-head"><h3>${mine ? 'When I can play' : `When ${escapeHtml(d.name)} can play`}</h3><button type="button" class="mp-sheet-close av-close" aria-label="Close">×</button></div>
    <div class="av-sub">Tap the hours you can usually play (tap a day to fill or clear it). Everyone sees this when a game is being arranged.</div>
    <div class="av-summary">${summary ? escapeHtml(summary) : 'Nothing set yet.'}</div>
    <div class="av-grid">${head}${grid}</div>
    <div class="mp-section-label av-label">Dates that are different</div>
    <div class="av-exs">${exceptions}</div>
    <div class="av-add">
      <input type="date" class="fg-select av-add-date" min="${localIsoToday()}">
      <select class="fg-select av-add-kind">
        <option value="none">Not free</option><option value="all">Free all day</option><option value="range">Free from…</option>
      </select>
      <button type="button" class="preset-btn av-add-btn">Add</button>
    </div>
    <div class="av-add-range" hidden>
      <select class="fg-select av-add-from">${hourOpts(18, false)}</select><span>to</span>
      <select class="fg-select av-add-to">${hourOpts(21, true)}</select>
    </div>
    <button type="button" class="mp-btn-primary mp-btn-touch mp-btn-accent av-save">Save</button>
    <div class="av-msg" role="status">${escapeHtml(message || '')}</div>
  </div>`;
  wireAvailabilitySheet();
}

function wireAvailabilitySheet(){
  const sheet = availabilitySheet(), d = availabilityDraft, A = Availability;
  sheet.querySelector('.av-close').onclick = () => sheet.classList.remove('show');
  sheet.querySelectorAll('[data-av-day]').forEach(b => {
    b.onclick = () => {
      const day = b.dataset.avDay, h = Number(b.dataset.avHour), cur = d.weekly[day] || [];
      d.weekly[day] = cur.includes(h) ? cur.filter(x => x !== h) : cur.concat([h]);
      renderAvailabilitySheet('');
    };
  });
  sheet.querySelectorAll('[data-av-col]').forEach(b => {
    b.onclick = () => {
      const day = b.dataset.avCol, full = (d.weekly[day] || []).length === A.HOURS.length;
      d.weekly[day] = full ? [] : A.HOURS.slice();
      renderAvailabilitySheet('');
    };
  });
  sheet.querySelectorAll('[data-av-del]').forEach(b => {
    b.onclick = () => { d.exceptions.splice(Number(b.dataset.avDel), 1); renderAvailabilitySheet(''); };
  });
  const kind = sheet.querySelector('.av-add-kind'), range = sheet.querySelector('.av-add-range');
  kind.onchange = () => { range.hidden = kind.value !== 'range'; };
  sheet.querySelector('.av-add-btn').onclick = () => {
    const date = sheet.querySelector('.av-add-date').value;
    if(!date){ renderAvailabilitySheet('Choose a date first.'); return; }
    let free = [];
    if(kind.value === 'all') free = A.HOURS.slice();
    if(kind.value === 'range'){
      const from = Number(sheet.querySelector('.av-add-from').value), to = Number(sheet.querySelector('.av-add-to').value);
      if(to <= from){ renderAvailabilitySheet('The end has to be after the start.'); return; }
      free = A.HOURS.filter(h => h >= from && h < to);
    }
    d.exceptions = d.exceptions.filter(x => x.date !== date).concat([{ date, free }]).sort((a, b) => (a.date < b.date ? -1 : 1));
    renderAvailabilitySheet('');
  };
  sheet.querySelector('.av-save').onclick = async () => {
    const btn = sheet.querySelector('.av-save');
    btn.disabled = true;
    const entry = { ...A.clean(d), updatedAt: new Date().toISOString(), by: verifiedPlayerName() === d.name ? d.name : ((signedInAdmin && signedInAdmin.name) || 'Admin') };
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
  const when = `${fmtAvailDate(date)}${w.hour !== null ? ` ${Availability.hourLabel(w.hour)}` : ''}`;
  const mark = (n) => w.free.includes(n) ? '✓' : w.busy.includes(n) ? '✗' : '?';
  const lower = chosen.map(n => n.toLowerCase());
  const others = w.free.filter(n => !lower.includes(n.toLowerCase()));
  const known = chosen.map(n => everyone.find(e => e.toLowerCase() === n.toLowerCase())).filter(Boolean);
  return `<div class="av-hint">
    ${known.length ? `<div><b>${escapeHtml(when)}:</b> ${known.map(n => `<span class="av-mark av-${mark(n) === '✓' ? 'free' : mark(n) === '✗' ? 'busy' : 'unknown'}">${mark(n)} ${escapeHtml(n)}</span>`).join(' ')}</div>` : `<div><b>${escapeHtml(when)}</b></div>`}
    ${others.length ? `<div class="av-others">Also free: ${others.map(escapeHtml).join(', ')}</div>` : ''}
  </div>`;
}
