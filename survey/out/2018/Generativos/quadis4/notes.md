---
sketch: 2018/Generativos/quadis4
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1643
animated: false
techniques: [grid, dots-stippling]
primitives: [rect]
palette:
  colors: ["#B14027", "#476086", "#659173", "#9293A2", "#262A2C", "#D38644"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 10000, tried: [2000], change: large, effect: "sparser: fewer tiles, more background and larger unbroken tiles visible"}
  - {name: sizeExponentRange, default: "random(4,11)", tried: ["random(4,7)"], change: moderate, effect: "only 4 size steps (60-15px): coarser mosaic, tiles read larger, stronger 3D relief"}
  - {name: shadowAlpha, default: 100, tried: [220], change: subtle, effect: "shadows visibly darker; image reads as colored tiles on a near-black field"}
  - {name: shadowDepth, default: "ss*random(1)", tried: ["ss*0.25"], change: large, effect: "removing the random() draw shifts the whole random stream: entirely different layout (same palette); shadows now uniform 1/4-tile depth"}
  - {name: paletteColor0, default: "#B14027", tried: ["#F2F2E8"], change: moderate, effect: "brick-red swapped for cream: noticeably lighter image, cream tiles scattered through"}
reusable_candidates:
  - {name: extrudedTile, signature: "extrudedTile(x, y, size, depth, fillColor, shadowAlpha)", note: "grid-aligned square + two semi-transparent black quads offset by (depth, depth) to fake an extruded/raised tile"}
  - {name: quadGridScatter, signature: "quadGridScatter(count, sizePowRange, palette, background)", note: "scatter count grid-aligned random-size quads over a random background"}
---

## What it draws
A full-bleed mosaic of flat colored squares in many sizes (from small flecks to tiles roughly a sixth of the canvas wide), in a muted palette of brick-red, slate-blue, sage-green, grey, near-black and orange. Every square carries a diagonal dark-grey shadow on its right and bottom edges, so the tiles read as slightly raised/relief blocks. The surface is dense and busy, with no visible background except small gaps where the random background color shows through.

## How the code works
`setup()` (lines 3-8) calls `generate()` once; `draw()` is empty, so the piece is static (frames 1/10/60 identical). `generate()` (lines 21-68):

- Line 22: background filled with a random palette color (`rcol()`).
- Lines 25-68: loop of 10000 tiles. Each tile picks a size `ss = width / 2^k` with `k` a random int in 4..10 (line 26), so sizes are 60, 30, 15, 7.5, ... px. Position is snapped to its own size grid via `x -= x%ss` (lines 29-30), which makes same-size tiles tessellate exactly.
- Line 32: `dd = ss*random(1)` is the extrusion depth (0..ss).
- Two `beginShape` quads (lines 43-59) are filled black with alpha 100: the right-edge quad spans from the square's right edge to `x+ss+dd`, and the bottom-edge quad from the bottom edge to `y+ss+dd`; together they draw the diagonal shadow that gives the tile its raised look. The commented-out block (lines 34-41) shows a left/top shadow variant the author dropped.
- Lines 61-67: the top square is drawn last, filled with `rcol()` — a color chosen uniformly at random from the 6-entry `colors[]` array (line 77). `getColor` (lines 81-87) lerps between adjacent palette entries but is never called; `shuffleArray` (lines 89-96) is also unused.
- Randomness enters via `random()` for the seed (line 1), size, position, depth and color. No noise, no transforms beyond the offset quads, no blend modes; P2D renderer with `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_2000 | `for (int i = 0; i < 10000; i++)` -> `for (int i = 0; i < 2000; i++)` | large (mean 0.2253, 0.82 of pixels) | sparser mosaic: fewer overdraws, larger unbroken tiles, more of the random background showing in gaps; same colors and tile style | variants/count_2000/frame_00001.png |
| sizeExponent_4_7 | `float ss = width/pow(2, int(random(4, 11)));` -> `... random(4, 7) ...` | moderate (mean 0.1393, 0.555 of pixels) | only size steps 60/30/15/7.5px remain: coarser, chunkier mosaic, big tiles dominate, extruded relief reads stronger; no fine speckle | variants/sizeExponent_4_7/frame_00001.png |
| shadowAlpha_220 | `fill(0, 100);` -> `fill(0, 220);` (both quads) | subtle (mean 0.0495, 0.25 of pixels) | subtle per score, but the shadow quads are clearly darker: tiles float on a much darker, near-black field; layout unchanged | variants/shadowAlpha_220/frame_00001.png |
| shadowDepth_0.25 | `float dd = ss*random(1);` -> `float dd = ss*0.25;` | large (mean 0.215, 0.825 of pixels) | different mosaic layout, not just thinner shadows: replacing the random draw with a constant shifts the RNG stream, so sizes/positions/colors all differ; shadows are now a uniform 1/4-tile diagonal | variants/shadowDepth_0.25/frame_00001.png |
| palette0_cream | `#B14027` -> `#F2F2E8` in `colors[]` | moderate (mean 0.0864, 0.172 of pixels) | brick-red tiles replaced by cream/off-white ones (about 1/6 of tiles, matching the 17% pixel fraction); overall lighter, warmer image | variants/palette0_cream/frame_00001.png |

## Modularisation notes
- Generic: the "extruded tile" primitive (square + two alpha-100 black offset quads, depth parameter `dd`) is self-contained and reusable; the grid-snap (`x -= x%ss`) + power-of-two size ladder is a clean, portable generator pattern.
- One-off art decisions: the specific 6-color palette, the choice to draw shadow on right/bottom only (the commented block shows the author iterating on which corners), 10000 tiles, random background.
- A clean parameter object would hold: `count`, `sizePowMin`/`sizePowMax`, `shadowAlpha`, `depthFraction` (replacing `ss*random(1)`), `palette`, `background`, and which edges get shadows.
- Caution for reuse: the sketch's look is coupled to the RNG stream — removing or reordering `random()` calls reshuffles the entire composition (see shadowDepth_0.25). A library version should draw explicit per-tile seeds instead of relying on stream order.
