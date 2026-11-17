"""panel_replay.py - replay a past day through the panel, candle by candle.

CSV columns: Date,Time,Open,High,Low,Close and optionally Volume (and OI).
  python panel_replay.py data.csv 2026-11-11                 every update and every alert
  python panel_replay.py data.csv 2026-11-11 --at 10:00 11:30 full panel at those times
  python panel_replay.py data.csv 2026-11-11 --json 10:00    raw JSON output at that time
"""
import argparse, csv, json
from collections import OrderedDict
from panel_engine import PanelEngine, load_config, previous_levels, render_text, mins


def load(path):
    days = OrderedDict()
    for r in csv.DictReader(open(path)):
        c = {"hm": r["Time"][:5], "o": float(r["Open"]), "h": float(r["High"]), "l": float(r["Low"]),
             "c": float(r["Close"]), "v": float(r["Volume"]) if r.get("Volume") not in (None, "") else None}
        if r.get("OI") not in (None, ""):
            c["oi"] = float(r["OI"])
        days.setdefault(r["Date"], []).append(c)
    return days


def full_session(candles, cfg, interval):
    expected = (mins(cfg["session_end"]) - mins(cfg["session_start"])) // interval
    return candles[0]["hm"] == cfg["session_start"] and len(candles) >= 0.9 * expected


def run(path, date, interval=None, cfg=None):
    cfg = cfg or load_config()
    days = load(path)
    if date not in days:
        raise SystemExit("date not in file")
    today = days[date]
    if interval is None:
        interval = mins(today[1]["hm"]) - mins(today[0]["hm"])
    prev = None
    for d, c in days.items():                      # last FULL session before `date`
        if d >= date:
            break
        if full_session(c, cfg, interval):
            prev = previous_levels(c, cfg)
    eng = PanelEngine(cfg, prev, date, interval)
    outs = []
    for i in range(len(today)):
        oi = today[i].get("oi")
        outs.append(eng.update(today[:i + 1], oi_now=oi))
    return outs, prev


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv"); ap.add_argument("date")
    ap.add_argument("--at", nargs="*"); ap.add_argument("--json")
    a = ap.parse_args()
    outs, prev = run(a.csv, a.date)
    print("Yesterday's levels:", {k: round(v, 2) for k, v in (prev or {}).items()})
    if a.json:
        o = [x for x in outs if x["time"] == a.json][0]
        print(json.dumps(o, indent=2, default=str)); return
    for o in outs:
        if a.at:
            if o["time"] in a.at:
                print(render_text(o)); print()
        else:
            print("%s  %-20s %-22s score %+d  price %.2f" % (o["time"], o["label"], o["shape"]["shown"], o["score"], o["price"]))
            for al in o["alerts"]:
                print("      ALERT " + al["text"])


if __name__ == "__main__":
    main()
