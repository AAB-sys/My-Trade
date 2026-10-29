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
  const endOf = (b, seconds) => seconds >= 7 * 86400 ? b.time + 4 * 86400 + (SESSION_END - SESSION_START)  // a week candle: its Friday's 3:30 pm (15 October)
    : Math.min(b.time + seconds, dayOf(b.time) * 86400 - IST_OFFSET + SESSION_END);
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
  // day's earlier low or high is outward from the last line and gives no call, as before that afternoon (on NIFTY 50, 5-minute
  // candles, it gives a call past the day's high or low since 13 October: idea 24, pastEdgeAt).
  const todayLevelsAt = (bars) => (i) => levelsOf(moveOf(bars.slice(0, Math.max(1, i))));
  // The lines the chart draws while candle i forms (owner's decision, 8 October evening: when the price breaks the 0% or 100%
  // line, the 7 lines are worked out again at once from the live price): the day's range up to and with candle i. A call's
  // target follows these, so the target is always a line on the chart; the signal is still judged by todayLevelsAt
  const todayLinesAt = (bars) => (i) => levelsOf(moveOf(bars.slice(0, i + 1)));
  function moveOfDay(d) {  // "previous day": only the day's four figures are known, so it is an up move when it closed above its open
    return d ? { high: d.high, low: d.low, up: d.close >= d.open } : null;
  }
  // "Previous close" (the owner, 15 October: "put the febonachi 7 lines starting from previous days closing point so that should
  // be the 0% line always and you should calculate above it till 100 % level and from the same point below till the 100% level
  // with the help of febonachib 7 levels calculation. And 0% from above should have + mark and 0 from below should have - mark";
  // the distance: "U have to calculate those levels. Dont tk any reference. Referenc is only for 0% level"; then "1.2% is fine.
  // And it should be always fix"; then "make 100% is 1.5% of that close"). The one reference is the close, so the distance is a
  // share of it: 100% is 1.5% of the previous day's close (CLOSE_STEP), each line the Fibonacci share of that, above the close
  // (+) and below it (-): 13 lines. 15 October: 14 October closed at 22,622.70, so 100% is 339.34 points, +23.6% is 22,702.78
  // and -23.6% is 22,542.62. These levels carry signed, so their names show the + (levelName); every other levels mode is as before
  const CLOSE_STEP = 0.015;
  function closeLevels(close) {
    if (close == null || !(close > 0)) return null;
    const step = close * CLOSE_STEP, out = [];
    RATIOS.forEach(r => { out.push({ ratio: r, price: round2(close + r * step), signed: true }); if (r > 0) out.push({ ratio: -r, price: round2(close - r * step), signed: true }); });
    return out.sort((a, b) => a.price - b.price);
  }
  const levelName = (ratio, signed) => (signed && ratio > 0 ? "+" : "") + (ratio * 100).toFixed(1) + "%";  // "+23.6%" above the close, "-23.6%" below it
  // The 7 lines of today's range, as the previous close's lines are redrawn (below): up, 0% at today's low and +100% at its
  // high, +23.6% being 23.6% of the way up from the low; down, 0% at today's high and -100% at its low
  function rangeLevels(low, high, up) {
    const span = high - low;
    return RATIOS.map(r => up ? { ratio: r, price: round2(low + r * span), signed: true } : { ratio: r ? -r : 0, price: round2(high - r * span), signed: true })
      .sort((a, b) => a.price - b.price);
  }
  // The lines candle i of one session is judged on (the owner, 15 October: "add new logic to redraw it only if candle crosses
  // +100% line and make high above +100% then redraw the febonachi 7 lines again considering today's low as 0% line and today's
  // high as +100% line. Same logic applies for -100% line crossed"; then, for a fall below today's low after that: "redraw
  // downward with today's high as 0%"). They begin as the previous close's 13 lines and stay as they are until a closed candle
  // closes beyond the outermost line ("Crossed above" / "Crossed below", the owner's words for a close beyond a line). Above the
  // top line (+100%; after a redraw down, the 0% at today's high): from the next candle the 7 lines run from today's low (0%) to
  // today's high (+100%), the high that candle made included. Below the bottom line (-100%; after a redraw up, the 0% at today's
  // low): from today's high (0%) to today's low (-100%). Each candle is judged on the lines as they stood when it began
  function closeLevelsAt(bars, close) {
    const first = closeLevels(close);
    if (!first) return null;
    const at = [first];  // at[i]: the lines candle i is judged on
    let low = Infinity, high = -Infinity;
    bars.forEach((b, k) => {
      const lv = at[k], top = lv[lv.length - 1], bottom = lv[0];
      low = Math.min(low, b.low); high = Math.max(high, b.high);
      at.push(b.close > top.price ? rangeLevels(low, high, true) : b.close < bottom.price ? rangeLevels(low, high, false) : lv);
    });
    return (i) => at[Math.max(0, Math.min(i, at.length - 1))];
  }

  // ---- Layer 2, the judgement, inside layer 3's signal: a closed candle HELD a level (reached it and closed
  // back on the side it came from) or CROSSED one (closed on the other side of it from the previous close).
  // When one candle signals at several levels the one nearest its close counts: one candle, one call. A level
  // that has given a call in a direction gives no more that way until the index closes back across it (used). The
  // level is the line at its price (8 October): with "today so far" levels a ratio's line moves as the day's range grows,
  // and a line at a new price is a new level. Until then the memory was kept by the ratio's name, so the 0% hold at 09:20
  // blocked every later hold of the day's low that day, at lines up to 186 points lower, and could never be released
  // (no close goes below the day's own low). With the previous day's levels the lines never move: nothing changes there.
  // A close exactly on a line has not crossed it yet (9 October, the owner's NIFTY 50 chart: the 13:35 candle closed at
  // 22,509.35, the 78.6% line itself, and the 13:40 candle closed above it at 22,526.15; judged against the close just
  // before, the break went uncounted and no call came): a cross is judged from the last close off that line, from(L), the
  // close just before whenever that is off the line. Holds are judged from the close just before, as ever
  // A candle's own wick counts as crossing (18 October, the owner, of a candle that dipped below a line and closed above it:
  // "this should also be considered as closed above"; "yes" to: a candle closing above a line after its own low went below it
  // is Crossed above, the same the other way for Crossed below, and On the line is left for an exact touch). So a cross is
  // a close on one side of a line with the price on the other side before it: the last close off the line, or this candle's
  // own low or high. Until then such a candle was a hold, and the hold was sold at its target; as a cross it is held through
  // the target and sold by the exit rules, and ideas 8 and 5 apply to it
  // The candle's colour (Change 5, the owner, 21 October, from the 11:50 Buy CE off a red candle: "Yes, build rule A"): the signal
  // candle must close in the call's direction. A red candle (closed below its open) above a line gives no Buy CE, a green one
  // (closed above its open) below a line gives no Buy PE; a candle that closed where it opened is neither, and gives either.
  // On the 15 saved days 29 September to 21 October: 15 of 224 calls came from a candle of the wrong colour, 11 of them lost
  const withColour = (bar, side) => side === "CE" ? bar.close >= bar.open : bar.close <= bar.open;
  function signalAt(bar, prev, levels, used, signal, from) {
    const crossed = L => { const p = from ? from(L) : prev; return (p < L && bar.close > L) || (p > L && bar.close < L) || (bar.low < L && bar.close > L) || (bar.high > L && bar.close < L); };
    const held = L => !crossed(L) && ((prev > L && bar.low <= L && bar.close > L) || (prev < L && bar.high >= L && bar.close < L));
    const hits = levels.filter(l => {
      const kind = crossed(l.price) ? "crossed" : held(l.price) ? "held" : null, side = bar.close > l.price ? "CE" : "PE";
      return kind && (signal === "both" || signal === kind) && withColour(bar, side) && !used[l.price + "|" + side];
    });
    if (!hits.length) return null;
    const at = hits.reduce((a, b) => Math.abs(b.price - bar.close) < Math.abs(a.price - bar.close) ? b : a);
    const kind = crossed(at.price) ? "crossed" : "held";
    const side = bar.close > at.price ? "CE" : "PE";
    const next = side === "CE" ? levels.find(l => l.price > at.price) : levels.slice().reverse().find(l => l.price < at.price);
    if (!next) return null;  // a signal pointing outward from the 0% or 100% level has no next level
    return { signalTime: bar.time, level: at.price, ratio: at.ratio, ...(at.signed ? { signed: true } : {}), kind, side, target: next.price, close: bar.close,
             range: round2(bar.high - bar.low), entry: null, exit: null, points: null, how: "pending",
             prices: levels.map(l => l.price) };  // the levels in force at the signal, for the entry's check below
  }
  // A call given live stays given (the owner, 9 October: "yes, fix it"): at 13:40:05 the NIFTY 50 page gave the 13:35 Buy CE
  // from the price at the candle's close, just above the 78.6% line (22,509.35), and recorded its option; Dhan's final candle
  // then closed exactly on the line, and the call vanished from the table. When the candle's prices no longer give a call
  // that was given (its option recorded), it is kept on that side: on the line nearest the close that the candle reached
  // (any line with one beyond it that way when it reached none), crossed when the price came from the other side of it
  // (the last close off it), held otherwise; "kept" marks it
  function keptAt(bar, levels, from, side) {
    const ok = levels.filter((l, k) => side === "CE" ? k < levels.length - 1 : k > 0);
    if (!ok.length) return null;
    const touched = ok.filter(l => bar.low <= l.price && bar.high >= l.price);
    const at = (touched.length ? touched : ok).reduce((a, b) => Math.abs(b.price - bar.close) < Math.abs(a.price - bar.close) ? b : a);
    const p = from(at.price), kind = (side === "CE" ? p < at.price || bar.low < at.price : p > at.price || bar.high > at.price) ? "crossed" : "held";  // the wick counts (18 October)
    const next = side === "CE" ? levels.find(l => l.price > at.price) : levels.slice().reverse().find(l => l.price < at.price);
    return { signalTime: bar.time, level: at.price, ratio: at.ratio, ...(at.signed ? { signed: true } : {}), kind, side, target: next.price, close: bar.close,
             range: round2(bar.high - bar.low), entry: null, exit: null, points: null, how: "pending", kept: true,
             prices: levels.map(l => l.price) };
  }
  // ---- Idea 24, a call past the day's high or low (the owner, 13 October evening: "yes, build way 1"; NIFTY 50 only, 5-minute
  // candles, "Today so far" lines). With today-so-far lines the top line is the day's high so far and the bottom line its low, and
  // no line lies beyond them, so while NIFTY 50 kept making new highs no Buy CE could come (13 October: the day rose from
  // 22,288.45 to 22,581.15 by 9:55 and the first Buy CE came at 10:30, after the price had come back down to the 23.6% line).
  // Now a candle that closes above the top line gives a Buy CE "Crossed above" it, and one that closes below the bottom line a
  // Buy PE "Crossed below" it, when no line gives a signal. There is no line beyond to aim at: its target is null until the lines
  // move past its entry (the target follows the lines, as every call's). It is held and sold as every Crossed call is (A, B,
  // Rule 2, the day end), and it runs alongside the other calls: while it is held the lines' own calls that way still come,
  // while a held Crossed call of the lines stops it (paperTrades). 13 October: the 9:25 candle closed at 22,471.40, above
  // the top line at 22,460.80; bought at the 9:30 open, 22,470.90, held to the day end, 22,721.95: +251.05. The ten saved days
  // 29 September to 13 October, NIFTY 50, 5-minute today-so-far lines: +804 → +1,447 (better on 4 days, worse on 5; its
  // own 10 calls: 4 won, +764; 6 lost, −121); 15-minute +617 → +936; so 5-minute, NIFTY 50 only, as idea 13
  const NEW_HIGH_LOW = { "NIFTY 50": true };
  // Ideas 5 and 8 (13 October: a Crossed call only when its candle closed a quarter of the way to the next line; no Crossed call the
  // other way while one is held) were removed from the rule on 18 October with idea 13 (the owner: "all three remove")
  function pastEdgeAt(bar, levels, used) {
    const top = levels[levels.length - 1], bottom = levels[0];
    const at = bar.close > top.price ? top : bar.close < bottom.price ? bottom : null;
    if (!at) return null;
    const side = at === top ? "CE" : "PE";
    if (used[at.price + "|" + side]) return null;
    return { signalTime: bar.time, level: at.price, ratio: at.ratio, kind: "crossed", side, target: null, edge: true, close: bar.close,
             range: round2(bar.high - bar.low), entry: null, exit: null, points: null, how: "pending", prices: levels.map(l => l.price) };
  }

  // The entry (owner's decision, 7 October): when the next candle opens already at or past the target (the signal candle
  // itself ran through the next level), the call aims one level further, the first level beyond the entry price; with no
  // level left beyond it, there is no call. Until then such a call "hit" a target below its entry and lost at once.
  // A call past the day's high or low (idea 24) has no target to be past: it enters as it is
  function enterAt(sig, bar, price) {
    const entry = price != null ? price : bar.open;  // since 18 October the price the call fired at (paperTrades); the candle's open before that
    let target = sig.target, aimed = null;
    if (target != null && (sig.side === "CE" ? entry >= target : entry <= target)) {
      const beyond = sig.side === "CE" ? sig.prices.find(p => p > entry) : sig.prices.slice().reverse().find(p => p < entry);
      if (beyond == null) return null;
      target = beyond; aimed = "beyond";
    }
    const { prices, fireAt, ...rest } = sig;
    const ladder = target == null ? [] : sig.side === "CE" ? prices.filter(p => p > target) : prices.filter(p => p < target).reverse();  // the levels beyond the target, nearest first: idea P5 carries the call up them, and the carry read asks about the first
    return { ...rest, target, aimed, ladder, entry, entryTime: bar.time, how: "open" };
  }

  // ---- Rule 2 of the owner's "Trading Rules Specification" (9 October): the stop of a held break moves with the price, line by
  // line. One closed candle of the index: first the exit, against the stop as it stood before this candle (a close back past it
  // sells); then the stop moves. A line counts as crossed when the candle closed beyond it in the trade's direction by more than
  // the buffer (buffer 0: a plain close beyond it; a wick never counts). Only the lines beyond the furthest one crossed so far
  // count (at first: beyond the stop, the line the call broke); one candle past several lines jumps to the furthest. The stop goes
  // to that line ("at") or to the line behind it ("back", never behind where it already is), and never moves backward.
  //   st      { stop, stopRatio, line, ratio }: the stop now, and the furthest line crossed (null until one is); changed in place
  //   levels  the lines this candle is judged against, sorted by price
  function trailStep(st, close, levels, side, place, buf) {
    const d = side === "CE" ? 1 : -1;
    if (d * (close - st.stop) < 0) return "sell";
    const from = st.line != null ? st.line : st.stop;
    let far = null;
    for (const l of levels) if (d * (l.price - from) > 0 && d * (close - l.price) > buf && (far == null || d * (l.price - far.price) > 0)) far = l;
    if (far == null) return "hold";
    st.line = far.price; st.ratio = far.ratio;
    let to = far;
    if (place === "back") { to = null; for (const l of levels) if (d * (far.price - l.price) > 0 && (to == null || d * (l.price - to.price) > 0)) to = l; }
    if (to != null && d * (to.price - st.stop) > 0) { st.stop = to.price; st.stopRatio = to.ratio; }
    return "hold";
  }
  // The ATR for Rule 2's buffer (the specification, 6.2): true range max(high - low, |high - previous close|, |low - previous
  // close|), a day's first candle its own high - low (the overnight gap left out, 6.7); Wilder's average, (ATR x 13 + TR) / 14,
  // begun with the plain average of the first 14. atrBefore(bars)[i] is the ATR through the candle before bars[i], so a big
  // candle never widens its own buffer; null until 14 candles have closed
  function atrBefore(bars, period) {
    const out = [null];
    let atr = null, sum = 0;
    for (let j = 0; j < bars.length - 1; j++) {
      const b = bars[j], p = j > 0 && dayOf(bars[j - 1].time) === dayOf(b.time) ? bars[j - 1].close : null;
      const tr = p == null ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - p), Math.abs(b.low - p));
      if (j < period) { sum += tr; if (j === period - 1) atr = sum / period; } else atr = (atr * (period - 1) + tr) / period;
      out.push(atr);
    }
    return out;
  }
  // Rule 2 as the index page, the server's watcher and the replays run it (the owner's choices, 9 October afternoon: "Rule 2 on all
  // 7 lines", then "Stop one Fibonacci level back", each in its own PR; then 21 October, Change 4, "trailing stop loss ... point no 3",
  // the stop on the line crossed itself): no buffer, on all seven lines of the chart, the stop on the furthest line crossed ("at";
  // from 9 to 21 October one Fibonacci line back from it, the specification's ONE_LEVEL_BACK, 6.3, "back"). With "today so far"
  // lines a close past the day's low or high so far (the 0% or 100% line) counts as crossing it too. The other settings (lines:
  // "middle", the specification's 23.6% to 78.6% only; buffer: "fixed" points, or "atr" mult x ATR with points until 14 candles have
  // closed; place: "back") are for the research engine to compare; none goes live without the owner's yes
  const TRAIL = { lines: "all", buffer: "none", place: "at" };

  // Idea 13 (12 October: no call against a fresh run) was removed from the rule on 18 October (the owner: "all three remove")

  // ---- The Call Gate, version 2 (the owner's "Call Gate" version 2 document, its Implementation Brief and reference code
  // call_gate_reference.py with sideways_filter_reference.py, 23 October morning; version 1 was built on 22 October night, PR #204).
  // "One extra step between a signal and its order. Your call logic (lines, signals, firing, entries, exits) is not changed."
  // Judged on the signal candle the moment the signal is born, on closed candles only, with the ATR(14) as of the previous candle
  // (Wilder, carried from the previous day: atrSeed; the day's first candle's true range against the previous close). The first check
  // that answers decides, in this order:
  //   A. parallel   a call the same way is open at the signal candle's close (the "Can be bought parallelly" case). Version 2 (revised,
  //                 23 October: "parallel calls are never blocked; the gate only writes advice next to them"): setting parallel "log",
  //                 the call goes on to the other checks and carries an advice note (gateAdvice): OK when the day is winning, WOULD SKIP
  //                 otherwise. Day health: the index points of every signal of the day that has fired and already exited (taken or
  //                 followed on paper); winning means above healthMinAtr x ATR (0: any profit). "health": the advice as a real block
  //                 (GATE_HEALTH, the owner's later decision from the shadow log) | "skip" (version 1: every parallel call) | "allow"
  //   B. opening    the signal candle begins before openingUntil (09:45). Version 2 ("orb"): it passes only when it closes beyond the
  //                 opening range (the high and low of the day's first orCandles candles) by orbBufferAtr x ATR; a signal on one of
  //                 those first candles has no range yet and is skipped. "skip" (version 1: every opening call) | "allow"
  //   late          lateAfter null in version 2 (version 1: no call after 14:45)
  //   C. chase      the signal candle's range is more than chaseAtr x ATR: SKIP
  //   D. zone       a sideways zone is active (zoneStep): the verdict by where the candle closes in it (zoneVerdict); else TAKE
  // The sideways zone (the Sideways Market Filter's tracker, zone height 1.5 x ATR in version 2, 2.0 in version 1): the day's last zoneN
  // candles, from the 7th candle of the day on, fit in a band no taller than zoneHeightAtr x ATR and the price went almost nowhere
  // over them (efficiency, the net move over the path of the closes from the close before them, zoneErMax or less); the band from their
  // lowest low to their highest high is the zone, kept as found until a candle closes outside it by bufferAtr x ATR (no new zone is
  // looked for on that candle). Inside it a Buy CE closing above the band is a breakout (TAKE), in the bottom third a bounce (TAKE), in
  // the top third buying at the top (SKIP, unless the candle's high, the entry trigger, is already above the band: TAKE), in the middle
  // third TAKE only on a trend continuation or a strong candle (the filter's section 6); a Buy PE the mirror. Strong candle: a body of at
  // least strongBodyAtr x ATR, a close within the last strongCloseFrac of its range the call's way, and beyond the previous strongLookback
  // candles' highs (lows) by bufferAtr x ATR. Trend continuation: from the highest high (PE; lowest low, CE) of the last legLookback
  // candles the price moved at least legSizeAtr x ATR, at least legErMin of the way one way, the candle closes at a new low (high) of
  // that leg and in its own lower (upper) half.
  // mode SHADOW (the brief: "delivered in shadow mode"): every call fires as before; the verdict, its reason and the check that decided
  // ride on the call (gate, gateWhy, gateCheck). Mode LIVE: a SKIP decided by a check named in liveChecks holds the order: the signal is
  // still armed, fired and exited by the rule on paper (paper: true, no option, no order) so its points feed day health and the daily
  // report, and its row stays on the table; a SKIP from a check not yet live is logged only. The no-repeat lock is taken either way.
  // The signals cancelled before firing come back in `cancelled`, each with its verdict (the brief: "both columns filled for every
  // signal, fired or cancelled"). The settings are the version 2 document's section 12; GATE_V1 is version 1 as settings
  const GATE = { mode: "SHADOW", liveChecks: ["parallel", "opening", "late", "chase", "zone"],
                 parallel: "log", healthMinAtr: 0.0, openingUntil: 9 * 3600 + 45 * 60, opening: "orb", orCandles: 3, orbBufferAtr: 0.25,
                 lateAfter: null, chaseAtr: 2.5, zoneRule: true, zoneN: 6, zoneHeightAtr: 1.5, zoneErMax: 0.30, bufferAtr: 0.25,
                 strongBodyAtr: 0.5, strongCloseFrac: 0.30, strongLookback: 3, legLookback: 12, legSizeAtr: 2.0, legErMin: 0.60, atrPeriod: 14 };
  const GATE_V1 = { ...GATE, parallel: "skip", opening: "skip", lateAfter: 14 * 3600 + 45 * 60, zoneHeightAtr: 2.0 };
  const GATE_HEALTH = { ...GATE, parallel: "health" };  // the parallel advice switched on as a block (what could go live later, the owner's decision)
  const hm = (sec) => `${String(Math.floor(sec / 3600)).padStart(2, "0")}:${String(Math.floor(sec % 3600 / 60)).padStart(2, "0")}`;
  const num1 = (x) => String(Math.round(x * 10) / 10);  // a number to one decimal, written as JavaScript writes it (3, 3.5): the server's copy writes the same
  const signed1 = (x) => (x < 0 ? "-" : "+") + Math.abs(Math.round(x * 10) / 10).toFixed(1);
  const trueRange = (b, p) => p == null ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - p), Math.abs(b.low - p));
  // gateAtr(closed)[i]: the ATR as of the candle before closed[i]. Wilder from the seed (the previous day's ATR); without a seed the plain
  // average of the first `period` true ranges, null until then
  function gateAtr(closed, period, seed, prevClose) {
    const out = []; let atr = seed != null ? seed : null, sum = 0;
    for (let j = 0; j < closed.length; j++) {
      out.push(atr);
      const tr = trueRange(closed[j], j > 0 ? closed[j - 1].close : prevClose);
      if (atr == null) { sum += tr; if (j === period - 1) atr = sum / period; } else atr = (atr * (period - 1) + tr) / period;
    }
    return out;
  }
  // The seed for the next day: Wilder's ATR over the previous sessions' candles (the plain average of the first `period` true ranges, then
  // Wilder); null with fewer candles than the period
  function atrSeedOf(bars, period) {
    if (!bars || bars.length < period) return null;
    let atr = null, sum = 0;
    for (let j = 0; j < bars.length; j++) {
      const tr = trueRange(bars[j], j > 0 ? bars[j - 1].close : null);
      if (atr == null) { sum += tr; if (j === period - 1) atr = sum / period; } else atr = (atr * (period - 1) + tr) / period;
    }
    return atr;
  }
  const efficiency = (closes) => { let moves = 0; for (let j = 1; j < closes.length; j++) moves += Math.abs(closes[j] - closes[j - 1]); return moves ? Math.abs(closes[closes.length - 1] - closes[0]) / moves : 0; };
  function zoneStep(zone, closed, i, atr, dayFirst, g) {  // one closed candle, before any signal on it is judged (the filter's ZoneTracker.update)
    const bar = closed[i];
    zone.broke = null;
    if (zone.box && atr != null) {
      const buf = g.bufferAtr * atr;
      if (bar.close > zone.box.hi + buf || bar.close < zone.box.lo - buf) { zone.broke = bar.close > zone.box.hi ? "up" : "down"; zone.box = null; if (zone.ended && i > 0) zone.ended.push(closed[i - 1].time); }
    }
    if (zone.box || zone.broke || atr == null || i - dayFirst < g.zoneN) return;
    const s = i - g.zoneN + 1;
    let hi = -Infinity, lo = Infinity;
    for (let j = s; j <= i; j++) { hi = Math.max(hi, closed[j].high); lo = Math.min(lo, closed[j].low); }
    const er = efficiency(closed.slice(i - g.zoneN, i + 1).map(b => b.close));
    if (hi - lo <= g.zoneHeightAtr * atr && er <= g.zoneErMax) { zone.box = { lo, hi, found: bar.time }; zone.found.push(bar.time); }
  }
  function strongCandle(closed, i, side, atr, dayFirst, g) {  // the filter's section 6.2: { ok, failed: the checks that failed, by name }
    const b = closed[i], rng = b.high - b.low, buf = g.bufferAtr * atr;
    const body = Math.abs(b.close - b.open) >= g.strongBodyAtr * atr;
    const end = rng > 0 && (side === "CE" ? b.high - b.close : b.close - b.low) <= g.strongCloseFrac * rng;
    let ext = null;
    for (let j = Math.max(dayFirst, i - g.strongLookback); j < i; j++) { const v = side === "CE" ? closed[j].high : closed[j].low; ext = ext == null ? v : side === "CE" ? Math.max(ext, v) : Math.min(ext, v); }
    const beyond = ext != null && (side === "CE" ? b.close > ext + buf : b.close < ext - buf);
    const failed = [body ? null : "body", end ? null : "close near end", beyond ? null : "beyond last3"].filter(Boolean);
    return { ok: !failed.length, failed };
  }
  function trendContinuation(closed, i, side, atr, dayFirst, g) {  // the filter's section 6.1: { ok, sizeAtr, er }
    const s0 = Math.max(dayFirst, i - g.legLookback), c = closed[i];
    let h = s0;
    for (let j = s0; j <= i; j++) if (side === "PE" ? closed[j].high > closed[h].high : closed[j].low < closed[h].low) h = j;
    let ext = null; for (let j = h; j < i; j++) { const v = side === "PE" ? closed[j].low : closed[j].high; ext = ext == null ? v : side === "PE" ? Math.min(ext, v) : Math.max(ext, v); }
    const size = side === "PE" ? closed[h].high - c.close : c.close - closed[h].low;
    const newExt = h < i && (side === "PE" ? c.close < ext : c.close > ext);
    const half = (side === "PE" ? c.close - c.low : c.high - c.close) <= 0.5 * (c.high - c.low);
    const er = efficiency(closed.slice(h, i + 1).map(b => b.close));
    return { ok: size >= g.legSizeAtr * atr && er >= g.legErMin && newExt && half, sizeAtr: size / atr, er };
  }
  function zoneVerdict(closed, i, side, atr, box, dayFirst, g) {  // inside an active zone: by where the candle closes in it (section 5)
    const c = closed[i], { lo, hi } = box;
    if (hi - lo <= 0) return { gate: "TAKE", why: "zone has no height" };
    const pos = (c.close - lo) / (hi - lo), pct = `${Math.round(pos * 100)}% up`, trig = side === "CE" ? c.high : c.low;
    if (side === "CE") {
      if (c.close > hi) return { gate: "TAKE", why: "closes above the sideways zone (breakout)" };
      if (pos >= 2 / 3) return trig > hi ? { gate: "TAKE", why: `top third of the zone, but the entry trigger ${num1(trig)} is above the zone high ${num1(hi)}` }
                                         : { gate: "SKIP", why: `buying in the top third of a sideways zone (${pct}), trigger still inside it` };
      if (pos <= 1 / 3) return { gate: "TAKE", why: `bounce from the bottom third of the zone (${pct})` };
    } else {
      if (c.close < lo) return { gate: "TAKE", why: "closes below the sideways zone (breakdown)" };
      if (pos <= 1 / 3) return trig < lo ? { gate: "TAKE", why: `bottom third of the zone, but the entry trigger ${num1(trig)} is below the zone low ${num1(lo)}` }
                                         : { gate: "SKIP", why: `selling in the bottom third of a sideways zone (${pct}), trigger still inside it` };
      if (pos >= 2 / 3) return { gate: "TAKE", why: `bounce from the top third of the zone (${pct})` };
    }
    const t = trendContinuation(closed, i, side, atr, dayFirst, g);
    if (t.ok) return { gate: "TAKE", why: `middle of the zone, but a trend continuation (leg ${num1(t.sizeAtr)} x ATR, ${Math.round(t.er * 100)}% one-way)` };
    const st = strongCandle(closed, i, side, atr, dayFirst, g);
    if (st.ok) return { gate: "TAKE", why: "middle of the zone, but a strong candle" };
    return { gate: "SKIP", why: `weak call from the middle of a sideways zone (${pct}; not ${st.failed.join(", not ")})` };
  }
  function openingRange(closed, dayFirst, g) { const n = g.orCandles; if (closed.length - dayFirst < n) return null; let hi = -Infinity, lo = Infinity; for (let j = dayFirst; j < dayFirst + n; j++) { hi = Math.max(hi, closed[j].high); lo = Math.min(lo, closed[j].low); } return { hi, lo }; }
  // The advice on a parallel call (the revised version 2, section 6): a note only, never a block; "" for a call that is not parallel
  function parallelAdvice(parallel, health, atr, g) {
    if (!parallel) return "";
    if (atr != null && health > g.healthMinAtr * atr) return `OK: parallel call, day winning (closed signals today ${signed1(health)} points)`;
    return `WOULD SKIP: parallel call, day not winning (closed signals today ${signed1(health)} points)`;
  }
  // The opening window, the late rule and the chase on the signal candle (checks B and C, the late rule): the first that objects, as
  // { gate: "SKIP", why, check }, or null. The Call Gate and the Loss Cutter ask the same three
  function entryChecks(closed, i, side, atr, dayFirst, g) {
    const bar = closed[i], when = (bar.time + IST_OFFSET) % 86400;
    if (when < g.openingUntil && g.opening !== "allow") {
      const r = g.opening === "orb" && atr != null && i - dayFirst >= g.orCandles ? openingRange(closed, dayFirst, g) : null, buf = atr != null ? g.orbBufferAtr * atr : 0;
      const beyond = !!r && (side === "CE" ? bar.close > r.hi + buf : bar.close < r.lo - buf);
      if (!beyond) return { gate: "SKIP", why: `opening window: signal before ${hm(g.openingUntil)}` + (g.opening === "skip" ? "" : ", no close beyond the opening range"), check: "opening" };
    }
    if (g.lateAfter != null && when > g.lateAfter) return { gate: "SKIP", why: `late: signal after ${hm(g.lateAfter)}`, check: "late" };
    if (atr != null && bar.high - bar.low > g.chaseAtr * atr) return { gate: "SKIP", why: `chase: signal candle range ${num1((bar.high - bar.low) / atr)} x ATR`, check: "chase" };
    return null;
  }
  // The verdict for a signal born on candle i: { gate, why, check } (check: the one that decided; null on TAKE "no sideways zone active")
  function gateVerdict(closed, i, side, atr, zone, parallel, health, dayFirst, g) {
    if (parallel && (g.parallel === "health" || g.parallel === "skip")) {  // not in the default "log": a parallel call goes on to the other checks
      if (g.parallel === "skip") return { gate: "SKIP", why: `parallel call: a ${side} call is already open`, check: "parallel" };
      if (atr == null || !(health > g.healthMinAtr * atr)) return { gate: "SKIP", why: `parallel call on a day that is not winning (closed signals today ${signed1(health)} points)`, check: "parallel" };
    }
    const early = entryChecks(closed, i, side, atr, dayFirst, g);
    if (early) return early;
    if (g.zoneRule && zone.box && atr != null) return { ...zoneVerdict(closed, i, side, atr, zone.box, dayFirst, g), check: "zone" };
    return { gate: "TAKE", why: "no sideways zone active", check: null };
  }
  // The daily summary line (the brief, section 6): one line for a finished day, from the rule's result for that day
  function gateSummary(res, date) {
    const fired = res.trades.filter(t => t.entry != null && t.gate), take = fired.filter(t => t.gate === "TAKE"), skip = fired.filter(t => t.gate === "SKIP");
    const by = (c) => skip.filter(t => t.gateCheck === c).length, pts = (list) => round2(list.reduce((a, t) => a + (t.points || 0), 0));
    const winners = skip.filter(t => t.points > 0).map(t => `${istHM(t.signalTime)} ${t.side} ${signed1(t.points)} (${t.gateCheck})`);
    const flagged = fired.filter(t => (t.gateAdvice || "").startsWith("WOULD SKIP")), out = flagged.filter(t => t.gate === "TAKE");  // the parallel advice, judged like a check
    const wonPts = pts(out.filter(t => t.points > 0)), lostPts = pts(out.filter(t => t.points <= 0));
    const last = fired[fired.length - 1];
    return `GATE DAY ${date} · calls ${fired.length} · TAKE ${take.length} · SKIP ${skip.length} · SKIP by check: parallel ${by("parallel")} · opening ${by("opening")} · late ${by("late")} · chase ${by("chase")} · zone ${by("zone")}`
      + ` · points if every call had been taken ${signed1(pts(fired))} · points of the TAKE calls ${signed1(pts(take))} · skipped winners: ${winners.length ? winners.join(" · ") : "none"}`
      + ` · parallel advice: flagged ${flagged.length} · went out ${out.length} · points of those ${signed1(pts(out))} (winners ${signed1(wonPts)}, losers ${signed1(lostPts)})`
      + ` · zones found: ${(res.zonesFound || []).map(istHM).join(" · ") || "none"} · day health at the last signal (${last ? istHM(last.signalTime) : "-"}): ${last ? signed1(last.gateHealth || 0) : "-"}`;
  }
  const istHM = (t) => { const s = (t + IST_OFFSET) % 86400; return hm(s); };

  // ---- The Loss Cutter (the owner's Loss_Cutter.docx and Sideways_Zone_v3.docx with their reference code, 24 October): entry checks
  // built on the Call Gate version 2, judged beside it on every signal. It changes nothing in the lines, the signals, the firing, the
  // entry price or the exits; it answers TAKE or SKIP with a reason (lc, lcWhy, lcCheck) and writes advice (lcAdvice). In this order:
  //   1. opening window, late rule, chase on the signal candle   as the Call Gate (entryChecks)
  //   2. chase window (new)    the candle before the signal candle was more than chaseWindowAtr x ATR tall and went the same way as
  //                            the call (green for a CE, red for a PE): SKIP. Only the same way; exactly 2.5 x ATR is not more
  //   3. sideways zone, version 3   the Call Gate's zone with a taller box: zoneHeightAtr 2.5 (version 2: 1.5), its own tracker.
  //                            zoneMode "edges": the version 2 judgement inside a zone (zoneVerdict); a call whose trigger (the signal
  //                            candle's high for a CE, low for a PE) or close is beyond the box its way is a breakout. With advice on,
  //                            a TAKE inside a zone that is not a breakout carries "WOULD SKIP (strict zone) ...". zoneMode "breakout":
  //                            inside a zone only a breakout passes (the strict zone, LC_STRICT)
  //   4. worn line (new)       the signal's line has failed wornFailures times in the last wornMinutes: an earlier signal on the same
  //                            line (the same price), born at or after openingUntil, that was cancelled on or before this candle, or
  //                            fired and closed at a loss (index points) on or before it. A breakout from a zone is exempt. wornMode
  //                            "log": advice only (WOULD SKIP ...); "skip": a block; "off"
  //   5. stack cap (new)       when the call fires (the order is placed): stackCap or more calls the same way that the Loss Cutter took
  //                            are still open: SKIP (stackMode "skip") or advice only ("log"); a call it skipped is not counted, nor one
  //                            the other way; lcOpenSame keeps the count. stackCap null: off
  // The premium stop (15% of the premium paid, log only) needs the option's prices: the server's records keep the lowest premium of
  // every call and when it first fell 15% (dhan.py); this engine sees index points only.
  // Mode SHADOW (the documents: "shadow mode first"): every call fires as before, the verdict rides on it. Mode LIVE: a SKIP from a
  // check named in liveChecks holds the order: the call is followed on paper (paper: true), as the Call Gate does. The documents'
  // phase 2 goes live one check at a time, the chase window and the stack cap first. LC_V2 gives the Call Gate version 2's verdict
  // for every signal (the documents' test ZV-14); LC_STRICT switches the two advice-only checks on as blocks
  const LC = { ...GATE, mode: "SHADOW", liveChecks: ["chasewindow", "stack"], zoneHeightAtr: 2.5, zoneMode: "edges", chaseWindow: true, chaseWindowAtr: 2.5,
               stackCap: 3, stackMode: "skip", wornMode: "log", wornFailures: 2, wornMinutes: 120, advice: true, premiumStop: 0.15,
               indices: ["NIFTY 50"] };  // the indices it runs on (the owner, 24 October: "built it for nifty 50 only"; the documents are about NIFTY 50)
  const LC_V2 = { ...LC, zoneHeightAtr: 1.5, chaseWindow: false, stackCap: null, wornMode: "off", advice: false };
  const LC_STRICT = { ...LC, zoneMode: "breakout", wornMode: "skip" };
  const LC_ZONE_ONLY = { ...LC, chaseWindow: false, stackCap: null, wornMode: "off", advice: false };
  // the call leaves the box: its trigger (the signal candle's high for a CE, low for a PE) or its close is beyond the box its way
  const breaksOut = (bar, side, box) => side === "CE" ? bar.high > box.hi || bar.close > box.hi : bar.low < box.lo || bar.close < box.lo;
  function violentBefore(closed, i, side, atr, dayFirst, g) {  // the chase window: the candle before, more than chaseWindowAtr x ATR tall, the same way
    if (i - 1 < dayFirst || atr == null) return false;
    const p = closed[i - 1], same = side === "CE" ? p.close > p.open : p.close < p.open;
    return p.high - p.low > g.chaseWindowAtr * atr && same;
  }
  // The worn line: how many earlier signals on the same line failed within wornMinutes before signal s (born at s.signalTime on the
  // line s.level). history: the signals so far, each { level, signalTime } with cancelTime when it was cancelled before firing, or
  // exit, exitTime (the candle it ended in) and points once it has ended
  function wornFailures(history, s, g) {
    let n = 0;
    for (const e of history) {
      if (e === s || e.level !== s.level || (e.signalTime + IST_OFFSET) % 86400 < g.openingUntil) continue;
      const age = (s.signalTime - e.signalTime) / 60;
      if (!(age > 0 && age <= g.wornMinutes)) continue;
      if (e.cancelTime != null) { if (e.cancelTime <= s.signalTime) n++; }
      else if (e.exit != null && e.exitTime <= s.signalTime && e.points < 0) n++;
    }
    return n;
  }
  // The Loss Cutter's verdict for a signal born on candle i (checks 1 to 4): { lc, why, check, advice }. zone: the Loss Cutter's own
  // zone, brought up to candle i; failures: wornFailures for this signal; line: the line's name for the reason
  function lcVerdict(closed, i, side, atr, zone, failures, dayFirst, g, line) {
    const early = entryChecks(closed, i, side, atr, dayFirst, g);
    if (early) return { lc: "SKIP", why: early.why, check: early.check, advice: "" };
    if (g.chaseWindow && violentBefore(closed, i, side, atr, dayFirst, g)) {
      const p = closed[i - 1];
      return { lc: "SKIP", why: `chase: the candle before was a violent ${side} candle (${num1((p.high - p.low) / atr)} x ATR)`, check: "chasewindow", advice: "" };
    }
    let brokeOut = false, inZone = null, advice = "";
    if (g.zoneRule && zone.box && atr != null) {
      const out = breaksOut(closed[i], side, zone.box);
      if (g.zoneMode === "edges") {
        const v = zoneVerdict(closed, i, side, atr, zone.box, dayFirst, g);
        if (v.gate === "SKIP") return { lc: "SKIP", why: v.why, check: "zone", advice: "" };
        brokeOut = out; inZone = v.why;
        if (g.advice && !out) advice = "WOULD SKIP (strict zone): inside a sideways zone and the call does not break out of it";
      } else if (out) brokeOut = true;
      else return { lc: "SKIP", why: `inside a sideways zone (${num1(zone.box.lo)} to ${num1(zone.box.hi)}, ${num1((zone.box.hi - zone.box.lo) / atr)} x ATR tall): the call does not break out of it`, check: "zone", advice: "" };
    }
    if (g.wornMode !== "off" && !brokeOut && failures >= g.wornFailures) {
      const why = `worn line: ${failures} earlier failures on ${line} in the last ${g.wornMinutes} minutes`;
      if (g.wornMode === "skip") return { lc: "SKIP", why, check: "worn", advice: "" };
      advice = (advice ? advice + " · " : "") + `WOULD SKIP (${why})`;
    }
    return { lc: "TAKE", why: brokeOut ? "breakout from a sideways zone" : inZone || "no check objects", check: null, advice };
  }
  // The stack cap, when the call t fires: open = the calls open at that moment. Writes lcOpenSame and, at the cap, the SKIP or the advice
  function stackStep(t, open, g) {
    const n = open.filter(o => o.side === t.side && o.lc === "TAKE").length;
    t.lcOpenSame = n;
    if (g.stackCap == null || n < g.stackCap) return;
    const why = `stack cap: ${n} calls in the same direction are already open`;
    if (g.stackMode === "skip") { t.lc = "SKIP"; t.lcWhy = why; t.lcCheck = "stack"; if (g.mode === "LIVE" && g.liveChecks.includes("stack") && !t.liveGiven) t.paper = true; }
    else t.lcAdvice = (t.lcAdvice ? t.lcAdvice + " · " : "") + `WOULD SKIP (${why})`;
  }
  // The Loss Cutter's daily line (the documents' scoreboard, one day): what each check flagged and the index points of those calls
  function lcSummary(res, date) {
    const fired = res.trades.filter(t => t.entry != null && t.lc), take = fired.filter(t => t.lc === "TAKE"), skip = fired.filter(t => t.lc === "SKIP");
    const pts = (list) => round2(list.reduce((a, t) => a + (t.points || 0), 0));
    const part = (name, list) => `${name} ${list.length} (${signed1(pts(list))})`;
    const by = (c) => skip.filter(t => t.lcCheck === c);
    const newZone = by("zone").filter(t => !(t.gate === "SKIP" && t.gateCheck === "zone"));  // the zone v3 skips the Call Gate's zone did not make
    const adv = (word) => fired.filter(t => (t.lcAdvice || "").includes(word));
    const winners = skip.filter(t => t.points > 0).map(t => `${istHM(t.signalTime)} ${t.side} ${signed1(t.points)} (${t.lcCheck})`);
    const zones = (res.lcZonesFound || []).map((f, k) => `${istHM(f)}-${res.lcZonesEnded && res.lcZonesEnded[k] != null ? istHM(res.lcZonesEnded[k]) : "open"}`);
    return `LOSS CUTTER DAY ${date} · calls ${fired.length} · TAKE ${take.length} · SKIP ${skip.length} · SKIP by check (calls, points): ${part("opening", by("opening"))} · ${part("chase", by("chase"))}`
      + ` · ${part("chase window", by("chasewindow"))} · ${part("zone", by("zone"))}, of them not skipped by the Call Gate's zone ${newZone.length} (${signed1(pts(newZone))}) · ${part("worn", by("worn"))} · ${part("stack", by("stack"))}`
      + ` · points if every call had been taken ${signed1(pts(fired))} · points of the TAKE calls ${signed1(pts(take))} · skipped winners: ${winners.length ? winners.join(" · ") : "none"}`
      + ` · advice: ${part("worn line", adv("worn line"))} · ${part("strict zone", adv("strict zone"))} · ${part("stack cap", adv("stack cap"))} · zones: ${zones.join(" · ") || "none"}`;
  }

  // ---- The Profit Lock (the owner's "Profit Lock Exit Rule" document, its reference code profit_lock_reference.py and its stress test
  // profit_lock_stress_test.py, 24 October): "An extra exit. It changes nothing in your lines, signals, entries or existing exits."
  // One lock per call, from the candle the call fired on, asked on every closed candle on which the call is still open after all its
  // existing exits (the target, the retouch, the close back, Rule 2, the early exit; never on the day's last candle, whose close is the
  // day end, an existing exit that wins the tie). The peak is the best profit so far in index points (a Buy CE: the candle's high less
  // the entry; a Buy PE: the entry less its low). Armed once the peak reaches armPts; the floor is then the peak less the larger of
  // minTrailPts and (1 - keep) x the peak, never under floorPts, so it never goes down. A candle closing with the call at or under the
  // floor closes the call at that close (less slipPts, the call's way). Candle closes only: a wick under the floor does nothing.
  // The settings are the document's section 3: MAX (the default), STEADY, RUNNER; armPts null is OFF, the line system as it is.
  // Mode SHADOW (the document's phase 1: "The lock runs on every real call but sends no order"): nothing is closed; the lock rides on
  // the call (lock: { peak, peakTime, floor, at, price, points }; at: the candle it first said exit on, null while it has not) and the
  // call goes on to its own exit. Mode LIVE (phase 2): the call ends there, "lock". compare: the other settings, in shadow always, so
  // the shadow days can choose between them (lockAlso: { at, points, peak } or null for each). The settings are index points of
  // NIFTY 50: indices ["NIFTY 50"], as the Loss Cutter. The option's premium at the lock's moment is the server's (dhan.py note_lock)
  const LOCK_PRESETS = { MAX: { armPts: 20, keep: 0.80, minTrailPts: 8, floorPts: 0, slipPts: 0 } };
  LOCK_PRESETS.STEADY = { ...LOCK_PRESETS.MAX, keep: 0.70 };
  LOCK_PRESETS.RUNNER = { ...LOCK_PRESETS.STEADY, minTrailPts: 16 };
  LOCK_PRESETS.OFF = { ...LOCK_PRESETS.MAX, armPts: null };
  const LOCK = { mode: "SHADOW", name: "MAX", ...LOCK_PRESETS.MAX, compare: ["STEADY", "RUNNER"], indices: ["NIFTY 50"] };
  function lockFloor(peak, g) {  // the floor in index points of profit; null while the lock is not armed
    if (g.armPts == null || peak < g.armPts) return null;
    return Math.max(g.floorPts, peak - Math.max(g.minTrailPts, (1 - g.keep) * peak));
  }
  // One closed candle for one call's lock (the reference's ProfitLock.on_candle): st { peak, peakTime } is changed in place; returns the
  // exit { price, points, floor }, or null to hold
  function lockStep(st, side, entry, bar, g) {
    const d = side === "CE" ? 1 : -1, best = d * ((d === 1 ? bar.high : bar.low) - entry);
    if (best > st.peak) { st.peak = best; st.peakTime = bar.time; }
    const floor = lockFloor(st.peak, g), profit = d * (bar.close - entry);
    if (floor == null || profit > floor) return null;
    const price = bar.close - d * g.slipPts;
    return { price, points: d * (price - entry), floor };
  }
  // The Profit Lock's daily line (the document's section 7 and the shadow report of section 11, one day, index points): the calls that
  // went out, what they made as they ended, what they would have made with the lock, the winners' give-up and the losers' gain
  function lockSummary(res, date, g) {
    const fired = res.trades.filter(t => t.entry != null && !t.paper && t.exit != null);
    const pts = (list, f) => round2(list.reduce((a, t) => a + f(t), 0));
    const withLock = (t) => t.lock && t.lock.at != null ? t.lock.points : t.points;
    const said = fired.filter(t => t.lock && t.lock.at != null);
    const giveUp = pts(fired.filter(t => t.points > 0), t => Math.max(0, t.points - withLock(t))), gainOn = pts(fired.filter(t => t.points <= 0), t => Math.max(0, withLock(t) - t.points));
    const also = (g.compare || []).map(n => { const hit = (t) => t.lockAlso && t.lockAlso[n]; return `${n} ${signed1(pts(fired, t => hit(t) ? hit(t).points : t.points))} (${fired.filter(hit).length} exits)`; });
    const exits = said.map(t => `${istHM(t.signalTime)} ${t.side} ${istHM(t.lock.at)} ${signed1(t.lock.points)} (best ${signed1(t.lock.peak)}, ended ${signed1(t.points)})`);
    return `PROFIT LOCK DAY ${date} · ${g.name} ${g.mode} · calls ${fired.length} · the lock said exit on ${said.length} · points as the calls ended ${signed1(pts(fired, t => t.points))}`
      + ` · with the lock ${signed1(pts(fired, withLock))} · winners given up ${signed1(giveUp)} · losers saved ${signed1(gainOn)}${also.length ? " · " + also.join(" · ") : ""} · exits: ${exits.join(" · ") || "none"}`;
  }

  // ---- Layer 3: the paper calls the rule gives on a list of candles.
  //   bars       the session's candles, oldest first (several days together are allowed: a new day ends the old day's calls)
  //   levelsAt   (i) => the levels bars[i] is judged against, sorted by price; a constant list for levels that do not move
  //   targetsAt  (i) => the lines a call's target follows while bars[i] forms (the chart's lines); levelsAt when not given
  //   now        the server's clock: candles that have closed by it are judged, the one forming now runs the open calls
  //   seconds    the size of one candle; dayCandles: a day is one candle, so no day end; signal: "held", "crossed" or "both"
  //   prevClose  the close before the first candle (the previous day's): with it the first candle is judged too (18 October)
  //   the signal the moment a candle closes (layer 2); the call fires when a later candle's price goes past the signal candle's
  //              high (a Buy CE) or low (a Buy PE), and enters at that price, or at the candle's open when it opened past it
  //              (18 October, the owner: "follow up candle ... crossed above the high of the 9.15 candle then it should fire buy
  //              CE call"; "above the 9:15 high"); any later candle may fire it, until a candle closes back across the signal's
  //              line, which cancels it (the owner's B). Until 18 October the call entered at the next candle's open. The target
  //              is the next level in the call's direction (one further when the entry is already past it, enterAt), reached
  //              tick by tick (the forming candle counts); no stop; a call still open at the day's last candle ends at its close.
  //              Every signal gives a call: a second one the same way while another is held runs beside it, marked parallel
  //              (the owner, 18 October: "Can be bought parallelly ... it will be my decision"); the same-way block that stopped
  //              it until then is gone, as are ideas 13, 8 and 5 ("all three remove")
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
  //              only when C1 opened on the far side of the line), or (C) at the day end. Bounce (held) calls keep their target.
  //              No idea P4 to P7 on it
  //   trail      with holdBreaks, Rule 2 of the owner's specification (9 October; trailStep above, TRAIL): once a closed candle
  //              closes beyond a further line than the one the call broke (judged on levelsAt, as the signals), the held break's
  //              stop moves to that line, and on to each further line crossed; it is sold at the close of a candle closing back
  //              past the stop ("trail"). From then on exits A and B are no longer used (the stop has taken A's place); the day end
  //              still is. Off when not given: Rule 1 alone, as before 9 October
  //   given      the calls given live, { signal candle's time: "CE" or "PE" } (the server's records of their options): each stays,
  //              whatever the candle's final prices say (keptAt above). The replays have none
  //   newHighLow idea 24 (NEW_HIGH_LOW and pastEdgeAt above; "Today so far" lines only, which no Levels choice uses since 15
  //              October): a candle closing past the top or bottom line, when no line gives a signal, gives a Crossed call past it (edge)
  //   minutes    the session's one-minute candles, for the owner's early exit of a held break (19 October: "if the candle stays above
  //              the previous candle's close more than a 2.5 minute and also crossed one previous level which is a double
  //              confirmation then it should fire Take exit call for previous Hold call"): inside a candle, at the close of the
  //              first minute by whose end (1) the last three minutes, more than 2.5, all stayed on the exit side of the close
  //              before this candle, every tick of them (a Buy PE: their lows above it; a Buy CE: their highs below it), and (2)
  //              that minute closed across the first line beyond that close on the exit side, one level back ("early"; exitAt:
  //              the minute's end). Judged on the minutes the same way live and in a replay; without them (null) nothing changes.
  //              A retouch earlier in the same candle still comes first. Bounce (held) calls keep their target
  //   gate       the Call Gate (GATE above, version 2), judged on every signal the moment it is born: in mode SHADOW the verdict, its
  //              reason, the check that decided and the parallel advice ride on the call (gate, gateWhy, gateCheck, gateHealth, gateAdvice) and nothing else changes; in
  //              mode LIVE a SKIP from a live check is followed on paper (paper: true, no order). The signals cancelled before firing come
  //              back in `cancelled` with their verdicts, the zones found in `zonesFound`. null: no gate (the research engine's comparisons)
  //   atrSeed    the gate's ATR carried in from the previous day (atrSeedOf over its candles); null: the plain average of the first 14
  //   profitLock the Profit Lock (LOCK above, 24 October), after every existing exit of a closed candle: in mode SHADOW its peak, floor and
  //              the candle it would have closed the call on ride on the call (lock, lockAlso) and nothing else changes; in mode LIVE
  //              the call ends there ("lock"). null: no lock
  function paperTrades({ bars, levelsAt, targetsAt, now, seconds, dayCandles, signal, ideas, holdBreaks, trail, given, newHighLow, prevClose, minutes, gate = GATE, atrSeed = null, lossCutter = LC, profitLock = LOCK, tradePlan = PLAN, builder = BUILDER }) {
    const linesAt = targetsAt || levelsAt;
    const closeAt = ideas && ideas.closeAt, noNewAfter = ideas && ideas.noNewAfter, minDepth = ideas && ideas.minDepth, exitBack = ideas && ideas.exitBack;
    const carryOn = ideas && ideas.carryOn != null ? ideas.carryOn : null;
    const stopShare = ideas && ideas.stopShare, stopMinutes = (ideas && ideas.minutes) || null;  // the stop ideas settle by the minutes they are given
    const clockEnd = (b) => (b.time + IST_OFFSET) % 86400 + seconds;  // when the candle closes, in seconds since midnight IST
    const closed = bars.filter(b => endOf(b, seconds) <= now);
    const forming = bars.length > closed.length ? bars[closed.length] : null;  // the candle forming now, built from the ticks
    const atr = trail && trail.buffer === "atr" ? atrBefore(closed, trail.period || 14) : null;
    const g = gate || null, lc = lossCutter || null, gateAtrs = g || lc ? gateAtr(closed, (g || lc).atrPeriod, atrSeed, prevClose) : null, zone = { box: null, broke: null, found: [] }, cancelled = [];  // the Call Gate's ATR, its sideways zone, the signals cancelled before firing
    const lcZone = { box: null, broke: null, found: [], ended: [] };  // the Loss Cutter's own sideways zone (version 3: the taller box)
    const pl = profitLock || null, locks = new Map();  // the Profit Lock: open call -> its lock's state (the main setting's and the compared settings')
    let dayFirst = 0;  // the index of the day's first closed candle (the zone and the strong-candle checks stay inside the day)
    const bufferAt = (i) => !trail ? 0 : trail.buffer === "fixed" ? trail.points : trail.buffer === "atr" ? (atr[i] != null ? trail.mult * atr[i] : trail.points || 0) : 0;  // Rule 2's buffer for closed candle i
    const trailLines = (levels) => trail.lines === "all" ? levels : levels.filter(l => l.ratio !== 0 && Math.abs(l.ratio) !== 1);  // the lines that move Rule 2's stop (setting "middle": without 0% and 100%; only research settings use it, the page, the watcher and the replays run "all")
    const gain = (t, price) => round2(t.side === "CE" ? price - t.entry : t.entry - price);  // index points
    const end = (t, price, bar, how) => { t.exit = price; t.exitTime = bar.time; t.how = how; t.points = gain(t, price); };
    const reaches = (t, bar) => t.side === "CE" ? bar.high >= t.target : bar.low <= t.target;
    const beyondOf = (t, levels) => {  // the lines past the call's entry and level, in its direction, nearest first
      const past = t.side === "CE" ? Math.max(t.entry, t.level) : Math.min(t.entry, t.level);
      const prices = levels.map(l => l.price);
      return t.side === "CE" ? prices.filter(p => p > past) : prices.filter(p => p < past).reverse();
    };
    const follow = (t, levels) => {  // the target on the lines as they stand (and the ladder beyond it, for idea P5, one step further per carry)
      const beyond = beyondOf(t, levels), k = t.carried || 0;
      if (beyond.length > k) { t.target = beyond[k]; t.ladder = beyond.slice(k + 1); }  // no line that far out (the entry at the day's high): it stays
    };
    // The target reached (the owner, 12 October: NIFTY 50's 9:40 Buy CE was sold "at the target" at 9:54 with the index at
    // 22,475 and the premium down 20%). A candle that brings the target closer (its own new low for a Buy CE, high for a Buy
    // PE, moved the lines; on 12 October the 9:50 candle went up to 22,523.90 and then down to a new low of 22,472.15, which
    // pulled the 23.6% line from 22,542 to 22,514.38) may have made its high or low before the move: that counts only
    // against the target as it stood before the candle; the moved target counts on the close (on the candle forming now,
    // the price now), which came after the move. Until then the earlier high counted against the moved target
    const came = new Map();  // open call -> its target on the lines as they stood before this candle
    const targetOn = (t, levels) => { const beyond = beyondOf(t, levels), k = t.carried || 0; return beyond.length > k ? beyond[k] : t.target; };
    const hits = (t, bar) => {
      const was = came.get(t), nearer = was != null && (t.side === "CE" ? t.target < was : t.target > was);
      if (!nearer) return reaches(t, bar);
      return t.side === "CE" ? bar.high >= was || bar.close >= t.target : bar.low <= was || bar.close <= t.target;
    };
    const touchesStop = (t, bar) => t.stop != null && (t.side === "CE" ? bar.low <= t.stop : bar.high >= t.stop);
    const stopFirst = (t, bar) => {  // the candle touched the stop: did the stop come before the target? (ideas P6, P7)
      if (!reaches(t, bar) || !stopMinutes) return true;
      for (const m of stopMinutes) {
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
    const mins = minutes && minutes.length ? minutes : null;  // the owner's early exit (19 October) runs on the session's one-minute candles
    const lineBack = (t, levels, P) => { const prices = levels.map(l => l.price); return t.side === "PE" ? prices.find(p => p > P) : prices.slice().reverse().find(p => p < P); };  // one level back from the close before the candle, on the exit side
    // A call that fired inside this candle (18 October: at the break of the signal candle's high or low) is judged on the part of the
    // candle after it fired (the owner, 19 October: the 2:05 Buy PE was sold on the 2:10 candle, which closed below its line and below
    // the 2:05 close; the candle's earlier part, before the call fired, had been counted). With the minutes known, that part runs from
    // the minute the price broke through in; a call that fired in the minute forming now has no closed minute after it yet, so only
    // the price now counts. Without the minutes the whole candle counts, as before
    const fireMinute = (t, bar) => {  // the minute the call fired in, when it fired in this candle and the minutes are known; else null
      if (!mins || t.entryTime !== bar.time) return null;
      const m = mins.find(m => m.time >= bar.time && m.time < bar.time + seconds && m.time + 60 <= now && (t.side === "PE" ? m.low <= t.entry : m.high >= t.entry));
      return m ? m.time : null;
    };
    const sinceFire = (t, bar, priceNow) => {  // the candle from the fire on: its high and low over the closed minutes from the fire minute, and the price now
      if (!mins || t.entryTime !== bar.time) return bar;
      const from = fireMinute(t, bar);
      if (from == null) return priceNow != null ? { ...bar, high: priceNow, low: priceNow } : bar;
      let high = -Infinity, low = Infinity;
      for (const m of mins) if (m.time >= from && m.time < bar.time + seconds && m.time + 60 <= now) { high = Math.max(high, m.high); low = Math.min(low, m.low); }
      if (priceNow != null) { high = Math.max(high, priceNow); low = Math.min(low, priceNow); }
      return { ...bar, high, low };
    };
    const early = (t, bar, P, levels) => {  // the minute the double confirmation came in this candle: { m, high, low } (the candle up to that minute), or null
      if (!mins || !t.hold || P == null) return null;
      const L = lineBack(t, levels, P);
      if (L == null) return null;
      const from = fireMinute(t, bar);  // a call fired in this candle: its minutes from the fire on
      if (t.entryTime === bar.time && from == null) return null;  // fired in the minute forming now: nothing closed after it yet
      let run = 0, prev = null, high = -Infinity, low = Infinity;
      for (const m of mins) {
        if (m.time < bar.time || m.time + 60 > bar.time + seconds || m.time + 60 > now || (from != null && m.time < from)) continue;  // this candle's closed minutes only, from the fire on
        high = Math.max(high, m.high); low = Math.min(low, m.low);
        const ok = t.side === "PE" ? m.low > P : m.high < P;  // every tick of the minute on the exit side
        run = ok && (prev == null || m.time === prev + 60) ? run + 1 : ok ? 1 : 0;  // a missing minute breaks the run
        prev = m.time;
        if (run >= 3 && (t.side === "PE" ? m.close > L : m.close < L)) return { m, high, low };
      }
      return null;
    };
    const earlyExit = (t, bar, P, levels) => {  // true when the call ended inside this candle: at the double confirmation, or at a retouch before it
      const e = early(t, bar, P, levels);
      if (!e) return false;
      if (!t.trail && retouch(t, { ...bar, high: e.high, low: e.low }, P)) { end(t, t.c1Open, bar, "retouch"); return true; }
      end(t, e.m.close, bar, "early"); t.exitAt = e.m.time + 60; t.earlyFrom = P; t.earlyLine = lineBack(t, levels, P);  // the minute's end, the close it stayed beyond, the line it crossed back
      return true;
    };
    const settle = (t, bar, prevClose, levels, buf) => {  // the target reached within this closed candle: idea P5 may carry the call on to the level beyond, else it ends at the target
      if (t.hold) {  // a held break: exit B, then exit A at the close (Rule 1); the target does not end it
        if (!t.trail) {
          if (retouch(t, sinceFire(t, bar), prevClose)) { end(t, t.c1Open, bar, "retouch"); return false; }  // on the part of the candle after the call fired
          if (t.side === "PE" ? bar.close > t.level : bar.close < t.level) { end(t, bar.close, bar, "back"); return false; }
        }
        if (trail) {  // Rule 2: the stop on the lines crossed since, from the line the call broke
          const st = t.trail || { stop: t.level, stopRatio: t.ratio, line: null, ratio: null };
          if (trailStep(st, bar.close, trailLines(levels), t.side, trail.place, buf) === "sell") { end(t, bar.close, bar, "trail"); return false; }
          if (st.line != null) t.trail = st;  // the first further line crossed: Rule 2 from now on
        }
        return true;
      }
      while (hits(t, bar)) {
        const beyond = carryOn != null && t.ladder.length ? t.ladder[0] : null;
        if (beyond != null && (t.side === "CE" ? bar.close - t.target : t.target - bar.close) >= carryOn * Math.abs(beyond - t.target)) {
          t.carried = (t.carried || 0) + 1; t.target = beyond; t.ladder = t.ladder.slice(1); continue;  // and the same candle may have reached the next one too
        }
        end(t, t.target, bar, "target"); return false;
      }
      return true;
    };
    const newDay = (a, b) => !dayCandles && dayOf(a.time) !== dayOf(b.time);
    const last = closed[closed.length - 1];
    const over = dayCandles ? false : last ? dayOver(dayOf(last.time), now) : true;  // day candles: no day end
    const dayLast = (i) => i + 1 < closed.length ? newDay(closed[i + 1], closed[i]) : over;  // the day's last candle: its close is the day end
    const lockAsk = (t, bar) => {  // the Profit Lock on one closed candle, the call still open after its existing exits; false: the lock closed it (LIVE)
      if (t.entry == null) return true;
      let s = locks.get(t);
      if (!s) {  // asked for the first time: the candle the call fired on, or the first one after it that did not end it
        s = { main: { peak: 0, peakTime: null }, also: {} };
        t.lock = { peak: 0, peakTime: null, floor: null, at: null, price: null, points: null };
        if (pl.compare && pl.compare.length) { t.lockAlso = {}; for (const n of pl.compare) { s.also[n] = { peak: 0, peakTime: null }; t.lockAlso[n] = null; } }
        locks.set(t, s);
      }
      for (const n of pl.compare || []) {  // the other settings, in shadow
        if (t.lockAlso[n]) continue;
        const hit = lockStep(s.also[n], t.side, t.entry, bar, LOCK_PRESETS[n]);
        if (hit) t.lockAlso[n] = { at: bar.time, points: round2(hit.points), peak: round2(s.also[n].peak) };
      }
      if (t.lock.at != null) return true;  // shadow: the lock said exit on an earlier candle; the call goes on to its own exit
      const hit = lockStep(s.main, t.side, t.entry, bar, pl), floor = lockFloor(s.main.peak, pl);
      t.lock.peak = round2(s.main.peak); t.lock.peakTime = s.main.peakTime; t.lock.floor = floor == null ? null : round2(floor);
      if (!hit) return true;
      t.lock.at = bar.time; t.lock.price = round2(hit.price); t.lock.points = round2(hit.points);
      if (pl.mode === "LIVE") { end(t, round2(hit.price), bar, "lock"); return false; }
      return true;
    };
    const trades = [];
    const used = {};  // "price|side" -> { price, side } while the line at that price has given a call that way
    let armed = [], open = [];  // armed: the signals waiting to fire (18 October), each with fireAt, its candle's high (CE) or low (PE)
    const firePrice = (s, bar) => (s.side === "CE" ? bar.high > s.fireAt : bar.low < s.fireAt) ? (s.side === "CE" ? Math.max(s.fireAt, bar.open) : Math.min(s.fireAt, bar.open)) : null;
    const fire = (bar) => { armed = armed.filter(s => { const price = firePrice(s, bar); if (price == null) return true;  // the price went past the signal candle's high or low: the call enters there
      const t = enterAt(s, bar, price); if (t) { if (open.some(o => o.side === t.side)) t.parallel = true; if (lc && t.lc === "TAKE") stackStep(t, open, lc); trades.push(t); open.push(t); } return false; }); };  // parallel: another call the same way is held; the Loss Cutter's stack cap, as the order is placed
    const first = prevClose != null ? 0 : 1;  // the first candle is judged from the previous day's close when it is known (18 October)
    for (let i = first; i < closed.length; i++) {
      const bar = closed[i], prevBar = i > 0 ? closed[i - 1] : null, before = prevBar ? prevBar.close : prevClose;  // the close before this candle
      if (prevBar && newDay(bar, prevBar)) {  // a new day: yesterday's calls ended with yesterday, and its waiting signals are gone
        open.forEach(t => end(t, prevBar.close, prevBar, "day end")); open = []; armed = []; dayFirst = i; zone.box = null; zone.broke = null; lcZone.box = null; lcZone.broke = null;
      }
      fire(bar);  // the signals of earlier candles, fired by this candle's prices before its close is judged
      const levels = levelsAt(i), lines = linesAt(i), linesBefore = linesAt(Math.max(0, i - 1));
      open.forEach(t => { came.set(t, targetOn(t, linesBefore)); follow(t, lines); if (stopShare && !t.hold && t.stop == null) t.stop = round2(t.side === "CE" ? t.entry - stopShare * (t.target - t.entry) : t.entry + stopShare * (t.entry - t.target)); });
      if (stopShare) open = open.filter(t => { if (!t.hold && touchesStop(t, bar) && stopFirst(t, bar)) { end(t, t.stop, bar, "stop"); return false; } return true; });  // ideas P6, P7
      open = open.filter(t => !earlyExit(t, bar, before, levels));  // the owner's early exit, inside the candle (19 October), before the candle's close is judged
      open = open.filter(t => settle(t, bar, before, levels, bufferAt(i)));
      if (exitBack) open = open.filter(t => { if (!t.hold && backAcross(t, bar.close) >= exitBack * Math.abs(t.target - t.level)) { end(t, bar.close, bar, "candle"); return false; } return true; });  // idea P4: the candle says exit, at its close
      if (closeAt && !dayCandles && clockEnd(bar) >= closeAt) { open.forEach(t => end(t, bar.close, bar, "time")); open = []; }  // idea P1: the clock ends the open calls
      if (pl && !dayLast(i)) open = open.filter(t => lockAsk(t, bar));  // the Profit Lock, after every existing exit of this candle (never on the day's last one: its close is the day end)
      for (const k in used) { const u = used[k]; if (u.side === "CE" ? bar.close < u.price : bar.close > u.price) delete used[k]; }  // closed back across: the line may call again
      armed = armed.filter(s => { const gone = s.side === "CE" ? bar.close < s.level : bar.close > s.level;  // a close back across its line cancels a signal still waiting to fire (the owner's B, 18 October)
        if (gone && (g || lc)) { const { prices, fireAt, ...rest } = s; cancelled.push({ ...rest, how: "cancelled", cancelTime: bar.time }); } return !gone; });
      const from = (L) => { for (let j = i - 1; j >= 0; j--) if (closed[j].close !== L) return closed[j].close; return before; };  // the last close off line L
      if (g) zoneStep(zone, closed, i, gateAtrs[i], dayFirst, g);  // the Call Gate's zone, brought up to this candle before any signal on it is judged
      if (lc) zoneStep(lcZone, closed, i, gateAtrs[i], dayFirst, lc);  // and the Loss Cutter's
      let sig = signalAt(bar, before, levels, used, signal, from);  // the signal, at the candle's close
      if (!sig && newHighLow && signal !== "held") sig = pastEdgeAt(bar, levels, used);  // idea 24: a close past the day's high or low
      const was = given && given[bar.time];  // a call given live at this candle (its option recorded): it stays
      if (was && !(sig && sig.side === was)) sig = keptAt(bar, levels, from, was) || sig;
      if (sig && holdBreaks && sig.kind === "crossed") { sig.hold = true; sig.c1Open = bar.open; }  // C1, the signal candle: its open is where the break began
      const late = !dayCandles && ((noNewAfter && clockEnd(bar) > noNewAfter) || (closeAt && clockEnd(bar) >= closeAt));  // ideas P2 and P1: too late in the day for a new call
      const depth = sig && sig.kind === "crossed" && sig.target != null && sig.target !== sig.level ? Math.abs(sig.close - sig.level) / Math.abs(sig.target - sig.level) : null;  // how far past its line the candle closed, a share of the gap to the next line
      const shallow = depth != null && !sig.hold && !!minDepth && depth < minDepth;  // idea P3
      if (sig && (was || (!late && !shallow))) {
        if (g) {  // the Call Gate, the moment the signal is born: day health = this day's signals that have fired and exited by now, taken or on paper
          const health = round2(trades.filter(t => t.exit != null && t.signalTime >= closed[dayFirst].time).reduce((a, t) => a + t.points, 0));
          const parallel = open.some(o => o.side === sig.side), v = gateVerdict(closed, i, sig.side, gateAtrs[i], zone, parallel, health, dayFirst, g);
          sig.gate = v.gate; sig.gateWhy = v.why; sig.gateCheck = v.check; sig.gateHealth = health;
          sig.gateAdvice = g.parallel === "log" || g.parallel === "health" ? parallelAdvice(parallel, health, gateAtrs[i], g) : "";  // the note on a parallel call
          if (v.gate === "SKIP" && g.mode === "LIVE" && g.liveChecks.includes(v.check) && !was) sig.paper = true;  // a live check held the order: followed on paper, no order
        }
        if (lc) {  // the Loss Cutter, beside it: checks 1 to 4 now, the stack cap when the call fires
          const fails = lc.wornMode !== "off" ? wornFailures(trades.concat(cancelled), { level: sig.level, signalTime: bar.time }, lc) : 0;
          const v = lcVerdict(closed, i, sig.side, gateAtrs[i], lcZone, fails, dayFirst, lc, levelName(sig.ratio, sig.signed));
          sig.lc = v.lc; sig.lcWhy = v.why; sig.lcCheck = v.check; sig.lcAdvice = v.advice; sig.lcFailures = fails;
          if (was) sig.liveGiven = true;  // given live (its option recorded): the stack cap never turns it into a paper call
          if (v.lc === "SKIP" && lc.mode === "LIVE" && lc.liveChecks.includes(v.check) && !was) sig.paper = true;
        }
        used[sig.level + "|" + sig.side] = { price: sig.level, side: sig.side };  // the no-repeat lock, taken or skipped
        armed.push({ ...sig, fireAt: sig.side === "CE" ? bar.high : bar.low });
      }
    }
    if (forming && last && !over && !newDay(forming, last)) {  // the candle forming now: a waiting signal fires on its price so far, and open calls run on its live price
      fire(forming);
      const lines = linesAt(closed.length), linesBefore = linesAt(closed.length - 1);  // the lines as the chart draws them now, with the forming candle in the day's range
      open.forEach(t => { came.set(t, targetOn(t, linesBefore)); follow(t, lines); if (stopShare && !t.hold && t.stop == null) t.stop = round2(t.side === "CE" ? t.entry - stopShare * (t.target - t.entry) : t.entry + stopShare * (t.entry - t.target)); });
      if (stopShare) open = open.filter(t => { if (!t.hold && touchesStop(t, forming)) { end(t, t.stop, forming, "stop"); return false; } return true; });  // ideas P6, P7, tick by tick
      open = open.filter(t => !earlyExit(t, forming, last.close, levelsAt(closed.length)));  // the early exit on the minutes closed so far of the candle forming now
      open = open.filter(t => { if (t.hold) { if (!t.trail && retouch(t, sinceFire(t, forming, forming.close), last.close)) { end(t, t.c1Open, forming, "retouch"); return false; } return true; }  // exit B tick by tick, on the part after the call fired; exit A and Rule 2 wait for the close
                                if (!hits(t, forming)) return true; if (carryOn != null && t.ladder.length) return true;  // idea P5: the decision waits for the close
                                end(t, t.target, forming, "target"); return false; });
      open.forEach(t => { t.points = gain(t, forming.close); t.last = forming.close; });  // last: the price the open call's points are at
    } else {
      open.forEach(t => { if (over) end(t, last.close, last, "day end"); else { t.points = gain(t, last.close); t.last = last.close; } });
    }
    if (tradePlan) planStep(trades, tradePlan);  // the Trade Plan's mark on every call that fired (29 October)
    if (builder) builderStep(trades, bars, { prevClose, atrSeed }, builder);  // the rule builder's mark on every call that fired (30 October)
    return { trades, closed: closed.length, cancelled, zonesFound: zone.found, lcZonesFound: lcZone.found, lcZonesEnded: lcZone.ended };
  }

  // A finished day replayed: every candle has closed, so the clock is set past the day's end. "Previous day" levels
  // stand still; "today so far" levels are the ones the page draws while each candle forms: the day's range up to the
  // candle before it (todayLevelsAt). The owner's exit rule for breaks (holdBreaks) is on, as on the index page, with Rule 2 as
  // the index page runs it (TRAIL); the research engine may give another setting of it, or null for Rule 1 alone. Idea 24 when
  // asked for, on "today so far" lines only. The first candle is judged from the previous day's close (18 October)
  function replayDay({ bars, move, previous, seconds, signal, ideas, trail, newHighLow, minutes, gate = GATE, atrSeed = null, lossCutter = LC, profitLock = LOCK, tradePlan = PLAN, builder = BUILDER }) {
    const own = move === "prev" || move === "close";  // the previous day's lines, or the previous close's (15 October): not today's range so far
    const fixed = move === "prev" ? (previous ? levelsOf(moveOfDay(previous)) : null) : null, fromClose = move === "close" && previous ? closeLevelsAt(bars, previous.close) : null;
    if ((move === "prev" && !fixed) || (move === "close" && !fromClose)) return { trades: [], closed: 0 };
    const levelsAt = move === "prev" ? () => fixed : move === "close" ? fromClose : todayLevelsAt(bars), targetsAt = own ? null : todayLinesAt(bars);
    return paperTrades({ bars, levelsAt, targetsAt, now: Number.POSITIVE_INFINITY, seconds, dayCandles: false, signal, ideas, holdBreaks: true,
                         trail: trail === undefined ? TRAIL : trail, newHighLow: !own && !!newHighLow, prevClose: own && previous && previous.close != null ? previous.close : null,  // not on today's range: the first candle has no lines before it
                         minutes: minutes || null, gate, atrSeed, lossCutter, profitLock, tradePlan, builder });  // the day's one-minute candles: the owner's early exit (19 October); the Call Gate and its ATR seed; the Loss Cutter; the Profit Lock
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
    if (t.hold) {  // a held break (holdBreaks): the verdict is the owner's exit rule itself, worded for the line its stop is on (Rule 2: the line it moved to)
      const ratio = t.trail ? t.trail.stopRatio : t.ratio;
      const name = ratio == null ? "the level" : `the ${levelName(ratio, t.signed)} level`, pe = t.side === "PE";
      const word = t.how === "back" || t.how === "retouch" || t.how === "trail" || t.how === "early" ? "exit" : "carry";
      const why = t.how === "back" || t.how === "trail" ? `price closed back ${pe ? "above" : "below"} ${name}` : t.how === "retouch" ? `price came back to where the ${pe ? "fall" : "rise"} started`
        : t.how === "early" ? `price stayed ${pe ? "above" : "below"} the previous close for 3 minutes and crossed one level back`
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
    const level = t.ratio == null ? "the level" : `the ${levelName(t.ratio, t.signed)} level`;
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


  // ---- The Trade Plan (the owner, 29 October night, after "the widest honest search": 8,404,992 combinations of this engine's own
  // settings over the 20 saved days, each chosen on the first 10 days and judged on the next 10 untouched. The one simple rule that
  // passed: on NIFTY 50, the first 3 calls that FIRE at or after 12:00 and before 15:00, nothing else: +928 points after 8 a call on
  // the first half, +79 on the second, +1,007 in all, 13 days up and 7 down, worst day -103; the page as it runs, -990. The owner's
  // morning calls are the loser: the 10 o'clock hour alone -722). Mode SHADOW: a mark on every call that fired, "TAKE" (call 1, 2 or
  // 3 of 3) or "SKIP" (fired before 12:00, at or after 15:00, or the 3 taken), planWhy says which; every call keeps its row and its
  // order, and the page's "Trade Plan only" view shows the plan's calls alone. Mode LIVE (not built; the owner's yes decides) would
  // place no order for the others. Counted by the moment each call fired (entryTime), the earliest first; two firing on one candle
  // both count; a call that has not fired yet, or a signal cancelled before firing, has no verdict. A pure pass over the day's calls
  // once they are known (planStep, at the end of paperTrades), so the page and the server (rule.py plan_step) mark the same calls
  const PLAN = { mode: "SHADOW", name: "afternoon 3", indices: ["NIFTY 50"], from: "12:00", to: "15:00", maxCalls: 3 };
  // ---- THE RULE BUILDER (the owner, 30 October: "i want him to do rule building based on the data"; then "yes" to the marks on the page).
  // ULTROAN's evening builder (scratchpad wf/build_rules.js) reads every call the page gave on the saved days with the FACTS of the moment
  // it fired (callFacts below, the same code), tries every fact and every pair of facts as a rule "keep only these calls", and keeps the
  // rules that earn on both halves of the days, up on more days than down, not on one lucky day. The survivors are listed here with the
  // day they were found; from that day on only new days judge them (the evening's forward score). Mode SHADOW: a mark on every call that
  // fired, "KEEP" when one of the rules matches its facts (which ones, in builderWhy) or "SKIP"; no order, nothing else changes.
  // The facts, each from the candles up to the signal candle and the calls before this one (no peeking): the hour the call fired, the
  // side, the line (above or below the previous close, near or far: half the step or more), the signal candle (its body and size in
  // ATR), the move of the 6 candles before (in ATR) and whether the call goes with it, the day's gap at the open, the day's range so far,
  // the call's number that day, how the last call ended (won, lost, or still open when this one fired), calm or wild days (the ATR
  // carried in against the median of the saved days), the weekday, where the close sits in the day's range, before or after 12:00
  const BUILDER = { mode: "SHADOW", indices: ["NIFTY 50"], medianAtr: 20.82269926267992,  // the median of the 20 saved days' carried-in ATR (NIFTY 50, 29 October)
    rules: [  // the survivors of the first run (20 days to 29 October, 1,457 rules tried); the evening builder keeps their forward score
    { name: "green + after 12:00", foundOn: "2026-10-29", facts: [["candle", "green"], ["afterNoon", "after 12:00"]] },
    { name: "above the close + calm days", foundOn: "2026-10-29", facts: [["line", "above the close"], ["atrRegime", "calm days"]] },
    { name: "near line + fell", foundOn: "2026-10-29", facts: [["lineFar", "near line"], ["move", "fell"]] },
    { name: "9 + above the close", foundOn: "2026-10-29", facts: [["hour", "9"], ["line", "above the close"]] },
    { name: "Wed + after 12:00", foundOn: "2026-10-29", facts: [["weekday", "Wed"], ["afterNoon", "after 12:00"]] }
    ] };
  function atrPath(bars, seed, period = 14) {  // Wilder's ATR through the day's candles from the carried-in seed (null: from the first candle's range)
    const out = []; let a = seed == null ? null : seed;
    for (let j = 0; j < bars.length; j++) { const tr = trueRange(bars[j], j > 0 ? bars[j - 1].close : null); a = a == null ? tr : (a * (period - 1) + tr) / period; out.push(a); }
    return out;
  }
  const bucketOf = (x, edges, names) => { for (let i = 0; i < edges.length; i++) if (x < edges[i]) return names[i]; return names[edges.length]; };
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function callFacts(t, fired, n, bars, atrs, { prevClose = null, atrSeed = null, medianAtr = 0 }) {  // the facts of call t, the n-th of the day's fired calls
    const k0 = bars.findIndex(b => b.time === t.signalTime); if (k0 < 0) return null;
    const c = bars[k0], a = atrs[k0] || 1, body = (c.close - c.open) / a, range = (c.high - c.low) / a;
    const move6 = k0 >= 6 ? (c.close - bars[k0 - 6].close) / a : 0, gap = prevClose == null ? 0 : (bars[0].open - prevClose) / a;
    let hi = -Infinity, lo = Infinity; for (let j = 0; j <= k0; j++) { hi = Math.max(hi, bars[j].high); lo = Math.min(lo, bars[j].low); }
    const place = (c.close - lo) / Math.max(hi - lo, 1e-9), last = n > 0 ? fired[n - 1] : null, when = istHM(t.entryTime);
    return {
      hour: String(Math.floor(((t.entryTime + IST_OFFSET) % 86400) / 3600)), side: t.side,
      line: t.ratio > 0 ? "above the close" : t.ratio < 0 ? "below the close" : "the close line", lineFar: Math.abs(t.ratio) >= 0.5 ? "far line" : "near line",
      candle: bucketOf(body, [-1, -0.3, 0.3, 1], ["big red", "red", "small", "green", "big green"]), candleSize: bucketOf(range, [0.8, 1.6], ["small candle", "normal candle", "big candle"]),
      move: bucketOf(move6, [-2, -0.7, 0.7, 2], ["fell a lot", "fell", "flat", "rose", "rose a lot"]), withMove: (t.side === "CE") === (move6 > 0) ? "with the move" : "against the move",
      gap: bucketOf(gap, [-1, 1], ["gap down", "flat open", "gap up"]), dayRange: bucketOf((hi - lo) / a, [3, 6], ["quiet day so far", "normal day so far", "wide day so far"]),
      nth: n === 0 ? "1st call" : n === 1 ? "2nd call" : n === 2 ? "3rd call" : "4th or later",
      lastCall: !last ? "no call before" : last.exitTime != null && last.exitTime <= t.entryTime ? (last.points > 0 ? "last call won" : "last call lost") : "last call open",
      atrRegime: atrSeed != null && atrSeed >= medianAtr ? "wild days" : "calm days", weekday: WEEKDAYS[new Date((bars[0].time + IST_OFFSET) * 1000).getUTCDay()],
      place: place > 0.7 ? "near the day's high" : place < 0.3 ? "near the day's low" : "mid-day range", afterNoon: when >= "12:00" ? "after 12:00" : "before 12:00",
    };
  }
  function builderStep(trades, bars, { prevClose = null, atrSeed = null } = {}, b = BUILDER) {  // the builder's mark on every call that fired
    const fired = trades.filter(t => t.entryTime != null && t.how !== "cancelled").sort((x, y) => x.entryTime - y.entryTime || x.signalTime - y.signalTime || (x.side < y.side ? -1 : x.side > y.side ? 1 : 0));
    const atrs = atrPath(bars, atrSeed);
    let kept = 0;
    fired.forEach((t, n) => {
      const f = callFacts(t, fired, n, bars, atrs, { prevClose, atrSeed, medianAtr: b.medianAtr });
      if (!f) return;
      const hit = b.rules.filter(r => r.facts.every(([k, v]) => f[k] === v));
      if (hit.length) { kept++; t.builder = "KEEP"; t.builderWhy = hit.map(r => r.name).join("; "); } else { t.builder = "SKIP"; t.builderWhy = "no rule"; }
    });
    return kept;
  }
  function planStep(trades, p = PLAN) {
    let taken = 0;
    const fired = trades.filter(t => t.entryTime != null && t.how !== "cancelled").sort((a, b) => a.entryTime - b.entryTime || a.signalTime - b.signalTime || (a.side < b.side ? -1 : a.side > b.side ? 1 : 0));
    for (const t of fired) {
      const when = istHM(t.entryTime);
      if (when < p.from) { t.plan = "SKIP"; t.planWhy = `fired at ${when}, before ${p.from}`; }
      else if (when >= p.to) { t.plan = "SKIP"; t.planWhy = `fired at ${when}, after ${p.to}`; }
      else if (taken >= p.maxCalls) { t.plan = "SKIP"; t.planWhy = `the ${p.maxCalls} calls are taken`; }
      else { taken++; t.plan = "TAKE"; t.planWhy = `call ${taken} of ${p.maxCalls}`; }
    }
    return taken;
  }
  // The plan's line on the page: how many taken, their points, and where the day stands (now: the clock while the session shown is
  // today's, else null: a finished day replayed)
  function planSummary(trades, p = PLAN, now = null) {
    const take = trades.filter(t => t.plan === "TAKE"), open = take.filter(t => t.exit == null);
    const points = round2(take.reduce((s, t) => s + (t.points || 0), 0)), when = now == null ? null : istHM(now);
    const state = take.length >= p.maxCalls ? "done" : when == null ? "replay" : when < p.from ? "waiting" : when >= p.to ? "closed" : "open";
    const text = state === "done" ? `Done for today: ${p.maxCalls} calls taken.`
      : state === "waiting" ? `Waiting: the plan's calls start at ${p.from}.`
      : state === "closed" ? `The plan's window closed at ${p.to}: ${take.length} of ${p.maxCalls} calls taken.`
      : state === "open" ? `${take.length} of ${p.maxCalls} calls taken, ${p.maxCalls - take.length} more allowed until ${p.to}.`
      : `${take.length} of ${p.maxCalls} calls taken.`;
    return { taken: take.length, max: p.maxCalls, open: open.length, points, state, text };
  }

  root.Rules = { BUILDER, atrPath, callFacts, builderStep, RATIOS, IST_OFFSET, SESSION_END, SESSION_START, round2, dayOf, dayOver, endOf, sessionShare, levelsOf, todayLevelsAt, todayLinesAt, moveOf, moveOfDay, CLOSE_STEP, closeLevels, levelName, rangeLevels, closeLevelsAt, signalAt, paperTrades, replayDay, readOf, carryOf,
                 trailStep, atrBefore, TRAIL, NEW_HIGH_LOW, pastEdgeAt,
                 breakOf, dayFacts, candleBreaks, levelBehaviour, IDEAS, ideasOf, GATE, GATE_V1, GATE_HEALTH, parallelAdvice, gateAtr, atrSeedOf, gateVerdict, zoneStep, zoneVerdict, strongCandle, trendContinuation, openingRange, efficiency, gateSummary,
                 LC, LC_V2, LC_STRICT, LC_ZONE_ONLY, entryChecks, breaksOut, violentBefore, wornFailures, lcVerdict, stackStep, lcSummary,
                 LOCK, LOCK_PRESETS, lockFloor, lockStep, lockSummary,
                 PLAN, istHM, planStep, planSummary };
})(typeof window !== "undefined" ? window : globalThis);
