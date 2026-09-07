---
sketch: 2019/generativos/natalaba
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1508
animated: false
techniques: [noise-field, particles, dots-stippling, polar]
primitives: [ellipse, point, line]
palette:
  colors: ["#FB9845", "#F0C7C0", "#F65A5C", "#3080E9", "#50E2C6", "#F7D3C3", "#F41B9C"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: count, default: 2, tried: [4], change: subtle, effect: "more streams, but each wanders in its own ~80px region so orange coverage drops to smaller, more separate plumes (one top plume + one star)"}
  - {name: cc, default: 200, tried: [500], change: moderate, effect: "longer, denser trails; plumes fill in and reach further (olive/green star top-right)"}
  - {name: dotScale, default: 0.3, tried: [0.6], change: moderate, effect: "2x dot size; plume becomes a large dense orange mass on the left (largest visual change)"}
  - {name: rrr, default: "random(0.04,0.08)", tried: [0.2], change: subtle, effect: "radial flower stamps ~3x larger and more saturated (big pink/magenta fan upper-right, blue node at centre); orange dot plumes comparable"}
  - {name: speckleCount, default: 200, tried: [600], change: subtle, effect: "~3x background speckles; too faint to read clearly, plumes unchanged"}
reusable_candidates:
  - {name: noiseDrivenStream, signature: "noiseDrivenStream(origin, steps, stepScale, sizeRange, palette, alpha) -> void", note: "walk a dot path whose heading each step is a SimplexNoise field angle; size modulated by a second noise channel"}
  - {name: ringedCluster, signature: "ringedCluster(x, y, dotSize, petalCount, layers, radiusFactor) -> void", note: "concentric rings of small ellipses arranged radially (the little flower/star bursts)"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], v) -> color", note: "index a palette with a float and lerp between adjacent entries by a squared fractional part"}
---

## What it draws
Two dense, comet-like plumes of overlapping orange dots sweep diagonally across a pale grey field:
one from the upper-left toward the mid-top, another from the left edge down toward the lower-middle.
Each plume is thick at its origin and tapers into scattered stray dots and thin filaments. A faint
field of multicoloured speckles and a barely-visible white dot grid fill the rest of the background.
In the bottom-left corner the path folds back on itself into a tight, brighter star/flower burst of
small rings. The dominant colour is warm orange; blue/teal/magenta appear only as isolated faint specks.

## How the code works
`generate()` (natalaba.pde) seeds both `randomSeed` and `noiseSeed` from `seed` (L54-55).
Background is a flat `background(240)` light grey — the computed `back` orange is only used for colour
lerps, not the fill (L57-60).

Layer 1 — background speckles (L62-71): 200 small ellipses (`s = random(20)*random(0.4)`, ≤8px) at
positions snapped to a 20px grid, filled with `rcol()` (a random palette entry, L241-243) at low
random alpha. This produces the sparse multicoloured specks.

Layer 2 — dot grid (L90-95): a `stroke(255,60)` point every 10px in a nested loop, giving the faint
white grid visible on the grey field.

Layer 3 — the plumes (L99-185): the main visual. `count = 2` streams (L102). For each, a walk of
`cc = 200` steps (L117). Each step: the heading `a` comes from `SimplexNoise.noise(des1+x*det1,
des1+y*det1)` (L127) — a 2D noise field turning the path into a curving plume; the dot size `s` is
`0.3*lerp(minSize, maxSize, SimplexNoise(noise channel 2))*amp` (L129), so size is also noise-driven
and an `amp` envelope (`0.5+pow(sin(j*PI/cc),2)*0.5`, L128) fattens the middle. Colour `col =
lerpColor(back, getColor(ic+dc*j), 0.2+pow(i/count,0.2)*0.8)` (L130): the orange `back` (#FB9845) is
lerped toward a palette colour from `getColor` (L247-252), which indexes `colors[]` with a float and
lerps adjacent entries — because `back` is orange and the lerp is biased, the plume reads as orange.
`x += cos(a)*0.4*scale` advances the walk (L145-146). With small probability a branch line + tiny
satellite dot is drawn (L148-159) — the stray dots/filaments. Finally each step also draws a
`cccc`-layer ringed cluster of `ccc` radially-arranged small ellipses (L171-183), whose radius factor
`rrr` (L122) sets how big the little flowers are; where the noise path loops (bottom-left) these
accumulate into the bright star burst.

Renderer P2D, `smooth(8)`, no blend modes (default OVER). Static — `draw()` is empty (L31-32).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_4 | `int count = 2;` -> `int count = 4;` | subtle | only one small top plume and a compact mid-left star remain; the two large baseline plumes are reduced, so overall orange coverage is lower (mostly identical grey background) | variants/count_4/frame_00001.png |
| cc_500 | `int cc = 200;...` -> `int cc = 500;...` | moderate | plumes much denser and longer — filled orange trails and an olive/green star burst top-right | variants/cc_500/frame_00001.png |
| dotScale_0.6 | `float s = 0.3*lerp(...)` -> `float s = 0.6*lerp(...)` | moderate | dots ~2x larger; plume fills into a big dense orange mass on the left with looser dots trailing right (largest change of the set) | variants/dotScale_0.6/frame_00001.png |
| rrr_0.2 | `float rrr = random(0.04, 0.08);` -> `float rrr = 0.2;` | subtle | radial flower stamps visibly larger and more saturated (large pink/magenta fan upper-right, blue node at its centre); the orange dot plumes stay comparable | variants/rrr_0.2/frame_00001.png |
| speckleCount_600 | `for (int i = 0; i < 200; i++) {` -> `... i < 600; ...` | subtle | the two orange plumes read the same as baseline; background field has ~3x as many faint multicoloured speckles, barely visible | variants/speckleCount_600/frame_00001.png |

## Modularisation notes
Generic (library candidates): `paletteLerp` (index a palette with a float, lerp neighbours by squared
fraction) is fully reusable; `noiseDrivenStream` (heading = noise-field angle, size = second noise
channel, advance along heading) is the core generative engine and is art-parameter-independent;
`ringedCluster` (concentric radial ellipses) is a self-contained stamp.

One-off art decisions: the flat grey background, the 20px-speckle + 10px-dot-grid backdrop, the
specific `colors[]` palette, the low-alpha `0.006`/`0.0001` branch probabilities, and the fixed
`back = #FB9845` that tints everything orange.

A clean parameter object: `{count, cc (steps/stream), stepScale (0.4), sizeRange [minSize,maxSize]
scaled by 0.3, noiseDetail [det1,det2], noiseOffset [des1,des2], palette, backColor,
branchProb, ring {petalCount, layers, rrr, amprad}, speckleCount, gridStep}`.
