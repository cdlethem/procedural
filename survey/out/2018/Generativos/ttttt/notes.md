---
sketch: 2018/Generativos/ttttt
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3707
animated: false
techniques: [subdivision, noise-field]
primitives: [rect]
palette:
  colors: ["#ED0494", "#F651C6", "#0602CB", "#028900", "#FCC20C", "#FD0706", "#B40317", "#B4A217", "#171F22"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(4, 800000))", tried: ["int(random(4, 60))"], change: moderate, effect: "fewer subdivision iterations -> much coarser mosaic of a few dozen large tiles"}
  - {name: zOffset, default: -200, tried: [200], change: moderate, effect: "plane 400 units closer to camera: mosaic zooms in, tiles smaller, plane seen more edge-on with a black band along the bottom"}
  - {name: rotX, default: "PI*random(0.0, 0.3)", tried: ["PI*random(0.5, 0.7)"], change: moderate, effect: "stronger forward tilt: plane compressed vertically, tiles more oblique, black band at top"}
  - {name: darken, default: "random(1) lerp toward black", tried: ["random(0.5)"], change: subtle, effect: "tiles slightly brighter overall; fewer near-black tiles"}
  - {name: det, default: "random(0.01)", tried: ["random(0.001)"], change: none, effect: "no visible change: noise height hh is computed but only used in commented-out 3D code"}
reusable_candidates:
  - {name: quadtreeSplit, signature: "quadtreeSplit(w, h, iterations, minSize) -> Rect[]", note: "randomly split one rect into four until N splits, then draw the surviving quads"}
---

## What it draws
A black canvas filled edge to edge by a dense mosaic of small axis-aligned colored rectangles in
vivid pink/magenta, red, green, blue, yellow and purple, each tinted toward black by a random amount.
The whole mosaic is one big plane seen at an oblique angle (tilted forward, rotated slightly
clockwise) with perspective, so tiles shrink toward the top and right of the frame. The image is
static: only frame 1 exists.

## How the code works
`setup()` (lines 4–13) creates a 960x960 P3D canvas, calls `generate()` once; `draw()` is empty so
the piece is static. `generate()` (lines 36–142):

- The world is translated to center and pushed 200 units back in z (line 46), tilted with
  `rotateX(PI*random(0.0, 0.3))` and turned with `rotateZ(PI*random(0.2, 0.4))` (lines 47–48) —
  the oblique view of the plane.
- Subdivision (lines 51–69): start with one rect 3x the canvas (line 53); `sub =
  int(random(4, 800000))` iterations each pick a random surviving rect and split it into four
  children with random split fractions (0.4–0.6 of each dimension), removing the parent
  (lines 57–68). Rects smaller than 4 px are skipped. With seed 42 the draw finishes in ~1.7 s, so
  the actual `sub` value is modest.
- Drawing (lines 75–133): each surviving rect is drawn at z = 0 as a flat `rect` (line 89) with
  `rectMode(CENTER)`; fill is `lerpColor(getColor(), color(0), random(1))` (line 87) — a palette
  color mixed toward black by a random factor, which produces the range from bright to near-black
  tiles. `getColor()` (lines 154–162) linearly interpolates between two adjacent entries of the
  9-color `colors[]` array (line 150).
- Noise (lines 72–73, 79–81): `det = random(0.01)`, `des = random(1000)`, and per-rect
  `hh = min(w,h) * pow(noise(...), 1.4) * 10` compute a pseudo-3D "height", but every use of `hh`
  in actual drawing is commented out (lines 90–131) — only the flat `rect` at z = 0 is drawn.
  So the noise currently has no visible effect.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_60 | `int sub = int(random(4, 800000));` -> `int sub = int(random(4, 60));` | moderate (mean 0.1226, 0.633 of pixels) | much coarser mosaic: only a few dozen large tiles (deep teal, crimson, purple, olive, magenta, near-black) with thin dark gaps; same oblique perspective | variants/sub_60/frame_00001.png |
| z_200 | `translate(width*0.5, height*0.5, -200);` -> `translate(width*0.5, height*0.5, 200);` | moderate (mean 0.0965, 0.359 of pixels) | plane 400 units closer: mosaic zooms in with smaller, denser tiles, seen more edge-on; black band appears along the bottom where the plane falls below the canvas | variants/z_200/frame_00001.png |
| rotX_0.6 | `rotateX(PI*random(0.0, 0.3));` -> `rotateX(PI*random(0.5, 0.7));` | moderate (mean 0.0859, 0.323 of pixels) | stronger forward tilt: plane compressed vertically, tiles more strongly oblique and elongated, black band at the top | variants/rotX_0.6/frame_00001.png |
| darken_0.5 | `fill(lerpColor(getColor(), color(0), random(1)));` -> `fill(lerpColor(getColor(), color(0), random(0.5)));` | subtle (mean 0.0359, 0.099 of pixels) | subtle: same mosaic, slightly brighter overall with fewer near-black tiles | variants/darken_0.5/frame_00001.png |
| det_0.001 | `float det = random(0.01);` -> `float det = random(0.001);` | none (mean 0.0, 0.0 of pixels) | no visible change: `det` only feeds the per-rect `hh` height whose uses are all commented out | variants/det_0.001/frame_00001.png |

## Modularisation notes
- The subdivision loop (lines 51–69) is generic: start with a seed quad, repeatedly split a random
  quad into four with random split ratios, stop after N splits or when a quad is below min size.
  That is the reusable `quadtreeSplit` candidate; the split ratio range (0.4–0.6) and min size (4)
  are the interesting knobs.
- The palette mechanism (lines 150–162) is generic: a list of colors plus `lerp-between-neighbors`
  sampling, and the per-item mix-toward-black (line 87) is a one-line "darken randomly" step.
- One-off art decisions: the 3x-canvas seed rect (line 53), the oblique P3D camera (lines 46–48),
  the black background. The commented-out 3D box extrusion (lines 96–131) is an abandoned variant
  that would have made the noise field visible; a clean parameter object for this sketch would be
  `{width, height, seed, sub, splitRatio: [0.4, 0.6], minSize, zOffset, rotX, rotZ,
  palette, darkenAmount, extrude: 0}`.
