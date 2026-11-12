// The Volume Profile page's arithmetic (static/volprofile.js), on candles small enough to count by hand.
//     node lab/check_volprofile.js        (from the repo's folder)
const VP = require("../static/volprofile.js");
let bad = 0;
const check = (what, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); bad += !ok; console.log((ok ? "ok    " : "WRONG ") + what + (ok ? "" : `: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)); };
const bar = (time, open, high, low, close) => ({ time, open, high, low, close });
const T = 1794455100;  // 12 November 2026, 09:15 IST

// three candles, 2 rows of 10 points (100 to 120): 100-120 rising with 200, 110-120 falling with 100, 100-110 rising with 50
const bars = [bar(T, 100, 120, 100, 118), bar(T + 300, 119, 120, 110, 111), bar(T + 600, 101, 110, 100, 109)];
const vol = new Map([[T, 200], [T + 300, 100], [T + 600, 50]]);
let p = VP.build(bars, vol, 2);
check("the volume of a candle is spread evenly over the rows its range covers", p.rows.map(r => [r.price, r.up, r.down, r.total]), [[100, 150, 0, 150], [110, 100, 100, 200]]);
check("the total is all the volume", p.total, 350);
check("the busiest price is the middle of the busiest row", p.poc, 115);
check("the 70% area takes the other row too", [p.val, p.vah], [100, 120]);

p = VP.build(bars, vol);
check("24 rows of equal height from the day's low to its high, whatever the index", [p.rows.length, p.rows[0].price, Math.round((p.rows[23].price + p.step) * 100) / 100, Math.round(p.rows.reduce((x, r) => x + r.total, 0))], [24, 100, 120, 350]);
p = VP.build(bars.map(b => bar(b.time, b.open * 600, b.high * 600, b.low * 600, b.close * 600)), vol);
check("the same 24 rows on an index 600 times higher", [p.rows.length, p.rows[0].price, Math.round(p.rows[23].price + p.step)], [24, 60000, 72000]);

p = VP.build(bars, null, 2);
check("without volume every candle weighs 1: the rows count time", [p.timeOnly, p.total, p.rows[0].total, p.rows[1].total], [true, 3, 1.5, 1.5]);

p = VP.build(bars, new Map([[T, 200]]), 2);
check("a candle with no volume yet (the one forming now) is left out", [p.counted, p.total], [1, 200]);

p = VP.build([bar(T, 105, 105, 105, 105)], new Map([[T, 40]]));
check("a day with one price has one row", [p.rows.length, p.rows[0].total], [1, 40]);

// the 70% area, 7 rows of 10 points with 5, 10, 8, 50, 12, 9, 6 (100 in all): the busiest (50) first; above it 12 + 9 = 21
// against 8 + 10 = 18 below: the two above are taken (71): done
const seven = [5, 10, 8, 50, 12, 9, 6];
const sb = seven.map((v, i) => bar(T + i * 300, i * 10, i * 10 + 10, i * 10, i * 10 + 10));
p = VP.build(sb, new Map(sb.map((b, i) => [b.time, seven[i]])), 7);
check("the 70% area: two rows above against two rows below, the heavier pair first", [p.poc, p.val, p.vah], [35, 30, 60]);

check("the candles are split into their days (IST)", VP.sessions([bar(T, 1, 1, 1, 1), bar(T + 300, 1, 1, 1, 1), bar(T + 86400, 1, 1, 1, 1)]).map(d => d.length), [2, 1]);
check("no candles: no profile", VP.build([], vol), null);

console.log("\n" + (bad ? bad + " WRONG" : "all fine"));
process.exit(bad ? 1 : 0);
