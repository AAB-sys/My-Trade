# New Rule Chart: the rules under Calls with Signals

The owner's second set of rules, built from the owner's documents from 21 October on, apart from the Paper calls rule: this file
describes them; `LOGIC.md` stays the Paper calls rule's own document. The engine is `static/newrule.js` (nothing in `static/rules.js`
or `rule.py` is touched); the page runs it under Calls with Signals; `lab/newrule-check.js` holds every test case the documents give.
PRs for it are named "New Rule Chart_". Paper only, in index points: no option yet. All on closed 5-minute index candles; the daily
chart of the documents is not built.

## Shared: ATR, the buffer, the swings

ATR(14) with Wilder smoothing, seeded by the simple average of the first 14 true ranges, carried over from the previous day's
candles; a candle is judged with the ATR as of the candle before it. The buffer is 0.25 x ATR (the documents' setting; NONE or a
fixed number of points are options). A swing high is a candle whose high is at or above the highs of the 3 candles before and the
3 after, known once the third candle after it has closed; a swing low the same with lows. The swing size of the double and triple
tops and bottoms is 2 since 26 October (the owner: "prepare the PR with swing size 2"): their tops and bottoms need only the 2
candles before and the 2 after, and are known once the second candle after has closed. The wedges, the rectangle and the triangles
keep 3, and the double bottom has its own settings since 27 October (below). The documents' own test cases still run on 3 (`DOC` in
`lab/newrule-check.js`); the documents' E1 gives the same call on 2.
Why: on 26 October morning NIFTY 50 made a quick bottom (9:25, 9:40), a rally and a top (10:05 to 10:20) that the rules did not
call; tested on the 17 saved days (29 September to 23 October, index points before costs, the page's own exits), the swing size of 2
alone gave NIFTY 50 29 calls, 14 won, +282.05 (with 3: 30 calls, 13 won, +238.25) and NIFTY BANK 32 calls, 15 won, +843.85 (29, 13,
+595.80), and it beat 3 in 13 of the 16 neighbouring settings tried (3 or 5 candles between the tops, equal within 0.5 or 0.75 ATR,
a dip of 1.0 or 1.5 ATR, with or without the previous day's last candles). The changes tried first (3 candles between the tops, a
dip of 1.0 ATR, the previous day's last candles) lost points on these days and are not made. 26 October's own shapes stay too small
for the rules even with 2. Seventeen days only: a setting found by searching, to be watched.

## Double Top (the "Trading Rules Specification" document, built 21 October night)

Two swing highs 5 to 40 candles apart, within half an ATR of each other, nothing above them between; the neckline the lowest low
between them, at least 1.5 ATR below the lower top; a rise of 2 ATR into the first top; no close above the tops since. The signal:
the first close below the neckline by the buffer, counted from the candle that confirms the second top, within 20 candles of it and
not more than 2 ATR past the neckline. Buy PE at the next candle's open. (The document's double bottom mirror is in the engine but
off: the Double Bottom document below is the rule the page runs.)

## Double Bottom (the "Double Bottom Chart Pattern" document: built 21 October night; version 3 of 27 October on NIFTY 50 since 27 October)

Two swing lows within 0.60 ATR, nothing below them between; the neckline the highest high between them, at least 1.5 ATR above the
higher bottom; the support the lower bottom; a fall of 2 ATR into the first bottom; the nearest first bottom first. One trade per
pattern, whichever triggers first, counted from the candle that confirms the second bottom and within 20 candles of it: a candle's
HIGH above the neckline by 0.10 x ATR, Buy CE (the breakout; the close does not matter); a candle's LOW below the support by 0.10 x
ATR, Buy PE (the failure). A candle that triggers both sides gives no signal; a close more than 2 ATR past the line is skipped (the
chase check stays on the close). Rule 1's Exit A is checked from the entry candle on, never on the signal candle (which may have
closed back across the line), as the engine always did. The port is line by line from the document's reference code
(`double_bottom_reference.py`): the lab runs its CE-1 to CE-24, PE-1 to PE-18, V3-1 to V3-11 and RD-1 to RD-15 (the document's
real candles in `lab/double-bottom-v3.json`), and the engine matched the reference signal for signal on every saved day of NIFTY 50
and NIFTY BANK (version 1, 2 and 3 and four neighbouring settings: 378 signals) and on 3,000 random days (3,951 signals).

On NIFTY 50 only, two versions run side by side (the owner, 27 October: "V2 table, V3 shadow", then "for nifty 50 only"; the
document's implementation brief, shadow mode first). NIFTY BANK and SENSEX keep the page's rule as it was before 27 October (the
first version, within 0.5 ATR, the triggers on the close by the buffer, the swing size 2 of 26 October: `DB_OLD`), with no log:

| Setting | Version 2 (the table's calls) | Version 3 (shadow: logged, no call) |
| --- | --- | --- |
| A bottom: candles on each side | 3 | 2 |
| Candles between the bottoms | 5 to 40 | 3 to 40 |

Everything else is the same in both. On NIFTY 50 the first version (21 October: within 0.5 ATR, the triggers on the close by the
buffer, the swing size 2 of 26 October) is replaced in the table by version 2. Under its Calls with Signals table, the Double Bottom shadow log
lists every signal of both versions, a trade open or not: the tag (V2 only, V3 only, or Both: the same side and level, with the
other version's time), the level and the ATR, the two bottoms and the candles between them, the bottoms' difference against its
limit and the depth against its minimum, how far the high (low) went past the line in points and ATR and where the candle closed,
for a version 3 only signal what version 2 lacked (the gap, the swing, both, or other), the order (version 2: taken, or why not;
version 3: none, inside or outside the 9:30 to 14:45 window), and every signal followed on paper with the table's own exits (the
entry at the next open, the exit, the best and worst point, the points). The day's summary line: the signals of each version, the
version 3 only ones and their paper points. The log is computed from the candles, so replaying a saved day gives it again.

Switching to version 3 is one line in `static/newrule.js` (`DB = { table: DB_V3, ... }`); going back, `table: DB_V2`; another index
in, its name in `DB.indices`. The brief:
review after at least 20 trading days of the log, NIFTY 50 and NIFTY BANK apart; about 10 version 3 only signals at least; their
paper points after costs positive and not resting on one trade; the 26 October 09:50 trade, the reason for the change, not
counted as the proof.

On the 18 saved days (29 September to 26 October, index points before costs, the page's own exits, one trade at a time), the
table's double bottom calls: NIFTY 50, the first version 9 calls, 5 won, +197.90; version 2 12 calls, 8 won, +238.40; version 3
(as if it were the table) 23 calls, 11 won, +370.15. NIFTY BANK, the first version 10 calls, 5 won, +206.85; version 2 14 calls, 6
won, -20.45; version 3 17, 6, -53.35 (all the table's calls on NIFTY BANK: +761.20 with the first version, +389.75 with version 2).
The settings were found on NIFTY 50 days; NIFTY BANK is worse with them on these days, so it keeps the old rule.

## Triple Top (the "Triple Top Chart Pattern" document, built 21 October night)

Three swing highs, each 5 to 40 candles after the one before, all within half an ATR, nothing above them between; the resistance
the highest top, the neckline the lower of the two dip lows, both dips at least 1.5 ATR below the lowest top; a rise of 2 ATR into
the first top. One trade per pattern: a close below the neckline by the buffer, Buy PE (the breakdown); before any breakdown, a
close above the resistance by the buffer, Buy CE (the failure). Counted from the candle that confirms the third top, within 20
candles, not more than 2 ATR past the line.

## Triple Bottom (the "Triple Bottom Chart Pattern" document, built 21 October night)

Three swing lows, each 5 to 40 candles after the one before, all within half an ATR, nothing below them between; the support the
lowest bottom, the neckline the higher of the two bounce highs, both bounces at least 1.5 ATR above the highest bottom; a fall of
2 ATR into the first bottom. One trade per pattern: a close above the neckline by the buffer, Buy CE (the breakout); before any
breakout, a close below the support by the buffer, Buy PE (the failure). Counted from the candle that confirms the third bottom,
within 20 candles, not more than 2 ATR past the line.

## Falling Wedge and Rising Wedge (the "Falling Wedge Chart Pattern" and "Rising Wedge Chart Pattern" documents, built 21 October night)

Price between two trendlines that get closer: the upper line through the two latest confirmed swing highs (High 1, High 2), the
lower through the two latest confirmed swing lows (Low 1, Low 2), the touches alternating (High 1 before Low 2, Low 1 before
High 2). Falling wedge: both lines fall and the upper falls faster. Rising wedge: both rise and the lower rises faster. First to
last touch 10 to 60 candles; the width at the first touch at least 2 ATR, at the last touch at most 70% of it; every close from the
first to the last touch inside the lines by the buffer; the candle before the apex (where the lines meet) and within 20 candles of
the last touch. The first time every check passes (normally the candle that confirms the last touch) the two lines are locked and
never redrawn; the wedge is dropped 20 candles after the last touch or at the apex; a dropped or traded wedge (the same four
touches) is never taken again, and while one is locked no other is looked for. One trade per wedge, the first close outside the
locked lines by the buffer, the line's value changing candle by candle: falling wedge, above the upper line Buy CE (the breakout),
below the lower line Buy PE (the failure); rising wedge, below the lower line Buy PE (the breakdown), above the upper line Buy CE
(the failure). A close more than 2 ATR past the line is skipped and the wedge used up. L is the broken line's value on the signal
candle (the break level); the pattern target L plus (CE) or minus (PE) the widest width. The whole wedge and the signal on one day.
The scanners keep state (the locked wedge, the wedges used up) and step on every closed candle, a trade open or not: a signal while
a trade is open is skipped, "one trade at a time". The documents' daily chart, VWAP and strength filters are not built.

## Bullish Rectangle (the "Bullish Rectangle Chart Pattern" document, built 21 October night)

After a rise, two swing highs within half an ATR of each other and two swing lows within half an ATR, alternating; the resistance
the higher high, the support the lower low, the height at least 2 ATR; the support at least 2 ATR above the lowest low of the 20
candles before the first touch. First to last touch 10 to 60 candles; every close in between inside the lines by the buffer; within
20 candles of the last touch. Locked the first time every check passes (never when already broken since the last touch was
confirmed), dropped 20 candles after the last touch, never taken twice. One trade per rectangle: a close above the resistance by
the buffer, Buy CE (the breakout); before any breakout, a close below the support by the buffer, Buy PE (the failure). More than 2
ATR past the line, skipped. L is the resistance (CE) or the support (PE); the target that line plus or minus the height.

## The four triangles (the "Bullish Symmetrical Triangle", "Bearish Symmetrical Triangle", "Ascending Triangle" and "Descending
Triangle" documents, built 22 October night)

Each gives one trade only, in one direction, and never the other side. Shared: the upper line through the two latest confirmed
swing highs, the lower through the two latest confirmed swing lows, the touches alternating; first to last touch 10 to 60
candles; the width (height) at the first touch at least 2 ATR, at the last touch at most 70% of it; every close in between inside
the lines by the buffer; before the apex; within 20 candles of the last touch. The lines are locked the first time every check
passes and never redrawn; a triangle already closed outside its lines since its last touch was confirmed is never locked; a used
one (signalled, cancelled, skipped or expired) is never taken again. Locked, each candle in this order: expired (20 candles after
the last touch, or the apex) drops it; a close past the other line by the buffer cancels it, no trade; a close past the break line
by the buffer and at most 2 ATR past it is the signal; further than that is skipped. L is the break line's value on the signal
candle; the target L plus or minus the widest width.

- Bullish symmetrical triangle, Buy CE: a falling upper line and a rising lower line, neither more than 3 times steeper than
  the other, after a rise into it (the 20 candles before the first touch: the rise into the triangle's middle at least 2 ATR and
  not less than the fall). A close below the lower line cancels.
- Bearish symmetrical triangle, Buy PE: the same shape after a fall into it (the fall at least 2 ATR and more than the rise,
  so the two rules never take the same triangle). A close above the upper line cancels.
- Ascending triangle, Buy CE: a flat top (the two highs within half an ATR; the resistance the higher) and a rising support
  line through the two lows; no trend check. L is the resistance. A close below the support cancels. A new triangle is taken
  only with its last touch after the last drop, so a redraw with one more touch never gives a call right after a cancel.
- Descending triangle, Buy PE: a flat bottom (the two lows within half an ATR; the support the lower) and a falling resistance
  line through the two highs; no trend check. L is the support. A close above the resistance cancels. The same no-redraw rule.

The 20-candle trend window of the symmetrical ones may reach into the previous day (the document: "the window may reach into the previous
day"): the page gives the engine the previous sessions' candles it has loaded (the ATR warm-up's), the day's first candles use what is there. The documents' daily chart, VWAP and
strength filters are not built.

## The entry and the filters (every rule)

The entry at the next candle's open, 09:30 to 14:45; one trade at a time across the rules; two losses in a row end the day's
entries; max trades and max loss a day off until the owner sets them; the expiry-day skip waits for the option (not built). Rules
firing on one candle the same way: the first in the order double top, double bottom, triple top, triple bottom, falling wedge, rising
wedge, bullish rectangle, bullish symmetrical triangle, bearish symmetrical triangle, ascending triangle, descending triangle;
different ways: nothing. The wedge, rectangle and triangle scanners keep state and
step on every closed candle, a trade open or not: their signal while a trade is open is skipped, "one trade at a time".

## After the entry: Rule 1, then the ATR trail (22 October)

L is the line the signal broke (the neckline, the support, the resistance, or a wedge's or triangle's break level). Rule 1 first:
sold on a close back across L (the reclaim); on the candle after the signal candle opening past the signal candle's close and
touching its open (the retouch); or at the day end. Then the trailing stop, the owner's choice of 22 October ("build the 1 ATR
trail", then the same evening "tighten it to half an ATR"): once a candle has closed in profit, the stop sits half an ATR behind the
best close so far (the ATR as of the candle before), moved only in the call's favour and never loosened; sold at the close of the
first candle that closes past it (`trailAtr`, 0.5). On the 25 calls of the 16 saved days and 22 October: +137.35 against +112.10
with one ATR, 9 won against 8; on 22 October itself +131.80 against +102.35.
No Fibonacci levels anywhere on this page or in its engine (the owner, 22 October: "I dont want it at all as of now"), and nothing
of the Paper calls page: not its rule, not its lines ("completely separate and isolated").

## The 14 more patterns (the "More Chart Patterns and Rules" document and more_patterns_reference.py of 29 October; built 30 October): NIFTY 50

The owner's document: 14 more ways to read the 5-minute NIFTY 50 chart, each giving BUY CE or BUY PE, written once for the BUY CE side
and run on the chart turned upside down for the BUY PE side (flip: every price becomes minus the price; the signal is turned back).
Head and Shoulders (and Inverse), Cup and Handle (and Inverted), Rounding Bottom and Top, Flags, Pennants, Falling and Rising Channels,
Broadening Formation, Island Reversal, Opening Range Breakout, the Gap rule (gap-and-go and gap-fill), Engulfing candles, Hammer and
Shooting Star, Doji reversal, VWAP reclaim and loss. `static/morepat.js` is a line-for-line port of the reference: the same checks in
the same order, the same settings (COMMON: swing_n 2, buffer 0.25 x ATR, do not chase past 2 x ATR, max_wait 15, lookback 20; each
rule's own), the same "first break only" and "a pattern signals only once" (the key candles of the last 30 candles), the same statuses
of `run_day`: ok (would be traded: the entry candle, the next one, opens between 09:30 and 14:45), outside time, same side (another rule
earlier in the list gave the same side on the same candle), both sides (opposite signals on one candle: both skipped). The ATR is the
reference's own: ATR(14), Wilder, as of the previous candle, carried over from the previous sessions loaded on the page (up to four);
yesterday's close for the opening range and the gap rules is the previous session's last candle's close. Without volume (an index has
none) the VWAP is the plain running average of (high + low + close) / 3, as the reference says.

**On the page** (the owner, 30 October, first "build it on the page calls with signals", then "make their behaviour same like the
earlier 11 signals"): on NIFTY 50 (NewRule.MORE.indices) the 14 rules are rules of the Calls with Signals page like the other 11.
On every closed candle their signals join the others' in `runDay`, after them in the list (a candle two rules call the same way goes
to the rule earlier in the list; opposite ways: nothing, as before), under the same gates (one trade at a time, the entry candle
between 09:30 and 14:45, two losses in a row, the day's limits) and the same exits (Rule 1, then the trail). A call of theirs in
the table says "Rule:- Bear Flag" and so on, its level L, its picture's target (or none) and the note ("gap fill", "gap and go",
"island of n candles"). Under the Double Bottom shadow log, the **14 more patterns · signal log**: one row per signal of the 14 on
today's closed candles, newest first: the time, the rule, the side, the order (taken, with its points; or why not: outside 09:30 to
14:45, same side (another rule first), both sides, a trade already open, the losses in a row, the call of another rule on the same
candle), the level L (and the target), the close and the ATR used, the entry (the next candle's open), the best and worst move in
the next hour (12 candles, from the entry, in the side's direction, points and ATR), the move at 12 candles and at the day's close,
the paper result of the signal on its own with the page's exits, and the note. The summary line: the signals, how many were taken
as calls, how many fell inside the window, each rule's count (a rule that spoke more than 5 times flagged, as the document asks),
the paper sum. The log is the candles' own: replaying a saved day gives it again (the ULTROAN evening study keeps the daily counts;
after about 30 trading days each rule is judged on its own, by the document's table).

**Proof** (`node lab/morepat_check.js`, fixtures made by the reference's own tests and run_day): the reference's 113 test scans, its
shared tests C-1 to C-10, the 4 real days of the document (23 signals, the document's section 19 list exactly) and random days (40 in
the repository's fixture; 400 with 3,873 signals across all 14 rules in the study copy), every field of every signal the same. The
reference's own 123 self-tests pass. 3 ms a day.

**Settings** (the owner, 30 October: "so you have not made any check box settings on settings button?"): the Calls with Signals
Settings popup lists the 14 rules under their own heading, each with a tick remembered on the browser (`signalsIndicators`, keys
`mp_<rule>`), off until ticked. A tick draws that rule's signals on the chart, as the other rules' ticks do: the signal candle's arrow
with the rule's name, the pattern's key candles as circles with short names (LS, H, RS; L rim, B, R rim; P0, P1; T1, T2; red, green;
hammer, doji, VWAP) and its lines from candle to candle (neckline, rim, the flag's two lines, the channel's two lines, the opening
range, the island high), in the side's colour. The log under the table always carries every signal, ticked or not.

**The VWAP line** (30 October, the owner: "Why vwap stops getting calculated?"): with the VWAP Reclaim and Loss tick on, the chart
draws the VWAP itself, a purple line with one point a candle from the day's first candle through the candle forming now: the same
running average the rule reads (`MorePat.vwapSeries`), so the line is exactly what the rule saw. A VWAP call's flat line stays and
is labelled "VWAP at call": it is the call's level, the VWAP at its signal candle, which the call's exit watches; it does not move.
The line is drawn on the index the rule runs on (NIFTY 50) and only on the Calls with Signals view; nothing in any rule changed.

**The 1 ATR guide** (4 November, the owner, on a VWAP reclaim call: "Why target is not given here? How can I guess where to exit?"):
VWAP reclaim and loss, Engulfing, Hammer and Shooting Star and Doji have no pattern target in the owner's document (a pattern's target is
its height or depth added to its line; these four have no such height), so their Call Target cell showed "—" and only the stop. Now
the cell shows "guide" and one ATR from the call's entry, in its direction (the ATR as of the candle before the signal candle), and an
open call draws it on the chart as a dashed line named "1 ATR guide". **It is a guide only: nothing is sold there.** The call is still
sold by its stop, Rule 1 and then the trail, exactly as before; the engine (`newrule.js`, `morepat.js`) was not touched, so every
entry, exit and point is the same. Why one ATR, and why not a target that sells: on the owner's two years of NIFTY 50 5-minute
candles (the page's engine as it runs, 8 points a call), before a call's own exit price ran at least one ATR in the call's favour on
46% of the 144 VWAP reclaim calls, 40% of the 169 VWAP loss calls, 51% of 402 Engulfing calls, 45% of 108 Hammer calls and 37% of 102
Doji calls (about one call in two, not every call); the median run before the exit was 16 to 24 points. Selling at the guide instead
of letting the trail run paid less per call than the call's own exit for every rule (VWAP reclaim 2.2 against 4.2 points before
costs), because the calls that run are the ones that pay. And none of these rules makes money after costs on the two years (the VWAP
reclaim -541 points over 144 calls after 8 a call, the VWAP loss -1,346 over 169): the guide helps to decide where to book part of a
trade, it does not turn the rule into a profitable one.

**The VWAP stretch meter** (12 November, the owner, of a chart where NIFTY 50 had fallen far below the VWAP line: "Candle and VWAP
line gap should be filled if the gap is too big between them? Is this a standard behaviour?"; "something you have to develop out of
this observation"; then, of the first screenshots, which showed how often the price had come back on past days: "It should not work
on past days on live feed, the numbers should be based on live feed only"). One line beside the Settings button while the VWAP line is
drawn (NIFTY 50, 5-minute candles, the VWAP tick on, while the day runs). A reading of today's candles only, never a call, and no
number of a past day in it (`MorePat.vwapGap`): the gap between the price and the VWAP now, in points and in ATR, above or below; how
long since a candle last touched the VWAP; how many times today the price came back to the VWAP after moving 1 ATR or more away; the
day's widest gap and when. From 3 ATR on the line turns red at its side and says "far from VWAP". Example, 30 October at 11:03: "VWAP
gap now 1.0 ATR above (26.80 points) · price last touched VWAP 10 min ago · today it came back to VWAP 1 time after moving 1 ATR
away · widest gap today 1.5 ATR at 10:30 am · today's live data only, not a call". Why a reading and not a rule, from the owner's two
years of NIFTY 50 5-minute candles (11 November 2024 to 9 November 2026): the price does tend to meet the VWAP again, but slowly and
less the wider the gap (back within an hour after 60% of the candles 1 to 1.5 ATR away, 30% at 2 to 3, 7% at 4 or more; by the day's
end 82%, 61%, 23%); a bet on the return (a turn candle after a stretch, stop at the extreme, target the VWAP) lost in all 192 settings
tried, in both years; a bet with the move at 4 ATR or more (trail 1.5 ATR) made about +3 points a call in each year but lost on more
days than it won and rested on three days, so it did not pass the bar. `lab/vwap_meter_check.js` checks the reading.

**Not built:** nothing of the document is left out; the rules run on NIFTY 50 only, as the document covers.

## Engulfing (strict) replaces Engulfing (20 November): NIFTY 50

The owner, 20 November, after the daily Calls with Signals round: "look into the engulfing rule on NIFTY 50, this is really causing
the problem"; "engulfing rule is causing more damage in case of money, is there any change required?"; then "yes, build the engulfing
strict and replace the old one", and of a new rule's tick: "unticked means keep it out of the table too".

**The rule** (`static/morepat.js`, `engulfing_strict`, not in the owner's reference): the document's Engulfing with its own setting
raised and two checks added. (a) The fall before it (a rise, for the PE side) is at least 2.0 x ATR (the document: 1.5). (b) The second
candle closes at or past the first candle's high (CE: the green candle closes at or above the red candle's high, covering the whole red
candle, not only its body; PE: the red candle closes at or below the green candle's low). (c) The signal candle starts before 14:00
(candle 57 of the day), so the call enters by 14:00 at the latest. Everything else is the document's: the body of at least 0.5 x ATR,
the look-back of 8 candles, the level L (the pattern's low; PE: its high), no pattern target (the 1 ATR guide shows), the page's exits
(Rule 1, then the trail), the gates. The table says "Rule:- Bullish Engulfing (strict)" or "Bearish Engulfing (strict)".

**On the page**: the document's Engulfing gives no call any more (`NewRule.MORE.calls` no longer lists it) and is gone from Settings,
the chart and the signal log. "Engulfing (strict)" stands in its place in the Settings list, **unticked by default**, and it is the
only rule whose tick decides its calls (`NewRule.MORE.optIn`, `NewRule.moreCalls(ticked)`): unticked, it gives no call, draws nothing
and holds up no other rule's call (the engine does not run it); ticked, its calls join the table and the chart like any other rule's,
in the old Engulfing's place in the list. The signal log under the table lists its signals either way; unticked they say "no call:
unticked in Settings". The other 24 rules are unchanged (their calls in the table, ticked or not). The reference's own list
(`MorePat.ORDER`) still holds the document's 14, so `lab/morepat_check.js` still checks the port against the reference;
`MorePat.PAGE_ORDER` is the page's 14 (the strict rule in the old one's place), `MorePat.ALL_ORDER` every rule (a replay may still ask
for the old one with `more: [...]`).

**Why** (NIFTY 50, the owner's two years of 5-minute candles from 11 November 2024 to 9 November 2026 and the saved days to 20 November:
501 days; the page's engine as it runs, every rule, one trade at a time, index points; "after costs" takes 8 points a call; the VWAP
of the older days is the plain average, as they have no volume). After costs Engulfing was the rule that lost the most: 417 calls,
-2,137 points (year 1 -815, year 2 -1,321, the 36 saved days -260); a win averaged +24.9 after costs, a loss -29.5. The 81 calls that
ended by a close back across the pattern's low lost 38.6 points each. Of 72 stricter versions built from the rule's own checks (the
body, the fall, the close past the other candle, the time), 69 lost less than the page in both years. Taking Engulfing out alone saves
less (+386 points after costs over the two years) because the slots it frees go to other rules that also lose. The page's NIFTY 50
calls, after costs, against the page as it was:

| | Engulfing calls | Engulfing's own, after costs | All calls, two years | Year 1 | Year 2 | 36 saved days |
| --- | --- | --- | --- | --- | --- | --- |
| Engulfing out (Engulfing (strict) unticked) | 0 | 0 | +386 | +222 | +164 | +142 |
| Engulfing (strict) ticked | 258 | -636 | +1,097 | +500 | +597 | +195 |

The strict version was the best of the 72 on these same days, so the true gain is likely smaller: chosen on the first year alone, the
stricter versions still gained in the second (+47 to +325). Engulfing (strict) still loses after costs, and all the page's rules
together still lose about 10,300 points after costs over the two years with it ticked: it closes the biggest leak, it does not make
the page pay. Also seen: after an Engulfing signal the index went the call's way about half the time (47% after an hour, 716
signals), so buying the opposite side is no fix either; calls against the day's move did worse (39 to 45% after an hour) than calls
with it (52%), but taking Engulfing only with the day's move gained in year 1 and lost 271 points in year 2, so it was not built.
`lab/newrule-check.js` S1 to S7 hold the rule's cases and the swap.

## Double Top (strict) replaces the Double Top (20 November): all three indices

The owner, 20 November: "look into the double top rule on NIFTY BANK"; "yes, build it for NIFTY BANK only"; then, told that the test
helped NIFTY 50 and SENSEX too, "add it for all three indices".

**The rule** (`static/newrule.js`, `RULES["double top (strict)"]`, `DT_STRICT`): the Double Top of the "Trading Rules
Specification" as the page runs it (Buy PE, swing size 2, the neckline break by 0.25 x ATR, Rule 1 and the trail), with one change:
the two tops at least **7 candles** (35 minutes) apart, not 5. The table says "Rule:- Double Top (strict)".

**On the page** (`NewRule.rulesFor`, `RULE_OPT_IN`): on NIFTY 50, NIFTY BANK and SENSEX the old Double Top gives no call; "Double Top
(strict)" stands in its place in the Settings list, **unticked by default**: unticked, the engine does not run it (no call, nothing
drawn, it holds up no other rule's call); ticked, its calls fill the table in the Double Top's place in the list.

**Why** (index points before costs, the page's engine as it runs, every rule, one trade at a time). NIFTY BANK: 59 days, 26 August to
20 November (the 36 saved days and the days before them rebuilt from `history/volume/NIFTYBANK_1min.csv`; on the 36 days both have,
the rebuilt 5-minute candles equal the saved ones, 2,700 of 2,700). The Double Top gave 17 calls, 7 won, +497, carried by two calls
(1 September +372, 9 September +283); from October 9 calls lost 258, six of them sold within one to three candles by a close back above
the neckline. Seventeen calls are too few to tune on, so every change was tested on NIFTY BANK, on SENSEX (57 days, rebuilt the same
way from its 1-minute file, 1,425 of 1,425 candles equal to the saved ones) and on NIFTY 50 (the two years and the saved days, 501
days), and only a change that helped all three was kept. Against the page as it was:

| | Double Top calls | Ticked (the strict rule) | Unticked (no Double Top) |
| --- | --- | --- | --- |
| NIFTY BANK, 59 days | 17 to 11 | +136 (26 August to 30 September +19, October and November +117) | -177 |
| SENSEX, 57 days | 6 to 3 | +32 | -117 |
| NIFTY 50, 501 days | 54 to 39 | +279; after 8 a call year 1 +50, year 2 +230 | +89; after 8 a call year 1 +158, year 2 +4 |

On NIFTY BANK it takes out 6 Double Top calls (5 lost, 1 won: -167 together); two other calls come in for -31. On SENSEX it takes out
one loser (-70) and one winner (+37); a third (+121) stays as the Double Bottom call of the same candle. On NIFTY 50 the strict Double
Top still loses a little (39 calls, -77). Tried and not built: a break of the neckline by 0.5 x ATR (NIFTY BANK +207, NIFTY 50 better,
SENSEX -92), 0.6 and 0.75 x ATR (SENSEX worse), 1.0 x ATR, tops within 0.3 ATR, a neckline 2.0 ATR deep, a rise of 3.0 ATR into the
first top, the documents' swing size of 3, the signal within 10 candles of the second top, and no Double Top at all. The gains on
NIFTY BANK and SENSEX rest on a handful of calls: thin, to be watched by the daily round. `lab/newrule-check.js` D1 to D4 hold the
rule's cases and the swap.

## VWAP Reclaim and Loss (strict) replaces the VWAP rule (22 November): NIFTY 50 and SENSEX

The owner, 20 November, of the first ranking of the page's rules: "look into the VWAP rule on NIFTY 50"; then, 22 November, "so do
you mean it is going to change the VWAP line value calculation rule on chart?" (no: the line is untouched) and "yes, build it".

**The rule** (`static/morepat.js`, `vwap_strict`): the document's VWAP Reclaim and Loss, the same function and the same VWAP line
(`MorePat.vwapSeries`: from 09:15, the futures volume when the page has it, else the plain average), with two of its own checks
stricter: **all of the last 8 candles** closed on the other side of the VWAP before the first close back across (the document: 5 of
the last 6), and the signal candle's body **at least 0.5 x ATR** (the document: 0.3). The buffer (0.25 x ATR), the chase limit
(2 x ATR), the level (the VWAP at the signal candle), Rule 1 and the trail are unchanged. The table says "VWAP reclaim (strict)" or
"VWAP loss (strict)".

**On the page**: the document's VWAP rule gives no call any more (`NewRule.MORE.calls` no longer lists it); "VWAP Reclaim and Loss
(strict)" stands in its place in the Settings list, **unticked by default** (`NewRule.MORE.optIn`): unticked, no VWAP call, nothing
drawn, it holds up no other rule's call; ticked, its calls fill the table, and the VWAP line and the VWAP stretch meter show (they
showed with the old rule's tick). `MorePat.ORDER` keeps the reference's 14 (`lab/morepat_check.js` unchanged); `MorePat.PAGE_ORDER`
has the strict rule in the old one's place.

**SENSEX, not NIFTY BANK** (the owner, 22 November: "Is it applied on Nifty bank and sensex chart ? if no then do that as well";
then, shown the numbers below, "NIFTY 50 and SENSEX"): the strict VWAP rule runs on SENSEX too, alone of the 14 (`NewRule.MORE.alsoOn`,
`ruleOn`, `moreCalls(ticked, index)`; `runDay` runs on an index only the rules that run there), with SENSEX's own futures volume when
every closed candle has it, else the plain average. NIFTY BANK runs none of the 14. Until 22 November the Settings ticks were one set
for the three index pages (one tick turned it on for NIFTY 50 and SENSEX together); since then each page keeps its own (below). Unticked, nothing changes on SENSEX, call for call. Ticked,
on their days (57 and 59; the futures volume from `history/volume/SENSEX_1min.csv` and `NIFTYBANK_1min.csv`, complete on 4 and 31 of
the days: SENSEX futures trade thinly, so its VWAP is mostly the plain average, live too), after 8 points a call against the page as
it was: **SENSEX +609** (31 calls; first half -123, second half +732) and NIFTY BANK -777 (29 calls, 10 won; first half +253,
second half -1,029): NIFTY BANK was left out.

**Why** (NIFTY 50, the page as it opens, every rule, one trade at a time, index points; after costs: 8 points a call). On the two years
and the saved days (501 days; the VWAP of the two-year file is the plain average, as it has no volume) the VWAP rule gave 380 calls,
+765 before costs, -2,275 after: the page's worst rule after costs, both years negative. Its Buy PE side lost even before costs (204
calls, -113); the 127 calls sold by a close straight back across the VWAP lost 25 points each; on days when the closes had already
crossed the VWAP two or more times, the calls lost most. On the 60 days with the futures volume (`history/volume/NIFTY50_1min.csv`,
26 August to 20 November; their 5-minute candles equal the saved ones; before late October the volume is the November contract's,
an approximation of what the page read then) it nearly broke even (45 calls, -40 after costs), so every change was judged on both.
After costs, against the page as it was:

| | VWAP calls | VWAP's own | All calls |
| --- | --- | --- | --- |
| Strict ticked, 501 days | 380 to 179 | -2,275 to -569 | +1,388 (year 1 +1,080, year 2 +308; 7 of 9 quarters) |
| Strict ticked, 60 volume days | 45 to 22 | | +225 |
| Unticked (no VWAP call), 501 days | 0 | | +1,635 (year 1 +903, year 2 +732) |
| Unticked, 60 volume days | 0 | | -6 |

Each of the two checks helped alone in both years and on the volume days (8 of 8 alone +844, +183, +237; the body alone +394, +185,
+49), and 7, 8 or 9 candles in a row all helped. Tried and not built: at most 1, 2 or 3 earlier crosses of the VWAP that day (lost on
the volume days), the reclaim side only, 6 of 6, clearing the VWAP by 0.5 ATR, at most 1 ATR past it. The strict rule still loses
after costs (-569, mostly the Buy PE side). `lab/newrule-check.js` V1 to V6 hold the rule's cases and the swap.

## Doji Reversal (strict) replaces the Doji rule (22 November): NIFTY 50; each index page keeps its own ticks

The owner, 22 November, of the next rule on the ranking: "test in on Nifty Bank and Sensex now"; then "yes, build it for NIFTY 50
only, and do not share the tick across the 3 pages"; and of the grey note between the 12 rules and the 14 in the Settings list
"remove the red marked box ... no need of that messgae text".

**The rule** (`static/morepat.js`, `doji_strict`): the document's Doji Reversal, the same function, with one of its own checks
stricter: the doji candle at least **1.0 x ATR** from high to low (the document: 0.5). The body at most 10% of its range, the fall
(rise) of 1.5 ATR within 8 candles, the next candle closing past the doji, the level (the doji's low; PE: its high), no pattern target
(the 1 ATR guide), Rule 1 and the trail are unchanged. The table says "Doji reversal up (strict)" or "Doji reversal down (strict)".

**On the page**: NIFTY 50 only (the 14 run there). The document's Doji gives no call any more; "Doji Reversal (strict)" stands in
its place in the Settings list, unticked by default (`NewRule.MORE.optIn`): unticked, no Doji call; ticked, its calls fill the
table. NIFTY BANK and SENSEX: no Doji call, ticked or not, call for call as before.

**Each index page keeps its own ticks** (`detail.html`: the key `signalsIndicators:<index>`): a tick on one page leaves the other two
as they were. The first time a page opens after 22 November it starts from the ticks shared until then (`signalsIndicators`, no
longer written), then goes its own way. The grey note in the Settings list is gone.

**Why** (index points, the page as it opens, every rule, one trade at a time; after costs: 8 points a call). NIFTY 50, 501 days: the
Doji gave 159 calls (the strict rules unticked), +100 before costs, -1,172 after, both years negative; the 31 calls sold by a close
back across the doji lost 37 points each; dojis 0.5 to 1 ATR tall lost in both years, those of 1 ATR and more made money in both.
Against the page as it was:

| | Doji calls | Doji's own, after costs | All calls, after costs |
| --- | --- | --- | --- |
| Strict ticked, NIFTY 50, 501 days | 159 to 31 | -1,172 to +34 | +960 (year 1 +656, year 2 +304; all 9 quarters) |
| Strict ticked, NIFTY 50, 60 volume days | 20 to 4 | | +52 |
| Unticked (no Doji call), NIFTY 50, 501 days | 0 | | +727 (year 1 +479, year 2 +248) |

0.75, 1.0 and 1.25 ATR were each better than the page in all 9 quarters. Also tried: a fall of 4 ATR (+1,076, 24 calls), 1 ATR with a
fall of 3 (+1,057, 16 calls), a thinner body or a longer look-back (lost in year 2). On NIFTY BANK and SENSEX, where the Doji does not
run, adding it was tested and not built: NIFTY BANK, 59 days, the strict Doji -306 (4 calls; the document's +16, halves +590 and
-574); SENSEX, 57 days, the strict Doji +156 from 7 calls (second half -35; 0.75 ATR -520, 1.25 ATR +313): too thin and unsteady.
`lab/newrule-check.js` J1 to J6 hold the rule's cases and the swap.

## On the page

The Calls with Signals table always carries every rule's calls (Time with the entry, Buy CE or PE, "Rule:- Double Top" and so on,
the index at entry, the pattern target with the stop or the exit, the points, the status, the documents' messages). The Settings
popup has a tick per rule (and the Fib Levels tick of 21 October, which draws nothing): ticked, the chart marks the pattern's points (T1, T2, T3 or
B1, B2, B3; a wedge's, rectangle's or triangle's H1, H2, L1, L2) and the signal, and draws the broken line (the pattern's two
lines too, from the first touch to the signal candle) and an open call's trailing stop (dashed).

## Figures

The 15 saved days, 29 September to 21 October, NIFTY 50: see the figures in the pull requests and the Candle Logic artifact.

The symmetrical triangle of 21 October (both sides from one rule) was removed on 22 October evening at the owner's word and replaced the
same night by the four triangles above, from their own documents.

## The VWAP uses real volume (17 November)

The owner, 17 November: "VWAP values are far away on both pages now"; "yes". The VWAP of Calls with Signals (the line, the
VWAP stretch meter, and the VWAP Reclaim and VWAP Loss rule) now weighs each candle with the volume of the index's nearest
futures contract, the same volume and the same sum as the Volume Profile page: on the same candle size both pages show one
VWAP. Before, it was the plain average of the candles' typical price (no volume), which drifted from the true VWAP on days
when the volume was uneven. The page loads the volume with the candles (`/indices/<name>/volume`, 1, 5 and 15 minute
candles). When the day has no volume (the route failed, an older day, 30 minute candles) the VWAP is the plain average as
before and the line is named "VWAP avg". The rule's other conditions are unchanged; only where the VWAP line sits changed,
so a VWAP Reclaim or Loss call can fire on a different candle than the plain average gave.
