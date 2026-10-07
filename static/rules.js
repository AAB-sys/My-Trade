// The owner's rules (LOGIC.md, layers 1 to 3) as plain functions, with no page state in them, so the index
// page and the study page run one and the same rule. Nothing here comes from another product.
(function (root) {
  const IST_OFFSET = 19800;                       // IST is 5h30 ahead of the epoch's clock
  const SESSION_END = 15 * 3600 + 30 * 60;        // 3:30 pm IST, in seconds since midnight
  const SESSION_START = 9 * 3600 + 15 * 60;       // 9:15 am IST
  // ---- Layer 1: Fibonacci levels of one move. A move runs between a low and a high; the levels sit
  // part-way back along it at fixed fractions: measured down from the high for a move that went up, up from
  // the low for one that went down.
  const RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const round2 = (x) => Math.round(x * 100) / 100;
  const dayOf = (t) => Math.floor((t + IST_OFFSET) / 86400);                                  // the IST day number of a time
  const dayOver = (day, now) => { const n = now + IST_OFFSET; return day < Math.floor(n / 86400) || n % 86400 >= SESSION_END; };
  // when a candle closes: its size on, but never past 3:30 pm of its day (the day's last 30-minute candle is a
  // half one, and a day candle ends at the close)
  const endOf = (b, seconds) => Math.min(b.time + seconds, dayOf(b.time) * 86400 - IST_OFFSET + SESSION_END);
  const sessionShare = (t) => Math.min(1, Math.max(0, ((t + IST_OFFSET) % 86400 - SESSION_START) / (SESSION_END - SESSION_START)));  // 0 at the open, 1 at the close

  function levelsOf(m) {  // m: {high, low, up}; the levels, sorted by price
    const span = m.high - m.low;
    return RATIOS.map(r => ({ ratio: r, price: round2(m.up ? m.high - r * span : m.low + r * span) })).sort((a, b) => a.price - b.price);
  }
  function moveOf(bars) {  // "today so far": a session's own low to high, an up move when its last close is above its open
    if (!bars.length) return null;
    return { high: Math.max(...bars.map(b => b.high)), low: Math.min(...bars.map(b => b.low)), up: bars[bars.length - 1].close >= bars[0].open };
  }
  function moveOfDay(d) {  // "previous day": only the day's four figures are known, so it is an up move when it closed above its open
    return d ? { high: d.high, low: d.low, up: d.close >= d.open } : null;
  }

  // ---- Layer 2, the judgement, inside layer 3's signal: a closed candle HELD a level (reached it and closed
  // back on the side it came from) or CROSSED one (closed on the other side of it from the previous close).
  // When one candle signals at several levels the one nearest its close counts: one candle, one call. A level
  // that has given a call in a direction gives no more that way until the index closes back across it (used).
  function signalAt(bar, prev, levels, used, signal) {
    const crossed = L => (prev < L && bar.close > L) || (prev > L && bar.close < L);
    const held = L => !crossed(L) && ((prev > L && bar.low <= L && bar.close > L) || (prev < L && bar.high >= L && bar.close < L));
    const hits = levels.filter(l => {
      const kind = crossed(l.price) ? "crossed" : held(l.price) ? "held" : null;
      return kind && (signal === "both" || signal === kind) && !used[l.ratio + (bar.close > l.price ? "CE" : "PE")];
    });
    if (!hits.length) return null;
    const at = hits.reduce((a, b) => Math.abs(b.price - bar.close) < Math.abs(a.price - bar.close) ? b : a);
    const kind = crossed(at.price) ? "crossed" : "held";
    const side = bar.close > at.price ? "CE" : "PE";
    const next = side === "CE" ? levels.find(l => l.price > at.price) : levels.slice().reverse().find(l => l.price < at.price);
    if (!next) return null;  // a signal pointing outward from the 0% or 100% level has no next level
    return { signalTime: bar.time, level: at.price, ratio: at.ratio, kind, side, target: next.price, close: bar.close,
             range: round2(bar.high - bar.low), entry: null, exit: null, points: null, how: "pending" };
  }

  // ---- Layer 3: the paper calls the rule gives on a list of candles.
  //   bars       the session's candles, oldest first (several days together are allowed: a new day ends the old day's calls)
  //   levelsAt   (i) => the levels in force when bars[i] closes, sorted by price; a constant list for levels that do not move
  //   now        the server's clock: candles that have closed by it are judged, the one forming now runs the open calls
  //   seconds    the size of one candle; dayCandles: a day is one candle, so no day end; signal: "held", "crossed" or "both"
  //   the call   given the moment the signal candle closes; entry at the open of the next candle; target the next level in the
  //              call's direction, reached tick by tick (the forming candle counts); no stop; a call still open at the day's last
  //              candle ends at its close; every signal gives a call, open calls or not
  //   ideas      the ideas under test (LOGIC.md, layer 5), each off unless asked for; the index page never asks, so its calls
  //              are untouched: closeAt (seconds since midnight IST: every open call ends at the close of the first candle
  //              closing at or after it, and no call opens after it), noNewAfter (a signal candle closing after it gives no call)
  function paperTrades({ bars, levelsAt, now, seconds, dayCandles, signal, ideas }) {
    const closeAt = ideas && ideas.closeAt, noNewAfter = ideas && ideas.noNewAfter;
    const clockEnd = (b) => (b.time + IST_OFFSET) % 86400 + seconds;  // when the candle closes, in seconds since midnight IST
    const closed = bars.filter(b => endOf(b, seconds) <= now);
    const forming = bars.length > closed.length ? bars[closed.length] : null;  // the candle forming now, built from the ticks
    const gain = (t, price) => round2(t.side === "CE" ? price - t.entry : t.entry - price);  // index points
    const end = (t, price, bar, how) => { t.exit = price; t.exitTime = bar.time; t.how = how; t.points = gain(t, price); };
    const reaches = (t, bar) => t.side === "CE" ? bar.high >= t.target : bar.low <= t.target;
    const newDay = (a, b) => !dayCandles && dayOf(a.time) !== dayOf(b.time);
    const trades = [];
    const used = {};  // level ratio + side -> true while that level has given a call that way
    let ready = null, open = [];
    for (let i = 1; i < closed.length; i++) {
      const bar = closed[i], prevBar = closed[i - 1];
      if (newDay(bar, prevBar)) {  // a new day: yesterday's calls ended with yesterday
        open.forEach(t => end(t, prevBar.close, prevBar, "day end")); open = [];
        ready = null;  // a signal on a day's last candle has no candle left to enter on
      }
      if (ready) { const t = { ...ready, entry: bar.open, entryTime: bar.time, how: "open" }; trades.push(t); open.push(t); ready = null; }
      open = open.filter(t => { if (reaches(t, bar)) { end(t, t.target, bar, "target"); return false; } return true; });
      if (closeAt && !dayCandles && clockEnd(bar) >= closeAt) { open.forEach(t => end(t, bar.close, bar, "time")); open = []; }  // idea P1: the clock ends the open calls
      const levels = levelsAt(i);
      levels.forEach(l => { if (bar.close < l.price) used[l.ratio + "CE"] = false; if (bar.close > l.price) used[l.ratio + "PE"] = false; });  // closed back across: the level may call again
      const sig = signalAt(bar, prevBar.close, levels, used, signal);  // the call, at the signal candle's close
      const late = !dayCandles && ((noNewAfter && clockEnd(bar) > noNewAfter) || (closeAt && clockEnd(bar) >= closeAt));  // ideas P2 and P1: too late in the day for a new call
      if (sig && !late) { ready = sig; used[sig.ratio + sig.side] = true; }
    }
    const last = closed[closed.length - 1];
    const over = dayCandles ? false : last ? dayOver(dayOf(last.time), now) : true;  // day candles: no day end
    if (forming && last && !over && !newDay(forming, last)) {  // the candle forming now: a call enters at its open, and open calls run on its live price
      if (ready) { const t = { ...ready, entry: forming.open, entryTime: forming.time, how: "open" }; trades.push(t); open.push(t); ready = null; }
      open = open.filter(t => { if (reaches(t, forming)) { end(t, t.target, forming, "target"); return false; } return true; });
      open.forEach(t => { t.points = gain(t, forming.close); t.last = forming.close; });  // last: the price the open call's points are at
    } else {
      open.forEach(t => { if (over) end(t, last.close, last, "day end"); else { t.points = gain(t, last.close); t.last = last.close; } });
    }
    if (ready && !over) trades.push(ready);  // the next candle has not begun yet (a second or two): "Enters at the next open"
    return { trades, closed: closed.length };
  }

  // A finished day replayed: every candle has closed, so the clock is set past the day's end. "Previous day" levels
  // stand still; "today so far" levels are the ones the page had drawn when each candle closed, the day's range up
  // to that candle (the live page redraws them with every new high or low)
  function replayDay({ bars, move, previous, seconds, signal, ideas }) {
    const fixed = move === "prev" ? (previous ? levelsOf(moveOfDay(previous)) : null) : null;
    if (move === "prev" && !fixed) return { trades: [], closed: 0 };
    const levelsAt = move === "prev" ? () => fixed : (i) => levelsOf(moveOf(bars.slice(0, i + 1)));
    return paperTrades({ bars, levelsAt, now: Number.POSITIVE_INFINITY, seconds, dayCandles: false, signal, ideas });
  }
  // The ideas under test (LOGIC.md, layer 5): proposed by Claude from the saved candles, confirmed by the owner for the study
  // page only on 6 October. The index page does not know them.
  const IDEAS = {
    P1: { key: "P1", name: "Close open calls at 15:00", ideas: { closeAt: 15 * 3600 } },
    P2: { key: "P2", name: "No new calls after 14:00", ideas: { noNewAfter: 14 * 3600 } },
  };
  const ideasOf = (keys) => Object.assign({}, ...keys.map(k => IDEAS[k].ideas));

  // ---- Layer 4, the study: plain facts about a day's candles (LOGIC.md). Candles only: no premiums anywhere here.
  function breakOf(bars, line, dir) {  // the first candle closing beyond a line (up: above it; down: below it), and what the day did after it
    const i = bars.findIndex(b => dir === "up" ? b.close > line : b.close < line);
    if (i < 0) return null;
    const at = bars[i], rest = bars.slice(i + 1), close = bars[bars.length - 1].close;
    const further = rest.length ? (dir === "up" ? Math.max(...rest.map(b => b.high)) - at.close : at.close - Math.min(...rest.map(b => b.low))) : 0;
    const back = rest.find(b => dir === "up" ? b.close <= line : b.close >= line);  // closed back on the other side again
    return { time: at.time, close: at.close, toClose: round2(dir === "up" ? close - at.close : at.close - close), further: round2(Math.max(0, further)), backAt: back ? back.time : null };
  }
  function dayFacts(bars, previous) {  // one day's shape: gap at the open, open to close, range, when the high and the low came, breaks of the previous day's high and low
    if (!bars.length) return null;
    const open = bars[0].open, close = bars[bars.length - 1].close;
    let hi = 0, lo = 0;
    bars.forEach((b, i) => { if (b.high > bars[hi].high) hi = i; if (b.low < bars[lo].low) lo = i; });
    const high = bars[hi].high, low = bars[lo].low, range = round2(high - low);
    const facts = { open, high, low, close, range, up: close >= open, change: round2(close - open), highAt: bars[hi].time, lowAt: bars[lo].time,
                    closeInRange: range ? Math.round((close - low) / range * 100) : null, gap: null, gapPct: null, aboveHigh: null, belowLow: null };
    if (previous) {
      facts.gap = round2(open - previous.close);
      facts.gapPct = Math.round(facts.gap / previous.close * 10000) / 100;
      facts.aboveHigh = breakOf(bars, previous.high, "up");
      facts.belowLow = breakOf(bars, previous.low, "down");
    }
    return facts;
  }
  function candleBreaks(bars) {  // a candle closing above the previous candle's high (or below its low), and whether the next candle went on that way
    const out = { up: 0, upWentOn: 0, upJudged: 0, down: 0, downWentOn: 0, downJudged: 0 };
    for (let i = 1; i < bars.length; i++) {
      const b = bars[i], p = bars[i - 1], n = bars[i + 1];
      if (b.close > p.high) { out.up++; if (n) { out.upJudged++; if (n.close > b.close) out.upWentOn++; } }
      if (b.close < p.low) { out.down++; if (n) { out.downJudged++; if (n.close < b.close) out.downWentOn++; } }
    }
    return out;
  }
  function levelBehaviour(bars, levelsAt) {  // per level ratio, over every judged candle: touched, held, crossed, and whether the price then reached the next level before closing back across
    const out = {};
    RATIOS.forEach(r => out[r] = { touched: 0, held: 0, crossed: 0, heldJudged: 0, heldOn: 0, crossedJudged: 0, crossedOn: 0 });
    for (let i = 1; i < bars.length; i++) {
      const bar = bars[i], prev = bars[i - 1].close, levels = levelsAt(i);
      levels.forEach((l, k) => {
        const L = l.price, row = out[l.ratio];
        if (bar.low <= L && bar.high >= L) row.touched++;
        const crossed = (prev < L && bar.close > L) || (prev > L && bar.close < L);
        const held = !crossed && ((prev > L && bar.low <= L && bar.close > L) || (prev < L && bar.high >= L && bar.close < L));
        if (!crossed && !held) return;
        row[crossed ? "crossed" : "held"]++;
        const upward = bar.close > L;  // the way the price left the level: a bounce up or a break up, else down
        const next = upward ? levels[k + 1] : levels[k - 1];
        if (!next) return;
        row[crossed ? "crossedJudged" : "heldJudged"]++;
        for (let j = i + 1; j < bars.length; j++) {
          const c = bars[j];
          if (upward ? c.high >= next.price : c.low <= next.price) { row[crossed ? "crossedOn" : "heldOn"]++; break; }
          if (upward ? c.close < L : c.close > L) break;  // closed back across first
        }
      });
    }
    return out;
  }

  root.Rules = { RATIOS, IST_OFFSET, SESSION_END, SESSION_START, round2, dayOf, dayOver, endOf, sessionShare, levelsOf, moveOf, moveOfDay, signalAt, paperTrades, replayDay,
                 breakOf, dayFacts, candleBreaks, levelBehaviour, IDEAS, ideasOf };
})(typeof window !== "undefined" ? window : globalThis);
