---
sketch: 2018/Generativos/hori02
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1485
animated: false
techniques: [grid, lines-hatching]
primitives: [rect]
palette:
  colors: ["#1D1923", "#BBC0AC", "#5A8590", "#C3A651", "#8C3503"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "0-199 (int(random(200)*random(0.3,1)))", tried: [300], change: large, effect: "300 bands cover the whole canvas; mustard gaps disappear"}
  - {name: maxBandHeightFrac, default: 0.1, tried: [0.4], change: moderate, effect: "same band positions, up to 4x thicker bands"}
  - {name: maxStripes, default: 120, tried: [30], change: moderate, effect: "fewer, wider stripes; chunkier bands"}
  - {name: bandBaseMix, default: "random(0.2,1)", tried: ["random(0.5,1)"], change: none, effect: "no visible change; per-stripe lerp dominates the band base"}
  - {name: stripeMix, default: "random(1)", tried: ["random(0.4)"], change: none, effect: "no visible change at this seed"}
reusable_candidates:
  - {name: stripeBand, signature: "stripeBand(y, height, cells, baseColor, palette, mixIn) -> void", note: "one full-width band of adjacent vertical rectangles, each colour lerped between a band base colour and a random palette entry"}
  - {name: paletteLerp, signature: "paletteLerp(colors, v) -> int", note: "lerp between two adjacent palette entries by continuous index v (getColor, lines 67-73)"}
---

## What it draws
A flat mustard-gold field (seed 42) crossed by four or five horizontal bands of
thin vertical stripes running the full width of the canvas. The bands range
from a thick ~60px ribbon (upper third) down to hairline slivers near the
bottom edge. Each stripe is a small rectangle in muted olive, dusty teal,
brown, rust, or near-black; the band's colour drifts slowly along the strip
with occasional darker blocks. Large empty mustard regions separate the bands.

## How the code works
`settings()` (hori02.pde:6-12) makes a 960x960 P3D canvas, `scale(SCALE)` with SCALE=1. `setup()` calls `generate()` (lines 14-16); `draw()` is empty, so the piece is static.

`generate()` (lines 30-51):
- `randomSeed`/`noiseSeed(seed)` (34-35) — noise is seeded but never used.
- Background is one random palette entry: `background(rcol())` (36) — mustard
  #C3A651 for seed 42.
- `cc = int(random(200)*random(0.3, 1))` (39) → 0–199 bands, expected ~90;
  seed 42 produced only a handful of visible ones (heights overlap and most
  are tiny or same-colour as background).
- Per band (40-50): `y = random(sheight)` (42) places it anywhere;
  `h = sheight*random(1)*random(0.1)` (41) caps height at 10% of the canvas
  with a triangular (double-random) distribution, so most bands are thin.
  Base colour `col = lerpColor(rcol(), getColor(), random(1)*random(0.2,1))`
  (43) mixes two random palette entries.
  `sub = int(random(120))` (44) → 0–119 vertical cells; `ss = swidth/sub` (45)
  is the stripe width. Inner loop (46-49) fills each cell with
  `lerpColor(col, getColor(), random(1))` (47) — a fresh lerp of the band base
  towards another palette colour per stripe — and draws `rect(ss*j, y, ss, h)`
  (48): adjacent full-height stripes of width `ss`, together forming one band.
- `getColor(float)` (67-73) treats the 5-entry palette as a circular gradient:
  lerps between `colors[int(v)]` and `colors[int(v)+1 mod 5]`.

Randomness enters at: band count (39), band y (42), band height (41), band base
colour (43), stripe count (44), per-stripe colour (47), background (36).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_300 | `int cc = int(random(200)*random(0.3, 1));` -> `int cc = 300;` | large | canvas densely covered by ~30 stacked bands top to bottom, no mustard gaps | variants/cc_300/frame_00001.png |
| h_0.4 | `float h = sheight*random(1)*random(0.1);` -> `...random(0.4);` | moderate | same band positions, bands much thicker (up to ~40% of canvas height) | variants/h_0.4/frame_00001.png |
| sub_30 | `int sub = int(random(120));` -> `int sub = int(random(30));` | moderate | same bands/heights, stripes far fewer and wider — chunky blocks instead of fine lines | variants/sub_30/frame_00001.png |
| colmix_0.5 | `int col = lerpColor(rcol(), getColor(), random(1)*random(0.2, 1));` -> `...random(0.5, 1));` | none | no visible change | variants/colmix_0.5/frame_00001.png |
| stripecol_0.4 | `fill(lerpColor(col, getColor(), random(1)));` -> `fill(lerpColor(col, getColor(), random(0.4)));` | none | no visible change | variants/stripecol_0.4/frame_00001.png |

## Modularisation notes
The whole image is one generic primitive: **stripeBand** — draw `cells`
adjacent rectangles across the full width at `y` with height `h`, each filled
by lerping a band base colour toward a random palette entry. The outer loop
that scatters bands at random y/height is a second generic function
(scatterBands(count, maxHFrac, palette)). The `getColor` circular-palette
lerp is a small reusable helper on its own. One-off art decisions: the 5-colour
muted palette, the `random(1)*random(0.1)` triangular height bias, the
`random(0.2, 1)` band-base mix amount, and using P3D (only for `smooth`/
antialiasing — the piece is 2D and would render identically in JAVA2D). A clean
parameter object: `{palette, bandCount, maxBandHeightFrac, minStripes, maxStripes, stripeMix, background}`.
