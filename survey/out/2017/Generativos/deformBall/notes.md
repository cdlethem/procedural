---
sketch: 2017/Generativos/deformBall
year: 2017
renderer: JAVA2D
size: [1920, 1920]
libraries: []
deterministic: true
ms_first_frame: 568
animated: false
techniques: [grid, distortion]
primitives: [shape]
palette:
  colors: ["#000000", "#FFFFFF", "#FF8000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cd (deformer count), default: "random(4, 30)", tried: [4], change: large, effect: "fewer deformers -> fewer, larger, smoother bulges with bigger flat regions"}
  - {name: desform radius, default: "random(20, 500)*2", tried: ["random(300, 1000)*2"], change: large, effect: "bigger radius -> broad, soft domes covering most of the canvas"}
  - {name: grid spacing, default: "random(6, random(20, 50))", tried: ["random(12, random(30, 60))"], change: large, effect: "coarser cells; bulges read as faceted spheres made of distinct squares"}
  - {name: dot radius factor, default: 0.2, tried: [0.4], change: subtle, effect: "no visible change except larger orange center dots"}
  - {name: power m, default: "random(minMod, maxMod) ~ [0.5, 1.0)", tried: [0.5], change: large, effect: "lower exponent -> stronger displacement near field edge, sharper crinkled pinch folds"}
  - {name: gray fill exponent, default: "random(1)", tried: [2], change: large, effect: "darker overall: pow(u,2) biases grays toward black, fewer near-white cells"}
reusable_candidates:
  - {name: radialDisplacementField, signature: "getDes(cx, cy, radius, power, sign, ax, ay) -> PVector", note: "radial push/pull with power-law falloff pow(1-d/r, m)*d; sum of N fields deforms a point"}
  - {name: deformPolygon, signature: "deformPolygon(points, fields) -> points", note: "apply a list of displacement fields to each vertex of a polygon (Circle/Rect classes do exactly this)"}
  - {name: deformedGrid, signature: "deformedGrid(spacing, cellFn, fields) -> drawing", note: "tile the canvas with a small shape whose vertices are displaced by the field list"}
---

## What it draws
A full-bleed 1920x1920 black canvas covered by a dense grid of small diamond (45-degree rotated
square) cells in random shades of gray, each cell marked with a small orange dot at its center.
Several large, smooth lens-like bulges warp the grid: around them the cells stretch, shrink and
tilt into curved sheet-like folds, while far from the bulges the grid stays flat and regular.
Dominant colors: black, mid-gray/white, orange.

## How the code works
`setup()` (l.1-6) sets 1920x1920 and calls `generate()` once; `draw()` does nothing (l.9-11), so
the piece is static. `generate()` (l.23-51):

1. `background(0)` — black canvas.
2. Creates `cd = int(random(4, 30))` (l.29) `Desform` objects at random positions, each with a
   radius `s = random(20, 500)*2` (l.33) and falloff exponent `m` drawn between two random
   bounds `minMod = random(0.5, 0.9)`, `maxMod = random(0.6, 0.999)` (l.27-28, 34). Each `Desform`
   also gets a random direction sign `dir = ±1` (l.72), so it either attracts or repels points.
   `Desform.getDes()` (l.75-87) returns a radial displacement `pow(1-d/s, m)*d` along the angle
   from the field center to the point, zero outside radius `s`; the power-law falloff and the
   sign are what make the smooth lens bulges and pinch lines in the image.
3. Tiles the canvas in a double loop with spacing `s = random(6, random(20, 50))` (l.40-42),
   extended 200 px past the edges. At each lattice point it draws:
   - a `Rect` (l.45, class l.121-151): a 4-vertex diamond of side `s` (corners at 45 degrees,
     l.134), each vertex displaced by the sum of all `Desform` fields (l.144-147); filled with
     random gray `fill(256*pow(random(1), random(1)))` (l.43). Because only the 4 corners move
     (no subdivision), cells stay flat quads; the sheet-like "3D" look comes from the varying
     cell sizes/tilts and the random gray shading, which acts like fake lighting.
   - a `Circle` (l.44, class l.90-119): a polygon of `max(8, PI*r*0.5)` vertices, radius
     `s*0.2`, displaced the same way; filled with fixed orange `fill(255, 128, 0)` (l.47) —
     the orange dot at every cell center.
Randomness enters at: deformer count/position/radius/power/sign (l.27-34, 72), grid spacing
(l.40), per-cell gray (l.43). No noise, no blend modes; plain JAVA2D `beginShape`/`endShape`
with source-over. The `colors[]` palette and `rcol()` (l.153-156) are unused (only in
commented-out code).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cd_4 | `int cd = int(random(4, 30));` -> `int cd = 4;` | large (mean 0.3668, 0.815 of pixels) | far fewer, larger, smoother bulges; big flat grid regions between four wide fields; cells stretch into long folds at the pinch lines | variants/cd_4/frame_00001.png |
| desformR_300_1000 | `float s = random(20, 500)*random(1)*2;` -> `float s = random(300, 1000)*random(1)*2;` | large (mean 0.3821, 0.816 of pixels) | very large smooth domes; same fine grid but bulges become broad soft hills covering most of the canvas, flat areas mostly untouched | variants/desformR_300_1000/frame_00001.png |
| gridSpacing_coarse | `float s = random(6, random(20, 50));` -> `float s = random(12, random(30, 60));` | large (mean 0.3618, 0.774 of pixels) | coarser cells; the bulges now read as clearly faceted 3D spheres built from distinct squares instead of a continuous sheet | variants/gridSpacing_coarse/frame_00001.png |
| dotR_0.4 | `Circle c = new Circle(i, j, s*0.2);` -> `Circle c = new Circle(i, j, s*0.4);` | subtle (mean 0.0358, 0.151 of pixels) | no visible change in the overall warping (identical deformer layout); only the orange center dots are noticeably larger | variants/dotR_0.4/frame_00001.png |
| power_0.5 | `float m = random(minMod, maxMod);` -> `float m = 0.5;` | large (mean 0.3088, 0.679 of pixels) | much more extreme warping: sharp crinkled pinch lines and deep folds, displacement reaching further toward each field's edge | variants/power_0.5/frame_00001.png |
| grayDark | `fill(256*pow(random(1), random(1)));` -> `fill(256*pow(random(1), 2));` | large (mean 0.2433, 0.595 of pixels) | same deformation and layout as baseline, but cells are darker overall — fewer near-white cells, more dark/mid grays | variants/grayDark/frame_00001.png |

## Modularisation notes
- Generic (good library candidates):
  - The `Desform` displacement field: `displace(x, y, cx, cy, radius, power, sign)` with the
    power-law falloff `pow(1-d/r, m)*d` and zero outside the radius. A list of such fields
    (with superposition) is a small, reusable "force field" primitive.
  - `deformPolygon(points, fields)`: map each vertex through the summed field. Works for any
    vertex count (both `Circle` and `Rect` classes are identical except vertex generation).
  - `deformedGrid(spacing, cellFn, fields)`: the tiling loop (l.41-50) with edge overhang.
- One-off art decisions: 45-degree diamond cells with no subdivision (why cells stay flat quads),
  random-gray "fake lighting" fill, fixed orange dot at cell centers, 4-30 fields with random
  attract/repel signs, the specific random ranges (radius 20-1000 px, power 0.5-1.0).
- A clean parameter object: `{size, cellSpacing, cellShape: {sides, radius, rotation},
  dotRadiusFactor, fields: [{x, y, radius, power, sign}], cellFill: {mode, range},
  dotFill}` — the field list and the cell/spacing/fill settings are the interesting knobs, as the
  experiments show (count, radius, power, spacing, gray exponent all change the look strongly;
  dot size alone is subtle).
