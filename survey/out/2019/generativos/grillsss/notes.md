---
sketch: 2019/generativos/grillsss
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1707
animated: false
techniques: [grid, dots-stippling, noise-field]
primitives: [ellipse, line, rect]
palette:
  colors: ["#97B7D8", "#121872", "#FFD454", "#F7E6EB", "#E52B06"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(40,120)*0.5", tried: ["random(120,200)*0.5"], change: large, effect: "grid ~3x finer/denser; more colour circles, line strands; big blobs and corner rects kept at similar anchors"}
  - {name: dotScale, default: 0.12, tried: [0.3], change: moderate, effect: "black grid dots clearly bigger; the 8% oversize dots become huge black circles spanning cells; layout otherwise identical"}
  - {name: dotSkip, default: 0.5, tried: [0.2], change: large, effect: "much denser scatter of colour circles (~80% of grid cells instead of ~50%); rest of layout unchanged"}
  - {name: blobs, default: 90, tried: [200], change: moderate, effect: "more cluster blobs -> more big colour circles and white-centred targets spread wider; squiggle endpoints spread so waves cross whole canvas incl. corners"}
  - {name: squiggles, default: 20, tried: [60], change: subtle, effect: "3x as many wavy lines, now reaching the corners; thin strokes keep pixel change modest"}
  - {name: noiseDet, default: "random(0.01)", tried: ["random(0.03)"], change: subtle, effect: "squiggles tighter and more jagged (denser wave pattern); overall layout unchanged"}
reusable_candidates:
  - {name: lineNoise, signature: "lineNoise(x1, y1, x2, y2, det) -> void", note: "noise-warped connector: 1-px simplex-noise random walk, then rotated/scaled to span the endpoints; drawn as LINES so it reads as a dashed squiggle"}
  - {name: gridDots, signature: "gridDots(cells, dotScale, skipP) -> void", note: "evenly spaced grid of randomly thinned dots with occasional oversize dots"}
---

## What it draws
A pale pink full-bleed field covered by a fine, regular grid of small black dots. Over it: scattered
flat circles in red, dark blue, light blue and yellow at many sizes (a few large, mostly small); a
sparse web of thin straight lines in the same palette colours, most of them axis-aligned and
joining dot-grid intersections; a few solid colour rectangles (dark blue, yellow, red); some faint
translucent grey circles and thin grey circle outlines; and a handful of long, hand-drawn-looking
wavy lines in red, light blue, yellow and white that loop around the centre. The white squiggles
look dashed because they are drawn as 1-px line segments.

## How the code works
`settings()` (grillsss.pde#14-19): 960x960 P2D, smooth(8), pixelDensity(2). `setup()` calls
`generate()` once; frames 10/60 are identical to frame 1, so the sketch is static.
- `generate()` (L52) reseeds with `randomSeed`/`noiseSeed(seed)` (L54-55), then `background(rcol())`
  (L57) — a random palette colour (seed 42 gives pale pink #F7E6EB).
- Grid: `cc = int(random(40,120)*0.5)` (L59) cell count, `dd = width/(cc+2)` (L60) cell size.
- Pass 1 (L64-73): cc×cc grid; each cell skipped with 50% (L69); colour = `rcol()`, noStroke;
  circle size `dd*0.12*2` with an 8% chance of 4× (L70) — the scattered flat colour circles.
- Pass 2 (L76-84): `cc` straight `line()`s between random grid points, each forced vertical or
  horizontal 40% of the time (L81-82) — the axis-aligned line web.
- Pass 3 (L87-133): second grid pass, black dot ellipses `dd*0.12` (L91), 8% chance 4× (L97) —
  the large black dots; 1.6% "target" of big black dot + white centre dot (L100-105); 1% faint
  grey circle `fill(0,10)` at 20× (L107-110); 8% soft black halo `fill(0,20)` at 2× (L112-115);
  1% solid colour rect `dd*int(random(2,10))` (L117-124); 1% thin grey outline
  `stroke(0,80)` (L126-131).
- Blob clusters (L134-160): 90 clusters placed at random positions snapped to a 10-px grid
  (L145-146), size `ss = int(random(10, random(20,50)))*10` (L142); 20% get a large opaque colour
  circle (L151), then a white centre dot (L152-153) and smaller colour dots (L154-157) — the
  target-like clusters.
- Squiggles (L162-168): 20 `lineNoise()` calls between random cluster points.
- `lineNoise()` (L171-207): walks 1-px steps with angle from `SimplexNoise.noise` (L183, detail
  `det = random(0.01)`), then rotates/scales all points to span p1→p2 (L196-197); drawn with
  `beginShape(LINES)` (L201) so the points become 1-px segments — the dashed wavy look; stroke
  weight `random(1, random(1,6))` (L200).
- Palette (L217): 5 fixed colours; `rcol()` (L218-220) picks one at random. `triangulate` is
  imported but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_120-200 | `int cc = int(random(40, 120)*0.5);` -> `int cc = int(random(120, 200)*0.5);` | large (mean 0.2727, 63% of px) | dot grid ~3x finer and denser; more colour circles and line-web strands; big blobs and corner rects at similar anchors | variants/cc_120-200/frame_00001.png |
| dotScale_0.3 | `float ss = dd*0.12;` -> `float ss = dd*0.3;` | moderate (mean 0.0825, 11% of px) | black grid dots clearly bigger; the 8% oversize dots are now huge black circles spanning cell boundaries; layout otherwise identical | variants/dotScale_0.3/frame_00001.png |
| dotSkip_0.2 | `if (random(1) < 0.5) continue;` -> `if (random(1) < 0.2) continue;` | large (mean 0.2073, 44% of px) | colour-circle scatter much denser (~80% of grid cells instead of ~50%); rest of layout unchanged | variants/dotSkip_0.2/frame_00001.png |
| blobs_200 | `for (int i = 0; i < 90; i++) {` -> `for (int i = 0; i < 200; i++) {` | moderate (mean 0.0825, 20% of px) | more cluster blobs: more big colour circles and white-centred targets spread wider; squiggles (endpoints = cluster points) now cross the whole canvas incl. corners | variants/blobs_200/frame_00001.png |
| squiggles_60 | `for (int i = 0; i < 20; i++) {` -> `for (int i = 0; i < 60; i++) {` | subtle (mean 0.0202, 6% of px) | 3x as many wavy lines, now also in the corners; strokes are thin so the visual change is modest | variants/squiggles_60/frame_00001.png |
| noiseDet_0.03 | `float det = random(0.01);` -> `float det = random(0.03);` | subtle (mean 0.0325, 9% of px) | squiggles tighter and more jagged with a denser wave pattern; overall layout unchanged | variants/noiseDet_0.03/frame_00001.png |

## Modularisation notes
- `lineNoise()` (L171-207) is fully generic: a noise-warped connector between two points;
  parameterise `det` (noise detail), step count, weight and colour. Strong library candidate.
- The three grid passes (L64-73, L76-84, L87-133) share one `cc`×`cc` lattice and `dd` spacing;
  a `gridDots(cells, dotScale, skipP, oversizeP)` plus `gridWeb(cells, lineCount, axisAlignedP)`
  would cover them. The per-cell "accident" table (target / halo / rect / outline with their
  probabilities) is the one-off art decision and should be a data-driven list of
  `{prob, drawFn}` entries.
- The blob-cluster loop (L141-160) is generic: `scatterClusters(n, sizeRange, snap, layers)` where
  `layers` are the stacked concentric ellipses (big colour / white centre / small colours).
- A clean parameter object: `{seed, cells, dotScale, dotSkip, dotOversizeP, lineCount,
  axisAlignedP, accidentTable, clusterCount, clusterSizeRange, clusterSnap, squiggleCount,
  noiseDet, weightRange, palette, background}`.
