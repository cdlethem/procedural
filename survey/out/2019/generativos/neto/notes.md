---
sketch: 2019/generativos/neto
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1753
animated: false
techniques: [grid, polar]
primitives: [ellipse, point, shape]
palette:
  colors: ["#E1E8E0", "#333A95", "#F6C806", "#F789CA", "#1E9BF3"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 4, tried: [12], change: subtle, effect: "more scattered circles; extras land pale/off-canvas so only a slight added busyness"}
  - {name: grainCount, default: 0, tried: [300], change: moderate, effect: "activates the dormant grain loop: a scatter of small multicoloured dots over the whole canvas"}
  - {name: sizeMul, default: "random(0.1,1)", tried: ["random(0.3,0.5)"], change: none, effect: "no visible change (circles shrink a little but the composition reads the same)"}
  - {name: gridStep, default: 10, tried: [40], change: none, effect: "no visible change (the white point grid was already near-invisible)"}
  - {name: circleAlpha, default: "random(10,200)", tried: ["random(200,255)"], change: none, effect: "no visible change (the visible circles were already near-opaque)"}
reusable_candidates:
  - {name: arcRing, signature: "arcRing(x, y, r1, r2, col, alpIn, alpOut) -> void", note: "concentric ring of trapezoid segments with radial alpha gradient, used as soft halo"}
  - {name: gridPoints, signature: "gridPoints(step, color, alpha) -> void", note: "even point lattice across the canvas"}
---

## What it draws
A near-monochrome pale sage field (a lerp of #E1E8E0 with one palette colour at 5%) with a few large, flat, mostly-yellow circles scattered across it, one of them a small pale-pink dot. Around each big circle there is a faint grey halo (a dark inner ring and a lighter outer ring). A very subtle lattice of small white dots underlies the whole canvas, one every 10px. The look is airy and sparse, like flat sticker circles floating on a faint graph paper.

## How the code works
`setup()` -> `generate()` (neto.pde:21-29,52-96), seeded by `randomSeed`/`noiseSeed` (54-55).
- Background (57-59): `lerpColor(color(#E1E8E0), getColor(), random(0.05))` — the base is #E1E8E0 with a 5% tint from a palette colour, so it reads as a flat pale sage.
- Dead dot loop (61-70): `for (int i = 0; i < 0; i++)` — the small-grain loop never runs, so it contributes nothing in the baseline.
- Big circles (72-88): `for (int i = 0; i < 4; i++)` — 4 circles, each at a random position snapped to the 20px grid (77-78), diameter `ss = random(width)*random(0.1,1)` (80), filled with a random palette colour `rcol()` at alpha `random(10,200)` (81). Colour comes from the 4-colour list `{#333A95,#F6C806,#F789CA,#1E9BF3}` (125) via `rcol()` (126-128); at seed 42 the visible circles land on yellow (#F6C806) and one small pink (#F789CA).
- Halo rings (86-87): each circle is followed by two `arc2` rings — a dark one `color(40)` alpha `random(8,20)` spanning r=ss*0.5..ss*0.4, and a lighter one `color(240)` alpha `random(30,60)` spanning r=ss*0.5..ss*0.7. `arc2` (98-115) draws the ring as `cc` trapezoid segments placed in polar coordinates (cos/sin) with a linear alpha ramp from `alp1` to `alp2`, giving the soft grey halo around each circle.
- Point grid (90-95): `stroke(255,100)` then a double loop stepping `j+=10` / `i+=10` places a white 40%-alpha point at every 10px lattice node — the faint graph-paper texture.
- `draw()` is empty (31-32): the piece is generated once in setup; frames 10/60 are identical to frame 1. Note `SimplexNoise`/`noiseSeed` are imported but noise is never actually sampled.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_12 | `for (int i = 0; i < 4; i++)` -> `... i < 12;` | subtle | a few extra circles appear (a large pale yellow-green one lower-right, a small blue one top-right); overall still sparse | variants/count_12/frame_00001.png |
| grains_300 | `for (int i = 0; i < 0; i++)` -> `... i < 300;` | moderate | the dormant grain loop runs: dozens of small blue/pink/yellow/purple dots scattered everywhere, and the 4 big circles shift to blue/pink/light-blue/purple — much busier | variants/grains_300/frame_00001.png |
| size_0.3_0.5 | `float ss = random(width)*random(0.1, 1);` -> `...random(0.3, 0.5);` | none | no visible change (top yellow circle sits slightly smaller/in-frame, rest reads the same) | variants/size_0.3_0.5/frame_00001.png |
| grid_40 | `for (int j = 0; j <= height; j+=10)` -> `... j+=40` | none | no visible change (point grid was already near-invisible) | variants/grid_40/frame_00001.png |
| alpha_200_255 | `fill(rcol(), random(10, 200))` -> `... random(200, 255)` | none | no visible change (yellow circles already near-opaque) | variants/alpha_200_255/frame_00001.png |

## Modularisation notes
Generic, library-ready: `arcRing` (the halo) is a clean reusable primitive — a polar ring with an inward/outward alpha ramp; and `gridPoints` is a trivial even lattice. One-off art decisions: the dead 0-iteration grain loop, the 4-circle count, the specific 4-colour palette, the 20px position snapping, and the exact halo radius/alpha recipe tied to circle size. A clean parameter object would be `{count, sizeMin, sizeMax, alphaMin, alphaMax, gridStep, gridColor, gridAlpha, haloInR, haloOutR, haloCol, haloAlpIn, haloAlpOut, bgBase, bgTint}`. The `rcol`/`getColor` palette helpers are also generic (random-from-list + lerp-between).
