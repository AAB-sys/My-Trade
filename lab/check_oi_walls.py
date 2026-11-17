"""The OI walls kept for the research: the two strikes are the page's two, the day's looks are kept and saved with the day,
and a failure never loses the candles. python3 lab/check_oi_walls.py"""
import os, sys, time
from datetime import date, datetime, timedelta, timezone
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import dhan, record  # noqa: E402

ok = True
def check(what, cond):
    global ok
    ok = ok and bool(cond)
    print(("ok   " if cond else "FAIL ") + what)

F = ["strike", "ce_oi", "ce_x", "pe_oi"]
rows = [[25300, 900, 0, 500], [25400, 100, 0, 800], [25450, 300, 0, 800], [25500, 700, 0, 50], [25600, 700, 0, 10], [25700, 200, 0, None]]
w = dhan.oi_walls({"underlying": 25460.0, "fields": F, "rows": rows, "expiry": "2026-11-24", "pcr": 0.9})
check("the Call wall is the biggest Call OI at or above the index, the nearer strike on a tie", w["call"] == [25500, 700])
check("the Put wall is the biggest Put OI at or below the index, the nearer strike on a tie", w["put"] == [25450, 800])
check("a strike below the index is never the Call wall, however big", w["call"][0] != 25300)
check("the biggest five of each side are kept, biggest first", w["calls"] == [[25500, 700], [25600, 700], [25700, 200]] and w["puts"] == [[25400, 800], [25450, 800], [25300, 500]])
check("no index level: no look", dhan.oi_walls({"underlying": None, "fields": F, "rows": rows}) is None)
check("a chain without OI fields: no look", dhan.oi_walls({"underlying": 25460.0, "fields": ["strike"], "rows": rows}) is None)
at = dhan.oi_walls({"underlying": 25500.0, "fields": F, "rows": rows})
check("the index exactly on a strike: that strike counts on both sides", at["call"] == [25500, 700] and at["put"][0] <= 25500)

# the day's looks
dhan.chain_table = lambda name, expiry=None: {"name": name, "underlying": 25460.0, "fields": F, "rows": rows, "expiry": "2026-11-24", "pcr": 0.9}
dhan.OI_SNAPS.clear()
IST = timezone(timedelta(hours=5, minutes=30))
today = dhan.today_ist()
dhan.OI_SNAPS["NIFTY 50"] = [{"time": int(time.time()) - 3 * 86400, "call": [1, 1], "put": [1, 1]}]  # a look of an older day
a = dhan.oi_look("NIFTY 50"); b = dhan.oi_look("NIFTY 50")
check("each look is kept, and an older day's looks are dropped", len(dhan.oi_day("NIFTY 50", today)) == 2 and len(dhan.OI_SNAPS["NIFTY 50"]) == 2)
check("another day has none", dhan.oi_day("NIFTY 50", today - timedelta(days=1)) == [])
rep = dhan.oi_report()
check("/health: looks today and the last walls", rep["NIFTY 50"]["looks"] == 2 and rep["NIFTY 50"]["call"] == [25500, 700])

# the day's save carries them, and a failure never loses the candles
start = int(datetime(today.year, today.month, today.day, 9, 15, tzinfo=IST).timestamp())
bars = lambda t0, n, step: [{"time": t0 + i * step, "open": 100.0, "high": 101.0, "low": 99.0, "close": 100.5} for i in range(n)]
dhan.intraday = lambda name, minutes: bars(start - 86400, 375 // minutes, minutes * 60) + bars(start, 375 // minutes, minutes * 60)
dhan.intraday_problem = lambda name: None
dhan.daily_or_saved = lambda name: []
dhan.future_volume = lambda name, minutes, days_back=8: {"contract": {"name": "X FUT", "expiry": "2026-11-23"}, "rolled": None, "bars": [[start + i * 60, 7] for i in range(375)]}
data = record.build_day(today, True)
check("the day's save carries NIFTY 50's two looks", len(data["indices"]["NIFTY 50"].get("oi_walls") or []) == 2)
others = [n for n in data["indices"] if n != "NIFTY 50"]
check("an index with no look has no oi_walls key, and its candles are saved", others and all("oi_walls" not in data["indices"][n] and len(data["indices"][n]["candles"]["1m"]) == 375 for n in others))
def boom(name, day):
    raise RuntimeError("broken")
dhan.oi_day = boom
data = record.build_day(today, True)
check("a failure reading the looks never loses the candles or the volume", all(len(x["candles"]["1m"]) == 375 and x.get("volume") for x in data["indices"].values()))
print("\nall fine" if ok else "\nSOMETHING FAILED")
sys.exit(0 if ok else 1)
