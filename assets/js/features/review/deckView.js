// ===================== MONTHLY REVIEW: THE DECK =====================
// Draws a Share Deck (domain/boardPack/shareDeck.js) as a swipeable run of
// portrait cards, and makes it move: a swipe (native horizontal scrolling
// with snap points -- no gesture library), the previous / next buttons, the
// dots, and the arrow keys. One drawing for both places a deck appears: the
// Admin's Board Pack preview and the public review page (review/), so what
// the Admin checks is what players see.
//
// Every card is 4:5, the portrait shape WhatsApp shows whole, so a
// screenshot -- or, later, an exported image -- is the card as seen.
//
// Knows nothing about the app: it takes the deck and draws it. Loads before
// app.js; declarations only.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeckView = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // The community (config/club.js): the page's, or Money Padel in Node.
  const club = () => (typeof CLUB !== 'undefined' ? CLUB : require('../../config/club.js').CLUB);
  const esc = (v) => String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Past this many cards, dots stop being readable (they wrap); a count and
  // a bar say the same thing in one line.
  const DOTS_MAX = 12;

  function brandHtml(o, month) {
    return `<header class="deck-brand">
      <img class="deck-mark" src="${esc(o.brandSrc)}" alt="" width="22" height="22">
      <span class="deck-brand-name">${esc(club().name)}</span>
      <span class="deck-brand-month">${esc(month)}</span>
    </header>`;
  }

  function rowHtml(r, hero) {
    return `<li class="deck-row${hero ? ' is-hero' : ''}">
      ${r.rank ? `<span class="deck-rank">${esc(r.rank)}</span>` : ''}
      <span class="deck-who">
        ${r.label ? `<span class="deck-row-label">${esc(r.label)}</span>` : ''}
        <span class="deck-name">${esc(r.name)}</span>
        ${r.sub ? `<span class="deck-sub">${esc(r.sub)}</span>` : ''}
      </span>
      ${r.value ? `<span class="deck-value">${esc(r.value)}</span>` : ''}
    </li>`;
  }

  // Kings of Tiers as the app draws them: a crowned tile per tier, the
  // crown tinted to the tier's metal. The tiles share the card between them
  // -- two side by side, three with the top tier across the top, four in a
  // square -- so the card is full whatever the month's count.
  function kingsHtml(s, o) {
    const rows = s.groups[0].rows;
    return `<div class="deck-kings" data-count="${rows.length}">${rows.map((r) => {
      const tier = String(r.tier || String(r.label || '').replace(/^Tier\s*/, '')).toLowerCase();
      return `<div class="deck-king deck-king-${esc(tier)}">
        ${o.crownSrc ? `<img class="deck-king-crown" src="${esc(o.crownSrc)}" alt="">` : ''}
        <div class="deck-king-name">${esc(r.name)}</div>
        <div class="deck-king-tier">${esc(r.label)}</div>
        <div class="deck-king-rating">${esc(r.value)}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function bodyHtml(s, o) {
    if (s.layout === 'kings' && s.groups && s.groups[0] && s.groups[0].rows.length) return kingsHtml(s, o);
    if (s.kind === 'note') {
      return `<div class="deck-note">${esc(s.body).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</div>`;
    }
    if (s.stats && s.stats.length) {
      return `<div class="deck-stats">${s.stats.map((x, i) => `<div class="deck-stat${i === 0 ? ' is-hero' : ''}">
        <div class="deck-stat-value">${esc(x.value)}</div><div class="deck-stat-label">${esc(x.label)}</div></div>`).join('')}</div>`;
    }
    const single = s.groups.length === 1;
    return s.groups.map((g) => `<div class="deck-group">
      ${g.label ? `<div class="deck-group-label">${esc(g.label)}</div>` : ''}
      <ol class="deck-rows">${g.rows.map((r, i) => rowHtml(r, single && i === 0)).join('')}</ol>
    </div>`).join('');
  }

  function slideHtml(s, i, n, o, month) {
    return `<section class="deck-slide" data-slide="${esc(s.id)}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}: ${esc(s.title)}">
      <article class="deck-card deck-card-${esc(s.kind)}">
        ${brandHtml(o, month)}
        <div class="deck-eyebrow">${esc(s.eyebrow)}</div>
        <h2 class="deck-title">${esc(s.title)}</h2>
        <div class="deck-body">${bodyHtml(s, o)}</div>
        ${s.foot ? `<footer class="deck-foot">${esc(s.foot)}</footer>` : ''}
      </article>
    </section>`;
  }

  // The cover and the closing card frame every deck; the slides between are
  // the Board Pack's.
  function coverHtml(deck, n, o, month) {
    return `<section class="deck-slide" data-slide="cover" role="group" aria-roledescription="slide" aria-label="1 of ${n}: ${esc(deck.title)}">
      <article class="deck-card deck-card-cover">
        <img class="deck-cover-mark" src="${esc(o.brandSrc)}" alt="" width="64" height="64">
        <div class="deck-cover-club">${esc(club().name)}</div>
        <h1 class="deck-cover-title">${esc(deck.cover ? deck.cover.title : month)}</h1>
        <div class="deck-cover-sub">${esc(deck.cover ? deck.cover.sub : 'Monthly Review')}</div>
        <div class="deck-cover-hint" aria-hidden="true">Swipe to begin →</div>
      </article>
    </section>`;
  }

  function endHtml(deck, n, o, month) {
    return `<section class="deck-slide" data-slide="end" role="group" aria-roledescription="slide" aria-label="${n} of ${n}: The full tables">
      <article class="deck-card deck-card-end">
        ${brandHtml(o, month)}
        <h2 class="deck-title">${esc(deck.closing ? deck.closing.title : `That’s ${month.split(' ')[0]}.`)}</h2>
        <p class="deck-end-text">${esc(deck.closing ? deck.closing.text : 'Every table, every game and your own month are in ' + club().name + '.')}</p>
        ${o.appLink ? `<a class="deck-end-link" href="${esc(o.appLink)}">View full stats in ${club().name}</a>` : ''}
      </article>
    </section>`;
  }

  // deck: a Share Deck; slides: the ones to show (already filtered for who is
  // looking). Options: brandSrc, crownSrc, appLink.
  function html(deck, slides, o) {
    const opts = o || {};
    // A player's deck names its month and its cover itself; the club's is
    // "<Month> Review".
    const month = deck.monthLabel || deck.title.replace(/ Review$/, '');
    const n = slides.length + 2;
    const cards = [coverHtml(deck, n, opts, month)]
      .concat(slides.map((s, i) => slideHtml(s, i + 1, n, opts, month)))
      .concat([endHtml(deck, n, opts, month)]);
    return `<div class="deck" data-deck tabindex="0" role="region" aria-roledescription="carousel" aria-label="${esc(deck.title)}">
      <div class="deck-track" data-deck-track>${cards.join('')}</div>
      <div class="deck-controls">
        <button type="button" class="deck-arrow" data-deck-prev aria-label="Previous slide">‹</button>
        ${n <= DOTS_MAX
          ? `<div class="deck-dots">${cards.map((_, i) => `<button type="button" class="deck-dot" data-deck-dot="${i}" aria-label="Slide ${i + 1} of ${n}"></button>`).join('')}</div>`
          : `<div class="deck-progress" aria-hidden="true"><div class="deck-count" data-deck-count>1 / ${n}</div><div class="deck-bar"><span data-deck-bar></span></div></div>`}
        <button type="button" class="deck-arrow" data-deck-next aria-label="Next slide">›</button>
      </div>
      <div class="deck-live" aria-live="polite"></div>
    </div>`;
  }

  // Make a drawn deck move. Returns { go(i), index(), count }.
  function mount(rootEl) {
    const deck = rootEl.matches && rootEl.matches('[data-deck]') ? rootEl : rootEl.querySelector('[data-deck]');
    if (!deck) return null;
    const track = deck.querySelector('[data-deck-track]');
    const slides = [...track.children];
    const dots = [...deck.querySelectorAll('[data-deck-dot]')];
    const prev = deck.querySelector('[data-deck-prev]');
    const next = deck.querySelector('[data-deck-next]');
    const live = deck.querySelector('.deck-live');
    const count = deck.querySelector('[data-deck-count]');
    const bar = deck.querySelector('[data-deck-bar]');
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = -1;

    function show(i) {
      if (i === index) return;
      index = i;
      deck.dataset.index = String(i);
      dots.forEach((d, k) => { if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      if (count) count.textContent = `${i + 1} / ${slides.length}`;
      if (bar) bar.style.width = `${((i + 1) / slides.length) * 100}%`;
      prev.disabled = i === 0;
      next.disabled = i === slides.length - 1;
      if (live) live.textContent = slides[i].getAttribute('aria-label') || '';
    }
    function go(i) {
      const to = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: to * track.clientWidth, behavior: still ? 'auto' : 'smooth' });
      show(to);
    }
    // A swipe is the track scrolling: whichever card it settles on is current.
    let pending = false;
    track.addEventListener('scroll', () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const w = track.clientWidth || 1;
        show(Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / w))));
      });
    }, { passive: true });
    prev.addEventListener('click', () => go(index - 1));
    next.addEventListener('click', () => go(index + 1));
    dots.forEach((d, k) => d.addEventListener('click', () => go(k)));
    deck.addEventListener('keydown', (e) => {
      const key = { ArrowRight: index + 1, ArrowLeft: index - 1, PageDown: index + 1, PageUp: index - 1, Home: 0, End: slides.length - 1 }[e.key];
      if (key === undefined) return;
      e.preventDefault();
      go(key);
    });
    show(0);
    return { go, index: () => index, count: slides.length };
  }

  return { html, mount };
});
