# The lab: ideas replayed over the saved days

Research only. Nothing in this folder is loaded by any page, and nothing here changes what the
index page does. The rule the pages run lives in `static/rules.js`; the lab checks its own base
line against it on every run.

`node lab/replay.js` replays the owner's rule and every idea in the list over the finished days
in `data/sessions` (or a folder given as the first argument), for each index on 5- and 15-minute
candles, and prints them side by side: calls, won, lost, net points, points per call, calls that
ended at the day's end, the worst call, days up and the worst day.

`node lab/check.js` runs the checks that need no browser: the owner's rule on a hand-made day with
the calls worked out by hand, the candle facts, and the ideas under test. A research round runs it
before it proposes anything.

**Candles and their levels only** (the owner's rule, 6 and 7 October): the research, the research engine
and every round work on the saved candles, the Fibonacci levels built from them and the calls' index
points that follow from both. Never the option premiums: the premium columns of the calls CSV are
dropped when a CSV is read, and the `records/<date>.json` files on the `data` branch (the options
behind the calls) are never read by the research at all. They are information for the index page.

`findings.md` is the log of the rounds done by hand. The owner's instruction of 6 October: the
research also runs on its own, without waiting for a signal. A scheduled routine (a Claude session
started after each trading day's close) pulls the saved days from the `data` branch, runs the lab,
and posts the round as a comment on the repository's **Research log** issue: the scoreboard of P1,
P2 and P3 against the owner's rule, anything new tested with its numbers, and a proposal only when an
idea has earned one. A proposal becomes a pull request the owner merges or not; that merge is the
confirmation. The routine never touches the index page, and never opens a request for it.
The rule of the road (6 October): Claude may propose ideas from the saved candles; a proposal
goes to the owner with the numbers; nothing is built until the owner confirms; a confirmed idea
goes to the Study page first, as a switch scored against the owner's rule on every saved day, and
to the live index page only after about 20 saved days still show it ahead, and only when the
owner says so.
