// The Shape signal of the Volume Profile page (15 November, the owner, with the Pine script "Volume Profile Anatomies (D / B / P /
// Double Zone)": "make your own volume profile strategy out of it and convert that startegy for our volume profile page"; then
// "it should not give only one signal, multiple signals should be allowed in a day", and "Build option 1").
// One code for the page (static/volume.html) and the check (lab/check_vpshape.js). Paper only: it states a call, no order is placed.
//
// THE SHAPE (the script's own classifier, its settings unchanged): the day's profile so far in 30 equal rows, a candle's volume
// spread over the rows it covers; smoothed twice ((a + 2b + c) / 4); a second peak at least 20% of the rows away from the busiest
// row, at least 0.60 of its size, with a valley between them at most 0.70 of the second peak = "Double Zone"; else the busiest row
// in the top third of the range (above 0.66) = "P", in the bottom third (below 0.34) = "B", else "D". The value area holds 70% of
// the volume, grown from the busiest row one row at a time, the larger neighbour first.
//
// THE SIGNAL (the owner's option 1; my own rule, tested on two years of NIFTY 50 5-minute candles, 11 Nov 2024 to 9 Nov 2026, with
// time in place of volume: 539 calls, 33% won, +579 points after 8 a call; first year -652, second +1,231; at most 4 a day):
//   - from 12:10 to 13:30, a 5-minute candle that CLOSES outside the value area of the day's profile up to the candle before it
//     gives a call with the break: above the value area's high Buy CE, below its low Buy PE;
//   - the call enters at the next candle's open; its stop is the busiest price (POC) of that same profile;
//   - it ends at the stop, or at the 15:15 candle's open;
//   - one call open at a time; after a call ends, the next such candle inside the window gives a new call (many calls a day);
//   - no call before the day has 12 five-minute candles, and none whose entry is already at or beyond its stop.
// The shape names the day; the test found the shape alone decides nothing, so every shape trades the same rule.
(function (root) {
  "use strict";
  const CFG = { rows: 30, va: 0.70, smooth: 2, secondRatio: 0.60, valleyRatio: 0.70, posHi: 0.66, posLo: 0.34,
                from: "12:10", to: "13:30", exit: "15:15", minBars: 12 };
  const NAMES = { D: "D-shape (balanced)", B: "B-shape (busy at the bottom)", P: "P-shape (busy at the top)", Double: "Double Zone (two busy areas)" };
  const IST = 19800;
  const hm = (t) => { const s = ((t + IST) % 86400 + 86400) % 86400; return String(Math.floor(s / 3600)).padStart(2, "0") + ":" + String(Math.floor(s % 3600 / 60)).padStart(2, "0"); };
  const weigher = (weights) => weights == null ? null : (weights instanceof Map ? (t) => weights.get(t) : (t) => weights[t]);

  // the profile: rows of equal height from the low to the high; a candle with no volume (or no volumes at all) weighs 1, as the script does
  function build(bars, weights, rows = CFG.rows) {
    const get = weigher(weights);
    let lo = Infinity, hi = -Infinity;
    for (const b of bars) { if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; }
    const step = Math.max((hi - lo) / rows, 0.05), v = new Array(rows).fill(0), at = (p) => Math.max(0, Math.min(rows - 1, Math.floor((p - lo) / step)));
    for (const b of bars) {
      let w = get ? Number(get(b.time)) : 1; if (!(w > 0)) w = 1;
      const r0 = at(b.low), r1 = at(b.high), span = b.high - b.low;
      if (span <= 0) { v[r0] += w; continue; }
      for (let r = r0; r <= r1; r++) { const rl = lo + r * step, ov = Math.max(0, Math.min(b.high, rl + step) - Math.max(b.low, rl)); v[r] += w * ov / span; }
    }
    return { v, lo, hi, step };
  }
  function valueArea(v, poc, pct = CFG.va) {
    const n = v.length, total = v.reduce((a, b) => a + b, 0);
    let acc = v[poc], up = poc, dn = poc;
    while (acc < total * pct && (up < n - 1 || dn > 0)) { const upV = up < n - 1 ? v[up + 1] : -1, dnV = dn > 0 ? v[dn - 1] : -1; if (upV >= dnV) { up++; acc += upV; } else { dn--; acc += dnV; } }
    return [up, dn];
  }
  function classify(v, c = CFG) {
    const n = v.length; let s = v.slice();
    for (let p = 0; p < c.smooth; p++) { const t = s.slice(); for (let i = 0; i < n; i++) s[i] = (t[Math.max(i - 1, 0)] + 2 * t[i] + t[Math.min(i + 1, n - 1)]) / 4; }
    const pocV = Math.max(...s), poc = s.indexOf(pocV), minSep = Math.max(3, Math.round(n * 0.2));
    let p2 = -1, p2V = 0;
    for (let i = 0; i < n; i++) if (Math.abs(i - poc) >= minSep) { const cv = s[i], lv = s[Math.max(i - 1, 0)], rv = s[Math.min(i + 1, n - 1)]; if ((i === 0 || cv >= lv) && (i === n - 1 || cv >= rv) && cv > p2V) { p2V = cv; p2 = i; } }
    let kind = "";
    if (p2 >= 0 && p2V >= c.secondRatio * pocV) { let valley = pocV; for (let j = Math.min(poc, p2); j <= Math.max(poc, p2); j++) valley = Math.min(valley, s[j]); if (valley <= c.valleyRatio * p2V) kind = "Double"; }
    if (!kind) { const pos = n > 1 ? poc / (n - 1) : 0.5; kind = pos > c.posHi ? "P" : pos < c.posLo ? "B" : "D"; }
    return { shape: kind, peak: poc, peak2: kind === "Double" ? p2 : -1, position: n > 1 ? poc / (n - 1) : 0.5 };
  }
  // everything of one profile: {shape, poc, vah, val, low, high, position (the busiest row's place in the range, 0 to 1)}; null without candles
  function read(bars, weights, c = CFG) {
    if (!bars || !bars.length) return null;
    const pr = build(bars, weights, c.rows), raw = pr.v.indexOf(Math.max(...pr.v)), [up, dn] = valueArea(pr.v, raw, c.va), k = classify(pr.v, c);
    return { shape: k.shape, position: k.position, poc: pr.lo + (raw + 0.5) * pr.step, vah: pr.lo + (up + 1) * pr.step, val: pr.lo + dn * pr.step, low: pr.lo, high: pr.hi };
  }
  // 1-minute candles into 5-minute ones (09:15, 09:20 ...), oldest first
  function five(fine) {
    const out = [];
    for (const m of fine) { const t = Math.floor(m.time / 300) * 300, last = out[out.length - 1];
      if (last && last.time === t) { if (m.high > last.high) last.high = m.high; if (m.low < last.low) last.low = m.low; last.close = m.close; }
      else out.push({ time: t, open: m.open, high: m.high, low: m.low, close: m.close }); }
    return out;
  }
  // One day's calls. bars5: the day's 5-minute candles oldest first, the one forming now last; closed: how many of them have closed;
  // fine: the candles the profile is counted from (the day's 1-minute candles, or bars5 itself); weights: their volume (null: time).
  // Returns [{n, side "CE"|"PE", signalTime, entryTime, entry, stop, shape, vah, val, how "open"|"stop"|"time", exitTime, exit, points}]
  function calls(bars5, closed, fine, weights, c = CFG) {
    const out = [], b = bars5;
    let open = null;
    for (let k = c.minBars; k < b.length; k++) {
      if (open) {
        if (hm(b[k].time) >= c.exit) { Object.assign(open, { how: "time", exitTime: b[k].time, exit: b[k].open }); open = null; }
        else if (open.side === "CE" ? b[k].low <= open.stop : b[k].high >= open.stop) { Object.assign(open, { how: "stop", exitTime: b[k].time, exit: open.stop }); open = null; }
        else continue;
      }
      const when = hm(b[k].time);
      if (when < c.from || when > c.to || k >= closed || k + 1 >= b.length) continue;
      const p = read(fine.filter(m => m.time < b[k].time), weights, c);
      if (!p) continue;
      const side = b[k].close > p.vah ? "CE" : b[k].close < p.val ? "PE" : null;
      if (!side) continue;
      const entry = b[k + 1].open;
      if (side === "CE" ? entry <= p.poc : entry >= p.poc) continue;
      open = { n: out.length + 1, side, signalTime: b[k].time, entryTime: b[k + 1].time, entry, stop: p.poc, shape: p.shape, vah: p.vah, val: p.val, how: "open", exitTime: null, exit: null };
      out.push(open);
    }
    const last = b.length ? b[b.length - 1].close : null;
    for (const t of out) t.points = (t.side === "CE" ? 1 : -1) * ((t.exit != null ? t.exit : last) - t.entry);
    return out;
  }

  const api = { CFG, NAMES, hm, build, valueArea, classify, read, five, calls };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.VpShape = api;
})(typeof window !== "undefined" ? window : globalThis);
