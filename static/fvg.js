// AAA_V1's fair value gaps (FVG) on the live chart (20 November 2026, the owner, with the build document "AAA_V1 FVG Live chart
// logic" and its module panel_fvg.py: "it is for AAA_V1, no changes required on other pages at all. go through the logic
// carefully and build it in proper way").
//
// This file is the document's module in JavaScript, rule for rule, and under it the gaps on AAA_V1's chart (the boxes, the row
// of words, the settings box). The rule is the standard three-candle rule, wicks compared; no indicator's code is used. The same
// rules stand in lab/fvg_ref.py, and lab/check_fvg.py proves the two give the same gaps and the same events.
//   Bullish FVG: candle 3's low is above candle 1's high.  Zone: candle 1's high (bottom) to candle 3's low (top).
//   Bearish FVG: candle 3's high is below candle 1's low.  Zone: candle 3's high (bottom) to candle 1's low (top).
//   A gap exists only when candle 3 has CLOSED (nothing is drawn or said before: no repainting); the three candles are of today,
//   back to back; the zone is at least max(fvg_min_points, fvg_min_pct % of price, fvg_min_atr x ATR at candle 3's close).
//   Then: active -> touched (a wick reached the near edge) -> half (the 50% line) -> filled (the far edge); a candle CLOSING
//   beyond the far edge: inverted (failed). Retired on fill (or only on inversion), by age, and past the most kept on each side.
//
// Four places differ from the document's Python, each a fault put right (the same four in lab/fvg_ref.py):
//   1. resample() gave a bigger candle although small candles inside it were missing, so a hole in the feed could still make a
//      gap. Only a whole bigger candle is returned now.
//   2. A finished candle that the feed revises after it was read was never read again. The day is now read again from its first
//      candle when a candle already fed has changed.
//   3. The printed points and prices were rounded half to even (a 12.5-point gap read "12 pts"). Half up now, one rule.
//   4. fvg_max_per_side 0 meant "no limit" only by an accident. It is now said plainly: 0 = no limit.
// A candle here: {hm: start "HH:MM", o, h, l, c}; a day's finished candles, oldest first.
(function (root) {
  "use strict";
  const DEFAULTS = {
    fvg_min_points: 0,              // smallest zone in index points
    fvg_min_pct: 0,                 // smallest zone as % of price
    fvg_min_atr: 0.5,               // smallest zone as a multiple of ATR (at candle 3's close)
    fvg_atr_len: 14,                // ATR length in candles (today's candles only)
    fvg_from: "09:15",              // candle 1 must start at or after this time
    fvg_until: "15:15",             // candle 3 must end at or before this time for a new gap
    fvg_retire_on: "fill",          // "fill": remove when filled; "close": remove only when a candle closes beyond
    fvg_max_age_bars: 0,            // 0 = keep until the end of the day
    fvg_max_per_side: 10,           // most open gaps kept on each side (0 = no limit)
    fvg_middle_close_beyond: false, // optional: candle 2 must close beyond candle 1's extreme
    fvg_middle_direction: false,    // optional: candle 2 must be green for a bullish gap, red for a bearish one
  };
  const mins = (hm) => parseInt(hm.slice(0, 2), 10) * 60 + parseInt(hm.slice(3, 5), 10);
  const hmOf = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  // a price with two decimals and commas, and whole points: both half up (fault 3)
  const fmt = (x) => { const n = Math.floor(Math.abs(x) * 100 + 0.5 + 1e-9), whole = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); return (x < 0 && n ? "-" : "") + whole + "." + String(n % 100).padStart(2, "0"); };
  const pts = (x) => String(Math.floor(x + 0.5 + 1e-9));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // Finished `minutes`-minute candles from finished smaller ones (srcInterval minutes each), anchored at the session start. A
  // bigger candle is returned only when every small candle of it is there (no look-ahead, and no candle made around a hole).
  function resample(candles, minutes, sessionStart, srcInterval) {
    if (sessionStart == null) sessionStart = "09:15"; if (srcInterval == null) srcInterval = 1;
    const out = [], s0 = mins(sessionStart); let cur = null;
    for (const c of candles) {
      const b = s0 + Math.floor((mins(c.hm) - s0) / minutes) * minutes;
      if (cur === null || cur.start !== b) { if (cur !== null) out.push(cur); cur = { start: b, hm: hmOf(b), o: c.o, h: c.h, l: c.l, c: c.c, n: 1 }; }
      else { cur.h = Math.max(cur.h, c.h); cur.l = Math.min(cur.l, c.l); cur.c = c.c; cur.n += 1; }
    }
    if (cur !== null) out.push(cur);
    const whole = Math.max(1, Math.floor(minutes / srcInterval));  // fault 1
    return out.filter(x => x.n >= whole).map(x => ({ hm: x.hm, o: x.o, h: x.h, l: x.l, c: x.c }));
  }

  // One per index and per time frame. update() with today's finished candles each time a candle closes.
  class Tracker {
    constructor(cfg, interval) {
      this.cfg = Object.assign({}, DEFAULTS);
      for (const k of Object.keys(cfg || {})) if (k.startsWith("fvg_")) this.cfg[k] = cfg[k];
      this.interval = interval == null ? 1 : interval;
      this.reset(null);
    }
    reset(date) {
      this.date = date; this.done = 0; this.gaps = []; this.next_id = 1; this.tr = [];
      this.seen = [];        // the candles already fed, as they were read (fault 2)
      this.made_today = [];  // every gap made today, open or retired
    }
    // candles: today's finished candles, oldest first -> [open gaps, events from the new candles]
    update(candles, date) {
      if (date === undefined) date = null;
      const key = (c) => c.hm + "|" + c.o + "|" + c.h + "|" + c.l + "|" + c.c;
      let changed = date !== this.date || candles.length < this.done;
      for (let i = 0; !changed && i < this.done; i++) if (key(candles[i]) !== this.seen[i]) changed = true;
      if (changed) this.reset(date);  // a new day, or a candle already fed has changed (fault 2)
      const events = [];
      for (let k = this.done; k < candles.length; k++) { for (const e of this.step(candles, k)) events.push(e); this.seen.push(key(candles[k])); }
      this.done = candles.length;
      return [this.openGaps(), events];
    }
    atr() {
      const n = this.cfg.fvg_atr_len, x = n > 0 ? this.tr.slice(-n) : []; let s = 0;
      for (const v of x) s += v;
      return x.length ? s / x.length : 0;
    }
    step(cs, k) {
      const cfg = this.cfg, c = cs[k], prev = k > 0 ? cs[k - 1].c : null;
      this.tr.push(Math.max(c.h - c.l, prev !== null ? Math.abs(c.h - prev) : 0, prev !== null ? Math.abs(c.l - prev) : 0));
      const end = hmOf(mins(c.hm) + this.interval), ev = [];
      // 1) follow the gaps made before this candle
      for (const g of this.gaps) { if ((g.state === "filled" || g.state === "inverted") && cfg.fvg_retire_on === "fill") continue; for (const e of this.follow(g, c, end)) ev.push(e); }
      // 2) a new gap closes with this candle (it is candle 3)
      if (k >= 2) {
        const a = cs[k - 2], m = cs[k - 1];
        const consecutive = mins(m.hm) - mins(a.hm) === this.interval && mins(c.hm) - mins(m.hm) === this.interval;
        const inWindow = a.hm >= cfg.fvg_from && mins(end) <= mins(cfg.fvg_until);
        for (const kind of ["bullish", "bearish"]) {
          let bottom, top, okMid;
          if (kind === "bullish" && a.h < c.l) { bottom = a.h; top = c.l; okMid = (!cfg.fvg_middle_close_beyond || m.c > a.h) && (!cfg.fvg_middle_direction || m.c > m.o); }
          else if (kind === "bearish" && a.l > c.h) { bottom = c.h; top = a.l; okMid = (!cfg.fvg_middle_close_beyond || m.c < a.l) && (!cfg.fvg_middle_direction || m.c < m.o); }
          else continue;
          const size = top - bottom, need = Math.max(cfg.fvg_min_points, cfg.fvg_min_pct / 100 * c.c, cfg.fvg_min_atr * this.atr());
          if (!(consecutive && inWindow && okMid && size >= need)) continue;
          const g = { id: this.next_id, kind, bottom, top, half: (top + bottom) / 2, size, from_hm: a.hm, made_hm: end, made_index: k, state: "active",
            touched_hm: null, half_hm: null, filled_hm: null, inverted_hm: null, held_first_touch: null, deepest: null };
          this.next_id += 1; this.gaps.push(g); this.made_today.push(g);
          ev.push(this.event("fvg_new", g, end, `New ${kind} FVG ${fmt(bottom)} to ${fmt(top)} (${pts(size)} pts), made by the ${m.hm} candle`));
        }
      }
      // 3) retire: age, filled/inverted, and the most kept on each side
      let keep = this.gaps.filter(g => { const done = g.state === "inverted" || (g.state === "filled" && cfg.fvg_retire_on === "fill"), old = cfg.fvg_max_age_bars && k - g.made_index >= cfg.fvg_max_age_bars; return !done && !old; });
      const most = cfg.fvg_max_per_side;
      for (const kind of ["bullish", "bearish"]) {
        const side = keep.filter(g => g.kind === kind);
        if (most > 0 && side.length > most) { const drop = new Set(side.slice(0, side.length - most)); keep = keep.filter(g => !drop.has(g)); }  // fault 4: 0 = no limit
      }
      this.gaps = keep;
      return ev;
    }
    follow(g, c, end) {
      const ev = [], bull = g.kind === "bullish", near = bull ? g.top : g.bottom, far = bull ? g.bottom : g.top;
      const reach = bull ? c.l : c.h, into = (p) => bull ? reach <= p : reach >= p;  // how far into the zone this candle's wick went
      if (g.touched_hm === null && into(near)) {
        g.touched_hm = end; g.held_first_touch = bull ? c.c > far : c.c < far; g.state = "touched";
        ev.push(this.event("fvg_touched", g, end, `Price came back into the ${g.kind} FVG ${fmt(g.bottom)} to ${fmt(g.top)}`));
      }
      if (g.touched_hm !== null) g.deepest = g.deepest === null ? reach : bull ? Math.min(g.deepest, reach) : Math.max(g.deepest, reach);
      if (g.half_hm === null && into(g.half)) {
        g.half_hm = end; if (g.state === "touched") g.state = "half";
        ev.push(this.event("fvg_half", g, end, `Price reached the 50% line (${fmt(g.half)}) of the ${g.kind} FVG`));
      }
      if (g.filled_hm === null && into(far)) {
        g.filled_hm = end; g.state = "filled";
        ev.push(this.event("fvg_filled", g, end, `The ${g.kind} FVG ${fmt(g.bottom)} to ${fmt(g.top)} is filled`));
      }
      if (g.inverted_hm === null && (bull ? c.c < far : c.c > far)) {
        g.inverted_hm = end; g.state = "inverted";
        ev.push(this.event("fvg_inverted", g, end, `A candle closed ${bull ? "below" : "above"} the ${g.kind} FVG: it has failed and now acts as ${bull ? "resistance" : "support"}`));
      }
      return ev;
    }
    event(type, g, end, text) { return { type, id: g.id, kind: g.kind, time: end, text, bottom: g.bottom, top: g.top }; }
    // one gap as the chart and the list want it: with the part still unfilled and the words
    describe(g) {
      const bull = g.kind === "bullish"; let low, high, pct;
      if (g.deepest === null) { low = g.bottom; high = g.top; pct = 0; }
      else if (bull) { low = g.bottom; high = Math.max(g.bottom, Math.min(g.top, g.deepest)); pct = g.size ? 100 * (g.top - high) / g.size : 100; }
      else { low = Math.min(g.top, Math.max(g.bottom, g.deepest)); high = g.top; pct = g.size ? 100 * (low - g.bottom) / g.size : 100; }
      const state = { active: "not touched yet", touched: "touched at " + g.touched_hm, half: "reached its 50% line at " + g.half_hm, filled: "filled at " + g.filled_hm, inverted: "failed at " + g.inverted_hm }[g.state];
      return Object.assign({}, g, { unfilled_low: low, unfilled_high: high, filled_pct: Math.floor(Math.min(100, Math.max(0, pct)) * 10 + 0.5) / 10,
        text: `${cap(g.kind)} FVG ${fmt(g.bottom)} to ${fmt(g.top)} (${pts(g.size)} pts), made ${g.made_hm}; ${state}` });
    }
    openGaps() { return this.gaps.slice().reverse().map(g => this.describe(g)); }  // newest first
    // the nearest open bullish gap below the price and bearish gap above it (null: none)
    nearest(price) {
      const gs = this.openGaps(), below = gs.filter(g => g.kind === "bullish" && g.top <= price), above = gs.filter(g => g.kind === "bearish" && g.bottom >= price);
      return [below.length ? below.reduce((a, b) => b.top > a.top ? b : a) : null, above.length ? above.reduce((a, b) => b.bottom < a.bottom ? b : a) : null];
    }
  }

  // How far price has traded through a gap, in the owner's words (22 November: "if it is filled 100% then mark it as Filled 100%, if filled till 50% then Filled 50%,
  // if not filled completely then the range, 0 to 50% or 50% to 100%"); p is the filled per cent (one decimal), from the deepest wick
  const fillStatus = (p) => p >= 99.95 ? "Filled 100%" : Math.round(p) === 50 ? "Filled 50%" : p <= 0 ? "Not filled" : p < 50 ? "Filled 0–50%" : "Filled 50–100%";
  const calc = { DEFAULTS, mins, hmOf, fmt, pts, resample, fillStatus, Tracker };
  // ------------------------------------------------------------------------------------------------ the gaps on AAA_V1's chart
  // attach(A) puts the gaps on a chart. A is the page's side of it: chart, series (the candles), IST (seconds), tools and
  // infoRow (elements), name(), interval(), bars() (every candle on the chart), fine() (the 1-minute candles), num, css, now()
  // (seconds). It gives back refresh() (read the candles again) and redraw().
  //
  // What is read: the LAST day on the chart only (today, in market hours), and only its FINISHED candles: a candle is finished
  // when a later candle has come, or a full minute has passed since its end (the day's last candle). So nothing is drawn or said
  // from a candle that is still moving. The gaps are read afresh from the day's first candle each time, so a candle the feed
  // corrects later is never left wrong. "FVG candles" is the chart's own time frame, or 3, 5 or 15 minutes built from the
  // 1-minute candles (the document, 3.6). The tick box is off until the owner ticks it, and is remembered with the settings.
  function attach(A) {
    const KEY = "aaaFvg", MIN = { "1m": 1, "5m": 5, "15m": 15 }, TFS = ["chart", "1", "3", "5", "15"], GRACE = 60;
    const st = { on: false, tf: "chart", labels: true, cfg: {}, out: null };
    try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) { st.on = s.on === true; if (TFS.includes(s.tf)) st.tf = s.tf; st.labels = s.labels !== false; st.cfg = clean(s.cfg || {}); } } catch (e) {}
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ on: st.on, tf: st.tf, labels: st.labels, cfg: st.cfg })); } catch (e) {} };
    // only what differs from the defaults is kept, and only values the rules can take
    function clean(c) {
      const o = {}, n = (k, lo, hi, whole) => { let v = Number(c[k]); if (c[k] === "" || c[k] == null || !isFinite(v)) return; v = Math.min(hi, Math.max(lo, whole ? Math.round(v) : v)); if (v !== DEFAULTS[k]) o[k] = v; };
      n("fvg_min_points", 0, 100000); n("fvg_min_pct", 0, 100); n("fvg_min_atr", 0, 100); n("fvg_atr_len", 1, 500, true); n("fvg_max_age_bars", 0, 2000, true); n("fvg_max_per_side", 0, 200, true);
      for (const k of ["fvg_from", "fvg_until"]) if (/^([01]\d|2[0-3]):[0-5]\d$/.test(c[k] || "") && c[k] !== DEFAULTS[k]) o[k] = c[k];
      if (c.fvg_retire_on === "close") o.fvg_retire_on = "close";
      for (const k of ["fvg_middle_close_beyond", "fvg_middle_direction"]) if (c[k] === true) o[k] = true;
      return o;
    }
    const cfg = () => Object.assign({}, DEFAULTS, st.cfg);
    const dayOf = (t) => Math.floor((t + A.IST) / 86400);
    const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

    // The day's finished candles in the chosen time frame, as the rules want them; null with the reason when they cannot be had.
    function source() {
      const bars = A.bars(); if (!bars.length) return { why: "no candles yet" };
      const iv = MIN[A.interval()], tf = st.tf === "chart" ? iv : Number(st.tf), day = dayOf(bars[bars.length - 1].time), start = day * 86400 - A.IST, now = A.now();
      const of = (list, m) => { const d = list.filter(b => dayOf(b.time) === day); if (d.length && now < d[d.length - 1].time + m * 60 + GRACE) d.pop(); return d.map(b => ({ hm: hmOf(Math.floor((b.time - start) / 60)), o: b.open, h: b.high, l: b.low, c: b.close })); };
      const fine = A.fine() || [];
      let cs;
      if (tf === iv) cs = of(bars, iv);
      else if (fine.some(b => dayOf(b.time) === day)) cs = tf === 1 ? of(fine, 1) : resample(of(fine, 1), tf, "09:15", 1);
      else if (tf > iv && tf % iv === 0) cs = resample(of(bars, iv), tf, "09:15", iv);
      else return { why: `no 1-minute candles to build ${tf}-minute candles from`, tf };
      return { cs, tf, day, start };
    }
    function refresh() {
      if (!st.on) { st.out = null; row(); redraw(); return; }
      const s = source();
      if (!s.cs) { st.out = { why: s.why, tf: s.tf, gaps: [], events: [], made: 0 }; row(); redraw(); return; }
      const t = new Tracker(cfg(), s.tf), [gaps, events] = t.update(s.cs, String(s.day)), last = s.cs.length ? s.cs[s.cs.length - 1] : null;
      const at = (hm) => s.start + mins(hm) * 60;
      for (const g of gaps) g.from_time = at(g.from_hm);
      const bars = A.bars(), price = bars[bars.length - 1].close, [below, above] = t.nearest(price);
      // Every time shown is the chart's own label of the candle (its start), not the minute the candle ended: the gap's third candle. The numbers 1, 2, 3
      // run oldest first over every gap formed today (filled ones too), and are written on the chart's labels of the gaps still open
      const all = t.made_today.map(g => t.describe(g)).sort((a, b) => a.id - b.id), no = new Map(all.map((g, i) => [g.id, i + 1])), open = gaps.slice().sort((a, b) => a.id - b.id);
      st.out = { tf: s.tf, day: s.day, gaps, open, list: all, no, events, made: t.made_today.length, below, above, price, read: s.cs.length, last: last ? last.hm : null, atr: t.atr() };
      row(); redraw();
    }

    // ---------------------------------------------------------------- the boxes (the document, section 5): under the candles
    const FONT = () => getComputedStyle(document.body).fontFamily;
    function xAt(time) {  // the chart candle that holds this time
      const bars = A.bars(); let a = 0, z = bars.length - 1; if (z < 0 || time < bars[0].time) return null;
      while (a < z) { const m = (a + z + 1) >> 1; if (bars[m].time <= time) a = m; else z = m - 1; }
      return A.chart.timeScale().logicalToCoordinate(a);  // the page places its candles by their number, oldest 0
    }
    function boxes() {  // where each open gap stands now (media pixels): the whole zone, with the part price has already traded through; also for the browser checks
      const o = st.out; if (!st.on || !o || !o.gaps.length) return [];
      const Y = (p) => A.series.priceToCoordinate(p);
      return o.open.map(z => { const top = Y(z.top), bottom = Y(z.bottom); if (top == null || bottom == null) return null;
        let x0 = xAt(z.from_time); if (x0 == null || x0 < 0) x0 = 0;
        const bull = z.kind === "bullish", cut = Y(bull ? z.unfilled_high : z.unfilled_low), done = z.filled_pct > 0 && cut != null;
        // the unfilled part keeps the box's colour; the part traded through is fainter. Bullish: the filled part is the top of the zone; bearish: the bottom
        const unfilled = done ? (bull ? [cut, bottom] : [top, cut]) : [top, bottom], filled = done ? (bull ? [top, cut] : [cut, bottom]) : null;
        return { z, n: o.no.get(z.id), x0, top, bottom, unfilled, filled, half: Y(z.half) }; }).filter(Boolean);
    }
    function paint(scope, words) {
      const list = boxes(); if (!list.length) return;
      const ctx = scope.context, hr = scope.horizontalPixelRatio, vr = scope.verticalPixelRatio, w = scope.mediaSize.width;
      ctx.save(); const taken = [];  // the labels' places: a label that would lie on a newer gap's label is left out
      for (const b of list) {
        const colour = A.css(b.z.kind === "bullish" ? "--up" : "--down"), x = Math.round(b.x0 * hr), y = Math.round(b.top * vr), seg = (r) => [Math.round(r[0] * vr), Math.max(1, Math.round((r[1] - r[0]) * vr))];
        if (!words) {
          ctx.fillStyle = colour; const wd = Math.round((w - b.x0) * hr);
          ctx.globalAlpha = b.z.state === "active" ? 0.22 : 0.12; { const [yy, hh] = seg(b.unfilled); ctx.fillRect(x, yy, wd, hh); }  // the part not yet traded through; fainter once price has come back
          if (b.filled) { ctx.globalAlpha = 0.05; const [yy, hh] = seg(b.filled); ctx.fillRect(x, yy, wd, hh); }  // the part price has traded through
          if (b.half != null) { ctx.globalAlpha = 0.6; ctx.strokeStyle = colour; ctx.lineWidth = Math.max(1, Math.round(vr)); ctx.setLineDash([4 * hr, 4 * hr]); const my = Math.round(b.half * vr) + 0.5; ctx.beginPath(); ctx.moveTo(x, my); ctx.lineTo(w * hr, my); ctx.stroke(); ctx.setLineDash([]); }
        } else if (st.labels) {
          ctx.globalAlpha = 1; ctx.font = `600 ${Math.round(10 * vr)}px ${FONT()}`; ctx.textAlign = "right"; ctx.textBaseline = "middle";
          const text = `${b.n} · FVG ${A.num(b.z.bottom)} – ${A.num(b.z.top)}`, tw = ctx.measureText(text).width, th = Math.round(13 * vr), cy = Math.round((b.top + b.bottom) / 2 * vr), rx = Math.round((w - 4) * hr);
          if (taken.some(y => Math.abs(y - cy) < th)) continue; taken.push(cy);
          ctx.save(); ctx.globalAlpha = 0.8; ctx.fillStyle = A.css("--surface"); ctx.fillRect(rx - tw - Math.round(3 * hr), cy - th / 2, tw + Math.round(6 * hr), th); ctx.restore();
          ctx.fillStyle = colour; ctx.fillText(text, rx, cy);
        }
      }
      ctx.restore();
    }
    const view = (z, fn) => ({ zOrder: () => z, renderer: () => ({ draw: (target) => target.useBitmapCoordinateSpace(fn) }) });
    const prim = { attached(p) { this.requestUpdate = p.requestUpdate; }, detached() { this.requestUpdate = null; }, updateAllViews() {}, views: [view("bottom", s => paint(s, false)), view("top", s => paint(s, true))], paneViews() { return this.views; } };
    A.series.attachPrimitive(prim);
    const redraw = () => prim.requestUpdate && prim.requestUpdate();

    // ---------------------------------------------------------------- the tick box, the row of words, the settings box
    const style = document.createElement("style");
    style.textContent = `
      #fvg-gear { width: 32px; height: 32px; flex: none; display: grid; place-items: center; background: transparent; border: 0; border-radius: 6px; color: var(--ink-2); cursor: pointer; padding: 0; }
      #fvg-gear:hover { background: var(--hover); } #fvg-gear[hidden] { display: none; }
      #fvg-gear svg, #fvg-dlg .x svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
      #fvg-row { padding: 3px 12px 5px; border-bottom: 1px solid var(--border); font-size: 13px; line-height: 1.5; flex: none; } #fvg-row[hidden] { display: none; }
      #fvg-row .r { display: flex; flex-wrap: wrap; gap: 0 14px; align-items: baseline; } #fvg-row .k { color: var(--muted); } #fvg-row .v { font-weight: 600; font-variant-numeric: tabular-nums; }
      #fvg-row .up { color: var(--up); } #fvg-row .down { color: var(--down); }
      #fvg-row details.fl { margin-top: 2px; } #fvg-row details.fl > summary { cursor: pointer; color: var(--ink); font-weight: 600; min-height: 26px; list-style-position: inside; }
      #fvg-row .lh, #fvg-row .lr { display: grid; grid-template-columns: 20px 44px minmax(0, 1fr) auto; gap: 0 6px; align-items: baseline; padding: 2px 0; font-variant-numeric: tabular-nums; } #fvg-row .st, #fvg-row .lv { white-space: nowrap; } #fvg-row .st { text-align: right; }
      #fvg-row .lh { color: var(--muted); font-size: 12px; border-bottom: 1px solid var(--border); } #fvg-row .lr .lv, #fvg-row .lr .st { font-weight: 600; }
      #fvg-row .lbody { max-height: 34vh; overflow-y: auto; overscroll-behavior: contain; } #fvg-row .none { color: var(--muted); padding: 2px 0; }
      #fvg-shade { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.35); display: grid; place-items: center; }
      #fvg-dlg { width: min(430px, 94vw); max-height: min(640px, 92vh); display: flex; flex-direction: column; background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,.35); font-size: 14px; }
      #fvg-dlg header, #fvg-dlg footer { flex: none; } #fvg-dlg header { display: flex; align-items: center; gap: 8px; padding: 12px 10px 8px 16px; border-bottom: 1px solid var(--border); } #fvg-dlg h2 { flex: 1; margin: 0; font-size: 17px; font-weight: 600; }
      #fvg-dlg .x { width: 32px; height: 32px; display: grid; place-items: center; background: transparent; border: 0; border-radius: 6px; color: var(--ink-2); cursor: pointer; padding: 0; }
      #fvg-dlg .body { padding: 8px 16px; overflow-y: auto; flex: 1; min-height: 160px; }
      #fvg-dlg .row { display: flex; align-items: center; gap: 10px; min-height: 40px; } #fvg-dlg .row > .n { flex: 1; min-width: 0; } #fvg-dlg .row label.n { display: flex; align-items: center; gap: 8px; cursor: pointer; }
      #fvg-dlg input[type="number"], #fvg-dlg input[type="time"], #fvg-dlg select { font: inherit; color: var(--ink); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; min-height: 32px; }
      #fvg-dlg input[type="number"] { width: 92px; } #fvg-dlg select { min-width: 150px; } #fvg-dlg input[type="checkbox"] { width: 17px; height: 17px; accent-color: var(--accent); }
      #fvg-dlg .hint { color: var(--muted); font-size: 12px; line-height: 1.45; margin: 0 0 4px; }
      #fvg-dlg footer { display: flex; gap: 8px; padding: 10px 16px 14px; border-top: 1px solid var(--border); } #fvg-dlg footer .grow { flex: 1; }
      #fvg-dlg footer button { font: inherit; min-height: 34px; padding: 0 16px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); cursor: pointer; }
      #fvg-dlg footer button.ok { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
      @media (max-width: 480px) { #fvg-dlg select { min-width: 120px; } #fvg-dlg .row { gap: 6px; } }`;
    document.head.appendChild(style);

    const label = document.createElement("label"); label.innerHTML = `<input type="checkbox" id="show-fvg"> FVG`; label.title = "Fair value gaps of the day's finished candles";
    const gear = document.createElement("button"); gear.type = "button"; gear.id = "fvg-gear"; gear.title = "FVG settings"; gear.setAttribute("aria-label", "FVG settings");
    gear.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6"/></svg>';
    A.tools.appendChild(label); A.tools.appendChild(gear);
    const box = label.querySelector("input"); box.checked = st.on; gear.hidden = !st.on;
    box.addEventListener("change", () => { st.on = box.checked; gear.hidden = !st.on; save(); refresh(); });
    gear.addEventListener("click", () => dialog());
    const rowEl = document.createElement("div"); rowEl.id = "fvg-row"; rowEl.hidden = true; A.infoRow.after(rowEl);
    let open = null, shownRow = "";

    function row() {
      const o = st.out; rowEl.hidden = !st.on || !o; if (rowEl.hidden) { shownRow = ""; return; }
      const cell = (k, v, c) => `<span><span class="k">${k}</span> <span class="v${c ? " " + c : ""}">${v}</span></span>`;
      const cl = (hm) => hmOf(mins(hm) - o.tf);  // the chart's label of the candle that ended at hm: its start
      let html;
      if (o.why) html = `<div class="r">${cell("FVG", esc(o.why))}</div>`;
      else {
        // how far price has traded through the gap (the owner, 22 November): Filled 100%; Filled 50% (exactly to the middle line); else the half it is in
        const status = (g) => fillStatus(g.filled_pct);
        const nb = o.gaps.filter(g => g.kind === "bullish").length, ns = o.gaps.length - nb;
        // FVG levels (the owner, 22 November: "the red marked box should have title name as FVG levels and below that it should only show FVG formed time and
        // levels with sr.nos 1,2,3", then "bullish green, bearish red" and "update the status for every FVG"): every gap formed today, oldest first, with the same
        // numbers as the chart's labels; formed = the chart's label of the gap's third candle; the row is green for a bullish gap, red for a bearish one
        const levels = o.list.map(g => `<div class="lr ${g.kind === "bullish" ? "up" : "down"}"><span class="no">${o.no.get(g.id)}</span><span class="tm">${cl(g.made_hm)}</span><span class="lv">${A.num(g.bottom)} – ${A.num(g.top)}</span><span class="st">${status(g)}</span></div>`).join("");
        html = `<div class="r">${cell("FVG on " + o.tf + "-minute candles", o.last ? "last candle " + o.last : "no finished candle yet")}${cell("Open", `${nb} bullish, ${ns} bearish`)}${cell("Made today", o.made)}</div>`
          + `<details class="fl"><summary>FVG levels <span class="k">(${o.list.length})</span></summary>${o.list.length ? `<div class="lh"><span class="no">No.</span><span class="tm">Formed</span><span class="lv">Levels</span><span class="st">Status</span></div><div class="lbody">${levels}</div>` : `<div class="none">no gap formed today</div>`}</details>`;
      }
      if (html === shownRow) return;  // nothing new: the list is left as it is (its scroll and its open state too)
      const d = rowEl.querySelector("details"); if (d) open = d.open;
      if (open == null) open = !!(window.matchMedia && matchMedia("(min-width: 900px)").matches);  // wide: the list stands open in the column at the right; a phone: folded, as it would push the chart down
      shownRow = html; rowEl.innerHTML = html;
      const nd = rowEl.querySelector("details"); if (nd) { nd.open = open; nd.addEventListener("toggle", () => { open = nd.open; }); }
    }

    // the settings box: every setting of the document's table (4.1), with Defaults, Cancel and Ok
    function dialog() {
      if (document.getElementById("fvg-shade")) return;
      const c = cfg(), shade = document.createElement("div"); shade.id = "fvg-shade";
      const numRow = (k, name, step, hint) => `<div class="row"><span class="n">${name}</span><input type="number" data-k="${k}" min="0" step="${step}" inputmode="decimal" value="${c[k]}"></div>${hint ? `<p class="hint">${hint}</p>` : ""}`;
      const tick = (k, name, on) => `<div class="row"><label class="n"><input type="checkbox" data-k="${k}"${on ? " checked" : ""}> ${name}</label></div>`;
      shade.innerHTML = `<div id="fvg-dlg" role="dialog" aria-modal="true" aria-label="FVG settings"><header><h2>Fair value gaps (FVG)</h2><button type="button" class="x" data-do="cancel" aria-label="Close"><svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15"/></svg></button></header><div class="body">
        <div class="row"><span class="n">FVG candles</span><select data-k="tf">${[["chart", "Same as the chart"], ["1", "1 minute"], ["3", "3 minutes"], ["5", "5 minutes"], ["15", "15 minutes"]].map(([v, n]) => `<option value="${v}"${st.tf === v ? " selected" : ""}>${n}</option>`).join("")}</select></div>
        <p class="hint">A gap is shown only after its third candle has closed. Today's candles only.</p>
        ${numRow("fvg_min_atr", "Smallest gap, × ATR", 0.1)}${numRow("fvg_atr_len", "ATR length (candles)", 1)}${numRow("fvg_min_points", "Smallest gap, points", 1)}${numRow("fvg_min_pct", "Smallest gap, % of price", 0.01, "A gap must pass all three sizes. 0 switches one off.")}
        <div class="row"><span class="n">Candle 1 from</span><input type="time" data-k="fvg_from" value="${c.fvg_from}"></div>
        <div class="row"><span class="n">Candle 3 closes by</span><input type="time" data-k="fvg_until" value="${c.fvg_until}"></div>
        <div class="row"><span class="n">Remove a gap when</span><select data-k="fvg_retire_on"><option value="fill"${c.fvg_retire_on === "fill" ? " selected" : ""}>it is filled</option><option value="close"${c.fvg_retire_on === "close" ? " selected" : ""}>a candle closes through it</option></select></div>
        ${numRow("fvg_max_age_bars", "Remove after (candles)", 1, "0 keeps a gap until the end of the day.")}${numRow("fvg_max_per_side", "Most open gaps a side", 1, "0 means no limit.")}
        ${tick("fvg_middle_close_beyond", "Candle 2 must close beyond candle 1", c.fvg_middle_close_beyond)}${tick("fvg_middle_direction", "Candle 2 green for bullish, red for bearish", c.fvg_middle_direction)}${tick("labels", "Price labels on the boxes", st.labels)}
        </div><footer><button type="button" data-do="defaults">Defaults</button><span class="grow"></span><button type="button" data-do="cancel">Cancel</button><button type="button" class="ok" data-do="ok">Ok</button></footer></div>`;
      document.body.appendChild(shade);
      const q = (k) => shade.querySelector(`[data-k="${k}"]`), close = () => { shade.remove(); document.removeEventListener("keydown", key); }, key = (e) => { if (e.key === "Escape") close(); };
      document.addEventListener("keydown", key);
      shade.addEventListener("click", (e) => {
        if (e.target === shade) return close();
        const b = e.target.closest("button[data-do]"); if (!b) return;
        if (b.dataset.do === "cancel") return close();
        if (b.dataset.do === "defaults") { q("tf").value = "chart"; q("labels").checked = true; for (const k of Object.keys(DEFAULTS)) { const el = q(k); if (el.type === "checkbox") el.checked = DEFAULTS[k]; else el.value = DEFAULTS[k]; } return; }
        const got = {}; for (const k of Object.keys(DEFAULTS)) { const el = q(k); got[k] = el.type === "checkbox" ? el.checked : el.value; }
        st.cfg = clean(got); st.tf = q("tf").value; st.labels = q("labels").checked; save(); close(); refresh();
      });
    }

    refresh();
    const api = { refresh, redraw, boxes, state: () => st, out: () => st.out, source };
    attach.last = api;
    return api;
  }

  const api = Object.assign(calc, { attach: typeof attach === "function" ? attach : null });
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Fvg = api;
})(typeof window !== "undefined" ? window : globalThis);
