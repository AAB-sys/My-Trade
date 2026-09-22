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


# ---------------------------------------------------------------- Yahoo Finance

def fetch_quote(name: str, ticker: str) -> dict:
    response = httpx.get(
        YAHOO_URL.format(ticker=ticker),
        params={"range": "1d", "interval": "5m"},
        headers=HEADERS,
        timeout=15,
    )
    response.raise_for_status()
    meta = response.json()["chart"]["result"][0]["meta"]

    level = meta["regularMarketPrice"]
    previous_close = meta.get("chartPreviousClose") or meta.get("previousClose")
    change = round(level - previous_close, 2)
    quoted_at = datetime.fromtimestamp(meta["regularMarketTime"], IST)

    return {
        "name": name,
        "ticker": ticker,
        "level": level,
        "change": change,
        "change_percent": round(change / previous_close * 100, 2),
        "time": quoted_at.isoformat(timespec="seconds"),
    }


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


# ---------------------------------------------------------------- Simulated ticker

DEMO_LEVELS = {
    "NIFTY 50": 23400.0, "NIFTY BANK": 51000.0, "NIFTY IT": 36000.0, "NIFTY NEXT 50": 68000.0,
    "NIFTY 100": 24200.0, "NIFTY 200": 13000.0, "NIFTY 500": 21500.0, "NIFTY FIN SERVICE": 24000.0,
    "NIFTY AUTO": 22500.0, "NIFTY PHARMA": 21000.0, "NIFTY FMCG": 55000.0, "NIFTY METAL": 9000.0,
    "NIFTY MIDCAP 100": 54000.0, "NIFTY SMALLCAP 100": 17000.0, "SENSEX": 77000.0,
    "BANKEX": 58000.0, "BSE 100": 24500.0, "BSE 200": 10600.0, "BSE 500": 34000.0,
}


class DemoTicker:
    """Random walk around fixed starting levels. No network; for watching the plumbing work."""

    def __init__(self, seed=None):
        self._rng = random.Random(seed)
        self._previous_close = dict(DEMO_LEVELS)
        self._level = {name: level * (1 + self._rng.uniform(-0.015, 0.015)) for name, level in DEMO_LEVELS.items()}

    def fetch_all(self) -> dict:
        quotes = []
        for name, ticker in INDICES.items():
            self._level[name] *= 1 + self._rng.gauss(0, 0.0004)
            level = round(self._level[name], 2)
            previous_close = self._previous_close[name]
            change = round(level - previous_close, 2)
            quotes.append({
                "name": name,
                "ticker": ticker,
                "level": level,
                "change": change,
                "change_percent": round(change / previous_close * 100, 2),
                "time": now_ist(),
            })
        return {"quotes": quotes, "failed": []}
