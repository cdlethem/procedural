---
sketch: 2017/Generativos/datatata_animation
year: 2017
renderer: P3D
size: [960, 540]
libraries: []
deterministic: true
ms_first_frame: 1778
animated: true
techniques: [particles, 3d-pointcloud, polar, symmetry]
primitives: [rect]
palette:
  colors: ["#FFFFFF", "#000000", "#ECEAA4", "#6D1E0A", "#EF402C", "#004500", "#C7E969"]
  selection: fixed
composition: radial
reusable_candidates:
  - {name: sliverRing, signature: "sliverRing(radius, count, thickness, keepProb, seed) -> quads", note: "ring of N thin box-like quads (two z-offsets) around the origin, each with random angular spin and random segment dropout"}
parameters:
  - {name: cc, default: 200, tried: [40, 300], change: large, effect: "circles per ring: 40 = sparse filament burst with lots of black; 300 = near-solid white mass"}
  - {name: "r (ring radius factor)", default: "height*random(1,2)", tried: ["height*random(0.5,1)"], change: large, effect: "halved radii: burst shrinks and packs tighter around center"}
  - {name: "sliver thickness a", default: "random(1,4)", tried: ["random(8,20)"], change: large, effect: "5x thicker slabs: chunkier rectangles, big white squares more dominant"}
  - {name: "fov divisor", default: "PI/random(1.1,2)", tried: ["PI/random(2,4)"], change: large, effect: "narrower fov: much milder perspective, flatter radial star, less tunnel stretch"}
---

## What it draws
Black canvas with a white star-burst / tunnel: hundreds of thin white sliver
rectangles (seen edge-on as short strokes) radiate outward from a slightly
off-center vanishing point. A handful of much larger white slabs (the same
primitives drawn closer/larger) float in the field, mostly on the right. The
image flickers frame to frame: which sliver segments are kept is re-rolled
every frame, so the burst shimmers while its overall shape stays put.

## How the code works
`setup()` (L3-8): 960x540 P3D, smooth(8), frameRate(30). `draw()` (L10-15)
re-renders every frame; every 120 frames `generate()` (L26-28) re-rolls the
`seed` field (never reached within the 60-frame capture window).
`PI/random(1.1,2)` (L36, ~90-165 deg) with matching near/far (L37-39) gives
the extreme perspective. After centering (L42), four rings are drawn
(L44-71): each ring gets random full rotations on X/Y/Z (L45-47), a radius
`r = height*random(1,2)` (L50) and inner radius `rr = r*random(0.8,1)`
(L51). Around the ring, `cc = 200` slots (L49, L58) each place one "circle"
at angle `ang` on radius `r` (L59-64), spun by `rotateZ(ang); rotateX(PI/2)`
(L65-66) so it stands tangential to the ring.

`circle(s, a)` (L75-96) is misleadingly named: with radius `r = s*0.5` and
thickness `a` it draws up to 360 quads (L77-94), each spanning z = ±a
(L90-93) — i.e. thin box slivers. Segment dropout: `if (random(1) < max)
continue;` (L80-87) with `max = random(0.6,1)` skips 60-100% of the quads,
so each ring contributes a sparse, flickery set of white slabs. Fill is
always white (L86); the palette `colors[]` (L99) and `rcol()`/`getColor()`
(L100-108) are dead code (all call sites commented out, L33, L62, L85, L88),
so the piece is strictly black/white. No blend modes, no lighting.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_40 | `int cc = 200;` -> `int cc = 40;` | large (mean 0.293, 0.531 px) | sparse: fine filaments thinned to scattered dashes, big white slabs remain, much more black space | variants/cc_40/frame_00001.png |
| cc_300 | `int cc = 200;` -> `int cc = 300;` | large (mean 0.3845, 0.701 px) | denser: burst fills in, slabs merge into large solid white regions | variants/cc_300/frame_00001.png |
| r_0.5 | `float r = height*random(1, 2);` -> `...random(0.5, 1);` | large (mean 0.4001, 0.713 px) | rings half the size: burst compacts toward center, tighter star | variants/r_0.5/frame_00001.png |
| thick_8_20 | `circle(rr, random(1, 4));` -> `circle(rr, random(8, 20));` | large (mean 0.5696, 0.797 px) | slabs 5x thicker: chunky rectangles, dominant white squares, coarser texture | variants/thick_8_20/frame_00001.png |
| fov_2_4 | `float fov = PI/random(1.1, 2);` -> `PI/random(2, 4);` | large (mean 0.3834, 0.658 px) | narrower fov: perspective distortion strongly reduced, flatter radial star, less tunneling | variants/fov_2_4/frame_00001.png |

## Modularisation notes
Generic blocks: the sliver-ring generator (`circle()` + the L58-70 loop) is a
self-contained "N rotated, dropout-filtered 3D slivers on a ring" routine; the
wide-fov perspective setup (L36-39) is a reusable "extreme star-burst camera"
helper. One-off art decisions: four rings at radii 1-2x height, the 0.6-1
dropout range, white-on-black with dead color palette, the 120-frame seed
cycle. A clean parameter object: `{rings, perRing, radiusRange, innerRatio,
sliverRadiusRange, thicknessRange, keepProbRange, fovJitter, fill, bg}`.
