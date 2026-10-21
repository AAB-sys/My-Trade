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
const rDefault = N.runDay({ bars: ceD, levels: [], atrFixed: ATR });  // the page's rules: the double top (Buy PE only), the double bottom, the triple top
assert(rDefault.trades.length === 1 && rDefault.trades[0].rule === "double bottom" && rDefault.trades[0].side === "CE" && rDefault.trades[0].entry === 99.2, "the CE data: the double bottom rule's Buy CE, the double top's mirror off: " + JSON.stringify(rDefault.trades.map(t => [t.rule, t.side, t.entry])));
const r1 = N.runDay({ bars: peD, levels: [], atrFixed: ATR, rules: ["double top"] });
assert(r1.trades.length === 1 && r1.trades[0].side === "PE" && r1.trades[0].entry === 90.8 && r1.trades[0].entryTime === peD[23].time, "E1 entry: " + JSON.stringify(r1.trades[0]));
assert(r1.trades[0].how === "day end" && r1.trades[0].exit === 85.5 && r1.trades[0].points === 5.3, "E1 run to the day end: " + JSON.stringify(r1.trades[0]));
const r13 = N.runDay({ bars: ceD, levels: [], atrFixed: ATR, sides: ["CE"], rules: ["double top"] });  // the double top document's own mirror, asked for by name (the page runs the double bottom document instead)
assert(r13.trades.length === 1 && r13.trades[0].side === "CE" && r13.trades[0].entry === 99.2, "E13 entry: " + JSON.stringify(r13.trades[0]));
// E16: the signal candle closing at 09:25: the entry at 09:25 is before 09:30: skipped, "outside entry window"
const early = peD.map((b, k) => ({ ...b, time: 1792381500 + 300 + (k - 22) * 300 }));  // candle 22 at 09:20, closing at 09:25: the entry candle opens at 09:25
const r16 = N.runDay({ bars: early, levels: [], atrFixed: ATR, rules: ["double top"] });
assert(r16.trades.length === 0 && r16.skipped.some(s => s.why === "outside entry window"), "E16: " + JSON.stringify(r16.skipped));
// E17: the daily limit already reached; E18: a trade already open is covered by one trade at a time (runDay opens one at a time by construction)
assert(N.runDay({ bars: peD, levels: [], atrFixed: ATR, rules: ["double top"], cfg: { ...cfg, maxTradesPerDay: 0 } }).skipped.some(s => s.why === "daily limit"), "E17: daily limit");
// Rule 1, Exit B: C2 opens below C1's close and its high reaches C1's open: closed at C2's close (the retouch)
const b2 = peD.map((b, k) => k === 23 ? { time: b.time, open: 90.5, high: 93.3, low: 90.0, close: 91.8 } : b);
const r2 = N.runDay({ bars: b2, levels: [], atrFixed: ATR, rules: ["double top"] });
assert(r2.trades[0].how === "retouch" && r2.trades[0].exitTime === b2[23].time, "Rule 1 Exit B: " + JSON.stringify(r2.trades[0]));
// Rule 1, Exit A: a candle closes back above the neckline (91.8)
const a2 = peD.map((b, k) => k === 24 ? { time: b.time, open: 91.8, high: 92.6, low: 91.0, close: 92.0 } : b);
assert(N.runDay({ bars: a2, levels: [], atrFixed: ATR, rules: ["double top"] }).trades[0].how === "reclaim", "Rule 1 Exit A: reclaim");
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


// ---- The double bottom (the owner's "Double Bottom Chart Pattern" document): Appendix A (the breakout, Buy CE) and B (the failure,
// Buy PE), ATR fixed at 1.5, the buffer 0.375; CE-1 to CE-14, PE-1 to PE-8 (the 5-minute settings; the daily chart is not built)
{
  const A = [[100.0,100.5,98.0,98.5],[98.5,99.0,96.5,97.0],[97.0,97.5,95.0,95.5],[95.5,96.0,93.5,94.0],[94.0,94.5,92.0,92.5],[92.5,93.0,90.5,91.0],[91.0,91.5,89.4,90.2],[90.2,91.2,89.2,90.8],[90.8,93.0,90.5,92.5],[92.5,94.5,92.0,94.0],[94.0,96.5,93.5,96.0],[96.0,98.0,95.5,97.4],[97.4,98.2,96.2,96.6],[96.6,97.0,94.6,95.0],[95.0,95.4,93.0,93.4],[93.4,93.8,91.6,92.0],[92.0,92.4,90.2,90.6],[90.6,91.1,89.3,90.5],[90.5,92.2,90.2,91.8],[91.8,94.0,91.4,93.5],[93.5,95.8,93.0,95.2],[95.2,97.2,94.8,96.8],[96.8,99.8,96.4,99.2],[99.2,100.0,97.8,98.2],[98.2,99.0,97.4,98.5],[98.5,101.0,98.2,100.5],[100.5,102.5,100.0,102.0],[102.0,104.0,101.6,103.5],[103.5,105.2,103.0,104.5]];
  const B = A.slice(0, 21).concat([[95.2,95.6,92.0,92.4],[92.4,92.8,89.6,90.0],[90.0,90.4,88.2,88.5],[88.5,88.9,87.0,87.3],[87.3,87.6,85.8,86.0],[86.0,86.4,84.5,84.8],[84.8,85.2,83.4,83.7],[83.7,84.0,82.0,82.3]]);
  const mk = rows => rows.map((r, i) => ({ time: t0 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
  const dA = mk(A), dB = mk(B);
  const db = (bars, k, side, c = cfg) => N.detectDoubleBottom(bars, k, side, ATR, c);
  const first = (bars, side, c = cfg) => { for (let k = 0; k < bars.length; k++) { const s = db(bars, k, side, c); if (s) return s; } return null; };
  const fires = (bars, side, c = cfg) => bars.map((_, k) => db(bars, k, side, c) ? k : null).filter(k => k != null).join();
  const vary = (bars, i, r) => bars.map((b, k) => k === i ? { time: b.time, open: r[0], high: r[1], low: r[2], close: r[3] } : b);
  const c1 = db(dA, 22, "CE");
  assert(c1 && c1.t1 === 7 && c1.t2 === 17 && c1.neckline === 98.2 && c1.height === 9 && c1.target === 107.2 && c1.support === 89.2, "DB CE-1: " + JSON.stringify(c1));
  assert(fires(dA, "CE") === "22", "DB CE-2: " + fires(dA, "CE"));
  assert(first(vary(dA, 17, [90.6, 91.1, 88.0, 90.5]), "CE") === null, "DB CE-3");
  assert(first(dA, "CE", { ...cfg, minGap: 11 }) === null && first(dA, "CE", { ...cfg, maxGap: 9 }) === null, "DB CE-4, CE-5");
  assert(first(dA, "CE", { ...cfg, minDepthAtr: 6.0 }) === null && first(dA, "CE", { ...cfg, priorMoveAtr: 8.0 }) === null, "DB CE-6, CE-7");
  assert(first(vary(dA, 13, [95.0, 95.4, 88.5, 88.8]), "CE") === null, "DB CE-8");
  const c9 = vary(dA, 22, [96.8, 99.8, 96.4, 98.4]); assert(db(c9, 22, "CE") === null && db(c9, 25, "CE") !== null, "DB CE-9");
  const c10 = vary(dA, 22, [96.8, 99.8, 96.4, 97.5]); assert(db(c10, 22, "CE") === null && db(c10, 25, "CE") !== null, "DB CE-10");
  const c11 = vary(dA, 22, [96.8, 103.0, 96.4, 102.4]); assert(fires(c11, "CE") === "", "DB CE-11");
  assert(first(dA, "CE", { ...cfg, maxWait: 4 }) === null, "DB CE-12");
  const c13 = vary(vary(dA, 19, [91.8, 99.5, 91.4, 99.0]), 20, [99.0, 100.5, 98.5, 100.0]); assert(fires(c13, "CE") === "20", "DB CE-13: " + fires(c13, "CE"));
  assert(first(dB, "CE") === null, "DB CE-14: the neckline is never broken");
  const r15 = N.runDay({ bars: dA.map((b, k) => ({ ...b, time: 1792381500 + 300 + (k - 22) * 300 })), levels: [], atrFixed: ATR, rules: ["double bottom"] });
  assert(r15.trades.length === 0 && r15.skipped.some(s => s.why === "outside entry window"), "DB CE-15");
  const rA = N.runDay({ bars: dA, levels: [], atrFixed: ATR, rules: ["double bottom"] });
  assert(rA.trades.length === 1 && rA.trades[0].side === "CE" && rA.trades[0].entry === 99.2 && rA.trades[0].L === 98.2, "DB CE-1 entry at 99.2: " + JSON.stringify(rA.trades[0]));
  const p1 = db(dB, 23, "PE");
  assert(p1 && p1.t1 === 7 && p1.t2 === 17 && p1.support === 89.2 && p1.height === 9 && p1.target === 80.2 && p1.L === 89.2, "DB PE-1: " + JSON.stringify(p1));
  assert(fires(dB, "PE") === "23", "DB PE-2: " + fires(dB, "PE"));
  const p3 = vary(dB, 23, [90.0, 90.4, 88.2, 88.9]); assert(db(p3, 23, "PE") === null && db(p3, 24, "PE") !== null, "DB PE-3");
  const p4 = vary(dB, 23, [90.0, 90.4, 85.5, 85.8]); assert(fires(p4, "PE") === "", "DB PE-4");
  assert(first(dA, "PE") === null, "DB PE-5: the pattern broke out upward");
  const p6 = dA.map((b, k) => k >= 24 ? { time: b.time, ...[[98.5,98.6,95.0,95.4],[95.4,95.6,92.0,92.3],[92.3,92.5,89.5,89.8],[89.8,90.0,88.0,88.3],[88.3,88.5,87.0,87.2]][k - 24].reduce((o, v, i) => ({ ...o, [["open","high","low","close"][i]]: v }), {}) } : b);
  assert(first(p6, "PE") === null, "DB PE-6: already broke out on candle 22");
  assert(first(dB, "PE", { ...cfg, minDepthAtr: 6.0 }) === null && first(dB, "PE", { ...cfg, maxWait: 5 }) === null, "DB PE-7, PE-8");
  const rB = N.runDay({ bars: dB, levels: [], atrFixed: ATR, rules: ["double bottom"] });
  assert(rB.trades.length === 1 && rB.trades[0].side === "PE" && rB.trades[0].entry === 88.5 && rB.trades[0].entryTime === dB[24].time, "DB PE-1 entry at 88.5: " + JSON.stringify(rB.trades[0]));
  console.log("New Rule Chart: the double bottom matches its document's cases (CE-1 to CE-15, PE-1 to PE-8)");
}
// ---- The triple top (the owner's "Triple Top Chart Pattern" document): Appendix A (the breakdown, Buy PE) and B (the failure, Buy CE)
{
  const A = [[90.0,91.6,89.6,91.2],[91.2,93.0,90.8,92.7],[92.7,94.4,92.3,94.1],[94.1,95.9,93.8,95.6],[95.6,97.3,95.2,97.0],[97.0,98.8,96.6,98.5],[98.5,100.2,98.1,99.9],[99.9,100.8,99.0,99.3],[99.3,99.6,97.6,97.9],[97.9,98.2,96.2,96.5],[96.5,96.8,94.9,95.2],[95.2,95.5,94.0,94.4],[94.4,95.8,94.2,95.5],[95.5,97.0,95.2,96.8],[96.8,98.3,96.5,98.1],[98.1,99.4,97.8,99.2],[99.2,100.3,98.9,100.0],[100.0,100.6,99.2,99.5],[99.5,99.8,98.0,98.3],[98.3,98.6,96.7,97.0],[97.0,97.3,95.4,95.7],[95.7,96.0,94.3,94.6],[94.6,96.0,94.4,95.8],[95.8,97.3,95.5,97.1],[97.1,98.6,96.8,98.4],[98.4,99.7,98.1,99.5],[99.5,100.4,99.2,100.1],[100.1,100.7,99.3,99.6],[99.6,99.9,98.1,98.4],[98.4,98.7,96.8,97.1],[97.1,97.4,95.5,95.8],[95.8,96.1,94.5,94.8],[94.8,95.1,93.0,93.3],[93.3,93.9,92.6,93.6],[93.6,93.8,91.8,92.1],[92.1,92.4,90.6,90.9],[90.9,91.2,89.5,89.8],[89.8,90.1,88.4,88.7]];
  const B = A.slice(0, 29).concat([[98.4,98.7,97.2,97.5],[97.5,98.9,97.3,98.7],[98.7,100.2,98.5,100.0],[100.0,101.8,99.8,101.5],[101.5,102.6,101.2,102.3],[102.3,103.5,102.0,103.2],[103.2,104.3,102.9,104.0],[104.0,105.1,103.7,104.8],[104.8,105.9,104.5,105.6]]);
  const mk = rows => rows.map((r, i) => ({ time: t0 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
  const dA = mk(A), dB = mk(B);
  const tt = (bars, k, side, c = cfg) => N.detectTripleTop(bars, k, side, ATR, c);
  const first = (bars, side, c = cfg) => { for (let k = 0; k < bars.length; k++) { const s = tt(bars, k, side, c); if (s) return s; } return null; };
  const fires = (bars, side, c = cfg) => bars.map((_, k) => tt(bars, k, side, c) ? k : null).filter(k => k != null).join();
  const vary = (bars, i, r) => bars.map((b, k) => k === i ? { time: b.time, open: r[0], high: r[1], low: r[2], close: r[3] } : b);
  const p1 = tt(dA, 32, "PE");
  assert(p1 && p1.t1 === 7 && p1.t2 === 17 && p1.t3 === 27 && p1.neckline === 94 && p1.resistance === 100.8 && p1.height === 6.8 && p1.target === 87.2, "TT PE-1: " + JSON.stringify(p1));
  assert(fires(dA, "PE") === "32", "TT PE-2: " + fires(dA, "PE"));
  assert(first(vary(dA, 17, [100.0, 102.0, 99.2, 99.5]), "PE") === null, "TT PE-3");
  assert(first(dA, "PE", { ...cfg, minGap: 11 }) === null && first(dA, "PE", { ...cfg, maxGap: 9 }) === null, "TT PE-4, PE-5");
  assert(first(dA, "PE", { ...cfg, minDepthAtr: 5.0 }) === null && first(dA, "PE", { ...cfg, priorMoveAtr: 8.0 }) === null, "TT PE-6, PE-7");
  assert(first(vary(dA, 23, [95.8, 101.5, 95.5, 101.2]), "PE") === null, "TT PE-8");
  const p9 = vary(dA, 32, [94.8, 95.1, 93.0, 93.8]); assert(tt(p9, 32, "PE") === null && tt(p9, 33, "PE") !== null, "TT PE-9");
  const p10 = vary(dA, 32, [94.8, 95.1, 93.0, 94.3]); assert(tt(p10, 32, "PE") === null && tt(p10, 33, "PE") !== null, "TT PE-10");
  assert(fires(vary(dA, 32, [94.8, 95.1, 90.5, 90.8]), "PE") === "", "TT PE-11");
  assert(first(dA, "PE", { ...cfg, maxWait: 4 }) === null, "TT PE-12");
  const p13 = vary(vary(dA, 29, [98.4, 98.7, 93.0, 93.3]), 30, [93.3, 93.6, 92.8, 93.1]); assert(fires(p13, "PE") === "30", "TT PE-13: " + fires(p13, "PE"));
  assert(first(dB, "PE") === null, "TT PE-14: the neckline is never broken");
  const r15 = N.runDay({ bars: dA.map((b, k) => ({ ...b, time: 1792381500 + 300 + (k - 32) * 300 })), levels: [], atrFixed: ATR, rules: ["triple top"] });
  assert(r15.trades.length === 0 && r15.skipped.some(s => s.why === "outside entry window"), "TT PE-15");
  const rA = N.runDay({ bars: dA, levels: [], atrFixed: ATR, rules: ["triple top"] });
  assert(rA.trades.length === 1 && rA.trades[0].side === "PE" && rA.trades[0].entry === 93.3 && rA.trades[0].L === 94, "TT PE-1 entry at 93.3: " + JSON.stringify(rA.trades[0]));
  const c1 = tt(dB, 32, "CE");
  assert(c1 && c1.resistance === 100.8 && c1.neckline === 94 && c1.height === 6.8 && c1.target === 107.6 && c1.L === 100.8, "TT CE-1: " + JSON.stringify(c1));
  assert(fires(dB, "CE") === "32", "TT CE-2: " + fires(dB, "CE"));
  const c3 = vary(dB, 32, [100.0, 101.8, 99.8, 101.0]); assert(tt(c3, 32, "CE") === null && tt(c3, 33, "CE") !== null, "TT CE-3");
  assert(fires(vary(dB, 32, [100.0, 104.2, 99.8, 104.0]), "CE") === "", "TT CE-4");
  assert(first(dA, "CE") === null, "TT CE-5: the pattern broke down");
  const c6 = dA.map((b, k) => k >= 33 && k <= 37 ? { time: b.time, ...[[93.3,96.0,93.0,95.8],[95.8,98.5,95.5,98.3],[98.3,100.6,98.0,100.4],[100.4,101.9,100.2,101.6],[101.6,102.5,101.3,102.2]][k - 33].reduce((o, v, i) => ({ ...o, [["open","high","low","close"][i]]: v }), {}) } : b);
  assert(first(c6, "CE") === null, "TT CE-6: already broke down on candle 32");
  assert(first(dB, "CE", { ...cfg, minDepthAtr: 5.0 }) === null && first(dB, "CE", { ...cfg, maxWait: 4 }) === null, "TT CE-7, CE-8");
  const rB = N.runDay({ bars: dB, levels: [], atrFixed: ATR, rules: ["triple top"] });
  assert(rB.trades.length === 1 && rB.trades[0].side === "CE" && rB.trades[0].entry === 101.5, "TT CE-1 entry at 101.5: " + JSON.stringify(rB.trades[0]));
  console.log("New Rule Chart: the triple top matches its document's cases (PE-1 to PE-15, CE-1 to CE-8)");
}
