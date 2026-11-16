"""The daily write of the past futures volume (main.volume_history_once): one file per index on the data branch, the eight
columns of the "Candles with volume" download, and a refusal kept for /health without stopping the others.
python3 lab/check_volume_history.py"""
import os, sys
from datetime import date, datetime, timedelta, timezone
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import dhan, main, record  # noqa: E402

IST = timezone(timedelta(hours=5, minutes=30))
t0 = int(datetime(2026, 11, 13, 9, 15, tzinfo=IST).timestamp())
pushed, ok = {}, True
def check(what, cond):
    global ok
    ok = ok and bool(cond)
    print(("ok   " if cond else "FAIL ") + what)

def fh(name, size, first, last):
    if name == "SENSEX":
        raise dhan.DhanError("other", "no futures contract")
    return {"contract": {"name": name + " NOV FUT", "expiry": "2026-11-23"}, "bars": [[t0 + i * 60, 10 + i] for i in range(375)], "stopped": None}
dhan.future_history = fh
dhan.history = lambda name, size, first, last: [{"time": t0 + i * 60, "open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5} for i in range(375)]
record.push_bytes = lambda rel, data, message: pushed.__setitem__(rel, data.decode())
main.volume_history_once(date(2026, 11, 16))
f = pushed.get("history/volume/NIFTY50_1min.csv", "")
check("NIFTY 50: written to history/volume/NIFTY50_1min.csv", f)
check("the download's eight columns", f.splitlines()[0] == "Date,Time,Open,High,Low,Close,Volume,Contract")
check("375 minutes, each with its volume and contract", len(f.splitlines()) == 376 and f.splitlines()[1] == "2026-11-13,09:15,1.00,2.00,0.50,1.50,10,NIFTY 50 NOV FUT (2026-11-23)")
check("NIFTY BANK written too", "history/volume/NIFTYBANK_1min.csv" in pushed)
check("SENSEX refused: nothing written, the reason kept for /health", "history/volume/SENSEX_1min.csv" not in pushed and main.VOLUME_HISTORY["SENSEX"]["problem"] == "no futures contract")
check("/health record for NIFTY 50", main.VOLUME_HISTORY["NIFTY 50"]["ok"] and main.VOLUME_HISTORY["NIFTY 50"]["first_day"] == "2026-11-13" and main.VOLUME_HISTORY["NIFTY 50"]["with_volume"] == 375)
print("all fine" if ok else "SOMETHING FAILED"); sys.exit(0 if ok else 1)
