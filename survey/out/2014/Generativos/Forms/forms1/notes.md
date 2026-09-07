---
sketch: 2014/Generativos/Forms/forms1
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 241
animated: false
techniques: [distortion, lines-hatching, grid]
primitives: [line, rect, ellipse, pgraphics]
palette:
  colors: ["#FD0F65", "#FB6159", "#FFA85E", "#FFDF61", "#E5CA9D"]
  selection: fixed
composition: scattered
parameters:
  - {name: formCount, default: 20, tried: [30], change: moderate, effect: "more, denser overlapping forms; canvas fills up, more overlap and darker crossed hatches"}
  - {name: vertices, default: 4, tried: [6], change: moderate, effect: "hexagonal instead of quadrilateral outlines; larger, rounder shapes, same hatch/annotation style"}
  - {name: sizeRange, default: [60, 200], tried: [[100, 300]], change: large, effect: "forms up to 300px span; almost no white background left, composition becomes a full-bleed mass of hatching"}
  - {name: strokeAlpha, default: 80, tried: [160], change: moderate, effect: "same layout, all lines twice as dark; hatched fills read as mid-grey instead of light grey"}
  - {name: hatchSpacing, default: 4, tried: [10], change: moderate, effect: "hatch lines 10px apart instead of 4; fills are much sparser and lighter, bead dots on edges fewer and more visible as gaps"}
  - {name: beadSize, default: 4, tried: [10], change: subtle, effect: "small pixel diff, but the intersection dots on every polygon edge become clearly visible open circles, heavily beading the outlines"}
reusable_candidates:
  - {name: clipHatch, signature: "clipHatch(polygon: Point[], origin: Point, angle: float, spacing: float, radius: float) -> List<Line>", note: "parallel hatch lines through a region, clipped to a polygon via segment intersection"}
  - {name: segmentIntersection, signature: "segmentIntersection(p1, p2, p3, p4) -> Point|null", note: "line-segment intersection with bounds check, used to clip hatch to the polygon"}
  - {name: randomPolygon, signature: "randomPolygon(cx, cy, vertexCount, size, seed) -> Point[]", note: "vertices on a jittered polar grid: angle in [i*cang, (i+1)*cang) + random offset, radius in [0.8, 1.2]*size"}
---

## What it draws
A white 600x800 canvas covered in ~20 overlapping outlined quadrilaterals, all in
thin grey-black strokes. Each quadrilateral carries its own "construction drawing":
a bounding box, a circumscribed circle sized to the box diagonal, a small X at the
centre, and a dense set of parallel hatch lines at a random angle filling the
shape. Where a hatch line enters and exits the polygon, a tiny dot marks the
intersection, so the polygon edges look beaded. Everything is monochrome; the warm
pink/orange/yellow palette defined in the code is never used.

## How the code works
`setup()` (forms1.pde:4-15) sets 600x800, builds a 5-colour warm `paleta` (lines
8-12, never applied: `noFill()` at line 18 and the only stroke is `stroke(0, 80)`
at line 97), sets a white background, and calls `generar()` once. `draw()` is
empty (lines 28-29), so the image is static; `keyPressed` (lines 31-38)
regenerates on any non-'s' key, which is irrelevant to the render.

`generar()` (lines 17-26) loops 20 times: picks a size `tam = random(60, 200)`
(line 21) and a position `random(width), random(height)`, builds a `Form` with
`cant = 4` vertices (line 23), and calls `f.dibujar()`.

`Form` constructor (lines 56-95): for each of `cant` vertices, the angle is a
random value in the wedge `[cang*i, cang*(i+1))` plus a shared random offset
`dang` (line 70), the radius is `random(tam*0.8, tam*1.2)` (line 68) — i.e. a
regular quadrilateral with per-vertex angle/radius jitter, giving the
irregular-looking quads. It then computes the bounding box (lines 75-86),
re-centres the shape on that box centre (lines 87-94), and stores `dig`, the
box diagonal (line 89), used later for circle and hatch extent.

`dibujar()` (lines 96-150) draws, per form:
1. the closed polygon outline, `noFill()`, `stroke(0, 80)` (lines 97-105);
2. the bounding-box `rect` outline (line 106);
3. an X cross of half-size `ct = 10` at the centre (lines 107-109);
4. a circle of diameter `dig` (line 110) — the large thin circles;
5. the hatch: with `tam = 4` px spacing (line 111) and `cl = dig/tam` (line 112),
   a random angle `ang` (line 113); for each offset `i` in `[-cl/2, cl/2]` it
   builds a full line of length `2*rad` (`rad = dig/2`, line 115) through
   `centre + perp(ang)*4*i`, then clips it to the polygon by testing each of the
   4 edges with `intersection()` (lines 126-134). If exactly two intersections
   are found it draws the segment between them (line 139) — that is the hatch
   fill — and drops a 4px dot at each intersection (line 132), producing the
   beaded edges.
6. A loop over the collected `lineas` (lines 143-149) alternates
   `fill(0,20)`/`fill(255,20)` but its `quad()` call is commented out (line
   148), so no shading actually happens.

Randomness enters from: position (line 23), size (line 21), per-form angle
offset (line 65), per-vertex angle and radius (lines 68, 70), and hatch angle
(line 113). No noise is used; `smooth(8)` just anti-aliases.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_30 | `for (int i = 0; i < 20; i++) {` -> `for (int i = 0; i < 30; i++) {` | moderate | 30 forms instead of 20: noticeably denser, more overlaps, darker crossed hatch regions | variants/count_30/frame_00001.png |
| vertices_6 | `new Form(random(width), random(height), 4, tam)` -> `..., 6, tam)` | moderate | hexagonal outlines instead of quads; shapes look larger and rounder, hatch density per shape unchanged | variants/vertices_6/frame_00001.png |
| size_300 | `float tam = random(60, 200);` -> `float tam = random(100, 300);` | large | forms up to 300px: white gaps almost gone, canvas is a full-bleed tangle of big hatched shapes | variants/size_300/frame_00001.png |
| stroke_160 | `stroke(0, 80);` -> `stroke(0, 160);` | moderate | identical geometry, all strokes double the darkness; fills read mid-grey, outlines clearly bolder | variants/stroke_160/frame_00001.png |
| hatch_10 | `float tam = 4;` -> `float tam = 10;` | moderate | sparse 10px hatch spacing: much lighter fills, fewer lines, bead dots on edges spaced far apart | variants/hatch_10/frame_00001.png |
| bead_10 | `ellipse(in.x, in.y, 4, 4);` -> `ellipse(in.x, in.y, 10, 10);` | subtle | pixel diff small, but every polygon edge is now lined with large open circles — the beaded-edge look is exaggerated | variants/bead_10/frame_00001.png |

## Modularisation notes
- Generic: `intersection()` (lines 153-163) is a clean, self-contained
  segment-intersection utility. The hatch-and-clip block (lines 116-142) is a
  reusable `clipHatch(polygon, origin, angle, spacing, radius)` — polygon
  hatching clipped by exact edge intersection, with optional intersection
  markers. The `Form` constructor is a reusable jittered-polar `randomPolygon`.
- One-off art decisions: the "blueprint" annotation set (bounding box, diagonal
  circle, centre X), the 4px bead dots at intersections, the fixed `stroke(0, 80)`
  monochrome look, the 20-form count and 60-200 size range, and the dead
  alternating-fill block (lines 143-149).
- Clean parameter object: `{count, sizeMin, sizeMax, vertices, jitterRadius
  [0.8, 1.2], hatchSpacing, beadSize, showBox, showCircle, showCross,
  strokeAlpha, seed}`.
