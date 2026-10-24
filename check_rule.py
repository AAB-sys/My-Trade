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
const { minutes: table, jobs } = JSON.parse(require("fs").readFileSync(0, "utf8"));  // the days' one-minute candles once, by key: in every job they made the input too long for node
const gateOf = (j) => j.gate === undefined ? undefined : j.gate === null ? null : { ...R.GATE, ...j.gate };  // the Call Gate (22 October night) as the job sets it
const lcOf = (j) => j.lc === undefined ? undefined : j.lc === null ? null : { ...R.LC, ...j.lc };  // the Loss Cutter (24 October) as the job sets it
const plOf = (j) => j.pl === undefined ? undefined : j.pl === null ? null : { ...R.LOCK, ...j.pl };  // the Profit Lock (24 October) as the job sets it
const out = jobs.map(j => {
  const levels = j.levels;  // the live page: the levels as they stand now, for every candle
  j.minutes = j.minutes ? table[j.minutes] : null;
  const res = j.mode === "replay" ? R.replayDay({ bars: j.bars, move: j.move, previous: j.previous, seconds: j.seconds, signal: j.signal, ideas: j.ideas || undefined,
                                                 trail: "trail" in j ? j.trail : undefined, newHighLow: !!j.newHighLow, minutes: j.minutes || null,
                                                 gate: gateOf(j), atrSeed: j.atrSeed ?? null, lossCutter: lcOf(j), profitLock: plOf(j) })  // Rule 2; the Call Gate as the job sets it: as the page runs it, or another setting, or null (Rule 1 alone)
    : j.mode === "live-close" ? R.paperTrades({ bars: j.bars, levelsAt: R.closeLevelsAt(j.bars, j.close), now: j.now, seconds: j.seconds, dayCandles: false, signal: j.signal, holdBreaks: true,
                                                trail: R.TRAIL, given: j.given || undefined, prevClose: j.close, minutes: j.minutes || null , gate: gateOf(j), atrSeed: j.atrSeed ?? null, lossCutter: lcOf(j), profitLock: plOf(j) })  // the previous close's lines, redrawn (15 October)
    : j.mode === "live-today" ? R.paperTrades({ bars: j.bars, levelsAt: R.todayLevelsAt(j.bars), targetsAt: R.todayLinesAt(j.bars), now: j.now, seconds: j.seconds,
                                                dayCandles: false, signal: j.signal, holdBreaks: true, trail: R.TRAIL, given: j.given || undefined,
                                                newHighLow: !!j.newHighLow, minutes: j.minutes || null , gate: gateOf(j), atrSeed: j.atrSeed ?? null, lossCutter: lcOf(j), profitLock: plOf(j) })  // the index page and the watcher today
    : R.paperTrades({ bars: j.bars, levelsAt: () => levels, now: j.now, seconds: j.seconds, dayCandles: false, signal: j.signal, ideas: j.ideas || undefined, holdBreaks: true, trail: R.TRAIL, given: j.given || undefined, newHighLow: !!j.newHighLow, minutes: j.minutes || null , gate: gateOf(j), atrSeed: j.atrSeed ?? null, lossCutter: lcOf(j), profitLock: plOf(j) });
  res.trades.forEach(t => { t.read = R.readOf({ trade: t, bars: j.bars, seconds: j.seconds, now: j.mode === "replay" ? Infinity : j.now });  // the candle verdict too
    t.carry = R.carryOf({ trade: t, bars: j.bars, seconds: j.seconds, now: j.mode === "replay" ? Infinity : j.now }); });  // and the carry read
  return res;
});
process.stdout.write(JSON.stringify(out));
"""


def js_run(jobs: list) -> list:
    proc = subprocess.run(["node", "--max-old-space-size=4096", "-e", JS, str(HERE / "static" / "rules.js")], input=json.dumps({"minutes": MINUTES, "jobs": jobs}).encode(), capture_output=True)
    if proc.returncode != 0:
        sys.exit("node failed: " + proc.stderr.decode()[-2000:])
    return json.loads(proc.stdout)


def given_of(j: dict):
    """The calls given live, as the watcher passes them: {signal time: side} (JSON's keys are text)."""
    return {int(k): v for k, v in j["given"].items()} if j.get("given") else None


MINUTES: dict = {}  # the saved days' one-minute candles by key (the owner's early exit, 19 October); a job names its key


def py_run(jobs: list) -> list:
    out = []
    for j in jobs:
        j = {**j, "minutes": MINUTES.get(j["minutes"]) if j.get("minutes") else None}
        gate = rule.GATE if "gate" not in j else (None if j["gate"] is None else {**rule.GATE, **j["gate"]})  # the Call Gate (22 October night) as the job sets it
        lc = rule.LC if "lc" not in j else (None if j["lc"] is None else {**rule.LC, **j["lc"]})  # the Loss Cutter (24 October) as the job sets it
        pl = rule.LOCK if "pl" not in j else (None if j["pl"] is None else {**rule.LOCK, **j["pl"]})  # the Profit Lock (24 October) as the job sets it
        seed = j.get("atrSeed")
        if j["mode"] == "replay":
            res = rule.replay_day(j["bars"], j["move"], j["previous"], j["seconds"], j["signal"], j.get("ideas"), j["trail"] if "trail" in j else rule.TRAIL, bool(j.get("newHighLow")), j.get("minutes"), gate, seed, loss_cutter=lc, profit_lock=pl)
        elif j["mode"] == "live-close":
            res = rule.paper_trades(j["bars"], rule.close_levels_at(j["bars"], j["close"]), j["now"], j["seconds"], False, j["signal"], None, None, True, rule.TRAIL, given_of(j), False, j["close"], j.get("minutes"), gate, seed, loss_cutter=lc, profit_lock=pl)
        elif j["mode"] == "live-today":
            res = rule.paper_trades(j["bars"], rule.today_levels_at(j["bars"]), j["now"], j["seconds"], False, j["signal"], None, rule.today_lines_at(j["bars"]), True, rule.TRAIL, given_of(j), bool(j.get("newHighLow")), None, j.get("minutes"), gate, seed, loss_cutter=lc, profit_lock=pl)
        else:
            levels = j["levels"]
            res = rule.paper_trades(j["bars"], lambda i, L=levels: L, j["now"], j["seconds"], False, j["signal"], j.get("ideas"), None, True, rule.TRAIL, given_of(j), bool(j.get("newHighLow")), None, j.get("minutes"), gate, seed, loss_cutter=lc, profit_lock=pl)
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
    kept = random.Random(11)  # the calls given live of the jobs below
    extra = random.Random(13)  # the previous close's lines (15 October), apart from the stream the other random days are drawn from
    # 1. the saved days, replayed in every setting
    days = saved_days(folder) if folder.exists() else []
    for d in days:
        for name, idx in d["indices"].items():
            candles = idx["candles"] if "candles" in idx else idx
            prev = idx.get("previous") or d.get("previous", {}).get(name)
            for key, seconds in (("5m", 300), ("15m", 900), ("30m", 1800)):
                bars = candles.get(key) or fold(candles["5m"], seconds)
                for move in ("prev", "close", "today"):  # close: the previous close's lines (15 October)
                    if move in ("prev", "close") and not prev:
                        continue
                    mins = f"{d['date']} {name}" if candles.get("1m") else None  # the day's one-minute candles, by key: the owner's early exit (19 October) runs on them
                    if mins:
                        MINUTES[mins] = candles["1m"]
                    for signal in ("held", "crossed", "both"):
                        for ideas in IDEAS:
                            jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": seconds, "signal": signal, "ideas": ideas, "minutes": mins, "what": f"{d['date']} {name} {key} {move} {signal}"})
                        jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": seconds, "signal": signal, "what": f"{d['date']} {name} {key} {move} {signal} no minutes"})
                        for k, trail in enumerate(TRAILS):
                            jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": seconds, "signal": signal, "trail": trail, "minutes": mins,
                                         "what": f"{d['date']} {name} {key} {move} {signal} trail {k}"})
                        jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": seconds, "signal": signal, "newHighLow": True,
                                     "what": f"{d['date']} {name} {key} {move} {signal} idea 24"})
                        jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": seconds, "signal": signal, "newHighLow": True, "ideas": {"minDepth": 0.25, "exitBack": 0.25, "carryOn": 0.25},
                                     "what": f"{d['date']} {name} {key} {move} {signal} idea 24 with P3 to P5"})
                        jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": seconds, "signal": signal, "newHighLow": True, "what": f"{d['date']} {name} {key} {move} {signal} idea 24"})
                        V1 = {"parallel": "skip", "opening": "skip", "lateAfter": 14 * 3600 + 45 * 60, "zoneHeightAtr": 2.0}  # the Call Gate: version 2 (23 October) in shadow and live, version 1 as settings, live one check at a time, no gate
                        for gate, seed, tag in (({"mode": "LIVE"}, None, "gate live"), ({"mode": "SHADOW"}, 41.5, "gate seeded"), ({"mode": "LIVE"}, 41.5, "gate live seeded"), (None, None, "no gate"),
                                                ({**V1, "mode": "SHADOW"}, 41.5, "gate v1 shadow"), ({**V1, "mode": "LIVE"}, 41.5, "gate v1 live"),
                                                ({"mode": "LIVE", "liveChecks": ["chase", "parallel"]}, 41.5, "gate live chase and parallel"), ({"mode": "LIVE", "liveChecks": ["opening"]}, None, "gate live opening"),
                                                ({"parallel": "allow", "opening": "allow"}, 41.5, "gate allow parallel and opening"),
                                                ({"parallel": "health"}, 41.5, "gate health shadow"), ({"parallel": "health", "mode": "LIVE"}, None, "gate health live")):
                            jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": seconds, "signal": signal, "minutes": mins, "gate": gate, "atrSeed": seed, "what": f"{d['date']} {name} {key} {move} {signal} {tag}"})
                        LCV2 = {"zoneHeightAtr": 1.5, "chaseWindow": False, "stackCap": None, "wornMode": "off", "advice": False}  # the Loss Cutter (24 October): shadow and live, strict, the stack cap logged, version 2 as settings, every check live, none
                        for lc, seed, tag in (({"mode": "LIVE"}, 41.5, "lc live"), ({"zoneMode": "breakout", "wornMode": "skip"}, 41.5, "lc strict"), ({"stackMode": "log"}, None, "lc stack log"),
                                              (LCV2, 41.5, "lc v2"), ({"mode": "LIVE", "liveChecks": ["opening", "chase", "chasewindow", "zone", "worn", "stack"], "wornMode": "skip", "stackCap": 2}, 41.5, "lc all live"),
                                              ({"zoneHeightAtr": 3.0, "wornFailures": 1, "chaseWindowAtr": 2.0}, None, "lc wide"), (None, 41.5, "no lc")):
                            jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": seconds, "signal": signal, "minutes": mins, "lc": lc, "atrSeed": seed, "what": f"{d['date']} {name} {key} {move} {signal} {tag}"})
                        RUNNER = {**rule.LOCK_PRESETS["RUNNER"], "name": "RUNNER", "compare": ["MAX", "STEADY"]}  # the Profit Lock (24 October): live, another setting live, slippage and a floor, off, none, and live beside the Call Gate and the Loss Cutter live
                        for pl, extra_job, tag in (({"mode": "LIVE"}, {}, "lock live"), ({**RUNNER, "mode": "LIVE"}, {"atrSeed": 41.5}, "lock live runner"),
                                                   ({"slipPts": 2.0, "floorPts": 5, "armPts": 10, "compare": []}, {}, "lock slip and floor"), (rule.LOCK_PRESETS["OFF"], {}, "lock off"), (None, {}, "no lock"),
                                                   ({"mode": "LIVE"}, {"gate": {"mode": "LIVE"}, "lc": {"mode": "LIVE", "stackCap": 2}, "atrSeed": 41.5}, "lock live with the gate and the lc live")):
                            jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": seconds, "signal": signal, "minutes": mins, "pl": pl, **extra_job, "what": f"{d['date']} {name} {key} {move} {signal} {tag}"})
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
                    mins = f"{d['date']} {name}" if candles.get("1m") else None
                    if mins:
                        MINUTES[mins] = candles["1m"]
                    for signal in ("held", "crossed", "both"):
                        jobs.append({"mode": "live", "bars": shown, "levels": levels, "now": now, "seconds": 300, "signal": signal, "minutes": mins, "what": f"{d['date']} {name} live at {cut} {signal}"})
                        jobs.append({"mode": "live-today", "bars": shown, "now": now, "seconds": 300, "signal": signal, "minutes": mins, "what": f"{d['date']} {name} live today at {cut} {signal}"})
                        if prev:
                            jobs.append({"mode": "live-close", "bars": shown, "close": prev["close"], "now": now, "seconds": 300, "signal": signal, "minutes": mins, "what": f"{d['date']} {name} live close at {cut} {signal}"})
                            jobs.append({"mode": "live-close", "bars": shown, "close": prev["close"], "now": now, "seconds": 300, "signal": signal, "minutes": mins, "gate": {"mode": "LIVE"}, "atrSeed": 38.0,
                                         "what": f"{d['date']} {name} live close at {cut} {signal} gate live"})  # the Call Gate live, with the previous day's ATR
                            jobs.append({"mode": "live-close", "bars": shown, "close": prev["close"], "now": now, "seconds": 300, "signal": signal, "minutes": mins, "lc": {"mode": "LIVE", "stackCap": 2}, "atrSeed": 38.0,
                                         "what": f"{d['date']} {name} live close at {cut} {signal} lc live"})  # the Loss Cutter live, the stack cap at 2
                            jobs.append({"mode": "live-close", "bars": shown, "close": prev["close"], "now": now, "seconds": 300, "signal": signal, "minutes": mins, "pl": {"mode": "LIVE"},
                                         "what": f"{d['date']} {name} live close at {cut} {signal} lock live"})  # the Profit Lock live, a candle forming
                        jobs.append({"mode": "live-today", "bars": shown, "now": now, "seconds": 300, "signal": signal, "newHighLow": True, "what": f"{d['date']} {name} live today at {cut} {signal} idea 24"})
                        jobs.append({"mode": "live-today", "bars": shown, "now": now, "seconds": 300, "signal": signal, "newHighLow": True, "what": f"{d['date']} {name} live today at {cut} {signal} idea 24"})
                    # calls given live (9 October): some candles' calls kept on a side the final prices may not give
                    given = {str(b["time"]): kept.choice(["CE", "PE"]) for b in kept.sample(shown[1:-1], min(4, len(shown) - 2))} if len(shown) > 2 else {}
                    jobs.append({"mode": "live-today", "bars": shown, "now": now, "seconds": 300, "signal": "both", "given": given, "what": f"{d['date']} {name} live today at {cut} given {given}"})
                    jobs.append({"mode": "live-today", "bars": shown, "now": now, "seconds": 300, "signal": "both", "given": given, "newHighLow": True,
                                 "what": f"{d['date']} {name} live today at {cut} given {given} idea 24"})
                    jobs.append({"mode": "live", "bars": shown, "levels": levels, "now": now, "seconds": 300, "signal": "crossed", "given": given, "what": f"{d['date']} {name} live at {cut} given {given}"})
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
        jobs.append({"mode": "replay", "bars": hand, "move": "today", "previous": None, "seconds": 300, "signal": signal, "newHighLow": True, "what": f"hand-made today {signal} idea 24"})
        jobs.append({"mode": "replay", "bars": hand, "move": "close", "previous": prev_day, "seconds": 300, "signal": signal, "what": f"hand-made close {signal}"})  # the previous close's lines: the first candle judged from that close
    # 4. random days: the walk, every setting, replayed and live
    rnd = random.Random(7)
    for k in range(int(os.environ.get("CHECK_RULE_RANDOM", "150"))):
        bars = random_day(rnd, t0, 75, 22600 + rnd.uniform(-300, 300))
        prev = {"open": 22500, "high": 22500 + rnd.uniform(50, 400), "low": 22500 - rnd.uniform(50, 400), "close": 22500 + rnd.uniform(-150, 150)}
        for move in ("prev", "close", "today"):
            for signal in ("held", "crossed", "both"):
                jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": 300, "signal": signal, "ideas": IDEAS[k % len(IDEAS)], "what": f"random {k} {move} {signal}"})
                jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": 300, "signal": signal, "trail": TRAILS[k % len(TRAILS)], "what": f"random {k} {move} {signal} trail"})
        cut = rnd.randrange(2, len(bars))
        shown = bars[:cut + 1]
        jobs.append({"mode": "live", "bars": shown, "levels": rule.levels_of(rule.move_of(shown)), "now": shown[-1]["time"] + rnd.randrange(1, 300), "seconds": 300, "signal": "both", "what": f"random {k} live"})
        close = round(shown[0]["open"] * (1 + extra.uniform(-0.015, 0.015)), 2)  # the previous close's lines near the day's prices, redrawn when it runs past +-1.5% (15 October); its own random stream, so the other random days stay as they were
        jobs.append({"mode": "live-close", "bars": shown, "close": close, "now": shown[-1]["time"] + extra.randrange(1, 300), "seconds": 300, "signal": ("held", "crossed", "both")[k % 3], "what": f"random {k} live close"})
        jobs.append({"mode": "live-today", "bars": shown, "now": shown[-1]["time"] + rnd.randrange(1, 300), "seconds": 300, "signal": "both", "what": f"random {k} live today"})
        jobs.append({"mode": "live-close", "bars": shown, "close": close, "now": shown[-1]["time"] + extra.randrange(1, 300), "seconds": 300, "signal": "both", "gate": {"mode": ("LIVE", "SHADOW")[k % 2]},
                     "atrSeed": (None, 6.0)[(k // 2) % 2], "what": f"random {k} live close gate"})  # the Call Gate on a random day, live and shadow, seeded and not
        jobs.append({"mode": "live-close", "bars": shown, "close": close, "now": shown[-1]["time"] + extra.randrange(1, 300), "seconds": 300, "signal": "both",
                     "lc": ({"mode": "LIVE", "stackCap": 1}, {"zoneMode": "breakout", "wornMode": "skip", "wornFailures": 1}, {"stackMode": "log", "stackCap": 1}, {"zoneHeightAtr": 4.0, "zoneErMax": 0.6})[k % 4],
                     "atrSeed": (None, 6.0)[(k // 2) % 2], "what": f"random {k} live close lc"})  # the Loss Cutter on a random day, in four settings
        jobs.append({"mode": "live-close", "bars": shown, "close": close, "now": shown[-1]["time"] + 150, "seconds": 300, "signal": "both",
                     "pl": ({"mode": "LIVE"}, {"armPts": 5, "minTrailPts": 2}, {"mode": "LIVE", "armPts": 6, "keep": 0.9, "minTrailPts": 1, "slipPts": 0.5}, {"floorPts": 3, "armPts": 4})[k % 4],
                     "what": f"random {k} live close lock"})  # the Profit Lock on a random day (small moves: small settings), live and shadow
        for move in ("prev", "close", "today"):
            jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": 300, "signal": "both", "pl": {"mode": ("LIVE", "SHADOW")[k % 2], "armPts": 6, "minTrailPts": 3},
                         "ideas": IDEAS[k % len(IDEAS)], "what": f"random {k} {move} lock"})
        given = {str(b["time"]): kept.choice(["CE", "PE"]) for b in kept.sample(shown[1:-1], min(5, len(shown) - 2))} if len(shown) > 2 else {}
        jobs.append({"mode": "live-today", "bars": shown, "now": shown[-1]["time"] + 299, "seconds": 300, "signal": "both", "given": given, "what": f"random {k} live today given"})
        jobs.append({"mode": "live-today", "bars": shown, "now": shown[-1]["time"] + 299, "seconds": 300, "signal": "both", "given": given, "newHighLow": True,
                     "what": f"random {k} live today given idea 24"})
        jobs.append({"mode": "live-today", "bars": shown, "now": shown[-1]["time"] + 299, "seconds": 300, "signal": "both", "given": given, "newHighLow": True, "what": f"random {k} live today given idea 24"})
        for move in ("prev", "close", "today"):
            jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": 300, "signal": ("held", "crossed", "both")[k % 3], "newHighLow": True,
                         "ideas": IDEAS[k % len(IDEAS)], "what": f"random {k} {move} idea 24"})
            jobs.append({"mode": "replay", "bars": bars, "move": move, "previous": prev, "seconds": 300, "signal": ("both", "crossed", "held")[k % 3], "newHighLow": True,
                         "ideas": IDEAS[(k + 3) % len(IDEAS)], "trail": TRAILS[k % len(TRAILS)], "what": f"random {k} {move} idea 24 with ideas and trail"})
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
