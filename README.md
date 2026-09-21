# My-Trade

An API that serves the current value of the major Indian market indices.

## Menu

| Method | Endpoint          | You send      | You get back                                    |
|--------|-------------------|---------------|-------------------------------------------------|
| GET    | `/indices`        | nothing       | the list of index names this API serves         |
| GET    | `/indices/{name}` | an index name | level, change, change %, and the time of quote  |

Try `/docs` for the interactive version of this table.

## Run it

```
python -m venv .venv
.venv\Scripts\activate          (Windows)   |   source .venv/bin/activate   (Mac/Linux)
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Then open <http://127.0.0.1:8000/indices> or <http://127.0.0.1:8000/docs>.

## Phase 1 plan

1. Menu on paper - done (the table above)
2. Skeleton: both endpoints answer, with made-up numbers - done
3. Real data: fetch each index's value from Yahoo Finance
4. Errors: an unknown index returns 404 instead of crashing
5. Published on GitHub - done

Data will come from Yahoo Finance, which is free, needs no key, and is about
15 minutes delayed for NSE/BSE.
