---
sketch: 2018/Generativos/peligths
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1594
animated: false
techniques: [noise-field, distortion]
primitives: [shape]
palette:
  colors: ["#3102F7", "#F6C9CC", "#F47AD4", "#CF350A", "#F5A71C"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: circleCount, default: 100, tried: [200], change: large, effect: "denser field of more, smaller blobs; canvas fully covered, busier overlaps"}
  - {name: sizeBias, default: "width*random*random", tried: ["width*random"], change: large, effect: "uniform size distribution: a few very large blobs dominate, small blobs nearly vanish"}
  - {name: innerRatio, default: 0.4, tried: [0.7], change: moderate, effect: "inner blobs nearly as big as outer, reading as large petals/leaves over the fan"}
  - {name: noiseDetail, default: 2, tried: [5], change: moderate, effect: "finer, wavier rim undulations on every blob"}
  - {name: warpAmp, default: 80, tried: [200], change: moderate, effect: "stronger noise warp: more irregular, stretched, teardrop/ribbon-like blobs"}
  - {name: fanAlpha, default: 240, tried: [120], change: moderate, effect: "more translucent fills: overlaps blend and wash out, overall softer look"}
reusable_candidates:
  - {name: desform, signature: "desform(x, y, angScale, magAmp) -> PVector", note: "2-D noise displacement field: per-point angle from one noise sample, magnitude from another"}
  - {name: noiseCircle, signature: "noiseCircle(x, y, r, c1, c2, alpha) -> void", note: "circle as two-tone triangle fan whose rim and centre are warped through a noise field"}
---

## What it draws
A full-bleed collage of ~100 large overlapping organic blobs in saturated blue, pale pink, orange and red-orange, on a warm pink/peach ground. Each blob has a wavy, undulating outline and visible thin radial spokes converging on a centre point (a faint white hairline and two-tone triangle fill); many blobs contain a smaller inner blob that reads as a leaf or teardrop. Overlaps are translucent, so colours mix where they cross.

## How the code works

- `generate()` (lines 23–51): background = one random palette colour; `randomSeed`/`noiseSeed(seed)`; `noiseDetail(2)` (line 37); `stroke(255, 2)` — the faint white hairlines (line 39). Loop `i < 100` (line 40): random position, size `s = width*random(1)*random(1)` (line 43, biased toward small sizes); draws an outer `circle(x, y, s)` and a smaller inner `circle(x, y, s*0.4)` (lines 45, 48). The `fill()` calls immediately before each `circle()` are overwritten by the per-triangle fills inside `circle()`.
- `circle()` (lines 84–108): builds the circle as a triangle fan of `cc = max(8, r*PI)` segments. Every rim vertex is displaced through `desform()`, and the fan centre itself is displaced (`c = desform(x, y)`, line 94). Each triangle is filled with one of two randomly chosen palette colours `c1`/`c2` at alpha 240, producing the two-tone radial-spoke look.
- `desform()` (lines 78–82): the noise field — angle = `noise(...) * TAU*3`, magnitude = `noise(...) * 80`; each point is pushed by `(cos, sin) * des`. This is what turns circles into wavy blobs.
- Palette (line 121): five colours; `rcol()` picks uniformly at random (line 124). `getColor()` (lerp-based) and `arc2()` (lines 53–71) are defined but never called from `generate()`.
- The `triangulate` import is present but unused by the drawing code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_200 | `for (int i = 0; i < 100; i++)` -> `for (int i = 0; i < 200; i++)` | large | denser, busier field: more, smaller blobs fully covering the canvas, more leaf/teardrop shapes, same style | variants/count_200/frame_00001.png |
| size_wider | `float s = width*random(1)*random(1);` -> `float s = width*random(1);` | large | a few very large blobs dominate the frame; small blobs nearly vanish; big radial fans very visible | variants/size_wider/frame_00001.png |
| inner_0.7 | `circle(x, y, s*0.4);` -> `circle(x, y, s*0.7);` | moderate | inner blobs much larger, reading as big petals/leaves over the outer fan; composition otherwise similar | variants/inner_0.7/frame_00001.png |
| detail_5 | `noiseDetail(2);` -> `noiseDetail(5);` | moderate | blob rims are wavier with finer undulations; overall layout close to baseline | variants/detail_5/frame_00001.png |
| warp_200 | `desDes+y*detDes)*80;` -> `desDes+y*detDes)*200;` | moderate | stronger warp: more irregular, stretched, ribbon/teardrop-shaped blobs, spikier rims | variants/warp_200/frame_00001.png |
| alpha_120 | `float alp1 = 240;` -> `float alp1 = 120;` | moderate | noticeably more translucent: overlaps blend and wash out, softer, more see-through look | variants/alpha_120/frame_00001.png |

## Modularisation notes
- `desform()` is generic: a 2-D noise displacement field (per-point angle + magnitude from two noise samples). Clean signature `desform(x, y, angScale, magAmp, seedOffset) -> PVector`; the `*TAU*3` and `*80` constants should be parameters.
- `circle()` is a self-contained "noise-warp triangle fan" primitive: `noiseCircle(x, y, r, c1, c2, alpha, segments)`. The two-tone alternating fill is an art decision; making `c2` optional (single colour) covers the common case.
- The `generate()` loop is a standard scatter-and-overlap composition: `scatter(count, sizeDist, painter)` — one-off decisions are the `random*random` size bias, the 0.4 inner-blob ratio, and the 5-colour palette.
- A parameter object for this sketch: `{count, sizeMin/sizeBias, innerRatio, noiseDetail, warpAmp, warpScale, alpha, palette, seed}`.
- `arc2()`, `getColor()`, and `saveImage()` are dead/auxiliary code for a library extraction.
