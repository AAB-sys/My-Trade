# Volume Profile Signal Logic

The owner's document of 13 November 2026 ("Volume Profile Signal Logic, build document for the developer"), as code.
The five files here are the document's appendix, copied as written:

- `vp_config.json`: all settings (the document's section 5). One key was added for the server, `bin_size_by_index`:
  the row's height for each index of the dashboard (5 for NIFTY 50, 10 for NIFTY BANK and SENSEX, as the document says).
- `profile.py`: builds a session's profile; POC, VAH, VAL, HVN, LVN; the naked POC list.
- `vp_signal.py`: the four setups, the reward-to-risk check, the lot sizing.
- `vp_cli.py`: the commands on a CSV file of candles (`levels`, `signal`).
- `test_vp.py`: the document's 12 tests: `python -m unittest test_vp -v` from this folder.

The server reads these through `vpsignal.py` (one folder up) and serves the result at `/indices/{name}/vp-signal`;
the Volume Profile page shows it. `lab/check_vpsignal.py` checks the server against `vp_cli.py`, day by day.

The document's own words: this logic "does not predict the market and does not place trades"; in its two-year test on
NIFTY 50 "overall it did not make money"; "build it for paper trading and study first".
