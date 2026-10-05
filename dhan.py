"""Dhan (DhanHQ v2), the owner's broker API, as a licensed data source.

Step 1, this file: the connection and a plain-language status check that the
dashboard and check_dhan.py share. The two settings live in .env on the laptop
and in the host's environment only, never in the repo:

    DHAN_CLIENT_ID      the account's client id (a number)
    DHAN_ACCESS_TOKEN   the access token from the Dhan website; it lasts 24 hours

Only data endpoints are called here. Nothing in this file can place an order.
"""
import os

import httpx

BASE = os.environ.get("DHAN_API_BASE", "https://api.dhan.co/v2")  # overridden only by tests
SEGMENT = "IDX_I"                                  # Dhan's segment for an index itself
INDEX_IDS = {"NIFTY 50": 13, "NIFTY BANK": 25}     # Dhan's security ids of the indices with options


class DhanError(Exception):
    """kind: config | token | subscription | rate | network | other."""

    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind
        self.message = message


def settings() -> tuple[str, str]:
    return os.environ.get("DHAN_CLIENT_ID", "").strip(), os.environ.get("DHAN_ACCESS_TOKEN", "").strip()


def configured() -> bool:
    client_id, token = settings()
    return bool(client_id and token)


def call(method: str, path: str, payload: dict | None = None) -> dict:
    """One request to Dhan; raises DhanError with a plain reason when it refuses."""
    client_id, token = settings()
    if not (client_id and token):
        raise DhanError("config", "DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN are not both set")
    headers = {"access-token": token, "client-id": client_id, "Accept": "application/json"}
    if payload is not None:
        payload = {**payload, "dhanClientId": client_id}
    try:
        response = httpx.request(method, BASE + path, json=payload, headers=headers, timeout=15)
    except httpx.HTTPError as exc:
        raise DhanError("network", f"could not reach {BASE}: {type(exc).__name__}: {exc}"[:200]) from exc
    try:
        body = response.json() if response.content else {}
    except ValueError:
        body = {}
    if not isinstance(body, dict):
        body = {"data": body}
    code = str(body.get("errorCode", ""))
    said = str(body.get("errorMessage") or body.get("remarks") or body.get("message") or response.text[:200])
    # Dhan's data endpoints answer an unsubscribed account with {"data": {"806": "Data APIs not Subscribed"}}
    # and a refused status, so that is checked before the token rule
    inner = body.get("data") if isinstance(body.get("data"), dict) else {}
    if code == "DH-902" or "806" in inner or "subscri" in (said + " ".join(map(str, inner.values()))).lower():
        raise DhanError("subscription", f"Dhan says the Data API is not subscribed ({said})")
    if response.status_code == 401 or code == "DH-901":
        raise DhanError("token", f"Dhan refused the token ({said})")
    if response.status_code == 429 or code == "DH-904":
        raise DhanError("rate", f"Dhan's rate limit was hit ({said})")
    if response.status_code >= 400 or code or body.get("status") == "failure":
        raise DhanError("other", f"HTTP {response.status_code} {code} {said}".strip())
    return body


def profile() -> dict:
    return call("GET", "/profile")


def expiries(name: str) -> list[str]:
    """The option expiry dates of an index, soonest first, as YYYY-MM-DD."""
    body = call("POST", "/optionchain/expirylist", {"UnderlyingScrip": INDEX_IDS[name], "UnderlyingSeg": SEGMENT})
    return sorted(str(d) for d in body.get("data", []))


def last_price(name: str) -> float:
    body = call("POST", "/marketfeed/ltp", {SEGMENT: [INDEX_IDS[name]]})
    return float(body["data"][SEGMENT][str(INDEX_IDS[name])]["last_price"])


def status() -> dict:
    """The checks in order, each with ok and a plain sentence; stops at the first failure."""
    steps = []

    def step(ok, text):
        steps.append({"ok": ok, "text": text})
        return ok

    client_id, token = settings()
    if not step(bool(client_id and token), "Settings: DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN found"
                if client_id and token else "Settings: DHAN_CLIENT_ID or DHAN_ACCESS_TOKEN is missing. Add both to .env (see .env.example), or to the host's environment."):
        return {"ok": False, "steps": steps}
    try:
        body = profile()
        who = body.get("data") if isinstance(body.get("data"), dict) else body  # Dhan answers /profile at the top level
        name = who.get("dhanClientName") or who.get("clientName") or ""
        step(True, f"Token: Dhan accepted it (client {who.get('dhanClientId', client_id)}{', ' + name if name else ''})")
    except DhanError as exc:
        step(False, "Token: Dhan refused it. Generate a new access token on the Dhan website and paste it into .env and the host's environment."
             if exc.kind == "token" else f"Token: could not check it. {exc.message}")
        return {"ok": False, "steps": steps}
    try:
        dates = expiries("NIFTY 50")
        step(True, f"Data API: subscription active (NIFTY 50 expiries: {', '.join(dates[:3])}{'…' if len(dates) > 3 else ''})")
    except DhanError as exc:
        step(False, "Data API: not subscribed. On the Dhan website, Profile > DhanHQ Trading APIs > Data APIs, subscribe (₹499 + tax a month, or free with 25 trades in 30 days)."
             if exc.kind == "subscription" else f"Data API: the expiry list failed. {exc.message}")
        return {"ok": False, "steps": steps}
    try:
        step(True, f"Price: NIFTY 50 last price from Dhan is {last_price('NIFTY 50'):,.2f}")
    except (DhanError, KeyError, ValueError) as exc:
        step(False, f"Price: the NIFTY 50 price failed. {getattr(exc, 'message', exc)}")
        return {"ok": False, "steps": steps}
    return {"ok": True, "steps": steps}
