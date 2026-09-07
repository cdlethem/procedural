---
sketch: 2018/Generativos/neopla
year: 2018
renderer: P3D
size: [3250, 3250]
libraries: []
deterministic: false
ms_first_frame: 10633
animated: false
techniques: [noise-field, particles, 3d-pointcloud, dots-stippling, grid]
primitives: [box, sphere, line, rect, ellipse, arc, pixels]
palette:
  colors: ["#64CD8B", "#D5FF45", "#717171", "#092CC8", "#000000", "#FFFFFF"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: c (planet count), default: "int(random(40)*random(1)) (0..40)", tried: [5], change: large, effect: "fewer, visually bigger planets; scene much sparser"}
  - {name: sss (cube field box size), default: "width*random(0.018, 0.031)", tried: [0.005], change: large, effect: "cubes shrink to tiny specks; nebula reads as stardust"}
  - {name: cube count, default: 10000, tried: [3000], change: large, effect: "cubes far sparser, more isolated"}
  - {name: det (cube-size noise scale), default: "random(0.01)*random(1)", tried: [0.05], change: large, effect: "chunkier, more blocky cube-size and colour clumps"}
  - {name: cc (grid dots per side), default: "int(random(20, random(20, 100)))", tried: [60], change: large, effect: "dot grid becomes a regular, clearly visible fine grid"}
  - {name: min (planet spike threshold), default: "random(0.2, 0.4)", tried: [0.55], change: large, effect: "halos turn from dense fuzz to sparse spikes; flat base discs become visible"}
reusable_candidates:
  - {name: noiseBall, signature: "noiseBall(center, radius, detail, sizeMin, sizeMax, palette) -> void", note: "3-D noise-gated box cloud in a volume, sizes from 3-D Perlin"}
  - {name: spikyPlanet, signature: "spikyPlanet(pos, radius, threshold, palette) -> void", note: "sphere plus 100k noise-filtered radial spike lines + random rings/arcs"}
  - {name: dotGrid, signature: "dotGrid(cellCount, dotSize, color, alpha) -> void", note: "uniform grid of small dots as background texture"}
---

## What it draws
A dense 3D "deep space" scene on black. Several huge spiky blobs — radial
bursts of fine green, yellow-green, blue and white lines radiating from a
center, like dandelions or sea urchins, some with thin elliptical rings —
float in the mid-ground. Scattered all over are dark (black/grey) 3D boxes of
various depths, plus a large field of small coloured cubes (yellow, green,
white, blue) of varying size, and a faint uniform grid of tiny dots across the
whole canvas. The composition reads as planets with fuzzy halos and a cube
nebula.

## How the code works
`setup()` (line 3) sizes the P3D canvas 3250x3250, calls `generate()` 10 times
saving an image each time, then exits; `draw()` is a no-op, so the harness only
ever sees one frame (static). `generate()` (line 25) first re-rolls its own
`seed` field to 42.

Layers, back to front:
1. Background: one of the 6 palette colours (line 28, 32); grid dots: a
   `cc x cc` grid (cc = 20..100, line 40) of tiny `width*0.002` rects with
   alpha 220-256 (lines 44-48).
2. The whole scene is then centred and given random X/Y/Z rotations
   (lines 51-54), so the "flat" grid appears at an angle.
3. Planets: `c = int(random(40))` (line 60) spheres placed at random points on
   a sphere of radius `size*0.5` (size = width*0.83, line 59), each drawn by
   `planet(s)` (line 103): a filled base sphere (line 113), then 100,000
   uniform-sphere directions (lines 123-128) where 3-D Perlin `noise()` above a
   random threshold (lines 129-130) fires a short radial line whose length is
   noise-mapped between `s1` and `s2` (line 133) — the fuzzy halo. Colours come
   from `getColor(noise(...)*colors.length*2)` (line 131-132), which lerps
   between neighbouring palette entries (lines 193-199) — a noise-driven
   palette. Finally 2-20 random rings/arcs/ticks around each planet
   (lines 137-176).
4. Cube nebula: 10,000 points at random positions in a `[-size, size]^3` cube
   (lines 84-87); a 3-D Perlin value mapped to `[min, max]` (min negative,
   lines 79-88) gates and sizes them — small boxes `box(s)` plus three axis
   lines through each (lines 94-97), coloured by a second noise field through
   `getColor`.

The dominant visual is the 100k-spike `planet()` loop; the cube field and the
rotated dot grid fill the rest. All randomness enters through `random()`
after `randomSeed`, and colour through `rcol()` (random palette pick) and
`getColor(v)` (noise-driven lerp between adjacent palette entries).

## Experiments
Note: the sketch is **not deterministic** — `generate()` re-rolls its own seed
(`seed = int(random(999999))`, line 26) before `randomSeed`, so every variant
also differs in background colour, palette draws and planet placement. All
change scores are therefore inflated by re-randomization; the parameter
effects below are the identifiable parts.

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| c_5 | `int c = int(random(40)*random(1));` -> `int c = 5;` | large | only ~5 planets, each reading much bigger; the rest of the canvas is just sparse dots and a few small cubes (background re-rolled to green) | variants/c_5/frame_00001.png |
| sss_0.005 | `float sss = width*random(0.018, 0.031);` -> `float sss = width*0.005;` | large | cube field shrinks to tiny specks scattered like stardust; the five big fuzzy planet blobs dominate; background re-rolled to white | variants/sss_0.005/frame_00001.png |
| cubes_3000 | `for (int i = 0; i < 10000; i++) {` -> `... i < 3000; ...` | large | cubes much sparser and more isolated, some clearly visible as 3-D boxes; planets and dot grid otherwise as baseline (black background) | variants/cubes_3000/frame_00001.png |
| det_0.05 | `float det = random(0.01)*random(1);` -> `float det = 0.05;` | large | cube-size/colour noise is chunkier: smaller, more uniform cubes and blockier colour clumps; background re-rolled to blue | variants/det_0.05/frame_00001.png |
| cc_60 | `int cc = int(random(20, random(20, 100)));` -> `int cc = 60;` | large | the dot grid becomes a clearly visible regular fine grid across the whole canvas (baseline's grid was coarser/sparser) | variants/cc_60/frame_00001.png |
| spikeMin_0.55 | `float min = random(0.2, 0.4);` -> `float min = 0.55;` | large | planet halos turn from dense fuzz into sparse radial spikes, exposing the flat coloured base discs; cube field dense; background re-rolled to blue | variants/spikeMin_0.55/frame_00001.png |
## Modularisation notes
- `planet()` (lines 103-179) is the core reusable piece: a noise-filtered
  radial-spike sphere. A clean signature would be
  `spikyPlanet(pos, radius, spikeThreshold, spikeCount, palette)`.
- The cube nebula loop (lines 76-99) is generic "3-D noise cloud":
  `noiseBall(center, extent, count, sizeNoise, palette) -> void`. The
  `min < 0` trick (line 79) means the size field is a full lobe, not a mask;
  a positive `min` turns it into a sparse mask.
- The dot grid (lines 39-48) is trivially parameterisable:
  `dotGrid(cells, dotSize, color, alpha)`.
- One-off art decisions: the 6-colour palette (line 186), the double random
  reseed (line 26), the 10-iteration setup loop (lines 7-10), the random ring
  variety inside `planet()` (lines 148-175).
- A clean parameter object: `{palette, planetCount, planetRadius, spikeThreshold,
  spikeCount, cubeCount, cubeExtent, cubeSizeMin, cubeSizeMax, gridCells}`.
