// ===================== UI: NATIVE FEEL =====================
// Shaun, 22 Nov: "feel like a polished native iOS app rather than a web
// form." Wires what can't be said in CSS (assets/css/native.css): pulling a
// sheet down to close it, and pill switches for short dropdowns wherever
// they're drawn. Called once by the shell. Declarations only.

let nativeFeelInstalled = false;
function nativeFeelInstall(){
  if(nativeFeelInstalled) return;
  nativeFeelInstalled = true;
  document.addEventListener('touchstart', sheetDragStart, { passive: true });
  document.addEventListener('touchmove', sheetDragMove, { passive: false });
  document.addEventListener('touchend', sheetDragEnd, { passive: true });
  document.addEventListener('touchcancel', sheetDragEnd, { passive: true });
  segEnhanceWithin(document.body);
  new MutationObserver((records) => {
    records.forEach(r => r.addedNodes.forEach(n => { if(n.nodeType === 1) segEnhanceWithin(n); }));
  }).observe(document.body, { childList: true, subtree: true });
}
