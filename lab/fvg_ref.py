"""
panel_fvg.py - fair value gaps (FVG) on the live feed: find, follow and retire them.

Standalone: it needs only today's finished candles (oldest first), each {"hm": start time "HH:MM", "o", "h", "l", "c"}.
It uses no volume, so it works on the index itself (Nifty 50, Bank Nifty, Sensex) as well as on futures.

The rule (the standard three-candle rule, wicks compared, not bodies):
  Bullish FVG: candle 3's low is above candle 1's high.   Zone: candle 1's high (bottom) to candle 3's low (top).
  Bearish FVG: candle 3's high is below candle 1's low.   Zone: candle 3's high (bottom) to candle 1's low (top).
  Candle 2 is the fast candle that jumped across the zone. The middle of the zone is the "50% line".

Live rules:
  - A gap exists only when candle 3 has CLOSED. While candle 3 is forming a possible gap can only shrink or vanish,
    so nothing is drawn or alerted before the close (no repainting).
  - All three candles must be from today's session (the 09:15 jump from yesterday's close is not an FVG).
  - Size filter: the zone must be at least max(fvg_min_points, fvg_min_pct % of price, fvg_min_atr x ATR), with the
    ATR taken at candle 3's close (an ATR that moves during the candle would be a second source of repainting).
  - After it forms, each gap moves through: active -> touched (a wick reached the near edge) -> half (reached the
    50% line) -> filled (reached the far edge). A candle CLOSING beyond the far edge marks it "inverted" (a failed
    gap; a broken bullish gap is then watched as resistance). Touch, half and fill are wick events and could be
    flagged mid-candle; inversion needs the close. This module works on finished candles, so all are flagged at close.
  - Retire: on fill (default) or on inversion only ("fvg_retire_on": "fill" or "close"), after fvg_max_age_bars
    (0 = until the end of the day), and keep at most fvg_max_per_side open gaps on each side (oldest dropped).
    Everything resets at the start of each day.

This file is the owner's panel_fvg.py (the document "AAA_V1 FVG Live chart logic", 20 November 2026) with four faults
put right (the owner: "go through the logic carefully and build it in proper way"); each is marked "fault N" below, and
static/fvg.js carries the same four. lab/check_fvg.py proves this file and static/fvg.js give the same answers.
  1. resample(): a bigger candle was returned although small candles inside it were missing (only the last minute of the
     last one was checked), so a hole in the feed could still make a gap. Now only a whole bigger candle is returned.
  2. A finished candle that the feed revises after it was read (Dhan does this now and then) was never read again: the
     gaps stayed as first counted. Now the day is read again from its first candle when a candle already fed has changed.
  3. The printed points and prices were rounded half to even ("%.0f", "{:,.2f}": a 12.5-point gap read "12 pts", a 50%
     line at x.125 read x.12), and another language rounds them the other way. Now half up, one rule.
  4. fvg_max_per_side 0 meant "no limit" only by an accident of slicing. It is now said plainly: 0 = no limit.
"""
import math

FVG_DEFAULTS = {
    "fvg_min_points": 0.0,       # smallest zone in index points
    "fvg_min_pct": 0.0,          # smallest zone as % of price
    "fvg_min_atr": 0.5,          # smallest zone as a multiple of ATR (at candle 3's close)
    "fvg_atr_len": 14,           # ATR length in candles (today's candles only)
    "fvg_from": "09:15",         # candle 1 must start at or after this time
    "fvg_until": "15:15",        # candle 3 must end at or before this time for a new gap
    "fvg_retire_on": "fill",     # "fill": remove when filled; "close": remove only when a candle closes beyond
    "fvg_max_age_bars": 0,       # 0 = keep until the end of the day
    "fvg_max_per_side": 10,      # most open gaps kept on each side
    "fvg_middle_close_beyond": False,   # optional: candle 2 must close beyond candle 1's extreme
    "fvg_middle_direction": False,      # optional: candle 2 must be green for a bullish gap, red for a bearish one
}


def _mins(hm):
    return int(hm[:2]) * 60 + int(hm[3:5])


def _hm(m):
    return "%02d:%02d" % (m // 60, m % 60)


def _fmt(x):
    """A price with two decimals and commas, half up (fault 3)."""
    n = int(math.floor(abs(x) * 100 + 0.5 + 1e-9))
    return ("-" if x < 0 and n else "") + "{:,d}".format(n // 100) + ".%02d" % (n % 100)


def _pts(x):
    """Whole points, half up (fault 3)."""
    return "%d" % int(math.floor(x + 0.5 + 1e-9))


def resample(candles, minutes, session_start="09:15", src_interval=1):
    """Build finished `minutes`-minute candles from finished smaller candles (1-minute by default, src_interval
    minutes each), anchored at the session start. A bigger candle is returned only once all the small candles in it
    have closed (no look-ahead). Dhan has no 3-minute candles: build them here from 1-minute ones."""
    out, cur, s0 = [], None, _mins(session_start)
    for c in candles:
        b = s0 + ((_mins(c["hm"]) - s0) // minutes) * minutes
        if cur is None or cur["start"] != b:
            if cur is not None:
                out.append(cur)
            cur = {"start": b, "hm": _hm(b), "o": c["o"], "h": c["h"], "l": c["l"], "c": c["c"], "last": _mins(c["hm"]), "n": 1}
        else:
            cur["h"] = max(cur["h"], c["h"]); cur["l"] = min(cur["l"], c["l"]); cur["c"] = c["c"]; cur["last"] = _mins(c["hm"]); cur["n"] += 1
    if cur is not None:
        out.append(cur)
    whole = max(1, minutes // src_interval)                     # fault 1: every small candle of the bigger one must be there
    return [{"hm": x["hm"], "o": x["o"], "h": x["h"], "l": x["l"], "c": x["c"]} for x in out if x["n"] >= whole]


class FvgTracker:
    """Keep one per index and per time frame. Call update() with today's finished candles each time a candle closes."""

    def __init__(self, cfg=None, interval=1):
        self.cfg = dict(FVG_DEFAULTS)
        self.cfg.update({k: v for k, v in (cfg or {}).items() if k.startswith("fvg_")})
        self.interval = interval
        self.reset(None)

    def reset(self, date):
        self.date, self.done, self.gaps, self.next_id, self.tr = date, 0, [], 1, []
        self.seen = []                # the candles already fed, as they were read (fault 2)
        self.made_today = []          # every gap made today, open or retired (for a day's summary or a scorecard)

    def update(self, candles, date=None):
        """candles: today's finished candles, oldest first. Returns (open gaps, events from the new candles)."""
        key = lambda c: (c["hm"], c["o"], c["h"], c["l"], c["c"])
        if date != self.date or len(candles) < self.done or any(key(candles[i]) != self.seen[i] for i in range(self.done)):
            self.reset(date)                                        # a new day, or a candle already fed has changed (fault 2)
        events = []
        for k in range(self.done, len(candles)):
            events += self._step(candles, k)
            self.seen.append(key(candles[k]))
        self.done = len(candles)
        return self.open_gaps(), events

    def atr(self):
        n = self.cfg["fvg_atr_len"]
        x = self.tr[-n:] if n > 0 else []
        s = 0.0
        for v in x:                                                 # added left to right, as static/fvg.js adds
            s += v
        return s / len(x) if x else 0.0

    def _step(self, cs, k):
        cfg, c = self.cfg, cs[k]
        prev_c = cs[k - 1]["c"] if k > 0 else None
        self.tr.append(max(c["h"] - c["l"], abs(c["h"] - prev_c) if prev_c is not None else 0.0,
                           abs(c["l"] - prev_c) if prev_c is not None else 0.0))
        end = _hm(_mins(c["hm"]) + self.interval)
        ev = []
        # 1) follow the gaps made before this candle
        for g in self.gaps:
            if g["state"] in ("filled", "inverted") and cfg["fvg_retire_on"] == "fill":
                continue
            ev += self._follow(g, c, end)
        # 2) a new gap closes with this candle (it is candle 3)
        if k >= 2:
            a, m = cs[k - 2], cs[k - 1]
            consecutive = (_mins(m["hm"]) - _mins(a["hm"]) == self.interval and _mins(c["hm"]) - _mins(m["hm"]) == self.interval)
            in_window = a["hm"] >= cfg["fvg_from"] and _mins(end) <= _mins(cfg["fvg_until"])
            for kind in ("bullish", "bearish"):
                if kind == "bullish" and a["h"] < c["l"]:
                    bottom, top = a["h"], c["l"]
                    ok_mid = (not cfg["fvg_middle_close_beyond"] or m["c"] > a["h"]) and (not cfg["fvg_middle_direction"] or m["c"] > m["o"])
                elif kind == "bearish" and a["l"] > c["h"]:
                    bottom, top = c["h"], a["l"]
                    ok_mid = (not cfg["fvg_middle_close_beyond"] or m["c"] < a["l"]) and (not cfg["fvg_middle_direction"] or m["c"] < m["o"])
                else:
                    continue
                size = top - bottom
                need = max(cfg["fvg_min_points"], cfg["fvg_min_pct"] / 100.0 * c["c"], cfg["fvg_min_atr"] * self.atr())
                if not (consecutive and in_window and ok_mid and size >= need):
                    continue
                g = {"id": self.next_id, "kind": kind, "bottom": bottom, "top": top, "half": (top + bottom) / 2.0,
                     "size": size, "from_hm": a["hm"], "made_hm": end, "made_index": k, "state": "active",
                     "touched_hm": None, "half_hm": None, "filled_hm": None, "inverted_hm": None,
                     "held_first_touch": None, "deepest": None}
                self.next_id += 1
                self.gaps.append(g)
                self.made_today.append(g)
                ev.append(self._event("fvg_new", g, end, "New %s FVG %s to %s (%s pts), made by the %s candle"
                                      % (kind, _fmt(bottom), _fmt(top), _pts(size), m["hm"])))
        # 3) retire: age, filled/inverted, and the per-side cap
        keep = []
        for g in self.gaps:
            done = g["state"] == "inverted" or (g["state"] == "filled" and cfg["fvg_retire_on"] == "fill")
            old = cfg["fvg_max_age_bars"] and k - g["made_index"] >= cfg["fvg_max_age_bars"]
            if not done and not old:
                keep.append(g)
        cap = cfg["fvg_max_per_side"]
        for kind in ("bullish", "bearish"):
            side = [g for g in keep if g["kind"] == kind]
            for g in side[:len(side) - cap] if cap > 0 and len(side) > cap else []:   # fault 4: 0 = no limit
                keep.remove(g)
        self.gaps = keep
        return ev

    def _follow(self, g, c, end):
        ev = []
        bull = g["kind"] == "bullish"
        near, far = (g["top"], g["bottom"]) if bull else (g["bottom"], g["top"])
        reach = c["l"] if bull else c["h"]                 # how far into the zone this candle's wick went
        into = (lambda p: reach <= p) if bull else (lambda p: reach >= p)
        if g["touched_hm"] is None and into(near):
            g["touched_hm"] = end
            g["held_first_touch"] = (c["c"] > far) if bull else (c["c"] < far)
            g["state"] = "touched"
            ev.append(self._event("fvg_touched", g, end, "Price came back into the %s FVG %s to %s"
                                  % (g["kind"], _fmt(g["bottom"]), _fmt(g["top"]))))
        if g["touched_hm"] is not None:
            g["deepest"] = reach if g["deepest"] is None else (min(g["deepest"], reach) if bull else max(g["deepest"], reach))
        if g["half_hm"] is None and into(g["half"]):
            g["half_hm"] = end
            if g["state"] == "touched":
                g["state"] = "half"
            ev.append(self._event("fvg_half", g, end, "Price reached the 50%% line (%s) of the %s FVG" % (_fmt(g["half"]), g["kind"])))
        if g["filled_hm"] is None and into(far):
            g["filled_hm"] = end
            g["state"] = "filled"
            ev.append(self._event("fvg_filled", g, end, "The %s FVG %s to %s is filled" % (g["kind"], _fmt(g["bottom"]), _fmt(g["top"]))))
        if g["inverted_hm"] is None and ((c["c"] < far) if bull else (c["c"] > far)):
            g["inverted_hm"] = end
            g["state"] = "inverted"
            ev.append(self._event("fvg_inverted", g, end, "A candle closed %s the %s FVG: it has failed and now acts as %s"
                                  % ("below" if bull else "above", g["kind"], "resistance" if bull else "support")))
        return ev

    def _event(self, typ, g, end, text):
        return {"type": typ, "id": g["id"], "kind": g["kind"], "time": end, "text": text,
                "bottom": g["bottom"], "top": g["top"]}

    def open_gaps(self):
        """Open gaps for the panel and the chart, newest first."""
        out = []
        for g in reversed(self.gaps):
            bull = g["kind"] == "bullish"
            if g["deepest"] is None:
                left_low, left_high, pct = g["bottom"], g["top"], 0.0
            elif bull:
                left_low, left_high = g["bottom"], max(g["bottom"], min(g["top"], g["deepest"]))
                pct = 100.0 * (g["top"] - left_high) / g["size"] if g["size"] else 100.0
            else:
                left_low, left_high = min(g["top"], max(g["bottom"], g["deepest"])), g["top"]
                pct = 100.0 * (left_low - g["bottom"]) / g["size"] if g["size"] else 100.0
            text = "%s FVG %s to %s (%s pts), made %s; %s" % (
                g["kind"].capitalize(), _fmt(g["bottom"]), _fmt(g["top"]), _pts(g["size"]), g["made_hm"],
                {"active": "not touched yet", "touched": "touched at %s" % g["touched_hm"],
                 "half": "reached its 50%% line at %s" % g["half_hm"], "filled": "filled at %s" % g["filled_hm"],
                 "inverted": "failed at %s" % g["inverted_hm"]}[g["state"]])
            out.append(dict(g, unfilled_low=left_low, unfilled_high=left_high, filled_pct=math.floor(min(100.0, max(0.0, pct)) * 10 + 0.5) / 10.0, text=text))
        return out

    def nearest(self, price):
        """The nearest open bullish gap below the price and bearish gap above it (None if none)."""
        gs = self.open_gaps()
        below = [g for g in gs if g["kind"] == "bullish" and g["top"] <= price]
        above = [g for g in gs if g["kind"] == "bearish" and g["bottom"] >= price]
        return (max(below, key=lambda g: g["top"]) if below else None, min(above, key=lambda g: g["bottom"]) if above else None)
