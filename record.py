"""The daily save: the record of each trading session, and its copy on GitHub (LOGIC.md, "The record").

After every session the server writes the day to data/sessions/<date>.json: the minute candles of each index
on Dhan (1, 5, 15 and 30 minutes) and the day's and the previous day's four figures. Beside it, by the owner's
ask of 7 October, data/sessions/<date>-calls.csv: every call the index page suggested that day, each and every
one, as the page showed it (the setting it ran in, the level, the side, entry, target, exit, points, how it
ended, and the option's premiums as shown); the page sends its list as it draws it (record_calls), and so does
the server's watcher. During the session a partial copy of both is written every few minutes, so a restart
loses little. The options behind the day's calls go up as records/<date>.json whenever they change, and come
back at start, so a restart of the host does not lose an open call's premium paid.

This was study.py until 15 October, when the owner took the Study page off with everything under it. On
21 October the owner asked for the save back ("bring back the daily save, without study page"): the save,
the CSV and the records backup are as they were; there is no page over them. The lab (lab/) and check_rule.py
read the saved days from the data branch.

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
import memwatch
from providers import INTERVALS, now_ist

log = logging.getLogger("my-trade.record")
BASE = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("SAVE_DIR") or os.environ.get("STUDY_DIR") or BASE / "data")  # STUDY_DIR: the name until 15 October
SESSIONS = DATA_DIR / "sessions"
CALLS = DATA_DIR / "calls"  # the calls the index page suggested, as it sends them, one working file a day
TOKEN = os.environ.get("GITHUB_DATA_TOKEN", "").strip()
REPO = os.environ.get("GITHUB_DATA_REPO", os.environ.get("RENDER_GIT_REPO_SLUG", "AAB-sys/my-trade")).strip()  # owner/name
BRANCH = os.environ.get("GITHUB_DATA_BRANCH", "data").strip()
API = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")  # overridden only by tests
SAVE_AT = os.environ.get("SAVE_AT") or os.environ.get("STUDY_SAVE_AT") or "15:40"        # IST; the day's final save, after the close
PARTIAL_SECONDS = float(os.environ.get("SAVE_PARTIAL_SECONDS") or os.environ.get("STUDY_PARTIAL_SECONDS") or "600")  # the partial copy during the day, at most this often
CANDLE_KEYS = ("1m", "5m", "15m", "30m")
BRANCH_README = ("# My-Trade: the record of each trading session\n\n"
                 "Written by the dashboard's server after every session (and every few minutes during one): the minute\n"
                 "candles of each index and the day's figures, one file a day under\n"
                 "`sessions/`, and the options behind the day's calls under `records/`. This branch holds data only:\n"
                 "never merge it into `main`.\n")

state = {"github": bool(TOKEN), "repo": REPO, "branch": BRANCH, "problem": None, "saved_at": None, "pushed_at": None, "last": None,
         "checked": None}  # checked: the day the final save was tried and Dhan had no candle for it (a holiday)
_lock = threading.Lock()

# ---------------------------------------------------------------- the calls the index page suggested
# The page works the calls out from the candles and tells the server the list it shows (POST /calls/{name}) each
# time it draws it; the server keeps the latest state of every call it has ever been told about that day, keyed
# by the setting that gave it and the call itself, and writes them out as the day's CSV.
CALL_FIELDS = ("date", "index", "time_frame", "levels", "signal_mode", "first_seen_ist", "signal_time_ist", "level_pct", "level_price", "kind",
               "option_side", "entry_time_ist", "index_at_entry", "target", "exit_time_ist", "index_at_exit", "points", "ended_by",
               "contract", "premium_paid", "premium_now", "sell_below", "sold_at_premium",
               "candles_say", "exit_said_at_ist", "candles_why",  # the candle verdict (rules.js readOf / rule.read_of), 7 October: off the table, in the CSV
               "carry_deep", "beyond_level", "beyond_reached",  # the carry read (idea P5's question, rule.carry_of), 7 October evening
               "exit_at_ist", "parallel", "reason",  # 21 October: the early exit's minute (19 October), the parallel mark (18 October), the page's Reason column
               "gate", "gate_reason", "gate_check", "gate_advice", "paper",
               "lc", "lc_reason", "lc_check", "lc_advice", "lc_open_same",  # the Loss Cutter (24 October): its verdict, why, the check that decided, its advice, the calls open the same way when the order was placed
               "plan", "plan_reason", "builder", "builder_rules",  # the Trade Plan (29 October): TAKE for the first 3 calls fired between 12:00 and 15:00 on NIFTY 50, else SKIP and why
               "premium_low", "premium_low_at_ist", "stop15_at_ist", "stop15_premium",
               "lock", "lock_at_ist", "lock_points", "lock_peak", "lock_floor", "lock_premium", "lock_from", "lock_also")  # the Profit Lock (24 October): its setting and mode, the candle it said exit on, the points, best and floor then, the premium at that moment, the compared settings; the Call Gate's verdict on the signal, TAKE or SKIP, why, the check that decided, the parallel advice; "yes" on a call followed on paper (version 2, 23 October)
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


def _lock_also(also) -> str:
    """The Profit Lock's compared settings for the CSV: "STEADY 10:15 +0.0 at 112.40 · RUNNER 10:20 +3.1"."""
    if not isinstance(also, dict):
        return ""
    out = []
    for n, a in sorted(also.items()):
        try:
            prem = f" at {float(a['premium']):.2f}" if a.get("premium") is not None else ""
            out.append(f"{str(n)[:10]} {_stamp(a['at'])[11:]} {float(a['points']):+.1f}{prem}")
        except (KeyError, TypeError, ValueError, AttributeError):
            continue
    return " · ".join(out)[:160]


def _num(value):
    try:
        return round(float(value), 2) if value is not None and value != "" else ""
    except (TypeError, ValueError):
        return ""


HURRY = ("ended_by", "contract", "sold_at_premium", "candles_say")  # with a new row: the only changes that hurry the partial copy (a call entered, ended, got
# its contract or its Sell mark). Everything else in a row can drift on every resend without anything having happened: the points
# and the premium move with the price, and the level, target and entry shift by a few paise when Dhan's own candle replaces the
# one built from the ticks (7 October: those drifts kept the partial copy going every two minutes instead of every ten)


def record_calls(index: str, interval: str, levels: str, signal: str, session: str, calls: list) -> int:
    """The list the page shows for one setting of one index, merged in; returns how many rows are new."""
    global _calls_version
    now = now_ist()
    new, changed = 0, False
    with _calls_lock:
        day = live_calls.setdefault(session, {})
        for c in calls:
            if not isinstance(c, dict) or c.get("signal_time") is None:
                continue
            key = f"{index}|{interval}|{levels}|{signal}|{c.get('signal_time')}|{c.get('side')}"  # the signal candle and the side name the call; the level's price can move a little (today-so-far levels after a restart) and is data, not identity
            row = day.get(key)
            if row is None:
                row = {"date": session, "index": index, "time_frame": interval, "levels": levels, "signal_mode": signal, "first_seen_ist": now[:16].replace("T", " ")}
                new += 1
            before = None if key not in day else tuple(row.get(k) for k in HURRY)
            ratio = float(c.get("ratio") or 0)  # the previous close's lines (15 October) are named +23.6% above the close, -23.6% below it
            row.update({"signal_time_ist": _stamp(c.get("signal_time")), "level_pct": ("+" if levels == "close" and ratio > 0 else "") + f"{ratio * 100:.1f}%", "level_price": _num(c.get("level")),
                        "kind": str(c.get("kind") or "")[:10], "option_side": str(c.get("side") or "")[:2], "entry_time_ist": _stamp(c.get("entry_time")) if c.get("entry_time") else "",
                        "index_at_entry": _num(c.get("entry")), "target": _num(c.get("target")), "exit_time_ist": _stamp(c.get("exit_time")) if c.get("exit_time") else "",
                        "index_at_exit": _num(c.get("exit")), "points": _num(c.get("points")), "ended_by": str(c.get("how") or "")[:12],
                        "contract": str(c.get("contract") or "")[:40], "premium_paid": _num(c.get("premium_paid")), "premium_now": _num(c.get("premium_now")),
                        "sell_below": _num(c.get("sell_below")), "sold_at_premium": _num(c.get("sold_at")),
                        "candles_say": str(c.get("candles_say") or "")[:5], "exit_said_at_ist": _stamp(c.get("exit_said_at")) if c.get("exit_said_at") else "",
                        "candles_why": str(c.get("candles_why") or "")[:60],
                        "carry_deep": str(c.get("carry_deep") or "")[:3], "beyond_level": _num(c.get("beyond_level")), "beyond_reached": str(c.get("beyond_reached") or "")[:3],
                        "exit_at_ist": _stamp(c.get("exit_at")) if c.get("exit_at") else "", "parallel": "yes" if c.get("parallel") else "",
                        "reason": str(c.get("reason") or "")[:120] or row.get("reason", ""),  # the page's Reason column; the watcher's rows carry none, so they never blank it
                        "gate": str(c.get("gate") or "")[:5], "gate_reason": str(c.get("gate_reason") or "")[:140],  # the Call Gate (version 2, 23 October)
                        "gate_check": str(c.get("gate_check") or "")[:10], "gate_advice": str(c.get("gate_advice") or "")[:100], "paper": "yes" if c.get("paper") else "",
                        "lc": str(c.get("lc") or "")[:5], "lc_reason": str(c.get("lc_reason") or "")[:160], "lc_check": str(c.get("lc_check") or "")[:12],  # the Loss Cutter (24 October)
                        "lc_advice": str(c.get("lc_advice") or "")[:240], "lc_open_same": "" if c.get("lc_open_same") is None else str(int(c["lc_open_same"])),
                        "plan": str(c.get("plan") or "")[:5], "plan_reason": str(c.get("plan_reason") or "")[:60], "builder": str(c.get("builder") or "")[:5], "builder_rules": str(c.get("builder_rules") or "")[:120],  # the Trade Plan (29 October)
                        "premium_low": _num(c.get("premium_low")), "premium_low_at_ist": str(c.get("premium_low_at") or "")[11:16],  # the premium path: the lowest premium and when,
                        "stop15_at_ist": str(c.get("stop15_at") or "")[11:16], "stop15_premium": _num(c.get("stop15_premium")),  # and the 15% premium stop (log only)
                        "lock": str(c.get("lock") or "")[:20], "lock_at_ist": _stamp(c["lock_at"])[11:] if c.get("lock_at") else "",  # the Profit Lock (24 October)
                        "lock_points": _num(c.get("lock_points")), "lock_peak": _num(c.get("lock_peak")), "lock_floor": _num(c.get("lock_floor")),
                        "lock_premium": _num(c.get("lock_premium")), "lock_from": str(c.get("lock_from") or "")[:8], "lock_also": _lock_also(c.get("lock_also"))})
            day[key] = row
            if before is None or tuple(row.get(k) for k in HURRY) != before:
                changed = True
        if changed:  # the page sends its list every minute, and an open call's points move with every tick: only a call entering,
            _calls_version += 1  # ending, getting its contract or its Sell mark (not its points or premium moving) hurries the partial copy
            try:  # the working file on disk follows real changes (the server's watcher sends the list every few seconds)
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


class RecordError(Exception):
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
    None when Dhan has no candle for that day (a holiday, or not traded yet). Every index on Dhan: NIFTY 50, NIFTY BANK
    and, since 24 October, SENSEX (the owner: "save SENSEX candles in the daily save too"; until then the loop ran over the
    two indices the options began with, and 23 October's SENSEX table could not be replayed from the save)."""
    indices, missing, from_ticks = {}, {}, []
    for name in dhan.QUOTE_IDS:
        try:
            all_minutes = dhan.intraday(name, 1)
        except dhan.DhanError as exc:  # one index failing does not lose the other's day; the page says what is missing
            missing[name] = exc.message
            continue
        minutes = [b for b in all_minutes if ist_date(b["time"]) == day]
        if not minutes:
            continue
        if dhan.intraday_problem(name):  # today's candles are the ones built from the ticks (23 October): said in the file, and a day
            from_ticks.append(name)       # that does not start at 09:15 (the server came up during the session) is not a complete day
            first = datetime.fromtimestamp(minutes[0]["time"], dhan.IST)
            if complete and (first.hour, first.minute) != (9, 15):
                raise RecordError(f"{name}: the candles built from the ticks start at {first.strftime('%H:%M')}, not 09:15, and Dhan refuses its own; "
                                  "the day is not saved as complete")
        candles = {"1m": minutes}
        for key in CANDLE_KEYS[1:]:
            candles[key] = [b for b in dhan.intraday(name, INTERVALS[key]["bar_seconds"] // 60) if ist_date(b["time"]) == day]
        # the previous session: from Dhan's daily list, or from the candles where the list lags a session
        by_date = {}
        for b in all_minutes:
            by_date.setdefault(ist_date(b["time"]), []).append(b)
        days = {d: day_figures(bars) for d, bars in by_date.items()}
        days.update({ist_date(d["time"]): {k: d[k] for k in ("open", "high", "low", "close")} for d in dhan.daily_or_saved(name)})  # refused (22 October): the saved days' figures, then the candles'
        earlier = sorted(d for d in days if d < day)
        previous = {"date": earlier[-1].isoformat(), **days[earlier[-1]]} if earlier else None
        indices[name] = {"candles": candles, "day": day_figures(minutes), "previous": previous}
    if not indices:
        if missing:
            raise RecordError("Dhan gave no candles: " + "; ".join(f"{n}: {m}" for n, m in missing.items()))
        return None
    data = {"date": day.isoformat(), "saved_at": now_ist(), "complete": complete, "indices": indices}
    if missing:
        data["missing"] = missing
    if from_ticks:
        data["candles_from_ticks"] = from_ticks
    return data


def path_of(day: date) -> Path:
    return SESSIONS / f"{day.isoformat()}.json"


def read_day(day: date) -> dict | None:
    try:
        return json.loads(path_of(day).read_text())
    except (OSError, ValueError):
        return None


_saved_sessions: dict = {"stamp": None, "days": {}}  # the saved days' four figures per index, read again only when the files change


def saved_sessions(name: str) -> list:
    """The sessions the saved days know for an index, as daily bars (time: the day's 9:15 IST; open, high, low, close),
    oldest first: each saved day's own figures and the previous day it names. For the previous session, the levels and
    the dashboard when Dhan refuses its daily list (23 October: /charts/historical and /charts/intraday both refused
    for the whole morning, with yesterday's complete copy sitting on the disk and on GitHub)."""
    stamp = tuple((path.name, path.stat().st_mtime) for path in sorted(SESSIONS.glob("*.json")))
    if stamp != _saved_sessions["stamp"]:
        days = {}
        for path in sorted(SESSIONS.glob("*.json")):
            data = read_day(date.fromisoformat(path.stem)) if len(path.stem) == 10 else None
            for index, got in ((data or {}).get("indices") or {}).items():
                mine = days.setdefault(index, {})
                if data.get("complete") and got.get("day"):
                    mine[data["date"]] = got["day"]
                if got.get("previous") and got["previous"].get("date"):
                    mine.setdefault(got["previous"]["date"], {k: got["previous"][k] for k in ("open", "high", "low", "close")})
        _saved_sessions.update(stamp=stamp, days=days)
    mine = _saved_sessions["days"].get(name) or {}
    return [{"time": int(datetime.combine(date.fromisoformat(d), datetime.min.time()).replace(hour=9, minute=15, tzinfo=dhan.IST).timestamp()),
             **{k: mine[d][k] for k in ("open", "high", "low", "close")}} for d in sorted(mine)]


def is_complete(day: date) -> bool:
    data = read_day(day)
    return bool(data and data.get("complete"))


def saved_days() -> list:
    """One line per saved day, newest first: the date, whether it is the day's final copy, when, which indices (for /health)."""
    out = []
    for path in sorted(SESSIONS.glob("*.json"), reverse=True):
        try:
            data = json.loads(path.read_text())
            out.append({"date": data["date"], "complete": bool(data.get("complete")), "saved_at": data.get("saved_at"),
                        "indices": sorted(data.get("indices", {})), "live_calls": calls_count(data["date"])})
        except (OSError, ValueError, KeyError):
            continue
    return out


def summary() -> dict:  # the state in a few plain fields
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
        except (RecordError, dhan.DhanError) as exc:
            state["problem"] = f"The day could not be saved: {getattr(exc, 'message', exc)}"
            raise RecordError(state["problem"]) from exc
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
                except RecordError as exc:
                    state["problem"] = str(exc)
                    log.warning("record: %s", exc)
        return data


# ---------------------------------------------------------------- GitHub: the copy that outlives the host

def _github() -> httpx.Client:
    return httpx.Client(base_url=API, timeout=30, headers={"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json",
                                                           "X-GitHub-Api-Version": "2022-11-28"})


def _why(response: httpx.Response, doing: str) -> RecordError:
    try:
        said = response.json().get("message", "")
    except ValueError:
        said = response.text[:120]
    if response.status_code == 401:
        return RecordError(f"GitHub refused the token while {doing}: it is wrong or has expired. Make a new GITHUB_DATA_TOKEN.")
    if response.status_code in (403, 404):
        return RecordError(f"GitHub would not let the token {doing} on {REPO} (HTTP {response.status_code}, {said}). "
                          "The token needs Contents: read and write on this repository.")
    return RecordError(f"GitHub answered HTTP {response.status_code} while {doing}: {said}")


def blob_sha(data: bytes) -> str:
    """The id GitHub gives a file's content, so an unchanged file is not pushed again."""
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def push(path: Path) -> None:
    """One day's file onto the data branch."""
    push_bytes(f"sessions/{path.name}", path.read_bytes(), f"Session {path.stem}")


def push_bytes(rel: str, data: bytes, message: str) -> None:
    """One file onto the data branch, created from nothing (no code in it) the first time; unchanged, nothing is sent."""
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
            body = {"message": message, "content": base64.b64encode(data).decode(), "branch": BRANCH}
            if sha:
                body["sha"] = sha
            put = http.put(f"/repos/{REPO}/contents/{rel}", json=body)
            if put.status_code not in (200, 201):
                raise _why(put, "writing the day's file")
    except httpx.HTTPError as exc:
        raise RecordError(f"GitHub could not be reached ({type(exc).__name__}): the file is kept on this server meanwhile") from exc


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
        raise RecordError(f"GitHub could not be reached ({type(exc).__name__}) when looking for saved days") from exc
    return got


def push_records(day: date) -> bool:
    """The options behind the day's calls (dhan.py's records: contract, premium paid, sell line, Sell mark, end) onto the
    data branch as records/<date>.json, so a restart does not lose them (7 October: every restart emptied the disk, and a
    call open across one got "paid" from the moment the page sent it again). Returns whether there was anything."""
    text = dhan.records_text(day.isoformat())
    if text is None:
        return False
    push_bytes(f"records/{day.isoformat()}.json", text.encode(), f"Options behind the calls of {day.isoformat()}")
    state["records_pushed_at"] = now_ist()
    return True


def pull_records(day: date) -> int:
    """At start: the day's records from the data branch, for the calls still open across a restart. Returns how many."""
    try:
        with _github() as http:
            one = http.get(f"/repos/{REPO}/contents/records/{day.isoformat()}.json", params={"ref": BRANCH})
            if one.status_code == 404:
                return 0
            if one.status_code != 200:
                raise _why(one, "reading the day's records")
            return dhan.restore_records(base64.b64decode(one.json()["content"]).decode())
    except httpx.HTTPError as exc:
        raise RecordError(f"GitHub could not be reached ({type(exc).__name__}) when looking for the day's records") from exc


# ---------------------------------------------------------------- the loop

def measured_save(day: date) -> dict | None:
    """The day's partial copy, its memory measured (memwatch, 9 October)."""
    with memwatch.watch("the day's partial copy"):
        return save_day(day, False)


def catch_up(days_back: int = 7) -> None:
    """Any finished weekday of the last days without a final copy is saved now (the server was asleep at its close)."""
    today = dhan.today_ist()
    now = datetime.now(dhan.IST)
    for back in range(days_back, -1, -1):
        day = today - timedelta(days=back)
        if day.weekday() >= 5 or is_complete(day) or (day == today and (now.hour, now.minute) < save_time()):
            continue
        with memwatch.watch("the day's final save"):
            saved = save_day(day, complete=True)
        if saved is None:
            if day == today:
                state["checked"] = today.isoformat()  # looked, and Dhan had no candle for today: a holiday, nothing to save
            continue
        if ended := dhan.end_day(day.isoformat()):  # the day is saved: nothing carries overnight, whoever made the record
            log.info("record: %d record(s) of %s still open at the final save, marked ended at the day end", ended, day.isoformat())


def in_session(now: datetime) -> bool:
    return now.weekday() < 5 and (9, 16) <= (now.hour, now.minute) < (15, 31)


async def record_forever(dhan_on: bool) -> None:
    """At start: the days on GitHub that this server lacks. Then, on Dhan: the partial copy every PARTIAL_SECONDS
    during the session, the final copy at SAVE_AT, and once an hour a look for finished days without one."""
    if TOKEN:
        try:
            got = await asyncio.to_thread(pull_missing)
            if got:
                log.info("record: %d saved days fetched from GitHub", got)
        except RecordError as exc:
            state["problem"] = str(exc)
            log.warning("record: %s", exc)
    if not dhan_on:
        return  # nothing to record without the owner's own feed
    if TOKEN:
        try:
            back = await asyncio.to_thread(pull_records, dhan.today_ist())
            if back:
                log.info("record: %d call records of today fetched from GitHub", back)
        except RecordError as exc:
            state["problem"] = str(exc)
            log.warning("record: %s", exc)
    partial_at, caught_up, seen = 0.0, 0.0, calls_version()
    records_seen = dhan.records_version()
    while True:
        try:
            now = datetime.now(dhan.IST)
            if TOKEN and dhan.records_version() != records_seen:  # a call entered, got its contract, its Sell mark or its end: the records go up
                records_seen = dhan.records_version()
                await asyncio.to_thread(push_records, now.date())
            if in_session(now) and not is_complete(now.date()):  # the partial copy, until the day's final copy is written
                changed = calls_version() != seen  # the page told of a call: the partial copy goes sooner, so a restart loses little
                if time.monotonic() - partial_at >= (120 if changed else PARTIAL_SECONDS):
                    partial_at, seen = time.monotonic(), calls_version()
                    await asyncio.to_thread(measured_save, now.date())
            if time.monotonic() - caught_up >= 3600 or ((now.hour, now.minute) >= save_time() and now.weekday() < 5 and not is_complete(now.date())):
                caught_up = time.monotonic()
                await asyncio.to_thread(catch_up)
        except Exception as exc:  # Dhan down, the disk full: said on the page, tried again next time
            state["problem"] = f"{type(exc).__name__}: {str(exc)[:160]}"
            log.warning("record: %s", exc)
        await asyncio.sleep(30)
