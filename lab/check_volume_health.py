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

# ---- the contract's roll before expiry (15 November, the owner's fine-tuning list, point 4)
def roll(days_to_expiry, near_bars, next_bars, next_fails=False):
    saved = (dhan.call, dhan.option_ids, dict(dhan._futures))
    dhan._cache.clear()
    asked = []
    def fake_call(method, path, payload=None, *a, **kw):
        asked.append(payload["securityId"])
        if payload["securityId"] == "2" and next_fails:
            raise dhan.DhanError("other", "DH-905 refused")
        rows = near_bars if payload["securityId"] == "1" else next_bars
        return {"data": {"timestamp": [t for t, _ in rows], "volume": [v for _, v in rows], "open": [1] * len(rows), "high": [1] * len(rows), "low": [1] * len(rows), "close": [1] * len(rows)}}
    dhan.call, dhan.option_ids = fake_call, (lambda: {})
    dhan._futures.clear()
    dhan._futures.update({"NIFTY": [((today + timedelta(days=days_to_expiry)).isoformat(), 1, "NIFTY NOV FUT"), ((today + timedelta(days=days_to_expiry + 30)).isoformat(), 2, "NIFTY DEC FUT")]})
    try:
        return dhan.future_volume("NIFTY 50", 5), asked
    finally:
        dhan.call, dhan.option_ids = saved[0], saved[1]
        dhan._futures.clear(); dhan._futures.update(saved[2])
        dhan._cache.clear()

two = today - timedelta(days=2)
near = [[at(two, 9, 15), 900], [at(yesterday, 9, 15), 400], [at(today, 9, 15), 100]]
nxt = [[at(two, 9, 15), 300], [at(yesterday, 9, 15), 600], [at(today, 9, 15), 800]]
got, asked = roll(20, near, nxt)
check("far from expiry: the nearest contract alone, the next one is not even asked for", (got["contract"]["name"], got["bars"], asked.count("2"), got["rolled"]), ("NIFTY NOV FUT", near, 0, None))
got, asked = roll(3, near, nxt)
check("inside the last 5 days: each day takes the contract that traded more that day", (got["bars"], got["contract"]["name"]), ([near[0], nxt[1], nxt[2]], "NIFTY DEC FUT"))
check("and the page is told in words", "NIFTY DEC FUT traded more than NIFTY NOV FUT on 2 days" in (got["rolled"] or ""), True)
got, asked = roll(3, near, [[at(two, 9, 15), 300], [at(yesterday, 9, 15), 100], [at(today, 9, 15), 50]])
check("inside the last 5 days but the nearest one still trades more: it stays, nothing is said", (got["bars"], got["contract"]["name"], got["rolled"]), (near, "NIFTY NOV FUT", None))
got, asked = roll(0, near, nxt, next_fails=True)
check("the next contract cannot be read: the nearest one alone, no failure", (got["bars"], got["contract"]["name"]), (near, "NIFTY NOV FUT"))
check("a tie keeps the nearest contract", dhan.roll_volume([[at(today, 9, 15), 500]], [[at(today, 9, 15), 500]])[1], {today.isoformat(): "near"})

print("\n" + ("all fine" if not bad else f"{bad} WRONG"))
sys.exit(1 if bad else 0)
