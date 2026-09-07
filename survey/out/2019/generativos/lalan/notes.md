---
sketch: 2019/generativos/lalan
year: 2019
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1545
animated: false
techniques: [grid, packing, distortion]
primitives: [ellipse, rect]
palette:
  colors: ["#A4A8A9", "#8395FF", "#FD674E", "#FCC8FF", "#1CB377", "#FCD500"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(120,160)*0.2) -> 24-31 cells", tried: ["*0.4 -> 48-62 cells"], change: large, effect: "all elements on the grid halve in size; black blocks and speckle become much denser and finer"}
  - {name: dotCount, default: 2000, tried: [500], change: large, effect: "speckle of tiny coloured dots far sparser; grey ground shows through between dots"}
  - {name: blockCount, default: 200, tried: [80], change: moderate, effect: "black pixel blocks reduced to scattered clusters; large colour blobs read more clearly"}
  - {name: blobCount, default: 20, tried: [6], change: large, effect: "only a few big translucent circles remain; much more grey field, blocks sit on grey"}
  - {name: mediumCircleCount, default: 60, tried: [12], change: none, effect: "no visible change (small circles are tiny; 2.5% of pixels)"}
  - {name: ringCount, default: 5, tried: [15], change: none, effect: "subtle: more thin outline rings visible (15 vs 5) but strokes occupy only ~2% of pixels"}
reusable_candidates:
  - {name: pixelBlocks, signature: "pixelBlocks(cellSize, count, accentChance) -> void", note: "black squares with centred white dot, occasional 3x3 / horizontal / vertical bar (pixel-font look)"}
  - {name: scatterDots, signature: "scatterDots(cellSize, count, radius, palette) -> void", note: "random small dots snapped to a grid"}
---

## What it draws
Flat grey (#A4A8A9) field covered with a dense scatter of tiny multicoloured dots and a
sparse constellation of black pixel-font-like blocks (black squares each with a small white
dot, some with crossbars or 3×3 blocks) that form rough diagonal bands. Behind them sit large
soft translucent circles in yellow, pink and periwinkle blue, plus a few medium saturated
green/coral circles and 5 thin outline circles (green, red, pink) with a faint wash of colour
inside. The overall look is a flat, constructivist pixel-art collage: hard black-and-white
blocks floating over big pale colour blobs on grey.

## How the code works
Single-shot `generate()` called from `setup()` (lalan.pde:23); `draw()` is empty so the piece
is static. `randomSeed`/`noiseSeed` are set from `seed` (44-45). A virtual grid is defined by
`cc = int(random(120,160)*0.2)` → 24-31 cells, `ss = width/cc` ≈ 34 px (49-50); every position
is snapped to this grid via `int(random(1,cc))*ss`, so everything aligns to the same cell.

Five layers, back to front (all `noStroke` unless noted):
1. Lines 52-58: 2000 tiny dots, radius `ss*0.1` (≈3.4 px), fill `rcol()` — the dense
   multicoloured speckle.
2. Lines 60-66: 20 large circles, radius `ss*int(random(1,12))*0.5` (1-5.5 cells), fill
   `rcol()` at alpha 220 — the big yellow/pink/blue translucent blobs.
3. Lines 68-90: 200 black blocks: black `ss×ss` square with a centred white dot of `ss*0.16`;
   with 10% chance a 3×3 black square replaces it, with 10% a horizontal bar and 10% a
   vertical bar — the pixel-font/cross shapes. These dominate the image.
4. Lines 92-97: 60 medium circles, radius `ss*0.5`, on a half-cell grid, `rcol()` — the
   saturated green/coral dots.
5. Lines 99-107: 5 outline circles, `ss*2.5` wide, `stroke(rcol())` weight 2 with a
   `rcol()` fill at alpha 40 — the thin washed rings.

Colour is `rcol()` (126-128): uniform pick from the 5-colour list at line 120
(#8395FF periwinkle, #FD674E coral, #FCC8FF pink, #1CB377 green, #FCD500 yellow); many
alternative palettes are commented out above it. No noise, no transform, no blend mode;
`triangulate` and `toxi` are imported but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_0.4 | `int cc = int(random(120, 160)*0.2);` -> `... *0.4);` | large | grid cells halved (48-62 vs 24-31): blocks, dots, circles all smaller and denser; composition reads as fine pixel noise over many small colour blobs | variants/cc_0.4/frame_00001.png |
| dots_500 | `for (int i = 0; i < 2000; i++) {` -> `i < 500;` | large | tiny coloured speckle much sparser; grey ground visible between dots; blocks and blobs unchanged | variants/dots_500/frame_00001.png |
| blocks_80 | `for (int i = 0; i < 200; i++) {` -> `i < 80;` | moderate | black pixel blocks cut to ~40%; they no longer form solid diagonal bands, big yellow/pink/green blobs stand out | variants/blocks_80/frame_00001.png |
| blobs_6 | `for (int i = 0; i < 20; i++) {` -> `i < 6;` | large | only ~6 large translucent circles (yellow, pink, blue, coral); most of the field is grey with sparse blocks | variants/blobs_6/frame_00001.png |
| medcircles_12 | `for (int i = 0; i < 60; i++) {` -> `i < 12;` | none | no visible change; medium circles are small (~17 px radius) so removing 48 of 60 affects only 2.5% of pixels | variants/medcircles_12/frame_00001.png |
| rings_15 | `for (int i = 0; i < 5; i++) {` -> `i < 15;` | none | subtle: 15 thin outline rings instead of 5 (green, red, pink, yellow, blue) scattered across the canvas, but strokes cover only ~2% of pixels | variants/rings_15/frame_00001.png |

## Modularisation notes
- Generic: the five layers are all "snapped random scatter" with different shapes/counts — a
  `scatter(shape, cellSize, count, radius, palette, alpha)` helper could cover layers 1, 2, 4, 5.
- The black-block layer (68-90) is a self-contained pixel-glyph scatter: parameterise
  `cellSize`, `count`, `dotSize`, and the three `0.1` accent probabilities; this is the most
  reusable block.
- One-off art decisions: the exact palette (120), the 5-layer stacking order, the alpha values
  (220, 40), the `random(120,160)*0.2` cell-count formula, and the accent probabilities.
- A clean parameter object: `{ cellCount, dotCount, dotRadius, blobCount, blobRadius, blockCount,
  blockAccent, mediumCircleCount, ringCount, palette, background }`.
- Unused imports (`triangulate`, `toxi` noise) and the `getColor()` lerp helpers (129-138) can
  be dropped when reusing.
