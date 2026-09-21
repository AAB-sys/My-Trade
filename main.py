from datetime import datetime

from fastapi import FastAPI

app = FastAPI(title="Indices API")

# index name -> Yahoo Finance ticker (used from step 3 onwards)
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


@app.get("/indices")
def list_indices():
    return sorted(INDICES)


@app.get("/indices/{name}")
def get_index(name: str):
    key = name.upper()
    ticker = INDICES[key]
    return {
        "name": key,
        "ticker": ticker,
        "level": 24850.0,
        "change": 63.5,
        "change_percent": 0.26,
        "time": datetime.now().isoformat(timespec="seconds"),
    }
