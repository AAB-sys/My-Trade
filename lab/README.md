# The lab: ideas replayed over the saved days

Research only. Nothing in this folder is loaded by any page, and nothing here changes what the
index page does. The rule the pages run lives in `static/rules.js`; the lab checks its own base
line against it on every run.

`node lab/replay.js` replays the owner's rule and every idea in the list over the finished days
in `data/sessions` (or a folder given as the first argument), for each index on 5- and 15-minute
candles, and prints them side by side: calls, won, lost, net points, points per call, calls that
ended at the day's end, the worst call, days up and the worst day.

`findings.md` is the log: each round, what was tested, the numbers, and what the owner decided.
The rule of the road (6 October): Claude may propose ideas from the saved candles; a proposal
goes to the owner with the numbers; nothing is built until the owner confirms; a confirmed idea
goes to the Study page first, as a switch scored against the owner's rule on every saved day, and
to the live index page only after about 20 saved days still show it ahead, and only when the
owner says so.
