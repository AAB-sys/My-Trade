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

## Round 2: 7 October 2026, six days (29 Sep to 7 Oct): the retest question

The owner's two screenshots of 7 October: NIFTY 50 fell from the 100% level to the 61.8%/50% zone, hovered there
(a retest?), fell on to the 0% level and bounced. Two questions: how to tell a retest that holds from a bounce,
and whether a fall through a level will carry on to the next. Candles and today's-range levels only, 5-minute candles.

**Every time a candle closed through a level** (310 crosses, both indices), what came first: the next level
("continued") or a candle closing back across the level crossed ("came back")?

| After a candle closes through a level | Continued | Came back |
|---|---|---|
| All crosses | 53% | 43% |
| Close under a quarter of the way to the next level | 32% | 62% |
| Close a quarter to half of the way | 53% | 44% |
| Close past halfway | 80% | 18% |
| Crossing candle's body under half the gap | 30% | 67% |
| Body a whole gap or more | 74% | 23% |
| A retest that held before the outcome | 48% | 48% |
| No retest | 55% | 41% |
| Cross in the 09:00 hour | 73% | 27% |
| Cross at 13:00 or 14:00 | 45% | 54% |

The retest by itself tells nothing; the depth of the close through the level, and the body, do.

**The owner's rule's own calls** (previous-day levels, both signals, both indices, 5 and 15 minutes: 238 calls):

| | Calls | Won | Reached the target | Net points | Per call |
|---|---|---|---|---|---|
| Signal closed under a quarter of the way | 134 | 67% | 62% | +1,149 | +8.6 |
| Signal closed a quarter to half | 61 | 80% | 79% | +700 | +11.5 |
| Signal closed past halfway | 43 | 93% | 93% | +931 | +21.6 |
| Signal body under half the gap | 116 | 69% | 64% | +340 | +2.9 |
| Signal body a whole gap or more | 40 | 85% | 85% | +962 | +24.0 |
| Never closed back a quarter of the gap | 142 | 92% | 87% | +7,628 | +53.7 |
| Closed back a quarter to half | 10 | 80% | 80% | +680 | +68.0 |
| Closed back half to a whole gap | 26 | 73% | 73% | +671 | +25.8 |
| Closed back a whole gap or more | 60 | 35% | 33% | −6,199 | −103.3 |

**Ideas replayed** (net points; the rule's own are +316 / +148 / +2,164 / +153 on NIFTY 50 5m, NIFTY 50 15m, NIFTY BANK 5m, NIFTY BANK 15m):

| Idea | NIFTY 50, 5 min | NIFTY 50, 15 min | NIFTY BANK, 5 min | NIFTY BANK, 15 min |
|---|---|---|---|---|
| Crossed only when the close is past halfway | +228 (40 calls, 31W 9L) | +304 (24, 22W 2L) | +1,898 (48, 42W 6L) | +1,282 (24, 21W 3L) |
| Crossed only when the close is a quarter of the way | +259 (49, 38W 11L) | +214 (27) | +2,731 (61, 55W 6L) | +1,104 (35) |
| A shallow cross waits for a close past halfway | +245 | +304 | +1,630 | +1,062 |
| Crossed only with a body of half the gap | +55 | +125 | +2,867 | +1,168 |
| Exit when a candle closes back by a quarter of the gap | +92 | +165 | +559 | −1,316 |
| Exit when a candle closes back by half the gap | +80 | +123 | +3 | −1,450 |
| Exit when a candle closes back by a whole gap | +201 | +279 | −202 | −1,020 |
| Depth past halfway + exit on a quarter reclaim | +145 | +261 | +350 | −301 |

What the days said:

- The depth of a signal candle's close is a quality mark: past halfway, nine calls in ten won; under a
  quarter, two in three. The body says the same. A gate on crossed signals at a quarter of the way is ahead
  of the rule in net on three boards of four and in points per call on all four, with far fewer calls: a
  candidate for the Study page (P3) if the owner confirms.
- No exit on a reclaim beat holding, at a quarter, half or a whole gap, except on NIFTY 50 15-minute.
  Calls that went back a whole gap won one in three, and their loss was mostly already there by then; on
  NIFTY BANK such calls came back often enough that cutting them cost more. The no-stop decision stands.
- Built (7 October, owner's ask): the candle read on the index page, under "What now": the signal's
  strength (depth, body) and how far a candle has gone back across the level (carry / watch / weak), and
  "retest held". Information only; it ends no call. The ideas above stay in the replay for the nightly rounds.
