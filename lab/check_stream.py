"""The tick stream's retry waits (3 November: the token ran out at 08:57, the loop knocked on Dhan's feed about 45 times with a refused
token, and after the new token Dhan answered HTTP 429 for more than six minutes). No network: websockets.connect and asyncio.sleep are
stand-ins, the loop runs a few rounds and the waits it asked for are compared with what they should be.
    python3 lab/check_stream.py        (from the repo's folder)"""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import websockets
from websockets.datastructures import Headers
from websockets.exceptions import ConnectionClosedError, InvalidStatus
from websockets.http11 import Response
import main

class Stop(Exception):
    pass

class Refuses:  # websockets.connect(...) as an async context manager that fails on entering
    def __init__(self, exc): self.exc = exc
    async def __aenter__(self): raise self.exc
    async def __aexit__(self, *a): return False

def too_many():
    return InvalidStatus(Response(429, "Too Many Requests", Headers(), b""))

def run(failures, token, rounds):
    """The loop for `rounds` waits. failures: the exceptions the feed gives, one per try. Returns (the waits asked for, the tries made, the stream line)."""
    waits, tries = [], []
    async def fake_sleep(seconds):
        waits.append(seconds)
        if len(waits) >= rounds:
            raise Stop
    def fake_connect(url, **kw):
        tries.append(url)
        return Refuses(failures[min(len(tries) - 1, len(failures) - 1)])
    saved = (asyncio.sleep, websockets.connect, main.DHAN_ON, main.feed_wanted, main.in_tick_hours, main.dhan.settings, main.store["dhan"]["token"])
    asyncio.sleep, websockets.connect, main.DHAN_ON, main.feed_wanted, main.in_tick_hours = fake_sleep, fake_connect, True, (lambda: ["NIFTY 50"]), (lambda: True)
    main.dhan.settings, main.store["dhan"]["token"] = (lambda: ("client", "token")), token
    try:
        asyncio.run(main.stream_forever())
    except Stop:
        pass
    finally:
        asyncio.sleep, websockets.connect, main.DHAN_ON, main.feed_wanted, main.in_tick_hours, main.dhan.settings, main.store["dhan"]["token"] = saved
    return waits, tries, main.store["dhan"]["stream"]

bad = 0
def check(what, got, want):
    global bad
    ok = got == want
    bad += not ok
    print(("ok    " if ok else "WRONG ") + what + ("" if ok else f": got {got}, wanted {want}"))

good = {"ok": True, "valid_till": "2026-11-04T09:21:00+05:30", "checked_at": "x", "problem": None}
refused = {"ok": False, "valid_till": None, "checked_at": "x", "problem": "the token was refused, it has probably expired"}
other = {"ok": False, "valid_till": None, "checked_at": "x", "problem": "ConnectError: could not reach Dhan"}

waits, tries, line = run([too_many()], good, 7)
check("HTTP 429 again and again: waits 60, 120, 240, then 300 s", waits, [60, 120, 240, 300, 300, 300, 300])
check("HTTP 429: one try per wait", len(tries), 7)
check("HTTP 429: the line says when it tries again", "HTTP 429" in line and "300 s" in line, True)

waits, tries, line = run([ConnectionClosedError(None, None)], good, 6)
check("any other failure: waits as before, 2, 4, 8, 16, then 30 s", waits, [2, 4, 8, 16, 30, 30])

waits, tries, line = run([too_many(), too_many(), ConnectionClosedError(None, None), ConnectionClosedError(None, None)], good, 4)
check("429 then another failure: the waits come back to the short ones", waits, [60, 120, 30, 30])

waits, tries, line = run([too_many()], refused, 5)
check("token refused: Dhan is not asked at all", len(tries), 0)
check("token refused: the loop waits 30 s and tries nothing", waits, [30] * 5)
check("token refused: the line says so", "refused the token" in line, True)

waits, tries, line = run([ConnectionClosedError(None, None)], other, 3)
check("a token check that failed for another reason (the network) does not stop the stream", len(tries), 3)

waits, tries, line = run([ConnectionClosedError(None, None)], None, 3)
check("before the first token check: the stream is tried", len(tries), 3)

print("ALL THE SAME" if not bad else f"{bad} WRONG")
sys.exit(1 if bad else 0)
