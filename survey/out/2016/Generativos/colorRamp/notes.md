---
sketch: 2016/Generativos/colorRamp
year: 2016
renderer: JAVA2D
size: [640, 640]
libraries: []
deterministic: true
ms_first_frame: 588
animated: false
techniques: [grid, noise-field, distortion, pixel-ops]
primitives: [line, ellipse, point, pixels, pgraphics]
palette:
  colors: ["#C93BDE", "#3FBFAE", "#FF8A5E", "#3F5BE8"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(1,92)*random(1); ~22 at seed 42", tried: [40], change: moderate, effect: "denser, smaller dots; the unchanged warp smears them into a fine marbled texture, dot grid barely legible"}
  - {name: det, default: "random(0.02)*random(1); gentle large-scale warp at seed 42", tried: [0.01], change: moderate, effect: "higher-frequency warp field; dots fully smeared into thick swirling bands"}
  - {name: dd, default: "random(2, random(10,600)); gentle warp at seed 42", tried: [40], change: moderate, effect: "larger displacement amplitude; dots torn into scattered specks over a more marbled ground"}
  - {name: r1, default: "random(1.4); even dots nearly fill cell at seed 42", tried: [0.7], change: moderate, effect: "even (large) dots shrink to ~0.7 of cell; checkerboard grid and saturated dot colours read more clearly, more background exposed"}
  - {name: dotAlpha, default: 240, tried: [120], change: subtle, effect: "dots become translucent, background bleeds through and colours look muted; geometry unchanged"}
reusable_candidates:
  - {name: colorRamp, signature: "colorRamp(stops: (color,pos)[]) -> (t in [0,1]) -> color", note: "4 random RGB stops, piecewise lerpColor between adjacent stops (getColor)"}
  - {name: noiseWarp, signature: "noiseWarp(img, det, dd) -> PImage", note: "per-pixel displacement: angle=noise(i*det,j*det)*TWO_PI, offset (cos,sin)*dd, bilinear sample via getSmooth (lines 74-81)"}
  - {name: getSmooth, signature: "getSmooth(PGraphics img, float x, float y) -> color", note: "bilinear pixel sampler with clamped coords (lines 91-99)"}
---

## What it draws
A 640x640 full-bleed field of soft-edged dots in a checkerboard of two sizes (large dots in
alternating cells, small dots in the others). The dot colours are sampled from a vertical
four-stop gradient (magenta/pink at the top, teal in the upper third, salmon/orange in the
middle, blue/periwinkle at the bottom); each dot gets a faint dark drop shadow offset
down-right. The whole picture is warped by a low-frequency noise field, so straight dot
rows and the gradient bands bend and swirl, and a fine white speckle grain is scattered
over the surface.

## How the code works
- `setup()` -> `generate()` once; `draw()` is empty, so the image is static (lines 3-9).
- `generateColors()` (139-152) builds a `ColorRamp` with four stops, each a fully random
  `color(random(255),random(255),random(255))` at positions 0, 1 and two random positions.
- `cr.show(0,0,width,height)` (line 18, impl 196-201) paints the ramp as a vertical
  gradient: one horizontal line per pixel row, coloured `getColor(i/w)`.
- A grid of `(cc+1)^2` circles (49-60): `cc` is random 1..91 (line 43), cell size `tt = width/cc`
  (44). Cell size alternates by checkerboard parity: even cells get radius factor `r1 = random(1.4)`
  (47), odd cells `r2 = random(0.5)` (48). Each dot: a black shadow ellipse with alpha
  `random(30)` offset by `d = random(1.2)` px (54-56), then the colour
  `cr.getColor(random(1))` at alpha 240 (57-58) — colour position is uniform random, so dot
  colours are uncorrelated with position.
- White speckle grain: per-pixel `point(i,j)` with white alpha `random(22)*random(1)`
  (62-67), repeated after the warp (83-88).
- The warp (69-81): the canvas is copied into a `PGraphics` buffer, then each pixel is
  re-sampled from the buffer at `(i+cos(a)*dd, j+sin(a)*dd)` where
  `a = noise(i*det, j*det)*TWO_PI`, `det = random(0.02)` (74) and
  `dd = random(2, random(10,600))` (75). `getSmooth` (91-99) does the bilinear sample.
  This is a per-pixel domain warp, which bends the dot rows and gradient bands.
- Randomness enters via: the four ramp colours, `cc`, `r1`, `r2`, per-dot colour position
  and shadow offset, `det`, `dd`, and the speckle alphas. Seeded, so deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_40 | `int cc = int(random(1, 92)*random(1));` -> `int cc = 40;` | moderate | dots smaller and denser; the same warp now smears them into a fine marbled texture with tiny speckles, the dot grid is barely legible | variants/cc_40/frame_00001.png |
| det_0.01 | `float det = random(0.02)*random(1);` -> `float det = 0.01;` | moderate | much stronger, higher-frequency warping; dots completely smeared into thick swirling contour bands, no dots left | variants/det_0.01/frame_00001.png |
| dd_40 | `float dd = random(2, random(10, 600));` -> `float dd = 40;` | moderate | larger displacement amplitude; dots torn apart into scattered small specks, background more heavily marbled | variants/dd_40/frame_00001.png |
| r1_0.7 | `float r1 = random(1.4);` -> `float r1 = 0.7;` | moderate | even (large) dots shrink to ~0.7 of the cell; the two-size checkerboard grid reads clearly with saturated dot colours and more exposed background | variants/r1_0.7/frame_00001.png |
| dotAlpha_120 | `fill(cr.getColor(random(1)), 240);` -> `fill(cr.getColor(random(1)), 120);` | subtle | no visible change in geometry; dots are translucent so the gradient bleeds through and colours look muted/grayed | variants/dotAlpha_120/frame_00001.png |

## Modularisation notes
- `ColorRamp` (163-201) is a clean, self-contained library function: a list of (color, pos)
  stops with insertion and piecewise-lerp lookup. Only the stop values are art decisions.
- `getSmooth` (91-99) is a generic bilinear pixel sampler — directly reusable.
- The warp loop (74-81) is a generic `noiseWarp(img, det, dd)` primitive: noise-driven
  angle field + constant-magnitude displacement + bilinear resample.
- One-off art decisions: checkerboard two-size dot grid, per-dot random ramp position,
  drop-shadow offset, white speckle grain, 4-stop random palette, the second speckle pass
  after the warp.
- A parameter object would be: `{rampStops: [c0,c1,c2,c3], cc, r1, r2, dotAlpha,
  shadowAlpha, shadowOffset, det, dd, grainAlpha}`.
