---
sketch: 2018/Generativos/bordis
year: 2018
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1731
animated: false
techniques: [grid, noise-field, particles, dots-stippling]
primitives: [ellipse, line]
palette:
  colors: ["#E6E7E9", "#F0CA4B", "#F07148", "#EECCCB", "#2474AF", "#107F40", "#231F20"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(160,180)*1.2)", tried: [60], change: TBD, effect: "TBD"}
  - {name: walkers, default: 120, tried: [40], change: TBD, effect: "TBD"}
  - {name: det, default: "random(0.004,0.012)*0.7", tried: ["*2.0"], change: TBD, effect: "TBD"}
  - {name: lineAlpha, default: 180, tried: [60], change: TBD, effect: "TBD"}
  - {name: dotAlpha, default: 40, tried: [100], change: TBD, effect: "TBD"}
  - {name: palette, default: "7-col warm/cool", tried: ["5-col blue/red alt"], change: TBD, effect: "TBD"}
reusable_candidates:
  - {name: noiseQuantizedStep, signature: "noiseQuantizedStep(noise, detail, x, y, cellSize) -> float", note: "2-D noise quantised to powers of two times cell size, for multi-scale step lengths"}
  - {name: lerpRamp, signature: "lerpRamp(int[] palette, float v) -> color", note: "abs(v)%1 mapped across palette with linear interpolation between adjacent entries"}
---

## What it draws
A light grey field with a faint, uniform stipple grid of tiny grey dots. Over it, many thin grey
polyline trails, each dotted with stacks of three concentric circles: a large semi-transparent
coloured disc, a smaller opaque disc in a different colour, and a tiny white centre dot. Circle
sizes vary in discrete steps (powers of two of the grid cell), so the trails cluster into big
clumps of large green/blue discs in the upper half and dense fields of tiny rust-orange and
blue-grey discs in the lower half.

## How the code works
`setup()` calls `generate()` once (bordis.pde:6-11); `draw()` is empty so the piece is static.
- Stipple grid: `cc = int(random(160,180)*1.2)` cells (line 32), cell size `s = width/cc`;
  a `cc x cc` double loop (lines 37-41) draws an `s*0.2` ellipse per cell with `fill(0,40)`.
- 120 walkers (line 56), each takes 60 steps (line 67). Step size is
  `ss = s * 2^int(noise(des + xx*det, des + yy*det) * 7)` (line 72): 2-D noise quantised to
  powers of two of the cell size. Positions are snapped to multiples of `ss` (lines 60-61) so
  steps land on the noise grid.
- Direction: a `rect` flag (initially 50/50, flipped with p=0.1 each step, line 73) switches
  between axis-aligned steps `int(random(-2,2))*ss` (lines 75-76) and one of six 60-degree
  directions (lines 78-80) — this produces the hexagonal lattice texture in the fine clusters.
- Each step draws a grey line (alpha 180, weight 0.7, line 83) and three ellipses: an `ss*0.5`
  disc with alpha 240 coloured by noise at the position (lines 85-86), an `ss*0.2` opaque disc
  coloured by a *second* independent noise field (lines 87-88), and a tiny `ss*0.02` white dot
  (lines 89-90).
- Colour: 7-entry palette (line 100); `getColor(v)` (lines 111-118) maps `abs(v)%1` across the
  palette with `lerpColor` between adjacent entries, so the disc colours are a smooth noise-
  driven ramp — the green/blue vs rust split is the noise field, not the code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic (library candidates): `noiseQuantizedStep` (noise-driven step size in powers of two of a
cell size) and `lerpRamp` (palette interpolation by fractional noise value); the 60-step random
walker with a mode flag (axis-aligned vs 6-direction) is also reusable as a "quantised walker".
One-off art decisions: the triple concentric-circle motif with three different size/alpha/colour
sources, the specific 7-colour palette, the stipple background grid, 120 walkers x 60 steps.
A clean parameter object: `{gridCount (cc), cellAlpha (40), walkers (120), steps (60),
detail (det ~0.003-0.008), detailColor (detc ~0.004-0.012), lineAlpha (180), lineWeight (0.7),
palette (int[])}`.
