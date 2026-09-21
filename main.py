from datetime import datetime, timedelta, timezone

import httpx
from fastapi import FastAPI, HTTPException

app = FastAPI(title="Indices API")

YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
HEADERS = {"User-Agent": "Mozilla/5.0"}
IST = timezone(timedelta(hours=5, minutes=30))

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


@app.get("/indices")
def list_indices():
    return sorted(INDICES)


@app.get("/indices/{name}")
def get_index(name: str):
    key = name.upper()
    if key not in INDICES:
        raise HTTPException(status_code=404, detail=f"Unknown index '{name}'. See /indices for the list.")
    return fetch_quote(key, INDICES[key])
