---
sketch: 2017/Generativos/trianglesLines
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 276
animated: false
techniques: [subdivision, symmetry, lines-hatching, recursion]
primitives: [line]
palette:
  colors: ["#BCBDAC", "#CFBE27", "#F27435", "#F02475", "#3B2D38"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub (subdivision budget), default: "int(random(1, random(30000)))", tried: ["random(1,1000)", "random(1,60000)"], change: moderate/large, effect: "fewer steps = sparser mesh with more bare large triangles; more steps = canvas fully carpeted by overlapping fans"}
  - {name: sb (spokes base), default: "2^int(random(2,12))", tried: ["2^int(random(2,6))"], change: none, effect: "no visible change (with same seed both ranges drew the same integer sb, so the image is identical)"}
  - {name: alpha (line opacity), default: 160, tried: [255], change: subtle, effect: "lines slightly brighter/more saturated; structure unchanged"}
  - {name: colors (palette), default: "5 warm colours (#BCBDAC,#CFBE27,#F27435,#F02475,#3B2D38)", tried: ["5 blues/cyans"], change: subtle, effect: "same structure recoloured blue/cyan (structure identical, only hue shifts)"}
reusable_candidates:
  - {name: subdivideTri, signature: "subdivideTri(tri) -> Tri[4]", note: "Sierpinski-style split: one inverted half-size triangle at center + three edge triangles, depth counter kept per node"}
  - {name: spokesToEdge, signature: "spokesToEdge(cx, cy, edge, count) -> lines", note: "fan of lines from a random interior point to points mapped along one triangle edge, count scaled by 2^-depth"}
---

## What it draws
Black full-bleed canvas covered in a recursive triangular line-drawing: a hexagonal
arrangement of triangles subdivided to varying depths, producing dense fine-mesh clusters
and sparse regions with only large outlines. Each triangle's edges carry a fan of thin
lines radiating from a random interior point, coloured with a 5-colour palette
(beige, yellow, orange, magenta, dark plum) at about 60% opacity, so the lines glow
brightest where clusters overlap (lower-left, upper-right, mid-right patches).

## How the code works
- `setup()` (L2-7): 960x960, `pixelDensity(2)` (ignored on this display), calls `generate()`
  once; `draw()` is empty, so the sketch is static (confirmed: frames 10/60 identical).
- `generate()` (L23-75):
  - L24 re-rolls the random seed per run.
  - L26-29: black background; canvas centred, jittered ±50 px, randomly rotated — so the
    hexagonal pattern starts at a random offset/angle.
  - L31-38: builds 6 initial triangles `Tri` on a hexagon (angle `k*60°-30°`, radius
    `ss*0.25`, `ss = width*random(1.8,2.4)`, side `s = ss*0.5`): these tile the canvas
    hexagonally.
  - L40-46: `sub = int(random(1, random(30000)))` random subdivision steps: each step picks
    a random triangle, calls `Tri.sub()`, removes it and adds its 4 children — Sierpinski
    subdivision (`sub()`, L115-126: one inverted half-size triangle at the centroid plus
    three triangles at the edge midpoints, each tagged with depth `sub`).
  - L47: `sb = 2^random(2,12)` — base number of spokes per edge.
  - L50-74: for every triangle, a random interior point `cx,cy` (L53-57, radius modulated
    by L55's map so the point stays inside); for each of the 3 edges (L58-73) draw
    `sb2 = sb/2^depth` lines (L66-72) from `(cx,cy)` to points `map(i,0,sb2)` along the
    edge — deeper triangles get fewer, shorter lines, giving the mesh a fading
    self-similar texture. Stroke is `lerpColor` between two adjacent palette colours
    (`getColor`, L133-143) sampled from `colors[]` (L129) at alpha 160.
- `PointInTriangle`/`sign` (L77-87) are unused helpers.
- Randomness: seed (L1, L24), jitter/rotation (L28-29), `ss` scale (L32), subdivision count
  and which triangles subdivide (L40-44), `sb` (L47), interior points and colours (L53, L70).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_1000 | `int sub = int(random(1, random(30000)));` -> `... random(1000));` | moderate | sparser: fewer subdivision steps leaves many large bare triangles and only a few fine clusters, same hexagonal layout | variants/sub_1000/frame_00001.png |
| sub_60000 | `int sub = int(random(1, random(30000)));` -> `... random(60000));` | large | canvas fully carpeted: thousands of small triangles each draw a fan, overlapping into a dense starburst texture with no black showing (except small gaps); much brighter overall | variants/sub_60000/frame_00001.png |
| sb_6 | `int sb = int(pow(2, int(random(2, 12))));...` -> `int(pow(2, int(random(2, 6))));` | none | no visible change — image identical to baseline; with seed 42 both random ranges draw the same integer sb, so the spoke count was unchanged | variants/sb_6/frame_00001.png |
| alpha_255 | `stroke(getColor(random(colors.length)), 160);` -> `..., 255);` | subtle | same structure, lines slightly brighter/more saturated where clusters overlap | variants/alpha_255/frame_00001.png |
| palette_blue | `int colors[] = {#BCBDAC, #CFBE27, #F27435, #F02475, #3B2D38 };` -> `int colors[] = {#4FC3F7, #0288D1, #B3E5FC, #1A237E, #80DEEA };` | subtle | identical structure recoloured in blues/cyans with a dark-navy accent | variants/palette_blue/frame_00001.png |

## Modularisation notes
- Generic blocks:
  - `Tri.sub()` is a clean recursive Sierpinski-triangle subdivision with per-node depth —
    a good library primitive (`subdivideTri`).
  - The spokes loop (L50-74) is a parameterisable "edge fan" renderer: (triangles, depth,
    spokes-per-edge base, point-in-triangle jitter) -> lines; depth-scaled spoke count is
    the interesting part.
  - `getColor` (adjacent-palette lerp) is a small reusable palette sampler.
- One-off art decisions: hexagonal 6-triangle seed layout with random jitter/rotation,
  the 5-colour warm palette, alpha 160, the `random(1, random(30000))` double-random
  subdivision budget, the L55 radius modulation.
- Clean parameter object: `{scale, hexJitter, rotation, subdivisionSteps, spokesBase,
  alpha, palette[]}`.
