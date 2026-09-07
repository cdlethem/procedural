---
sketch: 2018/Generativos/paper
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1893
animated: false
techniques: [grid, subdivision]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#F00050", "#FF4E02", "#F9E702", "#028DF9", "#1629C6"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: c, default: 5400, tried: [1000, 16000], change: large, effect: "1000 = sparse, large flat background regions emerge; 16000 = denser, background nearly fully covered"}
  - {name: colors, default: "F00050,FF4E02,F9E702,028DF9,1629C6", tried: ["010187,0A49FF,FF854E,FFCAE3,FFFFFF"], change: large, effect: "identical layout, colors become indigo/bright-blue/salmon/light-pink/white (lighter, cooler piece)"}
  - {name: sizeExponent, default: "random(random(1, 8), 8)", tried: ["random(random(1, 4), 4)"], change: large, effect: "exponents 1-3 only -> almost exclusively huge half/quarter-canvas shapes, small-dot layer mostly gone"}
  - {name: motifCount, default: 4, tried: [1], change: large, effect: "rnd always 0 -> circles/pie-slices only; squares, triangles, diamonds disappear"}
  - {name: ringAlpha, default: 10, tried: [120], change: subtle, effect: "previously invisible black rings around circles become faintly visible dark outlines"}
reusable_candidates:
  - {name: hierarchicalSize, signature: "hierarchicalSize(width, minExp, maxExp) -> float", note: "cell size = width / 2^k with k sampled to skew toward small cells"}
  - {name: snapToCellCenter, signature: "snapToCellCenter(pos, cell) -> float", note: "snap a random coordinate to the center of its power-of-2 grid cell"}
  - {name: ringArc, signature: "ringArc(x, y, r1, r2, col, a1, a2, alphaIn, alphaOut) -> void", note: "annular sector ring built from per-segment quads with per-vertex alpha (arc2)"}
---

## What it draws
A full-bleed flat collage of crisp geometric shapes in five saturated colors (magenta-red,
orange, yellow, sky blue, deep blue). A few huge triangles and diamonds (rotated squares)
dominate the canvas; medium squares and circles sit on top of them; tiny dots and small
squares are scattered everywhere, giving the piece a hierarchical, self-similar scale
distribution from near-full-canvas shapes down to a few pixels. A couple of faint dark
ring outlines are barely visible around some circles. No strokes, no gradients, no
overlap transparency beyond the near-invisible rings.

## How the code works
- `setup()` (paper.pde:3-8) sets `size(960, 960, P2D)` and calls `generate()` once;
  `draw()` (lines 10-11) is empty, so the piece is static. `keyPressed` re-rolls the seed.
- `generate()` (lines 21-87) calls `randomSeed(seed)`, then paints a background as one
  4-vertex shape with two fills (lines 24-31): the fill changes mid-shape, so the
  background comes out as two differently-colored triangles (in the baseline, deep blue
  upper-left, magenta to the right).
- Main loop, lines 34-86: `c = 5400` motifs. For each: random position (36-37); size
  `ss = width / 2^k` with `k = floor(random(random(1, 8), 8))` in 1..7 (line 38) — the
  double `random` skews k toward the top of the range, so most motifs are small and a
  few are huge; the position is snapped to the cell and centered (lines 40-44), which is
  what makes the sizes align on a power-of-2 grid and produces the self-similar look.
- `rnd = int(random(4))` (line 46) picks one of four motifs, each painted in a uniform
  random palette color from `rcol()` (lines 117-119, palette at line 114):
  - `rnd==0` (48-56): circle + pie-slice arc (`PI*0.25..PI*1.25`, line 52), plus two
    `arc2` rings: a black ring at alpha 10 (line 54) and a colored ring at alpha 20
    (line 55) — both nearly invisible, the faint dark rings seen in the image.
  - `rnd==1` (57-62): square + right triangle.
  - `rnd==2` (64-75): square + two triangles forming a diamond split down the middle.
  - `rnd==3` (76-85): plain diamond (4-vertex shape, CLOSE).
- `arc2` (94-112) draws an annular sector as many small quads, each with per-vertex
  alpha; segment count scales with radius and angle span.
- No noise, no blend modes, no transforms other than the implicit centering; plain
  source-over compositing, so later motifs simply overpaint earlier ones.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| c_1000 | `  int c = 5400;` -> `  int c = 1000;` | large | clearly sparser: large flat background regions and big shapes are no longer covered; same hierarchical scale, much lower density | variants/c_1000/frame_00001.png |
| c_16000 | `  int c = 5400;` -> `  int c = 16000;` | large | denser: more small motifs scattered over the big shapes, background nearly fully covered; busy top-left of small dots/diamonds | variants/c_16000/frame_00001.png |
| palette_cool | palette line 114 -> `#010187, #0A49FF, #FF854E, #FFCAE3, #FFFFFF` | large | layout pixel-for-pixel the baseline (per-color pixel counts match), only colors change: indigo, bright blue, salmon, light pink, white — much lighter, cooler, softer-looking piece | variants/palette_cool/frame_00001.png |
| sizes_1to4 | `random(random(1, 8), 8)` -> `random(random(1, 4), 4)` | large | exponent restricted to 1-3: almost exclusively huge half/quarter-canvas shapes that fill the frame; the small-dot layer is mostly gone, a few tiny specks remain | variants/sizes_1to4/frame_00001.png |
| rnd_1 | `    int rnd = int(random(4));` -> `    int rnd = int(random(1));` | large | rnd always 0: circles and pie-sliced circles only — no squares, triangles or diamonds anywhere; composition reads as overlapping circles | variants/rnd_1/frame_00001.png |
| alpha_120 | `color(0), 10, 0` -> `color(0), 120, 0` | subtle | the black rings around circles (previously invisible at alpha 10) now show as faint translucent dark outlines; rest of the layout identical | variants/alpha_120/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: the power-of-2 hierarchical size + snap-to-cell-center pair
  (lines 38-44) is a reusable "self-similar scale field" — given a canvas size and an
  exponent range it yields positions and sizes on a nested grid. `ringArc` (arc2) is a
  generic annular-sector primitive. `rcol` is just a uniform palette sampler.
- One-off art decisions: the four-motif set (circle/pie, square+triangle,
  square+double-triangle, diamond), the 5-color palette, the two-fill background trick,
  the motif weights (equal 1/4), and the near-invisible ring alphas.
- Clean parameter object: `{canvas, count, expMin, expMax, palette, motifWeights,
  ringAlphaIn, ringAlphaOut}` — everything else is fixed geometry.
- Experiments confirm the levers that matter: `count` (density), `expMin/expMax`
  (scale distribution), the motif set/weights (shape vocabulary), and the palette
  (whole look) each move the piece strongly; the ring alpha is a near-invisible detail.
