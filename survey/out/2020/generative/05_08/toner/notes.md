---
sketch: 2020/generative/05_08/toner
year: 2020
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1604
animated: false
techniques: [grid, blend-modes]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#C49CD9", "#FFD12B", "#EB4DB6", "#08DAFF", "#06338F"]
  selection: random-from-list
composition: centered
parameters:
  - {name: count, default: 100, tried: [30, 300], change: moderate, effect: "30 = sparse, separated spikes; 300 = dense mass covering the whole canvas"}
  - {name: sep, default: 9, tried: [3], change: large, effect: "coarser snap grid (3x3 cells) -> far larger, chunkier straight-edged facets"}
  - {name: pull_min, default: 0.2, tried: [0.6], change: moderate, effect: "higher min pull -> tighter cluster around center, fewer edge-reaching spikes"}
  - {name: alpha, default: "random(255)", tried: [40], change: moderate, effect: "fixed low alpha -> washed-out pale version, background dominates"}
reusable_candidates:
  - {name: focalGridShapes, signature: "focalGridShapes(count, cellSize, pullMin, pullMax, palette, alphaMax)", note: "random n-gons with vertices lerped toward a focal point and snapped to a grid, alpha-blended fills"}
  - {name: randomPaletteFill, signature: "randomPaletteFill(colors[], alphaMax) -> color", note: "random pick from a color list with random alpha"}
---

## What it draws
A bright cyan background (a random palette pick) with a centered starburst of roughly
one hundred sharp, elongated, translucent triangles in magenta, yellow, blue and lavender.
The spikes radiate from a dense central knot toward the edges, with straight axis-aligned
edges (vertices snap to a 9x9 grid). Overlapping translucent fills create darker faceted
patches where several shapes intersect.

## How the code works
`setup()` calls `generate()` once (toner.pde:21); `draw()` is empty (29-30), so the sketch
is static. The harness injects `seed := 42` into the `int seed` field (line 4);
`noiseSeed`/`randomSeed` are set at 42-43.

- `background(rcol())` (45): background is a random palette color (here cyan).
- Grid: `sep = 9` (47), cell `ss = width/9 ~ 106px` (48). Every vertex is snapped with
  `xx -= xx%ss` / `yy -= yy%ss` (56-57) — this is what gives all edges a straight,
  grid-aligned look.
- 100 shapes (51), each a 4-vertex polygon (52-61). Each vertex is
  `lerp(random(-ss, width+2ss), center, random(random(0.2), 1))` (54-55): a uniform
  random point over the canvas extended by 2 cells, pulled 20-100% toward the center.
  The random pull amount is what produces the spiky star: some vertices land near the
  center, some stay far out.
- `noStroke()` (50); `fill(rcol(), random(255))` is applied only at even vertex indices
  (58), so the fill can change mid-shape — Processing triangulates the quad and the two
  resulting triangles get different colors, producing the faceted look.
- Randomness enters through `random()` for the point, pull factor, color and alpha;
  `noiseSeed` is set but no noise is actually sampled.
- Palette: 6 colors at line 76; `rcol()` (80-82) picks uniformly at random.
  `getColor`/`lerpColor` (84-93) exist but are never called. The `triangulate` and
  `toxi SimplexNoise` imports (1-2) are unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_30 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 30; i++) {` | moderate | sparser: fewer, clearly separated spikes, more cyan background visible | variants/count_30/frame_00001.png |
| count_300 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 300; i++) {` | moderate | denser: shapes cover the whole canvas, background barely visible, central knot more saturated | variants/count_300/frame_00001.png |
| sep_3 | `int sep = 9;` -> `int sep = 3;` | large | much bigger, chunkier straight-edged triangles; 3x3 snap grid makes a few giant facets fill the frame | variants/sep_3/frame_00001.png |
| bias_0.6 | `random(random(0.2), 1)` -> `random(random(0.6), 1)` in both lerp lines | moderate | cluster pulled tighter around the center, fewer spikes reaching the edges | variants/bias_0.6/frame_00001.png |
| alpha_40 | `fill(rcol(), random(255));` -> `fill(rcol(), 40);` | moderate | washed out: all fills pale, background cyan dominates, overlaps barely darker | variants/alpha_40/frame_00001.png |

## Modularisation notes
Generic, reusable core: the focal-grid shape generator — given a count, grid cell size,
pull range, palette and alpha range, scatter n-gons whose vertices are lerped toward a
focal point and snapped to the grid, with per-vertex random palette fills. That is the
whole visual mechanism of the sketch and needs no Processing-specific knowledge beyond
`beginShape`/`vertex`.

One-off art decisions: the specific 6-color palette (line 76), the 4-vertex quad shape
(the faceted mid-shape fill change at even vertices is an incidental quirk that works
here), the extended random range `[-ss, width+2ss]`, and the fixed 960px size.

A clean parameter object: `{count, cellSize (or sep), pullMin, pullMax, palette, alphaMax,
focalPoint, verticesPerShape, extendedMargin}` — with `focalPoint` generalized from the
hard-coded `width*0.5, height*0.5` and `extendedMargin` from the hard-coded `2` cells.
