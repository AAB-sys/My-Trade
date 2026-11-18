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
    # 17 November: yesterday's VAH, POC and VAL are the chart's (vpsignal.LEVELS_LIKE_CHART). First the proof that the rule
    # itself is untouched: with the setting off, everything is the document's command line's, field for field, as before.
    vpsignal.LEVELS_LIKE_CHART = False
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
    # then the setting on, as the page runs: the three levels are the chart's, and the signal is the document's own
    # find_signal read with them: the same rule, the new numbers
    vpsignal.LEVELS_LIKE_CHART = True
    sys.path.insert(0, os.path.join(ROOT, "panel"))
    import panel_profile
    chart_ok, rule_ok, moved = 0, 0, 0
    for day in names[1:]:
        view = vpsignal.day_view(days, day, days[day], cfg)
        prev_day = view["levels_from"]
        p = panel_profile.build_profile(days[prev_day], rows=24, va_pct=cfg["value_area_pct"], va_step=2, like_chart=True)
        chart_ok += all(view["levels"][k] == p[k] for k in ("val", "poc", "vah"))
        prev, _d, naked = vpsignal.prepare(days, day, cfg)
        want = vpsignal.vp_signal.find_signal(days[day], prev, cfg, naked)
        mine = {k: v for k, v in view["signal"].items() if k not in ("outcome", "sizing", "reason")}
        rule_ok += mine == {k: v for k, v in want.items() if k != "reason"}
        vpsignal.LEVELS_LIKE_CHART = False
        old = vpsignal.day_view(days, day, days[day], cfg)["levels"]
        vpsignal.LEVELS_LIKE_CHART = True
        moved += any(old[k] != view["levels"][k] for k in ("val", "poc", "vah"))
        same_rest = all(old[k] == view["levels"][k] for k in ("hvn", "lvn", "session_low", "session_high", "uses_volume"))
        chart_ok += 0 if same_rest else -1
    check("as the page runs: yesterday's VAH, POC and VAL of every day are the chart's (24 rows), the nodes and the day's high and low the document's", chart_ok, len(names) - 1)
    check("and the signal of every day is the document's own rule read with those levels", rule_ok, len(names) - 1)
    check("the two counts do differ on these days (so the test means something)", moved > 0, True)

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

# the live feed: the candle forming now never gives a signal, but a stop touched inside it ends the trade at once
day = "2026-09-30"
full = vpsignal.day_view(days, day, days[day], C)["signal"]
if full["signal"] == "WAIT":
    day = next(d for d in days if d > "2026-09-01" and vpsignal.day_view(days, d, days[d], C)["signal"]["signal"] != "WAIT")
    full = vpsignal.day_view(days, day, days[day], C)["signal"]
k = next(i for i, c in enumerate(days[day]) if c["hm"] == full["candle"])
upto = days[day][:k + 1]
ce = full["signal"] == "CE"
nxt = days[day][k + 1]["hm"]
hit = {"hm": nxt, "o": full["index_price"], "h": full["index_price"] + (1 if ce else 500), "l": full["index_price"] - (500 if ce else 1), "c": full["index_price"]}
o = vpsignal.day_view(days, day, upto, C, forming=hit)["signal"]["outcome"]
check("the live price touches the stop inside the forming candle: out at once", (o["how"], o["at"], o["live"]), ("stop", nxt, True))
calm = {"hm": nxt, "o": full["index_price"], "h": full["index_price"] + 0.5, "l": full["index_price"] - 0.5, "c": full["index_price"] + (0.5 if ce else -0.5)}
o = vpsignal.day_view(days, day, upto, C, forming=calm)["signal"]["outcome"]
check("no touch yet: still open, the points from the live price", (o["how"], o["points"], o["live"]), ("open", 0.5, True))
before = vpsignal.day_view(days, day, days[day][:k], C, forming=days[day][k])["signal"]
check("the candle that will give the signal gives none while it is still forming", before["signal"], "WAIT")

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

# ---- the fine-tuning list of 15 November
import dhan
from datetime import datetime
def stamp(day, hm):
    return int(datetime.fromisoformat(f"{day}T{hm}:00+05:30").timestamp())
# 5. only 09:15 to 15:30 counts: a bar stamped 18:45 and one at 09:10 are left out
raw = [{"time": stamp("2026-11-13", hm), "open": 100, "high": 101, "low": 99, "close": 100} for hm in ("09:10", "09:15", "15:25", "15:30", "18:45")]
check("only candles from 09:15 up to 15:30 are counted", [c["hm"] for c in vpsignal.sessions_of(raw, {})["2026-11-13"]], ["09:15", "15:25"])
# 5. "yesterday" is the previous trading day: Monday 16 November reads Friday 13, across the weekend; a holiday the same way
week = {d: days[k] for d, k in zip(("2026-11-11", "2026-11-12", "2026-11-13", "2026-11-16"), list(days)[:4])}
check("Monday reads Friday: the levels come from the last trading day before it", vpsignal.day_view(week, "2026-11-16", [], C)["levels_from"], "2026-11-13")
check("a Saturday or a Sunday in between changes nothing (no session, no profile)", vpsignal.prepare(week, "2026-11-15", C)[1], "2026-11-13")
# 3. yesterday's profile from the 1-minute candles: the same day, cut in 1-minute candles of the same prices and volume
def minutes_of(candles):
    out = []
    for c in candles:
        h, m = map(int, c["hm"].split(":"))
        for j in range(5):
            mm = h * 60 + m + j
            out.append({"hm": f"{mm // 60:02d}:{mm % 60:02d}", "o": c["o"], "h": c["h"], "l": c["l"], "c": c["c"], "v": c["v"] / 5})
    return out
fine = {d: minutes_of(c) for d, c in week.items()}
p5, _, _ = vpsignal.prepare(week, "2026-11-16", C)
p1, d1, _ = vpsignal.prepare(week, "2026-11-16", C, fine)
check("with the day's 1-minute candles the profile is built from them, and says so", (p1["candles"], d1, p5.get("candles")), ("1m", "2026-11-13", "5m"))
check("minutes that repeat their 5-minute candle give the same levels: one calculation, whatever the candle size", [p1[k] for k in ("val", "poc", "vah")], [p5[k] for k in ("val", "poc", "vah")])
real = {d: [dict(c, h=c["h"] - (i % 5) * 0.4, l=c["l"] + (i % 5) * 0.4) for i, c in enumerate(m)] for d, m in fine.items()}
pr = vpsignal.prepare(week, "2026-11-16", C, real)[0]
check("real 1-minute candles (narrower than their 5-minute candle): the levels are the chart's count of those minutes (17 November)", [pr[k] for k in ("val", "poc", "vah")], [vpsignal.chart_levels_of(real["2026-11-13"], C["value_area_pct"])[k] for k in ("val", "poc", "vah")])
vpsignal.LEVELS_LIKE_CHART = False
pr0 = vpsignal.prepare(week, "2026-11-16", C, real)[0]
vpsignal.LEVELS_LIKE_CHART = True
check("with the setting off they keep the document's rows: every level on the 5-point grid", [pr0["val"] % 5, pr0["vah"] % 5, (pr0["poc"] - 2.5) % 5], [0.0, 0.0, 0.0])
short_fine = dict(fine); short_fine["2026-11-13"] = fine["2026-11-13"][:200]
check("a day with too few 1-minute candles (under 350) is built from its 5-minute candles, not skipped", (vpsignal.prepare(week, "2026-11-16", C, short_fine)[0]["candles"], vpsignal.prepare(week, "2026-11-16", C, short_fine)[1]), ("5m", "2026-11-13"))
v = vpsignal.day_view(week, "2026-11-16", [], C, fine=fine)
check("the answer says what the levels were counted from", (v["levels"]["candles"], v["levels"]["bin_size_pts"], v["levels"]["uses_volume"]), ("1m", C["bin_size_pts"], True))
# 2. the Signal's profile uses the futures volume: the same candles with and without it give different busiest prices
heavy = {d: [dict(c, v=(50000.0 if i < 5 else 1.0)) for i, c in enumerate(cs)] for d, cs in week.items()}
bare = {d: [{k: x for k, x in c.items() if k != "v"} for c in cs] for d, cs in week.items()}
ph, pb = vpsignal.prepare(heavy, "2026-11-16", C)[0], vpsignal.prepare(bare, "2026-11-16", C)[0]
check("the volume decides the levels (uses_volume true), and without it the count is by time and says so", (ph["uses_volume"], pb["uses_volume"], ph["poc"] != pb["poc"]), (True, False, True))
# 5. the document's 70% rule with one row left on a side, and none
check("the document's value area with one row left above the busiest row", vpsignal.vp_profile._value_area([1, 1, 2, 10, 3], 3, 0.7), (3, 4))
check("the document's value area with the busiest row at the top edge", vpsignal.vp_profile._value_area([1, 1, 2, 3, 10], 4, 0.7), (3, 4))
check("the document's value area never runs past the rows, even at 100%", vpsignal.vp_profile._value_area([1, 5, 1], 1, 1.0), (0, 2))

print("\n" + ("all fine" if not bad else f"{bad} WRONG"))
sys.exit(1 if bad else 0)
