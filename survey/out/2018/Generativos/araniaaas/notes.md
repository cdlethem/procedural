---
sketch: 2018/Generativos/araniaaas
year: 2018
renderer: P2D
size: [960, 540]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1478
animated: true
techniques: [voronoi-delaunay, physics]
primitives: [shape]
palette:
  colors: ["#FF3E6D", "#2C50FE", "#F9FF60", "#D036E9", "#23778A", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(80, 500)*random(1))", tried: ["int(random(80, 160)*random(1))"], change: moderate, effect: "fewer, larger triangles; bolder black web"}
  - {name: amp1, default: "random(1)*random(0.06, 0.1)", tried: ["random(1)*random(0.3, 0.4)"], change: large, effect: "much larger white centre holes, shorter thinner internal web lines"}
  - {name: amp2, default: "amp1*random(0.25)", tried: ["amp1*random(0.8)"], change: subtle, effect: "edge-midpoint insets shift slightly; otherwise nearly identical"}
  - {name: palette, default: "#FF3E6D,#2C50FE,#F9FF60,#D036E9,#23778A", tried: ["#1B3BFF,#4A7BFF,#7FA8FF,#B3C9FF,#23778A"], change: moderate, effect: "same structure in monochrome blues/teal plus white"}
  - {name: gradientColor, default: 255, tried: [120], change: large, effect: "per-triangle gradient fades to grey instead of white; darker, murkier, pastel look lost"}
  - {name: bb, default: 300, tried: [50], change: large, effect: "points no longer spill past the canvas; white border around the composition instead of full-bleed"}
reusable_candidates:
  - {name: delaunayWeb, signature: "delaunayWeb(points, amp1, amp2, palette) -> void", note: "Triangulate.triangulate + per-triangle spider-web overlay (corner inset amp1, midpoint inset amp2)"}
  - {name: springDrift, signature: "springDrift(initPos, spring=0.025, decay=0.64-0.72) -> PVector", note: "point eases toward its spawn position with damped velocity; organic slow drift"}
  - {name: vertexGradientTri, signature: "vertexGradientTri(p1, p2, p3, color) -> void", note: "beginShape with fill(color) at p1, fill(white) at p2/p3 gives a soft gradient toward two corners"}
---

## What it draws
A full-bleed Delaunay triangulation of randomly scattered points (seed 42): every triangle is
shaded with a soft gradient from one flat pastel colour (pink-red, blue, yellow, magenta, teal)
at one corner to white at the other two, and is outlined in thick black. Inside each triangle a
black "spider web" connects the corner insets to the edge midpoints, leaving a small white
hexagonal hole at the triangle's centre — the whole image reads as stained glass with a web
pattern ("araniaaas" = spiders). Between frames 1 and 60 the web shifts slightly as the points
drift.

## How the code works
- `setup()` (araniaaas.pde:9-14): `size(960,540,P2D)`, `smooth(8)`, `pixelDensity(2)` (warns
  unavailable headless), then `generate()`.
- `generate()` (araniaaas.pde:133-149): reseeds; spawns `cc = max(3, int(random(80,500)*random(1)))`
  (line 141) points uniformly in the canvas extended by `bb = 300` px on all sides (line 140,
  line 143), then `tris = Triangulate.triangulate(vertex)` (line 148) — the triangulate library
  computes a Delaunay triangulation.
- `draw()` (araniaaas.pde:16-110): `background(250)`, `randomSeed(seed)` every frame so all
  per-frame randomness is deterministic. Each `Point.update()` (Point.pde:20-38): `tgt` lerps
  4% back to the spawn position (line 22), points within 360 px of the mouse are pulled toward
  it (lines 24-29, inert in headless runs), then a damped spring: `acc = (tgt-pos)*0.025`
  (lines 32-33), `vel += acc`, `pos += vel`, `vel *= decay` with `decay = random(0.8,0.9)*0.8`
  (Point.pde:17). This is the slow drift visible between frames.
- Per triangle (araniaaas.pde:31-108): `amp1 = random(1)*random(0.06, 0.1)` (line 29) and
  `amp2 = amp1*random(0.25)` (line 30) are redrawn each frame. The triangle itself is drawn
  once with per-vertex fills: `fill(rcol())` at p1 then `fill(255)` at p2, p3 (lines 45-51) —
  the colour gradient from one palette corner to white. `rcol()` (line 163) picks a random
  colour from the 5-colour palette (line 161). Then a black (`fill(0)`) self-intersecting
  closed path (lines 55-71) traces the triangle perimeter plus a chain through the edge
  midpoints `c1..c3` (lines 40-42) and corner insets `i1..i3` = lerp(corner, centroid, amp1)
  (lines 37-39); nonzero winding fills it as thick black border + internal web lines with a
  small unfilled white hole at the centre. Two larger commented-out blocks (lines 73-107)
  would add point stippling or recursive sub-triangulation but are not active.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_160 | `int cc = max(3, int(random(80, 500)*random(1)));` -> `int cc = max(3, int(random(80, 160)*random(1)));` | moderate | fewer, larger triangles; same stained-glass web, bolder black lines | variants/cc_160/frame_00001.png |
| amp1_0.4 | `float amp1 = random(1)*random(0.06, 0.1);` -> `float amp1 = random(1)*random(0.3, 0.4);` | large | white centre holes much bigger; internal web lines shorter and thinner; triangle outlines unchanged | variants/amp1_0.4/frame_00001.png |
| amp2_0.8 | `float amp2 = amp1*random(0.25);//0.01;` -> `float amp2 = amp1*random(0.8);//0.01;` | subtle | nearly identical to baseline; only a slight shift of the edge-midpoint web insets | variants/amp2_0.8/frame_00001.png |
| palette_blues | `{#FF3E6D, #2C50FE, #F9FF60, #D036E9, #23778A}` -> `{#1B3BFF, #4A7BFF, #7FA8FF, #B3C9FF, #23778A}` | moderate | identical structure, monochrome blue/teal + white; no pink/yellow/magenta | variants/palette_blues/frame_00001.png |
| gradient_gray | `fill(255);` -> `fill(120);` | large | gradients fade to grey instead of white; whole image darker and murkier, pastel stained-glass look lost | variants/gradient_gray/frame_00001.png |
| bb_50 | `float bb = 300;` -> `float bb = 50;` | large | triangulation stops short of the canvas edges; white border around the composition, no longer full-bleed | variants/bb_50/frame_00001.png |

## Modularisation notes
- Generic / library-worthy: `Triangulate.triangulate` call plus the per-triangle web renderer
  (params: `amp1`, `amp2`, palette, border colour) — this is the core visual; the spring-drift
  point updater (Point.pde) is a reusable "organic drift" component; per-vertex gradient
  triangle is a small helper.
- One-off art decisions: the exact 5-colour pastel palette, the black-on-pastel contrast, the
  300 px point margin, the 80-500 point count range, the specific web topology (midpoint +
  inset chain).
- Clean parameter object: `{count, margin, spring=0.025, decay=0.64-0.72, returnLerp=0.04,
  amp1=[0,0.1], amp2Frac=0.25, palette, gradientColor=white, webColor=black}`.
