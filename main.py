import asyncio
import contextlib
import logging
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
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
    "updated_at": None,
    "quotes": [],
    "failed": [],
}
clients: set[WebSocket] = set()
detail_cache: dict = {}  # (index name, range) -> (fetched at, payload)


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
    task = asyncio.create_task(refresh_forever())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="Indices API", lifespan=lifespan)


def known_index(name: str) -> str:
    key = name.upper()
    if key not in INDICES:
        raise HTTPException(status_code=404, detail=f"Unknown index '{name}'. See /indices for the list.")
    return key


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
    payload.update(source=PROVIDER, simulated=PROVIDER == "demo", poll_seconds=POLL_SECONDS)
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
    await ws.accept()
    clients.add(ws)
    try:
        await ws.send_json(store)
        while True:
            await ws.receive_text()  # keeps the connection open; the dashboard never sends anything useful
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(ws)


app.mount("/static", StaticFiles(directory=STATIC), name="static")
