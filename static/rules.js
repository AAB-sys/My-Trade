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
  // "Today so far" (owner's decision, 8 October afternoon): candle i is judged against the lines as they stood when it began,
  // the day's range up to the candle before it (the day's first candle: its own). A candle that makes a new low can no
  // longer "hold" the 0% line it draws itself (on 8 October 18 of NIFTY 50's 23 calls were such holds, Buy CE after Buy CE
  // all the way down). The seven Fibonacci lines only (owner's decision, 8 October evening: "all the charts always work on
  // the Fibonacci basic 7 levels only"); the extra line beyond each end of that afternoon is gone, so a close beyond the
  // day's earlier low or high is outward from the last line and gives no call, as before that afternoon.
  const todayLevelsAt = (bars) => (i) => levelsOf(moveOf(bars.slice(0, Math.max(1, i))));
  // The lines the chart draws while candle i forms (owner's decision, 8 October evening: when the price breaks the 0% or 100%
  // line, the 7 lines are worked out again at once from the live price): the day's range up to and with candle i. A call's
  // target follows these, so the target is always a line on the chart; the signal is still judged by todayLevelsAt
  const todayLinesAt = (bars) => (i) => levelsOf(moveOf(bars.slice(0, i + 1)));
  function moveOfDay(d) {  // "previous day": only the day's four figures are known, so it is an up move when it closed above its open
    return d ? { high: d.high, low: d.low, up: d.close >= d.open } : null;
  }

  // ---- Layer 2, the judgement, inside layer 3's signal: a closed candle HELD a level (reached it and closed
  // back on the side it came from) or CROSSED one (closed on the other side of it from the previous close).
  // When one candle signals at several levels the one nearest its close counts: one candle, one call. A level
  // that has given a call in a direction gives no more that way until the index closes back across it (used). The
  // level is the line at its price (8 October): with "today so far" levels a ratio's line moves as the day's range grows,
  // and a line at a new price is a new level. Until then the memory was kept by the ratio's name, so the 0% hold at 09:20
  // blocked every later hold of the day's low that day, at lines up to 186 points lower, and could never be released
  // (no close goes below the day's own low). With the previous day's levels the lines never move: nothing changes there.
  function signalAt(bar, prev, levels, used, signal) {
    const crossed = L => (prev < L && bar.close > L) || (prev > L && bar.close < L);
    const held = L => !crossed(L) && ((prev > L && bar.low <= L && bar.close > L) || (prev < L && bar.high >= L && bar.close < L));
    const hits = levels.filter(l => {
      const kind = crossed(l.price) ? "crossed" : held(l.price) ? "held" : null;
      return kind && (signal === "both" || signal === kind) && !used[l.price + "|" + (bar.close > l.price ? "CE" : "PE")];
    });
    if (!hits.length) return null;
    const at = hits.reduce((a, b) => Math.abs(b.price - bar.close) < Math.abs(a.price - bar.close) ? b : a);
    const kind = crossed(at.price) ? "crossed" : "held";
    const side = bar.close > at.price ? "CE" : "PE";
    const next = side === "CE" ? levels.find(l => l.price > at.price) : levels.slice().reverse().find(l => l.price < at.price);
    if (!next) return null;  // a signal pointing outward from the 0% or 100% level has no next level
    return { signalTime: bar.time, level: at.price, ratio: at.ratio, kind, side, target: next.price, close: bar.close,
             range: round2(bar.high - bar.low), entry: null, exit: null, points: null, how: "pending",
             prices: levels.map(l => l.price) };  // the levels in force at the signal, for the entry's check below
  }

  // The entry (owner's decision, 7 October): when the next candle opens already at or past the target (the signal candle
  // itself ran through the next level), the call aims one level further, the first level beyond the entry price; with no
  // level left beyond it, there is no call. Until then such a call "hit" a target below its entry and lost at once.
  function enterAt(sig, bar) {
    let target = sig.target, aimed = null;
    if (sig.side === "CE" ? bar.open >= target : bar.open <= target) {
      const beyond = sig.side === "CE" ? sig.prices.find(p => p > bar.open) : sig.prices.slice().reverse().find(p => p < bar.open);
      if (beyond == null) return null;
      target = beyond; aimed = "beyond";
    }
    const { prices, ...rest } = sig;
    const ladder = sig.side === "CE" ? prices.filter(p => p > target) : prices.filter(p => p < target).reverse();  // the levels beyond the target, nearest first: idea P5 carries the call up them, and the carry read asks about the first
    return { ...rest, target, aimed, ladder, entry: bar.open, entryTime: bar.time, how: "open" };
  }

  // ---- Layer 3: the paper calls the rule gives on a list of candles.
  //   bars       the session's candles, oldest first (several days together are allowed: a new day ends the old day's calls)
  //   levelsAt   (i) => the levels bars[i] is judged against, sorted by price; a constant list for levels that do not move
  //   targetsAt  (i) => the lines a call's target follows while bars[i] forms (the chart's lines); levelsAt when not given
  //   now        the server's clock: candles that have closed by it are judged, the one forming now runs the open calls
  //   seconds    the size of one candle; dayCandles: a day is one candle, so no day end; signal: "held", "crossed" or "both"
  //   the call   given the moment the signal candle closes; entry at the open of the next candle; target the next level in the
  //              call's direction (one level further when the entry is already past it, see enterAt), reached tick by tick (the
  //              forming candle counts); no stop; a call still open at the day's last candle ends at its close; every signal
  //              gives a call, open calls or not
  //   ideas      the ideas under test (LOGIC.md, layer 5), each off unless asked for; the index page never asks, so its calls
  //              are untouched: closeAt (seconds since midnight IST: every open call ends at the close of the first candle
  //              closing at or after it, and no call opens after it), noNewAfter (a signal candle closing after it gives no call),
  //              minDepth (idea P3, 7 October: a crossed signal counts only when its candle closed at least this share of the
  //              way from the level to the next one; a shallower cross gives no call and leaves the level free to call later),
  //              exitBack (idea P4, 7 October, the owner's rule: a closed candle that goes back across the call's level by this
  //              share of the gap to the target ends the call at its close, "candle"; the same measure as readOf's verdict below),
  //              carryOn (idea P5, 7 October: when the candle that reaches the target closes at least this share of the next
  //              gap past it, the call carries on to the level beyond, again and again up the ladder; otherwise it ends at the
  //              target as ever. The decision waits for that candle to close: on the candle forming now the call stays open),
  //              stopShare (ideas P6 and P7, 8 October evening, the owner's question "what to do with a call going wrong": a stop
  //              fixed when the call enters, this share of the distance to its target on the other side of the entry; the call
  //              ends there, "stop". A candle that reached both the stop and the target is settled by the day's one-minute
  //              candles, minutes, when they are given (the first minute to touch either; the stop when one minute touched
  //              both), else the stop is taken first, the careful way)
  //   the target follows the lines (owner's decision, 8 October): at every candle the call's target is the next line beyond
  //              both its entry and the level that gave it, in the call's direction, among the lines as they stand at that
  //              candle (the forming one: as the chart draws them now), and it is reached against that line. With the previous
  //              day's levels the lines never move, so the target is the one set at the entry, as before. With "today so far"
  //              every new low or high moves the lines: until then the target stayed where the line stood at the signal, and the
  //              table showed numbers no line on the chart had any more (12:15 call: 22,385.21 while the 23.6% line read 22,380.55)
  //   holdBreaks the owner's exit rule "Hold Through a Level Break" (8 October night): a call given by a CROSSED signal is held
  //              through its target and sold only (A) at the close of a candle that closes back across the line it broke ("back",
  //              at that close), (B) when a later candle opens beyond the previous close (lower for a PE, higher for a CE) and then
  //              comes back to the open of the signal candle C1, where the break began ("retouch", at that price, tick by tick;
  //              only when C1 opened on the far side of the line), or (C) at the day end. While such a call is held, no new call
  //              that way is given: the same trade continues. Bounce (held) calls keep their target. No idea P4 to P7 on it
  function paperTrades({ bars, levelsAt, targetsAt, now, seconds, dayCandles, signal, ideas, holdBreaks }) {
    const linesAt = targetsAt || levelsAt;
    const closeAt = ideas && ideas.closeAt, noNewAfter = ideas && ideas.noNewAfter, minDepth = ideas && ideas.minDepth, exitBack = ideas && ideas.exitBack;
    const carryOn = ideas && ideas.carryOn != null ? ideas.carryOn : null;
    const stopShare = ideas && ideas.stopShare, minutes = (ideas && ideas.minutes) || null;
    const clockEnd = (b) => (b.time + IST_OFFSET) % 86400 + seconds;  // when the candle closes, in seconds since midnight IST
    const closed = bars.filter(b => endOf(b, seconds) <= now);
    const forming = bars.length > closed.length ? bars[closed.length] : null;  // the candle forming now, built from the ticks
    const gain = (t, price) => round2(t.side === "CE" ? price - t.entry : t.entry - price);  // index points
    const end = (t, price, bar, how) => { t.exit = price; t.exitTime = bar.time; t.how = how; t.points = gain(t, price); };
    const reaches = (t, bar) => t.side === "CE" ? bar.high >= t.target : bar.low <= t.target;
    const follow = (t, levels) => {  // the target on the lines as they stand (and the ladder beyond it, for idea P5, one step further per carry)
      const past = t.side === "CE" ? Math.max(t.entry, t.level) : Math.min(t.entry, t.level);
      const prices = levels.map(l => l.price);
      const beyond = t.side === "CE" ? prices.filter(p => p > past) : prices.filter(p => p < past).reverse();
      const k = t.carried || 0;
      if (beyond.length > k) { t.target = beyond[k]; t.ladder = beyond.slice(k + 1); }  // no line that far out (the entry at the day's high): it stays
    };
    const touchesStop = (t, bar) => t.stop != null && (t.side === "CE" ? bar.low <= t.stop : bar.high >= t.stop);
    const stopFirst = (t, bar) => {  // the candle touched the stop: did the stop come before the target? (ideas P6, P7)
      if (!reaches(t, bar) || !minutes) return true;
      for (const m of minutes) {
        if (m.time < bar.time || m.time >= bar.time + seconds) continue;
        if (touchesStop(t, m)) return true;
        if (reaches(t, m)) return false;
      }
      return true;
    };
    const backAcross = (t, close) => t.side === "CE" ? t.level - close : close - t.level;  // how far a close went back across the call's level, in points
    const retouch = (t, bar, prevClose) => {  // exit B: the candle opened beyond the previous close and came back to C1's open
      const armed = t.side === "PE" ? t.c1Open >= t.level : t.c1Open <= t.level;  // C1 began on the far side of the line it broke
      return armed && (t.side === "PE" ? bar.open < prevClose && bar.high >= t.c1Open : bar.open > prevClose && bar.low <= t.c1Open);
    };
    const settle = (t, bar, prevClose) => {  // the target reached within this closed candle: idea P5 may carry the call on to the level beyond, else it ends at the target
      if (t.hold) {  // a held break: exit B, then exit A at the close; the target does not end it
        if (retouch(t, bar, prevClose)) { end(t, t.c1Open, bar, "retouch"); return false; }
        if (t.side === "PE" ? bar.close > t.level : bar.close < t.level) { end(t, bar.close, bar, "back"); return false; }
        return true;
      }
      while (reaches(t, bar)) {
        const beyond = carryOn != null && t.ladder.length ? t.ladder[0] : null;
        if (beyond != null && (t.side === "CE" ? bar.close - t.target : t.target - bar.close) >= carryOn * Math.abs(beyond - t.target)) {
          t.carried = (t.carried || 0) + 1; t.target = beyond; t.ladder = t.ladder.slice(1); continue;  // and the same candle may have reached the next one too
        }
        end(t, t.target, bar, "target"); return false;
      }
      return true;
    };
    const newDay = (a, b) => !dayCandles && dayOf(a.time) !== dayOf(b.time);
    const trades = [];
    const used = {};  // "price|side" -> { price, side } while the line at that price has given a call that way
    let ready = null, open = [];
    for (let i = 1; i < closed.length; i++) {
      const bar = closed[i], prevBar = closed[i - 1];
      if (newDay(bar, prevBar)) {  // a new day: yesterday's calls ended with yesterday
        open.forEach(t => end(t, prevBar.close, prevBar, "day end")); open = [];
        ready = null;  // a signal on a day's last candle has no candle left to enter on
      }
      if (ready) { const t = enterAt(ready, bar); if (t) { trades.push(t); open.push(t); } ready = null; }
      const levels = levelsAt(i), lines = linesAt(i);
      open.forEach(t => { follow(t, lines); if (stopShare && !t.hold && t.stop == null) t.stop = round2(t.side === "CE" ? t.entry - stopShare * (t.target - t.entry) : t.entry + stopShare * (t.entry - t.target)); });
      if (stopShare) open = open.filter(t => { if (!t.hold && touchesStop(t, bar) && stopFirst(t, bar)) { end(t, t.stop, bar, "stop"); return false; } return true; });  // ideas P6, P7
      open = open.filter(t => settle(t, bar, prevBar.close));
      if (exitBack) open = open.filter(t => { if (!t.hold && backAcross(t, bar.close) >= exitBack * Math.abs(t.target - t.level)) { end(t, bar.close, bar, "candle"); return false; } return true; });  // idea P4: the candle says exit
      if (closeAt && !dayCandles && clockEnd(bar) >= closeAt) { open.forEach(t => end(t, bar.close, bar, "time")); open = []; }  // idea P1: the clock ends the open calls
      for (const k in used) { const u = used[k]; if (u.side === "CE" ? bar.close < u.price : bar.close > u.price) delete used[k]; }  // closed back across: the line may call again
      let sig = signalAt(bar, prevBar.close, levels, used, signal);  // the call, at the signal candle's close
      if (sig && holdBreaks && open.some(t => t.hold && t.side === sig.side)) sig = null;  // a held break that way: the same trade continues, no new call
      if (sig && holdBreaks && sig.kind === "crossed") { sig.hold = true; sig.c1Open = bar.open; }  // C1, the signal candle: its open is where the break began
      const late = !dayCandles && ((noNewAfter && clockEnd(bar) > noNewAfter) || (closeAt && clockEnd(bar) >= closeAt));  // ideas P2 and P1: too late in the day for a new call
      const shallow = !!sig && !sig.hold && !!minDepth && sig.kind === "crossed" && Math.abs(sig.close - sig.level) < minDepth * Math.abs(sig.target - sig.level);  // idea P3
      if (sig && !late && !shallow) { ready = sig; used[sig.level + "|" + sig.side] = { price: sig.level, side: sig.side }; }
    }
    const last = closed[closed.length - 1];
    const over = dayCandles ? false : last ? dayOver(dayOf(last.time), now) : true;  // day candles: no day end
    if (forming && last && !over && !newDay(forming, last)) {  // the candle forming now: a call enters at its open, and open calls run on its live price
      if (ready) { const t = enterAt(ready, forming); if (t) { trades.push(t); open.push(t); } ready = null; }
      const lines = linesAt(closed.length);  // the lines as the chart draws them now, with the forming candle in the day's range
      open.forEach(t => { follow(t, lines); if (stopShare && !t.hold && t.stop == null) t.stop = round2(t.side === "CE" ? t.entry - stopShare * (t.target - t.entry) : t.entry + stopShare * (t.entry - t.target)); });
      if (stopShare) open = open.filter(t => { if (!t.hold && touchesStop(t, forming)) { end(t, t.stop, forming, "stop"); return false; } return true; });  // ideas P6, P7, tick by tick
      open = open.filter(t => { if (t.hold) { if (retouch(t, forming, last.close)) { end(t, t.c1Open, forming, "retouch"); return false; } return true; }  // exit B tick by tick; exit A waits for the close
                                if (!reaches(t, forming)) return true; if (carryOn != null && t.ladder.length) return true;  // idea P5: the decision waits for the close
                                end(t, t.target, forming, "target"); return false; });
      open.forEach(t => { t.points = gain(t, forming.close); t.last = forming.close; });  // last: the price the open call's points are at
    } else {
      open.forEach(t => { if (over) end(t, last.close, last, "day end"); else { t.points = gain(t, last.close); t.last = last.close; } });
    }
    if (ready && !over) { const { prices, ...pending } = ready; trades.push(pending); }  // the next candle has not begun yet (a second or two): "Enters at the next open"
    return { trades, closed: closed.length };
  }

  // A finished day replayed: every candle has closed, so the clock is set past the day's end. "Previous day" levels
  // stand still; "today so far" levels are the ones the page draws while each candle forms: the day's range up to the
  // candle before it (todayLevelsAt). The owner's exit rule for breaks (holdBreaks) is on, as on the index page
  function replayDay({ bars, move, previous, seconds, signal, ideas }) {
    const fixed = move === "prev" ? (previous ? levelsOf(moveOfDay(previous)) : null) : null;
    if (move === "prev" && !fixed) return { trades: [], closed: 0 };
    const levelsAt = move === "prev" ? () => fixed : todayLevelsAt(bars), targetsAt = move === "prev" ? null : todayLinesAt(bars);
    return paperTrades({ bars, levelsAt, targetsAt, now: Number.POSITIVE_INFINITY, seconds, dayCandles: false, signal, ideas, holdBreaks: true });
  }
  // The ideas under test (LOGIC.md, layer 5): proposed by Claude from the saved candles, confirmed by the owner for the study
  // page only on 6 October. The index page does not know them.
  const IDEAS = {
    P1: { key: "P1", name: "Close open calls at 15:00", ideas: { closeAt: 15 * 3600 } },
    P2: { key: "P2", name: "No new calls after 14:00", ideas: { noNewAfter: 14 * 3600 } },
    P3: { key: "P3", name: "Crossed signals only a quarter of the way to the next level", ideas: { minDepth: 0.25 } },
    P4: { key: "P4", name: "Exit when a candle closes on the wrong side of the level", ideas: { exitBack: 0.25 } },  // the owner's rule of 7 October, acted on: a close a quarter of the gap past the level
    P5: { key: "P5", name: "Carry on to the next level when the candle reaching the target closes a quarter into the next gap", ideas: { carryOn: 0.25 } },  // 7 October evening, from the carry study (lab/findings.md, round 3)
    // 8 October evening, the owner's question after a falling day (NIFTY 50: 11 calls held to the close for -1,082 points): a stop.
    // The two are one choice, so the page never runs both together
    P6: { key: "P6", name: "Stop loss at the same distance as the target", ideas: { stopShare: 1 } },
    P7: { key: "P7", name: "Stop loss at half the distance to the target", ideas: { stopShare: 0.5 } },
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

  // ---- The candle verdict (owner's ask, 7 October, from two screenshots of a fall through the levels and a retest;
  // LOGIC.md, layer 3): what the closed candles say about a call, in one word, carry or exit, for whichever level gave the
  // call (0% to 100% alike). Information for the owner's eyes on the index page: nothing here changes a call, its target,
  // its end or its points; idea P4 on the Study page is the same exit, acted on. Everything is measured against the gap
  // from the call's level to its target:
  //   depth     how far the signal candle closed past the level toward the target (0.55 = 55% of the way)
  //   body      the signal candle's body against that gap
  //   back      how far a later closed candle has gone back across the level, at most (1 = a whole gap)
  //   retest    a later candle came back to within a fifth of the gap of the level and closed on the call's side
  //   strength  strong: depth past halfway or a body of a whole gap; fair: a quarter of the way or a body of half the gap; weak: less
  //   word      exit: a later candle closed back across the level by a quarter of the gap or more (EXIT_BACK). The owner's
  //             rule: a retest that holds means carry on, a candle closing back across the level means get out. The quarter
  //             tells the two apart: on the six saved days a close back of less than a quarter reverted two times in three
  //             (noise, the retest of the owner's first screenshot), one past a quarter did not. carry: the rest
  //   exitAt, exitPrice   the first such candle, its time and its close; on a finished call too, so the row can say what the
  //             verdict said and when
  //   why       the reason, in words, with the level's name
  // Only closed candles count, as everywhere in this layer, up to the call's end.
  const EXIT_BACK = IDEAS.P4.ideas.exitBack;
  function readOf({ trade: t, bars, seconds, now }) {
    if (t.entry == null && t.how !== "pending") return null;
    if (t.hold) {  // a held break (holdBreaks): the verdict is the owner's exit rule itself
      const name = t.ratio == null ? "the level" : `the ${(t.ratio * 100).toFixed(1)}% level`, pe = t.side === "PE";
      const word = t.how === "back" || t.how === "retouch" ? "exit" : "carry";
      const why = t.how === "back" ? `price closed back ${pe ? "above" : "below"} ${name}` : t.how === "retouch" ? "price came back to where the break began"
        : `price stays ${pe ? "below" : "above"} ${name}`;
      return { depth: null, body: null, back: null, retest: false, strength: null, word, why, exitAt: word === "exit" ? t.exitTime : null, exitPrice: word === "exit" ? t.exit : null };
    }
    const gap = Math.abs(t.target - t.level);
    const sig = bars.find(b => b.time === t.signalTime);
    if (!gap || !sig) return null;
    const toward = p => (t.side === "CE" ? p - t.level : t.level - p) / gap;
    const depth = round2(toward(sig.close)), body = round2(Math.abs(sig.close - sig.open) / gap);
    let back = 0, retest = false, exitAt = null, exitPrice = null;
    for (const b of bars) {
      if (b.time <= t.signalTime || endOf(b, seconds) > now) continue;
      if (t.exitTime != null && b.time > t.exitTime) break;
      const went = t.side === "CE" ? t.level - b.close : b.close - t.level;  // back across the level, in points, as paperTrades measures idea P4
      back = Math.max(back, went / gap);
      if (exitAt == null && went >= EXIT_BACK * gap) { exitAt = b.time; exitPrice = b.close; }
      if (t.side === "CE" ? b.low <= t.level + 0.2 * gap && b.close > t.level : b.high >= t.level - 0.2 * gap && b.close < t.level) retest = true;
    }
    back = round2(back);
    const strength = depth >= 0.5 || body >= 1 ? "strong" : depth >= 0.25 || body >= 0.5 ? "fair" : "weak";
    const word = exitAt != null ? "exit" : "carry";
    // the reason in the plainest words (owner's ask): "price closed below the 61.8% level", "price came back to the 61.8% level
    // and held", "big candle through the 50.0% level, holding above it", "small bounce off the 78.6% level, holding below it"
    const level = t.ratio == null ? "the level" : `the ${(t.ratio * 100).toFixed(1)}% level`;
    const good = t.side === "CE" ? "above" : "below", bad = t.side === "CE" ? "below" : "above";
    const size = t.kind === "held" ? { strong: "strong bounce", fair: "bounce", weak: "small bounce" }[strength] : { strong: "big candle", fair: "candle", weak: "small candle" }[strength];
    const why = word === "exit" ? `price closed ${bad} ${level}`
      : retest ? `price came back to ${level} and held`
      : `${size} ${t.kind === "held" ? "off" : "through"} ${level}, holding ${good} it`;
    return { depth, body, back, retest, strength, word, why, exitAt, exitPrice };
  }

  // ---- The carry read (idea P5's question, asked of every call of the rule as it is, for the day's calls CSV and the
  // research engine; 7 October evening): at the candle that reached the call's target, did the close go at least a quarter
  // (CARRY_ON) of the next gap past the target, and was the level beyond reached by a later closed candle (the same candle
  // counts). null until the target is reached, and for a call with no level beyond its target. Changes nothing about a call
  const CARRY_ON = IDEAS.P5.ideas.carryOn;
  function carryOf({ trade: t, bars, seconds, now }) {
    if (t.how !== "target" || !t.ladder || !t.ladder.length) return null;
    const hit = bars.find(b => b.time === t.exitTime);
    if (!hit) return null;
    const beyond = t.ladder[0], dir = t.side === "CE" ? 1 : -1;
    const deep = dir * (hit.close - t.target) >= CARRY_ON * Math.abs(beyond - t.target);
    let reachedAt = null;
    for (const b of bars) {
      if (b.time < t.exitTime || endOf(b, seconds) > now) continue;
      if (dir > 0 ? b.high >= beyond : b.low <= beyond) { reachedAt = b.time; break; }
    }
    return { deep, beyond, reached: reachedAt != null, reachedAt };
  }

  root.Rules = { RATIOS, IST_OFFSET, SESSION_END, SESSION_START, round2, dayOf, dayOver, endOf, sessionShare, levelsOf, todayLevelsAt, todayLinesAt, moveOf, moveOfDay, signalAt, paperTrades, replayDay, readOf, carryOf,
                 breakOf, dayFacts, candleBreaks, levelBehaviour, IDEAS, ideasOf };
})(typeof window !== "undefined" ? window : globalThis);
