// The New Rule Chart engine (static/newrule.js) against the owner's chart pattern documents' test cases. Run: node lab/newrule-check.js
"use strict";
const path = require("path");
require(path.join(__dirname, "..", "static", "newrule.js")); const N = globalThis.NewRule;
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const rows = [[22640,22645,22625,22630],[22630,22632,22610,22615],[22615,22618,22600,22605],[22605,22640,22603,22635],[22635,22680,22630,22675],[22675,22720,22670,22715],[22715,22760,22710,22755],[22755,22800,22750,22790],[22790,22795,22760,22765],[22765,22770,22730,22735],[22735,22740,22700,22705],[22705,22710,22680,22688],[22688,22694,22682,22690],[22690,22702,22686,22698],[22698,22730,22695,22725],[22725,22760,22720,22755],[22755,22790,22750,22785],[22785,22815,22780,22810],[22810,22860,22805,22858],[22858,22865,22820,22825],[22825,22830,22790,22795]];
const ce = rows.map((r, i) => ({ time: 1792381500 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
// T11 of document 02: previous ATR 30, a candle high 24,420 low 24,400 after a close of 24,400: true range 20, new ATR 410 / 14 = 29.29
assert(N.round2(N.atrStep(30, 20)) === 29.29, "T11: " + N.atrStep(30, 20));
// the ATR series: seeded by the simple average of the first 14 true ranges, then Wilder
const tr = (b, p) => p == null ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - p), Math.abs(b.low - p));
const trs = ce.map((b, i) => tr(b, i ? ce[i - 1].close : null)), seed = trs.slice(0, 14).reduce((s, x) => s + x, 0) / 14;
const series = N.atrSeries(ce);
assert(series[12] === null && Math.abs(series[13] - seed) < 1e-9 && Math.abs(series[14] - (seed * 13 + trs[14]) / 14) < 1e-9, "ATR seed and step");
console.log("New Rule Chart: the ATR(14) matches the document (T11, the seed and the step)");

// ---- The double top / double bottom rule (the owner's "Trading Rules Specification", 21 October): Appendix A data, ATR fixed at 1.5,
// the buffer 0.25 x ATR = 0.375; E1 to E15 and E19
const A = [[90.0,92.0,89.5,91.5],[91.5,93.5,91.0,93.0],[93.0,95.0,92.5,94.5],[94.5,96.5,94.0,96.0],[96.0,98.0,95.5,97.5],[97.5,99.5,97.0,99.0],[99.0,100.6,98.5,99.8],[99.8,100.8,98.8,99.2],[99.2,99.5,97.0,97.5],[97.5,98.0,95.5,96.0],[96.0,96.5,93.5,94.0],[94.0,94.5,92.0,92.6],[92.6,93.8,91.8,93.4],[93.4,95.4,93.0,95.0],[95.0,97.0,94.6,96.6],[96.6,98.4,96.2,98.0],[98.0,99.8,97.6,99.4],[99.4,100.7,98.9,99.5],[99.5,99.8,97.8,98.2],[98.2,98.6,96.0,96.5],[96.5,97.0,94.2,94.8],[94.8,95.2,92.8,93.2],[93.2,93.6,90.2,90.8],[90.8,92.2,90.0,91.8],[91.8,92.6,91.0,91.5],[91.5,91.8,89.0,89.5],[89.5,90.0,87.5,88.0],[88.0,88.4,86.0,86.5],[86.5,87.0,84.8,85.5]];
const t0 = 1792381500 + 3 * 300;  // 09:30 IST: every candle inside the entry window
const peD = A.map((r, i) => ({ time: t0 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
const ceD = peD.map(b => ({ time: b.time, open: 190 - b.open, high: 190 - b.low, low: 190 - b.high, close: 190 - b.close }));
// The documents' own cases run on the documents' settings: a swing is 3 candles on each side there (the page's double and triple
// tops and bottoms use 2 since 26 October, the owner's choice; the wedges, rectangles and triangles keep 3). DOC is the documents' DT
const DOC = { ...N.DT, swingN: 3 };
const ATR = 1.5, cfg = DOC;
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
const rDefault = N.runDay({ cfg: DOC, bars: ceD, atrFixed: ATR });  // the page's rules: the double top (Buy PE only), the double bottom, the triple top
assert(rDefault.trades.length === 1 && rDefault.trades[0].rule === "double bottom" && rDefault.trades[0].side === "CE" && rDefault.trades[0].entry === 99.2, "the CE data: the double bottom rule's Buy CE, the double top's mirror off: " + JSON.stringify(rDefault.trades.map(t => [t.rule, t.side, t.entry])));
const r1 = N.runDay({ cfg: DOC, bars: peD, atrFixed: ATR, rules: ["double top"] });
assert(r1.trades.length === 1 && r1.trades[0].side === "PE" && r1.trades[0].entry === 90.8 && r1.trades[0].entryTime === peD[23].time, "E1 entry: " + JSON.stringify(r1.trades[0]));
assert(r1.trades[0].how === "day end" && r1.trades[0].exit === 85.5 && r1.trades[0].points === 5.3, "E1 run to the day end: " + JSON.stringify(r1.trades[0]));
const r13 = N.runDay({ cfg: DOC, bars: ceD, atrFixed: ATR, sides: ["CE"], rules: ["double top"] });  // the double top document's own mirror, asked for by name (the page runs the double bottom document instead)
assert(r13.trades.length === 1 && r13.trades[0].side === "CE" && r13.trades[0].entry === 99.2, "E13 entry: " + JSON.stringify(r13.trades[0]));
// E16: the signal candle closing at 09:25: the entry at 09:25 is before 09:30: skipped, "outside entry window"
const early = peD.map((b, k) => ({ ...b, time: 1792381500 + 300 + (k - 22) * 300 }));  // candle 22 at 09:20, closing at 09:25: the entry candle opens at 09:25
const r16 = N.runDay({ cfg: DOC, bars: early, atrFixed: ATR, rules: ["double top"] });
assert(r16.trades.length === 0 && r16.skipped.some(s => s.why === "outside entry window"), "E16: " + JSON.stringify(r16.skipped));
// E17: the daily limit already reached; E18: a trade already open is covered by one trade at a time (runDay opens one at a time by construction)
assert(N.runDay({ bars: peD, atrFixed: ATR, rules: ["double top"], cfg: { ...cfg, maxTradesPerDay: 0 } }).skipped.some(s => s.why === "daily limit"), "E17: daily limit");
// Rule 1, Exit B: C2 opens below C1's close and its high reaches C1's open: closed at C2's close (the retouch)
const b2 = peD.map((b, k) => k === 23 ? { time: b.time, open: 90.5, high: 93.3, low: 90.0, close: 91.8 } : b);
const r2 = N.runDay({ cfg: DOC, bars: b2, atrFixed: ATR, rules: ["double top"] });
assert(r2.trades[0].how === "retouch" && r2.trades[0].exitTime === b2[23].time, "Rule 1 Exit B: " + JSON.stringify(r2.trades[0]));
// Rule 1, Exit A: a candle closes back above the neckline (91.8)
const a2 = peD.map((b, k) => k === 24 ? { time: b.time, open: 91.8, high: 92.6, low: 91.0, close: 92.0 } : b);
assert(N.runDay({ cfg: DOC, bars: a2, atrFixed: ATR, rules: ["double top"] }).trades[0].how === "reclaim", "Rule 1 Exit A: reclaim");
console.log("New Rule Chart: the double top rule and Rule 1 match the document's cases (E1 to E19)");


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
  const r15 = N.runDay({ cfg: DOC, bars: dA.map((b, k) => ({ ...b, time: 1792381500 + 300 + (k - 22) * 300 })), atrFixed: ATR, rules: ["double bottom"] });
  assert(r15.trades.length === 0 && r15.skipped.some(s => s.why === "outside entry window"), "DB CE-15");
  const rA = N.runDay({ cfg: DOC, bars: dA, atrFixed: ATR, rules: ["double bottom"] });
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
  const rB = N.runDay({ cfg: DOC, bars: dB, atrFixed: ATR, rules: ["double bottom"] });
  assert(rB.trades.length === 1 && rB.trades[0].side === "PE" && rB.trades[0].entry === 88.5 && rB.trades[0].entryTime === dB[24].time, "DB PE-1 entry at 88.5: " + JSON.stringify(rB.trades[0]));
  console.log("New Rule Chart: the double bottom matches its document's cases (CE-1 to CE-15, PE-1 to PE-8)");

  // ---- Version 2 of the Double Bottom document (24 October; the Buy PE trigger 26 October), its own settings (DB_V2: a bottom 3
  // candles each side, 5 to 40 apart, within 0.60 ATR; Buy CE on the high above the neckline by 0.10 x ATR = 0.15, Buy PE on the low
  // below the support by 0.15, the chase check on the close): CE-17 to CE-24, PE-10 to PE-18, as double_bottom_reference.py runs them
  const V2 = N.DB_V2, V1 = N.DB_V1, V3 = N.DB_V3, CLOSE = { ceTrigger: "close", peTrigger: "close" };
  const at = (bars, side, c) => fires(bars, side, c);
  const wick = (hi, cl) => [96.8, hi, 96.3, cl];
  const ok = (got, want, msg) => assert(got === want, `${msg}: ${got} (want ${want})`);
  ok(at(vary(dA, 21, wick(98.5, 97.0)), "CE", V2), "21", "DB CE-17: a wick 0.3 above the neckline on 21 signals, the close below it");
  ok(at(vary(dA, 21, wick(98.5, 97.0)), "CE", { ...V2, ...CLOSE }), "22", "DB CE-18: the same on the close trigger");
  ok(at(vary(dA, 21, wick(98.3, 97.0)), "CE", V2), "22", "DB CE-19: a wick only 0.1 above, less than 0.15");
  ok(at(dA, "CE", V2), "22", "DB CE-20: the base data, the high trigger");
  ok(at(vary(dA, 17, [90.6, 91.1, 88.35, 90.5]), "CE", V2), "22", "DB CE-21: the bottoms 0.85 apart, within 0.90");
  ok(at(vary(dA, 17, [90.6, 91.1, 88.35, 90.5]), "CE", { ...V2, eqAtr: 0.5 }), "", "DB CE-22: the same, 0.5 ATR");
  ok(at(vary(dA, 17, [90.6, 91.1, 88.25, 90.5]), "CE", V2), "", "DB CE-23: the bottoms 0.95 apart");
  ok(at(vary(dA, 22, [96.8, 103.0, 96.4, 102.4]), "CE", V2), "", "DB CE-24: the close 4.2 above the neckline, the chase limit on the close");
  ok(at(vary(dB, 22, [92.4, 92.8, 88.9, 90.0]), "PE", V2), "22", "DB PE-10: a wick 0.3 below the support on 22");
  ok(at(vary(dB, 22, [92.4, 92.8, 88.9, 90.0]), "PE", { ...V2, peTrigger: "close" }), "23", "DB PE-11: the same on the close trigger");
  ok(at(vary(dB, 22, [92.4, 92.8, 89.1, 90.0]), "PE", V2), "23", "DB PE-12: a wick only 0.1 below");
  ok(at(dB, "PE", V2), "23", "DB PE-13: the base failed data, the low trigger");
  ok(at(vary(dB, 17, [90.6, 91.1, 88.4, 90.5]), "PE", V2), "23", "DB PE-14: the bottoms 0.8 apart");
  ok(at(vary(dB, 17, [90.6, 91.1, 88.4, 90.5]), "PE", { ...V2, eqAtr: 0.5 }), "", "DB PE-15: the same, 0.5 ATR");
  ok(at(vary(dB, 22, [92.4, 92.8, 85.0, 85.4]), "PE", V2), "", "DB PE-16: the close 3.8 below the support");
  const both = vary(dB, 22, [92.4, 99.0, 88.5, 94.0]);
  ok(at(both, "PE", V2) + "|" + at(both, "CE", V2), "|", "DB PE-17: one candle triggers both sides: no signal either way, none later");
  const first18 = vary(vary(dB, 22, [92.4, 92.8, 88.9, 90.0]), 23, [90.0, 99.5, 89.9, 99.0]);
  ok(at(first18, "PE", V2) + "|" + at(first18, "CE", V2), "22|", "DB PE-18: the Buy PE wick uses the pattern up, no Buy CE on 23");
  console.log("New Rule Chart: the double bottom's version 2 matches its document's cases (CE-17 to CE-24, PE-10 to PE-18)");

  // ---- Version 3 (27 October): DB_V3, a bottom 2 candles each side and 3 to 40 apart, nothing else changed: V3-1 to V3-11 on the compact
  // W of Appendix D (bottom 1 candle 12 at 88.0, bottom 2 candle 15 at 88.2, the neckline 92.0, the break on candle 18)
  const W = mk([[110.0,110.4,108.0,108.5],[108.5,109.0,106.5,107.0],[107.0,107.5,105.0,105.5],[105.5,106.0,103.5,104.0],[104.0,104.5,102.0,102.5],[102.5,103.0,100.5,101.0],[101.0,101.5,99.0,99.5],[99.5,100.0,97.5,98.0],[98.0,98.5,96.0,96.5],[96.5,97.0,94.5,95.0],[95.0,95.5,92.5,93.0],[93.0,93.4,90.5,91.0],[91.0,91.2,88.0,88.6],[88.6,90.5,88.4,90.2],[90.2,92.0,90.0,91.6],[91.6,91.8,88.2,89.0],[89.0,90.8,88.8,90.6],[90.6,92.0,90.2,91.8],[91.8,93.0,91.5,92.9]]);
  const WF = vary(W, 18, [91.8, 91.9, 87.5, 87.8]);
  ok(at(W, "CE", V3), "18", "V3-1: the compact W on version 3");
  const v31 = db(W, 18, "CE", V3); assert(v31.t1 === 12 && v31.t2 === 15 && v31.neckline === 92 && v31.support === 88 && v31.gap === 3, "V3-1 detail: " + JSON.stringify(v31));
  ok(at(W, "CE", V2), "", "V3-2: version 2"); ok(at(W, "CE", { ...V3, minGap: 5 }), "", "V3-3: swing 2, gap 5");
  ok(at(W, "CE", { ...V3, swingN: 3 }), "", "V3-4: gap 3, swing 3"); ok(at(W, "CE", { ...V3, minGap: 4 }), "", "V3-5: gap 4");
  ok(at(WF, "PE", V3), "18", "V3-6: the compact W broken down, Buy PE"); ok(at(WF, "PE", V2), "", "V3-7: the same on version 2");
  ok(at(dA, "CE", V3) + "|" + at(dB, "PE", V3), "22|23", "V3-8: the ordinary patterns of Appendix A and B unchanged");
  ok(at(dA, "CE", { ...V3, minGap: 10 }) + "|" + at(dA, "CE", { ...V3, minGap: 11 }), "22|", "V3-9: the gap limit still checked");
  ok(at(dA, "CE", { ...V3, minDepthAtr: 6.0 }), "", "V3-10: the depth not weakened");
  // V3-11, and every other 5-minute setting exactly the document's section 14 (FIVE_MIN of the reference code); version 2 differs in the two only
  const FIVE_MIN = { swingN: 2, minGap: 3, maxGap: 40, maxWait: 20, eqAtr: 0.60, minDepthAtr: 1.5, priorMoveAtr: 2.0, priorLookback: 20, maxChaseAtr: 2.0,
                     buffer: "ATR", atrMult: 0.25, fixedPoints: 0, ceTrigger: "high", highBufferAtr: 0.10, peTrigger: "low", lowBufferAtr: 0.10 };
  Object.entries(FIVE_MIN).forEach(([key, v]) => assert(V3[key] === v && V2[key] === (key === "swingN" ? 3 : key === "minGap" ? 5 : v), `V3-11: the setting ${key}: ${V3[key]} / ${V2[key]}`));
  assert(Object.keys(V3).filter(x => x !== "name").length === Object.keys(FIVE_MIN).length, "V3-11: no other setting");
  // the chase check ends the search, as the reference's "return None": a nearer pattern that closed too far past its neckline (95,
  // close 98.5, more than 3.0) hides an older one behind it (neckline 100, a wick to 100.5) on the same candle, both versions
  const two = mk([[110,110.5,108.5,109],[109,109.3,107,107.5],[107.5,107.8,105.5,106],[106,106.3,104,104.5],[104.5,104.8,102.5,103],[103,103.3,101,101.5],[101.5,101.8,99.5,100],[100,100.3,98,98.5],[98.5,98.8,96.5,97],[97,97.3,95,95.5],[95.5,95.8,93,93.5],[93.5,93.8,91.5,92],[92,92.3,90.0,90.8],[90.8,93,90.6,92.8],[92.8,96,92.5,95.8],[95.8,100,95.5,99.5],[99.5,99.8,96,96.5],[96.5,96.8,93,93.5],[93.5,93.8,91,91.5],[91.5,91.8,90.1,90.6],[90.6,93,90.4,92.7],[92.7,95,92.4,94.5],[94.5,94.8,92.5,93],[93,93.3,91,91.4],[91.4,91.6,90.05,90.9],[90.9,92,90.6,91.8],[91.8,93,91.5,92.8],[92.8,94.5,92.6,94.2],[94.2,100.5,94,98.5]]);
  assert(N.dbPatterns(two, 28, ATR, V2).map(q => q.b1).join() === "19,12", "two patterns at candle 28, the nearer first");
  ok(at(two, "CE", V2) + "|" + at(two, "CE", V3), "|", "the chase check ends the search: no signal from the older pattern");
  assert(N.DB.table === V2 && N.DB.shadow === V3, "the owner's choice of 27 October: version 2 in the table, version 3 in shadow");
  console.log("New Rule Chart: the double bottom's version 3 matches its document's cases (V3-1 to V3-11)");

  // ---- The real days of the document (RD-1 to RD-15): its NIFTY 50 candles (lab/double-bottom-v3.json; 26 October read from a chart
  // image), the ATR carried across days as the reference does (23 October warms up on 22 October's candles, 26 October on 23 October's)
  const REAL = require(path.join(__dirname, "double-bottom-v3.json"));
  const realDay = (rows, warm, c) => {
    const bars = rows.map(r => ({ time: 0, open: r[1], high: r[2], low: r[3], close: r[4] })), prev = (warm || []).map(r => ({ time: 0, open: r[1], high: r[2], low: r[3], close: r[4] }));
    const series = N.atrSeries(prev.concat(bars)), out = [];  // the ATR as of the candle before, across both days
    bars.forEach((_, k) => { const a = k + prev.length > 0 ? series[k + prev.length - 1] : null; if (a == null) return;
      ["CE", "PE"].forEach(side => { const s = N.detectDoubleBottom(bars, k, side, a, c); if (s) out.push(`${rows[k][0]} ${side} ${s.L.toFixed(1)} ${a.toFixed(1)}`); }); });
    return out.join(", ");
  };
  const R22 = REAL.REAL_22, R23 = REAL.REAL_23, R26 = REAL.REAL_26;
  const rd1 = realDay(R23, R22, V2), rd7 = realDay(R22, null, V2);
  ok(rd1, "12:40 PE 22409.6 30.9, 12:45 PE 22406.8 29.9, 13:30 CE 22444.1 28.3", "RD-1: 23 October, version 2");
  ok(realDay(R23, R22, V1), "12:45 PE 22406.8 29.9", "RD-2: 23 October, version 1");
  ok(realDay(R23, R22, { ...V2, eqAtr: 0.5 }), "12:40 PE 22409.6 30.9, 12:45 PE 22406.8 29.9", "RD-3: version 2, 0.5 ATR");
  ok(realDay(R23, R22, { ...V2, ceTrigger: "close" }), "12:40 PE 22409.6 30.9, 12:45 PE 22406.8 29.9", "RD-4: version 2, the close trigger");
  ok(realDay(R23, R22, { ...V2, highBufferAtr: 0.05 }), "11:15 CE 22518.9 42.1, 12:40 PE 22409.6 30.9, 12:45 PE 22406.8 29.9, 13:30 CE 22444.1 28.3", "RD-5: the high buffer 0.05");
  ok(realDay(R23, R22, { ...V2, highBufferAtr: 0.15 }), "12:40 PE 22409.6 30.9, 12:45 PE 22406.8 29.9", "RD-6: the high buffer 0.15");
  ok(rd7 + "|" + realDay(R22, null, V1), "14:30 CE 22657.2 29.6|14:30 CE 22657.2 29.6", "RD-7: 22 October, versions 2 and 1");
  [0.55, 0.65, 0.70].forEach(q => ok(realDay(R23, R22, { ...V2, eqAtr: q }) + "|" + realDay(R22, null, { ...V2, eqAtr: q }), rd1 + "|" + rd7, `RD-8: ${q} ATR`));
  ok(realDay(R23, R22, { ...V2, peTrigger: "close" }) + "|" + realDay(R22, null, { ...V2, peTrigger: "close" }), "12:45 PE 22409.6 29.9, 13:30 CE 22444.1 28.3|14:30 CE 22657.2 29.6", "RD-9: the Buy PE on the close");
  ok(realDay(R23, R22, { ...V2, lowBufferAtr: 0.05 }) + "|" + realDay(R22, null, { ...V2, lowBufferAtr: 0.05 }), rd1 + "|12:15 PE 22587.4 38.8, 14:30 CE 22657.2 29.6", "RD-10: the low buffer 0.05");
  ok(realDay(R23, R22, { ...V2, lowBufferAtr: 0.15 }) + "|" + realDay(R22, null, { ...V2, lowBufferAtr: 0.15 }), "12:45 PE 22409.6 29.9, 13:30 CE 22444.1 28.3|14:30 CE 22657.2 29.6", "RD-11: the low buffer 0.15");
  ok(realDay(R26, R23, V3), "09:50 CE 22487.0 48.2, 13:15 CE 22636.8 33.0, 15:10 CE 22718.1 26.6", "RD-12: 26 October, version 3");
  ok(realDay(R26, R23, V2), "13:15 CE 22636.8 33.0, 15:25 CE 22718.1 22.3", "RD-13: 26 October, version 2");
  ok(realDay(R22, null, V3) + "|" + realDay(R23, R22, V3), rd7 + "|" + rd1, "RD-14: 22 and 23 October, version 3 = version 2");
  ok(realDay(R26, R23, { ...V3, minDepthAtr: 0.75 }) + "|" + realDay(R22, null, { ...V3, minDepthAtr: 0.75 }),
     "09:50 CE 22487.0 48.2, 12:00 CE 22581.2 42.4, 13:15 CE 22636.8 33.0, 15:10 CE 22718.1 26.6|13:55 CE 22642.1 35.0, 14:30 CE 22657.2 29.6, 14:35 CE 22651.7 31.1", "RD-15: version 3 with the depth 0.75 (not used)");
  console.log("New Rule Chart: the double bottom matches its document's real days (RD-1 to RD-15)");

  // ---- The shadow log (the brief, section 6) on 26 October (the document's candles, times from 09:15 IST): version 2 in the table,
  // version 3 in shadow. The 09:50 W is version 3's alone (version 2 lacked both the gap and the swing); 13:15 is both versions'
  // and taken; the late one is both (version 3 at 15:10, version 2 at 15:25, the day's last candle), outside the entry window
  const base26 = Date.UTC(2026, 9, 26, 3, 45) / 1000, toBars = (rows, t0) => rows.map((r, i) => ({ time: t0 + i * 300, open: r[1], high: r[2], low: r[3], close: r[4] }));
  const d26 = toBars(R26, base26), d23 = toBars(R23, base26 - 3 * 86400);
  const run26 = N.runDay({ bars: d26, prevBars: d23, atrSeed: N.atrSeries(d23).slice(-1)[0], rules: ["double bottom"] });
  const lg = run26.dbLog, row = (v, hm) => lg.rows.find(r => r.version === v && N.istHM(r.signalTime) === hm);
  assert(lg.table === "V2" && lg.shadow === "V3", "the log's two versions");
  const w950 = row("V3", "09:50");
  assert(w950 && w950.tag === "V3 only" && w950.lacked === "both" && w950.side === "CE" && Math.abs(w950.L - 22487) < 0.01 && w950.gap === 3 && w950.order === "shadow, no order" && w950.inWindow && w950.entry === 22550.1,
         "the 09:50 W, version 3 only: " + JSON.stringify(w950));
  const t1315 = row("V2", "13:15"), s1315 = row("V3", "13:15");
  assert(t1315 && t1315.tag === "Both" && t1315.order === "taken" && s1315 && s1315.tag === "Both" && t1315.entry === 22648.6 && t1315.points === run26.trades.find(t => N.istHM(t.signalTime) === "13:15").points,
         "13:15, both versions, taken: " + JSON.stringify(t1315));
  const late2 = row("V2", "15:25"), late3 = row("V3", "15:10");
  assert(late2 && late3 && late2.tag === "Both" && N.istHM(late2.otherTime) === "15:10" && late2.order === "the day's last candle" && !late3.inWindow, "the late signal: " + JSON.stringify([late2, late3]));
  assert(lg.summary.table === 2 && lg.summary.shadow === 3 && lg.summary.shadowOnly === 1 && lg.summary.shadowOnlyPoints === w950.points, "the day's summary: " + JSON.stringify(lg.summary));
  assert(run26.trades.length === 1 && N.istHM(run26.trades[0].signalTime) === "13:15", "the table's trades: version 2's 13:15 only: " + JSON.stringify(run26.trades.map(t => N.istHM(t.signalTime))));
  // a day still going (dayEnd false, the 15:25 candle not closed): the 13:15 call is open, against the last price, nothing ends at the day end
  const live = N.runDay({ bars: d26.slice(0, 60), prevBars: d23, atrSeed: N.atrSeries(d23).slice(-1)[0], rules: ["double bottom"], closedCount: 59, dayEnd: false });
  const open1315 = live.dbLog.rows.find(r => r.version === "V2" && N.istHM(r.signalTime) === "13:15");
  assert(live.trades.length === 1 && live.trades[0].how !== "day end" && open1315 && open1315.order === "taken" && open1315.how === live.trades[0].how, "a day still going: " + JSON.stringify([live.trades[0].how, open1315 && open1315.how]));
  console.log("New Rule Chart: the double bottom's shadow log (26 October: the 09:50 W version 3's alone, 13:15 both and taken, the late one both)");
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
  const r15 = N.runDay({ cfg: DOC, bars: dA.map((b, k) => ({ ...b, time: 1792381500 + 300 + (k - 32) * 300 })), atrFixed: ATR, rules: ["triple top"] });
  assert(r15.trades.length === 0 && r15.skipped.some(s => s.why === "outside entry window"), "TT PE-15");
  const rA = N.runDay({ cfg: DOC, bars: dA, atrFixed: ATR, rules: ["triple top"] });
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
  const rB = N.runDay({ cfg: DOC, bars: dB, atrFixed: ATR, rules: ["triple top"] });
  assert(rB.trades.length === 1 && rB.trades[0].side === "CE" && rB.trades[0].entry === 101.5, "TT CE-1 entry at 101.5: " + JSON.stringify(rB.trades[0]));
  console.log("New Rule Chart: the triple top matches its document's cases (PE-1 to PE-15, CE-1 to CE-8)");
}

// ---- The triple bottom (the owner's "Triple Bottom Chart Pattern" document): Appendix A (the breakout, Buy CE) and B (the failure, Buy PE)
{
  const A = [[105.0,105.4,103.4,103.8],[103.8,104.2,102.0,102.3],[102.3,102.7,100.6,100.9],[100.9,101.2,99.1,99.4],[99.4,99.8,97.7,98.0],[98.0,98.4,96.2,96.5],[96.5,96.9,94.8,95.1],[95.1,96.0,94.2,95.7],[95.7,97.4,95.4,97.1],[97.1,98.8,96.8,98.5],[98.5,100.1,98.2,99.8],[99.8,101.0,99.5,100.6],[100.6,100.8,99.2,99.5],[99.5,99.8,98.0,98.2],[98.2,98.5,96.7,96.9],[96.9,97.2,95.6,95.8],[95.8,96.1,94.7,95.0],[95.0,95.8,94.4,95.5],[95.5,97.0,95.2,96.7],[96.7,98.3,96.4,98.0],[98.0,99.6,97.7,99.3],[99.3,100.7,99.0,100.4],[100.4,100.6,99.0,99.2],[99.2,99.5,97.7,97.9],[97.9,98.2,96.4,96.6],[96.6,96.9,95.3,95.5],[95.5,95.8,94.6,94.9],[94.9,95.7,94.3,95.4],[95.4,96.9,95.1,96.6],[96.6,98.2,96.3,97.9],[97.9,99.5,97.6,99.2],[99.2,100.5,98.9,100.2],[100.2,102.0,99.9,101.7],[101.7,102.4,101.1,101.4],[101.4,103.2,101.2,102.9],[102.9,104.4,102.6,104.1],[104.1,105.5,103.8,105.2],[105.2,106.6,104.9,106.3]];
  const B = A.slice(0, 29).concat([[96.6,97.8,96.3,97.5],[97.5,97.7,96.1,96.3],[96.3,96.5,94.8,95.0],[95.0,95.2,93.2,93.5],[93.5,93.8,92.4,92.7],[92.7,93.0,91.5,91.8],[91.8,92.1,90.7,91.0],[91.0,91.3,89.9,90.2],[90.2,90.5,89.1,89.4]]);
  const mk = rows => rows.map((r, i) => ({ time: t0 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
  const dA = mk(A), dB = mk(B);
  const tb = (bars, k, side, c = cfg) => N.detectTripleBottom(bars, k, side, ATR, c);
  const first = (bars, side, c = cfg) => { for (let k = 0; k < bars.length; k++) { const s = tb(bars, k, side, c); if (s) return s; } return null; };
  const fires = (bars, side, c = cfg) => bars.map((_, k) => tb(bars, k, side, c) ? k : null).filter(k => k != null).join();
  const vary = (bars, i, r) => bars.map((b, k) => k === i ? { time: b.time, open: r[0], high: r[1], low: r[2], close: r[3] } : b);
  const c1 = tb(dA, 32, "CE");
  assert(c1 && c1.t1 === 7 && c1.t2 === 17 && c1.t3 === 27 && c1.neckline === 101 && c1.support === 94.2 && c1.height === 6.8 && c1.target === 107.8 && c1.L === 101, "TB CE-1: " + JSON.stringify(c1));
  assert(fires(dA, "CE") === "32", "TB CE-2: " + fires(dA, "CE"));
  assert(first(vary(dA, 17, [95.0, 95.8, 93.0, 95.5]), "CE") === null, "TB CE-3");
  assert(first(dA, "CE", { ...cfg, minGap: 11 }) === null && first(dA, "CE", { ...cfg, maxGap: 9 }) === null, "TB CE-4, CE-5");
  assert(first(dA, "CE", { ...cfg, minDepthAtr: 5.0 }) === null && first(dA, "CE", { ...cfg, priorMoveAtr: 8.0 }) === null, "TB CE-6, CE-7");
  assert(first(vary(dA, 23, [99.2, 99.5, 93.5, 93.8]), "CE") === null, "TB CE-8");
  const c9 = vary(dA, 32, [100.2, 102.0, 99.9, 101.2]); assert(tb(c9, 32, "CE") === null && tb(c9, 33, "CE") !== null, "TB CE-9");
  const c10 = vary(dA, 32, [100.2, 102.0, 99.9, 100.7]); assert(tb(c10, 32, "CE") === null && tb(c10, 33, "CE") !== null, "TB CE-10");
  assert(fires(vary(dA, 32, [100.2, 104.5, 99.9, 104.2]), "CE") === "", "TB CE-11");
  assert(first(dA, "CE", { ...cfg, maxWait: 4 }) === null, "TB CE-12");
  const c13 = vary(vary(dA, 29, [96.6, 102.0, 96.3, 101.7]), 30, [101.7, 102.2, 101.4, 101.9]); assert(fires(c13, "CE") === "30", "TB CE-13: " + fires(c13, "CE"));
  assert(first(dB, "CE") === null, "TB CE-14: the neckline is never broken");
  const r15 = N.runDay({ cfg: DOC, bars: dA.map((b, k) => ({ ...b, time: 1792381500 + 300 + (k - 32) * 300 })), atrFixed: ATR, rules: ["triple bottom"] });
  assert(r15.trades.length === 0 && r15.skipped.some(s => s.why === "outside entry window"), "TB CE-15");
  const rA = N.runDay({ cfg: DOC, bars: dA, atrFixed: ATR, rules: ["triple bottom"] });
  assert(rA.trades.length === 1 && rA.trades[0].side === "CE" && rA.trades[0].entry === 101.7 && rA.trades[0].L === 101, "TB CE-1 entry at 101.7: " + JSON.stringify(rA.trades[0]));
  const p1 = tb(dB, 32, "PE");
  assert(p1 && p1.support === 94.2 && p1.neckline === 101 && p1.height === 6.8 && p1.target === 87.4 && p1.L === 94.2, "TB PE-1: " + JSON.stringify(p1));
  assert(fires(dB, "PE") === "32", "TB PE-2: " + fires(dB, "PE"));
  const p3 = vary(dB, 32, [95.0, 95.2, 93.2, 94.0]); assert(tb(p3, 32, "PE") === null && tb(p3, 33, "PE") !== null, "TB PE-3");
  assert(fires(vary(dB, 32, [95.0, 95.2, 90.8, 91.0]), "PE") === "", "TB PE-4");
  assert(first(dA, "PE") === null, "TB PE-5: the pattern broke out upward");
  const p6 = dA.map((b, k) => k >= 33 && k <= 37 ? { time: b.time, ...[[101.7,102.0,99.0,99.2],[99.2,99.5,96.5,96.7],[96.7,97.0,94.4,94.6],[94.6,94.8,93.1,93.4],[93.4,93.7,92.5,92.8]][k - 33].reduce((o, v, i) => ({ ...o, [["open","high","low","close"][i]]: v }), {}) } : b);
  assert(first(p6, "PE") === null, "TB PE-6: already broke out on candle 32");
  assert(first(dB, "PE", { ...cfg, minDepthAtr: 5.0 }) === null && first(dB, "PE", { ...cfg, maxWait: 4 }) === null, "TB PE-7, PE-8");
  const rB = N.runDay({ cfg: DOC, bars: dB, atrFixed: ATR, rules: ["triple bottom"] });
  assert(rB.trades.length === 1 && rB.trades[0].side === "PE" && rB.trades[0].entry === 93.5, "TB PE-1 entry at 93.5: " + JSON.stringify(rB.trades[0]));
  console.log("New Rule Chart: the triple bottom matches its document's cases (CE-1 to CE-15, PE-1 to PE-8)");
}

// ---- The falling wedge and the rising wedge (the owner's "Falling Wedge Chart Pattern" and "Rising Wedge Chart Pattern" documents):
// each document's Appendix A and B, ATR fixed at 1.5, the buffer 0.375; the scanner stepped candle by candle as the documents' reference
// code runs it. Falling: CE-1 to CE-13, PE-1 to PE-9; rising: PE-1 to PE-13, CE-1 to CE-9 (the 5-minute settings; the daily chart is not built)
{
  const FA = [[103.5,104.0,103.0,103.7],[103.7,104.6,103.5,104.4],[104.4,105.2,104.2,105.0],[105.0,105.6,104.7,105.4],[105.4,106.0,105.0,105.2],[105.2,105.3,104.0,104.2],[104.2,104.4,103.0,103.2],[103.2,103.5,102.1,102.3],[102.3,102.6,101.3,101.5],[101.5,101.8,100.7,100.9],[100.9,101.2,100.3,100.6],[100.6,101.0,100.0,100.7],[100.7,101.1,100.4,101.0],[101.0,101.3,100.8,101.2],[101.2,101.4,100.9,101.0],[101.0,101.5,100.8,101.4],[101.4,101.6,101.1,101.3],[101.3,101.7,101.1,101.6],[101.6,101.8,101.1,101.2],[101.2,101.4,100.4,100.6],[100.6,100.8,99.8,100.0],[100.0,100.2,99.1,99.3],[99.3,99.5,98.5,98.7],[98.7,99.0,98.0,98.2],[98.2,98.5,97.6,97.8],[97.8,98.1,97.2,97.9],[97.9,98.6,97.5,98.4],[98.4,99.1,98.1,98.8],[98.8,99.2,98.4,98.6],[98.6,99.4,98.5,99.2],[99.2,100.2,99.0,100.0],[100.0,101.0,99.7,100.8],[100.8,101.8,100.5,101.6],[101.6,102.6,101.2,102.4],[102.4,103.4,102.1,103.2],[103.2,104.1,102.8,103.9],[103.9,105.0,103.6,104.7],[104.7,105.6,104.3,105.4]];
  const FB = FA.slice(0, 29).concat([[98.6,98.7,97.4,97.6],[97.6,97.8,96.4,96.6],[96.6,96.8,95.2,95.4],[95.4,95.7,94.4,94.6],[94.6,94.9,93.6,93.8],[93.8,94.1,92.9,93.1],[93.1,93.4,92.2,92.4],[92.4,92.7,91.6,91.8],[91.8,92.1,91.0,91.2]]);
  const RA = [[96.5,97.0,96.0,96.3],[96.3,96.5,95.4,95.6],[95.6,95.8,94.8,95.0],[95.0,95.3,94.4,94.6],[94.6,95.0,94.0,94.8],[94.8,96.0,94.7,95.8],[95.8,97.0,95.6,96.8],[96.8,97.9,96.5,97.7],[97.7,98.7,97.4,98.5],[98.5,99.3,98.2,99.1],[99.1,99.7,98.8,99.4],[99.4,100.0,99.0,99.3],[99.3,99.6,98.9,99.0],[99.0,99.2,98.7,98.8],[98.8,99.1,98.6,99.0],[99.0,99.2,98.5,98.6],[98.6,98.9,98.4,98.7],[98.7,98.9,98.3,98.4],[98.4,98.9,98.2,98.8],[98.8,99.6,98.6,99.4],[99.4,100.2,99.2,100.0],[100.0,100.9,99.8,100.7],[100.7,101.5,100.5,101.3],[101.3,102.0,101.0,101.8],[101.8,102.4,101.5,102.2],[102.2,102.8,101.9,102.1],[102.1,102.5,101.4,101.6],[101.6,101.9,100.9,101.2],[101.2,101.6,100.8,101.4],[101.4,101.5,100.6,100.8],[100.8,101.0,99.8,100.0],[100.0,100.3,99.0,99.2],[99.2,99.5,98.2,98.4],[98.4,98.8,97.4,97.6],[97.6,97.9,96.6,96.8],[96.8,97.2,95.9,96.1],[96.1,96.4,95.0,95.3],[95.3,95.7,94.4,94.6]];
  const RB = RA.slice(0, 29).concat([[101.4,102.6,101.3,102.4],[102.4,103.6,102.2,103.4],[103.4,104.8,103.2,104.6],[104.6,105.6,104.3,105.4],[105.4,106.4,105.1,106.2],[106.2,107.1,105.9,106.9],[106.9,107.8,106.6,107.6],[107.6,108.4,107.3,108.2],[108.2,109.0,107.9,108.8]]);
  const mk = rows => rows.map((r, i) => ({ time: t0 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
  const fA = mk(FA), fB = mk(FB), rA = mk(RA), rB = mk(RB);
  const vary = (bars, i, r) => bars.map((b, k) => k === i ? { time: b.time, open: r[0], high: r[1], low: r[2], close: r[3] } : b);
  const wcfg = (o) => ({ ...cfg, wedge: o });
  // the scanner over every candle: the signals (with their candle) and the skips, as the reference code runs it
  const scan = (bars, shape, c = cfg) => { const st = { active: null, used: new Set() }, out = [], skipped = []; for (let k = 0; k < bars.length; k++) { const s = N.wedgeStep(st, bars, k, shape, ATR, c, skipped); if (s) out.push(s); } return { out, skipped, fires: out.map(s => s.signalCandle).join() }; };
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  // falling wedge, CE-1: the signal on candle 29; High 1 candle 4 (106.0), High 2 candle 18 (101.8), slope -0.3; Low 1 candle 11 (100.0), Low 2
  // candle 25 (97.2), slope -0.2; locked on candle 28; break level 98.5, widest width 4.6, target 103.1; Buy CE at candle 30's open, 99.2
  const c1 = scan(fA, "falling");
  assert(c1.fires === "29", "FW CE-1, CE-2: only candle 29 signals: " + c1.fires);
  const s1 = c1.out[0];
  assert(s1.side === "CE" && s1.rule === "falling wedge" && s1.kind === "falling wedge broke out" && s1.h1 === 4 && s1.h2 === 18 && s1.l1 === 11 && s1.l2 === 25 && near(s1.su, -0.3) && near(s1.sl, -0.2)
    && s1.lockTime === fA[28].time && s1.L === 98.5 && s1.width === 4.6 && s1.target === 103.1, "FW CE-1: " + JSON.stringify(s1));
  const w1 = N.wedgeAt(fA, 28, "falling", ATR); assert(w1 && near(w1.apex, 50) && w1.first === 4 && w1.last === 25 && near(w1.upper(29), 98.5) && near(w1.lower(29), 96.4), "FW section 6: apex 50, upper(29) 98.5, lower(29) 96.4");
  assert(N.wedgeAt(fA, 27, "falling", ATR) === null, "FW: Low 2 is confirmed on candle 28, not before");
  assert(scan(vary(fA, 18, [101.6, 103.2, 101.1, 101.2]), "falling").fires === "", "FW CE-3: parallel lines");
  assert(scan(fA, "falling", wcfg({ minNarrowing: 0.5 })).fires === "", "FW CE-4: narrowing 54%, not 50%");
  assert(scan(fA, "falling", wcfg({ minWidthAtr: 4.0 })).fires === "", "FW CE-5: width 4.6 under 6.0");
  assert(scan(fA, "falling", wcfg({ minLen: 25 })).fires === "", "FW CE-6: 21 candles long");
  assert(scan(vary(fA, 22, [99.3, 99.5, 97.3, 97.4]), "falling").fires === "", "FW CE-7: a close below the lower line while forming");
  const c8 = scan(vary(fA, 29, [98.6, 99.4, 98.5, 98.7]), "falling"); assert(c8.fires === "30" && near(c8.out[0].L, 98.2), "FW CE-8: no signal on 29, the signal on 30 (upper line 98.2): " + c8.fires);
  const c9 = scan(vary(fA, 29, [98.6, 102.0, 98.5, 101.8]), "falling"); assert(c9.fires === "" && c9.skipped.length === 1 && c9.skipped[0].why === "too far past the line", "FW CE-9: 3.3 past the line, the wedge used up");
  assert(scan(fA, "falling", wcfg({ maxWait: 3 })).fires === "", "FW CE-10: the break 4 candles after the last touch");
  const c11 = scan(vary(vary(fA, 27, [98.4, 100.0, 98.1, 99.8]), 28, [99.8, 100.2, 99.4, 99.9]), "falling"); assert(c11.fires === "28" && near(c11.out[0].L, 98.8), "FW CE-11: the lock candle is the signal (upper line 98.8): " + c11.fires);
  assert(scan(fB, "falling").out.every(s => s.side !== "CE"), "FW CE-12: the upper line is never broken on the B data");
  const c13 = N.runDay({ bars: fA.map((b, k) => ({ ...b, time: 1792381500 + 300 + (k - 29) * 300 })), atrFixed: ATR, rules: ["falling wedge"] });
  assert(c13.trades.length === 0 && c13.skipped.some(s => s.why === "outside entry window"), "FW CE-13: " + JSON.stringify(c13.skipped));
  const rfA = N.runDay({ bars: fA, atrFixed: ATR, rules: ["falling wedge"] });
  assert(rfA.trades.length === 1 && rfA.trades[0].side === "CE" && rfA.trades[0].entry === 99.2 && rfA.trades[0].entryTime === fA[30].time && rfA.trades[0].L === 98.5, "FW CE-1 entry at 99.2: " + JSON.stringify(rfA.trades[0]));
  // falling wedge, PE-1: the B data, the signal on candle 31 (lower line 96.0), break level 96.0, target 91.4; Buy PE at candle 32's open, 95.4
  const p1 = scan(fB, "falling");
  assert(p1.fires === "31" && p1.out[0].side === "PE" && p1.out[0].kind === "falling wedge failed" && p1.out[0].L === 96 && p1.out[0].target === 91.4 && p1.out[0].width === 4.6, "FW PE-1, PE-2: " + p1.fires + " " + JSON.stringify(p1.out[0]));
  const p3 = scan(vary(fB, 31, [96.6, 96.8, 95.2, 95.8]), "falling"); assert(p3.fires === "32" && near(p3.out[0].L, 95.8), "FW PE-3: no signal on 31, the signal on 32 (lower line 95.8): " + p3.fires);
  const p4 = scan(vary(fB, 31, [96.6, 96.8, 92.6, 92.8]), "falling"); assert(p4.fires === "" && p4.skipped.length === 1, "FW PE-4: 3.2 past the line, the wedge used up");
  assert(scan(fA, "falling").out.every(s => s.side !== "PE"), "FW PE-5: the A data broke out upward");
  const p6 = scan(vary(fA, 30, [99.2, 99.4, 95.4, 95.5]), "falling"); assert(p6.fires === "29" && p6.out[0].side === "CE", "FW PE-6: no PE on 30, the wedge already broke out on 29: " + p6.fires);
  assert(scan(fB, "falling", wcfg({ minWidthAtr: 4.0 })).fires === "" && scan(fB, "falling", wcfg({ maxWait: 5 })).fires === "", "FW PE-7, PE-8");
  const rfB = N.runDay({ bars: fB, atrFixed: ATR, rules: ["falling wedge"] });
  assert(rfB.trades.length === 1 && rfB.trades[0].side === "PE" && rfB.trades[0].entry === 95.4 && rfB.trades[0].entryTime === fB[32].time, "FW PE-1 entry at 95.4: " + JSON.stringify(rfB.trades[0]));
  // PE-9: a trade already open: the A data (its CE trade open to the day end), then the B data 10 points higher (a second wedge, the same
  // four touches 38 candles later): its PE signal while the CE trade is open is skipped, "one trade at a time"
  const two = FA.concat(FB.map(r => r.map(v => v + 10))).map((r, i) => ({ time: t0 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
  const r9 = N.runDay({ bars: two, atrFixed: ATR, rules: ["falling wedge"], cfg: { ...cfg, trailAtr: 1000 } });  // the first trade held to the day end: a trail too wide to be hit
  assert(r9.trades.length === 1 && r9.trades[0].side === "CE" && r9.trades[0].how === "day end" && r9.skipped.some(s => s.why === "one trade at a time" && s.side === "PE" && s.time === two[31 + 38].time), "FW PE-9: " + JSON.stringify([r9.trades.map(t => [t.side, t.how]), r9.skipped]));
  console.log("New Rule Chart: the falling wedge matches its document's cases (CE-1 to CE-13, PE-1 to PE-9)");
  // rising wedge, PE-1: the signal on candle 29; High 1 candle 11 (100.0), High 2 candle 25 (102.8), slope 0.2; Low 1 candle 4 (94.0), Low 2
  // candle 18 (98.2), slope 0.3; locked on candle 28; break level 101.5, widest width 4.6, target 96.9; Buy PE at candle 30's open, 100.8
  const q1 = scan(rA, "rising");
  assert(q1.fires === "29", "RW PE-1, PE-2: only candle 29 signals: " + q1.fires);
  const t1 = q1.out[0];
  assert(t1.side === "PE" && t1.rule === "rising wedge" && t1.kind === "rising wedge broke down" && t1.h1 === 11 && t1.h2 === 25 && t1.l1 === 4 && t1.l2 === 18 && near(t1.su, 0.2) && near(t1.sl, 0.3)
    && t1.lockTime === rA[28].time && t1.L === 101.5 && t1.width === 4.6 && t1.target === 96.9, "RW PE-1: " + JSON.stringify(t1));
  const v1 = N.wedgeAt(rA, 28, "rising", ATR); assert(v1 && near(v1.apex, 50) && near(v1.lower(29), 101.5) && near(v1.upper(29), 103.6), "RW section 6: apex 50, lower(29) 101.5, upper(29) 103.6");
  assert(scan(vary(rA, 18, [98.4, 98.9, 96.8, 98.8]), "rising").fires === "", "RW PE-3: parallel lines");
  assert(scan(rA, "rising", wcfg({ minNarrowing: 0.5 })).fires === "", "RW PE-4");
  assert(scan(rA, "rising", wcfg({ minWidthAtr: 4.0 })).fires === "", "RW PE-5");
  assert(scan(rA, "rising", wcfg({ minLen: 25 })).fires === "", "RW PE-6");
  assert(scan(vary(rA, 22, [100.7, 102.7, 100.5, 102.6]), "rising").fires === "", "RW PE-7: a close above the upper line while forming");
  const q8 = scan(vary(rA, 29, [101.4, 101.5, 100.6, 101.3]), "rising"); assert(q8.fires === "30" && near(q8.out[0].L, 101.8), "RW PE-8: the signal on 30 (lower line 101.8): " + q8.fires);
  const q9 = scan(vary(rA, 29, [101.4, 101.5, 98.0, 98.2]), "rising"); assert(q9.fires === "" && q9.skipped.length === 1, "RW PE-9: 3.3 past the line, the wedge used up");
  assert(scan(rA, "rising", wcfg({ maxWait: 3 })).fires === "", "RW PE-10");
  const q11 = scan(vary(vary(rA, 27, [101.6, 101.9, 100.0, 100.2]), 28, [100.2, 100.6, 99.8, 100.1]), "rising"); assert(q11.fires === "28" && near(q11.out[0].L, 101.2), "RW PE-11: the lock candle is the signal (lower line 101.2): " + q11.fires);
  assert(scan(rB, "rising").out.every(s => s.side !== "PE"), "RW PE-12: the lower line is never broken on the B data");
  const q13 = N.runDay({ bars: rA.map((b, k) => ({ ...b, time: 1792381500 + 300 + (k - 29) * 300 })), atrFixed: ATR, rules: ["rising wedge"] });
  assert(q13.trades.length === 0 && q13.skipped.some(s => s.why === "outside entry window"), "RW PE-13");
  const rrA = N.runDay({ bars: rA, atrFixed: ATR, rules: ["rising wedge"] });
  assert(rrA.trades.length === 1 && rrA.trades[0].side === "PE" && rrA.trades[0].entry === 100.8 && rrA.trades[0].entryTime === rA[30].time && rrA.trades[0].L === 101.5, "RW PE-1 entry at 100.8: " + JSON.stringify(rrA.trades[0]));
  // rising wedge, CE-1: the B data, the signal on candle 31 (upper line 104.0), break level 104.0, target 108.6; Buy CE at candle 32's open, 104.6
  const u1 = scan(rB, "rising");
  assert(u1.fires === "31" && u1.out[0].side === "CE" && u1.out[0].kind === "rising wedge failed" && u1.out[0].L === 104 && u1.out[0].target === 108.6, "RW CE-1, CE-2: " + u1.fires + " " + JSON.stringify(u1.out[0]));
  const u3 = scan(vary(rB, 31, [103.4, 104.8, 103.2, 104.2]), "rising"); assert(u3.fires === "32" && near(u3.out[0].L, 104.2), "RW CE-3: the signal on 32 (upper line 104.2): " + u3.fires);
  const u4 = scan(vary(rB, 31, [103.4, 107.4, 103.2, 107.2]), "rising"); assert(u4.fires === "" && u4.skipped.length === 1, "RW CE-4: 3.2 past the line, the wedge used up");
  assert(scan(rA, "rising").out.every(s => s.side !== "CE"), "RW CE-5: the A data broke down");
  const u6 = scan(vary(rA, 30, [100.8, 104.6, 100.6, 104.5]), "rising"); assert(u6.fires === "29" && u6.out[0].side === "PE", "RW CE-6: no CE on 30, the wedge already broke down on 29: " + u6.fires);
  assert(scan(rB, "rising", wcfg({ minWidthAtr: 4.0 })).fires === "" && scan(rB, "rising", wcfg({ maxWait: 5 })).fires === "", "RW CE-7, CE-8");
  const rrB = N.runDay({ bars: rB, atrFixed: ATR, rules: ["rising wedge"] });
  assert(rrB.trades.length === 1 && rrB.trades[0].side === "CE" && rrB.trades[0].entry === 104.6 && rrB.trades[0].entryTime === rB[32].time, "RW CE-1 entry at 104.6: " + JSON.stringify(rrB.trades[0]));
  const two2 = RA.concat(RB.map(r => r.map(v => v - 10))).map((r, i) => ({ time: t0 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));  // CE-9: the A data's PE trade open, the B data's CE signal skipped
  const u9 = N.runDay({ bars: two2, atrFixed: ATR, rules: ["rising wedge"], cfg: { ...cfg, trailAtr: 1000 } });
  assert(u9.trades.length === 1 && u9.trades[0].side === "PE" && u9.trades[0].how === "day end" && u9.skipped.some(s => s.why === "one trade at a time" && s.side === "CE"), "RW CE-9: " + JSON.stringify([u9.trades.map(t => [t.side, t.how]), u9.skipped]));
  // the mirror: the falling wedge rule on the rising wedge's data turned upside down gives the same signals with CE and PE swapped (the documents' note)
  const flip = bars => bars.map(b => ({ time: b.time, open: 200 - b.open, high: 200 - b.low, low: 200 - b.high, close: 200 - b.close }));
  const m1 = scan(flip(rA), "falling"), m2 = scan(flip(rB), "falling");
  assert(m1.fires === "29" && m1.out[0].side === "CE" && near(m1.out[0].L, 200 - 101.5) && m2.fires === "31" && m2.out[0].side === "PE" && near(m2.out[0].L, 200 - 104), "the falling wedge is the rising wedge upside down");
  console.log("New Rule Chart: the rising wedge matches its document's cases (PE-1 to PE-13, CE-1 to CE-9)");
}

// ---- The bullish rectangle (the owner's "Bullish Rectangle Chart Pattern" document): Appendix A (the breakout, Buy CE) and B (the failure, Buy PE)
{
  const A = [[89.0,90.2,88.6,90.0],[90.0,91.8,89.7,91.5],[91.5,93.4,91.2,93.1],[93.1,95.0,92.8,94.7],[94.7,96.6,94.4,96.3],[96.3,98.2,96.0,97.9],[97.9,99.5,97.6,99.2],[99.2,100.0,98.8,99.1],[99.1,99.4,98.0,98.2],[98.2,98.5,97.2,97.4],[97.4,97.7,96.5,96.7],[96.7,97.0,96.0,96.8],[96.8,97.8,96.6,97.6],[97.6,98.4,97.3,98.2],[98.2,99.0,97.9,98.8],[98.8,99.6,98.5,99.4],[99.4,99.9,99.0,99.6],[99.6,100.2,99.2,99.5],[99.5,99.7,98.6,98.8],[98.8,99.0,97.8,98.0],[98.0,98.2,97.1,97.3],[97.3,97.5,96.6,96.8],[96.8,97.2,96.2,97.0],[97.0,97.9,96.8,97.7],[97.7,98.6,97.5,98.4],[98.4,99.3,98.2,99.1],[99.1,99.9,98.9,99.7],[99.7,100.9,99.5,100.7],[100.7,101.6,100.5,101.4],[101.4,102.3,101.2,102.1],[102.1,103.0,101.9,102.8],[102.8,103.6,102.5,103.4],[103.4,104.2,103.1,104.0],[104.0,104.8,103.7,104.6],[104.6,105.3,104.3,105.1]];
  const B = A.slice(0, 26).concat([[99.1,99.6,98.6,98.8],[98.8,99.0,97.6,97.8],[97.8,98.0,96.6,96.8],[96.8,97.0,95.3,95.5],[95.5,95.8,94.4,94.6],[94.6,94.9,93.5,93.7],[93.7,94.0,92.6,92.8],[92.8,93.1,91.7,91.9],[91.9,92.2,90.8,91.0]]);
  const mk = rows => rows.map((r, i) => ({ time: t0 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
  const dA = mk(A), dB = mk(B);
  const vary = (bars, i, r) => bars.map((b, k) => k === i ? { time: b.time, open: r[0], high: r[1], low: r[2], close: r[3] } : b);
  const rcfg = (o) => ({ ...cfg, rect: o });
  const scan = (bars, c = cfg) => { const st = { active: null, used: new Set() }, out = [], skipped = []; for (let k = 0; k < bars.length; k++) { const s = N.SCANNERS["bullish rectangle"](st, bars, k, ATR, c, skipped); if (s) out.push(s); } return { out, skipped, fires: out.map(s => s.signalCandle).join() }; };
  const c1 = scan(dA), s1 = c1.out[0];
  assert(c1.fires === "27" && s1.side === "CE" && s1.kind === "bullish rectangle broke out" && s1.h1 === 7 && s1.h2 === 17 && s1.l1 === 11 && s1.l2 === 22 && s1.resistance === 100.2 && s1.support === 96 && s1.height === 4.2
    && s1.lockTime === dA[25].time && s1.L === 100.2 && s1.target === 104.4, "BR CE-1, CE-2: " + c1.fires + " " + JSON.stringify(s1));
  assert(N.round2(N.rectangleAt(dA, 25, ATR, cfg).priorRise) === 7.4 && N.rectangleAt(dA, 24, ATR, cfg) === null, "BR: the prior rise 7.4, Low 2 confirmed on 25");
  const rA = N.runDay({ bars: dA, atrFixed: ATR, rules: ["bullish rectangle"] });
  assert(rA.trades.length === 1 && rA.trades[0].side === "CE" && rA.trades[0].entry === 100.7 && rA.trades[0].entryTime === dA[28].time && rA.trades[0].L === 100.2, "BR CE-1 entry at 100.7: " + JSON.stringify(rA.trades[0]));
  assert(scan(vary(dA, 17, [99.6, 101.2, 99.2, 99.5])).fires === "", "BR CE-3: the highs 1.2 apart");
  assert(scan(dA, rcfg({ eqAtr: 0.1 })).fires === "" && scan(dA, rcfg({ minHeightAtr: 3.0 })).fires === "" && scan(dA, rcfg({ priorMoveAtr: 5.0 })).fires === "" && scan(dA, rcfg({ minLen: 16 })).fires === "", "BR CE-4 to CE-7");
  const c8 = scan(vary(dA, 27, [99.7, 100.9, 99.5, 100.5])); assert(c8.fires === "28", "BR CE-8: " + c8.fires);
  const c9 = scan(vary(dA, 27, [99.7, 103.4, 99.5, 103.3])); assert(c9.fires === "" && c9.skipped.length === 1 && c9.skipped[0].why === "too far past the line", "BR CE-9");
  assert(scan(dA, rcfg({ maxWait: 4 })).fires === "", "BR CE-10");
  const c11 = scan(vary(vary(dA, 24, [97.7, 100.9, 97.5, 100.7]), 25, [100.7, 101.2, 100.4, 100.9])); assert(c11.fires === "25" && c11.out[0].L === 100.2, "BR CE-11: the lock candle is the signal: " + c11.fires);
  assert(scan(dB).out.every(s => s.side !== "CE"), "BR CE-12: the resistance is never broken");
  const c13 = N.runDay({ bars: dA.map((b, k) => ({ ...b, time: 1792381500 + 300 + (k - 27) * 300 })), atrFixed: ATR, rules: ["bullish rectangle"] });
  assert(c13.trades.length === 0 && c13.skipped.some(s => s.why === "outside entry window"), "BR CE-13");
  const p1 = scan(dB), q1 = p1.out[0];
  assert(p1.fires === "29" && q1.side === "PE" && q1.kind === "bullish rectangle failed" && q1.L === 96 && q1.target === 91.8 && q1.support === 96, "BR PE-1, PE-2 (candle 26's new swing high gives no second signal): " + p1.fires + " " + JSON.stringify(q1));
  assert(N.rectangleAt(dB, 30, ATR, cfg) !== null && N.rectangleAt(dB, 30, ATR, cfg).h2 === 26, "BR PE-2: candle 26 is a new swing high on candle 29, a new set of touches over the same range (not locked: already broken)");
  const rB = N.runDay({ bars: dB, atrFixed: ATR, rules: ["bullish rectangle"] });
  assert(rB.trades.length === 1 && rB.trades[0].side === "PE" && rB.trades[0].entry === 95.5 && rB.trades[0].entryTime === dB[30].time, "BR PE-1 entry at 95.5: " + JSON.stringify(rB.trades[0]));
  const p3 = scan(vary(dB, 29, [96.8, 97.0, 95.3, 95.7])); assert(p3.fires === "30", "BR PE-3: " + p3.fires);
  const p4 = scan(vary(dB, 29, [96.8, 97.0, 92.7, 92.8])); assert(p4.fires === "" && p4.skipped.length === 1, "BR PE-4");
  assert(scan(dA).out.every(s => s.side !== "PE"), "BR PE-5: the rectangle broke out upward");
  const p6 = scan(vary(dA, 28, [100.7, 100.9, 95.4, 95.5])); assert(p6.fires === "27" && p6.out[0].side === "CE", "BR PE-6: no PE on 28, already broke out on 27: " + p6.fires);
  assert(scan(dB, rcfg({ minHeightAtr: 3.0 })).fires === "" && scan(dB, rcfg({ maxWait: 6 })).fires === "", "BR PE-7, PE-8");
  // PE-9: the A data (its CE trade open to the day end), then the B data 12 points higher (its closes stay above the first trade's L):
  // its Buy PE signal (candle 29 + 35) is skipped, one trade at a time. The day starts at 09:15 so both entries fall in the window
  const two = A.concat(B.map(r => r.map(v => Math.round((v + 12) * 10) / 10))).map((r, i) => ({ time: t0 - 900 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
  const p9 = N.runDay({ bars: two, atrFixed: ATR, rules: ["bullish rectangle"], cfg: { ...cfg, trailAtr: 1000 } });
  assert(p9.trades.length === 1 && p9.trades[0].side === "CE" && p9.trades[0].how === "day end" && p9.skipped.some(s => s.why === "one trade at a time" && s.side === "PE" && s.time === two[29 + 35].time), "BR PE-9: " + JSON.stringify([p9.trades.map(t => [t.side, t.how]), p9.skipped]));
  console.log("New Rule Chart: the bullish rectangle matches its document's cases (CE-1 to CE-13, PE-1 to PE-9)");
}

// ---- The ATR trail (22 October, the owner: "build the 1 ATR trail"): the stop starts on L; once a candle closes in profit it sits one ATR
// behind the best close, never moved back or loosened; sold at the close of the first candle closing past it. On the double top data
// (ATR fixed at 1.5): the Buy PE enters at candle 23's open, 90.8, L 91.8
{
  const atrCfg = { ...DOC, trailAtr: 1.0 };
  const run = (bars, c = atrCfg) => N.runDay({ bars, atrFixed: ATR, rules: ["double top"], cfg: c }).trades[0];
  const vary = (bars, i, r) => bars.map((b, k) => k === i ? { time: b.time, open: r[0], high: r[1], low: r[2], close: r[3] } : b);
  // the base data: candle 24 closes 91.5 (0.7 in profit, but 91.5 + 1.5 is above L: the stop stays 91.8, never loosened); 25 closes 89.5 (stop 91.0);
  // 26 closes 88.0 (stop 89.5); 27 closes 86.5 (stop 88.0); 28 is the day end: sold at 85.5, +5.3
  const t1 = run(peD);
  assert(t1.how === "day end" && t1.points === 5.3 && t1.stop === 88 && t1.stage === 2 && t1.best === 4.3, "ATR trail, the base day: " + JSON.stringify([t1.how, t1.points, t1.stop, t1.best]));
  // candle 27 closes back up at 90.5, past the stop of 89.5: sold there, "trail", +0.3
  const t2 = run(vary(peD, 27, [88.0, 90.8, 87.9, 90.5]));
  assert(t2.how === "trail" && t2.exit === 90.5 && t2.points === 0.3 && t2.exitTime === peD[27].time && t2.stop === 89.5, "ATR trail, sold on the close past the stop: " + JSON.stringify([t2.how, t2.exit, t2.points, t2.stop]));
  // candle 27 closes at 89.5 exactly, on the stop: not past it, held; the stop then stays 89.5 (89.5 + 1.5 is behind it)
  const t3 = run(vary(peD, 27, [88.0, 89.8, 87.9, 89.5]));
  assert(t3.how === "day end" && t3.stop === 89.5, "ATR trail, a close on the stop holds: " + JSON.stringify([t3.how, t3.stop]));
  // never in profit: candle 24 closes 92.0, back above L: the reclaim, as Rule 1
  const t4 = run(vary(peD, 24, [91.8, 92.6, 91.0, 92.0]));
  assert(t4.how === "reclaim" && t4.exit === 92 && t4.points === -1.2 && t4.stage === 1, "ATR trail, the reclaim before any profit: " + JSON.stringify([t4.how, t4.points]));
  // the retouch (Exit B) on the candle after the signal candle, as before
  const b2 = peD.map((b, k) => k === 23 ? { time: b.time, open: 90.5, high: 93.3, low: 90.0, close: 91.8 } : b);
  assert(run(b2).how === "retouch", "ATR trail, the retouch stays");
  // a wider trail (1.5 ATR = 2.25): candle 25's close 89.5 gives a stop of 91.75, 26's 88.0 one of 90.25
  const t5 = run(peD, { ...atrCfg, trailAtr: 1.5 });
  assert(t5.stop === 88.75 && t5.how === "day end", "ATR trail x1.5: " + JSON.stringify([t5.stop, t5.how]));
  // the page's setting, half an ATR (0.75): candle 24's close 91.5 gives a stop of 92.25, above L: stays 91.8; 25's 89.5 one of 90.25; 26's 88.0
  // one of 88.75; 27's 86.5 one of 87.25; the day end sells at 85.5
  assert(N.DT.trailAtr === 0.5, "the page trails half an ATR");
  const t7 = run(peD, { ...DOC });
  assert(t7.stop === 87.25 && t7.how === "day end" && t7.points === 5.3, "ATR trail x0.5: " + JSON.stringify([t7.stop, t7.how, t7.points]));
  // ...and candle 27 closing at 89.0, past the stop of 88.75 (one ATR would have held it, its stop at 89.5): sold, +1.8
  const t8 = run(vary(peD, 27, [88.0, 89.3, 87.9, 89.0]), { ...DOC });
  assert(t8.how === "trail" && t8.exit === 89 && t8.points === 1.8, "ATR trail x0.5 sells where x1 holds: " + JSON.stringify([t8.how, t8.exit, t8.points]));
  console.log("New Rule Chart: the ATR trail holds, moves one ATR behind the best close, never back, and sells on a close past it");
}

// ---- The four triangles (the owner's documents of 22 October evening: Bullish Symmetrical Triangle, Bearish Symmetrical Triangle,
// Ascending Triangle, Descending Triangle), each on its own Appendix data, ATR fixed at 1.5, the buffer 0.375; every 5-minute case
{
  const flip = rows => rows.map(r => [200 - r[0], 200 - r[2], 200 - r[1], 200 - r[3]].map(v => Math.round(v * 10) / 10));
  const BS_A = [[92.0,93.4,91.6,93.1],[93.1,94.9,92.8,94.6],[94.6,96.3,94.3,96.0],[96.0,97.8,95.7,97.5],[97.5,99.3,97.2,99.0],[99.0,101.0,98.7,100.7],[100.7,102.0,100.3,100.9],[100.9,101.2,99.4,99.6],[99.6,99.9,98.3,98.5],[98.5,98.8,97.5,97.7],[97.7,98.3,97.0,98.1],[98.1,98.9,97.8,98.7],[98.7,99.5,98.4,99.3],[99.3,100.0,99.0,99.8],[99.8,100.5,99.5,100.2],[100.2,100.8,99.9,100.5],[100.5,101.0,100.1,100.3],[100.3,100.6,99.4,99.6],[99.6,99.9,98.8,99.0],[99.0,99.3,98.3,98.5],[98.5,99.0,98.0,98.8],[98.8,99.5,98.5,99.3],[99.3,99.9,99.0,99.7],[99.7,100.2,99.4,100.0],[100.0,101.0,99.8,100.8],[100.8,101.7,100.6,101.5],[101.5,102.4,101.3,102.2],[102.2,103.1,102.0,102.9],[102.9,103.7,102.6,103.5],[103.5,104.3,103.2,104.1],[104.1,104.8,103.8,104.6],[104.6,105.3,104.3,105.1]];
  const BS_B = BS_A.slice(0, 24).concat([[100.0,100.2,99.2,99.4],[99.4,99.6,98.5,98.7],[98.7,98.9,97.9,98.0],[98.0,98.2,97.0,97.2],[97.2,97.4,96.2,96.4],[96.4,96.6,95.4,95.6],[95.6,95.8,94.6,94.8],[94.8,95.0,93.8,94.0]]);
  const BS_C = flip(BS_B);                                   // the bullish document's Appendix C: B upside down (not bullish)
  const BE_A = flip(BS_A), BE_B = flip(BS_B), BE_C = BS_B;   // the bearish document's A, B and C (C: its B upside down = the bullish B)
  assert(BE_A[24].join() === "100,100.2,99,99.2" && BE_B[26].join() === "101.3,102.1,101.1,102" && BS_C[0].join() === "108,108.4,106.6,106.9", "the documents' appendices are each other upside down");
  const AS_A = [[92.0,93.4,91.6,93.1],[93.1,94.9,92.8,94.6],[94.6,96.3,94.3,96.0],[96.0,97.8,95.7,97.5],[97.5,99.3,97.2,99.0],[99.0,101.0,98.7,100.7],[100.7,102.0,100.3,101.2],[101.2,101.5,99.8,100.0],[100.0,100.2,98.6,98.8],[98.8,99.1,97.6,97.8],[97.8,98.4,97.0,98.2],[98.2,99.2,97.9,99.0],[99.0,100.0,98.7,99.8],[99.8,100.8,99.5,100.6],[100.6,101.4,100.3,101.2],[101.2,101.8,100.9,101.5],[101.5,101.9,101.0,101.2],[101.2,101.4,100.4,100.6],[100.6,100.8,99.8,100.0],[100.0,100.2,99.3,99.5],[99.5,99.9,99.0,99.7],[99.7,100.6,99.5,100.4],[100.4,101.2,100.2,101.0],[101.0,101.7,100.8,101.5],[101.5,102.8,101.3,102.6],[102.6,103.4,102.4,103.2],[103.2,104.0,103.0,103.8],[103.8,104.6,103.6,104.4],[104.4,105.2,104.2,105.0],[105.0,105.8,104.8,105.6],[105.6,106.4,105.4,106.2],[106.2,107.0,106.0,106.8]];
  const AS_B = AS_A.slice(0, 24).concat([[101.5,101.8,100.6,100.8],[100.8,101.0,99.9,100.2],[100.2,100.3,99.3,99.5],[99.5,99.7,98.6,98.8],[98.8,99.0,97.9,98.1],[98.1,98.3,97.2,97.4],[97.4,97.6,96.5,96.7],[96.7,96.9,95.8,96.0]]);
  const DE_A = [[108.0,108.4,106.6,106.9],[106.9,107.2,105.1,105.4],[105.4,105.7,103.7,104.0],[104.0,104.3,102.2,102.5],[102.5,102.8,100.7,101.0],[101.0,101.3,99.0,99.3],[99.3,99.7,98.0,98.8],[98.8,100.2,98.5,100.0],[100.0,101.4,99.8,101.2],[101.2,102.4,100.9,102.2],[102.2,103.0,101.6,101.8],[101.8,102.1,100.8,101.0],[101.0,101.3,100.0,100.2],[100.2,100.5,99.2,99.4],[99.4,99.7,98.6,98.8],[98.8,99.1,98.2,98.5],[98.5,99.0,98.1,98.8],[98.8,99.6,98.6,99.4],[99.4,100.2,99.2,100.0],[100.0,100.7,99.8,100.5],[100.5,101.0,100.1,100.3],[100.3,100.5,99.4,99.6],[99.6,99.8,98.8,99.0],[99.0,99.2,98.3,98.5],[98.5,98.7,97.2,97.4],[97.4,97.6,96.6,96.8],[96.8,97.0,96.0,96.2],[96.2,96.4,95.4,95.6],[95.6,95.8,94.8,95.0],[95.0,95.2,94.2,94.4],[94.4,94.6,93.6,93.8],[93.8,94.0,93.0,93.2]];
  const DE_B = DE_A.slice(0, 24).concat([[98.5,99.4,98.2,99.2],[99.2,100.1,99.0,99.8],[99.8,100.7,99.7,100.5],[100.5,101.4,100.3,101.2],[101.2,102.1,101.0,101.9],[101.9,102.8,101.7,102.6],[102.6,103.5,102.4,103.3],[103.3,104.2,103.1,104.0]]);
  const mk = (rows, start = t0) => rows.map((r, i) => ({ time: start + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
  const vary = (bars, i, r) => bars.map((b, k) => k === i ? { time: b.time, open: r[0], high: r[1], low: r[2], close: r[3] } : b);
  const tcfg = (o) => ({ ...cfg, tri: o });
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const scan = (rule, bars, c = cfg) => { const st = { active: null, used: new Set(), lastDrop: null }, out = [], log = []; for (let k = 0; k < bars.length; k++) { const s = N.SCANNERS[rule](st, bars, k, ATR, c, log); if (s) out.push(s); } return { out, log, fires: out.map(s => s.signalCandle).join(), logged: (why) => log.filter(e => e.why.startsWith(why)).map(e => bars.findIndex(b => b.time === e.time)).join() }; };
  // the shape cases shared by the four documents (S-3 to S-6, S-9, F-1), each on its own data; then each document's own
  const shared = (rule, side, A, k1, L1) => {
    const dA = mk(A), r = scan(rule, dA), s = r.out[0];
    assert(r.fires === String(k1) && s.side === side && s.lockTime === dA[23].time && s.L === L1, `${rule} 1 and 2: ${r.fires} ${JSON.stringify(s)}`);
    assert(r.logged("locked") === "23" && r.logged("signal") === String(k1), `${rule}: LOCK on 23, SIGNAL on ${k1}: ` + JSON.stringify(r.log));
    assert(scan(rule, dA, tcfg({ minNarrowing: 0.6 })).fires === "" && scan(rule, dA, tcfg({ minWidthAtr: 4.0 })).fires === "" && scan(rule, dA, tcfg({ minLen: 15 })).fires === "", `${rule} S-3, S-4, S-5`);
    const s9 = scan(rule, dA, tcfg({ maxWait: 3 })); assert(s9.fires === "" && s9.logged("expired") === "24", `${rule} S-9: expired on 24: ` + s9.logged("expired"));
    const f1 = N.runDay({ bars: mk(A, 1792381500 + 300 - 24 * 300), atrFixed: ATR, rules: [rule] });
    assert(f1.trades.length === 0 && f1.skipped.some(e => e.why === "outside entry window"), `${rule} F-1`);
    const r1 = N.runDay({ bars: dA, atrFixed: ATR, rules: [rule] });
    assert(r1.trades.length === 1 && r1.trades[0].side === side && r1.trades[0].entryTime === dA[k1 + 1].time && r1.trades[0].entry === dA[k1 + 1].open, `${rule} entry at candle ${k1 + 1}'s open: ` + JSON.stringify(r1.trades[0]));
    return dA;
  };
  // F-2, one trade at a time: the A data (its trade held to the day end by a trail too wide to be hit), then the same data again shifted
  // in price (shift) so the first trade's L is never reclaimed: the second triangle's signal is skipped
  const f2 = (rule, side, A, shift, k1) => { const two = A.concat(A.map(r => r.map(v => Math.round((v + shift) * 10) / 10))).map((r, i) => ({ time: t0 - 900 + i * 300, open: r[0], high: r[1], low: r[2], close: r[3] }));
    const r = N.runDay({ bars: two, atrFixed: ATR, rules: [rule], cfg: { ...cfg, trailAtr: 1000 } });
    assert(r.trades.length === 1 && r.trades[0].side === side && r.trades[0].how === "day end" && r.skipped.some(e => e.why === "one trade at a time" && e.time === two[k1 + A.length].time), `${rule} F-2: ` + JSON.stringify([r.trades.map(t => [t.side, t.how]), r.skipped.filter(e => e.why === "one trade at a time")])); };

  // -- the bullish symmetrical triangle: Buy CE only
  { const R = "bullish symmetrical triangle", dA = shared(R, "CE", BS_A, 24, 100.2), dB = mk(BS_B), dC = mk(BS_C), s1 = scan(R, dA).out[0];
    assert(s1.h1 === 6 && s1.h2 === 16 && s1.l1 === 10 && s1.l2 === 20 && s1.rise === 7.7 && s1.fall === 1.7 && s1.width === 5.4 && s1.target === 105.6 && s1.kind === "bullish symmetrical triangle broke out", "BS CE-1: " + JSON.stringify(s1));
    assert(N.runDay({ bars: dA, atrFixed: ATR, rules: [R] }).trades[0].entry === 100.8, "BS CE-1 entry 100.8");
    const c3 = scan(R, dB); assert(c3.fires === "" && c3.logged("cancelled") === "26" && !N.runDay({ bars: dB, atrFixed: ATR, rules: [R] }).trades.length, "BS CE-3: cancelled on 26, no PE either: " + c3.logged("cancelled"));
    const c4 = scan(R, vary(dB, 27, [98.0, 100.6, 97.9, 100.5])); assert(c4.fires === "" && c4.logged("not locked") !== "", "BS CE-4: " + JSON.stringify(c4.log));
    const c5 = scan(R, dC); assert(c5.fires === "" && c5.logged("locked") === "", "BS CE-5: not bullish, never locked");
    const c6 = scan(R, vary(vary(dA, 24, [100.0, 100.1, 98.1, 98.2]), 25, [98.2, 101.7, 98.1, 101.5])); assert(c6.fires === "25" && near(c6.out[0].L, 100.1) && c6.out[0].target === 105.5, "BS CE-6: " + c6.fires);
    assert(scan(R, vary(dA, 16, [100.5, 102.0, 100.1, 100.3])).fires === "" && scan(R, vary(dA, 16, [100.5, 101.8, 100.1, 100.3])).fires === "", "BS S-1, S-2");
    assert(scan(R, dA, tcfg({ priorMoveAtr: 6.0 })).fires === "", "BS S-6");
    const s7 = scan(R, vary(dA, 24, [100.0, 101.0, 99.8, 100.5])); assert(s7.fires === "25" && near(s7.out[0].L, 100.1) && s7.out[0].target === 105.5, "BS S-7");
    const s8 = scan(R, vary(dA, 24, [100.0, 103.6, 99.8, 103.4])); assert(s8.fires === "" && s8.logged("too far") === "24", "BS S-8");
    const s10 = scan(R, vary(vary(dA, 22, [99.3, 101.1, 99.0, 100.9]), 23, [100.9, 101.3, 100.7, 101.1])); assert(s10.fires === "23" && near(s10.out[0].L, 100.3) && s10.out[0].target === 105.7, "BS S-10: " + s10.fires);
    const s11 = scan(R, mk(BS_A.slice(0, 24).concat(Array(10).fill([99.4, 99.6, 99.2, 99.3]), [[99.3, 101.2, 99.2, 101.0], [101.0, 101.8, 100.8, 101.6]]))); assert(s11.fires === "" && s11.logged("expired") === "33", "BS S-11: expired on 33: " + s11.logged("expired"));
    f2(R, "CE", BS_A, 10, 24);
    console.log("New Rule Chart: the bullish symmetrical triangle matches its document's cases (CE-1 to CE-6, S-1 to S-11, F-1, F-2)"); }
  // -- the bearish symmetrical triangle: Buy PE only
  { const R = "bearish symmetrical triangle", dA = shared(R, "PE", BE_A, 24, 99.8), dB = mk(BE_B), dC = mk(BE_C), s1 = scan(R, dA).out[0];
    assert(s1.h1 === 10 && s1.h2 === 20 && s1.l1 === 6 && s1.l2 === 16 && s1.fall === 7.7 && s1.rise === 1.7 && s1.width === 5.4 && s1.target === 94.4 && s1.kind === "bearish symmetrical triangle broke down", "BE PE-1: " + JSON.stringify(s1));
    assert(N.runDay({ bars: dA, atrFixed: ATR, rules: [R] }).trades[0].entry === 99.2, "BE PE-1 entry 99.2");
    const c3 = scan(R, dB); assert(c3.fires === "" && c3.logged("cancelled") === "26" && !N.runDay({ bars: dB, atrFixed: ATR, rules: [R] }).trades.length, "BE PE-3");
    const c4 = scan(R, vary(dB, 27, [102.0, 102.1, 99.4, 99.5])); assert(c4.fires === "" && c4.logged("not locked") !== "", "BE PE-4: " + JSON.stringify(c4.log));
    const c5 = scan(R, dC); assert(c5.fires === "" && c5.logged("locked") === "", "BE PE-5: not bearish, never locked");
    const c6 = scan(R, vary(vary(dA, 24, [100.0, 101.9, 99.9, 101.8]), 25, [101.8, 101.9, 98.3, 98.5])); assert(c6.fires === "25" && near(c6.out[0].L, 99.9) && c6.out[0].target === 94.5, "BE PE-6: " + c6.fires);
    assert(scan(R, vary(dA, 16, [99.5, 99.9, 98.0, 99.7])).fires === "" && scan(R, vary(dA, 16, [99.5, 99.9, 98.2, 99.7])).fires === "", "BE S-1, S-2");
    assert(scan(R, dA, tcfg({ priorMoveAtr: 6.0 })).fires === "", "BE S-6");
    const s7 = scan(R, vary(dA, 24, [100.0, 100.2, 99.0, 99.5])); assert(s7.fires === "25" && near(s7.out[0].L, 99.9) && s7.out[0].target === 94.5, "BE S-7");
    const s8 = scan(R, vary(dA, 24, [100.0, 100.2, 96.4, 96.6])); assert(s8.fires === "" && s8.logged("too far") === "24", "BE S-8");
    const s10 = scan(R, vary(vary(dA, 22, [100.7, 101.0, 98.9, 99.1]), 23, [99.1, 99.3, 98.7, 98.9])); assert(s10.fires === "23" && near(s10.out[0].L, 99.7) && s10.out[0].target === 94.3, "BE S-10: " + s10.fires);
    const s11 = scan(R, mk(BE_A.slice(0, 24).concat(Array(10).fill([100.6, 100.8, 100.4, 100.7]), [[100.7, 100.8, 98.8, 99.0], [99.0, 99.2, 98.2, 98.4]]))); assert(s11.fires === "" && s11.logged("expired") === "33", "BE S-11: " + s11.logged("expired"));
    f2(R, "PE", BE_A, -10, 24);
    console.log("New Rule Chart: the bearish symmetrical triangle matches its document's cases (PE-1 to PE-6, S-1 to S-11, F-1, F-2)"); }
  // -- the ascending triangle: Buy CE only
  { const R = "ascending triangle", dA = shared(R, "CE", AS_A, 24, 102.0), dB = mk(AS_B), s1 = scan(R, dA).out[0];
    assert(s1.h1 === 6 && s1.h2 === 16 && s1.l1 === 10 && s1.l2 === 20 && s1.resistance === 102 && s1.width === 5.8 && s1.target === 107.8 && s1.kind === "ascending triangle broke out", "AS CE-1: " + JSON.stringify(s1));
    assert(N.runDay({ bars: dA, atrFixed: ATR, rules: [R] }).trades[0].entry === 102.6, "AS CE-1 entry 102.6");
    const c3 = scan(R, dB); assert(c3.fires === "" && c3.logged("cancelled") === "26" && c3.logged("locked") === "23", "AS CE-3: cancelled on 26, nothing locked after: " + JSON.stringify(c3.log));
    assert(scan(R, vary(dB, 27, [99.5, 102.9, 99.4, 102.7])).fires === "", "AS CE-4");
    const c5 = scan(R, vary(vary(dA, 24, [101.5, 101.6, 99.3, 99.6]), 25, [99.6, 102.9, 99.5, 102.7])); assert(c5.fires === "25" && c5.out[0].L === 102 && c5.out[0].target === 107.8, "AS CE-5: " + c5.fires);
    const c6 = scan(R, vary(vary(dB, 27, [99.5, 101.0, 99.4, 100.8]), 28, [100.8, 102.8, 100.6, 102.6])); assert(c6.fires === "" && c6.logged("locked") === "23", "AS CE-6: the redraw with candle 24 as High 2 is not taken: " + JSON.stringify(c6.log));
    assert(scan(R, dA, tcfg({ flatTolAtr: 0.05 })).fires === "", "AS S-1");
    assert(scan(R, vary(dA, 6, [100.7, 103.0, 100.3, 101.2])).fires === "" && scan(R, vary(dA, 20, [99.5, 99.9, 97.0, 99.7])).fires === "", "AS S-2, S-3");
    const s7 = scan(R, vary(dA, 24, [101.5, 102.9, 101.3, 102.2])); assert(s7.fires === "25" && s7.out[0].L === 102, "AS S-7: " + s7.fires);
    const s8 = scan(R, vary(dA, 24, [101.5, 105.4, 101.3, 105.2])); assert(s8.fires === "" && s8.logged("too far") === "24", "AS S-8");
    const s10 = scan(R, vary(vary(dA, 22, [100.4, 102.7, 100.2, 102.5]), 23, [102.5, 102.9, 102.3, 102.7])); assert(s10.fires === "23" && s10.out[0].L === 102 && s10.out[0].target === 107.8, "AS S-10: " + s10.fires);
    const s11 = scan(R, mk(AS_A.slice(0, 24).concat(Array(11).fill([101.8, 101.95, 101.7, 101.9]), [[101.9, 102.9, 101.8, 102.7], [102.7, 103.5, 102.5, 103.3]]))); assert(s11.fires === "" && s11.logged("expired") === "35", "AS S-11: " + s11.logged("expired"));
    f2(R, "CE", AS_A, 10, 24);
    console.log("New Rule Chart: the ascending triangle matches its document's cases (CE-1 to CE-6, S-1 to S-11, F-1, F-2)"); }
  // -- the descending triangle: Buy PE only
  { const R = "descending triangle", dA = shared(R, "PE", DE_A, 24, 98.0), dB = mk(DE_B), s1 = scan(R, dA).out[0];
    assert(s1.h1 === 10 && s1.h2 === 20 && s1.l1 === 6 && s1.l2 === 16 && s1.support === 98 && s1.width === 5.8 && s1.target === 92.2 && s1.kind === "descending triangle broke down", "DE PE-1: " + JSON.stringify(s1));
    assert(N.runDay({ bars: dA, atrFixed: ATR, rules: [R] }).trades[0].entry === 97.4, "DE PE-1 entry 97.4");
    const c3 = scan(R, dB); assert(c3.fires === "" && c3.logged("cancelled") === "26" && c3.logged("locked") === "23", "DE PE-3: " + JSON.stringify(c3.log));
    assert(scan(R, vary(dB, 27, [100.5, 100.6, 97.1, 97.3])).fires === "", "DE PE-4");
    const c5 = scan(R, vary(vary(dA, 24, [98.5, 100.7, 98.4, 100.4]), 25, [100.4, 100.5, 97.1, 97.3])); assert(c5.fires === "25" && c5.out[0].L === 98 && c5.out[0].target === 92.2, "DE PE-5: " + c5.fires);
    const c6 = scan(R, vary(vary(dB, 27, [100.5, 100.6, 99.0, 99.2]), 28, [99.2, 99.4, 97.2, 97.4])); assert(c6.fires === "" && c6.logged("locked") === "23", "DE PE-6: " + JSON.stringify(c6.log));
    assert(scan(R, dA, tcfg({ flatTolAtr: 0.05 })).fires === "", "DE S-1");
    assert(scan(R, vary(dA, 6, [99.3, 99.7, 97.0, 98.8])).fires === "" && scan(R, vary(dA, 20, [100.5, 103.0, 100.1, 100.3])).fires === "", "DE S-2, S-3");
    const s7 = scan(R, vary(dA, 24, [98.5, 98.7, 97.1, 97.8])); assert(s7.fires === "25" && s7.out[0].L === 98, "DE S-7: " + s7.fires);
    const s8 = scan(R, vary(dA, 24, [98.5, 98.7, 94.6, 94.8])); assert(s8.fires === "" && s8.logged("too far") === "24", "DE S-8");
    const s10 = scan(R, vary(vary(dA, 22, [99.6, 99.8, 97.3, 97.5]), 23, [97.5, 97.7, 97.1, 97.3])); assert(s10.fires === "23" && s10.out[0].L === 98 && s10.out[0].target === 92.2, "DE S-10: " + s10.fires);
    const s11 = scan(R, mk(DE_A.slice(0, 24).concat(Array(11).fill([98.2, 98.3, 98.05, 98.1]), [[98.1, 98.2, 97.1, 97.3], [97.3, 97.5, 96.5, 96.7]]))); assert(s11.fires === "" && s11.logged("expired") === "35", "DE S-11: " + s11.logged("expired"));
    f2(R, "PE", DE_A, -10, 24);
    console.log("New Rule Chart: the descending triangle matches its document's cases (PE-1 to PE-6, S-1 to S-11, F-1, F-2)"); }
}

// the symmetrical triangles' trend window reaches into the previous day (the document, section 9) when runDay is given prevBars
{
  // the bullish document's Appendix A with its first 6 candles (the rise into the triangle) at the end of the previous day; the day opens
  // with 3 flat candles before High 1 (a swing needs 3 candles on each side), so the day's own window shows no rise at all
  const A = [[92.0,93.4,91.6,93.1],[93.1,94.9,92.8,94.6],[94.6,96.3,94.3,96.0],[96.0,97.8,95.7,97.5],[97.5,99.3,97.2,99.0],[99.0,101.0,98.7,100.7],[100.7,102.0,100.3,100.9],[100.9,101.2,99.4,99.6],[99.6,99.9,98.3,98.5],[98.5,98.8,97.5,97.7],[97.7,98.3,97.0,98.1],[98.1,98.9,97.8,98.7],[98.7,99.5,98.4,99.3],[99.3,100.0,99.0,99.8],[99.8,100.5,99.5,100.2],[100.2,100.8,99.9,100.5],[100.5,101.0,100.1,100.3],[100.3,100.6,99.4,99.6],[99.6,99.9,98.8,99.0],[99.0,99.3,98.3,98.5],[98.5,99.0,98.0,98.8],[98.8,99.5,98.5,99.3],[99.3,99.9,99.0,99.7],[99.7,100.2,99.4,100.0],[100.0,101.0,99.8,100.8],[100.8,101.7,100.6,101.5],[101.5,102.4,101.3,102.2]];
  const bar = (r, t) => ({ time: t, open: r[0], high: r[1], low: r[2], close: r[3] });
  const prev = Array(20).fill([100.0, 100.2, 99.8, 100.0]).concat(A.slice(0, 6)).map((r, i) => bar(r, t0 - 86400 + i * 300));
  const day = Array(3).fill([100.3, 100.6, 100.2, 100.4]).concat(A.slice(6)).map((r, i) => bar(r, t0 + i * 300));
  const R = ["bullish symmetrical triangle"];
  const w = N.runDay({ bars: day, prevBars: prev, atrFixed: ATR, rules: R }), wo = N.runDay({ bars: day, atrFixed: ATR, rules: R });
  assert(w.trades.length === 1 && w.trades[0].side === "CE" && w.trades[0].rise === 7.7 && w.trades[0].fall === 1.7 && wo.trades.length === 0, "the trend window reaches into the previous day: " + JSON.stringify([w.trades.map(t => [t.side, t.rise, t.fall]), wo.trades.length]));
  // only the 20 candles before the first touch count (3 of the day, 17 of the previous day): a spike older than that does not turn it bearish
  const spike = Array(5).fill([120.0, 121.0, 119.0, 120.0]).map((r, i) => bar(r, t0 - 86400 - 1500 + i * 300));
  const far = N.runDay({ bars: day, prevBars: spike.concat(prev), atrFixed: ATR, rules: R });
  assert(far.trades.length === 1 && far.trades[0].rise === 7.7 && far.trades[0].fall === 1.7, "candles older than the window do not count: " + JSON.stringify(far.trades.map(t => [t.rise, t.fall])));
  console.log("New Rule Chart: the symmetrical triangles' trend window reaches into the previous day when the page has its candles");
}

// ---- The swing size of the double and triple tops and bottoms on the page (26 October, the owner: "prepare the PR with swing size 2"):
// a top (bottom) is a candle whose high (low) is at or beyond the 2 candles on each side, known once the 2nd candle after it has closed
// (the documents: 3). The wedges, the rectangle and the triangles keep 3. The documents' own cases above run on DOC (3)
{
  assert(N.DT.swingN === 2 && DOC.swingN === 3 && N.WEDGE.swingN === 3 && N.RECT.swingN === 3 && N.TRI.swingN === 3, "the swing sizes: the tops and bottoms 2, the wedges, rectangle and triangles 3");
  const lows = [10, 9, 8, 9, 10, 7.5, 9, 10].map((l, i) => ({ time: 1792381500 + i * 300, open: l + 1, high: l + 2, low: l, close: l + 1 }));
  assert(N.findSwings(lows, -1, 2).join() === "2,5" && N.findSwings(lows, -1, 3).join() === "", "a bottom with 2 higher candles on each side is a swing at 2, not at 3 (it needs 3 before it and 3 after)");
  const pageE1 = N.detectEntry(peD, 22, "PE", ATR, N.DT), pageRun = N.runDay({ bars: peD, atrFixed: ATR, rules: ["double top"] }).trades;
  assert(pageE1 && pageE1.t1 === 7 && pageE1.t2 === 17 && pageE1.neckline === 91.8 && pageRun.length === 1 && pageRun[0].entry === 90.8 && pageRun[0].points === 5.3,
         "the documents' E1 gives the same call on the page's setting: " + JSON.stringify(pageE1));
  console.log("New Rule Chart: the page's swing size (2 for the tops and bottoms, 3 for the wedges, rectangle and triangles); the documents' E1 unchanged on it");
}
