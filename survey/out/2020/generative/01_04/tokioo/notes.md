---
sketch: 2020/generative/01_04/tokioo
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 3489
animated: false
techniques: [subdivision, grid, noise-field, 3d-mesh]
primitives: [shape, rect]
palette:
  colors: ["#00FF6F", "#FF002C", "#FFE74A", "#FF6EEC", "#222C4B"]
  selection: noise-driven
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: mondrianSubdivide, signature: "mondrianSubdivide(rects, iterations, minSplit, maxSplit) -> Rect[]", note: "repeatedly split a random rect at 40-60% along its longer axis"}
  - {name: noiseLerpPalette, signature: "noiseLerpPalette(palette, x, y, scale) -> color", note: "map 2-D noise to a lerp between adjacent palette entries"}
  - {name: additiveWindowGrid, signature: "additiveWindowGrid(w, h, cw, ch, palette, scale) -> void", note: "10x10 (configurable) grid of noise-coloured, random-alpha rects with ADD blending"}
---

## What it draws
A tilted, elevated 3D view of a dense city of dark navy slabs, full-bleed to all edges.
Each slab carries a glowing pixel-grid of "windows" in neon green, red, yellow and pink,
some grids chunky, some fine, many only partially lit. Depth falls away toward the top of
the frame; a few smaller slabs sit nested inside larger ones.

## How the code works
`setup()` calls `generate()` once (line 22); `draw()` is empty, so the image is static.
- Camera (58-75): `perspective` with `fov = PI/random(1.8, 2.1)` (~86-100 deg), then
  `rotateX(PI*random(0.19, 0.23))` (~34-41 deg) and `translate(0, -100, -200)` give the
  elevated, tilted viewpoint.
- Mondrian subdivision (77-103): four seed rects (a 2x2 grid with a -40 margin, lines
  78-82) are split `int(random(400, 600)*30)` = 12,000-18,000 times; each pass picks a
  random rect (weighted toward early ones, line 88) and splits it horizontally or
  vertically at 40-60% (lines 93-101). The final rects tile the canvas fully, which is why
  `background(rcol())` (line 67) is never visible - the dark navy seen in the gaps is the
  slab tops, `c1 = lerpColor(#222C4B, color(0), 0.3)` (line 163).
- Buildings (105-124, 127-156): each rect becomes a box via `cube()` (158-204) with height
  `hh = min(w,h)*random(random(0.6,1))` (line 128); its colour is noise-driven:
  `getColor(colors.length*noise(x*0.01, y*0.01)*2)` (lines 134-135), where `getColor` (255-261)
  lerps between adjacent palette entries. With probability 0.2 per pass (up to 4, lines
  111-121) a smaller nested "neon" building is added, whose body colour is forced to
  #222C4B (line 136).
- Windows (206-236): on each slab face, `grid()` draws a 10x10 grid of rects, each cell
  coloured by `getColor(noise(...)*colors.length*2)` (line 229) with alpha `random(255)`
  (line 230) under `blendMode(ADD)` (line 215); the whole grid gets a random offset/scale
  (lines 209-210) and optionally a half-cell stagger (lines 214-223). Two side grids are
  added per slab (lines 144-151).
- Palette (line 246): #00FF6F, #FF002C, #FFE74A, #ff6eec.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the Mondrian subdivision (line 87-103 loop) is self-contained and reusable with
  (rects, iterations, splitRange) parameters; `getColor` (255-261) is a clean
  noise-to-palette-lerp utility; `grid()` (206-236) is a reusable additive window/panel
  grid with---|---|---|
| (pending) | | | | |

## Modularisation notes (continued)
- One-off art decisions: the fixed camera tilt range (74), the -40 margin (77), the nested
  "neon" sub-buildings (111-121), the forced #222C4B body (163), the stagger in `grid()` (214-223).
- A clean parameter object: `{width, height, subCount, splitRange, heightScale, tiltRange, fovRange,
  gridRes, alphaMax, palette, staggerChance, neonChance}`.
