---
sketch: 2018/Generativos/noisub/noisub005
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1626
animated: false
techniques: [subdivision, noise-field, grid]
primitives: [rect, shape]
palette:
  colors: ["#100A01", "#51247F", "#F5B424", "#F6F6F6"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: 3, tried: [6], change: large, effect: "finer starting 6x6 grid caps max tile at ~160 px; whole mosaic one size class finer"}
  - {name: sub, default: 1000000, tried: [200000], change: large, effect: "fewer subdivision passes: much larger tiles, smoother gradient look, far less fine dithering"}
  - {name: noiseDetail_falloff, default: 0.45, tried: [0.8], change: large, effect: "higher falloff adds high-frequency noise: subdivision gets finer and more dithered across the canvas"}
  - {name: alp, default: 200, tried: [255], change: none, effect: "no visible change - dead code: the computed alp (L138) is never passed to shadow(), which is called with literal alpha 20 (L140)"}
  - {name: colors, default: "#100A01,#51247F,#F5B424,#F6F6F6", tried: ["#02272D,#235F3F,#DAAC80,#FCC9D2"], change: moderate, effect: "identical mosaic structure recoloured: deep green and tan/peach dominant with pink and near-black teal accents"}
  - {name: detSizeX_mult, default: 0.8, tried: [0.4], change: large, effect: "smoother subdivision noise: larger, more coherent blobs of coarse vs fine regions"}
reusable_candidates:
  - {name: noiseSubdivide, signature: "noiseSubdivide(w, h, cells, iterations, minSizeNoise) -> Rect[]", note: "randomly re-split rectangles until they fall below a noise-driven local minimum size"}
  - {name: paletteNoiseColor, signature: "paletteNoiseColor(x, y, depth, palette, detail) -> color", note: "noise-sampled position+depth mapped onto palette with lerp between adjacent entries"}
  - {name: softShadow, signature: "softShadow(x, y, w, h, dir, col, alp) -> void", note: "two gradient quads fading to transparent along two adjacent edges, 4 directions"}
---

## What it draws
A full-bleed mosaic of axis-aligned squares in 4 sizes scales, from large (~320 px) down to a few pixels, tiling the whole 960×960 canvas. Dominant colours are gold/amber and deep purple, with off-white and near-black accents; tones are smoothly interpolated between neighbours in the palette. Some regions are coarse and some fine in a blob-like, noise-defined pattern (e.g. finely subdivided patches on the right). Every tile carries a soft directional shadow: a gradient from a darkened version of its own colour fading to transparent along two of its four edges, giving a beveled, softly-lit relief look.

## How the code works
- `setup()` (L3–9): `size(960, 960, P2D)`, `smooth(8)`, then a single `generate()`; `draw()` (L11–12) is empty, so the piece is static.
- `generate()` (L39): `randomSeed`/`noiseSeed` from `seed` (L41–42), `background(252)` (L44), `noiseDetail(2, 0.45)` (L45).
- Noise offsets and details are randomised per run (L47–56): `desSize*/detSize*` in ~0.0032–0.0048 (Y forced equal to X, L52–53) drive the subdivision threshold; `desDir/detDir` drive shadow direction.
- Initial grid: `cc = 3`, a 3×3 grid of 320×320 cells (L60–66).
- Subdivision loop (L68–93): 1,000,000 iterations; each picks a random rect (L70), samples noise at its centre (L76) and maps `pow(noiX,2)` to a minimum width `minW` in [2, ss] (L77, same for height L79–80). If the rect exceeds `minW`/`minH` it is split into 2 or 4 children (L82–91), otherwise it is re-inserted unchanged (L88–92). Cells therefore keep splitting until they are smaller than a noise-driven local minimum — the fine/coarse blob structure of the mosaic.
- Colour (L95–99, L249–268): per-rect `getColor` (L110) samples noise at `x*dd, y*dd` where `dd = det*sub*0.02` (L250), so deeper (smaller) rects sample a higher-frequency noise; the value is scaled by `colors.length` and `lerpColor` blends the two adjacent palette entries (L262–268). Palette (L255): `#100A01`, `#51247F`, `#F5B424`, `#F6F6F6`.
- Draw loop (L101–141): `noStroke()`; `type` is forced to 0 (L105) so only plain `rect`s are drawn — the triangle branches are commented out (L113–134). Shadow direction `shw = int(noise(...)*4)` (L136) picks one of 4 directions. `shadow()` (L144–227) draws two gradient quads per direction (fill `col,alp` → fill `col,0`) along two adjacent edges, with the shadow colour darkened 40% toward black. Note: `shadow()` is called with the **literal alpha 20** (L140), not the computed `alp = noise(...)*200` (L138) — that variable is dead code, which is why the `alp_255` variant is pixel-identical to the baseline.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_6 | `int cc = 3;` -> `int cc = 6;` | large | same style, one size class finer: no ~320 px tiles (max ~160 px); purple corner top-left, gold centre, fine dithered patch right | variants/cc_6/frame_00001.png |
| sub_200000 | `int sub = 1000000;` -> `int sub = 200000;` | large | much coarser: large tiles dominate, smooth gradient-like colour fields, only small fine patches | variants/sub_200000/frame_00001.png |
| noiseDetail_0.8 | `noiseDetail(2, 0.45);` -> `noiseDetail(2, 0.8);` | large | finer, more dithered subdivision everywhere; more small tiles, purple areas more broken up | variants/noiseDetail_0.8/frame_00001.png |
| alp_255 | `float alp = noise(desAlp+x*detAlp, desAlp+y*detAlp)*200;` -> `... *255;` | none | no visible change (pixel-identical): `alp` is dead code, `shadow()` receives the literal 20 (L140) | variants/alp_255/frame_00001.png |
| colors_alt | palette line -> `{#02272D, #235F3F, #DAAC80, #FCC9D2}` | moderate | structure unchanged; recoloured: deep green + tan/peach dominant, pink and near-black teal accents | variants/colors_alt/frame_00001.png |
| det_0.4 | `float detSizeX = random(0.004, 0.006)*0.8;` -> `... *0.4;` | large | smoother threshold noise: larger coherent blobs (big gold field lower-left, fine dithered gold upper-right) | variants/det_0.4/frame_00001.png |

## Modularisation notes
- Generic (library candidates): the noise-driven random subdivision (L68–93) is a self-contained "split rectangles until below a noise minimum" operator; the depth-aware noise-palette colour lookup (L249–268) and the 4-direction gradient shadow (L144–227) are both reusable as-is.
- One-off art decisions: the specific 4-colour palette (L255), the noise detail constants (`0.8`/`0.6`/`0.14` multipliers, L48–99), shadow spread `s1=0.2`/`s2=0.8` (L145–146), the forced `type = 0` (L105), and the hardcoded shadow alpha 20 (L140) that bypasses the intended noise-driven `alp` (L138) — a clean version should expose `shadow.alphaScale` as a real parameter.
- A clean parameter object: `{ seed, cells (cc), iterations (sub), noiseDetail: [octaves, falloff], subdivNoise: {offset, detail}, colorNoise: {offset, detail, depthScale}, shadow: {alphaScale, dirNoise: {offset, detail}, spread: [s1, s2]}, palette }`.
