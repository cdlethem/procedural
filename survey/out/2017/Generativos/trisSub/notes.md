---
sketch: 2017/Generativos/trisSub
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1555
animated: false
techniques: [subdivision, noise-field]
primitives: [shape]
palette:
  colors: ["#BCBDAC", "#CFBE27", "#F27435", "#F02475", "#3B2D38"]
  selection: noise-driven
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: fanSubdivide, signature: "fanSubdivide(tri, segments) -> Tri[]", note: "replace one triangle with `segments` slivers fanned from its apex (the vertex opposite the split edge); edge chosen so the apex is the vertex with the two longest incident edges (deorder, lines 150-167)"}
  - {name: noisePaletteColor, signature: "color(noise(x*det, y*det, t), palette) -> lerpColor", note: "getColor, lines 175-185: sample 2-D noise, map to fractional palette index, lerp between the two adjacent palette colours"}
---

## What it draws
A full-bleed canvas of flat, un-outlined triangles in a warm palette. With seed 42 the
subdivision loop happened to run only a tiny number of times, so the image is essentially one
giant triangle covering the whole canvas in orange (#F27435-ish) with a large gold/mustard wedge
(#CFBE27-ish) in the top right; the boundary between the two is a single straight diagonal edge.
No texture, no fine detail, no other palette colours visible.

## How the code works
`setup()` (lines 3-8) calls `generate()` once; `draw()` is empty, so the piece is static
(the frame-regeneration line 11 is commented out).

`generate()` (lines 25-62):
- Resets a local seed (line 26) and draws `background(250)` (line 30); translates to the canvas
  centre and applies one random global rotation (lines 31-32).
- Creates a single equilateral triangle `t` centred at `(0, height*0.1)` with radius
  `width*random(3, 3.6)/2` (line 36, constructor lines 66-75) — i.e. 1.5–1.8x the canvas
  width, so it always overflows the frame.
- Subdivision loop (lines 41-47): `sub = int(random(20000)*random(1))` — a product of two
  uniforms, which skews the count strongly toward small values. Each iteration picks a random
  existing triangle and replaces it with `int(random(2,5))` slivers via `sub()`
  (lines 106-117): the triangle is first re-ordered so that `x1` is the apex with the two
  longest incident edges (`deorder`, lines 150-167), then the opposite edge (x2→x3) is split
  into `cc` segments and `cc` thin triangles `(x1, a_i, a_{i+1})` are created.
- Fill loop (lines 51-61): each surviving triangle is drawn by `Tri.show()`
  (lines 85-96) as a `beginShape`/`endShape` with **per-vertex** fill:
  `getColor(noise(vertex*det, frameCount)*colors.length*2)` (lines 89-93). `det` is
  `random(0.002)` (line 28), so noise varies slowly across the huge triangle.
- `getColor` (lines 175-185) takes the noise value, reduces it modulo the palette length, and
  `lerpColor`s between two adjacent palette entries — that is where the smooth orange/gold
  shading comes from. Palette (line 171): sage `#BCBDAC`, mustard `#CFBE27`, orange `#F27435`,
  pink `#F02475`, plum `#3B2D38`.
- Randomness enters via: the re-seed (line 26), `det` (28), the global rotation (32), initial
  size (36), `sub` count (41), which triangle is split (43), and the split count `cc` (44).
- `strokeWeight(0.8)` (line 50) and `form()`/`cross()` (lines 188-246) are dead code in this
  configuration (`noStroke()` at line 54; `form`/`cross` never called).

Renderer is P2D with `smooth(8)` (line 5); `pixelDensity(2)` is rejected by the display
(stderr note in baseline result.json).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic (library-ready):** `fanSubdivide(tri, segments)` — the `sub()` + `deorder()` pair is
  a clean "split a triangle into a fan of slivers" primitive, independent of anything else.
  `noisePaletteColor(noiseVal, palette)` — lerp-between-adjacent-palette-entries colouring.
- **One-off art decisions:** the skewed `sub` count `int(random(20000)*random(1))` (which makes
  most runs sparse, like seed 42), the over-sized initial triangle and random global rotation,
  the specific 5-colour palette, `det`'s random range.
- **Parameter object:** `{segments (fan split count), subIterations, initialRadius (as canvas
  multiple), offset (triangle centre), rotation, det (noise frequency), palette}`. A clean
  version would take `subIterations` as a plain integer rather than the current skewed product.
