---
sketch: 2018/Generativos/fachada
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1624
animated: false
techniques: [grid, 3d-mesh, 3d-pointcloud]
primitives: [shape]
palette:
  colors: ["#FE4D9F", "#EE1C25", "#2F3293", "#3CB74C", "#0272BE", "#BDCBD5", "#FEFEFE"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(5,100)) (seed 42 ≈ 40-ish, dense)", tried: [20], change: large, effect: "fewer, bigger slabs; same staircase, coarser city"}
  - {name: amp, default: "random(0.38,0.44)", tried: [0.9], change: large, effect: "thicker slabs nearly fill the gaps; more 3-D, less flat"}
  - {name: cameraZ, default: -1000, tried: [-400], change: none, effect: "no visible change: ortho() projection is independent of camera distance along z"}
  - {name: yaw, default: "PI*0.25", tried: ["PI*0.05"], change: large, effect: "facade rotates toward a head-on view; staircase reads as straight banded wall"}
  - {name: palette, default: "7-color pop list", tried: ["4 dark grays"], change: large, effect: "same structure, monochrome dark grays; black gaps nearly disappear"}
reusable_candidates:
  - {name: isoBoxCity, signature: "isoBoxCity(cellCount, slabDepth, cameraDist, tiltX) -> void", note: "isometric grid of slabs, one random palette colour per face"}
---

## What it draws
A flat, fully tiled image that reads as an isometric city facade: a dense grid of
cube-like slabs receding in depth, each slab's visible faces a flat saturated colour
(pink, red, blue, green, white, pale blue, dark navy) with thin black gaps between
slabs where the black background shows through. The slabs are arranged in a stepped
diagonal staircase, so the composition looks like a tilted, pixelated building wall
viewed from the corner. No shading or gradients — pure flat colour per face.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty (line 10-12), so the image is
static (frames 10/60 identical to 1). Randomness enters only through the global
`seed` (line 1) which the harness sets to 42 before `random()` is first used.

- Line 25-27: `ortho()` + `translate(width/2, height/2, -1000)` puts an orthographic
  camera 1000 units in front of the scene origin.
- Line 31-34: fixed orientation `rotateY(HALF_PI); rotateX(HALF_PI); rotateZ(PI*0.25)`
  gives the isometric corner view; a random extra `rotateX(random(-2, 2))` tilts it.
- Line 36-38: `cc` is a random count (5..100) that sets the cell size `ss = width*3/cc`
  and the scene half-extent `dd`.
- Line 42-49: two nested loops place a slab `box(ss, ss, ss*amp)` at
  `(ss*i-dd, ss*i-dd, j*ss*0.5-dd)` for `i, j in 0..cc*2-1`; the z offset grows with j,
  which is what produces the stepped diagonal staircase of the facade.
- Line 40: `amp = random(0.38, 0.44)` is the slab thickness relative to the cell;
  slabs are thinner than they are wide, leaving black gaps between rows.
- `box(w,h,d)` (line 54-106) draws 6 explicit quads, one per face, each filled with
  an independent `rcol()` draw (line 59 etc.), so every face of every slab gets its
  own random colour from the 7-colour palette (line 132, 133-135). There is no
  lighting, so all faces are flat.
- `getColor()` (line 136-144) lerps between neighbouring palette entries but is never
  called — dead code. The `Rect` class (line 108-116) is likewise unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_20 | `int cc = int(random(5, 100));` -> `int cc = 20;` | large | coarser grid: fewer, larger slabs, same diagonal staircase and palette | variants/cc_20/frame_00001.png |
| amp_0.9 | `float amp = random(0.38, 0.44);` -> `float amp = 0.9;` | large | much thicker slabs; black gaps mostly close up, faces look more volumetric | variants/amp_0.9/frame_00001.png |
| camera_400 | `translate(width/2, height/2, -1000);` -> `translate(width/2, height/2, -400);` | none | no visible change (ortho projection ignores z distance) | variants/camera_400/frame_00001.png |
| rotateZ_0.05 | `rotateZ(PI*0.25);` -> `rotateZ(PI*0.05);` | large | facade turned toward head-on; steps read as straight diagonal bands, less corner view | variants/rotateZ_0.05/frame_00001.png |
| palette_gray | 7-color list -> `{#111111, #333333, #555555, #777777}` | large | identical geometry, monochrome dark grays; gaps blend into the black background | variants/palette_gray/frame_00001.png |

## Modularisation notes
- Generic: the isometric box-grid generator (`generate()` minus the art-specific
  palette) is a clean parameter object: cell count `cc`, slab aspect `amp`, camera
  distance, orientation (rotateZ + random rotateX tilt). The 6-face `box()` with
  per-face independent fill is reusable for any isometric slab city.
- One-off art decisions: the 7-colour pop palette, the `j*ss*0.5` staircase offset,
  the random tilt range, and the full-bleed 960² framing.
- A clean `IsoFacade` parameter object would be: `{cellCount, slabAspect,
  cameraDistance, yaw, pitch, palette, faceColorFn}` with the loop over
  `i, j in 0..cellCount` unchanged.
