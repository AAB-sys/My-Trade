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

- *Previous day* (default): yesterday's low to yesterday's high. Only the day's
  open, high, low and close are known, so the day is taken as an up move when it
  closed above its open, else a down move **(owner to decide)**.
- *Today so far*: today's low to today's high, an up move when the last price is
  above today's open **(owner to decide)**. Blank until the market has traded today.
- *Bars shown*: the lowest low and highest high among the candles on the chart;
  whichever came first says which way the move went.
- *No levels*: hides them.

**Ratios**: the seven above **(owner to decide: add or remove)**.

**What the page does with them**: draws each level as a line across the chart with
its percentage on the price axis (the two ends solid, the rest dashed), and shows
one line of text: the move, its direction, and how far the last price is from the
nearest level. Nothing else yet.

## Layer 2: The evidence - built

Under the chart, one row per level: how many closed candles **held** it and how
many **crossed** it, in the candles shown, and the held share. Nothing is drawn
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

## Layer 3: Paper trades - built

The rule above, run over the closed candles shown, with the levels on the chart.
Each paper trade is listed under the evidence table with its entry, stop, target,
exit and points, and one line keeps the score. Paper only: nothing is sent
anywhere, and the list is worked out afresh from the candles every minute, so it
is as long as the chart (today, or five days). **Download CSV** saves it as a
file for the owner's own record.

The rule, in the order it is applied:

1. **Signal** - a closed candle that **held** a level ("Held: trade the bounce")
   or **crossed** one ("Crossed: trade the break"), as the switch says. The switch
   is remembered per browser; *Off* hides the list. When one candle signals at
   several levels, the one nearest its close counts **(owner to decide)**.
2. **Side** - the side of the level the candle closed on: above it, buy; below
   it, sell. For a hold that is the bounce away from the level; for a cross, the
   break through it.
3. **Entry** - the open of the next candle, since one can only act once the
   signal candle has closed **(owner to decide)**. Until that candle has closed
   the trade is listed as "Enters at the next open".
4. **Target** - the next level in the trade's direction. **Stop** - the next level
   the other way. Whichever a later candle reaches first ends the trade at that
   level's price. If one candle reaches both, the stop is taken **(owner to
   decide)**. The 0% and 100% levels have nothing beyond them on one side, so a
   signal there gives no trade **(owner to decide)**.
5. **Day end** - a trade still open at the day's last closed candle ends at its
   close; nothing carries overnight. A signal on a day's last candle has no next
   candle to enter on, so it gives nothing. While today is still running the
   trade shows as "Still open" with its points at the last closed candle.
6. **One trade at a time** - signals are ignored while a trade is open. The
   candle that ends a trade can itself be the next signal **(owner to decide)**.

As in layer 2, a candle is judged against the previous closed candle, and the
first candle of a day against the last candle of the day before. Points are exit
minus entry for a buy, entry minus exit for a sell; won means more than zero.

**Not decided yet (owner to decide)**: whether to trade real money on any of
this, at what size, and with what daily limit. The score line over many days is
the evidence for that choice.
