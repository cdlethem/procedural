---
sketch: 2014/Generativos/triangulitos
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: false
ms_first_frame: 218
animated: false
techniques: [grid, particles, typography]
primitives: [shape, line, text]
palette:
  colors: ["#5624C3", "#F62021", "#FEC225", "#0E02FD", "#12E4EF"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: forma, signature: "forma(x, y, dim, sides, ang)", note: "regular n-gon, always called with 3 sides (triangle)"}
  - {name: grilla, signature: "grilla(x, y, w, h, tam) -> triangular tiling", note: "jittered triangular grid filling a rectangle, one random palette colour per cell"}
  - {name: linea, signature: "linea(x1, y1, x2, y2, gro, c1, c2)", note: "thick line stroked, then re-covered by triangles tiled along its length"}
  - {name: Paleta, signature: "Paleta(color... c); rcol()", note: "small colour-list helper with random pick"}
---

## What it draws
A nearly empty black 600x800 canvas. The only visible content is a short row of four to five small
(up-pointing) triangles, roughly 10 px tall, at the very top-left corner: yellow, red, blue, yellow,
blue. The rest of the image is pure black. The code's intended output is a dense multi-pass field of
triangles plus thick diagonal lines and a scatter of 200 000 tiny semi-transparent triangles, but the
render crashed before any of that appeared (see below).

## How the code works
- `setup()` (lines 8-14): 600x800 JAVA2D window; 5-colour palette (line 10: `#5624C3 #F62021 #FEC225
  #0E02FD #12E4EF`); Helvetica Bold 100 (line 11); offscreen 600x800 `PGraphics aux` (line 12);
  `generar()` is launched on a **background thread** (line 13). `draw()` (16-17) is empty.
- `generar()` (28-63), the intended pipeline:
  1. black background (30);
  2. 8 passes (32-34) of `grilla(0,0,width,height, random(3,20))` — each pass tiles the whole canvas
     with a jittered grid of up-pointing equilateral triangles, `tam` = 3-20 px per pass, every cell
     filled with a random palette colour (80-91); passes overlap, so the last pass wins;
  3. `cant` = 1-50 thick diagonal lines (36-41): `linea()` (65-78) strokes a line of weight 10-20 in a
     random palette colour, then overprints a chain of triangles (same colour) along its length so the
     line looks like a row of joined triangles;
  4. offscreen `aux` is filled white and 1-4 random words from `{trash, amor, hola, viejo, modern,
     happy}` are drawn in black 100 px type (42-52). `aux` is **never drawn to screen** — it is only
     used as a pixel mask;
  5. 200 000 tiny triangles (size 1-8, alpha 120, random rotation, random palette colour) are placed at
     random positions, kept only where `aux.get(x,y) == black`, i.e. outside the letter shapes (53-62).
     The words therefore act as negative space in the scatter.
- `forma()` (93-101) is the only shape primitive: a regular n-gon (always 3 sides here).
- **Why the image is almost empty:** `result.json` reports a runtime error
  `triangulitos.pde:100:0: NullPointerException` (line 100 is `endShape(CLOSE)`). `generar()` runs on a
  background thread while the PApplet render loop keeps running on the main thread, and both touch the
  same shared renderer — a thread-safety race that kills generation a few triangles in. Only the first
  row of the first `grilla` pass survives to frame 1. This is not seed-dependent: a different seed would
  change which triangles survive, not whether the crash happens.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic, library-worthy: `forma` (regular n-gon); `grilla` (jittered triangular tiling of a rectangle
  with a per-cell colour callback); `linea` (a line re-drawn as a chain of shapes along its axis);
  `Paleta` (colour list + random pick); the scatter-with-mask pattern (step 5): scatter N small shapes,
  keeping only those whose position is "black" in an offscreen mask — here the mask is text, but the
  pattern works with any drawn shape as negative space.
- One-off art decisions: the Spanish/English word list, the specific 5 hex colours, the alpha 120, the
  counts (8 grilla passes, 1-50 lines, 200 000 scatter points), the 100 px type size.
- A clean parameter object would be: `{passes, tamRange, lineCount, lineSpacingRange,
  strokeWidthRange, scatterCount, scatterSizeRange, scatterAlpha, palette, words, typeSize}`.
- Critical portability bug for any library port: generation must not run on a background thread against
  the live renderer (the `endShape` NPE above). Run `generar()` synchronously, or draw into a dedicated
  `PGraphics` with `beginDraw()`/`endDraw()` and blit it once.
