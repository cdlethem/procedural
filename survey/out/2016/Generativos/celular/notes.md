---
sketch: 2016/Generativos/celular
year: 2016
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1109
animated: false
techniques: [grid, noise-field, dots-stippling, pixel-ops]
primitives: [ellipse, pixels]
palette:
  colors: ["#F0F0F0", "#0A0A0A"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sep, default: "random(10, 200*random(0.2,1))", tried: [40], change: large, effect: "much denser field of smaller circles, same cyan-centre to maroon-edge ramp"}
  - {name: d, default: "sep*0.1", tried: [0.35*sep], change: large, effect: "noticeably more scattered, wobbly positions; gaps between circles become uneven"}
  - {name: background, default: 240, tried: [20], change: large, effect: "dark charcoal ground; bright cyan/magenta field stands out, same circle layout"}
  - {name: radialBlurAmp, default: 5, tried: [15], change: subtle, effect: "edges and corners slightly softer; overall nearly identical to baseline"}
  - {name: speckleAlpha, default: 5, tried: [40], change: subtle, effect: "no visible change - speckle layer is hidden under the nearly opaque circle field"}
  - {name: circleScale, default: "sep*random(0.85,1.15)", tried: [0.45-0.6*sep], change: large, effect: "smaller circles with clear gaps; staccato dotted field, same radial ramp"}
reusable_candidates:
  - {name: rampColor, signature: "rampColor(c1, c2, c3, c4, v) -> color", note: "3-segment lerp ramp over [0,1] with breakpoints at 0.3 and 0.8"}
  - {name: radialBlur, signature: "radialBlur(amp) -> void", note: "per-pixel distance-weighted box blur, radius grows with distance from centre (pow 1.8)"}
  - {name: offsetGrid, signature: "offsetGrid(halfSep) -> points", note: "hex-style grid: rows offset by half the spacing on alternating rows"}
  - {name: noiseDisplace, signature: "noiseDisplace(x, y, detail, amp) -> point", note: "displace a point by noise angle * amp"}
---

## What it draws
A full-bleed field of soft-edged circles arranged in a hexagonally offset grid on a light
grey ground. Circle colour follows a radial ramp from the centre: pale cyan at the middle,
through periwinkle blue and mauve-purple, to deep magenta/maroon at the corners. Each circle
has a faint dark ring near its centre and the whole field has slightly wobbly positions and
very soft, blurred edges. A barely visible fine grey speckle texture sits under everything.

## How the code works
`setup()` (celular.pde:1-7) sets 960x960, a font (unused in the visible output), then calls
`generate()` once; `draw()` is empty so the piece is static (keyPressed regenerates).

`generate()` (lines 22-93):
1. `background(240)` light grey ground (line 24), then 10,000 tiny grey ellipses with alpha 5
   (lines 26-32) form the faint speckle texture.
2. The origin moves to the canvas centre with a random rotation (lines 34-35).
3. Four fully random RGB colours (lines 37-42) are pulled 20% toward a fifth random colour
   and progressively darkened (lines 45-48); this is the palette for the field.
4. Main loop (lines 57-90): rows step `j` by `sep*0.866` (hex row spacing, ~sqrt(3)/2, which
   the sketch prints at line 6), alternating rows shift `x` by `sep*0.5` (line 62) giving the
   offset/hex grid. Each point is displaced by `d = sep*0.1` along an angle from
   `noise(i*det, j*det)*TWO_PI*2` (lines 60-63) — a low-detail noise field driving the wobble.
   Circle size is `sep*random(0.85,1.15)` (line 65). Fill colour is `rampColor(cols, dist)`
   where `dist = dist(0,0,x,y)/(width*1.4)` (line 64) — the radial ramp (lines 126-134):
   c1→c2 over the inner 30%, c2→c3 to 80%, c3→c4 to the edge. Alpha is mapped from `sep`
   (line 67), so tighter grids paint more opaquely. Each circle then gets `sep*0.8` nested
   shrinking ellipses (lines 71-74, leftover that thickens the centre) and a small ring
   `stroke(10,30)` at `s*0.2` (lines 76-77).
5. `radialBlur(5)` (line 92; function at lines 95-123) is a per-pixel loop: for each pixel it
   averages a square window whose radius `cc` grows with `pow(dist_from_centre, 1.8)*amp`,
   weights fall off with `dist/amp`. This produces the soft, increasingly smeared edges
   toward the corners.

Randomness enters via the random rotation, the 5 random palette colours, the per-row random
rotation of the wobble field (det is random once), per-circle size jitter, and the initial
10,000 speckles. With a fixed seed everything is deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sep_40 | `float sep = random(10, 200*random(0.2, 1));` -> `float sep = 40;` | large (0.2511, 0.678) | dense field of small soft circles; cyan centre fading to periwinkle then deep maroon at the edges; hex offset still visible | variants/sep_40/frame_00001.png |
| d_0.35 | `float d = sep*0.1;` -> `float d = sep*0.35;` | large (0.171, 0.438) | same palette and ramp, but positions are much more irregular; circles drift off the hex lattice, gaps uneven, central cluster looser | variants/d_0.35/frame_00001.png |
| background_20 | `background(240);` -> `background(20);` | large (0.2921, 0.511) | near-black ground; circles keep cyan centre / magenta-mauve edge ramp and read much more brightly against the dark; corner speckle faintly visible | variants/background_20/frame_00001.png |
| blur_15 | `radialBlur(5);` -> `radialBlur(15);` | subtle (0.0262, 0.057) | no visible change at a glance; edges and outer corners marginally softer, centre unchanged | variants/blur_15/frame_00001.png |
| speckleAlpha_40 | `fill(random(170, 190), 5);` -> `fill(random(170, 190), 40);` | subtle (0.011, 0.001) | no visible change - the speckle layer sits under the circle field and is still invisible | variants/speckleAlpha_40/frame_00001.png |
| circleScale_0.5 | `float s = sep*random(0.85, 1.15);` -> `float s = sep*random(0.45, 0.6);` | large (0.3051, 0.68) | circles shrink to small dots with clear grey gaps; radial cyan-to-maroon ramp preserved, reads as a stippled mosaic | variants/circleScale_0.5/frame_00001.png |

## Modularisation notes
- `rampColor` (lines 126-134) is a clean, general multi-stop lerp — a ready library function.
- `radialBlur` (lines 95-123) is a self-contained pixel-ops pass; parameterising `amp` and the
  distance exponent would make it a general "soften outward" effect. Cost is high (full
  get()/set() per pixel, window up to (2*amp+1)^2) — a GPU shader or integral image would be
  the library version.
- The offset-grid + noise-displacement + radial-ramp-fill triple (lines 57-90) is the art
  core; a clean parameter object would be `{spacing, wobbleDetail, wobbleAmp, sizeJitter,
  palette[4], rampStops, background, speckleCount, speckleAlpha, blurAmp}`.
- One-off art decisions: the 5-random-colour palette construction (lines 37-48), the
  `map(sep,180,0,10,40)` alpha coupling (line 67), the unused nested-ellipse loop (lines
  71-74), and the commented-out triangle block (lines 79-88).
