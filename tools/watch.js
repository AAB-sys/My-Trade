// VP intraday watch (rebuilt 20 Nov after the work folder was lost): node vpday/watch.js <date>  -> appends a block to vpday/watch-<date>.md
// Levels are the chart's (levels.js: volprofile.js rows, vpshape.js shape) on the day's 1-minute candles with the futures volume.
"use strict";
const fs = require("fs"), S = require("path").resolve(__dirname, ".."), { R, V } = require(__dirname + "/levels.js");
const D = process.argv[2], sess = JSON.parse(fs.readFileSync(`${S}/sessall/${D}.json`)), hm = V.hm, r0 = (x) => Math.round(x);
const days = fs.readdirSync(S + "/sessall").filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f < D + ".json").sort(), PD = days.length ? JSON.parse(fs.readFileSync(`${S}/sessall/${days[days.length - 1]}`)) : null;
const stateF = `${__dirname}/watch-${D}.json`, last = fs.existsSync(stateF) ? JSON.parse(fs.readFileSync(stateF)) : {}, now = {};
const lv = (ix, n) => { const m = ix.candles["1m"], W = new Map(ix.volume["1m"]); return R(n ? m.slice(0, n) : m, W); };
let out = `\n## Look at ${new Date(Date.now() + 19800e3).toISOString().slice(11, 16)} IST\n`;
for (const [name, ix] of Object.entries(sess.indices)) {
  const m = ix.candles["1m"], f = ix.candles["5m"], W = new Map(ix.volume["1m"]), q = R(m, W), px = m[m.length - 1].close, y = PD && PD.indices[name] ? lv(PD.indices[name]) : null, p = last[name];
  const mv = (k) => p ? ` (${q[k] > p[k] + 0.5 ? "up " + r0(q[k] - p[k]) : q[k] < p[k] - 0.5 ? "down " + r0(p[k] - q[k]) : "same"})` : "";
  const where = px > q.vah ? "above VAH" : px < q.val ? "below VAL" : px >= q.poc ? "between POC and VAH" : "between VAL and POC";
  out += `\n### ${name}, up to ${hm(m[m.length - 1].time)}\n- Shape: ${q.shape}${p && p.shape !== q.shape ? ` (was ${p.shape})` : ""}. POC ${r0(q.poc)}${mv("poc")}, VAH ${r0(q.vah)}${mv("vah")}, VAL ${r0(q.val)}${mv("val")}. Day ${r0(Math.min(...m.map(x => x.low)))} to ${r0(Math.max(...m.map(x => x.high)))}.\n- Price ${r0(px)}: ${where}.\n`;
  if (y) out += `- Against yesterday (VAH ${r0(y.vah)} POC ${r0(y.poc)} VAL ${r0(y.val)}): ${q.val > y.vah ? "value area ABOVE yesterday's" : q.vah < y.val ? "value area BELOW yesterday's" : "overlapping yesterday's"}${q.poc > y.vah ? ", POC above it" : q.poc < y.val ? ", POC below it" : ""}.\n`;
  out += `- Edge events since the last look:\n`; const since = p ? p.t : 0;
  for (let k = 3; k < f.length; k++) { const c = f[k]; if (c.time <= since) continue; const n = m.findIndex(x => x.time >= c.time), e = n > 15 ? R(m.slice(0, n), W) : null; if (!e) continue;
    const after = f.slice(k + 1, k + 7), fut = (edge, dir) => after.length ? `; next 30 min: ${r0(Math.max(...after.map(x => dir * (edge - (dir > 0 ? x.low : x.high)))))} back inside, ${r0(Math.max(...after.map(x => dir * ((dir > 0 ? x.high : x.low) - edge))))} beyond` : "";
    if (c.high > e.vah && c.open <= e.vah) out += `  - ${hm(c.time)} VAH ${r0(e.vah)}: ${c.close > e.vah ? "CLOSED BEYOND" : "wick, closed back inside"}${fut(e.vah, 1)}\n`;
    if (c.low < e.val && c.open >= e.val) out += `  - ${hm(c.time)} VAL ${r0(e.val)}: ${c.close < e.val ? "CLOSED BEYOND" : "wick, closed back inside"}${fut(e.val, -1)}\n`;
    if (y) for (const [nm, L] of [["VAH", y.vah], ["POC", y.poc], ["VAL", y.val]]) if (c.low <= L && c.high >= L) out += `  - ${hm(c.time)} touched yesterday's ${nm} ${r0(L)}, closed ${c.close > L ? "above" : "below"}\n`; }
  now[name] = { poc: q.poc, vah: q.vah, val: q.val, shape: q.shape, t: f[f.length - 1].time };
}
fs.appendFileSync(`${__dirname}/watch-${D}.md`, out); fs.writeFileSync(stateF, JSON.stringify(now)); process.stdout.write(out);
