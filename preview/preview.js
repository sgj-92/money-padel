// ===================== PHONE AND DESKTOP PREVIEW =====================
// A review utility, not part of the app: it frames the real, current app in a
// phone-sized iframe so it can be checked at phone widths on a laptop without
// DevTools -- and, at the desktop presets, at laptop and monitor sizes, so the
// desktop layout can be checked from a smaller screen (scaled to fit). Nothing here is loaded by index.html, and nothing in the app knows
// it is being previewed.
//
// The rules it keeps:
//   - The iframe loads the NORMAL app URL (never this page), same-origin, so
//     it is the same code, the same data and the same device state (My Player)
//     as opening the app directly -- and it cannot frame itself.
//   - The iframe really is 375 / 390 / 412 CSS pixels wide. Fitting a short
//     laptop screen scales the whole device with a transform, which leaves the
//     app's own viewport, media queries and layout untouched.
//   - On a phone-sized screen there is no frame, only a link to the app.
//
// The pure parts are exported for tests (tests/preview.test.js).

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MPPreview = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const PRESETS = [
    { width: 375, height: 812, note: 'Compact iPhone · regression width' },
    { width: 390, height: 844, note: 'iPhone · primary design width' },
    { width: 412, height: 915, note: 'Larger Android / Samsung' },
    // Desktop presets: the app's own desktop layout (assets/css/layout/
    // desktop.css). Landscape already; there is nothing to rotate.
    { width: 1280, height: 800, note: 'Laptop', desktop: true },
    { width: 1440, height: 900, note: 'Large laptop', desktop: true },
    { width: 1920, height: 1080, note: 'Desktop monitor', desktop: true },
  ];
  const DEFAULT_WIDTH = 390;
  // The frame's bezel on each side, in CSS pixels. Part of the device's size
  // when fitting it to the window; never part of the app's viewport.
  const BEZEL = 8;
  // Below this the reader is on a phone (or a phone on its side): framing a
  // phone inside a phone helps nobody.
  const MIN_DESKTOP = { width: 600, height: 480 };

  function preset(width) {
    return PRESETS.find((p) => p.width === Number(width)) || PRESETS.find((p) => p.width === DEFAULT_WIDTH);
  }

  // The app's viewport for a preset and orientation.
  function viewport(width, landscape) {
    const p = preset(width);
    return landscape && !p.desktop ? { width: p.height, height: p.width } : { width: p.width, height: p.height };
  }

  // Where the app lives, from where this page is served. The page sits in
  // preview/ beside index.html, so the app is its parent folder -- '/' on
  // Vercel and locally, '/<repo>/' on GitHub Pages. Returns null for a path
  // it does not recognise; the page then falls back to '../'.
  function appPath(pathname) {
    const m = /^(.*\/)preview(?:\/(?:index\.html)?)?$/.exec(String(pathname || ''));
    return m ? m[1] : null;
  }

  // The largest scale, never above 1, at which the whole device fits.
  function fitScale(device, available) {
    const s = Math.min(1, available.width / device.width, available.height / device.height);
    return s > 0 ? s : 1;
  }

  function isDesktop(win) {
    return win.innerWidth >= MIN_DESKTOP.width && win.innerHeight >= MIN_DESKTOP.height;
  }

  // Desktop browsers give anything that scrolls a classic scrollbar that takes
  // its width out of the layout; a phone's scrollbar overlays the content and
  // takes nothing. Hide them inside the frame -- the page and every scrolling
  // list -- so a 390px preview lays the app out across 390px, as the phone
  // does. (The app styles no scrollbars of its own.) This touches the framed
  // document's presentation only -- no app code, class or behaviour.
  const SCROLLBAR_CSS = '*{scrollbar-width:none}*::-webkit-scrollbar{display:none}';

  function start(doc, win) {
    const $ = (id) => doc.getElementById(id);
    const app = appPath(win.location.pathname) || new URL('../', win.location.href).pathname;
    const state = { width: DEFAULT_WIDTH, landscape: false };
    let frame = null;

    $('openFull').href = app;
    $('openNormally').href = app;

    function hideScrollbars() {
      try {
        const d = frame.contentDocument;
        if (!d || d.getElementById('mpPreviewScrollbars')) return;
        const style = d.createElement('style');
        style.id = 'mpPreviewScrollbars';
        style.textContent = SCROLLBAR_CSS;
        (d.head || d.documentElement).appendChild(style);
      } catch (e) { /* not same-origin: leave it as it is */ }
    }

    function build() {
      if (frame) return;
      frame = doc.createElement('iframe');
      frame.id = 'appFrame';
      frame.title = 'App preview';
      frame.src = app;
      frame.addEventListener('load', hideScrollbars);
      $('device').appendChild(frame);
      // The framed document exists (about:blank, then the app) before 'load';
      // catch it as early as it becomes the app's.
      const early = win.setInterval(() => {
        try {
          if (frame.contentDocument && frame.contentDocument.head && frame.contentWindow.location.pathname === app) {
            hideScrollbars(); win.clearInterval(early);
          }
        } catch (e) { win.clearInterval(early); }
      }, 20);
      win.setTimeout(() => win.clearInterval(early), 10000);
    }

    function layout() {
      const desktop = isDesktop(win) && win.top === win.self;
      doc.body.classList.toggle('is-narrow', !desktop);
      if (!desktop) return;
      build();
      const vp = viewport(state.width, state.landscape);
      const outer = { width: vp.width + 2 * BEZEL, height: vp.height + 2 * BEZEL };
      const bar = $('toolbar').getBoundingClientRect().height;
      const pad = 24;
      const scale = fitScale(outer, { width: win.innerWidth - 2 * pad, height: win.innerHeight - bar - 2 * pad });
      const device = $('device');
      device.style.width = outer.width + 'px';
      device.style.height = outer.height + 'px';
      device.style.transform = scale < 1 ? `scale(${scale})` : '';
      frame.style.width = vp.width + 'px';
      frame.style.height = vp.height + 'px';
      const fit = $('fit');
      fit.style.width = Math.floor(outer.width * scale) + 'px';
      fit.style.height = Math.floor(outer.height * scale) + 'px';
      doc.querySelectorAll('[data-width]').forEach((b) => {
        b.setAttribute('aria-pressed', String(Number(b.dataset.width) === state.width));
      });
      const desk = !!preset(state.width).desktop;
      $('rotate').setAttribute('aria-pressed', String(state.landscape && !desk));
      $('rotate').disabled = desk;
      doc.body.classList.toggle('is-desktop-preset', desk);
      $('readout').textContent = `${vp.width} × ${vp.height}` + (scale < 1 ? ` · shown at ${Math.round(scale * 100)}%` : '');
      doc.body.dataset.width = String(vp.width);
      doc.body.dataset.scale = String(scale);
    }

    doc.querySelectorAll('[data-width]').forEach((b) => {
      b.title = preset(b.dataset.width).note;
      b.addEventListener('click', () => { state.width = Number(b.dataset.width); layout(); });
    });
    $('rotate').addEventListener('click', () => { state.landscape = !state.landscape; layout(); });
    $('refresh').addEventListener('click', () => {
      if (!frame) return;
      try { frame.contentWindow.location.reload(); } catch (e) { frame.src = app; }
    });
    win.addEventListener('resize', layout);
    layout();
    return { layout, state, app };
  }

  return { PRESETS, DEFAULT_WIDTH, BEZEL, MIN_DESKTOP, preset, viewport, appPath, fitScale, isDesktop, start };
});
