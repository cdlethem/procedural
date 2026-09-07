---
sketch: 2020/generative/01_04/water
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1785
animated: false
techniques: [noise-field, image-source, distortion]
primitives: [image]
palette:
  colors: ["#6402F7", "#F7A4EF", "#F62C64", "#00DACA"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: iterations, default: 10000, tried: [3000], change: moderate, effect: "fewer stamps = sparser field, darker gaps between streaks"}
  - {name: noiseShift, default: 500, tried: [100], change: moderate, effect: "weaker x-displacement = broad bands disappear, uniform rain-like streaks"}
  - {name: shiftDetail, default: 0.01, tried: [0.003], change: moderate, effect: "coarser noise = very wide soft brightness bands, brighter overall"}
  - {name: tintAlpha, default: "random(255)*random(1)", tried: [255], change: moderate, effect: "opaque stamps = brighter denser field, thinner dark gaps"}
  - {name: brushScale, default: "random(16,24)*1.4", tried: ["random(24,32)*1.4"], change: moderate, effect: "larger stamps = thicker smeared streaks, less individual dab detail"}
reusable_candidates:
  - {name: noiseStampField, signature: "noiseStampField(imgs[], count, shiftAmt, shiftDetail, tintGray, tintAlpha) -> void", note: "scatter tinted brush stamps, horizontally displaced by a 1-D noise field"}
  - {name: verticalEnvelope, signature: "verticalEnvelope(y, height) -> float", note: "pow(abs(sin(y*TAU/height)), 0.7): 0 at top/bottom, 1 at centre, used to scale stamp size and height"}
---

## What it draws
A dark charcoal field of dense, nearly-vertical grey streaks, like rain or water running down a dark
window. The streaks are thin brush dabs, brighter and denser across the middle band of the canvas and
fading to near-black at the top and bottom edges. Broad vertical bands of brightness shift left and
right, with a few thin dark gaps; the overall tone is monochrome (black, dark grey, light grey) with
no visible colour.

## How the code works
`setup()` loads four grey brush PNGs (`brush/brush01..04.png`) and calls `generate()`; `draw()` is
empty, so the image is static (regenerated only on key press with a new seed).

`generate()` (lines 68-107) seeds `random`/`noise` with `seed`, fills `background(20)`, then loops
10,000 times (line 84):
- Position: uniform random `xx, yy` (lines 85-86); the x position is then displaced by
  `(noise(xx*0.01)*2-1)*500` (line 90) — a smooth 1-D noise field shifting stamps up to ±500 px
  horizontally. This is what creates the broad vertical bright/dark bands.
- Brush geometry: `ww = random(4,12)*0.8`, `hh = ww*random(0.1,0.3)*random(0.4,1.2)` (lines 87-89),
  i.e. a thin short rectangle; final image size is `ww*sca` by `hh*sca` with
  `sca = (3+random(1)) * random(16,24)*1.4 * amp` (lines 99-104).
- Envelope: `amp = pow(abs(sin(yy*TAU/height)), 0.7)` (line 98) is 0 at the top/bottom edges and 1
  at the vertical centre, and scales both stamp width/height — so the middle of the canvas gets
  bigger, denser, brighter streaks while the edges thin out.
- Rotation: `HALF_PI + (noise(desAng+xx*detAng, desAng+yy*detAng)*2-1)*0.1` (line 96) — vertical
  plus a small noise-driven tilt of about ±0.1 rad, giving the slight wobble in the streaks.
- Colour: `tint(random(random(120),255)*noise(xx*detCol, yy*detCol)*1.3, random(255)*random(1))`
  (line 93). The 2-argument `tint` is (gray, alpha), so every stamp is rendered in grayscale with a
  random transparency; the first argument is modulated by a low-frequency 2-D noise
  (`detCol = 0.002`), adding the slow brightness variation across the field. The `colors[]`
  palette (line 124) and `getCol()`/`getColor()` are dead code here (`getCol` call commented at
  line 92), and `forms.png`/`loadForms()` are also unused (line 103 always picks a brush since
  `random(1) < 1`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| iterations_3000 | `for(int i = 0; i < 10000; i++){` -> `... i < 3000 ...` | moderate | sparser field; more dark background visible between the streaks, same band structure | variants/iterations_3000/frame_00001.png |
| noiseShift_100 | `xx -= (noise(xx*0.01)*2-1)*500;` -> `... *100;` | moderate | broad bright/dark vertical bands largely disappear; streaks spread more evenly, uniform rain look | variants/noiseShift_100/frame_00001.png |
| shiftDetail_0.003 | `xx -= (noise(xx*0.01)*2-1)*500;` -> `noise(xx*0.003)...` | moderate | bands become much wider and softer; large-scale smooth brightness variation, brighter overall | variants/shiftDetail_0.003/frame_00001.png |
| tintAlpha_255 | `tint(..., random(255)*random(1));` -> `tint(..., 255);` | moderate | brighter, denser field; dark gaps thinner, more even coverage, less transparency mottling | variants/tintAlpha_255/frame_00001.png |
| brushScale_24_32 | `sca *= random(16, 24)*1.4;` -> `random(24, 32)*1.4;` | moderate | streaks thicker and more smeared; individual dabs blur together into continuous water-like bands | variants/brushScale_24_32/frame_00001.png |

## Modularisation notes
The generic core is `generate()`: a scatter of tinted brush images whose x-positions are warped by a
1-D noise field, with a sinusoidal vertical envelope on stamp size — this is a reusable
"noise-warped brush stamp field" (see `reusable_candidates`). Art-specific decisions: the particular
brush PNGs, the grayscale `(gray, alpha)` tint (the palette is defined but never used), the 10,000
iteration count, and the ±500 px shift amplitude. A clean parameter object would be:
`{count, brushSet, shiftAmount, shiftDetail, tintGrayRange, tintAlphaRange, scaleRange,
tiltAmount, envelopePower}`.
