// ===================== UI: PILL SWITCHES FOR SHORT CHOICES =====================
// Shaun, 22 Nov: "Replace standard dropdowns with segmented pill controls ...
// where appropriate." A dropdown of two to four short choices is shown as a
// row of pills; the dropdown stays underneath (hidden), so every screen goes
// on reading its value and hearing its change exactly as before. Longer
// lists (players, times) stay dropdowns: on an iPhone those open the native
// wheel, which is the native control for a long list. A dropdown marked
// data-native="1" is left alone.
// Owning stream: redesign. Declarations only; nativeFeelInstall() wires it.

const SEG_MAX_OPTIONS = 4, SEG_MAX_LABEL = 14, SEG_MAX_TOTAL = 34;

function segFits(select){
  if(select.multiple || select.dataset.native === '1' || select.dataset.seg) return false;
  // Toolbars that sit a dropdown beside another in a fixed box keep it.
  if(select.closest('[data-native-selects]')) return false;
  const opts = [...select.options].filter(o => !o.hidden);
  if(opts.length < 2 || opts.length > SEG_MAX_OPTIONS) return false;
  const labels = opts.map(o => o.textContent.trim());
  return labels.every(l => l && l.length <= SEG_MAX_LABEL) && labels.join('').length <= SEG_MAX_TOTAL;
}

function segSync(select){
  const row = select.nextElementSibling;
  if(!row || !row.classList.contains('seg-pills')) return;
  row.querySelectorAll('.seg-pill').forEach(p => {
    const on = p.dataset.value === select.value;
    p.setAttribute('aria-checked', on ? 'true' : 'false');
    p.tabIndex = on ? 0 : -1;
    p.disabled = select.disabled;
  });
}

function segEnhance(select){
  if(!segFits(select)) return;
  select.dataset.seg = '1';
  const row = document.createElement('div');
  row.className = 'seg-pills';
  row.setAttribute('role', 'radiogroup');
  const label = select.getAttribute('aria-label') || (select.id && document.querySelector(`label[for="${CSS.escape(select.id)}"]`) || {}).textContent;
  if(label) row.setAttribute('aria-label', String(label).trim());
  [...select.options].filter(o => !o.hidden).forEach(o => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'seg-pill'; b.setAttribute('role', 'radio');
    b.dataset.value = o.value; b.textContent = o.textContent.trim();
    b.onclick = () => {
      if(select.disabled || select.value === o.value) return;
      select.value = o.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      segSync(select);
    };
    row.appendChild(b);
  });
  // Arrow keys move along, as in a radio group.
  row.addEventListener('keydown', (e) => {
    if(!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
    const pills = [...row.querySelectorAll('.seg-pill')];
    const i = pills.findIndex(p => p.dataset.value === select.value);
    const next = pills[(i + (/Right|Down/.test(e.key) ? 1 : pills.length - 1)) % pills.length];
    next.click(); next.focus(); e.preventDefault();
  });
  select.classList.add('seg-native');
  select.setAttribute('tabindex', '-1');
  select.setAttribute('aria-hidden', 'true');
  select.insertAdjacentElement('afterend', row);
  // A screen that sets the value itself and says so is followed.
  select.addEventListener('change', () => segSync(select));
  segSync(select);
  // Pills only where they fit: in a box sized for a dropdown they'd crowd,
  // so the dropdown comes back. Checked once the row has a size (a sheet
  // drawn hidden has none until it opens).
  if(typeof ResizeObserver === 'function'){
    const ro = new ResizeObserver(() => {
      const w = row.getBoundingClientRect().width;
      if(!w) return;
      ro.disconnect();
      if(!segRowFits(row)) segUndo(select, row);
    });
    ro.observe(row);
  }
}

function segRowFits(row){
  const r = row.getBoundingClientRect(), p = row.parentElement && row.parentElement.getBoundingClientRect();
  if(row.scrollWidth > row.clientWidth + 1) return false;
  if(r.right > window.innerWidth + 1 || r.left < -1) return false;
  return !p || (r.right <= p.right + 1 && r.left >= p.left - 1);
}

function segUndo(select, row){
  row.remove();
  select.classList.remove('seg-native');
  select.removeAttribute('tabindex');
  select.removeAttribute('aria-hidden');
  select.dataset.seg = 'no';
}

function segEnhanceWithin(root){
  if(!root || !root.querySelectorAll) return;
  if(root.matches && root.matches('select')) segEnhance(root);
  root.querySelectorAll('select:not([data-seg])').forEach(segEnhance);
}
