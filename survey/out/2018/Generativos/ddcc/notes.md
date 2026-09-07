---
sketch: 2018/Generativos/ddcc
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1946
animated: false
techniques: [grid, packing]
primitives: [rect, shape]
palette:
  colors: ["#FFFCF7", "#FDDA02", "#EE78AC", "#3155A3", "#028B88"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: "int(random(5000))", tried: ["int(random(1000))"], change: large, effect: "much sparser: fewer, bigger flat blocks; spheres and checkerboards read clearly; white shows through"}
  - {name: sizeExponent, default: "random(1,7)", tried: ["random(1,4)"], change: large, effect: "only sizes 960/480/240: huge flat color blocks dominate, small motifs (checkers, outlined squares) become sparse accents"}
  - {name: sphereInnerAlpha, default: 220, tried: [60], change: subtle, effect: "subtle: spheres much fainter, soft tinted wash instead of glossy orbs; flat squares dominate"}
  - {name: subgridCells, default: "int(random(2,7))", tried: ["int(random(2,10))"], change: large, effect: "checkerboards up to 10x10: many extra fine speckle clusters, surface reads busier/grainier"}
  - {name: strokeWeight, default: "random(1,4)", tried: ["random(2,8)"], change: none, effect: "no visible change (thin outlines of 1/6 of shapes, lost under overpainting)"}
reusable_candidates:
  - {name: arcGradient, signature: "arcGradient(x, y, r1, r2, a1, a2, col, alphaOuter, alphaInner)", note: "circular gradient built from many thin quads (lines 92-110)"}
  - {name: extrudedRect, signature: "extrudedRect(x, y, w, h, bevel, col, aFront, aEdge)", note: "fake 3-D bevel via 4 corner quads (lines 112-150)"}
  - {name: snapToCell, signature: "snap(v, cell) -> float", note: "v - v%cell; aligns shape origin to its own size grid (lines 46-47)"}
---

## What it draws
A dense, full-bleed mosaic on white: flat squares in many sizes (from huge canvas-spanning blocks down to tiny specks) in cream, yellow, pink, navy and teal, scattered over each other. Mixed in are translucent gradient spheres that read as glossy orbs (dark rim fading to a lighter center), squares with a fake 3-D bevel on the top-left, thin-outlined squares with a small filled corner, and small 2-to-6 cell checkerboard subgrids. The whole surface is busy and evenly covered, with the translucent spheres creating the main sense of depth.

## How the code works
`setup()` sizes the window 960x960 P2D, sets the seed, and calls `generate()` once; `draw()` is empty so the piece is static (ddcc.pde:3-11).

`generate()` (lines 21-85):
- Fills a full-canvas quad with a random palette color at alpha 10 (lines 27-34) — a near-invisible tint wash.
- Picks a count `c` in [0, 5000) (line 37) and loops.
- Each iteration draws one shape of size `ss = width / 2^e` where `e` is random in [1,7) (line 42), so sizes are dyadic fractions of the width: 960, 480, 240, ..., 15 px. The position is random, then snapped so the shape aligns to its own size grid: `xx -= xx%ss` (lines 46-47).
- A random `rnd` in {0,1,2} selects the motif:
  - `rnd==0` (lines 51-55): two `arc2` calls — a big soft dark disc (radius 0.8*ss, black, alpha 10 outer to 0 inner) plus a smaller disc (radius 0.2*ss, random color, alpha 220 to 0) — together they read as a gradient sphere.
  - `rnd==1` (lines 56-71): 50% filled square + `srect` bevel (fake 3-D edge, alpha 80); otherwise a stroked square (weight 1-4, random color) plus a small filled corner square.
  - `rnd==2` (lines 73-83): a `cc x cc` grid (`cc` random 2-6) of small filled squares with 20% gaps — the checkerboard subgrids.
- Color is always `rcol()`, a uniform random pick from the 5-color array (lines 152-156). No noise, no lerp; the only gradients are the alpha ramps in `arc2` (lines 92-110: each ring quad has two fills, outer angle at `alp1`, inner at `alp2`, sweeping the whole circle in ~2*PI*r/seg steps).
- Depth comes purely from draw order: later shapes overpaint earlier ones, and the low-alpha spheres let underlying squares show through.

Randomness enters only via `randomSeed(seed)` (line 25); with a fixed seed the composition is fully deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_1000 | `int c = int(random(5000));` -> `int c = int(random(1000));` | large | sparser mosaic: fewer, larger flat squares and clearly visible gradient spheres, white background showing between shapes | variants/count_1000/frame_00001.png |
| sizeexp_4 | `random(random(1, 7), 7)` -> `random(random(1, 4), 4)` (line 42) | large | only 960/480/240 px squares: big flat yellow/pink/teal/navy blocks dominate; checkers and outlined squares reduced to small accents | variants/sizeexp_4/frame_00001.png |
| sphereAlpha_60 | `arc2(xx, yy, ss, ss*0.4, 0, TAU, rcol(), 220, 0);` -> `..., 60, 0);` | subtle | subtle: spheres are a faint soft tint instead of glossy orbs; square mosaic unchanged | variants/sphereAlpha_60/frame_00001.png |
| subgrid_10 | `int cc = int(random(2, 7));` -> `int cc = int(random(2, 10));` | large | many finer checkerboards (up to 10x10 cells) add grainy speckle clusters across the surface | variants/subgrid_10/frame_00001.png |
| stroke_8 | `float sstr = random(1, 4);` -> `random(2, 8);` | none | no visible change | variants/stroke_8/frame_00001.png |

## Modularisation notes
- `arc2` (lines 92-110) is a generic radial-gradient disc builder: parameterized by two radii, angle span, color and two alpha values; works for full circles and could be exposed as a library primitive (the "sphere" is just two overlapping calls).
- `srect` (lines 112-150) is a generic bevel/extrusion effect: 4 corner quads with a front color alpha and edge alpha; independent of the motif logic.
- The size scheme (dyadic width fractions) and self-snap (`v - v%cell`) is a small reusable "grid alignment" utility.
- One-off art decisions: the 5-color palette, the 0/1/2 motif mix, the fixed alpha values (10, 220, 80), and the count range.
- A clean parameter object: `{count, sizeExponentRange: [1,7], sphereAlphaInner, bevelAlpha, subgridMax, strokeWeightRange, palette}`.
