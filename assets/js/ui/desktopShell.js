// ===================== DESKTOP SHELL =====================
// One app, two presentations. A phone gets the app exactly as it was: below
// 768px nothing in this file touches the page. From 768px the same shell is
// laid out for a laptop or a monitor by assets/css/layout/desktop.css -- the
// bottom navigation becomes a left rail, content sits in a centred column,
// sheets become dialogs and side panels -- and this file adds only what the
// rail needs that a phone does not (the brand, and who is viewing) and tells
// the stylesheet which layout range and section are current.
//
// The layout ranges, used here and in desktop.css (keep them together):
//   mobile   < 768    the phone app, unchanged
//   tablet   768-1199 compact icon rail, one centred column, dialogs
//   desktop  1200+    full rail, two-up layouts (master-detail, split views)
//   wide     1600+    a wider centred column; nothing stretches further
//
// Navigation is not duplicated: the rail IS the bottom navigation
// (.shell-bottom-nav), restyled, so every route, highlight and permission is
// the one the phone uses. Sheets keep their own open/close handlers.
//
// Owning stream: functional (shell). Loads before app.js; declarations only.

const LAYOUT_RANGES = [
  { name: 'wide', min: 1600 },
  { name: 'desktop', min: 1200 },
  { name: 'tablet', min: 768 },
];
const DESKTOP_MIN_WIDTH = 768;

function layoutForWidth(width){
  const range = LAYOUT_RANGES.find(r => width >= r.min);
  return range ? range.name : 'mobile';
}

let desktopShellOn = false;

// Called once the shell exists. On a phone this only listens: the desktop
// pieces are built the first time the window is desktop-sized, never before.
function initDesktopShell(){
  const apply = () => {
    if(!desktopShellOn && window.innerWidth >= DESKTOP_MIN_WIDTH) enableDesktopShell();
    syncDesktopShell();
  };
  let pending = null;
  window.addEventListener('resize', () => { if(pending) return; pending = requestAnimationFrame(() => { pending = null; apply(); }); });
  document.addEventListener('keydown', onShellKeydown);
  apply();
}

// The rail's own pieces: the brand above the navigation, and who is viewing
// below it. Added to the navigation element itself, hidden on a phone.
function enableDesktopShell(){
  const nav = document.querySelector('.shell-bottom-nav');
  if(!nav || desktopShellOn) return;
  desktopShellOn = true;
  const brand = document.createElement('div');
  brand.className = 'shell-rail-brand';
  brand.innerHTML = `<img src="${CLUB.logo}" alt="" class="shell-rail-mark"><span class="shell-rail-wordmark">${clubWordmarkHtml()}</span>`;
  nav.insertBefore(brand, nav.firstChild);
  const foot = document.createElement('div');
  foot.className = 'shell-rail-foot';
  foot.innerHTML = `<div class="shell-rail-label">Viewing as</div>
    <button type="button" class="shell-rail-viewer" id="railViewer" aria-label="Who are you?"></button>`;
  nav.appendChild(foot);
  foot.querySelector('#railViewer').onclick = () => buildViewerSelector();
  nav.setAttribute('aria-label', 'Sections');
}

// Which range and section are current, for the stylesheet; and the rail's
// viewer. Cheap, and safe to call on every navigation.
function syncDesktopShell(){
  if(!desktopShellOn) return;
  const root = document.documentElement;
  root.dataset.layout = layoutForWidth(window.innerWidth);
  if(typeof activeSection !== 'undefined') root.dataset.section = activeSection;
  if(typeof activeTab !== 'undefined') root.dataset.tab = activeTab;
  const btn = document.getElementById('railViewer');
  if(btn){
    const viewer = (typeof getCurrentViewer === 'function') ? getCurrentViewer() : null;
    btn.innerHTML = viewer
      ? `<span class="shell-rail-avatar">${escapeHtml(initials(viewer.name))}</span><span class="shell-rail-name">${escapeHtml(viewer.name)}</span><span aria-hidden="true">▾</span>`
      : `<span class="shell-rail-name">Who are you?</span><span aria-hidden="true">▾</span>`;
  }
}

// Escape closes what is open, topmost first: a sheet or dialog, then the
// player profile. The same close the backdrop and Close buttons use.
function onShellKeydown(e){
  if(e.key !== 'Escape' || e.defaultPrevented) return;
  const sheets = [...document.querySelectorAll('.shell-more-sheet.show')];
  if(sheets.length){
    sheets[sheets.length - 1].classList.remove('show');
    e.preventDefault();
    return;
  }
  const overlay = document.getElementById('overlay');
  if(overlay && overlay.classList.contains('show') && typeof closeSheet === 'function'){
    closeSheet();
    e.preventDefault();
  }
}
