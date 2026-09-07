---
sketch: 2019/generativos/buibui002b
year: 2019
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1829
animated: false
techniques: [subdivision, grid, noise-field, packing, 3d-mesh, pixel-ops]
primitives: [point, ellipse, rect, line, shape]
palette:
  colors: ["#FFFFFF", "#B0E7FF", "#143585", "#5ACAA2", "#D08714", "#F98FC0"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: subs, default: "random(50,90)", tried: ["random(150,200)"], change: large, effect: "denser mosaic: many smaller cells, much more wireframe, more stripe/grid cells"}
  - {name: screenDetail (max), default: "random(0.002,0.005)*random(0.5,1)", tried: ["random(0.008,0.012)*random(0.5,1)"], change: moderate, effect: "finer in-screen noise: smaller blobs, grainier fills, more dot-grid cells"}
  - {name: pwr, default: "random(20)*random(1)", tried: ["random(0,2)*random(1)"], change: subtle, effect: "softer banding: smoother colour ramps inside screens, same layout and dominant colours"}
  - {name: screenFrac (rem), default: "rects.size()*0.8", tried: ["rects.size()*0.3"], change: large, effect: "far more plain/striped monitor blocks and empty black cells, few noise screens left"}
  - {name: colors, default: "pastel 6-colour list", tried: ["{#121B4B,#028594,#016C40,#FBAF34,#CF3B13,#E55E7F}"], change: large, effect: "darker, more saturated palette: orange/red/teal/green/deep blue replace pastel pink/blue"}
reusable_candidates:
  - {name: splitMosaic, signature: "splitMosaic(w, h, vSplits, hSplits, splitRange) -> Rect[]", note: "start from one rect, repeatedly split a random rect in half (vertical then horizontal) at a random ratio"}
  - {name: noiseScreen, signature: "noiseScreen(x, y, w, h, detail, pwr, palette, alpha) -> void", note: "3px pixel-grid of noise samples, quantised to ~20 levels via pow, ADD-blended 2-3px rects, colour lerp between adjacent palette entries"}
  - {name: packedCircles, signature: "packedCircles(attempts, maxR, overlap) -> PVector[]", note: "rejection-sampled non-overlapping circles with random size distribution"}
  - {name: paletteRamp, signature: "paletteRamp(colors, v) -> color", note: "lerp between adjacent palette entries at v mod length"}
---

## What it draws

A black canvas tiled edge-to-edge by a dense mosaic of rectangles, like a wall of monitors.
Each cell carries a different pastel generative fill: soft banded noise blobs (pink, mint
green, orange, periwinkle blue), horizontal or vertical stripe stacks, fine dot-grid textures,
and plain pastel blocks. Thin white wireframe outlines trace every cell. Large semi-transparent
circles in mint green, pink, light blue, orange and white float over the mosaic, each with a
small white dot at its centre, and tiny white specks are scattered over the black gaps like
stars.

## How the code works

`setup()` calls `generate()` once; `draw()` is empty, so the piece is a single static frame
(lines 19-30). `randomSeed`/`noiseSeed` come from `seed` (lines 52-53).

- Camera: `perspective(PI/3)` centred, then `translate(center)` + `scale(0.4)` (lines 59-63),
  so everything is drawn in a ~2.5x canvas coordinate space at z=0.
- Mosaic: one rect of 1.82x canvas (line 67) is split vertically into halves 11 times
  (lines 69-75), then subdivided horizontally `subs = int(random(50,90))` times at a random
  ratio `m1` in [0.2, 0.8] (lines 77-87), yielding a few hundred cell rects tiling the canvas.
- Star specks: 3000 white points, `stroke(255, random(200))`, weight 0.5-3, spread over 2x the
  canvas (lines 90-94).
- Circles: 400 attempts with overlap rejection (`dist < (s+c.z)*0.55`, line 104); sizes
  `random(980)*random(1)^2*random(0.5,1)` — a few large, many tiny (line 100). Drawn with
  `fill(rcol(), 240)` plus a 5%-size white centre dot (lines 112-119).
- Wireframe: every cell outlined with `stroke(255,180)`, `rectMode(CENTER)` (lines 122-131).
- Lights: ambient 240 + three directional lights tinting left red, right blue, bottom warm
  (lines 135-141).
- Screens: 80% of cells are drawn by `screen()` (lines 146-161); 30% are skipped (line 158).
  `screen()` (lines 294-340) paints a near-opaque black base rect, then at every 3px step
  samples 2-D noise with a noise-offset (domain warp, lines 321-323), multiplies by 20 and
  quantises with `(n-n%1)+pow(n%1, pwr)` (line 324), colours via `getColor(v)` which lerps
  between adjacent palette entries (lines 413-419), and stamps 2px/3px rects in `ADD` blend
  (lines 314-336). The `pwr` up to 20 flattens the fractional part, producing the banded,
  contour-like pastel fills; low-frequency `detail` gives the big blobs, high detail gives the
  fine dot grids.
- Monitors: the remaining ~20% of cells (lines 163-237) are 3-D "monitor" blocks: white
  backing box, a coloured box, then `cc = int(random(4,18))` horizontal slice boxes in a
  pastel `col` (lines 193-207) — the striped blocks in the image; stands/grids are mostly
  commented out or very low alpha (lines 210-265).
- Z-order: circles are drawn before the screens but all geometry sits at z=0 in P3D, and in
  the rendered image the circles clearly float over the noise fills (depth-test tie-break).
- Final 8 vertical black bars (lines 275-289) are nearly invisible against the black ground.

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| subs_150 | `int subs = int(random(50, 90));` -> `int subs = int(random(150, 200));` | large | denser mosaic of smaller cells; wireframe outline much busier; more tiny stripe/grid cells; circles unchanged | variants/subs_150/frame_00001.png |
| noiseMax_0.01 | `float max = random(0.002, 0.005)*random(0.5, 1);` -> `float max = random(0.008, 0.012)*random(0.5, 1);` | moderate | noise fills grainier with smaller colour blobs; large smooth blobs break into fine bands; several cells read as dot grids; layout identical | variants/noiseMax_0.01/frame_00001.png |
| pwr_2 | `float pwr = random(20)*random(1);` -> `float pwr = random(0, 2)*random(1);` | subtle | no visible change at a glance; on close look the banded contours inside screens are softer, colour ramps smoother, banding less stepped | variants/pwr_2/frame_00001.png |
| screenFrac_0.3 | `int rem = int(rects.size()*0.8);` -> `int rem = int(rects.size()*0.3);` | large | most noise screens replaced by plain pastel blocks, horizontal stripe stacks, grid-textured cells and empty black cells; only a handful of noisy fills remain | variants/screenFrac_0.3/frame_00001.png |
| palette_dark | `int colors[] = {#ffffff, #B0E7FF, #143585, #5ACAA2, #D08714, #F98FC0};` -> `int colors[] = {#121B4B, #028594, #016C40, #FBAF34, #CF3B13, #E55E7F};` | large | whole piece recoloured darker and more saturated: orange/red/teal/green/deep blue replace pastel pink/mint/periwinkle; white circles and specks unchanged | variants/palette_dark/frame_00001.png |

## Modularisation notes

- **Generic**: the mosaic splitter (lines 66-87), `noiseScreen` (294-340), `packedCircles`
  (96-119), `paletteRamp` (413-419), and the star-speck scatter (90-94) are each self-contained
  and reusable as library functions with the signatures above.
- **One-off art decisions**: the specific 6-colour pastel list, the 0.8 screens/0.2 monitors
  split, the 30% screen skip, the monitor slice look (lines 193-207), the 3-light rig, and the
  1.82x over-canvas root rect.
- **Clean parameter object**: `{seed, size, vSplits, hSplits, splitRange, starCount,
  circleAttempts, circleOverlap, screenFrac, screenSkip, detailRange, pwrRange, palette,
  lights}` — everything else (camera, light rig) can stay fixed.
