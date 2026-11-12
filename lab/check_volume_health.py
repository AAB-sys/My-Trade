"""The Volume Profile page's check in /health (13 November, the owner: "yes add that check"). No network: dhan.call and the
instrument list are stand-ins, and dhan.volume_check's finding is compared with what it should be.
    python3 lab/check_volume_health.py        (from the repo's folder)"""
import os, sys
from datetime import datetime, timedelta
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import dhan

bad = 0
def check(what, got, want):
    global bad
    ok = got == want
    bad += not ok
    print(("ok    " if ok else "WRONG ") + what + ("" if ok else f": got {got}, wanted {want}"))

today = dhan.today_ist()
at = lambda day, h, m: int(datetime(day.year, day.month, day.day, h, m, tzinfo=dhan.IST).timestamp())
yesterday = today - timedelta(days=1)
answer = {"timestamp": [at(yesterday, 15, 25), at(today, 9, 15), at(today, 9, 20), at(today, 18, 45)], "volume": [500, 1200, 800, 9999],
          "open": [1] * 4, "high": [1] * 4, "low": [1] * 4, "close": [1] * 4}

def run(name, reply, futures=True):
    saved = (dhan.call, dhan.option_ids, dict(dhan._futures))
    dhan._cache.clear()
    def fake_call(method, path, payload=None, *a, **kw):
        assert path == "/charts/intraday" and payload["instrument"] == "FUTIDX", (path, payload)
        if isinstance(reply, Exception):
            raise reply
        return {"data": reply}
    dhan.call, dhan.option_ids = fake_call, (lambda: {})
    dhan._futures.clear()
    if futures:
        dhan._futures.update({"NIFTY": [((today + timedelta(days=10)).isoformat(), 35001, "NIFTY NOV FUT")]})
    try:
        return dhan.volume_check(name)
    finally:
        dhan.call, dhan.option_ids = saved[0], saved[1]
        dhan._futures.clear(); dhan._futures.update(saved[2])

r = run("NIFTY 50", answer)
check("volume comes: ok, the contract named, no problem", (r["ok"], r["contract"].startswith("NIFTY NOV FUT ("), r["problem"]), (True, True, None))
check("the candles inside market hours are counted (the 18:45 one is not)", r["candles"], 3)
check("the last candle's time", r["last_candle"][11:16], "09:20")
check("today's volume is today's candles only", r["today_volume"], 2000)
check("the finding is kept for /health", dhan.volume_report()["NIFTY 50"]["today_volume"], 2000)

r = run("NIFTY 50", {"timestamp": [], "volume": [], "open": [], "high": [], "low": [], "close": []})
check("an empty answer: not ok, said in words", (r["ok"], r["problem"]), (False, "Dhan answered with no candle of volume"))

r = run("NIFTY 50", dhan.DhanError("subscription", "the Data API is not subscribed"))
check("Dhan refuses: not ok, Dhan's reason kept, nothing raised", (r["ok"], r["problem"]), (False, "the Data API is not subscribed"))

r = run("NIFTY 50", answer, futures=False)
check("no futures contract in the instrument list: not ok, said in words", (r["ok"], "no NIFTY futures contract" in r["problem"]), (False, True))

r = run("NIFTY 50", RuntimeError("boom"))
check("anything unexpected: not ok, never raised", (r["ok"], r["problem"]), (False, "RuntimeError: boom"))

print("\n" + ("all fine" if not bad else f"{bad} WRONG"))
sys.exit(1 if bad else 0)
