// The ULTROAN shadow page's rules (static/shadow.js) against the lab engine's own answers, kept in lab/shadow-fixture.json:
// every call of the four watched strategies on seven sessions, the same entry time, side, entry price and points.
// Also: a day cut at 12:42 shows the call open, and only closed candles give a signal.  node lab/check_shadow.js
"use strict";
const Sh = require("../static/shadow.js"), F = require("./shadow-fixture.json"); let ok = 0, bad = 0;
const check = (name, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { bad++; console.log("FAIL", name, "\n  want", JSON.stringify(b), "\n  got ", JSON.stringify(a)); } };
const candles = F.candles.map(([time, open, high, low, close]) => ({ time, open, high, low, close })), days = F.days.map(([date, high, low, close]) => ({ date, high, low, close }));
const r = Sh.run(candles, days, null);
check("days", r.days.map(d => d.date), Object.keys(F.expect));
for (const d of r.days) for (const st of Sh.LIST) check(`${d.date} ${st.id}`, d.calls[st.id].map(c => `${c.entryHm} ${c.side} ${c.entry} ${c.points.toFixed(2)}`), F.expect[d.date][st.id]);
// the daily list alone must not change an answer when it also holds the window's days (the server sends both)
const more = days.concat(r.days.map(d => ({ date: d.date, high: 0, low: 0, close: 0 })));
check("the candles' own days win over the daily list", Sh.run(candles, more, null).days.map(d => d.calls), r.days.map(d => d.calls));
// live: 23 Nov cut at 12:42 -> NEWHIGH-TREND's PE of 10:55 is open, with points now; the forming candle gives no signal
const last = r.days[r.days.length - 1].date, lim = Date.parse(last + "T12:42:30+05:30") / 1000, live = Sh.run(candles.filter(c => c.time <= lim), days, lim).days.pop();
check("live: closed candles", live.closed, 41);
check("live: open call", live.calls["NEWHIGH-TREND"].map(c => [c.entryHm, c.side, c.how, c.points, c.now > 0]), [["10:55", "PE", "open", null, true]]);
const early = Date.parse(last + "T10:52:00+05:30") / 1000, e2 = Sh.run(candles.filter(c => c.time <= early), days, early).days.pop();
check("live: no call before the signal candle has closed", e2.calls["NEWHIGH-TREND"].length, 0);
check("the list is the watch list", Sh.LIST.map(s => [s.id, s.found, JSON.stringify(s.o)]), [["NEWHIGH-TREND", "2026-11-13", '{"n":12,"trail":5,"max":3,"trend":1,"from":"09:45"}'], ["QUIET-BREAK", "2026-11-13", '{"small":0.8,"min":15,"rr":0,"stopAt":"far"}'], ["DIR-1215", "2026-11-13", '{"at":"12:15","move":0.3,"stop":0.25,"gapWith":1}'], ["NEWHIGH-STAY", "2026-11-19", '{"n":12,"trail":5,"max":3,"trend":1,"from":"09:45","f":"stay"}']]);
console.log(`${ok} checks passed, ${bad} failed`); process.exit(bad ? 1 : 0);
