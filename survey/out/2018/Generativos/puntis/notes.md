---
sketch: 2018/Generativos/puntis
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1954
animated: false
techniques: [voronoi-delaunay, dots-stippling]
primitives: [point]
palette:
  colors: ["#FF3E6D", "#2C50FE", "#F9FF60", "#D036E9", "#23778A", "#FAFAFA"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc (point count), default: "random(80, 1200*r)*r2", tried: [400], change: none, effect: "no visible change: with seed 42 the effective count was already < 400, so the point set was identical"}
  - {name: dot alpha, default: 90, tried: [220], change: moderate, effect: "higher alpha makes stipple more saturated; the pastel look of the baseline comes from alpha 90 on white"}
  - {name: palette, default: "5 colors #FF3E6D #2C50FE #F9FF60 #D036E9 #23778A", tried: ["#111111 #666666"], change: moderate, effect: "geometry identical; swapping to grayscale strips all hue, mosaic reads as shaded relief"}
  - {name: bb (point overhang), default: 200, tried: [0], change: moderate, effect: "overhang makes the cover full-bleed; with 0 the mosaic shrinks to the convex hull inside a white border"}
  - {name: stipple density (x area), default: 1.1, tried: [4.0], change: large, effect: "4x more dots per triangle: triangles look near-solid, colours much more saturated, white ground nearly gone"}
reusable_candidates:
  - {name: stippleTriangle, signature: "stippleTriangle(PVector p1, PVector p2, PVector p3, float density, color col) -> void", note: "uniformly fills a triangle with random points (sqrt-biased barycentric sampling)"}
---

## What it draws
A full-bleed low-poly mosaic of pastel triangles on a near-white ground. Each triangle is
filled not with solid colour but with a dense speckle of tiny dots, all one random colour from
a 5-colour palette (pink-red, blue, yellow, magenta, teal). The result reads as faceted
crystal shards with a grainy, stippled texture; large pale (yellow/teal) facets sit between
saturated magenta and pink ones.

## How the code works
`setup()` -> `generate()` (puntis.pde:5-10). `generate()` (52-159):
- Picks `cc` random points uniformly in the canvas expanded by `bb = 200` px on each side
  (62-66), so the triangulation bleeds off-screen for a full-bleed cover. Note the count is
  `random(80, 1200*r) * r2` (63): the outer `*random(1)` scales it down again, so the
  effective count is usually far below 1200.
- `Triangulate.triangulate(points)` (68) builds the Delaunay triangulation — this is the
  geometry of every visible facet.
- `background(250)` (71), then `randomSeed(seed)` (73) makes the per-triangle choices
  deterministic.
- For each triangle (80-157): side lengths and Heron's area (124-127); one colour is drawn
  per triangle via `stroke(rcol(), 90)` (130) — `rcol()` (173-175) picks a random entry of the
  5-colour array (171), alpha 90 on the white ground is what makes the dots look pastel.
  Then `area*1.1` points (131-138) are sampled uniformly inside the triangle with the
  sqrt-biased barycentric method (`s1 = sqrt(r1)`, 134) and drawn with `point(x, y)` — this
  loop is the entire visible output. Bigger triangles get proportionally more dots, keeping
  density roughly constant across facet sizes.
- Inset points `i1..i3`/`c1..c3` (87-92) use `amp1`/`amp2` (78-79) but only feed commented-out
  code (94-122, 140-156); they do not affect the rendered image.
- `arc2()` (29-47) and `randInTri()` (161-168) are unused helpers.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_400 | `int cc = int(random(80, 1200*random(1))*random(1));` -> `... random(80, 400*random(1)) ...` | none | no visible change: pixel-identical to baseline — with seed 42 the effective point count was already below 400, so the point set (and everything derived from it) was unchanged | variants/count_400/frame_00001.png |
| alpha_220 | `stroke(rcol(), 90);` -> `stroke(rcol(), 220);` | moderate | same geometry, same dot density; dots are darker, so the pastel pink/blue/teal/magenta/yellow facets read as clearly more saturated, grain still visible | variants/alpha_220/frame_00001.png |
| palette_gray | `int colors[] = {#FF3E6D, #2C50FE, #F9FF60, #D036E9, #23778A};` -> `int colors[] = {#111111, #666666};` | moderate | identical geometry in grayscale: dark-gray and mid-gray stipple on white; all hue gone, mosaic now reads as a shaded relief of facets | variants/palette_gray/frame_00001.png |
| bb_0 | `float bb = 200;` -> `float bb = 0;` | moderate | points no longer overhang the canvas, so the triangulation shrinks to their convex hull: an irregular polygon of pastel facets sits in the middle with a white border all around | variants/bb_0/frame_00001.png |
| stipple_4.0 | `for (int j = 0; j < area*1.1; j++) {` -> `... j < area*4.0 ...` | large | 4x more dots per triangle; overlapping alpha-90 dots accumulate so triangles look near-solid, colours much more saturated, and the white ground nearly disappears | variants/stipple_4.0/frame_00001.png |

## Modularisation notes
Generic, library-worthy: the uniform-in-triangle point sampler (134-136, same math as
`randInTri`) and the "stipple-fill a polygon region with N = k*area points in one colour"
operation; both are parameterisable (density scale, colour, alpha) and independent of the
triangulation. One-off art decisions: the 5-colour palette with alpha 90, the 200 px
overhang margin `bb`, the `cc` point-count range, and the fixed white background. A clean
parameter object would be: `{pointCount, overhang, densityScale, palette, dotAlpha,
background}` with the triangulation + stipple fill as the core function.
