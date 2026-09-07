---
sketch: 2018/Generativos/caramelo
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1822
animated: false
techniques: [packing, curves]
primitives: [ellipse, shape]
palette:
  colors: ["#150427", "#4B3878", "#327BF3", "#62BCEE", "#C72987", "#BE0223", "#E87D02", "#FEC801", "#EEEBF5"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: dustMaxRelSize, default: 0.02, tried: [0.06], change: subtle, effect: "background dust arcs up to 3x larger; circle layout unchanged"}
  - {name: packMaxRelRadius, default: 0.5, tried: [0.25], change: large, effect: "no giant circles; denser field of many smaller, more uniform candies"}
  - {name: wedgeCountMax, default: 4, tried: [11], change: large, effect: "up to 11 glow wedges per circle; big translucent glows wash the whole image out"}
  - {name: nestedMaxRelSize, default: 0.2, tried: [0.35], change: large, effect: "inner dots up to 35% of parent size; sparser, chunkier dot clusters"}
  - {name: palette, default: "9 colours (warm+cool)", tried: ["5 cool colours"], change: large, effect: "cool-only image (navy/purple/blue/sky/off-white); background becomes sky blue"}
reusable_candidates:
  - {name: poissonDiskCircles, signature: "poissonDiskCircles(candidates, maxRelRadius, gapFactor) -> (x,y,r)[]", note: "rejection-sampled packing of non-overlapping circles; used twice (canvas + nested)"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, shd1, shd2)", note: "shaded annulus arc approximated by quads; used for glow wedges and soft rings"}
---

## What it draws
Full-bleed candy-like composition on a flat orange background (seed 42): many non-overlapping
circles of very different sizes (up to ~half the canvas) scattered over the whole surface. Each
big circle is a solid random-colour disc with a pale inner ring and a smaller inner coloured disc,
and the bigger ones contain a cluster of tiny circles built the same way. Around some big circles
are soft translucent coloured wedges (glows), and the background is dusted with thousands of tiny
thin arc strokes in random palette colours.

## How the code works
- `setup()` (caramelo.pde:3-8): 960x960 P3D, `smooth(8)`, `pixelDensity(2)` (ignored, stderr warning), calls
  `generate()` once. `draw()` is empty (9-12) so the sketch is static (frames 10/60 dropped as identical).
- `generate()`: `randomSeed(seed)` (23); `background(rcol())` (24) picks one palette colour (seed 42 -> orange).
- Layer 1, background dust (30-38): 10000 `noFill` arcs, size `width*random(0.02)`, random position, random
  palette stroke, random start angle and span up to 90 deg -> the scattered thin-arc texture.
- Layer 2, packing (44-60): 10000 candidate circles, radius `width*random(0.5)*random(0.5,1)` (0-50% of
  width); kept only if its centre is farther than `(p.z+s)*0.5` from every kept centre -> circles may touch
  but not overlap (quadratic rejection sampling).
- Layer 3, per kept circle (63-123):
  - `cc = int(random(-7,5))` (68) -> 0-4 glow wedges via `arc2` from radius `p.z` out to `p.z*random(1,7)`,
    random start/span up to ~216 deg, random palette colour, alpha 240 (69-73) -> soft coloured glows.
  - two dark soft full rings at `p.z+80` and `p.z+30` (74-75), a 1px offset shadow ellipse `fill(0,10)` (76-77),
    main disc `rcol()` at `p.z` (78-80), pale ring at `0.64*p.z` (82-83), inner disc at `0.6*p.z` (84-85).
  - Nested packing (87-106): 1000 attempts, small circles up to `0.2*p.z` within `0.3*p.z` of the centre,
    kept with gap factor 0.6 -> the dot clusters inside each big circle; each rendered with the same
    ring/disc/inner structure (107-122).
- `arc2` (126-144): approximates a shaded annulus segment by quads (`beginShape`/`endShape`), segment count
  proportional to arc length; produces the soft glow wedges and the soft dark rings.
- Colour: `rcol()` (154-156) picks uniformly at random from the 9-colour palette (153). `getColor()` (158-164)
  is defined but never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| bgscale_0.06 | `float s = width*random(0.02);` -> `float s = width*random(0.06);` | subtle | no visible change at a glance; the thin background arc strokes are slightly larger and a touch more visible, circles identical | variants/bgscale_0.06/frame_00001.png |
| maxsize_0.25 | `float s = width*random(0.5)*random(0.5, 1);` -> `...random(0.25)*random(0.5, 1);` | large | no circles larger than ~25% of width; many more, smaller, more uniform candies fill the field; layout reshuffled (packing consumes the random stream differently) | variants/maxsize_0.25/frame_00001.png |
| wedges_12 | `int cc = int(random(-7, 5));` -> `int cc = int(random(-7, 12));` | large | 0-11 glow wedges per circle instead of 0-4; large translucent colour glows overlap heavily and wash the image out, background barely visible | variants/wedges_12/frame_00001.png |
| innerSize_0.35 | `float s = p.z*random(0.2f);` -> `float s = p.z*random(0.35f);` | large | dots inside each candy up to 35% of the parent radius; clusters sparser and chunkier, some dots nearly fill the inner disc | variants/innerSize_0.35/frame_00001.png |
| palette_cool | `int colors[] = {#150427, ..., #EEEBF5};` (9 colours) -> 5 cool colours `#150427 #4B3878 #327BF3 #62BCEE #EEEBF5` | large | all discs, glows and the background drawn from the 5 cool colours only; image is navy/purple/blue/sky/off-white with no orange/red/yellow; background is sky blue | variants/palette_cool/frame_00001.png |

## Modularisation notes
- The packing loop (44-60) is generic: rejection-sampled circle packing, reusable as
  `poissonDiskCircles(candidates, maxRelRadius, gapFactor) -> (x,y,r)[]`. The same pattern recurs nested
  (87-106) with different parameters (gap factor 0.6, spread 0.3).
- `arc2` (126-144) is generic as-is: shaded annulus arc / glow wedge.
- The per-circle "candy" renderer (disc + pale ring + inner disc + shadow + wedges, 63-85) is the one-off art
  decision; parameterise as `{r, bodyColor, innerScale=0.6, ringScale=0.64, ringOffsets=[30,80], wedgeCount}`.
- Clean parameter object: `seed`, `bgColor`, dust `{count=10000, maxRelSize=0.02}`,
  packing `{candidates=10000, maxRelRadius=0.5, gapFactor=0.5}`,
  candy `{wedgeCountRange=[0,4], ringOffsets, innerScales}`,
  nested `{attempts=1000, maxRelSize=0.2, spread=0.3, gapFactor=0.6}`, `palette`.
