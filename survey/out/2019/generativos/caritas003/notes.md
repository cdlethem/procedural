---
sketch: 2019/generativos/caritas003
year: 2019
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3252
animated: false
techniques: [subdivision, grid, curves, noise-field]
primitives: [ellipse, arc, line]
palette:
  colors: ["#320399", "#E07AFF", "#EA1026", "#FFD70F", "#E5E5E5"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub, default: 10, tried: [16], change: large, effect: "more subdivision iterations -> more, smaller nested faces in the central clusters; also re-seeds all face colours/hair because it shifts the downstream random draw order"}
  - {name: hairDensity, default: 0.5, tried: [2.0], change: moderate, effect: "4x more hair strands (cc multiplier, line 319) -> noticeably denser, bushier, more voluminous hair masses; layout/sizes unchanged"}
  - {name: palette, default: "#320399,#E07AFF,#EA1026,#FFD70F,#E5E5E5", tried: ["#043387,#0199DC,#BAD474,#FBE710,#FFE032"], change: moderate, effect: "swaps warm magenta/red/yellow for cool blue/teal/green/yellow/grey; structure and face sizes identical"}
  - {name: faceScale, default: "0.84-0.92", tried: ["1.25-1.35"], change: large, effect: "faces ~1.3x their cell (sca, line 186) -> fill and overlap the black gaps, much denser and more crowded, neighbours touch"}
  - {name: eyeSize, default: "0.2/0.18", tried: ["0.4/0.36"], change: moderate, effect: "eyes ~2x wider (ew, line 278) -> large bulging white eyeballs with big coloured irises/pupils"}
reusable_candidates:
  - {name: quadtree, signature: "quadtree(x, y, w, h, splits) -> Rect[]", note: "randomized recursive rect subdivision into 4 quarter-sized children"}
  - {name: face, signature: "face(cx, cy, w, h, palette) -> void", note: "procedural cartoon bust: hair strands + head ellipse + eyes + nose + mouth + shoulders arc"}
  - {name: hairStrands, signature: "hairStrands(cx, cy, w, h, wind, gravity, palette) -> void", note: "wind/gravity-steered random-walk stroke polylines forming fuzzy combed hair"}
  - {name: getColor, signature: "getColor(index) -> color", note: "lerps between adjacent palette entries by fractional index (noise-driven for hair)"}
---

## What it draws
A black canvas tiled with a recursive grid of cartoonish little faces (caritas). Each
face is a colourful head — magenta, purple, yellow, red or silver — with a fuzzy,
multi-toned mass of combed hair, two white eyes with coloured irises, a tiny dark nose,
a small mouth, and rounded shoulders. Large faces fill the four corner quadrants, while
the central quadrants contain clusters of progressively smaller nested faces, reading as
a fractal mosaic of bust portraits on black.

## How the code works
`setup()` calls `generate()` (caritas003.pde:21). Canvas is 960×960 P2D, `background(0)`,
translated to centre (line 56).

1. **Structure (quadtree).** An `ArrayList<Rect>` starts as the full canvas (line 59).
   The loop at line 63 runs `sub` times (10): each pass picks a random rect (line 64),
   and if it is at least 4×4 (line 66) it is replaced by four children, each 0.5w × 0.5h,
   at the four quarter positions (lines 67-71). This randomized quadtree yields ~31 rects
   of mixed size after 10 splits — big ones that were split few times, tiny ones split
   many — which is why large faces sit in the corners and small clusters nest in the middle.

2. **Face per rect (`tipitos` block, lines 180-364).** For every rect: `pushMatrix`,
   scale the face to 0.84-0.92 of its cell and anchor near the bottom (lines 185-189).
   A palette index `ic` (line 191) seeds the hair colour.
   - **Hair** (two passes, top at lines 200-235 and face-framing at lines 308-359): each
     pass draws `cc` short stroked polylines (`beginShape`/`vertex`/`endShape`). Each strand
     starts on an ellipse and then random-walks its angle, lerping each step toward a shared
     wind `viento` and downward `HALF_PI` (gravity) — producing the fuzzy combed look.
     Strand colour is `getColor(ic + noise(j*200+k*det)*ac)` — noise-lerped along the palette.
   - **Body**: half-ellipse `arc` at the bottom (line 243), a random palette colour.
   - **Head**: large `ellipse` (line 250) in a palette colour, with a faint dark ellipse
     shadow on top (line 246).
   - **Nose**: two tiny dark ellipses / nostrils (lines 275-276).
   - **Eyes**: `eye()` (lines 291-292, fn at 387) — white ellipse, a hair-coloured brow `arc`,
     a coloured iris, a black pupil, and a white highlight dot.
   - **Mouth**: white `arc`s (lines 298, 301-302).

3. **Colour.** `getColor(float)` (line 440) interpolates between adjacent palette entries by
   fractional index; `rcol()` (line 434) picks a random palette entry. Every colour in the
   piece is therefore a lerp along the 5-colour palette. The `ep`/`ep2` point-scatters
   (stippling) only run when `shw` is true, which it is not, so they contribute nothing.

All randomness is gated by `randomSeed(seed)` (line 52); with a fixed seed the image is
fully deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_16 | `sub = 10;` -> `sub = 16;` | large | more, smaller nested faces in the central clusters; also re-seeds all face colours/hair (top row shifts to blue-green-yellow) | variants/sub_16/frame_00001.png |
| hairDensity_2 | `random(1.1, 1.4)*0.5` -> `random(1.1, 1.4)*2` | moderate | noticeably denser, bushier, more voluminous hair masses covering more of each head; face layout and sizes unchanged | variants/hairDensity_2/frame_00001.png |
| palette_cool | `int colors[] = {#320399, #E07AFF, #EA1026, #FFD70F, #E5E5E5};` -> `{#043387, #0199DC, #BAD474, #FBE710, #FFE032}` | moderate | whole piece in cool blue/teal/green/yellow/grey; no magenta/pink/red; structure and face sizes identical to baseline | variants/palette_cool/frame_00001.png |
| faceScale_1.3 | `float sca = random(0.84, 0.92);` -> `random(1.25, 1.35);` | large | faces ~1.3x their cell, filling and overlapping the black gaps; much denser and more crowded, neighbours touch and partly overlap | variants/faceScale_1.3/frame_00001.png |
| eyeSize_0.4 | `float ew = random(0.2, 0.18)*...` -> `random(0.4, 0.36)*...` | moderate | eyes ~2x wider: large bulging white eyeballs with big coloured irises/pupils, some reaching the face edges; rest of face unchanged | variants/eyeSize_0.4/frame_00001.png |

## Modularisation notes
- **Generic / reusable:** the randomized quadtree (lines 58-72) is a clean, art-independent
  recursive-subdivision function — a natural library primitive. The `getColor` palette-lerp
  (line 440) is a small reusable colour helper. The face-drawing block (180-364) is a
  self-contained `face(rect, palette)` that could be extracted verbatim, parameterised by
  a single palette array plus per-face randoms.
- **One-off art decisions:** the specific 5-colour palette (line 433), the wind/gravity
  hair-steering constants, the exact eye/nose/mouth proportions, and the "anchor near the
  bottom + 0.84-0.92 scale" bust framing are all taste choices.
- **Clean parameter object** would hold: `splits` (quadtree depth), `cellFill` (0.84-0.92
  face scale), `hairDensity` (the `cc` multiplier), `hairLength` (`lar`), `hairWind`/
  `hairGravity`, `palette[]`, `eyeScale`, and a `seed`. The `back`/`shw` boolean flags and
  the dead commented palette lines are dead weight to drop.
