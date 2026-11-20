// the 2-year NIFTY 50 5-minute file + the saved sessions after it -> strat/all5m.csv (rebuilt 20 Nov)
const fs = require("fs"), S = require("path").resolve(__dirname, "..");
const rows = fs.readFileSync(__dirname + "/hist5m.csv", "utf8").trim().split("\n"), head = rows[0], have = new Set(rows.slice(1).map(r => r.slice(0, 10)));
const hm = t => new Date((t + 19800) * 1000).toISOString().slice(11, 16); let add = 0;
for (const f of fs.readdirSync(S + "/sessall").filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()) { const d = f.slice(0, 10); if (have.has(d)) continue; const j = JSON.parse(fs.readFileSync(`${S}/sessall/${f}`)); if (!j.complete) continue;
  for (const b of j.indices["NIFTY 50"].candles["5m"]) rows.push([d, hm(b.time), b.open, b.high, b.low, b.close].join(",")); add++; }
fs.writeFileSync(__dirname + "/all5m.csv", rows.join("\n") + "\n"); console.log(`all5m.csv: ${rows.length - 1} candles, last day ${rows[rows.length - 1].slice(0, 10)}, ${add} saved days added`);
