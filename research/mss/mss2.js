// MSS-1 (report "MSS strategy for AAA V1", 26 Nov 2026): the pre-declared test. node mss1.js [year2 N k T]
// Rules exactly as the report's table; choices the table left open are marked CHOICE and were fixed before any result was seen.
const fs = require("fs"), S = "/tmp/claude-0/-home-user-Delta/3a78b64f-a132-5d21-ae3b-acf430fd972c/scratchpad";
const rows = fs.readFileSync(S + "/strat/all5m.csv", "utf8").trim().split("\n").slice(1).map(l => l.split(","));
const days = {}; for (const [d, t, o, h, l, c] of rows) (days[d] = days[d] || []).push({ t, o: +o, h: +h, l: +l, c: +c });
const keys = Object.keys(days).sort();
const trOf = (cs) => cs.map((c, k) => k ? Math.max(c.h - c.l, Math.abs(c.h - cs[k - 1].c), Math.abs(c.l - cs[k - 1].c)) : c.h - c.l);
const mins = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
function runDay(cs, prev, { N, k, T, noDisp = false, v2 = false }, cost) {
  const n = cs.length, tr = trOf(cs), seed = trOf(prev).slice(-14);
  const atr = (j) => { const a = j + 1 >= 14 ? tr.slice(j - 13, j + 1) : seed.concat(tr.slice(0, j + 1)).slice(-14); return a.reduce((x, y) => x + y, 0) / a.length; };  // the page's ATR(14), seeded from yesterday, read with candle j in it
  const pd = { hi: Math.max(...prev.map(c => c.h)), lo: Math.min(...prev.map(c => c.l)) };
  const swing = (i, side) => { if (i < N || i + N >= n) return false; for (let d = 1; d <= N; d++) { if (side > 0 ? !(cs[i].h > cs[i - d].h && cs[i].h > cs[i + d].h) : !(cs[i].l < cs[i - d].l && cs[i].l < cs[i + d].l)) return false; } return true; };
  const DAYEXIT = cs.findIndex(c => c.t === "15:05"); if (DAYEXIT < 0) return [];
  const trades = [], used = { 1: new Set(), "-1": new Set() }; let openUntil = -1, signals = 0;
  const pend = { 1: null, "-1": null };  // side 1 = bullish (levels below), -1 = bearish
  for (let j = 1; j < n && signals < 2; j++) {
    for (const side of [1, -1]) {
      const c = cs[j], below = side > 0, px = (b) => below ? b.l : b.h, beyond = (a, L) => below ? a < L : a > L, back = (a, L) => below ? a > L : a < L;
      let p = pend[side];
      if (!p) {  // step 1: a pierce of a level, the candle before closed on the first side
        const lv = [];
        lv.push(["PD", below ? pd.lo : pd.hi]);
        if (j >= 3) lv.push(["OR", below ? Math.min(cs[0].l, cs[1].l, cs[2].l) : Math.max(cs[0].h, cs[1].h, cs[2].h)]);
        { let m = 0; for (let q = 1; q < j; q++) if (below ? cs[q].l < cs[m].l : cs[q].h > cs[m].h) m = q; if (j - m >= 6) lv.push(["AGED", px(cs[m])]); }
        const hit = lv.filter(([name, L]) => !used[side].has(name) && beyond(px(c), L) && back(cs[j - 1].c, L));
        if (hit.length) { hit.forEach(([name]) => used[side].add(name)); p = pend[side] = { L: hit[0][1], name: hit[0][0], P: j, C: null, X: px(c), xi: j }; }  // CHOICE: every level pierced by this candle is used; the setup is named after the first in the order PD, OR, AGED
        else continue;
      }
      if (p.C == null) {  // step 2: the reclaim within P, P+1, P+2; step 3: X
        if (j > p.P && beyond(px(c), p.X)) { p.X = px(c); p.xi = j; }
        if (back(c.c, p.L)) p.C = j; else { if (j >= p.P + 2) pend[side] = null; continue; }
      } else if (beyond(px(c), p.X)) { pend[side] = null; continue; }  // a candle after C trades beyond X before the break: dead
      const W = v2 ? 12 : 6; if (j > p.C + W) { pend[side] = null; continue; }
      // step 4: R = the most recent CONFIRMED swing (its candle before the candle of X), as known at this candle's close. CHOICE: no R at this candle -> this candle cannot be B
      let R = null; for (let i = (v2 ? j - N : p.xi - 1); i >= N; i--) if (i + N <= j && swing(i, side > 0 ? 1 : -1)) { R = below ? cs[i].h : cs[i].l; break; }
      if (R == null) { if (j === p.C + W) pend[side] = null; continue; }
      const past = below ? c.c > R && c.c > p.L : c.c < R && c.c < p.L;
      if (!past) { if (j === p.C + W) pend[side] = null; continue; }
      pend[side] = null;  // B = j: the first close past R and L; one chance only
      const a = atr(j), range = c.h - c.l, body = Math.abs(c.c - c.o), dir = below ? c.c > c.o : c.c < c.o;
      if (!noDisp && !(dir && range >= k * a && body >= 0.6 * range)) continue;
      const end = mins(c.t) + 5; if (end < 9 * 60 + 45 || end > 14 * 60 + 30) continue;
      if (j <= openUntil || j + 1 >= n || signals >= 2) continue;
      const e = j + 1, entry = cs[e].o, stop = below ? p.X - 0.25 * a : p.X + 0.25 * a, risk = below ? entry - stop : stop - entry;
      if (risk < 0.75 * a || risk > 2.5 * a) continue;
      signals++;
      const target = below ? entry + T * risk : entry - T * risk, last = Math.min(e + 11, DAYEXIT); let exit = null, how = null, xj = last;
      for (let q = e; q <= last; q++) { const b = cs[q];
        if (q > e && (below ? b.o <= stop : b.o >= stop)) { exit = b.o; how = "stop gap"; xj = q; break; }
        if (below ? b.l <= stop : b.h >= stop) { exit = stop; how = "stop"; xj = q; break; }
        if (below ? b.h >= target : b.l <= target) { exit = target; how = "target"; xj = q; break; } }
      if (exit == null) { exit = cs[last].c; how = last === DAYEXIT && e + 11 > DAYEXIT ? "day end" : "time"; }
      openUntil = xj;
      trades.push({ side, level: p.name, at: cs[e].t, risk, atr: a, pts: (below ? exit - entry : entry - exit) - cost, how });
    }
  }
  return trades;
}
function run(from, to, v, cost = 4) { const out = [];
  for (let i = 1; i < keys.length; i++) { const d = keys[i]; if (d < from || d > to) continue; const cs = days[d], prev = days[keys[i - 1]]; if (cs.length !== 75 || prev.length < 60) continue;
    for (const t of runDay(cs, prev, v, cost)) out.push({ d, ...t }); }
  return out; }
const st = (a) => { const n = a.length, s = a.reduce((x, t) => x + t.pts, 0), w = a.filter(t => t.pts > 0), g = w.reduce((x, t) => x + t.pts, 0), l = -a.filter(t => t.pts <= 0).reduce((x, t) => x + t.pts, 0); return { n, avg: n ? +(s / n).toFixed(2) : 0, total: Math.round(s), win: n ? Math.round(100 * w.length / n) : 0, pf: l ? +(g / l).toFixed(2) : null }; };
module.exports = { run, st, keys, days, runDay };
if (require.main === module) {
  const Y1 = ["2024-11-11", "2025-11-10"], Y2 = ["2025-11-11", "2026-11-25"];
  console.log("MSS-2, YEAR 1 only, 4 points cost a trade");
  const grid = []; for (const N of [2, 3]) for (const k of [1.0, 1.5]) for (const T of [1.5, 2.0]) { const tr = run(Y1[0], Y1[1], { N, k, T, v2: true }); grid.push({ N, k, T, ...st(tr), CE: st(tr.filter(t => t.side > 0)).total, PE: st(tr.filter(t => t.side < 0)).total, how: tr.reduce((m, t) => (m[t.how] = (m[t.how] || 0) + 1, m), {}) }); }
  grid.forEach(g => console.log(JSON.stringify(g)));
  const ok = (g) => g.n >= 60 && g.avg > 0, nb = (g) => grid.filter(h => (h.N !== g.N) + (h.k !== g.k) + (h.T !== g.T) === 1);
  const cand = grid.filter(ok).sort((a, b) => b.avg - a.avg).filter(g => nb(g).every(h => h.avg > 0));
  console.log("with 60+ trades and a positive average:", grid.filter(ok).length, "| of them with all 3 neighbours positive:", cand.length);
  if (!cand.length) { console.log("NO VARIANT PASSES YEAR 1: the test stops here; year 2 stays closed."); process.exit(0); }
  const c = cand[0], v = { N: c.N, k: c.k, T: c.T, v2: true }; console.log("CHOSEN on year 1:", JSON.stringify(v), "-> YEAR 2, once:");
  const t4 = run(Y2[0], Y2[1], v, 4), s4 = st(t4), s5 = st(run(Y2[0], Y2[1], v, 5)), s3 = st(run(Y2[0], Y2[1], v, 3));
  console.log("year 2 at 4 points:", JSON.stringify(s4), "| at 3:", s3.avg, "| at 5:", s5.avg, "| CE", st(t4.filter(t => t.side > 0)).total, "PE", st(t4.filter(t => t.side < 0)).total);
  const sorted = t4.map(t => t.pts).sort((a, b) => b - a), cut = Math.ceil(sorted.length * 0.05), rest = sorted.slice(cut).reduce((a, b) => a + b, 0);
  // the luck test: the same number of entries a side at random candles in the window, the same risk sizes, targets and exits
  const dk = keys.filter((d, i) => i > 0 && d >= Y2[0] && d <= Y2[1] && days[d].length === 75); let seedR = 12345; const rnd = () => (seedR = (seedR * 1103515245 + 12345) % 2147483648) / 2147483648;
  const sim = (side, risk, T) => { const d = dk[Math.floor(rnd() * dk.length)], cs = days[d], lo = cs.findIndex(x => x.t === "09:40"), hi = cs.findIndex(x => x.t === "14:25"), j = lo + Math.floor(rnd() * (hi - lo + 1)), e = j + 1, DX = cs.findIndex(x => x.t === "15:05"), below = side > 0, entry = cs[e].o, stop = below ? entry - risk : entry + risk, target = below ? entry + T * risk : entry - T * risk, last = Math.min(e + 11, DX); let exit = null;
    for (let q = e; q <= last; q++) { const b = cs[q]; if (q > e && (below ? b.o <= stop : b.o >= stop)) { exit = b.o; break; } if (below ? b.l <= stop : b.h >= stop) { exit = stop; break; } if (below ? b.h >= target : b.l <= target) { exit = target; break; } }
    if (exit == null) exit = cs[last].c; return (below ? exit - entry : entry - exit) - 4; };
  let beat = 0; const real = s4.n ? t4.reduce((a, t) => a + t.pts, 0) / s4.n : 0; for (let r = 0; r < 500; r++) { let s = 0; for (const t of t4) s += sim(t.side, t.risk, v.T); if (real > s / Math.max(1, t4.length)) beat++; }
  const gates = { "1 trades >= 60": s4.n >= 60, "2 avg >= 3 at 4 pts and > 0 at 5": s4.avg >= 3 && s5.avg > 0, "3 profit factor >= 1.2": s4.pf != null && s4.pf >= 1.2, "4 positive without best 5%": rest > 0, "5 beats 475 of 500 random runs": beat >= 475 };
  console.log("total without the best", cut, "trades:", Math.round(rest), "| random runs beaten:", beat, "of 500"); console.log(JSON.stringify(gates)); console.log(Object.values(gates).every(Boolean) ? "PASS: watch on paper" : "FAIL: a study, not an order");
}
