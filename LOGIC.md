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
  decide)**. Blank until it has traded. Built from the live candles: a tick that
  makes a new high or low, or turns the move, redraws the lines at once.
- *Bars shown*: the lowest low and highest high among the candles on the chart;
  whichever came first says which way the move went.
- *No levels*: hides them.

**Ratios**: the seven above **(owner to decide: add or remove)**.

**Which session**: today by default (the latest trading day among the candles
loaded, which are the last five days). The *Session* drop-down picks another of
those days, or all five on one chart, and the levels, the evidence table and the
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

## Layer 2: The evidence - built

Under the chart, one row per level: how many closed candles **held** it and how
many **crossed** it, in the session picked, and the held share. Nothing is drawn
on the chart.

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
touching the level exactly), whether the candle's colour or size matters, and
whether the next candle must confirm.

## Layer 3: Paper calls - built

The rule above, run over the closed candles of the session picked, with that
session's levels. Each call (buy a CE, or buy a PE) is listed under the evidence
table with the index at entry, its stop, its target, the index at exit and the
points, and one line keeps the score. Paper only: nothing is sent anywhere, and
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
   level).
2. **Confirmation** - the next candle must agree, or there is no call (owner's
   decision, 4 October). After a cross, it closes on the new side of the level
   too. After a hold, it closes further from the level than the signal candle
   did. While it is still forming, the list shows the signal as "Needs the next
   candle to confirm".
3. **Option** - always bought, never sold. The signal candle closed above the
   level: buy a CE, the index should rise. Below it: buy a PE, it should fall.
   For a hold that is the bounce away from the level; for a cross, the break
   through it.
4. **Entry** - the open of the candle after the confirming one, since one can
   only act once that candle has closed **(owner to decide)**. Until then the
   call is listed as "Enters at the next open".
5. **Target** - the next level in the call's direction. The call ends when a
   later candle reaches it, at that level's price. **No stop** (owner's decision,
   5 October): a call that goes the wrong way is held, to the target or to the
   day's last candle, and its loss is whatever the day does. A signal pointing
   outward from the 0% or 100% level has no next level, so it gives no call
   **(owner to decide)**.
6. **Day end** - a call still open at the day's last closed candle ends at its
   close; nothing carries overnight. A signal in the day's last two candles has
   no candles left to confirm and enter on, so it gives nothing. While today is
   still running the call shows as "Still open" with its points at the last
   closed candle.
7. **Every confirmed signal gives a call** - whether or not earlier calls are
   still open (owner's decision, 4 October). Several calls can run at once, each
   to its own exit.

As in layer 2, a candle is judged against the previous closed candle, and the
first candle of a day against the last candle of the day before. Points are
**index points**: exit minus entry for a CE, entry minus exit for a PE; won means
more than zero. The option's premium moves less than the index and the page has
no option prices, so which strike to buy and what its premium did are the
owner's to track **(owner to decide)**.

**Exit by premium - built, on Dhan** (owner's decision, 5 October). Each call has
the premium paid for the CE or PE at entry. The sell point is half of it (50%,
the `SELL_SHARE` setting). While the call is open, when the current premium is
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
back later. The premium now moves **tick by tick** while the call is open: the
contract rides Dhan's live feed beside the index (its security id comes from
Dhan's instrument list), with a once-a-second poll when the feed is quiet and the
option chain only when neither is running (owner's choice, 6 October: no time
shown next to it, just the live premium).
The page must be open for a call to be recorded: a call that enters while no
page is open gets no premium, and shows a dash. While the page is open in
market hours the price and the candle forming now move tick by tick from Dhan's
own feed (one price a second if that feed is quiet); the closed candles, and so
the signals, are judged when the next candle begins. Only NIFTY 50 and NIFTY BANK
are on Dhan so far; the other indices stay on Yahoo and have no options.

**Not decided yet (owner to decide)**: whether to trade real money on any of
this, at what size, and with what daily limit. The score line over many days is
the evidence for that choice.
