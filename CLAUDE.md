# My-Trade

This is the owner's own dashboard and application, built to their own design and
their own logic. Read this before touching the code.

## How to work on it

- Everything here runs on the owner's own logic. Build only what the owner
  specifies, in the words they specify it. Do not propose or shape features after
  how other products do them, do not point them at other brokers' apps, APIs or
  dashboards as references or models, and do not compare this project to them.
  Index-Trading (a separate repository) is not a template for this one.
- When a behaviour is not specified, ask the owner rather than filling the gap
  with a convention from elsewhere. A trivial gap (e.g. what a stray click does)
  may be filled with the smallest reasonable choice, stated plainly so the owner
  can overrule it.
- Rules, thresholds, rankings, alert conditions and anything that decides an
  order are written from what the owner says, never from a textbook or another
  product. Tools (Python, FastAPI, Git, the chart library) and the raw price feed
  are not "logic" and are the only things not authored by the owner.
- Real-time ticks will need a licensed market-data supplier at some point. Treat
  that purely as a supply choice the owner makes: ask which one, once, then
  implement against it. No recommendations, no comparisons.
- The owner is learning as they build. Explain every change in plain language,
  one step at a time, with what they should see on screen. Prefer branch + pull
  request so they review and merge; they then `git pull` on a Windows laptop and
  run `start.bat`.
- Before writing code that draws data (tiles, charts), load the `dataviz` skill.
- The owner's trading logic lives in `LOGIC.md`, in plain words, with every open
  choice marked "(owner to decide)". Code that implements it points there. Never
  settle an open choice silently: pick the smallest reasonable one, mark it, and
  make it a switch where that is cheap.

## Shape of the project

- `providers.py` - data sources. Each is a callable returning
  `{"quotes": [...], "failed": [...]}`. Currently `yahoo` (~15 min delayed) and
  `demo` (simulated). A broker feed goes here as a third source.
- `main.py` - the server: in-memory store, background refresh loop, REST menu,
  `/ws` WebSocket push, 5-line `.env` reader (`DATA_PROVIDER`, `POLL_SECONDS`,
  `DASHBOARD_PASSWORD`, `SESSION_SECRET`), single-password login with a signed
  session cookie that guards every route and `/ws` (`/login`, `/logout`,
  `/health` and `/static/*` stay open). The owner's rule: a login lives only
  while a page is open on it, and only a page handed over from another page of
  it may carry it on. Every data request and `/ws` must carry the login's "tab"
  note (sessionStorage; `X-Tab` / `?tab=`; a tile passes it in `#t=`), so a tab
  opened anew always gets the password page. Every page has a page id (memory
  only; `X-Page` / `?page=`), given on first connect or report; it keeps the
  login alive by holding `/ws` or reporting in (`POST /alive`) every 15 s when
  in front (a background tab reports about once a minute, a phone not at all),
  so a page counts as open while its connection is up or for
  `DASHBOARD_OPEN_SECONDS` (10 min) after its last report, and may come back
  after a drop. A page without an id is let in only within a handover (opened
  when a page is served while another is open, or at login; used up when the
  new page gets its id). A page silent for `DASHBOARD_DROP_SECONDS` (4 h) is
  gone; a login with no page and no handover is over. 30-day ceiling; kept in memory,
  so a restart ends it. No password set = open, with a warning. Pages show a
  **Log out** button whenever the login is on.
- `dhan.py` - the owner's broker API (DhanHQ v2) as a data source: settings from
  `DHAN_CLIENT_ID`/`DHAN_ACCESS_TOKEN`, data endpoints only. Real-time candles,
  quotes and the option chain for `INDEX_IDS` (NIFTY 50, NIFTY BANK), with small
  caches for Dhan's rate limits; the record of each paper call's option (strike
  one in the money, nearest expiry, premium paid, premium now, the Sell mark) in
  `paper_calls.json`; `status()`/`deep_checks()` in plain words for
  `check_dhan.py`/`check_dhan.bat`. `main.py` serves NIFTY 50/NIFTY BANK details
  from Dhan when configured (fallback to the usual source, reason in
  `store["dhan"]`), the `/options/{name}` routes the page uses, and
  `tick_forever()`: while an index page on Dhan is open (`/ws?live=<index>`) in
  market hours, the last price every `DHAN_TICK_SECONDS`, folded into the candle
  forming now (`live`) and pushed to those pages as `{"tick": ...}`; the page
  moves the price, the last candle and the levels note on each tick and fetches
  the candles when a new one begins.
- `static/login.html` - the login page. `Procfile` - the host's start command.
  Hosting: one instance, secrets in the host's environment, `/health` for checks.
- `start.bat` reads `HOST`/`PORT` from `.env` (defaults `127.0.0.1`/`8000`);
  `HOST=0.0.0.0` opens the dashboard to other devices on the owner's home network
  and prints the addresses to use.
- `static/index.html` - the dashboard: opens `/ws`, redraws on each message;
  each tile links to `/index/{name}` in a new tab.
- `static/detail.html` - the per-index page: summary figures and a Line/Candles,
  1/5/15-minute, Today/5-days chart fed by `/indices/{name}/detail`
  (`?range=&interval=`), plus layers 1, 2 and 3 of `LOGIC.md` (level price lines
  with a readout; a held/crossed table per level under the chart; the paper
  trades the owner's rule gives on the closed candles, with a score line and a
  CSV download; nothing drawn on the chart), computed in the page from the
  summary and the bars. Chart drawn with
  Lightweight Charts, bundled in `static/vendor/` (do not load it from a CDN).
- `start.bat` - one-click start on Windows. `.env` is git-ignored; `.env.example`
  documents the settings.

## Phases

1. API - done. 2. Dashboard - done. 3a. Streaming plumbing - done.
3b. Licensed real-time feed - waiting on the owner's supplier choice.
4. Orders - paper first, with hard limits, before anything real.
