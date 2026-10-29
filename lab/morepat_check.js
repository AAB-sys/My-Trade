// static/morepat.js against the owner's reference more_patterns_reference.py (the fixtures made from it by its own tests and run_day): the 113 test scans, the shared tests C-1 to C-10 by hand,
// the 4 real days of the document and 400 random days, signal for signal, every field. Usage: node check.js [fixtures.json]
const fs = require("fs"), path = require("path");
require(path.join(__dirname, "..", "static", "morepat.js")); const M = globalThis.MorePat;
const F = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, "morepat_fixtures.json")));
const C = (rows) => rows.map(r => M.candle(r[0], r[1], r[2], r[3]));
const near = (a, b) => a === b || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));
const sameSig = (j, p) => {  // the JS signal against the Python one: every field
  const bad = [];
  const eq = (name, a, b) => { if (!near(a, b)) bad.push(`${name}: js ${JSON.stringify(a)} py ${JSON.stringify(b)}`); };
  eq("rule", j.rule, p.rule); eq("key", j.key || null, p.key); eq("side", j.side, p.side); eq("k", j.signal_candle, p.k); eq("level", j.level, p.level); eq("target", j.target, p.target);
  eq("note", j.note, p.note); eq("status", j.status || null, p.status);
  eq("ident", JSON.stringify(j.ident), JSON.stringify(p.ident));
  if (j.points.length !== p.points.length) bad.push(`points: ${j.points.length} vs ${p.points.length}`);
  else j.points.forEach((pt, i) => { if (pt[0] !== p.points[i][0] || !near(pt[1], p.points[i][1]) || pt[2] !== p.points[i][2]) bad.push(`point ${i}: js ${JSON.stringify(pt)} py ${JSON.stringify(p.points[i])}`); });
  if (j.lines.length !== p.lines.length) bad.push(`lines: ${j.lines.length} vs ${p.lines.length}`);
  else j.lines.forEach((ln, i) => { const q = p.lines[i]; if (ln[0] !== q[0] || !near(ln[1], q[1]) || ln[2] !== q[2] || !near(ln[3], q[3]) || ln[4] !== q[4]) bad.push(`line ${i}: js ${JSON.stringify(ln)} py ${JSON.stringify(q)}`); });
  return bad;
};
let fails = 0, exact = 0, total = 0;
const report = (what, bad) => { if (bad.length) { fails++; console.log(`FAIL ${what}: ${bad.slice(0, 3).join(" | ")}`); } };
// 1. the test scans
const scan = (rule, cs, over, ctx, atr) => { const out = []; for (let k = 0; k < cs.length; k++) { const a = Array.isArray(atr) ? atr[k] : atr; if (a != null) for (const s of M.detect(rule, cs, k, a, over, ctx)) out.push([k, s]); } return out; };
F.cases.forEach((c, i) => {
  const got = scan(c.rule, C(c.candles), c.over, c.ctx, c.atr);
  const bad = [];
  if (got.length !== c.got.length) bad.push(`${got.length} signals vs ${c.got.length}: js ${JSON.stringify(got.map(g => [g[0], g[1].side]))} py ${JSON.stringify(c.got.map(g => [g[0], g[1].side]))}`);
  else got.forEach((g, n) => { if (g[0] !== c.got[n][0]) bad.push(`candle ${g[0]} vs ${c.got[n][0]}`); else bad.push(...sameSig(g[1], c.got[n][1])); });
  total++; if (!bad.length) exact++; report(`scan case ${i + 1} (${c.rule}, over ${JSON.stringify(c.over)}, ctx ${JSON.stringify(c.ctx)})`, bad);
});
console.log(`the reference's test scans: ${exact} of ${total} the same`);
// 2. the shared tests, by hand (C-1 to C-10)
{
  const ex = F.examples, cs = C(ex.flag.candles), bad = [];
  if (JSON.stringify(M.flip(M.flip(cs))) !== JSON.stringify(cs)) bad.push("C-1 flip twice");
  if (JSON.stringify(M.swingLows(M.flip(cs), cs.length - 1, 2)) !== JSON.stringify(M.swingHighs(cs, cs.length - 1, 2))) bad.push("C-2 swings of the flipped chart");
  if (!(M.lineValue([0, 10], [10, 20], 5) === 15 && Math.abs(M.lineValue([0, 10], [10, 20], 12) - 22) < 1e-9)) bad.push("C-3 line_value");
  const flat = Array.from({ length: 20 }, () => M.candle(100, 101, 99, 100)), a = M.atrBefore(flat);
  if (!(a.slice(0, 14).every(x => x == null) && a.slice(14).every(x => Math.abs(x - 2.0) < 1e-9))) bad.push("C-4 atr_before");
  let ok = true; for (const [rule, e] of Object.entries(ex)) { const c1 = C(e.candles); ok = ok && JSON.stringify(M.detect(rule, c1, e.k, F.atr_test, null, e.ctx).map(s => s.side)) === JSON.stringify(M.detect(rule, c1.slice(0, e.k + 1), e.k, F.atr_test, null, e.ctx).map(s => s.side)); }
  if (!ok) bad.push("C-5 no peeking");
  const st = (found, k) => M.markStatus(found, k).map(s => s.status);
  if (!(JSON.stringify(st([{ side: "CE" }, { side: "PE" }], 10)) === JSON.stringify(["both sides", "both sides"]) && JSON.stringify(st([{ side: "CE" }, { side: "CE" }], 10)) === JSON.stringify(["ok", "same side"]) && JSON.stringify(st([{ side: "CE" }], 70)) === JSON.stringify(["outside time"]) && JSON.stringify(st([{ side: "PE" }], 1)) === JSON.stringify(["outside time"]))) bad.push("C-6 statuses");
  const o = ex.orb, oc = C(o.candles), d1 = M.runDay(oc, oc.map(() => F.atr_test), o.ctx, ["orb"]), d2 = M.runDay(oc, oc.map(() => F.atr_test), o.ctx, ["orb"], null, 8);
  if (!(JSON.stringify(d1.map(s => [s.signal_candle, s.side, s.status])) === JSON.stringify([[6, "CE", "ok"]]) && JSON.stringify(d2.map(s => s.status)) === JSON.stringify(["outside time"]))) bad.push("C-7 run_day orb");
  const ch = ex.cup_handle, cc = C(ch.candles), d3 = M.runDay(cc, cc.map(() => F.atr_test), ch.ctx, ["cup_handle", "rounding_bottom"]);
  if (JSON.stringify(d3.filter(s => s.signal_candle === 46).map(s => [s.key, s.status])) !== JSON.stringify([["cup_handle", "ok"], ["rounding_bottom", "same side"]])) bad.push("C-8 run_day cup");
  const v = M.vwapSeries([M.candle(0, 3, 0, 3), M.candle(0, 6, 0, 6)]);
  if (!(Math.abs(v[0] - 2.0) < 1e-9 && Math.abs(v[1] - 3.0) < 1e-9)) bad.push("C-9 vwap_series");
  const f = M.detect("flag", M.flip(cs), ex.flag.k, F.atr_test)[0], labels = f.points.map(p => p[2]).concat(f.lines.map(l => l[4])).sort();
  if (!(JSON.stringify(labels) === JSON.stringify(["flag bottom", "flag top", "pole bottom", "pole start"]) && M.swapWords("closes above VWAP") === "closes below VWAP")) bad.push("C-10 labels");
  report("shared tests C-1 to C-10", bad); console.log(`the shared tests C-1 to C-10: ${bad.length ? "FAIL" : "all the same"}`);
}
// 3. the real days of the document, and 4. the random days: run_day, every signal, every field
const sameDay = (what, d) => {
  const got = M.runDay(C(d.candles), d.atr, d.ctx), bad = [];
  if (got.length !== d.signals.length) bad.push(`${got.length} signals vs ${d.signals.length}: js ${JSON.stringify(got.map(s => [s.signal_candle, s.key, s.side, s.status]))} py ${JSON.stringify(d.signals.map(s => [s.k, s.key, s.side, s.status]))}`);
  else got.forEach((s, n) => bad.push(...sameSig(s, d.signals[n])));
  total++; if (!bad.length) exact++; report(what, bad); return got;
};
let realSignals = 0; const t0 = Date.now();
F.days.forEach(d => { const got = sameDay(`real day ${d.day}`, d); realSignals += got.length; });
console.log(`the 4 real days: ${realSignals} signals, ${F.days.every((d, i) => true) ? "" : ""}checked`);
let fuzzSignals = 0; const t1 = Date.now();
F.fuzz.forEach((d, i) => { fuzzSignals += sameDay(`random day ${i + 1}`, d).length; });
const t2 = Date.now();
console.log(`the random days: ${F.fuzz.length} days, ${fuzzSignals} signals, ${((t2 - t1) / F.fuzz.length).toFixed(0)} ms a day`);
console.log(fails ? `${fails} DIFFERENCES` : `ALL THE SAME: ${exact} comparisons (test scans, the real days, ${F.fuzz.length} random days), the shared tests too`);
process.exit(fails ? 1 : 0);
