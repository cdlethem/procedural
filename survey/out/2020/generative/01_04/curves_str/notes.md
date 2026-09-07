---
sketch: 2020/generative/01_04/curves_str
year: 2020
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 2428
animated: false
techniques: [grid, noise-field, distortion, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#8A8DE2", "#F9C827", "#F2DEE4", "#0A1835"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: attractors, default: 20, tried: [5], change: large, effect: "fewer, larger, deeper dimples; most of the sheet left flat"}
  - {name: pointRadius, default: "random(60, 380)", tried: ["random(60, 650)"], change: large, effect: "dimples grow and overlap, distorting a much wider area of the weave"}
  - {name: sep, default: 10, tried: [20], change: large, effect: "checkerboard squares roughly double in size (coarser weave), same dimples"}
  - {name: stripHalfWidth, default: "random(0.6, 0.8)*12", tried: ["random(0.9, 1.2)*12"], change: moderate, effect: "thicker strips close the gaps between rows; weave reads denser, less black showing through"}
  - {name: detStr, default: "random(0.001)", tried: ["random(0.004)"], change: moderate, effect: "finer noise on strip width; square edges more irregular and bumpy"}
  - {name: palette, default: "[#8A8DE2, #F9C827, #F2DEE4, #0A1835]", tried: "[#04EDC2, #FFED93, #F9F9F9, #000000]"], change: moderate, effect: "same geometry, recoloured to teal/yellow/white/near-black"}
  - {name: radialPits, signature: "radialPits(points: {x,y,r}[], p, strength) -> {x,y}", note: "push a point away from any attractor inside its radius, falloff pow(1-d/r, 1.3), modulated by a per-vertex weight v"}
  - {name: lerpPalette, signature: "lerpPalette(colors: int[], t) -> int", note: "smooth wrap-around lerp between neighbouring palette entries, t = start + j*drift + stripParity"}
  - {name: wovenGrid, signature: "wovenGrid(sep, thickness, noiseDetail, zAmp, distort) -> QUAD_STRIP mesh", note: "vertical + horizontal quad strips per cell, width modulated by simplex noise, z = sin(phase)*ampD"}
---

## What it draws
A full-bleed woven checkerboard: a dense grid of small alternating squares in dark navy, periwinkle blue, cream, and yellow, interlaced like fabric. The sheet is warped in 3D by a handful of circular dimples (about four large ones and many smaller ones) where the weave is pulled inward, compressing the squares into tight rings and stretching the weave between the pits.

## How the code works
`generate()` (L46) clears to black, then seeds `randomSeed`/`noiseSeed` with `seed`. It scatters 20 attractor points, each `(random(width), random(height), r)` with `r = random(60, 380)` (L65-70). `flower(w/2, h/2, w)` (L72) is called once with the full canvas size; it shifts the origin by `-s*0.5` so the grid spans `0..s` (L88-89).

Per strip `i` of `cc = s/sep` (sep = 10, so ~96 strips, L92-93) two quad strips are drawn: a vertical one (L112-128) and a horizontal one (L130-146), each with `div = s*8 = 7680` tiny segments, so the two families overlap into a woven checkerboard. Each vertex position is first passed through `def(x, y, vv)` (L150), which pushes the vertex radially away from every attractor within its radius by `dis*pow(1-vv, 1.3)*v*1.4` (L159-160) — this is what makes the dimples; `vv = 1 - min(|u*2-1|, |v*2-1|)` (L116) is 1 at the grid centre and 0 at the edges, so the distortion is strongest mid-canvas.

Strip half-width `str` is modulated by 2-D simplex noise at scale `detStr = random(0.001)` (L91, L117-118): `str = (0.6+0.4*noi)*strr` with `strr = random(0.6, 0.8)*12` (L96) — that noise is what breaks the perfect squares into organic blobs. A tiny `z = sin(...)*ampD` (ampD = 0.1, L97, L121, L139) gives the P3D renderer enough depth to shade the weave. Colour is `fill(getColor(ic + j*dc + (i/2)%2), 250)` (L123, L141): `ic` a random palette start, `dc = random(0.003)` a slow drift along the 4-colour palette, and `(i/2)%2` flips the palette half per strip pair, producing the two-tone checker alternation; `getColor(float)` (L192) lerps between adjacent palette entries with `pow(frac, 0.8)`.

| attractors_5 | `for (int i = 0; i < 20; i++) {` -> `... i < 5; ...` | large (mean 0.2863, 0.819) | only ~5 dimples, each much larger and deeper; most of the sheet is flat, smoothly shaded weave | variants/attractors_5/frame_00001.png |
| ptrad_650 | `float ss = random(60, 380);` -> `float ss = random(60, 650);` | large (mean 0.2795, 0.768) | dimples are bigger and merge into wide deformed regions; checkerboard stretched across much of the canvas | variants/ptrad_650/frame_00001.png |
| sep_20 | `float sep = 10;` -> `float sep = 20;` | large (mean 0.2851, 0.714) | checkerboard squares roughly double in size; coarser weave, same dimple layout and colours | variants/sep_20/frame_00001.png |
| strr_thick | `float strr = random(0.6, 0.8)*12.0;` -> `random(0.9, 1.2)*12.0;` | moderate (mean 0.1025, 0.328) | thicker strips; gaps between rows nearly close, weave looks denser with less dark background | variants/strr_thick/frame_00001.png |
| detStr_0.004 | `float detStr = random(0.001);` -> `random(0.004);` | moderate (mean 0.0802, 0.274) | finer width noise; square edges more irregular and bumpy, texture busier | variants/detStr_0.004/frame_00001.png |
| palette_tea | `int colors[] = {#8A8DE2, #F9C827, #F2DEE4, #0A1835};` -> `{#04EDC2, #FFED93, #F9F9F9, #000000};` | moderate (mean 0.13, 0.505) | identical geometry recoloured: teal, pale yellow, white, near-black | variants/palette_tea/frame_00001.png |
|---|---|---|---|---|

## Modularisation notes
- Generic: `def()` radial-pit distortion (attractor list + power falloff + per-vertex weight), `getColor(float)` wrap-around palette lerp, the noise-modulated strip width, and the sin-phase z offset are all reusable with the signatures above.
- One-off art decisions: the 4-colour palette and its order, the 20-attractor scatter with `r = random(60, 380)`, the exact falloff exponent `1.3` and gain `1.4`, the `(i/2)%2` parity flip, `div = s*8` resolution (a quality knob, not a style choice).
- Clean parameter object: `{sep, stripHalfWidth, widthNoiseDetail, widthNoiseGain, zAmp, zPhase, attractors: [{x, y, r}], attractorGain, attractorFalloff, palette, paletteStart, paletteDrift, fillAlpha}`.
