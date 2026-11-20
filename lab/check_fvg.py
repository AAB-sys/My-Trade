"""AAA_V1's fair value gaps (20 November 2026): static/fvg.js against lab/fvg_ref.py, the owner's module panel_fvg.py with four
faults put right. Many made-up days (every setting, missing candles, straight-through candles, three time frames, candles fed one
at a time, all at once, and in pieces) are read by both; the open gaps, every event and every gap made must be the same. Then the
document's checklist (its sections 10 and 11) and the four faults.
    python3 lab/check_fvg.py        (from the repo's folder; needs node)"""
import json, os, random, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fvg_ref as R  # noqa: E402

JS = os.environ.get("FVG_JS") or os.path.join(HERE, "..", "static", "fvg.js")
ok = bad = 0


def check(name, cond, detail=""):
    global ok, bad
    if cond: ok += 1
    else: bad += 1; print("FAIL", name, str(detail)[:400])


def day(rng, n, interval, price, tick, wild=0.2, holes=0.0):
    out, p, m = [], price, 9 * 60 + 15
    for i in range(n):
        o = p + (round(rng.gauss(0, 4) / tick) * tick if rng.random() < 0.3 else 0)
        body = rng.gauss(0, 30 if rng.random() < wild else 6)
        c = o + round(body / tick) * tick
        h = max(o, c) + round(abs(rng.gauss(0, 3)) / tick) * tick; l = min(o, c) - round(abs(rng.gauss(0, 3)) / tick) * tick
        if rng.random() >= holes: out.append({"hm": R._hm(m), "o": round(o, 2), "h": round(h, 2), "l": round(l, 2), "c": round(c, 2)})
        p = c; m += interval
    return out


def cases():
    rng = random.Random(20261120); out = []
    for i in range(500):
        interval = rng.choice([1, 5, 5, 15]); n = {1: rng.choice([40, 200, 375]), 5: rng.choice([3, 10, 75, 75]), 15: 25}[interval]
        cfg = {"fvg_min_atr": rng.choice([0.5, 0.5, 0, 1.0, 1.5]), "fvg_min_points": rng.choice([0, 0, 10, 40]), "fvg_min_pct": rng.choice([0, 0, 0.03]),
               "fvg_atr_len": rng.choice([14, 14, 5, 1, 0]), "fvg_from": rng.choice(["09:15", "09:15", "09:20", "10:00"]), "fvg_until": rng.choice(["15:15", "15:15", "14:30", "15:30"]),
               "fvg_retire_on": rng.choice(["fill", "fill", "close"]), "fvg_max_age_bars": rng.choice([0, 0, 0, 5, 30]), "fvg_max_per_side": rng.choice([10, 10, 1, 2, 0]),
               "fvg_middle_close_beyond": rng.random() < 0.25, "fvg_middle_direction": rng.random() < 0.25}
        cs = day(rng, n, interval, rng.choice([103.4, 25800.6, 64635.2, 83919.71]), rng.choice([0.05, 0.05, 0.01]), rng.choice([0.1, 0.3, 0.6]), rng.choice([0, 0, 0.03]))
        cuts = sorted(set([len(cs)] + [rng.randint(0, len(cs)) for _ in range(rng.choice([0, 2, 6]))])) if rng.random() < 0.5 else list(range(1, len(cs) + 1))
        out.append({"cfg": cfg, "interval": interval, "candles": cs, "cuts": cuts, "price": cs[-1]["c"] if cs else 0})
    return out


def run_python(c):
    t = R.FvgTracker(c["cfg"], c["interval"]); events = []; gaps = []
    for n in c["cuts"]:
        gaps, ev = t.update(c["candles"][:n], "d"); events += ev
    below, above = t.nearest(c["price"])
    return {"gaps": gaps, "events": events, "made": [dict(g) for g in t.made_today], "nearest": [below and below["id"], above and above["id"]]}


NODE = r"""
const F = require(process.argv[2]), fs = require("fs"), cs = JSON.parse(fs.readFileSync(process.argv[3])), extra = JSON.parse(fs.readFileSync(process.argv[4]));
const out = cs.map(c => { const t = new F.Tracker(c.cfg, c.interval); let events = [], gaps = [];
  for (const n of c.cuts) { const [g, ev] = t.update(c.candles.slice(0, n), "d"); gaps = g; events = events.concat(ev); }
  const [below, above] = t.nearest(c.price); return { gaps, events, made: t.made_today.map(g => Object.assign({}, g)), nearest: [below && below.id, above && above.id] }; });
const res = { out, resample: extra.resample.map(([c, m, s]) => F.resample(c, m, "09:15", s)), fmt: extra.fmt.map(x => [F.fmt(x), F.pts(x)]), defaults: F.DEFAULTS };
process.stdout.write(JSON.stringify(res));
"""


def same(a, b, tol=1e-9):
    if isinstance(a, bool) or isinstance(b, bool) or a is None or b is None or isinstance(a, str): return a == b
    if isinstance(a, (int, float)): return isinstance(b, (int, float)) and abs(a - b) <= tol * max(1.0, abs(a), abs(b))
    if isinstance(a, (list, tuple)): return len(a) == len(b) and all(same(x, y, tol) for x, y in zip(a, b))
    if isinstance(a, dict): return set(a) == set(b) and all(same(a[k], b[k], tol) for k in a)
    return a == b


def C(hm, o, h, l, c): return {"hm": hm, "o": o, "h": h, "l": l, "c": c}


def main():
    cs = cases(); rng = random.Random(3)
    res_cases = []
    for _ in range(60):
        one = day(rng, rng.choice([7, 30, 75, 375]), 1, 25800.6, 0.05, 0.3, rng.choice([0, 0, 0.05]))
        res_cases.append([one, rng.choice([3, 5, 15]), 1])
    five = day(rng, 75, 5, 25800.6, 0.05, 0.3, 0.0); res_cases.append([five, 15, 5]); res_cases.append([five[:-1], 15, 5]); res_cases.append([five[:3] + five[4:], 15, 5])
    nums = [0, 0.004, 0.005, 12.5, 13.5, 0.125, 100.125, 100.135, 81995.53, 82016.5, 1234567.891, 99.995, 999.995, 2.5, 3.5, 0.49999, 41.45]
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, "cases.json"); json.dump(cs, open(f, "w")); x = os.path.join(d, "extra.json"); json.dump({"resample": res_cases, "fmt": nums}, open(x, "w")); js = os.path.join(d, "run.js"); open(js, "w").write(NODE)
        got = json.loads(subprocess.run(["node", js, os.path.abspath(JS), f, x], check=True, capture_output=True, text=True).stdout)
    made = 0
    for i, (c, j) in enumerate(zip(cs, got["out"])):
        p = json.loads(json.dumps(run_python(c)))
        check(f"day {i}: JS = Python", same(p, j), {k: (p[k], j[k]) for k in p if not same(p[k], j[k])})
        whole = R.FvgTracker(c["cfg"], c["interval"]); g2, e2 = whole.update(c["candles"], "d")
        check(f"day {i}: fed in pieces = fed at once", same(json.loads(json.dumps(g2)), p["gaps"]) and same(json.loads(json.dumps(e2)), p["events"]))
        made += len(p["made"])
        for g in p["made"]:
            check(f"day {i}: a gap is made at candle 3's close, zone and 50% line right", g["top"] > g["bottom"] and abs(g["half"] - (g["top"] + g["bottom"]) / 2) < 1e-9 and R._mins(g["made_hm"]) - R._mins(g["from_hm"]) == 3 * c["interval"], g)
            order = [g[k] for k in ("touched_hm", "half_hm", "filled_hm", "inverted_hm") if g[k] is not None]
            check(f"day {i}: touched, 50%, filled, failed come in that order, after the gap is made", order == sorted(order) and all(t >= g["made_hm"] for t in order) and (g["half_hm"] is None or g["touched_hm"] is not None) and (g["filled_hm"] is None or g["half_hm"] is not None) and (g["inverted_hm"] is None or g["filled_hm"] is not None), g)
        cap_ = c["cfg"]["fvg_max_per_side"]
        check(f"day {i}: at most {cap_} open gaps a side", cap_ == 0 or all(sum(1 for g in p["gaps"] if g["kind"] == k) <= cap_ for k in ("bullish", "bearish")))
        check(f"day {i}: open gaps newest first, unfilled part inside the zone", all(a["id"] > b["id"] for a, b in zip(p["gaps"], p["gaps"][1:])) and all(g["bottom"] <= g["unfilled_low"] <= g["unfilled_high"] <= g["top"] and 0 <= g["filled_pct"] <= 100 for g in p["gaps"]))
    print(f"{len(cs)} made-up days read by both files; {made} gaps made in them")
    check("resample: %d cases" % len(res_cases), same(json.loads(json.dumps([R.resample(c, m, "09:15", s) for c, m, s in res_cases])), got["resample"]))
    check("the printed prices and points", same([[R._fmt(x), R._pts(x)] for x in nums], got["fmt"]), (got["fmt"], [[R._fmt(x), R._pts(x)] for x in nums]))
    check("the default settings are the same", same(json.loads(json.dumps(R.FVG_DEFAULTS)), got["defaults"]))

    # the document's checklist (sections 10 and 11), on the reference
    T = lambda cfg=None, iv=5: R.FvgTracker(dict({"fvg_min_atr": 0}, **(cfg or {})), iv)
    up = [C("09:15", 100, 101, 99, 100.5), C("09:20", 100.5, 104, 100.4, 103.8), C("09:25", 103.8, 105, 102.5, 104.5)]
    t = T(); g, e = t.update(up[:2], "d"); check("no gap before candle 3 closes", g == [] and e == [])
    g, e = t.update(up, "d"); check("a bullish gap when candle 3 closes: zone 101 to 102.5, made 09:30, from 09:15", len(g) == 1 and (g[0]["kind"], g[0]["bottom"], g[0]["top"], g[0]["made_hm"], g[0]["from_hm"], g[0]["state"]) == ("bullish", 101, 102.5, "09:30", "09:15", "active") and e[0]["type"] == "fvg_new", g)
    dn = [C("09:15", 100, 101, 99, 99.5), C("09:20", 99.5, 99.6, 96, 96.2), C("09:25", 96.2, 97.5, 95, 95.5)]
    g, e = T().update(dn, "d"); check("the bearish mirror: zone 97.5 to 99", len(g) == 1 and (g[0]["kind"], g[0]["bottom"], g[0]["top"]) == ("bearish", 97.5, 99), g)
    t = T({"fvg_retire_on": "close"}); t.update(up, "d"); seq = []; cs2 = list(up)
    for c in (C("09:30", 104.5, 104.6, 102.4, 103), C("09:35", 103, 103.1, 101.7, 102), C("09:40", 102, 102.2, 100.9, 101.2), C("09:45", 101.2, 101.3, 100.2, 100.4)):
        cs2 = cs2 + [c]; g, e = t.update(cs2, "d"); mine = [x for x in g if x["id"] == 1]
        seq.append(([x["type"] for x in e if x["id"] == 1], mine[0]["state"] if mine else None))
    check("touched, then 50%, then filled, then failed, one candle each", seq == [(["fvg_touched"], "touched"), (["fvg_half"], "half"), (["fvg_filled"], "filled"), (["fvg_inverted"], None)], seq)
    t = T(); t.update(up, "d"); g, e = t.update(up + [C("09:30", 104.5, 104.6, 100.0, 100.2)], "d")
    check("one candle straight through gives touched, 50%, filled and failed together, in that order", [x["type"] for x in e] == ["fvg_touched", "fvg_half", "fvg_filled", "fvg_inverted"] and g == [], e)
    t = T(); t.update(up, "d"); t.update(up + [C("09:30", 104.5, 104.6, 102.0, 103)], "d"); mt = t.made_today[0]
    check("held on first touch: the candle that came back closed above the bottom", mt["held_first_touch"] is True)
    g = t.open_gaps()[0]; check("a partly filled zone shrinks to the unfilled part (101 to 102, 33.3% filled)", (g["unfilled_low"], g["unfilled_high"], g["filled_pct"]) == (101, 102.0, 33.3), g)
    g, e = T().update([up[0], C("09:25", 100.5, 104, 100.4, 103.8), C("09:30", 103.8, 105, 102.5, 104.5)], "d"); check("no gap across a missing candle", g == [])
    g, e = T({"fvg_min_points": 2}).update(up, "d"); check("size filter: a 1.5-point zone is not kept at 2 points", g == [])
    ta = T({"fvg_min_atr": 0.5}); g, e = ta.update(up, "d"); check("size filter: the ATR at candle 3's close is 2.7 (true ranges 2, 3.6, 2.5); a 1.5-point zone passes 0.5 ATR", len(g) == 1 and abs(ta.atr() - 2.7) < 1e-9, ta.atr())
    g, e = T({"fvg_min_atr": 0.6}).update(up, "d"); check("size filter: the same zone does not pass 0.6 ATR (1.62)", g == [])
    g, e = T({"fvg_min_pct": 1.4}).update(up, "d"); g2, e2 = T({"fvg_min_pct": 1.5}).update(up, "d"); check("size filter: percent of the price at candle 3's close (104.5)", len(g) == 1 and g2 == [])
    g, e = T({"fvg_from": "09:20"}).update(up, "d"); check("time window: candle 1 before fvg_from gives no gap", g == [])
    late = [C("15:05", 100, 101, 99, 100.5), C("15:10", 100.5, 104, 100.4, 103.8), C("15:15", 103.8, 105, 102.5, 104.5)]
    g, e = T().update(late, "d"); check("time window: candle 3 closing after fvg_until gives no gap", g == [])
    t = T(); t.update(up, "d"); g, e = t.update(up[:1], "e"); check("a new day resets", g == [] and t.made_today == [] and t.next_id == 1)
    many = []; p0 = 100.0
    for i in range(12): many += [C(R._hm(555 + 15 * i), p0, p0 + 1, p0 - 1, p0 + 0.5), C(R._hm(560 + 15 * i), p0 + 0.5, p0 + 4, p0 + 0.4, p0 + 3.8), C(R._hm(565 + 15 * i), p0 + 3.8, p0 + 5, p0 + 2.5, p0 + 4.5)]; p0 += 4.5
    g, e = T({"fvg_max_per_side": 3}).update(many, "d"); check("at most N open gaps a side (the oldest dropped)", len(g) == 3 and [x["id"] for x in g] == sorted([x["id"] for x in g], reverse=True), [x["id"] for x in g])
    ones = [C(R._hm(555 + i), 100 + i, 101 + i, 99 + i, 100.5 + i) for i in range(31)]
    r5 = R.resample(ones, 5); check("resample: only finished bigger candles (31 one-minute candles give six 5-minute ones)", len(r5) == 6 and r5[0] == C("09:15", 100, 105, 99, 104.5), r5[:1])
    f15 = R.resample([C(R._hm(555 + 5 * i), 100 + i, 101 + i, 99 + i, 100.5 + i) for i in range(7)], 15, "09:15", 5); check("resample: 15-minute candles from 5-minute ones", f15 == [C("09:15", 100, 103, 99, 102.5), C("09:30", 103, 106, 102, 105.5)], f15)
    both = up + [C("09:30", 104.5, 112, 104.4, 111.5), C("09:35", 111.5, 112.5, 111, 111.2), C("09:40", 111.2, 111.3, 107, 107.2), C("09:45", 107.2, 109, 106.5, 107)]
    t = T(); g, e = t.update(both, "d"); kinds = sorted((x["kind"], x["bottom"], x["top"]) for x in g)
    check("a bullish gap below and a bearish gap above the price", kinds == [("bearish", 109, 111), ("bullish", 101, 102.5), ("bullish", 105, 111)] or len([k for k in kinds if k[0] == "bearish"]) == 1, kinds)
    bear = [x for x in g if x["kind"] == "bearish"][0]
    b, a_ = t.nearest(107); check("nearest(): the bullish gap below the price and the bearish gap above it", b is not None and b["kind"] == "bullish" and b["top"] <= 107 and a_ is not None and a_["id"] == bear["id"], (b, a_))
    b, a_ = t.nearest(100); check("nearest(): nothing below 100", b is None)
    # a 15-minute gap on 1-minute candles appears only after its third 15-minute candle closes
    mm = []
    for q, (o, h, l, c) in enumerate([(100, 101, 99, 100.5), (100.5, 104, 100.4, 103.8), (103.8, 105, 102.5, 104.5)]):
        for j in range(15): mm.append(C(R._hm(555 + 15 * q + j), o if j == 0 else c, h if j == 7 else max(o, c), l if j == 3 else min(o, c), c))
    t = T(iv=15); first = None
    for n in range(1, len(mm) + 1):
        g, e = t.update(R.resample(mm[:n], 15), "d")
        if g and first is None: first = n
    check("a 15-minute gap appears only after its third 15-minute candle closes (the 45th minute)", first == 45, first)

    # the four faults put right
    hole = [c for c in ones if c["hm"] != "09:22"]
    check("fault 1: a 5-minute candle with a 1-minute candle missing inside is not made", [c["hm"] for c in R.resample(hole, 5)] == ["09:15", "09:25", "09:30", "09:35", "09:40"], [c["hm"] for c in R.resample(hole, 5)])
    t = T(); t.update(up, "d"); rev = [up[0], up[1], dict(up[2], l=100.8)]; g, e = t.update(rev, "d")
    check("fault 2: a finished candle revised by the feed is read again (the gap that is no longer there goes)", g == [] and t.made_today == [])
    check("fault 3: 12.5 points reads 13, and a 50% line at 100.125 reads 100.13", R._pts(12.5) == "13" and R._fmt(100.125) == "100.13" and R._fmt(82016.5) == "82,016.50")
    g, e = T({"fvg_max_per_side": 0}).update(many, "d"); check("fault 4: 0 open gaps a side means no limit", len(g) == 12, len(g))
    print(f"{ok} checks passed, {bad} failed")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
