// Fair value gaps for the Volume Profile page (19 November 2026, the owner: "can you mark FVG on the live candles ?",
// "yes, show the screenshot first"). One code for the page (static/volume.html) and the check (lab/check_fvg.js).
// A marking only: nothing here decides a call, and nothing of the profile, the shapes or the signals reads it.
//
// Three candles in a row of one session, all of them closed:
//   bullish gap: candle 3's low is above candle 1's high  -> the gap is from candle 1's high up to candle 3's low
//   bearish gap: candle 3's high is below candle 1's low  -> the gap is from candle 3's high up to candle 1's low
// A gap narrower than MIN_SHARE of the price is left out (0.04%: about 10 points on NIFTY 50, 25 on NIFTY BANK, 33 on SENSEX;
// on two years of NIFTY 50 the smaller ones were about 9 a day).
// A gap is open until a later candle trades through all of it (a bullish gap: a low at or below its bottom; a bearish gap:
// a high at or above its top); the candle forming now counts for that, as its high and low have already been traded.
// The owner's data, 499 days of NIFTY 50: a return to a gap bounced 45% and went through 47% of the time, so the page
// calls it a marking, not a signal.
(function (root) {
  "use strict";
  const IST = 19800, MIN_SHARE = 0.0004;
  const dayOf = (t) => Math.floor((t + IST) / 86400);
  // bars: candles oldest first ({time, open, high, low, close}); closed: how many of them have closed (the rest is forming)
  // Returns [{side: "bull" | "bear", top, bottom, from (candle 1's time), at (candle 3's time), filled (time of the candle
  // that filled it, or null while open)}], oldest first
  function find(bars, closed, minShare) {
    const out = [], n = Math.min(closed == null ? bars.length : closed, bars.length), share = minShare == null ? MIN_SHARE : minShare;
    for (let k = 2; k < n; k++) {
      const a = bars[k - 2], c = bars[k];
      if (dayOf(a.time) !== dayOf(c.time)) continue;
      const bull = c.low > a.high, bear = c.high < a.low;
      if (!bull && !bear) continue;
      const top = bull ? c.low : a.low, bottom = bull ? a.high : c.high;
      if (top - bottom < share * c.close) continue;
      let filled = null;
      for (let i = k + 1; i < bars.length; i++) if (bull ? bars[i].low <= bottom : bars[i].high >= top) { filled = bars[i].time; break; }
      out.push({ side: bull ? "bull" : "bear", top, bottom, from: a.time, at: c.time, filled });
    }
    return out;
  }
  const api = { MIN_SHARE, find };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Fvg = api;
})(typeof window !== "undefined" ? window : globalThis);
