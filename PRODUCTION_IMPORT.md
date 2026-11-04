# Production match-facts import — 18 Sep 2026

Applied by `scripts/moneypadel/import-production-matches.js` against the live beta, after
the dry run below was reviewed and approved by Shaun.

**Match facts only.** Production ratings, rankings, tiers and reliability were
never read. Production's winner/draw flag was treated as authoritative and was
never inferred from, or corrected by, the orientation of the set scores. Score
arrays were carried across exactly as stored. The 50 pre-June records were
excluded: that block is display-only and cannot enter a rating calculation.

Regenerate this file by re-running the importer; it is a record of a run, not a
document to edit.

## Result

| | |
|---|---|
| Records in the export | 207 |
| Excluded as pre-June (display-only) | 50 |
| Eligible for the rating record | 157 |
| Already present (deduplicated) | 150 |
| **Genuinely new, imported** | **7** |
| Conflicts | 0 |
| In v3 but absent from the export | 0 |
| Documents written / deleted | 49 / 0 |
| Live record after | 157 matches · 666 journey events · 34 players |
| Post-write replay-to-self | 0 differences |
| Diagnostics | 9 / 9 pass, 0 warnings |
| Tests | 255 / 255 |

A second run finds 157 already present and 0 new: the import is idempotent, so
a later export that merely extends this one will import only its additions.

## Note on the accompanying validation summary

`validation-summary.json` states "all 42 currently-submitted matches have status
'approved'". The export carries **41** records with `_origin: "submission"`, all
of them `approved`. Nothing in the import depends on the count — dedupe is by
match facts, not by origin or id — but the summary and the file it describes
disagree by one, which is worth resolving at the production end before the next
export.

---

## The run

```
Production match-facts import — WRITE
  project   : mp-dashboard-beta-v3
  export    : /home/user/MP-Dashboard-NewRatings/tests/fixtures/production-matches-export.json
  records   : 207

1. EXPORT INTEGRITY
   malformed records    : 0
   duplicate production ids : 0
   outcomes as production recorded them : A_WINS 201, DRAW 6
   decided matches whose first side has the losing scoreline : 14
     (production's winner flag is authoritative; these are preserved, not corrected)

2. PRE-JUNE (display-only, excluded by standing decision)
   records before 2026-06-01 : 50
   dates 2026-04-01 .. 2026-05-01
   These are NOT imported. They are already carried by the app as
   HISTORICAL_DISPLAY_MATCHES and must never reach a rating calculation.
   records eligible for the rating record : 157

3. AGAINST THE LIVE v3 RECORD
   v3 matches : 150   journey events : 638   players : 34
   already present (deduplicated) : 150
   genuinely new                  : 7
   conflicting                    : 0
   in v3 but not in this export   : 0

4. CONFLICTS
   none — every fixture the two systems share agrees on its facts.

5. NEW MATCHES
   7, from 2026-09-16 to 2026-09-17

     1. 2026-09-16  Osh & PDM def KC & Jams  6-1, 6-2  [sub_1789569754162_3v3bfa]
     2. 2026-09-16  KC & PDM def Osh & Jams  7-5, 6-3  [sub_1789569795331_lwb6ba]
     3. 2026-09-16  Stormzy & Omar def Max & Jords  6-2, 6-3  [sub_1789570367222_jr1rgk]
     4. 2026-09-16  Tom & Rishi def Jords & Eli  6-4, 2-6, 6-3  [sub_1789570401969_z564hc]
     5. 2026-09-17  Eli & Len vs Kaz & Rishi  4-6, 6-3  [sub_1789644375510_he0om5]
     6. 2026-09-17  Osh & Rishi def Ant Slice & Eli  6-2, 6-3, 6-0  [sub_1789668445393_qe77mb]
     7. 2026-09-17  Eli & Len def Osh & Rishi  6-3, 6-1, 6-8  [sub_1789668519796_jp6kl2]

   draws among them : 1

6. PLAYER NAME MAPPINGS
   distinct names in the new matches : 14
   unknown to the v3 players collection : 0
   every name maps to an existing v3 player.

7. REPLAY PLAN
   Replayed chronologically through the existing replay-forward path.
   New v3 match ids continue each date's own sequence:
     2026-09-16-1  <- sub_1789569754162_3v3bfa
     2026-09-16-2  <- sub_1789569795331_lwb6ba
     2026-09-16-3  <- sub_1789570367222_jr1rgk
     2026-09-16-4  <- sub_1789570401969_z564hc
     2026-09-17-1  <- sub_1789644375510_he0om5
     2026-09-17-2  <- sub_1789668445393_qe77mb
     2026-09-17-3  <- sub_1789668519796_jp6kl2

   documents to write  : 49
   documents to delete : 0
     matches        7
     ratingJourney  28
     players        14

8. PROJECTED RATING CHANGES — 14 player(s) move
   Ant Slice      1636.5 ->   1625.1  -11.3
   Eli            1652.5 ->   1641.5  -11.1
   Rishi          1454.1 ->   1462.9  +8.8
   Osh            1705.5 ->   1713.8  +8.3
   Jords          1336.1 ->   1328.2  -7.9
   Omar           1403.4 ->   1409.5  +6.1
   Tom            1345.9 ->   1351.0  +5.1
   Stormzy        1384.3 ->   1389.3  +5
   Max            1410.6 ->   1407.1  -3.5
   KC             1711.5 ->   1708.7  -2.8
   Jams           1116.0 ->   1113.3  -2.7
   PDM            1446.1 ->   1447.6  +1.6
   Kaz            1731.2 ->   1732.7  +1.4
   Len            1675.8 ->   1675.9  +0.1

Writing ...
Done. 49 documents written, 0 deleted.
Post-write verification: the record replays to itself exactly (0 differences)
Record now: 157 matches, 666 journey events, 34 players.
```
