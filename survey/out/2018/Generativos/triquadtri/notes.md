---
sketch: 2018/Generativos/triquadtri
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1643
animated: false
techniques: [subdivision]
primitives: [shape]
palette:
  colors: ["#18171C", "#BEBAB6", "#FE0302", "#FDC200", "#0124B8", "#0050FF", "#058B51", "#000000", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(10000*random(1))", tried: [500, 10000], change: large, effect: "fewer iterations = few large flat shapes with speckle only in corners; always-max = uniformly finer, busier mosaic"}
  - {name: minr, default: "random(1)", tried: [0.95], change: large, effect: "0.95 = near-uniform poly pick, subdivision spread evenly, large flat shapes mostly broken up"}
  - {name: washMax, default: 0.2, tried: [0.6], change: moderate, effect: "same layout; colours washed toward black/white up to 60%, yellow -> olive, red -> dusty salmon, strong per-vertex faceting on big shapes"}
  - {name: comBlackProb, default: 0.5, tried: [0.85], change: subtle, effect: "same layout; slight overall darkening/muting, no visible change at a glance"}
  - {name: palette, default: "12-entry weighted gray/black/red/yellow/blue/green", tried: ["4-colour alt {#52F3FF, #000308, #FD6B01, #084E8B}"], change: large, effect: "same layout in cyan / near-black / orange / dark blue"}
reusable_candidates:
  - {name: randomSubdivision, signature: "randomSubdivision(polys, iterations, indexBias) -> List<Poly>", note: "repeatedly pick a random poly (bias toward list start) and split: quad -> 4 quads | 4 corner tris | 4 edge tris + center quad; tri -> 2 corner tris + center quad"}
  - {name: washFill, signature: "washFill(paletteColor, target, maxLerp) -> color", note: "lerp a palette color toward black or white by up to maxLerp, applied per-vertex for subtle intra-shape gradients"}
---

## What it draws
Full-bleed mosaic of flat, sharp-edged quads and triangles covering the whole canvas, no strokes.
Large soft shapes dominate the middle: a big yellow quadrant top-left, a large pale-gray diamond, a
large near-black diamond, and a saturated blue triangle bottom-center. Red, green and yellow accents
are scattered as mid-size fragments, and the bottom-left and top-right corners are subdivided down to a
fine, pixel-like speckle of tiny multicolour triangles. Some of the big shapes show a faint tonal
gradient (e.g. the gray diamond is slightly lighter in places) rather than being perfectly flat.

## How the code works
- `setup()` (triquadtri.pde:3-8): `size(960, 960, P2D)`, `smooth(8)`, `pixelDensity(2)` (not available
  on the survey display, see stderr warning), then a single `generate()`; `draw()` is empty, so the
  image is static (frames 10/60 dropped as identical to frame 1).
- `generate()` (160-181): black `background(0)`, `randomSeed(seed)`, starts with one `Poly` rectangle
  covering the whole canvas (166). Iteration count `cc = int(random(10000*random(1)))` (169) — a
  product of two uniforms, mean ~2500, max 10000. Each iteration (170-173) picks
  `ind = int(random(polys.size()*random(minr, 1)))` with `minr = random(1)` (168): the upper bound is a
  random fraction of the list size, so picks are biased toward the START of the list, which holds the
  oldest (larger) polys; newly created children are always appended at the end. Then `polys.get(ind).sub()`.
- `Poly.sub()` (41-148): for a quad, `rnd = int(random(3))` chooses one of three splits:
  - rnd 0 (51-67): 4 quads, each from a corner's two edge midpoints, the corner, and the centroid.
  - rnd 1 (68-79): 4 triangles, each from two adjacent corners and the centroid.
  - rnd 2 (80-105): 4 triangles from each corner and its two edge midpoints, plus a 5th central quad
    from the four edge midpoints.
  For a triangle, the split is fixed (`int rnd = 1`, 112): two corner triangles (via the midpoint of
  the opposite edge) plus one central quad (125-144). The parent is removed (106/146), children added.
- Draw (175-180): `noStroke()`, each poly filled once with `rcol()` (random from the 12-entry palette
  189, weighted: light-gray ×4, near-black ×3, then red/yellow/two blues/green) and then
  `p.draw()` re-fills per vertex: each vertex gets `lerpColor(rcol(), com, random(0.2))` where `com`
  is black or white at 50/50 (31, 35-37). Processing applies per-vertex fills, so each shape carries a
  slightly different washed color per vertex — this produces the faint tonal variation on the big
  shapes. `background(0)` black also shows through nothing (canvas fully tiled).
- Randomness enters at: the seed (harness sets `seed := 42`), `cc`, `minr`, the per-iteration poly
  pick, the quad split choice `rnd`, and the per-vertex wash. No noise, no shaders, no blend modes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_500 | `  int cc = int(random(10000*random(1)));` -> `  int cc = int(random(500*random(1)));` | large (mean 0.3396, 0.715 of pixels) | far coarser: a few large flat shapes (big near-black diamond top-left, huge pale-gray quad centre, blue shapes right), mid-size fragments gone, fine speckle only in bottom-left corner | variants/cc_500/frame_00001.png |
| cc_10000 | `  int cc = int(random(10000*random(1)));` -> `  int cc = 10000;` | large (mean 0.3411, 0.818 of pixels) | uniformly finer: speckle regions spread across the canvas, big shapes (blue triangle top-left, black diagonal band, green diamond) survive but smaller, overall busier texture | variants/cc_10000/frame_00001.png |
| minr_0.95 | `  float minr = random(1);` -> `  float minr = 0.95;` | large (mean 0.3407, 0.821 of pixels) | near-uniform poly pick: subdivision spread evenly over the whole frame, baseline's large flat quadrant gone, only a few big shapes left (gray quad, black band, blue triangle, red quad) centre-right, fine mosaic everywhere else | variants/minr_0.95/frame_00001.png |
| wash_0.6 | `      fill(lerpColor(col, com, random(0.2)));` -> `      fill(lerpColor(col, com, random(0.6)));` | moderate (mean 0.0867, 0.367 of pixels) | identical layout; colours visibly washed: yellow -> olive gold, red -> dusty salmon, blue -> muted grey-blue; strong per-vertex gradients/faceting on the big gray and black shapes | variants/wash_0.6/frame_00001.png |
| com_0.85 | `      int com = (random(1) < 0.5)? color(0) : color(255);` -> `      int com = (random(1) < 0.85)? color(0) : color(255);` | subtle (mean 0.0364, 0.103 of pixels) | no visible change at a glance: same layout, colours only very slightly darker/muted on close look | variants/com_0.85/frame_00001.png |
| palette_alt | line 189 palette commented out, line 188 `{#52F3FF, #000308, #FD6B01, #084E8B}` activated | large (mean 0.4205, 0.864 of pixels) | same layout re-coloured with the 4-colour palette: cyan, near-black, orange, dark blue; corner speckle in the same positions | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic: the `Poly` subdivision step (`sub()` for quads and triangles) is a self-contained "random
  polygon refinement" operator: given a list of 3/4-vertex polys, pick one by biased index and replace
  it with 3-5 children. `randomSubdivision(polys, iterations, indexBias)` would cover the whole
  generate loop.
- Generic: the per-vertex wash fill (palette color lerped toward black/white by a random amount) is a
  small reusable `washFill` effect that explains the subtle non-flat shading.
- One-off art decisions: the exact 12-entry weighted palette; the `random(10000*random(1))` skewed
  iteration count; `minr = random(1)` (a fresh random bias per run); the forced `rnd = 1` on
  triangles (only one of the possible triangle splits is used); the 20% wash cap.
- Clean parameter object: `{seed, iterations (or its distribution), indexBias (minr), washMax (0.2),
  washTargets ([black, white]), palette (weighted list), canvasSize}`.
