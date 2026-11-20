const fs = require("fs"), S = "/tmp/claude-0/-home-user-Delta/3a78b64f-a132-5d21-ae3b-acf430fd972c/scratchpad", D = S + "/sessall/";
global.window = global; require(S + "/swingtree/static/newrule.js"); require(S + "/swingtree/static/morepat.js"); const NR = globalThis.NewRule;
const hm = (t) => new Date((t + 19800) * 1000).toISOString().slice(11, 16);
const files = fs.readdirSync(D).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const DAY = process.argv[2]; const today = JSON.parse(fs.readFileSync(D + DAY + ".json")); const prev = files.filter(f => f < DAY + ".json").slice(-4).map(f => JSON.parse(fs.readFileSync(D + f)));
console.log("saved_at", today.saved_at);
for (const [n, ix] of Object.entries(today.indices)) { const c = ix.candles["5m"], v = (ix.volume || {})["1m"] || []; console.log(n, "5m", c.length, "last", hm(c[c.length - 1].time), "volume minutes", v.length); }
const before = prev.flatMap(p => p.indices["NIFTY 50"] ? p.indices["NIFTY 50"].candles["5m"] : []);
const atrSeed = before.length >= 14 ? NR.atrSeries(before).slice(-1)[0] : null;
const bars = today.indices["NIFTY 50"].candles["5m"];
const out = NR.runDay({ bars, index: "NIFTY 50", prevBars: before, atrSeed, closedCount: bars.length, dayEnd: false });
console.log("runDay ok: trades", out.trades.length, "dbLog", out.dbLog ? "present" : "MISSING");
