// ===================== ADMIN: RANKING SETTINGS =====================
// Shaun, 18 Nov: "Allow me to change the number of idle games required to
// show in rankings, within settings. Also allow me to amend the default
// settings for minimum games for rankings, king of tier etc."
// The numbers and their limits are domain/settings/clubSettings.js; this draws
// the form and saves what differs from the defaults. Declarations only.

let clubSettingsMessage = '';

function buildClubSettingsHtml(){
  const now = ClubSettings.effective(CLUB, clubSettingsState), d = ClubSettings.defaults(CLUB);
  const changed = ClubSettings.FIELDS.filter(f => now[f.key] !== d[f.key]).length;
  return `<div class="section-sub" style="margin-top:0;">The club's own numbers. Changing one changes it for everyone straight away. Ratings are never touched — only who is shown, ranked or qualifies.</div>
    <div class="fg-controls">${ClubSettings.FIELDS.map(f => `<div class="fg-row cs-row">
      <label class="fg-label" for="cs-${f.key}">${escapeHtml(f.label)}</label>
      <div class="cs-input"><input id="cs-${f.key}" data-cs="${f.key}" type="number" inputmode="numeric" min="${f.min}" max="${f.max}" step="1" class="fg-select" value="${now[f.key]}" />
        <span class="cs-unit">${escapeHtml(f.unit)}${now[f.key] === d[f.key] ? ' · default' : ` · default ${d[f.key]}`}</span></div>
      <div class="section-sub" style="font-size:10.5px; margin:2px 0 0;">${escapeHtml(f.help)}</div>
    </div>`).join('')}
    <div class="difficulty-row">
      <button type="button" class="tab-btn active" id="csSave" style="flex:2;">Save settings</button>
      ${changed ? `<button type="button" class="preset-btn" id="csReset" style="flex:1;">Back to defaults</button>` : ''}
    </div>
    <div id="csMessage" class="section-sub" role="status">${escapeHtml(clubSettingsMessage)}</div></div>`;
}

async function storeClubSettings(store, said){
  const msg = document.getElementById('csMessage');
  const before = clubSettingsState;
  clubSettingsState = store;
  if(!await saveClubSettings(store)){
    clubSettingsState = before;
    if(msg) msg.textContent = storageAvailable() ? `Save failed (${lastStorageError || 'unknown error'}) — try again.` : `Save failed — this page can't reach shared storage.`;
    return;
  }
  applyClubSettings();
  clubSettingsMessage = said;
  dataChanged();
}

function wireClubSettings(){
  const save = document.getElementById('csSave');
  if(save) save.onclick = async () => {
    const entries = {};
    document.querySelectorAll('[data-cs]').forEach(el => { entries[el.dataset.cs] = el.value; });
    const { store, problems } = ClubSettings.fromForm(CLUB, entries);
    if(problems.length){ document.getElementById('csMessage').textContent = problems.join(' · '); return; }
    save.disabled = true;
    try { await storeClubSettings(store, 'Settings saved.'); } finally { save.disabled = false; }
  };
  const reset = document.getElementById('csReset');
  if(reset) reset.onclick = () => storeClubSettings({}, 'Back to the defaults.');
}
