---
sketch: 2018/Generativos/pathfinder
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2053
animated: false
techniques: [noise-field, grid, voronoi-delaunay, 3d-mesh, subdivision, packing]
primitives: [ellipse, line, rect, shape]
palette:
  colors: ["#EFF1F4", "#81C7EF", "#2DC3BA", "#BCEBD2", "#F9F77A", "#F8BDD3", "#272928", "#E6E7E9", "#2CBB01"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: subdividedBox, signature: "subdividedBox(w, h, d, splits, mondrian) -> Box[]", note: "recursive quad-split of a box list (pathfinder.pde:291-401), optional mondrian recolor"}
  - {name: noiseCity, signature: "noiseCity(cc, cellSize, noiseDetail, buildP, parkP) -> city", note: "grid city from per-cell noise height + random tower/park/sand flags (pathfinder.pde:211-518)"}
  - {name: packedBoats, signature: "packedBoats(attempts, sizeFn, excludeRadius) -> PVector[]", note: "Poisson-ish rejection packing of circles in the sea region (barcos.pde:8-29)"}
  - {name: noiseClouds, signature: "noiseClouds(samples, detail, size, z) -> cloud field", note: "180k random samples kept where 3D noise > 0, drawn as random-rotated icosahedra (nubes.pde:26-44)"}
---

## What it draws
An isometric 3D diorama of a small square city floating on a teal platform in the middle
of a full-bleed pastel seascape. The city is a dense grid of gray low-rise buildings with a
few tall colored towers (gold, teal, black, pink) with spires, a large open plaza with
railing grid in the center, and tiny people and cars on the ring around the platform.
The surrounding sea is a patchwork of pink, yellow, teal and blue tones crossed by faint
white triangles (a triangulation of the boat positions); scattered "islands" are flat
colored discs holding single box-buildings, and white lumpy clouds float above.

## How the code works
- `setup()` (pathfinder.pde:20-29) sizes 960x960 P3D, `rectMode(CENTER)`,
  `ENABLE_STROKE_PERSPECTIVE`, then `generate()`. `draw()` is empty; the sketch is static
  (key press regenerates with a new seed). `seed` is set by the harness.
- `generate()` (pathfinder.pde:58-78) seeds `randomSeed`/`noiseSeed`, sets a flat
  `background(rcol())` (seed 42 gives pink `#F8BDD3`), then calls `back()` with the depth
  mask disabled, then `draw2()` with it enabled.
- `back()` (back.pde:1-51) draws the far background with no depth test: 40 stacks of 200
  shrinking, randomly rotated boxes (tunnel columns, mostly off-frame), 8000 short 8-step
  polylines whose direction follows a noise field (`det` in 0.002-0.005, back.pde:23-39)
  in random palette colors at alpha 20-100 — this is the busy speckled texture of the sea
  — and a full-screen 4-vertex quad drawn with `blendMode(ADD)` at alpha ~40 (back.pde:41-50)
  that lays the large soft pink/yellow/teal colour washes over everything.
- `draw2()` (pathfinder.pde:92-545) sets up two directional lights, then the isometric
  camera: `ortho()`, `translate(w/2, h*0.55, -2000)`, `rotateX(HALF_PI*0.5)`,
  `rotateZ(HALF_PI*0.5)` (pathfinder.pde:107-111).
  - `cc = int(random(20,32)*0.5)` (10-15) is the city grid; `ss = width*0.68/cc` the cell
    size (pathfinder.pde:117-119).
  - 1000 tiny ellipses scattered under the city (pathfinder.pde:123-130).
  - `barcos()` (barcos.pde:5-132): ~300-800 attempts to pack circles (`s = width*random(0.2)`)
    by rejection, excluding the central 0.42 region; each kept circle becomes a "boat":
    two flat ellipses (two palette colors), a hull quad (`barco()`, a rotated 6-face
    prism) plus a couple of cargo boxes. The boat centers and their buoy points are run
    through `Triangulate.triangulate` (toxiclibs/triangulate) and drawn as faint white
    stroke triangles (barcos.pde:108-131) — the web of thin white lines over the sea.
    Boat proximity also carves shallow dips in the building heights below (pathfinder.pde:156-164).
  - A faint 0.5-cell road grid of alpha-20 lines (pathfinder.pde:138-143), then a
    `cc*4 x cc*4` half-cell grid where each cell height is
    `s = pow(max(0, noise(des+x*det, des+y*det)*1.8-0.8), 1.2)` with `det = random(0.004)`
    (pathfinder.pde:153); cells are drawn as a vertical line + small top rect, and cells
    with s>0 get a colored ellipse cap (the low "hills" / street lights around the plaza).
    The central `cc-1..cc*3` block is skipped — that is the open plaza.
  - 10 random no-stroke boxes with colored cores (street lamps, pathfinder.pde:185-198).
  - Main city loop (pathfinder.pde:211-518): for each of the `cc*cc` cells, edge cells are
    `sand` (filled with `sandColor = rcol()`, palm trees via `palm()`,
    pathfinder.pde:598-641: a stack of 20 shrinking rotated boxes + 6 curved fronds);
    8% of inner cells are `build` towers: a tall box `ss*2.6` plus a lattice of thin
    crossbars (pathfinder.pde:466-486) and a spire + water tank on top; 1% are `park`
    (colored slab + a few stacked-cube trees); the rest are normal buildings: a base box
    whose height comes from 2D noise, then up to `int(random(6))` recursive quad-splits of
    the box list (pathfinder.pde:295-320); each sub-box may be a "mondrian" (4% chance,
    up to 20 further splits, each sub-box filled with a random palette color,
    pathfinder.pde:337-383) or a plain box in gray (random 180-240) with an optional
    rooftop box. The whole building gets an antenna if random (pathfinder.pde:585-596).
  - Plaza: a dark teal box `ss*(cc-1.4)` (pathfinder.pde:536) topped with a yellow
    `baranda()` railing grid (pathfinder.pde:567-583: vertical posts along four edges).
  - `personitas()` (personitas.pde): 600 tiny boxes (people) only on the outer ring;
    `autos()` (autos.pde): 200-1000 small boxes (cars) on the ring, rotated to face
    along the ring.
  - `nubes()` (nubes.pde): 180,000 random samples near z=400; where 3D simplex noise
    (toxi `SimplexNoise` is imported but this uses built-in `noise()`) passes a threshold,
    a randomly rotated icosahedron (ico.pde, `ICOSUBDIVISION=0`) of size ~24 is drawn in
    near-white — the lumpy clouds.
- Colour: everything samples `rcol()` — a uniform pick from the 7-color pastel list
  (pathfinder.pde:648-651); `getColor()` lerps between adjacent list entries.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `barcos()` packing loop (rejection-sampled circle packing with an exclusion
  radius), the recursive box quad-split + mondrian recolor, `baranda()` railing,
  `palm()`, the noise-gated icosahedron cloud field, and the noise-field background
  polylines in `back()` are all self-contained and reusable with the signatures above.
- One-off art decisions: the specific camera (fixed 45/45 iso with `ortho()`), the plaza
  carve-out (`continue` in the half-cell loop), the palette list itself, the ADD-blend
  full-screen wash, and the exact z-stack offsets (ss*0.05 etc.).
- A clean parameter object: `{seed, cc, cellSize, noiseDetail, buildP, parkP, mondrianP,
  splits, boatCount, boatSizeMax, cloudSamples, cloudNoiseThreshold, palette, camTiltX, camTiltZ}`.
