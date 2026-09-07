---
sketch: 2018/Generativos/pepi
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1564
animated: false
techniques: [grid, polar, dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#AECDEC", "#D098F9", "#3A3569", "#FFC300", "#FD3537"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "random(20, 100)", tried: [100, 20], change: large, effect: "100 = dense field of tiny multi-ring dots; 20 = sparse large dots with wide pink gaps"}
  - {name: ck, default: "random(1, random(1, 40))", tried: [40], change: large, effect: "40 depth layers stretch into dense striped radial cones under perspective"}
  - {name: tilt, default: "random(-0.4, 0.4) per axis", tried: [0], change: large, effect: "0 = flat, axis-aligned grid with uniform dot sizes, no shear"}
  - {name: strokeAlpha, default: 20, tried: [255], change: moderate, effect: "255 adds a crisp dark outline to every ring; composition unchanged"}
  - {name: des, default: "width*1.2", tried: ["width*2.0"], change: large, effect: "bigger cells, fewer visible, stronger perspective foreshortening at edges"}
reusable_candidates:
  - {name: lerpPalette, signature: "lerpPalette(float v, int[] colors) -> int", note: "lerp between adjacent palette entries for smooth random colour"}
  - {name: concentricDotGrid, signature: "concentricDotGrid(cells, layers, extent, colorFn) -> void", note: "grid of stacked concentric ellipses shrinking per depth layer, with 3D tilt"}
---

## What it draws
A full-bleed field of colourful concentric "bullseye" dots on a dusty pink/mauve background.
Each cell holds a stack of 2–6 concentric rings in random colours — lavender, lilac-purple,
dark indigo, golden yellow, red-orange — with the outermost ring largest. The grid is tilted
slightly in 3D, so rows shear and the dots compress/expand gently toward the edges, and
adjacent cells overlap a little where the tilt pushes them together.

## How the code works
`setup()` (pepi.pde:3) calls `generate()` (line 24) once; `draw()` is empty, so the sketch is
static until a keypress. Flow of `generate()`:
- Re-rolls `seed` and calls `randomSeed(seed)` (25-26) — the only source of randomness; the
  harness pins `seed = 42`.
- `background(getColor())` (27): background is one random palette colour.
- `translate(width*0.5, height*0.5)` plus `rotateX/Y/Z(random(-0.4, 0.4))` (28-31): the whole
  grid is tilted in the P3D camera, producing the shear/edge-compression visible in the image.
- `cc = int(random(20, 100))` grid divisions (32); extent `des = width*1.2` (33); cell size
  `ss = des*2/cc` (34).
- `ck = int(random(1, random(1, 40)))` depth layers per cell (35); `stroke(0, 20)` — a
  near-invisible dark stroke on every ellipse (36).
- Triple loop k (depth), j (row), i (col) (37-49): positions mapped to `-des..des` (40-41),
  `translate(xx, yy, k*5)` stacks layers at 5px depth steps (43), ring size
  `s = map(k, 0, ck, ss, 0)` shrinks from full cell size to zero (45), and each ellipse gets
  an independent `fill(getColor())` (44) before `ellipse(0, 0, s, s)` (46).
- Colour: active palette `int colors[]` of 5 hex values (58, two commented-out alternatives
  at 57/59); `getColor(float)` (66-72) takes a random float, mods it into the palette range
  and lerps between the two adjacent entries — so fills land anywhere along the colour
  gradient between neighbours, not just on the 5 swatches.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_100 | `int cc = int(random(20, 100));` -> `int cc = 100;` | large | ~100 cells: dense confetti-like field of tiny multi-ring dots, no visible gaps | variants/cc_100/frame_00001.png |
| cc_20 | `int cc = int(random(20, 100));` -> `int cc = 20;` | large | ~20 cells: large dots, 1-2 rings each, wide pink background between them | variants/cc_20/frame_00001.png |
| ck_40 | `float ck = int(random(1, random(1, 40)));` -> `float ck = 40;` | large | 40 stacked layers: dots dissolve into dense striped "cone" bursts radiating from centre, kaleidoscopic | variants/ck_40/frame_00001.png |
| rot_0 | `rotateX(random(-0.4, 0.4));` + Y + Z -> `0` (3 subs) | large | perfectly flat, axis-aligned grid; dots uniform in size, rows/columns straight | variants/rot_0/frame_00001.png |
| stroke_255 | `stroke(0, 20);` -> `stroke(0, 255);` | moderate | every ring gains a crisp dark outline; rings read as distinct bordered circles, layout unchanged | variants/stroke_255/frame_00001.png |
| des_2 | `float des = width*1.2;` -> `float des = width*2.0;` | large | grid extends past the canvas: larger dots, fewer visible, stronger edge compression/tilt distortion | variants/des_2/frame_00001.png |

## Modularisation notes
Two clean pieces: (1) the lerp-palette colour picker (`getColor(float)`, lines 63-72) is
generic — `lerpPalette(v, colors)`; (2) the concentric-dot grid generator (lines 32-50) is a
parameterised block: `{cells, layers, extent, depthStep, tilt, colorFn}` → grid of shrinking
concentric ellipses with a 3D rotation. One-off art decisions: the specific 5-colour palette,
the `k*5` depth stacking, and the ±0.4 rad tilt range. A clean parameter object would carry
`cc` (grid density), `ck` (ring count per cell), `des` (extent in width units), `tilt`
(max radians per axis), and `palette`.
