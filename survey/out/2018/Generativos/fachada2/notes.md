---
sketch: 2018/Generativos/fachada2
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1517
animated: false
techniques: [grid, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#FE4D9F", "#EE1C25", "#2F3293", "#3CB74C", "#0272BE", "#BDCBD5", "#FEFEFE"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(5,100)", tried: [6], change: large, effect: "fewer, much bigger tiles fill the frame"}
  - {name: amp, default: "random(0.38,0.44)", tried: [0.12], change: large, effect: "boxes become thin flat slabs, wide black gaps"}
  - {name: zStep (0.5 in translate), default: 0.5, tried: [1.0], change: large, effect: "rows separated by full black bands"}
  - {name: tilt (rotateX random), default: "random(-2,2)", tried: [0], change: large, effect: "view goes dead-on: flat square grid, no 3D slant"}
  - {name: angle (rotateZ), default: "PI*0.25", tried: ["PI*0.5"], change: large, effect: "lattice rotated to other diagonal, wider black seams"}
  - {name: palette[0], default: "#FE4D9F", tried: ["#FFD400"], change: moderate, effect: "pink faces become yellow, same composition"}
reusable_candidates:
  - {name: randomColor, signature: "rcol() -> int", note: "uniform random pick from a fixed 7-colour palette, one colour per face"}
  - {name: flatBox, signature: "box(w, h, d)", note: "six unlit quads (beginShape/vertex), each filled with an independent random palette colour"}
  - {name: diagonalBoxGrid, signature: "diagonalBoxGrid(n, boxSize, depthRatio, zStep)", note: "n*n boxes whose x and y share one index (diagonal), stacked in z with a half-step gap"}
---

## What it draws
A full-bleed diagonal lattice of flat cuboid tiles, like an abstract building facade seen at an angle. Each tile is a flat-topped box whose visible faces are solid saturated colours — hot pink, red, navy, green, blue, pale grey-blue and white — with no shading between faces. Small black squares at the tile corners are the black background showing through narrow gaps between the boxes.

## How the code works
- `setup()` (L3-8): 960x960 P3D, `smooth(8)`, `pixelDensity(2)`, then `generate()` once; `draw()` (L10-12) is empty, so the image is static (frames 10/60 identical in the baseline).
- `generate()` (L22-52): black `background(0)`, `ortho()` orthographic camera, translated to centre with `z=-1000`. The view is fixed by `rotateY(HALF_PI); rotateX(HALF_PI); rotateZ(PI*0.25)` (L31-33) — a near-isometric diagonal view — plus one random extra tilt `rotateX(random(-2, 2))` (L34).
- Grid scale: `cc = int(random(5, 100))` (L36) gives the grid a side of `cc*2` boxes; `ss = width*3/cc` is the box edge (L37), `dd = ss*cc*0.5` half the grid extent (L38); `amp = random(0.38, 0.44)` (L40) is the box depth ratio.
- The double loop (L42-49) places `cc*2` x `cc*2` boxes at `translate(ss*i-dd, ss*i-dd, j*ss*0.5-dd)`: x and y share the same index `i`, so boxes run along the main diagonal; z advances in half-box steps while box depth is ~0.41*ss, so the boxes nearly touch and a thin black seam opens between adjacent rows — those seams are the black corner marks.
- `box()` (L54-106) draws six unlit quads via `beginShape()/vertex()/endShape(CLOSE)`, each face filled with `rcol()` — a uniform random pick from the 7-colour palette at L132. Colour is per-face, not per-box, which is why adjacent faces of one tile usually differ. No lights, no strokes, no blend modes; the look comes entirely from the ortho + rotation camera and the per-face random colour.
- Randomness enters at: the `cc` count (L36), the tilt (L34), `amp` (L40), and every face colour (L133-135). Everything is deterministic under a fixed seed (baseline `deterministic: true`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_6 | `int cc = int(random(5, 100));` -> `int cc = 6;` | large | far fewer, much bigger tiles: a coarse 12x12 grid of large flat boxes filling the frame; same palette and black seams | variants/cc_6/frame_00001.png |
| amp_0.12 | `float amp = random(0.38, 0.44);` -> `float amp = 0.12;` | large | boxes become thin flat slabs seen nearly edge-on; wide black gaps between rows, sparse plate-like look | variants/amp_0.12/frame_00001.png |
| zstep_1.0 | `translate(..., j*ss*0.5-dd);` -> `translate(..., j*ss*1.0-dd);` | large | z-spacing doubled: bold black bands between box rows, discrete slab strips instead of a near-tight facade | variants/zstep_1.0/frame_00001.png |
| tilt_0 | `rotateX(random(-2, 2));` -> `rotateX(0);` | large | view goes dead-on: a flat axis-aligned square grid of small colour cells, no 3D slant or visible box depth | variants/tilt_0/frame_00001.png |
| angle_0.5 | `rotateZ(PI*0.25);` -> `rotateZ(PI*0.5);` | large | lattice rotated to the other diagonal; boxes more stretched and distorted, wider black seams | variants/angle_0.5/frame_00001.png |
| palette_yellow | `#FE4D9F` -> `#FFD400` in colors[] | moderate | hot-pink faces replaced by yellow; identical composition and geometry | variants/palette_yellow/frame_00001.png |

## Modularisation notes
- Generic: `flatBox(w,h,d)` (six unlit per-face-coloured quads) and `diagonalBoxGrid(n, boxSize, depthRatio, zStep)` are directly reusable for any "facade of boxes" piece; the ortho + rotateY/rotateX/rotateZ camera setup is a reusable isometric-style viewpoint.
- One-off art decisions: the specific 7-colour palette, the random per-face colour assignment (vs. a shared colour per box or a gradient), the half-step z gap that produces the black seams, and the single random extra tilt.
- A clean parameter object: `{n (grid side), boxSize, depthRatio (amp), zStep, viewTilt, palette[], colorMode: "per-face"|"per-box", background}`.
