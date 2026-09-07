---
sketch: 2019/generativos/hexagonal
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1590
animated: false
techniques: [grid, noise-field, blend-modes, symmetry]
primitives: [shape]
palette:
  colors: ["#A128ED", "#1C0A26", "#0029C1", "#5BFFBB", "#EAE4E1"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: hexCube, signature: "hex(x, y, s, palette, whiteLerp) -> void", note: "hexagon drawn as 3 rhombi, each a random palette colour -> isometric-cube illusion"}
  - {name: hexStreak, signature: "hexStreak(x, y, s, alphaRange) -> void", note: "radial quad from centre, alpha gradient to 0, rendered through grain shader"}
  - {name: hexGridCells, signature: "hexGridCells(cellSize, count, w, h) -> float[][]", note: "random cells on a pointy-top hex grid with row-parity x offset"}
---

## What it draws
Flat full-bleed background in mint green (seed 42) covered with ~90 overlapping translucent
hexagonal "cubes" — each cube is three rhombi in different colours from a purple / deep-blue /
mint / cream / near-black palette — in many sizes, most with a smaller cube inside. Long
translucent colour streaks radiate from the cube centres across the whole canvas, and a fine
grainy texture is visible over everything the shader touches.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the sketch is static.

`generate()` (hexagonal.pde:48-91):
- `randomSeed`/`noiseSeed(seed)` (50-51); `noiseShader.set("displace", 543)` (53);
  background = `rcol()` — one random palette colour (55, 152-154; palette at 146).
- Loop `i < 90` (60): a random cell `(ix, iy)` is picked on a pointy-top hex grid with
  spacing `dd = 16` (61); even rows offset `x` by `sqrt(3)*dd/2`, odd rows by `sqrt(3)*dd`
  (68-73). So hexes sit on grid points but the cells are sampled randomly, not sequentially.
- Size `ss = 16*int(random(1, random(5, 14)))/1.3` (62), ≈ 12-160 px.
- Four `hexShadow(xx, yy, ss*4)` calls (80-83), each drawn through `noiseShader`.
  `hexShadow` (110-132) is a quad: centre -> hex point at angle `a1` -> point at `a1+TAU/6`
  -> the same two points pushed out by `6*r` along a random direction `a3` (127-130);
  fill is a gradient from `col` at alpha `random(120, 220)` to alpha 0 (121-126) —
  these are the long translucent radiating streaks.
- `hex(xx, yy, ss*4)` (86): `hex` (93-108) draws the hexagon as three 120° rhombi
  (each: centre + two hex vertices 60° apart), each rhombus a different random palette
  colour with its centre vertex lerped 0-14% toward white (99-100); the whole cube is
  randomly snapped to 0° or 120° rotation (96). Three differently-coloured rhombi read
  as the top/left/right faces of an isometric cube.
- With probability 0.9 (88) a smaller `hex(xx, yy, ss)` is drawn at the same centre —
  the inner cube.

Fragment shader `data/noiseFrag.glsl`: adds a per-pixel hash grain — `+noi*0.1` brightness
and `alpha *= pow(a, 1.8) * (0.7 - noi*0.4)` — to anything drawn through it (the shadows).
`displace` is only a constant offset added to `gl_FragCoord.xy` before the hash: it shifts
the grain phase, it does not displace geometry. Display is a virtual X (`:2`); the grain and
alpha mottling are clearly present in the render, so the shader appears to have worked.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `hex` (3-rhombus cube — parameterise palette, white-lerp, rotation snap),
  `hexShadow` (radial alpha-gradient streak — parameterise length factor 6, alpha range,
  direction), and the grid block (61-73, random-cell sampling on a pointy-top hex grid).
- One-off art decisions: drawing 4 shadows per hex, the 0.9 inner-cube probability, the
  `/1.3` size divisor, the 5-colour palette, and the shader grain over shadows only.
- Clean parameter object: `{count: 90, cellSize: 16, sizeDiv: 1.3, shadowCount: 4,
  shadowAlpha: [120, 220], innerProb: 0.9, palette, displace: 543}`.
