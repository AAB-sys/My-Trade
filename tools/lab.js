// ULTROAN strategy lab (15 Nov, the owner: "I need better and advanced new strategies which will work better and gives better calls CE and PE").
// Every idea is the owner's-data-only: NIFTY 50 5-minute candles, 2 years. Found on year 1, judged on year 2. Points after 8 a call.
"use strict";
const fs = require("fs"), F = process.argv[2], COST = 8;
const byDay = {}; for (const [dd, t, o, h, l, c] of fs.readFileSync(F, "utf8").trim().split("\n").slice(1).map(l => l.split(","))) (byDay[dd] = byDay[dd] || []).push({ hm: t.slice(0, 5), open: +o, high: +h, low: +l, close: +c });
const dates = Object.keys(byDay).sort().filter(x => byDay[x].length >= 70);
// per-day context: previous day's high/low/close, average daily range of the 10 days before, 5-minute ATR(14) carried over days, EMAs carried over days
const ctx = {}; { let atr = null, e20 = null, e50 = null, prevC = null; const ranges = [];
  dates.forEach((d, i) => { const b = byDay[d], hi = Math.max(...b.map(x => x.high)), lo = Math.min(...b.map(x => x.low));
    const a = [], f = [], s = []; b.forEach((x) => { const tr = prevC == null ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - prevC), Math.abs(x.low - prevC)); atr = atr == null ? tr : (atr * 13 + tr) / 14; e20 = e20 == null ? x.close : e20 + (x.close - e20) * 2 / 21; e50 = e50 == null ? x.close : e50 + (x.close - e50) * 2 / 51; prevC = x.close; a.push(atr); f.push(e20); s.push(e50); });
    const p = i ? byDay[dates[i - 1]] : null;
    ctx[d] = { atr: a, e20: f, e50: s, adr: ranges.length >= 10 ? ranges.slice(-10).reduce((q, x) => q + x, 0) / 10 : null, pdh: p ? Math.max(...p.map(x => x.high)) : null, pdl: p ? Math.min(...p.map(x => x.low)) : null, pdc: p ? p[p.length - 1].close : null, prevRange: ranges.length ? ranges[ranges.length - 1] : null };
    ranges.push(hi - lo); }); }
// the engine: signal(k) at candle k's close -> {side, stop, target?}; in at the next candle's open; one call open at a time; out at stop, target, or 15:15
function runDay(d, mk, o) {
  const b = byDay[d], c = ctx[d], sig = mk(b, c, o), out = []; if (!sig) return out; let open = null, n = 0;
  for (let k = 0; k < b.length; k++) {
    if (open) { const x = b[k];
      if (x.hm >= "15:15") { open.pts = open.dir * (x.open - open.entry); out.push(open); open = null; continue; }
      if (open.dir > 0 ? x.low <= open.stop : x.high >= open.stop) { open.pts = open.dir * (Math.min(open.dir > 0 ? x.open : Infinity, open.stop) === open.stop || open.dir < 0 ? open.stop - open.entry : x.open - open.entry); if (open.dir < 0) open.pts = open.entry - Math.max(open.stop, x.open); else open.pts = Math.min(open.stop, x.open) - open.entry; out.push(open); open = null; }
      else if (open.target != null && (open.dir > 0 ? x.high >= open.target : x.low <= open.target)) { open.pts = Math.abs(open.target - open.entry); out.push(open); open = null; }
      else if (open.trail) { const lv = open.dir > 0 ? x.close - open.trail * c.atr[k] : x.close + open.trail * c.atr[k]; open.stop = open.dir > 0 ? Math.max(open.stop, lv) : Math.min(open.stop, lv); }
      if (open) continue; }
    if (k + 1 >= b.length || b[k + 1].hm >= "15:00" || n >= (o.max || 99)) continue;
    const s = sig(k); if (!s) continue; const entry = b[k + 1].open, dir = s.side === "CE" ? 1 : -1, risk = dir * (entry - s.stop); if (!(risk > 3)) continue;
    open = { side: s.side, dir, entry, stop: s.stop, target: o.rr ? entry + dir * o.rr * risk : null, trail: o.trail || 0, hm: b[k + 1].hm, d }; n++;
  }
  if (open) { open.pts = open.dir * (b[b.length - 1].close - open.entry); out.push(open); }
  return out;
}
const idx = (b, hm) => b.findIndex(x => x.hm >= hm);
const FAM = {
  // 1. Opening range break: the first o.min minutes' high/low; a close beyond it; stop at the range's middle or far side
  orb: { grid: { min: [15, 30, 60], stopAt: ["mid", "far"], rr: [0, 1.5, 3], max: [1, 2], narrow: [0, 0.6] }, mk: (b, c, o) => { const e = o.min / 5; const hi = Math.max(...b.slice(0, e).map(x => x.high)), lo = Math.min(...b.slice(0, e).map(x => x.low)); if (o.narrow && (!c.adr || hi - lo > o.narrow * c.adr)) return null;
    return (k) => k < e - 1 || b[k].hm > "13:30" ? null : b[k].close > hi && b[k - 1].close <= hi ? { side: "CE", stop: o.stopAt === "mid" ? (hi + lo) / 2 : lo } : b[k].close < lo && b[k - 1].close >= lo ? { side: "PE", stop: o.stopAt === "mid" ? (hi + lo) / 2 : hi } : null; } },
  // 2. Trend pullback: averages in order, price dips to the fast average and a candle closes back beyond the candle before
  pull: { grid: { rr: [0, 1.5, 2.5], look: [3, 6], gap: [0, 0.5], max: [2, 4], from: ["09:45", "11:00"] }, mk: (b, c, o) => (k) => { if (k < o.look + 1 || b[k].hm < o.from || b[k].hm > "14:15") return null; const a = c.atr[k], f = c.e20[k], s = c.e50[k];
    if (f - s > o.gap * a && b[k].close > f && b[k].close > b[k - 1].high && b.slice(k - o.look, k + 1).some(x => x.low <= c.e20[k])) return { side: "CE", stop: Math.min(...b.slice(k - o.look, k + 1).map(x => x.low)) - 0.2 * a };
    if (s - f > o.gap * a && b[k].close < f && b[k].close < b[k - 1].low && b.slice(k - o.look, k + 1).some(x => x.high >= c.e20[k])) return { side: "PE", stop: Math.max(...b.slice(k - o.look, k + 1).map(x => x.high)) + 0.2 * a }; return null; } },
  // 3. Yesterday's high / low break: a close through yesterday's high or low
  pd: { grid: { stopAtr: [1.5, 3], rr: [0, 1.5, 3], max: [1, 2], until: ["11:30", "14:00"] }, mk: (b, c, o) => c.pdh == null ? null : (k) => { if (k < 1 || b[k].hm > o.until) return null; const a = c.atr[k];
    if (b[k].close > c.pdh && b[k - 1].close <= c.pdh) return { side: "CE", stop: b[k].close - o.stopAtr * a }; if (b[k].close < c.pdl && b[k - 1].close >= c.pdl) return { side: "PE", stop: b[k].close + o.stopAtr * a }; return null; } },
  // 4. Stretch and snap back: price far from the day's average price, then a candle turns; aim: back to the average
  fade: { grid: { far: [0.35, 0.5, 0.7], stopAtr: [1.5, 3], rr: [0, 1, 2], max: [1, 2], from: ["10:00", "11:30"] }, mk: (b, c, o) => { if (!c.adr) return null; const mean = []; let s = 0; b.forEach((x, i) => { s += (x.high + x.low + x.close) / 3; mean.push(s / (i + 1)); });
    return (k) => { if (k < 6 || b[k].hm < o.from || b[k].hm > "14:30") return null; const a = c.atr[k], gap = b[k].close - mean[k];
      if (gap < -o.far * c.adr && b[k].close > b[k].open && b[k].close > b[k - 1].high) return { side: "CE", stop: Math.min(b[k].low, b[k - 1].low) - 0.2 * a - (o.stopAtr - 1.5) * a }; if (gap > o.far * c.adr && b[k].close < b[k].open && b[k].close < b[k - 1].low) return { side: "PE", stop: Math.max(b[k].high, b[k - 1].high) + 0.2 * a + (o.stopAtr - 1.5) * a }; return null; }; } },
  // 5. The day's direction: at a set time, if the day has moved clearly one way, go with it till the close
  dir: { grid: { at: ["10:15", "11:15", "12:15", "13:15", "14:15"], move: [0.3, 0.5, 0.8], stop: [0.25, 0.4, 0.7], gapWith: [0, 1] }, mk: (b, c, o) => { if (!c.adr) return null; const k0 = idx(b, o.at) - 1;
    return (k) => { if (k !== k0) return null; const m = b[k].close - b[0].open; if (o.gapWith && Math.sign(b[0].open - c.pdc) !== Math.sign(m)) return null; return m > o.move * c.adr ? { side: "CE", stop: b[k].close - o.stop * c.adr } : m < -o.move * c.adr ? { side: "PE", stop: b[k].close + o.stop * c.adr } : null; }; } },
  // 6. New high / low of the last N candles, held with a stop that follows the price
  don: { grid: { n: [12, 24, 48], trail: [2, 3.5, 5], max: [1, 3], trend: [0, 1], from: ["09:45", "11:00"] }, mk: (b, c, o) => (k) => { if (k < o.n || b[k].hm < o.from || b[k].hm > "14:00") return null; const w = b.slice(k - o.n, k), a = c.atr[k];
    if (b[k].close > Math.max(...w.map(x => x.high)) && (!o.trend || c.e20[k] > c.e50[k])) return { side: "CE", stop: b[k].close - o.trail * a }; if (b[k].close < Math.min(...w.map(x => x.low)) && (!o.trend || c.e20[k] < c.e50[k])) return { side: "PE", stop: b[k].close + o.trail * a }; return null; } },
  // 7. Quiet day before, then the first clear break: yesterday's range small against the usual; first 30 minutes' break
  quiet: { grid: { small: [0.6, 0.8], min: [15, 30], rr: [0, 2], stopAt: ["mid", "far"] }, mk: (b, c, o) => { if (!c.adr || !(c.prevRange < o.small * c.adr)) return null; return FAM.orb.mk(b, c, { ...o, narrow: 0 }); } },
};
// 8. (16 Nov) The value area's edges: the day's own time-at-price profile so far (30 rows, 70%); a candle dips to the area's low and
// closes back above it, green -> CE (touches the high and closes back below, red -> PE). From 16 Nov's session: the edges turned
// price five times, the middle was noise.
const vaCache = new Map();
function vaOf(b, k) { let lo = Infinity, hi = -Infinity; for (let i = 0; i < k; i++) { if (b[i].low < lo) lo = b[i].low; if (b[i].high > hi) hi = b[i].high; }
  const n = 30, step = Math.max((hi - lo) / n, 0.05), v = new Array(n).fill(0), at = (p) => Math.max(0, Math.min(n - 1, Math.floor((p - lo) / step)));
  for (let i = 0; i < k; i++) for (let r = at(b[i].low); r <= at(b[i].high); r++) v[r]++;
  let poc = v.indexOf(Math.max(...v)), up = poc, dn = poc, acc = v[poc]; const tot = v.reduce((a, x) => a + x, 0);
  while (acc < tot * 0.7 && (up < n - 1 || dn > 0)) { const u = up < n - 1 ? v[up + 1] : -1, d = dn > 0 ? v[dn - 1] : -1; if (u >= d) { up++; acc += u; } else { dn--; acc += d; } }
  return { val: lo + dn * step, vah: lo + (up + 1) * step, poc: lo + (poc + 0.5) * step, lo, hi }; }
FAM.edge = { grid: { from: ["10:15", "11:15", "12:15"], stopAtr: [0.5, 1.5], rr: [0, 1.5, 3], wide: [0, 0.4], max: [2, 4] }, mk: (b, c, o) => { const va = b.map((x, k) => k >= 12 ? vaOf(b, k) : null);
  return (k) => { const p = va[k]; if (!p || b[k].hm < o.from || b[k].hm > "14:30") return null; if (o.wide && (!c.adr || p.vah - p.val < o.wide * c.adr)) return null; const a = c.atr[k], x = b[k];
    if (x.low <= p.val && x.close > p.val && x.close > x.open && b[k - 1].close > p.val) return { side: "CE", stop: x.low - o.stopAtr * a };
    if (x.high >= p.vah && x.close < p.vah && x.close < x.open && b[k - 1].close < p.vah) return { side: "PE", stop: x.high + o.stopAtr * a }; return null; }; } };
// 9. (16 Nov night) THE NOON RULE, from the two-year study of the page's profile (twoyears.js): at a set time, the day's profile so
// far (the page's own vpshape.js, by time); close above VAH -> CE, below VAL -> PE (optionally only when the shape agrees: P for
// CE, B or Double for PE); stop at the POC, the near edge, or an ATR distance; out at 15:15.
const VPS = require(require("path").resolve(__dirname, "../swingtree/static/vpshape.js"));
FAM.noon = { grid: { at: ["11:30", "12:00", "12:30", "13:00"], stop: ["poc", "edge", "atr2"], shape: [0, 1], need: [0, 0.1] }, mk: (b, c, o) => { const k0 = idx(b, o.at) - 1; if (k0 < 12) return null;
  const bb = b.slice(0, k0 + 1).map((x, i) => ({ ...x, time: i * 300 })), p = VPS.read(bb, null), x = b[k0], a = c.atr[k0], gap = o.need * (p.vah - p.val);
  return (k) => { if (k !== k0) return null;
    if (x.close > p.vah + gap && (!o.shape || p.shape === "P")) return { side: "CE", stop: o.stop === "poc" ? p.poc : o.stop === "edge" ? p.val + (p.vah - p.val) * 0.5 : x.close - 2 * a };
    if (x.close < p.val - gap && (!o.shape || p.shape === "B" || p.shape === "Double")) return { side: "PE", stop: o.stop === "poc" ? p.poc : o.stop === "edge" ? p.val + (p.vah - p.val) * 0.5 : x.close + 2 * a };
    return null; }; } };
// 10. (17 Nov) OUT OF VALUE STAYS OUT, from the growing study's strongest finding (grow.js: above the VAH the price did not come
// back to it in the next 30 minutes 63% of the time; two years 50%): n closes in a row above the day's value area so far (by time)
// -> CE, below it -> PE; stop just inside the edge or at the POC, optionally trailed; out at 15:15.
const vaDay = new WeakMap(), vaAll = (b) => { let v = vaDay.get(b); if (!v) { v = b.map((x, k) => k >= 12 ? vaOf(b, k) : null); vaDay.set(b, v); } return v; };
FAM.out = { grid: { from: ["10:15", "11:15"], n: [2, 4], stop: ["edge", "poc"], trail: [0, 3], max: [1, 2], rr: [0, 2] }, mk: (b, c, o) => { const va = vaAll(b);
  return (k) => { if (k < 12 + o.n || b[k].hm < o.from || b[k].hm > "14:00") return null; const p = va[k], a = c.atr[k];
    let up = true, dn = true; for (let i = k - o.n + 1; i <= k; i++) { if (!(b[i].close > va[i].vah)) up = false; if (!(b[i].close < va[i].val)) dn = false; }
    const q = va[k - o.n];
    if (up && !(b[k - o.n].close > q.vah)) return { side: "CE", stop: o.stop === "poc" ? p.poc : p.vah - 0.5 * a };
    if (dn && !(b[k - o.n].close < q.val)) return { side: "PE", stop: o.stop === "poc" ? p.poc : p.val + 0.5 * a }; return null; }; } };
const grid = (g) => Object.entries(g).reduce((acc, [k, vs]) => acc.flatMap(a => vs.map(v => ({ ...a, [k]: v }))), [{}]);
// the two research years are fixed (16 Nov: a split by the middle moved with every new day and changed year 1); days after 9 Nov 2026 are forward days only
const Y1 = dates.slice(11).filter(d => d <= "2025-11-10"), Y2 = dates.filter(d => d > "2025-11-10" && d <= "2026-11-09");
const score = (ds, fam, o, side) => { let n = 0, won = 0, net = 0, up = 0, dn = 0, best = 0, ce = 0, pe = 0; for (const d of ds) { let day = 0, any = 0; for (const t of runDay(d, FAM[fam].mk, o)) { if (side && t.side !== side) continue; const p = t.pts - COST; n++; won += p > 0; net += p; day += p; any = 1; if (t.side === "CE") ce += p; else pe += p; } if (any) { if (day > 0) up++; else dn++; best = Math.max(best, day); } } return { n, won, net: Math.round(net), up, dn, best: Math.round(best), ce: Math.round(ce), pe: Math.round(pe) }; };
const res = []; let tried = 0;
for (const fam of Object.keys(FAM)) for (const o of grid(FAM[fam].grid)) { tried++; if (fam === "orb" || fam === "quiet") { if (o.rr === 0 && false) continue; }
  const a = score(Y1, fam, o); if (a.n < 40) continue; res.push({ fam, o, y1: a, y2: null }); }
console.log(`days ${dates.length}: year 1 ${Y1[0]}..${Y1[Y1.length - 1]} (${Y1.length}), year 2 ${Y2[0]}..${Y2[Y2.length - 1]} (${Y2.length}); variants tried ${tried}, with 40+ calls in year 1: ${res.length}`);
const good1 = res.filter(r => r.y1.net > 0 && r.y1.up >= r.y1.dn * 0.8 && r.y1.net - r.y1.best > 0);
console.log(`good in year 1 (net > 0 without the best day): ${good1.length}`);
for (const r of good1) r.y2 = score(Y2, r.fam, r.o);
const held = good1.filter(r => r.y2.net > 0 && r.y2.net - r.y2.best > 0);
console.log(`of those, also good in year 2: ${held.length}`);
const per = {}; for (const fam of Object.keys(FAM)) { const g = good1.filter(r => r.fam === fam), h = held.filter(r => r.fam === fam); per[fam] = `${h.length}/${g.length}`; } console.log("held / good-in-year-1 by family:", JSON.stringify(per));
const show = (r) => console.log(`${r.fam.padEnd(6)} ${JSON.stringify(r.o).padEnd(74)} Y1 n ${r.y1.n} won ${Math.round(100 * r.y1.won / r.y1.n)}% net ${r.y1.net} (${r.y1.up}/${r.y1.dn}) | Y2 n ${r.y2.n} won ${Math.round(100 * r.y2.won / r.y2.n)}% net ${r.y2.net} (${r.y2.up}/${r.y2.dn}) CE ${r.y2.ce} PE ${r.y2.pe} best ${r.y2.best}`);
console.log("\nTop of year 1 per family (picked by year 1's points per call) and what year 2 did:");
for (const fam of Object.keys(FAM)) good1.filter(r => r.fam === fam).sort((a, b) => b.y1.net / b.y1.n - a.y1.net / a.y1.n).slice(0, 3).forEach(show);
fs.writeFileSync(__dirname + "/lab.json", JSON.stringify({ tried, good1: good1.length, held: held.length, rows: good1 }));
// THE WATCH LIST (ultron/watchlist.json): each strategy fixed as found, scored only on the days after its found-on date
{ const W = __dirname + "/../ultron/watchlist.json"; if (fs.existsSync(W)) { const w = JSON.parse(fs.readFileSync(W)); console.log("\nWATCH LIST, new days only:");
  for (const x of w.list) { const ds = dates.filter(d => d > x.found), a = score(ds, x.fam, x.o); x.forward = { days: ds.length, to: ds[ds.length - 1] || null, ...a };
    x.ready = a.up + a.dn >= 10 && a.net > 0 && a.up > a.dn && a.net - a.best > 0; x.bad = a.up + a.dn >= 10 && (a.net < 0 || a.dn > a.up * 1.5);
    console.log(`${x.ready ? "READY" : x.bad ? "BAD  " : "     "} ${x.id.padEnd(14)} found ${x.found}: new days ${ds.length}, calls ${a.n}, won ${a.won}, net ${a.net}, days up/down ${a.up}/${a.dn}, CE ${a.ce} PE ${a.pe}`); }
  w.updated = new Date().toISOString(); fs.writeFileSync(W, JSON.stringify(w, null, 1)); } }
