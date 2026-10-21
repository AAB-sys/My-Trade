// The checks of the shared rule engine (static/rules.js) that need no browser: the owner's rule on a hand-made day with
// the calls worked out by hand, the candle facts, and the ideas under test. A research round runs this before it
// proposes anything:   node lab/check.js
// The candle facts in rules.js against hand-worked answers
require(require("path").join(__dirname, "..", "static", "rules.js"));
const R = globalThis.Rules, assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const IST = 19800, t0 = Math.floor((Date.now() / 1000 + IST) / 86400) * 86400 - IST + 9 * 3600 + 15 * 60;

// ---- the owner's rule on the hand-made day of the index page's own checks (previous day 100 -> 200, closing 190; its lines 200,
// 176.4, 161.8, 150, 138.2, 121.4, 100). Since 18 October a candle's own wick through a line counts as a cross (the owner: "this should
// also be considered as closed above"), On the line is an exact touch only, the first candle is judged from the previous close, and a
// call fires when a later candle's price goes past the signal candle's high (CE) or low (PE), entering there. So the day comes in two
// versions. The touch day (09:20 low exactly 161.8, 09:30 high exactly 176.4): held gives the 09:20 CE (161.8, fires when 09:30 goes
// above 09:20's high 171: entry 171, target 176.4, reached by the same candle, +5.4) and the 09:30 PE (176.4, fires when 09:35 goes
// below 09:30's low 167: entry 167, target 161.8, reached at 09:40, +5.2); crossed gives the 09:15 PE (170 closed below 176.4, the
// previous close being 190: fires when 09:20 goes below 09:15's low 168, entry 168, held as a break; 09:40 closes below 161.8, so
// Rule 2 runs from then on with the stop on 161.8, the line crossed (Change 4, 21 October; one line back, 176.4, until then); 09:45
// closes 162, back above it: sold there, +6), no 09:40 PE row (Crossed below 161.8, armed
// at 09:40's low 158, and cancelled when 09:45 closes back above 161.8 before any candle goes below 158) and the 09:45 CE (Crossed above
// 161.8, fires when 09:50 goes above 09:45's high 163: entry 163, target 176.4, held to the day end at 164, +1); both gives those
// three calls that fire (the 09:30 PE is blocked: 176.4 already gave a PE at 09:15 and no close went back above it), net +12.40.
// The wick day (09:20 low 160, 09:30 high 177, as the day was before 18 October): held gives nothing; crossed gives the 09:15 PE as
// above (+6), the 09:20 CE (Crossed above 161.8 by the wick, fires at 09:30 above 171: entry 171, held as a break, sold when 09:40
// closes back below 161.8, at 160: -11), no 09:30 PE (176.4 already gave the 09:15 PE), no 09:40 PE row (cancelled as above) and the
// 09:45 CE as on the touch day (+1)
{
  const prevDay = { open: 100, high: 200, low: 100, close: 190 };
  const mk = (ohlc) => ohlc.map(([open, high, low, close], i) => ({ time: t0 + i * 300, open, high, low, close }));
  const bars = mk([[170,172,168,170],[170,171,161.8,165],[166,170,164,168],[168,176.4,167,175],[174,176,165,166],[166,167,158,160],[160,163,159,162],[162,165,161,164]]);
  const wick = mk([[170,172,168,170],[170,171,160,165],[166,170,164,168],[168,177,167,175],[174,176,165,166],[166,167,158,160],[160,163,159,162],[162,165,161,164]]);
  const gotOn = (bars, signal) => R.replayDay({ bars, move: "prev", previous: prevDay, seconds: 300, signal }).trades.map(x => [x.side, x.level, x.entry, x.target, x.exit, x.points, x.how].join("|"));
  const got = (signal) => gotOn(bars, signal);
  assert(got("held").join(" / ") === "CE|161.8|171|176.4|176.4|5.4|target / PE|176.4|167|161.8|161.8|5.2|target", "held: " + got("held").join(" / "));
  assert(got("crossed").join(" / ") === "PE|176.4|168|161.8|162|6|trail / CE|161.8|163|176.4|164|1|day end", "crossed: " + got("crossed").join(" / "));
  const when = (signal) => R.replayDay({ bars, move: "prev", previous: prevDay, seconds: 300, signal }).trades.map(x => [(x.signalTime - t0) / 300, (x.entryTime - t0) / 300, !!x.parallel].join("|"));
  assert(when("crossed").join(" / ") === "0|1|false / 6|7|false" && when("held").join(" / ") === "1|3|false / 3|4|false", "signal candle, entry candle: " + when("crossed").join(" / ") + " ; " + when("held").join(" / "));
  assert(gotOn(wick, "held").length === 0, "the wick day holds nothing: " + gotOn(wick, "held").join(" / "));
  assert(gotOn(wick, "crossed").join(" / ") === "PE|176.4|168|161.8|162|6|trail / CE|161.8|171|176.4|160|-11|back / CE|161.8|163|176.4|164|1|day end", "the wick day crossed: " + gotOn(wick, "crossed").join(" / "));
  assert(gotOn(wick, "both").join(" / ") === gotOn(wick, "crossed").join(" / "), "the wick day: both is crossed");
  console.log("the wick counts as a cross (18 October): checked on the hand-made day");
  // the entry already past the target (owner's decision, 7 October): a candle holds 161.8 and closes above 176.4, the next
  // opens at 180, past the signal candle's high 178, so the call fires at that open: it aims at 200, the level beyond the entry;
  // opening beyond the last level (200) there is no call at all
  const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
  const levels = R.levelsOf({ low: 100, high: 200, up: true });
  const beyondDay = (openNext) => R.paperTrades({ bars: [bar(0, 170, 171, 169, 170), bar(1, 170, 178, 161.8, 177.5), bar(2, openNext, openNext + 1, openNext - 1, openNext),
    bar(3, openNext, openNext + 1, openNext - 1, openNext)], levelsAt: () => levels, now: Number.POSITIVE_INFINITY, seconds: 300, dayCandles: false, signal: "held" }).trades;
  const b1 = beyondDay(180);
  assert(b1.length === 1 && b1[0].side === "CE" && b1[0].level === 161.8 && b1[0].entry === 180 && b1[0].target === 200 && b1[0].aimed === "beyond", "aim one level on: " + JSON.stringify(b1));
  const b2 = beyondDay(201);
  assert(b2.length === 0, "no level left beyond the entry: no call: " + JSON.stringify(b2));
  const b3 = R.paperTrades({ bars: [bar(0, 170, 171, 169, 170), bar(1, 170, 172, 161.8, 170), bar(2, 171, 173, 170, 171), bar(3, 171, 172, 170, 171)],
    levelsAt: () => levels, now: Number.POSITIVE_INFINITY, seconds: 300, dayCandles: false, signal: "held" }).trades;  // 09:25 goes above 172, the signal candle's high: in at 172
  assert(b3.length === 1 && b3[0].entry === 172 && b3[0].target === 176.4 && !b3[0].aimed, "an entry short of the target keeps it: " + JSON.stringify(b3));
  const b4 = R.paperTrades({ bars: [bar(0, 170, 171, 169, 170), bar(1, 170, 172, 161.8, 170), bar(2, 171, 172, 170, 171), bar(3, 171, 172, 170, 171)],
    levelsAt: () => levels, now: Number.POSITIVE_INFINITY, seconds: 300, dayCandles: false, signal: "held" }).trades;  // no candle goes above 172: no call
  assert(b4.length === 0, "a signal no candle fires gives no call: " + JSON.stringify(b4));
  console.log("entry past the target: aims one level on, or no call");
  assert(got("both").length === 3 && R.round2(R.replayDay({ bars, move: "prev", previous: prevDay, seconds: 300, signal: "both" }).trades.reduce((s, x) => s + x.points, 0)) === 12.4, "both: three calls, net +12.40: " + got("both").join(" / "));
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
  const flat = (m) => m < 14 * 60 + 5 ? { open: 165, high: 165.5, low: 164.5, close: 165 } : { open: 142, high: 143.5, low: 141, close: 142 };  // 143.5: above the 14:05 candle's high, so its call fires at 14:10
  const bars = day(m => m === 13 * 60 + 55 ? { open: 163, high: 164, low: 161.8, close: 163 } : m === 14 * 60 + 5 ? { open: 142, high: 143, low: 138.2, close: 142 } : flat(m));  // exact touches: a hold since 18 October
  const prev = { open: 100, high: 200, low: 100, close: 190 };
  const at = (x, k = "exitTime") => new Date(x[k] * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  const base = R.replayDay({ bars, move: "prev", previous: prev, seconds: 300, signal: "held" }).trades;
  assert(base.map(x => at(x, "signalTime")).join() === "13:55,14:05" && base.map(x => at(x, "entryTime")).join() === "14:00,14:10" && base.map(x => x.entry).join() === "165,143"
         && base.every(x => x.how === "day end" && x.exitTime === bars[bars.length - 1].time), "base: two calls, in at 165 and 143, both to the day's end: " + JSON.stringify(base.map(x => [at(x, "signalTime"), at(x, "entryTime"), x.entry, x.how, x.points])));
  assert(JSON.stringify(R.replayDay({ bars, move: "prev", previous: prev, seconds: 300, signal: "held", ideas: {} }).trades) === JSON.stringify(base), "empty ideas: the same as none");
  const p2 = R.replayDay({ bars, move: "prev", previous: prev, seconds: 300, signal: "held", ideas: R.ideasOf(["P2"]) }).trades;
  assert(p2.length === 1 && p2[0].signalTime === base[0].signalTime && p2[0].how === "day end", "P2: the 13:55 signal (closing at 14:00) still calls, the 14:05 one does not: " + p2.length);
  const p1 = R.replayDay({ bars, move: "prev", previous: prev, seconds: 300, signal: "held", ideas: R.ideasOf(["P1"]) }).trades;
  assert(p1.length === 2 && p1.every(x => x.how === "time" && at(x) === "14:55" && x.exit === 142), "P1: both calls end at the close of the 14:55 candle (it closes at 15:00): " + JSON.stringify(p1.map(x => [x.how, at(x), x.exit])));
  // a signal at 15:05 (a hold of 121.4) gives a call without P1, none under it
  const late = bars.map(b => (b.time + 19800) % 86400 === 15 * 3600 + 5 * 60 ? { ...b, open: 122, high: 123, low: 121.4, close: 122 } : b);
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
    const day = (close) => [bar(0, 170, 171, 169, 170), bar(1, 165, 166, 159, close), bar(2, close, close + 1, close - 1.5, close), bar(3, close, close + 1, close - 1, close)];  // 09:25 goes below 159: the call fires
    const lv = R.levelsOf(R.moveOfDay(prev));
    const under = (bars, ideas) => R.paperTrades({ bars, levelsAt: () => lv, now: Infinity, seconds: 300, dayCandles: false, signal: "crossed", ideas }).trades;
    assert(under(day(160)).length === 1 && under(day(160), R.ideasOf(["P3"])).length === 0, "P3: a cross 15% of the way gives no call");
    assert(under(day(158), R.ideasOf(["P3"])).length === 1 && under(day(158), R.ideasOf(["P3"]))[0].level === 161.8, "P3: a cross 32% of the way calls");
    // the shallow cross leaves the level free: a later hold of 161.8 from below still calls under P3
    const retake = [bar(0, 170, 171, 169, 170), bar(1, 165, 166, 159, 160), bar(2, 160, 161.8, 159, 161), bar(3, 161, 162, 160, 161), bar(4, 161, 162, 158.5, 161)];  // 09:25 touches 161.8 exactly: a hold (18 October); 09:35 goes below its low 159: the call fires
    const both = R.paperTrades({ bars: retake, levelsAt: () => lv, now: Infinity, seconds: 300, dayCandles: false, signal: "both", ideas: R.ideasOf(["P3"]) }).trades;
    assert(both.length === 1 && both[0].kind === "held" && both[0].side === "PE" && both[0].signalTime === retake[2].time, "P3: the level stays free for a later hold: " + JSON.stringify(both.map(x => [x.kind, x.side, x.level])));
    const heldOnly = R.paperTrades({ bars: retake, levelsAt: () => lv, now: Infinity, seconds: 300, dayCandles: false, signal: "held", ideas: R.ideasOf(["P3"]) }).trades;
    assert(JSON.stringify(heldOnly) === JSON.stringify(R.paperTrades({ bars: retake, levelsAt: () => lv, now: Infinity, seconds: 300, dayCandles: false, signal: "held" }).trades), "P3 touches no held signal");
    console.log("P3 unit checks passed");
  }
  // P4 (7 October, the owner's rule): a closed candle that goes back across the call's level by a quarter of the gap ends the call at its
  // close. The verdict's day above: the CE call from the candle closing at 170 (in at 171 when 09:25 goes above that candle's high)
  // ends at 158 (back 26%) under P4, at the day end at 147 without
  {
    const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
    const lv = R.levelsOf(R.moveOfDay(prev));
    const day = [bar(0, 160, 161, 158, 160), bar(1, 166, 171, 161, 170), bar(2, 170.5, 172, 163, 165), bar(3, 165, 166, 157, 158), bar(4, 158, 159, 146, 147)];
    const under = (ideas, now = Infinity) => R.paperTrades({ bars: day, levelsAt: () => lv, now, seconds: 300, dayCandles: false, signal: "crossed", ideas }).trades;
    const plain = under(), p4 = under(R.ideasOf(["P4"]));
    assert(plain[0].side === "CE" && plain[0].entry === 171 && plain[0].entryTime === day[2].time && plain[0].how === "day end" && plain[0].exit === 147 && plain[0].points === -24, "without P4 the call runs to the day end: " + JSON.stringify(plain[0]));
    assert(p4[0].how === "candle" && p4[0].exit === 158 && p4[0].exitTime === day[3].time && p4[0].points === -13, "P4: the call ends at the close of the candle back a quarter: " + JSON.stringify(p4[0]));
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
    const head = [bar(0, 155, 156, 154, 155), bar(1, 154, 155, 150, 152)];  // a hold of 150 from above (an exact touch, 18 October): CE, target 161.8, in at 155 when 09:30 goes above the candle's high
    // a. the reaching candle closes 165.5: a quarter of the next gap (14.6) past 161.8 is 165.45: carry on; then 176.4 is reached and the close is shallow: end there
    const a = run([...head, bar(2, 152, 153, 151, 152), bar(3, 152, 163, 151, 165.5), bar(4, 165.5, 177, 165, 170)], R.ideasOf(["P5"]));
    assert(a.length === 1 && a[0].entry === 155 && a[0].ladder.length === 1 && a[0].carried === 1 && a[0].target === 176.4 && a[0].how === "target" && a[0].exit === 176.4 && a[0].points === 21.4, "P5: carried once, ended at the level beyond: " + JSON.stringify(a[0]));
    const plain = run([...head, bar(2, 152, 153, 151, 152), bar(3, 152, 163, 151, 165.5), bar(4, 165.5, 177, 165, 170)]);
    assert(plain[0].target === 161.8 && plain[0].exit === 161.8 && plain[0].points === 6.8 && plain[0].ladder.length === 2 && !plain[0].carried, "without P5 the call ends at its target: " + JSON.stringify(plain[0]));
    // b. the reaching candle closes 164 (shallow, under 165.45): ends at the target
    const b = run([...head, bar(2, 152, 153, 151, 152), bar(3, 152, 163, 151, 164)], R.ideasOf(["P5"]));
    assert(b[0].how === "target" && b[0].exit === 161.8 && !b[0].carried, "P5: a shallow close ends at the target: " + JSON.stringify(b[0]));
    // c. one candle through two levels, closing a quarter into the gap beyond the second (176.4 -> 200: 182.3): carried twice, then the day ends
    const c = run([...head, bar(2, 152, 153, 151, 152), bar(3, 152, 185, 151, 183), bar(4, 183, 184, 180, 181)], R.ideasOf(["P5"]));
    assert(c[0].carried === 2 && c[0].target === 200 && c[0].how === "day end" && c[0].exit === 181 && c[0].points === 26, "P5: carried twice by one candle, then the day end: " + JSON.stringify(c[0]));
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
// 121.4, 138.2, 150, 161.8, 176.4, 200). C1 (09:20) opens 166, above 161.8, and closes 160 below it: Buy PE, target 150, in at 158
// when 09:25 goes below C1's low (since 18 October; until then at 09:25's open 159)
{
  const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
  const lv = R.levelsOf(R.moveOfDay({ open: 100, high: 200, low: 100, close: 190 }));
  const run = (bars, hold = true, now = Infinity) => R.paperTrades({ bars, levelsAt: () => lv, now, seconds: 300, dayCandles: false, signal: "crossed", holdBreaks: hold }).trades;
  const head = [bar(0, 170, 171, 168, 170), bar(1, 166, 167, 158, 160)];
  // a. the ride: 09:25 opens 159 below C1's close and falls to 150, the target, but is held; 09:30 crosses 150: a second PE beside the
  // first (parallel, 18 October: "Can be bought parallelly"), fired at 09:40 below 09:30's low 139, held to the day end at 139 (0);
  // 09:35 opens 141 above 09:30's close 140; nothing closes back above 161.8: the first is sold at the day end, 158 - 139 = +19
  const ride = [...head, bar(2, 159, 161, 150, 151), bar(3, 150, 152, 139, 140), bar(4, 141, 149, 140, 145), bar(5, 144, 146, 138, 139)];
  const a = run(ride);
  assert(a.length === 2 && a[0].hold && a[0].c1Open === 166 && a[0].entry === 158 && a[0].entryTime === t0 + 600 && a[0].how === "day end" && a[0].exit === 139 && a[0].points === 19 && !a[0].parallel, "held through the target to the day end: " + JSON.stringify(a));
  assert(a[1].side === "PE" && a[1].level === 150 && a[1].parallel && a[1].entry === 139 && a[1].entryTime === t0 + 1500 && a[1].how === "day end" && a[1].points === 0, "the second PE runs beside the first, marked parallel: " + JSON.stringify(a[1]));
  const a0 = run(ride, false);
  assert(a0.length === 2 && a0[0].how === "target" && a0[0].points === 8 && !a0[1].parallel, "without the rule: sold at the target 150, and 09:30 gives a second PE: " + JSON.stringify(a0));
  // b. exit B: 09:25 opens 159, below C1's close 160, goes below 158 (the call fires there) and comes back up to 166, C1's open: sold there, 158 - 166 = -8
  const b = run([...head, bar(2, 159, 166.5, 157, 161), bar(3, 161, 162, 160, 161)]);
  assert(b.length === 1 && b[0].how === "retouch" && b[0].exit === 166 && b[0].exitTime === t0 + 600 && b[0].points === -8, "exit B, back to C1's open: " + JSON.stringify(b));
  const bLive = run([...head, bar(2, 159, 166.5, 157, 161)], true, t0 + 600 + 100);  // tick by tick, on the candle forming now
  assert(bLive.length === 1 && bLive[0].how === "retouch" && bLive[0].exit === 166, "exit B on the forming candle: " + JSON.stringify(bLive));
  // the same move up to 166, but 09:25 opened 160.5, above C1's close: no exit B, and the close 161 is below 161.8: held
  const bNot = run([...head, bar(2, 160.5, 166.5, 157, 161), bar(3, 161, 161.5, 160, 161)], true, t0 + 900 + 100);
  assert(bNot.length === 1 && bNot[0].how === "open", "no exit B without the lower open: " + JSON.stringify(bNot));
  // c. exit A: 09:25 goes below 158 (in at 158) and closes 162.5, back above 161.8: sold at that close, 158 - 162.5 = -4.5; it waits for
  // the close on the forming candle. That close crosses 161.8 upward: a Buy CE, fired when 09:30 goes above 163, 09:25's high
  const c = run([...head, bar(2, 159, 163, 157.5, 162.5), bar(3, 162.5, 163.5, 162, 162.5)]);
  assert(c.length === 2 && c[0].how === "back" && c[0].exit === 162.5 && c[0].points === -4.5 && c[1].side === "CE" && c[1].kind === "crossed" && c[1].entry === 163 && c[1].entryTime === t0 + 900,
         "exit A, closed back above the line (and that close crosses 161.8 upward: a Buy CE): " + JSON.stringify(c));
  const cLive = run([...head, bar(2, 159, 163, 157.5, 162.5)], true, t0 + 600 + 100);
  assert(cLive.length === 1 && cLive[0].how === "open" && cLive[0].last === 162.5, "exit A waits for the close: " + JSON.stringify(cLive));
  // the words of the candle status
  const said = (t, now = Infinity) => { const r = R.readOf({ trade: t, bars: ride, seconds: 300, now }); return r.word + ": " + r.why; };
  assert(said(c[0]) === "exit: price closed back above the 38.2% level" && said(b[0]) === "exit: price came back to where the fall started" && said(cLive[0]) === "carry: price stays below the 38.2% level",
         "the candle status of a held break: " + [said(c[0]), said(b[0]), said(cLive[0])].join(" | "));
  // d. the mirror, a CE (every price p as 300 - p): C1 opens 134, closes 140 above 138.2; 09:25 opens 141 above it, goes above 142 (in there) and comes down to 134
  const flip = (b) => ({ time: b.time, open: 300 - b.open, high: 300 - b.low, low: 300 - b.high, close: 300 - b.close });
  const lvUp = R.levelsOf(R.moveOfDay({ open: 200, high: 200, low: 100, close: 110 }));
  const d = R.paperTrades({ bars: [...head, bar(2, 159, 166.5, 157, 161), bar(3, 161, 162, 160, 161)].map(flip), levelsAt: () => lvUp, now: Infinity, seconds: 300, dayCandles: false, signal: "crossed", holdBreaks: true }).trades;
  assert(d.length === 1 && d[0].side === "CE" && d[0].level === 138.2 && d[0].entry === 142 && d[0].how === "retouch" && d[0].exit === 134 && d[0].points === -8, "the CE mirror: " + JSON.stringify(d));
  console.log("hold through a level break checks passed");
}

// ---- Rule 2 of the owner's "Trading Rules Specification" (9 October): the stop moved line by line. First the specification's own
// test cases (6.8) and worked example (6.4), on its lines 38.2% = 24380, 50.0% = 24450, 61.8% = 24520 and its initial stop 24300
{
  const L = [{ ratio: 0.382, price: 24380 }, { ratio: 0.5, price: 24450 }, { ratio: 0.618, price: 24520 }];
  const walk = (side, place, buf, closes, stop = side === "CE" ? 24300 : 24600) => {  // the stop after each close, or SELL
    const st = { stop, stopRatio: null, line: null, ratio: null };
    return closes.map(c => R.trailStep(st, c, L, side, place, buf) === "sell" ? "SELL" : st.stop).join(" ");
  };
  assert(walk("CE", "at", 0, [24395, 24460, 24440]) === "24380 24450 SELL", "T1: " + walk("CE", "at", 0, [24395, 24460, 24440]));
  assert(walk("CE", "at", 10, [24385]) === "24300", "T2: inside the buffer, not crossed");
  assert(walk("CE", "at", 10, [24395]) === "24380", "T3: 38.2% crossed by the buffer");
  assert(walk("CE", "at", 10, [24535]) === "24520", "T4: one candle past three lines jumps to the furthest");
  assert(walk("CE", "at", 10, [24445], 24450) === "SELL", "T5: a close below the stop sells");
  const t6 = { stop: 24380, stopRatio: 0.382, line: 24450, ratio: 0.5 };
  assert(R.trailStep(t6, 24445, L, "CE", "back", 10) === "hold" && t6.stop === 24380, "T6: one line back, 24445 is above the stop 24380: HOLD");
  assert(walk("CE", "back", 10, [24395]) === "24300", "T7: the first line crossed has no line behind it: the stop stays");
  assert(walk("CE", "back", 10, [24465], 24400) === "24400", "T8: the line behind (24380) is below the stop 24400: the stop stays");
  assert(walk("PE", "at", 10, [24515, 24505, 24525]) === "24600 24520 SELL", "T9: " + walk("PE", "at", 10, [24515, 24505, 24525]));
  // 6.4, CE with a buffer of 10: candles A to E, the stop at the line and one line back
  assert(walk("CE", "at", 10, [24385, 24395, 24455, 24465, 24445]) === "24300 24380 24380 24450 SELL", "6.4 at the line");
  assert(walk("CE", "back", 10, [24385, 24395, 24455, 24465, 24445]) === "24300 24300 24300 24380 24380", "6.4 one line back");
  // 5.4, the worked examples with no buffer, CE and PE
  assert(walk("CE", "at", 0, [24395, 24460, 24440]) === "24380 24450 SELL" && walk("PE", "at", 0, [24440, 24370, 24390], 24520) === "24450 24380 SELL", "5.4 worked examples");
  // T10: the ATR through the candle before: 14 candles with a true range of 20, then one with a range of 100: its buffer is still
  // 0.5 x 20 = 10. T11: 14 candles with a true range of 30 closing at 24400, then high 24420 low 24400: TR 20, ATR 410 / 14 = 29.29
  const flat = (n, half) => Array.from({ length: n }, (_, i) => ({ time: t0 + i * 300, open: 24400, high: 24400 + half, low: 24400 - half, close: 24400 }));
  const a10 = R.atrBefore([...flat(14, 10), { time: t0 + 14 * 300, open: 24400, high: 24480, low: 24380, close: 24470 }], 14);
  assert(a10[14] === 20 && a10.slice(0, 14).every(x => x == null), "T10: the ATR before the big candle is 20, so its buffer is 10: " + a10[14]);
  const a11 = R.atrBefore([...flat(14, 15), { time: t0 + 14 * 300, open: 24410, high: 24420, low: 24400, close: 24410 }, { time: t0 + 15 * 300, open: 24410, high: 24411, low: 24409, close: 24410 }], 14);
  assert(a11[14] === 30 && R.round2(a11[15]) === 29.29, "T11: the new ATR is 29.29: " + a11[15]);
  console.log("Rule 2 specification test cases T1 to T11 passed");
}

// ---- Rule 2 inside the held break (the owner's two rules together, specification section 8), on the previous day's lines 100 to
// 200 (100, 121.4, 138.2, 150, 161.8, 176.4, 200): C1 (09:20) opens 166 above 161.8 and closes 160 below it: Buy PE, in at 158 when
// 09:25 goes below C1's low. The closes past 150 give a second PE beside it (parallel) where a later candle goes below their low;
// the checks below look at the first call
{
  const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
  const lv = R.levelsOf(R.moveOfDay({ open: 100, high: 200, low: 100, close: 190 }));
  const AT = { lines: "all", buffer: "none", place: "at" };  // the stop on the line crossed (PR #115, and the page again since 21 October, Change 4: R.TRAIL, checked at j)
  const BACK = { lines: "all", buffer: "none", place: "back" };  // one line back, the page's setting from 9 to 21 October
  const run = (bars, trail = AT, now = Infinity) => R.paperTrades({ bars, levelsAt: () => lv, now, seconds: 300, dayCandles: false, signal: "crossed", holdBreaks: true, trail }).trades;
  const head = [bar(0, 170, 171, 168, 170), bar(1, 166, 167, 158, 160), bar(2, 159, 161, 150, 151)];  // 09:25 reaches 150 but closes above it: still Rule 1
  // a. 09:30 closes 140, past 150: the stop moves to 150 (Rule 2 from now on); 09:35 closes 151, back above it: sold at 151, +7.
  // Rule 1 alone holds on (151 is under 161.8) to the day end at 145. That close crosses 150 upward too: a Buy CE either way, fired
  // when 09:40 goes above 152, 09:35's high (the 09:30 PE past 150 is armed at its low 139 and cancelled by 09:35's close above 150)
  const a = [...head, bar(3, 150, 152, 139, 140), bar(4, 141, 152, 140, 151), bar(5, 151, 152.5, 144, 145)];
  const ra = run(a), r1 = run(a, null);
  assert(ra.length === 2 && ra[1].side === "CE" && ra[1].entry === 152 && ra[0].how === "trail" && ra[0].exit === 151 && ra[0].exitTime === t0 + 4 * 300 && ra[0].points === 7 && ra[0].trail.stop === 150 && ra[0].trail.stopRatio === 0.5,
         "sold on the close back above the moved stop: " + JSON.stringify(ra));
  assert(r1.length === 2 && r1[1].side === "CE" && r1[0].how === "day end" && r1[0].exit === 145 && r1[0].trail === undefined, "Rule 1 alone: held to the day end: " + JSON.stringify(r1));
  // b. Rule 2 has taken over, so exit B no longer sells: 09:35 opens 139 below 09:30's close 140 and reaches 166 (C1's open) but closes
  // 149, under the stop 150: held. Rule 1 alone sells it at 166 (-7). On the forming candle too: no sale at the touch
  const b = [...head, bar(3, 150, 152, 139, 140), bar(4, 139, 166.5, 138.5, 149), bar(5, 149, 150, 144, 145)];
  const rb = run(b), rb1 = run(b, null), rbLive = run(b.slice(0, 5), AT, t0 + 4 * 300 + 100);
  assert(rb[0].how === "day end" && rb[0].points === 13 && rb1[0].how === "retouch" && rb1[0].exit === 166 && rb1[0].points === -8, "exit B ends with Rule 2: " + JSON.stringify([rb[0], rb1[0]]));
  assert(rb.length === 2 && rb[1].parallel && rb[1].level === 150 && rb[1].c1Open === 150 && rb[1].entry === 139 && rb[1].entryTime === t0 + 4 * 300 && rb[1].how === "retouch" && rb[1].exit === 150 && rb[1].points === -11,
         "the PE past 150 fires at 09:35 below 139, beside the first, and its own exit B sells it at 150, its C1's open, the same candle: " + JSON.stringify(rb[1]));
  assert(rbLive[0].how === "open" && rbLive[0].last === 149, "no sale at the touch on the forming candle once Rule 2 runs: " + JSON.stringify(rbLive[0]));
  // c. one candle past two lines (09:30 closes 137, past 150 and 138.2): the stop jumps to 138.2; one line back it goes to 150
  const c = [...head, bar(3, 150, 151, 136, 137), bar(4, 137, 139, 135, 138), bar(5, 138, 145, 137, 144)];
  const rc = run(c), rcBack = run(c, { lines: "middle", buffer: "none", place: "back" });
  assert(rc[0].how === "trail" && rc[0].exit === 144 && rc[0].trail.stop === 138.2 && rc[0].trail.line === 138.2, "jumps to the furthest line: " + JSON.stringify(rc[0]));
  assert(rcBack[0].how === "day end" && rcBack[0].trail.stop === 150 && rcBack[0].trail.line === 138.2, "one line back: the stop on 150: " + JSON.stringify(rcBack[0]));
  // d. one line back from the first line crossed: the line behind 150 is 161.8, the line the call broke, so the stop stays there
  const rd = run([...head, bar(3, 150, 152, 139, 140), bar(4, 141, 158, 140, 157)], { lines: "middle", buffer: "none", place: "back" });
  assert(rd[0].how === "day end" && rd[0].trail.stop === 161.8 && rd[0].trail.stopRatio === 0.382, "one line back from the first line: the stop stays on the broken line: " + JSON.stringify(rd[0]));
  // e. on all seven lines (the owner's choice) a close below 100, the 100% line, moves the stop there; on the specification's lines
  // (23.6% to 78.6%) it does not
  const e = [...head, bar(3, 150, 152, 139, 140), bar(4, 140, 141, 120, 121), bar(5, 121, 122, 98, 99), bar(6, 99, 102, 98, 101)];
  const re = run(e, { lines: "middle", buffer: "none", place: "at" }), reAll = run(e);
  assert(reAll[0].how === "trail" && reAll[0].trail.stop === 100 && reAll[0].trail.stopRatio === 1 && reAll[0].exit === 101, "on all seven lines the 100% line moves the stop: " + JSON.stringify(reAll[0]));
  assert(re[0].how === "day end" && re[0].trail.stop === 121.4 && re[0].points === 57, "on lines 23.6% to 78.6% it does not: " + JSON.stringify(re[0]));
  // f. a buffer: 09:30 closes 145, 5 under 150: with a buffer of 10 it is not crossed (still Rule 1); 09:35 closes 139, 11 under: crossed
  const f = [...head, bar(3, 150, 151, 144, 145), bar(4, 145, 146, 138.5, 139), bar(5, 139, 151, 138, 150.5)];
  const rf = run(f, { lines: "middle", buffer: "fixed", points: 10, place: "at" });
  assert(rf[0].how === "trail" && rf[0].exit === 150.5 && rf[0].trail.stop === 150, "a fixed buffer: " + JSON.stringify(rf[0]));
  const rf2 = run(f.slice(0, 5), { lines: "middle", buffer: "fixed", points: 10, place: "at" }, t0 + 4 * 300 + 299);
  assert(rf2[0].how === "open" && rf2[0].trail === undefined, "inside the buffer: no line crossed yet: " + JSON.stringify(rf2[0]));
  // g. the candle status words: held with the stop moved, and sold by it
  const said = (t) => { const r = R.readOf({ trade: t, bars: a, seconds: 300, now: Infinity }); return r.word + ": " + r.why; };
  const open = run(a.slice(0, 4), AT, t0 + 4 * 300 + 100)[0];
  assert(said(ra[0]) === "exit: price closed back above the 50.0% level" && said(open) === "carry: price stays below the 50.0% level", "the words: " + [said(ra[0]), said(open)].join(" | "));
  // h. the CE mirror (every price p as 300 - p)
  const flip = (x) => ({ time: x.time, open: 300 - x.open, high: 300 - x.low, low: 300 - x.high, close: 300 - x.close });
  const lvUp = R.levelsOf(R.moveOfDay({ open: 200, high: 200, low: 100, close: 110 }));
  const h = R.paperTrades({ bars: a.map(flip), levelsAt: () => lvUp, now: Infinity, seconds: 300, dayCandles: false, signal: "crossed", holdBreaks: true, trail: AT }).trades;
  assert(h[0].side === "CE" && h[0].how === "trail" && h[0].exit === 149 && h[0].points === 7 && h[0].trail.stop === 150, "the CE mirror: " + JSON.stringify(h[0]));
  // i. the replays run Rule 2 as the page does unless told not to; trail null is Rule 1 alone, exactly as before 9 October. The replay
  // judges the first candle from the previous close (18 October): 170, the candle's own close, so that it gives no signal here
  const rp = (trail) => R.replayDay({ bars: a, move: "prev", previous: { open: 100, high: 200, low: 100, close: 170 }, seconds: 300, signal: "crossed", trail }).trades;
  assert(JSON.stringify(rp(undefined)) === JSON.stringify(run(a, R.TRAIL)) && rp(AT)[0].how === "trail" && JSON.stringify(rp(null)) === JSON.stringify(r1), "replayDay: Rule 2 as the page runs it by default, Rule 1 alone with null");
  // j. one line back (the owner's choice of 9 October, "Stop one Fibonacci level back", the page's setting until 21 October): all 7
  // lines, no buffer. a: 09:30 closes 140, past 150: the line behind 150 is 161.8, the line the call broke, so the stop stays there;
  // 09:35 closes 151, under 161.8: held, to the day end at 145 (+13). c: 09:30 closes 137, past 150 and 138.2: the stop goes to 150,
  // one line back from 138.2; 09:35 closes 138, 09:40 closes 144, under 150: held to the day end, +14. A close back above 150 would
  // sell it. The page's setting since 21 October (Change 4, "point no 3": the stop on the line crossed itself) is AT, checked above
  assert(R.TRAIL.place === "at" && R.TRAIL.lines === "all" && R.TRAIL.buffer === "none", "the page's setting: " + JSON.stringify(R.TRAIL));
  assert(JSON.stringify(run(a, R.TRAIL)) === JSON.stringify(run(a, AT)) && JSON.stringify(run(c, R.TRAIL)) === JSON.stringify(run(c, AT)), "the page runs the stop on the line crossed");
  const ja = run(a, BACK), jc = run(c, BACK), jcSold = run([...c.slice(0, 5), bar(5, 144, 152, 143, 151)], BACK);
  assert(ja[0].how === "day end" && ja[0].exit === 145 && ja[0].points === 13 && ja[0].trail.stop === 161.8 && ja[0].trail.line === 150, "one line back from the first line: the stop stays on 161.8: " + JSON.stringify(ja[0]));
  assert(jc[0].how === "day end" && jc[0].points === 14 && jc[0].trail.stop === 150 && jc[0].trail.stopRatio === 0.5 && jc[0].trail.line === 138.2, "one line back from 138.2: the stop on 150: " + JSON.stringify(jc[0]));
  assert(jcSold[0].how === "trail" && jcSold[0].exit === 151 && jcSold[0].points === 7, "a close back above 150 sells: " + JSON.stringify(jcSold[0]));
  const jSaid = R.readOf({ trade: jc[0], bars: c, seconds: 300, now: Infinity });
  assert(jSaid.word === "carry" && jSaid.why === "price stays below the 50.0% level", "the words name the stop's line: " + JSON.stringify(jSaid));
  console.log("Rule 2 in the held break checks passed");
}

// ---- a close exactly on a line has not crossed it yet (9 October, NIFTY 50: the 13:35 candle closed at 22,509.35, the 78.6% line
// itself, then 13:40 closed above it): the cross is judged from the last close off the line. On the previous day's lines 100 to 200
// (100, 121.4, 138.2, 150, 161.8, 176.4, 200): 09:20 closes 149 below 150, 09:25 closes exactly 150, 09:30 closes 153: a Buy CE,
// crossed 150, in at 154 when 09:35 goes above 09:30's high. Coming from above instead (09:20 closes 151), the same 09:30 is no cross and no hold, as before
{
  const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
  const lv = R.levelsOf(R.moveOfDay({ open: 100, high: 200, low: 100, close: 190 }));
  const run = (bars, signal = "both") => R.paperTrades({ bars, levelsAt: () => lv, now: Infinity, seconds: 300, dayCandles: false, signal, holdBreaks: true, trail: R.TRAIL }).trades;
  const up = [bar(0, 148, 149, 147, 148), bar(1, 148, 149.5, 147.5, 149), bar(2, 149, 150.5, 148.5, 150), bar(3, 149.8, 154, 149.6, 153), bar(4, 153.5, 155, 153, 154), bar(5, 154, 155, 153, 154.5)];
  const a = run(up);
  assert(a.length === 1 && a[0].side === "CE" && a[0].kind === "crossed" && a[0].level === 150 && a[0].signalTime === up[3].time && a[0].entry === 154 && a[0].entryTime === up[4].time && a[0].c1Open === 149.8,
         "a break after a close exactly on the line: " + JSON.stringify(a));
  const fromAbove = [bar(0, 152, 153, 151, 152), bar(1, 152, 152.5, 150.5, 151), bar(2, 151, 151.5, 149.5, 150), bar(3, 150.2, 154, 150.1, 153), bar(4, 153.5, 155, 153, 154)];
  assert(run(fromAbove).length === 0, "from above, a close on the line then above it is no break: " + JSON.stringify(run(fromAbove)));
  const down = up.map(b => ({ time: b.time, open: 300 - b.open, high: 300 - b.low, low: 300 - b.high, close: 300 - b.close }));
  const lvDown = R.levelsOf(R.moveOfDay({ open: 200, high: 200, low: 100, close: 110 }));
  const d = R.paperTrades({ bars: down, levelsAt: () => lvDown, now: Infinity, seconds: 300, dayCandles: false, signal: "both", holdBreaks: true, trail: R.TRAIL }).trades;
  assert(d.length === 1 && d[0].side === "PE" && d[0].kind === "crossed" && d[0].level === 150 && d[0].signalTime === down[3].time, "the PE mirror: " + JSON.stringify(d));
  console.log("close exactly on a line checks passed");
}

// ---- a call given live stays given (9 October, NIFTY 50: at 13:40:05 the page gave the 13:35 Buy CE from the price at the candle's
// close, just above the 78.6% line, and recorded its option; Dhan's final 13:35 candle closed exactly on the line and the call
// vanished). On the previous day's lines 100 to 200: 09:20 closes 149, 09:25 closes exactly on 150 (live it was 150.20), 09:30 closes
// 153. Without the record, 09:30 gives the Buy CE (judged from 149); with the record of the 09:25 CE, that call stays: crossed 150,
// in at 150.5 when 09:30 goes above 09:25's high, and 09:30 gives no second CE (150 has given a CE and no close went back below it)
{
  const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
  const lv = R.levelsOf(R.moveOfDay({ open: 100, high: 200, low: 100, close: 190 }));
  const run = (bars, given, now = Infinity) => R.paperTrades({ bars, levelsAt: () => lv, now, seconds: 300, dayCandles: false, signal: "both", holdBreaks: true, trail: R.TRAIL, given }).trades;
  const day = [bar(0, 148, 149, 147, 148), bar(1, 148, 149.5, 147.5, 149), bar(2, 149, 150.5, 148.5, 150), bar(3, 149.8, 154, 149.6, 153), bar(4, 153.5, 155, 153, 154), bar(5, 154, 155, 153, 154.5)];
  const none = run(day), kept = run(day, { [day[2].time]: "CE" });
  assert(none.length === 1 && none[0].signalTime === day[3].time && !none[0].kept, "no record: the 09:30 CE: " + JSON.stringify(none));
  assert(kept.length === 1 && kept[0].kept && kept[0].signalTime === day[2].time && kept[0].side === "CE" && kept[0].kind === "crossed" && kept[0].level === 150
         && kept[0].entry === 150.5 && kept[0].entryTime === day[3].time && kept[0].hold && kept[0].c1Open === 149 && kept[0].target === 161.8, "the 09:25 CE given live stays: " + JSON.stringify(kept));
  // live, the moment after 09:25 closed: the same signal, waiting to fire: no row yet (18 October)
  const live = run(day.slice(0, 3), { [day[2].time]: "CE" }, day[2].time + 300);
  assert(live.length === 0, "waiting to fire: no row: " + JSON.stringify(live));
  // a record on the other side of what the final prices give: kept as given (a PE from 150, crossed by the candle's high), not the CE;
  // it fires when 09:30 goes below 148.5, 09:25's low, and that candle's close back above 150 sells it (exit A)
  const flip = run([...day.slice(0, 2), bar(2, 149, 150.5, 148.5, 150.3), bar(3, 149.8, 154, 148, 153), ...day.slice(4)], { [day[2].time]: "PE" });
  assert(flip.length === 2 && flip[0].side === "PE" && flip[0].kept && flip[0].level === 150 && flip[0].kind === "crossed" && flip[0].hold && flip[0].signalTime === day[2].time && flip[0].entry === 148.5 && flip[0].how === "back" && flip[0].exit === 153
         && flip[1].side === "CE" && flip[1].signalTime === day[3].time && flip[1].entry === 154, "kept on the side given: " + JSON.stringify(flip));  // crossed, not held: the candle's high went above 150 (18 October, the wick counts); 09:30's low under 150 and close above it: a Buy CE too
  // records of other candles change nothing, and the replays (no records) are as before; the replay judges the first candle from the
  // previous close, 148 here, the candle's own close, so that it gives no signal
  assert(JSON.stringify(run(day, { [t0 - 300]: "PE" })) === JSON.stringify(none), "a record of no candle here changes nothing");
  assert(JSON.stringify(R.replayDay({ bars: day, move: "prev", previous: { open: 100, high: 200, low: 100, close: 148 }, seconds: 300, signal: "both" }).trades) === JSON.stringify(none), "replays have no records");
  console.log("calls given live stay checks passed");
}

// ---- a target the candle itself brought closer (12 October, NIFTY 50: the 9:40 Buy CE, in at 22,513.25, target the 23.6% line at
// 22,542; the 9:50 candle went up to 22,523.90, then down to a new low of 22,472.15, which pulled the 23.6% line down to 22,514.38;
// the table sold the call "at the target" on the candle's earlier high, with the index at 22,475). Today-so-far lines, a day
// down from 200 to 100: 09:20 holds 0% (100), Buy CE in at 112 when 09:25 goes above 09:20's high, target 23.6% (123.6). 09:30
// goes up to 122, then to a new low of 90, which brings the 23.6% line down to 115.96, and closes at 95: not the target (122 never
// reached 123.6, and the moved line came after the high). 09:35 goes up to 118: the target, 115.96, at 09:35
{
  const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
  const day = [bar(0, 200, 200, 100, 110), bar(1, 108, 112, 100, 105), bar(2, 106, 120, 104, 115), bar(3, 115, 122, 90, 95), bar(4, 96, 118, 95, 110), bar(5, 110, 111, 108, 109)];
  const ce = (trades) => trades.find(t => t.signalTime === day[1].time && t.side === "CE");
  const r = ce(R.replayDay({ bars: day, move: "today", previous: null, seconds: 300, signal: "both" }).trades);
  assert(r && r.entry === 112 && r.entryTime === day[2].time && r.how === "target" && r.target === 115.96 && r.exitTime === day[4].time && r.points === 3.96, "the moved target, reached at 09:35: " + JSON.stringify(r));
  // live, with 09:30 forming at its low: still open; once the price now is back above the moved line, sold at it
  const live = (forming) => ce(R.paperTrades({ bars: [...day.slice(0, 3), forming], levelsAt: R.todayLevelsAt([...day.slice(0, 3), forming]), targetsAt: R.todayLinesAt([...day.slice(0, 3), forming]),
    now: day[3].time + 200, seconds: 300, dayCandles: false, signal: "both", holdBreaks: true, trail: R.TRAIL }).trades);
  const low = live(day[3]), back = live(bar(3, 115, 122, 90, 117));
  assert(low && low.exit == null && low.target === 115.96, "forming at the new low: still open: " + JSON.stringify(low));
  assert(back && back.how === "target" && back.exit === 115.96 && back.exitTime === day[3].time, "forming, the price now back above the moved line: sold at it: " + JSON.stringify(back));
  // the signal candle's own new low moved the lines before the entry: the entry candle's high counts against them as ever
  const early = [bar(0, 200, 200, 100, 110), bar(1, 108, 112, 95, 101), bar(2, 102, 121, 101, 118), bar(3, 118, 119, 117, 118)];
  const e = R.replayDay({ bars: early, move: "today", previous: null, seconds: 300, signal: "both" }).trades.find(t => t.signalTime === early[1].time);
  // since 18 October the 09:20 candle's low under the 0% line makes it a Crossed above 0%, a held break: the target still follows the
  // moved lines (119.78), but the call is held through it to the day end rather than sold at it
  assert(e && e.side === "CE" && e.kind === "crossed" && e.hold && e.entry === 112 && e.target === 119.78 && e.how === "day end" && e.exit === 118, "the entry candle's target is on the lines moved before it: " + JSON.stringify(e));
  console.log("a target brought closer by its own candle checks passed");
}

// ---- idea 13 (no call against a fresh run) and ideas 8 and 5 (the back-and-forth on one line) left the rule on 18 October (the owner: "all three remove")

// ---- idea 24, a call past the day's high or low (the owner, 13 October evening: "yes, build way 1"; NIFTY 50, today-so-far lines).
// A rising day: 09:15 makes the lines 95 to 110 (0% at 110). 09:20 closes at 113, above the top line, and no line gives a signal:
// a Buy CE Crossed above 0.0% (110), no target yet, in at 114 when 09:25 goes above 09:20's high. 09:25 closes at 117, past the next
// top line (114): a second signal, armed at 09:25's high 118, which no later candle goes above: no row. 09:35 closes below the
// 23.6% line (112.57): a Buy PE comes (in at 111 when 09:40 goes below 09:35's low, sold at 09:40's close back above the line), and
// that close gives a Buy CE of the lines (in at 116 when 09:45 goes above 09:40's high) although the 09:20 call is still held (they
// run alongside). The 09:20 call: 09:25 closed past the next top line, 114, so the stop sits on it (Change 4, 21 October) and the
// 09:35 close at 112 sells it, -2 (until 21 October the stop stayed one line back, on 110, and the call ran to the day end, +1).
// Off by default, never on the previous day's lines nor with the held
// signals only; a line's own signal comes before it; a falling day gives the Buy PE the same way
{
  const bar = (i, open, high, low, close) => ({ time: t0 + i * 300, open, high, low, close });
  const day = [bar(0, 100, 110, 95, 108), bar(1, 108, 114, 107, 113), bar(2, 113, 118, 112, 117), bar(3, 117, 117.5, 113, 114.5), bar(4, 114, 114.5, 111, 112), bar(5, 112, 116, 110.5, 115.5), bar(6, 115.5, 117, 114, 115)];
  const sides = (trades) => JSON.stringify(trades.map(t => [t.signalTime - t0, t.side, !!t.edge]));
  const off = R.replayDay({ bars: day, move: "today", previous: null, seconds: 300, signal: "both" }).trades;
  assert(sides(off) === JSON.stringify([[1200, "PE", false], [1500, "CE", false]]) && off.map(t => [t.entry, t.how, t.points].join()).join("|") === "111,back,-4.5|116,day end,-1", "without idea 24 no call at 09:20: " + sides(off) + off.map(t => [t.entry, t.how, t.points].join()).join("|"));
  const on = R.replayDay({ bars: day, move: "today", previous: null, seconds: 300, signal: "both", newHighLow: true }).trades;
  assert(sides(on) === JSON.stringify([[300, "CE", true], [1200, "PE", false], [1500, "CE", false]]), "idea 24: the 09:20 Buy CE, alone at 09:25, the lines' calls alongside: " + sides(on));
  const e = on[0];
  assert(e.kind === "crossed" && e.level === 110 && e.ratio === 0 && e.entry === 114 && e.entryTime === day[2].time && e.hold && e.c1Open === 108 && e.how === "trail" && e.exit === 112 && e.points === -2 && e.target === 118 && e.trail.stop === 114,
         "Crossed above 0.0%, sold by the stop on the line it crossed, its target the line the price later made: " + JSON.stringify(e));
  const pending = R.paperTrades({ bars: day.slice(0, 2), levelsAt: R.todayLevelsAt(day.slice(0, 2)), targetsAt: R.todayLinesAt(day.slice(0, 2)), now: day[1].time + 301,
    seconds: 300, dayCandles: false, signal: "both", holdBreaks: true, trail: R.TRAIL, newHighLow: true }).trades;
  assert(pending.length === 0, "given at 09:20's close: armed, no row until a candle goes above 114: " + JSON.stringify(pending));
  const live = R.paperTrades({ bars: day.slice(0, 3), levelsAt: R.todayLevelsAt(day.slice(0, 3)), targetsAt: R.todayLinesAt(day.slice(0, 3)), now: day[2].time + 60,
    seconds: 300, dayCandles: false, signal: "both", holdBreaks: true, trail: R.TRAIL, newHighLow: true }).trades;
  assert(live.length === 1 && live[0].how === "open" && live[0].entry === 114 && live[0].target === 118 && live[0].points === 3, "fired on 09:25 as it forms, its target the line the price made: " + JSON.stringify(live));
  const prev = R.replayDay({ bars: day, move: "prev", previous: { open: 90, high: 120, low: 90, close: 118 }, seconds: 300, signal: "both", newHighLow: true }).trades;
  assert(!prev.some(t => t.edge), "never on the previous day's lines: " + sides(prev));
  assert(!R.replayDay({ bars: day, move: "today", previous: null, seconds: 300, signal: "held", newHighLow: true }).trades.some(t => t.edge), "a Crossed call: not with the held signals only");
  const lineHeld = [bar(0, 100, 110, 95, 101), bar(1, 101, 104, 100.5, 103), bar(2, 103, 112, 102.8, 111), bar(3, 111, 112, 109, 110.5)];
  const lh = R.replayDay({ bars: lineHeld, move: "today", previous: null, seconds: 300, signal: "both", newHighLow: true }).trades;
  assert(sides(lh) === JSON.stringify([[300, "CE", false]]), "a line's own signal comes first (09:25 closes above the 0% line itself, no edge call; that signal, armed at 112, never fires): " + sides(lh));
  const flip = (b) => ({ time: b.time, open: 300 - b.open, high: 300 - b.low, low: 300 - b.high, close: 300 - b.close });
  const down = R.replayDay({ bars: day.map(flip), move: "today", previous: null, seconds: 300, signal: "both", newHighLow: true }).trades;
  assert(down[0].side === "PE" && down[0].edge && down[0].level === 190 && down[0].ratio === 0 && down[0].entry === 186 && down[0].how === "trail" && down[0].exit === 188 && down[0].points === -2, "a falling day: the Buy PE below the day's low, sold by the stop on the line it crossed: " + JSON.stringify(down[0]));
  console.log("idea 24 checks passed");
}

// ---- the owner's early exit of a held break (19 October: "if the candle stays above the previous candle's close more than a 2.5
// minute and also crossed one previous level which is a double confirmation then it should fire Take exit call for previous Hold
// call"), on the day it came from, 19 October, as the screenshot showed it (prices rounded; the minutes of the 9:30 candle made up
// to match the words: it touched -50%, made no new low, then went up through -38.2%). The previous close 23,146.15 gives the lines
// 0% 23,146.15, -23.6% 23,064.21, -38.2% 23,013.52, -50% 22,972.55. 9:20 closes 23,085, below 0%: Buy PE, fired at 9:25 below
// 9:20's low 23,083. 9:25 closes 22,975, past -23.6% and -38.2%: Rule 2's stop on -38.2% (on -23.6%, one line back, until 21 October). 9:30 opens 22,975: its
// minutes 9:31, 9:32 and 9:33 stay above 22,975 (the 9:25 close), and 9:33 closes 23,020, above -38.2% (23,013.52), the first line
// above that close: Take Exit at 9:34 at 23,020, 23,083 - 23,020 = +63. Without the minutes the call runs to the 9:30 close,
// 23,100, above the stop -23.6%: Rule 2 sells it at -17 (what the page did that day)
{
  const t0 = 1792381500;  // 19 October 2026 09:15 IST
  const bar = (i, o, h, l, c) => ({ time: t0 + i * 300, open: o, high: h, low: l, close: c });
  const bars = [bar(0, 23150, 23176, 23088, 23152), bar(1, 23154, 23160, 23083, 23085), bar(2, 23085, 23090, 22970, 22975), bar(3, 22975, 23105, 22972, 23100), bar(4, 23100, 23150, 23095, 23140)];
  const m = (k, o, h, l, c) => ({ time: t0 + k * 60, open: o, high: h, low: l, close: c });
  const minutes = [[0, 23150, 23176, 23140, 23160], [1, 23160, 23165, 23088, 23150], [2, 23150, 23155, 23145, 23148], [3, 23148, 23152, 23146, 23150], [4, 23150, 23153, 23148, 23152],
    [5, 23154, 23160, 23150, 23155], [6, 23155, 23157, 23140, 23142], [7, 23142, 23144, 23120, 23122], [8, 23122, 23124, 23100, 23102], [9, 23102, 23104, 23083, 23085],
    [10, 23085, 23090, 23060, 23062], [11, 23062, 23064, 23030, 23032], [12, 23032, 23034, 23000, 23002], [13, 23002, 23004, 22975, 22978], [14, 22978, 22980, 22970, 22975],
    [15, 22975, 22980, 22972, 22978], [16, 22978, 22992, 22976, 22990], [17, 22990, 23005, 22988, 23002], [18, 23002, 23025, 23000, 23020], [19, 23020, 23105, 23018, 23100],
    [20, 23100, 23110, 23095, 23105], [21, 23105, 23120, 23100, 23118], [22, 23118, 23130, 23115, 23128], [23, 23128, 23150, 23125, 23145], [24, 23145, 23148, 23135, 23140]].map(a => m(...a));
  const previous = { open: 23100, high: 23200, low: 23050, close: 23146.15 };
  const run = (mins, now = Infinity) => R.paperTrades({ bars: now === Infinity ? bars : bars.filter(b => b.time < now), levelsAt: R.closeLevelsAt(bars, previous.close), now, seconds: 300, dayCandles: false, signal: "both", holdBreaks: true, trail: R.TRAIL, prevClose: previous.close, minutes: mins }).trades;
  const pe = (ts) => ts.find(t => t.side === "PE" && t.signalTime === bars[1].time);
  const a = pe(run(null)), b = pe(run(minutes));
  assert(a && a.entry === 23083 && a.entryTime === bars[2].time && a.how === "trail" && a.exit === 23100 && a.points === -17 && a.trail.stop === 23013.52, "without the minutes Rule 2 sells at the 9:30 close (the stop on -38.2%, the line crossed): " + JSON.stringify(a));
  assert(b && b.entry === 23083 && b.how === "early" && b.exit === 23020 && b.exitTime === bars[3].time && b.exitAt === t0 + 19 * 60 && b.earlyFrom === 22975 && b.earlyLine === 23013.52 && b.points === 63,
         "the early exit at 9:34, at 23,020: " + JSON.stringify(b));
  assert(JSON.stringify(R.replayDay({ bars, move: "close", previous, seconds: 300, signal: "both", minutes }).trades.find(t => t.side === "PE")) === JSON.stringify(b), "replayDay passes the minutes on");
  // live: at 9:33:30 only the 9:30 to 9:32 minutes have closed (two above 22,975): still held; at 9:34:10 the 9:33 minute has closed: sold
  const live1 = pe(run(minutes, t0 + 18 * 60 + 30)), live2 = pe(run(minutes, t0 + 19 * 60 + 10));
  assert(live1 && live1.how === "open" && live2 && live2.how === "early" && live2.exit === 23020 && live2.exitAt === t0 + 19 * 60, "on the candle forming now, minute by minute: " + JSON.stringify([live1.how, live2.how, live2.exit]));
  // a minute that dips to the previous close breaks the run: 9:32's low 22,975 (not above it): the run restarts at 9:33, so no exit in this candle
  const dip = minutes.map(x => x.time === t0 + 17 * 60 ? { ...x, low: 22975 } : x);
  assert(pe(run(dip)).how === "trail", "a dip to the previous close restarts the three minutes: " + pe(run(dip)).how);
  // the line one back must be crossed too: 9:33 closing 23,010, under -38.2%, gives no exit yet; 9:34 (still above 22,975) closing 23,100 above it does
  const low = minutes.map(x => x.time === t0 + 18 * 60 ? { ...x, high: 23012, close: 23010 } : x);
  const c = pe(run(low));
  assert(c.how === "early" && c.exit === 23100 && c.exitAt === t0 + 20 * 60, "the double confirmation waits for the line: " + JSON.stringify([c.how, c.exit, c.exitAt - t0]));
  // a retouch earlier in the same candle still sells first: C1 (9:20) opened above 0%, so the 9:30 candle opening below 22,975 and reaching 23,154 before 9:33 sells at 23,154
  const touch = minutes.map(x => x.time === t0 + 16 * 60 ? { ...x, high: 23155 } : x);
  const d = pe(run(touch.map(x => x), Infinity));
  assert(d.how === "trail" || d.how === "early" || d.how === "retouch", "some exit: " + d.how);  // Rule 2 took over at 9:25 (a further line crossed), so no retouch here: the early exit
  assert(d.how === "early", "with Rule 2 on, the retouch no longer sells, the early exit does: " + d.how);
  // the CE mirror (every price p as 46300 - p): a Buy CE held, three minutes below the previous close and a close below the line one back
  const flip = (x) => ({ time: x.time, open: 46300 - x.open, high: 46300 - x.low, low: 46300 - x.high, close: 46300 - x.close });
  const up = R.paperTrades({ bars: bars.map(flip), levelsAt: R.closeLevelsAt(bars.map(flip), 46300 - previous.close), now: Infinity, seconds: 300, dayCandles: false, signal: "both", holdBreaks: true, trail: R.TRAIL, prevClose: 46300 - previous.close, minutes: minutes.map(flip) }).trades;
  const ce = up.find(t => t.side === "CE" && t.signalTime === bars[1].time);
  assert(ce && ce.how === "early" && ce.exit === 46300 - 23020 && ce.points === 63, "the CE mirror: " + JSON.stringify(ce));
  // A call fired inside a candle is judged on the part after it fired (the owner, 19 October: the 2:05 Buy PE sold on the 2:10 candle,
  // which closed below its line and below the 2:05 close). C1 (9:20) opens 23,154 above 0% and closes 23,130 below it: Buy PE, fired
  // below 23,120, C1's low. Case A: 9:25 opens 23,125, below the 9:20 close, first goes up to 23,155 (C1's open, a retouch by the look
  // of it), then breaks 23,120 in its third minute and closes 23,085. Without the minutes the retouch sells it at 23,154 (-34); with
  // them the touch came before the fire, so the call is held, to the day end at 23,075 (+45). Case B: 9:25's first three minutes stay
  // above 23,130 and close above 0% (the early exit by the look of it), then the fourth breaks 23,120 and the candle closes 23,092:
  // with the minutes no exit, since nothing closed after the fire; live at 9:28:30, the fire in the minute forming now, the same
  const c1 = [bar(0, 23150, 23176, 23140, 23160), bar(1, 23154, 23160, 23120, 23130)];
  const minA = [[10, 23125, 23155, 23124, 23150], [11, 23150, 23152, 23130, 23132], [12, 23132, 23134, 23110, 23112], [13, 23112, 23115, 23095, 23098], [14, 23098, 23100, 23080, 23085]].map(a => m(...a));  // the 9:25 candle's minutes
  const barsA = [...c1, bar(2, 23125, 23155, 23080, 23085), bar(3, 23085, 23090, 23070, 23075)];
  const runA = (mins, now = Infinity) => R.paperTrades({ bars: now === Infinity ? barsA : barsA.filter(b => b.time < now), levelsAt: R.closeLevelsAt(barsA, previous.close), now, seconds: 300, dayCandles: false, signal: "both", holdBreaks: true, trail: R.TRAIL, prevClose: previous.close, minutes: mins }).trades.find(t => t.side === "PE");
  const a0 = runA(null), a1 = runA(minA);
  assert(a0.entry === 23120 && a0.how === "retouch" && a0.exit === 23154 && a0.points === -34, "without the minutes the touch before the fire sells: " + JSON.stringify(a0));
  assert(a1.entry === 23120 && a1.how === "day end" && a1.exit === 23075 && a1.points === 45, "with the minutes the touch before the fire does not count: " + JSON.stringify(a1));
  const minB = [[10, 23132, 23150, 23131, 23148], [11, 23148, 23160, 23140, 23158], [12, 23158, 23162, 23150, 23155], [13, 23155, 23156, 23110, 23112], [14, 23112, 23114, 23090, 23092]].map(a => m(...a));
  const barsB = [...c1, bar(2, 23132, 23162, 23090, 23092), bar(3, 23092, 23095, 23070, 23075)];
  const runB = (mins, now = Infinity, forming = null) => R.paperTrades({ bars: now === Infinity ? barsB : [...barsB.filter(b => b.time + 300 <= now), ...(forming ? [forming] : [])], levelsAt: R.closeLevelsAt(barsB, previous.close), now, seconds: 300, dayCandles: false, signal: "both", holdBreaks: true, trail: R.TRAIL, prevClose: previous.close, minutes: mins }).trades.find(t => t.side === "PE");
  const b1 = runB(minB);
  assert(b1 && b1.entry === 23120 && b1.how === "day end" && b1.exit === 23075 && b1.points === 45, "three minutes above the close before the fire do not count: " + JSON.stringify(b1));
  const bLive = runB(minB, t0 + 13 * 60 + 30, bar(2, 23132, 23162, 23110, 23112));  // 9:28:30
  assert(bLive && bLive.entry === 23120 && bLive.how === "open", "fired in the minute forming now: held: " + JSON.stringify(bLive));
  console.log("judged from the fire on: checked");
  console.log("early exit checks passed");
}

// "Previous close" lines (the owner, 15 October): 0% at the previous day's close, 100% 1.5% of it, the Fibonacci shares above (+)
// and below (-): 13 lines; drawn again only after a candle closes above +100% (today's low 0% to today's high +100%) or below
// -100% (today's high 0% to today's low -100%); the other levels modes untouched
{
  const lv = R.closeLevels(22622.7), names = lv.map(l => R.levelName(l.ratio, l.signed));
  assert(lv.length === 13 && JSON.stringify(names) === JSON.stringify(["-100.0%", "-78.6%", "-61.8%", "-50.0%", "-38.2%", "-23.6%", "0.0%", "+23.6%", "+38.2%", "+50.0%", "+61.8%", "+78.6%", "+100.0%"]),
    "the previous close's 13 lines, named -100% to +100%: " + names);
  assert(JSON.stringify(lv.map(l => l.price)) === JSON.stringify([22283.36, 22355.98, 22412.99, 22453.03, 22493.07, 22542.62, 22622.7, 22702.78, 22752.33, 22792.37, 22832.41, 22889.42, 22962.04]),
    "15 October's lines from 14 October's close, 22,622.70, 100% = 1.5%: " + lv.map(l => l.price));
  assert(R.closeLevels(null) === null && R.closeLevels(0) === null && R.closeLevelsAt([], null) === null, "no close, no lines");
  assert(R.levelName(0.236) === "23.6%" && R.levelName(0.236, false) === "23.6%", "the other lines keep their names");
  const t0 = 1760000000 - (1760000000 + 19800) % 86400 + 9 * 3600 + 15 * 60;
  const bar = (i, o, h, l, c) => ({ time: t0 + i * 300, open: o, high: h, low: l, close: c });
  // up: 2 closes inside, 3 goes above +100% but closes below it (no redraw), 4 closes above it (redraw from the next candle),
  // 6 closes above the new +100% (today's high): drawn again
  const up = [bar(0, 22650, 22690, 22640, 22685), bar(1, 22685, 22760, 22670, 22750), bar(2, 22750, 22900, 22745, 22890), bar(3, 22890, 22970, 22880, 22950),
              bar(4, 22950, 22990, 22945, 22985), bar(5, 22985, 22988, 22960, 22970), bar(6, 22970, 23010, 22965, 23005), bar(7, 23005, 23008, 22990, 23000)];
  const at = R.closeLevelsAt(up, 22622.7), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  assert([0, 1, 2, 3, 4].every(i => same(at(i), lv)), "the 13 lines stand still until a candle closes above +100% (the 3rd only went above it)");
  assert(same(at(5), R.rangeLevels(22640, 22990, true)) && same(at(6), at(5)), "after the close above +100%: 0% at today's low 22,640, +100% at today's high 22,990");
  assert(same(at(7), R.rangeLevels(22640, 23010, true)) && same(at(99), at(7)), "a close above that +100% (a new high): drawn again to 23,010");
  assert(same(at(5).map(l => R.levelName(l.ratio, l.signed)), ["0.0%", "+23.6%", "+38.2%", "+50.0%", "+61.8%", "+78.6%", "+100.0%"]) && at(5)[1].price === 22722.6,
    "redrawn up: 7 lines, +23.6% 23.6% of the way up from the low: " + at(5).map(l => l.price));
  const down = [bar(0, 22600, 22610, 22560, 22570), bar(1, 22570, 22575, 22400, 22420), bar(2, 22420, 22425, 22270, 22275), bar(3, 22275, 22300, 22260, 22290)];
  const dn = R.closeLevelsAt(down, 22622.7);
  assert(same(dn(2), lv) && same(dn(3), R.rangeLevels(22270, 22610, false)), "a close below -100%: 0% at today's high 22,610, -100% at today's low 22,270");
  assert(same(dn(3).map(l => R.levelName(l.ratio, l.signed)), ["-100.0%", "-78.6%", "-61.8%", "-50.0%", "-38.2%", "-23.6%", "0.0%"]) && dn(3)[5].price === 22529.76, "redrawn down: " + dn(3).map(l => l.price));
  // after the redraw up, a close below its 0% (today's low): drawn again downward, 0% at today's high, -100% at today's low (the
  // owner: "redraw downward with today's high as 0%"); and after that a close above today's high: upward again
  const turn = [...up.slice(0, 6), bar(6, 22970, 22975, 22600, 22610), bar(7, 22610, 22615, 22580, 22590), bar(8, 22590, 23000, 22585, 22995), bar(9, 22995, 22998, 22985, 22990)];
  const tn = R.closeLevelsAt(turn, 22622.7);
  assert(same(tn(6), R.rangeLevels(22640, 22990, true)) && same(tn(7), R.rangeLevels(22600, 22990, false)),
    "a close below the redrawn 0% (today's low): 0% at today's high 22,990, -100% at today's low 22,600: " + tn(7).map(l => l.price));
  assert(same(tn(8), R.rangeLevels(22580, 22990, false)), "a close below that -100% (a new low): drawn again down to 22,580");
  assert(same(tn(9), R.rangeLevels(22580, 23000, true)), "then a close above the 0% at today's high: upward again, 22,580 to 23,000");
  const prev = { open: 22700, high: 22760, low: 22560, close: 22622.7 };
  const r = R.replayDay({ bars: up, move: "close", previous: prev, seconds: 300, signal: "both" }).trades;
  assert(r.length && r.every(t => t.signed === true), "calls on these lines carry signed: " + JSON.stringify(r.map(t => [(t.signalTime - t0) / 300, t.level, t.ratio, t.kind, t.side])));
  assert(r.every(t => at((t.signalTime - t0) / 300).some(l => l.price === t.level)), "each call is on a line in force at its candle");
  const other = R.replayDay({ bars: up, move: "close", previous: { ...prev, high: 30000, low: 1 }, seconds: 300, signal: "both" }).trades;
  assert(same(other.map(t => [t.signalTime, t.level, t.side]), r.map(t => [t.signalTime, t.level, t.side])), "only the close counts, not the previous day's high or low");
  assert(R.replayDay({ bars: up, move: "prev", previous: prev, seconds: 300, signal: "both" }).trades.every(t => !("signed" in t)), "the previous day's lines are as before");
  assert(R.replayDay({ bars: up, move: "close", previous: null, seconds: 300, signal: "both" }).trades.length === 0, "no previous day, no lines");
  const rd = r.map(t => R.readOf({ trade: t, bars: up, seconds: 300, now: Infinity })).filter(Boolean);
  assert(rd.every(x => !/the \d/.test(x.why)), "the candle verdict names a previous close's line with its + or -: " + rd.map(x => x.why));
  console.log("previous close lines checks passed");
}
