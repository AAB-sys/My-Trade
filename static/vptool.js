// AAA_V1's volume profile tools: the Fixed range volume profile and the Anchored volume profile (20 November 2026, the owner, with
// the tool marked on a chart and a build document, "AAA_V1 Volume Profile Tool Logic": "go through it thoroughly ... if u find any
// bug, remove it, rectify it ... it should go to the AAA_V1 page. No logic change for all other pages at all").
//
// This file is the document's Python module (its section 8) in JavaScript, rule for rule, and under it the tool itself (the
// drawing, the handles, the settings box). The rules follow the public description of such a tool; no other party's code is
// used. The same rules stand in lab/vptool_ref.py, and lab/check_vptool.py proves the two give the same rows, POC, value area and
// developing lines.
//
// Five places differ from the document's Python, each a fault put right (the document, the owner: "rectify it"):
//   1. Finer candles that stop early, or have a hole, left the chart candles there with no source at all: their volume was lost.
//      Now a chart candle with no finer candle inside it is counted from the chart candle itself (buildSource).
//   2. Finer candles that carry no volume, beside chart candles that do, turned the whole profile into "time at price". Now the
//      chart candles are used then (buildSource).
//   3. With the value area at 100% the last row could be left out, by a rounding error of the sums (a row a hair "larger" than
//      what was left of the target). The comparison now allows for that error (valueArea).
//   4. Past 2,000 rows the row height changed but "ticks per row" still said the old figure. It now says the real one (rowsLayout).
//   5. An empty range raised an error. It now gives no profile (compute returns null).
// A bar here: {t: start in UTC milliseconds, o, h, l, c, v}. Bars are sorted by time, oldest first.
(function (root) {
  "use strict";
  const MINUTE = 60000, DAY = 86400000, MAX_ROWS = 2000, SESSION_MINUTES = 375, MAX_LOWER_BARS = 5000;
  // The settings and their defaults (the document, section 3). Opacities are percentages.
  const DEFAULTS = {
    layout: "rows", size: 24, vol: "updown", va: 70, extend: false,
    show: true, values: false, width: 30, place: "left",
    upC: "#1592e6", upA: 30, dnC: "#fbc123", dnA: 30, vaUpC: "#1592e6", vaUpA: 75, vaDnC: "#fbc123", vaDnA: 75,
    poc: true, pocC: "#e0434b", vah: false, vahC: "#7c8598", val: false, valC: "#7c8598",
    dpoc: false, dpocC: "#e0434b", dva: false, dvaC: "#2f9c93",
    box: true, boxC: "#2f62e8", boxA: 6, labels: true,
    hideTf: {},
  };
  const LOWER_TFS = [["1m", MINUTE], ["5m", 5 * MINUTE], ["15m", 15 * MINUTE], ["30m", 30 * MINUTE], ["1h", 60 * MINUTE], ["4h", 240 * MINUTE], ["1D", DAY]];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const jsRound = (x) => Math.floor(x + 0.5);
  const withDefaults = (s) => Object.assign({}, DEFAULTS, s || {});

  // 1. The range (section 4.1): the first and last chart bar inside the profile, or null. Fixed: from t1 to t2, either order.
  // Anchored, or fixed with "extend right": from t1 to the last bar. A time between two bars moves inward.
  function selectRange(bars, t1, t2, anchored, extend) {
    if (!bars || !bars.length) return null;
    if (t2 == null) t2 = t1;
    if (!anchored && t2 < t1) { const x = t1; t1 = t2; t2 = x; }
    let i1 = bars.findIndex(b => b.t >= t1); if (i1 < 0) i1 = bars.length;
    let i2 = bars.length - 1;
    if (!(anchored || extend)) { i2 = -1; for (let i = bars.length - 1; i >= 0; i--) if (bars[i].t <= t2) { i2 = i; break; } }
    return i1 > i2 ? null : [i1, i2];
  }

  // 2. The bars to count from (section 4.2): the finest interval that gives fewer than 5,000 bars over the range; null: the chart's own.
  function pickLowerTf(chartTfMs, barCount) {
    let minutes;
    if (chartTfMs >= DAY) minutes = barCount * chartTfMs / DAY * (chartTfMs > DAY ? 5 / 7 : 1) * SESSION_MINUTES;
    else minutes = barCount * chartTfMs / MINUTE;
    for (const [name, ms] of LOWER_TFS) {
      const count = ms >= DAY ? minutes / SESSION_MINUTES : minutes / (ms / MINUTE);
      if (count < MAX_LOWER_BARS) return ms >= chartTfMs ? null : [name, ms];
    }
    return null;
  }
  // [[bar, the milliseconds it covers]], by time. cutHi: the start of the chart bar still forming, which then always comes from
  // the chart (the document's choice, so a live price shows at once); Infinity: no such bar.
  function buildSource(chartBars, chartTfMs, lowerBars, lowerTfMs, cutHi) {
    if (cutHi == null) cutHi = Infinity;
    const plain = () => chartBars.map(b => [b, chartTfMs]);
    if (!lowerBars || !lowerBars.length) return plain();
    const hasVolume = (a) => a.some(b => b.v > 0);
    if (!hasVolume(lowerBars) && hasVolume(chartBars)) return plain();  // fault 2
    let cutLo = chartBars[0].t; const first = lowerBars[0].t;
    if (first >= chartBars[0].t + chartTfMs) { const b = chartBars.find(x => x.t >= first); cutLo = b ? b.t : Infinity; }  // the finer bars start late: the switch is on a chart bar's edge
    const src = []; let k = 0;
    while (k < lowerBars.length && lowerBars[k].t < cutLo) k++;
    for (let i = 0; i < chartBars.length; i++) {
      const cb = chartBars[i], until = i + 1 < chartBars.length ? chartBars[i + 1].t : Infinity, from = k;
      while (k < lowerBars.length && lowerBars[k].t < until) k++;
      if (cb.t < cutLo || cb.t >= cutHi || k === from) src.push([cb, chartTfMs]);  // k === from: no finer bar inside this chart bar (fault 1)
      else for (let j = from; j < k; j++) src.push([lowerBars[j], lowerTfMs]);
    }
    return src;
  }

  // 3. The rows (section 4.3): [row height, row count, ticks per row].
  function rowsLayout(lo, hi, layout, size, tick) {
    const span = Math.max(hi - lo, tick), count = (ticks) => Math.ceil(span / (ticks * tick) - 1e-9);
    let tpr;
    if (layout === "rows") {
      const want = Math.max(1, jsRound(size)), raw = span / want / tick, down = Math.max(1, Math.floor(raw)), up = Math.max(1, Math.ceil(raw));
      tpr = Math.abs(count(down) - want) < Math.abs(count(up) - want) ? down : up;
    } else tpr = Math.max(1, jsRound(size));
    let height = tpr * tick, n = Math.max(1, count(tpr));
    if (n > MAX_ROWS) { n = MAX_ROWS; height = span / MAX_ROWS; tpr = height / tick; }  // fault 4
    return [height, n, tpr];
  }

  // 4. The POC (section 4.5): the row with the most volume; a tie goes to the row nearest the middle, then to the lower one.
  function pointOfControl(tot) {
    const mid = (tot.length - 1) / 2; let best = -1, poc = 0;
    for (let r = 0; r < tot.length; r++) { const v = tot[r]; if (v > best || (v === best && Math.abs(r - mid) < Math.abs(poc - mid))) { best = v; poc = r; } }
    return poc;
  }
  // The value area (section 4.6): [VAL row, VAH row]. From the POC, take the larger of the next row above and the next row below
  // (equal: the nearer to the POC, then the one above); stop when the chosen row would pass the target, or no row is left.
  function valueArea(tot, poc, pct) {
    const n = tot.length; let sum = 0; for (const v of tot) sum += v;
    let remaining = sum * pct / 100 - tot[poc], hi = poc, lo = poc; const eps = 1e-9 * Math.max(1, sum);  // fault 3
    while (remaining > 0) {
      const above = hi + 1 < n ? tot[hi + 1] : -1, below = lo > 0 ? tot[lo - 1] : -1;
      if (above < 0 && below < 0) break;
      const goUp = above !== below ? above > below : (hi + 1 - poc) <= (poc - lo + 1), v = goUp ? above : below;
      if (v > remaining + eps) break;
      remaining -= v; if (goUp) hi++; else lo--;
    }
    return [lo, hi];
  }

  // 5. The profile (sections 4.4, 4.7, 4.8) of chartBars, the chart bars inside the range. null: no bars.
  function compute(chartBars, chartTfMs, tick, settings, lowerBars, lowerTfMs, cutHi) {
    if (!chartBars || !chartBars.length) return null;  // fault 5
    const o = withDefaults(settings), src = buildSource(chartBars, chartTfMs, lowerBars, lowerTfMs, cutHi);
    let lo = Infinity, hi = -Infinity, vsum = 0;
    for (const [b] of src) { if (b.l < lo) lo = b.l; if (b.h > hi) hi = b.h; vsum += b.v || 0; }
    const noVolume = !(vsum > 0), [height, n, tpr] = rowsLayout(lo, hi, o.layout, o.size, tick);
    const up = new Array(n).fill(0), down = new Array(n).fill(0), total = new Array(n).fill(0);
    const developing = o.dpoc || o.dva, devPoc = [], devVal = [], devVah = [];
    let k = 0;
    for (let i = 0; i < chartBars.length; i++) {
      const until = i + 1 < chartBars.length ? chartBars[i + 1].t : Infinity;
      while (k < src.length && src[k][0].t < until) {
        const b = src[k][0], covered = src[k][1]; k++;
        const weight = noVolume ? covered / MINUTE : (b.v || 0);  // no volume anywhere in the range: the minutes the bar covers (time at price)
        if (!(weight > 0)) continue;
        const side = b.c > b.o ? up : down;  // a close above the open is up volume; every other bar is down volume
        const r0 = clamp(Math.floor((b.l - lo) / height), 0, n - 1), r1 = clamp(Math.floor((b.h - lo) / height - 1e-9), r0, n - 1), rng = b.h - b.l;
        if (r0 === r1 || !(rng > 0)) { side[r0] += weight; total[r0] += weight; }
        else for (let r = r0; r <= r1; r++) {  // shared by how much of the bar's high-low range lies in each row
          const share = weight * Math.max(0, Math.min(b.h, lo + (r + 1) * height) - Math.max(b.l, lo + r * height)) / rng;
          side[r] += share; total[r] += share;
        }
      }
      if (developing) { const p = pointOfControl(total); devPoc.push(p); if (o.dva) { const [a, z] = valueArea(total, p, o.va); devVal.push(a); devVah.push(z); } }
    }
    const poc = pointOfControl(total), [val, vah] = valueArea(total, poc, o.va), add = (a) => a.reduce((s, v) => s + v, 0);
    return { lo, hi, row_height: height, rows: n, ticks_per_row: tpr, up, down, total, poc, val, vah,
      poc_price: lo + (poc + 0.5) * height, val_price: lo + val * height, vah_price: lo + (vah + 1) * height,
      dev_poc: devPoc, dev_val: devVal, dev_vah: devVah, no_volume: noVolume, volume: add(total), up_volume: add(up), down_volume: add(down) };
  }

  // 6. The rows' lengths (section 5): for each row a list of [offset px, length px, kind]; kind "up", "down", "va_up" or "va_down".
  function histogramBars(profile, settings, boxWidthPx) {
    const o = withDefaults(settings), up = profile.up, dn = profile.down, tot = profile.total, mode = o.vol;
    let scale = 0; for (let r = 0; r < profile.rows; r++) scale = Math.max(scale, mode === "delta" ? Math.abs(up[r] - dn[r]) : tot[r]);
    const maxLen = boxWidthPx * clamp(o.width, 1, 100) / 100, out = [];
    for (let r = 0; r < profile.rows; r++) {
      const inVa = profile.val <= r && r <= profile.vah, ku = inVa ? "va_up" : "up", kd = inVa ? "va_down" : "down";
      if (!(scale > 0)) out.push([]);
      else if (mode === "total") out.push([[0, tot[r] / scale * maxLen, ku]]);
      else if (mode === "delta") { const d = up[r] - dn[r]; out.push([[0, Math.abs(d) / scale * maxLen, d >= 0 ? ku : kd]]); }
      else { const wu = up[r] / scale * maxLen, wd = dn[r] / scale * maxLen; out.push([[0, wu, ku], [wu, wd, kd]]); }
    }
    return out;
  }

  const calc = { MINUTE, DAY, MAX_ROWS, DEFAULTS, LOWER_TFS, withDefaults, selectRange, pickLowerTf, buildSource, rowsLayout, pointOfControl, valueArea, compute, histogramBars };
  // ------------------------------------------------------------------------------------------------ the tool on the chart
  // attach(A) puts the two tools on a chart and gives back the few calls the page makes. A is the page's side of it:
  //   chart, series (the candles), IST (seconds), wrap and toolbar (elements), name(), interval(), bars(), volumes(), fine(),
  //   fineVolumes() (the candles shown and their volume; the 1-minute candles and theirs, or null), xOf(seconds), yOf(price),
  //   placeOf(seconds), timeOf(place), pointAt(param), num, short, css, holdChart(still), setTool(tool), changed()
  // Both tools are drawing objects (the document, section 2): picked by a tap, moved by the body, stretched by a handle, locked,
  // hidden, deleted, and kept for the index in this browser. A double tap, or the gear in the small bar over a picked profile,
  // opens the settings.
  function attach(A) {
    const TF = { "1m": MINUTE, "5m": 5 * MINUTE, "15m": 15 * MINUTE }, TF_NAMES = { "1m": "1 minute", "5m": "5 minutes", "15m": "15 minutes" };
    const TITLE = { frvp: "Fixed range volume profile", avp: "Anchored volume profile" };
    const st = { items: [], picked: null, placing: null, hover: null, drag: null, dialog: null, seq: 1 };
    let B = [], F = null;
    const key = () => "aaaVolumeProfileTools:" + A.name();
    const tick = () => A.name() === "SENSEX" ? 0.01 : 0.05;  // the smallest step of the index's price (the document, 4.3; SENSEX is quoted to 0.01)
    const visible = (it) => !it.hidden && !withDefaults(it.s).hideTf[A.interval()];
    const diff = (o) => { const s = {}; for (const k of Object.keys(DEFAULTS)) if (JSON.stringify(o[k]) !== JSON.stringify(DEFAULTS[k])) s[k] = o[k]; return s; };

    function load() {
      st.items = []; st.picked = null; st.placing = null; st.drag = null;
      try { const saved = JSON.parse(localStorage.getItem(key()) || "[]"); if (Array.isArray(saved)) st.items = saved.filter(d => d && TITLE[d.kind] && isFinite(d.t1)).map(d => ({ id: st.seq++, kind: d.kind, t1: d.t1, t2: d.kind === "frvp" && isFinite(d.t2) ? d.t2 : d.t1, s: diff(withDefaults(d.s)), locked: !!d.locked, hidden: !!d.hidden })); } catch (e) {}
      refresh();
    }
    function save() { try { localStorage.setItem(key(), JSON.stringify(st.items.map(d => ({ kind: d.kind, t1: d.t1, t2: d.t2, s: d.s, locked: d.locked, hidden: d.hidden })))); } catch (e) {} bar(); A.changed(); }

    // the candles as the count wants them: the chart's, and the 1-minute ones under them
    function readBars() {
      const vol = A.volumes(), f = A.fine(), fv = A.fineVolumes(), as = (b, m) => ({ t: b.time * 1000, o: b.open, h: b.high, l: b.low, c: b.close, v: m.get(b.time) || 0 });
      B = A.bars().map(b => as(b, vol)); F = f && f.length ? f.map(b => as(b, fv)) : null;
    }
    // One profile, counted (section 4). While it is being placed or dragged only the chart's candles are used (section 6).
    function count(it, quick) {
      const anchored = it.kind === "avp", o = withDefaults(it.s), r = selectRange(B, it.t1, anchored ? null : it.t2, anchored, o.extend);
      it.p = null; it.cb = null; if (!r) return;
      const cb = B.slice(r[0], r[1] + 1), tf = TF[A.interval()]; let low = null, lowTf = null;
      if (!quick && F && tf > MINUTE) { const pick = pickLowerTf(tf, cb.length); if (pick && pick[1] === MINUTE) { const from = cb[0].t, to = cb[cb.length - 1].t + tf; low = F.filter(b => b.t >= from && b.t < to); lowTf = MINUTE; } }
      it.p = compute(cb, tf, tick(), it.s, low, lowTf, Infinity); it.cb = cb;
    }
    function refresh() { readBars(); for (const it of st.items) count(it, false); if (st.placing) preview(); redraw(); bar(); }
    function preview() { const g = st.placing; if (!g) return; g.t2 = st.hover != null ? st.hover : g.t1; count(g, true); }

    // ---------------------------------------------------------------- where a profile stands on the screen now (media pixels)
    function geom(it) {
      const p = it.p, cb = it.cb; if (!p || !cb) return null;
      const xa = A.xOf(cb[0].t / 1000), xb = A.xOf(cb[cb.length - 1].t / 1000), top = A.yOf(p.hi), bottom = A.yOf(p.lo);
      if ([xa, xb, top, bottom].some(v => v == null)) return null;
      const half = Math.max(1, A.chart.timeScale().options().barSpacing / 2), l = xa - half, r = xb + half, o = withDefaults(it.s);
      const anchored = it.kind === "avp", h1 = A.xOf(Math.min(it.t1, anchored ? it.t1 : it.t2) / 1000), h2 = anchored ? null : A.xOf(Math.max(it.t1, it.t2) / 1000);
      return { l, r, top, bottom, o, mid: (top + bottom) / 2, pocY: A.yOf(p.poc_price), handles: [[h1 == null ? l : h1, it.t1 <= it.t2 || anchored ? "a" : "b"]].concat(anchored ? [] : [[h2 == null ? r : h2, it.t1 <= it.t2 ? "b" : "a"]]) };
    }
    const rowY = (p, r) => [A.yOf(p.lo + (r + 1) * p.row_height), A.yOf(p.lo + r * p.row_height)];
    function hit(x, y) {  // the profile under the pointer and the part held: "a" or "b" (a handle), or "all"
      for (let i = st.items.length - 1; i >= 0; i--) {
        const it = st.items[i]; if (!visible(it)) continue; const g = geom(it); if (!g) continue;
        if (it === st.picked) for (const [hx, part] of g.handles) if (Math.hypot(x - hx, y - g.mid) <= 12) return { it, part };
        const R = 6, inX = x >= g.l - R && x <= g.r + R, inY = y >= g.top - R && y <= g.bottom + R;
        if (inX && inY && (Math.abs(x - g.l) <= R || Math.abs(x - g.r) <= R || Math.abs(y - g.top) <= R || Math.abs(y - g.bottom) <= R)) return { it, part: "all" };
        if (g.o.poc && g.pocY != null && Math.abs(y - g.pocY) <= R && x >= g.l && x <= g.r) return { it, part: "all" };
        if (g.o.show && x >= g.l && x <= g.r) { const p = it.p, hist = histogramBars(p, it.s, g.r - g.l);
          for (let r = 0; r < p.rows; r++) { const [y0, y1] = rowY(p, r); if (y0 == null || y1 == null || y < y0 || y > y1) continue; let len = 0; for (const s of hist[r]) len += s[1]; if (g.o.place === "left" ? x <= g.l + len : x >= g.r - len) return { it, part: "all" }; } }
      }
      return null;
    }

    // ---------------------------------------------------------------- the drawing (section 5)
    const rgba = (hex, a) => { const n = parseInt(String(hex).slice(1), 16) || 0; return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${Math.max(0, Math.min(100, a)) / 100})`; };
    const FONT = () => getComputedStyle(document.body).fontFamily;
    function paintOne(scope, it, ghost, words) {  // words: only the levels' names and prices, drawn over the candles so they can be read
      const g = geom(it); if (!g) return; const p = it.p, cb = it.cb, o = g.o, ctx = scope.context, hr = scope.horizontalPixelRatio, vr = scope.verticalPixelRatio;
      const X = (v) => Math.round(v * hr), Y = (v) => Math.round(v * vr), w = g.r - g.l;
      ctx.save(); if (ghost) ctx.globalAlpha = 0.6;
      if (!words && o.box) { ctx.fillStyle = rgba(o.boxC, o.boxA); ctx.fillRect(X(g.l), Y(g.top), X(g.r) - X(g.l), Y(g.bottom) - Y(g.top)); }
      if (!words && o.show) {
        const hist = histogramBars(p, it.s, w), col = { up: rgba(o.upC, o.upA), down: rgba(o.dnC, o.dnA), va_up: rgba(o.vaUpC, o.vaUpA), va_down: rgba(o.vaDnC, o.vaDnA) };
        ctx.font = `${Math.round(10 * vr)}px ${FONT()}`; ctx.textBaseline = "middle";
        for (let r = 0; r < p.rows; r++) {
          const [y0, y1] = rowY(p, r); if (y0 == null || y1 == null) continue;
          const t = Y(y0), b = Y(y1), gap = b - t >= 3 ? 1 : 0, hgt = Math.max(1, b - t - gap); let len = 0;
          for (const [off, n, kind] of hist[r]) { if (!(n > 0)) continue; len += n; ctx.fillStyle = col[kind];
            const x0 = o.place === "left" ? g.l + off : g.r - off - n; ctx.fillRect(X(x0), t, Math.max(1, X(x0 + n) - X(x0)), hgt); }
          if (o.values && y1 - y0 >= 11 && p.total[r] > 0) {  // the volume written on the row, when the row is tall enough
            const text = o.vol === "delta" ? (p.up[r] - p.down[r] >= 0 ? "+" : "−") + A.short(Math.abs(p.up[r] - p.down[r])) : o.vol === "total" ? A.short(p.total[r]) : A.short(p.up[r]) + " × " + A.short(p.down[r]);
            ctx.fillStyle = A.css("--ink"); ctx.textAlign = o.place === "left" ? "left" : "right"; ctx.fillText(text, X(o.place === "left" ? g.l + 4 : g.r - 4), Math.round((t + b) / 2));
          }
        }
      }
      const step = (rowsOf, edge, color) => {  // a line that steps from bar to bar: where the level stood after each bar
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, Math.round(1.5 * vr)); ctx.beginPath(); let started = false, last = null;
        for (let i = 0; i < cb.length && i < rowsOf.length; i++) { const x = A.xOf(cb[i].t / 1000), y = A.yOf(p.lo + (rowsOf[i] + edge) * p.row_height); if (x == null || y == null) continue;
          if (!started) { ctx.moveTo(X(x), Y(y) + 0.5); started = true; } else { ctx.lineTo(X(x), last); ctx.lineTo(X(x), Y(y) + 0.5); } last = Y(y) + 0.5; }
        if (started) { ctx.lineTo(X(g.r), last); ctx.stroke(); }
      };
      if (!words && o.dva && p.dev_vah.length) { step(p.dev_vah, 1, o.dvaC); step(p.dev_val, 0, o.dvaC); }
      if (!words && o.dpoc && p.dev_poc.length) step(p.dev_poc, 0.5, o.dpocC);
      const line = (on, price, color, width, name) => {
        if (!on) return; const y = A.yOf(price); if (y == null) return;
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, Math.round(width * vr)); const yy = Y(y) + (ctx.lineWidth % 2 ? 0.5 : 0);
        if (!words) { ctx.beginPath(); ctx.moveTo(X(g.l), yy); ctx.lineTo(X(g.r), yy); ctx.stroke(); }
        if (words && o.labels) { ctx.font = `600 ${Math.round(11 * vr)}px ${FONT()}`; ctx.textBaseline = "bottom"; ctx.textAlign = "right"; const text = `${name} ${A.num(price)}`, tw = ctx.measureText(text).width, th = Math.round(13 * vr);
          ctx.save(); ctx.globalAlpha *= 0.78; ctx.fillStyle = A.css("--surface"); ctx.fillRect(X(g.r - 4) - tw - Math.round(3 * hr), yy - th - Math.round(2 * vr), tw + Math.round(6 * hr), th); ctx.restore();  // a plate under the words, so they read over candles and rows
          ctx.fillStyle = color; ctx.fillText(text, X(g.r - 4), yy - Math.round(2 * vr)); }
      };
      line(o.vah, p.vah_price, o.vahC, 1, "VAH"); line(o.val, p.val_price, o.valC, 1, "VAL"); line(o.poc, p.poc_price, o.pocC, 2, "POC");
      if (words && p.no_volume) { ctx.font = `${Math.round(11 * vr)}px ${FONT()}`; ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.fillStyle = A.css("--muted"); ctx.fillText("No volume here: time at each price", X(g.l + 4), Y(g.top) + Math.round(3 * vr)); }
      ctx.restore();
    }
    function paintBottom(scope) { for (const it of st.items) if (visible(it)) paintOne(scope, it, false); if (st.placing && st.placing.p) paintOne(scope, st.placing, true); }
    function paintTop(scope) {  // the levels' words; the picked profile's outline and handles; the first point of a profile being placed
      for (const d of st.items) if (visible(d)) paintOne(scope, d, false, true); if (st.placing && st.placing.p) paintOne(scope, st.placing, true, true);
      const ctx = scope.context, hr = scope.horizontalPixelRatio, vr = scope.verticalPixelRatio, dot = (x, y, color) => { ctx.beginPath(); ctx.arc(x * hr, y * vr, 5 * hr, 0, Math.PI * 2); ctx.fillStyle = A.css("--surface"); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, Math.round(2 * vr)); ctx.stroke(); };
      const it = st.picked, g = it && visible(it) ? geom(it) : null;
      if (g) { ctx.save(); ctx.strokeStyle = g.o.boxC; ctx.lineWidth = Math.max(1, Math.round(vr)); if (it.locked) ctx.setLineDash([4 * hr, 3 * hr]);
        ctx.strokeRect(Math.round(g.l * hr) + 0.5, Math.round(g.top * vr) + 0.5, Math.round((g.r - g.l) * hr), Math.round((g.bottom - g.top) * vr)); ctx.setLineDash([]);
        if (!it.locked) for (const [hx] of g.handles) dot(hx, g.mid, g.o.boxC); ctx.restore(); }
      const pl = st.placing;
      if (pl) { const x = A.xOf(pl.t1 / 1000), h = scope.mediaSize.height; if (x != null) { ctx.save(); ctx.strokeStyle = DEFAULTS.boxC; ctx.lineWidth = Math.max(1, Math.round(vr)); ctx.setLineDash([4 * hr, 3 * hr]); ctx.beginPath(); ctx.moveTo(Math.round(x * hr) + 0.5, 0); ctx.lineTo(Math.round(x * hr) + 0.5, h * vr); ctx.stroke(); ctx.restore(); } }
      barAt = g; if (!barTick) barTick = requestAnimationFrame(() => { barTick = 0; placeBar(); });
    }
    const view = (z, fn) => ({ zOrder: () => z, renderer: () => ({ draw: (target) => target.useBitmapCoordinateSpace(fn) }) });
    const prim = { attached(p) { this.requestUpdate = p.requestUpdate; }, detached() { this.requestUpdate = null; }, updateAllViews() {}, views: [view("bottom", paintBottom), view("top", paintTop)], paneViews() { return this.views; } };
    A.series.attachPrimitive(prim);
    const redraw = () => prim.requestUpdate && prim.requestUpdate();

    // ---------------------------------------------------------------- the styles, the two buttons, the small bar, the settings box
    const ICON = {
      frvp: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 3v14M16.5 3v14" stroke-dasharray="2 2"/><path d="M6 6h4M6 9h7.5M6 12h5.5M6 15h2.5" stroke-width="2"/></svg>',
      avp: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="4" cy="10" r="1.8"/><path d="M4 3v5M4 12v5" stroke-dasharray="2 2"/><path d="M8 6h4M8 9h8M8 12h6M8 15h3" stroke-width="2"/></svg>',
      gear: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6"/></svg>',
      lock: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="9" width="10" height="7.5" rx="1.5"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>',
      unlock: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="9" width="10" height="7.5" rx="1.5"/><path d="M7 9V6.5a3 3 0 0 1 5.6-1.5"/></svg>',
      hide: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5z"/><circle cx="10" cy="10" r="2.2"/><path d="M4 16L16 4"/></svg>',
      show: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5z"/><circle cx="10" cy="10" r="2.2"/></svg>',
      bin: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/></svg>',
    };
    const style = document.createElement("style");
    style.textContent = `
      #vpt-unhide[hidden] { display: none; }
      #vpt-bar { position: absolute; z-index: 5; display: none; gap: 2px; padding: 3px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.18); }
      #vpt-bar button, #vpt-dlg .x { width: 32px; height: 32px; display: grid; place-items: center; background: transparent; border: 0; border-radius: 6px; color: var(--ink-2); cursor: pointer; padding: 0; }
      #vpt-bar button:hover, #vpt-dlg .x:hover { background: var(--hover); } #vpt-bar button[aria-pressed="true"] { color: var(--accent); }
      #vpt-bar svg, #vpt-dlg .x svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
      #vpt-shade { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.35); display: grid; place-items: center; }
      #vpt-dlg { width: min(430px, 94vw); max-height: min(640px, 92vh); display: flex; flex-direction: column; background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,.35); font-size: 14px; }
      #vpt-dlg header, #vpt-dlg .tabs, #vpt-dlg footer { flex: none; }
      #vpt-dlg header { display: flex; align-items: center; gap: 8px; padding: 12px 10px 8px 16px; } #vpt-dlg h2 { flex: 1; margin: 0; font-size: 17px; font-weight: 600; }
      #vpt-dlg .tabs { display: flex; gap: 2px; padding: 0 10px; border-bottom: 1px solid var(--border); overflow-x: auto; }
      #vpt-dlg .tabs button { background: none; border: 0; border-bottom: 2px solid transparent; padding: 8px 10px; font: inherit; color: var(--ink-2); cursor: pointer; white-space: nowrap; }
      #vpt-dlg .tabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--accent); font-weight: 600; }
      #vpt-dlg .body { padding: 10px 16px; overflow-y: auto; flex: 1; min-height: 180px; }
      #vpt-dlg .row { display: flex; align-items: center; gap: 10px; min-height: 40px; } #vpt-dlg .row > .n { flex: 1; min-width: 0; }
      #vpt-dlg .row label.n { display: flex; align-items: center; gap: 8px; cursor: pointer; }
      #vpt-dlg input[type="number"], #vpt-dlg select, #vpt-dlg input[type="datetime-local"] { font: inherit; color: var(--ink); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; min-height: 32px; }
      #vpt-dlg input[type="number"] { width: 92px; } #vpt-dlg input.a { width: 64px; } #vpt-dlg select { min-width: 150px; }
      #vpt-dlg input[type="color"] { width: 36px; height: 30px; padding: 0; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); cursor: pointer; }
      #vpt-dlg input[type="checkbox"] { width: 17px; height: 17px; accent-color: var(--accent); }
      #vpt-dlg .pct { color: var(--muted); font-size: 12px; margin-left: -6px; } #vpt-dlg .hint { color: var(--muted); font-size: 12px; line-height: 1.45; margin: 6px 0 2px; }
      #vpt-dlg footer { display: flex; gap: 8px; padding: 10px 16px 14px; border-top: 1px solid var(--border); } #vpt-dlg footer .grow { flex: 1; }
      #vpt-dlg footer button { font: inherit; min-height: 34px; padding: 0 16px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); cursor: pointer; }
      #vpt-dlg footer button.ok { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
      @media (max-width: 480px) { #vpt-dlg select { min-width: 120px; } #vpt-dlg .row { gap: 6px; } }`;
    document.head.appendChild(style);

    // the two tool buttons, in the page's drawing bar after its own tools; and one that brings hidden profiles back
    const tools = {};
    { const after = A.toolbar.querySelector('button[data-tool="text"]');
      for (const [kind, words] of [["avp", "tap the candle it starts from"], ["frvp", "tap the first candle and the last candle"]]) { const b = document.createElement("button"); b.type = "button"; b.dataset.tool = kind; b.setAttribute("aria-pressed", "false"); b.title = `${TITLE[kind]}: ${words}`; b.setAttribute("aria-label", TITLE[kind]); b.innerHTML = ICON[kind]; after.after(b); tools[kind] = b; }
      const u = document.createElement("button"); u.type = "button"; u.id = "vpt-unhide"; u.hidden = true; u.innerHTML = ICON.show; A.toolbar.appendChild(u); tools.unhide = u;
      u.addEventListener("click", (e) => { e.stopPropagation(); for (const it of st.items) it.hidden = false; save(); redraw(); }); }

    const barEl = document.createElement("div"); barEl.id = "vpt-bar"; barEl.setAttribute("role", "toolbar"); barEl.setAttribute("aria-label", "Volume profile");
    A.wrap.appendChild(barEl); let barAt = null, barTick = 0;
    function bar() {
      const it = st.picked, hidden = st.items.filter(d => d.hidden).length;
      tools.unhide.hidden = !hidden; tools.unhide.title = `Show the hidden volume profiles (${hidden})`; tools.unhide.setAttribute("aria-label", tools.unhide.title);
      if (!it || !visible(it) || st.drag || st.dialog) { barEl.style.display = "none"; return; }
      barEl.innerHTML = `<button type="button" data-do="settings" title="Settings" aria-label="Settings">${ICON.gear}</button><button type="button" data-do="lock" aria-pressed="${it.locked}" title="${it.locked ? "Unlock" : "Lock"}" aria-label="${it.locked ? "Unlock" : "Lock"}">${it.locked ? ICON.lock : ICON.unlock}</button><button type="button" data-do="hide" title="Hide" aria-label="Hide">${ICON.hide}</button><button type="button" data-do="delete" title="Delete" aria-label="Delete">${ICON.bin}</button>`;
      barEl.style.display = "flex"; placeBar();
    }
    function placeBar() {  // over the picked profile's box; under it when there is no room above
      if (barEl.style.display === "none") return; const g = barAt || (st.picked && geom(st.picked)); if (!g) { barEl.style.display = "none"; return; }
      const w = barEl.offsetWidth, h = barEl.offsetHeight, W = A.wrap.clientWidth, H = A.wrap.clientHeight;
      let x = (Math.max(0, g.l) + Math.min(W - 60, g.r)) / 2 - w / 2, y = g.top - h - 10; if (y < 4) y = Math.min(H - h - 34, g.bottom + 10); if (y < 4) y = 4;
      barEl.style.left = Math.max(4, Math.min(W - w - 64, x)) + "px"; barEl.style.top = y + "px";
    }
    for (const type of ["pointerdown", "pointerup", "click", "dblclick"]) barEl.addEventListener(type, (e) => e.stopPropagation());
    barEl.addEventListener("click", (e) => { const b = e.target.closest("button"), it = st.picked; if (!b || !it) return;
      if (b.dataset.do === "settings") openSettings(it);
      else if (b.dataset.do === "lock") { it.locked = !it.locked; save(); redraw(); }
      else if (b.dataset.do === "hide") { it.hidden = true; st.picked = null; save(); redraw(); }
      else if (b.dataset.do === "delete") deleteSelected(); });

    // the settings box: Inputs, Style, Coordinates, Visibility (the document, section 3). Every change shows at once; Cancel puts
    // the profile back as it was, Defaults puts every setting back to the list's default.
    const toLocal = (ms) => new Date(ms + A.IST * 1000).toISOString().slice(0, 16), fromLocal = (text) => { const ms = Date.parse(text + (text.length === 16 ? ":00" : "") + "Z"); return isFinite(ms) ? ms - A.IST * 1000 : null; };
    function openSettings(it) {
      closeSettings(false);
      const was = JSON.stringify({ s: it.s, t1: it.t1, t2: it.t2 }), fixed = it.kind === "frvp", esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      const shade = document.createElement("div"); shade.id = "vpt-shade";
      const check = (k, name) => `<div class="row"><label class="n"><input type="checkbox" data-k="${k}"> ${name}</label></div>`;
      const colour = (name, c, a, on) => `<div class="row">${on ? `<label class="n"><input type="checkbox" data-k="${on}"> ${name}</label>` : `<span class="n">${name}</span>`}<input type="color" data-k="${c}" aria-label="${name}: colour">${a ? `<input type="number" class="a" data-k="${a}" min="0" max="100" step="1" aria-label="${name}: opacity, percent"><span class="pct">%</span>` : ""}</div>`;
      shade.innerHTML = `<div id="vpt-dlg" role="dialog" aria-modal="true" aria-label="${esc(TITLE[it.kind])}">
        <header><h2>${esc(TITLE[it.kind])}</h2><button type="button" class="x" data-do="cancel" aria-label="Close"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg></button></header>
        <div class="tabs" role="tablist">${["Inputs", "Style", "Coordinates", "Visibility"].map((t, i) => `<button type="button" role="tab" data-tab="${i}" aria-selected="${i === 0}">${t}</button>`).join("")}</div>
        <div class="body">
          <section data-pane="0">
            <div class="row"><span class="n">Rows layout</span><select data-k="layout"><option value="rows">Number of rows</option><option value="ticks">Ticks per row</option></select></div>
            <div class="row"><span class="n">Row size</span><input type="number" data-k="size" min="1" max="2000" step="1"></div>
            <div class="row"><span class="n">Volume</span><select data-k="vol"><option value="updown">Up/Down</option><option value="total">Total</option><option value="delta">Delta</option></select></div>
            <div class="row"><span class="n">Value area volume</span><input type="number" data-k="va" min="1" max="100" step="1"><span class="pct">%</span></div>
            ${fixed ? check("extend", "Extend right") : ""}
            <p class="hint" data-hint></p>
          </section>
          <section data-pane="1" hidden>
            ${check("show", "Volume profile")}${check("values", "Values")}
            <div class="row"><span class="n">Width (% of the box)</span><input type="number" data-k="width" min="1" max="100" step="1"></div>
            <div class="row"><span class="n">Placement</span><select data-k="place"><option value="left">Left</option><option value="right">Right</option></select></div>
            ${colour("Up volume", "upC", "upA")}${colour("Down volume", "dnC", "dnA")}${colour("Value area up", "vaUpC", "vaUpA")}${colour("Value area down", "vaDnC", "vaDnA")}
            ${colour("VAH", "vahC", null, "vah")}${colour("VAL", "valC", null, "val")}${colour("POC", "pocC", null, "poc")}${colour("Developing POC", "dpocC", null, "dpoc")}${colour("Developing VA", "dvaC", null, "dva")}
            ${check("labels", "Level labels")}${colour("Histogram box", "boxC", "boxA", "box")}
          </section>
          <section data-pane="2" hidden>
            <div class="row"><span class="n">#1 (bar)</span><input type="datetime-local" data-t="t1" step="60"></div>
            ${fixed ? `<div class="row"><span class="n">#2 (bar)</span><input type="datetime-local" data-t="t2" step="60"></div>` : ""}
            <p class="hint">Indian time. A time between two candles moves inward to the nearest candle inside the range.${fixed ? "" : " The profile runs from this candle to the latest one."}</p>
          </section>
          <section data-pane="3" hidden>
            ${Object.keys(TF).map(tf => `<div class="row"><label class="n"><input type="checkbox" data-tf="${tf}"> ${TF_NAMES[tf]}</label></div>`).join("")}
            <p class="hint">The profile is drawn only on the candle sizes ticked here.</p>
          </section>
        </div>
        <footer><button type="button" data-do="defaults">Defaults</button><span class="grow"></span><button type="button" data-do="cancel">Cancel</button><button type="button" class="ok" data-do="ok">Ok</button></footer></div>`;
      document.body.appendChild(shade); st.dialog = { shade, it, was }; bar();
      const q = (sel) => [...shade.querySelectorAll(sel)], limits = { size: [1, 2000], va: [1, 100], width: [1, 100], upA: [0, 100], dnA: [0, 100], vaUpA: [0, 100], vaDnA: [0, 100], boxA: [0, 100] };
      const fill = () => { const o = withDefaults(it.s);
        for (const el of q("[data-k]")) { const k = el.dataset.k; if (el.type === "checkbox") el.checked = !!o[k]; else el.value = o[k]; }
        for (const el of q("[data-t]")) el.value = toLocal(it[el.dataset.t]);
        for (const el of q("[data-tf]")) el.checked = !o.hideTf[el.dataset.tf];
        const p = it.p, hint = shade.querySelector("[data-hint]");
        hint.textContent = !p ? "No candle of the chart is inside this range now." : `Now: ${p.rows} rows of ${A.num(p.row_height)} points (${Math.round(p.ticks_per_row * 100) / 100} ticks of ${tick()})` + (p.no_volume ? ". There is no volume in this range: the rows show the time spent at each price." : `, counted from ${it.lowUsed ? "1-minute" : TF_NAMES[A.interval()]} candles with the futures' volume.`); };
      const apply = () => { count(it, false); fill(); redraw(); };
      it.lowUsed = A.interval() !== "1m" && !!F; fill();
      shade.addEventListener("input", (e) => { const el = e.target, o = withDefaults(it.s);
        if (el.dataset.k) { const k = el.dataset.k; if (el.type === "checkbox") o[k] = el.checked; else if (el.type === "number") { const v = parseFloat(el.value); if (!isFinite(v)) return; const [a, z] = limits[k] || [-Infinity, Infinity]; o[k] = clamp(k === "size" || k === "va" || k === "width" ? v : Math.round(v), a, z); } else o[k] = el.value; }
        else if (el.dataset.tf) { const h = Object.assign({}, o.hideTf); if (el.checked) delete h[el.dataset.tf]; else h[el.dataset.tf] = 1; o.hideTf = h; }
        else if (el.dataset.t) { const ms = fromLocal(el.value); if (ms == null) return; it[el.dataset.t] = ms; }
        else return;
        it.s = diff(o); count(it, false); redraw();
        const p = it.p, hint = shade.querySelector("[data-hint]"); if (p) hint.textContent = `Now: ${p.rows} rows of ${A.num(p.row_height)} points (${Math.round(p.ticks_per_row * 100) / 100} ticks of ${tick()})` + (p.no_volume ? ". There is no volume in this range: the rows show the time spent at each price." : `, counted from ${it.lowUsed ? "1-minute" : TF_NAMES[A.interval()]} candles with the futures' volume.`); });
      shade.addEventListener("change", (e) => { if (e.target.type === "number" && e.target.dataset.k) fill(); });  // a figure outside its limits is shown as it was taken
      shade.addEventListener("click", (e) => { const b = e.target.closest("button"); if (e.target === shade) return closeSettings(false); if (!b) return;
        if (b.dataset.tab != null) { for (const t of q("[data-tab]")) t.setAttribute("aria-selected", String(t === b)); for (const s of q("[data-pane]")) s.hidden = s.dataset.pane !== b.dataset.tab; }
        else if (b.dataset.do === "defaults") { it.s = {}; apply(); }
        else if (b.dataset.do === "cancel") closeSettings(false); else if (b.dataset.do === "ok") closeSettings(true); });
      shade.querySelector("select").focus();
    }
    function closeSettings(keep) {
      const d = st.dialog; if (!d) return false; st.dialog = null; d.shade.remove();
      if (!keep) { const w = JSON.parse(d.was); d.it.s = w.s; d.it.t1 = w.t1; d.it.t2 = w.t2; count(d.it, false); } else if (d.it.kind === "frvp" && d.it.t2 < d.it.t1) { const x = d.it.t1; d.it.t1 = d.it.t2; d.it.t2 = x; }
      save(); redraw(); return true;
    }
    document.addEventListener("keydown", (e) => {  // while the settings box is open the keys are its own: Escape closes it, Delete deletes nothing behind it
      if (!st.dialog) return; if (e.key === "Escape") { e.stopPropagation(); closeSettings(false); } else if (e.key === "Delete" || e.key === "Backspace") e.stopPropagation(); }, true);

    // ---------------------------------------------------------------- the pointer
    A.chart.subscribeCrosshairMove((param) => { if (!st.placing) return; const at = A.pointAt(param); if (!at) return; const t = inData(at.time * 1000); if (t !== st.hover) { st.hover = t; preview(); redraw(); } });
    A.wrap.addEventListener("dblclick", (e) => { const r = A.wrap.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top); if (h) { st.picked = h.it; openSettings(h.it); } });
    // a tap with one of the two tools chosen: the first candle, then (fixed range) the last one
    function place(at, tool) {
      if (!TITLE[tool] || !at) return false;
      readBars(); const t = inData(at.time * 1000);
      if (tool === "frvp" && !st.placing) { st.placing = { kind: "frvp", t1: t, t2: t, s: {}, p: null }; st.hover = t; readBars(); preview(); redraw(); return true; }
      const it = { id: st.seq++, kind: tool, t1: tool === "frvp" ? Math.min(st.placing.t1, t) : t, t2: tool === "frvp" ? Math.max(st.placing.t1, t) : t, s: {}, locked: false, hidden: false };
      st.placing = null; st.items.push(it); st.picked = it; readBars(); count(it, false); A.setTool(""); save(); redraw(); return true;
    }
    const inData = (t) => B.length ? clamp(t, B[0].t, B[B.length - 1].t) : t;  // a point is set on a candle of the chart: a tap past the last candle means the last candle
    function toolChanged(tool) { if (st.placing && tool !== "frvp") { st.placing = null; redraw(); } if (tool && st.picked) { st.picked = null; bar(); redraw(); } }
    function select(at) { const h = at ? hit(at.x, at.y) : null, it = h ? h.it : null; if (it !== st.picked) { st.picked = it; bar(); redraw(); A.changed(); } return !!it; }
    function down(pt, e) {  // the pointer goes down on a profile: it may be carried (the body), or one end (a handle)
      const h = hit(pt.x, pt.y); if (!h || h.it.locked) return false;
      st.drag = { it: h.it, part: h.part, x: e.clientX, y: e.clientY, place: A.chart.timeScale().coordinateToLogical(pt.x), t1: h.it.t1, t2: h.it.t2, moved: false }; return true;
    }
    function move(e, x) {
      const g = st.drag; if (!g) return; if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) <= 8) return;
      const place = A.chart.timeScale().coordinateToLogical(x); if (place == null) return;
      if (!g.moved) { g.moved = true; st.picked = g.it; A.wrap.classList.add("moving"); bar(); }
      const it = g.it, ms = (p) => { const t = A.timeOf(p); return t == null ? null : t * 1000; }, shift = (t) => ms(A.placeOf(t / 1000) + Math.round(place - g.place));
      if (g.part === "all") { const a = shift(g.t1), b = shift(g.t2); if (a != null && b != null && inData(a) === a && inData(b) === b) { it.t1 = a; it.t2 = b; } }  // carried whole: it stops at the first and the last candle
      else { const t = ms(place); if (t != null) it[g.part === "a" ? "t1" : "t2"] = inData(t); }
      count(it, true); redraw();
    }
    function up() { const g = st.drag; if (!g) return false; st.drag = null; A.wrap.classList.remove("moving"); if (g.moved) { const it = g.it; if (it.kind === "frvp" && it.t2 < it.t1) { const x = it.t1; it.t1 = it.t2; it.t2 = x; } count(it, false); save(); redraw(); } bar(); return g.moved; }
    function deleteSelected() { const it = st.picked; if (st.placing) { st.placing = null; A.setTool(""); redraw(); return true; } if (!it) return false; st.items.splice(st.items.indexOf(it), 1); st.picked = null; save(); redraw(); return true; }
    function clear() { st.items = []; st.picked = null; st.placing = null; save(); redraw(); }
    function deleteLast() { if (!st.items.length) return false; const it = st.items.pop(); if (st.picked === it) st.picked = null; save(); redraw(); return true; }  // the bin with nothing picked: the last one made

    load();
    // calc.last and geom(i): the tool on this page and where its i-th profile stands, for the browser checks
    return calc.last = { load, refresh, redraw, place, select, down, move, up, toolChanged, deleteSelected, deleteLast, clear, geom: (i) => { const it = st.items[i], g = it && geom(it); return g && { l: g.l, r: g.r, top: g.top, bottom: g.bottom, mid: g.mid, pocY: g.pocY, handles: g.handles, rows: it.p.rows, poc: it.p.poc_price, vah: it.p.vah_price, val: it.p.val_price, volume: it.p.volume, noVolume: it.p.no_volume }; }, dragging: () => !!st.drag, count: () => st.items.length + (st.placing ? 1 : 0), picked: () => !!st.picked, state: st };
  }
  const api = Object.assign(calc, { attach: typeof attach === "function" ? attach : null });
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.VpTool = api;
})(typeof window !== "undefined" ? window : globalThis);
