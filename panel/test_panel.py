"""Run: python -m unittest test_panel -v"""
import unittest
from panel_profile import build_profile, value_area
from panel_engine import (PanelEngine, load_config, five_minute_closes, acceptance, oi_lean, vwap,
                          analyse_shape, mins)

CFG = load_config()
PREV = {"vah": 25020.0, "poc": 24990.0, "val": 24960.0, "high": 25040.0, "low": 24940.0, "close": 25000.0}


def mk(rows, start="09:15"):
    """rows = [(o, h, l, c, v)] -> one 1-minute candle per row, from `start`."""
    t0 = mins(start)
    return [{"hm": "%02d:%02d" % ((t0 + i) // 60, (t0 + i) % 60), "o": o, "h": h, "l": l, "c": c, "v": v}
            for i, (o, h, l, c, v) in enumerate(rows)]


def mirror_rows(rows, m=50000.0):
    return [(m - o, m - l, m - h, m - c, v) for o, h, l, c, v in rows]


def mirror_prev(p, m=50000.0):
    return {"vah": m - p["val"], "poc": m - p["poc"], "val": m - p["vah"], "high": m - p["low"],
            "low": m - p["high"], "close": m - p["close"]}


def p_day():
    rows = []
    for i in range(10):                                   # fast rally 25000 -> 25100, light volume
        o = 25000 + 10 * i
        rows.append((o, o + 10, o, o + 10, 1000))
    for i in range(40):                                   # rotation 25080-25110, heavy two-way volume
        o, c = (25090, 25100) if i % 2 == 0 else (25100, 25090)
        rows.append((o, 25110, 25080, c, 3000))
    rows.append((25095, 25110, 25092, 25108, 3000))
    return rows


def run_engine(rows, prev=PREV, cfg=CFG, oi=None):
    eng = PanelEngine(cfg, prev, "2026-11-17", 1)
    candles = mk(rows)
    out = None
    for i in range(len(candles)):
        out = eng.update(candles[:i + 1], oi_now=oi(i) if oi else None)
    return eng, out


class Profile(unittest.TestCase):
    def test_value_area_tie_adds_both_sides(self):
        self.assertEqual(value_area([1, 1, 5, 1, 1], 2, 70, 2), (0, 4))

    def test_value_area_one_row_step(self):
        self.assertEqual(value_area([1, 2, 6, 3, 1], 2, 70, 1), (1, 3))   # 6, +3 (above), +2 (below)

    def test_poc_tie_goes_to_middle_then_lower(self):
        c = mk([(100, 101, 100, 101, 10), (110, 111, 110, 111, 10)])
        p = build_profile(c, rows=4)
        self.assertEqual(p["poc_i"], 0)

    def test_up_down_split(self):
        c = mk([(100, 104, 100, 104, 100), (104, 104, 100, 100, 300)])
        p = build_profile(c, rows=4)
        self.assertAlmostEqual(sum(p["up"]), 100)
        self.assertAlmostEqual(sum(p["dn"]), 300)

    def test_time_mode_without_volume(self):
        c = mk([(100, 104, 100, 104, None), (104, 104, 100, 100, 0)])
        self.assertEqual(build_profile(c, rows=4)["mode"], "time")

    def test_fixed_rows_align_to_row_size(self):
        p = build_profile(mk([(25003, 25012, 25001, 25010, 50)]), row_size=5)
        self.assertEqual((p["base"], p["n"]), (25000, 3))


class Blocks(unittest.TestCase):
    def test_five_minute_closes_one_minute_candles(self):
        c = mk([(1, 1, 1, float(i), 1) for i in range(12)])
        self.assertEqual(five_minute_closes(c, 1), [(0, 4.0), (1, 9.0)])

    def test_five_minute_closes_missing_candle(self):
        c = mk([(1, 1, 1, float(i), 1) for i in range(12)])
        del c[4]                                           # 09:19 missing
        self.assertEqual(five_minute_closes(c, 1)[0], (0, 3.0))

    def test_five_minute_closes_five_minute_candles(self):
        c = [{"hm": hm, "o": 1, "h": 1, "l": 1, "c": x, "v": 1} for hm, x in (("09:15", 5.0), ("09:20", 6.0))]
        self.assertEqual(five_minute_closes(c, 5), [(0, 5.0), (1, 6.0)])

    def test_acceptance_states(self):
        self.assertEqual(acceptance([(0, 25030), (1, 25031)], PREV, CFG)["state"], "accepted_above")
        self.assertEqual(acceptance([(0, 25000), (1, 25031)], PREV, CFG)["state"], "testing_above")
        self.assertEqual(acceptance([(0, 24950), (1, 24940)], PREV, CFG)["state"], "accepted_below")
        self.assertEqual(acceptance([(0, 25000)], PREV, CFG)["state"], "inside")

    def test_vwap(self):
        c = mk([(10, 12, 8, 10, 1), (20, 22, 18, 20, 3)])
        self.assertAlmostEqual(vwap(c), (10 * 1 + 20 * 3) / 4.0)

    def test_oi_lean(self):
        self.assertEqual(oi_lean(100, 101, 1000, 1010, CFG)["lean"], "new_buying")
        self.assertEqual(oi_lean(100, 101, 1000, 990, CFG)["lean"], "short_covering")
        self.assertEqual(oi_lean(100, 99, 1000, 1010, CFG)["lean"], "new_selling")
        self.assertEqual(oi_lean(100, 99, 1000, 990, CFG)["lean"], "long_liquidation")
        self.assertEqual(oi_lean(100, 100.05, 1000, 1010, CFG)["lean"], "none")
        self.assertIsNone(oi_lean(100, 101, None, 1010, CFG))


class Shapes(unittest.TestCase):
    def test_too_early(self):
        _, out = run_engine(p_day()[:10])
        self.assertEqual((out["shape"]["shown"], out["label"]), ("too_early", "Too early to read"))
        self.assertTrue(out["status_line"].startswith("Too early to read"))

    def test_p_day_is_bullish(self):
        _, out = run_engine(p_day())
        self.assertEqual(out["shape"]["shown"], "P")
        self.assertEqual(out["shape"]["status"], "forming")
        self.assertEqual(out["acceptance"]["state"], "accepted_above")
        self.assertEqual(out["label"], "Bullish structure")
        self.assertIn("P-shape (forming)", out["status_line"])
        self.assertTrue(any(z["name"] == "Thin zone below" for z in out["zones"]))
        self.assertLessEqual(len(out["conditions"]), 4)
        self.assertIn("bottom of the bulge", out["conditions"][1]["if"])

    def test_b_day_is_mirror(self):
        _, out = run_engine(mirror_rows(p_day()), prev=mirror_prev(PREV))
        self.assertEqual(out["shape"]["shown"], "b")
        self.assertEqual(out["label"], "Bearish structure")

    def test_d_day(self):
        rows = []
        for i in range(90):
            k = i % 6
            lo, hi = [(24990, 25010), (24980, 25020), (24970, 25030), (24985, 25015), (24960, 25040), (24995, 25005)][k]
            o, c = (lo, hi) if i % 2 == 0 else (hi, lo)
            rows.append((o, hi, lo, c, 1000))
        _, out = run_engine(rows)
        self.assertEqual(out["shape"]["shown"], "D")
        self.assertEqual(out["acceptance"]["state"], "inside")
        self.assertIn(out["label"], ("Balanced", "Mixed: no clear side"))
        self.assertIn("today's value area", out["conditions"][0]["if"])

    def test_double_distribution(self):
        rows = []
        for i in range(30):
            o, c = (24990, 25010) if i % 2 == 0 else (25010, 24990)
            rows.append((o, 25015, 24985, c, 2000))
        for i in range(5):
            o = 25015 + 15 * i
            rows.append((o, o + 15, o, o + 15, 300))
        for i in range(30):
            o, c = (25095, 25110) if i % 2 == 0 else (25110, 25095)
            rows.append((o, 25120, 25090, c, 2000))
        _, out = run_engine(rows)
        self.assertEqual(out["shape"]["shown"], "double")
        d = out["shape"]["double"]
        self.assertEqual(d["price_side"], "upper")
        self.assertTrue(25015 <= d["gap_low"] < d["gap_high"] <= 25095)
        self.assertTrue(any("thin gap" in z["name"].lower() for z in out["zones"]))

    def test_trend_up(self):
        rows = []
        for i in range(60):                                  # narrow first hour
            o, c = (25005, 25025) if i % 2 == 0 else (25025, 25005)
            rows.append((o, 25030, 25000, c, 500))
        for i in range(100):                                 # steady climb with even volume
            o = 25030 + 2 * i
            rows.append((o, o + 3, o - 1, o + 2, 500))
        _, out = run_engine(rows)
        self.assertEqual(out["shape"]["shown"], "trend_up")
        self.assertIn("Trend up intact", out["conditions"][0]["then"])

    def test_failure_is_sticky(self):
        rows = p_day()
        eng, out = run_engine(rows)
        bl = out["shape"]["bulge_low"]
        candles = mk(rows)
        def push(closes):
            o = None
            for x in closes:
                t = mins(candles[-1]["hm"]) + 1
                candles.append({"hm": "%02d:%02d" % (t // 60, t % 60), "o": x, "h": x + 1, "l": x - 1, "c": x, "v": 50})
                o = eng.update(candles)
            return o
        out = push([25087] * 4 + [bl - 15] * 10)          # two 5-minute closes below the bulge
        self.assertTrue(out["shape"]["failing_shown"])
        self.assertIn("failing", out["status_line"])
        out = push([bl + 10] * 5)                          # one close back above: still failing
        self.assertTrue(out["shape"]["failing_shown"])
        out = push([bl + 10] * 5)                          # second close back above: cleared
        self.assertFalse(out["shape"]["failing_shown"])


class Panel(unittest.TestCase):
    def test_label_hysteresis(self):
        eng = PanelEngine(CFG, PREV, "2026-11-17", 1)
        sh = {"shown": "P"}
        seq = []
        for s in (3, 2, 2, 1, 2, 3):
            eng.shown_label = eng._label(s, sh)
            seq.append(eng.shown_label)
        self.assertEqual(seq, ["Bullish structure", "Bullish structure", "Bullish structure",
                               "Mixed: no clear side", "Leaning bullish", "Bullish structure"])

    def test_oi_check_scores(self):
        _, out = run_engine(p_day(), oi=lambda i: 1000000 * (1 + 0.0002 * i))
        oi = [c for c in out["checks"] if c["name"] == "Open interest"][0]
        self.assertEqual(oi["score"], 1)
        self.assertIn("new buying", oi["result"])

    def test_large_gap_flag(self):
        prev = dict(PREV, close=24800.0)
        _, out = run_engine(p_day(), prev=prev)
        self.assertTrue(any("Large gap" in f for f in out["flags"]))

    def test_expiry_and_event_flags(self):
        cfg = dict(CFG, expiry_dates=["2026-11-17"], event_dates=["2026-11-17"])
        _, out = run_engine(p_day(), cfg=cfg)
        self.assertTrue(any(f.startswith("Expiry day") for f in out["flags"]))
        self.assertTrue(any(f.startswith("Event day") for f in out["flags"]))

    def test_no_volume_flag_and_checks(self):
        rows = [(o, h, l, c, None) for o, h, l, c, v in p_day()]
        _, out = run_engine(rows)
        self.assertIsNone(out["vwap"])
        self.assertTrue(any("No volume" in f for f in out["flags"]))

    def test_alert_cooldown(self):
        eng = PanelEngine(CFG, PREV, "2026-11-17", 1)
        eng.last = {"shape": {"shown": "D", "failing_shown": False}, "label": "Balanced",
                    "acceptance": None, "closes5": []}
        eng.poc_hist = [(600, 25000.0)]
        out = {"shape": {"shown": "P", "failing_shown": False}, "label": "Balanced", "acceptance": None,
               "closes5": [], "time": "10:00", "zones": [], "vwap": None}
        a1 = eng._alerts(out, 600)
        eng.last = dict(eng.last, shape={"shown": "P", "failing_shown": False})
        out2 = dict(out, shape={"shown": "D", "failing_shown": False}, time="10:05")
        a2 = eng._alerts(out2, 605)
        self.assertEqual([a["type"] for a in a1], ["shape_changed"])
        self.assertEqual(a2, [])

    def test_output_has_every_section(self):
        _, out = run_engine(p_day())
        for k in ("status_line", "label", "score", "checks", "shape", "levels", "zones", "conditions",
                  "flags", "alerts", "warning"):
            self.assertIn(k, out)
        self.assertEqual(len(out["checks"]), 7)
        self.assertEqual([l["price"] for l in out["levels"]], sorted([l["price"] for l in out["levels"]], reverse=True))


if __name__ == "__main__":
    unittest.main()
