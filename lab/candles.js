// Candle studies (the owner's ask, 7 October evening): wicks against bodies, retests that hold and retests that fail, and
// momentum candles, counted over every saved day. Candles and their levels only; no premiums anywhere. Run:
//   node lab/candles.js <folder of saved days> [5m|15m]
// Every number is a count over the saved days, so read it with the sample size beside it.
const fs = require("fs"), path = require("path");
require(path.join(__dirname, "..", "static", "rules.js")); const R = globalThis.Rules;
const folder = process.argv[2], interval = process.argv[3] || "5m", SEC = { "5m": 300, "15m": 900 }[interval];
const DAYS = fs.readdirSync(folder).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map(f => JSON.parse(fs.readFileSync(path.join(folder, f), "utf8"))).filter(d => d.complete);
if (!DAYS.length) { console.log("no finished day in " + folder); process.exit(1); }
const IST = 19800, tod = t => (t + IST) % 86400, r2 = x => Math.round(x * 100) / 100, pct = (a, b) => b ? `${a} of ${b} (${Math.round(100 * a / b)}%)` : "none";
const table = (title, rows) => { console.log(`\n${title}`); rows.forEach(([name, hit, n, extra]) => console.log(`  ${name.padEnd(62)} ${pct(hit, n)}${extra ? "  " + extra : ""}`)); };
const sets = [];
for (const day of DAYS) for (const index of ["NIFTY 50", "NIFTY BANK"]) { const ix = day.indices[index]; if (ix && ix.candles[interval]) sets.push({ date: day.date, index, bars: ix.candles[interval], previous: ix.previous }); }
console.log(`${DAYS.length} saved days (${DAYS[0].date} to ${DAYS[DAYS.length - 1].date}), ${interval} candles, NIFTY 50 and NIFTY BANK`);

// ---- 1. Wicks against bodies: does a long wick on the far side of a candle (it went further and was pushed back) mean a
// turn, or does the candle's direction carry on? Judged by the next candle's close and by the close three candles on.
{
  const groups = { "far-side wick shorter than the body": [], "far-side wick 1 to 2 times the body": [], "far-side wick over twice the body": [] };
  const near = { "near-side wick shorter than the body": [], "near-side wick 1 to 2 times the body": [], "near-side wick over twice the body": [] };
  sets.forEach(({ bars }) => bars.forEach((b, i) => {
    const body = Math.abs(b.close - b.open); if (body === 0 || i + 3 >= bars.length) return;
    const dir = b.close > b.open ? 1 : -1, far = dir > 0 ? b.high - b.close : b.close - b.low, nearW = dir > 0 ? b.open - b.low : b.high - b.open;
    const next = dir * (bars[i + 1].close - b.close) > 0, three = dir * (bars[i + 3].close - b.close), range = b.high - b.low;
    const row = { next, three: three > 0, move: three / range };
    const g = far < body ? 0 : far <= 2 * body ? 1 : 2; Object.values(groups)[g].push(row);
    const h = nearW < body ? 0 : nearW <= 2 * body ? 1 : 2; Object.values(near)[h].push(row);
  }));
  const rows = o => Object.entries(o).map(([k, L]) => [k, L.filter(x => x.next).length, L.length, `| three candles on, still that way: ${pct(L.filter(x => x.three).length, L.length)}, average move ${r2(L.reduce((s, x) => s + x.move, 0) / (L.length || 1))} of the candle's range`]);
  table("1a. The far-side wick (the candle pushed on and was pushed back). The next candle closes the candle's way:", rows(groups));
  table("1b. The near-side wick (the candle was pushed against first, then recovered). The next candle closes the candle's way:", rows(near));
}

// ---- 2. A long wick at a level: a candle whose wick crossed a level and whose close came back to the near side (a rejection
// at the level). Does the index turn away from the level, or cross it in the end?
{
  const out = { "wick through the level, close back on the near side (rejection)": [], "same, with the wick at least the body's length": [], "same, with the wick over twice the body": [] };
  sets.forEach(({ bars, previous }) => { for (let i = 1; i + 6 < bars.length; i++) {
    const levels = R.levelsOf(R.moveOf(bars.slice(0, i + 1))), b = bars[i], prev = bars[i - 1], body = Math.abs(b.close - b.open);
    for (const l of levels) for (const dir of [1, -1]) {  // dir 1: the candle came from below, poked above L, closed back below
      const poked = dir > 0 ? prev.close < l.price && b.high > l.price && b.close < l.price : prev.close > l.price && b.low < l.price && b.close > l.price;
      if (!poked) continue;
      const wick = dir > 0 ? b.high - Math.max(b.open, b.close) : Math.min(b.open, b.close) - b.low;
      // the next six candles: did a close cross L after all, or did the index move away by a fifth of the gap on the near side?
      const idx = levels.indexOf(l), nearL = dir > 0 ? levels[idx - 1] : levels[idx + 1]; if (!nearL) continue;
      let crossed = false, away = false;
      for (let k = i + 1; k <= i + 6; k++) { const x = bars[k]; if (dir > 0 ? x.close > l.price : x.close < l.price) { crossed = true; break; } if (dir > 0 ? x.close <= l.price - 0.5 * Math.abs(l.price - nearL.price) : x.close >= l.price + 0.5 * Math.abs(l.price - nearL.price)) { away = true; break; } }
      const row = { turned: away && !crossed, crossed };
      out["wick through the level, close back on the near side (rejection)"].push(row);
      if (wick >= body) out["same, with the wick at least the body's length"].push(row);
      if (wick > 2 * body) out["same, with the wick over twice the body"].push(row);
    } } });
  table("2. A rejection wick at a level. The index then moved halfway back to the level before it (turned):", Object.entries(out).map(([k, L]) => [k, L.filter(x => x.turned).length, L.length, `| crossed the level within six candles after all: ${pct(L.filter(x => x.crossed).length, L.length)}`]));
}

// ---- 3. Retests: a candle closes through a level; within six candles a candle comes back to within a fifth of the gap of
// that level. The retest held when that candle closed on the crossing side, failed when it closed back across. Then: did a
// held retest carry on to the next level (before any close back across), and what told the two apart at the retest candle.
{
  const held = [], failed = [];
  sets.forEach(({ bars }) => { for (let i = 1; i + 1 < bars.length; i++) {
    const levels = R.levelsOf(R.moveOf(bars.slice(0, i + 1))), b = bars[i], prev = bars[i - 1];
    for (const l of levels) for (const dir of [1, -1]) {
      const crossed = dir > 0 ? prev.close < l.price && b.close > l.price : prev.close > l.price && b.close < l.price; if (!crossed) continue;
      const idx = levels.indexOf(l), next = dir > 0 ? levels[idx + 1] : levels[idx - 1], before = dir > 0 ? levels[idx - 1] : levels[idx + 1]; if (!next) continue;
      const gap = Math.abs(next.price - l.price), crossBody = Math.abs(b.close - b.open), crossDepth = dir * (b.close - l.price) / gap;
      let k = -1; for (let j = i + 1; j <= Math.min(i + 6, bars.length - 1); j++) { const x = bars[j]; if (dir > 0 ? x.low <= l.price + 0.2 * gap : x.high >= l.price - 0.2 * gap) { k = j; break; } if (dir > 0 ? x.high >= next.price : x.low <= next.price) break; }
      if (k < 0) continue;
      const x = bars[k], xBody = Math.abs(x.close - x.open), heldIt = dir > 0 ? x.close > l.price : x.close < l.price;
      const depth = dir * (x.close - l.price) / gap, rejection = (dir > 0 ? Math.min(x.open, x.close) - x.low : x.high - Math.max(x.open, x.close)) >= xBody, touchedLevel = dir > 0 ? x.low <= l.price : x.high >= l.price;
      let on = false, back = false; for (let j = k + 1; j <= Math.min(k + 6, bars.length - 1); j++) { const y = bars[j]; if (dir > 0 ? y.close < l.price : y.close > l.price) { back = true; break; } if (dir > 0 ? y.high >= next.price : y.low <= next.price) { on = true; break; } }
      let reversed = false; if (!heldIt && before) for (let j = k + 1; j <= Math.min(k + 6, bars.length - 1); j++) { const y = bars[j]; if (dir > 0 ? y.low <= before.price : y.high >= before.price) { reversed = true; break; } }
      const row = { on, back, reversed, depth, rejection, touchedLevel, soon: k - i <= 2, bigBody: xBody >= 0.5 * crossBody, deepCross: crossDepth >= 0.5, early: tod(x.time) < 13 * 3600, ratio: l.ratio, closeIn: dir * (x.close - x.open) > 0 };
      (heldIt ? held : failed).push(row);
    } } });
  console.log(`\n3. Retests after a cross: ${held.length + failed.length} found; held ${held.length}, failed ${failed.length}`);
  table("3a. A held retest carried on to the next level before any close back across:", [
    ["all held retests", held.filter(x => x.on).length, held.length],
    ["retest candle closed a quarter or more of the way to the next level", held.filter(x => x.depth >= 0.25).filter(x => x.on).length, held.filter(x => x.depth >= 0.25).length],
    ["retest candle closed under a quarter of the way", held.filter(x => x.depth < 0.25).filter(x => x.on).length, held.filter(x => x.depth < 0.25).length],
    ["retest candle with a rejection wick toward the level (wick at least its body)", held.filter(x => x.rejection).filter(x => x.on).length, held.filter(x => x.rejection).length],
    ["retest candle without such a wick", held.filter(x => !x.rejection).filter(x => x.on).length, held.filter(x => !x.rejection).length],
    ["retest candle closed the way of the cross (green after an up-cross)", held.filter(x => x.closeIn).filter(x => x.on).length, held.filter(x => x.closeIn).length],
    ["retest candle closed against the cross", held.filter(x => !x.closeIn).filter(x => x.on).length, held.filter(x => !x.closeIn).length],
    ["the wick touched the level itself", held.filter(x => x.touchedLevel).filter(x => x.on).length, held.filter(x => x.touchedLevel).length],
    ["came within a fifth of the gap but did not touch", held.filter(x => !x.touchedLevel).filter(x => x.on).length, held.filter(x => !x.touchedLevel).length],
    ["retest within two candles of the cross", held.filter(x => x.soon).filter(x => x.on).length, held.filter(x => x.soon).length],
    ["retest three to six candles after the cross", held.filter(x => !x.soon).filter(x => x.on).length, held.filter(x => !x.soon).length],
    ["the crossing candle had closed past halfway", held.filter(x => x.deepCross).filter(x => x.on).length, held.filter(x => x.deepCross).length],
    ["the crossing candle had closed under halfway", held.filter(x => !x.deepCross).filter(x => x.on).length, held.filter(x => !x.deepCross).length],
    ["before 13:00", held.filter(x => x.early).filter(x => x.on).length, held.filter(x => x.early).length],
    ["13:00 or later", held.filter(x => !x.early).filter(x => x.on).length, held.filter(x => !x.early).length],
    ["deep retest close AND closed the way of the cross", held.filter(x => x.depth >= 0.25 && x.closeIn).filter(x => x.on).length, held.filter(x => x.depth >= 0.25 && x.closeIn).length],
    ["shallow retest close AND closed against the cross", held.filter(x => x.depth < 0.25 && !x.closeIn).filter(x => x.on).length, held.filter(x => x.depth < 0.25 && !x.closeIn).length],
  ]);
  table("3b. A failed retest (closed back across the level) went on to the level before it within six candles:", [
    ["all failed retests", failed.filter(x => x.reversed).length, failed.length],
    ["closed back by a quarter of the gap or more", failed.filter(x => x.depth <= -0.25).filter(x => x.reversed).length, failed.filter(x => x.depth <= -0.25).length],
    ["closed back by less than a quarter", failed.filter(x => x.depth > -0.25).filter(x => x.reversed).length, failed.filter(x => x.depth > -0.25).length],
    ["the crossing candle had closed past halfway", failed.filter(x => x.deepCross).filter(x => x.reversed).length, failed.filter(x => x.deepCross).length],
    ["the crossing candle had closed under halfway", failed.filter(x => !x.deepCross).filter(x => x.reversed).length, failed.filter(x => !x.deepCross).length],
  ]);
  const byRatio = {}; held.forEach(x => { const k = (x.ratio * 100).toFixed(1) + "%"; byRatio[k] = byRatio[k] || { on: 0, n: 0 }; byRatio[k].n++; if (x.on) byRatio[k].on++; });
  table("3c. Held retests that carried on, by the level retested:", Object.keys(byRatio).sort((a, b) => parseFloat(a) - parseFloat(b)).map(k => [k, byRatio[k].on, byRatio[k].n]));
}

// ---- 4. Momentum candles: a body at least twice the day's average body so far. Does the next candle carry on, and three on?
{
  const big = { "big body, far-side wick under a quarter of the body": [], "big body, far-side wick a quarter to the whole body": [], "big body, far-side wick over the body": [] };
  sets.forEach(({ bars }) => { let sum = 0; bars.forEach((b, i) => { const body = Math.abs(b.close - b.open); const avg = i ? sum / i : 0; sum += body;
    if (i < 6 || i + 3 >= bars.length || body < 2 * avg || body === 0) return;
    const dir = b.close > b.open ? 1 : -1, far = dir > 0 ? b.high - b.close : b.close - b.low;
    const row = { next: dir * (bars[i + 1].close - b.close) > 0, three: dir * (bars[i + 3].close - b.close) > 0 };
    (far < 0.25 * body ? big["big body, far-side wick under a quarter of the body"] : far <= body ? big["big body, far-side wick a quarter to the whole body"] : big["big body, far-side wick over the body"]).push(row); }); });
  table("4. Momentum candles (body twice the day's average so far). The next candle closes the candle's way:", Object.entries(big).map(([k, L]) => [k, L.filter(x => x.next).length, L.length, `| three candles on: ${pct(L.filter(x => x.three).length, L.length)}`]));
}
