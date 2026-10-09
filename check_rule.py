"""The server's copy of the rule (rule.py) against the page's engine (static/rules.js), call for call:
every saved day in a folder, the hand-made day of lab/check.js, and random days; every time frame, levels mode,
signal and idea; replayed, and live at several moments of the day with a candle still forming, with the levels
the live page uses. One differing call fails the check. Run:   python3 check_rule.py [folder of saved days]"""
import json
import os
import random
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rule  # noqa: E402

JS = r"""
require(process.argv[1]);
const R = globalThis.Rules;
const jobs = JSON.parse(require("fs").readFileSync(0, "utf8"));
const out = jobs.map(j => {
  const levels = j.levels;  // the live page: the levels as they stand now, for every candle
  const res = j.mode === "replay" ? R.replayDay({ bars: j.bars, move: j.move, previous: j.previous, seconds: j.seconds, signal: j.signal, ideas: j.ideas || undefined,
                                                 trail: "trail" in j ? j.trail : undefined })  // Rule 2: as the page runs it, or another setting, or null (Rule 1 alone)
    : j.mode === "live-today" ? R.paperTrades({ bars: j.bars, levelsAt: R.todayLevelsAt(j.bars), targetsAt: R.todayLinesAt(j.bars), now: j.now, seconds: j.seconds,
                                                dayCandles: false, signal: j.signal, holdBreaks: true, trail: R.TRAIL })  // the index page and the watcher today
    : R.paperTrades({ bars: j.bars, levelsAt: () => levels, now: j.now, seconds: j.seconds, dayCandles: false, signal: j.signal, ideas: j.ideas || undefined, holdBreaks: true, trail: R.TRAIL });
  res.trades.forEach(t => { t.read = R.readOf({ trade: t, bars: j.bars, seconds: j.seconds, now: j.mode === "replay" ? Infinity : j.now });  // the candle verdict too
    t.carry = R.carryOf({ trade: t, bars: j.bars, seconds: j.seconds, now: j.mode === "replay" ? Infinity : j.now }); });  // and the carry read
  return res;
});
process.stdout.write(JSON.stringify(out));
"""


def js_run(jobs: list) -> list:
    proc = subprocess.run(["node", "-e", JS, str(HERE / "static" / "rules.js")], input=json.dumps(jobs).encode(), capture_output=True, check=True)
    return json.loads(proc.stdout)


def py_run(jobs: list) -> list:
    out = []
    for j in jobs:
        if j["mode"] == "replay":
            res = rule.replay_day(j["bars"], j["move"], j["previous"], j["seconds"], j["signal"], j.get("ideas"), j["trail"] if "trail" in j else rule.TRAIL)
        elif j["mode"] == "live-today":
            res = rule.paper_trades(j["bars"], rule.today_levels_at(j["bars"]), j["now"], j["seconds"], False, j["signal"], None, rule.today_lines_at(j["bars"]), True, rule.TRAIL)
        else:
            levels = j["levels"]
            res = rule.paper_trades(j["bars"], lambda i, L=levels: L, j["now"], j["seconds"], False, j["signal"], j.get("ideas"), None, True, rule.TRAIL)
        for t in res["trades"]:
            t["read"] = rule.read_of(t, j["bars"], j["seconds"], rule.INF if j["mode"] == "replay" else j["now"])  # the candle verdict too
            t["carry"] = rule.carry_of(t, j["bars"], j["seconds"], rule.INF if j["mode"] == "replay" else j["now"])  # and the carry read
        out.append(res)
    return out


def same(a, b) -> bool:
    """JSON-level equality, a Python float and a JavaScript integer-valued number alike."""
    return json.loads(json.dumps(a, sort_keys=True)) == json.loads(json.dumps(b, sort_keys=True))


def fold(bars: list, seconds: int) -> list:
    """Candles of one size from smaller ones, as the server's fold does: by the start of each bucket."""
    out = {}
    for b in bars:
        start = b["time"] - ((b["time"] + rule.IST_OFFSET) % 86400 - rule.SESSION_START) % seconds
        c = out.get(start)
        if c is None:
            out[start] = dict(b, time=start)
        else:
            c["high"], c["low"], c["close"] = max(c["high"], b["high"]), min(c["low"], b["low"]), b["close"]
    return [out[k] for k in sorted(out)]


def saved_days(folder: Path) -> list:
    days = []
    for f in sorted(folder.glob("????-??-??.json")):
        d = json.loads(f.read_text())
        if d.get("complete"):
            days.append(d)
    return days


def random_day(rnd: random.Random, t0: int, n: int, start: float) -> list:
    """A random walk of n candles with gaps, ties and flat candles, the kind of day the rule must agree on."""
    bars, price = [], start
    for i in range(n):
        o = price + rnd.choice([0, 0, rnd.uniform(-3, 3)])
        c = o + rnd.gauss(0, 4)
        hi = max(o, c) + abs(rnd.gauss(0, 2)) * rnd.choice([0, 1, 1])
        lo = min(o, c) - abs(rnd.gauss(0, 2)) * rnd.choice([0, 1, 1])
        bars.append({"time": t0 + i * 300, "open": rule.round2(o), "high": rule.round2(hi), "low": rule.round2(lo), "close": rule.round2(c)})
        price = c
    return bars


def main() -> int:
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "data" / "sessions"
    jobs = []
    IDEAS = [None, {"closeAt": 15 * 3600}, {"noNewAfter": 14 * 3600}, {"closeAt": 15 * 3600, "noNewAfter": 14 * 3600},
             {"minDepth": 0.25}, {"closeAt": 15 * 3600, "noNewAfter": 14 * 3600, "minDepth": 0.25},
             {"exitBack": 0.25}, {"minDepth": 0.25, "exitBack": 0.25}, {"closeAt": 15 * 3600, "noNewAfter": 14 * 3600, "minDepth": 0.25, "exitBack": 0.25},
             {"carryOn": 0.25}, {"carryOn": 0}, {"closeAt": 15 * 3600, "noNewAfter": 14 * 3600, "carryOn": 0.25},
             {"closeAt": 15 * 3600, "noNewAfter": 14 * 3600, "minDepth": 0.25, "exitBack": 0.25, "carryOn": 0.25},
             {"stopShare": 1}, {"stopShare": 0.5}, {"stopShare": 0.5, "exitBack": 0.25, "carryOn": 0.25}]  # the stops, ideas P6 and P7 (8 October)
    # Rule 2's settings (the owner's specification, 9 October, section 6): Rule 1 alone, the stop a line back, a fixed buffer, the ATR's
    TRAILS = [None, {"buffer": "none", "place": "back"}, {"buffer": "fixed", "points": 10, "place": "at"}, {"buffer": "fixed", "points": 10, "place": "back"},
              {"buffer": "atr", "mult": 0.25, "points": 10, "place": "at"}, {"buffer": "atr", "mult": 0.5, "points": 10, "place": "back"},
              {"buffer": "atr", "mult": 0.5, "period": 5, "place": "at"}, {"lines": "all", "buffer": "none", "place": "at"}, {"lines": "all", "buffer": "fixed", "points": 10, "place": "back"}]
    # 1. the saved days, replayed in every setting
    days = saved_days(folder) if folder.exists() else []
    for d in days:
        for name, idx in d["indices"].items():
            candles = idx["candles"] if "candles" in idx else idx
            prev = idx.get("previous") or d.get("previous", {}).get(name)
            for key, seconds in (("5m", 300), ("15m", 900), ("30m", 1800)):
                bars = candles.get(key) or fold(candles["5m"], seconds)
                for move in ("prev", "today"):
                    if move == "prev" and not prev:
                        continue
                    for signal in ("held", "crossed", "both"):
                        for ideas in IDEAS:
                            jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": seconds, "signal": signal, "ideas": ideas, "what": f"{d['date']} {name} {key} {move} {signal}"})
                        for k, trail in enumerate(TRAILS):
                            jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": seconds, "signal": signal, "trail": trail,
                                         "what": f"{d['date']} {name} {key} {move} {signal} trail {k}"})
                        if candles.get("1m"):  # the stops settled by the day's one-minute candles, as the Study page runs them
                            for share in (1, 0.5):
                                jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": seconds, "signal": signal,
                                             "ideas": {"stopShare": share, "minutes": candles["1m"]}, "what": f"{d['date']} {name} {key} {move} {signal} stop {share} by minutes"})
                # 2. the same day live, at several moments, with the levels as the page has them then (today so far, current)
                bars5 = candles["5m"]
                for cut in (3, 7, 20, 41, 60, len(bars5) - 1):
                    if cut >= len(bars5):
                        continue
                    shown = bars5[:cut + 1]  # the candles the page has: the closed ones and the one forming
                    now = shown[-1]["time"] + 90  # mid-way through the forming candle
                    levels = rule.levels_of(rule.move_of(shown))
                    for signal in ("held", "crossed", "both"):
                        jobs.append({"mode": "live", "bars": shown, "levels": levels, "now": now, "seconds": 300, "signal": signal, "what": f"{d['date']} {name} live at {cut} {signal}"})
                        jobs.append({"mode": "live-today", "bars": shown, "now": now, "seconds": 300, "signal": signal, "what": f"{d['date']} {name} live today at {cut} {signal}"})
                    if prev:
                        jobs.append({"mode": "live", "bars": shown, "levels": rule.levels_of(rule.move_of_day(prev)), "now": now, "seconds": 300, "signal": "both", "what": f"{d['date']} {name} live prev at {cut}"})
    # 3. the hand-made day of lab/check.js (previous day 100 -> 200 closing 190)
    t0 = 1791343500  # a 09:15 IST, as lab/check.js builds it from the clock; any day serves
    ohlc = [[170, 172, 168, 170], [170, 171, 160, 165], [166, 170, 164, 168], [168, 177, 167, 175], [174, 176, 165, 166], [166, 167, 158, 160], [160, 163, 159, 162], [162, 165, 161, 164]]
    hand = [{"time": t0 + i * 300, "open": o, "high": h, "low": l, "close": c} for i, (o, h, l, c) in enumerate(ohlc)]
    prev_day = {"open": 100, "high": 200, "low": 100, "close": 190}
    for signal in ("held", "crossed", "both"):
        jobs.append({"mode": "replay", "bars": hand, "move": "prev", "previous": prev_day, "seconds": 300, "signal": signal, "what": f"hand-made {signal}"})
        jobs.append({"mode": "replay", "bars": hand, "move": "today", "previous": None, "seconds": 300, "signal": signal, "what": f"hand-made today {signal}"})
    # 4. random days: the walk, every setting, replayed and live
    rnd = random.Random(7)
    for k in range(int(os.environ.get("CHECK_RULE_RANDOM", "150"))):
        bars = random_day(rnd, t0, 75, 22600 + rnd.uniform(-300, 300))
        prev = {"open": 22500, "high": 22500 + rnd.uniform(50, 400), "low": 22500 - rnd.uniform(50, 400), "close": 22500 + rnd.uniform(-150, 150)}
        for move in ("prev", "today"):
            for signal in ("held", "crossed", "both"):
                jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": 300, "signal": signal, "ideas": IDEAS[k % len(IDEAS)], "what": f"random {k} {move} {signal}"})
                jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": 300, "signal": signal, "trail": TRAILS[k % len(TRAILS)], "what": f"random {k} {move} {signal} trail"})
        cut = rnd.randrange(2, len(bars))
        shown = bars[:cut + 1]
        jobs.append({"mode": "live", "bars": shown, "levels": rule.levels_of(rule.move_of(shown)), "now": shown[-1]["time"] + rnd.randrange(1, 300), "seconds": 300, "signal": "both", "what": f"random {k} live"})
        jobs.append({"mode": "live-today", "bars": shown, "now": shown[-1]["time"] + rnd.randrange(1, 300), "seconds": 300, "signal": "both", "what": f"random {k} live today"})
    js, py = js_run(jobs), py_run(jobs)
    bad = 0
    for j, a, b in zip(jobs, js, py):
        if not same(a, b):
            bad += 1
            if bad <= 5:
                print("DIFFERS:", j["what"])
                print("  page   :", json.dumps(a)[:400])
                print("  server :", json.dumps(b)[:400])
    calls = sum(len(a["trades"]) for a in js)
    print(f"check_rule: {len(jobs)} runs over {len(days)} saved days, the hand-made day and random days, {calls} calls: {'ALL THE SAME' if not bad else str(bad) + ' DIFFER'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
