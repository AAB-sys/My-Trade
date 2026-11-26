// MSS-3 (declared 26 Nov in Delta reports/MSS strategy 3 for AAA V1.md). NIFTY 50 5-minute, strat/all5m.csv. 8 points a trade.
// Choices fixed before the run and not in the declared text: swings are read on the continuous candles (yesterday's swings count this morning);
// VWAP = running mean of (H+L+C)/3 of the day (the index has no volume); yesterday's POC/VAH/VAL = profile by time, 30 rows, 70%;
// stop = lowest low (highest high) from the last opposite swing to the break candle; stop before target inside one candle.
"use strict";
const fs = require("fs"), COST = 8, by = {};
for (const [d, t, o, h, l, c] of fs.readFileSync(__dirname + "/../strat/all5m.csv", "utf8").trim().split("\n").slice(1).map(x => x.split(","))) (by[d] = by[d] || []).push({ d, hm: t.slice(0, 5), open: +o, high: +h, low: +l, close: +c });
const dates = Object.keys(by).sort().filter(d => by[d].length >= 70);
function va(b) { let lo = 1e9, hi = -1e9; for (const x of b) { lo = Math.min(lo, x.low); hi = Math.max(hi, x.high); } const n = 30, st = (hi - lo) / n, v = Array(n).fill(0), at = p => Math.max(0, Math.min(n - 1, Math.floor((p - lo) / st)));
  for (const x of b) for (let r = at(x.low); r <= at(x.high); r++) v[r]++; let p = v.indexOf(Math.max(...v)), up = p, dn = p, acc = v[p]; const tot = v.reduce((a, x) => a + x, 0);
  while (acc < tot * 0.7 && (up < n - 1 || dn > 0)) { const u = up < n - 1 ? v[up + 1] : -1, w = dn > 0 ? v[dn - 1] : -1; if (u >= w) { up++; acc += u; } else { dn--; acc += w; } } return { poc: lo + (p + .5) * st, vah: lo + (up + 1) * st, val: lo + dn * st }; }
// continuous series with day context
const A = []; const dayCtx = {}; { let e9 = null, e21 = null;
  dates.forEach((d, i) => { const b = by[d], p = i ? by[dates[i - 1]] : null; const c = { trend: e9 == null || e21 == null ? 0 : e9 > e21 ? 1 : -1 };
    if (p) { c.pdh = Math.max(...p.map(x => x.high)); c.pdl = Math.min(...p.map(x => x.low)); c.pdm = (c.pdh + c.pdl) / 2; c.pdc = p[p.length - 1].close; Object.assign(c, va(p)); }
    c.orh = Math.max(...b.slice(0, 3).map(x => x.high)); c.orl = Math.min(...b.slice(0, 3).map(x => x.low)); dayCtx[d] = c;
    let s = 0, hi = -1e9, lo = 1e9; b.forEach((x, k) => { s += (x.high + x.low + x.close) / 3; x.vwap = s / (k + 1); x.dhiB = hi; x.dloB = lo; hi = Math.max(hi, x.high); lo = Math.min(lo, x.low); x.k = k; A.push(x); });
    const cl = b[b.length - 1].close; e9 = e9 == null ? cl : e9 + (cl - e9) * 2 / 10; e21 = e21 == null ? cl : e21 + (cl - e21) * 2 / 22; }); }
{ let atr = null, pc = null; for (const x of A) { x.atrB = atr; const tr = pc == null ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); atr = atr == null ? tr : (atr * 13 + tr) / 14; pc = x.close; } }
const N = 3, isSH = i => { for (let j = i - N; j <= i + N; j++) if (j !== i && (j < 0 || j >= A.length || A[j].high >= A[i].high)) return false; return true; }, isSL = i => { for (let j = i - N; j <= i + N; j++) if (j !== i && (j < 0 || j >= A.length || A[j].low <= A[i].low)) return false; return true; };
const SH = A.map((_, i) => isSH(i)), SL = A.map((_, i) => isSL(i));
function levelsOf(x) { const c = dayCtx[x.d], L = []; for (const k of ["pdh", "pdl", "pdm", "pdc", "poc", "vah", "val"]) if (c[k] != null) L.push(c[k]); if (x.hm >= "09:30") L.push(c.orh, c.orl); return L; }
function run(V, ds) { const set = new Set(ds), T = []; let highs = [], lows = [], usedH = -1, usedL = -1, open = null, pend = null;
  for (let i = 0; i < A.length; i++) { const x = A[i];
    if (i - N >= 0) { if (SH[i - N]) highs.push(i - N); if (SL[i - N]) lows.push(i - N); }   // known at the close of candle i
    // manage the open trade (from the candle after entry; limit entries are managed from the entry candle's close onward)
    if (open && i > open.i) { let done = null; if (x.hm >= "15:15" || x.d !== open.d) done = x.d !== open.d ? A[i - 1].close : x.open;
      else if (open.dir > 0 ? x.low <= open.stop : x.high >= open.stop) done = open.dir > 0 ? Math.min(open.stop, x.open) : Math.max(open.stop, x.open);
      else if (open.dir > 0 ? x.high >= open.target : x.low <= open.target) done = open.target;
      if (done != null) { open.pts = open.dir * (done - open.entry) - COST; T.push(open); open = null; } }
    if (pend && !open) { if (x.d !== pend.d || i > pend.until || x.hm > "14:30") pend = null; else if (i > pend.from - 1 && (pend.dir > 0 ? x.low <= pend.px : x.high >= pend.px)) { const e = pend.dir > 0 ? Math.min(pend.px, x.open) : Math.max(pend.px, x.open); if (pend.dir * (e - pend.stop) > 3 && (pend.dir > 0 ? x.low > pend.stop : x.high < pend.stop)) enter(pend.dir, e, pend.stop, i, x); pend = null; } }
    if (!set.has(x.d) || x.hm < "09:30" || x.hm > "14:30" || highs.length < 2 || lows.length < 2) continue;
    const h1 = highs[highs.length - 1], h0 = highs[highs.length - 2], l1 = lows[lows.length - 1], l0 = lows[lows.length - 2];
    for (const dir of [1, -1]) { const down = A[h1].high < A[h0].high && A[l1].low < A[l0].low, upS = A[h1].high > A[h0].high && A[l1].low > A[l0].low;
      const lvl = dir > 0 ? A[h1].high : A[l1].low, sw = dir > 0 ? h1 : l1; if (dir > 0 ? !down || usedH === h1 : !upS || usedL === l1) continue;
      const brk = V.wick ? (dir > 0 ? x.high > lvl : x.low < lvl) : (dir > 0 ? x.close > lvl : x.close < lvl); if (!brk) continue;
      // already broken earlier by a candle after the swing was known? then it is consumed
      if (dir > 0) usedH = h1; else usedL = l1;
      let legI = i, ext = dir > 0 ? x.low : x.high; for (let j = i; j >= sw; j--) if (dir > 0 ? A[j].low <= ext : A[j].high >= ext) { ext = dir > 0 ? A[j].low : A[j].high; legI = j; }
      const c = dayCtx[x.d];
      if (V.strong && !(x.atrB && Math.abs(x.close - x.open) >= x.atrB)) continue;
      if (V.trend && c.trend !== dir) continue;
      if (V.vwap && !(dir > 0 ? x.close > x.vwap : x.close < x.vwap)) continue;
      if (V.sweep) { let ok = false; for (let j = Math.max(0, i - 12); j < i && !ok; j++) { const y = A[j]; if (y.d !== x.d) continue; const L = levelsOf(y).concat(y.k > 0 ? [dir > 0 ? y.dloB : y.dhiB] : []); for (const p of L) if (dir > 0 ? y.low < p && y.close > p : y.high > p && y.close < p) { ok = true; break; } } if (!ok) continue; }
      if (open || pend) continue;
      if (V.fvg) { let g = null; for (let j = Math.max(legI + 2, 2); j <= i; j++) { if (dir > 0 && A[j - 2].high < A[j].low) g = A[j].low; if (dir < 0 && A[j - 2].low > A[j].high) g = A[j].high; } if (g == null) continue; pend = { dir, px: g, stop: ext, from: i + 1, until: i + 6, d: x.d }; continue; }
      if (V.half) { const top = dir > 0 ? x.high : x.low; pend = { dir, px: (ext + top) / 2, stop: ext, from: i + 1, until: i + 6, d: x.d }; continue; }
      enter(dir, x.close, ext, i, x); }
  }
  function enter(dir, e, stop, i, x) { const risk = dir * (e - stop); if (!(risk > 3) || risk > 60) return; const c = dayCtx[x.d], L = levelsOf(x).concat([x.vwap, dir > 0 ? Math.max(x.dhiB, x.high) : Math.min(x.dloB, x.low)]).filter(p => dir * (p - e) >= risk).sort((a, b) => dir * (a - b));
    open = { d: x.d, hm: x.hm, i, dir, entry: e, stop, target: L.length ? L[0] : e + dir * 1.5 * risk, risk }; }
  return T; }
const st = T => { const n = T.length, net = T.reduce((a, t) => a + t.pts, 0), won = T.filter(t => t.pts > 0).length, ce = T.filter(t => t.dir > 0), pe = T.filter(t => t.dir < 0); const days = {}; for (const t of T) days[t.d] = (days[t.d] || 0) + t.pts; const dv = Object.values(days);
  return { n, won: n ? Math.round(100 * won / n) : 0, net: Math.round(net), per: n ? +(net / n).toFixed(1) : 0, ce: `${ce.length}/${Math.round(ce.reduce((a, t) => a + t.pts, 0))}`, pe: `${pe.length}/${Math.round(pe.reduce((a, t) => a + t.pts, 0))}`, up: dv.filter(v => v > 0).length, dn: dv.filter(v => v <= 0).length, best: Math.round(Math.max(0, ...dv)) }; };
const VERS = { A: {}, B: { strong: 1 }, C: { fvg: 1 }, D: { sweep: 1 }, E: { trend: 1 }, F: { vwap: 1 }, G: { wick: 1 }, H: { half: 1 } };
const Y1 = dates.slice(22).filter(d => d <= "2025-11-10"), Y2 = dates.filter(d => d > "2025-11-10");
console.log(`year 1 ${Y1[0]}..${Y1[Y1.length - 1]} (${Y1.length} days); year 2 ${Y2[0]}..${Y2[Y2.length - 1]} (${Y2.length} days), opened only for versions that pass year 1`);
const out = {}; for (const [k, V] of Object.entries(VERS)) { const a = st(run(V, Y1)), pass = a.n >= 40 && a.net > 0; out[k] = { y1: a, pass }; console.log(k, "Y1", JSON.stringify(a), pass ? "PASS" : "fail"); if (pass || process.argv[2] === "open2") { const b = st(run(V, Y2)); out[k].y2 = b; console.log("   Y2", JSON.stringify(b)); } }
fs.writeFileSync(__dirname + "/mss3.json", JSON.stringify(out, null, 1));
if (process.argv[2] === "dbg") { const T = run({}, Y1); const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  console.log("avg risk", avg(T.map(t => t.risk)), "avg reward aimed", avg(T.map(t => Math.abs(t.target - t.entry))), "gross per trade", avg(T.map(t => t.pts + COST)), "per month", (T.length / 11).toFixed(1));
  for (const t of T.slice(60, 66)) console.log(t.d, t.hm, t.dir > 0 ? "BUY" : "SELL", "in", t.entry, "stop", t.stop.toFixed(1), "target", t.target.toFixed(1), "pts", t.pts.toFixed(1)); }
