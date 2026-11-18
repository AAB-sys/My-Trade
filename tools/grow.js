// THE GROWING STUDY of the Volume Profile page (17 November, the owner: "make the study on every 5 day, 5 day plus 1 that means N+1").
// Every day with real futures volume: history/volume/<INDEX>_1min.csv (scratchpad/vol) plus the saved sessions with volume
// (scratchpad/sessall), no day twice. The page's own code (vpshape.js): the developing profile from the 1-minute candles weighted
// by volume. The same questions are asked of two years of NIFTY 50 5-minute candles with no volume (strat/all5m.csv, counted by time).
// node vpday/grow.js [lastDate]   -> text on stdout, vpday/grow.json
"use strict";
const RL = require(__dirname + "/levels.js").R;  // the chart's own levels (18 November: one set of numbers)
const fs = require("fs"), S = require("path").resolve(__dirname, ".."), V = require(S + "/swingtree/static/vpshape.js");
const hm = V.hm, LAST = process.argv[2] || "9999";
const tally = () => ({}), add = (T, k, v) => { const t = T[k] = T[k] || { n: 0 }; t[v] = (t[v] || 0) + 1; t.n++; };

function volDays(file, name) {  // { date: [ {time, open, high, low, close, vol} ] } of the days with real volume
  const days = {};
  for (const line of fs.readFileSync(`${S}/vol/${file}.csv`, "utf8").trim().split("\n").slice(1)) { const [d, t, o, h, l, c, v] = line.split(",");
    if (d > LAST) continue; (days[d] = days[d] || []).push({ time: Date.parse(`${d}T${t}:00+05:30`) / 1000, open: +o, high: +h, low: +l, close: +c, vol: v === "" ? 0 : +v }); }
  for (const f of fs.readdirSync(S + "/sessall").filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()) { const d = f.slice(0, 10); if (days[d] || d > LAST) continue;
    const ix = JSON.parse(fs.readFileSync(`${S}/sessall/${f}`)).indices[name]; if (!ix || !ix.volume || !ix.volume["1m"] || !ix.volume["1m"].length) continue;
    const W = new Map(ix.volume["1m"]); days[d] = ix.candles["1m"].map(b => ({ ...b, vol: W.get(b.time) || 0 })); }
  const ks = Object.keys(days).sort(), tot = ks.map(k => days[k].reduce((a, b) => a + b.vol, 0)), rec = tot.slice(-15).sort((a, b) => a - b), med = rec[Math.floor(rec.length / 2)];
  const out = {}; ks.forEach((k, i) => { if (tot[i] >= 0.2 * med && days[k].length >= 350) out[k] = days[k]; }); return out;
}
function priceDays() {  // two years of NIFTY 50, 5-minute candles, no volume
  const days = {};
  for (const [d, t, o, h, l, c] of fs.readFileSync(S + "/strat/all5m.csv", "utf8").trim().split("\n").slice(1).map(x => x.split(","))) (days[d] = days[d] || []).push({ time: Date.parse(`${d}T${t.slice(0, 5)}:00+05:30`) / 1000, open: +o, high: +h, low: +l, close: +c });
  for (const d of Object.keys(days)) if (days[d].length < 70) delete days[d]; return days;
}
const place = (c, p) => c > p.vah ? "above VAH" : c < p.val ? "below VAL" : c > p.poc ? "POC-VAH" : "VAL-POC";
// which comes first in the bars after: a move of D up or D down from `from`
function firstMove(bars, from, D) { for (const m of bars) { const up = m.high - from >= D, dn = from - m.low >= D; if (up && dn) return "both"; if (up) return "up"; if (dn) return "down"; } return "none"; }

function study(days, useVol, T, todayKey) {
  const ks = Object.keys(days).sort(); let prevP = null;
  for (const d of ks) {
    const fine = days[d], W = useVol ? new Map(fine.map(m => [m.time, m.vol])) : null, b5 = useVol ? V.five(fine) : fine, D0 = 0.001;
    const after = (k, secs) => fine.filter(m => m.time >= b5[k].time + 300 && m.time < b5[k].time + 300 + secs);
    const marks = d === todayKey ? ["all", "today"] : ["all"], A = (k, v) => marks.forEach(m => add(T, m + " | " + k, v));
    let pBefore = null; const touched = {};
    for (let k = 1; k < b5.length - 1; k++) {
      const t = hm(b5[k].time), c = b5[k].close, pc = b5[k - 1].close, D = D0 * c;
      // (d) yesterday's levels: the first touch of the day, coming from one side
      if (prevP && t <= "14:45") for (const lv of ["vah", "poc", "val"]) { const L = prevP[lv]; if (touched[lv]) continue;
        if (!(b5[k].low <= L && b5[k].high >= L)) continue; touched[lv] = 1; if (pc === L) continue;
        const from = pc < L ? "from below" : "from above", mv = firstMove(after(k, 1800), L, D), res = mv === "none" || mv === "both" ? mv : (mv === "up") === (pc < L) ? "went through" : "turned";
        A("d yesterday's level, first touch", res); A("d yesterday's " + lv.toUpperCase() + " " + from, res); }
      if (k < 6) { continue; }
      const p = RL(fine.filter(m => m.time < b5[k].time + 300), W);  // the day's profile through candle k
      if (pBefore && t >= "10:00" && t <= "14:45") {
        const q = pBefore, nx = after(k, 1800);
        for (const [side, L, sgn] of [["VAH", q.vah, 1], ["VAL", q.val, -1]]) {
          const fromInside = sgn > 0 ? pc < L && b5[k].high >= L : pc > L && b5[k].low <= L; if (!fromInside) continue;
          const back = sgn > 0 ? c < L : c > L, mv = firstMove(nx, L, D), res = mv === "none" || mv === "both" ? mv : (mv === "up") === (sgn > 0) ? "went on" : "came back";
          if (back) {  // (c) a wick through the edge that closed back inside
            A("c wick through the edge, closed back inside", res);
            const toPoc = (bars) => bars.some(m => sgn > 0 ? m.low <= q.poc : m.high >= q.poc);
            A("c after such a wick: reached the POC in 30 min", toPoc(nx) ? "yes" : "no"); A("c after such a wick: reached the POC in 60 min", toPoc(after(k, 3600)) ? "yes" : "no");
          } else {     // (f) a close beyond the edge: on the busy side or away from it
            A("f close beyond the edge", res);
            const busy = q.shape === "P" ? 1 : q.shape === "B" ? -1 : 0;
            A("f close beyond the edge, " + (busy === 0 ? "shape D or Double" : busy === sgn ? "ON the busy side (P up, B down)" : "AWAY from the busy side (P down, B up)"), res);
          }
        }
        // (e) the POC: a close across it
        if ((pc - q.poc) * (c - q.poc) < 0) { const up = c > q.poc, mv = firstMove(nx, c, D); A("e close across the POC", mv === "none" || mv === "both" ? mv : (mv === "up") === up ? "went on" : "came back"); }
      }
      // (a) by shape and by place: which level first in 30 minutes
      if (t >= "10:15" && t <= "14:45") { const w = place(c, p); let first = "none";
        for (const m of after(k, 1800)) { const hit = []; if (m.low <= p.poc && m.high >= p.poc) hit.push("POC"); if (m.low <= p.vah && m.high >= p.vah) hit.push("VAH"); if (m.low <= p.val && m.high >= p.val) hit.push("VAL"); if (hit.length) { first = hit.length > 1 ? "two" : hit[0]; break; } }
        A("a place " + w, first); A("a shape " + p.shape + " | " + w, first); }
      pBefore = p;
    }
    // (b) the noon rule
    const am = fine.filter(m => hm(m.time) < "12:00");
    if (am.length) { const pn = RL(am, W), c12 = am[am.length - 1].close, cl = fine[fine.length - 1].close, w = place(c12, pn), out = w === "above VAH" || w === "below VAL";
      const dir = cl > c12 ? "up" : cl < c12 ? "down" : "flat", wc = place(cl, pn);
      A("b noon " + (out ? "OUTSIDE the value area" : "inside the value area") + ": the close", out ? (wc === w ? "outside, same side" : wc === "above VAH" || wc === "below VAL" ? "outside, other side" : "back inside") : (wc === "above VAH" || wc === "below VAL" ? "outside" : "inside"));
      if (out) A("b noon outside: the afternoon", (dir === "up") === (w === "above VAH") ? "went further" : "came back");
      A("b noon shape " + pn.shape + ": the afternoon", dir); }
    prevP = RL(fine, W);
  }
  return ks;
}

const R = { vol: tally(), price: tally(), days: {} };
for (const [name, file] of [["NIFTY 50", "NIFTY50"], ["NIFTY BANK", "NIFTYBANK"], ["SENSEX", "SENSEX"]]) { const days = volDays(file, name), ks = Object.keys(days).sort(); R.days[name] = ks; study(days, true, R.vol, ks[ks.length - 1]); }
const pk = study(priceDays(), false, R.price, null); R.days["two years (price only)"] = [pk[0], pk[pk.length - 1], pk.length];
fs.writeFileSync(__dirname + "/grow.json", JSON.stringify(R));
const N = R.days["NIFTY 50"].length;
console.log(`THE GROWING STUDY, N = ${N} days with real volume (${R.days["NIFTY 50"][0]} to ${R.days["NIFTY 50"][N - 1]}), three indices; NIFTY BANK ${R.days["NIFTY BANK"].length} days, SENSEX ${R.days["SENSEX"].length} days`);
console.log(`compared with ${pk.length} days of NIFTY 50 5-minute candles without volume (${pk[0]} to ${pk[pk.length - 1]})\n`);
const line = (t) => Object.keys(t).filter(k => k !== "n").sort((a, b) => t[b] - t[a]).map(k => `${k} ${Math.round(100 * t[k] / t.n)}%`).join(", ");
const keys = [...new Set(Object.keys(R.vol).filter(k => k.startsWith("all | ")).map(k => k.slice(6)))].sort();
for (const k of keys) { const v = R.vol["all | " + k], p = R.price["all | " + k], td = R.vol["today | " + k];
  console.log(k); console.log(`   volume days: n ${v.n}: ${line(v)}`); if (p) console.log(`   two years:   n ${p.n}: ${line(p)}`); if (td) console.log(`   today:       n ${td.n}: ${line(td)}`); }
