// More chart patterns and rules (the owner's "More Chart Patterns and Rules" document and more_patterns_reference.py, 29 October 2026;
// built 30 October): 14 rules on the completed 5-minute candles of one day, each giving BUY CE or BUY PE, in SHADOW mode on the Calls
// with Signals page: every signal is logged, no call is placed, nothing else is blocked or changed. A line-for-line port of the
// reference: every rule is written once for the BUY CE side; the BUY PE side is the same rule on the chart turned upside down
// (flip: every price becomes minus the price), the signal turned back (unflip). lab/morepat_check.js proves this file gives the
// reference's answers: its 113 test scans, its 14 examples, the 4 real days of the document and 400 random days, signal for signal.
// Nothing of the Paper calls page or of newrule.js is used here; the page hands the paper exits (Rule 1 and the trail) in as a function.
(function (root) {
  "use strict";
  // ---- shared parts (the reference's BEGIN SHARED)
  const COMMON = { swing_n: 2,          // a swing needs this many lower (or higher) candles on each side
                   buffer_atr: 0.25,    // a "break" is a close beyond the line by this x ATR
                   max_chase_atr: 2.0,  // skip the signal if the close is already this x ATR past the line
                   max_wait: 15,        // the signal must come within this many candles of the last swing point
                   lookback: 20 };      // how far back we look for the move that came before
  const candle = (o, h, l, c) => ({ open: o, high: h, low: l, close: c });
  function atrBefore(cs, n = 14) {  // ATR(14), Wilder smoothing, as of the PREVIOUS candle. Candles with no ATR yet give null
    const tr = cs.map((c, i) => { const pc = i ? cs[i - 1].close : c.open; return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc)); });
    const out = cs.map(() => null);
    if (cs.length < n) return out;
    let v = 0; for (let i = 0; i < n; i++) v += tr[i]; v = v / n;
    out[n - 1] = v;
    for (let i = n; i < cs.length; i++) { v = (v * (n - 1) + tr[i]) / n; out[i] = v; }
    return [null].concat(out.slice(0, -1));
  }
  const flip = (cs) => cs.map(c => candle(-c.open, -c.low, -c.high, -c.close));  // the same chart turned upside down
  const flipCtx = (ctx) => { if (ctx == null) return null; const out = { ...ctx }; if (out.prev_close != null) out.prev_close = -out.prev_close; return out; };
  function swingHighs(cs, k, n) {  // candles whose high is at least as high as the n candles on each side; known only n candles later
    const out = []; for (let i = n; i <= k - n; i++) { let ok = true; for (let j = i - n; j <= i + n && ok; j++) if (j !== i && !(cs[i].high >= cs[j].high)) ok = false; if (ok) out.push(i); } return out;
  }
  function swingLows(cs, k, n) {
    const out = []; for (let i = n; i <= k - n; i++) { let ok = true; for (let j = i - n; j <= i + n && ok; j++) if (j !== i && !(cs[i].low <= cs[j].low)) ok = false; if (ok) out.push(i); } return out;
  }
  const lineValue = (p1, p2, x) => p1[1] + (p2[1] - p1[1]) * (x - p1[0]) / (p2[0] - p1[0]);  // the straight line through p1 and p2 at candle x
  const makeSignal = (side, level, k, { target = null, points = null, lines = null, note = "", ident = null } = {}) => ({ side, level, target, signal_candle: k, points: points || [], lines: lines || [], note, ident });
  // Python's max(range, key) and min(range, key): the FIRST best on a tie
  const argMax = (from, to, f) => { let best = from, bv = f(from); for (let j = from + 1; j < to; j++) { const v = f(j); if (v > bv) { best = j; bv = v; } } return best; };
  const argMin = (from, to, f) => { let best = from, bv = f(from); for (let j = from + 1; j < to; j++) { const v = f(j); if (v < bv) { best = j; bv = v; } } return best; };
  const rangeMax = (from, to, f) => { let v = -Infinity; for (let j = from; j < to; j++) v = Math.max(v, f(j)); return v; };
  const rangeMin = (from, to, f) => { let v = Infinity; for (let j = from; j < to; j++) v = Math.min(v, f(j)); return v; };
  const anyIn = (from, to, f) => { for (let j = from; j < to; j++) if (f(j)) return true; return false; };
  // when the chart is turned back, the words in the picture labels turn too
  const SWAP = { top: "bottom", bottom: "top", high: "low", low: "high", above: "below", below: "above", red: "green", green: "red", hammer: "shooting star" };
  const swapWords = (text) => text.replace(/\b(top|bottom|high|low|above|below|red|green|hammer)\b/g, m => SWAP[m]);
  function unflipSignal(s, ruleName) {
    return { ...s, rule: ruleName, side: s.side === "CE" ? "PE" : "CE", level: -s.level, target: s.target == null ? null : -s.target,
             points: s.points.map(([i, y, lab]) => [i, -y, swapWords(lab)]), lines: s.lines.map(([i1, y1, i2, y2, lab]) => [i1, -y1, i2, -y2, swapWords(lab)]) };
  }
  function zigzag(cs, k, n) {  // swing highs and lows in time order (H, L, H, L ...); in a run of the same kind keep the most extreme
    const pts = swingHighs(cs, k, n).map(i => [i, "H"]).concat(swingLows(cs, k, n).map(i => [i, "L"])).sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    const out = [];
    for (const [i, t] of pts) {
      if (out.length && out[out.length - 1][1] === t) {
        const j = out[out.length - 1][0], better = t === "H" ? cs[i].high > cs[j].high : cs[i].low < cs[j].low;
        if (better) out[out.length - 1] = [i, t];
      } else out.push([i, t]);
    }
    return out;
  }
  function vwapSeries(cs, volumes = null) {  // VWAP from the day's first candle; with no volumes the plain average of the typical price (not a true VWAP)
    const out = []; let pv = 0.0, vv = 0.0;
    cs.forEach((c, i) => { const vol = volumes ? volumes[i] : 1.0; pv += (c.high + c.low + c.close) / 3 * vol; vv += vol; out.push(pv / vv); });
    return out;
  }
  // ---- 1. head and shoulders: written for the inverse (BUY CE); flipped: head and shoulders, BUY PE
  function inverseHeadShoulders(cs, k, atr, c) {
    const lows = swingLows(cs, k, c.swing_n);
    if (!lows.length) return null;
    const r = lows[lows.length - 1];                          // right shoulder = the latest swing low
    if (k - r > c.max_wait) return null;
    const buf = c.buffer_atr * atr;
    const heads = lows.filter(s => c.min_gap <= r - s && r - s <= c.max_gap).reverse();   // head, nearest first
    for (const b of heads) {
      const lefts = lows.filter(s => c.min_gap <= b - s && b - s <= c.max_gap).reverse();  // left shoulder
      for (const a of lefts) {
        const left = cs[a].low, head = cs[b].low, right = cs[r].low;
        if (Math.min(left, right) - head < c.head_atr * atr) continue;        // 1. the head is lower than both shoulders
        if (Math.abs(left - right) > c.shoulder_atr * atr) continue;          // 2. the shoulders are about the same height
        const p1 = argMax(a + 1, b, j => cs[j].high), p2 = argMax(b + 1, r, j => cs[j].high);   // the two bounces between them
        if (Math.abs(cs[p1].high - cs[p2].high) > c.neck_tol_atr * atr) continue;   // 3. the neckline is nearly flat
        const neck = (x) => lineValue([p1, cs[p1].high], [p2, cs[p2].high], x);
        if (neck(b) - head < c.min_depth_atr * atr) continue;                 // 4. the head is deep enough
        const start = Math.max(0, a - c.lookback);
        if (rangeMax(start, a + 1, j => cs[j].high) - left < c.prior_move_atr * atr) continue;   // 5. there was a fall before
        if (anyIn(b, k + 1, j => cs[j].close < head)) continue;               // 6. nothing closed below the head
        if (anyIn(r + c.swing_n, k, j => cs[j].close > neck(j) + buf)) continue;   // 7. first break only
        if (cs[k].close <= neck(k) + buf) continue;                           // 8. this candle closes above the neckline by the buffer
        if (cs[k].close - neck(k) > c.max_chase_atr * atr) return null;       // 9. not already too far
        const height = neck(b) - head;
        return makeSignal("CE", neck(k), k, { target: neck(k) + height, ident: [a, b],
                          points: [[a, left, "left shoulder"], [b, head, "head"], [r, right, "right shoulder"]], lines: [[p1, cs[p1].high, k, neck(k), "neckline"]] });
      }
    }
    return null;
  }
  // ---- 2. cup and handle (BUY CE); flipped: inverted cup and handle (BUY PE)
  function cupHandle(cs, k, atr, c) {
    const highs = swingHighs(cs, k, c.swing_n), buf = c.buffer_atr * atr;
    for (const r of highs.slice().reverse()) {                // right rim, latest first
      const handleLen = k - 1 - r;
      if (handleLen > c.handle_max) break;
      if (handleLen < c.handle_min) continue;
      for (const a of highs.filter(s => c.cup_min <= r - s && r - s <= c.cup_max).reverse()) {   // left rim
        if (Math.abs(cs[a].high - cs[r].high) > c.rim_tol_atr * atr) continue;   // 1. the two rims are about level
        const rim = Math.max(cs[a].high, cs[r].high);
        const b = argMin(a + 1, r, j => cs[j].low);              // bottom of the cup
        const depth = Math.min(cs[a].high, cs[r].high) - cs[b].low;
        if (depth < c.cup_depth_atr * atr) continue;              // 2. the cup is deep enough
        if (!(a + 0.25 * (r - a) <= b && b <= a + 0.75 * (r - a))) continue;   // 3. the bottom is in the middle
        let near = 0; for (let j = a + 1; j < r; j++) if (cs[j].low <= cs[b].low + 0.3 * depth) near++;
        if (near / (r - a - 1) < c.u_share) continue;             // 4. round like a U, not pointed like a V
        if (anyIn(a + 1, r, j => cs[j].high > rim + 0.5 * atr)) continue;   // 5. the cup stays under the rims
        const handleLow = rangeMin(r + 1, k, j => cs[j].low);
        if (cs[r].high - handleLow > c.max_handle_frac * depth) continue;   // 6. the handle is a small dip
        if (handleLow < cs[b].low + 0.5 * depth) continue;        // 7. the handle stays in the upper half of the cup
        if (anyIn(r + 1, k, j => cs[j].close > rim + buf)) continue;   // 8. first break only
        if (cs[k].close <= rim + buf) continue;                   // 9. this candle closes above the rim by the buffer
        if (cs[k].close - rim > c.max_chase_atr * atr) return null;
        return makeSignal("CE", rim, k, { target: rim + depth, ident: [a, b],
                          points: [[a, cs[a].high, "left rim"], [b, cs[b].low, "bottom"], [r, cs[r].high, "right rim"]], lines: [[a, rim, k, rim, "rim"]] });
      }
    }
    return null;
  }
  // ---- 3. rounding bottom (BUY CE); flipped: rounding top (BUY PE)
  function roundingBottom(cs, k, atr, c) {
    const buf = c.buffer_atr * atr;
    for (const a of swingHighs(cs, k, c.swing_n).reverse()) {   // left rim, latest first
      const length = k - a;
      if (length > c.max_len) break;
      if (length < c.min_len) continue;
      const rim = cs[a].high, b = argMin(a + 1, k, j => cs[j].low), depth = rim - cs[b].low;   // bottom of the saucer
      if (depth < c.depth_atr * atr) continue;                    // 1. deep enough
      if (!(a + 0.25 * length <= b && b <= a + 0.75 * length)) continue;   // 2. the bottom is in the middle
      const ratio = (k - b) / (b - a);
      if (!(c.side_min <= ratio && ratio <= c.side_max)) continue;   // 3. the way up takes about as long as the way down
      let near = 0; for (let j = a + 1; j < k; j++) if (cs[j].low <= cs[b].low + 0.3 * depth) near++;
      if (near / (length - 1) < c.u_share) continue;              // 4. round, not a V
      if (anyIn(a + 1, k, j => cs[j].close > rim + buf)) continue;   // 5. first break only
      if (cs[k - 1].close < cs[b].low + c.approach_frac * depth) continue;   // 6. the climb is already well under way
      if (cs[k].close <= rim + buf) continue;                     // 7. this candle closes above the rim by the buffer
      if (cs[k].close - rim > c.max_chase_atr * atr) return null;
      return makeSignal("CE", rim, k, { target: rim + depth, ident: [a, b], points: [[a, rim, "left rim"], [b, cs[b].low, "bottom"]], lines: [[a, rim, k, rim, "rim"]] });
    }
    return null;
  }
  // ---- 4. flag and 5. pennant (bull: BUY CE; flipped: bear flag / bear pennant, BUY PE): a pole, then a short pause
  function poleAndPause(cs, k, atr, c) {
    const from = Math.max(0, k - c.flag_max - 1);
    if (k - from < c.flag_min + 1) return null;
    const p = argMax(from, k, j => cs[j].high), length = k - 1 - p;
    if (!(c.flag_min <= length && length <= c.flag_max)) return null;
    const q = argMin(Math.max(0, p - c.pole_max), p + 1, j => cs[j].low), pole = cs[p].high - cs[q].low;   // bottom of the pole
    if (p - q < 2 || pole < c.pole_atr * atr) return null;      // a real, fast pole
    const pause = []; for (let j = p + 1; j < k; j++) pause.push(j);
    if (cs[p].high - Math.min(...pause.map(j => cs[j].low)) > c.max_retrace * pole) return null;   // the pause gives back at most half of the pole
    const half = Math.floor(pause.length / 2), first = pause.slice(0, half), second = pause.slice(half);
    const pick = (list, f, max) => { let best = list[0], bv = f(best); for (const j of list.slice(1)) { const v = f(j); if (max ? v > bv : v < bv) { best = j; bv = v; } } return best; };
    const hi1 = pick(first, j => cs[j].high, true), hi2 = pick(second, j => cs[j].high, true), lo1 = pick(first, j => cs[j].low, false), lo2 = pick(second, j => cs[j].low, false);
    const up = [[hi1, cs[hi1].high], [hi2, cs[hi2].high]], dn = [[lo1, cs[lo1].low], [lo2, cs[lo2].low]];
    const sUp = (up[1][1] - up[0][1]) / (up[1][0] - up[0][0]) / atr, sDn = (dn[1][1] - dn[0][1]) / (dn[1][0] - dn[0][0]) / atr;   // slopes in ATR per candle
    const r1 = Math.max(...first.map(j => cs[j].high)) - Math.min(...first.map(j => cs[j].low)), r2 = Math.max(...second.map(j => cs[j].high)) - Math.min(...second.map(j => cs[j].low));
    return { p, q, pole, pause, up, dn, sUp, sDn, shrink: r1 ? r2 / r1 : 1.0 };
  }
  function pauseBreak(cs, k, atr, c, f) {  // the shared last steps: the first close above the top line by the buffer
    const buf = c.buffer_atr * atr, top = (x) => lineValue(f.up[0], f.up[1], x);
    if (f.pause.some(j => cs[j].close > top(j) + buf)) return null;   // first break only
    if (cs[k].close <= top(k) + buf) return null;
    if (cs[k].close - top(k) > c.max_chase_atr * atr) return null;
    return top;
  }
  function flag(cs, k, atr, c) {
    const f = poleAndPause(cs, k, atr, c);
    if (!f) return null;
    if (f.sUp > c.slope_max || f.sDn > c.slope_max) return null;    // the box does not climb
    if (Math.abs(f.sUp - f.sDn) > c.parallel_tol) return null;      // the two lines are about parallel
    const top = pauseBreak(cs, k, atr, c, f);
    if (!top) return null;
    return makeSignal("CE", top(k), k, { target: top(k) + f.pole, ident: [f.p], points: [[f.q, cs[f.q].low, "pole start"], [f.p, cs[f.p].high, "pole top"]],
                      lines: [[f.up[0][0], f.up[0][1], k, top(k), "flag top"], [f.dn[0][0], f.dn[0][1], k, lineValue(f.dn[0], f.dn[1], k), "flag bottom"]] });
  }
  function pennant(cs, k, atr, c) {
    const f = poleAndPause(cs, k, atr, c);
    if (!f) return null;
    if (f.sUp > c.slope_max || f.sDn < -c.slope_max) return null;   // the top line does not climb, the bottom line does not fall
    if (f.sDn - f.sUp < c.converge_min) return null;                // the two lines come together
    if (f.shrink > c.shrink_max) return null;                       // the swings get smaller
    const bottomK = lineValue(f.dn[0], f.dn[1], k), top = pauseBreak(cs, k, atr, c, f);
    if (!top || top(k) <= bottomK) return null;
    return makeSignal("CE", top(k), k, { target: top(k) + f.pole, ident: [f.p], points: [[f.q, cs[f.q].low, "pole start"], [f.p, cs[f.p].high, "pole top"]],
                      lines: [[f.up[0][0], f.up[0][1], k, top(k), "pennant top"], [f.dn[0][0], f.dn[0][1], k, bottomK, "pennant bottom"]] });
  }
  // ---- 6. falling channel (BUY CE on a break above the top line); flipped: rising channel (BUY PE below the bottom line)
  function fallingChannel(cs, k, atr, c) {
    const highs = swingHighs(cs, k, c.swing_n);
    if (highs.length < 2) return null;
    const h1 = highs[highs.length - 2], h2 = highs[highs.length - 1];
    if (!(c.min_span <= h2 - h1 && h2 - h1 <= c.max_span) || k - h1 > c.max_len) return null;
    if (cs[h1].high - cs[h2].high < c.slope_atr * atr) return null;   // 1. the two highs fall: a falling top line
    const buf = c.buffer_atr * atr, top = (x) => lineValue([h1, cs[h1].high], [h2, cs[h2].high], x);
    const width = rangeMax(h1, k, j => top(j) - cs[j].low);        // 2. a parallel bottom line through the lowest low
    if (!(c.width_min_atr * atr <= width && width <= c.width_max_atr * atr)) return null;
    const bottom = (x) => top(x) - width;
    const touches = swingLows(cs, k, c.swing_n).filter(j => j >= h1 && Math.abs(cs[j].low - bottom(j)) <= c.touch_tol_atr * atr);
    if (touches.length < c.min_touches) return null;               // 3. the bottom line was touched at least twice
    if (anyIn(h1, k, j => !(bottom(j) - buf <= cs[j].close && cs[j].close <= top(j) + buf))) return null;   // 4. price stayed inside (first break only)
    if (cs[k].close <= top(k) + buf) return null;                   // 5. this candle closes above the top line by the buffer
    if (cs[k].close - top(k) > c.max_chase_atr * atr) return null;
    return makeSignal("CE", top(k), k, { target: top(k) + width, ident: [h1, h2],
                      points: [[h1, cs[h1].high, "top 1"], [h2, cs[h2].high, "top 2"]].concat(touches.map(j => [j, cs[j].low, "bottom"])),
                      lines: [[h1, cs[h1].high, k, top(k), "top line"], [h1, bottom(h1), k, bottom(k), "bottom line"]] });
  }
  // ---- 7. broadening formation (BUY CE); flipped: the same shape, BUY PE
  function broadening(cs, k, atr, c) {
    const z = zigzag(cs, k, c.swing_n);
    while (z.length && z[z.length - 1][1] !== "L") z.pop();         // the pattern ends with the last low
    if (z.length < 5) return null;
    const pts = z.slice(-5);
    if (pts.map(p => p[1]).join("") !== "LHLHL") return null;
    const [l1, h1, l2, h2, l3] = pts.map(p => p[0]);
    if (k - l3 > c.max_wait || l3 - l1 > c.max_span) return null;
    if ([[l1, h1], [h1, l2], [l2, h2], [h2, l3]].some(([a, b]) => b - a < c.min_gap)) return null;
    const e = c.expand_atr * atr;
    if (cs[l1].low - cs[l2].low < e || cs[l2].low - cs[l3].low < e) return null;   // 1. the lows keep falling
    if (cs[h2].high - cs[h1].high < e) return null;                 // 2. the highs keep rising
    const buf = c.buffer_atr * atr, top = (x) => lineValue([h1, cs[h1].high], [h2, cs[h2].high], x);
    if (anyIn(l3 + c.swing_n, k, j => cs[j].close > top(j) + buf)) return null;   // 3. first break only
    if (cs[k].close <= top(k) + buf) return null;                   // 4. this candle closes above the top line by the buffer
    if (cs[k].close - top(k) > c.max_chase_atr * atr) return null;
    return makeSignal("CE", top(k), k, { ident: [l1, h1],
                      points: [[l1, cs[l1].low, "low 1"], [h1, cs[h1].high, "high 1"], [l2, cs[l2].low, "low 2"], [h2, cs[h2].high, "high 2"], [l3, cs[l3].low, "low 3"]],
                      lines: [[h1, cs[h1].high, k, top(k), "top line"]] });
  }
  // ---- 8. island reversal (island bottom: BUY CE; flipped: island top, BUY PE)
  function island(cs, k, atr, c) {
    const g = c.gap_atr * atr;
    for (let i = k - 1; i >= Math.max(k - c.max_island, 1); i--) {  // i = first candle of the island
      if (cs[i - 1].low - cs[i].high < g) continue;                 // 1. a gap down into the island
      if (anyIn(i, k, j => cs[j].high >= cs[i - 1].low)) continue;  // 2. the island never refills that gap
      const islandHigh = rangeMax(i, k, j => cs[j].high);
      if (cs[k].low - islandHigh < g) continue;                     // 3. a gap up out of the island, clear of every island candle
      if (cs[k].close - islandHigh > c.max_chase_atr * atr) return null;   // 4. not already too far
      const islandLow = rangeMin(i, k, j => cs[j].low);
      return makeSignal("CE", islandHigh, k, { points: [[i - 1, cs[i - 1].low, "before the gap"], [k, cs[k].low, "after the gap"]],
                        lines: [[i, islandHigh, k, islandHigh, "island high"]], note: `island of ${k - i} candles, low ${islandLow.toFixed(1)}` });
    }
    return null;
  }
  // ---- 9. opening range breakout and 10. the gap rule (BUY CE on a close above the opening range; flipped: BUY PE below it)
  function openingBreak(cs, k, atr, c, ctx, wantGap) {
    if (k < c.or_candles || k > c.until || !ctx || ctx.prev_close == null) return null;
    const gap = cs[0].open - ctx.prev_close;
    if ((Math.abs(gap) >= c.gap_atr * atr) !== wantGap) return null;   // 1. flat open for ORB, gap open for the gap rule
    const top = rangeMax(0, c.or_candles, j => cs[j].high), bottom = rangeMin(0, c.or_candles, j => cs[j].low);
    if (!(c.min_range_atr * atr <= top - bottom && top - bottom <= c.max_range_atr * atr)) return null;   // 2. a normal-sized range
    const buf = c.buffer_atr * atr;
    if (anyIn(c.or_candles, k, j => cs[j].close > top + buf || cs[j].close < bottom - buf)) return null;   // 3. first break only
    if (cs[k].close <= top + buf) return null;                      // 4. this candle closes above the opening range by the buffer
    if (cs[k].close - top > c.max_chase_atr * atr) return null;
    let target, note;
    if (wantGap && gap < 0) {                                       // gap down, then up: the gap is being filled (back to yesterday's close)
      target = ctx.prev_close; note = "gap fill";
      if (target - cs[k].close < c.min_room_atr * atr) return null; // 5. some gap must still be left to fill
    } else { target = top + (top - bottom); note = wantGap ? "gap and go" : "opening range"; }
    return makeSignal("CE", top, k, { target, note, points: [[0, cs[0].open, "open"]], lines: [[0, top, k, top, "opening range high"], [0, bottom, k, bottom, "opening range low"]] });
  }
  const orb = (cs, k, atr, c, ctx) => openingBreak(cs, k, atr, c, ctx, false);
  const gap = (cs, k, atr, c, ctx) => openingBreak(cs, k, atr, c, ctx, true);
  // ---- 11. candlesticks: engulfing, hammer (flipped: shooting star), doji. All three need a fall before them (flipped: a rise)
  function fellInto(cs, i, atr, c) {  // candle i has the lowest low of the last few candles and price fell at least prior_move_atr x ATR to get there
    const from = Math.max(0, i - c.lookback + 1), low = cs[i].low;
    return low <= rangeMin(from, i + 1, j => cs[j].low) && rangeMax(from, i + 1, j => cs[j].high) - low >= c.prior_move_atr * atr;
  }
  function engulfing(cs, k, atr, c) {
    if (k < 2) return null;
    const prev = cs[k - 1], now = cs[k];
    if (!(prev.close < prev.open && now.close > now.open)) return null;      // 1. a red candle, then a green one
    if (!(now.open <= prev.close && now.close >= prev.open)) return null;    // 2. the green body covers the red body
    if (now.close - now.open < c.body_atr * atr) return null;                // 3. a real body
    const i = prev.low <= now.low ? k - 1 : k;
    if (!fellInto(cs, i, atr, c)) return null;                               // 4. it came after a fall
    return makeSignal("CE", Math.min(prev.low, now.low), k, { points: [[k - 1, prev.low, "red"], [k, now.high, "green covers it"]] });
  }
  function hammer(cs, k, atr, c) {
    const h = c.confirm ? k - 1 : k;                                         // the hammer candle (confirm: the candle after must close above it)
    if (h < 1) return null;
    const x = cs[h], body = Math.abs(x.close - x.open), rng = x.high - x.low;
    if (rng < c.range_atr * atr || rng === 0) return null;                   // 1. not a tiny candle
    const lower = Math.min(x.open, x.close) - x.low, upper = x.high - Math.max(x.open, x.close);
    if (lower < c.wick_mult * body || lower < 0.6 * rng) return null;        // 2. a long tail below a small body
    if (upper > c.upper_max * rng) return null;                              // 3. almost no tail above
    if (!fellInto(cs, h, atr, c)) return null;                               // 4. after a fall
    if (c.confirm && !(cs[k].close > x.high && cs[k].close > cs[k].open)) return null;   // 5. the next candle closes above the hammer's high
    return makeSignal("CE", x.low, k, { points: [[h, x.low, "hammer"]] });
  }
  function doji(cs, k, atr, c) {
    const d = k - 1;
    if (d < 1) return null;
    const x = cs[d], rng = x.high - x.low;
    if (rng < c.range_atr * atr || Math.abs(x.close - x.open) > c.body_frac * rng) return null;   // 1. open and close almost the same, not a tiny candle
    if (!fellInto(cs, d, atr, c)) return null;                               // 2. after a fall
    if (!(cs[k].close > x.high && cs[k].close > cs[k].open)) return null;    // 3. the next candle closes above the doji's high
    return makeSignal("CE", x.low, k, { points: [[d, x.low, "doji"]] });
  }
  // ---- 12. VWAP reclaim (BUY CE); flipped: VWAP loss (BUY PE)
  function vwap(cs, k, atr, c, ctx) {
    if (k < c.look) return null;
    const v = vwapSeries(cs.slice(0, k + 1), (ctx || {}).volumes || null);
    let below = 0; for (let j = k - c.look; j < k; j++) if (cs[j].close < v[j]) below++;
    if (below < c.need_below) return null;                                   // 1. under VWAP for most of the last candles
    if (cs[k - 1].close >= v[k - 1]) return null;                            // 2. the candle before was still under VWAP: the FIRST close above
    const now = cs[k];
    if (now.close <= v[k] + c.buffer_atr * atr) return null;                 // 3. closes above VWAP by the buffer
    if (now.close - now.open < c.body_atr * atr) return null;                // 4. a real green candle
    if (now.close - v[k] > c.max_chase_atr * atr) return null;
    return makeSignal("CE", v[k], k, { points: [[k, now.close, "closes above VWAP"]] });
  }
  // ---- the list of rules, their settings, and the one function that runs a rule on both sides
  const RULES = {
    inverse_head_shoulders: { fn: inverseHeadShoulders, names: ["Inverse Head and Shoulders", "Head and Shoulders"],
                              cfg: { min_gap: 3, max_gap: 30, head_atr: 0.5, shoulder_atr: 1.0, neck_tol_atr: 1.5, min_depth_atr: 2.0, prior_move_atr: 2.0 } },
    cup_handle: { fn: cupHandle, names: ["Cup and Handle", "Inverted Cup and Handle"],
                  cfg: { cup_min: 15, cup_max: 60, rim_tol_atr: 1.0, cup_depth_atr: 3.0, u_share: 0.25, handle_min: 3, handle_max: 12, max_handle_frac: 0.5 } },
    rounding_bottom: { fn: roundingBottom, names: ["Rounding Bottom", "Rounding Top"],
                       cfg: { min_len: 20, max_len: 60, depth_atr: 3.0, side_min: 0.5, side_max: 2.0, u_share: 0.25, approach_frac: 0.6 } },
    flag: { fn: flag, names: ["Bull Flag", "Bear Flag"], cfg: { pole_atr: 3.0, pole_max: 12, flag_min: 5, flag_max: 15, max_retrace: 0.5, slope_max: 0.03, parallel_tol: 0.06 } },
    pennant: { fn: pennant, names: ["Bull Pennant", "Bear Pennant"], cfg: { pole_atr: 3.0, pole_max: 12, flag_min: 5, flag_max: 15, max_retrace: 0.5, slope_max: 0.03, converge_min: 0.06, shrink_max: 0.6 } },
    falling_channel: { fn: fallingChannel, names: ["Falling Channel breakout", "Rising Channel breakdown"],
                       cfg: { min_span: 6, max_span: 40, max_len: 60, slope_atr: 1.0, width_min_atr: 2.0, width_max_atr: 8.0, touch_tol_atr: 0.5, min_touches: 2 } },
    broadening: { fn: broadening, names: ["Broadening (up break)", "Broadening (down break)"], cfg: { expand_atr: 0.5, min_gap: 2, max_span: 60 } },
    island: { fn: island, names: ["Island Bottom", "Island Top"], cfg: { gap_atr: 0.3, max_island: 10, max_chase_atr: 3.0 } },
    orb: { fn: orb, names: ["Opening Range Breakout (up)", "Opening Range Breakout (down)"], cfg: { or_candles: 3, until: 18, min_range_atr: 0.5, max_range_atr: 3.0, gap_atr: 1.0, min_room_atr: 0.5 } },
    gap: { fn: gap, names: ["Gap day: break up", "Gap day: break down"], cfg: { or_candles: 3, until: 18, min_range_atr: 0.5, max_range_atr: 3.0, gap_atr: 1.0, min_room_atr: 0.5 } },
    engulfing: { fn: engulfing, names: ["Bullish Engulfing", "Bearish Engulfing"], cfg: { body_atr: 0.5, prior_move_atr: 1.5, lookback: 8 } },
    hammer: { fn: hammer, names: ["Hammer", "Shooting Star"], cfg: { range_atr: 0.8, wick_mult: 2.0, upper_max: 0.15, prior_move_atr: 1.5, lookback: 8, confirm: true } },
    doji: { fn: doji, names: ["Doji reversal (up)", "Doji reversal (down)"], cfg: { body_frac: 0.1, range_atr: 0.5, prior_move_atr: 1.5, lookback: 8 } },
    vwap: { fn: vwap, names: ["VWAP reclaim", "VWAP loss"], cfg: { look: 6, need_below: 5, body_atr: 0.3 } },
  };
  const ORDER = Object.keys(RULES);  // when two rules give the same side on one candle, the one earlier in this list is the label used
  const settingsFor = (rule, over = null) => ({ ...COMMON, ...RULES[rule].cfg, ...(over || {}) });
  const LOOKBACK = 30;  // how many candles back we look to see if the same pattern already signalled
  const sameIdent = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  function usedUp(fn, chart, k, atr, cfg, ctx, ident) {  // the same pattern (same key candles) already gave a signal on one of the last LOOKBACK candles
    for (let j = Math.max(0, k - LOOKBACK); j < k; j++) { const old = fn(chart.slice(0, j + 1), j, atr, cfg, ctx); if (old && old.ident != null && sameIdent(old.ident, ident)) return true; }
    return false;
  }
  function detect(rule, cs, k, atr, over = null, ctx = null) {  // one rule on completed candle k, both sides: 0, 1 or 2 signals; candles up to k only
    const r = RULES[rule], cfg = settingsFor(rule, over), out = [];
    cs = cs.slice(0, k + 1);
    for (const upsideDown of [false, true]) {
      const chart = upsideDown ? flip(cs) : cs, cx = upsideDown ? flipCtx(ctx) : ctx;
      let s = r.fn(chart, k, atr, cfg, cx);
      if (s && s.ident != null && usedUp(r.fn, chart, k, atr, cfg, cx, s.ident)) s = null;   // the same pattern already signalled: first break only
      if (s && upsideDown) out.push(unflipSignal(s, r.names[1]));
      else if (s) { s.rule = r.names[0]; out.push(s); }
    }
    return out;
  }
  function markStatus(found, k, first = 2, last = 65) {  // every signal found on candle k gets a status (see runDay)
    const sides = new Set(found.map(s => s.side)), seen = new Set();
    for (const s of found) {
      if (sides.size === 2) s.status = "both sides";
      else if (seen.has(s.side)) s.status = "same side";
      else if (!(first <= k && k <= last)) s.status = "outside time";
      else s.status = "ok";
      seen.add(s.side);
    }
    return found;
  }
  // every rule on every completed candle of one day, in time order, each with a status: "ok" (would be traded: the entry candle opens
  // between 09:30 and 14:45), "outside time", "both sides" (two opposite signals on one candle: skipped), "same side" (another rule
  // already gave this signal on the same candle). One trade at a time is NOT applied here
  function runDay(cs, atrList, ctx = null, rules = null, over = null, first = 2, last = 65) {
    const out = [];
    for (let k = 0; k < cs.length; k++) {
      if (atrList[k] == null) continue;
      const found = [];
      for (const rule of (rules || ORDER)) for (const s of detect(rule, cs, k, atrList[k], (over || {})[rule] || null, ctx)) { s.key = rule; found.push(s); }
      out.push(...markStatus(found, k, first, last));
    }
    return out;
  }
  const slot = (k) => { const m = 9 * 60 + 15 + 5 * k; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
  const round2 = (x) => Math.round(x * 100) / 100;
  // ---- the shadow log for the page (the document, section 20): today's signals on the closed candles, each followed after the fact.
  // bars: today's candles (the forming one last, when closedCount says so); prevBars: the previous sessions' candles, for the ATR
  // carried over and yesterday's close (the last candle's close); closedCount: how many of the bars have closed; dayEnd: the day is
  // over; manage(t, bar, j, atr, lastK, dayEnd): the page's paper exits (Rule 1 and the trail), or null for none.
  // Per signal: the entry (the next candle's open), the best and worst move in the next 12 candles from the entry in the side's
  // direction (points and ATR), the move at 12 candles and at the day's close, and the paper result with the page's exits
  function dayLog({ bars, prevBars = [], closedCount = null, dayEnd = false, manage = null, first = 2, last = 65 }) {
    const lastK = (closedCount == null ? bars.length : Math.min(closedCount, bars.length)) - 1;
    if (lastK < 0) return { signals: [], rows: [], summary: { signals: 0, ok: 0, byRule: {}, often: [], okPoints: 0 }, atr: [] };
    const closed = bars.slice(0, lastK + 1), all = (prevBars || []).concat(closed), atrAll = atrBefore(all), atr = atrAll.slice(all.length - closed.length);
    const ctx = prevBars && prevBars.length ? { prev_close: prevBars[prevBars.length - 1].close } : null;
    const signals = runDay(closed, atr, ctx, null, null, first, last);
    const rows = signals.map(s => {
      const k = s.signal_candle, d = s.side === "CE" ? 1 : -1, entryBar = bars[k + 1] || null, a = atr[k];
      const r = { key: s.key, rule: s.rule, side: s.side, status: s.status, k, signalTime: closed[k].time, level: s.level, close: closed[k].close, atr: a, target: s.target, note: s.note, points: s.points, lines: s.lines,
                  entry: entryBar ? entryBar.open : null, entryTime: entryBar ? entryBar.time : null };
      if (!entryBar) return r;  // nothing to follow yet
      let hi = -Infinity, lo = Infinity, seen = 0;
      for (let j = k + 1; j <= Math.min(lastK, k + 12); j++) { hi = Math.max(hi, bars[j].high); lo = Math.min(lo, bars[j].low); seen++; }
      if (seen) { r.best = round2(d > 0 ? hi - r.entry : r.entry - lo); r.worst = round2(d > 0 ? lo - r.entry : r.entry - hi); r.bestAtr = a ? round2(r.best / a) : null; r.worstAtr = a ? round2(r.worst / a) : null; r.hourCandles = seen; }
      if (k + 12 <= lastK) r.at12 = round2(d * (bars[k + 12].close - r.entry));
      if (dayEnd) r.atClose = round2(d * (bars[lastK].close - r.entry));
      if (manage) {  // the paper result with the page's own exits, this signal on its own (one trade at a time is not applied)
        const t = { side: s.side, L: s.level, signalCandle: k, c1: closed[k], entry: r.entry, entryTime: r.entryTime, stage: 1, stop: s.level, best: 0, exit: null, exitTime: null, points: null, how: "open" };
        for (let j = k + 1; j <= lastK; j++) if (manage(t, bars[j], j, atr[j], lastK, dayEnd)) break;
        Object.assign(r, { exit: t.exit, exitTime: t.exitTime, how: t.exit != null ? t.how : "open", paper: t.exit != null ? t.points : round2(d * (bars[lastK].close - r.entry)) });
      }
      return r;
    });
    const byRule = {}; rows.forEach(r => { byRule[r.key] = (byRule[r.key] || 0) + 1; });
    const ok = rows.filter(r => r.status === "ok");
    return { signals, rows, atr, summary: { signals: rows.length, ok: ok.length, byRule, often: Object.keys(byRule).filter(key => byRule[key] > 5), okPoints: round2(ok.reduce((sum, r) => sum + (r.paper || 0), 0)) } };
  }
  root.MorePat = { COMMON, RULES, ORDER, LOOKBACK, candle, atrBefore, flip, flipCtx, swingHighs, swingLows, lineValue, zigzag, vwapSeries, swapWords, unflipSignal, makeSignal, settingsFor, detect, markStatus, runDay, slot, dayLog, round2 };
})(typeof window !== "undefined" ? window : globalThis);
