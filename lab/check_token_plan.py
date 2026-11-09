"""The token check's plan line (9 November: the owner made the Data APIs plan active on the Dhan website, a new token was accepted,
and every data request still answered "Current plan: Free Plan", with nothing on our side to show what Dhan's own profile said).
No network: dhan.call is a stand-in that gives Dhan's profile answer, and the result of dhan.token_check() is compared with what it
should be. The plan is shown as Dhan wrote it, only the last four digits of the client id are shown, and a refused token has no plan.
    python3 lab/check_token_plan.py        (from the repo's folder)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import dhan

OURS = "1100123456"

bad = 0
def check(what, got, want):
    global bad
    ok = got == want
    bad += not ok
    print(("ok    " if ok else "WRONG ") + what + ("" if ok else f": got {got}, wanted {want}"))

def run(answer, client_id=OURS):
    """dhan.token_check() when Dhan's /profile gives `answer` (a dict, or an exception to raise)."""
    saved = (dhan.call, dhan.settings)
    def fake_call(method, path, payload=None, *a, **kw):
        assert (method, path) == ("GET", "/profile"), (method, path)
        if isinstance(answer, Exception):
            raise answer
        return answer
    dhan.call, dhan.settings = fake_call, (lambda: (client_id, "token"))
    try:
        return dhan.token_check()
    finally:
        dhan.call, dhan.settings = saved

# the answer of 9 November, as Dhan writes it (the token good, the plan named)
paid = {"dhanClientId": OURS, "tokenValidity": "10/11/2026 09:38", "activeSegment": "Equity, Derivative", "ddpi": "Active", "mtf": "Inactive",
        "dataPlan": "Active", "dataValidity": "2026-12-09 09:40:00"}
r = run(paid)
check("a good token: ok, and until when, as before", (r["ok"], r["valid_till"], r["problem"]), (True, "2026-11-10T09:38:00+05:30", None))
check("the plan and its end date are shown as Dhan wrote them", (r["plan"]["data_plan"], r["plan"]["data_valid_till"]), ("Active", "2026-12-09 09:40:00"))
check("the same client id: said so, with the last four digits only", (r["plan"]["same_client"], r["plan"]["dhan_client_last4"], r["plan"]["set_client_last4"]), (True, "3456", "3456"))
check("the whole client id is never in the answer", OURS in json.dumps(r), False)

free = dict(paid, dataPlan="Free", dataValidity="")
r = run(free)
check("a free plan: its name, and no end date", (r["plan"]["data_plan"], r["plan"]["data_valid_till"]), ("Free", None))

r = run({"dhanClientId": OURS, "tokenValidity": "10/11/2026 09:38"})
check("no plan fields in Dhan's answer: none, not an error", (r["ok"], r["plan"]["data_plan"], r["plan"]["data_valid_till"]), (True, None, None))

r = run(paid, client_id="1100999999")
check("another client id in the settings: said so", (r["plan"]["same_client"], r["plan"]["dhan_client_last4"], r["plan"]["set_client_last4"]), (False, "3456", "9999"))

r = run({"data": paid})
check("the answer inside \"data\" is read too", (r["ok"], r["plan"]["data_plan"]), (True, "Active"))

r = run(dict(paid, dataPlan="x" * 300))
check("a long value is cut at 40 letters", len(r["plan"]["data_plan"]), 40)

r = run(dhan.DhanError("token", "Dhan refused the token (x)"))
check("a refused token: not ok, the old reason, no plan", (r["ok"], r["problem"], "plan" in r), (False, "the token was refused, it has probably expired", False))

r = run(dhan.DhanError("other", "could not reach Dhan"))
check("another failure: not ok, its reason, no plan", (r["ok"], r["problem"], "plan" in r), (False, "could not reach Dhan", False))

dhan.settings, saved = (lambda: ("", "")), dhan.settings
r = dhan.token_check()
dhan.settings = saved
check("no settings: not ok, no plan", (r["ok"], "plan" in r), (False, False))

# the step text of check_dhan.py
def steps(answer, client_id=OURS):
    saved = (dhan.call, dhan.settings, dhan.expiries, dhan.last_price)
    def fake_call(method, path, payload=None, *a, **kw):
        return answer
    dhan.call, dhan.settings = fake_call, (lambda: (client_id, "token"))
    dhan.expiries = lambda name: ["2026-11-10", "2026-11-17"]
    dhan.last_price = lambda name: 24000.0
    try:
        return dhan.status()["steps"]
    finally:
        dhan.call, dhan.settings, dhan.expiries, dhan.last_price = saved

text = steps(paid)[1]["text"]
check("check_dhan: the Token line names the plan Dhan has on record", "Data APIs plan: Active, until 2026-12-09 09:40:00" in text, True)
check("check_dhan: no warning when the client ids match", "WARNING" in text, False)
text = steps(paid, client_id="1100999999")[1]["text"]
check("check_dhan: a warning when the settings' client id is another one", "WARNING" in text, True)
text = steps({"dhanClientId": OURS})[1]["text"]
check("check_dhan: no plan fields: \"not given\"", "plan: not given, until not given" in text, True)

print("\n" + ("all fine" if not bad else f"{bad} WRONG"))
sys.exit(1 if bad else 0)
