---
sketch: 2017/Generativos/vapo
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 162
animated: false
techniques: [curves, lines-hatching]
primitives: [line, ellipse, rect, shape]
palette:
  colors: ["#f6dbc1", "#040401", "#009aaf", "#ff799f", "#ff1d39", "#f6c350", "#8f498d"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: waveLobes, default: "random(2,20)", tried: ["random(12,20)"], change: none, effect: "reshapes the wave boundary into a sharper S; confined to a thin band along the outline, so the score stays none"}
  - {name: waveAmp, default: "random(180)", tried: ["random(40)"], change: none, effect: "lower amplitude flattens the wave boundary slightly; only the band along the boundary changes"}
  - {name: sep, default: "random(4,60)", tried: ["random(20,40)"], change: none, effect: "upper-left hatching visibly sparser (wider line spacing); score low because lines are thin and semi-transparent"}
  - {name: count, default: "random(8,32)", tried: ["random(24,32)"], change: subtle, effect: "more scatter shapes, but the size scale is inversely tied to count so all shapes shrink slightly; net difference small"}
  - {name: shapeScale, default: "random(0.6,1)", tried: ["random(1,2)"], change: moderate, effect: "all scatter shapes ~1.5-2x larger (circles, squares, triangles, strokes); heavier, denser composition"}
  - {name: lineWeight, default: "random(0.095,0.12)", tried: ["random(0.3,0.5)"], change: subtle, effect: "line-type strokes (red squiggle, black zigzag, pink diagonal, red rect border) ~3x thicker; pixel metric low because strokes are thin"}
reusable_candidates:
  - {name: waveBand, signature: "waveBand(amp, lobes, smooth, fill, stroke) -> shape", note: "zigzag band split across the canvas, translated/rotated, filled with optional outline stroke"}
  - {name: hatchCorner, signature: "hatchCorner(sep, weight, alpha) -> void", note: "parallel diagonal lines from the corner, applied with 50% probability"}
  - {name: scatterShapes, signature: "scatterShapes(count, sizeRange, typeSet, palette) -> void", note: "8-31 random flat ellipses / rotated rects / triangles / wavy lines, colours picked avoiding the background"}
---

## What it draws
A flat, pop-art collage on a cream ground. A large yellow wavy band with a thin purple outline sweeps diagonally across the upper-left; over it run faint pale-cream diagonal hatching lines. Scattered over the whole canvas are flat solid shapes: big red, teal, purple and pink circles, rotated black/purple/pink squares, small triangles, and thick red and black straight and squiggly strokes. Dominant colours: cream, yellow, red; accents teal, purple, pink, near-black.

## How the code works
Single tab, `generate()` (vapo.pde:22-178) runs once from `setup()`; `draw()` is empty so the sketch is static.

- Background: one colour drawn from the 7-colour palette (lines 23-25, 180-184 `rcol()`).
- Hatching block, 50% chance (28-37): `sep` = random(4,60); parallel diagonal lines from the top-left corner (`line(-2,i, i,-2)`, line 34-36) with stroke weight `sep*0.5*random(1)` and alpha 120 or random — produces the faint corner hatch seen over the yellow area.
- Wave band, 80% chance (39-84): a filled `beginShape` polygon that zigzags across the canvas with amplitude `amp` = random(180) and an odd lobe count `cc` = random(2,20)*2+1, closing around the far corners (79-81) so it fills an entire half of the canvas. `curveVertex` smoothing 60% of the time (58, 72-74). Translated to a random point in the left/top half and rotated by random(TWO_PI) (63-64); fill is a palette colour different from the background, and 40% of the time an outline in a third colour (60-61). In the baseline this is the yellow band with the purple outline.
- Scatter (87-177): `c` = int(random(8,32)) shapes, each at a random position with size `s` scaled from canvas width (92, shrunk with more shapes via `map(c, 8, 32, 0.3, 0.18)`). Four types by `rnd` (99): filled ellipse (101-109); rotated filled rect, stroke in a second colour 50% of the time (110-122); random triangle (123-138); or a thick line that is straight when wobble `amp` < 0.04, else a wavy open stroke of 3-15 odd lobes (139-176). Colours always avoid the background and wave colours (94-97).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| waveLobes_12 | `int cc = int(random(2, 20))*2+1;` -> `int cc = int(random(12, 20))*2+1;` | none | subtle: the purple wave outline bends into a sharper S near the top-centre; the difference is confined to the thin boundary band, so the score reads none | variants/waveLobes_12/frame_00001.png |
| waveAmp_40 | `float amp = random(180);` -> `float amp = random(40);` | none | subtle: the wave boundary is slightly flatter/tighter; only the band along the boundary differs | variants/waveAmp_40/frame_00001.png |
| sep_20 | `float sep = random(4, 60);` -> `float sep = random(20, 40);` | none | subtle: the diagonal hatching in the yellow top-left corner is clearly sparser (fewer, wider-spaced lines); score stays low because the lines are thin and semi-transparent | variants/sep_20/frame_00001.png |
| count_24 | `int c = int(random(8, 32));` -> `int c = int(random(24, 32));` | subtle | same scatter composition; shapes slightly smaller because the size scale is inversely tied to count, plus a few extra small shapes appended | variants/count_24/frame_00001.png |
| shapeScale_1.0 | `float s = width*random(ms*0.25, ms*1.4)*random(0.6, 1);` -> `...*random(1, 2);` | moderate | all scatter shapes visibly ~1.5-2x larger (circles, squares, triangles, strokes); composition looks heavier and denser | variants/shapeScale_1.0/frame_00001.png |
| lineWeight_0.3 | `strokeWeight(s*random(0.095, 0.12));` -> `strokeWeight(s*random(0.3, 0.5));` | subtle | line-type strokes (red squiggle, black zigzag, pink diagonal, red rect border) ~3x thicker; pixel metric stays low because strokes are thin | variants/lineWeight_0.3/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: `waveBand` (the zigzag half-canvas band — parameters: amplitude, lobe count, smooth flag, fill/stroke colours, rotation, translation) and `hatchCorner` (parallel diagonal lines from a corner). `scatterShapes` is nearly generic: a set of flat primitive stamps (ellipse, rotated rect, triangle, wavy line) with a size distribution and a palette that excludes already-used colours.
- One-off art decisions: the exact 7-colour palette, the 50%/80% gating probabilities, the size-vs-count tradeoff `map(c, 8, 32, 0.3, 0.18)`, the alpha-120 hatch stroke.
- Clean parameter object: `{palette, background, hatch: {p, sep, weight, alpha}, wave: {p, amp, lobes, smooth, strokeP, pos, rot}, scatter: {count, sizeMin, sizeMax, types, wobble}}`.
