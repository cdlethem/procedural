---
sketch: 2018/Generativos/galpon
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1628
animated: false
techniques: [subdivision, 3d-mesh, lines-hatching]
primitives: [line]
palette:
  colors: ["#677E6C", "#B75925", "#DD8C31", "#F7EAD9", "#FDCCC7"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: subs, default: "int(random(400))", tried: ["int(random(200))"], change: subtle, effect: "fewer subdivision passes: boxes larger, hatching sparser and more open"}
  - {name: cc, default: 100, tried: [30], change: moderate, effect: "lines per hatch pass: 30 makes hatching sparse, boxes read as distinct wireframes instead of colour fields"}
  - {name: scale, default: 0.6, tried: [1.0], change: moderate, effect: "zoom: scene 1.7x larger, boxes fill the canvas, strong diagonal edge dominates"}
  - {name: fov, default: "PI/random(3,5)", tried: ["PI/2"], change: moderate, effect: "wider angle: stronger perspective distortion, structure fans out to the frame edges"}
  - {name: strokeAlpha, default: "random(100,160)", tried: [255], change: moderate, effect: "fully opaque first hatch: lines and colour fields visibly more saturated"}
  - {name: splitRange, default: "random(0.3,0.7)", tried: ["random(0.2,0.8)"], change: subtle, effect: "more uneven splits: box proportions slightly more extreme, overall look similar"}
reusable_candidates:
  - {name: randomSplitSubdivide, signature: "randomSplitSubdivide(box, iterations, minSplit, maxSplit) -> Box[]", note: "repeatedly pick a random box and split it into two halves with a random split ratio along one random axis per dimension; returns the surviving boxes"}
  - {name: boxLineHatch, signature: "boxLineHatch(w, h, d, linesPerSide, prob) -> lines", note: "draw N thin lines across each face pair of a box, each line present with probability ~0.5; gives the wireframe hatch look"}
---

## What it draws
A full-bleed white canvas covered by a 3D wireframe "hall": many nested and adjacent box
volumes seen from a slightly tilted, near-top-down perspective. The boxes are not filled;
each is built from hundreds of very thin, semi-transparent straight lines in sage green,
terracotta orange, and pale peach, so denser areas read as flat translucent colour fields
and the whole structure looks like a ghostly architectural volume (galpon = warehouse).
Line density varies across the image, with some boxes much more heavily hatched than
neighbours, giving a patchy, woven texture.

## How the code works
- `setup()` (lines 3-12): 960x960 P3D, `pixelDensity(2)`, `ENABLE_STROKE_PERSPECTIVE` (line 8), then `generate()` once; `draw()` is empty so the image is static (lines 14-15).
- `generate()` (lines 25-120): seeds RNG (`randomSeed`/`noiseSeed`, lines 27-28), white background (line 29). Camera: random fov `PI/random(3,5)` (line 31), then scene moved to centre, pitched 90 degrees with `rotateX(HALF_PI)` (lines 36-39) and shrunk by `scale(0.6)` (line 41) — that is why we look down into the boxes from above at an angle.
- Subdivision (lines 68-104): starts with one box `width*3 x height*3 x width*1.5` at origin (line 69). For `subs = int(random(400))` iterations (line 71) a random box is removed and replaced by its split: for each of the 3 axes a random ratio in [0.3, 0.7] (lines 75-80) splits it, producing 8 child boxes (lines 93-101). Final list is ~subs+1 boxes of varying sizes.
- Drawing (lines 106-119): for each box, `modulo1(w,h,d)` (lines 126-148) draws up to 10 lines per of `cc = 100` positions (line 130) along each face direction; each candidate line is drawn with 50% probability (12 `if (random(1) < 0.5)` lines, 133-144), so each box gets a sparse random hatch of chords across its faces. Called 3 times per box with fresh random colours and alphas: `stroke(rcol(), random(100,160))` then twice `stroke(rcol(), random(160))` (lines 112-117), so boxes are triple-hatched.
- Colour: `rcol()` picks randomly from the 5-colour array (lines 167-170); `getColor` (lerp between list entries) is defined but unused. Randomness enters via the seed, the split ratios, which boxes survive, which hatch lines are drawn, and the per-hatch colour/alpha.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| subs_200 | `int subs = int(random(400));` -> `int subs = int(random(200));` | subtle | sparser, more open structure: boxes are larger and the hatching less dense, with bigger white gaps | variants/subs_200/frame_00001.png |
| cc_30 | `int cc = 100;` -> `int cc = 30;` | moderate | much sparser hatching; individual lines and box frames clearly visible, flat colour fields largely gone | variants/cc_30/frame_00001.png |
| scale_1.0 | `scale(0.6);` -> `scale(1.0);` | moderate | zoomed in: boxes fill the whole canvas, lines much larger, a strong diagonal box edge runs through the middle | variants/scale_1.0/frame_00001.png |
| fov_wide | `float fov = PI/random(3, 5);` -> `float fov = PI/2.0;` | moderate | wider angle of view: stronger perspective distortion, the structure fans out toward the frame edges | variants/fov_wide/frame_00001.png |
| alpha_255 | `stroke(rcol(), random(100, 160));` -> `stroke(rcol(), 255);` | moderate | opaque strokes: lines more saturated, colour fields stronger and more opaque-looking | variants/alpha_255/frame_00001.png |
| split_0.2 | `float w1 = random(0.3, 0.7);` -> `float w1 = random(0.2, 0.8);` | subtle | slightly more uneven box proportions (a few thinner slivers); overall composition looks about the same | variants/split_0.2/frame_00001.png |

## Modularisation notes
- Generic/reusable: the `Box` class (lines 150-160) plus the split loop (lines 72-104) is a clean "stochastic box subdivision" routine parameterisable by (iterations, split-range) — a good library primitive. `modulo1(w,h,d,cc,prob)` (lines 126-148) is a reusable "probabilistic line hatch of a box" routine.
- One-off art decisions: the specific 5-colour palette and per-hatch random alpha; the exact camera rig (fov, 90-degree pitch, 0.6 scale, z=-500); triple-hatching each box; the 0.5 per-line probability.
- Clean parameter object: {seed, iterations, splitMin, splitMax, linesPerHatch, hatchProb, hatchPasses, palette, alphas, fov, scale, pitch}.
