# The evening's Paper calls and Trade Plan numbers from the server's calls CSV (rebuilt 20 Nov): python3 wf/evening.py <scratchpad> <date>
import csv, json, sys
S, D = sys.argv[1], sys.argv[2]; LOT = {"NIFTY 50": 65, "NIFTY BANK": 30, "SENSEX": 20}
rows = [x for x in csv.DictReader(open(f"{S}/sessall/{D}-calls.csv")) if x["levels"] == "close" and x["time_frame"] == "5m"]
f = lambda v: float(v) if v not in ("", None) else None
out = {"paper": {}, "plan": None}
for ix in LOT:
    r = [x for x in rows if x["index"] == ix]; pts = [f(x["points"]) or 0 for x in r]; rs = 0
    for x in r:
        p, s = f(x["premium_paid"]), f(x["sold_at_premium"]) or f(x["premium_now"])
        if p and s: rs += (s - p) * LOT[ix]
    out["paper"][ix] = {"calls": len(r), "won": sum(1 for p in pts if p > 0), "pts": round(sum(pts), 2), "rs": round(rs), "ce_pts": round(sum(f(x["points"]) or 0 for x in r if x["option_side"] == "CE"), 2), "pe_pts": round(sum(f(x["points"]) or 0 for x in r if x["option_side"] == "PE"), 2)}
t = [x for x in rows if x["index"] == "NIFTY 50" and x["plan"] == "TAKE"]; k = [x for x in rows if x["index"] == "NIFTY 50" and x["plan"] != "TAKE"]
rs = sum(((f(x["sold_at_premium"]) or f(x["premium_now"])) - f(x["premium_paid"])) * 65 for x in t if f(x["premium_paid"]) and (f(x["sold_at_premium"]) or f(x["premium_now"])))
out["plan"] = {"calls": len(t), "won": sum(1 for x in t if (f(x["points"]) or 0) > 0), "points": round(sum(f(x["points"]) or 0 for x in t), 2), "after_8": round(sum((f(x["points"]) or 0) - 8 for x in t), 2), "rupees": round(rs), "list": [x["signal_time_ist"][-8:-3] + " " + x["option_side"] + " " + x["points"] for x in t], "left_out": {"calls": len(k), "after_8": round(sum((f(x["points"]) or 0) - 8 for x in k), 2)}}
lock = [x for x in rows if x["index"] == "NIFTY 50" and x["lock"]]; out["lock_rows"] = len(lock); out["lc_take"] = {"calls": sum(1 for x in rows if x["index"] == "NIFTY 50" and x["lc"] == "TAKE"), "pts": round(sum(f(x["points"]) or 0 for x in rows if x["index"] == "NIFTY 50" and x["lc"] == "TAKE"), 2)}
print(json.dumps(out, indent=1))
