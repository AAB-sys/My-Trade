"""The Volume Profile page's signal (13 November, the owner's document "Volume Profile Signal Logic": "read this document
thoroughly and implement the changes").

The logic itself is the document's own code, kept as it was written in the folder vp/ (profile.py, vp_signal.py,
vp_config.json, with its command line vp_cli.py and its 12 tests test_vp.py). This file only feeds it: the index's
5-minute candles from Dhan, each weighed with the volume its nearest futures contract traded in the same five minutes
(an index has no volume; the prices stay the index's own, so levels and prices are never mixed), the sessions cut by the
IST day, and only finished candles. It adds what the document's step 7 says in words: after a signal, the exit at the
stop, at the target, or at 15:15.

It states a signal; it places no order. Paper calls and Calls with Signals do not read it, nor it them."""
import importlib.util
import json
import math
import time
from datetime import datetime, timedelta
from pathlib import Path

import dhan

VP = Path(__file__).resolve().parent / "vp"


def _load(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, VP / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# the document's two modules, under names of their own (a file called profile.py must not stand in for Python's own "profile")
vp_profile = _load("vp_profile_levels", "profile.py")
vp_signal = _load("vp_signal_rules", "vp_signal.py")
CFG = json.loads((VP / "vp_config.json").read_text())

HISTORY_DAYS = 45       # calendar days asked of Dhan: a naked POC lives 20 sessions, and the first profile needs a day before it
MIN_CANDLES = 70        # the document, note 3: "skip any session with fewer than about 70 candles when building a profile"
HISTORY_SHOWN = 5       # the last sessions listed under the signal, for study


def config_for(name: str) -> dict:
    """The settings for one index: the row's height is per index (the document: 5 points for Nifty, about 10 for Bank Nifty
    and Sensex, "keep it configurable per index"); everything else is the one set of numbers of vp_config.json."""
    cfg = dict(CFG)
    cfg["bin_size_pts"] = (CFG.get("bin_size_by_index") or {}).get(name, CFG["bin_size_pts"])
    return cfg


def candle(bar: dict, volume) -> dict:
    """One candle in the document's form: {"hm", "o", "h", "l", "c", "v" when there is volume}."""
    out = {"hm": datetime.fromtimestamp(bar["time"], dhan.IST).strftime("%H:%M"), "o": bar["open"], "h": bar["high"], "l": bar["low"], "c": bar["close"], "t": bar["time"]}
    if volume and volume > 0:
        out["v"] = float(volume)
    return out


def sessions_of(bars: list, volumes: dict) -> dict:
    """{IST day (iso): its candles, oldest first}, in the order of the days."""
    days: dict = {}
    for b in bars:
        days.setdefault(datetime.fromtimestamp(b["time"], dhan.IST).date().isoformat(), []).append(candle(b, volumes.get(b["time"])))
    return dict(sorted(days.items()))


def prepare(days: dict, day: str, cfg: dict):
    """Yesterday's profile and the naked POC list as they stood before `day` opened: the document's vp_cli.prepare, with its
    note 3 (a session of fewer than about 70 candles builds no profile). Returns (profile, its date, the naked list)."""
    naked, prev, prev_day = [], None, None
    for d, candles in days.items():
        if d >= day:
            break
        if len(candles) < MIN_CANDLES:
            continue
        prev = vp_profile.build_profile(candles, cfg["bin_size_pts"], cfg["value_area_pct"])
        naked = vp_profile.update_naked_pocs(naked, d, candles, prev, cfg["naked_poc_max_age_days"])
        prev_day = d
    return prev, prev_day, naked


def outcome(signal: dict, candles: list, cfg: dict) -> dict:
    """The document's step 7 for one signal, on the candles of its day (finished ones only): out when the index touches
    the stop, out when it touches the target, otherwise out at 15:15. A candle that touches both counts as the stop: inside
    one candle the order is not known, and the worse one is taken. {"how": "stop" | "target" | "time" | "open", "at", "exit",
    "points"}; "open" while none of the three has come yet (then exit is the last close)."""
    ce = signal["signal"] == "CE"
    entry, stop, target = signal["index_price"], signal["index_stop"], signal["index_target"]
    k = next(i for i, b in enumerate(candles) if b["hm"] == signal["candle"])
    out_by = vp_signal._mins(cfg["exit_all_by"])
    points = lambda price: round((price - entry) * (1 if ce else -1), 2)
    last = candles[k]
    for b in candles[k + 1:]:
        start = vp_signal._mins(b["hm"])
        if start >= out_by:
            break
        last = b
        if (b["l"] <= stop) if ce else (b["h"] >= stop):
            return {"how": "stop", "at": b["hm"], "exit": stop, "points": points(stop)}
        if (b["h"] >= target) if ce else (b["l"] <= target):
            return {"how": "target", "at": b["hm"], "exit": target, "points": points(target)}
    if vp_signal._mins(last["hm"]) + 5 >= out_by:
        return {"how": "time", "at": cfg["exit_all_by"], "exit": last["c"], "points": points(last["c"])}
    return {"how": "open", "at": None, "exit": last["c"], "points": points(last["c"])}


def sizing(signal: dict, lot_size, premium, cfg: dict) -> dict:
    """The document's step 6. With the option's premium typed in, its own size_trade (the loss limit and the 30% of capital
    limit); without it, the loss limit alone, and that is said. No lot size from the exchange's list: no sizing, said too."""
    if not lot_size or lot_size <= 0:
        return {"lots": None, "note": "The lot size is not known yet (Dhan's instrument list is still being read)."}
    loss_per_lot = cfg["assumed_delta"] * signal["risk_pts"] * lot_size
    if premium and premium > 0:
        return {**vp_signal.size_trade(premium, signal["risk_pts"], lot_size, cfg), "lot_size": lot_size, "loss_per_lot_inr": round(loss_per_lot, 2), "premium": premium, "note": None}
    lots = max(0, math.floor(cfg["max_loss_per_trade_inr"] / loss_per_lot))
    return {"lots": lots, "quantity": lots * lot_size, "lot_size": lot_size, "loss_per_lot_inr": round(loss_per_lot, 2), "approx_loss_at_stop_inr": round(lots * loss_per_lot, 2),
            "premium": None, "note": "By the loss limit only. Type the option's premium to also check the 30% of capital limit."}


def day_view(days: dict, day: str, finished: list, cfg: dict, lot_size=None, premium=None) -> dict:
    """Everything the signal screen shows for one session: the levels it uses (from the session before), the naked POC
    list, how it opened, the signal or WAIT with its reason, and after a signal its exit. `finished` are the session's
    finished candles (none before the open)."""
    prev, prev_day, naked = prepare(days, day, cfg)
    view = {"day": day, "levels": None, "levels_from": prev_day, "naked": [p for p in naked if p["date"] != prev_day], "opened": None, "signal": None}
    if prev is None:
        view["signal"] = {"signal": "WAIT", "reason": "No earlier session with enough candles to build a profile from.", "skipped": []}
        return view
    view["levels"] = {k: prev[k] for k in ("val", "poc", "vah", "hvn", "lvn", "session_low", "session_high", "uses_volume")}
    if not finished:
        view["signal"] = {"signal": "WAIT", "reason": "The market has not opened yet.", "skipped": []}
        return view
    found = vp_signal.find_signal(finished, prev, cfg, naked)
    view["opened"] = found.get("opened")
    if found["signal"] == "WAIT":
        last = vp_signal._mins(finished[-1]["hm"]) + 5
        found["reason"] = ("No valid setup today." if last > vp_signal._mins(cfg["no_entry_after"]) else
                           "Signals start at " + cfg["no_entry_before"] + "." if last < vp_signal._mins(cfg["no_entry_before"]) else "No valid setup yet.")
    else:
        found["outcome"] = outcome(found, finished, cfg)
        found["sizing"] = sizing(found, lot_size, premium, cfg)
    view["signal"] = found
    return view


def _history(name: str) -> tuple:
    """(the index's 5-minute candles, the futures' volume by candle time) for the last HISTORY_DAYS, asked of Dhan once
    and kept for ten minutes: the sessions before today do not change, and today's candles are read apart."""
    def make():
        bars = dhan.intraday(name, 5, HISTORY_DAYS)
        try:
            volumes = {t: v for t, v in dhan.future_volume(name, 5, HISTORY_DAYS)["bars"]}
            problem = None
        except dhan.DhanError as exc:
            volumes, problem = {}, exc.message[:160]  # no volume: every candle counts as 1, as the document says, and it is said
        return bars, volumes, problem
    return dhan.cached(("vp signal history", name), 600, make)


def state(name: str, premium=None) -> dict:
    """The signal screen's answer for one index, now."""
    cfg = config_for(name)
    bars, volumes, volume_problem = _history(name)
    today = dhan.today_ist().isoformat()
    now = time.time()
    fresh = [b for b in dhan.intraday(name, 5) if datetime.fromtimestamp(b["time"], dhan.IST).date().isoformat() == today]
    merged = {b["time"]: b for b in bars}
    merged.update({b["time"]: b for b in fresh})
    days = sessions_of(sorted(merged.values(), key=lambda b: b["time"]), volumes)
    finished = [c for c in days.get(today, []) if c["t"] + 300 <= now]
    earlier = [d for d in days if d < today]
    # the session shown: today once it has a finished candle, or (a weekday before the open, a weekend, a night) the coming one
    weekday = datetime.fromtimestamp(now, dhan.IST).weekday() < 5
    view = day_view(days, today, finished, cfg, dhan.lot_size(name), premium) if (finished or weekday) else None
    if view is None:  # a weekend: the levels for the next session, from the last one
        nxt = (datetime.fromtimestamp(now, dhan.IST) + timedelta(days=1)).date()
        while nxt.weekday() >= 5:
            nxt += timedelta(days=1)
        view = day_view(days, nxt.isoformat(), [], cfg)
    past = []
    for d in earlier[-HISTORY_SHOWN:]:
        v = day_view(days, d, days[d], cfg, dhan.lot_size(name))
        s = v["signal"]
        past.append({"day": d, "opened": v["opened"], "signal": s["signal"], "setup": s.get("setup"), "candle": s.get("candle"), "index_price": s.get("index_price"),
                     "index_stop": s.get("index_stop"), "index_target": s.get("index_target"), "reward_to_risk": s.get("reward_to_risk"),
                     "outcome": s.get("outcome"), "skipped": len(s.get("skipped") or [])})
    for c in finished:
        c.pop("t", None)
    return {"name": name, **view, "history": past[::-1], "volume_problem": volume_problem,
            "settings": {k: cfg[k] for k in ("bin_size_pts", "value_area_pct", "edge_tolerance_pts", "stop_buffer_pts", "acceptance_closes", "min_reward_to_risk",
                                             "naked_poc_max_age_days", "no_entry_before", "no_entry_after", "exit_all_by", "assumed_delta", "capital_inr",
                                             "max_loss_per_trade_inr", "max_capital_per_trade_pct")},
            "lot_size": dhan.lot_size(name), "at": datetime.fromtimestamp(now, dhan.IST).isoformat(timespec="seconds")}
