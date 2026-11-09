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
    // How long a competition period is (config/period.js): a month.
    period: { months: 1, noun: 'month' },
    // Matches in a period to qualify: its Race and Champion titles, its
    // Power rankings and Player of the Period shortlist.
    periodMinMatches: 5,
    // The read-only standings site (data/siteMode.js). Every host here also
    // needs its redirect rule in vercel.json (tests/club.test.js checks).
    standingsHosts: [/^mpstandings\./i],
    standingsDomain: 'mpstandings.sgj.luxe',
    // Admins sign in with their own email and password (data/adminAuth.js).
    adminAccounts: true,
    // The old shared Admin password: off since 5 Nov, when Money Padel's
    // Admin accounts and database rules went live (docs/ADMIN_SIGN_IN.md).
    legacyAdminPassword: false,
    // Its own record, loaded only for this community (index.html): the
    // pre-v3 base layer, the April/May display-only games, the old app's
    // ratings snapshot, who submitted the early games, the Box Office Cup.
    dataScripts: [
      'assets/js/clubs/moneypadel/history.js',
      'assets/js/clubs/moneypadel/productionSnapshot.js',
      'assets/js/clubs/moneypadel/historicalDisplayMatches.js',
    ],
    firebase: {
      apiKey: 'AIzaSyDIiA5NVo3jKCkr_Kzi8y1fJhzXsWNuVmY',
      authDomain: 'mp-dashboard-beta-v3.firebaseapp.com',
      projectId: 'mp-dashboard-beta-v3',
      storageBucket: 'mp-dashboard-beta-v3.firebasestorage.app',
      messagingSenderId: '1084285278543',
      appId: '1:1084285278543:web:c183d0e28374747a234d3a',
    },
  },

  // Dubai (Shaun, 4 Nov). Its addresses (5 Nov): padelchamps.sgj.luxe and
  // pcstandings.sgj.luxe, once they point at Vercel; until then, and on any
  // address no community claims, ?club=padelchampionships. Events, Americano
  // and the Invitational group come next (Ledger, 8 Nov).
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
    // Shaun, 5 Nov: judged by the quarter; 4 matches in it to qualify.
    period: { months: 3, noun: 'quarter' },
    periodMinMatches: 4,
    hosts: [/^padelchamps\./i],
    standingsHosts: [/^pcstandings\./i],
    standingsDomain: 'pcstandings.sgj.luxe',
    // A new community: its record starts empty (v3Bridge allowEmpty).
    recordStartsEmpty: true,
    // "Royal Amethyst" (Shaun, 5 Nov): deep violet in place of Money Padel's
    // black and gold; Tier S in silver. Every text colour 7:1 or better on
    // bg2 (text 15.3, text-dim 7.4, accent-bright 11.1). ui/components/clubTheme.js.
    theme: {
      css: {
        '--gold': '#a585ff', '--gold-bright': '#d4c4ff', '--gold-dim': '#7058c4', '--gold-soft': '#b39cff',
        '--bg0': '#0b0812', '--bg1': '#130f1d', '--bg2': '#1b1528', '--line': '#2f2545',
        '--text': '#f1ecfa', '--text-soft': '#d3cae6', '--text-dim': '#ada2c6',
        '--gold-rgb': '165,133,255', '--gold-bright-rgb': '212,196,255', '--text-rgb': '241,236,250',
        '--tier-s': '#e4e1ec', '--tier-s-rgb': '228,225,236', '--glow': '#24173f', '--badge-s-top': '#f4f1fb',
        // The redesign's accent family (its champagne, tokens.css): unused
        // until the redesign ships, set now so it arrives branded.
        '--accent': '#b39cff', '--accent-bright': '#d4c4ff', '--accent-ink': '#0b0812',
        '--accent-hairline': 'rgba(165,133,255,0.26)', '--accent-wash': 'rgba(165,133,255,0.08)',
        '--row-self': '#1d1830', '--icon-inactive': '#6f6787',
      },
      themeColor: '#0b0812',
      painter: {
        bg0: '#0b0812', top: '#1d1630', bottom: '#0f0c17', surface2: '#1b1528',
        text: '#f1ecfa', soft: '#d3cae6', dim: '#ada2c6',
        gold: '#a585ff', bright: '#d4c4ff', goldSoft: '#b39cff', goldDim: '#7058c4',
        goldRgb: '165,133,255', textRgb: '241,236,250', brightRgb: '212,196,255', tierSRgb: '228,225,236', tierS: '#e4e1ec',
      },
    },
    adminAccounts: true,
    legacyAdminPassword: false,
    dataScripts: [],
    // The old MP - Dashboard project, emptied and reused (Shaun, 8 Nov: the
    // account is at its project limit). Its id stays mp---dashboard.
    firebase: {
      apiKey: 'AIzaSyAYDCghLPhMLpHaxTbbC8Rm2sV09UlPKOw',
      authDomain: 'mp---dashboard.firebaseapp.com',
      projectId: 'mp---dashboard',
      storageBucket: 'mp---dashboard.firebasestorage.app',
      messagingSenderId: '10882600309',
      appId: '1:10882600309:web:4e3a8e186f465cc35bd73c',
    },
  },
};

const DEFAULT_CLUB_ID = 'moneypadel';

function resolveClub(loc){
  const host = String((loc && loc.hostname) || '');
  // Its app address or its standings address (pcstandings.… is Padel Championships).
  const byHost = Object.values(CLUBS).find(c => (c.hosts || []).concat(c.standingsHosts || []).some(re => re.test(host)));
  if(byHost) return byHost;
  const asked = /(?:^|[?&])club=([a-z0-9_-]+)/i.exec(String((loc && loc.search) || ''));
  if(asked && CLUBS[asked[1]]) return CLUBS[asked[1]];
  return CLUBS[DEFAULT_CLUB_ID];
}

const CLUB = resolveClub(typeof location !== 'undefined' ? location : null);

return { CLUBS, CLUB, DEFAULT_CLUB_ID, resolveClub };
});
