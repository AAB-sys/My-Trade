// The fair value gaps of the Volume Profile page (static/fvg.js): node lab/check_fvg.js
"use strict";
const F = require("../static/fvg.js"); let ok = true;
const check = (what, cond) => { ok = ok && !!cond; console.log((cond ? "ok   " : "FAIL ") + what); };
const T0 = Date.parse("2026-11-18T09:15:00+05:30") / 1000, bar = (i, o, h, l, c) => ({ time: T0 + i * 300, open: o, high: h, low: l, close: c });
// a bullish gap: candle 1's high 25200, candle 3's low 25215
let b = [bar(0, 25190, 25200, 25185, 25198), bar(1, 25198, 25230, 25196, 25228), bar(2, 25228, 25240, 25215, 25235), bar(3, 25235, 25238, 25220, 25225)];
let g = F.find(b, 4);
check("a bullish gap: from candle 1's high up to candle 3's low, open", g.length === 1 && g[0].side === "bull" && g[0].bottom === 25200 && g[0].top === 25215 && g[0].from === b[0].time && g[0].at === b[2].time && g[0].filled === null);
b.push(bar(4, 25225, 25226, 25207, 25210)); g = F.find(b, 5);
check("a dip into the gap that does not reach its bottom leaves it open", g[0].filled === null);
b.push(bar(5, 25210, 25212, 25199, 25202)); g = F.find(b, 6);
check("a low at or below its bottom fills it, at that candle", g[0].filled === b[5].time);
// a bearish gap: candle 1's low 25300, candle 3's high 25280
let d = [bar(0, 25310, 25315, 25300, 25302), bar(1, 25302, 25304, 25270, 25272), bar(2, 25272, 25280, 25260, 25265), bar(3, 25265, 25290, 25262, 25288)];
g = F.find(d, 4);
check("a bearish gap: from candle 3's high up to candle 1's low", g.length === 1 && g[0].side === "bear" && g[0].bottom === 25280 && g[0].top === 25300 && g[0].filled === null);
d.push(bar(4, 25288, 25300, 25285, 25298)); check("a high at or above its top fills it", F.find(d, 5)[0].filled === d[4].time);
// size, the forming candle, the session
let s = [bar(0, 25190, 25200, 25185, 25198), bar(1, 25198, 25212, 25196, 25210), bar(2, 25210, 25215, 25205, 25212)];
check("a gap under 0.04% of the price (5 points here) is left out", F.find(s, 3).length === 0 && F.find(s, 3, 0).length === 1);
check("0.04% is about 10 points on NIFTY 50", Math.abs(F.MIN_SHARE * 25200 - 10.08) < 1e-9);
check("the third candle must have closed: no gap from the candle forming now", F.find(b.slice(0, 3), 2).length === 0 && F.find(b.slice(0, 3), 3).length === 1);
const y = [{ ...bar(0, 25100, 25110, 25090, 25105), time: T0 - 86400 + 74 * 300 - 300 }, { ...bar(0, 25105, 25112, 25100, 25110), time: T0 - 86400 + 74 * 300 }, bar(0, 25200, 25240, 25195, 25235), bar(1, 25235, 25250, 25230, 25245)];
check("no gap across two sessions (the overnight gap is not one)", F.find(y, 4).length === 0);
check("an open gap is filled by the forming candle too (its low is already traded)", F.find([...b.slice(0, 4), bar(4, 25225, 25226, 25199, 25205)], 4)[0].filled === T0 + 4 * 300);
check("the candles are not changed", JSON.stringify(b[0]) === JSON.stringify(bar(0, 25190, 25200, 25185, 25198)));
console.log(ok ? "all fine" : "SOMETHING FAILED"); process.exit(ok ? 0 : 1);
