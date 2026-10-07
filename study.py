"""The record of each trading session, and its copy on GitHub (LOGIC.md, "The record and the study").

After every session the server writes the day to data/sessions/<date>.json: the minute candles of each index
on Dhan (1, 5, 15 and 30 minutes) and the day's and the previous day's four figures. Beside it, by the owner's
ask of 7 October, data/sessions/<date>-calls.csv: every call the index page suggested that day, each and every
one, as the page showed it (the setting it ran in, the level, the side, entry, target, exit, points, how it
ended, and the option's premiums as shown); the page sends its list as it draws it (record_calls). During the
session a partial copy of both is written every few minutes, so the study page can show today so far and a
restart loses little. The study page and the lab run the owner's rules over every saved day and read the
calls back.

The host's files do not last, so each file is also pushed to a branch of the owner's own repository, which
needs one more secret in the host's environment, never in the repo:

    GITHUB_DATA_TOKEN   a fine-grained personal access token allowed to read and write this repository's contents

Without it the days are kept on this server only. Nothing else is sent anywhere.
"""
import asyncio
import base64
import csv
import io
import hashlib
import json
import logging
import os
import threading
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import httpx

import dhan
from providers import INTERVALS, now_ist

log = logging.getLogger("my-trade.study")
BASE = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("STUDY_DIR", BASE / "data"))
SESSIONS = DATA_DIR / "sessions"
CALLS = DATA_DIR / "calls"  # the calls the index page suggested, as it sends them, one working file a day
TOKEN = os.environ.get("GITHUB_DATA_TOKEN", "").strip()
REPO = os.environ.get("GITHUB_DATA_REPO", os.environ.get("RENDER_GIT_REPO_SLUG", "AAB-sys/my-trade")).strip()  # owner/name
BRANCH = os.environ.get("GITHUB_DATA_BRANCH", "data").strip()
API = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")  # overridden only by tests
SAVE_AT = os.environ.get("STUDY_SAVE_AT", "15:40")        # IST; the day's final save, after the close
PARTIAL_SECONDS = float(os.environ.get("STUDY_PARTIAL_SECONDS", "600"))  # the partial copy during the day, at most this often
CANDLE_KEYS = ("1m", "5m", "15m", "30m")
BRANCH_README = ("# My-Trade: the record of each trading session\n\n"
                 "Written by the dashboard's server after every session (and every few minutes during one): the minute\n"
                 "candles of each index and the day's figures, one file a day under\n"
                 "`sessions/`. The study page reads them. This branch holds data only: never merge it into `main`.\n")

state = {"github": bool(TOKEN), "repo": REPO, "branch": BRANCH, "problem": None, "saved_at": None, "pushed_at": None, "last": None,
         "checked": None}  # checked: the day the final save was tried and Dhan had no candle for it (a holiday)
_lock = threading.Lock()

# ---------------------------------------------------------------- the calls the index page suggested
# The page works the calls out from the candles and tells the server the list it shows (POST /calls/{name}) each
# time it draws it; the server keeps the latest state of every call it has ever been told about that day, keyed
# by the setting that gave it and the call itself, and writes them out as the day's CSV.
CALL_FIELDS = ("date", "index", "time_frame", "levels", "signal_mode", "first_seen_ist", "signal_time_ist", "level_pct", "level_price", "kind",
               "option_side", "entry_time_ist", "index_at_entry", "target", "exit_time_ist", "index_at_exit", "points", "ended_by",
               "contract", "premium_paid", "premium_now", "sell_below", "sold_at_premium")
live_calls: dict = {}  # date -> {key: row}
_calls_lock = threading.Lock()
_calls_version = 0


def calls_version() -> int:
    return _calls_version


def _stamp(epoch) -> str:
    try:
        return datetime.fromtimestamp(float(epoch), dhan.IST).strftime("%Y-%m-%d %H:%M")
    except (TypeError, ValueError, OverflowError):
        return ""


def _num(value):
    try:
        return round(float(value), 2) if value is not None and value != "" else ""
    except (TypeError, ValueError):
        return ""


def record_calls(index: str, interval: str, levels: str, signal: str, session: str, calls: list) -> int:
    """The list the page shows for one setting of one index, merged in; returns how many rows are new."""
    global _calls_version
    now = now_ist()
    new = 0
    with _calls_lock:
        day = live_calls.setdefault(session, {})
        for c in calls:
            if not isinstance(c, dict) or c.get("signal_time") is None:
                continue
            key = f"{index}|{interval}|{levels}|{signal}|{c.get('signal_time')}|{c.get('level')}|{c.get('side')}"
            row = day.get(key)
            if row is None:
                row = {"date": session, "index": index, "time_frame": interval, "levels": levels, "signal_mode": signal, "first_seen_ist": now[:16].replace("T", " ")}
                new += 1
            row.update({"signal_time_ist": _stamp(c.get("signal_time")), "level_pct": f"{float(c.get('ratio') or 0) * 100:.1f}%", "level_price": _num(c.get("level")),
                        "kind": str(c.get("kind") or "")[:10], "option_side": str(c.get("side") or "")[:2], "entry_time_ist": _stamp(c.get("entry_time")) if c.get("entry_time") else "",
                        "index_at_entry": _num(c.get("entry")), "target": _num(c.get("target")), "exit_time_ist": _stamp(c.get("exit_time")) if c.get("exit_time") else "",
                        "index_at_exit": _num(c.get("exit")), "points": _num(c.get("points")), "ended_by": str(c.get("how") or "")[:12],
                        "contract": str(c.get("contract") or "")[:40], "premium_paid": _num(c.get("premium_paid")), "premium_now": _num(c.get("premium_now")),
                        "sell_below": _num(c.get("sell_below")), "sold_at_premium": _num(c.get("sold_at"))})
            day[key] = row
        _calls_version += 1
        try:
            CALLS.mkdir(parents=True, exist_ok=True)
            (CALLS / f"{session}.json").write_text(json.dumps(list(day.values()), indent=1))
        except OSError:
            pass
    return new


def calls_csv(day: date) -> str | None:
    """The day's calls as CSV text, in the order they were first seen, or None when there are none."""
    with _calls_lock:
        rows = list(live_calls.get(day.isoformat(), {}).values())
    if not rows:
        return None
    rows.sort(key=lambda r: (r["first_seen_ist"], r["signal_time_ist"]))
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=CALL_FIELDS, extrasaction="ignore", lineterminator="\n")  # plain line ends, as the rest of the record
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue()


def calls_count(day_iso: str) -> int:
    """How many calls the day's CSV holds (the file, so a fresh host counts what it fetched)."""
    path = SESSIONS / f"{day_iso}-calls.csv"
    try:
        return max(0, sum(1 for _ in path.open()) - 1)
    except OSError:
        return 0


class StudyError(Exception):
    pass


def ist_date(t: float) -> date:
    return datetime.fromtimestamp(t, dhan.IST).date()


def save_time() -> tuple:
    hour, minute = SAVE_AT.split(":")
    return int(hour), int(minute)


# ---------------------------------------------------------------- the day's file

def to_text(data) -> str:
    """The file's text: one candle (or one day's figures) a line, the rest indented, so it reads on GitHub."""
    def enc(value, depth):
        pad = " " * depth
        if isinstance(value, dict):
            if value and all(not isinstance(v, (dict, list)) for v in value.values()):
                return json.dumps(value)
            return "{\n" + ",\n".join(f"{pad} {json.dumps(k)}: {enc(v, depth + 1)}" for k, v in value.items()) + f"\n{pad}}}"
        if isinstance(value, list):
            if not value:
                return "[]"
            return "[\n" + ",\n".join(pad + " " + enc(v, depth + 1) for v in value) + f"\n{pad}]"
        return json.dumps(value)
    return enc(data, 0) + "\n"


def day_figures(bars: list) -> dict:
    return {"open": bars[0]["open"], "high": max(b["high"] for b in bars), "low": min(b["low"] for b in bars), "close": bars[-1]["close"]}


def build_day(day: date, complete: bool) -> dict | None:
    """The day's record from Dhan's candles (the last days are asked for in one request each, and cached briefly)
    None when Dhan has no candle for that day (a holiday, or not traded yet)."""
    indices, missing = {}, {}
    for name in dhan.INDEX_IDS:
        try:
            all_minutes = dhan.intraday(name, 1)
        except dhan.DhanError as exc:  # one index failing does not lose the other's day; the page says what is missing
            missing[name] = exc.message
            continue
        minutes = [b for b in all_minutes if ist_date(b["time"]) == day]
        if not minutes:
            continue
        candles = {"1m": minutes}
        for key in CANDLE_KEYS[1:]:
            candles[key] = [b for b in dhan.intraday(name, INTERVALS[key]["bar_seconds"] // 60) if ist_date(b["time"]) == day]
        # the previous session: from Dhan's daily list, or from the candles where the list lags a session
        by_date = {}
        for b in all_minutes:
            by_date.setdefault(ist_date(b["time"]), []).append(b)
        days = {d: day_figures(bars) for d, bars in by_date.items()}
        days.update({ist_date(d["time"]): {k: d[k] for k in ("open", "high", "low", "close")} for d in dhan.daily(name)})
        earlier = sorted(d for d in days if d < day)
        previous = {"date": earlier[-1].isoformat(), **days[earlier[-1]]} if earlier else None
        indices[name] = {"candles": candles, "day": day_figures(minutes), "previous": previous}
    if not indices:
        if missing:
            raise StudyError("Dhan gave no candles: " + "; ".join(f"{n}: {m}" for n, m in missing.items()))
        return None
    data = {"date": day.isoformat(), "saved_at": now_ist(), "complete": complete, "indices": indices}
    if missing:
        data["missing"] = missing
    return data


def path_of(day: date) -> Path:
    return SESSIONS / f"{day.isoformat()}.json"


def read_day(day: date) -> dict | None:
    try:
        return json.loads(path_of(day).read_text())
    except (OSError, ValueError):
        return None


def is_complete(day: date) -> bool:
    data = read_day(day)
    return bool(data and data.get("complete"))


def saved_days() -> list:
    """One line per saved day, newest first: the date, whether it is the day's final copy, when, which indices."""
    out = []
    for path in sorted(SESSIONS.glob("*.json"), reverse=True):
        try:
            data = json.loads(path.read_text())
            out.append({"date": data["date"], "complete": bool(data.get("complete")), "saved_at": data.get("saved_at"),
                        "indices": sorted(data.get("indices", {})), "live_calls": calls_count(data["date"])})
        except (OSError, ValueError, KeyError):
            continue
    return out


def summary() -> dict:
    """For /health, which the wake-up check reads without a login: the latest day with its final copy (from the files, so
    a fresh host answers right after it fetched them), the day checked and found without a session, and any problem."""
    complete = [d["date"] for d in saved_days() if d["complete"]]
    return {"last_complete": complete[0] if complete else None, "checked": state["checked"], "saved_at": state["saved_at"],
            "pushed_at": state["pushed_at"], "github": state["github"], "problem": state["problem"]}


def save_day(day: date, complete: bool) -> dict | None:
    """Builds the day, writes it, and pushes it to GitHub when the token is set. The problem, if any, is kept in
    state["problem"] for the page; a failed push never loses the file on disk."""
    with _lock:
        try:
            data = build_day(day, complete)
        except (StudyError, dhan.DhanError) as exc:
            state["problem"] = f"The day could not be saved: {getattr(exc, 'message', exc)}"
            raise StudyError(state["problem"]) from exc
        if data is None:
            return None
        old = read_day(day)
        strip = lambda d: {k: v for k, v in d.items() if k != "saved_at"}
        if old and strip(old) == strip(data):
            data["saved_at"] = old.get("saved_at", data["saved_at"])  # nothing new: the file, and GitHub, are left as they are
        SESSIONS.mkdir(parents=True, exist_ok=True)
        path_of(day).write_text(to_text(data))
        files = [path_of(day)]
        text = calls_csv(day)  # the calls the page suggested that day, beside the candles
        if text is not None:
            calls_path = SESSIONS / f"{day.isoformat()}-calls.csv"
            calls_path.write_text(text)
            files.append(calls_path)
        state.update(saved_at=now_ist(), last=day.isoformat(), problem=None)
        if TOKEN:
            for path in files:
                try:
                    push(path)
                    state.update(problem=None, pushed_at=now_ist())
                except StudyError as exc:
                    state["problem"] = str(exc)
                    log.warning("study: %s", exc)
        return data


# ---------------------------------------------------------------- GitHub: the copy that outlives the host

def _github() -> httpx.Client:
    return httpx.Client(base_url=API, timeout=30, headers={"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json",
                                                           "X-GitHub-Api-Version": "2022-11-28"})


def _why(response: httpx.Response, doing: str) -> StudyError:
    try:
        said = response.json().get("message", "")
    except ValueError:
        said = response.text[:120]
    if response.status_code == 401:
        return StudyError(f"GitHub refused the token while {doing}: it is wrong or has expired. Make a new GITHUB_DATA_TOKEN.")
    if response.status_code in (403, 404):
        return StudyError(f"GitHub would not let the token {doing} on {REPO} (HTTP {response.status_code}, {said}). "
                          "The token needs Contents: read and write on this repository.")
    return StudyError(f"GitHub answered HTTP {response.status_code} while {doing}: {said}")


def blob_sha(data: bytes) -> str:
    """The id GitHub gives a file's content, so an unchanged file is not pushed again."""
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def push(path: Path) -> None:
    """One file onto the data branch, created from nothing (no code in it) the first time."""
    rel = f"sessions/{path.name}"
    data = path.read_bytes()
    try:
        with _github() as http:
            found = http.get(f"/repos/{REPO}/contents/{rel}", params={"ref": BRANCH})
            if found.status_code == 200:
                if found.json().get("sha") == blob_sha(data):
                    return  # already there, unchanged
                sha = found.json().get("sha")
            elif found.status_code == 404:
                branch = http.get(f"/repos/{REPO}/branches/{BRANCH}")
                if branch.status_code == 404:
                    create_branch(http, rel, data.decode())
                    return
                if branch.status_code != 200:
                    raise _why(branch, "looking for the data branch")
                sha = None
            else:
                raise _why(found, "reading the data branch")
            body = {"message": f"Session {path.stem}", "content": base64.b64encode(data).decode(), "branch": BRANCH}
            if sha:
                body["sha"] = sha
            put = http.put(f"/repos/{REPO}/contents/{rel}", json=body)
            if put.status_code not in (200, 201):
                raise _why(put, "writing the day's file")
    except httpx.HTTPError as exc:
        raise StudyError(f"GitHub could not be reached ({type(exc).__name__}): the file is kept on this server meanwhile") from exc


def create_branch(http: httpx.Client, rel: str, text: str) -> None:
    """A branch with no history behind it, holding the first day's file and a README: the data stays apart from the code."""
    tree = http.post(f"/repos/{REPO}/git/trees", json={"tree": [
        {"path": "README.md", "mode": "100644", "type": "blob", "content": BRANCH_README},
        {"path": rel, "mode": "100644", "type": "blob", "content": text}]})
    if tree.status_code != 201:
        raise _why(tree, "creating the data branch")
    commit = http.post(f"/repos/{REPO}/git/commits", json={"message": "The record of each trading session", "tree": tree.json()["sha"], "parents": []})
    if commit.status_code != 201:
        raise _why(commit, "creating the data branch")
    ref = http.post(f"/repos/{REPO}/git/refs", json={"ref": f"refs/heads/{BRANCH}", "sha": commit.json()["sha"]})
    if ref.status_code != 201:
        raise _why(ref, "creating the data branch")


def pull_missing() -> int:
    """Fetches from the data branch every day this server lacks (the host starts with an empty folder). Returns how many."""
    got = 0
    try:
        with _github() as http:
            listing = http.get(f"/repos/{REPO}/contents/sessions", params={"ref": BRANCH})
            if listing.status_code == 404:
                return 0  # no branch, or nothing on it yet
            if listing.status_code != 200:
                raise _why(listing, "listing the data branch")
            SESSIONS.mkdir(parents=True, exist_ok=True)
            for item in listing.json():
                name = item.get("name", "")
                if not (name.endswith(".json") or name.endswith(".csv")) or (SESSIONS / name).exists():
                    continue
                one = http.get(f"/repos/{REPO}/contents/sessions/{name}", params={"ref": BRANCH})
                if one.status_code != 200:
                    raise _why(one, f"reading {name}")
                (SESSIONS / name).write_bytes(base64.b64decode(one.json()["content"]))
                got += 1
    except httpx.HTTPError as exc:
        raise StudyError(f"GitHub could not be reached ({type(exc).__name__}) when looking for saved days") from exc
    return got


# ---------------------------------------------------------------- the loop

def catch_up(days_back: int = 7) -> None:
    """Any finished weekday of the last days without a final copy is saved now (the server was asleep at its close)."""
    today = dhan.today_ist()
    now = datetime.now(dhan.IST)
    for back in range(days_back, -1, -1):
        day = today - timedelta(days=back)
        if day.weekday() >= 5 or is_complete(day) or (day == today and (now.hour, now.minute) < save_time()):
            continue
        if save_day(day, complete=True) is None and day == today:
            state["checked"] = today.isoformat()  # looked, and Dhan had no candle for today: a holiday, nothing to save


def in_session(now: datetime) -> bool:
    return now.weekday() < 5 and (9, 16) <= (now.hour, now.minute) < (15, 31)


async def study_forever(dhan_on: bool) -> None:
    """At start: the days on GitHub that this server lacks. Then, on Dhan: the partial copy every PARTIAL_SECONDS
    during the session, the final copy at SAVE_AT, and once an hour a look for finished days without one."""
    if TOKEN:
        try:
            got = await asyncio.to_thread(pull_missing)
            if got:
                log.info("study: %d saved days fetched from GitHub", got)
        except StudyError as exc:
            state["problem"] = str(exc)
            log.warning("study: %s", exc)
    if not dhan_on:
        return  # nothing to record without the owner's own feed
    partial_at, caught_up, seen = 0.0, 0.0, calls_version()
    while True:
        try:
            now = datetime.now(dhan.IST)
            if in_session(now):
                changed = calls_version() != seen  # the page told of a call: the partial copy goes sooner, so a restart loses little
                if time.monotonic() - partial_at >= (120 if changed else PARTIAL_SECONDS):
                    partial_at, seen = time.monotonic(), calls_version()
                    await asyncio.to_thread(save_day, now.date(), False)
            if time.monotonic() - caught_up >= 3600 or ((now.hour, now.minute) >= save_time() and now.weekday() < 5 and not is_complete(now.date())):
                caught_up = time.monotonic()
                await asyncio.to_thread(catch_up)
        except Exception as exc:  # Dhan down, the disk full: said on the page, tried again next time
            state["problem"] = f"{type(exc).__name__}: {str(exc)[:160]}"
            log.warning("study: %s", exc)
        await asyncio.sleep(30)
