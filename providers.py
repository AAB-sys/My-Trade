import random
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import httpx

IST = timezone(timedelta(hours=5, minutes=30))
YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
HEADERS = {"User-Agent": "Mozilla/5.0"}
MAX_WORKERS = 4
RETRIES = 3

# chart ranges the detail page can ask for
RANGES = {
    "today": {"range": "1d", "interval": "5m", "bar_seconds": 300, "demo_bars": 75},
    "5d": {"range": "5d", "interval": "15m", "bar_seconds": 900, "demo_bars": 125},
}

# index name -> Yahoo Finance ticker
INDICES = {
    "NIFTY 50": "^NSEI",
    "NIFTY BANK": "^NSEBANK",
    "NIFTY IT": "^CNXIT",
    "NIFTY NEXT 50": "^NSMIDCP",
    "NIFTY 100": "^CNX100",
    "NIFTY 200": "^CNX200",
    "NIFTY 500": "^CRSLDX",
    "NIFTY FIN SERVICE": "NIFTY_FIN_SERVICE.NS",
    "NIFTY AUTO": "^CNXAUTO",
    "NIFTY PHARMA": "^CNXPHARMA",
    "NIFTY FMCG": "^CNXFMCG",
    "NIFTY METAL": "^CNXMETAL",
    "NIFTY MIDCAP 100": "NIFTY_MIDCAP_100.NS",
    "NIFTY SMALLCAP 100": "^CNXSC",
    "SENSEX": "^BSESN",
    "BANKEX": "BSE-BANK.BO",
    "BSE 100": "BSE-100.BO",
    "BSE 200": "BSE-200.BO",
    "BSE 500": "BSE-500.BO",
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


# ---------------------------------------------------------------- Yahoo Finance

def yahoo_chart(ticker: str, range_: str, interval: str) -> dict:
    response = httpx.get(
        YAHOO_URL.format(ticker=ticker),
        params={"range": range_, "interval": interval},
        headers=HEADERS,
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["chart"]["result"][0]


def parse_bars(result: dict) -> list:
    times = result.get("timestamp") or []
    quote = result["indicators"]["quote"][0]
    bars = []
    for i, t in enumerate(times):
        values = (quote["open"][i], quote["high"][i], quote["low"][i], quote["close"][i])
        if any(v is None for v in values):
            continue
        o, h, l, c = (round(v, 2) for v in values)
        bars.append({"time": t, "open": o, "high": h, "low": l, "close": c})
    return bars


def fetch_quote(name: str, ticker: str) -> dict:
    meta = yahoo_chart(ticker, "1d", "5m")["meta"]
    previous_close = meta.get("chartPreviousClose") or meta.get("previousClose")
    quoted_at = datetime.fromtimestamp(meta["regularMarketTime"], IST)
    return quote_fields(name, ticker, meta["regularMarketPrice"], previous_close, quoted_at)


def fetch_quote_with_retries(name: str, ticker: str):
    for attempt in range(RETRIES):
        try:
            return fetch_quote(name, ticker)
        except Exception:
            if attempt == RETRIES - 1:
                return None
            time.sleep(1 + attempt)  # Yahoo rate-limits bursts; give it a moment before asking again


def fetch_all_yahoo() -> dict:
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        results = list(pool.map(lambda item: fetch_quote_with_retries(*item), INDICES.items()))
    return {
        "quotes": [quote for quote in results if quote is not None],
        "failed": [name for name, quote in zip(INDICES, results) if quote is None],
    }


def fetch_detail_yahoo(name: str, ticker: str, range_key: str = "today") -> dict:
    spec = RANGES[range_key]
    daily = yahoo_chart(ticker, "5d", "1d")
    intraday = yahoo_chart(ticker, spec["range"], spec["interval"])
    meta = intraday["meta"]

    today = datetime.now(IST).date()
    day_bars = parse_bars(daily)
    bar_date = lambda bar: datetime.fromtimestamp(bar["time"], IST).date()
    previous_days = [bar for bar in day_bars if bar_date(bar) < today]
    today_bars = [bar for bar in day_bars if bar_date(bar) == today]
    previous = previous_days[-1] if previous_days else None
    current = today_bars[-1] if today_bars else None

    level = meta["regularMarketPrice"]
    previous_close = meta.get("chartPreviousClose") or meta.get("previousClose") or (previous["close"] if previous else None)
    change = round(level - previous_close, 2)

    summary = {
        "previous_open": previous["open"] if previous else None,
        "previous_high": previous["high"] if previous else None,
        "previous_low": previous["low"] if previous else None,
        "previous_close": previous_close,
        "today_open": current["open"] if current else None,
        "today_high": meta.get("regularMarketDayHigh") or (current["high"] if current else None),
        "today_low": meta.get("regularMarketDayLow") or (current["low"] if current else None),
        "last": level,
        "change": change,
        "change_percent": round(change / previous_close * 100, 2),
        "week52_high": meta.get("fiftyTwoWeekHigh"),
        "week52_low": meta.get("fiftyTwoWeekLow"),
        "time": datetime.fromtimestamp(meta["regularMarketTime"], IST).isoformat(timespec="seconds"),
    }
    return {
        "name": name,
        "ticker": ticker,
        "range": range_key,
        "interval": spec["interval"],
        "summary": summary,
        "candles": parse_bars(intraday),
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

    Every tick is also recorded into 5-minute and 15-minute candles, the way a real
    tick feed would build them, so the detail chart moves as the ticker runs.
    """

    def __init__(self, seed=None):
        self._rng = random.Random(seed)
        self._previous_close = dict(DEMO_LEVELS)
        self._level = {name: level * (1 + self._rng.uniform(-0.015, 0.015)) for name, level in DEMO_LEVELS.items()}
        self._start_level = dict(self._level)
        self._started = time.time()
        self._live = {key: {} for key in RANGES}  # range key -> index name -> {bucket start: bar}

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
        for key, spec in RANGES.items():
            size = spec["bar_seconds"]
            bucket = int(now // size) * size
            bars = self._live[key].setdefault(name, {})
            bar = bars.get(bucket)
            if bar is None:
                bars[bucket] = {"time": bucket, "open": level, "high": level, "low": level, "close": level}
            else:
                bar["high"] = max(bar["high"], level)
                bar["low"] = min(bar["low"], level)
                bar["close"] = level

    def _history(self, name: str, key: str, last_bucket: int) -> list:
        """Deterministic bars that walk backwards from the level the ticker started at."""
        spec = RANGES[key]
        rng = random.Random(f"{name}:{key}")
        level = self._start_level[name]
        bars = []
        for i in range(spec["demo_bars"]):
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

    def fetch_detail(self, name: str, range_key: str = "today") -> dict:
        spec = RANGES[range_key]
        size = spec["bar_seconds"]
        first_live_bucket = int(self._started // size) * size
        live = self._live[range_key].get(name, {})
        candles = self._history(name, range_key, first_live_bucket - size) + [live[b] for b in sorted(live)]

        rng = random.Random(f"{name}:summary")
        base = DEMO_LEVELS[name]
        previous_close = self._previous_close[name]
        previous_open = round(previous_close * (1 + rng.uniform(-0.006, 0.006)), 2)
        level = round(self._level[name], 2)
        change = round(level - previous_close, 2)
        session = candles[-RANGES["today"]["demo_bars"]:]
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
        }
        return {
            "name": name,
            "ticker": INDICES[name],
            "range": range_key,
            "interval": spec["interval"],
            "summary": summary,
            "candles": candles,
        }
