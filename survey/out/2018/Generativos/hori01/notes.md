---
sketch: 2018/Generativos/hori01
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1449
animated: false
techniques: [grid]
primitives: [rect]
palette:
  colors: ["#1D1923", "#BBC0AC", "#5A8590", "#C3A651", "#8C3503"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(200))", tried: [400], change: large, effect: "more, denser bands; layout reshuffled (random draw removed), wide slate/rust/olive bands over gold"}
  - {name: maxH, default: "random(1)*random(0.1)", tried: ["random(1)*random(0.3)"], change: moderate, effect: "same stripe positions, 3x taller: canvas fully covered in a dense multicolour stripe texture, no background left"}
  - {name: palette, default: "[#1D1923, #BBC0AC, #5A8590, #C3A651, #8C3503]", tried: ["[#101820, #F4D35E, #EE964B, #F95738, #0D3B66]"], change: large, effect: "vermilion/orange dominant with dark navy, yellow and teal bands; structure unchanged, entirely new colour mood"}
  - {name: background, default: "rcol()", tried: ["#1D1923"], change: large, effect: "background recoloured dark; sparse thin bands (teal, rust, sage) read as lines on a flat ground instead of stripes on gold"}
  - {name: mix, default: "random(1)*random(0.2,1)", tried: [1.0], change: moderate, effect: "every stripe an exact adjacent-palette lerp: denser, more muted texture (slate/olive/navy/rust), no pure palette colours"}
reusable_candidates:
  - {name: randomBands, signature: "randomBands(count, maxFracH, palette, bg) -> void", note: "stack N full-width horizontal rectangles of random random-biased heights, colour lerped from the palette"}
---

## What it draws
A full-bleed field of horizontal stripes on a 960x960 canvas (seed 42). The dominant colour is
a mustard goldenrod, with a few full-width bands of slate blue, sage green, rust brown and a
dark brown stripe scattered vertically. Stripe widths vary from hairlines to a few dozen
pixels; there is no other structure. The image is static (frames 10 and 60 are identical to
frame 1).

## How the code works
- `settings()` (hori01.pde:6-12): 960x960 P3D window, `smooth(8)`.
- `setup()` (14-16) calls `generate()` once; `draw()` (18-19) is empty, so the sketch is
  static. `keyPressed` (21-27) regenerates with a new seed unless 's' saves the frame.
- `generate()` (30-47): `randomSeed(seed)`/`noiseSeed(seed)` (noise is seeded but never used),
  background filled with a random palette colour `rcol()` (57-59). Then a loop of
  `cc = int(random(200))` iterations: each draws one full-width rectangle `rect(0, y, swidth, h)`
  at a random `y`, with height `h = sheight*random(1)*random(0.1)` (product of two uniform
  randoms, so biased toward thin stripes, max 10% of canvas height).
- Colour per stripe (line 43): `lerpColor(rcol(), getColor(), random(1)*random(0.2, 1))` —
  lerp between a random palette colour and `getColor()`, which itself lerps between two
  adjacent palette entries (63-68). So every stripe is a mix of two palette colours, which is
  why the stripes read as muted/intermediate tints of the 5-colour palette
  (dark #1D1923, sage #BBC0AC, slate #5A8590, gold #C3A651, rust #8C3503).
- Randomness enters only via `random(...)` (line 39, 41, 42, 43, 58, 61); the render is
  deterministic for a fixed seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic block: the band-stacking loop (hori01.pde:39-46) is a self-contained
  "random horizontal bands" primitive — parameterise by count, height distribution
  (uniform vs product-of-uniforms), palette and background colour. This is the
  `randomBands` candidate above.
- One-off art decisions: the specific 5-colour palette (56), the background being a
  random palette pick (36), the thin-biased height law `random(1)*random(0.1)` (41),
  the double-lerp colour mixing (43, 63-68).
- A clean parameter object: `{count, maxFracH, heightLaw, palette[], background,
  mixStrength}` where mixStrength replaces the `random(1)*random(0.2,1)` lerp factor.
