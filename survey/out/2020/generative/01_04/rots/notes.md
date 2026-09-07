---
sketch: 2020/generative/01_04/rots
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1588
animated: false
techniques: [blend-modes]
primitives: [rect, shape]
palette:
  colors: ["#293473", "#eb302a", "#ffade0", "#FCFAEF", "#fcbf26"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: 80, tried: [200], change: large, effect: "denser: ~200 bars, busier central mass"}
  - {name: rotSteps, default: 16, tried: [4], change: large, effect: "coarser 45-degree angle steps (0/45/90/135)"}
  - {name: thinWProb, default: 0.8, tried: [0.3], change: moderate, effect: "fewer thin bars, more solid rects"}
  - {name: sizeRange, default: [0.1, 0.8], tried: [[0.4, 1.0]], change: moderate, effect: "bigger blocks"}
  - {name: bandAlpha, default: [120, 260], tried: [40, 90], change: moderate, effect: "fainter, more transparent band trails"}
reusable_candidates:
  - {name: rotatedRect, signature: "rotatedRect(x, y, w, h, angleStep, color, alpha) -> void", note: "a center-mode rect plus an alpha quad 'band' trail on one edge, at quantized rotation"}
---

## What it draws
A full-bleed abstract collage on a light grey ground. Dozens of flat rectangles and thin bars, rotated in 22.5-degree increments and biased toward the center, overlap in a 5-color palette: dark blue, red, pink, cream, and amber. The translucent fills blend where they cross, and each bar carries a fainter semi-transparent "band" hugging one edge, giving the flat shapes a layered, slightly offset depth.

## How the code works
`settings()` (lines 16-21) opens a P3D 960x960 window with `smooth(8)` and `pixelDensity(2)`. `setup()` (23-32) calls `generate()` once; `draw()` (34-36) is empty, so the piece is static (a key press regenerates with a new seed).

`generate()` (46-82) does all the work:
- `randomSeed(seed)` / `noiseSeed(seed)` (47-48), then `background(230)` light grey, `rectMode(CENTER)`, `noStroke()` (50-52).
- Loop over `cc = 80` shapes (53-54). Each iteration:
  - Random position `x`, `y` across the canvas (55-56), then pulled 0-50% toward the center via `lerp(x, width*0.5, random(0.5))` (57-58) — this is the center bias.
  - Width `w = width*random(0.1, 0.8)*2`, then with 80% probability shrunk 10x (`w *= 0.1`) to make a thin bar (59-60); height `h` identical logic (61-62). So most shapes are thin in at least one axis.
  - Per-iteration scale `sca = random(1)*pow(1 - i/cc, 0.2)` (63) — a slow decay, so early shapes (small `i`) are ~full size and later ones slightly smaller.
  - `pushMatrix()`; `translate(x, y)`; `rotate(int(random(16))*(HALF_PI*0.25))` quantizes rotation to 16 steps = 22.5-degree increments (66-68).
  - `fill(rcol())` (a random palette color) then `rect(0, 0, w, h)` (69-70).
  - A secondary quad (71-79): `beginShape()`, `fill(rcol(), random(120, 260))` at two vertices along the right edge of the rect, then `fill(rcol(), 0)` (transparent) extending out by `amp = random(4, random(6, 10))` — this draws the semi-transparent "band"/trail beside the bar, fading to transparent.
- `popMatrix()` (80).

Randomness enters at: position, the center-lerp amount, width/height, the thin-or-not coin flip, the per-iteration scale, the rotation step, the fill color, the band alpha, and `amp`. Colour is always a random draw from the fixed 5-color list (`rcol()`, 93-95, list at line 90). No blend mode is set explicitly; the "blending" visible in the image is just default alpha compositing of the translucent fills. (The `toxi`/`triangulate` imports are present but unused in this sketch.)

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_200 | `float cc = 80;` -> `float cc = 200;` | large | denser: ~200 overlapping bars/blocks, busier saturated central mass, more diagonal bars | variants/cc_200/frame_00001.png |
| rotSteps_4 | `rotate(int(random(16))*(HALF_PI*0.25));` -> `rotate(int(random(4))*(HALF_PI*0.5));` | large | coarser orientations (45-degree steps, not 22.5): bars snap to 0/45/90/135, so many 45-degree diagonals | variants/rotSteps_4/frame_00001.png |
| thinWProb_0.3 | `if (random(1) < 0.8) w *= 0.1;` -> `if (random(1) < 0.3) w *= 0.1;` | moderate | fewer thin bars; more solid fat rectangles and blocks | variants/thinWProb_0.3/frame_00001.png |
| sizeRange_0.4_1.0 | `float w = width*random(0.1, 0.8)*2;` -> `float w = width*random(0.4, 1.0)*2;` | moderate | bigger width range: fatter, fuller blocks, fewer thin slivers | variants/sizeRange_0.4_1.0/frame_00001.png |
| bandAlpha_40_90 | `fill(rcol(), random(120, 260));` -> `fill(rcol(), random(40, 90));` | moderate | band trails fainter/more transparent; softer, slightly more pastel; smallest change of the set | variants/bandAlpha_40_90/frame_00001.png |

## Modularisation notes
The reusable core is the per-shape routine: given a position, a size, a quantized angle, a palette color, and a band alpha, draw a center-mode `rect` plus an alpha quad "band" trail on one edge — `rotatedRect(x, y, w, h, angleStep, color, alpha)`. The size/decay logic (lines 59-65), the center bias (57-58), the count `cc`, the angle-step count (16), the thin-probability (0.8), and the palette (line 90) are the art-decision knobs and belong in a parameter object. The `amp`-driven band (71-79) is the distinctive one-off flourish; it reads as a layered echo of each bar. The `toxi`/`triangulate` imports are dead weight and should be dropped. A clean parameter object: `{count, sizeRange, thinProb, angleSteps, centerPull, decayExponent, bandAlphaRange, bandAmpRange, palette}`.
