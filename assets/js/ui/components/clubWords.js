// ===================== THE COMMUNITY'S WORDS FOR ITS PERIOD =====================
// The app was written for Money Padel, whose period is a month: "Monthly
// Race", "Player of the Month", "this month" are written into ~380 places.
// A community judged by the quarter (Padel Championships, Shaun 5 Nov) reads
// "Quarterly Race", "Player of the Quarter", "this quarter" instead. This is
// that vocabulary, applied where text leaves the app -- the screen (watched,
// below), the pictures (CardPainter's canvas), copied and shared text -- the
// way a translation would be, rather than 380 edits.
//
// Where the period IS a month, every function here returns its input
// untouched and the screen is not watched: Money Padel is exactly as before.
//
// Only the words month / months / monthly change, keeping their case. A
// count ("3 months", "12-month") is a length of time, not the period, and is
// left alone. Month names (October) are never touched.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClubWords = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const period = () => (typeof Period !== 'undefined' ? Period : require('../../config/period.js'));

  function make(p) {
    const active = p.MONTHS !== 1;
    const noun = p.noun, adj = p.Adjective;
    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    const swap = {
      month: noun, Month: cap(noun), MONTH: noun.toUpperCase(),
      months: `${noun}s`, Months: `${cap(noun)}s`, MONTHS: `${noun.toUpperCase()}S`,
      monthly: adj.toLowerCase(), Monthly: adj, MONTHLY: adj.toUpperCase(),
    };
    const RE = /(\d+)?(\s|-)?\b(month|Month|MONTH|months|Months|MONTHS|monthly|Monthly|MONTHLY)\b/g;
    // A length of time -- "3 months", "a 12-month view" -- is not the period.
    // A year before the word ("Jul–Sep 2026 Monthly Race") is not a length.
    function text(s) {
      if (!active || typeof s !== 'string' || s.indexOf('onth') < 0 && s.indexOf('ONTH') < 0) return s;
      return s.replace(RE, (all, count, sep, w) => {
        const length = count && (sep === '-' || /s$/i.test(w) || (sep && count.length < 3 && /^month$/i.test(w)));
        return length ? all : `${count || ''}${sep || ''}${swap[w]}`;
      });
    }
    return { active, text };
  }

  const words = make(period());

  // A canvas whose measured and drawn text both use the community's words, so
  // a picture's layout is measured on the words it shows.
  function canvas(ctx) {
    if (!words.active || !ctx || ctx.__clubWords) return ctx;
    const measure = ctx.measureText.bind(ctx), fill = ctx.fillText.bind(ctx);
    ctx.measureText = (t) => measure(words.text(String(t)));
    ctx.fillText = (t, ...rest) => fill(words.text(String(t)), ...rest);
    ctx.__clubWords = true;
    return ctx;
  }

  // Copied and shared text, wherever in the app it is copied or shared from.
  function wrapOutgoing(nav) {
    if (!nav) return;
    if (nav.clipboard && nav.clipboard.writeText && !nav.clipboard.__clubWords) {
      const write = nav.clipboard.writeText.bind(nav.clipboard);
      try { nav.clipboard.writeText = (t) => write(words.text(String(t))); nav.clipboard.__clubWords = true; } catch (e) { /* read-only: left as is */ }
    }
    if (nav.share && !nav.__clubWordsShare) {
      const share = nav.share.bind(nav);
      try {
        nav.share = (data) => share(Object.assign({}, data, data && data.text ? { text: words.text(data.text) } : {}, data && data.title ? { title: words.text(data.title) } : {}));
        nav.__clubWordsShare = true;
      } catch (e) { /* read-only: left as is */ }
    }
  }

  // The page: rewrite what is there, then whatever is drawn later.
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  function fixNode(node) {
    if (node.nodeType === 3) {
      const v = words.text(node.nodeValue);
      if (v !== node.nodeValue) node.nodeValue = v;
      return;
    }
    if (node.nodeType !== 1 || node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'TEXTAREA') return;
    ATTRS.forEach((a) => {
      const v = node.getAttribute && node.getAttribute(a);
      if (v) { const n = words.text(v); if (n !== v) node.setAttribute(a, n); }
    });
    for (let c = node.firstChild; c; c = c.nextSibling) fixNode(c);
  }
  function watch(doc) {
    if (!words.active || !doc || typeof MutationObserver === 'undefined') return;
    if (typeof navigator !== 'undefined') wrapOutgoing(navigator);
    const run = () => {
      fixNode(doc.body);
      doc.title = words.text(doc.title);
      new MutationObserver((list) => list.forEach((m) => {
        if (m.type === 'characterData') fixNode(m.target);
        else m.addedNodes.forEach(fixNode);
      })).observe(doc.body, { childList: true, subtree: true, characterData: true });
    };
    if (doc.body) run(); else doc.addEventListener('DOMContentLoaded', run);
  }

  return { active: words.active, text: words.text, canvas, watch, make };
});
