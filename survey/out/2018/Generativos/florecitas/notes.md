---
sketch: 2018/Generativos/florecitas
year: 2018
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 3043
animated: false
techniques: [noise-field, grid, polar, curves, dots-stippling]
primitives: [shape]
palette:
  colors: ["#92C8FA", "#0321A1", "#F94D21", "#FFEDE8"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(60,80)*1.4)", tried: ["*2.4"], change: large, effect: "more grid cells -> much smaller, far denser carpet of flowers; bands persist but thinner and finer"}
  - {name: flowerCount, default: 520, tried: [1040], change: large, effect: "more flowers: bands fill in, extra small blooms appear in the central gap; same size distribution"}
  - {name: det, default: "random(0.01)", tried: [0.03], change: moderate, effect: "3x size-field noise detail: smooth diagonal bands break into smaller, fragmented clusters"}
  - {name: layersStep, default: 0.03, tried: [0.01], change: large, effect: "~3x more concentric passes: rosettes show distinct ring structure, field looks busier"}
  - {name: lobeCount, default: 1, tried: [2], change: moderate, effect: "4-lobed instead of 2-lobed rose outline: flowers more scalloped/star-like, same composition"}
  - {name: dotAlpha, default: "random(200)", tried: ["random(60)"], change: none, effect: "no visible change: stipple grid already near-invisible under the flowers"}
  - {name: rosette, signature: "rosette(x, y, size, layers, lobeCount) -> void", note: "concentric polar rose: rr = cos(k*ang)*2*r redrawn ~33x at shrinking scale with a noise-offset palette index per layer"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], t) -> color", note: "getColor(float v): maps noise/random value onto adjacent palette pair with lerpColor (florecitas.pde:253-259)"}
  - {name: sineWobble, signature: "sineWobble(x, y, fx, fy, amp) -> PVector", note: "desform(): small periodic vertex distortion x+cos(x*fx)*4, y+sin(y*fy)*4 (florecitas.pde:222-226)"}
---

## What it draws
Full-bleed field of soft, multi-lobed rosette "flowers" in sky blue, cobalt,
orange-red and cream, densely packed into broad diagonal bands that follow an
invisible noise field; a pale lavender-cream gap of empty background runs
through the center where the field is low. The whole canvas is also dusted
with a faint, semi-transparent grid of small wobbly dots and a few hairline
speckles in the gap.

## How the code works
Single tab; `setup()` calls `generate()` once (static, florecitas.pde:5-10).

1. Background: `background(getColor())` — one opaque random palette color
   (florecitas.pde:39).
2. Stippled dot grid: `cc = int(random(60,80)*1.4)` cells (~84-112), 10% of
   cells skipped, each gets `c(x,y,ss*0.1)` — a tiny wobbly circle via
   `desform()` distortion, `fill(rcol(), random(200))` semi-transparent
   random palette color (florecitas.pde:50-77, 193-203, 222-226).
3. Four big translucent triangles (canvas split by diagonals) filled with
   `rcol()` at alpha ~32-48 — a barely-visible color wash
   (florecitas.pde:81-98).
4. 800 short squiggles: 32-42 segments walking a simplex-noise angle field
   (`noise(...)*TAU*3`, step 1px) plus `water()` displacement; stroke color
   `getColor(n+v*0.2)` with alpha ramping 0->120 and weight 0.2->0.8
   (florecitas.pde:111-131). Mostly invisible hairlines.
5. 520 flowers, the dominant feature: positions snapped to the same grid;
   size `s = ss*1.2 * int(pow(noise(x*det,y*det),1.3)*6)` — quantized to
   0..6 steps of 1.2 cells, so size clusters spatially where the noise is
   high and vanishes where low (int=0) — this creates the diagonal bands
   (florecitas.pde:136-139). Each flower is drawn ~33 times in a shrinking
   loop `j: 1 -> 0 step -0.03`, each pass `flower(x,y, s*j*1.4, random(TAU))`
   with a fresh random rotation and fill `getColor(pow(j*0.24,1.3)+ic)` where
   `ic` is a per-flower noise offset — the concentric, layered rosette look
   (florecitas.pde:142-147).
6. `flower()` is a polar rose `rr = cos(da*j)*2*r` (two-lobed, 2*k lobes
   pattern) with per-vertex `desform()` sine wobble; `seg = max(8, s*PI*3)`
   (florecitas.pde:167-179).
7. Palette: 4 fixed colors (florecitas.pde:245); `rcol()` picks randomly,
   `getColor(v)` interpolates between adjacent entries for continuous color
   (florecitas.pde:247-259). Randomness enters via `randomSeed(seed)` then
   `random()`/`noise()` throughout.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_2.4 | `int cc = int(random(60, 80)*1.4);` -> `*2.4;` | large | much finer, denser carpet of small rosettes; band structure still visible but thinner | variants/cc_2.4/frame_00001.png |
| flowers_1040 | `for (int i = 0; i < 520; i++) {` -> `i < 1040;` | large | same-sized flowers, higher density; bands fill in and small blooms appear in the central gap | variants/flowers_1040/frame_00001.png |
| det_0.03 | `float det = random(0.01);` -> `random(0.03);` | moderate | smooth diagonal bands fragment into smaller-scale noise clusters | variants/det_0.03/frame_00001.png |
| layers_0.01 | `for (float j = 1; j > 0; j-=0.03) {` -> `j-=0.01` | large | rosettes show distinct concentric rings (e.g. big orange top-left); overall busier | variants/layers_0.01/frame_00001.png |
| lobes_4 | `float rr = cos(da*j)*2*r;` -> `cos(da*j*2)` | moderate | 4-lobed scalloped flower outlines instead of 2-lobed; composition otherwise same | variants/lobes_4/frame_00001.png |
| dotalpha_60 | `fill(rcol(), random(200));` -> `random(60)` | none | no visible change (dot grid already near-invisible) | variants/dotalpha_60/frame_00001.png |

## Modularisation notes
Generic: `paletteLerp` (getColor), `sineWobble` (desform), the rosette
generator (flower + the shrinking multi-pass loop), the quantized-noise size
field (int(pow(noise,1.3)*6) -> banded clusters), and the noise-angle
walker for squiggles. One-off art decisions: the specific 4-color palette,
the 0.1-skip dot grid, the four translucent triangles, the 1.4/1.2 size
factors and 0.03 layer step. A clean parameter object: {palette,
gridCells (cc), dotSkip (0.1), dotAlpha, flowerCount (520), sizeFieldDetail
(det), sizeQuant (6), layersStep (0.03), lobeCount (1), wobbleAmp (4)}.
