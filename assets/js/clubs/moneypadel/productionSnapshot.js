// ===================== PRODUCTION COMPARISON SNAPSHOT (READ-ONLY) =====================
// A frozen export of the LEGACY PRODUCTION ratings, taken 2026-09-16T16:32:02Z
// from the `mp---dashboard` project.
//
// THIS IS REFERENCE DATA. IT IS NEVER AN INPUT TO ANYTHING.
// It cannot affect v3 Power Rating, Reliability, effective evidence, Monthly
// Performance, pre-match expectations, the Rating Journey or tier history. It
// is held in its own file, like HISTORICAL_DISPLAY_MATCHES, so that feeding it
// into a calculation requires a deliberate edit rather than a forgotten filter.
//
// It is NOT the beta's locally recomputed computeElo value. That is a third,
// different number -- the beta match set no longer matches production's -- and
// must never be labelled "Production".
//
// It goes stale: production keeps receiving matches. Always display it with its
// date. Production used 149 matches to v3's 150, and 17 players' match counts
// disagree, so treat it as an approximate reference, not a reconcilable truth.
const PRODUCTION_SNAPSHOT = {
  "snapshot_metadata": {
    "export_timestamp_utc": "2026-09-16T16:32:02Z",
    "production_firebase_project_id": "mp---dashboard",
    "production_rating_model_version": null,
    "rating_model_notes": "No formal version string exists in production. Algorithm: iterative joint-equilibrium rating solver (K=28, 300 epochs over the full match set per computation), tier-seeded (S=2000, A=1700, B=1400, C=1100). Code executed for this snapshot was the unmodified app.js/shell.js from git commit 59c6f7bdce93e02f87820176cbba68d95a8c89a5 (branch claude/extract-upload-github-zip-8e2d3c, identical tree to main at time of export).",
    "total_players_exported": 34,
    "total_matches_used_in_rating_engine": 149,
    "total_players_currently_ranked": 19,
    "data_range_used": "verified (June 2026 onwards only) -- production's existing default filter, unaffected by this export.",
    "purpose": "Read-only reference snapshot for Money Padel Prestige v3 (separate Firebase project) comparison purposes only. Not sourced from or written to any v3 system."
  },
  "players": [
    {
      "player_id": null,
      "name": "Manny",
      "tier": "S",
      "power_rating": 2012.7,
      "rank": null,
      "total_matches": 2,
      "active": true
    },
    {
      "player_id": null,
      "name": "Kaz",
      "tier": "A",
      "power_rating": 1768.1,
      "rank": 1,
      "total_matches": 22,
      "active": true
    },
    {
      "player_id": null,
      "name": "Erf",
      "tier": "A",
      "power_rating": 1722,
      "rank": 2,
      "total_matches": 26,
      "active": true
    },
    {
      "player_id": null,
      "name": "Del",
      "tier": "A",
      "power_rating": 1709,
      "rank": null,
      "total_matches": 1,
      "active": false
    },
    {
      "player_id": null,
      "name": "Osh",
      "tier": "A",
      "power_rating": 1704.3,
      "rank": 3,
      "total_matches": 30,
      "active": true
    },
    {
      "player_id": null,
      "name": "KC",
      "tier": "A",
      "power_rating": 1702.2,
      "rank": 4,
      "total_matches": 28,
      "active": true
    },
    {
      "player_id": null,
      "name": "Len",
      "tier": "A",
      "power_rating": 1658.1,
      "rank": 5,
      "total_matches": 31,
      "active": true
    },
    {
      "player_id": null,
      "name": "Dennis",
      "tier": "A",
      "power_rating": 1641.9,
      "rank": null,
      "total_matches": 9,
      "active": true
    },
    {
      "player_id": null,
      "name": "Ant Slice",
      "tier": "A",
      "power_rating": 1615.1,
      "rank": null,
      "total_matches": 6,
      "active": true
    },
    {
      "player_id": null,
      "name": "Eli",
      "tier": "A",
      "power_rating": 1590.7,
      "rank": 6,
      "total_matches": 32,
      "active": true
    },
    {
      "player_id": null,
      "name": "PDM",
      "tier": "B",
      "power_rating": 1485.9,
      "rank": 7,
      "total_matches": 35,
      "active": true
    },
    {
      "player_id": null,
      "name": "Rishi",
      "tier": "B",
      "power_rating": 1483.9,
      "rank": 8,
      "total_matches": 71,
      "active": true
    },
    {
      "player_id": null,
      "name": "Harry",
      "tier": "B",
      "power_rating": 1434.4,
      "rank": 9,
      "total_matches": 29,
      "active": true
    },
    {
      "player_id": null,
      "name": "MK",
      "tier": "B",
      "power_rating": 1430.9,
      "rank": 10,
      "total_matches": 14,
      "active": true
    },
    {
      "player_id": null,
      "name": "Max",
      "tier": "B",
      "power_rating": 1425.7,
      "rank": 11,
      "total_matches": 50,
      "active": true
    },
    {
      "player_id": null,
      "name": "Omar",
      "tier": "B",
      "power_rating": 1423.6,
      "rank": 12,
      "total_matches": 10,
      "active": true
    },
    {
      "player_id": null,
      "name": "Antz",
      "tier": "B",
      "power_rating": 1417.6,
      "rank": 13,
      "total_matches": 18,
      "active": true
    },
    {
      "player_id": null,
      "name": "Mulley",
      "tier": "B",
      "power_rating": 1405.1,
      "rank": null,
      "total_matches": 1,
      "active": true
    },
    {
      "player_id": null,
      "name": "Shaun",
      "tier": "B",
      "power_rating": 1399,
      "rank": 14,
      "total_matches": 21,
      "active": true
    },
    {
      "player_id": null,
      "name": "Carla",
      "tier": "B",
      "power_rating": 1389.8,
      "rank": null,
      "total_matches": 1,
      "active": false
    },
    {
      "player_id": null,
      "name": "Stormzy",
      "tier": "B",
      "power_rating": 1389,
      "rank": 15,
      "total_matches": 18,
      "active": true
    },
    {
      "player_id": null,
      "name": "Chloe",
      "tier": "B",
      "power_rating": 1366.9,
      "rank": null,
      "total_matches": 7,
      "active": true
    },
    {
      "player_id": null,
      "name": "Rocky",
      "tier": "B",
      "power_rating": 1353.8,
      "rank": 16,
      "total_matches": 16,
      "active": true
    },
    {
      "player_id": null,
      "name": "Tarique",
      "tier": "B",
      "power_rating": 1352.1,
      "rank": null,
      "total_matches": 6,
      "active": true
    },
    {
      "player_id": null,
      "name": "Tom",
      "tier": "B",
      "power_rating": 1351.9,
      "rank": 17,
      "total_matches": 20,
      "active": true
    },
    {
      "player_id": null,
      "name": "Jords",
      "tier": "B",
      "power_rating": 1311.3,
      "rank": 18,
      "total_matches": 35,
      "active": true
    },
    {
      "player_id": null,
      "name": "Fatch",
      "tier": "B",
      "power_rating": 1244.3,
      "rank": 19,
      "total_matches": 25,
      "active": true
    },
    {
      "player_id": null,
      "name": "Aubyn",
      "tier": "C",
      "power_rating": 1115.8,
      "rank": null,
      "total_matches": 4,
      "active": true
    },
    {
      "player_id": null,
      "name": "Tee",
      "tier": "C",
      "power_rating": 1114.1,
      "rank": null,
      "total_matches": 8,
      "active": true
    },
    {
      "player_id": null,
      "name": "Skapz",
      "tier": "C",
      "power_rating": 1108.3,
      "rank": null,
      "total_matches": 1,
      "active": true
    },
    {
      "player_id": null,
      "name": "Jams",
      "tier": "C",
      "power_rating": 1101.2,
      "rank": null,
      "total_matches": 7,
      "active": true
    },
    {
      "player_id": null,
      "name": "Rhys",
      "tier": "C",
      "power_rating": 1097.6,
      "rank": null,
      "total_matches": 3,
      "active": true
    },
    {
      "player_id": null,
      "name": "M.R",
      "tier": "C",
      "power_rating": 1088.7,
      "rank": null,
      "total_matches": 1,
      "active": true
    },
    {
      "player_id": null,
      "name": "Fee",
      "tier": "C",
      "power_rating": 1084.9,
      "rank": null,
      "total_matches": 4,
      "active": true
    }
  ]
};

// Exported so tooling can read it without a browser. Read-only in every sense:
// nothing here is ever an input to a calculation, and the comparison report is
// generated FROM it, never written back TO it.
if (typeof module === 'object' && module.exports) module.exports = { PRODUCTION_SNAPSHOT };
