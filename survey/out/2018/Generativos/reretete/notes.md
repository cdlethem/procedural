---
sketch: 2018/Generativos/reretete
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1909
animated: false
techniques: [subdivision, grid, 3d-mesh]
primitives: [rect, shape]
palette:
  colors: ["#FF0000", "#FF6C06", "#EF9FE2", "#0045D8", "#152300"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(200)*random(0.1,1))", tried: [40, 150], change: large, effect: "number of quadtree splits: 40 = fewer, larger tiles; 150 = many small tiles, busier mosaic"}
  - {name: ss, default: 5, tried: [10], change: large, effect: "voxel cell size: 10 doubles stripe thickness, coarser ridges (tile layout unchanged)"}
  - {name: slabHeightFactor, default: 0.5, tried: [1.5], change: large, effect: "3x slab height: striped ridges become tall 3D blocks, top faces smaller"}
  - {name: rotX, default: -PI/6, tried: [-PI/12], change: large, effect: "flatter tilt: top of mosaic more foreshortened, striped front faces dominate"}
  - {name: colors, default: "[#FF0000, #FF6C06, #EF9FE2, #0045D8, #152300]", tried: ["[#FFD23F, #EE5A24, #0B7A75, #1B1B1B, #F5F5F5]"], change: large, effect: "swaps the five flat colours for yellow/orange/teal/white/near-black; layout and stripes identical"}
reusable_candidates:
  - {name: quadtreeSplit, signature: "quadtreeSplit(rect, iterations, minSize, rng) -> Rect[]", note: "repeatedly split a random rect into 4 children at random 30-70% ratios, skipping splits below minSize"}
  - {name: voxelFrame, signature: "voxelFrame(x, y, w, h, depth, cell) -> void", note: "hollow 3D box of small cubes: full front/back faces plus top/bottom rows, drawn with lights"}
---

## What it draws
A 960x960 full-bleed 3D scene: a mosaic of axis-aligned rectangular tiles in five flat
colours (red, orange, pink, blue, near-black green), the whole plane tilted so it reads
as an isometric-ish slab. Many tiles are raised into low "slabs" whose top, front and
back surfaces are striped with thin horizontal bands, because they are built from rows
of tiny cubes. The overall look is a patchwork quilt of flat colour fields broken by
striped 3D ridges, lit by a single directional light.

## How the code works
`setup()` (lines 3-9) opens a 960x960 P3D canvas and calls `generate()` once; `draw()`
is empty, so the image is static. `keyPressed()` regenerates with a new random seed.

`generate()` (lines 32-87):
1. `randomSeed(seed)` (line 34) — the only source of randomness; the whole image is
   determined by one int seed (harness sets `seed := 42`).
2. Quadtree subdivision (lines 38-55): start from one oversized rect
   (-0.8w, -0.8h, 1.6w, 1.6h) that covers the whole canvas (line 39). Loop `sub`
   times (line 40, `sub = int(random(200)*random(0.1, 1))`, i.e. 20-200 splits):
   pick a random rect (line 43), cut it into 4 children at random 30-70% of w and h
   (lines 45-48, snapped to multiples of 5), skip the split if any piece is smaller
   than `max = 20` (line 49), then add the 4 children and remove the parent
   (lines 50-54). Each leaf is drawn once.
3. Camera (lines 57-61): `ortho()`, translate to screen centre, push back z=-1000,
   `rotateX(-PI/6)`, `rotateY(PI*0.2)`, `lights()` — a fixed tilted view with one
   directional light, so tiles get flat shading and the striped slabs show a lit
   top face.
4. Drawing (lines 63-86): each leaf rect gets a flat quad `fill(rcol()); rect(...)`
   (lines 65-66). `rcol()` (lines 115-117) picks uniformly at random from the 5-colour
   array `colors[]` (line 114). Then a voxel frame is built on top of the quad: cell
   size `ss = 5` (line 69), slab height `h = min(w,h)*random(1,8)*0.5` (line 70), grid
   `cz x cy x cx` of 5px cubes; a cube at (x,y,z) is skipped unless it lies on a
   border of the y-z grid (line 76), so the slab is hollow — full front/back faces plus
   top and bottom rows (lines 74-85). The stripes in the image are exactly these rows
   of cubes, each cube filled with a fresh `rcol()` (line 77), so the stripes are
   rainbow bands.

Unused: `saveImage()` (lines 89-92), `arc2()` (lines 94-112), `getColor*()` (lines
118-126) — dead code, never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_40 | `int sub = int(random(200)*random(0.1, 1));` -> `int sub = 40;` | large | fewer, larger tiles: coarse mosaic, each slab's striped face covers a much bigger area | variants/sub_40/frame_00001.png |
| sub_150 | `int sub = int(random(200)*random(0.1, 1));` -> `int sub = 150;` | large | many small tiles: fine, busy mosaic, slabs broken into lots of small striped ridges | variants/sub_150/frame_00001.png |
| ss_10 | `int ss = 5;` -> `int ss = 10;` | large | same tile layout as baseline, but stripe bands twice as thick (10px cubes) | variants/ss_10/frame_00001.png |
| h_1.5 | `float h = min(r.w, r.h)*random(1, 8)*0.5;` -> `... *1.5;` | large | slabs ~3x taller: prominent 3D blocks, long vertical stripe bands, smaller flat tops | variants/h_1.5/frame_00001.png |
| rotX_PI12 | `rotateX(-PI/6);` -> `rotateX(-PI/12);` | large | flatter tilt: top faces more foreshortened, striped front faces take over the image | variants/rotX_PI12/frame_00001.png |
| palette_warm | `int colors[] = {#FF0000, #FF6C06, #EF9FE2, #0045D8, #152300};` -> `{#FFD23F, #EE5A24, #0B7A75, #1B1B1B, #F5F5F5};` | large | same structure in yellow/orange/teal/white/near-black; stripes recolored to match | variants/palette_warm/frame_00001.png |

## Modularisation notes
- **Generic / library-ready**: the quadtree split loop (lines 38-55) is a clean
  `quadtreeSplit(rootRect, iterations, minSize, ratioRange, rng) -> Rect[]` — no
  canvas-specific assumptions except the root rect, which is a parameter. The voxel
  frame (lines 69-85) is a `voxelFrame(origin, w, h, depth, cell, rng)`; the border
  skip (line 76) is the "hollow frame" style and could be a `style` flag
  (solid / frame / shell).
- **One-off art decisions**: the 5-colour palette and per-cube random recoloring
  (what produces the stripes), the fixed camera (`rotateX(-PI/6)`, `rotateY(PI*0.2)`,
  z=-1000, ortho, lights), the 30-70% split ratio range, the min-size guard of 20px,
  and the 5px cell snapping.
- **Clean parameter object**: `{ seed, rootRect, iterations, ratioRange: [0.3, 0.7],
  minSize, cell, heightFactor: [1, 8] * 0.5, palette, paletteMode: random,
  camera: { rotX, rotY, z }, style: frame }`.
