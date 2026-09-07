---
sketch: 2019/generativos/orderLines
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1514
animated: false
techniques: [grid, noise-field, distortion]
primitives: [shape]
palette:
  colors: ["#0E1619", "#024AEE", "#FE86F0", "#FD4335", "#F4F4F4"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: sub, default: 40, tried: [8], change: none, effect: "8 slices instead of 40: no visible change, fade still smooth"}
  - {name: skipProb, default: 0.6, tried: [0.1], change: moderate, effect: "fewer empty cells; denser, longer continuous strips"}
  - {name: maxDist, default: 180, tried: [60], change: moderate, effect: "lower = straighter strips with gentler waves, torn edges mostly gone"}
  - {name: angDetail, default: "random(0.0001,0.0003)*10", tried: ["random(0.0001,0.0003)*30"], change: moderate, effect: "higher = local twisting; visible horizontal banding inside strips"}
  - {name: alphaExponent, default: 2, tried: [1], change: subtle, effect: "linear vs quadratic fade: nearly the same smooth downward fade"}
  - {name: palette, default: "#0E1619,#024AEE,#FE86F0,#FD4335,#F4F4F4", tried: ["#F5B4C4,#FCCE44,#EE723F,#77C9EC,#C5C4C4,#FFFFFF"], change: moderate, effect: "same layout; warm yellow/orange/peach/light-blue/gray instead of blue/pink/red"}
reusable_candidates:
  - {name: noiseDisplace, signature: "noiseDisplace(x, y, angSeed, angDetail, distSeed, distDetail, maxDist) -> PVector", note: "displace a point by angle + distance sampled from two 2-D simplex noise fields (def/vd, lines 123-132)"}
  - {name: paletteLerp, signature: "paletteLerp(colors[][], v) -> color", note: "lerp between adjacent palette entries indexed by scalar noise value (getColor(float), lines 154-160)"}
  - {name: fadingStrip, signature: "fadingStrip(x1, x2, yTop, yBot, slices, color) -> void", note: "vertical strip of quads with quadratic alpha fade from opaque top to transparent bottom (lines 100-113)"}
---

## What it draws
A deep blue (#08328B) field with sparse vertical strips of colour. Most strips are
blue, pink/magenta or red-orange, with occasional near-white and near-black patches.
Each strip is strongly opaque at its top and fades out toward its bottom, so the
composition reads as columns of light dissolving downward. The strip edges are wavy
and slightly torn because the grid corners are displaced by noise. Roughly 60% of
grid cells are empty, so the background shows through and the columns are broken
into short fragments.

## How the code works
`setup()` calls `generate()` (line 23); `draw()` is empty, so the sketch is static
(frames 10/60 identical to 1).

1. `randomSeed(seed)` / `noiseSeed(seed)` (lines 44-45); background `#08328B` (line 47).
2. A grid `cw = int(random(12,20)*1.2)` columns by `ch = int(random(10,20)*1.2)` rows
   (lines 86-87) spans 140% of the canvas (lines 91-92: from -20% to +120%), so
   strips run off all four edges.
3. Per cell (lines 93-95): 60% of cells are skipped (`random(1) < 0.6`), and the
   strip's top is offset down by `dy = int(random(3))` rows.
4. Each kept cell is split into `sub = 40` horizontal slices (line 96). Each slice is
   a quad drawn with `beginShape()`/`vertex()` (lines 105-112). The top slice has
   alpha 255 and alpha falls quadratically to 0 at the bottom of the cell
   (`pow(map(k,0,sub,1,0),2)*255`, lines 103-104) — that is the downward fade.
5. Every corner coordinate goes through `vd()` -> `def()` (lines 123-132): two
   2-D SimplexNoise fields, one giving an angle (line 124) and one a distance up to
   180 px (line 125), so `vertex()` receives a noise-displaced position. This
   produces the wavy, torn edges.
6. Colour is chosen once per cell (line 99): 2-D noise sampled at the cell's
   column/row position with fine detail (`detCol1`, `detCol2` ~ 0-0.001) feeds
   `getColor(float)` (lines 154-160), which lerps between adjacent entries of the
   5-colour palette `{#0E1619, #024AEE, #FE86F0, #FD4335, #F4F4F4}` (line 144).
   Adjacent cells often get adjacent palette colours, which is why the blue, pink
   and red bands cluster together.

Randomness enters via the grid size, the 60% cell skip, the `dy` offset, the noise
seed offsets (`desAng`, `desDes`, `desCol1/2`, lines 49-57) and the palette lerp
positions. No blend modes; plain `fill(col, alpha)` quads over the background.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_8 | `int sub = 40;` -> `int sub = 8;` | none | no visible change; the downward fade looks the same with 8 slices as with 40 | variants/sub_8/frame_00001.png |
| skip_0.1 | `if (random(1) < 0.6) continue;` -> `< 0.1` | moderate | much denser: fewer empty cells, longer continuous strips, more torn edges visible | variants/skip_0.1/frame_00001.png |
| maxDist_60 | `SimplexNoise.noise(desDes+x*detDes, desDes+y*detDes)*180;` -> `*60;` | moderate | strips nearly straight with only gentle waves; torn/chaotic edges mostly gone | variants/maxDist_60/frame_00001.png |
| angDetail_30 | `detAng = random(0.0001, 0.0003)*10;` -> `*30;` | moderate | strips twist locally; the 40 thin slices make the fast angle change read as horizontal banding inside each strip | variants/angDetail_30/frame_00001.png |
| alphaExp_1 | `pow(map(k, 0, sub, 1, 0), 2)*255;` -> `map(k, 0, sub, 1, 0)*255;` | subtle | nearly identical; fade still smooth downward, slightly different softness mid-strip | variants/alphaExp_1/frame_00001.png |
| palette_alt | `int colors[] = {#0E1619, #024AEE, #FE86F0, #FD4335, #F4F4F4};` -> `{#F5B4C4, #FCCE44, #EE723F, #77C9EC, #C5C4C4, #FFFFFF};` | moderate | same layout; yellow/orange/peach/light-blue/gray strips instead of blue/pink/red | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic, good library candidates: `def`/`vd` (noise-displaced vertex), `getColor`
  (palette lerp by scalar), and the alpha-faded strip loop. All three are pure
  functions of their parameters plus the noise seeds.
- One-off art decisions: the 60% skip probability, `dy` random row offset, the
  quadratic alpha curve, the 5-colour palette, and the 140% canvas overscan.
- A clean parameter object: `{cols, rows, skipProb, rowOffsetMax, slices,
  angleSeed, angleDetail, distSeed, distDetail, maxDist, colorSeed, colorDetail,
  palette[], alphaExponent, background}`.
