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
GRACE_SECONDS = 30  # a handover (a reload, a tile opening a new tab, a fresh login) must be taken up within this
BEAT_SECONDS = 15   # pages report in this often; one silent for twice that has stopped
DROP_SECONDS = 60   # a page with no connection and no report for this long is gone for good
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
    """Heard from recently, and since its latest connection dropped (if it did). A
    connection the server has not yet noticed is dead does not keep a page open."""
    return now - page["last_beat"] < 2 * BEAT_SECONDS and page["last_beat"] > page["dropped_at"]


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
    page_id = None
    token = ws.cookies.get(COOKIE)
    entry = logins.get(token) if AUTH_ENABLED else None
    if entry is not None:
        page_id = page_of(ws, entry) or new_page(entry)  # a page coming back keeps its id
        entry["pages"][page_id]["socket"] = ws  # its latest connection
        ws_pages[ws] = (token, page_id)
    try:
        await ws.send_json({**store, "page": page_id})
        while True:
            await ws.receive_text()  # keeps the connection open; the pages never send anything useful
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(ws)
        token, page_id = ws_pages.pop(ws, (None, None))
        page = logins.get(token, {}).get("pages", {}).get(page_id)
        if page and page["socket"] is ws:  # an older connection of the page going at last says nothing
            page["socket"] = None
            page["dropped_at"] = time.time()  # the page may come back, or report in, for a while


app.mount("/static", StaticFiles(directory=STATIC), name="static")
