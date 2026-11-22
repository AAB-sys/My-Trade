"""Fair value gap (FVG) fill signals for NIFTY, BANKNIFTY and SENSEX: buy CE or buy PE.

Entry signals only, from index price levels. No stop, target, exit or cost is
worked out here. Report only: nothing talks to a broker or places an order.

A bar is a dict {"d": date, "t": time the bar starts (IST), "o", "h", "l", "c"},
the shape research/data.py stores. Bars are sorted oldest first and may span
many sessions.

The logic:

  1. A gap forms over three candles in one session.
       Bullish gap: low of candle 3 is above high of candle 1.
                    Zone = [high of candle 1, low of candle 3].
       Bearish gap: high of candle 3 is below low of candle 1.
                    Zone = [high of candle 3, low of candle 1].
  2. Later, price comes back and fills the gap (trades through the zone to its
     far edge; the fill level is a setting).
  3. On the bar that fills it, if the bar does not close beyond the far edge,
     the gap has been filled and has held. That is the signal:
       bullish gap filled from above -> possible reversal up   -> BUY CE
       bearish gap filled from below -> possible reversal down -> BUY PE
     The entry point is that bar's closing index value.
  4. If the bar closes beyond the far edge, the gap is broken and gives no signal.

follow_through() measures what the index did after each signal, in index
points, and study() compares that with placebo zones: zones of the same height,
side and distance from price placed on bars where no gap formed.
"""
import datetime as dt
import math
import random

DEFAULTS = {
    "interval": 5,            # minutes per bar
    "atr_len": 14,            # ATR = average bar range, used only to size things
    # which gaps count
    "min_gap_atr": 0.25,      # gap height must be at least this many ATRs
    "displacement": True,     # middle candle must close beyond candle 1 in the gap's direction
    "carry_days": 0,          # sessions a gap stays alive after the one it formed in
    "max_age_bars": 60,       # a gap older than this is dropped
    # what counts as filled
    "fill_level": "full",     # "full": far edge of the gap; "mid": its midpoint; "edge": first touch of the near edge
    "confirm": "none",        # "none": signal on the bar that fills the gap
                              # "candle": wait (up to confirm_wait bars) for a bar that closes in the reversal direction
    "confirm_wait": 3,
    # trend filter: 9 EMA above 21 EMA allows BUY CE, below allows BUY PE
    "ema_filter": "on",       # "on" or "off"
    "ema_fast": 9, "ema_slow": 21,
    "ema_basis": "day",       # "day": EMAs of daily closes of finished sessions; "bar": EMAs of the 5-minute bars
    # when a signal may fire (bar close time, IST)
    "entry_from": "09:30", "entry_to": "14:30",
}


def _hm(s):
    h, m = s.split(":")
    return dt.time(int(h), int(m))


def _close_time(bar, interval):
    return (dt.datetime.combine(bar["d"], bar["t"]) + dt.timedelta(minutes=interval)).time()


def atr(bars, n):
    """Wilder's average true range, one value per bar (None until n bars exist)."""
    out, prev, a = [], None, None
    for i, b in enumerate(bars):
        tr = b["h"] - b["l"] if prev is None else max(b["h"] - b["l"], abs(b["h"] - prev), abs(b["l"] - prev))
        prev = b["c"]
        if i < n:
            a = tr if a is None else a + tr
            out.append(a / n if i == n - 1 else None)
            if i == n - 1:
                a = a / n
        else:
            a = (a * (n - 1) + tr) / n
            out.append(a)
    return out


def ema(values, n):
    out, e, k = [], None, 2.0 / (n + 1)
    for v in values:
        e = v if e is None else e + (v - e) * k
        out.append(e)
    return out


def trend_direction(bars, cfg=None):
    """+1 (fast EMA above slow), -1 (below) or None (not enough history), one per bar.

    Basis "day": EMAs of daily closes, using only sessions that ended before the
    bar's own session, so the value is fixed for the whole day and known at the open.
    Basis "bar": EMAs of the bars' own closes, read at each bar's close.
    """
    cfg = dict(DEFAULTS, **(cfg or {}))
    fast, slow = cfg["ema_fast"], cfg["ema_slow"]
    sign = lambda f, s: 1 if f > s else -1 if f < s else None
    if cfg["ema_basis"] == "bar":
        closes = [b["c"] for b in bars]
        f, s = ema(closes, fast), ema(closes, slow)
        return [sign(f[i], s[i]) if i >= slow - 1 else None for i in range(len(bars))]
    days, last = [], {}
    for b in bars:
        if b["d"] not in last:
            days.append(b["d"])
        last[b["d"]] = b["c"]
    closes = [last[d] for d in days]
    f, s = ema(closes, fast), ema(closes, slow)
    by_day = {d: (sign(f[k - 1], s[k - 1]) if k >= slow else None) for k, d in enumerate(days)}
    return [by_day[b["d"]] for b in bars]


# ---------------------------------------------------------------- gaps

def detect_fvgs(bars, cfg=None, atrs=None):
    """Every gap in bars. A gap is known at the close of its third candle (index "i")."""
    cfg = dict(DEFAULTS, **(cfg or {}))
    atrs = atrs or atr(bars, cfg["atr_len"])
    out = []
    for i in range(2, len(bars)):
        a, m, b = bars[i - 2], bars[i - 1], bars[i]
        if not (a["d"] == m["d"] == b["d"]) or atrs[i] is None:
            continue
        if b["l"] > a["h"]:
            side, lo, hi, ok = 1, a["h"], b["l"], m["c"] > a["h"]
        elif b["h"] < a["l"]:
            side, lo, hi, ok = -1, b["h"], a["l"], m["c"] < a["l"]
        else:
            continue
        if cfg["displacement"] and not ok:
            continue
        if hi - lo < cfg["min_gap_atr"] * atrs[i]:
            continue
        out.append({"i": i, "side": side, "lo": lo, "hi": hi, "mid": (lo + hi) / 2, "size": hi - lo,
                    "atr": atrs[i], "offset": (lo - b["c"]) if side == 1 else (hi - b["c"]), "placebo": False})
    return out


def placebo_zones(bars, gaps, cfg=None, seed=7):
    """One placebo zone per real gap: same side, height and distance from the close,
    placed on a random bar (same time-of-day window) where no gap formed."""
    cfg = dict(DEFAULTS, **(cfg or {}))
    rng = random.Random(seed)
    taken = {g["i"] for g in gaps}
    t0, t1 = _hm("09:25"), _hm(cfg["entry_to"])
    pool = [i for i in range(2, len(bars)) if i not in taken and bars[i]["d"] == bars[i - 2]["d"]
            and t0 <= _close_time(bars[i], cfg["interval"]) <= t1]
    out = []
    if not pool:
        return out
    for g in gaps:
        i = rng.choice(pool)
        c = bars[i]["c"]
        lo = c + g["offset"] if g["side"] == 1 else c + g["offset"] - g["size"]
        out.append(dict(g, i=i, lo=lo, hi=lo + g["size"], mid=lo + g["size"] / 2, placebo=True))
    out.sort(key=lambda z: z["i"])
    return out


# ---------------------------------------------------------------- signals

def scan(bars, zones=None, cfg=None):
    """Walk the bars once. Returns (signals, zones).

    Each signal: {"action": "BUY CE" or "BUY PE", "side": +1 or -1, "i": bar index,
    "date", "time" (bar close, IST), "entry" (that bar's close), "fill_level",
    "zone_lo", "zone_hi", "zone_side", "zone_i"}.
    Each zone gains touch_i / mid_i / fill_i (bar index of the first touch of the near
    edge, the midpoint and the far edge) and broken_i (first close beyond the far edge).
    """
    cfg = dict(DEFAULTS, **(cfg or {}))
    iv = cfg["interval"]
    atrs = atr(bars, cfg["atr_len"])
    if zones is None:
        zones = detect_fvgs(bars, cfg, atrs)
    zones = [dict(z, touch_i=None, mid_i=None, fill_i=None, broken_i=None, _hit=None, _done=False) for z in zones]
    trend = trend_direction(bars, cfg) if cfg["ema_filter"] == "on" else None
    t_from, t_to = _hm(cfg["entry_from"]), _hm(cfg["entry_to"])
    day_no = {d: k for k, d in enumerate(sorted({b["d"] for b in bars}))}
    by_start, live, signals = {}, [], []
    for z in zones:
        by_start.setdefault(z["i"], []).append(z)
    for i, b in enumerate(bars):
        if atrs[i] is not None:
            in_window = t_from <= _close_time(b, iv) <= t_to
            keep = []
            for z in live:
                if i - z["i"] > cfg["max_age_bars"] or day_no[b["d"]] - day_no[bars[z["i"]]["d"]] > cfg["carry_days"]:
                    continue
                s = z["side"]
                near, far = (z["hi"], z["lo"]) if s == 1 else (z["lo"], z["hi"])
                level = {"full": far, "mid": z["mid"], "edge": near}[cfg["fill_level"]]
                reach = b["l"] if s == 1 else b["h"]            # how far this bar came back toward the gap
                got = lambda px: (reach <= px) if s == 1 else (reach >= px)
                if z["touch_i"] is None and got(near):
                    z["touch_i"] = i
                if z["mid_i"] is None and got(z["mid"]):
                    z["mid_i"] = i
                if z["fill_i"] is None and got(far):
                    z["fill_i"] = i
                if z["_hit"] is None and got(level):
                    z["_hit"] = i
                if (b["c"] < far) if s == 1 else (b["c"] > far):
                    z["broken_i"] = i
                    continue                                    # closed through: the gap is finished, no signal
                if z["_hit"] is not None and not z["_done"]:
                    if cfg["confirm"] == "candle":
                        ready = i - z["_hit"] <= cfg["confirm_wait"] and ((b["c"] > b["o"]) if s == 1 else (b["c"] < b["o"]))
                        expired = i - z["_hit"] >= cfg["confirm_wait"]
                    else:
                        ready, expired = i == z["_hit"], True
                    if ready or expired:
                        z["_done"] = True
                    if ready and in_window and (trend is None or trend[i] == s):
                        signals.append({"action": "BUY CE" if s == 1 else "BUY PE", "side": s, "i": i, "date": b["d"],
                                        "time": _close_time(b, iv), "entry": b["c"], "fill_level": level,
                                        "zone_lo": z["lo"], "zone_hi": z["hi"], "zone_side": s, "zone_i": z["i"],
                                        "placebo": z.get("placebo", False)})
                keep.append(z)
            live = keep
        live.extend(by_start.get(i, []))
    for z in zones:
        z.pop("_hit", None)
        z.pop("_done", None)
    return signals, zones


def latest_signals(bars, cfg=None):
    """Signals on the most recent bar, and today's gaps that are still alive. Pass closed bars only."""
    signals, zones = scan(bars, None, cfg)
    i = len(bars) - 1
    return ([s for s in signals if s["i"] == i],
            [z for z in zones if z["broken_i"] is None and bars[z["i"]]["d"] == bars[i]["d"]])


def describe(sym, s):
    kind = "bullish" if s["zone_side"] == 1 else "bearish"
    return ("%s %s  %s %s  entry (index) %.2f  |  %s gap %.2f-%.2f filled, possible reversal %s" %
            (s["date"].isoformat(), s["time"].strftime("%H:%M"), s["action"], sym, s["entry"], kind,
             s["zone_lo"], s["zone_hi"], "up" if s["side"] == 1 else "down"))


# ---------------------------------------------------------------- what happened next

HORIZONS = (3, 6, 12)      # bars after the signal: 15, 30 and 60 minutes on 5-minute bars


def follow_through(bars, signals, horizons=HORIZONS):
    """Index movement after each signal, in the signal's direction, in index points.

    For each horizon h (bars): the average move from the entry to the close h bars
    later, and the share of signals where that move was in the signal's direction.
    Only signals with h more bars left in their session are counted.
    """
    out = {"n": len(signals)}
    for h in horizons:
        moves = []
        for s in signals:
            j = s["i"] + h
            if j < len(bars) and bars[j]["d"] == s["date"]:
                moves.append((bars[j]["c"] - s["entry"]) * s["side"])
        n = len(moves)
        if n:
            mean = sum(moves) / n
            sd = math.sqrt(sum((m - mean) ** 2 for m in moves) / (n - 1)) if n > 1 else 0.0
            out[h] = {"n": n, "mean_points": mean, "se_points": sd / math.sqrt(n) if n > 1 else None,
                      "right_way": sum(1 for m in moves if m > 0) / n}
        else:
            out[h] = {"n": 0}
    return out


def fill_stats(bars, zones):
    """How often gaps were revisited in the session they formed in."""
    n = len(zones)
    if not n:
        return {"n": 0}
    same = lambda z, k: z[k] is not None and bars[z[k]]["d"] == bars[z["i"]]["d"]
    waits = sorted(z["fill_i"] - z["i"] for z in zones if same(z, "fill_i"))
    return {"n": n, "touched": sum(same(z, "touch_i") for z in zones) / n,
            "midpoint": sum(same(z, "mid_i") for z in zones) / n,
            "filled": sum(same(z, "fill_i") for z in zones) / n,
            "broken": sum(same(z, "broken_i") for z in zones) / n,
            "median_bars_to_fill": waits[len(waits) // 2] if waits else None}


def study(bars, cfg=None, placebo_runs=20, seed=7):
    """Real gaps against placebo zones: fill statistics and what the index did after the signals."""
    cfg = dict(DEFAULTS, **(cfg or {}))
    signals, zones = scan(bars, None, cfg)
    gaps = [dict(z) for z in zones]
    fake_signals, fake_zones = [], []
    for k in range(placebo_runs):
        ps, pz = scan(bars, placebo_zones(bars, gaps, cfg, seed + k), cfg)
        fake_signals += ps
        fake_zones += pz
    out = {"bars": len(bars), "sessions": len({b["d"] for b in bars}), "placebo_runs": placebo_runs,
           "fills": {"real": fill_stats(bars, zones), "placebo": fill_stats(bars, fake_zones)},
           "signals": {}, "list": signals}
    for name, pick in (("ALL", None), ("BUY CE", 1), ("BUY PE", -1)):
        sel = lambda xs: [s for s in xs if pick is None or s["side"] == pick]
        out["signals"][name] = {"real": follow_through(bars, sel(signals)), "placebo": follow_through(bars, sel(fake_signals))}
    return out
