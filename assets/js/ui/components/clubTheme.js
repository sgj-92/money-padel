// ===================== THE COMMUNITY'S COLOURS =====================
// Money Padel's black and gold are the stylesheet's own values (app.css
// :root). A community with its own brand (config/club.js `theme`) replaces
// them here, before the page is first drawn, so it never flashes gold:
//
//   theme.css        CSS variables, by their stylesheet names
//   theme.themeColor the phone's browser bar
//   theme.painter    the pictures' palette (features/review/cardPainter.js)
//
// Padel Championships: "Royal Amethyst" (Shaun, 5 Nov).

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClubTheme = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const club = () => (typeof CLUB !== 'undefined' ? CLUB : require('../../config/club.js').CLUB);

  function apply(doc) {
    const theme = club().theme;
    if (!theme || !doc || !doc.documentElement) return false;
    Object.entries(theme.css || {}).forEach(([k, v]) => doc.documentElement.style.setProperty(k, v));
    if (theme.themeColor) doc.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', theme.themeColor));
    return true;
  }

  return { apply };
});
