---
sketch: 2017/Generativos/triangularGradient
year: 2017
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1544
animated: false
techniques: [voronoi-delaunay, polar, distortion]
primitives: [shape]
palette:
  colors: ["#F8CA9C", "#F8B6D9", "#EF276B", "#A14FBE", "#1D43B8"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: cc, default: "4+int(random(100)*random(1)) (4..103)", tried: [20], change: moderate, effect: "fewer points -> fewer, sparser rings; the big ring dominates"}
  - {name: cs, default: "int(random(1, 4)) (1..3)", tried: [1], change: moderate, effect: "one palette cycle per ring: single smooth conic sweep instead of repeated colour bands"}
  - {name: mr2, default: "random(0.4) (0..0.4)", tried: [0.0], change: subtle, effect: "subtle: ring still undulates (mr1 stays active); slight change in thickness profile"}
  - {name: res, default: "360/2 (180)", tried: [45], change: none, effect: "no visible change; antialiasing and smooth per-wedge colour hide the lower wedge count"}
  - {name: dd, default: "-random(0.2, 0.4)", tried: [0], change: moderate, effect: "points span the full canvas; rings reach the edges, huge partial circles cross the frame"}
  - {name: palette, default: "{#F8CA9C, #F8B6D9, #EF276B, #A14FBE, #1D43B8}", tried: ["{#2D3142, #3A5A40, #588157, #A3B18A, #DAD7CD}"], change: large, effect: "same geometry (same seed), entirely different scheme: dark green field, sage/silver rings"}
reusable_candidates:
  - {name: circleCenter, signature: "circleCenter(p1, p2, p3) -> PVector", note: "circumcentre of a triangle (bisector intersection)"}
  - {name: conicRing, signature: "conicRing(x, y, diameter, cycles, wobble1, wobble2, resolution) -> void", note: "annulus of wedge quads; fill sweeps the palette `cycles` times around; radial width wobbles with a cosine"}
  - {name: triangulate, signature: "triangulate(PVector[]) -> Triangle[]", note: "Bowyer-Watson Delaunay with supertriangle (local port of Paul Bourke's algorithm, Triangulatorr.pde)"}
---

## What it draws
A pale peach-pink field with a cluster of overlapping annuli (ring/donut shapes): one very large ring in the top-left whose hollow shows the background, several medium rings overlapping it, and a small ring near the middle. Each ring's colour sweeps conically around its circumference, cycling through a peach / pink / magenta / purple / blue palette one to three times, giving a prismatic gradient look; ring thickness undulates gently (thicker on one arc, thinner on the opposite arc).

## How the code works
- `setup()` (L3-8): P3D 960x960, `smooth(8)`, `pixelDensity(2)` (unavailable on headless display, warning in stderr), calls `generate()` once. `draw()` (L10-16) only draws a 2px ellipse off-screen at (-10,-10), so the image is static; frames 1/10/60 are identical.
- `render()` (L34-48): background is a single palette-lerped colour (`getColor(random(colors.length*2))`, L35). Picks `cc = 4+int(random(100)*random(1))` (4..103) random points (L42-45) confined to a central band, because `dd = -random(0.2, 0.4)` (L41) shrinks the random range to ~[0.2-0.4, 0.6-0.8] of the canvas width/height - which is why rings cluster in the middle rather than full-bleed.
- Triangulation (L47-48): local Bowyer-Watson port in `Triangulatorr.pde` (sort by x, supertriangle, incremental circumcircle insertion, strip supertriangle facets).
- Per triangle (L52-63): circumcentre via `circleCenter()` (L121-135) and diameter `ss = 2*dist(center, p1)` (L61), then `circle(c.x, c.y, ss)` (L63) - so every ring is the circumcircle of a mesh triangle; one large triangle (flat/obtuse) produces the huge top-left ring.
- `circle()` (L173-200) is the "triangular gradient" look: 180 wedge quads (`res = 360/2`, L175). Each quad spans two consecutive angles with radius modulated by `map(cos(angle), -1, 1, mr1, mr2)*r`, `mr1` in [0,0.4), `mr2` in [0,0.4) (L182-183, 187-188) - the radial wobble. Fill is `getColor` of an index advancing by `colors.length*cs` per revolution, `cs = 1..3` (L181, 190-193) - the palette is swept around the ring `cs` times, producing the conic gradient. Overlapping closed quads give the smooth banded sweep.
- Palette (L204-214): 5 fixed colours; `getColor()` lerps between adjacent entries of the circular list, so every colour is a mix of two neighbours.
- Randomness enters at: point cloud (L42-45), background colour (L35), per-ring cycle count `cs` (L181), wobble `mr1`/`mr2` (L182-183), start angle (L178).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_20 | `int cc = 4+int(random(100)*random(1));` -> `int cc = 20;` | moderate | fewer, sparser rings: one thick big ring top-left plus a small cluster of 2-3 medium rings; less dense than baseline | variants/cc_20/frame_00001.png |
| cs_1 | `int cs = int(random(1, 4));` -> `int cs = 1;` | moderate | each ring sweeps the palette exactly once: single smooth conic rainbow per ring instead of repeated colour bands | variants/cs_1/frame_00001.png |
| mr2_0.0 | `float mr2 = random(0.4);` -> `float mr2 = 0.0;` | subtle | subtle: rings still undulate in thickness (mr1 still active); only a slight change in ring profile | variants/mr2_0.0/frame_00001.png |
| res_45 | `int res = 360/2;` -> `int res = 360/8;` | none | no visible change: 45 wedges look identical, smooth per-wedge colours + antialiasing hide the discretisation | variants/res_45/frame_00001.png |
| dd_0 | `float dd = -random(0.2, 0.4);` -> `float dd = 0;` | moderate | points span the whole canvas: rings reach the edges, huge partial circles cross the corners, composition less bunched | variants/dd_0/frame_00001.png |
| palette_earth | `int colors[] = {#F8CA9C, #F8B6D9, #EF276B, #A14FBE, #1D43B8};` -> `{#2D3142, #3A5A40, #588157, #A3B18A, #DAD7CD};` | large | identical geometry (same seed), entirely different colour: dark slate-green field with sage/olive/silver-grey rings | variants/palette_earth/frame_00001.png |

## Modularisation notes
- Generic/reusable: `Triangulator` (self-contained Delaunay); `circleCenter()` (pure geometry); the conic annulus (`circle()`) is a standalone primitive parameterised by (x, y, diameter, cycles, wobble1, wobble2, resolution, palette) - a strong candidate for a `conicRing()` library function; `getColor()` as a lerp-between-circular-list palette.
- One-off art decisions: the 5-colour palette; the central-band point distribution (`dd` margin); using triangle circumcircles as ring positions/sizes (couples the Delaunay mesh to the rings); per-ring random cycle count `cs`; random start angle per ring.
- Clean parameter object: { pointCount, margin (dd), ringCycles (cs), wobble (mr1, mr2), resolution (res), palette, backgroundFromPalette }.
