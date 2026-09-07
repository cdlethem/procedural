---
sketch: 2018/Generativos/starmod
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2784
animated: false
techniques: [grid, 3d-pointcloud, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#ADFE03", "#FDFEFA", "#FC4627", "#070708"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(4, 140)", tried: [100], change: large, effect: "every plane gets the same cube count; varied grain disappears, field looks uniform, a big black edge-on region appears"}
  - {name: planes, default: 20, tried: [4], change: large, effect: "fewer, larger grids; more black gaps between planes"}
  - {name: boxScale, default: 0.8, tried: [1.2], change: moderate, effect: "cubes overlap and merge into a nearly continuous tiled surface with fewer gaps"}
  - {name: depth, default: -400, tried: [-200], change: large, effect: "camera closer; planes loom larger, perspective more extreme"}
  - {name: palette[3], default: "#070708", tried: ["#1133AA"], change: subtle, effect: "only subtly: near-black faces read dark blue in small patches"}
reusable_candidates:
  - {name: tiltedBoxPlane, signature: "tiltedBoxPlane(count, boxSize, palette) -> void", note: "cc x cc grid of boxes on a randomly rotated plane in 3D"}
---

## What it draws
A dense field of small 3D cubes filling the whole 960x960 canvas, seen in strong
perspective: rows of cubes recede toward a vanishing region near the middle, with a
few large cube clusters in the corners. Faces carry smooth gradients of lime-green,
red-orange and pale grey/white; black background peeks through gaps. It looks like a
stack of tilted checkerboard sheets made of bevelled tiles.

## How the code works
`setup()` calls `generate()` once (line 8); `draw()` is empty, so the image is static.
- Randomness: `seed` field is set by the harness (line 1); everything else is `random()`
  inside `generate()`: per-plane rotation (lines 35-37), per-plane cube count
  `cc = int(random(4, 140))` (line 43).
- Camera: random `fov = PI/random(1, 3)` and matching `cameraZ` (lines 26-29), then
  the origin is pushed back with `translate(width*0.5, height*0.5, -400)` (line 31),
  which creates the perspective depth of field.
- 20 planes (line 33): each is rotated randomly on all three axes, then a `cc x cc`
  grid of boxes is placed with `translate(ss*i-dd, ss*(j-i)-dd, ss*i-dd)` (line 53) —
  the `j-i` offset lays the cubes along a diagonal band rather than an axis-aligned
  grid. `ss = width*1.4/cc` (line 44) so bigger `cc` = smaller cubes.
- Each box is a hand-built 6-face shape (lines 62-130); every face gets a fresh
  `getColor()` (line 141) that lerps between two palette entries, so faces show
  smooth two-colour gradients from the 4-colour palette (line 137: lime green,
  near-white, red-orange, near-black).
- No lighting (`//lights()` commented, line 39), no blend modes; `smooth(8)` only.
- `draw()` does not regenerate (line 12), so frames 1/10/60 are identical.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_100 | `int cc = int(random(4, 140));` -> `int cc = 100;` | large | uniform fine grain everywhere (no mix of small/large planes); a large black wedge appears lower-left where a plane is seen edge-on | variants/cc_100/frame_00001.png |
| planes_4 | `for (int c = 0; c < 20; c++)` -> `for (int c = 0; c < 4; c++)` | large | only a few big cube grids; vanishing points of the 4 planes clearly visible, more black sky between them | variants/planes_4/frame_00001.png |
| boxScale_1.2 | `box(ss*0.8);` -> `box(ss*1.2);` | moderate | cubes now overlap; the planes read as nearly closed tiled walls with small notches instead of distinct cubes | variants/boxScale_1.2/frame_00001.png |
| depth_-200 | `translate(width*0.5, height*0.5, -400);` -> `translate(width*0.5, height*0.5, -200);` | large | same composition but much closer: planes fill more of the frame, vanishing point more central, extreme perspective | variants/depth_-200/frame_00001.png |
| palette_blue | `int colors[] = {... #070708};` -> `... #1133AA};` | subtle | no visible change at a glance; near-black faces come out dark blue in small patches | variants/palette_blue/frame_00001.png |

## Modularisation notes
- Generic: `tiltedBoxPlane` — a `cc x cc` grid of per-face-random-coloured boxes on a
  randomly rotated plane (lines 33-59 + `box()`, lines 62-130). The diagonal
  placement formula `ss*(j-i)` is the interesting part.
- Generic: `getColor(v)` lerped palette (lines 144-149) — a small reusable
  gradient-palette helper.
- One-off art decisions: 20 planes, `translate(..., -400)` depth, `ss = width*1.4/cc`
  sizing rule, the specific 4-colour palette.
- Clean parameter object: `{planes, ccMin, ccMax, depth, fov, boxScale, palette}`.
