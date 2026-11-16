# Ultron: ideas already tested (do not retest under a new name; a new day only adds fair-test evidence)

Each idea: what it is, found on (only days AFTER this date are its fair test), result so far.

- 1-minute exit (exit on the first 1-minute close past the stop instead of the 5-minute close), Paper calls, NIFTY 50.
  Found 26 Oct. 18 days: +285 pts vs now, 12 days better / 6 worse, BUT all of it from 23 Oct; worse on the 3 expiry
  Tuesdays. Not built. Scripts: wf/min1.js, min1/rules.js (switch globalThis.MINUTE_EXIT).
- Profit Lock (MAX / STEADY / RUNNER), Paper calls, NIFTY 50: live in SHADOW since 24 Oct (PR #214). 26 Oct: would have cut
  the 9:40 CE (+10,150 real) at -995; day +9,802 real vs about -718 with the lock. Friday 30 Oct report covers it.
- Loss Cutter: documents' version (LC_DOC, live in shadow) vs improved (PR #216, unmerged: 9:40 opening, strict zone, memory 6).
  Improved found on 26 Oct morning data: fair test is 27 Oct onward. Friday 30 Oct report covers it.
- Call Gate v2: live column (advice only).
- Swing size 2 for the double/triple tops and bottoms (Calls with Signals): live since 26 Oct (PR #215).
- Double Bottom version 3 (swing 2, gap 3), Calls with Signals NIFTY 50: SHADOW since 27 Oct (PR #217); version 2 in the table.
  Brief: review after >= 20 trading days, >= ~10 V3-only signals, positive after costs, not resting on one trade; 26 Oct 09:50
  (the design day) not counted as proof. Saved days before 27 Oct: NIFTY 50 V3-only 15 signals, +161.85 pts before costs
  (with 26 Oct 09:50 +97.1).
- Double Bottom min depth 0.75 ATR: rejected by the owner's document (adds losers).
- Double Bottom version 2 on NIFTY BANK: worse on 18 saved days (+206.85 -> -20.45): NIFTY BANK keeps the old rule.

- Double Top tolerance (Calls with Signals, DT.eqAtr 0.5 -> 0.6 / 0.75 ATR, the double top only). Asked by the owner 27 Oct;
  found on 27 Oct; tested 27 Oct on 19 days (29 Sep to 27 Oct). Result: 0.6 changes nothing (NIFTY 50 and NIFTY BANK). 0.75 adds two
  NIFTY 50 double tops, both losers (1 Oct -11.95, 6 Oct -11.45): -23.4 pts, 2 days worse, 0 better; NIFTY BANK total unchanged.
  27 Oct's M (tops 10:00 22,804.50 and 10:50 22,784.15, 20.35 apart; limits 16.1 / 19.3 / 24.1 at 0.5 / 0.6 / 0.75 ATR) gives no call
  even at 0.75: the first close below the neckline 22,684.55 came at 14:00, after the rule's 20-candle wait (ends 12:30).
  Verdict: SET ASIDE (not better; would not have caught 27 Oct either). Scripts: ultron/dt/study.js, ultron/dt/newrule.js.

- Stop for the day after N losing calls in a row (Paper calls, previous close lines; queued by the owner 28 Oct; found on 28 Oct;
  tested 28 Oct evening on 20 days, 29 Sep to 28 Oct; wf/study1.js; in a row = in the order the calls closed; after-the-fact filter).
  NIFTY 50, after 8 pts a call: N=2 -1,042 -> -718 (+324), 13 days better / 7 worse, calls 317 -> 80, BUT the best two days (23 Oct,
  5 Oct) give +578: without them -254; before costs +1,494 -> -78 (it cuts the winners too); losing days 15 -> 15; worst day -459 -> -123.
  N=3: +204, 13 better / 5 worse, rests on two days too (without them -448). 28 Oct (the first day after the idea): N=2 -96 -> -116
  (worse), N=3 unchanged. NIFTY BANK (outside check, 19 pts a call): N=2 -4,681 -> -2,054, without the best two days still +1,237;
  28 Oct -787 -> -201. Verdict: NOT READY as a profit rule on NIFTY 50 (rests on two days, worse on its first fair day). What it does
  do: cut the worst day by about three quarters on both indices (a money-protection rule, like the owner's own daily limit).
  Keep tracking it on new days in the ledger.

- Calls with Signals, an earlier trigger (queued by the owner 29 Oct, "Signal firing should also be very real time"; found on 29 Oct;
  tested 29 Oct evening, wf/study5.js, results ultron/study5.json). Every saved day with 1-minute candles (20 days, 30 Sep to 29 Oct;
  SENSEX only 3). A = now (5-minute close); B = the rule asked after each 1-minute close inside the forming candle, entry next minute;
  C = a touch of the line + buffer, entry AT it (optimistic). After-the-fact: false-breakout trades managed with the rule's stop.
  NIFTY 50 (8 pts a call): A 39 calls +302.7 pts, after costs -9.3. B 52 calls: 32 entered earlier, entry better by +172.9 pts in all
  (20 better, 12 worse), but 14 false breakouts -204.2 pts (1 won of 14): after costs -119.0 (worse by 110); days 10 better / 9 worse.
  C 63 calls: entry better by +335.5, 27 false breakouts -297.3 (1 won): after costs -86.9 (worse by 78); days 11 / 8.
  NIFTY BANK (19 a call): A 38 calls +703.4, after costs -18.7; B -209.6 (13 false breakouts -62.6); C -199.7 (27 false -525.4).
  SENSEX: 3 days, 4 calls: too few. 29 Oct SENSEX 14:25: B entered 14:26 at 74,088.59, worse than A's 74,080.89.
  Verdict: NOT READY. Firing earlier buys a better price on the real breakouts, but false breakouts (the price crosses, the
  5-minute candle closes back) come almost twice as often as the gain pays for, and nearly all of them lose. The 5-minute close stays.

- The 1-minute trigger WITH a filter against false breakouts (the owner, 29 Oct evening: "find out the way to filter out the 14
  false breakout"; found on 29 Oct; wf/study5f.js, ultron/study5f.json). Ten filters, each asked at the minute the rule would fire, with
  only what is known then (else wait, and in the end the 5-minute close as now). FAIR TEST: chosen on the first half (30 Sep to 14 Oct,
  10 days), judged untouched on the second half (15 to 29 Oct, 10 days), NIFTY BANK as the outside check.
  Best on the first half: "the 1-minute close at least 0.2 ATR past the trigger": NIFTY 50 first half +33.7 pts after costs vs now,
  SECOND HALF -12.6 (12 earlier entries +79.1, 4 false breakouts -59.8, costs); all 20 days +21.1, false breakouts 14 -> 5;
  NIFTY BANK all days +195.4 (false breakouts 13 -> 3, and those 3 made +90). Others: 0.1 ATR -10.9 / -12.4; 0.3 ATR -18.3 / +124.4;
  0.5 ATR -33.3 / -44.5; two closes in a row -31.4 / -171.2; minute 2+ -79.8 / -281.3; minute 3+ -30.1 / -254.5; minute 4 -22.0 /
  -190.2; strong minute -88.1 / -105.8; strong candle -101.0 / -110.9 (NIFTY 50 / NIFTY BANK, all days, vs now after costs).
  Verdict: NOT PROVEN. The 0.2 ATR filter cuts most false breakouts and is ahead over all days on both indices, but it lost on the
  NIFTY 50 days it was not chosen on (only 12 calls there). A filter fitted to remove exactly those 14 would be memorising the past.
  Proposed to the owner: track it in shadow on every new day from 30 Oct (no page change), decide after about 10 new days.

- THE WIDEST HONEST SEARCH (the owner, 29 Oct night: "You are an AI ... find something unnatural"; "Yes run it now only"; found on
  29 Oct; wf/wide.js, wf/wide_day.js, ultron/wide-*.json/out). Paper calls, previous close lines, 5m, both: 8,404,992 combinations of
  the owner's own settings (ideas P1-P7, 1-min exit, Profit Lock modes, side, LC TAKE, Gate TAKE, level group, entry window, max N
  calls, stop after N losses). Chosen on the first half (10 days before 15 Oct), judged on the second half (10 days), and the reverse.
  NIFTY 50 (8 pts a call): NOW -990. Best on the first half: "entries 12:00-15:00, first 3 calls a day, nothing else" +928 -> second
  half +79 (28 calls); ALL top 100 on the first half were positive on the second (avg +55). Reverse: best on the second half (+605) ->
  first half -416, 0 of the top 100 positive. Per day: 13 +, 7 -, worst -103, best two 463; all 20 days +1,007.
  My own Trade Plan (LC TAKE, max 5, stop 2): -294 / +216 = -78: FAILED the test (said so to the owner).
  NIFTY BANK (19 a call): NOW -4,809; both directions fail (0 of 100 positive); the NIFTY 50 winner on BANK -577. Nothing survives.
  Verdict: no magic rule; NIFTY BANK calls should be switched off; on NIFTY 50 one simple rule passed the forward test, thinly:
  "after 12:00, the first 3 calls, NIFTY 50 only" (+1,007 / 20 days after costs, ~50 pts a day). Proposed as the Trade Plan view,
  with 10 paper days before any real money. Survivors on both halves: N50 8.9% of combos, BANK 2.2%.

- EIGHT NEW TEXTBOOK PATTERNS (the owner, 29 Oct night: "Build all the rules on first half and second half ... only survivor will go
  further"; found on 29 Oct; newpat/patterns.js, run.js, test.js, synth.js, overlap.js; results.json, results_loose.json; the Word
  report newpat/New_Chart_Patterns_Test_Results.docx). 13 detectors (head and shoulders both ways, cup and handle both ways, bull/bear
  flag, bull/bear pennant, rising/falling channel, rounding bottom/top, broadening), all 13 fire on a textbook shape (synth.js). Exits as
  the page (manageStep), one trade at a time, entry window, 2 losses. Strict and loose settings, both fixed beforehand.
  NIFTY 50: nothing positive on both halves (loose: inverse H&S +3.5/+37.9 on 3 calls, too few; rounding top -51/+142; others lose).
  NIFTY BANK loose: rising channel +199/+171 and falling channel +156/+97 "passed", BUT 3 of their biggest wins are the same candles as
  the page's wedges; added only when the page is free: -221 / +267 = fails. SENSEX: 3 days, nothing to judge.
  Verdict: NO NEW PATTERN PASSES. More patterns = more rare calls that lose to charges. Reported in the Word document to the owner.

## Queued by the owner (test these FIRST, in order; then move each to the list above with its result)
Asked 28 Oct 08:10 IST ("yes, add them to ULTROAN"), after the owner lost Rs 5,000 (their full daily limit) trading real money on
27 Oct, an expiry day. The owner's wish: rules that REDUCE LOSSES. These are rules about WHEN NOT TO TRADE, on the owner's own calls.
Test each on the Paper calls page's calls (NIFTY 50 first, levels "close", 5 min, signal both: the page as it runs; index points
from the replay on all saved days; rupees from the calls CSVs where the day has premiums, 1 lot), against taking every call; report
the worst day, the number of losing days, the total before and after 8 pts a call, days better vs worse, and whether it rests on
one or two days. Report them one per evening, in this order (one idea per run, unless a run has time for two):
1. (TESTED 28 Oct, moved to the list above.)
5. (TESTED 29 Oct, moved to the list above.)
2. (TESTED 30 Oct, moved to the list above.)
3. (TESTED 3 Nov, moved to the list above.) At most N new calls a day (N = 3, 5, 8), the first N in time order; also "stop for the day once the day's closed calls are
   down X points" (X = 1 and 2 x the day's opening ATR). Report the best N honestly, and warn that picking the best N on the same
   days flatters it.
4. Pick the best few calls (asked by the owner 28 Oct 08:40, "yes, add it to ULTROAN"; found on 28 Oct). Why: on 19 days (29 Sep to
   27 Oct) the page's NIFTY 50 calls made +1,463 pts before costs but -945 after 8 pts a call (301 calls, 15.8 a day; NIFTY BANK
   +2,186 / -3,894 after 19 a call): the leak is the NUMBER of calls, and by hand the owner takes only a few, so the pick decides the day.
   Study what the winning calls have in common, using ONLY what the page knew at the signal (no look-ahead): entry time / hour, call
   number in the day, the level (level_pct), CE or PE vs where price is against the previous close and the day's open, distance to
   the target in ATR, the signal candle's size in ATR, the day's gap, the opening range (gate verdict where the CSV has it), how many
   calls are already open. Build a simple score or 1-2 plain rules (no fitted model); mark the best 3 and 5 calls a day.
   FAIR TEST: find the rule on the first half (29 Sep to 13 Oct), check it untouched on the second half (14 to 27 Oct), then on every
   new day from 28 Oct (the ledger). Report: points after costs for "best 3" and "best 5" vs taking every call and vs the first 3/5
   calls, days better vs worse in each half, NIFTY BANK as the outside check. If it only works on the half it was found on, say so:
   that is luck. Scripts to start from: wf/diag19.js (breakdowns) and wf/diag19b.js (after-the-fact filters). May need two evenings.
   First look already seen (28 Oct, same 19 days, so NOT a fair test): no new calls 10:00-10:59 -945 -> -222 (better 14 days, worse 5)
   but NIFTY BANK's 10:00 hour is positive; first 3/5/8 calls only -636/-484/-487; no 1-minute early exit -1,218 (worse).

- 29 Oct night: the Trade Plan (idea 4, the best few calls) BUILT, mode SHADOW, branch claude/v2-trade-plan, PR open, waiting for the owner's yes.
  Rule: NIFTY 50, the first 3 calls that fire at or after 12:00 and before 15:00. Search: +928 / +79 / +1,007 (20 days, 13 up 7 down, worst -103).
  After the merge: keep score of plan=TAKE close rows in rupees every evening for 10 paper days, then the owner decides on real money.
- 29 Oct night, TESTED (wf/repeat.js, wf/count20.js): the repeat-line cuts. The same line fires up to 12 times a day; 209 of 314 NIFTY 50
  calls are repeats. Cuts tried on both halves: 1st at a line only (+182/-634), at most 2 a line, no call at a line after a loss there
  (+261/-951), no re-fire within 30/60 min (+292/-1107, +278/-779), afternoon + 1st at a line (+507/-194). NONE survives. How the calls end
  (NIFTY 50 after 8): early 176 calls -419 (+5.6 gross each: the charge machine), back 42 -1,499, retouch 46 -1,435, trail 33 +1,395,
  day end 17 +969. NIFTY BANK caps: first 1/2/3 of the day -433/-849/-992 (fewer calls = smaller loss, never a gain); first 2 after 11:00
  +3/+127 (zero). Verdict: the afternoon-3 plan stays the only honest cut; NIFTY BANK paper only.
- 29 Oct night, TESTED (wf/lines.js): the owner's thought "60% go wrong because of the fib level calculations". The same engine, the
  same 20 days, other lines in place of the Fibonacci ones: evenly spaced, round numbers, the previous day's 7 lines, 300 random shifts
  of the fib lines, 300 sets of random lines. EVERY kind of line loses 6 of 10 calls (NIFTY 50 61-65%, NIFTY BANK 62-67%; random lines
  too). The losers' share is the trade's nature (a break with a tight stop), not the line placement. Money: the fib lines are not
  special (NIFTY 50: lower quarter of random placements; NIFTY BANK: mid-pack); the best random sets look great but are luck.
  Verdict: do not touch the fib maths; the count of calls is what moves the money (the Trade Plan).
- 30 Oct, BUILT (shadow): the owner's 14 more patterns (docx + reference .py). From the merge on, wf/morepat_day.js <date> gives the
  day's signals; keep per-rule counts and the next-hour best/worst in the ledger; judge each rule on its own after ~30 trading days
  (the document's table: <10 signals keep logging; >=10 with best clearly > worst: candidate for paper with the real exits).
- 30 Oct 16:20 IST, TESTED (wf/expiry.js): queued idea 2, EXPIRY DAYS (NIFTY 50, the page as it runs, points after 8 a call, 21 saved
  days replayed, only 3 of them expiry Tuesdays: 6, 13, 27 Oct; the calls CSVs' contract column confirms the Tuesday expiry: 27 Oct, 3 Nov).
  Trade normally -775 (6 days up / 15 down). No new calls on an expiry day: -818 (worse). No new calls after 13:00 on an expiry day: -1,007
  (worse: 13 Oct made +310 after 13:00). The 3 expiry days average +14 a day against -46 on the other 18. The owner's real-money loss day,
  27 Oct: the page's NIFTY 50 close rows made Rs -2,023 for the day, and +2,426 of that came after 13:00, so the loss was in the morning.
  VERDICT: not a loss reducer; it rests on 3 days, and even those point the other way. NOT READY, nothing to build.
- 30 Oct 01:50 IST, BUILT: THE RULE BUILDER (wf/build_rules.js), the owner's main ask ("i want him to do rule building based on the data").
  Facts per Paper calls call (no lookahead): hour, side, line above/below the close, near/far line, the signal candle (colour, size), the
  move before (6 candles, in ATR), with/against the move, the day's gap, the day's range so far, nth call, the last call's result, calm/wild
  days (ATR seed vs median), weekday, place in the day's range, before/after 12:00. 1,405 rules (facts and pairs), first-half/second-half
  both ways, survivors on both halves not resting on one day. NIFTY 50: 5 survivors found 29 Oct (green + after 12:00 +286/+254; above
  the close + calm days +512/+196 on few days; near line + fell; 9 + above the close; Wed + after 12:00): all on the WATCH LIST, judged
  only on forward days (10 needed). NIFTY BANK: 0 survivors. Caution written in the prompt: with 1,405 rules on 20 days, a few survive by
  luck; the forward score is the only real test. Next facts to add (one a week): the 25 signals rules as facts, the premium's state.
- 1 Nov 10:30 IST, TESTED (wf/history25.js on the owner's two-year file, data branch history/NIFTY50_5min_2024-11-01_2026-11-01.csv:
  36,906 candles, 493 days, 4 Nov 2024 to 30 Oct 2026; 486 full days, 6 days missing the 09:15 candle, 21 Oct 2025 = the one-hour
  Muhurat session, 1 Feb 2025 and 1 Feb 2026 = Saturday/Sunday budget sessions): ALL 25 CALLS WITH SIGNALS RULES as the page runs
  them (main's newrule.js + morepat.js, prevBars = the previous 4 days, ATR seed, dayEnd), 488 days replayed, 8 points a call.
  1,637 calls (3.4 a day), won 668 (41%), +1,896 before costs, -11,200 after; days up 116 / down 369; worst day -241, best +344;
  both halves the same (-5,597 / -5,603); 22 of 24 months negative. The 11 old rules: 376 calls, +43 before costs, -2,965 after;
  the 14 new: 1,261 calls, +1,853 / -8,235. Only 3 rules positive after costs, all tiny: Rounding Bottom (14 calls +152), Rising
  Channel breakdown (19, +127), triple top (3, +44). Biggest losers: VWAP loss (169 calls, -1,346), Bearish Engulfing (200, -1,231),
  Bullish Engulfing (202, -817), double top (41, -676), falling wedge (77, -732). THE LEAK: the "reclaim" exit (Rule 1, a close back
  across the level): 463 exits, 10 won, -34 a call, -12,118 before costs; the ATR trail exits made +14,186 (1,056 exits, 59% won).
  By hour, 13:xx is the least bad (-2.9 a call); 11:xx the worst (-8.4). The 30 Oct check matches the page exactly (4 calls +177.55).
  VERDICT: as a set of calls, the Calls with Signals page loses in every season; the fault is not costs alone (barely positive before
  them) but the stop (reclaim). Nothing to make live. Outputs: ultron/history25.json, ultron/history25-calls.csv (every call).
- 1 Nov 10:50, the owner doubted ("almost impossible that nothing is working"): wf/history_each.js ran EACH of the 25 rules ALONE on the
  two years (nothing blocking it). Every rule loses after 8 a call; before costs the best are double bottom +1,925 (391 calls), engulfing
  +893 (649), VWAP +892 (615), hammer +295 (236), ascending triangle +278 (58). Two of the 14 never signal at all on 5-minute NIFTY 50
  in two years: Broadening Formation (0 signals) and Island Reversal (0 signals): their conditions do not occur intraday at this size.
  The replay reproduces the page's own evenings (27–30 Oct) call for call.
- 1 Nov 11:30 IST, TESTED (the owner: "yes start it"): THE EXIT STUDY of the Calls with Signals page on the two years (wf/exits.js:
  the page's own entries cached once a day, exactly as runDay finds them; the control reproduces history25.js to the point, 1,637 calls,
  -11,199.9). 746 variants: the first stop (the level L, the signal candle's extreme, 0.5/1/1.5/2 ATR, the closer of L and 1 ATR), the
  trail (0.5/0.75/1/1.5/2 ATR, none), a target (the pattern's own, 1/1.5/2/3 ATR, none), a time stop (3/6 candles, none), the entry
  window (from 10:00/10:30/11:00/12:00, till 13:30), no retouch, 3 losses in a row, no loss stop, 3 calls a day, a trail from the start.
  FAIR TEST first year -> second year. RESULT: 0 of 746 positive over the two years; 0 survivors. The best first-year pick (stop 0.5 ATR,
  no trail, pattern target, 6-candle time stop) still loses -3,494 then -2,169. Entry from 12:00 helps most among single changes
  (-3,869 / -3,318) but still loses. WHY (wf/aftersignal.js, 3,494 signals in the entry window, no exit at all): the index moves on
  average +0.8 points in the call's direction after 3 candles, +1.3 after 6, +1.2 after 12; up after an hour 50%, down 50%; the best
  close within the hour averages +32, the worst -30: pure noise around the entry. The 11 old rules +2.4 after an hour, the 14 new +0.7.
  Only tiny samples show more (triple top +18 over 16 signals, triple bottom +13 over 15, Bear Pennant +15 over 5). VERDICT: the
  signals carry no direction at 5 minutes on NIFTY 50; no exit, window or limit can make them pay; the exit study is CLOSED. Advice
  given: the Signals page stays a page of signals; the Paper calls engine is the one to test on the two years next (needs the
  1-minute candles for its early exit: the Download button with Candles = 1 minute, Save on GitHub).
- 1 Nov 12:10 IST, TESTED (the owner: "yes"): THE PAPER CALLS PAGE ON THE TWO YEARS (wf/history_paper.js: Rules.replayDay as the page runs
  NIFTY 50, the previous close's lines, 5 min, both signals, the owner's 1-minute file for the early exit (184,554 rows, 493 days, 375 a
  day), the previous 4 days' ATR seed; the 30 Oct check equals the page's CSV call for call, +310.10). 491 days, 5,799 calls (11.8 a day),
  won 30%, +703 before costs, -45,689 after 8 a call; days up 101 / down 390; first year -22,312, second -23,376; worst day -604, best +793;
  only 0 of 24 months positive for the page. The Trade Plan's TAKE calls: 1,262 calls, -7,975 (130/333 days); its only positive months are
  Feb 2025 +154, Apr 2025 +157 and Oct 2026 +919 (the month it was found on: in-sample luck). The Loss Cutter's TAKE calls -23,148; the
  builder's KEEP calls -17,876. By exit: "back" 1,004 calls -19,279 gross, "retouch" 1,058 calls -21,022 gross, the 1-minute early exit
  2,682 calls -785 gross (-22,241 after costs), the trail 601 calls +29,274, day end 454 calls +12,516. By hour: 09:xx and 10:xx lose
  -10,513 and -9,840; 12:xx and 13:xx are positive before costs (+1,750, +1,465) but not after. By line: every line negative after costs.
  VERDICT: the Paper calls engine, as it runs, loses in every month of the two years; the 20-day picture (Oct 2026) that looked workable
  for the Plan was that month alone. Nothing to make live. Outputs: ultron/history_paper.json, ultron/history_paper-calls.csv.
- 1 Nov 12:30 IST, TESTED (the owner: "do you think the current fib lines are causing the problem?"): wf/lines2y.js, the 29 Oct line test
  on the TWO YEARS (the page's engine, the 1-minute early exit, only the lines change): Fibonacci as live 5,742 calls -45,534 (70% lost);
  never redrawn -42,656; 13 even lines -39,350; round 50s -61,586 (7,553 calls); the previous day's 7 lines -28,865 (4,266 calls);
  Fibonacci twice as far apart -19,820 (2,614 calls); half as far -64,482 (9,236 calls); only 3 lines (close, +1%, -1%) -16,752 (2,391
  calls); 30 random shifts: -45,066 to -36,344; 30 random 12-line sets: -43,083 to -31,791. Every placement loses 65–74% of its calls and
  about 7 to 8 points a call, i.e. the cost: the loss is proportional to the NUMBER of calls, whatever the lines. The Fibonacci lines are
  a little worse than random lines (0 of 60 random sets worse than live), not the cause. VERDICT: the lines are not the problem; a
  5-minute close across any line carries no direction, so every call costs its 8 points.
- 2 Nov 16:20 IST, CHECK of the rule builder out of sample (history_paper: the builder's marks on the owner's two years): on the 23 months
  BEFORE Oct 2026 (never seen when the five rules were found on 29 Oct) the KEEP calls are 2,580 calls, -19,129 after 8 a call (115 days
  up / 331 down); the SKIP calls -25,890; all calls -45,018; the Trade Plan's TAKE -8,895. KEEP is less bad than SKIP per call
  (-7.4 against -8.9) but it loses; nothing the builder found survives the two years. The builder's candidates (16 on the list, none with
  10 forward days) rest on the 20 days they were found on. Nothing is READY; the 10 forward days stay the real test, the two years the
  second one. Told the owner earlier (1 Nov) that the Plan and builder lose over two years; no new message tonight.
- 3 Nov 16:30 IST, TESTED (queued idea 3, "at most N calls a day" and "stop for the day once the closed calls are down X"): wf/capcalls.js, the
  Paper calls page on the owner's TWO YEARS (491 days, 5,799 calls; wf/history_paper.js engine; points after 8 a call; a cap or stop only SKIPS
  later calls using what is known when the call fires; X = 1 and 2 x the day's ATR seed). Every call: -45,689 (days 101 up / 390 down, worst day
  -604). First 3 a day: 1,456 calls -13,873 (136/355, worst -235); first 5: 2,373 calls -22,530 (124/367); first 8: 3,554 calls -30,540 (122/369);
  stop at -1 ATR: 1,555 calls -13,361 (40/451, worst -154); stop at -2 ATR: 2,076 calls -18,987; stop at -1 ATR and at most 5: 1,145 calls -11,023
  (70/421, worst -151). Better than "every call" on 257 to 377 of 491 days, but per call it is WORSE (-8.6 to -9.6 against -7.9): the saving is
  only the calls not taken (each costs about 8 points); both halves and the last 20 days stay negative (-370 for the -1 ATR + 5 rule against
  -670). It does not clear the bar (days down far outnumber days up; nothing turns positive). It does what the owner asked in the narrow sense
  (a smaller worst day, a smaller loss), by trading less, not by finding better calls. Not a candidate; no message tonight. Output:
  ultron/capcalls.json, ultron/capcalls.out.

## 12 Nov — owner's question: does a big price-VWAP gap get filled? (study only, wf/vwap_gap.js, NIFTY 50 5m, 495 days 11 Nov 2024 - 9 Nov 2026)
Back to VWAP within 1 hour / by day end: gap>=1 ATR 58% / 85% (1,451 times); >=1.5 ATR 45% / 78% (980); >=2 ATR 33% / 70% (689); >=3 ATR 13% / 53% (363).
Fade (bet on the return, out at VWAP or after 1 hour, 8 pts costs): -12,637 / -8,548 / -6,588 / -5,333 pts; negative in both years, more days down than up. With the move for 1 hour: also negative (-10,930 / -6,365 / -4,367 / -517). Verdict: no rule in either direction; not a candidate.
12 Nov, owner: "develop something out of this observation". (a) Snap-back search wf/vwap_snap.js: stretch G ATR + a turn candle (3 kinds) + stop at the extreme + target VWAP or 60%, 4 time windows: 192 settings, ZERO positive in the first year (best -109), all worse in the second. Dead.
(b) Trend side wf/vwap_trend.js: first close >= G ATR from VWAP, with the move, exits VWAP-cross / trail 1.5, 2.5, 4 ATR: 200 settings, 36 positive in year 1, 34 in both, but only 3 with >= 15 calls a year: gap >= 4 ATR + trail 1.5 ATR: +299 / +232 (about +3 a call, ~100 calls a year), won 36-43%, days up 36-44 vs down 56-63, best 3 days carry it (677 of 299): fails the bar (more days down than up, rests on a few days). Not a rule.
Offered instead: a display-only "VWAP stretch meter" on the Calls with Signals chart (gap in ATR + the owner's own two-year odds of a return within 1 hour / by day end). Waiting for yes/no.

## 15 Nov 2026: the strategy lab (strat/lab.js), found-on date 15 Nov 2026 for all three below
The owner: "I need better and advanced new strategies which will work better and gives better calls CE and PE".
394 variants of 7 price-only ideas on the 2-year NIFTY 50 5m file (year 1 to find, year 2 to judge, 8 a call): 26 good in year 1,
5 of them good in year 2. Opening range break, trend pullback, yesterday's high/low break, stretch-and-snap-back: all failed year 2.
Watch forward (new days only, after 15 Nov) with strat/lab.js's engine; never re-tune:
 A. QUIET: yesterday's range < 0.8 x the 10-day average range; first 15 minutes' high/low; a close beyond it by 13:30 -> call,
    stop the range's far side, out 15:15, any number. Y1 102 calls +551 (35/42 days), Y2 86 calls +1794 (47/26), Y2 CE -124 PE +1919.
 B. DON: close above the last 12 candles' high (below the low) with EMA20 over (under) EMA50, 09:45-14:00, stop trailing 5 ATR, max 3
    a day. Y1 245 +502, Y2 269 +1343 (CE -816, PE +2159).
 C. DIR 12:15: at 12:15, day moved > 0.3 x average range from the open, same way as the opening gap -> go with it, stop 0.25 range,
    out 15:15. Y1 61 +1088, Y2 64 +293.
Warning: in year 2 nearly all profit is on the PE side (a falling market); none is proven. The evening adds these to the daily table
(write strat/watch.js on the saved sessions the first evening) and speaks only when one is READY on new days.

## 16 Nov 2026 (strategy lab, day 1). Variants ever tried: 466
- Fixed the research years (year 1 to 2025-11-10, year 2 to 2026-11-09): a split by the middle moved with each new day. Results as on 15 Nov again (26 good in year 1, 5 held).
- Idea 8 EDGE (from today's Volume Profile day, where the value area's edges turned price five times): the day's own time-at-price
  value area so far; a green candle dips to its low and closes back above -> CE; a red one touches its high and closes back below -> PE.
  72 variants (from 10:15/11:15/12:15, stop 0.5/1.5 ATR, target none/1.5R/3R, wide area or any, 2 or 4 a day): 0 good in year 1. Dropped.
  Lesson: one day's picture is not a rule; without volume the edges give nothing on 2 years.
- Watch list, new day 1 (16 Nov): QUIET-BREAK 1 call -128 (CE, bought the break of the first 15 minutes, stopped at the far side);
  NEWHIGH-TREND 1 call -44; DIR-1215 no call.

## 16 Nov night: idea 9 NOON (from the two-year profile study, done on ULTROAN's own initiative). Variants ever tried: 562
At 11:30/12:00/12:30/13:00, the day's profile so far (page code, by time): close above VAH -> CE, below VAL -> PE (optionally only
with the shape agreeing), stop POC / middle / 2 ATR, out 15:15. 48 variants (strat/noonnb.js shows all, both years).
Year 1: 46 of 48 lose or are flat. Year 2: 12:30 wins well (86 calls +2,648 to +2,926, CE and PE both positive), every other time
is small or negative. Verdict: a one-time-of-day, one-year effect; NOT on the watch list. The tendency is real (noon outside
the value area closes outside 67-69%), but after 8 points a call it does not pay on year 1. Re-test on the volume days.
