---
sketch: 2019/generativos/ciscis
year: 2019
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1619
animated: false
techniques: [subdivision, voronoi-delaunay, 3d-mesh, dots-stippling]
primitives: [point, shape]
palette:
  colors: ["#FF66FC", "#F0F0F0", "#000000"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: subdivisions, default: 100, tried: [30], change: large, effect: "coarser quadtree: far fewer, much larger triangles; prisms sparser, built on larger cells, read as long thin spikes"}
  - {name: prismHeight, default: 200, tried: [600], change: moderate, effect: "prisms up to 3x taller: towers stretch higher, dot grids elongated; ground plane unchanged"}
  - {name: prismSkip, default: 0.4, tried: [0.1], change: large, effect: "~90% of triangles become prisms: much denser dark upper-center cluster, dot texture and wireframe across most of the plane"}
  - {name: groundSkip, default: 0.2, tried: [0.0], change: large, effect: "solid black triangular holes disappear; ground fully faceted - confirms the black triangles are ground triangles skipped in the flat pass"}
  - {name: groundFillFrom, default: "#ff66fc", tried: ["#66fcff"], change: moderate, effect: "ground facets shift from magenta/white to cyan/white (both lerped to light gray); holes and wireframe unchanged"}
  - {name: windowSub, default: 20, tried: [8], change: moderate, effect: "sparser 8x8 dot grids: window stipple texture lighter and thinner, wireframe more visible"}
reusable_candidates:
  - {name: quadtreeSubdivide, signature: "quadtreeSubdivide(w, h, iterations, pickFrom) -> Rect[]", note: "iteratively split random rects into 4 quadrants (lines 59-69, 99-102)"}
  - {name: prismExtrude, signature: "prismExtrude(t, h) -> shape", note: "top triangle + 3 side quads from a base triangle and a height (lines 125-152)"}
  - {name: dotGridOnQuad, signature: "dotGridOnQuad(p1, p2, p3, p4, sub1, sub2)", note: "sub1 x sub2 point grid across a quad face (winwin, lines 197-208)"}
---

## What it draws
A tilted 3D scene filling the whole canvas. The ground is a faceted plane of flat triangles in
pink-to-white shades (magenta `#ff66fc` lerped toward light gray), with a scattering of solid black
triangular holes. Rising out of the plane is a "city" of triangular prisms of random heights, drawn
as faint black wireframe; several prism side faces carry dense black 20x20 dot grids ("windows"),
which read as dark stippled texture. The upper-center cluster is the densest, where wireframes and
dot grids overlap into near-black masses.

## How the code works
`setup()` calls `generate()` once (line 26); `draw()` is empty (lines 34-35), so the piece is static.
`uses_shader` is flagged in result.json but `loadShader`/`filter` are commented out (lines 191-194);
display is `:2` (real X), so the render is trustworthy.

- Black background (line 77); `randomSeed(seed)` (line 78).
- Lights set up at lines 81-84 (ambient + two directional).
- Camera: `ortho()` (88), translate to center (89), `rotateX(PI*0.25 + random(-0.3, 0.2))` (90),
  `rotateZ(PI*(0.25 + random(0.5)))` (91), `scale(2.2)` (93) — the whole scene is a tilted plane
  that overfills the canvas.
- Geometry: the full-canvas rect is seeded (97); 100 iterations (99-102) pick a random rect from the
  first half of the list and split it into 4 quadrants (`subdivide`, lines 59-69) → 301 rects.
  The rect centers become points (107-110), Delaunay-triangulated via
  `Triangulate.triangulate(points)` (line 113).
- Prism pass (118-177): 40% of triangles are skipped (119); each kept one gets a height
  `h = random(200)*random(1)` (122), a top triangle at z=h, and 3 side quads (125-152), all
  `noFill` with `stroke(0, 20)` (line 115) — the faint wireframe. Two of the three side faces get a
  20x20 point grid via `winwin` (161, 168; function at 197-208) — the dense black dot "windows".
- Ground pass (179-189), drawn last: the same triangles flat at z=0; 20% are skipped (181), leaving
  the black background showing through as the solid black triangles; the rest are filled with
  `lerpColor(#ff66fc, color(240), random(1))` (183, 185) — the pink-to-white facets. Because this
  pass is drawn after the prisms, the ground plane covers their bases.
- Randomness enters at: rect picking (100), the two rotations (90-91), prism skipping (119),
  heights (122), ground skipping (181), ground fills (183, 185). All seeded (42), deterministic.
- Unused code: `SimplexNoise` import (line 2), `colors[]`/`rcol()`/`getColor()` (214-229),
  `det`/`des` (5), `post` (6).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| subdivide_30 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 30; i++) {` | large | coarser tessellation: fewer, much larger triangles; prisms sparser but sit on larger cells, reading as long thin wireframe spikes | variants/subdivide_30/frame_00001.png |
| height_600 | `float h = random(200)*random(1);` -> `float h = random(600)*random(1);` | moderate | same layout (same seed/geometry), prisms up to 3x taller: towers stretch higher, dot grids elongated vertically; ground plane identical | variants/height_600/frame_00001.png |
| prismSkip_0.1 | `if(random(1) < 0.4) continue;` -> `if(random(1) < 0.1) continue;` | large | ~90% of triangles become prisms: upper-center cluster far denser and darker, dot texture and wireframe now cover most of the plane | variants/prismSkip_0.1/frame_00001.png |
| groundSkip_0.0 | `if (random(1) < 0.2) continue;` -> `if (random(1) < 0.0) continue;` | large | solid black triangular holes gone; ground plane now fully pink/white faceted - confirms the black triangles are skipped ground triangles showing the black background | variants/groundSkip_0.0/frame_00001.png |
| fillBlue | `fill(lerpColor(#ff66fc, color(240), random(1)));` -> `fill(lerpColor(#66fcff, color(240), random(1)));` | moderate | ground facets recolored from magenta/white to cyan/white; black holes, wireframe and dot grids unchanged | variants/fillBlue/frame_00001.png |
| winwin_8 | `winwin(p1, p2, p3, p4, 20, 20);` -> `winwin(p1, p2, p3, p4, 8, 8);` | moderate | dot grids thinned to 8x8: window stipple texture visibly lighter and sparser, prism wireframe more legible | variants/winwin_8/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: the quadtree subdivision loop (59-102) is a clean
  `rects -> rects` operator (parameterize iteration count and pick bias); `winwin` (197-208) is a
  pure "point grid over a quad" utility; prism extrusion (125-152) is a small parametric mesh
  builder. The Delaunay step is already a library call (`triangulate`).
- One-off art decisions: the exact rotation ranges (90-91), `scale(2.2)`, the 0.4/0.2 skip
  probabilities, the height distribution `random(200)*random(1)`, the pink-gray lerp palette, and
  the decision to draw the flat ground pass last.
- A clean parameter object: `{size, subdivisions, prismSkip, groundSkip, heightRange, windowSub,
  paletteFrom, paletteTo, seed}`. The unused `colors[]`/`getColor()` machinery suggests an earlier
  palette iteration; a `palette` parameter with a `lerp-between` mode would subsume it.
