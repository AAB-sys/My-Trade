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

## The entry and the filters (every rule)

The entry at the next candle's open, 09:30 to 14:45; one trade at a time across the rules; two losses in a row end the day's
entries; max trades and max loss a day off until the owner sets them; the expiry-day skip waits for the option (not built). Rules
firing on one candle the same way: the first in the order double top, double bottom, triple top, triple bottom; different ways: nothing.

## After the entry: Rule 1 and Rule 2

L is the line the signal broke (the neckline, the support or the resistance). Rule 1 until the first of the chart's lines is
crossed: sold on a close back across L (the reclaim); on the candle after the signal candle opening past the signal candle's close
and touching its open (the retouch); or at the day end. Once a candle closes beyond the first line in the profit direction by the
buffer, Rule 2: the stop on each line crossed (AT_LEVEL; ONE_LEVEL_BACK is an option), never back; sold on a close back past it.
The lines are the chart's own lines of the day, the Previous close lines (hidden on the plain chart, used by the rule).

## On the page

The Calls with Signals table always carries every rule's calls (Time with the entry, Buy CE or PE, "Rule:- Double Top" and so on,
the index at entry, the pattern target with the stop or the exit, the points, the status, the documents' messages). The Settings
popup has a tick per rule (and Fib Levels, waiting for its logic): ticked, the chart marks the pattern's points (T1, T2, T3 or
B1, B2, B3) and the signal, and draws the broken line and an open call's stop.

## Figures

The 15 saved days, 29 September to 21 October, NIFTY 50: see the figures in the pull requests and the Candle Logic artifact.
