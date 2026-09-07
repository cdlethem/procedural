---
sketch: 2018/Generativos/pesis
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1582
animated: false
techniques: [subdivision, grid, dots-stippling]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#F35A00", "#FD9800", "#00777F", "#703F3B"]
  selection: lerp-between
composition: margins
parameters:
  - {name: sub, default: "random(4,80)", tried: [120], change: large, effect: "far finer, denser mosaic; many small cells, dense clusters in the top-right"}
  - {name: cc, default: "random(8,18)", tried: [24], change: moderate, effect: "finer, denser dot grid; dots smaller and more tightly packed"}
  - {name: amp, default: "random(0.2,0.4)", tried: [0.6], change: large, effect: "much bigger dots and halos; cells become a strong perforated/stippled texture"}
  - {name: triProb, default: 0.8, tried: [0.3], change: large, effect: "fewer half-cell triangles; skipped random(4) calls shift the RNG stream, so colors/dots resample too"}
  - {name: circleProb, default: 0.2, tried: [0.8], change: moderate, effect: "circles now visible in most cells, varying in size; RNG stream shift recolours some overlays"}
  - {name: palette, default: "F35A00,FD9800,00777F,703F3B", tried: ["264653,2A9D8F,E9C46A,936639"], change: large, effect: "identical structure, cool slate/teal/yellow/brown instead of warm orange/teal/brown"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(x, y, w, h, iterations, minSize) -> Rect[]", note: "stochastic rectangle subdivision: repeatedly split a random rect by random fractions (lines 48-60)"}
  - {name: gridDots, signature: "gridDots(x, y, w, h, spacing, amp) -> void", note: "noise-modulated dot grid with white halo + dark center (lines 142-162)"}
  - {name: bevelRect, signature: "bevelRect(x, y, w, h, bevel) -> shape", note: "8-vertex rect with cut corners (lines 164-175)"}
  - {name: rectToTri, signature: "rectToTri(x, y, w, h, dir) -> shape", note: "half-rect triangle in 4 orientations (lines 177-200)"}
  - {name: gradientQuad, signature: "gradientQuad(x, y, w, h, c1, a1, c2, a2, axis) -> shape", note: "two-triangle pseudo-gradient (lines 121-140)"}
---

## What it draws
A full-bleed mosaic of irregular rectangles (a Mondrian/Bauhaus-style subdivision of the canvas) separated by thin black gaps, with a 10px black border. Each cell is filled with a flat color from a 4-color palette of vermilion, amber, teal, and dark brown, and is overlaid with a grid of small dark dots with pale halos whose sizes vary smoothly (noise). Most cells also contain a large flat-color triangle covering one half; some contain a small solid circle; a few contain a stack of thin horizontal bars. Soft low-alpha color washes (vertical + horizontal gradients) sit under the dots, giving cells a slight tonal drift.

## How the code works
`setup()` (pesis.pde:5) sets size 960x960 P2D and calls `generate()` once; `draw()` is empty, so the piece is static. `generate()` (line 39) seeds the RNG with the harness seed, clears to black, and builds a list of `Rect` starting from the inset border rect (10,10,w-20,h-20, line 46). The subdivision loop (lines 48-60) runs `sub = int(random(4,80))` times: pick a random rect, split it at random fractions `mw, mh` in (0.2, 0.8) into 4 child rects, replacing the parent (skipped if the rect is smaller than 40px). This is the main randomness that sets the mosaic's granularity.

Each surviving rect (lines 64-110) is drawn as: a beveled-corner rect (`rectb`, bevel 3, line 71) filled by `getColor()`, which lerps between two adjacent palette colors (lines 236-242); with 80% chance a half-rect triangle `rectToTri` in a random of 4 orientations (line 77); with 10% chance a stack of 1-11 thin horizontal bars with a dark offset copy (lines 78-93); with 20% chance a small solid circle with a dark offset shadow (lines 95-103). Then two pseudo-gradients `gradV`/`gradH` (lines 105-106) draw two triangles each with random palette colors at alpha ~30, and `gridDots` (line 109) overlays a dot grid with spacing `min(w,h)/cc` for `cc = int(random(8,18))` (line 108): each dot is a white-alpha-40 halo ellipse sized by `noise(des + pos*det)` times `amp = random(0.2,0.4)`, plus a fixed dark center (lines 150-161). Palette is the 4-color array at line 229 (`#F35A00 #FD9800 #00777F #703F3B`); `rcol()` picks uniformly (line 230). The commented-out `post.glsl` shader (lines 10, 116-118) is inactive, so `uses_shader: true` in result.json is a source-level flag only; the image is plain P2D raster.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_120 | `int sub = int(random(4, 80));` -> `int sub = 120;` | large (mean 0.1774, 0.753 of pixels) | many more, much smaller cells; dense clusters of tiny rectangles, especially top-right; dot grid and triangles follow the smaller cells | variants/sub_120/frame_00001.png |
| cc_24 | `int cc = int(random(8, 18));` -> `int cc = 24;` | moderate (mean 0.1472, 0.611 of pixels) | finer, denser dot grid; dots smaller and more tightly packed, cells look more textured, less perforated | variants/cc_24/frame_00001.png |
| amp_0.6 | `float amp = random(0.2, 0.4);` -> `float amp = 0.6;` | large (mean 0.1603, 0.636 of pixels) | much bigger dots and halos; cells become a strong perforated/stippled texture, dots nearly touch | variants/amp_0.6/frame_00001.png |
| triProb_0.3 | `if(random(1) < 0.8) rectToTri(...)` -> `if(random(1) < 0.3) rectToTri(...)` | large (mean 0.1554, 0.72 of pixels) | fewer half-cell triangles; skipped `random(4)` calls shift the RNG stream, so cell colors/dots resample too — whole image recoloured, structure identical | variants/triProb_0.3/frame_00001.png |
| circleProb_0.8 | `if (random(1) < 0.2) {` -> `if (random(1) < 0.8) {` | moderate (mean 0.1486, 0.637 of pixels) | circles now visible in most cells, varying in size; RNG stream shift recolours some overlays | variants/circleProb_0.8/frame_00001.png |
| palette_cool | `int colors[] = {#F35A00, #FD9800, #00777F, #703F3B};` -> `int colors[] = {#264653, #2A9D8F, #E9C46A, #936639};` | large (mean 0.199, 0.847 of pixels) | identical structure/layout, warm palette replaced by cool slate-green/teal/yellow/brown; structure is palette-independent | variants/palette_cool/frame_00001.png |

## Modularisation notes
Generic, library-worthy: `subdivideRects` (stochastic quadtree-style subdivision with a min-size cutoff — the core composition generator), `gridDots` (noise-modulated stipple grid with halo), `bevelRect`, `rectToTri`, `gradientQuad`, and the lerp-adjacent-color palette sampler `getColor`. One-off art decisions: the specific 4-color palette, the 80%/10%/20% overlay probabilities, the 10px border and 1px cell gaps, the bar-stack motif (lines 78-93), and the `cc in (8,18)` dot density. A clean parameter object would be: `{border, gap, subdivisions, minCell, palette, dotDensity, dotAmp, triProb, circleProb, barProb, gradientAlpha}`.
