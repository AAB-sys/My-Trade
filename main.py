import asyncio
import json
import struct
from datetime import datetime
import contextlib
import hashlib
import hmac
import logging
import os
import secrets
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import websockets

import dhan
from providers import INDICES, INTERVALS, RANGES, DemoTicker, fetch_all_yahoo, fetch_detail_yahoo, now_ist

BASE = Path(__file__).parent
STATIC = BASE / "static"
NO_CACHE = {"Cache-Control": "no-cache"}
log = logging.getLogger("my-trade")


def load_dotenv(path: Path = BASE / ".env") -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


load_dotenv()
PROVIDER = os.environ.get("DATA_PROVIDER", "yahoo").lower()
POLL_SECONDS = float(os.environ.get("POLL_SECONDS", "1" if PROVIDER == "demo" else "60"))
PASSWORD = os.environ.get("DASHBOARD_PASSWORD", "")
AUTH_ENABLED = bool(PASSWORD)
SESSION_SECRET = os.environ.get("SESSION_SECRET") or secrets.token_hex(32)
SESSION_DAYS = 30  # hard ceiling on a login, for a browser that is never closed
GRACE_SECONDS = 30  # a handover (a reload, a tile opening a new tab, a fresh login) must be taken up within this
BEAT_SECONDS = 15   # pages report in this often when they are in front
# A page in a background tab reports in only about once a minute (browsers slow it down), and a
# phone's browser stops it altogether while another app is in front. So a page counts as open
# while its connection is up, or for OPEN_SECONDS after its last report; and it is forgotten
# only after DROP_SECONDS of silence. A fresh tab still needs the password (the tab note).
OPEN_SECONDS = float(os.environ.get("DASHBOARD_OPEN_SECONDS", "600"))      # 10 minutes
DROP_SECONDS = float(os.environ.get("DASHBOARD_DROP_SECONDS", str(4 * 3600)))  # 4 hours
COOKIE = "my_trade_session"
OPEN_PATHS = ("/login", "/logout", "/health", "/static/")

if PROVIDER == "yahoo":
    fetch_all = fetch_all_yahoo
    fetch_detail = fetch_detail_yahoo
elif PROVIDER == "demo":
    demo = DemoTicker()
    fetch_all = demo.fetch_all
    fetch_detail = lambda name, ticker, range_key, interval_key: demo.fetch_detail(name, range_key, interval_key)
else:
    raise SystemExit(f"Unknown DATA_PROVIDER '{PROVIDER}'. Use yahoo or demo.")

# Dhan, the owner's broker API: real-time candles, quotes and option premiums for the indices it
# covers (dhan.INDEX_IDS), when its two settings are present and the source is the real one.
# Everything else, and every Dhan failure, falls back to the source above.
DHAN_ON = PROVIDER == "yahoo" and dhan.configured()
DHAN_POLL_SECONDS = float(os.environ.get("DHAN_POLL_SECONDS", "15"))
TICK_SECONDS = float(os.environ.get("DHAN_TICK_SECONDS", "1"))   # the fallback: the last price once a second
TICK_ALWAYS = os.environ.get("DHAN_TICK_ALWAYS") == "1"           # for tests: tick outside market hours too
DHAN_FEED_URL = os.environ.get("DHAN_FEED_URL", "wss://api-feed.dhan.co")  # Dhan's tick-by-tick stream; overridden only by tests
FEED_CODES = {805: "too many connections to Dhan's feed", 806: "the Data API is not subscribed", 807: "the token has expired",
              808: "the client id is wrong", 809: "Dhan refused the login"}

# The latest prices, kept in memory and refreshed by the background loop below.
store = {
    "source": PROVIDER,
    "simulated": PROVIDER == "demo",
    "poll_seconds": POLL_SECONDS,
    "auth_enabled": AUTH_ENABLED,
    "updated_at": None,
    "quotes": [],
    "failed": [],
    "last_error": None,  # why the latest refresh brought nothing, for the page to show while it waits
    "dhan": {  # the broker feed's state, in plain words, for the index page
        "configured": dhan.configured(),
        "active": False,
        "status": ("Dhan: not tried yet" if DHAN_ON else
                   "Dhan: off in demo mode" if PROVIDER == "demo" else
                   "Dhan: not set up. Add DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN to .env or the host's environment."),
        "at": None,
        "stream": "",  # the tick-by-tick stream's state, in plain words
    },
}
stream_at = 0.0  # when the last tick came over the stream; the one-a-second polling steps in while it is quiet


def dhan_status(active: bool, text: str) -> None:
    store["dhan"].update(active=active, status=text, at=now_ist())


def dhan_reason(exc: Exception) -> str:
    kind = getattr(exc, "kind", "other")
    said = getattr(exc, "message", str(exc))
    if kind == "token":
        return "Dhan: the token was refused, it has probably expired. Generate a fresh one on the Dhan website and paste it into .env and the host's environment."
    if kind == "subscription":
        return "Dhan: the Data API is not subscribed on the account (Dhan website: Profile > DhanHQ Trading APIs > Data APIs)."
    if kind == "network":
        return f"Dhan: could not be reached ({said})."
    if kind == "rate":
        return "Dhan: its rate limit was hit; trying again shortly."
    return f"Dhan: answered something unexpected ({said[:160]})."
clients: set[WebSocket] = set()
detail_cache: dict = {}  # (index name, range) -> (fetched at, payload)
live: dict = {}          # index name -> {"last", "time", "bars": {interval key: the candle forming now, built from ticks}}
live_subs: dict = {}     # websocket -> the index name whose ticks it wants (an index page on Dhan)

# The rule for a login: it lives only while a My-Trade page is open on it, and only a
# page handed over from another page of it may carry it on.
# - Every data request and /ws must carry the login's "tab" note (X-Tab / ?tab=), which
#   the login page keeps in the tab's sessionStorage and a tile passes to the tab it
#   opens. A tab opened anew never has it, so it gets the password page whatever the
#   browser kept.
# - Each page also has a "page" id (X-Page / ?page=), held in the page's memory only,
#   given when it first connects or reports in. A page keeps its login alive by holding
#   /ws or by reporting in every BEAT_SECONDS, and may come back after its connection
#   drops. A page the browser brings back after a restart has no page id.
# - A page without an id is let in only during a handover: opened when a page is served
#   while another page of the login is open (a reload, a tile click), or by the login
#   itself for its first page; used up when the new page gets its id.
# Kept in memory, so a server restart ends every login.
logins: dict[str, dict] = {}  # token -> {"tab", "pages": {page id: {"socket", "dropped_at", "last_beat"}}, "handover_until"}
ws_pages: dict[WebSocket, tuple[str, str]] = {}  # socket -> (token, page id)
PAGE_PATHS = ("/", "/index/", "/docs", "/openapi.json")  # fetched by the browser itself, without the note


# ---------------------------------------------------------------- login

def make_token() -> str:
    issued = str(int(time.time()))
    signature = hmac.new(SESSION_SECRET.encode(), issued.encode(), hashlib.sha256).hexdigest()
    return f"{issued}.{signature}"


def token_ok(token) -> bool:
    if not token or "." not in token:
        return False
    issued, signature = token.split(".", 1)
    expected = hmac.new(SESSION_SECRET.encode(), issued.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected) or not issued.isdigit():
        return False
    return time.time() - int(issued) < SESSION_DAYS * 86400


def page_open(page: dict, now: float) -> bool:
    """Its connection is up, or it was heard from within OPEN_SECONDS and since its latest
    connection dropped (if it did)."""
    if page["socket"] is not None:
        return True
    return now - page["last_beat"] < OPEN_SECONDS and page["last_beat"] > page["dropped_at"]


def find_login(token):
    """The login behind this cookie, or None. Pages gone for DROP_SECONDS are forgotten;
    a login with no page left and no handover open is over."""
    if not token_ok(token):
        return None
    entry = logins.get(token)
    if entry is None:
        return None
    now = time.time()
    for page_id, page in list(entry["pages"].items()):
        if now - page["last_beat"] >= DROP_SECONDS:
            del entry["pages"][page_id]
    if not entry["pages"] and now >= entry["handover_until"]:
        del logins[token]
        return None
    return entry


def page_of(connection, entry) -> str:
    """The known page this request comes from, or ""."""
    page_id = connection.headers.get("x-page") or connection.query_params.get("page") or ""
    return page_id if page_id in entry["pages"] else ""


def new_page(entry) -> str:
    page_id = secrets.token_urlsafe(12)
    entry["pages"][page_id] = {"socket": None, "dropped_at": 0.0, "last_beat": time.time()}
    entry["handover_until"] = 0  # taken up
    return page_id


def logged_in(connection) -> bool:
    """For data requests and /ws: the cookie, the tab note, and then either a page we
    know (it may have dropped; it is still there), another page of the login open, or a
    handover still open."""
    if not AUTH_ENABLED:
        return True
    token = connection.cookies.get(COOKIE)
    entry = find_login(token)
    if entry is None:
        return False
    now = time.time()
    tab = connection.headers.get("x-tab") or connection.query_params.get("tab") or ""
    if not hmac.compare_digest(tab, entry["tab"]):
        entry["handover_until"] = 0  # the page just served was this tab, opened anew, not a reload
        if not any(page_open(p, now) for p in entry["pages"].values()):
            logins.pop(token, None)  # nothing open, and the link opened anew: over
        return False  # a tab opened anew, not one handed over
    page_id = page_of(connection, entry)
    if page_id:
        entry["pages"][page_id]["last_beat"] = now
        return True
    return any(page_open(p, now) for p in entry["pages"].values()) or now < entry["handover_until"]


def page_allowed(request: Request) -> bool:
    """For the HTML pages, which the browser fetches without note or page id: let a page
    of a live login load, and if a page of it is open, open a handover so the new page can
    carry on once the old one has gone. Its first report settles it."""
    if not AUTH_ENABLED:
        return True
    entry = find_login(request.cookies.get(COOKIE))
    if entry is None:
        return False
    now = time.time()
    if any(page_open(p, now) for p in entry["pages"].values()):
        entry["handover_until"] = now + GRACE_SECONDS
    return True


def is_https(request: Request) -> bool:
    return request.headers.get("x-forwarded-proto", request.url.scheme) == "https"


# ---------------------------------------------------------------- refresh loop

async def broadcast(payload: dict) -> None:
    for ws in list(clients):
        try:
            await ws.send_json(payload)
        except Exception:
            clients.discard(ws)


async def refresh_forever() -> None:
    while True:
        try:
            result = await asyncio.to_thread(fetch_all)
            reason = result.get("reason") or ""
            if result["quotes"]:
                if result["failed"]:
                    log.warning("refresh missed %s: %s", result["failed"], reason)
                store.update(quotes=result["quotes"], failed=result["failed"], updated_at=now_ist(), last_error=None)
            else:
                log.warning("refresh returned no quotes: %s; failed=%s", reason, result["failed"])
                store["last_error"] = (f"{PROVIDER} answered nothing for all {len(result['failed'])} indices at {now_ist()[11:19]} IST"
                                       + (f" ({reason})" if reason else ""))
            await broadcast(store)
        except Exception as exc:
            log.warning("refresh failed: %s", exc)
            store["last_error"] = f"{type(exc).__name__}: {exc} at {now_ist()[11:19]} IST"
            await broadcast(store)
        await asyncio.sleep(POLL_SECONDS)


def in_tick_hours() -> bool:
    """NSE hours with a little slack, Monday to Friday, IST."""
    if TICK_ALWAYS:
        return True
    now = datetime.now(dhan.IST)
    return now.weekday() < 5 and (9, 0) <= (now.hour, now.minute) < (15, 45)


def fold_tick(name: str, last: float, now: float, via: str) -> None:
    """One last price into the index's live entry and the 1, 5 and 15-minute candles forming now."""
    entry = live.setdefault(name, {"bars": {}})
    entry.update(last=last, time=now_ist(), via=via)
    for key, spec in INTERVALS.items():
        secs = spec["bar_seconds"]
        bucket = int(now // secs) * secs
        bar = entry["bars"].get(key)
        if bar and bar["time"] == bucket:
            bar["high"], bar["low"], bar["close"] = max(bar["high"], last), min(bar["low"], last), last
        else:
            entry["bars"][key] = {"time": bucket, "open": last, "high": last, "low": last, "close": last}


async def push_tick(name: str) -> None:
    """The index's live entry to every page watching it."""
    for ws, wanted in list(live_subs.items()):
        if wanted == name:
            try:
                await ws.send_json({"tick": {"name": name, **live[name]}})
            except Exception:
                live_subs.pop(ws, None)


async def tick_forever() -> None:
    """The fallback behind the stream: while an index page is open on Dhan during market hours and the
    stream has been quiet for a few seconds, the last price every TICK_SECONDS, one request for all
    watched indices, folded into the candle forming now and pushed to those pages."""
    while True:
        names = sorted(set(live_subs.values()))
        if not (DHAN_ON and names and in_tick_hours()) or time.time() - stream_at < 5:
            await asyncio.sleep(1)
            continue
        try:
            prices = await asyncio.to_thread(dhan.last_prices, names)
        except Exception as exc:
            dhan_status(False, dhan_reason(exc))
            await asyncio.sleep(10)
            continue
        now = time.time()
        for name, last in prices.items():
            fold_tick(name, last, now, "poll")
            await push_tick(name)
        await asyncio.sleep(TICK_SECONDS)


class FeedClosed(Exception):
    """Dhan hung up on purpose (packet type 50), with a reason."""


def feed_packets(raw: bytes, by_id: dict):
    """(index name, last price) for each price packet in one message from Dhan's feed. Packets start
    with a type byte and a 2-byte length; types 2 (ticker), 4 (quote) and 8 (full) carry the last price
    as a float after the 1-byte segment and 4-byte security id; type 50 is Dhan hanging up, with a reason."""
    offset, found = 0, []
    while offset + 8 <= len(raw):
        code, length, _segment, security_id = struct.unpack_from("<BHBI", raw, offset)
        if code == 50:
            reason = struct.unpack_from("<H", raw, offset + 8)[0] if offset + 10 <= len(raw) else 0
            raise FeedClosed(FEED_CODES.get(reason, f"Dhan closed the feed (code {reason})"))
        if code in (2, 4, 8) and offset + 12 <= len(raw):
            last = struct.unpack_from("<f", raw, offset + 8)[0]
            name = by_id.get(security_id)
            if name and last > 0:
                found.append((name, round(last, 2)))
        if length < 8 or offset + length > len(raw):
            break  # one packet per message, or a length we do not trust: stop here
        offset += length
    return found


async def stream_forever() -> None:
    """Dhan's tick-by-tick stream: while an index page on Dhan is open in market hours, one connection
    to the feed, subscribed to every index the broker feed covers. Each ticker packet is folded into
    the candle forming now and pushed to the pages at once, so the price moves as Dhan's own screen
    does. Whenever the stream is quiet, tick_forever's polling steps in."""
    global stream_at
    wait = 2
    by_id = {sid: name for name, sid in dhan.INDEX_IDS.items()}
    while True:
        if not (DHAN_ON and live_subs and in_tick_hours()):
            await asyncio.sleep(2)
            continue
        client_id, token = dhan.settings()
        url = f"{DHAN_FEED_URL}?version=2&token={token}&clientId={client_id}&authType=2"
        try:
            async with websockets.connect(url, ping_interval=20, ping_timeout=20, max_size=1 << 20) as ws:
                await ws.send(json.dumps({"RequestCode": 15, "InstrumentCount": len(by_id),
                                          "InstrumentList": [{"ExchangeSegment": dhan.SEGMENT, "SecurityId": str(sid)} for sid in by_id]}))
                store["dhan"]["stream"] = f"Stream: tick-by-tick from Dhan, connected at {now_ist()[11:19]}"
                wait = 2
                async for raw in ws:
                    if not (live_subs and in_tick_hours()):
                        break  # nobody watching, or the market closed: hang up
                    if not isinstance(raw, (bytes, bytearray)):
                        continue  # Dhan's text acknowledgements
                    now = time.time()
                    for name, last in feed_packets(bytes(raw), by_id):
                        fold_tick(name, last, now, "stream")
                        stream_at = now
                        await push_tick(name)
            store["dhan"]["stream"] = "Stream: off (nobody watching, or the market is closed)"
            continue
        except FeedClosed as exc:  # Dhan hung up on purpose, with a reason: no point hammering it
            store["dhan"]["stream"] = f"Stream: off, {exc}. Prices once a second meanwhile."
            log.warning("Dhan feed closed: %s", exc)
            wait = 60
        except Exception as exc:
            store["dhan"]["stream"] = f"Stream: off ({type(exc).__name__}: {str(exc)[:100]}). Prices once a second meanwhile, trying again in {wait} s."
            log.warning("Dhan feed failed: %s", exc)
        await asyncio.sleep(wait)
        wait = min(wait * 2, 30)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    if not AUTH_ENABLED:
        log.warning("DASHBOARD_PASSWORD is not set: anyone who can reach this server can see the dashboard.")
    tasks = [asyncio.create_task(refresh_forever()), asyncio.create_task(tick_forever()), asyncio.create_task(stream_forever())]
    yield
    for task in tasks:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Indices API", lifespan=lifespan)


@app.middleware("http")
async def require_login(request: Request, call_next):
    path = request.url.path
    is_page = path == "/" or path.startswith(PAGE_PATHS[1:])
    if path.startswith(OPEN_PATHS) or (page_allowed(request) if is_page else logged_in(request)):
        return await call_next(request)
    if "text/html" in request.headers.get("accept", ""):
        return RedirectResponse("/login", status_code=302)
    return JSONResponse({"detail": "Login required."}, status_code=401)


def known_index(name: str) -> str:
    key = name.upper()
    if key not in INDICES:
        raise HTTPException(status_code=404, detail=f"Unknown index '{name}'. See /indices for the list.")
    return key


# ---------------------------------------------------------------- menu

@app.get("/health")
def health():
    return {"status": "ok", "commit": os.environ.get("RENDER_GIT_COMMIT", "")[:7]}  # which version is running


@app.get("/login")
def login_page():
    return FileResponse(STATIC / "login.html", headers=NO_CACHE)


@app.post("/login")
async def login(request: Request):
    if not AUTH_ENABLED:
        return {"ok": True}
    body = await request.json()
    password = str(body.get("password", ""))
    if not secrets.compare_digest(password.encode(), PASSWORD.encode()):
        await asyncio.sleep(1)  # makes guessing slow
        return JSONResponse({"detail": "Wrong password."}, status_code=401)
    for stale in list(logins):
        find_login(stale)  # forgets logins that are over
    token = make_token()
    logins[token] = {"tab": secrets.token_urlsafe(16), "pages": {},
                     "handover_until": time.time() + GRACE_SECONDS}  # the login itself hands over to its first page
    response = JSONResponse({"ok": True, "tab": logins[token]["tab"]})
    # No max_age/expires: a "session" cookie, which the browser drops when it is closed.
    # Browsers are not reliable about that (some keep running in the background), so the
    # server's own rule above is what really ends the login.
    response.set_cookie(
        COOKIE, token,
        httponly=True, samesite="lax", secure=is_https(request),
    )
    return response


@app.post("/logout")
async def logout(request: Request):
    token = request.cookies.get(COOKIE)
    logins.pop(token, None)
    for ws, (ws_token, _) in list(ws_pages.items()):  # every open page on this login, in any tab
        if ws_token == token:
            with contextlib.suppress(Exception):
                await ws.close(code=1008)
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE)
    return response


@app.post("/alive")
def alive(request: Request):
    """Pages report in here every BEAT_SECONDS: it keeps their login alive, gives a new
    page its id, and hands back the latest prices for a page whose /ws is down."""
    page_id = None
    entry = logins.get(request.cookies.get(COOKIE)) if AUTH_ENABLED else None
    if entry is not None:
        page_id = page_of(request, entry) or new_page(entry)
    return {**store, "page": page_id, "beat_seconds": BEAT_SECONDS}


@app.get("/")
def dashboard():
    return FileResponse(STATIC / "index.html", headers=NO_CACHE)


@app.get("/index/{name}")
def index_page(name: str):
    known_index(name)
    return FileResponse(STATIC / "detail.html", headers=NO_CACHE)


@app.get("/indices")
def list_indices():
    return sorted(INDICES)


@app.get("/indices/all")
def all_indices():
    return store


@app.get("/indices/{name}/detail")
async def index_detail(
    name: str,
    range_key: str = Query("today", alias="range"),
    interval_key: str = Query("5m", alias="interval"),
):
    key = known_index(name)
    if range_key not in RANGES:
        raise HTTPException(status_code=400, detail=f"range must be one of: {', '.join(RANGES)}")
    if interval_key not in INTERVALS:
        raise HTTPException(status_code=400, detail=f"interval must be one of: {', '.join(INTERVALS)}")

    if DHAN_ON and key in dhan.INDEX_IDS:  # the broker feed first, real time
        cached = detail_cache.get(("dhan", key, range_key, interval_key))
        if cached and time.monotonic() - cached[0] < DHAN_POLL_SECONDS * 0.7:
            return cached[1]
        try:
            payload = await asyncio.to_thread(dhan.fetch_detail, key, range_key, interval_key, INTERVALS, RANGES)
            dhan_status(True, "Dhan: real-time candles and quotes from your account")
            payload.update(source="dhan", simulated=False, poll_seconds=DHAN_POLL_SECONDS, auth_enabled=AUTH_ENABLED, dhan=store["dhan"])
            detail_cache[("dhan", key, range_key, interval_key)] = (time.monotonic(), payload)
            return payload
        except Exception as exc:
            dhan_status(False, dhan_reason(exc) + f" Prices from {PROVIDER}, about 15 minutes delayed, meanwhile.")
            log.warning("Dhan detail failed for %s, falling back to %s: %s", key, PROVIDER, exc)

    cached = detail_cache.get((key, range_key, interval_key))
    if cached and time.monotonic() - cached[0] < POLL_SECONDS:
        return cached[1]
    try:
        payload = await asyncio.to_thread(fetch_detail, key, INDICES[key], range_key, interval_key)
    except Exception as exc:
        log.warning("detail fetch failed for %s: %s", key, exc)
        raise HTTPException(status_code=502, detail="Couldn't fetch the chart data from the source right now.")
    payload.update(source=PROVIDER, simulated=PROVIDER == "demo", poll_seconds=POLL_SECONDS, auth_enabled=AUTH_ENABLED, dhan=store["dhan"])
    detail_cache[(key, range_key, interval_key)] = (time.monotonic(), payload)
    return payload


# ---------------------------------------------------------------- the option behind each paper call (Dhan)
# The page runs the owner's rule and tells the server when a call enters and when it ends; the server
# records the contract and the premium paid, reads the premium now, and keeps the Sell mark (LOGIC.md).

@app.get("/options/{name}")
async def options_state(name: str):
    key = known_index(name)
    if not (DHAN_ON and key in dhan.INDEX_IDS):
        return {"active": False, "status": store["dhan"]["status"], "records": []}
    try:
        await asyncio.to_thread(dhan.refresh_records, key)
        expiry = await asyncio.to_thread(dhan.nearest_expiry, key)
    except Exception as exc:
        dhan_status(False, dhan_reason(exc))
        return {"active": False, "status": store["dhan"]["status"], "records": dhan.records_for(key)}
    return {"active": True, "status": "Dhan: option premiums live from your account", "expiry": expiry,
            "sell_share": dhan.SELL_SHARE, "records": dhan.records_for(key)}


@app.post("/options/{name}/calls")
async def options_register(name: str, request: Request):
    key = known_index(name)
    if not (DHAN_ON and key in dhan.INDEX_IDS):
        raise HTTPException(status_code=409, detail=store["dhan"]["status"])
    body = await request.json()
    call_key, side = str(body.get("key", ""))[:160], str(body.get("side", "")).upper()
    try:
        level = float(body.get("index_at_entry"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="index_at_entry must be a number")
    if not call_key or side not in ("CE", "PE"):
        raise HTTPException(status_code=400, detail="key and side (CE or PE) are required")
    try:
        return await asyncio.to_thread(dhan.register_call, key, call_key, side, level)
    except Exception as exc:
        dhan_status(False, dhan_reason(exc))
        raise HTTPException(status_code=502, detail=store["dhan"]["status"])


@app.post("/options/{name}/calls/ended")
async def options_ended(name: str, request: Request):
    known_index(name)
    body = await request.json()
    record = dhan.end_call(str(body.get("key", ""))[:160], str(body.get("how", ""))[:40])
    if record is None:
        raise HTTPException(status_code=404, detail="no such call recorded")
    return record


@app.get("/indices/{name}")
def get_index(name: str):
    key = known_index(name)
    for quote in store["quotes"]:
        if quote["name"] == key:
            return quote
    raise HTTPException(status_code=503, detail="Prices not loaded yet. Try again in a few seconds.")


@app.websocket("/ws")
async def stream(ws: WebSocket):
    if not logged_in(ws):
        await ws.close(code=1008)
        return
    await ws.accept()
    clients.add(ws)
    page_id = None
    token = ws.cookies.get(COOKIE)
    entry = logins.get(token) if AUTH_ENABLED else None
    if entry is not None:
        page_id = page_of(ws, entry) or new_page(entry)  # a page coming back keeps its id
        entry["pages"][page_id]["socket"] = ws  # its latest connection
        ws_pages[ws] = (token, page_id)
    wanted = ws.query_params.get("live", "").upper()
    if DHAN_ON and wanted in dhan.INDEX_IDS:  # an index page on Dhan: it gets the live ticks of its index
        live_subs[ws] = wanted
    try:
        await ws.send_json({**store, "page": page_id})
        if wanted in live:
            await ws.send_json({"tick": {"name": wanted, **live[wanted]}})
        while True:
            await ws.receive_text()  # keeps the connection open; the pages never send anything useful
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(ws)
        live_subs.pop(ws, None)
        token, page_id = ws_pages.pop(ws, (None, None))
        page = logins.get(token, {}).get("pages", {}).get(page_id)
        if page and page["socket"] is ws:  # an older connection of the page going at last says nothing
            page["socket"] = None
            page["dropped_at"] = time.time()  # the page may come back, or report in, for a while


app.mount("/static", StaticFiles(directory=STATIC), name="static")
