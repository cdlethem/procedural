---
sketch: 2018/Generativos/circles
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1530
animated: false
techniques: [polar, shader, dots-stippling]
primitives: [ellipse, shape]
palette:
  colors: ["#191F5A", "#5252C1", "#9455F9", "#FFA1FB", "#FFFFFF", "#51C3C4", "#EE4764", "#E472E8", "#FFB452"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 60, tried: [20], change: moderate, effect: "sparser scatter, more white, less overlap"}
  - {name: maxCircleSize, default: 0.3, tried: [1.0], change: large, effect: "circles up to full canvas width; dense full-bleed overlap"}
  - {name: shadowAlpha, default: 200, tried: [80], change: subtle, effect: "shadow cones fainter and washed out; circles unchanged"}
  - {name: shadowLength, default: "r1*random(0.5,10)", tried: ["r1*random(0.5,2)"], change: moderate, effect: "cones collapse to short grainy halos hugging each circle"}
  - {name: shadowWobble, default: "random(0.1)*random(1)", tried: ["random(0.5)*random(1)"], change: subtle, effect: "cones become broad twisted fans with rippled outer edges"}
reusable_candidates:
  - {name: shadowCone, signature: "shadowCone(cx, cy, r, len, alpha, res) -> void", note: "fan of alpha-blended quads from a circle's rim to a wobbly outer arc, with noise-stippled alpha"}
  - {name: rcols, signature: "rcols(n) -> int[]", note: "n unique colours drawn without replacement from a palette list"}
---

## What it draws
A playful full-bleed scatter of brightly coloured circles on white. Each circle
has a smaller concentric circle (often a contrasting colour, e.g. white dot on
navy) and casts a soft, grainy "shadow" cone in a random direction: a broad
wedge of the circle's colour, speckled like sandpaper, that fades to nothing
and sometimes bows slightly. Colours are a saturated palette of navy, blue-violet,
magenta/pink, red, teal and orange; wedges overlap and layer into lighter mixes.

## How the code works
`setup()` calls `generate()` once (circles.pde:12), so the piece is static;
`keyPressed` regenerates with a new seed (lines 19-25). `generate()`
(lines 27-86):

- background white (line 28), `noStroke()` (line 30).
- Outer loop: 60 circles (line 32). For each: size `ss` up to `width*0.3`
  (line 33), position random in the canvas (lines 34-35), 4 unique palette
  colours via `rcols(4)` (line 36; `rcols` at 98-115 samples `colors[]`
  line 94 without duplicates), random rotation `ang` (line 37).
- Translate/rotate to the circle (lines 40-42). Shadow cone: `res = 60`
  quads (line 44), each quad spanning one step of the circle's rim
  (radius `r1 = ss*0.5`, lines 51-57) out to a wobbly outer arc of radius
  `r2 = r1*random(0.5,10)` (line 46) with a small angular wobble
  `amp = random(0.1)*random(1)` (line 47, lines 63-64). Every quad is
  filled `cols[0]` at alpha `shw = 200` (line 49), and the custom shader
  `noi` (loaded line 10) multiplies the fragment alpha by
  `0.001 + pow(rand(fragCoord*0.001), 0.4)` (noiseShadowFrag.glsl:20) —
  a per-fragment hash that turns the flat wedge into a stippled grain
  (the "noiseShadow" effect).
- `resetShader()`, then the solid centre: full circle `ss` in `cols[0]`
  (lines 69-70) plus a concentric circle `ss*random(0.1,0.8)` in `cols[1]`
  (lines 71-73).

Randomness enters only through the seeded `random()` calls (seed field
line 1, set by the harness). No noise() calls; the grain is the GLSL hash.

## Experiments
| variant | substitution | change score | observation | image |
| count_20 | `for (int c = 0; c < 60; c++) {` -> `for (int c = 0; c < 20; c++) {` | moderate | 20 circles: sparse scatter, lots of white, little overlap; same double-circle + shadow motif | variants/count_20/frame_00001.png |
| maxCircleWidth_1.0 | `float ss = width*random(0.3)*random(1)*random(0.5, 1);` -> `float ss = width*random(1.0)*random(1)*random(0.5, 1);` | large | circles up to full canvas width; dense full-bleed composition, huge shadow cones covering most of the frame | variants/maxCircleWidth_1.0/frame_00001.png |
| shadowAlpha_80 | `    shw = 200;` -> `    shw = 80;` | subtle | same circles; shadow cones visibly fainter, washed-out grain, white shows through more | variants/shadowAlpha_80/frame_00001.png |
| shadowLength_2 | `float r2 = r1*random(0.5, 10);` -> `float r2 = r1*random(0.5, 2);` | moderate | no long beams: shadows are short grainy halos hugging each circle (max ~1 circle radius long) | variants/shadowLength_2/frame_00001.png |
| shadowWobble_0.5 | `float amp = random(0.1)*random(1);` -> `float amp = random(0.5)*random(1);` | subtle | cones become broad twisted fans with rippled outer edges (outer arc spans ~90 deg instead of ~18); low pixel diff because cones are translucent | variants/shadowWobble_0.5/frame_00001.png |

## Modularisation notes
The generic core is the shadow cone: a fan of alpha-blended quads from a
circle's rim to a wobbly outer arc, with per-fragment hash stippling (needs a
PShader; the GLSL is 23 lines and trivially portable). `rcols` (unique
palette draw) is also reusable. One-off art decisions: the fixed 10-colour
palette, the 60-circle count, the double-circle motif, the fixed
`shw = 200` alpha (the `random(200)` above it is dead code, line 48).
A clean parameter object: {count, maxCircleSize (fraction of width),
innerCircleRange [0.1, 0.8], shadowLengthRange [0.5, 10], shadowWobble,
shadowAlpha, coneResolution, palette}.
