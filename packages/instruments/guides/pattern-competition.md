# Pattern Competition

Broad lobes that hold smaller patterns, which hold smaller ones. Several scales of activation and inhibition
compete on one grid: at every cell the scale whose activator and inhibitor disagree least is the one that
updates it, and the field is renormalised every step. The starting study is four scales on a 96 × 96 grid
from seeded noise, after 120 steps: flat colour bands (one colour per dominant scale) with three thin contour
lines over them, so the coarse lobes, the medium loops inside them and the fine rings inside those read as
different colours and different line densities.

It is a **2D pattern-formation model in the family of multiscale Turing patterns, not a chemical or physical
simulation**, and not any published author's exact equations. The rule is stated below so you can predict it.

Bands, contours and marks are three drawings of **one** evolving field. Recolouring, changing the line
material, the band opacity, the contour levels or the mark never re-runs the model; scrubbing **Steps**
continues or rewinds the same run (a step or two costs a fraction of a full run); changing anything that
shapes the field (the scales, their weights, the start, the boundary, the symmetry, the seed) computes a new
one.

## The rule

The field `u` lies in [−1, 1]. Each of **Scales** pairs has an activator radius `a` and a wider inhibitor
radius `b` (box half-widths in cells; the blur is a box applied three times, close to a Gaussian). Where
`A` and `I` are the blurred fields, the *variation* of a scale is `A − I`.

1. Every cell picks the scale with the smallest \|variation\| there: its **dominant scale**. (Ties, including a
   flat region where every scale agrees, take the finest scale and a positive sign.)
2. `u` changes by that scale's **Increment**, up where the activator is ahead (`A ≥ I`), down where the
   inhibitor is.
3. The field is symmetrised if you asked for it, then renormalised: the lowest value becomes −1 and the
   highest 1.
4. Dominant scales are recomputed from the new field.

All cells update from the old field at once, and nothing random happens after the start. A field that has
become exactly constant (an empty start) is **inert**: it stays frozen, the drawing is empty, and no more
work is done for the remaining steps.

## Scales, weights and the start

| Controls | What changes on the canvas |
|---|---|
| **Scales** | How many scale pairs compete, finest to coarsest. More scales give more levels of nesting; each is a colour band. |
| **Smallest scale**, **Scale ratio** | Activator radius of the finest scale in cells, and how much each next one grows (radii are whole cells, at least one apart). Larger radii mean larger lobes; a wide ratio spreads the hierarchy. |
| **Inhibitor reach** | Inhibitor radius as a multiple of the activator. Near 1 the pattern turns grainy and diagonal; near 3 it forms broad, separated lobes. |
| **Increment**, **Weight tilt** | How far one update moves the field, and how that varies over the scales: positive tilt lets coarse scales move the field further (broad flat lobes win), negative favours fine texture inside them. Increment sets how fast patterns form, not their contrast. |
| **Start**, **Start size**, **Spots**, **Start noise** | Noise: uniform random per cell. Spots: seeded bumps of random sign. Disc and Ring: one centred shape (exactly symmetric without noise). Spots, disc and ring can carry noise. A disc of size 0 is empty: the field is constant, inert, and draws nothing. |
| **Steps** | Time. 0 shows the start; scrubbing shows the scales taking over from each other. Patterns keep evolving slowly rather than settling. |
| **Resolution** | Cells per side. Scales are measured in cells, so a finer grid at the same scales gives finer features and costs in proportion to its square. |
| **Boundary** | **Wrap** joins opposite edges (patterns run across the seam), **Mirror** reflects the field, **Void** treats everything beyond the edge as zero (a frame forms). |
| **Symmetry**, **Symmetry tiles** | Forces the field to be exactly symmetric every step inside each tile: a mirror, half turn, both mirrors, quarter turns, or the eight-fold group. One tile makes the whole square symmetric; two to four per side give many small symmetric motifs whose scales still interact across their borders. Tiles must divide the grid. |
| **Center X/Y**, **Size** | Position and side of the square the grid is laid over. The pattern itself does not change. |

## Three drawings

| Controls | What changes on the canvas |
|---|---|
| **Scale bands**, **Band level**, **Band smoothing**, **Smallest patch**, **Band opacity** | Flat polygons (with holes) where the field is at or above the level, coloured by the dominant scale. Smoothing thins the cell staircase into straighter edges (shared edges between scales stay shared); Smallest patch drops specks. |
| **Contours**, **Levels**, **Level center**, **Level spread**, **Smallest contour**, **Contour color** | Lines where the field crosses evenly spaced values around the centre. Every level must stay strictly between −1 and 1. Colour is ink, the scale under most of each line, or one colour per level. |
| **Line material**, **Line weight**, **Station spacing**, **Bead size** | Solid ink, tangent stitches or beads along each contour. |
| **Marks by scale**, **Mark**, **Mark size**, **Mark line weight**, **Mark gap**, **Mark level** | Marks on the field's peaks, packed so none is closer than the gap allows. A mark is sized by its scale's radius: the coarsest scale gets the full **Mark size**, finer scales proportionally less, so coarse lobes hold a few large marks and fine texture many small ones. |
| **Petals**, **Opening**, **Size variation**, **Mark retention**, **Mark color**, **Follow contour** | Mark shape, stable per-mark variation and omission (which never moves a mark), colour by scale or ink, and turning rosettes and arrows along the level line through their cell. |

Palette colour 0 is ink (contours and marks in Ink colour); the scales cycle over the other colours, finest
first. The layer is transparent; bands, contours and marks draw in that order.

## Things to try

| Setting | Result |
|---|---|
| Steps 0, 20, 60, 120, 400 | The start, the first coarse lobes, fine rings inside them, and a slowly reshuffling mature pattern. |
| Weight tilt −1.5, then +2 | Fine texture everywhere inside small lobes, then a few large flat plateaus. |
| Start Disc, Start noise 0, Symmetry Eight-fold, Steps 150 | A concentric, eight-fold medallion whose rings belong to different scales. |
| Symmetry Both mirrors, Symmetry tiles 2, Start Spots | Four symmetric motifs whose neighbouring scales still interact across the borders. |
| Boundary Void, Start Spots | A frame of one scale around motifs grown from the spots. |
| Scales 6, Scale ratio 1.6, Resolution 120, Steps 200 | Six levels of nesting; every colour appears at every size. |
| Bands off, Contours on, Levels 7, Contour color By scale | A delicate topographic drawing whose line colour records which scale shaped it. |
| Bands off, Contours off, Marks on | Large dots in the coarse lobes and fine dots along the small ridges, a texture that follows the field. |

## As functions

```js
import { patternSnapshots, patternView, patternContours, patternSites, patternBands, patternCompetingFields,
  patternFrame, patternScaleTone, strokeWith, atEach, pathMaterial, motif, createCompositionRun }
  from "@procedurals/instruments";

const model = { resolution: 96, scales: 4, smallest: 3, ratio: 1.7, inhibitor: 2, increment: 0.03, tilt: -0.5,
  boundary: "wrap", symmetry: "none", tiles: 1, start: "noise", startSize: 0.5, startCount: 8, noise: 0 };
const snaps = patternSnapshots(model, 42, 120);   // cached by (model, seed, steps); a longer run extends a shorter one
const view = patternView(snaps);                  // values in [-1, 1], dominant scale per cell, shares, activity, inert
const competing = patternCompetingFields(snaps);  // per scale: the activator-minus-inhibitor field that chose the labels

const frame = patternFrame(320, 320, 520);        // where the square grid sits on the canvas
const lines = patternContours(snaps, frame, { levels: [-0.3, 0, 0.3], minLength: 6 });   // frozen Paths carrying `scale`
const sites = patternSites(snaps, frame, { level: 0.3, size: 16, gap: 1 });               // frozen Sites carrying `scaleIndex`, `value`, `angle`
const bands = patternBands(snaps, frame, { level: 0, smoothing: 1, minArea: 4 });         // [{ scale, domain }] planar domains with holes

const run = createCompositionRun();
strokeWith(p, lines, pathMaterial({ kind: "ink", weight: 1, spacing: 8, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, [0x1c2430]), run);
atEach(p, sites, motif({ kind: "rings", size: 16, petals: 6, opening: 0.3, weight: 1, rotation: 0, variation: 0, retention: 1 }, [0x1c2430, 0xb8452f]), run);
```

Every value is frozen and cached on its snapshot, so a second consumer of the same field costs nothing. Sites carry the
level line's direction as `angle` and a scale-proportional `scale`, so they feed any mark, a stitching pass or a height
map; the bands are ordinary planar domains for the region fillers. `preparePatternSnapshots` runs the model in time slices
and can be cancelled without publishing anything. The instrument stores only a technique, scalar settings and a palette;
binding your own start field (a mask or an image) is future host work, not something this study reads.

## Limits

Resolution 24–192 cells per side, 2–8 scales, at most 2,000 steps, and a total work bound of 1.5 billion cell reads (about three
seconds on the review machine): at the widest settings that is about 300 steps, and the message names Steps, Resolution or Scales.
An inhibitor radius over twice the grid is refused. A single contour piece over 2,200 segments is refused with the control
to change. Slider ranges are narrower than these limits: steps to 400, resolution 48–120 in twelves (so tiles 1–4 all divide it),
scales 2–6.
