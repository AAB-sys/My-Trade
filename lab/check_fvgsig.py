"""AAA_V1's FVG fill signals: the page's JavaScript (static/fvgsig.js) against the owner's Python (lab/fvg_signals_ref.py, the file
"AAA_V1 FVG fill signals.py" kept as it came). Same candles, 14 different settings: the signals must be the same, every one
(candle, call, entry, zone). Candles: made-up random walks by default; FVGSIG_CSV=path (columns Date,Time,Open,High,Low,Close, 5-minute,
Time = start) runs on real candles. Also the page's way of working: only the last 5 days given to the JavaScript, with the daily closes
from the whole history, gives the same signals as the Python on the whole history, for those 5 days.  python3 lab/check_fvgsig.py"""
import csv, datetime as dt, json, os, random, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import fvg_signals_ref as ref

def synthetic(seed, days=60):
    rng = random.Random(seed); bars = []; price = 24000.0; d = dt.date(2026, 1, 5)
    for _ in range(days):
        while d.weekday() >= 5: d += dt.timedelta(days=1)
        price *= 1 + rng.gauss(0, 0.004)
        for k in range(75):
            m = 9 * 60 + 15 + 5 * k; o = price; step = rng.gauss(0, 14) * (3 if rng.random() < 0.08 else 1)
            c = o + step; h = max(o, c) + abs(rng.gauss(0, 5)); l = min(o, c) - abs(rng.gauss(0, 5))
            bars.append({"d": d, "t": dt.time(m // 60, m % 60), "o": round(o, 2), "h": round(h, 2), "l": round(l, 2), "c": round(c, 2)}); price = c
        d += dt.timedelta(days=1)
    return bars

def from_csv(path):
    out = []
    for r in csv.DictReader(open(path)):
        y, mo, da = map(int, r["Date"].split("-")); hh, mm = map(int, r["Time"].split(":"))
        out.append({"d": dt.date(y, mo, da), "t": dt.time(hh, mm), "o": float(r["Open"]), "h": float(r["High"]), "l": float(r["Low"]), "c": float(r["Close"])})
    return out

CONFIGS = [{}, {"ema_filter": "off"}, {"ema_basis": "bar"}, {"fill_level": "mid"}, {"fill_level": "edge"}, {"confirm": "candle"}, {"confirm": "candle", "confirm_wait": 1},
           {"carry_days": 1}, {"min_gap_atr": 0.1}, {"min_gap_atr": 0.6}, {"displacement": False}, {"max_age_bars": 12}, {"entry_from": "10:00", "entry_to": "13:00"},
           {"ema_fast": 5, "ema_slow": 13, "ema_filter": "on"}]

def js_bars(bars): return [{"d": b["d"].isoformat(), "t": b["t"].hour * 60 + b["t"].minute, "o": b["o"], "h": b["h"], "l": b["l"], "c": b["c"]} for b in bars]
RUN = """const F=require(process.argv[1]);const j=JSON.parse(require('fs').readFileSync(process.argv[2]));
const out=j.jobs.map(x=>{const r=F.scan(x.bars,x.cfg,x.daily);return r.signals.map(s=>[s.i,s.action,s.entry,s.zone_lo,s.zone_hi,s.zone_i,s.d,s.close_min]);});
console.log(JSON.stringify(out));"""
def run_js(jobs):
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "in.json"); json.dump({"jobs": jobs}, open(p, "w"))
        r = subprocess.run(["node", "-e", RUN, os.path.join(HERE, "..", "static", "fvgsig.js"), p], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)
def py_sig(bars, cfg):
    sg, _ = ref.scan(bars, None, cfg)
    return [[s["i"], s["action"], s["entry"], s["zone_lo"], s["zone_hi"], s["zone_i"], s["date"].isoformat(), s["time"].hour * 60 + s["time"].minute] for s in sg]

ok = bad = 0
def check(label, a, b):
    global ok, bad
    if a == b: ok += 1
    else:
        bad += 1; print("DIFFERENT:", label, "python", len(a), "js", len(b)); print("  first python-only:", [x for x in a if x not in b][:2]); print("  first js-only:", [x for x in b if x not in a][:2])

sets = {"csv": from_csv(os.environ["FVGSIG_CSV"])} if os.environ.get("FVGSIG_CSV") else {f"walk{s}": synthetic(s) for s in (1, 2, 3)}
total = 0
for name, bars in sets.items():
    jb = js_bars(bars); got = run_js([{"bars": jb, "cfg": c, "daily": None} for c in CONFIGS])
    for c, g in zip(CONFIGS, got):
        want = py_sig(bars, c); total += len(want); check(f"{name} {c}", want, g)
    # the page's way: the last 5 days only, daily closes from the whole history (finished days)
    days = sorted({b["d"] for b in bars}); last5 = days[-5:]; last = [b for b in bars if b["d"] in last5]; cl = {}
    for b in bars: cl[b["d"]] = b["c"]
    daily = [{"d": d.isoformat(), "c": cl[d]} for d in days]
    for c in ({}, {"carry_days": 1}, {"fill_level": "mid"}, {"confirm": "candle"}):
        want = [s for s in py_sig(bars, c) if s[6] >= last5[0].isoformat()]
        g = run_js([{"bars": js_bars(last), "cfg": c, "daily": daily}])[0]
        # the last 5 days start with a different ATR seed: compare the signals of the last 4 days (the seed has worn off long before)
        cut = last5[1].isoformat(); same = lambda xs: [[x[1], x[2], x[3], x[4], x[6], x[7]] for x in xs if x[6] >= cut]  # not the candle's number (it counts from the first candle given)
        check(f"{name} last5 {c}", same(want), same(g))
print(f"{ok} comparisons equal, {bad} different; {total} signals compared")
sys.exit(1 if bad else 0)
