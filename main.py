import asyncio
import json
import struct
from datetime import datetime
import concurrent.futures
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
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
import httpx
import websockets

import dhan
import memwatch
import record
from providers import INDICES, INTERVALS, LONG_INTERVALS, RANGES, DemoTicker, bucket_start, now_ist
import rule

BASE = Path(__file__).parent
STATIC = BASE / "static"
NO_CACHE = {"Cache-Control": "no-cache"}
COMMIT = os.environ.get("RENDER_GIT_COMMIT", "")[:7]  # the code this server runs (Render sets it): /health says it, and the pages reload on a new one
log = logging.getLogger("my-trade")
if not logging.getLogger().handlers:  # under uvicorn the root logger has no handler, so this logger's info lines were dropped: the Call Gate's daily line (23 October) must reach the log
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
log.setLevel(logging.INFO)


def load_dotenv(path: Path = BASE / ".env") -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


load_dotenv()
PROVIDER = os.environ.get("DATA_PROVIDER", "dhan").lower()
if PROVIDER == "yahoo":  # the setting of the Yahoo days (a host's environment may still carry it): Dhan now (19 October)
    PROVIDER = "dhan"
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
OPEN_PATHS = ("/login", "/logout", "/health", "/static/", "/favicon.ico")  # /favicon.ico: the tab icon, asked by browsers that ignore the pages' link (30 October)

# Dhan, the owner's broker API, is the one source of prices (19 October, the owner: "remove yahoo data or yahoo API from
# everywhere. Because we are completely dependent on dhan"): real-time candles and quotes for the three indices (dhan.QUOTE_IDS)
# and option premiums for them (dhan.OPTION_INDICES: NIFTY 50, NIFTY BANK, and SENSEX on the BSE since 8 October), when its two
# settings are present. Without them the dashboard and the pages say so and show no prices; nothing fills in. Until 19 October
# Yahoo Finance, about 15 minutes delayed, was the base source, with Dhan on top of it and every Dhan failure falling back to it.
# "demo" is the simulated ticker, for watching the plumbing with no network at all.
if PROVIDER == "dhan":
    fetch_all = lambda: dhan_fetch_all()  # defined below, after the tiles
    fetch_detail = None
elif PROVIDER == "demo":
    demo = DemoTicker()
    fetch_all = demo.fetch_all
    fetch_detail = lambda name, ticker, range_key, interval_key: demo.fetch_detail(name, range_key, interval_key)
else:
    raise SystemExit(f"Unknown DATA_PROVIDER '{PROVIDER}'. Use dhan or demo.")
DHAN_ON = PROVIDER == "dhan" and dhan.configured()
DHAN_POLL_SECONDS = float(os.environ.get("DHAN_POLL_SECONDS", "15"))
TICK_SECONDS = float(os.environ.get("DHAN_TICK_SECONDS", "1"))   # the fallback: the last price once a second
TICK_ALWAYS = os.environ.get("DHAN_TICK_ALWAYS") == "1"           # for tests: tick outside market hours too
# Keep-awake (8 October): Render's free plan puts the server to sleep after 15 minutes without an incoming request, and the
# watcher that records the calls sleeps with it. That morning, with no page open, it slept from about 08:20 until a check
# woke it at 09:21. In market hours the server now calls its own public address every few minutes, which counts as an
# incoming request; .github/workflows/keepawake.yml knocks too and wakes it before the open.
SELF_URL = os.environ.get("KEEP_AWAKE_URL") or os.environ.get("RENDER_EXTERNAL_URL", "")  # Render sets RENDER_EXTERNAL_URL itself
KEEP_AWAKE_SECONDS = float(os.environ.get("KEEP_AWAKE_SECONDS", "300"))
DHAN_FEED_URL = os.environ.get("DHAN_FEED_URL", "wss://api-feed.dhan.co")  # Dhan's tick-by-tick stream; overridden only by tests
FEED_CODES = {805: "too many connections to Dhan's feed", 806: "the Data API is not subscribed", 807: "the token has expired",
              808: "the client id is wrong", 809: "Dhan refused the login"}

# The latest prices, kept in memory and refreshed by the background loop below.
store = {
    "source": PROVIDER,
    "simulated": PROVIDER == "demo",
    "poll_seconds": POLL_SECONDS,
    "auth_enabled": AUTH_ENABLED,
    "commit": COMMIT,  # every answer carries it: an open page reloads itself when the server comes up with new code
    "updated_at": None,
    "quotes": [],
    "failed": [],
    "last_error": None,  # why the latest refresh brought nothing, for the page to show while it waits
    "dhan": {  # the broker feed's state, in plain words, for the index page
        "configured": dhan.configured(),
        "active": False,
        "status": ("Dhan: not tried yet" if DHAN_ON else
                   "Dhan: off in demo mode" if PROVIDER == "demo" else
                   "Dhan: not set up, so there are no prices. Add DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN to .env or the host's environment."),
        "at": None,
        "stream": "",  # the tick-by-tick stream's state, in plain words
        "poll": "",  # the once-a-second price request's state (the fallback behind the stream), in plain words
        "stream_tick": None,  # when the last index price came over the stream
        "token": None,  # the last token check (token_forever): ok, valid_till, checked_at, problem
        "tiles": False,  # whether the dashboard's NIFTY 50, NIFTY BANK and SENSEX tiles carry Dhan's figures right now (at all hours, 7 October)
        "tiles_problem": None,  # why an index's figures could not be read for its tile just now (its last figures stay on the tile)
    },
}
stream_at = 0.0  # when the last tick came over the stream; the one-a-second polling steps in while it is quiet
started_at = None  # when this server process came up (set in lifespan): a restart is the usual reason a page lost its ticks


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
dash_subs: set = set()  # the dashboard pages' sockets: they get the Dhan tiles' live price once a second (live_forever)
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
#   itself for its first page; used up when the new page gets its id. Or within
#   GRACE_SECONDS of a page's connection dropping: the Back button shows a page from the
#   browser's own copy, served by nobody, as the page it leaves drops (17 October).
# Kept in memory, so a server restart ends every login.
logins: dict[str, dict] = {}  # token -> {"tab", "pages": {page id: {"socket", "dropped_at", "last_beat"}}, "handover_until"}
revoked: set[str] = set()  # tokens logged out on this server: never revived from the cookie
ws_pages: dict[WebSocket, tuple[str, str]] = {}  # socket -> (token, page id)
PAGE_PATHS = ("/", "/index/", "/docs", "/openapi.json")  # fetched by the browser itself, without the note
PAGE_EXACT = ()  # no other page paths: the Study page went on 15 October (the owner: "remove this study tab and everything under it")


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


def page_just_left(page: dict, now: float) -> bool:
    """Its connection dropped within GRACE_SECONDS: it may be the page the browser is leaving for the page now asking
    without an id. The Back button shows the earlier page from the browser's own copy, so the server never serves it and
    opens no handover (17 October: a page loaded afresh that way landed on the password page). The tab note still guards."""
    return page["socket"] is None and 0 < now - page["dropped_at"] < GRACE_SECONDS


def find_login(token):
    """The login behind this cookie, or None. Pages gone for DROP_SECONDS are forgotten;
    a login with no page left and no handover open is over."""
    if not token_ok(token):
        return None
    entry = logins.get(token)
    if entry is None:
        if token in revoked:
            return None  # logged out on this server: stays out
        # A restart emptied the logins (every merge restarts Render, and on 7 October each one logged the owner out and
        # left the calls that entered meanwhile without their premium). A cookie still signed with SESSION_SECRET and in
        # date is trusted again: the login is revived with a handover open, its tab note is adopted from the first data
        # request, and its pages get their ids back through /alive. Only with SESSION_SECRET set in the host's
        # environment; a random secret (none set) makes every old cookie invalid, as before.
        entry = logins[token] = {"tab": "", "pages": {}, "handover_until": time.time() + GRACE_SECONDS}
        log.info("login revived after a restart")
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
    if not entry["tab"] and tab:
        entry["tab"] = tab  # a login revived after a restart: the first tab to report in is its tab
    if not hmac.compare_digest(tab, entry["tab"]):
        entry["handover_until"] = 0  # the page just served was this tab, opened anew, not a reload
        if not any(page_open(p, now) for p in entry["pages"].values()):
            logins.pop(token, None)  # nothing open, and the link opened anew: over
        return False  # a tab opened anew, not one handed over
    page_id = page_of(connection, entry)
    if page_id:
        entry["pages"][page_id]["last_beat"] = now
        return True
    return any(page_open(p, now) or page_just_left(p, now) for p in entry["pages"].values()) or now < entry["handover_until"]


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


tile_cache: dict = {}  # index -> the figures last read for its tile: kept when a read fails, so a tile keeps its last figures


def dhan_tiles(names: list) -> tuple:
    """For the dashboard's tiles: each index's figures exactly as its own page's header shows them, from the same
    computation (dhan.fetch_detail's summary: Dhan's last price, the live one while the feed runs, else the last trade;
    the change against Dhan's previous close; the time the price is from). Returns ({index: figures}, the problem, if an index could not be read: its last figures stay).
    Until 7 October the tile was put together on its own, from a separate price request and the old source's quote."""
    tiles, problem = {}, None
    today = dhan.today_ist()
    for name in names:
        fetch = lambda last: dhan.fetch_detail(name, "today", "5m", INTERVALS, RANGES, last)["summary"]
        try:
            try:
                s = fetch(live_price(name))
            except dhan.DhanError as exc:  # no quote from Dhan just now (after hours, or refused): today's last candle, as the page shows after the close
                todays = [b for b in dhan.intraday(name, 5) if datetime.fromtimestamp(b["time"], dhan.IST).date() == today]
                if not todays or exc.kind in ("token", "subscription", "config"):
                    raise
                s = fetch(todays[-1]["close"])
            tile_cache[name] = {"level": s["last"], "change": s["change"], "change_percent": s["change_percent"],
                                "previous_close": s["previous_close"], "time": s["time"]}
        except Exception as exc:
            problem = f"{name}: {dhan_reason(exc)}"
            log.warning("Dhan tiles: %s", problem)
        if name in tile_cache:
            tiles[name] = tile_cache[name]
    return tiles, problem


def dhan_fetch_all() -> dict:
    """The dashboard's quotes, from Dhan alone (19 October): each index's tile shows exactly what its page's header shows,
    at all hours (dhan_tiles), marked dhan and live (whether the price moves every second now, or stands at the close).
    While Dhan is not set up there are no quotes: the dashboard says so and waits."""
    if not DHAN_ON:
        return {"quotes": [], "failed": sorted(INDICES), "reason": "Dhan is not set up on this server"}
    names = [n for n in INDICES if n in dhan.QUOTE_IDS]
    try:
        tiles, problem = dhan_tiles(names)
    except Exception as exc:
        tiles, problem = {}, f"{type(exc).__name__}: {str(exc)[:120]}"
    store["dhan"]["tiles"], store["dhan"]["tiles_problem"] = bool(tiles), problem
    quotes = [{"name": n, "ticker": INDICES[n], **tiles[n], "source": "dhan", "live": in_tick_hours()} for n in names if n in tiles]
    return {"quotes": quotes, "failed": [n for n in names if n not in tiles], "reason": problem or ""}


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


def live_now() -> dict:
    """The latest live price of each index on Dhan that came within the last few seconds: what the dashboard's tiles move on."""
    return {name: {"last": e.get("last"), "time": e.get("time"), "via": e.get("via")}
            for name, e in live.items() if name in dhan.QUOTE_IDS and live_price(name) is not None}


async def live_forever() -> None:
    """The dashboard's Dhan tiles move every second (owner's ask, 7 October): once a second, the latest live price of each
    index on Dhan that moved since, to every dashboard page, which redraws the tile in place. The index pages get their
    own ticks (push_tick); the tiles used to move only with the refresh every POLL_SECONDS."""
    sent: dict = {}
    while True:
        await asyncio.sleep(1)
        try:
            if not (DHAN_ON and dash_subs and in_tick_hours()):
                continue
            moved = {name: t for name, t in live_now().items() if sent.get(name) != (t["last"], t["time"])}
            if not moved:
                continue
            sent.update({name: (t["last"], t["time"]) for name, t in moved.items()})
            for ws in list(dash_subs):
                try:
                    await ws.send_json({"live": moved})
                except Exception:
                    dash_subs.discard(ws)
        except Exception as exc:
            log.warning("live tiles: %s", exc)


def live_price(name: str, within: float = 10) -> float | None:
    """The index's live price from the stream or the poll, if it came within the last few seconds, else None."""
    entry = live.get(name) or {}
    try:
        age = (datetime.now(dhan.IST) - datetime.fromisoformat(entry["time"])).total_seconds()
    except (KeyError, TypeError, ValueError):
        return None
    return entry.get("last") if 0 <= age <= within else None


def fold_tick(name: str, last: float, now: float, via: str) -> None:
    """One last price into the index's live entry and the candle of every size forming now. A candle that just closed
    is kept (every closed one of today, of each size: until 23 October the last 48), so the detail answer carries it the
    second it closes, and the whole day is there when Dhan refuses its minute candles (tick_candles_today)."""
    entry = live.setdefault(name, {"bars": {}, "closed": {}})
    entry.update(last=last, time=now_ist(), via=via)
    if not dhan.in_session({"time": now}):  # the pre-open (09:00 to 09:15) and after the close: the price moves, but the
        return                               # session's candles run from 09:15 to 15:30 (the owner's logic; the saved days are the same)
    for key, spec in INTERVALS.items():
        bucket = bucket_start(now, spec["bar_seconds"])
        bar = entry["bars"].get(key)
        if bar and bar["time"] == bucket:
            bar["high"], bar["low"], bar["close"] = max(bar["high"], last), min(bar["low"], last), last
        else:
            if bar and bar["time"] < bucket:
                done = entry.setdefault("closed", {}).setdefault(key, [])
                done.append(bar)
                day_start = bucket_start(now, 86400)  # today's 09:15: the closed candles of earlier days go
                done[:] = [b for b in done if b["time"] >= day_start]
            entry["bars"][key] = {"time": bucket, "open": last, "high": last, "low": last, "close": last}


def tick_candles(name: str, key: str) -> list:
    """The candles of one size built from the ticks: the closed ones kept, then the one forming now."""
    entry = live.get(name) or {}
    bars = list((entry.get("closed") or {}).get(key) or [])
    forming = (entry.get("bars") or {}).get(key)
    if forming:
        bars.append(forming)
    return bars


_saved_today: dict = {"stamp": None, "day": None}  # the day's partial copy, read again only when the file changes


def saved_candles_today(name: str, key: str) -> list:
    """Today's candles of one size from the day's partial copy on the disk (written every few minutes during the session,
    and pulled back from GitHub when the server starts): what the server before a restart had, built from the ticks or
    Dhan's own. So a restart during the session (a merge, Render) loses no candle while Dhan refuses the minute candles
    (23 October: the 09:27 and the 09:47 restarts each left the chart starting at that minute)."""
    today = dhan.today_ist()
    try:
        stamp = record.path_of(today).stat().st_mtime
    except OSError:
        return []
    if _saved_today["stamp"] != stamp:
        _saved_today.update(stamp=stamp, day=record.read_day(today))
    mine = (((_saved_today["day"] or {}).get("indices") or {}).get(name) or {}).get("candles") or {}
    return list(mine.get(key) or [])


def tick_candles_today(name: str, minutes: int) -> list:
    """Today's candles of one size built from the ticks, closed ones then the one forming now, with the candles from before
    a restart in front of them from the day's partial copy (saved_candles_today): what dhan.intraday hands out while Dhan
    refuses the minute candles (23 October). The size the entry keeps when there is one, else the one-minute candles folded."""
    today = datetime.now(dhan.IST).date()
    key = next((k for k, spec in INTERVALS.items() if spec["bar_seconds"] == minutes * 60), None)
    bars = tick_candles(name, key) if key else dhan.fold(tick_candles(name, "1m"), minutes * 60)
    mine = [dict(b) for b in bars if datetime.fromtimestamp(b["time"], dhan.IST).date() == today]
    saved = saved_candles_today(name, key) if key else dhan.fold(saved_candles_today(name, "1m"), minutes * 60)
    saved = [dict(b) for b in saved if datetime.fromtimestamp(b["time"], dhan.IST).date() == today]
    if saved and (not mine or saved[0]["time"] < mine[0]["time"]):
        first = mine[0]["time"] if mine else None
        before = [b for b in saved if first is None or b["time"] < first]
        if mine and saved[-1]["time"] == first:  # the restart fell inside a candle: its first part from the copy, its last from the ticks
            s = saved[-1]
            mine[0] = {**mine[0], "open": s["open"], "high": max(s["high"], mine[0]["high"]), "low": min(s["low"], mine[0]["low"])}
        mine = before + mine
    return mine


dhan.tick_candles_of = tick_candles_today
dhan.saved_sessions_of = record.saved_sessions  # the previous session from the saved days while Dhan refuses its daily list (23 October)


CLOSE_FROM_TICKS_SECONDS = 60  # how long after a candle closes its close is the last tick's rather than Dhan's copy (8 October)


def with_live_candles(candles: list, name: str, key: str) -> list:
    """Dhan's chart answer ends with a bar stamped at the latest trade's minute rather than at a candle
    boundary (seen at 18:45 after hours, and during the day), and the candle that just closed can take a
    while to appear in it. So: bars off the candle boundaries are dropped, and today's candles built from
    the ticks fill in what the answer lacks, the one forming now and any just closed. Dhan's own candle
    wins where both have one, except on the candle forming now and one closed within the last minute
    while the ticks are flowing: there Dhan's copy (asked for at most every 10 s) can be from before the
    candle's last seconds, so the close is the last tick's, and the high and low the furthest of the two.
    On 8 October at 12:15:01 the server judged NIFTY BANK's 12:10 candle on Dhan's copy, which still closed
    at 54,853.20; the index fell to 54,826.30 in the candle's last seconds, so the call it gave (Buy CE,
    crossed 38.2%) was gone from the rule a few seconds later, its record and CSV row left behind. On 6
    October the other way round was what made the calls late: the page judged a candle only once Dhan's
    list carried it, minutes after it had closed."""
    secs = INTERVALS[key]["bar_seconds"]
    by_time = {b["time"]: b for b in candles if bucket_start(b["time"], secs) == b["time"]}
    today = datetime.now(dhan.IST).date()
    flowing, now = live_price(name) is not None, time.time()
    for b in tick_candles(name, key):
        if datetime.fromtimestamp(b["time"], dhan.IST).date() != today:
            continue
        mine = by_time.get(b["time"])
        if mine is None:
            by_time[b["time"]] = dict(b)
        elif flowing and b["time"] + secs > now - CLOSE_FROM_TICKS_SECONDS:  # forming now, or closed within the last minute
            by_time[b["time"]] = {**mine, "high": max(mine["high"], b["high"]), "low": min(mine["low"], b["low"]), "close": b["close"]}
    return [by_time[t] for t in sorted(by_time)]


def tick_payload(name: str) -> dict:
    """What a page needs from the index's live entry, once per tick: the price, its time and way, and the candle of
    each size forming now. Not the closed candles the entry keeps (the last 48 of each size, for the detail answer):
    the page never read them from a tick, and with them every tick was about 13 KB instead of under 1 KB. One open
    page, one or two ticks a second, six hours a day, used up Render's free 5 GB of outbound data on 15 October."""
    entry = live.get(name) or {}
    return {"name": name, "last": entry.get("last"), "time": entry.get("time"), "via": entry.get("via"), "bars": entry.get("bars") or {}}


async def push_tick(name: str) -> None:
    """The index's live price and forming candles to every page watching it."""
    for ws, wanted in list(live_subs.items()):
        if wanted == name:
            try:
                await ws.send_json({"tick": tick_payload(name)})
            except Exception:
                live_subs.pop(ws, None)


async def push_premium(rec: dict) -> None:
    """One call's premium now (and its Sell mark) to every page watching that index."""
    for ws, wanted in list(live_subs.items()):
        if wanted == rec["index"]:
            try:
                await ws.send_json({"premium": {k: rec[k] for k in ("key", "premium_now", "now_at", "sold")}})
            except Exception:
                live_subs.pop(ws, None)


async def tick_forever() -> None:
    """The fallback behind the stream: while an index page is open on Dhan during market hours and the
    stream has been quiet for a few seconds, the last price every TICK_SECONDS, one request for all
    watched indices and the option contracts behind their open calls, folded into the candle forming
    now (the premiums into their records) and pushed to those pages. Whatever goes wrong is said in
    store["dhan"]["poll"] (the page and /health show it) and the loop carries on: a loop that died
    quietly would leave every page standing still with nothing said."""
    while True:
        try:
            names = feed_wanted()
            if not (DHAN_ON and names and in_tick_hours()) or time.time() - stream_at < 5:
                await asyncio.sleep(1)
                continue
            options = dhan.open_options(names)
            try:
                prices, premiums = await asyncio.to_thread(dhan.last_prices, names, list(options))
            except Exception as exc:
                reason = dhan_reason(exc)
                dhan_status(False, reason)
                store["dhan"]["poll"] = f"Poll: off since {now_ist()[11:19]} IST, {reason} Trying again in 10 s."
                log.warning("Dhan poll: %s", exc)
                await asyncio.sleep(10)
                continue
            now = time.time()
            if prices:
                store["dhan"]["poll"] = f"Poll: prices once a second from Dhan, last at {now_ist()[11:19]} IST."
            else:
                store["dhan"]["poll"] = f"Poll: Dhan answered at {now_ist()[11:19]} IST without a price for {', '.join(names)}."
                log.warning("Dhan poll: no price for %s in the answer", names)
            for name, last in prices.items():
                fold_tick(name, last, now, "poll")
                await push_tick(name)
            for option, premium in premiums.items():  # keyed (segment, security id), as dhan.open_options
                for rec_key in options[option]:
                    rec = dhan.note_premium(rec_key, premium)
                    if rec:
                        await push_premium(rec)
            if premiums:
                dhan.save_records()
            await asyncio.sleep(TICK_SECONDS)
        except Exception as exc:  # anything else: said, and tried again, never a dead loop
            store["dhan"]["poll"] = f"Poll: failed at {now_ist()[11:19]} IST ({type(exc).__name__}: {str(exc)[:100]}). Trying again in 5 s."
            log.exception("Dhan poll loop: %s", exc)
            await asyncio.sleep(5)


class FeedClosed(Exception):
    """Dhan hung up on purpose (packet type 50), with a reason."""


FEED_SEGMENTS = {0: dhan.SEGMENT, 2: "NSE_FNO", 8: "BSE_FNO"}  # the feed's segment byte: 0 is IDX_I, 2 is NSE_FNO, 8 is BSE_FNO (SENSEX's options)


def feed_packets(raw: bytes):
    """(segment name, security id, last price) for each price packet in one message from Dhan's feed.
    Packets start with a type byte and a 2-byte length; types 2 (ticker), 4 (quote) and 8 (full) carry the
    last price as a float after the 1-byte segment and 4-byte security id; type 50 is Dhan hanging up."""
    offset, found = 0, []
    while offset + 8 <= len(raw):
        code, length, segment, security_id = struct.unpack_from("<BHBI", raw, offset)
        if code == 50:
            reason = struct.unpack_from("<H", raw, offset + 8)[0] if offset + 10 <= len(raw) else 0
            raise FeedClosed(FEED_CODES.get(reason, f"Dhan closed the feed (code {reason})"))
        if code in (2, 4, 8) and offset + 12 <= len(raw):
            last = struct.unpack_from("<f", raw, offset + 8)[0]
            if last > 0 and segment in FEED_SEGMENTS:
                found.append((FEED_SEGMENTS[segment], security_id, round(last, 2)))
        if length < 8 or offset + length > len(raw):
            break  # one packet per message, or a length we do not trust: stop here
        offset += length
    return found


async def feed_subscribe(ws, code: int, segment: str, ids: list) -> None:
    """A subscribe (15) or unsubscribe (16) message, at most 100 instruments a message as Dhan asks."""
    for start in range(0, len(ids), 100):
        chunk = ids[start:start + 100]
        await ws.send(json.dumps({"RequestCode": code, "InstrumentCount": len(chunk),
                                  "InstrumentList": [{"ExchangeSegment": segment, "SecurityId": str(sid)} for sid in chunk]}))


async def stream_forever() -> None:
    """Dhan's tick-by-tick stream: while an index page on Dhan is open in market hours, one connection
    to the feed, subscribed to every index the broker feed covers. Each ticker packet is folded into
    the candle forming now and pushed to the pages at once, so the price moves as Dhan's own screen
    does. Whenever the stream is quiet, tick_forever's polling steps in."""
    global stream_at
    wait = 2
    by_id = {sid: name for name, sid in dhan.QUOTE_IDS.items()}
    while True:
        if not (DHAN_ON and feed_wanted() and in_tick_hours()):
            await asyncio.sleep(2)
            continue
        client_id, token = dhan.settings()
        url = f"{DHAN_FEED_URL}?version=2&token={token}&clientId={client_id}&authType=2"
        try:
            async with websockets.connect(url, ping_interval=20, ping_timeout=20, max_size=1 << 20) as ws:
                await feed_subscribe(ws, 15, dhan.SEGMENT, list(by_id))
                store["dhan"]["stream"] = f"Stream: tick-by-tick from Dhan, connected at {now_ist()[11:19]}"
                wait = 2
                options, checked, saved = {}, 0.0, 0.0  # the option contracts behind open calls ride the same connection
                while feed_wanted() and in_tick_hours():  # else nobody needs it, or the market closed: hang up
                    now = time.time()
                    if now - checked >= 1:  # calls enter and end: subscribe to their contracts, drop the ended ones
                        checked = now
                        wanted = dhan.open_options(list(by_id.values()))  # {(segment, security id): record keys}
                        if set(wanted) != set(options):
                            for code, keys in ((15, [k for k in wanted if k not in options]), (16, [k for k in options if k not in wanted])):
                                for segment in sorted({s for s, _ in keys}):
                                    await feed_subscribe(ws, code, segment, [sid for s, sid in keys if s == segment])
                        options = wanted
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=1)
                    except asyncio.TimeoutError:
                        continue
                    if not isinstance(raw, (bytes, bytearray)):
                        continue  # Dhan's text acknowledgements
                    now = time.time()
                    for segment, sid, last in feed_packets(bytes(raw)):
                        if segment == dhan.SEGMENT and sid in by_id:
                            fold_tick(by_id[sid], last, now, "stream")
                            stream_at = now
                            store["dhan"]["stream_tick"] = live[by_id[sid]]["time"]
                            await push_tick(by_id[sid])
                        elif (segment, sid) in options:
                            stream_at = now
                            for rec_key in options[(segment, sid)]:
                                rec = dhan.note_premium(rec_key, last)
                                if rec:
                                    await push_premium(rec)
                            if now - saved >= 5:
                                saved = now
                                dhan.save_records()
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


TOKEN_CHECK_SECONDS = float(os.environ.get("DHAN_TOKEN_CHECK_SECONDS", "1800"))

# ---------------------------------------------------------------- the server watches the calls itself (owner, 7 October: "option 2")
# The rule used to run only in the page: a call that entered while no page was open got no premium, and one that entered
# during a restart got a late one. Now the server runs the same rule (rule.py, the page's engine in Python, proven the
# same by check_rule.py) on the same candles, for the setting the owner uses live, every few seconds in market hours:
# a call that enters is recorded at once (its option, its premium paid), a call that ends is marked, and the day's
# calls are recorded for the CSV. The page does all this too; whichever is first wins, the other finds the record.
WATCH_INTERVAL = os.environ.get("WATCH_INTERVAL", "5m")                  # the time frame the owner trades on
# the levels modes watched, each by itself: "today" (today so far), "prev" (previous day) and, since 15 October, "close" (the
# previous close's lines, the owner's own: "should the server also write down the calls from your new lines ... Yes"). Until 9
# October only "today": a call on previous-day lines got its option and premium only while a page was open on them
WATCH_LEVELS = tuple(m.strip() for m in os.environ.get("WATCH_LEVELS", "today,prev,close").split(",") if m.strip())
WATCH_SIGNAL = os.environ.get("WATCH_SIGNAL", "both")                     # "held", "crossed" or "both"
WATCH_SECONDS = float(os.environ.get("WATCH_SECONDS", "5"))
WATCH_ON = WATCH_INTERVAL in INTERVALS and WATCH_INTERVAL not in LONG_INTERVALS and bool(WATCH_LEVELS) and all(m in ("today", "prev", "close") for m in WATCH_LEVELS) and WATCH_SIGNAL in ("held", "crossed", "both")
WATCH_SETTING = f"{WATCH_INTERVAL} {'+'.join(WATCH_LEVELS)} {WATCH_SIGNAL}"  # as /health shows it
# The live feed (the stream, and the poll behind it) used to run only while an index page was open. The watcher needs the
# candle forming now and the open calls' premiums whether or not a page is open, so in market hours the feed runs for the
# watcher too: the indices it watches, and the option contracts behind its open calls (the Sell mark works with no page).
def feed_wanted() -> list:
    """The indices whose live price the server needs now: the pages' and, with the watcher on, every index on Dhan
    (the two it watches, and SENSEX for its tile: owner's ask, 7 October)."""
    names = set(live_subs.values())
    if WATCH_ON:
        names |= set(dhan.QUOTE_IDS)
    return sorted(names)
watch_state = {"at": None, "calls": 0, "open": 0, "without_id": 0, "premiums": None, "problem": None}
watch_retry: dict = {}  # call key -> when to try registering its option again, after Dhan refused (no flood of requests or log lines)


def watch_index(name: str) -> dict:
    """One look at one index: the day's candles as the page has them (Dhan's, with the one forming now from the ticks),
    fetched once, then each levels mode watched (watch_levels). A problem with one mode (the previous day's figures not
    readable) leaves the other watched. Returns counts, and the problem, if any."""
    key, seconds = WATCH_INTERVAL, INTERVALS[WATCH_INTERVAL]["bar_seconds"]
    today = dhan.today_ist()
    all_candles = dhan.intraday(name, seconds // 60)
    todays = [b for b in all_candles if datetime.fromtimestamp(b["time"], dhan.IST).date() == today]
    bars = with_live_candles(todays, name, key)
    atr_seed = rule.atr_seed_of([b for b in all_candles if datetime.fromtimestamp(b["time"], dhan.IST).date() < today], rule.GATE["atrPeriod"])  # the Call Gate's ATR carried in from the days before (22 October night)
    out = {"calls": 0, "open": 0, "problem": None}
    if not bars:
        return out
    for levels_mode in WATCH_LEVELS:
        try:
            got = watch_levels(name, levels_mode, bars, all_candles, today, atr_seed)
        except Exception as exc:
            out["problem"] = out["problem"] or f"{name} {levels_mode}: {type(exc).__name__}: {str(exc)[:120]}"
            log.warning("watch: %s %s: %s", name, levels_mode, exc)
            continue
        out["calls"] += got["calls"]
        out["open"] += got["open"]
    return out


def watch_levels(name: str, levels_mode: str, bars: list, all_candles: list, today, atr_seed=None) -> dict:
    """The rule on one levels mode: the levels (previous day's; the previous close's, drawn again only after a close beyond
    the outermost line, 15 October; or today so far, each candle against the day's range up to it, as the page judges it since
    8 October), the rule, then the records and the day's calls brought up to date."""
    key, seconds = WATCH_INTERVAL, INTERVALS[WATCH_INTERVAL]["bar_seconds"]
    today_so_far = levels_mode not in ("prev", "close")  # each candle against the seven lines as they stood when it began, as the page and the Study page judge it (8 October)
    if levels_mode in ("prev", "close"):
        previous = dhan.previous_day(name, all_candles)
        if not previous:
            return {"calls": 0, "open": 0}
        if levels_mode == "prev":
            levels = rule.levels_of(rule.move_of_day(previous))
            levels_at = lambda i: levels
        else:
            levels_at = rule.close_levels_at(bars, previous["close"])  # the page's lines on "Previous close", candle by candle (Rules.closeLevelsAt)
            if levels_at is None:
                return {"calls": 0, "open": 0}
    else:
        previous = None
        levels_at = rule.today_levels_at(bars)
    now = time.time()
    targets_at = rule.today_lines_at(bars) if today_so_far else None  # a call's target on the chart's lines (8 October evening)
    given = {}  # the calls given live in this setting (their options recorded): each stays, whatever Dhan's final candle says (9 October)
    for r in sorted(dhan.records_for(name), key=lambda r: r["paid_at"]):
        parts = r["key"].split("|")
        if len(parts) == 5 and parts[0] == name and parts[1] == key and parts[4] == levels_mode and parts[2].isdigit():
            given.setdefault(int(parts[2]), parts[3])
    minutes = with_live_candles([b for b in dhan.intraday(name, 1) if datetime.fromtimestamp(b["time"], dhan.IST).date() == today], name, "1m")  # today's one-minute candles, the one forming now from the ticks: the owner's early exit (19 October)
    trades = rule.paper_trades(bars, levels_at, now, seconds, False, WATCH_SIGNAL, None, targets_at, True, rule.TRAIL, given,  # the owner's exit rule for breaks (8 October night), with Rule 2 (9 October)
                               key == "5m" and today_so_far and rule.NEW_HIGH_LOW.get(name, False),  # idea 24, a call past the day's high or low: NIFTY 50, today so far (13 October)
                               previous["close"] if previous else None,  # the first candle judged from the previous close; ideas 13, 8 and 5 removed (18 October)
                               minutes, rule.GATE, atr_seed,  # the Call Gate (version 2, 23 October), with the ATR carried in from the days before
                               loss_cutter=rule.LC if name in rule.LC["indices"] else None,  # the Loss Cutter (24 October), NIFTY 50 only
                               profit_lock=rule.LOCK if name in rule.LOCK["indices"] else None,  # the Profit Lock (24 October), NIFTY 50 only, shadow mode
                               trade_plan=rule.PLAN if name in rule.PLAN["indices"] else None,  # the Trade Plan (29 October), NIFTY 50 only, a mark
                               builder=rule.BUILDER if name in rule.BUILDER["indices"] else None)  # the rule builder (30 October), NIFTY 50 only, a mark
    trades, result = trades["trades"], trades
    gate_daily_line(name, levels_mode, result, bars, today)
    rows = []
    for t in trades:
        call_key = rule.call_key(name, key, t, levels_mode)
        if t.get("paper"):  # the Call Gate held the order (mode LIVE): the call is followed on paper, no option is registered
            rows.append(paper_row(t))
            continue
        read = rule.read_of(t, bars, seconds, now)  # the candle verdict, for the day's calls CSV (the research engine's), as the page gives it
        carry = rule.carry_of(t, bars, seconds, now)  # and the carry read (idea P5's question), the same way
        rec = dhan.record_of(call_key)
        if rec and t.get("entryTime") is not None and dhan.paid_late(rec, t["entryTime"]) and time.monotonic() >= watch_retry.get(call_key, 0):
            try:  # made late before 13 October's change: its prices again from the option's one-minute candles (dhan.reprice_late)
                sale = {"how": t["how"], "at": sale_minute(name, t, seconds)} if t.get("exit") is not None else None
                rec = dhan.reprice_late(name, call_key, t["entryTime"], sale) or rec
                watch_retry.pop(call_key, None)
            except Exception as exc:
                watch_retry[call_key] = time.monotonic() + 300  # no candles for it, or Dhan refused: again in five minutes
                log.warning("watch: %s %s: %s", name, call_key, exc)
        if t["how"] == "open" and rec is None and time.monotonic() >= watch_retry.get(call_key, 0):  # entered, and no record yet: the option and its premium, now
            try:  # (entered a while ago: the premium of its entry minute, dhan.late_prices)
                rec = dhan.register_call(name, call_key, t["side"], t["entry"], t.get("entryTime"))
                watch_retry.pop(call_key, None)
            except Exception as exc:
                watch_retry[call_key] = time.monotonic() + 30  # Dhan refused (its limit, the chain down): again in half a minute
                log.warning("watch: %s %s: %s", name, call_key, exc)
        elif t.get("exit") is not None and t.get("entry") is not None and rec is None and time.monotonic() >= watch_retry.get(call_key, 0):
            try:  # bought and sold while the server could not see it (13 October): its prices from the option's one-minute candles
                rec = dhan.register_call(name, call_key, t["side"], t["entry"], t["entryTime"], {"how": t["how"], "at": sale_minute(name, t, seconds)})
                watch_retry.pop(call_key, None)
            except Exception as exc:
                watch_retry[call_key] = time.monotonic() + 120  # no candles yet, or Dhan refused: again in two minutes
                log.warning("watch: %s %s: %s", name, call_key, exc)
        elif t.get("exit") is not None and rec and not rec["ended"]:
            rec = dhan.end_call(call_key, t["how"]) or rec
        elif t["how"] == "open" and rec and rec["ended"] and rec["ended"].get("how") not in ("day end", "sold"):
            rec = dhan.reopen_call(call_key) or rec  # still open by the rule: its premium is followed again (8 October)
        moments = lock_moments(t, seconds)
        if rec and moments and time.monotonic() >= watch_retry.get(call_key + " lock", 0):
            try:  # the option's premium at the Profit Lock's moments (shadow mode: what it would have sold at)
                rec = dhan.note_lock(name, call_key, moments) or rec
            except Exception as exc:
                watch_retry[call_key + " lock"] = time.monotonic() + 120  # Dhan refused the option's minutes: again in two minutes
                log.warning("watch: %s %s lock: %s", name, call_key, exc)
        lock_log(name, levels_mode, call_key, t, rec, seconds)
        if rec and (rec.get("ended") or {}).get("how") == "sold" and t.get("entry") is not None:
            t = sold_trade(t, rec, bars, seconds)  # sold at the Sell mark: the call ends there, whatever the index rule says (9 October)
        rows.append({"signal_time": t["signalTime"], "level": t["level"], "ratio": t["ratio"], "kind": t["kind"], "side": t["side"],
                     "entry_time": t.get("entryTime"), "entry": t.get("entry"), "target": t["target"], "exit_time": t.get("exitTime"), "exit": t.get("exit"),
                     "points": t.get("points"), "how": t["how"],
                     "candles_say": read["word"] if read else "", "exit_said_at": read["exitAt"] if read else None, "candles_why": read["why"] if read else "",
                     "carry_deep": ("yes" if carry["deep"] else "no") if carry else "", "beyond_level": carry["beyond"] if carry else None,
                     "beyond_reached": ("yes" if carry["reached"] else "no") if carry else "",
                     "contract": f"{round(rec['strike'])} {rec['side']} {rec['expiry']}" if rec else "", "premium_paid": rec["premium_paid"] if rec else None,
                     "premium_now": rec["premium_now"] if rec else None, "sell_below": rec["sell_below"] if rec else None,
                     "sold_at": rec["sold"]["premium"] if rec and rec["sold"] else None,
                     "exit_at": t.get("exitAt"), "parallel": bool(t.get("parallel")), "reason": "",  # the page's Reason column is the page's wording; the watcher's rows carry the candle verdict instead
                     "gate": t.get("gate") or "", "gate_reason": t.get("gateWhy") or "", "gate_check": t.get("gateCheck") or "", "gate_advice": t.get("gateAdvice") or "", "paper": False,
                     **lc_fields(t, rec), **lock_fields(t, rec), **plan_fields(t), **builder_fields(t)})  # the Call Gate's verdict on the signal, the check that decided, the parallel advice (version 2); the Loss Cutter; the Profit Lock
    if rows:
        record.record_calls(name, key, levels_mode, WATCH_SIGNAL, today.isoformat(), rows)  # the day's calls CSV (the daily save, back on 21 October)
    return {"calls": len(rows), "open": sum(1 for r in rows if r["how"] == "open")}


def sale_minute(name: str, t: dict, seconds: int) -> int:
    """The minute a call nobody saw was sold in, for its option's price then: a target or a retouch is reached tick by tick,
    so the first one-minute candle of the selling candle that reached that price (13 October: the 9:20 Buy CE's target,
    22,477.78, in the 9:25 candle, was reached at 9:29); any other sale is at the candle's close, so its last minute."""
    start, end = t["exitTime"], t["exitTime"] + seconds
    if t["how"] == "early" and t.get("exitAt"):  # the owner's early exit (19 October): at the end of a minute, so the minute before exitAt
        return t["exitAt"] - 60
    if t["how"] in ("target", "retouch"):
        up = (t["how"] == "target") == (t["side"] == "CE")  # a Buy CE's target is above, its retouch below; a Buy PE's the other way
        for b in dhan.intraday(name, 1):
            if start <= b["time"] < end and (b["high"] >= t["exit"] if up else b["low"] <= t["exit"]):
                return b["time"]
    return min(end, int(time.time()) // 60 * 60 + 60) - 60  # the candle forming now: the minute now


def paper_row(t: dict) -> dict:
    """The day's calls CSV row of a call the Call Gate held in mode LIVE and followed on paper: its index points, no option."""
    return {"signal_time": t["signalTime"], "level": t["level"], "ratio": t["ratio"], "kind": t["kind"], "side": t["side"],
            "entry_time": t.get("entryTime"), "entry": t.get("entry"), "target": t["target"], "exit_time": t.get("exitTime"), "exit": t.get("exit"),
            "points": t.get("points"), "how": t["how"], "candles_say": "", "exit_said_at": None, "candles_why": "", "carry_deep": "", "beyond_level": None, "beyond_reached": "",
            "contract": "", "premium_paid": None, "premium_now": None, "sell_below": None, "sold_at": None, "exit_at": t.get("exitAt"), "parallel": bool(t.get("parallel")),
            "reason": "", "gate": t.get("gate") or "", "gate_reason": t.get("gateWhy") or "", "gate_check": t.get("gateCheck") or "", "gate_advice": t.get("gateAdvice") or "", "paper": True,
            **lc_fields(t, None), **lock_fields(t, None), **plan_fields(t), **builder_fields(t)}


def plan_fields(t: dict) -> dict:
    """The Trade Plan's fields of a call for the day's calls CSV (29 October): TAKE or SKIP, and why; empty off NIFTY 50."""
    return {"plan": t.get("plan") or "", "plan_reason": t.get("planWhy") or ""}


def builder_fields(t: dict) -> dict:
    """The rule builder's mark (30 October): KEEP (which rules) or SKIP on every call that fired."""
    return {"builder": t.get("builder") or "", "builder_rules": t.get("builderWhy") or ""}


def lc_fields(t: dict, rec: dict | None) -> dict:
    """The Loss Cutter's fields of a call for the day's calls CSV (24 October): its verdict, why, the check that decided, its advice,
    the calls open the same way when the order was placed; and from the option's record the premium path (the lowest premium,
    when, and the 15% premium stop, log only)."""
    if not t.get("lc"):  # an index the Loss Cutter does not run on (NIFTY 50 only, the owner, 24 October): the columns stay empty
        return {"lc": "", "lc_reason": "", "lc_check": "", "lc_advice": "", "lc_open_same": None, "premium_low": None, "premium_low_at": None, "stop15_at": None, "stop15_premium": None}
    stop = (rec or {}).get("stop15") or {}
    return {"lc": t.get("lc") or "", "lc_reason": t.get("lcWhy") or "", "lc_check": t.get("lcCheck") or "", "lc_advice": t.get("lcAdvice") or "",
            "lc_open_same": t.get("lcOpenSame"), "premium_low": (rec or {}).get("premium_low"), "premium_low_at": (rec or {}).get("premium_low_at"),
            "stop15_at": stop.get("at"), "stop15_premium": stop.get("premium")}


def lock_moments(t: dict, seconds: int) -> dict:
    """The Profit Lock's moments of a call (24 October): {setting: the close of the candle it said exit on}, the main setting's and
    the compared ones' (shadow), for the option's premium then (dhan.note_lock)."""
    out = {}
    if (t.get("lock") or {}).get("at") is not None:
        out[rule.LOCK["name"]] = t["lock"]["at"] + seconds
    for n, a in (t.get("lockAlso") or {}).items():
        if a:
            out[n] = a["at"] + seconds
    return out


def lock_fields(t: dict, rec: dict | None) -> dict:
    """The Profit Lock's fields of a call for the day's calls CSV (24 October): the candle it said exit on, the index points then, the best
    profit and the floor, and from the option's record the premium at that moment (and where it came from); the compared settings the
    same way (lock_also). Empty where the lock does not run (NIFTY 50 only) or was never asked (the call ended on its firing candle)."""
    lk, mine = t.get("lock"), (rec or {}).get("lock") or {}
    if not lk:
        return {"lock": "", "lock_at": None, "lock_points": None, "lock_peak": None, "lock_floor": None, "lock_premium": None, "lock_from": "", "lock_also": {}}
    main = mine.get(rule.LOCK["name"]) or {}
    also = {n: {"at": a["at"], "points": a["points"], "premium": (mine.get(n) or {}).get("premium")} for n, a in (t.get("lockAlso") or {}).items() if a}
    return {"lock": f"{rule.LOCK['name']} {rule.LOCK['mode']}", "lock_at": lk.get("at"), "lock_points": lk.get("points"), "lock_peak": lk.get("peak"), "lock_floor": lk.get("floor"),
            "lock_premium": main.get("premium"), "lock_from": main.get("from") or "", "lock_also": also}


lock_logged: set = set()  # (call key, "armed" or "exit") whose Profit Lock line is in the log


def lock_log(name: str, levels_mode: str, call_key: str, t: dict, rec: dict | None, seconds: int) -> None:
    """The Profit Lock's log lines of the document's section 7, once per call: ARMED when the best profit first reaches the arming
    points, then SHADOW (would exit; the real exit follows) or EXIT (mode LIVE) with the premium at that moment once it is known."""
    lk = t.get("lock")
    if not lk:
        return
    call = f"{rule._ist_hm(t['signalTime'])} {t['side']}"
    if lk.get("floor") is not None and (call_key, "armed") not in lock_logged:
        lock_logged.add((call_key, "armed"))
        log.info("%s %s: PROFIT LOCK ARMED  call=%s peak=%+.1f floor=%+.1f", name, levels_mode, call, lk["peak"], lk["floor"])
    if lk.get("at") is None or (call_key, "exit") in lock_logged:
        return
    noted = ((rec or {}).get("lock") or {}).get(rule.LOCK["name"])
    if rec and not noted and time.time() < lk["at"] + seconds + 600:
        return  # the premium at that moment is still to come (dhan.note_lock): the line waits for it, ten minutes at most
    lock_logged.add((call_key, "exit"))
    prem = "the Sell mark sold it before" if noted and noted["from"] == "sold" else f"{noted['premium']:.2f} ({noted['from']})" if noted and noted.get("premium") is not None else "not known"
    word = "EXIT  " if rule.LOCK["mode"] == "LIVE" else "SHADOW"
    log.info("%s %s: PROFIT LOCK %s call=%s %s candle=%s profit=%+.1f peak=%+.1f floor=%+.1f sell_premium=%s (index close %.2f)%s", name, levels_mode, word, call,
             "closed" if word.startswith("EXIT") else "would_exit", rule._ist_hm(lk["at"]), lk["points"], lk["peak"], lk["floor"], prem, lk["price"],
             "" if word.startswith("EXIT") else " (shadow mode: no order sent; the real exit follows)")


gate_daily_logged: set = set()  # (index, levels mode, date) whose daily summary line is in the log


def gate_daily_line(name: str, levels_mode: str, result: dict, bars: list, today) -> None:
    """The Call Gate's daily summary line (the brief, section 6), once per index and levels mode after the day's last candle has closed."""
    key = (name, levels_mode, today.isoformat())
    if key in gate_daily_logged or not bars or not result.get("trades"):
        return
    last = bars[-1]
    if time.time() < last["time"] + INTERVALS[WATCH_INTERVAL]["bar_seconds"] or datetime.fromtimestamp(last["time"], dhan.IST).hour * 60 + datetime.fromtimestamp(last["time"], dhan.IST).minute < 15 * 60 + 25:
        return  # the day's last candle (15:25) has not closed yet
    gate_daily_logged.add(key)
    log.info("%s %s: %s", name, levels_mode, rule.gate_summary(result, today.isoformat()))
    if name in rule.LC["indices"]:
        log.info("%s %s: %s", name, levels_mode, rule.lc_summary(result, today.isoformat()))  # the Loss Cutter's daily line (24 October), the documents' scoreboard for the day
    if name in rule.LOCK["indices"]:
        log.info("%s %s: %s", name, levels_mode, rule.lock_summary(result, today.isoformat(), rule.LOCK))  # the Profit Lock's daily line (24 October), the shadow report's day


def sold_trade(t: dict, rec: dict, bars: list, seconds: int) -> dict:
    """The call as sold at its Sell mark (the owner, 9 October): it ends at the moment of the mark, at the index price of
    the candle it fell in (its close; the price now for the candle forming), so the day's calls CSV says "sold"."""
    at = datetime.fromisoformat(rec["sold"]["at"]).timestamp()
    bar = next((b for b in reversed(bars) if b["time"] <= at), None)
    out = dict(t)
    if bar is not None:
        exit_ = bar["close"]
        out.update(exit=exit_, exitTime=int(at), how="sold",
                   points=round(exit_ - t["entry"] if t["side"] == "CE" else t["entry"] - exit_, 2))
    return out


def watch_premiums(name: str) -> dict:
    """The premium now and the Sell mark of the index's open records, page or no page: the contracts' security ids
    from Dhan's instrument list (then they ride the stream and the poll), and the option chain for a record the feed
    has not read in the last few seconds. Until 7 October only an open page asked for this, so an index nobody had
    open kept every premium at the value paid and no Sell mark could come (NIFTY BANK, that afternoon). Returns what
    /health says: how many open calls have no contract on the feed yet, and why a premium could not be read, if so."""
    try:
        problem = dhan.refresh_records(name)
    except Exception as exc:  # a premium problem never stops the watching of the calls
        problem = f"{type(exc).__name__}: {str(exc)[:120]}"
        log.warning("watch premiums: %s: %s", name, exc)
    without_id = sum(1 for r in dhan.records_for(name) if not r["ended"] and not r.get("security_id"))
    return {"without_id": without_id, "premiums": problem}


def measured(what: str, work, *args):
    """One piece of the watcher's work, its memory measured (memwatch, 9 October)."""
    with memwatch.watch(what):
        return work(*args)


async def calls_forever() -> None:
    """The watcher's loop: every WATCH_SECONDS in market hours, each index on Dhan: the calls, then their premiums."""
    if not WATCH_ON:
        watch_state["problem"] = f"the watcher's setting is not one the page has: {WATCH_SETTING}"
        log.warning("watch: %s", watch_state["problem"])
        return
    while True:
        try:
            if DHAN_ON and in_tick_hours():
                calls = open_now = without_id = 0
                premiums = problem = None
                for name in dhan.OPTION_INDICES:
                    got = await asyncio.to_thread(measured, f"call tracker {name}", watch_index, name)
                    calls += got["calls"]
                    open_now += got["open"]
                    problem = problem or got.get("problem")  # one levels mode that could not be watched just now, if so
                    more = await asyncio.to_thread(measured, f"premiums {name}", watch_premiums, name)  # after the calls: a call entering is recorded first, the premiums now next
                    without_id += more["without_id"]  # open calls whose contract is not on the feed yet (the instrument list still loading, or one it does not know)
                    premiums = premiums or more["premiums"]  # why a premium could not be read just now, if so
                watch_state.update(at=now_ist(), calls=calls, open=open_now, without_id=without_id, premiums=premiums, problem=problem)
        except Exception as exc:
            watch_state["problem"] = f"{type(exc).__name__}: {str(exc)[:160]}"
            log.warning("watch: %s", exc)
        await asyncio.sleep(WATCH_SECONDS)


def in_keep_awake_hours() -> bool:
    """From 06:00 until 16:30 IST, every day (the owner, 15 October night: "server check should happen only from 6:00 AM
    in the morning till 4.30 PM everyday"); until then weekdays only, to 16:15. Until 14 October it began at 08:45, so a
    server woken earlier (the morning's fresh Dhan token pasted into Render restarts it) went back to sleep 15 minutes
    later, and that day nothing woke it again until 14:11. Whatever wakes it in the morning keeps it awake through the
    session; it never wakes itself, so a morning nobody wakes it costs nothing."""
    if TICK_ALWAYS:
        return True
    now = datetime.now(dhan.IST)
    return (6, 0) <= (now.hour, now.minute) < (16, 30)


keep_awake_state: dict = {"url": SELF_URL, "at": None, "status": None, "problem": None}


async def keep_awake_forever() -> None:
    """Calls this server's own public address every KEEP_AWAKE_SECONDS in market hours, so the free plan never puts it to
    sleep while the watcher is recording calls (see SELF_URL). Outside those hours it lets the server sleep."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
        while True:
            if in_keep_awake_hours():
                try:
                    r = await client.get(SELF_URL.rstrip("/") + "/health")
                    keep_awake_state.update(at=now_ist(), status=r.status_code, problem=None)
                except Exception as exc:
                    keep_awake_state.update(at=now_ist(), status=None, problem=f"{type(exc).__name__}: {str(exc)[:120]}")
                    log.warning("keep-awake: %s", keep_awake_state["problem"])
            await asyncio.sleep(KEEP_AWAKE_SECONDS)


async def token_forever() -> None:
    """Asks Dhan whether the token is good and until when, at start and every half hour (one small request), so
    /health and the wake-up check can say "the token expires at ..." or "the token was refused" without a login.
    The owner does not look after the saving (6 October), and the token is the one thing only they can renew."""
    while True:
        try:
            store["dhan"]["token"] = await asyncio.to_thread(dhan.token_check)
            if not store["dhan"]["token"]["ok"]:
                log.warning("Dhan token: %s", store["dhan"]["token"]["problem"])
            try:
                dhan.option_ids()  # starts the instrument list's read (in its own thread) if it is missing or stale: the ids check, and the contracts' ids
            except dhan.DhanError:
                pass
            if problem := dhan.id_problem():
                log.warning("Dhan ids: %s", problem)
        except Exception as exc:
            store["dhan"]["token"] = {"ok": False, "valid_till": None, "checked_at": now_ist(), "problem": f"{type(exc).__name__}: {str(exc)[:120]}"}
        await asyncio.sleep(TOKEN_CHECK_SECONDS)


async def give_memory_back_forever() -> None:
    """Once a minute the allocator's free memory goes back to the system (memwatch.give_back; 9 October: 265 MB held
    free against 36 MB in use, and the server grew towards Render's 512 MB), after a full run of the garbage collector
    (14 October: the requests' HTTPS clients left in reference cycles, about 0.75 MB each, took the server to 427 MB)."""
    while True:
        await asyncio.sleep(60)
        try:
            await asyncio.to_thread(memwatch.give_back)
        except Exception as exc:  # never stops the server
            log.warning("memory: %s", exc)


async def warm_option_ids() -> None:
    """Starts the read of Dhan's instrument list at start (it runs in its own thread), so the first call of
    the day finds its contract's id at once, and logs how it went."""
    why = None
    for _ in range(60):  # up to ten minutes for the first read; after that, the next call that needs it tries again
        try:
            ids = dhan.option_ids()
            log.info("Dhan instrument list: %d option contracts of NIFTY and BANKNIFTY", len(ids))
            return
        except Exception as exc:
            why = exc
        await asyncio.sleep(10)
    log.warning("Dhan instrument list: %s", why)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    global started_at
    started_at = now_ist()
    # Dhan calls, the detail payload and the records run in worker threads; the default pool (a handful
    # on a small host) ran dry on 6 October and every page stalled, so it is given room
    asyncio.get_running_loop().set_default_executor(concurrent.futures.ThreadPoolExecutor(max_workers=16, thread_name_prefix="work"))
    if not AUTH_ENABLED:
        log.warning("DASHBOARD_PASSWORD is not set: anyone who can reach this server can see the dashboard.")
    tasks = [asyncio.create_task(give_memory_back_forever()),
             asyncio.create_task(refresh_forever()), asyncio.create_task(tick_forever()), asyncio.create_task(stream_forever()),
             asyncio.create_task(record.record_forever(DHAN_ON))]  # the daily save (back on 21 October: "bring back the daily save, without study page")
    if DHAN_ON:
        tasks.append(asyncio.create_task(warm_option_ids()))
        tasks.append(asyncio.create_task(token_forever()))
        tasks.append(asyncio.create_task(calls_forever()))
        tasks.append(asyncio.create_task(live_forever()))
    if SELF_URL:
        tasks.append(asyncio.create_task(keep_awake_forever()))
    else:
        log.info("keep-awake: no public address (RENDER_EXTERNAL_URL or KEEP_AWAKE_URL), so it is off")
    yield
    for task in tasks:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Indices API", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)  # the saved days are large; compressed they travel fast to a phone


@app.middleware("http")
async def measure_memory(request: Request, call_next):
    """What each kind of page request costs in memory (memwatch, 9 October): the route's pattern names it, so
    /detail/NIFTY%2050 and /detail/SENSEX are one kind."""
    before = memwatch.rss_mb()
    response = await call_next(request)
    route = request.scope.get("route")
    path = request.url.path
    memwatch.note(f"page {getattr(route, 'path', None) or ('/static' if path.startswith('/static/') else path)}", before, memwatch.rss_mb())
    return response


@app.middleware("http")
async def require_login(request: Request, call_next):
    path = request.url.path
    is_page = path == "/" or path in PAGE_EXACT or path.startswith(PAGE_PATHS[1:])
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

def memory_mb() -> dict:
    """This process's memory now and at its peak, in MB (Linux), for /health. On 8 October the server stopped at about 09:50
    with a page open and came back at 10:00:26 as a fresh start; the free plan has 512 MB, so the peak says whether
    running out of memory is the likely reason when it happens again."""
    out = {"now": None, "peak": None}
    try:
        for line in Path("/proc/self/status").read_text().splitlines():
            if line.startswith("VmRSS:"):
                out["now"] = round(int(line.split()[1]) / 1024)
            elif line.startswith("VmHWM:"):
                out["peak"] = round(int(line.split()[1]) / 1024)
    except (OSError, ValueError, IndexError):
        pass
    return out


@app.get("/health")
def health():
    """Open, for the host's checks and for the wake-up workflow (.github/workflows/wake.yml), which reads the token's
    state and, after the close, whether the day was saved (under "save"; the daily save was off from 15 to 21 October).
    No secret in here: dates, and a problem said in plain words."""
    return {"status": "ok", "commit": COMMIT, "dhan": DHAN_ON, "token": store["dhan"]["token"], "save": record.summary(), "memory_mb": memory_mb(),
            "memory": memwatch.summary(),  # where the memory goes (9 October): threads, the allocator, the most numerous objects, the biggest jumps
            "feed": feed_state(), "keep_awake": {k: v for k, v in keep_awake_state.items() if k != "url"} | {"on": bool(SELF_URL)}}


def feed_state() -> dict:
    """The live feed's state in plain words, no secret in it: for /health and the index page's line under the price."""
    d = store["dhan"]
    return {"server_time": now_ist(), "started_at": started_at, "tick_hours": in_tick_hours(), "watching": sorted(set(live_subs.values())),
            "status": d["status"], "stream": d["stream"], "stream_tick": d["stream_tick"], "poll": d["poll"], "tiles": d["tiles"],
            "tiles_problem": d["tiles_problem"],
            "daily_problem": dhan.daily_problem(),  # Dhan refusing the daily list (22 October): the previous session then comes from the candles
            "intraday_problem": dhan.intraday_problem(),  # Dhan refusing the minute candles (23 October): today's candles then come from the ticks
            "chart_form": dhan.chart_form_report(),  # the form each chart request is accepted in now: the candle size as "text" or "number" (23 October)
            "last_tick": {name: {"last": e.get("last"), "time": e.get("time"), "via": e.get("via")} for name, e in live.items()},
            "watch": {"setting": WATCH_SETTING, **watch_state},
            "ids": dhan.id_problem(),  # null, or what Dhan's instrument list says differs from the index ids this code uses
            "option_list": dhan.list_report()}  # what Dhan's instrument list gave (9 October, SENSEX): option ids per underlying, SENSEX's expiries and rows


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
    if token:
        revoked.add(token)  # never revived from the cookie after this, on this server
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

    if DHAN_ON and key in dhan.QUOTE_IDS:  # the broker feed first, real time
        cached = detail_cache.get(("dhan", key, range_key, interval_key))
        if cached and time.monotonic() - cached[0] < DHAN_POLL_SECONDS * 0.7:
            payload = cached[1]
        else:
            try:
                try:
                    payload = await asyncio.to_thread(dhan.fetch_detail, key, range_key, interval_key, INTERVALS, RANGES, live_price(key))
                except dhan.DhanError as exc:
                    if exc.kind != "rate":
                        raise
                    await asyncio.sleep(1.5)  # Dhan's one-a-second rule: the next second is ours; one more try before anything else
                    payload = await asyncio.to_thread(dhan.fetch_detail, key, range_key, interval_key, INTERVALS, RANGES, live_price(key))
                dhan_status(True, "Dhan: real-time prices from your account; " + ticks_note if (ticks_note := dhan.intraday_problem(key))
                            else "Dhan: real-time candles and quotes from your account")
                payload.update(source="dhan", simulated=False, poll_seconds=DHAN_POLL_SECONDS, auth_enabled=AUTH_ENABLED, dhan=store["dhan"])
                detail_cache[("dhan", key, range_key, interval_key)] = (time.monotonic(), payload, now_ist()[11:19])
            except Exception as exc:
                # One refused request (Dhan's rate limit, a slow answer) must not leave the page empty: the last Dhan
                # answer is served again, the live ticks keep moving the price and the candle forming now, and the reason
                # is said. Only a token or subscription problem means Dhan is really gone.
                stale = detail_cache.get(("dhan", key, range_key, interval_key))
                keep = stale is not None and getattr(exc, "kind", "other") not in ("token", "subscription", "config")
                payload = stale[1] if keep else None
                dhan_status(False, dhan_reason(exc) + (f" The last Dhan answer (from {stale[2]} IST) is shown meanwhile, the live price still moves."
                                                      if keep else " Nothing to show meanwhile."))
                log.warning("Dhan detail failed for %s (%s): %s", key, "last answer kept" if keep else "nothing kept", exc)
        if payload is not None:  # the candles from the ticks and the server's clock are added fresh to every answer, cached or not
            return {**payload, "candles": with_live_candles(payload["candles"], key, interval_key), "now": now_ist()}

    if PROVIDER != "demo":  # Dhan alone (19 October): not set up, or refused with no earlier answer kept: the page says why and tries again
        raise HTTPException(status_code=503, detail=store["dhan"]["status"])
    cached = detail_cache.get((key, range_key, interval_key))
    if cached and time.monotonic() - cached[0] < POLL_SECONDS:
        return cached[1]
    try:
        payload = await asyncio.to_thread(fetch_detail, key, INDICES[key], range_key, interval_key)
    except Exception as exc:
        log.warning("detail fetch failed for %s: %s", key, exc)
        raise HTTPException(status_code=502, detail="Couldn't fetch the chart data from the source right now.")
    payload.update(source=PROVIDER, simulated=PROVIDER == "demo", poll_seconds=POLL_SECONDS, auth_enabled=AUTH_ENABLED, dhan=store["dhan"],
                   now=now_ist())  # the server's clock: the page judges which candles have closed by it, never by the device's clock
    detail_cache[(key, range_key, interval_key)] = (time.monotonic(), payload)
    return payload


# ---------------------------------------------------------------- the option behind each paper call (Dhan)
# The page runs the owner's rule and tells the server when a call enters and when it ends; the server
# records the contract and the premium paid, reads the premium now, and keeps the Sell mark (LOGIC.md).

@app.get("/options/{name}")
async def options_state(name: str):
    key = known_index(name)
    if not (DHAN_ON and key in dhan.OPTION_INDICES):
        return {"active": False, "status": store["dhan"]["status"], "records": []}
    try:
        problem = await asyncio.to_thread(dhan.refresh_records, key)
        expiry = await asyncio.to_thread(dhan.nearest_expiry, key)
    except Exception as exc:
        dhan_status(False, dhan_reason(exc))
        return {"active": False, "status": store["dhan"]["status"], "records": dhan.records_for(key)}
    # a premium that could not be read is said so, with the last values read left on the page, rather than
    # shown as if live (the owner saw "Now" stand still on 6 October and could not tell why)
    status = (f"Dhan: the option premiums could not be refreshed just now: {problem}. The last values read are shown."
              if problem else "Dhan: option premiums live from your account")
    return {"active": not problem, "status": status, "expiry": expiry, "lot": dhan.lot_size(key),  # the market lot: the page's profit or loss in rupees (19 October)
            "sell_share": dhan.SELL_SHARE, "records": dhan.records_for(key)}


@app.get("/options/{name}/chain")
async def options_chain(name: str, expiry: str | None = None):
    """The OI chart's data (17 October): Dhan's option chain of the index, one expiry, every strike with both legs' figures
    (dhan.chain_table). The page asks every 15 s while its OI chart is open; the chain itself is the one the premiums
    already read, kept for 5 s, so this costs Dhan no extra request."""
    key = known_index(name)
    if not (DHAN_ON and key in dhan.OPTION_INDICES):
        raise HTTPException(status_code=409, detail=store["dhan"]["status"])
    if expiry is not None:
        try:
            datetime.strptime(expiry, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="expiry must be YYYY-MM-DD")
    try:
        return await asyncio.to_thread(dhan.chain_table, key, expiry)
    except Exception as exc:
        dhan_status(False, dhan_reason(exc))
        raise HTTPException(status_code=502, detail=store["dhan"]["status"])


@app.post("/options/{name}/calls")
async def options_register(name: str, request: Request):
    key = known_index(name)
    if not (DHAN_ON and key in dhan.OPTION_INDICES):
        raise HTTPException(status_code=409, detail=store["dhan"]["status"])
    body = await request.json()
    call_key, side = str(body.get("key", ""))[:160], str(body.get("side", "")).upper()
    try:
        level = float(body.get("index_at_entry"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="index_at_entry must be a number")
    if not call_key or side not in ("CE", "PE"):
        raise HTTPException(status_code=400, detail="key and side (CE or PE) are required")
    parts, entry_time = call_key.split("|"), None
    if len(parts) == 5 and parts[1] in INTERVALS and parts[1] not in LONG_INTERVALS and parts[2].isdigit():
        entry_time = int(parts[2]) + INTERVALS[parts[1]]["bar_seconds"]  # the open of the candle after the signal candle: a page seeing the call late gets its entry minute's premium
    try:
        return await asyncio.to_thread(dhan.register_call, key, call_key, side, level, entry_time)
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


# ---------------------------------------------------------------- the record of each session (record.py)
# The Study page went on 15 October (the owner: "remove this study tab and everything under it") and the day's save with it.
# On 21 October the owner asked for the save back ("bring back the daily save, without study page"): the candles and the
# calls CSV on the data branch at 15:40, the options records backup, and the page's report of its calls below. No page over them.

LEVEL_MODES, SIGNAL_MODES = ("off", "prev", "close", "today", "shown"), ("off", "held", "crossed", "both")  # close: the previous close's lines (15 October)


@app.post("/calls/{name}")
async def calls_record(name: str, request: Request):
    """The index page tells the server the calls it shows for today's session (every call, as drawn), so the day's
    record carries each and every call that was suggested (record.record_calls, the owner's ask of 7 October)."""
    key = known_index(name)
    body = await request.json()
    interval, levels, signal = str(body.get("interval", "")), str(body.get("levels", "")), str(body.get("signal", ""))
    try:
        session = datetime.strptime(str(body.get("session", "")), "%Y-%m-%d").date().isoformat()
    except ValueError:
        raise HTTPException(status_code=400, detail="session must be YYYY-MM-DD")
    calls = body.get("calls")
    if interval not in INTERVALS or levels not in LEVEL_MODES or signal not in SIGNAL_MODES or not isinstance(calls, list) or len(calls) > 500:
        raise HTTPException(status_code=400, detail="interval, levels, signal and a list of at most 500 calls are required")
    return {"new": record.record_calls(key, interval, levels, signal, session, calls), "recorded": len(calls)}


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
    if DHAN_ON and wanted in dhan.QUOTE_IDS:  # an index page on Dhan: it gets the live ticks of its index
        live_subs[ws] = wanted
    elif not wanted:  # the dashboard: its Dhan tiles get the live price once a second
        dash_subs.add(ws)
    try:
        await ws.send_json({**store, "page": page_id})
        if wanted in live:
            await ws.send_json({"tick": tick_payload(wanted)})
        if ws in dash_subs and DHAN_ON and (snapshot := live_now()):
            await ws.send_json({"live": snapshot})  # the tiles move at once, not a second later
        while True:
            await ws.receive_text()  # keeps the connection open; the pages never send anything useful
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(ws)
        dash_subs.discard(ws)
        live_subs.pop(ws, None)
        token, page_id = ws_pages.pop(ws, (None, None))
        page = logins.get(token, {}).get("pages", {}).get(page_id)
        if page and page["socket"] is ws:  # an older connection of the page going at last says nothing
            page["socket"] = None
            page["dropped_at"] = time.time()  # the page may come back, or report in, for a while


class NoCacheStatic(StaticFiles):
    """The static files (the shared rule engine static/rules.js above all) are served with Cache-Control: no-cache, like the
    pages: the browser asks every time whether its copy is still the current one (a cheap 304 when it is), so a page that
    reloads after a merge never runs the new page with an old copy of the script. On 7 October a tab did exactly that
    after #91 ("Rules.readOf is not a function") because the script had been cached for a while."""
    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-cache"
        return response


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """The tab icon for a browser that asks /favicon.ico on its own (the pages name static/icon.svg; before 30 October this
    answer was "Login required", a 401 on every page in the browser's console, harmless but noise)."""
    return FileResponse(STATIC / "icon.svg", media_type="image/svg+xml", headers={"Cache-Control": "no-cache"})


app.mount("/static", NoCacheStatic(directory=STATIC), name="static")
