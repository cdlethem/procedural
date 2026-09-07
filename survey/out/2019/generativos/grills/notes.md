---
sketch: 2019/generativos/grills
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2029
animated: false
techniques: [grid, noise-field, packing, particles, distortion]
primitives: [rect, ellipse, line, shape]
palette:
  colors: ["#0E1619", "#024AEE", "#FE86F0", "#FD4335", "#F4F4F4"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(30,40)*0.8) ~ 24-32", tried: [12-16], change: large, effect: "coarser grid of big squares; circle layer dominates, grid reads washed-out"}
  - {name: alp2, default: "random(180)*random(1)", tried: [40], change: subtle, effect: "second diagonal gradient much fainter; cells slightly flatter, barely perceptible"}
  - {name: specksPerCell, default: 5, tried: [15], change: large, effect: "3x more small squares along cell edges; noticeably busier texture (circle layout also shifts: random stream changes)"}
  - {name: circleAttempts, default: 120, tried: [40], change: large, effect: "fewer circles (same grid, same first candidates); grid much more visible"}
  - {name: innerSquareProb, default: 0.2, tried: [0.6], change: none, effect: "no visible change; added squares are small (<=0.4*ss), only ~1% of pixels"}
reusable_candidates:
  - {name: getColor, signature: "getColor(float v, int[] colors) -> color", note: "index-noise color ramp: lerp between adjacent palette entries by pow(frac,4)"}
  - {name: desform, signature: "desform(x, y) -> PVector", note: "simplex-noise directional displacement field"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "ring drawn as quads with alpha gradient between two radii"}
  - {name: poissonCircles, signature: "poissonCircles(n, sMin, sMax) -> PVector[]", note: "rejection-sampled non-overlapping circles snapped to a grid"}
---

## What it draws
A full-bleed mosaic of ~24–32 square grid cells per side in a vivid palette
(near-black, blue, pink, red, white), with soft two-tone diagonal shading inside
each cell. A few dozen large translucent circles sit on top, many carrying a small
X made of two crossing lines, plus scattered tiny squares in the gaps. The overall
read is a noisy pixel grid with a layer of floating discs, busy and high-contrast.

## How the code works
`setup()` calls `generate()` (line 23); `draw()` is empty, so the piece is static
and one-shot. `randomSeed(seed)` / `noiseSeed(seed)` (44-45) make it deterministic.

- Grid loop (65-112): `cc` cells per side (line 62, ~24-32), cell size `ss = width/cc`
  (64). Each cell gets a base square filled with `getColor(i*dd+j+nc+dc)` (76), an
  index-noise ramp that lerps between adjacent palette colors (245-251), so
  neighboring cells shade smoothly between palette entries. `nc` and `dc` are
  sampled 2-D noise (67-69). A half-square `beginShape` with alpha `alp1` (78-85)
  and another with `alp2` (91-98) create the two-tone diagonal gradient look.
- Small squares: with probability 0.2 (89) one square of size up to `ss*0.4` (88)
  is centered in the cell; then a loop of 5 (101) drops up to 5 small squares
  (size `ss*0.3*r^2`) near the top edge of each cell (102-107) — these are the
  scattered specks.
- Circle layer (114-134): 120 random candidates (117), size 10-250 (120), snapped
  down to the grid (`x -= x%ss`, 122-123), kept only if not overlapping an
  accepted circle (126-133) — a rejection/Poisson-style packing.
- Each accepted circle (136-186): a short noise-distorted spiral polyline
  (148-155, via `desform`, 195-199), a quarter-gradient wedge rotated to a
  multiple of 90° (158-166), two alpha-gradient rings from `arc2` (168-170), a
  filled ellipse (173-175), and the X: two crossing `line()` calls of length
  `s*amp` (179-184).
- Colors: `rcol()` picks a random palette entry (239-241); active palette is line
  232 (other palettes commented out). Background is `background(230)` (47).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_0.4 | `int cc = int(random(30, 40)*0.8);` -> `...*0.4);` | large (mean 0.2969, 0.911) | coarse grid of ~12 large squares, washed-out and mostly hidden; big soft overlapping circles with a few X marks dominate; circle layout shifted (random stream) | variants/cc_0.4/frame_00001.png |
| alp2_40 | `float alp2 = random(180)*random(1);` -> `random(40)*random(1);` | subtle (mean 0.0118, 0.017) | no visible change at thumbnail scale; circle layout identical to baseline; diagonal shading on lower-right cell halves only slightly flatter | variants/alp2_40/frame_00001.png |
| specks_15 | `for (int l = 0; l < 5; l++) {` -> `l < 15` | large (mean 0.2448, 0.798) | 3x the small squares hugging cell edges, clearly busier speckled texture; circle layout shifted (random stream) | variants/specks_15/frame_00001.png |
| circles_40 | `for (int i = 0; i < 120; i++) {` -> `i < 40` | large (mean 0.1814, 0.645) | same grid, visibly fewer circles (subset of baseline's, at the same positions); grid far more visible | variants/circles_40/frame_00001.png |
| innerProb_0.6 | `if (random(1) < 0.2) rect(...)` -> `< 0.6` | none (mean 0.0041, 0.013) | no visible change; same circles; only a handful more tiny center squares (~1% of pixels) | variants/innerProb_0.6/frame_00001.png |

## Modularisation notes
Generic, library-worthy: `getColor` index-noise ramp (works for any palette),
`desform` simplex displacement field, `arc2` alpha-gradient ring, and the
rejection-sampled grid-snapped circle packing. One-off art decisions: the fixed
5-color palette, the exact alpha/size formulae (`random(80)*random(1)`,
`ss*0.4`, 0.2 probability), the X mark, and the wedge overlay. A clean parameter
object would hold: `cells` (cc), `palette`, `innerSquareProb`, `specksPerCell`,
`circleAttempts`, `circleSizeRange`, `ringAlpha`, `xLength`.
