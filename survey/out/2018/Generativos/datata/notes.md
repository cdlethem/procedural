---
sketch: 2018/Generativos/datata
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1627
animated: false
techniques: [voronoi-delaunay, radial]
primitives: [shape, ellipse]
palette:
  colors: ["#121435", "#FAF9F0", "#EDEBCA", "#FF5722"]
  selection: random-from-list
composition: centered
parameters:
  - {name: ss (disc diameter as fraction of width), default: "random(0.56, 0.65)", tried: [0.9], change: large, effect: "bigger disc; point count is area-based so facet density rises with it"}
  - {name: cc (point-density random range), default: "random(0.00001, 0.001)", tried: ["random(0.001, 0.01)"], change: moderate, effect: "denser cluster fills the whole disc with smaller facets"}
  - {name: haloAlpha (arc2 shd1), default: 30, tried: [120], change: subtle, effect: "halo becomes a clearly visible dark soft ring around the disc"}
  - {name: cornerShade (overlay fill(0,x) max alpha), default: 50, tried: [200], change: subtle, effect: "strong dark corner gradient on light facets; dark facets barely affected"}
  - {name: "colors[3] (fourth palette colour)", default: "#FF5722", tried: ["#2E7D32"], change: subtle, effect: "orange facets become forest green"}
reusable_candidates:
  - {name: delaunayTriangulate, signature: "triangulate(PVector[] pts) -> Triangle[]", note: "incremental Delaunay triangulation with supertriangle + circumcircle test (port of Paul Bourke's triangulate.c, in triangulator.pde)"}
  - {name: softHalo, signature: "arc2(x, y, s1, s2, a1, a2, col, shd1, shd2)", note: "ring of quad strips with per-vertex alpha gradient; soft glow/shadow annulus around a shape"}
  - {name: facetedDisc, signature: "facetedDisc(cx, cy, radius, pointCount, palette, shadeAlpha) -> void", note: "random points in a disc, Delaunay-triangulated, each triangle filled with a random palette colour plus a low-alpha black overlay triangle for facet shading"}
---

## What it draws
A single centered composition on a pale cream background: a large off-white circular
disc with a soft dark halo around its rim, containing a faceted "low-poly" cluster of
triangles. The triangles are filled with dark navy, bright orange, off-white and muted
khaki, each facet subtly shaded darker toward one corner, giving a cut-gem look.

## How the code works
`setup()` -> `generate()` (datata.pde:3-9) draws everything once; `draw()` is empty, so
the piece is static (key press regenerates with a new seed, :14-20).

- Background: `background(rcol())` (:23) picks a random palette colour (here pale cream).
- Halo: `arc2(cx, cy, ss, ss*1.2, 0, TWO_PI, 0, 30, 0)` (:30) fills an annulus from the
  disc radius out to 60% more with black at alpha 30, producing the soft shadow ring
  (arc2 is a ring of small quads with a per-vertex alpha ramp, :90-108).
- Disc: `fill(rcol()); ellipse(cx, cy, ss, ss)` (:31-32) with `ss = width*random(0.56,0.65)` (:26).
- Points: `cc` random points placed uniformly in a circle of radius `ss*0.5`
  (:35-45); count is area-based, `cc = int(PI*r*r*2*random(0.00001, 0.001))` (:36).
  Each point stores an unused size `s = random(2,10)` in `p.z` (only the commented-out
  block at :67-87 used it).
- Triangulation: a custom incremental Delaunay (supertriangle + circumcircle test,
  triangulator.pde:275-362, port of Paul Bourke's algorithm) turns the points into
  triangles; only triangles whose `p1` lies inside the disc are drawn (:52).
- Facets: each drawn triangle gets a random palette fill (:53), then a tiny black
  overlay triangle with per-vertex alpha 0/10/50 (:56-63) shades one corner darker —
  the cut-gem look.
- Colour: `rcol()` (:116-118) picks uniformly from the 4-colour palette at :115
  (navy #121435, off-white #FAF9F0, cream #EDEBCA, orange #FF5722); `getColor()`
  (:119-127, lerp between palette neighbours) is defined but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ss_0.90 | `float ss = width*random(0.56, 0.65);` -> `float ss = width*0.9;` | large | disc fills ~90% of canvas; the faceted cluster grows with it (point count is area-based, so density roughly doubles); halo ring runs off the canvas edge | variants/ss_0.90/frame_00001.png |
| cc_0.01 | `int cc = int(PI*r*r*2*random(0.00001, 0.001));` -> `int cc = int(PI*r*r*2*random(0.001, 0.01));` | moderate | facet cluster now fills the whole disc, with noticeably smaller, finer triangles | variants/cc_0.01/frame_00001.png |
| halo_alpha_120 | `arc2(cx, cy, ss, ss*1.2, 0, TWO_PI, 0, 30, 0);` -> `arc2(cx, cy, ss, ss*1.2, 0, TWO_PI, 0, 120, 0);` | subtle | halo becomes a clearly visible dark soft ring (drop-shadow) around the disc; geometry unchanged | variants/halo_alpha_120/frame_00001.png |
| shade_200 | `fill(0, 50);` -> `fill(0, 200);` | subtle | light (white/cream) facets show a strong dark corner gradient, more 3-D cut-gem look; dark navy/orange facets nearly unchanged | variants/shade_200/frame_00001.png |
| palette_green | `int colors[] = {#121435, #FAF9F0, #EDEBCA, #FF5722};` -> `int colors[] = {#121435, #FAF9F0, #EDEBCA, #2E7D32};` | subtle | former orange facets become forest green; navy, white and khaki unchanged | variants/palette_green/frame_00001.png |
- Generic: the Delaunay triangulator (triangulator.pde) is self-contained and directly
  reusable as a library primitive; `arc2` soft-halo is a nice generic helper (radial
  alpha gradient ring); the "random points in disc -> triangulate -> per-face random
  fill + corner shade" pipeline is the reusable core (see `facetedDisc`).
- One-off art decisions: the 4-colour palette, the background/halo/disc colour
  choices, the area-based point density formula, the 0/10/50 corner-shade alphas.
- A clean parameter object: `{radius (fraction of width), pointDensity, palette[],
  haloAlpha, cornerShade [a1,a2,a3], background}` — everything else is plumbing.