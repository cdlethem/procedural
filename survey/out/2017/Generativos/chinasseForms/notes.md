---
sketch: 2017/Generativos/chinasseForms
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 248
animated: false
techniques: [subdivision, grid, typography, noise-field]
primitives: [rect, ellipse, shape, text]
palette:
  colors: ["#FE435B", "#19B596", "#9061BF", "#E0DC3F"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: c (subdivision passes), default: "random(3,200)", tried: ["random(3,40)"], change: large, effect: "fewer passes -> coarser mosaic: few big cells, big glyphs/plus/dots"}
  - {name: maxSub (max split per step), default: "random(1, random(6,20))", tried: ["random(1, random(6,40))"], change: large, effect: "splits up to 40x40 per step: very fine busy clusters next to large untouched cells"}
  - {name: ss (cell gap), default: 4, tried: [14], change: subtle, effect: "same layout, slightly thicker dark gaps between rects"}
  - {name: branchProb (flat-rect branch), default: 0.6, tried: [0.2], change: large, effect: "fewer flat rects; more dark dot/rect-grid panels and icons, busier"}
  - {name: palette, default: "#fe435b,#19b596,#9061bf,#e0dc3f", tried: ["#4fc3f7,#ffb74d"], change: large, effect: "identical layout, recoloured blue/orange"}
reusable_candidates:
  - {name: subdivideQuads, signature: "subdivideQuads(canvas, iterations, maxSub, minEdge) -> Quad[]", note: "pick random quad, replace by sw x sh grid; stop at min edge"}
  - {name: iconCell, signature: "iconCell(x, y, s, style) -> void", note: "dot / rotated square / corner brackets / cross / random glyph, one of 5 styles"}
  - {name: rcol, signature: "rcol(colors[]) -> int", note: "uniform pick from palette"}
---

## What it draws
A full-bleed mosaic on near-black: the 960x960 canvas is broken into an irregular grid of
rectangles of very different sizes. Some cells are flat semi-transparent red / green / purple /
yellow rectangles; a few hold an orderly grid of small icons — dots, rotated squares, corner
brackets, crosses, and random lowercase letters. Other cells are darker panels filled with a dense
grid of tiny dots or squares, some bright (additive) and some dim, giving a pixel-noise texture.
Large cells (e.g. a 3x3 grid of green dots top-left, a big red diamond on a dark-red field) sit
beside fine-grained busy clusters.

## How the code works
`setup()` (chinasseForms.pde:3-10) loads the Zilap font at 100pt and calls `generate()` once;
`draw()` is empty, so the sketch is static (regenerates only on key press).

- Subdivision tree (27-52): start with one Quad covering the canvas; `c` times (random 3..200,
  line 33) pick a random quad and replace it by a `sw x sh` grid (sw, sh each random 2..maxSub,
  maxSub random up to 20, line 34); quads narrower than 8px are skipped (line 38). This is what
  produces the irregular mosaic of cell sizes.
- Per-cell drawing (56-121), `noStroke()`, 4px inset `ss` (line 55):
  - 60% of cells (line 59): flat `rect` in a random palette colour with alpha 100..256 (61-64),
    then an 80% chance (65) of an icon grid: the cell is split along its longer axis into
    `int(long/short)` columns (66-72); each slot gets an `icon()` (84).
  - 40% of cells (89-119): dark base rect with low alpha (104), then a grid of `sub` (1..4)
    extra splits; each slot is either an `ellipse` (115) or `rect` (116) in the cell colour with
    alpha 50..256, optionally modulated by 2-D noise (`det = random(0.1)`, lines 108-114);
    whole thing drawn in `ADD` blend mode (90) so overlapping glows accumulate.
- `icon()` (124-165) picks one of 5 styles at random: dot; square rotated 45 deg; concentric
  corner brackets `marc()` (4 directions, random skip prob); `cross()` (4-armed plus, optionally
  rotated 45 deg); a single random lowercase letter from "abcdefghijklmnopqrtsuvwxyz" in the
  Zilap font (157-164).
- Palette (210-213): `colors[] = {#fe435b, #19b596, #9061bf, #e0dc3f}`; `rcol()` uniform pick.
  Blending: `ADD` for the icon grids (76) and the dot/rect cells (90), `BLEND` otherwise.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| c_40 | `int c = int(random(3, 200));` -> `int c = int(random(3, 40));` | large | coarser mosaic: a handful of huge cells (big purple glyph, big green plus, 2x2 and 3x3 dot grids) where baseline had many smaller ones | variants/c_40/frame_00001.png |
| maxSub_40 | `int maxSub = int(random(1, random(6, 20)));` -> `... random(6, 40));` | large | mix of large flat cells (3x3 teal dots, big empty dark-green rects) and extremely fine pixel-busy clusters where per-step splits reach 40x40 | variants/maxSub_40/frame_00001.png |
| ss_14 | `float ss = 4;` -> `float ss = 14;` | subtle | same cell layout as baseline; dark gaps between the flat rects are visibly wider, nothing else | variants/ss_14/frame_00001.png |
| branchProb_0.2 | `    if (random(1) < 0.6) {` -> `    if (random(1) < 0.2) {` | large | flat-rect branch rarer: more dark panels filled with dot/rect grids, more icon cells (crosses, brackets, diamonds); overall busier, fewer plain coloured fields | variants/branchProb_0.2/frame_00001.png |
| palette_2col | `int colors[] = {#fe435b, #19b596, #9061bf, #e0dc3f};` -> `{#4fc3f7, #ffb74d};` | large | identical layout and cell content to baseline, recoloured: teal cells become blue, reds become orange/yellow | variants/palette_2col/frame_00001.png |

## Modularisation notes
- Generic: the quad-subdivision loop (27-52) is a clean recursive-subdivision function with
  (iterations, maxSub, minEdge) parameters; `iconCell` with an explicit style argument is a
  reusable "fill a cell with a motif grid"; `rcol` is a trivial palette picker.
- One-off art decisions: the two cell branches and their probabilities (0.6 / 0.8 / 0.8), the
  per-cell ADD vs BLEND choice, the 4px gap `ss`, the fixed 4-colour palette, the Zilap glyph
  set, the specific icon style list.
- A clean parameter object: `{ iterations, maxSub, minEdge, cellGap, branchProb (flat vs grid),
  palette[], blend, iconStyles[], glyphFont, noiseDetail }`.
