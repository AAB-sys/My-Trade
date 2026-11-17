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
