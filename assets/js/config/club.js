// ===================== THE COMMUNITY: ONE SETTINGS FILE =====================
// Shaun, 4 Nov: the app is to run for other padel communities -- their own
// domain, players, name and look -- starting with Padel Championships
// (Dubai). Everything that is one community's rather than the product's is
// here; the rest of the app reads CLUB and never names a community itself.
//
// What is NOT here, on purpose:
//   * Storage keys (moneypadel_…). Each community has its own Firebase
//     project and each domain its own browser storage, so the same key names
//     can never collide -- and Money Padel's live data keeps its names.
//   * Tiers, rating anchors and competition rules. They are the next step
//     (Ledger, 4 Nov): the engine's tiers stay Money Padel's until then.
//
// Which community: the first whose `hosts` match the page's hostname, else
// ?club=<id> (for local testing), else Money Padel -- so every address the
// app has ever been served on keeps working unchanged.
//
// Loads first, before the Firestore connection. In the page it sets CLUB
// (and CLUBS); in Node -- the tests, the scripts -- require() it, and the
// community is Money Padel.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.CLUBS = api.CLUBS; root.CLUB = api.CLUB; }
})(typeof self !== 'undefined' ? self : this, function () {
const CLUBS = {
  moneypadel: {
    id: 'moneypadel',
    name: 'Money Padel',
    // The header's wordmark: the second word is drawn in gold.
    wordmark: ['Money', 'Padel'],
    // The main group's results channel, named on the rankings screens.
    resultsGroup: 'Results Only',
    // Home-screen and browser-tab names.
    appTitle: 'MP Beta',
    homeScreenTitle: 'MP Beta v3',
    productName: 'Money Padel Beta',
    // File names for pictures and PDFs: money-padel-2026-10-…
    fileSlug: 'money-padel',
    logo: 'assets/brand/mp-mark.svg',
    // Shown if the logo cannot load.
    monogram: 'MP',
    hosts: [/^moneypadel\./i, /^mpstandings\./i, /^mpr\./i, /^mp-dashboard-new-ratings\b/i, /^money-padel\b/i],
    // The read-only standings site (data/siteMode.js). Every host here also
    // needs its redirect rule in vercel.json (tests/club.test.js checks).
    standingsHosts: [/^mpstandings\./i],
    standingsDomain: 'mpstandings.sgj.luxe',
    firebase: {
      apiKey: 'AIzaSyDIiA5NVo3jKCkr_Kzi8y1fJhzXsWNuVmY',
      authDomain: 'mp-dashboard-beta-v3.firebaseapp.com',
      projectId: 'mp-dashboard-beta-v3',
      storageBucket: 'mp-dashboard-beta-v3.firebasestorage.app',
      messagingSenderId: '1084285278543',
      appId: '1:1084285278543:web:c183d0e28374747a234d3a',
    },
  },

  // Dubai (Shaun, 4 Nov). Not live yet: no domain and no Firebase project,
  // so it is reached only as ?club=padelchampionships on an address no
  // community claims (a laptop, the tests) -- and with no database it shows
  // an empty record. Its logo and colours are placeholders until it has a
  // brand; its tiers, rules, events and the Invitational group are the next
  // steps (Ledger, 4 Nov).
  padelchampionships: {
    id: 'padelchampionships',
    name: 'Padel Championships',
    wordmark: ['Padel', 'Championships'],
    resultsGroup: 'Results',
    appTitle: 'Padel Championships',
    homeScreenTitle: 'Padel Champs',
    productName: 'Padel Championships',
    fileSlug: 'padel-championships',
    logo: 'assets/brand/pc-mark.svg',
    monogram: 'PC',
    hosts: [],
    standingsHosts: [],
    standingsDomain: null,
    firebase: null,
  },
};

const DEFAULT_CLUB_ID = 'moneypadel';

function resolveClub(loc){
  const host = String((loc && loc.hostname) || '');
  const byHost = Object.values(CLUBS).find(c => (c.hosts || []).some(re => re.test(host)));
  if(byHost) return byHost;
  const asked = /(?:^|[?&])club=([a-z0-9_-]+)/i.exec(String((loc && loc.search) || ''));
  if(asked && CLUBS[asked[1]]) return CLUBS[asked[1]];
  return CLUBS[DEFAULT_CLUB_ID];
}

const CLUB = resolveClub(typeof location !== 'undefined' ? location : null);

return { CLUBS, CLUB, DEFAULT_CLUB_ID, resolveClub };
});
