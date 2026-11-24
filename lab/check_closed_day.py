"""A day nothing trades (a holiday, a weekend, before the open): the price pages must still show the last session (24 November: the dashboard said
"Waiting for the first prices", an index page "HTTP 503", because Dhan answers the price request of a holiday with an EMPTY answer). dhan.fetch_detail
is run with made-up Dhan answers and a set clock.  python3 lab/check_closed_day.py"""
import os, sys
from datetime import date, datetime, timedelta, timezone
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, ".."))
import dhan
IST = dhan.IST
INTERVALS = {"5m": {"bar_seconds": 300}, "1d": {"bar_seconds": 86400}}; RANGES = {"today": {"days": 1}, "5d": {"days": 5}}
def ts(d, hh, mm): return int(datetime(d.year, d.month, d.day, hh, mm, tzinfo=IST).timestamp())
SESSIONS = [date(2026, 11, 18), date(2026, 11, 19), date(2026, 11, 20), date(2026, 11, 23)]  # Wed, Thu, Fri, Mon
CLOSE = {SESSIONS[0]: 25000.0, SESSIONS[1]: 25100.0, SESSIONS[2]: 25800.0, SESSIONS[3]: 25366.4}
def candles(days):
    out = []
    for d in days:
        c = CLOSE[d]
        for k in range(75):
            t = ts(d, 9, 15) + 300 * k; out.append({"time": t, "open": c, "high": c + 5, "low": c - 5, "close": c})
    return out
def dayrow(d): return {"time": ts(d, 9, 15), "open": CLOSE[d] - 10, "high": CLOSE[d] + 30, "low": CLOSE[d] - 40, "close": CLOSE[d]}
class Fake:
    def __init__(self, now, sessions, quote=None, today_candles=None):
        self.now, self.sessions, self.quote_fn, self.extra = now, sessions, quote, today_candles or []
def run(now, quote, extra=(), last_price=None, sessions=SESSIONS):
    dhan._clock = lambda: now
    dhan.intraday = lambda name, minutes, days_back=8: candles(sessions) + list(extra)
    dhan.daily_or_none = lambda name, days_back=45: [dayrow(d) for d in sessions]
    dhan.daily_or_saved = dhan.daily_or_none
    dhan.daily = lambda name, days_back=45: [dayrow(d) for d in sessions]
    dhan.cached = lambda key, ttl, fn: fn()
    dhan.quote = quote
    return dhan.fetch_detail("NIFTY 50", "today", "5m", INTERVALS, RANGES, last_price)["summary"]
def empty(name): raise dhan.DhanError("other", "unexpected quote answer from Dhan: {'data': {'IDX_I': {}}, 'status': 'success'}")
def token(name): raise dhan.DhanError("token", "Dhan refused the token")
def fine(name): return {"last_price": 25366.4}
ok = bad = 0
def check(name, cond, got=None):
    global ok, bad
    if cond: ok += 1
    else: bad += 1; print("FAILED:", name, got if got is not None else "")
mk = lambda y, m, d, hh, mi: datetime(y, m, d, hh, mi, tzinfo=IST)
# 1. a holiday (Tue 24 Nov 12:26, nothing traded, Dhan's quote answer empty): no error; yesterday's close; yesterday's change against the session before
s = run(mk(2026, 11, 24, 12, 26), empty)
check("holiday: last is the last session's close", s["last"] == 25366.4, s["last"])
check("holiday: change is that session's move (23 Nov against 20 Nov)", s["change"] == round(25366.4 - 25800.0, 2), s["change"])
check("holiday: change percent", abs(s["change_percent"] - round((25366.4 - 25800.0) / 25800.0 * 100, 2)) < 1e-9, s["change_percent"])
check("holiday: previous session is the one before the last", s["previous_close"] == 25800.0 and s["previous_high"] == 25830.0, (s["previous_close"], s["previous_high"]))
check("holiday: today has no figures, the market is not open", s["today_open"] is None and s["open"] is False)
# 2. the same with Dhan's quote working: its price, the same change
s = run(mk(2026, 11, 24, 12, 26), fine); check("holiday with a quote: the same", s["last"] == 25366.4 and s["change"] == round(25366.4 - 25800.0, 2), s)
# 3. a weekend (Sat 21 Nov, last session Fri 20 Nov)
s = run(mk(2026, 11, 21, 12, 0), empty, sessions=SESSIONS[:3]); check("weekend: Friday's move against Thursday", s["last"] == 25800.0 and s["change"] == 700.0, s)
# 4. a trading morning before the open (Mon 23 Nov 08:50): no error, yesterday's close, change 0 against it (it has not started)
s = run(mk(2026, 11, 23, 8, 50), empty, sessions=SESSIONS[:3]); check("before the open: last close, change 0", s["last"] == 25800.0 and s["change"] == 0.0 and s["previous_close"] == 25800.0, s)
# 5. a faulty quote with the market trading (today's candles exist): still an error, as before
today = date(2026, 11, 23); extra = [{"time": ts(today, 9, 15), "open": 25100.0, "high": 25120.0, "low": 25090.0, "close": 25110.0}]
try: run(mk(2026, 11, 23, 11, 0), empty, extra=extra, sessions=SESSIONS[:3]); check("trading, empty answer: still an error", False)
except dhan.DhanError: check("trading, empty answer: still an error", True)
# 6. a refused token on a holiday is still raised (never hidden)
try: run(mk(2026, 11, 24, 12, 26), token); check("token fault is raised", False)
except dhan.DhanError as e: check("token fault is raised", e.kind == "token")
# 7. a normal trading day, price from the feed: the figures are what they always were (change against yesterday's close)
s = run(mk(2026, 11, 23, 11, 0), fine, extra=extra, sessions=SESSIONS[:3], last_price=25150.0)
check("trading day: change against yesterday's close", s["last"] == 25150.0 and s["change"] == round(25150.0 - 25800.0, 2) and s["previous_close"] == 25800.0 and s["today_open"] == 25100.0, s)
# 8. only one session known: no shift, no error
s = run(mk(2026, 11, 24, 12, 26), empty, sessions=SESSIONS[3:]); check("one session only: its close, change 0", s["last"] == 25366.4 and s["change"] == 0.0, s)
print(f"{ok} checks passed, {bad} failed"); sys.exit(1 if bad else 0)
