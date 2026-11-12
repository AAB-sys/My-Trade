// The VWAP stretch meter (12 November): MorePat.vwapGap reads today's candles only, checked here on made-up candles. No network.
//     node lab/vwap_meter_check.js        (from the repo's folder)
global.window = global; require("../static/newrule.js"); require("../static/morepat.js"); const M = globalThis.MorePat;
let bad = 0; const check = (what, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); bad += !ok; console.log((ok ? "ok    " : "WRONG ") + what + (ok ? "" : `: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)); };
const day = (closes) => closes.map(c => M.candle(c, c, c, c));  // flat candles: the typical price is the close, so VWAP is the average of the closes
const at = (closes, atr, k = closes.length - 1) => M.vwapGap(day(closes), k, closes.map(() => atr));
check("the VWAP is the page's own (the average so far)", at([100, 110], 10).vwap, 105);
check("price above: side, points, gap in ATR", [at([100, 110], 10).side, at([100, 110], 10).gap, at([100, 110], 10).gapAtr], ["above", 5, 0.5]);
check("price below: side and a negative gap", [at([100, 90], 10).side, at([100, 90], 10).gap], ["below", -5]);
check("on the line", [at([100, 100], 10).side, at([100, 100], 10).gapAtr, at([100, 100], 10).sinceTouch], ["on", 0, 0]);
check("far from VWAP from 3 ATR on", [at([100, 100 - 59], 10).far, at([100, 100 - 60], 10).far], [false, true]);
const fall = [100, 80, 60, 40];  // falls away and never touches the average again
check("a day that only falls: candles since the last touch, no return, the widest gap now", [at(fall, 10).sinceTouch, at(fall, 10).returns, at(fall, 10).widest, at(fall, 10).widestAt], [3, 0, 3, 3]);
const back = [M.candle(100, 100, 100, 100), M.candle(80, 80, 80, 80), M.candle(80, 95, 80, 85)];  // away by 1 ATR, then a candle reaches the VWAP again
const r = M.vwapGap(back, 2, [10, 10, 10]);
check("a return after 1 ATR away is counted, and the touch is now", [r.returns, r.sinceTouch, r.widest, r.widestAt], [1, 0, 1, 1]);
const near = [M.candle(100, 100, 100, 100), M.candle(96, 96, 96, 96), M.candle(96, 99, 96, 97)];
check("a touch after a small move is not a return", M.vwapGap(near, 2, [10, 10, 10]).returns, 0);
const two = day([100, 80]).concat([M.candle(80, 95, 80, 90), M.candle(110, 110, 110, 110), M.candle(110, 110, 90, 95)]);
check("two returns in a day", M.vwapGap(two, 4, [10, 10, 10, 10, 10]).returns, 2);
check("no ATR, or no such candle: no reading", [M.vwapGap(day([100, 90]), 1, [null, null]), M.vwapGap(day([100, 90]), 1, null), M.vwapGap(day([100]), 3, [10]), M.vwapGap(null, 0, [10])], [null, null, null, null]);
const cs = day([100, 90, 80]); check("only the candles up to k are read (no peeking)", M.vwapGap(cs, 1, [10, 10, 10]), M.vwapGap(cs.slice(0, 2), 1, [10, 10]));
check("nothing of a past day is in the reading", Object.keys(at([100, 90], 10)).sort(), ["far", "gap", "gapAtr", "returns", "side", "sinceTouch", "vwap", "widest", "widestAt"]);
console.log("\n" + (bad ? bad + " WRONG" : "all fine")); process.exit(bad ? 1 : 0);
