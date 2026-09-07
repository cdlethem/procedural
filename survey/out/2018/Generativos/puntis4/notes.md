---
sketch: 2018/Generativos/puntis4
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 2346
animated: false
techniques: [voronoi-delaunay, dots-stippling, noise-field, image-source, blend-modes]
primitives: [point, rect, shape, image]
palette:
  colors: ["#EC629E", "#E85237", "#ED7F26", "#C28A17", "#114635", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(280, 2200)", tried: [1500], change: large, effect: "denser, finer facets covering nearly the whole canvas (less black margin); also re-seeds all downstream layers via the shared random stream"}
  - {name: stipplePerArea, default: 2.1, tried: [6.0], change: large, effect: "much denser dot stipple inside facets (grainy fill); composition also shifted by the random-stream side effect"}
  - {name: bigTreeCount, default: 80000, tried: [20000], change: moderate, effect: "the dense stippled pine mass (bottom-right) thins out to individual scattered trees; mesh unchanged, downstream houses/figures/overlay shifted"}
  - {name: colors, default: "6-colour warm list", tried: ["6-colour cool blue/teal list"], change: moderate, effect: "identical composition, fully recoloured in blues/cyans/teals/grey-greens (palette edits do not consume the random stream)"}
  - {name: hazeCap, default: 0.6, tried: [1.0], change: none, effect: "no visible change; cap only matters where noise-0.1 > 0.6 and this seed's values barely exceed it (direct pixel check: max diff 19/255)"}
  - {name: figureCount, default: 18, tried: [40], change: moderate, effect: "more scattered small tinted figures; downstream ADD-glow/haze overlay pass shifted (random stream)"}
reusable_candidates:
  - {name: triangulate, signature: "triangulate(points: PVector[]) -> Triangle[]", note: "Delaunay triangulation via triangulate.jar; each triangle filled with a flat palette colour + faint stroke"}
  - {name: randInTri, signature: "randInTri(p1, p2, p3) -> PVector", note: "sqrt-biased barycentric sampling giving uniform points inside a triangle; drives area-proportional stippling"}
  - {name: noiseVertexFill, signature: "fillTriangleNoise(t, detail, offset, alphaMax)", note: "per-vertex alpha from 2D Perlin noise, used both for colour overlays and the white haze pass"}
  - {name: paletteLerp, signature: "getColor(colors[], t) -> color", note: "continuous noise-indexed lerp across a palette list (vs rcol's uniform pick)"}
---

## What it draws
A low-poly "landscape" filling most of the canvas: a Delaunay triangulation of random points
renders as a faceted surface of flat-coloured triangles (pinks, ochre yellows, oranges, teal
greens, mauve-greys) with faint white edges and a fine dot stipple inside. The point cloud is
squashed toward the top, so the triangulated mass has an irregular diagonal bottom edge and
black margins at top and bottom. Scattered over it are tiny dark pine-tree triangles, a few
small houses with pitched roofs, and a handful of small tinted human figures; a soft
noise-driven white haze patches over parts of the mesh.

## How the code works
`setup()` (puntis4.pde:6) sizes a 960x960 P2D canvas, loads `Tipitos` (Tipitos.pde:1) which
loads every image in `data/tipitos/` and threshold-binarises them (Tipitos.pde:26), then calls
`generate()` once (static output; `draw()` is empty, puntis4.pde:14).

`generate()` (puntis4.pde:27) proceeds in layers, all from ONE sequential `random()` stream
(after `randomSeed(seed)`, line 48), so changing any loop count shifts every later layer:
1. Points: `cc = random(280, 2200)` points (line 38); y drawn from
   `random(40, random(0.1,1.4)*random(0.1,1)*height+bb)` (line 40) so the cloud is biased
   toward the top and does not always reach the bottom — the ragged lower boundary of the mesh.
   `Triangulate.triangulate(points)` (line 43, triangulate.jar).
2. Per triangle: flat fill from `rcol()` (line 62, random from the 6-colour `colors[]` at
   line 258), stroke `255,10` (line 61); then `area*2.1` stipple points (line 75) sampled
   uniformly via sqrt-biased barycentrics (lines 81-83), stroke grey `r1*2*255` at alpha 40
   (line 79) — the fine grain inside each facet; then a per-vertex alpha pass with
   `noise(des + x*det)` (lines 88-100) giving patchy semi-transparent colour overlays.
3. Forest: 200 thin isosceles triangles (lines 128-137), size `pow(map(y,0,h,0.1,1),1.1)*0.22`
   so they shrink toward the top — the distant pines.
4. Big tree field: 80000 triangles (line 142); colour index from `noise(des2+x*det2,...)`
   lerped via `getColor(dc)` (lines 145/153), `noise(...)<0.6` skips most of the top (line
   147) — the dense stippled treeline mass concentrated in the lower right.
5. Houses: `random(8)` rectangles + gables (lines 158-184).
6. People: 18 tinted `tipitos` bitmaps (lines 187-194), tint from `rcol()` (line 192).
7. Overlay: `tris.size()*random(0.3)` triangles re-drawn with `blendMode(ADD)` per-vertex
   random-alpha fills (lines 198-224) brightening random facets; then a white haze pass,
   alpha from centroid noise capped by `constrain(...,0,0.6)` (lines 228-244).

Colour: 6-colour palette, either `rcol()` (uniform random, line 259) or `getColor()`
(noise-indexed lerp, line 265). Blend modes: ADD for the facet glow, BLEND elsewhere.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_1500 | `int cc = int(random(280, 2200*random(1))*random(1));` -> `int cc = 1500;` | large | whole composition redrawn: finer, denser facets reaching near all edges, smaller black bottom margin; same palette. Count change also shifts the shared random stream, so trees/houses/figures/overlay all moved too | variants/cc_1500/frame_00001.png |
| stipple_6 | `for (int j = 0; j < area*2.1; j++) {` -> `for (int j = 0; j < area*6; j++) {` | large | stipple inside facets ~3x denser: facets read as grainy dot fields instead of flat fills with sparse grain; composition also shifted (random-stream side effect) | variants/stipple_6/frame_00001.png |
| trees_20000 | `for (int i = 0; i < 80000; i++) {` -> `for (int i = 0; i < 20000; i++) {` | moderate | the dense stippled pine mass in the lower right thins to sparse individual trees; mesh identical, downstream houses/figures/haze slightly shifted | variants/trees_20000/frame_00001.png |
| palette_cool | `int colors[] = {#EC629E, ...};` -> `int colors[] = {#3A6EA5, #4C86A8, #62B6CB, #2E86AB, #114635, #000000};` | moderate | identical composition, fully recoloured: blues, cyans, teals, grey-greens replace pinks/ochres — confirms palette edits don't touch the random stream | variants/palette_cool/frame_00001.png |
| haze_1.0 | `float alp = 255*constrain(...-0.1, 0, 0.6);` -> `..., 0, 1.0);` | none | no visible change (direct pixel check: max diff 19/255, only in the haze region); the raised cap only matters where `noise-0.1 > 0.6` and this seed's values barely exceed the old cap | variants/haze_1.0/frame_00001.png |
| figures_40 | `for (int i = 0; i < 18; i++) {` -> `for (int i = 0; i < 40; i++) {` | moderate | more small tinted figures scattered in the mid-ground; downstream ADD-glow/haze pass shifted by the stream, so facet brightening differs slightly | variants/figures_40/frame_00001.png |

## Modularisation notes
- Generic: `triangulate(points)` + flat-fill/stroke pass; `randInTri` uniform-in-triangle
  sampling; area-proportional stippling loop; per-vertex noise-alpha fill (used twice: colour
  overlay and white haze); palette helpers `rcol`/`getColor`; depth-based size scaling
  `pow(map(y,0,h,0.1,1),1.1)` for faux perspective.
- One-off art decisions: the specific 6-colour sunset palette; pine/house/figure motifs, their
  counts and shapes; the squashed-toward-top point y distribution; the ADD-glow pass; the
  thresholded human bitmaps; the single sequential random stream (coupling all layers — a
  library version should seed each layer independently so counts can be tuned in isolation).
- Parameter object: `{pointCount, stipplePerArea, forestCount, bigTreeCount, houseCount,
  figureCount, hazeAlphaMax, palette[], glowFraction}`.
