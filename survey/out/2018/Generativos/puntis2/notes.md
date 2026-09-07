---
sketch: 2018/Generativos/puntis2
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 2092
animated: false
techniques: [voronoi-delaunay, dots-stippling, scattered]
primitives: [point]
palette:
  colors: ["#FF3E6D", "#2C50FE", "#F9FF60", "#D036E9", "#23778A"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: stippleTriangulation, signature: "stippleTriangulation(nPoints, spread, densityPerArea, colorPick, alpha) -> void", note: "Delaunay-triangulate random points, fill each triangle with uniformly scattered dots in a random palette colour"}
  - {name: randInTri, signature: "randInTri(p1, p2, p3) -> PVector", note: "uniform random point inside a triangle (sqrt-biased barycentric)"}
---

## What it draws
Full-bleed off-white canvas tiled with a Delaunay triangulation of several hundred random points.
Every triangle is filled by dense stippling (hundreds to thousands of 1-px dots) in a single flat
colour randomly picked from a 5-colour palette (pink-red, blue, yellow, magenta, teal), at reduced
opacity so overlapping triangles blend into paler pastels. Large triangles read as bold colour
patches (magenta, pink, blue, teal, yellow) while small ones fade into near-white noise.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static (puntis2.pde:5-13).
`generate()` (puntis2.pde:52):

1. Spreads `cc = int(random(80, 1200*random(1))*random(1))` random points over the canvas plus a
   `bb = 200` margin past all edges (lines 62-66), so triangles are clipped full-bleed.
2. `Triangulate.triangulate(points)` (line 68) computes the Delaunay triangulation — the visible
   triangle mesh.
3. `background(250)` (line 71) sets the off-white ground.
4. Per triangle (lines 80-157): it computes the centroid and lerps vertices/edge-midpoints toward it
   (lines 86-92, used only by the commented-out arc/patch variants — `arc2` at lines 29-47 is
   likewise dead code), then the triangle area via Heron's formula (lines 124-127).
5. It then draws `area*1.1` dots (line 131): each dot is a uniform-in-triangle random point via the
   sqrt-barycentric trick `s1 = sqrt(r1)` (lines 132-136, same as `randInTri`, lines 161-168) and a
   1-px `point()` (line 137). Dot count therefore scales with triangle area, which is why large
   triangles look solid and small ones faint.
6. Colour: `stroke(rcol(), 90)` (line 130) — one colour per triangle, uniformly random from the
   5-entry `colors[]` array (line 171), drawn at alpha 90/255. That alpha is what makes overlaps and
   sparse regions blend into pastels on the near-white background. `getColor()` (lines 176-180)
   exists but is unused.
7. Randomness: point positions (lines 65), per-triangle colour (line 130), and every dot position
   (lines 132-133), all under `randomSeed(seed)` (line 73) — deterministic for a given seed.

Renderer is P2D with `smooth(8)`; no blend modes, no transforms, no shaders.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The generic core is: scatter N random points over a region (with optional margin), Delaunay-
triangulate, and stipple each cell with `area * k` uniform dots in a randomly picked palette colour
at a fixed alpha — a `stippleTriangulation(nPoints, spread, densityPerArea, colors, alpha)`
function would cover this sketch and many variants of it. `randInTri` (uniform point in triangle)
is a small reusable helper on its own.

One-off art decisions: the specific 5-colour palette, alpha 90, the `area*1.1` density constant,
the 200-px point margin, and the point-count range 80-1200 (the double `random(1)` product biases
it toward low values). Dead code (`arc2`, the commented arc/patch/subdivision blocks, `addPoint`,
`getColor`) is art-direction leftovers from earlier variants and should not be carried into a
library. A clean parameter object: `{ nPoints, pointMargin, dotDensityPerArea, palette, alpha,
background }`.
