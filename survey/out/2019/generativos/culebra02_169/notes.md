---
sketch: 2019/generativos/culebra02_169
year: 2019
renderer: P2D
size: [1920, 1080]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1657
animated: false
techniques: [grid, noise-field, particles, distortion, polar]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#EDFFFC", "#FFFF3D", "#F393FF", "#01CCCC", "#5967FF"]
  selection: random-from-list
composition: centered
parameters:
  - {name: grid, default: 80, tried: [40], change: large, effect: "half cell size: finer, denser grid; more and smaller solid colour squares; snake sizes unchanged (they scale with width/960, not grid)"}
  - {name: ddd, default: "random(50,250)", tried: ["random(100,500)"], change: subtle, effect: "a few snake trails become clearly longer (long yellow band, long squiggle); overall density similar"}
  - {name: snakeCount, default: "60*sca (=120)", tried: ["30*sca (=60)"], change: subtle, effect: "some trails missing; central cluster slightly sparser"}
  - {name: patchAlpha, default: "random(255)*random(1)", tried: ["random(100)*random(1)"], change: none, effect: "no visible change (patches mostly hidden under the snake cluster)"}
  - {name: dotFactor, default: 0.1, tried: [0.5], change: none, effect: "no visible change (grid dots are small and mostly covered)"}
  - {name: palette, default: "5-colour list", tried: ["6-colour alt list"], change: moderate, effect: "recolours the whole piece: orange, green, dark navy and mustard replace yellow/cyan/magenta candy colours"}
reusable_candidates:
  - {name: noiseDotGrid, signature: "noiseDotGrid(cell, detail, offset) -> draws", note: "grid of cells whose center dot size = cell*factor*noise(x,y)"}
  - {name: snakeTrail, signature: "snakeTrail(x, y, size, steps, oscVel, oscAmp, palette) -> draws", note: "column of ellipses offset by sin(j*vel)*amp, alpha fading toward tail, color lerping through a wrapping palette"}
  - {name: ring, signature: "ring(x, y, r1, r2, a1, a2, col, alp1, alp2) -> draws", note: "annular sector built from quad strips (local arc2)"}
  - {name: lerpWrap, signature: "lerpWrap(colors, v) -> color", note: "cyclic palette lookup: lerp between floor/neighbor colors with pow ramp"}
---

## What it draws
A bright, candy-colored collage on a pale mint background. A faint gray grid covers the canvas with a small dot in many cells; scattered translucent squares and diamond patches in yellow, cyan, violet, magenta and blue layer over it. The dominant feature is a dense central cluster of squiggly "snake" trails — columns of overlapping circles that sway side to side, plus rounded blobs, ring arcs and small dots. Colors are flat with soft alpha overlap; the composition is full-bleed but the mass of snakes is concentrated in the center.

## How the code works
`generate()` (culebra02_169.pde:47) runs once in `setup()`; `draw()` is a no-op (regeneration commented out, line 35), so the piece is static. Seeded with `randomSeed`/`noiseSeed` (51–52) after `background(240)` (54).

1. **Dot grid** (59–74): `grid = 80` px cells; each cell gets a stroked gray `rect` (63, 69) and a filled dot at center sized `grid*0.1*noise(des+x*det, ...)` (71–72) — the small speckled dots, sized by 2-D noise with detail `det = random(0.001)` and offset `des = random(1000)`.
2. **Patches** (79–103): `max(cw,ch)` (=24) random rectangles, width/height 1..12 cells, filled with two random palette colors at low alpha (`random(255)*random(1)`, 89–90) alternating per corner — the translucent squares/diamonds (the diamond look comes from the corner fill swap at 96/100).
3. **Second pass of cells** (105–145): per cell, a 4-vertex "arrow" quad with one half transparent (130–137), a near-invisible dark rect (140–142), and a solid palette `rect` (143–144) — most are hidden under the snakes, some visible at the edges.
4. **Snakes** (147–198): translate to center; `60*sca` (sca=2 → 120) agents at radius-biased random positions (151–152), snapped to the grid (155–156), rotated to a quadrant (160, 161). Each draws a base ellipse (164) + annular ring via local `arc2` (202–219), then a trail of `ddd` (50–250) ellipses (180–196) offset `sin(j*oscVel)*ss*oscAmp` (184), with `oscAmp` drifting by `modAmp` per step (182, 176) — the wavy snakes. Alpha fades out over the last 10% of the trail (192), color advances through the wrapping lerp palette `getColor(ic+dc*j)` (194, 248–254).
5. **Color**: `rcol()` = uniform pick from 5-color list (239, 242–244); `getColor(float)` = cyclic lerp (248–254). No blend modes (ADD commented out, 49); `smooth(8)` (17) softens edges.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_40 | `int grid = 80;` -> `int grid = 40;` | large (mean 0.1505, 0.577) | finer, denser grid lines; many more small solid colour squares spread across the canvas; snake trails look the same size | variants/grid_40/frame_00001.png |
| ddd_500 | `int ddd = int(random(50, 250)*random(1));` -> `int ddd = int(random(100, 500)*random(1));` | subtle (mean 0.0487, 0.181) | a few trails visibly longer (long yellow streak top-left, long squiggles); most of the cluster unchanged | variants/ddd_500/frame_00001.png |
| snakeCount_30 | `for (int i = 0; i < 60*sca; i++) {` -> `for (int i = 0; i < 30*sca; i++) {` | subtle (mean 0.0471, 0.169) | some trails absent; central cluster slightly sparser, same character | variants/snakeCount_30/frame_00001.png |
| patchAlpha_100 | `float a1 = random(255)*random(1);` -> `float a1 = random(100)*random(1);` | none (mean 0.0058, 0.005) | no visible change | variants/patchAlpha_100/frame_00001.png |
| dotSize_0.5 | `grid*0.1*noi, grid*0.1*noi` -> `grid*0.5*noi, grid*0.5*noi` | none (mean 0.0048, 0.016) | no visible change | variants/dotSize_0.5/frame_00001.png |
| palette_alt | 5-colour `colors[]` -> 6-colour alt list | moderate (mean 0.1198, 0.455) | whole piece recoloured: orange, green, dark navy and mustard; layout identical | variants/palette_alt/frame_00001.png |

## Modularisation notes
Generic: the dot grid (noiseDotGrid), the snake trail (snakeTrail — the sketch's signature motif, fully parameterised: size, step count, oscillation velocity/amplitude/modulation, palette drift, tail fade), the annular ring (arc2), and the cyclic palette lerp (lerpWrap). One-off art decisions: the two patch/cell layers (2 and 3) that add texture under the snakes, the quadrant snap + 0.4–1 radius bias that concentrates snakes in the center, the specific palette and the 240-gray background. A clean parameter object: `{cell, gridDetail, dotFactor, patchCount, patchAlphaMax, snakeCount, snakeRadiusBias, trailMin, trailMax, oscVel, oscAmp, modAmp, palette, background}`.
