"""vp_cli.py - run the logic on a CSV of 5-minute candles.
CSV columns: Date,Time,Open,High,Low,Close and optionally Volume.

  python vp_cli.py levels data.csv 2026-10-30      levels to use on that date (from the session before)
  python vp_cli.py signal data.csv 2026-10-30      CE / PE / WAIT for that date
  python vp_cli.py signal data.csv 2026-10-30 --premium 110 --lot-size 75    adds lot sizing
"""
import argparse, csv, json, os
from collections import OrderedDict
from profile import build_profile, update_naked_pocs
from vp_signal import find_signal, size_trade

CFG = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "vp_config.json")))


def load(path):
    days = OrderedDict()
    for r in csv.DictReader(open(path)):
        c = {"hm": r["Time"][:5], "o": float(r["Open"]), "h": float(r["High"]), "l": float(r["Low"]), "c": float(r["Close"])}
        if r.get("Volume"):
            c["v"] = float(r["Volume"])
        days.setdefault(r["Date"], []).append(c)
    return days


def prepare(days, date):
    """Yesterday's profile plus the naked POC list, as they stood before `date` opened."""
    naked, prev = [], None
    for d, candles in days.items():
        if d >= date:
            break
        prev = build_profile(candles, CFG["bin_size_pts"], CFG["value_area_pct"])
        naked = update_naked_pocs(naked, d, candles, prev, CFG["naked_poc_max_age_days"])
    return prev, naked


def main():
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["levels", "signal"]); p.add_argument("csv"); p.add_argument("date")
    p.add_argument("--premium", type=float); p.add_argument("--lot-size", type=int, default=0)
    a = p.parse_args()
    days = load(a.csv)
    prev, naked = prepare(days, a.date)
    if prev is None:
        raise SystemExit("Need at least one earlier session in the file")
    if a.cmd == "levels":
        print(json.dumps({"previous_session": prev, "naked_pocs": naked}, indent=2)); return
    out = find_signal(days[a.date], prev, CFG, naked)
    if out["signal"] != "WAIT" and a.premium:
        out["sizing"] = size_trade(a.premium, out["risk_pts"], a.lot_size, CFG)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
