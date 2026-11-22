// AAA_V1's FVG fill signals: BUY CE / BUY PE when a fair value gap on the 5-minute chart is filled and holds (23 November 2026, the
// owner, with the files "AAA_V1 FVG fill signals.py" and ".md": "develop it accordingly for AAA_V1 page ... it should not touch any
// existing logic and it should not remove any old signals, it should trigger new signals keeping old ones ... keep the chart and
// panel values same").
//
// Part 1 is the owner's module (tools/fvg_signals.py) in JavaScript, rule for rule: atr, ema, trend_direction, detect_fvgs, scan.
// lab/check_fvgsig.py runs the owner's Python on two years of candles of three indices and this file on the same candles, with
// 14 different settings, and requires the same signals (bar, call, entry, zone) every time.
// (23 November, later: on the page the gaps are NOT the owner's own detection but the gaps of the FVG levels list, so a signal's gap is always a
// numbered gap of that list with the same two levels: scanZones() is the fill rule on a given list of gaps; see Part 2.)
// Part 2 (attach) puts those signals on AAA_V1's chart and in a box of their own in the panel at the right. It is a SEPARATE
// box and a separate layer: the FVG boxes, the FVG levels list, the volume profile tools and every other line stay as they were.
// The chart's arrows and the panel's rows are made from the same list (one number each), so they cannot differ.
//
// The rule (the owner's document):
//   1. A gap forms over three candles of one session. Bullish: candle 3's low is above candle 1's high, zone = [candle 1's high, candle 3's low].
//      Bearish: candle 3's high is below candle 1's low, zone = [candle 3's high, candle 1's low]. It counts when it is at least
//      min_gap_atr x ATR(14) and (displacement) candle 2 closes beyond candle 1 in the gap's direction. Known at candle 3's close.
//   2. Later price comes back and fills it (trades through to the far edge; "full", or the midpoint, or the first touch of the near edge).
//   3. On the candle that fills it, if that candle does not close beyond the far edge: filled and held. Bullish gap -> BUY CE, bearish -> BUY PE,
//      entry = that candle's close. A close beyond the far edge: the gap is broken, no signal.
//   4. Trend filter: BUY CE only while the 9 EMA is above the 21 EMA, BUY PE only while below (EMAs of finished daily closes, fixed at the open).
//   5. A signal only on a candle that closes between 09:30 and 14:30 IST. A gap lives at most 60 candles, in its own session.
// A candle here: {d: "YYYY-MM-DD", t: start in minutes after midnight (IST), o, h, l, c, time: its start in seconds (only carried along)}.
(function (root) {
  "use strict";
  const DEFAULTS = {
    interval: 5,            // minutes per candle (the page builds 5-minute candles whatever the chart shows)
    atr_len: 14,
    min_gap_atr: 0.25,
    displacement: true,
    carry_days: 0,
    max_age_bars: 60,
    fill_level: "full",     // "full" | "mid" | "edge"
    confirm: "none",        // "none" | "candle"
    confirm_wait: 3,
    ema_filter: "on",       // "on" | "off"
    ema_fast: 9, ema_slow: 21,
    ema_basis: "day",       // "day" | "bar"
    entry_from: "09:30", entry_to: "14:30",
  };
  const mins = (hm) => parseInt(hm.slice(0, 2), 10) * 60 + parseInt(hm.slice(3, 5), 10);
  const hmOf = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const fmt = (x) => { const n = Math.floor(Math.abs(x) * 100 + 0.5 + 1e-9), whole = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); return (x < 0 && n ? "-" : "") + whole + "." + String(n % 100).padStart(2, "0"); };

  // ---------------------------------------------------------------- Part 1: the owner's module
  function atr(bars, n) {  // Wilder's average true range, one value per candle (null until n candles exist)
    const out = []; let prev = null, a = null;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i], tr = prev === null ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - prev), Math.abs(b.l - prev));
      prev = b.c;
      if (i < n) { a = a === null ? tr : a + tr; out.push(i === n - 1 ? a / n : null); if (i === n - 1) a = a / n; }
      else { a = (a * (n - 1) + tr) / n; out.push(a); }
    }
    return out;
  }
  function ema(values, n) { const out = [], k = 2 / (n + 1); let e = null; for (const v of values) { e = e === null ? v : e + (v - e) * k; out.push(e); } return out; }
  const sign = (f, s) => f > s ? 1 : f < s ? -1 : null;
  // +1 (fast above slow), -1 (below) or null, one per candle. Basis "day": EMAs of the finished daily closes of the sessions BEFORE the
  // candle's own session. daily = [{d, c}] oldest first (the page's list from the server); without it the closes are the candles' own last
  // closes (as the owner's module does). Basis "bar": EMAs of the candles' own closes.
  function trendDirection(bars, cfg, daily) {
    cfg = Object.assign({}, DEFAULTS, cfg || {});
    const fast = cfg.ema_fast, slow = cfg.ema_slow;
    if (cfg.ema_basis === "bar") {
      const closes = bars.map(b => b.c), f = ema(closes, fast), s = ema(closes, slow);
      return bars.map((_, i) => i >= slow - 1 ? sign(f[i], s[i]) : null);
    }
    let list = daily;
    if (!list) { list = []; const idx = new Map(); for (const b of bars) { if (!idx.has(b.d)) { idx.set(b.d, list.length); list.push({ d: b.d, c: b.c }); } else list[idx.get(b.d)].c = b.c; } }
    const days = [...new Set(bars.map(b => b.d))], byDay = new Map();
    for (const d of days) {
      const before = list.filter(x => x.d < d);
      if (before.length >= slow) { const cl = before.map(x => x.c), f = ema(cl, fast), s = ema(cl, slow); byDay.set(d, sign(f[f.length - 1], s[s.length - 1])); } else byDay.set(d, null);
    }
    return bars.map(b => byDay.get(b.d));
  }
  function detectFvgs(bars, cfg, atrs) {  // every gap; known at the close of its third candle (index "i")
    cfg = Object.assign({}, DEFAULTS, cfg || {}); atrs = atrs || atr(bars, cfg.atr_len);
    const out = [];
    for (let i = 2; i < bars.length; i++) {
      const a = bars[i - 2], m = bars[i - 1], b = bars[i];
      if (!(a.d === m.d && m.d === b.d) || atrs[i] === null) continue;
      let side, lo, hi, ok;
      if (b.l > a.h) { side = 1; lo = a.h; hi = b.l; ok = m.c > a.h; }
      else if (b.h < a.l) { side = -1; lo = b.h; hi = a.l; ok = m.c < a.l; }
      else continue;
      if (cfg.displacement && !ok) continue;
      if (hi - lo < cfg.min_gap_atr * atrs[i]) continue;
      out.push({ i, side, lo, hi, mid: (lo + hi) / 2, size: hi - lo, atr: atrs[i] });
    }
    return out;
  }
  const closeMin = (bar, iv) => bar.t + iv;
  // The fill rule, for a GIVEN list of gaps (zones: {i: index of the gap's third candle, side, lo, hi, mid, id?}): walk the candles once.
  // scan() below feeds it the owner's own gaps (detectFvgs); the page feeds it the gaps of the FVG levels list (23 November, the owner: "make
  // signals use only the FVG levels list gaps"). atrs: the owner's rule skips candles with no ATR yet; the page passes none (the gaps carry their own).
  function scanZones(bars, zones0, cfg, trend, atrs) {
    cfg = Object.assign({}, DEFAULTS, cfg || {});
    const iv = cfg.interval, zones = zones0.map(z => Object.assign({}, z, { touch_i: null, mid_i: null, fill_i: null, broken_i: null, _hit: null, _done: false }));
    const tFrom = mins(cfg.entry_from), tTo = mins(cfg.entry_to);
    const dayNo = new Map([...new Set(bars.map(b => b.d))].sort().map((d, k) => [d, k])), byStart = new Map(), signals = [];
    let live = [];
    for (const z of zones) { if (!byStart.has(z.i)) byStart.set(z.i, []); byStart.get(z.i).push(z); }
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      if (atrs == null || atrs[i] !== null) {
        const inWindow = tFrom <= closeMin(b, iv) && closeMin(b, iv) <= tTo, keep = [];
        for (const z of live) {
          if (i - z.i > cfg.max_age_bars || dayNo.get(b.d) - dayNo.get(bars[z.i].d) > cfg.carry_days) continue;
          const s = z.side, near = s === 1 ? z.hi : z.lo, far = s === 1 ? z.lo : z.hi;
          const level = { full: far, mid: z.mid, edge: near }[cfg.fill_level], reach = s === 1 ? b.l : b.h;
          const got = (px) => s === 1 ? reach <= px : reach >= px;
          if (z.touch_i === null && got(near)) z.touch_i = i;
          if (z.mid_i === null && got(z.mid)) z.mid_i = i;
          if (z.fill_i === null && got(far)) z.fill_i = i;
          if (z._hit === null && got(level)) z._hit = i;
          if (s === 1 ? b.c < far : b.c > far) { z.broken_i = i; continue; }  // closed through: the gap is finished, no signal
          if (z._hit !== null && !z._done) {
            let ready, expired;
            if (cfg.confirm === "candle") { ready = i - z._hit <= cfg.confirm_wait && (s === 1 ? b.c > b.o : b.c < b.o); expired = i - z._hit >= cfg.confirm_wait; }
            else { ready = i === z._hit; expired = true; }
            if (ready || expired) z._done = true;
            if (ready && inWindow && (trend === null || trend[i] === s))
              signals.push({ action: s === 1 ? "BUY CE" : "BUY PE", side: s, i, d: b.d, t: b.t, close_min: closeMin(b, iv), entry: b.c, fill_level: level, zone_lo: z.lo, zone_hi: z.hi, zone_i: z.i, zone_id: z.id });
          }
          keep.push(z);
        }
        live = keep;
      }
      if (byStart.has(i)) live.push(...byStart.get(i));
    }
    for (const z of zones) { delete z._hit; delete z._done; }
    return { signals, zones };
  }
  // The owner's whole module: its gaps, its trend filter, then the fill rule.
  function scan(bars, cfg, daily) {
    cfg = Object.assign({}, DEFAULTS, cfg || {});
    const atrs = atr(bars, cfg.atr_len), trend = cfg.ema_filter === "on" ? trendDirection(bars, cfg, daily) : null;
    const r = scanZones(bars, detectFvgs(bars, cfg, atrs), cfg, trend, atrs);
    return { signals: r.signals, zones: r.zones, trend };
  }
  const calc = { DEFAULTS, mins, hmOf, fmt, atr, ema, trendDirection, detectFvgs, scanZones, scan };

  // ---------------------------------------------------------------- Part 2: on AAA_V1's chart
  // attach(A): A is the page's side of it: chart, series, IST, tools, infoRow (elements), name(), interval(), bars() (the candles on
  // the chart), fvg() (the FVG layer, static/fvg.js), get(url) (fetch with the page's sign-in), num, css, now(). It gives back refresh(),
  // redraw() and, for the browser checks, marks(), out().
  // THE GAPS ARE THE FVG LEVELS LIST'S (23 November, the owner: "make signals use only the FVG levels list gaps but FVG levels should match the
  // chart levels"): every gap formed today, as the FVG layer lists it (its numbers, its levels, its settings from the FVG gear), on the FVG
  // layer's own finished candles (the same candles, the same count). Nothing here finds a gap of its own, so a signal's gap is always a numbered
  // gap of the list, with the very same two levels. The fill rule is the owner's (scanZones). Today only, as the FVG list is.
  function attach(A) {
    const KEY = "aaaFvgSig", st = { on: true, cfg: {}, out: null, daily: {} }, MINS = { "1m": 1, "5m": 5, "15m": 15 };
    try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) { st.on = s.on !== false; st.cfg = clean(s.cfg || {}); } } catch (e) {}
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ on: st.on, cfg: st.cfg })); } catch (e) {} };
    function clean(c) {  // only what differs from the defaults is kept, and only values the rules can take
      const o = {}, n = (k, lo, hi, whole) => { let v = Number(c[k]); if (c[k] === "" || c[k] == null || !isFinite(v)) return; v = Math.min(hi, Math.max(lo, whole ? Math.round(v) : v)); if (v !== DEFAULTS[k]) o[k] = v; };
      n("max_age_bars", 1, 2000, true); n("confirm_wait", 1, 20, true); n("ema_fast", 1, 200, true); n("ema_slow", 2, 400, true);
      if (["mid", "edge"].includes(c.fill_level)) o.fill_level = c.fill_level;
      if (c.confirm === "candle") o.confirm = "candle";
      if (c.ema_filter === "off") o.ema_filter = "off";
      for (const k of ["entry_from", "entry_to"]) if (/^([01]\d|2[0-3]):[0-5]\d$/.test(c[k] || "") && c[k] !== DEFAULTS[k]) o[k] = c[k];
      return o;
    }
    const cfg = () => Object.assign({}, DEFAULTS, st.cfg);
    const dayOf = (t) => Math.floor((t + A.IST) / 86400), dateOf = (t) => new Date(dayOf(t) * 86400000).toISOString().slice(0, 10);
    const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

    // the daily closes (for the 9/21 EMA of daily closes), once a name, from the server's day candles
    function needDaily() {
      const name = A.name(), d = st.daily[name];
      if (d && (d.list || Date.now() - d.at < 120000)) return;
      st.daily[name] = { at: Date.now(), list: null };
      Promise.resolve().then(() => A.get(`/indices/${encodeURIComponent(name)}/detail?range=3mo&interval=1d`)).then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
        .then(j => { st.daily[name] = { at: Date.now(), list: (j.candles || []).map(c => ({ d: dateOf(c.time), c: c.close })).sort((a, b) => a.d < b.d ? -1 : 1) }; refresh(); })
        .catch(e => { st.daily[name] = { at: Date.now(), list: null, problem: String(e.message || e) }; });
    }
    const why = (w) => { st.out = { why: w, list: [] }; row(); redraw(); };
    function refresh() {
      if (!st.on) { st.out = null; row(); redraw(); return; }
      const fv = A.fvg && A.fvg(), fo = fv && fv.out && fv.out(), c = cfg(), needs = c.ema_filter === "on";
      if (!fo) return why("the signals use the gaps of the FVG levels list: tick FVG");
      if (fo.why) return why("the FVG levels list has no candles to read: " + fo.why);
      if (needs) needDaily();
      const name = A.name(), dl = st.daily[name] && st.daily[name].list;
      if (needs && !dl) return why(st.daily[name] && st.daily[name].problem ? "the daily candles for the trend could not be loaded (" + st.daily[name].problem + ")" : "reading the daily candles for the trend…");
      const s = fv.source(); if (!s.cs) return why(s.why || "no candles");
      const cs = s.cs.slice(0, fo.read);  // exactly the candles the FVG list was made from
      if (cs.length !== fo.read || (cs.length && cs[cs.length - 1].hm !== fo.last)) return why("reading the candles again…");
      const day = new Date(s.day * 86400000).toISOString().slice(0, 10);
      const bars = cs.map(x => ({ d: day, t: mins(x.hm), o: x.o, h: x.h, l: x.l, c: x.c, time: s.start + mins(x.hm) * 60 }));
      const zones = fo.list.map(g => ({ id: g.id, no: fo.no.get(g.id), i: bars.findIndex(b => b.t === mins(g.made_hm) - fo.tf), side: g.kind === "bullish" ? 1 : -1, lo: g.bottom, hi: g.top, mid: (g.bottom + g.top) / 2 })).filter(z => z.i >= 0);
      const trend = needs ? trendDirection(bars, c, dl) : null;
      const { signals } = scanZones(bars, zones, Object.assign({}, c, { interval: fo.tf, carry_days: 0 }), trend, null), ivm = MINS[A.interval()] || fo.tf;
      const no = new Map(zones.map(z => [z.i, z.no]));
      const list = signals.map((g, k) => Object.assign({}, g, { n: k + 1, time: bars[g.i].time, anchor: bars[g.i].time + Math.max(0, fo.tf - ivm) * 60, zone_time: bars[g.zone_i].time, bar: bars[g.i], zone_bar: bars[g.zone_i], gap_no: g.zone_id != null ? zones.find(z => z.id === g.zone_id).no : no.get(g.zone_i) }));
      st.out = { list, read: bars.length, last: bars.length ? hmOf(bars[bars.length - 1].t) : null, today: day, tf: fo.tf, trend: trend ? trend[bars.length - 1] : null, trendOn: needs, fill: c.fill_level, gaps: zones.length };
      row(); redraw();
    }

    // ---------------------------------------------------------------- the arrows and zones on the chart
    const FONT = () => getComputedStyle(document.body).fontFamily;
    function idxAt(time) {  // the chart candle that starts at this time
      const bars = A.bars(); let a = 0, z = bars.length - 1; if (z < 0 || time < bars[0].time) return -1;
      while (a < z) { const m = (a + z + 1) >> 1; if (bars[m].time <= time) a = m; else z = m - 1; }
      return a;
    }
    function marks() {  // where each signal stands now (media pixels); also for the browser checks
      const o = st.out; if (!st.on || !o || !o.list.length) return [];
      const ts = A.chart.timeScale(), Y = (p) => A.series.priceToCoordinate(p), bars = A.bars();
      return o.list.map(g => {
        const i = idxAt(g.anchor); if (i < 0) return null; const x = ts.logicalToCoordinate(i), zi = idxAt(g.zone_time), zx = zi < 0 ? ts.logicalToCoordinate(0) : ts.logicalToCoordinate(zi);
        const cand = bars[i], y = Y(g.side === 1 ? cand.low : cand.high), top = Y(g.zone_hi), bottom = Y(g.zone_lo), ey = Y(g.entry);
        if (x == null || y == null) return null;
        return { g, n: g.n, x, y, zx, top, bottom, ey, bar: i };
      }).filter(Boolean);
    }
    function paint(scope) {
      const list = marks(); if (!list.length) return;
      const ctx = scope.context, hr = scope.horizontalPixelRatio, vr = scope.verticalPixelRatio;
      ctx.save(); const taken = [];
      for (const m of list) {  // the zone first (faint), from the gap's third candle to the fill candle
        if (m.top == null || m.bottom == null) continue;
        const col = A.css(m.g.side === 1 ? "--up" : "--down"), x0 = Math.round(Math.min(m.zx, m.x) * hr), w = Math.max(2, Math.round(Math.abs(m.x - m.zx) * hr)), y0 = Math.round(Math.min(m.top, m.bottom) * vr), h = Math.max(1, Math.round(Math.abs(m.bottom - m.top) * vr));
        ctx.globalAlpha = 0.10; ctx.fillStyle = col; ctx.fillRect(x0, y0, w, h);
        ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, Math.round(vr)); ctx.setLineDash([3 * hr, 3 * hr]); ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h); ctx.setLineDash([]);
      }
      for (const m of list) {
        const ce = m.g.side === 1, col = A.css(ce ? "--up" : "--down"), x = Math.round(m.x * hr), s = Math.round(7 * vr), gap = Math.round(5 * vr);
        const y = Math.round(m.y * vr) + (ce ? gap : -gap);  // CE: arrow under the candle, pointing up; PE: above it, pointing down
        ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.beginPath();
        if (ce) { ctx.moveTo(x, y); ctx.lineTo(x - s, y + s * 1.6); ctx.lineTo(x + s, y + s * 1.6); } else { ctx.moveTo(x, y); ctx.lineTo(x - s, y - s * 1.6); ctx.lineTo(x + s, y - s * 1.6); }
        ctx.closePath(); ctx.fill();
        ctx.font = `600 ${Math.round(10 * vr)}px ${FONT()}`; ctx.textAlign = "center"; ctx.textBaseline = ce ? "top" : "bottom";
        const full = `${m.n} · ${m.g.action} ${A.num(m.g.entry)}`, th = Math.round(13 * vr), ty = y + (ce ? s * 1.6 + Math.round(2 * vr) : -s * 1.6 - Math.round(2 * vr));
        const rectOf = (text) => { const tw = ctx.measureText(text).width; return { text, tw, r: [x - tw / 2, ce ? ty : ty - th, x + tw / 2, ce ? ty + th : ty] }; };
        const hit = (r) => taken.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
        let L = rectOf(full); if (hit(L.r)) L = rectOf(String(m.n));  // two labels would lie on each other: the second shows only its number (the panel's row number)
        if (hit(L.r)) continue; taken.push(L.r);
        ctx.save(); ctx.globalAlpha = 0.8; ctx.fillStyle = A.css("--surface"); ctx.fillRect(L.r[0] - 2 * hr, L.r[1], L.tw + 4 * hr, th); ctx.restore();
        ctx.fillStyle = col; ctx.fillText(L.text, x, ty);
      }
      ctx.restore();
    }
    const prim = { attached(p) { this.requestUpdate = p.requestUpdate; }, detached() { this.requestUpdate = null; }, updateAllViews() {}, paneViews() { return [{ zOrder: () => "top", renderer: () => ({ draw: (target) => target.useBitmapCoordinateSpace(paint) }) }]; } };
    A.series.attachPrimitive(prim);
    const redraw = () => prim.requestUpdate && prim.requestUpdate();

    // ---------------------------------------------------------------- the tick box, the box of rows, the settings box
    const style = document.createElement("style");
    style.textContent = `
      #fs-gear { width: 32px; height: 32px; flex: none; display: grid; place-items: center; background: transparent; border: 0; border-radius: 6px; color: var(--ink-2); cursor: pointer; padding: 0; }
      #fs-gear:hover { background: var(--hover); } #fs-gear[hidden] { display: none; }
      #fs-gear svg, #fs-dlg .x svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
      #fs-row { padding: 3px 12px 5px; border-bottom: 1px solid var(--border); font-size: 13px; line-height: 1.5; flex: none; } #fs-row[hidden] { display: none; }
      #fs-row .r { display: flex; flex-wrap: wrap; gap: 0 14px; align-items: baseline; } #fs-row .k { color: var(--muted); } #fs-row .v { font-weight: 600; font-variant-numeric: tabular-nums; }
      #fs-row .up { color: var(--up); } #fs-row .down { color: var(--down); }
      #fs-row details.fl > summary { cursor: pointer; color: var(--ink); font-weight: 600; min-height: 26px; list-style-position: inside; }
      #fs-row .lh, #fs-row .lr { display: grid; grid-template-columns: 20px auto minmax(0, 1fr) auto; gap: 0 8px; align-items: baseline; padding: 2px 0; font-variant-numeric: tabular-nums; }
      #fs-row .lh { color: var(--muted); font-size: 12px; border-bottom: 1px solid var(--border); } #fs-row .lr .cl, #fs-row .lr .en { font-weight: 600; white-space: nowrap; }
      #fs-row .sub { grid-column: 2 / -1; color: var(--muted); font-size: 12px; }
      #fs-row .lbody { max-height: 58vh; overflow-y: auto; overscroll-behavior: contain; } #fs-row .none, #fs-row .note { color: var(--muted); padding: 2px 0; } #fs-row .note { font-size: 12px; }
      #fs-shade { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.35); display: grid; place-items: center; }
      #fs-dlg { width: min(430px, 94vw); max-height: min(640px, 92vh); display: flex; flex-direction: column; background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,.35); font-size: 14px; }
      #fs-dlg header, #fs-dlg footer { flex: none; } #fs-dlg header { display: flex; align-items: center; gap: 8px; padding: 12px 10px 8px 16px; border-bottom: 1px solid var(--border); } #fs-dlg h2 { flex: 1; margin: 0; font-size: 17px; font-weight: 600; }
      #fs-dlg .x { width: 32px; height: 32px; display: grid; place-items: center; background: transparent; border: 0; border-radius: 6px; color: var(--ink-2); cursor: pointer; padding: 0; }
      #fs-dlg .body { padding: 8px 16px; overflow-y: auto; flex: 1; min-height: 160px; }
      #fs-dlg .row { display: flex; align-items: center; gap: 10px; min-height: 40px; } #fs-dlg .row > .n { flex: 1; min-width: 0; } #fs-dlg .row label.n { display: flex; align-items: center; gap: 8px; cursor: pointer; }
      #fs-dlg input[type="number"], #fs-dlg input[type="time"], #fs-dlg select { font: inherit; color: var(--ink); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; min-height: 32px; }
      #fs-dlg input[type="number"] { width: 92px; } #fs-dlg select { min-width: 170px; } #fs-dlg input[type="checkbox"] { width: 17px; height: 17px; accent-color: var(--accent); }
      #fs-dlg .hint { color: var(--muted); font-size: 12px; line-height: 1.45; margin: 0 0 4px; }
      #fs-dlg footer { display: flex; gap: 8px; padding: 10px 16px 14px; border-top: 1px solid var(--border); } #fs-dlg footer .grow { flex: 1; }
      #fs-dlg footer button { font: inherit; min-height: 34px; padding: 0 16px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); cursor: pointer; }
      #fs-dlg footer button.ok { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
      @media (max-width: 480px) { #fs-dlg select { min-width: 130px; } #fs-dlg .row { gap: 6px; } }`;
    document.head.appendChild(style);
    const label = document.createElement("label"); label.innerHTML = `<input type="checkbox" id="show-fvgsig"> FVG signals`; label.title = "BUY CE / BUY PE when a gap of the FVG levels list is filled and holds";
    const gear = document.createElement("button"); gear.type = "button"; gear.id = "fs-gear"; gear.title = "FVG signals settings"; gear.setAttribute("aria-label", "FVG signals settings");
    gear.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6"/></svg>';
    A.tools.appendChild(label); A.tools.appendChild(gear);
    const box = label.querySelector("input"); box.checked = st.on; gear.hidden = !st.on;
    box.addEventListener("change", () => { st.on = box.checked; gear.hidden = !st.on; save(); refresh(); });
    gear.addEventListener("click", () => dialog());
    const rowEl = document.createElement("div"); rowEl.id = "fs-row"; rowEl.hidden = true; (A.infoRow.parentNode || document.body).appendChild(rowEl);
    let open = null, shownRow = "";

    function row() {
      const o = st.out; rowEl.hidden = !st.on || !o; if (rowEl.hidden) { shownRow = ""; return; }
      const cell = (k, v, c) => `<span><span class="k">${k}</span> <span class="v${c ? " " + c : ""}">${v}</span></span>`;
      let html;
      if (o.why) html = `<div class="r">${cell("FVG signals", esc(o.why))}</div>`;
      else {
        const trend = !o.trendOn ? "off" : o.trend === 1 ? "up (BUY CE only)" : o.trend === -1 ? "down (BUY PE only)" : "not known";
        const ce = o.list.filter(g => g.side === 1).length, pe = o.list.length - ce;
        const rows = o.list.slice().reverse().map(g => `<div class="lr ${g.side === 1 ? "up" : "down"}"><span class="no">${g.n}</span><span class="cl">${hmOf(g.t)}</span><span class="act">${g.action}</span><span class="en">${A.num(g.entry)}</span>`
          + `<span class="sub">FVG ${g.gap_no} (${g.side === 1 ? "bullish" : "bearish"}) ${A.num(g.zone_lo)} – ${A.num(g.zone_hi)}, formed ${hmOf(g.zone_bar.t)}; ${FILLED[o.fill]}; entry at the close, ${hmOf(g.close_min)}</span></div>`).join("");
        html = `<div class="r">${cell("FVG signals on " + o.tf + "-minute candles", o.last ? "last candle " + o.last : "no finished candle yet")}${cell("Trend today", trend)}${cell("Signals today", `${ce} CE, ${pe} PE`)}</div>`
          + `<details class="fl"><summary>FVG fill signals <span class="k">(${o.list.length})</span></summary>${o.list.length ? `<div class="lh"><span class="no">No.</span><span class="cl">Candle</span><span class="act">Call</span><span class="en">Entry</span></div><div class="lbody">${rows}</div>` : `<div class="none">No fill signal yet.</div>`}`
          + `<div class="note">The gaps are those of the FVG levels list, with its numbers and levels. The entry is the close of the candle that filled the gap. A signal for study, not an order.</div></details>`;
      }
      if (html === shownRow) return;
      const d = rowEl.querySelector("details"); if (d) open = d.open;
      if (open == null) open = !!(window.matchMedia && matchMedia("(min-width: 900px)").matches);
      shownRow = html; rowEl.innerHTML = html;
      const nd = rowEl.querySelector("details"); if (nd) { nd.open = open; nd.addEventListener("toggle", () => { open = nd.open; }); }
    }
    const FILLED = { full: "filled and held", mid: "reached its midpoint and held", edge: "touched and held" };

    function dialog() {
      if (document.getElementById("fs-shade")) return;
      const c = cfg(), shade = document.createElement("div"); shade.id = "fs-shade";
      const numRow = (k, name, step, hint) => `<div class="row"><span class="n">${name}</span><input type="number" data-k="${k}" min="0" step="${step}" inputmode="decimal" value="${c[k]}"></div>${hint ? `<p class="hint">${hint}</p>` : ""}`;
      const sel = (k, name, opts) => `<div class="row"><span class="n">${name}</span><select data-k="${k}">${opts.map(([v, n]) => `<option value="${v}"${String(c[k]) === v ? " selected" : ""}>${n}</option>`).join("")}</select></div>`;
      shade.innerHTML = `<div id="fs-dlg" role="dialog" aria-modal="true" aria-label="FVG signals settings"><header><h2>FVG fill signals</h2><button type="button" class="x" data-do="cancel" aria-label="Close"><svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15"/></svg></button></header><div class="body">
        <p class="hint">The gaps are those of the FVG levels list (settings: the FVG gear). A gap is filled and holds: BUY CE (bullish gap) or BUY PE (bearish gap), entry at the close of the filling candle.</p>
        ${sel("fill_level", "A gap counts as filled when", [["full", "price trades through to its far edge"], ["mid", "price reaches its midpoint"], ["edge", "price first touches its near edge"]])}
        ${sel("confirm", "Signal on", [["none", "the candle that fills the gap"], ["candle", "a following candle that closes the reversal way"]])}
        ${numRow("confirm_wait", "Candles to wait for it", 1)}
        ${sel("ema_filter", "Trend filter (9 EMA / 21 EMA)", [["on", "on"], ["off", "off"]])}
        ${numRow("ema_fast", "Fast EMA", 1)}${numRow("ema_slow", "Slow EMA", 1)}
        ${numRow("max_age_bars", "A gap is dropped after (candles)", 1)}
        <p class="hint">The trend filter uses the EMAs of the finished daily closes.</p>
        <div class="row"><span class="n">Signals from (candle close)</span><input type="time" data-k="entry_from" value="${c.entry_from}"></div>
        <div class="row"><span class="n">Signals until (candle close)</span><input type="time" data-k="entry_to" value="${c.entry_to}"></div>
        </div><footer><button type="button" data-do="defaults">Defaults</button><span class="grow"></span><button type="button" data-do="cancel">Cancel</button><button type="button" class="ok" data-do="ok">Ok</button></footer></div>`;
      document.body.appendChild(shade);
      const q = (k) => shade.querySelector(`[data-k="${k}"]`), close = () => { shade.remove(); document.removeEventListener("keydown", key); }, key = (e) => { if (e.key === "Escape") close(); };
      document.addEventListener("keydown", key);
      shade.addEventListener("click", (e) => {
        if (e.target === shade) return close();
        const b = e.target.closest("button[data-do]"); if (!b) return;
        if (b.dataset.do === "cancel") return close();
        if (b.dataset.do === "defaults") { for (const k of Object.keys(DEFAULTS)) { const el = q(k); if (el) el.value = String(DEFAULTS[k]); } return; }
        const got = {}; for (const k of Object.keys(DEFAULTS)) { const el = q(k); if (el) got[k] = el.value; }
        st.cfg = clean(got); save(); close(); refresh();
      });
    }

    // the FVG layer words change when its gaps, its candles or its settings change (and when it is ticked on or off): read again then
    { const fr = document.getElementById("fvg-row"), fb = document.getElementById("show-fvg"); let queued = false;
      const again = () => { if (queued) return; queued = true; setTimeout(() => { queued = false; refresh(); }, 0); };
      if (fr && window.MutationObserver) new MutationObserver(again).observe(fr, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden"] });
      if (fb) fb.addEventListener("change", again); }
    refresh();
    const api = { refresh, redraw, marks, out: () => st.out, state: () => st };
    attach.last = api;
    return api;
  }

  const api = Object.assign(calc, { attach: typeof attach === "function" ? attach : null });
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.FvgSig = api;
})(typeof window !== "undefined" ? window : globalThis);
