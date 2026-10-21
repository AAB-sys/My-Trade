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
