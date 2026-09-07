---
sketch: 2019/generativos/lalalan
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1489
animated: false
techniques: [grid, noise-field, shader, lines-hatching, dots-stippling, polar]
primitives: [rect, line, ellipse, shape]
palette:
  colors: ["#333A95", "#FFDC15", "#FC9CE6", "#31F5C2", "#1E9BF3"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: gridStep, default: 20, tried: [40], change: large, effect: "coarser mosaic grid; grid dots/squares and big-patch positions sparser and more open"}
  - {name: bigPatchProb, default: 0.06, tried: [0.12], change: large, effect: "fuller, more saturated colour field with less white showing"}
  - {name: lineCount, default: 1000, tried: [400], change: moderate, effect: "sparser bright line web; fewer thin H/V lines"}
  - {name: targetCount, default: 40, tried: [100], change: moderate, effect: "about 2.5x more bullseye targets and pie wedges"}
  - {name: targetSizeMul, default: 6, tried: [2], change: subtle, effect: "targets and wedges on average smaller; look still dominated by mosaic and lines"}
reusable_candidates:
  - {name: noiseGridMosaic, signature: "noiseGridMosaic(step, bigProb, smallProb, palette, alpha) -> void", note: "20px grid loop drawing translucent rects + gradient quads + grid dots at each cell"}
  - {name: gridLines, signature: "gridLines(count, snap, lenRange, palette) -> void", note: "grid-snapped random horizontal/vertical line web"}
  - {name: bullseyeTarget, signature: "bullseyeTarget(x, y, s, wedges, palette) -> void", note: "concentric ellipse target with optional angular pie-slice wedges"}
  - {name: arcSector, signature: "arcSector(x, y, r1, r2, a1, a2, color, a1_, a2_) -> void", note: "filled annular sector built from QUADS between two radii/angles"}
---

## What it draws
A full-bleed white field tiled with a soft mosaic of overlapping translucent colour
patches (yellow, pink, cyan, blue, green) of varying size and opacity. Over this sits a dense
web of thin bright horizontal and vertical lines snapped to a 20px grid, with faint dark
dots at nearly every grid intersection. Scattered across the canvas are about forty "bullseye"
targets — concentric filled circles (a coloured disc, a smaller coloured disc, a white centre
dot) — several of which sprout one or more triangular pie-slice wedges. A per-pixel random
grain dithers the whole image, giving the colour patches a speckled, halftone texture.

## How the code works
`settings()` (l.16-21) makes a 960x960 P2D window with `smooth(8)` and `pixelDensity(2)`.
`setup()` (l.23-33) loads `noiseTextureFrag.glsl` as `noise` and calls `generate()`; `draw()`
is empty, so the sketch is static (frames 10/60 are identical to frame 1).

`generate()` (l.56-148) seeds `randomSeed`/`noiseSeed` (l.58-59), fills white (l.61), sets
`rectMode(CENTER)` and activates the shader (l.63-65). The shader (`noiseTextureFrag.glsl`
l.18-25) multiplies each fragment's red channel and alpha by a per-pixel `rand()` grain
(`noi = 1 - pow(rand((gl_FragCoord.xy+displace)*0.001), 3)`), which produces the dithered
texture; `displace` is re-randomised before each shape (l.70,76,78) to desynchronise the grain.

1. **Grid mosaic** (l.68-94): a double loop stepping 20px in both axes. At each grid point,
   with prob 0.06 it draws a large 180x180 translucent `rect` (l.77) plus a two-colour `gradient`
   quad (l.79, helper l.150-161) and a 20x20 rect (l.82) — these are the soft colour patches.
   With prob 0.2 it draws a small 10x10 or 5x5 square (l.84-88). Unconditionally it draws 4x4 and
   2x2 near-black rects (l.89-91) — the faint dots at every intersection.
2. **Line web** (l.96-110): 1000 iterations of a random grid-snapped point (`x -= x%20`, l.102)
   drawing one horizontal or vertical `line` of length 10*rand(1,9) on each side (l.99-109),
   stroked `rcol()` — the thin bright grid lines.
3. **Bullseye targets** (l.116-147): 40 iterations of a random grid-snapped point. Size `s` is
   `noise(des+x*det, des+y*det)*width*0.02` (l.121) and multiplied by 6 with prob 0.8 (l.123).
   It draws `cc = int(random(-5,3))` pie wedges via `arc`/`arc2` (l.131-138, helper l.163-180
   builds a filled annular sector from QUADS), a faint dark full ring (l.140), then three concentric
   ellipses `s`, `0.5s`, `0.1s` (white) for the target (l.141-146).

Colour: `rcol()` (l.192-194) picks a uniform random entry from the 5-colour `colors[]` array
(l.190: `#333A95 #FFDC15 #FC9CE6 #31F5C2 #1E9BF3`). Alpha varies per shape (`random(200)*random(1)`
for patches, `200` for wedges/target discs). No blend modes beyond default alpha transparency.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| gridStep_40 | `for (int j = 0; j < height; j+= 20)` -> `j+= 40` | large | coarser mosaic grid: faint grid dots/squares and big-patch positions sit on a 40px grid, sparser and more open; line web and targets unchanged | variants/gridStep_40/frame_00001.png |
| bigPatchProb_0.12 | `if (random(1) < 0.06)` -> `< 0.12` | large | double the big-patch probability: fuller, more saturated colour field with far less white showing between patches | variants/bigPatchProb_0.12/frame_00001.png |
| lineCount_400 | `for (int i = 0; i < 1000; i++)` -> `i < 400` | moderate | sparser bright line web: fewer thin horizontal/vertical lines, more of the mosaic shows through the line layer | variants/lineCount_400/frame_00001.png |
| targetCount_100 | `for (int i = 0; i < 40; i++)` -> `i < 100` | moderate | about 2.5x more bullseye targets and pie-slice wedges scattered across the canvas; busier circle layer | variants/targetCount_100/frame_00001.png |
| targetSizeMul_2 | `if (random(1) < 0.8) s *= 6;` -> `s *= 2;` | subtle | bullseye targets and their wedges are on average smaller, but the overall look is still dominated by the unchanged mosaic and line web | variants/targetSizeMul_2/frame_00001.png |

## Modularisation notes
Generic, library-ready: the grid-mosaic loop (step, big/small probabilities, palette, alpha range),
the grid-snapped line web (count, snap, length range), and the bullseye target + `arcSector` helper
(angle span, two radii, two alphas). All three take a palette and a random generator and are
independent of each other — clean parameter objects: `{step, bigProb, smallProb, dotAlpha}` for the
mosaic, `{count, snap, lenMin, lenMax}` for the lines, `{count, sizeMin, sizeMax, wedgeProb, wedgesMax}`
for the targets. One-off art decisions: the specific 5-colour palette, the exact alpha expressions,
the `*0.3`/`*0.02` size normalisation, the `s *= 6` at prob 0.8, and the shader's `displace`
desync. The `getColor` lerp-between-adjacent palette function (l.195-203) is a nice reusable
gradient-palette helper not used by the baseline path.
