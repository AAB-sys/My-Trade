// ULTROAN shadow signals (26 November, the owner: "Yes, build the shadow page"). The strategies ULTROAN's lab keeps on its
// watch list, run live on NIFTY 50's 5-minute candles so the owner can see every signal while they are still UNDER TEST.
// A family of its own: it reads no page's rule and no page reads it. Nothing here is a paper call, a Trade Plan call or a
// Calls with Signals call; nothing is sent to the server. The rules and numbers are the lab's, fixed on the day each was found
// (lab/check_shadow.js holds this file to the lab's own answers). Never change a number here: a changed rule is a new rule.
(function (root, make) { if (typeof module === "object" && module.exports) module.exports = make(); else root.Shadow = make(); })(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const IST = 19800, DAY_BARS = 75;
  const hmOf = (t) => new Date((t + IST) * 1000).toISOString().slice(11, 16), dateOf = (t) => new Date((t + IST) * 1000).toISOString().slice(0, 10);

  // The watch list, as found. `found` = the day it went on the list: only days after it count as the test.
  const LIST = [
    { id: "NEWHIGH-TREND", fam: "don", found: "2026-11-13", o: { n: 12, trail: 5, max: 3, trend: 1, from: "09:45" },
      words: "A candle closes above the highest high of the 12 candles before it: Buy CE. Below their lowest low: Buy PE. Only when the fast average agrees (above the slow one for CE, below for PE). 09:45 to 14:00, at most 3 a day. The stop follows the price 5 ATR behind. Out at 15:15.",
      old: "Old data: year 1 +502 points (245 calls), year 2 +1,343 (269 calls), after 8 points a call. Almost all of it from the PE side." },
    { id: "QUIET-BREAK", fam: "quiet", found: "2026-11-13", o: { small: 0.8, min: 15, rr: 0, stopAt: "far" },
      words: "Only after a quiet day (yesterday's range under 0.8 of the usual). The first candle that closes above the first 15 minutes' high: Buy CE; below their low: Buy PE. Until 13:30. Stop at the other side of those 15 minutes. Out at 15:15.",
      old: "Old data: year 1 +551 points (102 calls), year 2 +1,794 (86 calls), after 8 points a call. Almost all of it from the PE side." },
    { id: "DIR-1215", fam: "dir", found: "2026-11-13", o: { at: "12:15", move: 0.3, stop: 0.25, gapWith: 1 },
      words: "One look a day, at 12:15: the day has moved at least 0.3 of the usual day's range from its open, the same way as the opening gap: go with it (up: Buy CE, down: Buy PE). Stop 0.25 of the usual range away. Out at 15:15.",
      old: "Old data: year 1 +1,088 points (61 calls), year 2 +293 (64 calls), after 8 points a call." },
    { id: "NEWHIGH-STAY", fam: "donva", found: "2026-11-19", o: { n: 12, trail: 5, max: 3, trend: 1, from: "09:45", f: "stay" },
      words: "NEWHIGH-TREND's signal, taken only when the day opened outside yesterday's value area, the signal goes the same way, and price has not touched yesterday's edge yet today.",
      old: "Old data: year 1 +562 points (56 calls), year 2 +1,217 (73 calls), after 8 points a call." },
  ];

  // a value area by time (30 rows, 70%) of candles b[0..k)
  function vaOf(b, k) { let lo = Infinity, hi = -Infinity; for (let i = 0; i < k; i++) { if (b[i].low < lo) lo = b[i].low; if (b[i].high > hi) hi = b[i].high; }
    const n = 30, step = Math.max((hi - lo) / n, 0.05), v = new Array(n).fill(0), at = (p) => Math.max(0, Math.min(n - 1, Math.floor((p - lo) / step)));
    for (let i = 0; i < k; i++) for (let r = at(b[i].low); r <= at(b[i].high); r++) v[r]++;
    let poc = v.indexOf(Math.max(...v)), up = poc, dn = poc, acc = v[poc]; const tot = v.reduce((a, x) => a + x, 0);
    while (acc < tot * 0.7 && (up < n - 1 || dn > 0)) { const u = up < n - 1 ? v[up + 1] : -1, d = dn > 0 ? v[dn - 1] : -1; if (u >= d) { up++; acc += u; } else { dn--; acc += d; } }
    return { val: lo + dn * step, vah: lo + (up + 1) * step, poc: lo + (poc + 0.5) * step }; }

  const idx = (b, hm) => b.findIndex((x) => x.hm >= hm);
  const FAM = {
    orb: (b, c, o) => { const e = o.min / 5; if (b.length < e) return null; const hi = Math.max(...b.slice(0, e).map((x) => x.high)), lo = Math.min(...b.slice(0, e).map((x) => x.low));
      return (k) => k < e - 1 || k < 1 || b[k].hm > "13:30" ? null : b[k].close > hi && b[k - 1].close <= hi ? { side: "CE", stop: o.stopAt === "mid" ? (hi + lo) / 2 : lo } : b[k].close < lo && b[k - 1].close >= lo ? { side: "PE", stop: o.stopAt === "mid" ? (hi + lo) / 2 : hi } : null; },
    quiet: (b, c, o) => (!c.adr || !(c.prevRange < o.small * c.adr)) ? null : FAM.orb(b, c, o),
    dir: (b, c, o) => { if (!c.adr) return null; const at = idx(b, o.at); if (at < 0) return null; const k0 = at - 1;
      return (k) => { if (k !== k0) return null; const m = b[k].close - b[0].open; if (o.gapWith && Math.sign(b[0].open - c.pdc) !== Math.sign(m)) return null;
        return m > o.move * c.adr ? { side: "CE", stop: b[k].close - o.stop * c.adr } : m < -o.move * c.adr ? { side: "PE", stop: b[k].close + o.stop * c.adr } : null; }; },
    don: (b, c, o) => (k) => { if (k < o.n || b[k].hm < o.from || b[k].hm > "14:00") return null; const a = c.atr[k]; let hi = -Infinity, lo = Infinity; for (let i = k - o.n; i < k; i++) { hi = Math.max(hi, b[i].high); lo = Math.min(lo, b[i].low); }
      if (b[k].close > hi && (!o.trend || c.e20[k] > c.e50[k])) return { side: "CE", stop: b[k].close - o.trail * a };
      if (b[k].close < lo && (!o.trend || c.e20[k] < c.e50[k])) return { side: "PE", stop: b[k].close + o.trail * a }; return null; },
    donva: (b, c, o) => { const y = c.yva; if (!y) return null; const inner = FAM.don(b, c, o), op = b[0].open, g = op > y.vah ? 1 : op < y.val ? -1 : 0;
      return (k) => { const s = inner(k); if (!s) return null; const dir = s.side === "CE" ? 1 : -1; if (!g || dir !== g) return null;
        const edge = g > 0 ? y.vah : y.val; for (let i = 0; i <= k; i++) if (g > 0 ? b[i].low <= edge : b[i].high >= edge) return null; return s; }; },
  };

  // One day of one strategy. b: the day's candles (the forming one too); closed: how many of them have closed.
  // A signal is read at a closed candle; in at the next candle's open; one call open at a time; out at the stop, or at 15:15.
  function runDay(b, c, st, closed) { const sig = FAM[st.fam](b, c, st.o), o = st.o, out = []; if (!sig) return out; let open = null, n = 0;
    for (let k = 0; k < b.length; k++) { const x = b[k], done = k < closed;
      if (open) {
        if (x.hm >= "15:15") { open.exit = x.open; open.how = "15:15"; }
        else if (open.dir > 0 ? x.low <= open.stop : x.high >= open.stop) { open.exit = open.dir > 0 ? Math.min(open.stop, x.open) : Math.max(open.stop, x.open); open.how = "stop"; }
        else if (open.trail && done) { const lv = open.dir > 0 ? x.close - open.trail * c.atr[k] : x.close + open.trail * c.atr[k]; open.stop = open.dir > 0 ? Math.max(open.stop, lv) : Math.min(open.stop, lv); }
        if (open.exit != null) { open.points = open.dir * (open.exit - open.entry); open.exitTime = x.time; open.exitHm = x.hm; out.push(open); open = null; }
        if (open || x.hm >= "15:15") continue; }
      if (!done || k + 1 >= b.length || b[k + 1].hm >= "15:00" || n >= (o.max || 99)) continue;
      const s = sig(k); if (!s) continue; const entry = b[k + 1].open, dir = s.side === "CE" ? 1 : -1, risk = dir * (entry - s.stop); if (!(risk > 3)) continue;
      open = { id: st.id, side: s.side, dir, signalTime: x.time, signalHm: x.hm, entryTime: b[k + 1].time, entryHm: b[k + 1].hm, entry, stop0: s.stop, stop: s.stop, trail: o.trail || 0, exit: null, how: "open", points: null }; n++; }
    if (open) { const last = b[b.length - 1]; if (closed >= DAY_BARS) { open.exit = last.close; open.how = "close"; open.exitTime = last.time; open.exitHm = last.hm; open.points = open.dir * (open.exit - open.entry); } else open.now = open.dir * (last.close - open.entry); out.push(open); }
    return out; }

  // candles: 5-minute candles of several sessions, oldest first ({time, open, high, low, close}); days: the daily list
  // ({date, high, low, close}) for the usual day's range when the candles do not reach back ten sessions; now: the server's clock (seconds).
  // -> { days: [{ date, ready, calls: { id: [call] } }], list } for every session from the fourth one on (the averages need three to settle).
  function run(candles, days, now) {
    const by = {}, order = []; for (const x of candles) { const d = dateOf(x.time); if (!by[d]) { by[d] = []; order.push(d); } by[d].push({ ...x, hm: hmOf(x.time) }); }
    const rangeOf = {}, closeOf = {}; for (const d of days || []) { rangeOf[d.date] = d.high - d.low; closeOf[d.date] = d.close; }
    const full = (d) => by[d] && by[d].length >= 70;
    for (const d of order) if (full(d)) { rangeOf[d] = Math.max(...by[d].map((x) => x.high)) - Math.min(...by[d].map((x) => x.low)); closeOf[d] = by[d][by[d].length - 1].close; }
    const known = Object.keys(rangeOf).sort();
    let atr = null, e20 = null, e50 = null, prevC = null; const res = [];
    order.forEach((d, i) => { const b = by[d], a = [], f = [], s = [];
      for (const x of b) { const tr = prevC == null ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - prevC), Math.abs(x.low - prevC)); atr = atr == null ? tr : (atr * 13 + tr) / 14; e20 = e20 == null ? x.close : e20 + (x.close - e20) * 2 / 21; e50 = e50 == null ? x.close : e50 + (x.close - e50) * 2 / 51; prevC = x.close; a.push(atr); f.push(e20); s.push(e50); }
      if (i < 3) return;
      const before = known.filter((k) => k < d), last10 = before.slice(-10), p = by[order[i - 1]];
      const c = { atr: a, e20: f, e50: s, adr: last10.length >= 10 ? last10.reduce((q, k) => q + rangeOf[k], 0) / 10 : null, prevRange: before.length ? rangeOf[before[before.length - 1]] : null, pdc: before.length ? closeOf[before[before.length - 1]] : null, yva: p && p.length >= 70 ? vaOf(p, p.length) : null };
      const closed = now == null ? b.length : b.filter((x) => x.time + 300 <= now).length, calls = {};
      for (const st of LIST) calls[st.id] = runDay(b, c, st, closed);
      res.push({ date: d, candles: b, closed, quietDay: c.adr != null && c.prevRange < 0.8 * c.adr, usual: c.adr, calls }); });
    return { days: res, list: LIST }; }

  return { run, LIST, vaOf, COST: 8 };
});
