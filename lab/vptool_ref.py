"""Volume profile (fixed range and anchored): reference implementation.

The owner's document "AAA_V1 Volume Profile Tool Logic" (20 November 2026), section 8, with five faults put right
(the owner: "if u find any bug, remove it, rectify it"); each is marked "fault N" below, and static/vptool.js carries
the same five. lab/check_vptool.py proves this file and static/vptool.js give the same answers.
  1. finer bars that stop early or have a hole: the chart bar there is counted from the chart bar (its volume was lost)
  2. finer bars with no volume beside chart bars with volume: the chart bars are used (it turned into time at price)
  3. value area at 100%: a rounding error of the sums could leave the last row out
  4. past 2,000 rows "ticks per row" kept the old figure
  5. an empty range raised an error; it now gives None

Pure Python, no third-party packages. A bar is a dict:
    {"t": start time in UTC milliseconds, "o": open, "h": high, "l": low, "c": close, "v": volume}
Bars are sorted by time, oldest first.
"""
import math

MINUTE = 60_000
DAY = 86_400_000
MAX_ROWS = 2000

# Default settings. Opacities are percentages (0-100).
DEFAULTS = {
    # Inputs
    "layout": "rows",       # "rows" = Number of Rows, "ticks" = Ticks Per Row
    "size": 24,             # row count, or ticks per row, depending on layout
    "vol": "updown",        # "updown", "total" or "delta"
    "va": 70,               # value area volume, percent
    "extend": False,        # fixed range only: keep building to the latest bar
    # Style
    "show": True, "values": False, "width": 30, "place": "left",
    "upC": "#1592e6", "upA": 30, "dnC": "#fbc123", "dnA": 30,            # outside the value area
    "vaUpC": "#1592e6", "vaUpA": 75, "vaDnC": "#fbc123", "vaDnA": 75,    # inside the value area
    "poc": True, "pocC": "#e0434b",
    "vah": False, "vahC": "#7c8598", "val": False, "valC": "#7c8598",
    "dpoc": False, "dpocC": "#e0434b", "dva": False, "dvaC": "#2f9c93",
    "box": True, "boxC": "#2f62e8", "boxA": 6, "labels": True,
    # Visibility: chart intervals on which the profile is hidden, e.g. {"1D": 1}
    "hideTf": {},
}

# Intervals the calculation may use, finest first: (name, milliseconds)
LOWER_TFS = [("1m", MINUTE), ("5m", 5 * MINUTE), ("15m", 15 * MINUTE),
             ("30m", 30 * MINUTE), ("1h", 60 * MINUTE), ("4h", 240 * MINUTE), ("1D", DAY)]
SESSION_MINUTES = 375      # NSE cash session, 09:15 to 15:30
MAX_LOWER_BARS = 5000


def js_round(x):
    """Round half up, as JavaScript's Math.round does (Python's round() rounds half to even)."""
    return math.floor(x + 0.5)


def clamp(v, a, b):
    return max(a, min(b, v))


def _add(values):
    """Left-to-right sum, as static/vptool.js adds (Python's sum() of floats may differ in the last digit)."""
    s = 0.0
    for v in values:
        s += v
    return s


# ----------------------------------------------------------------- 1. range

def select_range(bars, t1, t2=None, anchored=False, extend=False):
    """Indexes (i1, i2) of the first and last chart bar inside the profile, or None.

    Fixed range: from t1 to t2 (either order).
    Anchored, or fixed with extend: from t1 to the last bar.
    A time that falls between two bars moves inward: the start to the next bar,
    the end to the previous one.
    """
    if not bars:
        return None
    if t2 is None:
        t2 = t1
    if not anchored and t2 < t1:
        t1, t2 = t2, t1
    times = [b["t"] for b in bars]
    i1 = next((i for i, t in enumerate(times) if t >= t1), len(bars))
    if anchored or extend:
        i2 = len(bars) - 1
    else:
        i2 = max((i for i, t in enumerate(times) if t <= t2), default=-1)
    i1 = max(0, i1)
    return None if i1 > i2 else (i1, i2)


# ----------------------------------------------------------------- 2. lower timeframe

def pick_lower_tf(chart_tf_ms, bar_count):
    """The interval whose bars feed the calculation: the finest one that gives
    fewer than 5,000 bars over the range. Returns (name, ms), or None to use the
    chart's own bars."""
    if chart_tf_ms >= DAY:
        days = bar_count * chart_tf_ms / DAY * (5 / 7 if chart_tf_ms > DAY else 1)
        minutes = days * SESSION_MINUTES
    else:
        minutes = bar_count * chart_tf_ms / MINUTE
    for name, ms in LOWER_TFS:
        count = minutes / SESSION_MINUTES if ms >= DAY else minutes / (ms / MINUTE)
        if count < MAX_LOWER_BARS:
            return None if ms >= chart_tf_ms else (name, ms)
    return None


def build_source(chart_bars, chart_tf_ms, lower_bars=None, lower_tf_ms=None,
                 cut_hi=math.inf):
    """The bars to bin, each with the time it covers: [(bar, covered_ms)], by time.

    chart_bars: the chart bars inside the range.
    lower_bars: finer bars for the same range (may cover only its recent part).
    cut_hi: start time of the still-forming chart bar when the range runs to the
    latest bar; that bar always comes from the chart, so live ticks show at once.
    """
    plain = [(b, chart_tf_ms) for b in chart_bars]
    if not lower_bars:
        return plain
    has_volume = lambda bars: any((b.get("v") or 0) > 0 for b in bars)
    if not has_volume(lower_bars) and has_volume(chart_bars):   # fault 2
        return plain
    cut_lo = chart_bars[0]["t"]
    first = lower_bars[0]["t"]
    if first >= chart_bars[0]["t"] + chart_tf_ms:               # finer data starts late
        cut_lo = next((b["t"] for b in chart_bars if b["t"] >= first), math.inf)
    src, k = [], 0
    while k < len(lower_bars) and lower_bars[k]["t"] < cut_lo:
        k += 1
    for i, cb in enumerate(chart_bars):
        until = chart_bars[i + 1]["t"] if i + 1 < len(chart_bars) else math.inf
        start = k
        while k < len(lower_bars) and lower_bars[k]["t"] < until:
            k += 1
        if cb["t"] < cut_lo or cb["t"] >= cut_hi or k == start:  # k == start: no finer bar inside this chart bar (fault 1)
            src.append((cb, chart_tf_ms))
        else:
            src += [(b, lower_tf_ms) for b in lower_bars[start:k]]
    return src


# ----------------------------------------------------------------- 3. rows

def rows_layout(lo, hi, layout, size, tick):
    """Row height and count. Returns (row_height, row_count, ticks_per_row)."""
    span = max(hi - lo, tick)

    def count(ticks):
        return math.ceil(span / (ticks * tick) - 1e-9)

    if layout == "rows":
        want = max(1, js_round(size))
        raw = span / want / tick
        down, up = max(1, math.floor(raw)), max(1, math.ceil(raw))
        tpr = down if abs(count(down) - want) < abs(count(up) - want) else up
    else:
        tpr = max(1, js_round(size))
    height = tpr * tick
    n = max(1, count(tpr))
    if n > MAX_ROWS:
        n, height = MAX_ROWS, span / MAX_ROWS
        tpr = height / tick                                     # fault 4
    return height, n, tpr


# ----------------------------------------------------------------- 4. POC and value area

def point_of_control(tot):
    """Index of the row with the most volume. A tie goes to the row nearest the
    middle of the profile, and between two equally near rows to the lower one."""
    mid = (len(tot) - 1) / 2
    best, poc = -1.0, 0
    for r, v in enumerate(tot):
        if v > best or (v == best and abs(r - mid) < abs(poc - mid)):
            best, poc = v, r
    return poc


def value_area(tot, poc, pct):
    """(val_row, vah_row): the rows around the POC holding about pct percent of
    the volume.

    Start with the POC. Each step, compare the next row above with the next row
    below and take the larger. Equal volumes: take the row nearer the POC, and if
    equally near, the one above. Stop when the chosen row would take the total
    past the target, or when both sides run out.
    """
    n = len(tot)
    total = 0.0
    for v in tot:
        total += v
    remaining = total * pct / 100 - tot[poc]
    eps = 1e-9 * max(1.0, total)                                # fault 3
    hi = lo = poc
    while remaining > 0:
        above = tot[hi + 1] if hi + 1 < n else -1
        below = tot[lo - 1] if lo > 0 else -1
        if above < 0 and below < 0:
            break
        if above != below:
            go_up = above > below
        else:
            go_up = (hi + 1 - poc) <= (poc - lo + 1)
        v = above if go_up else below
        if v > remaining + eps:
            break
        remaining -= v
        if go_up:
            hi += 1
        else:
            lo -= 1
    return lo, hi


# ----------------------------------------------------------------- 5. the profile

def compute_profile(chart_bars, chart_tf_ms, tick, settings=None, lower_bars=None,
                    lower_tf_ms=None, cut_hi=math.inf):
    """Build the profile for chart_bars (the bars inside the range, already selected).

    Returns a dict:
      lo, hi            price range of the profile
      row_height, rows  row size in price units, and the number of rows;
                        row r covers [lo + r*row_height, lo + (r+1)*row_height)
      ticks_per_row
      up, down, total   lists, one value per row (row 0 is the lowest)
      poc, val, vah     row indexes
      poc_price         middle of the POC row
      val_price         bottom edge of the VAL row
      vah_price         top edge of the VAH row
      dev_poc, dev_val, dev_vah   row indexes after each chart bar (when switched on)
      no_volume         True when the range has no volume and time at price was used
      volume, up_volume, down_volume
    """
    if not chart_bars:                                          # fault 5
        return None
    o = dict(DEFAULTS, **(settings or {}))
    src = build_source(chart_bars, chart_tf_ms, lower_bars, lower_tf_ms, cut_hi)
    lo = min(b["l"] for b, _ in src)
    hi = max(b["h"] for b, _ in src)
    vsum = 0.0
    for b, _ in src:
        vsum += b.get("v") or 0
    no_volume = not vsum > 0
    height, n, tpr = rows_layout(lo, hi, o["layout"], o["size"], tick)
    up, down, total = [0.0] * n, [0.0] * n, [0.0] * n
    developing = o["dpoc"] or o["dva"]
    dev_poc, dev_val, dev_vah = [], [], []

    k = 0
    for i, cb in enumerate(chart_bars):
        until = chart_bars[i + 1]["t"] if i + 1 < len(chart_bars) else math.inf
        while k < len(src) and src[k][0]["t"] < until:
            b, covered = src[k]
            k += 1
            # weight is the bar's volume, or its minutes when there is no volume
            weight = covered / MINUTE if no_volume else (b.get("v") or 0)
            if not weight > 0:
                continue
            side = up if b["c"] > b["o"] else down          # close above open is up volume
            r0 = clamp(math.floor((b["l"] - lo) / height), 0, n - 1)
            r1 = clamp(math.floor((b["h"] - lo) / height - 1e-9), r0, n - 1)
            rng = b["h"] - b["l"]
            if r0 == r1 or not rng > 0:
                side[r0] += weight
                total[r0] += weight
            else:                                           # share by overlap with each row
                for r in range(r0, r1 + 1):
                    top = min(b["h"], lo + (r + 1) * height)
                    bottom = max(b["l"], lo + r * height)
                    share = weight * max(0.0, top - bottom) / rng
                    side[r] += share
                    total[r] += share
        if developing:
            p = point_of_control(total)
            dev_poc.append(p)
            if o["dva"]:
                a, z = value_area(total, p, o["va"])
                dev_val.append(a)
                dev_vah.append(z)

    poc = point_of_control(total)
    val, vah = value_area(total, poc, o["va"])
    return {
        "lo": lo, "hi": hi, "row_height": height, "rows": n, "ticks_per_row": tpr,
        "up": up, "down": down, "total": total, "poc": poc, "val": val, "vah": vah,
        "poc_price": lo + (poc + 0.5) * height,
        "val_price": lo + val * height,
        "vah_price": lo + (vah + 1) * height,
        "dev_poc": dev_poc, "dev_val": dev_val, "dev_vah": dev_vah,
        "no_volume": no_volume, "volume": _add(total),
        "up_volume": _add(up), "down_volume": _add(down),
    }


# ----------------------------------------------------------------- 6. drawing

def histogram_bars(profile, settings, box_width_px):
    """What to draw for each row: a list of segments [(offset_px, length_px, kind)]
    per row. kind is "up", "down", "va_up" or "va_down" and selects the colour and
    opacity. offset is measured from the box edge the histogram is placed on."""
    o = dict(DEFAULTS, **(settings or {}))
    up, dn, tot = profile["up"], profile["down"], profile["total"]
    mode = o["vol"]
    scale = max((abs(u - d) if mode == "delta" else t) for u, d, t in zip(up, dn, tot))
    max_len = box_width_px * clamp(o["width"], 1, 100) / 100
    out = []
    for r in range(profile["rows"]):
        in_va = profile["val"] <= r <= profile["vah"]
        ku, kd = ("va_up", "va_down") if in_va else ("up", "down")
        if not scale > 0:
            out.append([])
        elif mode == "total":
            out.append([(0.0, tot[r] / scale * max_len, ku)])
        elif mode == "delta":
            d = up[r] - dn[r]
            out.append([(0.0, abs(d) / scale * max_len, ku if d >= 0 else kd)])
        else:
            wu, wd = up[r] / scale * max_len, dn[r] / scale * max_len
            out.append([(0.0, wu, ku), (wu, wd, kd)])
    return out


if __name__ == "__main__":
    demo = [
        {"t": 0 * 300000, "o": 100.0, "h": 101.0, "l": 99.5, "c": 100.8, "v": 1200},
        {"t": 1 * 300000, "o": 100.8, "h": 102.2, "l": 100.6, "c": 102.0, "v": 2100},
        {"t": 2 * 300000, "o": 102.0, "h": 102.4, "l": 101.1, "c": 101.3, "v": 1700},
        {"t": 3 * 300000, "o": 101.3, "h": 101.9, "l": 100.9, "c": 101.6, "v": 900},
    ]
    p = compute_profile(demo, 300000, tick=0.05, settings={"size": 10})
    print("rows", p["rows"], "row height", round(p["row_height"], 2))
    print("POC %.2f  VAL %.2f  VAH %.2f" % (p["poc_price"], p["val_price"], p["vah_price"]))
    for r in reversed(range(p["rows"])):
        price = p["lo"] + r * p["row_height"]
        print("%7.2f  up %7.1f  down %7.1f" % (price, p["up"][r], p["down"][r]))
