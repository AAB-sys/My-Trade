// FVG, question of 20 Nov (the owner): "at what condition it comes back?" Same-day return to a 3-candle gap on NIFTY 50 5-minute candles.
// A gap: high of candle 1 < low of candle 3 (up), or low of candle 1 > high of candle 3 (down). Known at candle 3's close.
// touched: a later candle of the same day trades into the gap; filled: a later candle trades through its far side.
"use strict";
const fs = require("fs"), F = process.argv[2];
const byDay = {}; for (const [dd, t, o, h, l, c] of fs.readFileSync(F, "utf8").trim().split("\n").slice(1).map(l => l.split(","))) (byDay[dd] = byDay[dd] || []).push({ hm: t.slice(0, 5), open: +o, high: +h, low: +l, close: +c });
const dates = Object.keys(byDay).sort().filter(d => byDay[d].length >= 70); let atr = null, prevC = null; const G = [];
for (const d of dates) { const b = byDay[d], A = []; for (const x of b) { const tr = prevC == null ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - prevC), Math.abs(x.low - prevC)); atr = atr == null ? tr : (atr * 13 + tr) / 14; prevC = x.close; A.push(atr); }
  const dO = b[0].open, dC = b[b.length - 1].close, dH = Math.max(...b.map(x => x.high)), dL = Math.min(...b.map(x => x.low)), eff = Math.abs(dC - dO) / (dH - dL), dayKind = eff >= 0.6 ? "trend day" : eff <= 0.3 ? "sideways day" : "in between";
  for (let i = 2; i < b.length - 1; i++) { const a = b[i - 2], c = b[i]; let up = null, lo, hi; if (a.high < c.low) { up = 1; lo = a.high; hi = c.low; } else if (a.low > c.high) { up = -1; lo = c.high; hi = a.low; } else continue;
    const size = hi - lo, rel = size / A[i]; let touch = -1, fill = -1; for (let k = i + 1; k < b.length; k++) { if (touch < 0 && (up > 0 ? b[k].low <= hi : b[k].high >= lo)) touch = k - i; if (up > 0 ? b[k].low <= lo : b[k].high >= hi) { fill = k - i; break; } }
    let hiSo = -Infinity, loSo = Infinity; for (let k = 0; k <= i; k++) { hiSo = Math.max(hiSo, b[k].high); loSo = Math.min(loSo, b[k].low); }
    const newExt = up > 0 ? b[i].high >= hiSo || b[i - 1].high >= hiSo : b[i].low <= loSo || b[i - 1].low <= loSo;   // the push made a new day high (up) / low (down)
    const withDay = Math.sign(dC - dO) === up; // hindsight: the gap points the way the day ended
    // after the first touch: bounce (moves back out by 1 gap size or 0.5 ATR, whichever larger, before filling) -- only for the record
    G.push({ d, hm: b[i].hm, up, size, rel, touch, fill, left: b.length - 1 - i, dayKind, newExt, withDay, sz: rel < 0.25 ? "1 tiny (< 0.25 ATR)" : rel < 0.5 ? "2 small (0.25-0.5 ATR)" : rel < 1 ? "3 medium (0.5-1 ATR)" : "4 big (> 1 ATR)", when: b[i].hm < "10:30" ? "1 before 10:30" : b[i].hm < "12:30" ? "2 10:30-12:30" : b[i].hm < "14:00" ? "3 12:30-14:00" : "4 after 14:00" }); } }
const pct = (n, t) => t ? Math.round(100 * n / t) + "%" : "-";
const line = (name, g) => { const n = g.length, t = g.filter(x => x.touch >= 0), f = g.filter(x => x.fill >= 0), q = g.filter(x => x.touch >= 0 && x.touch <= 6), md = t.map(x => x.touch).sort((a, b) => a - b)[Math.floor(t.length / 2)];
  console.log(`${name.padEnd(34)} gaps ${String(n).padStart(5)} | touched same day ${pct(t.length, n).padStart(4)} | filled same day ${pct(f.length, n).padStart(4)} | touched within 30 min ${pct(q.length, n).padStart(4)} | never back ${pct(n - t.length, n).padStart(4)} | half of the returns within ${md * 5} min`); };
const by = (title, key, g = G) => { console.log("\n" + title); const ks = [...new Set(g.map(key))].sort(); for (const k of ks) line(String(k), g.filter(x => key(x) === k)); };
console.log(`days ${dates.length} (${dates[0]} to ${dates[dates.length - 1]}), gaps ${G.length}, ${(G.length / dates.length).toFixed(1)} a day; up ${G.filter(x => x.up > 0).length}, down ${G.filter(x => x.up < 0).length}`);
line("ALL", G); by("BY SIZE (against the 5-minute ATR)", x => x.sz); by("BY TIME OF DAY the gap was made", x => x.when); by("BY KIND OF DAY (known only at the close)", x => x.dayKind);
by("BY THE PUSH: made a new day high/low or not (known at once)", x => x.newExt ? "new day high/low" : "inside the day's range");
by("GAP POINTS THE WAY THE DAY ENDED (hindsight)", x => x.withDay ? "with the day" : "against the day");
const big = G.filter(x => x.rel >= 0.5 && x.hm < "14:00"); console.log("\nONLY medium and big gaps made before 14:00:"); line("all", big);
by(" by the push", x => x.newExt ? "new day high/low" : "inside the day's range", big); by(" by kind of day", x => x.dayKind, big);
const pts = (lo, hi) => G.filter(x => x.size >= lo && x.size < hi); console.log("\nBY SIZE IN POINTS"); for (const [lo, hi] of [[0, 5], [5, 10], [10, 20], [20, 40], [40, 1e9]]) line(`${lo} to ${hi > 1e8 ? "more" : hi} points`, pts(lo, hi));
fs.writeFileSync(__dirname + "/fvg3.json", JSON.stringify(G));
