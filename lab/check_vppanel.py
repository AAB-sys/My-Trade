"""The Live Volume Profile Panel as the server feeds it (vppanel.py over the document's code in panel/).
  1. the document's own 26 tests still pass;
  2. feeding the day one candle at a time, in several looks, gives the same panel as one replay of the whole day (the document's
     note 5: after a restart the day is replayed);
  3. with the page's arithmetic (like_chart) the panel's POC, VAH and VAL equal the chart's (static/volprofile.js, run with node),
     at every 15th minute of a day (the acceptance checklist);
  4. before 09:30 the reading is "Too early to read"; without volume the flags say so and VWAP is "not available".
python3 lab/check_vppanel.py            and, for the checklist's replay of every day of a futures-volume file:
python3 lab/check_vppanel.py <Candles with volume .csv>"""
import csv, json, os, subprocess, sys, unittest
from collections import OrderedDict
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import vppanel  # noqa: E402  (puts panel/ on the path)
import panel_engine, panel_profile  # noqa: E402

ok = True
def check(what, cond):
    global ok
    ok = ok and bool(cond)
    print(("ok   " if cond else "FAIL ") + what)

# 1
suite = unittest.defaultTestLoader.discover(os.path.join(ROOT, "panel"), pattern="test_panel.py")
res = unittest.TextTestRunner(stream=open(os.devnull, "w")).run(suite)
check(f"the document's tests: {res.testsRun} run, {len(res.failures) + len(res.errors)} failed", res.testsRun == 26 and res.wasSuccessful())

# a made-up day: a rise, a balance, a fall, with volume
def day(n=375, volume=True):
    out, price = [], 25000.0
    for i in range(n):
        drift = 0.9 if i < 90 else (-0.05 if i < 250 else -0.6)
        o = price; price += drift + ((i * 37) % 11 - 5) * 0.6; c = price
        out.append({"hm": "%02d:%02d" % ((555 + i) // 60, (555 + i) % 60), "o": o, "h": max(o, c) + 1.5, "l": min(o, c) - 1.5, "c": c, "v": float(1000 + (i * 53) % 700) if volume else 0.0})
    return out
cfg = dict(vppanel.CFG); cfg["match_chart_profile"] = True
cfg["match_chart_shape"] = cfg["match_chart_poc"] = True  # as the page runs it (vppanel.config_for), 17 November
prev = {"vah": 25010.0, "poc": 24990.0, "val": 24960.0, "high": 25030.0, "low": 24940.0, "close": 24995.0}
candles = day()

# 2
whole = {"engine": panel_engine.PanelEngine(cfg, prev, "2026-11-16", 1), "done": 0, "out": None, "alerts": []}
a = vppanel.feed(whole, candles)
steps = {"engine": panel_engine.PanelEngine(cfg, prev, "2026-11-16", 1), "done": 0, "out": None, "alerts": []}
for upto in (1, 14, 16, 60, 61, 200, 374, 375):
    b = vppanel.feed(steps, candles[:upto])
same = json.dumps(a, sort_keys=True, default=str) == json.dumps(b, sort_keys=True, default=str)
check("fed in eight looks = one replay of the day (the same output, to the last field)", same)
check("the day's alerts are the same either way, newest first", whole["alerts"] == steps["alerts"] and (not whole["alerts"] or whole["alerts"][0]["time"] >= whole["alerts"][-1]["time"]))
check("the output has every section of the document", all(k in a for k in ("time", "date", "price", "status_line", "label", "score", "checks", "shape", "profile", "vwap", "acceptance", "edge", "oi", "migration", "levels", "zones", "conditions", "flags", "alerts", "warning")) and len(a["checks"]) == 7)

# 3
js = """const V=require(process.argv[1]),c=JSON.parse(require('fs').readFileSync(0,'utf8')),out=[];
for(let k=20;k<=c.length;k+=15){const b=c.slice(0,k).map((x,i)=>({time:i*60,open:x.o,high:x.h,low:x.l,close:x.c})),w=new Map(c.slice(0,k).map((x,i)=>[i*60,x.v])),p=V.build(b,w);out.push([k,p.poc,p.vah,p.val]);}
console.log(JSON.stringify(out));"""
try:
    got = json.loads(subprocess.run(["node", "-e", js, os.path.join(ROOT, "static", "volprofile.js")], input=json.dumps(candles), capture_output=True, text=True, check=True).stdout)
    worst = 0.0
    for k, poc, vah, val in got:
        p = panel_profile.build_profile(candles[:k], rows=24, va_pct=70, va_step=2, like_chart=True)
        worst = max(worst, abs(p["poc"] - poc), abs(p["vah"] - vah), abs(p["val"] - val))
    check(f"the panel's POC, VAH, VAL = the chart's (volprofile.js) at {len(got)} moments of the day (largest gap {worst:.6f})", worst < 1e-6)
except (OSError, subprocess.CalledProcessError) as exc:
    check(f"node could not run volprofile.js: {exc}", False)

# 4
early = panel_engine.PanelEngine(cfg, prev, "2026-11-16", 1).update(candles[:10])
check('before 09:30: "Too early to read"', early["label"] == "Too early to read")
blind = vppanel.feed({"engine": panel_engine.PanelEngine(cfg, prev, "2026-11-16", 1), "done": 0, "out": None, "alerts": []}, day(volume=False)[:120])
check("no volume: the flags say so, and the VWAP check is not available", any("No volume received" in f for f in blind["flags"]) and blind["vwap"] is None and "not available" in blind["checks"][0]["result"])
check("the candle the server makes: start time, prices, 0 for a missing futures minute",
      vppanel.candles_of([{"time": 1794541500, "open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5}], {}) == [{"hm": "09:15", "o": 1.0, "h": 2.0, "l": 0.5, "c": 1.5, "v": 0.0}])

# 17 November: the shape is the chart's (the owner: "Panel show the same shape name as the chart, so they never disagree")
import panel_profile
shape_js = """
const V = require(process.argv[1]), cs = JSON.parse(require("fs").readFileSync(0, "utf8")), out = [];
const T0 = 1794887100, bars = cs.map((c, i) => ({ time: T0 + i * 60, open: c.o, high: c.h, low: c.l, close: c.c })), W = new Map(cs.map((c, i) => [T0 + i * 60, c.v]));
for (let k = 16; k <= bars.length; k += 7) { const q = V.read(bars.slice(0, k), W); out.push([k, q.shape, q.zoneLow, q.zoneHigh]); }
console.log(JSON.stringify(out));
"""
try:
    for label, cs in (("a made-up day", candles), ("a two-zone day", [dict(c, o=c["o"] + (180 if i >= 190 else 0), h=c["h"] + (180 if i >= 190 else 0), l=c["l"] + (180 if i >= 190 else 0), c=c["c"] + (180 if i >= 190 else 0)) for i, c in enumerate(candles)])):
        got = json.loads(subprocess.run(["node", "-e", shape_js, os.path.join(ROOT, "static", "vpshape.js")], input=json.dumps(cs), capture_output=True, text=True, check=True).stdout)
        bad = [k for k, shape, zl, zh in got if panel_profile.chart_shape(cs[:k])["shape"] != shape or (shape == "Double" and (abs(panel_profile.chart_shape(cs[:k])["low_poc"] - zl) > 1e-6 or abs(panel_profile.chart_shape(cs[:k])["high_poc"] - zh) > 1e-6))]
        check(f"{label}: the shape rule in Python = the chart's (vpshape.js) at {len(got)} moments, shapes seen {sorted(set(g[1] for g in got))}", not bad)
        eng, seen, wrong = panel_engine.PanelEngine(dict(cfg, match_chart_shape=True), prev, "2026-11-16", 1), set(), 0
        names = {"P": "P", "B": "b", "D": "D", "Double": "double"}
        for k in range(1, len(cs) + 1):
            o = eng.update(cs[:k])
            if o["shape"]["shown"] == "too_early":
                continue
            want = names[panel_profile.chart_shape(cs[:k])["shape"]]
            seen.add(want); wrong += o["shape"]["shown"] != want or o["shape"]["raw"] != want
        check(f"{label}: every minute the panel shows the chart's shape, at once (shapes {sorted(seen)})", wrong == 0 and len(seen) >= 1)
    two = vppanel.chart_words(panel_engine.PanelEngine(dict(cfg, match_chart_shape=True), prev, "2026-11-16", 1).update(cs))
    text = json.dumps(two, default=str)
    check("the panel's sentences use the chart's names (no 'Double distribution', no 'b-shape')", "Double distribution" not in text and "b-shape" not in text)
    plain = panel_engine.PanelEngine({k: v for k, v in cfg.items() if k not in ("match_chart_shape", "match_chart_poc")}, prev, "2026-11-16", 1)
    for k in range(1, 200):
        o2 = plain.update(candles[:k])
    check("with the setting off the document's own shape rule runs, untouched", "chart" not in o2["shape"] and plain.cfg.get("match_chart_shape") is None)
    # "Match every number": the POC whose movement the panel watches is the chart's own
    pe = panel_engine.PanelEngine(dict(cfg, match_chart_shape=True, match_chart_poc=True), prev, "2026-11-16", 1)
    off, n_mig = 0, 0
    for k in range(1, len(candles) + 1):
        o3 = pe.update(candles[:k])
        if o3["migration"]:
            n_mig += 1
            off += abs(o3["migration"]["to"] - o3["profile"]["poc"]) > 1e-9
    check(f"the POC movement check reads the chart's POC at every one of {n_mig} minutes", n_mig > 100 and off == 0)
    check("and its sentence says so (no 'Busiest 5-point row')", "Busiest 5-point row" not in json.dumps(vppanel.chart_words(o3), default=str) and "Today's POC" in json.dumps(vppanel.chart_words(o3), default=str))
except Exception as exc:  # noqa: BLE001
    import traceback; traceback.print_exc()
    check(f"the shape check could not run: {exc}", False)

# 17 November: the volume that comes late (the owner's photo after a restart: "NOT the same as the chart ... VWAP: panel none")
from datetime import date as _date, datetime as _dt
import dhan  # noqa: E402
_T0 = int(_dt(2026, 11, 17, 9, 15, tzinfo=dhan.IST).timestamp())
_bars = [{"time": _T0 + i * 60, "open": c["o"], "high": c["h"], "low": c["l"], "close": c["c"]} for i, c in enumerate(candles)]
_vols = [[_T0 + i * 60, c["v"]] for i, c in enumerate(candles)]
_clock = {"now": _T0 + 375 * 60 + 600}
vppanel.time.time = lambda: _clock["now"]
dhan.today_ist = lambda: _date(2026, 11, 17)
dhan.intraday = lambda name, minutes: _bars
vppanel.previous_of = lambda name, today: (prev, "2026-11-16")
vppanel.config_for = lambda name: cfg
def _state(volume):
    if volume is None:
        def refuse(name, minutes, days_back=8):
            raise dhan.DhanError("other", "the instrument list is still being read")
        dhan.future_volume = refuse
    else:
        dhan.future_volume = lambda name, minutes, days_back=8: {"contract": {"name": "X FUT", "expiry": "2026-11-23"}, "rolled": None, "bars": volume}
    return vppanel.state("NIFTY 50")
strip = lambda o: json.dumps({k: o[k] for k in ("label", "score", "checks", "shape", "profile", "vwap", "status_line")}, sort_keys=True, default=str)
vppanel._engines.clear(); right = _state(_vols)
vppanel._engines.clear(); first = _state(None)
check("right after a restart, no volume yet: the panel says so (no VWAP)", first["vwap"] is None and first["volume_problem"])
later = _state(_vols)
check("the volume comes: the day is read again, and the panel is the one a full day with volume gives", strip(later) == strip(right) and later["vwap"] is not None)
again = _state(_vols)
check("nothing changed: no second reading (the same engine, the same output)", strip(again) == strip(right) and vppanel._engines["NIFTY 50"]["done"] == 375)
vppanel._engines.clear(); _clock["now"] = _T0 + 200 * 60 + 5
part = _state(_vols[:199])  # the 200th minute's candle is there, its futures volume not yet
check("a minute whose volume has not come yet is read with none", vppanel._engines["NIFTY 50"]["fed"][199] == 0.0 and part["candles"] == 200)
full = _state(_vols[:200])
vppanel._engines.clear(); want = _state(_vols[:200])
check("that minute's volume comes late: the panel is the same as if it had come in time", strip(full) == strip(want))
check("stale: only a changed volume of a candle already fed", vppanel.stale({"fed": [1.0, 2.0]}, [{"v": 1.0}, {"v": 2.0}, {"v": 9.0}]) is False and vppanel.stale({"fed": [1.0, 0.0]}, [{"v": 1.0}, {"v": 2.0}]) is True and vppanel.stale({}, [{"v": 1.0}]) is False)

# the checklist's replay of every day of a futures-volume file
if len(sys.argv) > 1:
    days = OrderedDict()
    for r in csv.DictReader(open(sys.argv[1])):
        days.setdefault(r["Date"], []).append({"hm": r["Time"][:5], "o": float(r["Open"]), "h": float(r["High"]), "l": float(r["Low"]), "c": float(r["Close"]), "v": float(r["Volume"]) if r["Volume"] else 0.0})
    done, bad, pv = 0, [], None
    for d, c in days.items():
        try:
            e = {"engine": panel_engine.PanelEngine(cfg, pv, d, 1), "done": 0, "out": None, "alerts": []}
            vppanel.feed(e, c); done += 1
        except Exception as exc:  # noqa: BLE001
            bad.append(f"{d}: {exc}")
        if c[0]["hm"] == "09:15" and len(c) >= 338:
            pv = panel_engine.previous_levels(c, cfg)
    check(f"{os.path.basename(sys.argv[1])}: {done} of {len(days)} days replayed minute by minute without an error" + ("; " + "; ".join(bad[:3]) if bad else ""), not bad)
    # the cross-check, every minute (17 November, the owner: "charts all values and panels value should match always"): the last 18
    # days of the file, each minute: the engine's POC, VAH, VAL and VWAP (the profile fields and the levels list) against the
    # chart's own code (volprofile.js) and the page's VWAP formula, run with node
    js2 = """const V=require(process.argv[1]),days=JSON.parse(require('fs').readFileSync(0,'utf8')),out={};
for(const [d,c] of Object.entries(days)){const rows=[];let pv=0,vv=0;for(let k=1;k<=c.length;k++){const x=c[k-1];if(x.v>0){pv+=x.v*(x.h+x.l+x.c)/3;vv+=x.v;}
const s=c.slice(0,k),have=s.some(y=>y.v>0),p=V.build(s.map((y,i)=>({time:i*60,open:y.o,high:y.h,low:y.l,close:y.c})),have?new Map(s.map((y,i)=>[i*60,y.v])):null);rows.push([p.poc,p.vah,p.val,vv>0?pv/vv:null]);}out[d]=rows;}
console.log(JSON.stringify(out));"""
    use = OrderedDict((d, days[d]) for d in list(days)[-18:])
    chart = json.loads(subprocess.run(["node", "-e", js2, os.path.join(ROOT, "static", "volprofile.js")], input=json.dumps(use), capture_output=True, text=True, check=True).stdout)
    n = wrong = 0; worst = 0.0
    for d, c in use.items():
        eng = panel_engine.PanelEngine(cfg, None, d, 1)
        for k in range(1, len(c) + 1):
            o, q = eng.update(c[:k]), chart[d][k - 1]; n += 1
            lv = {l["name"]: l["price"] for l in o["levels"]}
            gaps = [abs(o["profile"]["poc"] - q[0]), abs(o["profile"]["vah"] - q[1]), abs(o["profile"]["val"] - q[2]), abs((o["vwap"] or 0) - (q[3] or 0))]
            gaps += [abs(lv[nm] - q[i]) for nm, i in (("Today's POC", 0), ("Today's VAH", 1), ("Today's VAL", 2), ("VWAP", 3)) if nm in lv and q[i] is not None]
            worst = max(worst, max(gaps)); wrong += max(gaps) > 1e-6
    check(f"every minute of the last {len(use)} days ({n} minutes): the panel's POC, VAH, VAL and VWAP = the chart's ({wrong} different, largest gap {worst:.6f})", wrong == 0)
print("all fine" if ok else "SOMETHING FAILED"); sys.exit(0 if ok else 1)
