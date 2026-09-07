---
sketch: 2014/Generativos/quadFlotantesAnimados
year: 2014
renderer: JAVA2D
size: [1280, 720]
libraries: []
deterministic: true
ms_first_frame: 192
animated: true
techniques: [grid, subdivision]
primitives: [rect]
palette:
  colors: ["#512B52", "#635274", "#7BB0A8", "#A7DBAB", "#E4F5B1"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: gridAlignedPowerOf2, signature: "gridAlignedPowerOf2(maxExp) -> (x, y, size)", note: "random square whose size is 2^k and whose x,y snap to a size-aligned grid (quadtree-leaf look)"}
  - {name: lerpingQuad, signature: "lerpingQuad(x, y, size, color, palette, life, changeRate) -> quad", note: "square that lerps between random palette colors and self-destructs after a random lifetime"}
---

## What it draws
Seed 42, frame 1: a red background with the first batch of 20 squares already down — a large pale
yellow-green block filling the left half, a big teal square in the centre, dark-purple blocks along
the bottom and upper-right, and a handful of small squares. It is an accumulating animation: by frame 60
the red is gone and the whole 1280x720 canvas is a dense mosaic of axis-aligned squares in the five
muted palette colours (pale yellow-green, light green, teal, medium purple, dark purple), spanning
many power-of-two sizes from a few pixels up to ~half the canvas, each with a faint thin dark outline.

## How the code works
- `setup()` (L11-17): `size(1280, 720)`, `frameRate(30)`, `background(255, 0, 0)` (the red ground). The
  one-shot `generar()` pre-fill is commented out (L15), so the list starts empty and the canvas is built
  up entirely by `draw()`.
- `draw()` (L19-26): every frame adds 20 new squares via `agregar()`, then walks the list calling
  `update()` on each and removing any marked `eliminar`.
- `agregar()` (L92-105): picks a random power-of-two size `tt = 2^random(1..10)`, snaps its position to a
  `tt`-aligned grid (`x = int(random(width/tt+1))*tt`), and inserts a `Quad` keeping the list sorted by
  size so smaller squares are appended last and drawn on top.
- `Quad` (L48-90): the constructor picks a random palette colour (`rcol`), a next colour, a random
  lifetime `tiempoVida = random(3,10)` seconds, and a random first colour-change time. `update()` advances
  `time` by 1/30 s, `lerpColor`s `col` toward `nue` over `tiempoCambio`, re-rolls a target colour, and sets
  `eliminar` once `time > tiempoVida`. `show()` (L78-89) strokes a faint dark outline (`stroke(0, 8)`,
  weights 3/2/1) then fills the square with `col`.
- `rcol()` (L107-109): a random entry of the 5-colour palette; colour is chosen `random-from-list` and
  blended with `lerpColor`, never from a gradient or image.
- Randomness enters at position (grid-snapped), size (power of two), colour, lifetime, and
  colour-change timing. Renderer is JAVA2D, default blend mode (no explicit blendMode). Because quads die
  after 3-10 s while 20 more are added per frame, the mosaic is constantly being turned over.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic / reusable: `gridAlignedPowerOf2` (the quadtree-leaf placement, L92-96) and the `lerpingQuad`
behaviour (colour lerp + lifetime + self-removal, L58-77) are both parameterised and art-independent.
One-off art decisions: the specific 5-colour muted palette, the per-frame count of 20, the
power-of-two size range (exponent 1..10), the lifetime window (3..10 s), and the faint alpha-8 outline.
A clean parameter object for this sketch would hold: `palette`, `addPerFrame`, `maxExp` (size range),
`lifetime` (min,max), `colorChangeRate`, and `outlineAlpha`. The sorted-insert so that small squares
overlay large ones (L98-104) is a layout rule worth keeping explicit rather than implicit.
