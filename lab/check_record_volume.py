"""The day's save keeps the futures' volume per minute, and a refusal of the volume never loses the candles.
python3 lab/check_record_volume.py"""
import os, sys
from datetime import date, datetime, timedelta, timezone
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import dhan, record  # noqa: E402

IST = timezone(timedelta(hours=5, minutes=30))
DAY = date(2026, 11, 13)
start = int(datetime(2026, 11, 13, 9, 15, tzinfo=IST).timestamp())
before = int(datetime(2026, 11, 12, 9, 15, tzinfo=IST).timestamp())
bars = lambda t0, n, step: [{"time": t0 + i * step, "open": 100.0, "high": 101.0, "low": 99.0, "close": 100.5} for i in range(n)]
dhan.intraday = lambda name, minutes: bars(before, 375 // minutes, minutes * 60) + bars(start, 375 // minutes, minutes * 60)
dhan.intraday_problem = lambda name: None
dhan.daily_or_saved = lambda name: []
ok = True
def check(what, cond):
    global ok
    ok = ok and bool(cond)
    print(("ok   " if cond else "FAIL ") + what)

dhan.future_volume = lambda name, minutes, days_back=8: {"contract": {"name": "X FUT", "expiry": "2026-11-23"}, "rolled": None,
                                                         "bars": [[before + i * 60, 5] for i in range(375)] + [[start + i * 60, 7 + i] for i in range(375)]}
data = record.build_day(DAY, True)
for name in dhan.QUOTE_IDS:
    v = data["indices"][name].get("volume")
    check(f"{name}: the day's 375 minutes of volume are saved, and only that day's", v and len(v["1m"]) == 375 and v["1m"][0] == [start, 7] and v["contract"]["name"] == "X FUT")
    check(f"{name}: the candles are as before", len(data["indices"][name]["candles"]["1m"]) == 375)
def refuse(name, minutes, days_back=8):
    raise dhan.DhanError("other", "no futures contract")
dhan.future_volume = refuse
data = record.build_day(DAY, True)
check("the volume refused: the day is still built, without a volume part", all("volume" not in data["indices"][n] and len(data["indices"][n]["candles"]["1m"]) == 375 for n in data["indices"]))
dhan.future_volume = lambda name, minutes, days_back=8: {"contract": {"name": "X FUT", "expiry": "2026-11-23"}, "bars": [[before, 5]], "rolled": None}
data = record.build_day(DAY, True)
check("no volume for that day: no empty volume part", all("volume" not in data["indices"][n] for n in data["indices"]))
print("all fine" if ok else "SOMETHING FAILED"); sys.exit(0 if ok else 1)
