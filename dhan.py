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
import json
import os
import threading
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx

from providers import bucket_start

BASE = os.environ.get("DHAN_API_BASE", "https://api.dhan.co/v2")  # overridden only by tests
SEGMENT = "IDX_I"                                  # Dhan's segment for an index itself
INDEX_IDS = {"NIFTY 50": 13, "NIFTY BANK": 25}     # Dhan's security ids of the indices with options
IST = timezone(timedelta(hours=5, minutes=30))
SELL_SHARE = float(os.environ.get("SELL_SHARE", "0.5"))  # the owner's rule: sell when the premium is at or below this share of what was paid
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


def call(method: str, path: str, payload: dict | None = None) -> dict:
    """One request to Dhan; raises DhanError with a plain reason when it refuses."""
    client_id, token = settings()
    if not (client_id and token):
        raise DhanError("config", "DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN are not both set")
    headers = {"access-token": token, "client-id": client_id, "Accept": "application/json"}
    if payload is not None:
        payload = {**payload, "dhanClientId": client_id}
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
        raise DhanError("rate", f"Dhan's rate limit was hit ({said})")
    if response.status_code >= 400 or code or body.get("status") == "failure":
        raise DhanError("other", f"HTTP {response.status_code} {code} {said}".strip())
    return body


def profile() -> dict:
    return call("GET", "/profile")


def expiries(name: str) -> list[str]:
    """The option expiry dates of an index, soonest first, as YYYY-MM-DD."""
    body = call("POST", "/optionchain/expirylist", {"UnderlyingScrip": INDEX_IDS[name], "UnderlyingSeg": SEGMENT})
    return sorted(str(d) for d in body.get("data", []))


def last_price(name: str) -> float:
    return last_prices([name])[name]


def last_prices(names: list) -> dict:
    """{index name: last price} in one request, not cached: this is the live tick."""
    body = call("POST", "/marketfeed/ltp", {SEGMENT: [INDEX_IDS[n] for n in names]})
    try:
        data = body["data"][SEGMENT]
        return {n: float(data[str(INDEX_IDS[n])]["last_price"]) for n in names if str(INDEX_IDS[n]) in data}
    except (KeyError, TypeError, ValueError) as exc:
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


def cached(key: tuple, ttl: float, make):
    """The value for key, remade at most once per ttl seconds."""
    with _cache_lock:
        hit = _cache.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
    value = make()
    with _cache_lock:
        _cache[key] = (time.monotonic() + ttl, value)
    return value


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
    base = {"securityId": str(INDEX_IDS[name]), "exchangeSegment": SEGMENT, "instrument": "INDEX", "oi": False, "fromDate": start, **extra}
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
        body = call("POST", "/marketfeed/ohlc", {SEGMENT: [INDEX_IDS[name]]})
        try:
            return body["data"][SEGMENT][str(INDEX_IDS[name])]
        except (KeyError, TypeError) as exc:
            raise DhanError("other", f"unexpected quote answer from Dhan: {str(body)[:160]}") from exc
    return cached(("quote", name), 3, make)


def fetch_detail(name: str, range_key: str, interval_key: str, intervals: dict, ranges: dict) -> dict:
    """The index page's detail, in the same shape as the Yahoo one, from Dhan in real time."""
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
    q = quote(name)
    last = float(q.get("last_price") or (todays[-1]["close"] if todays else (previous["close"] if previous else 0)))
    previous_close = previous["close"] if previous else last
    # The change is the day's: against the previous session's close while today trades. Before the open,
    # on a holiday or at the weekend the last price is that close itself, so the change shown is the last
    # session's, against the close before it (as the dashboard tiles show it)
    reference = previous_days[-2] if not todays and len(previous_days) >= 2 else previous
    reference_close = reference["close"] if reference else last
    change = round(last - reference_close, 2)
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
        "change_percent": round(change / reference_close * 100, 2) if reference_close else 0.0,
        "week52_high": max((d["high"] for d in year), default=None),
        "week52_low": min((d["low"] for d in year), default=None),
        "time": stamp,
        "open": open_now,  # the market trades now: the page shows the price as of its time, else "closed" and when it is from
    }
    return {
        "name": name,
        "ticker": f"dhan:{INDEX_IDS[name]}",
        "range": range_key,
        "interval": interval_key,
        "summary": summary,
        "candles": candles,
        "days": [{"date": bar_date(d).isoformat(), "open": d["open"], "high": d["high"], "low": d["low"], "close": d["close"]} for d in days],
    }


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
    (Dhan allows one option-chain request per 3 s)."""
    def make():
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
    return cached(("chain", name, expiry), 5, make)


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
              "sold": None, "ended": None}
    with _records_lock:
        _records[key] = record
        _save_records()
    return dict(record)


def refresh_records(name: str) -> None:
    """Reads the premium now for every open record of the index and marks Sell the first time it is at or
    below the sell point. The mark stays."""
    todays = [r for r in records_for(name) if not r["ended"]]
    if not todays:
        return
    now = datetime.now(IST).isoformat(timespec="seconds")
    for r in todays:
        try:
            premium = chain(name, r["expiry"])["strikes"][r["strike"]][r["side"]]
        except (DhanError, KeyError):
            continue
        with _records_lock:
            rec = _records.get(r["key"])
            if not rec:
                continue
            rec["premium_now"], rec["now_at"] = premium, now
            if rec["sold"] is None and premium <= rec["sell_below"]:
                rec["sold"] = {"premium": premium, "at": now}
    with _records_lock:
        _save_records()


def end_call(key: str, how: str) -> dict | None:
    """The page says the call ended (target or day end); the record keeps its last premium."""
    with _records_lock:
        rec = _records.get(key)
        if rec and not rec["ended"]:
            rec["ended"] = {"how": how, "at": datetime.now(IST).isoformat(timespec="seconds")}
            _save_records()
        return dict(rec) if rec else None


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
