---
sketch: 2018/Generativos/darlyn
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1740
animated: false
techniques: [grid, dots-stippling]
primitives: [rect, ellipse, line, shape]
palette:
  colors: ["#FFFEF8", "#FAE0E0", "#E66B85", "#AFE9E5", "#64B9DA", "#427FAD", "#3C5A81", "#252B22", "#539A6D", "#ADBF83"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: gridFill, signature: "gridFill(cellCount, colorPicker) -> void", note: "fill a full-bleed cell grid with per-cell lerp colors, occasional color switch"}
  - {name: stipple, signature: "stipple(count, sizeRange, colorPicker, alphaRange) -> void", note: "random dots/grain layer over the whole canvas"}
  - {name: manhattanWalks, signature: "manhattanWalks(count, steps, cellSize, strokeColors) -> void", note: "right-angle random walks snapped to a grid, one cell per step"}
---

## What it draws
A full-bleed abstract collage of flat colored squares in a loose grid — steel blues,
dusty pink, teal, sage and gray — with no gaps and no strokes between most cells.
The surface is covered in a fine light grain (tiny speckles), broken up by a few large
translucent color blocks, a scatter of small solid dots, thin black-and-white right-angle
polylines that walk cell-to-cell, and a handful of thin horizontal/vertical bars.
Frames 10 and 60 are identical to frame 1 (static).

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static (darlyn.pde:3-11).
`generate()` (darlyn.pde:22-111) seeds `randomSeed`/`noiseSeed` with the harness seed and
builds six stacked layers, all colors drawn from the 10-entry `colors[]` list via `rcol()`
(darlyn.pde:120-123), a uniform random pick:

1. **Base grid** (28-40): `cc = int(random(8, 45))` cells across, `sep = width/cc`. Each cell is
   a `rect` filled `lerpColor(col, alt, random(0.2))` — mostly the running `col`, occasionally
   (prob ~0.01 per cell) switched to a fresh random color, so large same-color regions merge.
2. **Grain** (43-49): 300,000 random dots, diameter `width*random(0.001)` (<= ~1 px),
   fill `lerpColor(rcol(), white, random(1))` at alpha `random(255)` — the fine speckle texture.
3. **Translucent blocks** (51-64): `cd = int(random(10, 40))` `beginShape` rectangles,
   size up to ~11 cells, fill `rcol()` at double-random alpha (0-255) — the see-through overlays.
4. **Manhattan walks** (66-84): 10 random walkers, 100 steps of exactly `sep`,
   direction only cardinal (`int(random(-2,2))*HALF_PI`), stroke 2, black or white at alpha 200 —
   the right-angle lines.
5. **Dots** (86-97): 20 ellipses of `sep*0.4` snapped to cell centers, `rcol()`.
   (Note line 88 uses `random(width)` for y, a latent bug; canvas is square so harmless.)
6. **Bars** (99-109): 100 `rectMode(CENTER)` rects, `w = h = width*random(0.1)` with one
   dimension divided by 2-7, solid `rcol()` fill — the thin bars.

No noise, no blend modes, no shaders; all depth comes from alpha stacking and lerpColor.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic:** the three layers are cleanly separable functions with the signatures above —
  `gridFill` (cell count + color picker), `stipple` (count/size/alpha ranges),
  `manhattanWalks` (count/steps/cell size). A clean parameter object would hold
  `{cellCount, grainCount, grainSize, overlayCount, walkCount, walkSteps, dotCount, barCount, palette, bg}`.
- **One-off art decisions:** the specific 10-color palette, the `random(8,45)`/`random(10,40)`
  ranges, the double-random alpha `random(random(255),255)`, black/white-only strokes.
- `getColor(float)` (124-132) is a lerp-between adjacent palette entries helper that is
  defined but never called — a nice `paletteLerp(t)` candidate for the library.
