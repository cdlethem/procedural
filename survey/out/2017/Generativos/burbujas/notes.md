---
sketch: 2017/Generativos/burbujas
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1506
animated: false
techniques: [noise-field, distortion, grid, polar]
primitives: [shape, rect, ellipse, line]
palette:
  colors: ["#230D51", "#95E03A", "#F9CD04", "#F2EDED", "#FF82D7"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: count, default: 200, tried: [150], change: large, effect: "fewer blobs, but the shift in the random stream redraws the whole layout at comparable density; lattice layer still fires at i==100"}
  - {name: maxSize, default: 0.55, tried: [0.25], change: large, effect: "much smaller blobs; the warped lattice and dot grids become dominant, background shows through"}
  - {name: strengthScale, default: 1.2, tried: [0.3], change: large, effect: "blobs become markedly rounder/more circular, losing organic wobble"}
  - {name: detailScale, default: 0.4, tried: [0.15], change: subtle, effect: "blob outlines slightly smoother; overall look comparable"}
  - {name: confettiMax, default: 20, tried: [80], change: none, effect: "no visible change"}
reusable_candidates:
  - {name: noiseBlob, signature: "noiseBlob(x, y, r, detail, strength, resolution, color)", note: "polar circle whose vertices are noise-displaced; detail scales inversely with radius"}
  - {name: noiseGrid, signature: "noiseGrid(x, y, w, h, cols, detail, strength, palette)", note: "grid of noise-warped cells, each a halo rect + core rect + 4 corner-to-center lines"}
  - {name: stripeSplit, signature: "stripeSplit(x, y, w, h, segments, palette)", note: "thin rect split into random-width vertical color columns"}
  - {name: dotGrid, signature: "dotGrid(x, y, w, h, cols, dotSize, color)", note: "plain c x c lattice of small ellipses"}
---

## What it draws
Full-canvas scatter of large, flat, organic blobs — lime green, yellow, pink, purple and one big dark charcoal blob — overlapping on a purple background. A fine distorted lattice of tiny squares and cross-lines covers patches of the canvas (most visible top-left and left), plus scattered small dark dots, tiny rotated squares, and thin multicolored streaks. The whole composition is rotated by a random angle.

## How the code works
- `setup()` (L3-8): 960x960 P2D, `smooth(8)`, calls `generate()` once; `draw()` is empty, so the sketch is static (frames 10/60 identical to frame 1).
- `generate()` (L32-105): reseeds (L33-35), picks one random palette color for the full-bleed background (L37), then translates to center and applies one global random rotation (L38-39) — this is why the lattice looks tilted.
- Faint dot lattice: `fill(0,20)` then `points()` draws a 30-50 col/row grid of 2 px dark ellipses over the background (L41-43; helper L126-143).
- Main loop, 200 iterations (L48):
  - Random position in a ±0.7·width square (L49-50).
  - Size `s = width*random(0.55)*random(1)` (L51) — product of two uniforms biases toward small sizes, so most blobs are small-to-medium with occasional large ones.
  - Noise detail `det = 0.4/s` (L52) — detail is inversely proportional to size, so big blobs get smoother outlines; displacement `des = s*random(1.2)` (L53) — displacement scales with size.
  - `sub` is randomized 3-5 but immediately forced to 1 (L58-59), so each iteration draws exactly one shape.
  - Blob: `res = max(32, s/PI*2)` vertices placed at angle `da*k+a`, radius `r = s/2` (L54-56, L67-69); every vertex is noise-displaced by `des()` (L26-30) — 2-D Perlin offset in x and y — then the shape is closed (L71) with no stroke → flat organic blob. Fill is `getColor(random(colors.length))` (L64), which lerps between two adjacent palette colors (L187-194); background is a fixed random list pick (L37).
- At `i == 100` (L74-76): `rects()` (L145-180) draws the lattice — a `random(5,40)`-column grid whose cell corners are noise-displaced; each cell gets a translucent halo rect (alpha 30), an opaque core rect sized by noise (L165), and 4 lines from the corners to the cell center (L172-175), all in a random lerped palette color.
- At `i == 180` (L78-81): a second, even fainter dot grid (`fill(0,10)`, 30-50 cols, ~2 px).
- Confetti: 2 candidates per iteration, each taken with 50% probability (L83-84) — small rotated squares up to 20 px in a random lerped palette color (L87-94).
- Streaks: 1 candidate per iteration, 50% probability (L97-98) — `rectColor()` (L107-124) draws a thin rect (width `random(10,100)`, height `w*random(0.01,0.08)`) split into `random(2,10)` random-width vertical columns, each a random palette color (L113-122) → the thin multicolored dashes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_150 | `for (int i = 0; i < 200; i++) {` -> `for (int i = 0; i < 150; i++) {` | large (0.2047, 0.574) | still densely packed large blobs; the whole layout is redrawn (reduced count shifts the random stream) at comparable density; lattice layer still present | variants/count_150/frame_00001.png |
| size_0.25 | `float s = width*random(0.55)*random(1);` -> `...random(0.25)...` | large (0.231, 0.671) | blobs much smaller; dark warped lattice and dot grids become dominant across the canvas, purple background visible between blobs | variants/size_0.25/frame_00001.png |
| des_0.3 | `float des = s*random(1.2);` -> `float des = s*random(0.3);` | large (0.1685, 0.479) | blobs markedly rounder/more circular, organic edge wobble largely gone | variants/des_0.3/frame_00001.png |
| det_0.15 | `float det = 0.4/s;//random(0.6)/s;` -> `float det = 0.15/s;...` | subtle (0.0342, 0.107) | subtle: blob outlines slightly smoother, overall composition comparable | variants/det_0.15/frame_00001.png |
| confetti_80 | `float ss = random(20)*random(1);` -> `float ss = random(80)*random(1);` | none (0.0092, 0.027) | no visible change | variants/confetti_80/frame_00001.png |

## Modularisation notes
Generic candidates:
- `noiseBlob(x, y, r, detail, strength, resolution, color)` — the L54-72 loop with the `des()` displacement helper; the `detail = 0.4/s` and `strength = s*1.2` relationships are the key tuning rule (smoother as blobs grow).
- `noiseGrid` — `rects()` is self-contained and reusable with a palette argument.
- `stripeSplit` — `rectColor()` is self-contained.
- `dotGrid` — `points()` is a plain lattice, trivially reusable.

One-off art decisions: the 5-color Coolors palette (L182-183) and adjacent-lerp color choice; `sub` forced to 1; the whole-canvas random rotation; lattice triggered at a specific loop index (`i == 100`) rather than always drawn; confetti/streak probabilities; background as a single random palette color.

A clean parameter object: `{count: 200, maxSize: 0.55, detailScale: 0.4, strengthScale: 1.2, gridCols: [5, 40], dotCols: [30, 50], dotSize: 2, confettiMax: 20, confettiChance: 0.5, streakChance: 0.5, streakW: [10, 100], palette: [...], background: 'random-palette'}`.
