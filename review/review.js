// ===================== MONTHLY REVIEW: THE PUBLIC PAGE =====================
// review/?m=YYYY-MM -- the link an Admin shares into the club's WhatsApp.
// review/ (no month) -- the published months, newest first, each opening its
// deck: the standings site's Monthly tab (Shaun, 1 Nov).
// review/?p=<token> -- one player's Monthly Pack, by its private link. The
// token is 128 random bits, the only name the pack is stored under (in its
// own playerPacks collection), so a pack cannot be reached by changing a
// month, a name or an id in the address.
// It shows the review exactly as it was published: the stored slides, drawn
// by the same deck the Admin previewed. Nothing is recalculated here, so a
// September review reads the same in December whatever has been recorded
// since. No unlock is needed; no Admin control is on the page. Slides built
// on a section the club has made Admin-only are left out.

(function () {
  var params = new URLSearchParams(location.search);
  var month = params.get('m') || '';
  var token = params.get('p');
  var PLAYER_TOKEN = /^[A-Za-z0-9_-]{22}$/;
  var main = document.getElementById('reviewMain');
  var actions = document.getElementById('reviewActions');
  var toast = document.getElementById('reviewToast');
  var appLink = new URL('../', location.href).href;
  var shareUrl = location.origin + location.pathname + (token !== null ? '?p=' + encodeURIComponent(token) : '?m=' + encodeURIComponent(month));

  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function say(text) {
    toast.textContent = text;
    clearTimeout(say.t);
    say.t = setTimeout(function () { toast.textContent = ''; }, 2400);
  }
  function empty(title, text) {
    main.innerHTML = '<div class="review-empty" data-review-empty><h1>' + esc(title) + '</h1><p>' + esc(text) +
      '</p><p><a href="' + esc(appLink) + '">' + esc(backLabel) + '</a></p></div>';
    window.REVIEW_READY = true;
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return Promise.resolve(ok);
    } catch (e) { return Promise.resolve(false); }
  }

  // A Player Pack: the stored deck under its token, or nothing. A wrong or
  // unknown token says no more than a withdrawn one does.
  async function bootPlayer() {
    var gone = function () { return empty('Monthly Pack', 'This Monthly Pack is not available. Ask the club for a new link.'); };
    if (!PLAYER_TOKEN.test(token)) return gone();
    if (!storageAvailable()) return empty('Monthly Pack', 'This page can’t reach Money Padel right now. Try again in a moment.');
    var got = await Promise.all([fsGetIn('playerPacks', token), fsGetJson(STORAGE_KEY_VISIBILITY, {}, 'visibility')]);
    var pub = got[0] ? JSON.parse(got[0]) : null, vis = got[1] || {};
    if (!pub || pub.withdrawn || pub.kind !== 'player' || pub.token !== token || !pub.deck || !Array.isArray(pub.deck.slides)) return gone();
    // The same rule as the club's review: a section the club has made
    // Admin-only stays out of a shared pack too.
    show(pub.deck, ShareDeck.visibleSlides(pub.deck, function (k) { return vis[k] !== false; }));
  }

  function show(deck, slides) {
    document.title = deck.title + ' · Money Padel';
    document.getElementById('reviewTitle').textContent = deck.title;
    main.innerHTML = DeckView.html(deck, slides, { brandSrc: '../assets/brand/mp-mark.svg', crownSrc: '../assets/rankings/podium-crown-laurel.png', appLink: appLink });
    DeckView.mount(main);

    // Share where the phone offers its own share sheet (WhatsApp is on it);
    // otherwise copy the link.
    if (navigator.share) {
      actions.innerHTML = '<button type="button" class="review-btn" id="reviewShare">Share</button>';
      document.getElementById('reviewShare').onclick = function () {
        navigator.share({ title: 'Money Padel — ' + deck.title, url: shareUrl }).catch(function () {});
      };
    } else {
      actions.innerHTML = '<button type="button" class="review-btn" id="reviewCopyLink">Copy link</button>';
      document.getElementById('reviewCopyLink').onclick = function () {
        copy(shareUrl).then(function (ok) { say(ok ? 'Link copied' : shareUrl); });
      };
    }
    // A club review leads back to the list of months (a player's private
    // pack does not: it is not one of the club's).
    if (token === null) actions.insertAdjacentHTML('afterbegin', '<a class="review-btn review-btn-quiet" href="./" id="reviewAllMonths">All months</a>');
    window.REVIEW_READY = true;
  }

  // On the standings site the way back is to the standings, not "the app".
  var backLabel = /^mpstandings\./i.test(location.hostname) ? 'Back to the standings' : 'Open Money Padel';

  // The months a review could have been published for: this one and the
  // two years before it, asked for at once. Only published, not withdrawn,
  // reviews are listed.
  async function bootIndex() {
    document.getElementById('reviewTitle').textContent = 'Monthly Reviews';
    if (!storageAvailable()) return empty('Monthly Reviews', 'This page can’t reach Money Padel right now. Try again in a moment.');
    var now = new Date();
    var months = [];
    for (var i = 0; i < 24; i++) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    var got = await Promise.all(months.map(function (m) { return loadPublishedReview(m).catch(function () { return null; }); }));
    var live = months.filter(function (m, i) { var p = got[i]; return p && !p.withdrawn && p.deck && Array.isArray(p.deck.slides); });
    if (!live.length) return empty('Monthly Reviews', 'No monthly review has been published yet.');
    main.innerHTML = '<div class="review-index" data-review-index>' +
      '<h1>Monthly Reviews</h1><p class="review-index-sub">Swipe through each month at Money Padel.</p>' +
      live.map(function (m) {
        var deck = got[months.indexOf(m)].deck;
        return '<a class="review-index-row" href="?m=' + m + '"><span class="review-index-month">' + esc(ShareDeck.monthLabel(m)) + '</span>' +
          '<span class="review-index-count">' + deck.slides.length + ' slides</span><span class="review-index-chev" aria-hidden="true">›</span></a>';
      }).join('') +
      '<p class="review-index-back"><a href="' + esc(appLink) + '">' + esc(backLabel) + '</a></p></div>';
    window.REVIEW_READY = true;
  }

  async function boot() {
    if (token !== null) return bootPlayer();
    if (!month) return bootIndex();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return empty('No review chosen', 'This link does not name a month.');
    var label = ShareDeck.monthLabel(month);
    if (!storageAvailable()) return empty(label + ' Review', 'This page can’t reach Money Padel right now. Try again in a moment.');
    var got = await Promise.all([loadPublishedReview(month), fsGetJson(STORAGE_KEY_VISIBILITY, {}, 'visibility')]);
    var pub = got[0], vis = got[1] || {};
    if (pub && pub.withdrawn) {
      return empty(label + ' Review', 'The ' + label + ' review is no longer available.');
    }
    if (!pub || !pub.deck || !Array.isArray(pub.deck.slides)) {
      return empty(label + ' Review', 'The ' + label + ' review hasn’t been published yet.');
    }
    var deck = pub.deck;
    show(deck, ShareDeck.visibleSlides(deck, function (k) { return vis[k] !== false; }));
  }

  boot().catch(function (e) {
    console.error('review failed', e);
    empty('Monthly Review', 'Something went wrong loading this review.');
  });
})();
