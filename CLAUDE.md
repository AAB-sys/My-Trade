# My-Trade

This is the owner's own dashboard and application, built to their own design and
their own logic. Read this before touching the code.

## How to work on it

- The design decisions are the owner's. Do not point them at other brokers' apps,
  APIs or dashboards as references or models, and do not compare this project to
  them. Index-Trading (a separate repository) is not a template for this one.
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
  `/ws` WebSocket push, 5-line `.env` reader (`DATA_PROVIDER`, `POLL_SECONDS`).
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
