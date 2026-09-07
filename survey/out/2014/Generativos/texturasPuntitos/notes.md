---
sketch: 2014/Generativos/texturasPuntitos
year: 2014
renderer: JAVA2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 169
animated: false
techniques: [grid, dots-stippling, lines-hatching, distortion]
primitives: [line, ellipse]
palette:
  colors: ["#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sep (dot spacing), default: 20, tried: [40], change: none, effect: "sparser dot band in top-left, but dot region is only ~2% of canvas so overall diff is none"}
  - {name: tam (dot size), default: 10, tried: [30], change: subtle, effect: "dots grow into overlapping white rings; dot band turns into a dense ring mesh, still confined to top-left"}
  - {name: grid angle, default: random(TWO_PI), tried: [0], change: subtle, effect: "angle 0 makes sin(ang)=0, grid collapses to a single flat row of dots along the top edge instead of a rotated band"}
  - {name: grid diameter d, default: width (600), tried: [300], change: none, effect: "halves the grid count (15x15 instead of 30x30); at seed 42 the result is a single row of dots along the top, diff none"}
  - {name: gradient direction, default: map(i,0,height,0,1), tried: [map(i,0,height,1,0)], change: large, effect: "reverses the whole gradient: blue on top, magenta on bottom; dot band unaffected (top-left)"}
reusable_candidates:
  - {name: lineGradient, signature: "lineGradient(col1, col2, axis) -> void", note: "full-canvas gradient built from one horizontal line per row, color lerped per row (lines 15-20)"}
  - {name: rotatedDotGrid, signature: "rotatedDotGrid(cx, cy, diam, ang, sep, dot) -> void", note: "square grid of circles in a rotated basis, count from diam/sep (lines 24-34); note: currently ignores cx/cy and draws around origin"}
---

## What it draws
A full-bleed vertical gradient rendered as 600 thin horizontal lines, going from magenta/pink at the top
through purple in the middle to blue at the bottom. Overlaid in the top-left corner is a dense, rotated
block of small white dots (~30x30 grid, squashed into a tall thin band because of a steep rotation angle),
part of it clipped off-canvas.

## How the code works
`setup()` (line 5-8) sets 600x600 and calls `generar()` once; `draw()` is empty, so the piece is static.

`generar()` (lines 14-22):
- Picks two random RGB colors `col1`, `col2` (lines 15-16) — the only randomness besides the grid angle.
- Loops `i` over every row (lines 17-20): sets the stroke to `lerpColor(col1, col2, i/height)` and draws
  a full-width horizontal line at that y. 600 1px lines produce the smooth-looking vertical gradient.
- Calls `circulo(width/2, height/2, width, random(TWO_PI), 20, 10)` (line 21): a 600-diameter dot field,
  random angle, 20px spacing, 10px dots.

`circulo(x, y, d, ang, sep, tam)` (lines 24-34): computes `cant = d/sep` (30) and `mc = cant/2` (15), then
draws a square grid `i,j in [-mc, mc)` of ellipses of size `tam` at `(cos(ang)*i*sep, sin(ang)*j*sep)`.
**Bug/quirk:** the `x` and `y` parameters are never used — no `translate()`, so the grid is centered on the
origin (top-left corner), not on `(width/2, height/2)` as the call site intends. With a steep random angle
the grid collapses horizontally into the thin white band seen in the image. Fill is Processing's default
white (never set), which is what makes the dots white.

`keyPressed` (lines 36-39) regenerates on any key and saves with `s`; unused in the harness.
`rcol()` (lines 46-48) indexes the one-entry `paleta` and is dead code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sep_40 | `circulo(..., random(TWO_PI), 20, 10);` -> `..., 40, 10);` | none | no visible change; top-left dot band is visibly sparser (separated dot rows), but the dot region is only ~2% of the canvas | variants/sep_40/frame_00001.png |
| tam_30 | `circulo(..., 20, 10);` -> `..., 20, 30);` | subtle | subtle: dots grow into large overlapping white rings; the band becomes a dense ring mesh, still confined to the top-left corner | variants/tam_30/frame_00001.png |
| angle_0 | `circulo(..., random(TWO_PI), 20, 10);` -> `..., 0, 20, 10);` | subtle | subtle: with angle 0, sin(ang)=0 collapses the grid to a single flat row of dots along the top edge (~300 px wide), replacing the tall rotated band | variants/angle_0/frame_00001.png |
| diam_300 | `circulo(width/2, height/2, width, ...)` -> `circulo(width/2, height/2, width/2, ...)` | none | no visible change overall; at this seed the 15x15 grid renders as a single row of dots along the top edge, dot region too small to move the score | variants/diam_300/frame_00001.png |
| grad_flip | `map(i, 0, height, 0, 1)` -> `map(i, 0, height, 1, 0)` | large | large: gradient reversed — blue at top, magenta at bottom; the white dot band is unchanged in the top-left | variants/grad_flip/frame_00001.png |

## Modularisation notes
- `lineGradient`: the per-row lerpColor + line loop (lines 15-20) is a clean reusable primitive — a
  1-parameter-axis gradient from two colors. Generic and short.
- `rotatedDotGrid`: the grid loop (lines 24-33) is generic (diam, angle, spacing, dot size in; square grid
  of circles in a rotated basis). The missing `translate(x,y)` is an art-accident bug; a library version
  should actually honor center coordinates.
- One-off decisions: the two fully random RGB colors (no palette constraint), the specific 20/10
  spacing/size ratio (dense stipple), the default-white fill.
- A clean parameter object: `{col1, col2, axis, gridCenter, gridDiam, angle, sep, dotSize, dotColor}`.
  The `paleta`/`rcol` machinery is unused and could be dropped.
