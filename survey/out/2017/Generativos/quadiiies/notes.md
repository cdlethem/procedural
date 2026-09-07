---
sketch: 2017/Generativos/quadiiies
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 753
animated: false
techniques: [grid, packing, pixel-ops]
primitives: [rect, pixels]
palette:
  colors: ["#FF5200", "#003355", "#04536C", "#ADACA7"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: gridPacking, signature: "gridPacking(gridSize, maxAttempts, rng) -> Rect[]", note: "random non-overlapping lattice rectangles until the grid is (nearly) full"}
  - {name: mosaicRect, signature: "mosaicRect(px, py, pw, ph, sub, palette) -> void", note: "subdivide a rectangle into a sub-grid, fill each cell with a lerp-interpolated palette colour"}
  - {name: pixelGrain, signature: "pixelGrain(amplitude) -> void", note: "per-pixel brightness jitter via get/set over the whole canvas"}
---

## What it draws
A full-bleed pixel mosaic at 960×960: the whole canvas is tiled with small square
cells in orange, dark teal/petrol blue, and warm grey, over a pale grey ground.
The cells are grouped into visible rectangular blocks of varying size and
orientation — a patchwork of dense sub-mosaics — with a fine grainy texture over
the whole surface. Orange is the dominant colour; teal and grey appear in large
neighbouring patches.

## How the code works
- `setup()` (lines 1–5): `size(960,960)`, `pixelDensity(2)`, one `generate()` call.
  `draw()` is empty (regeneration on keypress, line 8 commented out), so the piece
  is static.
- `generate()` (lines 21–77):
  - `background(240)` (line 22) sets the pale grey ground; `noisee(5)` (line 23)
    jitters the background pixels by ±5 brightness — mostly covered later.
  - A lattice of `sub × sub` cells is defined (line 26: `sub = int(random(3,50))`,
    so 3–49; with seed 42 this is a fixed value), cell size `ss` (line 27),
    margin `bb = 0` (line 25). A faint 1-px grid in `stroke(255,10)` is drawn
    (lines 28–37) — nearly invisible under the later fills.
  - Packing loop (lines 41–73): up to 10,000,000 attempts. Each attempt picks a
    random lattice rectangle `(x, y, w, h)` with `1 <= w <= sub-x`,
    `1 <= h <= sub-y`; it is accepted only if it does not overlap any previously
    accepted rectangle (`Rect.col`, lines 49–55, 88–90). 10M attempts leave the
    lattice essentially fully covered by non-overlapping rectangles of mixed
    sizes.
  - Each accepted rectangle: a translucent grey underlay `fill(random(256), 40)`
    + full-size `rect` (lines 59–60), then subdivision into `subb =
    int(random(3,10))` sub-cells per lattice cell (line 62); every sub-cell is
    filled with `getColor(random(4))` (line 68) and drawn as an `sss×sss` rect
    (line 69). Lines 67's `fill(random(256), random(10,50))` is dead —
    immediately overwritten by line 68.
  - `getColor` (lines 106–114): a random float 0–4, taken mod 4, lerps between
    adjacent entries of the palette `[#FF5200, #003355, #04536C, #ADACA7]`
    (line 104, incl. wrap grey→orange), producing smooth blends within and
    across patches.
  - Final `noisee(2)` then `noisee(5)` (lines 75–76): per-pixel brightness
    jitter of ±2 then ±5 over the whole canvas — the fine grain.
- Randomness enters only via the (seeded) `random()` calls; deterministic under
  seed 42 per baseline `result.json`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the lattice packing loop (random non-overlapping rects until full) is
  a self-contained `gridPacking` candidate; `mosaicRect` (subdivide a rect, fill
  cells from a lerp palette) and `pixelGrain` (amplitude param) are both directly
  reusable. `Rect.col` (AABB overlap) is a trivial shared helper.
- One-off art decisions: the specific 4-colour palette, the dead translucent
  underlay fills (lines 40, 59, 67 — no visual effect, candidates for removal),
  the double final grain pass (2 then 5), the faint lattice stroke.
- A clean parameter object: `{ grid (sub), maxAttempts, subMin, subMax, palette[],
  grainAmp, margin (bb) }`; the random sub/subb ranges could be exposed as
  `(min, max)` pairs.
