// The Impulse MACD on the Volume Profile page (15 November, the owner, with LazyBear's Pine script "Impulse MACD": "go through it
// properly, develope a best strategy out of it and develop the same on volume profile page ... Test this on the Nifty 50 data").
// One code for the page (static/volume.html) and the check (lab/check_impulse.js). Paper only: it states a call, no order is placed.
//
// THE INDICATOR, as the script counts it (lengthMA 34, lengthSignal 9), over candles oldest first:
//   hi, lo   the smoothed average (SMMA) of the highs and of the lows: the first value is the plain average of the first 34,
//            then (previous * 33 + this candle's) / 34. Together they are a channel around the price
//   mi       a zero-lag average of (high + low + close) / 3: ema1 + (ema1 - ema2), ema2 being the EMA of ema1
//   md       the "Impulse MACD": mi - hi while mi is above the channel, mi - lo while it is below, 0 while it is inside
//   sb       the signal: the plain average of the last 9 md
//   sh       the histogram: md - sb
//   colour   of each md bar: (h+l+c)/3 above mi: "lime" when also above hi, else "green"; not above mi: "red" when below lo, else "orange"
// The averages run on through the days, as on a chart; the page gives them the last five days of candles.
//
// THE CALLS (my own rule). The Impulse MACD alone gave no rule that held on two years of NIFTY 50 5-minute candles (11 Nov 2024
// to 9 Nov 2026): every start of an impulse, every cross of its signal, with every exit tried, lost or held on one year only.
// As a FILTER on the page's own break calls it did better than they do alone:
//   - the break call's signal: a 5-minute candle closes outside the day's value area so far (static/vpshape.js);
//   - the impulse agrees and is growing on that same candle: for Buy CE md is above 0 and above its signal (sh > 0); for Buy PE
//     md is below 0 and below its signal (sh < 0);
//   - the rest is the break call's: entry at the next candle's open, stop at the busiest price of that moment, out at the stop
//     or at the 15:15 open, one call open at a time, a new one after it ends.
// THE WHOLE DAY (15 November, the owner: "IMACD signals should be fired all the day starting from the start of the market session
// till the end. there should not be any time cap or call numbers limit"): the signal candles run from the day's fourth candle
// (09:30, the first with a profile of three candles before it) to the 15:05 candle, the last whose call can still enter before
// the 15:15 exit; there is no limit on the number of calls. On the two years, time in place of volume, after 8 points a call,
// counted as the page counts it (the averages over the last five days of candles): 813 calls, 32% won, -385 (first year -444,
// second +59; CE -700, PE +315; at most 5 a day). By the hour of entry the 9 and 12 o'clock
// hours made points and the 10 and 13 o'clock hours lost more. The same rule held to 12:10-13:30 made +1,199 (266 calls, 38% won): the owner chose the whole day.
// Paper only.
(function (root) {
  "use strict";
  const VpShape = typeof module !== "undefined" && module.exports ? require("./vpshape.js") : root.VpShape;
  const CFG = { lengthMA: 34, lengthSignal: 9, from: "09:15", to: "15:05", minBars: 3 };  // the calls' day: no time cap (the owner, 15 November)
  const IST = 19800;

  // bars: [{time, open, high, low, close}] oldest first. Returns one entry a candle: {time, hi, lo, mi, md, sb, sh, colour}
  // (hi, lo, colour null for the first 33 candles; sb, sh null for the first 41)
  function compute(bars, c = CFG) {
    const n = bars.length, out = new Array(n), a = 2 / (c.lengthMA + 1), L = c.lengthMA, G = c.lengthSignal;
    let sumH = 0, sumL = 0, hi = null, lo = null, e1 = null, e2 = null;
    for (let i = 0; i < n; i++) {
      const b = bars[i], src = (b.high + b.low + b.close) / 3;
      if (i < L) { sumH += b.high; sumL += b.low; if (i === L - 1) { hi = sumH / L; lo = sumL / L; } }
      else { hi = (hi * (L - 1) + b.high) / L; lo = (lo * (L - 1) + b.low) / L; }
      e1 = e1 == null ? src : a * src + (1 - a) * e1; e2 = e2 == null ? e1 : a * e1 + (1 - a) * e2;
      const mi = e1 + (e1 - e2), ready = i >= L - 1;
      const md = !ready ? 0 : mi > hi ? mi - hi : mi < lo ? mi - lo : 0;
      let sb = null;
      if (i >= L - 1 + G - 1) { let s = md; for (let j = i - G + 1; j < i; j++) s += out[j].md; sb = s / G; }
      out[i] = { time: b.time, hi: ready ? hi : null, lo: ready ? lo : null, mi, md, sb, sh: sb == null ? null : md - sb,
                 colour: !ready ? null : src > mi ? (src > hi ? "lime" : "green") : (src < lo ? "red" : "orange") };
    }
    return out;
  }
  // does the impulse agree with a call of this side on this candle, and is it growing?
  const agrees = (x, side) => !!x && x.sh != null && (side === "CE" ? x.md > 0 && x.sh > 0 : x.md < 0 && x.sh < 0);

  // The Impulse calls of the last day in bars5All (5-minute candles of the last days, oldest first, the one forming now last);
  // closed: how many of that day's candles have closed; fine and weights: what that day's profile is counted from (VpShape.calls).
  // Returns {calls: as VpShape.calls, each with md, sb at its signal candle; values: the indicator by candle time (a Map)}
  function calls(bars5All, closed, fine, weights) {
    const all = compute(bars5All), values = new Map(all.map(x => [x.time, x]));
    const day = (t) => Math.floor((t + IST) / 86400), last = bars5All.length ? day(bars5All[bars5All.length - 1].time) : null;
    const today = bars5All.filter(b => day(b.time) === last);
    const day5 = { ...VpShape.CFG, from: CFG.from, to: CFG.to, minBars: CFG.minBars };
    const list = VpShape.calls(today, closed, fine, weights, day5, (bar, side) => agrees(values.get(bar.time), side));
    for (const t of list) { const x = values.get(t.signalTime); t.md = x.md; t.sb = x.sb; }
    return { calls: list, values };
  }

  const api = { CFG, compute, agrees, calls };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Impulse = api;
})(typeof window !== "undefined" ? window : globalThis);
