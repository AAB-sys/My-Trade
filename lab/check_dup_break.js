// One break, one call (25 November 2026): the rising wedge and the Falling Channel both fired Buy PE on the 11:50 candle of NIFTY 50 at the same level,
// 25,943.35, with the same entry, and the page drew two "Buy PE" arrows. A pattern ticked adds a parallel call only when it is not the same break (side, candle,
// level) as a call already there. Run:   node lab/check_dup_break.js            (TREE=<folder> to test another copy of static/)
const fs = require("fs"), path = require("path"), root = process.env.TREE || path.join(__dirname, ".."); global.window = global;
require(path.join(root, "static/newrule.js")); require(path.join(root, "static/morepat.js"));
const NR = globalThis.NewRule, MP = globalThis.MorePat, fx = JSON.parse(fs.readFileSync(path.join(__dirname, "dup-2026-11-25.json")));
const hm = (t) => new Date((t + 19800) * 1000).toISOString().slice(11, 16);
let bad = 0; const check = (name, ok, d) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : " " + JSON.stringify(d))); if (!ok) bad++; };
const base = { bars: fx.bars, index: fx.index, prevBars: [], atrSeed: 21.616157965220914, closedCount: fx.bars.length, dayEnd: false };
const run = NR.runDay(base), page = NR.rulesFor(fx.index, new Set(Object.keys(NR.RULE_OPT_IN || {})));
const extra = NR.parallelCalls(base, run.trades, { rules: page, more: MP.PAGE_ORDER || MP.ORDER });
const all = run.trades.concat(extra), at = all.filter(t => hm(t.signalTime) === "11:50" && t.side === "PE");
check("the page's own call: the rising wedge Buy PE at 11:50, level 25,943.35", run.trades.some(t => hm(t.signalTime) === "11:50" && t.rule === "rising wedge" && Math.abs(t.L - 25943.35) < 0.01), run.trades.map(t => [hm(t.signalTime), t.rule]));
check("one Buy PE on the 11:50 candle at that level, not two", at.filter(t => Math.abs(t.L - 25943.35) < 0.01).length === 1, at.map(t => [t.rule, t.L, t.parallel]));
check("every parallel call is a break no other call stands on", extra.every((t, i) => !all.some((u, j) => u !== t && !(u.parallel && j > run.trades.length + i) && u.side === t.side && u.signalTime === t.signalTime && Math.abs(u.L - t.L) < 0.005 && (!u.parallel || all.indexOf(u) < all.indexOf(t)))), extra.map(t => [hm(t.signalTime), t.rule, t.L]));
process.exit(bad ? 1 : 0);
