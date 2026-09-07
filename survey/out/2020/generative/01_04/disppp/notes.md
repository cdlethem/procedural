---
sketch: 2020/generative/01_04/disppp
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 10741
animated: false
techniques: [noise-field, dots-stippling, packing]
primitives: [ellipse, point]
palette:
  colors: ["#FF4507", "#4111AF", "#FF56B6"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: det, default: "random(0.02)", tried: [0.005], change: large, effect: "lower noise frequency = larger, softer clumps with wider sparse areas between them"}
  - {name: sizeAmp, default: 45, tried: [20], change: large, effect: "smaller noise amplitude = smaller rejection radius = far denser coverage, white gaps mostly fill in; render slowed to ~31s first frame (near the 30s budget) because more points are accepted"}
  - {name: scale, default: 0.5, tried: [1.0], change: moderate, effect: "doubling the noise-driven radius halves accepted-point density: same clump pattern, but thinner and with larger white regions"}
  - {name: colorProb, default: 0.1, tried: [0.5], change: large, effect: "5x more colored dots (orange/violet/pink); dense clumps become visibly multicolored instead of nearly solid black"}
  - {name: skipProb, default: 0.2, tried: [0.5], change: moderate, effect: "half the accepted dots are drawn as smaller 3px points instead of 4px ellipses; clumps look more granular and colored specks roughly halve (color only applies to ellipse-pass dots)"}
reusable_candidates:
  - {name: noiseDiscardPacking, signature: "noiseDiscardPacking(attempts, det, sizeBase, sizeAmp) -> PVector[]", note: "random-sampling discard packing whose rejection radius is driven by a 2-D noise field; produces noise-shaped dense/sparse dot regions; O(n^2) linear scan, so cap attempts"}
  - {name: sparseAccentColor, signature: "sparseAccentColor(points, pColor) -> color[]", note: "color a random fraction p of points from a small palette, rest black; classic stipple accent"}
---

## What it draws
A full-bleed field of tiny black dots on a near-white (250) background at 960x960.
Dot density varies smoothly: large soft blobs of dense, almost solid black dots
alternate with wide sparse areas of scattered dots. Within the dense black
regions, a small fraction of dots are orange-red, violet, or pink (the sketch
palette), reading as tiny colored specks inside the dark clumps.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static
(baseline frames 10/60 identical to frame 1). Flow in `generate()` (disppp.pde):

1. `hint(DISABLE_DEPTH_TEST)` (L46) — the only reason for the P3D renderer;
   `randomSeed`/`noiseSeed` (L48-49); `background(250)` (L53).
2. `det = random(0.02)` (L54) picks a small noise frequency in [0, 0.02); with
   a fixed seed it is deterministic, so the clump scale is fixed per seed.
3. Main loop (L55-80): 1,000,000 attempts. Each attempt takes a random (x, y);
   `s = (3 + pow(noise(x*det, y*det), 1.5) * 45) * 0.5` (L58-59) is a
   noise-driven rejection radius: low-noise areas get small s (dots pack
   densely), high-noise areas get large s (dots push apart — the sparse
   regions). A linear-scan discard test (L61-70) rejects the point if it lies
   within `(s + other.z) * 0.5` of any previously accepted point. This is the
   packing that carves the noise field into dense/sparse clumps.
4. Drawing, first pass (L71-79): accepted points are stored in `points`
   (with z = s). 20% of them (`random(1) < 0.2`, L76) skip the ellipse draw
   and are only drawn later as points; of the rest, 10% get
   `fill(rcol())` — a uniform random pick from `colors[]` (#FF4507 orange-red,
   #4111AF violet, #FF56B6 pink, L102-104) — the rest stay `fill(0)`. The
   ellipse is always a fixed 4x4 (L78): the noise-driven s only affects
   spacing, never drawn size.
5. Second pass (L82-89): every accepted point is drawn again as a
   `point()` at `strokeWeight(3)` — 10% skipped, 10% colored with `stroke(rcol())`,
   rest black. So each dot is drawn once (ellipse or point), plus the colored
   accents.
Randomness enters via the seed (L4), the attempt positions, the skip/color
rolls, and `rcol()`; the only smooth structure is the noise field in s.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_0.005 | `float det = random(0.02);` -> `float det = random(0.005);` | large | clumps get clearly larger and softer: fewer, broader dense blobs with wide sparse areas between; same dot sizes and colors | variants/det_0.005/frame_00001.png |
| s_20 | `float s = 3+pow(noise(x*det, y*det), 1.5)*45;` -> `... *20;` | large | much denser: most of the white gaps fill in, clumps become broad near-solid regions; render hit ~31s first frame (slightly over budget, completed) | variants/s_20/frame_00001.png |
| scale_1 | `s *= 0.5;` -> `s *= 1.0;` | moderate | same clump pattern but overall sparser: thinner clumps, larger white regions, lower dot count | variants/scale_1/frame_00001.png |
| col_0.5 | `if (random(1) < 0.1) fill(rcol());` -> `if (random(1) < 0.5) fill(rcol());` | large | ~5x more colored dots: dense clumps turn multicolored (orange/violet/pink specks everywhere) instead of nearly solid black | variants/col_0.5/frame_00001.png |
| skip_0.5 | `if (random(1) < 0.2) continue;` -> `if (random(1) < 0.5) continue;` | moderate | half the dots now drawn as smaller 3px points: clumps look more granular, colored specks roughly halved (color only rolls in the ellipse pass) | variants/skip_0.5/frame_00001.png |

## Modularisation notes
The generic, library-worthy block is the **noise-modulated discard packing**
(L55-80): given canvas size, attempt count, noise frequency `det`, size base
(3) and size amplitude (45), it returns a set of packed points whose density
follows the noise field. It is O(n^2) in accepted points because of the linear
scan (L61-70), so a real library function should take an attempt cap and/or a
spatial grid. The noise itself is `pow(noise(x*det, y*det), 1.5)` — the 1.5
power biases toward the low end (dense) and sharpens clump edges; both the
exponent and the base/amplitude are art parameters.

The **two-pass draw** is mostly a one-off art decision: the fixed 4x4 ellipse
plus 3px point, the 20% skip roll, and the 10% accent-color roll only exist to
create the speckled texture. A clean parameter object would be:
`{size, attempts, det, sizeBase, sizeAmp, noiseExponent, dotSize, pointWeight,
skipProb, colorProb, palette[], background}`. `rcol()` (uniform random from a
list) is trivially reusable; the commented-out `getColor(float v)`
noise-driven lerp variant (L109-115) is a useful second accent strategy that
this sketch does not use. The `triangulate` and `toxi` imports (L1-2) are
unused dead code.
