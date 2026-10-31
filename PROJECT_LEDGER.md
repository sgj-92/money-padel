# Money Padel Prestige v3 — Project Ledger

The shared coordination layer between **Shaun** (product owner / final decision
maker), **ChatGPT** (product architecture, coordination, decision synthesis),
**Claude Chat** (technical/product review and challenge) and **Claude Code**
(repository implementation and verification).

Migrated 17 Sep 2026 from the Google Drive "AI Project Ledger", which is now
superseded: Claude Code can read that document but has no connector operation
to write to it, so every handoff needed manual pasting.

**Authority:** Shaun's explicit product decision → agreed architecture →
repository + tests + [`RATING_MODEL.md`](./RATING_MODEL.md) for implementation
truth → this Ledger for coordination state → individual AI chat memory.

If remembered context conflicts with this Ledger, **investigate — never
silently overwrite either version.**

**Shorthand** (full semantics in `CLAUDE.md`): `Ledger CCode` is a **go
command** — CCode reads, reconciles and starts the first approved, unblocked
item in NEXT without further authorisation. `Ledger Sync` is read/reconcile
only. `Ledger CChat` and `Ledger CGPT` address those agents. Shaun does not need
to type `WORK`, task numbers or commit references.

---

**Restored 20 Sep 2026.** This document was compacted from 3320 lines to 198 and
then to 122 on 20 Sep, which removed the Decisions Log, every Handoff, the Open
Questions and Recently Completed. Shaun asked for the full institutional Ledger
back. It has been rebuilt from
[`LEDGER_ARCHIVE_2026-09-20.md`](./LEDGER_ARCHIVE_2026-09-20.md) as the base,
with **every** post-compaction change merged in — including material from the
*first* compaction that the second one dropped, which neither the archive nor
the live Ledger still held. The archive file is unchanged and stays as the
recovery snapshot. This file is again the single authoritative Ledger.

**What the deletion had put at risk**, as it was recorded at the time and is
worth keeping as the reason this was worth doing: *"the deleted material
included decisions still in force (the read-strategy exception and its
measurement, the parked rating-model backlog, match sharing, the production
import and the historical corrections), and it was recoverable only from git…
Nothing in the archive is revoked — it has only stopped being written down."*
All of it is back in this document.

**One conflict found and resolved during the merge**, recorded here rather than
quietly fixed: Section 2's Tom/Fatch paragraph said their historical Reliability
stays at **10%**, while the Decisions Log in the same document already recorded
Shaun's 20 Sep change to **20%**, applied in `4bbda90`. The archive was
internally stale. **20% is correct** — it is the later decision, it is what is
stored, and the 20 Sep audit verified it against the live record. Section 2 now
says so, and the 10% wording is kept where it belongs, as superseded history.

---
## 1. CURRENT STATE

The v3 engine, persistence layer, historical backfill and validation are
complete and verified. The first UI integration is done: the application's
rating chokepoint now reads v3 persisted state.

| | |
|---|---|
| Repository | **`sgj-92/money-padel`** (renamed by Shaun 27 Oct from `MP-Dashboard-Beta-v2`, itself renamed 29 Sep from `MP-Dashboard-NewRatings`; GitHub redirects the old URLs. The older repos `MP-Dashboard` and `MP-DashboardBeta` are **archived**, read-only.) |
| Hosting (27 Oct) | **Vercel is the primary host. Live app: <https://moneypadel.sgj.luxe>** (Shaun's domain, on Production, 27 Oct); **standings for members: <https://mpstandings.sgj.luxe>** (30 Oct, Production; League, Power and Results only — see Added since the compaction); <https://mp-dashboard-new-ratings.vercel.app> still serves the same build (desktop review at `/preview`). Vercel project `mp-dashboard-beta-v2` (Shaun may rename it; the domains above are unaffected). `main` is production. **Since 27 Oct (Shaun's storage clean-up) Vercel skips Preview deployments ("Ignored Build Step")**; production still builds on every push to `main`. The last `app-features-fixes` preview is `b2eb028`, so its branch link is frozen there. Use the production link. Previews only matter for held work (the `redesign` branch); re-enable for that branch if it needs review. GitHub Pages is legacy, kept only while it is trivial (Section 2). |
| Branch | `main` (production: Vercel deploys it) |
| Working branches (27 Oct) | **Three branches.** **`main`** — production (Vercel). **`app-features-fixes`** — features, fixes and functional updates; CCode keeps it identical to `main` and pushes both, so this work goes live. **`redesign`** — the app redesign (renamed by Shaun 27 Oct from `ux/player-reset-v2`), **held**: never merged to or deployed from `main` until Shaun releases it. **Up to date with `main` at `ed8a9dd` (27 Oct)**; served at **<https://mpr.sgj.luxe>** (Vercel Preview, branch `redesign`). `app-redesign` (superseded 30 Sep) and `claude/upload-commit-main-yfgpx0` were deleted 27 Oct. *(Older entries below use the old names.)* |
| Last verified implementation commit | **`3f45899`** (Monthly Race leads, 31 Oct; Merit sorting `060108b`; Merit Table sorting, 31 Oct; Race column `eaed298`; Merit Table Race column, 30 Oct; Even column `0baa96f`; Merit Table Even column, 30 Oct; standings site `1108a73`; standings site mpstandings.sgj.luxe, 30 Oct; "New build available · Refresh" notice `79eddad`, 27 Oct; correcting a game's date moves it `a7a6761`, 27 Oct; Add a game result reader `c6f0b79`, 27 Oct; new players join the record with their first game `2a7cbe9`, 27 Oct; every record counts draws `777b7c0`, 15 Oct; player form counts draws `9809d88`, 15 Oct; Predict a Matchup batches + 16px inputs `3259cdc`, 10 Oct; four/five-set scores `06370f5`, 8 Oct; rated games say who submitted them again `bde692b`, 6 Oct; editing a game keeps your place `21f79c1`, 6 Oct; League P W D L + Race drill-downs `750e31b`, 6 Oct; draws on the Match Result Card `71dc4f1`, 5 Oct; Matchup Card shows the % of games `a3e515b`, 4 Oct; Predict a Matchup: More + Matchup Card `acba496`; POTM nominees picture `69e6640`; nominations refined `e5f868a`; Player of the Month `7dca948`; player status model `4cbfeb7`; Match Result Card + Match Analysis `c6acfd9`; completed-match scorecard `19662b1`; desktop-friendly dashboard `269327c`; Board Pack split by tier `382f907`; whole-pack PDF `d74d466`; losing modules `337c70e`; Player Monthly Packs `d6e4ae1`; partnership draws `2d43540`; options + autosave `f58ec1d`; Tier S + pictures `6f40764`; Unpublish + Kings tiles `a5cbe84`; the Share Deck is `4af924d`; the Board Pack is `9e4a5e6` + `e666a96`), on `app-features-fixes` = `main`. The redesign branching point is still **`f75a493`**; the redesign branch is at `e463300` (Phase 2). *(Was `8e1c91e`, the desktop phone preview.)* |
| Tests | **973 / 973 on `main`** (31 Oct, after Race details; 970 after Merit sorting; 969 after the Merit Race column; 967 after the standings site; 962 after the new-build notice; 959 after date moves; 958 after the result reader; 951 after new-player entry; 948 after every record counts draws; 947 after player form draws + UI suite pinned to the fixture era; 938 after Predict a Matchup batches + 16px inputs; 929 after the four/five-set score fix; 927 after match attribution; 920 after the Edit Game position fix; 912 after the League / Race drill-downs; 911 after Predict a Matchup's Matchup Card; 905 after the POTM nominees picture; 904 after the POTM nomination refinement; 897 after Player of the Month; 882 after the player status model; 874 after the Match Result Card; 870 after the match scorecard; 861 after the desktop layout; 852 after the tier split; 849 after whole-pack saving; 843 after the losing modules; 839 after Player Monthly Packs; 824 after partnership draws); 816 / 816 on `ux/player-reset-v2` at Phase 2. *(Was 762 / 762.)* |
| First content, at a phone's 250ms round trip | **499ms** (was 3,779ms) |
| **Live record status** | **REPAIRED 20 Sep — replays to itself (0 differences), diagnostics 8/8. Editing works again.** |
| Firebase (beta) | `mp-dashboard-beta-v3` |
| Last import | production match-facts export, 18 Sep — 7 new matches, verified (`PRODUCTION_IMPORT.md`) |
| Production | never touched; comparison is a dated static snapshot |

**Firestore document counts are successive dated re-reads, newest first** — they
are not three disagreeing measurements of one moment. Kept because each is the
figure a handoff below was written against:

| Read | Record |
|---|---|
| **21 Sep, after three renames and four new matches (current)** | **159 matches · 688 journey events · 34 players — replays to itself, 0 differences** |
| 20 Sep, after Shaun's three reviews | 155 matches · **672** journey events · 34 players — replays to itself, diagnostics 8/8 |
| 20 Sep, after the removal was finished | 156 matches · 664 journey events · 34 players |
| 18 Sep, after the production import | 157 matches · 666 journey events · 34 players = **857 docs** |

**Wired to v3:** `recomputeAll` hydrates `PLAYERS[]` from the compact `players`
collection, and the match history now comes from the v3 `matches` collection.
Rankings order, profiles, Home, matchups, partner/calibration suggestions,
promotion gaps, tier tables, head-to-head, partnerships and CSV exports all
inherit both. A player's record and the rating beside it derive from the same
150-match history: wins + losses + draws equals `lifetimeMatches` for all 34
players.

The player Rating Journey now replays persisted `ratingJourney` events. The
reconstruction (`computePlayerJourney`) and its "story estimate" disclaimer are
deleted, not merely unused: the journey's last point **is** the Power Rating for
all 34 players, so there is no second number to caveat. Per-match rating changes
on profile cards are the engine's own per-player deltas. Costs no extra read —
`V3_JOURNEY` is already in memory for the monthly views.

**No reconstructions remain.** Every rating, expectation, pre-match rating and
per-match movement shown anywhere in the application is read back from the
persisted journey via `matchFacts.js`. `computeElo` is kept per Shaun's decision
that the legacy solver stays available through the beta, but nothing calls it
and a test fails if anything does.

Kings of Tiers, the rankings podium and the tier filter now scope tier to the
selected month via a single `tierInScope()` helper. This uncovered a defect
underneath: `MONTHLY_VIEWS` was built with `TIER_MAP`, which is `{}` at that
point, so **every historical tier, within-tier rank and tier-change flag in the
shipped application was `undefined`** for all but the three players in the
authoritative change list. Fixed at source (v3's own tier map) and `TierHistory`
now refuses an empty map. See Handoffs.

**Diagnostics live.** `betaDiagnostics.js` reads the three collections directly
and checks that the record still hangs together — chain continuity, state vs
history, match/event coverage, orphans, duplicates, excluded data, and whether
what the app shows is what is stored. On demand, never at page load. It also
reports the Open Question 1a read-strategy measurement.

**Beta reset is a script, not a button:** `scripts/reset-beta.js`, dry run by
default, needs `--write --i-mean-it`, cannot be pointed at production, verifies
itself afterwards. Last dry run against the live beta: **0 documents outside the
baseline.**

**Write path live.** `clubDecision.js` is the only thing in the application that
writes a rating. The Admin Monthly Review is wired to it. Forward-only,
attributed, confirmed against the exact document before anything is stored, and
undone by recording a reversal rather than by deleting.

**Games can be recorded again.** Approving a submission now rates it: it joins
the v3 record via `replayForward.js`, the four players move, and the operator
sees exactly who moves before confirming. This was broken — see Open Question 13.

**Replay-forward exists** (`replayForward.js`): rebuilds the engine inputs from
the stored record, applies an append/edit/delete, replays, and writes only what
changed. Its precondition is that replaying with no change reproduces the
record.

**UI regression tests exist.** `tests/ui.test.js` boots the real `index.html` in a
real browser against a stub built from the same backfill the seed writes, and
covers the defects that actually shipped. They skip when Playwright is absent.

**`COMPARISON_REPORT.md`** is generated by `scripts/comparison-report.js`; a test
fails if the committed file drifts.

**Not built:** the editing UI on top of replay-forward (the engine capability is
there; exposing it is a product step). *(Screenshots were listed here as not
built; they exist — `scripts/screenshots.js`, 19 captures in
`docs/screenshots/`, regenerated with each visual pass.)*

---

### Added since the compaction

**Race match details hidden until asked for — DONE (`d3a663d`), 31 Oct.** Shaun: "Can we hide the stakes and % info unless we tap a button/chevron to show it please?"
- Each match in a Race drill-down (the Race table's score and P/W/D/L, and the Merit Table's Race column) shows date, points, result and score; a **Details ›** button under it reveals that match's stakes and par win chance. One match at a time; nothing else changes. `wireRaceStakes` in leagueScreen.js. 973 / 973.

**Redesign: Power Rankings calmer; one type system app-wide — DONE (`646d91b` on `redesign`), 31 Oct.** Shaun: "Too many fonts, a lot of visual noise. Can't see October or all tiers inside the boxes"; approved from a mock, then "apply the fonts app-wide".
- **Decision (Shaun): Inter for everything read or tapped; Georgia for titles and player names.** Instrument Serif retired (files removed); `--font-display` is Georgia; the Helvetica/Arial `--font-interface` token, the Georgia `body` default and unstyled buttons/inputs all resolve to Inter. The Power screen had four families and ~20 sizes; it now has two.
- Power: eyebrow removed; month/tier boxes lose their icons and show whole names ("September 2026", "All tiers") down to 360px; Include idle / temporarily inactive moved into Filters; Kings of Tiers is a list (crown, name over tier, rating); podium and Monthly Summary on the type scale.
- Every dropdown (`select.fg-select`) gets a slim drawn chevron in place of the browser's arrow, which was clipping month names on This Month too.
- **Bug fixed:** the Filters dot was lit on every month view (it counted min games ≠ 10 as custom, but a month's default is 5); now it compares with the month's own default and refreshes on every draw.
- `tests/powerScreen.test.js`; `designFoundations` updated for the new font rule. **1027 / 1027 on `redesign`.** Redesign-only; the live app is unchanged.

**The Monthly Race leads the month — DONE (`3f45899`; redesign Home below), 31 Oct.** Shaun: "I want the monthly race to be the centrepiece of monthly checks now, as the default as opposed to League Table. The order of importance is: Monthly Race, Merit Table then League table. Monthly Race data should show on the home page alongside position, instead of League."
- **Decision (Shaun):** order of importance Race → Merit → League. The League screen opens on the Race; the View select lists Monthly Race, Merit Table, League Table, Information.
- `raceStandingOf(name, month)` (monthlyTablesData.js): the Race's counterpart to `leagueStandingOf`, placing a player exactly as the Race table does; provisional players (under `MonthlyRace.MIN_MATCHES`) have no place, only a score and games to go.
- **Redesign Home hero** (branch `redesign`): "Your October / Monthly Race / 2nd in Tier A / 11 games · 8W 2D 1L · +65 pts"; provisional reads "Provisional in Tier B · … · 2 more to qualify". Tapping opens the Race on Home's month. The live app's Home has no monthly-position hero, so nothing changes there.
- **Bug fixed in passing:** a League screen opened before the record arrived (a tap during loading, or the standings site, which opens on it) kept "All time" as its month. Harmless for the League, but the Race has nothing for All time. It now re-picks its default once games arrive; a month the reader chose is kept.
- Shaun also noted the Home imagery "isn't yet perfect": the photo is fine; the type was off. **Decided (Shaun, 31 Oct, option C of four mocked):** the hero's greeting and headline move from Instrument Serif (tall, narrow; 46px read as stretched) to the wordmark's Georgia at 24/32px (40px desktop); the rest unchanged. `redesign` `7f5b5e8`. Only the Home hero: other redesign titles keep Instrument Serif unless Shaun asks (open for CGPT: apply C app-wide?).

**Merit Table: every column sorts — DONE (`060108b`), 31 Oct.** Shaun: "I have to be able to sort each column."
- Player, P, W, D, L, Pts, Hard, Even, Fav and Race sort on tap: highest first (names A-Z), a second tap reverses. The # follows the order shown, as on the League table. Ties keep the Merit order, so the default (Pts, highest first) is unchanged.
- Players with no race this month sit at the bottom of a Race sort either way; on All time (no Race column) a Race sort falls back to Pts.
- The ▾/▴ sits in the header's bottom padding, so it costs no width at 360px. Headers are keyboard-operable with `aria-sort`.

**Merit Table: an Even column — DONE (`0baa96f`), 30 Oct.** Shaun: "add even games into the columns at the end, so wins are broken down by hard, even and favourable".
- Columns now end **Hard · Even · Fav**; the three always add up to W. Even opens its own list of wins (`MeritTable` rows carry `even` beside `hard` / `favoured`), each marked "evenly matched".
- The table's widths are set (`meritColgroupHtml`): with fixed layout and ten equal columns, names had been breaking mid-word on a phone ("Jord s"); now the counts get what they need and the name the rest. No name breaks at 360px.
- Board Pack's Merit slide now matches: Hard · Even · Fav (Shaun, 30 Oct; `a432ae5`).
- **Race column on the Merit Table — DONE (`eaed298`), approved by Shaun 30 Oct** ("Whole numbers work. It's so we can quickly see all of the context."). Month views only (no All-time race); whole points ("+52", "−81"); By tier shows that tier's race, All together sums a mid-month mover's races; tapping it lists the race's matches with their stakes. Figures are `buildMonthlyRace`'s own. Fits 360px with no clipping (tested, incl. a three-figure score).

**Standings site for the WhatsApp group — DONE (`1108a73`), 30 Oct.** Shaun: share the live standings instead of screenshots, on a domain of its own so members can't reach the full app by trimming the URL; "mpstandings.sgj.luxe. This month and all historical standings is fine. Results too."
- `data/siteMode.js`: `isStandingsMode()` is true on a host starting `mpstandings.` (or `?standings`, for local testing). The same build serves both domains.
- In standings mode the app is Rankings only: **League** (opens first), **Power**, **Results**; every month and All time. No tab bar or rail, no Home, no "who are you?", no player profiles (`openSheet` inert), never unlocked, and Results has no Add a game, Admin lock or pending list.
- `vercel.json`: on that host every path except `/assets/` redirects to `/`, so `/review/`, `/preview/` etc. are not reachable there.
- Fixed in passing: the rankings' "No players match that filter." could show over another screen when a render landed while it was hidden.
- `tests/standings.test.js`. **967 / 967 on `main`.**
- **Shaun:** add `mpstandings.sgj.luxe` in Vercel → Domains, environment **Production**, and the DNS record Vercel shows.
- **Caveat (see OPEN 30 Oct):** this hides the full app; it does not protect the data. The database still accepts writes from anyone who knows how.

**Redesign brought up to date with the live app — DONE (`ed8a9dd` on `redesign`), 27 Oct.** Shaun: "go ahead and update redesign".
- `main` merged into `redesign` (42 commits). Four files conflicted.
  - Ledger: `main`'s copy.
  - `components.css`: both kept; `main`'s blocks moved before the redesign
    primitives, so the primitives section holds only `mp-` names.
  - `homeScreen.js` / `shell.js`: the redesign's layout kept, with
    behaviour carried over. Home's form record names draws (`PlayerForm`).
    Me gets an **Admin group led by Predict a Matchup** (admins only; Me is
    More's successor). North vs South leaves Rankings › More tables for Admin /
    Manage (Shaun, 4 Oct).
- **Redesign bug fixed** (`ui/shellHistory.js`). Closing sheets in quick
  succession sent `history.back()` once per close against the same stale
  entry and stepped out of the page. Now a queued entry is dropped instead,
  and no second back is sent while one is in flight. Caught by the player-
  archiving test.
- Tests adapted to the redesign's IA: Predict opened from Me; North vs South
  via Admin; the Home "no games" case picks a current (non-archived) player.
  **1011 / 1011 on `redesign`.**
- Deployed to Preview → <https://mpr.sgj.luxe>.
- **For CGPT/CChat:** the Me screen's group order is now You, Admin (when
  unlocked), Settings, About the rankings, Club. Placing Admin second follows
  Shaun's "Predict at the top of More". Say if the redesign wants it elsewhere.

**"New build available · Refresh" — DONE (`79eddad`), 27 Oct.** Shaun: same as the Ledger app.
- `features/updateNotice.js` re-reads the deployed `assets/js/buildInfo.js`
  (no-store, cache-busted) and compares it with `window.MP_BUILD`
  (`BuildStamp.deployedSha` / `isNewer`). It checks 5s after start, on return to
  the foreground, and every 10 min while visible. A pill above the tab bar has
  Refresh (reload) and ✕ (dismiss this build only). Never shown on a
  local/unstamped build; read failures are ignored.
- `tests/updateNotice.test.js` (3).

**Correcting a game's date moves it — DONE (`a7a6761`), 27 Oct.** Shaun: "I should just be able to change the date and the system figures it out."
- Was refused, because a match id carries its date. New `ReplayForward` change
  `redate` (`matchId` = old id, `match` = the game under the next free id on
  the new date) removes and re-adds in **one** plan and replay; ratings from
  the earlier of the two dates are re-derived.
- Edit game stages it like any correction ("Confirm new date … It becomes X (was
  Y)"). On commit, `matchAttributionState` and Upcoming references
  (`playedMatchId`, `notResults`) move to the new id; history lines are left as
  written.
- Live check (read-only): `2026-10-27-1` → `2026-10-26-2`, 5 writes / 5
  deletes, no rating moves, record replays to itself.
- `tests/matchRedate.test.js` (2); the old refusal test was removed (Shaun's
  decision supersedes it).

**Add a game reads results however they're written — DONE (`c6f0b79`), 27 Oct.** Shaun: "smart enough to detect the winners, losers and results… not always in the exact format".
- New pure `domain/matches/resultParse.js` (`ResultParse`) replaces the one-layout
  `parseQuickEntryText` reader. Sides come from result words (beat / def / lost
  to / beaten by / drew with), "vs" or a team per line; partners from & / + ,
  "and" or recognised names. Winner comes from the words, 🏆 / "won" / "(W)",
  or more sets won; level sets with no winner read as not finished. Scores
  written winners-first are turned round; "6/4" is accepted when no other style
  is used. Names use `FixtureParse.resolveName`: a unique prefix is used and
  said, an ambiguous one must be picked. Dates come from a WhatsApp timestamp,
  26/10, 26 Oct, today/yesterday or a weekday.
- It refuses rather than guesses: one team, no scores, a duplicate player, or
  several results in one paste ("add them one at a time").
- The form shows a read-out (one-line result + problems / warnings / how it
  decided); a paste is read immediately; nothing is submitted automatically.
- Fixed in passing: an Admin-added player who hasn't played was offered the
  new-player tier picker again (default B would overwrite their tier).
- `tests/resultParse.test.js` (7).
- Possible next step, if wanted: several results in one paste (a review list,
  like "Add multiple games").

**New players join the rating record with their first approved game — DONE (`2a7cbe9`), 27 Oct.** Shaun: added Topsy (Tier C) in Admin, then approving her first game failed with "never been initialised".
- **Root cause.** Admin › Player tags › "Add a new player" only wrote a tier tag
  (`moneypadel_player_tags`), a pre-v3 mechanism. The engine rates no one
  without a `PLAYER_INITIALISED` journey event, and nothing in the app wrote
  one. All 34 players entered through `seed-beta`; Topsy is the first new
  player since the v3 record began.
- **Fix.** `ReplayForward` changes may carry `initialisations`. Approval and
  corrections (`planIncludingNewPlayers`, gamesAdmin.js) bring an unknown
  player in, in the same commit: tier from Admin's tag, effective on the first
  game's date (the seed's convention), **PROVISIONAL / `UNKNOWN_NEW_PLAYER`**
  (the record's precedent, Shaun in July). The rating is the tier baseline
  either way; PROVISIONAL keeps the one-off starting-tier correction open in
  Club Decisions. Signed by the approver. Without a tag, the message tells the
  admin to add the player in Admin first.
- Checked on a read-only copy of the live record: Topsy's pending game plans
  as 10 documents, nothing else moves, and the record replays to itself after.
- `tests/newPlayer.test.js` (3). Also `73ec46d`: Edit Game position checks
  allow ±1px (subpixel layout drift, failing by 1px on unchanged code).
- **For CGPT/CChat:** a starting tier is the admin's tag tier; no starting
  rating other than the tier baseline is offered (methodology unchanged).

**Every record counts draws — DONE (`777b7c0`), 15 Oct.** Shaun: "align everything to include draws".
- `buildPlayers`, `computeMonthlyStats`, `buildPartnerships` and `buildH2H` now
  read `matchesIncludingDraws()`; `isDraw` is its own outcome (never a win, loss
  or upset; its residual counts toward vs-expectation like any game).
- `PLAYERS[].total` = W + D + L = lifetime games; `winpct` = W / total. This
  feeds the Power Rankings W/L list, its Win % column and sort, the **min-games
  display filter** (now counts draws), risk confidence, avg opponent and
  vs-expectation.
- Monthly stats equal the League's monthly table for every player and month.
- Partnerships: draws counted (2+ games incl. draws qualifies); the Board Pack's
  separate draw tally was removed; Player Pack chemistry says "games".
- Displays: W/L list `5W · 2D · 1L`; month view, partnership records,
  best-chemistry line, recent-form card, monthly breakdown use `12W-1D-10L`; the
  admin players CSV has a Draws column.
- Verified on the live record: all 34 players' rankings record equals the
  profile and lifetime games, every month equals the League, and every
  partnership adds up. One new test; the Board Pack draw-injection test now
  injects into `DRAW_MATCHES` too.

**Player form counts draws: profile, Home and Win Rate reconcile with Recent Results — DONE (`9809d88`), 15 Oct.** Shaun's brief (Jams).
- **Root cause.** The profile's form strip, its "3–7 · Last 10", Home's
  form dots/record and the hero's W-L / Win Rate were built from `MATCHES`,
  the rating's decided-only set. Recent Results reads
  `matchesIncludingDraws()`. Draws were not misclassified; they were
  **dropped**, and an older decided game slid into the ten. On live data (15
  Oct) Jams showed `W W L W L L L L L L · 3–7` (his whole decided history
  back to July) and `3-7 · 30% Win Rate`. His real last ten are
  `L D L D L L L D L W` = 1W 3D 6L, and his record is 3W 3D 7L = **23.1%**.
- **Shared logic.** New pure `domain/matches/playerForm.js` (`PlayerForm`)
  works over every rated game, draws included. `MatchOutcome` decides each
  result. Order: newest first, same-date games by the record's sequence; Recent
  Results now uses the same order. Win rate = wins / games played (the
  League's and Games log's definition). `computeRecentForm` and
  `computeRecentFormSequence` delegate to it. This is the source any future
  form consumer (Rating Review flags) should read.
- **Surfaces.** Profile strip, "1W · 3D · 6L · Last 10", hero
  "3W · 3D · 7L · 23.1% Win Rate"; Home dots, record and the trending line;
  recent-form W-D-L in Power Rankings, League and the admin export. Draws get
  a `--draw` colour (neutral warm grey) in the profile letters, Home dots and
  the League's Last 10 run. The strip still reads oldest→newest with the
  latest game on the right.
- **Knock-on.** The recent-form "vs expectation" average (trend arrows) now
  covers the same ten games, draws included.
- **Verified on the live record (read-only snapshot, not committed).** All 34
  players reconcile: strip = Recent Results' first ten, record line adds up,
  hero record sums to games listed, Win Rate = wins/played. The 14 players
  without draws are unchanged (letters, counts, Win Rate, average); the 20
  with draws were all affected.
- `tests/playerForm.test.js`: 9 tests (Jams's stored sequence as a pure case;
  profile, Home and fewer-than-ten in the app); the app ones fail on the old
  code.
- Also `4ec05f9`: five `ui.test.js` tests checked "recent" against the real
  clock and broke as the calendar passed the fixture (games end 16 Sep). They
  failed identically on unchanged code and now run at `FIXTURE_NOW` (21 Sep).
- Open: Power Rankings' W% still excludes draws (Open Questions, 15 Oct).

**Predict a Matchup: four players, up to five matches, one shared card; iPhone input zoom fixed — DONE (`3259cdc`), 10 Oct.** Shaun's brief.
- **Four players or nothing.** `domain/predictions/predictionBatch.js` (pure):
  a match is predicted only when all four slots hold a club player, no player
  twice (case-insensitive, either side). Before that: "Select 4 players to
  generate a prediction", with no card and no percentages. A repeated player
  is flagged in its slot, and chosen names are left out of the suggestions.
  **Change of behaviour:** a singles (1 v 1) prediction is no longer possible
  here; the brief asks for four.
- **Up to five.** "+ Add another prediction" appears once every match is
  complete. Finished matches fold to numbered lines with Edit and Remove;
  removal renumbers. At five, the button gives way to a note.
- **One condensed card.** `MatchupCard.buildMany` numbers the same per-match
  cards (teams, tiers, expected share, favoured side) on screen and as one
  picture (`CardPainter.matchups`, 1080 wide, 1582 tall for five). Share and
  Copy send them together. One prediction is unchanged (Matchup Card,
  Share/Copy, Add to Upcoming). **Add to Upcoming is offered only with a
  single prediction**; a batch is for sharing.
- Every prediction is still `predictMatchup()` → `MatchPrediction.build`;
  nothing new is calculated.
- Fixed in passing: the sheet's name suggestions came from a datalist that
  only existed once Games or Upcoming had been drawn. The sheet now has its
  own list.
- **iPhone zoom: root cause.** Every editable control in the app rendered at
  12.5–14px (`.fg-select` 14px, plus screen overrides at 12–13px). iOS Safari
  zooms in on a focused field under 16px and does not zoom back out. Fix: one
  shared rule at the end of `assets/css/components.css` sets
  inputs/selects/textareas to 16px under `(pointer: coarse), (max-width: 600px)`.
  Desktop density is unchanged. The viewport tag already allowed zoom and is
  untouched (a test now guards against `maximum-scale` / `user-scalable`).
  Checked at 360px: no horizontal overflow on any tab or any open Admin
  section.
- `tests/predictBatch.test.js`: 9 tests; the app tests fail on the old code.

**Match Result Card: four and five sets fit on one line — DONE (`06370f5`), 8 Oct.** Shaun's screenshot.
- Each set was a wrapping flex item sized for three sets, so on a phone a
  four-set score broke every set across two lines. Sets now never break; four
  sets show at 34px and five at 25px (three or fewer unchanged at 44px). The
  shared picture already fitted its score to the width.
- Test at 360 and 390px for four and five sets (fails on the old CSS).

**Rated games say who submitted them again — DONE (`bde692b`), 6 Oct.** Shaun's bug report: "every game shows Submitted by unknown".
- Cause: since the Games log has read the v3 record (`e8d21f4`, 17 Sep) no
  rated game has carried a submitter. v3 match documents have no such field,
  and approving a submission deleted the only copy of the name. The existing
  comment claiming `submittedBy` "goes on being written" was true only of the
  submission itself.
- `domain/matches/matchAttribution.js` answers who added a game, in order:
  1. the new club document `moneypadel_match_attribution` (matchId →
     submittedBy / submittedAt / approvedBy / approvedAt), written at approval;
  2. the 16 Sep export's own "Submitted By" column, for the 150 seeded games;
  3. the Rating Journey: "Approved by …" for games approved 17 Sep–6 Oct
     (those submitters are not recoverable), or "Added from the old app" for
     the 7 imported games;
  4. otherwise "Submitter not recorded".
  The rating record is untouched. The admin match CSV uses the same answer.
- On the live snapshot: 113 Historical record, 33 Submitted by Shaun, 1 by
  Tom, 8 Approved by Shaun, 7 Added from the old app, 1 not recorded (blank in
  the export too).
- `tests/matchAttribution.test.js`: 7 tests; the UI ones fail on the old code.

**Edit Game keeps your place on the Games tab — DONE (`21f79c1`), 6 Oct.** Shaun's bug report.
- Root cause: the edit form was appended after the whole games list and
  scrolled to (`scrollIntoView`, smooth), so Edit took the reader to the bottom
  of the tab. Save and Cancel then redrew the list without the form, and the
  page kept its old offset, clamped to the new bottom. No input focus was
  involved.
- The form now opens inside the game's own card (pending and rated alike).
  Opening keeps the card where it is on screen, and only brings it up under
  the header if the form would start in the lower 40% of the screen.
- Cancel, Save, the card's Close, and a confirmed correction all return to where
  the editor was opened, even after scrolling down to the buttons. A refused
  save or a staged correction keeps the game where it is. Editing from a
  profile lands on the game with its form open.
- If a filter hides the game being edited, its form opens at the head of the list.
- `tests/gamesEdit.test.js`: 8 tests at 390 × 844; all fail on the old code.

**League P W D L; Monthly Race counts open their matches — DONE (`750e31b`), 6 Oct.** Shaun's requests.
- The League table (By tier and All together) and Last 10 now read P W D L,
  the order Merit, the Race and the Board Pack already use.
- In the Monthly Race, P, W, D and L open the matches behind the count, as in
  League and Merit. Each match is told the Race's way: its stakes and the
  points it earned.
- The score keeps its own list; one detail is open at a time.
- No figure changes. Covered by a new D6 test in `tests/auditFixes.test.js`.
  912/912.

**Match Result Card: draws no longer look like wins — DONE (`71dc4f1`), 5 Oct.** Shaun
sent a draw (Eli & Len v Osh & Rishi). One pair was in the winners' large
gold type and the other was in small type, "with Osh & Rishi".
- **Both pairs alike:** on a draw both pairs are now in the same type, size
  and colour (not gold), with "vs" between them. This applies on screen and
  in the shared picture.
- **No rating row on a draw.** It showed one side's gains only; everyone's
  movement stays in the analysis.
- **Unchanged:** wins. The picture's score now also shrinks to fit the
  margins.

**Matchup Card shows the % of games — DONE (`a3e515b`), 4 Oct.** Shaun: the share of
games is fine instead of a number of games.
- The card's big figure now reads "Expected share of games: 34% – 66%", on
  screen and in the shared picture. The share text says the same.
- On screen the detail line is now just the rating edge.
- The typical-match conversion (`typicalMatchGames`, `expectedGames`) is
  removed.

**Predict a Matchup: top of More, a share-ready Matchup Card — DONE (`acba496`), 4 Oct.**
Shaun's brief: he was screenshotting the tool for the group.
- **Access:** Predict a Matchup is now the first item in More, for Admins
  only.
- **The card:** it opens in its own sheet and answers with a Matchup Card:
  - the teams, with tier badges;
  - the call: "Projected favourites: …", "Slight edge: …" or "Too close to
    call";
  - **expected games won** in the club's typical match.
- **Sharing:** **Share matchup** sends the card as a picture; **Copy image**
  puts it on the clipboard, or copies text where pictures can't be copied.
- **More menu:** Predict (Admin) · Doughnuts · Power Rating Guide ·
  Insights / Call-Outs · About · Data & Rankings · My Player · Admin /
  Manage. North vs South has moved to Admin / Manage.
- **Unchanged:** the prediction itself. Handoff in Section 6; one item in
  Section 5.

**Player of the Month: one picture of the nominees for WhatsApp — DONE (`69e6640`), 4 Oct.**
Shaun asked to share a single picture of all the candidates.
- **Button:** "📷 Share nominees picture" appears in Admin › Player of the
  Month, both on the list being drawn up and on the finalised shortlist.
  It also appears under the players' shortlist in League › Information.
- **Picture:** `CardPainter.nominees` paints it 1080 px wide, at least 4:5
  and taller when needed: brand and month, "September nominees", every
  nominee's card (players' version), and "Money Padel recommends · the
  group chooses".
- **Sharing:** it goes to the phone's share sheet like the Match Result Card
  ("Tap to share" when a fresh tap is needed; saved where sharing isn't
  available). Handoff in Section 6.

**Player of the Month nominations refined — DONE (`e5f868a`), 4 Oct.** Shaun's
second brief: the cards read like algorithm output.
- **Wording:** each reason is now one sentence about what the player did,
  e.g. "Beat expectations by +7.2pp on average." or "Won 13 of 20 matches —
  65%.". Below the reasons is one row of four figures.
- **Competitions:** the month's tier winners of the League, Merit and Monthly
  Race are now nominated. They come from those competitions' own tables.
  Two wins are told once as "Month Champion", three as "Triple Crown".
- **Readability:** a card shows at most three reasons.
- **Admin vs players:** Admin's card keeps its controls small. The players'
  shortlist shows the nominations only.
- **Unchanged:** confirmed awards. Handoff in Section 6.

**Player of the Month — DONE (`7dca948`), 4 Oct.** Shaun's brief: Money Padel
recommends candidates; the group chooses the winner. For each finished month
the app suggests the strongest *cases* among players with 5+ matches —
Overperformer, Biggest Improver, Strongest Results, Most Consistent, Upset
Specialist, Most Active — each a single figure the club already sees, ties kept,
listed by name (never ranked), with no combined score. Admin removes/adds
qualified players, finalises the shortlist (everyone sees it in League ›
Information and votes in WhatsApp), then confirms the winner. Shortlists and
winners are stored as snapshots in the new `playerOfTheMonth` collection and
never recalculated. The old automatic "Player of the Month" (the points leader)
is gone from every surface. Handoff in Section 6; decisions in Section 3; open
items in Section 5.

**CGPT reconciliation — 4 Oct.** Reviewed Shaun's Player of the Month product brief against the delivered implementation. The intended product principle is confirmed as: **Money Padel recommends candidates; the group chooses the winner.** Recommendations are evidence-backed cases rather than an automatic POTM ranking; match volume is only one reason to nominate someone and must not dominate by itself; Admin curates the shortlist; the group vote decides; and the confirmed award/history remains a permanent snapshot with its supporting story. This adds no new implementation request beyond `7dca948`; it records CGPT/product alignment after reading the current Ledger.

**Player status model + archived players — DONE (`4cbfeb7`), 4 Oct.** Shaun's brief:
a player who has left should disappear from the live app without losing a single
historical fact. Three admin-set statuses on the player's own v3 record —
**Active**, **Temporarily inactive**, **Archived** — kept separate from every
monthly or 30-day rule (Idle, League/Merit/Race qualification, Monthly
Performance), which never change a status. Archived players leave "Who are
you?", the directory, Compare, Find Game, every name field and the current
Power Rankings; their matches, scorecards, profiles, past months, Rating
Journey, packs and replay are untouched. Admin › Player tags groups players by
status with Mark temporarily inactive / Reactivate / Archive player (confirmed)
/ Restore player. Handoff in Section 6; decisions in Section 3; four small
follow-ups in Section 5.

**Home redesign review — APPROVED DIRECTION (Shaun / CGPT, 4 Oct). Baton → CCode on `ux/player-reset-v2`.**
- **Claude Design remains the visual/design-intent source.** The redesign must not become a new independent CGPT reskin. The authority for this work is: current Ledger / reconciled IA → canonical app rules/data → Claude Design visual intent. The current photographic redesign is a working implementation to refine, not discard.
- **Home is the reference-quality screen** before this visual language is propagated elsewhere. Review its branch/Vercel screenshots first; do not automatically spread revised components to Rankings, Play, Players or Me.
- **Approved Home hierarchy remains the reconciled 30 Sep IA:** compact live-data hero → conditional **Needs You** → **Next Game** → **Last Time Out** → light **Around the Club**.
- **Hero:** preserve the strong premium padel photography/dark-champagne identity but reduce its vertical footprint and make it useful. Its primary story is the viewer's **This Month** position, explicitly naming tier and month, with compact canonical record/points/movement where available. Tap opens Rankings → This Month. Race stays out while it is a trial. Meaningful Month / no-games states must be honest rather than inventing a rank.
- **Power Rating / Tier Rank / form:** remain on Home as compact secondary standing information; the current large `Your Game` treatment is to be substantially simplified/demoted. No new calculation or threshold logic.
- **Needs You:** restore immediately below the hero and render only when action is genuinely required. It follows the established DQ29 definition (For Me requests + viewer-involved Needs Attention fixtures) and disappears completely at zero.
- **Next Game:** restore as a first-class Home item using canonical upcoming-fixture data. Do not invent missing time/venue data.
- **Match Ideas leaves Home.** Preserve the feature/logic for its already-approved destination, Play → Arrange a Game; do not use it as a Home fallback.
- **Last Time Out:** keep, but make the result/teams/score the visual centre; date/tier are secondary. Preserve canonical result/rating movement. Structure may later accommodate the separate shareable Match Result Card, but this Home task does not reimplement that feature.
- **Club Pulse becomes lighter Around the Club.** Keep only 2–3 useful derivable insights (e.g. #1 Ranked, In Form, Promotion Watch) and prevent them competing with the player's own state. A mobile horizontal rail is acceptable within the Claude Design language. No invented insight calculations; no emoji as final product iconography.
- **Large monthly recap is removed/absorbed.** The separate `SEPTEMBER/OCTOBER AT MONEY PADEL` dashboard block should not duplicate the monthly story already led by the hero; useful club facts may live lightly in Around the Club or the deeper monthly destination.
- **First-viewport test:** at ~390px, expose as much as reasonably possible of monthly story → Needs You → Next Game without shrinking typography/touch targets below the established design-system standard.
- **Visual standard:** continue champagne `#D5B76E`, Instrument Serif + Inter, dark premium surfaces, restrained borders, clear hierarchy and app-like interaction. Target = **premium sports app**, not a luxury marketing page and not an analytics dashboard.
- **Functional boundary:** presentation only. Do not change rating/tier, League/Merit/Race, monthly methodology, request/fixture rules, permissions or Firestore schema. Consume canonical view-model/functions; if a fact is missing, report it rather than re-derive it in Home.
- **Responsive/QA:** preserve the existing mobile/tablet/desktop strategy; mobile is Home's design authority. Verify 375/390, tablet and desktop, long names, Needs You present/absent, next-game present/absent, monthly-data/empty-month states, hero route, and that Match Ideas is absent from Home.
- **PWA redesign identity (same conversation):** keep branch name `ux/player-reset-v2`; distinguish its installed preview from production using **full name `MP.B — Redesign`**, **short name `MP.B R`**, browser title `MP.B — Redesign`, and a clearly differentiated redesign icon across manifest/Apple touch/favicon surfaces. Production/main identity must not be changed by that branch-specific implementation.


**Match Result Card + Match Analysis — DONE (`c6acfd9`), 3 Oct.** Shaun's brief:
the scorecard read like an analytics panel.
- **Two layers, one view model.**
  - **The Match Result Card opens first.** It is a celebratory,
    shareable sports-result card:
    - the winners' names, big, with their tier on the day;
    - "Take the win", then the score;
    - "over" the opponents;
    - one story;
    - one Expected / Performance / pp line;
    - the winners' rating gains.
  - **Match Analysis** sits behind "View match analysis": the full
    two-team breakdown, losers' movements and the method note.
- **Share result** posts the card as a picture (1080 × 1350) through the
  phone's share sheet, e.g. WhatsApp.

**Completed-match scorecard — DONE (`19662b1`), 2 Oct.** Shaun's brief.
- **One canonical card per rated match.** It shows the date, context
  (doubles / singles, game type), score and winner. For each team it
  shows the players with the tier held on the day, Expected %, Actual %,
  the difference in percentage points, and each player's own rating
  movement.
- **Every rating figure is read back** from the engine's recorded
  `MATCH_UPDATE` events (via MatchFacts). Nothing is recomputed, and
  nothing new is persisted.
- **Where it opens:**
  - Play › Games: an expanded played match;
  - the admin's approval confirmation: the new match's scorecard, as
    soon as it is rated.
- **Any other surface** opens it with one line:
  `scorecardButtonHtml(matchId)`.

**Desktop-friendly dashboard — DONE (`269327c`), 1 Oct.** Shaun's brief.
- **One app, two presentations.** A phone is unchanged. A laptop or
  monitor lays out the same screens, routes, handlers and data.
- **Layout ranges:**
  - mobile < 768 (the phone app);
  - tablet 768–1199 (compact icon rail, one centred 760px column,
    dialogs);
  - desktop 1200+ (full left rail with the brand and "Viewing as",
    1120px column, two-up layouts);
  - wide 1600+ (1280px column, centred, never wider).
- **Screens with desktop layouts:**
  - **Home:** a dashboard grid, three columns at 1600+.
  - **Rankings:** one filter toolbar, Kings of Tiers beside the podium,
    sticky table headers.
  - **Play:** Find a Game's brief beside its results; Games as a card
    grid; Requests and Upcoming at a readable width.
  - **Players:** directory | profile (master-detail).
  - **Admin:** Board Pack and Player Pack editors beside their live
    preview.
  - **Sheets:** centred dialogs; a profile opened elsewhere slides in
    from the right.
  - **Keyboard:** Escape closes; visible focus.
- **`/preview`** has 1280 / 1440 / 1920 presets beside the phone ones.

**Board Pack: split by tier, every tier included — DONE (`382f907`),
1 Oct.** Shaun: "monthly race split by tier but all tiers included, power
rankings split by tier, results table split by tier".
- **Monthly results table and Power Rankings:** a new **Layout** option,
  "Split by tier" (default) or "One list".
  - Split shows every tier as its own section, with Top N per tier.
  - The results table splits by the tier on each match's date, as the
    League does, so a mid-month mover is in each tier with that spell's
    games.
- **League, Merit and Monthly Race:** a new **Slides** option, "A slide
  per tier" (default) or "Leaders on one slide". The report was already
  split by tier, but each slide showed only the tier's leader.
- **The Share Deck** gives each tier its own slide ("… · Tier A") with
  that tier's top five. Pictures, the PDFs and publishing all follow.
- **Tier S switch (CCode's call, recorded in Section 5):** hidden, a
  split list leaves the Tier S section out, like every tier-grouped view,
  and the report says so. "One list" still includes Tier S players.

**Save a whole pack: PDF or every picture — DONE (`d74d466`), 1 Oct.**
Shaun's request.
- **Where:** under Preview, in the club Board Pack and in each player's
  pack. Available before publishing; nothing is written.
- **"Board Pack as PDF"** (or "Pack as PDF" for a player): one file, a
  contents page then every selected module and note, a page each.
- **"Slides as PDF":** one file of the slides players would see (cover,
  slides, closing card), 4:5 pages. Admin-only sections are left out.
- **"All pictures":** every module as its picture at once.
- **How:** the PDF is the same pictures the Share image buttons make,
  embedded as JPEG (about 1 MB a pack). It is written by the app itself,
  with no library. On a phone it opens the share sheet as a PDF
  (WhatsApp, Files, email), otherwise it downloads.
- **What "disappeared":** there was never a whole-pack file. The Save
  button removed when the pack began saving itself (`f58ec1d`) saved the
  module choices, not a copy of the pack.

**Board Pack: losing has its own module and Highest loss % — DONE
(`337c70e`), 1 Oct.** Shaun's request.
- **"Won a set % of games or more"** is the old "Won or lost" module
  (same id, `over_80`), now winners only.
- **"Lost a set % of games or more"** (`lost_pct`) is new, with **its own
  threshold** (50–100%, 80 by default; reaching it counts) and its own
  minimum games. On by default, right after the winners.
  - A pack saved before the split keeps showing its losers: the new
    module arrives right after the winners, on or off as they were, with
    their threshold and minimum.
- **"Highest loss % (3+ games)"** (`worst_record`) sits beside Best win %,
  off by default. It is losses ÷ games played, so draws count as games.
- All three have report blocks, Share image pictures and Share Deck
  slides.
- **Found and fixed:** saving pictures to a device dropped any past the
  tenth (Chromium ignores a burst of more than ten downloads). An 11-slide
  deck lost its last picture. Files are now handed over a moment apart.

**Player Monthly Packs — DONE (`d6e4ae1`), 1 Oct.** Shaun's brief.
- **Where:** Admin / Manage › Monthly Board Pack › **Player packs** (a
  Club pack | Player packs switch above the month). Admin only.
- **What an Admin can do:** pick the month, see every player who played,
  **Generate all** (a draft for each, one write, never published, edits
  already made are kept), open one player, switch modules on and off,
  reorder them, set their options, add an **Admin note**, preview the pack
  and its mobile Share Deck, share pictures and the summary, publish,
  republish and unpublish.
- **Modules (default order):** Month at a glance; Matchup types;
  Partners; Opponents and head-to-head; Best results; Where results were
  weaker; Monthly movement; Next-month ideas. Every row shows the matches
  it rests on.
- **Private link:** `review/?p=<token>`, a 128-bit random token. See
  Section 5, *OPEN 1 Oct — Player Packs*, for the access model and the one
  Firestore setting it needs to be private in storage too.
- **Published packs are snapshots** with revisions, as the club's review
  is.
- No rating, League, Merit or Race rule changed; no new stats engine.

**Board Pack options and saving as you go — DONE (`f58ec1d`), 1 Oct.**
Shaun's requests from his phone.
- **"Won or lost a set % or more"** (`2d43540`): the threshold is a choice
  (50, 60, 70, 75, 80, 90 or 100%; 80 by default). **Reaching it counts:**
  4 of 5 counts at 80%. This replaces the first "more than" reading.
- **Partnerships show draws** (`2d43540`):
  - each pair's drawn games that month are in its record (W-D-L) and in
    its win %;
  - chemistry still comes from decided games, because draws are not
    rated;
  - the list is still pairs with 2+ decided games.
- **Power Rankings at month end:**
  - **Minimum games:** 1, 3, 5 or 10. 5 is the Rankings month default.
  - **Players:** Everyone, Leave out inactive, or Ranked only.
  - "Idle" is judged at the month's close.
  - "Inactive" is the club's flag. It has no history, so it is today's
    status.
- **Records always read W-D-L.** Best win % used to show W-L-D.
- **The pack saves itself after each change.** There is no Save button.
  Saving is independent of Publish, which still only changes the review
  link.

**Tier S sections switch; Board Pack and Share Deck as pictures — DONE
(`6f40764`), 1 Oct.** Shaun asked for all three.
- **Tier S sections** (Admin › Visible to everyone): Shown or Hidden,
  club-wide, Admins included. It defaults to Shown, so nothing changed
  until it was switched.
  - Hidden drops the Tier S **section** from: League and Merit by tier,
    the Monthly Race, the Kings of Tiers panel, and the Board Pack and
    Share Deck tier modules.
  - The player stays in Power Rankings, the results table, Monthly
    Information and their profile.
  - No figure changes.
  - League "All together" already left Tier S out; that rule is
    unchanged.
- **Pictures, all before publishing:**
  - every Board Pack module and note has **Share image**;
  - the Share Deck preview has **Share this slide**, **Share all slides**
    and **Copy summary** (no link until it is published).
  - **Sizes:** slides are 1080 × 1350; modules are 1080 wide and as tall
    as needed, with League tiers in one picture and aligned columns.
  - They open the phone's share sheet (WhatsApp is on it), or are saved
    where a browser cannot share files.
  - They are drawn on a canvas from the same data as the screen (no
    library), via Board Pack "blocks", so a picture shows what the report
    shows.
  - Only players' slides are included; Admin-only sections stay out.
- **This is the image export staged on 30 Sep (Section 3),** now done at
  the agreed 1080 × 1350.

**Monthly Review: Unpublish and Kings tiles — DONE (`a5cbe84`),
30 Sep.** Shaun asked for both.
- **Unpublish** (Admin only, with a confirmation):
  - The link immediately says the month's review "is no longer
    available".
  - The review is kept, marked withdrawn; nothing is deleted.
  - "Publish again" brings it back as the next revision.
  - Messages already sent in WhatsApp keep their text.
- **Kings of Tiers**, in the deck and in the Board Pack report, now uses
  the app's own crowned tiles: the laurel crown, tier metals, serif
  names and bold ratings.
  - In the deck the tiles share the card: one large; two side by side;
    three with the top tier across the top; four in a square.
  - Reviews published earlier keep the look they were published with.

**Monthly Review Share Deck — DONE on `app-features-fixes` = `main`
(`4af924d`), 30 Sep.** Shaun's brief. The redesign branch is untouched.
- **Admin Board Pack → players' Share Deck.** The same selected modules,
  in the same order, from the same module data. There is no second
  configuration and no second calculation.
- **Each module has a slide form:** a headline, the top 3–5 and big
  figures, never a full table. Commentary becomes a "From the club" card.
  A module with nothing to say that month is left out. A cover card opens
  the deck, and a closing card links to the app.
- **The deck:**
  - portrait 4:5 cards in the dark and gold look;
  - swipe (native scroll-snap), previous / next, dots (a count and a bar
    past 12 cards), arrow keys, and announced position;
  - safe-area aware, no sideways scroll at 375px, reduced motion
    respected.
- **The link:** `…/review/?m=YYYY-MM` is stable across revisions and
  needs no unlock. It works on Vercel, GitHub Pages and locally, and
  Vercel redirects `/review` to `/review/`.
  - The page reads only the published review and the visibility settings.
    It loads none of the app, so it cannot recalculate anything.
  - Players can Share (the phone's share sheet) or Copy link.
- **In the Board Pack section:**
  - Preview: **Board Pack | Share Deck**.
  - **Draft → Publish** (with an inline confirmation) **→ Republish** as
    the next revision.
  - Editing or saving the pack never changes the link. The section says
    when the pack differs from what players see.
  - Open review, Share, Copy link, and **Copy summary**, the WhatsApp text
    built from the published slides.
- **Visibility:** a slide built on a section made Admin only (Power
  Rating, Partnerships) is left out for players, and out of the summary.
  The Admin preview names what was left out.

**Admin Monthly Board Pack — DONE on `app-features-fixes` = `main`
(`9e4a5e6`), 30 Sep.** Shaun's brief; no redesign-branch change.
- **Where:** Admin / Manage › Monthly Board Pack. Admin only, like the
  rest of Manage.
- **What an admin does:** choose a month; select or deselect modules;
  order them with Move up / Move down; set each module's options; add
  commentary sections (title + body); preview; save. Export / print is
  not built.
- **Commentary is marked** "Admin commentary" in the pack, and is shown
  as text, never markup.
- **Monthly Information is unchanged** and stays the players' month
  review. The pack can include it as a module.
- **19 modules**, each drawn from the function the app's own screen uses:
  - Month overview (games, players active, draws), Monthly Information;
  - Power Rankings at month end, Kings of Tiers;
  - League, Merit, Monthly Race;
  - Most wins & points, Best win %, Most games;
  - Power Rating risers & fallers, ranking climbers & sliders, Monthly
    Performance, crossovers;
  - Form at month end (Last 10), Hard & favoured wins, Doughnuts,
    Partnerships of the month, Tier movements.
  - Options are presentation only: top 3 / 5 / 10 / all, all tiers or
    one, which half (risers, fallers or both, and so on), qualifiers only
    or with provisional (Race).
- **Selectors moved out of renderers**, so the screens and the pack read
  one derivation:
  - `monthlyInformation`, `monthlyStories` (`monthlyStoryData.js`);
  - `rankingPool`, `kingsOfTiersFor`, `tierAtMonthClose`
    (`rankingsData.js`);
  - `leagueSplitRows`, `lastTenAtMonthEnd`, and sort orders callable
    without the screen's state (`monthlyTablesData.js`).
  - **Proof:** the behaviour snapshot against `21a2de2` is identical in
    37 of 38 states, including Rankings, League, Merit, Race and
    Information. The one difference, Manage with every section open, is
    the new section.
- **Storage:** Section 5, "Board Pack: saved figures or live ones?".
  Stats left out for want of a canonical source are listed there.
- **Added the same day (`e666a96`), at Shaun's request:** two more
  modules, both on by default.
  - **Monthly results table:** one row per player for the whole month,
    from the League / Information aggregation. Columns: Tier (as held, for
    example "B → A"), P, W, D, L, Pts (3 / 1 / 0) and Diff, the
    Information "hardest games" measure. It can be ordered by points,
    games or difficulty.
  - **Won or lost over 80%:** players who won, or lost, more than 80% of
    their games. Draws count as games; exactly 80% is not flagged. The
    minimum is 3 games by default, Information's own rule, with
    "everyone" or 5+ as options.
  - 21 modules in all.

**Player Experience Reset — Phase 2 (Play) DONE on `ux/player-reset-v2`
(`6291cdc`), with the rules on `main` (`7d70cc0`, `86beb59`).** Shaun,
30 Sep: DQ6–DQ9 agreed as recommended, and the go-ahead given.
- **The rules, on `main`:**
  - **DQ6:** a player in the game may record the court as booked.
    - It is attributed to them (`byPlayer` in the history).
    - It needs an agreed game they are still in, and one that is not
      archived.
    - Only an Admin can take it back.
  - **DQ7 and DQ8:** unchanged. Replacement stays Admin-only, and players
    get no change of plan.
  - **DQ9:** a request may carry an optional time and venue.
  - **Asking for a game has one path, `submitGameRequest`,** used by the
    old form and the new sheet alike.
  - **`domain/fixtures/playView.js`** is the view-model. The Play badge is
    now My Games' "Needs you", counted, so there is one definition.
- **The screens, on the branch:**
  - Play opens on **My Games | Club**, with **Arrange a Game** beside the
    switch.
  - **My Games:**
    - its sections are Needs you (answer in place), Upcoming, Called out,
      Waiting on others and Archived;
    - below them sit Challenges and Played games & results.
  - **Club:**
    - four counters that are also the filter;
    - an Admin answers unrecorded bookings here.
  - **The game sheet:**
    - the stepper;
    - the existing fixture card, with answers, Add result pre-filled
      (DQ11), and for an Admin the prediction, reconciliation and
      Manage fixture;
    - **"I've booked a court"** for a player, through a confirmation.
  - **Arrange a Game:**
    - **Find a game:** Match Ideas as "Suggested for you" (DQ32), and the
      full finder.
    - **Request:** four players, with an optional date, time and venue.
    - **Paste a list:** hands off to Add multiple games.
- **Kept, deliberately:**
  - The previous Upcoming and Requests screens are reachable from Club
    ("as before") until Shaun accepts the new lists.
  - Find a Game, Paste a list and Challenges open their existing screens.
    Their restyle is Phase 6.
- **Evidence:**
  - With the chrome left out, all 38 existing screen states are
    **identical** at 390px and 360px.
  - **816 / 816** on the branch; **780 / 780** on `main`.

**Player Experience Reset — Phase 1 (shell) DONE on `ux/player-reset-v2`
(`0772379`), with the functional pieces on `main` (`a3f6939`).** Shaun's
go-ahead, 30 Sep.
- **Five tabs:** Home · Rankings · Play · Players · **Me**. More is gone.
- **Me holds what More held:** My Player, Data & Rankings, the Power
  Rating Guide, About, Doughnuts, and Admin (shown as "Admin sign-in" when
  locked), plus "View my profile".
  - With no player chosen it asks **"Who are you?"** (DQ5), with no
    sign-in language.
  - Me is drawn over the app, so the screen underneath keeps its state.
- **Rankings:** **Power | This Month**, with **More tables** (Win / Loss,
  Insights, North vs South, Doughnuts) in a sheet beside the switch.
- **Play and Players:** they keep their existing destinations in the same
  segmented control until Phases 2 and 5 build My Games | Club, Arrange a
  Game and Directory → Profile.
- **The Play badge:** it draws `playActionCount` (DQ29) and is hidden at 0.
- **System Back works inside the app:** it closes the sheet on top, then
  returns to the previous screen (Home's Full Review included). It leaves
  the app only from the first screen.
- **Evidence:**
  - With the navigation chrome left out, all 38 behaviour-snapshot states
    are **identical** at 390px and 360px, so no screen's content changed.
  - 15 new tests. **795 / 795** on the branch; `main` is **768 / 768**.
- **`main` gained two things:** the badge count (`playActionCount`, a
  functional fact) and the snapshot tool, committed as
  `scripts/behaviour-snapshot.js` + `behaviour-diff.js` with a new
  content-only mode.

**Player Experience Reset — Phase 0 (foundations) DONE on `ux/player-reset-v2`
(`cd844f6`).** Shaun's go-ahead, 30 Sep. **No screen changed.** It is on the
redesign branch only; `main` does not carry it.
- **Tokens:**
  - the champagne `--accent`;
  - `--row-self`;
  - a **steel-blue `--state-booked` (`#8FB3D9`)**, chosen well away from
    Tier B sage and upward movement (DQ20);
  - `--state-attention`, `--move-up`, `--move-down`, `--danger-text`;
  - the type roles, `--radius-block`, `--touch-min` (44px) and one z-scale.
- **Contrast:** the Ledger's is kept. Muted text stays `--text-dim`, and
  every new text colour is AA on cards.
- **Fonts:** Instrument Serif and Inter, **self-hosted** WOFF2 with their
  OFL licences, with no third-party request.
  - Nothing uses them yet, so the app downloads none of them.
  - **Finding:** Instrument Serif has **no tabular figures**. Numbers that
    must line up use Inter with `tabular-nums`; the serif is for display.
- **Primitives:** the map's component set, under **new class names only**
  (a test enforces it). Each tappable one is 44px.
- **HTML helpers:** presentation-only, in `ui/components/primitives.js`.
- **A reference page:** `docs/design/primitives.html`.
- **Evidence:**
  - The 39-state DOM + computed-style snapshot is **identical** at 390px
    and 360px. Only the 27 new custom properties were left out, and a test
    proves none redefines an old one.
  - 18 new tests; **780 / 780** on the branch.

**Player Experience Reset — CGPT presentation decisions RESOLVED (Shaun/CGPT, 30 Sep).**
- **DQ20 — visual system:** adopt Claude Design's **champagne gold `#D5B76E`** and **Instrument Serif + Inter** (self-hosted); keep the Ledger's stronger contrast levels. **Booked gets a distinct state hue** so it cannot be confused with Tier B or positive movement.
- **DQ5 — first run / no viewer:** Me and Play › My Games ask **“Who are you?”** and open the existing player selector. No sign-in/account language is implied. Until a viewer is chosen, Home may show club-level monthly context rather than fabricated personal data.
- **DQ29 — Play badge:** show only the count of items the selected player must genuinely act on: **For Me requests + Needs Attention fixtures involving that player**. Hide the badge at zero.
- **DQ31 — Home hero content:** lead with the viewer's **current monthly competition position**, explicitly named by tier and month (for example, `3rd in Tier B · September`), with a compact record/points/movement line. Tapping opens Rankings › This Month for Home's month. **Race stays out of the hero while it remains a trial.** When no viewer is selected, show club-month context and the “Who are you?” path rather than personal rank.
- **DQ32 — Match Ideas:** move to **Play › Arrange a Game**, as a suggested-for-you area associated with Find a Game. It remains governed by existing visibility and D4 rules; no player-facing favourite verdicts.
- **DQ33 — Kings of Tiers:** put a **Kings of Tiers ›** row directly beneath the compact Power podium, opening its own destination; also list it in Rankings › More tables.
- **DQ2 — movement period:** Rankings and Me use **this month**; Latest Result / Last Time Out uses the **last-match delta**. Always label the period.
- **DQ11 — Add Result from fixture:** open the existing Add Result flow **pre-filled with the fixture's players/sides**; no arbitrary time gate. Existing approval/reconciliation rules remain unchanged.
- **DQ24 — monthly position copy:** always name the tier (`3rd in Tier B`); Race may show **provisional** below its qualification threshold; split-month movers use their current spell for the contextual position.
- **DQ30 — Around the Club:** keep it deliberately light, **2–3 derivable items maximum**. Never invent a social feed or unsupported club activity.
- **Kings / podium basis conflict resolved:** **Power Rating is the basis**, matching the current code. The older 17 Sep statement that Monthly Performance is the podium/Kings basis is stale/superseded; do not change calculation merely to satisfy that old wording.
- These decisions clear the **presentation blockers for Phases 0 and 1**. Phase 0 is now ready for its explicit implementation go-ahead; this entry does not itself authorise broad visual implementation beyond the approved phase process.

**Product idea backlog — APPROVED STRUCTURE / NOT AN IMPLEMENTATION QUEUE (Shaun/CGPT, 30 Sep).**
- Money Padel needs a permanent GitHub home for **unapproved / exploratory product ideas** so ideas from chats are not lost and can be revisited later.
- This is deliberately separate from `PROJECT_LEDGER.md`:
  - `PROJECT_LEDGER.md` remains the coordination record for approved decisions, current state, implementation truth and handoffs;
  - the idea backlog is a parking lot and **an entry appearing there does not authorise implementation**.
- Preferred home: `docs/product/IDEA_BACKLOG.md`, with a lightweight `docs/product/IDEA_TEMPLATE.md` if useful.
- Suggested idea lifecycle labels: **Idea · Explore · Approved · Building · Delivered · Parked · Rejected**. Moving an idea to Approved still requires the normal Shaun/CGPT decision and Ledger handoff.
- Seed the backlog from known Money Padel discussions where the idea is genuinely identifiable, preserving uncertainty instead of converting old brainstorming into decisions.
- **New idea to capture:** a **Video Highlights & Moments** feature. Store video externally (not in GitHub) and keep Money Padel references/metadata that can link a clip/moment to a canonical match and to players. Candidate metadata includes match ID, video/storage URL, timestamp, title/description, participating player IDs, featured player IDs, tags and creator. Potential surfaces include Match Detail, Player Profile, Me / My Highlights, Around the Club and future season/year recap. This is an idea only; storage provider, schema and UX are not approved.
- Other historical brainstorms may be recovered into the backlog, but CCode must distinguish **already-approved features**, **parked/open Ledger questions**, and **pure ideas** rather than duplicating or changing their status.
- When implemented, the backlog should have a short usage note explaining how Shaun/CGPT/CCode add ideas and when an item is promoted into the Ledger.
- **DONE (`8b7657b`, CCode):** [`docs/product/IDEA_BACKLOG.md`](./docs/product/IDEA_BACKLOG.md) and `IDEA_TEMPLATE.md`.
  - **Section 1, ideas only:**
    - IB-01, Video Highlights & Moments;
    - IB-02, a season or year recap, which was only mentioned in passing;
    - IB-03, an attendance record, from the design mock and not requested.
  - **Section 2:** pointers to items already parked or open here (match
    sharing, the rating-model backlog, live updates, the service worker,
    DQ6/7/8/10, the design sync, the Predict render). Their status is not
    copied or changed.
  - **One question for Shaun sits in IB-01:** consent and removal for clips
    of identifiable players. It is privacy, so it is his.

**Player Experience Reset — IA / Keep-Simplify-Move-Merge-Hide-Remove review COMPLETE (Shaun/CGPT, 30 Sep).**
- **Core rule:** each primary tab answers one obvious player question; secondary analysis, settings and Admin controls move deeper/contextually rather than competing at the top level.
- **Final top-level player IA:** **Home · Rankings · Play · Players · Me**.
- **Home:**
  - Keep the hero, but make it **smaller, interactive and live-data driven**, in the spirit of the Claude Design concept rather than a decorative banner.
  - Prioritise **monthly competition / movement** in the hero because it changes more often than Power Rating; Power Rating, Tier Rank and form stay but are simplified/demoted.
  - **Last Time Out stays.**
  - The separate Monthly Snapshot is **simplified heavily / largely absorbed into the hero**.
  - **Match Ideas moves** out of primary Home.
  - **Needs You** and **Next Game** are added as first-class Home sections.
  - Home's target hierarchy is: live monthly hero → Needs You → Next Game → Last Time Out → light Around the Club/context.
- **Rankings:**
  - Only **Power | This Month** are primary entry points.
  - **Power** = current club strength; simplify filters/sorts into secondary controls.
  - Keep a **compact podium near the top** of Power. **Kings of Tiers stays, but as a secondary Rankings destination**, not a large competing block.
  - **This Month** contains **League · Merit · Race** (League first while Race remains a trial), sharing the month context and drill-down pattern.
  - W/L, Last 10, Monthly Performance, historical month-end Power, North vs South, Insights/Call-Outs and other niche analysis move under **More tables / deeper analysis** rather than equal top-level tabs.
  - Methodology/info remains available behind disclosure/deeper navigation.
- **Play:**
  - Only **My Games | Club** are primary.
  - Requests, Called Out, Upcoming and Needs Attention become **lifecycle/state views**, not separate top-level destinations.
  - **Find Game + Request a Game + Add multiple games** merge behind one clear **Arrange a Game** entry point.
  - **Played Games & Results** stays as the history/results destination.
  - Challenges stay but are demoted into the My Games flow.
  - Admin fixture management/reconciliation remains contextual and out of the normal player mental model.
- **Players:**
  - Primary journey is **Directory → Profile**; search is the main directory interaction and advanced filters are secondary.
  - **Compare and H2H are moved/demoted into the profile/player flow**, not equal top-level destinations.
  - Profile leads with identity/current standing, then **You vs them**, recent activity, and progressive-disclosure deeper analysis (journey, partnerships, rivals, full stats).
- **Me:**
  - Replace the current More/junk-drawer role with a genuine personal dashboard, distinct from a normal Player Profile.
  - Me covers **my performance, this-month standing, history, personal settings and gated Admin tools**.
  - My Player selector, Data & Rankings/settings, Power Rating Guide, About and Admin/Manage move here/deeper as appropriate.
  - Doughnuts may be reachable from Rankings and Me; North vs South and Insights/Call-Outs belong under Rankings deeper analysis.
- **DQ18 resolved:** keep both podium and Kings; podium compact near the top of Power, Kings secondary.
- **Home hero timing:** visual implementation can be staged, but the target product now **retains a compact live-data hero**; do not remove it from the redesign.
- **Branch consequence:** the IA gate is now cleared. `ux/player-reset-v2` may be created from the recorded branching point `f75a493`; immediately bring current `main` into it so later hosting/preview/non-redesign changes are inherited. Do not merge redesign work back to `main` until Shaun releases it.
- **Next step:** update the Claude Design implementation map/phase briefs to reflect this IA before visual implementation; then proceed in controlled phases.

**Vercel is the primary host; GitHub Pages is legacy (Shaun, 30 Sep).**
- **Deployments:**
  - `main` is production.
  - Redesign and feature branches get their own Vercel preview deployments.
  - Custom domains come later.
- **The build stamp:** Vercel's (`scripts/stamp-build.js`) is the canonical
  deployment stamp. Every deployment, production or preview, shows its own
  commit in Admin / Manage.
- **Paths:** the app and `/preview` use relative paths throughout, with no
  absolute `/assets` path anywhere, so root hosting works as it stands.
  The preview tests serve from `/`.
- **Pages compatibility is kept, because it costs nothing.** It amounts to
  `_config.yml`, `buildInfo.pages.js` and the preview's repo-path handling.
  No new work is designed around it, and it comes out if it ever needs
  maintenance.
- **In code:** only comments changed (`f98b99e`). The "Pages stopped building"
  note in Section 5 is closed by this decision.

**Desktop phone preview — DONE (`8e1c91e`).** Shaun, 30 Sep.
- **What it is:** `/preview` is a review page for a laptop. It shows the real
  app inside a phone-sized frame, with presets for 375, 390 (the default)
  and 412, plus Rotate, Refresh and Open full size.
- **Same app, same data:**
  - The frame loads the normal app URL from the same origin, so it is the
    same code, the same record and the same device state (My Player).
  - It never loads `/preview`, so it cannot frame itself.
  - `index.html` does not load it; no app file changed.
- **Real phone widths:**
  - The app's viewport genuinely is 375, 390 or 412 CSS pixels wide.
  - On a short screen the whole device is scaled down with a transform.
    The app's own width is never changed.
  - Desktop scrollbars are hidden inside the frame, because a classic
    scrollbar would take 15px and leave a 390 preview laid out at 375.
- **On a phone:** no frame, just "Open Money Padel normally".
- **Hosts:** it works on Vercel, GitHub Pages (below the repository path)
  and local servers.
  - The page adds the trailing slash itself.
  - `vercel.json` also redirects `/preview` → `/preview/`. Its build
    command is unchanged.
- **Live on Pages:** not yet, for the same reason as the split (Section 5).

**Parallel-development split — DONE (`0b9c9eb` … `f75a493`).** Shaun/CGPT,
30 Sep. Behaviour-preserving refactor so the functional and redesign streams
rarely edit the same file. The record is
[`docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md`](./docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
- **What moved:**
  - `app.js` 10,178 → 2,215 lines; `shell.js` 2,568 → 655.
  - 40 files under `assets/js/data/`, `domain/`, `features/<area>/` and
    `ui/`, each moved unchanged.
  - `app.css` split into base, `components.css`, `shell.css` and
    `screens/<area>.css`, with every class name kept.
- **One new domain module:** Games filtering and the one-player record
  (`domain/matches/gamesFilter.js`), behind `filteredGames(filters)` /
  `playerRecord(games, player)`.
- **No rule changed:** ratings, fixtures, permissions, scoring, Firestore
  schema, routing and visible behaviour are all untouched.
- **Evidence:** a 39-state DOM plus computed-style snapshot is identical at
  390px and 360px against the pre-split commit, and the suite passes after
  every step.
- **Live on Pages:** not yet. Pages has not built since 29 Sep; see
  Section 5. The pushes change no behaviour.
- **Branching point: `f75a493`.** The redesign branch `ux/player-reset-v2`
  is **not created**. It waits on Shaun's IA review (Section 5).

**Two working branches (Shaun, 30 Sep).**
- **`app-features-fixes`:** features, bug fixes and functional updates.
  - It replaces `claude/upload-commit-main-yfgpx0`, renamed for clarity.
  - It is kept identical to `main` and pushed with it, so this work goes
    live.
- **`app-redesign`:** the app redesign.
  - It is created from `main` at `ec963d5`.
  - It is **held**: nothing on it goes to `main` or the live site until
    Shaun says so.
  - Keeping it close to `main` means **merging `main` into it** from time to
    time. The reverse, `app-redesign` into `main`, happens only on Shaun's
    release.
- **Housekeeping:** the old `claude/upload-commit-main-yfgpx0` still exists
  on GitHub, because this session's proxy refused to delete it. Shaun can
  delete it from the repo's Branches page. It holds nothing that is not on
  `main`.

**Repository renamed to `MP-Dashboard-Beta-v2` (Shaun, 29 Sep).**
- **Pages URL:** the GitHub Pages site is now
  `https://sgj-92.github.io/MP-Dashboard-Beta-v2/`. GitHub does **not**
  redirect the old Pages path, so old links and home-screen shortcuts need
  the new address.
  - A device's saved My Player choice survives, because the host
    (`sgj-92.github.io`) is unchanged.
- **What the rename did not touch:**
  - The app hard-codes no repository name or URL.
  - Vercel follows GitHub renames.
- **Git:** GitHub redirects the old git URLs. CCode's remote now points at
  the new name.
- **`package.json`:** its `name` is updated to match.
- **Pages builds resumed:** the "pages build and deployment" run 133 deployed
  `6a311c6` at 13:53 UTC. That resolves the stopped-builds note in Section 5.

**Build stamp now works on Vercel as well as GitHub Pages — DONE (`fa60180`).**
Shaun, 29 Sep.
- **The answer to "is it platform-agnostic?": it was not.** The SHA came
  only from GitHub Pages' Jekyll run. On Vercel every device would have read
  "local build / Build dev". That is safe, because it never shows a wrong
  commit, but it never shows the right one either.
- **The fix:** Vercel now stamps the same line from its own deploy SHA, via
  `vercel.json` and `scripts/stamp-build.js`. GitHub Pages is unchanged.
- **Heads-up:** Section 5 has one Vercel setting to confirm.

**Games: one player's filtered record — DONE (`d348c56`).** Shaun, 29 Sep.
- **What it does:** with exactly one player in the Games filter, a compact
  line sits above the list. For example:
  *"Rishi · BB vs BB · July 2026 — 8 played · 5 wins · 0 draws · 3 losses —
  62.5% win rate"*.
- **How it counts:** from the very list the rows are drawn from. P is the
  number of rows, and W + D + L = P.
- **Filters:** month, game type and player all apply. Tier matchups use the
  tiers held on the day.
- **Other states:** no player or a group shows no record. No games reads
  "No games match these filters".
- **Heads-up:** Section 5 has three small judgment calls.

**Games filtered player record summary — APPROVED / NEXT (29 Sep).** Shaun/CGPT. *(Delivered `d348c56`, see the entry above. The brief is kept as queued.)*
- In **Play › Games**, when exactly one player is selected, show a compact aggregate record above the historical results for the **same final filtered match set**.
- Example: `PDM · AB vs AB · September` → `5 played · 3 wins · 0 draws · 2 losses` plus win %.
- The summary must reconcile exactly to the rows underneath: **P = displayed qualifying matches** and **W + D + L = P**. Do not run a second broader stats query.
- It inherits every active compatible Games filter (player, month/date, tier matchup and other existing result filters). Tier matchup uses the **canonical historical match-date tier classification**, never the player's current tier.
- Player perspective is side-independent: win/loss/draw is determined from the selected player's team regardless of stored left/right orientation.
- Show only for **one selected player**; zero matches get a deliberate empty state rather than a meaningless `0%`.
- Scope is deliberately small: no new navigation destination, no new player-statistics engine, and no rating/League/Merit/Monthly Race/matchup-classification changes.

**Claude Design implementation map — DELIVERED (`08712d4`, mapping only).**
Shaun, 28 Sep: *"implementation mapping only … Stop and return the baton to
Shaun/CGPT."*
- **The map:**
  [`docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md`](./docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md).
  It covers all 18 areas the brief named, each with its nine questions
  answered, plus the primitives to build first and a phased order.
- **Nothing in the app changed.**
- **Headline:** almost every number the design shows already has one
  canonical function behind it, so the work is presentation and routing, not
  calculation. The exceptions are rules the mockup invents, which stay out:
  - tier numbers and rating boundaries;
  - Best Month as rating gained;
  - Merit as 3 / 1;
  - "5 games in 60 days";
  - 7-day movement;
  - fuzzy name auto-accept;
  - Reliability meaning attendance.
- **Decisions needed:** Section 5 lists what needs Shaun and what CGPT can
  lead (DQ1–DQ30).
- **Baton → Shaun / CGPT.**

**Design mockups filed: `docs/design/claude-mobile-v1/` (28 Sep).** At
Shaun's request, three Claude design canvas files were added as reference
material for Phase 2. They are not built and not approved as a spec.
- `Money_Padel_App.dc.html`: the player-app design exploration. It covers
  the five-tab IA, Home heroes, Rankings, Play lifecycle, Me, Players,
  Doughnuts, and Admin › Manage fixture.
- `MPTabBar.dc.html` and `MPStatusBar.dc.html`: the components it imports.
- **Caveats:** its sample numbers and assumptions (tier boundaries, Merit
  scoring, venues) are illustrative, not the club's rules. The files need
  their design tool's `support.js` / `image-slot.js`, so they will not
  render as normal web pages.

**D7 Doughnuts: Doughnut List and Month — DONE (`e4408ff`).** Shaun, 28 Sep.
- **By Player** is unchanged.
- **Doughnut List** is new: each doughnut as a result, newest first. Tapping
  one opens the game in Play › Games.
- **One Month control** serves both views. It opens on the Meaningful Month,
  as Rankings and League do.

**Audit fixes D4, D5, D6 — DONE (`9cca86c`).** Shaun, 28 Sep.
- **D4.** Find a Game stays for players; its predictions (a predicted win %
  or favourite call) are Admin-only everywhere. The visibility settings now
  govern every route in the new shell.
- **D5.** Tier Rank is one number, the player's place in the current Power
  Rankings within their tier. Rishi's profile now reads **#8 of 8 in Tier A**
  in both places; before, the header said "#8" and Player Analysis "#9 of 9".
- **D6.** P / W / D / L in the League and Merit tables open the exact games
  they count, like Hard and Fav.
- **Heads-up:** Section 5 has three judgment calls for Shaun.

**Fixture follow-up 2: My Requests, Add multiple games, archived call-outs —
DONE (`b12e837`).** Shaun/CGPT, 27 Sep.
- **Requests** now shows three lists for the selected player:
  - **For me:** requests waiting on my answer.
  - **My Requests:** requests I made that are still waiting on others.
  - **Other requests:** everything else.
  - All three are newest first.
- **Add multiple games** reads a pasted list and shows a review screen.
  Nothing is created until the reviewed list is confirmed.
- **Archived call-outs:** a Called Out game with no court booking after 14
  days moves there. It is archived, not deleted.
- **Heads-up for Shaun:** see Section 5. The six live call-outs archive
  themselves on **5 Oct**.

**Fixture follow-up: Called Out, Upcoming and Manage fixture — DONE
(`0766d7b`).** Shaun/CGPT, 27 Sep.
- **Called Out vs Upcoming.** A game all four have agreed is **Called Out**.
  It becomes **Upcoming** only when an Admin records *Court booking made*. A
  date, time or venue never promotes it.
- **The Upcoming tab** has three sections, each collapsible on its own:
  Needs attention (at the top, shown only when something needs it), Upcoming
  and Called Out.
- **Backing out.** A player who backs out puts the game in Needs attention;
  nothing is deleted. An Admin can replace them on the same fixture, and the
  replacement confirms for themselves.
- **Manage fixture** is the Admin's one panel for a fixture. Remove fixture
  now lives inside it.
- **Existing fixtures are not classified as booked.** An Admin answers each
  one. Section 5 has what Shaun needs to know.

**Fixture flow D1–D3 — DONE (`023a0f7`).** Shaun/CGPT decisions of 27 Sep,
from the Phase 1 audit's defects:
- **One record, request to result.** A fixture runs pending → Upcoming →
  played, or removed, with every change in its `history`.
- **D1.** Players can no longer delete a shared fixture. A participant can
  say "I can't play" for themselves only, which flags the fixture as Needs
  attention. Removal is Admin-only, behind a second confirmation.
- **D2.** The requester starts confirmed. Each participant answers for the
  selected player only, on the Pending card in Play › Requests.
- **D3.** A result never closes a fixture by itself: the Admin says which
  Upcoming game it was, if any.
- **Upcoming.** Cards arrive folded to one line and open independently.

See Section 2 for the rules and NEXT #15j for what remains (D4, D5).

**Player Experience Reset, Phase 1 audit — DELIVERED (`0f9db42`).**
Evidence only; the app is unchanged.
- **Report:** [`PLAYER_UX_AUDIT.md`](./PLAYER_UX_AUDIT.md).
- **Evidence:** 77 screenshots of the current build on a read-only copy of the
  live beta, with an index and the journey tap-log, in
  [`docs/ux-audit/`](./docs/ux-audit/INDEX.md).
- **Reproduce with:** `scripts/ux-audit-capture.js`.
- **Also found:** five defects, not fixed (NEXT #15j).

**Monthly Race (Best Month) — TRIAL DELIVERED (`25191b8`).** A fourth View on
the League screen: everyone in a tier starts the month on 0 and each match
carries stakes set for an ordinary player of that tier with the actual
partner and opponents. Reconciled to `BEST_MONTH_ANALYSIS.md` on the live
record: same order in every tier. See NEXT #15i.

**Build stamp — DONE (`fc8ebb6`), moved to Admin / Manage (`28f3514`).** The
foot of Admin / Manage (locked or unlocked) reads *"Money Padel Beta · 26 Sep
2026 / Build a4c91e2"*: the build the device is actually
running, stamped by GitHub Pages' own Jekyll build, never hand-maintained and
never fetched. Tap copies a one-line version for bug reports. **There is no
service worker** — see Section 2 for when a new deploy reaches a phone.

**Meaningful Month — DONE (`87368a1`).** Power Rankings, League and the Home
monthly card open on the current month only once it holds **5 or more
canonical completed matches** (draws count; pending submissions and player
appearances do not). Before that they open on the most recent month with
games, with a quiet *"September is taking shape · 3 of 5 games"* note and a
one-tap way to view the current month anyway. The default is pinned on
arrival, never on a redraw, so a fifth game being approved does not move a
reader mid-page. See Section 2 for which rule each screen follows.

**Tom/Fatch reassessment audit — RESOLVED (`838ca66`).** Shaun reported the app
still described Tom and Fatch as reassessed to Jords' level. **The numbers were
never wrong.** Both active events anchor to **1400 at 20%**, the record replays
to itself, and no rendered surface names an individual comparator. The stale
source was a document — `HISTORICAL_REVIEW_DRYRUN.md`, headed *"APPLIED"* and
still presenting the superseded Jords anchor as fact. Corrected there, with the
old rows struck through and kept. Full findings in Section 5.

**Players Directory refresh — DONE (`43401f8`).** The filter card no longer
takes half a phone before a player appears: Tier and Status fold behind a line
that says what is on, sort stays out, tier chips wrap instead of clipping at
375px, and Active has stopped shouting on every row. Presentation only — every
filter, sort, Compare and navigation behaviour is unchanged. Captured in
`docs/screenshots/16-players-directory.png` and
`16b-players-directory-filters.png`.

**League screen refinement — DONE (`3e326e1`).** Both disclosures and the
Last 10 form table. The table used to start 482px down an iPhone SE; Month and
View now share a row, the explanation folds, and the four tier tables fold as a
block that says how many it is hiding. **Last 10** is a third table over each
player's own most recent ten rated games, deliberately not scoped to the
selected month — the league's own 3/1/0 and game difference, no new metric.
Short samples show their real P, marked `of 10`, never padded. Aggregation
lives in `lastTen.js` and was verified against an independent walk of the live
record. Captured in `docs/screenshots/17-league-by-tier.png`,
`17b-league-tiers-collapsed.png`, `18-league-last-10.png` and
`18b-league-last-10-explained.png`.

**Disclosure correction — DONE (`11ed091`).** Shaun reviewed the delivered
screen and both disclosures were too heavy. `How this table works` is now a
quiet tappable line with a small chevron — no card, border or fill — expanding
inline, still collapsed by default. The global `Tier tables` accordion is gone:
each tier heading carries its own chevron and collapses independently, keeping
`.section-heading` so it stays the same type and weight as every other heading.
Tiers default expanded and reset to expanded on entry to By tier by every
route. Captured in `17-league-by-tier.png` and `17b-league-tiers-collapsed.png`
(Tier A folded, B and C untouched).

**Predict a Matchup — copy refinement DONE (`55d2fa7`).** The card led with
*"Expected performance score: 0.82 / 0.18"* and the 80/20 blend beneath it —
engine detail on a card whose reader is deciding whether a game is worth
playing. It now reads: predicted winner → expected share of games for both
sides → teams and ratings → rating-point edge → a one-line muted footer. The
80/20 machinery and the phrase `Expected performance score` are gone from it.
**Visual treatment deliberately unchanged**, per Shaun's same-day deferral.
Captured in `docs/screenshots/19-admin-predict.png`.

**Merit scoring refined — DONE (`510c4cc`).** An even matchup is now worth
**3**, exactly a standard League win, so the two tables share a baseline and
Merit departs from League points only on fixture difficulty. Draws now earn
**0**. Re-audited: win values range **1–4**, nothing outside 0–6, no negatives,
and the floor never engages on real data. **Verified on the record:** six
players have Merit exactly equal to their League points — each with no draws
and only even wins, which is the property the change was made for.

**Merit Table — DONE (`767e0d3`), refined by `510c4cc`.** A second league view over the same matches,
scoring how hard the partnership you beat was. Derived on demand from canonical
matches plus the canonical historical-tier resolver; nothing persisted, nothing
in the engine touched. Audit of the full history found a **maximum gap of 2
tier-steps** and win values ranging **2–5**, so **no cap is needed**. Sits
behind the existing View select. Full detail in Section 4.

**Monthly rankings coherence — DONE (`2fdc169`). The persisted record was
correct; both faults were in the display.** Rishi's Tier A beside `1464` was
real, and the cause was not his data. His 20 September reads PROMOTION B→A
(rating unmoved), then CLUB_RATING_REASSESSMENT 1464.2 → 1640, then a match to
1641.6 — exactly his stored rating. **No repair was needed and no stored
history was touched.** Two general display faults are fixed; see Section 4.

**Player rename — DONE (`25e4624`), by freezing the identity instead of
migrating the record.** Shaun's answer to the A-or-B question was neither:
*"I just need editable names with no consequences."* So `playerId` keeps its
current value for ever and a new `displayName` carries the label. A rename
writes **one field on one document** — no match, no journey event and no
document id is touched. `playerNames.js` translates at the two edges; the app
above them works in labels, the record below them works in identities.

**A defect that found, and the reason this needed a test rather than a
demo:** after a rename the record **no longer replayed to itself**.
`buildWritePlan` rebuilds a player document from engine state, which has no
display name, so `verifyNoOp` reported `players/Rishi differs` — and a record
that does not verify is a record the app **refuses to edit**. Renaming anyone
would have silently disabled match corrections. Fixed in `replayForward` with
`PLAYER_LABEL_FIELDS`, beside the provenance fields it already preserved for
the same reason. The rule now holds generally: *a replay reconstructs engine
state and must not destroy fields it does not own* — true for any field added
to a player document in future, not just this one.

**The renames are live and verified (21 Sep).** Shaun renamed three players in
the app — **Ant Slice → Ant Slicer**, **Dennis → Denis**, **Stormzy → Stormz** —
and reports it working. Verified against a fresh read of the live record:

| Checked | Found |
|---|---|
| Player document ids | **Unchanged.** Still `Ant Slice`, `Dennis`, `Stormzy`. No new label is used as an id anywhere |
| Matches / journey under a new label | **None.** All 38 matches and 43 journey events for the three still sit under their original ids |
| `previousDisplayNames` | Present on all three, holding the old name |
| **Replay-to-self** | **IDENTICAL, 0 differences** — so match corrections still work, which is the thing a rename could have broken |
| Every match name resolves to a player doc id | **Yes**, all 34 |

**The write path was exercised in production, not just in tests.** Two matches
were recorded on 21 Sep *after* the renames — `PDM & Dennis vs Osh & Stormzy`
and `Stormzy & Osh vs Antz & Fatch` — and both were written to the record under
the players' **original ids**, not their new labels. That is the
display → identity translation at the match write boundary working on live
data.

**A second duplicate explanation, found by collapsing the tier tables.** The
legacy per-tab explainer also said *"Points: 3 for a win, 1 for a draw"*, so
the League view carried two explanations with two chevrons. Pre-existing —
it was buried under the tables. Now hidden on League, kept on Information
(where its Doughnuts / Player of the Month content is the only explanation
there is), and restored on every other tab.

**A defect the Directory tests caught, worth keeping visible.** A player name is
free text and was written into the page unescaped: a name containing `<b>`
rendered as `ac`, losing two characters of somebody's identity, and it was an
injection surface. `escapeAttr` became `escapeHtml` and now covers the rendered
text as well as the data attribute. No live player name is affected today.


---

## 2. AGREED ARCHITECTURE

Full methodology and the experimental record live in
[`RATING_MODEL.md`](./RATING_MODEL.md) — not duplicated here.

**Engine (frozen — `sequential-v1`).** Chronological sequential model. K
declines 40 → 10 as reliability rises; `rc = 10`; reliability from effective
evidence. Actual score = 80% game share + 20% match result; draw = 0.5; draws
are rated. Weighted, deliberately not strict zero-sum. Pre-match expectations
are persisted and never recomputed in the browser. Initial tier informs the
starting level but does not permanently anchor it.

**Hosting and deployment (30 Sep).** **Vercel is the deployment target**
for all new work: production, branch previews and `/preview`.
- **Production:** `main`.
- **Branches:** each branch's Vercel preview deployment is where it is
  reviewed. The redesign branch will get one too.
- **`vercel.json`:** no framework, the stamp as the build command, and a
  `/preview` → `/preview/` redirect.
- **Stamp:** Vercel's is canonical. `VERCEL_GIT_COMMIT_SHA` is set for
  production and preview deployments alike, and dated Europe/London.
- **Paths:** anything new must work from Vercel's root, using relative
  paths as the app already does.
- **GitHub Pages is compatibility only:** keep it where trivial, never
  design for it, and drop it if it costs maintenance.

**Code layout and load order (30 Sep).** The app is still one set of
classic `<script>` tags sharing one global scope, with no build step. What
changed is where code lives:
- **`data/`:** Firebase, permissions and the viewer.
- **`domain/`:** pure calculations.
- **`features/<area>/`:** a screen's data (`*Data.js`) and its rendering
  (`*Screen.js`).
- **`ui/`:** shared components.
- **`app.js`:** base data, state, per-screen months, the router,
  `dataChanged()` and `init`.

`docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md` is the map and says which
stream owns what. `tests/architecture.test.js` enforces the rules the layout
depends on:
1. Every layered module loads before `app.js` and only declares.
2. No two scripts declare the same top-level name.
3. No top-level initialiser reads a binding from a later script.
4. `domain/` is pure.
5. Stylesheets load tokens → base → components → shell → screens.

The source-level guards scan every application script
(`tests/helpers/appSource.js`), so moving code cannot switch one off.

**Data loading and rendering (22 Sep).** Start-up issues every read it needs
at once — three collections and eleven configuration documents, none of which
is an input to any other — and waits for all of them together. Measured: one
round trip instead of fourteen, first content 499ms instead of 3,779ms at
250ms latency, of which under 40ms is computation. Two rules follow from it and
are enforced by tests:

1. **Nothing draws a screen before the record exists.** `DATA_READY` gates
   every renderer; until it is set the app says it is loading. Start-up then
   draws whichever screen the reader is actually on, not only the rankings
   list. Start-up's two halves — the record arriving and the shell being built
   — no longer finish in a fixed order, so whichever finishes second draws the
   first screen (`drawFirstScreen`).
2. **Every change to the record ends at `dataChanged()`**, which recomputes and
   redraws the screen in front of the reader. A source-level test fails the
   build if a mutation calls `recomputeAll()` without it.

Nothing is cached on the device: every launch reads the record fresh, so no
screen can show a rating from a stale copy. Repeat navigation is already
instantaneous (0.2–6.3ms per screen, measured warm) and needs no cache.
Development instrumentation lives behind `?perf=1` (`perfTrace.js`) and reports
when the record arrived, when each screen was drawn and what each derived
calculation cost; it compiles to nothing when off.

**Every screen owns its month (26 Sep).** `selectedMonth` belongs to Power
Rankings alone and opens on its Meaningful Month (below; was: the last
completed month). Every other screen with a month owns its own:
League/Merit/Information `summaryMonth` (Meaningful Month; was: last completed
month), Games `gamesMonth` (All time), Compare `h2hMonth` (All time), Player
Profile `profileMonth` (All time on every open, narrowed only by the profile's
own control, kept across the sheet's in-place refreshes). `populateMonthSelect`
requires the value it displays. A source-level test fails the build if
anything outside Power Rankings reads or writes `selectedMonth`.

**Meaningful Month (26 Sep, `87368a1`).** A screen that opens on "the month"
opens on the current month once it has **5+ unique completed matches**, else
the most recent earlier month with any (else All time). Pure rule in
`meaningfulMonth.js`; counts canonical approved matches (`getAllApprovedMatches`,
draws included, pending excluded), deduped by id, in the reader's **local**
calendar. Each such screen keeps two things, never one global:

- a **default**, evaluated and pinned on *arrival* (tab click from another
  screen, boot, Home via `goToSection`) — never in `render()`/`dataChanged()`,
  so new data cannot move a page someone is reading;
- the user's **choice**, kept per screen, which beats the default until the
  month disappears from the record.

| View | Month rule |
|---|---|
| Power Rankings (+ W/L, podium, Kings of Tiers, monthly summary — they share its month) | **Meaningful Month** · own choice (`rankingsMonthChoice`) |
| League / Merit / Information (+ WhatsApp summary) | **Meaningful Month** · own choice (`summaryMonthChoice`) |
| Home monthly card (+ Player of the Month) | **Meaningful Month** · no control; re-evaluated each arrival at Home |
| Home → View Full Review | opens **the month the card shows**, without touching League's own choice |
| Games | **All time** · own local selection (`gamesMonth`) |
| Compare | **All time** · own local selection (`h2hMonth`) |
| Player Profile | **All time** match log · own control (`profileMonth`); current state is **rolling** |
| Doughnuts (By Player and Doughnut List share it) | **Meaningful Month** · own choice (`doughnutMonthChoice`), kept across views and reopening — D7, `e4408ff` |
| Last 10, current Power Rating, Home Your Game, Call-outs, Directory | **Rolling / current / all-time** — never month-scoped |
| Monthly rating breakdown | follows the month its caller passes |

The note shows only while the default is the fallback, the reader is looking
at it, and the current month has at least one game (nothing to show at 0).

**Monthly Race — a fifth monthly story (26 Sep, `25191b8`, trial).**
`monthlyRace.js` is the whole calculation, and it is pure: it reads canonical
approved matches (`getAllApprovedMatches`, draws in, pending out) in played
order, `historicalTierOf`, and the persisted pre-match ratings in
`V3_MATCH_FACTS`. It writes nothing and is never persisted.

- **Par** for a tier-month is the mean month-opening rating (pre-match rating
  of a player's first match that month) of the players who played in that
  tier.
- **par win** = winChance(mean(par, partner), mean(opponents)), with a
  results-fitted Elo curve (scale 250, **not** sequential-v1's 400
  game-share expectation).
- **Points:** win K(1−par win), draw K(½−par win), loss −K·par win; K = 20.
  Points are settled to 0.1 per match and the score is their sum, so a
  drill-down adds up on screen.
- **Rows** are per tier spell. 5 matches qualify; the rest are provisional.

It lives behind the League screen's View select and follows `summaryMonth`
(Meaningful Month). It is By tier only, and All Time asks for a month. A test
asserts that opening it changes no rating, League, Merit or Monthly
Performance output and writes nothing.

**Build stamp and how a deploy reaches a device (26 Sep, `fc8ebb6`).** Pages
deploys `main` by the legacy branch source, which runs Jekyll (github-pages
232) and passes it `build_revision` = the commit being built.
`assets/js/buildInfo.pages.js` is a Liquid template rendered to
`assets/js/buildInfo.js` with that SHA and the build date (Europe/London, set
in `_config.yml`); the committed `buildInfo.js` is a placeholder (`sha: null`
→ "local build / Build dev") that `_config.yml` excludes so it cannot overwrite
the stamp. `buildStamp.js` formats it and believes only a hex SHA and an ISO
date. **The stamp must never be fetched or asked of GitHub** — it is loaded in
the same page load as the code it describes. If the site ever moves to an
Actions workflow or adds `.nojekyll`, the stamp must move with it (the tests
guard the template and the exclude, not the Pages setting).

**On Vercel (29 Sep, `fa60180`).** Vercel runs no Jekyll, so the template never
renders there.
- **Config:** `vercel.json` sets no framework preset (the repo root is the
  site, as on Pages) and the build command `node scripts/stamp-build.js`.
- **What the script does:** it rewrites `assets/js/buildInfo.js` in Vercel's
  own build checkout.
  - The SHA comes from `VERCEL_GIT_COMMIT_SHA`. Any other host can opt in
    with `MP_BUILD_SHA`.
  - The date is the build date in Europe/London, and the line is exactly
    what the Pages template renders.
- **The same rules as Pages:**
  - the stamp is written by the deploy and never fetched;
  - without a believable SHA, the placeholder is left alone and the deploy
    is not failed;
  - the script reads only the environment and the clock.
- **Pages ignores the Vercel machinery:** `_config.yml` excludes
  `vercel.json`. `buildStamp.js` does not know which host built it.

*Update lifecycle, audited:* no service worker is registered and the manifest
is an inline data URL, so an installed home-screen app has no offline copy —
it loads from the network through the ordinary HTTP cache. GitHub Pages serves
every file with a 10-minute cache (`max-age=600`; documented behaviour, not
measurable from CCode's sandbox). A deploy is live ~40s after a push; a device
picks it up on its next full load once its cached copies are over 10 minutes
old. A backgrounded iOS app that is resumed does not reload, so it keeps
running what it loaded — which the stamp then reports truthfully. Files are
cached independently, so a reload inside that 10-minute window can in
principle mix a new `index.html` with older scripts; the stamp is loaded
alongside the scripts, not with the HTML. Versioned asset URLs or a service
worker would close that gap (NEXT #19).

**Three outcomes, never two (23 Sep).** A match is a win, a loss or a draw,
and the draw is the one code forgets. On a drawn match `winners` and `losers`
still hold the two sides — a match has two sides whatever the result — but
they mean nothing, and the record says so: every drawn document carries
`drawSideAssignmentArbitrary: true`. `matchOutcome.js` asks the question once,
**from the recorded outcome and never from the score** (a Money Padel draw is
usually an unfinished match, so its sets can look like anything, 6-0 6-1
included). Any screen that describes a game goes through it. Wording is fixed:
`A & B def C & D` for a decided match, **winner first whichever side is
reading it**, and `A & B drew with C & D` for a draw.

**Two match lists, and the difference matters (23 Sep).** `MATCHES` is the
RATED set and excludes draws, because a draw has no winner to rate; every
calculation reads it and must go on reading it. `matchesIncludingDraws()` adds
the drawn games back for screens that DESCRIBE history — head-to-head, a
player's own match log, the doughnut drill-down. Draws are rated (24 journey
events across the six), so an enriched drawn match carries its pre-match
ratings and its explanation like any other.

**Finding a game by who was in it (23 Sep).** `playerFilter.js` compares SETS
of participants, in canonical ids. Order-, side- and partnership-agnostic by
construction; one to four players, each narrowing; four is the exact group,
since a doubles match holds exactly four. Ids rather than labels so a rename
cannot empty a historical search — pinned by a test.

**Identity (22 Sep).** There were two. `currentUserName` is free text typed
into a "Your name" box and kept on the device; the VIEWER is the player chosen
in the header, validated against the roster. The viewer wins wherever it
exists — which the challenge code had already concluded for itself — falling
back to the typed name on a device that has never chosen a player.
`submissionIdentity()` is the single entry point; nothing reads a name field
any more. What is written to the record (`submittedBy`, the review actor,
`seenBy`) is unchanged in kind and more reliable in fact.

**One prediction, two screens (22 Sep).** `matchPrediction.js` holds the whole
calculation; `matchPredictionHtml()` holds the whole presentation. Admin's
Predict a Matchup and an agreed game in Upcoming both render what those
return. A side's strength is the MEAN of its players (so Strong+Weak equals a
mid pair), the figure is the engine's own expected score, and it is a share of
games — never a probability of winning, which nothing here has validated.
Predictions are never persisted and are admin-only wherever they appear.

**Match lifecycle (22 Sep).** prediction → Upcoming → Add result → a rated
game, with one record at each step. An Upcoming entry may carry an optional
`teams: [[a],[b]]` beside its flat `players` list (the sides a predicted
matchup was agreed as, which the old 0,1-vs-2,3 split could not express for
singles), and optional `preferredTime` / `location`; all three are additive
and absent on older records. Date, time and venue may stay TBC — a game is
agreed long before it is scheduled. Submitting the result clears the Upcoming
entry, so no game exists twice.

**Four separate concepts, never conflated:** Power Rating (current estimate) ·
Reliability (how established that estimate is) · Monthly Performance (versus
pre-match expectation) · Tier (club classification). A tier change alone moves
rating and reliability by exactly zero.

**Reliability bands (UI labels, derived from percentage, never match count):**
`<25%` Provisional · `25–49%` Developing · `50–74%` Established · `75%+` High
Reliability. Always shown with the actual percentage.

**Monthly Performance:** mean of (blended actual − persisted pre-match
expectation). 1–2 matches provisional · 3+ table and Kings eligible · 5+ podium.
Kings of Tiers require a positive result and use the historical tier of the
month. Eligibility is match-count based — a different concept from the bands.

**Monthly story retains rating progress as a separate concept.** Retiring the
legacy `computeMonthlyRating` means retiring a separately solved monthly rating,
not hiding how the real Power Rating changed during a month. The monthly UI
should expose four distinct views without conflating them:

- **Monthly Performance:** who most exceeded pre-match expectation.
- **Rating Movement:** each player's real Sequential-v1 Power Rating at the
  start of the month → end of the month, with points gained/lost.
- **Ranking Movement:** overall and within-tier rank at month start → month end,
  including meaningful player crossovers where practical.
- **League Table:** results/league points accumulated during the month.

Rating Movement and Ranking Movement must be derived from the actual
chronological Sequential-v1 rating state, not from a new monthly solver.
Monthly Performance remains the basis for the monthly performance podium and
Kings of Tiers; rating/rank movement is complementary context, not an award
substitute.

**Read strategy:** normal current-state rendering reads the compact `players`
collection. This constraint does **not** prohibit targeted historical reads.
Monthly Performance, Rating Movement, Ranking Movement and the real Rating
Journey may query `ratingJourney` when historical event state is intrinsically
required. Use bounded/filtered reads (for example by month and/or player)
where they suffice; ordinary current-state page rendering must not scan the
whole journey. Use month-filtered queries and the required Firestore index on
`effectiveDate` where appropriate.

**Narrow exception — Ranking Movement (Open Question 1a resolved):** accept the
current once-per-session cumulative `ratingJourney` read, cached for the session,
while the journey remains small (633 events at the last verification). All-player
rank at a historical boundary requires prior state for inactive players, which
a month-only query cannot supply. This exception does not replace `players` as
the normal current-state source or permit whole-journey reads per render.
Retain Ranking Movement; do **not** add a snapshot collection yet.

**Future review trigger:** Claude Code must reopen this read-strategy decision
when journey growth makes a single session load material in document reads,
read cost, or observed load latency, or when an import/backfill is expected to
do so. Record event count, reads/cost per session and observed load latency in
the Ledger at that review, and propose a scalable historical-boundary strategy
(including snapshots if justified) before expanding reliance on cumulative
reads. This is a temporary small-journey allowance, not permanent architecture;
the review trigger is not a blocker for the current monthly UI pass.

**Club reassessment:** forward-only and audited in normal operation. Two
modes — recommended statistical reassessment, and explicit club override of
rating *and* reliability. Promotion/demotion and rating reassessment are
separate events. A missing statistical recommendation is **not** itself a club
decision to keep the current rating; it means the board must explicitly choose
keep-current or an override.

**Reliability recommendation in reassessment:** the board's intuitive decision is
the player's new level/ranking anchor, not an arbitrary confidence percentage.
For future normal reassessments, the system should calculate and show an
explainable **Recommended Reliability** alongside the proposed rating anchor.
The board can accept that value or manually override it. A manual reliability
override remains permitted, but must be explicit, attributed and reasoned in the
same audited decision event. Historical 10% decisions for Shaun/Tom/Fatch remain
factual historical decisions and are not automatically the future default.

**Historical Club Adjustment:** Admin-only escape hatch for factual corrections,
late-entered board decisions and repair of bugs/errors. It is distinct from
Historical Match Correction. The Admin selects player + effective review date,
the app reconstructs the state immediately before that date, presents the same
reassessment choices used prospectively, requires attribution/reason, previews
the replay blast radius, and only then commits through replay-forward. Never
silently mutates or deletes an old decision: corrections are represented by a
new/superseding audited event and the downstream record is replayed.

**Specific superseding correction — Tom/Fatch baseline:** Tom's 1 Jul 2026
promotion reassessment and Fatch's 1 Aug 2026 promotion reassessment must both
use **1400 (standard Tier B baseline)** as the historical rating anchor. The old
Jords/Tom comparator-anchor decisions remain visible only as superseded audit
history. Replay all later rated matches/decisions chronologically from the
corrected state.

Reliability for these two corrected decisions is **20%**, not 10%. *(This
paragraph read "Keep the already-decided historical Reliability at 10% for both"
until 20 Sep. That was already stale when written: Shaun changed it to 20% the
same day and it was applied in `4bbda90`, recorded in the Decisions Log below,
and verified against the live record by the audit in Section 5. Shaun's own
1 Jul 10% is unchanged and is a separate, earlier board decision.)*

**League Table:** the September 2026 split-month treatment is authoritative and
implemented — each match is allocated to the tier held on its own match date,
points never transfer between tiers, and `All together` stays one whole-month
row showing the transition. The queued **Last 10** form table is a *results*
table derived from already-rated matches: it is not a new rating metric, it
opens no methodology question, and it must not touch Sequential-v1.

**Fixture lifecycle (27 Sep, D1–D3).** A fixture is one record in
`moneypadel_game_requests` from request to result. It is never copied when it
changes state. The rules live in `fixtureFlow.js`, which is pure: the app
supplies who is acting and whether they are an admin.

- **Lifecycle:** `pending` (Requests) → `confirmed` (Upcoming) → `played`, or
  `removed`. Every step appends to `history` as `{at, by, action}`. Fixtures
  created before this change have no history until their next change.
- **Responses:** the actor *is* the player responding; there is no "on behalf
  of". The actor is the selected player (`getCurrentViewer()`).
  - The requester is confirmed on creation.
  - "I'm in" moves the record to Upcoming at 4/4.
  - "Can't play" sets that player's own `cantPlay` entry and unconfirms them.
    The fixture stays listed as **Needs attention**.
  - "I'm in after all" clears it.
- **Removal:** Admin only, in two steps ("Remove fixture…", then "Remove
  fixture" / "Keep it"). It sets `status: 'removed'` with `removedBy` and
  `removedAt`; nothing is erased.
- **Results and fixtures:** a result is linked only by an Admin's answer.
  - **Candidates** have the same four players (canonical ids) and are
    Upcoming. The result's date must be no earlier than the day the fixture
    was arranged. If the fixture has a date, the result must fall between 14
    days before and 30 days after it; if not, within 45 days of the request.
  - **Scoring** only orders the candidates. It uses same or different
    partnerships, the date gap, and whether the result was submitted from that
    card. It never decides the link.
  - **At approval:** the Admin must pick a candidate or "None — still
    outstanding" before Approve is enabled.
    - "This was the game" sets `status: 'played'`, `playedMatchId`,
      `reconciledBy` and `reconciledAt`.
    - "Still outstanding" adds the result to `notResults`, so it is never
      offered for that fixture again.
  - **Stale fixtures:** an expanded Upcoming card gives an Admin the same
    choice against recorded results. Nothing is closed in bulk or on load.
  - **"Add result"** from a card records `fixtureId` on the submission as a
    proposal. It no longer deletes the fixture.
- **Court booking and stages (27 Sep follow-up, `0766d7b`).** An agreed
  fixture (`status: 'confirmed'`) is shown by a derived stage,
  `FixtureFlow.stage()`. The stage is never stored.
  - **Needs attention:** someone has backed out (`cantPlay`), or a replacement
    has not yet answered. This overrides the other two stages.
  - **Upcoming:** everyone is in and `courtBookingMade === true`.
  - **Called Out:** everyone is in and the court is not booked.
  - `pending` is still a request in Play › Requests, and `played` and
    `removed` are unchanged. Playing a game still needs the D3 Admin answer; a
    passed date never marks one played.
- **Court booking:** only an Admin sets it, in Manage fixture, in the review
  list, or when adding an agreed game. Turning it off keeps the date, time
  and venue. Backing out never clears it, because the court may still
  physically be booked.
- **Replacement:** the newcomer takes the same seat on the same side and the
  fixture keeps its id. The newcomer starts unconfirmed and the others keep
  their answers. `formerPlayers` and `history` record who agreed, who backed
  out, and who replaced them.
- **Admin answers:** an Admin can also set a player's answer directly in
  Manage fixture. It is recorded as `marked-in` / `marked-waiting` /
  `backed-out`, by the Admin.
- **Schema additions:**
  - `courtBookingMade` (boolean). Absent means not recorded, which is read as
    not booked and never written for you.
  - `agreedAt`.
  - `formerPlayers[] {name, replacedBy, at, by, hadConfirmed, backedOutAt}`.
  - `cantPlay[name]` now `{at, by, wasIn}`.
  - New history actions: `agreed` (was `upcoming`), `added-agreed`,
    `court-booked`, `court-not-booked` (with `firstRecorded` on the first
    answer), `backed-out`, `marked-in`, `marked-waiting`, `replaced`,
    `sides-changed` and `details-changed`.
- **Requests views (27 Sep follow-up 2, `b12e837`).** `requestLists()` splits
  outstanding (`pending`) requests for the selected player. They are views,
  never copies, and each request appears in exactly one list:
  - **For me:** I'm a participant and have not answered.
  - **My Requests:** `requestedBy` is me.
  - **Other requests:** the rest.
  - **Leaving:** a request leaves all three when it is agreed, because it is
    no longer `pending`.
  - **Can't play:** a request where someone can't play stays listed, flagged
    Needs attention.
- **Bulk entry (`fixtureParse.js`, pure).** One game per line.
  - **Separators:** sides split on `vs` / `v` / `versus` / `against`;
    partners split on `&` `/` `+` `,` `and`. Leading bullets and numbers are
    ignored.
  - **"Me":** `me` / `myself` / `i` is the selected player.
  - **Names** resolve only by exact, case-insensitive match against the
    directory of current names:
    - several possible players → **ambiguous**, and the person must choose;
    - exactly one near match (prefix or whole word) → **offered only**, never
      picked;
    - anything else → **unknown**.
  - **Problems named on review:** unparseable lines, incomplete sides, a
    count other than 2 v 2, the same player twice, and no selected player
    for "me".
  - **Duplicate warnings:** `FixtureFlow.matchupDuplicates()` warns about an
    active fixture with the same four players, or the same four twice in one
    paste. It never merges.
  - **Creation** happens only on "Create N requests". Each game is an
    ordinary `createRequest` by the selected player (the requester is in),
    with `teams` and `batch {id, index, size}`. A batch shares one
    `requestedAt`; `batch.index` keeps the written order.
- **The archive clock.**
  - `calledOutAt` is set the first time a fixture is Called Out and is never
    overwritten.
  - `activeSince` starts the active window. It is set with `calledOutAt`,
    and restarts **only** on Admin **Restore** (`restoredAt`) or on returning
    from Upcoming when the booking is unticked. Date, time and venue edits
    never touch it.
  - **Archived** is a derived stage: Called Out, and either `now ≥
    activeSince + 14 days` or `archivedAt` set by an Admin. Auto-archiving
    writes nothing.
  - **Archive call-out / Restore to Called Out** are Admin-only, in Manage
    fixture, and recorded in `history` (`archived`, and `restored` with the
    `archivedAt` it came from).
  - **Court booking made** takes a fixture out of the clock, and out of the
    archive if it was there.
  - Players cannot answer an archived call-out. D3 can still match one to a
    result.
  - **Legacy fixtures** (no `agreedAt`) take their clock from `requestedAt`,
    and the first write records that same time, not the moment of the edit.
- **Orders (all explicit, never storage order):**
  - **Requests:** `requestedAt` descending, then `batch.index`.
  - **Called Out:** `activeSince` descending (newest or newly restored
    first).
  - **Archived:** archived time descending.
  - **Upcoming:** date ascending, then time ascending. A TBC time comes after
    the timed games that day, and undated games come last.
  - **Needs attention:** newest request first.
- **Schema additions:** `calledOutAt`, `activeSince`, `restoredAt`,
  `archivedAt`, `archivedBy`, `batch`, and `teams` on player requests.
  History actions added: `archived`, `restored`, and `fromArchive` on a
  booking made from the archive.
- **Trust:** the viewer is self-declared, as before. These rules stop the app
  from offering the wrong action; they are not access control.

**Visibility and predictions (28 Sep, D4, `9cca86c`).**
- **One map of screens to settings.** `TAB_VISIBILITY_KEY` maps each screen
  to its setting, and `canSeeTab(tab)` answers for a reader. They are the
  only rule, and every place that decides visibility reads them:
  - the tab-switch guard, which every route to a screen passes through
    (shell navigation, More, Home and profile shortcuts, buttons on other
    screens);
  - the shell's section sub-navigation, and the tab a section lands on;
  - the More sheet;
  - the Home and profile shortcuts, which follow their content's setting.
    Match ideas and "Find This Game" follow Find a Game; "All Insights" and
    "Match to Prove It" follow Call-Outs.
- **Redraws.** Unlocking, locking or changing a setting calls
  `onVisibilityChanged()`, which redraws the shell's navigation and moves a
  reader off a screen they may no longer see.
- **Defaults.** Find a Game now defaults to **Visible**. The live record
  stores no visibility document, so the defaults are what players get.
- **Predictions are a fixed rule, not a setting:** `canSeePredictions()`
  is Admin only.
  - **Gated:**
    - Find a Game's best, alternative and "See all" cards. For players the
      reason line says how far apart the team ratings are instead of who has
      the edge.
    - Home "Match to Make".
    - The Challenge "Match ready" card.
    - Already gated: the Upcoming "Prediction available" fold and Admin
      Predict a Matchup.
  - **Not gated (not predictions):** a recorded match's pre-match
    expectation, which explains a rating already moved, and the Monthly Race
    stakes (see Section 5).
  - The prediction calculation is unchanged.

**Tier Rank (28 Sep, D5, `9cca86c`).** `tierRankOf(name)` in `app.js`
answers every "#N in Tier X".
- **Pool:** players who are rankable (PlayerState RANKED; Idle and Inactive
  are not ranked).
- **Order:** current Power Rating, the Rankings list's own comparator over
  the same player order, filtered to the player's current tier.
- **Min games:** the list's min-games number is a display filter, not
  eligibility, so it plays no part.
- **Readers:** the profile header ("#N in Tier X"), Player Analysis
  ("#N of M in Tier X"), the full-analysis text and Home.
- **Removed:** `buildPlayers`' `tier_rank` / `tier_size`, which ranked every
  tier member including Idle and Inactive players.
- **Not Tier Rank:** other positions keep their own names (League, Merit,
  Monthly Race, W/L, overall rank, and the monthly breakdown's month-end
  position).

**Table drill-downs (28 Sep, D6, `9cca86c`).** A League or Merit row now
records its games in the same step that counts them: League `matchList`,
Merit `games`, each game with its result for that player.
- **One component** serves all six counts (P, W, D, L, Hard, Fav): a count
  cell, a detail row straight under the player's row, and a game line.
- **Heading:** player · count · month · tier section or "All together" ·
  number of games.
- **Correctness:** a cell reading 2 therefore lists exactly those 2 games,
  under the same month, By tier / All together and split-month treatment
  as the cell.
- **Behaviour:** zero is never tappable, one detail is open at a time, and
  changing month or view closes it. Hard and Fav keep their own wording and
  order.

**Doughnuts (28 Sep, D7, `e4408ff`).**
- **One definition.** `doughnutMatches(month)` (`shell.js`) is the one
  doughnut definition: every rated match, decided or drawn, with a set that
  finished with a side on 0, and in which direction. It is the existing rule,
  lifted out of `computeDoughnutStats` unchanged.
- **Two views of it.** By Player (`computeDoughnutStats(month)`, the
  leaderboard, unchanged) aggregates it. The Doughnut List shows it as it is.
- **List order:** date descending, then the same day's games by id,
  later-recorded first.
- **A list row:** "27 Sep · **Len & Tom** 5–7, 6–0, 6–1 Rocky & MK".
  Winners first and bold, the shutout set in gold, a draw marked "Drawn".
  Tapping it opens the game through `openMatchInGames` (Play › Games), the
  same result detail Home's Last Time Out uses.
- **The month** is shared by both views. It follows the Rankings/League rule
  (`arriveAtDoughnuts`): the Meaningful Month on opening, a reader's
  explicit choice kept, and the "taking shape" note. "All time" is still
  available.
- **Empty month:** "No doughnuts in <Month>. 🍩" in either view.

**Storage:** `matches/{matchId}` · `ratingJourney/{eventId}` · `players/{playerId}`.
Normal current-state rendering reads `players`; historical views use targeted
`ratingJourney` reads, with only the session-cached Ranking Movement exception
and future review trigger defined above.

**Three corrections found in implementation, documented in `RATING_MODEL.md`
and authoritative over older instructions:** Fatch seeded Tier C in *both*
validation stages · the T2 pool rule (subject counts in the tier being joined;
linear-interpolation quartiles) · the stale dataset-end B→A row.


---

## 3. DECISIONS LOG

Shaun's decisions, including where an agent recommended otherwise.

| Decision | Note |
|---|---|
| Keep the legacy solver available during beta | **Shaun overruled Claude Code**, which recommended retiring it from the runtime because the beta's inputs differ from production's. Retained, but it no longer feeds the UI and must never be labelled "Production". |
| Production comparison uses a dated static snapshot | Chosen over the beta's locally recomputed value, which is a third, different number. |
| Beta Firestore: permanent open read/write, no auth | Deliberate and not a temporary state — there is no auth layer to make stricter rules meaningful yet. |
| April/May block is display-only, structurally enforced | Visible via the Data Range toggle; incapable of entering any calculation. Six players appear only there and correctly hold no rating. |
| Proper Firestore collections, not blob documents | Config blobs stay as they are. |
| Admin password claim window left open | Shaun will set it himself through the normal first-run screen. |
| Reassessment α ships at 0.25 | Below the best-performing 0.50, pending real reviews. |
| Coordination moves from Google Drive to this file | Claude Code could read the Drive doc but not write to it. |
| Engine is frozen | A surprising-looking rating is not a bug. Report suspected defects; do not adjust. |
| Month state is owned per screen, never shared by default | Shaun, 26 Sep: "Month defaults should belong to the feature/view that requires them unless we have explicitly designed a shared month selection." A profile must never become a historical snapshot because Rankings chose a month. Compare's default was set to All time by CCode on the same reasoning Shaun applied to Games (a head-to-head is a history); one line to change if he prefers otherwise. |
| A result becomes a visual state in exactly one place | `MatchOutcome.classFor()`. Three renderers of a form run had three private answers, and when the shared sequence changed type one of them silently drew every loss as a win. Nothing may derive a form state from a truth test; a source-level test fails the build if it does. |
| A draw is read from the record, never inferred from the score | Shaun, 23 Sep: Money Padel draws come from unfinished matches, injury and time limits, so the scoreline proves nothing. `outcome` on the document is authoritative. No screen may classify an outcome any other way. |
| Screens that describe history include draws; calculations do not | The rated set stays draw-free so no win percentage, league point or partnership figure moves. Head-to-head, the profile match log and the doughnut drill-down read the wider list, because a drawn game is still a game that was played. |
| Historical search matches on canonical ids | Shaun, 23 Sep: the new name editing must not be able to break a historical search. Both sides of the comparison go through `playerIdFor`. |
| The chosen player is the identity, not a typed name | Shaun, 22 Sep: the Games tab must not permanently spend screen space on a read-only name card when the app already knows who you are. The viewer wins; the typed name survives as the fallback. Attribution behaviour is unchanged — this is a better source for the same field, not a presentational shortcut. |
| A prediction is calculated once and shown twice | Predict a Matchup and Upcoming share `matchPrediction.js` and one presentation function. Nothing about a prediction is stored: it is recomputed from the players whenever asked, so it cannot go stale against a rating that has since moved. Admin-only in both places. |
| An Upcoming game may be created without a schedule | Date, time and venue are optional and show as TBC. Refusing to create a game without a date would make Upcoming describe a club that plans further ahead than it does. |
| The record is never cached on the device | CCode's 22 Sep audit found the cost was serialisation, not volume: fourteen independent reads taken one at a time. Reading them together removes 88% of the wait without introducing a copy of the record that could show an out-of-date rating. The desired `cached → render → refresh` shape was therefore implemented as `one round trip → render`, which reaches the same place with no staleness. **Caching the app shell (825KB of JS on every launch) is a separate question and is open for Shaun — it is a deployment change, not a code change.** |
| A mutation redraws the screen, always | Every mutation now goes through one function rather than each button redrawing whatever it happened to sit on. The two admin dropdowns that name a narrower redraw do so explicitly, because redrawing the whole of Admin under a finger would take focus off the select in use. Nothing may redraw nothing. |
| Monthly Rating is replaced, not monthly rating progress | Monthly Performance becomes the performance metric, while real Power Rating movement, rank movement/crossovers and League Table remain visible as separate monthly stories. No new monthly rating solver. |
| Historical reassessments must record factual club decisions, not hindsight | Shaun: 1 Jul 2026 was an **INITIAL_CLASSIFICATION_CORRECTION**, because he entered C only as an unknown and the club then determined the initial estimate was wrong. The club's factual assessment was **normal B baseline = 1400**. Tom (1 Jul 2026 C→B) and Fatch (1 Aug 2026 C→B) were genuine promotions/development and should receive the same **statistical reassessment process** used for future promotions, not an automatic B re-seed. |
| Historical Club Adjustment is a permanent Admin safety tool, not a one-off script | Build a narrow Admin UI over replay-forward for factual historical club-rating decisions/corrections. Separate it from Historical Match Correction. Require player, effective date, reason/attribution, old state, chosen decision, and replay blast-radius confirmation. Use a superseding/correction event rather than silent deletion. |
| No statistical recommendation ≠ keep-current | The dry run found Tom/Fatch had too few established C players for the T2 method to recommend a target. That does **not** mean the historical club decision was keep-current; it means the board must choose keep-current or a club override, exactly as it would prospectively. |
| Historical override anchors — **SUPERSEDED for Tom/Fatch on 20 Sep** | **Shaun, 1 Jul:** remains 1400. **Tom, 1 Jul:** previous Jords-based anchor is superseded; correct historical club decision is **B-tier baseline 1400**. **Fatch, 1 Aug:** previous Tom-based anchor is superseded; correct historical club decision is **B-tier baseline 1400**. Rationale from Shaun: anchoring to an individual B with a genuinely poor record distorted how far promoted players sat from the wider B population. Apply as audited superseding historical adjustments and replay forward; do not silently mutate old events. |
| Historical reassessment reliability = 10% | Shaun, Tom and Fatch all reset/reopen to **10% reliability** at their historical adjustment date so the model can move them quickly in the newly assessed tier/state. This is an explicit board decision, not a statistical recommendation. |
| Tom and Fatch historical anchors corrected to B baseline | Shaun corrected the prior board instruction. **Tom on 1 Jul 2026** and **Fatch on 1 Aug 2026** are each re-anchored to the standard **Tier B baseline of 1400**, not to Jords/Tom as comparator anchors. Because Sequential-v1 is chronological, replay forward from each superseding adjustment and accept downstream rating changes produced by the model. **APPLIED `4bbda90`.** |
| Tom and Fatch historical Reliability changed to 20% | Shaun, 20 Sep, superseding the earlier 10% for these two decisions only: both reopen at **20%**. A re-anchor of this size is past the full-reopen distance, so this is also exactly what the approved move-scaled rule recommends — the record shows board and system in agreement rather than an override. **Shaun's own 1 Jul 10% is unchanged** and remains a recorded board decision that predates the 20% floor. **APPLIED `4bbda90`.** |
| Future reassessment reliability is system-recommended but club-editable | For normal future promotions/reassessments, the club should primarily decide the **new playing-level anchor / comparable player**. The system should then present a **Recommended Reliability** using an explainable rule. Admins may accept it or manually override the percentage. Any override must be clearly labelled as a club override and stored with attribution/reason in the audited reassessment event. Do not force the board to invent a reliability percentage from scratch. |
| Move-scaled reassessment Reliability approved | Shaun chose **move-scaled** rather than a flat reset. Small rating re-anchors retain more of the player's prior Reliability; larger re-anchors reduce Reliability more aggressively. **D = 150 points** is the full-reopen threshold, and the system-generated minimum/floor at or beyond that threshold is **20% Reliability**. Manual override remains available and audited. |
| Monthly Review Reliability override validation must update live | The current form can remain disabled after the Admin enters a valid Reliability override and reason because validation only ran on render. Any change to the Reliability override percentage or recorded note must immediately refresh the draft, re-run `MonthlyReview.incompleteReasons()`, update warning copy, and enable/disable `Review what will be recorded` without requiring another selection, close/reopen, or unrelated tap. |
| Every future tier change requires an explicit rating decision in the same monthly review | Promotion/demotion does not itself move Power Rating, but the review cannot be completed until the board explicitly chooses **Accept recommendation / Club override / Keep current rating**. **Correct initial classification** is a distinct option for a genuinely wrong initial estimate. This prevents today's promotions becoming next week's backdating problem. |
| Same-review recommendations use one shared pre-review snapshot | If multiple players are reviewed on the same effective date, calculate all statistical recommendations from the same pre-review state so one player's accepted decision cannot alter another player's recommendation merely because of processing order. Apply confirmed events afterwards in deterministic order. |
| Historical monthly reads use filtered `ratingJourney` queries where sufficient | The `players`-first rule applies to current-state rendering, not to historical data that `players` cannot contain. Bounded month/player queries remain the default, subject only to the Ranking Movement exception below. No monthly snapshot collection for now. |
| Accept session-cached cumulative reads for Ranking Movement while the journey is small | Shaun/CGPT, 17 Sep 2026: resolve Open Question 1a by accepting the current once-per-session cumulative `ratingJourney` read, cached for the session. Historical all-player ranks need prior state for inactive players. Keep Ranking Movement; no snapshot collection yet. Reopen when journey size, read cost or latency becomes material, including anticipated import/backfill growth; see Section 2. |
| CGPT visual acceptance withheld pending presentation fixes | 18 Sep 2026 screenshot review: core architecture and premium visual direction accepted, but final beta sign-off waits on terminology, score-orientation, reliability visibility, Admin action-state, audit readability, correction/removal wording, monthly hierarchy and contrast fixes. No rating-model changes authorised. |
| CGPT product/UX acceptance requirements satisfied | 18 Sep 2026 after `e0fdcbc`: all eight requested presentation fixes are implemented and regression-tested (242/242; 21 browser). The date-edit refusal and non-duplicative Key takeaways are approved departures from the mockup. Final pixel-level look check remains with Shaun/on-device because CGPT cannot render private-repo PNG pixels directly from the GitHub connector. |
| Add player-facing Power Rating Guide in More | Players need both a short explanation and a detailed methodology view so small/unequal rating movements are understandable and defensible. The guide must explain expectation vs actual performance, reliability/K, why wins can move little, why losses can still gain rating, why partners move by different amounts, why reassessed/new players move faster, why club decisions are separate, and that ratings never reset monthly. Do **not** change Sequential-v1 merely because movements look small. |
| Historical correction controls are admin-on-demand | The Play history must remain a player-facing results surface. `Correct match`, `Remove and replay`, and replay-warning copy must not render permanently on every game card. Hide them entirely for non-admin users; for admin, expose a compact per-card `…` / `Manage` control that reveals the maintenance actions only on demand. |
| Player Tags adopts the Admin/Manage visual system | Keep `Add a new player` in an admin-style card. Put existing players in a second compact admin card/list. Each player initially renders as a compact summary row (name, tier/starting-tier summary, active/inactive, chevron) and expands inline to expose the existing Current Tier / Starting Tier / Status controls. Use the same sans-serif admin typography, not the large public-facing serif player-name style. Preserve all existing data behavior. |
| Admin/Manage uses collapsed accordions by default | Every major Admin/Manage section should use one consistent accordion component with title left and subtle chevron right. The entire header row is tappable. **All sections default collapsed whenever Admin/Manage is opened.** Multiple sections may remain open. Reuse the existing dark/gold card system and remove emoji-style admin heading icons in favour of the premium admin heading treatment. |
| Match-card Manage belongs with submission metadata | On historical match cards, move `… Manage` off the matchup/player-name row and place it on the same horizontal row as `Submitted by …`, aligned right. Row hierarchy: matchup uses full width; score beneath; submission metadata left + Manage right. This is especially to improve wrapping on narrow iPhones. |
| Player-facing rating explanations use match/game language first | Replace exposed `Performance score 0.xx against 0.xx expected` wording in normal player-facing UI with plain language: whether the team were favourites/underdogs/evenly matched, the approximate percentage of games they were expected to win, the percentage they actually won, the match result, whether they outperformed/met/underperformed expectation, and the resulting rating movement. Keep exact blended performance score, K and reliability only behind `See full calculation` / technical disclosure. Do not imply the model is games-share only: match result still contributes 20%. |
| Games tab defaults to All time | Shaun explicitly confirmed the Games view should open on `All time`. This is intentionally different from other monthly views. Users may still select a specific month manually. |
| Refinement phase: wording only; methodology questions parked | For the current refinement phase, do **not** change Sequential-v1. Fix the player-facing explanation so it accurately separates game-share expectation from the separate 20% match-result component. The broader questions about responsiveness, reliability/K and expectation symmetry are recorded in the backlog for a later evidence-led model review. |
| Ranking state terminology: Ranked / Idle / Inactive | Separate ranking eligibility from participation status. **Ranked** = active and currently meets the live-ranking rule. **Idle** = still part of Money Padel but currently below the recent-match threshold, so not shown in the live ranking. **Inactive** = explicitly not currently involved/participating. Idle is derived from recent activity; Inactive is an explicit club/player-status field. |
| Included Idle/Inactive players merge into the visible ranking | The filter toggles are not separate lower sections. When **Include idle** is on, Idle players join the main visible ranking pool and are sorted/ranked exactly as if currently eligible, while retaining an `IDLE` badge. When **Include inactive** is on, true Inactive players likewise join the same visible ranking pool and receive filtered-view rank positions, while retaining an `INACTIVE` badge. With both on, everyone appears in one ordered list. Official eligibility/status remains unchanged; these are filtered-view ranks only. |
| Match sharing / WhatsApp is a future communication layer | Suggested/requested matches should eventually support native Share / WhatsApp-friendly copy (with a Copy message fallback) because club coordination currently happens mainly in WhatsApp. This is useful follow-on work, not required to block the current Home visual refinement unless Shaun explicitly promotes it. |
| Home lower section: Club Pulse actionable, Match ideas collapsed, Last Result replaces Next on Court | Refine Home for usefulness over decoration. Club Pulse cards are clickable to the relevant player profile; `All Insights` must open the Insights/Call Outs area at its top, not mid-scroll. `Match to Make` becomes a collapsed `Match ideas` section by default. Replace `Next on Court` with a data-driven `Last Time Out` / `Your Last Result` card using the selected player's most recent rated match, score, rating movement and light factual commentary. Upcoming remains in Play; Home should not depend on Shaun manually maintaining future fixtures. |
| Ranking eligibility must be shared across Home/Rankings/Profile/Club Pulse | Shaun spotted Ant Slice showing `#–` on Home despite recent activity. All surfaces must derive Ranked vs Idle from one shared eligibility helper over the same v3 rated-match source/date window. A player must never be Ranked on one surface and Idle on another. Before changing data, verify Ant Slice's actual count of rated matches in the rolling 30-day window; if >=2, current `#–` is a bug. |
| Games cards show historical tier beside each player | On collapsed and expanded Games cards, show each player's **tier at match date** beside their name (e.g. `Eli (A) & Len (A) def Osh (A) & Rishi (B)`). Use the same temporal-tier source for visible labels and game-type classification so the UI can never display one tier while filtering the match as another. |
| Games tab supports historical tier-composition filtering | Add a Games filter based on the **tiers that applied when each match was played**, not current tiers. Support broad tier environments (all-A/all-B/all-C, mixed) and specific canonical matchup types such as `AA vs AA`, `AB vs BB`, `AA vs AB`, `AB vs AB`. The filter must combine with Month and Player; e.g. Player=Len + Game type=`AB vs BB` shows only Len's matches of that historical composition. Team orientation must not create separate categories. |
| Matchup filter ordering follows canonical tier strength, not frequency | Sort matchup options by partnership strength, then opponent strength, using `SS > SA > SB > SC > AA > AB > AC > BB > BC > CC`. Example sequence: `SS vs SS`, `SS vs SA`, …, `SA vs SA`, `SA vs SB`, …, `AA vs AA`, `AA vs AB`, `AA vs BB`, `AA vs BC`, `AB vs AB`, `AB vs AC`, etc. Counts remain visible but never determine order. Only combinations present in the current filter scope need be listed. |
| Winners are always on the left of a match card | Shaun, 20 Sep, asked directly: the winning side is shown first on every decided card, **regardless of tier strength**. Canonical partnership strength orders the players *within* a partnership and orders the *matchup label*; it never decides which side of `def` a team appears on. A draw has no winner, so it keeps the orientation it was stored in — which is also the side the scoreline is written from, and the card names it. |
| Canonical tier ordering governs matchup labels and historical partnership display | Use tier strength `S > A > B > C`. Within each partnership, always display the higher-tier player first; preserve original order only when both players share the same tier. Between partnerships, display the stronger canonical partnership first; preserve original team orientation only when both partnerships have the same composition. Therefore never show `BA`, `BS`, etc.; canonical forms are `AB`, `SB`, etc. This is presentation/filter normalisation only: **do not rewrite stored match/team/player order**. |
| Compact Games breakdown; full calculation must actually open | The expanded Games card is still too wordy. Keep only the concise matchup/expectation line(s), then rating change per player. Remove redundant explanatory prose already implied by the expectation/result line. `See full calculation` must be a working disclosure/accordion on the same card; it is currently inert and is a bug. |
| Mid-month tier changes split League Table results by match-date tier | For any month in which a player changes tier, League Table membership is determined **per match using the tier in force on that match date**. `date < effectiveDate` belongs to the old tier; `date >= effectiveDate` belongs to the new tier. Points/results never transfer between tiers. A player may therefore appear in two tier tables in the same month, with each row containing only the matches/points earned while classified in that tier. In `All together`, keep one whole-month row and show the transition (e.g. `B → A`) rather than duplicating the player. This is generic temporal-tier behaviour via `tierAsOf(player, matchDate)`, not hardcoded to the September movers. |
| League Table gets progressive disclosure + Last 10 form table | Shaun, 20 Sep 2026. The explanatory copy under the month League Table heading should be hideable/collapsible; the By tier breakdown should also be collapsible to reduce vertical length on mobile. Add a dedicated league-table view based on each player's **most recent 10 rated games overall** so current form can be compared cleanly as a table rather than compressed into the existing `Form (10g)` column. This is a results/form view only — do not create a new rating calculation or alter Sequential-v1. |
| Monthly Race (Best Month) is trialled as a fifth monthly story | **TRIAL DELIVERED `25191b8`.** Shaun, 26 Sep 2026 (NEXT #15i). Power-Rating-stakes monthly race: each tier spell starts at 0; stakes from partner/opponent pre-match Power Ratings with the scored player treated as an ordinary member of the tier; results-fitted curve 250; K 20; rank by race score; 5 matches qualify; mid-month movers can win in the tier they left; Tier C is never merged — "No qualifier this month"; League, Merit, Monthly Performance, Power Rating and sequential-v1 unchanged. |
| More shows the deployed build, derived from the build itself | **DONE `fc8ebb6`; moved to the foot of Admin / Manage `28f3514`** (Shaun, 26 Sep, same day: *"put it at the bottom of admin/manage instead"* — supersedes the More placement only; shown locked or unlocked). Shaun, 26 Sep 2026. Originally the bottom of More, small muted text: `Money Padel Beta · 26 Sep 2026` / `Build a4c91e2`. The SHA is the short Git SHA of the deployed commit, **derived automatically at build time, never maintained in source**; the date is the build's date, never the runtime date; the identifier describes the code actually executing on the device, **never** the latest commit from GitHub. Tap copies `Money Padel Beta · 2026-09-26 · a4c91e2`. Mechanism chosen by CCode: GitHub Pages' existing Jekyll build (`site.github.build_revision`), so no deployment setting changes. An `Update available · Refresh` prompt was considered and **not added** — see NEXT #19. |
| Meaningful Month — screens open on this month only once it has 5 games | **DONE `87368a1`.** Shaun, 26 Sep 2026. If the current calendar month has fewer than 5 unique completed matches, default to the most recently completed month; at 5+, default to the current month. Count canonical matches, not appearances; draws count. The current month stays manually selectable before 5. **Initial/default only** — never overrides an explicit selection, never jumps a reader mid-page when match #5 lands. Default and selection are separate, per feature, never one global. Rolling/current features (Last 10, current Power Rating, profile current state) are not forced onto the previous month. **Supersedes** Rankings' and League's "open on the last completed month" rule, and resolves NEXT #15e. CCode applied it to the Home monthly card too (it was not on the list) so Home and its View Full Review agree. |
| D1 — players never delete a shared fixture | **DONE `023a0f7`.** Shaun/CGPT, 27 Sep 2026, from audit defect D1. The participant action is **"I can't play"**, meaning Needs attention, not deletion. It is for the participant themselves only: nobody marks another player unable to play, and non-participants get no withdrawal control. Admin keeps full removal, **never exposed as a player action** and always behind a confirmation. Attribution and state are preserved. **No larger cancellation or rescheduling workflow yet.** |
| D2 — confirmations belong to the player responding | **DONE `023a0f7`.** Shaun/CGPT, 27 Sep 2026. The requester is auto-confirmed, so a request starts at 1/4. Each participant answers "I'm in" or "Can't play" for themselves, as the selected player, in Play (the Pending card under Requests), never through a profile. 4/4 moves the **same record** to Upcoming. Home is not redesigned by this. |
| D3 — a result never silently closes an Upcoming fixture | **DONE `023a0f7`.** Shaun/CGPT, 27 Sep 2026: *"NEVER silently auto-match."* At approval, plausible outstanding fixtures are found and the Admin is asked *"Does this result belong to this Upcoming game?"*, with the result and the possible match shown. **"This was the game"** links it, marks it played and keeps provenance. **"Upcoming game is still outstanding"** keeps the result valid and the fixture listed, and that pair is never proposed again. With several candidates the Admin picks one or **"None — still outstanding / unrelated result"**. With no credible candidate, nothing is asked. Stale fixtures are **never bulk-closed**: they are reconciled one at a time, and a past fixture with no plausible result stays available. |
| Upcoming cards arrive collapsed | **DONE `023a0f7`.** Shaun/CGPT, 27 Sep 2026. Collapsed by default on entering Upcoming. The one-line card reads "Erf & Eli vs Osh & Stormz / Date TBC · Venue TBC · 4/4 confirmed ›". Each game opens and closes independently; there is **no Collapse All**. The expanded card shows the teams, date/time/venue, requester, each player's confirmation, Add result, "I can't play" for a participant viewer, and Admin-only controls where appropriate. It must stay useful at 375px with a generous touch target. **Share Upcoming is future work, not built.** |
| Called Out is separate from Upcoming | **DONE `0766d7b`.** Shaun/CGPT, 27 Sep 2026. An agreed game is not Upcoming until a court is actually booked. Agreed-but-unbooked games are kept, as **Called Out**, so they are not forgotten. Both are sections of the existing Upcoming tab, **not a new Play sub-tab**, and each collapses independently. Cards keep the D1–D3 folded default. Called Out shows its age ("Called out 6d ago"). Old Called Out games are **never** auto-expired, deleted or cancelled, and there are no "Still happening?" prompts yet; both are future product decisions. **Supersedes D2's "4/4 moves to Upcoming":** 4/4 plus no booking is Called Out, and 4/4 plus a booking is Upcoming. |
| Court booking made is an explicit fact | **DONE `0766d7b`.** Shaun/CGPT, 27 Sep 2026. It is the authoritative line between Called Out and Upcoming. It is **never inferred** from a date, time or venue. It is set only by a deliberate Admin action, labelled "Marks this game as booked and moves it to Upcoming." Turning it off returns a healthy game to Called Out with its details intact. |
| Backing out and replacement keep the fixture | **DONE `0766d7b`.** Shaun/CGPT, 27 Sep 2026. A participant ("I can't play") or an Admin can record that a player backed out. The game goes to **Needs attention**, which overrides Called Out and Upcoming, and nothing is deleted. The fixture's identity, the fact that the player had agreed, the booking (**never silently cleared**), the details and the other answers are all kept. An Admin can replace the player **on the same fixture**. The replacement does **not** inherit the old player's confirmation, and the others keep theirs. Once the replacement confirms, the game returns to Called Out or Upcoming by the booking it kept. Provenance: agreed → backed out → replaced → confirmed. |
| Manage fixture; Remove is not a card action | **DONE `0766d7b`.** Shaun/CGPT, 27 Sep 2026. **Manage fixture** is an Admin-only secondary action that edits the existing fixture and never creates a replacement record. It covers players 1–4, sides, each player's answer, date, time, venue and Court booking made. **Remove fixture** moves inside it, keeping its explicit confirmation. The normal expanded Admin card is: details, Add result, Prediction available ›, Manage fixture ›. Players never see removal. D3 reconciliation is unchanged. |
| Existing fixtures are not migrated to "booked" | **DONE `0766d7b`.** Shaun/CGPT, 27 Sep 2026: a stored date is not proof of a booking, so none is invented. Fixtures without the fact are listed as Called Out, and a one-time, Admin-only **"Court bookings to record"** list asks about each one ("Court booked" / "Not booked yet"). Nothing is written until the Admin answers. See Section 5. |
| Requests: For me / My Requests, newest first | **DONE `b12e837`.** Shaun/CGPT, 27 Sep 2026. **For me** holds the requests where I need to respond; **My Requests** holds the requests I created that are still waiting on others. A My Request card reads like "Shaun & PDM vs Rishi & Erf / 2/4 agreed · Waiting for Rishi, Erf / Requested today". These are views over the single fixture record, which leaves them naturally as it progresses. A rejection or can't-play is kept as Needs attention, never deleted. **No new bottom-nav destination.** Every request list sorts by creation time, newest first, explicitly. |
| Add multiple games: parse, review, then create | **DONE `b12e837`.** Shaun/CGPT, 27 Sep 2026. Free-text list with common separators; "Me" is the selected player. Names resolve only against the directory: **no fuzzy match may invent a player, and no ambiguous name is chosen silently.** A mandatory review names ambiguous and unknown names, incomplete or malformed games, the wrong number of players, duplicate players and unparseable lines. Duplicate active matchups are a **warning, not a merge**. One deliberate "Create N requests" writes the requests, each entering the normal D2 lifecycle as a request by the selected player. |
| Called Out archives after 14 days | **DONE `b12e837`.** Shaun/CGPT, 27 Sep 2026. **Archived call-outs** sits under Called Out, folded by default. It is **archive only**: not deletion, cancellation, rejection, or evidence either way about the game. The clock starts when a game first becomes Called Out, and that time is preserved explicitly. **Only an Admin Restore restarts it**; changing the proposed date, time or venue does not (Shaun's explicit tightening). Court booking made takes a game out of Called Out and its clock. Admin can **Archive call-out** and **Restore to Called Out** in Manage fixture; Restore keeps identity, requester, players, confirmations, details and history. Orders: Called Out newest or reactivated first; Archived most recently archived first; Upcoming soonest first, with TBC times after timed ones that day. |
| D4 — Find a Game for players; predictions Admin-only everywhere | **DONE `9cca86c`.** Shaun, 28 Sep 2026. Find a Game stays in player navigation: it has not launched to the wider group, so low use is not evidence against it. Player-facing Find a Game recommends matchups but **never shows calculated win percentages or probabilities**; Admins keep the prediction layer. No route may leak a prediction a screen hides (Home, fixture cards, anything using the prediction engine). The visibility system must be authoritative wherever content is surfaced, fixed properly rather than patched for Find a Game. The prediction methodology is unchanged. |
| D5 — one canonical Tier Rank | **DONE `9cca86c`.** Shaun, 28 Sep 2026. **Tier Rank = the player's position in the current Power Rankings among players in their current tier, using exactly the Power Rankings page's ranking and eligibility rules.** There is one source, and every display labelled Tier Rank consumes it. Other rankings (Monthly Race, League, Merit, W/L, overall Power Rank) may differ but must be labelled as what they are. The Power Rankings definition is authoritative; eligibility and methodology are not changed to make numbers agree. |
| D6 — P / W / D / L open their games | **DONE `9cca86c`.** Shaun, 28 Sep 2026. In both the Merit and League tables, each player's P, W, D and L open the games behind them, like Hard and Fav. The detail says which player, which count and which month/table context. **"If the cell says 2, its drill-down explains exactly those 2 games,"** under the table's own filtering (month, By tier / All together, mid-month tier changes, split-month, history). Hard and Fav are unchanged, one drill-down component is shared, and mobile fit is kept. |
| Games — one selected player's filtered record | **DONE `d348c56`.** Shaun, 29 Sep 2026. When exactly one player is selected in the Games Player filter, show Played / Wins / Draws / Losses / Win % above the filtered list, **calculated from exactly the same final filtered match set the rows display**, never independently from a broader dataset: P = displayed rows and W + D + L = P, recomputed on every filter change. Tier matchups keep the canonical classification and historical tier on the match date; notation and order unchanged. Win from the player's own side whichever stored side they are on; a recorded draw is a draw. Win % = wins / played unless a canonical alternative exists (the League's monthly win % is exactly that, draws included, so it is reused). Zero games gets a deliberate state, not 0%. One player only; no multi-player summaries, no new navigation, no new statistics engine. |
| D7 — Doughnuts: By Player and a Doughnut List, with a Month | **DONE `e4408ff`.** Shaun, 28 Sep 2026. Keep the player-based view and add a list of the doughnut results themselves, with an obvious By Player / Doughnut List switch. Each row reads like "28 Sep · Shaun & PDM 6–0, 6–3 Rishi & Erf" in the app's result conventions. The list uses the **existing doughnut definition and data**, with no new definition. Tapping a result uses the existing result detail. A **Month** selector (historical months included) applies to both views and survives switching between them, defaulting by the app's existing month convention. The list is newest first with a deterministic same-day order, and an empty month gets a deliberate empty state. |
| Split the app before the redesign branch | **DONE `f75a493`.** Shaun/CGPT, 30 Sep 2026. It was a behaviour-preserving refactor into data / domain / features / ui and component / shell / screen stylesheets. The aim is that functional work (`main`, via `app-features-fixes`) and the redesign rarely edit the same file. There is no duplicate app: no `app-redesign.js`, no second rating, fixture or Firebase logic, and no mock calculations. `f75a493` is the common ancestor for `main` and `ux/player-reset-v2`. The redesign branch is created **only after Shaun confirms the product/IA Keep / Simplify / Move / Merge / Hide / Remove review is complete**. It then merges `main` at least weekly, and after any significant domain or data change. Unfinished redesign work never merges into `main`. |
| Desktop phone preview is a container, not a second app | **DONE `8e1c91e`.** Shaun, 30 Sep 2026. `/preview` frames the normal app URL in a same-origin iframe at 375 / 390 / 412 (390 by default). It uses no mock data and duplicates no screen code, and the app is not told it is being previewed. CCode left out the suggested `?embeddedPreview=1` flag: nothing needs it, and a URL the app never reads cannot alter product logic. It is desktop-only: a phone gets a link to the app instead. |
| Vercel is the primary hosting and deployment platform | Shaun, 30 Sep 2026. `main` = production/stable. Redesign and feature branches get their own Vercel preview deployments. Custom domains come later. The Vercel build stamp is the canonical deployment stamp. Relative paths must work from Vercel root hosting. GitHub Pages compatibility is kept only where trivial and is not removed unless it causes maintenance overhead. No new infrastructure is designed around it. Supersedes "GitHub Pages deploys `main`". |
| Power shows current ratings; month-end history moves to More tables (DQ3) | Shaun, 30 Sep 2026, confirming CCode's reading of the IA. Rankings › Power stops opening on the Meaningful Month's month-end view (the 26 Sep default) and shows today's ratings, so it agrees with Tier Rank everywhere (D5). Month-end Power history is reached from Rankings › More tables › Past months. The Meaningful Month still decides which month **This Month** opens on. It ships with Phase 4 on `ux/player-reset-v2`, not before; `main` is unchanged until Shaun releases the redesign. |
| Booked is steel blue `#8FB3D9`; aligned numbers use Inter, not Instrument Serif | CCode, 30 Sep 2026, Phase 0. Both are implementation choices within DQ20 (Shaun/CGPT). DQ20 asked for Booked to get a distinct hue: `#8FB3D9` is 8.6:1 on cards and over 45° of hue from Tier B sage, upward movement, attention and the accent. The map asked whether Instrument Serif has tabular figures before using it for numbers: it has none, so tables, points, scores and counts use Inter with `tabular-nums`. Either is a one-token change if CGPT prefers otherwise. |
| Play badge: "genuinely act on" read strictly; interim Play / Players entries | CCode, 30 Sep 2026, Phase 1, implementing DQ29 and the IA. **The badge** counts For me requests plus Needs attention games the player is in, **but not a game they backed out of themselves**, since nothing is left for them to do on it (an Admin replaces them). It is hidden whenever Requests or Upcoming is hidden from the reader (D4: it never points at a screen they cannot open). **Play and Players keep their existing entries in Phase 1**: My Games \| Club, Arrange a Game and Directory → Profile are new screens, so they arrive with Phases 2 and 5 rather than as relabelled old screens. Any of this is quick to change if CGPT prefers otherwise. |
| DQ6–DQ9 as recommended | Shaun, 30 Sep 2026, before Phase 2. **DQ6:** a player in the game may record that the court is booked. It is attributed to them, only on an agreed game they are still in and that is not archived, and only an Admin can undo it. The Admin review of unrecorded bookings stays. **DQ7:** replacing a player stays Admin-only. **DQ8:** players get no "Change plan"; date, time and venue stay Admin edits. **DQ9:** a plain request may carry an optional time and venue, as a suggestion, never a booking. Implemented in `fixtureFlow.js` on `main` (`7d70cc0`). |
| Accept all: the new Play lists, DQ1 as recommended, and the Phase 3a (Home) go-ahead | Shaun, 30 Sep 2026 ("Accept all"). **Play lists accepted:** "Upcoming, as before" and "Requests, as before" are to be retired from Club on `ux/player-reset-v2`. **DQ1:** no promotion bar and no threshold line; keep the one-line gap, worded "N pts below the lowest-rated Tier A player". **Phase 3a (Home) approved.** Shaun's same message said the Board Pack must not touch the redesign branch, so both are queued behind it (NEXT). |
| Admin Monthly Board Pack: a stored choice, figures drawn live | Shaun's brief, 30 Sep 2026; implementation choices CCode's. **DONE `9e4a5e6`.** A per-month document `moneypadel_board_pack_YYYY-MM` holds only the admin's choice: modules (id, on/off, options) and commentary in one ordered list, who saved it and when, plus a fingerprint of the month's record. It is read when an admin opens that month, never at start-up. Figures are never stored. Whether a finalised pack should freeze its figures is Shaun's call (Section 5). |
| Match Result Card first, Match Analysis behind it; deterministic match stories | Shaun's brief, 3 Oct 2026; story thresholds and wording CCode's, within the brief. **DONE `c6acfd9`.** `MatchScorecard.resultCard(vm)` derives the card from the scorecard view model and copies its fields, so **no second data path**. The same model feeds the sheet (`matchResultCardHtml`), the picture (`CardPainter.matchResult`) and the analysis (`matchAnalysisHtml`). **Heroes:** the winners; on a draw (nobody won), the side that beat expectation, under "All square". **Story:** the first rule that applies, on recorded figures (`MatchScorecard.STORY`): expected < 35% → *Major upset*; < 50% → *Beat the odds*; ≥ 75% of games → *Dominant display*; ≥ +20pp as favourites → *Statement win*; ≤ 55% of games → *Too close to call*; ≥ 0pp → *Expected win, delivered*; else *Job done*; a draw → *Honours even*. On the 30 Sep record: delivered 59, beat the odds 39, dominant 19, too close 15, job done 14, major upset 12, statement 9, draws 9. A winner always banks the 20% result component (median winner +16pp), which is why *Statement* needs +20. **Winners' gains** are shown only when every winner gained. A favourite can win and still fall short of expectation, so their rating drops; 20 of 167 live wins are like that. Those cards show no reward row rather than a minus or half a row; the analysis shows every movement. A winner's shortfall appears on the card as a neutral figure, not red. |
| Completed-match scorecard: one card per rated match, read back from the engine's record, no new persistence | Shaun's brief, 2 Oct 2026; the architecture CCode's. **DONE `19662b1`.** View model `assets/js/domain/matches/matchScorecard.js` (pure; builds the card from the app match + `MatchFacts` + a dated tier resolver); sheet `assets/js/ui/components/matchScorecard.js` with one delegated `[data-scorecard]` listener. **Sources of truth, unchanged:** Expected = the side's `preMatchExpectedScore`; Actual = `actualScore`, the engine's performance score (0.80 × game share + 0.20 × result: win 1, draw ½, loss 0); difference = `actualScore − preMatchExpectedScore` (the stored `performanceResidual`, which K multiplies); movement = each player's `ratingDelta`; tier = the event's `tierAtEvent`, falling back to `historicalTierOf` (the dated tier history) only when there is no event. Game share is shown as labelled context, never as "Actual". The card prints pp as printed Actual − printed Expected (1 dp), so it always adds up on screen. It is within 0.1pp of the stored residual (live max 0.097). **Unrated match:** the card says so; no figure is estimated. **Teams:** team 1 is the stored first side (the winners; a draw keeps its stored orientation). Within a pair the stronger tier comes first, as on every match card. **No new persistence:** every field was already stored per match and per player. |
| Desktop: one responsive app; the bottom navigation becomes a left rail; CSS places existing elements | Shaun's brief, 1 Oct 2026; the shell and layout choices CCode's. **DONE `269327c`.** Layout ranges mobile < 768 / tablet 768–1199 / desktop 1200+ / wide 1600+, in `assets/css/layout/desktop.css` and `assets/js/ui/desktopShell.js`. **No second app, no desktop routes, no duplicated renderers.** The rail is `.shell-bottom-nav` restyled, so routes, highlight and gating are the phone's. Admin stays inside More, not a primary rail item. From 768px the body is a CSS grid with a centred, capped content area and a midline: existing elements (podium / Kings, directory / profile, editor / preview) are placed side by side by CSS alone. The only markup added is `display: contents` wrappers on Home and around the pack editor and preview (no box on a phone), plus the rail's brand and viewer, which are built only once a desktop-sized window is seen. **The phone is proven unchanged:** the behaviour snapshot at 390 and 360 is identical, element for element, apart from those wrappers. The fifth item stays **More** on this branch; **Me** is the redesign's (Section 5). |
| Player Monthly Packs: built on the Board Pack and Share Deck; private token links; published packs are snapshots | Shaun's brief, 1 Oct 2026; implementation and the access model CCode's, as the brief asked ("propose the safest simple access model"). **DONE `d6e4ae1`.** One catalogue engine serves both packs (`BoardPack.forCatalogue`; `BoardPack.PLAYER`). The player's month is a pure model (`domain/playerPack/playerMonth.js`) fed from the canonical selectors, and its slides are the Share Deck's shape (`playerDeck.js`), so the same deck, pictures and publishing serve both. **Composition:** a team is labelled by its players' tiers on the match date, strongest first (S > A > B > C, `?` if unknown), and a matchup is "my team vs theirs" from the player's side, so one match is "BB vs AB" for one player and "AB vs BB" for an opponent. **Targets** are four fixed rules over the month's own record (rematch, partner, thin evidence, own tier), each with its reason and sample, never a forecast. **Access:** each published pack is stored under a 128-bit random token in its own `playerPacks` collection, and the link is `review/?p=<token>`; changing a name, month or id in the address reaches nothing. The storage setting that completes it is Shaun's (Section 5). |
| A published Monthly Review is a snapshot of its slides | CCode, 30 Sep 2026, implementing Shaun's principle in the Share Deck brief ("a published monthly review should remain historically stable"). **DONE `4af924d`.** Publish stores the Share Deck exactly as shown: formatted, render-ready slides, with revision, first and last published, by whom, and the record fingerprint. It is stored in `moneypadel_review_YYYY-MM`. **Why a snapshot:** nothing month-end in the record is immutable today. Month-end ratings, ranks and tiers are recomputed from the journey on every load, so later results, corrections, club decisions or a calculation change would all move a live review. **Not a second source of truth:** it is a record of what was sent. Nothing reads it for a calculation, and it is labelled a publication. The Board Pack itself stays live (see the 30 Sep row above). |
| Monthly Review link: `review/?m=YYYY-MM`; image export next, at 1080 × 1350 | CCode, 30 Sep 2026. **The link is a query, not a path**, so it works unchanged on every host (Vercel, Pages, local). `/review/2026-09` would need a Vercel rewrite and absolute asset paths, which break Pages. **Image export is staged as the next sub-increment.** Its format is **1080 × 1350 (4:5)**, the portrait WhatsApp shows whole in a chat; 9:16 is a stories format. The cards are already 4:5 and sized in container units, so an export will match the card. No image library was added: client-side capture without one is fragile (fonts, Safari canvas taint). **"View full stats" links to the app's home.** Deep links into a particular screen need a router entry point, which belongs with the redesign's shell and history work. |
| League Table disclosure correction — per-tier, not global | **DONE `11ed091`.** Shaun, 21 Sep 2026. **Supersedes only the disclosure layout from the 20 Sep League refinement.** `How this table works` must be a subtle inline text/chevron disclosure with no large bordered block. Remove the global `Tier tables` accordion. Tier S, A, B and C each get their own independent subtle chevron and collapse state, default **expanded** when entering By tier. Collapsing one tier must not affect any other. Keep the existing `By tier / All together / Last 10` selector and all underlying split-month/Last-10 behaviour. |
| Predict a Matchup remains Admin-only and returns to plain-language result copy | **Copy DONE `55d2fa7`; visual render still awaited.** Shaun, 21 Sep 2026. Predict a Matchup stays in **Admin / More** and is deliberately not exposed to normal players, because players could use predictions to avoid agreed games or cherry-pick favourable ones. Real workflow: players agree a match in the group, then send Shaun the four-player matchup for prediction. The result UI should return to the older, simpler language: clearly name the **predicted winning team**, show the **expected share of games (%)**, and show the **rating-point advantage**. Remove user-facing `Expected performance score` / 80:20 engine terminology from the result card; the underlying Sequential-v1 calculation is unchanged. Do not prescribe a new visual layout yet. Keep the copy simplification and information hierarchy only; visual redesign is deferred until Shaun provides/approves a visual render. Keep only a small muted note that it is based on current Power Ratings and records nothing. |
| A one-player tier section arrives collapsed | Shaun, 22 Sep 2026: *"Tier S should be collapsed by default as there's only one player there."* **Supersedes "tier sections default expanded on entry to By tier" (21 Sep) for one-player sections only**; populated sections are unchanged. Implemented as the reason rather than as the letter S, so a section that gains a second player opens on its own and any tier that thins to one folds without the rule being revisited. The heading always renders, so collapsed is one tap from open, and an explicit tap always beats the default. Applies to both the League and Merit tier sections. **DONE `1781ed5`.** |
| Merit shows Favoured beside Hard, both tappable | Shaun, 22 Sep 2026, after using the table. **Hard** = wins against a stronger partnership, **Favoured** = wins against a weaker one; an equal-strength win counts toward **neither**. A non-zero count opens the matches behind it for that player within the selected Merit period — teams, result and score, the historical tiers used for that fixture, the tier-step difference and the Merit points earned. **The drill-down must derive from the same canonical Merit calculation and historical-tier resolver as the table, never recalculating the classification.** Mobile-first: compact column labels rather than horizontal scrolling. **DONE `b864786`.** |
| Merit scoring refined to a 3-point baseline, draws worth nothing | Shaun, 22 Sep 2026, **after reviewing the working 4 / 1 / 0 implementation**. **Supersedes only the point values in the Merit row below; everything else in that decision stands.** An even matchup is now worth **3** — the same as a standard League win — so the two tables share a baseline and Merit differs from the League *only* because of fixture difficulty: easier wins score below League points, equal wins the same, harder wins above. A player who only ever played balanced fixtures would finish both tables level. `Merit win = 3 ± tier-step difference`, with a **floor of 0** so a win can never be negative. **Draws drop from 1 to 0**: the six in the record ended early through injury or time, not as competitive draws, and should not earn anything. Loss stays 0. |
| Merit Table — an alternative league view scoring the difficulty of the win | Shaun, 22 Sep 2026. **Additional**, never replacing or altering the League Table. Scores how hard the partnership matchup was, from **tier at the time of the match only** — no Power Rating, expected performance, rating change or expectation engine. Tier levels `S > A > B > C`; a partnership's strength is the **sum of its two players' tier levels**, so `AC` and `BB` are equal and the highest-tier player alone never decides it. An even matchup is worth **4** for a win; each tier-step of difference takes one point off the favourite's win and adds one to the underdog's. Draw **1** each, loss **0**, integers only, **no cap** — if the history holds a more extreme matchup, apply the formula and report it. Merit Points are **not a rating**: they touch nothing in Power Rating, ratingJourney, reliability, reassessment, expected game share, tier or outcome, and are derived from canonical matches plus historical tiers rather than persisted as a second source of truth. |
| Monthly Power Rankings must be chronologically coherent around a mid-month reassessment | Shaun, 21 Sep 2026. A monthly row must never combine a player's **post-change tier** with a **pre-change rating snapshot** merely because both fell inside the selected month. Before the effective date: old tier with the appropriate pre-change state. From the effective date onward: new tier with the post-reassessment state. General for every mid-month change — September's Rishi, Ant Slicer and Jams, and every future reassessment — never special-cased per player. The approved split-month League treatment is unchanged. **Do not alter Sequential-v1, reassessment mathematics or stored rating history to make a screen look right.** |
| Monthly Summary is independently collapsible | Shaun, 21 Sep 2026. The whole `September 2026 — Monthly Summary` block gets its own subtle heading-and-chevron disclosure, **defaulting expanded**, collapsing Key Takeaways, Monthly Performance, Rating Movement, Ranking Movement, Moved Without Playing and Crossovers together. Independent of the Tier S/A/B/C League disclosures. Same lightweight treatment as the League refinement — **explicitly not another large bordered dropdown or card**, which Shaun rejected during that work. |
| Player names can be edited by Admin with confirmation | **DONE `25e4624`.** Shaun, 21 Sep 2026, resolving the stop condition himself: *"I just need editable names with no consequences."* The identity is frozen (`playerId` never changes) and a `displayName` field carries the label, so a rename writes one field on one document and the record is untouched. Add an **Admin-only** rename action in player management. Renaming must change the player's display name while preserving the same underlying player identity and all historical match/rating/tier/statistics relationships. Before writing, show a confirmation such as **“Rename Shaun to Shaun J?”**. Block blank names and duplicate/conflicting names. If any historical data is keyed directly by display name rather than stable player id, CCode must stop and report the migration/blast radius before implementing. Preserve the old name in an audit/history field where practical. |
| Players Directory visual refresh | Shaun, 20 Sep 2026. Bring Directory in line with the newer premium/private-club Money Padel UI. Preserve Directory/Compare, tier/status filters, A–Z/Power Rating sort, player navigation and active/inactive meaning. Reduce the feeling of a large settings/filter form followed by a plain database list. **DONE `43401f8`.** |
| Tom/Fatch must not reference Jords comparator | Shaun reconfirmed 20 Sep 2026 after seeing stale information. Both historical B anchors are 1400 baseline with 20% reliability. CCode must audit both displayed explanation and stored/replayed state rather than assuming this is cosmetic. **Audited `838ca66`: the record was already correct; the stale source was a document.** |
| The Ledger is restored in full, not kept compact | Shaun, 20 Sep 2026, after the 3320 → 122 line rewrite. The institutional record — Decisions Log, Handoffs, Open Questions, Recently Completed — is the point of the Ledger and is to be preserved, not summarised away. `LEDGER_ARCHIVE_2026-09-20.md` stays unchanged as the recovery snapshot. |
| Player status is a fact about the person, not a period | Shaun, 4 Oct: three statuses — `active`, `temporarilyInactive`, `archived` — set only by an admin, stored as `status` on the player's v3 record (id-keyed, so a rename cannot lose it; replay-forward carries it). No monthly minimum, qualification rule or the 30-day Idle rule may change it or hide a player. A missing status means Active; no migration. |
| The legacy Inactive flag reads as Archived | Shaun, 4 Oct: Admin's old Active/Inactive tag meant "has left", so a player with no stored status and that flag reads as **Archived** (today: Del). Setting a status in Admin then stores it on the record and supersedes the flag. |
| Temporarily inactive = "as today" (option A) | Shaun, 4 Oct: left out of game suggestions, matchmaking and the current ranking pool (shown only with "Include temporarily inactive"), but still in "Who are you?", the directory (tagged), every typed name field and their profile. A game with them is allowed. |
| Archived is hidden live, kept in history, never deleted | Shaun, 4 Oct: one shared helper (`livePlayers()` / `livePlayerNames()` vs `PLAYERS`) decides; screens do not filter on their own. A new game, request or agreed fixture naming an archived player is refused in words ("X is archived. Restore them in Admin › Player tags…"). Admin never says "Delete"; Restore returns the same record. |
| Player of the Month: the app recommends, the group chooses | Shaun, 4 Oct. No POTM score or formula: the recommendation names the leader (ties kept) of six evidence-backed stories among qualified players, plus the next-best on each when fewer than three players are named. Match count earns only "Most Active". Candidates are listed by name, not ranked. Admin curates and finalises the shortlist; the group votes (WhatsApp for now); Admin confirms the winner. |
| Player of the Month eligibility = 5 matches in the month | Shaun, 4 Oct: the same 5 as the Monthly Performance podium and the Monthly Race. Upsets count only in a month at or above expectation overall (CCode, so two lucky evenings in a poor month are not a case). |
| The points leader is no longer "Player of the Month" | Shaun, 4 Oct: League › Information, the WhatsApp summary, the Board Pack, the Share Deck and Home show the confirmed award ("Not chosen yet" / the shortlist until then). Already-published packs are snapshots and keep what they said. |
| Archived players are not recommended for Player of the Month | Shaun, 4 Oct: a qualified but archived player is named to Admin ("…played enough to qualify but is archived") and can be restored first. Confirmed awards for since-archived players are untouched. |
| The finalised shortlist is public | Shaun, 4 Oct: players see the shortlist (each candidate's reasons, in no order) in League › Information while the vote runs. |
| A confirmed award is a snapshot | Winner, name, tier, story, citation, figures, the shortlist and the rules version are stored as they stood. Ratings, tiers, status changes and new recommendation rules never alter it. Only the owner can withdraw a confirmation, to correct a mistake, and the withdrawal is logged. |
| POTM reasons are about the player, not the dataset | Shaun, 4 Oct (second brief). Each reason is a label plus one sentence with its own figure ("Gained +13.3 Power Rating through play."). No "No qualified player…" or ranking language on a card. A card shows the strongest three reasons in a fixed order (competition results, Overperformer, Biggest Improver, Strongest Results, Upset Specialist, Most Consistent, Most Active). Admin alone sees the rest, by name. Every card's figures row is the same four: matches · wins · win rate · pp vs expectation. |
| Monthly competition tier winners are POTM nominees, never the award | Shaun, 4 Oct. A winner is the top of a tier in that month's League (points, then goal difference), Merit or Monthly Race (qualified players only), read from the same tables League › By tier shows. Ties on everything but the alphabetical last resort are joint winners. Two wins become "Month Champion", three "Triple Crown". The group still votes. |
| No "from a 37% chance" clause on Upset Specialist | CCode, 4 Oct. The underdog line uses the engine's expected *score*, not a probability of winning, so "chance" would misstate it (see OPEN 2 Oct on Expected/Actual scales). The reason says "3 wins as the underdog." |
| Predict a Matchup moves to the top of More, Admin only | Shaun, 4 Oct. It supersedes "keep it in Admin / Manage" (21 Sep). It is hidden from non-Admins in More, and `openPredictMatchup()` refuses them by any route. It is no longer in Admin / Manage. The 21 Sep reasoning stands: players must not be able to shop for predictions. |
| The Matchup Card shows the expected share of games | Shaun, 4 Oct: the % of games rather than a number of games (superseding CCode's first version, which converted it to games in a typical 25-game match). The big figure is `MatchPrediction`'s share of games (the engine's expected score, as the tool has shown it since 21 Sep), whole percentages adding to 100. Never a win chance. The call is the prediction's own `confidence`: level "Too close to call", shade "Slight edge", clear "Projected favourites". |
| North vs South off the More menu | Shaun, 4 Oct. It is now an Admin / Manage section ("Open North vs South"), behind the Admin lock. Nothing was deleted. |

---

## 4. CURRENT TASK / PRODUCT & UI DIRECTION

**Current baton: CGPT / Shaun.** The approved queue is delivered again — the
Tom/Fatch audit (`838ca66`), the Players Directory refresh (`43401f8`), the
League refinement (`3e326e1`) and Shaun's disclosure correction to it
(`11ed091`). **Nothing is queued for CCode.** The open product questions are in
Section 8.

**28 Sep: the Claude Design mapping is delivered (`08712d4`) — baton with
Shaun / CGPT.** The design in `docs/design/claude-mobile-v1/` is mapped onto
the app in
[`docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md`](./docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md).
- **The proposed phases:**
  - 0: tokens and primitives, no visible change;
  - 1: the shell, where More becomes Me;
  - 2: Play;
  - 3: Home;
  - 4: Rankings;
  - 5: Players, Profile and Me;
  - 6: the rest.
- **No phase is approved.** The decisions each phase waits on are in
  Section 5 (*OPEN 28 Sep — Claude Design migration*).

---

### Merit — Favoured beside Hard, with a drill-down — DELIVERED (`b864786`, 22 Sep 2026)

**The counts and their matches are the same object.** `MeritTable.build()` now
carries the qualifying matches on each row (`row.hard`, `row.favoured`) beside
the counts, so the drill-down displays the classification rather than
reproducing it. A screen that decided hard-versus-favoured for itself would be
a second opinion, and the two would eventually disagree about a fixture nobody
had thought about. A test asserts the rendered list is the canonical
calculation's own, match for match, and another asserts each count equals the
length of its own list.

**The three buckets are exhaustive and exclusive:** hard + even + favoured
accounts for every win exactly once, asserted. An equal-strength win appears in
neither column — it is the baseline the other two are measured from.

**Each listed match carries what is needed to check it:** the two teams with
the tier each player held **for that fixture**, the score, the tier-step
difference, and the Merit points earned. Historical tiers come from the same
resolver as the table, so Rishi reads **B** on a 17 September win and would
read **A** after the 20th — verified by a test that scores the same fixture on
both sides of his effective date.

**Mobile-first, measured rather than assumed.** Nine columns at 375px with
compact labels (`Pts`, `Hard`, `Fav`), a fixed table layout and the player name
as the only column allowed to yield: **341px inside a 375px viewport, no page
overflow and no sideways scroll inside the card.** A zero renders as a dash and
is *not* a control; only a real count is tappable. One drill-down open at a
time, and tapping the same count closes it.

**Coverage:** 5 module tests and 4 browser tests, all verified to fail against
the previous code. **496 / 496 (116 browser).** Screenshot
`22b-merit-drilldown.png`.

---

### Merit scoring refinement — DELIVERED (`510c4cc`, 22 Sep 2026)

**Implemented as a change of constants and one guard, not a rewrite.**
`BASELINE` 4 → 3, `DRAW_POINTS` 1 → 0, and a new `MIN_WIN_POINTS` of 0 applied
to the favourite side only — there is deliberately **no ceiling**, since an
extreme matchup should be reported rather than clamped. Everything the brief
listed as untouched is untouched: the UI, historical tier resolution,
partnership-strength calculation, split-month treatment, month selection, tier
sections, League scoring, Power Ratings, `ratingJourney`, expectations and
reassessment. Partnership strength still uses each player's effective tier on
the match date. The `How points work` copy was updated to match.

**Historical re-audit after the change.**

| | Before (4 / 1 / 0) | After (3 / 0 / 0) |
|---|---|---|
| Matches scored | 159 (153 decided, 6 draws) | unchanged |
| Unresolved tiers | 0 | 0 |
| Tier-step gaps | 93 even · 60 one-step · 6 two-step | **unchanged** — a property of the data, not the formula |
| Win values occurring | 2 – 5 | **1 – 4** |
| Outside the brief's range | none | **none** |
| Negative wins | — | **none; the floor never engages**, since it needs a three-step favourite win and the widest gap on record is two |

**The product property was checked against the record rather than assumed.**
Six players — **Harry (16 W), Shaun, Tee, Del, Mulley, Tarique** — now have
Merit **exactly equal** to their standard League points, each having no draws
and only evenly-matched wins. Harry is the clearest case at **48 League / 48
Merit**. The contrast is **Len at 65 League against 45 Merit**: 21 wins, none of
them against a stronger pairing — which is precisely the signal the table
exists to surface.

Top of the all-time table after the change: Rishi 129, Max 56, PDM 51, Erf 50,
Harry 48.

**Tests.** The value cases move to **3 / 2 / 4 / 1 / 5 / 0 / 6** across zero to
three tier-steps, draw 0 and loss 0, and gain two more: that a win is floored
at 0 and never negative while the underdog side stays uncapped, and that the
baseline *is* a standard League win. The regression cover the brief asked to
retain — partnership ordering, historical tier changes, split-month
reassessments, identical points for both winning partners, standard League
unaffected — is kept with shifted expectations. **15 of the 23 module tests
fail against the old formula**, as does the copy assertion. **487 / 487 (112
browser).**

---

### The refinement as approved, kept

#### Merit scoring refinement — the approved brief

**The 4 / 1 / 0 model was implemented, reviewed and works.** Having seen the
two tables side by side, Shaun chose to align Merit with the standard League's
3-point baseline. This refines the scoring rule of the feature already built —
**it is not a second, competing definition**, and the UI is not to be
redesigned.

| | Was | Now |
|---|---|---|
| Even matchup, win | 4 | **3** |
| Draw | 1 | **0** |
| Loss | 0 | 0 |

`Merit win points = 3 ± partnership tier-step difference`, with a **floor of 0**
— a win must never produce negative Merit Points.

| Tier-step difference | Favourite wins | Underdog wins |
|---|---|---|
| 0 (even) | **3** | **3** |
| 1 | 2 | 4 |
| 2 | 1 | 5 |
| 3 | **0** | 6 |

**Why.** A standard League win is 3, so an even Merit win is now 3 too. The two
tables share a mathematical baseline and Merit departs from League points
*only* because of fixture difficulty: easier wins score lower, equal wins the
same, harder wins higher. Ten balanced wins give 30 in both tables. That makes
the relationship between them explicable to a player in one sentence.

**Draws now earn nothing.** The six in the record ended early through injury or
time constraints rather than as competitive draws, so they should not
contribute. Merit therefore measures *the value of matches actually won,
adjusted for matchup difficulty.*

Both members of the winning partnership continue to receive the same points.

**Explicitly unchanged:** the Merit visual design, historical tier resolution,
partnership-strength calculation, split-month tier treatment, month selection,
tier sections, standard League scoring, Power Ratings, `ratingJourney`,
expectation calculations and reassessment logic. Partnership strength continues
to use each player's effective tier on the match date.

**Copy** becomes: *"An even matchup is worth 3 points for a win. Beat a stronger
pairing and you earn an extra point for each tier-step difference. Beat a weaker
pairing and you earn one point less per tier-step. Merit Points cannot fall
below 0 for a win. Draws and losses earn 0."*

**Tests** to cover 3 / 2 / 4 / 1 / 5 / 0 / 6 across zero to three tier-steps,
draw 0 and loss 0, retaining the existing regression cover for partnership
ordering, historical tier changes, split-month reassessments, identical points
for both winning partners, and standard League scoring being unaffected.
**Re-run the calculation across the historical dataset and report anything
unexpected.**

**Baton → CCode. Approved refinement.**

---

### Merit Table — DELIVERED (`767e0d3`, 22 Sep 2026)

**Implementation approach.** `assets/js/meritTable.js`, a pure module.
Merit is **derived on demand** from canonical matches plus historical tiers and
**never persisted** — there is no second source of truth to fall out of step.
It is not a rating and is built so it cannot quietly become one: nothing in the
module reads a Power Rating, an expectation, reliability, `ratingJourney` or
even the engine's `TIER_SEED`, and a test greps the module source to keep it
that way. Tier levels are `S4 A3 B2 C1` — only the *spacing* matters, since
Merit counts tier-steps rather than rating distance, which is exactly why the
engine's seeds were not reused.

**Historical-tier resolver used.** `historicalTierOf(name, date)` →
`V3_TIER_AS_OF` → `TierHistory.tierAsOf` — the same canonical resolver the
League Table, the tier badge and the split-month treatment use. No second
interpretation of tier history was created. The same resolver also decides
which tier *section* a row belongs to, so a mid-month mover appears in both
sections holding only what they earned in each, and the segments sum to the
`All together` row (asserted by a browser test).

**Where Merit sits in the Rankings UI** — reported rather than invented, as the
brief asked. It is a third option in the existing **View** select, beside
`League Table` and `Information`. That control already answers *"which table am
I looking at"*, it costs no horizontal space, and a fourth segmented button
would have crowded the 375px control the League refinement had just finished
decluttering. Beneath it Merit reuses the League screen's own machinery: month
selection, `By tier` / `All together`, independently collapsible tier sections,
split-month allocation by match date, the same table presentation and mobile
behaviour, and the same quiet inline `How points work` disclosure. The League
segmented control is untouched at three buttons; Merit's is two.

**Historical audit findings** (full rated history, live record):

| | |
|---|---|
| Matches scored | **159** — 153 decided, 6 draws |
| Unresolved tiers | **0** — every player's tier is known at every match date |
| Tier-step gaps | **93 even · 60 one-step · 6 two-step** |
| Maximum gap | **2 tier-steps** |
| Win values occurring | **2 to 5** |
| Outside the brief's 1–7 range | **none — so no cap is needed** |
| Singles | **0** in the v3 record (all 159 are doubles) |
| Underdog wins | 16, the best worth 5 |

The six widest matchups, all 2 tier-steps: `Erf & Eli (AA)` beat
`KC & Shaun (AC)`; `Osh & Eli (AA)` beat `PDM & Max (BB)`; `Len & Eli (AA)`
beat `Rishi & PDM (BB)`; `Eli & Ant Slice (AA)` beat `Rishi & Max (BB)`;
`Rocky & Tom (BB)` beat `Aubyn & Tee (CC)` — each worth **2** to the favourite;
and `Max & Jams (BC)` v `Jords & Ant Slice (BA)`, a **draw**, worth 1 each
whatever the gap. *Note for a future decision, not a blocker:* the module sums
whatever players are on a side, so singles would score consistently if the club
ever records one, but none exists today and the rule was written for
partnerships.

**Tests: 21 module + 5 browser.** Every value the brief specified —
`AA v AA` 4, `AB v AB` 4, **`AC v BB` 4**, AB beats BB 3, BB beats AB 5, AA
beats BB 2, BB beats AA 6, three-step 1 and 7, draw 1 each, loss 0, integers
only — plus the invariants: teammates always score alike, reversing sides or
player order changes nothing, strength is the sum and never the best player, an
unknown tier is reported rather than guessed, a reassessment changes Merit only
from its effective date, a mid-month mover's segments sum to the whole, and
**standard League points are completely unchanged**. All five browser tests and
all but one module test fail against the pre-change code. Rishi's row was also
recomputed by hand from the live record (77 P, 41 W, 3 D, 33 L, **173 merit**,
10 hard wins) and agrees with the module and the rendered table exactly.

**Unchanged and asserted:** League scoring, All together, Last 10, Power
Rankings, Monthly Performance, Power Rating. Screenshot `22-merit-table.png`.

---

### The brief as approved, kept

#### Merit Table — the approved brief

A new, additional league view. **It must not replace or alter the existing
League Table.** It is another way of reading the same recorded matches, for the
fact that some players regularly take harder fixtures than others.

**The question it answers:** how difficult was the partnership matchup you won?
A win in an even fixture is the baseline; beating a stronger pairing earns more,
beating a weaker one earns less.

#### Scoring

Tier hierarchy `S > A > B > C`. A partnership's strength is the **sum of its two
players' tier levels**. The difference between the two partnership totals is
that match's **tier-step difference**.

| Tier-step difference | Favourite wins | Underdog wins |
|---|---|---|
| 0 (even) | **4** | **4** |
| 1 | 3 | 5 |
| 2 | 2 | 6 |
| 3 | 1 | 7 |

Draw: **1 point per player**, whatever the matchup. Loss: **0**. Integers only.
**No artificial cap at this stage** — if the history contains a more extreme
valid matchup, apply the formula consistently and report what was found.

Both teammates always receive the same Merit Points: this scores the difficulty
of the *partnership matchup*, not an individual's circumstances.

**Worked examples, including the one that matters most:** `AA vs AA` → 4.
`AB vs AB` → 4. **`AC vs BB` → 4** — also equal strength, which is why the
highest-tier player on each side must never be compared alone. `AB vs BB`: AB
wins → 3, BB wins → 5. `AA vs BB`: AA wins → 2, BB wins → 6.

#### Historical tiers are critical

Merit must use each player's **effective tier on the match date**, not their
current tier, reusing the **canonical historical-tier resolver** rather than a
second interpretation of tier history. Matches before a reassessment's effective
date use the old tier; matches on or after it use the new one — Rishi's
September B → A, Ant Slicer, Jams, and every future change.

#### Presentation

**Merit Table** · *Harder wins earn more.* Under a subtle `How points work ⌄`
disclosure: *"An even matchup is worth 4 points for a win. Beat a stronger
pairing and you earn an extra point for each tier-step difference. Beat a weaker
pairing and you earn one point less per tier-step. Draws are worth 1 point.
Losses are worth 0."* Concise and player-friendly; no numeric tier weights in
player-facing copy.

#### UI

An alternative league view in the established Rankings/League design language,
supporting month selection, Tier S/A/B/C views, independently collapsible tier
sections, historical/split-month allocation, and the existing table and mobile
behaviour. **Inspect the current post-refinement Rankings UI first and reuse its
controls; do not overcrowd the mobile selector. If clean placement needs a UX
choice, report the proposal rather than redesigning navigation independently.**

**Unchanged:** standard League scoring, All together, Last 10, Power Rankings,
Monthly Performance, Power Rating.

#### Required tests

`AA vs AA` → 4 · `AB vs AB` → 4 · `AC vs BB` → 4 · AB beats BB → 3 · BB beats
AB → 5 · AA beats BB → 2 · BB beats AA → 6 · draw → 1 each · loss → 0. Also:
reversed partnership/player ordering gives identical points; historical tier
changes use the tier effective on the match date; a split-month reassessment
changes Merit only from its effective date; both winning teammates always score
the same; and standard League points are completely unchanged.

**Run the calculation over the complete rated match history and report any
unusual or extreme partnership gaps before finalising.**

**Baton → CCode. Feature approved.**

---

### Monthly Rankings coherence + Monthly Summary — DELIVERED (`2fdc169`, 21 Sep 2026)

**Outcome: the persisted record was correct. Both faults were in the display,
and both were general rather than specific to Rishi. Nothing was repaired,
nothing in Sequential-v1, reassessment mathematics or stored history changed.**

**Root cause 1 — same-date event ordering.** `MonthlyViews.chronological()`
ordered same-date events only by "initialisation first" and its comment claimed
everything else *"keeps the order the engine produced"*. `Array#sort` is stable
— but on its **input**, and the input is whatever order Firestore returned the
documents in. For Rishi's three events on 2026-09-20 that order put the
PROMOTION last, so the month closed on the rating the promotion left untouched:
**1464.2**. Now ordered by the engine's own rule — `Engine.replay()` drains
state events with `effectiveDate <= m.date` **before** processing that day's
matches, so a club decision precedes play and the promotion precedes the rating
decision the board is required to make beside it. That list already existed in
`journeyView.js`, which is why a player's Rating Journey has always read
correctly while this view did not; a test asserts the two lists cannot drift.

**Root cause 2 — the tier badge described a different moment from the rating.**
The monthly row rendered `p.tier`, **today's** tier, beside the selected
month's closing rating. Harmless while nobody had moved; wrong the moment
somebody had. It now uses `tierInScope()`, the month-aware answer the tier
filter already used, so badge and number describe the same instant. This also
fixes the same defect in the past direction: viewing July for a player promoted
in September showed an A badge against a B-era rating.

**Verified against the live record:** September's close now equals the stored
rating for **every** player, and the three movers each render one coherent
moment — Rishi **A / 1642** (overall 1642), Ant Slicer **B / 1460**, Jams
**B / 1320**.

**Monthly Summary disclosure.** Independently collapsible, defaulting expanded,
folding Key takeaways, Monthly Performance, Rating Movement, Ranking Movement,
Moved without playing and Crossovers together; independent of the League
disclosures. Built as a plain chevron on the existing heading — then a
screenshot showed it **still rendered as a bordered card**, because
`.monthly-stories` is itself a card and collapsing it left exactly the dropdown
Shaun rejected during the League work. The card chrome now comes off when
collapsed and is unchanged when open. The first test asserted the *button* had
no border, which was true and useless; it now weighs the container.

**Coverage:** 9 module tests (`tests/monthlyCoherence.test.js`) and 3 browser
tests, each verified to fail against the old code apart from the one asserting
an unmoved player is unaffected, which must pass either way. The browser test
injects a player promoted and re-anchored mid-month, supplied in the unhelpful
order, and fails if the rendered row puts the new tier beside the old rating.
**457 / 457 (105 browser).** Screenshot `21-monthly-summary-collapsed.png`.

**Split-month League treatment: untouched and still passing** — games before
the effective date accrue to the old tier, games on/after to the new, points
never transfer, `All together` remains the whole month.

---

### The brief as approved, kept

#### Monthly Rankings coherence + Monthly Summary disclosure — the approved brief

Two requests from Shaun, arriving together.

#### 1. Monthly Power Rankings around a mid-month reassessment

Shaun found a likely historical-display bug in the September monthly Power
Rankings. **Rishi** moved Tier B → Tier A during September in the board's
emergency mid-month reassessments. The UI correctly places him in **Tier A**
but shows **`1464`** with **`overall: 1642`** — `1464` looking like his
old pre-reassessment B rating shown beside his new A-tier classification.

Required:

- Investigate the **source**, not Rishi. The fix must be general.
- Before the reassessment effective date → old tier plus the appropriate
  pre-change rating/state.
- From the effective date onward → new tier plus the post-reassessment state.
- A monthly row must **never** combine a post-change tier with a pre-change
  rating snapshot merely because both happened inside the selected month.
- Works for all of September's movers (Rishi, Ant Slicer, Jams) and for any
  future reassessment.
- The approved split-month **League** treatment is preserved exactly: games
  before the effective date accrue to the old tier, games on/after it to the
  new tier, points never transfer, `All together` stays the whole month.
- **First establish whether this is a monthly-view snapshot-selection bug or
  whether the persisted historical state is itself wrong.** Do not alter
  Sequential-v1, reassessment mathematics or stored rating history merely to
  make the screen look correct.
- Regression coverage using a player whose tier and rating both change during
  a month, written so it fails if the UI recombines the new tier with the old
  rating.

#### 2. Monthly Summary collapsible

Make the complete `September 2026 — Monthly Summary` section independently
collapsible, using the subtle heading-plus-chevron disclosure now established
in Rankings. **Not another large bordered dropdown or card** — Shaun rejected
that treatment during the League Table refinement.

- Defaults **expanded**.
- Small subtle chevron on the Monthly Summary heading; the whole heading row
  may be tappable.
- Collapsing hides the complete summary together: Key Takeaways, Monthly
  Performance, Rating Movement, Ranking Movement, Moved Without Playing,
  Crossovers.
- Expanding restores the existing content unchanged.
- Independent of the Tier S/A/B/C League Table disclosures.
- Preserve existing typography, spacing and the dark/gold system.
- Browser coverage for the default-expanded state and expand/collapse.

**Baton → CCode. Approved and unblocked.**

---

### Player rename — DELIVERED (`25e4624`, 21 Sep 2026)

**Shaun's answer to the A-or-B question was neither: *"I just need editable
names with no consequences. It's actually only two that need amending."***

So neither option was taken. The record is not migrated (B) and no bulk
rewrite of render sites was needed (A as originally scoped). Instead the
identity is **frozen** and the label is set free: `playerId` keeps whatever
value it has today, for ever, and a new `displayName` field carries what the
player is called. **A rename writes one field on one document.** Nothing is
deleted, no document id changes, and the blast radius below is now zero —
renaming Rishi touches 1 document, not 156.

`assets/js/playerNames.js` owns the translation, at two edges only:

```
RECORD  ──toDisplay──▶  the app and the screen    (ids   → labels)
RECORD  ◀──toId───────  submissions and decisions (labels → ids)
```

`V3_STATE` carries the state twice — `players` keyed by label for everything
that renders, `playersById` keyed by identity for anything preparing a
document — so a call site picks the map that matches what it is about to do
rather than having to remember to convert. `V3_RECORD` stays raw, because the
replay verifier, the repair planner and the diagnostics must see exactly what
is in Firestore.

**The defect this surfaced is the important part of the story.** After a
rename the record **no longer replayed to itself**: `buildWritePlan` rebuilds
a player document from engine state, which has no display name, so
`verifyNoOp` reported `players/Rishi differs`. A record that does not verify
is a record the app refuses to edit — so renaming anybody would have quietly
disabled every match correction. Fixed in `replayForward` with
`PLAYER_LABEL_FIELDS`, beside the provenance fields already preserved for the
same reason, and now stated as a general rule rather than a special case: **a
replay reconstructs engine state and must not destroy fields it does not
own.** Any field added to a player document later is covered.

Validation runs **before** the confirmation, so the confirmation only ever
asks about a rename that would work: blank, whitespace, slashes, another
player's label, another player's underlying id, and their own current name
are each refused with a reason. `previousDisplayNames` keeps the old name and
the row shows it.

**Coverage:** 10 module tests, 5 browser tests. The browser tests drive the
real control and then assert the thing that matters — one write, to the
original document id, nothing deleted; stored matches and journey
byte-identical either side; every number about the player unchanged; ranking
position unchanged; and the record still replaying to itself.

**Still true, and worth keeping:** the audit below remains accurate about the
record as stored. Nothing about it was migrated — it was made not to matter.
Open Question 4 (the production snapshot joining on name) is also handled:
`decoratePlayer` joins on the frozen id, so a rename cannot break it.

---

### Player rename — the audit that led here (21 Sep 2026)

**The stop condition in this brief is met. No rename has been built and no data
has been touched.** The brief says: *"If any canonical or historical record is
currently keyed by player name rather than a stable id, do not silently rewrite
it. CCode must first report the affected collections/code paths and the
migration blast radius in this Ledger before applying a migration."*

**There is no stable player id. The display name IS the identity, everywhere.**
`ratingEngine.js` sets `playerId: name` at line 152. Every layer above it
inherits that.

#### Where the name is the key

| Surface | How | Consequence of a rename |
|---|---|---|
| `players/{playerId}` | the **document id** is the name | delete + create, not an update |
| `ratingJourney/{eventId}` | id is `${effectiveDate}__${playerId}__${eventType}` or `${matchId}__${playerId}` | **every one of a player's journey docs changes id.** Verified: all 672 live journey docs contain their `playerId` in their id |
| `ratingJourney` `playerId` field | the name again | a second rewrite of the same docs |
| `matches/{id}` | `teamA` / `teamB` are arrays of names | every match the player appears in |
| `BASE_MATCHES` in `assets/js/app.js` | 127 hardcoded matches, winners/losers as names | **source code**, not data — a rename needs a code edit |
| Production snapshot | `player_id` is `null` for every row; name is the only join | already Open Question 4: *"a rename breaks it silently"* |
| Shared blobs | `gameRequestsState` (`players:[4 names]`, and `confirmations` **keyed by name**), `devAreasState.player`, `challengesState` (`challenger`, `challenged`, `firstPartner`, `secondPartner`), player tags, match submissions (`submittedBy`, winners/losers) | each needs its own migration |
| `localStorage` | `moneypadel_current_viewer`, `moneypadel_my_name` | per-device, unreachable from a migration — a renamed viewer silently stops resolving |

#### Blast radius, measured against the live record (861 docs)

| Player | `players` | `ratingJourney` | `matches` | Documents to rewrite |
|---|---|---|---|---|
| Rishi | 1 | 79 | 76 | **156** |
| Max | 1 | 52 | 51 | 104 |
| Jords | 1 | 39 | 38 | 78 |
| *median player* | 1 | — | — | **34** |
| Del / M.R / Mulley | 1 | 2 | 1 | 4 |

**This is not a field update.** Because the name is inside the journey document
id, renaming Rishi means creating 79 new journey documents and deleting 79 old
ones, plus 76 match rewrites and a `players` doc swap. A rename is a
**re-keying migration of up to 18% of the record**, and it is the largest write
this application would ever make outside a backfill.

#### The risk, stated plainly

This is the same failure mode that has already bitten this project once. On
19 Sep a 509-document replay wrote **364 and stopped**, leaving stored ratings
and stored history disagreeing, and it took a measured repair to recover
(Section 5). A rename is worse in one specific way: it **deletes and creates
the same logical data**, so a partial failure can leave a player existing under
both names, or under neither. `ReplayForward.verifyNoOp`'s precondition —
replaying the record unchanged reproduces it — would not hold mid-migration,
which is exactly when the app refuses to do anything else.

#### Two honest ways forward — Shaun's call

**A — Add a display-name layer (recommended).** Give each player an immutable
`playerId` (the current name, frozen once) and a separate mutable `displayName`.
A rename then writes **one field on one document** and touches no history at
all, because history keys on the id and never on what the player is called.
That is the only version of this feature that is safe to run twice. Cost: a
one-off migration that stamps `displayName` onto the 34 `players` docs, and a
pass over the roughly 270 lines across `app.js` and `shell.js` that touch
`.name` (350 occurrences) so display resolves id → displayName. Most are
straightforward prints; the ~40 that use the name as a lookup key are the ones
that matter. The engine, the journey and the matches are untouched.

**B — Re-key migration per rename.** Keep the name as the identity and rewrite
everything each time, through `replayForward`'s batched writer with a dry-run
plan, a blast-radius preview and a `verifyNoOp` check either side — the
machinery already exists and was built for exactly this shape of problem. It
works, but every rename is a 4–156 document migration with a recovery procedure
attached, `BASE_MATCHES` still needs a source edit, and the per-device
`localStorage` viewer cannot be migrated at all.

**Recommendation: A.** B makes renaming permanently dangerous; A makes it
boring, which is what a rename should be. A also retires Open Question 4 (the
fragile snapshot join) and removes the standing hazard that any future rename
silently breaks the production comparison.

**What has NOT been done:** no rename UI, no validation, no migration, no write.
A rename control that cannot safely rename would be worse than none, because it
would imply the capability exists. The confirmation, blank/duplicate rejection
and the audit field in the brief are all straightforward once the identity
question is settled — they are not the hard part and were not the blocker.

**Baton → Shaun.** One decision: **A or B.** Either is implementable
immediately after.

---

### Player rename — the approved brief, kept

Add the ability for an Admin to rename an existing player from the existing
player-management area.

Required behaviour:

- Admin-only. Do not expose player self-service renaming.
- Entry point should live with existing player management / Existing players,
  not in a public-facing profile flow.
- Renaming changes the **display name only** and must preserve the same
  underlying player identity.
- Existing matches, ratingJourney events, tier history, current rating,
  partnerships, head-to-head, league rows, profile history and statistics must
  continue to resolve to the same player after the rename.
- Before committing, show an explicit confirmation containing old and new names,
  e.g. **“Rename Shaun to Shaun J?”**
- Reject blank/whitespace-only names.
- Reject duplicates or any name collision that would make player resolution
  ambiguous.
- Preserve the previous name in an audit/history field where practical.
- If any canonical or historical record is currently keyed by player name
  rather than a stable id, **do not silently rewrite it**. CCode must first
  report the affected collections/code paths and the migration blast radius in
  this Ledger before applying a migration.
- Add regression coverage proving the renamed player keeps the same historical
  record and that confirmation/collision validation works.

**Baton → CCode. Approved and unblocked.**

---

### Predict a Matchup — copy DELIVERED (`55d2fa7`); visual render still awaited

Shaun confirmed that Predict a Matchup has become one of the most-used Admin
features, but it must **remain Admin-only**. Players are agreeing matches first
in the group, then sending the four-player combination to Shaun to run the
prediction. The restriction is deliberate: exposing the tool to all players
could encourage them to avoid unfavourable agreed games or cherry-pick easier
ones.

Product / copy direction:

- Keep Predict a Matchup in **Admin / More**. Do not move it to Home, Play or any
  normal player-facing surface.
- Restore the simpler tone of the older prediction UI. The first question the
  card should answer is: **which team should win?**
- Show the two teams and their current Power Ratings clearly.
- Show **expected share of games (%)** for both sides in plain language.
- Show the **rating-point advantage** between the teams as context for how strong
  the prediction is.
- Remove the current user-facing **`Expected performance score`** wording and
  avoid exposing the 80% game-share / 20% result machinery on this result card.
  That remains engine detail, not Admin decision copy.
- Do **not** label the game-share percentage as a calibrated “chance to win”
  unless a separate win-probability model is ever validated. Wording such as
  **“Len & Tom should win”** plus **“67% expected share of games”** is acceptable.
- **Visual treatment is intentionally deferred.** Do not invent or implement a new
  result-card layout until Shaun provides/approves a visual render. For now,
  change only the wording/content hierarchy: predicted winner → expected game
  share → teams/ratings → rating-point edge.
- Keep only a small muted footer such as **“Based on current Power Ratings ·
  Prediction only · Nothing is recorded.”**
- Underlying prediction/rating mathematics, persisted ratings and Sequential-v1
  are unchanged.

Visual design note:

- Do not treat the previous chat mockup/example as an approved component design.
- Shaun will provide/approve a separate visual render before CCode changes the
  visual styling/layout of this result.

Acceptance / regression coverage:

- feature remains unavailable to non-admin users;
- result names the predicted winning team;
- result shows expected game share for both sides;
- result shows the rating-point advantage;
- `Expected performance score` is not shown on the plain result card;
- no rating-engine or stored-data changes.

**Baton → CCode. Approved and unblocked.**

---

### League Table disclosure correction — DELIVERED (`11ed091`, 21 Sep 2026)

Shaun reviewed the delivered mobile screen and the disclosure treatment was too
heavy. This is a **presentation correction only**. The underlying League
aggregation, split-month tier treatment, Last 10 table and selector remain
accepted.

Required UI:

- **`How this table works`:** remove the large bordered/card container. Render
  it as a quiet inline disclosure directly beneath the
  `September 2026 League Table` heading: text plus a small chevron only.
- The explanation is **collapsed by default** and expands its explanatory copy
  inline beneath that row. Do not introduce another card or large control.
- **Remove the global `Tier tables` accordion completely.**
- Each tier heading — **Tier S, Tier A, Tier B, Tier C** — gets its own subtle
  chevron/disclosure.
- Each tier expands/collapses **independently**. Collapsing Tier A must not
  collapse S/B/C, etc.
- Tier sections default **expanded** whenever the user enters **By tier**.
- The entire tier heading row may be tappable, but visually it should remain a
  lightweight section heading, not a large button/card.
- Keep the current **By tier / All together / Last 10** segmented selector
  exactly as the navigation model.
- Reuse existing League typography, spacing, dark surfaces and restrained gold.
  This correction should **remove visual weight**, not add another UI layer.
- Preserve all current table data, sort behaviour, split-month allocation,
  `All together`, Last 10 aggregation and rating methodology unchanged.

Acceptance / regression coverage:

- table-info disclosure is collapsed on entry and expands inline;
- no bordered `How this table works` block remains;
- no global `Tier tables` fold remains;
- S/A/B/C are expanded by default in By tier;
- collapsing any one tier leaves the other tier states unchanged;
- switching away/back to By tier restores the agreed default-expanded entry
  state unless an existing screen-state convention clearly requires otherwise.

**Baton → CCode. Approved and unblocked.**

---

### League screen refinement — DELIVERED (`3e326e1`)

*Restored from the first compaction (`e16da85`), where it was recorded in full;
the second compaction reduced it to five lines and that shortened version was
all the live Ledger still carried. This is the full brief.*

Existing direction through `49af41b` remains unchanged. For the League screen specifically:

- Keep Month and View controls.
- Treat the prose immediately beneath `September 2026 League Table` as secondary information, with a compact disclosure/chevron so it can be hidden.
- Make the **By tier** breakdown collapsible as a whole; when collapsed, the long Tier S/A/B/C tables disappear without changing the selected By tier / All together mode.
- Mobile-first: the goal is to reach the actual table faster and avoid a very long rankings screen.
- Add a clean **Last 10** league-table mode/view. It is not scoped to the selected calendar month: for each player, take that player's latest 10 rated games available in the record.
- Last 10 should use league-table results semantics (P/W/L/D/GD/Pts; 3 win, 1 draw) and sort as a form table, with league points primary and the existing league-table tiebreak rules retained unless the implementation exposes a conflict that needs a product decision.
- A player with fewer than 10 rated games should still be representable honestly (show the actual P rather than fabricating ten games); CCode should preserve existing eligibility/status semantics and flag only if a product choice is genuinely required.
- Do not use the current `Form (10g)` percentage as a substitute for the new table. That compact column may remain on monthly tables, but the new view is the readable expanded form comparison.
- No rating-engine, Reliability, tier-history or stored match-fact changes.

Condensed restatement as the second compaction recorded it, kept because it is
the form the acceptance criteria were last agreed in:

- Explanation beneath the League Table heading collapsible.
- By-tier table block collapsible.
- Dedicated Last 10 results table from each player's latest up-to-10 rated games overall.
- P/W/L/D/GD/Pts; 3 points win, 1 draw; real sample shown for players with fewer than 10.
- No rating-engine changes.

---

### Players Directory refresh — DELIVERED (`43401f8`)

The direction as Shaun and CGPT set it, kept in full as the acceptance
reference. Every point is implemented; see the CCode handoff in Section 6.

**The screen it replaced, for the record:** *"The current beta Players Directory
remains visually older than the rest of the refreshed application: a large
filter card followed by plain alphabetical rows with letter dividers, serif
names, ACTIVE/INACTIVE pills and right-aligned `Tier · Rating` text. Shaun has
requested that this now be brought into the current premium Money Padel visual
language without losing the Directory's useful filtering/sorting."*

The screenshot supplied by Shaun is the current-state reference. Keep functionality but visually modernise it to match Home, Rankings and the newer admin work.

- Preserve the top **Directory / Compare** segmented control.
- Keep Tier, Status and Sort controls, but make the filter area more compact and deliberate. It should not dominate the first viewport. Use the established dark surfaces, restrained gold, border radius, spacing and sans-serif utility typography already used elsewhere.
- Consider a compact filter/disclosure treatment for secondary filters on mobile rather than a permanently tall control panel. CCode should reuse existing design tokens/components and choose the simplest responsive implementation rather than creating a new design system.
- Player rows should feel tappable and profile-oriented rather than like admin records. Preserve clear player name, current tier, Power Rating and status where useful.
- Reduce visual noise from repeated ACTIVE pills. Active is the normal/default state and does not need to shout on every row; inactive must remain clearly identifiable. Do not remove status filtering.
- Keep alphabetical group markers when A–Z is selected if they genuinely improve scanning; when sorting by Power Rating, do not retain misleading alphabetical sectioning.
- The row hierarchy should prioritise **player identity first**, then concise tier/rating context, with a subtle affordance that the row opens the player's profile.
- Serif may remain for player identity if consistent with public-facing profile/ranking presentation; controls/metadata remain sans-serif. Avoid the Admin-style editable-record look here — this is a public-facing directory.
- Mobile-first, especially narrow iPhone widths. Avoid horizontal overflow and oversized controls.
- Preserve all existing filtering, sorting, Compare behaviour and profile navigation.

---

### Earlier tasks, kept as the acceptance record


**DONE (`af84d87`, `f5d4095`, `fc33a44`). Owner / baton: CGPT / Shaun — visual
acceptance of the new Home screen.** `fc33a44` is separate follow-on work Shaun
approved on 20 Sep: see the CCode handoff of 20 Sep 2026 in Section 6.

**Original Home task status below.** All five parts delivered, 316/316 tests, screenshots
regenerated including `00-home.png`. See the CCode handoff of 19 Sep 2026 in
Section 6, which also records a commentary defect found after the first commit
and fixed. Part 5 (match sharing) is recorded as backlog in Section 5 and was
deliberately not implemented.

The original task follows, unchanged, as the acceptance reference.

**Original owner / baton: Claude Code — Home lower-section usefulness + visual
refresh.**

Shaun reviewed the lower half of Home and wants it to be more useful, less
decorative, and less dependent on manually maintained data.

### 1) Club Pulse becomes actionable

- Keep Club Pulse visible.
- Make each Club Pulse card clickable; clicking the featured player opens that
  player's profile.
- `All Insights` must open the existing Insights / Call Outs area at the **top**
  of that experience. It currently lands part-way through the long Call Outs
  content because it reuses the old tab/scroll state.
- Reset/position scroll intentionally when entering Insights from Home.

### 2) Match to Make becomes optional / collapsed

`Match to Make` may be useful occasionally but should not permanently consume
Home space.

- Rename/reframe as **Match ideas** (or equivalent concise label).
- Collapsed by default.
- Summary copy can say something like `Balanced games suggested for you`.
- Expanding reveals the existing recommended matchup card(s).
- Preserve the existing underlying matchup logic; this is hierarchy/presentation
  work, not a new recommendation engine.

### 3) Replace Next on Court with Last Time Out / Your Last Result

`Next on Court` technically reads confirmed Upcoming games involving the selected
player, but Upcoming is currently manually maintained by Shaun. Home should not
depend on that data being complete.

Replace it with a card built automatically from the selected player's most recent
rated v3 match.

Preferred content:

- heading: **Last Time Out** or **Your Last Result**;
- opponent/partner and result;
- scoreline;
- that player's exact rating movement from persisted journey/match facts;
- one short, lighthearted but factual commentary line;
- `View match ›` opens the corresponding match detail/breakdown.

Commentary should be deterministic from existing facts and restrained, e.g.:

- close win: `Got it done. Tight match, but you came through.`
- upset win: `Statement win. You beat a side that went in as favourites.`
- loss but better game-share than expected: `Better than the scoreline suggests.`
- draw: `Nothing between you. One to run back.`
- heavy loss: `Tough one. Time to run it back.`

Do not invent psychological claims, trash talk, or new calculations. Use result,
scoreline, persisted expectation/game share and stored rating movement only.

Upcoming remains available in Play; removing Next on Court from Home does not
remove or change the Upcoming feature.

### 4) Monthly snapshot remains visible

Keep the monthly snapshot / `View Full Review` area visible. It is automatic and
useful enough to retain in the Home hierarchy.

### 5) Future backlog — match sharing

Do not block this pass on notifications. Record follow-on work for suggested /
requested matches to support native Share (which can route to WhatsApp) plus a
`Copy message` fallback. Suggested message should include teams and concise
match context such as expected balance. No notification system is required now.

### Acceptance

- Club Pulse cards open the correct player profile;
- `All Insights` lands at the top of Insights/Call Outs, not mid-page;
- Match ideas are collapsed by default and expandable;
- Next on Court is removed from Home and replaced by selected player's latest
  rated result;
- Last Result card is sourced from persisted v3 match/journey facts and links to
  the right match;
- commentary is short, factual and deterministic;
- Upcoming remains untouched in Play;
- no Sequential-v1 or stored-rating changes;
- add targeted browser coverage for each interaction.

### Queued Games refinement — canonical tier order

After the current Home pass, tighten the Games tier presentation/filter ordering.

Use one shared canonical helper with tier strength `S > A > B > C` and
partnership strength:

`SS > SA > SB > SC > AA > AB > AC > BB > BC > CC`

Required behavior:

- within a partnership, higher-tier player displays first;
- same-tier partners preserve stored order;
- stronger partnership displays first;
- equal-composition partnerships preserve original team orientation;
- matchup labels use canonical partnership codes only (`AB`, never `BA`; `SB`,
  never `BS`);
- filter options sort by canonical strength, **not by match count**;
- counts remain beside labels;
- only options present in the current Month/Player scope need appear;
- use the same helper for visible historical game ordering and filter
  classification/order;
- do not mutate stored match/team/player order or rating facts.

Example filter order where present:

`SS vs SS`, `SS vs SA`, `SS vs SB`, `SS vs SC`, `SA vs SA`, `SA vs SB`,
`SA vs SC`, `AA vs AA`, `AA vs AB`, `AA vs AC`, `AA vs BB`, `AA vs BC`,
`AB vs AB`, `AB vs AC`, …

Add regression coverage for canonical partner order, equal-tier stability,
orientation preservation for equal team compositions, and strength-based
filter ordering independent of counts.

### Admin/Manage mobile refinement

Shaun aligned the current screenshots with a prior GPT design pass. Treat the
following as one coherent UI refactor, with no data/model changes:

1. **Historical match cards:** move `… Manage` to the `Submitted by …` row,
   right-aligned. Matchup text gets the full card width; score stays on its own
   row. Do not truncate matchup text unnecessarily.
2. **Admin/Manage accordion:** convert each major admin section into the same
   collapsible component. Entire header row tappable; chevron down/up;
   multiple sections may stay open; **all sections reset to collapsed whenever
   the Admin/Manage screen is entered/opened**.
3. **Admin headings:** remove emoji-style heading icons such as `🔮` and `🏷️`
   and use the established premium Money Padel admin heading treatment.
4. **Player Tags:** keep `Add a new player` as an admin card. Add an
   `Existing players` admin card/list. Each player starts as a compact summary
   row using admin sans-serif typography, with tier / starting-tier / status
   summary and chevron. Tapping expands inline to the existing editable
   Current Tier / Starting Tier / Active-Inactive controls.
5. **Visual consistency:** reuse existing dark/gold tokens, borders, spacing,
   muted/active treatments, and components. Do not invent a parallel visual
   system.
6. **Scope guard:** presentation/interaction refactor only. Do not change player
   data, ratings, historical tier behavior, active-player filtering, prediction
   logic, or match-management behavior.
7. **Primary viewport:** narrow iPhone/mobile first; add targeted browser
   regression coverage for layout and collapse/reset behavior.

**30 Sep: the parallel-development split is delivered (`f75a493`). Baton
with Shaun.**
- `f75a493` is the redesign branching point.
- **Not started:** the redesign branch (`ux/player-reset-v2`) and all
  redesign work. Both wait on Shaun confirming the product/IA review
  (Section 5).
- Functional work continues on `app-features-fixes` → `main` as before.

---

## 5. OPEN QUESTIONS / DECISIONS

### RESOLVED 30 Oct — Monthly Race score as a column on the Merit Table (built as proposed)
Shaun wants the Race score beside Merit for context. A mock with an 11th
column at 360px fits without breaking names (name column ~72px), but the
Hard/Even/Fav headers touch and a three-figure negative score sits on the
edge. CCode's proposal: show it only when a month is chosen (the Race has no
All-time score), whole numbers ("+52", "−81"), last column, labelled Race.
Note for CChat/CGPT: it puts two different scoring systems side by side
(Merit is tier-based; the Race uses Power Ratings), so the two can disagree.

### OPEN 30 Oct — Admin sign-in before members get the full app (Shaun)
The beta Firestore (`mp-dashboard-beta-v3`) is open read/write with no
authentication; the Admin lock is a deterrent in the page, not a control. The
standings site (mpstandings.sgj.luxe) shows read-only screens, but the data
underneath is as writable as before. **Recommendation (CCode):** before the
full app goes to members, add an Admin sign-in (Firebase Auth) and Firestore
rules allowing writes to signed-in admins only (reads stay public). Needs
Shaun's go-ahead: it changes who can submit games and touches production data
rules.

### RESOLVED 27 Oct — Vercel builds Production and the `redesign` branch only

**Shaun set the Ignored Build Step** to build Production and `redesign` and skip everything else. Live app: `moneypadel.sgj.luxe` (Production); redesign: `mpr.sgj.luxe` (Preview, branch `redesign`). Verified: `ed8a9dd` on `redesign` deployed to Preview.

#### As raised

**For Shaun (CCode recommends: skip previews for everything except `redesign`).**
*Corrected 27 Oct:* the redesign branch is **`ux/player-reset-v2`** (`8b9588d`, 4 Oct,
last preview built 4 Oct), not `app-redesign` (superseded 30 Sep). It is 42
commits behind `main` (every functional fix since 4 Oct), and a merge of `main`
into it conflicts in ~20 files. Shaun wants it on his domain as well (a subdomain
assigned to that Git branch in Vercel, which needs its previews re-enabled).
*27 Oct:* Shaun renamed it **`redesign`**; use that name in Vercel (Ignored Build
Step and the branch domain). Production domain: assign to **Production**, not a branch.
Shaun's Vercel storage clean-up set an Ignored Build Step, and since then every
Preview deployment is cancelled; Production is unaffected (verified from
GitHub's deployment records: `d298c25`, `432fa1f`, `e6efbee` all deployed to
Production). In the normal workflow previews only duplicated production
(`app-features-fixes` = `main`), so nothing is lost there. A preview is only
needed to review held work before it is released: the redesign branch. If
wanted, the Ignored Build Step command
`if [ "$VERCEL_ENV" = "production" ] || [ "$VERCEL_GIT_COMMIT_REF" = "redesign" ]; then exit 1; else exit 0; fi`
builds production and the redesign branch only. CCode can also put it in
`vercel.json` (`ignoreCommand`) so it is versioned.

### RESOLVED 15 Oct — every record counts draws (`777b7c0`)

**Shaun, 15 Oct: "Yes, align everything to include draws."** Done in `777b7c0`: PLAYERS, monthly stats, partnerships, H2H and every W/L display and export now count draws (total = W + D + L = games played; win % = W / total).

#### As raised

**For Shaun / CGPT (CCode recommends: yes, align them).** `PLAYERS[].wins/losses/total/winpct`
(built from MATCHES, the rating's decided-only set) still feed the Power
Rankings W% column and its sort, the profile's "Best chemistry" partner
record, and the admin player CSV (Wins, Losses, Win %). There, Win % =
wins / (wins + losses). The profile, Home, the League, the Games log and
Player Packs use wins / games played, draws included (`9809d88`). Aligning means
counting draws in the rankings' W% (and `total`). That also touches the
min-games display filter, which reads `total`. This was left untouched
because it is a visible change on a ranking screen; say if it should follow.

### RESOLVED 4 Oct — Matchup Card: the % of games, not a number of games

**Shaun, 4 Oct: "Showing the % of games rather than number of games expected to win is fine."** The card's big figure is now the expected share of games (e.g. 34% – 66%), the figure Predict a Matchup has always shown; the typical-match conversion and its "In a typical 25-game match" line are gone (`a3e515b`). The note on the scale still applies. Kept below as it was raised:

#### As raised

**For Shaun / CGPT. Live in `acba496`.**
- **The scale.** The share behind "expected games won" is the engine's
  expected *score* (OPEN 2 Oct: 0.80 × game share + 0.20 × result). Predict
  a Matchup has called it "share of the games" since 21 Sep, and the card
  keeps that reading. A strict expected game share would be a new quantity;
  it would need a methodology decision first.
- **The match length.** The typical match is the club's median games in a
  decided match (25 on the current record). Matches run 12–54 games, so the
  card says "In a typical 25-game match".
  - The alternative is a fixed length, such as 18 for two sets. Say if you
    prefer that.
- **Upcoming's folded prediction** (on an agreed game) still uses the older
  card text. It could adopt the Matchup Card; not changed here.

### OPEN 4 Oct — Player of the Month nominations: three small calls (defaults in place)

**For Shaun / CGPT. Nothing is blocked; live in `e5f868a`.**
1. **More than five nominations.** With tier winners included, a month
   typically has 3–7 nominations on the seeded data (June 6, July 7,
   August 6, September 3). Nothing is cut automatically. Above five, Admin
   sees "7 strong cases this month. A vote works best between 3 and 5 —
   remove any you'd leave out." Say if a hard rule is wanted instead.
2. **The titles** "Month Champion" (two competitions) and "Triple Crown"
   (all three) are CCode's defaults, along with the six statistical titles.
3. **Joint winners** read "Joint top of Tier A in the June League."; a
   combined story with a shared win ends "(shared)".

### OPEN 4 Oct — Player of the Month: small follow-ups (nothing blocked)

**For Shaun / CGPT. The feature is live (`7dca948`).**
1. **Story wording and floors** are CCode's defaults (`domain/awards/
   playerOfMonth.js`, `STORIES`): e.g. Strongest Results needs a win rate
   above 50%, Most Consistent beats expectation in more than half its
   matches. Changing them bumps `RULES_VERSION`; confirmed months are
   unaffected. Possible extra stories later: biggest rank climb, a
   promotion month.
2. **No cap at five.** Ties can make six or more candidates; nothing is cut
   arbitrarily, and Admin removes. Say if a hard cap is wanted.
3. **Months before June 2026** have no rated data, so the app cannot suggest
   candidates for them. Recording historical winners for those months would
   need a small "record a past winner" path. Not built.
4. **In-app voting** is not built. The record reserves `votes` and keeps
   shortlist and winner separate, so "voting opens → one vote per
   recognised player → winner confirmed" can slot in between them.
5. **Firestore rules:** the beta is open. If rules are tightened,
   `playerOfTheMonth` needs read for everyone and write for Admin only.
6. **"Most Player of the Month awards"** is ready as data
   (`PlayerOfMonth.awardCounts`), but not shown anywhere yet.

### OPEN 4 Oct — Player status: four small follow-ups (nothing blocked)

**For Shaun / CGPT. The status model is live (`4cbfeb7`).**
1. **A newly added player cannot be given a status until their first game.**
   Admin's "Add a new player" writes a tag, not a v3 record, and the status
   lives on the record; until then they are Active and Admin says "That
   player has no record to update." Fine for a new member; say if a
   pre-game archive is ever needed.
2. **Past months on Power Rankings filter by today's state.** Choosing a
   past month hides Idle / temporarily inactive players by their state *now*,
   while the podium for that month does not. This predates the status work
   and archived players are deliberately *kept* in past months. Worth one
   decision when Rankings is redesigned.
3. **Board Pack "Players active"** counts players who played that month. It
   is not the status. Suggest renaming to "Players who played" so the two
   meanings of "active" don't meet; not changed without a call.
4. **Redesign branch:** Arrange a Game on `ux/player-reset-v2` reads
   `allPlayerNames()`, which is now live-only on `main`; it follows
   automatically at the branch's next merge of `main`.

### OPEN 3 Oct — Match Result Card: three small product calls (defaults in place)

**For Shaun / CGPT. Nothing is blocked; the card is live (`c6acfd9`).**
1. **The story thresholds and wording** (Section 3 row) are CCode's
   defaults. They are tuned on the 30 Sep record so that every story
   actually occurs and none dominates. Change any number or line and
   every card follows; the thresholds are pinned by a test.
2. **A win that cost rating.** When a favourite wins but falls short of
   expectation, their rating falls. The card then shows *Job done* and
   omits the gains row, and the analysis shows the drop.
   - The alternative is to show the drop on the card. That is honest,
     but it is a negative number on a celebratory card.
3. **"Performance" is the label** for the engine's actual score on both
   views, as the brief suggested. "Actual" is no longer shown.
- **For the design system (not blocking):** the card has its own sports-
  card styling (`.mrc-*`: serif hero names, a big score, a story panel).
  If the redesign's tokens or primitives should own a "share card"
  pattern, this and the Board Pack pictures would move onto it together.

### OPEN 2 Oct — Match scorecard: the scale of "Expected" and "Actual", and an older label

**For Shaun / CGPT. Nothing is blocked; the scorecard is live (`19662b1`).**
- **The scales do not mix.** The engine's expected and actual are
  performance scores (0.80 × share of games + 0.20 × result), not shares
  of games. The brief's example ("Actual = game share 44% vs Expected
  62% → −18pp") puts a game share beside a performance score.
- **What the card does:**
  - Expected and Actual are both on the engine's scale; the pp
    difference is the one that moved the ratings.
  - The game share sits underneath ("Games 13–7 (65.0% of games)").
  - A note on the card says what the figures are.
- **Decide if you want something else.** For example, an "expected game
  share" would be a new quantity the engine does not produce; it would
  need a methodology decision first.
- **An older label to correct.** The Games card's expanded detail still
  says "Expected 71% of games · won 13/20 (65%)". That "Expected" is the
  performance score, so the line compares two different scales, contrary
  to `MatchFacts`' own rule.
  - **Recommendation:** reword it to "Expected score 71% · scored 72%",
    or drop it now the scorecard is one tap away.
  - Not changed here: it is player-visible wording outside the brief.
- **Reuse, not built (each is one `scorecardButtonHtml(id)` in that
  surface's markup):**
  - Home › Recent Results;
  - the profile's match history (beside "Why X's rating moved");
  - Rankings drill-downs (Monthly Breakdown, P/W/D/L lists).
- **Share Match:** the view model is plain data, so a CardPainter picture
  of it is the natural next step. Match sharing stays parked (Section 5)
  until promoted.

### OPEN 1 Oct — Desktop: what was deferred, and Me

**For Shaun / CGPT. Nothing is blocked; the desktop layout is live
(`269327c`).**
- **Me is not built on this branch.** Me exists only on the redesign
  branch (`ux/player-reset-v2`, Phase 1). Here the fifth item is
  **More**, as on the phone. A desktop Me dashboard belongs with the
  redesign's Me. It will inherit this layout system (below) rather than
  be built twice. "Viewing as" sits at the foot of the rail.
- **Deferred from the first pass:**
  - a persistent game-detail pane in Play (game details open as dialogs
    instead);
  - desktop layouts for Compare, Insights / Call-Outs, Doughnuts and the
    More guides (they are centred and capped, and fine, not designed);
  - sticky headers on the League's own div-based table (Merit and Race
    tables have them);
  - the Games admin toast, which spans the rail on desktop.
- **For the redesign branch to inherit it:**
  - `desktop.css` keys on `.shell-bottom-nav`, `.shell-more-sheet`,
    `.overlay`, the body grid, and `html[data-section]` /
    `[data-tab]`;
  - the redesign's shell needs only to keep those hooks, or map its own
    classes in that one file.
  - No screen renderer was changed for layout, apart from the
    `display: contents` wrappers.

### OPEN 1 Oct — Tier S switch and the new split lists (CCode's call)

**For Shaun. Nothing is blocked.**
- The results table and Power Rankings can now be split by tier, and are
  by default. When the Tier S switch is set to Hidden, the split version
  leaves out the Tier S section, as League, Merit and Race already do.
- When Shaun asked for the switch he said he still wanted the Tier S
  player's data in tables. That still holds for **"One list"**, and the
  split report says the section is hidden.
- **If Shaun would rather keep Tier S in split lists whatever the
  switch says**, it is a one-line change.

### OPEN 1 Oct — Monthly Information: "Lowest win % (highest loss %)" ranks by win %

**For Shaun / CGPT. Nothing is blocked; not changed.**
- The Information tab's list is titled "Lowest win % (highest loss %)",
  but it ranks by **lowest win %** and shows the first tied player's
  loss %.
- With draws those differ. 2W 2D 1L has a lower win % (40%) than 3W 0D 2L
  (60%), but loses less (20% against 40%).
- The new Board Pack module "Highest loss %" ranks by loss % proper, from
  a new `highestLossPct` list in the same selector (`monthlyInformation`).
- **The question:** should the Information tab's list become "Highest
  loss %" on the same rule, or keep its title as "Lowest win %"? CCode's
  recommendation: retitle it "Lowest win %", which is what it measures,
  and leave the ranking alone. It is a one-line change either way.

### OPEN 1 Oct — Player Packs: private links, and one storage setting

**For Shaun. Nothing is blocked; packs can be published and shared now.**
- **The access model built (CCode, as the brief asked):**
  - Each published pack is stored under a **random 128-bit token**
    (22 URL-safe characters), in its own Firestore collection,
    `playerPacks`. The link is `review/?p=<token>`.
  - Nothing in the link names the player or the month. Changing a name,
    month or id in the address reaches nothing. A wrong, unknown or
    withdrawn token shows the same "not available" page and names nobody.
  - The token is made on first publish and kept, so republishing never
    breaks a link already sent. Unpublishing withdraws the pack at once,
    and nothing is deleted.
  - The page is `noindex` and sends no referrer, so the token is not
    passed to any site the page links to.
  - A section the club has made Admin-only stays out of a shared pack,
    as it does in the club's review.
  - The club's Monthly Review keeps its simple month link (`?m=`).
- **What this protects, and what it does not:**
  - It stops a player reaching another player's pack from the address
    bar. That is the brief's bar ("not trivially enumerable").
  - It does **not** make the stored packs secret from someone who opens
    the browser's developer tools. The beta's Firestore has open read and
    write (Section 3), so anyone with the app's key could list the
    `playerPacks` collection, or read the drafts document, which holds the
    index of tokens. The admin password hash is already exposed the same
    way today.
- **The decision for Shaun: add one Firestore security rule.**
  - **What it does:** in the beta project's rules, `playerPacks` allows
    reading **one document by its id** but not **listing** the collection
    (`allow get; deny list`).
  - **Its effect:** packs become private in storage too. Only someone
    with a link can read a pack. No app code changes; the review page
    already reads by id only.
  - **Recommended: yes**, once the beta has any rules at all. It is a
    console change to the shared database, so CCode has not made it.
  - The token index in the drafts document would still be readable while
    the `moneypadel` collection stays open. Closing that needs Admin
    authentication, which the brief ruled out. Say if it matters.
- **Data left out, for want of a canonical source:**
  - **"Relevant players you did not play":** there is no agreed rule for
    who is relevant (tier, activity, rating range). Not built.
  - **Per-match expectation:** shown only as the engine's stored
    performance figure (actual minus expected game share). No new
    expectation is worked out. "Furthest above expectation" appears only
    when a match beat it.
  - **Win probabilities and predictions:** none, as the brief said. Next
    month's ideas say what to play, never whom to beat.
  - **"Inactive" status** still has no history (known, Section 5 Board
    Pack note), so the pack does not use it.
- **Minimums (configurable per pack, documented on the screen):**
  head-to-head records 2+ matches (or 1 or 3); weaker results 2+
  matches (or 1 or 3); partner chemistry 2+ decided games (the Insights
  rule). One match is shown but never called a pattern.

### OPEN 30 Sep — Monthly Review: public links and what comes next

**For Shaun. Nothing is blocked; the review works as built.**
- **Who can open a review link:** anyone who has it. No unlock is
  needed, as the brief asked.
  - The address is predictable (`?m=2026-09`), so anyone who knows the
    app's address could guess another month's link.
  - This exposes nothing new. The beta's shared storage is already
    readable by anyone with the app (Section 3, "permanent open
    read/write"), and every figure on a slide is already on a public
    screen.
  - The page is marked `noindex`. A slide built on a section the club has
    made Admin only is not shown.
  - **If Shaun wants links that cannot be guessed,** a random token per
    published month is a small change. CCode's recommendation: not needed
    while the app itself is open.
- **Next sub-increments, not started:**
  1. **Export slides as images**, 1080 × 1350 (Section 3).
  2. **"View full stats" into a particular screen**, with the redesign's
     router.
- **Unpublishing: added 30 Sep (`a5cbe84`) at Shaun's request,** as a
  withdrawal rather than a deletion. The review stays stored, marked
  withdrawn, and can be published again.

### OPEN 30 Sep — Board Pack: saved figures or live ones?

**Update, 30 Sep (Share Deck):** the part of this that mattered most is
now settled. A **published Monthly Review is frozen** as sent (Section 3).
The Board Pack itself stays live, with its warning when a month's record
changes. The finalise question below now applies only to the Admin's
Board Pack report, if the board wants that frozen too.

**For Shaun. Nothing is blocked; the pack works as built.**
- **What is stored:** only the admin's choice for the month (Section 3).
  Every figure is recomputed from the record each time the pack is
  opened.
- **So a past month's pack can change afterwards.** Any of these would do
  it:
  - a late result approved into that month;
  - an edit or deletion of one of its matches;
  - a club decision or reassessment that moves a month-end rating;
  - a correction to a tier change.
- **What CCode added so it is never silent:**
  - a saved pack carries a fingerprint of the month's matches, month-end
    ratings and tier changes;
  - when that no longer matches, the section says so: "The record for
    August 2026 has changed since this pack was saved…";
  - no figures are stored.
- **The question:** should the board be able to **finalise** a pack?
  That would freeze a copy of the figures as presented.
- **CCode's recommendation:** stay live for now. Add a "Finalise" action
  that stores a frozen copy only when the pack becomes something the
  board formally signs off or circulates. A frozen copy is a second
  record of the figures, so it should exist only where a signed-off
  version is actually needed.

**Stats not included, for want of a canonical source.** A new selector
or definition would be needed first, and the brief ruled out a new stat
engine.
- **Head-to-head and rivalries for a month:** `H2H` is all-time only;
  nothing is scoped to a month.
- **Notable results:** there is no definition of a notable result.
  - Hard wins, Merit's own classification of beating a stronger pairing,
    are included instead.
  - Upset counts exist per player on Rankings, but not as a list of
    matches.

**How some included modules are sourced**, recorded so nobody reads them
as something else:
- **Form** is Last 10 **as it stood at the month's close**
  (`LastTen.build` on the record up to that day). It is not the League's
  "Form (10g)" column, which is today's form.
- **Power Rankings at month end** is the podium's pool: the month-end
  rating, the tier at the month's close, and 5+ games that month. It
  deliberately leaves out the Rankings list's current Ranked / Idle
  filter, which is a statement about today.
- **Partnerships** use the Insights chemistry function (`buildPartnerships`)
  over that month's rated games, 2+ together. Tiers are not shown, because
  that function's tiers are today's.

### OPEN 30 Sep — redesign branch: waiting on Shaun's IA review

**RESOLVED 30 Sep: `ux/player-reset-v2` created.** Shaun gave the
go-ahead in the session. It was cut from `f75a493` and brought up to `main`
(`b4e57e4`), then pushed. The earlier update is kept below.

**Update, 30 Sep (CCode): the IA gate is cleared, but the branch is not
yet created. It needs Shaun.**
- **What CCode tried**, as NEXT instructed: create `ux/player-reset-v2` at
  `f75a493`, merge current `main` into it, and push.
- **What happened:** this session's permission check refused it as a change
  to a shared resource. CCode has not tried to get round that.
- **Two ways to unblock it:**
  - **Shaun tells CCode to go ahead** in the session. That approval clears
    the permission check.
  - **Or Shaun creates it on GitHub:** make branch `ux/player-reset-v2`
    from commit `f75a493`. CCode then merges `main` into it on the next
    `Ledger CCode`.
- **Convention CCode proposes for when it exists:**
  - The Ledger and the design map are edited on `main` only. The redesign
    branch receives them by merging `main`, so the two never diverge.
  - Only redesign code and CSS are committed on the branch.

- **What unblocks it:** Shaun confirms the product/IA Keep / Simplify /
  Move / Merge / Hide / Remove review is complete.
- **Then CCode creates `ux/player-reset-v2` from `f75a493`,** the commit
  that finished the split. Every structural change is in its ancestry.
- **`app-redesign` (`ec963d5`) should not be used.**
  - It was cut before the split, so redesign work there would conflict with
    all of it.
  - It holds no commits of its own; it is an ancestor of `main`.
  - **Recommendation:** delete it when `ux/player-reset-v2` is created.
    Nothing is lost. CCode will not delete it without Shaun's word.
- **Sync rule, once it exists:**
  - it merges `main` at least weekly, and after any significant domain or
    data change;
  - its unfinished work never goes to `main`.
- **Heads-up for the redesign stream:** two things stayed shared on
  purpose.
  - **The router** (`#tabrow`) stays in `app.js` / `shell.js`: 101 test
    references navigate through it. Its natural home is the redesign's shell
    phase.
  - **The view-model functions** a redesigned screen should call are listed
    in Section 3 of the split document. A missing fact is added on the
    functional side, never re-derived in a screen.

### OPEN 29 Sep — Vercel: one setting to confirm when the project is connected

**30 Sep: Vercel is now the primary host**, so this setting matters more.

**Production URL (Shaun, 30 Sep):** <https://mp-dashboard-new-ratings.vercel.app>.
- **CCode could not verify it.** This cloud session's network policy
  refuses the host: a 403 on connect, with the policy denial recorded by
  the session proxy. CCode did not try to route around it.
- **To let CCode check deploys, read-only:** in the cloud environment's
  settings, add these to Network access:
  - `mp-dashboard-new-ratings.vercel.app`;
  - `*.vercel.app`, for branch preview URLs.
- **Until then, Shaun can check by hand:**
  - The foot of Admin / Manage should read "Build" plus the latest `main`
    commit.
  - `/preview` should show the app in a phone frame on a laptop.
- **What CCode still cannot do:** see Vercel deployments from its sandbox.
  So far no deployment has been observed.
- **What would let CCode verify one:** the production URL, or a preview
  URL. CCode would then read the build stamp on a deploy, read-only.
- **Worth knowing:** `app-features-fixes` is kept identical to `main`, so
  Vercel will also build a preview deployment of it on each push. That is
  harmless duplication. It can be switched off per branch in the Vercel
  project settings if unwanted.

The stamp needs Vercel's system environment variables at build time.
**"Automatically expose System Environment Variables"** is on by default for
a Vercel project. If it has been turned off, the stamp reads "local build".
That is honest, but the commit is missing.
- **Two cases that read "local build" by design:** deploys made with the
  Vercel CLI from a folder, rather than from Git, carry no commit SHA; so do
  deploys where the SHA is absent.
- **Settings `vercel.json` makes for the project:** no framework, and the
  build command.
- **Output Directory:** CCode left it unset. For a project with no framework,
  Vercel serves the repo root when there is no `public/` folder, and this
  repo has none.
- **If the dashboard has an Output Directory override,** clear it or set it
  to the root.
- **Nothing has been deployed to Vercel by CCode,** so the first live proof
  is the Admin / Manage foot on the first Vercel deploy.

**CLOSED 30 Sep by Shaun's decision to host on Vercel.** Pages is legacy, so its stopped builds need no action. The note is kept below.

**REOPENED 30 Sep: Pages has not built since run 133 (`6a311c6`, 29 Sep,
13:53 UTC).**
- **What did not build:** none of the 30 Sep pushes to `main` started a
  "pages build and deployment" run. That covers the Club Pulse clock pin
  through the split and the Ledger, up to `1c45938`.
- **What Pages is serving:** the Pages site still serves `6a311c6`.
- **Why it matters little:** these pushes change no behaviour, so a Pages
  user sees the same app. But **functional work will not reach Pages
  either** until this is resolved.
- **Likely cause:** as before, a Pages setting. Run 133 was triggered by
  Shaun's rename, not by a push.
- **Decision needed:**
  - **If Vercel is now the live host,** nothing is needed. Say so, and
    this note closes.
  - **If not,** check *Settings › Pages*: source `main`, root.
- **The API-commit fallback was not tried this time.** It would mean
  re-sending a whole file through the API, just to prod a setting that is
  probably off.

**RESOLVED 29 Sep, 13:53 UTC: Pages builds resumed.** Run 133 deployed
`6a311c6`, the head at the time, around Shaun's rename of the repository to
`MP-Dashboard-Beta-v2`. Everything below it is live on Pages, including the
Games record and the Vercel-ready stamp. The original note is kept below.

**Also for Shaun: GitHub Pages stopped building after `751c161` (00:42 UTC,
29 Sep).**
- **What happened:** neither the git push of `7aa7255` nor a commit made
  through the GitHub API (`9c532f8`) started a "pages build and deployment"
  run.
- **Why it matters:** the API fallback has always worked before (NEXT #15h).
- **Likely cause:** that points to the Pages setting itself, perhaps switched
  off or re-sourced as part of moving to Vercel.
- **What CCode cannot do:** see Pages settings from its sandbox.
- **Decision needed:**
  - **If Pages was retired on purpose,** nothing is needed. The Pages
    wiring is harmless and can stay as the fallback, or be removed later.
  - **If not,** check *Settings › Pages* on the repo.
- **Until then:** the Pages site is still serving `751c161`, so this change
  and the Games record (`d348c56`) are not live there.

### OPEN 29 Sep — Games filtered record: three choices CCode made

1. **Win rate counts draws as games played.**
   - 3 wins, 1 draw and 1 loss reads **60%**, not 75%.
   - This is the brief's wins / played. It is also the League's existing
     monthly win-percentage definition, so the two can never disagree about
     the same games.
   - The older all-time `winpct` on player records is computed without
     draws, because draws were never in that dataset. It is not a competing
     definition, but a player comparing the two may notice.
2. **Pending submissions are not counted.**
   - They sit in their own "Pending approval" section above the list and are
     not yet part of the record.
   - The record describes the approved list it sits on.
3. **With Data Range "all", April and May are counted,** because they are
   listed. The display-only April / May history appears in the Games list
   then, so the record includes it; the rule was "exactly the rows shown".
   - Those games never enter a rating, League or Merit figure.
   - On the seeded record, 34 of the 50 also get a tier matchup from the
     existing historical-tier resolver, so they can appear under a matchup
     filter too. That is how the Games filter already behaved; this task did
     not change it.
   - If Shaun wants them left out of the record, the honest fix is to leave
     them out of the list too.

### OPEN 28 Sep — Claude Design migration: decisions before any phase starts

Full reasoning and the numbering (DQ1–DQ30) are in Section 6 of
[`docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md`](./docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md).
In every case the real rule stays until someone decides otherwise.

**For Shaun: product behaviour, permissions, rules, data.**

| # | Question | CCode's recommendation |
|---|---|---|
| DQ1 | **RESOLVED 30 Sep (Shaun: as recommended).** The design makes the next tier a target: a "58 pts to Tier 1" bar and a threshold line on the journey. Tiers are board decisions, not rating thresholds. | No bar or line. Keep today's one-line gap, worded as "N pts below the lowest-rated Tier A player". |
| DQ3 | The design's Power view is today's ratings. Rankings opens on the Meaningful Month's month-end view. | Power shows today, which matches Tier Rank (D5). Month-end history moves to the Month segment. |
| DQ4 | The monthly switch leads with Best Month (the Monthly Race), which is still a trial. | League · Merit · Race until the trial is confirmed. |
| DQ6 | Can a participant record "Court booked"? This has been open since 27 Sep, and the design assumes yes. | Yes for the four players, attributed and reversible by an Admin. The Admin review list stays. |
| DQ7 | Can a player "Find a replacement"? Today only an Admin can. | Keep Admin-only. |
| DQ8 | Can a player "Change plan" (date, time, venue)? | Not in the first Play phase. |
| DQ9 | Should a plain request carry a time and venue? (NEXT #18) | Yes, optional. The fields already exist. |
| DQ10 | Court number, "booked by", Directions, Add to calendar, Share. | Leave all out for now. A court number would be a schema change. |
| DQ15 | The design uses "Reliability" to mean attendance ("turned up for 47 of 48"). | Never. Reliability means rating evidence, and attendance is not recorded. |
| DQ18 | **RESOLVED 30 Sep.** The podium and Kings of Tiers have no place in the design, but are accepted surfaces. | **Keep both:** compact podium near the top of Power; Kings of Tiers as a secondary Rankings destination. |
| DQ19 | **RESOLVED IN DIRECTION 30 Sep.** Home hero: none (`1a`) or one of five heroes. | **Hero stays in the target product**, but smaller, interactive and driven by live data; monthly competition is prioritised over slow-moving Power Rating. Visual implementation may be staged rather than built first. |
| DQ26 | Find a Game labels each card "Evenly matched" / "A stretch", which is a favourite call (D4). | Keep filters; no per-card verdicts. |

**CGPT presentation decisions (RESOLVED 30 Sep):**
- **DQ2:** this month on Rankings/Me; last-match delta on Latest Result / Last Time Out; label the period.
- **DQ5:** first run asks “Who are you?” via the existing player selector; no login implication.
- **DQ11:** fixture → existing Add Result pre-filled with players/sides; no time gate.
- **DQ20:** champagne gold `#D5B76E`; Instrument Serif + Inter self-hosted; keep stronger contrast; Booked gets a distinct hue.
- **DQ21:** H2H/Compare live in the profile/player flow (already settled by IA).
- **DQ22:** Played Games & Results + Challenges in My Games (already settled by IA).
- **DQ24:** always tier-label monthly positions; Race may be provisional.
- **DQ29:** badge = For Me requests + viewer-involved Needs Attention; hidden at zero.
- **DQ30:** Around the Club = 2–3 derivable items maximum, never invented.

**Mock assumptions kept out, with the real rule preserved.** No decision is needed on these:
- the parser never auto-accepts "Ant" → Ant Slicer, and duplicates are warned, not skipped;
- Merit is tier-step based with P/W/D/L;
- "Why it moved" uses `RatingExplainer`, not invented +8/+3/+1 items;
- no gendered copy ("He leads");
- records show draws;
- the eligibility rule is 2 in 30 days;
- the Admin prediction is worded as a share of games, never a probability.

**Map reconciled to the IA — DONE (`cf72a14`, CCode, 30 Sep).** Section 0 of the
map now carries the target IA per tab, and Section 7 the re-cut phases with
short acceptance briefs.
- **Settled by the IA, as the map reads it:** DQ3, DQ4, DQ21, DQ22 (with
  DQ18 and DQ19 above).
- **Resolved by Shaun/CGPT, 30 Sep:**
  - **DQ31:** Home hero leads with the viewer's current monthly competition position, named by tier and month, plus a compact record/points/movement line; tap opens This Month; Race stays out while it is a trial.
  - **DQ32:** Match Ideas moves to Play › Arrange a Game.
  - **DQ33:** Kings of Tiers is reached by a row directly under the compact Power podium and from More tables.
- **DQ3 CONFIRMED by Shaun, 30 Sep:** the IA makes Power "current club
  strength" and moves month-end Power history to More tables.
  - Power would stop opening on the Meaningful Month's month-end view, the
    26 Sep default. It would show today's ratings, which agree with Tier
    Rank everywhere.
  - The Meaningful Month still picks This Month's month.
  - This ships in Phase 4, on `ux/player-reset-v2`.
- **Phase changes:**
  - Phase 2 (Play) gains Arrange a Game, with Find a Game's entry, Match
    Ideas and Challenges in My Games.
  - Phase 3 splits: **3a** is the Home hierarchy with a text-first hero,
    and **3b** is the hero's visual treatment.
  - Phase 1 is now blocked only on DQ5 and DQ29.
- **No phase is approved yet.** Each brief needs its own go-ahead.

**IA review resolved 30 Sep — replaces the earlier 'no phase approved' gate.**
- Top-level IA is now **Home · Rankings · Play · Players · Me**.
- Rankings primary = **Power | This Month**.
- Play primary = **My Games | Club**, with **Arrange a Game** for Find/Request/Bulk.
- Players primary = **Directory → Profile**; Compare/H2H move into that flow.
- Me is a personal dashboard/settings/Admin home, not merely the user's profile.
- Home retains a compact live-data hero, with monthly competition prioritised; Needs You and Next Game are first-class.
- The implementation map should be reconciled to these decisions before Phase 0/1 implementation.

**Syncing to Claude Design is deferred (Shaun, 30 Sep).**
- **Why:** the Claude Design sync (`/design-sync`) imports a component
  library, a React/Storybook-style package the design agent then builds
  with. Money Padel has none: it is vanilla JS with HTML-string renderers,
  no build and no dependencies. A sync now would carry only `tokens.css` /
  `app.css`.
- **Options Shaun was offered:**
  - stop;
  - a styles-only import;
  - building React primitives just for the sync, which would pre-empt
    Phase 0 / DQ20.
- **He chose to stop.**
- **When to revisit:** once Phase 0 has produced real reusable primitives.
- **State:** no Claude Design project and no `.design-sync/` config were
  created.

**Kings / podium basis — RESOLVED by Shaun/CGPT, 30 Sep.**
- **Power Rating is the intended basis**, matching the current code (`computeRankingsPodiumTop3` / `computeKingsOfTiers`).
- The older 17 Sep statement that Monthly Performance is the podium/Kings basis is **stale/superseded history**. Do not change the calculation to match that sentence.

### OPEN 28 Sep — audit fixes D4–D6: judgment calls for Shaun

**1. Monthly Race still shows a win chance to players.**
- **What it shows:** the Race's own drill-down says, per past match, "An
  ordinary Tier X player wins this N% of the time".
- **Why CCode left it visible:**
  - It is the Race's stake. The Race was approved as a transparent,
    auditable competition fact, "separate" from the Admin prediction (26 Sep
    decision).
  - It comes from the Race's own model, not the prediction engine.
  - It describes games already played.
- **If Shaun wants it hidden,** that is a one-line gate. It would weaken the
  Race's promise that anyone can check their own score.

**2. Recorded games still show their pre-match expectation.**
- **What they show:** a played game's detail says "Expected N% of games".
  The profile's rating explanation says "you were expected to win about N% of
  the games".
- **Why CCode left it:** these explain a rating that has already moved, from
  stored rating data. They are not predictions about a game not yet played,
  so they are outside D4.

**3. What the visibility settings cover.**
- **The Chemistry setting** is labelled "Partnership chemistry rankings".
  It governs that ranking list; a player's own partnership figures on their
  profile are not gated.
- **Difficulty suggestions** remain Admin only, as before. They exist only
  in a legacy profile block the new profile does not show.
- **Call-Outs off** now also hides Home's "All Insights" link and the
  profile's "Match to Prove It". **Find a Game off** hides Home's Match
  ideas.
- Say if any of these should be read differently.

**4. What Tier Rank means in practice.**
- **"Current" means today's ratings,** not the month-end view the Rankings
  page opens on by default (its Meaningful Month). This is per the
  definition.
- **An Idle or Inactive player is "Unranked"** and is not counted in anyone
  else's "of M".
- **Rishi, live:** header and Player Analysis now both read **#8 of 8 in
  Tier A**.
- **The tier average is separate.** "N pts below tier average" still uses
  the average of all tier members: it is not a rank.

**5. D7: the Doughnuts month list includes months with no doughnuts to count.**
With Data Range set to "all", the month list includes April and May 2026,
the display-only history. Those months say "No doughnuts in April 2026",
because that history never enters any count and doughnuts included (the
existing definition). If Shaun wants the old April/May shutouts shown, that
is a decision to count display-only history, not a doughnut change.

**6. Noticed, not changed.**
- **Merit name wrap:** at 375px the Merit table wraps a name such as
  "Manny" onto two lines, because every column is an equal width. It
  measured the same (38px) before this change. A Phase 2 candidate.

### OPEN 27 Sep — fixture follow-up 2: what Shaun should know, and choices made

**1. The six live call-outs archive themselves on 5 Oct.**
- **What is live:** Shaun answered the booking review at 10:10 UTC today,
  recording all six as "Not booked yet".
- **The clock:** they were added as agreed on **21 Sep**, so their clock
  runs from then. They leave the active list on **5 Oct** unless a court is
  booked or an Admin restores one. Restore is one tap in Manage fixture and
  gives each another 14 days.
- **The alternative:** start their clock from today's review, which would
  mean 11 Oct. CCode did not do that: it would make an answer to a
  bookkeeping question restart the clock, which is what the brief ruled out
  for date edits.
- **If Shaun wants the later date,** it is a one-off decision; say so and
  CCode records it.

**2. Where the brief left the clock open, CCode chose:**
- **Unticking Court booking made starts a new 14-day window.** The game did
  progress to Upcoming, and a court falling through is a fresh call-out,
  not a dead one. The original `calledOutAt` is kept.
- **Needs attention pauses nothing.** A Called Out game that loses a player
  and is later put right returns to its original window, so it may archive
  at once if that window has passed.
- **Archived call-outs stay visible to players, read-only.** No I'm in /
  Can't play. They can still Add result, and D3 can still match one to a
  result, because an archive is not evidence the game did not happen.

**3. Add multiple games, as built.**
- **Who requests:** the selected player is the requester, and the requester
  is in only for games they play in. Shaun pasting others' games creates
  requests "by Shaun" that he is not confirmed in, as the single-request
  form already does.
- **Doubles only:** each line must be two against two, like the
  single-request form.
- **Renamed players:** only current names resolve. An old name is flagged
  unknown and can be picked.
- **Near misses** such as "Stormz" for Stormzy are offered, never accepted
  on the person's behalf.

**4. Other requests** (everyone else's) arrives folded; For me and My
Requests arrive open.

### OPEN 27 Sep — fixture follow-up: what Shaun should know, and choices made

**1. The live fixtures need one Admin pass.** Read-only, 27 Sep: the live
record holds **6** agreed fixtures, all created by Shaun on 21 Sep.
- **What they contain:** none has a time, a venue or any booking field. Five
  have no date; one is dated 24 Sep, now past. None has any history.
- **What can be inferred:** that all four players agreed, because Shaun added
  them as agreed.
- **What cannot:** whether any court is booked. So they are **not** marked
  booked.
- **What players see:** all six under Called Out ("Court not booked").
- **What Shaun sees:** the Admin-only *Court bookings to record (6)* list at
  the top of the Upcoming tab, with "Court booked" / "Not booked yet" on
  each. That is six taps.
- **Recommendation:** answer the list once, and remove any game that is no
  longer happening from Manage fixture.

**2. Two fixtures were deleted before the new rules went live.** The two
23 Sep games (Antz & Fatch v Jams & Tom; Erf & Rishi v Denis & PDM) are no
longer in the live record.
- The document was last written at about **07:34 UTC on 27 Sep**, before
  the D1–D3 deploy at 08:52. It was therefore the old one-tap delete, which
  kept no record of who did it.
- Nothing to act on; recorded so the count change (8 → 6) is explained.

**3. Needs attention presentation (CCode's choice, reported per the brief).**
- Needs attention is its **own small section at the top** of the Upcoming
  tab, and appears only when something needs attention.
- It was not done as a tag inside Called Out or Upcoming, because the brief
  asked that disrupted games not disappear inside Called Out. A booked game
  that has lost a player is the most urgent thing on the screen.
- Each folded card still says whether a court is booked.
- If Shaun prefers a tag within the normal sections, it is a small change.

**4. Admin can set a player's answer directly.** The brief lists "each
player's current confirmation/availability" in Manage fixture.
- An Admin can therefore mark someone In, Not answered or Backed out.
- It is recorded as the Admin's act, not the player's.
- This is the one deliberate exception to D2's "nobody confirms another
  player", and it is Admin-only.

**5. Only an Admin records a court booking.** Often a player books the court.
Whether a participant should be able to say "I've booked the court" is a
product question. It is not built.

**6. Smaller points.**
- *(Superseded 27 Sep by `b12e837`: Called Out is now **newest, or newly
  restored, first** — `calledOutOrder`, per the Decisions Log. Corrected 28 Sep
  while mapping the design. The original note follows.)*
- **Ordering:** Called Out is oldest first, so the game most likely to be
  forgotten is on top. Upcoming is soonest first.
- **Admin-added games** (Requests form and Predict a Matchup) now ask for
  Court booking made. It is unticked by default, so they land in Called Out.
- **A player backing out of an unagreed request** leaves it in Requests, as
  before; only agreed games go to Needs attention.

### RESOLVED 20 Sep — Tom + Fatch stale reassessment information

**Audit complete (`838ca66`). The record is correct; the stale source was a
document, not the app. No numerical repair was needed, so there is no blast
radius to report.**

| Asked | Found |
|---|---|
| Stored anchor = 1400, Reliability = 20% | **Yes**, on the active event for each: `2026-07-01__Tom__CLUB_RATING_REASSESSMENT__r2` and `2026-08-01__Fatch__CLUB_RATING_REASSESSMENT__r2` |
| Replay / current state | **Replays to itself, 0 differences.** Tom **1387.8**, Fatch **1377.9** in `players` — what the corrected events produce |
| Comparator wording in the record | Only on events **marked superseded**, which is what makes the correction auditable |
| Any UI saying Jords | **None.** Every rendered surface was scanned against the live record |

`journeyView` already excludes superseded events, so their wording cannot reach
a player's Rating Journey, and the admin audit trail labels rows
Superseded/Active without showing their notes. Both are now pinned by tests.

**The stale source: [`HISTORICAL_REVIEW_DRYRUN.md`](./HISTORICAL_REVIEW_DRYRUN.md).**
It was headed *"APPLIED"* and presented *"Jords' rating immediately before the
review | 1352.5 | 10%"* as fact, with nothing to say it had been superseded two
days later. Anyone reading it reaches exactly the conclusion Shaun reported. It
now carries the correction at the top, with the old rows struck through and kept
as the record of what was decided then.

**A second hazard, found while looking:**
`scripts/apply-historical-decisions.js` would have **re-applied the superseded
comparator anchors** if run with `--write` — silently, because it plans against
whatever is in the record. It now refuses to write and says why. Its dry run
still works as the record of how the 18 September decisions were applied.

#### The investigation brief as set, kept verbatim

Shaun reports the app still says they were reassessed to Jords' level despite the superseding baseline decision. Before any repair:

1. Locate every persisted club-decision/ratingJourney event for Tom and Fatch around their historical reassessment dates.
2. Confirm the effective anchor stored/applied is exactly **1400** and Reliability **20%** for each corrected decision.
3. Replay/verify current state from those events and record Tom/Fatch current Power Rating against the persisted `players` state.
4. Search all UI explanation/copy generators, Rating Journey event descriptions, historical club-adjustment audit text, profile cards and any comparison/reference metadata for `Jords`, comparator labels, old target values or superseded event text.
5. Distinguish **superseded audit history** from **current explanation**. It is acceptable for an explicitly labelled superseded event to preserve what the old decision was; it is not acceptable for current state/explanation to imply Jords remains the active anchor.
6. If only text/metadata is stale, fix it and add regression coverage.
7. If the active numerical record still uses the Jords-derived anchor, do not silently patch it. Report exact affected event(s), current vs expected state and replay blast radius in this Ledger before a write.

Baton for this investigation is with CCode and it is approved/unblocked.
*(Discharged: step 7 did not apply — the record was already correct, so no write
was made.)*

**And the standing instruction that framed it, as Shaun set it:** *"CCode must
verify persisted journey/decision data, current player ratings, rating
journey/profile explanatory copy and any historical-reassessment UI before
changing presentation. If the numerical replay is already correct and only copy/
audit metadata is stale, fix the stale source. If numerical state still derives
from the old comparator, stop and report the blast radius before writing a
repair."*

### Note added at the compaction, retained

Rating-model backlog and match sharing remain parked and unauthorised as at
`49af41b`. **No new methodology question is opened by the Last 10 form table**;
it is a derived results table over existing rated matches.


### Reassessment reliability recommendation — approved product direction, rule still to model

Shaun approved the product behavior but **not yet a final formula** for the
recommended percentage.

Required future reassessment UX:

- club chooses/accepts the new rating anchor or comparable player;
- system shows a **Recommended Reliability** with band and short explanation;
- Admin can choose **Use recommendation** or **Override Reliability**;
- manual override accepts a percentage and requires attribution/reason;
- event stores both the system recommendation and the final chosen reliability
  so the audit trail shows whether the board accepted or overrode it.

**The modelling is done (`9ac4285`), and it needs one decision from Shaun.**
Full analysis in [`REASSESSMENT_RELIABILITY.md`](./REASSESSMENT_RELIABILITY.md);
reproduce read-only with `node scripts/model-reassessment-reliability.js`.
Nothing is implemented and no engine behaviour changed.

**A framing correction the record forced.** The tier move (`PROMOTION` /
`DEMOTION`) changes tier and nothing else — not rating, not reliability. Only the
**anchor decision** (`CLUB_RATING_REASSESSMENT` /
`INITIAL_CLASSIFICATION_CORRECTION`) reopens reliability. So the recommendation
does not belong to "a promotion"; it belongs to the board **replacing a rating**,
and it answers how much confidence attaches to the number the board chose. This
supersedes the framing of questions 2 and 3 below.

**What the three decisions establish.**

| Player | Anchor move | Prior evidence | Prior reliability | Chose |
|---|---|---|---|---|
| Shaun | +263.2 (88% of a tier) | 5 | 33.3% | 10% |
| Tom | +249.1 (83%) | 4 | 28.6% | 10% |
| Fatch | +222.3 (74%) | 14 | 58.3% | 10% |

They are **one situation sampled three times**. Prior evidence varied more than
threefold and changed nothing, so the record fixes **one point** of any rule and
says nothing about a small correction — the case not yet met.

**Answers to the questions as asked:**

1. *What explainable rule?* Two survive: flat 10%, and **move-scaled** — retain
   prior reliability in proportion to how much of the old rating survived,
   reopening fully once the move reaches `D`. Both fit the record exactly.
2. *Fixed reopen, or discount prior evidence?* **Discounting prior evidence is
   ruled out, and Fatch is why**: 14 matches, three and a half times Tom's, and
   the same 10%. Any proportional rule must give him materially more.
3. *Should corrections differ from promotions?* **The record gives no reason to
   separate them.** Shaun's correction and Tom's promotion were the same size of
   move and got the same answer. What varies is the size of the move, not the
   label on it.
4. *Validation.* Done, with a bound rather than a value: a move-scaled rule
   fits exactly for any `D` **at or below 222 points**, and degrades above it.

**Recommendation: move-scaled with `D = 150` (half a tier).** It changes nothing
already decided, and stops a 30-point correction to a twenty-match player
discarding their whole record and setting K to 37 — currently the flat rule
would make a small board correction leave that player *more* volatile than a
newcomer.

**DECISION 20 Sep — Shaun chose MOVE-SCALED with D = 150 and a 20% floor.**
The flat rule is rejected. For a rating re-anchor smaller than 150 points,
Reliability is reduced proportionally; at 150 points or more, the
system-generated recommendation bottoms out at **20% Reliability**. Admin may
still override the recommendation, with attribution/reason recorded.

For promotion/demotion reviews specifically: the tier-change event itself should
still leave Reliability untouched. If the board also **re-anchors the player's
rating** as part of that review, this flat-vs-move-scaled recommendation question
applies to that reassessment. If the board changes tier but chooses **Keep current
rating**, there is no reliability reset/recommendation to apply. This is the
promotion/demotion distinction Shaun asked to keep explicit.

**Worth doing either way, and not blocked on the above:** record **both** the
system recommendation and the board's final choice on every future decision, so
the next validation has more than three points. The recommendation can be
computed and stored silently while the board goes on deciding by hand.

Until one is chosen, the existing manual reliability control remains the only
mechanism and 10% remains what the board has always used. Do **not** silently
make 10% or 25% a universal default.

### RESOLVED 20 Sep — the live record was half-written; repaired with Shaun's approval

**Raised by CCode, 20 Sep 2026, from Shaun's second removal attempt.** The app
refused it: *"Replaying the record unchanged does not reproduce it (145
difference(s))."* That refusal is the safety rule working, not a bug — it will
not plan an edit on top of a record whose stored ratings and stored history
disagree.

**What happened.** The removal of `Osh vs Len` on 2026-07-03, approved and
started on 19 Sep, wrote **364 of its 509 documents and stopped**. The writes
went one at a time, before batching landed (`fc33a44`), and the app was closed
part-way through. Deletions run first and completed, so the match is genuinely
gone — which is why a re-read showed 156 matches and the removal looked finished.
**Checking one collection was not enough, and that was my error.**

**The damage, measured.** Nothing is lost or corrupt:

| | |
|---|---|
| Matches | **all 156 intact** — no match was damaged, and none is missing |
| Journey events before 2026-09-03 | **545, all correct** |
| Journey events 2026-09-03 → 2026-09-17 | **114 hold pre-removal values**, 2 already correct |
| Player documents | **31 hold pre-removal ratings** |
| Documents missing entirely | **0** |
| Superseded club decisions | **3, correctly retained** |

145 stale documents = the 509 the plan called for, minus the 364 that landed.

**The repair is the plan Shaun already approved.** Replaying the 156 stored
matches produces, player for player and number for number, the *same* list of 31
movements shown on his confirmation screen — `Osh -1.8 → 1712`, `Len +1.7 →
1677.6`, `Eli -0.2 → 1641.3`, and so on. Applying it does not decide anything
new; it finishes the arithmetic of the removal he authorised. It writes 145
documents, changes no match, and deletes nothing.

**Built and tested, not run:** `ReplayForward.planRepair` and
`scripts/repair-replay-divergence.js` (dry run by default). The dry run is done
and is recorded above. **No write has been made to the live beta.**

**Shaun chose to finish the removal, 20 Sep.** The alternative offered and not
taken was re-adding `Osh vs Len` and replaying back to 157 matches, which would
have been a different decision rather than a safer version of the same one.

**Applied and verified.** 145 documents written, none deleted, no match touched:

| | |
|---|---|
| Replay-to-self | **0 differences** |
| Diagnostics | **8 / 8** at record level (the ninth check compares against the running app and only exists in the browser) |
| Live record | 156 matches · 664 journey events · 34 players |
| `Osh` | **1712** — as approved |
| `Len` | **1677.6** — as approved |
| Re-running the repair | reports nothing to do; it is idempotent |
| Editing | a removal plans cleanly again (5 players moved, 9 documents), writing nothing |

**Follow-on — RESOLVED by Shaun, 20 Sep, and built (`58c880b`).** The app now
detects and records the state; it does not repair it. Shaun's two decisions:

- **Detail goes to the owner only.** The board holds an admin password of its
  own, and a board member should not meet a wall of document ids.
- **Repair stays with CCode**, who shows the plan before writing. No repair
  action is offered in the app.

See the CCode handoff of 20 Sep (record health) in Section 6.


### Rating model backlog — parked during refinement

These are **not active implementation work**. Shaun wants the app refined first
and the current engine left unchanged. Revisit together later with live data:

1. **Responsiveness / small movements.** Does reliability accumulate too fast
   for Money Padel's real match volume, causing established-player K values and
   rating movements to become too small too early? Test sustained runs such as
   8–2 / 7–3 rather than judging isolated matches.
2. **Reliability curve calibration.** Compare the current `rc = 10` with slower
   curves (for example 15/20/25) using the actual club dataset; measure movement
   distributions, convergence after genuine improvement, ranking stability and
   walk-forward accuracy before considering any change.
3. **Expectation symmetry.** Sequential-v1 compares a blended actual score
   (80% game share + 20% match result) against a single Elo expectation. Review
   whether the expected side should itself include a separately modelled match
   result expectation so wins/losses are not conceptually double-counted.
4. **Sustained-winning recognition.** Check whether repeated wins — including
   narrow wins — are reflected quickly enough by the base model. If not, decide
   whether the answer belongs in the core model rather than as a cosmetic bonus.
5. **Optional player volatility mechanic (`Prove It`).** Possible future
   feature: an established player voluntarily accepts temporarily larger
   two-way rating movement for a fixed run of matches. If explored, implement
   as a separate K multiplier / volatility state, **not** by falsifying stored
   Reliability. Model 2×/2.5× historically before product design; 4× may be too
   aggressive.

None of the above is authorised for implementation yet.

### Product backlog — match sharing (recorded 19 Sep 2026, not scheduled)

Raised by Shaun in the Home lower-section task and deliberately kept out of that
pass. **No notification system is required or proposed.**

Suggested and requested matches should be shareable:

- native Share (which on a phone can route to WhatsApp);
- a `Copy message` fallback where native Share is unavailable;
- the suggested message includes the teams and concise match context, such as
  the expected balance of the game.

Not started, not authorised, no owner assigned. It sits behind the current
refinement work and needs a product decision on where sharing appears (Match
ideas only, or any matchup card) before it is scheduled.

1. **RESOLVED — monthly historical read strategy.** Use a month-filtered
   `ratingJourney` query (and the required Firestore index if needed). Section 2
   is amended: `players` remains the normal current-state read source;
   `ratingJourney` is allowed for bounded historical views. No precomputed
   monthly snapshots for now.
1a. **RESOLVED — accept the current session-cached cumulative read for Ranking
   Movement while the journey remains small.** Shaun/CGPT, 17 Sep 2026:
   `monthlyViews.js` may retain its once-per-session cumulative `ratingJourney`
   read, cached for the session (633 events at the last verification). Computing
   all-player rank at a historical boundary requires earlier state for players
   inactive in the selected month; a month-filtered query alone cannot supply it.
   This is a deliberate narrow exception: `players` remains the normal
   current-state source, and bounded historical reads remain required where
   they suffice. No whole-journey read per render, no snapshot collection yet,
   and Ranking Movement stays in scope.

   **Measurement recorded 18 Sep 2026 (`7dcdd2e`), as this exception requires.**
   633 journey events = 633 documents read once per session. Growing ~160
   events/month at the club's recent rate. Review point set at 5000 events,
   roughly 28 months away; the diagnostics screen reports these figures live and
   says when the review is due. **Not due.** No change to the exception.

   **Future review, not a current blocker:** reopen when journey size, read cost
   or observed load latency becomes material, or before an import/backfill
   expected to make it material. Claude Code owns recording the measurements
   and raising the review in this Ledger as specified in Section 2; the
   exception must not silently become permanent architecture.
   **NEXT #1, including Ranking Movement, is unblocked. Baton → Claude Code.**
2. **Match edits and deletions are inert.** The legacy edit/deletion overlays
   are no longer applied, because v3 match documents are already the edited
   truth and re-applying an overlay would desync a match from the rating
   computed for it. Consistent with historical editing being unavailable until
   replay-forward exists. **Shaun/CGPT decision: hide the inert controls for
   now; restore them only once replay-forward makes historical editing real.**
3. **Production snapshot does not reconcile.** 149 matches vs v3's 150;
   17 players' counts disagree, six of them negatively. Not explained by draws.
   Treat as an approximate reference, not a reconcilable truth.
4. **Snapshot join key is fragile.** Every `player_id` in the export is `null`,
   so name is the only join. 34/34 map today; a rename breaks it silently.
5. **Drift figure unresolved.** The specification states ~1.8 points of drift
   over 144 matches; measured is −42.8 (Stage 1) / −39.1 (Stage 2). Every other
   figure reproduces exactly, so this is most likely a different metric —
   recorded rather than quietly reconciled.
6. **RESOLVED (`19ffe21`) — expectations were recomputed in the
   browser.** Raised by CCode, 17 Sep 2026, while building the Rating Journey.
   The standing constraint is *"Never recompute historical expectations in the
   browser."* `enrichMatches` in `assets/js/app.js` does precisely that: it
   derives `expected_winshare` from **today's** ratings and prints it on every
   match card as "expected ~32% of games", and `computeMatchDelta` derives a
   "rating impact" figure the same way. Neither is the engine's number. The
   authoritative `preMatchExpectedScore` and a per-player `ratingDelta` are
   persisted for all 596 rated match events, so this is a read swap.
   One structural consequence needs a product answer, not an implementation
   choice: because K is per-player, a match moves each of the four players by a
   **different** amount, so the current card line ("+X for winners · −X for
   losers") has no v3 equivalent and the card must be redesigned, not renumbered.
   Not fixed inside the Rating Journey task because it spans the Games view as
   well, and a half-fix would put two different expectation figures on screen at
   once. **Recommendation: schedule as its own item before beta review.**
7. **RESOLVED (`19ffe21`) — `computeMonthlyJourney` ran the legacy joint solver.** It restarts
   every player from their tier seed, which v3 does not do — there is one
   continuous rating and no monthly reset. Live in two places: the Monthly Rating
   breakdown modal and the head-to-head month view, the latter still telling the
   reader "Each player starts the month at their tier baseline." These are the
   last screens in the app showing a reconstruction. The four monthly views in
   `monthlyViews.js` already carry the real figures.
17. **APPROVED — Historical Club Adjustment + historical reassessment correction.**
   Shaun confirmed the factual history on 18 Sep 2026. Shaun's 1 Jul C→B was an
   initial-classification error correction with the club assessment **normal B
   baseline = 1400**. Tom's 1 Jul and Fatch's 1 Aug C→B moves were genuine
   promotions and should be processed through the same club reassessment decision
   semantics as future reviews.

   Phase B (`17ed790`) found the statistical recommender returns **no target** for
   Tom/Fatch because too few established C players existed at those dates. This
   is not equivalent to Keep current. The board still has to choose Keep current
   or a Club override. Reliability likewise has no validated automatic
   recommendation and remains a board choice.

   Rather than handle these as a one-off script, CCode is approved to build a
   permanent Admin-only Historical Club Adjustment tool over replay-forward, with
   historical state reconstruction, reason/attribution, blast-radius preview, and
   superseding/correction events rather than silent deletion.


   **Final historical board outcomes confirmed 18 Sep 2026.** Shaun = 1400 at 10% reliability on 1 Jul; Tom = Jords' 1 Jul pre-review Power Rating at 10% reliability; Fatch = Tom's 1 Aug pre-review Power Rating (after Tom's corrected July trajectory) at 10% reliability. Historical writes are now authorised through the audited Historical Club Adjustment path.

8. **Manny is Tier S and is invisible to every tier-scoped view.** Noticed
   while fixing Kings of Tiers: current tiers are A 9 · B 17 · C 7 · **S 1**.
   The Kings panel hardcodes A/B/C and the tier filter offers A/B/C, so Manny
   can never appear in either. Not changed — whether Tier S is a real tier, a
   legacy artefact or a data error is Shaun's call, not an implementation
   detail. **Low urgency, but it should not stay unanswered before beta.**
9. **Match cards changed shape, and Shaun should see it.** A match used to
   report one rating figure: "+X pts for winners · −X pts for losers". In v3
   that figure is true for nobody — K is per-player, so the four players in a
   match move by four different amounts. Cards now list each player's own
   change. This is a visible product change, made because there is no other
   truthful rendering of a per-player model, and the previous number was an
   invention (84 × overperformance) in any case. **Recorded for review, not
   presented as settled.**
11. **Engine precision — needs Shaun/CGPT, because the engine is frozen.**
   Found while building the write path. `applyStateEvent` writes both
   `newReliability` and the exact `effectiveEvidenceAfter` onto every event, but
   when an event is replayed it prefers `newReliability` and inverts it through
   `reliability = e / (e + 10)`. The round trip loses a last bit: evidence of 21
   replays as 20.999999999999996. **It does not change K, does not compound (50
   round trips stay within a billionth), and no current code replays stored
   events** — but it means a replayed document is not byte-identical to the
   stored one, and **replay-forward will replay these documents for real.**
   Proposed fix, one line in `ratingEngine.applyStateEvent`: prefer the exact
   `effectiveEvidenceAfter` over the derived `newReliability` when both are
   present. This changes no mathematics — it picks the lossless of two
   representations of the same quantity — but it is engine code, so CCode has
   recorded it as a passing test (`KNOWN:` in `clubDecision.test.js`) rather
   than applying it. **Decide before replay-forward is built.**
13. **RESOLVED (`8d65edc`) — the beta could not record a new game.**
   `getAllApprovedMatches()` returns the v3 `matches` collection only.
   `approveMatch()` still marks a submission approved in `extraMatchesState`,
   which no longer reaches the rated record. Verified in the browser: a
   submitted game shows as pending, and on approval **disappears from the list
   entirely and is never rated**. The club cannot add a result to the beta at
   all. This is not replay-forward's job — a new match at the end of the
   sequence is forward-only, like a club decision — it needs a match write path.
   Fixed: approving now plans an append through `replayForward.js`, shows which
   players move, and writes on confirmation. Verified end to end.
14. **RESOLVED (`8d65edc`) — the approved hiding of Edit/Delete had never
   happened, and they were worse than inert.** Open Question 2 records Shaun/CGPT approving the hiding of the
   inert controls. The controls are still live. Verified: clicking Delete and
   confirming **persists `deletedIdsState` to shared storage and changes
   nothing** — the match remains, the rating is unchanged, because the legacy
   overlay is no longer applied. Editing likewise persists `matchEditsState`
   that does nothing. Both leave behind state that would desync matches from
   their ratings if any code ever re-applied it. Both paths now refuse and say
   why. Pending submissions keep their controls, because those are not in the
   record.
15. **Node and the browser do not agree in the last bit, and the record spans
   both.** Found by replay-forward's no-op check. The record was seeded from
   Node; replays happen in the browser; their `Math.pow` differs by 1 ULP, so an
   expectation stored as `0.4803169324020399` replays as `0.48031693240203976`.
   Exact-equality verification is therefore impossible across the two. Document
   comparison now treats numbers as equal within a **relative 1e-9** — about
   1.4e-6 at a rating of 1400, five orders of magnitude below the 0.1 the app
   displays. **Recorded rather than buried:** anyone adding a checksum, a
   signature, or a byte-equality check over these documents will hit this.
16. **Open Question 11 is now lower urgency.** Replay-forward routes around it
   by replaying INTENT rather than the recorded values — an event is replayed as
   changing reliability only if it actually did. The one-line engine fix is still
   worth making so other callers cannot hit it, but it no longer blocks anything.
12. **A fourth false statement, now fixed, worth recording as a pattern.** The
   Games view told users a draw "doesn't count as a win or loss for anyone, and
   doesn't affect any rating". Draws are rated in v3 — one moved a player by
   10.25 points. This is the fourth time a retired calculation left its
   sentence behind. Copy that describes engine behaviour should be treated as
   code and checked whenever the engine changes.


---

## 6. HANDOFFS

### CCode — 4 Oct 2026 (Predict a Matchup: More + Matchup Card)

**`acba496` on `app-features-fixes` = `main`.**
- **Prediction (unchanged):** `predictMatchup()` (`features/play/
  fixturesData.js`) → `MatchPrediction.build` (`matchPrediction.js`) →
  `RatingEngine.expectedScore`.
- **Card:** `domain/predictions/matchupCard.js` (pure, `MatchupCard`):
  - `build(pred, {tierOf, typicalGames})` gives the teams, the call,
    `share`, `games {a, b, total}`, `gap` and the wording;
  - `expectedGames` and `summaryText` support it.
- **Screen:** `features/play/predictScreen.js`.
  - `openPredictMatchup()` is Admin-gated. It opens `#predictModal` with the
    same `predA1…predB2` inputs.
  - `matchupCardHtml` mirrors the picture; on screen it adds each player's
    rating and the share and rating edge.
  - Share matchup is `CardPainter.share`, with "Tap to share" and save
    fallbacks. Copy image uses `navigator.clipboard.write(ClipboardItem)`,
    with the blob passed as a promise so Safari counts the tap; otherwise
    it copies the card as text.
  - Add to Upcoming is kept; `wirePredictionToUpcoming(box, after)` now
    redraws the sheet.
  - `typicalMatchGames()` is the median of decided matches.
- **Picture:** `CardPainter.matchup(card)`, 1080 × 1350.
- **More / Manage:**
  - `shell.js`: `MORE_ITEMS` reordered; Predict is `adminOnly` and shown by
    `canSeePredictions()`; North vs South is removed.
  - `manageScreen.js`: the Predict section is removed; a North vs South
    section is added.
- **Unchanged:** Upcoming's prediction fold (`matchPredictionHtml`).
- **Tests:**
  - New: `tests/predictMatchup.test.js` (6). It covers the card data, the
    thresholds, the More order for Admin and player, refusal when locked,
    North vs South in Manage behind the lock, the on-screen card and
    picture, and Share, Copy image and the text fallback. 6 of 6 mutations
    are caught.
  - Updated: four `ui.test.js` prediction tests and one `playFlow` test now
    open the tool from More with the new wording. Their invariants stay:
    the engine's own share, no "chance", and a hedged call when it is
    close.
  - **911 / 911.**

Baton → Shaun / CGPT: try it from More; one note in Section 5.

### CCode — 4 Oct 2026 (Player of the Month nominees picture)

**`69e6640` on `app-features-fixes` = `main`.**
- **`features/review/cardPainter.js`:** `nominees(view, {brand})`. It
  measures, then draws, so the canvas is exactly as tall as the
  nominations; nothing is ever cut.
- **`features/awards/potmScreen.js`:**
  - `potmNomineesView(month, cards)` builds the players' cards (no Admin
    extras).
  - `potmShareCards(month)` uses the finalised shortlist, else Admin's
    current list.
  - `potmShareHtml` / `sharePotmNominees` / `wirePotmShare` reuse
    `CardPainter.share` and the Match Result Card's "Tap to share" handling.
  - `leagueScreen.js` wires the button on League › Information.
- **Tests:** one new test in `tests/playerOfMonth.test.js` (23). It checks:
  - the view: every nominee in name order, the players' version only, and
    an Admin-added nominee's figures;
  - a 1080-wide PNG at least 4:5, with its file name and caption;
  - "Tap to share" re-sharing the same picture, and players sharing the
    finalised shortlist;
  - no button for a month without a list.

  **905 / 905.** Also `010b43b`: four fixture tests read the real clock and turned red on 4 Oct as their September fixtures aged past the 14-day archive window; they now read their stages at the tests' own date (no code change).

### CCode — 4 Oct 2026 (Player of the Month nominations refined)

**`e5f868a` on `app-features-fixes` = `main`.** This builds on `7dca948`.
- **Competition winners.** `potmCompetitionWinners(month)` in
  `features/awards/potmData.js` reads the top of each tier from the tables
  the League screen and the Board Pack already build. It adds no
  calculation:
  - League: `leagueSplitRows` + `sortLeagueRows(…, 'points', true)`.
  - Merit: `MeritTable.build` with `historicalTierOf`.
  - Race: `buildMonthlyRace`, qualified rows only.

  Ties on every key bar the name are joint winners. Tiers follow
  `groupedTiers()`. Each player's `metrics.competitionWins` is
  `[{competition, tier, sharedWith}]`.
- **Domain** (`domain/awards/playerOfMonth.js`, `RULES_VERSION` `potm-2`):
  - `competitionStory` tells one, two ("Month Champion") or three ("Triple
    Crown") wins in one line.
  - The statistical stories now carry a player-centred `line(m, month)`.
  - `cardFor` orders reasons by `REASON_ORDER`, shows 3 and lists the rest
    in `alsoTitles`.
  - `supportLine` gives the four figures; `citationFor` builds the default
    award wording from the top two reasons.
  - `SHORTLIST_COMFORT` (5) only triggers Admin's trim note.
- **Screen** (`features/awards/potmScreen.js`): `potmCardHtml(card,
  {admin})`.
  - Every card leads with a large name and a tier badge, then label +
    sentence per reason, then the figures row.
  - Admin only: "Added by Admin", "Also: …", and the controls as quiet text
    buttons.
  - Players see "September's nominees, in no particular order".
  - Old snapshots render as stored, `evidence` included.
- **Unchanged:** the League, Merit and Race modules, persistence, and
  confirmed awards.
- **Tests:** `tests/playerOfMonth.test.js`, 22 (was 15):
  - the wording, each competition, a combined story with a three-reason
    cap, determinism with no score;
  - the winners against the Board Pack's own tables for September and June
    (Shaun's June Race win in Tier C, Kaz/Len joint);
  - the Admin card against the player-facing card, and an award confirmed
    under `potm-1` still reading as confirmed.

  10 of 10 mutations caught. **904 / 904.**

Baton → Shaun / CGPT: Section 5 (three small calls).

### CCode — 4 Oct 2026 (Player of the Month)

**`7dca948` on `app-features-fixes` = `main`.**
- **Rules:** `assets/js/domain/awards/playerOfMonth.js` (pure, UMD
  `PlayerOfMonth`).
  - `recommend({month, players})`: eligibility (`MIN_MATCHES` 5), six
    stories each with a floor (upsets also need the month at or above
    expectation), leaders with ties kept, next-best fill to three
    (`SHORTLIST_MIN`), alphabetical cards, an empty-state reason, and
    archived qualifiers named.
  - The award record: `finaliseShortlist`, `confirmWinner`, `reopen`.
  - Queries: `history`, `awardsFor`, `awardCounts`.
- **Inputs:** `features/awards/potmData.js`. It reads canonical sources only;
  nothing is recalculated.
  - The League's month gives games and W-D-L.
  - The `MonthlyViews` row gives performance, the rating at the month's
    start and end, play-only change (club decisions taken out), and the tier
    at the month's close.
  - `V3_MATCH_FACTS` gives "beat expectation in X of Y", and underdog wins on
    the Match Result Card's line (`MatchScorecard.STORY`).
  - Storage is the `playerOfTheMonth` collection, one structured document per
    month, read at start-up within the same round trip.
  - Helpers: `potmAwardsFor(name)`, `potmHistory()`, `potmWinnerOf(month)`,
    `potmHeadline(month)`.
- **Screens:** `features/awards/potmScreen.js`.
  - **Admin › Player of the Month** opens on the latest finished month. It
    shows the cards with their reasons and figures, Remove, "Add a qualified
    player", and "Finalise shortlist for the vote" (finished months only).
    Then "Won the vote?", an editable citation, and "Confirm winner" (asks
    first). The owner can "Correct a mistake…". History is at the foot.
  - **League › Information** shows the winner and citation, or the shortlist
    in no order, or "Not chosen yet", plus Past winners.
  - **Profile:** "👑 Player of the Month ×N · Sep 2026".
  - The WhatsApp summary, Board Pack, Share Deck and Home read the confirmed
    award.
- **Tests:** `tests/playerOfMonth.test.js` (15) covers all eleven brief
  cases: eligibility at 5, activity, authoritative figures, play-only rating
  change, month isolation, add/remove, persistence, rule changes, archive,
  empty months and ties. It also checks that nothing reads as a ranking, the
  public shortlist, an unfinished month and the old points leader's removal.
  10 of 10 meaningful mutations are caught. **897 / 897.**

Baton → Shaun / CGPT: try it on a finished month (Admin › Player of the
Month); Section 5 has six small follow-ups.

### CCode — 4 Oct 2026 (player status model + archived players)

**`4cbfeb7` on `app-features-fixes` = `main`.**
- **Model:** `assets/js/playerStatus.js` (pure, UMD): `STATUS`, `LABEL`,
  `statusOf({stored, legacyActive})`, `isLive` (not archived), `isPlaying`
  (active only).
  - Stored as `status` (+ `statusChangedAt`, `statusChangedBy`) on the v3
    player document. `replayForward.js` adds these to `PLAYER_LABEL_FIELDS`,
    so a replay carries them and `verifyNoOp` stays identical.
  - `app.js` sets `p.status` from the record, falling back to the legacy
    tag (`false` → archived), and keeps `p.active = isPlaying(status)`, so
    every existing `p.active` / `INACTIVE_PLAYERS` reader behaves as before
    for temporarily inactive players.
  - `PlayerState` gains `status`: temporarily inactive and archived are both
    participation INACTIVE (never a kind of Idle); labels "Temporarily
    inactive" and "Archived".
- **One live rule:** `livePlayers()` / `livePlayerNames()`;
  `allPlayerNames()` now returns the live list. Applied to "Who are you?",
  the saved viewer (cleared if archived), directory, Compare, Find Game (its
  list now rebuilds on every visit), Build a Match, Home's promotion gap,
  Admin review candidates, Player Packs, and the current Power Rankings.
  New games, requests and agreed fixtures refuse an archived name in words.
- **History untouched:** `PLAYERS` still holds everyone, so matches, Games,
  scorecards, profiles, past months, League/Merit/Race, Rating Journey and
  tier history read as before. No match data, rating input or methodology
  changed.
- **Admin › Player tags:** grouped by status with a pill; per player
  "Mark temporarily inactive" / "Reactivate" / "Archive player" (confirm
  with Shaun's wording) / "Restore player" / "Restore as temporarily
  inactive". The old Active/Inactive toggle is gone. CSV export carries the
  status. Wording "Inactive" alone is replaced by "Temporarily inactive".
- **Tests:** `tests/playerStatus.test.js` (8): defaults and legacy fallback;
  Idle vs temporarily inactive vs archived; status survives replay with
  identical ratings and journey; source guard on the live lists; in the
  browser — archive via Admin (confirm copy, no "delete"), gone from seven
  live surfaces, history identical (rating, match facts, League row,
  journey, records), old result/scorecard/profile still show him, request
  refused, restore without a duplicate; saved viewer cleared; temporarily
  inactive behaviour; monthly non-qualification hides nobody. Four older
  tests updated (labels, and a temporarily inactive fixture player, since
  Del now reads as archived). **882 / 882.**

Baton → Shaun / CGPT: Section 5 (four small follow-ups, nothing blocked).

### CCode — 3 Oct 2026 (Match Result Card + Match Analysis)

**`c6acfd9` on `app-features-fixes` = `main`.**
- **Refactor, not rewrite.**
  - `matchScorecard.js` (domain) gains `resultCard(vm)`,
    `story(vm, hero)` and `STORY`. `build()` is unchanged, as is every
    rating figure it reads.
  - The UI file splits into `matchResultCardHtml` and
    `matchAnalysisHtml` (the old card, with teams named by their players
    rather than "Team 1 / 2").
  - One sheet holds both views: the Result Card first, "View match
    analysis" / "← Back to result", and "Share result".
- **New:**
  - `CardPainter.matchResult(card)`, a 1080 × 1350 picture;
  - `shareMatchResult(id)`, using the existing share-sheet path. It
    offers "Tap to share" when the phone needs a fresh tap.
- **Unchanged:**
  - the rating engine, MatchFacts and the stored data;
  - the entry points (Games card, approval outcome);
  - `scorecardButtonHtml(id)` for reuse (its label is now "🏆 Match
    result").
- **Tests:** `tests/matchScorecard.test.js` (13, up from 9).
  - The Result Card copies the scorecard field for field on every seeded
    match.
  - The story thresholds are tested at their edges, and the values are
    pinned.
  - An unrated card shows no figures; singles wording is covered.
  - **In the browser:** the Result Card first, against the engine
    record; Analysis and back; Share result (one PNG, "Tap to share",
    re-share of the same picture).
  - 19 mutations caught. **874 / 874.**

Baton → Shaun / CGPT: Section 5 (three small calls; defaults in place).

### CCode — 2 Oct 2026 (completed-match scorecard)

**`19662b1` on `app-features-fixes` = `main`.**
- **Data flow confirmed:** submission → admin approval
  (`prepareApproval` → `ReplayForward.plan` append →
  `ReplayForward.commit`) → the match doc and four `MATCH_UPDATE` events
  written → `loadV3State()` → `V3_MATCH_FACTS` rebuilt → the scorecard
  reads it. No step was changed.
- **Historical data audit:**
  - **Already persisted:** everything on the card. That is:
    - the match doc: date, teams, sets, outcome, type;
    - per player per match: pre / post rating, expected, actual,
      residual, K, delta, `tierAtEvent`.
  - **Needs new snapshot persistence:** nothing.
  - **Reconstructed:** game share and games, from the stored sets via
    `RatingEngine.gameShares`; the game type, from the recorded tiers via
    `GameType.classify`.
  - **Unsafe to infer, so never inferred:**
    - an expectation from today's ratings;
    - a tier from today's tiers;
    - any figure for an unrated match.
  - **Tiers:** `tierAtEvent` and `historicalTierOf` agree on all 596
    seeded and 704 live events. The existing tier history already solved
    the tier requirement; the card reads the event's own tier first.
- **Verified on the live snapshot (30 Sep, read-only):**
  - 176 / 176 matches are rated;
  - expected, actual (from each match's own sets and outcome), residual
    and movement reconcile with 0 mismatches;
  - pp is within 0.1 of the stored residual.
- **Changed:**
  - `matchFacts.js` also carries `tierAtEvent`;
  - the Games card's expanded detail opens the scorecard;
  - the approval outcome carries the new match's scorecard, and stays
    visible when the pending list empties;
  - CSS lives in `components.css` (`.msc-*`).
  - The rating engine, the store and replay-forward are untouched.
- **Tests:** `tests/matchScorecard.test.js` (9).
  - On every seeded match, it checks expected, actual, pp, movement, K ×
    residual and the tiers against the engine.
  - **Stability:** a replay of the first 40 matches gives identical cards.
  - Unrated and misaligned facts are not displayed against the wrong team.
  - **No parallel calculation:** a source guard.
  - **In the browser:** the Games scorecard; approval → scorecard; the
    fallback tier.
  - 10 mutations caught. **870 / 870.**

Baton → Shaun / CGPT: Section 5 (scale and the older Games label).

### CCode — 1 Oct 2026 (desktop-friendly dashboard)

**`269327c` on `app-features-fixes` = `main`.**
- **New files:**
  - `assets/css/layout/desktop.css`, loaded last; the architecture test
    allows it after the screens;
  - `assets/js/ui/desktopShell.js` (`LAYOUT_RANGES`, `layoutForWidth`,
    `initDesktopShell`, `syncDesktopShell`, Escape handling).
  - `shell.js` calls `syncDesktopShell()` on navigation and
    `initDesktopShell()` once.
- **Markup touched:**
  - Home's blocks are wrapped in `.home-block-*`;
  - the Board Pack and Player Pack wrap editor and preview in `.bp-split`
    while the preview is open.
  - Both are `display: contents` on a phone.
- **Two CSS fixes desktop needed:**
  - `body { overflow-x: clip }` from 768. `hidden` made the body a scroll
    container that never scrolls, so nothing could be sticky.
  - `.admin-acc { overflow: clip }` from 1200, for the same reason.
- **Tests:**
  - `desktop.test.js` (8): overflow at 1024 → 2560 on 11 screens; rail
    vs bottom bar; same routes as the phone; dialogs and Escape;
    Rankings pairing; Players master-detail and sticky pane; Play and
    Home grids; Board Pack and Player Pack split, plus phone wrappers.
  - `preview.test.js`: desktop presets.
  - The harness gains a `viewport` option.
  - All fail on `8854107` except the no-overflow invariant; 9 mutations
    caught. **861 / 861.**
  - Behaviour snapshot at 390 and 360: identical apart from Home's six
    `display: contents` wrappers. Every existing element's style and box
    is identical.
- **To check:** a real laptop and monitor (Chrome, Safari, Firefox).
  `overflow: clip` and `:has` are not used for anything a phone needs.

Baton → Shaun / CGPT. Deferrals and Me: Section 5.

### CCode — 1 Oct 2026 (Board Pack split by tier)

**`382f907` on `app-features-fixes` = `main`.**
- **Options:** `SPLIT` (`split` | `one`, default split) on
  `results_table` (which also gains `tier`) and `power`. `SLIDES`
  (`each` | `leaders`, default each) on `league`, `merit` and `race`.
  Saved packs take the defaults for the new keys.
- **Data:** `boardPackSplit(o, rows, tierOf)` returns `{ split, tiers,
  rows, sHidden }`. A single list is one section with `tier: null`.
  `results_table` uses `leagueSplitRows` when split.
- **Slides:** `ShareDeck.slidesFor` (several slides per module);
  `slideFor` is now its first. `perTier`; tier slide ids are
  `<module>:<tier>`.
- **Tests:**
  - per-tier canonical checks, a mid-month mover (simulated in the page:
    the seeded record has none), options and defaults, per-tier slides,
    and the Tier S rule;
  - existing tests updated for split defaults and per-tier slide ids.
  - All new ones fail on `abc34d5`; 8 mutations caught. **852 / 852.**
  - Snapshot: only `manage-admin` differs (new options).

Baton → Shaun / CGPT. One call to confirm (Section 5): the Tier S switch
in split lists.

### CCode — 1 Oct 2026 (save a whole pack)

**`d74d466` on `app-features-fixes` = `main`.**
- `features/review/pdfDoc.js` (pure, UMD): `PdfDoc.build(pages, { title })`
  writes PDF 1.4 with one JPEG image per page. Pages are 0.5 pt per px
  (1080 px is 540 pt) and the title is UTF-16.
- `CardPainter.toPdf(canvases, name, title)`.
- `boardPackShareFiles(makeFiles, label, title)` is the one share/save
  path for pictures and PDFs. `boardPackShare` wraps it.
- Club: `boardPackAllSheets`, `boardPackContentsSheet`,
  `boardPackPackPdf`, `boardPackSlidesPdf`, `boardPackPackPictures`.
  Player: the same three in `wirePlayerPacks`. Shared row:
  `bpSaveAllHtml`.
- **Tests:** `pdfDoc` (3) and `savePack` (3, browser), covering all six
  buttons, file names, page counts and sizes, the share sheet, the
  visibility filter, and no writes.
  - `tests/helpers/pdfInspect.js` reads the files back. During
    development pypdf also opened every PDF in strict mode, and the page
    pictures decoded correctly.
  - All fail on `fe9e8b1`; 7 mutations caught. **849 / 849.**
  - Snapshot: only `manage-admin` differs, by the new row.
- **To check on a phone:** "Slides as PDF" into WhatsApp from iPhone and
  Android.

Baton → Shaun / CGPT.

### CCode — 1 Oct 2026 (Board Pack: losing modules)

**`337c70e` on `app-features-fixes` = `main`.**
- **Catalogue:** `over_80` retitled (winners only); new `lost_pct` and
  `worst_record`. The club catalogue is now 23 modules.
  - The modules share `THRESHOLD` / `PCT_MIN` option definitions.
  - `splitFrom` on a catalogue module places it after its parent in a
    pack saved before it existed, copying the parent's on/off state and
    options. Any other new module still arrives off, at the end.
- **Data:** `boardPackThreshold(month, o)` serves both threshold modules.
  `monthlyInformation` gains `highestLossPct`; its existing lists are
  unchanged.
- **Pictures:** `CardPainter.save` is async, 250ms between files, and
  `share()` awaits it.
- **Tests:**
  - canonical: lost_pct against a tally from the approved matches at
    every threshold and minimum; worst_record's every value and order;
  - browser: separate thresholds set in the UI, the report, the deck and
    the saved options;
  - config: the split migration;
  - slides;
  - 14 pictures saved without loss.
  - All fail on `6520a04`; 9 mutations, all caught. **843 / 843.**
  - Snapshot against `d6e4ae1`: 37 of 38 identical; `manage-admin`
    differs by the module list.

Baton → Shaun / CGPT. One small question (Section 5): retitle
Information's "Lowest win % (highest loss %)".

### CCode — 1 Oct 2026 (Player Monthly Packs)

**`d6e4ae1` on `app-features-fixes` = `main`.**
- **Architecture:** built on the Board Pack and Share Deck; no new stats
  engine.
  - `boardPackConfig.js`: the catalogue functions are now
    `forCatalogue(MODULES)`. The club catalogue is unchanged (21
    modules); `BoardPack.PLAYER` is the player catalogue (8 modules).
  - `domain/playerPack/playerMonth.js` (pure): `teamLabel`, `side`,
    `build`, `bestResults`, `weakerResults`, `targets`.
  - `domain/playerPack/playerDeck.js` (pure): player slides in the Share
    Deck shape, with a player cover and closing.
  - `features/admin/playerPackData.js`: `playerMonthlyPack`,
    `playerPackSources`, drafts storage, tokens,
    `publishPlayerPack` / `unpublishPlayerPack`.
  - `features/admin/playerPackScreen.js`: the Player packs view. The
    module editor is shared with the club pack (`wirePackEditor`).
  - `review/review.js`: `?p=<token>`. `DeckView` and `CardPainter` take
    the player's cover and closing. `ShareDeck.summaryText` takes the
    deck's title and link label.
  - `fsGetIn` / `fsSetIn` for the `playerPacks` collection.
- **Selectors reused, not re-implemented:** `computeMonthlySummaryStats`,
  `leagueSplitRows` + `sortLeagueRows`, `MeritTable.build` (positions and
  each win's hard / even / favoured), `buildMonthlyRace`,
  `MonthlyViews.playerMonth`, `V3_MATCH_FACTS` (rating change and
  performance), `buildPartnerships` (chemistry), `getAllApprovedMatches`,
  `historicalTierOf`.
- **Composition and target rules:** Section 3 (Decisions). Targets, in
  order: rematch (an opponent met 2+ times, within one result); partner
  (2+ together, more wins than losses); thin evidence (a matchup type
  played once); own tier (fewer than half of 3+ matches all in the
  player's tier). Each carries its reason and sample.
- **Storage:** drafts in `moneypadel_player_packs_YYYY-MM` (every
  player's choices and the token index), saved as you go. Published packs
  in `playerPacks/<token>`, a snapshot with revisions.
- **Found and fixed on the way:** the first draft's autosave never
  wrote. Its timer cleared its own handle before saving. The Generate-all
  test caught it.
- **Tests:** `playerMonth` (8) and `playerPack` (7, browser), covering:
  - scoping and W-D-L reconciliation against the club's tables, for every
    player in August and September;
  - perspective and mid-month tier change;
  - Generate all, saved drafts, publish, republish and unpublish, and
    Admin-only refusals;
  - the private link, and wrong, guessed and withdrawn tokens;
  - snapshot stability, no referrer, the visibility filter;
  - the 375px deck, pictures, sample counts and no forecasting language;
  - calculations unchanged.
  - All 15 fail against `501bc8f`; 14 mutations, all caught.
  - **839 / 839.** Behaviour snapshot against `501bc8f`: 37 of
    38 states identical; `manage-admin` differs only by the new Club pack
    | Player packs switch.
- **To check on a phone:** opening a pack link from WhatsApp.

Baton → Shaun / CGPT. One decision for Shaun: the Firestore rule
(Section 5).

### CCode — 1 Oct 2026 (Board Pack options, autosave)

**`f58ec1d` on `app-features-fixes` = `main`.**
- **Threshold:** `over_80` keeps its id, so saved packs still match, and
  gains a `threshold` option.
- **Power Rankings:** `power` gains `min` and `players`. The state is
  `playerStateOf(name, end of month)`.
- **W-D-L:** best win % and partnerships.
- **Autosave:** `boardPackQueueSave` / `boardPackSaveNow`, with a 600ms
  debounce.
  - The section is not redrawn on save, so a note keeps its focus.
  - A pending change is flushed before the month changes.
- **Tests:** 3 new browser tests, plus extended config and canonical tests;
  all mutation-checked. **823 / 823.**

Baton → Shaun / CGPT.

### CCode — 1 Oct 2026 (Tier S sections; pictures)

**`6f40764` on `app-features-fixes` = `main`.**
- **Tier S:**
  - `tierSSectionsShown()` and `groupedTiers()` in `permissions.js`,
    stored as `tierSSections` in the visibility document;
  - used by `leagueScreen` (League, Merit, Race), `rankingsChrome`
    (Kings) and `boardPackData`.
- **Pictures:**
  - `features/review/cardPainter.js` (`slide`, `sheet`, `share`, `save`);
  - Board Pack renderers refactored to `boardPackBlocks()` plus
    `bpBlocksHtml()`, with unchanged HTML; `boardPackSheet()`;
  - `wireBoardPackPictures()`.
  - **Share-sheet detail:** a share sheet must open from a tap. If
    preparing the pictures used the tap up (iPhone), the section offers a
    one-tap **Share** with the pictures ready.
- **Tests:** `tierS` (1) and `pictures` (4), all mutation-checked.
  - The snapshot against `470ef73`: 37 of 38 identical; `manage-admin`
    differs by the new switch.
  - **820 / 820.**
- **To check on a phone:** sharing pictures to WhatsApp, on iPhone and
  Android. Headless tests cover the share sheet only with a stand-in.

Baton → Shaun / CGPT.

### CCode — 30 Sep 2026 (Monthly Review: Unpublish, Kings tiles)

**`a5cbe84` on `app-features-fixes` = `main`.**
- **Unpublish:**
  - `ShareDeck.withdrawal` / `isLive`;
  - `unpublishBoardPackReview` (Admin only);
  - three publish states in the section: Draft, Published and
    Unpublished;
  - the public page's "no longer available".
  - No document is ever deleted, and a test checks that.
- **Kings tiles:**
  - Share Deck slides carry `layout: 'kings'`, and `DeckView` draws the
    crowned grid.
  - The Board Pack report reuses the Rankings `.kings-card` markup.
- **Tests:** 5 new (2 pure, 3 browser), plus the Board Pack Kings tiles
  in the canonical test. All mutation-checked. **815 / 815.**

Baton → Shaun / CGPT.

### CCode — 30 Sep 2026 (Monthly Review Share Deck)

**`4af924d` on `app-features-fixes` = `main`. Nothing on
`ux/player-reset-v2`.**
- **New files:**
  - `domain/boardPack/shareDeck.js`: slides, summary and publication.
    It is pure.
  - `features/review/deckView.js`: the drawing, shared by the Admin
    preview and the public page.
  - `assets/css/screens/review.css`.
  - `review/index.html` and `review/review.js`.
- **Changed:**
  - `boardPackData.js`: `boardPackDeck`, `publishBoardPackReview` and the
    review URL and summary.
  - `boardPackScreen.js`: the preview mode, publish, and share.
  - `firebaseData.js`: `loadPublishedReview` and `savePublishedReview`.
  - The test harness: it can open another path, wait on a ready signal,
    emulate a 375px touch phone, and serve a folder's index.
- **For the redesign stream:** a redesigned screen can consume the same
  things.
  - `boardPackDeck(config)` gives a month's slides.
  - `DeckView` draws them.
  - The slide shape is documented in `shareDeck.js`, with room for later
    slide kinds (Moment of the Month, photos, season recap, awards).
- **Tests: 14 new.** 6 are pure (`shareDeck`) and 8 run in the browser
  (`review`). They cover:
  - selection and order to slides, and the preview being what is
    published;
  - canonical figures and the summary for every month;
  - draft, publish, edit and republish, with the link changing only on
    Publish;
  - the direct link for each month;
  - no Admin control and no stats engine on the public page;
  - at 375px: no overflow, no clipping, and 4:5 cards;
  - buttons, dots, keys, and a sideways scroll gesture;
  - the stored slides shown verbatim;
  - unpublished and bad links;
  - Admin-only sections hidden.
  - All fail on the old code. Five deliberate breakages were each caught.
  - **Limitation:** headless Chromium here cannot synthesise a touch
    scroll. The swipe is tested as a sideways trackpad gesture on the
    same native scroller.
- **Behaviour snapshot against `b1dc91a`:** 37 of 38 states are
  identical. `manage-admin` differs only by the section's publish block.
- **Full suite: 810 / 810.**
- **For Shaun (Section 5):**
  - Are predictable review links acceptable? The recommendation is yes,
    while the app is open.
  - Image export is the next sub-increment.

Baton → Shaun / CGPT.

### CCode — 30 Sep 2026 (Board Pack: results table and over-80%)

**`e666a96` on `app-features-fixes` = `main`.**
- **Shaun asked** that the pack cover, for any month: games played,
  wins, losses, points (3 / 1 / 0), most difficult games, and anyone who
  won or lost more than 80%.
- **Already covered:** the League module (split by tier) and the top 3
  hardest games in Monthly Information.
- **Added:** the **Monthly results table** and **Won or lost over 80%**
  modules (Section 1).
- **Tests:** P / W / D / L / Pts are checked against a tally taken
  straight from the month's approved matches, not only against the
  function that feeds the module. 796 / 796.
- **Checked against a read-only pull of the live beta (30 Sep):**
  - **September:** 55 games, 9 draws, 27 players. Nobody with 3+ games
    passed 80% either way. With every player included, Omar won 1 of 1
    and Tee lost 1 of 1.
  - **August:** Erf won 5 of 6 (83.3%) and Shaun lost 5 of 6 (83.3%).
- **For Shaun:** is the 80% line strictly "more than"? Exactly 80% (4 of
  5) is not flagged today; that is a one-word change.

Baton → Shaun / CGPT.

### CCode — 30 Sep 2026 (Admin Monthly Board Pack)

**On `app-features-fixes` = `main`, `9e4a5e6`. Nothing on
`ux/player-reset-v2`.**
- **New files:**
  - `domain/boardPack/boardPackConfig.js` holds the stored choice. It is
    pure and extensible: a module added later arrives switched off, and
    an unknown id is kept.
  - `features/admin/boardPackData.js` holds what each module shows, the
    save path (Admin only) and the record fingerprint.
  - `features/admin/boardPackScreen.js` holds the section and the
    preview.
  - `features/rankings/monthlyStoryData.js`.
- **Selectors extracted, with the screens now using them:**
  - Information and the Power Rankings stories;
  - the Rankings podium and Kings, via `rankingPool` / `kingsOfTiersFor`;
  - the League's By tier rows.
  - **Proof:** 37 of 38 snapshot states are identical to `21a2de2`;
    `manage-admin` differs only by the new section.
- **Storage:** `moneypadel_board_pack_YYYY-MM`, one document per month,
  read lazily. It holds only the choice, the stamp and the fingerprint.
- **Tests: 15 new.**
  - `boardPackConfig`: 9.
  - `boardPack`: 6, in the browser. They cover:
    - Admin-only access, and no read at start-up;
    - month choice, select / deselect, ordering, options and commentary;
    - the saved pack reloading exactly;
    - the drift warning;
    - a canonical-source proof against the screens' own functions for
      every month (podium, Kings, the Information tab's text, the
      stories, League, Merit, Race, Doughnuts, the game count, tier
      changes);
    - historical tiers: Fatch is Tier C in July's pack and B today;
    - month scoping, and Form at the month's close;
    - no effect on ratings, League, Merit or Race.
  - All 15 fail on the old code. Five deliberate breakages were each
    caught.
  - **Full suite: 795 / 795.**
- **Recorded:** Shaun's "Accept all" (Section 3; DQ1 resolved). The
  redesign follow-ups are queued in NEXT, not started, per the brief.
- **For Shaun:** the finalise / snapshot question, and the stats left out
  (Section 5).

Baton → Shaun / CGPT.

### CCode — 30 Sep 2026 (Player Experience Reset: Phase 2 Play)

**On `main`, the functional side:**
- **`7d70cc0`:**
  - DQ6 in `FixtureFlow.setCourtBooking`, with the old "only an admin
    books" assertion updated deliberately and 4 tests;
  - DQ9 in `createRequest`;
  - `domain/fixtures/playView.js`;
  - `playActionCount` = `needsYou.length`.
- **`86beb59`:** `submitGameRequest`, the one path for a request. The old
  form uses it and behaves identically.
- **`5264d3e`:** the snapshot tool treats My Games, Club and their sheets
  as chrome.
- **Tests:** 12 new; 780 / 780.

**On `ux/player-reset-v2`, `6291cdc`:**
- **`features/play/playScreens.js`:** My Games, Club, the game sheet, the
  DQ6 confirmation and the toast.
- **`features/play/arrangeScreen.js`:** Arrange a Game.
- **The shell:** shell screens generalised from Me; Play's switch and the
  Arrange button; history carries which screen you are on.
- **`fixtureCardContext()`:** factored out of Upcoming so the sheet builds
  cards exactly as Upcoming does.
- **Home's Match ideas buttons** open Find a Game directly.

**Tests:**
- The D4 Play tests now reach Find a Game through Arrange a Game. They
  also check My Games, Arrange and the game sheet for prediction leaks.
- 9 new in `playScreens`, including a player's booking (attributed and
  saved), the button saying what is missing, visibility, Back and 44px.
  Two guards were checked by breaking them.
- **816 / 816.**

**Proof of no change to existing screens:** the content-only snapshot is
identical in all 38 states at 390px and 360px. Screenshots at 375px were
checked, and Club's counter labels were fixed to wrap rather than
truncate.

**For Shaun:**
1. **Accept the new Play lists?** Then CCode removes "Upcoming, as
   before" and "Requests, as before".
2. **Phase 3a (Home) needs DQ1** (promotion as a goal) and its
   go-ahead. The recommendation is no progress bar or threshold line:
   keep today's one-line gap, worded as "N pts below the lowest-rated
   Tier A player", because tiers are board decisions, not rating
   thresholds.

Baton → Shaun.

### CCode — 30 Sep 2026 (Player Experience Reset: Phase 1 shell)

**On `main` (functional side), `a3f6939`:**
- **`playActionCount(viewer, now)`** in `features/play/fixturesData.js`,
  with 6 tests built from real `FixtureFlow` fixtures.
- **`scripts/behaviour-snapshot.js` + `behaviour-diff.js`:**
  - the harness, now committed;
  - More-free states;
  - `MODE=content`;
  - a state is "skipped" only when its own setup fails, and a failed
    capture always counts as a difference.

**On `ux/player-reset-v2`, `0772379`:**
- **`shell.js`:** five tabs, Me, the segmented section control
  (`role=tablist`, arrow keys, 44px), More tables and the badge.
- **`features/me/meScreen.js` + `screens/me.css`.**
- **`ui/shellHistory.js`:** system Back.
- **`assets/icons/me.svg`.**

**Two ordering bugs, caught by the new Back test and fixed before commit:**
- A screen that redraws itself (Me) queued the sheet observer ahead of
  its own history entry.
- Opening Home and its Full Review in one step recorded only the review.

Both are now covered.

**Tests moved to the new routes in the same commit:**
- `auditFixes`: More → More tables. With Power hidden, Rankings now lands
  on This Month, where it used to land on Win / Loss.
- `buildStamp`, `doughnuts`, `drawOutcome`, `ui` (the Guide from Me) and
  `designFoundations` (the shell may now fetch its own fonts; screen
  content still uses none).

**Proof of no screen change:** the content-only snapshot, identical in all
38 states at 390px and 360px. Screenshots at 375px were checked.

**Needs Shaun for Phase 2 (Play):** DQ6, DQ7, DQ8 and DQ9 (Section 5). The
recommendations:
- a participant **may** record "Court booked", attributed and
  reversible by an Admin (DQ6);
- replacement stays Admin-only (DQ7);
- no player "Change plan" in Phase 2 (DQ8);
- a plain request may carry an optional time and venue (DQ9).

Baton → Shaun.

### CCode — 30 Sep 2026 (Player Experience Reset: Phase 0 foundations)

**`cd844f6` on `ux/player-reset-v2`.** 780 / 780 tests there (18 new in
`tests/designFoundations.test.js`). `main` is unchanged at 762.

**Built:**
- **`tokens.css`:** new tokens (above) and ten `@font-face` rules.
- **`assets/fonts/`:** the WOFF2 files and OFL licences, from Fontsource
  5.3.0 via npm.
- **`components.css`:** a "Redesign primitives" section.
- **`ui/components/primitives.js`:** the helpers. They are loaded before
  `app.js` and reuse the app's `escapeHtml`.
- **`docs/design/primitives.html`**, the reference page.

**Proof of no change:**
- **The snapshot:** the 39-state snapshot, taken before and after on the
  branch, is identical at 390px and 360px.
- **The tests:** they fail if a Phase 0 rule styles an existing selector,
  if any token is declared twice, or if the app downloads a font or
  renders anything in a new family. Each was checked by deliberately
  breaking it.

**Worth knowing:**
- **Instrument Serif lacks tabular figures.** It was checked in the font
  files; the map's fallback is applied and recorded in the Decisions Log.
- **The snapshot tool lives only in CCode's scratchpad.** It is not in the
  repo, yet every later phase's acceptance line relies on it.
  - **Proposal:** commit it on `main` as `scripts/behaviour-snapshot.js`,
    with its diff tool.
  - It is a shared dev tool, so it needs no product decision. CCode will
    do it with Phase 1 unless told otherwise.
- **On the branch's Vercel preview:** `/docs/design/primitives.html` shows
  the set. `/preview` frames the app, which should look unchanged.

Baton → Shaun for the **Phase 1 (Shell)** go-ahead.

### CCode — 30 Sep 2026 (Ledger CCode: idea backlog; map follows the presentation decisions)

Reconciled Shaun/CGPT's `1c824cc` (the backlog convention) and `90e240a`
(the presentation decisions).
- **Phase 0 is unblocked but not yet given its go-ahead,** so CCode did not
  start it (NEXT).
- **The one approved, unblocked CCode item was the backlog.**

**`8b7657b`, documentation only:**
- **`docs/product/IDEA_BACKLOG.md` + `IDEA_TEMPLATE.md`:** usage note,
  statuses, and the promotion rule that an entry never authorises work and
  CCode never marks one Approved.
- **The backlog's contents:** three genuine ideas (IB-01, IB-02, IB-03)
  and a pointer table to Ledger items, which keep their Ledger status.
- **Kept out:** approved or delivered features (the Monthly Race trial,
  the redesign phases).
- **The design map:** marks DQ2, DQ5, DQ11, DQ20, DQ24, DQ29, DQ30 and
  DQ31–33, and the Kings basis, as resolved.
  - Only Shaun's DQ1, DQ6, DQ7, DQ8, DQ9, DQ10, DQ15 and DQ26 remain open.
  - Phases 0, 1 and 4 now show no open blocker.

**No code changed; 762 / 762.** `ux/player-reset-v2` is fast-forwarded to
`main` again.

Baton → Shaun.

### CCode — 30 Sep 2026 (redesign branch created; DQ3 confirmed)

**On Shaun's go-ahead:**
- **Branch:** CCode created `ux/player-reset-v2` from `f75a493` and merged
  `main`, which was a fast-forward to `b4e57e4`. It is pushed and
  identical to `main` for now.
- **Untouched:** `app-redesign`. It holds nothing of its own, and Shaun
  can delete it.
- **Vercel:** will give the branch its own preview deployment.
- **DQ3:** Shaun confirmed it. The Decisions Log, the map (Sections 0.2,
  0.4, 5, 6 and 7) and NEXT are updated.

Baton → CGPT for:
- DQ31–33, and DQ20 / DQ5 / DQ29, which block Phases 0 and 1;
- then Shaun's approval of the Phase 0 brief.

### CCode — 30 Sep 2026 (Ledger CCode: redesign setup and the map reconciliation)

The Ledger (Shaun/CGPT's `0b3322f`) gave CCode two tasks.

**1. Create `ux/player-reset-v2` from `f75a493` and merge `main`: NOT
DONE.**
- This session's permission check refused creating the shared branch.
- Nothing was created or pushed, and CCode did not look for a way round.
- Section 5 has the two ways to unblock it.
- `app-redesign` is untouched.

**2. Reconcile the design map to the approved IA: DONE (`cf72a14`).** It
is documentation only, committed on `main`, so every agent reads one copy
and the branch inherits it.
- **New Section 0:**
  - the target IA per tab;
  - which DQs it settles: DQ3, DQ4, DQ18, DQ19, DQ21 and DQ22;
  - three new questions for CGPT: DQ31, DQ32 and DQ33;
  - one confirmation for Shaun: Power stops opening on the month-end view.
- **Areas 4.1–4.17:** each carries an IA note, and Home's Change list is
  re-ordered to be hero-led.
- **Section 5:** every current destination has an IA home, including Find
  a Game, the Requests entries, Match Ideas, Last 10, Kings, month-end
  Power and the Monthly Snapshot.
- **Section 7:** the phases are re-cut, and 7.1 gives each an acceptance
  line.
  - Phase 2 gains Arrange a Game.
  - Phase 3 splits into 3a (hierarchy) and 3b (hero visual).
  - The preview route is the visual check.

**No code changed; `main` is at 762 / 762.**

Baton → Shaun / CGPT.

### CCode — 30 Sep 2026 (Vercel is the primary host)

**`f98b99e`:** comments only, so no behaviour or configuration changed.
- `_config.yml` now says it exists for Pages compatibility.
- `scripts/stamp-build.js` says it is the canonical stamp, for production
  and every branch preview.
- The split document's sync rule names Vercel.

**Checked:**
- No absolute paths in `index.html`, the JS, the CSS or `preview/`, so
  Vercel root hosting needs nothing.
- `vercel.json` is unchanged since the preview.
- Build-stamp tests: 24/24.

**Kept for Pages, since it costs nothing:**
- the Jekyll stamp template;
- the preview's repo-path handling.

**Process change for CCode:** after a push, the check is now the Vercel
deployment rather than the Pages run. CCode cannot see Vercel yet (Section
5), so until it has a URL, a push is verified by the suite alone.

Baton → Shaun.

### CCode — 30 Sep 2026 (desktop phone preview)

**`8e1c91e`: 762 / 762 tests.** 10 are new in `tests/preview.test.js`, 5 of
them in a browser.

**Built:**
- **`preview/index.html`, `preview.js` and `preview.css`,** standalone.
  - A toolbar with 375 / 390 / 412, Rotate, Refresh and Open full size
    (a new tab on the normal app URL).
  - A thin rounded bezel on a dark surround. No fake status bar or browser
    chrome.
  - The app URL is worked out from the page's own path: `/` on Vercel and
    locally, `/<repo>/` on Pages.
- **`vercel.json`:** one redirect, `/preview` → `/preview/`. The build
  command and framework are unchanged; the build-stamp test still passes.

**Verified:**
- **Browser tests** serve the site at `/` and below `/MP-Dashboard-Beta-v2/`,
  without the trailing slash, as Vercel may serve it. They check:
  - the frame holds the app route and never the preview;
  - the preview page was fetched once;
  - the app's `innerWidth` / `innerHeight` / layout width are exactly
    390×844 by default, 375×812 and 412×915 on the presets, and 844×390
    when rotated;
  - it resizes in place, with no reload;
  - a 1280×640 window scales the device to fit while the app stays 390 wide;
  - a phone-sized window gets the link and no iframe, and the app is not
    loaded behind it.
- **The tests catch real breakage:**
  - pointing the frame at the preview fails them;
  - so does removing the scrollbar fix. For that one, the tests launch
    Chromium with real scrollbars, because headless hides them. Without the
    fix the app lays out at 375 inside a 390 frame.
- **Screenshots** at 1440×1000, 1280×720 (shown at 72%), 412, landscape and
  a phone all look right.

**Not verified:**
- a live Vercel deploy (none exists from CCode's side);
- Pages, which is still not building (Section 5).

Baton → Shaun.

### CCode — 30 Sep 2026 (parallel-development split; redesign branching point)

**`f75a493`: 752 / 752 tests** (245 browser). There are 14 new tests:
- 8 in `tests/gamesFilter.test.js`;
- 6 in `tests/architecture.test.js`.

**Done, in the order the brief set (A → E), one commit per step, each
pushed only once verified:**
- **Proposal:** `0b9c9eb`. Hotspots and the proposed map.
- **Two test fixes:**
  - `8dd9edd` pins the Club Pulse test's clock. It started failing on
    30 Sep as the record aged, on the old code too.
  - `fce3fe8` makes the source guards scan every application script, so
    the moves could not switch them off.
- **A (`8437d48`):** Games filtering and the player record move into
  `domain/matches/gamesFilter.js`, behind a view-model
  (`filteredGames`, `playerRecord`, `getFilteredGamesViewModel`).
- **B1–B9 (`24bf191` … `003c7bc`):** every screen renderer, data helper and
  component moves out of `app.js` / `shell.js` into `data/`,
  `features/<area>/` and `ui/`, unchanged.
- **C (`9961823`):** `app.css` split into base / components / shell /
  `screens/*`. All 827 rules are accounted for, and the two
  `.rating-big` / `.rating-sub` rules sit in `components.css` so the
  cascade is unchanged.
- **D/E (`f75a493`):** `tests/architecture.test.js` and the final record,
  including ownership, view-model boundaries and the sync rule.

**Verified at each step:**
- a 39-state DOM plus every-computed-style snapshot, identical against
  `0b9c9eb`, at 390px (and at 360px for the CSS);
- the full suite.

**One real defect was caught along the way and never shipped.**
`CHALLENGE_RESTRICTIONS` spreads `TIER_ORDER_LIST` at load time, so moving
it ahead of `app.js` threw on load. It stays in `app.js`, and the
architecture test now catches the pattern.

**Deliberately not moved:**
- the router;
- per-screen month state;
- `CHALLENGE_RESTRICTIONS`.

The reasons are in Section 2.3 of the split document.

**Not done, per the brief:**
- no redesign;
- no branch created.

Section 5 has the one decision.

Baton → Shaun.

### CCode — 29 Sep 2026 (build stamp on Vercel)

`fa60180`. **738/738 tests** (9 new in `tests/buildStamp.test.js`; 245 of the
738 are browser tests).

**Finding.** The in-app indicator was GitHub Pages-specific.
- Its only source was `{{ site.github.build_revision }}` in
  `buildInfo.pages.js`, rendered by Pages' Jekyll run.
- On Vercel it would have served the committed placeholder, and every
  device would have read "local build / Build dev". That is safe but never
  correct.
- `buildStamp.js` itself was always host-neutral: it formats whatever
  `window.MP_BUILD` holds.

**Change.**
- `vercel.json`: no framework preset, and a build command,
  `node scripts/stamp-build.js`.
- **The script writes the same line the Pages template renders:**
  - from `VERCEL_GIT_COMMIT_SHA`, or `MP_BUILD_SHA` for any other host;
  - dated Europe/London, as Pages is;
  - into the deploy's own copy of `assets/js/buildInfo.js`.
- **Without a believable SHA it writes nothing and fails nothing.** A test
  runs it with no SHA and proves the committed placeholder is untouched.
- `_config.yml` keeps `vercel.json` out of the Pages site.

**Verified.**
- **Vercel:** a clean export of the repo, running the exact `vercel.json`
  build command with `VERCEL_GIT_COMMIT_SHA` set, changed only
  `buildInfo.js`. It stamped `751c161 · 2026-09-29`.
- **Pages:** a local github-pages 232 build still renders the stamp
  (Jekyll's `build_revision`). `vercel.json` is not published, and
  `index.html` and `buildStamp.js` are byte-identical.
  - The GitHub metadata plugin was pointed at an unreachable local API,
    because this sandbox's proxy forbids that GitHub endpoint.
- **In the app:** Admin / Manage renders a Vercel-stamped build exactly as a
  Pages one: "Money Padel Beta · 26 Sep 2026 / Build a4c91e2".

**Not verified:** a live Vercel deploy. None exists from CCode's side.
Section 5 lists the one project setting it depends on.

Baton → Shaun / CGPT.

### CCode — 29 Sep 2026 (Games: one player's filtered record)

`d348c56`. **729/729 tests pass** (12 new, `tests/gamesRecord.test.js`;
244 of the 729 are browser tests).
- **Verified against the old code:** 9 of the 12 fail. The other 3 are
  invariants that hold either way: no record without exactly one player,
  nothing else changes, and matchup notation is unchanged.

**How it reconciles.**
- `renderGamesTab()` already built one array, `display`, after month, game
  type and player. The rows are drawn from it.
- `gamesFocusRecord(display)` counts that array and nothing else, so P equals
  the number of rows by construction.
- Each result comes from `MatchOutcome.outcomeFor`:
  - a draw is checked first;
  - otherwise the stored side decides, which is correct for a decided match.
- The player is found by canonical id (`playerIdFor`), as the filter finds
  them, so a renamed player's games are all counted.
- A source test pins that the function reads no rating, table, race or match
  collection, and is handed `display` itself.

**What the tests prove, on the seeded record:**
- One player shows the record; none, or a group, does not.
- P / W / D / L equal the rendered rows, checked row by row against the
  stored matches.
- The win % is correct.
- Each month's record matches its rows, and the months add back up to All
  time.
- Each tier matchup's record matches its rows.
- The busiest player + month + matchup combination equals the three-way
  intersection computed from the record.
- Both players from opposite stored sides of the same draw are credited the
  draw.
- Synthetic games on both stored sides give exactly 1 W / 2 D / 2 L.
- The empty state never shows a %.
- A match played before a tier change is found under the matchup of the
  tiers on the day, not today's.
- Classifications, ratings and the League table are byte-identical after
  drawing it.

**Shared label.** `gamesTypeLabel()` is now shared by the collapsed filter
heading and the record, so both name a game type the same way. The heading's
text is unchanged.

**Visual.** Checked at 375px:
- one line of context in caps, one line of counts, and the win rate in quiet
  gold;
- a gold hairline, no border, no card;
- no page overflow.

The screenshot shows Rishi's July BB vs BB record, with Rishi as (B) on the
day.

**Baton → Shaun / CGPT.** Section 5 has the three small choices.

### CCode — 28 Sep 2026 (Claude Design → implementation map)

`08712d4` delivers
[`docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md`](./docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md).
The Ledger commit that follows it makes one small correction to the map: the
Kings / podium note. **No production code, CSS, data or tests changed**, so
the tests stay at 717/717 on `e4408ff`.

**What was read:**
- this Ledger in full;
- all three design files;
- `index.html`, `shell.js`, `app.js`, `app.css`, `tokens.css` and the
  modules behind every designed number;
- every browser test's DOM hooks.

**What the map says, briefly:**
- **The calculations already exist.** Each designed figure is traced to its
  one canonical function: `tierRankOf`, `playerStateOf`, `FixtureFlow`,
  `MeritTable`, `MonthlyRace`, `RatingExplainer`, `doughnutMatches` and the
  others.
- **The migration is a presentation and routing change**, plus one new pure
  view-model (`playView.js`). It gives Play, Home and the tab badge one
  viewer-centred list of games built from `FixtureFlow.stage()`. Home's
  "Next game" must use stage UPCOMING, not `getViewerSnapshot().upcomingGames`,
  which includes Called Out.
- **What must not be copied:**
  - the prototype runtime (`x-dc`, `sc-for`, `DCLogic`);
  - the mock status bar and home-indicator bar;
  - the fabricated data;
  - every rule the mockup illustrates rather than knows. The list is in
    Section 5 and the map.
- **The shell is the riskiest change.** More has eight destinations that
  need new homes (the map's Section 5).
  - **Keep `#tabrow` as the internal router.** 101 test references drive
    navigation through it.
  - The design's "Structure & system" board is otherwise consistent with the
    visibility rules. Every new route must go through `canSeeTab`.
- **The styling is not all in CSS.** Inline styles in `app.js` / `shell.js`
  (H2H, League/Race tables, Games cards, journey SVG) mean several screens
  need template changes; CSS alone will not re-skin them. The map's
  Section 6a lists this and the other architectural constraints.

**Corrections made on the way, in place:**
- **Section 2's month table** listed Doughnuts as never month-scoped. D7 made
  it Meaningful Month with its own choice, and the row now says so.
- **Section 5's 27 Sep note** said Called Out is oldest first. `b12e837` made
  it newest or newly restored first, which is what the code does. The note is
  marked superseded, not deleted.
- **Kings / podium basis:** the code ranks both on Power Rating. The 17 Sep
  CGPT note says Monthly Performance. This is flagged for CGPT to confirm; no
  change was made.

**Accessibility, noticed:**
- The design's inactive tab colour `#6B675F` is about 3.4:1, below AA for its
  10.5px labels.
- The design's muted text is below the contrast the Ledger raised on purpose.

The map recommends keeping the Ledger's levels (DQ20).

**Baton → Shaun / CGPT.**
- **To start:** Phase 0 needs DQ20 (tokens and fonts).
- **Phase 1 needs:**
  - DQ5 (first run without a chosen player);
  - DQ18 (where the podium, Kings and other More items go);
  - DQ22 (Games history and Challenges);
  - DQ29 (the Play badge rule).
- **Phase 2's permission questions** (DQ6–DQ9) are Shaun's.
- **CCode is not implementing any of it until a phase is approved.**

### CCode — 28 Sep 2026 (D7 Doughnuts: list and month)

`e4408ff`. **717/717 tests pass** (7 new, `tests/doughnuts.test.js`).
- **Tested against the previous code:** 6 of the 7 fail there. The seventh
  is the invariant that the definition and every total are unchanged: it
  re-runs the pre-D7 rule inline and compares.
- **Existing test updated:** the draw-wording test (`drawOutcome`) now picks
  All time, because the sheet opens on a month.
- **How:** the existing rule was lifted into `doughnutMatches(month)` and
  both views read it. By Player's totals are therefore identical to before,
  and the list can't disagree with them.
- **Tests cover:**
  - each month, All time included, against an independent scan of the
    record;
  - the month kept across views, and across closing and reopening;
  - a historical month;
  - newest-first, including a same-day tie;
  - each row against its match;
  - a tap landing on the game's expanded card in Games;
  - the empty state in both views.
- **Checked visually at 375px on the live record:** September's 5
  doughnuts, including a drawn one, and By Player. No overflow, no writes,
  no errors.

**Baton → Shaun / CGPT.**
- Section 5 (item 5) has one small note on April/May.
- Phase 2 is not started.
- Nothing is queued for CCode.

### CCode — 28 Sep 2026 (audit fixes D4, D5, D6)

`9cca86c`. **710/710 tests pass** (13 new, `tests/auditFixes.test.js`).
- **Tested against the previous code:** 12 of the 13 fail there. The one
  that passes checks that an Admin still sees predictions, which must stay
  true.
- **Existing tests:** none needed changing. The one that failed mid-way was
  Hard/Fav's same-day order, which CCode had changed by accident and
  restored.

**How each was found and fixed:**
- **D4, the leak.** The visibility settings hid only the legacy tab row,
  which the new shell hides for everyone anyway, and nothing in the shell
  consulted them. Predicted splits reached players from three places the
  audit named plus one it didn't:
  - Find a Game.
  - Home Match to Make: the numbers were in the page even while folded.
  - The Challenge ready card (the one the audit didn't name).
  - **Fix:** one guard on the tab switch, which every route passes through,
    plus the shell drawing its navigation from the same map; and one
    prediction rule applied to each place that drew a split.
- **D5, the two numbers.** The header ranked rankable players only. Player
  Analysis ranked every tier member, Idle and Inactive included. One Idle
  or Inactive Tier A player rated above Rishi made the difference.
  **Fix:** one function, the old calculation removed.
- **D6, the data.** League rows had only counts, and Merit rows kept games
  for Hard/Fav only. **Fix:** both now record each game at the moment it is
  counted, and the tests check every non-zero cell across three months ×
  two views × both tables, against both the cell and an independent count
  of the context.

**Checked visually at 375px on a fresh read-only copy of the live record:**
- Find a Game and Home as a player: no percentages.
- Rishi's profile: #8 of 8 in Tier A.
- League W open: "Rishi · Wins · September 2026 · Tier A · 2 games" with
  exactly his two wins.
- Merit P open.
- No writes and no page errors.
- One fix came out of it: the P counts had dimmed, because a button
  doesn't inherit the table's text colour.

**Baton → Shaun / CGPT.**
- Section 5: three judgment calls.
- Phase 2 is not started.
- Nothing is queued for CCode.

### CCode — 27 Sep 2026 (fixture follow-up 2: My Requests, bulk entry, archive)

`b12e837`. **697/697 tests pass** (25 new).
- **Tested against the previous code:** all 19 new tests of changed code
  fail there. The other 6 cover the new parser module alone.
- **Existing tests updated to the approved behaviour:**
  - The Requests lists are now For me / My Requests.
  - A My Request reads "1/4 agreed · Waiting for …".
  - An outsider finds others' requests under Other requests.
  - The D1–D3 suite now **pins its clock to 20 Sep**. Without that, its
    mid-September Called Out fixtures would have aged into the archive from
    29 Sep and those tests would have started failing on their own.

**Checked visually at 375px:**
- **Requests:** For me, My Requests with a Needs attention card, and the
  folded forms.
- **Bulk review:** seven lines covering ready, duplicate, ambiguous, near
  miss, unknown and unparseable.
- **Upcoming on 6 Oct:** the six live call-outs under Archived call-outs,
  with Restore inside Manage fixture.
- No writes and no page errors.
- One fix came out of it: review rows now use the interface font.

**Where the rules live:**
- `fixtureFlow.js`: the archive clock, archive/restore, duplicates and the
  sort orders.
- `fixtureParse.js`: parsing and review.
- `app.js`: drawing and wiring only.
- Section 2 has the schema and the full rules.

**Baton → Shaun / CGPT.**
- Shaun: Section 5 item 1 (the 5 Oct archive).
- D4 and D5 remain for product discussion.
- Nothing is queued for CCode.

### CCode — 27 Sep 2026 (fixture follow-up: Called Out, Upcoming, Manage fixture)

`0766d7b`. **672/672 tests pass.** The 22 new tests all fail against
`023a0f7`. Seven existing tests were updated to the approved behaviour:
- "agreed" replaces "upcoming" in history.
- Removal is reached through Manage.
- An Admin-added game without a booking is Called Out.
- The date format is now "Fri 18 Sep".
- An unbooked fixture's D3 question says "Called Out game".

**What changed:**
- **Rules** are in `fixtureFlow.js`: `stage`, `attention`, `setCourtBooking`,
  `setAvailability` / `markBackedOut`, `replacePlayer`, `adminEdit`,
  `createAgreed`. The app only draws them. Schema is in Section 2.
- **Admin edits are all-or-nothing.** `adminEdit` checks everything before
  changing anything, and a failed save restores the previous state.

**Checked visually at 375px:**
- **The live record** (read-only): six Called Out games, plus the Admin
  review list.
- **Illustrative fixtures:**
  - A booked game with a backed-out player, at the top under Needs attention
    with "Court booked" kept.
  - An Upcoming game with Manage fixture open.
  - A Called Out game reading "Proposed: Tue 29 Sep · 20:00 · PadelX / 4/4
    agreed · Court not booked · Called out 6d ago".
- No writes and no page errors.

**Bug found and fixed while testing:** in Manage fixture, swapping two
players between seats reset both to "not answered". Answers now follow the
player, and only a genuinely new name starts unanswered.

**Edge cases for whoever builds next:**
- **Home:** `getViewerSnapshot().upcomingGames` (`shell.js`) still means
  "all agreed", Called Out included. Nothing renders it. A future Home "my
  next game" should use `FixtureFlow.stage()`.
- **Last writer wins** on the single fixtures document. It matters more now
  that Admins edit fixtures too.

**Baton → Shaun / CGPT.**
- Shaun: the one-time booking review (Section 5, item 1).
- D4 and D5 remain for product discussion.
- Nothing is queued for CCode.

### CCode — 27 Sep 2026 (fixture flow D1–D3)

`023a0f7`. **650/650 tests pass** (25 new). Browser tests 11–24 were run
against the previous code and all fail there. Ratings are unchanged: an
approval plan is identical with or without an Upcoming game, and the engine
was not touched.

- **Where it lives:** the rules are in `assets/js/fixtureFlow.js`; the rest
  is wiring in `app.js`. Section 2 has the full lifecycle.
- **Checked on the live beta** (read-only copy, 390px and 375px, 0 writes):
  - The two 23 Sep games still listed show "Date passed".
  - An Admin can close each from its expanded card; nothing closed them on
    load.

**Data-model findings and edge cases:**
- **Matching evidence is thin.** A result has no time or venue, so matching
  uses the players, partnerships and date only. Same-day repeats of the same
  four players (they exist in September) produce more than one candidate.
  The Admin chooses.
- **Viewer identity is self-declared,** as before. Anyone can select a player
  and answer as them. These rules remove the wrong buttons; they are not
  security. That would need sign-in (a Phase 2 / Shaun matter).
- **Last writer wins.** `moneypadel_game_requests` is one JSON array written
  whole, so two people answering in the same moment can lose one answer.
  - This is unchanged from before, but it now matters more because players
    write to it.
  - Per-fixture documents would fix it. That is a storage change, not
    started.
- **Removal is soft.** Removed and played fixtures stay in the array with
  their history. Nothing prunes them yet; that is fine at club scale.
- **Requests without sides.** "vs" splits the four players in the order they
  were entered, as in Shaun's example.
- **Home "Waiting on you".** `getViewerSnapshot` (in `shell.js`) already
  computes pending requests and upcoming games for the selected player, but
  Home does not show them. This was left for Phase 2 because "Don't redesign Home" was in
  the brief.
- **Challenges** still bridge into a request. It arrives with the challenger
  and the challenged player confirmed (both agreed through the challenge)
  and a `fromChallenge` history entry.

**Baton → Shaun / CGPT.** D4 (visibility toggles; Find a Game predictions)
and D5 (two tier ranks on a profile) remain for product discussion. Nothing
is queued for CCode.

### CCode — 26 Sep 2026 (Player Experience Reset: Phase 1 audit)

`0f9db42`. Evidence only: no UI, data, methodology or navigation change;
625/625 tests still pass.
- **How:** audited as an ordinary player (PDM) on the current build against a
  read-only copy of the live beta. Every screen was reached by real taps, and
  the capture fails if the app attempts a write (none did).
- **Evidence:** the report is `PLAYER_UX_AUDIT.md`; the evidence is
  `docs/ux-audit/` (77 screenshots with an index, and `journeys.json` for the
  seven journeys); `scripts/ux-audit-capture.js` regenerates it. The live
  snapshot is not committed: it holds club data and the admin password
  hash, which the capture never serves.
- **Defects found (D1–D5)** are in NEXT #15j, unfixed. D1, D2 and D4 need
  Shaun.
- **Baton:** back to Shaun / CGPT for Phase 2. Nothing is queued for CCode.

### CCode — 26 Sep 2026 (Monthly Race trial delivered)

`25191b8`. **625 / 625 tests (181 browser).** The approved Power-Rating-stakes
race is live behind League → View → Monthly Race. The calculation is one pure
module; the screen reuses the League/Merit tier sections and drill-down
pattern. On the live record it reproduces the analysis's order exactly.
Upcoming stakes are deliberately deferred because par drifts by up to ~1
point within a month; the recommendation is in NEXT #15i item 2. No engine,
record, League, Merit or Monthly Performance change.

### CCode — 26 Sep 2026 (Best Month analysis)

Analysis only; nothing in the app, engine, record or methodology changed. It
used a read-only snapshot of the live beta at 04:10 UTC (169 matches, 48 in
September) and split-month tiers via `TierHistory`. The D column reproduces the
engine's Monthly Performance exactly. Findings and recommendation are in
NEXT #15i and `BEST_MONTH_ANALYSIS.md`.

Baton to Shaun (three product decisions) and CChat (challenge the fitted win
curve and the cushion).

### CCode — 26 Sep 2026 (build stamp moved to Admin / Manage)

`28f3514`. **604 / 604 tests (176 browser).** Shaun could not see the stamp in
More and asked for it at the bottom of Admin / Manage. Moved, not duplicated;
also shown under the unlock form. **Why he could not see it:** not the More
list — Pages has not deployed anything since `815e849` (NEXT #15h), so his
phone is running a build that predates the stamp. It will appear wherever it
lives only once Pages builds again. The shared "How this works ›" link that
every tab renders still sits below it; left alone, as it is not Admin's.

### CCode — 26 Sep 2026 (build stamp)

`fc8ebb6`. **603 / 603 tests (175 browser)**; 14 new, the 7 that touch the
app or the deploy wiring verified failing on the previous code.

**Mechanism.** Pages already runs Jekyll on every push and hands it the
commit SHA (visible in every "pages build and deployment" log). So the stamp
is a Liquid template rendered by that build, with no workflow to add and no
Pages setting to change. Verified locally with the same github-pages 232 gem:
the stamp renders, the placeholder is excluded, `index.html` is byte-identical
and no other published file changes. The first live proof is the next deploy:
the More screen should read `Build fc8ebb6` or later.

**Service worker audit:** there isn't one. Details and the 10-minute cache in
Section 2; the update prompt is folded into NEXT #19 rather than built on
ground that cannot make Refresh reliable.

Baton back to Shaun / CGPT. Nothing is queued.

### CCode — 26 Sep 2026 (Meaningful Month)

`87368a1`. **589 / 589 tests (172 browser)**; 28 new, 12 of the browser ones
verified failing on the previous code (the other two are guards for rolling
views and feature independence, which must pass either way).

**What it does.** `meaningfulMonth.js` is the one rule: current month once it
holds 5+ unique completed matches, else the latest earlier month with any.
Counts canonical approved matches — draws in, pending out, one match however
many players — in the reader's own time zone (tested at 23:30 UTC on 30 Sep
for a London reader, who is already in October). Rankings and League each keep
a pinned default and a separate user choice; Home re-evaluates on each
arrival. Section 2 has the per-view table Shaun asked for.

**Not jumping the reader.** The default is fixed when someone *arrives* at a
screen, never on a redraw, so a fifth game approved while they read changes
nothing until they next come in. An explicit choice is never overridden; it is
dropped only if that month vanishes from the record.

**Two things Shaun should know, both small and reversible:**
1. **The Home monthly card follows the rule too.** It was not on his list. It
   used to show the latest month with *any* match, pending included — so on
   26 Sep it said September while its own View Full Review opened August.
   Now card and review agree, and View Full Review opens the card's month
   without touching League's own choice. It carries the same note, without
   the switch link (Home has no month control).
2. **Home "Games played" now counts draws**, because it uses the same count
   as the rule. Previously a draw was missing from it.

`getDefaultRankingsMonth()` is deleted; a comment points at the replacement.
The engine and the record are untouched.

Baton back to Shaun / CGPT. Nothing is queued.

### CCode — 26 Sep 2026 (Player Profile month leak; Directory refresh finished)

`d8d6406` and `63b4ea7`. **561 / 561 tests (158 browser).**

**1. The profile's August was genuine shared-state leakage.** Audited before
anything changed. There was one month variable. The profile was written, in
the original pre-v3 app, to follow it deliberately — "if a month is selected
elsewhere in the app, keep this profile's match log scoped to it too" — which
was reasonable while a person chose that month. It stopped being reasonable
when Rankings began choosing it automatically at start-up. Reproduced: Rishi
opened from the Directory showed 18 of his 80 games under "Showing only August
2026". Compare was quieter and worse: its month picker *wrote* the Rankings
month.

This had surfaced twice before and been treated as a symptom both times. Games
got its own month (the right fix, applied to one screen), and Home's "View
match" widened the month around one call and restored it (a workaround, and
CCode's). The Ledger recorded the workaround without recording that the cause
was still live, which is how the profile went on opening as an August snapshot
for everyone. Fixed at the root: each screen owns its month, the workaround is
deleted, and a source-level test now fails the build if anything but Rankings
touches `selectedMonth`.

Kept, and verified independent: Rankings still opens on August; League and
Merit still open on the last completed month from their own `summaryMonth`
(question for Shaun in NEXT #15e); Games stays All time. The app has no
router, so "back" means in-app navigation — a test walks Rankings → Players →
profile → month chosen → away → back and asserts nothing moved.

**The profile keeps its month-specific view as an explicit control of its
own** on the Recent Results heading. Not previously designed; added so the
capability the implicit scoping provided is not lost. Flagged here in case
Shaun would rather it went.

**2. The Directory had not regressed and was not being overridden.** Checked
in order: nothing touched the Directory after `43401f8`; one renderer writes
it; GitHub Pages last deployed `main` HEAD. What Shaun saw *was* the delivered
design, and it had gone half the distance. It folded the filters, but left a
bordered filter card, two full-width sort buttons, full-size chips inside the
fold, and plain rows. The bordered card is the treatment Shaun rejected on
League one day after the Directory shipped; every other screen was brought
into line and this one never was.

Finished in the same renderer with the same ids: quiet filter line, compact
sort on the count line, small chips with one "selected" look, and player cards
using Home's initials avatar tinted by the tier tokens. First player 256→218px
shut and 438→344px open at 375px. **Worth carrying forward:** the original
Directory tests pinned behaviour only, which is why a half-finished look passed
review and stayed. Seven new tests pin the look.

Baton back to Shaun / CGPT. Nothing is queued.

### CCode — 23 Sep 2026 (form dots, and how the draw fix broke them)

`55bd9ea`. **546 / 546 tests (144 browser).**

**This one was mine.** `b2c8544` changed `computeRecentFormSequence` from
returning booleans to returning the letters `'W' / 'D' / 'L'` — necessary,
because a boolean cannot hold a draw. It updated the profile's call site and
missed Home's, which read `isWin ? 'w' : 'l'`. Every letter is truthy, so
every dot came out green. The aggregate beside them stayed correct, nothing
threw, and no test noticed, **because no test had ever looked at an individual
dot** — only at the counts. Reproduced against the live record: Antz's run is
`L L W W L L L W W L` beside a correct "4W – 6L", ten green dots.

**The lesson is the type change, not the typo.** Changing a shared helper's
return type is a change to every one of its callers, and a language that
happily treats `'L'` as true will not tell you which ones you missed. Two
things now make the class of mistake visible rather than silent: a single
`MatchOutcome.classFor()` that all three renderers go through, which returns
NO state for anything it does not recognise (a stray boolean included) rather
than defaulting to a win; and a `.form-dot` with a default outline, so an
unclassified dot reads as missing instead of being invisible.

**Three renderers, three private answers.** Home tested the value for truth,
the profile lower-cased it, the League table's Last 10 column keyed a colour
map off the raw letter. Only Home was wrong, but all three are now one
decision — the League column was correct by luck of having been written after
the letters existed.

**Coverage that would have caught it:** a forced `W-L-W-L-D` run asserted to
render as itself. Against the broken code that test reads
`must render as itself, got w-w-w-w-w-w-w-w-w-w`. Six of the seven new tests
fail on the old code, including a source-level guard that fails the build if
a fourth renderer is written as a truth test.

Baton back to Shaun / CGPT. Nothing is queued.

### CCode — 23 Sep 2026 (clearing the player filter)

`fc3706f`. **539 / 539 tests (139 browser).**

Small and as specified. Two notes worth keeping:

**The control is rendered conditionally rather than disabled.** Shaun asked
for it to "disappear/disable"; absent is the better of the two on a phone,
because a disabled control still occupies the row and still invites a tap. It
cannot exist in a state where tapping it does nothing.

**There was no natural per-field clear to retain, so one was added.** The
brief said to keep any existing remove interaction. The fields are plain text
inputs, and `type="text"` has no clear affordance on iOS — emptying one by
hand works, and still does, but it means summoning a keyboard to delete a
name. Each filled field now carries its own ×, which is what "remove one
player without resetting all four" actually needs.

**A test-harness race surfaced and is fixed.** The simulated tap-during-boot
fired as soon as `#tabrow` had been parsed — static markup, present long
before app.js runs — so on a loaded machine it landed before the app was
booting and two data-flow tests failed intermittently while passing in
isolation. It now waits for the boot to be in progress. Worth recording
because the failure looked like a product bug and was not: an intermittently
red suite is how people learn to ignore red.

Baton back to Shaun / CGPT. Nothing is queued.

### CCode — 23 Sep 2026 (draws, and finding a game by who was in it)

`b2c8544` and `04efe2c`. **536 / 536 tests (136 browser).**

**The draw bug was one instance of one mistake, made in five places.** Shaun
reported the Doughnut drill-down writing "def" over a drawn game. The cause is
worth stating plainly because it will be made again otherwise: on a drawn
match `winners` and `losers` still hold the two sides, because a match has two
sides whatever the result — but they mean nothing, and the record knows it
(`drawSideAssignmentArbitrary: true` on every drawn document). So
`winners.includes(name)` answers "which side was this player filed on", and
`won ? 'WIN' : 'LOSS'` promotes a coin toss to a result.

The audit found the Doughnut line, two head-to-head totals, the head-to-head
opponent card, and one latent case in the profile's collapsed summary row
(`=== 'WIN'` then `won ? 'WIN' : 'LOSS'`) which would have started showing
LOSS the moment the card beneath it said DRAW — it was only correct because
draws never reached it.

**Two of the five were wrong by OMISSION, which was the more misleading
half.** Head-to-head and a player's own match history were built from
`MATCHES`, the RATED set, which excludes draws by design. So a drawn meeting
was not misclassified, it was invisible: two players who had drawn once and
never otherwise met were told they had never played each other. Both now read
`matchesIncludingDraws()`. Nothing that calculates changed lists.

**A finding Shaun should decide on, deliberately not acted on** (NEXT #16):
draws ARE rated — 24 journey events across the six, with real expectations —
yet the rated set excludes them, so Recent Form and the upset filter are
computed over 153 of 159 games. Including them would move the Power Rankings
"Recent form" sort, which is a ranking change and not a display fix, so it was
left alone and written up rather than folded in quietly.

**The four-player search is a set comparison, and that is the whole design.**
Order, sides and partnership are not part of the question, so they are not
part of the code: `playerFilter.js` compares participant sets. Fewer than four
is not a degenerate case but the common one. Four is the exact group for free,
since a doubles match holds exactly four people.

It matches on canonical ids rather than displayed names, per Shaun's
instruction, and a test pins the failure mode directly: searching a renamed
player finds their old matches through the id layer and would not through the
labels. `selectedGamesPlayer` was retired rather than kept beside the new
filter — one filter, one source of truth — and the places that had a single
point of view (heading, card tinting, score orientation) now derive it from
the selection holding exactly one player.

Verified against the record: Eli, Erf, Len and Max have played all three
possible pairings of themselves, and the search finds all three.

Baton back to Shaun / CGPT. Nothing is queued.

### CCode — 22 Sep 2026 (Play / Upcoming / prediction UX)

`4b53b77`. **515 / 515 tests (130 browser).**

All six parts delivered. The interesting decisions and the things that were
not obvious before starting:

**The Your Name audit answered itself.** Shaun asked why the field was
required. It was not: the app has had a second, better identity since the
viewer was introduced, and the challenge code had already quietly decided the
viewer should win (`viewerNow ? viewerNow.name : currentUserName`). So this
was not "remove a card for space" — it was finishing a decision the codebase
had already half-made. `submissionIdentity()` is now the only way anything
asks who is acting, the typed name survives as the fallback for a device that
has never chosen a player, and a browser probe confirms the behaviour change
in the right direction: submitting a result as a chosen player with nothing
typed was **refused** before and is now accepted and correctly attributed.

**The prediction had to be extracted before it could be shown twice.** It
lived as a closure inside `renderManage()`. `matchPrediction.js` now holds the
calculation and `matchPredictionHtml()` the card; Admin and Upcoming render
the same two functions. The module also fixed a latent ambiguity in the old
code by stating it: a side's strength is the MEAN of its players, so
Strong+Weak is level with a mid pair rather than a mismatch.

**Upcoming needed a `teams` field, and it is worth knowing why.** Everything
downstream of `players` assumed a flat list of four split 0,1 vs 2,3. A
predicted matchup is *about* who partners whom, and a predicted singles game
put through the flat split would have arrived as one partnership with nobody
to play. `teams` is optional and additive; `requestTeams()` falls back to the
old split, so every existing record reads correctly and nothing was migrated.

**A latent defect fell out of folding the filters.** The game-type fallback
("this type no longer matches anything, go back to All") sat beside the select
that offers the options — so it ran *after* the list had already been filtered
to nothing, and corrected itself one render late. A shut panel has no select
to hang it off, which forced it to move ahead of the filtering, where it
should always have been.

**Two questions are now answerable and are in NEXT rather than decided here:**
whether Requests and Upcoming should become one screen (Shaun deliberately
held this until he could see the condensed design — it exists now, and CCode's
reading is that they should stay two), and whether an ordinary request should
carry time and venue as the prediction path does.

Everything new goes through `dataChanged()`, so creating or removing an
Upcoming game updates the screen in front of the reader without navigating.

Baton back to Shaun / CGPT. Nothing is queued.

### CCode — 22 Sep 2026 (data-loading audit, then its fixes)

`459eb2f`. **503 / 503 tests (122 browser).**

Shaun asked for the architecture to be profiled before anything was changed, and
that instruction was worth following: the cause was not what the symptoms
suggested. **Rendering was never slow.** Warm, with no network involved, every
screen redraws in 0.2–6.3ms and `recomputeAll()` in 2–4ms. The whole of the
wait was fourteen Firestore reads taken one at a time — 1,717ms of 1,924ms at
120ms latency, 3,533ms of 3,779ms at 250ms — against 16ms of computation. None
of the fourteen is an input to any other. They now go out together: **499ms to
first content at 250ms, from 3,779ms.**

**The blank screen was a wiring defect, not slowness.** `init()` ended with
`render()`, which draws `#list` and nothing else. `renderActiveTab()` — the
function that knows how to draw the other ten screens — was reached only from
the tab-row click handler. So a screen tapped during the load was drawn once,
from an empty club, and never drawn again: blank until the reader navigated
away and back. Reproduced in a browser for Players, League, Merit, Call-Outs,
Head-to-Head, Games and Wishlist before changing anything, and re-run after.

**The stale-after-mutation problem was the same shape.** Every mutation
rebuilt everything derived correctly and then redrew whichever screen its own
button sat on. Submitting a result redrew nothing at all. Removing one rated
match moved four players' ratings and changed nothing visible on six screens.

Three things that came out of doing it rather than planning it:

1. **Making start-up fast broke start-up's own ordering assumption.** With
   everything read at once, `init()` can finish before `shell.js` has been
   parsed — and the screen it wants to draw is built in there. All 105 browser
   tests failed on `renderHomeDashboard is not defined`. The fix is
   `drawFirstScreen()`: neither half draws the first screen, whichever finishes
   second does. Worth knowing, because anything else that makes the boot faster
   will meet the same edge.
2. **The submit form is part of the screen it submits to**, so redrawing that
   screen empties the form — which is what the six lines of by-hand field
   clearing there were for. The set rows are module state and have to be reset
   *before* the redraw, and the confirmation written *after* it.
3. **`reviewSnapshotCache` was stale-able** and nobody had noticed: cleared by
   the review commit alone, though a correction, an approval and a historical
   adjustment all rewrite the journey it is built from. Now cleared by all of
   them.

**Deliberately not done: caching the record on the device.** Shaun's brief
asked for `cached → render → refresh`, and the measurement says that shape
solves a problem this app does not have. The cost was serialisation, not
volume; removing it gets 88% of the wait back without ever holding a copy of
the record that could show an out-of-date rating. Two questions that *are*
worth his answer are in NEXT: caching the **app shell** (825KB of JS per
launch, no risk to the record, but a deployment change) and whether live
updates between devices matter.

**Guard against the mutation defect returning:** a source-level test fails the
build if `recomputeAll()` is called anywhere except `dataChanged()`,
`applyDataRangeChange()` and `init()`. The browser tests prove the mechanism;
that one proves nothing can go around it.

Baton back to Shaun / CGPT. Nothing is queued.

### CCode — 22 Sep 2026 (Favoured beside Hard, with a drill-down)

`b864786`. **496 / 496 tests (116 browser).**

The important decision: **`build()` carries the qualifying matches on the row**,
so a count and its drill-down are the same object rather than two computations
of the same thing. The brief asked for exactly this and it is the difference
between a feature that stays true and one that drifts.

Hard and Favoured are exhaustive with even wins — every win lands in exactly
one of the three, asserted — and an equal-strength win shows in neither column.
Each listed match states the teams with the tier each player held for that
fixture, the score, the gap and the points, so the classification can be
checked by eye.

**The mobile constraint was measured, not assumed:** nine columns at 375px come
to **341px** with no page overflow and no sideways scroll inside the card,
using compact labels and a fixed layout with the name column yielding.

**Baton → Shaun / CGPT.**

### CCode — 22 Sep 2026 (Merit scoring refinement delivered)

`510c4cc`. **487 / 487 tests (112 browser).** A change of two constants and one
guard, not a rewrite: `BASELINE` 4 → 3, `DRAW_POINTS` 1 → 0, and a floor of 0
on the favourite side only — no ceiling, since an extreme matchup should be
reported rather than clamped. Everything the brief listed as untouched is
untouched, and the UI was not redesigned.

**Re-audited over the full history.** Win values now range **1–4** (was 2–5),
nothing outside the brief's 0–6, no negatives. The tier-step gaps are
unchanged at 93 / 60 / 6 — they are a property of the data, not the formula.
**The floor never engages on real data:** it needs a three-step favourite win
and the widest gap on record is two.

**The reason for the change was verified rather than assumed.** Six players —
Harry (16 W), Shaun, Tee, Del, Mulley, Tarique — now score exactly the same in
both tables, each having no draws and only even wins. Harry: 48 League, 48
Merit. The contrast is Len at 65 League against 45 Merit — 21 wins, none of
them hard — which is the signal the table was built to show.

Recorded as a refinement of the original Merit decision rather than a second
definition: the 4 / 1 / 0 model was implemented, reviewed and worked, and the
Decisions Log row says so and points at what it supersedes.

**Baton → Shaun / CGPT.**

### CGPT — 22 Sep 2026 (Merit scoring refinement approved)

The Merit Table implementation was reviewed and works. After seeing it beside
the League Table, Shaun refined the scoring so the two share a baseline: an
even matchup win moves **4 → 3**, matching a standard League win, and draws
move **1 → 0** because the six in the record ended early through injury or time
rather than as competitive draws. A win is floored at 0.

**This supersedes only the point values.** It is a refinement of the feature
already built, recorded against the original decision rather than as a second
definition. The UI is not to be redesigned and the architecture — historical
tier resolution, partnership strength, split-month treatment, tier sections —
is unchanged.

Re-run the historical audit after the change and report anything unexpected.

**Baton → CCode. Approved refinement.**

### CCode — 22 Sep 2026 (one-player tier sections collapse by default)

`1781ed5`. **485 / 485 tests (112 browser).** Shaun asked for Tier S to arrive
collapsed *"as there's only one player there"*. Implemented as that reason
rather than as the letter S: a section holding one player is not a table, so
any such section folds on arrival. Tier S folds today; it will open on its own
if Manny is ever joined; and any other tier that thins to one player folds
without this conversation needing to be remembered. Both the League and Merit
tier sections share the one rule.

The heading is always rendered, so collapsed is one tap from open, and an
explicit tap always beats the default — resetting now *forgets* what the reader
touched rather than forcing everything open.

**One test failure was worth reading rather than patching.** The Merit test
that sums the tier sections back to the `All together` totals broke, because a
collapsed section's rows are not in the DOM at all and the sum silently lost a
player. The invariant was always about the data, so the test now expands every
section before summing. Nothing was wrong with the feature; the test had been
measuring the screen when it meant to measure the numbers.

**Baton → Shaun / CGPT.**

### CCode — 22 Sep 2026 (Merit Table delivered)

`767e0d3`. **483 / 483 tests (110 browser).** Full detail in Section 4.

**Derived, never persisted**, from canonical matches plus
`historicalTierOf` → `V3_TIER_AS_OF` — the same canonical resolver the League
Table and the tier badge use. No second interpretation of tier history exists.
**Not a rating, and built so it cannot become one:** nothing in
`meritTable.js` reads a Power Rating, expectation, reliability, `ratingJourney`
or even `TIER_SEED`, and a test greps the module to hold that line.

**Audit of the full rated history, as required before release.** 159 matches,
0 unresolved tiers, gaps of 93 even / 60 one-step / 6 two-step, **maximum 2
tier-steps**, win values **2–5**. **Nothing falls outside 1–7, so no cap is
needed.** The six widest matchups are listed in Section 4. One thing worth
knowing: the v3 record contains **no singles**, so the partnership rule never
meets an odd case today; the module sums whatever is on a side, so a singles
match would score consistently if one is ever recorded.

**UI placement, proposed rather than imposed:** Merit is a third option in the
existing **View** select. A fourth segmented button would have crowded the
375px control the League refinement had just decluttered, and the View select
already answers which table you are looking at. Everything beneath it is the
League screen's own machinery, reused. If Shaun would rather it were a
segmented button or its own tab, that is a one-line change.

**Baton → Shaun / CGPT.**

### CGPT — 22 Sep 2026 (Merit Table approved)

A new alternative league view, specified in full in Section 4. Additional, not
a replacement. Scored from tier at the time of the match only — no Power Rating
and no expectation engine anywhere near it. Partnership strength is the sum of
both players' tier levels, so `AC` and `BB` are equal; comparing only the
highest-tier player on each side would be wrong.

Must reuse the canonical historical-tier resolver, respect the split-month
treatment, and derive Merit from canonical matches rather than persisting a
second source of truth. Merit Points are explicitly **not a rating** and must
touch nothing the engine owns.

Inspect the current Rankings UI before choosing placement, and report a proposed
placement rather than redesigning navigation if a clean fit needs a UX decision.
Audit the full history for extreme partnership gaps before finalising.

**Baton → CCode. Feature approved.**

### CCode — 21 Sep 2026 (monthly coherence + Monthly Summary delivered)

`2fdc169`. **457 / 457 tests (105 browser).**

**The persisted record was correct.** That was the first question the brief
asked and the answer is unambiguous: Rishi's 20 September reads PROMOTION B→A
with the rating unmoved, then CLUB_RATING_REASSESSMENT 1464.2 → 1640, then a
match to 1641.6, which is exactly his stored rating. **No repair, no write, no
change to Sequential-v1, reassessment mathematics or stored history.**

Both faults were in the display and both were general:

1. **Same-date ordering.** `MonthlyViews.chronological()` relied on `Array#sort`
   stability to preserve "the order the engine produced" — but stability is
   against the *input*, and the input is Firestore's arbitrary document order.
   Rishi's promotion came back last, so the month closed on the rating it left
   untouched. Now ordered by the engine's own rule, using the list
   `journeyView.js` already had (which is why the Rating Journey always read
   correctly). A test asserts the two lists cannot drift apart.
2. **The tier badge showed today's tier beside the month's rating.** Now
   `tierInScope()`, the month-aware answer the tier filter already used. This
   also fixes the past direction — July viewed for a September promotee.

Verified on the live record: September's close now equals the stored rating for
**every** player, and Rishi renders **A / 1642** against overall 1642.

**Monthly Summary** folds as one, defaults expanded, independent of the League
disclosures. Worth recording: I built it, screenshotted it, and found it still
looked like the bordered dropdown Shaun rejected — `.monthly-stories` is a card,
so collapsing it left a bordered box containing only its heading. The chrome now
comes off when collapsed. My first test had asserted the *button* had no border,
which was true and beside the point; it now weighs the container.

**A note for CGPT on the Ledger.** Recorded in place, additively —
`cbcafba` added 84 lines and removed none. The constraint is now written into
Section 6: this file is edited in place, never replaced wholesale. Declining to
write was the right call.

**Baton → Shaun / CGPT.** Nothing here needed a product decision.

### CGPT — 21 Sep 2026 (monthly rankings coherence + Monthly Summary disclosure)

Two requests from Shaun, recorded above in Section 4.

1. **Monthly Power Rankings coherence around mid-month reassessments.** Rishi
   shows a Tier A placement beside what looks like his pre-reassessment B
   rating. Find the source; do not special-case a player. Establish first
   whether the persisted state is wrong or only the monthly view's choice of
   snapshot. No engine, reassessment or stored-history changes to make a
   screen look right.
2. **Monthly Summary collapsible**, defaulting expanded, using the subtle
   disclosure pattern — not the bordered card treatment Shaun rejected during
   the League work.

**A coordination note worth keeping, because it is the second time this has
nearly happened.** CGPT attempted this handoff itself and **deliberately wrote
nothing.** The GitHub connector available in that turn offered only a
whole-file replacement for `PROJECT_LEDGER.md`. The Ledger is now 4,300+ lines
and has already been destroyed once through exactly that kind of unsafe
whole-file write (20 Sep: 3320 lines → 122). Rather than risk overwriting
CCode's newer Ledger state, CGPT stopped and handed the write to CCode, who
can edit the file in place. **That was the right call** and the constraint
should be treated as standing: *the Ledger is appended to and edited in place,
never replaced wholesale.*

**Baton → CCode. Approved and unblocked.**

### CCode — 21 Sep 2026 (renames applied by Shaun; live record verified)

Shaun renamed three players in the app and reports it working. Re-read the live
record to check it rather than take the feature's word for it. **It is clean.**

- **Ant Slice → Ant Slicer**, **Dennis → Denis**, **Stormzy → Stormz.**
- Every player document id is **unchanged**; no new label appears as an id,
  in any match, or on any journey event.
- **The record replays to itself with 0 differences**, so match corrections
  still work. That was the one thing a rename could plausibly have broken, and
  it is the check worth having run.
- Live record now **159 matches · 688 journey events · 34 players**.

**The write boundary was proven on live data.** Two matches recorded on 21 Sep,
*after* the renames, involve Dennis and Stormzy — and both were written under
their **original ids**. The display → identity translation is working in
production, not only in the fixture.

Nothing needed fixing and nothing was written by CCode. **Baton stays with
Shaun / CGPT.**

### CCode — 21 Sep 2026 (editable names delivered; the record was not migrated)

`25e4624`. **445 / 445 tests (102 browser).**

Shaun answered the A-or-B question with neither: *"I just need editable names
with no consequences. It's actually only two that need amending."* Taken
literally, and it turned out to be the best available answer — **the identity
is frozen and only the label moves.** `playerId` keeps its current value for
ever; a new `displayName` carries the name. A rename is **one field on one
document**. The 156-document blast radius reported earlier is now 1.

Full design in Section 4. The short version: `playerNames.js` translates at
two edges, the app above them works in labels, the record below them works in
identities, and `V3_RECORD` stays raw so the verifier sees what Firestore
actually holds.

**The defect this surfaced is the part worth reading.** After a rename the
record no longer replayed to itself — `buildWritePlan` rebuilds a player
document from engine state, which has no display name, so `verifyNoOp`
reported `players/Rishi differs`. **A record that does not verify is a record
the app refuses to edit, so renaming anybody would have silently disabled
every match correction.** It was caught by the test that asserts the replay
precondition still holds, not by using the feature. Fixed in `replayForward`
with `PLAYER_LABEL_FIELDS` and generalised: a replay reconstructs engine state
and must not destroy fields it does not own. Any field added to a player
document in future is now safe by default.

**Shaun: the two names are yours to change** — Admin → Player tags → open the
player → Name. The confirmation names both and says what does not move. If
you would rather I made the two changes directly, tell me which two and I
will, but the control is there and it is the safer route: it is the same one
path, tested, rather than a one-off script.

**Baton → Shaun.**

### CCode — 21 Sep 2026 (the audit that stopped the first attempt)

**Nothing was built and nothing was written.** The brief instructed CCode to
stop and report if canonical data is keyed by display name rather than a stable
id. It is, at every layer: `ratingEngine.js` line 152 sets `playerId: name`, and
`ratingStore.js` builds `players/{playerId}` and
`ratingJourney/{effectiveDate}__{playerId}__{eventType}` from it. **All 672 live
journey documents carry their playerId inside their document id.**

Full surface list and the measured blast radius are in Section 4. The short
version: a rename is not a field update, it is a re-keying migration — **156
documents for Rishi, 34 for the median player, out of 861** — plus a source
edit to the 127 hardcoded `BASE_MATCHES` in `app.js`, five shared blobs
(including `confirmations` keyed by name), and a per-device `localStorage`
viewer key that cannot be migrated at all.

**Why this is worth stopping for rather than just being careful about:** it is
the same shape as the 19 Sep incident, where a 509-document replay wrote 364
and stopped. A rename is worse in one way — it deletes and creates the same
logical data, so a half-finished one can leave a player under both names or
neither, and `verifyNoOp` will not hold while that is true.

**Two options are written up in Section 4 with a recommendation: A, a display
name separate from a frozen id, which makes a rename one field on one document
and touches no history; or B, a full re-keying migration per rename through the
existing replay machinery.** A also retires Open Question 4, the fragile
production-snapshot join that has been recorded since 17 Sep as *"a rename
breaks it silently"*.

The rest of the brief — confirmation showing old → new, blank and duplicate
rejection, the audit field — is straightforward and was never the blocker. It
is deliberately not half-built: a rename control that cannot safely rename
would imply a capability that does not exist.

**Baton → Shaun. One decision: A or B.**

### CGPT — 21 Sep 2026 (Admin player rename)

Shaun approved an Admin-only player rename action.

Implement it in the existing player-management area. The rename must preserve
the player's underlying identity and all historical relationships; confirmation
must explicitly show **old name → new name** before writing. Reject blank and
duplicate/conflicting names. Preserve the old name for audit where practical.

Before implementation, inspect how player identity is referenced across current
state and history. If any canonical data is keyed by display name rather than a
stable player id, stop and record the exact migration/blast radius before
changing data.

Add browser/module regression coverage for confirmation, duplicate protection,
and historical continuity after rename.

**Baton → CCode. Approved and unblocked.**


### CCode — 21 Sep 2026 (Predict a Matchup copy delivered; awaiting a visual render)

`55d2fa7`. **430 / 430 tests (97 browser).** Copy and information hierarchy
only. **No visual change**, per the same-day deferral — no new card, no new
layout, the existing container untouched. The prediction still comes from
`RatingEngine.expectedScore`; no rating, expectation or stored data changed.

The card now reads:

```
Osh & Rishi should win
Expected to win about 82% of the games, against 18%.
Osh (1712) & Rishi (1640) vs Omar (1411) & Mulley (1406)
Favoured by 268 rating points.
Based on current Power Ratings · Prediction only · Nothing is recorded.
```

**Two things held to deliberately, both of which the direction called for:**

*Share of games, never a chance of winning.* The engine has one Elo
expectation, and the app has always shown it to players as "expected to win
about X% of the games" — the same phrasing `ratingExplainer.js` uses and the
wording Shaun approved. No win-probability model has been validated, so
"82% chance" would be a claim the record cannot support. A test asserts the
card never says chance, probability, likelihood or odds.

*A two-point gap is not a prediction of a win.* The verdict scales with the
gap — **should win** above 15 points, **shade it** below, **Too close to call**
for a genuine tie. Naming a winner off noise would make the card worse than
silent, and the acceptance list's "names the predicted winning team" is still
met wherever there is one.

**On Admin-only:** it already held — `renderManage` returns the lock screen to
non-admins, so the form does not exist for them. The new test is therefore a
*guard*, not a change: it passes against the old code too, and it also asserts
the feature appears on no player-facing section. Recorded plainly because the
restriction is the point of the feature.

**Still with Shaun: the visual render.** Nothing about the layout was invented
while waiting. `19-admin-predict.png` shows the current copy in the existing
treatment, which should make the render easier to specify against.

**Baton → Shaun / CGPT.**

### CGPT — 21 Sep 2026 (Predict a Matchup simplification)

Shaun confirmed the product role of Predict a Matchup after comparing the old
and new versions. It is now a high-usage **Admin** workflow, not a player-facing
feature: matches are agreed first in the group, then the four-player combination
is sent to Shaun for prediction.

Implement the presentation/copy refinement only:

- keep Admin-only;
- restore simpler older-style wording;
- show predicted winner;
- show expected % share of games for both teams;
- show rating-point advantage;
- remove user-facing `Expected performance score` / engine terminology from the
  plain result card;
- do not change the visual layout yet; wait for Shaun's approved visual render;
- keep only a small “based on current Power Ratings / prediction only / nothing
  recorded” note;
- no engine, rating, expectation or persistence changes.

**Baton → CCode. Approved and unblocked.**


### CCode — 21 Sep 2026 (disclosure correction delivered; queue empty again)

`11ed091`. **425 / 425 tests (92 browser).** Presentation only — the League
aggregation, split-month allocation, Last 10 table, league scoring and rating
methodology are untouched, as required.

Shaun was right on both counts, and the second one was a design error rather
than a styling one.

**The `How this table works` card.** I built a bordered block, which made the
explanation heavier than the heading above it and competitive with the table
below. It is now a quiet tappable line of text with a small chevron — no card,
no border, no fill — expanding its copy inline, still collapsed by default.

**The global `Tier tables` accordion was my own invention and it was wrong
about what the four tables are.** The brief said the by-tier breakdown should
be collapsible; I read that as one block. They are four separate competitions,
so there was never a reason hiding Tier C should hide Tier A. Each tier heading
now carries its own chevron and collapses independently, and the headings keep
`.section-heading` — same type, same weight, same spacing as every other
heading on the screen, with the chevron the only thing marking them as
controls.

Tiers default expanded and are **reset** to expanded on entry to By tier: from
All together, from Last 10, and on arriving at the League screen at all. What
someone collapsed on a previous visit is not a preference worth restoring them
into.

**Coverage against the acceptance list:** independent collapse; several
collapsed at once with the rest untouched; the default-expanded entry state by
all three routes; and computed-style assertions that neither disclosure carries
a border, radius or fill, and that a tier heading is still a heading. Four new
browser tests, each verified to fail against the old design.

**Baton → CGPT / Shaun. Nothing is queued for CCode.** The four questions in
Section 8 need a person, not an implementer.

### CGPT — 21 Sep 2026 (League disclosure correction)

Shaun reviewed `3e326e1` on mobile. The feature set is right, but the collapse
interaction was interpreted too heavily.

Correction:

- replace the large bordered `How this table works` block with a subtle inline
  text + chevron disclosure beneath the League title, collapsed by default;
- remove the single global `Tier tables` accordion;
- put an independent subtle chevron on **Tier S / Tier A / Tier B / Tier C**;
- all tiers default expanded when entering By tier;
- collapsing one tier does not affect the others;
- retain the current **By tier / All together / Last 10** selector;
- do not alter split-month allocation, Last 10 calculations, league scoring,
  rating logic or stored data;
- add browser coverage for independent tier collapse and the lightweight
  table-info disclosure.

**Baton → CCode. Approved and unblocked.**


### CCode — 20 Sep 2026 (NEXT #3 League refinement complete; queue empty)

`3e326e1`. **422 / 422 tests (89 browser).** Every point of the restored brief
in Section 4 is implemented. Presentation and aggregation only — no rating,
expectation, Reliability, tier-history or stored match fact is read or written.

**Both disclosures.** The explanation folds, closed by default. The tier tables
fold as a block and the control says how many are hidden; the By tier / All
together choice and each match's tier allocation are untouched underneath.
Month and View were also stacked, which was 142px of a phone before the table
started — they now share a row, both kept exactly as they were. The first table
moved from 482px down to comfortably on the first screen.

**Last 10 is a third table, not a mode of the other two.** Each player's own
most recent ten rated games, wherever they fall. Not scoped to the selected
month, deliberately: two rows then cover the same number of *games* rather than
the same number of *days*, which is the only thing that makes them comparable.
The league's own 3/1/0 and its own game difference — no new metric, nothing the
rating engine can see. A player with fewer than ten games shows the games they
have, marked `of 10` beside the P it qualifies, never padded. A `Last 5` run
column says which way the form is going, which a points total cannot.
`Form (10g)` stays on the monthly tables as instructed; Last 10 does not repeat
it, because that would be the same fact told twice from the same ten games.

**Verification.** The aggregation is a module (`lastTen.js`) fed from the same
two sources the monthly table uses, so the two cannot disagree about what a
game was. Checked against an independent walk of the live record: exact match
on full and short samples, including draws and game difference.

**Three things found while building, worth the record:**

1. I first gave the screen a `leagueView` variable that duplicated what
   `leagueGrouped` already said. The split-month test writes only
   `leagueGrouped`, so the screen disagreed with itself and that test failed.
   Fixed as a design problem, not a test problem: two booleans, each meaning
   exactly one thing, which cannot contradict.
2. **Collapsing the tier tables exposed a pre-existing duplicate.** The legacy
   per-tab explainer also says *"Points: 3 for a win, 1 for a draw"* — two
   explanations, two chevrons, one screen. It had always been there, buried
   under the tables. See Section 1 for the resolution.
3. Two folds can be open at once, so each body now names the control it belongs
   to rather than leaving `.lg-fold-body` ambiguous.

**Baton → CGPT / Shaun. Nothing is queued for CCode.** Four questions in
Section 8 need a person, not an implementer.

### CCode — 20 Sep 2026 (Ledger restored to the full institutional record)

`PROJECT_LEDGER.md` is rebuilt from `LEDGER_ARCHIVE_2026-09-20.md` with every
post-compaction change merged in. Nothing from either source was dropped.

**Three sources, not two.** The compaction happened in two steps — 3320 → 198
(`e16da85`) → 122 (`bb0b0e7`) — and the second step dropped material the first
had kept: the full League Table / Last 10 product direction, CGPT's seven-point
handoff for it, and the ten-point NEXT list. The archive predates both, so that
material was in **neither** source and was recoverable only from the
intermediate commit. It is restored here, marked where it came from. **It is
also the spec for the task CCode is about to start**, which is how close this
came to being rebuilt from a five-line summary.

**One conflict, resolved and recorded rather than quietly fixed:** Section 2
said Tom/Fatch Reliability stays at 10% while the Decisions Log in the same
document recorded Shaun's change to 20%, applied in `4bbda90`. The archive was
internally stale. 20% is correct — later decision, what is stored, verified by
the audit. Section 2 now says so and keeps the 10% wording as superseded
history.

**Also folded in rather than duplicated:** the compact Ledger's one-line "CCode
— split-month League Table complete" handoff is a strict subset of the archive's
full "split-month League Table delivered" handoff below. The full version is
kept; nothing was lost.

`LEDGER_ARCHIVE_2026-09-20.md` is **unchanged** and remains the recovery
snapshot. This file is again the single authoritative Ledger.

### CCode — 20 Sep 2026 (NEXT #2 Players Directory refresh complete)

`43401f8`. **403 / 403 tests (81 browser).** Every point in Section 4's
direction is implemented; nothing in the engine, the tier semantics or
Reliability was touched.

What the screen does now: secondary filters fold behind
*"Filters · All tiers, all players"*, so the first player sits near the top of
an iPhone SE instead of below 411px of controls. Sort stays visible — it is the
primary control, not a secondary one. Tier chips wrap; **Tier C was previously
clipped off the right edge at 375px and is reachable again.** A row leads with
the name in the public serif, with `Tier B · 1460` as quiet sans-serif metadata
beneath it and a chevron; Inactive is badged, active is not. Letter headings
appear only when sorted A–Z.

**One real defect found and fixed while testing, worth recording:** a player
name is free text and was being written into the page unescaped. A name
containing `<b>` rendered as `ac` — two characters of somebody's identity
silently lost, and an injection surface. `escapeAttr` is now `escapeHtml` and
covers the rendered text as well as the data attribute. No live player name is
affected today; this was caught by a test, not by a report.

**Method note for CGPT/CChat:** all six new browser tests were verified to fail
against the pre-change Directory before being accepted. Three of them failed on
their first run — two were my own bugs (the profile sheet's heading is
`#sheetName`, not `#sheetTitle`) and one was the escaping defect above. The
geometry test also had to learn that `goToSection` hides the shared Rankings
chrome on a `setTimeout(0)`, so measuring in the same synchronous turn measures
a screen no user ever sees.

**Next for CCode: NEXT #3, the League Table refinement** — approved and
unblocked, not started.

### CCode — 20 Sep 2026 (Tom/Fatch audit complete; NEXT 2 and 3 not started)

`838ca66`. **397 / 397 tests.** Full findings in Section 5 — the short version:
**the numbers were never wrong.** Both active events anchor to 1400 at 20%, the
record replays to itself, and nothing the app renders mentions an individual
comparator. What Shaun saw is real, but it is in `HISTORICAL_REVIEW_DRYRUN.md`,
which announced itself as *"APPLIED"* and still showed the Jords anchor as fact.
Corrected there, with the superseded rows kept and marked.

**Worth knowing:** `scripts/apply-historical-decisions.js` would have undone the
20 Sep correction if anyone had run it with `--write`. It refuses now.

**Ledger history is preserved** in `LEDGER_ARCHIVE_2026-09-20.md`. *(That has
since been acted on: Shaun asked for the full Ledger back, and this document is
the merged result — see the handoff above.)*

**Not started, both approved and unblocked:** NEXT #2 (Players Directory visual
refresh) and NEXT #3 (League Table collapsibles + Last 10 form table). The audit
was flagged highest priority and is a natural stopping point; those two are
substantial UI pieces and each deserves its own pass.

### CGPT — 20 Sep 2026 (Players Directory + Tom/Fatch audit)

Shaun supplied the current Players Directory screenshot and requested a visual refresh consistent with the rest of Money Padel. Product direction is recorded above. This is a presentation refactor: preserve Directory/Compare, filters, sorting, status semantics and navigation.

Shaun also flagged that Tom/Fatch information still describes reassessment to Jords' level. This conflicts with the approved superseding historical decision. CCode must treat this as a **data/explanation integrity investigation first**, not simply replace a string. Verify stored event anchor = 1400 and reliability = 20%, verify replay/current rating, then locate stale UI/audit copy. Preserve explicitly-labelled superseded history but ensure current explanation is baseline-based. If numerical state is wrong, stop and report blast radius before repair.

**Baton → CCode. Approved and unblocked.**

### CGPT — 20 Sep 2026 (League Table progressive disclosure + Last 10 form table)

Shaun reviewed the September League Table on mobile after the split-month tier work landed.

Approved UI/product changes:

1. **League explanation collapsible.** Add a subtle disclosure/chevron around the explanatory copy directly below the `September 2026 League Table` heading. It must be possible to hide that copy so it does not permanently consume mobile space.
2. **By-tier breakdown collapsible.** The tier-table block can be collapsed/expanded as a whole. Preserve the existing `By tier` / `All together` selector and split-month allocation behaviour; collapsing is presentation state only.
3. **Last 10 form league.** Add a dedicated clean table built from each player's latest 10 rated games overall. This is deliberately different from Month = September: every player contributes their own most recent up-to-10 rated matches, irrespective of whether those ten occurred in the same dates/months as another player's.
4. Use normal league-table outcomes: P/W/L/D/GD/Pts, 3 points for a win and 1 for a draw. Keep the existing league sorting/tiebreak semantics unless implementation evidence shows they are unsuitable.
5. Players with fewer than 10 rated games show their actual sample (`P < 10`); do not pad or infer results.
6. This is **not** another Power Rating or Monthly Performance metric. Do not touch Sequential-v1, persisted expectations, rating deltas, Reliability or tier decisions.
7. Add targeted browser/module coverage for collapse state and for the Last 10 window (including a player with >10 games proving only their latest ten count, and a player with <10 proving the actual sample is shown).

**Baton → CCode. Approved and unblocked.**


### CCode — 20 Sep 2026 (split-month League Table delivered)

`49af41b`. **395 / 395 tests**, 75 in a browser. Screenshots regenerated. No
rating-engine, history or stored-fact changes.

**Each match is filed by `tierAsOf(player, matchDate)`** — before the effective
date is the old tier, on or after it the new one. That is the boundary the
engine's own tier history already uses, asserted against it in a test, so the
League Table cannot drift from every other temporal-tier surface. Points stay
where they were earned.

**Verified against the live record.** Rishi's 21 September games sit in **Tier
B**, Ant Slice's 5 in **A** and Jams' 3 in **C** — their old tiers, because every
September match predates the 20 Sep changes. Before this, all 21 of Rishi's
would have arrived in the A table carrying points earned against Bs.

**A judgement call worth recording, because it changes what Shaun sees.** All
three movers changed on 20 Sep and **none has played since**, so a label built
from the tiers they *played in* would read plain `B`, `A`, `C` — a September row
saying nothing happened in a month that plainly contained a move. The Ledger's
word is *"occupies"*, so the `All together` tier column is built from the
**recorded tier changes**, not from the dates they got on court. It reads
**`B → A`**, **`A → B`**, **`C → B`**. If Shaun wants it to describe only the
tiers actually played in, it is a one-line change.

**Generic, as required.** No player, month or tier is named anywhere in the
code. `leagueSplit.js` holds the decisions and knows nothing about the app; the
monthly aggregation gained an optional key that is **off by default**, so every
other caller is untouched. `V3_TIER_HISTORY` now keeps the whole history rather
than only the lookup — knowing *when* someone moved cannot be recovered by
sampling dates, and a second move in one month would have been missed.

**Coverage:** the boundary date, promotion and demotion, two moves in one month,
a return to a former tier, unknown tiers, and key round-tripping against
free-text names; plus a browser test that moves a real fixture player mid-month
and asserts two rendered rows, points that stay isolated and sum to the whole
month, and a single `All together` row.

**Baton → CGPT / Shaun.** NEXT is clear.

### CGPT — 20 Sep 2026 (split-month League Table treatment)
Shaun has now made the three emergency mid-month tier changes and approved the League Table treatment for any player who occupies two tiers within one month.

Required behaviour:
- classify each match by `tierAsOf(player, matchDate)`;
- `matchDate < effectiveDate` = old tier; `matchDate >= effectiveDate` = new tier;
- points/results stay in the tier where earned and never transfer;
- a player may appear in two tier tables in one month, each with only that segment's P/W/L/D/GD/points;
- `All together` stays one whole-month row and shows the transition such as `B → A`;
- implement generically, not by hardcoding Rishi B→A, Ant Slice A→B or Jams C→B.

Add regression coverage for transition directions, the effective-date boundary, isolated points, split rows and the single All-together transition row. No rating-engine changes.

**Baton → CCode. This is approved and unblocked.**

### CCode — 20 Sep 2026 (reconciliation: the validation fix is confirmed in live use)

`Ledger CCode` with NEXT empty, so this is a reconciliation pass rather than new
implementation. **No code changed. 385 / 385 tests, working tree clean.**

**The live record has moved since the last read, and the reason is good news.**
672 journey events, up from 666, with **no new matches** — Shaun recorded **three
monthly reviews** through the screen fixed an hour earlier in `352cd72`:

| | Effective | Re-anchor | Reliability | |
|---|---|---|---|---|
| Rishi | 20 Sep | 1464.2 → **1640.0** (+175.8) | chose **50%**, recommended 20% | **club override** |
| Ant Slice | 20 Sep | 1625.1 → **1460.0** (−165.1) | 20% = recommendation | accepted |
| Jams | 20 Sep | 1114.4 → **1320.0** (+205.6) | 20% = recommendation | accepted |

**Rishi is the exact flow Shaun reported as broken** — Override Reliability, a
percentage the system did not suggest, and a reason — and it went through. Every
audit requirement the decision asked for is present on all three: attributed to
Shaun, sourced to Admin Monthly Review, **both** the chosen and recommended
figures stored, the method named, and a reason recorded (*"Has played lots of
games with A-tier players"*, *"Hasn't met A tier standard since returning from
injury"*, *"Played well against As"*).

**This is also the first DEMOTION in the record.** Ant Slice, A → B, re-anchored
down 165 points. The demotion path had unit coverage but had never been exercised
by a person; it behaved correctly and the record still replays to itself.

**Record health:** 155 matches · 672 journey events · 34 players, **replay-to-self
0 differences, diagnostics 8/8**. Screenshots regenerated against it.

**Standing measurement (Open Question 1a).** The journey is **672 events**
against a review point of 5000. **Not due**, and roughly where the earlier
projection expected it.

**Nothing is queued and nothing is blocked.** The rating-model backlog and match
sharing in Section 5 remain parked and unauthorised, and both need a Shaun
decision before they become work.

### CCode — 20 Sep 2026 (live validation fixed; and a stale NEXT item corrected)

`352cd72`. **385 / 385 tests**, 73 in a browser.

**Reproduced before fixing.** Driving the reported flow showed
`incompleteReasons()` returning `[]` on the folded draft while the button sat
disabled and the warnings still asked for the percentage and reason that had
just been entered. Validation and the disabled state were computed while the
screen was being built and never again.

**Every review input now folds into the draft on `input` and refreshes the
warnings and the button in place.** In place, not by re-rendering: a re-render
on each keystroke takes the caret out of the field being typed into, and one on
blur can swallow the click that caused it. A second test types character by
character and asserts focus and content survive — that is the fix this fix could
easily have regressed into.

**The rating fields additionally rebuild the Reliability step**, because its
recommendation is priced against the anchor and was otherwise stale. That block
is rebuilt *only* for a rating change; rebuilding it while someone types into its
own field would destroy the field under them.

**Widened beyond the two fields named, deliberately.** The rating inputs had the
identical defect and it is upstream: typing a rating left the warning reading
*"an override needs a rating"* when a rating had just been given. Fixing two of
four would have left the same bug one field away.

The regression test is the reported flow exactly — Override Reliability → `50` →
a reason → warnings clear and the button enables — driven through real input
events with no manual re-render anywhere. **It fails against the code before this
commit**, which is the only way to know it tests the defect.

#### Conflict found and corrected in the Ledger

**NEXT item 7 reinstated work that is already done**, and described it wrongly:
*"Historical correction — Tom/Fatch B baseline remains approved … both historical
Reliability 10% … before live write."*

That correction was **applied at `4bbda90`** earlier the same day, at **20%**,
not 10% — Shaun changed it from 10% to 20% directly, and the Decisions Log rows
in the very same commit record both the application and the change. Item 7 is
leftover text from the earlier list, contradicting the Decisions Log in the same
document. Corrected, with the evidence, rather than re-run: re-applying it would
have overwritten a verified correction with a superseded figure.

**Baton → CGPT / Shaun.** NEXT is clear again.

### CGPT — 20 Sep 2026 (live validation bug in reassessment override)
Shaun found a UI-state defect in Admin Monthly Review:

- Override Reliability is chosen;
- a valid percentage (e.g. 50) is entered;
- a reason/note is entered;
- the form still shows the old missing-value warnings and keeps
  `Review what will be recorded` disabled.

Root cause from repo inspection: the input parser is correct, but validation
and disabled-state are computed during render and are not re-run when the
Reliability override or Note inputs change.

Fix behavior:

- on change/input for `reviewRelOverride` and `reviewNote`, fold values into the
  review draft and immediately re-run `MonthlyReview.incompleteReasons()`;
- refresh warning copy and the `Review what will be recorded` disabled state;
- do not require an extra tap, reselecting Override, or closing/reopening;
- preserve existing validation and methodology rules.

Regression test exact flow: choose Override Reliability → enter `50` → enter a
reason → warnings clear and stage button enables automatically.

### CCode — 20 Sep 2026 (card orientation settled: winners always on the left)

Shaun answered the open question from the canonical-tier work: **the winners are
always on the left, whatever the tiers say.** That is what the app already does —
the interpretation I flagged when narrowing the instruction was the right one, so
**no behaviour changed**.

What did change is the guard. The existing test only checked that winners sat
before `def`. It now pins the whole rule, on every card in the feed:

- every winner on the left, every loser on the right, nobody on both sides;
- **draws keep the orientation they were stored in** — they have no winner, so
  the "winners first" rule says nothing about them;
- and for a draw, the scoreline binding still names the side shown first. That
  is the part that would have broken silently: the live record's 5 draws include
  `Max (B) & Jams (C) vs Ant Slice (A) & Jords (B)`, where the side shown first
  is the *weaker* partnership. Reordering by strength would have left the card
  saying "Max & Jams first" above a scoreline written from the other side.

Tests **383 / 383**. Section 5 has no open questions left for Shaun.

### CCode — 20 Sep 2026 (Tom/Fatch re-anchor APPLIED at 20%)

`4bbda90`. Shaun approved the correction and changed the Reliability from the
previously decided 10% to **20%**. Applied to the live beta and verified from a
fresh re-read.

| | Anchor | Reliability | Now |
|---|---|---|---|
| Tom, 1 Jul | 1103.4 → **1400.0** | **20%** | **1387.8** |
| Fatch, 1 Aug | 1137.1 → **1400.0** | **20%** | **1377.9** |

**796 documents written, none removed.** Nothing was deleted: each correction
supersedes the decision it replaces, and all **7 superseded decisions remain** in
the record. Verified independently: **replay-to-self 0 differences, diagnostics
8/8**, 155 matches · 666 journey events · 34 players.

31 of 34 players moved; everyone other than Tom and Fatch by between +3.1 and
−1.1. Nine changed rank — Tom #25→#22 and Fatch #26→#23 past Shaun, Chloe and
Tarique, with Del/KC and Stormzy/Carla swapping.

**Board and system agree.** A re-anchor this size is past the full-reopen
distance, so 20% is exactly what the move-scaled rule recommends. The events
record **board 20% against recommendation 20%, by `move-scaled-v1`** — agreement
rather than an override, which is only visible at all because the historical
path started flattening the recommendation onto the event in `31ca6c1`.

**The correction invalidated the modelling the rule was chosen on, and the
script went on asserting the old conclusions.** Hard-coded prose still claimed
the three decisions were *"answered with the same reliability"*, and printed a
bound on `D` derived from the smallest observed move without checking it
actually fits. Both are now **derived from the data**, and the fourth instance
of the standing lesson that copy describing the record must be treated as code.

**What the record now says.** The three decisions remain one *situation* — all
near-whole-tier moves — but no longer one *answer*: Shaun 10%, Tom and Fatch
20%. **No single-floor rule reproduces all three**, and the script now searches
for a fitting distance and reports that none exists. The rule in use reproduces
**Tom and Fatch exactly** and differs only on **Shaun**, whose 10% predates the
20% floor and was already recorded as a deliberate divergence. **`D = 150` is
unaffected** — it rested on the half-a-tier argument, not on that fit.

`REASSESSMENT_RELIABILITY.md` and `tests/reassessmentReliability.test.js` are
re-derived, with the superseded figures kept and marked rather than rewritten.
Screenshots regenerated from the corrected record.

**Baton → CGPT / Shaun.** NEXT is clear. Still open and unanswered: the
card-orientation reading from the canonical-tier work.

### CCode — 20 Sep 2026 (Tom/Fatch re-anchor: preview ready, awaiting Shaun)

`Ledger CCode`. **Preview only — no live write has been made**, as the safety
condition requires. `31ca6c1`, tests **382 / 382**.
Run it yourself with `node scripts/correct-tom-fatch-anchors.js`.

The live record was re-read first: **155 matches · 662 journey events · 34
players**, and it **replays to itself**, so the correction can be planned on it.
(It was 156/664 at my last read — a further removal has completed cleanly since.)

**What is being replaced**

| | Now | Becomes |
|---|---|---|
| Tom, 1 Jul | anchored to Jords at **1352.5** | **1400.0** (+47.5 on the anchor) |
| Fatch, 1 Aug | anchored to Tom at **1358.6** | **1400.0** (+41.4 on the anchor) |

Reliability stays at **10%** for both, as decided. Both supersede rather than
replace: revision 3 on each PROMOTION, revision 2 on each
CLUB_RATING_REASSESSMENT, and the 7 superseded decisions stay in the record.

**Blast radius — 457 documents, 0 removed** (426 journey events, 31 players).
**31 of 34 players** end on a different rating:

| | |
|---|---|
| Tom | **+35.9** → 1386.9 |
| Fatch | **+34.5** → 1376.5 |
| Everyone else | between **+3.0** and **−1.1** |

**9 players change rank.** Tom #25→#22 and Fatch #26→#23 rise past Shaun
(#22→#24), Chloe (#23→#25) and Tarique (#24→#26); elsewhere Del/KC swap #5/#6
and Stormzy/Carla swap #20/#21.

**The corrected record replays to itself and passes 8/8 diagnostics** — verified
in memory, before any write.

**A defect found while previewing, and fixed.** Historical adjustments hand
their decisions straight to the engine as replay inputs; they do not go through
`ClubDecision.prepare`, which is where the monthly review flattens the
recommendation onto the event. The engine reads scalars, so the `recommendation`
object was silently dropped and **every historical adjustment ever written
stored a null recommendation** — the audit trail could not show whether the board
followed the system or departed from it. Now flattened, so this correction
records **board 10% against the rule's recommended 20%**, which is precisely the
case the audit exists for.

**Waiting on Shaun: approve this exact correction and I will apply it**, then
re-read, verify replay-to-self and diagnostics, and confirm Tom and Fatch's final
figures.

**Item 7 (repository truth) after the write, checked and scoped.** The
superseded anchors are encoded in two places that describe the LIVE record and
will need updating: `REASSESSMENT_RELIABILITY.md`'s table of the three decisions,
and the matching constants in `tests/reassessmentReliability.test.js`. The move
sizes become +296.6 (Tom) and +263.6 (Fatch), which widens the modelled bound on
the full-reopen distance from ≤222 to ≤263 — `D = 150` stays comfortably inside
it, so **the approved rule is unaffected**. Everything else that mentions the old
figures is a dated artifact of what was decided at the time
(`HISTORICAL_REVIEW_DRYRUN.md`, the Ledger's own history) or a synthetic/experiment
fixture (`tests/ui.test.js`'s audit trail, `tests/historicalReplay.test.js`'s
Experiment 12) and is correct as it stands.

### CGPT — 20 Sep 2026 (Tom/Fatch historical anchor correction)
Shaun corrected a prior historical board instruction.

- **Tom — effective 1 Jul 2026:** re-anchor to **1400**, the standard B-tier baseline.
- **Fatch — effective 1 Aug 2026:** re-anchor to **1400**, the standard B-tier baseline.
- Do **not** use Jords' rating for Tom or Tom's then-rating for Fatch.
- Keep the previously decided **10% historical Reliability** for both.
- Preserve the old decisions as superseded audit history; do not delete or mutate them silently.
- Use Historical Club Adjustment / replay-forward and recalculate every downstream
  affected rating, expectation and journey event chronologically.

Rationale recorded from Shaun: an individual comparator with a genuinely poor
record should not define the B baseline, because it materially distorts the
promoted player's distance from the rest of the tier.

**Safety/acceptance:** CCode must first produce the replay blast-radius preview
(old anchor → 1400 for each player, affected documents/players/current ratings)
before the live beta write, then apply only the exact approved correction and
verify replay-to-self + diagnostics afterwards.

### CCode — 20 Sep 2026 (Admin/Manage mobile refinement — all seven points done)

`Ledger CCode`. Commit `5bd7999`. **381 / 381 tests**, 71 in a browser.
Screenshots regenerated. Presentation and interaction only — no player data,
rating, tier, filtering, prediction or match-management behaviour touched, as
the scope guard required.

**Match cards.** `… Manage` now sits on the `Submitted by` line, right-aligned,
with the matchup taking the card's full width and the score on its own row. At
375px the matchup no longer wraps around the button. A browser test checks every
card in the feed: Manage in the submission row, never the title row, title width
equal to the card's, nothing clipped.

**Accordion.** Ten sections, one component, full header row as the tap target.
Several may be open. Every section collapses again whenever the screen is
**entered** — entered, not re-rendered: `renderManage` runs on every toggle,
staged decision and saved setting, and resetting there would slam a section shut
the moment it was opened. **The whole admin screen now fits on one phone
screen.**

**A defect that change introduced, and the test that now guards it.** Six
wirings in `renderManage` had always found their element present. A collapsed
section is not in the DOM at all, so the first render threw. All six now
tolerate absence, and a test opens and closes every section in turn.

**Player tags.** `Add a new player` keeps its card; `Existing players` is a
record list — name, tier summary, active pill, chevron — expanding in place to
the same three controls. Admin sans-serif, deliberately not the public serif
player styling, which made a maintenance list read like a leaderboard. The
starting-tier control takes its own row: *"Started: same as now"* has nowhere to
truncate to that still means anything, and it was being cut to *"same as nc"*.

**Headings.** Emoji icons removed from Admin/Manage, and the three sections that
built their own heading no longer repeat what the accordion header says.

**Scope note, deliberate:** three emoji headings survive OUTSIDE Admin/Manage —
`📋 Players worth calling out` (Insights), `⚡ Admin: add straight to Upcoming`
(Upcoming) and `🔒 Admin actions` (Games lock screen). The instruction was about
Admin/Manage, and the scope guard was explicit. Say the word and they go too.

**Also fixed in passing:** `Club override` still offered to set *"the rating
and/or reliability"*. Step 3 has owned Reliability since `2767782`.

**Baton → CGPT / Shaun** for on-device acceptance of the new Admin/Manage and the
narrow-iPhone match card. Still open and unanswered: the card-orientation
reading from the canonical-tier work (stronger-partnership-first applies to the
matchup label, not to the sides of a card, where order carries the result).

### CGPT — 20 Sep 2026 (Admin/Manage UX alignment)
Shaun reconciled the current screenshots with a separate GPT design pass and
approved the combined direction. CCode should treat this as one mobile-first
Admin/Manage presentation refactor:

- Match `Manage` moves to the `Submitted by` row;
- all major Admin/Manage sections become collapsed-by-default accordions;
- emoji-style admin heading icons are removed;
- Player Tags becomes an admin-style compact expandable record list;
- existing data and business logic remain untouched.

This work is approved and unblocked.

### CCode — 20 Sep 2026 (NEXT 13 done — Reliability is asked for and answered)

`Ledger CCode`. **377 / 377 tests**, 67 in a browser. Commit `2767782`.
Screenshots regenerated. **NEXT 11, 12 and 13 are now all delivered.**

**No stored field was added.** The journey event already carried
`recommendationRating`, `recommendationReliability` and
`recommendationMethodVersion` — they were simply never filled for Reliability,
because nothing recommended one. The audit trail the decision asked for was
already plumbed; what was missing was the question.

**What the board now sees.** Step 3 of the monthly review: the Recommended
Reliability with its band, the reason in plain English, and what it means in
practice (the K it implies and roughly how many matches back to 50%). Then
`Use the recommendation` or `Override Reliability`.

**Priced against the board's own anchor.** The recommendation follows the rating
the board actually chose, not the one the app suggested — so a club override
gets an honest answer rather than a number computed for a different rating.

**An override needs a percentage and a reason.** A percentage with no reason is
indistinguishable from a slip of the finger, and this is the permanent record.
The confirmation, before anything is written, reads either `(as recommended)` or
`(club override — the recommendation was 33%)`.

**A rating that moves must be answered for.** Unanswered, Reliability stays
where it was — after a large re-anchor that is stale confidence attached to a
number the board has just replaced, which is the quiet version of the mistake
this step exists to prevent. A rating that does not move needs no answer.

**Two things worth recording, both found rather than designed:**

- **Scope.** Requiring an answer broke Historical Club Adjustment outright: that
  screen has no step 3 and carries its own Reliability field, so it was being
  asked a question it never puts. The requirement is now scoped to the screen
  that asks it. Seven tests caught this immediately.
- **A duplicate input.** Looking at the rendered screen showed step 2's
  club-override block still had a Reliability field of its own, sitting above
  step 3 — the board could set it twice, differently, and only one would win.
  Step 3 owns it now. A blank rating under a club override is a move of zero,
  so the question stays available rather than vanishing with the field, which
  is how a confidence-only override is still made.

**Open, and Shaun's:** the card-orientation reading from the previous handoff
(stronger-partnership-first applied to the matchup label, not to the sides of a
card). Nothing is blocked on it.

**Baton → CGPT / Shaun.** Home visual acceptance from 19 Sep is still open. NEXT
is empty of implementation items; the rating-model backlog and match sharing in
Section 5 both remain parked and unauthorised.

### CCode — 20 Sep 2026 (NEXT 11 and 12 done; one instruction narrowed, deliberately)

`Ledger CCode`. Took NEXT #11 (canonical tier order) then #12 (the approved
reassessment Reliability rule). **369 / 369 tests**, 66 in a browser.
Commits `f26fa3a` and `aef42a7`. Screenshots regenerated.

#### NEXT 11 — canonical tier order (`f26fa3a`)

Not only presentation polish. Two real defects were underneath it:

- **`matchupKey` ordered the two sides by string comparison.** Alphabetically
  `S` sorts *after* `A`, so `SS vs AA` was being labelled and filtered as
  `AA vs AA`'s neighbour `AA vs SS` — the weaker partnership first, a label the
  club would never write. Now compared by tier strength position by position,
  which is exactly `SS > SA > SB > SC > AA > AB > AC > BB > BC > CC`.
- **The filter list was sorted by match count.** The option someone reached for
  last week moved as soon as more games were played. Now ordered by strength;
  counts stay visible and decide nothing.

`GameType.orderTeam` reads a partnership out stronger-first, keeping stored
order when partners share a tier, without mutating the caller's array. Wired
into `namesWithHistoricalTier`, which is every place a partnership is shown.

**One edge case the live record actually contains:** a singles match makes a
one-letter key (`A vs B`). A missing position ranks below every tier, so a lone
player sorts after every pairing opening with their tier — arbitrary but fixed,
and pinned, so the list cannot reshuffle later.

**INSTRUCTION NARROWED, and Shaun should confirm.** The rule says *"between
partnerships, display the stronger canonical partnership first"*. I applied that
to the **matchup label** and **not** to the two sides of a match card, because
on a card the side order is not free:

- on a decided match the first side is **the side that won** (`X def Y`), so
  swapping them turns a loss into a win;
- on a draw the first side is **the side the score is written from** — the card
  says so explicitly — so swapping them inverts the scoreline.

Neither is presentation-only, and both contradict the standing rule that a loss
must look like a loss. A browser test now proves the sides of a decided match
are never swapped. **If Shaun did mean card sides too, say so and I will do it
properly — it needs the `def` wording and the score binding to move with it.**

#### NEXT 12 — Recommended Reliability (`aef42a7`)

`reassessment.js` returned `recommendationReliability: null` on the grounds that
no validated method existed. There is one now:

```
reliability = min( prior, 0.20 + (prior − 0.20) × max(0, 1 − |Δrating| / 150) )
```

The `min` is load-bearing: without it a player already below 20% is **raised**
to the floor by a decision that only added doubt. Pinned by a property test
sweeping evidence and move size.

The recommendation follows **whatever anchor is on the table**, not only the
rating this module recommends, so the board's own override can be priced too. A
rating recommendation that cannot be made produces no reliability recommendation
either — there would be no move behind it.

**Recorded deliberately: the 20% floor does not reproduce the club's own
history.** Shaun, Tom and Fatch were each reopened to **10%** by board decision,
and all three were re-anchors past the full-reopen distance, so the rule now
recommends **20%** for those same inputs. Those stay recorded board decisions;
the board can still override to 10%. A test pins the divergence so a later
reader does not mistake it for a regression.

One existing test asserted the old "no reliability is fabricated" contract. It
was **replaced, not deleted**, with the new one.

#### Still open

**NEXT #13 is the next task and is a bigger piece than the rule was:** the
Use-recommendation / Override UX with attribution and reason, and storing
**both** the system recommendation and the board's final choice on the event.
That touches the event schema, so it deserves its own pass rather than being
tacked onto this one. Until it lands, the next validation of the rule still has
only three data points to work from.

**Baton → Shaun** for the card-orientation confirmation above; otherwise NEXT
#13 is mine and unblocked. Home visual acceptance from 19 Sep is still open with
CGPT.

### CGPT — 20 Sep 2026 (20% reassessment floor approved)
Shaun fixed the remaining move-scaled parameters: **D = 150 points** and
**20% as the system-generated minimum Reliability**. A reassessment move of
150 points or more therefore recommends 20%, not 10%. Smaller moves retain more
Reliability proportionally. Manual override remains available and audited.

This unblocks implementation of the reassessment Reliability recommendation.

### CGPT — 20 Sep 2026 (move-scaled Reliability chosen)
Shaun chose **move-scaled** Reliability for rating re-anchors. Flat 10% is no
longer an option for future reassessment recommendations.

Shaun has now fixed the remaining parameters: **D = 150 points** and a
**20% minimum/floor** for the system recommendation. At or above a 150-point
re-anchor, recommend 20%; below it, scale the Reliability reduction with move
size. Manual override remains available and audited.

### CGPT — 20 Sep 2026 (canonical matchup ordering + reliability question surfaced)
Shaun approved a single canonical tier-order rule for both Games display and
matchup filters: higher-tier partner first, stronger partnership first, with
stored match orientation left untouched. Filter options are sorted by tier
strength rather than frequency.

CCode's reassessment question is also explicitly preserved in Section 5:
**flat 10% vs move-scaled Reliability (recommended candidate D=150)**. For
promotion/demotion reviews this only applies when the board also re-anchors the
rating; a pure tier change / Keep current rating does not alter Reliability.

The Home refinement remains the first active item; canonical Games ordering is
queued immediately after it unless Shaun reprioritises.

### CCode — 20 Sep 2026 (reassessment reliability: modelled; one decision needed)

`Ledger CCode`. Home is delivered and its baton sits with CGPT/Shaun, so I took
the next unblocked item: the modelling NEXT #11 and CGPT's 20 Sep handoff both
name as the gate before implementation. **Analysis only — nothing implemented,
no engine behaviour touched.** `9ac4285`, tests **345 / 345**.

Full detail in Section 5 and `REASSESSMENT_RELIABILITY.md`. Three things worth
pulling out:

**The question was framed around promotions; the record says otherwise.** A
`PROMOTION` event changes the tier and nothing else — not the rating, not the
reliability. Only the anchor decision reopens it. The recommendation belongs to
the board **replacing a rating**, not to a tier move, and it is about confidence
in the number the board chose rather than the player's experience. That reframing
dissolves Ledger question 3: corrections and promotions do not need different
treatment, because what varies between them is the size of the move.

**The data settles less than three observations sounds like.** All three are the
same situation — a 74–88% of a tier move — answered with 10% every time. They
fix one point of any rule. What they *do* settle, decisively, is that
**proportional discounting is wrong**: Fatch carried three and a half times
Tom's evidence into his reassessment and got the identical answer.

**The surviving rules are indistinguishable on everything decided so far and
differ sharply on what comes next.** A 30-point correction to a twenty-match
player: flat says 10% (K 37), move-scaled says 55%. Under the flat rule a small
board correction leaves an established player *more* volatile than a newcomer.
That is the case to decide on, and it is a judgement about what the club means
by a correction — Shaun's call, not one the data makes.

**A bug found in my own candidate while testing it:** the unclamped move-scaled
form *raises* reliability for anyone already below 10%. Reassessing a rating can
only add doubt. Clamped, and pinned by a property test sweeping evidence and
move size, so whichever rule ships cannot lose it.

**Baton → Shaun** for the flat-vs-move-scaled decision, and CGPT for the
still-open Home visual acceptance from 19 Sep.

### CGPT — 20 Sep 2026 (reassessment reliability recommendation)
Shaun clarified the desired future reassessment flow: the club is comfortable
judging **where a promoted player should sit**, but not inventing a Reliability
percentage.

Product direction: system-generated Recommended Reliability first, with a
manual Admin override still available. Overrides must be explicit and audited.
The exact recommendation formula is intentionally **not frozen yet** and is
parked for modelling/validation before implementation.

This does not supersede the active Home refinement task.

### CCode — 20 Sep 2026 (record health: detected, logged, and told to the right reader)

**Shaun's decisions, taken in chat and recorded here:** the app should detect
and report a diverged record; the detail goes to **him only**; the **repair
stays with CCode**, who shows the plan first. No repair action in the app.

Built in `58c880b`. Tests **335 / 335**, 64 in a browser.

**A material discovery that shaped it.** The app has two admin passwords —
Shaun's (`owner`) and a separate **board** password — but `isUnlocked` was a
single boolean and recorded nothing about which one was used. "Admin" has never
meant "Shaun". There was no way to show something to him and not to the board
until now; `adminRole` fixes that, and currently gates exactly one thing. Board
powers are otherwise unchanged and nobody asked for them to be.

**Detection.** Once a session, after the first render, for whoever opens the
app — so a problem is found the same day rather than whenever somebody next
tries an edit. It costs **no Firestore read**: the record is already in memory,
and `v3Bridge` now keeps the documents *as stored* beside the shapes the app
uses, which the legacy conversions had lost. It replays the whole history
(~25–60ms on a desktop, a few hundred on a phone), so it stays off the critical
path.

**Logging.** One document per **distinct** divergence in a new `healthReports`
collection. The id is derived from what differs plus the true count, so four
people on four phones leave one report saying it was seen four times, the first
sighting is what dates it, and two divergences that share a first forty ids but
differ in size stay separate. A report that was closed and reappears is open
again — it was not fixed, whatever anybody recorded.

**Two readers.**

- **Board:** *"The record needs repair, so editing is paused. This has been
  logged (ref) and nothing you did caused it. Nothing has been lost."*
- **Owner:** what diverged, where, across which dates, how many documents and
  players, that **no match is affected**, plus the log reference, when it was
  first seen and who has met it.

`plan()` now carries the document ids on the error rather than concatenating
them into its message, so who sees what is the caller's decision rather than a
string's.

**Where it shows.** The Beta diagnostics screen, above the checks. Both views
were rendered and looked at, not reasoned about.

**One thing Shaun has to do once.** An unlock stored on a device before this
change has no recorded role and is treated as **board** — the lesser of the two,
so a stale value can never hand someone the owner's view. Locking and unlocking
once with his own password restores owner.

**Still true, and worth keeping in view:** batching (`fc33a44`) removed the
cause of the incident that prompted this. Detection is for the next cause,
whatever it turns out to be.

**Baton → CGPT / Shaun.** Home visual acceptance from 19 Sep is still open.

### CCode — 20 Sep 2026 (the live record was half-written; found, measured, repaired)

**Shaun's second removal was refused:** *"Replaying the record unchanged does not
reproduce it (145 difference(s))."* The refusal was the safety rule working.

**I had told him the day before that the first removal completed and the record
was sound. That was wrong.** I checked the `matches` collection, saw 156, and
concluded the whole write had landed. Deletions run first, so that one
collection looked finished while 145 of the 509 derived documents had never been
written. Checking one collection is not checking the record.

**What it was.** The removal wrote 364 of 509 documents and stopped — the app
was closed part-way through ~500 one-at-a-time writes, before batching landed in
`fc33a44`. Every match was intact. The journey before 2026-09-03 was correct;
114 events from 2026-09-03 to 2026-09-17 and 31 player documents still held
pre-removal values.

**What made the repair safe to propose.** Replaying the 156 stored matches
reproduced, player for player and number for number, the *same* 31 movements
Shaun's original confirmation screen had shown him. The repair was not a new
decision about what happened; it was the arithmetic of the removal he had
already authorised, finished. Full detail and the verification are in Section 5.

**Built for it, and kept:**

- `ReplayForward.planRepair` — the write-only plan that brings a record back into
  agreement with its own history. Never deletes: `wouldDelete` is reported
  instead, because a repair needing a deletion is not a partial write. Superseded
  decisions are excluded, or the first repair after any correction would delete
  the audit trail that superseding exists to protect.
- `scripts/repair-replay-divergence.js` — dry run by default, `--write` to apply,
  then re-reads and verifies replay-to-self and diagnostics.
- The browser harness now loads an arbitrary record, which is how the live
  divergence was reproduced here rather than reasoned about. It is also how the
  `All games (1)` Shaun saw was settled: the live record renders all 156 games
  under default filters, so that was a filter he had set, not data loss.

**Tests 321 / 321.** The repair path is covered by a test that half-applies a
real plan, confirms the record then refuses every edit, repairs it, and checks
the result equals what the completed write would have left.

**Two things worth keeping.** First, batching (`fc33a44`) removes the cause: 634
documents now leave in two atomic batches, so there is no long window in which
closing the app leaves a half-written record. Second, the app can still *reach*
this state by other means and has no way out of it — see the open follow-on in
Section 5.

**Baton → CGPT / Shaun.** Home visual acceptance from 19 Sep is still open.

### CCode — 20 Sep 2026 (a removal that looked stuck; replay writes now batch)

**Raised by Shaun from the live beta, not from a test.** He confirmed a removal
(`Osh vs Len`, 2026-07-03), watched the confirmation panel, and asked what was
supposed to happen next. Nothing visible was happening. The write had in fact
already completed: a live re-read shows **156 matches**, one fewer than the 157
recorded on 18 Sep, and the only match left on that date is `2026-07-03-2`.

**The record is sound. The feedback was not.** Three defects, all mine, all
fixed in `fc33a44`. Tests **318 / 318**, 59 in a browser. Screenshots current.

**1) ~500 sequential round trips.** `ReplayForward.commit` awaited every
document individually. Removing a June match rewrites **634** documents, so a
removal was 634 round trips — minutes on a phone. It now batches: a backend
exposing `commitBatch` writes 500 operations per round trip, so those 634
documents leave in **two** batches, each atomic. Backends without it keep the
one-at-a-time path, so the REST backend used by the seed and import scripts is
unchanged. `diffDocs` derives deletions as "present before, absent after", so
deletes and writes are disjoint and a batch's atomicity is safe — `commit` now
**checks** that rather than assuming it, because a future change to `diffDocs`
would otherwise silently break the delete-before-write ordering.

**2) The progress was rendered off-screen.** The only feedback, `Writing…`, went
into `#gamesMessage` in the admin block at the **top** of the Games tab, while
the confirmation panel sits deep inside an expanded match card. From where the
operator is actually looking, a disabled button was the entire signal. The panel
now carries its own progress line (`Removing… 500 of 634 documents`), the button
reads `Working…`, and Cancel is disabled while the write runs. The outcome is
shown in a dismissible banner above the bottom nav — necessary rather than
decorative, because a **removal deletes the card the action was started from**,
so there is no panel left to report into.

**3) A removal reported itself as a correction.** The success message read
`Corrected and replayed` for a deletion — the same confusion already fixed in the
heading and the button label, left behind in the one string nobody had looked at
because it only appears after a successful write.

**The test stub gained a working `batch()`.** Without it the suite would have
exercised the one-at-a-time fallback while the application took a batched path
nothing covered — the same class of gap as the Last Time Out defect the day
before. The new browser tests assert the operation count leaves in the expected
number of batches, that progress is written into the panel and names the action,
and that a removal and a correction each describe themselves correctly.

**Pattern worth recording.** Three defects in two days, all in code whose module
tests passed, all found by looking at the rendered screen — and this one only
because Shaun was watching a real phone over a real network. Local latency hides
this class of defect completely.

**Baton → CGPT / Shaun.** Nothing blocked. The Home visual acceptance from
19 Sep is still open.

### CCode — 19 Sep 2026 (Home lower section rebuilt; a commentary defect found by looking)

**All five parts of the Home task are done.** Commits `af84d87` (the work) and
`f5d4095` (a defect found afterwards, below).

| | |
|---|---|
| Commits | `af84d87`, `f5d4095` |
| Tests | **316 / 316**, 57 in a real browser |
| Screenshots | regenerated, 17 including the new `00-home.png`, 0 page errors |
| Engine / stored ratings | untouched, as required |

**1) Club Pulse is actionable.** Every card carries a chevron and
`data-pulse-player`, and opens that player's profile. `All Insights` now enters
the Insights area at the top rather than part-way down the Call Outs content:
it clicks the legacy tab and then resets both the view's own scroll and the
window's, because the old tab/scroll state was what landed it mid-page.

**2) Match ideas is collapsed by default.** `Balanced games suggested for you` /
`Show suggestions ›`, remembering its state for the session. The underlying
matchup logic is unchanged — this was hierarchy work, not a new recommender.

**3) Next on Court is gone, replaced by Last Time Out.** Built from the player's
most recent rated v3 match: date, historical tier, teams, scoreline oriented so
a defeat reads as one, one commentary line, the engine's own per-player rating
movement, and `View match ›`.

`View match` needed two fixes that only appeared once it was clicked. A draw
opened an empty profile, because draws are deliberately absent from `MATCHES`,
which the profile's match log is built from — it now falls back to the Games
feed. A September match was then filtered out by the Rankings month scope, which
the profile sheet shares; the month is widened around the synchronous sheet
build and restored immediately after.

**4) The monthly snapshot and `View Full Review` are unchanged.**

**5) Match sharing is recorded in Section 5** as product backlog, not started
and not authorised, per the instruction not to block this pass on it.

#### The commentary was wrong, and only the rendered screen said so

The line under each result is chosen by `lastResult.js` from facts the engine
already recorded. Its own tests passed throughout. The screenshot showed
`Not your day. On to the next.` under a 2-6, 3-6, 0-6 defeat — five games out of
twenty-three, which is `Tough one. Time to run it back.`

The card summed its game counts from `games_winner` / `games_loser`. Those exist
only on **enriched** matches; `getDisplayMatches()` returns stored ones. Both
were `undefined`, the game share arrived as `null`, and **every** defeat —
however lopsided — fell through to the same generic line. The counts are now
summed from the stored sets.

Fixing the inputs exposed a second, quieter error in the same branch: it
compared a share of games against `expected`, which is the engine's expected
**performance** score (0.80 × game share + 0.20 × result), not an expected share
of games. Two different measurements — the exact confusion the rest of the app
was cleaned up to avoid. It now compares `actual` against `expected`, both read
back from the record, and the game share is only ever compared against the
game-share bands.

This is the third defect in this refinement run that module tests could not
reach and looking at the screen caught immediately. The new browser test rebuilds
each player's facts straight from the record and asserts the rendered line
matches, and it fails if every player lands on the same line — which is what the
broken version did.

Also: `#homeDashboard` was created lazily by the first `render()`, so entering
Home before that (deep link, scripted navigation, the screenshot script) threw on
a null dereference. It is now built on demand.

**Baton → CGPT / Shaun** for visual acceptance of the Home screen. The
screenshots are current. Nothing is blocked on my side; the rating-model backlog
in Section 5 remains parked and match sharing needs a product decision before it
can be scheduled.

### CGPT — 19 Sep 2026 (Home usefulness refresh)
Shaun wants the lower half of Home simplified around things that are reliably
useful.

Club Pulse stays visible but becomes actionable (cards → profiles; All Insights
→ top of Insights). Match to Make becomes a collapsed Match ideas section.
Replace manually dependent Next on Court with an automatic Last Time Out card
from the selected player's most recent rated match, including score, rating
movement and one short factual/lighthearted comment.

WhatsApp/native sharing for suggested/requested matches is recorded as follow-on
work, not a blocker for this pass.

**Baton → CCode.** Implement Home hierarchy/interaction refresh only; no engine
changes.

### CCode — 19 Sep 2026 (ranking-pool toggles corrected; Games tier context)

**Both done. Baton to CGPT/Shaun.** No rating-engine changes, no stored-rating
changes, and the 2+/30-day eligibility rule is untouched.

#### 1. Include idle / Include inactive now widen the ranking pool

The correction is right: a separate section underneath answered *"who else
exists"* when the question being asked is *"where would they sit"*.

Two toggles replace the two status selectors. Off, the list is the official
current ranking pool — Ranked and Active. On, that group is **merged into the
same ordered list**, sorted by rating, with a filtered-view rank position and
its `IDLE` / `INACTIVE` badge kept. Both on, all three states appear in one
ordered list.

From the record, exactly the behaviour Shaun described:

| | official pool | + idle and inactive |
|---|---|---|
| 1 | Kaz | **Manny** `IDLE` |
| 2 | Erf | Kaz |
| 3 | KC | Erf |
| 4 | Osh | KC |
| 5 | Len | **Del** `INACTIVE` |
| 6 | Dennis | Osh |

A line at the top of the widened view says the positions are for that view and
not official ranks.

**Nothing official moves.** There is a test that every player's participation,
ranking state, rank availability and rating is byte-identical with the toggles
on and off — the toggles change which pool is being looked at, and nothing else.

#### 2. Games: historical tier labels and tier-composition filters

```
collapsed   Antz (B) & Len (A) def Max (B) & Stormzy (B)
expanded    Antz (B) 1407 & Len (A) 1675 vs Max (B) 1401 & Stormzy (B) 1377
```

The tier is the one the player **held on the day**. The temporal lookup was
previously built inline and handed only to `MONTHLY_VIEWS`; it is hoisted to
`V3_TIER_AS_OF` so the labels and the classification read one source — a label
and a classification that disagreed would be worse than either alone.

`assets/js/gameType.js` canonicalises **twice**, and the second time is the one
that matters: within a team (`A&B` and `B&A` are both `AB`), and then *between*
the teams, so `AB vs BB` and `BB vs AB` are one game type. Without that second
step a filter for `AB vs BB` would silently miss every match stored the other
way round.

The control offers only what the current Month + Player selection actually
contains, with counts — `All A games (11)`, `All B games (32)`, `All C games
(3)`, `Mixed-tier games (104)`, then `BB vs BB (32)`, `AB vs AB (30)`,
`AB vs BB (27)`, `AA vs AA (10)` and so on, including singles (`A vs B`) and
Tier S (`AA vs SA`). A type that stops existing under a narrower selection falls
back to *All game types* rather than showing an empty list.

**All three filters compose.** Month = All time, Player = Len, Game type =
`AB vs BB` gives **10 matches**, every one of them genuinely both — asserted
against the same classifier, not by eyeballing the list.

Deliberately non-evaluative: no *easy*, *soft* or *inflated* anywhere, with a
test that keeps it that way.

| | |
|---|---|
| Tests | **299 / 299** (45 in a real browser) |
| New | 8 `gameType` module tests (orientation independence, unknown tiers, singles, generated options, no judgements); browser tests for tier labels on collapsed and expanded cards, a promotion not rewriting an older card, Month+Player+Game-type composition, and options never offered empty; plus rank re-numbering with each toggle individually and together |

**Screenshots remain outstanding.** The beta's Firestore daily read quota still
has not reset — `players` and `matches` are cached, the 666-event
`ratingJourney` still 429s. Three shots continue to show superseded wording and
the README names them. I verified this work by rendering from the seeded fixture
locally instead.

### CGPT — 19 Sep 2026 (include-state ranking behavior)
Shaun clarified the intended filter semantics: Idle/Inactive inclusion should
merge those players into the main visible ranking and re-rank that filtered
pool, not show them as separate lower sections.

Keep status badges so the distinction remains visible, but filtered-view rank
positions should behave exactly as if those players were eligible/active.

This clarification should be implemented alongside the current refinement work.

### CGPT — 19 Sep 2026 (Games historical tiers + game-type filter)
Shaun wants Games to expose the tier context that existed when each match was
played, and to make that context filterable.

Add historical tier beside every player name on collapsed/expanded Games cards,
using the same temporal-tier helper already used elsewhere. Add a composable
`Game type` filter for broad all-A/all-B/all-C/mixed environments and specific
canonical matchup types such as `AB vs BB`. It must combine with Month and
Player selection.

**Baton → CCode.** Implement this as UI/data-presentation work only; no rating
engine changes.

### CCode — 19 Sep 2026 (Ranked / Idle / Inactive; eligibility bug confirmed)

**Done. Baton to CGPT/Shaun.** No Sequential-v1 changes, no historical rating
changes, and the 2+/30-day rule is unchanged.

#### The verification the Ledger asked for, first

**Ant Slice has EIGHT rated v3 matches in the rolling 30 days to 2026-09-19** —
four times the threshold. So the `#– in Tier A · #– Overall` on Home **was a
bug**, and he was not alone: **Dennis, Chloe, Jams and Aubyn** were all
ranking-eligible and all showed no rank.

| player | lifetime rated | in 30-day window | showed a rank? |
|---|---|---|---|
| Ant Slice | 8 | **8** | no — bug |
| Dennis | 9 | 3 | no — bug |
| Chloe | 7 | 3 | no — bug |
| Jams | 8 | 3 | no — bug |
| Aubyn | 5 | 2 | no — bug |

**Cause.** `getViewerSnapshot` filtered on `x.total>=10 && isRankingEligible(…)`.
That `10` is the rankings list's **default min-games display filter**, not an
eligibility rule. A display filter must never decide whether somebody has a
rank. `computeClubPulse` carried the same stray condition, so Club Pulse could
name a "top ranked" player the rankings list did not have at the top.

**A second divergence, found while centralising.** `isRankingEligible` counted
`MATCHES`, which deliberately excludes draws. **A draw is rated** — it moves
every player in it — so eligibility depended on whether a player's recent games
happened to finish. Aubyn sits exactly on that line right now: **2** in the
window counting the draw, **1** without.

#### The state model

Two dimensions, neither derived from the other:

| | |
|---|---|
| **PARTICIPATION** | `ACTIVE \| INACTIVE` — explicit club status, already in the data as `BASE_ACTIVE` / `p.active`, already admin-editable |
| **RANKING** | `RANKED \| IDLE` — derived, and only for ACTIVE players |

`assets/js/playerState.js` is the single authority. It reads the **v3 rated
set** (draws included) over a rolling 30 days, and `isRankingEligible`,
`getViewerSnapshot`, the rankings divider, Home and Club Pulse all go through
it. An INACTIVE player has `ranking === null` rather than `IDLE`: they are not
sitting out, they are not in the running, and "Idle" would imply they are coming
back.

No new data field was needed — the participation flag already existed and seven
players carry it (Twoshay, Del, Kam, bruh, Kevin, Abby, Alfie).

#### The UI

Players below the threshold now read **IDLE** in gold, under *"Idle players —
fewer than 2 matches in the last 30 days"*. They are still members, and the old
`Inactive` tag read as "this player has left". True inactive players get their
own section, *"Inactive players — not currently participating"*, hidden unless
asked for.

Two independent filters — **Ranking status** (Ranked / Include idle) and
**Player status** (Active / Include inactive). Defaults preserve exactly what a
player sees today. Verified against the record:

| filters | rows | idle | inactive |
|---|---|---|---|
| default | 33 | 13 | 0 |
| Ranked only | 20 | 0 | 0 |
| + inactive | 34 | 13 | 1 |
| Ranked + inactive | 21 | 0 | 1 |

**One collision fixed on the way in.** The min-games presets were wired with an
unscoped `document.querySelectorAll('.preset-btn')` — a shared button style.
Adding the state filters would have meant a min-games press clearing their
selection, and a state-filter press feeding `parseInt(undefined)` into
`minGames`. Both selectors are scoped now, with a test that they do not fight.

| | |
|---|---|
| Tests | **283 / 283** (41 in a real browser) |
| New | 8 module tests for the state model; 5 browser tests — the Ant Slice case by name, cross-surface agreement for every player in the list, Idle-not-Inactive wording, all four filter combinations, and the button collision |

**Screenshots are still outstanding.** The beta's Firestore daily read quota has
not reset; `players` and `matches` are cached, the 666-event `ratingJourney`
still 429s. Three shots continue to show superseded wording and the README names
them. I verified the new Idle and Inactive sections by rendering them from the
seeded fixture locally instead.

### CGPT — 19 Sep 2026 (Ant Slice eligibility consistency)
Shaun identified a likely ranking-eligibility inconsistency: Ant Slice shows
`#–` on Home even though he has recent match activity.

CCode should verify his actual rated-match count in the rolling 30-day window
before changing data. If 2+, the Home state is wrong. Regardless, ranking
eligibility must be centralized so Home, Rankings, Profile and Club Pulse cannot
disagree about Ranked vs Idle.

This is part of the active Ranked / Idle / Inactive cleanup, not a rating-model
change.

### CGPT — 19 Sep 2026 (Ranked / Idle / Inactive states)
Shaun approved a terminology/state split for Rankings.

**Ranked** = active and currently eligible for live rankings. **Idle** = still
part of Money Padel but below the recent-match threshold. **Inactive** =
explicitly not currently involved at all.

The key architecture point is that participation status and ranking eligibility
must be independent. Recent inactivity may make an active player Idle; it must
never automatically make them Inactive.

Add independent filter controls for Idle and Inactive, keep true Inactive
players hidden by default, and relabel the current lower ranking section from
Inactive to Idle.

**Baton → CCode.** Implement terminology/state/filter cleanup with tests; no
rating-engine changes.

### CCode — 19 Sep 2026 (compact Games card; `See full calculation` fixed)

**Both done. Baton to CGPT/Shaun.** No change to Sequential-v1 or stored
history, and no second calculation path.

**`See full calculation` was inert, and the cause was structural.** The Games
card wraps its body in `.game-card-clickable`, whose handler toggles the card
and re-renders the whole tab. A click on the disclosure's summary bubbled up to
it, so the card collapsed and re-rendered *before the browser could open the
details* — nothing appeared to happen. It worked on the profile card only
because that card has no click handler, which is precisely why it was missed.

Both card handlers now ignore clicks originating inside a `<details>`. The new
test asserts the disclosure opens **and that the card underneath does not
collapse**, which is the half that was actually broken.

**The expanded card is now the requested hierarchy and nothing else:**

```
Antz (1407) & Len (1675) vs Max (1401) & Stormzy (1377) (ratings going in)
winners favoured by 152 pts going in
Expected 71% of games · won 13/20 (65%) · won match
RATING CHANGE, PER PLAYER
Antz +0.3 · Len +0.2 / Max -0.2 · Stormzy -0.3
Each player moves by their own amount: ...
See full calculation ›
```

The sentence between the result line and the per-player movements is gone. It
was explaining the model rather than the match.

**One disclosure builder** now serves the profile, the monthly breakdown and the
Games feed, so three cards cannot drift into describing one match differently.
It reads `V3_MATCH_FACTS` and shows the expected score, the share of games won,
the **match result contribution as its own row**, the blended score written out
as `0.80 × 0.65 + 0.20 × 1.00`, the difference, and then each player's own K,
reliability before → after and movement. With a named player it also closes the
loop: `K × (performance − expected)` = the movement shown above.

That disclosure answers the question the compacted card deliberately leaves
open — why **+0.3** after winning *fewer* games than expected: expected 0.71,
games 0.65, result 1.00, blended 0.72, difference +0.01.

| | |
|---|---|
| Tests | **270 / 270** (36 in a real browser) |
| New tests | the disclosure opens and closes without collapsing its card, and carries the expected technical rows · the expanded card is materially shorter, carries the one-line expectation/result, and no longer repeats the model explanation |

**Screenshots still could not be regenerated.** The beta's Firestore **daily
read quota** is exhausted (429 `RESOURCE_EXHAUSTED`). `players` and `matches`
now read and are cached; the 666-event `ratingJourney` is still blocked. The
cache is per collection now, so a failure on the expensive read no longer throws
away the two that succeeded — **the next attempt costs one read rather than
three.**

Three shots show superseded wording and the README names them:
`05-match-card`, `06-monthly-breakdown`, `15-why-your-rating-moved`.
(`10b-games-correction` was previously flagged too; it shows only collapsed
cards, so it was never affected — that flag was over-cautious and is withdrawn.)

### CGPT — 19 Sep 2026 (compact Games card + full calculation bug)
Shaun reviewed the latest Games breakdown. The wording is now directionally
correct, but the card still contains too much explanatory prose. Remove the
redundant sentence between the expectation/result summary and per-player rating
changes.

Also, `See full calculation` currently does nothing. This is a functional bug,
not a copy preference. Make it an in-card disclosure backed by the same
persisted match/journey facts already used for the rating movement.

**Baton → CCode.** Compact the card and fix the disclosure; no engine changes.

### CCode — 19 Sep 2026 (wording correction, and a read-quota finding)

**Done. Baton to CGPT/Shaun for copy acceptance.** Copy and presentation only:
no change to Sequential-v1, expected-score mathematics, K, reliability or stored
history.

**Shaun is right, and it is the objection I raised yesterday resolved the other
way round.** Sequential-v1 compares a *blended* actual score — 80% game share,
20% the match result — against a single expectation from the four ratings. A
team can match its expected game share **exactly** and still move up, because
the win contributes separately. Calling that "performed above expectation" is
false: nothing about the games beat the expectation.

So the plain layer no longer gives a blended verdict at all. It states two
observable things and never mixes them:

> **Your team were favourites.**
> Based on the four players' ratings, you were expected to win about **60%** of
> the games. You won **18 of 30 games (60%)** and won the match.
> **You matched the game-share expectation.** The match result also contributes
> to the rating calculation.
> **Your rating moved +2.9.**

The four verdicts are game-share comparisons only — *matched the game-share
expectation* / *won about the expected share of games* / *won more games than
expected* / *won fewer games than expected*. The movement is stated as a fact
beside them rather than as their consequence, which is exactly what it is not.
Per-player movements follow, on profile cards as well as monthly ones.

The same rule now applies on the neutral Games card, where the live record shows
why it matters: expected 71%, took 13 of 20 (65%), won the match — now
*"Winners won fewer games than expected. The match result also contributes to
the rating calculation"*, with a small positive movement underneath. It
previously read "performed about as expected", which was a blended claim
dressed as a claim about games.

The small print no longer implies the expected side contains its own match
result expectation: *"The match result is a separate input: your score for the
rating is 80% the share of games you won and 20% the result itself."*

Whether the expectation should itself model a match result is **Open Question
backlog item 3**, and this pass deliberately does not touch it.

| | |
|---|---|
| Tests | **268 / 268** (34 in a real browser) |
| New test | Shaun's case exactly — 60% expected, 18/30 won, match won, blended residual positive and the rating up — asserting the copy says "matched the game-share expectation" and never "above expectation", "exceeded expectation" or "pushed you above" |

---

**A finding that needs recording: the beta exhausted its Firestore daily read
quota today** (429 `RESOURCE_EXHAUSTED`). The cause is mine —
`scripts/screenshots.js` re-read all 857 documents on every run, and between the
import verification and a dozen capture runs while iterating on copy, that is a
great many reads in one session.

Fixed at the source: the script now caches the live record to disk and reuses
it, so iterating on captures costs nothing (`--refresh` forces a fresh read),
and its reads are sequential with backoff rather than three at once — three
parallel reads of the whole record is itself enough to earn a 429.

**Consequence, stated rather than hidden:** the quota had gone before the cache
existed, so three screenshots could not be regenerated and still show the
superseded wording — `06-monthly-breakdown`, `10b-games-correction` and
`15-why-your-rating-moved`. The README says so at the top and points at the test
that covers the corrected copy. **Re-run `node scripts/screenshots.js --refresh`
once the quota resets**; CCode will do it on the next `Ledger CCode` if nobody
has.

This does not affect Open Question 1a: that exception is about the app's
once-per-session journey read, which is unchanged and still well inside its
review threshold. The quota went on tooling, not on the product.

### CGPT — 19 Sep 2026 (wording-only refinement; model backlog parked)
Shaun wants the current refinement phase to stay focused on presentation, not
rating-model changes.

Immediate fix: correct the plain-English rating explanation so game-share
expectation and the separate 20% match-result contribution are described
truthfully. A team matching its expected game share must not be labelled as
`above expectation` solely because it won the match.

The broader model questions — small movements/reliability curve, sustained
winning, expectation symmetry, and a possible `Prove It` volatility mechanic —
are now explicitly parked in Section 5 for later evidence-led review.

**Baton → CCode for wording correction only.**

### CCode — 19 Sep 2026 (plain-English explanations; Games month defect)

**Both items done. Baton to CGPT/Shaun for copy acceptance.** Sequential-v1 is
untouched and every figure is read back from the facts recorded when the match
was rated.

**1. Player-facing explanations now lead in padel language.** The four lines run
in the order a player thinks in, and the decimals moved one level down:

> **Your team were slight favourites.** Based on the four players' ratings, you
> were expected to win about **53%** of the games. You won **60%** of the games
> and won the match. **You performed above expectation → +5.7 rating points.**

From the live record, the case players actually write in about:

> **Your team were underdogs.** Based on the four players' ratings, you were
> expected to win about **32%** of the games. You won **52%** of the games but
> lost the match. **You still exceeded expectations → +3.6 rating points.**

**The honesty rule is built into the copy, not bolted on.** The engine's
expectation is the target for a *blended* score — 80% games won, 20% the match
result. Quoting it as "expected to win about 53% of the games" is the
simplification the club approved, so **every sentence that quotes it also states
the result** ("and won the match", "but lost the match"), and a line of small
print names the blend. Crucially, **the verdict is never derived by comparing
the two percentages** — they measure different things. It comes from the
residual the engine recorded, so it cannot contradict the movement printed
beside it.

A real card shows exactly why that matters: expected **71%**, took **65%**, won
the match → *"performed about as expected"*. Comparing the percentages would
have called that an underperformance; the recorded residual is +0.01, because
the win carries 20%. The disclosure shows the 0.72 against 0.71.

**`See full calculation`** now holds games won, the exact delivered and expected
performance scores, the difference, K, and reliability before → after, plus the
arithmetic. No raw performance-score sentence is left in front of a player on a
profile card, a monthly card or the Games feed — a test sweeps all three.

**2. Games month — the correction found a real defect.** The Ledger asked to
*retain* coverage that Play → Games opens on All time. **It did not.**
`selectedMonth` was a single global shared with Rankings, and Rankings sets it
to the last completed month at boot, so Games was opening on **August**. Games
now keeps its own `gamesMonth`, defaulting to All time and never following the
monthly views. Users can still pick a month there manually, and that choice no
longer moves the Rankings month either.

The test asserts **both** halves — Games is on All time *and* Rankings is not —
so the two cannot be quietly re-coupled by a later change.

**Also fixed:** the disclosure printed "Weighting K 21.5" directly above
"21 × (0.29 − 0.46)". Two roundings of one number in one panel is the sort of
detail that makes a reader doubt the rest of it; there is now one rendering of K
everywhere it appears, and a test that it reads the same in both places.

| | |
|---|---|
| Tests | **267 / 267** (33 in a real browser) |
| New / rewritten | the explanation is plain in front and exact behind · the three brief cases read as written · the standing headline agrees with the recorded ratings across every card · no normal card leads with a raw performance score · Games opens on All time while Rankings does not |
| Screenshots | 16 — shot 15 shows both layers with the disclosure open |

The Power Rating Guide's detailed methodology is unchanged, as asked; its
summary already used this framing.

### CGPT — 19 Sep 2026 (Games month default correction)
Correction from Shaun: **Play → Games should default to `All time`**. The
difference from the other monthly views is intentional. Keep specific months
available as manual filters; do not change the Games default to a completed month.

### CGPT — 19 Sep 2026 (simpler rating explanation)
Shaun approved replacing technical player-facing `Performance score 0.xx vs
0.xx expected` copy with simpler match/game language.

Normal explanation should tell the player: favourites/underdogs/even, expected
game-share %, actual game-share %, match result, whether they
outperformed/met/underperformed expectation, and the rating movement. Keep raw
blended performance score, K and reliability behind `See full calculation`.

Do not simplify so far that the UI implies ratings are game-share only: the
match result still contributes 20% to Sequential-v1's actual score.

**Baton → CCode.** Implement the copy/presentation change with targeted
regression tests; no engine changes.

### CCode — 18 Sep 2026 (Play history: admin controls collapsed)

**Done. Baton to CGPT/Shaun for visual/UX acceptance.** Presentation and
permission surface only — match facts, replay-forward and Sequential-v1 are
untouched.

Shaun was right that the feed had become a maintenance console, and the cause
was mine: the correct-vs-remove split earlier today put two labelled actions and
the replay warning on every rated card permanently.

**Non-admin** now sees none of it — no correction control, no removal control,
no manage affordance, and none of the replay warning copy. That copy is
maintenance guidance and does not belong under every result.

**Admin** gets a compact `··· Manage` in the card header. Opening one card
reveals the two existing actions and the warning; opening another moves it;
tapping **Close** collapses it again. One card at a time, because the point is
that maintenance is something you ask for rather than scroll past.

Default card hierarchy is now teams and result, score, draw badge where
relevant, then submission metadata — and nothing else.

**The one thing collapsing must not break:** a staged correction keeps its own
card open, so the blast-radius panel can never be hidden while it waits to be
confirmed. Closing that card **cancels** the staged plan rather than leaving it
hanging invisibly behind a collapsed card.

Everything else is as it was: the two actions keep their own wording, a removal
is still confirmed by a button reading *Remove and replay*, and the blast radius
is still measured by replaying and shown in full before anything is written.

| | |
|---|---|
| Tests | **265 / 265** (31 in a real browser) |
| New tests | a non-admin card carries none of it · an admin sees the affordance with actions collapsed and the warning not repeated · opening one card reveals its own actions and leaves the others collapsed, and a second card takes over · a staged correction keeps its card open, and closing it cancels rather than hides the plan |
| Screenshots | 16 — `10-games-feed.png` is what a player sees, `10b-games-correction.png` is Manage opened |

The existing remove-vs-correct test now opens Manage first. That is the
behaviour change it should have to account for, not a weakening of it.

The Power Rating Guide (`9de1a88`) was not touched.

### CGPT — 18 Sep 2026 (Play history admin controls)
Shaun reviewed the live Play screen and found that historical maintenance
actions are now rendered permanently on every game card. Product decision:
restore Play history as a clean player-facing results feed.

`Correct match`, `Remove and replay`, and replay-warning copy are **Admin-only
and on-demand**. Non-admin users see none of them. Admin gets a compact per-card
`…` / `Manage` affordance; opening it reveals the existing actions and warning
for that card only. Preserve all replay/correction behavior underneath.

**Baton → CCode.** Implement the collapse/visibility behavior plus targeted
browser tests, then return for visual/UX acceptance.

### CCode — 18 Sep 2026 (Power Rating Guide + "Why your rating moved")

**Built. Baton to CGPT/Shaun for copy and UX acceptance.**
Sequential-v1 is untouched.

**`More → Power Rating Guide`** leads with the idea and keeps the arithmetic one
tap away, on the reasoning that the usual reaction to a small movement is that
the system is broken, and the honest answer — K falls as evidence builds — is
not something a player should have to infer from a chart.

Shaun's anchor sentence is used verbatim: *"The rating is not designed to reward
wins. It is designed to update our estimate of playing level."*

- **Summary** — the nine plain-English points, then the five things that sound
  alike separated explicitly: Power Rating, Reliability, Monthly Performance,
  League Table, Tier, with a note that a high Reliability does not make anyone
  better.
- **The actual calculation** (expandable) — the formula, expected score,
  performance score at 80% games / 20% result, `K = 10 + 30 × (1 − reliability)`,
  `reliability = e ÷ (e + 10)`, the worked example (16 × 0.13 = +2.1), and the
  comparison: the same **+0.20** overperformance is **+2.9** at 85% reliability
  and **+7.4** at 10% — roughly **2.6×**, with neither player having played
  better than the other.
- **Questions people actually ask** — all six from the brief, plus "my rating
  barely moves any more, is it stuck?" Includes that a tier change on its own
  moves **zero** points and zero reliability, and that nothing resets monthly.

**Every constant is read from the running engine** — `KMAX`, `KMIN`, `RC`,
`GAME_SHARE_WEIGHT`, `MATCH_RESULT_WEIGHT`, `RATING_MODEL_VERSION` — rather than
transcribed beside it, so the guide cannot describe a model the app is not
using. Without the engine it says so rather than falling back to remembered
numbers, and it names the engine version it is describing.

**`assets/js/ratingExplainer.js`** puts a plain-English *"Why your rating moved"*
on the profile match card and the monthly breakdown card. It **calculates
nothing**: the expected score, the performance score, K and the movement were
all written when the match was rated and are read back through `MatchFacts`.
There is no second calculation path. The pace language is decided from K rather
than from the movement, so "moves it slowly" can never sit above "+7.4".

A real example from the live record:

> **Why Shaun's rating moved** — You went in as underdogs by 29 pts, so the
> engine expected 45.9%. You delivered 28.6% — short of that. Your rating is
> reasonably well established, so one result moves it at a moderate pace (K 21).
> That comes to -3.7.
> `K × (performance − expected) = 21 × (0.29 − 0.46) = -3.7`

**Two defects found by looking at the render, not at the tests:**

1. The long formula was set `nowrap` and cut off mid-line at phone width. A
   formula the reader has to swipe to finish is one most readers will not
   finish.
2. The explanation read "underdogs by **28** pts" directly under the card's own
   "underdogs by **29** pts going in". `Math.round(-28.5)` is −28 while
   `Math.round(28.5)` is 29. The explainer now rounds the magnitude exactly as
   the card does, and a browser test walks four players' cards asserting the two
   always agree. A one-point disagreement is exactly what makes an explanation
   look like a second calculation.

| | |
|---|---|
| Tests | **261 / 261** (27 in a real browser) |
| New tests | guide reachable from More and closes the sheet behind it · formulas and comparison match the engine's own constants · anchor sentence, five distinctions and all six questions present, no monthly-reset or win-reward wording · the explanation quotes the recorded expected/performance/K/movement and the same movement the card prints · the three complaint cases read correctly · card and explanation state the same gap |
| Screenshots | 15 (four new: guide summary, the maths, the FAQ, and the explanation on a card) |

**For CGPT and Shaun:** the copy is the deliverable here, so it is worth reading
rather than glancing at — shots 12–15 in `docs/screenshots/README.md`. Anything
that reads wrong is a one-line change; say which sentence.

### CCode — 18 Sep 2026 (production match-facts import: 7 new matches applied)

**Shaun approved the dry run and the write is applied and verified.** Full
record in [`PRODUCTION_IMPORT.md`](./PRODUCTION_IMPORT.md).

Match facts only. Production ratings, rankings, tiers and reliability were never
read. Production's winner/draw flag was treated as authoritative and was never
inferred from the orientation of the set scores. Score arrays carried across
exactly as stored. The 50 pre-June records were excluded — that block stays
display-only and cannot enter a rating calculation.

| | |
|---|---|
| Records in the export | 207 |
| Pre-June, excluded (display-only) | 50 |
| Eligible | 157 |
| Already present (deduplicated) | 150 |
| **Imported** | **7** |
| Conflicts | 0 |
| In v3 but absent from the export | 0 |
| Documents written / deleted | 49 / 0 |

**The seven**, all production submissions with status `approved`, 16–17 Sep:

| v3 id | match | score |
|---|---|---|
| `2026-09-16-1` | Osh & PDM def KC & Jams | 6-1, 6-2 |
| `2026-09-16-2` | KC & PDM def Osh & Jams | 7-5, 6-3 |
| `2026-09-16-3` | Stormzy & Omar def Max & Jords | 6-2, 6-3 |
| `2026-09-16-4` | Tom & Rishi def Jords & Eli | 6-4, 2-6, 6-3 |
| `2026-09-17-1` | Eli & Len vs Kaz & Rishi — **draw** | 4-6, 6-3 |
| `2026-09-17-2` | Osh & Rishi def Ant Slice & Eli | 6-2, 6-3, 6-0 |
| `2026-09-17-3` | Eli & Len def Osh & Rishi | 6-3, 6-1, 6-8 |

**Fourteen players moved**, every one matching the approved plan to the tenth of
a point: Ant Slice 1636.5→1625.1 (−11.3), Eli 1652.5→1641.5 (−11.1), Rishi
1454.1→1462.9 (+8.8), Osh 1705.5→1713.8 (+8.3), Jords 1336.1→1328.2 (−7.9),
Omar 1403.4→1409.5 (+6.1), Tom 1345.9→1351.0 (+5.1), Stormzy 1384.3→1389.3
(+5.0), Max 1410.6→1407.1 (−3.5), KC 1711.5→1708.7 (−2.8), Jams 1116.0→1113.3
(−2.7), PDM 1446.1→1447.6 (+1.6), Kaz 1731.2→1732.7 (+1.4), Len 1675.8→1675.9
(+0.1). The other 20 players did not move, which the no-op replay confirms
rather than assumes.

**Verification, from a fresh re-read of the live record rather than from what
the importer said about itself:**

| | |
|---|---|
| Live Firestore | **157 matches · 666 journey events · 34 players = 857 docs** |
| Replay-to-self | **0 differences** |
| Diagnostics | **9 / 9 pass, 0 warnings** |
| Tests | **255 / 255** (21 in a real browser) |
| Earliest match / event | 2026-06-02 — the pre-June rule holds |
| Draws | 6 (5 + the imported one) |
| Re-running the importer | 157 already present, **0 new** — idempotent |

**The importer is reusable and idempotent.**
`scripts/import-production-matches.js --file <export.json>` dry-runs by default
and reports everything before it can write: export integrity, pre-June
exclusions, already-present count, new matches in full, conflicts, unknown
names, the replay plan and every projected rating change. `--write` applies it
and then re-reads and proves the record still replays to itself.

Identity is **factual**, because production ids (`base_79`, `sub_1758…`,
`early_0`) and v3 ids (`YYYY-MM-DD-N`) share no namespace. A match is identified
by its **fixture** — date plus the two rosters as an unordered pair — which is
deliberately narrower than "everything about the match": an identity that
included the score could never detect a *changed* score, it would simply look
like a different match and be appended. Fixtures do repeat, so a fixture
addresses a group and records inside it are paired by full facts; leftovers on
both sides are a **conflict**, which stops the import rather than appending a
near-duplicate or silently overwriting. It also refuses on a malformed export,
or on a player with no v3 record — a starting tier is a club decision, not
something an importer may invent.

`replayForward` gained `appendMany`, so an import replays once. Appending one
plan at a time would have reported each match's blast radius against a record
the previous append had already moved, so the numbers shown would not have been
the numbers written.

**A discrepancy worth fixing at the production end.** The accompanying
`validation-summary.json` says "all 42 currently-submitted matches have status
'approved'". The export carries **41** records with `_origin: "submission"`, all
approved. Nothing in the import depends on it — dedupe is by match facts, not by
origin or id — but the summary and the file it describes disagree by one. Also
noted: production reports 12 matches excluded as deleted; none of them were ever
in v3, which the `in v3 but not in export: 0` result confirms.

**One thing production should know.** Production genuinely stores decided
matches whose first-listed side has the losing scoreline — 14 in this export,
12 pre-June and 2 in the rated range. The clearest is 2026-07-02, Len & Eli beat
Shaun & Osh 0-6, 6-3, 6-4, having taken 12 games to 13. v3 already recorded both
correctly, and the importer preserves them rather than "fixing" them. There is a
test for exactly this case.

### CGPT — 18 Sep 2026 (Power Rating Guide)
Shaun's remaining concern is player trust: movements now look relatively small
for established players, so the product needs to explain the model before
players assume something is wrong.

Decision: build **More → Power Rating Guide** with a short plain-English summary,
an expandable exact-methodology section, a worked example, complaint-prevention
FAQ, and a match-level `Why your rating moved` explanation derived from the same
persisted facts used by the calculation.

Do **not** tune Sequential-v1 merely to make movements feel larger. The current
small movements are explainable through reliability/K and should be presented
clearly first. Any later methodology change must be evidence-led and separately
approved.

**Baton → CCode.** Implement the guide and targeted tests from Section 4, then
return for copy/UX acceptance.

### CGPT — 18 Sep 2026 (product acceptance approved)
Reviewed CCode's completed acceptance pass at `e0fdcbc`: **242/242 tests**,
including **21 browser tests**, with all eight requested UX/presentation fixes
covered. The product requirements are accepted.

Approved the two deliberate deviations from the mockup: date edits remain
remove + re-entry because the date is part of match identity; and Key takeaways
summarises distinct stories instead of duplicating Monthly Performance.

CGPT is **not claiming pixel-level visual inspection of the regenerated private
repo PNGs**, because the GitHub connector exposes their files/captions but not
their pixels to vision. So the only remaining gate is Shaun's on-device visual
look check. No implementation task is queued unless Shaun identifies a concrete
visual problem.

**Baton → Shaun.** If the regenerated screens look right on-device, beta
acceptance is complete.

### CCode — 18 Sep 2026 (CGPT visual acceptance: all eight fixes done)

**All eight acceptance fixes are implemented, tested and captured. Baton back to
CGPT for final visual acceptance.** No Sequential-v1 mathematics was touched.

1. **"Monthly Rating" is gone.** The breakdown is now **Month-end Power Rating**,
   the figure is labelled **Power Rating at month end**, and the disclosure is
   **How month-end Power Rating works**. The methodology copy now opens
   "Nothing is solved separately for a month". A browser test asserts the phrase
   appears nowhere on screen — it caught my own replacement copy reintroducing it.

2. **Score orientation.** Set scores are *stored* winner-first (`sets[i][0]` is
   the winning side's games), which is why a defeat read "6-3, 6-4" beside the
   word LOSS. One helper (`setsForViewer` / `scoreForViewer`) now orients any
   card written from a player's point of view: the profile match log, the
   monthly breakdown cards, and the Games list when it is filtered to a player.
   Neutral cards keep winner order, bound by the "X def Y" title they already
   carry; a draw, which says "X vs Y" and binds nothing, states the order.
   **This uncovered a real defect in my own first attempt**: `enrichMatches`
   dropped `sets` and exposed only the joined `score` string, so orienting
   produced an empty score. The browser test failed on it. `sets` is now carried
   through enrichment.

3. **Reliability on the profile hero.** A facts row — Tier · Reliability ·
   Games · Joined — sits under the Power Rating, with the percentage in gold and
   the band beneath it, on the agreed thresholds (<25 Provisional, 25–49
   Developing, 50–74 Established, 75+ High Reliability, already implemented in
   `v3Bridge`). It is deliberately placed away from rank and win rate, because it
   measures evidence and not ability. If a player has no v3 record the row says
   so rather than showing a number.

4. **Unavailable actions are disabled with their reason.** Both the live review
   and Historical Club Adjustment: the button reads **Unavailable**, is styled as
   unpressable (dashed, 45% opacity), the reason appears in an ⓘ note in the same
   row, and the click handler refuses the branch even if the button is reached
   some other way. Rishi's "Correct the initial classification" is the case in
   the screenshot.

5. **Audit trail is readable and still whole.** Every event keeps its row;
   nothing is collapsed or rewritten. Each row now carries a status dot, an
   English label and a badge: **Active**, **Superseded**, **Correction**.
   `CLUB_RATING_REASSESSMENT — B→B` now reads "Rating reassessment after
   promotion · tier unchanged (B), rating 1103.4 → 1352.5". Superseded rows stay
   visible at 55% opacity with a grey dot.

6. **Correct and remove are separate acts.** Two labelled actions on the card
   ("Correct match — change the score or the players" / "Remove and replay —
   delete this match from the record"), and the confirmation now speaks the
   language of the act being taken: a removal is headed "Confirm removal" and
   committed by a button reading **Remove and replay**. The invisible
   double-arming click on Remove is gone — the blast-radius panel is the
   confirmation, and it says so.

7. **Monthly hierarchy.** A compact **Key takeaways** card leads, built from
   three *different* stories (strongest performance, biggest rating riser,
   biggest rank climb) so it does not restate the table below it. Monthly
   Performance stays open as the award story. Rating Movement, Ranking Movement,
   Moved without playing and Crossovers fold into `<details>` sections — no JS to
   re-wire on render, and each keeps its own title and explanation. Nothing was
   deleted, and club-decision movement remains labelled separately
   (`+255.2 pts (+249.1 by club decision)`).

8. **Contrast.** Measured rather than eyeballed. `--gold-dim` was **3.6:1** on
   `--bg2` — below AA for small text — and was being used for body copy as well
   as for borders. It now does borders only; a new `--gold-soft` (**6.6:1**)
   takes its text uses. `--text-dim` lifted from 6.5:1 to **8.2:1**, and a new
   `--text-soft` (**11:1**) sits between it and `--text` (14.6:1). The steps
   between the three are wide, so hierarchy is preserved and nothing became
   white. The all-time Rankings screen is visually unchanged, as asked.

| | |
|---|---|
| Tests | **242 / 242 passing** (21 in a real browser) |
| New regression tests | stale Monthly Rating copy · score orientation on a win and a loss · reliability + band on the hero · a disabled unavailable action that refuses to record · remove-vs-correct wording and one-click staging · audit badges and English labels · club-decision movement kept separate · all four monthly parts retained |
| Screenshots | 11, regenerated from the live record, 0 page errors |
| Live record | unchanged — 34 players · 150 matches · 638 journey events |

The screenshot set gained one shot (the profile hero, so reliability is
reviewable) and was renumbered; `docs/screenshots/README.md` is regenerated.

### CGPT — 18 Sep 2026 (visual acceptance pass)
Reviewed all ten live-record screenshots supplied by Shaun. The beta is **not
yet visually accepted**, although the core product direction is now strong.

Required fixes are listed in Section 4. Highest-priority product issues:
`Monthly Rating` terminology must disappear because no separate monthly solver
exists; match scores must be shown from an unambiguous perspective; Reliability
must be visible on the profile hero; unavailable review actions must not look
clickable; Historical Club Adjustment needs clearer active/superseded audit
states; Historical Match Correction must distinguish `Correct match` from
`Remove and replay`; monthly four-part content needs stronger hierarchy; and
secondary text contrast should be slightly improved without losing the premium
dark look.

All-time Rankings/Kings/podium direction is accepted. Rating Journey is accepted
in principle after the club-decision marker/copy fix. Do not redesign those
surfaces beyond consistency/readability changes required by the acceptance list.

**Baton → CCode.** Implement only the acceptance fixes in Section 4, regenerate
the same screenshot set, keep tests green/add targeted regressions, and return
the baton to CGPT for final visual sign-off.

### CCode — 18 Sep 2026 (review screenshots; a display defect found by looking)

**NEXT 7 is done. Section 8 is now empty — the baton is with CGPT and Shaun for
product acceptance.**

`scripts/screenshots.js` captures ten review aids into `docs/screenshots/`, with
a captioned `README.md`. Regenerate rather than edit them.

They are taken from the **live beta record**, not the seeded fixture: the three
board decisions of 18 Sep moved most of the club, so a capture of the seed would
show ratings that no longer exist. The script reads the three collections over
the REST backend, serves the app locally and stubs Firestore with a read-only
copy of those documents. Nothing is written back, and the two staged writes in
the set (the armed removal in shot 09, the armed review in shot 06) are planned
and displayed but never confirmed.

**A real defect, found only because the captures were read rather than assumed
correct.** The Rating Journey drew Shaun's 1 Jul initial-classification
correction as an annotation and captioned it "Power Rating unchanged at 1400" —
under a visible 263-point leap in the chart directly above it. The cause was
that markers and copy were chosen from the *event type* rather than from what
the event *did*. A tier move is rating-neutral; a correction is not, because the
board may be replacing an initial estimate it knows was wrong. Both are now
decided from `delta`:

- `journeyView.chartSeries` — `isJump` when a club decision moved the rating,
  `isAnnotation` only when it moved nothing.
- `tierEventsAreRatingNeutral` — narrowed to tier events. Corrections were
  wrongly included, which is the invariant that had made the bug look correct.
- `app.js` — the correction card states the actual before/after and delta, and
  the chart legend names only the markers actually drawn.

The card now reads: *Power Rating 1137 → 1400 (+263.2 pts), reliability 33% →
10%. The club judged the original estimate wrong and replaced it. This is a
decision, not a result on court.*

**Four capture defects were also fixed, each found the same way** — the image
did not match its caption:

1. Shot 07 showed the Monthly Rating Breakdown modal, not Historical Club
   Adjustment: the modal is closed by removing its `show` class, and the
   selector used did not exist.
2. Shot 09 showed diagnostics, not the Games tab: `goToSection('games')` is a
   no-op, because Games is a tab inside the Play section rather than a section.
3. Shot 04 duplicated shot 03 with an empty Recent Results: `openSheet` is
   wrapped to render the premium profile itself, so calling
   `renderPremiumProfile` again rebuilt the wrapper after the match cards had
   been reparented into it.
4. Shot 01's caption claimed "Tier S appears" when S and C have no qualifiers at
   the chosen minimum and are correctly not shown.

Three further captions were tightened to state only what is visible in the
frame. A tenth shot was added for the full-calculation disclosure, which is the
one place the engine describes its own arithmetic.

| | |
|---|---|
| Tests | **234 / 234 passing** (14 in a real browser) |
| Page errors during capture | 0 |
| Live record | unchanged — 34 players · 150 matches · 638 journey events |
| Diagnostics | all nine checks pass, as shown in shot 08 |

**For CGPT and Shaun.** The set is `docs/screenshots/README.md`. If a different
set, different players or a desktop viewport would review better, say so and it
is one command to regenerate. The ten are: all-time rankings, a single month,
Rating Journey, match detail, monthly breakdown, Admin monthly review, Admin
historical adjustment, Admin diagnostics, historical match correction, and the
full calculation.

### CGPT — 18 Sep 2026 (historical override values confirmed)
Shaun has made the final board decisions, so the historical writes are no longer
blocked. Apply Shaun on 1 Jul at **1400 / 10% reliability**. Apply Tom on 1 Jul
at **Jords' Power Rating immediately before the 1 Jul review / 10% reliability**.
Apply Fatch on 1 Aug at **Tom's Power Rating immediately before the 1 Aug review
after Tom's corrected July trajectory / 10% reliability**.

Tom and Fatch are explicit **club overrides**, not accepted statistical
recommendations. Preserve the shared-pre-review snapshot rule for 1 Jul, then
replay July before resolving the 1 Aug Tom anchor used for Fatch.

**Baton → CCode.** Apply through Historical Club Adjustment, verify, regenerate
comparison outputs, record exact resolved values/results in this Ledger, then
continue the remaining beta-finalisation tasks.

### CGPT — 18 Sep 2026 (Historical Club Adjustment approved)
Shaun asked whether historical reassessment should remain a bespoke three-player
repair. Decision: **no**. Build a narrow permanent Admin-only Historical Club
Adjustment workflow on top of replay-forward. The replay engine, historical
state and reassessment logic already exist; the remaining work is controlled UI,
validation, audit semantics and tests.

Important correction to the earlier wording: Tom and Fatch were historically
reassessed by the club when promoted. The fact that `t2-quartile-v1` cannot
produce a recommendation at their dates does **not** mean the club chose
keep-current. It means the statistical adviser abstains and the board must
explicitly choose Keep current or Club override.

Historical Match Correction and Historical Club Adjustment remain separate Admin
tools even though both use replay-forward underneath.

**Baton → CCode:** build the Historical Club Adjustment flow first and use
Shaun/Tom/Fatch as acceptance fixtures. Do not commit those three historical
events until Shaun confirms Tom/Fatch outcomes and reliability treatment.

### CCode — 18 Sep 2026 (NEXT 3, 4 and 5 done)
`0925479`, `3fbdc57`, `1c120c7` on `main`. 233 tests, 14 of them in a browser.
**The live beta is untouched by this pass** — it holds exactly the five
documents beyond the seeded baseline that are the three authorised board
decisions, and nothing else.

**#4 — exact-evidence precision fix applied.** `applyStateEvent` preferred the
derived reliability over the exact evidence beside it, so a replay sent the
number back through `reliability = e / (e + 10)` inverted and lost a bit:
evidence of 21 replayed as 20.999999999999996. No mathematics changed — both
fields describe the same quantity and K is identical either way; the engine now
prefers the lossless representation. `replayForward` passes the exact evidence
for any event that changed reliability, so it no longer has to route around the
problem by replaying intent. Verified against the live beta afterwards: still
replays to itself with 0 differences, all nine diagnostics pass.

**#3 — Historical Match Correction is exposed to Admin**, over replay-forward.
The controls come back meaning what they say: a correction re-derives every
rating that followed, so the blast radius is measured by replaying and shown in
full before anything is written, and cancelling leaves no trace. Removal
replays the record *without* the match rather than hiding it. Kept in one place
(the Games tab) so a blast radius is never shown twice or acted on from two
screens; profile and head-to-head cards point there.

  **Bounded limitation, recorded rather than papered over:** a correction that
  changes the DATE is refused with the reason. Match ids are `YYYY-MM-DD-N`, so
  allowing it would leave the identifier describing a day the match no longer
  belongs to. Moving a game is a removal and a re-entry — two deliberate steps
  the Admin can already take.

**#5 — Tier S supported throughout.** Kings of Tiers and the grouped League
Table both hardcoded A/B/C, so a Tier S player was silently absent from both.
Shaun's "do not crown a sole eligible S player" is implemented as a rule about
**the size of the field**, not about Tier S: a king of a field of one has won
nothing whichever tier it is, and hardcoding it to S would have made it look
like a rule about Manny. Proven in the browser by forcing Manny to be the single
qualifying S player — the card reads "only one qualified" and no crown is
awarded. He meets no qualifying threshold today, so the case cannot arise live,
which is why it had to be forced rather than taken on trust.

**#6 — per-player match movements** are unchanged and covered by a browser test.

**Baton → CGPT/Shaun.** Only **screenshots / product acceptance** (#7) remains,
and it still needs to be said what they are for: CCode has taken them as review
aids for CGPT and Shaun per the earlier note, but has not produced them.

### CCode — 18 Sep 2026 (the three historical decisions are APPLIED)
`0f7c2ed` on `main`. 230 tests + 11 browser tests. **Written to the live beta.**

| Player | Date | Decision | Anchor | After decision | Current |
|---|---|---|---|---:|---:|
| Shaun | 1 Jul | Initial classification correction | Board-fixed B baseline | 1400.0 @ 10% | **1374.3** (63%) |
| Tom | 1 Jul | Promotion + club override | Jords immediately before the review | **1352.5** @ 10% | **1345.9** (64%) |
| Fatch | 1 Aug | Promotion + club override | Tom immediately before the review, after his corrected July | **1358.6** @ 10% | **1342.1** (55%) |

**Two anchors were resolved, not given, and the order mattered.** Both 1 July
decisions came from the same pre-review snapshot, so processing Shaun first
could not move the Jords figure Tom was anchored to — the purpose of the
shared-snapshot rule, doing real work. Fatch could only be resolved afterwards:
on the old record Tom entered August at **1133.0**; after the corrections,
**1358.6**. Resolving all three up front would have anchored Fatch to a Tom who
no longer existed.

**Four defects surfaced by doing it**, each caught by a check rather than by
reasoning, each fixed before the result was accepted:
* `verifyNoOp` refused to run at all — adding `supersedes`/`revision` to the
  schema made every pre-existing document "differ" from its own rebuild (absent
  vs null). Both mean not applicable and now compare equal.
* The **Rating Journey showed superseded decisions beside their replacements**,
  telling a player their rating moved twice.
* The display ordered the rating decision **before** the tier move while the
  engine applied them the other way, so the chain stopped joining up. The
  canonical same-date order is now defined once and reused everywhere.
* Monthly movement counted only reassessments, so **Shaun's correction would
  have been shown as a month's form**. Any club decision counts now.

**Verified on the live record:** nine diagnostics pass, it replays to itself
with 0 differences, and monthly movement separates decision from play —
Shaun July +255.1 (**+263.2 by decision**, −8.1 on court); Tom +255.2 (**+249.1
by decision**); Fatch August +205.7 (**+222.3 by decision**, so he lost 16.6 on
court).

**Comparison against production improved materially.** `COMPARISON_REPORT.md`
now states its basis, because the seeded baseline and the live record differ
once club decisions exist. Regenerated live: mean absolute difference **31.9 →
18.0 points**, largest **220.3 → 97.8**. The seeded-differently players are no
longer the largest differences, and the report says so instead of repeating a
claim that has stopped being true.

`HISTORICAL_REVIEW_DRYRUN.md` is superseded by the applied result.

**Baton → CGPT/Shaun.** Section 8 items 3–7 remain; none is blocked.

### CCode — 18 Sep 2026 (Historical Club Adjustment built; still blocked on Shaun)
`9cc3c13` on `main`. 231/231 tests. **No historical decision has been written.**

Built as the permanent Admin tool the decision asked for, not a repair script.
Pick a player and a past date; the state immediately before it is reconstructed
from the journey; what is already recorded on that date is shown; the same four
decisions the prospective review offers are presented; a reason and a name are
required; the full replay consequence is shown before anything is written.
Separate from historical match correction, with a test enforcing it — one
repairs a result, the other records a judgement, and merging them would let a
rating be changed under cover of fixing a score.

**Your correction on "no recommendation ≠ keep-current" is implemented as a
refusal, not a caption.** Choosing "accept" where no recommendation exists is
rejected with the reason; nothing maps absence to a decision.

**Three defects found while building it, each of which would have silently
broken the audit guarantee** the supersession model exists to provide:
* `applyStateEvent` builds its own return shape and drops `revision` and
  `supersedes`, so the superseding correction was written with the **base id and
  overwrote the decision it was meant to preserve**. The engine is frozen, so the
  fields are re-attached during the replay.
* The superseded event then looked orphaned to the diff and **was deleted**.
* `verifyNoOp` counted it as "would disappear", which would have meant any
  record containing a correction could never verify again.

**Acceptance case proven end to end** (in the browser, against a stub — the real
beta is untouched). Shaun's 1 July correction to 1400: one superseding event, 0
deletions, 32 players re-derived, Shaun 1178.7 → **1380.2**. Both decisions
remain in the record, diagnostics pass, and the result still replays to itself,
so a further correction could be planned on top of it.

**Still blocked on Shaun, unchanged from the dry run:**
1. **Tom** — keep-current or club override? No statistical recommendation exists
   at 1 Jul (2 established in C, 3 needed).
2. **Fatch** — same question at 1 Aug (1 established in C).
3. **Reliability treatment** for all three. There is no recommendation to give:
   `reassessment.js` returns null by design because no validated method exists
   for a reliability change on a tier move. Leaving it untouched keeps the
   evidence each player earned, which is the conservative reading, but it is a
   board choice.

Once those three answers arrive the tool applies them directly — no further
build is needed.

### CCode — 18 Sep 2026 (Phase A built; Phase B dry run needs two answers)
`62347ea` and `17ed790` on `main`. 224/224 tests. **Nothing historical has been
written and nothing will be until Shaun confirms.**

**Phase A is done and usable for today's review.** A tier change cannot be
recorded until the board answers the rating question: accept the recommendation,
club override, keep the current rating, or correct the initial classification.
Keeping the current rating is recorded as its own event — a decision that leaves
no trace is indistinguishable from the omission the rule exists to prevent.
Correcting an initial classification is one event, not a promotion plus a
reassessment, and is offered only while the player is still provisional.

**The shared pre-review snapshot is not a nicety.** Reviewing Jams before Aubyn
does not merely shift Aubyn's number: moving Jams out of Tier C empties the pool
below the minimum and Aubyn would be offered **no recommendation at all**. The
snapshot is a function of the date, so two boards reviewing the same people on
the same day get the same answers.

**Two defects found while building Phase A, both fixed.** The snapshot read
classification status off the latest event, and match updates carry none, so
every player came back unclassified and the initial-classification path was
silently closed to everyone. And **recording a real promotion broke the next
page load** — tier history was validated against the seed's frozen three-entry
list, which a new promotion contradicts. Tier history now comes from the record.
That is precisely the class of problem this task was raised to prevent, and it
would have hit on the first promotion recorded today.

---

## PHASE B DRY RUN — SHAUN, TWO ANSWERS NEEDED

Full report: **`HISTORICAL_REVIEW_DRYRUN.md`** (regenerate with
`node scripts/historical-review-dryrun.js`). Summary:

| Player | Date | Treated as | Proposed rating | Reliability |
|---|---|---|---:|---|
| Shaun | 1 Jul | `INITIAL_CLASSIFICATION_CORRECTION` | **1400.0** (board-fixed B baseline) | unchanged (33%) |
| Tom | 1 Jul | Promotion, statistically reassessed | **no recommendation** | unchanged (29%) |
| Fatch | 1 Aug | Promotion, statistically reassessed | **no recommendation** | unchanged (58%) |

**1. The statistical reassessment declines to recommend anything for Tom or
Fatch.** The brief asks what the system *would have produced* at their review
dates; the answer is nothing. Tier C held too few **established** players to
place a boundary — 2 for Tom, 1 for Fatch, against a minimum of three either
side. The module refuses rather than inventing a target from a thin pool, which
is the behaviour Shaun approved when the threshold was set. That is a real
answer, not a gap. It means the honest record for both is a promotion plus
**keep the current rating**, unless the board prefers a club override. **CCode
has not chosen between those — it is exactly the decision the new workflow
exists to capture.** Neither is silently re-seeded to 1400.

**2. Reliability has no recommendation to give.** `reassessment.js` returns
`recommendationReliability: null` by design: no validated method exists for
recommending a reliability change on a tier move. The proposals leave it
untouched, keeping the evidence each player earned. For Shaun that is worth a
moment — his rating is corrected to a baseline as though the estimate restarted,
while his five June matches of evidence stay. Both readings are defensible.

**Blast radius, measured by replaying rather than predicted:** 29 of 34 players
end on a different Power Rating. Shaun **+203.6 → 1382.3**; everyone else within
10 points. Tom and Fatch move slightly despite no rating decision, because
Shaun's corrected rating changes the expectations in matches they played
alongside him.

**Baton → Shaun.** Confirm the Shaun correction, choose keep-current or override
for Tom and Fatch, and answer the reliability question. CCode writes nothing
until then.

---

### CGPT — 18 Sep 2026 (historical reassessment + today's promotion workflow)
Shaun clarified a factual distinction that changes how the historical record
should be represented. Shaun entered C only because his level was unknown; at
the 1 Jul review the club concluded the initial classification was wrong and
would use the **normal B baseline of 1400**. Preserve June exactly, then record
an `INITIAL_CLASSIFICATION_CORRECTION` on 1 Jul rather than pretending he had
entered B from day one.

Tom (1 Jul) and Fatch (1 Aug) were genuine C→B promotions. They should not be
rebased automatically to 1400; calculate the historical statistical
reassessment the current recommendation mechanism would have produced at each
review date. CCode must report Tom/Fatch's proposed rating/reliability and
Shaun's proposed reliability before any historical writes.

Going forward, a tier change review is incomplete until the board explicitly
chooses Accept recommendation / Club override / Keep current rating. Initial
classification correction remains a distinct path. When several players are
reviewed on one date, recommendations come from one shared pre-review snapshot
so processing order cannot change another player's recommendation.

**Baton → CCode.** Implement the future workflow first so today's promotions can
be processed correctly; then produce the historical dry-run plan. Do not write
the three historical reassessments until Shaun confirms the reported numbers.

### CGPT — 17 Sep 2026 (latest, monthly presentation reconciliation)
Read CCode's monthly UI handoff and inspected the published commit/source.
The implementation is on `main` at `05f6cd4`; the Ledger's `4cf819e` reference
does not resolve through GitHub. Corrected the active commit references without
changing historical handoffs. CCode's 122/122 and browser results remain reported
verification, not a fresh CGPT test run.

The monthly presentation is substantially built, but within-tier movement is
assigned to a row field without being displayed. Start/end ratings and overall
ranks appear only in positive-mover highlights, so the full agreed per-player
movement presentation still needs completion. NEXT now distinguishes that
bounded finish from rebuilding the monthly UI.

**Baton → Claude Code:** finish NEXT #1, verify the agreed monthly views, then
take the real Rating Journey UI. No new product decision from Shaun is required.
Keep the already-approved hiding of inert Edit/Delete controls in the queue;
historical editing remains unavailable until replay-forward. No application
changes or new release-scope decisions were made in this CGPT pass.

### CCode — 17 Sep 2026 (Real Rating Journey UI shipped)
`bd47757` on `main`. 140/140 tests (12 new). The profile Rating Journey now
replays persisted `ratingJourney` events instead of reconstructing a sequence
from `MATCHES`. The reconstruction and the "Story estimate — official Power
Rating is X" disclaimer are deleted from the source; a test fails if either
returns. Verified in-browser across all 34 players with zero page errors, and
the empty, failed-read and no-events states were each exercised for real rather
than reasoned about.

New module `assets/js/journeyView.js` is pure and Node-testable. Tests hold
that the journey's last point equals the Power Rating for every player, that
each event starts where the previous one finished, that same-day state events
precede that day's matches exactly as the engine applies them, that tier events
carry **zero** rating and **zero** reliability movement, and that April/May can
never enter a journey.

Three presentation rules worth recording, because they are the difference
between a truthful screen and a plausible one:
* A tier change is drawn as a dashed annotation on the line, never a plotted
  point, and states "Power Rating unchanged at N". A promotion must never read
  as points earned.
* A club reassessment is a distinct marker and names itself a club decision,
  with its reliability change shown. It must never pass as match play.
* Match rows say "performance score 0.29 against 0.33 expected" rather than a
  percentage of games. The score is 80% games won + 20% the result — a different
  quantity from the game-share figures on the cards below. The first draft said
  "delivered 29%" directly above a card reading "actually took 36%"; both were
  correct and the screen still read as a contradiction. Changed before shipping.

Per-match rating changes on profile cards are now the engine's own per-player
delta, keyed by match id. The month-scoped variant is gone: the rating is
continuous, so a match moved it by exactly one amount.

**No extra Firestore read was needed.** The brief anticipated targeted player
reads; `V3_JOURNEY` is already resident for the monthly views, so the profile
journey costs nothing. Open Question 1a's review trigger is unchanged.

**Two findings raised, not fixed — Open Questions 6 and 7.** Question 6 is a
conflict with a standing constraint (expectations recomputed in the browser on
every match card) and carries a product question CCode should not answer alone:
in v3 a match moves each of four players by a different amount, so the card's
"+X for winners · −X for losers" line has no v3 equivalent and the card needs
redesigning. Question 7 is the last remaining reconstruction. Both were left out
of this task deliberately: each spans screens outside the Rating Journey, and a
half-fix would put two different expectation figures on screen at once.

**Baton → CGPT.** Requested: a view on whether Questions 6 and 7 are scheduled
ahead of Kings of Tiers, given that 6 breaches a standing constraint. CCode will
otherwise take NEXT #1 (Kings of Tiers) on the next `Ledger CCode`.

### CCode — 18 Sep 2026 (Kings of Tiers on historical tier — and a defect under it)
`6fd7a1c` on `main`. 147/147 tests (7 new). Verified in-browser across all 20
month × tier-filter combinations: no placeholder leaks, zero page errors.

**The task as scoped.** Kings of Tiers, the rankings podium and the tier filter
now scope tier to the selected month through one `tierInScope()` helper, so the
three cannot disagree. In a month view it returns the tier held at that month's
close — the same tier the within-tier ranks already use. June's Tier C king was
previously **missing entirely**: all three players who were Tier C that month
have since been promoted, so Tier C's June field was empty and the card showed a
dash. It now reads Shaun 1137, with a note saying he is Tier B today, because a
past king in a tier he no longer holds is not a mistake and the panel should
not leave the reader assuming it is.

**The defect underneath — worth CGPT's and CChat's attention.** `MONTHLY_VIEWS`
was built with `TierHistory.create({ currentTiers: TIER_MAP })`, and `TIER_MAP`
is still `{}` at that moment: `loadV3State()` runs before
`rebuildMapsFromState()` populates it. `tierAsOf()` therefore returned
`undefined` for every player outside the three-entry authoritative change list.
**Every historical tier, within-tier rank and `tierChanged` flag in the shipped
application was missing**, from `05f6cd4` onward. In the browser, June resolved
3 of 22 rows; in Node, where the tests pass a complete tier map, all 22 resolved
and every test passed.

Two things let it hide, and both are now closed:
* An empty map reads as "no opinion" rather than an error. `TierHistory.create()`
  now refuses an empty `currentTiers` outright.
* The one guard that could have caught it — comparing a change-list player's
  current tier against the end of their history — skipped players whose current
  tier was `undefined`. That skip is now an error.

**Method note, because this is the second time it has bitten.** The tests were
green throughout; they exercised the data layer with correct inputs while the
application supplied wrong ones. The regression guards added here are therefore
source-level assertions about the wiring, and both were checked against the old
code to confirm they fail there. Unit-testing a module does not test how the
application calls it.

**Also corrected:** the monthly stories panel described Monthly Performance as
"what drives the podium and Kings of Tiers". Both rank on rating. Same failure
mode already recorded twice — retiring a calculation does not retire the
sentence describing it.

**New Open Question 8:** Manny is Tier **S**. The Kings panel hardcodes A/B/C
and the tier filter offers A/B/C, so he appears in neither. Left alone: whether
Tier S is real, legacy or an error is Shaun's call.

**Baton → CGPT.** Questions 6 and 7 are still unsequenced and Question 8 is new.
Absent a steer, CCode takes Questions 6 and 7 next on `Ledger CCode`.

### CCode — 18 Sep 2026 (last two reconstructions retired)
`19ffe21` on `main`. 157/157 tests (10 new). Verified in-browser across profile
cards, Games cards, draws, the Monthly Rating breakdown, the head-to-head month
view, every month and every tier filter — zero page errors.

**Open Questions 6 and 7 are resolved.** New pure module `matchFacts.js` indexes
what the engine recorded for all 150 matches: each player's pre-match rating,
the expectation used, the score delivered, the K applied, the points moved.
`enrichMatches` reads that instead of deriving a logistic from today's ratings,
so every consumer — cards, aggregates, upset flags, CSV export — became correct
without being individually rewritten.

Worth knowing beyond the two questions as written:
* The old expectation was not merely forbidden, it was **unstable**. Being
  derived from current ratings, the same June match reported a different
  expectation every time anybody played. Nobody would have noticed.
* "Rating impact" on each card was invented outright: 84 × overperformance with
  a neutral band. No engine ever produced it.
* The Monthly Rating breakdown showed a **real** month-end rating underneath a
  fabricated explanation ("solved every player's rating jointly… K=28, 300
  passes"), sitting directly below a paragraph correctly stating the rating
  never resets. Both were on screen at once.
* Ratings printed beside a past match were today's ratings. They are now the
  ratings that played it, so "favoured by 126 pts going in" is a statement about
  that day. Upsets are settled the same way and no later month can change one.
* The profile match card and the Rating Journey now print the same performance
  score for the same match. They previously could not.

**New Open Question 9:** match cards now show four per-player rating changes
instead of one team figure. Visible change, no other truthful option, but it is
Shaun's to look at.

**New Open Question 10 — a pattern, not an incident.** The Games view claimed a
draw "doesn't affect any rating". Draws are rated; one moved a player by 10.25
points. That is the fourth stale sentence found after its calculation was
retired. Suggest treating copy that describes engine behaviour as code.

**Baton → CGPT.** NEXT is now the reassessment write path. Questions 8, 9 and 10
are for Shaun and do not block it.

### CCode — 18 Sep 2026 (club decision write path + Admin Monthly Review)
`2a61943` on `main`. 174/174 tests (18 new). Verified end to end in a browser
against a stubbed Firestore: refusals fire, zero writes occur before
confirmation, a confirmed decision writes both documents in the right order, and
the re-read shows the new rating.

**This is the application's first write of a rating**, so the rules live in
`clubDecision.js` — a pure module — not in the screen. A screen can be bypassed.
Refused outright, not warned about: backdating over existing history (there is no
replay-forward, so the stored ratings would stop following from the stored
events), future-dating, a tier move carrying points, a rating reassessment
carrying a tier, reliability outside [0, 1), a decision with no attribution, and
a same-day duplicate that deterministic ids would otherwise silently overwrite.

**Nothing is deleted, ever.** A decision is undone by recording a reversal, so
both remain in the ledger. That is what "forward-only and audited" means in
practice, and `reversalOf()` builds it — reversing a tier move as the opposite
tier move, carrying no points.

**Write ordering is deliberate.** Two documents, no transaction available. The
journey event goes first, because the journey IS the history and a replay
reproduces the player document from it; a failure after the first write is
recoverable and says so, and tells the operator not to record it again. The
reverse order could leave a rating with nothing explaining it.

**The trust model is on the screen, not implied.** `isUnlocked` is a UI gate,
not a security boundary; beta storage is open by decision, so attribution
records intent, not identity. Said in those words in the UI.

**One consequence handled here because it only became reachable now.** With
reassessments possible, monthly Rating Movement could show a rating that moved
by decision as a month's form. Rows now carry `reassessmentChange` and the
stories panel says "(+40 by club decision)" where it applies. Until this commit
that distinction was 0 for everyone, which is why it had never surfaced.

**New Open Question 11 — needs a decision before replay-forward.** A stored
event replays evidence through reliability and loses a last bit. Harmless today
(K unchanged, no compounding, nothing replays stored events yet) but
replay-forward will replay these documents for real. The fix is one line of
engine code; the engine is frozen, so it is recorded as a passing `KNOWN:` test
and left for Shaun/CGPT rather than applied.

**Baton → CGPT.** NEXT is beta diagnostics and the beta reset workflow.
Questions 8, 9 and 11 are for Shaun; only 11 has a deadline (before
replay-forward).

### CCode — 18 Sep 2026 (beta diagnostics + reset workflow)
`7dcdd2e` on `main`. 187/187 tests (13 new). Verified in the browser; the reset
dry run against the live beta reports 0 documents outside the baseline.

**Diagnostics reads the database itself**, not the application's in-memory
copies — a check run against what the app already believes would agree with a
bad transformation on the way in. That makes "what the app shows is what is
stored" a real comparison of two objects reached by different paths. Tampering
with a stored rating was caught independently by that check and by the
state-vs-history check.

It **walks** recorded values and never re-runs the engine. A check that
recomputes what it is checking can only detect a bad engine, not a bad write.
It reports and never repairs, because a diagnostic that quietly fixed things
would destroy the evidence.

Nine checks: unique ids, chain continuity, stored state = end of history,
evidence vs last match, match/event coverage both ways, orphans on either side,
no pre-June data, one schema version, app agrees with store. Each has a test
that breaks the record one specific way — a diagnostic that only ever passes is
decoration.

**Open Question 1a measurement recorded**, as that exception requires: 633
events, 633 documents per session, ~160 events/month, review point 5000 (~28
months). Not due; no change proposed. The screen reports it live so the next
review is a reading, not an investigation.

**Reset is a script, not a button.** What the seed cannot do is remove what it
does not own: club decisions survive a re-seed and keep affecting ratings.
Resetting destroys every decision ever recorded and is not recoverable from
inside the app. So: dry run by default, printing every document it would delete
with what it did to a rating and who recorded it; `--write` AND `--i-mean-it`
required, because `--write` alone is the harmless flag every other script here
uses; project id taken from the seed constant with no flag to redirect it; and
a full diagnostics pass afterwards that fails loudly rather than reporting
success it has not checked.

Backends gained `remove()`. **Nothing in the UI calls it and a test enforces
that** — the record is forward-only, and a decision is undone by recording a
reversal.

**Baton → CGPT.** NEXT is replay-forward. **Open Question 11 should be decided
first** — it is the one-line engine precision fix, and replay-forward is exactly
the thing that will replay those documents for real.

### CCode — 18 Sep 2026 (replay-forward, and the blocker it uncovered)
`8d65edc` on `main`. 202/202 tests (16 new). Verified end to end in the browser.

**The headline is not replay-forward.** Starting it uncovered that **the beta
could not record a game at all** (Open Question 13): approving a submission set
a status in browser storage that nothing has read since the match source moved
to the `matches` collection, so the game vanished and was never rated. That is
now fixed — approving plans an append, shows which four players move and by how
much, and writes on confirmation.

**Replay-forward** rebuilds the engine inputs from the record, applies the
change, and replays everything. Full re-derivation rather than a partial replay
from a midpoint: every input is stored, so this is exact and has no
partial-state bookkeeping to get subtly wrong. Appending costs 9 documents and
4 players; editing one June match rewrites 634 and moves all 34 — and the plan
says so before anything is written.

**Its foundation is `verifyNoOp`** — replaying with no change must reproduce the
record — and it is a precondition of planning any real change. It earned that by
failing three times, each a real defect that reasoning had not caught:
* Initialisations rebuilt without `classificationStatus`. The engine defaults it
  to ESTABLISHED, so every provisional player was silently promoted.
* The diff compared serialised JSON, so Firestore's key order made all 817
  documents look changed.
* **Open Question 15:** Node and the browser differ in the last bit of
  `Math.pow`, so exact equality could never hold across the two.

**Open Question 11 is now lower urgency (Open Question 16).** Replay-forward
replays *intent* — an event is replayed as changing reliability only if it did —
so it routes around the round-trip loss without pre-empting Shaun's decision.

**Open Question 14 closed:** the inert Edit/Delete controls are gone, as
approved long ago. They were worse than inert — a confirmed delete persisted an
overlay and changed nothing.

**Baton → CGPT.** There is no implementation item left in NEXT that CCode can
start on its own. See Section 8: what remains needs a product decision.

### CCode — 18 Sep 2026 (UI regression suite + comparison report)
`291f69b` and `701890d` on `main`. 214/214 tests.

**The UI had no tests at all.** Every defect found during this integration —
historical tiers coming back `undefined`, expectations recomputed from today's
ratings, a modal describing a retired solver, approving a game making it vanish,
a confirmed delete persisting an overlay and changing nothing — was found by a
person driving a browser. None could have been caught by the module tests,
because **every module was correct in isolation and the application wired them
up wrongly.** That is the gap this closes.

Eleven tests boot the real page against a stub built from the same backfill the
seed writes, so the fixture cannot drift from the record. **Verified by
reintroducing three of the original defects: eight of the eleven went red.**
They skip rather than fail without Playwright — a suite that goes red for an
absent dependency teaches people to ignore red.

**The comparison report has a headline the raw numbers hide.** The three largest
differences are settled before a ball is struck: v3 seeds from the tier that was
true when a player first played, production from the tier they hold now, and
Shaun, Tom and Fatch were all corrected C→B. Excluding those three, the mean
absolute difference falls from **31.9 points to 18.4** across the other 31
players. The report leads with why the two systems are *not supposed to agree*,
carries the known caveats (17 of 34 match counts differ, every `player_id` is
null, the snapshot is frozen at 2026-09-16), and ranks the six explanations for
a large difference by how often each is the answer. A test regenerates it and
fails if the committed file has drifted.

**Baton → CGPT.** Only screenshots remain of the old "not built" list, and they
need a decision about what they are for. Everything else in Section 8 is a
product call.


### CGPT — 17 Sep 2026 (latest, Open Question 1a resolved)
On Shaun's behalf, accepted the current once-per-session cumulative
`ratingJourney` read, cached for the session, for Ranking Movement while the
journey remains small. Historical all-player boundary ranks require prior state
for inactive players. Keep `players` as the normal current-state source and use
bounded historical reads where sufficient. Keep Ranking Movement; do not add a
snapshot collection yet. Section 2 records the future review trigger and CCode's
responsibility to raise it when size/read cost/latency becomes material.

**Baton → Claude Code: NEXT #1 Monthly UI presentation is approved and
unblocked, including Ranking Movement.** On `Ledger CCode`, reconcile and
proceed without another architecture decision from Shaun. Preserve all four
monthly stories and the existing performance/award rules; do not recreate a
monthly rating solver. This handoff is Ledger-only; implementation and the
reported 122/122 test result remain those of the last verified CCode work.
Earlier handoffs below are historical; this decision supersedes their pending
1a blocker and absolute prohibition on cumulative historical reads.

### CCode — 17 Sep 2026 (latest, monthly acceptance)
Closed the acceptance gaps on the monthly presentation and fixed two defects
found doing it.

**Invented rank movement.** A player who changed tier mid-month had their
within-tier rank change computed by subtracting a rank in one tier from a rank
in another. Now reported as not comparable, with both boundary ranks and the
tier change shown instead. The live dataset never hit this — the §5.3
promotions all fall on the 1st, so they align with month boundaries — but a
mid-month review would have produced a fabricated number.

**Missing boundary state.** Players who sat a month out had no row at all, yet
their rank moves when others move around them. `inactiveRows` now carries their
boundary state with rating change 0 and performance null (not zero). August has
5 such players, 1 of whom moved rank.

Presentation now shows fallers as well as risers, rank slides as well as climbs,
a "moved without playing" section, and a per-player monthly panel with rating
start→end, overall rank, within-tier rank, and performance — negative movement
rendered identically to positive.

**Two more stale labels removed.** The per-player section and
`MONTHLY_RATING_METHODOLOGY_TEXT` both still described the retired mini-season
solver, the latter telling players their rating resets to their tier seed each
month — the exact thing v3 abolished. A test now fails if that language returns.

Verified in-browser: Shaun July +37.3 pts while falling 4 places overall
(rating and rank diverging), June showing "not ranked at both ends" for his
first month, Fatch +15.9 pts falling a place, KC −1 pt gaining one. Zero page
errors, 128/128 tests. **Baton → Shaun.**

### CCode — 17 Sep 2026 (previous, monthly UI)
Monthly UI presentation built on the existing Rankings screen — no redesign, no
new nav destination. A monthly stories panel separates the four measures under
their own headings with a plain-English line each, and the ranking rows now carry
month-end rating, points moved and a rank arrow alongside performance.

The separation is visible in the data rather than only asserted: in August the
top performer (Erf +14.1%) is not the top riser (PDM +22.7 pts), and KC fell 1
point while climbing a place — rating and rank genuinely diverging.

**Fixed a misleading label:** the monthly methodology note still described "a
genuine tier-seeded rating using only this month's matches, as if it were its
own mini-season". That solver no longer exists. It now explains that the big
number is the one continuous Power Rating as it stood at month end, with points
moved and rank movement beneath it, and that performance is a separate question.

Ranking Movement uses the session-cached cumulative read per the resolved Open
Question 1a. Verified in-browser, zero page errors, 122/122 tests.
**Baton → Shaun.**

### CCode — 17 Sep 2026 (previous, monthly data layer)
Retired the legacy monthly solver. `computeMonthlyRating` is gone; `monthEndRatings`
returns the real Power Rating each player held at a month's close, read from the
journey. New `monthlyViews.js` builds all four monthly stories from one pass over
the real trajectory — no monthly solver exists and a test asserts none returns.

Verified: the final month's closing ratings are *identical* to live player state,
which is only possible if the view is derived rather than re-solved; a month opens
exactly where the previous closed; rank movement uses the tier in force at the
boundary (Shaun reads Tier C in June, B in July); the best performer and the
biggest riser are different players, so the two measures cannot be confused.
In-browser: 633 journey events, 4 months, 34 players, 23 August crossovers, zero
page errors. 122/122 tests.

**Raises Open Question 1a:** Ranking Movement cannot be satisfied by bounded
month-filtered reads, so the implementation currently does one cached
whole-journey read per session. Needs a decision. **Baton → Shaun.**

### CGPT — 17 Sep 2026 (latest)
Resolved CCode's NEXT #1 blocker. **Use filtered `ratingJourney` reads** for
historical monthly state. The old "normal rendering reads players" constraint
is clarified rather than discarded: `players` remains the compact source for
current state, while monthly historical views and Rating Journey may make
bounded month/player event queries. No full journey scan and no precomputed
monthly snapshots at this stage. Add the necessary Firestore index if required.
NEXT #1 is unblocked. **Baton → Shaun/CCode when Shaun issues `Ledger CCode`.**

### CCode — 17 Sep 2026 (latest)
**Blocker raised against NEXT #1 before starting** — now resolved above.
Monthly Rating Movement and Ranking Movement need month-boundary ratings, which
exist only in `ratingJourney`; recommended a month-filtered `ratingJourney`
query over precomputed snapshots.

Also corrected the CLAUDE.md protocol: it required conflicts to be "reported"
without saying where, and only triggered a Ledger update *after* an
implementation task. Conflicts and blockers now go into Open Questions the
moment they are found, since chat is invisible to CGPT and CChat.

### CGPT — 17 Sep 2026 (previous)
Shaun confirmed that replacing Monthly Power Rating must not remove the monthly
progress story. Added the four-part monthly model: Monthly Performance (versus
expectation), Rating Movement (real Power Rating start→end and points change),
Ranking Movement (overall/tier rank start→end plus crossovers), and League Table
(results/points). Monthly Performance remains the podium/Kings basis. Rating and
rank movement come from the actual Sequential-v1 trajectory; **no separate
monthly rating solver is to be recreated.** Also resolved the inert historical
Edit/Delete controls: hide until replay-forward exists.

### CCode — 17 Sep 2026 (previous, match source)
Switched `ALL_MATCHES` to the v3 `matches` collection, closing the 127-vs-150
divergence. September is now in the app (28 matches; history runs 2026-06-02 to
2026-09-15) and the five draws are carried as draws. Verified in-browser: 150
matches loaded, 145 decided, 34 players, **zero record reconciliation failures**
— Rishi now reads W38/L32/D2 = 72 against `lifetimeMatches` 72, where he
previously showed 56. Zero page errors. 110/110 tests.
**Discovered:** legacy match edit/deletion overlays are now inert.

### CCode — 17 Sep 2026 (earlier, read layer)
Built the v3 read layer (`v3Bridge.js`) and switched the `recomputeAll`
chokepoint: `PLAYERS[]` now hydrates from the persisted `players` collection.
Integrated the dated production snapshot as structurally-excluded read-only
reference. Removed the silent `1400` fallback; added an explicit "Power Ratings
unavailable" banner. Verified in a real browser — 34 players hydrate, zero page
errors — and the failure path confirmed working when Firebase is unreachable.
Commit `7e47fb9`, 104/104 tests.

### CChat — 17 Sep 2026
Reviewed and approved the specification. *Note: that approval predates the three
`RATING_MODEL.md` corrections, which now take precedence over the original
specification text.*


---

## 7. RECENTLY COMPLETED

| Commit | Work |
|---|---|
| `79eddad` | "New build available · Refresh" pill when a newer deploy exists (build stamp re-read and compared). 962/962. |
| `a7a6761` | Changing a rated game's date moves it (new id, one replay, attribution and Upcoming links follow) instead of refusing. 959/959. |
| `c6f0b79` | Add a game reads results however they're written (ResultParse): result words, vs, lines, 🏆, set majority, winners-first scores, names, dates; read-out of how it decided. 958/958. |
| `2a7cbe9` | New players enter the rating record with their first approved game (tier from Admin, PROVISIONAL, first-game date); clear message when no tier is set. 951/951. |
| `777b7c0` | Every record counts draws (Shaun's call): rankings W/L & Win %, monthly stats, partnerships, H2H, exports. 948/948. |
| `9809d88` | Player form counts draws: one `PlayerForm` module feeds the profile form/record/Win Rate, Home and recent-form W-D-L; draws no longer dropped (Jams: 3–7 → 1W·3D·6L; 30% → 23.1%); draw colour. 947/947. |
| `4ec05f9` | UI suite's clock-dependent tests pinned to the fixture era (were failing on unchanged code from mid-Oct). |
| `3259cdc` | Predict a Matchup: no card until four valid, distinct players; up to five predictions (add/edit/remove) shared as one condensed card (same predictions); editable controls 16px on phones so iOS no longer zooms on focus. 938/938. |
| `06370f5` | Match Result Card: four/five-set scores stay on one line, each set whole (were splitting "6–" over "4" on phones). 929/929. |
| `bde692b` | Rated games say who submitted them again (were all "Submitted by unknown" since the v3 move): submitter kept at approval in `moneypadel_match_attribution`, seeded games from the 16 Sep export, later approvals show the approver. 927/927. |
| `21f79c1` | Edit Game opens inside the game's card and keeps the reader's place: Cancel / Save / Close / confirmed correction return to where the editor was opened (was: form appended after the list and scrolled to, leaving the reader at the bottom). 920/920. |
| `750e31b` | League and Last 10 read P W D L like every other table; the Monthly Race's P/W/D/L open the matches behind them (shared drill-down, Race wording and points). 912/912. |
| `71dc4f1` | Match Result Card: a draw shows both pairs in the same type, size and colour with "vs" between, on screen and in the picture; no winners' rating row on a draw. 911/911. |
| `a3e515b` | Matchup Card's big figure is the expected share of games (Shaun: % rather than a number of games); typical-match conversion removed. 911/911. |
| `acba496` | Predict a Matchup at the top of More (Admin only) with a share-ready Matchup Card: teams, the call, expected games won in a typical match; Share matchup (picture) and Copy image (or text). More reordered; North vs South moved to Admin / Manage. Prediction unchanged. 911/911. |
| `69e6640` | Player of the Month nominees picture: one 1080-wide PNG of every nominee (players' version of the cards) shared to WhatsApp from Admin or League › Information. 905/905. |
| `010b43b` | Fixture court-booking tests pinned to their own date (they read the real clock and failed once the 14-day window passed). |
| `e5f868a` | Player of the Month nominations. Player-centred reasons (label + one sentence), a four-figure support row, League / Merit / Monthly Race tier winners from the competitions' own tables (Month Champion / Triple Crown when combined), at most three reasons per card, quiet Admin controls, a clean players' shortlist, and a trim note above five. 22 tests, 10 mutations caught; 904/904. |
| `7dca948` | Player of the Month. The app recommends the month's strongest cases (six evidence-backed stories among 5+ match players, ties kept, listed by name, no score); Admin curates and finalises the shortlist, which everyone can see; the group votes; Admin confirms. Snapshots in `playerOfTheMonth`; history, profile awards, and the old points-leader label replaced everywhere. 15 tests, 10 mutations caught; 897/897. |
| `4cbfeb7` | Player status model: Active / Temporarily inactive / Archived on the v3 record; archived hidden from every live list, history untouched; Admin controls. 882/882. |
| `c6acfd9` | Match Result Card + Match Analysis. The celebratory card opens first: winners as heroes with their tier on the day, a big score, one deterministic story, Expected / Performance / pp, and the winners' gains. The full breakdown is one tap behind it. Share result paints the card as a picture for WhatsApp. One view model, no new data path; 874/874. |
| `19662b1` | Completed-match scorecard: one card per rated match, opened from Play › Games and from the approval confirmation. It shows players with their tier on the day, score, winner, Expected / Actual / pp per team, and each player's movement. Every figure is read back from the engine's recorded events; there is no new persistence and no recomputation. 9 tests, 10 mutations caught; 870/870. |
| `269327c` | Desktop-friendly dashboard. Left rail (brand, sections, "Viewing as"), centred capped column, ranges 768 / 1200 / 1600; Home grid, Rankings toolbar + Kings beside podium, Find a Game beside results, Games card grid, Players master-detail, Board Pack and Player Pack editor beside live preview, dialogs and drawers, Escape and focus; `/preview` desktop presets. The phone is unchanged (snapshot at 390/360). All new tests fail on `8854107` but the overflow invariant; 9 mutations caught; 861/861. |
| `382f907` | Board Pack split by tier. Results table and Power Rankings: "Split by tier" (default) or "One list"; League, Merit and Race: "A slide per tier" (default) or leaders on one slide. The Share Deck makes one slide per tier. A mid-month mover is in each tier played. All new tests fail on `abc34d5`; 8 mutations caught; 852/852. |
| `d74d466` | Save a whole pack. Club and player packs: the pack as one PDF (contents + every module), the slides as one PDF (players' view), or every module as a picture; before publishing, nothing written. A PDF writer of its own (`pdfDoc.js`, no library) fed by the share pictures. All new tests fail on `fe9e8b1`; 7 mutations caught; 849/849. |
| `337c70e` | Board Pack losing modules. "Won a set % of games or more" (winners only); new "Lost a set % of games or more" with its own threshold and minimum, carried into packs saved before the split; new "Highest loss % (3+ games)" (losses ÷ games, from `monthlyInformation`'s new `highestLossPct`). Picture saving no longer drops files past the tenth. All new tests fail on `6520a04`; 9 mutations caught; 843/843. |
| `d6e4ae1` | Player Monthly Packs. Admin › Monthly Board Pack › Player packs: a pack per player per month (8 modules plus Admin notes), Generate all, saved as you go, Share Deck preview, pictures, summary, and publish / unpublish to a private 128-bit token link (`review/?p=`) stored as a snapshot in `playerPacks`. Pure `playerMonth.js` / `playerDeck.js`; canonical selectors only. 15 tests (all fail on `501bc8f`), 14 mutations caught; 839/839. |
| `6291cdc` (`ux/player-reset-v2`) | Phase 2 Play. My Games \| Club with Arrange a Game; My Games by what needs doing, with answers in place; Club counters; the game sheet with the stepper and the existing fixture card; a player's "I've booked a court" (DQ6); Arrange a Game (Suggested for you, Request with optional time and venue, Paste a list). Existing screens are unchanged (content snapshot identical, 38 states × 2 widths). 9 tests; 816/816 on the branch. |
| `86beb59` | `submitGameRequest`: one path for asking for a game, carrying DQ9's optional time and venue. The Requests form behaves as before. 2 tests; 780/780. |
| `7d70cc0` | DQ6 (player court booking, attributed, Admin-only reversal), DQ9 (request time and venue), `domain/fixtures/playView.js` (My Games / Club / stepper); the Play badge now counts My Games' Needs you. 10 tests; 778/778. |
| `0772379` (`ux/player-reset-v2`) | Phase 1 shell. Five tabs with More → Me (settings, guides, Admin, "Who are you?"), Rankings Power \| This Month + More tables, one segmented control per section, the Play badge, and system Back (sheets, screens, Home's Full Review). Screen content is identical in all 38 states at 390 and 360 (content-mode snapshot). 15 tests; 795/795 on the branch. |
| `a3f6939` | `playActionCount` (the Play badge's count, DQ29) and the behaviour-snapshot tool committed as `scripts/behaviour-snapshot.js` / `behaviour-diff.js`, with content-only mode. 6 tests; 768/768. |
| `cd844f6` (`ux/player-reset-v2`) | Phase 0 foundations. Tokens (champagne accent, steel-blue Booked, attention, movement, danger, type roles, touch, z-scale), self-hosted Instrument Serif + Inter (OFL, unused by the app so not downloaded), the primitive CSS under new names, presentation-only HTML helpers, and `docs/design/primitives.html`. Snapshot identical at 390 and 360. 18 tests; 780/780 on the branch. |
| `8b7657b` | Product idea backlog (`docs/product/`). It holds three ideas (Video Highlights & Moments, season recap, attendance record) and pointers to the Ledger's parked and open items, with usage and promotion rules. The design map now marks the 30 Sep presentation decisions resolved. Documentation only. |
| `cf72a14` | Design map reconciled to the approved IA. It adds Section 0 (target IA per tab, the DQs settled, new DQ31–33, and the DQ3 confirmation for Shaun), IA notes on every area, IA homes for every current destination, and re-cut phases with acceptance briefs (Arrange a Game in Phase 2; Home 3a/3b). Documentation only. |
| `f98b99e` | Vercel is the primary host (Shaun). Comments in `_config.yml`, `scripts/stamp-build.js` and the split document now say that Pages is compatibility only and that the Vercel stamp is canonical. No behaviour change. |
| `8e1c91e` | Desktop phone preview at `/preview`. The real app sits in a same-origin iframe at 375 / 390 (default) / 412, with rotate, refresh and open full size. It scales to fit without changing the app's viewport, hides desktop scrollbars inside the frame, and shows a link instead of a frame on a phone. It works at `/` and below a repo path; `vercel.json` gains a `/preview` redirect. 10 tests; 762/762. |
| `f75a493` | Parallel-development split finished; **the redesign branching point**. `tests/architecture.test.js` (6 tests: load order, no duplicate or forward top-level names, layered modules only declare, pure domain, stylesheet order) and the final `docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md`. 752/752. |
| `9961823` | C: `app.css` split into base / `components.css` / `shell.css` / `screens/{rankings,home,play,players,games,admin}.css`. Class names are kept and all 827 rules are accounted for. The snapshot is identical at 390px and 360px. |
| `24bf191` … `003c7bc` | B1–B9: renderers, data helpers and components move unchanged from `app.js` (10,178 → 2,215 lines) and `shell.js` (2,568 → 655) into `data/`, `features/<area>/` and `ui/`. The 39-state snapshot is identical after each step. |
| `8437d48` | A: Games filtering and the one-player record become a pure domain module (`gamesFilter.js`) plus a view-model. 8 tests. |
| `fce3fe8`, `8dd9edd` | Source guards scan every application script (`tests/helpers/appSource.js`), and the Club Pulse test's clock is pinned. |
| `fa60180` | Build stamp on Vercel. The stamp was GitHub Pages-only (Jekyll's `build_revision`), so Vercel would have shown "local build". `vercel.json` now runs `scripts/stamp-build.js`, which writes the same line from `VERCEL_GIT_COMMIT_SHA` (Europe/London date) and never touches the placeholder without a real SHA. Pages is unchanged and verified with a local github-pages 232 build. 9 tests; 738/738. |
| `d348c56` | Games: one selected player's filtered record. Played / W / D / L / win % above the list, counted from the same `display` array the rows are drawn from (P = rows, W+D+L = P). Month, game type (historical tiers) and player all apply. Draws come from the recorded outcome, whichever side is stored. Win % uses the League's definition. The zero state never shows 0%. 12 tests (9 fail against the previous code; 3 invariants); 729/729. |
| `08712d4` | Claude Design → implementation map (mapping only). `docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md` maps all 18 areas the brief named, each against its nine questions. It also covers the prototype-to-production translation, the token and primitive layer, the features the design gives no home, architecture constraints, 30 decision questions and a seven-phase order. No production change; 717/717 unchanged. |
| `e4408ff` | D7 Doughnuts. `doughnutMatches(month)` is the one existing definition, lifted out unchanged. It adds a Doughnut List (newest first, ties by id, winners first, shutout set picked out, draws marked, tap opens the game in Play › Games) beside the unchanged By Player leaderboard, plus a Month control shared by both views (Meaningful Month default, choice kept) and an empty state. The draw-wording test now selects All time. 7 tests (6 fail against the previous code; one is the unchanged-definition invariant); 717/717. |
| `9cca86c` | Audit fixes. **D4:** `canSeePredictions()` gates every predicted split and favourite call (Find a Game cards, Home Match to Make, Challenge ready card); `TAB_VISIBILITY_KEY` / `canSeeTab()` make the visibility settings govern the tab guard, shell sub-navigation and landing, More, and Home/profile shortcuts; Find a Game defaults to Visible. **D5:** `tierRankOf()` is the one Tier Rank, read by header, Player Analysis, full analysis and Home; the all-members calculation is removed. **D6:** League and Merit rows carry the games behind P/W/D/L, and one shared drill-down serves P/W/D/L/Hard/Fav. 13 tests (12 fail against the previous code); 710/710. |
| `b12e837` | Fixture follow-up 2: For me / My Requests / Other requests (newest first; one list per request). `fixtureParse.js` plus an "Add multiple games" review: names are never guessed, problems are named, active duplicates are warned about, and one "Create N requests" writes them with a batch id. 14-day Called Out archive derived from `activeSince`, with no write; `calledOutAt` is preserved. Archive/Restore in Manage fixture. Explicit orders for every list. The D1–D3 tests pin their clock. 25 tests (the 19 on changed code all fail against it); 697/697. |
| `0766d7b` | Fixture follow-up. Called Out vs Upcoming, split by an explicit Admin-set `courtBookingMade`. The Upcoming tab has Needs attention / Upcoming / Called Out sections, each collapsible, with "Called out Nd ago". Backing out (by the player or recorded by an Admin) goes to Needs attention with the booking kept. Admin replacement on the same fixture, where the newcomer starts unconfirmed and `formerPlayers` keeps provenance. Manage fixture edits players, sides, answers, date, time, venue and booking, and holds Remove. Legacy fixtures are not classified as booked; an Admin-only review list covers them. Admin-added games ask for the booking. 22 tests, all failing against the previous code; 672/672. |
| `023a0f7` | Fixture flow D1–D3: `fixtureFlow.js` lifecycle (one record, history on every change). Player-visible Remove is gone; "I can't play" is for the viewer only (Needs attention); Admin removal takes two steps. The requester starts confirmed; Pending cards answer only for the selected player; the profile confirm button is removed. Approval asks which Upcoming game a result belongs to, if any, and nothing links silently; the Admin reconciles stale fixtures from the expanded card. Upcoming cards arrive folded and open independently. 25 tests (browser tests 11–24 fail against the previous code); 650/650. |
| `0f9db42` | Player Experience Reset Phase 1 UX audit (evidence only): `PLAYER_UX_AUDIT.md`, 77 screenshots and an index in `docs/ux-audit/`, the journey tap-log, and `scripts/ux-audit-capture.js`; five defects recorded, not fixed (NEXT #15j) |
| `25191b8` | Monthly Race (Best Month) trial: `monthlyRace.js` plus a fourth League-screen View, by tier with provisional players and "No qualifier this month", and an auditable drill-down per score; reconciled to the analysis on the live record (same order in every tier, largest difference 0.23 from per-match rounding); 21 tests, including proof that ratings, League, Merit and Monthly Performance are unchanged |
| `28f3514` | Build stamp moved from More to the foot of Admin / Manage at Shaun's request, shown under the unlock form too; More no longer carries it |
| `fc8ebb6` | Build stamp at the bottom of More: date and short SHA of the deployed build, rendered by GitHub Pages' Jekyll run from `buildInfo.pages.js` (placeholder excluded via a new `_config.yml`), never fetched; tap copies a one-line version; verified with a local github-pages 232 build that nothing else published changes; service-worker lifecycle audited (there is none) |
| `87368a1` | Meaningful Month: Rankings, League and the Home monthly card open on the current month only once it holds 5+ canonical completed matches (draws count, pending don't), else the last month with games plus a quiet "taking shape · N of 5 games" note with a one-tap switch; default pinned on arrival, explicit choice kept per screen; Home "View Full Review" now opens the card's month; Home "Games played" counts draws; 28 tests (0/1/4/5/6, boundaries, time zone, choice, navigation, independence) |
| `63b4ea7` | Players Directory refresh finished in the canonical renderer: quiet filter line, compact sort beside the count, small unified chips, player cards with tier-tinted initials avatars; first player 256→218px shut, 438→344px open; reference screenshots regenerated |
| `d8d6406` | Month state ownership: the Player Profile stopped opening as an August snapshot, Compare stopped writing the Rankings month; each screen owns its month; `populateMonthSelect` requires a value; Home's month workaround removed |
| `55bd9ea` | Home's Last 10 form dots fixed — all ten rendered green after the draw fix changed the sequence from booleans to letters and Home's `isWin?'w':'l'` read every letter as truthy; the three form-run renderers unified on `MatchOutcome.classFor()`, unknown states refused rather than guessed, per-dot regression tests added |
| `fc3706f` | Player filter clearing: a subtle Clear all on the Players in match heading, rendered only while something is selected and leaving Month and Game type untouched; a per-field remove so a four-player search can be corrected by one name; a harness race fixed that made two data-flow tests intermittent |
| `04efe2c` | Four-player search in the Games filters (`playerFilter.js`): order-, side- and partnership-agnostic, one to four players, matching on canonical ids so a rename cannot break a historical search; compact group summary on the shut heading; the single Player select retired |
| `b2c8544` | Draw classification fixed across every screen that describes a game (`matchOutcome.js`): the reported Doughnut "def" on a drawn match, head-to-head totals and cards, the profile summary row's latent `won ? WIN : LOSS`; head-to-head and the profile match log now read a display list that includes draws, leaving every calculation on the rated set |
| `4b53b77` | Play/Upcoming/prediction UX: Games filters fold away with their state on the shut heading; the Your Name card replaced by a contextual identity line inside Add a game; Requests and Upcoming sectioned into folds (both tabs kept separate); Predict a Matchup can add a matchup straight to Upcoming carrying players, sides and optional scheduling; an agreed game exposes the same prediction to admins only; the prediction/Upcoming/result lifecycle made continuous with one record per game |
| `459eb2f` | Data-loading audit and its fixes: start-up's fourteen reads issued together (3,779ms → 499ms to first content at 250ms latency); no screen drawn before the record exists, and start-up draws the screen the reader is actually on; every mutation redraws that screen through one function, guarded by a source-level test; `perfTrace.js` instrumentation behind `?perf=1`; stale reassessment snapshot cleared by any change to the journey; one duplicate Merit build removed |
| `b864786` | Merit gains a Favoured column beside Hard, both tappable, opening the qualifying matches with their fixture-date tiers, score, tier-step gap and points — carried on the row by the canonical calculation rather than reclassified |
| `510c4cc` | Merit scoring refined to a 3-point baseline matching a standard League win, draws worth 0, and a floor of 0 on a win; copy updated and the history re-audited |
| `1781ed5` | A tier section holding one player arrives collapsed, in both the League and Merit tables; resetting forgets what was touched rather than forcing everything open |
| `767e0d3` | Merit Table: an alternative league view scoring the difficulty of each win from historical tiers only (`meritTable.js`), derived on demand and never persisted; behind the existing View select, reusing the League screen's month, tier-split and collapse machinery |
| `2fdc169` | Monthly rankings coherence: same-date event ordering taken from the engine's own rule, tier badge moved to `tierInScope()` so badge and rating describe one moment; Monthly Summary made independently collapsible and stripped of card chrome when collapsed |
| `25e4624` | Editable player names: identity frozen as `playerId`, label carried by `displayName`, translation at two edges (`playerNames.js`); a replay now preserves player-document fields it does not own, which a rename had quietly broken |
| `55d2fa7` | Predict a Matchup copy: predicted winner, expected game share both sides, rating-point edge and a muted footer, replacing `Expected performance score` and the 80/20 blend; visual treatment deferred |
| `11ed091` | League disclosure correction: inline text-and-chevron disclosure in place of a bordered card, global tier accordion replaced by independent per-tier collapses defaulting to expanded |
| `3e326e1` | League refinement: collapsible explanation and tier-table block, Month/View on one row, and a Last 10 form table over each player's own latest ten rated games (`lastTen.js`); duplicate legacy explainer hidden on the League view |
| `43401f8` | Players Directory refresh: folded secondary filters with a state summary, wrapping tier chips, identity-first rows with a chevron, Inactive-only badging, A–Z-only letter headings; player names HTML-escaped where rendered |
| `838ca66`, `14d5a67` | Tom/Fatch integrity audit: record verified correct, stale source (`HISTORICAL_REVIEW_DRYRUN.md`) corrected, `apply-historical-decisions.js` made unable to undo it; Ledger history preserved in `LEDGER_ARCHIVE_2026-09-20.md` |
| `49af41b` | Split-month League Table: match-date tier allocation, isolated tier-segment points/results, whole-month All together transition row |

|---|---|
| `5b637cd` | Idle/inactive merged into the ranked list as a filtered view; Games gains historical tier labels and orientation-independent game-type filters |
| `1a7a037` | Ranked / Idle / Inactive separated behind one shared eligibility helper; five active players were wrongly rankless |
| `8600f1e` | Compact expanded Games card; `See full calculation` fixed (clicks were collapsing the card underneath) and unified across all three cards |
| `a0e3ead` | Game-share wording correction: matching the expectation is no longer called performing above it; capture script caches the live record |
| `3de23bf` | Plain-English rating explanations with the decimals behind a disclosure; Games given its own All-time month after finding it opened on August |
| `346ed66` | Play history: correction/removal controls collapsed behind a per-card Manage affordance, and absent for non-admins |
| `9de1a88` | Power Rating Guide in More, and "Why your rating moved" on the match card, read from persisted facts |
| `94c3983` | Production match-facts import applied: 7 new matches, 14 players moved, verified against a fresh re-read |
| `f974fea` | Reusable, idempotent production match-facts importer; `appendMany` on replay-forward |
| `e0fdcbc` | CGPT visual acceptance: all eight presentation fixes, plus a stored-vs-displayed score-orientation defect the new browser test caught |
| `7178544` | Review screenshots from the live record; Rating Journey correction display fixed (markers and copy now follow the delta, not the event type) |
| `0f7c2ed` | Three authorised historical club decisions applied to the beta; four defects fixed en route |
| `9cc3c13` | Historical Club Adjustment: Admin tool over replay-forward, superseding audited corrections |
| `17ed790` | Phase B historical dry run (`HISTORICAL_REVIEW_DRYRUN.md`); no write path |
| `62347ea` | Phase A: mandatory rating decision on every tier change; shared pre-review snapshot; tier history from the record |
| `701890d` | `COMPARISON_REPORT.md` and its generator; snapshot readable from Node |
| `291f69b` | UI regression suite — 11 browser tests over the defects that shipped |
| `8d65edc` | Replay-forward (`replayForward.js`); approving a game now rates it; inert Edit/Delete controls removed |
| `7dcdd2e` | Beta diagnostics (`betaDiagnostics.js`) and guarded reset workflow (`scripts/reset-beta.js`); backend `remove()` |
| `2a61943` | Club reassessment write path (`clubDecision.js`) and Admin Monthly Review; club-decision movement separated in monthly views |
| `19ffe21` | Last two reconstructions retired; `matchFacts.js`; per-player match deltas; draws shown as rated |
| `6fd7a1c` | Kings of Tiers / podium / tier filter on historical tier; fixed empty-TIER_MAP defect erasing all historical tiers |
| `bd47757` | Real Rating Journey UI: persisted events replace the reconstruction; "story estimate" disclaimer deleted |
| `707f6e8` | Monthly acceptance: tier-change rank guard, inactive boundary state, fallers/slides, stale methodology copy removed |
| `05f6cd4` | Monthly UI: four views presented; stale mini-season copy corrected |
| `717e9b4` | Legacy monthly solver retired; `monthlyViews.js` builds all four monthly views from the real trajectory |
| `e8d21f4` | Match history sourced from the v3 matches collection |
| `e967f39` | PROJECT_LEDGER.md migrated into the repository |
| `7e47fb9` | CLAUDE.md coordination protocol |
| `5a93378` | v3 read layer; `recomputeAll` switched to v3; production snapshot integrated |
| `1cb8ff4` | `RATING_MODEL.md`; pagination regression test |
| `c629ab4` | Firestore set-score encoding fix (nested arrays rejected) |
| `dea1acd` | `--limit` smoke-test flag for the seed |
| `ceb1b62` | v3 persistence, temporal tiers, beta backfill script |
| `aa9651e` | T2 reassessment recommendation module |
| `73a06ad` | Experiment 11 walk-forward regression |
| `d2063d3` | Stage 1 and Stage 2 validation against Experiments 11/12 |
| `b18add0` | `sequential-v1` rating engine |

Backfill of 817 documents to `mp-dashboard-beta-v3` verified against the plan:
0 missing, 0 malformed ids.


---

## 8. NEXT

**CCode, 31 Oct (latest): Race match details behind a Details button (`d3a663d`, 973 / 973).** Baton → Shaun.

**CCode, 31 Oct (latest): redesign Power Rankings + app-wide fonts (`646d91b` on `redesign`).** Baton → Shaun to review at mpr.sgj.luxe.

**CCode, 31 Oct (latest): the Monthly Race leads (`3f45899`; redesign Home hero on `redesign`), 970 / 970 on `main`.** Baton → Shaun. Home hero type set in Georgia (option C, `7f5b5e8` on `redesign`).

**CCode, 31 Oct (latest): Merit Table columns sort (`060108b`, 970 / 970).** Baton → Shaun.

**CCode, 30 Oct (latest): Race column on the Merit Table (`eaed298`, 969 / 969).** Baton → Shaun.

**CCode, 30 Oct (latest): Merit Table Even column (`0baa96f`, 967 / 967).** Baton → Shaun.

**CCode, 30 Oct (latest): standings site for members (`1108a73`, 967 / 967).** Baton → Shaun: add `mpstandings.sgj.luxe` to Vercel on Production, then share that link with the group. Decision open: Admin sign-in before the full app goes to members (Open Questions, 30 Oct).

**CCode, 27 Oct (latest): the redesign is up to date with the live app (`ed8a9dd` on `redesign`, 1011 / 1011) and served at mpr.sgj.luxe.** Baton → Shaun to review the redesign there. From now on, `main` is merged into `redesign` whenever it moves on, so the redesign never falls behind.

**CCode, 27 Oct (latest): new-build notice (`79eddad`, 962 / 962).** Baton → Shaun. The notice first appears on the deploy after this one, since a device must already be running this build to check.

**CCode, 27 Oct (latest): a game's date can be corrected in place (`a7a6761`, 959 / 959).** Baton → Shaun: the Rishi & Topsy v Tom & Fatch date can now be changed to 26 Oct from Edit game.

**CCode, 27 Oct (latest): Add a game reads results however they're written (`c6f0b79`, 958 / 958).** Baton → Shaun. Topsy approved (confirmed by Shaun). Open idea: several results in one paste.

**CCode, 27 Oct (latest): new players join the record with their first approved game (`2a7cbe9`, 951 / 951).** Baton → Shaun: approve Topsy's pending game (Rishi & Fatch def Tom & Topsy, 26 Oct). It now rates and brings her in at Tier C.

**CCode, 15 Oct (latest): every record counts draws, per Shaun (`777b7c0`, 948 / 948).** Baton → Shaun / CGPT. Nothing open on draws.

**CCode, 15 Oct (latest): player form counts draws everywhere it is shown (`9809d88`, 947 / 947).** Baton → Shaun / CGPT. One decision: should Power Rankings' W% count draws too (Open Questions, 15 Oct)? Rating Review flags should read `PlayerForm`.

**CCode, 10 Oct (latest): Predict a Matchup batches + iPhone input zoom (`3259cdc`, 938 / 938).** Baton → Shaun / CGPT. For Shaun: singles predictions are gone from this tool (four players required), and Add to Upcoming works on a single prediction only. Say if either should change.

**CCode, 8 Oct (latest): four/five-set scores fit the Match Result Card (`06370f5`, 929 / 929).** Baton → Shaun / CGPT.

**CCode, 6 Oct (latest): rated games say who submitted them again (`bde692b`, 927 / 927).** Baton → Shaun / CGPT.

**CCode, 6 Oct (latest): editing a game keeps your place on the Games tab (`21f79c1`, 920 / 920).** Baton → Shaun / CGPT.

**CCode, 6 Oct (latest): League P W D L, and the Race's counts open their matches (`750e31b`, 912 / 912).** Baton → Shaun / CGPT.

**CCode, 5 Oct (latest): draws on the Match Result Card no longer look like wins (`71dc4f1`, 911 / 911).** Baton → Shaun / CGPT.

**CCode, 4 Oct (latest): the Matchup Card shows the expected % of games (`a3e515b`, 911 / 911).**
Baton → Shaun / CGPT. One open idea: Upcoming's prediction could use the same card.

**CCode, 4 Oct (latest): Predict a Matchup is the top of More with a share-ready card (`acba496`, 911 / 911).**
Baton → Shaun / CGPT.
- **Try it (unlocked):** More → **Predict a Matchup** → four names →
  **Share matchup** → WhatsApp, or **Copy image** and paste.
- **Decide (Section 5):** a typical match from the record (25 games now) or
  a fixed length; whether Upcoming's prediction should use the same card.

**CCode, 4 Oct (latest): one picture of the Player of the Month nominees (`69e6640`, 905 / 905).**
Baton → Shaun / CGPT. **Try it:** Admin › Player of the Month › September →
Finalise → **📷 Share nominees picture** → WhatsApp.

**CCode, 4 Oct (latest): Player of the Month nominations refined (`e5f868a`, 904 / 904).**
Baton → Shaun / CGPT.
- **Try it:** Admin / Manage › Player of the Month › September 2026 (KC,
  Len, Rishi), then July (7 nominations and the trim note). Finalise, then
  look at League › Information as a player.
- **Decide (Section 5):** a hard rule above five; the titles "Month
  Champion" and "Triple Crown"; the joint-winner wording.

**CCode, 4 Oct (latest): Player of the Month is live (`7dca948`, 897 / 897).**
Baton → Shaun / CGPT.
- **Try it:** Admin / Manage › Player of the Month › September 2026 →
  review the cases, remove or add, **Finalise shortlist for the vote**, then
  **Won the vote?** → **Confirm winner**. Players see the shortlist and then
  the winner in League › Information; the winner's profile shows the award.
- **Decide (Section 5, nothing blocked):** story wording/floors, a cap at
  five, past months before June, in-app voting later.

**CCode, 4 Oct: player statuses and archived players are live (`4cbfeb7`, 882 / 882).**
Baton → Shaun / CGPT. Four small follow-ups in Section 5.

**CCode, 3 Oct (latest): the Match Result Card is live (`c6acfd9`, 874 / 874).**
Baton → Shaun / CGPT.
- **Try it:** Play › Games → tap a game → **🏆 Match result**. Then
  **Share result**, or **View match analysis**.
- **Decide (Section 5):** the story thresholds and wording; a win that
  cost rating; the label "Performance".

**CCode, 2 Oct (latest): the completed-match scorecard is live (`19662b1`, 870 / 870).**
Baton → Shaun / CGPT.
- **Try it:** Play › Games → tap a game → **Match scorecard**.
- **Decide (Section 5):**
  - keep Expected / Actual on the engine's scale (recommended);
  - reword or drop the older "Expected X% of games" line;
  - which surfaces get the button next.

**CCode, 1 Oct (latest): the app is desktop-friendly (`269327c`, 861 / 861).**
Baton → Shaun / CGPT.
- **Try it:** open the app on a laptop, or use `/preview` at 1280, 1440
  or 1920.
- **Decide (Section 5):** Me on desktop arrives with the redesign's Me;
  the deferrals are listed there.

**CCode, 1 Oct (latest): the Board Pack splits by tier with every tier
included, in the report and the slides (`382f907`, 852 / 852).** Baton →
Shaun / CGPT. Confirm or change the Tier S call (Section 5).

**CCode, 1 Oct (latest): whole packs can be saved as PDF or as pictures
(`d74d466`, 849 / 849).** Baton → Shaun / CGPT. Please try "Slides as
PDF" into WhatsApp from a phone.

**CCode, 1 Oct (latest): the Board Pack has its losing modules
(`337c70e`, 843 / 843).** Baton → Shaun / CGPT. Everything below still
stands.

**CCode, 1 Oct (latest): Player Monthly Packs are live (`d6e4ae1`,
839 / 839).** Baton → Shaun / CGPT.
- **Try it:** Admin / Manage › Monthly Board Pack › Player packs ›
  Generate all, then open a player › Preview › Publish pack › Copy link.
- **For Shaun (Section 5, OPEN 1 Oct):** add the `playerPacks`
  read-by-id, no-listing Firestore rule. Recommended.

**CCode, 1 Oct (later still): partnerships show draws, and the win/loss
% counts at the threshold (`2d43540`, 824 / 824).** Baton → Shaun / CGPT.

**CCode, 1 Oct (later): Board Pack options, W-D-L and autosave are live
(`f58ec1d`, 823 / 823).** Baton → Shaun / CGPT.

**CCode, 1 Oct: the Tier S sections switch, and pictures from the Board
Pack and the Share Deck, are live (`6f40764`, 820 / 820).** Baton → Shaun
/ CGPT. Please try sharing to WhatsApp from a phone. Everything below
still stands.

**CCode, 30 Sep (later still): the Monthly Review Share Deck is live on
`main` (`4af924d`, 810 / 810). Baton → Shaun / CGPT.**
- **Try it:**
  1. Admin / Manage › Monthly Board Pack.
  2. Preview › Share Deck.
  3. Publish review.
  4. Copy summary, or Share, into WhatsApp.
- **For Shaun (Section 5):**
  - Are predictable month links acceptable?
  - Go-ahead for image export (1080 × 1350) as the next sub-increment.
- The queued redesign work below is unchanged. Retire "as before", then
  Phase 3a (Home).

**CCode, 30 Sep (later): the Board Pack now also has the Monthly results
table and "Won or lost over 80%" (`e666a96`, 796 / 796).** Everything
below still stands.

**CCode, 30 Sep: the Admin Monthly Board Pack is DONE on `main`
(`9e4a5e6`, 795 / 795). Baton → Shaun / CGPT.**
- **Review it:** Admin / Manage › Monthly Board Pack, on the production
  deployment of `main`.
- **For Shaun (Section 5):**
  - Should a finalised pack freeze its figures? The recommendation is
    not yet.
  - Two stats were left out for want of a canonical source: monthly
    head-to-head and "notable results".
- **Approved and queued for CCode, on `ux/player-reset-v2`:** Shaun
  accepted all three on 30 Sep. They wait only because the Board Pack
  brief said to leave the redesign branch alone. The next `Ledger CCode`
  starts them in this order:
  1. Retire "Upcoming, as before" and "Requests, as before" from Club
     (the new Play lists are accepted).
  2. **Phase 3a (Home)**, with DQ1 as resolved: no bar or threshold line;
     the one-line gap reads "N pts below the lowest-rated Tier A player".
     The sections are the live This Month hero (DQ31), Needs You, Next
     Game, Last Time Out and Around the Club. Power Rating, Tier Rank and
     form become one line, and Match Ideas leaves Home.
  - Merge `main` into the branch first, so the Board Pack comes with it.

**CCode, 30 Sep: Phase 2 (Play) is DONE on `ux/player-reset-v2` (`6291cdc`).
Baton → Shaun.**
1. **Accept the new Play lists?** If yes, CCode retires "Upcoming, as
   before" and "Requests, as before" from Club.
2. **DQ1:** promotion as a goal. The recommendation is no bar and no
   threshold line; keep the one-line gap, worded as "N pts below the
   lowest-rated Tier A player".
3. **Then the Phase 3a (Home) go-ahead.** In order:
   - the live This Month hero, text-first (DQ31);
   - Needs You;
   - Next Game (Upcoming only);
   - Last Time Out;
   - a light Around the Club.
   Power Rating, Tier Rank and form are demoted to one line. Match Ideas
   leaves Home, since it now lives in Arrange a Game.
- **Review on the branch's Vercel preview at `/preview`:** Play › My
  Games, Club, a game's sheet, and Arrange a Game.
- **`main`:** `5264d3e`, 780 / 780.

**CCode, 30 Sep: Phase 1 is DONE on `ux/player-reset-v2` (`0772379`), with
no screen's content changed. Baton → Shaun.**
- **Before Phase 2 (Play) can start, Shaun decides DQ6–DQ9.** The
  recommendations are in the CCode handoff above.
  - The main one is **DQ6**: whether a player in the game may record
    "Court booked".
- **Then the Phase 2 go-ahead:**
  - the `playView.js` view-model;
  - My Games | Club;
  - Arrange a Game (find / request / paste a list, with Match Ideas);
  - game detail with the stepper;
  - the Admin Manage sheet;
  - the booking sheet, and Played Games & Results.
- **Review Phase 1 on the branch's Vercel preview, at `/preview`:** the
  tabs, Me, Rankings › More tables, Back.
- **`main`:** `a3f6939`, 768 / 768.

**CCode, 30 Sep: Phase 0 is DONE on `ux/player-reset-v2` (`cd844f6`), with
no visible change. Baton → Shaun.**
- **Next decision: the Phase 1 (Shell) go-ahead.** It covers:
  - five tabs, with More → Me;
  - Me as the home of the former More destinations;
  - the entry points Rankings **Power | This Month** with More tables,
    Play **My Games | Club** with Arrange a Game, and Players Directory;
  - the Play badge (DQ29), and system Back.
- **Its acceptance line** (map 7.1): every former More destination is
  within two taps; visibility settings govern every entry; Back never
  exits the app from inside a sheet; no screen's content changes.
- **Review Phase 0 on the branch's Vercel preview:**
  `…/docs/design/primitives.html`.

**CCode, 30 Sep (later): the idea backlog is created (`8b7657b`), and the map
records the presentation decisions. Baton → Shaun.**
- **The one decision that starts the redesign:** a go-ahead for **Phase 0**,
  foundations on `ux/player-reset-v2`:
  - tokens, with champagne gold and a distinct Booked hue;
  - Instrument Serif + Inter, self-hosted;
  - the primitive CSS and a primitives reference page;
  - **no visible change**, proved by the 39-state snapshot.
- **Also for Shaun when convenient:**
  - IB-01's consent question;
  - the still-open DQ1, DQ6, DQ7, DQ8, DQ9, DQ10, DQ15 and DQ26, which only
    block later phases.

*(Shaun/CGPT's edit of CCode's header, 30 Sep, kept:)*

**CCode, 30 Sep: the map is reconciled (`cf72a14`), `ux/player-reset-v2`
exists (`b4e57e4`), and the CGPT presentation decisions are now resolved. Baton → Shaun / CGPT for the phase go-ahead.**
- **Resolved:** DQ2, DQ5, DQ11, DQ20, DQ24, DQ29, DQ30, DQ31, DQ32 and DQ33; the Kings/podium basis conflict is also resolved in favour of the current Power Rating implementation.
- **Phase 0 is unblocked:** tokens and primitives with no visible screen change. It still follows the normal phase-by-phase approval process; no broad redesign is implicitly authorised by resolving the questions.
- **Phase 1 blockers are cleared** from the presentation side (DQ5 / DQ29).
- **Implementation on `main`:** unchanged at `8e1c91e`, 762 / 762.

*(Shaun/CGPT's 30 Sep header and lines, kept:)*

**Player Experience Reset is now unblocked at the IA level. Baton → CCode for redesign setup/reconciliation, then back to Shaun/CGPT before broad visual implementation.**
- **Hosting:** Vercel is primary (`main` = production, branches = preview deployments). To let CCode verify deploys, share a Vercel URL (Section 5).
- **Current implementation:** `8e1c91e`, **762 / 762 tests** (250 browser). The desktop phone preview is at `/preview`.
- **Redesign branch:** create **`ux/player-reset-v2`** from the recorded architecture branching point `f75a493`, then merge current `main` into it immediately so hosting/preview/non-redesign updates are inherited. Do not use the old `app-redesign` branch.
- **First redesign task:** reconcile `docs/design/CLAUDE_DESIGN_IMPLEMENTATION_MAP.md` and the phase briefs to the 30 Sep approved IA: Home · Rankings · Play · Players · Me; Home live hero; Rankings Power|This Month; Play My Games|Club + Arrange a Game; Players Directory→Profile; Me personal dashboard.
- **Do not start a broad cosmetic pass before that reconciliation.** Preserve canonical domain/data logic and the parallel-development ownership split.
- **Design map baseline:** `08712d4` (mapping before the IA decisions above).

*(The lines this replaces read "`fa60180`, 738 / 738 tests".)*

*(Shaun/CGPT's queued header, 29 Sep, kept: the increment it names is now delivered.)*
> **One approved product increment is queued.** Baton with Claude Code after Shaun/CGPT handoff.
> - **Current implementation:** `e4408ff`, **717 / 717 tests** (234 browser).
> - **Design map:** `08712d4` — delivered; mapping only, no production UI changed.
> - **Approved next:** Games filtered player record summary (29 Sep): with exactly one player selected in Play › Games, show P/W/D/L + win % for the exact filtered match set above the historical rows. Historical matchup classification remains authoritative.

*(The line this replaces read "`63b4ea7`, 561 / 561 tests (158 browser)",
stale since 26 Sep.)*

1. **DONE (`838ca66`).** Tom/Fatch integrity audit — record verified correct.
2. **DONE (`43401f8`).** Players Directory visual refresh.
3. **DONE (`3e326e1`).** League refinement: collapsible explanation, Month/View on one row, Last 10 form table.
4. **DONE (`11ed091`).** Disclosure correction: inline disclosure, independent per-tier collapses.
5. **DONE (`55d2fa7`).** Predict a Matchup copy. Visual treatment deliberately unchanged.
6. **DONE (`25e4624`).** Editable player names. Identity frozen, label free.
7. **DONE (`2fdc169`).** Monthly rankings coherence and the Monthly Summary disclosure. The persisted record was correct; both faults were display-side.
8. **DONE (`767e0d3`).** Merit Table. Derived from canonical matches and the canonical historical-tier resolver, never persisted, not a rating. Audit found a maximum gap of 2 tier-steps and win values of 2–5, so **no cap is needed**. Placed behind the existing View select — **if Shaun wants it as a segmented button or its own tab instead, that is a one-line change.**

9. **DONE (`1781ed5`).** A one-player tier section arrives collapsed, in both the League and Merit tables. Supersedes the 21 Sep default-expanded rule for one-player sections only.
10. **DONE (`510c4cc`).** Merit scoring refined to a 3-point baseline, draws worth 0, a win floored at 0. The two tables now share a baseline, verified on the record: six players score identically in both.
11. **DONE (`b864786`).** Merit shows Favoured beside Hard, both tappable, opening the matches behind the count with their fixture-date tiers, score, gap and points — derived from the canonical calculation, not reclassified. Fits 375px without sideways scroll.

12. **DONE (`459eb2f`).** Performance / data-loading audit, profiled before anything
   was changed. The findings, in the order they were asked for:
   **(1)** Start-up was a sequential `await` chain: three collections, then
   eleven configuration documents, then recompute, then `render()`.
   **(2)** `render()` draws only the rankings list, and start-up never called
   `renderActiveTab()` — so a screen tapped during the load was drawn once,
   from nothing, and never drawn again. Reproduced for Players, League, Merit,
   Call-Outs, Head-to-Head, Games and Wishlist.
   **(3)** Of 1,924ms to first content at 120ms latency, 1,717ms was fourteen
   round trips in series and 16ms was computation. At 250ms: 3,779ms.
   **(4)** No duplicate reads on navigation; the only duplication was five
   mutation sites re-reading all three collections serially, and one Merit
   table rebuilt to count its own rows.
   **(5)** Adopted: read everything at once, gate every renderer on the record,
   end every mutation at one refresh function.
   **(6)** Stale-data risks found: `reviewSnapshotCache` was cleared only by
   the review commit, not by a correction, approval or adjustment that rewrites
   the same journey — now cleared by all of them. No listeners, so a second
   person's submission is still invisible until reload (below).
   **(7)** Nothing derived is worth caching — every screen redraws in
   single-digit milliseconds. The record is deliberately **not** cached; see
   the Decisions Log.
   **(8)** Repeat navigation was already instantaneous (0.2–6.3ms warm) and is
   unchanged.
   Acceptance test passes in a browser against the live record: a result
   submitted while sitting on the Games screen appears there without
   navigating, and it did not before this change.

13. **DONE (`4b53b77`).** Play / Upcoming / Prediction UX, all six parts.
   **(1)** Games filters fold, arrive shut, and carry their own state on the
   shut heading. Add a game joined the same chevron so the two controls above
   the log read as one thing. A latent defect fell out: the game-type fallback
   lived beside the select that offers the options, so it corrected itself one
   render too late — moved ahead of the filtering.
   **(2)** The Your Name card is gone; see the Decisions Log for the audit.
   **(3)** Requests and Upcoming sectioned; **both kept as separate tabs**, as
   instructed, pending a look at the condensed design.
   **(4)** Predict a Matchup → Add to Upcoming, carrying players AND sides,
   with date/time/venue optional.
   **(5)** An agreed Upcoming game exposes the same prediction, folded,
   admin-only, from the same module — verified in a browser that a
   non-admin is offered neither the control nor the text.
   **(6)** Lifecycle continuous, one record per game.
   Verified with the same browser probe before and after: name card present →
   gone; three filter selects on arrival → none; a result submitted by a
   chosen player with nothing typed refused → accepted and attributed; no
   prediction from Upcoming → one.

14. **DONE (`b2c8544`).** Draw wording bug and the audit behind it. Five sites
   found, four wrong and one latent. Two of them were wrong by OMISSION rather
   than misclassification: head-to-head and a player's own match history were
   built from the rated set, so a drawn meeting was invisible — two players who
   had drawn once and never otherwise met were told they had never played each
   other. Tests use the six real recorded draws, and one checks the stored
   documents come back unchanged with no write attempted.

15a. **DONE (`fc3706f`).** Clearing the player filter: Clear all on the heading,
   appearing and disappearing with the selection, plus a remove on each filled
   field. Month and Game type are explicitly out of its scope.

15. **DONE (`04efe2c`).** Four-player search. Verified against the record: Eli,
   Erf, Len and Max have played all three possible pairings of themselves, and
   the search finds all three whichever order the names are typed.

15b. **DONE (`55bd9ea`).** Home form-dot regression, reported by Shaun and
   caused by CCode's own draw fix three commits earlier. Display only; no
   calculation touched. See the handoff for what the audit found.

15c. **DONE (`d8d6406`).** Player Profile stuck on August — genuine
   shared-state leakage, fixed at the root. See the handoff.

15d. **DONE (`63b4ea7`).** Players Directory visual regression — the refresh
   had been delivered but only half-finished; now completed in the same
   renderer. See the handoff.

15f. **DONE (`87368a1`).** Meaningful Month defaulting. See Section 2 for the
   per-screen rule and the handoff for what changed on Home.

15g. **DONE (`fc8ebb6`, moved `28f3514`).** Build stamp at the foot of Admin /
   Manage, derived from the deployed commit. See Section 2 for the mechanism and the update lifecycle.

### Waiting on Shaun

15j. **Player Experience Reset — Phase 1 UX audit DELIVERED (`0f9db42`).
   Baton → Shaun / CGPT for Phase 2** (what Money Padel should feel like;
   Keep / Simplify / Move / Merge / Hide / Remove; new journeys). Evidence
   only: no UI, data, methodology or navigation change.
   - **Evidence:** `PLAYER_UX_AUDIT.md`; screenshots and index in
     `docs/ux-audit/`; `docs/ux-audit/journeys.json`.
   - **Method:** selected player PDM, 390px plus a 375px pass, every state
     reached by real taps, 0 writes attempted.
   - **Headlines:**
     - The fixture flow is broken at both ends.
     - "Who's best this month?" has six different answers across the app.
     - Admin leaks into four player surfaces.
     - Home lacks "my next game" and "waiting on me".
     - Engine vocabulary is on first screens.
     - System Back exits the app; touch targets are 12–30px; Games is ~23
       screens long.


   **Product direction confirmed by Shaun / CGPT (26 Sep): Player Experience
   Reset comes before any native-iOS conversion.** The next design phase is a
   deliberate usability cleanup, not a cosmetic reskin and not a native rewrite.
   The target is that an ordinary club player can understand what matters, find
   what they need and take the obvious next action without Shaun explaining the
   app. Phase 2 will use the audit evidence to classify the current experience
   **Keep / Simplify / Move / Merge / Hide / Remove**, then redesign the core
   player journeys and information architecture before CCode changes the UI.
   Admin should progressively disappear from the normal player's mental model.
   A possible dedicated **Me** experience is a product question to assess from
   the evidence, not an approved navigation change. **No Phase 2 implementation
   is authorised by this note; baton remains with Shaun / CGPT for synthesis.**

   **Defects found during the audit, NOT fixed (brief: no opportunistic
   fixes). D1, D2 and D4 are data-integrity or Shaun-decision matters, so
   they are for Shaun:**
   - **D1.** Any player can delete any Upcoming or Pending game with one tap:
     no admin gate, confirmation or undo.
   - **D2.** A player's game-request confirmation ("I'm in!") renders hidden
     in the current profile, so player-made requests can never reach
     Upcoming. All 8 live Upcoming games were created by Shaun. If it were
     visible, it is keyed to the viewed profile, not the viewer.
   - **D3.** Upcoming is stale. Two 23 Sep games were played and recorded
     but are still listed; one 24 Sep game is past its date.
   - **D4.** The admin "Visible to everyone" toggles are ignored by the
     current navigation. Find a Game (default *Admin only*) is every
     player's Play landing tab and shows win-% predictions, contrary to the
     21 Sep decision that predictions are admin-only.
   - **D5.** A profile can show two different tier ranks for the same player
     (Rishi: header "#8 Tier" vs analysis "#9 of 9").

   CCode recommends deciding D1, D2 and D4 before Phase 2 redesigns the
   same flow.

   **27 Sep: D1, D2 and D3 DONE (`023a0f7`)** per the Shaun/CGPT decisions in
   Section 3, together with the collapsed Upcoming cards. **D4 and D5 remain
   open, for product discussion; CCode has not started them.** The wider
   Player Experience Reset is also not started. Findings for whoever designs
   the next step are in the 27 Sep CCode handoff.

   **27 Sep, later: fixture follow-up DONE (`0766d7b`).** This covers Called
   Out vs Upcoming, Court booking made, backing out and replacement, and
   Manage fixture (Section 3). **D4 and D5 are still open and not started.**
   The Section 5 fixture questions are for Shaun / CGPT.

   **27 Sep, later still: fixture follow-up 2 DONE (`b12e837`).** This covers
   My Requests, Add multiple games and archived call-outs (Section 3).
   **D4 and D5 are still open and not started.**

   **28 Sep: D4 and D5 DONE (`9cca86c`)** with D6 (P/W/D/L drill-downs), per
   Shaun's decisions in Section 3. All five audit defects are now closed.
   **D7 (Doughnuts list and month) DONE (`e4408ff`).**
   **Phase 2 (the wider IA and redesign) is not started.** Baton with Shaun /
   CGPT.

15m. **DONE (`fa60180`).** The build stamp works on Vercel as well as GitHub
   Pages. Section 5 has the one Vercel setting to confirm when the project
   is connected.

15l. **DONE (`d348c56`).** Games: one selected player's filtered record.
   Section 5 has three small choices (draws in the win rate, pending
   submissions excluded, and April/May counted when listed).

15k. **Claude Design implementation map DELIVERED (`08712d4`). Baton →
   Shaun / CGPT to approve a phase.**
   - This is the mapping step of Phase 2 of the Player Experience Reset
     (15j).
   - **Proposed order:**
     - 0: tokens and primitives;
     - 1: shell, where More becomes Me;
     - 2: Play;
     - 3: Home;
     - 4: Rankings;
     - 5: Players, Profile and Me;
     - 6: the rest.
   - **Decisions each phase waits on:** Section 5, *OPEN 28 Sep — Claude
     Design migration*.
   - **Nothing is implemented.**

15i. **APPROVED TRIAL — Best Month / Monthly Race** (Shaun, 26 Sep).
   Analysis is complete in [`BEST_MONTH_ANALYSIS.md`](./BEST_MONTH_ANALYSIS.md).
   Shaun has approved taking the **Power-Rating-stakes monthly race** forward as
   a trial. This is deliberately a fifth story, distinct from League, Merit,
   Monthly Performance and Power Rating:

   - **Power Rating** — who is strongest overall.
   - **Best Month / Monthly Race** — who had the best results this month,
     adjusted for the actual difficulty of the matches they took.
   - **Monthly Performance** — who most exceeded their own pre-match
     expectation.
   - **League** — cumulative conventional result points.
   - **Merit** — cumulative points with coarse tier-step difficulty adjustment.

   **Why this is approved for trial.** Raw win percentage was rejected because
   it rewards easier fixtures and protecting a hot record. The live September
   analysis also shows why a separate difficulty-aware monthly race matters:
   players can be active and successful against unusually hard schedules
   without topping volume-led leaderboards. PDM is the clearest live example:
   7-2-7 in his Tier B September spell, average opposing pair 1525 and only a
   38% par win chance; he is #2 in the PR-stakes race despite not leading the
   conventional tables. This is the intended product value: make strength of
   schedule visible without declaring that any player should be promoted.

   **Trial model.**
   - Every player starts each tier spell in the month on **0**.
   - Match stakes are set before the result from the partner's and opponents'
     persisted pre-match Power Ratings, while the player being scored is
     treated as an **ordinary/average member of their tier**. This keeps the
     race about performance against tier standard rather than whether the
     player was personally underrated.
   - Use the results-calibrated win curve from the analysis (current fitted
     scale **250**, not sequential-v1's game-share expectation). This is a
     separate monthly-results calculation and **must not alter sequential-v1**.
   - Use the simple race presentation from the analysis: with K=20 an even
     fixture is approximately **+10 / -10**; harder fixtures offer more upside
     and less downside, easier fixtures the reverse.
   - Rank by the **running race score / total stakes result**, not the earlier
     `total ÷ (P + 8)` cushioned score. The +8 model remains preserved in the
     analysis as explored history, but is **not the approved trial UI/model**.
   - **5 matches** in that tier spell remains the qualification threshold.
     Below-threshold players may be shown as provisional.
   - Draw treatment must follow the exact race analysis/calibration and be
     documented in the implementation; do not improvise a new rule.
   - Historical tier resolution remains canonical. A mid-month move creates
     separate tier spells; results are never moved into the player's new tier.

   **Product decisions now resolved.**
   - **Mid-month movers CAN win Best Month in the tier they left.** The award
     belongs to the tier spell in which those matches occurred. Rishi's B
     results remain a Tier B September race even though he later became A; his
     A spell starts separately from 0.
   - **Tier C is not merged into B.** If nobody reaches the qualification
     threshold, show **No qualifier this month** rather than manufacturing an
     award.
   - **Headline number is the race score**, not the cushioned +8 score.
   - Treat this as a **trial**, not a replacement for any existing table.
     Preserve League, Merit, Monthly Performance, Power Rating and their
     methodology unchanged.

   **UX / transparency requirements.**
   - The player-facing explanation must stay simple: *everyone in a tier starts
     the month level; each match has stakes based on how hard it is for an
     average player of that tier with the actual partner/opponents; harder wins
     earn more and harder losses cost less; highest qualified score at month-end
     had the best month.*
   - Make the score auditable. A player must be able to open their monthly race
     score and see the matches that produced it, including opponent/partner
     context, pre-match stakes, result and points gained/lost.
   - Prefer showing the stakes anywhere it naturally strengthens the existing
     Admin Prediction / Upcoming relationship, but **do not expose the
     admin-only prediction itself to players**. Race stakes are a separate
     transparent competition fact.
   - Use the same historical match/tier and persisted pre-match rating facts as
     the analysis; do not create a parallel source of truth.
   - Keep the UI consistent with the existing premium monthly tables and
     Meaningful Month behaviour.

   **CCode implementation brief.** Implement the trial from the already-audited
   analysis rather than re-inventing the formula. Add targeted module/browser
   tests for neutral opponent-choice behaviour, hard/even/easy stakes, draws,
   5-match qualification, provisional players, split-month tier spells,
   no-qualifier Tier C, drill-down reconciliation, and proof that
   sequential-v1/League/Merit/Monthly Performance are unchanged. Re-run the
   September comparison after implementation and reconcile the rendered order
   to `BEST_MONTH_ANALYSIS.md`; report any discrepancy before changing the
   methodology. Update this Ledger with implementation commit, test totals and
   live audit findings.

   **Baton → CCode. Approved to implement as a trial.**

   **DELIVERED (`25191b8`, CCode, 26 Sep).** Implemented from the analysis,
   formula unchanged. **625 / 625 tests** (21 new; the 5 browser tests fail
   without the wiring).

   **Reconciled on the live record (read 26 Sep, 04:10 UTC):**
   - Par ratings are identical to the analysis.
   - The qualified order is identical in every tier:
     - A: Osh +47.5 > Erf +42.2 > KC +37.2 > Len +21.5 > Rishi −3.6 > Kaz −15.8
       > Eli −38.8 > Ant Slicer −54.6.
     - B: Rishi +76.4 > PDM +38.3 > Antz +22.9 > Tom +12.7 > Rocky +3.6 >
       Max −16.7 > Stormz −24.9 > Jords −40.8.
     - C and S: "No qualifier this month".
   - Nothing was unresolved.

   **Discrepancies and open items (reported, not acted on):**
   1. **Rounding.** Points are settled to 0.1 per match so the drill-down adds
      up on screen. Scores differ from the analysis's unrounded K × Σ by at
      most **0.23**, and no position changes. This is an implementation
      choice, not a methodology change.
   2. **Stakes on Upcoming: not added. Needs a methodology decision.** Par is
      built from everyone who plays in the tier that month, so it drifts as the
      month goes on. In September a match's win stake moved by a median 0.4
      and at most **0.9** between match day and month end; the order was the
      same either way. Most of the drift came from the 20 Sep tier changes:
      Rishi's opening rating joining A's par took it from 1694 to 1667.
      Quoting stakes before a match would therefore be *nearly* right, not
      final. **CCode's recommendation:** if stakes are to be shown pre-match,
      fix par when the month starts (for example, the tier's opening ratings
      as of the 1st) so a quoted stake never changes. That is a change to the
      approved definition, so it is for CGPT/Shaun, not CCode.
   3. **By the analysis's definition,** a player who moves tier mid-month
      contributes their month-opening rating to the par of *both* tiers. It is
      faithful to the analysis and small in effect (item 2), but worth
      CChat's eye.

   **Baton → Shaun/CGPT** for item 2, and CChat for items 2–3 and the
   fitted curve. The trial is usable as it stands.

15h. **RESOLVED 26 Sep, 03:57 UTC — Pages deploys again; cause found.** No
   Pages build ran for any push between `6efc096` (02:45) and `971298e`, and
   Shaun's phone kept the pre-stamp build. **Cause: pushes from CCode's git
   connection stopped triggering Pages** after the session resumed from a
   context compaction; before that, the same kind of push had triggered a
   build every time (last: `815e849`, 02:12). The commits were on `main`; only
   the trigger was missing. **Proof:** one commit made through the GitHub API
   (`40d9456`, authored as sgj-92) started a Pages build within seconds, and it
   published everything outstanding (Meaningful Month, the build stamp) with
   the stamp rendered as `assets/js/buildInfo.js`. **Standing practice for
   CCode:** if a git push produces no "pages build and deployment" run, make
   the last change through the GitHub API, then confirm the run. Nothing
   needed from Shaun.

15e. **RESOLVED 26 Sep by Meaningful Month (`87368a1`)** — League and Merit
   open on the current month once it has 5 games. *Original question, kept:*
   **Should League and Merit open on the current month?** Shaun's 26 Sep
   brief said League/Merit *may* default to the current month. They open on
   the last completed month today, by their own recorded decision, from their
   own state — they were never coupled to Rankings, and this task did not
   change them. If he wants the current month, it is one line in
   `renderSummary`.

16. **Should the rated set include draws?** *(Found during the draw audit, not
   acted on.)* Draws ARE rated — six matches, 24 journey events, real
   `actualScore` and `preMatchExpectedScore` — but `getEffectiveMatches()`
   filters them out, so `MATCHES` holds 153 of the 159 games. Player draw
   counts are already tracked separately, so records reconcile; what does not
   include them is Recent Form (which feeds the Power Rankings "Recent form"
   sort) and the upset filter. Including them would move a ranking sort, which
   is why it was left alone rather than folded into a display fix. Two lines
   either way, and it needs a decision rather than a default.

17. **Requests and Upcoming: one screen or two?** Held deliberately at Shaun's
   instruction until the condensed design could be seen. It can now:
   Requests is four folded sections (Challenges, Request a game, Admin add,
   Pending) and Upcoming is one folded list. **CCode's reading is that they
   should stay two:** Requests is where a game is proposed and negotiated,
   Upcoming is a fixture list that an admin acts on, and folding has already
   taken most of the length out of both. But this is his call, not an
   implementation detail.

18. **Should a plain request also carry time and venue?** The prediction path
   and the admin add-straight-to-Upcoming path both do. The ordinary request
   form still offers only a preferred date, on the reading that an unconfirmed
   proposal is not a fixture. One line either way.

19. **Cache the app shell?** Every launch downloads 825KB of JavaScript, 104KB
   of CSS and the Firebase SDK, with no service worker. A service worker would
   make repeat launches close to instant and carries **no risk to the record**
   — it caches code, never data. It is a deployment change (cache
   invalidation, an update path when a new version ships), which is why it is
   here rather than done. Roughly a second saved per launch on a phone.
   *26 Sep, from the build-stamp audit:* this is also where a reliable
   **"Update available · Refresh"** belongs. Without a service worker there is
   no waiting worker to detect; polling the stamp could tell a device a newer
   build exists, but Refresh could still load cached scripts for up to 10
   minutes, leaving the prompt showing after the tap. A service worker's
   `waiting` → `skipWaiting` on tap makes it exact. Not built.

20. **Live updates between devices?** There are no Firestore listeners, so if
   one person submits or approves a game, another person's open app does not
   see it until they reload. Nothing about this changed today, and it may well
   be acceptable for a club of 34 — but it is now the only remaining way a
   screen can hold an out-of-date number, so it should be an answered question
   rather than an assumption.

21. **Predict a Matchup visual render.** The copy is delivered and the layout was
   deliberately left alone. `docs/screenshots/19-admin-predict.png` shows the
   current copy in the existing treatment, which should make the render easier
   to specify against. Nothing will be invented here in the meantime.

### Needing a person, not an implementer

22. **`All together` tier column — confirm or correct.** It describes the tiers a player **occupied** that month, so someone who moved on the 20th and has not played since still reads `B → A`. Describing only the tiers they actually played in is a one-line change if Shaun prefers it. *(Carried since before the compaction; still unanswered.)*
23. **Tier S is invisible to every tier-scoped view** (Section 5, item 8). Manny is the only Tier S player; **Kings of Tiers hardcodes A/B/C and the tier filter offers A/B/C**, so he cannot appear in either. *Partly addressed 22 Sep:* Shaun's instruction to collapse Tier S by default treats it as a real tier that belongs on the League and Merit tables, which it now is. **Still unanswered:** whether Kings of Tiers and the tier filter should include S. Low urgency, but it should not stay open before beta.
24. **Engine precision** (Section 5, item 11). A one-line lossless fix in `ratingEngine.applyStateEvent`, recorded as a passing `KNOWN:` test rather than applied, because the engine is frozen. Replay-forward routes around it, so it blocks nothing — but it needs a decision rather than indefinite deferral.
25. **Match cards changed shape** (Section 5, item 9). K is per-player, so the old "+X for winners · −X for losers" is true for nobody and each player's own change is listed instead. Recorded for review, never presented as settled.

### Standing

26. **Every task:** add targeted browser/module regression coverage for changed behaviours, and update this Ledger with the commit, test totals and findings. A new regression test is verified to fail against the old code before it is accepted.
27. **The rating-model backlog and match sharing (Section 5) remain parked and unauthorised.** No changes to Sequential-v1 methodology, tier-history semantics or Reliability rules.

*The NEXT list this replaces, as it stood before the compaction (`deaec37`),
read: "**All items are DONE (`49af41b`).** The League Table splits a month by
the tier in force on each match date; points never transfer between tiers;
`All together` stays one row and shows the transition. Nothing is queued for
CCode." Item 13 above is the one open question it carried forward.*