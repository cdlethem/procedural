---
sketch: 2020/generative/05_08/chicos
year: 2020
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1764
animated: false
techniques: [polar, grid, curves, pixel-ops, blend-modes]
primitives: [shape, ellipse, pixels, image]
palette:
  colors: ["#07001C", "#2E0091", "#E2A218", "#D61406", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "random(60,100)*2 (120-200)", tried: ["random(60,100)*6 (360-600)"], change: moderate, effect: "finer, denser red/white ray stripes; central pile and silhouette pixel-identical (fan loop draws no random)"}
  - {name: ar, default: "random(0.25,0.5)", tried: [1.0], change: large, effect: "wedges become contiguous -> solid white field, red ray-burst gone; removing the ar() draw shifts the whole random stream so silhouette and all clusters re-roll"}
  - {name: k_black, default: 30, tried: [90], change: large, effect: "60 extra black clusters over a wider vertical drift (many off-canvas); stream shift re-rolls colour pile, centre clusters and grain; rays unchanged"}
  - {name: cc_colour, default: "random(10,30)", tried: ["random(10,60)"], change: large, effect: "colour-pile polygons up to 60 vertices: bigger, busier shapes; re-rolls centre clusters and grain speckle; rays and black silhouette unchanged"}
  - {name: tintAlpha, default: 130, tried: [40], change: moderate, effect: "stronger ADD re-blend: same composition, brighter and more saturated with heavier grain glow"}
reusable_candidates:
  - {name: rayFan, signature: "rayFan(cx, cy, radius, wedges, gapRatio) -> void", note: "triangular fan from a center with angular gaps, over a solid background (chicos.pde:56-70)"}
  - {name: gridSnappedCluster, signature: "gridSnappedCluster(anchor, spread, count, vertexCount, gridSizes[]) -> void", note: "small closed curve() polygons whose vertices snap to random grid sizes (chicos.pde:85-100, 115-128, 153-166)"}
  - {name: grainPass, signature: "grainPass(img, gammaRGB, gains, lerpAmounts[]) -> PImage", note: "per-channel gamma/gain plus repeated lerp toward random grey, brightness-weighted (chicos.pde:172-190)"}
---

## What it draws
Full-bleed radial burst of red and white wedge-shaped rays emanating from the center, with a black jagged silhouette across the top. Over the center sits a dense pile of flat translucent polygons in dark blue, orange, yellow, pink and white, partly over a large flat blue rectangle; a few faint grey/white circles are scattered through it. The whole surface carries a heavy salt-and-pepper grain that lifts the highlights.

## How the code works
`setup()` calls `generate()` once (chicos.pde:21-28); `draw()` is empty (30-32), so the piece is static.
- **Ray fan (56-70):** background is one random palette colour (here red, `rcol()`, line 52). A `TRIANGLES` fan of `sub = random(60,100)*2` (120-200) white wedges goes from the center out to `width*sqrt(2)/2`; each wedge spans `da*ar` of the `TAU/sub` step with `ar = random(0.25, 0.5)`, so the red background shows through the gaps as the rays (58, 62-68).
- **Black clusters (75-101):** 30 clusters anchored at 64-px-grid points drifting upward with `k` (76-80). Each has `random(7,16)` closed 5-vertex `curve()` polygons, vertices snapped to 20/30/60-px grids (93-95); 95% filled black, 5% white (87-88) — the black spiky mass.
- **Colour clusters (105-129):** 40 larger clusters, same construction, but filled with `getColor(...)` — a lerp between adjacent palette entries (225-231) — producing the blue/orange/yellow/pink pile.
- **Central soft clusters (131-167):** 20 clusters pulled toward the center (`lerp` with up to 0.7, 135-136), each backed by two faint 128/96-px ellipses (141-146) and small 4/8/16-grid polygons — the translucent circles and the fine detail over the pile.
- **Grain pass (170-190):** the finished frame is copied to a `PImage`; per pixel, R/G/B get power curves (1.1/0.68/0.6) plus gain, then four `lerpColor` passes mix in random greys with brightness-weighted amounts — the dithered grain.
- **Final re-blend (193-196):** the processed image is drawn back over itself with `blendMode(ADD)` and `tint(255,130)`, brightening and re-saturating the grain.
Randomness enters only via `randomSeed(seed)` (49); palette is the fixed 5-colour list at line 206.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_6x | `int sub = int(random(60, 100)*2);` -> `int sub = int(random(60, 100)*6);` | moderate (0.1029, 24.2%) | rays become thin, dense stripes instead of broad wedges; central pile and black silhouette pixel-identical to baseline (verified by region diff: center 0.0) | variants/sub_6x/frame_00001.png |
| ar_1.0 | `float ar = random(0.25, 0.5);` -> `float ar = 1.0;` | large (0.3256, 74.9%) | contiguous wedges fill the whole canvas: the red ray-burst disappears into a solid white field; the dropped random draw also shifts the stream, so the silhouette and cluster pile are a new, denser composition | variants/ar_1.0/frame_00001.png |
| k30_90 | `for (int k = 0; k < 30; k++) {` -> `for (int k = 0; k < 90; k++) {` | large (0.2412, 60.1%) | far more black clusters, drifting over a much wider vertical band (many off-canvas); the extra draws shift the stream, re-rolling the colour pile, centre clusters and grain; coarse rays unchanged (corner diff 0.03) | variants/k30_90/frame_00001.png |
| cc_60 | `int cc = int(random(2, random(10, 30)));` -> `int cc = int(random(2, random(10, 60)));` | large (0.221, 55.8%) | colour-pile polygons get up to 60 vertices: larger, busier, more spiky shapes over the pile; stream shift re-rolls centre clusters and grain speckle; coarse rays and black silhouette unchanged | variants/cc_60/frame_00001.png |
| tint_40 | `tint(255, 130);` -> `tint(255, 40);` | moderate (0.081, 41.0%) | same composition; the weaker-tint ADD re-blend lifts brightness and saturation, giving a hotter, more glowing grain over the same rays and pile | variants/tint_40/frame_00001.png |

## Modularisation notes
Generic: the ray fan (polar wedge loop with a gap ratio), the grid-snapped curve-polygon cluster (anchor + spread + grid sizes + fill policy are all parameters), and the grain pass (per-channel gamma/gain + weighted random lerp). One-off art decisions: the specific cluster counts and the `k`-drift anchor formulae (76-77, 107, 135-136), the 95%-black fill rule, the chosen 5-colour palette, and the ADD re-blend with `tint(255,130)`. A clean parameter object would hold: `{wedges, gapRatio, clusters: [{count, spread, grid, fillPolicy}], grain: {gamma, lerpAmounts}, reblend: {mode, tintAlpha}, palette}`.
