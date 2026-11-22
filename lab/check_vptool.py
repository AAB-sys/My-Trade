"""AAA_V1's volume profile tools (20 November 2026): static/vptool.js against lab/vptool_ref.py, the owner's reference module.
Many made-up ranges (every setting, finer bars that start late, stop early or have holes, no volume at all, ties, one bar, 100%
value area, more than 2,000 rows) are counted by both; every row's up and down volume, the POC, the value area, the developing
lines and the rows' drawn lengths must be the same. Then the document's worked example and the five faults that were put right.
    python3 lab/check_vptool.py        (from the repo's folder; needs node)"""
import json, math, os, random, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vptool_ref as R  # noqa: E402

JS = os.environ.get("VPTOOL_JS") or os.path.join(HERE, "..", "static", "vptool.js")
ok = bad = 0


def check(name, cond, detail=""):
    global ok, bad
    if cond: ok += 1
    else: bad += 1; print("FAIL", name, detail)


def bars_of(rng, n, tf, t0, price, tick, volume=True, flat=0.0):
    out, p = [], price
    for i in range(n):
        o = p; c = o + round(rng.gauss(0, 6) / tick) * tick
        if rng.random() < flat: c = o
        h = max(o, c) + round(abs(rng.gauss(0, 3)) / tick) * tick; l = min(o, c) - round(abs(rng.gauss(0, 3)) / tick) * tick
        v = (rng.choice([0, 0, 50, 75, 150, 225, 1000]) * rng.randint(1, 40)) if volume else 0
        out.append({"t": t0 + i * tf, "o": round(o, 2), "h": round(h, 2), "l": round(l, 2), "c": round(c, 2), "v": v}); p = c
    return out


def finer(rng, chart, tf, low_tf, tick, volume=True):
    out = []
    for b in chart:
        k = tf // low_tf; p = b["o"]; vs = [b["v"] // k] * k; vs[-1] += b["v"] - sum(vs)
        for j in range(k):
            o = p; c = b["c"] if j == k - 1 else min(b["h"], max(b["l"], o + round(rng.gauss(0, 2) / tick) * tick))
            h = min(b["h"], max(o, c) + round(abs(rng.gauss(0, 1)) / tick) * tick); l = max(b["l"], min(o, c) - round(abs(rng.gauss(0, 1)) / tick) * tick)
            out.append({"t": b["t"] + j * low_tf, "o": round(o, 2), "h": round(h, 2), "l": round(l, 2), "c": round(c, 2), "v": vs[j] if volume else 0}); p = c
    return out


def cases():
    rng = random.Random(20261120); M = 60000; out = []
    for i in range(600):
        tick = rng.choice([0.05, 0.05, 0.01, 0.0025]); tf = rng.choice([M, 5 * M, 15 * M]); n = rng.choice([1, 1, 2, 3, 7, 25, 75, 150, 375])
        volume = rng.random() > 0.12; chart = bars_of(rng, n, tf, 1795000500000, rng.choice([103.4, 25800.6, 64635.2, 83919.71]), tick, volume, rng.choice([0, 0, 0.3]))
        s = {"layout": rng.choice(["rows", "rows", "ticks"]), "vol": rng.choice(["updown", "total", "delta"]), "va": rng.choice([70, 70, 68, 1, 30, 99, 100]),
             "dpoc": rng.random() < 0.4, "dva": rng.random() < 0.4, "width": rng.choice([30, 1, 100, 55])}
        s["size"] = rng.choice([24, 24, 1, 2, 10, 50, 300, 2000, 2500]) if s["layout"] == "rows" else rng.choice([1, 5, 20, 100, 1000, 7.5])
        low = low_tf = None; cut_hi = None
        if tf > M and rng.random() < 0.6:
            low_tf = M; low = finer(rng, chart, tf, low_tf, tick, volume and rng.random() > 0.1); kind = rng.choice(["whole", "late", "late-mid", "early-end", "holes", "empty"])
            if kind == "late": low = [b for b in low if b["t"] >= chart[len(chart) // 3]["t"]]
            if kind == "late-mid": low = low[max(0, len(low) // 3 + 2):]
            if kind == "early-end": low = low[: max(1, len(low) * 2 // 3)]
            if kind == "holes": low = [b for b in low if rng.random() > 0.15]
            if kind == "empty": low = []
            if rng.random() < 0.3: cut_hi = chart[-1]["t"]
        out.append({"chart": chart, "tf": tf, "tick": tick, "s": s, "low": low, "low_tf": low_tf, "cut_hi": cut_hi})
    # ties: flat volumes, so the POC and value-area tie rules are used
    for n in (2, 3, 4, 9, 10):
        chart = [{"t": 1795000500000 + i * 300000, "o": 100 + i, "h": 101 + i, "l": 100 + i, "c": 100.5 + i, "v": 1000} for i in range(n)]
        for va in (70, 100, 50): out.append({"chart": chart, "tf": 300000, "tick": 0.05, "s": {"layout": "rows", "size": n, "va": va, "dpoc": True, "dva": True}, "low": None, "low_tf": None, "cut_hi": None})
    return out


def run_python(c):
    p = R.compute_profile(c["chart"], c["tf"], c["tick"], c["s"], c["low"] or None, c["low_tf"], math.inf if c["cut_hi"] is None else c["cut_hi"])
    return None if p is None else dict(p, hist=R.histogram_bars(p, c["s"], 437.5))


NODE = r"""
const V = require(process.argv[2]), fs = require("fs"), cs = JSON.parse(fs.readFileSync(process.argv[3]));
const out = cs.map(c => { const p = V.compute(c.chart, c.tf, c.tick, c.s, c.low, c.low_tf, c.cut_hi == null ? Infinity : c.cut_hi); return p && Object.assign(p, { hist: V.histogramBars(p, c.s, 437.5) }); });
const extra = { ranges: JSON.parse(process.argv[4]).map(([n, t1, t2, a, e]) => V.selectRange(Array.from({ length: n }, (_, i) => ({ t: i * 10 })), t1, t2, a, e)),
  lower: JSON.parse(process.argv[5]).map(([tf, n]) => V.pickLowerTf(tf, n)), rows: JSON.parse(process.argv[6]).map(a => V.rowsLayout(...a)), defaults: V.DEFAULTS };
process.stdout.write(JSON.stringify({ out, extra }));
"""


def same(a, b, tol=0.0):
    if isinstance(a, bool) or isinstance(b, bool) or a is None or b is None or isinstance(a, str): return a == b
    if isinstance(a, (int, float)): return a == b or abs(a - b) <= tol * max(1.0, abs(a), abs(b))
    if isinstance(a, (list, tuple)): return len(a) == len(b) and all(same(x, y, tol) for x, y in zip(a, b))
    if isinstance(a, dict): return set(a) == set(b) and all(same(a[k], b[k], tol) for k in a)
    return a == b


def main():
    cs = cases(); rng = random.Random(7)
    ranges = [[rng.randint(0, 12), rng.randint(-15, 130), rng.choice([None, rng.randint(-15, 130)]), rng.random() < 0.3, rng.random() < 0.3] for _ in range(400)]
    lower = [[tf, n] for tf in (60000, 300000, 900000, 3600000, 86400000, 7 * 86400000) for n in (1, 10, 75, 400, 1000, 5000, 30000)]
    rows = [[lo, lo + span, layout, size, tick] for lo in (99.5, 25345.2, 82403.27) for span in (0, 0.05, 2.9, 463.6, 1634.69) for layout in ("rows", "ticks") for size in (1, 2, 10, 24, 300, 2000, 2500, 7.5) for tick in (0.05, 0.01)]
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, "cases.json"); json.dump(cs, open(f, "w")); js = os.path.join(d, "run.js"); open(js, "w").write(NODE)
        got = json.loads(subprocess.run(["node", js, os.path.abspath(JS), f, json.dumps(ranges), json.dumps(lower), json.dumps(rows)], check=True, capture_output=True, text=True).stdout)
    # 1. every made-up range: the two files agree (exactly; the drawn lengths to a millionth of a pixel)
    worst = []
    for i, (c, j) in enumerate(zip(cs, got["out"])):
        p = run_python(c)
        if p is None or j is None: check(f"case {i}", p is None and j is None); continue
        jh, ph = j.pop("hist"), p.pop("hist")
        fine = same(json.loads(json.dumps(p)), j, 1e-12) and same(json.loads(json.dumps(ph)), jh, 1e-9)
        if not fine: worst.append(i)
        check(f"case {i}: JS = Python", fine, str({k: (p[k], j[k]) for k in p if not same(json.loads(json.dumps(p[k])), j[k], 1e-12)})[:300])
        check(f"case {i}: the volume is all there", c["chart"] and (p["no_volume"] or abs(p["volume"] - src_volume(c)) < 1e-6 * max(1, p["volume"])), f'{p["volume"]} {src_volume(c)}')
        check(f"case {i}: up + down = total", all(abs(u + dn - t) < 1e-6 * max(1, t) for u, dn, t in zip(p["up"], p["down"], p["total"])))
        check(f"case {i}: POC inside the value area", p["val"] <= p["poc"] <= p["vah"] and 0 <= p["val"] and p["vah"] < p["rows"])
        check(f"case {i}: rows within the limit", 1 <= p["rows"] <= R.MAX_ROWS and len(p["total"]) == p["rows"])
    print(f"{len(cs)} made-up ranges counted by both files")
    check("selectRange: 400 ranges", same([None if r is None else list(r) for r in (R.select_range([{"t": i * 10} for i in range(n)], t1, t2, a, e) for n, t1, t2, a, e in ranges)], got["extra"]["ranges"]))
    check("pickLowerTf", same([None if r is None else list(r) for r in (R.pick_lower_tf(tf, n) for tf, n in lower)], got["extra"]["lower"]))
    check("rowsLayout: %d layouts" % len(rows), same([list(R.rows_layout(*a)) for a in rows], got["extra"]["rows"], 1e-12))
    check("the default settings are the same", same(json.loads(json.dumps(R.DEFAULTS)), got["extra"]["defaults"]))
    # 2. the document's worked example (its section 9)
    demo = [{"t": i * 300000, "o": o, "h": h, "l": l, "c": c, "v": v} for i, (o, h, l, c, v) in enumerate([(100.0, 101.0, 99.5, 100.8, 1200), (100.8, 102.2, 100.6, 102.0, 2100), (102.0, 102.4, 101.1, 101.3, 1700), (101.3, 101.9, 100.9, 101.6, 900)])]
    p = R.compute_profile(demo, 300000, 0.05, {"size": 10})
    check("worked example: 10 rows of 0.30", p["rows"] == 10 and abs(p["row_height"] - 0.3) < 1e-9)
    check("worked example: POC 101.75, VAL 101.00, VAH 102.20", [round(p[k], 2) for k in ("poc_price", "val_price", "vah_price")] == [101.75, 101.0, 102.2])
    check("worked example: the rows", [round(x, 1) for x in p["up"]] == [240.0, 240.0, 240.0, 371.3, 723.7, 663.7, 663.7, 663.8, 393.7, 0.0] and [round(x, 1) for x in p["down"]] == [0, 0, 0, 0, 0, 261.5, 392.3, 392.3, 392.3, 261.5])
    # 3. the five faults put right
    M = 60000; chart = [{"t": i * 5 * M, "o": 100, "h": 102, "l": 99, "c": 101, "v": 500} for i in range(4)]
    low = [{"t": b["t"] + j * M, "o": 100, "h": 101, "l": 100, "c": 100.5, "v": 100} for b in chart for j in range(5)]
    p = R.compute_profile(chart, 5 * M, 0.05, {}, low[:10], M)
    check("fault 1: finer bars that stop early: the later chart bars are still counted", abs(p["volume"] - 2000) < 1e-9, str(p["volume"]))
    p = R.compute_profile(chart, 5 * M, 0.05, {}, low[:5] + low[15:], M)
    check("fault 1: a hole in the finer bars: those chart bars are still counted", abs(p["volume"] - 2000) < 1e-9, str(p["volume"]))
    p = R.compute_profile(chart, 5 * M, 0.05, {}, [dict(b, v=0) for b in low], M)
    check("fault 2: finer bars without volume do not turn the profile into time at price", not p["no_volume"] and abs(p["volume"] - 2000) < 1e-9)
    tot = [0.1] * 10; lo, hi = R.value_area(tot, R.point_of_control(tot), 100)
    check("fault 3: a 100% value area holds every row", (lo, hi) == (0, 9), str((lo, hi)))
    h, n, tpr = R.rows_layout(100, 300, "ticks", 1, 0.05)
    check("fault 4: past 2,000 rows the ticks per row are the real ones", n == 2000 and abs(tpr * 0.05 - h) < 1e-12 and abs(h - 0.1) < 1e-12, str((h, n, tpr)))
    check("fault 5: an empty range gives no profile", R.compute_profile([], 5 * M, 0.05) is None)
    p = R.compute_profile([{"t": 0, "o": 100, "h": 101, "l": 99, "c": 100.5, "v": 0}, {"t": 5 * M, "o": 100.5, "h": 100.5, "l": 100.5, "c": 100.5, "v": 0}], 5 * M, 0.05, {})
    check("no volume at all: time at price, 5 minutes a bar", p["no_volume"] and abs(p["volume"] - 10) < 1e-9)
    print(f"{ok} checks passed, {bad} failed")
    sys.exit(1 if bad else 0)


def src_volume(c):
    return sum((b.get("v") or 0) for b, _ in R.build_source(c["chart"], c["tf"], c["low"] or None, c["low_tf"], math.inf if c["cut_hi"] is None else c["cut_hi"]))


if __name__ == "__main__":
    main()
