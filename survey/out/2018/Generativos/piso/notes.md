---
sketch: 2018/Generativos/piso
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1769
animated: false
techniques: [grid, polar, noise-field, particles]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#FFFFFF", "#011731", "#A12677", "#EE3C7A", "#EE2D30", "#EC4532", "#FFCA2A", "#3DB98A", "#16A5DF"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: cc, default: "random(3,8)", tried: [8], change: large, effect: "denser 8-column grid, smaller cells and smaller crowded roscas; also re-rolls the downstream random stream (div, all rcol picks)"}
  - {name: div, default: "random(8,17)", tried: [20], change: large, effect: "finer, more numerous black/white spokes on every pinwheel; downstream colours re-rolled (stream shift)"}
  - {name: scratchCount, default: 10000, tried: [2000], change: large, effect: "scratch arcs themselves are invisible (drawn under the opaque tiling); the visible difference is the re-rolled random stream (grid count, checkerboard and motif colours)"}
  - {name: amp1, default: "random(0.7,0.95)", tried: [1.2], change: large, effect: "centre roscas noticeably larger, overlapping and covering most of each cell; replacing random() with a constant also re-rolls the downstream stream"}
  - {name: scratchMaxSize, default: "width*random(0.015)", tried: ["width*random(0.06)"], change: none, effect: "no visible change: the scratch layer is painted before the opaque full-bleed checkerboard and is completely hidden; same random stream, so the rest is pixel-identical"}
reusable_candidates:
  - {name: rosca, signature: "rosca(x, y, size, spokes, c1, c2, c3)", note: "radial pinwheel motif: alternating black/white spokes, concentric ellipses, one noise-rotated half-arc"}
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, color, shd1, shd2)", note: "ring segment built from many tiny quads with two alpha values (shadow ring)"}
  - {name: scatterArcs, signature: "scatterArcs(count, maxRelSize, alpha)", note: "uniform random small arcs with low-alpha strokes over the canvas"}
---

## What it draws
Full-bleed checkerboard of mustard-yellow and magenta squares (about a 6x6 grid of
large cells). Each cell centre carries a circular "rosca" motif: a ring of radial
black/white spokes around a yellow disc, with coloured half-ring accents and a small
white centre dot. Smaller roscas sit at the cell corners; the fine black/white
dashes ringing each motif are its spokes. Dominant colours are mustard yellow,
magenta/pink, with red, blue, teal and white accents.

## How the code works
`setup()` (piso.pde:2-7) opens a 960x960 P2D canvas and calls `generate()` once;
`draw()` is empty, so the piece is static (keyPressed regenerates with a new seed).

`generate()` (piso.pde:23-92):
1. Picks three distinct palette colours `c1, c2, c3` via `rcol()` (lines 24-28) and
   fills the background with `c1` darkened 20% (line 29).
2. Scatters 10,000 tiny arcs (lines 35-44): uniform random position, diameter up to
   `width*0.015`, random start angle plus a 0-90 deg sweep, stroke = random palette
   colour at alpha 40. NOTE: this layer is drawn before the opaque full-bleed
   checkerboard (cells i,j = -1..cc-1 exactly cover [0,width]x[0,height]), so it is
   never visible in the render — confirmed by the arcSize variant scoring `none`.
3. Chooses grid count `cc = random(3,8)` and cell size `ss = width/cc` (lines 47-48);
   the loop runs `j,i` from -1 to cc-1 (lines 56-80) so the (cc+1)^2 cells tile the
   whole canvas with margins. Each cell gets:
   - a checkerboard fill `c1`/`c3` by parity of (i+j) (lines 60-63),
   - a shadow ring via `arc2` (line 64),
   - four half-circle arcs at the cell edges/corners in the opposite colour
     (lines 65-70),
   - two overlapping translucent rects and an ellipse in random palette colours at
     alphas 40/16/12/8 (lines 71-78) — these produce the soft colour mottling.
4. `noiseDetail(1)` (line 82), then draws one large `rosca` per cell centre
   (size `ss*amp1`, `amp1 in 0.7-0.95`) and one small `rosca` at each cell corner
   (size `ss*amp2`), lines 84-91.

`rosca()` (piso.pde:94-127) is the motif: translates to the centre, draws a shadow
ring (`arc2`, line 101), then for `div` iterations (lines 102-112) rotates by
`TWO_PI/div` and draws alternating black/white spoke rects plus a `c2` rect — the
pinwheel. On top: `c2` ellipse (ss*0.6), `c3` ellipse (ss*0.5), a shadow arc2, a
half-arc whose rotation angle comes from 2-D Perlin noise
(`noise(des+xx*det, des+yy*det)*TAU`, lines 118-120), an inner `c1` disc, a dark
shadow ring, and a small white dot (lines 121-125). A per-motif `inv` boolean
(line 98) flips the spoke colours.

`arc2()` (piso.pde:129-147) approximates a ring sector by tessellating it into
tiny quads (one per pixel of arc length) with two alpha values on the inner/outer
halves, giving a soft two-tone band.

Randomness enters via `random()` for positions, the 10,000 arcs, `cc`, `div`, the
amplitudes, all `rcol()` picks, the spoke inversion, and `random(999999)` for the
seed (line 1). Noise is used only for the half-arc orientation of each rosca.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_8 | `int cc = int(random(3, 8));` -> `int cc = 8;` | large (mean 0.3264, 0.824 of pixels) | denser 8-column grid: smaller checkerboard cells and smaller, more crowded roscas; motif colours also re-rolled (stream shift) | variants/cc_8/frame_00001.png |
| div_20 | `int div = int(random(8, 17));` -> `int div = 20;` | large (mean 0.198, 0.455 of pixels) | finer, more spokes on every pinwheel; grid and colours re-rolled (stream shift) | variants/div_20/frame_00001.png |
| arcs_2000 | `for (int i = 0; i < 10000; i++) {` -> `... i < 2000 ...` | large (mean 0.3322, 0.813 of pixels) | scratch layer itself invisible (covered by opaque tiling); visible difference is the re-rolled random stream: different grid count, checkerboard and motif colours | variants/arcs_2000/frame_00001.png |
| amp1_1.2 | `float amp1 = random(0.7, 0.95);` -> `float amp1 = 1.2;` | large (mean 0.3372, 0.808 of pixels) | centre roscas clearly larger, overlapping more and covering most of each cell; colours/grid re-rolled too (constant replaced a random draw) | variants/amp1_1.2/frame_00001.png |
| arcSize_0.06 | `float s = width*random(0.015);` -> `float s = width*random(0.06);` | none (mean 0.0, 0.0 of pixels) | no visible change: scratch arcs are painted before the opaque checkerboard and never show; identical random stream, rest pixel-identical | variants/arcSize_0.06/frame_00001.png |

## Modularisation notes
- `rosca` is a self-contained parameterised motif (position, size, spoke count,
  three palette colours) — a strong library candidate.
- `arc2` (tessellated two-tone ring sector) is generic and reusable for any
  shadowed ring.
- The 10,000-arc "scatter" is dead weight in the default draw order: it is painted
  before the opaque full-bleed tiling and never visible (see arcSize variant). If
  kept as a library function it must be drawn after the tiling to matter.
- The checkerboard cell loop (fill + corner arcs + translucent overlays) is the
  art-specific tiling; a clean parameter object would be
  `{cellCount, cellColors, amp1, amp2, div, scratchCount, scratchMaxSize, alpha, palette}`.
- The commented-out palette blocks (lines 154-159) show the intended interface:
  swap `colors[]` to reskin the whole piece.
