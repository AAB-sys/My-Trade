"""The server's own Dhan token (19 November 2026, the owner: "what about TOTP option on Dhan ?", "yes, build it"): dhan.py makes a
24-hour token itself from the client id, the PIN and the 6-digit code of the moment, when DHAN_PIN and DHAN_TOTP_SECRET are set.
A stand-in for Dhan runs on this machine (its login address and its /profile); nothing leaves it, and every secret here is made up.
    python3 lab/check_own_token.py        (from the repo's folder)"""
import io, json, logging, os, sys, threading, time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

CLIENT, PIN, KEY, PASTED = "1100123456", "482913", "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", "pasted-token-aaaa"
state = {"good": set(), "made": 0, "asked": 0, "seen": [], "refuse_pin": False, "down": False}


class Dhan(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def answer(self, code, body):
        raw = json.dumps(body).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def do_POST(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path != "/app/generateAccessToken": return self.answer(404, {})
        state["asked"] += 1; state["seen"].append(q)
        import dhan
        codes = {dhan.totp_code(KEY, time.time() + d) for d in (-30, 0, 30)}
        if state["refuse_pin"] or q.get("pin") != PIN or q.get("dhanClientId") != CLIENT or q.get("totp") not in codes:
            return self.answer(401, {"status": "error", "message": f"Invalid PIN or TOTP for {q.get('dhanClientId')}"})
        state["made"] += 1; token = f"own-token-{state['made']:04d}-zzzz"; state["good"].add(token)
        self.answer(200, {"dhanClientId": CLIENT, "dhanClientName": "TEST", "accessToken": token, "expiryTime": "2026-11-20T08:30:00.000"})
    def do_GET(self):
        if not self.path.startswith("/v2/profile"): return self.answer(404, {})
        if self.headers.get("access-token") in state["good"]:
            return self.answer(200, {"dhanClientId": CLIENT, "tokenValidity": "20/11/2026 08:30", "dataPlan": "Active", "dataValidity": "2026-12-10 00:00:00.0"})
        self.answer(401, {"errorType": "Invalid_Authentication", "errorCode": "DH-901", "errorMessage": "Client ID or user generated access token is invalid or expired."})


server = ThreadingHTTPServer(("127.0.0.1", 0), Dhan); port = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()
os.environ.update(DHAN_API_BASE=f"http://127.0.0.1:{port}/v2", DHAN_AUTH_BASE=f"http://127.0.0.1:{port}", DHAN_CLIENT_ID=CLIENT, DHAN_ACCESS_TOKEN=PASTED, DHAN_RENEW_WAIT_SECONDS="600")
for k in ("DHAN_PIN", "DHAN_TOTP_SECRET"): os.environ.pop(k, None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
logs = io.StringIO(); logging.basicConfig(level=logging.DEBUG, stream=logs, force=True)
import dhan  # noqa: E402

bad = 0
def check(what, cond):
    global bad
    bad += not cond
    print(("ok    " if cond else "WRONG ") + what)
def fresh():
    dhan._own.update(token="", made_at=None, problem=None, fails=0, fail_day=None, last_try=0.0, tries=0)

# 1. the code of the moment: RFC 6238's own test values (SHA-1, the key "12345678901234567890"), six digits
RFC = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
check("the 6-digit code equals RFC 6238's test values", [dhan.totp_code(RFC, t) for t in (59, 1111111109, 1111111111, 1234567890, 2000000000)] == ["287082", "081804", "050471", "005924", "279037"])
check("a key typed with spaces and small letters is read the same", (os.environ.__setitem__("DHAN_TOTP_SECRET", "gezd gnbv gy3t qojq gezd gnbv gy3t qojq"), dhan.totp_settings()[1] == RFC)[1])
os.environ.pop("DHAN_TOTP_SECRET")

# 2. without the two settings: as it always was
state["good"] = {PASTED}
check("off without DHAN_PIN and DHAN_TOTP_SECRET; the pasted token is the one in use", not dhan.totp_on() and dhan.settings() == (CLIENT, PASTED))
r = dhan.token_report(); check("a good pasted token: ok, and no word of an own token in the report", r["ok"] and "own" not in r)
state["good"] = set()
r = dhan.token_report(); check("a refused pasted token: refused as before, and Dhan's login address is never asked", not r["ok"] and "refused" in r["problem"] and state["asked"] == 0)

# 3. with them: a refused token is replaced by the server's own, at once
os.environ.update(DHAN_PIN=PIN, DHAN_TOTP_SECRET=KEY); fresh()
check("on with the two settings", dhan.totp_on() and dhan.configured())
body = dhan.profile()
check("the pasted token is refused -> one token is made and the request is asked again, with success", body.get("dhanClientId") == CLIENT and state["made"] == 1 and state["asked"] == 1)
check("the token in use is now the server's own", dhan.settings()[1] == "own-token-0001-zzzz")
q = state["seen"][-1]; check("Dhan was sent the client id, the PIN and a 6-digit code, and nothing else", set(q) == {"dhanClientId", "pin", "totp"} and q["pin"] == PIN and len(q["totp"]) == 6 and q["totp"].isdigit())
r = dhan.token_report(); check("the report: ok, with own = on, in use, the time made, no problem", r["ok"] and r["own"]["on"] and r["own"]["in_use"] and r["own"]["made_at"] and r["own"]["problem"] is None)
before = state["asked"]; dhan.profile(); dhan.profile(); check("a token that works is not made again", state["asked"] == before)

# 4. the server's own token ends: a new one, no hand needed (the wait between tries is for failures; here the last try is old)
state["good"] = set(); dhan._own["last_try"] = time.time() - 3600
dhan.profile(); check("the own token is refused -> the pasted one is tried, then a new one is made", state["made"] == 2 and dhan.settings()[1] == "own-token-0002-zzzz")

# 5. with no pasted token at all
os.environ["DHAN_ACCESS_TOKEN"] = ""; fresh(); state["good"] = set()
check("no pasted token, the two settings there: the server still counts as set up", dhan.configured())
dhan.profile(); check("and it makes its token on the first request", state["made"] == 3)
os.environ["DHAN_ACCESS_TOKEN"] = PASTED

# 6. a refusal is not repeated blindly
fresh(); state["good"] = set(); state["refuse_pin"] = True; before = state["asked"]
def refused():
    try: dhan.profile(); return False
    except dhan.DhanError as exc: return exc.kind == "token"
check("Dhan says no to the PIN: the request fails as a refused token", refused() and state["asked"] == before + 1)
check("the next request does not ask Dhan's login again (10 minutes between tries)", refused() and refused() and state["asked"] == before + 1)
rep = dhan.own_report(); check("the report says what Dhan answered, with no long number in it", rep["failed_tries"] == 1 and "HTTP 401" in rep["problem"] and CLIENT not in rep["problem"] and PIN not in rep["problem"])
for _ in range(5):
    dhan._own["last_try"] = time.time() - 3600; refused()
check(f"after {dhan.RENEW_MAX_FAILS} failed tries it stops asking", state["asked"] == before + dhan.RENEW_MAX_FAILS and dhan.own_report()["stopped"])
state["good"] = {PASTED}; check("a pasted token still works while it is stopped", dhan.profile().get("dhanClientId") == CLIENT)
dhan._own["fail_day"] = "2026-01-01"; dhan._own["last_try"] = time.time() - 3600; n = state["asked"]; state["good"] = set(); refused()
check("the next day it may try again (the count is a day's)", state["asked"] == n + 1 and dhan.own_report()["failed_tries"] == 1)
state["refuse_pin"] = False; state["good"] = set()
check("a try asked for by hand goes through and clears the count", dhan.renew_token("by hand", by_hand=True) and dhan.own_report()["failed_tries"] == 0 and not dhan.own_report()["stopped"])

# 7. the network down is not a refusal
fresh(); saved = dhan.AUTH_BASE; dhan.AUTH_BASE = "http://127.0.0.1:9"
check("Dhan's login address not reachable: no token, not counted as a failed try, the reason without the address", not dhan.renew_token("test") and dhan.own_report()["failed_tries"] == 0 and "could not reach" in dhan.own_report()["problem"] and "pin" not in dhan.own_report()["problem"].lower())
dhan.AUTH_BASE = saved
fresh(); os.environ["DHAN_TOTP_SECRET"] = "not a key 1890!"
check("a key that is not a key: said plainly, the key itself not shown", not dhan.renew_token("test") and "not a valid key" in dhan.own_report()["problem"] and "1890" not in dhan.own_report()["problem"])
os.environ["DHAN_TOTP_SECRET"] = KEY

# 8. the morning's renewal
IST = dhan.IST; at = lambda h, m: datetime(2026, 11, 19, h, m, tzinfo=IST)
ok_till = lambda s: {"ok": True, "valid_till": s, "problem": None}
check("08:30, the token ends at 08:47 today -> due", dhan.renew_due(ok_till("2026-11-19T08:47:00+05:30"), at(8, 30)) is not None)
check("08:30, the token lasts until tomorrow morning -> not due", dhan.renew_due(ok_till("2026-11-20T08:10:00+05:30"), at(8, 30)) is None)
check("11:00 in market hours, the token ends at 14:00 -> not touched in market hours (a refusal later is handled then)", dhan.renew_due(ok_till("2026-11-19T14:00:00+05:30"), at(11, 0)) is None)
check("07:30 and 09:11 -> outside the morning's window", dhan.renew_due(ok_till("2026-11-19T08:47:00+05:30"), at(7, 30)) is None and dhan.renew_due(ok_till("2026-11-19T12:00:00+05:30"), at(9, 11)) is None)
check("a refused token -> due at any hour", dhan.renew_due({"ok": False, "problem": "the token was refused, it has probably expired"}, at(13, 0)) is not None)
check("Dhan not reachable -> not due (the token is not the trouble)", dhan.renew_due({"ok": False, "problem": "could not reach https://api.dhan.co/v2"}, at(13, 0)) is None)
os.environ.pop("DHAN_PIN"); check("without the settings -> never due", dhan.renew_due({"ok": False, "problem": "the token was refused"}, at(8, 30)) is None); os.environ["DHAN_PIN"] = PIN

# 9. no secret anywhere it could be read
fresh(); state["good"] = set(); dhan.profile(); out = logs.getvalue() + json.dumps(dhan.token_report()) + json.dumps(dhan.own_report())
codes = {q["totp"] for q in state["seen"]}
check("the logs (every level) and the reports hold no PIN, no key, no code, no token and no login address with them", PIN not in out and KEY not in out and not any(c in out for c in codes) and "own-token-" not in out and PASTED not in out and "generateAccessToken?" not in out)
check("the log says that a token was made, and why", "a new token was made" in out)

print("\nall fine" if not bad else f"\n{bad} WRONG"); sys.exit(1 if bad else 0)
