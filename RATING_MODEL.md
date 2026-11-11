# Money Padel Prestige v3 — Rating Model

**Engine version:** `sequential-v1` · **Recommendation version:** `t2-quartile-v1` · **Schema:** `v3-1`

This document records what the v3 rating model does, why it was chosen over the
alternatives, and — as honestly as possible — how much confidence each part of
it deserves.

> **Read the confidence tiers.** The match mathematics and the club
> reassessment recommendation are *not* equally well established, and the
> document is deliberately structured so that difference is impossible to miss.
> Tier 1 is validated against 144 matches. Tier 3 rests on 42 observations.

---

## Confidence tiers at a glance

| Tier | What | Evidence |
|---|---|---|
| **1 — Validated** | Match mathematics, K curve, reliability, Monthly Performance, replay determinism | Reproduces every published Experiment 11/12 figure exactly |
| **2 — Settled by decision** | Tier baselines, the §5.3 historical classifications, ordering tie-break, storage layout | Club decisions and structural choices, not statistical claims |
| **3 — Provisional** | Club reassessment recommendation (T2 boundary, α) | 3 players / 42 observations; Brier did not improve at any α |

---

# Tier 1 — Validated engine

## The five concepts, kept separate

v3 exists to stop five things being conflated. They must never collapse into
one another.

| Concept | Question it answers |
|---|---|
| **Power Rating** | How strong do we estimate this player to be right now? |
| **Reliability** | How much match evidence supports that estimate? |
| **Monthly Performance** | Did they beat the expectations that existed *before* their matches that month? |
| **League Standings** | Who accumulated the most results? |
| **Competitive Tier** | Where has the club classified them to compete? |

A Power Rating of 1600 at 20% Reliability means something fundamentally
different from 1600 at 90%. A tier promotion is a club decision, never a rating
consequence.

## Parameters

```
kMax = 40   kMin = 10   rc = 10   mode = weighted (non-strict-zero-sum)

reliability(p) = effectiveEvidence[p] / (effectiveEvidence[p] + rc)
K(p)           = kMin + (kMax - kMin) × (1 - reliability(p))
               = 10 + 30 × (1 - reliability(p))
```

Smooth, no thresholds, asymptotic toward 10:

| effectiveEvidence | 0 | 1 | 5 | 10 | 20 | 40 | 70 |
|---|---|---|---|---|---|---|---|
| reliability | 0% | 9.1% | 33.3% | 50% | 66.7% | 80% | 87.5% |
| K | 40.0 | 37.3 | 30.0 | 25.0 | 20.0 | 16.0 | 13.8 |

`lifetimeMatches` and `effectiveEvidence` are distinct. They normally increment
together, but a club reassessment may reduce effective evidence and must
**never** alter `lifetimeMatches`, which is a factual record.

## Match mathematics

```
pairRating  = mean(team ratings)
expectedA   = 1 / (1 + 10 ** ((pairRatingB - pairRatingA) / 400))
actualScore = 0.80 × gameShare + 0.20 × matchResult     (win 1.0 / draw 0.5 / loss 0.0)
residualA   = actualA - expectedA        residualB = -residualA
```

Each player then moves by **their own K**:

```
teamA.forEach(p => R[p] += K(p) × residualA)
teamB.forEach(p => R[p] += K(p) × residualB)
```

This is the weighted, non-strict-zero-sum behaviour. It is deliberate and must
not be forced to zero-sum.

The same blended score drives both Power Rating and Monthly Performance.
Monthly Performance must never use raw game share.

## Draws are first-class

Matches are modelled as `{teamA, teamB, sets, outcome}` with
`outcome ∈ {A_WINS, B_WINS, DRAW}` — never `{winners, losers}`, which leaves the
update sign undefined for a draw.

This is not theoretical. The legacy engine was `{winners, losers}`-shaped, so
its parser silently dropped every draw. Three September draws were missing from
the dataset until v3 recovered them.

Underdogs drawing a stronger pair get a **positive** residual; favourites
drawing a weaker pair get a **negative** one; an evenly matched draw is
**≈ zero**.

## Monthly Performance

```
matchPerformance   = blendedActualScore - preMatchExpectedScore
monthlyPerformance = mean(matchPerformance across that month's matches)
```

Simple mean per match. **There is no monthly rating reset** — a player carries
one continuous Power Rating (June ends 1432 → July begins 1432).

- **Not** rating points gained — that is contaminated by K/Reliability
  (measured 4.7× variation for identical performance).
- **Not** game-weighted.
- **No** strength-of-schedule bonus — opponent strength is already inside
  `preMatchExpectedScore`; adding one double-counts.

Eligibility: 1–2 matches provisional · 3+ table and Kings of Tiers · 5+ podium.

Persisting the pre-match expectation per player is **mandatory**. Without it a
future model change silently rewrites historical Monthly Performance.

## Validation

Two stages, because Experiments 11/12 predate the §5.3 historical
classifications. Stage 1 replays the experiments' own assumptions to prove the
mathematics; Stage 2 is the authoritative v3 result.

**Stage 1 — engine equivalence.** Every published checkpoint reproduces exactly:

| | June | July | August | September |
|---|---|---|---|---|
| Rishi | +8.17% | +0.22% | +4.57% | +4.90% |
| MK | — | — | +23.2% | — |

Final ratings: Shaun **1385.7**, Tom **1358.4**. Walk-forward accuracy
**66.4%** over the 122 matches where all four players had ≥1 prior match (119
decided plus the 3 draws, which are predictable but have no winner to score).

**Stage 2 — authoritative.** Deliberately different, and the figures that count:

| | June | July | August | September |
|---|---|---|---|---|
| Rishi | +5.81% | −1.11% | +4.35% | +3.80% |

Final ratings: Shaun **1178.7**, Tom **1148.0**.

The dataset is 144 matches: everything through 2026-09-11 plus one 2026-09-13
match (MK & Rocky def Max & Harry) added by hand from a screenshot.

### Correction to the specification: Fatch's seeding

§7.1 states the experiments seeded all players from their current tier. That is
true for Shaun and Tom but **not for Fatch** — the legacy
`BASE_STARTING_TIER = {"Fatch": "C"}` was already in force, so Experiments 11/12
used it. Fatch is therefore seeded at Tier C in **both** stages.

Seeding him at B reproduces none of the checkpoints. This is self-consistent
with §7.3 listing final-rating shifts for Shaun and Tom only: Fatch's seed never
changed, so he moves only through playing them.

---

# Tier 2 — Settled by decision

## Tier baselines and classification

```
C = 1100    B = 1400    A = 1700    S = 2000
```

**ESTABLISHED** — the club believes the starting tier reflects current ability.
**PROVISIONAL** — the club assigned a temporary tier to an unknown player.

Only a PROVISIONAL player can receive an `INITIAL_CLASSIFICATION_CORRECTION`;
after correction or confirmation the status becomes ESTABLISHED and the
mechanism is gone.

**The authoritative history (complete — nobody else changed tier in the period):**

| Player | Entry | Status | Event | Effective |
|---|---|---|---|---|
| Shaun | C / 1100 | PROVISIONAL (`UNKNOWN_NEW_PLAYER`) | `INITIAL_CLASSIFICATION_CORRECTION` C→B | 2026-07-01 |
| Tom | C / 1100 | ESTABLISHED | `PROMOTION` C→B | 2026-07-01 |
| Fatch | C / 1100 | ESTABLISHED | `PROMOTION` C→B | 2026-08-01 |

## Tier is temporal metadata

A tier change alone produces **Power Rating change = 0 and Reliability change =
0**. Historical displays use the tier that applied *at the time*: promoting
someone in September must never rewrite them as Tier A in an August King of
Tier B table. `tierHistory.js` is the single implementation.

## Ordering — an honest source of uncertainty

Source data has **date granularity only**. Permutation testing measured up to
**~16 points** of deviation from ordering alone.

The tie-break is each match's permanent Match ID (`YYYY-MM-DD-N`). Retrieval
order can no longer reach the result: replaying the dataset shuffled or reversed
is byte-identical.

> A real defect was found here. `orderMatches` originally derived the tie-break
> from array position and ignored an explicit source index, so database
> retrieval order could still leak into ratings even with everything else
> correct. Only implementation exposed it.

The Match ID sequence disagrees with the pre-ID row order on three dates
(2026-06-22, 2026-07-18, 2026-08-19) — rows submitted later sort first, so the
sequence is an export artifact, not play order. Canonical ordering moves Rishi's
June performance by **0.03pp** and Shaun's final rating by **0.02 points**:
roughly 500× smaller than the accepted ~16-point range. The experiments'
ordering is preserved as `EXPERIMENT_TIE_BREAK` so the equivalence proofs still
reproduce the published figures.

**If true play order is ever recoverable** (timestamps, a submission log, the
original screenshots' order), canonical ordering should switch to it.

## Results decided by a club rule (forfeit, late arrival)

Two Admin-applied rules store a match at a result other than the one played.
Both keep all players in the match and the pair's expectation unchanged; they
differ only in which result each player is rated on.

- **Forfeit** (Shaun, 7 Nov; `match.forfeit`): the player who quit loses and the
  opponents win, at the score as it stood. The partner gets no rating event, no
  evidence and no match counted.
- **Late arrival** (Shaun, 11 Nov; `match.late`): the late player's side starts
  a set down. The extra set changes the result only, and **no games are added**,
  so game share stays as played. The match is stored at the counted result, and
  the late player and the opponents are rated on it. The on-time partner is
  rated on the match **as played** (`late.playedOutcome`, same sets, same
  expectation). In the app, both kinds of partner are left out of the tables and
  records (v3Bridge).

## Data scope

The authoritative match history is the CSV export. The April/May 2026 block (50
unverified matches) is **display-only**: it lives in
`historicalDisplayMatches.js`, is referenced by exactly one line of code inside
`getDisplayMatches()`, and is never an input to the engine, the Rating Journey
or Monthly Performance. The Data Range toggle changes the view alone.

Six players appear only in that block — Twoshay, Alfie, Abby, Kam, Kevin, bruh —
and therefore hold no Power Rating, no Reliability and no journey. That is
correct, and asserted by a test.

## Storage

```
matches/{matchId}         id = the export's Match ID
ratingJourney/{eventId}   {matchId}__{player} | {date}__{player}__{eventType}
players/{playerId}        snapshot, fully rebuildable from the journey
```

Document ids are deterministic, so re-seeding overwrites rather than
duplicating. The journey has its own collection because it is append-heavy: 150
matches is already 633 events, growing ~120/month, which would run a single
blob document into Firestore's 1MB limit inside two years.

Two Firestore constraints cost a live write to discover, and both now fail in
the test suite instead:

- **Nested arrays are rejected.** A set score is stored as `{teamA, teamB}` per
  set, not `[gamesA, gamesB]`.
- **Collection reads paginate by response size.** A reader ignoring
  `nextPageToken` truncates silently and looks exactly like missing data.

## Model versioning

`ratingModelVersion` is persisted on every calculated record and event.
Historical `sequential-v1` results must never be silently recalculated by a
future `sequential-v2` engine.

---

# Tier 3 — Provisional: club reassessment

**Everything in this section is decision support, not a validated prediction.**

## Why the alternatives were rejected

| Approach | Why it failed |
|---|---|
| **Summed simultaneous updates** | Volume bias — more matches at the same mean performance moved you further regardless of quality |
| **Pure normalisation** | Sparse-network instability; a single result swung low-evidence players 270–315 points |
| **Pseudo-match regularisation** | Stabilised the network but reintroduced volume dependence |
| **Permanent tier anchors** | Administrative tier changes manufactured rating (+100 to +256); two identical players stayed ~228 points apart permanently |
| **Tier-blind simultaneous** | Elegant and internally coherent, but materially worse out-of-sample: 59.1% vs 67.7% overall, and 22% vs 67% on B↔C matches |
| **Sequential E** | Retained useful initial-classification information while letting it decay through evidence |

**Sequential E did not statistically dominate.** Tier-seeded simultaneous at
pm=8 reached 67.7% — but over only 96 matches, against Sequential E's 66.4% over
122. It was selected on combined product and statistical grounds: coverage,
chronological behaviour, decaying initial influence, explainability, and a
reassessment architecture that can be audited.

## The T2 boundary

```
promotion: T2 = midpoint( upperQuartile(established in OLD tier),
                          lowerQuartile(established in NEW tier) )
demotion:  inverted — lowerQuartile(old), upperQuartile(new)

newRating = oldRating + max(0, α × (T2 − oldRating))   // promotion
newRating = oldRating + min(0, α × (T2 − oldRating))   // demotion
```

The directional clamp prevents double-counting: a player already past the
boundary is recommended no movement at all.

**"Established" is a parameter, not a constant** — default `effectiveEvidence >= 5`.
Experiment 13 used 8; 13B and 13C used 5, and those are the runs with evidence
behind them.

Two rules were recovered by reproducing the historical boundaries and are
pinned by tests:

1. **Pool membership is evaluated as the tiers stand *after* the review.** The
   player under review counts in the tier being joined, never the one being
   left. Without this the 1 July pool is 8 rather than 9 and the boundary does
   not reproduce.
2. **Quartiles use linear interpolation** (numpy default / R type 7).

| Review | Old upper Q | New lower Q | T2 | Established |
|---|---|---|---|---|
| 1 Jul 2026 C→B | 1117.4 | 1368.7 | **1243.1** | 1 / 9 |
| 1 Aug 2026 C→B | 1093.6 | 1302.8 | **1198.2** | 1 / 12 |

Both reproduce exactly.

> **The dataset-end B→A row is stale.** Its pool counts (13/7) reproduce only at
> a threshold of 8 — Experiment 13's value, not 13B's — and its quartile values
> reproduce at no threshold at all. It predates 13B and should not be used.

## α values

| Event | Best-performing | Shipped |
|---|---|---|
| PROMOTION / DEMOTION | 0.50 | **0.25** |
| INITIAL_CLASSIFICATION_CORRECTION | 0.75–1.0 | **0.25** |

Shipped deliberately more conservative than the best-performing value until
shadow-testing accumulates real reviews.

**Never rebase to the new tier's seed.** Experiment 13C showed rebasing Shaun to
1400 predicted a 48.4% win rate against an actual 25.0%, degrading Brier from
0.170 to 0.217 and win accuracy from 81.3% to 75.0%. The target is T2, never the
seed.

## The thin-pool guard, and what it costs

If either side has fewer than 3 established players, **no recommendation is
returned** rather than a fabricated target.

This means the guard **refuses both historical C→B reviews** — each had only one
established Tier C player. The shipped rule declines to recommend in exactly the
cases 13B validated on, and will stay silent for most C-tier reviews until the C
population grows. That is the intended trade (refusing beats fabricating), but
it should not come as a surprise.

## Honest caveats

- 13B rests on **3 players / 42 observations**; 13C on **1 correction / 16 matches**.
- **Brier score did not improve at any α.**
- No validated method exists for recommending a *Reliability* change on a tier
  move, so none is offered. The board override remains available.
- Recommendation logic is isolated and separately versioned so it can be
  replaced wholesale without touching match mathematics.

## Circularity safeguard

Risk: *rating rises → board promotes because of rating → reassessment raises
rating → the same evidence counted twice.*

The system **warns and records; it does not block.** An authorised override is
never hard-blocked. Structured reasons are preferred: `UNKNOWN_NEW_PLAYER`,
`INITIAL_LEVEL_OVERESTIMATED`, `INITIAL_LEVEL_UNDERESTIMATED`,
`OBSERVED_PLAYING_LEVEL`, `PLAYER_DEVELOPMENT`, `PLAYER_DECLINE`,
`MONTHLY_CLUB_REVIEW`, `COACH_CLUB_ASSESSMENT`, `OTHER`.

---

# Known limitations

**The initial seed decays slowly.** Two players 300 points apart retain ~176
after 20 matches, 79 after 80, 39 after 150, 10 after 300. Far better than
permanent anchors, but this is one reason Club Reassessment exists.

**Path dependence.** Chronological order matters — ~≤16 points in permutation
testing. The simultaneous model had none. This is an accepted trade.

**Reliability is evidence quantity, not truth probability.** 80% Reliability
does **not** mean "80% chance this rating is correct."

**Club reassessment contains subjective information.** Intentional — hence the
audit requirement.

**Drift does not reconcile.** The specification states ~1.8 points of drift
across 144 matches. Measured drift is **−42.8** (Stage 1) / **−39.1** (Stage 2).
Since every other figure reproduces to the decimal, this is almost certainly a
different drift metric rather than an engine fault — but it is unresolved and
recorded here rather than quietly reconciled. Drift is accepted by design; only
the published magnitude is in question.

---

# Non-negotiables

- **Historical immutability.** Changing a tier today must not change June's
  Power Rating, Monthly Performance, tier awards, match expectations or league
  tables. A reassessment on 1 October affects state from 1 October forward only.
- **One authoritative implementation.** No duplicated rating mathematics across
  Rankings, Profiles, Matchups or Admin.
- **Auditability.** For any current Power Rating the system must reconstruct
  initial rating → chronological match movements → explicit reassessments →
  current rating. If it cannot, the data model is insufficient.
- **Never tune constants to reproduce stale figures when the inputs have
  legitimately changed.**

# Product philosophy

Power Rating is Money Padel's current estimate of playing strength. Reliability
says how established that estimate is. Match results continuously update it.
Initial club classification provides useful starting information but does not
permanently determine level. Monthly Performance measures whether a player
exceeded the expectations that existed at the time. Competitive Tier is a club
decision, not an automatic consequence of rating.

The board may reassess when it holds meaningful information the match data does
not capture. The system provides a statistical recommendation; the board may
override both Rating and Reliability. Every intervention is explicit,
forward-looking and permanently auditable.

**The algorithm is a decision-support system, not a replacement for club
judgement.**
