// ===================== UI: SWIPE A SHEET AWAY =====================
// Shaun, 22 Nov: "slide-up drawers/bottom sheets". Every sheet already rises
// from the bottom (assets/css/native.css animates it); this lets a thumb pull
// it back down, as on iOS. Only from the top of the sheet's content, so a
// long sheet still scrolls. Closing goes through the sheet's own route
// (shellCloseSheet), so Back and history stay right.
// Owning stream: redesign. Declarations only; nativeFeelInstall() wires it.

const SHEET_PANEL_SELECTOR = '.shell-more-sheet.show .shell-more-panel, .overlay.show .sheet';
let sheetDrag = null;   // { panel, sheet, y0, t0, dy, live }

function sheetDragStart(e){
  if(window.innerWidth >= 768 || e.touches.length !== 1) return;
  const panel = e.target.closest && e.target.closest(SHEET_PANEL_SELECTOR);
  if(!panel) return;
  // Inside something that scrolls on its own and isn't at its top: let it scroll.
  for(let el = e.target; el && el !== panel.parentNode; el = el.parentNode){
    if(el.scrollTop > 0) return;
  }
  if(e.target.closest('input, textarea, select, [contenteditable], .seg-pills')) return;
  sheetDrag = { panel, sheet: panel.closest('.shell-more-sheet, .overlay'), y0: e.touches[0].clientY, t0: Date.now(), dy: 0, live: false };
}

function sheetDragMove(e){
  if(!sheetDrag) return;
  const dy = e.touches[0].clientY - sheetDrag.y0;
  if(!sheetDrag.live){
    if(dy < 6){ if(dy < -4) sheetDrag = null; return; }   // an upward scroll, not a pull
    sheetDrag.live = true;
    sheetDrag.panel.classList.add('is-dragging');
  }
  sheetDrag.dy = Math.max(0, dy);
  sheetDrag.panel.style.transform = `translateY(${sheetDrag.dy}px)`;
  if(e.cancelable) e.preventDefault();
}

function sheetDragEnd(){
  const d = sheetDrag;
  sheetDrag = null;
  if(!d || !d.live) return;
  d.panel.classList.remove('is-dragging');
  const fast = d.dy / Math.max(1, Date.now() - d.t0) > 0.6;
  const far = d.dy > Math.min(140, d.panel.offsetHeight * 0.3);
  d.panel.style.transform = '';
  if(fast || far) closeAnySheet(d.sheet);
}

function closeAnySheet(sheet){
  if(!sheet) return;
  if(sheet.id && typeof shellCloseSheet === 'function') shellCloseSheet(sheet.id);
  else sheet.classList.remove('show');
}
