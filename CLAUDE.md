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
- Ideas of Claude's own (the owner's standing instruction, 6 October): Claude may
  read the saved candles (`data/sessions`, the `data` branch) and propose rules
  built from this framework and these candles, never borrowed from elsewhere.
  The research works on the candles and their levels only (7 October, restated):
  never the option premiums, in any table, idea, learning step or proposal. The
  premium columns of the calls CSV are dropped on read in `lab/replay.js`, and
  the `records/<date>.json` files are never research input. A
  proposal goes to the owner with the numbers, and **nothing is built until the
  owner confirms**. A confirmed idea goes to the Study page first, as a switch
  scored against the owner's rule on every saved day (`Rules.IDEAS` in
  `static/rules.js`, options the index page never passes), and to the live index
  page only after about 20 saved days still show it ahead, and only when the
  owner says so. A study round never changes the index page's logic. The lab
  (`lab/replay.js`, `lab/findings.md`) is the record of what was tested.

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
- `rule.py` - the owner's rule (layers 1 to 3) in Python, the page's engine line
  for line, so the server can watch the calls itself (`calls_forever` /
  `watch_index` in `main.py`, setting `WATCH_INTERVAL`/`WATCH_LEVELS`/`WATCH_SIGNAL`; `WATCH_LEVELS` is a list, default
  `today,prev`, each mode run by `watch_levels` on the candles fetched once (9 October),
  state on `/health` under `feed.watch`; `watch_premiums` then keeps the open
  records' security ids, premium now and Sell mark current for both indices,
  page or no page: until 7 October only an open page did, and NIFTY BANK's
  premiums stood still all afternoon). `check_rule.py [folder]` runs the page's
  engine (node, static/rules.js) and this copy side by side over every saved day,
  the hand-made day and random days, replayed and live, every setting and idea,
  and fails on one differing call. Any change to the rule goes into both files
  and must pass it; a research round runs it too.
- `dhan.py` - the owner's broker API (DhanHQ v2) as a data source: settings from
  `DHAN_CLIENT_ID`/`DHAN_ACCESS_TOKEN`, data endpoints only. Real-time candles,
  quotes for `QUOTE_IDS` (NIFTY 50, NIFTY BANK, SENSEX; the ids are checked
  against Dhan's instrument list once it is read, `id_problem()` on `/health`
  as `feed.ids`; `list_report()` as `feed.option_list`: ids per underlying, SENSEX's expiries, a few SENSEX rows as written;
  SENSEX's BSE rows are matched by `_bse_underlying` on any name column, never SENSEX50 or BANKEX, 9 October)
  and the option chain for `OPTION_INDICES` (NIFTY 50, NIFTY BANK, and SENSEX on the BSE since
  8 October; `OPTION_SEGMENTS` says each one's segment, NSE_FNO or BSE_FNO, and `open_options` keys the contracts
  by (segment, security id) for the feed and the poll; `INDEX_IDS` stays the two whose days are saved), with small
  caches for Dhan's rate limits and every request paced to them in `call()`
  (`_pace`: market-feed requests 1.2 s apart, option chain 3.1 s; on 7 October
  the once-a-second poll and the page's quote in the same second got the quote
  refused and the page thrown to Yahoo; a request waits for its turn outside
  the lock, so the chain's gap never holds up the poll, and `cached` remakes a
  value by one caller at a time); `fetch_detail` takes the live price
  the server holds, so it needs no quote request while ticks flow; the record of each paper call's option (strike
  one in the money, nearest expiry, premium paid, premium now, the Sell mark) in
  `paper_calls.json` (and on the data branch as `records/<date>.json`, pushed by
  `study.py` when `records_version()` moves and pulled at start, so a restart
  keeps the premium paid; `end_day()` at the day's final save marks every record
  of the day still open as ended, nothing carries overnight), with the contract's security id from Dhan's instrument list
  (`option_ids()`, a CSV at `DHAN_SCRIP_MASTER_URL`) so the feed and the poll in
  `main.py` carry its premium tick by tick (`note_premium`, `open_options`); `status()`/`deep_checks()` in plain words for
  `check_dhan.py`/`check_dhan.bat`. `main.py` serves NIFTY 50/NIFTY BANK details
  from Dhan when configured (fallback to the usual source, reason in
  `store["dhan"]`), the `/options/{name}` routes the page uses, and
  `stream_forever()`: while an index page on Dhan is open (`/ws?live=<index>`)
  in market hours, one connection to Dhan's tick-by-tick feed (`DHAN_FEED_URL`,
  binary ticker packets decoded by `feed_packets()`), each tick folded into the
  candle forming now (`live`) and pushed to those pages as `{"tick": ...,
  "via": "stream"}`; `tick_forever()` polls the last price every
  `DHAN_TICK_SECONDS` only while the stream is quiet (`via: "poll"`). The page
  moves the price, the last candle and the levels note on each tick, shows
  "Live · stream" or "Live · tick", and fetches the candles when a new one begins.
- `static/login.html` - the login page. `Procfile` - the host's start command.
  Hosting: one instance, secrets in the host's environment, `/health` for checks.
- `start.bat` reads `HOST`/`PORT` from `.env` (defaults `127.0.0.1`/`8000`);
  `HOST=0.0.0.0` opens the dashboard to other devices on the owner's home network
  and prints the addresses to use.
- Every answer from the server (`store`, `/alive`) carries `commit` (Render's
  `RENDER_GIT_COMMIT`); both pages reload themselves when it changes
  (`newDeploy()`), at most once a minute, so a merge reaches an open tab. The
  pages and `/static` (`NoCacheStatic`) are served `Cache-Control: no-cache`, so
  the reload never pairs a new page with a cached old `rules.js` (7 October).
- `static/index.html` - the dashboard: opens `/ws`, redraws on each message;
  each tile links to `/index/{name}` in a new tab. The top row is NIFTY 50,
  NIFTY BANK, SENSEX (`PINNED`). Those three tiles show exactly what their
  pages' headers show, from the same computation (`dhan_tiles()` in `main.py`
  calls `dhan.fetch_detail` and takes its summary; `with_dhan_prices()` puts it
  on the quote; `source: "dhan"`, `live`, "Dhan · live" or "Dhan · closed" on
  the tile; a tile keeps its last figures when a read fails, `/health` says
  `feed.tiles_problem`) and in market hours move every second: `live_forever` sends `{"live": {...}}` to
  the dashboard sockets (`dash_subs`) once a second, `applyLive` redraws the
  tile in place; the footer says which tiles are Dhan's and which Yahoo's.
- `static/rules.js` - layers 1 to 3 of `LOGIC.md` as plain functions with no page
  (`readOf()`: the candle verdict of 7 October, CARRY or EXIT with the reason, for
  whichever level gave the call, sent with every recorded call into the calls CSV;
  `rule.read_of` is its Python twin for the watcher; on the table as Candle status (back on 8 October); changes no call;
  `carryOf()` / `rule.carry_of` the carry read of 7 October evening, idea P5's
  question, three more CSV columns; trades carry `ladder`, the levels beyond the target; the target follows the lines at every candle (8 October). Idea
  P4 is the same exit acted on, `exitBack` in `paperTrades`, Study page only; P6/P7 the stops of 8 October evening,
  `stopShare` fixed at the entry, settled by `ideas.minutes` (the day's 1-minute candles) when a candle touched both,
  stop first without them; the Study page passes the minutes and never runs P6 with P7)
  state (`Rules.levelsOf`, `signalAt`, `paperTrades`, `replayDay`) plus layer 4's
  candle facts (`dayFacts`, `levelBehaviour`, `candleBreaks`) and layer 5's ideas
  under test (`IDEAS`, `ideasOf`: options of `paperTrades` that are off unless
  the Study page passes them), loaded by the index page and the study page so
  both run one and the same rule.
- `lab/` - the research engine (`replay.js`, run with node over `data/sessions`)
  and the log of rounds (`findings.md`). Loaded by no page.
- `.github/workflows/wake.yml` - website side: wakes the sleeping host after the
  close (15:42 IST) so the server saves the day, and at 16:10 reads `/health`
  (`study.summary()`: the latest complete day, the day checked without a
  session, any problem; `token`: `dhan.token_check()` every half hour, whether
  Dhan accepts the token and until when) and fails the run when the day is not
  saved and pushed, or when the token is refused or expires before the next
  trading day's close. The owner does not look after the saving (6 October);
  Claude does; the token is the one thing only the owner can renew.
- `study.py` - layer 4: the record of each session's candles
  (`data/sessions/<date>.json`, git-ignored; written after the close and every
  few minutes during it) and of every call the index page suggested that day
  (`<date>-calls.csv`, from `record_calls()`, fed by the page's `POST
  /calls/{name}`; the owner's ask of 7 October) and their copy
  on the `data` branch of the owner's repository through the GitHub API
  (`GITHUB_DATA_TOKEN`; the branch holds data only and is never merged into
  `main`); `study_forever()` runs it, `pull_missing()` fetches the days a fresh
  host lacks. `main.py` serves `/study/` (`static/study.html`: every saved day
  replayed in every setting, each day's pattern, the candles at the levels, the
  high and low breaks, the learning step on the candles' facts gated on 100 calls
  over 10 days), `/study/days`, `/study/days/{day}` and `POST /study/save`.
- `static/detail.html` - the per-index page: summary figures and a chart with a
  Line/Candles switch and drop-downs for the time frame (1/5/15/30-minute or 1-day
  candles), the levels and the session (today, one of the last five days, or all
  five; day candles show three months), fed by `/indices/{name}/detail`
  (`?range=&interval=`; the page always asks for `5d`, or `3mo` on day candles),
  plus layers 1, 2 and 3 of `LOGIC.md` (level price lines
  with a readout; held/crossed judged per closed candle, its own table taken off
  the page on 6 October; the paper trades the owner's rule gives on the closed
  candles, with a score line and a CSV download; nothing drawn on the chart), computed in the page from the
  summary and the bars. Chart drawn with
  Lightweight Charts, bundled in `static/vendor/` (do not load it from a CDN).
- `android/` - the dashboard as an Android app (Java, one Activity with a
  WebView on the owner's server; blob downloads saved through a JavaScript
  interface; `target=_blank` links kept in the same view so the login's tab
  note survives). `.github/workflows/android.yml` builds and signs it with
  `android/keystore/my-trade.jks` (a personal sideload key) and publishes the
  APK on the `app-latest` release. Nothing in the app can reach Dhan directly.
- `start.bat` - one-click start on Windows. `.env` is git-ignored; `.env.example`
  documents the settings.

## Pull requests: website and app apart

The owner's rule (6 October): every pull request is one of two kinds, never
both. A **website** pull request touches the dashboard the Render link and the
laptop serve: `static/`, `main.py`, `dhan.py`, `providers.py`, `study.py`, `lab/`,
`.github/workflows/wake.yml`, the docs. An
**Android app** pull request touches `android/` and `.github/workflows/android.yml`
only. Say in the title which kind it is when it is not obvious.

One pull request at a time, each against `main`, never one built on top of
another's branch (7 October: #70 was based on #69's branch; merged after #69, it
landed in that dead branch and not on the site, and had to be opened again as
#71). When a change needs an earlier one, wait for its merge and branch from
`main`. Never push to a merged pull request's branch either; start a fresh
branch from `main`.

## Phases

1. API - done. 2. Dashboard - done. 3a. Streaming plumbing - done.
3b. Licensed real-time feed - waiting on the owner's supplier choice.
4. Orders - paper first, with hard limits, before anything real.

- Keep-awake (8 October): Render's free plan sleeps after 15 minutes without an incoming request, and the watcher
  sleeps with it. `keep_awake_forever` in main.py calls the server's own public address (`RENDER_EXTERNAL_URL`, set
  by Render; `KEEP_AWAKE_URL` for tests) every `KEEP_AWAKE_SECONDS` (300) from 08:45 to 16:15 IST on weekdays;
  `.github/workflows/keepawake.yml` knocks every ten minutes 08:30 to 16:20 IST, which also wakes it before the open.
  `/health` says `keep_awake`.
- `/health` says `memory_mb` (now and peak, from /proc): on 8 October the server stopped at about 09:50 with a page
  open and restarted at 10:00:26; the free plan has 512 MB, so the peak tells whether memory is the reason next time.
- SENSEX on the index page: strikes by the one-strike-in-the-money rule on a 100-point step (`STRIKE_STEP`); since 8
  October its options are followed like NIFTY's (BSE rows of the instrument list, Dhan's chain for id 51, BSE_FNO on
  the feed, segment byte 8), and its page has the premium column like NIFTY's.
- "Today so far" calls (8 October): `paperTrades()` on the index page, `watch_index()` in main.py, `Rules.replayDay`
  and the lab's replay all use `Rules.todayLevelsAt(bars)` / `rule.today_levels_at(bars)`: candle i against the day's
  range up to candle i-1, the seven Fibonacci lines only (the extra line beyond each end was taken off on 8 October
  evening, the owner's decision). The chart draws the day's range with the candle forming now (worked out again at once
  when the price crosses 0% or 100%), and a call's target follows those lines: `Rules.todayLinesAt` / `rule.today_lines_at`,
  passed as `targetsAt` / `targets_at`. A call given live stays given (9 October): `given` / `given`, { signal time: side }
  from today's option records of the page's (or the watcher's) time frame and levels mode, keeps a recorded call when the
  candle's final prices no longer give it (`Rules.keptAt` / `rule.kept_at`, `kept: true`). A target hit seen live stays a hit when
  the candle closes (its price can differ by a few points when the line moved on later in that candle).
- The owner's exit rule "Hold Through a Level Break" (8 October night): `holdBreaks` / `hold_breaks`, passed by the index
  page (not on day candles), the watcher and `replayDay`. A crossed call gets `hold: true` and `c1Open` (the signal
  candle's open); it ends `"back"` (a close back across its line) or `"retouch"` (a candle opening beyond the previous
  close, then back to `c1Open`, tick by tick), else at the day end; never at its target. While one is open, no new call
  that way. The lab's `run()` mirrors it (`holdBreaks !== false`).
- Rule 2 of the owner's specification (9 October): `trail` / `trail` (with holdBreaks), `Rules.TRAIL` / `rule.TRAIL`, the
  owner's choice `{ lines: "all", buffer: "none", place: "back" }` (#115 had `place: "at"`), passed by the index page, the watcher and `replayDay`
  (`replayDay({ trail: null })` is Rule 1 alone). A held break whose candle closes beyond a further line (on `levelsAt`)
  gets `trail: { stop, stopRatio, line, ratio }` (`Rules.trailStep` / `rule.trail_step`, the stop never moves back);
  from then exits A and B are off and it ends `"trail"` at the close of a candle back past `trail.stop`, or at the day
  end. The buffers (`"fixed"` points, `"atr"` x `Rules.atrBefore`) and `place: "at"` and `lines: "middle"` are research
  settings only (lab/replay.js rows, check_rule.py jobs); lab/check.js holds the specification's test cases T1 to T11.
