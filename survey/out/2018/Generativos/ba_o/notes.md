---
sketch: 2018/Generativos/ba_o
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1584
animated: false
techniques: [recursion, subdivision, 3d-mesh]
primitives: [rect, shape]
palette:
  colors: ["#DFAB56", "#E5463E", "#366A51", "#2884BC"]
  selection: random-from-list
composition: centered
parameters:
  - {name: sub, default: "random(12, 80)", tried: [20, 70], change: moderate, effect: "20 = coarser, fewer larger panels covering the canvas; 70 = finer busier mosaic with white showing between cells"}
  - {name: strokeWeight, default: 0.8, tried: [2.0], change: moderate, effect: "thicker, more visible dark wireframe cube outlines; scene otherwise the same"}
  - {name: planeAlpha, default: "random(8, 18)", tried: [60], change: moderate, effect: "washed-out pastel result, paler overlaps, larger white areas"}
  - {name: fovVal, default: 3, tried: [1.5], change: large, effect: "wide-angle view: central cluster enlarged, more outer boxes at the edges, stronger perspective distortion"}
  - {name: ccScale, default: "random(0.1, 0.9)", tried: [0.3], change: large, effect: "fewer planes per box: sparser colour fill, wireframe structure more visible"}
reusable_candidates:
  - {name: octantSubdivide, signature: "octantSubdivide(rootBox, iterations, pickBias) -> Box[]", note: "repeatedly replace a randomly picked box by its 8 half-size children"}
  - {name: boxFacePlanes, signature: "boxFacePlanes(box, count, alpha, prob) -> draw", note: "translucent rect 'curtains' on the three face planes of a box, at noise-free offsets"}
---

## What it draws
A centred 3D scene rendered in perspective: a dense nest of overlapping translucent rectangular planes in four colours — mustard/amber, red-orange, muted green and blue — over a near-white background. The planes form clusters that read as nested cubes of many sizes (a fractal box subdivision), with a few crisp dark thin wireframe cube outlines where the wireframe strokes show through. The whole composition radiates from the centre of the canvas, with the densest overlap in the middle and larger, paler planes toward the edges.

## How the code works
setup() (ba_o.pde:4-10) sets a 960x960 P3D canvas and calls `generate()` once; `draw()` is empty so the image is static.

`generate()` (lines 36-130):
1. Camera: `fov = PI/val` with `val = 3` (line 46-50), perspective centred on the canvas; the world is translated so the origin sits at `(-width/2)` in z (line 58) — a cube of size 2*960 centred on the origin fills the view.
2. Structure: starts from one big box (line 61). In a loop of `sub = int(random(12, 80))` iterations (line 63) it picks a random existing box (bias `random(boxes.size()*0.5)` toward the front of the list, i.e. older/larger boxes, line 65), replaces it with its 8 octant children of half the size (lines 72-79), and removes the parent (line 81). This is a stochastic octree subdivision — a recursive fractal of nested cubes, depth ~log2 of the chosen boxes.
3. Drawing: depth mask disabled (line 84), `noFill()`, `strokeWeight(0.8)` (line 89). For every surviving box it draws the wireframe `box()` outline (line 97), then for `cc = max(3, b.w*random(0.1,0.9))` levels (line 105) draws up to three translucent `rect`s on the z-, y- and x-face planes of the box (lines 107-126), each with 90% probability (the `random(1) < 0.9` checks), alpha `random(8, 18)` (line 106), colour picked randomly from the 4-colour `colors[]` list via `rcol()` (line 106, 136, 139-141).
4. Randomness enters via `randomSeed(seed)` (line 40): the pick indices, the wireframe/plane decisions, and the colour choices. The only visible colour mixing is ordinary alpha blending (no blend-mode set; `blendMode(ADD)` is commented out, line 43). `toxi`'s `SimplexNoise` is imported but `noise()` is never actually called (`noiseDetail(1)` at line 56 has no visible effect).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_20 | `int sub = int(random(12, 80));` -> `int sub = 20;` | moderate | coarser: a few large translucent panels span most of the canvas, reads as fewer bigger nested boxes, more uniform and saturated overall | variants/sub_20/frame_00001.png |
| sub_70 | `int sub = int(random(12, 80));` -> `int sub = 70;` | moderate | finer and busier: many small boxes, white background shows through the gaps more | variants/sub_70/frame_00001.png |
| strokeWeight_2 | `strokeWeight(0.8);` -> `strokeWeight(2.0);` | moderate | same scene but dark wireframe cube outlines clearly thicker and more visible (e.g. large outline bottom-right); colour fill unchanged | variants/strokeWeight_2/frame_00001.png |
| planeAlpha_60 | `stroke(rcol(), random(8, 18));` -> `stroke(rcol(), random(8, 60));` | moderate | washed-out pastel: overlaps paler, larger near-white areas (bottom-right corner), less colour saturation than baseline | variants/planeAlpha_60/frame_00001.png |
| fovVal_1.5 | `float val = 3;` -> `float val = 1.5;` | large | wide-angle: central cluster enlarged, more of the outer boxes visible at the edges, stronger perspective distortion | variants/fovVal_1.5/frame_00001.png |
| ccScale_0.3 | `int cc = int(max(3, b.w*random(0.1, 0.9)));` -> `... random(0.05, 0.3)` | large | fewer planes per box: sparser colour fill, more of the thin wireframe structure visible between the planes | variants/ccScale_0.3/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: the octree subdivision itself (`octantSubdivide`) — pure data, parameterised by iteration count and the pick bias; and the per-box face-plane "curtain" pass (`boxFacePlanes`) with count, alpha and keep-probability. Both are renderer-agnostic and reusable for any box/axis-aligned primitive.
- One-off art decisions: the 4-colour palette, the very low plane alpha (8-18) which only works because hundreds of planes stack, the fixed perspective framing (`val=3`, camera at z=-width/2, box sized 2*width), and the stroke weight 0.8 for the wireframe ghost.
- A clean parameter object would be: `{size, subdivisions, pickBias, fovVal, wireWeight, planeCountScale, planeAlpha:[lo,hi], planeProb, palette, background}`.
