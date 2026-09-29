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

## Shape of the project

- `providers.py` - data sources. Each is a callable returning
  `{"quotes": [...], "failed": [...]}`. Currently `yahoo` (~15 min delayed) and
  `demo` (simulated). A broker feed goes here as a third source.
- `main.py` - the server: in-memory store, background refresh loop, REST menu,
  `/ws` WebSocket push, 5-line `.env` reader (`DATA_PROVIDER`, `POLL_SECONDS`,
  `DASHBOARD_PASSWORD`, `SESSION_SECRET`), single-password login with a signed
  session cookie that guards every route and `/ws` (`/login`, `/logout`,
  `/health` and `/static/*` stay open). The owner's rule: a login lives only
  while a page is open on it (each page holds `/ws`). After the last page
  closes, only a page carrying the login's "tab" note (sessionStorage, sent as
  `X-Tab` / `?tab=`) may carry it on within 30 s, i.e. a reload; a freshly opened
  tab has no note and ends the login, so opening the link anew always asks for
  the password. 30-day ceiling; kept in memory, so a restart ends it. No
  password set = open, with a warning. Pages show a **Log out** button whenever
  the login is on.
- `static/login.html` - the login page. `Procfile` - the host's start command.
  Hosting: one instance, secrets in the host's environment, `/health` for checks.
- `start.bat` reads `HOST`/`PORT` from `.env` (defaults `127.0.0.1`/`8000`);
  `HOST=0.0.0.0` opens the dashboard to other devices on the owner's home network
  and prints the addresses to use.
- `static/index.html` - the dashboard: opens `/ws`, redraws on each message;
  each tile links to `/index/{name}` in a new tab.
- `static/detail.html` - the per-index page: summary figures and a Line/Candles,
  Today/5-days chart fed by `/indices/{name}/detail`. Chart drawn with
  Lightweight Charts, bundled in `static/vendor/` (do not load it from a CDN).
- `start.bat` - one-click start on Windows. `.env` is git-ignored; `.env.example`
  documents the settings.

## Phases

1. API - done. 2. Dashboard - done. 3a. Streaming plumbing - done.
3b. Licensed real-time feed - waiting on the owner's supplier choice.
4. Orders - paper first, with hard limits, before anything real.
