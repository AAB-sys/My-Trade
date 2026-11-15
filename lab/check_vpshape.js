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

if (process.argv[2]) {  // a replay of a candles file, the way the rule was tested
  const days = {}; for (const [d, t, o, h, l, cl] of fs.readFileSync(process.argv[2], "utf8").trim().split("\n").slice(1).map(l => l.split(","))) (days[d] = days[d] || []).push({ time: Date.parse(`${d}T${t}:00+05:30`) / 1000, open: +o, high: +h, low: +l, close: +cl });
  let n = 0, won = 0, pts = 0, most = 0; const dates = Object.keys(days).sort().filter(d => days[d].length >= 70);
  for (const d of dates) { const L = S.calls(days[d], days[d].length, days[d], null).map(t => t.how === "open" ? { ...t, points: (t.side === "CE" ? 1 : -1) * (days[d][days[d].length - 1].close - t.entry) } : t); n += L.length; most = Math.max(most, L.length); L.forEach(t => { pts += t.points - 8; won += t.points - 8 > 0; }); }
  console.log(`\nreplay of ${dates.length} days (${dates[0]} to ${dates[dates.length - 1]}): ${n} calls, ${Math.round(100 * won / n)}% won, ${pts.toFixed(0)} points after 8 a call, at most ${most} a day`);
}
console.log(bad ? `\n${bad} WRONG` : "\nALL GOOD");
process.exit(bad ? 1 : 0);
