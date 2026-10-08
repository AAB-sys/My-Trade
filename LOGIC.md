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

**Which move** - a switch on the index page, remembered per browser:

- *Previous day*: the low to the high of the trading day before the
  session being looked at. Only the day's open, high, low and close are known, so
  the day is taken as an up move when it closed above its open, else a down move
  **(owner to decide)**.
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
  aiming at it; it was taken off the same evening. On the seven saved days,
  5-minute candles, both signals, the targets on the chart's lines: NIFTY 50 212
  calls, net -730 (it was 263 calls, -945); NIFTY BANK 224 calls, +2,193 (it was
  258, +3,128); on 8 October NIFTY 50 14 calls, 11 CE and 3 PE, -755 (it was 27,
  12 CE and 15 PE, -931).
  **A break of the day's low or high is a call of its own** (owner's decision,
  8 October evening, "option 3"; *Today so far* only): a candle that closes
  below the day's earlier low (the lowest line as it stood when the candle
  began) is a Buy PE with no target, held while the price keeps making new lows
  and sold when a 5-minute candle closes back above the low it broke, or at the
  day end; a close above the earlier high is a Buy CE the same way, sold when a
  candle closes back below that high. One such call each way at a time: a new
  low while a break PE is held is no second call. No stop and no idea of the
  Study page applies to it (P1 and P2, the clock, do). On the seven saved days,
  5-minute candles, both signals: NIFTY 50 22 break calls (13 CE, 9 PE), 3 in
  profit, net +23, so the day's calls 234, net -707 (without them 212, -730);
  8 October alone one break PE at 09:20, held to the close, +287. NIFTY BANK 17
  break calls (9 CE, 8 PE), none in profit, net -1,278, so 241 calls, +916
  (without them 224, +2,193). 15-minute candles: NIFTY 50 14 break calls, +2;
  NIFTY BANK 12, -1,224.
  Before the morning of 8 October the page and the watcher judged every earlier
  candle against the lines of the moment, so each new high or low redrew the
  whole day's calls: NIFTY 50 showed 22 different calls through that morning and
  14 of them later vanished. A call, once given, stays as it was given; only its
  target follows the lines (item 5).
- *Bars shown*: the lowest low and highest high among the candles on the chart;
  whichever came first says which way the move went.
- *No levels*: hides them.

**Ratios**: the seven above **(owner to decide: add or remove)**.

**Which session**: today by default (the latest trading day among the candles
loaded, which are the last five days). The *Session* drop-down picks another of
those days, or all five on one chart, and the levels and the
calls all switch to that day, with that day's own previous day (owner's decision,
4 October: a past day must be judged with the levels it had then, not with
today's). With all five days on the chart the levels and the calls are the latest
day's.

**Which time frame**: the *Time frame* drop-down sets the size of one candle: 1, 5,
15 or 30 minutes, or 1 day. Everything below is judged on the candles of that size.
On day candles the chart holds the last three months, those days are one session
together (the "previous day" is the day before the last candle), and a call has no
day end: there a day is one candle, so a call runs on until its target.

**What the page does with them**: draws each level as a line across the chart with
its percentage on the price axis (the two ends solid, the rest dashed), and shows
one line of text: the move, its direction, and how far the last price is from the
nearest level. Nothing else yet.

## Layer 2: The evidence - built, its table taken off the page

What counts as a level **held** or **crossed**, judged candle by candle. Its own
table under the chart (held and crossed counts per level, and the held share) was
taken off the page on 6 October (owner's decision: not needed); the judgement
itself lives on inside layer 3, where it is the signal. Nothing is drawn on the
chart.

Judged for every closed candle (the one still forming is judged once it closes)
against where the previous candle closed:

- **Held**: the candle reached the level (its high or low touched it or went
  through) and closed back on the side it came from. The level acted as a floor
  or a ceiling.
- **Crossed**: the candle closed on the other side of the level from the previous
  close.

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
left to right, in the owner's format of 7 October evening: **Time** (9:15 AM),
**Call (CE/PE)** with its contract, **Signal** (*Held* or *Crossed*, the level's
ratio and price), **Call Entry** (the strike number of the contract, the same
number as in the call; the index price at entry until the contract is known:
no Dhan, or no page open at the entry), **Call Target** (the next level in the
call's direction, on the lines as the chart draws them now, item 5; once the
call has ended, *hit* or *not reached, day end* under it), **Premium Paid ->
Now** (at exit once the call has ended; *SELL NOW* while the premium sits below
the sell mark, *sold at* once marked sold), **Candle status** (the candle
verdict of item 7: CARRY or EXIT with its reason on an open call; on a finished
one, "CARRY the whole time" or "Said EXIT at" its time; off the table on 7
October evening, back on 8 October as the owner's exit signal, and in the day's
calls CSV all along). A finished row is greyed. A finished call that
no page saw enter reads "not seen at entry" in the premium cell: no page was
open at its entry, so no premium could be recorded then (7 October). An open
call whose option was first recorded more than two minutes after its entry (the
server was restarting, or the rule changed during the session and the call
appeared afterwards) says so under its premium: "paid: the price at 12:12 PM,
not at entry" (8 October: the 10:35 NIFTY 50 call entered at 10:40 and showed
118.65 paid, the price at 12:12; the same contract was 155.65 at 10:45). Its
sell mark is 65% of that later price. The header
row stays in view while the page scrolls (owner's ask, 7 October). The list is in time order, the newest call at the
top, open or finished alike (owner's ask, 7 October: an open call listed above a
later one read as if it had been given later); one line keeps the score (owner's
ask, 7 October: the list must say what is happening and what action is needed). Paper only: nothing is sent anywhere, and
the list is worked out afresh from the candles every minute. **Download CSV**
saves it as a file for the owner's own record, one session at a time.

The rule, in the order it is applied:

1. **Signal** - a closed candle that **held** a level ("Held: trade the bounce")
   or **crossed** one ("Crossed: trade the break"), or either ("Both"), as the
   switch says. The switch is remembered per browser; *Off* hides the list. When
   one candle signals at several levels, the one nearest its close counts: one
   candle, one call **(owner to decide)**. A level that has given a call in a
   direction gives no more that way until the index has closed back across it
   (owner's decision, 4 October: no repeat calls while the index hovers at one
   level). The level is remembered by its price, not its name (8 October): with
   *Today so far* the 0% line follows each new low, so on 8 October NIFTY 50's
   first call at the day's low (09:20) blocked every later hold of a lower low,
   up to 186 points lower, and the price could never close back across a line
   that had moved, so the table went silent after 10:15. Now a line at a new
   price may call once more; a line that stays put still calls once. With the
   previous day's levels nothing changes, their lines never move.
2. **The call comes at once** - the moment the signal candle closes, with no
   confirming candle (owner's decision, 6 October: the call must be there when
   the signal fires, not a candle later; from 4 to 6 October the next candle had
   to agree first).
3. **Option** - always bought, never sold. The signal candle closed above the
   level: buy a CE, the index should rise. Below it: buy a PE, it should fall.
   For a hold that is the bounce away from the level; for a cross, the break
   through it.
4. **Entry** - the open of the next candle, i.e. the first price after the
   signal candle closes. The option's premium is recorded at that moment. In the
   second or two before that candle begins, the call is listed as "Enters at the
   next open".
5. **Target** - the next level in the call's direction. The call ends when a
   later candle reaches it, at that level's price; the candle forming now counts
   too, tick by tick. **No stop** (owner's decision,
   5 October): a call that goes the wrong way is held, to the target or to the
   day's last candle, and its loss is whatever the day does. A signal pointing
   outward from the 0% or 100% level has no next level, so it gives no call
   with the previous day's levels **(owner to decide)**; with *Today so far* it
   is a break call, with no target, sold when a candle closes back across the
   broken low or high (owner's decision, 8 October evening, see Levels).
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
   `check_rule.py`); the page's CSV download carries the three too. Beside
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
<premium>") and stays lit. The premiums are real prices from the owner's broker
account; nothing is estimated from the index (owner's choice: no guessed
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
5-minute candles, today so far, both signals). A call that enters is recorded
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
final. A call that entered and ended before
either looked (a server just started) still has no premium: nothing can be
recorded after the fact, and its cell reads "not seen at entry". While the page is open in
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
watcher as NIFTY's); the other indices stay on Yahoo and have no options.

The session's candles run from 09:15 to 15:30 and nothing else is a candle
(7 October): the pre-open prices from 09:00 move the price at the top of the
page, but make no candle and never enter "today so far". The change next to the
price is always against the previous session's close, the one the card shows.
When the live price stops, a red line under the price says for how long and why,
in the server's own words (a restart, a token refused, Dhan's limit, a dropped
connection); the page never stands still without saying so. A refused request is
not a reason to leave Dhan: the last Dhan answer is kept and the live price
keeps moving. The page goes to Yahoo's delayed prices only when the token is
refused or the subscription is gone, and says so under the price.

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

**The study** (`/study/`, linked from the dashboard and the index page) is one
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

## Layer 5: Ideas under test - the Study page only

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

