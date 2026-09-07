---
sketch: 2018/Generativos/arbolito2
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3934
animated: false
techniques: [recursion, noise-field, lines-hatching]
primitives: [line]
palette:
  colors: ["#F4D3DE", "#F7E843", "#409746", "#373787", "#E12E29"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: 1800, tried: [400], change: large, effect: "far sparser forest; individual trees separated by black ground instead of a merged full-bleed mass"}
  - {name: totalIte, default: 18, tried: [10], change: large, effect: "shallower recursion; finer, grass-like strokes and smaller, less bushy canopies"}
  - {name: det, default: 0.005, tried: [0.015], change: moderate, effect: "finer noise-driven colour mottling; denser, more uniform red with smaller green/indigo patches"}
  - {name: strokeScale (8*str), default: 8, tried: [2], change: moderate, effect: "thinner, more delicate strokes; more black ground shows between branches"}
  - {name: sizeBase (500-60*(1-val)), default: 500, tried: [200], change: large, effect: "much smaller trees; more distinct individual trees with clearer red/green/indigo separation"}
reusable_candidates:
  - {name: fractalTree, signature: "fractalTree(x, y, angle, size, colorIndex, depth, shrink) -> void", note: "recursive two-branch tree; draws one line per level, shrinks size, recurses left/right with angle jitter and color drift"}
  - {name: noisePaletteLerp, signature: "noisePaletteLerp(palette[], v) -> color", note: "index a palette by a continuous value, lerp between the two adjacent entries on the fractional part"}
---

## What it draws
A full-bleed, extremely dense "forest" of overlapping fractal trees on a black ground. Each tree is a bushy
canopy made of thousands of thin branching lines radiating upward from a base point. The canopy fills most
of the canvas; the dominant colours are warm red and pale pink/salmon, with patches of green and indigo/blue
trees scattered through. Individual trunks are mostly lost in the overlap; only the fine branching texture
reads.

## How the code works
`setup()` (L4) calls `generate()` once; `draw()` (L11) is empty, so the sketch is static (regenerate only on keypress).
- `generate()` (L22): seeds `randomSeed`/`noiseSeed` with `seed`, black background. Loops `cc = 1800` times (L28).
  Per iteration: `val = i/cc`; base `cx = random(width)` (L31); base `cy = lerp(-0.1h, 1.3h, val^1.2)` (L32) so tree
  bases drift from just above the top down below the bottom; `s = (500 - 60(1-val)) * random(0.6,1)` (L33) so later
  (lower) trees are bigger. Calls `arbol(cx, cy, s)`.
- `arbol()` (L38): start angle `a = PI*1.5` (pointing up); `s /= 5`. Depth fixed `totalIte = 18` (L42).
  Noise scale `det = 0.005` (L44); colour index `c = noise(x*det, y*det) * colors.length` (L45) — the base colour is
  noise-driven; size modulation `ms = noise(...)` (L46). Calls `rama(x, y, a, s*ms, c, totalIte)`.
- `rama()` (L51): recursive branch. Moves from `(x,y)` along `a` by length `s` (L55-56). Stroke `getColor(c)` with
  alpha 240 (L58); weight `8 * (s*0.01)` (L54,59) — thicker at the trunk, tapering to thin twigs. Draws one `line`
  (L60). Shrinks `s *= random(random(0.6,0.8), 0.95)` (L61); `ite--`. If `ite > 0`, with probability 0.8 recurse left
  (`a - random(0.2,0.4)`, `c + random(0.2)`) and with probability 0.8 recurse right (`a + random(0.2,0.4)`,
  `c + random(0.2)`) (L64-65) — the colour drifts up the palette along each branch.
- Colour (L83): `getColor(v)` takes `abs(v) % colors.length`, lerps between the two adjacent palette entries on the
  fractional part. Palette (L75): pink `#F4D3DE`, yellow `#F7E843`, green `#409746`, indigo `#373787`, red `#E12E29`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_400 | `  int cc = 1800;` -> `  int cc = 400;` | large | far sparser; individual trees now clearly separated by black ground, canopy no longer merges into a full-bleed mass | variants/cc_400/frame_00001.png |
| totalIte_10 | `  totalIte = 18;//19  //int(random(8, 20));` -> `  totalIte = 10;` | large | much finer, grass-like strokes; canopies smaller and less bushy, more black showing through | variants/totalIte_10/frame_00001.png |
| det_0.015 | `  float det = 0.005;` -> `  float det = 0.015;` | moderate | finer, smaller-scale colour mottling; denser and more uniform red with smaller green/indigo patches | variants/det_0.015/frame_00001.png |
| strokeWeight_2 | `  strokeWeight(8*str);` -> `  strokeWeight(2*str);` | moderate | thinner, more delicate strokes; more black ground between branches, wireframe look | variants/strokeWeight_2/frame_00001.png |
| size_200 | `    float s = (500-60*(1-val))*random(0.6, 1);` -> `    float s = (200-60*(1-val))*random(0.6, 1);` | large | much smaller trees; more distinct individual trees, clearer red/green/indigo separation | variants/size_200/frame_00001.png |

## Modularisation notes
- **Generic (library):** the recursive `rama`/`arbol` tree is the core reusable block — a `fractalTree(x, y, angle,
  size, colorIndex, depth, {branchProb, angleJitter, shrink, colorDrift, taper})` would capture it. The noise-driven
  palette lerp `getColor(v)` is also generic: `noisePaletteLerp(palette, v)`.
- **One-off art decisions:** the specific `cc = 1800` count, the base-y distribution (`lerp(-0.1h,1.3h, val^1.2)`),
  the size ramp `(500-60(1-val))`, the fixed depth 18, and the chosen 5-colour palette are all authoring choices.
- **Clean parameter object:** `{count, depth, noiseScale, sizeBase, sizeJitter, branchProb, angleJitter, shrinkMin,
  shrinkMax, colorDrift, strokeScale, alpha, palette}`.
