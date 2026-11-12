"""Run: python -m unittest test_vp -v"""
import json, os, unittest
from profile import build_profile, update_naked_pocs
from vp_signal import find_signal, size_trade, open_type
CFG = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "vp_config.json")))
PREV = {"val": 100.0, "vah": 200.0, "poc": 150.0}


def bar(i, o, h, l, c, v=None):
    m = 9 * 60 + 15 + 5 * i
    d = {"hm": "%02d:%02d" % (m // 60, m % 60), "o": o, "h": h, "l": l, "c": c}
    if v: d["v"] = v
    return d


def flat(n, price, start=0):
    return [bar(start + i, price, price + 2, price - 2, price) for i in range(n)]


class T(unittest.TestCase):
    def test_profile_poc_and_value_area(self):
        c = [bar(i, 102, 104, 100, 102) for i in range(8)] + [bar(8, 102, 149, 100, 140)]
        p = build_profile(c, 5, 70)
        self.assertEqual(p["poc"], 102.5)
        self.assertTrue(p["val"] <= 102.5 <= p["vah"] and p["vah"] < 149)

    def test_volume_moves_the_poc(self):
        c = [bar(0, 100, 104, 100, 102, 10), bar(1, 100, 104, 100, 102, 10), bar(2, 200, 204, 200, 202, 500)]
        self.assertEqual(build_profile(c, 5)["poc"], 202.5)
        self.assertTrue(build_profile(c, 5)["uses_volume"])

    def test_open_type(self):
        self.assertEqual([open_type(x, PREV) for x in (250, 150, 50)], ["above", "inside", "below"])

    def test_rejection_at_high_gives_pe(self):
        c = flat(3, 185) + [bar(3, 185, 198, 184, 188)]
        s = find_signal(c, PREV, CFG)
        self.assertEqual((s["signal"], s["index_stop"], s["index_target"]), ("PE", 208, 150.0))

    def test_rejection_at_low_gives_ce(self):
        c = flat(3, 115) + [bar(3, 115, 118, 102, 114)]
        s = find_signal(c, PREV, CFG)
        self.assertEqual((s["signal"], s["index_stop"], s["index_target"]), ("CE", 92, 150.0))

    def test_acceptance_above_gives_ce(self):
        c = flat(3, 190) + [bar(3, 190, 215, 190, 212), bar(4, 212, 216, 208, 214)]
        s = find_signal(c, PREV, CFG)
        self.assertEqual((s["signal"], s["setup"], s["index_stop"], s["index_target"]), ("CE", "Acceptance above value", 190, 314.0))

    def test_acceptance_targets_naked_poc(self):
        c = flat(3, 190) + [bar(3, 190, 215, 190, 212), bar(4, 212, 216, 208, 214)]
        s = find_signal(c, PREV, CFG, [{"date": "x", "poc": 260.0, "age": 3}])
        self.assertEqual(s["index_target"], 260.0)

    def test_eighty_percent_rule(self):
        c = flat(6, 215) + flat(6, 185, 6) + flat(6, 184, 12)       # open above, then two half-hours inside
        s = find_signal(c, PREV, CFG)
        self.assertEqual((s["signal"], s["setup"], s["index_target"], s["candle"]), ("PE", "80% rule", 100.0, "10:40"))

    def test_wait_in_the_middle(self):
        self.assertEqual(find_signal(flat(30, 150), PREV, CFG)["signal"], "WAIT")

    def test_poor_reward_is_skipped(self):
        c = flat(3, 155) + [bar(3, 155, 198, 150, 152)]              # rejection, but POC is only 2 points away
        s = find_signal(c, PREV, CFG)
        self.assertEqual(s["signal"], "WAIT"); self.assertTrue(s["skipped"])

    def test_naked_poc_list(self):
        n = update_naked_pocs([{"date": "a", "poc": 500.0, "age": 0}, {"date": "b", "poc": 101.0, "age": 0}],
                              "c", flat(5, 100), {"poc": 100.0})
        self.assertEqual([p["date"] for p in n], ["a", "c"])

    def test_sizing(self):
        s = size_trade(100, 40, 75, CFG)        # 0.5 x 40 x 75 = 1500 per lot
        self.assertEqual((s["lots"], s["approx_loss_at_stop_inr"], s["approx_option_price_at_stop"]), (1, 1500.0, 80.0))
        with self.assertRaises(ValueError):
            size_trade(100, 40, 0, CFG)


if __name__ == "__main__":
    unittest.main()
