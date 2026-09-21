# My-Trade

An API that serves the current value of the major Indian market indices, plus a
dashboard that shows them.

## Menu

| Method | Endpoint          | You send      | You get back                                        |
|--------|-------------------|---------------|-----------------------------------------------------|
| GET    | `/`               | nothing       | the dashboard page                                  |
| GET    | `/indices`        | nothing       | the list of index names this API serves             |
| GET    | `/indices/all`    | nothing       | `quotes`: every index's value; `failed`: names that didn't load (cached 60 s) |
| GET    | `/indices/{name}` | an index name | level, change, change %, and the time of quote      |

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

## Phase 1 - the API (done)

1. Menu on paper
2. Skeleton: both endpoints answer, with made-up numbers
3. Real data: fetch each index's value from Yahoo Finance
4. Errors: an unknown index returns 404 instead of crashing
5. Published on GitHub

## Phase 2 - the dashboard (done)

- `/indices/all` fetches all 19 indices together (4 at a time - Yahoo rate-limits
  bigger bursts - with up to 3 attempts each) and remembers the answer for 60
  seconds, so the page makes one request and Yahoo is not asked more often than
  its data changes. Any index that still fails is listed under `failed` rather
  than silently dropped.
- `/` serves `static/index.html`: NIFTY 50 and SENSEX pinned at the top, the rest
  ordered gainers to losers, green/red with a glyph so direction never relies on
  colour alone, light and dark mode, refreshes itself every 60 seconds, and names
  any index that didn't load.

Data comes from Yahoo Finance, which is free, needs no key, and is about
15 minutes delayed for NSE/BSE.
