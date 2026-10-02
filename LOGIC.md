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

## Layer 2: What candles do at the levels - built; the signal rule is still open

For every **closed** candle on the chart (the one still forming is judged once it
closes) and every level from layer 1, the page checks four plain things, judged
against where the previous candle closed:

| It did | Meaning |
|---|---|
| **crossed up through** | closed below the level before, closed above it now |
| **crossed down through** | closed above the level before, closed below it now |
| **held above it (floor)** | was above, dipped to or through the level, closed back above it |
| **held below it (ceiling)** | was below, rose to or through the level, closed back below it |

A candle whose range never reaches a level does nothing at it. A candle that
reaches a level and closes on the same side it came from is a *hold*; one that
closes on the other side is a *cross*. Nothing else is read into the candle yet:
not its colour, size, or wicks.

**What the page does with them**: marks each candle that did something, with an
arrow for a cross (up or down) or a dot for a hold, labelled with the level, and
lists them under the chart newest first with the candle's time, the level, what it
did, and the close. Two switches, *Crosses* and *Holds*, choose what is shown;
both on by default, remembered per browser.

**Owner to decide** (this is the signal rule itself):

- Which of the four count as a signal, and in which direction of trade.
- Whether only some levels count (say 38.2%, 50%, 61.8%) or all seven.
- Whether a near miss counts: a candle that stops a few points short of a level.
  Today "reaches" means the candle's high or low touches the level exactly.
- Whether the candle's colour (close above or below its own open), its size, or
  the candles before it matter.
- Whether one candle is enough or it must be confirmed by the next one.

## Layer 3: Paper orders - not built

Which way to trade on a signal, where the stop and the target go, and when to get
out if neither is hit **(owner to decide)**. Paper only, with a log that keeps the
score, before anything real.
