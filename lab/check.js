// The checks of the shared rule engine (static/rules.js) that need no browser: the owner's rule on a hand-made day with
// the calls worked out by hand, the candle facts, and the ideas under test. A research round runs this before it
// proposes anything:   node lab/check.js
// The candle facts in rules.js against hand-worked answers
require(require("path").join(__dirname, "..", "static", "rules.js"));
const R = globalThis.Rules, assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const IST = 19800, t0 = Math.floor((Date.now() / 1000 + IST) / 86400) * 86400 - IST + 9 * 3600 + 15 * 60;

// ---- the owner's rule on the hand-made day of the index page's own checks (previous day 100 -> 200, closing 190):
// held gives the 09:20 CE (161.8, entry 166, target 176.4, reached) and the 09:30 PE (176.4, entry 174, target 161.8, reached);
// crossed gives the 09:40 PE (161.8, entry 160, target 150; held as a break, sold when 09:45 closes back above 161.8, at 162) and the
// 09:45 CE (161.8, entry 162, target 176.4, held to the day end at 164)
{
  const ohlc = [[170,172,168,170],[170,171,160,165],[166,170,164,168],[168,177,167,175],[174,176,165,166],[166,167,158,160],[160,163,159,162],[162,165,161,164]];
  const bars = ohlc.map(([open, high, low, close], i) => ({ time: t0 + i * 300, open, high, low, close }));
  const prevDay = { open: 100, high: 200, low: 100, close: 190 };
  const got = (signal) => R.replayDay({ bars, move: "prev", previous: prevDay, seconds: 300, signal }).trades.map(x => [x.side, x.level, x.entry, x.target, x.exit, x.points, x.how].join("|"));
  assert(got("held").join(" / ") === "CE|161.8|166|176.4|176.4|10.4|target / PE|176.4|174|161.8|161.8|12.2|target", "held: " + got("held").join(" / "));
  assert(got("crossed").join(" / ") === "PE|161.8|160|150|162|-2|back / CE|161.8|162|176.4|164|2|day end", "crossed: " + got("crossed").join(" / "));
  // the entry already past the target (owner's decision, 7 October): a candle holds 161.8 and closes above 176.4, the next
  // opens at 180: the call aims at 200, the level beyond the entry; opening beyond the last level (200) there is no call at all
  const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
  const levels = R.levelsOf({ low: 100, high: 200, up: true });
  const beyondDay = (openNext) => R.paperTrades({ bars: [bar(0, 170, 171, 169, 170), bar(1, 170, 178, 161.8, 177.5), bar(2, openNext, openNext + 1, openNext - 1, openNext),
    bar(3, openNext, openNext + 1, openNext - 1, openNext)], levelsAt: () => levels, now: Number.POSITIVE_INFINITY, seconds: 300, dayCandles: false, signal: "held" }).trades;
  const b1 = beyondDay(180);
  assert(b1.length === 1 && b1[0].side === "CE" && b1[0].level === 161.8 && b1[0].entry === 180 && b1[0].target === 200 && b1[0].aimed === "beyond", "aim one level on: " + JSON.stringify(b1));
  const b2 = beyondDay(201);
  assert(b2.length === 0, "no level left beyond the entry: no call: " + JSON.stringify(b2));
  const b3 = R.paperTrades({ bars: [bar(0, 170, 171, 169, 170), bar(1, 170, 172, 161.8, 170), bar(2, 171, 172, 170, 171), bar(3, 171, 172, 170, 171)],
    levelsAt: () => levels, now: Number.POSITIVE_INFINITY, seconds: 300, dayCandles: false, signal: "held" }).trades;
  assert(b3.length === 1 && b3[0].target === 176.4 && !b3[0].aimed, "an entry short of the target keeps it: " + JSON.stringify(b3));
  console.log("entry past the target: aims one level on, or no call");
  assert(got("both").length === 4 && R.round2(R.replayDay({ bars, move: "prev", previous: prevDay, seconds: 300, signal: "both" }).trades.reduce((s, x) => s + x.points, 0)) === 22.6, "both: four calls, net +22.60");
  console.log("hand-made day checks passed");
  // the candle verdict (7 October): a CE call at 161.8 toward 176.4 (gap 14.6) from a candle closing at 170 (56% of the way: strong);
  // then candles closing at 165 (carry), 158 (back 26%: exit) and 147 (back a whole gap); a touch at 163 that closes above is a retest held
  {
    const call = { side: "CE", level: 161.8, ratio: 0.618, kind: "crossed", target: 176.4, signalTime: t0 + 300, entry: 170.5, entryTime: t0 + 600, how: "open", exit: null };
    const day = [bar(0, 160, 161, 158, 160), bar(1, 166, 171, 161, 170), bar(2, 170.5, 172, 163, 165), bar(3, 165, 166, 157, 158), bar(4, 158, 159, 146, 147)];
    const rd = (n, extra) => R.readOf({ trade: { ...call, ...extra }, bars: day.slice(0, n), seconds: 300, now: Number.POSITIVE_INFINITY });
    const a = rd(2); assert(a.depth === 0.56 && a.body === 0.27 && a.strength === "strong" && a.word === "carry" && a.back === 0 && !a.retest && a.exitAt == null && a.why === "big candle through the 61.8% level, holding above it", "strong signal, carry: " + JSON.stringify(a));
    const b2 = rd(3); assert(b2.word === "carry" && b2.retest && b2.back === 0 && b2.why === "price came back to the 61.8% level and held", "a touch that closes above the level is a retest held: " + JSON.stringify(b2));
    const c = rd(4); assert(c.word === "exit" && c.back === 0.26 && c.exitAt === day[3].time && c.exitPrice === 158 && c.why === "price closed below the 61.8% level", "back a quarter: exit: " + JSON.stringify(c));
    const dd = rd(5); assert(dd.word === "exit" && dd.back === 1.01 && dd.exitAt === day[3].time && dd.exitPrice === 158, "the first candle back a quarter is the exit, whatever came after: " + JSON.stringify(dd));
    const weak = R.readOf({ trade: { ...call, signalTime: t0 + 300 }, bars: [bar(0, 160, 161, 158, 160), bar(1, 162, 164, 161, 163)], seconds: 300, now: Number.POSITIVE_INFINITY });
    assert(weak.depth === 0.08 && weak.strength === "weak" && weak.word === "carry" && weak.why === "small candle through the 61.8% level, holding above it", "a shallow signal still carries until a candle closes back: " + JSON.stringify(weak));
    const ended = R.readOf({ trade: { ...call, exit: 176.4, exitTime: t0 + 600, how: "target" }, bars: day, seconds: 300, now: Number.POSITIVE_INFINITY });
    assert(ended.back === 0 && ended.strength === "strong" && ended.exitAt == null && ended.word === "carry", "a finished call reads up to its exit only: " + JSON.stringify(ended));
    const endedLate = R.readOf({ trade: { ...call, exit: 147, exitTime: t0 + 4 * 300, how: "day end" }, bars: day, seconds: 300, now: Number.POSITIVE_INFINITY });
    assert(endedLate.word === "exit" && endedLate.exitAt === day[3].time, "a finished call keeps when the verdict said exit: " + JSON.stringify(endedLate));
    assert(R.readOf({ trade: { ...call, entry: null, how: "pending" }, bars: day.slice(0, 2), seconds: 300, now: Number.POSITIVE_INFINITY }).word === "carry", "a pending call reads from its signal");
    const notYet = R.readOf({ trade: call, bars: day, seconds: 300, now: day[3].time + 299 });  // the 158 candle has not closed yet
    assert(notYet.word === "carry" && notYet.back === 0 && notYet.exitAt == null, "only closed candles count: " + JSON.stringify(notYet));
    // a PE call from a hold at 78.6% (176.4 toward 161.8): a candle closing at 181 is back 32% above the level: exit, worded for that level
    const pe = R.readOf({ trade: { side: "PE", level: 176.4, ratio: 0.786, kind: "held", target: 161.8, signalTime: t0 + 300, entry: 174, entryTime: t0 + 600, how: "open", exit: null },
                          bars: [bar(0, 178, 179, 177, 178), bar(1, 177, 177.5, 176, 174.5), bar(2, 174, 182, 173, 181)], seconds: 300, now: Number.POSITIVE_INFINITY });
    assert(pe.word === "exit" && pe.exitPrice === 181 && pe.why === "price closed above the 78.6% level", "a PE call exits on a close back above its level: " + JSON.stringify(pe));
    const peHold = R.readOf({ trade: { side: "PE", level: 176.4, ratio: 0.786, kind: "held", target: 161.8, signalTime: t0 + 300, entry: 174, entryTime: t0 + 600, how: "open", exit: null },
                              bars: [bar(0, 178, 179, 177, 178), bar(1, 177, 177.5, 176, 174.5), bar(2, 173, 173.4, 172, 173)], seconds: 300, now: Number.POSITIVE_INFINITY });  // a high of 173.4 stays more than a fifth of the gap under 176.4: no retest
    assert(peHold.word === "carry" && peHold.why === "small bounce off the 78.6% level, holding below it", "a held signal is worded as a hold: " + JSON.stringify(peHold));
    console.log("candle verdict checks passed");
  }
}

const mk = (ohlc, shift = 0) => ohlc.map(([open, high, low, close], i) => ({ time: t0 + i * 300, open: open + shift, high: high + shift, low: low + shift, close: close + shift }));
const OHLC = [[170,172,168,170],[170,171,160,165],[166,170,164,168],[168,177,167,175],[174,176,165,166],[166,167,163,164]];
const prev = { open: 100, high: 200, low: 100, close: 190 };
// the day's shape
const f = R.dayFacts(mk(OHLC), prev);
assert(f.gap === -20 && f.change === -6 && f.range === 17 && f.highAt === t0 + 3 * 300 && f.lowAt === t0 + 300 && f.closeInRange === 24 && f.aboveHigh === null && f.belowLow === null && !f.up, "day facts: " + JSON.stringify(f));
assert(R.dayFacts(mk(OHLC), null).gap === null, "no previous day: no gap");
// breaks of a line: the first close beyond it, the move to the close, the furthest, and closing back inside
const b = R.breakOf(mk(OHLC), 172, "up");           // 09:30 closed 175 above 172; after it: highs 176, 167 -> further 1; close 164 -> -11 to the close; 09:35 closed 166 back inside
assert(b && b.time === t0 + 3 * 300 && b.close === 175 && b.toClose === -11 && b.further === 1 && b.backAt === t0 + 4 * 300, "break up: " + JSON.stringify(b));
const d = R.breakOf(mk(OHLC), 167, "down");         // 09:20 closed 165 below 167; after: lows 164, 167, 165, 163 -> further 2; close 164 -> +1; 09:25 closed 168 back above
assert(d && d.time === t0 + 300 && d.toClose === 1 && d.further === 2 && d.backAt === t0 + 2 * 300, "break down: " + JSON.stringify(d));
assert(R.breakOf(mk(OHLC), 180, "up") === null, "never broken");
// candle breaks: 09:20 below 168 (next 168 > 165: not on), 09:30 above 170 (next 166: not on), 09:35 below 167 (next 164 < 166: on), 09:40 below 165 (no next)
const c = R.candleBreaks(mk(OHLC));
assert(c.up === 1 && c.upWentOn === 0 && c.upJudged === 1 && c.down === 3 && c.downWentOn === 1 && c.downJudged === 2, "candle breaks: " + JSON.stringify(c));
// the candles at the previous day's levels (200, 176.4, 161.8, 150, 138.2, 121.4, 100)
const levels = R.levelsOf(R.moveOfDay(prev));
const lb = R.levelBehaviour(mk(OHLC), () => levels);
assert(lb[0.382].touched === 1 && lb[0.382].held === 1 && lb[0.382].heldJudged === 1 && lb[0.382].heldOn === 1 && lb[0.382].crossed === 0, "38.2%: " + JSON.stringify(lb[0.382]));
assert(lb[0.236].touched === 1 && lb[0.236].held === 1 && lb[0.236].heldOn === 0 && lb[0.236].heldJudged === 1, "23.6%: " + JSON.stringify(lb[0.236]));
const lb1 = R.levelBehaviour(mk(OHLC, 6), () => levels);   // the day 6 points higher: 176.4 touched by 09:20, 09:30, 09:35; held once (09:20, bounce down, 161.8 not reached), crossed twice (09:30 up, 09:35 down), neither went on
assert(lb1[0.236].touched === 3 && lb1[0.236].held === 1 && lb1[0.236].crossed === 2 && lb1[0.236].heldOn === 0 && lb1[0.236].crossedOn === 0 && lb1[0.236].crossedJudged === 2 && lb1[0.382].touched === 0, "day +6 at 23.6%: " + JSON.stringify(lb1[0.236]));
const lb2 = R.levelBehaviour(mk(OHLC, 12), () => levels);  // 12 higher: touched 09:20, 09:25, 09:40; held twice (bounces up, 200 never reached), crossed once (09:40 down)
assert(lb2[0.236].touched === 3 && lb2[0.236].held === 2 && lb2[0.236].crossed === 1 && lb2[0.236].heldOn === 0 && lb2[0.236].heldJudged === 2, "day +12 at 23.6%: " + JSON.stringify(lb2[0.236]));
// a hold at the 0% level has no next level outward: counted as held, not judged
const top = R.levelBehaviour([{ time: t0, open: 205, high: 205, low: 205, close: 205 }, { time: t0 + 300, open: 205, high: 206, low: 199, close: 203 }], () => levels);  // a bounce up off 200, the 0% level: nothing above it
assert(top[0].held === 1 && top[0].heldJudged === 0, "0% hold has no next level: " + JSON.stringify(top[0]));
console.log("rules unit checks passed");

// ---- the ideas under test: off unless asked, so the page's calls are untouched; P1 and P2 as defined in LOGIC.md
{
  const clock = (m) => m;  // minutes since midnight
  const day = (ohlcAt) => { const out = []; for (let m = 9 * 60 + 15; m < 15 * 60 + 30; m += 5) out.push({ time: t0 + out.length * 300, ...ohlcAt(m) }); return out; };
  // a flat day at 165 until 14:00, then at 142: a hold of 161.8 at 13:55 (closes 14:00: still allowed under P2) and a hold of 138.2 at 14:05
  // (closes 14:10: not allowed under P2); neither call reaches its target, so both run to the day's end, or to the clock under P1
  const flat = (m) => m < 14 * 60 + 5 ? { open: 165, high: 165.5, low: 164.5, close: 165 } : { open: 142, high: 143, low: 141, close: 142 };
  const bars = day(m => m === 13 * 60 + 55 ? { open: 163, high: 164, low: 161.5, close: 163 } : m === 14 * 60 + 5 ? { open: 142, high: 143, low: 138, close: 142 } : flat(m));
  const prev = { open: 100, high: 200, low: 100, close: 190 };
  const at = (x, k = "exitTime") => new Date(x[k] * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  const base = R.replayDay({ bars, move: "prev", previous: prev, seconds: 300, signal: "held" }).trades;
  assert(base.map(x => at(x, "signalTime")).join() === "13:55,14:05" && base.every(x => x.how === "day end" && x.exitTime === bars[bars.length - 1].time), "base: two calls, both to the day's end: " + JSON.stringify(base.map(x => [at(x, "signalTime"), x.how, x.points])));
  assert(JSON.stringify(R.replayDay({ bars, move: "prev", previous: prev, seconds: 300, signal: "held", ideas: {} }).trades) === JSON.stringify(base), "empty ideas: the same as none");
  const p2 = R.replayDay({ bars, move: "prev", previous: prev, seconds: 300, signal: "held", ideas: R.ideasOf(["P2"]) }).trades;
  assert(p2.length === 1 && p2[0].signalTime === base[0].signalTime && p2[0].how === "day end", "P2: the 13:55 signal (closing at 14:00) still calls, the 14:05 one does not: " + p2.length);
  const p1 = R.replayDay({ bars, move: "prev", previous: prev, seconds: 300, signal: "held", ideas: R.ideasOf(["P1"]) }).trades;
  assert(p1.length === 2 && p1.every(x => x.how === "time" && at(x) === "14:55" && x.exit === 142), "P1: both calls end at the close of the 14:55 candle (it closes at 15:00): " + JSON.stringify(p1.map(x => [x.how, at(x), x.exit])));
  // a signal at 15:05 (a hold of 121.4) gives a call without P1, none under it
  const late = bars.map(b => (b.time + 19800) % 86400 === 15 * 3600 + 5 * 60 ? { ...b, open: 122, high: 123, low: 121, close: 122 } : b);
  assert(R.replayDay({ bars: late, move: "prev", previous: prev, seconds: 300, signal: "held" }).trades.length === 3, "without P1 the 15:05 signal calls");
  assert(R.replayDay({ bars: late, move: "prev", previous: prev, seconds: 300, signal: "held", ideas: R.ideasOf(["P1"]) }).trades.length === 2, "under P1 no call opens after 15:00");
  const both = R.replayDay({ bars: late, move: "prev", previous: prev, seconds: 300, signal: "held", ideas: R.ideasOf(["P1", "P2"]) }).trades;
  assert(both.length === 1 && both[0].how === "time", "P1 + P2 together: one call, ended by the clock");
  // on day candles the clock ideas do nothing
  const days = [[100, 200, 100, 190], [170, 172, 160, 165], [166, 180, 164, 178], [178, 185, 170, 172]].map(([open, high, low, close], i) => ({ time: t0 - 3 * 86400 + i * 86400, open, high, low, close }));
  const d0 = R.paperTrades({ bars: days, levelsAt: () => R.levelsOf(R.moveOfDay(prev)), now: Infinity, seconds: 86400, dayCandles: true, signal: "both" }).trades;
  const d1 = R.paperTrades({ bars: days, levelsAt: () => R.levelsOf(R.moveOfDay(prev)), now: Infinity, seconds: 86400, dayCandles: true, signal: "both", ideas: R.ideasOf(["P1", "P2"]) }).trades;
  assert(JSON.stringify(d0) === JSON.stringify(d1) && d0.length > 0, "day candles: the ideas change nothing");
  // P3 (7 October): a crossed signal counts only when its candle closed at least a quarter of the way to the next level.
  // Previous day 100 -> 200: levels 100, 123.6, 138.2, 150, 161.8, 176.4, 200. A candle closing at 160 through 161.8 toward 150 is
  // 15% of the way (shallow: no call under P3, the level stays free); one closing at 158 is 32% (a call); a held signal is untouched
  {
    const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
    const day = (close) => [bar(0, 170, 171, 169, 170), bar(1, 165, 166, 159, close), bar(2, close, close + 1, close - 1, close), bar(3, close, close + 1, close - 1, close)];
    const lv = R.levelsOf(R.moveOfDay(prev));
    const under = (bars, ideas) => R.paperTrades({ bars, levelsAt: () => lv, now: Infinity, seconds: 300, dayCandles: false, signal: "crossed", ideas }).trades;
    assert(under(day(160)).length === 1 && under(day(160), R.ideasOf(["P3"])).length === 0, "P3: a cross 15% of the way gives no call");
    assert(under(day(158), R.ideasOf(["P3"])).length === 1 && under(day(158), R.ideasOf(["P3"]))[0].level === 161.8, "P3: a cross 32% of the way calls");
    // the shallow cross leaves the level free: a later hold of 161.8 from below still calls under P3
    const retake = [bar(0, 170, 171, 169, 170), bar(1, 165, 166, 159, 160), bar(2, 160, 162, 159, 161), bar(3, 161, 162, 160, 161), bar(4, 161, 162, 160, 161)];
    const both = R.paperTrades({ bars: retake, levelsAt: () => lv, now: Infinity, seconds: 300, dayCandles: false, signal: "both", ideas: R.ideasOf(["P3"]) }).trades;
    assert(both.length === 1 && both[0].kind === "held" && both[0].side === "PE" && both[0].signalTime === retake[2].time, "P3: the level stays free for a later hold: " + JSON.stringify(both.map(x => [x.kind, x.side, x.level])));
    const heldOnly = R.paperTrades({ bars: retake, levelsAt: () => lv, now: Infinity, seconds: 300, dayCandles: false, signal: "held", ideas: R.ideasOf(["P3"]) }).trades;
    assert(JSON.stringify(heldOnly) === JSON.stringify(R.paperTrades({ bars: retake, levelsAt: () => lv, now: Infinity, seconds: 300, dayCandles: false, signal: "held" }).trades), "P3 touches no held signal");
    console.log("P3 unit checks passed");
  }
  // P4 (7 October, the owner's rule): a closed candle that goes back across the call's level by a quarter of the gap ends the call at its
  // close. The verdict's day above: the CE call from the candle closing at 170 ends at 158 (back 26%) under P4, at the day end at 147 without
  {
    const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
    const lv = R.levelsOf(R.moveOfDay(prev));
    const day = [bar(0, 160, 161, 158, 160), bar(1, 166, 171, 161, 170), bar(2, 170.5, 172, 163, 165), bar(3, 165, 166, 157, 158), bar(4, 158, 159, 146, 147)];
    const under = (ideas, now = Infinity) => R.paperTrades({ bars: day, levelsAt: () => lv, now, seconds: 300, dayCandles: false, signal: "crossed", ideas }).trades;
    const plain = under(), p4 = under(R.ideasOf(["P4"]));
    assert(plain[0].side === "CE" && plain[0].how === "day end" && plain[0].exit === 147 && plain[0].points === -23.5, "without P4 the call runs to the day end: " + JSON.stringify(plain[0]));
    assert(p4[0].how === "candle" && p4[0].exit === 158 && p4[0].exitTime === day[3].time && p4[0].points === -12.5, "P4: the call ends at the close of the candle back a quarter: " + JSON.stringify(p4[0]));
    assert(p4.length === plain.length && p4[1].how === plain[1].how && p4[1].points === plain[1].points, "P4 touches no other call: " + JSON.stringify([p4, plain]));
    const verdict = R.readOf({ trade: plain[0], bars: day, seconds: 300, now: Infinity });
    assert(verdict.exitAt === p4[0].exitTime && verdict.exitPrice === p4[0].exit, "the verdict on the index page and P4 name the same candle");
    const forming = under(R.ideasOf(["P4"]), day[3].time + 200);  // the 158 candle is still forming: no exit yet
    assert(forming[0].how === "open" && forming[0].exit == null, "P4 waits for the candle to close: " + JSON.stringify(forming[0]));
    console.log("P4 unit checks passed");
  }
  // P5 (7 October evening): the candle that reaches the target closes a quarter into the next gap: the call carries on to the level
  // beyond, again and again; a shallow close ends it at the target as ever. Previous day 100 -> 200: levels 100, 123.6, 138.2, 150,
  // 161.8, 176.4, 200. A CE call from a hold at 150 (target 161.8, ladder 176.4, 200)
  {
    const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
    const lv = R.levelsOf(R.moveOfDay(prev));
    const run = (bars, ideas, now = Infinity) => R.paperTrades({ bars, levelsAt: () => lv, now, seconds: 300, dayCandles: false, signal: "held", ideas }).trades;
    const head = [bar(0, 155, 156, 154, 155), bar(1, 154, 155, 149, 152)];  // a hold of 150 from above: CE, target 161.8, entry at the next open
    // a. the reaching candle closes 165.5: a quarter of the next gap (14.6) past 161.8 is 165.45: carry on; then 176.4 is reached and the close is shallow: end there
    const a = run([...head, bar(2, 152, 153, 151, 152), bar(3, 152, 163, 151, 165.5), bar(4, 165.5, 177, 165, 170)], R.ideasOf(["P5"]));
    assert(a.length === 1 && a[0].ladder.length === 1 && a[0].carried === 1 && a[0].target === 176.4 && a[0].how === "target" && a[0].exit === 176.4 && a[0].points === 24.4, "P5: carried once, ended at the level beyond: " + JSON.stringify(a[0]));
    const plain = run([...head, bar(2, 152, 153, 151, 152), bar(3, 152, 163, 151, 165.5), bar(4, 165.5, 177, 165, 170)]);
    assert(plain[0].target === 161.8 && plain[0].exit === 161.8 && plain[0].points === 9.8 && plain[0].ladder.length === 2 && !plain[0].carried, "without P5 the call ends at its target: " + JSON.stringify(plain[0]));
    // b. the reaching candle closes 164 (shallow, under 165.45): ends at the target
    const b = run([...head, bar(2, 152, 153, 151, 152), bar(3, 152, 163, 151, 164)], R.ideasOf(["P5"]));
    assert(b[0].how === "target" && b[0].exit === 161.8 && !b[0].carried, "P5: a shallow close ends at the target: " + JSON.stringify(b[0]));
    // c. one candle through two levels, closing a quarter into the gap beyond the second (176.4 -> 200: 182.3): carried twice, then the day ends
    const c = run([...head, bar(2, 152, 153, 151, 152), bar(3, 152, 185, 151, 183), bar(4, 183, 184, 180, 181)], R.ideasOf(["P5"]));
    assert(c[0].carried === 2 && c[0].target === 200 && c[0].how === "day end" && c[0].exit === 181 && c[0].points === 29, "P5: carried twice by one candle, then the day end: " + JSON.stringify(c[0]));
    // d. the candle forming now reaches the target: the call waits for the close, open at the live price; without P5 it ends at once
    const live = [...head, bar(2, 152, 153, 151, 152), bar(3, 152, 163, 151, 160)];
    const d = run(live, R.ideasOf(["P5"]), live[3].time + 100), d0 = run(live, undefined, live[3].time + 100);
    assert(d[0].how === "open" && d[0].last === 160 && d0[0].how === "target" && d0[0].exit === 161.8, "P5 waits for the forming candle to close: " + JSON.stringify([d[0].how, d0[0].how]));
    // e. the carry read on the plain call: deep when the hit candle closed a quarter into the next gap; reached when 176.4 came later
    const cr = R.carryOf({ trade: plain[0], bars: [...head, bar(2, 152, 153, 151, 152), bar(3, 152, 163, 151, 165.5), bar(4, 165.5, 177, 165, 170)], seconds: 300, now: Infinity });
    assert(cr.deep && cr.beyond === 176.4 && cr.reached && cr.reachedAt === t0 + 4 * 300, "carry read: deep and reached: " + JSON.stringify(cr));
    const cr2 = R.carryOf({ trade: b[0], bars: [...head, bar(2, 152, 153, 151, 152), bar(3, 152, 163, 151, 164)], seconds: 300, now: Infinity });
    assert(!cr2.deep && !cr2.reached && cr2.reachedAt == null, "carry read: shallow and not reached: " + JSON.stringify(cr2));
    assert(R.carryOf({ trade: { ...plain[0], how: "day end" }, bars: live, seconds: 300, now: Infinity }) === null, "no carry read before the target");
    console.log("P5 unit checks passed");
  }
  console.log("ideas unit checks passed");
}

// ---- the owner's exit rule "Hold Through a Level Break" (8 October night), on the previous day's levels 100 to 200 (lines 100,
// 121.4, 138.2, 150, 161.8, 176.4, 200). C1 (09:20) opens 166, above 161.8, and closes 160 below it: Buy PE, target 150, in at
// 09:25's open 159
{
  const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
  const lv = R.levelsOf(R.moveOfDay({ open: 100, high: 200, low: 100, close: 190 }));
  const run = (bars, hold = true, now = Infinity) => R.paperTrades({ bars, levelsAt: () => lv, now, seconds: 300, dayCandles: false, signal: "crossed", holdBreaks: hold }).trades;
  const head = [bar(0, 170, 171, 168, 170), bar(1, 166, 167, 158, 160)];
  // a. the ride: 09:25 opens 159 below C1's close and falls to 150, the target, but is held; 09:30 crosses 150 (no new PE: the same
  // trade continues); 09:35 opens 141 above 09:30's close 140; nothing closes back above 161.8: sold at the day end, 159 - 139 = +20
  const ride = [...head, bar(2, 159, 161, 150, 151), bar(3, 150, 152, 139, 140), bar(4, 141, 149, 140, 145), bar(5, 144, 146, 138, 139)];
  const a = run(ride);
  assert(a.length === 1 && a[0].hold && a[0].c1Open === 166 && a[0].entry === 159 && a[0].how === "day end" && a[0].exit === 139 && a[0].points === 20, "held through the target to the day end: " + JSON.stringify(a));
  const a0 = run(ride, false);
  assert(a0.length === 2 && a0[0].how === "target" && a0[0].points === 9, "without the rule: sold at the target 150, and 09:30 gives a second PE: " + JSON.stringify(a0));
  // b. exit B: 09:25 opens 159, below C1's close 160, and comes back up to 166, C1's open: sold there, 159 - 166 = -7
  const b = run([...head, bar(2, 159, 166.5, 157, 161), bar(3, 161, 162, 160, 161)]);
  assert(b.length === 1 && b[0].how === "retouch" && b[0].exit === 166 && b[0].exitTime === t0 + 600 && b[0].points === -7, "exit B, back to C1's open: " + JSON.stringify(b));
  const bLive = run([...head, bar(2, 159, 166.5, 157, 161)], true, t0 + 600 + 100);  // tick by tick, on the candle forming now
  assert(bLive.length === 1 && bLive[0].how === "retouch" && bLive[0].exit === 166, "exit B on the forming candle: " + JSON.stringify(bLive));
  // the same move up to 166, but 09:25 opened 160.5, above C1's close: no exit B, and the close 161 is below 161.8: held
  const bNot = run([...head, bar(2, 160.5, 166.5, 157, 161), bar(3, 161, 161.5, 160, 161)], true, t0 + 900 + 100);
  assert(bNot.length === 1 && bNot[0].how === "open", "no exit B without the lower open: " + JSON.stringify(bNot));
  // c. exit A: 09:25 closes 162.5, back above 161.8: sold at that close, 159 - 162.5 = -3.5; it waits for the close on the forming candle
  const c = run([...head, bar(2, 159, 163, 158, 162.5), bar(3, 162.5, 163, 162, 162.5)]);
  assert(c.length === 2 && c[0].how === "back" && c[0].exit === 162.5 && c[0].points === -3.5 && c[1].side === "CE" && c[1].kind === "crossed",
         "exit A, closed back above the line (and that close crosses 161.8 upward: a Buy CE): " + JSON.stringify(c));
  const cLive = run([...head, bar(2, 159, 163, 158, 162.5)], true, t0 + 600 + 100);
  assert(cLive.length === 1 && cLive[0].how === "open" && cLive[0].last === 162.5, "exit A waits for the close: " + JSON.stringify(cLive));
  // the words of the candle status
  const said = (t, now = Infinity) => { const r = R.readOf({ trade: t, bars: ride, seconds: 300, now }); return r.word + ": " + r.why; };
  assert(said(c[0]) === "exit: price closed back above the 38.2% level" && said(b[0]) === "exit: price came back to where the fall started" && said(cLive[0]) === "carry: price stays below the 38.2% level",
         "the candle status of a held break: " + [said(c[0]), said(b[0]), said(cLive[0])].join(" | "));
  // d. the mirror, a CE (every price p as 300 - p): C1 opens 134, closes 140 above 138.2; 09:25 opens 141 above it and comes down to 134
  const flip = (b) => ({ time: b.time, open: 300 - b.open, high: 300 - b.low, low: 300 - b.high, close: 300 - b.close });
  const lvUp = R.levelsOf(R.moveOfDay({ open: 200, high: 200, low: 100, close: 110 }));
  const d = R.paperTrades({ bars: [...head, bar(2, 159, 166.5, 157, 161), bar(3, 161, 162, 160, 161)].map(flip), levelsAt: () => lvUp, now: Infinity, seconds: 300, dayCandles: false, signal: "crossed", holdBreaks: true }).trades;
  assert(d.length === 1 && d[0].side === "CE" && d[0].level === 138.2 && d[0].entry === 141 && d[0].how === "retouch" && d[0].exit === 134 && d[0].points === -7, "the CE mirror: " + JSON.stringify(d));
  console.log("hold through a level break checks passed");
}
