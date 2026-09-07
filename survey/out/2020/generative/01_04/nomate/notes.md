---
sketch: 2020/generative/01_04/nomate
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1624
animated: false
techniques: [grid, particles, noise-field, shader, blend-modes]
primitives: [pgraphics, shape]
palette:
  colors: ["#4E87C5", "#BA8FE7", "#F76A0B"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: grid, default: 60, tried: [30], change: moderate, effect: "finer grid also halves ring sizes (s scales with grid): finer, busier, more fully covered texture"}
  - {name: count (loop bound), default: 400, tried: [100], change: large, effect: "sparser field, more black background, individual rings stand out"}
  - {name: alp (ring alpha max), default: 190, tried: [60], change: moderate, effect: "fainter rings, more black visible, grainy speckle more pronounced"}
  - {name: s (size upper bound), default: "int(random(3, random(4, 16)))", tried: ["int(random(3, 8))"], change: moderate, effect: "no large open rings, finer uniform texture"}
  - {name: displace, default: "random(100) per shape", tried: [25], change: moderate, effect: "same density/palette; removing the per-shape random() call also shifts the random stream so layout differs; shared grain offset across shapes"}
  - {name: colors (palette), default: ["#4E87C5", "#BA8FE7", "#F76A0B"], tried: [["#F72C11", "#12315E", "#FCFAEF"]], change: large, effect: "red / dark-navy / off-white; brighter, higher contrast, white rings read as highlights"}
reusable_candidates:
  - {name: ringBand, signature: "ringBand(x, y, rInner, rOuter, color, alpha, resolution) -> shape", note: "quad-strip annulus, inner half alpha, outer zero, for soft ring silhouettes"}
  - {name: gridJitterPlace, signature: "gridJitterPlace(w, h, grid) -> (x, y)", note: "random point snapped to a coarse grid (x -= x%grid)"}
---

## What it draws
A dense, full-bleed field of overlapping semi-transparent rings (annuli) on a black
background. Rings are blue, lavender-purple, or orange, with soft grainy alpha so that
overlapping regions produce petal-like interference moirés. Ring sizes range from small
dots to large open circles; their centers sit on a coarse grid, giving faint row/column
alignment in places.

## How the code works
`setup()` loads a fragment shader (`noiseShadowFrag.glsl`) and calls `generate()` once;
`draw()` is empty, so the image is static (nomate.pde:23-39). `generate()` (nomate.pde:49-91):

- Seeds random/noise from `seed`, paints `background(0)` (nomate.pde:51-54).
- Loops 400 times (nomate.pde:63): picks a random point, snaps it to a 60px grid
  (`x -= x%grid`, nomate.pde:68-69), sizes it with
  `s = int(random(3, random(4, 16)))*grid*0.5` (nomate.pde:70) giving diameters 90-450px,
  picks a color from the 3-colour list `rcol()` (nomate.pde:126-128), and draws
  `circle(x, y, s, s*2, col)` (nomate.pde:78). The else-branch (plain quad, nomate.pde:79-89)
  is dead code because `random(1) < 1` is always true.
- `circle()` (nomate.pde:94-114) builds a quad-strip annulus from inner radius `s*0.5`
  to outer radius `s`, with vertex alpha `190*random(1)` on the inner edge and 0 on the
  outer edge, so each ring fades outwards.
- The shader (nomate.pde:25,58-59,74-75; data/noiseShadowFrag.glsl:19-24) multiplies the
  per-pixel alpha by `1 + pow(hash(fragCoord + displace)*0.001, 1.2)`, i.e. a grainy
  1-2x alpha noise; `displace` is re-randomised per shape (nomate.pde:74), which offsets
  each ring's grain pattern and is what gives the soft, speckled, shadowy texture.
- Colour is a plain per-shape pick from {#4E87C5, #BA8FE7, #F76A0B} (nomate.pde:124);
  blending is ordinary alpha compositing in P3D, producing the moiré overlaps.
- Note: baseline `result.json` has `uses_shader: true` but `display: ":2"` (X server,
  not xvfb), so the shader rendered for real here.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_30 | `int grid = 60;` -> `int grid = 30;` | moderate (mean 0.1221, 0.556 of pixels) | same palette and density but visibly finer: ring sizes halve (size formula scales with grid) and placement is on a 30px grid, giving a busier, more fully-covered texture | variants/grid_30/frame_00001.png |
| count_100 | `for (int i = 0; i < 400; i++) {` -> `... i < 100 ...` | large (mean 0.1519, 0.677 of pixels) | clearly sparser: much more black background shows through, rings are more separated and the large open circles read individually | variants/count_100/frame_00001.png |
| alpha_60 | `float alp = 190*random(1);` -> `float alp = 60*random(1);` | moderate (mean 0.0781, 0.259 of pixels) | rings noticeably fainter, more black background, and the shader's grain speckle stands out more against the low base alpha | variants/alpha_60/frame_00001.png |
| s_8 | `float s = int(random(3, random(4, 16)))*grid*0.5;` -> `int(random(3, 8))*grid*0.5` | moderate (mean 0.0975, 0.433 of pixels) | no large open rings (max diameter 240 instead of 450); texture is finer and more uniform, moiré petals smaller | variants/s_8/frame_00001.png |
| displace_25 | `noi.set("displace", random(100));` -> `noi.set("displace", 25);` (both occurrences) | moderate (mean 0.097, 0.447 of pixels) | same palette and density; all shapes now share one grain offset, and dropping the per-shape random() call shifts the random stream so the layout itself differs from baseline | variants/displace_25/frame_00001.png |
| palette_alt | `int colors[] = {#4E87C5, #BA8FE7, #F76A0B};` -> `int colors[] = {#F72C11, #12315E, #FCFAEF};` | large (mean 0.2361, 0.889 of pixels) | red / dark-navy / off-white instead of blue/lavender/orange; overall brighter and higher-contrast, off-white rings act as highlights | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic: `gridJitterPlace` (snap-to-grid placement), `ringBand` (alpha-faded quad-strip
  annulus), the 3-colour random palette pick, and the per-pixel alpha-grain shader (a
  reusable "soften" post-shader parameterised by grain scale + offset).
- One-off: the exact size formula `int(random(3, random(4, 16)))*grid*0.5` (nested random
  makes sizes skew small), the dead quad branch, the fixed 400-shape count, and the
  black background.
- Clean parameter object: `{count, grid, sizeRange, palette, alphaMax, grainScale,
  grainOffset, background}`.
