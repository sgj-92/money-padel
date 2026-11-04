// ===================== BUILD STAMP =====================
// Turns the build a device is running into the quiet line at the bottom of
// More, and the one-line version that tapping it copies for a bug report.
//
// The input is window.MP_BUILD, which comes from assets/js/buildInfo.js. Each
// host writes that file at deploy time with the commit being deployed -- on
// GitHub Pages the Jekyll build renders buildInfo.pages.js, on Vercel
// scripts/stamp-build.js writes it -- and locally it is a placeholder with no
// SHA. This module does not know or care which host built it. It
// is loaded in the same page load as the rest of the app, never fetched later
// or asked of GitHub -- a device running an old build must say it is running
// the old build, and GitHub only knows the newest.
//
// The date is the build's date, carried in the stamp, never `new Date()`: an
// old cached app opened tomorrow must not claim tomorrow.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BuildStamp = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  // The community (config/club.js): the page's, or Money Padel in Node.
  const club = () => (typeof CLUB !== 'undefined' ? CLUB : require('./config/club.js').CLUB);
  const PRODUCT = club().productName;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // A stamp is only believed when it looks like one. Anything else -- the
  // local placeholder, an unrendered Liquid tag, an empty string -- is shown
  // as a local build rather than as a plausible-looking wrong answer.
  function shortSha(sha) {
    return typeof sha === 'string' && /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7).toLowerCase() : null;
  }
  function isoDate(date) {
    if (typeof date !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return null;
    return date;
  }
  // "2026-09-26" -> "26 Sep 2026", read as a calendar date. Parsing it with
  // Date would shift it across midnight in some time zones.
  function displayDate(iso) {
    const [y, mo, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[mo - 1]} ${y}`;
  }

  function describe(info) {
    const sha = shortSha(info && info.sha);
    const date = isoDate(info && info.date);
    if (!sha) {
      return { deployed: false, sha: null, date: null,
        title: `${PRODUCT} · local build`, build: 'Build dev', copyText: `${PRODUCT} · local build` };
    }
    return {
      deployed: true, sha, date,
      title: date ? `${PRODUCT} · ${displayDate(date)}` : PRODUCT,
      build: `Build ${sha}`,
      copyText: [PRODUCT, date, sha].filter(Boolean).join(' · '),
    };
  }

  // ---- Is there a newer build? ----
  // The deployed buildInfo.js, fetched fresh, read for its commit. Only the
  // stamp's own shape is believed (`window.MP_BUILD = { sha: "...", ... }`).
  function deployedSha(text) {
    const m = /MP_BUILD\s*=\s*\{[^}]*\bsha\s*:\s*["']([0-9a-f]{7,40})["']/i.exec(String(text || ''));
    return m ? m[1].toLowerCase() : null;
  }
  // A different, believable commit is a newer build. A device on a local or
  // unstamped build never nags, and neither does a failed read.
  function isNewer(runningSha, deployed) {
    const a = shortSha(runningSha), b = shortSha(deployed);
    return !!(a && b && a !== b);
  }

  return { describe, shortSha, PRODUCT, deployedSha, isNewer };
}));
