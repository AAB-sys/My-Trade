import asyncio
import contextlib
import logging
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from providers import INDICES, DemoTicker, fetch_all_yahoo, now_ist

BASE = Path(__file__).parent
DASHBOARD = BASE / "static" / "index.html"
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
elif PROVIDER == "demo":
    fetch_all = DemoTicker().fetch_all
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


@app.get("/")
def dashboard():
    return FileResponse(DASHBOARD, headers={"Cache-Control": "no-cache"})


@app.get("/indices")
def list_indices():
    return sorted(INDICES)


@app.get("/indices/all")
def all_indices():
    return store


@app.get("/indices/{name}")
def get_index(name: str):
    key = name.upper()
    if key not in INDICES:
        raise HTTPException(status_code=404, detail=f"Unknown index '{name}'. See /indices for the list.")
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
