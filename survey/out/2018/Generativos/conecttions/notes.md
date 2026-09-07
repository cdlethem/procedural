---
sketch: 2018/Generativos/conecttions
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1462
animated: false
techniques: [voronoi-delaunay, dots-stippling, polar]
primitives: [line, ellipse, shape]
palette:
  colors: ["#FFFFFF", "#000000"]
  selection: random-from-list
composition: radial
parameters:
  - {name: iterations, default: 1000, tried: [2000], change: subtle, effect: "denser web, slightly larger outline, same radial structure"}
  - {name: seedBand, default: "random(0.4, 0.6)", tried: ["random(0.3, 0.7)"], change: moderate, effect: "web spreads wider over the canvas; larger outer facets"}
  - {name: triAlpha, default: "random(200)*random(0.2, 1)", tried: ["random(255)*random(0.5, 1)"], change: none, effect: "no visible change"}
  - {name: dotSize, default: 3, tried: [6], change: none, effect: "no visible change"}
  - {name: lineAlpha, default: 30, tried: [100], change: subtle, effect: "midpoint-to-vertex lines slightly more visible"}
  - {name: mergeDist, default: 0.2, tried: [2.0], change: none, effect: "pixel-identical output; no point pairs within 2 px"}
reusable_candidates:
  - {name: triangleWeb, signature: "triangleWeb(seedPoints, iterations, mergeDist) -> PVector[]", note: "grow a point web by repeatedly adding equilateral-triangle vertices between random pairs"}
  - {name: fadedTriangulation, signature: "fadedTriangulation(points, alpha) -> void", note: "Delaunay-triangulate points, fill each triangle with a per-vertex alpha gradient"}
---

## What it draws
A dense radial web of small white dots on a black background, centered in the canvas and
thickest in the middle, thinning toward a rough decagonal outline. Faint pale-gray
triangular facets (Delaunay triangulation of the point set) overlay the web with soft
gradient fills, and very thin faint lines connect midpoints to new vertices. Monochrome
white/gray only.

## How the code works
Single tab, `setup()` -> `generate()` (line 10), `draw()` is empty so the piece is static
(frames 10/60 identical to frame 1).

- Line 26-27: `randomSeed(seed)` (harness injects seed 42 into the `seed` field, line 3), black background.
- Lines 29-32: two seed points placed randomly within a central square band `random(0.4, 0.6)` of width/height.
- Lines 34-50: the growth loop, 1000 iterations: pick two existing points at random, build the
  equilateral-triangle third vertex by rotating the edge by 60 degrees (`cs`/`sn`, lines 36-37, 45-47),
  draw a faint line (line 48, `stroke(255, 30)`) from the edge midpoint to the new vertex, and append
  the new point. Randomness enters only through the pair choice (line 39-41); geometry is exact.
  The 60-degree rotation is what gives the web its radial/rotational symmetry around the center.
- Lines 53-61: O(n^2) dedup pass removing points closer than 0.2 px (nearly coincident duplicates only).
- Line 63: `Triangulate.triangulate(points)` (org.processing.wiki.triangulate) builds the Delaunay mesh.
- Lines 66-77: `beginShape(TRIANGLES)`; per triangle the color is `color(random(255))` (continuous
  random grayscale) and the third vertex gets a random alpha `random(200)*random(0.2, 1)` while the
  first two are transparent (alpha 0) — a per-triangle one-sided fade that produces the soft facet look.
- Lines 80-85: every point drawn as a 3x3 px white ellipse (`fill(255)`), the visible "stippling".
- Lines 113-129 (`colors[]`, `rcol()`, `getColor()`): an unused 9-colour palette and helpers —
  dead code in this sketch, the render is monochrome.
- `pixelDensity(2)` (line 8) is unavailable on the headless display (stderr warning); render at density 1.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| iterations_2000 | `for (int i = 0; i < 1000; i++) {` -> `... i < 2000 ...` | subtle (mean 0.0391, 0.148 of pixels) | denser web, outline slightly larger and better filled; same radial symmetry | variants/iterations_2000/frame_00001.png |
| seedband_0.3_0.7 | `width*random(0.4, 0.6), height*random(0.4, 0.6)` -> `random(0.3, 0.7)` on both | moderate (mean 0.0577, 0.209 of pixels) | web spreads wider across the canvas; outer facets larger, fill a touch brighter | variants/seedband_0.3_0.7/frame_00001.png |
| trialpha_255 | `float alp = random(200)*random(0.2, 1);` -> `random(255)*random(0.5, 1);` | none (mean 0.0061, 0.01 of pixels) | no visible change | variants/trialpha_255/frame_00001.png |
| dot_6 | `ellipse(p.x, p.y, 3, 3);` -> `ellipse(p.x, p.y, 6, 6);` | none (mean 0.0093, 0.024 of pixels) | no visible change | variants/dot_6/frame_00001.png |
| linealpha_100 | `stroke(255, 30);` -> `stroke(255, 100);` | subtle (mean 0.0191, 0.082 of pixels) | the faint connecting lines read a bit more clearly; web slightly denser-looking | variants/linealpha_100/frame_00001.png |
| mergedist_2 | `if (p1.dist(p2) < 0.2) {` -> `< 2 {` | none (mean 0.0, 0.0 of pixels) | pixel-identical to baseline; the dedup pass still removes nothing | variants/mergedist_2/frame_00001.png |

## Modularisation notes
Two generic blocks: (1) the equilateral growth loop (lines 34-50) is a reusable "web growth"
primitive — parameterise by seed points, iteration count, rotation angle (60 deg here, could be
any angle for n-gon webs) and line alpha; (2) the faded triangulation (lines 63-77) is a reusable
"Delaunay with per-vertex alpha" renderer — parameterise by alpha range and grayscale vs palette.
One-off art decisions: the 0.4-0.6 central seed band, the 0.2 px dedup threshold (essentially
no-op), 3 px dot size, the specific alpha formula `random(200)*random(0.2,1)`. A clean parameter
object: `{seed, seedPoints: n, seedBand: [0.4,0.6], iterations, mergeDist, lineAlpha,
triAlphaRange: [0.2,1]*200, dotSize}`.
