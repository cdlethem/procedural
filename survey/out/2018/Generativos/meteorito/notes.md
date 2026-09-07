---
sketch: 2018/Generativos/meteorito
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1603
animated: false
techniques: [voronoi-delaunay, dots-stippling, polar]
primitives: [ellipse, shape, triangle]
palette:
  colors: ["#121435", "#FAF9F0", "#EDEBCA", "#FF5722"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
  - {name: triangulate, signature: "triangulate(PVector[] pts) -> Triangle[]", note: "incremental Delaunay triangulation, port of Paul Bourke's triangulate.c (triangulator.pde)"}
  - {name: arcHalo, signature: "arcHalo(x, y, r1, r2, col, alphaIn, alphaOut) -> void", note: "soft ring of quads with two alpha levels; used as shadow/glow under dots and orbs"}
  - {name: taperedBand, signature: "taperedBand(x1, y1, x2, y2, halfWidth, c1, c2, a1, a2) -> void", note: "translucent capsule strip with half-circle end caps and per-end alpha (baston)"}
  - {name: stippleField, signature: "stippleField(count, sizeFn, palette, haloAlpha) -> void", note: "uniformly scattered tiny dots, each with an arc halo (background speckle layer)"}
  - {name: facetedDisk, signature: "facetedDisk(cx, cy, r, pointDensity, palette, shadeAlphas) -> void", note: "random in-disk points, Delaunay, random-colour facets + per-vertex dark-alpha overlay for low-poly shading"}
---

## What it draws
Cream/off-white background crossed by two broad diagonal translucent bands — one dark navy, one orange — running top-left to bottom-right, plus a fine dusting of tiny speckles. A cluster of overlapping "meteor" orbs sits centred on the canvas, largest in the middle and shrinking outwards: each orb is a disc filled with low-poly triangulated facets in orange, cream and navy, with a soft dark drop shadow and a faint halo. The whole image is flat, matte, poster-like; no strokes anywhere.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty so the sketch is static (confirmed: frames 10/60 identical).

- **Background + palette** (meteorito.pde:160-163): `colors[]` is the fixed 4-colour palette (navy `#121435`, off-white `#FAF9F0`, cream `#EDEBCA`, orange `#FF5722`); `rcol()` picks uniformly at random. `background(rcol())` (line 25) — the baseline got the off-white.
- **Speckle layer** (lines 31-39): 2000 iterations; each point uniform on canvas, size `width*random(0.004)*random(1)` (max ~3.8 px), drawn as an ellipse in a random palette colour, preceded by `arc2(..., col, 30, 0)` — a one-quad-wide halo ring at alpha 30 that makes each dot a tiny soft dot. This is the dusting of specks.
- **Diagonal bands** (lines 41-53, 115-153): `cc = 16` bands. All share one random angle `ang` (line 27); each band runs from a jittered centre point along `ang` for `diag = width*1.42`. `baston()` draws two half-disc end caps and a quad whose two ends carry different alphas (240 and 0), so each band fades out at the far end. With random colours from the 4-colour palette, the overlapping semi-transparent bands produce the navy/orange diagonal streaks.
- **Meteor orbs** (lines 56-93): for each of the 16, a size `ss` mapped 0.1-0.3 of width with ±0.05 jitter, and a centre mapped onto a shrinking diagonal spread (0.8→0) so orbs cluster in the middle. `meteor()` paints: a near-invisible dark ellipse (alpha 8, line 57) + an `arc2` halo (alpha 40, line 59) = the soft drop shadow; then scatters `max(20, PI*r²*2*random(0.0001, 0.002))` points in the disc using `rr = sqrt(random(r²))` for a uniform area distribution; triangulates with the local `Triangulator` (Bourke incremental Delaunay, triangulator.pde); drops triangles whose first vertex lies outside the disc (line 80); fills each surviving triangle with `rcol()` (line 81); then overlays the same triangle with per-vertex black alphas 0/10/50 (lines 84-91) — a cheap per-facet shading that gives the low-poly "cracked glass" look.
- Randomness enters via `random()`/`random(TWO_PI)` everywhere (positions, sizes, colours, angle, band jitter); the harness seeds the single `seed` field, so output is deterministic per seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic / library-ready**: `triangulator.pde` is a self-contained incremental Delaunay (Bourke port) — the single most reusable block; it has no sketch-specific state. `arc2` (soft ring via quads), `baston` (tapered translucent capsule band), the in-disc point scatter (`sqrt(random(r*r))` for uniform area density), and the per-vertex alpha shading overlay are all small, pure, parameterisable drawing functions.
- **One-off art decisions**: the fixed 4-colour palette and `rcol()` uniform pick; the shared global band angle `ang`; the specific map ranges (sizes 0.1-0.3 width, spread 0.8-0, `diag = width*1.42`, alphas 8/30/40, shade alphas 0/10/50); the 2000-speckle / 16-orb counts.
- **Clean parameter object**: `{palette: int[], bg: color, specks: {count, maxRelSize, haloAlpha}, bands: {count, angle, lengthRel, alphaIn, alphaOut, halfWidthFn(i)}, orbs: {count, minRelSize, maxRelSize, sizeJitter, spreadMax, pointDensity, shadeAlphas: [0,10,50]}}`. A `facetedDisk(cx, cy, r, density, palette, shadeAlphas)` wrapper plus `stippleField(...)` plus `taperedBand(...)` would reproduce the sketch from three calls.
