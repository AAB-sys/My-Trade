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
const DAYS = fs.readdirSync(folder).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map(f => JSON.parse(fs.readFileSync(path.join(folder, f), "utf8"))).filter(d => d.complete);
if (!DAYS.length) { console.log("no finished day in " + folder); process.exit(1); }
// the calls the index page suggested live, one CSV a day beside the candles (<date>-calls.csv), the owner's ask of 7 October
// The owner's rule (6 and 7 October): the research works on the candles and their levels only. The premium columns of
// the calls CSV (the contract, the premium paid and now, the sell line, the premium sold at) are information for the
// index page and never research input, so they are dropped the moment a CSV is read; and records/<date>.json on the
// data branch (the options behind the calls) is never read here at all.
const NOT_RESEARCH = new Set(["contract", "premium_paid", "premium_now", "sell_below", "sold_at_premium"]);
function readCsv(file) {
  const [head, ...lines] = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.filter(Boolean).map(line => { const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')); return Object.fromEntries(cols.map((k, i) => [k, cells[i] ?? ""]).filter(([k]) => !NOT_RESEARCH.has(k))); });
}
const LIVE = [].concat(...fs.readdirSync(folder).filter(f => /^\d{4}-\d{2}-\d{2}-calls\.csv$/.test(f)).sort().map(f => readCsv(path.join(folder, f))));
const SEC = { "1m": 60, "5m": 300, "15m": 900, "30m": 1800 }, IST = 19800;
const r2 = x => Math.round(x * 100) / 100, tod = e => (e + IST) % 86400, hm = (h, m) => h * 3600 + m * 60;

// One day under one set of options. The owner's rule with no option set equals Rules.paperTrades (checked below).
//   levels: prev | today | open30 | open15     signal: held | crossed | both | retest
//   closeAt, noNewAfter: as in Rules (ideas P1 and P2)   onlyRatios: [..]   closeBack: exit when a candle closes back across the level
//   stopShare: exit when against by this share of the distance to the target, the stop fixed at the entry (8 October; in a
//   candle that touched both, the stop first here: the minute-settled figures are the "stops" rows below, from Rules)   agree: the last closed candle of the higher frame must
//   sit on the call's side of the level   sideOnDay: "with" takes CE only on a day up so far, PE only on a day down   minNeed: least distance to the target
//   minDepth: a crossed signal counts only when its candle closed at least this share of the way from the level to the next one
//   (waitDeeper: a shallower cross waits, and the first later candle closing that deep gives the call)   minBody: a crossed
//   signal needs a body of at least this share of that gap   closeBackShare: exit when a candle closes back across the level by
//   at least this share of the gap (7 October: the depth of the close past a level is what tells a cross from a bounce)
//   carryOn: idea P5 (7 October evening): when the candle reaching the target closes at least this share of the next gap past it,
//   the call carries on to the level beyond, again and again up the ladder of levels in force at the signal
//   holdBreaks: the owner's exit rule for breaks (8 October night), on unless set to false: a crossed call is held through its
//   target and sold on a close back across its line, on a return to the signal candle's open after a candle opened further
//   away, or at the day end; no new call that way while it is held (as Rules.paperTrades)
//   trail: Rule 2 of the owner's specification (9 October), the held break's stop moved line by line (Rules.trailStep): as the
//   index page runs it (Rules.TRAIL) unless another setting is given, null for Rule 1 alone
function run(bars, previous, o, higher) {
  const holdBreaks = o.holdBreaks !== false;
  const trail = !holdBreaks ? null : o.trail === undefined ? R.TRAIL : o.trail;
  const atr = trail && trail.buffer === "atr" ? R.atrBefore(bars, trail.period || 14) : null;
  const bufferAt = i => !trail ? 0 : trail.buffer === "fixed" ? trail.points : trail.buffer === "atr" ? (atr[i] != null ? trail.mult * atr[i] : trail.points || 0) : 0;
  const sec = o.sec;
  const fixed = o.levels === "prev" ? (previous ? R.levelsOf(R.moveOfDay(previous)) : null) : null;
  const openRange = n => { const first = bars.filter(b => tod(b.time) < hm(9, 15) + n * 60); return first.length ? R.levelsOf(R.moveOf(first)) : null; };
  const opening = o.levels === "open30" ? openRange(30) : o.levels === "open15" ? openRange(15) : null;
  const today = R.todayLevelsAt(bars), todayLines = R.todayLinesAt(bars);  // the seven lines as they stood when each candle began, and with it (the target's, 8 October)
  const levelsAt = i => o.levels === "prev" ? fixed : o.levels === "today" ? today(i) : opening;
  const trades = [], used = {}, crossedAgo = {}, shallow = {}; let ready = null, open = [];
  const gain = (x, p) => r2(x.side === "CE" ? p - x.entry : x.entry - p);
  const end = (x, p, bar, how) => { x.exit = p; x.exitTime = bar.time; x.how = how; x.points = gain(x, p); };
  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i], prev = bars[i - 1].close, levels = levelsAt(i), clockEnd = tod(bar.time) + sec;
    if (!levels || (o.levels === "open30" && tod(bar.time) < hm(9, 45)) || (o.levels === "open15" && tod(bar.time) < hm(9, 30))) continue;
    if (ready) {  // the entry: already at or past the target, the call aims at the first level beyond the entry, or does not enter (owner, 7 October)
      let target = ready.target, aimed = null;
      if (ready.side === "CE" ? bar.open >= target : bar.open <= target) {
        const beyond = ready.side === "CE" ? ready.prices.find(p => p > bar.open) : ready.prices.slice().reverse().find(p => p < bar.open);
        target = beyond == null ? null : beyond; aimed = "beyond";
      }
      if (target != null) { const ladder = ready.side === "CE" ? ready.prices.filter(p => p > target) : ready.prices.filter(p => p < target).reverse();
        const x = { ...ready, target, aimed, ladder, entry: bar.open, entryTime: bar.time, how: "open", adv: 0, fav: 0 }; trades.push(x); open.push(x); }
      ready = null;
    }
    open = open.filter(x => {
      if (x.hold) {  // a held break: exit B (back to C1's open after a candle opened further away), then exit A at the close
        const pc = bars[i - 1].close, pe = x.side === "PE";
        x.fav = Math.max(x.fav, pe ? x.entry - bar.low : bar.high - x.entry); x.adv = Math.max(x.adv, pe ? bar.high - x.entry : x.entry - bar.low);
        if (!x.trail) {  // Rule 1 until a further line is crossed
          if ((pe ? x.c1Open >= x.level && bar.open < pc && bar.high >= x.c1Open : x.c1Open <= x.level && bar.open > pc && bar.low <= x.c1Open)) { end(x, x.c1Open, bar, "retouch"); return false; }
          if (pe ? bar.close > x.level : bar.close < x.level) { end(x, bar.close, bar, "back"); return false; }
        }
        if (trail) {  // Rule 2: the stop moved line by line, on the lines this candle is judged against
          const st = x.trail || { stop: x.level, stopRatio: x.ratio, line: null, ratio: null };
          const lines = trail.lines === "all" ? levels : levels.filter(l => l.ratio !== 0 && l.ratio !== 1);
          if (R.trailStep(st, bar.close, lines, x.side, trail.place, bufferAt(i)) === "sell") { end(x, bar.close, bar, "trail"); return false; }
          if (st.line != null) x.trail = st;
        }
        return true;
      }
      const past = x.side === "CE" ? Math.max(x.entry, x.level) : Math.min(x.entry, x.level), k = x.carried || 0;  // the target follows the lines, as Rules.paperTrades (8 October)
      const lines = o.levels === "today" ? todayLines(i) : levels;
      const beyond = x.side === "CE" ? lines.map(l => l.price).filter(p => p > past) : lines.map(l => l.price).filter(p => p < past).reverse();
      if (beyond.length > k) { x.target = beyond[k]; x.ladder = beyond.slice(k + 1); }
      x.fav = Math.max(x.fav, x.side === "CE" ? bar.high - x.entry : x.entry - bar.low); x.adv = Math.max(x.adv, x.side === "CE" ? x.entry - bar.low : bar.high - x.entry);
      while (x.side === "CE" ? bar.high >= x.target : bar.low <= x.target) {  // the target reached: idea P5 may carry on to the level beyond
        const beyond = o.carryOn != null && x.ladder.length ? x.ladder[0] : null;
        if (beyond != null && (x.side === "CE" ? bar.close - x.target : x.target - bar.close) >= o.carryOn * Math.abs(beyond - x.target)) { x.carried = (x.carried || 0) + 1; x.target = beyond; x.ladder = x.ladder.slice(1); continue; }
        end(x, x.target, bar, "target"); return false;
      }
      if (o.stopShare) { if (x.stop == null) x.stop = r2(x.side === "CE" ? x.entry - o.stopShare * (x.target - x.entry) : x.entry + o.stopShare * (x.entry - x.target));
        if (x.side === "CE" ? bar.low <= x.stop : bar.high >= x.stop) { end(x, x.stop, bar, "stop"); return false; } }
      if (o.closeBack && (x.side === "CE" ? bar.close < x.level : bar.close > x.level)) { end(x, bar.close, bar, "candle"); return false; }
      if (o.closeBackShare) { const gap = Math.abs(x.target - x.level), back = x.side === "CE" ? x.level - bar.close : bar.close - x.level;
        if (gap > 0 && back >= o.closeBackShare * gap) { end(x, bar.close, bar, "candle"); return false; } }  // idea P4 at a quarter (Rules.paperTrades exitBack)
      return true;
    });
    if (o.closeAt && clockEnd >= o.closeAt) { open.forEach(x => end(x, bar.close, bar, "time")); open = []; }
    for (const k in used) { const u = used[k]; if (u.side === "CE" ? bar.close < u.price : bar.close > u.price) delete used[k]; }  // the line at its price, as Rules.paperTrades (8 October)
    const from = L => { for (let j = i - 1; j >= 0; j--) if (bars[j].close !== L) return bars[j].close; return prev; };  // the last close off line L (9 October, as Rules.signalAt)
    const crossed = L => { const p = from(L); return (p < L && bar.close > L) || (p > L && bar.close < L); };
    const held = L => !crossed(L) && ((prev > L && bar.low <= L && bar.close > L) || (prev < L && bar.high >= L && bar.close < L));
    const hits = levels.filter(l => {
      if (o.onlyRatios && !o.onlyRatios.includes(l.ratio)) return false;
      const kind = crossed(l.price) ? "crossed" : held(l.price) ? "held" : null;
      if (!kind) return false;
      const side = bar.close > l.price ? "CE" : "PE";
      if (used[l.price + "|" + side]) return false;
      if (o.signal === "retest") return kind === "held" && crossedAgo[l.ratio + side] != null && i - crossedAgo[l.ratio + side] <= (o.retestWithin || 6);
      return o.signal === "both" || o.signal === kind;
    });
    levels.forEach(l => { if (crossed(l.price)) crossedAgo[l.ratio + (bar.close > l.price ? "CE" : "PE")] = i; });
    let sig = null;
    // a shallow cross that waits (minDepth + waitDeeper): the first later candle closing deep enough, still on that side, gives the call
    if (!hits.length && o.minDepth && o.waitDeeper) {
      for (const key of Object.keys(shallow)) {
        const w = shallow[key]; if (!w) continue;
        const l = levels.find(x => x.ratio === w.ratio), k = l ? levels.indexOf(l) : -1, next = k < 0 ? null : (w.side === "CE" ? levels[k + 1] : levels[k - 1]);
        const onSide = l && (w.side === "CE" ? bar.close > l.price : bar.close < l.price);
        if (!onSide) { delete shallow[key]; continue; }
        if (next && !used[l.price + "|" + w.side] && Math.abs(bar.close - l.price) >= o.minDepth * Math.abs(next.price - l.price)) { hits.push(l); delete shallow[key]; break; }
      }
    }
    if (hits.length) {
      const at = hits.reduce((a, b) => Math.abs(b.price - bar.close) < Math.abs(a.price - bar.close) ? b : a);
      const kind = crossed(at.price) ? "crossed" : "held", side = bar.close > at.price ? "CE" : "PE";
      const k = levels.indexOf(at), next = side === "CE" ? levels[k + 1] : levels[k - 1];
      const late = (o.noNewAfter && clockEnd > o.noNewAfter) || (o.closeAt && clockEnd >= o.closeAt);
      let ok = !!next && !late && !(holdBreaks && open.some(x => x.hold && x.side === side));  // a held break that way: the same trade continues
      if (ok && kind === "crossed" && next && !holdBreaks) {  // the depth and the body of the crossing candle, against the gap to the next level
        const gap = Math.abs(next.price - at.price), depth = Math.abs(bar.close - at.price) / gap, body = Math.abs(bar.close - bar.open) / gap;
        if (o.minDepth && depth < o.minDepth) { ok = false; if (o.waitDeeper) shallow[at.ratio + side] = { ratio: at.ratio, side }; }
        if (ok && o.minBody && body < o.minBody) ok = false;
      }
      if (ok && o.sideOnDay === "with") ok = (side === "CE") === (bar.close >= bars[0].open);
      if (ok && o.agree && higher) { const done = higher.filter(b => b.time + o.higherSec <= bar.time + sec); const c = done[done.length - 1]; ok = !!c && (side === "CE" ? c.close > at.price : c.close < at.price); }
      if (ok && o.minNeed) ok = Math.abs(next.price - bar.close) >= o.minNeed;
      if (ok) sig = { signalTime: bar.time, level: at.price, ratio: at.ratio, kind, side, target: next.price, close: bar.close, prices: levels.map(l => l.price) };
      if (sig && holdBreaks && kind === "crossed") { sig.hold = true; sig.c1Open = bar.open; }
    }
    if (sig) { ready = sig; used[sig.level + "|" + sig.side] = { price: sig.level, side: sig.side }; }
  }
  const last = bars[bars.length - 1];
  open.forEach(x => end(x, last.close, last, "day end"));
  return trades;
}
function all(index, interval, opts) {
  const higherKey = interval === "5m" ? "15m" : "30m";
  if (typeof opts === "function") opts = opts(index);  // a setting that depends on the index (Rule 2's buffer in points)
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

const POINTS = { "NIFTY 50": 10, "NIFTY BANK": 25, "SENSEX": 32 };  // Rule 2's fixed buffer per index (and the ATR's until 14 candles have closed)
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
  // 7 October, from the owner's two screenshots: the depth of the close past a level tells a cross from a bounce
  ["crossed only when the close is past halfway to the next level", { minDepth: 0.5 }],
  ["P3 crossed only a quarter of the way to the next level", { minDepth: 0.25 }],
  ["P1 + P2 + P3", { closeAt: hm(15, 0), noNewAfter: hm(14, 0), minDepth: 0.25 }],
  ["today-so-far levels + P3", { levels: "today", minDepth: 0.25 }],
  ["a shallow cross waits for a close past halfway", { minDepth: 0.5, waitDeeper: true }],
  ["crossed only with a body of half the gap", { minBody: 0.5 }],
  ["P4 exit when a candle closes on the wrong side of the level", { closeBackShare: 0.25 }],  // the owner's rule, 7 October evening: a quarter of the gap past it
  // 7 October evening, the carry study (findings, round 3): at the target, a close a quarter into the next gap carries the call on
  ["P5 carry on a quarter into the next gap, again and again", { carryOn: 0.25 }],
  ["carry on: any close past the target", { carryOn: 0 }],
  ["carry on: close past halfway of the next gap", { carryOn: 0.5 }],
  ["P1 + P2 + P5", { closeAt: hm(15, 0), noNewAfter: hm(14, 0), carryOn: 0.25 }],
  ["P1 + P2 + P3 + P5", { closeAt: hm(15, 0), noNewAfter: hm(14, 0), minDepth: 0.25, carryOn: 0.25 }],
  ["P1 + P2 + P3 + P4 + P5", { closeAt: hm(15, 0), noNewAfter: hm(14, 0), minDepth: 0.25, closeBackShare: 0.25, carryOn: 0.25 }],
  ["today-so-far levels + P5", { levels: "today", carryOn: 0.25 }],
  ["today-so-far levels + P1 + P2 + P5", { levels: "today", closeAt: hm(15, 0), noNewAfter: hm(14, 0), carryOn: 0.25 }],
  ["P3 + P4", { minDepth: 0.25, closeBackShare: 0.25 }],
  ["P1 + P2 + P3 + P4", { closeAt: hm(15, 0), noNewAfter: hm(14, 0), minDepth: 0.25, closeBackShare: 0.25 }],
  ["today-so-far levels + P4", { levels: "today", closeBackShare: 0.25 }],
  ["today-so-far levels + P3 + P4", { levels: "today", minDepth: 0.25, closeBackShare: 0.25 }],
  ["exit when a candle closes back by half the gap", { closeBackShare: 0.5 }],
  ["exit when a candle closes back by a whole gap", { closeBackShare: 1 }],
  ["depth past halfway + exit on a quarter reclaim", { minDepth: 0.5, closeBackShare: 0.25 }],
  ["today-so-far levels + depth past halfway", { levels: "today", minDepth: 0.5 }],
  ["today-so-far levels + depth past halfway + quarter reclaim", { levels: "today", minDepth: 0.5, closeBackShare: 0.25 }],
  // 9 October, the owner's specification: Rule 2's settings (section 6) against the rule as the page runs it (the owner's choice:
  // all 7 lines, no buffer, the stop one Fibonacci line back); the buffer in points: 10 on NIFTY 50 (the specification's example),
  // the same share of the index elsewhere
  ...["prev", "today"].flatMap(lv => [
    [`${lv}: Rule 1 alone, no moving stop`, { levels: lv, trail: null }],
    [`${lv}: Rule 2 on lines 23.6% to 78.6% only`, { levels: lv, trail: { lines: "middle", buffer: "none", place: "back" } }],
    [`${lv}: Rule 2, stop on the line crossed (PR #115)`, { levels: lv, trail: { lines: "all", buffer: "none", place: "at" } }],
    [`${lv}: Rule 2, buffer in points`, ix => ({ levels: lv, trail: { lines: "all", buffer: "fixed", points: POINTS[ix], place: "at" } })],
    [`${lv}: Rule 2, buffer in points, one line back`, ix => ({ levels: lv, trail: { lines: "all", buffer: "fixed", points: POINTS[ix], place: "back" } })],
    [`${lv}: Rule 2, buffer a quarter ATR`, ix => ({ levels: lv, trail: { lines: "all", buffer: "atr", mult: 0.25, points: POINTS[ix], place: "at" } })],
    [`${lv}: Rule 2, buffer half the ATR`, ix => ({ levels: lv, trail: { lines: "all", buffer: "atr", mult: 0.5, points: POINTS[ix], place: "at" } })],
    [`${lv}: Rule 2, buffer half the ATR, one line back`, ix => ({ levels: lv, trail: { lines: "all", buffer: "atr", mult: 0.5, points: POINTS[ix], place: "back" } })],
  ]),
];
console.log(`${DAYS.length} finished days: ${DAYS[0].date} to ${DAYS[DAYS.length - 1].date}; ${LIVE.length} calls suggested live on the index page in ${new Set(LIVE.map(c => c.date)).size} of them`);
// the live calls: what the page suggested, setting by setting, by the page's own points; and whether the replay gives the same call
// (the same signal time and side under the same setting), which is the test of the live page's timing and levels
if (LIVE.length) {
  const groups = {};
  LIVE.forEach(c => (groups[`${c.index}|${c.time_frame}|${c.levels}|${c.signal_mode}`] = groups[`${c.index}|${c.time_frame}|${c.levels}|${c.signal_mode}`] || []).push(c));
  console.log("\n==== the calls the index page suggested live (its own points; finished ones only in the counts)");
  Object.keys(groups).sort().forEach(key => {
    const [index, interval, levels, signal] = key.split("|"), list = groups[key];
    const done = list.filter(c => ["target", "day end", "back", "retouch", "trail"].includes(c.ended_by));
    const net = r2(done.reduce((s, c) => s + (parseFloat(c.points) || 0), 0)), won = done.filter(c => parseFloat(c.points) > 0).length;
    let matched = 0, replayable = 0;
    if (SEC[interval] && (levels === "prev" || levels === "today") && signal !== "off") {
      list.forEach(c => { const day = DAYS.find(d => d.date === c.date); const ix = day && day.indices[index]; if (!ix) return;
        replayable++;
        const t = R.replayDay({ bars: ix.candles[interval], move: levels, previous: ix.previous, seconds: SEC[interval], signal }).trades;
        const stamp = e => new Date(e * 1000).toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).slice(0, 16);
        if (t.some(x => stamp(x.signalTime) === c.signal_time_ist && x.side === c.option_side)) matched++; });
    }
    console.log(`${index}, ${interval}, ${levels} levels, ${signal}: ${list.length} calls on ${new Set(list.map(c => c.date)).size} day(s); finished ${done.length}, won ${won}, net ${net}`
      + (replayable ? `; the replay gives the same call for ${matched} of ${replayable}` : ""));
  });
}
for (const index of Object.keys(DAYS[0].indices)) for (const interval of ["5m", "15m"]) {
  // the self-check: the base line must equal the page's engine
  const mine = tally(all(index, interval, {}));
  const page = tally(DAYS.flatMap(f => { const ix = f.indices[index]; return R.replayDay({ bars: ix.candles[interval], move: "prev", previous: ix.previous, seconds: SEC[interval], signal: "both" }).trades.filter(t => t.exit != null).map(t => ({ ...t, date: f.date })); }));
  const mineToday = tally(all(index, interval, { levels: "today" }));  // and the today-so-far line
  const pageToday = tally(DAYS.flatMap(f => { const ix = f.indices[index]; return R.replayDay({ bars: ix.candles[interval], move: "today", previous: ix.previous, seconds: SEC[interval], signal: "both" }).trades.filter(t => t.exit != null).map(t => ({ ...t, date: f.date })); }));
  const same = mine.n === page.n && mine.net === page.net && mineToday.n === pageToday.n && mineToday.net === pageToday.net;
  console.log(`\n==== ${index}, ${interval} candles ${same ? "(base lines agree with the page's engine)" : "!! BASE LINE DIFFERS FROM THE PAGE: " + JSON.stringify({ page, pageToday, mine, mineToday })}`);
  const base = all(index, interval, {});
  IDEAS.forEach(([name, opts], i) => console.log(row(name, tally(all(index, interval, opts), i ? base : null))));
  // the stops of the Study page (P6, P7; the owner's question of 8 October), by the page's own engine, a candle that touched both
  // the stop and the target settled by the one-minute candles, on both levels modes and both signals
  const viaRules = (move, ideas) => DAYS.flatMap(f => { const ix = f.indices[index]; if (!ix || (move === "prev" && !ix.previous)) return [];
    return R.replayDay({ bars: ix.candles[interval], move, previous: ix.previous, seconds: SEC[interval], signal: "both", ideas: ideas && { ...ideas, minutes: ix.candles["1m"] } })
      .trades.filter(t => t.exit != null).map(t => ({ ...t, date: f.date })); });
  for (const move of ["today", "prev"]) {
    const rule = viaRules(move, null);
    console.log(row(`stops, ${move} levels: your rule`, tally(rule)));
    ["P4", "P6", "P7"].forEach(k => console.log(row(`stops, ${move} levels: ${k} ${R.IDEAS[k].name.toLowerCase()}`.slice(0, 46), tally(viaRules(move, R.IDEAS[k].ideas), rule))));
  }
}
