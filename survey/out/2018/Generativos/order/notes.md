---
sketch: 2018/Generativos/order
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1509
animated: false
techniques: [subdivision, grid, 3d-mesh]
primitives: [rect]
palette:
  colors: ["#FFFCF7", "#FDDA02", "#EE78AC", "#3155A3", "#028B88"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: iters, default: 100, tried: [40], change: large, effect: "fewer subdivisions: bigger zones, thicker bars, much coarser mosaic"}
  - {name: hRange, default: "random(0.1, 2.5)", tried: ["random(0.1, 5.0)"], change: large, effect: "taller bars, wireframe caps reach much higher, more tower-like"}
  - {name: dRange, default: "random(0.1, 0.8)", tried: ["random(0.1, 0.2)"], change: moderate, effect: "thinner bars, more visible gaps between stripes"}
  - {name: sub, default: "random(3, 13)", tried: ["random(3, 7)"], change: large, effect: "fewer bars per zone: thick slabs instead of dense stripes, more bare ground"}
  - {name: barProbability, default: 1.0, tried: [0.5], change: large, effect: "half the zones left as bare ground, sparser composition"}
reusable_candidates:
  - {name: quadtreeSubdivide, signature: "quadtreeSubdivide(w, h, iters, minSize) -> List<Rect3>", note: "split a random rect into 4 equal quadrants, repeat, drop rects below minSize"}
  - {name: barField, signature: "barField(rect, subRange, hRange, dRange, palette) -> void", note: "rows of 3D bars with a wireframe cap box, horizontal or vertical per cell"}
---

## What it draws
A full-bleed isometric-ish 3D scene, viewed from ~45° and rotated to an arbitrary angle: the plane is
tessellated into a mosaic of rectangular zones (quadtree), and most zones are filled with rows of thin
extruded bars rising out of a flat ground, like a city of equalizer blocks. Each bar is a solid colored
box with a thin wireframe outline slightly taller than the fill, so every bar has a "cap" edge. Palette:
cream white, yellow, pink, blue, teal (teal doubles as the ground/background here). Bars in large zones are
few and thick; in small zones they are many and hairline.

## How the code works
- `setup()` (order.pde:3-8): 960x960 P3D, smooth(8), calls `generate()` once; `draw()` is empty (static).
- `generate()` (order.pde:22-101):
  - background = random palette color (line 23); `randomSeed(seed)` (line 25).
  - dim ambient + 2 dark directional lights (lines 27-29) — shading is nearly flat, color comes from fills.
  - camera: `ortho()`, `translate(width/2, height/2, -1000)`, fixed tilt `rotateX(HALF_PI-atan(1/sqrt(2)))`
    (~45°) plus a random spin `rotateZ(-HALF_PI*random(0.5))` (lines 31-34).
  - **subdivision** (lines 37-49): start from one rect larger than the canvas; 100 iterations pick a random
    rect, replace it with 4 equal quadrants (side halved), skip rects with side < 30 (line 43). Result: a
    quadtree mosaic of ~200+ rectangles.
  - **bars** (lines 51-100): for each rect, `int rnd = int(random(1))` is always 0 (line 57), so every rect
    draws bars. Per rect: `sub = int(random(3, 13))` bars (line 59), bar height `hh = cell*random(0.1, 2.5)`
    (line 61), bar thickness `dd = cell*random(0.1, 0.8)` (line 62), random horizontal/vertical orientation
    (line 63). Each bar: a filled box of height `hhh = hh*random(1)` (lines 73/87) plus a stroke-only box of
    the full height `hh` on top (lines 79/93) — the wireframe cap.
  - color: one random palette color per bar via `rcol()` (lines 129-131).

- `arc2()` (lines 103-121) is unused dead code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| iter_40 | `for (int i = 0; i < 100; i++) {` -> `i < 40` | large | coarser quadtree: large flat zones (white/pink/yellow slabs) dominate, far corner still dense but hairline zones mostly gone | variants/iter_40/frame_00001.png |
| height_5.0 | `float hh = sss*random(0.1, 2.5);` -> `random(0.1, 5.0);` | large | bars noticeably taller; wireframe caps stand well above the fills, city reads more vertical/tower-like | variants/height_5.0/frame_00001.png |
| thickness_0.2 | `float dd = sss*random(0.1, 0.8);` -> `random(0.1, 0.2);` | moderate | bars consistently thin; gaps between stripes wider, finer striped texture | variants/thickness_0.2/frame_00001.png |
| sub_3_7 | `int sub = int(random(3, 13));` -> `int(random(3, 7));` | large | few bars per zone: thick slabs, more bare ground between bar groups | variants/sub_3_7/frame_00001.png |
| half_bars | `int rnd = int(random(1));` -> `int(random(2));` | large | roughly half the zones left empty (flat ground color), sparser, more open composition | variants/half_bars/frame_00001.png |

## Modularisation notes
- **Generic**: the quadtree subdivision loop (lines 37-49) is a reusable `quadtreeSubdivide(iters, minSize)`
  returning a list of rects; the per-rect bar field (lines 54-99) is reusable as `barField` with a
  parameter object `{subRange, hRange, dRange, wireframeCap: true}`.
- **One-off art decisions**: the 5-color palette and random-per-bar color choice; the ~45° fixed tilt with a
  random z-spin camera; the dual box (fill + stroke cap) rendering trick.
- A clean parameter object: `{iters, minSize, subRange, hRange, dRange, orientation: random|fixed, palette, background, cameraTilt, cameraSpin}`.
