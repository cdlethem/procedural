---
sketch: 2018/Generativos/arc
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1534
animated: false
techniques: [polar, grid, 3d-mesh, symmetry, distortion]
primitives: [line, rect]
palette:
  colors: ["#012698", "#51267F", "#BA1E76", "#FD3251", "#FE9D60", "#EDB1F0", "#FAD0F4", "#A39DC9"]
  selection: lerp-between
composition: radial
parameters:
  - {name: c, default: "random(18, 45)", tried: ["random(18, 45)*3"], change: subtle, effect: "denser line grid; composition otherwise unchanged"}
  - {name: rings, default: 12, tried: [4], change: moderate, effect: "fewer rings -> smaller, sparser centre flower, more background shows"}
  - {name: cc, default: "int(random(38, 90)*4)", tried: ["int(random(38, 90))"], change: large, effect: "4x fewer slabs per ring -> sparse, separated, coarser spikes"}
  - {name: size, default: "width*0.3*random(2)", tried: ["width*0.3*random(2)*2"], change: large, effect: "ring radius doubled -> burst much larger, fans reach the corners"}
  - {name: w, default: "random(30, 60)*0.6", tried: ["random(30, 60)"], change: moderate, effect: "slabs ~1.7x wider -> denser/blockier fans, less needle-like"}
  - {name: fov, default: "PI/random(1.4, 1.9)", tried: ["PI/random(0.7, 0.9)"], change: large, effect: "wider FOV -> strong perspective, grid curved/stretched, burst pushed to edges"}
reusable_candidates:
  - {name: radialSlabRing, signature: "radialSlabRing(count, radius, boxW, boxH, boxD, colorCycle, ampX, iteX, ampY, iteY, iteScl) -> void", note: "ring of thin 3D boxes on a circle, each rotated radially with cosine-modulated tilt and scale - the petal/fan motif"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], t) -> color", note: "getColor(): fractional index into palette with lerpColor between neighbours (arc.pde:112-119)"}
  - {name: faintGrid, signature: "faintGrid(count, scale, color, alpha) -> void", note: "count horizontal + count vertical lines over an oversized area (arc.pde:54-57)"}
---

## What it draws
Static 960x960 image on a pale pink background (one of the palette colours). A faint grid of thin
dark lines crosses the whole canvas. In the centre, a large flower-like burst made of hundreds of
thin rectangular slabs arranged in concentric rings: petal clusters of deep indigo, magenta, red,
orange and cream overlap, and spiky fan-shaped bursts radiate from the four corners and mid-edges
of the frame. Overall impression: a symmetrical mandala of overlapping thin 3D plates with strong
perspective distortion.

## How the code works
Single tab, `arc.pde`. `setup()` (line 7) calls `generate()` once; `draw()` is empty (lines
14-15), so the image is static. Randomness comes from a global `seed` (line 3), reset via
`randomSeed`/`noiseSeed` at lines 36-37.

- **Background**: `rcol()` picks one palette colour at random (lines 27, 106-108).
- **Lights**: ambient + 3 directional lights (lines 29-34) shade the 3D boxes; P3D renderer (line 8).
- **Camera**: random FOV `PI/random(1.4, 1.9)` (line 40) with `perspective()` (line 42), plus small
  random tilts of +-0.1 rad on all three axes (lines 46-48) - this is the perspective distortion of
  the whole composition.
- **Faint grid**: `c = random(18, 45)` lines in each direction (line 50), spaced by `width*sc/c`
  with `sc = random(4)` (lines 51-57). Drawn with `stroke(0, 60)` (line 81, set just before the slab
  loop but still in effect here) - thin near-black lines at low alpha.
- **12 slab rings** (lines 60-95): each ring `j` places `cc = int(random(38, 90)*4)` boxes (152-359)
  around a circle of radius `size = width*0.3*random(2)` (line 62). For each box `i` (line 83): the
  colour cycles through the palette via `getColor(ic + dc*i)` (lines 64-65, 85, 112-119); the box is
  translated to the circle point, rotated radially by `da*i`, then tilted on X/Y by cosine waves
  (`ampAngX/iteAngX`, `ampAngY/iteAngY`, lines 89-90) and scaled by a cosine wave
  (`sca*cos(val*iteScl*TAU)*0.2+0.8`, line 91); finally a thin slab `box(w*ss, h*ss, d*ss)` is drawn
  (line 92). `w` is the slab width (18-36), `h` the height (thin, 0.25-0.6), `d` the depth (12-36)
  (lines 74-76). The combination of many thin radially-oriented slabs with cosine scale/tilt waves is
  what produces the petal and fan shapes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| c_x3 | `int c = int(random(18, 45));` -> `int c = int(random(18, 45))*3;` | subtle | line grid denser (~3x more lines each direction); central flower and corner fans look unchanged | variants/c_x3/frame_00001.png |
| rings_4 | `for (int j = 0; j < 12; j++) {` -> `for (int j = 0; j < 4; j++) {` | moderate | 4 rings instead of 12: centre flower smaller and sparser, less overlap, more background shows through | variants/rings_4/frame_00001.png |
| cc_quarter | `int cc = int(random(38, 90)*4);` -> `int cc = int(random(38, 90));` | large | 4x fewer slabs per ring: petals/fans become sparse, individual slabs clearly separated with gaps, coarser spikes | variants/cc_quarter/frame_00001.png |
| size_x2 | `float size = width*0.3*random(2);` -> `float size = width*0.3*random(2)*2;` | large | ring radius doubled: whole burst much larger, fans reach the very corners/edges, big petal clusters dominate | variants/size_x2/frame_00001.png |
| w_thick | `float w = random(30, 60)*0.6;` -> `float w = random(30, 60);` | moderate | slabs ~1.7x wider: fans denser/blockier, less needle-like, centre fills in more solid | variants/w_thick/frame_00001.png |
| fov_wide | `float fov = PI/random(1.4, 1.9);` -> `float fov = PI/random(0.7, 0.9);` | large | wider FOV: strong perspective, grid visibly curved/stretched, fans and centre pushed toward the edges | variants/fov_wide/frame_00001.png |

## Modularisation notes
Generic (library candidates):
- `paletteLerp` / `getColor(v)` (arc.pde:112-119): fractional-index lerp between palette neighbours.
  Reusable colour-ramp helper for any cyclic/sequential palette.
- `radialSlabRing`: the inner `for i in cc` loop (arc.pde:83-94) is fully generic - a ring of thin 3D
  boxes on a circle, each rotated radially with cosine-modulated tilt (X/Y) and scale, filled by a
  cycling colour. Parameterise: `count, radius, boxW, boxH, boxD, zDepth, colorOffset, colorCycle,
  ampAngX, iteAngX, ampAngY, iteAngY, iteScl, sca`. This is the reusable core.
- `faintGrid`: the oversized low-alpha line grid (arc.pde:54-57). Reusable backdrop.

One-off art decisions:
- The 12-ring outer loop and its per-ring random parameter draws (arc.pde:60-79): how many rings,
  their radii, and the random modulation seeds are the specific composition, not a generic primitive.
- The specific 8-colour palette (arc.pde:105) and the lighting rig (lines 29-34).
- The random FOV / camera tilt (lines 40-48) is a stylistic distortion choice.

Clean parameter object for this sketch:
`{ seed, palette[], bg: 'random'|'index', fov, tilt:{x,y,z}, grid:{count, scale}, rings: [{ count,
radius, boxW, boxH, boxD, zDepth, colorOffset, colorCycle, ampAngX, iteAngX, ampAngY, iteAngY,
iteScl, sca }] }`.

The triangulate import (line 1) is unused - the sketch only uses `line()` and `box()`.
