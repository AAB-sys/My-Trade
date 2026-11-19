# ULTROAN's own research questions
(16 Nov, the owner: "its your research engine job to do so ? why do i need to give you instructions all the time ?". ULTROAN asks
and answers these by itself every evening; open questions are re-answered as days are added.)

## Q1 (16 Nov): under each shape, and from each place (above VAH, POC-VAH, VAL-POC, below VAL), which level does price reach first in 30 minutes?
- 16 Nov, 1 day, NIFTY 50, 63 candles: outside the value area -> back to the edge 16 of 18; POC-VAH -> POC 10, VAH 5, none 3;
  VAL-POC -> VAL 20, POC 8, POC+VAH 3, none 1. B (11:20-12:20): swung POC <-> VAH, then up. D (13:10-14:45): slid to VAL 19 of 22.
  Double: stuck near POC. NIFTY BANK and SENSEX: mostly back to POC. One day: a picture, not a rule. Open (growing test from 20 Nov).
## Q2 (open): after a wick through VAH or VAL and a close back inside, how far does price move away, and how often does it reach the POC?
## Q3 (open): does the shape at 11:00 tell the afternoon's direction (P up, B down, D both ways)? Answerable on the 2-year candles (time profile).
## Q4 (open): do yesterday's VAH and VAL turn the price when touched, or does price go through? (yesterday's levels were not touched on 16 Nov)

## Answered 16 Nov night on 2 YEARS of NIFTY 50 (497 days, 26,000+ candles 10:15-14:45; profile counted by time, the file has no volume; vpday/twoyears.js)
1. Inside the value area the POC pulls: from either half, price touches the POC first ~45% of the time vs the near edge ~37%.
2. Outside the value area it depends on the shape: P (busy top): above VAH comes back 58%, below VAL comes back only 36% (keeps going down);
   B (busy bottom): below VAL comes back 65%, above VAH only 44%. A break AWAY from the busy side tends to continue; a break on the busy side returns.
3. Noon tells the close: at 12:00 above VAH -> closes above VAH 67%; below VAL -> closes below VAL 69% (all days: 36% / 38%).
4. Shape at 12:00 and the afternoon: P -> up 60%; B -> down 57%; Double -> down 59%; D -> 50/50.
Not profits, tendencies. To be checked with real volume on the saved days (growing test) and turned into ideas for the lab.

## THE VOLUME QUESTIONS (16 Nov night; the owner called the noon finding obvious, rightly). These come FIRST, one a night, on the
## real-volume days (history/volume/<INDEX>_1min.csv + saved sessions), re-run as days are added. Not obvious, volume only.
## V1 (open): edge touches that hold vs break: the volume at the edge row (heavy vs thin) when VAH/VAL is touched -> turn or go through?
## V2 (open): POC migration: when the developing POC moves up/down, does price follow within the next hour, and how far?
## V3 (open): thin zones (low-volume rows inside the profile): does price cross them fast to the next busy zone?
## V4 (open): shape changing during the day (D->P, D->B, P->Double ...): does the change come before the price move?
## V5 (open): today's value area vs yesterday's (above, below, overlapping) by 10:30-11:00: trend day or sideways day?

## V1 answered 17 Nov 01:30 (18 real-volume days, 21 Oct to 16 Nov, 3 indices, 433 edge touches; vpday/v1.js, v1trade.js)
- The CLOSE of the touch candle decides, not the volume at the edge: closed back inside -> turned 61% (broke 35%); closed beyond ->
  broke 73%. Closed beyond with a THIN row just outside -> broke 81%. Closed back inside with a HEAVY row just outside -> turned 69%.
- The edge row's own volume (thin/medium/heavy) made almost no difference (turn 32-40%).
- As a trade (fade the wick back to the POC, stop past the wick): loses on all three indices (NIFTY 48 calls -414). With a heavy row
  outside: NIFTY -53 (12 calls), BANK +404 (11), SENSEX -318 (7): too few, mixed. Not a strategy. The useful part: a close beyond
  the edge with thin volume outside is a real break (81%). Next: test going WITH that break (V1b).

## V1b answered 17 Nov morning (same 18 real-volume days): trade WITH a close beyond the edge, held to 15:15
- No edge. NIFTY 50: any break 29 calls +54 to -138; thin row outside 20 calls -269 to -398 (worse, not better). BANK and SENSEX
  show profit only on the CE side (the month rose); PE loses everywhere. Thin vs heavy outside does not separate winners.
- So the 81% "keeps going" is true for the next 30 minutes but does not carry to a day trade after costs. Lesson: the edge event is
  short-lived; a strategy from it must be a 30-minute trade with a target, or needs a second condition (V2 POC migration, V5 value
  area vs yesterday's) to pick the days. Next: V2 and V5, then V1c (30-minute target version).

## 17 Nov evening: today's questions (NIFTY turned at 25,500 at 12:13 with nothing above in the profile)
## R1: do round numbers stop the price? (the owner at noon: "how to find the resistance from here ?"; I answered "round numbers")
## R2: once out of the value area, does the price stay out long enough to trade? (the growing study's strongest finding)
## V5 stays open (today 3 of 3: opened inside yesterday's value, left upward in 20 minutes, never came back).

## R1 answered 17 Nov (498 days of NIFTY 50 5-minute candles, price only): NO, round numbers are not special.
- The day's high fell within 10 points of a multiple of 100 on 97 of 498 days = 19%; by chance 20%. The day's low: 21%. Within 5
  points: highs 9%, lows 13% (chance 10%). Multiples of 500 within 25 points: highs 9%, lows 10% (chance 10%).
- When a new day's high reaches a hundred for the first time (228 cases): went on 105, turned 97. A new low (233): went on 114,
  turned 97. Only the 500s (97 cases): turned 42, went on 41. A coin.
- So today's turn at 25,500 was one day, not a pattern, and my noon answer to the owner ("round numbers work as resistance") is not
  backed by their own data. Told the owner. What is left for open space: the option chain's OI walls (PR #260), not testable yet:
  no OI history is saved. Idea: save the chain's biggest Call and Put OI strikes once a day so this can be tested later.

## R2 answered 17 Nov (lab idea 10, two years): NO as a day trade. See ideas.md. The 63% is a 30-minute fact only.

## 18 Nov evening: today's questions (NIFTY opened below yesterday's VAL, never came back to it, slid 180 points, closed on its POC)
## G1: when the day opens outside yesterday's value area, does it stay out? Is there a time after which it is decided?
## G2 (open): a wick through today's VAH/VAL that closes back inside came back 63% (270 cases): as a 30-minute trade with a small target (V1c)?
## G3 (open): price outside the value area at noon: the afternoon came back 69% on the volume days (29 cases), 47% on two years. Watch as days are added.
## O1 (open, needs days): do the saved OI walls (from 18 Nov) stop the price? Day 1: NIFTY walls 750+ points away, no test possible.

## G1 answered 18 Nov (498 days of NIFTY 50 5-minute candles, yesterday's value area counted by time; strat/gapq.js)
- The day opened outside yesterday's value area on 330 of 498 days (above 174, below 156).
- It closed outside on the same side 70% (above) and 76% (below). An open inside closes anywhere (30% inside).
- The first hour decides: back at the edge in the first hour 47-49% of the time; never all day 39-40%; after 10:15 only 12-14%.
- Edge untouched until 10:15 (171 days): closed outside on the same side 86% (above) and 92% (below); touched the edge later only 22-26%.
- BUT from 10:15 to the close the price went further only 53-60%: staying out is not the same as moving on. Today: stayed below, 10:15 -> close fell 60 points.
- Back at the edge in the first hour (159 days): reached yesterday's POC that day 69-72%.
- As trades (lab idea 11, ideas.md): neither part pays after 8 points a call.
- Use for the page: a fact for the eyes, not a call: "opened below yesterday's value and not back by 10:15 -> yesterday's VAL is the day's ceiling about 4 days in 5".

## T1 answered 19 Nov (498 days of NIFTY 50 5-minute candles, yesterday's value area by time; strat/insq.js). Asked because today opened inside yesterday's value, closed above its VAH at 09:45 and never looked back.
- The day opened inside yesterday's value area on 166 days. On 132 of them a 5-minute candle closed outside it before 10:15 (68 above, 64 below).
- After that first close outside, the day closed outside on the same side only 59% (above) and 64% (below); 72-73% of those days had a later close back inside at some time.
- From the break to the day's close the price went further 57-58% of the time, about 20 points on average: not enough after 8 points a call.
- So today (no return at all, +250 points) was the rarer kind. An open inside that breaks out is much weaker than an open outside that stays out (G1: 86-92%).
- Use for the page: a fact for the eyes: "opened inside yesterday's value and broke out early: expect a visit back inside about 7 days in 10".

## P1 (open, from 19 Nov's growing study): in a P shape, a price between the VAL and the POC goes back up to the POC 53% and down to the VAL 19% (273 candles on 22 volume days; two years 47% / 34%). Re-answer as days are added; test as a filter, not an entry.
## S1 (open, 19 Nov): the Volume Profile page's sideways guard ("5 crossings of the busiest price") refused CE closes for 2 hours on a trend-up day. How often does that guard block a day that then trends? Needs the volume days; count from 20 Nov.
