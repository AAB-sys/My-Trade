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
3 after, known once the third candle after it has closed; a swing low the same with lows.

## Double Top (the "Trading Rules Specification" document, built 21 October night)

Two swing highs 5 to 40 candles apart, within half an ATR of each other, nothing above them between; the neckline the lowest low
between them, at least 1.5 ATR below the lower top; a rise of 2 ATR into the first top; no close above the tops since. The signal:
the first close below the neckline by the buffer, counted from the candle that confirms the second top, within 20 candles of it and
not more than 2 ATR past the neckline. Buy PE at the next candle's open. (The document's double bottom mirror is in the engine but
off: the Double Bottom document below is the rule the page runs.)

## Double Bottom (the "Double Bottom Chart Pattern" document, built 21 October night)

Two swing lows 5 to 40 candles apart, within half an ATR, nothing below them between; the neckline the highest high between them,
at least 1.5 ATR above the higher bottom; the support the lower bottom; a fall of 2 ATR into the first bottom. One trade per
pattern, whichever comes first: a close above the neckline by the buffer, Buy CE (the breakout); before any breakout, a close below
the support by the buffer, Buy PE (the failure). The first such close counted from the candle that confirms the second bottom,
within 20 candles of it, not more than 2 ATR past the line.

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
