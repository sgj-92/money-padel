// ===================== CAPTURE: ANY PART OF THE APP AS A PICTURE =====================
// Shaun, 8 Nov: "There's so many screenshots I'm taking, but I need a selector
// that can choose the area and I just copy/save the image. Ideally it allows
// me to go beyond full screen too to capture info that's in a long list."
//
// The camera in the header: tap it, tap the part you want -- a card, a table,
// a list -- adjust with Bigger / Smaller / Whole screen, and the picture is
// drawn from the page itself (html2canvas, vendored), so a long list comes out
// whole, top to bottom, and a table that scrolls sideways comes out full width.
// Then Share / Save, or Copy where the browser can.
//
// html2canvas is loaded on first use only. Declarations only.

const CAPTURE_LIB = 'assets/vendor/html2canvas-1.4.1.min.js';

let captureState = null;   // { selected, history: [], bar, box, onTap }

function captureLibrary(){
  if(typeof html2canvas === 'function') return Promise.resolve(html2canvas);
  if(captureLibrary._p) return captureLibrary._p;
  captureLibrary._p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CAPTURE_LIB;
    s.onload = () => resolve(html2canvas);
    s.onerror = () => { captureLibrary._p = null; reject(new Error('The picture maker could not be loaded.')); };
    document.head.appendChild(s);
  });
  return captureLibrary._p;
}

// The shell's own chrome is never what someone wants a picture of.
function captureIsChrome(el){
  return !!(el && el.closest && el.closest('.shell-header, .shell-bottom-nav, .capture-bar, .capture-sheet, .capture-box, #sectionSubnav, .desktop-rail'));
}

// From what was tapped to something worth a picture: the nearest block that
// is most of the screen wide and more than a line tall.
function captureBlockFor(el){
  const minW = Math.min(window.innerWidth, document.documentElement.clientWidth) * 0.6;
  let cur = el;
  while(cur && cur !== document.body){
    const r = cur.getBoundingClientRect();
    if(r.width >= minW && r.height >= 40) return cur;
    cur = cur.parentElement;
  }
  return el;
}

// One step out, skipping wrappers the same size as what is already chosen.
function captureParent(el){
  let cur = el.parentElement;
  const r0 = el.getBoundingClientRect();
  while(cur && cur !== document.body){
    const r = cur.getBoundingClientRect();
    if(Math.abs(r.height - r0.height) > 4 || Math.abs(r.width - r0.width) > 4) return cur;
    cur = cur.parentElement;
  }
  return null;
}

// The whole screen's content: the outermost block under the page itself.
function captureWhole(el){
  let cur = el;
  while(cur.parentElement && cur.parentElement !== document.body) cur = cur.parentElement;
  return cur;
}

// The area, in page coordinates: the chosen block's, or -- once it has been
// dragged, resized or drawn (Shaun, 8 Nov: "a way to drag the selector
// around") -- the free area itself.
function captureRect(){
  const st = captureState;
  if(!st) return null;
  if(st.rect) return st.rect;
  if(!st.selected) return null;
  const r = st.selected.getBoundingClientRect();
  return { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height };
}

function captureDrawBox(){
  const st = captureState;
  const r = captureRect();
  if(!st || !r){ if(st && st.box) st.box.style.display = 'none'; return; }
  Object.assign(st.box.style, { display: 'block', top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` });
  st.bar.querySelector('[data-cap-msg]').textContent = st.rect ? 'Drag the box or its corners; the page scrolls at the edges.' : 'Tap another part, drag the box or its corners, or:';
  st.bar.querySelectorAll('[data-cap-needs]').forEach(b => { b.disabled = false; });
  st.bar.querySelector('[data-cap="smaller"]').disabled = !st.history.length || !!st.rect;
  st.bar.querySelector('[data-cap="bigger"]').disabled = !st.selected || !captureParent(st.selected);
}

function captureSelect(el, keepHistory){
  const st = captureState;
  if(!st || !el) return;
  if(!keepHistory) st.history = [];
  st.selected = el;
  st.rect = null;
  captureDrawBox();
}

// Moving the box, a corner, or drawing a new one. Near the top or bottom of
// the screen the page scrolls, so an area can run past what is showing.
function captureDrag(e, mode){
  const st = captureState;
  if(!st) return;
  e.preventDefault(); e.stopPropagation();
  const r0 = captureRect() || { left: e.pageX, top: e.pageY, width: 0, height: 0 };
  const start = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
  let last = { x: e.clientX, y: e.clientY };
  const MIN = 24, EDGE = 64;
  // The bar steps aside while dragging: the bottom edge is where the page scrolls.
  document.body.classList.add('capture-dragging');
  const docW = document.documentElement.scrollWidth, docH = document.documentElement.scrollHeight;
  const apply = () => {
    const px = last.x + window.scrollX, py = last.y + window.scrollY;
    const dx = px - start.x, dy = py - start.y;
    let { left, top, width, height } = r0;
    if(mode === 'move'){ left += dx; top += dy; }
    else {
      const right = left + width, bottom = top + height;
      let L = left, T = top, R = right, B = bottom;
      if(mode === 'draw'){ L = Math.min(start.x, px); R = Math.max(start.x, px); T = Math.min(start.y, py); B = Math.max(start.y, py); }
      else {
        if(mode.includes('w')) L = Math.min(px, R - MIN);
        if(mode.includes('e')) R = Math.max(px, L + MIN);
        if(mode.includes('n')) T = Math.min(py, B - MIN);
        if(mode.includes('s')) B = Math.max(py, T + MIN);
      }
      left = L; top = T; width = R - L; height = B - T;
    }
    left = Math.max(0, Math.min(left, docW - width));
    top = Math.max(0, Math.min(top, docH - height));
    st.rect = { left, top, width: Math.min(width, docW), height };
    captureDrawBox();
  };
  const move = (ev) => { last = { x: ev.clientX, y: ev.clientY }; apply(); };
  const auto = setInterval(() => {
    const dir = last.y > window.innerHeight - EDGE ? 1 : last.y < EDGE ? -1 : 0;
    if(dir){ window.scrollBy(0, dir * 16); apply(); }
  }, 30);
  const up = () => {
    clearInterval(auto);
    document.body.classList.remove('capture-dragging');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if(st.drawLayer){ st.drawLayer.remove(); st.drawLayer = null; }
    if(st.rect && (st.rect.width < MIN || st.rect.height < MIN)){ st.rect = null; }
    // Lifting the finger after a drag also fires a click wherever it lands;
    // that click is the end of the drag, not a new choice.
    st.dragEndedAt = Date.now();
    captureDrawBox();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

// "Draw an area": the next press-and-drag draws a new box anywhere.
function captureStartDrawing(){
  const st = captureState;
  if(!st || st.drawLayer) return;
  const layer = document.createElement('div');
  layer.className = 'capture-draw';
  layer.addEventListener('pointerdown', (e) => { st.selected = null; st.history = []; captureDrag(e, 'draw'); });
  document.body.appendChild(layer);
  st.drawLayer = layer;
  st.bar.querySelector('[data-cap-msg]').textContent = 'Press and drag over the area you want.';
}

function startCapture(){
  if(captureState) return;
  const box = document.createElement('div');
  box.className = 'capture-box';
  box.style.display = 'none';
  box.innerHTML = ['nw', 'ne', 'sw', 'se'].map(h => `<span class="capture-handle capture-handle-${h}" data-handle="${h}"></span>`).join('');
  box.addEventListener('pointerdown', (e) => captureDrag(e, (e.target.dataset && e.target.dataset.handle) || 'move'));
  document.body.appendChild(box);
  const bar = document.createElement('div');
  bar.className = 'capture-bar';
  bar.innerHTML = `<div class="capture-msg" data-cap-msg>Tap the part you want a picture of.</div>
    <div class="capture-actions">
      <button type="button" data-cap="smaller" data-cap-needs disabled>Smaller</button>
      <button type="button" data-cap="bigger" data-cap-needs disabled>Bigger</button>
      <button type="button" data-cap="whole" data-cap-needs disabled>Whole screen</button>
    </div>
    <div class="capture-actions">
      <button type="button" data-cap="draw">Draw an area</button>
    </div>
    <div class="capture-actions">
      <button type="button" data-cap="cancel">Cancel</button>
      <button type="button" class="capture-go" data-cap="take" data-cap-needs disabled>Make picture</button>
    </div>`;
  document.body.appendChild(bar);
  document.body.classList.add('capture-mode');

  // Taps choose; they never press what they land on.
  const onTap = (e) => {
    if(captureIsChrome(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    if(captureState && captureState.dragEndedAt && Date.now() - captureState.dragEndedAt < 400) return;
    captureSelect(captureBlockFor(e.target));
  };
  document.addEventListener('click', onTap, true);
  const onScroll = () => captureDrawBox();
  window.addEventListener('resize', onScroll);
  captureState = { selected: null, history: [], bar, box, onTap, onScroll };

  bar.querySelector('[data-cap="cancel"]').onclick = endCapture;
  bar.querySelector('[data-cap="draw"]').onclick = captureStartDrawing;
  bar.querySelector('[data-cap="bigger"]').onclick = () => { const p = captureState.selected && captureParent(captureState.selected); if(p){ captureState.history.push(captureState.selected); captureSelect(p, true); } };
  bar.querySelector('[data-cap="smaller"]').onclick = () => { const c = captureState.history.pop(); if(c) captureSelect(c, true); };
  bar.querySelector('[data-cap="whole"]').onclick = () => {
    const from = captureState.selected || document.elementFromPoint(innerWidth / 2, innerHeight / 3);
    const w = from && captureWhole(from);
    if(w){ if(captureState.selected && !captureState.rect) captureState.history.push(captureState.selected); captureSelect(w, true); }
  };
  bar.querySelector('[data-cap="take"]').onclick = () => takeCapture(captureState.rect ? captureState.rect : captureState.selected);
}

function endCapture(){
  const st = captureState;
  if(!st) return;
  document.removeEventListener('click', st.onTap, true);
  window.removeEventListener('resize', st.onScroll);
  st.bar.remove(); st.box.remove();
  if(st.drawLayer) st.drawLayer.remove();
  document.body.classList.remove('capture-mode');
  captureState = null;
}

// The element as a picture, whole: past the bottom of the screen, and a table
// that scrolls sideways at its full width. Framed with the community's name
// and the date, on its own background.
async function capturePicture(el){
  if(!el || !el.offsetWidth || !el.offsetHeight) throw new Error('that part of the screen is not showing.');
  const h2c = await captureLibrary();
  const css = getComputedStyle(document.documentElement);
  const bg = (css.getPropertyValue('--bg0') || '').trim() || getComputedStyle(document.body).backgroundColor || '#0b0a08';
  // How much wider the widest sideways-scrolling part really is.
  let extra = 0;
  [el, ...el.querySelectorAll('*')].forEach(n => { if(n.scrollWidth > n.clientWidth + 2){ const ox = getComputedStyle(n).overflowX; if(ox === 'auto' || ox === 'scroll') extra = Math.max(extra, n.scrollWidth - n.clientWidth); } });
  // html2canvas 1.4.1 hands a gradient with no stop positions (the Tier S
  // badge's "linear-gradient(top, bottom)") a non-finite offset, and the
  // canvas throws. While a picture is made, such a stop goes first or last.
  const G = typeof CanvasGradient !== 'undefined' ? CanvasGradient.prototype : null;
  const addStop = G && G.addColorStop;
  if(G) G.addColorStop = function(offset, color){
    this.__stops = (this.__stops || 0) + 1;
    return addStop.call(this, Number.isFinite(offset) ? Math.min(1, Math.max(0, offset)) : (this.__stops === 1 ? 0 : 1), color);
  };
  let shot;
  try {
  shot = await h2c(el, {
    backgroundColor: bg, scale: 2, useCORS: true, logging: false,
    windowWidth: Math.max(document.documentElement.clientWidth, el.offsetWidth + extra),
    ignoreElements: (n) => n.classList && (n.classList.contains('capture-box') || n.classList.contains('capture-bar') || n.classList.contains('capture-sheet')),
    onclone: (doc, clone) => {
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
      clone.style.overflowX = 'visible';
      if(extra) clone.style.width = `${el.offsetWidth + extra}px`;
      clone.querySelectorAll('*').forEach(n => {
        const cs = doc.defaultView.getComputedStyle(n);
        if(/(auto|scroll|hidden)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 2){ n.style.maxHeight = 'none'; n.style.height = 'auto'; n.style.overflowY = 'visible'; }
        if(/(auto|scroll)/.test(cs.overflowX)){ n.style.overflowX = 'visible'; }
      });
    },
  });
  } finally { if(G) G.addColorStop = addStop; }
  return captureFrame(shot, bg, css);
}

// The frame: a margin and a quiet footer with the community and the date.
function captureFrame(shot, bg, css){
  const pad = 32, foot = 56;
  const out = document.createElement('canvas');
  out.width = shot.width + pad * 2;
  out.height = shot.height + pad * 2 + foot;
  const ctx = out.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(shot, pad, pad);
  ctx.fillStyle = (css.getPropertyValue('--text-dim') || '#bcb096').trim();
  ctx.font = '600 22px "Helvetica Neue", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  const d = new Date();
  ctx.fillText(`${CLUB.name} · ${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}`, pad, out.height - pad / 2 - foot / 2);
  return out;
}

// A free area: the page drawn as it is laid out, cropped to the area -- the
// same at any scroll position, so an area longer than the screen comes out
// whole.
async function captureAreaPicture(rect){
  const h2c = await captureLibrary();
  const css = getComputedStyle(document.documentElement);
  const bg = (css.getPropertyValue('--bg0') || '').trim() || '#0b0a08';
  const G = typeof CanvasGradient !== 'undefined' ? CanvasGradient.prototype : null;
  const addStop = G && G.addColorStop;
  if(G) G.addColorStop = function(offset, color){
    this.__stops = (this.__stops || 0) + 1;
    return addStop.call(this, Number.isFinite(offset) ? Math.min(1, Math.max(0, offset)) : (this.__stops === 1 ? 0 : 1), color);
  };
  let shot;
  try {
    shot = await h2c(document.body, {
      backgroundColor: bg, scale: 2, useCORS: true, logging: false,
      x: rect.left, y: rect.top, width: rect.width, height: rect.height,
      scrollX: 0, scrollY: 0, windowWidth: document.documentElement.clientWidth, windowHeight: window.innerHeight,
      ignoreElements: (n) => n.classList && (captureIsChrome(n) || n.classList.contains('capture-draw')),
    });
  } finally { if(G) G.addColorStop = addStop; }
  return captureFrame(shot, bg, css);
}

async function takeCapture(target){
  if(!target) return;
  const msg = captureState && captureState.bar.querySelector('[data-cap-msg]');
  if(msg) msg.textContent = 'Making the picture…';
  let cv;
  try { cv = target instanceof Element ? await capturePicture(target) : await captureAreaPicture(target); }
  catch(e){ if(msg) msg.textContent = `Couldn't make the picture: ${e.message}`; return; }
  endCapture();
  showCaptureResult(cv);
}

// The picture, then what to do with it. Share needs a fresh tap on a phone,
// so it is offered here rather than fired as the picture is made.
function showCaptureResult(cv){
  const d = new Date();
  const name = `${CLUB.fileSlug}-picture-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}.png`;
  const sheet = document.createElement('div');
  sheet.className = 'capture-sheet';
  const canCopy = typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write;
  sheet.innerHTML = `<div class="capture-sheet-panel">
      <div class="capture-preview"><img alt="The picture" src="${cv.toDataURL('image/png')}"></div>
      <div class="capture-size">${Math.round(cv.width / 2)} × ${Math.round(cv.height / 2)}</div>
      <div class="capture-actions">
        <button type="button" class="capture-go" data-capr="share">${navigator.share ? 'Share / Save' : 'Save'}</button>
        ${canCopy ? '<button type="button" data-capr="copy">Copy</button>' : ''}
        <button type="button" data-capr="close">Done</button>
      </div>
      <div class="capture-msg" data-capr-msg></div>
    </div>`;
  document.body.appendChild(sheet);
  const say = (t) => { sheet.querySelector('[data-capr-msg]').textContent = t; };
  const blob = () => new Promise(r => cv.toBlob(r, 'image/png'));
  sheet.querySelector('[data-capr="close"]').onclick = () => sheet.remove();
  sheet.querySelector('[data-capr="share"]').onclick = async () => {
    const file = new File([await blob()], name, { type: 'image/png' });
    const how = await CardPainter.share([file], { title: CLUB.name });
    say(how === 'shared' ? 'Shared.' : how === 'saved' ? 'Saved to your downloads.' : how === 'ready' ? 'Tap Share again.' : '');
  };
  const copy = sheet.querySelector('[data-capr="copy"]');
  if(copy) copy.onclick = async () => {
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob() })]); say('Copied — paste it anywhere.'); }
    catch(e){ say('This browser would not copy it. Use Share / Save.'); }
  };
}
