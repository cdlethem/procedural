---
sketch: 2018/Generativos/mountain
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1556
animated: false
techniques: [noise-field, grid, curves]
primitives: [point, line, rect, shape]
palette:
  colors: ["#1A1312", "#3C333B", "#A84257", "#D81D37", "#D81D6E"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 30, tried: [15, 60], change: moderate, effect: "band count; 15 = fewer/thicker chunky bands, 60 = many/thin fine bands"}
  - {name: det, default: "random(0.01)", tried: [0.001, 0.05], change: moderate, effect: "noise scale; lower = broader smoother undulations, higher = finer busier jagged ridges"}
  - {name: bandAlpha, default: 220, tried: [60], change: subtle, effect: "band fill opacity; 60 = far more transparent, reads as smooth dark->bright wavy gradient, less distinct banding"}
  - {name: palette, default: "5 dark-red/magenta", tried: ["6 varied warm/cool"], change: large, effect: "identical band structure, entirely different colors (mauve, orange, green, purple, yellow, blue)"}
reusable_candidates:
  - {name: noiseContour, signature: "noiseContour(y, x0, x1, detail, a0, a1) -> PVector[]", note: "walk a 1-D noise-driven contour left->right, recording points (lines 56-64)"}
  - {name: stackedNoiseBands, signature: "stackedNoiseBands(count, margin, palette, bandAlpha, haloAlpha)", note: "layer count filled wavy bands, each closed to bottom (solid) and top (faint) (lines 46-85)"}
---

## What it draws
A full-bleed stack of ~30 horizontal, gently wavy color bands layered top to bottom, dark maroon/brown at the top transitioning to bright red at the bottom. Each band has a softly undulating top edge (a noise-driven ridge) plus a faint horizontal center line, and a fine low-contrast dot grid is overlaid across the whole canvas. Dominant colors: dark maroon, muted magenta, and bright red.

## How the code works
- `setup()` calls `generate()` once; `draw()` is empty, so the sketch is static (baseline frames 1/10/60 are identical).
- `randomSeed`/`noiseSeed` from `seed` (mountain.pde:23-24); background is a random palette color (line 25).
- Fine point grid first: `cc*cg` = 300 cells, spacing `gs = width/300 ≈ 3.2px`, `point(i,j)` at `stroke(0,120)` (lines 27-39).
- `bb = 0` margin (line 31); a faint 1px border rect (line 43).
- Main loop over `cc = 30` rows, each band `ss` tall (lines 46-85). Per row a noise contour is walked: start at left on the band's center y, repeatedly set `ang = map(noise(lx*det, ly*det), 0,1, PI*1.5, PI*2.5)` (line 60), step by `(cos, sin)`, record `PVector` (lines 59-64). `det` starts at `random(0.01)` and random-walks ×(0.99–1.01) each row (line 58).
- Each contour is closed into a polygon twice: filled from the ridge down to the canvas bottom with `rcol()` alpha 220 (lines 67-75) — the visible band — and faintly (alpha 20) from the ridge up to the top (lines 76-84), giving each ridge a soft halo above it.
- Color: `rcol()` picks a random entry from the 5-color dark-red/magenta palette (lines 94-97). Background and every band are independent random picks, so the dark-top→bright-bottom gradient emerges from which colors landed where, not from a deliberate ramp.
- Thin horizontal center lines per band (`stroke 0,40`, weight 1, line 51).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_15 | `  int cc = 30;` -> `  int cc = 15;` | moderate | half as many, much thicker bands; bottom is a large bright red/magenta block | variants/cc_15/frame_00001.png |
| cc_60 | `  int cc = 30;` -> `  int cc = 60;` | moderate | twice as many, very thin bands; smooth dark top, fine layered stripes at bottom | variants/cc_60/frame_00001.png |
| det_0.001 | `  float det = random(0.01);` -> `  float det = 0.001;` | moderate | far lower noise scale; broad, smooth, wide undulations | variants/det_0.001/frame_00001.png |
| det_0.05 | `  float det = random(0.01);` -> `  float det = 0.05;` | moderate | higher noise scale; finer, busier, more jagged ridges | variants/det_0.05/frame_00001.png |
| bandAlpha_60 | `    fill(rcol(), 220);` -> `    fill(rcol(), 60);` | subtle | bands far more transparent; reads as a smooth dark->bright wavy gradient, less distinct banding | variants/bandAlpha_60/frame_00001.png |
| palette_varied | `int colors[] = {#1A1312, ...#D81D6E};` -> `{#D5D3D4, #CF78AF, #DA3E0F, #068146, #424BC5, #D5B307};` | large | identical band structure, entirely different colors (mauve, orange, green, purple, yellow, blue) | variants/palette_varied/frame_00001.png |

## Modularisation notes
- **Generic (library-ready):** `noiseContour` (the per-row walk, lines 56-64) and `stackedNoiseBands` (the band loop, lines 46-85) are reusable; `dotGrid(cellsX, cellsY, alpha)` is trivially generic (lines 35-39).
- **One-off art decisions:** the specific 5-color palette; the alpha 220 (solid bottom) / 20 (faint top) double-fill that creates each ridge's soft upper edge; the per-row `det` random-walk; the zero margin / thin border; the PI*1.5–PI*2.5 angle range (ridges biased upward).
- **Clean parameter object:** `{count, margin, noiseDetail, angleRange, bandAlpha, haloAlpha, dotGrid, palette}` — everything else is fixed.
