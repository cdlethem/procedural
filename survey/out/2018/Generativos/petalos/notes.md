---
sketch: 2018/Generativos/petalos
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1644
animated: false
techniques: [polar, shader, dots-stippling]
primitives: [shape, ellipse]
palette:
  colors: ["#7FD1E2", "#4D2F53", "#E22570", "#30C09D", "#EAB300"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: clusterCount, default: 20, tried: [8], change: moderate, effect: "fewer rosettes; first 8 clusters keep their baseline positions, the rest are simply absent (large empty teal areas)"}
  - {name: maxPetalLayers, default: 24, tried: [12], change: large, effect: "re-rolls the whole composition (shared random stream); visible rosettes are shallower with fewer nested rings"}
  - {name: maxPetalsPerLayer, default: 20, tried: [40], change: moderate, effect: "same composition; more, finer petals per ring"}
  - {name: maxSpokes, default: 60, tried: [12], change: large, effect: "re-rolls the whole composition (shared random stream); spoke fans show fewer, shorter segments"}
  - {name: petalShadowAlpha, default: 30, tried: [120], change: subtle, effect: "same composition; speckled black shadow on petal edges clearly stronger"}
reusable_candidates:
  - {name: annularSector, signature: "annularSector(x, y, rOut, rIn, a1, a2, [alphaOut, alphaIn])", note: "fills an annular sector as a quad fan (arc2); two-vertex-ring alpha variant gives radial shadow gradients"}
  - {name: petalRosette, signature: "petalRosette(x, y, size, minLayers, maxLayers, palette, shadowAlpha)", note: "nested rings of random petal wedges shrinking toward center, with per-petal + per-ring grain-shaded shadow bands and optional center ellipse (generate(), lines 26-83)"}
  - {name: spokeFan, signature: "spokeFan(x, y, size, spokeCount, startAngle, span)", note: "radial burst of thin stroked arc segments from a center (lines 37-48)"}
  - {name: noiseShadow, signature: "shader(noi) // noiseShadowFrag.glsl", note: "PShader multiplying alpha by a per-pixel hash (fract(sin(dot(...)))) so flat black overlays become speckled grain"}
---

## What it draws
Full-bleed scatter of overlapping radial rosettes on a flat teal-green field (seed 42). Each rosette is a
stack of concentric petal rings in a 5-colour flat palette (light blue, dark purple, magenta, teal green,
yellow): wedge-shaped petal fans, large smooth ring bands (one huge dark-purple C-band dominates the
centre), radial spoke bursts, and solid centre discs. Shadow bands and petal edges carry a fine grainy
## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_8 | `for (int c = 0; c < 20; c++) {` -> `for (int c = 0; c < 8; c++) {` | moderate | sparser canvas with large empty teal areas; the visible rosettes (yellow fan top-left, magenta fan top-centre, purple C + yellow disc, light-blue disc top-left) sit at exactly the baseline positions — clusters 9-20 are simply missing | variants/count_8/frame_00001.png |
| sub_12 | `int sub = int(random(1, random(6, 24)));` -> `int sub = int(random(1, random(6, 12)));` | large | completely different composition (shared random stream re-rolled): rosettes with far fewer nested rings — big purple ring with a magenta disc, large flat magenta C, one small deep petal rosette bottom-left; mostly flat discs rather than deep nesting | variants/sub_12/frame_00001.png |
| cc_40 | `int cc = int(random(2, 20));` -> `int cc = int(random(2, 40));` | moderate | same composition as baseline (petal loop consumes no randoms); each petal ring has more, finer petals (up to 40 instead of 19) — the magenta burst bottom-left and spoke rings are visibly denser | variants/cc_40/frame_00001.png |
| ccc_12 | `int ccc = int(random(2, random(2, 60)));` -> `int ccc = int(random(2, random(2, 12)));` | large | completely different composition (shared random stream re-rolled): same overall style, but the visible spoke fans carry fewer, shorter segments | variants/ccc_12/frame_00001.png |
| shadow_120 | `arc2(x, y, ns, ms, ang, ang+da*amp, color(0), 30, 0);` -> `... color(0), 120, 0);` | subtle | same composition as baseline; the speckled black shadow on the outer petal edges is clearly stronger and grainier (alpha 120 vs 30) | variants/shadow_120/frame_00001.png |
`setup()` (petalos.pde:5) sizes 960x960 P2D, loads `noiseShadowFrag.glsl` as `noi` (line 10), and calls
`generate()` once; `draw()` is empty, so the sketch is static (baseline frames 10/60 identical to frame 1).

`generate()` (lines 26-83): background = one random palette colour (`rcol()`, line 139, from the fixed 5-colour
`colors[]` at line 138). `randomSeed(seed)` (line 29) makes it deterministic. Then 20 independent clusters
(line 32), each at a random `(x, y)` (lines 33-34) with radius `s = width*random(0.5,1.2)*random(0.2,1)`
(line 35):

1. **Spoke fan** (lines 37-48): `ccc` spokes (2..~60) around a random start angle `a1`, each a thin stroked
   `arc()` of span `da*random(1)` (line 45) — the radial line-bursts.
2. **Petal nesting** (lines 50-81): `sub` layers (1..~23). Each layer shrinks the ring size
   `ns = as*random(random(0.3,0.7),0.8)` (line 53), picks `cc` petals (2..19, line 57), a start angle `ia`,
   an angular step `da` (line 61), a fill fraction `amp` (line 62) and an inner radius `ms` between `ns` and
   `s` (line 63). Each petal is an annular sector between radii `ns` (outer) and `ms` (inner) drawn as a fan
   of quads by `arc2()` (line 67, def at 85), filled with one random palette colour. The same sector is then
   redrawn in black with alpha 30 (outer edge) fading to 0 (inner edge) through the `noi` shader (line 69) —
   a grainy shadow on each petal's outer edge. A full-ring shadow band `ns..as` is added the same way with
   alpha 10 (line 75) — this is what makes the big smooth C-bands when `ns`/`as` are large and close. With
   70% probability a filled ellipse of diameter `ns` is stamped in the centre (line 78) — the solid discs.

`arc2()` (lines 85-121) tessellates the sector into `cc = max(r1,r2)*PI*span` quads; the 7-arg overload
(lines 103-121) assigns the shadow colour/alpha to the two vertex rings separately, producing the radial
alpha gradient. The fragment shader (noiseShadowFrag.glsl:18-22) multiplies `color.a` by
`0.001 + pow(rand(gl_FragCoord.xy*0.001), 0.4)` where `rand` is a sin-dot hash — per-pixel speckle, i.e.
flat black overlays come out as stippled grain. `distance()` (line 124) is dead code, unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic / library-ready**: `arc2` as `annularSector` (with optional per-ring alpha for radial shadow
  gradients); the grain `PShader` (per-pixel hash-alpha multiplier) is a reusable `noiseShadow` effect;
  `rcol` is a trivial random-palette picker.
- **One-off art decisions**: the 20-cluster scatter, the specific 5-colour palette, the 0.7 probability of a
  centre ellipse, the shadow alphas (30 per petal, 10 per ring), the size-shrink distribution
  `random(random(0.3,0.7),0.8)`.
- **Clean parameter object**: `{clusters, sizeRange, maxLayers, petalsPerLayer, petalFillFraction,
  innerRadiusRange, spokeCount, petalShadowAlpha, ringShadowAlpha, centerDiscProbability, palette,
  background: 'random-from-palette'}`.
