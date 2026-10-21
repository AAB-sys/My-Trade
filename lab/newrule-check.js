// The New Rule Chart engine (static/newrule.js) against the owner's documents' test cases (document 04, Appendix B and F1, F9, F10;
// document 02, T11). Run: node lab/newrule-check.js
"use strict";
const path = require("path");
require(path.join(__dirname, "..", "static", "newrule.js")); const N = globalThis.NewRule;
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const rows = [[22640,22645,22625,22630],[22630,22632,22610,22615],[22615,22618,22600,22605],[22605,22640,22603,22635],[22635,22680,22630,22675],[22675,22720,22670,22715],[22715,22760,22710,22755],[22755,22800,22750,22790],[22790,22795,22760,22765],[22765,22770,22730,22735],[22735,22740,22700,22705],[22705,22710,22680,22688],[22688,22694,22682,22690],[22690,22702,22686,22698],[22698,22730,22695,22725],[22725,22760,22720,22755],[22755,22790,22750,22785],[22785,22815,22780,22810],[22810,22860,22805,22858],[22858,22865,22820,22825],[22825,22830,22790,22795]];
const ce = rows.map((r, i) => ({ time: 1792381500 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
const pe = ce.map(b => ({ time: b.time, open: 45400 - b.open, high: 45400 - b.low, low: 45400 - b.high, close: 45400 - b.close }));  // the mirror around 22,700 (Appendix B)
const at = (m, r) => m.levels.find(l => l.ratio === r).price;
// F1: on the CE data up to candle 13, with the ATR fixed at 20: A 22,600 (candle 2), B 22,800 (candle 7); 78.6% 22,642.8, 61.8% 22,676.4,
// 50% 22,700, 38.2% 22,723.6, 23.6% 22,752.8, 0% 22,800, -27.2% 22,854.4
const m = N.moveAt(ce.slice(0, 14), N.CFG, 20);
assert(m && m.side === "CE" && m.a === 2 && m.b === 7 && m.A === 22600 && m.B === 22800, "F1 move: " + JSON.stringify(m));
assert(at(m, 0.786) === 22642.8 && at(m, 0.618) === 22676.4 && at(m, 0.5) === 22700 && at(m, 0.382) === 22723.6 && at(m, 0.236) === 22752.8 && at(m, 0) === 22800 && at(m, -0.272) === 22854.4, "F1 levels: " + JSON.stringify(m.levels));
assert(m.levels.map(l => l.name).join(" ") === "100% 78.6% 61.8% 50% 38.2% 23.6% 0% -27.2% -61.8% -100%", "level names: " + m.levels.map(l => l.name).join(" "));
// B is known only once the third candle after it has closed: up to candle 9 there is no move yet (candle 10 confirms candle 7)
assert(N.moveAt(ce.slice(0, 10), N.CFG, 20) === null && N.moveAt(ce.slice(0, 11), N.CFG, 20).b === 7, "B confirmed by the third candle after it");
// F8: a move smaller than impulse_atr x ATR is no move (200 points against 12 x 20 = 240)
assert(N.moveAt(ce.slice(0, 14), { ...N.CFG, impulseAtr: 12 }, 20) === null, "F8: too small a move");
// F9: candle 9 high 22,805: redrawn on the new high, B 22,805, stop 22,643.87, target 2 22,860.76
const f9 = ce.map(b => ({ ...b })); f9[9].high = 22805;
const m9 = N.moveAt(f9.slice(0, 14), N.CFG, 20);
assert(m9.B === 22805 && m9.b === 9 && at(m9, 0.786) === 22643.87 && at(m9, -0.272) === 22860.76, "F9: " + JSON.stringify(m9));
// F10: the PE data: A 22,800, B 22,600, stop 22,757.2, target 1 22,600, target 2 22,545.6
const mp = N.moveAt(pe.slice(0, 14), N.CFG, 20);
assert(mp && mp.side === "PE" && mp.A === 22800 && mp.B === 22600 && at(mp, 0.786) === 22757.2 && at(mp, 0) === 22600 && at(mp, -0.272) === 22545.6, "F10: " + JSON.stringify(mp));
// F11: the CE data has no down-move, the PE data no up-move
assert(N.moveOnSide(ce.slice(0, 14), -1, N.CFG, 20) === null && N.moveOnSide(pe.slice(0, 14), 1, N.CFG, 20) === null, "F11: one side only");
// T11: previous ATR 30, previous close 24,400, a candle high 24,420 low 24,400: true range 20, new ATR 410 / 14 = 29.29
assert(N.round2(N.atrStep(30, 20)) === 29.29, "T11: " + N.atrStep(30, 20));
// the ATR series: seeded by the simple average of the first 14 true ranges, then Wilder
const tr = (b, p) => p == null ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - p), Math.abs(b.low - p));
const trs = ce.map((b, i) => tr(b, i ? ce[i - 1].close : null)), seed = trs.slice(0, 14).reduce((s, x) => s + x, 0) / 14;
const series = N.atrSeries(ce);
assert(series[12] === null && Math.abs(series[13] - seed) < 1e-9 && Math.abs(series[14] - (seed * 13 + trs[14]) / 14) < 1e-9, "ATR seed and step");
console.log("New Rule Chart: the levels of the latest move match the documents' cases (F1, F8, F9, F10, F11, T11)");

// ---- The double top / double bottom rule (the owner's "Trading Rules Specification", 21 October): Appendix A data, ATR fixed at 1.5,
// the buffer 0.25 x ATR = 0.375; E1 to E15 and E19
const A = [[90.0,92.0,89.5,91.5],[91.5,93.5,91.0,93.0],[93.0,95.0,92.5,94.5],[94.5,96.5,94.0,96.0],[96.0,98.0,95.5,97.5],[97.5,99.5,97.0,99.0],[99.0,100.6,98.5,99.8],[99.8,100.8,98.8,99.2],[99.2,99.5,97.0,97.5],[97.5,98.0,95.5,96.0],[96.0,96.5,93.5,94.0],[94.0,94.5,92.0,92.6],[92.6,93.8,91.8,93.4],[93.4,95.4,93.0,95.0],[95.0,97.0,94.6,96.6],[96.6,98.4,96.2,98.0],[98.0,99.8,97.6,99.4],[99.4,100.7,98.9,99.5],[99.5,99.8,97.8,98.2],[98.2,98.6,96.0,96.5],[96.5,97.0,94.2,94.8],[94.8,95.2,92.8,93.2],[93.2,93.6,90.2,90.8],[90.8,92.2,90.0,91.8],[91.8,92.6,91.0,91.5],[91.5,91.8,89.0,89.5],[89.5,90.0,87.5,88.0],[88.0,88.4,86.0,86.5],[86.5,87.0,84.8,85.5]];
const t0 = 1792381500 + 3 * 300;  // 09:30 IST: every candle inside the entry window
const peD = A.map((r, i) => ({ time: t0 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
const ceD = peD.map(b => ({ time: b.time, open: 190 - b.open, high: 190 - b.low, low: 190 - b.high, close: 190 - b.close }));
const ATR = 1.5, cfg = { ...N.DT };
const sig = (bars, k, side, c = cfg) => N.detectEntry(bars, k, side, ATR, c);
const firstSignal = (bars, side, c = cfg) => { for (let k = 0; k < bars.length; k++) { const s = sig(bars, k, side, c); if (s) return s; } return null; };
// E1: the PE data: signal on candle 22, T1 candle 7 (100.8), T2 candle 17 (100.7), neckline 91.8, height 9, target 82.8
const e1 = sig(peD, 22, "PE");
assert(e1 && e1.t1 === 7 && e1.t2 === 17 && e1.top === 100.8 && e1.neckline === 91.8 && e1.height === 9 && e1.target === 82.8, "E1: " + JSON.stringify(e1));
// E2: checked on every candle, only candle 22 signals (25 closes below the neckline too, but the pattern is used up)
const fires = peD.map((_, k) => sig(peD, k, "PE") ? k : null).filter(k => k != null);
assert(fires.join() === "22", "E2: " + fires.join());
const vary = (i, r) => peD.map((b, k) => k === i ? { time: b.time, open: r[0], high: r[1], low: r[2], close: r[3] } : b);
assert(firstSignal(vary(17, [99.4, 102.0, 98.9, 99.5]), "PE") === null, "E3: tops 1.2 apart");
assert(firstSignal(peD, "PE", { ...cfg, minGap: 11 }) === null, "E4: min_gap 11");
assert(firstSignal(peD, "PE", { ...cfg, maxGap: 9 }) === null, "E5: max_gap 9");
assert(firstSignal(peD, "PE", { ...cfg, minDepthAtr: 6.0 }) === null, "E6: depth 8.9 under 9");
assert(firstSignal(peD, "PE", { ...cfg, priorMoveAtr: 8.0 }) === null, "E7: the move into T1 11.3 under 12");
assert(firstSignal(vary(13, [95, 101.5, 94.6, 101.2]), "PE") === null, "E8: a candle between the tops closed above them");
const e9 = vary(22, [93.2, 93.6, 90.2, 91.6]); assert(sig(e9, 22, "PE") === null && sig(e9, 25, "PE") && sig(e9, 25, "PE").signalCandle === 25, "E9: no signal on 22 (needs under 91.425), signal on 25");
const e10 = vary(22, [93.2, 93.6, 90.2, 92.5]); assert(sig(e10, 22, "PE") === null && sig(e10, 25, "PE") !== null, "E10: a wick below the neckline is no signal; 25 signals");
const e11 = vary(22, [93.2, 93.6, 87.0, 87.6]); assert(e11.every((_, k) => sig(e11, k, "PE") === null), "E11: 4.2 past the neckline, more than 2 x ATR: no signal, none later");
assert(firstSignal(peD, "PE", { ...cfg, maxWait: 4 }) === null, "E12: the break 5 candles after T2");
const e13 = sig(ceD, 22, "CE");
assert(e13 && e13.t1 === 7 && e13.t2 === 17 && e13.top === 89.2 && e13.neckline === 98.2 && e13.height === 9 && e13.target === 107.2, "E13: " + JSON.stringify(e13));
assert(firstSignal(peD, "CE") === null, "E14: PE data, CE side"); assert(firstSignal(ceD, "PE") === null, "E15: CE data, PE side");
const e19 = vary(19, [98.2, 98.6, 90.5, 91.0]).map((b, k) => k === 20 ? { time: b.time, open: 91.0, high: 91.5, low: 89.5, close: 90.0 } : b);
const f19 = e19.map((_, k) => sig(e19, k, "PE") ? k : null).filter(k => k != null);
assert(f19.join() === "20", "E19: the break before T2 is confirmed: the confirming candle 20 is the signal, none later: " + f19.join());
// the entry: E1 buys the PE at candle 23's open, 90.8; E13 the CE at 99.2 (runDay, no levels beyond: Rule 1 alone, the day end closes it)
const r1 = N.runDay({ bars: peD, levels: [], atrFixed: ATR });
assert(r1.trades.length === 1 && r1.trades[0].side === "PE" && r1.trades[0].entry === 90.8 && r1.trades[0].entryTime === peD[23].time, "E1 entry: " + JSON.stringify(r1.trades[0]));
assert(r1.trades[0].how === "day end" && r1.trades[0].exit === 85.5 && r1.trades[0].points === 5.3, "E1 run to the day end: " + JSON.stringify(r1.trades[0]));
const r13 = N.runDay({ bars: ceD, levels: [], atrFixed: ATR });
assert(r13.trades.length === 1 && r13.trades[0].side === "CE" && r13.trades[0].entry === 99.2, "E13 entry: " + JSON.stringify(r13.trades[0]));
// E16: the signal candle closing at 09:25: the entry at 09:25 is before 09:30: skipped, "outside entry window"
const early = peD.map((b, k) => ({ ...b, time: 1792381500 + 300 + (k - 22) * 300 }));  // candle 22 at 09:20, closing at 09:25: the entry candle opens at 09:25
const r16 = N.runDay({ bars: early, levels: [], atrFixed: ATR });
assert(r16.trades.length === 0 && r16.skipped.some(s => s.why === "outside entry window"), "E16: " + JSON.stringify(r16.skipped));
// E17: the daily limit already reached; E18: a trade already open is covered by one trade at a time (runDay opens one at a time by construction)
assert(N.runDay({ bars: peD, levels: [], atrFixed: ATR, cfg: { ...cfg, maxTradesPerDay: 0 } }).skipped.some(s => s.why === "daily limit"), "E17: daily limit");
// Rule 1, Exit B: C2 opens below C1's close and its high reaches C1's open: closed at C2's close (the retouch)
const b2 = peD.map((b, k) => k === 23 ? { time: b.time, open: 90.5, high: 93.3, low: 90.0, close: 91.8 } : b);
const r2 = N.runDay({ bars: b2, levels: [], atrFixed: ATR });
assert(r2.trades[0].how === "retouch" && r2.trades[0].exitTime === b2[23].time, "Rule 1 Exit B: " + JSON.stringify(r2.trades[0]));
// Rule 1, Exit A: a candle closes back above the neckline (91.8)
const a2 = peD.map((b, k) => k === 24 ? { time: b.time, open: 91.8, high: 92.6, low: 91.0, close: 92.0 } : b);
assert(N.runDay({ bars: a2, levels: [], atrFixed: ATR }).trades[0].how === "reclaim", "Rule 1 Exit A: reclaim");
// ---- Rule 2 (section 6.8): levels 38.2% 24,380, 50% 24,450, 61.8% 24,520; the initial stop 24,300
const LV = [{ pct: "38.2%", price: 24380 }, { pct: "50.0%", price: 24450 }, { pct: "61.8%", price: 24520 }];
const run2 = (closes, d = 1, buf = 0, c = cfg, stop = 24300, idx = -1) => { const st = { trailIdx: idx, stop }; const lv = LV.slice().sort((x, y) => d * (x.price - y.price)); const out = []; for (const cl of closes) { out.push(N.trailStep(st, cl, lv, d, buf, c) + " " + st.stop); } return out.join(" / "); };
assert(run2([24395, 24460, 24440]) === "HOLD 24380 / HOLD 24450 / SELL 24450", "T1: " + run2([24395, 24460, 24440]));
assert(run2([24385], 1, 10) === "HOLD 24300", "T2"); assert(run2([24395], 1, 10) === "HOLD 24380", "T3"); assert(run2([24535], 1, 10) === "HOLD 24520", "T4");
assert(run2([24445], 1, 10, cfg, 24450, 1) === "SELL 24450", "T5");
const back = { ...cfg, stopPlacement: "ONE_LEVEL_BACK" };
assert(run2([24445], 1, 10, back, 24380, 1) === "HOLD 24380", "T6"); assert(run2([24395], 1, 10, back) === "HOLD 24300", "T7"); assert(run2([24465], 1, 10, back, 24400) === "HOLD 24400", "T8");
assert(run2([24515, 24505, 24525], -1, 10, cfg, 24600) === "HOLD 24600 / HOLD 24520 / SELL 24520", "T9: " + run2([24515, 24505, 24525], -1, 10, cfg, 24600));
assert(N.bufferOf(20, { ...cfg, buffer: "ATR", atrMult: 0.5 }) === 10, "T10: the buffer from the previous candle's ATR");
console.log("New Rule Chart: the double top rule, Rule 1 and Rule 2 match the document's cases (E1 to E19, T1 to T11)");
