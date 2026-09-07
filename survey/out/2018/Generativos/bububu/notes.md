---
sketch: 2018/Generativos/bububu
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2851
animated: false
techniques: [packing, particles, distortion, noise-field]
primitives: [ellipse, shape]
palette:
  colors: ["#EA554F", "#FAC745", "#2760AB", "#369952", "#1E2326", "#FFF7F3"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cellAttempts, default: 30000, tried: [6000], change: none, effect: "no visible change; packing saturates well before 30000 attempts, same cells accepted"}
  - {name: cellSizeMax, default: 0.6, tried: [0.15], change: large, effect: "max cell size as fraction of width; 0.15 removes the giant circles, leaves only small/medium clusters, more uniform texture"}
  - {name: det, default: "random(0.01)*random(1)", tried: [0.001], change: moderate, effect: "noise scale of the displacement field; lower = field varies faster in space, dots scatter less, clusters rounder and more compact"}
  - {name: displaceDist, default: 300, tried: [60], change: large, effect: "max noise displacement distance; 60 keeps small dots hugging their cells, clean round halo clusters instead of fuzzy silhouettes"}
  - {name: pointAttempts, default: 100000, tried: [20000], change: large, effect: "inner packing attempts per cell; 20000 leaves clusters visibly sparser, more gray ground between dots"}
  - {name: background, default: 80, tried: [230], change: large, effect: "background gray level; 230 inverts the figure/ground to a light gray field (composition unchanged)"}
---

## What it draws
A 960x960 canvas filled edge to edge with a dark gray (80) background covered by scattered clusters of dots. A minority of clusters contain one or a few large solid circles (yellow, cream, red, blue, green, near-black); the majority are dense agglomerations of tiny overlapping dots in the same six-color palette, with irregular, blob-like cluster boundaries. Nothing animates; frames 10 and 60 are identical to frame 1.

## How the code works
`setup()` (bububu.pde:3-9) sets size 960x960 P2D, smooth(8), pixelDensity(2), and calls `generate()` once; `draw()` is empty, so the image is static (any key re-runs generate with a new random seed).

`generate()` (line 22):
- `background(80)` — the dark gray ground.
- `des = random(10000)` and `det = random(0.01)*random(1)` (lines 25-26) are the noise offset and scale used for displacement; `noiseDetail(1)` (line 27) keeps only the coarsest octave.
- Outer loop (line 31) tries 30000 candidate "cells": random centers in a -10%..110% margin, sizes `ss = width*random(0.02, 0.6)` (line 34). A linear rejection test against all accepted cells (lines 36-46) keeps only non-overlapping cells — this is what produces the scattered, non-overlapping cluster layout.
- For each accepted cell, an inner loop (line 49) tries 100000 points: random positions inside a `ss`-wide square around the cell center, sizes `s = random(ss)*random(0.8)*random(0.5, 1)` (line 52), keeping points inside the cell circle with `s >= 0.5` (line 53) and non-overlapping against the cell's already-accepted points with a 0.52 radius factor (lines 54-63). This second packing pass yields the dense small-dot clusters; the few large dots appear when the random size roll lands high.
- Each accepted point is drawn (lines 65-79) as a closed `beginShape()` polygon with `res = max(8, PI*r)` vertices (line 68), each vertex warped by `displace()` (line 75) — that's why the dots have slightly irregular, organic edges rather than perfect circles. `fill(rcol())` (line 70) picks a uniform random color from the 6-entry `colors[]` array (line 95); `noStroke()`.
- `displace()` (lines 83-87) rotates by angle `noise(des+pos*det)*TWO_PI` and shifts by distance `noise(1000+...)*300`. With `det` up to 0.01 and offsets up to 10000, the displacement field is smooth over a dot but varies across the canvas; the *300 distance can be large relative to small dot radii, which scatters small dots away from their cell centers and gives the fuzzy, irregular cluster silhouettes.
- Randomness enters via: the seed (line 1, injected by the harness), `des`/`det` (lines 25-26), cell centers/sizes (lines 32-34), point positions/sizes (lines 50-52), and color choice (line 97).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cellAttempts_6000 | `  for (int k = 0; k < 30000; k++) {` -> `  for (int k = 0; k < 6000; k++) {` | none | no visible change; identical large dots in identical positions, same density | variants/cellAttempts_6000/frame_00001.png |
| cellSizeMax_0.15 | `    float ss = width*random(0.02, 0.6);` -> `    float ss = width*random(0.02, 0.15);` | large | giant circles gone (max cell ~144px instead of ~576px); only small/medium clusters, denser uniform texture | variants/cellSizeMax_0.15/frame_00001.png |
| det_0.001 | `  float det = random(0.01)*random(1);` -> `  float det = random(0.001)*random(1);` | moderate | displacement field varies faster in space; small dots scatter less, clusters are rounder and more compact with cleaner edges | variants/det_0.001/frame_00001.png |
| displaceDist_60 | `  float d = noise(1000+des+v.x*det, 1000+des+v.y*det)*300;` -> `...*60;` | large | fuzzy scattered silhouettes collapse into tight, round clusters; small dots hug the large circles forming clean halo rings | variants/displaceDist_60/frame_00001.png |
| pointAttempts_20000 | `    for (int i = 0; i < 100000; i++) {` -> `    for (int i = 0; i < 20000; i++) {` | large | clusters visibly sparser, more gray ground showing between dots; large circles unchanged | variants/pointAttempts_20000/frame_00001.png |
| background_230 | `  background(80);` -> `  background(230);` | large | same composition on a light gray ground; dots and large circles unchanged in position and colour | variants/background_230/frame_00001.png |

## Modularisation notes
- Generic: the two-level rejection packing (outer `cells`, inner `points`) is a reusable "non-overlapping circles in a region" routine; the parameters are attempt counts, region size, min size, and the overlap radius factor (0.5 vs 0.52).
- Generic: `displace()` is a standalone noise-warp function (offset, scale, max distance) applicable to any vertex stream.
- One-off art decisions: the specific 6-color palette, `background(80)`, the polygon-vertex-count heuristic `max(8, PI*r)`, the *300 displacement distance, and the double-random size formula `random(ss)*random(0.8)*random(0.5,1)`.
- Clean parameter object: `{cellAttempts, cellSizeRange, cellMargin, pointAttempts, pointMinSize, pointRadiusFactor, palette, background, noiseOffset, noiseScale, displaceDistance}`.
