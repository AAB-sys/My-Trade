// The Impulse MACD of the Volume Profile page (static/impulse.js): the indicator against the Pine script's own arithmetic done by hand,
// and the calls. No network.
//     node lab/check_impulse.js                     (from the repo's folder)
//     node lab/check_impulse.js <candles.csv>       also replays a file of 5-minute candles (the Main Menu's Download candles); on
//                                                   NIFTY50_5min_2024-11-09_2026-11-09.csv: 813 calls, -385 after 8 a call
const I = require("../static/impulse.js"), S = require("../static/vpshape.js"), fs = require("fs");
let bad = 0;
const check = (what, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); bad += !ok; console.log((ok ? "ok    " : "WRONG ") + what + (ok ? "" : `: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)); };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const T = 1794455100;  // 12 November 2026, 09:15 IST
const bar = (i, open, high, low, close) => ({ time: T + i * 300, open, high, low, close });

// ---- the indicator, with short lengths so the hand count is small: lengthMA 3, lengthSignal 2
const c3 = { lengthMA: 3, lengthSignal: 2 };
const b = [bar(0, 10, 12, 8, 10), bar(1, 10, 14, 10, 12), bar(2, 12, 16, 12, 14), bar(3, 14, 26, 18, 25), bar(4, 25, 27, 21, 22)];
const v = I.compute(b, c3);
// by hand: the highs' plain average of the first 3 is 14, the lows' 10; then (prev * 2 + this) / 3
check("the channel starts as the plain average of the first candles (the highs 14, the lows 10)", [v[1].hi, v[2].hi, v[2].lo], [null, 14, 10]);
check("then it is smoothed: (previous * 2 + this candle's) / 3", [near(v[3].hi, (14 * 2 + 26) / 3), near(v[3].lo, (10 * 2 + 18) / 3), near(v[4].hi, (18 * 2 + 27) / 3)], [true, true, true]);
// the zero-lag average: src = (h+l+c)/3 = 10, 12, 14, 23, 23.333; alpha = 2/4 = 0.5
{ const src = b.map(x => (x.high + x.low + x.close) / 3); let e1 = src[0], e2 = e1; const mi = [e1 + (e1 - e2)];
  for (let i = 1; i < 5; i++) { e1 = 0.5 * src[i] + 0.5 * e1; e2 = 0.5 * e1 + 0.5 * e2; mi.push(e1 + (e1 - e2)); }
  check("the zero-lag average is ema1 + (ema1 - ema2)", v.map((x, i) => near(x.mi, mi[i])), [true, true, true, true, true]);
  check("md is the distance past the channel, 0 inside it", [v[2].md, near(v[3].md, mi[3] - v[3].hi), v[3].md > 0], [0, true, true]);
  check("the signal is the plain average of the last 2 md, the histogram md minus it", [v[2].sb, near(v[3].sb, (v[2].md + v[3].md) / 2), near(v[3].sh, v[3].md - v[3].sb)], [null, true, true]); }
check("the colours: above the average and the channel lime; above the average only green", [v[3].colour, I.compute([bar(0, 10, 12, 8, 10), bar(1, 10, 12, 8, 10), bar(2, 10, 12, 8, 10), bar(3, 10, 12, 9, 11.5)], c3)[3].colour], ["lime", "green"]);
check("the colours: below the average and the channel red; below the average only orange", [I.compute([bar(0, 10, 12, 8, 10), bar(1, 10, 12, 8, 10), bar(2, 10, 12, 8, 10), bar(3, 10, 4, 1, 2)], c3)[3].colour, I.compute([bar(0, 10, 12, 8, 10), bar(1, 10, 12, 8, 10), bar(2, 10, 12, 8, 10), bar(3, 10, 11, 8, 8.5)], c3)[3].colour], ["red", "orange"]);
check("a flat market: md 0 on every candle, the signal 0", (() => { const f = I.compute(Array.from({ length: 60 }, (_, i) => bar(i, 100, 101, 99, 100))); return [f.every(x => x.md === 0), f[59].sb]; })(), [true, 0]);
check("the script's own lengths are 34 and 9", [I.CFG.lengthMA, I.CFG.lengthSignal], [34, 9]);
check("agrees: CE needs md above 0 and above its signal; PE the mirror; a candle without a signal yet never agrees",
      [I.agrees({ md: 2, sb: 1, sh: 1 }, "CE"), I.agrees({ md: 2, sb: 3, sh: -1 }, "CE"), I.agrees({ md: -2, sb: -1, sh: -1 }, "PE"), I.agrees({ md: -2, sb: -1, sh: -1 }, "CE"), I.agrees({ md: 0, sb: 0, sh: 0 }, "CE"), I.agrees({ md: 2, sb: null, sh: null }, "CE"), I.agrees(undefined, "PE")],
      [true, false, true, false, false, false, false]);

// ---- the calls: four flat days, then a day that is flat to 12:05 and runs up from 12:10
function days(after) {
  const out = []; let i = 0;
  for (let d = 0; d < 5; d++) { const t0 = T + d * 86400; for (let k = 0; k < 75; k++, i++) out.push({ time: t0 + k * 300, open: 104, high: 110, low: 100, close: 106 }); }
  const t0 = T + 4 * 86400, base = out.length - 75;
  after.forEach((x, j) => { out[base + 35 + j] = { time: t0 + (35 + j) * 300, open: x[0], high: x[1], low: x[2], close: x[3] }; });
  return { all: out.slice(0, base + 35 + after.length), today: out.slice(base, base + 35 + after.length) };
}
let d = days([[106, 116, 106, 115], [115, 124, 114, 123], [123, 132, 122, 131], [131, 140, 130, 139], [139, 148, 138, 147]]);
let plain = S.calls(d.today, d.today.length, d.today, null), got = I.calls(d.all, d.today.length, d.today, null);
check("a run up out of a flat market: the break call comes on the first candle outside the value area (12:15)", [plain.length, S.hm(plain[0].entryTime), plain[0].side], [1, "12:15", "CE"]);
check("the Impulse call waits until the impulse is there and growing: later than the break call, the same side", [got.calls.length, got.calls[0].side, got.calls[0].entryTime > plain[0].entryTime, got.calls[0].md > 0 && got.calls[0].md > got.calls[0].sb], [1, "CE", true, true]);
check("its stop is the busiest price of that moment, as the break call's", got.calls[0].stop < got.calls[0].entry, true);
d = days([[106, 111, 106, 110.6], [110.6, 111, 109, 110.7]]);
check("a close just outside the value area with no impulse (md still 0): the break call fires, the Impulse call does not", [S.calls(d.today, d.today.length, d.today, null).length, I.calls(d.all, d.today.length, d.today, null).calls.length], [1, 0]);
d = days([[104, 104, 90, 91], [91, 92, 80, 81], [81, 82, 70, 71], [71, 72, 60, 61], [61, 62, 50, 51]]);
got = I.calls(d.all, d.today.length, d.today, null);
check("a run down: Buy PE, with md below 0 and below its signal", [got.calls.length, got.calls[0].side, got.calls[0].md < 0 && got.calls[0].md < got.calls[0].sb], [1, "PE", true]);
check("the same candles give the same calls again", JSON.stringify(I.calls(d.all, d.today.length, d.today, null).calls), JSON.stringify(got.calls));
check("the indicator's values come back by candle time, one a candle", [got.values.size, got.values.get(d.all[d.all.length - 1].time).md < 0], [d.all.length, true]);

// the whole day (the owner, 15 November: "fired all the day ... there should not be any time cap or call numbers limit")
{
  const early = []; let i = 0;
  for (let dd = 0; dd < 4; dd++) for (let k = 0; k < 75; k++) early.push({ time: T + dd * 86400 + k * 300, open: 104, high: 110, low: 100, close: 106 });
  const t0 = T + 4 * 86400, today = [[104, 110, 100, 106], [104, 110, 100, 106], [104, 110, 100, 106], [106, 116, 106, 115], [115, 124, 114, 123], [123, 132, 122, 131], [131, 140, 130, 139], [139, 148, 138, 147], [147, 156, 146, 155]].map((x, k) => ({ time: t0 + k * 300, open: x[0], high: x[1], low: x[2], close: x[3] }));
  const g = I.calls(early.concat(today), today.length, today, null).calls;
  check("a run from 09:30: the Impulse call comes in the morning, long before 12:10", [g.length, g[0].side, S.hm(g[0].entryTime) < "10:15"], [1, "CE", true]);
  check("the break calls keep their own hours: none of them this early", S.calls(today, today.length, today, null).length, 0);
  check("the calls' day runs from the open to the 15:05 candle, with a profile of three candles", [I.CFG.from, I.CFG.to, I.CFG.minBars], ["09:15", "15:05", 3]);
  // more than one call a day: a run up (Buy CE), then a long fall through the stop and out of the value area (Buy PE); nothing counts them
  const zig = [[104, 110, 100, 106], [104, 110, 100, 106], [104, 110, 100, 106]]; let p = 106;
  for (let k = 0; k < 6; k++) { zig.push([p, p + 10, p - 1, p + 9]); p += 9; }
  for (let k = 0; k < 30; k++) { zig.push([p, p + 1, p - 16, p - 15]); p -= 15; }
  const zt = zig.map((x, k) => ({ time: t0 + k * 300, open: x[0], high: x[1], low: x[2], close: x[3] })), zc = I.calls(early.concat(zt), zt.length, zt, null).calls;
  check("no limit on the number of calls in a day: after the CE is stopped the fall gives a PE", [zc.length >= 2, zc[0].side, zc[0].how, zc[zc.length - 1].side], [true, "CE", "stop", "PE"]);
}

if (process.argv[2]) {  // a replay, the way the rule was tested; then again as the page counts it, from the last five days only
  const byDay = {}; for (const [dd, t, o, h, l, cl] of fs.readFileSync(process.argv[2], "utf8").trim().split("\n").slice(1).map(l => l.split(","))) (byDay[dd] = byDay[dd] || []).push({ time: Date.parse(`${dd}T${t}:00+05:30`) / 1000, open: +o, high: +h, low: +l, close: +cl });
  const dates = Object.keys(byDay).sort().filter(x => byDay[x].length >= 70);
  const run = (back) => { let n = 0, won = 0, pts = 0, y1 = 0, y2 = 0, ce = 0, pe = 0; const keys = [];
    dates.forEach((x, i) => { if (i < 4) return; const all = dates.slice(back == null ? 0 : i - back, i + 1).flatMap(q => byDay[q]), today = byDay[x];
      for (const t of I.calls(all, today.length, today, null).calls) { const p = (t.how === "open" ? (t.side === "CE" ? 1 : -1) * (today[today.length - 1].close - t.entry) : t.points) - 8; n++; won += p > 0; pts += p; if (i < dates.length / 2) y1 += p; else y2 += p; if (t.side === "CE") ce += p; else pe += p; keys.push(x + t.entryTime + t.side); } });
    return { n, won, pts, y1, y2, ce, pe, keys }; };
  const page = run(4);
  console.log(`\nreplay as the page counts it (the last 5 days of candles), ${dates.length} days (${dates[0]} to ${dates[dates.length - 1]}): ${page.n} calls, ${Math.round(100 * page.won / page.n)}% won, ${page.pts.toFixed(0)} points after 8 a call (first year ${page.y1.toFixed(0)}, second ${page.y2.toFixed(0)}; CE ${page.ce.toFixed(0)}, PE ${page.pe.toFixed(0)})`);
  if (process.argv[3] === "full") { const full = run(null), same = page.keys.filter(k => full.keys.includes(k)).length; console.log(`with the averages run over the whole file: ${full.n} calls, ${full.pts.toFixed(0)} points; ${same} of the page's ${page.n} calls are the same`); }
}
console.log(bad ? `\n${bad} WRONG` : "\nALL GOOD");
process.exit(bad ? 1 : 0);
