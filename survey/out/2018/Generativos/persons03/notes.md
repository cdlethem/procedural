---
sketch: 2018/Generativos/persons03
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1523
animated: false
techniques: [grid, voronoi-delaunay, noise-field, curves, scattered]
primitives: [ellipse, rect, line, point, shape]
palette:
  colors: ["#2B00BE", "#F73859", "#9896F1", "#D59BF6", "#EDB1F0", "#EAFCFF"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: grid, default: "int(random(40, 60))", tried: ["int(random(16, 20))"], change: moderate, effect: "coarser grid: far fewer, much larger figures; sparser longer-edged mesh"}
  - {name: personCount, default: "grid*1.6", tried: ["grid*3.2"], change: moderate, effect: "about twice as many figures at the same size; denser crowd and mesh"}
  - {name: rainCount, default: 600, tried: [1500], change: none, effect: "no visible change; streaks are 3-5 px at alpha 60, too faint to accumulate"}
  - {name: personMeshSkip, default: 0.6, tried: [0.15], change: none, effect: "no visible change; stroke(255, 28) too faint to notice the extra triangles"}
  - {name: heightFactor, default: "random(0.2, 1)", tried: ["random(0.4, 2.2)"], change: subtle, effect: "taller stretched figures, a few very tall ones; density unchanged"}
reusable_candidates:
  - {name: crowdPlacement, signature: "crowdPlacement(count, cellSize, minDist) -> PVector[]", note: "grid-snapped random placement with minimum-distance rejection"}
  - {name: delaunayMesh, signature: "delaunayMesh(points, keepProb, color) -> void", note: "Triangulate + draw random subset of triangles as faint wireframe"}
  - {name: noiseStreaks, signature: "noiseStreaks(count, lenRange, detail, offset, color) -> void", note: "short lines oriented by 2-D noise angle (rain)"}
  - {name: capsulePerson, signature: "capsulePerson(x, y, cell, height, scale, cBody, cHead, cPants) -> void", note: "shadow, pants, legs, rounded-rect torso, head, curve arms, hand dots"}
---

## What it draws
A flat lavender/periwinkle field covered in a faint white square grid and a faint white
triangulated web. Scattered across it, roughly 70–100 small stylised people stand in a
dense crowd: each is a rounded capsule torso (dark blue, coral red, light periwinkle or
pale pink) with a small round head, two thin splayed legs, and two curved arms ending in
tiny dots. A second, fainter mesh of thin dark lines links the heads of the figures.
All over the image are small diagonal pale-blue streaks suggesting light rain.

## How the code works
`setup()` (lines 12–17) sizes 960×960 P2D and calls `generate()` once; `draw()` is empty,
so the piece is static (key press regenerates). In `generate()` (persons03.pde):

- Background: `rcol()` (lines 32–37) picks a random colour from `colors[]` (line 318)
  but rejects `#2B00BE`, so the ground is a light tone of the purple palette.
- Grid (lines 39–46): `grid = int(random(40, 60))` cells, `ss = width/grid`; vertical and
  horizontal lines with `stroke(255, 12)` — the faint white square grid.
- Person placement (lines 122–152): `grid*1.6` random attempts over a ±10% margin, each
  snapped to the grid (`x -= x%ss`, lines 130–131), rejected if closer than 5 px to an
  existing person (lines 134–141).
- Person mesh (lines 154–165): `Triangulate.triangulate(persons)`; 60% of triangles are
  skipped (`random(1) < 0.6`, line 159) and the rest stroked `stroke(255, 28)` — the faint
  white web between people.
- Footprint dots (lines 167–172): a 2×1 random-colour dot at every person position.

- People (lines 187–277): persons are sorted by `y` (`ComparePersons`, lines 334–341) so
  lower figures paint over higher ones. Each gets: soft shadow ellipses `fill(0, 8)`
  (lines 200–202); a pants capsule ellipse (line 215) plus two leg lines in the pants
  colour (lines 217–220); a rounded-rect torso `rect(..., b1, b1, b2, b2)` in colour `c1`
  (line 227); a small head ellipse in a second, distinct colour `c2` (line 232); arms as
  `curve()` from random hand points to the shoulders stroked in `c1` (lines 251–252);
  hand dots in `c2` (lines 264–265). Randomness per figure: `sca` (10% chance of 0.5–3×,
  line 196), `hh = random(0.2, 1)` height factor (line 197), torso width (line 226), head
  size (line 231), hand positions (lines 236–237).
- Head mesh (lines 283–296): triangulate the head positions again; keep ~40% of triangles,
  stroked `stroke(0, 14)` — the faint dark web over the heads.
- Rain (lines 298–309): 600 short lines of length `random(3, 5)` stroked `#EAFCFF` alpha 60,
  direction from `noise(des + x*det, des + y*det)*PI` — the diagonal rain streaks; a `point`
  at each tip.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_16_20 | `int grid = int(random(40, 60));` -> `int grid = int(random(16, 20));` | moderate | coarser grid (16-20 cells): crowd drops to ~30 figures that are 2-3x wider with long legs; white mesh much sparser with long edges; same palette and rain | variants/grid_16_20/frame_00001.png |
| persons_3.2x | `for (int i = 0; i < grid*1.6; i++) {` -> `for (int i = 0; i < grid*3.2; i++) {` | moderate | roughly double the figures at unchanged size; noticeably denser crowd with more overlapping capsules and a denser white mesh | variants/persons_3.2x/frame_00001.png |
| rain_1500 | rain loop `for (int i = 0; i < 600; i++) {` (after `stroke(#EAFCFF, 60);`) -> `i < 1500` | none | no visible change | variants/rain_1500/frame_00001.png |
| mesh_0.15 | person mesh `if (random(1) < 0.6) continue;` (after `stroke(255, 28);`) -> `< 0.15` (keep 85% of triangles) | none | no visible change | variants/mesh_0.15/frame_00001.png |
| height_2.2 | `float hh = random(0.2, 1);` -> `float hh = random(0.4, 2.2);` | subtle | figures clearly taller and thinner-stretched (capsules, legs, arms all scaled); a few very tall ones; same count and palette | variants/height_2.2/frame_00001.png |

## Modularisation notes
Generic, library-ready blocks: `crowdPlacement` (grid-snapped Poisson-ish rejection
sampling), `delaunayMesh` (triangulate + probabilistic keep of triangles as wireframe),
`noiseStreaks` (noise-oriented short lines), and `capsulePerson` (the whole person drawing
block, parameterised by cell size, height/scale factors and a 3-colour choice).
One-off art decisions: the exact rejection of `#2B00BE` as background, the 2×1 footprint
dots, the specific proportions (torso 5.2·ss tall, head at 8.2·ss, 10% giant-person
mutation), and drawing the mesh twice (feet white, heads dark).
A clean parameter object: `{countFactor (grid*1.6), cellRange (40–60), minDist (5),
meshKeepProb (0.4), headMeshAlpha (14), rainCount (600), rainLen (3–5),
heightRange (0.2–1), giantChance (0.1), palette}`.
