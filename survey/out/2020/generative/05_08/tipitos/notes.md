---
sketch: 2020/generative/05_08/tipitos
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1642
animated: false
techniques: [subdivision, noise-field]
primitives: [shape]
palette:
  colors: ["#18002E", "#001BCC", "#E6D4FC", "#F5F2F8", "#E73504", "#ACFF39", "#FFFFFF", "#000000"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: div, default: "random(20,800)", tried: [30], change: large, effect: "far fewer, much bigger figures; sparse layout, dense swarm confined to lower-right corner"}
  - {name: detCol, default: "random(0.001)", tried: [0.008], change: large, effect: "higher noise detail -> busier, more varied body colour (more salmon/pink/purple spread)"}
  - {name: background, default: "#ACFF39", tried: ["#101418"], change: large, effect: "only the field colour changes (lime -> near-black); all figures identical"}
  - {name: palette, default: "5-col cold set", tried: ["warm orange/red set"], change: moderate, effect: "bodies shift from cool purple/blue to warm orange/amber/red"}
  - {name: splitRatio, default: "random(0.4,0.6)", tried: ["random(0.2,0.8)"], change: large, effect: "more uneven splits -> wider range of figure sizes, lopsided irregular tiling"}
reusable_candidates:
  - {name: subdivideQuads, signature: "subdivideQuads(initialRect, iterations, splitRange) -> Rect[]", note: "iterative random quad splitting; parent kept, list grows +4 per split"}
  - {name: noisePaletteColor, signature: "noisePaletteColor(x, y, detail, scale, palette) -> color", note: "2-D noise value mapped across a palette with lerpColor easing"}
  - {name: blob, signature: "blob(x, y, w, h, mw, mh) -> void", note: "irregular two-tone polygon circle, radius flipped per quadrant"}
---

## What it draws
On a flat lime-green field sit clusters of small mushroom- or table-lamp-like figures. Each figure has a pale rounded cap, a bulbous body shaded light at the top and dark at the bottom, a small pale knob on top, and two thin black stems/legs. The figures live in a subdivided layout: a few large ones where few splits happened (upper-left), and a dense overlapping swarm of tiny ones (lower-right) where the quad splitting concentrated. Body colours are muted purples, blues and off-white with the occasional warm red-orange.

## How the code works
`setup()` calls `generate()` once (static; `draw()` also calls `generate()` but output is identical, so frames 10/60 are dropped as duplicates).

`generate()` (tipitos.pde:54) seeds random/noise with `seed` and fills the background `#ACFF39` (line 59). It builds an `ArrayList<Quad>` starting from one near-full-canvas quad (lines 61-62), then runs `div` iterations (lines 66-79): each picks a random existing quad and appends 4 sub-quads split at a random 40-60% of its width/height (lines 70-78). The parent quad is NOT removed (line 74 is commented out), so the list only grows (+4 per iteration) and later, smaller splits stack on top of the earlier, larger ones — which is what produces the dense overlapping clusters in heavily-picked regions. `detCol` (line 64) is a small random noise scale used to sample 2-D noise per quad centre.

The draw loop (lines 82-108) runs over every quad and composes a 4-part "tipito" figure:
- a white circle (lines 90-92) — the pale cap;
- a large colored body (lines 95-100) filled with `getColor(noise(cx*detCol, cy*detCol, sca)*5)` where `sca = sqrt(q.w*q.h*0.01)` (line 95) — the noise-driven palette colour;
- a small white knob at the top (lines 102-103);
- two thin black circles = the stems/legs (lines 105-107).

The `circle()` helper (lines 111-131) draws each "circle" as a many-vertex polygon. Its horizontal/vertical radius is flipped per quadrant using the random offsets `mw`/`mh` (lines 119-124), giving each blob an irregular asymmetric outline, and it shades the lower half with `lerpColor(color(0), g.fillColor, 0.98)` (line 125) to produce the darker bottom of each body.

`getColor(float)` (lines 153-158) maps a noise value across the 5-colour palette (line 144) by lerping between adjacent entries with a `pow(v%1, 0.6)` easing.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| div_30 | `int div = int(random(20, 800));` -> `int div = 30;` | large (mean 0.1913, 0.555 of px) | far fewer, much bigger figures; sparse layout with the dense swarm now confined to the lower-right corner | variants/div_30/frame_00001.png |
| detCol_0.008 | `float detCol = random(0.001);` -> `float detCol = 0.008;` | large (mean 0.2183, 0.639 of px) | busier, more varied body colour: more salmon/pink and purple spread across the bodies (higher noise detail) | variants/detCol_0.008/frame_00001.png |
| bg_101418 | `background(#ACFF39);` -> `background(#101418);` | large (mean 0.2101, 0.29 of px) | only the field changes (lime-green -> near-black navy); all figures identical in layout and colour | variants/bg_101418/frame_00001.png |
| palette_warm | `int colors[] = {#18002E, #001BCC, #E6D4FC, #F5F2F8, #E73504};` -> warm `{#FFF3B0, #FFC300, #FF8008, #E85D04, #B2130C}` | moderate (mean 0.123, 0.49 of px) | bodies shift from cool purple/blue to warm orange/amber/red; layout and lime background unchanged | variants/palette_warm/frame_00001.png |
| split_0.2_0.8 | `float mw1 = q.w*random(0.4, 0.6);` -> `float mw1 = q.w*random(0.2, 0.8);` | large (mean 0.1703, 0.488 of px) | more uneven splits -> a much wider range of figure sizes and a lopsided, irregular tiling | variants/split_0.2_0.8/frame_00001.png |

## Modularisation notes
Generic / library candidates:
- `subdivideQuads` — the iterative random quad split (input rect, iteration count, split-ratio range → growing list of rects) is a clean, reusable tiling primitive. Keeping the parent (accumulation) is the distinctive behaviour.
- `noisePaletteColor` — mapping a 2-D noise sample to a palette colour via lerp is directly reusable.
- `blob` — the irregular two-tone polygon (`circle` helper) is a reusable shape primitive.

One-off art decisions: the specific 4-part figure (cap + body + knob + two legs), the `hp = 1/7` proportions, the fixed lime-green background, and the particular 5-colour palette.

A clean parameter object would be: `{ canvasW, canvasH, margin, subdivideIterations, splitRange:[lo,hi], noiseDetail, palette:[...], figureScale (the hp multipliers), background }`.
