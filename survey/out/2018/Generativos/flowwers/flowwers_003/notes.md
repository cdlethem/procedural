---
sketch: 2018/Generativos/flowwers/flowwers_003
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2758
animated: false
techniques: [noise-field, grid, particles]
primitives: [rect, shape, line, ellipse]
palette:
  colors: ["#EDCE5B", "#F2A021", "#DECFB4", "#C0B394", "#9DA575", "#66775D", "#45523A", "#232D29", "#FED42E", "#51B9FF", "#2BFF6A", "#FF84D4"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: leafCount, default: "int(random(2000,4000)*20) (~40k-80k)", tried: ["int(random(500,1000)*20)"], change: moderate, effect: "fewer candidate points -> sparse foliage, stems and halos exposed"}
  - {name: leafNoiseAmp, default: 0.4, tried: [0.6], change: moderate, effect: "higher noise gate -> fewer leaves, clumps thin out, more open ground"}
  - {name: leafMaxSize, default: "width*0.02", tried: ["width*0.04"], change: moderate, effect: "larger blades -> dense dark-green mass covering most of canvas"}
  - {name: branchGrid, default: 8, tried: [16], change: subtle, effect: "4x stem start cells -> many more stems/buds, weeder look"}
  - {name: bandCount, default: 16, tried: [32], change: none, effect: "no visible change; bands stack near-opaquely so count barely matters"}
  - {name: haloSizeRange, default: "random(1,5) cells", tried: ["random(3,9) cells"], change: subtle, effect: "larger halos; green rings become prominent"}
reusable_candidates:
  - {name: noiseLeafScatter, signature: "noiseLeafScatter(count, maxSize, amp, seed) -> void", note: "scatter leaf shapes gated by a threshold on 2-D noise; size/angle/colour each from independent noise octaves"}
  - {name: leafBlade, signature: "leafBlade(x, y, size, angle, col) -> void", note: "two mirrored rows of tapered quads (sin width, pow depth) built per-pixel-row, colours lerped per row"}
  - {name: noiseBands, signature: "noiseBands(rows, c1, c2, alpha) -> void", note: "stacked horizontal shapes whose top edge is 1-D noise, filled with a pow-eased lerp between two colours"}
  - {name: noiseWalk, signature: "noiseWalk(x, y, steps, detail, des) -> void", note: "1-px random walk whose heading is PI*1.5 +/- small noise offset (near-vertical tendrils)"}
---

## What it draws
A flat, full-bleed "wildflower meadow" on a warm yellow-to-orange gradient. Hundreds of small
muted-green leaf/blade shapes are scattered in organic clumps and swirling rings; the clumps are
broken by a faint white grid of thin lines and small cross dots. A few glowing circular halos
(green, pink, blue, yellow) with a tiny centre dot sit on the grid, and thin vertical stems with
dark buds rise out of the leaf clumps.

## How the code works
`setup()` calls `generate()` once (static sketch; `draw()` is empty). Order matters (lines 22-44):
1. **Background** (23-32): a full-rect `#EDCE5B` fill, then a half-transparent `#837954` quad at
   alpha 40 over the lower half — the yellow→darker wash.
2. `montains(16)` (66-88): 16 stacked bands; each band's top edge is `noise(des+i*det, ...)`
   sampled every 2 px, filled with `lerpColor(#EDCE5B, #F2A021, pow(t,0.5))` at alpha 240 —
   the orange gradient in the lower two-thirds.
3. `grid(16)` (46-64): 16×16 cells of white rects at alpha ~40 (white line grid) plus a white
   0.12-cell rect and a dark 0.1-cell rect at each cell centre/corner — the faint grid and dots.
4. `hojas(count, width*0.02, 0.4)` (163-184): ~40k-80k candidate points at random positions;
   a point is skipped when `noise(des4+..)*< 0.4` (the clumping mask), size from one noise
   octave (`pow(noise,1.6)`), angle from another, colour from a third mapped through
   `getColor()` (lerp through the 9-colour sage/olive ramp, lines 287-293); 0.6% get a bright
   `cols` accent. Each leaf is `hoja()` (186-232): two mirrored rows of per-row quads whose width
   ramp colour — the little blade shapes.
5. `huds01(16)` (255-270): 8 grid-snapped positions; `arc2` (235-253) draws a full-annulus ring
   from ~r1 to r2 with alpha fading 130→0 in a random bright `cols` colour, plus a tiny light
   ellipse at centre — the glowing circles.
6. `ramas()` (90-105): on an 8×8 grid, 80% of cells get `rama()`: two 1-px random walks of 30-70
   steps; heading is `PI*1.5` plus a small noise offset so they drift near-vertical; colour walks
   along the ramp; occasionally a short side-branch with tiny leaves at the tip — the stems and buds.

Randomness: all gated by `noiseSeed(seed)`/`randomSeed(seed)`; seed from harness field `seed`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| leafCount_12000 | `hojas(int(random(2000, 4000)*20), width*0.02, 0.4);` -> `hojas(int(random(500, 1000)*20), width*0.02, 0.4);` | moderate | foliage much sparser: small leaf clumps left in corners/edges, yellow ground, grid, stems and halos clearly visible | variants/leafCount_12000/frame_00001.png |
| amp_0.6 | `hojas(int(random(2000, 4000)*20), width*0.02, 0.4);` -> `hojas(int(random(2000, 4000)*20), width*0.02, 0.6);` | moderate | leaves thinner and stipple-like, clumps dissolve into scattered dots, more stems showing through | variants/amp_0.6/frame_00001.png |
| maxSize_0.04 | `hojas(int(random(2000, 4000)*20), width*0.02, 0.4);` -> `hojas(int(random(2000, 4000)*20), width*0.04, 0.4);` | moderate | blades double in size; foliage merges into a dense dark-green mass covering most of the canvas, halos nearly buried | variants/maxSize_0.04/frame_00001.png |
| branchGrid_16 | `int cc = 8;` -> `int cc = 16;` | subtle | stems and dark buds markedly more numerous across the field, meadow looks weeder; leaf clumps unchanged | variants/branchGrid_16/frame_00001.png |
| bands_32 | `montains(16);` -> `montains(32);` | none | no visible change | variants/bands_32/frame_00001.png |
| haloSize_3-9 | `float s = ss*int(random(1, 5));` -> `float s = ss*int(random(3, 9));` | subtle | glowing halos noticeably larger (up to ~9 cells); green and pink rings stand out over the foliage | variants/haloSize_3-9/frame_00001.png |

## Modularisation notes
- **Generic / library-worthy:** `leafBlade` (pure drawing, no global state except `getColor`),
  `noiseLeafScatter` (needs its noise octaves + palette as inputs), `noiseBands`, `noiseWalk`,
  and `getColor` (ramp lerp). The 16-cell grid and `arc2` halo are also self-contained.
- **One-off art decisions:** the exact 5-layer stacking order and alphas, the 9-colour sage ramp,
  the 5-colour neon accent list, the `PI*1.5` near-vertical bias in `rama`, the 0.4 noise gate
  threshold, the quad-pow exponents (0.8/2.2) that give the leaf its pointed tip.
- **Clean parameter object:** `{seed, bgTop, bgBottom, bandCount, gridCells, leafCount, leafMaxSize,
  leafNoiseAmp, leafRamp[], accentRamp[], haloCount, haloSizeRange, stemGrid, stemProb, stemLenRange}`.
