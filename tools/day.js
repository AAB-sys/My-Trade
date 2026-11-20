// The Volume Profile day, replayed with the page's own code (rebuilt 20 Nov): node vpday/day.js <date>
// -> vpday/day-<date>.json (all three indices) and a text summary on stdout. Levels: the chart's (levels.js). Calls: vpshape.js calls / shapeCalls.
"use strict";
const fs = require("fs"), S = require("path").resolve(__dirname, ".."), { R, V } = require(__dirname + "/levels.js"), D = process.argv[2], hm = V.hm, r2 = x => Math.round(x * 100) / 100;
const sess = JSON.parse(fs.readFileSync(`${S}/sessall/${D}.json`)), prevF = fs.readdirSync(S + "/sessall").filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f < D + ".json").sort().pop(), PD = JSON.parse(fs.readFileSync(`${S}/sessall/${prevF}`)), out = { date: D, previousDay: prevF.slice(0, 10), indices: {} };
for (const [name, ix] of Object.entries(sess.indices)) { const m = ix.candles["1m"], f = ix.candles["5m"], W = new Map(ix.volume["1m"]), q = R(m, W), pi = PD.indices[name], y = R(pi.candles["1m"], new Map(pi.volume["1m"]));
  const periods = []; let noon = null; const where = (px, e) => px > e.vah ? "above VAH" : px < e.val ? "below VAL" : px >= e.poc ? "POC-VAH" : "VAL-POC";
  for (let k = 5; k < f.length; k++) { const e = R(m.filter(x => x.time < f[k].time + 300), W); if (!e) continue; const last = periods[periods.length - 1], w = where(f[k].close, e);
    if (!last || last.shape !== e.shape) periods.push({ shape: e.shape, from: hm(f[k].time), to: hm(f[k].time), candles: 1, where: { [w]: 1 }, poc0: r2(e.poc), poc1: r2(e.poc) }); else { last.to = hm(f[k].time); last.candles++; last.where[w] = (last.where[w] || 0) + 1; last.poc1 = r2(e.poc); }
    if (hm(f[k].time) === "11:55") noon = { shape: e.shape, where: w, close: f[k].close, vah: r2(e.vah), poc: r2(e.poc), val: r2(e.val) }; }
  const ev = { wick: 0, wickBack: 0, close: 0, closeOn: 0 };
  for (let k = 5; k < f.length - 1; k++) { const e = R(m.filter(x => x.time < f[k].time), W); if (!e) continue; const c = f[k], after = f.slice(k + 1, k + 7);
    for (const [edge, dir] of [[e.vah, 1], [e.val, -1]]) { const through = dir > 0 ? c.high > edge && c.open <= edge : c.low < edge && c.open >= edge; if (!through) continue; const beyond = dir > 0 ? c.close > edge : c.close < edge;
      const back = Math.max(...after.map(x => dir * (edge - (dir > 0 ? x.low : x.high)))), on = Math.max(...after.map(x => dir * ((dir > 0 ? x.high : x.low) - edge))), size = (e.vah - e.val) * 0.25;
      if (beyond) { ev.close++; if (on >= size && !(back >= size && after.findIndex(x => dir * (edge - (dir > 0 ? x.low : x.high)) >= size) < after.findIndex(x => dir * ((dir > 0 ? x.high : x.low) - edge) >= size))) ev.closeOn++; } else { ev.wick++; if (back >= size) ev.wickBack++; } } }
  const sc = t => ({ side: t.side, setup: t.setup || null, signal: hm(t.signalTime), entryAt: hm(t.entryTime), entry: t.entry, stop: r2(t.stop), how: t.how, exitAt: t.exitTime ? hm(t.exitTime) : null, exit: t.exit != null ? r2(t.exit) : null, points: t.points != null ? r2(t.points) : null });
  const brk = V.calls(f, f.length, m, W).map(sc), shp = V.shapeCalls(f, f.length, m, W).map(sc), vp = (a, e) => a.filter(x => x.close > e.vah).length;
  const mins = { above: m.filter(x => x.close > y.vah).length, inside: m.filter(x => x.close <= y.vah && x.close >= y.val).length, below: m.filter(x => x.close < y.val).length };
  out.indices[name] = { day: ix.day, final: { shape: q.shape, poc: r2(q.poc), vah: r2(q.vah), val: r2(q.val) }, prev: { vah: r2(y.vah), poc: r2(y.poc), val: r2(y.val) }, openVsPrev: ix.day.open > y.vah ? "above yesterday's value" : ix.day.open < y.val ? "below yesterday's value" : "inside yesterday's value", closeVsToday: where(ix.day.close, q), minutesVsPrevValue: mins, noon, periods, edges: ev, breakCalls: brk, shapeCalls: shp };
  console.log(`\n== ${name}: open ${ix.day.open} (${out.indices[name].openVsPrev}) low ${ix.day.low} high ${ix.day.high} close ${ix.day.close} (${out.indices[name].closeVsToday})`);
  console.log(`   today VAL/POC/VAH ${r2(q.val)} / ${r2(q.poc)} / ${r2(q.vah)} shape ${q.shape}; yesterday ${r2(y.val)} / ${r2(y.poc)} / ${r2(y.vah)}; minutes vs yesterday's value ${JSON.stringify(mins)}`);
  console.log(`   noon: ${JSON.stringify(noon)}`); for (const p of periods) console.log(`   ${p.from}-${p.to} ${p.shape.padEnd(7)} ${p.candles} candles POC ${p.poc0}->${p.poc1} ${JSON.stringify(p.where)}`);
  console.log(`   edges: wicks ${ev.wick} (came back ${ev.wickBack}), closes beyond ${ev.close} (went on ${ev.closeOn})`);
  for (const t of brk) console.log(`   BREAK ${t.side} ${t.signal} in ${t.entryAt} ${t.entry} ${t.how} ${t.exitAt} ${t.points}`); for (const t of shp) console.log(`   SHAPE ${t.side} ${t.setup} ${t.signal} in ${t.entryAt} ${t.entry} ${t.how} ${t.exitAt} ${t.points}`); }
fs.writeFileSync(`${__dirname}/day-${D}.json`, JSON.stringify(out, null, 1));
