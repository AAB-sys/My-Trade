"""profile.py - build a volume profile for one session and find its key levels.
A candle is a dict: {"hm": "09:15", "o":..., "h":..., "l":..., "c":..., "v": optional volume}.
If candles carry no volume, every candle counts as 1 (a time-at-price profile)."""
import math


def build_profile(candles, bin_size=5.0, value_area_pct=70):
    """Return POC, value-area high/low and the high/low volume nodes of one session."""
    low = math.floor(min(c["l"] for c in candles) / bin_size) * bin_size
    high = max(c["h"] for c in candles)
    n = int((high - low) // bin_size) + 1
    weight = [0.0] * n
    for c in candles:
        first = int((c["l"] - low) // bin_size)
        last = int((c["h"] - low) // bin_size)
        share = float(c.get("v") or 1.0) / (last - first + 1)   # spread the candle evenly over its range
        for i in range(first, last + 1):
            weight[i] += share
    poc_i = max(range(n), key=lambda i: weight[i])
    lo_i, hi_i = _value_area(weight, poc_i, value_area_pct / 100.0)
    hvn, lvn = _nodes(weight, lo_i, hi_i)
    mid = lambda i: low + (i + 0.5) * bin_size
    return {"poc": mid(poc_i), "val": low + lo_i * bin_size, "vah": low + (hi_i + 1) * bin_size,
            "hvn": [mid(i) for i in hvn], "lvn": [mid(i) for i in lvn],
            "session_low": min(c["l"] for c in candles), "session_high": high,
            "uses_volume": any(c.get("v") for c in candles)}


def _value_area(weight, poc_i, share):
    """Start at the POC and keep adding the bigger neighbouring row until `share` of all volume is inside."""
    lo = hi = poc_i
    inside, total = weight[poc_i], sum(weight)
    while inside < share * total:
        up = weight[hi + 1] if hi + 1 < len(weight) else -1
        down = weight[lo - 1] if lo > 0 else -1
        if up >= down:
            hi += 1; inside += up
        else:
            lo -= 1; inside += down
    return lo, hi


def _nodes(weight, lo_i, hi_i):
    """High volume nodes = clear peaks. Low volume nodes = clear dips inside the value area."""
    n = len(weight)
    smooth = [sum(weight[max(0, i - 1):i + 2]) / len(weight[max(0, i - 1):i + 2]) for i in range(n)]
    avg = sum(smooth) / n
    hvn, lvn = [], []
    for i in range(1, n - 1):
        if smooth[i] > smooth[i - 1] and smooth[i] >= smooth[i + 1] and smooth[i] >= 1.3 * avg:
            hvn.append(i)
        if lo_i < i < hi_i and smooth[i] < smooth[i - 1] and smooth[i] <= smooth[i + 1] and smooth[i] <= 0.6 * avg:
            lvn.append(i)
    return hvn, lvn


def update_naked_pocs(naked, date, candles, profile, max_age_days=20):
    """Call once after each session ends. `naked` is a list of {"date", "poc", "age"}.
    A POC stops being naked the first time a later session trades through it."""
    lo, hi = min(c["l"] for c in candles), max(c["h"] for c in candles)
    kept = []
    for p in naked:
        if lo <= p["poc"] <= hi or p["age"] + 1 > max_age_days:
            continue
        kept.append({"date": p["date"], "poc": p["poc"], "age": p["age"] + 1})
    kept.append({"date": date, "poc": profile["poc"], "age": 0})
    return kept
