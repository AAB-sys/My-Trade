// New Rule Chart: the engine of the rules under Calls with Signals, built from the owner's chart pattern documents (21 and 22
// October): the double top, double bottom, triple top, triple bottom, falling wedge, rising wedge, bullish rectangle, bullish and
// bearish symmetrical triangle, ascending and descending triangle, with Rule 1 (the reclaim, the retouch, the day end) and the ATR trail after the entry. All on closed 5-minute index
// candles. Apart from the Paper calls rule in rules.js, which it never touches and takes nothing from (the owner, 22 October:
// "completely separate and isolated"). No Fibonacci levels anywhere in here (the owner, 22 October: "I dont want it at all as of now")
(function (root) {
  "use strict";
  const round2 = (x) => Math.round(x * 100) / 100;
  const CFG = { swingN: 3, atrPeriod: 14 };

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
  const atrStep = (prevAtr, tr, period = CFG.atrPeriod) => (prevAtr * (period - 1) + tr) / period;  // one Wilder step (document 02, T11)

  // ---- The double top (Buy PE) and double bottom (Buy CE) rule, with Rule 1 (break-and-hold) after the
  // entry: the owner's "Trading Rules Specification" of 21 October (document 02, double top with candle stick pattern). All on
  // closed 5-minute index candles. The settings are the document's section 9.9 and 6.6 defaults, but for the swing size: 2 candles on each
  // side of a top or bottom (the owner, 26 October: "prepare the PR with swing size 2"; the documents: 3). It sets the double and triple
  // tops and bottoms only: the wedges, the rectangle and the triangles keep their own 3 (WEDGE, RECT, TRI). The double bottom runs its own
  // document's settings since 27 October (DB, below), the double top, the triple top and the triple bottom these
  const DT = { swingN: 2, minGap: 5, maxGap: 40, maxWait: 20, eqAtr: 0.5, minDepthAtr: 1.5, priorMoveAtr: 2.0, priorLookback: 20, maxChaseAtr: 2.0,
               buffer: "ATR", atrMult: 0.25, fixedPoints: 0, entryFrom: "09:30", entryTo: "14:45", eod: "15:30",
               maxLossesInRow: 2, maxTradesPerDay: null, maxLossPerDay: null, skipExpiryDay: true,
               trailAtr: 0.5 };  // the trailing stop after the entry (22 October, the owner: "build the 1 ATR trail", then "tighten it to half an ATR"): half an ATR behind the best close
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
  // ---- The double bottom (the owner's "Double Bottom Chart Pattern" document, version 3 of 27 October, with its reference code
  // double_bottom_reference.py, ported line by line; the first version was built on 21 October): two swing lows within eqAtr x ATR,
  // minGap to 40 candles apart, nothing below them between, the neckline the highest high between them at least 1.5 ATR above the
  // higher bottom, a fall of 2 ATR into the first bottom (checks 1 to 6, the nearest first bottom first). The pattern ends one of two
  // ways, one trade per pattern, whichever triggers first from the candle that confirms the second bottom: Buy CE (the breakout) when a
  // candle's HIGH goes above the neckline by 0.10 x ATR (ceTrigger "high"; "close": its close by the buffer, the first version), Buy PE
  // (the failure) when a candle's LOW goes below the support (the lower bottom) by 0.10 x ATR (peTrigger "low"; "close": its close by
  // the buffer). A candle that triggers both sides gives no signal; the chase check (more than 2 ATR past the line) is on the close.
  // The settings, the document's section 14 (the 5-minute chart; the daily chart is not built):
  //   DB_V3  version 3 (27 October): a bottom needs 2 candles on each side, the bottoms 3 to 40 candles apart
  //   DB_V2  version 2 (24 October, the Buy PE trigger 26 October): 3 candles on each side, 5 to 40 apart; the bottoms within 0.60 ATR,
  //          the triggers on the high and the low
  //   DB_V1  the first version (21 October): within 0.5 ATR, the triggers on the close by the buffer (the lab's document cases)
  //   DB_OLD the page's rule before 27 October: the first version with the swing size 2 of 26 October
  // The owner, 27 October ("V2 table, V3 shadow"; "for nifty 50 only"): on NIFTY 50 (DB.indices) the Calls with Signals table runs
  // version 2 (DB.table) and version 3 runs in shadow (DB.shadow): its signals are logged beside version 2's (runDay's dbLog), each
  // followed on paper, no call. NIFTY BANK and SENSEX keep the page's rule as it was (DB.other), with no log: on the saved days
  // version 2 did better than it on NIFTY 50 and worse on NIFTY BANK. The switch to version 3 is one line, table: DB_V3; going back,
  // table: DB_V2; another index in, its name in indices
  const DB_V3 = { name: "V3", swingN: 2, minGap: 3, maxGap: 40, maxWait: 20, eqAtr: 0.60, minDepthAtr: 1.5, priorMoveAtr: 2.0, priorLookback: 20, maxChaseAtr: 2.0,
                  buffer: "ATR", atrMult: 0.25, fixedPoints: 0, ceTrigger: "high", highBufferAtr: 0.10, peTrigger: "low", lowBufferAtr: 0.10 };
  const DB_V2 = { ...DB_V3, name: "V2", swingN: 3, minGap: 5 };
  const DB_V1 = { ...DB_V2, name: "V1", eqAtr: 0.5, ceTrigger: "close", peTrigger: "close" };
  const DB_OLD = { ...DB_V1, name: "old", swingN: 2 };
  const DB = { table: DB_V2, shadow: DB_V3, indices: ["NIFTY 50"], other: DB_OLD };
  const dbOn = (index) => index == null || DB.indices.includes(index);  // no index given (the lab's cases): the documents' own run
  // How far candle j went past the neckline (up) or the support (down), as the trigger measures it, and the trigger's size
  const dbReach = (b, neck, cfg) => (cfg.ceTrigger === "high" ? b.high : b.close) - neck;
  const dbDrop = (b, lower, cfg) => lower - (cfg.peTrigger === "low" ? b.low : b.close);
  const dbUpBuf = (atr, cfg) => cfg.ceTrigger === "high" ? cfg.highBufferAtr * atr : bufferOf(atr, cfg);
  const dbDownBuf = (atr, cfg) => cfg.peTrigger === "low" ? cfg.lowBufferAtr * atr : bufferOf(atr, cfg);
  // Every double bottom that passes the shared checks 1 to 6 at candle k, the nearest first bottom first (double_bottom_patterns)
  function dbPatterns(bars, k, atr, cfg) {
    const out = [], lows = findSwings(bars.slice(0, k + 1), -1, cfg.swingN);
    if (!lows.length) return out;
    const b2 = lows[lows.length - 1];                                                          // 1. Bottom 2: the latest confirmed swing low
    if (k - b2 > cfg.maxWait) return out;
    const b1s = lows.filter(s => b2 - s >= cfg.minGap && b2 - s <= cfg.maxGap);
    for (let i = b1s.length - 1; i >= 0; i--) {                                               // 2. Bottom 1, the nearest first
      const b1 = b1s[i], low1 = bars[b1].low, low2 = bars[b2].low;
      if (Math.abs(low1 - low2) > cfg.eqAtr * atr) continue;                                   // 3. roughly equal
      const lower = Math.min(low1, low2), higher = Math.max(low1, low2);
      let below = false, neck = -Infinity;
      for (let j = b1 + 1; j < b2; j++) { if (bars[j].low < lower) below = true; neck = Math.max(neck, bars[j].high); }
      if (below) continue;                                                                     // 4. nothing below the bottoms in between
      if (neck - higher < cfg.minDepthAtr * atr) continue;                                     // 5. deep enough
      const s0 = Math.max(0, b1 - cfg.priorLookback);
      let priorHigh = -Infinity; for (let j = s0; j <= b1; j++) priorHigh = Math.max(priorHigh, bars[j].high);
      if (priorHigh - low1 < cfg.priorMoveAtr * atr) continue;                                 // 6. a real fall into Bottom 1
      out.push({ b1, b2, low1, low2, lower, higher, neck, height: neck - lower });
    }
    return out;
  }
  // detect_double_bottom_ce (side "CE", the breakout) and detect_double_bottom_pe ("PE", the failure) at candle k; atr: as of k - 1.
  // A settings set without the trigger keys (the shared DT of the lab's first cases) reads as the first version's close triggers
  function detectDoubleBottom(bars, k, side, atr, cfg = DB.table) {
    if (atr == null || bufferOf(atr, cfg) == null) return null;
    const ub = dbUpBuf(atr, cfg), dbf = dbDownBuf(atr, cfg), bar = bars[k];
    for (const p of dbPatterns(bars, k, atr, cfg)) {
      const start = p.b2 + cfg.swingN;                                                         // counted from Bottom 2's confirmation
      if (side === "CE") {
        let closedBelow = false; for (let j = p.b1; j <= k; j++) if (bars[j].close < p.lower) closedBelow = true;
        if (closedBelow) continue;                                                             // 7. no close below the bottoms
      }
      let usedUp = false, usedOther = false;
      for (let j = start; j < k; j++) {
        const up = dbReach(bars[j], p.neck, cfg) > ub, down = dbDrop(bars[j], p.lower, cfg) > dbf;
        if (side === "CE" ? up : down) usedUp = true;                                            // already triggered earlier: first trigger only
        if (side === "CE" ? down : up) usedOther = true;                                         // the other side already used the pattern
      }
      if (usedUp || usedOther) continue;
      const reach = dbReach(bar, p.neck, cfg), drop = dbDrop(bar, p.lower, cfg);
      if (side === "CE" ? reach <= ub : drop <= dbf) continue;                                 // this candle did not trigger
      if (side === "CE" ? drop > dbf : reach > ub) return null;                                // both sides on one candle: no signal
      const closeDist = side === "CE" ? bar.close - p.neck : p.lower - bar.close;
      if (closeDist > cfg.maxChaseAtr * atr) return null;                                      // closed too far past the line: skip
      const level = side === "CE" ? p.neck : p.lower, past = side === "CE" ? bar.high - p.neck : p.lower - bar.low, height = round2(p.height);
      return { side, rule: "double bottom", kind: side === "CE" ? "double bottom confirmed" : "double bottom failed", t1: p.b1, t2: p.b2, t1Time: bars[p.b1].time, t2Time: bars[p.b2].time,
               neckline: round2(p.neck), support: round2(p.lower), L: round2(level), height, target: round2(side === "CE" ? p.neck + p.height : p.lower - p.height),
               signalCandle: k, signalTime: bar.time, buffer: round2(side === "CE" ? ub : dbf), atr: round2(atr),
               // the shadow log's measures (the brief, section 6): the bottoms, their gap and difference against the limit, the depth
               // against the minimum, how far the high (Buy CE) or the low (Buy PE) went past the line and where the candle closed
               low1: round2(p.low1), low2: round2(p.low2), gap: p.b2 - p.b1, diff: round2(Math.abs(p.low1 - p.low2)), limit: round2(cfg.eqAtr * atr),
               depth: round2(p.neck - p.higher), minDepth: round2(cfg.minDepthAtr * atr), past: round2(past), pastAtr: round2(past / atr), closeDist: round2(closeDist) };
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
  // ---- The falling wedge and the rising wedge (the owner's "Falling Wedge Chart Pattern" and "Rising Wedge Chart Pattern" documents,
  // 21 October): price between two trendlines that get closer, the upper line through the two latest confirmed swing highs (High 1,
  // High 2), the lower through the two latest confirmed swing lows (Low 1, Low 2). Falling: both lines fall and the upper falls
  // faster; rising: both rise and the lower rises faster. Section 8: the touches alternate (High 1 before Low 2, Low 1 before High 2);
  // first to last touch 10 to 60 candles; the width at the first touch at least 2 ATR, at the last touch at most 70% of it; the candle
  // before the apex and within 20 candles of the last touch; every close from the first to the last touch inside the lines by the
  // buffer. Section 9: the first time every check passes the lines are locked and never redrawn; the wedge is dropped 20 candles
  // after the last touch or at the apex; a dropped or traded wedge (the same four touches) is never taken again; while one is locked
  // no other is looked for. One trade per wedge, the first close outside the locked lines by the buffer: falling wedge, above the
  // upper line Buy CE (the breakout), below the lower line Buy PE (the failure); rising wedge, below the lower line Buy PE (the
  // breakdown), above the upper line Buy CE (the failure). A close more than 2 ATR past the line is skipped and the wedge used up.
  // L is the broken line's value on the signal candle; the pattern target L plus (CE) or minus (PE) the widest width. The whole wedge
  // and the signal on one day (runDay runs one day's candles, numbered from its first). The daily chart of the documents is not built
  const WEDGE = { swingN: 3, minLen: 10, maxLen: 60, maxWait: 20, minWidthAtr: 2.0, minNarrowing: 0.3, maxChaseAtr: 2.0 };
  const WEDGES = { "falling wedge": "falling", "rising wedge": "rising" };  // the rule's name and its shape
  // the wedge of the shape ("falling" or "rising") whose checks all pass on closed candle k, or null (section 14, falling_wedge / rising_wedge).
  // cfg.wedge overrides the WEDGE settings (a test); the buffer and the ATR are the rules' shared ones
  function wedgeAt(bars, k, shape, atr, cfg = DT) {
    const w = { ...WEDGE, ...(cfg.wedge || {}) }, buf = bufferOf(atr, cfg);
    if (atr == null || buf == null) return null;
    const upTo = bars.slice(0, k + 1), highs = findSwings(upTo, 1, w.swingN), lows = findSwings(upTo, -1, w.swingN);
    if (highs.length < 2 || lows.length < 2) return null;                                        // 1: the two latest of each
    const h1 = highs[highs.length - 2], h2 = highs[highs.length - 1], l1 = lows[lows.length - 2], l2 = lows[lows.length - 1];
    if (!(h1 < l2 && l1 < h2)) return null;                                                      // 2: overlap
    const first = Math.min(h1, l1), last = Math.max(h2, l2);
    if (last - first < w.minLen || last - first > w.maxLen) return null;                        // 3: length
    if (k - last > w.maxWait) return null;                                                       // 9: recent
    const H1 = bars[h1].high, H2 = bars[h2].high, L1 = bars[l1].low, L2 = bars[l2].low;
    const su = (H2 - H1) / (h2 - h1), sl = (L2 - L1) / (l2 - l1);                                 // the slopes, never rounded
    if (shape === "falling" ? !(sl < 0 && su < sl) : !(su > 0 && sl > su)) return null;          // 4: falling (rising) and converging
    const upper = (t) => H1 + su * (t - h1), lower = (t) => L1 + sl * (t - l1);
    const wFirst = upper(first) - lower(first), wLast = upper(last) - lower(last);
    if (wFirst < w.minWidthAtr * atr) return null;                                               // 5: wide enough
    if (wLast > (1 - w.minNarrowing) * wFirst) return null;                                      // 6: narrowing
    const apex = (L1 - sl * l1 - H1 + su * h1) / (su - sl);
    if (k >= apex) return null;                                                                  // 7: before the apex
    for (let j = first; j <= last; j++) if (bars[j].close > upper(j) + buf || bars[j].close < lower(j) - buf) return null;  // 8: inside
    return { shape, key: `${h1},${h2},${l1},${l2}`, h1, h2, l1, l2, first, last, su, sl, upper, lower, width: wFirst, apex, lockCandle: k };
  }
  // the scanner of section 14 stepped by one closed candle: st = { active: the locked wedge, used: the keys used up }. Returns the
  // signal of candle k or null; skipped (optional) takes the signals skipped for being too far past the line
  function wedgeStep(st, bars, k, shape, atr, cfg = DT, skipped = null) {
    const w = { ...WEDGE, ...(cfg.wedge || {}) };
    if (!st.active) {
      const found = wedgeAt(bars, k, shape, atr, cfg);
      if (!found || st.used.has(found.key)) return null;
      st.active = found;                                                                         // lock the two lines
    }
    const a = st.active;
    if (k - a.last > w.maxWait || k >= a.apex) { st.used.add(a.key); st.active = null; return null; }  // expired
    const buf = bufferOf(atr, cfg), close = bars[k].close;
    if (atr == null || buf == null) return null;
    let side, dist, level;
    if (close - a.upper(k) > buf) { side = "CE"; dist = close - a.upper(k); level = a.upper(k); }
    else if (a.lower(k) - close > buf) { side = "PE"; dist = a.lower(k) - close; level = a.lower(k); }
    else return null;                                                                            // still inside the lines
    st.used.add(a.key); st.active = null;                                                        // one trade per wedge, whichever side came first
    const rule = shape + " wedge";
    if (dist > w.maxChaseAtr * atr) { if (skipped) skipped.push({ time: bars[k].time, side, rule, why: "too far past the line" }); return null; }
    const works = shape === "falling" ? side === "CE" : side === "PE";
    const kind = works ? (shape === "falling" ? "falling wedge broke out" : "rising wedge broke down") : rule + " failed";
    const at = (t) => bars[t].time;
    return { side, rule, kind, h1: a.h1, h2: a.h2, l1: a.l1, l2: a.l2, h1Time: at(a.h1), h2Time: at(a.h2), l1Time: at(a.l1), l2Time: at(a.l2), lockTime: at(a.lockCandle),
             su: a.su, sl: a.sl, width: round2(a.width), L: round2(level), target: round2(side === "CE" ? level + a.width : level - a.width),
             upperLine: [{ time: at(a.first), price: round2(a.upper(a.first)) }, { time: at(k), price: round2(a.upper(k)) }],
             lowerLine: [{ time: at(a.first), price: round2(a.lower(a.first)) }, { time: at(k), price: round2(a.lower(k)) }],
             signalCandle: k, signalTime: at(k), buffer: round2(buf), atr: round2(atr) };
  }
  // ---- The bullish rectangle (the owner's "Bullish Rectangle Chart Pattern" document, 21 October): after a rise, two swing highs
  // within half an ATR of each other and two swing lows within half an ATR, alternating; the resistance the higher high, the support
  // the lower low, both flat, the height at least 2 ATR; the support at least 2 ATR above the lowest low of the 20 candles before the
  // first touch; 10 to 60 candles first to last, every close inside the lines by the buffer, within 20 candles of the last touch.
  // A close above the resistance by the buffer, Buy CE (the breakout); before any breakout, a close below the support, Buy PE (the
  // failure). L is the resistance (CE) or the support (PE); the target that line plus or minus the height. The daily chart is not built
  const RECT = { swingN: 3, minLen: 10, maxLen: 60, maxWait: 20, eqAtr: 0.5, minHeightAtr: 2.0, priorMoveAtr: 2.0, priorLookback: 20, maxChaseAtr: 2.0 };
  function rectangleAt(bars, k, atr, cfg = DT) {
    const w = { ...RECT, ...(cfg.rect || {}) }, buf = bufferOf(atr, cfg);
    if (atr == null || buf == null) return null;
    const upTo = bars.slice(0, k + 1), highs = findSwings(upTo, 1, w.swingN), lows = findSwings(upTo, -1, w.swingN);
    if (highs.length < 2 || lows.length < 2) return null;                                        // 1
    const h1 = highs[highs.length - 2], h2 = highs[highs.length - 1], l1 = lows[lows.length - 2], l2 = lows[lows.length - 1];
    if (!(h1 < l2 && l1 < h2)) return null;                                                      // 2: overlap
    const first = Math.min(h1, l1), last = Math.max(h2, l2);
    if (last - first < w.minLen || last - first > w.maxLen) return null;                        // 3: length
    if (k - last > w.maxWait) return null;                                                       // 8: recent
    const tol = w.eqAtr * atr;
    if (Math.abs(bars[h1].high - bars[h2].high) > tol || Math.abs(bars[l1].low - bars[l2].low) > tol) return null;  // 4: flat
    const resistance = Math.max(bars[h1].high, bars[h2].high), support = Math.min(bars[l1].low, bars[l2].low), height = resistance - support;
    if (height < w.minHeightAtr * atr) return null;                                              // 5: tall enough
    const s0 = Math.max(0, first - w.priorLookback);
    if (s0 >= first) return null;
    let lo = Infinity; for (let j = s0; j < first; j++) lo = Math.min(lo, bars[j].low);
    if (support - lo < w.priorMoveAtr * atr) return null;                                        // 6: a real rise into it
    for (let j = first; j <= last; j++) if (bars[j].close > resistance + buf || bars[j].close < support - buf) return null;  // 7: inside
    return { rule: "bullish rectangle", key: `${h1},${h2},${l1},${l2}`, h1, h2, l1, l2, first, last, upper: () => resistance, lower: () => support, resistance, support, height, width: height, apex: Infinity, priorRise: support - lo, lockCandle: k };
  }
  // the document's scanner for the rectangle, stepped by one closed candle (section 13): st = { active, used };
  // detect gives the pattern passing every check on candle k. A pattern that has already closed outside its lines since its last
  // touch was confirmed is never locked (one break cannot give a second signal through a later set of touches); locked, it is dropped
  // after maxWait candles from the last touch or at the apex; the first close outside the locked lines by the buffer decides the side
  function lockedStep(st, bars, k, detect, w, atr, cfg = DT, skipped = null) {
    const buf = bufferOf(atr, cfg);
    if (atr == null || buf == null) return null;
    if (!st.active) {
      const found = detect(bars, k, atr, cfg);
      if (!found || st.used.has(found.key)) return null;
      let broke = false; for (let j = found.last + w.swingN; j < k; j++) if (bars[j].close > found.upper(j) + buf || bars[j].close < found.lower(j) - buf) broke = true;
      if (broke) { st.used.add(found.key); return null; }                                       // already broke: not new
      st.active = found;                                                                         // lock the lines (and the type)
    }
    const a = st.active;
    if (k - a.last > w.maxWait || k >= a.apex) { st.used.add(a.key); st.active = null; return null; }  // expired
    const close = bars[k].close;
    let side, dist, level;
    if (close - a.upper(k) > buf) { side = "CE"; dist = close - a.upper(k); level = a.upper(k); }
    else if (a.lower(k) - close > buf) { side = "PE"; dist = a.lower(k) - close; level = a.lower(k); }
    else return null;                                                                            // still inside
    st.used.add(a.key); st.active = null;                                                        // one trade per pattern
    const at = (t) => bars[t].time, works = side === "CE";
    if (dist > w.maxChaseAtr * atr) { if (skipped) skipped.push({ time: at(k), side, rule: a.rule, why: "too far past the line" }); return null; }
    const kind = `bullish rectangle ${works ? "broke out" : "failed"}`;
    return { side, rule: a.rule, kind, works, h1: a.h1, h2: a.h2, l1: a.l1, l2: a.l2, h1Time: at(a.h1), h2Time: at(a.h2), l1Time: at(a.l1), l2Time: at(a.l2), lockTime: at(a.lockCandle),
             width: round2(a.width),
             resistance: a.resistance != null ? round2(a.resistance) : undefined, support: a.support != null ? round2(a.support) : undefined, height: a.height != null ? round2(a.height) : undefined,
             L: round2(level), target: round2(side === "CE" ? level + a.width : level - a.width),
             upperLine: [{ time: at(a.first), price: round2(a.upper(a.first)) }, { time: at(k), price: round2(a.upper(k)) }],
             lowerLine: [{ time: at(a.first), price: round2(a.lower(a.first)) }, { time: at(k), price: round2(a.lower(k)) }],
             signalCandle: k, signalTime: at(k), buffer: round2(buf), atr: round2(atr) };
  }
  // the rules with a scanner of their own: the name, and the step over one candle
  // ---- The four triangles of the owner's documents of 22 October evening, each one trade only, in one direction:
  //   the bullish symmetrical triangle (Buy CE): a falling upper line through the two latest swing highs, a rising lower line through
  //     the two latest swing lows, neither more than 3 times steeper than the other, after a rise into it (the 20 candles before the
  //     first touch: the rise into the triangle's middle at least 2 ATR and not less than the fall);
  //   the bearish symmetrical triangle (Buy PE): the same shape after a fall into it (the fall at least 2 ATR and more than the rise);
  //   the ascending triangle (Buy CE): a flat top (the two highs within half an ATR, the resistance the higher) and a rising support
  //     line through the two lows, no trend check;
  //   the descending triangle (Buy PE): a flat bottom (the two lows within half an ATR, the support the lower) and a falling
  //     resistance line through the two highs, no trend check.
  // Shared (section 8 of each): the touches alternate, first to last touch 10 to 60 candles, the width (height) at the first touch
  // at least 2 ATR and at the last touch at most 70% of it, before the apex, every close from the first to the last touch inside
  // the lines by the buffer, within 20 candles of the last touch. Section 9/10: the lines are locked the first time every check
  // passes and never redrawn; a triangle already closed outside its lines since its last touch was confirmed is never locked; the
  // ascending and descending ones also take no triangle whose last touch is not after the last drop (a redraw with one more touch).
  // Locked, each candle in this order: expired (20 candles after the last touch, or the apex) drops it; a close past the OTHER line
  // by the buffer CANCELS it, no trade, never the other side; a close past the break line by the buffer and at most 2 ATR past it is
  // the signal; further than that is skipped, the triangle used up. L is the break line's value on the signal candle (the resistance
  // or the support for the flat ones); the target L plus or minus the widest width. The daily chart of the documents is not built
  const TRI = { swingN: 3, minLen: 10, maxLen: 60, maxWait: 20, minWidthAtr: 2.0, minNarrowing: 0.3, symRatioMax: 3.0, priorLookback: 20, priorMoveAtr: 2.0, flatTolAtr: 0.5, maxChaseAtr: 2.0 };
  // the four touches and the common checks (1, 2, 3, recent), or null
  function touchesAt(bars, k, w) {
    const upTo = bars.slice(0, k + 1), highs = findSwings(upTo, 1, w.swingN), lows = findSwings(upTo, -1, w.swingN);
    if (highs.length < 2 || lows.length < 2) return null;
    const h1 = highs[highs.length - 2], h2 = highs[highs.length - 1], l1 = lows[lows.length - 2], l2 = lows[lows.length - 1];
    if (!(h1 < l2 && l1 < h2)) return null;
    const first = Math.min(h1, l1), last = Math.max(h2, l2);
    if (last - first < w.minLen || last - first > w.maxLen) return null;
    if (k - last > w.maxWait) return null;
    return { h1, h2, l1, l2, first, last, H1: bars[h1].high, H2: bars[h2].high, L1: bars[l1].low, L2: bars[l2].low };
  }
  // the shape's last checks: the width at the first touch, the narrowing, the apex, the closes inside; null or the triangle
  function shaped(bars, k, t, upper, lower, apex, w, atr, buf, extra) {
    const wFirst = upper(t.first) - lower(t.first), wLast = upper(t.last) - lower(t.last);
    if (wFirst < w.minWidthAtr * atr) return null;
    if (wLast > (1 - w.minNarrowing) * wFirst) return null;
    if (k >= apex) return null;
    for (let j = t.first; j <= t.last; j++) if (bars[j].close > upper(j) + buf || bars[j].close < lower(j) - buf) return null;
    return { ...t, ...extra, key: `${t.h1},${t.h2},${t.l1},${t.l2}`, upper, lower, width: wFirst, apex, lockCandle: k };
  }
  // the symmetrical shape (checks 4 and 5 of the two symmetrical documents) and the trend into it (section 9): type "bullish" or "bearish"
  function symmetricalAt(bars, k, atr, cfg, type) {
    const w = { ...TRI, ...(cfg.tri || {}) }, buf = bufferOf(atr, cfg);
    if (atr == null || buf == null) return null;
    const t = touchesAt(bars, k, w); if (!t) return null;
    const su = (t.H2 - t.H1) / (t.h2 - t.h1), sl = (t.L2 - t.L1) / (t.l2 - t.l1);
    if (!(su < 0 && sl > 0)) return null;                                                        // 4: lower highs, higher lows
    if (Math.max(-su, sl) / Math.min(-su, sl) > w.symRatioMax) return null;                      // 5: symmetrical
    const upper = (x) => t.H1 + su * (x - t.h1), lower = (x) => t.L1 + sl * (x - t.l1);
    const apex = (t.L1 - sl * t.l1 - t.H1 + su * t.h1) / (su - sl);
    // 11: the trend into it (section 9): the priorLookback candles before the first touch; on the 5-minute chart "the window may reach into
    // the previous day" (cfg.prevBars, the previous sessions' candles when the page has them); fewer: what is there; none: not taken
    const prev = cfg.prevBars || [], s0 = Math.max(0, t.first - w.priorLookback), fromPrev = Math.min(prev.length, w.priorLookback - (t.first - s0));
    const win = prev.slice(prev.length - fromPrev).concat(bars.slice(s0, t.first));
    if (!win.length) return null;
    const mid = (upper(t.first) + lower(t.first)) / 2;
    let lo = Infinity, hi = -Infinity; for (const b of win) { lo = Math.min(lo, b.low); hi = Math.max(hi, b.high); }
    const rise = mid - lo, fall = hi - mid, need = w.priorMoveAtr * atr;
    if (type === "bullish" ? !(rise >= need && rise >= fall) : !(fall >= need && fall > rise)) return null;
    return shaped(bars, k, t, upper, lower, apex, w, atr, buf, { rule: type + " symmetrical triangle", su, sl, rise, fall });
  }
  // the ascending triangle (a flat top, a rising support) and the descending one (a flat bottom, a falling resistance)
  function flatAt(bars, k, atr, cfg, kind) {
    const w = { ...TRI, ...(cfg.tri || {}) }, buf = bufferOf(atr, cfg);
    if (atr == null || buf == null) return null;
    const t = touchesAt(bars, k, w); if (!t) return null;
    let upper, lower, apex, extra;
    if (kind === "ascending") {
      if (Math.abs(t.H2 - t.H1) > w.flatTolAtr * atr) return null;                               // 4: a flat top
      const R = Math.max(t.H1, t.H2), sl = (t.L2 - t.L1) / (t.l2 - t.l1);
      if (!(sl > 0)) return null;                                                                 // 5: a rising support
      upper = () => R; lower = (x) => t.L1 + sl * (x - t.l1); apex = t.l1 + (R - t.L1) / sl; extra = { rule: "ascending triangle", resistance: R, sl };
    } else {
      if (Math.abs(t.L2 - t.L1) > w.flatTolAtr * atr) return null;                               // 4: a flat bottom
      const S = Math.min(t.L1, t.L2), su = (t.H2 - t.H1) / (t.h2 - t.h1);
      if (!(su < 0)) return null;                                                                 // 5: a falling resistance
      upper = (x) => t.H1 + su * (x - t.h1); lower = () => S; apex = t.h1 + (t.H1 - S) / (-su); extra = { rule: "descending triangle", support: S, su };
    }
    return shaped(bars, k, t, upper, lower, apex, w, atr, buf, extra);
  }
  // the documents' scanner for a one-sided triangle, stepped by one closed candle: st = { active, used, lastDrop }; side "CE" breaks
  // the upper line (the lower one cancels), "PE" the lower (the upper cancels); noRedraw: the ascending and descending rule of a new
  // triangle only with its last touch after the last drop. The events go to skipped as the documents' log (lock, cancelled, expired...)
  function triangleStep(st, bars, k, detect, side, noRedraw, atr, cfg = DT, skipped = null) {
    const w = { ...TRI, ...(cfg.tri || {}) }, buf = bufferOf(atr, cfg);
    if (atr == null || buf == null) return null;
    const at = (t) => bars[t].time, log = (why, rule) => { if (skipped) skipped.push({ time: at(k), rule, why }); };
    const drop = (why) => { st.used.add(st.active.key); st.lastDrop = k; log(why, st.active.rule); st.active = null; };
    if (!st.active) {
      const found = detect(bars, k, atr, cfg);
      if (!found || st.used.has(found.key) || (noRedraw && found.last <= (st.lastDrop == null ? -1 : st.lastDrop))) return null;
      let broke = false; for (let j = found.last + w.swingN; j < k; j++) if (bars[j].close > found.upper(j) + buf || bars[j].close < found.lower(j) - buf) broke = true;
      if (broke) { st.used.add(found.key); st.lastDrop = k; log("not locked: already closed outside its lines", found.rule); return null; }
      st.active = found; log("locked", found.rule);
    }
    const a = st.active, d = side === "CE" ? 1 : -1;
    if (k - a.last > w.maxWait || k >= a.apex) { drop("expired"); return null; }
    const close = bars[k].close;
    const other = d > 0 ? a.lower(k) - close : close - a.upper(k);
    if (other > buf) { drop("cancelled: closed " + (d > 0 ? "below the lower line" : "above the upper line")); return null; }
    const level = d > 0 ? a.upper(k) : a.lower(k), dist = d * (close - level);
    if (dist <= buf) return null;                                                                  // keep waiting
    const rule = a.rule, tri = a; drop(dist > w.maxChaseAtr * atr ? "too far past the line" : "signal");
    if (dist > w.maxChaseAtr * atr) return null;
    const kind = rule + (d > 0 ? " broke out" : " broke down");
    return { side, rule, kind, h1: tri.h1, h2: tri.h2, l1: tri.l1, l2: tri.l2, h1Time: at(tri.h1), h2Time: at(tri.h2), l1Time: at(tri.l1), l2Time: at(tri.l2), lockTime: at(tri.lockCandle),
             width: round2(tri.width), rise: tri.rise != null ? round2(tri.rise) : undefined, fall: tri.fall != null ? round2(tri.fall) : undefined,
             resistance: tri.resistance != null ? round2(tri.resistance) : undefined, support: tri.support != null ? round2(tri.support) : undefined,
             L: round2(level), target: round2(level + d * tri.width),
             upperLine: [{ time: at(tri.first), price: round2(tri.upper(tri.first)) }, { time: at(k), price: round2(tri.upper(k)) }],
             lowerLine: [{ time: at(tri.first), price: round2(tri.lower(tri.first)) }, { time: at(k), price: round2(tri.lower(k)) }],
             signalCandle: k, signalTime: at(k), buffer: round2(buf), atr: round2(atr) };
  }
  const bullishTriangleAt = (bars, k, atr, cfg) => symmetricalAt(bars, k, atr, cfg, "bullish"), bearishTriangleAt = (bars, k, atr, cfg) => symmetricalAt(bars, k, atr, cfg, "bearish");
  const ascendingAt = (bars, k, atr, cfg) => flatAt(bars, k, atr, cfg, "ascending"), descendingAt = (bars, k, atr, cfg) => flatAt(bars, k, atr, cfg, "descending");
  const SCANNERS = { "falling wedge": (st, bars, k, atr, cfg, skipped) => wedgeStep(st, bars, k, "falling", atr, cfg, skipped),
                     "rising wedge": (st, bars, k, atr, cfg, skipped) => wedgeStep(st, bars, k, "rising", atr, cfg, skipped),
                     "bullish rectangle": (st, bars, k, atr, cfg, skipped) => lockedStep(st, bars, k, rectangleAt, { ...RECT, ...(cfg.rect || {}) }, atr, cfg, skipped),
                     "bullish symmetrical triangle": (st, bars, k, atr, cfg, skipped) => triangleStep(st, bars, k, bullishTriangleAt, "CE", false, atr, cfg, skipped),
                     "bearish symmetrical triangle": (st, bars, k, atr, cfg, skipped) => triangleStep(st, bars, k, bearishTriangleAt, "PE", false, atr, cfg, skipped),
                     "ascending triangle": (st, bars, k, atr, cfg, skipped) => triangleStep(st, bars, k, ascendingAt, "CE", true, atr, cfg, skipped),
                     "descending triangle": (st, bars, k, atr, cfg, skipped) => triangleStep(st, bars, k, descendingAt, "PE", true, atr, cfg, skipped) };
  const istHM = (t) => { const s = (t + 19800) % 86400; return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s % 3600 / 60)).padStart(2, "0")}`; };
  // ---- The double bottom's shadow log (the version 3 brief, section 6; the owner, 27 October: "V2 table, V3 shadow"). Every signal of
  // the table's version (sets.table) and of the shadow version (sets.shadow) on every closed candle, a trade open or not, both sides.
  // Tag: "<table> only", "<shadow> only" or "Both" (the same pattern: the same side and level, the neckline or the support; the other
  // version's time kept). The table's signals carry their order: taken, or why not (the entry window, a trade already open, the losses
  // in a row...); the shadow's place none, and say whether they fell in the entry window. Every signal is followed on paper to its exit
  // with the trades' own exits (manageStep): the entry at the next candle's open, the exit, the best and the worst point on the way,
  // the points (an open one against the last price). A shadow-only signal says what the table's version lacked: the gap between the
  // bottoms, the swing (a bottom without the table's candles on each side), both, or other. The summary: the signals of each, the
  // shadow-only ones and their paper points. The log is the candles' own: replaying a saved day gives it again
  function dbLogOf(bars, atrs, lastK, dayEnd, cfg, trades, skipped, sets) {
    const names = [sets.table.name || "table", sets.shadow.name || "shadow"], sigs = [];
    [sets.table, sets.shadow].forEach((set, v) => {
      for (let k = 0; k <= lastK; k++) for (const side of ["CE", "PE"]) {
        const s = detectDoubleBottom(bars, k, side, k > 0 ? atrs[k - 1] : null, set);
        if (s) sigs.push({ ...s, version: names[v], inTable: v === 0 });
      }
    });
    const key = (s) => s.side + "|" + s.L, last = bars[bars.length - 1];
    const isLow = (i, n) => i - n >= 0 && i + n <= lastK && bars.slice(i - n, i + n + 1).every((b, j) => j === n || bars[i].low <= b.low);
    const rows = sigs.map(s => {
      const twin = sigs.find(o => o.inTable !== s.inTable && key(o) === key(s)), k = s.signalCandle, d = s.side === "CE" ? 1 : -1;
      const r = { version: s.version, tag: twin ? "Both" : `${s.version} only`, otherTime: twin ? twin.signalTime : null, side: s.side, signalTime: s.signalTime, L: s.L, atr: s.atr,
                  t1Time: s.t1Time, low1: s.low1, t2Time: s.t2Time, low2: s.low2, gap: s.gap, diff: s.diff, limit: s.limit, depth: s.depth, minDepth: s.minDepth,
                  past: s.past, pastAtr: s.pastAtr, closeDist: s.closeDist, target: s.target };
      if (!s.inTable && !twin) {
        const t = sets.table, gapFail = s.gap < t.minGap || s.gap > t.maxGap, swingFail = !isLow(s.t1, t.swingN) || !isLow(s.t2, t.swingN);
        r.lacked = gapFail && swingFail ? "both" : gapFail ? "gap" : swingFail ? "swing" : "other";
      }
      const entryBar = bars[k + 1];
      r.inWindow = !!entryBar && istHM(entryBar.time) >= cfg.entryFrom && istHM(entryBar.time) <= cfg.entryTo;
      const taken = s.inTable ? trades.find(t => t.rule === "double bottom" && t.side === s.side && t.signalCandle === k) : null;
      if (s.inTable) {
        const busy = trades.some(t => t.signalCandle < k && (t.exitTime == null || t.exitTime > bars[k].time || (t.exitTime === bars[k].time && t.how === "day end")));
        const other = trades.find(t => t.signalCandle === k && t !== taken), why = skipped.find(x => x.time === bars[k].time && !x.rule && (x.side == null || x.side === s.side));
        r.order = taken ? "taken" : !entryBar ? (dayEnd ? "the day's last candle" : "no next candle yet") : busy ? "a trade already open" : why ? why.why : other ? `the ${other.rule} call on the same candle` : "not taken";
      } else r.order = "shadow, no order";
      if (!entryBar) return r;  // nothing to follow yet
      const t = taken || newTrade(s, bars);
      let hi = -Infinity, lo = Infinity;
      for (let j = k + 1; j <= lastK; j++) {
        hi = Math.max(hi, bars[j].high); lo = Math.min(lo, bars[j].low);
        if (taken ? t.exitTime != null && bars[j].time >= t.exitTime : manageStep(t, bars[j], j, atrs[j - 1], lastK, dayEnd, cfg)) break;
      }
      if (k + 1 > lastK) { hi = entryBar.high; lo = entryBar.low; }  // the entry candle still forming: its range so far
      Object.assign(r, { entry: t.entry, entryTime: t.entryTime, exit: t.exit, exitTime: t.exitTime, how: t.exit != null ? t.how : "open",
                         best: round2(d > 0 ? hi - t.entry : t.entry - lo), worst: round2(d > 0 ? lo - t.entry : t.entry - hi),
                         points: t.exit != null ? t.points : round2(d * (last.close - t.entry)) });
      return r;
    }).sort((a, b) => a.signalTime - b.signalTime || (a.version < b.version ? -1 : 1));
    const only = rows.filter(r => r.tag === `${names[1]} only`);
    return { table: names[0], shadow: names[1], rows,
             summary: { table: rows.filter(r => r.version === names[0]).length, shadow: rows.filter(r => r.version === names[1]).length, shadowOnly: only.length,
                        shadowOnlyPoints: round2(only.reduce((a, r) => a + (r.points || 0), 0)) } };
  }
  // One closed candle of an open trade, Rule 1 then the ATR trail (22 October): the stop starts on L; a close back across it is the
  // reclaim (Exit A); on C2 the retouch (Exit B). Once a candle has closed in profit the stop sits trailAtr x ATR (the ATR as of the
  // candle before) behind the best close so far (half an ATR since 22 October evening), moved only in the call's favour and never
  // loosened; sold at the close of the first candle that closes past it. The day's last candle (dayEnd) ends it. Returns how it ended
  // on this candle, or null (the trade goes on). runDay's trades and the double bottom's shadow log run the same step
  function manageStep(t, bar, k, atr, lastK, dayEnd, cfg) {
    const d = t.side === "CE" ? 1 : -1;
    let how = null;
    if (k === lastK && dayEnd) how = "day end";
    else {
      if (d * (bar.close - t.stop) < 0) how = t.stage === 1 ? "reclaim" : "trail";
      else if (t.stage === 1 && k === t.signalCandle + 1 && d * (bar.open - t.c1.close) > 0 && d * (t.c1.open - (d > 0 ? bar.low : bar.high)) >= 0) how = "retouch";
      if (!how && atr != null) {
        const gain = d * (bar.close - t.entry);
        if (gain > 0) { t.best = round2(Math.max(t.best || 0, gain)); const s = round2(bar.close - d * cfg.trailAtr * atr);  // behind this close: the best close, as the stop never moves back
          if (d * (s - t.stop) > 0) { t.stop = s; t.stage = 2; } }
      }
    }
    if (how) { t.exit = bar.close; t.exitTime = bar.time; t.how = how; t.points = round2(d * (bar.close - t.entry)); }
    return how;
  }
  const newTrade = (sig, bars) => ({ ...sig, entryTime: bars[sig.signalCandle + 1].time, entry: bars[sig.signalCandle + 1].open, c1: bars[sig.signalCandle], stage: 1, stop: sig.L, best: 0, exit: null, exitTime: null, points: null, how: "open" });
  // The day replayed: the entries, Rule 1 and the ATR trail over closed candles.
  // atrSeed: the ATR to start the day with (from the previous day's candles), else the day warms up on its own 14 candles;
  // atrFixed: a test's fixed ATR. One trade at a time; both sides firing on one candle skip both; the filters of section 9.5
  // closedCount: how many of the bars have closed (the rest is the candle forming now: an entry may take its open, nothing else)
  // sides: the double top ("PE") alone for now (the owner, 21 October: the double bottom's logic comes in another document)
  // rules: which patterns run, in order: the double top (Buy PE), the double bottom (Buy CE, or Buy PE when it fails), the triple top
  // (Buy PE, or Buy CE when it fails), the triple bottom (Buy CE, or Buy PE when it fails), the falling wedge (Buy CE, or Buy PE when
  // it fails), the rising wedge (Buy PE, or Buy CE when it fails), the bullish rectangle
  // (Buy CE, or Buy PE when it fails). Rules firing on one candle the same way: the first in the list; different ways: nothing.
  // The wedge and rectangle rules keep state (the locked pattern, the patterns used up): their scanners step on every closed
  // candle, a trade open or not, so the first close outside the locked lines always uses the pattern up; a signal while a trade is open is skipped ("one trade at a time")
  const RULES = { "double top": (bars, k, atr, cfg) => [detectEntry(bars, k, "PE", atr, cfg)],
                  "double bottom": (bars, k, atr, cfg) => [detectDoubleBottom(bars, k, "CE", atr, cfg.db || DB.table), detectDoubleBottom(bars, k, "PE", atr, cfg.db || DB.table)],
                  "triple top": (bars, k, atr, cfg) => [detectTripleTop(bars, k, "PE", atr, cfg), detectTripleTop(bars, k, "CE", atr, cfg)],
                  "triple bottom": (bars, k, atr, cfg) => [detectTripleBottom(bars, k, "CE", atr, cfg), detectTripleBottom(bars, k, "PE", atr, cfg)] };
  // The 14 more patterns (the owner's "More Chart Patterns and Rules" document; static/morepat.js; 30 October: "make their behaviour same
  // like the earlier 11 signals"): on NIFTY 50 (MORE.indices) their signals join the other rules' on every closed candle, after them in
  // the list (the rule earlier in the list wins a candle that two rules call the same way; opposite ways: nothing, as before), under the
  // same gates (one trade at a time, the entry window, the losses in a row, the day's limits) and the same exits. Their ATR is the
  // reference's own (Wilder 14 as of the previous candle, carried over from the previous sessions) and yesterday's close is the previous
  // session's last candle's close; a signal carries its level L, its picture's target (or none), its key candles and lines for the chart
  const MORE = { indices: ["NIFTY 50"],  // where the 14 run
                 calls: ["inverse_head_shoulders", "cup_handle", "rounding_bottom", "flag", "pennant", "falling_channel", "broadening", "island", "orb", "gap", "engulfing", "hammer", "doji", "vwap"] };  // the rules whose signals become calls (every signal is logged either way); more: an array of keys replays another choice
  const moreOn = (index, more) => more !== false && root.MorePat != null && (index == null ? more === true || Array.isArray(more) : MORE.indices.includes(index));  // no index (the lab): only when asked
  const moreSignal = (s, key, bars, k) => ({ rule: key, more: true, kind: s.rule, side: s.side, L: s.level, target: s.target, note: s.note || "", picPoints: s.points, picLines: s.lines,  // the picture's points and lines (a trade's "points" is its result)
                                             lineName: s.lines.length ? s.lines[0][4] : key === "vwap" ? "VWAP" : "level", signalCandle: k, signalTime: bars[k].time });
  function runDay({ bars, cfg = DT, index = null, prevBars = null, atrSeed = null, atrFixed = null, expiryDay = false, dayEnd = true, closedCount = null, dbShadow = null, more = null, sides = ["PE"], rules = ["double top", "double bottom", "triple top", "triple bottom", "falling wedge", "rising wedge", "bullish rectangle", "bullish symmetrical triangle", "bearish symmetrical triangle", "ascending triangle", "descending triangle"] }) {
    if (!cfg.db) cfg = { ...cfg, db: dbOn(index) ? DB.table : DB.other };  // the double bottom's settings for this index (index: the page's index name)
    const atrs = atrFixed != null ? bars.map(() => atrFixed) : atrSeries(bars);
    if (atrSeed != null && atrFixed == null) {  // carry the previous day's ATR in: Wilder steps from the seed
      let a = atrSeed; bars.forEach((b, i) => { const prev = i ? bars[i - 1].close : null; const tr = prev == null ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev)); a = atrStep(a, tr, cfg.atrPeriod || 14); atrs[i] = a; });
    }
    const trades = [], skipped = [], scanners = {}, scanCfg = prevBars && prevBars.length ? { ...cfg, prevBars } : cfg;  // the previous day's candles: the symmetrical triangles' trend window only
    rules.forEach(name => { if (SCANNERS[name]) scanners[name] = { active: null, used: new Set(), lastDrop: null }; });
    let open = null, lossesInRow = 0, dayLoss = 0;
    const lastK = (closedCount == null ? bars.length : Math.min(closedCount, bars.length)) - 1;
    const withMore = moreOn(index, more), MP = withMore ? root.MorePat : null, moreKeys = Array.isArray(more) ? more : MORE.calls;
    const moreAtr = withMore ? MP.atrBefore((prevBars || []).concat(bars.slice(0, lastK + 1))).slice((prevBars || []).length) : null;  // the reference's ATR, as of the previous candle
    const moreCtx = withMore && prevBars && prevBars.length ? { prev_close: prevBars[prevBars.length - 1].close } : null;
    for (let k = 0; k <= lastK; k++) {
      const bar = bars[k], atr = k > 0 ? atrs[k - 1] : null;
      const wedgeSigs = [];  // the wedge scanners step first, every candle (see above)
      for (const name of rules) if (scanners[name]) { const s = SCANNERS[name](scanners[name], bars, k, atr, scanCfg, skipped); if (s) wedgeSigs.push(s); }
      if (open) {  // the trade on this candle's close (the entry candle itself is judged too, as C2 is the candle after C1)
        const t = open, how = manageStep(t, bar, k, atr, lastK, dayEnd, cfg);
        if (how) { open = null; if (t.points < 0) { lossesInRow++; dayLoss += -t.points; } else lossesInRow = 0; }
        if (open || how === "day end") { wedgeSigs.forEach(s => skipped.push({ time: bar.time, side: s.side, rule: s.rule, why: open ? "one trade at a time" : "day end" })); continue; }
      }
      if (k + 1 >= bars.length) break;  // a signal on the last candle has no next candle to enter on
      const found = [];
      for (const name of rules) {
        if (name === "double top") { if (sides.includes("PE")) found.push(detectEntry(bars, k, "PE", atr, cfg)); if (sides.includes("CE")) found.push(detectEntry(bars, k, "CE", atr, cfg)); }
        else if (scanners[name]) found.push(...wedgeSigs.filter(s => s.rule === name));
        else if (RULES[name]) found.push(...RULES[name](bars, k, atr, cfg));
      }
      if (withMore && moreAtr[k] != null) for (const key of MP.ORDER) if (moreKeys.includes(key)) for (const s of MP.detect(key, bars, k, moreAtr[k], null, moreCtx)) found.push(moreSignal(s, key, bars, k));  // the 14 more patterns, after the others
      const sigs = found.filter(Boolean);
      if (!sigs.length) continue;
      if (sigs.some(x => x.side !== sigs[0].side)) { skipped.push({ time: bar.time, why: "rules disagree on one candle: " + sigs.map(x => `${x.rule} ${x.side}`).join(", ") }); continue; }
      const sig = sigs[0], entryBar = bars[k + 1], when = istHM(entryBar.time);
      if (when < cfg.entryFrom || when > cfg.entryTo) { skipped.push({ time: bar.time, side: sig.side, why: "outside entry window" }); continue; }
      if (cfg.maxTradesPerDay != null && trades.length >= cfg.maxTradesPerDay) { skipped.push({ time: bar.time, side: sig.side, why: "daily limit" }); continue; }
      if (cfg.maxLossPerDay != null && dayLoss >= cfg.maxLossPerDay) { skipped.push({ time: bar.time, side: sig.side, why: "daily loss limit" }); continue; }
      if (lossesInRow >= cfg.maxLossesInRow) { skipped.push({ time: bar.time, side: sig.side, why: `${cfg.maxLossesInRow} losses in a row` }); continue; }
      if (cfg.skipExpiryDay && expiryDay) { skipped.push({ time: bar.time, side: sig.side, why: "expiry day" }); continue; }
      open = newTrade(sig, bars);
      trades.push(open);
    }
    return { trades, skipped, dbLog: dbShadow === false || !rules.includes("double bottom") || !dbOn(index) ? null : dbLogOf(bars, atrs, lastK, dayEnd, cfg, trades, skipped, dbShadow || { table: cfg.db, shadow: DB.shadow }) };
  }
  root.NewRule = { CFG, DT, DB, MORE, moreOn, DB_V1, DB_V2, DB_V3, DB_OLD, dbOn, dbPatterns, manageStep, dbLogOf, RULES, atrSeries, atrStep, findSwings, round2, bufferOf, detectEntry, detectDoubleBottom, detectTripleTop, detectTripleBottom, WEDGE, WEDGES, wedgeAt, wedgeStep, RECT, rectangleAt, TRI, symmetricalAt, flatAt, triangleStep, bullishTriangleAt, bearishTriangleAt, ascendingAt, descendingAt, lockedStep, SCANNERS, runDay, istHM };
})(typeof globalThis !== "undefined" ? globalThis : this);
