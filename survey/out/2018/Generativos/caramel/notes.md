---
sketch: 2018/Generativos/caramel
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1855
animated: false
techniques: [packing, dots-stippling]
primitives: [ellipse, shape]
palette:
  colors: ["#01903B", "#FEE643", "#F3500A", "#0066B8", "#583106", "#F4EEE0"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: "random(random(200000))", tried: [60000], change: large, effect: "fewer attempts -> sparser dot field, large empty brown areas"}
  - {name: maxSizeFrac, default: 0.3, tried: [0.6], change: large, effect: "width*random(maxSizeFrac): bigger circles, canvas nearly fully covered by large dots"}
  - {name: gapFactor, default: 0.6, tried: [1.5], change: moderate, effect: "(ss+p.z)*gapFactor rejection: wider minimum gap -> circles spaced further apart, diagonal shadow bands more visible"}
  - {name: shadowLen, default: 3, tried: [8], change: none, effect: "sx/sy multiplier for shadow tails: no visible change; opaque circles painted over the shadow region"}
  - {name: shadowAlpha, default: 20, tried: [90], change: none, effect: "alpha of first shadow parallelogram: no visible change at this scale"}
reusable_candidates:
  - {name: poissonCircles, signature: "poissonCircles(w, h, maxSize, minGap, attempts) -> PVector[]", note: "rejection-based non-overlapping circle placement used for the dot field"}
  - {name: alphaRing, signature: "alphaRing(x, y, r1, r2, col, alp1, alp2) -> void", note: "the arc2() helper: a ring built of small quads with alpha interpolated between inner and outer radius"}
---

## What it draws
A full-bleed caramel-brown field scattered with many circles of widely varying
sizes, non-overlapping and loosely clustered. The circles are drawn from a six-colour
palette — green, yellow, orange, blue, and cream — over the brown ground. Each circle
carries a soft dark shadow tail cast in one global direction and faint ring halos, so
the field reads as flat confetti dots with a light depth/emboss quality.

## How the code works
`setup()` (caramel.pde:3) sets a 960×960 P2D canvas and calls `generate()` once; `draw()`
is empty, so the piece is static.

`generate()` (caramel.pde:22):
- `background(rcol())` (line 23) fills the ground with one random palette colour (here
  the brown `#583106`).
- A single global shadow direction `ang = random(PI*0.2, PI*0.8)` (line 25) is picked once.
- A Poisson-disk-style placement loop (lines 30–73): it tries
  `cc = int(random(random(200000)))` candidate points. Each candidate gets a random
  position `(xx, yy)` (lines 32–33) and a random size `ss = width*random(0.3)` (line 34).
  It is rejected if it lies within `(ss + p.z)*0.6` of any already-accepted point (lines
  37–44); accepted points are stored as `PVector(x, y, size)`.
- For every accepted point it first draws the dark shadow artifacts: two black `arc2`
  rings (lines 52–53) giving a faint dark halo, and two black `beginShape` parallelograms
  (lines 55–72) stretched along the shadow direction via `sx/sy = cos/sin(ang)*ss*3`
  (lines 47–50) — these are the soft cast shadows.
- A second loop (lines 75–82) paints each accepted circle: a `fill(rcol())` `ellipse`
  (lines 77–78) plus three random-coloured `arc2` rings at `p.z*0.7`, `p.z*3`, `p.z*1.4`
  (lines 79–81), which produce the highlight/halo rings around the dots.

`arc2()` (caramel.pde:86) builds a ring out of many small quads spanning inner radius
`r1` and outer radius `r2`, interpolating alpha from `alp1` (inner) to `alp2` (outer).
Colour is always chosen randomly from the six-colour `colors[]` array via `rcol()`
(caramel.pde:111–114); the lerp-based `getColor()` is defined but never used.

Randomness enters at the seed, the global `ang`, every candidate's x/y/size, and each
`rcol()` call.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_60000 | `int cc = int(random(random(200000)));` -> `...random(random(60000)));` | large | much sparser: far fewer circles, large empty brown areas; one faint shadow circle remains | variants/cc_60000/frame_00001.png |
| maxSize_0.6 | `float ss = width*random(0.3);` -> `...random(0.6);` | large | circles much bigger (up to ~half canvas), field nearly fully covered by large dots | variants/maxSize_0.6/frame_00001.png |
| gapFactor_1.5 | `(ss+p.z)*0.6` -> `(ss+p.z)*1.5` | moderate | wider gaps between circles; diagonal cast-shadow streaks more visible as separated bands | variants/gapFactor_1.5/frame_00001.png |
| shadowLen_8 | `cos(ang)*ss*3` / `sin(ang)*ss*3` -> `*8` | none | no visible change (0.0 px); longer shadow tails not perceptible, opaque circles cover the shadow | variants/shadowLen_8/frame_00001.png |
| shadowAlpha_90 | `fill(0, 20);` -> `fill(0, 90);` | none | no visible change (0.0 px); stronger shadow alpha not perceptible at this scale | variants/shadowAlpha_90/frame_00001.png |

## Modularisation notes
The placement loop (lines 30–73) is the reusable core: a generic
`poissonCircles(w, h, maxSize, minGap, attempts)` that returns accepted centres + sizes.
`arc2()` is a self-contained ring primitive worth keeping as `alphaRing`. The one-off art
decisions are the fixed six-colour palette, the single global shadow angle, the shadow-tail
parallelograms, and the specific ring radii/multipliers. A clean parameter object would hold:
`attempts`, `maxSizeFrac` (0.3), `gapFactor` (0.6), `shadowAngle`, `shadowLen` (3),
`shadowAlpha`, `palette`, and `bgColor`.
