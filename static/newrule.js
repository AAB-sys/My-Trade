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

  // ---- The double top (Buy PE) and double bottom (Buy CE) rule, with Rule 1 (break-and-hold) and Rule 2 (trailing) after the
  // entry: the owner's "Trading Rules Specification" of 21 October (document 02, double top with candle stick pattern). All on
  // closed 5-minute index candles. The settings are the document's section 9.9 and 6.6 defaults
  const DT = { swingN: 3, minGap: 5, maxGap: 40, maxWait: 20, eqAtr: 0.5, minDepthAtr: 1.5, priorMoveAtr: 2.0, priorLookback: 20, maxChaseAtr: 2.0,
               buffer: "ATR", atrMult: 0.25, fixedPoints: 0, stopPlacement: "AT_LEVEL", entryFrom: "09:30", entryTo: "14:45", eod: "15:30",
               maxLossesInRow: 2, maxTradesPerDay: null, maxLossPerDay: null, skipExpiryDay: true };
  const bufferOf = (atr, cfg) => cfg.buffer === "ATR" ? (atr == null ? null : cfg.atrMult * atr) : cfg.buffer === "FIXED" ? cfg.fixedPoints : 0;
  // Section 9.8: the double top (side "PE", d = +1) or bottom ("CE", d = -1) whose signal candle is k. atr: as of candle k - 1
  function detectEntry(bars, k, side, atr, cfg = DT) {
    const d = side === "PE" ? 1 : -1, ext = (b) => d > 0 ? b.high : b.low, opp = (b) => d > 0 ? b.low : b.high;
    const buf = bufferOf(atr, cfg);
    if (atr == null || buf == null) return null;
    const tol = cfg.eqAtr * atr;
    const swings = findSwings(bars.slice(0, k + 1), d, cfg.swingN);
    if (!swings.length) return null;
    const b = swings[swings.length - 1];                                  // T2: the latest confirmed swing
    if (k - b > cfg.maxWait) return null;
    const t1s = swings.filter(s => b - s >= cfg.minGap && b - s <= cfg.maxGap);
    for (let i = t1s.length - 1; i >= 0; i--) {                            // T1: the nearest first
      const a = t1s[i], t1 = ext(bars[a]), t2 = ext(bars[b]);
      if (Math.abs(t1 - t2) > tol) continue;                               // check 3: roughly equal
      const top = d * (t1 - t2) >= 0 ? t1 : t2, near = top === t1 ? t2 : t1;
      let beyond = false; for (let j = a + 1; j < b; j++) if (d * (ext(bars[j]) - top) > 0) beyond = true;
      if (beyond) continue;                                                // check 4: nothing beyond the tops between them
      let neck = null; for (let j = a + 1; j < b; j++) { const v = opp(bars[j]); if (neck == null || d * (v - neck) < 0) neck = v; }
      if (neck == null || d * (near - neck) < cfg.minDepthAtr * atr) continue;  // check 5: deep enough
      const s0 = Math.max(0, a - cfg.priorLookback);
      let prior = null; for (let j = s0; j <= a; j++) { const v = opp(bars[j]); if (prior == null || d * (v - prior) < 0) prior = v; }
      if (d * (t1 - prior) < cfg.priorMoveAtr * atr) continue;            // check 6: a real move into T1
      let closedBeyond = false; for (let j = a; j <= k; j++) if (d * (bars[j].close - top) > 0) closedBeyond = true;
      if (closedBeyond) continue;                                          // check 7: still valid
      const start = b + cfg.swingN;                                        // first close only, counted from T2's confirmation
      let usedUp = false; for (let j = start; j < k; j++) if (d * (neck - bars[j].close) > buf) usedUp = true;
      if (usedUp) continue;
      const dist = d * (neck - bars[k].close);
      if (dist <= buf) continue;                                           // no break by the buffer on this candle
      if (dist > cfg.maxChaseAtr * atr) return null;                       // too far past the neckline: skip
      const height = d * (top - neck);
      return { side, rule: d > 0 ? "double top" : "double bottom", kind: d > 0 ? "double top confirmed" : "double bottom confirmed", t1: a, t2: b, t1Time: bars[a].time, t2Time: bars[b].time, top: round2(top), neckline: round2(neck), L: round2(neck), height: round2(height),
               target: round2(neck - d * height), signalCandle: k, signalTime: bars[k].time, buffer: round2(buf), atr: round2(atr) };
    }
    return null;
  }
  // ---- The double bottom (the owner's "Double Bottom Chart Pattern" document, 21 October): two lows within 0.5 ATR, 5 to 40
  // candles apart, nothing below them between, the neckline the highest high between them at least 1.5 ATR above the higher
  // bottom, a fall of 2 ATR into the first bottom. The pattern ends one of two ways, one trade per pattern: a close above the
  // neckline by the buffer, Buy CE (the breakout); before any breakout, a close below the support (the lower bottom) by the
  // buffer, Buy PE (the failure). Section 13 of the document, to the letter. The 5-minute settings; the daily chart is not built
  function detectDoubleBottom(bars, k, side, atr, cfg = DT) {
    const buf = bufferOf(atr, cfg);
    if (atr == null || buf == null) return null;
    const lows = findSwings(bars.slice(0, k + 1), -1, cfg.swingN);
    if (!lows.length) return null;
    const b2 = lows[lows.length - 1];
    if (k - b2 > cfg.maxWait) return null;
    const b1s = lows.filter(s => b2 - s >= cfg.minGap && b2 - s <= cfg.maxGap);
    for (let i = b1s.length - 1; i >= 0; i--) {
      const b1 = b1s[i], low1 = bars[b1].low, low2 = bars[b2].low;
      if (Math.abs(low1 - low2) > cfg.eqAtr * atr) continue;                                   // 3
      const lower = Math.min(low1, low2), higher = Math.max(low1, low2);
      let below = false, neck = null;
      for (let j = b1 + 1; j < b2; j++) { if (bars[j].low < lower) below = true; if (neck == null || bars[j].high > neck) neck = bars[j].high; }
      if (below || neck == null) continue;                                                       // 4
      if (neck - higher < cfg.minDepthAtr * atr) continue;                                       // 5
      const s0 = Math.max(0, b1 - cfg.priorLookback);
      let priorHigh = -Infinity; for (let j = s0; j <= b1; j++) priorHigh = Math.max(priorHigh, bars[j].high);
      if (priorHigh - low1 < cfg.priorMoveAtr * atr) continue;                                   // 6
      const height = round2(neck - lower), start = b2 + cfg.swingN;
      let brokeOut = false, brokeDown = false;
      for (let j = start; j < k; j++) { if (bars[j].close - neck > buf) brokeOut = true; if (lower - bars[j].close > buf) brokeDown = true; }
      if (side === "CE") {
        let closedBelow = false; for (let j = b1; j <= k; j++) if (bars[j].close < lower) closedBelow = true;
        if (closedBelow || brokeOut) continue;                                                   // 7, used up
        const dist = bars[k].close - neck;
        if (dist <= buf) continue;
        if (dist > cfg.maxChaseAtr * atr) return null;
        return { side: "CE", rule: "double bottom", kind: "double bottom confirmed", t1: b1, t2: b2, t1Time: bars[b1].time, t2Time: bars[b2].time, neckline: round2(neck), support: round2(lower),
                 L: round2(neck), height, target: round2(neck + height), signalCandle: k, signalTime: bars[k].time, buffer: round2(buf), atr: round2(atr) };
      }
      if (brokeOut || brokeDown) continue;                                                       // 7, used up
      const dist = lower - bars[k].close;
      if (dist <= buf) continue;
      if (dist > cfg.maxChaseAtr * atr) return null;
      return { side: "PE", rule: "double bottom", kind: "double bottom failed", t1: b1, t2: b2, t1Time: bars[b1].time, t2Time: bars[b2].time, neckline: round2(neck), support: round2(lower),
               L: round2(lower), height, target: round2(lower - height), signalCandle: k, signalTime: bars[k].time, buffer: round2(buf), atr: round2(atr) };
    }
    return null;
  }
  // ---- The triple top (the owner's "Triple Top Chart Pattern" document, 21 October): three highs within 0.5 ATR, each 5 to 40
  // candles after the one before, nothing above them between; the resistance the highest top, the neckline the lower of the two
  // dip lows, both dips at least 1.5 ATR below the lowest top; a rise of 2 ATR into the first top. A close below the neckline by
  // the buffer, Buy PE (the breakdown); before any breakdown, a close above the resistance by the buffer, Buy CE (the failure)
  function detectTripleTop(bars, k, side, atr, cfg = DT) {
    const buf = bufferOf(atr, cfg);
    if (atr == null || buf == null) return null;
    const highs = findSwings(bars.slice(0, k + 1), 1, cfg.swingN);
    if (!highs.length) return null;
    const t3 = highs[highs.length - 1];
    if (k - t3 > cfg.maxWait) return null;
    const gapOk = (a, b) => b - a >= cfg.minGap && b - a <= cfg.maxGap;
    const t2s = highs.filter(s => gapOk(s, t3));
    for (let i2 = t2s.length - 1; i2 >= 0; i2--) {
      const t2 = t2s[i2], t1s = highs.filter(s => gapOk(s, t2));
      for (let i1 = t1s.length - 1; i1 >= 0; i1--) {
        const t1 = t1s[i1], tops = [bars[t1].high, bars[t2].high, bars[t3].high];
        const resistance = Math.max(...tops), lowestTop = Math.min(...tops);
        if (resistance - lowestTop > cfg.eqAtr * atr) continue;                                  // 3
        let above = false; for (let j = t1 + 1; j < t3; j++) if (bars[j].high > resistance) above = true;
        if (above) continue;                                                                     // 4
        let p1 = Infinity, p2 = Infinity;
        for (let j = t1 + 1; j < t2; j++) p1 = Math.min(p1, bars[j].low);
        for (let j = t2 + 1; j < t3; j++) p2 = Math.min(p2, bars[j].low);
        const neck = Math.min(p1, p2);
        if (lowestTop - Math.max(p1, p2) < cfg.minDepthAtr * atr) continue;                       // 5
        const s0 = Math.max(0, t1 - cfg.priorLookback);
        let priorLow = Infinity; for (let j = s0; j <= t1; j++) priorLow = Math.min(priorLow, bars[j].low);
        if (bars[t1].high - priorLow < cfg.priorMoveAtr * atr) continue;                         // 6
        const height = round2(resistance - neck), start = t3 + cfg.swingN;
        let brokeDown = false, brokeOut = false;
        for (let j = start; j < k; j++) { if (neck - bars[j].close > buf) brokeDown = true; if (bars[j].close - resistance > buf) brokeOut = true; }
        const base = { rule: "triple top", t1, t2, t3, t1Time: bars[t1].time, t2Time: bars[t2].time, t3Time: bars[t3].time, neckline: round2(neck), resistance: round2(resistance), height,
                       signalCandle: k, signalTime: bars[k].time, buffer: round2(buf), atr: round2(atr) };
        if (side === "PE") {
          let closedAbove = false; for (let j = t1; j <= k; j++) if (bars[j].close > resistance) closedAbove = true;
          if (closedAbove || brokeDown) continue;                                                // 7, used up
          const dist = neck - bars[k].close;
          if (dist <= buf) continue;
          if (dist > cfg.maxChaseAtr * atr) return null;
          return { ...base, side: "PE", kind: "triple top confirmed", L: round2(neck), target: round2(neck - height) };
        }
        if (brokeDown || brokeOut) continue;                                                     // 7, used up
        const dist = bars[k].close - resistance;
        if (dist <= buf) continue;
        if (dist > cfg.maxChaseAtr * atr) return null;
        return { ...base, side: "CE", kind: "triple top failed", L: round2(resistance), target: round2(resistance + height) };
      }
    }
    return null;
  }
  // ---- The triple bottom (the owner's "Triple Bottom Chart Pattern" document, 21 October): three swing lows within 0.5 ATR, each
  // 5 to 40 candles after the one before, nothing below them between; the support the lowest bottom, the neckline the higher of
  // the two bounce highs, both bounces at least 1.5 ATR above the highest bottom; a fall of 2 ATR into the first bottom. A close
  // above the neckline by the buffer, Buy CE (the breakout); before any breakout, a close below the support by the buffer, Buy PE
  function detectTripleBottom(bars, k, side, atr, cfg = DT) {
    const buf = bufferOf(atr, cfg);
    if (atr == null || buf == null) return null;
    const lows = findSwings(bars.slice(0, k + 1), -1, cfg.swingN);
    if (!lows.length) return null;
    const b3 = lows[lows.length - 1];
    if (k - b3 > cfg.maxWait) return null;
    const gapOk = (a, b) => b - a >= cfg.minGap && b - a <= cfg.maxGap;
    const b2s = lows.filter(s => gapOk(s, b3));
    for (let i2 = b2s.length - 1; i2 >= 0; i2--) {
      const b2 = b2s[i2], b1s = lows.filter(s => gapOk(s, b2));
      for (let i1 = b1s.length - 1; i1 >= 0; i1--) {
        const b1 = b1s[i1], bottoms = [bars[b1].low, bars[b2].low, bars[b3].low];
        const support = Math.min(...bottoms), highestBottom = Math.max(...bottoms);
        if (highestBottom - support > cfg.eqAtr * atr) continue;                                 // 3
        let below = false; for (let j = b1 + 1; j < b3; j++) if (bars[j].low < support) below = true;
        if (below) continue;                                                                     // 4
        let h1 = -Infinity, h2 = -Infinity;
        for (let j = b1 + 1; j < b2; j++) h1 = Math.max(h1, bars[j].high);
        for (let j = b2 + 1; j < b3; j++) h2 = Math.max(h2, bars[j].high);
        const neck = Math.max(h1, h2);
        if (Math.min(h1, h2) - highestBottom < cfg.minDepthAtr * atr) continue;                  // 5
        const s0 = Math.max(0, b1 - cfg.priorLookback);
        let priorHigh = -Infinity; for (let j = s0; j <= b1; j++) priorHigh = Math.max(priorHigh, bars[j].high);
        if (priorHigh - bars[b1].low < cfg.priorMoveAtr * atr) continue;                         // 6
        const height = round2(neck - support), start = b3 + cfg.swingN;
        let brokeOut = false, brokeDown = false;
        for (let j = start; j < k; j++) { if (bars[j].close - neck > buf) brokeOut = true; if (support - bars[j].close > buf) brokeDown = true; }
        const base = { rule: "triple bottom", t1: b1, t2: b2, t3: b3, t1Time: bars[b1].time, t2Time: bars[b2].time, t3Time: bars[b3].time, neckline: round2(neck), support: round2(support), height,
                       signalCandle: k, signalTime: bars[k].time, buffer: round2(buf), atr: round2(atr) };
        if (side === "CE") {
          let closedBelow = false; for (let j = b1; j <= k; j++) if (bars[j].close < support) closedBelow = true;
          if (closedBelow || brokeOut) continue;                                                 // 7, used up
          const dist = bars[k].close - neck;
          if (dist <= buf) continue;
          if (dist > cfg.maxChaseAtr * atr) return null;
          return { ...base, side: "CE", kind: "triple bottom confirmed", L: round2(neck), target: round2(neck + height) };
        }
        if (brokeOut || brokeDown) continue;                                                     // 7, used up
        const dist = support - bars[k].close;
        if (dist <= buf) continue;
        if (dist > cfg.maxChaseAtr * atr) return null;
        return { ...base, side: "PE", kind: "triple bottom failed", L: round2(support), target: round2(support - height) };
      }
    }
    return null;
  }
  // Rule 2 (sections 6.5 and 5): one closed candle against the stop and the levels; st = { trailIdx, stop }; lv ordered in the
  // profit direction. Returns "SELL" or "HOLD"; the exit is checked on the stop as it stood before the candle
  function trailStep(st, close, lv, d, buf, cfg = DT) {
    if (d * (close - st.stop) < 0) return "SELL";
    let next = st.trailIdx;
    lv.forEach((l, i) => { if (i > st.trailIdx && d * (close - l.price) > buf) next = i; });
    if (next > st.trailIdx) {
      st.trailIdx = next;
      const stopIdx = cfg.stopPlacement === "AT_LEVEL" ? next : next - 1;
      if (stopIdx >= 0 && d * (lv[stopIdx].price - st.stop) > 0) { st.stop = lv[stopIdx].price; st.stopPct = lv[stopIdx].pct; }
    }
    return "HOLD";
  }
  const istHM = (t) => { const s = (t + 19800) % 86400; return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s % 3600 / 60)).padStart(2, "0")}`; };
  const pctName = (l) => l.pct != null ? l.pct : "";
  // The day replayed: the entries, Rule 1 and Rule 2 over closed candles. levels: [{pct, price}] of the chart (sorted by price);
  // atrSeed: the ATR to start the day with (from the previous day's candles), else the day warms up on its own 14 candles;
  // atrFixed: a test's fixed ATR. One trade at a time; both sides firing on one candle skip both; the filters of section 9.5
  // closedCount: how many of the bars have closed (the rest is the candle forming now: an entry may take its open, nothing else)
  // sides: the double top ("PE") alone for now (the owner, 21 October: the double bottom's logic comes in another document)
  // rules: which patterns run, in order: the double top (Buy PE), the double bottom (Buy CE, or Buy PE when it fails), the triple top
  // (Buy PE, or Buy CE when it fails), the triple bottom (Buy CE, or Buy PE when it fails). Rules firing on one candle the same way: the first in the list; different ways: nothing
  const RULES = { "double top": (bars, k, atr, cfg) => [detectEntry(bars, k, "PE", atr, cfg)],
                  "double bottom": (bars, k, atr, cfg) => [detectDoubleBottom(bars, k, "CE", atr, cfg), detectDoubleBottom(bars, k, "PE", atr, cfg)],
                  "triple top": (bars, k, atr, cfg) => [detectTripleTop(bars, k, "PE", atr, cfg), detectTripleTop(bars, k, "CE", atr, cfg)],
                  "triple bottom": (bars, k, atr, cfg) => [detectTripleBottom(bars, k, "CE", atr, cfg), detectTripleBottom(bars, k, "PE", atr, cfg)] };
  function runDay({ bars, levels, cfg = DT, atrSeed = null, atrFixed = null, expiryDay = false, dayEnd = true, closedCount = null, sides = ["PE"], rules = ["double top", "double bottom", "triple top", "triple bottom"] }) {
    const atrs = atrFixed != null ? bars.map(() => atrFixed) : atrSeries(bars);
    if (atrSeed != null && atrFixed == null) {  // carry the previous day's ATR in: Wilder steps from the seed
      let a = atrSeed; bars.forEach((b, i) => { const prev = i ? bars[i - 1].close : null; const tr = prev == null ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev)); a = atrStep(a, tr, cfg.atrPeriod || 14); atrs[i] = a; });
    }
    const trades = [], skipped = [];
    let open = null, lossesInRow = 0, dayLoss = 0;
    const lastK = (closedCount == null ? bars.length : Math.min(closedCount, bars.length)) - 1;
    for (let k = 0; k <= lastK; k++) {
      const bar = bars[k], atr = k > 0 ? atrs[k - 1] : null;
      if (open) {  // the trade on this candle's close (the entry candle itself is judged too, as C2 is the candle after C1)
        const t = open, d = t.side === "CE" ? 1 : -1, buf = bufferOf(atr, cfg) || 0;
        let how = null;
        if (k === lastK && dayEnd && !how) how = "day end";
        else if (t.stage === 1) {
          if (d * (bar.close - t.L) < 0) how = "reclaim";                   // Exit A
          else if (k === t.signalCandle + 1 && d * (bar.open - t.c1.close) > 0 && d * (t.c1.open - (d > 0 ? bar.low : bar.high)) >= 0) how = "retouch";  // Exit B, C2 only
          if (!how) {  // the first level crossed (by the buffer) starts the trailing: the stop sits on it (or one back, never behind L)
            const st = { trailIdx: -1, stop: t.L, stopPct: t.Lpct };
            if (trailStep(st, bar.close, t.lv, d, buf, cfg) === "HOLD" && st.trailIdx >= 0) { t.stage = 2; t.st = st; }
          }
        } else if (trailStep(t.st, bar.close, t.lv, d, buf, cfg) === "SELL") how = "trail";
        t.stop = t.stage === 2 ? t.st.stop : t.L; t.stopPct = t.stage === 2 ? t.st.stopPct : t.Lpct;
        if (how) { t.exit = bar.close; t.exitTime = bar.time; t.how = how; t.points = round2(d * (bar.close - t.entry)); open = null;
          if (t.points < 0) { lossesInRow++; dayLoss += -t.points; } else lossesInRow = 0; }
        if (open || how === "day end") continue;
      }
      if (k + 1 >= bars.length) break;  // a signal on the last candle has no next candle to enter on
      const found = [];
      for (const name of rules) {
        if (name === "double top") { if (sides.includes("PE")) found.push(detectEntry(bars, k, "PE", atr, cfg)); if (sides.includes("CE")) found.push(detectEntry(bars, k, "CE", atr, cfg)); }
        else if (RULES[name]) found.push(...RULES[name](bars, k, atr, cfg));
      }
      const sigs = found.filter(Boolean);
      if (!sigs.length) continue;
      if (sigs.some(x => x.side !== sigs[0].side)) { skipped.push({ time: bar.time, why: "rules disagree on one candle: " + sigs.map(x => `${x.rule} ${x.side}`).join(", ") }); continue; }
      const sig = sigs[0], entryBar = bars[k + 1], when = istHM(entryBar.time);
      if (when < cfg.entryFrom || when > cfg.entryTo) { skipped.push({ time: bar.time, side: sig.side, why: "outside entry window" }); continue; }
      if (cfg.maxTradesPerDay != null && trades.length >= cfg.maxTradesPerDay) { skipped.push({ time: bar.time, side: sig.side, why: "daily limit" }); continue; }
      if (cfg.maxLossPerDay != null && dayLoss >= cfg.maxLossPerDay) { skipped.push({ time: bar.time, side: sig.side, why: "daily loss limit" }); continue; }
      if (lossesInRow >= cfg.maxLossesInRow) { skipped.push({ time: bar.time, side: sig.side, why: `${cfg.maxLossesInRow} losses in a row` }); continue; }
      if (cfg.skipExpiryDay && expiryDay) { skipped.push({ time: bar.time, side: sig.side, why: "expiry day" }); continue; }
      const d = sig.side === "CE" ? 1 : -1;
      const lv = levels.slice().sort((x, y) => d * (x.price - y.price)).filter(l => d * (l.price - sig.L) > 0);  // the levels beyond L in the profit direction
      const Lpct = (levels.find(l => Math.abs(l.price - sig.L) < 1e-9) || {}).pct;
      open = { ...sig, entryTime: entryBar.time, entry: entryBar.open, c1: bar, Lpct, lv, stage: 1, stop: sig.L, stopPct: Lpct, exit: null, exitTime: null, points: null, how: "open" };
      trades.push(open);
    }
    return { trades, skipped };
  }
  root.NewRule = { RATIOS, CFG, DT, RULES, atrSeries, atrStep, findSwings, moveOnSide, moveAt, levelName, round2, bufferOf, detectEntry, detectDoubleBottom, detectTripleTop, detectTripleBottom, trailStep, runDay, istHM };
})(typeof globalThis !== "undefined" ? globalThis : this);
