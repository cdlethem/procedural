---
sketch: 2018/Generativos/reretete2b
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2079
animated: false
techniques: [subdivision, grid, noise-field, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#283149", "#404b69", "#f73859", "#dbedf3"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: ss, default: 8, tried: [16], change: moderate, effect: "coarser lattice, larger wireframe cells"}
  - {name: strokeAlpha, default: 60, tried: [200], change: moderate, effect: "denser, more opaque wireframe surface"}
  - {name: det, default: "random(0.02)", tried: ["random(0.05)"], change: moderate, effect: "finer, tighter ripples on the surface"}
  - {name: rotX, default: "-PI/6", tried: ["-PI/3"], change: large, effect: "steeper top-down view, more foreshortened lattice"}
  - {name: hScale, default: "random(1,8)*0.5", tried: ["random(1,20)*0.5"], change: moderate, effect: "taller cube walls, stronger vertical ridges at partition borders"}
  - {name: fillChance, default: 0.01, tried: [0.1], change: moderate, effect: "many more solid red/white beads scattered over the surface"}
  - {name: subdivideRect, signature: "subdivideRect(rects, iterations, minSize) -> Rect[]", note: "random guillotine subdivision of one rectangle into a partition, sizes snapped to a grid"}
  - {name: noiseBorderCubes, signature: "noiseBorderCubes(rect, cell, height, noiseDetail, noiseOffset) -> void", note: "draw cube outlines on the border of a rect with per-cell noise-displaced depth"}
---

## What it draws
Full-bleed 3D scene on a black background: a dense field of small cube outlines in
muted red, dark navy, and pale off-white, laid out in a flat lattice tilted toward the
viewer. The surface ripples like a carpet, with patchy regions of different density and
height; a few cubes are solid (mostly pale ones) and read as scattered bright beads.
Faint blocky boundaries are visible where one patch ends and another begins.

## How the code works
- `setup()` (L3-9) creates a 960x960 P3D canvas and calls `generate()` once; `draw()`
  is empty (L11-12), so the piece is static. Seed comes from `seed` (L1), re-seeded via
  `randomSeed(seed)` (L34).
- **Subdivision** (L38-55): starts from one rectangle twice the canvas size
  (L39); for `sub = int(random(300)*random(0.1, 1))` iterations (L40) a random rect is
  picked (L43) and split at a random 30-70% point of its width and height, snapped to 4
  px (L45-48); the original rect is removed and four children added (L50-54), so the
  list ends as a non-overlapping partition. Pieces smaller than `max = 20` px are
  skipped (L49).
- **Camera** (L57-61): `ortho()`, centred, pushed back to z=-1000, then
  `rotateX(-PI/6)` and `rotateY(PI*0.2)` tilt the whole plane; `lights()` gives the
  shaded look of the filled cubes.
- **Cubes** (L69-97): for each partition rect, a grid of cells with spacing `ss = 8`
  (L75) and total height `h = min(r.w, r.h)*random(1, 8)*0.5` (L76). Only the border
  ring of each rect is drawn (L84 skips interior cells), so every rect becomes a low
  wall of cubes. Each cube's depth is displaced by 3D noise
  `noise(des + x*det, des + y*det, des + z*det)*30` (L89) with a per-rect offset
  `des = random(1000)` and detail `det = random(0.02)` (L80-81) — that is why each
  patch ripples independently.
- **Colour**: every cube gets `stroke(rcol(), 60)` — a random palette colour at low
  alpha (L86); with 1% probability a cube is also solid-filled (`if (random(1) < 0.01)
  fill(rcol())`, L88), producing the scattered bright beads. Palette is the 4-colour
  list at L125 (`rcol()` picks uniformly, L126-128).
- The unused `rect()` call (L72) and the commented-out lighting block (L62-67) are
  leftovers; `arc2()` (L105-123) is dead code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ss_16 | `int ss = 8;` -> `int ss = 16;` | moderate | coarser lattice: larger, fewer wireframe cells; ripples still visible but on a coarser grid | variants/ss_16/frame_00001.png |
| alpha_200 | `stroke(rcol(), 60);` -> `stroke(rcol(), 200);` | moderate | strokes much more opaque: the wireframe surface reads denser and flatter, less of the see-through depth; reds and whites dominate | variants/alpha_200/frame_00001.png |
| det_0.05 | `float det = random(0.02);` -> `float det = random(0.05);` | moderate | higher noise detail: ripples become finer and more tightly packed, smaller-scale undulation across the surface | variants/det_0.05/frame_00001.png |
| rotX_-PI3 | `rotateX(-PI/6);` -> `rotateX(-PI/3);` | large | steeper top-down tilt: the plane is much more foreshortened, the lattice compresses vertically and the scene reads as a flat textured carpet | variants/rotX_-PI3/frame_00001.png |
| h_20 | `float h = min(r.w, r.h)*random(1, 8)*0.5;` -> `float h = min(r.w, r.h)*random(1, 20)*0.5;` | moderate | taller cube walls: stronger vertical ridges along the partition borders, more three-dimensional relief | variants/h_20/frame_00001.png |
| fillp_0.1 | `if (random(1) < 0.01) fill(rcol());` -> `if (random(1) < 0.1) fill(rcol());` | moderate | far more solid cubes: the surface is densely speckled with solid red and pale beads instead of a few scattered ones | variants/fillp_0.1/frame_00001.png |

## Modularisation notes
- `subdivideRect` (L38-55) is a clean, generic guillotine-partition generator:
  (initialRect, iterations, minSize, snap) -> Rect[]. Art decisions: the oversized
  starting rect, the 30-70% split range, the 4px snap.
- `noiseBorderCubes` (L69-97) is a generic "border lattice with noise-displaced
  depth" drawer: (rect, cell, height, detail, offset, palette, alpha). Art decisions:
  border-only rendering, the 1% solid-cube sprinkle, the low alpha.
- A clean parameter object: {subdivisions, minPiece, cellSize, heightScale,
  noiseDetail, noiseAmp, borderAlpha, fillChance, palette, rotX, rotY}.
- One-off: the exact 4-colour palette, the ortho camera tilt values.
