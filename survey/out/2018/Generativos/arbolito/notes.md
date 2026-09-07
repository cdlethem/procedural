---
sketch: 2018/Generativos/arbolito
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2364
animated: false
techniques: [recursion, noise-field, scattered]
primitives: [line]
palette:
  colors: ["#FFFFFF", "#FFC930", "#F58B3F", "#395942", "#212129"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: 1800, tried: [400], change: large, effect: "fewer trees: sparse grove with large black gaps, colour patches unchanged"}
  - {name: totalIte, default: 15, tried: [10], change: moderate, effect: "shallower recursion: shorter, stubbier trees, finer tops lost"}
  - {name: det, default: 0.005, tried: [0.001], change: moderate, effect: "lower = larger, smoother, more continuous colour patches"}
  - {name: branchProb, default: 0.8, tried: [0.5], change: large, effect: "lower = visibly sparser, more open branches, more black showing through"}
  - {name: alpha, default: 240, tried: [120], change: moderate, effect: "lower = darker, thinner, more see-through, muted colour"}
  - {name: strokeWeightFactor, default: 8, tried: [2], change: moderate, effect: "lower = hairline strokes, finer, lighter overall"}
reusable_candidates:
  - {name: recursiveBranch, signature: "recursiveBranch(x, y, angle, len, depth, maxDepth, shrink, branchProb, angleSpread) -> void", note: "recursive line tree: draw segment, shrink length, branch with probability at rotated angles"}
  - {name: noisePalette, signature: "noisePalette(x, y, detail) -> color", note: "2-D noise value mapped to a palette position, lerped between adjacent palette entries"}
---

## What it draws
A dense, full-bleed stand of bare shrubby trees on a black background, like an abstract
woodland seen head-on. Trees in the lower half are large with thick trunks; they become
finer and sparser toward the top, as if receding. Colour falls in broad soft patches:
dark forest green across the middle and upper areas, warm orange in a horizontal band
through the middle, pale grey-white clumps top-left and lower-right, and occasional
yellow tinges.

## How the code works
- `setup()` (L4–9) opens a 960×960 P2D window and calls `generate()` once; `draw()`
  (L11–12) is empty, so the image is static.
- `generate()` (L22–36): black background; loops `cc = 1800` times (L28). For index `i`,
  `val = i/cc`; `cx` is uniform random over the width (L31); `cy = lerp(-0.1h, 1.3h,
  pow(val, 1.2))` (L32) pushes later, bigger trees toward the bottom; size
  `s = (500 - 60*(1-val)) * random(0.6, 1)` (L33) grows with `val`, so lower trees are
  bigger. Each iteration calls `arbol(cx, cy, s)`.
- `arbol()` (L38–49): starts pointing straight up (`a = PI*1.5`, L39), divides size by 5
  (L40), overrides `totalIte` to 15 (L42; the L2 default of 20 is never used), samples
  `noise(x*0.005, y*0.005) * colors.length` for the palette position `c` (L45) and a
  second noise offset for a size multiplier `ms` (L46), then calls `rama(x, y, a, s*ms,
  c, 15)`.
- `rama()` (L51–67): the recursive tree. Draws one line of length `s` at angle `a`
  (L55–60) with stroke width `8 * s * 0.01`, i.e. proportional to segment length
  (L54, L59); shrinks `s` by `random(random(0.6, 0.8), 0.95)` (L61); recurses up to 15
  levels, each of the two children taken with probability 0.8, at `a ± random(0.2, 0.4)`
  radians, with colour position shifted by `c + random(0.2)` (L63–66). The shrinking
  length plus two-sided branching produces the bushy, rounded silhouettes.
- Colour: active palette L74 is white, yellow, orange, dark green, near-black;
  `getColor(v)` (L83–89) lerps between adjacent palette entries. Because `c` comes from
  2-D noise, colour is spatially patchy; the `+random(0.2)` per depth drifts each
  branch slightly along the palette (warmer/greener) than its parent.
- Randomness: seeded via `randomSeed`/`noiseSeed` (L24–25); sources are tree x-position,
  size jitter, per-level shrink, branch probabilities, branch angles, colour drift.

## Experiments
| variant | substitution | change score | observation | image |
| cc_400 | `int cc = 1800;` -> `int cc = 400;` | large | sparse grove; individual trees clearly separated by large black gaps; same green/orange/grey-white patching | variants/cc_400/frame_00001.png |
| totalIte_10 | `totalIte = 15;//19` -> `totalIte = 10;//19` | moderate | shorter, stubbier trees; fine upper branches gone, canopies look cut off | variants/totalIte_10/frame_00001.png |
| det_0.001 | `float det = 0.005;` -> `float det = 0.001;` | moderate | colour patches much larger and smoother, broader continuous fields (orange top-right, grey top-middle, green lower-left) | variants/det_0.001/frame_00001.png |
| branchProb_0.5 | both `if (random(1) < 0.8)` -> `< 0.5` | large | trees visibly sparser and more open, wispy dry-shrub look, more black showing through | variants/branchProb_0.5/frame_00001.png |
| alpha_120 | `stroke(getColor(c), 240);` -> `..., 120);` | moderate | darker, thinner, more see-through; colours muted, inky overlapping lines | variants/alpha_120/frame_00001.png |
| strokeWeight_2 | `strokeWeight(8*str);` -> `strokeWeight(2*str);` | moderate | hairline strokes; finer, lighter, more delicate overall | variants/strokeWeight_2/frame_00001.png |

## Modularisation notes
- `rama()` is the generic core: a recursive branching-line generator parameterised by
  start angle/length, max depth, shrink factor, branch probability, and angle spread.
  A clean library function would take these as an options object and accept a draw
  callback for the segment (so the caller can control stroke colour/width).
- The `noise`-driven palette position (L45–46) plus `getColor`'s lerp-between-adjacent
  (L83–89) is a reusable `noisePalette(x, y, detail, palette)`.
- One-off art decisions: the 5-colour palette, `cc = 1800`, noise detail 0.005, the
  `pow(val, 1.2)` vertical placement ramp, the `500 - 60*(1-val)` size formula, the
  `s/5` trunk scaling, 15 levels, 0.8 branch probability, and the 240 stroke alpha.
- A parameter object for this sketch: `{count, sizeRange: [min, max], sizeRampExponent,
  maxDepth, shrink: [lo, hi], branchProb, angleSpread: [lo, hi], noiseDetail, palette,
  alpha, strokeWeightFactor}`.
