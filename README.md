# My-Trade

An API that serves the current value of the major Indian market indices, and a
dashboard that shows them and updates the moment they change.

## Menu

| Method | Endpoint          | You send      | You get back                                                  |
|--------|-------------------|---------------|---------------------------------------------------------------|
| GET    | `/`               | nothing       | the dashboard page                                            |
| GET    | `/indices`        | nothing       | the list of index names this API serves                       |
| GET    | `/indices/all`    | nothing       | the latest snapshot: `quotes`, `failed`, `source`, `updated_at` |
| GET    | `/indices/{name}` | an index name | that index's latest quote (503 until the first refresh lands) |
| WS     | `/ws`             | nothing       | the snapshot on connect, then every new snapshot as it lands  |

Try `/docs` for the interactive version of this table.

## Run it

```
python -m venv .venv
.venv\Scripts\activate          (Windows)   |   source .venv/bin/activate   (Mac/Linux)
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Then open <http://127.0.0.1:8000/> for the dashboard, or
<http://127.0.0.1:8000/docs> for the menu.

On Windows, double-click `start.bat` instead: on first run it creates the virtual
environment and installs dependencies; every run starts the server and opens the
dashboard in your browser. Press Ctrl+C in its window to stop.

## Settings (`.env`)

Copy `.env.example` to `.env` and edit it. The server reads it on startup.

| Setting         | Values           | Meaning                                                       |
|-----------------|------------------|---------------------------------------------------------------|
| `DATA_PROVIDER` | `yahoo` (default), `demo` | Real prices from Yahoo Finance, or a simulated random walk for testing |
| `POLL_SECONDS`  | a number         | How often the server refreshes. Defaults: 60 for yahoo, 1 for demo |

`demo` needs no internet and ticks every second, so you can watch the dashboard
move with the market closed. The page shows a red **SIMULATED DATA** badge whenever
it is on.

## How it works

```
  source (yahoo | demo)  ──▶  background loop  ──▶  memory: latest 19 quotes  ──▶  /ws  ──▶  every open dashboard
                              every POLL_SECONDS                                   pushed the instant it changes
                                                                                    /indices/all, /indices/{name} read the same memory
```

- `providers.py` holds the sources. Each one is a function that returns
  `{"quotes": [...], "failed": [...]}`. A real-time broker feed will be a third
  source that drops ticks into the same place; nothing downstream changes.
- `main.py` runs the loop, keeps the memory, serves the menu, and pushes
  snapshots to WebSocket clients.
- `static/index.html` opens the WebSocket, redraws on every message, and
  reconnects by itself if the connection drops.

## Phases

1. **The API** - done. Menu, real data from Yahoo, proper errors, on GitHub.
2. **The dashboard** - done. Tiles, NIFTY 50 and SENSEX pinned, gainers to losers,
   light and dark, phone-friendly, failures named rather than hidden.
3. **Real time**
   - 3a - done. Streaming plumbing: in-memory store, background refresh,
     WebSocket push, pluggable source, simulated mode.
   - 3b - next. A licensed broker feed as a source (needs a broker account with
     API access). Until then the data is Yahoo's, ~15 minutes delayed; only the
     delivery is instant.
4. **Orders** - paper trading first, with hard limits, before anything real.
