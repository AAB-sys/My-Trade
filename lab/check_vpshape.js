// The Shape signal of the Volume Profile page (static/vpshape.js): the shape of a profile and the day's calls, on small made-up days.
//     node lab/check_vpshape.js                       (from the repo's folder)
//     node lab/check_vpshape.js <candles.csv>         also replays a file of 5-minute candles (the Main Menu's Download candles) and
//                                                     prints the totals; on NIFTY50_5min_2024-11-09_2026-11-09.csv: 539 calls, +579 after 8 a call
const S = require("../static/vpshape.js"), fs = require("fs");
let bad = 0;
const check = (what, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); bad += !ok; console.log((ok ? "ok    " : "WRONG ") + what + (ok ? "" : `: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)); };
const T = 1794455100;  // 12 November 2026, 09:15 IST
const bar = (i, open, high, low, close) => ({ time: T + i * 300, open, high, low, close });

// ---- the shape, from rows given directly
const rows = (f) => Array.from({ length: 30 }, (_, i) => f((i + 0.5) / 30));
const g = (t, m, s) => Math.exp(-0.5 * ((t - m) / s) ** 2);
check("a hill in the middle is a D", S.classify(rows(t => g(t, 0.5, 0.17))).shape, "D");
check("a hill near the bottom is a B", S.classify(rows(t => g(t, 0.25, 0.1) + 0.2 * g(t, 0.6, 0.2))).shape, "B");
check("a hill near the top is a P", S.classify(rows(t => g(t, 0.78, 0.1) + 0.2 * g(t, 0.45, 0.2))).shape, "P");
check("two hills with a valley are a Double Zone", S.classify(rows(t => g(t, 0.72, 0.08) + 0.9 * g(t, 0.27, 0.08) + 0.12)).shape, "Double");
check("a second hill too small (under 0.60 of the first) is not a Double Zone", S.classify(rows(t => g(t, 0.72, 0.08) + 0.4 * g(t, 0.27, 0.08))).shape, "P");
check("the value area grows to 70%, the larger neighbour first (10 + 6 of 20 is enough)", S.valueArea([1, 2, 10, 6, 1], 2), [3, 2]);
check("volume moves the busiest price: time says the wide candle, volume the heavy one",
      [Math.round(S.read([bar(0, 100, 130, 100, 130), bar(1, 100, 102, 100, 102)], null).poc), Math.round(S.read([bar(0, 100, 130, 100, 130), bar(1, 125, 130, 125, 130)], new Map([[T, 1], [T + 300, 50]])).poc)], [101, 126]);
check("1-minute candles become 5-minute ones", S.five([0, 1, 2, 3, 4, 5].map(i => ({ time: T + i * 60, open: 10 + i, high: 12 + i, low: 9 + i, close: 11 + i }))),
      [{ time: T, open: 10, high: 16, low: 9, close: 15 }, { time: T + 300, open: 15, high: 17, low: 14, close: 16 }]);

// ---- the calls: a flat morning between 100 and 110 (value area inside it), then the candles named below
function day(after) {  // 35 flat candles 09:15 to 12:05, then `after` from 12:10
  const b = []; for (let i = 0; i < 35; i++) b.push(bar(i, 104, 110, 100, 106));
  after.forEach((x, j) => b.push(bar(35 + j, ...x)));
  return b;
}
const at = (i) => S.hm(T + i * 300);
let b = day([[106, 116, 106, 115], [115, 120, 114, 119], [119, 125, 118, 124]]);
let c = S.calls(b, b.length, b, null);
check("12:10 closes above the value area: Buy CE at the next candle's open, stop at the busiest price (a flat morning: the lowest row)", [c.length, c[0].side, at(36), c[0].entry, Math.round(c[0].stop), c[0].how, c[0].points], [1, "CE", "12:15", 115, 100, "open", 9]);
check("the signal candle must have closed: nothing while 12:10 is still forming", S.calls(b.slice(0, 37), 35, b.slice(0, 37), null).length, 0);
b = day([[106, 116, 106, 115], [115, 116, 104, 105], [105, 108, 92, 94], [94, 95, 90, 91], [91, 92, 85, 86]]);
c = S.calls(b, b.length, b, null);
check("the CE is stopped at the busiest price, then a close below the value area gives a PE: two calls in a day",
      c.map(t => [t.side, t.how, Math.round(t.points)]), [["CE", "stop", -15], ["PE", "open", 8]]);
b = day([[104, 110, 100, 106], [106, 108, 104, 105]]);
check("a candle that closes inside the value area gives no call", S.calls(b, b.length, b, null).length, 0);
b = []; for (let i = 0; i < 10; i++) b.push(bar(i, 104, 110, 100, 106)); b.push(bar(10, 106, 120, 106, 119), bar(11, 119, 122, 118, 121));
check("before 12:10 there is no call, however far the price runs", S.calls(b, b.length, b, null).length, 0);
b = day([]); for (let i = 35; i < 53; i++) b.push(bar(i, 104, 110, 100, 106)); b.push(bar(53, 106, 120, 106, 119), bar(54, 119, 122, 118, 121));  // 13:40
check("after 13:30 there is no new call", [at(53), S.calls(b, b.length, b, null).length], ["13:40", 0]);
b = day([[106, 116, 106, 115]]); for (let i = 36; i < 72; i++) b.push(bar(i, 115, 118, 112, 116)); b.push(bar(72, 117, 119, 116, 118), bar(73, 118, 119, 117, 118));
c = S.calls(b, b.length, b, null);
check("a call still open at 15:15 ends at that candle's open", [at(72), c.length, c[0].how, c[0].exit, c[0].points], ["15:15", 1, "time", 117, 2]);
check("the same candles give the same calls again", JSON.stringify(S.calls(b, b.length, b, null)), JSON.stringify(c));

// ---- the shape-wise calls
{
  const mk = (list) => list.map((x, i) => bar(i, ...x));
  // a P day: 20 candles busy at 120-130 after a climb from 100; then a dip to the busiest price that holds
  let p = []; for (let i = 0; i < 4; i++) p.push([100 + i * 7, 108 + i * 7, 100 + i * 7, 107 + i * 7]); for (let i = 0; i < 16; i++) p.push([124, 130, 120, 126]);
  let d = mk(p.concat([[126, 127, 121, 126.5], [126.5, 131, 126, 130]])), r = S.read(d.slice(0, 20), null);
  let sc = S.shapeCalls(d, d.length, d, null);
  check("a P day: the dip to the busiest price that closes back above it gives Buy CE, stop at the value area's low", [r.shape, sc.length >= 1, sc[0].side, sc[0].setup, sc.every(t => t.side === "CE" && t.setup === "P")], ["P", true, "CE", "P", true]);
  // a B day: the mirror
  p = []; for (let i = 0; i < 4; i++) p.push([130 - i * 7, 130 - i * 7, 122 - i * 7, 123 - i * 7]); for (let i = 0; i < 16; i++) p.push([106, 110, 100, 104]);
  d = mk(p.concat([[104, 109, 103, 103.5], [103.5, 104, 99, 100]])); sc = S.shapeCalls(d, d.length, d, null);
  check("a B day: the rise to the busiest price that closes back below it gives Buy PE", [S.read(d.slice(0, 20), null).shape, sc.length, sc[0] && sc[0].side, sc[0] && sc[0].setup], ["B", 1, "PE", "B"]);
  // a D day: wide candles 100-130 with the middle busiest; a touch of the value area's high that closes back under it
  p = []; for (let i = 0; i < 20; i++) p.push(i % 5 === 0 ? [115, 130, 100, 115] : [114, 119, 111, 116]);
  d = mk(p); const vd = S.read(d, null);
  d = mk(p.concat([[116, vd.vah + 1, 115, vd.vah - 2], [vd.vah - 2, vd.vah - 1, 110, 111]])); sc = S.shapeCalls(d, d.length, d, null);
  check("a D day: a touch of the value area's high that closes back below it gives Buy PE, stop at the day's high", [vd.shape, sc.length, sc[0] && sc[0].side, sc[0] && sc[0].setup, sc[0] && sc[0].stop], ["D", 1, "PE", "D-high", 130]);
  // a Double Zone day: 10 candles at 100-104, 10 at 126-130; then the close crosses the middle downward
  p = []; for (let i = 0; i < 10; i++) p.push([101, 104, 100, 103]); for (let i = 0; i < 10; i++) p.push([127, 130, 126, 129]);
  d = mk(p); const vz = S.read(d, null);
  d = mk(p.concat([[129, 129, 110, 111], [111, 112, 105, 106]])); sc = S.shapeCalls(d, d.length, d, null);
  check("a Double Zone day: the close crossing the middle of the gap downward gives Buy PE, stop at the upper busy price", [vz.shape, vz.zoneLow < 105 && vz.zoneHigh > 125, sc.length, sc[0] && sc[0].side, sc[0] && sc[0].setup, sc[0] && sc[0].stop === vz.zoneHigh], ["Double", true, 1, "PE", "Double-down", true]);
  check("no shape-wise call before 10:15 (the day's first hour)", S.shapeCalls(d.slice(0, 12), 12, d.slice(0, 12), null).length, 0);
  check("the break calls and the shape-wise calls are separate lists: the break calls of this day", S.calls(d, d.length, d, null).length, 0);
}

if (process.argv[2]) {  // a replay of a candles file, the way the rule was tested
  const days = {}; for (const [d, t, o, h, l, cl] of fs.readFileSync(process.argv[2], "utf8").trim().split("\n").slice(1).map(l => l.split(","))) (days[d] = days[d] || []).push({ time: Date.parse(`${d}T${t}:00+05:30`) / 1000, open: +o, high: +h, low: +l, close: +cl });
  let n = 0, won = 0, pts = 0, most = 0; const dates = Object.keys(days).sort().filter(d => days[d].length >= 70);
  for (const d of dates) { const L = S.calls(days[d], days[d].length, days[d], null).map(t => t.how === "open" ? { ...t, points: (t.side === "CE" ? 1 : -1) * (days[d][days[d].length - 1].close - t.entry) } : t); n += L.length; most = Math.max(most, L.length); L.forEach(t => { pts += t.points - 8; won += t.points - 8 > 0; }); }
  const by = {}; let sn = 0, sp = 0;
  dates.forEach((d, i) => S.shapeCalls(days[d], days[d].length, days[d], null).forEach(t => { const pts = (t.how === "open" ? (t.side === "CE" ? 1 : -1) * (days[d][days[d].length - 1].close - t.entry) : t.points) - 8, y = by[t.setup] = by[t.setup] || { n: 0, won: 0, pts: 0, y1: 0, y2: 0 }; y.n++; y.won += pts > 0; y.pts += pts; y[i < dates.length / 2 ? "y1" : "y2"] += pts; sn++; sp += pts; }));
  console.log("\nshape-wise calls, after 8 a call:"); for (const k of Object.keys(S.SETUPS)) if (by[k]) console.log(`  ${S.SETUPS[k].padEnd(48)} ${String(by[k].n).padStart(4)} calls, ${String(Math.round(100 * by[k].won / by[k].n)).padStart(2)}% won, ${by[k].pts.toFixed(0).padStart(6)} points (first year ${by[k].y1.toFixed(0)}, second ${by[k].y2.toFixed(0)})`);
  console.log(`  all shape-wise calls: ${sn} calls, ${sp.toFixed(0)} points`);
  console.log(`\nreplay of ${dates.length} days (${dates[0]} to ${dates[dates.length - 1]}): ${n} calls, ${Math.round(100 * won / n)}% won, ${pts.toFixed(0)} points after 8 a call, at most ${most} a day`);
}
console.log(bad ? `\n${bad} WRONG` : "\nALL GOOD");
process.exit(bad ? 1 : 0);
