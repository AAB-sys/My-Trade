import random
import time
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))

# chart ranges and candle sizes the detail page can ask for, in any combination (range and interval: the names an earlier source used; days, cal_days and bar_seconds are what Dhan's fetch reads)
RANGES = {
    "today": {"range": "1d", "days": 1},
    "5d": {"range": "5d", "days": 5},
    "2w": {"range": "1mo", "days": 10},  # the last ten sessions: this week and last (15 October, "Previous week" under Levels)
    "3mo": {"range": "3mo", "days": 66},  # for day candles: about three months of sessions
    # the longer views (the owner, 15 October night: "1 week, 3 months, 6 months, 1 yr, 2yr, 3yr, 5yr"): days = sessions
    # to show, cal_days = how far back Dhan is asked. Where the data does not reach back, the chart shows what there is
    "6mo": {"range": "6mo", "days": 132, "cal_days": 200},
    "1y": {"range": "1y", "days": 250, "cal_days": 380},
    "2y": {"range": "2y", "days": 500, "cal_days": 750},
    "3y": {"range": "5y", "days": 750, "cal_days": 1120},  # 3 years of sessions
    "5y": {"range": "5y", "days": 1250, "cal_days": 1860},
}
INTERVALS = {
    "1m": {"interval": "1m", "bar_seconds": 60},
    "5m": {"interval": "5m", "bar_seconds": 300},
    "15m": {"interval": "15m", "bar_seconds": 900},
    "30m": {"interval": "30m", "bar_seconds": 1800},
    "1d": {"interval": "1d", "bar_seconds": 86400},
    "1w": {"interval": "1wk", "bar_seconds": 7 * 86400},  # a week candle, Monday to Friday, built from the day candles (15 October)
}
LONG_INTERVALS = ("1d", "1w")  # a candle a day or a week: the days shown are one session, no day end
SESSION_MINUTES = 375  # 9:15 am to 3:30 pm
SESSION_START = 9 * 3600 + 15 * 60  # 9:15 am IST, in seconds since midnight
IST_SECONDS = 5 * 3600 + 30 * 60


def bars_per_day(interval_key: str) -> int:
    return max(1, SESSION_MINUTES * 60 // INTERVALS[interval_key]["bar_seconds"])


def bucket_start(t: float, bar_seconds: int) -> int:
    """The start of the candle holding time t. Minute candles run from 9:15 (NSE's open), so 30-minute
    ones start at 9:15, 9:45, ...; a day candle is stamped at its day's 9:15."""
    if bar_seconds >= 7 * 86400:  # a week candle is stamped at its Monday's 9:15
        day = int((t + IST_SECONDS) // 86400)
        return (day - (day + 3) % 7) * 86400 - IST_SECONDS + SESSION_START  # day 0 (1 January 1970) was a Thursday
    if bar_seconds >= 86400:
        return int((t + IST_SECONDS) // 86400) * 86400 - IST_SECONDS + SESSION_START
    anchor = (SESSION_START - IST_SECONDS) % bar_seconds
    return int((t - anchor) // bar_seconds) * bar_seconds + anchor

# The indices: the three on the dashboard, every one from Dhan (the owner, 19 October: "remove yahoo data or yahoo API from
# everywhere. Because we are completely dependent on dhan"; until then Yahoo Finance, about 15 minutes delayed, carried these and
# sixteen more, which left the dashboard on 15 October). The value names the source; dhan.QUOTE_IDS has Dhan's ids
INDICES = {
    "NIFTY 50": "dhan:13",
    "NIFTY BANK": "dhan:25",
    "SENSEX": "dhan:51",
}


def now_ist() -> str:
    return datetime.now(IST).isoformat(timespec="seconds")


def quote_fields(name: str, ticker: str, level: float, previous_close: float, quoted_at: datetime) -> dict:
    change = round(level - previous_close, 2)
    return {
        "name": name,
        "ticker": ticker,
        "level": level,
        "change": change,
        "change_percent": round(change / previous_close * 100, 2),
        "time": quoted_at.isoformat(timespec="seconds"),
    }


# ---------------------------------------------------------------- Simulated ticker

DEMO_LEVELS = {
    "NIFTY 50": 23400.0, "NIFTY BANK": 51000.0, "NIFTY IT": 36000.0, "NIFTY NEXT 50": 68000.0,
    "NIFTY 100": 24200.0, "NIFTY 200": 13000.0, "NIFTY 500": 21500.0, "NIFTY FIN SERVICE": 24000.0,
    "NIFTY AUTO": 22500.0, "NIFTY PHARMA": 21000.0, "NIFTY FMCG": 55000.0, "NIFTY METAL": 9000.0,
    "NIFTY MIDCAP 100": 54000.0, "NIFTY SMALLCAP 100": 17000.0, "SENSEX": 77000.0,
    "BANKEX": 58000.0, "BSE 100": 24500.0, "BSE 200": 10600.0, "BSE 500": 34000.0,
}


class DemoTicker:
    """Random walk around fixed starting levels. No network; for watching the plumbing work.

    Every tick is also recorded into 1-, 5- and 15-minute candles, the way a real
    tick feed would build them, so the detail chart moves as the ticker runs.
    """

    def __init__(self, seed=None):
        self._rng = random.Random(seed)
        self._previous_close = dict(DEMO_LEVELS)
        self._level = {name: level * (1 + self._rng.uniform(-0.015, 0.015)) for name, level in DEMO_LEVELS.items()}
        self._start_level = dict(self._level)
        self._started = time.time()
        self._live = {key: {} for key in INTERVALS}  # interval key -> index name -> {bucket start: bar}

    def fetch_all(self) -> dict:
        now = time.time()
        quotes = []
        for name, ticker in INDICES.items():
            self._level[name] *= 1 + self._rng.gauss(0, 0.0004)
            level = round(self._level[name], 2)
            self._record(name, level, now)
            quotes.append(quote_fields(name, ticker, level, self._previous_close[name], datetime.now(IST)))
        return {"quotes": quotes, "failed": []}

    def _record(self, name: str, level: float, now: float) -> None:
        for key, spec in INTERVALS.items():
            bucket = bucket_start(now, spec["bar_seconds"])
            bars = self._live[key].setdefault(name, {})
            bar = bars.get(bucket)
            if bar is None:
                bars[bucket] = {"time": bucket, "open": level, "high": level, "low": level, "close": level}
            else:
                bar["high"] = max(bar["high"], level)
                bar["low"] = min(bar["low"], level)
                bar["close"] = level

    def _history(self, name: str, key: str, last_bucket: int, count: int) -> list:
        """Deterministic bars that walk backwards from the level the ticker started at."""
        spec = INTERVALS[key]
        rng = random.Random(f"{name}:{key}")
        level = self._start_level[name]
        bars = []
        for i in range(count):
            close = level
            open_ = close / (1 + rng.gauss(0, 0.0015))
            high = max(open_, close) * (1 + abs(rng.gauss(0, 0.0006)))
            low = min(open_, close) * (1 - abs(rng.gauss(0, 0.0006)))
            bars.append({
                "time": last_bucket - i * spec["bar_seconds"],
                "open": round(open_, 2), "high": round(high, 2), "low": round(low, 2), "close": round(close, 2),
            })
            level = open_
        return list(reversed(bars))

    def fetch_detail(self, name: str, range_key: str = "today", interval_key: str = "5m") -> dict:
        size = INTERVALS[interval_key]["bar_seconds"]
        per_day = bars_per_day(interval_key)
        first_live_bucket = bucket_start(self._started, size)
        live = self._live[interval_key].get(name, {})
        history = self._history(name, interval_key, first_live_bucket - size, RANGES[range_key]["days"] * per_day)
        candles = history + [live[b] for b in sorted(live)]

        rng = random.Random(f"{name}:summary")
        base = DEMO_LEVELS[name]
        previous_close = self._previous_close[name]
        previous_open = round(previous_close * (1 + rng.uniform(-0.006, 0.006)), 2)
        level = round(self._level[name], 2)
        change = round(level - previous_close, 2)
        session = candles[-per_day:]
        summary = {
            "previous_open": previous_open,
            "previous_high": round(max(previous_open, previous_close) * 1.004, 2),
            "previous_low": round(min(previous_open, previous_close) * 0.996, 2),
            "previous_close": previous_close,
            "today_open": session[0]["open"],
            "today_high": max(bar["high"] for bar in session),
            "today_low": min(bar["low"] for bar in session),
            "last": level,
            "change": change,
            "change_percent": round(change / previous_close * 100, 2),
            "week52_high": round(base * 1.15, 2),
            "week52_low": round(base * 0.82, 2),
            "time": now_ist(),
            "open": True,  # the simulator always trades
        }
        days = []  # the candles' calendar days, plus a made-up day before the first
        for bar in candles:
            date = datetime.fromtimestamp(bar["time"], IST).date().isoformat()
            if days and days[-1]["date"] == date:
                day = days[-1]
                day["high"], day["low"], day["close"] = max(day["high"], bar["high"]), min(day["low"], bar["low"]), bar["close"]
            else:
                days.append({"date": date, "open": bar["open"], "high": bar["high"], "low": bar["low"], "close": bar["close"]})
        before = datetime.fromisoformat(days[0]["date"]).date() - timedelta(days=1)
        days.insert(0, {"date": before.isoformat(), "open": previous_open, "high": summary["previous_high"], "low": summary["previous_low"], "close": previous_close})
        return {
            "name": name,
            "ticker": INDICES[name],
            "range": range_key,
            "interval": interval_key,
            "summary": summary,
            "candles": candles,
            "days": days,
        }
