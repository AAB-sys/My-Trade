# My-Trade

An API that serves the current value of the major Indian market indices, and a
dashboard that shows them and updates the moment they change.

## Menu

| Method | Endpoint          | You send      | You get back                                                  |
|--------|-------------------|---------------|---------------------------------------------------------------|
| GET    | `/login`          | nothing       | the login page (only when a password is set)                  |
| POST   | `/login`          | `{"password": "..."}` | sets the login cookie, or 401                          |
| POST   | `/logout`         | nothing       | clears the login cookie                                       |
| POST   | `/alive`          | the tab note and page id (headers) | "still here" from an open page: the latest snapshot plus the page's id |
| GET    | `/health`         | nothing       | `{"status": "ok"}` - open, for the host's health checks       |
| GET    | `/`               | nothing       | the dashboard page                                            |
| GET    | `/index/{name}`   | an index name | the detail page for that index (summary + chart)              |
| GET    | `/indices`        | nothing       | the list of index names this API serves                       |
| GET    | `/indices/all`    | nothing       | the latest snapshot: `quotes`, `failed`, `source`, `updated_at` |
| GET    | `/indices/{name}` | an index name | that index's latest quote (503 until the first refresh lands) |
| GET    | `/indices/{name}/detail` | an index name, `?range=today` (5-min bars) or `5d` (15-min bars) | `summary` (previous day OHLC, today's OHL, last, change, 52-week range) and `candles` |
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
| `DASHBOARD_PASSWORD` | any text    | Turns the login on. Unset = open (the dashboard shows a warning). Required before hosting |
| `SESSION_SECRET` | a long random string | Signs the login cookie. Optional: a restart ends every login anyway |
| `HOST`          | `127.0.0.1` (default), `0.0.0.0` | Read by `start.bat`. `0.0.0.0` lets other devices on the same network open the dashboard |
| `PORT`          | a number, default `8000` | Read by `start.bat` |

## From other devices at home

Set `HOST=0.0.0.0` (and a `DASHBOARD_PASSWORD`) in `.env`, run `start.bat`, and it
prints this computer's network addresses. On your phone or another laptop on the
same Wi-Fi, open `http://<one of those addresses>:8000/` and log in. The first time,
Windows asks whether to let Python through the firewall: allow it on private
networks. It works only while this computer is on and `start.bat` is running.

`demo` needs no internet and ticks every second, so you can watch the dashboard
move with the market closed. The page shows a red **SIMULATED DATA** badge whenever
it is on.

## Login

With `DASHBOARD_PASSWORD` set, every page and every menu row (including `/ws`)
requires the login cookie; without it, browsers are sent to `/login` and API
calls get 401. The cookie is signed with `SESSION_SECRET`, is HttpOnly, and is
marked Secure when served over HTTPS.

The rule for a login: **it lives only while a My-Trade page is open, and only a
page handed over from another page of it may carry it on.** Three things make that
true:

- Every data request and the `/ws` connection must carry the login's *tab note*
  (`X-Tab` header, `?tab=` on `/ws`). The login page keeps it in the tab's
  `sessionStorage`, so a reload or "back to dashboard" in the same tab still has
  it, and a tile passes it to the tab it opens (in the link's `#t=`, dropped from
  the address bar on arrival). A tab opened anew never has it, so opening the link
  again, even a second after closing, shows the password page, whatever cookie the
  browser kept, and whether or not another page is still open somewhere.
- Every page has a *page id* (`X-Page` header, `?page=` on `/ws`), held in the
  page's memory only. The server gives it when the page first connects or reports
  in. A page keeps its login alive by holding `/ws` or by reporting in (`POST
  /alive`) every 15 seconds, and a page whose connection drops comes back with the
  same id, so a flaky connection (a phone, say) never logs you out while the page
  is open. A tab the browser brings back by itself after a restart has no page id.
- A page without an id is let in only inside a *handover*: the server opens one
  when it serves a page while another page of the login is open (a reload, a tile
  click), or at login for the first page, and closes it as soon as the new page
  gets its id. A page that has not reported in for 60 seconds is gone; a login with
  no page left and no handover open is over.

So closing the browser, closing the last tab, a server restart, or leaving a page
in the background on a phone until its connection drops, all mean logging in
again. A browser that is never closed is logged out after 30 days anyway. The
**Log out** button in the page header ends the login at once, in every tab. A
wrong password waits a second before answering, which makes guessing slow.
`/health` (which also shows the running commit on the host) and `/static/*` stay
open.

## Hosting

The app is ready to run on a platform that deploys from GitHub:

- `Procfile` gives the start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- Set these in the host's environment (never in the repo): `DASHBOARD_PASSWORD`,
  `SESSION_SECRET`, `DATA_PROVIDER=yahoo`. The host provides `PORT` and HTTPS.
- Run exactly **one** instance: prices live in the server's memory.
- Use the host's health check on `/health`.
- Keep it private (your login only): the free Yahoo feed, and any licensed feed
  later, are for personal use.

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
  reconnects by itself if the connection drops. Every tile is a link to that
  index's detail page, opened in a new tab.
- `static/detail.html` is the detail page: previous-day and today's figures, the
  52-week range, and a chart with Line/Candles and Today/5-days switches, hover
  crosshair with the bar's values, light and dark. Click any bar (or point on the
  line) for a small pop-up with that bar's time, open, high, low and close; click elsewhere,
  press Esc or its x to close it. It refreshes on the source's rhythm. The chart is drawn by Lightweight Charts (Apache-2.0), bundled in
  `static/vendor/` so nothing is fetched from anyone else's server at runtime.

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
