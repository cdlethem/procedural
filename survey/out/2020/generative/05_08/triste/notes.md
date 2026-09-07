---
sketch: 2020/generative/05_08/triste
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1930
animated: false
techniques: [noise-field, particles, dots-stippling, curves]
primitives: [ellipse, shape]
palette:
  colors: ["#060606", "#534A3B", "#6A4224", "#AC7849", "#EEE7DE"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: detH, default: "random(0.0005)", tried: ["random(0.002)"], change: large, effect: "coarser noise banding: trunks become thin straight strokes, dot carpet spreads denser across the lower half"}
  - {name: dotCount, default: 120000, tried: [40000], change: large, effect: "sparser stipple, much more tan background shows through; trunks unchanged"}
  - {name: sizeExponent, default: 2.6, tried: [1.4], change: large, effect: "lower exponent makes dots and trunks bigger at mid/upper heights: trunks become huge dark masses dominating the frame"}
  - {name: trunkChance, default: 0.0005, tried: [0.0015], change: moderate, effect: "3x more trunks; upper half becomes a dense dark thicket of overlapping trunks and branches"}
  - {name: trunkSteps, default: 2000, tried: [500], change: subtle, effect: "subtle: trunks truncated at mid-canvas, never reaching the floor; bottom two-thirds is uniform dot carpet"}

## What it draws
An autumn woodland scene on a flat warm-tan background: several tall, tapering charcoal tree
trunks rise from the bottom and droop into thin dark branches near the top, while the lower
two-thirds of the canvas is a dense stippled carpet of small dots in black, brown, tan and
cream. Dots get denser and larger toward the bottom edge, giving a hazy depth-of-field feel.
Static image; all content is drawn once in `generate()` during setup.

## How the code works
`setup()` -> `generate()` (triste.pde:48). Randomness is seeded from `seed` (line 4, harness
overwrites to 42). Background is one random palette colour (line 55, `rcol()`, line 180).

Main loop (lines 61-90): 120000 iterations.
- Each iteration picks a uniform x (line 62-63) and a y from
  `noise(x*detH)*0.2 + random(1)*random(1)` (line 64). The `random*random` product is
  bottom-biased, so ~all dots fall in the lower 80% of the canvas; `noise(x*detH)` with
  `detH < 0.0005` (line 57) adds a slowly varying horizontal band on top, making density
  clump into vertical columns.
- Dot size `s = 16*pow(vy, 2.6)` (line 66) grows with height position, so the bottom dots
  are biggest.
- Dots are drawn by `hoja()` (line 151): a filled shape of a circle where 80% of vertices
  are randomly skipped (line 158) -> ragged splat/leaf blobs. Fill is `rcol()` (line 68),
  uniform random from the 5-colour list (line 176: near-black, dark brown, rust, tan,
  cream).
- With probability 0.0005 (line 72, ~60 times per run) a "trunk" is spawned: a 2000-step
  random walk (lines 80-88). Angle starts from 2-D noise (line 74, pointing upward,
  `-HALF_PI*0.7`) and is perturbed each step by noise (line 81) at amplitude `amp`
  (line 75); speed `v` (line 79) also scales with `vy`. Each step draws an ellipse of
  size `s*5*amp x s*3*amp` (line 87), shrinking 0.2% per step (line 87-88), filled from
  `getColor(j*v*detCol)` (line 84, line 188): lerp between adjacent palette entries,
  alpha 250. These trails are the dark tapering trunks; their upward start angle and
  shrinking width make them look like trees, and the noise bend droops the tops into
  branches.

`toxi` SimplexNoise and triangulate are imported but unused; Processing's built-in
`noise()` drives everything. No blend modes; depth test disabled (line 50).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| detH_0.002 | `float detH = random(0.0005);` -> `float detH = random(0.002);` | large (0.2046, 0.615) | trunks become thin, straight black strokes; dot carpet extends higher and is densest at the bottom | variants/detH_0.002/frame_00001.png |
| dotCount_40000 | `for (int i = 0; i < 120000; i++) {` -> `... i < 40000 ...` | large (0.1686, 0.522) | visibly sparser stipple, flat tan background shows between dots; trunks look the same | variants/dotCount_40000/frame_00001.png |
| sizeExponent_1.4 | `float s = 16*pow(vy, 2.6);` -> `float s = 16*pow(vy, 1.4);` | large (0.2494, 0.753) | trunks far thicker and taller, dark masses fill much of the frame; mid-height dots also larger | variants/sizeExponent_1.4/frame_00001.png |
| trunkChance_0.0015 | `if (random(1) < 0.0005) {` -> `if (random(1) < 0.0015) {` | moderate (0.117, 0.376) | about 3x more trunks; top half is a crowded dark thicket of trunks and drooping branches | variants/trunkChance_0.0015/frame_00001.png |
| trunkSteps_500 | `for (int j = 0; j < 2000; j++) {` -> `... j < 500 ...` | subtle (0.0187, 0.077) | subtle: trunks stop at mid-canvas height, lower two-thirds is an even dot carpet with no trunks | variants/trunkSteps_500/frame_00001.png |

## Modularisation notes
Generic, reusable:
- `hoja()` - jittered blob primitive (keep-fraction, radius, x/y, s) - a "splat" primitive
  independent of the sketch.
- The trunk walk (lines 72-89) is a self-contained noise-steered walker with
  parameters (spawn probability, step count, angle noise detail, amplitude, speed,
  size decay, colour detail). Extractable as `noiseTrail(x, y, opts)`.
- The y-distribution `noise(x*det)*band + random*random` is a reusable "ground fog"
  distribution (bottom-biased + horizontal banding).

One-off art decisions: the specific 5-colour autumn palette and the commented-out palette
alternatives; the `pow(vy, 2.6)` size exponent; the upward angle offset `-HALF_PI*0.7`
that turns generic trails into "trees"; the large commented-out rect/quad block (lines
93-148).

A clean parameter object: {palette[], dotCount, dotSizeBase, sizeExponent, bandDetail
(detH), trunkProbability, trunkSteps, trunkAngleDetail, trunkAmp, trunkSpeed, trunkDecay}.
