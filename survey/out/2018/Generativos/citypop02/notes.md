---
sketch: 2018/Generativos/citypop02
year: 2018
renderer: P3D
size: [640, 640]
libraries: []
deterministic: true
ms_first_frame: 1670
animated: false
techniques: [noise-field, particles, grid, packing]
primitives: [rect, line, ellipse, shape]
palette:
  colors: ["#0E2857", "#016DAB", "#24A2C9", "#1DAEE2", "#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E", "#E3CEB5", "#6E9ADB", "#A7E8DE"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: balloon size range, default: "random(0.02, 0.1)", tried: ["random(0.02, 0.25)"], change: "", effect: ""}
  - {name: city width w, default: 160, tried: [320], change: "", effect: ""}
  - {name: buildings per city cc, default: 8, tried: [20], change: "", effect: ""}
  - {name: flowers mound height hh, default: 0.2, tried: [0.5], change: "", effect: ""}
  - {name: airplane trail alpha, default: 2, tried: [30], change: "", effect: ""}
  - {name: cityCount, default: "int(random(1, 4))", tried: [6], change: "", effect: ""}
reusable_candidates:
  - {name: poissonScatter, signature: "poissonScatter(n, area, minDist) -> PVector[]", note: "rejection-based Poisson disc scatter used for balloons, clouds and flowers"}
  - {name: noiseRidgeSilhouette, signature: "noiseRidge(y, h, det, des) -> shape", note: "1-D noise sampled per-pixel to build a closed mountain ridge (montains/montainsBack)"}
  - {name: noiseBandSpeckle, signature: "noiseBandSpeckle(hor, hh, det, n, palette) -> void", note: "thousands of low-alpha ellipses gated by a 1-D noise band, accumulating into a textured mound (flowers/grass)"}
  - {name: lerpPalette, signature: "getColor(v) -> color", note: "cyclic lerp through a fixed 5-colour list by floating index"}
---

## What it draws

Flat, storybook-style landscape at dusk: a smooth vertical sky gradient from dark blue at the
top to teal at the horizon, dotted with scattered balloon-like circles (red, orange, blue,
black) of varying sizes, each with a tiny dark basket square beneath. Faint thin white streaks
with dotted trails cross the sky (airplanes) and very pale cloud smudges sit mid-sky. On the
horizon a small white-and-blue striped city block stands on a cream/sand ground strip that fills
the lower quarter. The ground is crowded with tiny multicoloured dots (people) and thin black
spikes (trees). At the very bottom, two dark green mounds made of dense speckles rise up, with a
few tiny coloured flower dots on them.

## How the code works

`setup()` calls `generate()` once; `draw()` is empty, so the piece is static (citypop02.pde:2-11).
`randomSeed(seed)`/`noiseSeed(seed)` make it deterministic (citypop02.pde:23-24). P3D is used but
only 2-D primitives are drawn, plus `hint(DISABLE_DEPTH_TEST)`.

Layers, in order, inside `generate()` (citypop02.pde:21-98):
1. **Sky** (28-35): a single closed quad filled with `lerpColor(#0E2857, #016DAB)` at the top
   edge and `lerpColor(#24A2C9, #1DAEE2)` at the bottom — the vertical blue→teal gradient.
2. **Airplanes** (40-44): 10 `airplane()` calls (198-211) — a long `line()` plus a shrinking
   trail of `ellipse()`s, all `fill(255, 2)` so nearly invisible; the faint streaks in the sky.
3. **Horizon mountains** (46-49): two `montains()` ridges (`fill(0, 40)`), each a closed shape
   whose top edge is `-noise(...)` sampled once per pixel column (montains.pde:13-23).
4. **Clouds** (51-54): `int cc = int(random(120))` calls to `cloud()` (clouds.pde:1-30): each
   scatters up to 6000 candidate points with Poisson-style rejection (min dist 2), shaped by a
   sine envelope and noise, then draws ellipses with alpha `random(40,180)*0.012` ≈ 0.5-2.2/255 —
   hence barely visible.
5. **Balloons** (60, formsSky.pde:1-26): 100 Poisson-scattered points (min dist `(s+o.z)*0.6`),
   size `width*random(0.02,0.1)` scaled by `map(y,0,height,1,0.3)` so higher = bigger; 20% are
   skipped; colour from the 5-colour `colors[]` list (citypop02.pde:217) with alpha 180-255, plus
   a small black basket `rect` below.
6. **Ground strip** (62-65): one `rect` from the 5-colour `suelo[]` list (cream here).
7. **Speckle field** (67-74): 1000 ellipses from `{#EFB9B7, #67A5C2, #0F9A5E}` at alpha up to 200
   scattered over the whole canvas (faint dots over sky and ground).
8. **City** (76-79): `cityCount = int(random(1,4))` cities; `city()` (city.pde:1-37) draws 8
   buildings (white `#EDE9EE`/`#C6E3EF`/`#FBE1DF` rects with `#0086B9` window stripes), a shadow
   side, and a noise-jittered dark base strip.
9. **People and trees** (81-95): 1000 attempts in the ground band (`lerp(hor,height,vy)`); a
   2-D noise gate at detail 0.01 picks tree (noise<0.5, 95% pass) vs person. `tree()` (100-111)
   draws one thin black triangle (`limb`) — the spikes. `person()` (152-196) walks a straight
   line from ground to a head point, drawing two angled leg `line()`s per step with width
   `s*0.3*pow(sin(...), pwr)`, colour lerping toward a `getColor()` value — the tiny multicolour
   dots.
10. **Mound / flowers** (97, flowers.pde:2-43): `flowers(height)` places 100000 tiny grass
    ellipses (`#262A29`/`#184739`, alpha 20) gated by a 1-D noise band of height `hh=0.2` of the
    canvas at the bottom; the dense overlap accumulates into the dark green mounds. Then ~1000
    flower dots (`#E4D548`, `#175632`, `#B23A78`) are Poisson-scattered (min dist 2) in the same
    band — the small coloured specks on the mounds.

Colour is always picked by `int(random(list.length))` from fixed literal arrays (random-from-list),
with a few fixed lerp pairs for the sky.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes

- **Generic / library candidates**: the Poisson rejection scatter (formsSky.pde:3-16,
  clouds.pde:14-22, flowers.pde:26-33) is repeated three times with different min-dist rules and
  is the clearest reusable function; `noiseRidge` (montains.pde) is a clean 1-D-noise silhouette
  generator; the noise-band speckle mound (flowers.pde:8-17) is a reusable "texture a region by
  density" primitive; `getColor` (citypop02.pde:225-230) is a small cyclic palette-lerp helper.
- **One-off art decisions**: the fixed scene layout (horizon at `height*random(0.8,0.9)`, layer
  order, sky gradient pairs, the `colors[]`/`suelo[]`/grass/flowers literal palettes), the
  airplane/person/tree silhouette shapes, and the near-zero alphas chosen for clouds/airplanes.
- **Parameter object**: `{seed, horizonFrac (0.8-0.9), balloonCount 100, balloonSizeRange
  (0.02-0.1), airplaneCount 10, cloudCount 0-119, cloudAlphaScale 0.012, cityCount 1-3,
  cityWidth 160, buildingsPerCity 8, personTreeNoiseDetail 0.01, groundSpeckleCount 1000,
  moundHeightFrac 0.2, grassCount 100000, flowerCount 1000, palettes {colors, suelo, grass,
  flowers, city}}`.
