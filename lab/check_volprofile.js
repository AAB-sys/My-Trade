// The Volume Profile page's arithmetic (static/volprofile.js), on candles small enough to count by hand.
//     node lab/check_volprofile.js        (from the repo's folder)
const VP = require("../static/volprofile.js");
let bad = 0;
const check = (what, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); bad += !ok; console.log((ok ? "ok    " : "WRONG ") + what + (ok ? "" : `: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)); };
const bar = (time, open, high, low, close) => ({ time, open, high, low, close });
const T = 1794455100;  // 12 November 2026, 09:15 IST

// three candles, rows of 10 points: 100-120 rising with 200, 110-120 falling with 100, 100-110 rising with 50
const bars = [bar(T, 100, 120, 100, 118), bar(T + 300, 119, 120, 110, 111), bar(T + 600, 101, 110, 100, 109)];
const vol = new Map([[T, 200], [T + 300, 100], [T + 600, 50]]);
let p = VP.build(bars, vol, 10);
check("the volume of a candle is spread evenly over the rows its range covers", p.rows.slice(0, 2).map(r => [r.price, r.up, r.down, r.total]), [[100, 150, 0, 150], [110, 100, 100, 200]]);
check("the total is all the volume", p.total, 350);
check("the busiest price is the middle of the busiest row", p.poc, 115);
check("the 70% area grows from the busiest row to the busier neighbour", [p.val, p.vah], [100, 120]);

p = VP.build(bars, null, 10);
check("without volume every candle weighs 1: the rows count time", [p.timeOnly, p.total, p.rows[0].total, p.rows[1].total], [true, 3, 1.5, 1.5]);

p = VP.build(bars, new Map([[T, 200]]), 10);
check("a candle with no volume yet (the one forming now) is left out", [p.counted, p.total], [1, 200]);

p = VP.build([bar(T, 105, 105, 105, 105)], new Map([[T, 40]]), 10);
check("a candle with no range puts all its volume in its one row", [p.rows.length, p.rows[0].total, p.poc], [1, 40, 105]);

// the 70% area: rows 5, 10, 60, 15, 10 -> the busiest (60) alone is 60%; the busier neighbour (15) makes 75%
const five = [5, 10, 60, 15, 10].map((v, i) => bar(T + i * 300, i * 10 + 1, i * 10 + 9, i * 10 + 1, i * 10 + 9));
p = VP.build(five, new Map(five.map((b, i) => [b.time, [5, 10, 60, 15, 10][i]])), 10);
check("the 70% area stops as soon as 70% is inside", [p.poc, p.val, p.vah], [25, 20, 40]);

check("the row's height is a round number giving about 40 rows", [VP.stepFor(240), VP.stepFor(900), VP.stepFor(30), VP.stepFor(0)], [10, 25, 1, 0.5]);
check("the candles are split into their days (IST)", VP.sessions([bar(T, 1, 1, 1, 1), bar(T + 300, 1, 1, 1, 1), bar(T + 86400, 1, 1, 1, 1)]).map(d => d.length), [2, 1]);
check("no candles: no profile", VP.build([], vol), null);

console.log("\n" + (bad ? bad + " WRONG" : "all fine"));
process.exit(bad ? 1 : 0);
