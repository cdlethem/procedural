---
sketch: 2017/Generativos/griddssssdsd
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1592
animated: false
techniques: [grid, subdivision]
primitives: [point, shape]
palette:
  colors: ["#F05638", "#F5C748", "#3FD189", "#FFB9DB", "#AF8AB4", "#6FC4EA", "#FFFFFF", "#412A50"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: slabCount, default: 6, tried: [12], change: moderate, effect: "more slabs; denser, busier composition"}
  - {name: subdivideIters, default: 6, tried: [9], change: moderate, effect: "deeper subdivision; large flat solid slabs, sparser scattered grids"}
  - {name: dotProb, default: 0.4, tried: [0.9], change: moderate, effect: "many more slabs rendered as dot grids"}
  - {name: gridRes, default: "random(2,10)", tried: ["random(6,14)"], change: moderate, effect: "finer, denser grids; smaller cells"}
  - {name: slabSize, default: "width*random(0.4,0.75)", tried: ["width*random(0.2,0.4)"], change: moderate, effect: "smaller slabs; more negative space"}
  - {name: outlineProb, default: 0.8, tried: [0.5], change: moderate, effect: "more filled checkerboard slabs, fewer pure outline grids"}
reusable_candidates:
  - {name: bilinearPoint, signature: "bilinearPoint(quad, u, v) -> PVector", note: "maps the unit square onto a 4-corner quad (gives the tilted-plane look)"}
  - {name: subdivideQuad, signature: "subdivideQuad(quad, sw, sh, keepProb) -> Quad[]", note: "splits one quad into up to 4 corner children, each kept with prob keepProb (random quadtree leaf)"}
  - {name: drawQuadGrid, signature: "drawQuadGrid(quad, sub, mode) -> void", note: "renders a quad as a point-grid / outline-grid / checkerboard of cells"}
---

## What it draws
A dark plum-purple background holding a handful of tilted planar "slabs" that read like sheets of paper or building facades seen at an angle. Each slab is a quadrilateral subdivided into a grid of small cells, and each cell is rendered in one of three styles: a grid of dots, thin outline grid lines, or a checkerboard of filled cells. Colours come from a bright 8-colour palette (orange, yellow, green, pink, lavender, light blue, white) set against the dark field. In the seed-42 baseline a large white outline-grid slab dominates the upper right, with smaller coloured slabs (yellow, orange, green, blue, pink) and a few thin lines and speckles scattered across the rest of the canvas.

## How the code works
- `setup()` (L3) sizes a 960x960 P2D canvas and calls `generate()` (L7). `generate()` (L26) re-draws via `render()`; the harness pins the `seed` field, so the whole draw is reproducible.
- `render()` (L32) sets `noiseSeed`/`randomSeed` (L35-36), paints the background with `getColor(random(8))` (L38) — a `lerpColor` between two adjacent palette colours — and translates to the centre (L40).
- Outer loop `k = 0..5` (L43): each pass builds one random slab. `ss = width*random(0.4, 0.75)` (L44) sets its half-extent; the four corners are placed on the four sides around the centre (L45-48), yielding a randomly-skewed quad centred on the screen.
- Subdivision (L51-58): start with `[quad]`; repeat 6 times — pick a random quad and replace it with its `sub(random(0.1,0.9), random(0.1,0.9))` children. `Quad.sub` (L86) builds up to 4 corner children (split at fractions `sw`,`sh`), each kept with 80% probability (L88-91). This is a random quadtree subdivision; the final list is the set of leaf quads.
- Draw (L60-65): each leaf quad is sent to `show()`.
- `show()` (L103): sets `strokeWeight(random(3))` (L134) and `stroke(rcol())` (L135), picks a grid resolution `sub = int(random(2,10))` (L136). If `random(1) < 0.4` (L138) it draws a `(sub+1) x (sub+1)` grid of points (dot mode). Otherwise it picks `str = random(1) < 0.8` (L146): when `str` it strokes all `sub x sub` cells as outlines (no fill), otherwise it fills a checkerboard of cells where `(i+j) % 2 == mc` with `mc = int(random(2))` (L152,159).
- `getPoint(sw,sh)` (L94) bilinearly interpolates across the four corners, mapping the unit cell onto the skewed quad — this is what produces the tilted "perspective plane" appearance.
- Colour: `rcol()` (L168) picks uniformly at random from the 8-colour array (L166); the background is the `lerpColor` blend from `getColor` (L171-181). All randomness flows from `randomSeed(seed)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| k_12 | `for (int k = 0; k < 6; k++) {` -> `... k < 12 ...` (L43) | moderate | doubled slab count: denser, busier composition with a large blue checkerboard slab bottom-centre and a pink grid slab at left, in addition to the baseline's white grid | variants/k_12/frame_00001.png |
| subdivide_9 | `for (int i = 0; i < 6; i++) {` -> `... i < 9 ...` (L54) | moderate | a few very large near-solid lavender slabs dominate the top; remaining grid/checker/dot elements smaller and more scattered — larger flat areas, sparser | variants/subdivide_9/frame_00001.png |
| dot_0.9 | `if (random(1) < 0.4) {` -> `< 0.9` (L138) | moderate | many more slabs rendered as dot grids (fields of dots); dots become a dominant style alongside outline and checkerboard grids | variants/dot_0.9/frame_00001.png |
| gridres_6_14 | `int sub = int(random(2, 10));` -> `int(random(6, 14));` (L136) | moderate | visibly finer, denser grids: smaller cells and finer line/dot grids across all slabs | variants/gridres_6_14/frame_00001.png |
| ss_0.2_0.4 | `width*random(0.4, 0.75)` -> `width*random(0.2, 0.4)` (L44) | moderate | slabs noticeably smaller: smaller grids/checkers (green, blue, yellow) over more dark background — more negative space | variants/ss_0.2_0.4/frame_00001.png |
| str_0.5 | `boolean str = random(1) < 0.8;` -> `< 0.5;` (L146) | moderate | halved outline probability: more filled checkerboard slabs (green, blue, yellow checkers) alongside the outline grids | variants/str_0.5/frame_00001.png |

## Modularisation notes
Generic blocks: `getPoint` (bilinear quad mapping), `sub` (random quadtree subdivision), and the three cell render modes in `show()` (point-grid / outline-grid / checkerboard) are all reusable and independent of the art direction. One-off art decisions: the 6-slab count, the 6-iteration subdivision depth, the 0.4/0.8/0.8 probability thresholds, the 8-colour palette and its lerp background, and the `random(0.4,0.75)` slab sizing. A clean parameter object would contain: `{ slabCount, subdivideIters, splitRange:[lo,hi], keepProb, gridResRange:[lo,hi], dotProb, outlineProb, palette, backgroundBlend }`.
