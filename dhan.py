"""Dhan (DhanHQ v2), the owner's broker API, as a licensed data source.

The connection and a plain-language status check (check_dhan.py), real-time index
candles and quotes, the option chain, and the record of each paper call's option:
its strike, the premium paid at entry, the premium now and the Sell mark. The two
settings live in .env on the laptop and in the host's environment only, never in
the repo:

    DHAN_CLIENT_ID      the account's client id (a number)
    DHAN_ACCESS_TOKEN   the access token from the Dhan website; it lasts 24 hours

Only data endpoints are called here. Nothing in this file can place an order.
"""
import csv
import json
import logging
import os
import threading
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx

from providers import bucket_start

log = logging.getLogger("dhan")

BASE = os.environ.get("DHAN_API_BASE", "https://api.dhan.co/v2")  # overridden only by tests
SEGMENT = "IDX_I"                                  # Dhan's segment for an index itself
INDEX_IDS = {"NIFTY 50": 13, "NIFTY BANK": 25}  # the indices with the owner's options: the chain, the records, the watcher
QUOTE_IDS = {**INDEX_IDS, "SENSEX": 51}          # every index quoted live from Dhan: those two, and SENSEX for its tile and page (owner's ask, 7 October)
LIST_NAMES = {"NIFTY 50": "NIFTY", "NIFTY BANK": "BANKNIFTY", "SENSEX": "SENSEX"}  # how Dhan's instrument list names the index rows themselves
OPTION_SEGMENT = "NSE_FNO"                                   # where the indices' options trade
UNDERLYING = {"NIFTY 50": "NIFTY", "NIFTY BANK": "BANKNIFTY"}  # how Dhan's instrument list names the options' underlying
SCRIP_MASTER_URL = os.environ.get("DHAN_SCRIP_MASTER_URL", "https://images.dhan.co/api-data/api-scrip-master.csv")     # Dhan's security ids of the indices with options
IST = timezone(timedelta(hours=5, minutes=30))
SELL_SHARE = float(os.environ.get("SELL_SHARE", "0.65"))  # the owner's rule (6 October): sell once the premium has fallen by 35% of what was paid, i.e. is at or below this share of it
RECORDS_FILE = Path(os.environ.get("CALL_RECORDS_FILE", Path(__file__).resolve().parent / "paper_calls.json"))


class DhanError(Exception):
    """kind: config | token | subscription | rate | network | other."""

    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind
        self.message = message


def settings() -> tuple[str, str]:
    return os.environ.get("DHAN_CLIENT_ID", "").strip(), os.environ.get("DHAN_ACCESS_TOKEN", "").strip()


def configured() -> bool:
    client_id, token = settings()
    return bool(client_id and token)


# Dhan allows one market-feed request a second (ltp, ohlc, quote) and asks for a gap between option-chain
# requests. The server has several callers of those: the once-a-second price poll, the index page's quote,
# the dashboard's tiles. Two of them in the same second and Dhan refuses the second one ("too many
# requests"); on 7 October that is what kept throwing the index page back to Yahoo's delayed prices
# while the live ticks were ignored. So every request takes its turn here, spaced out, whoever asks.
_pace_lock = threading.Lock()
_pace_next = {"feed": 0.0, "chain": 0.0, "other": 0.0}
PACE_SECONDS = {"feed": 1.2, "chain": 3.1, "other": 0.6}  # a little over the limit's second: the gap is measured where Dhan sees it, not where it is sent
_hold = {"until": 0.0, "seconds": 0.0}  # after a refusal: every request waits, longer each time it happens again, until one gets through


def _pace(path: str) -> None:
    """Waits for this request's turn, so Dhan's rate limits are kept whoever asks: a gap inside each group of
    endpoints, and after Dhan has refused one ("too many requests") a pause for everyone, 2 s, then 4, 8, up
    to 15, until a request gets through again. Dhan's exact counting is not published in full, so the pause
    is the safety net behind the gaps. The turn is taken under the lock and waited for outside it, so a request
    waiting for its group's gap (the chain's 3 s) never holds up another group's (the once-a-second price poll:
    on 7 October the watcher's chain reads beside the page's held the poll back and the price stood still)."""
    group = "feed" if path.startswith("/marketfeed") else "chain" if path == "/optionchain" else "other"  # the chain itself: one every 3 s; its expiry list is an ordinary request
    with _pace_lock:
        now = time.monotonic()
        turn = max(_pace_next[group], _hold["until"], now)
        _pace_next[group] = turn + PACE_SECONDS[group]
    if turn > now:
        time.sleep(turn - now)


def _refused() -> float:
    """Dhan refused a request for its rate: everyone pauses, longer each time in a row. Returns the pause."""
    with _pace_lock:
        _hold["seconds"] = min(15.0, _hold["seconds"] * 2 if _hold["seconds"] else 2.0)
        _hold["until"] = time.monotonic() + _hold["seconds"]
        return _hold["seconds"]


def _got_through() -> None:
    with _pace_lock:
        _hold["seconds"] = 0.0


def call(method: str, path: str, payload: dict | None = None) -> dict:
    """One request to Dhan; raises DhanError with a plain reason when it refuses."""
    client_id, token = settings()
    if not (client_id and token):
        raise DhanError("config", "DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN are not both set")
    headers = {"access-token": token, "client-id": client_id, "Accept": "application/json"}
    if payload is not None:
        payload = {**payload, "dhanClientId": client_id}
    _pace(path)
    try:
        response = httpx.request(method, BASE + path, json=payload, headers=headers, timeout=15)
    except httpx.HTTPError as exc:
        raise DhanError("network", f"could not reach {BASE}: {type(exc).__name__}: {exc}"[:200]) from exc
    try:
        body = response.json() if response.content else {}
    except ValueError:
        body = {}
    if not isinstance(body, dict):
        body = {"data": body}
    code = str(body.get("errorCode", ""))
    said = str(body.get("errorMessage") or body.get("remarks") or body.get("message") or response.text[:200])
    # Dhan's data endpoints answer an unsubscribed account with {"data": {"806": "Data APIs not Subscribed"}}
    # and a refused status, so that is checked before the token rule
    inner = body.get("data") if isinstance(body.get("data"), dict) else {}
    if code == "DH-902" or "806" in inner or "subscri" in (said + " ".join(map(str, inner.values()))).lower():
        raise DhanError("subscription", f"Dhan says the Data API is not subscribed ({said})")
    if response.status_code == 401 or code == "DH-901":
        raise DhanError("token", f"Dhan refused the token ({said})")
    if response.status_code == 429 or code == "DH-904":
        pause = _refused()
        raise DhanError("rate", f"Dhan's rate limit was hit ({said}); every request waits {pause:g} s")
    if response.status_code >= 400 or code or body.get("status") == "failure":
        raise DhanError("other", f"HTTP {response.status_code} {code} {said}".strip())
    _got_through()
    return body


def profile() -> dict:
    return call("GET", "/profile")


def token_check() -> dict:
    """Whether Dhan accepts the token now, and until when it is valid, from Dhan's profile answer ("tokenValidity",
    a date and time as dd/mm/yyyy HH:MM, IST). No secret in the answer: a yes or no, a time, and a plain reason."""
    now = datetime.now(IST).isoformat(timespec="seconds")
    if not configured():
        return {"ok": False, "valid_till": None, "checked_at": now, "problem": "DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN are not both set"}
    try:
        body = profile()
    except DhanError as exc:
        return {"ok": False, "valid_till": None, "checked_at": now,
                "problem": "the token was refused, it has probably expired" if exc.kind == "token" else exc.message}
    who = body.get("data") if isinstance(body.get("data"), dict) else body
    raw = str(who.get("tokenValidity") or "").strip()
    valid_till = None
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S"):
        try:
            valid_till = datetime.strptime(raw, fmt).replace(tzinfo=IST).isoformat(timespec="seconds")
            break
        except ValueError:
            continue
    return {"ok": True, "valid_till": valid_till or (raw or None), "checked_at": now, "problem": None}


def expiries(name: str) -> list[str]:
    """The option expiry dates of an index, soonest first, as YYYY-MM-DD."""
    body = call("POST", "/optionchain/expirylist", {"UnderlyingScrip": INDEX_IDS[name], "UnderlyingSeg": SEGMENT})
    return sorted(str(d) for d in body.get("data", []))


def last_price(name: str) -> float:
    return last_prices([name])[0][name]


def last_prices(names: list, option_ids: list = ()) -> tuple:
    """({index name: last price}, {option security id: premium}) in one request, not cached: this is the
    live tick, for the indices and for the option contracts behind the open calls."""
    payload = {SEGMENT: [QUOTE_IDS[n] for n in names]}
    if option_ids:
        payload[OPTION_SEGMENT] = [int(i) for i in option_ids]
    body = call("POST", "/marketfeed/ltp", payload)
    try:
        data = body["data"]
        indices = data.get(SEGMENT) or {}
        options = data.get(OPTION_SEGMENT) or {}
        return ({n: float(indices[str(QUOTE_IDS[n])]["last_price"]) for n in names if str(QUOTE_IDS[n]) in indices},
                {int(i): float(options[str(i)]["last_price"]) for i in option_ids if str(i) in options})
    except (KeyError, TypeError, ValueError, AttributeError) as exc:
        raise DhanError("other", f"unexpected price answer from Dhan: {str(body)[:160]}") from exc


def status() -> dict:
    """The checks in order, each with ok and a plain sentence; stops at the first failure."""
    steps = []

    def step(ok, text):
        steps.append({"ok": ok, "text": text})
        return ok

    client_id, token = settings()
    if not step(bool(client_id and token), "Settings: DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN found"
                if client_id and token else "Settings: DHAN_CLIENT_ID or DHAN_ACCESS_TOKEN is missing. Add both to .env (see .env.example), or to the host's environment."):
        return {"ok": False, "steps": steps}
    try:
        body = profile()
        who = body.get("data") if isinstance(body.get("data"), dict) else body  # Dhan answers /profile at the top level
        name = who.get("dhanClientName") or who.get("clientName") or ""
        step(True, f"Token: Dhan accepted it (client {who.get('dhanClientId', client_id)}{', ' + name if name else ''})")
    except DhanError as exc:
        step(False, "Token: Dhan refused it. Generate a new access token on the Dhan website and paste it into .env and the host's environment."
             if exc.kind == "token" else f"Token: could not check it. {exc.message}")
        return {"ok": False, "steps": steps}
    try:
        dates = expiries("NIFTY 50")
        step(True, f"Data API: subscription active (NIFTY 50 expiries: {', '.join(dates[:3])}{'…' if len(dates) > 3 else ''})")
    except DhanError as exc:
        step(False, "Data API: not subscribed. On the Dhan website, Profile > DhanHQ Trading APIs > Data APIs, subscribe (₹499 + tax a month, or free with 25 trades in 30 days)."
             if exc.kind == "subscription" else f"Data API: the expiry list failed. {exc.message}")
        return {"ok": False, "steps": steps}
    try:
        step(True, f"Price: NIFTY 50 last price from Dhan is {last_price('NIFTY 50'):,.2f}")
    except (DhanError, KeyError, ValueError) as exc:
        step(False, f"Price: the NIFTY 50 price failed. {getattr(exc, 'message', exc)}")
        return {"ok": False, "steps": steps}
    return {"ok": True, "steps": steps}


# ---------------------------------------------------------------- small cache, so Dhan's rate limits are respected

_cache: dict = {}
_cache_lock = threading.Lock()
_cache_making: dict = {}  # key -> an Event while one caller remakes the value: whoever else asks meanwhile waits for it


def cached(key: tuple, ttl: float, make):
    """The value for key, remade at most once per ttl seconds, by one caller at a time: whoever else asks while it
    is being remade waits for that value instead of asking Dhan again (the page and the server's watcher both read
    the option chain; two reads back to back would cost a 3 s gap each, and Dhan's limit)."""
    while True:
        with _cache_lock:
            hit = _cache.get(key)
            if hit and hit[0] > time.monotonic():
                return hit[1]
            making = _cache_making.get(key)
            mine = making is None
            if mine:
                making = _cache_making[key] = threading.Event()
        if not mine:
            making.wait(30)  # the value is there now, or the maker failed: then whoever comes first remakes it
            continue
        try:
            value = make()
            with _cache_lock:
                _cache[key] = (time.monotonic() + ttl, value)
            return value
        finally:
            with _cache_lock:
                _cache_making.pop(key, None)
            making.set()


def today_ist() -> date:
    return datetime.now(IST).date()


# ---------------------------------------------------------------- index candles and quotes

def _bars(body: dict) -> list:
    """Dhan answers a chart request as columns: open[], high[], low[], close[], timestamp[] (epoch seconds)."""
    cols = body.get("data") if isinstance(body.get("data"), dict) and "open" in body["data"] else body
    try:
        times, opens, highs, lows, closes = (cols[k] for k in ("timestamp", "open", "high", "low", "close"))
    except (KeyError, TypeError) as exc:
        raise DhanError("other", f"unexpected chart answer from Dhan: {str(body)[:160]}") from exc
    bars = []
    for t, o, h, l, c in zip(times, opens, highs, lows, closes):
        if None in (t, o, h, l, c):
            continue
        bars.append({"time": int(t), "open": round(float(o), 2), "high": round(float(h), 2), "low": round(float(l), 2), "close": round(float(c), 2)})
    bars.sort(key=lambda b: b["time"])
    return bars


def _chart(path: str, name: str, extra: dict, days_back: int) -> list:
    """A chart request for the last days_back days. Dhan's toDate has been exclusive in some versions,
    so tomorrow is asked for first; if Dhan refuses the date, today is tried."""
    start = (today_ist() - timedelta(days=days_back)).isoformat()
    base = {"securityId": str(QUOTE_IDS[name]), "exchangeSegment": SEGMENT, "instrument": "INDEX", "oi": False, "fromDate": start, **extra}
    try:
        return _bars(call("POST", path, {**base, "toDate": (today_ist() + timedelta(days=1)).isoformat()}))
    except DhanError as exc:
        if exc.kind != "other" or "date" not in exc.message.lower():
            raise
        return _bars(call("POST", path, {**base, "toDate": today_ist().isoformat()}))


SESSION_OPEN, SESSION_CLOSE = (9, 15), (15, 30)   # NSE hours, IST: an index has no candle outside them


def in_session(bar: dict) -> bool:
    """Dhan has been seen to add a bar stamped after the close (18:45) carrying the latest value;
    it is not a candle, so only bars inside market hours are kept."""
    t = datetime.fromtimestamp(bar["time"], IST)
    return SESSION_OPEN <= (t.hour, t.minute) < SESSION_CLOSE


def last_trade_time(candles: list, minutes: int) -> tuple:
    """(when the last price is from, whether the market trades now). While it trades (a candle of today
    exists and it is market hours) the price is as of now; otherwise it is from the end of the last candle,
    so a closed market is not stamped with the clock."""
    now = datetime.now(IST)
    if candles:
        last = datetime.fromtimestamp(candles[-1]["time"], IST)
        if last.date() == now.date() and now.weekday() < 5 and SESSION_OPEN <= (now.hour, now.minute) < SESSION_CLOSE:
            return now.isoformat(timespec="seconds"), True
        close = last.replace(hour=SESSION_CLOSE[0], minute=SESSION_CLOSE[1], second=0, microsecond=0)
        return min(last + timedelta(minutes=minutes), close).isoformat(timespec="seconds"), False
    return now.isoformat(timespec="seconds"), False


def fold(bars: list, seconds: int) -> list:
    """Smaller candles folded into candles of `seconds`, each starting where bucket_start says."""
    out = []
    for b in bars:
        start = bucket_start(b["time"], seconds)
        if out and out[-1]["time"] == start:
            last = out[-1]
            last["high"], last["low"], last["close"] = max(last["high"], b["high"]), min(last["low"], b["low"]), b["close"]
        else:
            out.append({**b, "time": start})
    return out


def intraday(name: str, minutes: int, days_back: int = 8) -> list:
    """Minute candles of an index inside market hours, oldest first, refreshed at most every 10 s.
    Dhan has no 30-minute candles: two 15-minute ones make one, from 9:15."""
    if minutes == 30:
        return cached(("intraday", name, 30), 10, lambda: fold(intraday(name, 15, days_back), 1800))
    return cached(("intraday", name, minutes), 10,
                  lambda: [b for b in _chart("/charts/intraday", name, {"interval": str(minutes)}, days_back) if in_session(b)])


def daily(name: str, days_back: int = 45) -> list:
    """Daily candles of an index, oldest first, each stamped at its day's 9:15, refreshed at most every 5 min."""
    return cached(("daily", name, days_back), 300,
                  lambda: [{**b, "time": bucket_start(b["time"], 86400)} for b in _chart("/charts/historical", name, {"expiryCode": 0}, days_back)])


def quote(name: str) -> dict:
    """{"last_price": ..., "ohlc": {...}} for an index, refreshed at most every 3 s."""
    def make():
        body = call("POST", "/marketfeed/ohlc", {SEGMENT: [QUOTE_IDS[name]]})
        try:
            return body["data"][SEGMENT][str(QUOTE_IDS[name])]
        except (KeyError, TypeError) as exc:
            raise DhanError("other", f"unexpected quote answer from Dhan: {str(body)[:160]}") from exc
    return cached(("quote", name), 3, make)


def previous_day(name: str, all_candles: list) -> dict | None:
    """The last session before today as the index page's "previous day" levels take it: Dhan's daily bar, or, when
    the daily list lags (today's bar arrives after the close, sometimes later), the session built from its candles.
    The same list fetch_detail hands the page as "days"."""
    today = today_ist()
    bar_date = lambda bar: datetime.fromtimestamp(bar["time"], IST).date()
    sessions = sorted({bar_date(b) for b in all_candles})
    days = list(daily(name))
    known = {bar_date(d) for d in days}
    for day in sessions:
        if day not in known:
            bars = [b for b in all_candles if bar_date(b) == day]
            days.append({"time": bars[0]["time"], "open": bars[0]["open"], "high": max(b["high"] for b in bars), "low": min(b["low"] for b in bars), "close": bars[-1]["close"]})
    days.sort(key=lambda d: d["time"])
    before = [d for d in days if bar_date(d) < today]
    return before[-1] if before else None


def previous_close(name: str) -> float | None:
    """The last session's close before today, as the index page measures the day's change (previous_day: Dhan's daily
    bar, or the session built from the candles when the list lags). The dashboard's tiles measure against it too, so
    a tile and its page always agree: Yahoo's previous close, used for the tiles until 7 October, was another day's
    and gave the change the wrong sign. Refreshed at most every minute."""
    def make():
        previous = previous_day(name, intraday(name, 5))
        return previous["close"] if previous else None
    return cached(("previous_close", name), 60, make)


def fetch_detail(name: str, range_key: str, interval_key: str, intervals: dict, ranges: dict, last_price: float | None = None) -> dict:
    """The index page's detail, in the same shape as the Yahoo one, from Dhan in real time. With last_price given
    (the live price the server already holds from the stream or the poll) no quote request is made: that request
    shares Dhan's one-a-second allowance with the price poll."""
    seconds = intervals[interval_key]["bar_seconds"]
    minutes = 5 if seconds >= 86400 else seconds // 60  # day candles come from the daily list; 5-minute candles fill in today
    all_candles = intraday(name, minutes)
    today = today_ist()
    bar_date = lambda bar: datetime.fromtimestamp(bar["time"], IST).date()
    sessions = sorted({bar_date(b) for b in all_candles})

    def with_recent(day_list: list) -> list:
        """Dhan's daily list can lag a session (today's bar arrives after the close, sometimes later), so any
        session the candles know and the list lacks is built from its candles."""
        known = {bar_date(d) for d in day_list}
        out = list(day_list)
        for day in sessions:
            if day not in known:
                bars = [b for b in all_candles if bar_date(b) == day]
                out.append({"time": bars[0]["time"], "open": bars[0]["open"], "high": max(b["high"] for b in bars),
                            "low": min(b["low"] for b in bars), "close": bars[-1]["close"]})
        out.sort(key=lambda d: d["time"])
        return out

    days = with_recent(daily(name))
    year = with_recent(cached(("year", name), 3600, lambda: daily(name, 370)))
    if seconds >= 86400:
        candles = year[-ranges[range_key]["days"]:]
    elif range_key == "today":
        candles = [b for b in all_candles if bar_date(b) == today]
    else:
        keep = set(sessions[-ranges[range_key]["days"]:])
        candles = [b for b in all_candles if bar_date(b) in keep]
    previous_days = [d for d in days if bar_date(d) < today]
    previous = previous_days[-1] if previous_days else None
    todays = [b for b in all_candles if bar_date(b) == today]
    q = {"last_price": last_price} if last_price else quote(name)
    last = float(q.get("last_price") or (todays[-1]["close"] if todays else (previous["close"] if previous else 0)))
    previous_close = previous["close"] if previous else last
    # The change is always against the previous session's close: the same close the card shows, and the same
    # sum the page does on every tick. (Until 7 October, before the first candle of the day it was taken against
    # the close before that one, so the pre-open and the first minutes showed a change against the wrong day.)
    change = round(last - previous_close, 2)
    stamp, open_now = last_trade_time(all_candles, minutes)
    summary = {
        "previous_open": previous["open"] if previous else None,
        "previous_high": previous["high"] if previous else None,
        "previous_low": previous["low"] if previous else None,
        "previous_close": previous_close,
        "today_open": todays[0]["open"] if todays else None,
        "today_high": max(b["high"] for b in todays) if todays else None,
        "today_low": min(b["low"] for b in todays) if todays else None,
        "last": round(last, 2),
        "change": change,
        "change_percent": round(change / previous_close * 100, 2) if previous_close else 0.0,
        "week52_high": max((d["high"] for d in year), default=None),
        "week52_low": min((d["low"] for d in year), default=None),
        "time": stamp,
        "open": open_now,  # the market trades now: the page shows the price as of its time, else "closed" and when it is from
    }
    return {
        "name": name,
        "ticker": f"dhan:{QUOTE_IDS[name]}",
        "range": range_key,
        "interval": interval_key,
        "summary": summary,
        "candles": candles,
        "days": [{"date": bar_date(d).isoformat(), "open": d["open"], "high": d["high"], "low": d["low"], "close": d["close"]} for d in days],
    }


# ---------------------------------------------------------------- the instrument list: the options' security ids

def _parse_expiry(text: str):
    """Dhan's instrument list writes the expiry as a date, sometimes with a time after it."""
    head = text.strip()[:10]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d-%b-%Y"):
        try:
            return datetime.strptime(head, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _read_option_ids() -> dict:
    """{(underlying, expiry iso, strike, side): security id} for the indices' options still to expire, read from
    Dhan's instrument list (a large CSV; only the option rows of NIFTY and BANKNIFTY are kept)."""
    found, columns = {}, None
    wanted = set(UNDERLYING.values())
    index_rows = set(LIST_NAMES.values())
    seen_index = {}  # the list's own ids of the indices (checked against QUOTE_IDS: a wrong id would show another instrument's price)
    today = today_ist().isoformat()
    try:
        with httpx.stream("GET", SCRIP_MASTER_URL, timeout=180, follow_redirects=True) as response:
            response.raise_for_status()
            for row in csv.reader(response.iter_lines()):
                if columns is None:  # the header: the columns are found by what their names contain, whatever the exact spelling
                    def col(*needles):
                        for i, name in enumerate(row):
                            if all(n in name.upper() for n in needles):
                                return i
                        return None
                    columns = (col("SECURITY_ID"), col("INSTRUMENT_NAME"), col("EXPIRY_DATE"), col("STRIKE"), col("OPTION_TYPE"),
                               col("SYMBOL_NAME"), col("TRADING_SYMBOL"), col("EXCH_ID"))
                    if None in columns[:5]:
                        raise DhanError("other", f"Dhan's instrument list has an unexpected header: {', '.join(row)[:160]}")
                    continue
                sid, instrument, expiry, strike, side, symbol, trading, exchange = (row[i] if i is not None and i < len(row) else "" for i in columns)
                if instrument.strip().upper() == "INDEX":
                    label = (symbol.strip() or trading.strip()).upper()
                    if label in index_rows and label not in seen_index:
                        try:
                            seen_index[label] = int(float(sid))
                        except ValueError:
                            pass
                    continue
                if instrument.strip().upper() != "OPTIDX" or (exchange and exchange.strip().upper() != "NSE"):
                    continue
                underlying = symbol.strip().upper() or trading.strip().upper().split("-")[0]
                if underlying not in wanted:
                    continue
                when = _parse_expiry(expiry)
                if not when or when < today:
                    continue
                try:
                    found[(underlying, when, round(float(strike), 2), side.strip().upper())] = int(float(sid))
                except ValueError:
                    continue
    except httpx.HTTPError as exc:
        raise DhanError("network", f"Dhan's instrument list could not be fetched ({type(exc).__name__}: {str(exc)[:100]})") from exc
    if not found:
        raise DhanError("other", "Dhan's instrument list had no NIFTY or BANKNIFTY options in it")
    with _option_ids_lock:
        _index_ids_seen.update(seen_index)
    if problem := id_problem():
        log.warning("Dhan ids: %s", problem)
    return found


_index_ids_seen: dict = {}  # the instrument list's ids of the index rows, by the list's name (NIFTY, BANKNIFTY, SENSEX), once read


def id_problem() -> str | None:
    """The ids this code uses for the indices (QUOTE_IDS) against Dhan's own instrument list, once it has been read:
    None, or what differs. A wrong id would show another instrument's price under an index's name, so /health says."""
    with _option_ids_lock:
        seen = dict(_index_ids_seen)
    wrong = [f"{name} is {seen[LIST_NAMES[name]]}, not {sid}" for name, sid in QUOTE_IDS.items()
             if LIST_NAMES[name] in seen and seen[LIST_NAMES[name]] != sid]
    return "Dhan's instrument list says " + "; ".join(wrong) if wrong else None


_option_ids = {"value": None, "until": 0.0, "busy": False}
_option_ids_lock = threading.Lock()


def _refresh_option_ids() -> None:
    """Reads the list (a large download) in a thread of its own; never raises."""
    try:
        value, ttl = _read_option_ids(), 6 * 3600
    except DhanError as exc:
        value, ttl = exc, 600
    except Exception as exc:  # whatever happens, the list is never left stuck "busy"
        value, ttl = DhanError("other", f"Dhan's instrument list could not be read ({type(exc).__name__}: {str(exc)[:100]})"), 600
    with _option_ids_lock:
        _option_ids.update(value=value, until=time.monotonic() + ttl, busy=False)


def option_ids() -> dict:
    """The instrument list's option ids as read so far. The read itself (a large download, up to minutes on a
    slow line) runs in a thread of its own, started here when the list is missing or older than 6 hours (10
    minutes after a failure), so no request ever waits for it: on 6 October requests waiting on that download
    used up the server's worker threads and the whole page stalled. Until the first read lands this raises,
    and the premiums come from the option chain meanwhile; a stale list is used while a fresh one is read."""
    with _option_ids_lock:
        if time.monotonic() >= _option_ids["until"] and not _option_ids["busy"]:
            _option_ids["busy"] = True
            threading.Thread(target=_refresh_option_ids, name="dhan-instrument-list", daemon=True).start()
        value = _option_ids["value"]
    if value is None:
        raise DhanError("other", "Dhan's instrument list is still being read")
    if isinstance(value, DhanError):
        raise value
    return value


def option_security_id(name: str, expiry: str, strike: float, side: str) -> int | None:
    """The security id of one option contract, or None if the instrument list does not know it."""
    return option_ids().get((UNDERLYING[name], expiry, round(float(strike), 2), side))


# ---------------------------------------------------------------- the option chain

def nearest_expiry(name: str) -> str:
    """The soonest expiry on or after today, as YYYY-MM-DD (weekly for NIFTY 50, monthly where that is all there is)."""
    def make():
        dates = [d for d in expiries(name) if d >= today_ist().isoformat()]
        if not dates:
            raise DhanError("other", f"Dhan listed no coming expiry for {name}")
        return dates[0]
    return cached(("expiry", name), 1800, make)


def chain(name: str, expiry: str) -> dict:
    """{"underlying": index level, "strikes": {strike: {"CE": premium, "PE": premium}}}, refreshed at most every 5 s
    (Dhan allows one option-chain request per 3 s). A failed read is kept for those 5 s too, so a chain that
    cannot be read is not asked again at once by every refresh, which would keep Dhan's rate limit tripping."""
    def make():
        try:
            return read()
        except DhanError as exc:
            return exc
    def read():
        body = call("POST", "/optionchain", {"UnderlyingScrip": INDEX_IDS[name], "UnderlyingSeg": SEGMENT, "Expiry": expiry})
        data = body.get("data") or {}
        strikes = {}
        for strike, sides in (data.get("oc") or {}).items():
            try:
                row = {}
                for side in ("CE", "PE"):
                    leg = sides.get(side.lower()) or {}
                    if leg.get("last_price") is not None:
                        row[side] = round(float(leg["last_price"]), 2)
                if row:
                    strikes[round(float(strike), 2)] = row
            except (TypeError, ValueError):
                continue
        if not strikes:
            raise DhanError("other", f"unexpected option chain answer from Dhan: {str(body)[:160]}")
        return {"underlying": float(data.get("last_price") or 0), "strikes": strikes, "expiry": expiry, "time": datetime.now(IST).isoformat(timespec="seconds")}
    result = cached(("chain", name, expiry), 5, make)
    if isinstance(result, DhanError):
        raise result
    return result


def itm_strike(strikes: dict, side: str, level: float) -> float | None:
    """The owner's choice: one strike in the money. CE: the first strike below the index; PE: the first above."""
    have = [k for k, row in strikes.items() if side in row]
    below = [k for k in have if k < level]
    above = [k for k in have if k > level]
    if side == "CE":
        return max(below) if below else None
    return min(above) if above else None


# ---------------------------------------------------------------- the record of each paper call's option

_records: dict = {}   # key -> record
_records_lock = threading.Lock()
_records_version = 0  # bumped when a record is made, gets its contract id, its Sell mark or its end (not on a premium tick):
                      # study.py pushes the day's records to the data branch when it changes, so a restart loses none


def records_version() -> int:
    return _records_version


def _changed() -> None:
    global _records_version
    _records_version += 1


def records_text(day_iso: str) -> str | None:
    """The records of the calls that entered on that day, as JSON text for the data branch; None when there are none."""
    with _records_lock:
        day = sorted((r for r in _records.values() if r["paid_at"][:10] == day_iso), key=lambda r: r["paid_at"])
    return json.dumps(day, indent=1) + "\n" if day else None


def restore_records(text: str) -> int:
    """Records fetched from the data branch after a restart: those this server lacks are taken as they were, so the
    premium paid, the sell line, the Sell mark and the end stay what they were. Returns how many came back."""
    try:
        data = json.loads(text)
    except ValueError:
        return 0
    got = 0
    with _records_lock:
        for r in data if isinstance(data, list) else []:
            if not (isinstance(r, dict) and r.get("key") and r.get("paid_at")):
                continue
            local = _records.get(r["key"])
            if local is None or r["paid_at"] < local.get("paid_at", ""):  # the older record is the true one: a page that sent its
                _records[r["key"]] = r                                   # open call again in the seconds before the fetch made a new one
                got += 1
        if got:
            _save_records()
    if got:
        _changed()
    return got


def _load_records() -> None:
    try:
        data = json.loads(RECORDS_FILE.read_text())
        _records.update({r["key"]: r for r in data if isinstance(r, dict) and "key" in r})
    except (OSError, ValueError):
        pass


def _save_records() -> None:
    try:
        RECORDS_FILE.write_text(json.dumps(list(_records.values()), indent=1))
    except OSError:
        pass


_load_records()


def record_of(key: str) -> dict | None:
    """One call's record as the page shows it, or None."""
    with _records_lock:
        rec = _records.get(key)
        return dict(rec) if rec else None


def records_for(name: str) -> list:
    """Today's records of an index, as the page shows them."""
    today = today_ist().isoformat()
    with _records_lock:
        return [dict(r) for r in _records.values() if r["index"] == name and r["paid_at"][:10] == today]


def register_call(name: str, key: str, side: str, index_at_entry: float) -> dict:
    """Records the option behind a call the page has seen enter: the one-strike-in-the-money contract on the
    nearest expiry, and its premium now, which is the premium paid. Asked again for the same key, returns
    the record as it is."""
    with _records_lock:
        if key in _records:
            return dict(_records[key])
    expiry = nearest_expiry(name)
    ch = chain(name, expiry)
    strike = itm_strike(ch["strikes"], side, float(index_at_entry))
    if strike is None:
        raise DhanError("other", f"no {side} strike one step in the money of {index_at_entry} in Dhan's chain")
    premium = ch["strikes"][strike][side]
    now = datetime.now(IST).isoformat(timespec="seconds")
    record = {"key": key, "index": name, "side": side, "expiry": expiry, "strike": strike, "index_at_entry": float(index_at_entry),
              "premium_paid": premium, "paid_at": now, "premium_now": premium, "now_at": now, "sell_below": round(premium * SELL_SHARE, 2),
              "sold": None, "ended": None, "security_id": None}  # the id is filled in by fill_ids, so the premium is recorded at once
    with _records_lock:
        if key in _records:  # the page and the server's watcher may both have asked in the same second: the first record stands
            return dict(_records[key])
        _records[key] = record
        _save_records()
    _changed()
    return dict(record)


def note_premium(key: str, premium: float, when: str | None = None) -> dict | None:
    """The premium now for one record, from the feed, the poll or the chain, and the Sell mark the first time
    it is at or below the sell point. The mark stays. Returns the record as the page shows it, or None."""
    premium = round(float(premium), 2)
    with _records_lock:
        rec = _records.get(key)
        if not rec or rec["ended"]:
            return None
        rec["premium_now"], rec["now_at"] = premium, when or datetime.now(IST).isoformat(timespec="seconds")
        if rec["sold"] is None and premium <= rec["sell_below"]:
            rec["sold"] = {"premium": premium, "at": rec["now_at"]}
            _changed()
        return dict(rec)


def save_records() -> None:
    with _records_lock:
        _save_records()


def open_options(names: list) -> dict:
    """{security id: [record keys]} for today's open calls of the indices named, where the contract's id is known. One
    contract may stand behind several records (the same call under two levels modes, the page's and the watcher's)."""
    today = today_ist().isoformat()
    out: dict = {}
    with _records_lock:
        for r in _records.values():
            if r["index"] in names and not r["ended"] and r["paid_at"][:10] == today and r.get("security_id"):
                out.setdefault(r["security_id"], []).append(r["key"])
    return out


def fill_ids(name: str) -> None:
    """Looks up the security id of every open record still without one (the instrument list is read the first time)."""
    with _records_lock:
        missing = [dict(r) for r in _records.values() if r["index"] == name and not r["ended"] and not r.get("security_id")]
    for r in missing:
        sid = option_security_id(name, r["expiry"], r["strike"], r["side"])  # may raise: the caller says why
        if sid:
            with _records_lock:
                if r["key"] in _records:
                    _records[r["key"]]["security_id"] = sid
            _changed()


def _fresh(rec: dict, seconds: float = 5) -> bool:
    """Whether the record's premium was read within the last few seconds (by the feed or the poll)."""
    try:
        return (datetime.now(IST) - datetime.fromisoformat(rec["now_at"])).total_seconds() < seconds
    except (KeyError, ValueError, TypeError):
        return False


def refresh_records(name: str) -> str | None:
    """Keeps the premium now of every open record of the index current: a record the feed or the poll has just
    updated is left alone; the others are read from the option chain. Returns None, or why a premium could not
    be read this time (the record then keeps its last premium)."""
    todays = [r for r in records_for(name) if not r["ended"]]
    if not todays:
        return None
    problem = None
    try:
        fill_ids(name)
    except DhanError:
        pass  # no instrument list yet: the chain below carries the premiums until it lands
    for r in todays:
        if _fresh(r):
            continue
        try:
            premium = chain(name, r["expiry"])["strikes"][r["strike"]][r["side"]]
        except DhanError as exc:
            problem = exc.message
            continue
        except KeyError:
            problem = f"Dhan's option chain carries no price for {int(r['strike'])} {r['side']} {r['expiry']} right now"
            continue
        note_premium(r["key"], premium)
    save_records()
    return problem


def end_call(key: str, how: str) -> dict | None:
    """The page says the call ended (target or day end); the record keeps its last premium."""
    with _records_lock:
        rec = _records.get(key)
        if rec and not rec["ended"]:
            rec["ended"] = {"how": how, "at": datetime.now(IST).isoformat(timespec="seconds")}
            _save_records()
            _changed()
        return dict(rec) if rec else None


def end_day(day: str) -> int:
    """Nothing carries overnight (LOGIC.md): once the day's final copy is saved, every record of that day still open is
    marked ended at the day end. The page and the watcher mark the calls they see; a record neither matches any more
    (on 7 October: those made under the call keys of earlier versions, and the page's held-mode calls after the page
    had moved on) would otherwise stay open for ever. Returns how many were marked."""
    marked = 0
    with _records_lock:
        for rec in _records.values():
            if not rec["ended"] and rec["paid_at"][:10] == day:
                rec["ended"] = {"how": "day end", "at": datetime.now(IST).isoformat(timespec="seconds")}
                marked += 1
        if marked:
            _save_records()
            _changed()
    return marked


def deep_checks() -> list:
    """After status() passes: the candles, the daily bars and the option chain, each as one plain sentence."""
    steps = []
    name = "NIFTY 50"
    try:
        raw = _chart("/charts/intraday", name, {"interval": "5"}, 8)
        bars = [b for b in raw if in_session(b)]
        todays = [b for b in bars if datetime.fromtimestamp(b["time"], IST).date() == today_ist()]
        when = lambda b: datetime.fromtimestamp(b["time"], IST).strftime("%d %b %H:%M")
        dropped = [b for b in raw if not in_session(b)]
        steps.append({"ok": True, "text": f"Candles: {len(bars)} five-minute candles over the last days"
                      + (f", {len(todays)} today from {when(todays[0])[-5:]} to {when(todays[-1])[-5:]} IST (the first should read 09:15)" if todays else ", none today yet (market closed or not open)")
                      + f". Last three: " + ", ".join(f"{when(b)} close {b['close']:,.2f}" for b in bars[-3:])
                      + (f". Dropped {len(dropped)} outside market hours, e.g. {when(dropped[-1])} close {dropped[-1]['close']:,.2f}" if dropped else "")})
    except (DhanError, KeyError, ValueError) as exc:
        steps.append({"ok": False, "text": f"Candles: failed. {getattr(exc, 'message', exc)}"})
    try:
        days = daily(name)
        steps.append({"ok": True, "text": f"Daily bars: {len(days)} days, the last {datetime.fromtimestamp(days[-1]['time'], IST).date()} close {days[-1]['close']:,.2f}"})
    except (DhanError, KeyError, ValueError, IndexError) as exc:
        steps.append({"ok": False, "text": f"Daily bars: failed. {getattr(exc, 'message', exc)}"})
    try:
        expiry = nearest_expiry(name)
        ch = chain(name, expiry)
        level = ch["underlying"] or last_price(name)
        ce, pe = itm_strike(ch["strikes"], "CE", level), itm_strike(ch["strikes"], "PE", level)
        steps.append({"ok": True, "text": f"Option chain: expiry {expiry}, {len(ch['strikes'])} strikes, index {level:,.2f}; one strike in the money: "
                      f"{ce:,.0f} CE at {ch['strikes'][ce]['CE']:,.2f}, {pe:,.0f} PE at {ch['strikes'][pe]['PE']:,.2f}"})
    except (DhanError, KeyError, ValueError, TypeError) as exc:
        steps.append({"ok": False, "text": f"Option chain: failed. {getattr(exc, 'message', exc)}"})
    return steps
