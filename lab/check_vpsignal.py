"""The Volume Profile page's signal (vpsignal.py over the owner's document's code in vp/). No network.
    python3 lab/check_vpsignal.py        (from the repo's folder)
1. the document's own 12 tests; 2. vpsignal against the document's command line on the same candles, day by day;
3. the exit (the document's step 7); 4. the sizing (step 6); 5. the row's height per index; a short session builds no profile."""
import csv, json, os, random, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import vpsignal

bad = 0
def check(what, got, want):
    global bad
    ok = got == want
    bad += not ok
    print(("ok    " if ok else "WRONG ") + what + ("" if ok else f": got {got}, wanted {want}"))

VP = os.path.join(ROOT, "vp")
run = subprocess.run([sys.executable, "-m", "unittest", "test_vp"], cwd=VP, capture_output=True, text=True)
check("the document's own 12 tests pass", ("Ran 12 tests" in run.stderr, run.stderr.strip().splitlines()[-1]), (True, "OK"))

# 30 made-up sessions of 75 five-minute candles with volume (a fixed seed: the same candles every run)
rng = random.Random(7)
days, price = {}, 24000.0
for d in range(1, 31):
    day, candles = f"2026-09-{d:02d}", []
    price += rng.uniform(-90, 90)
    drift = rng.uniform(-3, 3)
    for k in range(75):
        o = price
        price += drift + rng.uniform(-18, 18)
        hi, lo = max(o, price) + rng.uniform(0, 9), min(o, price) - rng.uniform(0, 9)
        m = 9 * 60 + 15 + 5 * k
        candles.append({"hm": f"{m // 60:02d}:{m % 60:02d}", "o": round(o, 2), "h": round(hi, 2), "l": round(lo, 2), "c": round(price, 2), "v": float(rng.randint(500, 9000))})
    days[day] = candles
with tempfile.TemporaryDirectory() as tmp:
    path = os.path.join(tmp, "data.csv")
    with open(path, "w", newline="") as f:
        w = csv.writer(f); w.writerow(["Date", "Time", "Open", "High", "Low", "Close", "Volume"])
        for day, candles in days.items():
            for c in candles:
                w.writerow([day, c["hm"], c["o"], c["h"], c["l"], c["c"], c["v"]])
    cfg = dict(vpsignal.CFG)  # the command line reads bin_size_pts: the same number here
    same, signals, levels_same = 0, 0, 0
    names = list(days)
    for day in names[1:]:
        theirs = json.loads(subprocess.run([sys.executable, "vp_cli.py", "signal", path, day], cwd=VP, capture_output=True, text=True).stdout)
        view = vpsignal.day_view(days, day, days[day], cfg)
        mine = {k: v for k, v in view["signal"].items() if k not in ("outcome", "sizing", "reason")}
        same += mine == {k: v for k, v in theirs.items() if k != "reason"}
        signals += theirs["signal"] != "WAIT"
        lv = json.loads(subprocess.run([sys.executable, "vp_cli.py", "levels", path, day], cwd=VP, capture_output=True, text=True).stdout)
        levels_same += all(view["levels"][k] == lv["previous_session"][k] for k in ("val", "poc", "vah", "hvn", "lvn", "uses_volume")) and \
            [p for p in lv["naked_pocs"] if p["date"] != view["levels_from"]] == view["naked"]
    check("the signal of every day is the document's command line's, field for field", (same, signals > 5), (len(names) - 1, True))
    check("the levels and the naked POC list of every day are the command line's", levels_same, len(names) - 1)

# the exit: a CE at 100 with the stop at 90 and the target at 120
sig = {"signal": "CE", "candle": "10:00", "index_price": 100.0, "index_stop": 90.0, "index_target": 120.0, "risk_pts": 10.0}
def bars(*rows):
    return [{"hm": "10:00", "o": 100, "h": 101, "l": 99, "c": 100}] + [{"hm": hm, "o": o, "h": h, "l": l, "c": c} for hm, o, h, l, c in rows]
C = vpsignal.CFG
check("the index touches the stop: out at the stop", vpsignal.outcome(sig, bars(("10:05", 100, 104, 96, 97), ("10:10", 97, 98, 89, 91)), C), {"how": "stop", "at": "10:10", "exit": 90.0, "points": -10.0})
check("the index touches the target: out at the target", vpsignal.outcome(sig, bars(("10:05", 100, 121, 99, 119)), C), {"how": "target", "at": "10:05", "exit": 120.0, "points": 20.0})
check("both in one candle: the stop is taken", vpsignal.outcome(sig, bars(("10:05", 100, 125, 85, 110)), C)["how"], "stop")
check("neither by 15:15: out at the close of the 15:10 candle", vpsignal.outcome(sig, bars(("15:05", 100, 105, 99, 104), ("15:10", 104, 108, 103, 107), ("15:15", 107, 125, 80, 110)), C), {"how": "time", "at": "15:15", "exit": 107, "points": 7})
check("neither yet, the day still running: open, at the last close", vpsignal.outcome(sig, bars(("10:05", 100, 105, 99, 104)), C), {"how": "open", "at": None, "exit": 104, "points": 4})
pe = {"signal": "PE", "candle": "10:00", "index_price": 100.0, "index_stop": 110.0, "index_target": 80.0, "risk_pts": 10.0}
check("a PE: the stop is above, the target below", [vpsignal.outcome(pe, bars(("10:05", 100, 111, 99, 105)), C)["how"], vpsignal.outcome(pe, bars(("10:05", 100, 101, 79, 82)), C)["points"]], ["stop", 20.0])

# the sizing: risk 35 points, lot 75, as the document's worked example
ex = {"risk_pts": 35.0}
s = vpsignal.sizing(ex, 75, 110, C)
check("the document's worked example: 1 lot, Rs 1,312 at the stop, cost Rs 8,250", (s["lots"], s["approx_loss_at_stop_inr"], s["cost_inr"]), (1, 1312.5, 8250.0))
s = vpsignal.sizing(ex, 75, None, C)
check("without the premium: the loss limit alone, and that is said", (s["lots"], s["approx_loss_at_stop_inr"], "premium" in s["note"]), (1, 1312.5, True))
check("a risk too large for one lot: zero lots", vpsignal.sizing({"risk_pts": 200.0}, 75, None, C)["lots"], 0)
check("no lot size: no sizing, said in words", vpsignal.sizing(ex, None, 110, C)["lots"], None)

check("the row's height per index: 5, 10, 10", [vpsignal.config_for(n)["bin_size_pts"] for n in ("NIFTY 50", "NIFTY BANK", "SENSEX")], [5, 10, 10])
short = dict(days); short["2026-09-30"] = days["2026-09-30"][:40]
check("a session of fewer than 70 candles builds no profile: the day before it stands", vpsignal.prepare(short, "2026-10-01", C)[1], "2026-09-29")
v = vpsignal.day_view(days, "2026-10-01", [], C)
check("before the open: the levels are there and the signal is WAIT", (v["levels"] is not None, v["signal"]["signal"], v["levels_from"]), (True, "WAIT", "2026-09-30"))
check("no file of vp/ holds a password or a key", any(w in open(os.path.join(VP, f)).read().lower() for f in os.listdir(VP) if f.endswith((".py", ".json")) for w in ("password", "access_token", "api_key")), False)

print("\n" + ("all fine" if not bad else f"{bad} WRONG"))
sys.exit(1 if bad else 0)
