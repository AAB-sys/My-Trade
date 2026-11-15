"""The past volume's download (15 November, the owner: "I want to download the volume data from the past for the Nifty 50 ...
the same way you did it before for the candles data"). No network: dhan.call and the instrument list are stand-ins, and
dhan.future_history's answer is compared with what it should be.
    python3 lab/check_volume_download.py        (from the repo's folder)"""
import os, sys
from datetime import date, datetime, timedelta
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import dhan

bad = 0
def check(what, got, want):
    global bad
    ok = got == want
    bad += not ok
    print(("ok    " if ok else "WRONG ") + what + ("" if ok else f": got {got}, wanted {want}"))

at = lambda day, h, m: int(datetime(day.year, day.month, day.day, h, m, tzinfo=dhan.IST).timestamp())
last = date(2026, 11, 12)
listed = date(2026, 8, 27)  # the made-up contract's first day of trade
days = [listed + timedelta(days=n) for n in range((last - listed).days + 1) if (listed + timedelta(days=n)).weekday() < 5]
book = {at(d, 9, 15): 1000 + i for i, d in enumerate(days)}
book.update({at(d, 15, 25): 7 for d in days})
book[at(last, 18, 0)] = 99999  # outside market hours: never in the file

def run(first, mode="empty"):
    asked = []
    saved = (dhan.call, dhan.option_ids, dict(dhan._futures))
    def fake_call(method, path, payload=None, *a, **kw):
        assert path == "/charts/intraday" and payload["instrument"] == "FUTIDX" and payload["securityId"] == "777", (path, payload)
        a0, z0 = date.fromisoformat(payload["fromDate"][:10]), date.fromisoformat(payload["toDate"][:10])
        asked.append((a0, z0))
        if mode == "refuse all" or (mode == "refuse old" and z0 < listed):
            raise dhan.DhanError("other", "DH-905 no data for these dates")
        ts = sorted(t for t in book if a0 <= datetime.fromtimestamp(t, dhan.IST).date() <= z0)
        return {"data": {"timestamp": ts, "volume": [book[t] for t in ts], "open": [1] * len(ts), "high": [1] * len(ts), "low": [1] * len(ts), "close": [1] * len(ts)}}
    dhan.call, dhan.option_ids = fake_call, (lambda: {})
    dhan._futures.clear(); dhan._futures["NIFTY"] = [("2099-11-24", 777, "NIFTY NOV FUT")]
    try:
        return dhan.future_history("NIFTY 50", 5, first, last), asked
    except dhan.DhanError as exc:
        return exc, asked
    finally:
        dhan.call, dhan.option_ids = saved[0], saved[1]
        dhan._futures.clear(); dhan._futures.update(saved[2])

want = sorted([t, v] for t, v in book.items() if t != at(last, 18, 0))
got, asked = run(date(2024, 11, 15))
check("two years asked: every candle the contract traded comes, oldest first, market hours only", got["bars"], want)
check("the contract is named", got["contract"], {"name": "NIFTY NOV FUT", "expiry": "2099-11-24"})
check("the walk goes newest first in pieces of 90 days and stops at the first empty piece", (asked[0][1] >= last, len(asked), got["stopped"] is not None), (True, 2, True))
got, asked = run(date(2024, 11, 15), "refuse old")
check("Dhan refusing the older piece ends the walk and keeps what came", (got["bars"], "DH-905" in (got["stopped"] or "")), (want, True))
got, asked = run(date(2026, 11, 2))
check("a short span inside the contract's life: one request, the whole span, not stopped", (len(asked), got["bars"] == [x for x in want if datetime.fromtimestamp(x[0], dhan.IST).date() >= date(2026, 11, 2)], got["stopped"]), (1, True, None))
got, asked = run(date(2026, 11, 2), "refuse all")
check("Dhan refusing the newest piece: the refusal goes to the owner", isinstance(got, dhan.DhanError) and "DH-905" in got.message, True)
saved = dict(dhan._futures); opt = dhan.option_ids
dhan._futures.clear(); dhan.option_ids = lambda: {}
try:
    dhan.future_history("NIFTY 50", 5, date(2026, 11, 2), last); none = "no error"
except dhan.DhanError as exc:
    none = exc.message
dhan._futures.update(saved); dhan.option_ids = opt
check("no futures contract in Dhan's list: said so", "no NIFTY futures contract" in none, True)
print("\nALL GOOD" if not bad else f"\n{bad} WRONG")
sys.exit(1 if bad else 0)
