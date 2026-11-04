# Money Padel Prestige v3 — comparison report

Generated 2026-09-18 by `scripts/moneypadel/comparison-report.js`. Regenerate rather than edit.

**Basis: the live beta record**, including every club decision the board has recorded.

## Read this first

**These two systems are not supposed to agree, and a difference is not a defect in either.**
They rate different match sets with different engines. The purpose of this report is to make
the differences legible and say which are explained — not to drive them toward zero.

| | v3 beta | Legacy production |
|---|---|---|
| Engine | `sequential-v1` — sequential, one pass, applied per match | Iterative joint-equilibrium solver, K=28, 300 epochs over the whole set |
| Matches rated | 150 | 149 |
| Draws rated | 5 | 0 — the legacy solver cannot rate a match with no winner |
| Rating moves | Once, when the match is played, weighted by how established the player is | Re-solved from scratch across every match on every computation |
| Monthly figures | A window on one continuous rating | A separate rating solved from that month alone |
| Snapshot taken | live | 2026-09-16T16:32:02Z |
| Players | 34 | 34 |

The production figures are a **frozen snapshot from 2026-09-16** and go stale: production keeps
receiving matches. They are reference data and are never an input to anything in v3.

## What is already known not to reconcile

- **Match counts differ for 17 of 34 players.** v3 rates 150 matches, the snapshot 149.
  Not explained by draws alone. Recorded in `PROJECT_LEDGER.md` as an approximate reference, not a reconcilable truth.
- **The snapshot has no join key.** Every `player_id` is `null`, so players are matched by name. All
  34 map today; a rename would break it silently.

## Summary

- Players compared: **34**
- Mean absolute difference: **18.0 points**
- Largest difference: **97.8 points**
- Tier disagreements: **0**

**3 players are seeded differently by the two systems.**
Shaun (started Tier C, now Tier B, -24.7); Tom (started Tier C, now Tier B, -6.0); Fatch (started Tier C, now Tier B, +97.8).
v3 seeds a player at the tier that was true when they first played; production seeds from the
tier they hold today. For these players the two systems begin 300 points apart, and evidence has
damped rather than erased that gap. They are no longer the largest differences: a club decision has since been recorded for each of them, which supersedes the seeding gap as the explanation.

Excluding them, the mean absolute difference is **15.6 points** across 31 players.

A tier disagreement is expected where v3 recorded a promotion after the snapshot was taken.

## Per player

Sorted by v3 Power Rating. "Evidence" is the reliability v3 holds for that player: a low
figure means v3 has deliberately moved them less, so a large difference there is the two
systems disagreeing about confidence, not about ability.

| Player | Tier | Started | v3 | Snapshot | Diff | v3 matches | Snapshot matches | Reliability |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Manny | S | S | 2010.3 | 2012.7 | -2.4 | 3 | 2 (+1) | 23% |
| Erf | A | A | 1734.7 | 1722.0 | +12.7 | 26 | 26 | 72% |
| Kaz | A | A | 1731.2 | 1768.1 | -36.9 | 23 | 22 (+1) | 70% |
| KC | A | A | 1711.5 | 1702.2 | +9.3 | 26 | 28 (-2) | 72% |
| Del | A | A | 1708.4 | 1709.0 | -0.6 | 1 | 1 | 9% |
| Osh | A | A | 1705.5 | 1704.3 | +1.2 | 30 | 30 | 75% |
| Len | A | A | 1675.8 | 1658.1 | +17.7 | 32 | 31 (+1) | 76% |
| Dennis | A | A | 1671.5 | 1641.9 | +29.6 | 9 | 9 | 47% |
| Eli | A | A | 1652.5 | 1590.7 | +61.8 | 31 | 32 (-1) | 76% |
| Ant Slice | A | A | 1636.5 | 1615.1 | +21.4 | 7 | 6 (+1) | 41% |
| Rishi | B | B | 1454.1 | 1483.9 | -29.8 | 72 | 71 (+1) | 88% |
| PDM | B | B | 1446.1 | 1485.9 | -39.8 | 34 | 35 (-1) | 77% |
| Antz | B | B | 1422.0 | 1417.6 | +4.4 | 18 | 18 | 64% |
| Harry | B | B | 1414.9 | 1434.4 | -19.5 | 29 | 29 | 74% |
| Max | B | B | 1410.6 | 1425.7 | -15.1 | 50 | 50 | 83% |
| Mulley | B | B | 1405.5 | 1405.1 | +0.4 | 1 | 1 | 9% |
| Omar | B | B | 1403.4 | 1423.6 | -20.2 | 9 | 10 (-1) | 47% |
| Rocky | B | B | 1395.6 | 1353.8 | +41.8 | 16 | 16 | 62% |
| MK | B | B | 1392.7 | 1430.9 | -38.2 | 14 | 14 | 58% |
| Carla | B | B | 1391.0 | 1389.8 | +1.2 | 1 | 1 | 9% |
| Stormzy | B | B | 1384.3 | 1389.0 | -4.7 | 17 | 18 (-1) | 63% |
| Shaun | B | **C** | 1374.3 | 1399.0 | -24.7 | 21 | 21 | 63% |
| Chloe | B | B | 1371.1 | 1366.9 | +4.2 | 7 | 7 | 41% |
| Tarique | B | B | 1361.7 | 1352.1 | +9.6 | 6 | 6 | 38% |
| Tom | B | **C** | 1345.9 | 1351.9 | -6.0 | 21 | 20 (+1) | 64% |
| Fatch | B | **C** | 1342.1 | 1244.3 | +97.8 | 25 | 25 | 55% |
| Jords | B | B | 1336.1 | 1311.3 | +24.8 | 36 | 35 (+1) | 78% |
| Jams | C | C | 1116.0 | 1101.2 | +14.8 | 6 | 7 (-1) | 38% |
| Aubyn | C | C | 1111.3 | 1115.8 | -4.5 | 5 | 4 (+1) | 33% |
| Skapz | C | C | 1107.1 | 1108.3 | -1.2 | 2 | 1 (+1) | 17% |
| Tee | C | C | 1103.0 | 1114.1 | -11.1 | 8 | 8 | 44% |
| Rhys | C | C | 1094.3 | 1097.6 | -3.3 | 4 | 3 (+1) | 29% |
| M.R | C | C | 1089.5 | 1088.7 | +0.8 | 1 | 1 | 9% |
| Fee | C | C | 1085.6 | 1084.9 | +0.7 | 5 | 4 (+1) | 33% |

## How to read a large difference

In order of how often it is the answer:

1. **They started at a different tier.** v3 seeds from the tier that was true when the player
   first played; production seeds from the tier they hold now. A C-to-B correction is a 300 point
   head start in production terms. This explains the largest differences in the table.
2. **The two rated different matches for that player.** Check the match-count columns first.
3. **v3 weights early results more.** A newer player moves by up to 40 points a match while
   production moves everyone by the same K. Low reliability plus a large difference is this.
4. **v3 rates draws.** Production cannot, so anyone in a drawn match differs for that reason alone.
5. **The snapshot is older than the v3 record.** Matches played since are in v3 only.
6. **A club decision moved the v3 rating.** Recorded in the Rating Journey as its own event.

None of these is a defect. If a difference survives all six, that is worth investigating —
and worth recording in `PROJECT_LEDGER.md` rather than resolving quietly.
