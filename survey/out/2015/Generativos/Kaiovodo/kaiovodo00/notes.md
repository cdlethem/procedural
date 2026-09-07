---
sketch: 2015/Generativos/Kaiovodo/kaiovodo00
year: 2015
renderer: JAVA2D
size: [3508, 3508]
libraries: []
deterministic: true
ms_first_frame: 6043
animated: false
techniques: [noise-field, flow-field, grid, dots-stippling, lines-hatching, curves]
primitives: [point, line, shape, rect]
palette:
  colors: ["#FFFFFF", "#000000"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: hexS, default: 60, tried: [120], change: none, effect: "no visible change; hex lattice is too faint at this canvas size for doubled cell size to register"}
  - {name: hexDef, default: 5, tried: [20], change: none, effect: "no visible change; 4x noise displacement of the faint lattice is not perceptible"}
  - {name: hatchCount, default: 2000000, tried: [400000], change: large, effect: "much lighter grain: the dense stipple field in the top-right thins to a sparse speckle and the wavy flow strokes underneath become clearly visible"}
  - {name: hatchDet, default: 0.006, tried: [0.03], change: moderate, effect: "flow field 5x more detailed: strokes curl into small chaotic eddies instead of broad smooth drifts; top-right speckle gets coarser"}
  - {name: crossCount, default: 60000, tried: [200000], change: subtle, effect: "subtle: slightly denser scatter of small stars/circles along the diagonal band, hard to distinguish from the circles layer"}
  - {name: circleSize, default: 80, tried: [160], change: moderate, effect: "wobbly circles up to 2x bigger, clearly more prominent, covering a larger fraction of the sheet"}
reusable_candidates:
  - {name: hexNoiseLattice, signature: "hexNoiseLattice(cellSize, displace, detail) -> grid of displaced points + connecting lines", note: "triangular/hex dot lattice with per-point Perlin displacement (block 1)"}
  - {name: flowHatch, signature: "flowHatch(count, detail, maxLength) -> void", note: "dense field of short strokes aligned to a noise flow (block 2)"}
  - {name: starCross, signature: "starCross(x, y, size, angle, sharpness) -> void", note: "4-pointed star polygon with alternating outer/inner radii (cross())"}
  - {name: wobblyCircle, signature: "wobblyCircle(x, y, diameter, segments, jitter) -> void", note: "bezier circle with random per-vertex jitter (circle())"}
---

## What it draws
Large square monochrome print (3508x3508). A faint hexagonal dot lattice of small grey dots with thin connecting
lines sits mostly in the left and central band, warped by noise into soft diagonal drifts. A very dense field of
tiny black strokes (flow-aligned) covers the whole sheet, reading as a fine grainy texture that is heaviest in the
top-right, where it looks like white stippling over dark. Scattered over the left/centre are small 4-pointed
star/cross shapes and wobbly hand-drawn circles, many of them with an X cross inside. A clean white frame
(~80 px) borders all four edges. Dominant colours: white, light grey, black.

## How the code works
`setup()` sets a 3508x3508 JAVA2D canvas (line 6). `draw()` seeds RNG and Perlin with `seed` (42 via harness;
line 3, 10-11), paints white (line 13), then runs four layered passes:

1. **Hex lattice** (lines 19-42): hexagonal grid with cell `s = 60`, row height `sqrt(3)*s/2`, points offset by
   `s*def`/`h*def` of Perlin displacement (`def = 5`, `det = 0.05`). Each point draws a 5 px dot
   (`fill(0, 180)`) and faint `stroke(0, 40)` lines to its right and to one of the two points on the next row
   (alternating by row parity), forming the triangular mesh (lines 34-39).
2. **Flow hatching** (lines 44-54): 2,000,000 random points; each draws a line whose direction is
   `noise(x*0.006, y*0.006) * TWO_PI` and length `map(n, 0, 1, 0, 32)`. This is the dense grainy texture.
3. **Star crosses** (lines 57-71): 60,000 random points, kept only where `x - y + n*110 >= 0` (a diagonal
   band); each draws a 4-pointed star `cross()` of size `n*40` rotated by `n*TWO_PI`, size tapering to zero near
   the band edge via `sin(map(dif, 0, 800, 0.1, PI/2))`.
4. **Wobbly circles** (lines 73-88): 10,000 random points, radius `noise(...)*80-40` (kept if > 0); draws a
   5-segment bezier circle with per-vertex jitter (`circle()`) plus a small X of two lines.

Finally a white frame of `bb = 80` is painted over the four edges (lines 118-123). All colour is black at various
alphas over white — no palette choice, fixed greyscale.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| hexS_120 | `float s = 60;` -> `float s = 120;` | none | no visible change (lattice too faint to register at 3508 px) | variants/hexS_120/frame_00001.png |
| hexDef_20 | `float def = 5;` -> `float def = 20;` | none | no visible change | variants/hexDef_20/frame_00001.png |
| hatchCount_400000 | `i < 2000000;` -> `i < 400000;` | large | grain field thins dramatically; wavy flow strokes emerge, top-right stipple becomes sparse | variants/hatchCount_400000/frame_00001.png |
| hatchDet_0.03 | `float det = 0.006;` -> `float det = 0.03;` | moderate | strokes curl into small chaotic eddies; broad drifts become fine turbulence | variants/hatchDet_0.03/frame_00001.png |
| crossCount_200000 | `i < 60000;` -> `i < 200000;` | subtle | slightly denser stars/circles along the diagonal band; near baseline at a glance | variants/crossCount_200000/frame_00001.png |
| circleSize_160 | `noise(x*det, y*det)*80-40;` -> `noise(x*det, y*det)*160-40;` | moderate | circles up to 2x larger and clearly more prominent across the sheet | variants/circleSize_160/frame_00001.png |

## Modularisation notes
- `circle(x,y,d,sec)` (lines 128-150) and `cross(x,y,d,a,s)` (lines 152-170) are self-contained drawing
  primitives with sensible parameters — clean library candidates (jittery bezier circle; 4-point star).
- Block 1 (hex lattice + displacement) is a generic `hexNoiseLattice`; `def` and `det` are the knobs.
- Block 2 (flow hatching) is the core reusable generator: `count`, `detail`, max length, and optionally a
  region mask.
- Blocks 3-4 are one-off art decisions: the `x - y + n*110` band mask and the tapering are specific to this
  composition, but the "stamp N noise-driven motifs into a region" pattern is reusable.
- A clean parameter object would be: `{size, hexS, hexDisplace, hexDetail, hatchCount, hatchDetail, hatchLength,
  starCount, starSize, starBand, circleCount, circleSize, borderWidth}`.
- The commented-out blocks (lines 89-116: a 3x3 rounded-rect tiling and a blob-with-dots motif) are discarded
  earlier variants, not part of the output.
