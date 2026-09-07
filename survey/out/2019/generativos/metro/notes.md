---
sketch: 2019/generativos/metro
year: 2019
renderer: JAVA2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 415
animated: false
techniques: [noise-field, grid, voronoi-delaunay, particles, lines-hatching]
primitives: [line, ellipse, shape]
palette:
  colors: ["#EA449F", "#EFACDB", "#F2C05C", "#D62C06", "#214CA2"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 80, tried: [40], change: moderate, effect: "coarser grid: longer segments, sparser web, background triangles read more strongly"}
  - {name: walkerCount, default: 280, tried: [140], change: moderate, effect: "half the walkers: visibly sparser web, more white space, fewer dots and circles"}
  - {name: angDiv, default: 8, tried: [4], change: moderate, effect: "walks restricted to 4 cardinal directions: orthogonal circuit-like web, 45-degree diagonals gone"}
  - {name: strokeWeight, default: "random(0.6, 1.6)", tried: ["random(2.5, 4.5)"], change: moderate, effect: "much thicker bolder lines, web reads heavier/poster-like, overlaps dominate"}
  - {name: maxAlp, default: 80, tried: [200], change: subtle, effect: "Delaunay triangles more saturated (pink/blue/orange clearer) but stay in background; web unchanged"}
  - {name: walkSteps, default: 320, tried: [960], change: moderate, effect: "3x longer walks: denser, busier, more tangled web with more dots and crossings"}
reusable_candidates:
  - {name: noiseWalk, signature: "noiseWalk(start, dir, steps, cellSize, det, palette, alpha) -> List<Line>", note: "compass-grid random walker: fixed direction per walk, noise-modulated step size (1+4*noise), occasional +/-1 direction turn, 50% chance of a perpendicular sub-step"}
  - {name: delaunayOverlay, signature: "delaunayOverlay(points, maxAlpha) -> Shape", note: "Delaunay triangulate collected sample points, draw a random subset with per-vertex low-alpha fills"}
---

## What it draws
A dense, full-bleed web of thin straight-line segments in red-orange, gold, blue and
pink on a near-white background, crossing at mostly 45-degree angles like a transit
diagram. Small dots sit on many line midpoints, and a few solid magenta, orange and
blue circles (from a few to ~40 px) are scattered over the web. A handful of large,
very pale translucent triangles (pink, blue, orange) and big faint circles lie behind
the lines, giving the whole sheet a soft layered depth.

## How the code works
`setup()` calls `generate()` once (metro.pde:23); `draw()` is empty, so the image is
static. Flow:

- `background(250)` sets the near-white canvas (l.69); `blendMode(DARKEST)` (l.76)
  composites every later stroke/fill by taking the darkest overlapping colour, which
  is why overlaps darken instead of mixing.
- A coarse grid is defined: `cc = 80`, `ss = width/80 = 12 px` cells (l.78-79).
  280 walker starts are picked at random, sized `ss * 2^k` with `k in 0..5`
  (l.83-94), snapped to a 48 px (4-cell) subgrid plus half a cell (l.88-92).
- Each walker picks one of `angDiv = 8` compass directions (l.96, l.104), with a 30%
  chance of shifting it by +/-1 (l.113-115), and walks 320 steps (l.118). Step size is
  `ss * (1 + 4*noise)`, where noise is 2-D simplex sampled at the walker position with
  detail ~0.004 (l.106, l.121, l.123); at each step there is a 50% chance of an extra
  quarter-turn (±45°, l.132-138), which produces the right-angle/45° "metro" jogs.
  Each step draws one `line()` (l.142) in a random palette colour with alpha
  ~95-280 and stroke weight 0.6-1.6 (l.117, l.109, l.141), and paints a tiny
  2-3 px `ellipse()` dot at the segment midpoint in another random palette colour
  (l.145-150). This loop is what builds the dense web plus the dotted midpoints.
- 2% of steps are recorded as `spots` and 2% as `pps` (l.152-160). `pps` become the
  large soft translucent circles: two concentric ellipses, radius up to ~8× the local
  noise-scaled size, alpha 200-250 (l.166-175). `spots` are Delaunay-triangulated
  (l.185); ~40% of triangles are drawn with per-vertex fills at random alpha up to
  `maxAlp = 80` (l.188-201), producing the faint background triangles, and 10% of
  spots get a small stroked/faint ring (l.203-218).
- Colour is always `rcol()` (l.233-235): uniform random pick from the 5-colour
  array at l.231 (magenta, light pink, gold, red-orange, blue).
- The `toxi` `SimplexNoise` import (l.2) is unused; Processing's built-in `noise()`
  does the work. `triangulate` is used for the triangle overlay.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_40 | `  int cc = 80;` -> `  int cc = 40;` | moderate (mean 0.1241, 45% px) | coarser grid: longer segments, sparser web, large pale triangles (pink/gray/orange) read much more strongly | variants/cc_40/frame_00001.png |
| points_140 | `  for (int i = 0; i < 280; i++) {` -> `... i < 140 ...` | moderate (mean 0.0967, 38% px) | half the walkers: clearly sparser web with more white space, fewer dots and circles, triangles still present | variants/points_140/frame_00001.png |
| angDiv_4 | `  int angDiv = 8;...` -> `  int angDiv = 4;...` | moderate (mean 0.119, 47% px) | walks restricted to 4 cardinal directions: orthogonal circuit-like web of long straight runs, 45-degree diagonals gone | variants/angDiv_4/frame_00001.png |
| strokeWeight_3 | `    strokeWeight(random(0.6, 1.6));` -> `    strokeWeight(random(2.5, 4.5));` | moderate (mean 0.0842, 35% px) | lines much thicker and more saturated; web reads bolder/poster-like, overlaps darken strongly | variants/strokeWeight_3/frame_00001.png |
| maxAlp_200 | `  float maxAlp = 80;` -> `  float maxAlp = 200;` | subtle (mean 0.0367, 10% px) | Delaunay triangles noticeably more saturated (pink, blue, orange clearer) but still background layer; web itself unchanged | variants/maxAlp_200/frame_00001.png |
| steps_960 | `    for (int j = 0; j < 320; j++) {` -> `... j < 960 ...` | moderate (mean 0.111, 43% px) | 3x longer walks: denser, busier, more tangled web, more midpoint dots and crossings, less white space | variants/steps_960/frame_00001.png |

## Modularisation notes
Generic, library-worthy: (1) the compass-grid noise walker (`noiseWalk`): input a
start point, cell size, direction set, step count, noise detail, palette, alpha and
stroke weight; it returns the list of segments plus the collected sample points —
this is the core "metro web" generator and is fully parameter-driven. (2) The
Delaunay overlay (`delaunayOverlay`): take a set of points, triangulate, and fill a
random subset of triangles with per-vertex low-alpha colours; parameter is the alpha
range and draw probability. (3) `rcol()` / `getColor()` are a trivial
random-palette sampler.

One-off art decisions: the fixed 5-colour palette; snapping starts to the 48 px
subgrid; the 30% direction-jitter and 50% perpendicular-sub-step probabilities; the
2% spot/pp sampling rates; `blendMode(DARKEST)` (changing it to LIGHTEST or normal
would fundamentally change the look); the 280 walkers / 320 steps / `cc = 80`
specifics.

A clean parameter object would contain: `gridCells` (cc), `walkerCount`, `walkSteps`,
`angDiv`, `noiseDetail`, `stepScale` (the `1+noi*4` curve), `turnProbability`,
`strokeWeightRange`, `lineAlphaRange`, `dotScaleRange`, `spotSampleRate`,
`triAlphaMax` (maxAlp), `triDrawProbability`, `palette`, `blendMode`.
