---
sketch: 2018/Generativos/neonlights
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3349
animated: false
techniques: [subdivision, recursion, 3d-mesh, distortion]
primitives: [rect, shape]
palette:
  colors: ["#201754", "#4C4AC4", "#56A3F7", "#E0F1FD"]
  selection: random-from-list
composition: radial
parameters:
  - {name: sub, default: "int(random(50000)*random(1))", tried: [2000], change: large, effect: "far fewer, much thicker slivers; large flat panels and a sparse centre (coarser quadtree)"}
  - {name: fov, default: "PI/random(1, 1.8)", tried: ["PI/3.0"], change: large, effect: "narrower field of view: rays converge tighter, denser central burst"}
  - {name: boxDepth, default: "min(r.w,r.h)*5", tried: ["min(r.w,r.h)*15"], change: large, effect: "extruded boxes become long thin needles/pins; spiky burst replaces flat panels"}
  - {name: haloCount, default: "random(1, 10)", tried: [25], change: large, effect: "denser, brighter layered ring glow at the convergence (weakest of the five)"}
  - {name: palette, default: "blue 4-colour set", tried: ["warm red/yellow/cream set"], change: large, effect: "same composition recoloured warm; background turns gold"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(initial: Rect, iterations: int) -> Rect[]", note: "iteratively replace a random rect by its 4 quadrants (quadtree)"}
  - {name: haloArcs, signature: "haloArcs(cx, cy, r1, r2, count, spacing, col, alp1, alp2) -> void", note: "stacked translucent annular sectors along z (arc2)"}
  - {name: box3D, signature: "box3D(w, h, d, c1, c2) -> void", note: "manual two-tone 6-face box (box)"}
---

## What it draws
A light-blue field with a dense radial burst of long thin beams converging on a focal point near the
centre: thick dark-navy, purple and near-white slivers fan out toward the edges, while a tight cluster
of needle-thin spokes, small translucent rings and a few extruded slabs piles up at the centre, as if
looking down a 3D corridor of subdivided panels.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty (static image, frames 10/60 identical to 1).

- Background: `background(rcol())` (line 34) — one random pick from the 4-colour palette (line 224:
  `#201754 #4C4AC4 #56A3F7 #E0F1FD`); with seed 42 the background is the light blue `#56A3F7`.
- Camera: `perspective()` with random fov `PI/random(1, 1.8)` (lines 54-57), centred via
  `translate(width/2, height/2, -20)`, small random `rotateX` and full random `rotateZ` (lines 59-61).
  The perspective projection is what turns the flat rect field into converging radial beams.
- Subdivision (lines 63-78): start with one rect covering ±3× the canvas; `sub = int(random(50000)*random(1))`
  iterations, each picking a random rect and replacing it by its 4 quadrants (net +3 rects per iteration).
  Result: an irregular quadtree of leaf rects, sizes from full-canvas down to specks.
- Drawing pass (lines 82-113): each leaf rect gets `rect(r.x, r.y, r.w, r.h)` filled with `rcol()`
  (lines 85-86) plus a translucent `quad()` offset by z=0.1 (lines 88-90, two-alpha fill).
  Then `rnd = int(random(3))` (line 91):
  - `rnd == 0`: `cc = int(random(1,10))` stacked `arc2()` halos (lines 93-102) — annular sectors
    (`arc2`, lines 185-203) stacked along +z with alpha 60/0, making glowing ring clusters;
  - `rnd == 1`: a manual 3D `box()` (lines 104-111, helper lines 116-183) of cross-section
    `min(w,h)*random(0.8)` and depth `min(w,h)*5`, two-tone faces, poking toward/away from the camera;
  - `rnd == 2`: nothing extra (plain panel).
- Randomness enters through the seed (line 1), `rcol()` picks, camera angles, subdivision order,
  and the per-rect decoration dice.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_2000 | `int sub = int(random(50000)*random(1));` -> `int sub = 2000;` | large | far coarser: thick slivers and big flat panels (large purple floor trapezoid), sparse centre | variants/sub_2000/frame_00001.png |
| fov_3 | `float fov = PI/random(1, 1.8);` -> `float fov = PI/3.0;` | large | tighter, denser convergence; rays bunch toward a sharper central vanishing point | variants/fov_3/frame_00001.png |
| boxDepth_15 | `float hh = min(r.w, r.h)*5;` -> `... *15;` | large | boxes dominate as long thin needles/pins radiating out; spiky burst instead of flat panels | variants/boxDepth_15/frame_00001.png |
| halo_25 | `int cc = int(random(1, 10));` -> `int cc = 25;` | large | brighter, denser central glow; stacked ring layers read as a filled-in layered burst | variants/halo_25/frame_00001.png |
| palette_warm | `int colors[] = {#201754, #4C4AC4, #56A3F7, #E0F1FD};` -> `{#7A0C0C, #E2452B, #F5C518, #FFF4E0};` | large | same radial composition in warm reds/oranges/cream on a gold background | variants/palette_warm/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: the quadtree subdivision loop (lines 63-78) as `subdivideRects(initial, iterations)`;
  `arc2` (two-alpha annular sector) and `box` (two-tone 6-face box) as standalone 3D primitives; the
  `perspective()` + centre-translate camera setup as a helper.
- One-off art decisions: the specific 4-colour palette, the 1/3-1/3-1/3 decoration dice (`rnd`), the
  `min*0.8` / `*5` size formulas, the z=0.1 quad overlay.
- Clean parameter object: `{seed, palette: color[], cameraFov, subIterations, panelAlpha, haloCountRange, boxDepthFactor}`.
