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

**Not built:** nothing of the document is left out; the rules run on NIFTY 50 only, as the document covers.

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
