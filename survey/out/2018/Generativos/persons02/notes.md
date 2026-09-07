---
sketch: 2018/Generativos/persons02
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1529
animated: false
techniques: [noise-field, grid, voronoi-delaunay]
primitives: [line, ellipse, rect, point, shape]
palette:
  colors: ["#2B00BE", "#F73859", "#9896F1", "#D59BF6", "#EDB1F0"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: grid, default: "int(random(40, 60))", tried: ["int(random(80, 100))"], change: subtle, effect: "finer cell grid; crowd and mesh re-laid-out, figure scale similar"}
  - {name: personAttempts, default: "grid*1.6", tried: ["grid*3.2"], change: moderate, effect: "crowd density roughly doubles"}
  - {name: torsoWidth, default: "ss*sca*random(1, 1.2)", tried: ["ss*sca*random(0.45, 0.6)"], change: none, effect: "no visible change; torsos only slightly thinner"}
  - {name: heightFactor, default: "random(0.2, 1)", tried: ["random(0.8, 1.5)"], change: subtle, effect: "figures clearly taller and slimmer"}
  - {name: feetMeshAlpha, default: 28, tried: [110], change: none, effect: "white mesh lines more visible (thin 1-px strokes, below scorer threshold)"}
  - {name: rainAlpha, default: 60, tried: [200], change: none, effect: "rain dashes more visible (sparse 1-2 px dots, below scorer threshold)"}
reusable_candidates:
  - {name: scatterOnGrid, signature: "scatterOnGrid(attempts, cell, margin, minDist) -> PVector[]", note: "random points snapped to a square grid, rejected if too close to an accepted point"}
  - {name: sparseTriangulation, signature: "sparseTriangulation(points, skipFraction) -> Triangle[]", note: "Delaunay triangulation with each triangle dropped with probability skipFraction"}
  - {name: noiseRain, signature: "noiseRain(count, length, detail, offset) -> void (draws)", note: "short strokes + end dots oriented by sampled 2-D noise"}
  - {name: capsulePerson, signature: "capsulePerson(x, y, cell, scale, height, colorA, colorB, bg) -> void (draws)", note: "flat two-tone figure: ellipse shadow, pants ellipse, rounded-rect torso, head, curve arms, hand dots"}
---

## What it draws
Full-bleed pale periwinkle (lavender) ground with a faint white square grid and a
faint white triangulated mesh of long thin lines. Scattered over it are roughly
70 small flat "people": vertical capsule torsos in deep blue-violet, coral red, or
pale pink/periwinkle, each with a tiny round head, two thin legs, thin curved arms,
and a soft dark oval shadow at the feet. Figures vary in height and width. Very
faint whitish short dashes (rain) are sprinkled across the whole image, drifting in
| grid_80-100 | `int grid = int(random(40, 60));` -> `int grid = int(random(80, 100));` | subtle | finer background grid; crowd and white mesh re-laid-out, figures about the same size | variants/grid_80-100/frame_00001.png |
| persons_grid3.2 | `for (int i = 0; i < grid*1.6; i++)` -> `... grid*3.2 ...` | moderate | roughly twice as many people (~140), denser mesh, same colours | variants/persons_grid3.2/frame_00001.png |
| ww_0.45-0.6 | `float ww = ss*sca*random(1, 1.2);` -> `float ww = ss*sca*random(0.45, 0.6);` | none | no visible change (torsos only slightly thinner; change confined to small areas) | variants/ww_0.45-0.6/frame_00001.png |
| hh_0.8-1.5 | `float hh = random(0.2, 1);` -> `float hh = random(0.8, 1.5);` | subtle | subtle: figures clearly taller and slimmer (elongated capsules, longer legs), head mesh shifted up | variants/hh_0.8-1.5/frame_00001.png |
| mesh_alpha_110 | `stroke(255, 28);` -> `stroke(255, 110);` | none | white mesh lines clearly more visible; scorer reports none because the change is confined to 1-px strokes | variants/mesh_alpha_110/frame_00001.png |
| rain_alpha_200 | `stroke(#EAFCFF, 60);` -> `stroke(#EAFCFF, 200);` | none | whitish rain dashes clearly more visible; scorer reports none because the change is confined to sparse 1-2 px dots | variants/rain_alpha_200/frame_00001.png |

## How the code works
Single tab, P2D, `generate()` called once from `setup()` (static; `draw()` empty;
frames 10/60 identical). Everything is driven by `randomSeed(seed)`/`noiseSeed(seed)`
(persons02.pde:35-36).

- Background: `rcol()` random from `colors[]` (line 318: `#2B00BE` twice, `#F73859`,
  `#9896F1`, `#D59BF6`, `#EDB1F0`), rerolled while equal to `#2b00be` (32-33) — hence
  the lavender baseline (that is `#9896F1`).
- Grid: `grid = int(random(40,60))` cells (39-40), faint `stroke(255,12)` full-height/
  width lines (42-46) — the square grid.
- "Umbrellas" (`threes`) block is dead code: the loop count is `0` (72), so no
  umbrella figures appear.
- Person placement: `grid*1.6` attempts (126), random positions in ±10% margin
  (127-128), snapped onto grid lines via `x -= x%ss; y -= y%ss` (130-131), rejected
  if within 5 px of an accepted person (134-141).
- First mesh: Delaunay triangulation of the feet points via
  `Triangulate.triangulate(persons)` (154), drawn `stroke(255,28)` with 60% of
  triangles skipped (156-165) — the faint white mesh. Feet also get a 2×1 px dot in
  a palette colour (167-172).
- Persons are sorted by y (176, `ComparePersons` at 334-341) and painted back-to-front.
  Per person: 10% chance of a `sca` multiplier in 0.5–3 (194-196); height factor
  `hh = random(0.2,1)` (197). Two `fill(0,8)` ellipses as soft ground shadow (199-202).
  Pants colour `pants` = palette colour ≠ background (211-212): tall ellipse
  (215) + two thin `stroke(pants)` leg lines (217-220). Torso colour `c1` (204-205):
  rounded `rect` (rectMode CENTER, 227) — the capsule. Head colour `c2` ≠ background
  and ≠ `c1` (206-207): small ellipse (231-232). Arms: two random hand positions
  (236-237), `curve()` from hand to shoulder in torso colour (251-252), hand dots in
  head colour (263-265).
- Second mesh: Delaunay over head positions (283), `stroke(0,14)`, 60% skipped
  (285-296) — the faint dark mesh over the heads.
- Rain: 600 short 3–5 px lines in `#EAFCFF` alpha 60 (301-309), each oriented by
  `noise(des + x*det, des + y*det)*PI` (306) — the noise-field sprinkling.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `scatterOnGrid` (snapped random placement with min-distance rejection),
  `sparseTriangulation` (Delaunay + random skipping, used twice — once for feet,
  once for heads), `noiseRain`, and the palette helper (`rcol` with background
  exclusion; `getColor` lerp variant is unused).
- One-off art decisions: the capsule person figure (specific proportions
  `ss*5.2*hh`, `8.2*hh`, curve-arm control points), the dead umbrella block,
  the 10% scale-lottery, and the y-sort for painter order.
- A clean parameter object: `{seed, grid, personAttempts, minHeight, maxHeight,
  minScale, maxScale, scaleLottery, meshAlphaFeet, meshAlphaHeads, meshSkip,
  rainCount, rainAlpha, palette, backgroundColor}`.
