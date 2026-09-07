---
sketch: 2019/generativos/japon
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1754
animated: false
techniques: [voronoi-delaunai, packing, noise-field, dots-stippling]
primitives: [ellipse, line, point, shape]
palette:
  colors: ["#FE8D31", "#FED136", "#0047AF", "#FFFFCD", "#FFFFFF", "#000000"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: bigCircleTries, default: 1000, tried: [300], change: moderate, effect: "fewer, more scattered suns; blue ground and hair field more visible"}
  - {name: bigSize, default: 0.4, tried: [0.7], change: large, effect: "fewer but larger suns with bigger stippled rings; mesh facets larger and more prominent"}
  - {name: hairTries, default: 10000, tried: [3000], change: moderate, effect: "sparser dot/hair field; large bare blue patches"}
  - {name: hairSize, default: 0.002, tried: [0.006], change: moderate, effect: "3x thicker dots and strokes; field reads as a dense black texture"}
  - {name: hairLen, default: "5-8", tried: ["20-30"], change: subtle, effect: "no visible change beyond strokes being slightly longer"}
  - {name: triSkip, default: 0.5, tried: [0.15], change: large, effect: "near-complete tiling of orange/yellow/olive facets; blue ground almost covered"}
reusable_candidates:
  - {name: packCircles, signature: "packCircles(nTries, sizeFn, minDistFactor) -> PVector[]", note: "rejection-sampled non-overlapping circle packing (generate, lines 92-107)"}
  - {name: stippleDisk, signature: "stippleDisk(x, y, r, density) -> void", note: "random points in a disc, used for the sun rings (pcircle, lines 237-247)"}
  - {name: gradientTriangle, signature: "gradientTriangle(t, colA, colB) -> void", note: "pseudo vertex-colour gradient: filled pass + per-vertex alpha pass (lines 186-202)"}
  - {name: noiseHair, signature: "noiseHair(x, y, len, nOffset, nScale) -> void", note: "short sine-wavied stroke along a 2-D noise angle (lineSine, lines 221-235)"}
---

## What it draws
A saturated blue field covered by dozens of concentric "suns" of varying size: pale-yellow
centres, white halos, small black stippled cores, and orange/yellow/blue stippled rings around
them. Between the suns, a faint low-poly triangle mesh in muted orange, yellow and dark
colours is visible, and the blue background is densely speckled with tiny black dots, each
with a short wavy hair-like stroke. Static image (frames 10/60 identical to frame 1).

## How the code works
- `settings()` (japon.pde:14-19): 960x960 P2D. `generate()` (82-219) runs once in `setup()`;
  `draw()` is empty. `randomSeed`/`noiseSeed` at 84-85 make it deterministic per seed.
- Background (89): one random palette colour (`rcol`, 288-290 over `colors[]` at 287:
  orange `#FE8D31`, yellow `#FED136`, blue `#0047AF`) -> the blue field.
- Big circles (92-107): 1000 attempts at random positions (93-94), size
  `width*0.4*sqrt(random)` (95), kept only if distance to every kept circle exceeds
  `(s+other.z)*0.2` (100) -> a non-overlapping packing of ~60 discs.
- Hair dots (111-137): 10000 attempts of tiny discs `width*0.002*sqrt(random)` (114),
  rejected if inside the exclusion zone of a big circle (120) or of another dot (129)
  -> sparse ~1-2 px dots on the blue.
- Each dot is drawn as a black filled ellipse (149-150) plus a short wavy stroke: angle
  from 2-D noise (153), drawn by `lineSine` (156; 221-235) which offsets the line
  perpendicular to its direction with a cosine -> the hair strokes.
- First triangulation (160): `Triangulate.triangulate` on the big-circle centres; drawn
  as a faint wireframe `stroke(0,30)` (162-175). Triangle centroids computed (171) and
  drawn as small two-tone dots (177-184).
- Second triangulation (186) on the centroids; half the triangles skipped randomly (190).
  Each kept triangle drawn twice: filled with a random palette colour + random alpha
  (192), then a per-vertex-alpha pass (196-200) giving a two-vertex-transparent,
  one-vertex-dark gradient look -> the low-poly mesh.
- Sun assembly (206-218): per big circle, white halo ellipse `fill(255,110)` diameter
  `0.4*z` (209-210), pale-yellow core `#FFFFCD` diameter `0.34*z` (211-212), then two
  stippled rings via `pcircle` (237-247, random points in a disc): palette colour
  `alpha 200` at radius `0.2*z` (214-215) and black at radius `0.1*z` (216-217).
- `circle()`/`desform()` (51-80) exist but are never called by `generate()`; no
  noise-driven distortion appears in the render.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| largeCircles_300 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 300; i++) {` | moderate (0.1499, 0.415) | fewer, more scattered suns; more open blue ground and hair field, sparser mesh | variants/largeCircles_300/frame_00001.png |
| largeSize_0.7 | `float s = width*0.4*sqrt(random(1));` -> `float s = width*0.7*sqrt(random(1));` | large (0.3502, 0.735) | fewer but larger suns with bigger stippled rings; mesh facets larger and more prominent | variants/largeSize_0.7/frame_00001.png |
| hairCount_3000 | `for (int i = 0; i < 10000; i++)` -> `for (int i = 0; i < 3000; i++)` | moderate (0.1269, 0.385) | dot/hair field clearly sparser; large bare blue patches; suns unchanged | variants/hairCount_3000/frame_00001.png |
| hairSize_0.006 | `float s = width*0.002*sqrt(random(1));` -> `float s = width*0.006*sqrt(random(1));` | moderate (0.113, 0.34) | dots and hair strokes ~3x thicker; field reads as a dense black texture | variants/hairSize_0.006/frame_00001.png |
| hairLen_25 | `float r = random(5, 8)*0.9;` -> `float r = random(20, 30)*0.9;` | subtle (0.011, 0.016) | no visible change (score subtle); strokes at most slightly longer, barely perceptible | variants/hairLen_25/frame_00001.png |
| triSkip_0.15 | `if(random(1) < 0.5) continue;` -> `if(random(1) < 0.15) continue;` | large (0.1591, 0.484) | near-complete tiling of orange/yellow/olive facets; blue ground almost fully covered | variants/triSkip_0.15/frame_00001.png |

## Modularisation notes
- Generic: the rejection-sampled circle packing (lines 92-107) is a self-contained
  Poisson-disc-like routine parameterised by attempt count, size function and minimum-
  distance factor; `pcircle`/stipple disk (237-247); the two-pass gradient triangle
  (186-202); `lineSine` noise hair (221-235).
- Art-specific: the layering order (mesh under suns), the exact exclusion factors
  (0.2 / 0.5*0.4 / 0.5), the 50% triangle skip, the sun ring proportions (0.4 / 0.34 /
  0.2 / 0.1), and the 3-colour palette.
- A clean parameter object would hold: `bigCircleTries`, `bigSize` (fraction of width),
  `bigMinDist`, `hairTries`, `hairSize`, `hairLen`, `hairNoiseScale`, `triSkipProb`,
  `sunRings: [fraction, color, alpha][]`, `palette`.
