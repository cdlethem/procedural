# Sand Deposition

Sand falls from a moving curve. The starting picture is a haze of dark grains hanging in
two wavering curtains, dense where the curve lingered and thin at its fringes, with a clean oval
of bare paper where nothing was allowed to land. A new seed is a different performance of the same
idea (here the curtain is lowered or raised, with a different number of waves and a different
phase), not a reshuffle of the same grains.

The curve is a spline whose **control points move over time**. Five bundled sequences differ in
shape and motion (see below). At each moment grains are released from points along the curve,
each carrying an amount of sand; they fall for a short random delay, keep some of the curve's
own velocity, scatter and land. Where many land, the sand piles up. Your own captured sequence
is a future host feature: the library accepts a validated control sequence, but the instrument's
saved settings name only the bundled ones.

**How much sand is a different question from how many grains.** *Deposit* sets the sand released
per unit of curve length per second. *Grain mass* sets how much sand one grain stands for, so
halving it doubles the number of grains and leaves the total, and the overall tone, unchanged: fine
sand or coarse sand of the same amount. *Exposure* then decides how strongly that amount shows,
like exposing a photograph; it never moves a grain. Changing the mark size, the exposure or
the colours does not move anything; changing the sequence, window, motion, deposit, fall or seed
rebuilds the deposit.

## The sequences

| Sequence | What it is |
|---|---|
| **Curtain** (4.2 s) | A wavy line lowered (or raised, by seed) across the canvas while its waves travel. Sand hangs in vertical drapes below the turning points. |
| **Whip** (3.6 s) | A rope hung from a pivot and whipped sideways; each joint lags the one above. Carried motion throws sand along arcs. |
| **Bloom** (5.0 s, closed) | A lobed loop (two to four lobes by seed) opening from a small knot while the lobes turn. Sand halos a growing ring. |
| **Unfurl** (4.4 s) | A tight coil unrolling into a long S, each control starting later than the last. |
| **Fold** (3.8 s) | A straight sheet collapsing into pleats and relaxing again. Sand gathers where the curve folds onto itself. |

Every sequence has irregular keyframe times, like a real recording; the curve depends on the motion,
not on how densely it was sampled.

## Shape the deposit

| Controls | What changes on the canvas |
|---|---|
| **Sequence** | Which evolving spline the sand falls from. |
| **Control motion** | How far the control points travel about their own average positions. 0 freezes the curve at its average shape (sand falls from one still curve); 1 is the sequence as supplied; more exaggerates it. |
| **Center X/Y, Scale, Rotation** | Position, size and turn of the whole sequence. Grain sizes keep their canvas sizes when it scales. |
| **Window start / length** | Which part of the sequence deposits, as fractions of its duration. Narrowing the window removes grains and leaves the rest exactly where they were. |
| **Deposit** | Sand per unit of curve length per second. More deposit puts more grains on the canvas. |
| **Grain mass** | Sand per grain. Small: many fine grains and a smoother tone. Large: a few coarse grains and a spotted tone. The total is the same. |
| **Fall time / speed / direction** | Each grain lands after its own delay (up to the fall time) having dropped in the chosen direction: 90 is down the canvas, 0 to the right. Fall time 0 puts every grain on the curve at the moment it left. |
| **Carried motion** | How much of the curve's velocity at the point a grain left it keeps while it falls: 0 drops straight, 1 throws it along the motion. |
| **Grain spread** | Randomly displaces each landing; small keeps sharp curtains, large blooms into haze. |

## Protected space

| Controls | What changes on the canvas |
|---|---|
| **Protected space** | An ellipse, a rectangle or the letters of a word. Grains that would land there are dropped, not moved, so the sand around it is unchanged and the shape reads as bare paper. |
| **Protected word** | Which word. Its counters (the hole of an A) stay open too. |
| **Space center X/Y, Space width / height** | Where the shape is and how large; a word is fitted inside the box. |

## Exposure and materials

| Controls | What changes on the canvas |
|---|---|
| **Exposure** | Stops of exposure. Each stop doubles how strongly a given amount of sand shows: grains become darker and fainter fringes appear (a grain is only ever added or strengthened). It also moves the isolines, which follow the same law. |
| **Material** | **Grains** draws every grain as a dot. **Isolines** traces where the accumulated sand reaches given tones, like a topographic map of the deposit. **Both** draws the lines beneath the grains. |
| **Grain size** | Diameter of each grain. A larger grain covers more paper and shows fainter, so the tone stays the same. |
| **Isolines / Field cell / Isoline smoothing / Isoline weight** | How many contours (from a faint fringe to a dense core), the grid the density is measured on, the blur applied to it before tracing (mass is moved, not lost), and the line weight. Faint levels (high exposure) on a fine grid with little smoothing trace individual grains and can exceed the line-assembly limit; the message says which controls to change. |
| **Curve overlay / Overlay interval / Overlay weight** | Draws the generating curve itself, crisp, at multiples of the interval from the start of the sequence, inside the window and clear of the protected space. A sparse overlay against the haze shows where the sand came from. |

## Try these

- **Fragment:** *Window length* 0.14, *Window start* 0.3, *Grain mass* 3, *Curve overlay* on at 140 ms: a few crisp curves above a scatter of coarse grains.
- **Sand and letters:** *Bloom*, *Protected space* word AIR, *Fall time* 500, *Deposit* 3: a ring of sand with the word left empty.
- **Topography:** *Material* isolines, *Exposure* +2, *Isolines* 9, *Isoline smoothing* 14, *Field cell* 8.
- **Fine or coarse, same amount:** turn *Grain mass* from 0.5 to 3 and watch the texture change while the tone stays.
- **A still curve:** *Control motion* 0. The whole deposit falls from one shape.
- **Thrown sand:** *Whip*, *Carried motion* 0.9, *Fall speed* 60, *Fall time* 1100.
- **Layers:** the deposit is a transparent layer. Put it over Contour Scores, Region Quilts or Motif Ecologies (or under them) and change either layer's own order and controls.

## Use the pieces in code

The sequence, the curve family, the deposit, the density and each consumer are ordinary values; the
named instrument is these same functions.

```js
import { createControlSequence, curveFamily, splineDeposit, protectedSpace, keepOut, exposeGrains,
  accumulateDensity, smoothDensity, densityContours, curvePaths, depositGrains, motif, strokeWith, pathMaterial }
  from "@procedurals/instruments";

// Control points at keyframes: timestamps in ms (strictly increasing), controls[keyframe][control] = [x, y].
// (bundledControlSequence("curtain", 42) is the same kind of value.)
const sequence = createControlSequence({ id: "mine", closed: false, t: [0, 800, 2000],
  controls: [[[80, 200], [320, 260], [560, 200]], [[80, 300], [320, 200], [560, 320]], [[80, 420], [320, 340], [560, 260]]] });

const family = curveFamily(sequence, { motion: 1, frame: { centerX: 320, centerY: 320, scale: 1, rotation: 0 } });
const deposit = splineDeposit(family, { seed: 1, window: { start: 0, end: 2000 }, deposit: 6, grainMass: 1,
  fall: { lag: 800, fall: 160, fallAngle: 90, inherit: 0.3, spread: 3 } });   // deposit.mass is the total sand
const space = protectedSpace({ shape: "ellipse", centerX: 320, centerY: 380, width: 160, height: 100 });
const kept = keepOut(deposit, space);                                        // kept.mass + kept.rejectedMass === deposit.mass

const mark = motif({ kind: "dot", size: 2, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 }, [0x3b2f27]);
depositGrains(p, kept.grains, { mark, exposure: { stops: 1, footprint: Math.PI } }, run);   // any Mark works

const field = smoothDensity(accumulateDensity(kept.grains, [0, 0, 640, 640], 5), 8);  // mass per canvas unit squared
strokeWith(p, densityContours(field, [0.2, 0.5, 1], 1), pathMaterial(inkSpec, [0xb5522f]));
strokeWith(p, curvePaths(family, { seed: 1, every: 500, window: { start: 0, end: 2000 } }, space), pathMaterial(inkSpec, [0x1f5f73]));
```

Each grain is a `Site` that also carries `mass`, `time` and `origin` (where it left the curve), so a consumer can
draw the fall itself. `sandDepositionComposition(input)` resolves the named instrument to a typed descriptor and
`drawSandDeposition(p, recipe, { grain, isoline, curve })` replaces any consumer with your own callback while the
producers stay the same cached objects. `exposeGrains` only chooses which grains a consumer sees and how faint;
the positions are the producer's own. Gesture Scores drops its sand through the same fall model and grain
consumer. The library never captures, fetches or clears a canvas; every length is in canvas units, time is in
milliseconds, and mass is in area units.
