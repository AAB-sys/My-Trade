"""vp_signal.py - turn yesterday's profile and today's candles into CE, PE or WAIT."""
import math


def _mins(hm):
    h, m = hm.split(":")
    return int(h) * 60 + int(m)


def open_type(open_price, prof):
    if open_price > prof["vah"]:
        return "above"
    if open_price < prof["val"]:
        return "below"
    return "inside"


def find_signal(candles, prev, cfg, naked=()):
    """candles = today's FINISHED 5-minute candles. prev = yesterday's profile.
    naked = list from update_naked_pocs (yesterday's POC excluded or included, both fine).
    Returns the first valid setup of the day, or WAIT with the reason."""
    val, vah, poc = prev["val"], prev["vah"], prev["poc"]
    tol, buf = cfg["edge_tolerance_pts"], cfg["stop_buffer_pts"]
    start, end = _mins(cfg["no_entry_before"]), _mins(cfg["no_entry_after"])
    opened = open_type(candles[0]["o"], prev)
    inside_30 = 0      # consecutive 30-minute closes inside the value area (for the 80% rule)
    outside_run = 0    # consecutive 5-minute closes outside the value area (+ above, - below)
    skipped = []
    for k, b in enumerate(candles):
        t = _mins(b["hm"])
        price = b["c"]
        ends_half_hour = (t - _mins("09:15") + 5) % 30 == 0
        if opened != "inside" and ends_half_hour:
            inside_30 = inside_30 + 1 if val <= price <= vah else 0
        side_now = 1 if price > vah else -1 if price < val else 0
        outside_run = outside_run + side_now if side_now and outside_run * side_now >= 0 else side_now
        if t + 5 < start or t + 5 > end:        # a candle that starts 09:25 closes at 09:30
            continue
        prev_close = candles[k - 1]["c"] if k else b["o"]
        was_inside = val <= prev_close <= vah
        setup = None
        if opened != "inside" and ends_half_hour and inside_30 == 2:
            side = "PE" if opened == "above" else "CE"
            setup = ("80% rule", side, vah + buf if side == "PE" else val - buf, val if side == "PE" else vah,
                     "Opened %s value, then two 30-minute closes back inside" % opened)
        elif was_inside and b["h"] >= vah - tol and price < vah and price <= (b["h"] + b["l"]) / 2:
            setup = ("Rejection at value-area high", "PE", b["h"] + buf, poc, "Tested the value-area high and closed back below it")
        elif was_inside and b["l"] <= val + tol and price > val and price >= (b["h"] + b["l"]) / 2:
            setup = ("Rejection at value-area low", "CE", b["l"] - buf, poc, "Tested the value-area low and closed back above it")
        elif abs(outside_run) == cfg["acceptance_closes"]:
            up = outside_run > 0
            width = vah - val
            beyond = [p["poc"] for p in naked if (p["poc"] > price if up else p["poc"] < price)]
            target = (min(beyond) if up else max(beyond)) if beyond else price + (width if up else -width)
            setup = ("Acceptance %s value" % ("above" if up else "below"), "CE" if up else "PE",
                     vah - buf if up else val + buf, target,
                     "%d closes in a row outside the value area" % cfg["acceptance_closes"])
        if not setup:
            continue
        name, side, stop, target, why = setup
        risk = price - stop if side == "CE" else stop - price
        reward = target - price if side == "CE" else price - target
        if risk <= 0 or reward <= 0 or reward / risk < cfg["min_reward_to_risk"]:
            skipped.append("%s %s: reward-to-risk too small" % (b["hm"], name))
            continue
        return {"signal": side, "setup": name, "why": why, "candle": b["hm"], "index_price": price,
                "index_stop": round(stop, 2), "index_target": round(target, 2),
                "risk_pts": round(risk, 2), "reward_pts": round(reward, 2),
                "reward_to_risk": round(reward / risk, 2), "opened": opened, "skipped": skipped}
    return {"signal": "WAIT", "reason": "no valid setup yet", "opened": opened,
            "levels": {"val": val, "poc": poc, "vah": vah}, "skipped": skipped}


def size_trade(premium, risk_pts, lot_size, cfg):
    """Lots sized so that the index reaching its stop loses about max_loss_per_trade_inr.
    An at-the-money option moves roughly `assumed_delta` rupees per index point."""
    if lot_size <= 0:
        raise ValueError("lot_size must come from the exchange website")
    loss_per_lot = cfg["assumed_delta"] * risk_pts * lot_size
    by_loss = math.floor(cfg["max_loss_per_trade_inr"] / loss_per_lot)
    by_cash = math.floor(cfg["capital_inr"] * cfg["max_capital_per_trade_pct"] / 100 / (premium * lot_size))
    lots = max(0, min(by_loss, by_cash))
    return {"lots": lots, "quantity": lots * lot_size, "cost_inr": round(lots * premium * lot_size, 2),
            "approx_loss_at_stop_inr": round(lots * loss_per_lot, 2),
            "approx_option_price_at_stop": round(max(0.05, premium - cfg["assumed_delta"] * risk_pts), 2)}
