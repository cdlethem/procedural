---
sketch: 2018/Generativos/arbolito4
year: 2018
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1565
animated: false
techniques: [recursion, noise-field, particles]
primitives: [line, ellipse]
palette:
  colors: ["#FCB466", "#F4D3DE", "#F7E843", "#409746", "#373787", "#E12E29", "#000000"]
  selection: noise-driven
composition: scattered
parameters:
  - {name: cc, default: 120, tried: [40], change: moderate, effect: "fewer trees: sparser field, individual trees clearly separated, some reduced to bare trunks"}
  - {name: totalIte, default: 8, tried: [12], change: large, effect: "deeper recursion: much denser, busier field with dark clumped canopies"}
  - {name: s (tree size), default: "200-60*(1-val)", tried: ["400-60*(1-val)"], change: large, effect: "larger trees: bigger, more overlapping, covers more of the canvas"}
  - {name: strokeWeight scale, default: 8, tried: [20], change: moderate, effect: "thicker trunks and branches, same density"}
  - {name: ea (spread), default: "random(0.4, 0.6)", tried: ["random(0.8, 1.0)"], change: moderate, effect: "wider branch spread: bushier, more open fanning silhouettes"}
reusable_candidates:
  - {name: recursiveBranch, signature: "recursiveBranch(x, y, angle, spread, size, color, depth, branchProbs) -> void", note: "stochastic L-system branch with shrinking segments and 2-3 recursive children"}
  - {name: colorRamp, signature: "colorRamp(float v, int[] colors) -> color", note: "wrap v into a cyclic lerp between adjacent palette entries (getColor)"}
---

## What it draws
A dense field of about 120 thin black branching "trees" on a flat warm-orange
background, full-bleed with no margins. Each tree starts with a thick trunk that
splits into 2-3 branches repeatedly until the lines are hair-thin; branch tips end
in tiny orange dots. Trees are larger and denser toward the bottom of the canvas
and smaller toward the top, and their density/overlap varies across the field.

## How the code works
`setup()` calls `generate()` once (draw() is empty, so the piece is static).
`generate()` (L24-43) seeds random/noise, fills the background with #FCB466, then
loops `cc = 120` times: each iteration picks a random x and a y placed by
`lerp(-0.1*height, 1.3*height, pow(i/cc, 1.2))` (L39) — the pow curve biases trees
toward the bottom — and a size `s = (200-60*(1-val))*random(0.6,1)` (L40) that
grows with the same progress value, then calls `arbol(cx, cy, s)`.

`arbol()` (L56-68) samples 2-D noise at the tree position (`det = 0.002`, L62) to
pick a color index `c` and a size multiplier `ms`, sets the spread `ea =
random(0.4, 0.6)` and the depth `totalIte = 8` (L60, overwriting the global 20),
then calls `rama()`.

`rama()` (L76-101) is the recursive branch: it draws one line segment of length `s`
along angle `a`, with `strokeWeight(8*str)` where `str = s*0.01` (L79, L85), so the
trunk is thick and tips are thin. L83 sets a palette color via `getColor(c)` but
L84 immediately overwrites it with `stroke(0)`, so every branch renders black.
Length shrinks by `random(random(0.6,0.8), 0.95)` (L87); at `ite == 0` a small
ellipse in the background color marks the tip (L90-94). Otherwise it recursively
spawns children with probability 0.7 (left), 0.7 (right), 0.4 (middle) (L97-99),
with angles offset by up to `errAng`, which interpolates from `ea*0.3` at the
trunk to `ea` at the tips (L89) — branches fan out more as they get thinner.
`desform()`/`linee()` (L50-54, L103-112) and the `edificio()` stub are dead code.
Randomness enters via `random()` for positions, sizes, shrink factors, branch
angles and branch probabilities; noise only modulates per-tree size/color.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_40 | `int cc = 120;` -> `int cc = 40;` | moderate | much sparser field (~40 trees), trees clearly separated, a few are just bare trunks | variants/cc_40/frame_00001.png |
| totalIte_12 | `totalIte = 8;//19 ...` -> `totalIte = 12;//19 ...` | large | far denser, busier: canopies clump into solid dark masses, fine detail everywhere | variants/totalIte_12/frame_00001.png |
| s_400 | `float s = (200-60*(1-val))*random(0.6, 1);` -> `(400-60*...)` | large | trees roughly doubled in size, heavy overlap, fills most of the canvas | variants/s_400/frame_00001.png |
| weight_20 | `strokeWeight(8*str);` -> `strokeWeight(20*str);` | moderate | same layout, all lines visibly thicker, trunks heavy | variants/weight_20/frame_00001.png |
| ea_0.8_1.0 | `float ea = random(0.4, 0.6);` -> `random(0.8, 1.0);` | moderate | branches fan out much wider: bushier, more open, airy tree silhouettes | variants/ea_0.8_1.0/frame_00001.png |

## Modularisation notes
`rama()` is a clean generic recursive-branch/L-system primitive: parameters are
start position+angle, segment length, spread, depth, shrink factor, branch
probabilities, and a color function — everything art-specific (the 0.7/0.7/0.4
probabilities, the `8*str` weight law, the tip dots) is already data-driven and
could move into a config object. `arbol()` is a per-instance noise-driven
initialiser (position -> size/color via noise) that is also reusable. The
scatter loop in `generate()` (L36-42) is a one-off composition decision (the
`pow(val,1.2)` vertical gradient of tree size), as is the `stroke(0)` override
that forces monochrome output despite the palette machinery. A clean parameter
object: {count, yCurve, sizeRange, depth, shrinkMin/shrinkMax, branchProbs[3],
spreadRange, weightScale, tipSize, palette, forceMonochrome, background}.
