---
sketch: 2018/Generativos/micro
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 2143
animated: false
techniques: [packing, voronoi-delaunay, noise-field, dots-stippling, lines-hatching]
primitives: [ellipse, line, shape]
palette:
  colors: ["#DAAC80", "#FCC9D2", "#FC2E1D", "#235F3F", "#02272D"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: maxSelect, default: 40, tried: [12], change: subtle, effect: "fewer large white halo circles (~9 vs ~20) and fewer hatched links; field unchanged"}
  - {name: maxSize, default: 360, tried: [120], change: large, effect: "all circles shrink to stipple size; halo circles nearly vanish; large faint Delaunay triangles dominate"}
  - {name: detSize, default: "random(0.004,0.006)*0.8", tried: ["random(0.004,0.006)*2.4"], change: large, effect: "finer noise detail mottles the size field; big-circle layout shifts"}
  - {name: pwrNoise, default: 2, tried: [4], change: large, effect: "size distribution compressed; field becomes small pink stipple with fewer medium circles"}
  - {name: sep, default: 4, tried: [8], change: none, effect: "hatch spacing of wavy links; no visible change"}
  - {name: triColorChance, default: 0.1, tried: [0.4], change: subtle, effect: "more Delaunay triangles take the noise tint; composition otherwise unchanged"}
reusable_candidates:
  - {name: circlePacking, signature: "circlePacking(w, h, count, maxSize, sizeNoise, minSize) -> PVector[]", note: "greedy rejection sampling of non-overlapping circles sized by 2-D noise; returns accepted (x, y, size) triples"}
  - {name: wavyConnection, signature: "wavyConnection(p1, p2, spacing, noiseField) -> void", note: "perpendicular hatch strokes with noise-modulated sinusoidal amplitude between two points"}
  - {name: radialRing, signature: "radialRing(x, y, r1, r2, color, a1, a2) -> void", note: "annulus built from quads with per-quad alpha fade (soft halo)"}
---

## What it draws

Near-white background covered by a dense field of overlapping circles in dusty pink,
salmon and red, with scattered dark-green and brown circles. A faint Delaunay triangle
mesh (thin grey lines) spans the whole canvas. Roughly twenty large white circles with
soft pink/green radial halos sit on top, linked by thin wavy hatched lines. Tiny dark
green dots are sprinkled over everything.

## How the code works

Everything runs once in `generate()` from `setup()` (micro.pde:5-11); `draw()` is empty so
the sketch is static.

- `randomSeed`/`noiseSeed` with the harness `seed` (36-37); `background(252)` (39);
  `noiseDetail(2, 0.45)` (41).
- Packing loop (57-91): 200000 attempts. Each point gets `x, y` uniform over an extended
  canvas (±`maxSize`=360) and a size `s = pow(noise(...)*random(0.6,1), pwrNoise)*maxSize`
  it overlaps an accepted one (`dist < (p.z+o.z)*0.5`, 65-72) → classic greedy circle
  packing. Accepted points with `s>10` go to `ptrian`; the largest non-overlapping subset
  with `s>30` up to `maxSelect=40` goes to `select` (74-85).
- Circles (94-104): every accepted point drawn as an `ellipse` of diameter `p.z*0.98`.
  Size < 10: alpha ramp; larger: `getColor(map(size, 0, maxSize, 0, colors.length*3))`
  walks the 5-colour palette 3 times, so big circles land on red/green/brown regions and
  small pink ones dominate (this is the pink field).
- `tris()` (196-219): `Triangulate.triangulate(ptrian)` — Delaunay over all packed
  points. Each triangle filled white alpha 40; 10% chance of a noise-coloured fill at
  alpha 70 → the faint mesh.
- Select mesh (109-144): Delaunay over the ≤40 big points. 1px `stroke(0,50)` edges,
  occasional alpha-20 fills, small white centroid dots, and `connection()` (175-194) on
  each edge: perpendicular hatch lines every 4px, amplitude
  `sin(v*PI)*dis*0.04*noise(...)` → the wavy lines; stroke colour from `noiseColor`
  (171-173), alpha 120.
- Halos (148-161): for each select point, `arc2()` (221-239) draws an annulus from
  radius `p.z` to `p.z*2.2` as quads with alpha fading 120→0 in a `noiseColor` hue →
  soft halo; then a white halo ellipse and a solid white circle on top → the big white
  circles.
- Speckles (163-168): 3px `ellipse` per `ptrian` point, `noiseColor` fill → the tiny
  green dots.
- Colour: `getColor(float)` (248-254) lerps between adjacent palette entries, so all
  colour is a lerp across `colors[] {#DAAC80, #FCC9D2, #FC2E1D, #235F3F, #02272D}`.

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| maxSelect_12 | `int maxSelect = 40;` -> `int maxSelect = 12;` | subtle | ~9 large white halo circles instead of ~20, fewer wavy hatched links; circle field and mesh unchanged | variants/maxSelect_12/frame_00001.png |
| maxSize_120 | `float maxSize = 360;` -> `float maxSize = 120;` | large | whole field becomes fine stipple dots; big white halo circles nearly gone; a few large faint triangles dominate | variants/maxSize_120/frame_00001.png |
| detSize_3x | `detSize = random(0.004, 0.006)*0.8;` -> `*2.4;` | large | size field mottled: patches of fine dots alternating with larger red/green circles; big-circle positions shift | variants/detSize_3x/frame_00001.png |
| pwrNoise_4 | `float pwrNoise = 2;` -> `float pwrNoise = 4;` | large | distribution compressed to mostly small pink stipple, fewer medium circles; a few big circles and white halos remain | variants/pwrNoise_4/frame_00001.png |
| sep_8 | `float sep = 4;` -> `float sep = 8;` | none | no visible change (hatch spacing of the 1px wavy links only) | variants/sep_8/frame_00001.png |
| triColor_0.4 | `boolean col = (random(1) < 0.1);` -> `< 0.4);` | subtle | mesh triangles slightly more coloured/tinted; composition otherwise unchanged | variants/triColor_0.4/frame_00001.png |

## Modularisation notes

Generic: the greedy noise-sized circle packing loop (57-91) is a clean
`circlePacking(...)` returning (x,y,size) triples — it only takes a noise field and a
size curve. `Triangulate.triangulate` is already a library call. `connection()` (hatched
wavy link) and `arc2()` (alpha-fading annulus) are reusable as `wavyConnection` and
`radialRing`. `getColor` (lerp across a palette with wrap) is a generic palette helper.

One-off art decisions: the two-tier selection (`select` vs `ptrian`), the 3× palette
walk keyed to circle size, the 10% coloured-triangle chance, and the specific 5-colour
palette. A clean parameter object: `{w, h, attempts, maxSize, minSize, sizeDetail
(detSize), sizeOffset (desSize), pwrNoise, maxSelect, palette, haloScale (2.2),
hatchSep (4), hatchAmp (0.04), triColorChance (0.1)}`.
