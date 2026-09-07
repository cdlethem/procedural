---
sketch: 2017/Generativos/esquinas
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1499
animated: false
techniques: [subdivision, grid]
primitives: [rect, shape]
palette:
  colors: ["#F8CA9C", "#F8B6D9", "#EF276B", "#A14FBE", "#1D43B8"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub, default: "10^random(1, random(1,2)), i.e. 10-99", tried: [100, 20], change: large, effect: "100 = denser tiling (more, smaller cells); 20 = sparser (huge blocks dominate); both also reshuffle the random stream since the random() call was removed"}
  - {name: ms, default: 0.25, tried: [0.5, 0.1], change: subtle, effect: "scales the corner accent square: 0.5 fills a whole corner quadrant, 0.1 is almost invisible; composition unchanged"}
  - {name: colors, default: "5 cool pastels #F8CA9C..#1D43B8", tried: ["warm alt {#45171D, #F03861, #FF847C, #FECEA8} (line 97)"], change: large, effect: "pure palette swap to salmon/peach/cream + maroon/brown; same composition"}
  - {name: dir, default: "random(4)", tried: [0], change: large, effect: "all cells bevel in the same direction (uniform lighting); score inflated by random-stream reshuffle"}
reusable_candidates:
  - {name: quadSubdivide, signature: "quadSubdivide(quad, iterations) -> PVector[]", note: "repeatedly replace one random quad by its four corner halves (quadtree subdivision)"}
  - {name: beveledCell, signature: "beveledCell(x, y, z, color, dir) -> void", note: "base rect + corner rect + dark/light trapezoid overlays = lit 3D block look"}
  - {name: lerpPalette, signature: "lerpPalette(colors, t) -> int", note: "color = lerpColor(colors[i], colors[i+1], t%1) for continuous palette sampling"}
---

## What it draws
A full-bleed mosaic of axis-aligned squares in several sizes: the canvas is recursively split into a
quadrisection tiling (a few large squares, many small ones), and every square is rendered as a "corner"
block — a base square in a pastel colour, a small square tucked into one of its corners, a semi-transparent
black trapezoid along one edge and a semi-transparent white trapezoid on the opposite side, so each cell
reads as a 3D bevelled block lit from a random corner. Dominant colours: violet/purple, pink-magenta and
blue, with occasional peach/cream cells.

## How the code works
`setup()` (esquinas.pde:3) calls `generate()`; `draw()` is empty, so the image is static (regeneration is
only via key press, line 16-19). `generate()` (line 26) re-rolls the unused int `seed` and calls
`render()`.

- Subdivision (lines 37-51): start with one quad `PVector(0,0,width)` covering the centred canvas.
  `sub = int(pow(10, random(1, random(1,2))))` gives 10-99 iterations; each picks a random quad, removes it
  and adds its four corner halves (`ms = z*0.5`). Final cell count = 1 + 3*sub, sizes in powers of 1/2.
- Per-cell drawing (lines 56-93), with `rectMode(CENTER)`, `noStroke()`:
  - colours: `c1`/`c2` from `getColor(colors.length*random(2))` (line 101) = `lerpColor` between two
    adjacent palette entries (5 colours, line 96) at a random offset — continuous pastel mix, not a hard pick.
  - `dir = int(random(4))` (line 62) picks the corner; `dx`/`dy` (lines 64-65) map it to ±1 offsets;
    `dd = (z - z*ms)*0.5` with `ms` fixed to `0.25` (line 61, the `random(0.2,1)` line above is overwritten).
  - base square `rect(q.x, q.y, z, z)` in `c2` (line 70), then a small square of size `z*ms` placed at the
    `dir` corner, exactly touching the edges (line 72).
  - dark overlay: 4-vertex shape (lines 75-82) in `fill(0, 80)` — a trapezoid strip along the +dx edge
    spanning the full height, i.e. a shadow face.
  - light overlay: 4-vertex shape (lines 85-92) in `fill(255, 80)` — the complementary trapezoid, a
    highlight face. Together they bevel the square and fake a light source at the `dir` corner.
- Randomness enters only at: which quad is subdivided, per-cell colours (line 58-59) and light direction
  (line 62). No noise is used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_100 | `int sub = int(pow(10 , random(1, random(1, 2))));` -> `int sub = 100;` | large (mean 0.206, 0.853 of pixels) | denser tiling: same large-scale layout but noticeably more, smaller cells, especially in the central cluster | variants/sub_100/frame_00001.png |
| sub_20 | same -> `int sub = 20;` | large (mean 0.205, 0.783 of pixels) | sparser: top half dominated by 2-3 huge blocks, the small dense cluster only in the center-right | variants/sub_20/frame_00001.png |
| ms_0.5 | `ms = 0.25;` -> `ms = 0.5;` | subtle (mean 0.041, 0.152 of pixels) | identical composition to baseline; corner accent squares double to 0.5*z and fill a whole corner quadrant; bevel overlays shift (d2 = 0) | variants/ms_0.5/frame_00001.png |
| ms_0.1 | `ms = 0.25;` -> `ms = 0.1;` | subtle (mean 0.017, 0.045 of pixels) | identical composition; corner squares tiny, almost invisible | variants/ms_0.1/frame_00001.png |
| palette_alt | palette line 96 -> warm alt `{#45171D, #F03861, #FF847C, #FECEA8}` (the commented line 97) | large (mean 0.295, 0.924 of pixels) | identical composition, pure palette swap: salmon/peach/cream with maroon/brown and red-pink blocks | variants/palette_alt/frame_00001.png |
| dir_0 | `int dir = int(random(4));` -> `int dir = 0;` | large (mean 0.206, 0.774 of pixels) | every cell bevels in the same direction (corner square at top-left, dark top-left face, light bottom-right face) — uniform lighting, more ordered look than baseline | variants/dir_0/frame_00001.png |

Note: the `ms` and palette substitutions leave the `random()` call count untouched, so those four variants keep the
baseline composition exactly and their scores isolate the parameter effect. The `sub` and `dir` substitutions remove
`random()` calls, which shifts the whole random stream and re-rolls the composition, colours and light directions —
their "large" scores mix the intended parameter effect with that reshuffle.

## Modularisation notes
The quadtree subdivision (lines 37-51) is generic: given a quad and an iteration count it produces an
irregular power-of-two tiling — a clean library function `quadSubdivide(origin, size, iterations)`.
`beveledCell` (the per-cell drawing block, lines 56-93) is the reusable visual primitive: a square with a
corner accent and two alpha-blended trapezoid faces giving a lit 3D look; parameterise by (x, y, size,
color, cornerDir, inset). `lerpPalette` is a small generic helper. Art decisions to keep out of the
library: the fixed 5-colour palette (plus the commented warm alternative, line 97), the fixed `ms = 0.25`
inset, and the alpha-80 black/white overlay strengths. A parameter object would be: {subdivisions,
insetRatio, dirMode: random|fixed|angle-based, palette, overlayAlphas}.
