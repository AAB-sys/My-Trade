// The research engine (LOGIC.md, layer 5): replays the owner's rule and a list of ideas over the saved days, both indices,
// 5- and 15-minute candles, and prints them side by side. Research only: no page loads this file, and nothing here
// changes what the index page does. Run it with node:
//
//     node lab/replay.js                 the days in data/sessions
//     node lab/replay.js some/folder     the days in another folder
//
// The base line is checked against the page's own engine (static/rules.js) on every run, so this file cannot drift
// from the rule the pages use without saying so.
const fs = require("fs"), path = require("path");
require(path.join(__dirname, "..", "static", "rules.js"));
const R = globalThis.Rules;
const folder = process.argv[2] || path.join(__dirname, "..", "data", "sessions");
const DAYS = fs.readdirSync(folder).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(fs.readFileSync(path.join(folder, f), "utf8"))).filter(d => d.complete);
if (!DAYS.length) { console.log("no finished day in " + folder); process.exit(1); }
const SEC = { "1m": 60, "5m": 300, "15m": 900, "30m": 1800 }, IST = 19800;
const r2 = x => Math.round(x * 100) / 100, tod = e => (e + IST) % 86400, hm = (h, m) => h * 3600 + m * 60;

// One day under one set of options. The owner's rule with no option set equals Rules.paperTrades (checked below).
//   levels: prev | today | open30 | open15     signal: held | crossed | both | retest
//   closeAt, noNewAfter: as in Rules (ideas P1 and P2)   onlyRatios: [..]   closeBack: exit when a candle closes back across the level
//   stopShare: exit when against by this share of the distance to the target   agree: the last closed candle of the higher frame must
//   sit on the call's side of the level   sideOnDay: "with" takes CE only on a day up so far, PE only on a day down   minNeed: least distance to the target
function run(bars, previous, o, higher) {
  const sec = o.sec;
  const fixed = o.levels === "prev" ? (previous ? R.levelsOf(R.moveOfDay(previous)) : null) : null;
  const openRange = n => { const first = bars.filter(b => tod(b.time) < hm(9, 15) + n * 60); return first.length ? R.levelsOf(R.moveOf(first)) : null; };
  const opening = o.levels === "open30" ? openRange(30) : o.levels === "open15" ? openRange(15) : null;
  const levelsAt = i => o.levels === "prev" ? fixed : o.levels === "today" ? R.levelsOf(R.moveOf(bars.slice(0, i + 1))) : opening;
  const trades = [], used = {}, crossedAgo = {}; let ready = null, open = [];
  const gain = (x, p) => r2(x.side === "CE" ? p - x.entry : x.entry - p);
  const end = (x, p, bar, how) => { x.exit = p; x.exitTime = bar.time; x.how = how; x.points = gain(x, p); };
  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i], prev = bars[i - 1].close, levels = levelsAt(i), clockEnd = tod(bar.time) + sec;
    if (!levels || (o.levels === "open30" && tod(bar.time) < hm(9, 45)) || (o.levels === "open15" && tod(bar.time) < hm(9, 30))) continue;
    if (ready) { const x = { ...ready, entry: bar.open, entryTime: bar.time, how: "open", adv: 0, fav: 0 }; trades.push(x); open.push(x); ready = null; }
    open = open.filter(x => {
      x.fav = Math.max(x.fav, x.side === "CE" ? bar.high - x.entry : x.entry - bar.low); x.adv = Math.max(x.adv, x.side === "CE" ? x.entry - bar.low : bar.high - x.entry);
      if (x.side === "CE" ? bar.high >= x.target : bar.low <= x.target) { end(x, x.target, bar, "target"); return false; }
      if (o.stopShare) { const stop = x.side === "CE" ? x.entry - o.stopShare * (x.target - x.entry) : x.entry + o.stopShare * (x.entry - x.target);
        if (x.side === "CE" ? bar.low <= stop : bar.high >= stop) { end(x, stop, bar, "stop"); return false; } }
      if (o.closeBack && (x.side === "CE" ? bar.close < x.level : bar.close > x.level)) { end(x, bar.close, bar, "closed back"); return false; }
      return true;
    });
    if (o.closeAt && clockEnd >= o.closeAt) { open.forEach(x => end(x, bar.close, bar, "time")); open = []; }
    levels.forEach(l => { if (bar.close < l.price) used[l.ratio + "CE"] = false; if (bar.close > l.price) used[l.ratio + "PE"] = false; });
    const crossed = L => (prev < L && bar.close > L) || (prev > L && bar.close < L);
    const held = L => !crossed(L) && ((prev > L && bar.low <= L && bar.close > L) || (prev < L && bar.high >= L && bar.close < L));
    const hits = levels.filter(l => {
      if (o.onlyRatios && !o.onlyRatios.includes(l.ratio)) return false;
      const kind = crossed(l.price) ? "crossed" : held(l.price) ? "held" : null;
      if (!kind) return false;
      const side = bar.close > l.price ? "CE" : "PE";
      if (used[l.ratio + side]) return false;
      if (o.signal === "retest") return kind === "held" && crossedAgo[l.ratio + side] != null && i - crossedAgo[l.ratio + side] <= (o.retestWithin || 6);
      return o.signal === "both" || o.signal === kind;
    });
    levels.forEach(l => { if (crossed(l.price)) crossedAgo[l.ratio + (bar.close > l.price ? "CE" : "PE")] = i; });
    let sig = null;
    if (hits.length) {
      const at = hits.reduce((a, b) => Math.abs(b.price - bar.close) < Math.abs(a.price - bar.close) ? b : a);
      const kind = crossed(at.price) ? "crossed" : "held", side = bar.close > at.price ? "CE" : "PE";
      const k = levels.indexOf(at), next = side === "CE" ? levels[k + 1] : levels[k - 1];
      const late = (o.noNewAfter && clockEnd > o.noNewAfter) || (o.closeAt && clockEnd >= o.closeAt);
      let ok = !!next && !late;
      if (ok && o.sideOnDay === "with") ok = (side === "CE") === (bar.close >= bars[0].open);
      if (ok && o.agree && higher) { const done = higher.filter(b => b.time + o.higherSec <= bar.time + sec); const c = done[done.length - 1]; ok = !!c && (side === "CE" ? c.close > at.price : c.close < at.price); }
      if (ok && o.minNeed) ok = Math.abs(next.price - bar.close) >= o.minNeed;
      if (ok) sig = { signalTime: bar.time, level: at.price, ratio: at.ratio, kind, side, target: next.price, close: bar.close };
    }
    if (sig) { ready = sig; used[sig.ratio + sig.side] = true; }
  }
  const last = bars[bars.length - 1];
  open.forEach(x => end(x, last.close, last, "day end"));
  return trades;
}
function all(index, interval, opts) {
  const higherKey = interval === "5m" ? "15m" : "30m";
  return DAYS.flatMap(f => { const ix = f.indices[index]; if (!ix) return [];
    return run(ix.candles[interval], ix.previous, { levels: "prev", signal: "both", ...opts, sec: SEC[interval], higherSec: SEC[higherKey] }, ix.candles[higherKey]).map(x => ({ ...x, date: f.date })); });
}
const byDay = (L) => { const m = {}; L.forEach(x => m[x.date] = r2((m[x.date] || 0) + x.points)); return m; };
function tally(L, base) {
  const won = L.filter(x => x.points > 0).length, lost = L.filter(x => x.points < 0).length, net = r2(L.reduce((s, x) => s + x.points, 0));
  const mine = byDay(L), days = Object.values(mine), theirs = base ? byDay(base) : null;
  const ahead = theirs ? DAYS.filter(d => (mine[d.date] || 0) > (theirs[d.date] || 0)).length : null;  // days on which the idea beat the owner's rule
  const behind = theirs ? DAYS.filter(d => (mine[d.date] || 0) < (theirs[d.date] || 0)).length : null;
  return { n: L.length, won, lost, net, avg: L.length ? r2(net / L.length) : 0, ends: L.filter(x => x.how === "day end").length,
           worst: L.length ? Math.min(...L.map(x => x.points)) : 0, worstDay: days.length ? Math.min(...days) : 0, daysUp: days.filter(d => d > 0).length, ahead, behind };
}
const row = (name, s) => `${name.padEnd(46)} ${String(s.n).padStart(3)} calls ${String(s.won).padStart(3)}W ${String(s.lost).padStart(3)}L  net ${String(s.net).padStart(9)}  avg ${String(s.avg).padStart(7)}  day-end ${String(s.ends).padStart(2)}  worst call ${String(s.worst).padStart(8)}  days up ${s.daysUp}/${DAYS.length}  worst day ${String(s.worstDay).padStart(8)}`
  + (s.ahead == null ? "" : `  ahead of the rule on ${s.ahead}, behind on ${s.behind}`);

// The ideas. The first rows are the owner's rule; P1 and P2 are the ones the owner confirmed for the study page (6 October).
const IDEAS = [
  ["your rule: previous-day levels, both signals", {}],
  ["your rule: today-so-far levels, both signals", { levels: "today" }],
  ["P1 close open calls at 15:00", { closeAt: hm(15, 0) }],
  ["P2 no new calls after 14:00", { noNewAfter: hm(14, 0) }],
  ["P1 + P2", { closeAt: hm(15, 0), noNewAfter: hm(14, 0) }],
  ["exit when a candle closes back across the level", { closeBack: true }],
  ["stop at half the distance to the target", { stopShare: 0.5 }],
  ["stop at the full distance to the target", { stopShare: 1 }],
  ["no new calls after 13:00", { noNewAfter: hm(13, 0) }],
  ["signal only if the higher frame's last closed candle agrees", { agree: true }],
  ["without the 23.6% level", { onlyRatios: [0, 0.382, 0.5, 0.618, 0.786, 1] }],
  ["without 23.6% and 38.2%", { onlyRatios: [0, 0.5, 0.618, 0.786, 1] }],
  ["only the move's ends (0%, 100%)", { onlyRatios: [0, 1] }],
  ["retest: a cross, then a hold there within 6 candles", { signal: "retest" }],
  ["levels from the first 30 minutes' range", { levels: "open30" }],
  ["levels from the first 15 minutes' range", { levels: "open15" }],
  ["only with the day's direction so far", { sideOnDay: "with" }],
  ["today-so-far levels + P1 + P2", { levels: "today", closeAt: hm(15, 0), noNewAfter: hm(14, 0) }],
];
console.log(`${DAYS.length} finished days: ${DAYS[0].date} to ${DAYS[DAYS.length - 1].date}`);
for (const index of Object.keys(DAYS[0].indices)) for (const interval of ["5m", "15m"]) {
  // the self-check: the base line must equal the page's engine
  const mine = tally(all(index, interval, {}));
  const page = tally(DAYS.flatMap(f => { const ix = f.indices[index]; return R.replayDay({ bars: ix.candles[interval], move: "prev", previous: ix.previous, seconds: SEC[interval], signal: "both" }).trades.filter(t => t.exit != null).map(t => ({ ...t, date: f.date })); }));
  const same = mine.n === page.n && mine.net === page.net;
  console.log(`\n==== ${index}, ${interval} candles ${same ? "(base line agrees with the page's engine)" : "!! BASE LINE DIFFERS FROM THE PAGE: " + JSON.stringify(page)}`);
  const base = all(index, interval, {});
  IDEAS.forEach(([name, opts], i) => console.log(row(name, tally(all(index, interval, opts), i ? base : null))));
}
