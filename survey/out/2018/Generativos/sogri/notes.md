---
sketch: 2018/Generativos/sogri
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1648
animated: false
techniques: [grid, noise-field]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#000000", "#0D0D52", "#401972", "#FF55A7", "#F59CD4", "#4CFDC6"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: grid, default: 60, tried: [30], change: moderate, effect: "fewer, much larger squares; coarser chunkier layout, faint cell grid more visible"}
  - {name: sizeAmp, default: 40, tried: [100], change: moderate, effect: "larger squares relative to canvas, fewer distinct ones, more open lighter background"}
  - {name: squareAlpha, default: "random(40,80)", tried: ["random(150,220)"], change: moderate, effect: "more opaque, bolder, less hazy squares; edges/outlines read more clearly"}
  - {name: backgroundLerp, default: 0.3, tried: [0.8], change: none, effect: "no visible change; background is masked by the stacked translucent squares"}
  - {name: bigSquareCount, default: 240, tried: [480], change: large, effect: "denser coverage, higher saturation, busier and bolder overlaps"}
reusable_candidates:
  - {name: softRect, signature: "softRect(x, y, w, h, col, alpha, spread) -> void", note: "a rect plus 4 gradient trapezoid 'shadow' halos bleeding off each side"}
  - {name: alphaGrainShader, signature: "shader(noi) with uniform displace -> grainy alpha", note: "noiseShadowFrag multiplies per-pixel alpha by 1+pow(hash(fragCoord*0.001+displace),0.8)"}
  - {name: noiseGridStroke, signature: "noiseGridStroke(cell, col, detail, alphaBase) -> void", note: "60x60 cell outlines whose alpha is noise()^2 modulated"}
---

## What it draws
A full-bleed 960x960 field of overlapping, translucent squares in deep purple,
magenta/pink, and teal/cyan, laid over a soft purple-grey ground. The squares range
from small to huge (some span most of the canvas) and stack with varying opacity so
their colours blend into one another. A fine film-grain noise covers the whole image,
and each square has a soft gradient "halo" bleeding off its edges plus a faint small
dot near its centre. The overall feel is hazy and atmospheric, like stacked coloured
glass with a grain of film.

## How the code works
`sogri.pde` is a single tab. `setup()` (lines 5-13) sets 960x960 P2D, `smooth(8)`,
`pixelDensity(2)`, loads the `noiseShadow` shader, and calls `generate()`; `draw()` is
empty, so the image is static (frames 10/60 are identical to 1).

`generate()` (line 26):
- Background (28-30): `lerpColor(white, random palette color, 0.3)` -> the soft tinted
  ground, not pure white.
- Seed (32-33): `noiseSeed`/`randomSeed = seed`.
- Shader (36-38): load shader, `set("displace", random(100))`, apply. The fragment
  shader (`noiseShadowFrag.glsl:19-23`) multiplies every fragment's alpha by
  `1 + pow(hash(gl_FragCoord*0.001 + displace), 0.8)` -> the per-pixel film-grain over
  the whole canvas.
- Grid pass (41-74): `grid = 60`, `gs = width/grid = 16`. `gc` = a random palette colour
  (re-rolled while it equals the background). For every 60x60 cell, a `rect` outline is
  stroked with alpha `120 * noise(alpDes+xx*alpDet, alpDes+yy*alpDet)^2` (line 54) -> a
  faint, noise-modulated grid of cell borders (the subtle texture under the squares).
- Big squares pass (80-153): loop `grid*4 = 240` times. Each iteration re-sets
  `displace=random(100)` and re-applies the shader, picks a grid-aligned origin
  `xx,yy = int(random(-1,grid+1))*gs` (85-86), samples `no = noise(ampDes+xx*ampDet,
  ampDes+yy*ampDet)`, and sizes the square `ww = hh = gs*int(4 + sizeAmp*no)` with
  `sizeAmp = 40` (88-90) -> squares from 4 to ~44 cells wide. `col = rcol()`,
  `alp = random(40,80)`, `bb = min(ww,hh)*random(1,random(3))` (91-93). It then draws:
  a rect outline `stroke(col,50)` with 80% probability (97-98); four gradient
  trapezoids (`beginShape` with `fill(col,alp)` -> `fill(col,0)`) forming a soft
  shadow/halo on top, left, bottom, right (104-150); and a small centre ellipse dot
  `ww*0.1 x hh*0.1` (152).

Colour is always a random pick from the 6-colour palette (`rcol()`, 200-202); the
palette is `#000000 #0D0D52 #401972 #FF55A7 #F59CD4 #4CFDC6` (198). No blend modes are
set (default OVER); the layering comes purely from low alpha values.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_30 | `int grid = 60;` -> `int grid = 30;` | moderate (mean 0.1362, 0.726) | fewer, much larger squares; a chunky layout of ~5 big squares (teal lower-left, magenta top-right, pink right column), bluer/pinker, faint cell grid more visible | variants/grid_30/frame_00001.png |
| sizeAmp_100 | `int sizeAmp = 40;` -> `int sizeAmp = 100;` | moderate (mean 0.08, 0.297) | squares grow larger relative to canvas, fewer distinct ones; a bright pink-outlined square dominates, more open lighter-pink background shows through | variants/sizeAmp_100/frame_00001.png |
| alp_150 | `float alp = random(40, 80)*1.;` -> `random(150, 220)*1.;` | moderate (mean 0.1214, 0.682) | squares are noticeably more opaque and saturated (bolder teal/pink/purple), less hazy; individual rect edges/outlines read more clearly | variants/alp_150/frame_00001.png |
| bg_0.8 | `int back = int(lerpColor(color(255), rcol(), 0.3));` -> `... 0.8));` | none (mean 0.0, 0.0) | no visible change; the stacked translucent squares cover the whole canvas and mask the background tint | variants/bg_0.8/frame_00001.png |
| count_8 | `i < grid*4; i++` -> `i < grid*8; i++` | large (mean 0.1596, 0.667) | twice as many squares: denser, busier, higher saturation; bold magenta field with teal and dark-blue squares, stronger overlaps | variants/count_8/frame_00001.png |

## Modularisation notes
Generic / reusable:
- `softRect` (lines 97-150): a filled rect plus four gradient trapezoid "shadow" halos
  that fade to alpha 0. This is a self-contained primitive that could be a library
  function `softRect(x, y, w, h, col, alpha, spread)`.
- `alphaGrainShader` (the two .glsl files): a drop-in post filter adding per-pixel
  grain to alpha, parameterised by `displace`. Reusable as a grain/noise filter.
- `noiseGridStroke` (lines 41-74): a noise-modulated grid of cell outlines; reusable as
  `noiseGridStroke(cell, col, detail, alphaBase)`.

One-off art decisions: the 6-colour palette, the 0.3 background lerp (which the
experiments show has no visible effect because the squares cover the ground), the 0.8
stroke-rect probability, the specific alpha ranges (`random(40,80)`, `random(80)`),
`sizeAmp = 40`, the `grid*4` count, and the noise detail constants (`alpDet`, `ampDet`).

A clean parameter object for this sketch:
`{ seed, grid, bigSquareCount, sizeAmp, squareAlpha:[lo,hi], shadowSpread,
strokeRectProbability, gridStrokeAlphaBase, gridNoiseDetail, backgroundLerp,
grainDisplace, palette: int[] }`.
