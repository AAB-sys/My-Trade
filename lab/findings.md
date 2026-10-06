# Findings: what was tested, the numbers, and what the owner decided

Every round replays ideas over the saved days with `lab/replay.js` and records them here. Points
are index points. Five days is a first look; twenty is evidence; sixty is where a rule earns trust.

## Round 1: 6 October 2026, five days (29 Sep, 30 Sep, 1 Oct, 5 Oct, 6 Oct)

Base line: the owner's rule, previous-day levels, both signals (held and crossed).

| Idea | NIFTY 50, 5 min | NIFTY 50, 15 min | NIFTY BANK, 5 min | NIFTY BANK, 15 min |
|---|---|---|---|---|
| The owner's rule as it is | +405 (43 calls, 14 ended at the day's end) | +234 (19, 5) | +1,266 (63, 19) | −204 (39, 14) |
| **P1** close open calls at 15:00, no new call after it | **+446** (37) | **+258** (17) | **+1,872** (59) | **+490** (34) |
| **P2** no new calls after 14:00 | **+468** (30) | +213 (14) | +1,286 (55) | −119 (33) |
| P1 + P2 | +497 (30) | +265 (14) | +1,764 (55) | +350 (33) |
| Exit when a candle closes back across the level | −14 | +174 | −309 | −666 |
| Stop at half the distance to the target | +131 (worst call −39) | +129 (−26) | +503 (−107) | −590 (−106) |
| Stop at the full distance to the target | +66 | +52 | +523 | −480 |
| No new calls after 13:00 | +396 | +147 | +925 | −301 |
| Signal only if the higher frame's last closed candle agrees | +327 | +104 | +1,551 | +645 |
| Without the 23.6% level | +387 | +213 | +2,377 | +991 |
| Without the 23.6% and 38.2% levels | +433 | +241 | +2,371 | +1,241 |
| Only the move's ends (0%, 100%) | −209 (6 calls) | −120 (4) | +727 (4) | +451 (3) |
| Retest: a cross, then a hold there within 6 candles | −8 | +64 | +681 | +447 |
| Levels from the first 30 minutes' range | +180 | +204 | −428 | +752 |
| Levels from the first 15 minutes' range | +53 | +103 | +35 | +138 |
| Only with the day's direction so far | +97 | +157 | −605 | −892 |
| Today-so-far levels (the owner's default on the index page) | −62 (142 calls) | +30 (61) | +350 (121) | +1,474 (62) |

What the days said:

- The rule's losses come almost entirely from calls that run to the day's end: wins are capped at
  one level, losses are not. On these days nearly every day-end call lost.
- A tight exit (a candle closing back across the level) cut about half the winners before they
  reached the target: on NIFTY 50 15 of 33, on NIFTY BANK 21 of 45. The owner's no-stop decision
  stands against this kind of stop.
- A stop at half the distance to the target caps the worst call (about −39 on NIFTY 50, −107 on
  NIFTY BANK, against −178 and −523) but costs about two thirds of the net. A risk choice for the
  owner, not taken from five days.
- 11 am to 12 pm was the best hour in both indices; after 2 pm the worst, and most day-end losers
  were signals after 2 pm.
- Leaving out the 23.6% level helped NIFTY BANK a lot and NIFTY 50 not at all. One index, five
  days: to watch.
- A candle closing above the previous candle's high was followed by a higher close about half the
  time, on 1, 5 and 15 minutes, both indices. Not a signal by itself.
- Six closes beyond the previous day's high or low in five days: three ran to the close, three
  came back inside within 20 to 45 minutes.

Decided by the owner (6 October): P1 and P2 go on the Study page as switches, scored against the
rule on every saved day; either moves to the live index page only after about 20 saved days still
show it ahead, and only when the owner says so; the lab lives in the repository; nothing is built
without the owner's confirmation. The live index page is unchanged.
