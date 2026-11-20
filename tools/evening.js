// Calls with Signals for the day, each index, main's newrule.js with morepat.js (rebuilt 20 Nov): node wf/evening.js <date>
const fs = require("fs"), S = require("path").resolve(__dirname, ".."), D = process.argv[2]; global.window = global; require(S + "/swingtree/static/newrule.js"); require(S + "/swingtree/static/morepat.js"); const N = globalThis.NewRule;
const hm = t => new Date((t + 19800) * 1000).toISOString().slice(11, 16), files = fs.readdirSync(S + "/sessall").filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort(), rd = f => JSON.parse(fs.readFileSync(S + "/sessall/" + f));
const today = rd(D + ".json"), prev = files.filter(f => f < D + ".json").slice(-4).map(rd), out = { signals: {} };
for (const index of Object.keys(today.indices)) { const bars = today.indices[index].candles["5m"], before = prev.flatMap(p => p.indices[index] ? p.indices[index].candles["5m"] : []), seed = before.length >= 14 ? N.atrSeries(before).slice(-1)[0] : null;
  const r = N.runDay({ bars, index, prevBars: before, atrSeed: seed, closedCount: bars.length, dayEnd: true }), t = r.trades;
  out.signals[index] = { calls: t.length, won: t.filter(x => x.points > 0).length, pts: Math.round(t.reduce((a, x) => a + (x.points || 0), 0) * 100) / 100, list: t.map(x => `${hm(x.signalTime)} ${x.more ? x.kind : x.rule} ${x.side} ${x.how} ${x.points}`) };
  if (index === "NIFTY 50" && r.dbLog) out.db = r.dbLog.summary || null; }
console.log(JSON.stringify(out, null, 1));
