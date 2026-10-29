"""The owner's rule (LOGIC.md, layers 1 to 3) in Python: the same rule as static/rules.js, line for line, so the
server can watch the calls itself (the owner's decision of 7 October, "option 2": a call is recorded the moment it
enters, page or no page). check_rule.py proves this copy and the page's engine give the same calls on every saved
day, on a hand-made day and on random days; a round of research runs that check too. Nothing here comes from
another product: it is the page's engine written again in Python, with the same names."""
import math

IST_OFFSET = 19800
SESSION_END = 15 * 3600 + 30 * 60
SESSION_START = 9 * 3600 + 15 * 60
RATIOS = (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1)
CLOSE_STEP = 0.015  # "Previous close": 100% is 1.5% of the previous day's close (the owner, 15 October; see static/rules.js closeLevels)
INF = float("inf")


def round2(x: float) -> float:
    """JavaScript's Math.round(x * 100) / 100: to the nearest, a tie going up."""
    v = x * 100
    r = math.floor(v)
    return (r + 1 if v - r >= 0.5 else r) / 100


def day_of(t: float) -> int:
    return math.floor((t + IST_OFFSET) / 86400)


def day_over(day: int, now: float) -> bool:
    if math.isinf(now):
        return True
    n = now + IST_OFFSET
    return day < math.floor(n / 86400) or n % 86400 >= SESSION_END


def end_of(b: dict, seconds: int) -> float:
    """When a candle closes: its size on, but never past 3:30 pm of its day; a week candle on its Friday at 3:30 pm (15 October)."""
    if seconds >= 7 * 86400:
        return b["time"] + 4 * 86400 + (SESSION_END - SESSION_START)
    return min(b["time"] + seconds, day_of(b["time"]) * 86400 - IST_OFFSET + SESSION_END)


# ---- Layer 1: the levels of one move

def levels_of(m: dict) -> list:
    span = m["high"] - m["low"]
    levels = [{"ratio": r, "price": round2(m["high"] - r * span if m["up"] else m["low"] + r * span)} for r in RATIOS]
    return sorted(levels, key=lambda l: l["price"])  # a stable sort, as the page's


def move_of(bars: list):
    """"Today so far": the session's own low to high, an up move when its last close is above its open."""
    if not bars:
        return None
    return {"high": max(b["high"] for b in bars), "low": min(b["low"] for b in bars), "up": bars[-1]["close"] >= bars[0]["open"]}


def today_levels_at(bars: list):
    """Candle i judged against the lines as they stood when it began: the day's range up to the candle before it (the first:
    its own). The seven Fibonacci lines only (owner's decision, 8 October evening; see static/rules.js)."""
    return lambda i: levels_of(move_of(bars[:max(1, i)]))


def today_lines_at(bars: list):
    """The lines the chart draws while candle i forms, the day's range up to and with it (owner's decision, 8 October evening:
    the 7 lines worked out again at once when the price breaks 0% or 100%); a call's target follows these."""
    return lambda i: levels_of(move_of(bars[:i + 1]))


def close_levels(close):
    """"Previous close" (the owner, 15 October; see static/rules.js closeLevels): 0% at the previous day's close, 100% 1.5% of it
    (CLOSE_STEP), each line the Fibonacci share of that, above (+) and below (-): 13 lines."""
    if close is None or not close > 0:
        return None
    step, out = close * CLOSE_STEP, []
    for r in RATIOS:
        out.append({"ratio": r, "price": round2(close + r * step), "signed": True})
        if r > 0:
            out.append({"ratio": -r, "price": round2(close - r * step), "signed": True})
    return sorted(out, key=lambda l: l["price"])


def range_levels(low: float, high: float, up: bool) -> list:
    """The 7 lines of today's range as the previous close's lines are redrawn: up, 0% at today's low and +100% at its high;
    down, 0% at today's high and -100% at its low (see static/rules.js rangeLevels)."""
    span = high - low
    levels = [{"ratio": r, "price": round2(low + r * span), "signed": True} if up else {"ratio": -r if r else 0, "price": round2(high - r * span), "signed": True} for r in RATIOS]
    return sorted(levels, key=lambda l: l["price"])


def close_levels_at(bars: list, close):
    """The lines candle i is judged on (the owner, 15 October; see static/rules.js closeLevelsAt): the previous close's 13 lines,
    redrawn after a candle closes above the top line (today's low 0% to today's high +100%) or below the bottom line (today's
    high 0% to today's low -100%)."""
    first = close_levels(close)
    if not first:
        return None
    at, low, high = [first], math.inf, -math.inf
    for k, b in enumerate(bars):
        lv = at[k]
        top, bottom = lv[-1], lv[0]
        low, high = min(low, b["low"]), max(high, b["high"])
        at.append(range_levels(low, high, True) if b["close"] > top["price"] else range_levels(low, high, False) if b["close"] < bottom["price"] else lv)
    return lambda i: at[max(0, min(i, len(at) - 1))]


def level_name(ratio, signed=False) -> str:
    """A line's name: "23.6%", and on the previous close's lines "+23.6%" above the close, "-23.6%" below it."""
    return ("+" if signed and ratio > 0 else "") + f"{ratio * 100:.1f}%"


def move_of_day(d):
    """"Previous day": only the day's four figures are known, so it is an up move when it closed above its open."""
    return {"high": d["high"], "low": d["low"], "up": d["close"] >= d["open"]} if d else None


# ---- Layer 2 inside layer 3's signal: held or crossed, one candle one call, no repeat until closed back across

def with_colour(bar: dict, side: str) -> bool:
    """The candle's colour (Change 5, 21 October, see static/rules.js withColour): a Buy CE needs a candle that did not close below
    its open, a Buy PE one that did not close above it; a candle that closed where it opened gives either."""
    return bar["close"] >= bar["open"] if side == "CE" else bar["close"] <= bar["open"]


def signal_at(bar: dict, prev: float, levels: list, used: dict, signal: str, frm=None):
    """frm(L): the last close off line L; a close exactly on a line has not crossed it yet (9 October, see static/rules.js)."""
    def crossed(L):  # the candle's own wick counts as crossing too (18 October, see static/rules.js)
        p = frm(L) if frm else prev
        return (p < L < bar["close"]) or (p > L > bar["close"]) or (bar["low"] < L < bar["close"]) or (bar["high"] > L > bar["close"])

    def held(L):
        return not crossed(L) and ((prev > L and bar["low"] <= L and bar["close"] > L) or (prev < L and bar["high"] >= L and bar["close"] < L))

    hits = []
    for l in levels:
        kind = "crossed" if crossed(l["price"]) else "held" if held(l["price"]) else None
        side = "CE" if bar["close"] > l["price"] else "PE"
        if kind and (signal == "both" or signal == kind) and with_colour(bar, side) and not used.get((l["price"], side)):  # the line at its price (8 October)
            hits.append(l)
    if not hits:
        return None
    at = hits[0]
    for b in hits[1:]:  # the one nearest the close counts; the first of equals, as the page's reduce
        if abs(b["price"] - bar["close"]) < abs(at["price"] - bar["close"]):
            at = b
    kind = "crossed" if crossed(at["price"]) else "held"
    side = "CE" if bar["close"] > at["price"] else "PE"
    nxt = next((l for l in levels if l["price"] > at["price"]), None) if side == "CE" else next((l for l in reversed(levels) if l["price"] < at["price"]), None)
    if nxt is None:
        return None  # a signal pointing outward from the 0% or 100% level has no next level
    out = {"signalTime": bar["time"], "level": at["price"], "ratio": at["ratio"], "kind": kind, "side": side, "target": nxt["price"],
           "close": bar["close"], "range": round2(bar["high"] - bar["low"]), "entry": None, "exit": None, "points": None, "how": "pending",
           "prices": [l["price"] for l in levels]}
    if at.get("signed"):
        out["signed"] = True  # a line of the previous close (15 October): its name shows the + (level_name)
    return out


def kept_at(bar: dict, levels: list, frm, side: str):
    """A call given live, kept although the candle's prices no longer give it (9 October; see static/rules.js keptAt)."""
    ok = [l for k, l in enumerate(levels) if (k < len(levels) - 1 if side == "CE" else k > 0)]
    if not ok:
        return None
    touched = [l for l in ok if bar["low"] <= l["price"] <= bar["high"]]
    pool = touched or ok
    at = pool[0]
    for b in pool[1:]:  # the nearest the close; the first of equals, as the page's reduce
        if abs(b["price"] - bar["close"]) < abs(at["price"] - bar["close"]):
            at = b
    p = frm(at["price"])
    kind = "crossed" if ((p < at["price"] or bar["low"] < at["price"]) if side == "CE" else (p > at["price"] or bar["high"] > at["price"])) else "held"  # the wick counts (18 October)
    nxt = next((l for l in levels if l["price"] > at["price"]), None) if side == "CE" else next((l for l in reversed(levels) if l["price"] < at["price"]), None)
    out = {"signalTime": bar["time"], "level": at["price"], "ratio": at["ratio"], "kind": kind, "side": side, "target": nxt["price"],
           "close": bar["close"], "range": round2(bar["high"] - bar["low"]), "entry": None, "exit": None, "points": None, "how": "pending",
           "kept": True, "prices": [l["price"] for l in levels]}
    if at.get("signed"):
        out["signed"] = True
    return out


# Idea 24, a call past the day's high or low (the owner, 13 October evening: "yes, build way 1"; see static/rules.js NEW_HIGH_LOW
# for the words): NIFTY 50 only, 5-minute candles, "Today so far" lines
NEW_HIGH_LOW = {"NIFTY 50": True}

# Ideas 8 and 5 against the back-and-forth on one line (13 October) were removed from the rule on 18 October with idea 13 (the
# owner: "all three remove"); lab/replay.js keeps them as research settings


def past_edge_at(bar: dict, levels: list, used: dict):
    """A close above the top line (Buy CE) or below the bottom line (Buy PE), when no line gives a signal: a Crossed call past
    it, with no target until the lines move past its entry (static/rules.js pastEdgeAt)."""
    top, bottom = levels[-1], levels[0]
    at = top if bar["close"] > top["price"] else bottom if bar["close"] < bottom["price"] else None
    if at is None:
        return None
    side = "CE" if at is top else "PE"
    if used.get((at["price"], side)):
        return None
    return {"signalTime": bar["time"], "level": at["price"], "ratio": at["ratio"], "kind": "crossed", "side": side, "target": None, "edge": True,
            "close": bar["close"], "range": round2(bar["high"] - bar["low"]), "entry": None, "exit": None, "points": None, "how": "pending",
            "prices": [l["price"] for l in levels]}


def enter_at(sig: dict, bar: dict, price=None):
    """The entry (owner, 7 October): already at or past the target, the call aims at the first level beyond the entry
    price; with no level left beyond it, there is no call. A call past the day's high or low (idea 24) enters as it is.
    price: since 18 October the price the call fired at (paper_trades); the candle's open before that."""
    entry = price if price is not None else bar["open"]
    target, aimed = sig["target"], None
    if target is not None and (entry >= target if sig["side"] == "CE" else entry <= target):
        prices = sig["prices"]
        beyond = next((p for p in prices if p > entry), None) if sig["side"] == "CE" else next((p for p in reversed(prices) if p < entry), None)
        if beyond is None:
            return None
        target, aimed = beyond, "beyond"
    t = {k: v for k, v in sig.items() if k not in ("prices", "fireAt")}
    prices = sig["prices"]  # the levels beyond the target, nearest first: idea P5 carries the call up them, and the carry read asks about the first
    ladder = [] if target is None else [p for p in prices if p > target] if sig["side"] == "CE" else [p for p in reversed(prices) if p < target]
    t.update(target=target, aimed=aimed, ladder=ladder, entry=entry, entryTime=bar["time"], how="open")
    return t


def trail_step(st: dict, close: float, levels: list, side: str, place: str, buf: float) -> str:
    """Rule 2 of the owner's specification (9 October; see static/rules.js trailStep): on one closed candle, the exit against the
    stop as it stood ("sell"), then the stop moved to the furthest line crossed beyond the furthest one so far ("at"), or to the
    line behind it ("back"), never backward. st {stop, stopRatio, line, ratio} is changed in place."""
    d = 1 if side == "CE" else -1
    if d * (close - st["stop"]) < 0:
        return "sell"
    frm = st["line"] if st["line"] is not None else st["stop"]
    far = None
    for l in levels:
        if d * (l["price"] - frm) > 0 and d * (close - l["price"]) > buf and (far is None or d * (l["price"] - far["price"]) > 0):
            far = l
    if far is None:
        return "hold"
    st["line"], st["ratio"] = far["price"], far["ratio"]
    to = far
    if place == "back":
        to = None
        for l in levels:
            if d * (far["price"] - l["price"]) > 0 and (to is None or d * (l["price"] - to["price"]) > 0):
                to = l
    if to is not None and d * (to["price"] - st["stop"]) > 0:
        st["stop"], st["stopRatio"] = to["price"], to["ratio"]
    return "hold"


def atr_before(bars: list, period: int) -> list:
    """The ATR for Rule 2's buffer, as static/rules.js atrBefore: [i] is the ATR through the candle before bars[i] (Wilder's, begun
    with the plain average of the first `period` true ranges; a day's first candle its own high - low); None until then."""
    out, atr, total = [None], None, 0
    for j in range(len(bars) - 1):
        b = bars[j]
        p = bars[j - 1]["close"] if j > 0 and day_of(bars[j - 1]["time"]) == day_of(b["time"]) else None
        tr = b["high"] - b["low"] if p is None else max(b["high"] - b["low"], abs(b["high"] - p), abs(b["low"] - p))
        if j < period:
            total += tr
            if j == period - 1:
                atr = total / period
        else:
            atr = (atr * (period - 1) + tr) / period
        out.append(atr)
    return out


# ---- The Call Gate, version 2 (the owner's "Call Gate" version 2 document, its Implementation Brief and reference code, 23 October
# morning; static/rules.js GATE and the functions under it, which this copy follows line for line): one extra step between a signal and
# its order, judged on the signal candle the moment the signal is born, with the ATR(14) as of the previous candle carried from the
# previous day. A: a parallel call is never blocked in the default "log": it carries an advice note, OK or WOULD SKIP by day health (the
# points of this day's signals that fired and exited, taken or on paper); "health" makes the advice a block; B: an opening call (before 09:45) passes only on a close beyond the opening range (the first 3 candles) by
# 0.25 x ATR; no late rule; C: a range of more than 2.5 x ATR is a chase; D: inside a sideways zone (height 1.5 x ATR), by where the
# candle closes in it. Mode SHADOW: every call fires, the verdict rides on it. Mode LIVE: a SKIP from a check in liveChecks is followed
# on paper (no order). GATE_V1 is version 1 as settings
GATE = {"mode": "SHADOW", "liveChecks": ["parallel", "opening", "late", "chase", "zone"],
        "parallel": "log", "healthMinAtr": 0.0, "openingUntil": 9 * 3600 + 45 * 60, "opening": "orb", "orCandles": 3, "orbBufferAtr": 0.25,
        "lateAfter": None, "chaseAtr": 2.5, "zoneRule": True, "zoneN": 6, "zoneHeightAtr": 1.5, "zoneErMax": 0.30, "bufferAtr": 0.25,
        "strongBodyAtr": 0.5, "strongCloseFrac": 0.30, "strongLookback": 3, "legLookback": 12, "legSizeAtr": 2.0, "legErMin": 0.60, "atrPeriod": 14}
GATE_V1 = {**GATE, "parallel": "skip", "opening": "skip", "lateAfter": 14 * 3600 + 45 * 60, "zoneHeightAtr": 2.0}
GATE_HEALTH = {**GATE, "parallel": "health"}  # the parallel advice switched on as a block (what could go live later, the owner's decision)


def _hm(sec) -> str:
    return f"{int(sec // 3600):02d}:{int(sec % 3600 // 60):02d}"


def _round1(x: float) -> float:
    return math.floor(x * 10 + 0.5) / 10  # Math.round(x * 10) / 10: halves up, towards +infinity, as JavaScript rounds them (-166.45 -> -166.4)


def _num1(x) -> str:
    """A number to one decimal, written as JavaScript writes it: 3, 3.5 (static/rules.js num1)."""
    v = _round1(x)
    return str(int(v)) if float(v).is_integer() else str(v)


def _signed1(x) -> str:
    return ("-" if x < 0 else "+") + f"{abs(_round1(x)):.1f}"


def _pct(pos: float) -> str:
    """Math.round(pos * 100), halves up as JavaScript rounds them."""
    return f"{int(math.floor(pos * 100 + 0.5))}% up"


def true_range(b: dict, p) -> float:
    return b["high"] - b["low"] if p is None else max(b["high"] - b["low"], abs(b["high"] - p), abs(b["low"] - p))


def gate_atr(closed: list, period: int, seed, prev_close) -> list:
    """gate_atr(closed)[i]: the ATR as of the candle before closed[i]; Wilder from the seed, else the plain average of the first `period`."""
    out, atr, total = [], seed, 0.0
    for j, b in enumerate(closed):
        out.append(atr)
        tr = true_range(b, closed[j - 1]["close"] if j > 0 else prev_close)
        if atr is None:
            total += tr
            if j == period - 1:
                atr = total / period
        else:
            atr = (atr * (period - 1) + tr) / period
    return out


def atr_seed_of(bars: list, period: int):
    """The seed for the next day: Wilder's ATR over the previous sessions' candles; None with fewer candles than the period."""
    if not bars or len(bars) < period:
        return None
    atr, total = None, 0.0
    for j, b in enumerate(bars):
        tr = true_range(b, bars[j - 1]["close"] if j > 0 else None)
        if atr is None:
            total += tr
            if j == period - 1:
                atr = total / period
        else:
            atr = (atr * (period - 1) + tr) / period
    return atr


def efficiency(closes: list) -> float:
    moves = sum(abs(closes[j] - closes[j - 1]) for j in range(1, len(closes)))
    return abs(closes[-1] - closes[0]) / moves if moves else 0.0


def zone_step(zone: dict, closed: list, i: int, atr, day_first: int, g: dict) -> None:
    """One closed candle, before any signal on it is judged: the active zone ends on a close outside it by the buffer; else, from the day's
    7th candle on, a zone is looked for over the last zoneN candles."""
    bar = closed[i]
    zone["broke"] = None
    if zone["box"] and atr is not None:
        buf = g["bufferAtr"] * atr
        if bar["close"] > zone["box"]["hi"] + buf or bar["close"] < zone["box"]["lo"] - buf:
            zone["broke"] = "up" if bar["close"] > zone["box"]["hi"] else "down"
            zone["box"] = None
            if "ended" in zone and i > 0:
                zone["ended"].append(closed[i - 1]["time"])  # the last candle inside the zone (the Loss Cutter's daily line)
    if zone["box"] or zone["broke"] or atr is None or i - day_first < g["zoneN"]:
        return
    s = i - g["zoneN"] + 1
    hi, lo = max(b["high"] for b in closed[s:i + 1]), min(b["low"] for b in closed[s:i + 1])
    er = efficiency([b["close"] for b in closed[i - g["zoneN"]:i + 1]])
    if hi - lo <= g["zoneHeightAtr"] * atr and er <= g["zoneErMax"]:
        zone["box"] = {"lo": lo, "hi": hi, "found": bar["time"]}
        zone["found"].append(bar["time"])


def strong_candle(closed: list, i: int, side: str, atr: float, day_first: int, g: dict) -> dict:
    b = closed[i]
    rng, buf = b["high"] - b["low"], g["bufferAtr"] * atr
    body = abs(b["close"] - b["open"]) >= g["strongBodyAtr"] * atr
    end = rng > 0 and (b["high"] - b["close"] if side == "CE" else b["close"] - b["low"]) <= g["strongCloseFrac"] * rng
    ext = None
    for j in range(max(day_first, i - g["strongLookback"]), i):
        v = closed[j]["high"] if side == "CE" else closed[j]["low"]
        ext = v if ext is None else (max(ext, v) if side == "CE" else min(ext, v))
    beyond = ext is not None and (b["close"] > ext + buf if side == "CE" else b["close"] < ext - buf)
    failed = [n for n, ok in (("body", body), ("close near end", end), ("beyond last3", beyond)) if not ok]
    return {"ok": not failed, "failed": failed}


def trend_continuation(closed: list, i: int, side: str, atr: float, day_first: int, g: dict) -> dict:
    s0, c = max(day_first, i - g["legLookback"]), closed[i]
    h = s0
    for j in range(s0, i + 1):
        if closed[j]["high"] > closed[h]["high"] if side == "PE" else closed[j]["low"] < closed[h]["low"]:
            h = j
    ext = None
    for j in range(h, i):
        v = closed[j]["low"] if side == "PE" else closed[j]["high"]
        ext = v if ext is None else (min(ext, v) if side == "PE" else max(ext, v))
    size = closed[h]["high"] - c["close"] if side == "PE" else c["close"] - closed[h]["low"]
    new_ext = h < i and (c["close"] < ext if side == "PE" else c["close"] > ext)
    half = (c["close"] - c["low"] if side == "PE" else c["high"] - c["close"]) <= 0.5 * (c["high"] - c["low"])
    er = efficiency([b["close"] for b in closed[h:i + 1]])
    return {"ok": size >= g["legSizeAtr"] * atr and er >= g["legErMin"] and new_ext and half, "sizeAtr": size / atr, "er": er}


def zone_verdict(closed: list, i: int, side: str, atr: float, box: dict, day_first: int, g: dict) -> dict:
    c, lo, hi = closed[i], box["lo"], box["hi"]
    if hi - lo <= 0:
        return {"gate": "TAKE", "why": "zone has no height"}
    pos = (c["close"] - lo) / (hi - lo)
    pct = _pct(pos)
    trig = c["high"] if side == "CE" else c["low"]
    if side == "CE":
        if c["close"] > hi:
            return {"gate": "TAKE", "why": "closes above the sideways zone (breakout)"}
        if pos >= 2 / 3:
            if trig > hi:
                return {"gate": "TAKE", "why": f"top third of the zone, but the entry trigger {_num1(trig)} is above the zone high {_num1(hi)}"}
            return {"gate": "SKIP", "why": f"buying in the top third of a sideways zone ({pct}), trigger still inside it"}
        if pos <= 1 / 3:
            return {"gate": "TAKE", "why": f"bounce from the bottom third of the zone ({pct})"}
    else:
        if c["close"] < lo:
            return {"gate": "TAKE", "why": "closes below the sideways zone (breakdown)"}
        if pos <= 1 / 3:
            if trig < lo:
                return {"gate": "TAKE", "why": f"bottom third of the zone, but the entry trigger {_num1(trig)} is below the zone low {_num1(lo)}"}
            return {"gate": "SKIP", "why": f"selling in the bottom third of a sideways zone ({pct}), trigger still inside it"}
        if pos >= 2 / 3:
            return {"gate": "TAKE", "why": f"bounce from the top third of the zone ({pct})"}
    t = trend_continuation(closed, i, side, atr, day_first, g)
    if t["ok"]:
        return {"gate": "TAKE", "why": f"middle of the zone, but a trend continuation (leg {_num1(t['sizeAtr'])} x ATR, {int(math.floor(t['er'] * 100 + 0.5))}% one-way)"}
    st = strong_candle(closed, i, side, atr, day_first, g)
    if st["ok"]:
        return {"gate": "TAKE", "why": "middle of the zone, but a strong candle"}
    return {"gate": "SKIP", "why": f"weak call from the middle of a sideways zone ({pct}; not {', not '.join(st['failed'])})"}


def opening_range(closed: list, day_first: int, g: dict):
    n = g["orCandles"]
    if len(closed) - day_first < n:
        return None
    return {"hi": max(b["high"] for b in closed[day_first:day_first + n]), "lo": min(b["low"] for b in closed[day_first:day_first + n])}


def parallel_advice(parallel: bool, health: float, atr, g: dict) -> str:
    """The advice on a parallel call (the revised version 2, section 6): a note only, never a block; '' for a call that is not parallel."""
    if not parallel:
        return ""
    if atr is not None and health > g["healthMinAtr"] * atr:
        return f"OK: parallel call, day winning (closed signals today {_signed1(health)} points)"
    return f"WOULD SKIP: parallel call, day not winning (closed signals today {_signed1(health)} points)"


def entry_checks(closed: list, i: int, side: str, atr, day_first: int, g: dict):
    """The opening window, the late rule and the chase on the signal candle: the first that objects ({gate: SKIP, why, check}), or None.
    The Call Gate and the Loss Cutter ask the same three (static/rules.js entryChecks)."""
    bar = closed[i]
    when = (bar["time"] + IST_OFFSET) % 86400
    if when < g["openingUntil"] and g["opening"] != "allow":
        r = opening_range(closed, day_first, g) if g["opening"] == "orb" and atr is not None and i - day_first >= g["orCandles"] else None
        buf = g["orbBufferAtr"] * atr if atr is not None else 0
        beyond = bool(r) and (bar["close"] > r["hi"] + buf if side == "CE" else bar["close"] < r["lo"] - buf)
        if not beyond:
            return {"gate": "SKIP", "why": f"opening window: signal before {_hm(g['openingUntil'])}" + ("" if g["opening"] == "skip" else ", no close beyond the opening range"), "check": "opening"}
    if g["lateAfter"] is not None and when > g["lateAfter"]:
        return {"gate": "SKIP", "why": f"late: signal after {_hm(g['lateAfter'])}", "check": "late"}
    if atr is not None and bar["high"] - bar["low"] > g["chaseAtr"] * atr:
        return {"gate": "SKIP", "why": f"chase: signal candle range {_num1((bar['high'] - bar['low']) / atr)} x ATR", "check": "chase"}
    return None


def gate_verdict(closed: list, i: int, side: str, atr, zone: dict, parallel: bool, health: float, day_first: int, g: dict) -> dict:
    """The verdict for a signal born on candle i: gate, why, check (the one that decided; None on TAKE 'no sideways zone active')."""
    if parallel and g["parallel"] in ("health", "skip"):  # not in the default "log": a parallel call goes on to the other checks
        if g["parallel"] == "skip":
            return {"gate": "SKIP", "why": f"parallel call: a {side} call is already open", "check": "parallel"}
        if atr is None or not health > g["healthMinAtr"] * atr:
            return {"gate": "SKIP", "why": f"parallel call on a day that is not winning (closed signals today {_signed1(health)} points)", "check": "parallel"}
    early = entry_checks(closed, i, side, atr, day_first, g)
    if early:
        return early
    if g["zoneRule"] and zone["box"] and atr is not None:
        return {**zone_verdict(closed, i, side, atr, zone["box"], day_first, g), "check": "zone"}
    return {"gate": "TAKE", "why": "no sideways zone active", "check": None}


def _ist_hm(t) -> str:
    return _hm((t + IST_OFFSET) % 86400)


def gate_summary(res: dict, date: str) -> str:
    """The daily summary line (the brief, section 6) for a finished day, from the rule's result (static/rules.js gateSummary)."""
    fired = [t for t in res["trades"] if t.get("entry") is not None and t.get("gate")]
    take = [t for t in fired if t["gate"] == "TAKE"]
    skip = [t for t in fired if t["gate"] == "SKIP"]
    by = lambda c: sum(1 for t in skip if t.get("gateCheck") == c)
    pts = lambda lst: round2(sum(t.get("points") or 0 for t in lst))
    winners = [f"{_ist_hm(t['signalTime'])} {t['side']} {_signed1(t['points'])} ({t.get('gateCheck')})" for t in skip if (t.get("points") or 0) > 0]
    flagged = [t for t in fired if (t.get("gateAdvice") or "").startswith("WOULD SKIP")]  # the parallel advice, judged like a check
    out = [t for t in flagged if t["gate"] == "TAKE"]
    won_pts, lost_pts = pts([t for t in out if (t.get("points") or 0) > 0]), pts([t for t in out if (t.get("points") or 0) <= 0])
    last = fired[-1] if fired else None
    return (f"GATE DAY {date} · calls {len(fired)} · TAKE {len(take)} · SKIP {len(skip)} · SKIP by check: parallel {by('parallel')} · opening {by('opening')} · late {by('late')} · chase {by('chase')} · zone {by('zone')}"
            f" · points if every call had been taken {_signed1(pts(fired))} · points of the TAKE calls {_signed1(pts(take))} · skipped winners: {' · '.join(winners) if winners else 'none'}"
            f" · parallel advice: flagged {len(flagged)} · went out {len(out)} · points of those {_signed1(pts(out))} (winners {_signed1(won_pts)}, losers {_signed1(lost_pts)})"
            f" · zones found: {' · '.join(_ist_hm(t) for t in res.get('zonesFound') or []) or 'none'} · day health at the last signal ({_ist_hm(last['signalTime']) if last else '-'}): {_signed1(last.get('gateHealth') or 0) if last else '-'}")


# The Loss Cutter (the owner's Loss_Cutter.docx and Sideways_Zone_v3.docx with their reference code, 24 October; static/rules.js LC):
# entry checks built on the Call Gate version 2, judged beside it on every signal (lc, lcWhy, lcCheck, lcAdvice). 1. the opening window,
# the late rule and the chase, as the Call Gate; 2. the chase window: the candle before, more than chaseWindowAtr x ATR tall, the same way;
# 3. the sideways zone version 3, its own tracker with the box up to 2.5 x ATR, the version 2 judgement inside ("edges"; strict-zone
# advice) or only a breakout ("breakout"); 4. the worn line, advice only by default; 5. the stack cap, when the call fires. Mode SHADOW
# first; LIVE holds the order (paper) for a SKIP from a check in liveChecks. LC_V2 gives the Call Gate version 2's verdicts
LC = {**GATE, "mode": "SHADOW", "liveChecks": ["chasewindow", "stack"], "zoneHeightAtr": 2.5, "zoneMode": "edges", "chaseWindow": True, "chaseWindowAtr": 2.5,
      "stackCap": 3, "stackMode": "skip", "wornMode": "log", "wornFailures": 2, "wornMinutes": 120, "advice": True, "premiumStop": 0.15,
      "indices": ["NIFTY 50"]}  # the indices it runs on (the owner, 24 October: "built it for nifty 50 only")
LC_V2 = {**LC, "zoneHeightAtr": 1.5, "chaseWindow": False, "stackCap": None, "wornMode": "off", "advice": False}
LC_STRICT = {**LC, "zoneMode": "breakout", "wornMode": "skip"}
LC_ZONE_ONLY = {**LC, "chaseWindow": False, "stackCap": None, "wornMode": "off", "advice": False}


def breaks_out(bar: dict, side: str, box: dict) -> bool:
    """The call leaves the box: its trigger (the signal candle's high for a CE, low for a PE) or its close is beyond the box its way."""
    if side == "CE":
        return bar["high"] > box["hi"] or bar["close"] > box["hi"]
    return bar["low"] < box["lo"] or bar["close"] < box["lo"]


def violent_before(closed: list, i: int, side: str, atr, day_first: int, g: dict) -> bool:
    """The chase window: the candle before the signal candle was more than chaseWindowAtr x ATR tall and went the same way as the call."""
    if i - 1 < day_first or atr is None:
        return False
    p = closed[i - 1]
    same = p["close"] > p["open"] if side == "CE" else p["close"] < p["open"]
    return p["high"] - p["low"] > g["chaseWindowAtr"] * atr and same


def worn_failures(history: list, s: dict, g: dict) -> int:
    """The worn line: earlier signals on the same line (price), born at or after openingUntil, within wornMinutes before s, that were
    cancelled on or before s's candle, or fired and closed at a loss on or before it (static/rules.js wornFailures)."""
    n = 0
    for e in history:
        if e is s or e["level"] != s["level"] or (e["signalTime"] + IST_OFFSET) % 86400 < g["openingUntil"]:
            continue
        age = (s["signalTime"] - e["signalTime"]) / 60
        if not (0 < age <= g["wornMinutes"]):
            continue
        if e.get("cancelTime") is not None:
            if e["cancelTime"] <= s["signalTime"]:
                n += 1
        elif e.get("exit") is not None and e["exitTime"] <= s["signalTime"] and e["points"] < 0:
            n += 1
    return n


def lc_verdict(closed: list, i: int, side: str, atr, zone: dict, failures: int, day_first: int, g: dict, line: str) -> dict:
    """The Loss Cutter's verdict for a signal born on candle i (checks 1 to 4): lc, why, check, advice (static/rules.js lcVerdict)."""
    early = entry_checks(closed, i, side, atr, day_first, g)
    if early:
        return {"lc": "SKIP", "why": early["why"], "check": early["check"], "advice": ""}
    if g["chaseWindow"] and violent_before(closed, i, side, atr, day_first, g):
        p = closed[i - 1]
        return {"lc": "SKIP", "why": f"chase: the candle before was a violent {side} candle ({_num1((p['high'] - p['low']) / atr)} x ATR)", "check": "chasewindow", "advice": ""}
    broke_out, in_zone, advice = False, None, ""
    if g["zoneRule"] and zone["box"] and atr is not None:
        out = breaks_out(closed[i], side, zone["box"])
        if g["zoneMode"] == "edges":
            v = zone_verdict(closed, i, side, atr, zone["box"], day_first, g)
            if v["gate"] == "SKIP":
                return {"lc": "SKIP", "why": v["why"], "check": "zone", "advice": ""}
            broke_out, in_zone = out, v["why"]
            if g["advice"] and not out:
                advice = "WOULD SKIP (strict zone): inside a sideways zone and the call does not break out of it"
        elif out:
            broke_out = True
        else:
            lo, hi = zone["box"]["lo"], zone["box"]["hi"]
            return {"lc": "SKIP", "why": f"inside a sideways zone ({_num1(lo)} to {_num1(hi)}, {_num1((hi - lo) / atr)} x ATR tall): the call does not break out of it", "check": "zone", "advice": ""}
    if g["wornMode"] != "off" and not broke_out and failures >= g["wornFailures"]:
        why = f"worn line: {failures} earlier failures on {line} in the last {g['wornMinutes']} minutes"
        if g["wornMode"] == "skip":
            return {"lc": "SKIP", "why": why, "check": "worn", "advice": ""}
        advice = (advice + " · " if advice else "") + f"WOULD SKIP ({why})"
    return {"lc": "TAKE", "why": "breakout from a sideways zone" if broke_out else (in_zone or "no check objects"), "check": None, "advice": advice}


def stack_step(t: dict, open_: list, g: dict) -> None:
    """The stack cap, when the call t fires: the calls the same way the Loss Cutter took that are still open (static/rules.js stackStep)."""
    n = sum(1 for o in open_ if o["side"] == t["side"] and o.get("lc") == "TAKE")
    t["lcOpenSame"] = n
    if g["stackCap"] is None or n < g["stackCap"]:
        return
    why = f"stack cap: {n} calls in the same direction are already open"
    if g["stackMode"] == "skip":
        t["lc"], t["lcWhy"], t["lcCheck"] = "SKIP", why, "stack"
        if g["mode"] == "LIVE" and "stack" in g["liveChecks"] and not t.get("liveGiven"):
            t["paper"] = True
    else:
        t["lcAdvice"] = (t["lcAdvice"] + " · " if t.get("lcAdvice") else "") + f"WOULD SKIP ({why})"


def lc_summary(res: dict, date: str) -> str:
    """The Loss Cutter's daily line (static/rules.js lcSummary)."""
    fired = [t for t in res["trades"] if t.get("entry") is not None and t.get("lc")]
    take = [t for t in fired if t["lc"] == "TAKE"]
    skip = [t for t in fired if t["lc"] == "SKIP"]
    pts = lambda lst: round2(sum(t.get("points") or 0 for t in lst))
    part = lambda name, lst: f"{name} {len(lst)} ({_signed1(pts(lst))})"
    by = lambda c: [t for t in skip if t.get("lcCheck") == c]
    new_zone = [t for t in by("zone") if not (t.get("gate") == "SKIP" and t.get("gateCheck") == "zone")]
    adv = lambda word: [t for t in fired if word in (t.get("lcAdvice") or "")]
    winners = [f"{_ist_hm(t['signalTime'])} {t['side']} {_signed1(t['points'])} ({t.get('lcCheck')})" for t in skip if (t.get("points") or 0) > 0]
    ended = res.get("lcZonesEnded") or []
    zones = [f"{_ist_hm(f)}-{_ist_hm(ended[k]) if k < len(ended) and ended[k] is not None else 'open'}" for k, f in enumerate(res.get("lcZonesFound") or [])]
    return (f"LOSS CUTTER DAY {date} · calls {len(fired)} · TAKE {len(take)} · SKIP {len(skip)} · SKIP by check (calls, points): {part('opening', by('opening'))} · {part('chase', by('chase'))}"
            f" · {part('chase window', by('chasewindow'))} · {part('zone', by('zone'))}, of them not skipped by the Call Gate's zone {len(new_zone)} ({_signed1(pts(new_zone))}) · {part('worn', by('worn'))} · {part('stack', by('stack'))}"
            f" · points if every call had been taken {_signed1(pts(fired))} · points of the TAKE calls {_signed1(pts(take))} · skipped winners: {' · '.join(winners) if winners else 'none'}"
            f" · advice: {part('worn line', adv('worn line'))} · {part('strict zone', adv('strict zone'))} · {part('stack cap', adv('stack cap'))} · zones: {' · '.join(zones) or 'none'}")


# The Profit Lock (the owner's "Profit Lock Exit Rule" document and profit_lock_reference.py, 24 October; see static/rules.js LOCK):
# an extra exit, asked after every existing exit of a closed candle, never on the day's last one. SHADOW: the lock rides on the call
# (lock, lockAlso) and nothing is closed; LIVE: the call ends there ("lock"). The settings are index points of NIFTY 50
LOCK_PRESETS = {"MAX": {"armPts": 20, "keep": 0.80, "minTrailPts": 8, "floorPts": 0, "slipPts": 0}}
LOCK_PRESETS["STEADY"] = {**LOCK_PRESETS["MAX"], "keep": 0.70}
LOCK_PRESETS["RUNNER"] = {**LOCK_PRESETS["STEADY"], "minTrailPts": 16}
LOCK_PRESETS["OFF"] = {**LOCK_PRESETS["MAX"], "armPts": None}
LOCK = {"mode": "SHADOW", "name": "MAX", **LOCK_PRESETS["MAX"], "compare": ["STEADY", "RUNNER"], "indices": ["NIFTY 50"]}

# The Trade Plan (static/rules.js PLAN, 29 October): on NIFTY 50, the first 3 calls that fired at or after 12:00 and before 15:00, "TAKE"
# (call 1, 2 or 3 of 3); every other call that fired "SKIP" and why; mode SHADOW: a mark only, every call keeps its row and its order
PLAN = {"mode": "SHADOW", "name": "afternoon 3", "indices": ["NIFTY 50"], "from": "12:00", "to": "15:00", "maxCalls": 3}
# The rule builder (static/rules.js BUILDER, 30 October): the evening builder's survivors, each a list of facts a call must match; mode
# SHADOW: a mark "KEEP" (which rules) or "SKIP" on every call that fired
BUILDER = {"mode": "SHADOW", "indices": ["NIFTY 50"], "medianAtr": 20.82269926267992, "rules": [
    {"name": "green + after 12:00", "foundOn": "2026-10-29", "facts": [["candle", "green"], ["afterNoon", "after 12:00"]]},
    {"name": "above the close + calm days", "foundOn": "2026-10-29", "facts": [["line", "above the close"], ["atrRegime", "calm days"]]},
    {"name": "near line + fell", "foundOn": "2026-10-29", "facts": [["lineFar", "near line"], ["move", "fell"]]},
    {"name": "9 + above the close", "foundOn": "2026-10-29", "facts": [["hour", "9"], ["line", "above the close"]]},
    {"name": "Wed + after 12:00", "foundOn": "2026-10-29", "facts": [["weekday", "Wed"], ["afterNoon", "after 12:00"]]}
]}
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]  # Python's weekday(): Monday 0


def atr_path(bars: list, seed, period: int = 14) -> list:
    """Wilder's ATR through the day's candles from the carried-in seed (static/rules.js atrPath)."""
    out, a = [], seed
    for j, b in enumerate(bars):
        tr = true_range(b, bars[j - 1]["close"] if j > 0 else None)
        a = tr if a is None else (a * (period - 1) + tr) / period
        out.append(a)
    return out


def bucket_of(x: float, edges: list, names: list) -> str:
    for i, e in enumerate(edges):
        if x < e:
            return names[i]
    return names[len(edges)]


def call_facts(t: dict, fired: list, n: int, bars: list, atrs: list, prev_close, atr_seed, median_atr: float):
    """The facts of call t, the n-th of the day's fired calls (static/rules.js callFacts): the candles up to the signal candle and the calls before."""
    k0 = next((i for i, b in enumerate(bars) if b["time"] == t["signalTime"]), -1)
    if k0 < 0:
        return None
    c = bars[k0]
    a = atrs[k0] or 1
    body = (c["close"] - c["open"]) / a
    rng = (c["high"] - c["low"]) / a
    move6 = (c["close"] - bars[k0 - 6]["close"]) / a if k0 >= 6 else 0
    gap = 0 if prev_close is None else (bars[0]["open"] - prev_close) / a
    hi = max(b["high"] for b in bars[:k0 + 1])
    lo = min(b["low"] for b in bars[:k0 + 1])
    place = (c["close"] - lo) / max(hi - lo, 1e-9)
    last = fired[n - 1] if n > 0 else None
    when = ist_hm(t["entryTime"])
    ratio = t["ratio"]
    import datetime
    weekday = WEEKDAYS[datetime.datetime.utcfromtimestamp(bars[0]["time"] + IST_OFFSET).weekday()]
    return {
        "hour": str(int(((t["entryTime"] + IST_OFFSET) % 86400) // 3600)), "side": t["side"],
        "line": "above the close" if ratio > 0 else "below the close" if ratio < 0 else "the close line", "lineFar": "far line" if abs(ratio) >= 0.5 else "near line",
        "candle": bucket_of(body, [-1, -0.3, 0.3, 1], ["big red", "red", "small", "green", "big green"]), "candleSize": bucket_of(rng, [0.8, 1.6], ["small candle", "normal candle", "big candle"]),
        "move": bucket_of(move6, [-2, -0.7, 0.7, 2], ["fell a lot", "fell", "flat", "rose", "rose a lot"]), "withMove": "with the move" if (t["side"] == "CE") == (move6 > 0) else "against the move",
        "gap": bucket_of(gap, [-1, 1], ["gap down", "flat open", "gap up"]), "dayRange": bucket_of((hi - lo) / a, [3, 6], ["quiet day so far", "normal day so far", "wide day so far"]),
        "nth": "1st call" if n == 0 else "2nd call" if n == 1 else "3rd call" if n == 2 else "4th or later",
        "lastCall": "no call before" if last is None else ("last call won" if last["points"] > 0 else "last call lost") if last.get("exitTime") is not None and last["exitTime"] <= t["entryTime"] else "last call open",
        "atrRegime": "wild days" if atr_seed is not None and atr_seed >= median_atr else "calm days", "weekday": weekday,
        "place": "near the day's high" if place > 0.7 else "near the day's low" if place < 0.3 else "mid-day range", "afterNoon": "after 12:00" if when >= "12:00" else "before 12:00",
    }


def builder_step(trades: list, bars: list, prev_close, atr_seed, b: dict = BUILDER) -> int:
    """The builder's mark on every call that fired (static/rules.js builderStep)."""
    fired = sorted((t for t in trades if t.get("entryTime") is not None and t.get("how") != "cancelled"), key=lambda t: (t["entryTime"], t["signalTime"], t["side"]))
    atrs = atr_path(bars, atr_seed)
    kept = 0
    for n, t in enumerate(fired):
        f = call_facts(t, fired, n, bars, atrs, prev_close, atr_seed, b["medianAtr"])
        if f is None:
            continue
        hit = [r for r in b["rules"] if all(f.get(k) == v for k, v in r["facts"])]
        if hit:
            kept += 1
            t["builder"], t["builderWhy"] = "KEEP", "; ".join(r["name"] for r in hit)
        else:
            t["builder"], t["builderWhy"] = "SKIP", "no rule"
    return kept


def ist_hm(t: float) -> str:
    s = int(t + IST_OFFSET) % 86400
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}"


def plan_step(trades: list, p: dict = PLAN) -> int:
    """The plan's mark on every call that fired (static/rules.js planStep): by the moment fired, the earliest first."""
    taken = 0
    fired = sorted((t for t in trades if t.get("entryTime") is not None and t.get("how") != "cancelled"), key=lambda t: (t["entryTime"], t["signalTime"], t["side"]))
    for t in fired:
        when = ist_hm(t["entryTime"])
        if when < p["from"]:
            t["plan"], t["planWhy"] = "SKIP", f"fired at {when}, before {p['from']}"
        elif when >= p["to"]:
            t["plan"], t["planWhy"] = "SKIP", f"fired at {when}, after {p['to']}"
        elif taken >= p["maxCalls"]:
            t["plan"], t["planWhy"] = "SKIP", f"the {p['maxCalls']} calls are taken"
        else:
            taken += 1
            t["plan"], t["planWhy"] = "TAKE", f"call {taken} of {p['maxCalls']}"
    return taken



def lock_floor(peak: float, g: dict):
    """The floor in index points of profit; None while the lock is not armed (static/rules.js lockFloor)."""
    if g["armPts"] is None or peak < g["armPts"]:
        return None
    return max(g["floorPts"], peak - max(g["minTrailPts"], (1 - g["keep"]) * peak))


def lock_step(st: dict, side: str, entry: float, bar: dict, g: dict):
    """One closed candle for one call's lock (the reference's ProfitLock.on_candle): st {peak, peakTime} changed in place;
    the exit {price, points, floor}, or None to hold."""
    d = 1 if side == "CE" else -1
    best = d * ((bar["high"] if d == 1 else bar["low"]) - entry)
    if best > st["peak"]:
        st["peak"], st["peakTime"] = best, bar["time"]
    floor = lock_floor(st["peak"], g)
    profit = d * (bar["close"] - entry)
    if floor is None or profit > floor:
        return None
    price = bar["close"] - d * g["slipPts"]
    return {"price": price, "points": d * (price - entry), "floor": floor}


def lock_summary(res: dict, date: str, g: dict) -> str:
    """The Profit Lock's daily line (static/rules.js lockSummary)."""
    fired = [t for t in res["trades"] if t.get("entry") is not None and not t.get("paper") and t.get("exit") is not None]
    pts = lambda lst, f: round2(sum(f(t) for t in lst))
    said = lambda t: bool(t.get("lock")) and t["lock"]["at"] is not None
    with_lock = lambda t: t["lock"]["points"] if said(t) else t["points"]
    give_up = pts([t for t in fired if t["points"] > 0], lambda t: max(0, t["points"] - with_lock(t)))
    gain_on = pts([t for t in fired if t["points"] <= 0], lambda t: max(0, with_lock(t) - t["points"]))
    also = []
    for n in g.get("compare") or []:
        hit = lambda t, n=n: (t.get("lockAlso") or {}).get(n)
        also.append(f"{n} {_signed1(pts(fired, lambda t: hit(t)['points'] if hit(t) else t['points']))} ({sum(1 for t in fired if hit(t))} exits)")
    exits = [f"{_ist_hm(t['signalTime'])} {t['side']} {_ist_hm(t['lock']['at'])} {_signed1(t['lock']['points'])} (best {_signed1(t['lock']['peak'])}, ended {_signed1(t['points'])})" for t in fired if said(t)]
    return (f"PROFIT LOCK DAY {date} · {g['name']} {g['mode']} · calls {len(fired)} · the lock said exit on {sum(1 for t in fired if said(t))} · points as the calls ended {_signed1(pts(fired, lambda t: t['points']))}"
            f" · with the lock {_signed1(pts(fired, with_lock))} · winners given up {_signed1(give_up)} · losers saved {_signed1(gain_on)}{(' · ' + ' · '.join(also)) if also else ''} · exits: {' · '.join(exits) or 'none'}")


TRAIL = {"lines": "all", "buffer": "none", "place": "at"}  # Rule 2 as the index page, the watcher and the replays run it: the owner's choices, 9 October; the stop on the line crossed itself since 21 October, Change 4 (see static/rules.js TRAIL)

# idea 13 (12 October, no call against a fresh run) was removed from the rule on 18 October (the owner: "all three remove")


def paper_trades(bars: list, levels_at, now: float, seconds: int, day_candles: bool, signal: str, ideas: dict | None = None, targets_at=None,
                 hold_breaks: bool = False, trail: dict | None = None, given: dict | None = None, new_high_low: bool = False, prev_close=None,
                 minutes: list | None = None, gate: dict | None = GATE, atr_seed=None, loss_cutter: dict | None = LC, profit_lock: dict | None = LOCK, trade_plan: dict | None = PLAN,
                 builder: dict | None = BUILDER) -> dict:
    """The paper calls (see static/rules.js paperTrades). Since 18 October a call fires when a later candle's price goes past the
    signal candle's high (CE) or low (PE) and enters there, or at the candle's open when it opened past it; any later candle may
    fire it, until a candle closes back across the signal's line; a second call the same way while another is held runs beside
    it, marked parallel; ideas 13, 8 and 5 are gone. prev_close: the close before the first candle, which is then judged too.
    hold_breaks: the owner's exit rule "Hold Through a Level Break" (8 October night): a crossed call is held through its target,
    sold on a close back across its line ("back"), on a return to the signal candle's open after a candle opened beyond the previous
    close ("retouch"), or at the day end.
    trail: with hold_breaks, Rule 2 of the owner's specification (9 October): once a candle closes beyond a further line, the stop
    moves to it, line by line, and a close back past the stop sells ("trail"); exits A and B end there. None: Rule 1 alone.
    given: the calls given live, {signal candle's time: "CE" or "PE"} (the records of their options): each stays, whatever the
    candle's final prices say (kept_at; 9 October).
    new_high_low: idea 24 (13 October): a close past the top or bottom line, when no line gives a signal, gives a Crossed call
    past it (edge), alongside the other calls; "Today so far" lines only.
    minutes: the session's one-minute candles, for the owner's early exit of a held break (19 October; static/rules.js paperTrades):
    inside a candle, at the close of the first minute by whose end the last three minutes all stayed on the exit side of the close
    before the candle and that minute closed across the first line beyond that close ("early", exitAt the minute's end).
    gate: the Call Gate (GATE, version 2), judged on every signal as it is born: SHADOW rides on the call (gate, gateWhy, gateCheck,
    gateHealth); LIVE follows a SKIP from a live check on paper (paper: True, no order). The signals cancelled before firing come back in
    "cancelled", the zones found in "zonesFound". atr_seed: the gate's ATR carried in from the previous day (atr_seed_of).
    loss_cutter: the Loss Cutter (LC, 24 October), judged beside the Call Gate on every signal (lc, lcWhy, lcCheck, lcAdvice, lcFailures; the
    stack cap and lcOpenSame when the call fires); its zones in "lcZonesFound" and "lcZonesEnded". None: no Loss Cutter.
    profit_lock: the Profit Lock (LOCK, 24 October), after every existing exit of a closed candle: SHADOW rides on the call (lock, lockAlso),
    LIVE ends the call there ("lock"). None: no lock."""
    lines_at = targets_at or levels_at  # the lines a call's target follows (the chart's); the levels a candle is judged against otherwise
    close_at = (ideas or {}).get("closeAt")
    no_new_after = (ideas or {}).get("noNewAfter")
    min_depth = (ideas or {}).get("minDepth")  # idea P3 (7 October): a crossed signal must close this share of the way to the next level
    exit_back = (ideas or {}).get("exitBack")  # idea P4 (7 October, the owner's rule): a candle closing back across the level by this share of the gap ends the call
    carry_on = (ideas or {}).get("carryOn")  # idea P5 (7 October evening): at the target, a close this share into the next gap carries the call on to the level beyond
    stop_share = (ideas or {}).get("stopShare")  # ideas P6, P7 (8 October evening): a stop fixed at the entry, this share of the target's distance away
    stop_minutes = (ideas or {}).get("minutes")  # the day's one-minute candles, to settle a candle that touched both the stop and the target

    def clock_end(b):
        return (b["time"] + IST_OFFSET) % 86400 + seconds

    closed = [b for b in bars if end_of(b, seconds) <= now]
    forming = bars[len(closed)] if len(bars) > len(closed) else None
    atr = atr_before(closed, trail.get("period") or 14) if trail and trail.get("buffer") == "atr" else None
    g = gate or None
    lc = loss_cutter or None
    gate_atrs = gate_atr(closed, (g or lc)["atrPeriod"], atr_seed, prev_close) if (g or lc) else None  # the Call Gate's ATR, its sideways zone, the signals held back (LIVE)
    zone, cancelled = {"box": None, "broke": None, "found": []}, []
    lc_zone = {"box": None, "broke": None, "found": [], "ended": []}  # the Loss Cutter's own sideways zone (version 3: the taller box)
    pl = profit_lock or None
    locks = {}  # the Profit Lock: id of an open call -> its lock's state (the main setting's and the compared settings')
    day_first = 0  # the index of the day's first closed candle

    def trail_lines(levels):
        """The lines that move Rule 2's stop: the specification's, 23.6% to 78.6%, or all seven."""
        return levels if trail.get("lines") == "all" else [l for l in levels if l["ratio"] != 0 and abs(l["ratio"]) != 1]

    def buffer_at(i):
        """Rule 2's buffer for closed candle i."""
        if not trail:
            return 0
        if trail.get("buffer") == "fixed":
            return trail["points"]
        if trail.get("buffer") == "atr":
            return trail["mult"] * atr[i] if atr[i] is not None else (trail.get("points") or 0)
        return 0

    def gain(t, price):
        return round2(price - t["entry"] if t["side"] == "CE" else t["entry"] - price)

    def end(t, price, bar, how):
        t["exit"], t["exitTime"], t["how"], t["points"] = price, bar["time"], how, gain(t, price)

    def reaches(t, bar):
        return bar["high"] >= t["target"] if t["side"] == "CE" else bar["low"] <= t["target"]

    def touches_stop(t, bar):
        return t.get("stop") is not None and (bar["low"] <= t["stop"] if t["side"] == "CE" else bar["high"] >= t["stop"])

    def stop_first(t, bar):
        """The candle touched the stop: did the stop come before the target? The first minute to touch either; the stop when unsure."""
        if not reaches(t, bar) or not stop_minutes:
            return True
        for m in stop_minutes:
            if m["time"] < bar["time"] or m["time"] >= bar["time"] + seconds:
                continue
            if touches_stop(t, m):
                return True
            if reaches(t, m):
                return False
        return True

    def set_stop(t):
        if stop_share and t.get("stop") is None and not t.get("hold"):
            t["stop"] = round2(t["entry"] - stop_share * (t["target"] - t["entry"]) if t["side"] == "CE" else t["entry"] + stop_share * (t["entry"] - t["target"]))

    def beyond_of(t, levels):
        """The lines past the call's entry and level, in its direction, nearest first."""
        past = max(t["entry"], t["level"]) if t["side"] == "CE" else min(t["entry"], t["level"])
        prices = [l["price"] for l in levels]
        return [p for p in prices if p > past] if t["side"] == "CE" else [p for p in reversed(prices) if p < past]

    def follow(t, levels):
        """The target on the lines as they stand (owner's decision, 8 October; see static/rules.js), the ladder beyond it for idea P5."""
        beyond, k = beyond_of(t, levels), t.get("carried", 0)
        if len(beyond) > k:  # no line that far out (the entry at the day's high): it stays
            t["target"], t["ladder"] = beyond[k], beyond[k + 1:]

    came = {}  # id of an open call -> its target on the lines as they stood before this candle (12 October; see static/rules.js)

    def target_on(t, levels):
        beyond, k = beyond_of(t, levels), t.get("carried", 0)
        return beyond[k] if len(beyond) > k else t["target"]

    def hits(t, bar):
        """The target reached. A candle that brought the target closer (its own new low for a CE, high for a PE, moved the lines) may
        have made its high or low before the move: that counts only against the target as it stood before; the moved one on the close."""
        was = came.get(id(t))
        nearer = was is not None and (t["target"] < was if t["side"] == "CE" else t["target"] > was)
        if not nearer:
            return reaches(t, bar)
        return bar["high"] >= was or bar["close"] >= t["target"] if t["side"] == "CE" else bar["low"] <= was or bar["close"] <= t["target"]

    def retouch(t, bar, prev_close):
        """Exit B: the candle opened beyond the previous close and came back to the signal candle's open (C1 began on the far side)."""
        if t["side"] == "PE":
            return t["c1Open"] >= t["level"] and bar["open"] < prev_close and bar["high"] >= t["c1Open"]
        return t["c1Open"] <= t["level"] and bar["open"] > prev_close and bar["low"] <= t["c1Open"]

    mins = minutes if minutes else None  # the owner's early exit (19 October) runs on the session's one-minute candles

    def line_back(t, levels, P):
        """One level back from the close before the candle, on the exit side."""
        prices = [l["price"] for l in levels]
        return next((p for p in prices if p > P), None) if t["side"] == "PE" else next((p for p in reversed(prices) if p < P), None)

    def fire_minute(t, bar):
        """The minute the call fired in, when it fired in this candle and the minutes are known; else None (static/rules.js fireMinute:
        a call fired inside a candle is judged on the part of the candle after it fired; the owner, 19 October)."""
        if not mins or t.get("entryTime") != bar["time"]:
            return None
        for m in mins:
            if bar["time"] <= m["time"] < bar["time"] + seconds and m["time"] + 60 <= now and (m["low"] <= t["entry"] if t["side"] == "PE" else m["high"] >= t["entry"]):
                return m["time"]
        return None

    def since_fire(t, bar, price_now=None):
        """The candle from the fire on: its high and low over the closed minutes from the fire minute, and the price now."""
        if not mins or t.get("entryTime") != bar["time"]:
            return bar
        frm = fire_minute(t, bar)
        if frm is None:
            return {**bar, "high": price_now, "low": price_now} if price_now is not None else bar
        high, low = -INF, INF
        for m in mins:
            if frm <= m["time"] < bar["time"] + seconds and m["time"] + 60 <= now:
                high, low = max(high, m["high"]), min(low, m["low"])
        if price_now is not None:
            high, low = max(high, price_now), min(low, price_now)
        return {**bar, "high": high, "low": low}

    def early(t, bar, P, levels):
        """The minute the double confirmation came in this candle: (minute, high, low) of the candle up to it, or None."""
        if not mins or not t.get("hold") or P is None:
            return None
        L = line_back(t, levels, P)
        if L is None:
            return None
        frm = fire_minute(t, bar)  # a call fired in this candle: its minutes from the fire on
        if t.get("entryTime") == bar["time"] and frm is None:
            return None  # fired in the minute forming now: nothing closed after it yet
        run, prev, high, low = 0, None, -INF, INF
        for m in mins:
            if m["time"] < bar["time"] or m["time"] + 60 > bar["time"] + seconds or m["time"] + 60 > now or (frm is not None and m["time"] < frm):
                continue  # this candle's closed minutes only, from the fire on
            high, low = max(high, m["high"]), min(low, m["low"])
            ok = m["low"] > P if t["side"] == "PE" else m["high"] < P  # every tick of the minute on the exit side
            run = run + 1 if ok and (prev is None or m["time"] == prev + 60) else 1 if ok else 0  # a missing minute breaks the run
            prev = m["time"]
            if run >= 3 and (m["close"] > L if t["side"] == "PE" else m["close"] < L):
                return m, high, low
        return None

    def early_exit(t, bar, P, levels):
        """True when the call ended inside this candle: at the double confirmation, or at a retouch before it."""
        e = early(t, bar, P, levels)
        if not e:
            return False
        m, high, low = e
        if not t.get("trail") and retouch(t, {**bar, "high": high, "low": low}, P):
            end(t, t["c1Open"], bar, "retouch")
            return True
        end(t, m["close"], bar, "early")
        t["exitAt"], t["earlyFrom"], t["earlyLine"] = m["time"] + 60, P, line_back(t, levels, P)  # the minute's end, the close it stayed beyond, the line it crossed back
        return True

    def settle(t, bar, prev_close, levels, buf):
        """The target reached within this closed candle: idea P5 may carry the call on to the level beyond, else it ends at the target."""
        if t.get("hold"):  # a held break: exit B, then exit A at the close (Rule 1); the target does not end it
            if not t.get("trail"):
                if retouch(t, since_fire(t, bar), prev_close):  # on the part of the candle after the call fired
                    end(t, t["c1Open"], bar, "retouch")
                    return False
                if bar["close"] > t["level"] if t["side"] == "PE" else bar["close"] < t["level"]:
                    end(t, bar["close"], bar, "back")
                    return False
            if trail:  # Rule 2: the stop on the lines crossed since, from the line the call broke
                st = t.get("trail") or {"stop": t["level"], "stopRatio": t["ratio"], "line": None, "ratio": None}
                if trail_step(st, bar["close"], trail_lines(levels), t["side"], trail["place"], buf) == "sell":
                    end(t, bar["close"], bar, "trail")
                    return False
                if st["line"] is not None:
                    t["trail"] = st  # the first further line crossed: Rule 2 from now on
            return True
        while hits(t, bar):
            beyond = t["ladder"][0] if carry_on is not None and t["ladder"] else None
            if beyond is not None and (bar["close"] - t["target"] if t["side"] == "CE" else t["target"] - bar["close"]) >= carry_on * abs(beyond - t["target"]):
                t["carried"] = t.get("carried", 0) + 1
                t["target"], t["ladder"] = beyond, t["ladder"][1:]
                continue
            end(t, t["target"], bar, "target")
            return False
        return True

    def new_day(a, b):
        return not day_candles and day_of(a["time"]) != day_of(b["time"])

    last = closed[-1] if closed else None
    over = False if day_candles else (day_over(day_of(last["time"]), now) if last else True)

    def day_last(i):
        """The day's last candle: its close is the day end."""
        return new_day(closed[i + 1], closed[i]) if i + 1 < len(closed) else over

    def lock_ask(t, bar):
        """The Profit Lock on one closed candle, the call still open after its existing exits; False: the lock closed it (LIVE)."""
        if t.get("entry") is None:
            return True
        s_ = locks.get(id(t))
        if s_ is None:  # asked for the first time: the candle the call fired on, or the first one after it that did not end it
            s_ = {"main": {"peak": 0, "peakTime": None}, "also": {}}
            t["lock"] = {"peak": 0, "peakTime": None, "floor": None, "at": None, "price": None, "points": None}
            if pl.get("compare"):
                t["lockAlso"] = {}
                for n in pl["compare"]:
                    s_["also"][n] = {"peak": 0, "peakTime": None}
                    t["lockAlso"][n] = None
            locks[id(t)] = s_
        for n in pl.get("compare") or []:  # the other settings, in shadow
            if t["lockAlso"][n]:
                continue
            hit = lock_step(s_["also"][n], t["side"], t["entry"], bar, LOCK_PRESETS[n])
            if hit:
                t["lockAlso"][n] = {"at": bar["time"], "points": round2(hit["points"]), "peak": round2(s_["also"][n]["peak"])}
        if t["lock"]["at"] is not None:  # shadow: the lock said exit on an earlier candle; the call goes on to its own exit
            return True
        hit = lock_step(s_["main"], t["side"], t["entry"], bar, pl)
        floor = lock_floor(s_["main"]["peak"], pl)
        t["lock"]["peak"], t["lock"]["peakTime"], t["lock"]["floor"] = round2(s_["main"]["peak"]), s_["main"]["peakTime"], None if floor is None else round2(floor)
        if not hit:
            return True
        t["lock"]["at"], t["lock"]["price"], t["lock"]["points"] = bar["time"], round2(hit["price"]), round2(hit["points"])
        if pl["mode"] == "LIVE":
            end(t, round2(hit["price"]), bar, "lock")
            return False
        return True

    trades, used, open_ = [], {}, []
    armed = []  # the signals waiting to fire (18 October), each with fireAt, its candle's high (CE) or low (PE)

    def fire_price(sg, bar):
        if bar["high"] > sg["fireAt"] if sg["side"] == "CE" else bar["low"] < sg["fireAt"]:
            return max(sg["fireAt"], bar["open"]) if sg["side"] == "CE" else min(sg["fireAt"], bar["open"])
        return None

    def fire(bar):
        """The price went past a waiting signal's high or low: the call enters there; parallel when another the same way is held."""
        nonlocal armed
        still = []
        for sg in armed:
            price = fire_price(sg, bar)
            if price is None:
                still.append(sg)
                continue
            t = enter_at(sg, bar, price)
            if t:
                if any(o["side"] == t["side"] for o in open_):
                    t["parallel"] = True
                if lc and t.get("lc") == "TAKE":
                    stack_step(t, open_, lc)  # the Loss Cutter's stack cap, as the order is placed
                trades.append(t)
                open_.append(t)
        armed = still

    first = 0 if prev_close is not None else 1  # the first candle is judged from the previous day's close when it is known (18 October)
    for i in range(first, len(closed)):
        bar, prev_bar = closed[i], closed[i - 1] if i > 0 else None
        before = prev_bar["close"] if prev_bar else prev_close  # the close before this candle
        if prev_bar and new_day(bar, prev_bar):  # a new day: yesterday's calls ended with yesterday, and its waiting signals are gone
            for t in open_:
                end(t, prev_bar["close"], prev_bar, "day end")
            open_, armed = [], []
            day_first, zone["box"], zone["broke"] = i, None, None
            lc_zone["box"], lc_zone["broke"] = None, None
        fire(bar)  # the signals of earlier candles, fired by this candle's prices before its close is judged
        levels, lines, lines_before = levels_at(i), lines_at(i), lines_at(max(0, i - 1))
        for t in open_:
            came[id(t)] = target_on(t, lines_before)
            follow(t, lines)
            set_stop(t)
        if stop_share:  # ideas P6, P7
            still = []
            for t in open_:
                if not t.get("hold") and touches_stop(t, bar) and stop_first(t, bar):
                    end(t, t["stop"], bar, "stop")
                else:
                    still.append(t)
            open_ = still
        open_ = [t for t in open_ if not early_exit(t, bar, before, levels)]  # the owner's early exit, inside the candle (19 October), before the candle's close is judged
        open_ = [t for t in open_ if settle(t, bar, before, levels, buffer_at(i))]
        if exit_back:  # idea P4: the candle says exit, at its close
            still = []
            for t in open_:
                back = t["level"] - bar["close"] if t["side"] == "CE" else bar["close"] - t["level"]
                if not t.get("hold") and back >= exit_back * abs(t["target"] - t["level"]):
                    end(t, bar["close"], bar, "candle")
                else:
                    still.append(t)
            open_ = still
        if close_at and not day_candles and clock_end(bar) >= close_at:  # idea P1
            for t in open_:
                end(t, bar["close"], bar, "time")
            open_ = []
        if pl and not day_last(i):  # the Profit Lock, after every existing exit of this candle (never on the day's last one: its close is the day end)
            open_ = [t for t in open_ if lock_ask(t, bar)]
        for price, side in list(used):  # closed back across: the line may call again (kept by its price, 8 October)
            if (bar["close"] < price) if side == "CE" else (bar["close"] > price):
                del used[(price, side)]
        still = []
        for sg in armed:  # a close back across its line cancels a waiting signal (the owner's B)
            if (bar["close"] < sg["level"]) if sg["side"] == "CE" else (bar["close"] > sg["level"]):
                if g or lc:
                    cancelled.append({**{k: v for k, v in sg.items() if k not in ("prices", "fireAt")}, "how": "cancelled", "cancelTime": bar["time"]})
            else:
                still.append(sg)
        armed = still
        def frm(L, i=i, before=before):  # the last close off line L
            for j in range(i - 1, -1, -1):
                if closed[j]["close"] != L:
                    return closed[j]["close"]
            return before
        if g:
            zone_step(zone, closed, i, gate_atrs[i], day_first, g)  # the Call Gate's zone, brought up to this candle before any signal on it is judged
        if lc:
            zone_step(lc_zone, closed, i, gate_atrs[i], day_first, lc)  # and the Loss Cutter's
        sig = signal_at(bar, before, levels, used, signal, frm)
        if not sig and new_high_low and signal != "held":
            sig = past_edge_at(bar, levels, used)  # idea 24: a close past the day's high or low
        was = given.get(bar["time"]) if given else None  # a call given live at this candle (its option recorded): it stays
        if was and not (sig and sig["side"] == was):
            sig = kept_at(bar, levels, frm, was) or sig
        if sig and hold_breaks and sig["kind"] == "crossed":
            sig["hold"], sig["c1Open"] = True, bar["open"]  # C1, the signal candle: its open is where the break began
        late = not day_candles and ((no_new_after and clock_end(bar) > no_new_after) or (close_at and clock_end(bar) >= close_at))
        depth = abs(sig["close"] - sig["level"]) / abs(sig["target"] - sig["level"]) if sig and sig["kind"] == "crossed" and sig["target"] is not None and sig["target"] != sig["level"] else None
        shallow = depth is not None and not sig.get("hold") and bool(min_depth) and depth < min_depth  # idea P3
        if sig and (was or (not late and not shallow)):
            if g:  # the Call Gate, the moment the signal is born: day health = this day's signals that have fired and exited by now, taken or on paper
                health = round2(sum(t["points"] for t in trades if t.get("exit") is not None and t["signalTime"] >= closed[day_first]["time"]))
                parallel = any(o["side"] == sig["side"] for o in open_)
                v = gate_verdict(closed, i, sig["side"], gate_atrs[i], zone, parallel, health, day_first, g)
                sig["gate"], sig["gateWhy"], sig["gateCheck"], sig["gateHealth"] = v["gate"], v["why"], v["check"], health
                sig["gateAdvice"] = parallel_advice(parallel, health, gate_atrs[i], g) if g["parallel"] in ("log", "health") else ""  # the note on a parallel call
                if v["gate"] == "SKIP" and g["mode"] == "LIVE" and v["check"] in g["liveChecks"] and not was:
                    sig["paper"] = True  # a live check held the order: followed on paper, no order
            if lc:  # the Loss Cutter, beside it: checks 1 to 4 now, the stack cap when the call fires
                fails = worn_failures(trades + cancelled, {"level": sig["level"], "signalTime": bar["time"]}, lc) if lc["wornMode"] != "off" else 0
                v = lc_verdict(closed, i, sig["side"], gate_atrs[i], lc_zone, fails, day_first, lc, level_name(sig["ratio"], sig.get("signed", False)))
                sig["lc"], sig["lcWhy"], sig["lcCheck"], sig["lcAdvice"], sig["lcFailures"] = v["lc"], v["why"], v["check"], v["advice"], fails
                if was:
                    sig["liveGiven"] = True  # given live (its option recorded): the stack cap never turns it into a paper call
                if v["lc"] == "SKIP" and lc["mode"] == "LIVE" and v["check"] in lc["liveChecks"] and not was:
                    sig["paper"] = True
            used[(sig["level"], sig["side"])] = True  # the no-repeat lock, taken or skipped
            sig["fireAt"] = bar["high"] if sig["side"] == "CE" else bar["low"]
            armed.append(sig)
    if forming and last and not over and not new_day(forming, last):  # the candle forming now: a waiting signal fires on its price so far, open calls run on its live price
        fire(forming)
        lines, lines_before = lines_at(len(closed)), lines_at(len(closed) - 1)  # the lines as the chart draws them now, with the forming candle in the day's range
        for t in open_:
            came[id(t)] = target_on(t, lines_before)
            follow(t, lines)
            set_stop(t)
        if stop_share:  # ideas P6, P7, tick by tick
            still = []
            for t in open_:
                if not t.get("hold") and touches_stop(t, forming):
                    end(t, t["stop"], forming, "stop")
                else:
                    still.append(t)
            open_ = still
        open_ = [t for t in open_ if not early_exit(t, forming, last["close"], levels_at(len(closed)))]  # the early exit on the minutes closed so far of the candle forming now
        still = []
        for t in open_:
            if t.get("hold"):  # exit B tick by tick; exit A and Rule 2 wait for the close
                if not t.get("trail") and retouch(t, since_fire(t, forming, forming["close"]), last["close"]):  # on the part after the call fired
                    end(t, t["c1Open"], forming, "retouch")
                else:
                    still.append(t)
            elif hits(t, forming) and not (carry_on is not None and t["ladder"]):  # idea P5: the decision waits for the close
                end(t, t["target"], forming, "target")
            else:
                still.append(t)
        open_ = still
        for t in open_:
            t["points"], t["last"] = gain(t, forming["close"]), forming["close"]
    else:
        for t in open_:
            if over:
                end(t, last["close"], last, "day end")
            else:
                t["points"], t["last"] = gain(t, last["close"]), last["close"]
    if trade_plan:
        plan_step(trades, trade_plan)  # the Trade Plan's mark on every call that fired (29 October)
    if builder:
        builder_step(trades, bars, prev_close, atr_seed, builder)  # the rule builder's mark on every call that fired (30 October)
    return {"trades": trades, "closed": len(closed), "cancelled": cancelled, "zonesFound": zone["found"], "lcZonesFound": lc_zone["found"], "lcZonesEnded": lc_zone["ended"]}



def replay_day(bars: list, move: str, previous, seconds: int, signal: str, ideas: dict | None = None, trail: dict | None = TRAIL,
               new_high_low: bool = False, minutes: list | None = None, gate: dict | None = GATE, atr_seed=None, loss_cutter: dict | None = LC,
               profit_lock: dict | None = LOCK, trade_plan: dict | None = PLAN, builder: dict | None = BUILDER) -> dict:
    """A finished day replayed, as the Study page and the research engine do it; Rule 2 as the index page runs it unless another
    setting is given (None: Rule 1 alone); idea 24 when asked for, on "today so far" lines only. The first candle is judged from
    the previous day's close (18 October)."""
    own = move in ("prev", "close")  # the previous day's lines, or the previous close's (15 October): not today's range so far
    fixed = (levels_of(move_of_day(previous)) if previous else None) if move == "prev" else None
    from_close = close_levels_at(bars, previous.get("close")) if move == "close" and previous else None
    if (move == "prev" and not fixed) or (move == "close" and not from_close):
        return {"trades": [], "closed": 0}
    levels_at = (lambda i: fixed) if move == "prev" else from_close if move == "close" else today_levels_at(bars)
    return paper_trades(bars, levels_at, INF, seconds, False, signal, ideas, None if own else today_lines_at(bars), True, trail, None,
                        not own and bool(new_high_low), previous.get("close") if own and previous else None, minutes or None, gate, atr_seed, loss_cutter, profit_lock, trade_plan, builder)


IDEAS = {"P1": {"closeAt": 15 * 3600}, "P2": {"noNewAfter": 14 * 3600}, "P3": {"minDepth": 0.25}, "P4": {"exitBack": 0.25}, "P5": {"carryOn": 0.25},
         "P6": {"stopShare": 1}, "P7": {"stopShare": 0.5}}
EXIT_BACK = IDEAS["P4"]["exitBack"]
CARRY_ON = IDEAS["P5"]["carryOn"]


def carry_of(t: dict, bars: list, seconds: int, now: float) -> dict | None:
    """The carry read, as static/rules.js carryOf gives it: at the candle that reached the target, did the close go a quarter
    of the next gap past it, and was the level beyond reached by a later closed candle. None before the target, or with no
    level beyond."""
    if t.get("how") != "target" or not t.get("ladder"):
        return None
    hit = next((b for b in bars if b["time"] == t["exitTime"]), None)
    if hit is None:
        return None
    beyond, d = t["ladder"][0], (1 if t["side"] == "CE" else -1)
    deep = d * (hit["close"] - t["target"]) >= CARRY_ON * abs(beyond - t["target"])
    reached_at = None
    for b in bars:
        if b["time"] < t["exitTime"] or end_of(b, seconds) > now:
            continue
        if (b["high"] >= beyond) if d > 0 else (b["low"] <= beyond):
            reached_at = b["time"]
            break
    return {"deep": deep, "beyond": beyond, "reached": reached_at is not None, "reachedAt": reached_at}


def read_of(t: dict, bars: list, seconds: int, now: float) -> dict | None:
    """The candle verdict, as static/rules.js readOf gives it (the words there): carry or exit with the reason, from the
    closed candles around the call's level, measured against the gap to the target. Same code twice so the watcher's
    rows carry what the page would say; check_rule.py keeps the two the same."""
    if t.get("entry") is None and t.get("how") != "pending":
        return None
    if t.get("hold"):  # a held break: the verdict is the owner's exit rule itself, worded for the line its stop is on (Rule 2: the line it moved to)
        ratio = t["trail"]["stopRatio"] if t.get("trail") else t.get("ratio")
        name = "the level" if ratio is None else f"the {level_name(ratio, t.get('signed'))} level"
        pe, how = t["side"] == "PE", t.get("how")
        word = "exit" if how in ("back", "retouch", "trail", "early") else "carry"
        why = (f"price closed back {'above' if pe else 'below'} {name}" if how in ("back", "trail") else f"price came back to where the {'fall' if pe else 'rise'} started" if how == "retouch"
               else f"price stayed {'above' if pe else 'below'} the previous close for 3 minutes and crossed one level back" if how == "early"
               else f"price stays {'below' if pe else 'above'} {name}")
        return {"depth": None, "body": None, "back": None, "retest": False, "strength": None, "word": word, "why": why,
                "exitAt": t.get("exitTime") if word == "exit" else None, "exitPrice": t.get("exit") if word == "exit" else None}
    gap = abs(t["target"] - t["level"])
    sig = next((b for b in bars if b["time"] == t["signalTime"]), None)
    if not gap or sig is None:
        return None

    def toward(p):
        return (p - t["level"] if t["side"] == "CE" else t["level"] - p) / gap

    depth, body = round2(toward(sig["close"])), round2(abs(sig["close"] - sig["open"]) / gap)
    back, retest, exit_at, exit_price = 0, False, None, None
    for b in bars:
        if b["time"] <= t["signalTime"] or end_of(b, seconds) > now:
            continue
        if t.get("exitTime") is not None and b["time"] > t["exitTime"]:
            break
        went = t["level"] - b["close"] if t["side"] == "CE" else b["close"] - t["level"]
        back = max(back, went / gap)
        if exit_at is None and went >= EXIT_BACK * gap:
            exit_at, exit_price = b["time"], b["close"]
        touched = (b["low"] <= t["level"] + 0.2 * gap and b["close"] > t["level"]) if t["side"] == "CE" else (b["high"] >= t["level"] - 0.2 * gap and b["close"] < t["level"])
        if touched:
            retest = True
    back = round2(back)
    strength = "strong" if depth >= 0.5 or body >= 1 else "fair" if depth >= 0.25 or body >= 0.5 else "weak"
    word = "exit" if exit_at is not None else "carry"
    level = "the level" if t.get("ratio") is None else f"the {level_name(t['ratio'], t.get('signed'))} level"
    good, bad = ("above", "below") if t["side"] == "CE" else ("below", "above")
    held = t.get("kind") == "held"
    size = ({"strong": "strong bounce", "fair": "bounce", "weak": "small bounce"} if held else {"strong": "big candle", "fair": "candle", "weak": "small candle"})[strength]
    why = (f"price closed {bad} {level}" if word == "exit" else f"price came back to {level} and held" if retest
           else f"{size} {'off' if held else 'through'} {level}, holding {good} it")
    return {"depth": depth, "body": body, "back": back, "retest": retest, "strength": strength, "word": word, "why": why, "exitAt": exit_at, "exitPrice": exit_price}


def ideas_of(keys) -> dict:
    out = {}
    for k in keys:
        out.update(IDEAS[k])
    return out


def call_key(index: str, interval: str, t: dict, levels: str) -> str:
    """The name of a call, as the index page names it: the index, the time frame, the signal candle, the side and the levels mode."""
    return f"{index}|{interval}|{t['signalTime']}|{t['side']}|{levels}"
