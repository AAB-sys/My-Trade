// The Volume Profile page's arithmetic (12 November, the owner: "build a new page with header name as volume profile").
// One code for the page (static/volume.html) and the check (lab/check_volprofile.js). Nothing here decides a call: it
// only counts how much was traded at each price.
//
// An index has no volume of its own, so each candle of the index is weighed with the volume its nearest futures
// contract traded in the same minutes (the server's /indices/{name}/volume). When Dhan gives no volume, each candle
// weighs 1: the profile then shows the TIME spent at each price, and the page says so.
//
// The open choices, each the smallest reasonable one, (owner to decide):
//   ROWS_WANTED   about how many price rows a day's profile has (the row's height is a round number of points)
//   VALUE_SHARE   the share of the day's volume the "value area" holds, around the busiest row
(function (root) {
  "use strict";
  const ROWS_WANTED = 40;
  const VALUE_SHARE = 0.70;
  const STEPS = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

  // the row's height in points for a session whose prices span `range` points: the round number that gives ROWS_WANTED rows or fewer
  function stepFor(range, wanted = ROWS_WANTED) {
    if (!(range > 0)) return STEPS[0];
    for (const s of STEPS) if (range / s <= wanted) return s;
    return STEPS[STEPS.length - 1];
  }

  // bars: [{time, open, high, low, close}], weights: Map or object time -> volume (null: every candle weighs 1).
  // A candle's volume is spread evenly over the rows its low-to-high range covers, by the share of the range in each row.
  // Returns {step, rows: [{price (the row's lower edge), up, down, total}] lowest first, total, poc, vah, val, counted, timeOnly}
  // poc: the middle of the busiest row; vah/val: the top and the bottom of the value area.
  function build(bars, weights, step) {
    const get = weights == null ? null : (weights instanceof Map ? (t) => weights.get(t) : (t) => weights[t]);
    if (!bars || !bars.length) return null;
    let lo = Infinity, hi = -Infinity;
    for (const b of bars) { if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; }
    step = step || stepFor(hi - lo);
    const first = Math.floor(lo / step), n = Math.max(1, Math.floor(hi / step) - first + 1);
    const rows = Array.from({ length: n }, (_, i) => ({ price: (first + i) * step, up: 0, down: 0, total: 0 }));
    let total = 0, counted = 0;
    for (const b of bars) {
      const w = get ? Number(get(b.time)) : 1;
      if (!(w > 0)) continue;
      counted++;
      const side = b.close >= b.open ? "up" : "down", span = b.high - b.low;
      const a = Math.floor(b.low / step) - first, z = Math.min(n - 1, Math.floor(b.high / step) - first);
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
    // the value area: from the busiest row outwards, each time taking the busier of the two rows next to it, until VALUE_SHARE of the volume is inside
    let a = p, z = p, inside = rows[p].total;
    while (inside < total * VALUE_SHARE && (a > 0 || z < n - 1)) {
      const below = a > 0 ? rows[a - 1].total : -1, above = z < n - 1 ? rows[z + 1].total : -1;
      if (above >= below) { z++; inside += rows[z].total; } else { a--; inside += rows[a].total; }
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

  const api = { ROWS_WANTED, VALUE_SHARE, stepFor, build, sessions };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.VolProfile = api;
})(typeof window !== "undefined" ? window : globalThis);
