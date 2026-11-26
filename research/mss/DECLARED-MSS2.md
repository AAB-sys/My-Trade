# MSS-2, declared 26 Nov 2026 BEFORE any run (the owner: "Yes" to designing and testing it)
Same as MSS-1 (report "MSS strategy for AAA V1") except two things, the part that broke:
1. Reference swing R: the most recent CONFIRMED swing (size N) known at the candle's close, wherever it stands (before or after the sweep extreme X), not only one before X.
2. Break window: the first close past R and L within 12 candles of the reclaim candle C (was 6).
Unchanged: levels (PD high/low, opening range, aged day extreme), pierce + close back within 3 candles, dead if price trades beyond X, displacement (close with the move, range >= k x ATR, body >= 60%), one chance, break candle closes 09:45 to 14:30, entry next open, stop X -/+ 0.25 ATR, risk 0.75 to 2.5 ATR, target T x risk, 60-minute exit, 15:10 exit, one signal a pierce, each level once a day a side, one open trade, two signals a day, 4 points cost.
Variants: N {2,3} x k {1.0,1.5} x T {1.5,2.0} = 8 (with MSS-1's 8: 16 tried in all).
Choose on year 1 (11 Nov 2024 to 10 Nov 2025): >= 60 trades, average > 0 after 4 points, all 3 neighbours positive; the highest average of those. None: stop, year 2 stays closed.
Judge once on year 2 (11 Nov 2025 to 25 Nov 2026), five gates: >= 60 trades; average >= +3 after 4 points and > 0 after 5; profit factor >= 1.2; total positive without the best 5% of trades; better than 475 of 500 random-entry runs (same count a side, random candles in the window, same risk sizes, targets and exits).
