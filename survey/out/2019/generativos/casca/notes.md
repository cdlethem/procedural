---
sketch: 2019/generativos/casca
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1775
animated: false
techniques: [subdivision, grid, flow-field, noise-field, dots-stippling]
primitives: [rect, ellipse, line, shape]
palette:
  colors: ["#CE44EA", "#EFACDB", "#EFF246", "#D60686", "#214CA2"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(190))", tried: ["int(random(80))"], change: large, effect: "fewer quadtree splits: larger, chunkier mosaic cells"}
  - {name: cc, default: 66, tried: [33], change: large, effect: "coarser grid: larger mosaic leaves, larger grid cells and grid dots"}
  - {name: det, default: "random(0.0006, 0.001)", tried: ["random(0.002, 0.003)"], change: moderate, effect: "finer noise detail: tighter, smaller-scale curls in the flow lines"}
  - {name: flowLinesPerShell, default: "(34000/5)/(1+k*0.8)", tried: ["(68000/5)/(1+k*0.8)"], change: moderate, effect: "denser flow field, stronger outer ring of endpoint dots"}
  - {name: lar, default: 0.4, tried: [0.8], change: moderate, effect: "longer, more stretched, streaky flow lines"}
reusable_candidates:
  - {name: quadtreeSplits, signature: "quadtreeSplits(rootRect, numSplits, rng) -> Rect[]", note: "repeatedly pick a random leaf rect and replace it with its 4 quadrants"}
  - {name: flowFieldStrokes, signature: "flowFieldStrokes(count, noiseOffset, noiseDetail, maxLen) -> void", note: "unit-step polylines whose heading is 2-D Perlin noise * TAU * 2"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], v) -> color", note: "lerp between colors[int(v)] and colors[int(v)+1] by fractional part; noise-driven"}
---

## What it draws
A full-bleed 960x960 composition in vivid magenta, yellow, purple and blue with pink/white accents. The background is a mosaic of rectangles in a quadtree subdivision: each leaf cell holds a flat colour, an inscribed circle, a central dot, a small corner square and a tiny square, all outlined with a soft dark stroke. A faint fine grid of near-white cells with scattered small dots covers the whole surface. On top, many thin multicoloured strokes flow in large sweeping swirls across the middle of the image, most ending in soft translucent dots with a brighter core; short tick-line marks ring some of the mosaic cells.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty (lines 21-32), so the piece is static. `randomSeed`/`noiseSeed` are set from the `seed` field (lines 54-55).

1. Background: one random palette colour (line 57).
2. Mosaic: `cc = 66` (line 61), cell `ss = width/cc` (line 62). Start from one inset rectangle (line 65); `sub = int(random(190))` iterations each replace a randomly chosen leaf with its 4 quadrants (lines 66-77) — a quadtree subdivision of random depth.
3. Leaf render (lines 79-93): `stroke(0,180)`; per leaf: `rect` with `rcol()` fill, inscribed `ellipse(r.w, r.h)`, a central dot of random size `min(w,h)*random(1)`, a corner square `w*0.2`, and a tiny square `w*0.04`.
4. Grid pass (lines 96-112): over the (cc-1)^2 cells: cell rect with near-invisible white fill `fill(255, random(4))` and `stroke(0,10)`; with probability 0.4 two concentric dots at the cell corner (size `ss*random(1)*random(0.4,1)`); with probability 0.1 a stronger white wash.
5. Flow field (lines 123-180): translated to centre; 5 shells `k = 0..4`, counts `(34000/5)/(1+k*0.8)` (line 133), starting points on an ellipse of per-shell radius `dd = pow(map(k,0,5,0.1,0.75),0.6)*1.4` (lines 137-141). Each line steps 1 px for `lar = random(20, random(100,400))*random(1)*0.4` steps along heading `noise(des + x*det, des + y*det)*TAU*2` (lines 145-155); stroke colour from `getColor(noise(...)*8)` — noise-driven lerp across the 5-colour palette — weight `random(0.8, 1.7)`. At each line's end: soft dot `fill(c1, 60)` of size `noise(...)*random(160)*random(1)` plus a solid core `s*0.4` (lines 156-162).
6. Translate back (line 182); per mosaic leaf: `c = PI*min(w,h)*0.1` short radial tick lines near the cell rim (lines 186-208), colour `getColor(dc+random(ac))` with random alpha, plus two small central dots (lines 209-213).

All randomness comes from the seeded PRNG; `rcol()` picks uniformly from the palette (line 247), `getColor(v)` lerps between adjacent palette entries (lines 253-258). The `triangulate` import (line 1) is unused in the code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_80 | `int sub = int(random(190));` -> `int sub = int(random(80));` | large | mosaic cells much larger and chunkier (fewer subdivisions); flow field and grid unaffected | variants/sub_80/frame_00001.png |
| cc_33 | `int cc = 66;` -> `int cc = 33;` | large | coarser overall: larger mosaic leaves, coarser grid with bigger faint cells and bigger grid dots | variants/cc_33/frame_00001.png |
| det_0.003 | `float det = random(0.0006, 0.001);` -> `float det = random(0.002, 0.003);` | moderate | flow lines curl at a smaller scale: tighter, choppier swirls instead of broad smooth arcs | variants/det_0.003/frame_00001.png |
| lines_68000 | `(34000/5)/(1+k*0.8)` -> `(68000/5)/(1+k*0.8)` | moderate | denser flow field; stronger ring of yellow endpoint dots along the top and bottom edges | variants/lines_68000/frame_00001.png |
| lar_0.8 | `random(20, random(100, 400))*random(1)*0.4;` -> `...0.8;` | moderate | flow lines are longer and more stretched, streaky hair-like trails | variants/lar_0.8/frame_00001.png |

## Modularisation notes
Generic, reusable: the quadtree split loop (lines 66-77) is a standalone subdivision generator parameterised by split count; the flow-field stroke walker (lines 132-155) is a standard noise-field line tracer parameterised by count, noise detail, offset and step length; `getColor` (lines 253-258) is a palette-lerp utility. One-off art decisions: the per-leaf decoration recipe (inscribed circle + corner squares, lines 82-92), the faint white grid pass with its probability thresholds (lines 96-112), the 5-shell radial distribution of line start points (lines 133-141), the endpoint dot+core motif (lines 156-162), and the rim ticks (lines 186-214). A clean parameter object: `{seed, leafSplits (sub), gridCount (cc), shells, linesPerShell, lineLength (lar factor), noiseDetail (det), noiseScale (detCol), strokeWeight range, palette}`.
