# Path Typography

Set a line of text along a path and read it. The starting picture is a contour map of an abstract
landscape whose lines are lettered: "THE ROAD BENDS TWICE BEFORE THE RIVER" repeats along each of eight
contours, thin gold guide lines show what the type rides, letters narrow where a bend is too tight for
their neighbours, and a lettered line that would run into another is left bare rather than piled on top
of it. A new seed is a different landscape (or branching tree, or take of a hand movement), so different
lines carry the words.

The instrument can also follow **the branches of a grown tree** (the longest chain runs root to tip, the
others run from the fork where they leave it, so they never overlap) or **a recorded hand stroke**, and it
can deliberately break the text up with smooth, correlated disruption. Text is set on the path in
arc-length units: a letter's place depends on how far along the path it is, not on which polyline vertex
it happens to be near.

## What the text is

The instrument ships five bundled lines of text; your own text is a future host feature (the library
accepts any line of 1–120 printable ASCII characters through `pathText`, but a saved layer names only a
bundled one). Text is **unshaped Latin**: one character, one glyph, left to right, from the same licensed
outline font as Word Echo. There are no ligatures, no other scripts and no bidirectional text, and the
font has no kerning table, so the **Kerning** control states its own rules:

| Kerning | What it does |
|---|---|
| **Metric** | Each letter advances by its own width, nothing more. |
| **Optical** | Each pair is moved closer or further so that the white between the facing outlines matches "H" beside "H". A crossbar stops short of the next stem; straight-sided pairs are untouched; rounds and diagonals tighten. |
| **Monospaced** | Every letter is centred in a cell as wide as the widest letter of the text. |

Kerning and **Tracking** (extra space after every letter, in cap heights) are settled before the text is
laid on the path.

## The path

| Controls | What changes on the canvas |
|---|---|
| **Path supply** | **Contour**: contour lines of a sampled landscape. **Branch chains**: chains of a grown branching tree. **Gesture stroke**: a bundled recorded hand movement (a different take for each seed). |
| **Landscape, Frequency, First threshold, Threshold interval, Threshold count** (contour) | Which landscape, how many wave cycles, where the contours sit, how far apart neighbouring levels are (wider spacing keeps lines of type apart) and how many levels there are. |
| **Recording, Hand smoothing** (gesture) | Which movement, and how much its tremor is softened before the text is laid on it. |
| **Attractors, Growth ticks, Branches, Branch spread, Branch routing** (branch) | The tree the chains come from. |
| **Path, Paths lettered** | Paths are ranked longest first. **Path** is the first one that carries text; **Paths lettered** is how many consecutive ones do. Fewer are lettered if the supply has fewer; a **Path** past the last one is an error. |
| **Smoothing** | Rounds of corner cutting before layout. A faceted path turns letters in jerks; 0 keeps the source polyline. |
| **Center, Size, Rotation** | Where the supply sits and how large it is (landscape width, attractor area or the stroke's larger side). |

## The text on the path

| Controls | What changes on the canvas |
|---|---|
| **Phrase, Type size** | Which line, and its cap height. |
| **Reading direction** | **Forward** follows the path as drawn, **reverse** runs against it (the letters are upside down where the path runs left to right), **upright** picks whichever keeps the text reading left to right. |
| **Start** | Where the text begins along each path, as a fraction of its length in the reading direction. On a closed contour the text wraps around but never passes its own start. |
| **Baseline offset** | Distance of the baseline from the path: positive lifts the text above it, negative hangs it below. |
| **Repeat** | **Once** sets the text one time and drops letters that do not fit before the end of the path. **Whole phrases** repeats only while a complete phrase fits. **Fill the path** repeats until the path is used up and cuts the last phrase. **Repeat gap** is the space between repeats, in cap heights. |
| **Tight curves** | What happens where neighbouring letters would overlap on the inside of a bend. **Compress** narrows the letter (down to 40% of its width), **rotate** turns it back toward its neighbour, **skip** drops it, **ignore** leaves the overlap. A letter is never moved off its place on the path. Where the path folds back on itself inside one letter (a hairpin), the letter is always dropped: a chord across a fold means nothing. |
| **Crowding, Clearance** | **Avoid** drops a whole repeat that would come within the clearance of type already set on another path or an earlier repeat (half a phrase is unreadable), and stops a run where it would run into itself. **Allow** sets everything. Earlier (longer) paths have priority. |

## Disruption

Off keeps every letter exactly on the path. **Correlated** moves, tilts, resizes and omits letters by smooth
noise along the path, so neighbours drift together in runs rather than shaking independently.

| Controls | What changes on the canvas |
|---|---|
| **Correlation length** | Distance, in cap heights, over which neighbouring letters are disrupted alike. |
| **Shift, Tilt, Size drift** | Largest sideways move off the baseline, extra turn and size change. |
| **Dropout** | Share of the noise range in which a letter is left out; letters go missing in runs, and raising it only removes more letters, never different ones. |

Disruption comes after the layout, so it can bring back overlaps: that is what it is for.

## Ink

**Letter style** fills the letters or strokes their outlines (**Outline weight**). **Color by** uses one
color, or cycles the palette by structure: which **repeat**, which **word**, or whether tight-curve handling
**adapted** the letter (compressed is the second color, rotated the third), which shows what the policy did.
**Guide line** also strokes the supplied path or the offset baseline the letters stand on.

## Try these

- **Labelled map:** the default. Raise **Threshold count** and **Paths lettered** and lower **Type size**.
- **One road, read once:** **Path supply** branch, **Paths lettered** 1, **Repeat** once, **Branch routing** straight.
- **Hand-lettered swoop:** gesture, **Recording** sweep, **Repeat** once, **Type size** 34, **Baseline offset** −20, outline.
- **See the curve policy:** gesture, **Recording** loops, **Repeat** once, **Color by** adapted; switch **Tight curves** between the four.
- **Torn banner:** **Landscape** saddle, **Disruption** correlated, **Dropout** 0.3, **Shift** 0.6.
- **Spaced-out inscription:** **Kerning** monospaced, **Tracking** 0.3, **Landscape** hills, **Color by** word.

## Use the pieces in code

The text run, the layout and the drawing are ordinary values and functions; the named instrument calls the
same ones. The layout takes any list of advances, so a text-free sequence of motifs uses it too.

```js
import { layoutAlongPath, layoutPaths, shapeRun, pathText, disruptFrames, glyphFill, atEach, strokeWith,
  pathMaterial, rankedPaths, pathTypographyComposition, createInstrument } from "@procedurals/instruments";

// 1. Shape the text: advances and outlines in font units, before any path is involved.
const run = shapeRun(pathText({ id: "mine", text: "Follow the line" }), { kerning: "optical", tracking: 0.05 });

// 2. Any Path works: a contour, a branch chain, a gesture, or your own polyline in canvas units.
const path = { id: "arc", seed: 1, closed: false, level: 0, levelFraction: 0,
  points: Array.from({ length: 200 }, (_, i) => [60 + i * 2.6, 320 - 140 * Math.sin(i / 63)]) };

// 3. Lay the run out by arc length. size / CAP_HEIGHT converts font units to canvas units.
const layout = layoutAlongPath(path, run.items, { scale: 24 / 115.18, start: 0, direction: "upright", baseline: 3,
  gap: 24, repeat: "once", policy: "compress", minStraightness: 0.8, clearance: 0 });
layout.frames;     // id "arc/r0/g<index>", position, angle (radians), scale, condense, turn, seam, adapted
layout.dropped;    // every letter not placed, and why: overflow, fold, curvature or crowded
layout.baselines;  // the baseline of each repeat as a Path

// 4. Draw. A glyph consumer is an ordinary callback; the frame is already translated, turned and scaled.
atEach(p, layout.frames, glyphFill([0x222222], "ink"));
atEach(p, layout.frames, (surface, frame) => surface.circle(0, 0, 20));   // or anything else
strokeWith(p, layout.baselines, pathMaterial({ kind: "ink", weight: 0.8, spacing: 8, phase: 0, phaseSpread: 0, levelRamp: 0,
  retention: 1, mark: { kind: "dot", size: 0, petals: 1, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, [0x999999]));

// Text-free: five equal 30-unit motifs on the same path.
layoutAlongPath(path, Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, advance: 30 })),
  { scale: 1, start: 0, direction: "forward", baseline: 0, gap: 0, repeat: "once", policy: "ignore", minStraightness: 0.8, clearance: 0 });
```

`pathTypographyComposition(input)` resolves the named instrument to a typed descriptor and
`drawPathTypography(p, recipe, { glyph, guide })` replaces the letters or the guide with your own callback while
the supply, shaping and layout stay the same cached objects. Nothing here fetches a font or an asset, clears a
canvas or reads pointer events. Lengths are canvas units, option angles degrees and frame angles radians.
Work is bounded: 6,000 items per layout, 20,000 drawn letters and 40 million outline segment tests; exceeding
one throws an error naming the settings to change.
