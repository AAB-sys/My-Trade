"""panel_profile.py - build a volume profile and its value area.

A candle is a dict: {"hm": "09:15", "o":..., "h":..., "l":..., "c":..., "v": volume or None}
  hm = START time of the candle in IST. Prices come from the INDEX, volume from the nearest
  FUTURES contract for the same minute.

Two row layouts are supported:
  rows=24            -> the day's range cut into 24 equal rows   (what the chart draws)
  row_size=5         -> fixed 5-point rows aligned to multiples of 5 (what the Signal uses)
"""
import math


def candle_split(c):
    """Share of a candle's volume counted as up (buying) and down (selling)."""
    if c["c"] > c["o"]:
        return 1.0, 0.0
    if c["c"] < c["o"]:
        return 0.0, 1.0
    return 0.5, 0.5                      # doji: half and half


def build_profile(candles, rows=24, row_size=None, va_pct=70, va_step=2, use_volume=None, like_chart=False):
    """like_chart (added when the panel was connected to the Volume Profile page, 17 November 2026; the document, section 15
    note 7 and the acceptance checklist: "the panel's today's POC, VAH and VAL equal the chart profile's values"): count the
    rows exactly as the page's chart does (static/volprofile.js): a candle's volume goes to each row by the share of the
    candle's range inside it, a doji counts as up, the lowest of equally busy rows is the POC, and the value area takes the
    rows above when both sides weigh the same. Off (the default) it is the document's own arithmetic, unchanged."""
    if not candles:
        raise ValueError("no candles")
    if like_chart and not row_size:
        return _chart_profile(candles, rows, va_pct, va_step, use_volume)
    lo = min(c["l"] for c in candles)
    hi = max(c["h"] for c in candles)
    if use_volume is None:
        use_volume = any((c.get("v") or 0) > 0 for c in candles)
    if row_size:
        base = math.floor(lo / row_size) * row_size
        step = float(row_size)
        n = int(math.floor((hi - base) / step)) + 1
    elif hi - lo < 1e-9:
        base, step, n = lo, 1.0, 1
    else:
        base, step, n = lo, (hi - lo) / rows, rows

    def idx(price):
        return min(max(int((price - base) // step), 0), n - 1)

    up, dn = [0.0] * n, [0.0] * n
    for c in candles:
        w = float(c.get("v") or 0) if use_volume else 1.0
        if w <= 0:
            continue
        a, b = idx(c["l"]), idx(c["h"])
        share = w / (b - a + 1)                     # spread evenly from low row to high row
        fu, fd = candle_split(c)
        for i in range(a, b + 1):
            up[i] += share * fu
            dn[i] += share * fd
    vol = [u + d for u, d in zip(up, dn)]
    total = sum(vol)
    if total <= 0:
        raise ValueError("profile has no volume")
    mid_i = (n - 1) / 2.0
    # busiest row; a tie goes to the row nearer the middle of the range, then to the lower row
    poc_i = max(range(n), key=lambda i: (round(vol[i], 9), -abs(i - mid_i), -i))
    va_lo, va_hi = value_area(vol, poc_i, va_pct, va_step)
    p = {"base": base, "step": step, "n": n, "up": up, "dn": dn, "vol": vol, "total": total,
         "poc_i": poc_i, "va_lo_i": va_lo, "va_hi_i": va_hi, "low": lo, "high": hi,
         "mode": "volume" if use_volume else "time"}
    p["poc"] = row_mid(p, poc_i)
    p["val"] = row_lo(p, va_lo)
    p["vah"] = row_hi(p, va_hi)
    return p


def _chart_profile(candles, rows, va_pct, va_step, use_volume):
    lo = min(c["l"] for c in candles)
    hi = max(c["h"] for c in candles)
    if use_volume is None:
        use_volume = any((c.get("v") or 0) > 0 for c in candles)
    n, step = (rows, (hi - lo) / rows) if hi > lo else (1, 0.05)

    def idx(price):
        return max(0, min(n - 1, int(math.floor((price - lo) / step))))

    up, dn, total = [0.0] * n, [0.0] * n, 0.0
    for c in candles:
        w = float(c.get("v") or 0) if use_volume else 1.0
        if w <= 0:
            continue
        side = up if c["c"] >= c["o"] else dn
        span, a, z = c["h"] - c["l"], idx(c["l"]), idx(c["h"])
        for i in range(a, z + 1):
            edge = lo + i * step
            share = (min(c["h"], edge + step) - max(c["l"], edge)) / span if span > 0 else (1.0 if i == a else 0.0)
            if share > 0:
                side[i] += w * share
        total += w
    vol = [u + d for u, d in zip(up, dn)]
    if total <= 0:
        raise ValueError("profile has no volume")
    poc_i = 0
    for i in range(1, n):
        if vol[i] > vol[poc_i]:
            poc_i = i
    a = z = poc_i
    inside = vol[poc_i]
    while inside < total * va_pct / 100.0 and (a > 0 or z < n - 1):
        above = sum(vol[z + 1:z + 1 + va_step]) if z < n - 1 else -1
        below = sum(vol[max(0, a - va_step):a]) if a > 0 else -1
        if above >= below:
            inside, z = inside + above, min(n - 1, z + va_step)
        else:
            inside, a = inside + below, max(0, a - va_step)
    p = {"base": lo, "step": step, "n": n, "up": up, "dn": dn, "vol": vol, "total": total,
         "poc_i": poc_i, "va_lo_i": a, "va_hi_i": z, "low": lo, "high": hi,
         "mode": "volume" if use_volume else "time"}
    p["poc"] = row_mid(p, poc_i)
    p["val"] = row_lo(p, a)
    p["vah"] = row_hi(p, z)
    return p


def value_area(vol, poc_i, pct, step_rows):
    """Grow from the POC. Each step compares the next `step_rows` rows above with the next
    `step_rows` rows below and adds the heavier group. Equal groups: add both.
    Stops when the area holds `pct` % of all volume."""
    n, total = len(vol), sum(vol)
    lo = hi = poc_i
    inside, target = vol[poc_i], pct / 100.0 * total
    while inside < target - 1e-9 and (lo > 0 or hi < n - 1):
        above = list(range(hi + 1, min(n, hi + 1 + step_rows)))
        below = list(range(max(0, lo - step_rows), lo))
        va, vb = sum(vol[i] for i in above), sum(vol[i] for i in below)
        if above and (not below or va > vb):
            hi, inside = above[-1], inside + va
        elif below and (not above or vb > va):
            lo, inside = below[0], inside + vb
        else:
            hi, lo, inside = above[-1], below[0], inside + va + vb
    return lo, hi


def row_lo(p, i):
    return p["base"] + i * p["step"]


def row_hi(p, i):
    return p["base"] + (i + 1) * p["step"]


def row_mid(p, i):
    return (row_lo(p, i) + row_hi(p, i)) / 2.0
