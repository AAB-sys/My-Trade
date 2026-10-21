// New Rule Chart (the owner's documents 04 and 02, 21 October): the Fibonacci retracement levels of the latest clear move, drawn
// on the chart when the Fib Levels tick is on under Calls with Signals. This file is the new set of rules' engine, apart from the
// Paper calls rule in rules.js, which it never touches. First PR: the levels alone, no entry, no filter, no call.
//
// The move (document 04, sections 4 and 5): B is the latest swing high (a candle whose high is at least as high as the 3 candles
// before and the 3 after; known once the third candle after it has closed); A is the lowest low in the 36 candles before B; no high
// between A and B above B; B at least 3 candles after A; B - A at least 3 times the ATR(14) (Wilder, as of the candle before B).
// A down-move is the mirror: B a swing low, A the highest high before it. When both sides have a move, the later B wins.
// The levels (section 3): leg = |B - A|; up-move: price(r) = B - r x leg; down-move: price(r) = B + r x leg, for r = 1 (A), 0.786,
// 0.618, 0.5, 0.382, 0.236, 0 (B), -0.272, -0.618, -1 (the extensions beyond B).
(function (root) {
  "use strict";
  const round2 = (x) => Math.round(x * 100) / 100;
  const RATIOS = [1, 0.786, 0.618, 0.5, 0.382, 0.236, 0, -0.272, -0.618, -1];
  const CFG = { swingN: 3, maxLeg: 36, minLegCandles: 3, impulseAtr: 3, atrPeriod: 14 };

  // ATR(14) with Wilder smoothing, seeded by the simple average of the first 14 true ranges: atr[i] is the ATR as of candle i
  // (candles 0..i); null until 14 true ranges exist (the first candle has no previous close: its true range is its own range)
  function atrSeries(bars, period = CFG.atrPeriod) {
    const out = [], trs = [];
    let atr = null;
    bars.forEach((b, i) => {
      const prev = i ? bars[i - 1].close : null;
      const tr = prev == null ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev));
      trs.push(tr);
      if (atr == null) { if (trs.length >= period) atr = trs.slice(-period).reduce((s, x) => s + x, 0) / period; }
      else atr = (atr * (period - 1) + tr) / period;
      out.push(atr);
    });
    return out;
  }
  // The confirmed swings among bars[0..last]: candle i is a swing high (d = +1) or low (d = -1) when its high (low) is at least as
  // extreme as the n candles on each side; known only once candle i + n exists among the closed candles
  function findSwings(bars, d, n = CFG.swingN) {
    const ext = (b) => d > 0 ? b.high : b.low, out = [];
    for (let i = n; i + n < bars.length; i++) {
      let ok = true;
      for (let j = i - n; j <= i + n && ok; j++) if (j !== i && d * (ext(bars[i]) - ext(bars[j])) < 0) ok = false;
      if (ok) out.push(i);
    }
    return out;
  }
  // The latest clear move on one side, or null. atrAt: the ATR to measure the move with (a test may fix it); else the series'
  function moveOnSide(bars, d, cfg = CFG, atrFixed = null) {
    const swings = findSwings(bars, d, cfg.swingN);
    const atrs = atrFixed == null ? atrSeries(bars, cfg.atrPeriod) : null;
    const end = (b) => d > 0 ? b.high : b.low, start = (b) => d > 0 ? b.low : b.high;
    for (let s = swings.length - 1; s >= 0; s--) {  // the latest swing first; an unfit one lets the one before stand
      const b = swings[s], B = end(bars[b]);
      const w0 = Math.max(0, b - cfg.maxLeg);
      let a = -1;
      for (let j = w0; j < b; j++) if (a < 0 || d * (start(bars[j]) - start(bars[a])) < 0) a = j;
      if (a < 0 || b - a < cfg.minLegCandles) continue;
      let clean = true;
      for (let j = a; j < b && clean; j++) if (d * (end(bars[j]) - B) > 0) clean = false;
      if (!clean) continue;
      const A = start(bars[a]), leg = d * (B - A);
      const atr = atrFixed != null ? atrFixed : (b > 0 ? atrs[b - 1] : null);
      if (atr == null || leg < cfg.impulseAtr * atr) continue;
      return { side: d > 0 ? "CE" : "PE", up: d > 0, a, b, A: round2(A), B: round2(B), leg: round2(leg), atr: round2(atr), aTime: bars[a].time, bTime: bars[b].time,
               levels: RATIOS.map(r => ({ ratio: r, price: round2(B - d * r * leg), name: levelName(r) })) };
    }
    return null;
  }
  const levelName = (r) => (r === 0 ? "0" : r === 1 ? "100" : (r * 100).toFixed(1).replace(/\.0$/, "")) + "%";  // "78.6%", "0%" (B), "-27.2%", "100%" (A)
  // The latest clear move on either side (the later B wins), on the closed candles given
  function moveAt(bars, cfg = CFG, atrFixed = null) {
    const up = moveOnSide(bars, 1, cfg, atrFixed), down = moveOnSide(bars, -1, cfg, atrFixed);
    if (up && down) return up.b >= down.b ? up : down;
    return up || down;
  }
  const atrStep = (prevAtr, tr, period = CFG.atrPeriod) => (prevAtr * (period - 1) + tr) / period;  // one Wilder step (document 02, T11)
  root.NewRule = { RATIOS, CFG, atrSeries, atrStep, findSwings, moveOnSide, moveAt, levelName, round2 };
})(typeof globalThis !== "undefined" ? globalThis : this);
