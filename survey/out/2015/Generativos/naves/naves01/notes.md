---
sketch: 2015/Generativos/naves/naves01
year: 2015
renderer: P3D
size: [800, 600]
libraries: []
deterministic: true
ms_first_frame: 1485
animated: true
techniques: [3d-mesh, polar, grid]
primitives: [line, shape]
palette:
  colors: ["#FCD224", "#D85AD7", "#FA3055", "#FFF5F7"]
  selection: random-from-list
composition: centered
parameters:
  - {name: amp, default: "random(5, 60)", tried: ["random(5, 120)"], change: none, effect: "doubles max prism radius; score says no visible change (2.6% of pixels differ)"}
  - {name: lc, default: 6, tried: [12], change: none, effect: "cross-section becomes 12-gon, end caps slightly rounder; score says no visible change (1.1% of pixels)"}
  - {name: span, default: 20, tried: [40], change: none, effect: "city extends past the grid's right edge with extra segments and domes; score says no visible change (1.5% of pixels)"}
  - {name: fillAlpha, default: 20, tried: [160], change: subtle, effect: "prism faces gain solid visible colour (magenta/white/red/yellow walls); outline-only look is lost"}
  - {name: cameraZ, default: -160, tried: [-60], change: subtle, effect: "camera closer: city and domes larger in frame, grid more compressed toward horizon"}
  - {name: background, default: 20, tried: [220], change: large, effect: "light grey scene, dark grid, neon outlines read as dark lines; white dome and white prism nearly vanish"}
reusable_candidates:
  - {name: hexPrismRow, signature: "hexPrismRow(segments, ampRange, sides) -> void", note: "row of extruded polygon prisms with fan-capped ends along the X axis"}
  - {name: domes, signature: "domes(segments, height, scale) -> void", note: "row of half-circle arcs floating above prism segments"}
  - {name: perspGrid, signature: "perspGrid(cells, spacing) -> void", note: "flat XY grid drawn under a rotateX(PI/2) tilt"}
---

## What it draws
A dark scene (near-black background) with a perspective grid plane receding toward a horizon. Resting on the plane is a low row of 3D "building" prisms of different lengths and heights, outlined in thin neon strokes (magenta/purple, red, near-white, yellow) with barely visible translucent fills; the long middle prism is white. Above the row, a series of floating half-circle domes in the same neon colours — the biggest white dome sits over the long middle segment. The whole structure slowly rotates around the vertical axis (frame 60 shows it turned ~27° relative to frame 1).

## How the code works
Single tab. `setup()` (line 9) calls `generate()` which sets a random `seed`; `draw()` (line 14) re-seeds with `randomSeed(seed)` every frame, so the layout is fixed per run while the scene animates.

- Camera: `translate(width/2, height/2, -160)` + `rotateX(-PI*0.14)` + `rotateY(frameCount*0.008)` (lines 17-19) — the slow spin is the only animation.
- Grid: `rotateX(PI/2)` then `grid(22, 20)` (lines 21-22); `grid()` (lines 87-94) draws 23×23 lines at 20 px spacing in dark grey (`stroke(40)`, line 20), producing the perspective floor.
- City loop: `while (cc < 20)` (line 43) walks x from (0−10)·20 = −200 to +200. Each iteration picks `sep` (segment length in grid units, line 49), `amp` (prism radius 5–60, line 50), and a palette colour (line 44). With `lc = 6` (line 51) it draws a hexagonal cross-section in the YZ plane: per edge it emits the side quad plus two fan triangles capping each end (lines 53-70), i.e. a prism extruded `sep*20` along X. Fills use alpha 20 (line 47) so only the `strokeWeight(1-2)` outlines (line 46) really show.
- Domes: `translate((xx+sep/2+(sep%2)*0.5)*20, -70, 0)` then `arc(0, 0, sep*20, sep*20, PI, TWO_PI)` (lines 72-75) draws a half-circle of the segment's width at height 70 above the plane, centred on each segment — the domes' sizes track segment lengths.
- Randomness: all per-segment choices (colour, weight, `sep`, `amp`) come from the seeded RNG, so different seeds give different cities; a commented-out block (lines 25-40) was an earlier variant with random arcs.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| amp_120 | `float amp = random(5, 60);` -> `random(5, 120)` | none | no visible change (prisms are taller, but only 2.6% of pixels differ) | variants/amp_120/frame_00001.png |
| lc_12 | `int lc = 6;` -> `int lc = 12;` | none | no visible change (end caps slightly rounder, 1.1% of pixels) | variants/lc_12/frame_00001.png |
| span_40 | `while (cc < 20) {` -> `while (cc < 40) {` | none | no visible change (city extends past the grid's right edge, 1.5% of pixels) | variants/span_40/frame_00001.png |
| alpha_160 | `fill(col, 20);` -> `fill(col, 160);` | subtle | subtle: prism faces filled with solid colour; the sketch's outline-only look becomes a flat-shaded 3D model | variants/alpha_160/frame_00001.png |
| camz_-60 | `translate(width/2, height/2, -160);` -> `... -60 ...` | subtle | subtle: whole scene larger/closer, domes and grid more prominent, composition still centred | variants/camz_-60/frame_00001.png |
| bg_220 | `background(20);` -> `background(220);` | large | light grey background, grid and outlines now dark; neon city reads as dark shapes, white dome/prism nearly invisible against background | variants/bg_220/frame_00001.png |

## Modularisation notes
Two generic blocks: (1) the prism row — given a list of (start, length, radius, sides) it emits side quads + fan caps; a clean signature is `prismRow(segments, sides, extrudeScale)`; (2) the dome row — `arc` per segment at a fixed height, `domes(segments, height)`. One-off art decisions: the 4-colour neon palette with alpha-20 fills (stroke-only look), the `rotateX(-PI*0.14)` camera tilt, grid density, and the spin rate. A parameter object for the sketch: `{seed, palette, sides, ampMin, ampMax, span, fillAlpha, strokeWidths, domeHeight, cameraZ, tiltX, spinRate}`.
