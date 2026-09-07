---
sketch: 2018/Generativos/perla
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1597
animated: false
techniques: [grid, noise-field, voronoi-delaunay, polar]
primitives: [shape, ellipse]
palette:
  colors: ["#FFFFFF", "#FFCB43", "#FFB9D5", "#1DB5E3", "#006591"]
  selection: noise-driven
composition: scattered
  - {name: planets, default: 1200, tried: [2400], change: moderate, effect: "denser, smaller, more delicate field; large corner discs persist, mesh more visible"}
  - {name: det1, default: "random(0.01)", tried: ["random(0.002)"], change: moderate, effect: "size-noise sampled at 1/5 scale: sizes clump into smooth patches, sparser regions plus denser big-disc clusters"}
  - {name: sizeExponent, default: 2.2, tried: [1.0], change: moderate, effect: "noise no longer squared: far more large discs, canvas nearly covered, cyan mostly hidden"}
  - {name: alpMax, default: 255, tried: [120], change: subtle, effect: "no visible change at first glance; discs slightly more see-through, background reads through overlaps"}
  - {name: dotSize, default: 3, tried: [8], change: subtle, effect: "no visible change to the discs; the point markers are now small visible rings/dots instead of pinpoints"}
reusable_candidates:
  - {name: noiseFanDisc, signature: "noiseFanDisc(x, y, sizeNoise, maxR, facets) -> shape", note: "radial triangle fan (disc) whose radius is sampled from 2-D noise and squared for a long-tail size distribution"}
  - {name: noisePalette, signature: "noisePalette(noise2, offsets, palette) -> color", note: "2-D noise mapped into a palette via lerp between neighbouring swatches (getColor, lines 142-147)"}
  - {name: scatterGrid, signature: "scatterGrid(n, cell, dedupeRadius) -> PVector[]", note: "random points snapped to a cell grid with a distance-based duplicate rejection (lines 56-101)"}
---

## What it draws
A saturated cyan field covered edge to edge with ~1200 translucent discs in white,
pale pink, soft yellow and light blue, ranging from pinpoints to ~200 px. Each disc
reads as a faceted radial fan with faint spoke lines, and they overlap into soft
clusters, biggest near the top and bottom edges. A barely visible web of thin
triangles (Delaunay mesh) threads the background, and a small coloured dot marks
every point.

## How the code works

`setup()` calls `generate()` once; `draw()` is empty, so the image is static
(lines 5-13). The background is one random palette colour (line 25); with seed 42
it is the cyan `#1DB5E3`. For each of `planets = 1200` points (line 41): position is
random, snapped to a 20 px grid (lines 60-63); radius is `noise(...)² · 820` (line
65) — squaring the noise gives mostly small discs with a few large ones. Each disc
is a radial fan of `cc = max(8, s·PI)` triangles (lines 67-92): every wedge has a
vertex at the centre and two on the rim, which is where the visible spokes come
from. The three per-wedge fills sample three independent 2-D noise fields through
`getColor`, which lerps between neighbouring palette swatches (lines 75-77,
142-147); fills are also lerped towards the background by `fog = i/planets`
(line 69) and alpha ramps 0→255 with `i` (line 79), so later (more opaque) discs
read on top of earlier ones. After the discs, `Triangulate.triangulate(points)`
(line 104) produces a Delaunay mesh drawn with `stroke(0, 6)` and per-vertex fill
alpha `random(random(80))` (lines 107-120) — hence the barely-there web. Finally a
3 px ellipse in a random palette colour marks each point (lines 123-127).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| planets_2400 | `int planets = 1200;//int(random(1200));` -> `int planets = 2400;//...` | moderate | denser, smaller, more delicate discs; big discs still in top-right/bottom-right corners; mesh web more visible with the extra points | variants/planets_2400/frame_00001.png |
| det1_0.002 | `float det1 = random(0.01);` -> `float det1 = random(0.002);` | moderate | size field smoother: discs clump into patches (big cluster bottom-right, sparse centre-left), same palette | variants/det1_0.002/frame_00001.png |
| pow_1.0 | `s = pow(noise(…), 2.2)*820;` -> `s = pow(noise(…), 1.0)*820;` | moderate | largest change: many more large discs, canvas nearly covered in overlapping pale pink/yellow/blue, cyan mostly hidden | variants/pow_1.0/frame_00001.png |
| alp_120 | `float alp = map(i, 0, planets, 0, 255);` -> `… 0, 120);` | subtle | no visible change at normal viewing; discs marginally more transparent where they overlap | variants/alp_120/frame_00001.png |
| dot_8 | `ellipse(o.x, o.y, 3, 3);` -> `ellipse(o.x, o.y, 8, 8);` | subtle | no visible change to discs; point markers now read as small dots/rings instead of pinpoints | variants/dot_8/frame_00001.png |

## Modularisation notes
The generic, reusable blocks: (1) the noise-sized radial fan disc
(`noiseFanDisc`) — the core visual primitive, parameterised by a size-noise field,
max radius, and facet count; (2) `noisePalette` (lines 142-147) — noise-driven
colour from a lerp'd palette, cleanly separable; (3) `scatterGrid` (lines 56-101)
— grid-snapped scatter with dedupe, independent of the drawing. One-off art
decisions: the `pow(…, 2.2)` exponent and `*820` scale (taste in the size
distribution), the `fog`/`alp` ramp that makes later discs dominate (a layering
choice, not a property of the disc itself), the 5-colour palette, and the
ultra-low-alpha Delaunay overlay + 3 px dots as finishing touches. A clean
parameter object: `{count, cellSize, maxRadius, sizeExponent, sizeNoiseScale,
facetsPerDisc, alphaRamp: [start, end], palette, mesh: {strokeAlpha, fillAlpha},
dots: {size, on}}`.
