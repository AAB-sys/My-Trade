"""The Live Volume Profile Explanation Panel (the owner's build document of 17 November 2026, "Live Volume Profile Panel", with
its tested code: panel/panel_engine.py, panel_profile.py, panel_config.json, panel_replay.py and the 26 tests of test_panel.py).

This file only feeds that code, as vpsignal.py feeds vp/: the index's finished 1-minute candles of today, each with the
volume its futures contract traded in the same minute (a missing minute weighs 0, the document's note 2), yesterday's levels
(the same ones the page draws as its "Prev day" lines, the document's section 3), and the day's calendar. One engine per index
per day (section 4). The engine keeps a little history (section 15, note 5), so it is fed one candle at a time: at the first
look of the day, or after a restart, today's candles are replayed through a new engine exactly as panel_replay.py does, and
every later look adds only the minutes that have closed since. It reads; it gives no call and places no order (note 10).

Two settings are the page's, not the document's defaults, so that the panel and the chart always agree (note 7 and the
acceptance checklist): match_chart_profile (today's profile is counted with the chart's own arithmetic, panel_profile's
like_chart) and yesterday's levels (from vpsignal, the page's "Prev day" lines)."""
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

import dhan
import vpsignal

PANEL = Path(__file__).resolve().parent / "panel"
if str(PANEL) not in sys.path:
    sys.path.insert(0, str(PANEL))
import panel_engine  # noqa: E402  (the document's code, in its own folder)

CFG = panel_engine.load_config(str(PANEL / "panel_config.json"))
SETTLE_SECONDS = 2      # the document, section 4: "after each 1-minute candle closes, plus about 2 seconds for the feed to settle"
_engines: dict = {}     # name -> {"date", "engine", "done": candles fed, "out": the last output, "alerts": today's, newest first}
_locks: dict = {}


def config_for(name: str) -> dict:
    """The document's settings, with the page's profile arithmetic and the index's option expiry days as its expiry flag."""
    cfg = dict(CFG)
    cfg["match_chart_profile"] = True
    try:
        days = dhan.cached(("panel expiries", name), 6 * 3600, lambda: dhan.expiries(name))
    except Exception:  # noqa: BLE001 - the flag is a warning only; without the list the panel still reads
        days = []
    cfg["expiry_dates"] = sorted(set(CFG.get("expiry_dates") or []) | set(days))
    return cfg


def candles_of(bars: list, volumes: dict) -> list:
    """The document's candle: {"hm" (the candle's start, IST), "o", "h", "l", "c", "v"}; no futures candle for the minute: 0."""
    return [{"hm": datetime.fromtimestamp(b["time"], dhan.IST).strftime("%H:%M"), "o": b["open"], "h": b["high"], "l": b["low"], "c": b["close"],
             "v": float(volumes.get(b["time"]) or 0)} for b in bars]


def previous_of(name: str, today: str):
    """Yesterday's levels as the page draws them (vpsignal.prepare: the last full session before today, its 1-minute candles
    with the futures volume, the Signal's fixed rows), in the engine's form, and the day they are from. (None, None): no such day."""
    bars, volumes, _problem, fine = vpsignal._history(name)
    days = vpsignal.sessions_of(sorted(bars, key=lambda b: b["time"]), volumes)
    prev, prev_day, _naked = vpsignal.prepare(days, today, vpsignal.config_for(name), fine)
    if prev is None:
        return None, None
    return {"vah": prev["vah"], "poc": prev["poc"], "val": prev["val"], "high": prev["session_high"], "low": prev["session_low"],
            "close": days[prev_day][-1]["c"]}, prev_day


def feed(entry: dict, candles: list) -> dict:
    """Every candle not yet fed goes through the engine, one update each, oldest first; the alerts are kept for the day."""
    for i in range(entry["done"], len(candles)):
        out = entry["engine"].update(candles[:i + 1])
        entry["alerts"][:0] = reversed(out["alerts"])
        entry["out"] = out
    entry["done"] = len(candles)
    return entry["out"]


def state(name: str) -> dict:
    """The panel for one index, now: the engine's output (the document's section 12) with the day's alerts, newest first."""
    now = time.time()
    today = dhan.today_ist().isoformat()
    base = {"name": name, "date": today, "at": datetime.fromtimestamp(now, dhan.IST).isoformat(timespec="seconds"), "warning": panel_engine.WARNING}
    bars = [b for b in dhan.intraday(name, 1) if datetime.fromtimestamp(b["time"], dhan.IST).date().isoformat() == today and b["time"] + 60 + SETTLE_SECONDS <= now]
    if not bars:
        return {**base, "waiting": "No finished candle of today yet. The panel starts with the first minute after 09:15."}
    volume_problem = None
    try:
        got = dhan.future_volume(name, 1)
        volumes, contract = {t: v for t, v in got["bars"]}, got["contract"]
    except dhan.DhanError as exc:
        volumes, contract, volume_problem = {}, None, exc.message[:160]
    candles = candles_of(bars, volumes)
    with _locks.setdefault(name, threading.Lock()):
        entry = _engines.get(name)
        if entry is None or entry["date"] != today or entry["done"] > len(candles) or entry["first"] != candles[0]["hm"]:
            prev, prev_day = previous_of(name, today)
            entry = _engines[name] = {"date": today, "engine": panel_engine.PanelEngine(config_for(name), prev, today, 1), "done": 0, "out": None,
                                      "alerts": [], "first": candles[0]["hm"], "prev_day": prev_day}
        out = feed(entry, candles)
        return {**base, **out, "alerts": entry["alerts"][:60], "previous_day": entry["prev_day"], "contract": contract, "volume_problem": volume_problem,
                "candles": len(candles)}
