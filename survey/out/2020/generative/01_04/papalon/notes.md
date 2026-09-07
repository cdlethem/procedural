---
sketch: 2020/generative/01_04/papalon
year: 2020
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: false
ms_first_frame: 1715
animated: false
techniques: [noise-field, voronoi-delaunay, particles, 3d-pointcloud, blend-modes]
primitives: [ellipse, shape]
palette:
  colors: ["#EA2E73", "#F7AA06", "#1577D8", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: det, default: 0.0016, tried: [0.0008], change: large, effect: "coarser noise detail: larger, chunkier glow regions (layout re-rolls every run anyway)"}
  - {name: points, default: 120000, tried: [30000], change: large, effect: "density barely changed - packing still fills the canvas; slightly fewer, more isolated glow spots"}
  - {name: cc, default: "s/5", tried: ["s/10"], change: large, effect: "no obvious change - fine rings on big facets come from the quad-stripe pass, not the ellipse slices"}
  - {name: triFillAlpha, default: 140, tried: [60], change: large, effect: "much thinner: far more black background visible between facets, web looks translucent"}
  - {name: triSkip, default: 0.6, tried: [0.9], change: large, effect: "fine triangle web much sparser with visible holes; glow spots unaffected (separate pass)"}
  - {name: palette, default: "EA2E73/F7AA06/1577D8", tried: ["072457/EF4C02/ADC7C8"], change: large, effect: "colours clearly changed: navy/rust/grey-blue instead of magenta/gold/blue"}
reusable_candidates:
  - {name: noisePackedDiscs, signature: "noisePackedDiscs(count, det, sizeFn, clearDist) -> PVector[]", note: "rejection-sampled disc packing with positions from 3-D simplex noise"}
  - {name: delaunayVertexShade, signature: "delaunayVertexShade(points, palette, alphaFn) -> void", note: "Delaunay mesh with per-vertex alpha gradients giving radial facet shading"}
---

## What it draws
Full-bleed 960x960 mosaic on black: a dense field of Delaunay triangles in magenta/pink, gold/yellow and blue. Several large "glow" regions (upper-left, mid-left, lower-centre, right edge) where many triangles converge into bright sunbursts with near-white hot cores fading to gold, magenta or blue. The big facets show fine concentric stripe texture radiating from their vertices; the rest of the canvas is a fine web of small dark triangles with faint coloured edges.

Note: frame_00010/frame_00060 are identical blank-white images (10 KB) while `draw()` is empty — the sketch is static and the later frames are a render artifact (P3D on this display), not animation. Description is of frame_00001 only.

## How the code works
- `settings()` (17-22): 960x960 P3D, `smooth(8)`, `pixelDensity(2)` (warns unavailable on this display).
- `generate()` (50-174) is called once from `setup()` (27); `draw()` (35-37) is empty, so the image is static.
- Line 57: `time = System.currentTimeMillis()*...` — even with the same seed the noise field shifts every run (`"deterministic": false`).
- Point cloud (71-87): 120000 candidates; x/y sampled from 3-D `SimplexNoise` at `det = random(0.0016)` (72-75), scaled to 0.8 of the canvas; disc size `s = random(500)*random(0.5,1)` (76); rejection keeps a point only if it is at least `(o.z+s)*0.6` from every accepted point (78-85) — a loosely packed set of discs, z = size (the "3-D" is really just a depth value for stacking).
- Glow discs (90-112): per accepted point, `cc = s/5` concentric ellipses are stacked along +z (101-110), sizes tapering quadratically (`amp = pow((cc-j)/cc,2)`, 102), each filled with a random palette colour at alpha 20 under `blendMode(ADD)` (68). Additive overlap of these slices is what creates the bright sunburst hot cores.
- Triangles (115-140): `Triangulate.triangulate(p2s)` (Delaunay); 60% of triangles are skipped (`random(1) > 0.6`, 123). Per triangle, colour from centroid noise via `getColor` (132), which lerps between adjacent palette entries (193-198); the three vertices get alphas 140 / random(180,255) / random(180,255)-black (133-138), so each triangle is a gradient between its vertices — this is the radial facet shading.
- Stripe pass (144-173): for every triangle, 24 quad strips along two edges with alpha ramps 0->60 and 20->0 (151-171) — the fine concentric rings visible on the large facets.
- Depth test is disabled at line 69 and never re-enabled: draw order, not depth, decides occlusion.
- `rcol()` (187-189): uniform random pick from the 3-colour list (185).

## Experiments
All six scores are `large`, but the sketch is non-deterministic (`time` from wall clock, line 57): every run re-lays the whole composition, so a large score is expected even for a parameter with no effect. Observations below note only the layout-independent differences.

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_0.0008 | `float det = random(0.0016);` -> `float det = random(0.0008);` | large (mean 0.29, 87.5% px) | coarser noise: glow regions are larger and chunkier, fewer small facets; overall character unchanged | variants/det_0.0008/frame_00001.png |
| points_30000 | `for (int i = 0; i < 120000; i++) {` -> `for (int i = 0; i < 30000; i++) {` | large (mean 0.32, 87.8% px) | little visible density change - the rejection loop still fills the canvas; glow spots slightly fewer and more isolated | variants/points_30000/frame_00001.png |
| cc_s10 | `int cc = int(s/5);` -> `int cc = int(s/10);` | large (mean 0.27, 86.6% px) | no obvious change vs baseline character; hot cores and facet rings look the same (rings come from the 24-quad stripe pass) | variants/cc_s10/frame_00001.png |
| alpha_60 | `fill(col, 140);` -> `fill(col, 60);` | large (mean 0.30, 87.2% px) | clearly thinner: much more black shows through between triangles, the fine web reads as translucent over the glow spots | variants/alpha_60/frame_00001.png |
| triskip_0.9 | `if (random(1) > 0.6) continue;` -> `if (random(1) > 0.9) continue;` | large (mean 0.31, 91.3% px) | fine triangle web much sparser with real holes (black) between clusters; glow sunbursts unaffected | variants/triskip_0.9/frame_00001.png |
| palette_alt | `int colors[] = {#EA2E73, #F7AA06, #1577D8};` -> `int colors[] = {#072457, #EF4C02, #ADC7C8};` | large (mean 0.33, 88.8% px) | structure identical, colours swapped: navy/rust/orange glow cores with grey-blue facets instead of magenta/gold/blue | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic: the rejection-sampled packing loop (78-87) is a standard Poisson-disk-ish "min distance = function of size" sampler — good library function `noisePackedDiscs`. The Delaunay + per-vertex-alpha shading (115-140) is a reusable facet-shading routine; the 24-strip edge gradient (144-173) is a one-off texture trick but could be a `edgeStripe` helper.
- One-off art decisions: the `time` hack from wall clock (57), the 60% triangle skip (123), the two-pass alpha ramps with hardcoded 24 strips, the z=-200 camera translate (59), and the 3-colour palette.
- Parameter object: {pointCount, noiseDetail, sizeRange [min,max], clearFactor (0.6), discSlices (s/5 divisor), triSkipProb, triAlpha, stripeSubdivs (24), palette, camZ}.
