---
sketch: 2017/Generativos/nipon
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1479
animated: false
techniques: [subdivision, grid, polar]
primitives: [shape]
palette:
  colors: ["#B8C4C0", "#F2205E", "#205EF2", "#20F25E", "#F79832", "#F18315", "#DB6B01", "#9C3702", "#AD4B02"]
  selection: fixed
composition: margins
parameters:
  - {name: cc, default: "int(random(1000)*random(1)*random(1))", tried: [150], change: large, effect: "grid markedly finer and denser; wedges chopped into smaller fragments; busier, darker overall (also shifts downstream RNG)"}
  - {name: sub, default: "int(random(16, random(16, 80)))", tried: [20], change: large, effect: "sparse fans: few wide-spaced wedges, large sage gaps, grid much more visible; more open composition (also shifts downstream RNG)"}
  - {name: diag, default: "dist(0, 0, width, height)*0.91", tried: ["dist(0, 0, width, height)*0.5"], change: moderate, effect: "fans truncated to ~half length; canvas edges largely empty sage grid; clean single-variable test (no random() in the line)"}
  - {name: amp, default: "random(0.2, 0.7)", tried: [0.25], change: large, effect: "wedges become thin needle-like spokes with big gaps; fans read as radial spikes, not thick blades (also shifts downstream RNG)"}
  - {name: b, default: 1, tried: [0], change: subtle, effect: "no visible change to composition; the 1px gaps between grid cells disappear and wedge fragments merge into continuous shapes"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(rects, iterations) -> Rect[]", note: "recursively split a random rect into 2-4 equal horizontal/vertical slices until the iteration budget is spent"}
  - {name: clipPoly, signature: "clipPoly(polyA, polyB) -> PVector[]", note: "convex polygon intersection: mutual interior points + edge crossings, then angular vertex ordering"}
  - {name: wedgeFan, signature: "wedgeFan(cx, cy, radius, wedges, amplitude, startAngle) -> PVector[][]", note: "fan of triangle wedges from a center, each spanning (amplitude * TWO_PI/wedges) radians"}
---

## What it draws
A full-bleed sage-grey-green field (with a 16px margin) covered by an irregular grid of thin pale
lines. Three colored fan shapes — magenta, blue and green — radiate from three scattered centers;
each fan is a bundle of thin wedge triangles clipped to the grid cells, so the wedges are chopped
into fragments that follow the grid lines. Where fans of different colors cross, the overlaps read
as much darker blends (deep navy, dark teal, dark maroon).

## How the code works
- `setup()` (nipon.pde:3-8): `size(960, 960, P2D)`, `smooth(8)`, `pixelDensity(2)` (ignored: not
  available on the display), then `generate()` once. `draw()` is empty, so the sketch is static;
  any key regenerates, `s` saves.
- `generate()` (nipon.pde:35-101):
  1. Background `#B8C4C0` (line 36) and `blendMode(DARKEST)` (line 38): every overlapping fill
     keeps the darker color, which is what creates the dark navy/teal/maroon intersection zones.
  2. Recursive rect subdivision (lines 40-68): one rect inset by `bb = 16` (line 41). Up to
     `cc = int(random(1000)*random(1)*random(1))` iterations (line 43, effectively `random(1000)`):
     pick a random rect, slice it into `sub = int(random(2, 5))` equal parts horizontally or
     vertically, add the slices and remove the parent (only when a slice would be wider than 5px).
     The rect list grows every split, so later splits hit smaller cells and the grid gets finer
     toward the edges of the split tree.
  3. Each `Rect` stores its corners inset by `b = 1` (lines 27-32): a 1px gap between adjacent
     slices, so the pale grid lines are just background showing through.
  4. Three wedge fans (lines 71-100): fan `j` is filled `#F2205E` (j=0), `#205EF2` (j=1),
     `#20F25E` (j=2) (lines 79-81), `noStroke()`. Per fan: radius `diag = 0.91 * dist(0,0,width,height)`
     (line 72), `sub = int(random(16, random(16, 80)))` wedges (line 73), `amp = random(0.2, 0.7)`
     (line 74, wedge width as a fraction of the angular step `TWO_PI/sub`), random start angle
     (line 75), random center in 10-90% of the canvas (lines 77-78). Each wedge is a triangle:
     center + two points on the circle (lines 83-89). For every grid rect, `intersection(rect.points,
     wedge)` (line 91) computes the wedge clipped to that cell (mutual interior points + edge
     crossings, lines 174-190), `orderPoly` (line 92) re-sorts vertices angularly around the
     centroid to fix winding, and the fragment is filled (lines 93-97). Each wedge is thus painted
     once per grid cell it crosses — fragments separated by the 1px gaps — and where two fans cover
     the same cell the DARKEST blend darkens it.
- Dead code: the orange `colors[]` array and `rcol`/`getColor`/`shuffleArray` (lines 108-129) are
  never used; the real palette is the three hardcoded fan fills.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_150 | `int cc = int(random(1000)*random(1)*random(1));` -> `int cc = 150;` | large (mean 0.271, 0.757) | grid is markedly finer and denser than baseline (thin white hairlines, small cells everywhere); the three fans are the same centers/colours but their blades are chopped into many small fragments; much more dark-navy overlap visible; overall busier and darker. Note: replacing the random expression also shifts the downstream random stream, so the split pattern differs, not just the iteration count. | variants/cc_150/frame_00001.png |
| sub_20 | `int sub = int(random(16, random(16, 80)));` -> `int sub = 20;` | large (mean 0.2821, 0.778) | fans become sparse: ~20 wedges each with wide gaps, so large areas of sage background with the white grid lines clearly visible; blades are wide where present (e.g. big magenta trapezoid top-center); composition much more open than baseline. Downstream RNG also shifts, so the other two fans' parameters differ. | variants/sub_20/frame_00001.png |
| diag_0.5 | `float diag = dist(0, 0, width, height)*0.91;` -> `...*0.5;` | moderate (mean 0.0705, 0.227) | fans are truncated: wedges stop at ~half the canvas diagonal, so the outer corners/edges are mostly empty sage with the grid visible; the fan centers and wedge directions are unchanged (this substitution consumes no random(), so it is a clean single-variable test). | variants/diag_0.5/frame_00001.png |
| amp_0.25 | `float amp = random(0.2, 0.7);` -> `float amp = 0.25;` | large (mean 0.2755, 0.739) | wedges become thin needle-like spokes with large sage gaps between them; the three fans read as radial spikes instead of thick blades; grid lines visible in the gaps. Downstream RNG shifts for later fans. | variants/amp_0.25/frame_00001.png |
| b_0 | `float b = 1;` -> `float b = 0;` | subtle (mean 0.013, 0.042) | no visible change to the composition or colours; the only difference is that the 1px background gaps between grid cells disappear, so the wedge fragments merge into continuous shapes (fewer faint hairlines). | variants/b_0/frame_00001.png |

## Modularisation notes
- Generic / library candidates:
  - `subdivideRects` (lines 40-68): pure data op on a rect list; no drawing. Needs only the
    iteration count and the slice range (2-4) as parameters.
  - Polygon clipping (lines 131-245: `orderPoly`, `intersection`, `pointIn`, `linesIntersection`):
    self-contained convex-polygon intersection, reusable for any clipped-shape composition.
  - `wedgeFan` (lines 83-89): trivial polar fan generator.
- One-off art decisions: the 1px corner inset (grid-line effect), 16px margin, 0.91×diagonal
  radius, 10-90% center placement, the three fixed fan colors, and the DARKEST blend that turns
  overlaps into a dark "mix" layer.
- Clean parameter object: `{margin, iterations, sliceRange: [2,4], inset, fans: [{color, center:
  [x,y], radius, wedges, amplitude, startAngle}]}`.
