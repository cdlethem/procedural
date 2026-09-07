---
sketch: 2020/generative/01_04/trespapeles
year: 2020
renderer: P2D
size: [800, 800]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1502
animated: false
techniques: [grid, packing]
primitives: [rect, line]
palette:
  colors: ["#F0F0F0", "#61C5FB", "#6D83ED", "#FFA5C1"]
  selection: fixed
composition: scattered
parameters: []
reusable_candidates:
  - {name: resolveOverlaps, signature: "resolveOverlaps(rects, w, h, grid, maxIter) -> Rect[]", note: "iteratively split intersecting grid-snapped rects into fragments re-placed at random snapped positions"}
  - {name: snappedRandomPos, signature: "snappedRandomPos(w, h, size, grid) -> [x, y]", note: "uniform random position snapped to a grid, allowed to overshoot the edge by a margin"}
---

## What it draws
Baseline (seed 42): a light warm-grey canvas covered by a faint grey grid (cell ~60 units) with two
large flat pastel squares — a pink one in the upper-centre and a sky-blue one to its right — whose
areas overlap in the middle, blue painted on top of pink. Each square carries a subtle 1px drop
shadow. No other colours are visible, though the code seeds a third (violet) square.

## How the code works
- `settings()` (L21-26): `scale = nwidth/swidth = 800/960`, so the window is 800×800 but
  `generate()` calls `scale(scale)` (L88) to draw in a 960×960 logical space. P2D, `smooth(8)`.
- Grid background: `background(240)` (L100), then `stroke(0, 30)` lines every `grid = 60` units
  (L101-108) produce the faint grey lattice.
- Three 480×480 squares are created with fixed colours — blue `#61C5FB` (L117), violet `#6D83ED`
  (L123), pink `#FFA5C1` (L129) — each at a uniform random position snapped to the 60-unit grid
  (`x -= x%grid`, L115-116 etc.). `randomSeed(seed)`/`noiseSeed(seed)` (L90-91) make it
  deterministic; `seed = int(random(999999))` (L9) is the harness-seeded field.
- Overlap resolution (L132-182): a `while` loop (capped at 100 passes, L179) scans pairs. When two
  rects intersect: if the scanned rect `a` is already `block`ed, partner `b` is removed from the
  working list and re-placed at a new random snapped position (may overshoot the edge by 20, L154-155);
  otherwise a new fragment rect of the intersection's size, coloured with `a.col`, is spawned at a
  random snapped position and `a` is blocked (L163-169). Lists are merged each pass (L174-176).
  With seed 42 the process leaves the big pink and blue squares visibly overlapping (blue later in
  the list, drawn on top); the violet square is not visible in the frame.
- Draw (L185-188): rects painted in list order; `Rect.show()` (L59-64) first draws a `fill(0, 10)`
  copy offset by (1,1) as a soft shadow, then the solid colour. No strokes, no blend modes.
- `draw()` is empty (L36-37); everything is generated once in `setup()`. Frames 10/58 were
  identical to frame 1, so the output is static.
- Unused leftovers: `Rect.union()` (L67-73), `lerpColor` in the helpers, the `toxi`/`triangulate`
  imports, and the `getColor()`/`rcol()` random-palette functions (L197-212) are never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic, library-worthy: the grid-snapped random placement (`snappedRandomPos`) and the
  iterative overlap-resolution pass (`resolveOverlaps`) — both depend only on a list of axis-aligned
  rects, a canvas size, a grid step and a margin; the fragment colour policy (inherit splitter's
  colour) could be a callback.
- One-off art decisions: the 3 fixed pastel colours, 480 square size, 60 grid, 20px overshoot
  margin, 100-pass cap, the `fill(0,10)` shadow, and the 960 logical / 800 pixel scale trick.
- A clean parameter object: `{width, height, grid, squareSizes[], colors[], margin, maxIter,
  seed}`.
