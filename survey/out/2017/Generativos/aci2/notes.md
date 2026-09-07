---
sketch: 2017/Generativos/aci2
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 553
animated: false
techniques: [noise-field, pixel-ops]
primitives: [pixels]
palette:
  colors: ["#000000", "#FFFFFF", "#FF7700", "#15FF4A", "#BBBBFF"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: det, default: "random(0.01)*random(1) (0-0.01)", tried: [0.0002], change: large, effect: "lower noise scale -> much larger, smoother concentric bands"}
  - {name: cc, default: "random(3)*random(1) (0-3)", tried: [0.5, 10], change: large, effect: "fewer palette wraps -> broad filled regions with thin outlines; more wraps -> busier, orange-dominated"}
  - {name: v1, default: "random(0.2)*random(1) (0-0.2)", tried: [1.0], change: large, effect: "larger d1/d2 amplitudes -> denser, higher-frequency wavy bands everywhere"}
  - {name: des, default: "random(1000) (0-1000)", tried: [0], change: large, effect: "noise offset 0 -> entirely different, much finer chaotic pattern, green/periwinkle dominated"}
reusable_candidates:
  - {name: interferenceField, signature: "interferenceField(noiseDetail, waveAmps, phases, palette, wrap) -> PImage", note: "per-pixel noise-gated cos/sin interference mapped through a wrapping lerp palette"}
  - {name: lerpPalette, signature: "lerpPalette(palette[], float v) -> int", note: "wrap v mod len, lerpColor between adjacent entries (aci2.pde:76-82)"}
---

## What it draws
Full-bleed pixel image of wavy psychedelic bands: large, smooth blobs of bright
green, orange and black on the left half, tightening into fine contour-like
rings on the right half. White and pale periwinkle appear as thin outlines
between the bands. No shapes, text, or strokes — pure per-pixel colour field.
Static (frames 10/60 identical to frame 1).

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static
(aci2.pde:3-10). `generate()` (25-70) does a double loop over every pixel
(57-69):

- `val = noise(des+i*det, des+j*det)` (59): 2-D Perlin noise with random scale
  `det` (53) and offset `des` (54) — the low-frequency layout of blobs.
- Four wave amplitudes `d1..d4` (37-45) are random pairs, lerped by `val`
  (60-63), so noise locally bends the wave frequencies.
- `xx = cos(i1+i*d1)+cos(i3+i*d3)`, `yy = sin(i2+j*d2)+cos(i4+i*d4)` (64-65):
  sums of two cos/sin waves each, with random phases `i1..i4` (48-51). Because
  the argument grows linearly with `i` (x), band frequency increases to the
  right — that is why the right side is much finer than the left.
- Colour: `getColor(ic + col*colors.length*cc)` (67, 76-82) walks a wrapping
  palette (72) — 8 slots, 4 of them black, plus white, orange `#FF7700`,
  green `#15FF4A`, periwinkle `#BBBBFF` — lerping between adjacent entries.
  `cc` (55) sets how many palette wraps the full 0..1 range spans; the
  black-heavy palette produces the black gaps between bands.
- Randomness: `randomSeed(seed)` (27); every parameter (amplitudes v1/v2,
  phases, det, des, cc, palette start ic) is drawn from the seeded stream.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_0.0002 | `float det = random(0.01)*random(1);` -> `float det = 0.0002;` | large | large, smooth concentric rings of green/orange/white/periwinkle on black; far bigger features than baseline | variants/det_0.0002/frame_00001.png |
| cc_0.5 | `float cc = random(3)*random(1);` -> `float cc = 0.5;` | large | broad filled regions (green, orange, grey, lavender) separated by thin contour lines; looks like a topographic map | variants/cc_0.5/frame_00001.png |
| cc_10 | `float cc = random(3)*random(1);` -> `float cc = 10;` | large | much busier; orange now dominates with green/grey/white/periwinkle patches and fine banding on the right | variants/cc_10/frame_00001.png |
| v1_1.0 | `float v1 = random(0.2)*random(1);` -> `float v1 = 1.0;` | large | fine, dense, high-frequency wavy bands across the whole canvas; left/right frequency asymmetry gone | variants/v1_1.0/frame_00001.png |
| des_0 | `float des = random(1000);` -> `float des = 0;` | large | completely different, extremely fine chaotic pattern; green and periwinkle dominate, no large smooth areas | variants/des_0/frame_00001.png |

## Modularisation notes
The generic core is `interferenceField`: per-pixel
`noise(x*det, y*det)` gating `cos`/`sin` wave pairs, product mapped to a
palette index, rendered with `set()`. Reusable as-is with parameters
`(noiseDetail, noiseOffset, amplitudes[4], phases[4], palette[], wraps,
paletteStart)`. One-off art decisions: the black-heavy 8-slot palette (4 of 8
slots are `#000000`), the specific 960×960 size, and the linear-in-x wave
arguments that create the left-smooth/right-fine asymmetry. A clean parameter
object: `{det, des, cc, v1, v2, palette, seed}`.
