---
sketch: 2018/Generativos/gradgrad
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1699
animated: false
techniques: [grid, blend-modes]
primitives: [shape]
palette:
  colors: ["#EF0483", "#009ADE", "#F8E909", "#FFFFFF", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: bandCount, default: 40, tried: [10], change: large, effect: "fewer, bolder bands; white ground shows through"}
  - {name: hhScale, default: 0.2, tried: [0.06], change: large, effect: "much thinner bands -> web of thin crossing colour stripes"}
  - {name: maxAlpha, default: 500, tried: [120], change: large, effect: "far more translucent -> washed-out pastel, low contrast"}
  - {name: cwMax, default: 130, tried: [30], change: subtle, effect: "no visible change at a glance; checker bands nearly identical (columns marginally coarser)"}
  - {name: gradProb, default: 0.5, tried: [0.9], change: moderate, effect: "most bands become smooth gradients, little checker dither left"}
reusable_candidates:
  - {name: gradientBand, signature: "gradientBand(x, y, angle, width, halfHeight, color, maxAlpha) -> void", note: "rotated full-width quad whose fill alpha ramps 0 -> maxAlpha across its height"}
  - {name: checkerBand, signature: "checkerBand(x, y, angle, width, halfHeight, color, maxAlpha, cols, rows) -> void", note: "checkerboard of quads ((j+k)%2==1) with alpha ramped 0 -> maxAlpha along rows"}
  - {name: bandField, signature: "bandField(count, palette, hhScale, maxAlpha, gradProb) -> void", note: "scatters rotated translucent bands, 50/50 gradient vs checker"}
---

## What it draws
Full-bleed abstract of many wide, rotated, translucent colour bands crossing at
different angles. Some bands are smooth vertical colour gradients (magenta-pink,
blue, yellow, black, white), others are checkered stripe textures that fade in
along the band's length. Overlaps multiply into dense multicoloured interference;
dominant hues are magenta-pink, yellow and blue over a light ground.

## How the code works
`setup()` (lines 2-7) sets 960x960 P2D, `smooth(8)`, then calls `generate()`;
`draw()` is empty so the piece is static (regeneration only via `keyPressed`,
lines 12-18). `generate()`:
- `background(rcol())` (line 21) picks a random palette colour as the ground.
- `diag = width*1.42` (line 24) makes each band much wider than the canvas so it
  always crosses full-bleed after rotation.
- Loop of 40 bands (line 25): random position (26-27), random rotation (28),
  half-height `hh = width*0.2*random(0.1, 1)` (line 29, up to ~384 px tall),
  one random palette colour per band (30), random alpha 0-500 (31).
- 50/50 (line 41):
  - solid band: one quad (42-49) whose top-edge vertices have alpha 0 and
    bottom-edge vertices alpha `alp` — P2D interpolates, giving a smooth
    gradient across the band's height;
  - checker band: grid of `cw` (6-130) x `ch` (6-30) cells (51-65) where only
    `(j+k)%2 == 1` cells are drawn, each cell a quad with alpha ramping from
    `a1` to `a2` (mapped 0 -> `alp` along k), giving a dithered band that
    fades in from the top edge.
- Randomness enters only through `seed` (line 1) and the `random()` calls above.
- No blend modes; the "blend" look is plain alpha compositing of up to 40
  translucent layers. Colour is one fixed 5-colour list, chosen per band by
  `rcol()` (lines 76-79); `getColor()` (80-88) is unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| bands_10 | `for (int i = 0; i < 40; i++) {` -> `for (int i = 0; i < 10; i++) {` | large | ~10 wide bold gradient/checker bands instead of a dense pile; lots of white ground visible | variants/bands_10/frame_00001.png |
| hh_0.06 | `float hh = width*0.2*random(0.1, 1);` -> `width*0.06*random(0.1, 1);` | large | bands shrink to thin slivers: a web of thin crossing coloured lines, checker bands become fine stripes; much lighter overall | variants/hh_0.06/frame_00001.png |
| alpha_120 | `float alp = random(500*random(1));` -> `random(120*random(1));` | large | everything translucent: pale pastel bands, white ground shows through, low-contrast washed-out look | variants/alpha_120/frame_00001.png |
| cwMax_30 | `int cw = int(random(6, 130));` -> `int(random(6, 30));` | subtle | no visible change at a glance; checker bands look nearly identical (columns marginally coarser) | variants/cwMax_30/frame_00001.png |
| gradProb_0.9 | `if (random(1) < 0.5) {` -> `if (random(1) < 0.9) {` | moderate | most bands are now smooth gradient wedges; only a few thin checker bands remain, dither texture greatly reduced | variants/gradProb_0.9/frame_00001.png |

## Modularisation notes
Generic and reusable: the two band primitives (`gradientBand`, `checkerBand`)
are pure drawing functions of (position, angle, size, colour, maxAlpha, grid
density) and the `bandField` scatter loop. Art decisions to parameterise: the
fixed 5-colour palette, 40 band count, 0.5 gradient/checker mix, the
`width*1.42` over-width, and the alpha ceiling of 500. A clean parameter object:
`{count, palette, hhScale, maxAlpha, gradProb, overWidth, checkerCols:[min,max],
checkerRows:[min,max]}`.
