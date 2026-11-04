# Recommended Reliability for a club reassessment — validation

**Status: analysis for review. Nothing is implemented and no engine behaviour
has changed.** The Ledger requires candidate rules to be validated against the
club's own decisions before a formula is chosen; this is that validation.

Reproduce with `node scripts/moneypadel/model-reassessment-reliability.js` (read-only).
Findings are pinned in `tests/reassessmentReliability.test.js`.

---

## What a reassessment actually does

Two things happen when the board reclassifies a player, and only one of them
touches reliability:

- the **tier move** (`PROMOTION` / `DEMOTION`) changes the tier and **nothing
  else** — not the rating, not the reliability;
- the **anchor decision** (`CLUB_RATING_REASSESSMENT`, or
  `INITIAL_CLASSIFICATION_CORRECTION`) replaces the Power Rating with a number
  the board chose, and reopens reliability.

So the recommendation does not belong to "a promotion". It belongs to **the
board replacing a rating**, and the question it answers is *how much confidence
should attach to the number the board just chose*.

That framing matters for the rule: a player's match record is evidence for the
rating it produced. It is not evidence for a different number the board
substituted. How much of it carries across depends on how far the number moved.

## The evidence available

Three decisions, all of them in the record:

> **Superseded 20 Sep 2026.** The analysis below was performed against the
> record as it stood that morning, when Tom was anchored to Jords (1352.5) and
> Fatch to Tom (1358.6), all three at 10%. Shaun then corrected both anchors to
> the Tier B baseline of 1400 and reopened them at 20%. **The table and the
> conclusions that follow have been re-derived against the corrected record.**
> Reproduce with `node scripts/moneypadel/model-reassessment-reliability.js`.

| Player | Date | Anchor move | Prior evidence | Prior reliability | Chose | Afterwards |
|---|---|---|---|---|---|---|
| Shaun | 2026-07-01 | 1136.8 → 1400.0 (**+263.2**, 88% of a tier) | 5 | 33.3% | **10%** | 16 matches, −27.0 |
| Tom | 2026-07-01 | 1103.4 → 1400.0 (**+296.6**, 99% of a tier) | 4 | 28.6% | **20%** | 18 matches, −12.2 |
| Fatch | 2026-08-01 | 1137.1 → 1400.0 (**+262.9**, 88% of a tier) | 14 | 58.3% | **20%** | 11 matches, −22.1 |

**Every anchor proved slightly too high**, and the record pulled each of them
back down. That is the reopening working as intended: it is not a statement
about the player's experience, it is how fast a board-chosen number is allowed
to be corrected by results. At 10% reliability K is 37 and at 20% it is 34,
against a maximum of 40.

## What these three decisions can and cannot settle

They are all the same **situation** — a near-whole-tier anchor move — but they
are no longer all the same **answer**: Shaun at 10%, Tom and Fatch at 20%.
Prior evidence ranged from 4 to 14, more than threefold, and made no difference
to either answer.

That difference is a board decision, not a property of the data. It means **no
single rule with one floor reproduces all three**, and the fit table below says
so. What the record still cannot speak to is the case the club has not yet met
and certainly will: a settled player whose rating the board nudges by 30 points.

## Candidate rules

| Rule | Shaun | Tom | Fatch | Worst miss |
|---|---|---|---|---|
| Flat reopen — always 10% | 10.0% | 10.0% | 10.0% | 10.0 pts |
| Keep 25% of prior evidence | 11.1% | 9.1% | 25.9% | 10.9 pts |
| Keep 50% of prior evidence | 20.0% | 16.7% | 41.2% | 21.2 pts |
| Move-scaled (10% floor), ≤222 points | 10.0% | 10.0% | 10.0% | 10.0 pts |
| Move-scaled (10% floor), 300 points | 12.9% | 10.2% | 16.0% | 9.8 pts |
| **The rule in use** — move-scaled, D = 150, **20% floor** | 20.0% | **20.0%** | **20.0%** | Shaun only |

**Proportional discounting is ruled out, and Fatch is why.** He carried 14
matches into his reassessment — three and a half times Tom's 4 — and the board
gave him exactly the same answer. Any rule that scales prior evidence must give
him materially more than Tom. The board did not.

**The rule now in use reproduces Tom and Fatch exactly** and differs only on
Shaun, whose 10% predates the 20% floor and is recorded as a board decision.
That divergence was already deliberate and is unchanged by this correction.

**Move-scaled rule.** Retain prior reliability in proportion to how much of the
old rating survived:

```
reliability_new = min( reliability_before,
                       0.10 + (reliability_before − 0.10) × max(0, 1 − |Δrating| / D) )
```

The `min` matters: reassessing a rating can only ever add doubt, so it must
never raise a player's reliability — which the unclamped form does for anyone
already below 10%.

**The record no longer bounds `D` at all.** While all three decisions shared one
answer, any D at or below the smallest observed move reproduced them exactly.
Now that two sit at a different floor from the third, no single-floor
move-scaled distance fits all three — the script searches for one and reports
that none exists. `D = 150` was chosen on the reasoning below, not on a fit.

## Where the two surviving rules disagree

They are indistinguishable on everything the club has decided. They differ only
on what it has not:

| Case (prior evidence, anchor move) | Flat | Move-scaled, D = 150 |
|---|---|---|
| Settled player (20 matches), **30-point correction** | 10% | **55.3%** |
| Settled player, 90-point move | 10% | 32.7% |
| Settled player, half-tier move (150) | 10% | 10% |
| Settled player, whole-tier move (300) | 10% | 10% |
| Newer player (4 matches), 30-point correction | 10% | 24.9% |
| Brand-new player (1 match), whole-tier move | 9.1% | 9.1% |

The first row is the decision worth thinking about. Under a flat rule, moving a
twenty-match player thirty points discards twenty matches of evidence and sets
K to 37 — the board's small correction makes that player's rating *more*
volatile than a newcomer's. Under the move-scaled rule the correction is
absorbed and the record is kept.

## What reopening costs

Evidence rises by exactly one per match, so this is arithmetic:

| Reopened to | K | Matches back to 50% |
|---|---|---|
| 10% | 37.0 | 9 |
| 25% | 32.5 | 7 |
| 40% | 28.0 | 4 |
| 55% | 23.5 | 0 |

## DECIDED — Shaun, 20 Sep 2026

**Move-scaled, `D = 150` points, with a `20%` floor.** Flat reset is rejected.

```
reliability = min( reliability_before,
                   0.20 + (reliability_before − 0.20) × max(0, 1 − |Δrating| / 150) )
```

Implemented as `Reassessment.recommendReliability` (`move-scaled-v1`). The
`min` is load-bearing: without it a player already below 20% would be *raised*
to the floor by a decision that only added doubt.

**How it sits against the club's own history, as corrected on 20 Sep.** Tom and
Fatch were re-anchored to 1400 and reopened at **20%** — which is exactly what
this rule recommends for a move that size, so the board and the system now
agree and the record shows agreement rather than an override. Shaun's **10%**
predates the floor and stands as a recorded board decision; the rule would
recommend 20% for the same inputs. The board can still override downward — that
is what override is for. Anyone re-running the validation will see that one
divergence; it is intended.

What it produces:

| Prior evidence | Prior reliability | Re-anchor | Recommends | K |
|---|---|---|---|---|
| 20 matches | 66.7% | 30 pts | **57.3%** | 22.8 |
| 20 matches | 66.7% | 90 pts | **38.7%** | 28.4 |
| 20 matches | 66.7% | ≥150 pts | **20.0%** | 34.0 |
| 4 matches | 28.6% | 30 pts | **26.9%** | 31.9 |
| 1 match | 9.1% | 300 pts | **9.1%** (unchanged) | 37.3 |

**A tier change alone still changes nothing.** `PROMOTION` / `DEMOTION` do not
touch rating or reliability. The recommendation applies only when the board also
re-anchors the rating; if they change tier and keep the current rating, there is
no reliability recommendation to make.

---

## Recommendation as originally put to Shaun

*As put on 20 Sep, before the anchor correction — it read "reproduces all three
decisions exactly", which was true of the record as it then stood.*

**Adopt the move-scaled rule with D = 150 points (half a tier).** It reproduced
all three decisions as they then stood, so it changed nothing the board had
already done;
it keeps a settled player's record when the board merely corrects their number;
and it reopens fully once a move is large enough that the old rating genuinely
no longer supports the new one.

`D = 150` is explainable in one sentence — *a move of half a tier or more is a
different player, not a corrected number* — and it was chosen on that reasoning.
It sat inside the bound the record established at the time; that bound has since
dissolved, for the reason given above, and the choice rests on the argument
rather than on a fit.

Two things this recommendation is **not**: it is not a validated prediction —
Brier score did not improve at any alpha in the earlier reassessment work, and
this rests on three decisions — and it is not a decision. The board's authority
to override, with attribution and reason, stays exactly as it is.

## What is left

1. **Done:** the rule, as decided above.
2. **Still to build:** the Use-recommendation / Override UX, with attribution
   and reason, storing **both** the system recommendation and the board's final
   choice on the event. Until that lands, the next validation still has only
   three points to work from.
