---
sketch: 2018/Generativos/serrras
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1797
animated: false
techniques: [subdivision, lines-hatching, 3d-mesh]
primitives: [line]
palette:
  colors: ["#EFF1F4", "#81C7EF", "#2DC3BA", "#BCEBD2", "#F9F77A", "#F8BDD3", "#272928"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: subs, default: "int(random(4000))", tried: [1500], change: moderate, effect: "fewer subdivision iterations: larger, looser boxes; mass looks lighter with more white gaps"}
  - {name: cc, default: 100, tried: [30], change: moderate, effect: "sparser, evenly spaced hatch lines: soft translucent mass becomes a visible regular lattice"}
  - {name: scale, default: 0.6, tried: [1.2], change: moderate, effect: "zoomed in: fewer, larger volumes; individual hatch lines clearly visible"}
  - {name: fov, default: "PI/random(3,5)", tried: ["PI/2"], change: moderate, effect: "wide FOV: strong perspective stretch, elongated volumes, dramatic convergence"}
  - {name: "first-pass alpha", default: "random(100,160)", tried: ["random(220,255)"], change: subtle, effect: "no visible change; lines overlap so heavily the extra opacity saturates"}
  - {name: "width split range (w1)", default: "random(0.3,0.7)", tried: ["random(0.45,0.55)"], change: moderate, effect: "more uniform splits: same composition, less lopsided box proportions"}
reusable_candidates:
  - {name: subdivideBoxes, signature: "subdivideBoxes(Box root, int iterations, float[] splitRange) -> Box[]", note: "repeatedly pick a random box, split it into 8 children at three random ratios, drop the original"}
  - {name: hatchedBox, signature: "hatchedBox(float w, float h, float d, int lines, int alpha) -> void", note: "draw up to `lines` random parallel lines per axis through the box to fake a translucent hatched volume"}
---

## What it draws
A dense, layered 3-D mass of rectangular volumes seen from a high, near-top-down perspective,
like an abstract city or relief. Every volume is suggested only by very fine, semi-transparent
parallel hatch lines, so the shapes read as soft translucent slabs and columns. Dominant colours
are pale blue, teal/green, and yellow, with touches of pink, grey and near-black lines on a
white background.

## How the code works
- `setup()` (serrras.pde:3-12): 960x960 P3D, then `generate()`; `draw()` is empty (static).
- Camera (lines 31-41): random narrow FOV `PI/random(3,5)`, scene centred, `rotateX(HALF_PI)`
  gives the top-down view, tiny random Y/Z tilt, `scale(0.6)` zooms out.
- Subdivision (lines 67-104): start from one box 3x canvas wide (line 69). `subs = int(random(4000))`
  iterations: pick a random box, split it into 8 children using three independent random ratios
  (`w1`,`h1`,`d1` in 0.3-0.7, lines 75-80), add the children, remove the parent (line 103).
  Surviving box count is ~1 + subs*7, each much smaller than its parent.
- Hatching (lines 106-119 + `modulo1` 126-148): for every surviving box, `modulo1` is called 3
  times, each with a random palette colour and random alpha (first pass `random(100,160)`,
  then `random(160)` twice). `modulo1` places `cc = 100` line positions along each of the three
  axes and, per position, draws up to 10 axis-parallel chords through the box with 50% probability
  (lines 131-144). The many overlapping translucent strokes are what create the soft volume look.
- Colour: `rcol()` (lines 167-170) picks uniformly from the 7-colour list; `getColor()` (a
  lerp version) is unused in `generate()`.
- Randomness enters via `randomSeed(seed)`/`noiseSeed(seed)` (27-28): splits, ratios, line
  selection, and colours are all random; no noise field is used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| subs_1500 | `int subs = int(random(4000));` -> `int subs = int(random(1500));` | moderate (mean 0.0767, 27.2%) | coarser subdivision: boxes read larger and looser, mass lighter with more white gaps | variants/subs_1500/frame_00001.png |
| cc_30 | `int cc = 100;` -> `int cc = 30;` | moderate (mean 0.0846, 33.7%) | hatch lines sparser and evenly spaced: soft mass becomes a visible regular lattice/grid | variants/cc_30/frame_00001.png |
| scale_1.2 | `scale(0.6);` -> `scale(1.2);` | moderate (mean 0.0936, 38.7%) | zoomed in: fewer, larger volumes fill the frame; individual hatch lines clearly visible | variants/scale_1.2/frame_00001.png |
| fov_PI_2 | `float fov = PI/random(3, 5);` -> `float fov = PI/2;` | moderate (mean 0.0938, 41.8%) | wide FOV distorts perspective strongly: volumes elongated and stretched, dramatic convergence | variants/fov_PI_2/frame_00001.png |
| alpha_220_255 | `stroke(rcol(), random(100, 160));` -> `stroke(rcol(), random(220, 255));` | subtle (mean 0.0241, 0.9%) | no visible change; the dense overlapping strokes already saturate, so higher alpha does nothing perceptible | variants/alpha_220_255/frame_00001.png |
| w1_0.45_0.55 | `float w1 = random(0.3, 0.7);` -> `float w1 = random(0.45, 0.55);` | moderate (mean 0.0805, 30.6%) | near-uniform width splits: same overall composition but box proportions less lopsided | variants/w1_0.45_0.55/frame_00001.png |

## Modularisation notes
- Generic: `subdivideBoxes` (stochastic octant subdivision with a split-ratio range) and
  `hatchedBox` (probabilistic parallel-line volume shading) are both reusable as-is; a camera
  helper (top-down perspective with random tilt) is a third candidate.
- One-off art decisions: the 7-colour pastel list, the three repeated `modulo1` passes with
  different alpha ranges, the 0.3-0.7 split range, and the 100-line density.
- A clean parameter object would contain: `iterations` (subs), `splitRange` [0.3, 0.7],
  `linesPerFace` (cc), `alphaRange` per pass, `palette`, `scale`, `fov`, and root box size.
