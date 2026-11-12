"""The tick count of /health (12 November: "Check the sensex data update for live feed. It is not as fast as Nifty 50"). No network:
ticks are handed to main.note_tick_rate with made-up times and the report is compared with what it should be.
    python3 lab/check_tick_rate.py        (from the repo's folder)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import main

bad = 0
def check(what, got, want):
    global bad
    ok = got == want
    bad += not ok
    print(("ok    " if ok else "WRONG ") + what + ("" if ok else f": got {got}, wanted {want}"))

T = 1794300000 // 60 * 60  # the start of a clock minute
main.tick_rate.clear()
check("nothing yet: an empty report", main.tick_rate_report(), {})
for k in range(120):                      # NIFTY 50: two ticks a second for a minute, every one a new price
    main.note_tick_rate("NIFTY 50", 25000 + k, T + k * 0.5, "stream")
for k, price in enumerate([81000, 81000, 81005, 81005, 81010, 81010]):  # SENSEX: one tick every ten seconds, half of them the same price
    main.note_tick_rate("SENSEX", price, T + k * 10, "stream")
r = main.tick_rate_report()
check("the minute running now: ticks, changes, the longest wait", [r["NIFTY 50"]["this_minute"][k] for k in ("ticks", "changes", "longest_gap_s", "via")], [120, 120, 0.5, "stream"])
check("a slower index shows as fewer ticks and a longer wait", [r["SENSEX"]["this_minute"][k] for k in ("ticks", "changes", "longest_gap_s")], [6, 3, 10.0])
check("no full minute yet", (r["NIFTY 50"]["last_minute"], r["SENSEX"]["last_minute"]), (None, None))
main.note_tick_rate("NIFTY 50", 25200, T + 61, "stream")   # the next minute begins
main.note_tick_rate("SENSEX", 81010, T + 75, "poll")
r = main.tick_rate_report()
check("the minute before is kept whole", [r["NIFTY 50"]["last_minute"][k] for k in ("ticks", "changes", "longest_gap_s")], [120, 120, 0.5])
check("the wait across the minute's edge counts in the new minute", (r["NIFTY 50"]["this_minute"]["ticks"], r["NIFTY 50"]["this_minute"]["longest_gap_s"], r["SENSEX"]["this_minute"]["longest_gap_s"]), (1, 1.5, 25.0))
check("the same price again is a tick, not a change; the way it came is said", (r["SENSEX"]["this_minute"]["changes"], r["SENSEX"]["this_minute"]["via"], r["SENSEX"]["last_minute"]["via"]), (0, "poll", "stream"))
check("the minute is written as HH:MM IST", len(r["NIFTY 50"]["last_minute"]["minute"]) == 5 and r["NIFTY 50"]["last_minute"]["minute"][2] == ":", True)
main.tick_rate.clear(); main.live.clear()
main.fold_tick("NIFTY 50", 25000.0, T, "stream"); main.fold_tick("NIFTY 50", 25001.0, T + 1, "stream")
check("every tick folded into the candles is counted", main.tick_rate_report()["NIFTY 50"]["this_minute"]["ticks"], 2)
check("the count is in the feed's state for /health", "tick_rate" in main.feed_state(), True)
main.tick_rate.clear(); main.live.clear()
print("\n" + (f"{bad} WRONG" if bad else "all fine"))
sys.exit(1 if bad else 0)
