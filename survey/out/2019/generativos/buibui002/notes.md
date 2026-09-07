---
sketch: 2019/generativos/buibui002
year: 2019
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1587
animated: false
techniques: [grid, noise-field, packing, 3d-mesh]
primitives: [point, line, ellipse, rect, shape]
palette:
  colors: ["#FFFFFF", "#B0E7FF", "#143585", "#5ACAA2", "#D08714", "#F98FC0"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: subs, default: "int(random(200))", tried: ["int(random(500))"], change: large, effect: "more horizontal splits -> thinner, more numerous, elongated panels; black gaps widen, circles more prominent; fewer large 3D boxes"}
  - {name: vSplits, default: 10, tried: [25], change: large, effect: "more horizontal rows -> denser, smaller cells, more fine grid sheets and thin slivers"}
  - {name: stars, default: 3000, tried: [10000], change: large, effect: "denser starfield in black background; layout also re-shuffled because the star loop consumes more randoms, shifting all downstream draws"}
  - {name: circleAttempts, default: 1000, tried: [4000], change: large, effect: "more and larger packed circles cover more of the black background; downstream layout also re-shuffled (circle loop consumes randoms before screens/boxes)"}
  - {name: stripeCount, default: "int(random(4,18))", tried: ["int(random(4,40))"], change: subtle, effect: "only striped boxes differ: more, finer horizontal stripes; rest of layout unchanged (same random draw count)"}
  - {name: screenFraction, default: 0.6, tried: [0.9], change: large, effect: "more gradient noise 'screen' panels, fewer 3D boxes; mosaic reads flatter, more pink/orange/teal gradient panels and more black gaps with circles"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(rects, vSplits, hSplits) -> Rect[]", note: "start from an oversized canvas rect, split a random rect into two halves vertically, then split random rects at a random horizontal fraction (0.2-0.8)"}
  - {name: circlePack, signature: "circlePack(attempts, radiusMax, overlap) -> PVector[x,y,r]", note: "rejection sampling: add a random circle unless dist < (r1+r2)*overlap to any existing one"}
  - {name: noiseScreen, signature: "noiseScreen(x, y, w, h, step, palette) -> void", note: "per-pixel (3px grid) ADD-blended noise texture: 4 independent noise fields, value quantised and lerped between adjacent palette entries"}
  - {name: piras, signature: "piras(w, h, d, aw, ah) -> void", note: "truncated pyramid: full front rect, 4 trapezoid sides to a smaller back rect, filled back face"}
---

## What it draws
A black field tiled by a dense mosaic of rectangular "panels" in pink, teal/green,
blue, orange and white. Panels appear in several states: flat shaded 3D boxes,
horizontally striped boxes, fine grid sheets, and rainbow gradient "screens" with
soft noise-like colour bands. Flat solid circles (same palette, each with a tiny
white centre dot) are scattered over everything, and the remaining black gaps hold
a fine white starfield. Thin black bars with small tick marks run vertically near
the left/right edges.

## How the code works
Static one-shot: `setup()` calls `generate()` (line 19-21), `draw()` is empty.
Deterministic via `randomSeed(seed)` / `noiseSeed(seed)` (lines 52-53).

- **Camera/lights** (lines 59-63, 139-145): P3D perspective (fov PI/3),
  `translate(width*0.5, height*0.5, 200); scale(0.4)`. Three directional lights
  (warm red from -X, cool blue from +X, pink from +Y) give the boxes their
  two-tone shading.
- **Rectangle mosaic** (lines 70-91): start with one rect at 1.82x the canvas
  (oversized so it bleeds off-screen). 10 iterations split a random rect into two
  horizontal halves (y +/- 0.25h, each h*0.5); then `subs = int(random(200))`
  (line 81) iterations split a random rect at a random horizontal fraction
  m1 in (0.2, 0.8). Result: a mosaic of rectangles with varying widths/heights.
- **Stars** (lines 94-98): 3000 white points, alpha 200, weight 0.5-3, scattered
  over +/- width/height — the starfield in the black gaps.
- **Circles** (lines 100-123): 1000 packing attempts; radius `s = random(180)`;
  rejected if `dist < (s + r)*0.55` vs any accepted circle (line 108) — hence
  non-overlapping disks. Each drawn as a flat `ellipse` in `rcol()` (alpha 240,
  diameter 0.6*s) plus a 0.05*s white centre dot.
- **Screens** (lines 165-183, 307-353): 60% of the rects (line 168) are picked as
  screens; 70% of those are skipped (line 180). `screen()` paints a dark frame
  then, in `blendMode(ADD)`, a 3px-stepped per-pixel loop: 4 independent 2D noise
  fields (two used as a distortion dx/dy), value quantised
  (`(n - n%1) + pow(n%1, pwr)`) and mapped through `getColor(v)` which lerps
  between adjacent palette entries (lines 426-432) — the rainbow gradient panels.
- **Boxes** (lines 185-250): the remaining 40% of rects become 3D. 50% are
  `piras` truncated pyramids (line 206) plus a thin side box and a small box on
  the front; 50% are striped: a base box plus `cc = int(random(4, 18))` (line
  215) stacked horizontal stripe boxes. The bottom face (rotated HALF_PI about
  X) is either a flat slab (40%) or a 30-cell `grid`; plus ~`r.w*0.2` short lines
  near the top edge (lines 242-247).
- **Floating grids** (lines 252-278): some rects get a 20-line grid sheet +
  crosshair + two small nested rects hovering at a z offset in front.
- **Edge bars** (lines 288-302): 8 thin black vertical bars (box 2 x 2h x 2) at
  z=+300, each with 80 small tick squares — the ruled bars near the edges.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| subs_500 | `int subs = int(random(200));` -> `int subs = int(random(500));` | large | far more horizontal splits: mosaic becomes thinner, more numerous, elongated panels; black gaps widen and circles stand out more; fewer large 3D boxes | variants/subs_500/frame_00001.png |
| vsplits_25 | `for (int i = 0; i < 10; i++) {` -> `for (int i = 0; i < 25; i++) {` | large | many more horizontal rows: denser, smaller cells, more fine grid sheets and thin slivers fill the frame | variants/vsplits_25/frame_00001.png |
| stars_10000 | `for (int i = 0; i < 3000; i++) {` -> `for (int i = 0; i < 10000; i++) {` | large | starfield visibly denser across the black background; layout also re-shuffled because the star loop consumes more randoms, shifting all downstream draws | variants/stars_10000/frame_00001.png |
| circles_4000 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 4000; i++) {` | large | more and larger packed circles cover more of the black background; downstream layout also re-shuffled (circle loop consumes randoms before screens/boxes) | variants/circles_4000/frame_00001.png |
| stripes_40 | `int cc = int(random(4, 18));` -> `int cc = int(random(4, 40));` | subtle | near-identical to baseline; only the striped boxes differ, now with more, finer horizontal stripes (same random-draw count preserves the rest of the layout) | variants/stripes_40/frame_00001.png |
| screens_0.9 | `int rem = int(rects.size()*0.6);` -> `int rem = int(rects.size()*0.9);` | large | far more gradient noise "screen" panels and fewer 3D boxes; mosaic reads flatter with more pink/orange/teal gradient panels and more black gaps with circles | variants/screens_0.9/frame_00001.png |

## Modularisation notes
Generic, library-ready blocks:
- `subdivideRects` — the two-phase rectangle splitter (fixed vertical-halving
  phase + random horizontal-fraction phase) is a clean parameterised primitive;
  the current sketch hard-codes the 1.82x oversize and the (0.2, 0.8) split range.
- `circlePack` — rejection-sampled packing with a tunable overlap factor is
  directly reusable.
- `noiseScreen` — the ADD-blended per-pixel noise texture is fully generic once
  decoupled from the global `colors[]` palette.
- `piras` and `grid` are small self-contained 3D/2D helpers.

One-off art decisions: the specific 6-colour palette, the three directional-light
colours (warm/cool/pink), the 1.82x oversize, the 0.4 global scale, the edge
tick-bars motif, and the 70% screen skip probability.

A clean parameter object for this sketch would contain: `canvas`, `vSplits`,
`hSplits`, `starCount`, `circleAttempts`, `circleRadiusMax`, `circleOverlap`,
`screenFraction`, `screenSkipProb`, `stripeMin`, `stripeMax`, `palette`,
`lightColors`.
