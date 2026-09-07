---
sketch: 2018/Generativos/cubeGrid
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1541
animated: false
techniques: [recursion, subdivision, 3d-mesh]
primitives: [rect]
palette:
  colors: ["#FFDA05", "#E01C54", "#E92B1E", "#E94F17", "#125FA4", "#6F84C5", "#54A18C", "#F9AB9D", "#FFEA9F", "#131423"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(w, h, iterations) -> Rect[]", note: "binary space partition: repeatedly split a random rect in half (horizontal or vertical), leaving 2^n leaf rects"}
  - {name: cubeFaces, signature: "cubeFaces(size) -> 6 plane placements", note: "six size x size planes translated/rotated to the faces of an axis-aligned cube"}
---

## What it draws
A view from inside a giant cube: the three or four interior faces visible from the camera converge to a dark central vanishing region, filling the whole 960x960 frame. Every face is a dense mosaic of axis-aligned rectangles in flat saturated colours (yellow, red, orange, pink, blue, teal, with black gaps) of wildly varying size, from large blocks to hairline strips. The mosaic is coarse on some faces and extremely fine on others, giving a striped/tessellated, Mondrian-like surface.

## How the code works
- `setup()` (L3-8) creates a 960x960 P3D window and calls `generate()` once; `draw()` is empty, so the image is static (L10-12). Randomness enters via `seed` (L1, L17).
- `generate()` (L22-43): black background (L24); a very wide field of view `fov = PI/random(1.1,1.3)` (~138-164 deg, L27) with the camera pulled to `cameraZ = (height/2)/tan(fov/2)` (L28-29). The scene is rotated by three random angles (L31-34), then a cube of `size = width*random(2,10)` (L38) is placed at the origin with a small random offset (L39). Since `size >= 1920` while `cameraZ` is only ~70-190, the camera sits *inside* the cube, which is why the faces wrap the whole frame and converge inward.
- `boxes(s)` (L45-67) draws 6 faces, each a `plane(s)` at `z = -s/2` and `z = +s/2`, with the Y- and Z-axis pairs rotated by HALF_PI.
- `plane(s)` (L79-143) is the core: it starts with one rect covering the face (L92-93) and runs `sub = int(random(10, 20000))` iterations (L95). Each iteration picks a random rect from the list and splits it in half horizontally or vertically (50/50, L103-109), adding the two halves and removing the parent (L116). Because every split doubles the count, the list size is `2^sub` after `sub` rounds — with `sub` up to 20000 this is infeasible, so in practice the per-face split count is whatever the list supports before it becomes huge; the visible effect is that different faces get wildly different subdivision depths (coarse blocks vs. hairline strips).
- Colour: each leaf rect gets `fill(rcol())` (L140-141), a uniform random pick from the 10-colour `colors[]` list (L152-155). Rects are drawn with `rectMode(CENTER)` (L37). `background(0)` shows through the gaps as black.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `subdivideRects(w, h, iterations)` — pure 2D binary space partition, no Processing 3D dependency; reusable for any face/tile tessellation. `cubeFaces(size)` — the six-plane placement is a small, parameterisable helper.
- One-off art decisions: the inside-the-cube camera (huge `size` relative to `cameraZ` + ultra-wide fov), the random per-face split counts, and the flat random 10-colour palette.
- A clean parameter object would be: `{ canvasSize, cubeSize, fovRange, splitIterationsRange, splitAxisProbability, colors[], seed }`. The current `random(10, 20000)` split range is effectively unbounded (list size doubles each round), so a sane library version would cap leaf count instead.
