---
sketch: 2019/generativos/brotes
year: 2019
renderer: P2D
size: [1920, 1920]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 3152
animated: false
techniques: [recursion, subdivision, l-system, blend-modes, dots-stippling]
primitives: [line, ellipse]
palette:
  colors: ["#EB4313", "#E9CA54", "#749AB2", "#0A0A15"]
  selection: random-from-list
composition: radial
parameters:
  - {name: sub, default: 90000, tried: [], change: none, effect: ""}
  - {name: ampAng, default: 1.4, tried: [], change: none, effect: ""}
  - {name: desFactor, default: "0.9-1.2", tried: [], change: none, effect: ""}
  - {name: strokeWeight, default: 1.4, tried: [], change: none, effect: ""}
  - {name: alp, default: 60, tried: [], change: none, effect: ""}
  - {name: seedCount, default: 30, tried: [], change: none, effect: ""}
reusable_candidates:
  - {name: branchSubdivide, signature: "branchSubdivide(seeds: Line[], iterations, maxAngle) -> Line[]", note: "stochastic iterative subdivision of a line pool: cut a random line, add 1-3 branches at angled offsets"}
---

## What it draws

A dense, fractal plant-like branching structure filling most of the canvas on a very dark navy background (#0A0A15). The structure is densest at the centre and thins toward the edges, with hundreds of fine hair-thin line segments forming recursive branch clusters that radiate outward. Small sparse dots in warm colours (orange-red, pale yellow, pale blue) are scattered among the branch tips. The overall palette of the lines is pale, desaturated — a mix of faint whites, greys, and muted colour tints from random RGB strokes at low alpha.

## How the code works

- **Size** (lines 6-10, 14-18): canvas is 1920×1920 (960×2 scale), P2D renderer, `smooth(8)`.
- **Seeds** (lines 63-75): 30 starting line segments are placed at random positions in a ±65% window around the canvas centre (after translating the origin to centre). Each seed has random x1/y1 and x2/y2.
- **Subdivision loop** (lines 86-169): `sub = 90000` iterations. Each iteration picks a random line from the pool (biased toward the end via `random(0.8, 1)` on the index). If the line has not yet been divided (`!l.divide`): it is cut at a random position 60-80% along its length, and 1-3 new branch lines are added from the cut point at angles offset by `ampAng` (max 1.4 rad ≈ 80°) with lengths proportional to the cut-off portion (factor `random(0.9, 1.2)`). If the line has already been divided: a smaller cut (40% of the original factor) is made and one additional branch is added with a smaller angle offset (`random(0.1, 0.4) × ±2` rad).
- **Colour** (lines 171-192): 100 fully random RGB colours are generated per call (the `greens` array is misnamed; the original lerpColor line is commented out). Each line segment is drawn with `strokeWeight(1.4)`, alpha = 60, and a random colour from the 100. 20% of lines use `blendMode(ADD)` (additive blending brightens overlaps); the rest use NORMAL.
- **Tip dots** (lines 194-206): for lines that have never been divided, a 5% chance draws a small filled ellipse (0.5-5 px) at the endpoint, coloured from the 3-colour palette `{#EB4313, #E9CA54, #749AB2}` via `rcol()`.

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes

The core `branchSubdivide` loop is a generic stochastic L-system: given a seed line pool, an iteration count, a max branch angle, a branch-length factor, and a split-probability, it produces a final line list. This is directly reusable. The colour scheme (100 random RGB at alpha 60) is a one-off art decision; a clean parameter object would expose: `seedCount`, `sub`, `maxAngle` (ampAng), `branchLengthFactor` (des factor range), `strokeWeight`, `alpha`, `addBlendProb`, `tipDotProb`, `tipDotSizeRange`, and a colour source.
