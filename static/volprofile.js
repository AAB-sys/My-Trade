// The Volume Profile page's arithmetic (12 November, the owner: "build a new page with header name as volume profile").
// One code for the page (static/volume.html) and the check (lab/check_volprofile.js). Nothing here decides a call: it
// only counts how much was traded at each price.
//
// An index has no volume of its own, so each candle of the index is weighed with the volume its nearest futures
// contract traded in the same minutes (the server's /indices/{name}/volume). When Dhan gives no volume, each candle
// weighs 1: the profile then shows the TIME spent at each price, and the page says so.
//
// The owner, 12 November: "This should be as same as dhan, no gaps, no changes, nothing different." So the profile is counted
// the way the volume profile on a broker's trading chart is, with that chart's usual settings, the same for every index:
//   ROWS          24 rows, of equal height, from the day's low to the day's high
//   VALUE_SHARE   the value area holds 70% of the day's volume
//   the value area grows from the busiest row: the two rows above it are weighed against the two rows below it, the heavier
//   pair is taken, and so on until 70% is inside
//   the count is made from the day's 1-minute candles whatever candle size the chart shows (the page passes them)
(function (root) {
  "use strict";
  const ROWS = 24;
  const VALUE_SHARE = 0.70;

  // bars: [{time, open, high, low, close}], weights: Map or object time -> volume (null: every candle weighs 1).
  // A candle's volume is spread evenly over the rows its low-to-high range covers, by the share of the range in each row.
  // Returns {step, rows: [{price (the row's lower edge), up, down, total}] lowest first, total, poc, vah, val, counted, timeOnly}
  // poc: the middle of the busiest row; vah/val: the top and the bottom of the value area.
  function build(bars, weights, count = ROWS) {
    const get = weights == null ? null : (weights instanceof Map ? (t) => weights.get(t) : (t) => weights[t]);
    if (!bars || !bars.length) return null;
    let lo = Infinity, hi = -Infinity;
    for (const b of bars) { if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; }
    const n = hi > lo ? count : 1, step = hi > lo ? (hi - lo) / n : 0.05;
    const rowOf = (price) => Math.max(0, Math.min(n - 1, Math.floor((price - lo) / step)));
    const rows = Array.from({ length: n }, (_, i) => ({ price: lo + i * step, up: 0, down: 0, total: 0 }));
    let total = 0, counted = 0;
    for (const b of bars) {
      const w = get ? Number(get(b.time)) : 1;
      if (!(w > 0)) continue;
      counted++;
      const side = b.close >= b.open ? "up" : "down", span = b.high - b.low;
      const a = rowOf(b.low), z = rowOf(b.high);
      for (let i = a; i <= z; i++) {
        const share = span > 0 ? (Math.min(b.high, rows[i].price + step) - Math.max(b.low, rows[i].price)) / span : (i === a ? 1 : 0);
        if (share <= 0) continue;
        rows[i][side] += w * share; rows[i].total += w * share;
      }
      total += w;
    }
    if (!(total > 0)) return { step, rows, total: 0, poc: null, vah: null, val: null, counted: 0, timeOnly: get == null };
    let p = 0;
    for (let i = 1; i < n; i++) if (rows[i].total > rows[p].total) p = i;
    let a = p, z = p, inside = rows[p].total;
    const sum = (from, to) => { let x = 0; for (let i = Math.max(0, from); i <= Math.min(n - 1, to); i++) x += rows[i].total; return x; };
    while (inside < total * VALUE_SHARE && (a > 0 || z < n - 1)) {
      const above = z < n - 1 ? sum(z + 1, z + 2) : -1, below = a > 0 ? sum(a - 2, a - 1) : -1;
      if (above >= below) { inside += above; z = Math.min(n - 1, z + 2); } else { inside += below; a = Math.max(0, a - 2); }
    }
    return { step, rows, total, poc: rows[p].price + step / 2, pocRow: p, vah: rows[z].price + step, val: rows[a].price, vaFrom: a, vaTo: z, counted, timeOnly: get == null };
  }

  // the candles split into their sessions (IST days), oldest first: [[bars of day 1], [bars of day 2], ...]
  function sessions(bars) {
    const out = [];
    let day = null;
    for (const b of bars) {
      const d = Math.floor((b.time + 19800) / 86400);
      if (d !== day) { out.push([]); day = d; }
      out[out.length - 1].push(b);
    }
    return out;
  }

  const api = { ROWS, VALUE_SHARE, build, sessions };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.VolProfile = api;
})(typeof window !== "undefined" ? window : globalThis);
