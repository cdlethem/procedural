---
sketch: 2018/Generativos/iuuio
year: 2018
renderer: P3D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 2435
animated: false
techniques: [subdivision, noise-field, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#522E90", "#17BED0", "#ED1A3B", "#009A5A", "#FFCB06"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "random(4, 80000)", tried: [200], change: large, effect: "fewer subdivision iterations -> only a handful of huge monolithic blocks, the dense city disappears"}
  - {name: heightScale, default: "random(10) multiplier in hh", tried: [50], change: large, effect: "columns ~5x taller; dense tall city of towers fills the frame, big red monoliths persist"}
  - {name: det, default: "random(0.01)", tried: [0.05], change: moderate, effect: "finer noise scale -> height field becomes patchier/more local, smooth gradient breaks up; layout otherwise similar"}
  - {name: palette, default: "5 colors incl. #17BED0 cyan", tried: ["#17BED0 -> #522E90"], change: moderate, effect: "geometry identical; all cyan columns now purple, no cyan left"}
  - {name: layerDepth, default: 3, tried: [10], change: subtle, effect: "no visible change at this scale; stacks look the same"}
  - {name: rotX, default: "PI*random(0.0, 0.4)", tried: [0.0], change: large, effect: "oblique tilt removed -> pure top-down flat mosaic of colored tiles, extrusion no longer visible"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(seedRect, iterations, minSize, splitRange) -> Rect[]", note: "repeatedly split a random rect into 4 uneven quadrants; index pick biased toward early (large) rects, so density is patchy"}
  - {name: noiseColumnHeights, signature: "noiseColumnHeights(rects, detail, offset, scale, power) -> float[]", note: "per-cell column height = min(w,h) * rand * noise(cx*detail, cy*detail)^power; very low detail gives a smooth skyline gradient"}
  - {name: boxStack, signature: "boxStack(x, y, w, h, layers, layerDepth, color) -> void", note: "stacks thin 3D boxes along z to fake a solid extruded column"}
---

## What it draws
Full-bleed oblique "isometric" view of a field of flat, extruded box columns on black, in five
saturated colours: crimson red, cyan, yellow, green and purple. The left third is dominated by two
huge monolithic red towers; the rest reads as a dense city skyline of flat-topped columns with a
smooth height gradient — lower toward the top edge, taller toward the bottom — and the finest
subdivisions (tiny columns) crowd the bottom-right corner while large unsplit slabs remain
everywhere else.

## How the code works
`setup()` (L4–13) sets a 3250² P3D canvas, calls `generate()` once, saves and exits; the harness
injects the `seed` field (L1, `randomSeed` at L38).

- Camera (L41–47): `ortho()`, translate to canvas centre, push back z=−2000,
  `rotateX(PI*random(0,0.4))` + `rotateZ(PI*random(0.2,0.4))` — a fixed oblique top-down view;
  `rotateY` is commented out (L48).
- Subdivision (L50–68): start from one rect 3× the canvas (L52). For `sub` iterations
  (`random(4, 80000)`, L54): pick a rect by index `int(size*random(1))` (L56) — biased toward early,
  i.e. large, rects — and if it is ≥4 px, split it into 4 uneven quadrants with random split
  fractions in [0.2, 0.8] (L59–66), adding the 4 children and removing the parent. Result: an
  uneven quadtree — some regions subdivided to tiny cells, others left as giant slabs.
- Heights (L71–72): `det = random(0.01)` (very low noise frequency), `des = random(1000)` offset.
- Drawing (L74–88): per rect, `hh = min(w,h)*random(10)*noise(des+x*det, des+y*det)^1.4` (L76):
  noise sampled at the cell centre with tiny detail, so heights form a smooth field across the
  canvas, scaled by cell size; `cc = hh/20` layers (L77). Each rect gets one colour, drawn as `cc`
  thin boxes (depth 3) stacked along z (L80–87), faking a solid column; `stroke(0, 80)` darkens
  edges (L73).
- Colour: `rcol()` (L106–108) picks uniformly at random from the 5-colour palette (L105).
  `getColor()` (L109–117, lerp between neighbours) is unused.
- Randomness enters at: split index/fractions (L56–62), per-rect height multiplier `random(10)`
  (L76), per-rect colour (L79), camera angles (L46–47).
- The `post.glsl` filter is commented out (L93–96): no active shader, despite
  `uses_shader: true` in result.json (display is `:2`, not xvfb, so no headless mis-render concern).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_200 | `int sub = int(random(4, 80000));` -> `int sub = 200;` | large | dense city collapses to a handful of huge monolithic blocks: giant red slab, one purple box, small red box, green corner bottom-right | variants/sub_200/frame_00001.png |
| height_50 | `float hh = min(r.w, r.h)*random(10)*...` -> `...random(50)*...` (L76) | large | columns much taller: dense tall city of vertical towers fills the frame; two big red monoliths on the left remain | variants/height_50/frame_00001.png |
| det_0.05 | `float det = random(0.01);` -> `float det = random(0.05);` | moderate | height field becomes patchier and more local; baseline's smooth low-to-high gradient is broken into varied clumps; overall layout similar | variants/det_0.05/frame_00001.png |
| palette_cyan_purple | `int colors[] = {#522E90, #17BED0, ...}` -> `... #522E90 ...` (cyan replaced by purple) | moderate | geometry identical to baseline; every cyan column is now purple, so the city is red/purple/yellow/green with no cyan | variants/palette_cyan_purple/frame_00001.png |
| boxdepth_10 | `box(r.w-2, r.h-2, 3);` -> `box(r.w-2, r.h-2, 10);` | subtle | no visible change: stacks look the same as baseline | variants/boxdepth_10/frame_00001.png |
| rotX_0 | `rotateX(PI*random(0.0, 0.4));` -> `rotateX(PI*0.0);` | large | oblique tilt removed: pure top-down flat mosaic of colored tiles (quadtree footprints), extruded height no longer visible | variants/rotX_0/frame_00001.png |

Note: first height_50 attempt failed with `bad_sub` (typo in my replacement string, `des+y*det`);
retried with the exact source line. 7 render commands total, 6 successful variants.

## Modularisation notes
Generic blocks: the quadtree subdivision loop (L50–68) with parameters iterations / min cell size /
split-fraction range / pick bias; the noise-driven height field (L71–76) separable into detail,
offset, scale, power; the box-stack column renderer (L80–87) with layers / layer depth / colour;
the random palette picker (L105–108). One-off art decisions: the specific 5-colour palette, the
camera angles and z=−2000 push-back, the 3×-canvas oversize seed rect, the ^1.4 exponent, layer
depth 3 with count hh/20, black background. A clean parameter object: `{seed, iterations,
minCellSize, splitRange: [0.2, 0.8], heightScale, noiseDetail, noiseOffset, noisePower,
layerDepth, layersPerUnit, palette[], rotXRange, rotZRange, zBack, background}`.
