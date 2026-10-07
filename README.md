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
| GET    | `/health`         | nothing       | `{"status": "ok", ...}` - open, for the host's health checks and the wake-up workflow: the commit, under `token` whether Dhan accepts the token and until when, under `study` the latest saved day and any saving problem |
| GET    | `/`               | nothing       | the dashboard page                                            |
| GET    | `/index/{name}`   | an index name | the detail page for that index (summary + chart)              |
| GET    | `/indices`        | nothing       | the list of index names this API serves                       |
| GET    | `/indices/all`    | nothing       | the latest snapshot: `quotes`, `failed`, `source`, `updated_at` |
| GET    | `/indices/{name}` | an index name | that index's latest quote (503 until the first refresh lands) |
| GET    | `/indices/{name}/detail` | an index name, `?range=today`, `5d` or `3mo`, `&interval=1m`, `5m` (default), `15m`, `30m` or `1d` | `summary` (previous day OHLC, today's OHL, last, change, 52-week range), `candles` of that size and `days` (a month of daily OHLC, for each session's own previous-day levels) |
| GET    | `/options/{name}` | an index name | the Dhan feed's state and today's option records of the index's paper calls (Dhan only) |
| POST   | `/options/{name}/calls`, `/options/{name}/calls/ended` | JSON `{key, side, index_at_entry, ...}` / `{key, how}` | the index page reports a call entering or ending; the server records the contract and premiums |
| GET    | `/study/`         | nothing       | the study page: the rules replayed over every saved day            |
| GET    | `/study/days`, `/study/days/{date}` | a date as YYYY-MM-DD | the saved days (newest first) and where they are kept; one day's record |
| POST   | `/calls/{name}`   | JSON `{interval, levels, signal, session, calls: [...]}` | the index page reports the calls it shows for today; the server records each and every one for the day's CSV |
| POST   | `/study/save`     | nothing       | saves today now (a partial copy during the session, the final one after it) |
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

To bring the folder up to date with GitHub later, double-click `update.bat`: it
runs `git pull origin main` for you and says whether it worked.

## Settings (`.env`)

Copy `.env.example` to `.env` and edit it. The server reads it on startup.

| Setting         | Values           | Meaning                                                       |
|-----------------|------------------|---------------------------------------------------------------|
| `DATA_PROVIDER` | `yahoo` (default), `demo` | Real prices from Yahoo Finance, or a simulated random walk for testing |
| `POLL_SECONDS`  | a number         | How often the server refreshes. Defaults: 60 for yahoo, 1 for demo |
| `DASHBOARD_PASSWORD` | any text    | Turns the login on. Unset = open (the dashboard shows a warning). Required before hosting |
| `SESSION_SECRET` | a long random string | Signs the login cookie. With it set, a login survives a server restart (every merge is one): the page carries on by itself. Without it, every restart logs you out |
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

## Dhan: the owner's broker feed

Real-time candles and quotes for NIFTY 50, NIFTY BANK and SENSEX, and option
premiums for NIFTY 50 and NIFTY BANK, come from the owner's Dhan account through
DhanHQ's API, under its Data API subscription; every other index, and every Dhan
failure, falls back to Yahoo. On the dashboard, the top row is NIFTY 50, NIFTY
BANK and SENSEX, and those tiles show exactly what their pages' headers show,
at all hours, from the same computation (in market hours marked "Dhan · live"
and moving every second, after the close "Dhan · closed"; `/health`'s
`feed.tiles_problem` says if an index's figures could not be read);
the other tiles are Yahoo's, about 15 minutes delayed,
and the footer says which is which. `/health`'s `feed.ids` is null, or what
Dhan's instrument list says differs from the index ids the code uses.
The index page says which feed it is on; while it is open during market hours
the price and the candle forming now move tick by tick: the server holds one
connection to Dhan's market feed (`wss://api-feed.dhan.co`, ticker packets for
the indices it covers) and pushes every tick to the page over its `/ws`
connection; whenever that stream is quiet it falls back to one price request a
second, and its paper calls gain the option
behind each call (one strike in the money, nearest expiry), the premium paid at
entry, the premium now and the red Sell mark once the premium has fallen by 35%
(`LOGIC.md`, "Exit by premium"). The premium now moves tick by tick too: each
open call's contract is added to the same feed connection (its security id read
from Dhan's instrument list, a CSV fetched once at start and every 6 hours), the
once-a-second poll carries it when the feed is quiet, and the option chain is
read only when neither runs. Records live in `paper_calls.json` (git-ignored)
and, with the GitHub token set, go to the `data` branch as `records/<date>.json`
within half a minute of a call entering, getting its contract, its Sell mark or
its end; a fresh server (every restart on Render empties the disk) fetches the
day's records back at start, so the premium paid and the sell line stay what
they were (7 October).
Two settings, in `.env` on the laptop and in Render's Environment, never in the
repo:

    DHAN_CLIENT_ID=...        the account's client id
    DHAN_ACCESS_TOKEN=...     from the Dhan website, Profile > DhanHQ Trading APIs

The token lasts 24 hours, so each trading morning: generate a new one on the
Dhan website, paste it into Render's Environment (Render restarts the dashboard;
log in again) and into `.env` if the laptop runs it. **Every merge on GitHub
restarts Render too**, which stops the live price for a minute or two, so merge
after 15:30 unless the change is the fix you are waiting for. A page left open
reloads itself once the server is up with the new code (every answer carries
the commit the server runs), and the pages and their script files are served
"no-cache" (the browser checks for a newer copy on every load), so what you see
is always the merged version.
Dhan allows one quote request a second: the server spaces its requests out
(`dhan.py`), and `/health` shows the live feed's state (`feed`: the stream, the
poll, who is watching, the last price and when) with no login. `check_dhan.bat` (or
`python check_dhan.py`) checks the settings, the token, the subscription, a
price, the candles and the option chain, and says in plain words what to fix.
Only data is read; nothing here can place an order. `DHAN_POLL_SECONDS` (default
15) is how often the index page refreshes its candles and calls on Dhan;
`WATCH_INTERVAL`, `WATCH_LEVELS`, `WATCH_SIGNAL` (defaults `5m`, `today`, `both`)
are the setting the server watches the calls in by itself, every `WATCH_SECONDS`
(5) in market hours, so a call entering with no page open is still recorded
(`rule.py` is the page's rule in Python; `python3 check_rule.py` proves the two
give the same calls); with the watcher on, the live feed runs all session whether
or not a page is open, and the server keeps the premium now and the Sell mark of
both indices' open calls current itself (`/health`'s `watch` says `without_id`,
open calls whose contract is not on the feed yet, and `premiums`, why a premium
could not be read just now, or null);
`DHAN_TICK_SECONDS` (default 1) how often the live price is read while an index
page is open in market hours and the stream is quiet; `SELL_SHARE` (default 0.65) is the sell point as a
share of the premium paid.

## The record of each session, and the study

After every session the server saves the day's candles (NIFTY 50 and NIFTY
BANK, in 1, 5, 15 and 30 minutes, with the day's and the previous day's open,
high, low and close) to `data/sessions/<date>.json`, and beside it every call
the index page suggested that day to `data/sessions/<date>-calls.csv` (the page
sends its list as it draws it, `POST /calls/{name}`), with a partial copy of
both every few minutes during the session, and the options behind the day's
calls to `records/<date>.json` as they change. **Study**
(linked from the dashboard and the index page, `/study/`) replays your rules
over every saved day: pick the index, the time frame, the levels and the signal,
and read the paper calls day by day, by hour, by level, by side, and every
setting side by side; then each day's pattern (the gap at the open, the range,
when the high and the low came, breaks of the previous day's high and low), how
the candles behave at every Fibonacci level (touched, held, crossed, and whether
the price then reached the next level), and the candle high and low breaks. A
learning step on the candles' facts switches on once a setting has 100 finished
calls over 10 days (`LOGIC.md`, layer 4). **Ideas under test** (`LOGIC.md`, layer
5) are switches on the Study page only, each scored against your rule on every
saved day in the table "Your rule against the ideas under test"; the index page
does not use them. `lab/replay.js` replays every idea tried so far over the saved
days, and `lab/findings.md` is the log of each round.

Render's files do not last (a restart wipes them), so each day is also pushed to
the `data` branch of your own repository. That needs one more secret, made once:

1. On GitHub, click your photo (top right) > **Settings** > **Developer settings**
   (the last item on the left) > **Personal access tokens** > **Fine-grained
   tokens** > **Generate new token**.
2. Name it `My-Trade data`; set the longest expiration offered.
3. Repository access: **Only select repositories**, pick this repository.
4. Permissions > Repository permissions > **Contents**: **Read and write**.
   (Metadata: read-only is added by itself.)
5. Generate it and copy it: GitHub shows it once.
6. On Render, open the service > **Environment** > add `GITHUB_DATA_TOKEN` with
   that value > save. Render restarts the dashboard. Add the same line to `.env`
   only if the laptop runs the server too. Never paste the token into the repo or
   into a chat.

**Nobody has to look after the saving** (the owner's instruction, 6 October).
Render puts the server to sleep when nobody is on a page, and a sleeping server
saves nothing, so `.github/workflows/wake.yml` knocks on the server's open
health address at 15:42 IST on weekdays (the server wakes and saves the day on
its own), and at 16:10 reads `/health` to check that the day is saved and
pushed. A failed check is a red run under the Actions tab, and GitHub emails
the owner about failed runs; the research round reads it too. `/health` now
says, without a login and without any secret, the latest day with its final
copy, whether today was checked and found without a session (a holiday), and
any problem in plain words. The one thing the server cannot do by itself is
renew the Dhan access token: with an expired token there are no candles to
save. So the server asks Dhan every half hour whether the token is good and
until when (`token_forever()`, one small request), `/health` says it under
`token` (a yes or no, the time it is valid till, a plain reason; never the
token itself), and the workflow's runs turn red with the reason when the token
is refused or will have expired before the next trading day's close. Dhan's
token page may offer a validity longer than a day; the longest offered means
fewer renewals. A day missed for a bad token is saved at the next wake with a
good one, for up to a week back.

The first save creates the `data` branch (data only; never merge it into
`main`): on the repository page, open the branch drop-down and pick `data` to
see the files. The study page's first line says how many days are saved, where
they are kept and any problem with the push. `STUDY_SAVE_AT` (default `15:40`,
IST) is when the final copy is saved; `GITHUB_DATA_REPO` and
`GITHUB_DATA_BRANCH` (defaults: this repository, `data`) say where it goes;
`STUDY_DIR` is the folder on this computer (default: `data` next to `main.py`).
Only sessions on Dhan are recorded, and nothing is sent anywhere but your own
repository.

## Android app

`android/` is the dashboard as a phone app: one full-screen view of the owner's
server, the screen kept awake while it is open, the login's tab note carried
from page to page, Download CSV saved to the phone's Downloads. GitHub builds it
(`.github/workflows/android.yml`) and publishes **My-Trade.apk** on the
repository's Releases page under `app-latest`; install it from there on the
phone. Details in `android/README.md`.

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
  /alive`) every 15 seconds while it is in front; a background tab reports in only
  about once a minute and a phone stops altogether, so a page counts as open while
  its connection is up or for 10 minutes after its last report
  (`DASHBOARD_OPEN_SECONDS`), and a page whose connection drops comes back with
  the same id. A tab the browser brings back by itself after a restart has no page id.
- A page without an id is let in only inside a *handover*: the server opens one
  when it serves a page while another page of the login is open (a reload, a tile
  click), or at login for the first page, and closes it as soon as the new page
  gets its id. A page that has not reported in for 4 hours
  (`DASHBOARD_DROP_SECONDS`) is gone; a login with no page left and no handover
  open is over.

So closing the browser or closing the last tab means logging in again. A server
restart (every merge restarts Render) no longer does, when `SESSION_SECRET` is set:
the cookie is still signed and in date, so the login is revived and the page
carries on by itself within seconds (7 October). **Log out** ends it for good. A page left in the background, on the laptop or the phone, is
still logged in when you come back to it within 4 hours. A browser that is never closed is logged out after 30 days anyway. The
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
- `study.py` keeps the record of each session's candles (`data/sessions/`, and
  the `data` branch on GitHub) and `static/study.html` replays the rules over
  it and reads the candles' patterns, with the same `static/rules.js` the index
  page runs.
- `LOGIC.md` is the owner's own trading logic in plain words: what is built, what
  is still the owner's to decide. The index page draws its first layer, Fibonacci
  levels of a chosen move, as lines on the chart with a one-line readout; its
  second, whether a closed candle held or crossed a level, is the signal of its
  third, the paper trades that rule would have given on those candles (a Held/Crossed/Both switch, the call the
  moment the signal candle closes, buy a CE or a PE, entry at the next price, the next level as
  target and no stop, one call per level and direction until the index closes
  back across it, closed at the day's end), listed one row each with "what now"
  first (enter, hold, sell now, sold, target hit, closed at day end), scored,
  and downloadable as a CSV file.
  Nothing else is drawn on the chart, and nothing is sent anywhere.
- `static/detail.html` is the detail page: the previous session's and today's figures,
  the 52-week range, and a chart with a Line/Candles switch and three drop-downs:
  the time frame (1, 5, 15 or 30-minute candles, or one candle a day), the levels,
  and the session (today by default, any of the last five days, or all five together;
  on day candles, the last three months), zoom and move buttons (the wheel and the touchpad do the
  same over the chart: wheel for price up/down, shift+wheel or a sideways swipe for
  time, ctrl+wheel or a pinch for zoom), hover
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
