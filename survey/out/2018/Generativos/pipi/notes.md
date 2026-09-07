---
sketch: 2018/Generativos/pipi
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1563
animated: false
techniques: [subdivision, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#FACC02", "#FB0603", "#0365BC", "#0D6305", "#000000", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(3000))", tried: [300], change: large, effect: "fewer iterations = larger triangles, less dense subdivided cluster, empty space on one side"}
  - {name: da, default: "TAU/3.0", tried: ["TAU/4.0"], change: large, effect: "90-degree vertex spacing changes initial triangle silhouette; prominent red/yellow pyramid extrusion visible"}
  - {name: fov, default: "PI/random(2,3.6)", tried: ["PI/2.0"], change: large, effect: "wider FOV zooms in; large foreground white triangle, more dramatic perspective"}
  - {name: splitProb, default: 0.9, tried: [0.5], change: large, effect: "more pyramid extrusions; larger individual triangles, more 3D-looking"}
  - {name: dis, default: "width*random(2,5)", tried: ["width*2"], change: large, effect: "closer initial triangle = more centered composition, large central white triangle"}
  - {name: tiltX, default: "random(0,PI*0.5)", tried: ["random(0,PI*0.25)"], change: large, effect: "less tilt = more top-down view, higher horizon, flatter appearance"}
reusable_candidates:
  - {name: triangleSubdivide, signature: "triangleSubdivide(tris: Triangle[], iterations: int, splitProb: float) -> Triangle[]", note: "repeatedly pick a random triangle, either split into 4 sub-triangles or extrude a pyramid apex, replacing the original"}
  - {name: perspectiveSetup, signature: "perspectiveSetup(fov: float, w: float, h: float, near: float, far: float)", note: "set up Processing perspective camera with a random FOV"}
---

## What it draws
A 3D perspective scene of a flat, subdivided triangle field viewed from a low, tilted angle. Large flat coloured triangles (blue, white, green, black, yellow) fill the foreground, while a dense cluster of small multi-coloured triangles sits at the horizon. The background is solid black. The overall look is a faceted, low-poly landscape.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static (line 10–11).

**Camera** (lines 29–33): a random FOV (`PI/random(2,3.6)`, line 29) sets the perspective. The scene is translated to canvas centre and tilted with `rotateX(random(0, PI*0.5))`, giving the low-angle view.

**Triangle generation** (lines 35–61): starts with one equilateral-ish triangle at a random angle and distance (`width*random(2,5)`, line 37). Then `sub = int(random(3000))` iterations (line 40). Each iteration picks a random triangle and, with 90 % probability (line 45), splits it into 4 sub-triangles by connecting the midpoints of its edges (lines 46–49); with 10 % probability it extrudes a pyramid apex outward along the triangle's normal (lines 51–58). The original triangle is removed (line 60), so the list grows by +3 (split) or +2 (extrude) per iteration.

**Drawing** (lines 63–74): each triangle is drawn twice. First as a stroke-only outline (`stroke(0)`, lines 67–72), then via `t.show()` which fills each vertex with a slightly randomised lerp between two random palette colours (lines 89–99). The 6-colour palette is `#FACC02` (yellow), `#FB0603` (red), `#0365BC` (blue), `#0D6305` (green), `#000000` (black), `#FFFFFF` (white); `rcol()` picks one at random (lines 108–110).

**Background**: `background(rcol())` (line 28) — one random palette colour as the solid backdrop (black in the seed-42 baseline).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_300 | `int sub = int(random(3000));` -> `int sub = 300;` | large | large flat triangles (blue, white, red, yellow, black) fill right half; dense subdivided cluster at top-right; left half mostly empty black; fewer iterations = larger triangles, less density | variants/sub_300/frame_00001.png |
| da_TAU4 | `float da = TAU/3.0;` -> `float da = TAU/4.0;` | large | 90-degree vertex spacing; prominent red/yellow pyramid extrusion in centre; dense subdivided strip runs horizontally across middle; bottom half mostly dark | variants/da_TAU4/frame_00001.png |
| fov_PI2 | `float fov = PI/random(2., 3.6);` -> `float fov = PI/2.0;` | large | wider FOV zooms in; large white triangle dominates lower-centre; subdivided cluster at top; more dramatic perspective | variants/fov_PI2/frame_00001.png |
| splitProb_0.5 | `if (random(1) < 0.9) {` -> `if (random(1) < 0.5) {` | large | more pyramid extrusions; large flat triangles (blue, white, green, black) fill bottom; denser subdivided cluster at top with more visible pyramids; more 3D-looking | variants/splitProb_0.5/frame_00001.png |
| dis_width2 | `float dis = width*random(2, 5);` -> `float dis = width*2;` | large | closer initial triangle = more centred composition; large white triangle dominates centre; subdivided clusters at corners/edges | variants/dis_width2/frame_00001.png |
| tiltX_PI025 | `rotateX(random(0, PI*0.5));` -> `rotateX(random(0, PI*0.25));` | large | less tilt = more top-down view; higher horizon; dense subdivided strip at top; large flat triangles (blue, white, yellow) fill middle; flatter appearance | variants/tiltX_PI025/frame_00001.png |

## Modularisation notes
The core loop (lines 42–61) is a generic triangle-subdivision algorithm: given a list of triangles, repeatedly pick one at random and either split (midpoint subdivision) or extrude (pyramid). This is separable into a pure function `triangleSubdivide(tris, iterations, splitProb) -> tris` that takes no renderer state.

The perspective setup (lines 29–33) is a small, reusable helper: given FOV and canvas dimensions, compute and apply `perspective()` + `translate` + `rotateX`.

The colour assignment in `Triangle.show()` (lines 89–99) is a one-off art decision: per-vertex random lerp between two random palette colours. A clean parameter object would hold: `palette[]`, `splitProb`, `extrudeProb`, `iterations`, `initialDistance`, `fov`, `tiltX`.
