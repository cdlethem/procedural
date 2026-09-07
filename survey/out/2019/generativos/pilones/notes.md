---
sketch: 2019/generativos/pilones
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1529
animated: false
techniques: [grid, voronoi-delaunay, dots-stippling, lines-hatching, polar, blend-modes]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#FBFF38", "#889DD8", "#FFD8EB", "#F41D3A", "#164BB7", "#ffffff", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, col, alp1, alp2)", note: "radial-gradient annulus built from QUAD quads, alpha fades alp1->alp2 from inner to outer radius"}
  - {name: snappedPoints, signature: "snappedPoints(count, grid) -> PVector[]", note: "random points snapped to a grid, de-duped by min distance"}
  - {name: eyeMotif, signature: "eye(x, y, d, inv) -> void", note: "colored disc with black/white half disc + inner dot, the recurring 'eye'"}
---

## What it draws
A very dense, full-bleed constructivist collage on a near-white field. A fine ~20px grid of thin
lines, tiny squares and 2px dots underlies everything. Over it lies a colourful Delaunay
triangulation of about 200 points — flat yellow, periwinkle, pink, red, blue, black and white
triangles, many of them semi-transparent so they blend into each other. Scattered across the whole
surface are dozens of circles: large "pilones" (diameter ~72) with soft radial-gradient rings and
black/white half-filled "eyes", plus a second layer of smaller (~32) halo circles. The overall
read is a busy Bauhaus/constructivist mosaic where crisp triangles, dots and gradient circles sit
on top of one another.

## How the code works
`settings()` (pilones.pde:14) opens a 960x960 P2D window with `smooth(8)`. `generate()` (pilones.pde:52)
runs once in `setup()` (pilones.pde:23) and is the only drawing code; `draw()` is empty, so the image is
static (baseline frames 10/60 were dropped as identical to frame 1).

Layers, in order (all colours via `rcol()`, pilones.pde:229, which picks a random entry from the 7-colour
`colors[]` list at pilones.pde:225):

1. **Grid lines** (pilones.pde:67-75): 200 random points snapped to a `s = 20` grid, each drawn as a
   stroked `120x120` rect in a random palette colour. Because they all snap to the 20px lattice they tile
   into the fine grid of thin lines.
2. **Sparse squares** (pilones.pde:77-86): over every 20px grid cell, with 10% probability a filled 20x20
   square in a random colour.
3. **Stipple dots** (pilones.pde:88-99): over every grid cell, with 80% probability a 2x2 dot; with 10% a
   10x10 dot plus a 4x4 dot on top. This is the fine speckle texture.
4. **Triangulation** (pilones.pde:101-136): 200 snapped, de-duped points are Delaunay-triangulated with
   `Triangulate.triangulate` (org.processing.wiki.triangulate). 40% of triangles are skipped
   (`if (random(1) < 0.4) continue;`), each drawn triangle is filled with a random colour at alpha
   `random(180,255)` per vertex (giving the translucent blends) and stroked black or white at 50%.
5. **Vertex dots** (pilones.pde:140-146): a small disc (`s*0.3`) and an inner 2px dot in black/white at
   every triangulation point.
6. **Big pilones** (pilones.pde:148-177): 80 circles of size `s = 80`, each a coloured disc with a soft
   radial-gradient halo from `arc2()`, a black/white half-filled "eye" (`inv`), and sometimes an arc
   segment. `arc2()` (pilones.pde:200) builds a gradient annulus out of `cc` QUAD quads whose alpha fades
   from `alp1` (inner) to `alp2` (outer).
7. **Small halo circles** (pilones.pde:179-197): 80 circles of size `s = 40`, each a coloured disc + inner
   dot + a faint gradient ring, occasionally a large faint halo.

Randomness enters only through the seeded `random()` (seed fixed to 42 by the harness); `noiseSeed` is set
but `noise()` is never called. The blend/overlap of translucent triangles and gradient circles is what gives
the image its layered depth.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic / reusable**: `arc2()` (radial-gradient annulus) is a self-contained helper and a strong
  library candidate — parameterise radius, angle range, colour, inner/outer alpha. `snappedPoints()`
  (snap random points to a grid + de-dup by min distance) is used three times for the grid, the
  triangulation and the circle layers, so it belongs in the library too. The Delaunay step is just a
  call to the `triangulate` library.
- **One-off art decisions**: the exact 7-colour palette, the specific probability thresholds (0.1, 0.8,
  0.4, 0.1), the disc+eye motif, the `s` values (20/80/40), and the layer order are all stylistic choices.
- **Clean parameter object**: `{grid: 20, dotDensity: 0.8, squareDensity: 0.1, triPoints: 200,
  triSkip: 0.4, bigCount: 80, bigSize: 80, smallCount: 80, smallSize: 40, palette: [...]}`. The `arc2`
  segment count `cc` (pilones.pde:203) scales with radius and could be exposed as a smoothness knob.
