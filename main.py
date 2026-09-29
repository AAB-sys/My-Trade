import asyncio
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

from providers import INDICES, RANGES, DemoTicker, fetch_all_yahoo, fetch_detail_yahoo, now_ist

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
GRACE_SECONDS = 30  # how long a handover may take (a reload, a tile opening a new tab)
COOKIE = "my_trade_session"
OPEN_PATHS = ("/login", "/logout", "/health", "/static/")

if PROVIDER == "yahoo":
    fetch_all = fetch_all_yahoo
    fetch_detail = fetch_detail_yahoo
elif PROVIDER == "demo":
    demo = DemoTicker()
    fetch_all = demo.fetch_all
    fetch_detail = lambda name, ticker, range_key: demo.fetch_detail(name, range_key)
else:
    raise SystemExit(f"Unknown DATA_PROVIDER '{PROVIDER}'. Use yahoo or demo.")

# The latest prices, kept in memory and refreshed by the background loop below.
store = {
    "source": PROVIDER,
    "simulated": PROVIDER == "demo",
    "poll_seconds": POLL_SECONDS,
    "auth_enabled": AUTH_ENABLED,
    "updated_at": None,
    "quotes": [],
    "failed": [],
}
clients: set[WebSocket] = set()
detail_cache: dict = {}  # (index name, range) -> (fetched at, payload)

# The rule for a login: it lives only while a My-Trade page is open on it, and only a page
# handed over from another page of it may carry it on. Every page holds a /ws connection.
# Every data request and /ws must carry the login's "tab" note (X-Tab header or ?tab=),
# which the login page keeps in the tab's sessionStorage and a tile passes to the tab it
# opens: a tab opened anew never has it, so it gets the password page, whatever the browser
# kept. When no page is open, a page may carry on only within a handover: one is opened
# when a page of the login is served while another page is still connected (a reload, a
# tile click), and it closes when the new page connects. The login ends when no page has
# been connected for GRACE_SECONDS. Kept in memory, so a server restart ends every login.
logins: dict[str, dict] = {}  # token -> {"pages", "last_seen", "tab", "handover_until"}
ws_tokens: dict[WebSocket, str] = {}
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


def find_login(token):
    """The login behind this cookie, or None. One whose pages have all been gone for
    longer than the grace is over."""
    if not token_ok(token):
        return None
    entry = logins.get(token)
    if entry and entry["pages"] == 0 and time.time() - entry["last_seen"] >= GRACE_SECONDS:
        del logins[token]
        entry = None
    return entry


def logged_in(connection) -> bool:
    """For data requests and /ws: the cookie, the tab note, and a page of the login
    still connected or a handover still open."""
    if not AUTH_ENABLED:
        return True
    entry = find_login(connection.cookies.get(COOKIE))
    if entry is None:
        return False
    tab = connection.headers.get("x-tab") or connection.query_params.get("tab") or ""
    if not hmac.compare_digest(tab, entry["tab"]):
        if entry["pages"] == 0:
            logins.pop(connection.cookies.get(COOKIE), None)  # nothing open, and the link opened anew: over
        return False  # a tab opened anew, not one handed over
    now = time.time()
    if entry["pages"] == 0 and now >= entry["handover_until"]:
        return False  # nothing handed over to it (a tab the browser brought back, say)
    entry["last_seen"] = now
    return True


def page_allowed(request: Request) -> bool:
    """For the HTML pages, which the browser fetches without the note: let a page of a
    live login load, and if a page is still connected, open a handover so the new page
    can carry on once the old one has gone. Its first data request settles it."""
    if not AUTH_ENABLED:
        return True
    entry = find_login(request.cookies.get(COOKIE))
    if entry is None:
        return False
    if entry["pages"] > 0:
        entry["handover_until"] = time.time() + GRACE_SECONDS
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
            if result["quotes"]:
                store.update(quotes=result["quotes"], failed=result["failed"], updated_at=now_ist())
                await broadcast(store)
            else:
                log.warning("refresh returned no quotes: failed=%s", result["failed"])
        except Exception as exc:
            log.warning("refresh failed: %s", exc)
        await asyncio.sleep(POLL_SECONDS)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    if not AUTH_ENABLED:
        log.warning("DASHBOARD_PASSWORD is not set: anyone who can reach this server can see the dashboard.")
    task = asyncio.create_task(refresh_forever())
    yield
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
    now = time.time()
    for dead in [t for t, e in logins.items() if e["pages"] == 0 and now - e["last_seen"] >= GRACE_SECONDS]:
        del logins[dead]
    token = make_token()
    logins[token] = {"pages": 0, "last_seen": now, "tab": secrets.token_urlsafe(16),
                     "handover_until": now + GRACE_SECONDS}  # the login itself hands over to the first page
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
    for ws, ws_token in list(ws_tokens.items()):  # every open page on this login, in any tab
        if ws_token == token:
            with contextlib.suppress(Exception):
                await ws.close(code=1008)
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE)
    return response


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
async def index_detail(name: str, range_key: str = Query("today", alias="range")):
    key = known_index(name)
    if range_key not in RANGES:
        raise HTTPException(status_code=400, detail=f"range must be one of: {', '.join(RANGES)}")

    cached = detail_cache.get((key, range_key))
    if cached and time.monotonic() - cached[0] < POLL_SECONDS:
        return cached[1]
    try:
        payload = await asyncio.to_thread(fetch_detail, key, INDICES[key], range_key)
    except Exception as exc:
        log.warning("detail fetch failed for %s: %s", key, exc)
        raise HTTPException(status_code=502, detail="Couldn't fetch the chart data from the source right now.")
    payload.update(source=PROVIDER, simulated=PROVIDER == "demo", poll_seconds=POLL_SECONDS, auth_enabled=AUTH_ENABLED)
    detail_cache[(key, range_key)] = (time.monotonic(), payload)
    return payload


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
    token = ws.cookies.get(COOKIE)
    entry = logins.get(token)
    if entry:
        entry["pages"] += 1
        entry["handover_until"] = 0  # the handover is used up: this page is connected now
        ws_tokens[ws] = token
    try:
        await ws.send_json(store)
        while True:
            await ws.receive_text()  # keeps the connection open; the pages never send anything useful
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(ws)
        entry = logins.get(ws_tokens.pop(ws, None))
        if entry:
            entry["pages"] -= 1
            entry["last_seen"] = time.time()


app.mount("/static", StaticFiles(directory=STATIC), name="static")
