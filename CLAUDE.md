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
  **15 October: the Study page, the daily save and the research rounds are off**
  (the owner: "remove this study tab and everything under it"; "close every
  research engine, every data backup, every excel csv file backup"). Nothing is
  studied or proposed unless the owner asks in the chat. **21 October: the daily
  save is back, alone** (the owner: "bring back the daily save, without study
  page"): `record.py` saves each session to the `data` branch again; no page over it.

## Shape of the project

- `providers.py` - the index list (the three on Dhan), the chart ranges and candle sizes, the clock
  helpers and the `demo` simulated ticker. Yahoo Finance left on 19 October (the owner: "remove
  yahoo data or yahoo API from everywhere"): Dhan (`dhan.py`) is the one source, `main.py`'s
  `dhan_fetch_all` the dashboard's quotes; without Dhan's settings there are no prices and the pages say so.
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
  after a drop (a page that is left closes `/ws` itself on `pagehide` and opens
  it again on a `pageshow` from the browser's back-forward cache, 17 October).
  A page without an id is let in only within a handover (opened
  when a page is served while another is open, or at login; used up when the
  new page gets its id), or within `GRACE_SECONDS` of a page's connection
  dropping (`page_just_left`: the Back button shows a page the server never
  served, 17 October). A page silent for `DASHBOARD_DROP_SECONDS` (4 h) is
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
  `DHAN_CLIENT_ID`/`DHAN_ACCESS_TOKEN`, data endpoints only. A refused request is named in the error (`/charts/historical
  refused: HTTP 400 DH-905 ...`); a chart request tries every toDate form (tomorrow, today, now) and remembers the one Dhan
  accepted (`_chart_form`); the daily list may be refused (22 October morning, DH-905 on every index while the minute
  candles worked): `daily_or_none` then builds the previous session from the candles, the refusal on `/health` as
  `feed.daily_problem`, so the dashboard, the pages and the daily save keep working. Real-time candles,
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
  refused and the page left without an answer; a request waits for its turn outside
  the lock, so the chain's gap never holds up the poll, and `cached` remakes a
  value by one caller at a time); `fetch_detail` takes the live price
  the server holds, so it needs no quote request while ticks flow; the record of each paper call's option (strike
  one in the money, nearest expiry, premium paid, premium now, the Sell mark) in
  `paper_calls.json` (and on the data branch as `records/<date>.json`, pushed by
  `record.py` whenever they change and fetched back at start; off from 15 to
  21 October with the Study page), with the contract's security id from Dhan's instrument list
  (`option_ids()`, a CSV at `DHAN_SCRIP_MASTER_URL`) so the feed and the poll in
  `main.py` carry its premium tick by tick (`note_premium`, `open_options`); `status()`/`deep_checks()` in plain words for
  `check_dhan.py`/`check_dhan.bat`. `main.py` serves NIFTY 50/NIFTY BANK details
  from Dhan when configured (fallback to the usual source, reason in
  `store["dhan"]`), the `/options/{name}` routes the page uses (`/options/{name}/chain`, 17 October: the OI chart's
  data, `dhan.chain_table`, Dhan's chain of one expiry with every leg field, `dhan.LEG_FIELDS`, the four greeks among them, plus ATM IV, its change
  against the previous close kept in memory, PCR, `dhan.lot_size` from the instrument list and the days to expiry), and
  `stream_forever()`: while an index page on Dhan is open (`/ws?live=<index>`)
  in market hours, one connection to Dhan's tick-by-tick feed (`DHAN_FEED_URL`,
  binary ticker packets decoded by `feed_packets()`), each tick folded into the
  candle forming now (`live`) and pushed to those pages as `{"tick": ...,
  "via": "stream"}`; `tick_forever()` polls the last price every
  `DHAN_TICK_SECONDS` only while the stream is quiet (`via: "poll"`). The page
  moves the price and the last candle on each tick (the levels note beside the drop-down left the page on 16 October), shows
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
  tile in place; each tile's own line says it is Dhan's, live or closed (the footer line under the tiles left the page on 16 October).
- `static/rules.js` - layers 1 to 3 of `LOGIC.md` as plain functions with no page
  (`readOf()`: the candle verdict of 7 October, CARRY or EXIT with the reason, for
  whichever level gave the call, sent with every recorded call into the calls CSV;
  `rule.read_of` is its Python twin for the watcher; on the table as Candle status (back on 8 October); changes no call;
  `carryOf()` / `rule.carry_of` the carry read of 7 October evening, idea P5's
  question, three more CSV columns; trades carry `ladder`, the levels beyond the target; the target follows the lines at every candle (8 October). Idea
  P4 is the same exit acted on, `exitBack` in `paperTrades`, Study page only; P6/P7 the stops of 8 October evening,
  `stopShare` fixed at the entry, settled by `ideas.minutes` (the day's 1-minute candles) when a candle touched both,
  stop first without them; the Study page passes the minutes and never runs P6 with P7)
  state (`Rules.levelsOf`, `signalAt` with `withColour`, the signal candle's colour of 21 October, Change 5, `paperTrades`, `replayDay`) plus layer 4's
  candle facts (`dayFacts`, `levelBehaviour`, `candleBreaks`) and layer 5's ideas
  under test (`IDEAS`, `ideasOf`: options of `paperTrades` that are off unless
  the Study page passes them), loaded by the index page and the study page so
  both run one and the same rule.
- `lab/` - the research engine (`replay.js`, run with node over `data/sessions`)
  and the log of rounds (`findings.md`). Loaded by no page.
- `.github/workflows/wake.yml` - website side: wakes the sleeping host after the
  close (15:42 IST) so the server saves the day, and at 16:10 reads `/health`
  (`save`, `record.summary()`: the latest complete day, the day checked without a
  session, any problem; `token`: `dhan.token_check()` every half hour, whether
  Dhan accepts the token and until when, and under `plan` what Dhan's own profile
  answer says of the Data APIs plan: its name, its end date, the client id's last
  four digits and whether they are the settings' ones) and fails the run when the day is not
  saved and pushed, or when the token is refused or expires before the next
  trading day's close. The owner does not look after the saving (6 October);
  Claude does; the token is the one thing only the owner can renew.
- `record.py` - the daily save: each session's candles (1, 5, 15, 30 minutes, both
  indices, the day's and the previous day's figures) and its calls CSV on the `data`
  branch at 15:40 (a partial copy every ten minutes during the session; a missed day
  saved at the next wake, up to a week back), the options records backup
  (`records/<date>.json`), the pull of both at start, and `POST /calls/{name}`, the
  page's report of the calls it shows (`recordCalls` in detail.html; the watcher
  sends its rows too). It was `study.py` with the Study page until 15 October
  (removed: "remove this study tab and everything under it"); the save alone came
  back on 21 October ("bring back the daily save, without study page"). No page
  over it: the lab and `check_rule.py` read the saved days. 16 to 20 October are not saved.
- `static/newrule.js` - New Rule Chart (21 and 22 October, the owner's chart pattern documents): the engine of the rules under Calls
  with Signals, apart from `rules.js`, which it never touches and takes nothing from (the owner, 22 October: "completely separate and
  isolated"; no Fibonacci levels anywhere in it, "I dont want it at all as of now"). `detectEntry` (the double top), `detectDoubleBottom`,
  `detectTripleTop`, `detectTripleBottom`, `wedgeAt` / `wedgeStep` (the falling and rising wedge, a locked-lines scanner with state),
  `rectangleAt` / `lockedStep` (the bullish rectangle), `symmetricalAt` / `flatAt` / `triangleStep` (the bullish and bearish
  symmetrical triangle, the ascending and descending triangle, one side each, from their four documents of 22 October); `runDay` runs a day: the entries,
  Rule 1 (the reclaim, the retouch, the day end), then the ATR trail (the stop half an ATR behind the best close, 22 October evening). The page runs it under
  Calls with Signals (`drawSignals`). Described in `NEW_RULES.md`, apart from LOGIC.md. `lab/newrule-check.js` runs every case the
  documents give. PRs for it are named "New Rule Chart_".
- `static/detail.html` - the per-index page: summary figures and a chart with a
  Line/Candles switch and drop-downs for the time frame (1/5/15/30-minute or 1-day
  candles), the levels and the session (today, one of the last five days, or all
  five; day candles show three months), fed by `/indices/{name}/detail`
  (`?range=&interval=`; the page always asks for `5d`, or `3mo` on day candles),
  plus layers 1, 2 and 3 of `LOGIC.md` (level price lines
  with a readout; held/crossed judged per closed candle, its own table taken off
  the page on 6 October; the paper trades the owner's rule gives on the closed
  candles; the score line, the CSV download and the no-call notes left the page on 16 October, the owner's ask; nothing drawn on the chart), computed in the page from the
  summary and the bars. Chart drawn with
  Lightweight Charts, bundled in `static/vendor/` (do not load it from a CDN).
- `static/volume.html`, `static/volprofile.js` - the Volume Profile page (12 November, the owner: "build a new page with header
  name as volume profile"), at `/volume-profile`, opened from the dashboard's Volume Profile capsule. A page of its own: it draws the
  index's candles (`/indices/{name}/detail`), the volume along the bottom and, per day, how much was traded at each price (the rows,
  the busiest price, the 70% area). An index has no volume, so the weights are the volume of its nearest futures contract
  (`dhan.future_volume`, `/indices/{name}/volume`, asked of Dhan only while the page is open); without it the rows count time and the
  page says so. It decides nothing and gives no call; Paper calls and Calls with Signals do not read it, nor it them. The count
  follows the owner's word of 12 November ("as same as dhan ... nothing different"): 24 equal rows from the day's low to its high,
  the 70% value area, from the day's 1-minute candles, the same for every index (`volprofile.js`). Also on the page (the owner, 12 November: "add drawing tools and RSI"): the RSI (14 candles,
  Wilder's smoothing, in a strip under the chart, with the 70 and 30 lines) and six drawing tools. The profile is always drawn; every other indicator (the volume bars, the RSI, and any added later) has a switch in the tool row that the page remembers (the owner: "volume profile should always be there, else every indicator should have an option to enable and disable"). The tools: (trend line, horizontal line,
  vertical line, box, Fibonacci levels, note; pick with a tap, drag to move; the bin deletes the picked drawing or else the last one drawn, the cross removes all at once), kept per index in the browser only. The chart has its own buttons at the foot of the candles: zoom out, zoom in,
  left, right, up, down, and back to the whole view (the owner, 13 November). `lab/check_volprofile.js` checks
  the arithmetic. The server checks the page's supply itself (the owner, 13 November: "yes add that check"): every half hour one
  small request per index for its futures' volume (`dhan.volume_check`, `volume_forever`), shown in `/health` under
  `feed.volume_profile` (ok, the contract, the last candle, today's volume, Dhan's reason when refused); `lab/check_volume_health.py`.
  The fine-tuning of 15 November (the owner's list of five points: "check first, go thoroughly and build the logic properly"):
  (1) the volume is placed at the INDEX candle's low and high, a futures candle lends only its volume by its minute (it was so;
  now checked); (2) the Signal's profile uses the same Dhan futures volume (it did; time only when Dhan gives none, and says so);
  (3) the Signal's profile of the previous trading day is counted from that day's 1-MINUTE candles (`vpsignal.prepare(..., fine)`),
  the candles the drawn profile uses, with the document's fixed rows (5 / 10 points) and its 70% rule; a day without 350 of them
  falls back to its 5-minute candles; the rules still read today's 5-minute candles; the lines are named "Prev day VAH / POC / VAL";
  (4) the contract's roll: in the nearest contract's last 5 calendar days (`dhan.ROLL_DAYS`) the next month's is read too and each
  day takes the one that traded more that day (`dhan.future_volume`, `roll_volume`; the page's note says so); (5) only 09:15 to
  15:30 counts, "yesterday" is the previous trading day (Monday reads Friday), the 70% area grows right with one row left on a side.
  Checks: `lab/check_volprofile.js`, `lab/check_vpsignal.py`, `lab/check_volume_health.py`.
  The Impulse MACD (15 November, the owner, with LazyBear's Pine script: "develope a best strategy out of it and develop the same
  on volume profile page ... Test this on the Nifty 50 data"): `static/impulse.js`. The tick box "Impulse MACD" is OFF until ticked;
  with it off the page is as it was. On: the indicator in its own pane under the RSI's, as the script draws it (lengths 34 and 9:
  md as coloured bars, md minus its signal as blue bars, the signal line), following the candle size shown; and the Impulse calls:
  a 5-minute candle closing outside the day's value area so far (the break call's signal, `vpshape.js`) gives a call only when on
  that candle md is above 0 and above its signal (CE) or below 0 and below it (PE), read on the 5-minute candles of the last five
  days; stop, exit and one-at-a-time as the break calls. ALL DAY, no time cap and no limit on the number of calls (the owner: "IMACD
  signals should be fired all the day starting from the start of the market session till the end. there should not be any time cap
  or call numbers limit"): signal candles from 09:30 to 15:05. Of 100 ways tried on the two years the indicator alone gave no rule
  that held. As the page counts it the all-day calls made -385 after 8 a call (813 calls, 32% won; first year -444, second +59);
  held to 12:10-13:30 the same rule made +1,199 (266 calls): the owner chose the whole day. THE SIDEWAYS FILTER (the owner: "make it more
  perfect because it is the only indicator which can help on the sideways market ... remove the unwanted noise"): a call is refused
  while the closes crossed the day's busiest price more than 4 times in the last 24 five-minute candles, and for 3 candles after
  a stopped Impulse call (`Impulse.CFG.chopBars`, `chopMax`, `pauseBars`). About 80 ways were tried; asking more of the impulse
  itself did not help. With the filter the all-day calls made +899 (634 calls, 32% won; first year +89, second +810), at the
  window of 18 to 36 candles between +797 and +1,520. The Impulse lines show the count of crossings and say when calls are held. Time in place of volume, NIFTY 50 only:
  paper only. `lab/check_impulse.js` (28 checks; with a candles file it replays it).
  Where the calls stand (15 November, the owner, with the signal lines marked: "move all the calls below the chart ... whatever
  the call page fires, move it all below the chart"): the document's Signal, the Shape signal and the Impulse calls are one block
  (`#calls`) BELOW the chart, above the note; it scrolls inside itself when it is long (at most about a third of the screen). Two round
  scroll buttons stand at its lower right while the calls do not fit ("add the scroll down button for the web and mobile both";
  "it should move one by one to downside and one by one to the upside"): each press moves the block by one row of text, the upper button up, the lower one down.
  The Impulse call table (15 November, the owner: "make a separate table with header as Impulse call table as a sperate capsule
  tab and add all the impulse calls in that table. table should have scroll up and down button. table should have all the headers
  a fixed row and also should have the functionality of moving the column from left to right and right to left by holding the
  column itself"): two capsules above the calls' block, "Calls" (the lines) and "Impulse call table": every Impulse call of the
  days the page holds (the last five; the first only warms the averages up), the newest first, 14 columns. The header row stays
  in place; a column is moved by holding its header and dragging it (mouse or finger), the order kept on the device
  (`volumeProfileImpulseCols`); the two scroll buttons move it one table row a press. The capsule left open is remembered.
  Where each day's profile stands (16 November, the owner: "why the volume is looking onto right side ? if you see the days,
  it is on left side ?"): every day's profile started at its first candle (#254); then the same night: "on current or running day,
  this volume profile should be on right side only": the running (last) day's profile stands at the right edge with any Days
  setting, the days before it at their own first candle (`right = lastDay` in drawProfiles; `fitDays` keeps room on the right).
  VWAP (16 November, the owner: "add VWAP line on volume profile page"; "keep it unticked"): a "VWAP" tick box, off by default
  and remembered; with it on, each day shown gets its own line from 09:15, sum((high + low + close) / 3 x volume) / sum(volume)
  on the chart's candles with the futures volume the page already reads (`vwapOf`, `setVwap`, `updateVwap` for the live
  candle); its value in the row above the chart. No volume: no line. No calls.
  The past futures volume for the research (16 November, the owner: "Yes, make the PR and make the study on every 5 day"):
  once a day outside market hours (`volume_history_forever`, three minutes after the start, then every half hour it checks),
  `volume_history_once` writes each index's 1-minute candles with the futures volume Dhan still gives (the contract trading
  now, the last 120 days) to the data branch as `history/volume/<INDEX>_1min.csv`, the download's eight columns
  (`volume_file`). /health shows it under feed.volume_history. No page and no rule reads it; `lab/check_volume_history.py`.
  The Live Volume Profile Explanation Panel (17 November, the owner's build document "Live Volume Profile Panel" with its code
  and 26 tests): `panel/` holds the document's code (panel_engine.py, panel_profile.py, panel_config.json, panel_replay.py,
  test_panel.py; `python -m unittest test_panel -v` in that folder: all 26 must pass after any change). `vppanel.py` feeds it
  (today's finished 1-minute index candles with the futures volume of the same minute, 0 when missing; yesterday's levels
  from vpsignal, the page's "Prev day" lines; one engine per index per day, fed one candle at a time, replayed after a
  restart); `/indices/{name}/vp-panel`; on the page a "Panel" tick box, off by default: a 340 px column right of the chart
  (under it on a phone), today's thin zones as light bands on the chart. Two things were added to the document's code, both
  off by default so its own tests are untouched: `build_profile(like_chart=True)` (the chart's arithmetic of
  static/volprofile.js, so the panel's POC, VAH, VAL equal the chart's: the document's arithmetic agreed with the chart at
  only about half the moments of 18 real days) and the config key `match_chart_profile` that vppanel sets. While the Panel
  is on, the page's VWAP line is counted from the 1-minute candles so it equals the panel's VWAP; with it off, as before.
  Futures open interest is not fed yet (the check says "not available"). It describes; no call, no order.
  THE CROSS-CHECK (17 November, the owner: "charts all values and panels value should match always because buying the call
  or buying CE or buying PE depends on that only"): at every look (every 5 s) the page counts the chart's own profile and
  VWAP again on the minutes the panel read and shows one line in the panel: "Same as the chart at HH:MM" (green) or "NOT
  the same" with the numbers (red) (`checkPanel`). The chart's lines also count the candle forming now; the panel reads
  closed minutes only (the document's rule), and says so.
  `lab/check_vppanel.py` (and with a "Candles with volume" file: the replay of every day).
  The past volume as a file (15 November, the owner: "download the volume data from the past ... the same way you did it
  before for the candles data"): the Main Menu's Download candles capsule, File "Candles with volume" -> `/download/volume`
  (`dhan.future_history`): the candles file plus Volume and Contract, the futures contract trading now only (Dhan's list
  no longer names expired contracts), newest piece first until Dhan has no more; `lab/check_volume_download.py`.
  The page's fit (15 November, the owner, with a photo of the candles squeezed above a tall Impulse pane and table: "main candle
  chart with volume profile is also not fitting well", then a reference picture "about the chart size"): the calls block under
  the chart opens closed, so the chart has the whole height; a capsule opens it (22vh, 46vh with the larger button), the arrow
  closes it, the i button shows the rules in words (`callsLook`, localStorage "volumeProfileCallsLook"). `fitPanes()` gives each
  pane a fixed share (candles 76% with Impulse, 64% with RSI and Impulse, 80% with RSI) and a pane's edge cannot be dragged.
  The zoom and move buttons (`#nav`) sit at the right end of the info row (`#inforow`), not over the chart (the owner, 15
  November, marking the spot). The Shape and the Impulse marks go through one marker set (`drawMarks`): two sets drew two calls
  of one candle over each other ("why it is mixing up ?"); in one set the chart stacks them.
  With Volume unticked the candles use the volume's room. The note is one line; a press opens it. No call logic in any of this.
  The day's save keeps the futures' volume too (16 November, the owner: "record every movement for todays session"): each
  index's part of `sessions/<date>.json` gains `volume: {contract, 1m: [[time, volume], ...]}` (`record.build_day`), so the
  page's profile of a past day can be rebuilt exactly; a refusal leaves the part out and never costs the candles;
  `lab/check_record_volume.py`.
  The chart's three "Prev day" lines after the close (16 November, the owner: "Why volume profile page is still showing 13th
  Novembers VAH VAL and POC ?"; "I am talking about only levels on the chart not about the calls"): from 15:30 until the next
  open, `vpsignal.state` adds `chart_levels` (today's levels, which the next session uses) and the page draws the lines from
  them; the Signal box, its levels text and the calls stay today's, unchanged.
  No calls on the page (16 November, the owner: "remove all the call tables, i dont want that, and also remove all the
  signals from the chart, except the shape names"; "remove call and remove signals from the chart as well, just keep the shape
  name"): `SHOW_CALLS = false` in volume.html hides the calls block under the chart (`#calls-wrap hidden`) and draws no call
  arrow, stop or target line. The calls are still worked out and the code is kept. The levels, the shape names, RSI and the
  Impulse MACD pane stay.
  The Shape signal (15 November, the owner, with the Pine script "Volume Profile Anatomies (D / B / P / Double Zone)": "make your
  own volume profile strategy out of it"; "multiple signals should be allowed in a day"; "Build option 1 but this user interface
  should not be changed at all"): `static/vpshape.js`, counted in the page. The tick box "Shape signal" is OFF until ticked; with
  it off the page is as it was. On: the day's shape (D, B, P, Double Zone: the script's classifier, its settings unchanged) and the
  calls: from 12:10 to 13:30 a 5-minute candle closing outside the day's value area so far gives Buy CE (above) or Buy PE (below)
  at the next candle's open, stop at the busiest price of that moment, out at the stop or the 15:15 open; one open at a time, a new
  one after it ends (many a day). Paper only. Tested on two years of NIFTY 50 with time in place of volume: 539 calls, 33% won,
  +579 after 8 a call (first year -652, second +1,231): a weak rule, the owner's choice. A second list beside these "break calls" (the owner: "keep the signals
  shapewise also and keep the calls signals with earlier logic as well. Both should work hand in hand"): the SHAPE calls, 10:15 to
  14:30, each shape its own setup (P: a dip to the busiest price that holds, CE; B: a rise to it that fails, PE; D: a turn at the
  value area's high, PE, or low, CE; Double Zone: a close across the middle of the gap), its own one call open at a time; on the
  two years they LOST 1,569 points over 708 calls (only the Double Zone setups were positive): the owner's choice, paper only.
  The shape's name stands above each day's profile while the box is ticked. `lab/check_vpshape.js` (21 checks; with a candles file
  it replays both lists). Never change its numbers without the owner's word; the document's Signal (`vp/`) is separate.
  The page's signal (the owner's document "Volume Profile Signal Logic", 13 November: "read this document
  thoroughly and implement the changes"): CE, PE or WAIT from yesterday's profile (VAL, POC, VAH, the naked POCs) and today's
  finished 5-minute candles, four setups (rejection at VAH, rejection at VAL, acceptance outside value, the 80% rule), the reward
  at least 1.5 times the risk, one signal a day, a stop and a target as index levels, the lots, out at the stop, the target or
  15:15. The logic is the document's own code, kept as written in `vp/` (`profile.py`, `vp_signal.py`, `vp_config.json`,
  `vp_cli.py`, `test_vp.py`); `vpsignal.py` feeds it Dhan's candles with the futures' volume and adds the exit;
  `/indices/{name}/vp-signal` serves it; the page shows it in a panel with its own switch and draws the levels. It states a
  signal for paper trading and study and places no order; the document's own two-year test did not make money overall, and the
  page says so. `lab/check_vpsignal.py` (the document's 12 tests, the server against the document's command line day by day,
  the exit, the sizing). Never change a rule or a number of `vp/` without the owner's word.
  PRs for it are named "Volume_Profile_".
- `android/` - the dashboard as an Android app (Java, one Activity with a
  WebView on the owner's server; blob downloads saved through a JavaScript
  interface, unused since the CSV button went on 16 October; `target=_blank` links kept in the same view so the login's tab
  note survives). `.github/workflows/android.yml` builds and signs it with
  `android/keystore/my-trade.jks` (a personal sideload key) and publishes the
  APK on the `app-latest` release. Nothing in the app can reach Dhan directly.
- `start.bat` - one-click start on Windows. `.env` is git-ignored; `.env.example`
  documents the settings.

## Pull requests: website and app apart

The owner's rule (6 October): every pull request is one of two kinds, never
both. A **website** pull request touches the dashboard the Render link and the
laptop serve: `static/`, `main.py`, `dhan.py`, `providers.py`, `lab/`,
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
  by Render; `KEEP_AWAKE_URL` for tests) every `KEEP_AWAKE_SECONDS` (300) from 06:00 to 16:15 IST on weekdays (08:45
  until 14 October: a server woken earlier, by the morning's token paste restarting it, fell asleep again);
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
  the candle closes (its price can differ by a few points when the line moved on later in that candle). A target the candle
  itself brought closer (12 October; its own new low for a CE, high for a PE, moved the lines) counts its high/low only
  against the target as it stood before the candle (`linesAt(i - 1)`), and the moved target on its close (live: the price
  now): `hits` / `hits` in paperTrades, mirrored in `lab/replay.js`.
- Ideas 13 (no call against a fresh run), 8 (a clear close past the line) and 5 (no Crossed call the other way while one is held)
  left the engine on 18 October (the owner: "all three remove"): no `freshRun` / `clearCross` / `oneWay`, no `FRESH_RUN` /
  `CLEAR_CROSS` / `ONE_WAY`, no `freshOf`, no `skipped` in the result. `lab/replay.js` (its own engine) keeps them as settings, off,
  and guards its reads of the gone exports.
- The call fires on a later candle (18 October): a signal is `armed` with `fireAt` (its candle's high for a CE, low for a PE) and
  enters, `enterAt(sig, bar, price)` / `enter_at`, where a later candle's price goes past it (the candle's open when it opened past
  it), closed candles and the forming one alike (`fire` in paperTrades / paper_trades); a close back across the signal's line cancels
  it; no row until it fires (no more `how: "pending"` rows). Every signal gives a call: a second one the same way while another is
  held gets `parallel: true` (the page: "Can be bought parallelly"). `prevClose` / `prev_close` (the previous day's close) judges
  the day's first candle too, passed by the page (`prevCloseOf()`, not on today's range), the watcher (Previous close mode) and
  `replayDay` / `replay_day` on the "prev" and "close" moves.
- The owner's exit rule "Hold Through a Level Break" (8 October night): `holdBreaks` / `hold_breaks`, passed by the index
  page (not on day candles), the watcher and `replayDay`. A crossed call gets `hold: true` and `c1Open` (the signal
  candle's open); it ends `"back"` (a close back across its line) or `"retouch"` (a candle opening beyond the previous
  close, then back to `c1Open`, tick by tick), else at the day end; never at its target. Until 18 October no new call came
  that way while one was open; now the next one runs beside it, `parallel: true`.
- The owner's early exit (19 October): `minutes` / `minutes` (the session's one-minute candles) in paperTrades / paper_trades and
  replayDay / replay_day. A held break ends `"early"` inside a candle at the close of the first minute by whose end three minutes in
  a row stayed beyond the close before the candle (PE: lows above it; CE: highs below it) and that minute closed across the first
  line beyond that close (`early`, `earlyExit` / `early_exit`); the trade gets `exitAt` (the minute's end), `earlyFrom` (that close)
  and `earlyLine`. The page fetches today's minutes once a minute (`loadMinutes`, range "today", interval "1m") and takes the minute
  closing now from the ticks (`applyTick`, `t.bars["1m"]`); the watcher reads `dhan.intraday(name, 1)` with the ticks
  (`with_live_candles(..., "1m")`); `sale_minute` returns `exitAt - 60` for it; check_rule.py and lab/check.js pass the saved days'
  minutes (`lab/replay.js`, its own engine, does not know it). The lab's `run()` mirrors it (`holdBreaks !== false`).
- Rule 2 of the owner's specification (9 October): `trail` / `trail` (with holdBreaks), `Rules.TRAIL` / `rule.TRAIL`, the
  owner's choice `{ lines: "all", buffer: "none", place: "at" }` (the stop on the line crossed itself: #115, and again since
  21 October, Change 4, the owner's "point no 3"; from 9 to 21 October `place: "back"`, one line back), passed by the index page, the watcher and `replayDay`
  (`replayDay({ trail: null })` is Rule 1 alone). A held break whose candle closes beyond a further line (on `levelsAt`)
  gets `trail: { stop, stopRatio, line, ratio }` (`Rules.trailStep` / `rule.trail_step`, the stop never moves back);
  from then exits A and B are off and it ends `"trail"` at the close of a candle back past `trail.stop`, or at the day
  end. The buffers (`"fixed"` points, `"atr"` x `Rules.atrBefore`) and `place: "at"` and `lines: "middle"` are research
  settings only (lab/replay.js rows, check_rule.py jobs); lab/check.js holds the specification's test cases T1 to T11.

- AAA_V1 (19 November, the owner: "there is a page called trade plan ... make a replica of it, dont keep any rules on the new chart, and
  make a chart format same as volume profile page chart. Name it AAA_V1"; "move it to after OI chart capsule"; "whatever changes will
  go into it will start with the PR as AAA_V1 starting with this PR"): a work family of its own, pull requests titled "AAA_V1_".
  The last capsule on every index page (`static/detail.html`: `tab-aaa`, `showAaa`, `aaa-box`). Open: the index page's own chart and
  its Chart, Time frame, Levels and Session rows make room for the Volume Profile page's chart of that index, an inner page
  (`static/volume.html?index=<name>&embed=aaa`: no title row, no index box, and no Signal, Shape signal, Impulse MACD or Panel box;
  its settings kept apart as `volumeProfileAAA`); under the capsules the Trade Plan's table, empty. The chart is clean (19 November,
  the owner: "remove every logic from this chart ... i want only candles and above that i want previous day close high low", then
  "i just want the volumes on this page for all 3 indexes, rest you can remove"): candles, the volume bars always on, three lines
  (Prev day High, Close, Low, from the summary; `drawPrevDay`, kept in view), no tick box, no volume rows, no VAH, POC, VAL.
  The zoom and move buttons stand under the chart at its right end (`#navrow`), and under the previous day's figures a second row
  gives the running day's high and low, counted from its candles on every tick ("should be changed as per the live feed").
  The index page's Previous session, Today and 52 weeks boxes are not shown while AAA_V1 is open ("remove this ... from AAA_V1 page
  only"), and every reading of the previous day is amber: its three figures and its three lines ("mark yesterdays every reading
  in amber color"; `--prev-day`). It has NO rule and fires no
  call until the owner gives it one; no other page's rule reads or writes it.
- The server's own Dhan token (19 November, the owner: "what about TOTP option on Dhan ?", "yes, build it"): with `DHAN_PIN` and
  `DHAN_TOTP_SECRET` set in the host's settings (never in the repo or a chat), `dhan.py` makes a 24-hour token itself
  (`renew_token`: POST `auth.dhan.co/app/generateAccessToken` with the client id, the PIN and the 6-digit code, `totp_code`): each
  morning 08:00 to 09:10 IST when the token in use ends before that day's close (`renew_due`, from `main.token_forever` through
  `dhan.token_report`), and at once when Dhan refuses the token in use (`dhan.call`). In memory only; at most 3 failed tries a
  day, 10 minutes apart; the pasted `DHAN_ACCESS_TOKEN` keeps working and is the fallback. Without the two settings nothing
  changes. `/health` shows `token.own` (no secret). `lab/check_own_token.py` (32 checks, a stand-in for Dhan on the machine).
- The (E) mark (19 November, the owner: "for the expiry of any index, please mark as (E) in front of every index"): on the day an
  index's options expire its name is written "(E) NIFTY 50" in the Index menus (`static/index.html`, `static/detail.html`), as the
  index page's title, and in the Volume Profile page's index box and legend (`static/volume.html`). `GET /expiry-today` (main.py)
  says which, from Dhan's own expiry list of each index (`dhan.expiries`, the list the Panel's expiry flag reads, asked at most
  once in six hours). The pages ask when they open and every 30 minutes. A mark only: links, values and rules are unchanged.
- The Panel's key levels are LIVE (19 November, the owner, on a fast open: "there is a difference on every value"): the panel is
  read once a minute, the chart moves every second, so the list (`panelLevels`, `panelLive`, `tickPanel` in `static/volume.html`)
  shows the chart's own numbers of the moment: the price, the day's high and low, today's VAH, POC and VAL, VWAP; distances from
  the live price; sorted again on every tick. Yesterday's levels, the reading, the score, the checks and the alerts stay the
  panel's minute reading. Only what the list shows: no rule, level or signal is counted differently.
- The OI walls for the research (17 November, the owner: "yes"): `main.oi_forever` looks at each index's nearest-expiry option
  chain every quarter of an hour during the session (`OI_CHECK_SECONDS`), `dhan.oi_look` keeps the biggest Call OI strike at or
  above the index and Put OI strike at or below it (and the five biggest of each side) in memory for the day, and the day's
  save writes them as `indices[name]["oi_walls"]`. /health shows `feed.oi_walls`. A restart loses the looks made before it.
  No page and no rule reads them. Test: `python3 lab/check_oi_walls.py`.

- ONE SET OF NUMBERS on the Volume Profile page (17 November, the owner: "Make all the values same as the chart and same on the
  panel so they never disagree ... Match every number and keep the logic same so new numbers will work according to the logic
  only"). The chart's own count is the one source: (1) a day's VAH, POC and VAL for the Signal box, the "Prev day" lines and the
  panel's "yesterday" are the chart's 24-row count of that day (`vpsignal.LEVELS_LIKE_CHART`, `chart_levels_of`; the document's
  fixed-row count stays for the hvn/lvn nodes and is the whole of it when the setting is False); (2) the panel's shape is read with the
  chart's rule (`panel_profile.chart_shape`, a line-for-line copy of `static/vpshape.js`; `match_chart_shape`); the document's
  first 15 minutes of "Too early to read" and its waiting rule (a new shape is shown only after it has held; `vppanel.STABLE_MINUTES`, 5 on the page by the owner's word, 10 in the document) stay,
  and the chart's label of the running day is drawn from the panel's shown shape (`shownShape` in `static/volume.html`: the page
  asks `/vp-panel` while Shape signal or Panel is ticked), so the two cannot differ (18 November: "drive the chart's shape label
  from the panel's output"); "Double Zone" is the chart's name (`vppanel.chart_words`) and the b-shape is written with a small b
  on both; (3) the panel's POC movement check watches the chart's POC (`match_chart_poc`). The
  rules themselves (vp/vp_signal.py, the panel engine's checks) are unchanged: they read the new numbers. The page's check line
  compares the shape too. Changing `static/volprofile.js` or `static/vpshape.js` means changing their Python copies in
  `panel/panel_profile.py`, and `lab/check_vppanel.py` and `lab/check_vpsignal.py` must still pass.

