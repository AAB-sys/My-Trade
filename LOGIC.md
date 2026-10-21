# My-Trade logic

The owner's own rules, written down in plain words and versioned with the code.
Nothing here comes from another product. Where a choice is still open it is marked
**(owner to decide)**; the page uses the smallest reasonable choice meanwhile, and
the owner can overrule it by saying so.

## Layer 1: Levels - built

A *move* is the distance between a low and a high. The levels sit part-way back
along that move, at fixed fractions of it:

    0%   23.6%   38.2%   50%   61.8%   78.6%   100%

0% is where the move ended, 100% is where it began. For a move that went **up**
(low first, then high) the fractions are measured **down from the high**; for a move
that went **down**, **up from the low**. So the 61.8% level of an up move from
22,000 to 23,000 is 23,000 - 0.618 x 1,000 = 22,382.

These fractions are the Fibonacci ratios: each is the limit of a Fibonacci number
divided by a later one (0.618 = 1/1.618, 0.382 = 0.618 squared, 0.236 = 0.618
cubed, 0.786 = the square root of 0.618; 50% is not a Fibonacci ratio but is kept
as the halfway mark). Traders watch these fractions as places a price may pause or
turn after a move. Whether that holds is for the owner's own record to show.

**Which move** - the Levels drop-down on the index page. Every visit starts on *Today so far* (the owner, 16 October: "it should be by default today"); until then the last choice was remembered per browser:

- *Previous day*: the low to the high of the trading day before the
  session being looked at. Only the day's open, high, low and close are known, so
  the day is taken as an up move when it closed above its open, else a down move
  **(owner to decide)**.
- *Previous close* (owner's decision, 15 October: "put the febonachi 7 lines
  starting from previous days closing point so that should be the 0% line always
  and you should calculate above it till 100 % level and from the same point below
  till the 100% level with the help of febonachib 7 levels calculation. And 0% from
  above should have + mark and 0 from below should have - mark"; the distance: "U
  have to calculate those levels. Dont tk any reference. Referenc is only for 0%
  level"; then "1.2% is fine. And it should be always fix"; then "make 100% is
  1.5% of that close"). 0% is the previous trading day's close. The only
  reference is that close, so the distance is a share of it: **100% is 1.5% of
  the close**, and each line is the Fibonacci share of that, above the close
  (named +23.6%, +38.2%, +50%, +61.8%, +78.6%, +100%) and below it (-23.6% to
  -100%): 13 lines. 15 October: 14 October closed at 22,622.70, so 100% is 339.34
  points; +23.6% is 22,702.78, +100% 22,962.04, -23.6% 22,542.62, -100%
  22,283.36. **They stay as they are, with one exception**
  (the owner, the same day: "redraw it only if candle crosses +100% line and make
  high above +100% then redraw the febonachi 7 lines again considering today's low
  as 0% line and today's high as +100% line. Same logic applies for -100% line
  crossed"): once a candle closes above the +100% line ("Crossed above", the
  owner's word for a close beyond a line), from the next candle the 7 lines run
  from today's low (0%) to today's high (+100%), the high that candle made
  included; each later close above that +100% line (a new high) draws them again
  the same way. A close below -100%: from today's high (0%) to today's low
  (-100%). And when the price turns (the owner: "redraw downward with today's
  high as 0%"): a close below the lowest line of lines drawn upward (their 0%, at
  today's low) draws them downward, 0% at today's high and -100% at today's low;
  a close above the highest line of lines drawn downward draws them upward. So a
  close beyond the outermost line always draws the 7 lines again on today's range.
  (With 1.5% no saved day turns; lab/check.js has a made-up day that does.)
  15 October: the 11:40 candle closed at 22,964.40, above +100% (22,962.04); from
  11:45 the lines ran from 22,637.40 (0%) to 22,972.45 (+100%), and each later
  close above the day's high drew them again. 8 October: the 13:15 candle closed
  at 22,243.65, below -100% (22,264.00); from 13:20 the lines ran from 22,599.05
  (0%) down to 22,243.30 (-100%). A call on these lines is the same rule as on the others (On the line,
  Crossed above, Crossed below, the target the next line, the same exits). On the
  chart all the lines are in view, + lines green, - lines red, 0% dark and
  thicker, each line's percentage in a column left of the chart, level with the
  line, as the prices are on the right. Once the lines have been
  drawn again, a short message under the chart, above the paper calls, says so
  (the owner: "put a small message below chart and above paper calls that
  febonachi levels redrawn and the reason for it"): when, upward or downward, the
  candle and its close, the line it closed beyond, how many times so far, and
  where 0% and 100% are now. A new choice on the
  index page; the other choices are unchanged.
- *Today so far* (default, owner's choice of 6 October): the session's own low to
  high so far, an up move when its last price is above its open **(owner to
  decide)**. Blank until it has traded. **Each candle is judged against the
  lines as they stood when it began** (owner's decision, 8 October afternoon):
  the day's range up to the candle before it (the day's first candle: its own).
  **The chart works the 7 lines out again at once from the live price whenever
  the price crosses the 0% or 100% line** (owner's decision, 8 October evening:
  "the Fibonacci levels should be recalculated when 0% and 100% are crossed,
  that is the whole crux"), and a call's target follows the lines the chart
  draws (item 5). The same on the index page, in the server's watcher and on the
  Study page. The reason: from the morning of 8
  October until then each candle was judged with its own high and low in the
  range, so every candle that made a new low "held" the 0% line it drew itself:
  18 of NIFTY 50's 23 calls that day were Buy CE at 0.0%, all the way down.
  **The seven lines only** (owner's decision, 8 October evening: "all the charts
  always work on the Fibonacci basic 7 levels only"). That afternoon an extra
  line had been drawn one step beyond each end (23.6% of the range below the low
  and above the high), so that a close below the day's earlier low gave a Buy PE
  aiming at it; it was taken off the same evening, so such a close is outward
  from the 0% line again and gives no call. On the seven saved days, 5-minute
  candles, both signals, the targets on the chart's lines: NIFTY 50 212 calls,
  net -730 (it was 263 calls, -945); NIFTY BANK 224 calls, +2,193 (it was 258,
  +3,128); on 8 October NIFTY 50 14 calls, 11 CE and 3 PE, -755 (it was 27, 12
  CE and 15 PE, -931).
  Before the morning of 8 October the page and the watcher judged every earlier
  candle against the lines of the moment, so each new high or low redrew the
  whole day's calls: NIFTY 50 showed 22 different calls through that morning and
  14 of them later vanished. A call, once given, stays as it was given; only its
  target follows the lines (item 5).
- *Bars shown*: the lowest low and highest high among the candles on the chart;
  whichever came first says which way the move went.
- *No levels*: hides them.

**Ratios**: the seven above **(owner to decide: add or remove)**.

**Which days** (15 October night, the owner's five under *Levels*: "today so far, previous day,
current week, previous week, All"): *Today so far* shows the latest day; *Previous day* the day
before it; *Current week* this week's days; *Previous week* last week's days (blank until the data
reaches back); *All* every day loaded (the last ten sessions). Every one of them draws the previous
close's lines above (the owner, 16 October: "rework it with the new lines in all five"): 0% at the
close before the first day shown, drawn again over the days shown by the same rule; the calls are the
latest day's of them. The *Session* drop-down below went with it.

**Which session** (until 15 October): today by default (the latest trading day among the candles
loaded, which are the last five days). The *Session* drop-down picks another of
those days, or all five on one chart, and the levels and the
calls all switch to that day, with that day's own previous day (owner's decision,
4 October: a past day must be judged with the levels it had then, not with
today's). With all five days on the chart the levels and the calls are the latest
day's.

**Which time frame**: the *Time frame* drop-down sets the size of one candle: 1, 5,
15 or 30 minutes, or 1 day. Since 15 October (the owner: "add more options in the dropdown of time frame
after 1 day: 1 week, 3 months, 6 months, 1 yr, 2yr, 3yr, 5yr") it goes on with how far back the
chart shows: *1 week* (15-minute candles, the five days on one chart), *3 months* and *6 months* (a
candle a day), *1 yr*, *2 yr*, *3 yr* and *5 yr* (a candle a week, Monday to Friday, built from the
day candles). Where the data does not reach back, the chart shows what there is and fills in as the
days pass. Everything below is judged on the candles of that size.
On day candles the chart holds the last three months, those days are one session
together (the "previous day" is the day before the last candle), and a call has no
day end: there a day is one candle, so a call runs on until its target.

**What the page does with them**: draws each level as a line across the chart with
its percentage on the price axis (the two ends solid, the rest dashed). Until 16
October it also showed one line of text beside the Levels drop-down: the move, its
direction, and how far the last price was from the nearest level; the owner took it
off ("remove it, red marked"). Nothing else yet.

## Layer 2: The evidence - built, its table taken off the page

What counts as a level **held** or **crossed**, judged candle by candle. Its own
table under the chart (held and crossed counts per level, and the held share) was
taken off the page on 6 October (owner's decision: not needed); the judgement
itself lives on inside layer 3, where it is the signal. Nothing is drawn on the
chart.

Judged for every closed candle (the one still forming is judged once it closes)
against where the previous candle closed:

- **Held**: the candle's high or low touched the level exactly, without going
  through it, and it closed back on the side it came from. The level acted as a
  floor or a ceiling. (Until 18 October a wick through the level counted as a hold
  too; it is a cross now, below.)
- **Crossed**: the candle closed on one side of the level with the price on the
  other side before that: the previous close, or the candle's own low or high (18
  October, the owner, of a candle that dipped below a line and closed above it:
  "this should also be considered as closed above"; "yes" to: a close above a line
  after the candle's own low went below it is Crossed above, the mirror is Crossed
  below, and On the line is left for an exact touch). Such a call is a held break
  like every Crossed call: held through its target, sold by a close back across
  its line, Rule 2's stop or the day end (the retouch exit never fires for it: the
  candle opened on the call's side), and ideas 8 and 5 apply to it. On the 12
  saved days 29 September to 15 October, NIFTY 50, 5-minute candles, Previous
  close lines: 61 calls, +582.67 → 31 calls, +645.25 (ahead on 5 days, behind on
  7; 15 October: six On the line calls, +158 → one Buy CE held by Rule 2, +230;
  13 October −165 → +225; 29 September +45 → −151).
  A close exactly on the level has not crossed it yet: the cross is judged
  from the last close off the level (9 October, NIFTY 50: the 13:35 candle closed
  at 22,509.35, the 78.6% line itself, and the 13:40 candle closed above it at
  22,526.15; judged from 13:35's close the break was missed and no Buy CE came; it
  now counts, judged from 13:30's close, 22,507.50 below). This is how the paper
  calls judge it; on the seven saved days no close sat exactly on a line, so no
  call there changes.

**A call given live stays given** (the owner, 9 October: "yes, fix it"). The
live page and the server's watcher judge a candle the moment it closes, from the
prices they have then; Dhan's final candle can differ by a few paise. At 13:40:05
on 9 October the NIFTY 50 page gave the 13:35 Buy CE (the price at the close was
just above the 78.6% line, 22,509.35) and recorded its option; Dhan's final 13:35
candle closed exactly on the line, and the call vanished from the table. Now a
call whose option is recorded (it entered, page or watcher) stays on the table
whatever the candle's final prices say: kept on its side, on the line nearest the
close that the candle reached, crossed when the price came from the other side
of it, held otherwise, and run by the rule from there like any call (its target,
X5 and Rule 2, the day end). A candle with no recorded call is judged as before;
the replays of saved days (the Study page, the research) have no records, so
nothing there changes.

A candle that never reaches a level does nothing at it. Nothing else is read into
the candle: not its colour, size or wicks.

**How to use it**: look at the held share over many days and many moves. A level
that holds most of the time is one to lean on; one that is crossed most of the
time is not a wall. This is the owner's own evidence for the signal rule.

**Owner decided** (2 October): all seven levels count; the signal is a hold or a
cross, chosen by a switch on the page; the trade goes the way the candle closed.
Still open **(owner to decide)**: whether a near miss counts (today "reaches" means
touching the level exactly) and whether the candle's colour or size matters. The
next candle does not confirm (owner's decision, 6 October; it did from 4 to 6
October).

## Layer 3: Paper calls - built

The rule above, run over the closed candles of the session picked, with that
session's levels. Each call (buy a CE, or buy a PE) is one row of the list, read
left to right, in the owner's format of 7 October evening: **Time** (9:15 AM, the signal candle; under it, since 21 October, *fired 9:25 AM*, the minute a later candle went past the signal candle's high or low, from the day's one-minute candles, else the entry candle: the owner, "i think call is getting fired 5 mins delayed"),
**Call (CE/PE)** with its contract, **Signal** (*Held* or *Crossed*, the level's
ratio and price), **Call Entry** (the strike number of the contract, the same
number as in the call; the index price at entry until the contract is known:
no Dhan, or no page open at the entry), **Call Target** (the next level in the
call's direction, on the lines as the chart draws them now, item 5; once the
call has ended, *target hit, sold* or *sold at day end* under it; an open bounce
call says *hold · sell at the target or at the day end* (12 October); a held break,
item 5, says *hold* or *target passed, continue* and what sells it, then how it
was sold), **Premium Paid ->
Now** (at exit once the call has ended; *SELL NOW* while the premium sits below
the sell mark, *sold at* once marked sold), **Candle status** (since 18 October the call's state in the owner's words: *Buy CE (Crossed above
0.0%)*, *Buy PE (Crossed below -23.6%)* or *Buy CE (On the line +23.6%)* when it fires, *Can be bought parallelly (...)* when a call
the same way is already held ("it will be my decision to buy it or not"), *Hold (Crossed above +23.6%)* naming the furthest line a
candle has closed beyond once Rule 2 runs, and *Take Exit* with the reason once it is sold; before that: the candle
verdict of item 7: HOLD or SELL with its reason on an open call; the owner's
plain words of 8 October night: buy, hold, continue, sell, where it said CARRY
and EXIT. On an open **bounce** call the candles' sell is only a warning (a
bounce call is sold at its target, the day end or the 35% premium rule), so it
reads **WATCH** while the last closed candle is still a quarter of the gap or
more on the wrong side of the line, and goes back to **HOLD** ("price is back
below the 78.6% level") when the price returns (owner's choice, 9 October). A closed call reads the same whatever closed it (owner, 9 October:
"if both the trades are closed then why the message format is different"):
Call Target "sold at <time>", Premium "<paid> -> <at sale>" with the real
change in words under it ("price rose 16% at sale", "price dropped 14% at
sale"; a sale by the premium rule "price dropped 38%, hence sold", its real
fall, not the rule's 35%: owner, 12 October, "35% is just an example"),
Candle status "SOLD" with the reason under it, every line named with its
percentage as the Signal column does (owner, 12 October: "target hit at 23.6% ·
54,875.81", "a candle closed below 23.6% · 55,095.46", "price came back to
54,859.70, below 23.6%", "premium dropped 38%", "day end"; a sale at a candle's close
names that candle and its close since 13 October, "the 10:45 AM candle closed at 22,524.25, above 61.8% ·
22,518.68": the owner had read "a candle closed above 61.8%" as the 10:30 candle, which closed below
it), green for a gain and red for a loss (the premium's
when the option is known, the index points otherwise: the owner, 12 October); off the table on 7
October evening, back on 8 October as the owner's exit signal, and in the day's
calls CSV all along). A finished row is greyed. A finished call that
no page saw enter reads "not seen at entry" in the premium cell: no page was
open at its entry, so no premium could be recorded then (7 October). A call
whose option was first recorded late (the server was restarting, or the rule
changed during the session and the call appeared afterwards) holds the price
when it was recorded, and its sell mark is 65% of that price; the cell no
longer says so (the owner, 9 October: the note "paid: the price at ..., not at
entry" taken off every row, "not required at all"). Since 13 October both take
their prices from the option's one-minute candles on Dhan when it has them
(see "A call seen late" under Exit by premium): the price of the entry minute,
and of the minute it was sold in. The header
row stays in view while the page scrolls (owner's ask, 7 October). The list is in time order, the newest call at the
top, open or finished alike (owner's ask, 7 October: an open call listed above a
later one read as if it had been given later). One line kept the score from 7 October (owner's
ask: the list must say what is happening and what action is needed) to 16 October, when the owner took it off the page
with the Download CSV button and the no-call notes ("remove all the red marked boxed things"). Paper only: nothing is
sent anywhere, and the list is worked out afresh from the candles every minute.

**Calls with Signals** (21 October, the owner: a third pill after Paper calls, "same index table which is present on Paper calls
page. But it will not have any rules applied on it ... I want to build alternate option or set of rules on the chart and fire the
calls based on these newly built rules. So this is just a start of it"): the same table, empty, for the set of rules still to
come. The Fibonacci rule below never writes to it. The same evening: no note over the table, its header row fixed while it
scrolls up, down, left and right (the OI chart's scroll box), and a Settings button whose popup lists the indicators, each
active or inactive, remembered on the browser; "only keep Fib Levels as of now, if i tick it it will draw fib levels
automatically on the chart as per the fib logic which we will develop asap": the tick is kept for that logic and draws nothing yet.
While the panel is open the chart is plain (the owner: "chart should be plain without any fib levels and without any rules on it"):
no lines, no tags, no redraw note; they come back with Paper calls or the OI chart. The Paper calls rule runs on underneath.
The new set of rules under Calls with Signals is described in `NEW_RULES.md`, apart from this document.

The rule, in the order it is applied:

1. **Signal** - a closed candle that **held** a level (the owner's words since 12
   October: "On the line"; since 18 October an exact touch only) or **crossed** one ("Crossed above" for a Buy CE,
   "Crossed below" for a Buy PE; since 18 October the candle's own wick through the line counts, layer 2). Both count: the Off / On the line / Crossed above-below / Both
   switch left the page on 16 October (the owner's ask), and so did the lone Both button later that day; Both is the setting. When
   one candle signals at several levels, the one nearest its close counts: one
   candle, one call **(owner to decide)**. **The candle's colour** (Change 5,
   21 October, from the 11:50 Buy CE off a red candle; the owner: "Yes, build
   rule A"): the signal candle must close in the call's direction, a Buy CE from
   a candle that closed above its open, a Buy PE from one that closed below; a
   red candle above a line or a green one below gives nothing, and the line
   stays free; a candle that closed where it opened gives either. On the 15
   saved days, 29 September to 21 October, 15 of 224 calls came from a candle
   of the wrong colour, 11 of them lost. A level that has given a call in a
   direction gives no more that way until the index has closed back across it
   (owner's decision, 4 October: no repeat calls while the index hovers at one
   level). The level is remembered by its price, not its name (8 October): with
   *Today so far* the 0% line follows each new low, so on 8 October NIFTY 50's
   first call at the day's low (09:20) blocked every later hold of a lower low,
   up to 186 points lower, and the price could never close back across a line
   that had moved, so the table went silent after 10:15. Now a line at a new
   price may call once more; a line that stays put still calls once. With the
   previous day's levels nothing changes, their lines never move. The day's
   first candle is judged too, from the previous day's close (18 October, the
   owner: "the 9.15 candle opened and closed above 0% line, wick went down of
   0% line"), on lines not built from the day's own range.
2. **The signal is set at once, the call fires on a later candle** - the signal
   the moment the signal candle closes, with no confirming candle (owner's
   decision, 6 October; from 4 to 6 October the next candle had to agree
   first); since 18 October the call fires when a later candle's price goes
   past the signal candle's high (a Buy CE) or low (a Buy PE), any later
   candle, tick by tick (the owner: "follow up candle opens above 9.15 candle
   close and crossed above the high of the 9.15 candle then it should fire buy
   CE call"; "above the 9:15 high"). The signal stays live until a candle
   closes back across its line, which cancels it (the owner's choice "B"); a
   signal no candle fires gives no row. Every signal gives its own call; while
   a call that way is held, the next one the same way is marked "Can be bought
   parallelly" (the owner: "it will be my decision to buy it or not, but the
   call which is on Hold already is in continuation"). Until 18 October the
   call came the moment the signal candle closed, and no new call came that
   way while one was held.
3. **Option** - always bought, never sold. The signal candle closed above the
   level: buy a CE, the index should rise. Below it: buy a PE, it should fall.
   For a hold that is the bounce away from the level; for a cross, the break
   through it.
4. **Entry** - since 18 October the price the call fired at: the signal
   candle's high (CE) or low (PE), or the firing candle's open when it opened
   already past it. The option's premium is recorded at that moment. Until 18
   October it was the open of the next candle, the first price after the signal
   candle closed, and the call was listed as "Enters at the next open" in the
   second or two before that candle began.
5. **Target** - the next level in the call's direction. The call ends when a
   later candle reaches it, at that level's price; the candle forming now counts
   too, tick by tick. **No stop** (owner's decision,
   5 October): a call that goes the wrong way is held, to the target or to the
   day's last candle, and its loss is whatever the day does. A signal pointing
   outward from the 0% or 100% level has no next level, so it gives no call;
   the seven lines only (owner's decision, 8 October evening, see Levels). On
   NIFTY 50, 5-minute candles, *Today so far*, a close past the day's high or
   low gives a call since 13 October: see "A call past the day's high or low"
   below.
   **Entry already past the target** (owner's decision, 7 October): when the
   next candle opens at or past the target, because the signal candle itself ran
   through the next level, the call aims one level further, at the first level
   beyond the entry price, and the list marks it "one level on". With no level
   left beyond the entry there is no call. Until 7 October such a call "hit" a
   target below its entry the moment it entered and lost at once (the 10:00
   call of 7 October: held 0.0% at 22,578, entered at 22,610.60, target 23.6% at
   22,605.32, −5.28). The research engine replays every saved day the same way.
   **The target follows the lines** (owner's decision, 8 October): at every
   candle the target is the next line beyond both the entry and the level that
   gave the call, in the call's direction, among the lines the chart draws
   during that candle (the day's range with that candle in it, worked out again
   when the price crosses 0% or 100%), and the call ends when the price reaches
   that line. A hit seen live stays a hit when the candle closes; its price can
   differ by a few points when the line moved on later in the same candle (on
   8 October, 4 of NIFTY 50's 5 live hits and 7 of NIFTY BANK's 32). With the previous day's levels the
   lines never move, so nothing changes there (the six saved days: all 432 day
   and setting combinations the same). With *Today so far* every new low or high
   moves the lines, and until then the target stayed where its line stood at
   the signal: on 8 October the 12:15 call showed 22,385.21 while the chart's
   23.6% line read 22,380.55. On the six saved days, *Today so far*, 5-minute
   candles, both signals: the same 450 calls, 381 won instead of 370, net
   +6,014 points instead of +7,344 (targets come closer as the lines move, so
   more are reached, each for fewer points).
   **A target the candle itself brought closer** (owner's yes, 12 October): when
   a candle's own new low (for a Buy CE; new high for a Buy PE) moves the lines
   and brings the target closer, the candle's high (low) may have come before
   that move. It then counts only against the target as it stood before the
   candle; the moved target counts on the candle's close (live: the price now),
   which came after. On 12 October NIFTY 50's 9:40 Buy CE (in at 22,513.25,
   target 22,542) went up to 22,523.90 in the 9:50 candle and then to a new low
   of 22,472.15, which pulled the 23.6% line to 22,514.38: the table sold it
   "at the target" with the index at 22,475 (premium −20%); the price reached
   22,514.38 at 9:56. On the nine saved days, *Today so far*, 5-minute candles,
   both signals: NIFTY 50 +31.54 → −266.44 (1 October's 12:15 CE, +10.18 →
   −78.35 at the day end; 8 October's 10:40 CE, +5.60 → −203.85; 12 October's
   9:40 CE sold at 9:55 instead of 9:50, +1.13 either way); NIFTY BANK +1,278.60
   → +1,277.72. The previous day's lines never move: nothing changes there.
   **No call against a fresh run** (idea 13; owner's yes, 12 October: "yes, do
   it"; NIFTY 50 only, 5-minute candles, both levels modes) - **removed on 18
   October** (the owner: "all three remove", with ideas 8 and 5 below; the
   research engine keeps it as a setting, off). As it ran: while NIFTY 50 is
   still making new lows of the day, no Buy CE; while it is still making new
   highs, no Buy PE. "Still": one of the last 6 candles up to the signal
   candle (30 minutes, the signal candle too) went below the day's low before
   it, and none went above the day's high (for a Buy PE the other way round).
   A call the same way as the fresh run still comes; a call given live stays;
   the signals given no call go into the result's `skipped` (listed under the table as "No call
   against a fresh run" until 16 October), and their lines stay free. Found from the saved days 29
   September to 9 October: NIFTY 50's calls against a fresh low or high made
   money on 5 of the 8 days but lost −790 on 8 October (Buy CE after Buy CE
   bounced into the fall); NIFTY BANK's made money on all 8 days, so NIFTY
   BANK and SENSEX stay as they are. NIFTY 50, today-so-far lines: the 8 days
   −165 → +488 (better on 4, worse on 4), 12 October −119.62 → +171.85;
   previous-day lines, the 9 days −226.68 → −96.39; 15-minute candles worse
   (+629 → +322), so 5-minute only. It also does the job of PR #125 (one
   bounce call at a time each way), closed for it. Its gain rests mostly on
   the falling days (8 and 12 October): the new days are its fair test.
   **A call past the day's high or low** (idea 24, "way 1"; owner's yes, 13
   October evening: "yes, build way 1"; NIFTY 50 only, 5-minute candles,
   *Today so far* lines). With *Today so far* the top line is the day's high
   so far and the bottom line its low, and no line lies beyond them, so while
   NIFTY 50 kept making new highs no Buy CE could come: on 13 October the day
   rose from 22,288.45 to 22,581.15 by 9:55, and the first Buy CE came at
   10:30, after the price had come back down to the 23.6% line. Now, when no
   line gives a signal, a candle that closes above the top line gives a Buy CE
   "Crossed above" it (0.0%, or 100.0% on a day down so far), and one that
   closes below the bottom line a Buy PE "Crossed below" it. There is no line
   beyond to aim at, so its Call Target reads "no line above" ("no line
   below") with "new high of the day · hold" until the lines move past its
   entry (the target follows the lines, as every call's). It is held and sold
   as every Crossed call is (A, B, Rule 2, the day end). It runs alongside the
   other calls: while it is held, the lines' own calls that way still come;
   since 18 October it comes beside a held call too (every signal gives its own
   call); until then, while a Crossed call of the lines was held, it did not
   come, nor a second one of its own. Example, 13 October: the 9:25 candle closed at 22,471.40,
   above the top line at 22,460.80; bought at the 9:30 open, 22,470.90, held
   to the day end, 22,721.95: +251.05. The ten saved days 29 September to 13
   October, NIFTY 50, 5-minute *Today so far*: +804 → +1,447 (better on 4 days,
   worse on 5; its own 10 calls: 4 won, together +764, 6 lost, together −121;
   all 10 came between 9:20 and 10:25); 15-minute +617 → +936; the other ways
   tried (only after two closes past the high, only before 10:15, only with a
   clear close past it, stopping the lines' calls while held, the previous
   day's lines until 10:00) are on the research page, box 24. The previous
   day's lines are left as they are. The days after 13 October are its fair
   test.
   **Fewer calls on the back-and-forth at one line** (ideas 5 and 8; owner's
   yes, 13 October evening: "yes, make the PR" for "build ideas 5 and 8 as a
   second PR"; NIFTY 50 only, 5-minute candles, both kinds of lines) -
   **removed on 18 October** (the owner: "all three remove"; the research engine
   keeps both as settings, off). As they ran: on 13
   October the price went back and forth across the 23.6% line (22,512.07)
   from 10:35 to 12:05; each close across it gave a Crossed call: 7 calls,
   all lost, −130.10 together. **Idea 8** (from the owner's three
   calculators, 11 October): a Crossed call only when its candle closes at
   least a quarter of the way from the line to the next line; a shallower
   close gives no call and leaves the line free. **Idea 5** (the owner's of
   11 October, "need to put rule on PE calls also so it will reduce the
   losses"): while a Crossed call is held, no Crossed call the other way
   either, and that line is then used that way. On-the-line calls and the
   call past the day's high or low (which has no next line) are left as they
   are by idea 8; idea 5 stops any Crossed call the other way. The signals
   they give no call go into `skipped`, as idea 13's (under the table until 16 October: "No call, the
   candle closed too near the line" and "No call while a call the other way
   is held"). 13 October, today-so-far lines: 10 calls, +395.20 → 5 calls,
   +509.40 (the 9:25 Buy CE past the day's high, and Buy CE On the line
   23.6% at 10:30, 10:50, 11:55 and 12:15, all to their target; the 12:10
   Buy CE Crossed above 23.6%, +205.05, closed only 3.68 past the line and
   is gone too). The ten saved days, NIFTY 50, 5-minute *Today so far*, with
   the call past the day's high or low: +1,447 → +1,567, 114 → 96 calls,
   better on 5 days, worse on 2 (29 September 10 → −40, 9 October 3 → −80;
   against the rule before both, +804 with 104 calls: better on 6, worse on
   3); previous-day lines +111 → +259 (35 calls instead of 51; better on 5,
   worse on 1);
   15-minute candles worse without the call past the high (+617 → +558), so
   5-minute only. Several Buy CE On the line can be open at once (13
   October: four at 23.6%).
   **Hold Through a Level Break** (owner's exit rule, 8 October night, 5-minute
   candles): a call given by a *crossed* signal (the candle C1 broke a line L)
   is not sold at its target. It is held, and the same trade continues while
   the price keeps going (until 18 October no new call came that way while it
   was held; since then every signal gives its own call, see item 2). It is sold:
   - **A, reclaim:** at the close of a candle that closes back across L (above
     it for a PE, below it for a CE), at that close;
   - **B, retouch:** when a later candle opens beyond the previous close (lower
     for a PE, higher for a CE) and then comes back to C1's open, at C1's open,
     tick by tick (only when C1 opened on the far side of L);
   - **C, end of day:** at the day end (item 6).
   - **The early exit** (the owner, 19 October, from the morning's 9:20 Buy PE,
     which Rule 2 sold at the 9:30 close, 23,100, after the index had been at
     22,975: "if the candle stays above the previous candle's close more than a
     2.5 minute and also crossed one previous level which is a double
     confirmation then it should fire Take exit call for previous Hold call"):
     inside a candle, judged on the day's one-minute candles, the same live and
     in a replay. The call ends at the close of the first minute by whose end
     (1) the last three minutes, more than 2.5, all stayed on the exit side of
     the close before the candle, every tick of them (a Buy PE: their lows above
     it; a Buy CE: their highs below it), and (2) that minute closed across the
     first line beyond that close on the exit side, one level back. A minute
     that touches the close before, or a missing minute, restarts the three. It
     comes before A and Rule 2, which wait for the candle's close; a retouch
     earlier in the same candle still comes first. The table says "sold at
     9:34 AM" (the minute's end) and "3 minutes above 22,975.00, the close
     before, and crossed above -38.2% · 23,013.52". On that morning the 9:20 Buy
     PE (in at 23,083) would have ended at 9:34 at 23,020, +63, instead of
     23,100 at the 9:30 close, -17. The page fetches today's one-minute candles
     once a minute and takes the minute closing now from the ticks, the watcher
     reads them from Dhan with the ticks, the replays and the checks use the
     saved days' minutes. The 12 saved days, Previous close lines, 5-minute
     candles: the same 163 calls, net +971 → +970, 41 → 54 won, worst day −313
     → −89 (7 October −313 → +55, 29 September −250 → +34), but the long runs
     are cut too (8 October +434 → −0.50, 12 October +272 → +51).
   The target column still shows the next line, for information. A bounce
   (*held*) call keeps its target. The candle status of such a call is this
   rule's own verdict. The ideas P3 to P7 of the Study page leave it alone.
   On the seven saved days, *Today so far*, 5-minute candles, both signals:
   NIFTY 50 123 calls, net +181 (it was 212 calls, -730); NIFTY BANK 115 calls,
   +1,403 (it was 224, +2,193); 8 October NIFTY 50 -311 (it was -755), the
   10:15 PE held from 22,461.30 to the close, +229.50. With *Previous day*
   levels it does worse: NIFTY 50 -275 (it was +316), NIFTY BANK -194 (it was
   +1,826).
   **Rule 2: the stop moves line by line** (the owner's "Trading Rules
   Specification", 9 October; the settings the owner chose that afternoon, each
   in its own PR: "Rule 2 on all 7 lines" (#115), then "Stop one Fibonacci level
   back"; then 21 October, Change 4, the owner on a trailing stop loss: "point
   no 3", the stop on the line crossed itself). Once a closed candle of a held
   break closes beyond a further line than L in the call's direction (judged on
   the lines the candle is judged against, as the signals: the day's range up to
   the candle before it, with *Today so far*), the stop moves to that line (from
   9 to 21 October: to the Fibonacci line one behind it, the line just behind the
   one crossed; when that was L itself, the stop stayed on L); each further line
   crossed moves it again, never back; one candle past several lines counts the
   furthest. All seven
   lines count, so with *Today so far* a close past the day's low or high so far
   (the 0% or 100% line) counts as crossing that line. Each
   candle is first checked against the stop as it stood before it, then the
   stop moves. The call is sold at the close of a candle that closes back past
   the stop (`trail`). From the first further line on, A and B no longer sell
   (the stop has taken A's place); C still does. The table says "target passed,
   continue · sell if a candle closes above 0.0% (22,432.60)" and, when sold,
   "SOLD · the 11:35 AM candle closed at 22,440.10, above 0.0% (22,432.60)"
   (below for a CE; until 13 October "index candle closed above ...").
   **The target moves on with it** (the owner, 13 October: NIFTY 50's 9:30
   Buy CE stood at 22,570 with its target still on 61.8%, 22,518.68, "candle is
   rising, it is in up direction, why still taget at lower level ?"): from the
   first further line on, the Call Target column shows the next line beyond the
   furthest line a candle has closed beyond (the line the stop moved for), and
   says so: "target 61.8% passed, next target 78.6% · sell if a candle closes
   below 50.0% (22,477.78)". With no line beyond it, that line itself. Only
   the table moves it: a held break is not sold at its target, and the rule,
   the server and the day's calls CSV keep the target the call was given.
   Kept as it was: B compares each later candle with the previous close (the
   owner, 8 October: "keep it as it is"), not C2 with C1's close as the
   specification's table writes it. The specification's other settings
   (section 6: only the lines 23.6% to 78.6%, a buffer of fixed points or of a
   share of the 14-candle ATR, the stop on the line crossed as #115 ran it) are
   in the research engine (`node lab/replay.js`) for comparison; none is live.
   On the seven saved days, *Today so far*, 5-minute candles, both signals:
   NIFTY 50 143 calls, net +208 (the stop on the line crossed: 179, -459; Rule
   1 alone: 123, +181); NIFTY BANK 140 calls, +1,315 (183, +1,760; 115,
   +1,403). Every bounce call is the same as before; a held break changes only
   once a further line is crossed, and when it is sold sooner, new calls that
   way can come sooner (the rule above). 8 October NIFTY 50: the 10:15 PE (L =
   23.6% at 22,481.89) is held to the close for +229.50, its stop moved down to
   22,286.54; with the stop on the line crossed it was sold at 10:40 for +26.80
   (one candle closed 1.90 points above the day's low so far).
6. **Day end** - a call still open at the day's last closed candle ends at its
   close; nothing carries overnight. A signal on the day's last candle has no
   candle left to enter on, so it gives nothing. The day's final save (15:40)
   marks any record of the day still open as ended at the day end, whoever made
   it (7 October: records under the call keys of earlier versions, which no page
   or watcher matched any more, had stayed open).
7. **The candle verdict: CARRY or EXIT** (owner's ask, 7 October, from two
   screenshots of a fall through the levels and a retest; made plain the same
   evening) - for every call, one word, CARRY or EXIT, from the
   closed candles around the level that gave the call, whichever Fibonacci
   level that is (0% to 100% alike), with the reason under it in plain words.
   It changes nothing: not the call, its target, its end or its points. The
   owner's rule: price coming back to the level and holding means carry on; a
   candle closing on the wrong side of the level means get out; a big candle
   through the level carries to the next one. The words on the page:
   - EXIT, "price closed below the 61.8% level" (for a CE call; "above" for a
     PE call): a closed candle after the signal ended on the wrong side of the
     level, at least a quarter of the way toward the target's distance. A
     smaller close on the wrong side does not count: that is a retest, not a
     turn (the owner's first screenshot, and the six saved days: a close back
     of less than a quarter reverted two times in three, a bigger one did not).
     The first such candle is the one named.
   - CARRY, "price came back to the 61.8% level and held": a candle came back
     to within a fifth of the gap of the level and closed on the call's side.
   - CARRY, "big candle through the 61.8% level, holding above it" (or
     "candle", or "small candle"; for a held signal "strong bounce off", "bounce
     off", "small bounce off"): the signal candle's size, measured as before -
     big when it closed past halfway to the target or had a body of a whole
     gap, plain when a quarter of the way or a body of half the gap, small
     otherwise - and no candle has closed on the wrong side since.
   The verdict is on the table as **Candle status** (off it on 7 October
   evening, back on 8 October as the owner's exit signal), and it goes with
   every call into the day's calls CSV for the research engine, as
   `candles_say` (carry or exit), `exit_said_at_ist` (the first candle that said
   exit) and `candles_why` (the reason), from the page and from the server's
   watcher alike (`rule.read_of`, the same code in Python, kept the same by
   `check_rule.py`); the page's CSV download carried the three too, until 16 October. Beside
   them, the *carry read* (idea P5's question, `Rules.carryOf` and
   `rule.carry_of`, 7 October evening): for a call that reached its target,
   `carry_deep` says whether the candle that reached it closed at least a
   quarter of the next gap past it, `beyond_level` is the level beyond, and
   `beyond_reached` whether a later closed candle got there. Every call now
   carries its `ladder`, the levels beyond its target at the signal, nearest
   first, for both. Only
   closed candles count, as everywhere in this layer. The numbers behind it
   (`lab/findings.md`, round 2): calls never closed back a quarter won 89%,
   back a whole gap or more 35%. The same exit, acted on, is idea P4 on the
   Study page (layer 5). While today is still running the call shows as "Still
   open" with its points at the live price.
7. **Every signal gives a call** - whether or not earlier calls are
   still open (owner's decision, 4 October). Several calls can run at once, each
   to its own exit.

As in layer 2, a candle is judged against the previous closed candle, and the
first candle of a day against the last candle of the day before. Points are
**index points**: exit minus entry for a CE, entry minus exit for a PE; won means
more than zero. The option's premium moves less than the index and the page has
no option prices, so which strike to buy and what its premium did are the
owner's to track **(owner to decide)**.

**Exit by premium - built, on Dhan** (owner's decision, 5 October). Each call has
the premium paid for the CE or PE at entry. The sell point is a fall of 35% of
it, i.e. 65% of the premium paid (the `SELL_SHARE` setting; owner's decision of
6 October: a fall of 35%, not the 50% of the day before). While the call is open, when the current premium is
at or below the sell point, the **Sell** column lights red ("SELL", then "SOLD at
<premium>") and stays lit. **The call is sold there** (owner's decision, 9
October: "if it is sold at 67 then ... it should stop there"): the record ends
"sold", its premium stays at the price it was sold at, and the row is finished
(greyed, "sold by the 35% rule at <time>", Candle status "SOLD at <time>"),
ending at the index price of the candle the sale fell in, whatever the index
rule (target, rules A and B, day end) would have done later; whichever comes
first sells the call. Until then the mark was only a mark and the premium went
on moving. The research engine and the Study page stay on index points only,
so they do not know this sale. The premiums are real prices from the owner's
broker account; nothing is estimated from the index (owner's choice: no guessed
premiums). Where Dhan is not connected the column shows a dash.

**The option behind a call** (owner's decisions, 5 October): the prices come
from the owner's **Dhan account** through DhanHQ's API, with the client id and
the 24-hour token kept in `.env` and in the host's environment, never in the
repo. A Buy CE call refers to the CE **one strike in the money**: the first
strike below the index at entry; a Buy PE to the first strike above it. Both on
the **nearest expiry** Dhan lists (weekly for NIFTY 50, monthly where that is
all there is). The premium paid is that option's price when the page first sees
the call entered, within one refresh (15 s) of the candle's open; it is recorded
by the server and kept in `paper_calls.json`, because a live feed cannot give it
back later; it also goes to the `data` branch (`records/<date>.json`) as soon as
it changes and comes back at start, so a restart does not lose it (7 October:
a call open across a restart got "paid" from the moment the page sent it again). The premium now moves **tick by tick** while the call is open: the
contract rides Dhan's live feed beside the index (its security id comes from
Dhan's instrument list), with a once-a-second poll when the feed is quiet and the
option chain only when neither is running (owner's choice, 6 October: no time
shown next to it, just the live premium).
The server watches the calls itself (owner's decision, 7 October, "option 2"):
the same rule, written again in Python (`rule.py`) and proven the same as the
page's engine call for call by `check_rule.py` on every saved day, a hand-made
day and random days, runs on the server every few seconds in market hours, on
the same candles the page has and the levels as the page draws them, for the
setting the owner trades on (`WATCH_INTERVAL`, `WATCH_LEVELS`, `WATCH_SIGNAL`:
5-minute candles, both signals, and since 9 October both levels modes, today so
far and previous day, each by itself on the same candles; until then only today
so far, so a previous-day-line call got its option and premium only while a page
was open on those lines: the owner that day, "yes, build it"; since 15 October
the previous close's lines too, as the page draws them: the owner, asked whether
the server should also write down the calls from the new lines, "Yes"). A call that enters is recorded
the moment it enters, with its option and its premium paid, page or no page,
restart or no restart; a call that ends is marked; and the day's calls go into
the record for the CSV. The page does the same when it is open, and whichever
is first wins: the other finds the record. For this the live feed (Dhan's stream,
and the once-a-second poll behind it) runs all session for the watcher, page or
no page, with the option contracts behind the open calls on it, so the Sell mark
is judged with the page closed too. The watcher also keeps the premium now of
every open record current itself, for both indices: the contracts' security ids
from Dhan's instrument list (then they ride the stream and the poll), and the
option chain for a record the feed has not touched in the last few seconds.
Until 7 October only an open page asked for this, so an index nobody had open
kept every premium at the value paid and no Sell mark could come (NIFTY BANK,
that afternoon). A record marked ended while the watcher's own call by that
name is still open is opened again, and its premium is followed again (8
October: the rule changed twice during that session, and two NIFTY 50 calls of
the new rule had the names of calls of the old one that had reached their
targets, so their premium stood still on the table); only the day end stays
final. **A call seen late** (owner's yes, 13 October: Dhan refused the token
from 9:05 to 9:49, so NIFTY 50's 9:20 Buy CE, bought at 9:25 and sold at 9:29,
read "not seen at entry", and the 9:30 Buy CE, bought at 9:35, showed the
premium of 9:49 as the premium paid: "how would i know that at what price it is
bought and sold ?") takes its prices from the option's own one-minute candles
on Dhan: the premium paid is the open of the entry minute; for a call already
sold, the premium at sale is the close of the minute it was sold in (a target
or a retouch: the first minute of that candle that reached the price; any
other sale: the candle's last minute); and the Sell mark is looked for in every
minute in between, as the feed would have done tick by tick. "Late" means two
minutes or more after the entry (`LATE_SECONDS`), so a call seen live is
recorded as before. The record's `late` says which minutes the prices came
from. A call whose option Dhan has no one-minute candles for keeps the old way:
an open one is paid at the premium when first seen, and an ended one reads "not
seen at entry". **A record made late before this change** (no `late` in it,
its premium paid taken two minutes or more after the entry) gets its prices
again the same way, and its Sell mark is looked for again from the real price
paid, so a sale at the mark that only came from the wrong price is undone (the
owner, 13 October: the 9:30 Buy CE, bought at 9:35 but "paid" 140.90, its
premium at 9:49, was sold at 10:38 at 90.40, "price dropped 36%", while NIFTY
50 stayed above 50.0%, the line its stop was on: "this is wrong. Check and
fix"). The record's `late.was_paid` keeps what it said before. While the page is open in
market hours the price and the candle forming now move tick by tick from Dhan's
own feed (one price a second if that feed is quiet); the closed candles, and so
the signals, are judged when the next candle begins. Dhan's own copy of a
candle wins over the one built from the ticks, except on the candle forming now
and for a minute after a candle closes while the ticks are flowing: there the
close is the last tick's, and the high and low the furthest of the two (8
October: at 12:15:01 the server judged NIFTY BANK's 12:10 candle on Dhan's copy,
asked for a few seconds before the candle ended, which closed at 54,853.20; the
index fell to 54,826.30 in its last seconds, so the Buy CE it gave was gone from
the rule moments later, its record and CSV row left behind). NIFTY 50, NIFTY BANK and
SENSEX are on Dhan (SENSEX since 7 October for its tile and its page, and since
8 October with its options too: SENSEX's options trade on the BSE, so its
contracts come from the BSE rows of Dhan's instrument list, its premiums from
Dhan's option chain for SENSEX and from the BSE_FNO segment of the feed and the
poll; the same strike rule on its 100-point step, the same records, Sell mark and
watcher as NIFTY's); since 19 October these three are the only indices, all on Dhan (the other sixteen, Yahoo's, left with it).

The session's candles run from 09:15 to 15:30 and nothing else is a candle
(7 October): the pre-open prices from 09:00 move the price at the top of the
page, but make no candle and never enter "today so far". The change next to the
price is always against the previous session's close, the one the card shows.
When the live price stops, a red line under the price says for how long and why,
in the server's own words (a restart, a token refused, Dhan's limit, a dropped
connection); the page never stands still without saying so. A refused request is
not a reason to leave Dhan: the last Dhan answer is kept and the live price
keeps moving. When the token is refused or the subscription is gone the page
has nothing to show and says so under the price (until 19 October it went to
Yahoo's delayed prices then).

**Not decided yet (owner to decide)**: whether to trade real money on any of
this, at what size, and with what daily limit. The score line over many days is
the evidence for that choice.

## Layer 4: The record and the study - built

The owner's idea (6 October): keep each session's candles, and after the close
use them to try the rules out and improve them, with a learning step on top once
there is enough. **Candles only** (owner's decision, 6 October): the record and
the learning never look at premiums, the premium paid, the premium at the end or
the Sell mark. Those stay on the index page, as layer 3 says; the study is about
the candles, their daily patterns, their high and low breaks, and how they
behave around the Fibonacci levels. Restated on 7 October: the research engine
drops the premium columns of the calls CSV the moment it reads one, and never
reads the `records/<date>.json` files (the options behind the calls) at all.

**The record.** After every session (at 15:40 IST, the `STUDY_SAVE_AT` setting)
the server saves the day to `data/sessions/<date>.json`: the 1-, 5-, 15- and
30-minute candles of each index on Dhan, and the day's and the previous
session's open, high, low and close. Beside it, `data/sessions/<date>-calls.csv`
(owner's ask, 7 October): **every call the index page suggested that day**, each
and every one, as the page showed it: the setting it ran in (time frame, levels,
signal), when it was first seen, the level, held or crossed, CE or PE, the entry,
the target, the exit, the points, how it ended, and the option's contract and
premiums as the page showed them. The page sends its list to the server as it
draws it; the server keeps the latest state of each call and writes the CSV. The
lab and the research rounds read it: what was suggested live, how it did by the
page's own points, and whether the replay from the candles gives the same call,
which is the test of the live page's timing and levels. During the session a
partial copy of both files is written every ten minutes, and within two minutes
of a call entering or ending, so the study can show today so far and a restart
loses little. A server
that was asleep at the close saves the day when it next wakes; any finished
weekday of the last week without its final copy is saved too. The host's files
do not last, so each copy is also pushed to the `data` branch of the owner's own
GitHub repository (data only, never merged into `main`) when
`GITHUB_DATA_TOKEN` is set, and at start the server fetches the days it lacks
from there. Only sessions on Dhan are recorded; nothing is sent anywhere but the
owner's own repository.

**Removed on 15 October** (the owner: "remove this study tab and everything under it. i dont want it now ... never
update it from tomorrows session"): the Study page, the daily save of the session and the calls CSV, and the options
records backup. **The save came back on 21 October**, alone (the owner: "bring back the daily save, without study
page"; `record.py`): the days from 21 October on are on the `data` branch again, 16 to 20 October are not. What
follows describes the Study page as it was.

**The study** (`/study/`, linked from the dashboard and the index page) was one
page over every saved day, for the index, time frame, levels and signal picked:

- *The paper calls* the rules above give on those candles, with the same code
  the index page runs (`static/rules.js`): day by day, by the hour the signal
  came, by level, by side and signal, and every setting side by side (four time
  frames, two kinds of levels, three signals) with the best net marked. Points
  are index points. *Today so far* levels are replayed as they stood when each
  candle closed, the day's range up to that candle, as the live page had drawn
  them; since 8 October the index page judges its calls the same way, today
  and on a past day, so the two lists agree.
- *Each day's pattern*: the gap at the open against the previous close, open to
  close, the range, when the high and the low came, where the close sat in the
  range, and whether a candle closed above the previous day's high or below its
  low: at what time, how far the day then went to its close, and whether it
  closed back inside.
- *The candles at the levels*: for every level, over every judged candle of
  every day (not only the ones that gave a call): how often it was touched,
  held or crossed, the held share, and after a hold or a cross whether the
  price reached the next level before a candle closed back across. This is the
  owner's own evidence of how the candles work around the levels.
- *Candle high and low breaks*: how often a candle closed above the previous
  candle's high or below its low, and how often the next candle went on that
  way.

**The learning step.** Each finished paper call is described by nine plain
facts read off the candles alone: when in the session it came, which level, CE
or PE, held or crossed, how far the target was, how big the signal candle was,
the day's gap at the open, which way the day had gone so far, and whether the
signal candle also broke the previous candle's high or low. A small model (a
logistic regression fitted in the page) learns which of these go with winning.
It is judged honestly: for each day it is trained on the other days only and
asked which of that day's calls to take, and the page shows how those picks did
against taking every call. It switches on only once a setting has **100
finished calls over 10 days**; with fewer, a model only learns the chance
pattern of those days and would mislead, so until then the page shows the
counter. It never fires a call and never changes a rule: it is evidence for the
owner's own decisions, and it says nothing a plain reading of the tables cannot.

## Layer 5: Ideas under test - the Study page only (the page removed on 15 October)

The owner's standing instruction (6 October): Claude may read the saved candles
and propose rules of its own, built from this framework and these candles, not
borrowed from anywhere. A proposal goes to the owner with the numbers. **Nothing
is built until the owner confirms.** A confirmed idea goes to the Study page
first, as a switch scored against the owner's rule on every saved day, and
reaches the live index page only after about 20 saved days still show it ahead,
and only when the owner says so. The index page's logic is never changed by a
study round. The engine behind the pages (`static/rules.js`) carries the ideas
as options that are off unless the Study page asks for them; the index page
never asks.

Under test since 6 October (confirmed by the owner for the Study page):

- **P1: close open calls at 15:00.** Every call still open ends at the close of
  the first candle that closes at or after 15:00, and no new call opens after
  that. The reason: on the first five saved days the last half hour ran against
  the open calls more often than not, and a call entered then rarely reached its
  target.
- **P2: no new calls after 14:00.** A signal candle that closes after 14:00
  gives no call. The reason: a call needs time to reach its target, and the
  calls entered after 14:00 were mostly the day-end losers.
- **P3: crossed signals only a quarter of the way to the next level** (owner's
  decision, 7 October, from the retest study of round 2). A crossed signal
  counts only when its candle closed at least a quarter of the way from the
  level it crossed to the next level; a shallower cross gives no call, and the
  level stays free to call later (a hold there, or a deeper cross after a close
  back). Held signals are untouched. The reason: on the six saved days a cross
  closing under a quarter of the way came back across the level two times in
  three, and the rule's calls from such signals won 64%, against 78% from a
  quarter to half and 94% past halfway; the gate was ahead of the rule in net on
  three boards of four and in points per call on all four, with far fewer calls.
- **P4: exit when a candle closes on the wrong side of the level** (the
  owner's rule, 7 October evening: the EXIT word of layer 3, acted on). A call
  ends at the close of the first closed candle that ends on the wrong side of
  the call's level by a quarter or more of the gap to the target ("candle" in
  the records, "Closed by EXIT" on a page); the target is checked first on the
  same candle, and the candle forming now never counts. On the six saved days this exit was ahead of the
  rule on one board of four (NIFTY 50, 15 minutes) and behind on three, with
  far smaller worst calls (`lab/findings.md`, round 2); it lives here as a
  switch so the owner sees it scored against the rule as the days come in,
  while the index page shows the same verdict for reading.
- **P5: carry on to the next level when the candle reaching the target closes
  a quarter into the next gap** (confirmed by the owner, 7 October evening,
  from the carry study of round 3). The target is reached tick by tick as
  ever, but the decision waits for that candle to close: if its close is at
  least a quarter of the way from the target to the level beyond, the call's
  target moves to that level, and the same test applies there, again and
  again up the ladder of levels in force at the signal; if not, the call ends
  at the target price, exactly as the rule does. On the candle forming now
  the call stays open at the live price until the close decides. The reason:
  on the six saved days every exit reading lost against holding, while this
  carry reading more than doubled the net over the eight boards (+6,403 to
  +15,341), with 8 to 49 calls carried per board and 0 to 7 of them ending
  worse than their first target. The owner's third observation, "a strong cross carries to the next
  level", taken to every level. The carry read of layer 3 (`carry_deep`,
  `beyond_level`, `beyond_reached` in the day's calls CSV) lets the nightly
  round keep counting it on the real days.
- **P6: stop loss at the same distance as the target** and **P7: stop loss at
  half the distance to the target** (the owner's choice, 8 October evening,
  after a falling day on which NIFTY 50's calls held to the close lost 1,082
  points: test them on the Study page first, the index page unchanged). The
  stop is fixed when the call enters, on the other side of the entry from the
  target; the call ends there ("Ended by the stop"). A candle that touched both
  the stop and the target is settled by the day's one-minute candles (the first
  minute to touch either; the stop when one minute touched both). The two are
  one choice: ticking one unticks the other, and the table never runs them
  together. On the seven saved days, today so far, 5-minute candles, both
  signals (`lab/findings.md`, round 5): NIFTY 50 -945 points without a stop,
  +179 with P6, +198 with P7 (worst day -931, -162, -60); NIFTY BANK +3,128
  without, +279 with P6, +165 with P7 (worst call -539, -175, -88). A stop
  caps the losses and gives up most of the profit of calls that came back.

Tested and set aside on the same five days (`lab/findings.md` has the numbers):
ending a call when a candle closes back across its level (it cut about half the
winners), a stop at half or the full distance to the target (caps the worst call,
costs about two thirds of the net: the owner's risk choice, not taken from five
days), levels from the first 15 or 30 minutes' range, trading only with the
day's direction, a 5-minute signal only when the higher frame agrees (mixed),
leaving out the 23.6% level (a gain on NIFTY BANK only, to watch).

The lab (`lab/replay.js`) replays every idea over the saved days and is the
record of what was tested.

