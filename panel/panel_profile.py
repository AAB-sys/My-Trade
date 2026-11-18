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


def chart_shape(candles, rows=30, smooth=2, second_ratio=0.60, valley_ratio=0.70, pos_hi=0.66, pos_lo=0.34, thin_pct=None):
    """The shape the page's chart names (added 17 November 2026, the owner: "Panel show the same shape name as the chart, so
    they never disagree"): static/vpshape.js's own count and rule, line for line. The day's range in `rows` equal rows; a
    candle's volume goes to each row by the share of its range inside it (a candle with no volume weighs 1); the rows are
    smoothed twice; two far-apart peaks with a valley between them are a Double Zone; else the busiest row's place in the
    range says P (top third), B (bottom third) or D.
    Returns {"shape": "P" | "B" | "D" | "Double", "low_poc", "high_poc" (a Double Zone's two busy prices, else None),
    "gap_low", "gap_high" (the valley between them: its lowest row, widened over the thin rows beside it (under thin_pct % of
    the busiest row), as the document's find_double cuts a gap; else None)}."""
    lo = min(c["l"] for c in candles)
    hi = max(c["h"] for c in candles)
    step = max((hi - lo) / rows, 0.05)
    v = [0.0] * rows

    def at(price):
        return max(0, min(rows - 1, int(math.floor((price - lo) / step))))

    for c in candles:
        w = float(c.get("v") or 0)
        if not w > 0:
            w = 1.0
        r0, r1, span = at(c["l"]), at(c["h"]), c["h"] - c["l"]
        if span <= 0:
            v[r0] += w
            continue
        for r in range(r0, r1 + 1):
            rl = lo + r * step
            v[r] += w * max(0.0, min(c["h"], rl + step) - max(c["l"], rl)) / span
    n, s = rows, list(v)
    for _ in range(smooth):
        t = list(s)
        s = [(t[max(i - 1, 0)] + 2 * t[i] + t[min(i + 1, n - 1)]) / 4 for i in range(n)]
    poc_v = max(s)
    poc = s.index(poc_v)
    min_sep = max(3, int(math.floor(n * 0.2 + 0.5)))
    p2, p2_v = -1, 0.0
    for i in range(n):
        if abs(i - poc) >= min_sep:
            cv, lv, rv = s[i], s[max(i - 1, 0)], s[min(i + 1, n - 1)]
            if (i == 0 or cv >= lv) and (i == n - 1 or cv >= rv) and cv > p2_v:
                p2_v, p2 = cv, i
    kind, k = "", None
    if p2 >= 0 and p2_v >= second_ratio * poc_v:
        a, z = min(poc, p2), max(poc, p2)
        k = min(range(a, z + 1), key=lambda j: s[j])
        if s[k] <= valley_ratio * p2_v:
            kind = "Double"
    if not kind:
        pos = poc / float(n - 1) if n > 1 else 0.5
        kind = "P" if pos > pos_hi else "B" if pos < pos_lo else "D"
    mid = lambda r: lo + (r + 0.5) * step
    two = kind == "Double"
    g_lo = g_hi = k
    if two and thin_pct:
        a, z, top = min(poc, p2), max(poc, p2), max(v)
        thin = [x < thin_pct / 100.0 * top for x in v]
        while g_lo - 1 > a and thin[g_lo - 1]:
            g_lo -= 1
        while g_hi + 1 < z and thin[g_hi + 1]:
            g_hi += 1
    return {"shape": kind, "low_poc": mid(min(poc, p2)) if two else None, "high_poc": mid(max(poc, p2)) if two else None,
            "gap_low": lo + g_lo * step if two else None, "gap_high": lo + (g_hi + 1) * step if two else None}
