---
sketch: 2018/Generativos/pelines
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1631
animated: false
techniques: [noise-field, flow-field, grid, lines-hatching]
primitives: [line, rect]
palette:
  colors: ["#31A151", "#FFA71E", "#05084C", "#DE4638", "#3DBDB7"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: gri, default: 20, tried: [40], change: subtle, effect: "no visible change (also doubles max line length; effect masked by faint alpha)"}
  - {name: det1, default: "random(0.01)", tried: [0.002], change: moderate, effect: "smoother, slightly larger-scale flow; dark band path and tints rearranged"}
  - {name: "angle multiplier (TAU*2)", default: 6.28, tried: [3.14], change: subtle, effect: "no visible change; flow layout nearly identical"}
  - {name: "length multiplier (dd*gri)", default: 1, tried: [2], change: subtle, effect: "subtle: strokes visibly longer and more legible, same layout"}
  - {name: "line alpha (random(120)*random(0.2,1))", default: "0-24", tried: ["random(255)*random(0.6,1) -> 0-153"], change: moderate, effect: "lines much more opaque: red/orange/yellow strokes pop, dark band sharper"}
  - {name: "palette (colors[])", default: "green/orange/navy/red/teal", tried: ["#2E0551 #FF00C7 #01AFC2 #FDBE03 #F4F9FD"], change: large, effect: "fully recoloured: magenta/purple/cyan/gold flow over dark purple ground"}
reusable_candidates:
  - {name: flowFieldLines, signature: "flowFieldLines(cellStep, maxLen, angleDetail, lenDetail, colDetail, palette) -> void", note: "dense short line per grid cell; angle/length/colour from independent 2-D noise fields"}
  - {name: paletteLerp, signature: "getColor(v) -> color", note: "cyclic lerp between adjacent palette entries driven by a scalar"}
---

## What it draws
Full-bleed 960×960 field of very short, semi-transparent hair-like lines packed edge to edge,
forming a flowing, flocked texture over a muted green ground. A broad dark (teal/navy) diagonal
band of dense short strokes runs from top-right to bottom-left; yellow-orange and occasional red
lines tint the surrounding flow. No discrete shapes, no background objects.

## How the code works
`setup()` (pelines.pde:3) sizes 960×960 P2D and calls `generate()`; `draw()` is empty, so the
piece is static (line 10-12). Randomness enters only through the seeded `random()` calls inside
`generate()` (lines 42-47): three independent 2-D Perlin fields (`det1/des1`, `det2/des2`,
`det3/des3`) with random detail and offset.

- Line 33-38: background = one random palette colour, then a second full-canvas rect in another
  random palette colour with a faint `stroke(0, 8)`; both are `rcol()` (line 120-122,
  random-from-list).
- Lines 48-61: a double loop walks a 2 px grid (`gri*0.1`, with `gri = 20`, line 40) from −20 to
  980 in both axes (~240k cells). Per cell: `an = noise(...)*TAU*2` (line 52) sets the stroke
  direction, `dd = noise(...)*gri` (line 53) sets its length (0–20 px), and the stroke colour is
  `getColor(noise(...)*colors.length*20)` (line 58) — cyclic lerp between two adjacent palette
  colours (lines 126-132). Alpha is `random(120)*random(0.2, 1)`, i.e. 0–24, so every line is
  very faint and thousands of lines build up the colour. Endpoints are constrained to the canvas
  (lines 54-57), which is why the diagonal band of strokes looks clipped/sheared near where the
  flow crosses the border.
- `arc2()` (line 64) and `montains()` (line 84) are dead code, never called.
- Palette (line 119): green, orange, dark navy, red, teal — the visible image is dominated by
  the two green background layers, with navy/dark-teal, yellow-orange and red showing through
  the line field.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| gri_40 | `  float gri = 20;` -> `  float gri = 40;` | subtle | no visible change: same dense flow, band and tints; the doubled max line length is not perceptible at this alpha | variants/gri_40/frame_00001.png |
| det1_0.002 | `  float det1 = random(0.01);` -> `  float det1 = 0.002;` | moderate | smoother, slightly larger-scale flow; dark diagonal band takes a different path, yellow/red tints redistributed | variants/det1_0.002/frame_00001.png |
| an_TAU | `float an = noise(des1+xx*det1, des1+yy*det1)*TAU*2;` -> `*TAU;` | subtle | no visible change: flow layout and band nearly identical | variants/an_TAU/frame_00001.png |
| dd_gri2 | `float dd = noise(des2+xx*det2, des2+yy*det2)*gri;` -> `*gri*2;` | subtle | subtle: strokes longer and more legible as individual hairs, same overall layout | variants/dd_gri2/frame_00001.png |
| alpha_high | `stroke(..., random(120)*random(0.2, 1));` -> `random(255)*random(0.6, 1);` | moderate | lines much more opaque: red/orange/yellow strokes pop, dark band sharper and more contrasty | variants/alpha_high/frame_00001.png |
| palette_neon | `int colors[] = {#31A151, #FFA71E, #05084C, #DE4638, #3DBDB7};` -> `{#2E0551, #FF00C7, #01AFC2, #FDBE03, #F4F9FD};` | large | fully recoloured: magenta/purple ground with cyan, gold and white flow lines | variants/palette_neon/frame_00001.png |

## Modularisation notes
The generic core is the triple-noise line field: a grid step, per-cell angle field, length field
and colour field over a palette — parameterise as `{cellStep, maxLen, angleDetail, lenDetail,
colDetail, palette, alphaMax}`. One-off art decisions: the two full-bleed random-colour
background layers, the `TAU*2` angle multiplier, the very low alpha, and the canvas-clamping of
line endpoints. `rcol()` (random palette pick) and `getColor()` (cyclic palette lerp) are both
reusable as small palette helpers. `arc2`/`montains` are unused leftovers.
