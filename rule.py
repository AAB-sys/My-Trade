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
    """When a candle closes: its size on, but never past 3:30 pm of its day."""
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


def move_of_day(d):
    """"Previous day": only the day's four figures are known, so it is an up move when it closed above its open."""
    return {"high": d["high"], "low": d["low"], "up": d["close"] >= d["open"]} if d else None


# ---- Layer 2 inside layer 3's signal: held or crossed, one candle one call, no repeat until closed back across

def signal_at(bar: dict, prev: float, levels: list, used: dict, signal: str):
    def crossed(L):
        return (prev < L < bar["close"]) or (prev > L > bar["close"])

    def held(L):
        return not crossed(L) and ((prev > L and bar["low"] <= L and bar["close"] > L) or (prev < L and bar["high"] >= L and bar["close"] < L))

    hits = []
    for l in levels:
        kind = "crossed" if crossed(l["price"]) else "held" if held(l["price"]) else None
        if kind and (signal == "both" or signal == kind) and not used.get((l["price"], "CE" if bar["close"] > l["price"] else "PE")):  # the line at its price (8 October)
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
    return {"signalTime": bar["time"], "level": at["price"], "ratio": at["ratio"], "kind": kind, "side": side, "target": nxt["price"],
            "close": bar["close"], "range": round2(bar["high"] - bar["low"]), "entry": None, "exit": None, "points": None, "how": "pending",
            "prices": [l["price"] for l in levels]}


def enter_at(sig: dict, bar: dict):
    """The entry (owner, 7 October): already at or past the target, the call aims at the first level beyond the entry
    price; with no level left beyond it, there is no call."""
    target, aimed = sig["target"], None
    if bar["open"] >= target if sig["side"] == "CE" else bar["open"] <= target:
        prices = sig["prices"]
        beyond = next((p for p in prices if p > bar["open"]), None) if sig["side"] == "CE" else next((p for p in reversed(prices) if p < bar["open"]), None)
        if beyond is None:
            return None
        target, aimed = beyond, "beyond"
    t = {k: v for k, v in sig.items() if k != "prices"}
    prices = sig["prices"]  # the levels beyond the target, nearest first: idea P5 carries the call up them, and the carry read asks about the first
    ladder = [p for p in prices if p > target] if sig["side"] == "CE" else [p for p in reversed(prices) if p < target]
    t.update(target=target, aimed=aimed, ladder=ladder, entry=bar["open"], entryTime=bar["time"], how="open")
    return t


# ---- Layer 3: the paper calls the rule gives on a list of candles (see static/rules.js for the words)

def paper_trades(bars: list, levels_at, now: float, seconds: int, day_candles: bool, signal: str, ideas: dict | None = None) -> dict:
    close_at = (ideas or {}).get("closeAt")
    no_new_after = (ideas or {}).get("noNewAfter")
    min_depth = (ideas or {}).get("minDepth")  # idea P3 (7 October): a crossed signal must close this share of the way to the next level
    exit_back = (ideas or {}).get("exitBack")  # idea P4 (7 October, the owner's rule): a candle closing back across the level by this share of the gap ends the call
    carry_on = (ideas or {}).get("carryOn")  # idea P5 (7 October evening): at the target, a close this share into the next gap carries the call on to the level beyond

    def clock_end(b):
        return (b["time"] + IST_OFFSET) % 86400 + seconds

    closed = [b for b in bars if end_of(b, seconds) <= now]
    forming = bars[len(closed)] if len(bars) > len(closed) else None

    def gain(t, price):
        return round2(price - t["entry"] if t["side"] == "CE" else t["entry"] - price)

    def end(t, price, bar, how):
        t["exit"], t["exitTime"], t["how"], t["points"] = price, bar["time"], how, gain(t, price)

    def reaches(t, bar):
        return bar["high"] >= t["target"] if t["side"] == "CE" else bar["low"] <= t["target"]

    def settle(t, bar):
        """The target reached within this closed candle: idea P5 may carry the call on to the level beyond, else it ends at the target."""
        while reaches(t, bar):
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

    trades, used, ready, open_ = [], {}, None, []
    for i in range(1, len(closed)):
        bar, prev_bar = closed[i], closed[i - 1]
        if new_day(bar, prev_bar):  # a new day: yesterday's calls ended with yesterday
            for t in open_:
                end(t, prev_bar["close"], prev_bar, "day end")
            open_, ready = [], None
        if ready:
            t = enter_at(ready, bar)
            if t:
                trades.append(t)
                open_.append(t)
            ready = None
        open_ = [t for t in open_ if settle(t, bar)]
        if exit_back:  # idea P4: the candle says exit, at its close
            still = []
            for t in open_:
                back = t["level"] - bar["close"] if t["side"] == "CE" else bar["close"] - t["level"]
                if back >= exit_back * abs(t["target"] - t["level"]):
                    end(t, bar["close"], bar, "candle")
                else:
                    still.append(t)
            open_ = still
        if close_at and not day_candles and clock_end(bar) >= close_at:  # idea P1
            for t in open_:
                end(t, bar["close"], bar, "time")
            open_ = []
        levels = levels_at(i)
        for price, side in list(used):  # closed back across: the line may call again (kept by its price, 8 October)
            if (bar["close"] < price) if side == "CE" else (bar["close"] > price):
                del used[(price, side)]
        sig = signal_at(bar, prev_bar["close"], levels, used, signal)
        late = not day_candles and ((no_new_after and clock_end(bar) > no_new_after) or (close_at and clock_end(bar) >= close_at))
        shallow = bool(sig) and bool(min_depth) and sig["kind"] == "crossed" and abs(sig["close"] - sig["level"]) < min_depth * abs(sig["target"] - sig["level"])  # idea P3
        if sig and not late and not shallow:
            ready = sig
            used[(sig["level"], sig["side"])] = True
    last = closed[-1] if closed else None
    over = False if day_candles else (day_over(day_of(last["time"]), now) if last else True)
    if forming and last and not over and not new_day(forming, last):
        if ready:
            t = enter_at(ready, forming)
            if t:
                trades.append(t)
                open_.append(t)
            ready = None
        still = []
        for t in open_:
            if reaches(t, forming) and not (carry_on is not None and t["ladder"]):  # idea P5: the decision waits for the close
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
    if ready and not over:
        trades.append({k: v for k, v in ready.items() if k != "prices"})
    return {"trades": trades, "closed": len(closed)}


def replay_day(bars: list, move: str, previous, seconds: int, signal: str, ideas: dict | None = None) -> dict:
    """A finished day replayed, as the Study page and the research engine do it."""
    fixed = (levels_of(move_of_day(previous)) if previous else None) if move == "prev" else None
    if move == "prev" and not fixed:
        return {"trades": [], "closed": 0}
    levels_at = (lambda i: fixed) if move == "prev" else (lambda i: levels_of(move_of(bars[:i + 1])))
    return paper_trades(bars, levels_at, INF, seconds, False, signal, ideas)


IDEAS = {"P1": {"closeAt": 15 * 3600}, "P2": {"noNewAfter": 14 * 3600}, "P3": {"minDepth": 0.25}, "P4": {"exitBack": 0.25}, "P5": {"carryOn": 0.25}}
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
    level = "the level" if t.get("ratio") is None else f"the {t['ratio'] * 100:.1f}% level"
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
