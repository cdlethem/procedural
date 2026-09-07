---
sketch: 2018/Generativos/ostracity02
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2390
animated: false
techniques: [packing, 3d-mesh, polar, shader]
primitives: [shape]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: attempts, default: 100000, tried: [50000], change: moderate, effect: "same layout (same early candidates), a few later-accepted cones missing; per-vertex colour stream shifts so the mosaic differs slightly"}
  - {name: maxSize, default: 0.8, tried: [0.3], change: large, effect: "giant cones disappear; smaller radii pass the gap test more often, so a dense even field of mid-size cones fills the canvas"}
  - {name: div, default: 22, tried: [8], change: moderate, effect: "thicker, coarser horizontal bands; cones look softer and chunkier, same layout and colours"}
  - {name: subFactor, default: 0.5, tried: [1.5], change: moderate, effect: "more circumferential facets per ring; cones tessellate finer, large cones show thin vertical strips"}
  - {name: palette, default: "#FF3D20 #FC9D43 #3998C2 #3E56A8 #090D0E", tried: ["#687FA1 #AFE0CD #FDECB4 #F63A49 #FE8141"], change: large, effect: "whole image shifts to a brighter warmer pastel set (cream/peach/pink/light-blue) with no dark facets"}
reusable_candidates:
  - {name: rejectSamplePoints, signature: "rejectSamplePoints(attempts, bounds, radiusFn, minGapFn) -> PVector[]", note: "random points accepted only if a radius-aware gap from all earlier points holds (poisson-like packing)"}
  - {name: coneMesh, signature: "coneMesh(x, y, r, h, sub, div, colorFn) -> mesh", note: "stacked rings of quads tapering to a point; radius per ring = r * (1 - k/div) * |map(j,0,sub,-1,1)|"}
  - {name: paletteLerp, signature: "getColor(v) -> int", note: "cycle a color list with linear interpolation between neighbours"}
  - {name: grainVignetteShader, signature: "filter(gradeShader)", note: "post.glsl: 3x3 gaussian blur mix + per-pixel grain + saturation/brightness ramp + radial vignette (csb)"}
---

## What it draws
On a black ground, dozens of cone-shaped solids of many sizes are scattered across the
whole canvas, tilted by a shared random 3D rotation so they read as a field of spires
pointing in various directions. Each cone is built of horizontal bands of small
quadrilateral facets, colored facet-by-facet in saturated orange/red, amber, sky blue
and indigo with near-black gaps between facets; the largest cones fill entire corners
of the frame while small ones cluster in the middle. A post shader softens edges
slightly, adds fine grain, and darkens the image toward the edges.

## How the code works
`generate()` (ostracity02.pde:23) runs once in `setup()`; `draw()` is empty, so the
image is static (key press regenerates with a new seed).

1. Points: 100000 attempts (line 34); each candidate gets a random position in
   `[-width, width] x [-height, height]` (lines 35-36) and a size `s = width*random(0.03, 0.8)`
   (line 37). Rejection loop (lines 39-45) accepts the point only if
   `dist > (s + ant.z) * 0.5` from every already-accepted point, i.e. non-overlapping
   circles of diameter s — a poisson-like packing. Accepted points are stored as
   `PVector(x, y, s)` where z is the cone height.
2. Camera: translate to center then `rotateX/Y/Z(random(-0.8, 0.8))` (lines 28-31) —
   one shared random tilt for the whole scene, which gives the scattered perspective
   look; randomness here is what orients all cones.
3. Cones: for each point (lines 49-87), `r = s*0.5`, `sub = max(4, PI*r*0.5)`
   circumferential segments, `div = 22` height layers (line 61). For each layer k the
   ring radius is scaled by `amp = (1 - k/div)` (line 63, power 1) and each quad's
   in-plane radius by `abs(map(j, 0, sub, -1, 1))`, so rings shrink to zero both at the
   apex and at the ring ends — this produces the conical taper and the faceted
   diamond pattern seen in the image. Each of the 4 vertices of every quad gets an
   independent random palette color via `rcol()` (line 72, line 98: uniform pick from
   the 5-color list), hence the multicolored mosaic with black seams (background
   showing through gaps).
4. Grade: `filter(post)` (line 89) runs data/post.glsl: mixes in a 3x3 gaussian blur
   (weight 0.2), adds per-pixel hash grain (0.02), then `csb` brightness 1.2 with
   saturation rising toward center, all multiplied by a radial `dis` vignette — the
   dark corners and soft grain in the baseline.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| attempts_50000 | `for (int i = 0; i < 100000; i++) {` -> `for (int i = 0; i < 50000; i++) {` | moderate | same overall layout (early candidates identical); a few later-accepted cones gone, per-vertex colour stream shifts so mosaic differs slightly | variants/attempts_50000/frame_00001.png |
| maxSize_0.3 | `float s = width*random(0.03, 0.8);` -> `float s = width*random(0.03, 0.3);` | large | giant corner cones vanish; smaller radii pass the gap test more often, leaving a dense even field of mid-size cones across the canvas | variants/maxSize_0.3/frame_00001.png |
| div_8 | `int div = 22;` -> `int div = 8;` | moderate | horizontal bands get thicker/coarser; cones look softer and chunkier, same layout and colours | variants/div_8/frame_00001.png |
| sub_1.5 | `int sub = max(4, int(PI*r*0.5));` -> `int sub = max(4, int(PI*r*1.5));` | moderate | more circumferential facets per ring; cones tessellate finer, large cones show thin vertical strips | variants/sub_1.5/frame_00001.png |
| palette_alt | `int colors[] = {#FF3D20, ...#090D0E};` -> `{#687FA1, #AFE0CD, #FDECB4, #F63A49, #FE8141};` | large | whole image shifts to a brighter warmer pastel set (cream/peach/pink/light-blue); no dark facets | variants/palette_alt/frame_00001.png |

## Modularisation notes
Generic and reusable: the radius-aware rejection sampler (step 1) as a packing
utility; the `coneMesh` generator (step 3) is a clean "stacked shrinking rings of
quads" mesh builder parameterized by (r, h, sub, div, colorFn) and independent of the
scene; `getColor` palette cycling; and the grain/blur/vignette grade shader. One-off
art decisions: the specific 5-color palette, the `abs(map(...))` ring-end taper that
makes cones instead of cylinders, the per-vertex random coloring, the shared random
scene rotation, and the 0.5 overlap factor (tighter packing than pure non-overlap).
A clean parameter object would hold: `attempts`, `sizeMin/sizeMax` (fractions of
width), `gapFactor`, `div` (layers), `subPerMeter`, `rotationRange`, `palette`,
`shaderStrength`.
