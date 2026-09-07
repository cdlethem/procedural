---
sketch: 2018/Generativos/carto004
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1580
animated: false
techniques: [grid, noise-field, subdivision, polar]
primitives: [rect, line, ellipse, shape]
palette:
  colors: ["#FB5D40", "#D48300", "#E5964B", "#008172", "#165253", "#1C1C1A", "#D8D8B9"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 32, tried: [64], change: large, effect: "halves cell size; grid, diamonds, hatch, quadtree cells all at half scale — finer, denser texture"}
  - {name: det, default: "random(0.01)", tried: ["random(0.003)"], change: none, effect: "no visible change; pixel-identical — noise speckle layer rounds to 0px at this seed"}
  - {name: subs, default: "random(8,91)", tried: [180], change: moderate, effect: "denser quadtree: many more, smaller black-outlined rects and faint rings; earlier layers unchanged"}
  - {name: diamondCount, default: 80, tried: [40], change: moderate, effect: "sparser diamond scatter; fewer random() calls also shift the quadtree layout"}
  - {name: walkSteps, default: "(cc*cc)*0.04", tried: ["(cc*cc)*0.16"], change: large, effect: "4x denser grey diagonal hatch covering the canvas; quadtree layout also shifts (random sequence)"}
reusable_candidates:
  - {name: quadtreeSplit, signature: "quadtreeSplit(cell, splits, seed) -> Rect[]", note: "recursive random quad-split of canvas into grid-aligned rects"}
  - {name: arcRing, signature: "arcRing(x, y, r1, r2, a1, a2, col, alp1, alp2) -> void", note: "two-radius sector ring built from quads (arc2)"}
  - {name: diamond, signature: "diamond(x, y, s) -> void", note: "4-vertex rotated square"}
---

## What it draws
A dark indigo/purple field overlaid with soft, wavy radial bands of lighter purple that
drift across the whole canvas. Over that sits a fine grid of tiny pale squares, and a
scatter of rotated squares (diamonds) in orange, coral red, teal, cream and black, some
with small dot centres. A quadtree subdivision of black-outlined rounded rectangles with
pale corner dots and faint white arcs crosses the composition.

## How the code works
`generate()` (called from `setup`, line 8; `draw` is empty, so the piece is static;
`randomSeed(seed)` at line 25 makes it reproducible).
- Lines 27–29: background is a 20%-tinted random palette colour; `rectMode(CENTER)`;
  cell size `ss = width/cc` with `cc = 32` (line 30).
- Lines 32–39: coarse grid, each cell gets a near-invisible dark under-square
  (alpha 20) and a mid grey square at 30% cell size (alpha 80) — the fine grid texture.
- Lines 41–53: finer grid (`cc*sub`, `sub=5`): noise `noise(des+det*i, des+det*j)`
  with small detail `det` (line 43) sizes dark squares (alpha 40), plus a 10%-cell
  pale square per coarse cell. **In practice this noise layer is invisible at seed 42**:
  `s2 = int(ns*0.4*noise)` rounds to 0–2 px on ~6 px cells, so changing `det` leaves
  the image pixel-identical (variant det_0.003). The visible soft radial bands are the
  large white `arc2` rings from the quadtree layer (line 153).
- Lines 55–56: 100 random faint white grid-aligned squares (helper `rects`).
- Lines 58–78: 100 random-walk "paths" of grey round-cap line segments (weight
  `ss*0.04`), each step moves one cell in a random diagonal — the faint diagonal
  hatch texture.
- Lines 80–88: 6 `arc2` radial rings at grid intersections (line 192): two-radius
  sector rings with fading alpha, radius up to `ss/2` ≈ 15 px — too small to read
  individually.
- Lines 90–107: 80 random grid-aligned diamonds (`diamont`, line 167) in random
  palette colours, optionally with a smaller inner diamond (20%) or centre dot (20%).
- Lines 109–114: pale 4%-cell square at every coarse grid intersection.
- Lines 117–154: quadtree: start with one full-canvas `Rect`, do
  `subs = random(8,91)` random splits into 4 children (skipping cells too small),
  then draw each surviving rect (30% skipped) with a random low-alpha palette fill,
  white inner stroke, black outer stroke, a pale quarter-cell dot at its top-left
  corner, and a faint white `arc2` ring sized to the rect's diagonal (line 153) —
  the large soft concentric wave bands seen in the image.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_64 | `int cc = 32;` -> `int cc = 64;` | large (0.1626, 51.8% px) | same composition at half scale: much finer grid of tiny squares, smaller diamonds, denser diagonal hatch, smaller quadtree cells and rings; overall a tighter, busier texture | variants/cc_64/frame_00001.png |
| det_0.003 | `float det = random(0.01);` -> `float det = random(0.003);` | none (0.0, 0.0 px) | no visible change — pixel-identical to baseline; the noise-scaled dark speckle layer rounds to 0 px at this seed | variants/det_0.003/frame_00001.png |
| subs_180 | `int subs = int(random(8, 91));` -> `int subs = 180;` | moderate (0.0756, 29.4% px) | quadtree overlay much denser: many more, smaller black-outlined rounded rects with corner dots and faint white rings across the canvas; waves, diamonds and hatch below are unchanged | variants/subs_180/frame_00001.png |
| diamonds_40 | `for (int i = 0; i < 80; i++) {` -> `for (int i = 0; i < 40; i++) {` | moderate (0.114, 41.6% px) | diamond scatter roughly half as dense; the quadtree layout also differs from baseline because the shorter loop consumes fewer random() values and shifts the sequence | variants/diamonds_40/frame_00001.png |
| walk_0.16 | `for (int i = 0; i < (cc*cc)*0.04; i++) {` -> `for (int i = 0; i < (cc*cc)*0.16; i++) {` | large (0.1861, 54.9% px) | grey round-cap diagonal hatch 4x denser, now a visible texture over the whole canvas; quadtree layout also differs (random-sequence shift) | variants/walk_0.16/frame_00001.png |

## Modularisation notes
Generic blocks: the quadtree split loop (lines 117–136) is a self-contained
recursive-subdivision utility parameterised by cell size and split count; `arc2`
(lines 192–210) is a reusable radial-ring renderer; `diamont` (lines 167–174) a
trivial rotated-square primitive. Art-specific decisions: the 7-colour palette list,
the layering order (grid/noise under scatter under quadtree), the random-walk hatch,
and the per-layer alpha choices. The noise-speckle layer (lines 41–53) is
effectively dead code at default scale — square sizes round to 0–2 px — and could
be dropped or its size scale made explicit in a parameter object:
`{cc, sub, det, diamondCount, walkSteps, quadtreeSplits, palette, alphas}`.
