"""panel_engine.py - the live explanation panel.

Call PanelEngine.update() once after every finished candle. It returns a dict that the page
shows: a status line, the checks behind it, the shape, key levels, a conditions table,
alerts and day flags. Pure rules: same input, same output. No orders are ever placed.
"""
import json, math, os
from panel_profile import build_profile, row_lo, row_hi, chart_shape

HERE = os.path.dirname(os.path.abspath(__file__))
WARNING = "Describes the chart's structure so far. Not a prediction or a buy/sell recommendation."

SHAPE_NAMES = {"P": "P-shape", "b": "b-shape", "D": "D-shape", "leaning_P": "Leaning P",
               "leaning_b": "Leaning b", "double": "Double distribution", "trend_up": "Trend up",
               "trend_down": "Trend down", "unclear": "Unclear", "too_early": "Too early"}


def shape_title(sh):
    """Display name of the shown shape, with ', failing' when price has left the bulge."""
    name = SHAPE_NAMES[sh["shown"]]
    return name + ", failing" if sh.get("failing_shown") else name


def load_config(path=None):
    return json.load(open(path or os.path.join(HERE, "panel_config.json")))


def mins(hm):
    h, m = hm.split(":")
    return int(h) * 60 + int(m)


def fmt(x, d=0):
    return ("{:,.%df}" % d).format(x) if x is not None else "n/a"


# ---------------------------------------------------------------- building blocks
def five_minute_closes(candles, interval, start="09:15"):
    """Closes of COMPLETED 5-minute blocks (09:15-09:19, 09:20-09:24, ...).
    A block is complete when a candle finishing at its end has arrived, or when a later
    block has started (covers missing candles). Returns [(block_number, close)]."""
    s = mins(start)
    last, done = {}, set()
    for c in candles:
        t = mins(c["hm"])
        b = (t - s) // 5
        last[b] = c["c"]
        if t + interval >= s + 5 * (b + 1):
            done.add(b)
    if last:
        top = max(last)
        done |= {b for b in last if b < top}
    return [(b, last[b]) for b in sorted(done)]


def vwap(candles):
    num = den = 0.0
    for c in candles:
        v = float(c.get("v") or 0)
        if v > 0:
            num += (c["h"] + c["l"] + c["c"]) / 3.0 * v
            den += v
    return num / den if den else None


def previous_levels(prev_candles, cfg):
    """Yesterday's VAH, POC, VAL with the Signal's method (fixed rows, one row at a time)."""
    p = build_profile(prev_candles, row_size=cfg["prev_levels_row_size_pts"], va_pct=cfg["va_pct"],
                      va_step=cfg["prev_levels_va_step_rows"])
    return {"vah": p["vah"], "poc": p["poc"], "val": p["val"], "high": p["high"], "low": p["low"],
            "close": prev_candles[-1]["c"]}


def analyse_shape(p, candles, last, now_hm, cfg, closes5=()):
    """Classify the profile. Order: too early, double, trend, P, b, leaning P, leaning b, D, unclear.
    The shape is read from the profile alone. Whether price still holds the bulge is tracked by
    PanelEngine (see _track_failure)."""
    n, vol = p["n"], p["vol"]
    rng = p["high"] - p["low"]
    pocv = vol[p["poc_i"]]
    out = {"pos": None, "lower_tail_frac": None, "upper_tail_frac": None}
    elapsed = mins(now_hm) - mins(cfg["session_start"])
    if elapsed < cfg["min_minutes"] or rng < cfg["min_range_pts"] or n < 6:
        out["shape"] = "too_early"
        return out
    thin = [v < cfg["thin_row_pct"] / 100.0 * pocv for v in vol]
    lt = 0
    while lt < n and thin[lt]:
        lt += 1
    ut = 0
    while ut < n and thin[n - 1 - ut]:
        ut += 1
    lower_tail_top = row_lo(p, lt) if lt < n else p["high"]
    upper_tail_bottom = row_hi(p, n - 1 - ut) if ut < n else p["low"]
    lo_frac = max(0.0, min(1.0, (lower_tail_top - p["low"]) / rng))
    up_frac = max(0.0, min(1.0, (p["high"] - upper_tail_bottom) / rng))
    b_lo = b_hi = p["poc_i"]
    while b_lo > 0 and not thin[b_lo - 1]:
        b_lo -= 1
    while b_hi < n - 1 and not thin[b_hi + 1]:
        b_hi += 1
    pos = (p["poc"] - p["low"]) / rng
    mid = (p["high"] + p["low"]) / 2.0
    out.update({"pos": pos, "mid": mid, "lower_tail_frac": lo_frac, "upper_tail_frac": up_frac,
                "lower_tail": (p["low"], lower_tail_top) if lt else None,
                "upper_tail": (upper_tail_bottom, p["high"]) if ut else None,
                "bulge_low": row_lo(p, b_lo), "bulge_high": row_hi(p, b_hi)})

    dbl = find_double(p, thin, cfg)
    if dbl:
        side = "upper" if last > dbl["gap_high"] else "lower" if last < dbl["gap_low"] else "gap"
        dbl["price_side"] = side
        out.update({"shape": "double", "double": dbl})
        return out

    ib = [c for c in candles if mins(c["hm"]) < mins(cfg["ib_end"])]
    ib_done = mins(now_hm) >= mins(cfg["ib_end"])
    if ib_done and ib:
        ib_range = max(c["h"] for c in ib) - min(c["l"] for c in ib)
        flat = pocv <= cfg["trend_flat_mult"] * (p["total"] / n)
        wide = (p["vah"] - p["val"]) >= cfg["trend_va_width_frac"] * rng
        if ib_range > 0 and rng >= cfg["trend_range_mult"] * ib_range and (flat or wide):
            if last >= p["high"] - cfg["trend_end_frac"] * rng:
                out["shape"] = "trend_up"
                return out
            if last <= p["low"] + cfg["trend_end_frac"] * rng:
                out["shape"] = "trend_down"
                return out

    t, sym, lean = cfg["tail_min_frac"], cfg["d_symmetry_frac"], cfg["lean_pos_frac"]
    skew = lo_frac - up_frac                # > 0: the longer thin tail is below, so the bulge sits high
    if pos >= 2 / 3.0 and lo_frac >= t:
        shape = "P"
    elif pos <= 1 / 3.0 and up_frac >= t:
        shape = "b"
    elif pos >= 2 / 3.0 or (skew > sym and pos > lean):
        shape = "leaning_P"             # bulge high, but no clear thin tail below yet
    elif pos <= 1 / 3.0 or (skew < -sym and pos < 1 - lean):
        shape = "leaning_b"
    elif 1 / 3.0 < pos < 2 / 3.0 and abs(skew) <= sym:
        shape = "D"
    else:
        shape = "unclear"
    out["shape"] = shape
    return out


def find_double(p, thin, cfg):
    """Two peaks (each >= double_peak_pct % of the highest smoothed row), at least
    double_min_sep_frac of the rows apart, with a valley <= double_valley_pct % of the smaller
    peak, and >= double_min_side_pct % of all volume on each side of the valley."""
    n, vol = p["n"], p["vol"]
    s = []
    for i in range(n):
        w = vol[max(0, i - 1):i + 2]
        s.append(sum(w) / len(w))
    smax = max(s)
    peaks = [i for i in range(n) if s[i] >= cfg["double_peak_pct"] / 100.0 * smax
             and (i == 0 or s[i] > s[i - 1]) and (i == n - 1 or s[i] >= s[i + 1])]
    sep = max(2, int(math.ceil(cfg["double_min_sep_frac"] * n)))
    best = None
    for a in range(len(peaks)):
        for b in range(a + 1, len(peaks)):
            i, j = peaks[a], peaks[b]
            if j - i < sep:
                continue
            k = min(range(i, j + 1), key=lambda x: s[x])
            depth = s[k] / min(s[i], s[j])
            below, above = sum(vol[:k]), sum(vol[k + 1:])
            if depth > cfg["double_valley_pct"] / 100.0:
                continue
            if min(below, above) < cfg["double_min_side_pct"] / 100.0 * p["total"]:
                continue
            if best is None or depth < best[0]:
                best = (depth, i, j, k)
    if not best:
        return None
    _, i, j, k = best
    g_lo = g_hi = k
    while g_lo - 1 > i and thin[g_lo - 1]:
        g_lo -= 1
    while g_hi + 1 < j and thin[g_hi + 1]:
        g_hi += 1
    lower_poc_i = max(range(0, g_lo), key=lambda x: vol[x])
    upper_poc_i = max(range(g_hi + 1, n), key=lambda x: vol[x])
    mid = lambda x: (row_lo(p, x) + row_hi(p, x)) / 2.0
    return {"gap_low": row_lo(p, g_lo), "gap_high": row_hi(p, g_hi),
            "lower_poc": mid(lower_poc_i), "upper_poc": mid(upper_poc_i)}


def acceptance(closes5, prev, cfg):
    above = below = 0
    for _, c in reversed(closes5):
        if c > prev["vah"]:
            above += 1
        else:
            break
    for _, c in reversed(closes5):
        if c < prev["val"]:
            below += 1
        else:
            break
    need = cfg["acceptance_closes"]
    if above >= need:
        state = "accepted_above"
    elif below >= need:
        state = "accepted_below"
    elif closes5 and closes5[-1][1] > prev["vah"]:
        state = "testing_above"
    elif closes5 and closes5[-1][1] < prev["val"]:
        state = "testing_below"
    else:
        state = "inside"
    return {"state": state, "closes_above": above, "closes_below": below,
            "strong": max(above, below) >= cfg["strong_acceptance_closes"]}


def edge_activity(p, cfg):
    if p["mode"] != "volume":
        return None
    n = p["n"]
    k = max(2, int(round(cfg["edge_rows_frac"] * n)))
    def share(rows):
        u = sum(p["up"][i] for i in rows)
        t = sum(p["vol"][i] for i in rows)
        return 100.0 * u / t if t else None
    return {"top_buy_pct": share(range(n - k, n)), "bottom_buy_pct": share(range(0, k)), "rows": k}


def oi_lean(price_open, last, oi_open, oi_now, cfg):
    if not oi_open or oi_now is None:
        return None
    oi_pct = 100.0 * (oi_now - oi_open) / oi_open
    px_pct = 100.0 * (last - price_open) / price_open
    up = px_pct >= cfg["price_change_pct"]
    down = px_pct <= -cfg["price_change_pct"]
    if up and oi_pct >= cfg["oi_change_pct"]:
        lean = "new_buying"
    elif up and oi_pct <= -cfg["oi_change_pct"]:
        lean = "short_covering"
    elif down and oi_pct >= cfg["oi_change_pct"]:
        lean = "new_selling"
    elif down and oi_pct <= -cfg["oi_change_pct"]:
        lean = "long_liquidation"
    else:
        lean = "none"
    return {"lean": lean, "oi_change_pct": oi_pct, "price_change_pct": px_pct}


# ---------------------------------------------------------------- the panel
class PanelEngine:
    """One engine per index per day. Keeps the small amount of history the rules need."""

    def __init__(self, cfg, prev=None, date=None, interval=None):
        self.cfg = cfg
        self.prev = prev                      # dict from previous_levels(), or None
        self.date = date                      # "YYYY-MM-DD"
        self.interval = interval or cfg["candle_minutes"]
        self.poc_hist = []                    # [(minute, fixed-row POC)]
        self.raw_shapes = []
        self.shown_shape = None
        self.shown_label = None
        self.fail_side = None
        self.failing = False
        self.last_double = None
        self.last = None                      # previous output
        self.last_alert = {}                  # alert type -> minute
        self.last_poc_alert = None
        self.mig_row = cfg["migration_row_size_pts"]
        self.oi_open = None

    # .............................................................. main entry
    def update(self, candles, oi_now=None, oi_open=None):
        cfg = self.cfg
        if not candles:
            raise ValueError("no candles")
        if oi_open is not None:
            self.oi_open = oi_open
        elif self.oi_open is None and oi_now is not None:
            self.oi_open = oi_now             # first OI reading of the day
        now = mins(candles[-1]["hm"]) + self.interval
        now_hm = "%02d:%02d" % (now // 60, now % 60)
        last = candles[-1]["c"]
        p = build_profile(candles, rows=cfg["display_rows"], va_pct=cfg["va_pct"], va_step=cfg["va_step_rows"],
                          like_chart=bool(cfg.get("match_chart_profile")))  # the page's own arithmetic, so panel and chart agree
        pf = build_profile(candles, row_size=cfg["migration_row_size_pts"], va_pct=cfg["va_pct"], va_step=1,
                           use_volume=p["mode"] == "volume")
        # the page's setting (17 November 2026, the owner: "Match every number"): the POC whose movement is watched is the
        # chart's own (today's POC, the row the chart draws), and a move counts from one chart row on; off: the document's
        # busiest fixed 5-point row, as written
        chart_poc = bool(cfg.get("match_chart_poc"))
        self.mig_row = p["step"] if chart_poc else cfg["migration_row_size_pts"]
        self.poc_hist.append((now, p["poc"] if chart_poc else pf["poc"]))

        closes5 = five_minute_closes(candles, self.interval, cfg["session_start"])
        shape = analyse_shape(p, candles, last, now_hm, cfg, closes5)
        ib = [c for c in candles if mins(c["hm"]) < mins(cfg["ib_end"])]
        shape["ib_high"] = max(c["h"] for c in ib) if ib else None
        shape["ib_low"] = min(c["l"] for c in ib) if ib else None
        if cfg.get("match_chart_shape") and shape["shape"] != "too_early":
            # the page's setting (17 November 2026, the owner: "Panel show the same shape name as the chart, so they never
            # disagree ... keep the logic same so new numbers will work according to the logic only"): the shape is the one
            # the chart names (static/vpshape.js: P, b, D or Double Zone); everything the document does with a shape
            # afterwards is unchanged: the first minutes stay "too early", a new shape is shown only after it has held for
            # stable_minutes (the page sets 5; 18 November: "The 10-minute smoothing should also still apply, so the label doesn't flip every
            # minute"; the chart's own label of the running day is drawn from this shown shape, so the two cannot differ),
            # its check, the bulge of a P or a b, the gap of a Double Zone, the conditions and the alerts
            cs = chart_shape(candles, thin_pct=cfg["thin_row_pct"])
            shape.pop("double", None)
            shape["shape"] = {"P": "P", "B": "b", "D": "D", "Double": "double"}[cs["shape"]]
            if cs["shape"] == "Double":
                shape["double"] = {"gap_low": cs["gap_low"], "gap_high": cs["gap_high"], "lower_poc": cs["low_poc"], "upper_poc": cs["high_poc"],
                                   "price_side": "upper" if last > cs["gap_high"] else "lower" if last < cs["gap_low"] else "gap"}
        raw = shape["shape"]
        self.raw_shapes.append(raw)
        k = max(1, int(math.ceil(cfg["stable_minutes"] / float(self.interval))))
        if self.shown_shape is None or raw == "too_early" or self.shown_shape == "too_early":
            self.shown_shape = raw
        elif raw != self.shown_shape and len(self.raw_shapes) >= k and all(s == raw for s in self.raw_shapes[-k:]):
            self.shown_shape = raw
        if raw == "double":
            self.last_double = dict(shape["double"])
        if self.shown_shape == "double" and raw != "double" and self.last_double:
            d = dict(self.last_double)          # shown shape lags the raw one: reuse the last double read
            d["price_side"] = "upper" if last > d["gap_high"] else "lower" if last < d["gap_low"] else "gap"
            shape["double"] = d
        shape["raw"] = raw
        shape["shown"] = self.shown_shape
        shape["failing"] = shape["failing_shown"] = self._track_failure(shape, closes5)
        shape["status"] = ("forming" if now < mins(cfg["ib_end"]) else
                           "developing" if now < mins(cfg["session_end"]) else "confirmed")

        vw = vwap(candles)
        acc = acceptance(closes5, self.prev, cfg) if self.prev else None
        edge = edge_activity(p, cfg)
        oi = oi_lean(candles[0]["o"], last, self.oi_open, oi_now, cfg)
        mig = self._migration(now)

        self._today = p
        checks = self._checks(last, vw, acc, mig, shape, edge, oi)
        score = sum(c["score"] for c in checks)
        label = self.shown_label = self._label(score, shape)
        out = {"date": self.date, "time": now_hm, "price": last, "label": label, "score": score,
               "checks": checks, "shape": shape, "profile": {"poc": p["poc"], "vah": p["vah"], "val": p["val"],
               "high": p["high"], "low": p["low"], "mode": p["mode"], "row_size": p["step"]},
               "vwap": vw, "acceptance": acc, "edge": edge, "oi": oi, "migration": mig,
               "closes5": closes5[-2:], "warning": WARNING}
        out["levels"], out["zones"] = self._levels(out)
        out["conditions"] = self._conditions(out)
        out["flags"] = self._flags(candles, out)
        out["status_line"] = self._status_line(out)
        out["alerts"] = self._alerts(out, now)
        self.last = out
        return out

    # .............................................................. pieces
    def _migration(self, now):
        cfg = self.cfg
        cur = self.poc_hist[-1][1]
        for look in (cfg["poc_lookback_long_min"], cfg["poc_lookback_short_min"]):
            past = [poc for t, poc in self.poc_hist if t <= now - look]
            if past:
                d = cur - past[-1]
                thr = max(cfg["poc_move_min_pts"], self.mig_row)
                trend = "rising" if d >= thr else "falling" if d <= -thr else "steady"
                return {"minutes": look, "from": past[-1], "to": cur, "change": d, "trend": trend}
        return None

    def _checks(self, last, vw, acc, mig, shape, edge, oi):
        cfg, prev, out = self.cfg, self.prev, []
        if vw is None:
            out.append(("VWAP", "VWAP not available (no volume)", 0))
        elif last > vw + cfg["vwap_buffer_pts"]:
            out.append(("VWAP", "Price above VWAP (%s)" % fmt(vw, 2), 1))
        elif last < vw - cfg["vwap_buffer_pts"]:
            out.append(("VWAP", "Price below VWAP (%s)" % fmt(vw, 2), -1))
        else:
            out.append(("VWAP", "Price at VWAP (%s)" % fmt(vw, 2), 0))

        if not acc:
            out.append(("Yesterday's value", "Yesterday's levels not available", 0))
        else:
            s = acc["state"]
            txt = {"accepted_above": ("Accepted above yesterday's VAH (%s): %d five-minute closes above"
                                      % (fmt(prev["vah"], 2), acc["closes_above"]), 1),
                   "accepted_below": ("Accepted below yesterday's VAL (%s): %d five-minute closes below"
                                      % (fmt(prev["val"], 2), acc["closes_below"]), -1),
                   "testing_above": ("Testing above yesterday's VAH (%s), not yet accepted" % fmt(prev["vah"], 2), 0),
                   "testing_below": ("Testing below yesterday's VAL (%s), not yet accepted" % fmt(prev["val"], 2), 0),
                   "inside": ("Inside yesterday's value area (%s to %s)" % (fmt(prev["val"], 2), fmt(prev["vah"], 2)), 0)}[s]
            out.append(("Yesterday's value",) + txt)

        if not mig:
            out.append(("POC movement", "Not enough history yet", 0))
        else:
            sc = {"rising": 1, "falling": -1, "steady": 0}[mig["trend"]]
            out.append(("POC movement", "Busiest 5-point row %s: %s to %s in %d min"
                        % (mig["trend"], fmt(mig["from"]), fmt(mig["to"]), mig["minutes"]), sc))

        s = shape["shown"]
        side = shape.get("double", {}).get("price_side") if s == "double" else None
        failing = shape.get("failing_shown")
        fail_txt = {
            "P": ("P-shape failing: two 5-minute closes below the bulge (%s)" % fmt(shape.get("bulge_low")), -1),
            "leaning_P": ("Leaning P failing: two 5-minute closes below the bulge (%s)" % fmt(shape.get("bulge_low")), 0),
            "b": ("b-shape failing: two 5-minute closes above the bulge (%s)" % fmt(shape.get("bulge_high")), 1),
            "leaning_b": ("Leaning b failing: two 5-minute closes above the bulge (%s)" % fmt(shape.get("bulge_high")), 0)}
        shape_txt = {
            "P": ("P-shape: buyers in control of the session so far", 1),
            "b": ("b-shape: sellers in control of the session so far", -1),
            "trend_up": ("Trend-up profile: long and thin, value moving up", 1),
            "trend_down": ("Trend-down profile: long and thin, value moving down", -1),
            "leaning_P": ("Leaning P: buyers ahead, but not yet a clear P", 0),
            "leaning_b": ("Leaning b: sellers ahead, but not yet a clear b", 0),
            "D": ("D-shape: balanced, neither side in control", 0),
            "unclear": ("No clear shape", 0),
            "too_early": ("Too early to read a shape", 0),
            "double": ({"upper": ("Double distribution: price in the upper value", 1),
                        "lower": ("Double distribution: price in the lower value", -1),
                        "gap": ("Double distribution: price inside the thin gap", 0)}.get(side, ("Double distribution", 0)))}[s]
        testing = None
        if not failing and s in ("P", "leaning_P") and shape.get("bulge_low") is not None and last < shape["bulge_low"]:
            testing = ("%s: price testing below the bulge (%s), not yet failing" % (SHAPE_NAMES[s], fmt(shape["bulge_low"])), 0)
        if not failing and s in ("b", "leaning_b") and shape.get("bulge_high") is not None and last > shape["bulge_high"]:
            testing = ("%s: price testing above the bulge (%s), not yet failing" % (SHAPE_NAMES[s], fmt(shape["bulge_high"])), 0)
        if failing and s in fail_txt:
            shape_txt = fail_txt[s]
        elif testing:
            shape_txt = testing
        out.append(("Shape",) + shape_txt)

        tv = self._today
        if last > tv["vah"]:
            out.append(("Today's value", "Price above today's value area (VAH %s)" % fmt(tv["vah"], 2), 1))
        elif last < tv["val"]:
            out.append(("Today's value", "Price below today's value area (VAL %s)" % fmt(tv["val"], 2), -1))
        else:
            out.append(("Today's value", "Price inside today's value area (%s to %s)" % (fmt(tv["val"], 2), fmt(tv["vah"], 2)), 0))

        if not edge:
            out.append(("Activity at the edges", "Not available (no volume)", 0))
        else:
            parts, sc = [], 0
            hi_t, lo_t = cfg["edge_buy_high_pct"], cfg["edge_buy_low_pct"]
            tb, bb = edge["top_buy_pct"], edge["bottom_buy_pct"]
            if tb is not None:
                if tb >= hi_t:
                    parts.append("buyers active at the highs (%d%% buying)" % round(tb)); sc += 1
                elif tb <= lo_t:
                    parts.append("sellers active at the highs (%d%% selling)" % round(100 - tb)); sc -= 1
            if bb is not None:
                if bb >= hi_t:
                    parts.append("buyers active at the lows (%d%% buying)" % round(bb)); sc += 1
                elif bb <= lo_t:
                    parts.append("sellers active at the lows (%d%% selling)" % round(100 - bb)); sc -= 1
            txt = "; ".join(parts) if parts else "two-way trade at both edges"
            out.append(("Activity at the edges", txt[0].upper() + txt[1:], max(-1, min(1, sc))))

        if not oi:
            out.append(("Open interest", "Futures OI not available", 0))
        else:
            o = oi["oi_change_pct"]
            txt = {"new_buying": ("Price up, futures OI up %.2f%%: leans new buying" % o, 1),
                   "short_covering": ("Price up, futures OI down %.2f%%: leans short covering; such rallies can fade" % abs(o), 0),
                   "new_selling": ("Price down, futures OI up %.2f%%: leans new selling" % o, -1),
                   "long_liquidation": ("Price down, futures OI down %.2f%%: leans long liquidation; such falls can fade" % abs(o), 0),
                   "none": ("No clear OI lean (OI %+.2f%%)" % o, 0)}[oi["lean"]]
            out.append(("Open interest",) + txt)
        return [{"name": n, "result": r, "score": s} for n, r, s in out]

    def _label(self, score, shape):
        """Score to label, with one point of hysteresis so the label does not flicker:
        a label is kept while the score stays within one point of the level that set it."""
        S, L, cur = self.cfg["bias_strong"], self.cfg["bias_lean"], self.shown_label
        if shape["shown"] == "too_early":
            return "Too early to read"
        if score >= S:
            return "Bullish structure"
        if score <= -S:
            return "Bearish structure"
        if cur == "Bullish structure" and score >= S - 1:
            return cur
        if cur == "Bearish structure" and score <= -(S - 1):
            return cur
        if score >= L:
            return "Leaning bullish"
        if score <= -L:
            return "Leaning bearish"
        if cur == "Leaning bullish" and score >= L - 1:
            return cur
        if cur == "Leaning bearish" and score <= -(L - 1):
            return cur
        return "Balanced" if shape["shown"] == "D" else "Mixed: no clear side"

    def _track_failure(self, shape, closes5):
        """A P (or leaning P) is failing after `acceptance_closes` 5-minute closes in a row below the
        bottom of its bulge, and stays failing until the same number of closes back above it.
        A b (or leaning b) is the mirror image. Resets when the shown shape changes side."""
        s = shape["shown"]
        side = "P" if s in ("P", "leaning_P") else "b" if s in ("b", "leaning_b") else None
        if side != self.fail_side:
            self.fail_side, self.failing = side, False
        need = self.cfg["acceptance_closes"]
        recent = [c for _, c in closes5[-need:]]
        if side is None or len(recent) < need or shape.get("bulge_low") is None:
            return self.failing
        edge = shape["bulge_low"] if side == "P" else shape["bulge_high"]
        beyond = all(c < edge for c in recent) if side == "P" else all(c > edge for c in recent)
        back = all(c > edge for c in recent) if side == "P" else all(c < edge for c in recent)
        if not self.failing and beyond:
            self.failing = True
        elif self.failing and back:
            self.failing = False
        return self.failing

    def _levels(self, out):
        p, sh, prev = out["profile"], out["shape"], self.prev
        lv = [("Day high", p["high"]), ("Today's VAH", p["vah"]), ("Today's POC", p["poc"]),
              ("Today's VAL", p["val"]), ("Day low", p["low"])]
        if out["vwap"] is not None:
            lv.append(("VWAP", out["vwap"]))
        if sh["shown"] in ("P", "leaning_P") and sh.get("bulge_low") is not None:
            lv.append(("Bottom of the bulge", sh["bulge_low"]))
        if sh["shown"] in ("b", "leaning_b") and sh.get("bulge_high") is not None:
            lv.append(("Top of the bulge", sh["bulge_high"]))
        if sh["shown"] in ("trend_up", "trend_down") and sh.get("ib_high") is not None:
            lv += [("First-hour high", sh["ib_high"]), ("First-hour low", sh["ib_low"])]
        if prev:
            lv += [("Yesterday's VAH", prev["vah"]), ("Yesterday's POC", prev["poc"]), ("Yesterday's VAL", prev["val"])]
        levels = [{"name": n, "price": v, "distance": v - out["price"]} for n, v in lv]
        levels.sort(key=lambda x: -x["price"])
        zones = []
        if sh.get("lower_tail") and sh["lower_tail_frac"] >= self.cfg["tail_min_frac"]:
            zones.append({"name": "Thin zone below", "low": sh["lower_tail"][0], "high": sh["lower_tail"][1]})
        if sh.get("upper_tail") and sh["upper_tail_frac"] >= self.cfg["tail_min_frac"]:
            zones.append({"name": "Thin zone above", "low": sh["upper_tail"][0], "high": sh["upper_tail"][1]})
        if sh["shown"] == "double" and sh.get("double"):
            d = sh["double"]
            zones.append({"name": "Thin gap between the two values", "low": d["gap_low"], "high": d["gap_high"]})
        return levels, zones

    def _target_below(self, level, out):
        c = [(out["profile"]["low"], "day low")]
        if self.prev:
            c += [(self.prev["vah"], "yesterday's VAH"), (self.prev["poc"], "yesterday's POC"), (self.prev["val"], "yesterday's VAL")]
        c = [x for x in c if x[0] < level - 1]
        return max(c) if c else (out["profile"]["low"], "day low")

    def _target_above(self, level, out):
        c = [(out["profile"]["high"], "day high")]
        if self.prev:
            c += [(self.prev["vah"], "yesterday's VAH"), (self.prev["poc"], "yesterday's POC"), (self.prev["val"], "yesterday's VAL")]
        c = [x for x in c if x[0] > level + 1]
        return min(c) if c else (out["profile"]["high"], "day high")

    def _conditions(self, out):
        p, sh, vw, acc, prev = out["profile"], out["shape"], out["vwap"], out["acceptance"], self.prev
        s, rows = sh["shown"], []
        vtxt = " and %s (VWAP)" % fmt(vw) if vw is not None else ""
        failing = sh.get("failing_shown")
        if s in ("P", "leaning_P") and failing:
            t = self._target_below(sh["bulge_low"], out)
            rows += [("Two 5-minute closes back above %s (bottom of the bulge)" % fmt(sh["bulge_low"]),
                      "Failure cancelled: the bullish read is restored"),
                     ("Stays below %s" % fmt(sh["bulge_low"]),
                      "Failure continuing; next level %s (%s)" % (fmt(t[0]), t[1]))]
        elif s in ("b", "leaning_b") and failing:
            t = self._target_above(sh["bulge_high"], out)
            rows += [("Two 5-minute closes back below %s (top of the bulge)" % fmt(sh["bulge_high"]),
                      "Failure cancelled: the bearish read is restored"),
                     ("Stays above %s" % fmt(sh["bulge_high"]),
                      "Failure continuing; next level %s (%s)" % (fmt(t[0]), t[1]))]
        elif s in ("P", "leaning_P"):
            t = self._target_below(sh["bulge_low"], out)
            rows += [("Holds above %s (today's POC)%s" % (fmt(p["poc"]), vtxt),
                      "Bullish read holds" if s == "P" else "Bullish lean holds; the shape may become a P"),
                     ("Two 5-minute closes below %s (bottom of the bulge)" % fmt(sh["bulge_low"]),
                      "Bullish read failing: price back in the thin zone; a quick move toward %s (%s) is possible" % (fmt(t[0]), t[1])),
                     ("New highs above %s while today's POC keeps rising" % fmt(p["high"]), "Buyers still extending the move")]
        elif s in ("b", "leaning_b"):
            t = self._target_above(sh["bulge_high"], out)
            rows += [("Stays below %s (today's POC)%s" % (fmt(p["poc"]), vtxt),
                      "Bearish read holds" if s == "b" else "Bearish lean holds; the shape may become a b"),
                     ("Two 5-minute closes above %s (top of the bulge)" % fmt(sh["bulge_high"]),
                      "Bearish read failing: price back in the thin zone; a quick move toward %s (%s) is possible" % (fmt(t[0]), t[1])),
                     ("New lows below %s while today's POC keeps falling" % fmt(p["low"]), "Sellers still extending the move")]
        elif s in ("trend_up", "trend_down"):
            up = s == "trend_up"
            ref = vw if vw is not None else p["poc"]
            rows += [("%s %s (%s)" % ("Holds above" if up else "Stays below", fmt(ref), "VWAP" if vw is not None else "today's POC"),
                      "Trend %s intact. Fading back to the POC is risky on trend days" % ("up" if up else "down")),
                     ("5-minute close %s %s" % ("below" if up else "above", fmt(ref)), "Trend weakening"),
                     ("5-minute close %s %s (first-hour %s)" % ("below" if up else "above", fmt(sh["ib_high"] if up else sh["ib_low"]), "high" if up else "low"),
                      "Trend day failing")]
        elif s == "double":
            d = sh["double"]
            gap = "%s to %s" % (fmt(d["gap_low"]), fmt(d["gap_high"]))
            if d["price_side"] == "upper":
                rows += [("Holds above %s (top of the thin gap)" % fmt(d["gap_high"]),
                          "Move up intact; the upper value (POC %s) is the live reference" % fmt(d["upper_poc"])),
                         ("5-minute close inside the gap (%s)" % gap, "Move on trial"),
                         ("5-minute close below %s" % fmt(d["gap_low"]),
                          "Double distribution failed: back in the old value (POC %s)" % fmt(d["lower_poc"]))]
            elif d["price_side"] == "lower":
                rows += [("Stays below %s (bottom of the thin gap)" % fmt(d["gap_low"]),
                          "Move down intact; the lower value (POC %s) is the live reference" % fmt(d["lower_poc"])),
                         ("5-minute close inside the gap (%s)" % gap, "Move on trial"),
                         ("5-minute close above %s" % fmt(d["gap_high"]),
                          "Double distribution failed: back in the old value (POC %s)" % fmt(d["upper_poc"]))]
            else:
                rows += [("5-minute close above %s" % fmt(d["gap_high"]), "Back into the upper value"),
                         ("5-minute close below %s" % fmt(d["gap_low"]), "Back into the lower value"),
                         ("Stays inside the gap (%s)" % gap, "Undecided; thin zones rarely hold price for long")]
        else:
            rows += [("Stays between %s and %s (today's value area)" % (fmt(p["val"]), fmt(p["vah"])),
                      "Balanced: price rotating. Costly for option buyers because of time decay"),
                     ("Two 5-minute closes above %s" % fmt(p["vah"]), "Leaving balance upward"),
                     ("Two 5-minute closes below %s" % fmt(p["val"]), "Leaving balance downward")]
        if acc and prev:
            if acc["state"] == "accepted_above":
                rows.append(("5-minute close back below %s (yesterday's VAH)" % fmt(prev["vah"]), "Move above yesterday's value failed"))
            elif acc["state"] == "accepted_below":
                rows.append(("5-minute close back above %s (yesterday's VAL)" % fmt(prev["val"]), "Move below yesterday's value failed"))
        return [{"if": a, "then": b} for a, b in rows[:4]]

    def _flags(self, candles, out):
        cfg, f = self.cfg, []
        if self.date and self.date in cfg["expiry_dates"]:
            f.append("Expiry day: option prices can move very fast")
        if self.date and self.date in cfg["event_dates"]:
            f.append("Event day (news or policy): shapes are less reliable")
        if candles[0]["hm"] != cfg["session_start"]:
            f.append("Session started at %s, not %s: the profile may be distorted" % (candles[0]["hm"], cfg["session_start"]))
        if self.prev and self.prev.get("close"):
            g = 100.0 * (candles[0]["o"] - self.prev["close"]) / self.prev["close"]
            if abs(g) >= cfg["large_gap_pct"]:
                f.append("Large gap at the open (%+.2f%%)" % g)
        if out["profile"]["mode"] == "time":
            f.append("No volume received: the profile uses time spent at each price")
        else:
            miss = sum(1 for c in candles if not (c.get("v") or 0) > 0)
            if miss and 100.0 * miss / len(candles) >= cfg["volume_missing_pct"]:
                f.append("Volume missing for %d of %d candles" % (miss, len(candles)))
        sh = out["shape"]
        if sh["status"] == "forming" and sh["shown"] != "too_early":
            f.append("First hour not finished: the shape can still change")
        if sh["raw"] != sh["shown"] and sh["raw"] != "too_early":
            f.append("Shape changing: the latest reading is %s" % SHAPE_NAMES[sh["raw"]])
        return f

    def _status_line(self, out):
        cfg, sh = self.cfg, out["shape"]
        if sh["shown"] == "too_early":
            el = mins(out["time"]) - mins(cfg["session_start"])
            return "Too early to read: %d minutes of data. The panel starts reading after %d minutes." % (el, cfg["min_minutes"])
        parts = []
        vw = out["vwap"]
        if vw is not None:
            rel = ("above" if out["price"] > vw + cfg["vwap_buffer_pts"] else
                   "below" if out["price"] < vw - cfg["vwap_buffer_pts"] else "at")
            parts.append("price %s VWAP (%s)" % (rel, fmt(vw)))
        acc, prev = out["acceptance"], self.prev
        if acc:
            parts.append({"accepted_above": "accepted above yesterday's value (VAH %s)" % fmt(prev["vah"]),
                          "accepted_below": "accepted below yesterday's value (VAL %s)" % fmt(prev["val"]),
                          "testing_above": "testing above yesterday's VAH (%s)" % fmt(prev["vah"]),
                          "testing_below": "testing below yesterday's VAL (%s)" % fmt(prev["val"]),
                          "inside": "inside yesterday's value (%s to %s)" % (fmt(prev["val"]), fmt(prev["vah"]))}[acc["state"]])
        line = "%s. %s (%s)." % (out["label"], shape_title(sh), sh["status"])
        if parts:
            txt = " and ".join(parts)
            line += " " + txt[0].upper() + txt[1:] + "."
        return line

    def _alerts(self, out, now):
        cfg, prev_out, new = self.cfg, self.last, []

        def add(kind, text):
            if kind not in cfg["alert_types"]:
                return
            t = self.last_alert.get(kind)
            if t is not None and now - t < cfg["alert_cooldown_min"]:
                return
            self.last_alert[kind] = now
            new.append({"time": out["time"], "type": kind, "text": text})

        if prev_out is None:
            return new
        a, b = prev_out["shape"]["shown"], out["shape"]["shown"]
        fa, fb = prev_out["shape"].get("failing_shown"), out["shape"].get("failing_shown")
        if (a != b or fa != fb) and "too_early" not in (a, b):
            add("shape_changed", "Shape changed: %s to %s" % (shape_title(prev_out["shape"]), shape_title(out["shape"])))
        if prev_out["label"] != out["label"] and prev_out["label"] != "Too early to read":
            add("bias_changed", "Reading changed: %s to %s" % (prev_out["label"], out["label"]))
        if out["acceptance"] and prev_out["acceptance"]:
            s0, s1 = prev_out["acceptance"]["state"], out["acceptance"]["state"]
            if s0 != s1 and s1 in ("accepted_above", "accepted_below", "inside"):
                msg = {"accepted_above": "Accepted above yesterday's VAH (%s)" % fmt(self.prev["vah"]),
                       "accepted_below": "Accepted below yesterday's VAL (%s)" % fmt(self.prev["val"]),
                       "inside": "Back inside yesterday's value area"}[s1]
                add("acceptance", msg)
        c_now = out["closes5"][-1] if out["closes5"] else None
        c_prev = prev_out["closes5"][-1] if prev_out["closes5"] else None
        if c_now and c_prev and c_now[0] != c_prev[0]:
            vw = out["vwap"]
            if vw is not None:
                if c_prev[1] >= vw and c_now[1] < vw:
                    add("vwap", "5-minute close below VWAP (%s)" % fmt(vw))
                elif c_prev[1] <= vw and c_now[1] > vw:
                    add("vwap", "5-minute close above VWAP (%s)" % fmt(vw))
            for z in out["zones"]:
                inside_now = z["low"] <= c_now[1] <= z["high"]
                inside_before = z["low"] <= c_prev[1] <= z["high"]
                if inside_now and not inside_before:
                    add("thin_zone", "5-minute close inside the %s (%s to %s): such zones are often crossed quickly"
                        % (z["name"].lower(), fmt(z["low"]), fmt(z["high"])))
        poc = self.poc_hist[-1][1]
        if self.last_poc_alert is None:
            self.last_poc_alert = poc
        elif abs(poc - self.last_poc_alert) >= 2 * self.mig_row:
            add("poc_moved", "Busiest 5-point row moved %s: %s to %s" % ("up" if poc > self.last_poc_alert else "down",
                                                                 fmt(self.last_poc_alert), fmt(poc)))
            self.last_poc_alert = poc
        return new


def render_text(out):
    """Plain-text version of the panel, for logs and testing."""
    L = ["[%s %s]  %s" % (out["date"] or "", out["time"], out["status_line"]), "Score %+d. Checks:" % out["score"]]
    for c in out["checks"]:
        L.append("  %+d  %-22s %s" % (c["score"], c["name"], c["result"]))
    L.append("Key levels (price %s):" % fmt(out["price"], 2))
    for lv in out["levels"]:
        d = int(round(lv["distance"]))
        L.append("  %-22s %12s  (%s)" % (lv["name"], fmt(lv["price"], 2), "%+d" % d if d else "0"))
    for z in out["zones"]:
        L.append("  %-22s %s to %s" % (z["name"], fmt(z["low"], 2), fmt(z["high"], 2)))
    L.append("If / then:")
    for r in out["conditions"]:
        L.append("  IF %s -> %s" % (r["if"], r["then"]))
    for f in out["flags"]:
        L.append("  ! " + f)
    for a in out["alerts"]:
        L.append("  ALERT %s %s" % (a["time"], a["text"]))
    L.append("  " + out["warning"])
    return "\n".join(L)
