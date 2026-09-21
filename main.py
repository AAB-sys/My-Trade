import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

app = FastAPI(title="Indices API")

YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
HEADERS = {"User-Agent": "Mozilla/5.0"}
IST = timezone(timedelta(hours=5, minutes=30))
DASHBOARD = Path(__file__).parent / "static" / "index.html"
CACHE_SECONDS = 60

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

# Yahoo's data is ~15 minutes delayed, so re-asking more often than this gains nothing
_all_cache = {"fetched_at": 0.0, "quotes": []}


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


def fetch_all() -> list:
    age = time.monotonic() - _all_cache["fetched_at"]
    if _all_cache["quotes"] and age < CACHE_SECONDS:
        return _all_cache["quotes"]

    def safe_fetch(item):
        name, ticker = item
        try:
            return fetch_quote(name, ticker)
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = pool.map(safe_fetch, INDICES.items())
    quotes = [quote for quote in results if quote is not None]

    _all_cache.update(fetched_at=time.monotonic(), quotes=quotes)
    return quotes


@app.get("/")
def dashboard():
    return FileResponse(DASHBOARD)


@app.get("/indices")
def list_indices():
    return sorted(INDICES)


@app.get("/indices/all")
def all_indices():
    return fetch_all()


@app.get("/indices/{name}")
def get_index(name: str):
    key = name.upper()
    if key not in INDICES:
        raise HTTPException(status_code=404, detail=f"Unknown index '{name}'. See /indices for the list.")
    return fetch_quote(key, INDICES[key])
