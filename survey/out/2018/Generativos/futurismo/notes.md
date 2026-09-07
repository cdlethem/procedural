---
sketch: 2018/Generativos/futurismo
year: 2018
renderer: P3D
size: [768, 432]
libraries: [peasy]
deterministic: false
ms_first_frame: 1477
animated: true
techniques: [3d-mesh]
primitives: [line, shape]
palette:
  colors: ["#FFFFFF", "#000000", "#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: fixed
composition: centered
parameters:
  - {name: s, default: 16, tried: [40], change: none, effect: "row 2.3x wider, boxes 2.5x taller (bbox 182->421px wide); 'none' label under-reports, see table note"}
  - {name: count, default: 12, tried: [6], change: none, effect: "only 6 boxes, row shorter (143px), same box sizes"}
  - {name: shrink, default: 0.8, tried: [0.5], change: none, effect: "boxes shrink faster, row much shorter (88px), ~6 visible"}
  - {name: d, default: "random(1,3)", tried: ["random(0.3,0.5)"], change: none, effect: "tight spacing, boxes overlap into a dense 46px cluster at center"}
  - {name: maxAng, default: 0.8, tried: [1.5], change: none, effect: "no visible change at frame 1 (bbox identical: 181 vs 182px, 924 vs 919 white px)"}
  - {name: camRadius, default: 400, tried: [120], change: none, effect: "camera 3.3x closer, whole row 3.3x larger (h 29->99px), spans x=2..433"}
reusable_candidates:
  - {name: shrinkingBoxRow, signature: "shrinkingBoxRow(origin, baseSize, count, shrinkFactor, spacing, maxAngle, time) -> void", note: "iterative row of wireframe boxes, each smaller and rotated by damped random angle"}
---

## What it draws
On a black background, a horizontal row of about a dozen white wireframe 3D boxes, all
stacked along the screen's horizontal midline. The box on the right is the largest (a
square-ish cube with cross lines) and they get progressively smaller to the left until
they are tiny dots. In frame 1 the boxes look nearly axis-aligned; the sketch regenerates
every frame with a time-modulated rotation, so the boxes gently wobble/scatter over time.
Only white lines are visible — no colour, no blur, no grain.

## How the code works
- `settings()` (L16-20): window 960x540 * SCALE 0.8 = 768x432, P3D renderer, smooth(4).
- `setup()` (L22-26): loads `post.glsl` into `post`, creates a `PeasyCam` at radius 400,
  then calls `generate()`. `draw()` (L28-30) calls `generate()` every frame, so the whole
  scene is rebuilt each frame (that is why frames differ and `deterministic` is false:
  `time = millis()*random(0.1)` at L52 differs per frame).
- `generate()` (L50-81): `randomSeed(seed)` makes the random sequence reproducible per
  seed, but the time-based terms make the look vary. `background(0)` gives the black
  ground. `noFill(); stroke(255, 200)` (L58-59) is why everything is translucent white
  wireframe — the `colors[]` palette (L139) and `rcol()`/`getColor()` are defined but
  never used in `generate()`.
- The core loop (L64-74): 12 iterations. Each iteration draws the three axis cross lines
  of the current box (`line(-s,0,0, s,0,0)` etc., L65-67) and `box(s*(1+cos(time*...)*0.1))`
  (L68, wireframe cube with slight pulsing size). Then it rotates X/Y/Z by random angles
  bounded by `maxAng = random(0.8)*random(1)` (L63) and damped by `cos(time*random(0.2))`
  (L69-71), translates by `-d*s` in X where `d = random(1,3)` (L62), and shrinks with
  `s *= 0.8` (L73). Starting `s = 16` (L61) at the PeasyCam origin. Result: a leftward
  receding, shrinking, jitter-rotated row of wireframe boxes.
- The post shader (`data/post.glsl`) would add a 3x3 Gaussian blur (weight 0.9), 2%
  random grain, a saturation/contrast/vignette grade (`csb`) and a slight green channel
  gamma. But `//filter(post);` at L80 is commented out, so the rendered image is the raw
  P3D framebuffer: black background, white lines, no grading.
- `keyPressed()` (L32-38): any key re-rolls the seed and regenerates; 's' saves.
- Dead code: `arc2`/`arc3`/`lineDashed` (L88-137) are unused helper functions.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| s_40 | `float s = 16;` -> `float s = 40;` | none (mean 0.006, 1.4% px) | row ~2.3x wider (bbox 182->421px) and boxes 2.5x taller (29->75px); row reaches the left edge; largest box now fills ~75px at screen center | variants/s_40/frame_00001.png |
| count_6 | `for (int i = 0; i < 12; i++) {` -> `for (int i = 0; i < 6; i++) {` | none (mean 0.0012, 0.3% px) | only 6 boxes drawn; row shortened to 143px, box sizes unchanged | variants/count_6/frame_00001.png |
| shrink_0.5 | `s *= 0.8;` -> `s *= 0.5;` | none (mean 0.0013, 0.3% px) | boxes shrink twice as fast; row is only 88px wide, ~6 boxes visible, rest are sub-pixel dots | variants/shrink_0.5/frame_00001.png |
| d_0.3 | `float d = random(1, 3);` -> `float d = random(0.3, 0.5);` | none (mean 0.0018, 0.4% px) | step between boxes drops to 0.3-0.5*s; all 12 boxes overlap into one dense 46px cluster at center | variants/d_0.3/frame_00001.png |
| maxAng_1.5 | `float maxAng = random(0.8)*random(1);` -> `float maxAng = random(1.5)*random(1);` | none (mean 0.0007, 0.2% px) | no visible change (bbox 181 vs 182px, 924 vs 919 white px); the rotation is damped by cos(time*rand) and is ~0 at the 1.4s frame-1 capture | variants/maxAng_1.5/frame_00001.png |
| cam_120 | `cam = new PeasyCam(this, 400);` -> `cam = new PeasyCam(this, 120);` | none (mean 0.0066, 1.6% px) | camera 3.3x closer: whole row ~3.3x larger (h 29->99px), spans x=2..433, largest box ~100px | variants/cam_120/frame_00001.png |

Note on scores: all six runs were labelled `none` by render.py. That label is miscalibrated for
this sketch: the scene is ~1% white pixels on a black background, so even a 3x rescaling moves at
most ~5% of all pixels and stays under the label thresholds. Observations above are from direct
image measurement (bounding box + white-pixel count of non-black pixels) and from the images
themselves; only `maxAng_1.5` is a genuine no-change at frame 1.

## Modularisation notes
- Generic: the shrinking-box-row loop (L64-74) is a self-contained "iterative scale +
  damped random rotation + translate" chain; parameterise as (origin, baseSize, count,
  shrinkFactor, spacing, maxAngle, time). The `Rect` class (L40-48) and the arc/dashed
  helpers are unused dead code.
- One-off art decisions: SCALE 0.8 window, white stroke alpha 200, the time-damped
  `cos(time*random(...))` modulation, the unused `colors[]` palette and the disabled
  `post.glsl` grade (blur 0.9 + grain 0.02 + csb + vignette) — re-enabling `filter(post)`
  would be a distinct look and is the sketch's intended finish.
- Clean parameter object: {baseSize: 16, count: 12, shrink: 0.8, spacing: [1,3],
  maxAngle: 0.8, camRadius: 400, stroke: [255,200], timeScale: 0.1, shaderEnabled: false}.
