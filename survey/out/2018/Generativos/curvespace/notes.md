---
sketch: 2018/Generativos/curvespace
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1637
animated: false
techniques: [grid, distortion]
primitives: [point, line, ellipse]
palette:
  colors: ["#1C1528", "#FF5949", "#FFC956", "#1CEA64", "#53EFF4"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(30,80))", tried: [20], change: null, effect: ""}
  - {name: c, default: "int(random(4,10))", tried: [1], change: null, effect: ""}
  - {name: res, default: "width*3", tried: [width], change: null, effect: ""}
  - {name: ss, default: "width*random(0.8)", tried: [0.3], change: null, effect: ""}
  - {name: pp, default: "random(1,10) or reciprocal", tried: ["random(1,10) only"], change: null, effect: ""}
reusable_candidates:
  - {name: attractorWarp, signature: "attractorWarp(x, y, attractors[]) -> PVector", note: "sum of radial pull displacements toward each attractor, magnitude (1-t^p)*r with t=dist/r; p>1 broad plateau pull, p<1 sharp central spike"}
  - {name: warpGrid, signature: "warpGrid(count, resolution, warpFn) -> void", note: "draws count-1 vertical + count-1 horizontal polylines, each sampled at resolution points and passed through a warp function"}
---

## What it draws
A full-bleed fine grid of hair-thin lines in four faint colours (red, orange, green, cyan) on a very dark aubergine background, drawn additively so overlaps brighten. Most grid lines stay straight, but large swaths are strongly bent and pulled toward a bright tangle of strands just left of centre, where many lines converge and cross. A small flower/rosette of coiled strands sits in the bottom-right corner. A barely visible dot matrix and a few large faint circle outlines underlie the whole image.

## How the code works
`setup()` (line 3) calls `generate()` once; `draw()` (line 13) is empty, so the sketch is static. `generate()` (line 38):
1. Dark background `#1C1528` (line 40) and `blendMode(ADD)` (line 42) — every stroke adds light, which is why crossings glow.
2. A `cc × cc` dot grid (lines 44–51, alpha 50) at cell-centres of size `width/cc`; `cc` is random 30–80. This is the faint underlying dot matrix.
3. `c` attractors (lines 58–65, random 4–10): each gets a size `ss` up to `0.8*width`, a centre biased inward, and a power `pp` that is either `random(1,10)` or its reciprocal (line 63). Their outlines are stroked as faint ellipses (lines 69–73, alpha 20) — the barely visible large circles.
4. The main figure: `cc-1` vertical (lines 76–86) and `cc-1` horizontal (lines 88–98) polylines, each with `res = 3*width` samples (line 53). Each sample `(x,y)` is displaced by `def()` (lines 101–116): for every attractor within radius `r = ss/2`, it adds a pull *toward* the attractor centre with magnitude `v = (1 - t^p)·r` where `t = dist/r` — i.e. full pull at the centre, zero at the rim; `p > 1` gives a broad near-constant pull, `p < 1` a sharp central spike. Each line is stroked in one random palette colour (lines 122–125) at alpha 40.
5. The bright knot and the bottom-right rosette are where one or more attractor centres sit: lines passing through the radius are dragged into the centre and, with high `p` or small `r`, coil into the rosette pattern.
Randomness enters through the seed (line 1), `cc`, the attractor count/position/size/power, and per-line colour. A `PFont` (line 8) is created but never used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `def()` is the generic core: a sum of radial "attractor" displacement fields with a tunable power profile `v = (1 - t^p)·r`. Clean as a library function `attractorWarp(x, y, attractors)` where each attractor is `{x, y, radius, power}`.
- `warpGrid(count, resolution, warpFn)` is the second generic block: it just resamples an axis-aligned grid of lines through an arbitrary warp function, so it works with any displacement field (attractors, noise, flow).
- One-off art decisions: the 4-colour neon palette with random per-line assignment, ADD blending with low alphas (50/20/40), the dark `#1C1528` ground, the dot matrix and attractor outlines, and the mixed `p` / `1/p` power distribution.
- A parameter object for this sketch: `{gridCount, attractorCount, attractorRadiusScale, powerRange, lineResolution, lineAlpha, dotAlpha, palette, blend, background}`.
