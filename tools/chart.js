// The day's picture (rebuilt 20 Nov): node vpday/chart.js <date>  -> vpday/vp-day-<date>.png  (NIFTY 50, levels and shape periods from day-<date>.json)
const fs = require("fs"), { chromium } = require("playwright"), S = require("path").resolve(__dirname, ".."), D = process.argv[2];
const o = JSON.parse(fs.readFileSync(`${__dirname}/day-${D}.json`)), ix = o.indices["NIFTY 50"], bars = JSON.parse(fs.readFileSync(`${S}/sessall/${D}.json`)).indices["NIFTY 50"].candles["5m"];
const hm = t => new Date((t + 19800) * 1000).toISOString().slice(11, 16), NAMES = { Double: "Double Zone", B: "b" };
const marks = ix.periods.map(p => ({ time: bars.find(b => hm(b.time) === p.from).time + 19800, position: "aboveBar", color: "#7b1fa2", shape: "arrowDown", text: NAMES[p.shape] || p.shape }));
const lo = bars.reduce((a, b) => b.low < a.low ? b : a); marks.push({ time: lo.time + 19800, position: "belowBar", color: "#0a9f7c", shape: "circle", text: "day's low " + Math.round(lo.low).toLocaleString("en-IN") });
const dm = (s) => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }), P = dm(o.previousDay);
const lines = [["Today's VAH (close)", ix.final.vah, "#1565c0", 2], ["Today's POC (close)", ix.final.poc, "#d81b60", 0], ["Today's VAL (close)", ix.final.val, "#1565c0", 2], [`Prev day VAH (${P})`, ix.prev.vah, "#616161", 1], [`Prev day POC (${P})`, ix.prev.poc, "#e91e63", 1], [`Prev day VAL (${P})`, ix.prev.val, "#616161", 1]];
const title = `NIFTY 50, ${dm(D)} 2026, 5-minute candles: yesterday's and today's volume levels, and the shape as it changed (a replay, not a screen recording)`;
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;font-family:-apple-system,Helvetica,Arial,sans-serif;background:#fff}h1{font-size:15px;font-weight:600;margin:10px 12px 6px}#c{width:1500px;height:750px}</style><h1>${title}</h1><div id="c"></div>
<script src="file://${S}/swingtree/static/vendor/lightweight-charts.js"></script><script>
const L=LightweightCharts,ch=L.createChart(document.getElementById("c"),{layout:{background:{color:"#fff"},textColor:"#222",fontSize:12},grid:{vertLines:{color:"#e6e6e6"},horzLines:{color:"#e6e6e6"}},timeScale:{timeVisible:true,secondsVisible:false},rightPriceScale:{scaleMargins:{top:0.08,bottom:0.08}}});
const s=ch.addSeries(L.CandlestickSeries,{upColor:"#0a9f7c",downColor:"#f23645",borderVisible:false,wickUpColor:"#0a9f7c",wickDownColor:"#f23645",priceLineVisible:true});
s.setData(${JSON.stringify(bars.map(b => ({ time: b.time + 19800, open: b.open, high: b.high, low: b.low, close: b.close })))});
for(const [t,p,c,st] of ${JSON.stringify(lines)}) s.createPriceLine({price:p,color:c,lineWidth:st===0?2:1,lineStyle:st,axisLabelVisible:true,title:t});
L.createSeriesMarkers(s,${JSON.stringify(marks.sort((a, b) => a.time - b.time))});ch.timeScale().fitContent();</script>`;
fs.writeFileSync(__dirname + "/chart-run.html", html);
(async () => { const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] }); const p = await b.newPage({ viewport: { width: 1500, height: 800 }, deviceScaleFactor: 2 }); await p.goto("file://" + __dirname + "/chart-run.html"); await p.waitForTimeout(1200); await p.screenshot({ path: `${__dirname}/vp-day-${D}.png` }); await b.close(); })();
