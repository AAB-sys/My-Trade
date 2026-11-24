"""A token made while token_report is running must leave the report stale (24 Nov: made 14:33:23, report began 14:33:19)."""
import time, dhan

fails = []
def check(name, ok):
    print(("ok   " if ok else "FAIL ") + name)
    if not ok: fails.append(name)

def run(made_during):
    dhan._own["last_try"] = 0.0
    dhan._own["reported"] = 0.0
    def slow_check():
        if made_during:
            time.sleep(0.02)
            dhan._own["last_try"] = time.time()  # another thread made the token now
        return {"ok": False, "valid_till": None, "checked_at": "x", "problem": "refused"}
    dhan.token_check, dhan.renew_due, dhan.totp_on = slow_check, (lambda c: None), (lambda: False)
    dhan.token_report()
    return dhan.report_stale()

check("token made during the report: stale", run(True) is True)
check("nothing made meanwhile: not stale", run(False) is False)
# 24 Nov, second case: the token is made DURING the check (inside it), the report then wants a renewal and is refused (the wait of 130 s): still stale
def run_inside():
    dhan._own["last_try"] = 0.0; dhan._own["reported"] = 0.0
    def check_made_inside():
        time.sleep(0.02); dhan._own["last_try"] = time.time()
        return {"ok": False, "valid_till": None, "checked_at": "x", "problem": "the token was refused, it has probably expired"}
    dhan.token_check, dhan.renew_due, dhan.renew_token = check_made_inside, (lambda c: "the token in use was refused"), (lambda why, by_hand=False: False)
    dhan.token_report()
    return dhan.report_stale()
check("token made inside the check, the report's own try refused by the wait: stale", run_inside() is True)
raise SystemExit(1 if fails else 0)
