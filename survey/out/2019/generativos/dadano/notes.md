---
sketch: 2019/generativos/dadano
year: 2019
renderer: JAVA2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 361
animated: false
techniques: [grid, subdivision, voronoi-delaunay, agents, dots-stippling]
primitives: [rect, ellipse, line, shape]
palette:
  colors: ["#B0E7FF", "#143585", "#5ACAA2", "#ff91d0", "#f9ad31"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(10,22)", tried: [8], change: large, effect: "coarser grid: bigger cells, bigger markers and blocks, ~8 agents, same character at larger scale"}
  - {name: bb, default: 10, tried: [80], change: moderate, effect: "wider empty margin: whole composition inset 80px, thick pink border around it"}
  - {name: subdiv_iterations, default: 30, tried: [8], change: moderate, effect: "fewer, larger, less fragmented subdivision blocks; more plain background shows"}
  - {name: point_count, default: "pow(cc,1.4)", tried: ["pow(cc*2,1.4)"], change: moderate, effect: "twice as many scattered colour squares; busier field, same agents"}
  - {name: connect_radius, default: 220, tried: [400], change: none, effect: "no visible change: connection lines are stroke(255,240,245,40) at weight 0.4, too faint to see even doubled"}
reusable_candidates:
  - {name: quadSubdivide, signature: "quadSubdivide(cells, iterations) -> Rect[]", note: "recursive 4-way quadtree subdivision of an integer grid (dadano.pde:97-111)"}
  - {name: cellAgents, signature: "cellAgents(cells, minDist, tries) -> PVector[]", note: "poisson-like agent placement on grid cell centers with min-distance rejection (dadano.pde:121-139)"}
  - {name: delaunayOverlay, signature: "delaunayOverlay(points, alpha) -> shape", note: "Triangulate.triangulate over agents drawn as translucent triangles (dadano.pde:218-230)"}
---

## What it draws
A soft pink field (seed 42 picks #ff91d0 as background) overlaid with a fine hairline grid of ~14x14 cells inset 10 px from the edges. Large translucent colour blocks from recursive subdivision fill the lower-left quadrant and a few horizontal bands. Scattered across the grid: small colour squares with dark underlays and white centre dots, bigger circles with black rings and white centres, faint large halo circles, thin lines linking nearby markers, and a very faint speckle of white dots over everything.

## How the code works
`setup()` calls `generate()` once (dadano.pde:20-28); `draw()` is empty, so the piece is static. Inside `generate()` (line 58), in order:
- Background: `background(20)` then `background(rcol())` (line 64-65) — full-bleed random palette colour (rcol() picks from `colors[]`, line 250, via `random`).
- Speckle: 200 small colour dots with alpha 180-255 (line 68-72), then 200000 tiny white dots at alpha 30, size 0.2-1 px (line 74-78) — the grain texture.
- Grid: `cc = int(random(10, 22))` cells (line 81), margin `bb = 10` (line 80), cell size `ss = (width-2*bb)/cc` (line 82). Hairlines at alpha 20 / weight 0.11 every 0.1 cell (line 84-89), then weight-1 lines at alpha 20 every full cell (line 91-95).
- Subdivision: a `Rect` list starts as one cell (line 97-98); 30 iterations pick a random rect, split it 4 ways at random integer cut points, and replace it (line 100-111). Rendered with `rcol()` at alpha up to 0.6-1.0, inset 2 px per cell (line 113-118) — the big colour blocks.
- Small squares: `pow(cc,1.4)` random colour squares of side ss*0.08 at cell centres (line 141-147).
- Agents: `pow(cc*1.2,0.8)` candidates placed at random cell centres, accepted only if >= ss from all existing agents (line 121-139). Each drawn as a big halo ellipse (ss*4, alpha 20, line 158-163) and later as black disc + colour disc + white centre dot (line 232-241).
- Cell markers: for every cell, a white square at alpha 16 (ss*0.06), a brighter white dot (ss*0.012, alpha 80), a faint outline square (ss*0.8, stroke alpha up to 60), and a 20% chance of an ellipse (line 168-186).
- Points: `pow(cc,1.4)` points at random cell centres (line 149-155); each drawn as dark underlay rect (alpha 30) + colour rect (alpha 200) + inner square + white dot (line 193-203), plus thin lines to any agent within 220 px (line 205-212).
- Delaunay: `Triangulate.triangulate(agents)` (line 218) drawn as one TRIANGLES shape with per-triangle `rcol()` fills at alpha up to 12 and stroke alpha 6 (line 220-230) — the faint web between agent circles.
Randomness enters via `randomSeed(seed)` (line 61); seed is set by the harness (`seed := 42`). All colours are drawn at low alpha, so layers accumulate into the washed-out pastel look.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_8 | `int cc = int(random(10, 22));` -> `int cc = 8;` | large | coarse 8x8 grid: everything scaled up — big cells, big markers, big subdivision blocks, only ~8 agents; same pastel character | variants/cc_8/frame_00001.png |
| bb_80 | `int bb = 10;` -> `int bb = 80;` | moderate | grid and all elements inset 80 px: wide plain-pink frame around the composition, cell size slightly smaller | variants/bb_80/frame_00001.png |
| subdiv_8 | `for (int i = 0; i < 30; i++)` -> `i < 8` | moderate | fewer subdivision iterations: blocks are larger, fewer, and less fragmented; more plain background visible between them | variants/subdiv_8/frame_00001.png |
| points_x2 | `for (int i = 0; i < pow(cc, 1.4); i++)` -> `i < pow(cc*2, 1.4)` | moderate | twice as many scattered colour squares with dark underlays; busier mid-field, agents unchanged | variants/points_x2/frame_00001.png |
| connect_400 | `if (p.dist(a) < 220)` -> `< 400` | none | no visible change — connection lines are alpha-40 hairlines, invisible at either radius | variants/connect_400/frame_00001.png |

## Modularisation notes
- **Generic (library candidates):** the quadtree subdivision loop (97-111) is a pure data transform on integer cells; the min-distance cell-centre placement (121-139) is a generic scatter; the Delaunay overlay (218-230) is a generic point-set renderer.
- **One-off art decisions:** the exact 5-colour palette and low alpha values (20/40/12/30) that create the pastel wash; the 200000-dot grain layer; the specific marker recipe (dark underlay + colour + white centre); the 220 px connection radius.
- **Clean parameter object:** `{cellCount (cc), margin (bb), subdivIterations, agentTries, pointExponent, connectRadius, palette, alphaScale}` — cc drives most of the density through the pow() formulas.
