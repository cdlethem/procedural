---
sketch: 2019/generativos/floreros
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1489
animated: false
techniques: [particles, 3d-pointcloud, noise-field, spiral]
primitives: [ellipse]
palette:
  colors: ["#EB4313", "#E9CA54", "#684C61", "#749AB2"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: dotCount, default: 900, tried: [300], change: subtle, effect: "field ~1/3 as dense; same colour patches and spiral clusters, more background showing"}
  - {name: sizeScale, default: 20, tried: [40], change: moderate, effect: "all dots 2x diameter, heavy overlap into dense clumps, painted area ~3x baseline"}
  - {name: detType, default: 0.01, tried: [0.002], change: subtle, effect: "noise field nearly constant: dot size and colour become almost uniform across the canvas"}
  - {name: palette, default: "EB4313 E9CA54 684C61 749AB2", tried: ["89EBFF 8FFF3F EF2F00 3DFF53 FCD200"], change: moderate, effect: "same dot layout recoloured bright green/red-orange/yellow; background tint turns dark green"}
  - {name: rotateX, default: "PI*random(0.15,0.3)", tried: ["PI*random(0.5,0.7)"], change: subtle, effect: "dots flatten into thinner slivers, less overall painted coverage"}
reusable_candidates:
  - {name: paletteLerp, signature: "getColor(v, colors[]) -> int", note: "wrap v into palette, lerp between adjacent entries by v%1 (colour drift along a walk)"}
  - {name: tiltedDotField, signature: "tiltedDotField(count, gridStep, noiseScale, sizeRange) -> void", note: "noise-typed 3D dots snapped to a coarse grid, each dot a colored ellipse plus an offset black crescent for a 3D-look"}
---

## What it draws
A near-black warm-brown field scattered with a few hundred small dots. Most dots are
flat ellipses (they read as discs seen at an angle) in orange, mustard yellow, dull mauve,
and grey-blue; size grows in noise-driven patches, from small specks near the top to
larger discs toward the bottom. Many dots carry a thin black crescent biting into their
lower edge, which makes them look like little spheres or coins. Thin curved slivers and
small tight clumps of overlapping dots (the "spiral" clusters) are sprinkled across the
whole canvas.

## How the code works
`generate()` (floreros.pde:54) runs on every frame in `draw()` but re-seeds with the same
`seed` each time (lines 59-60), and `millis()` is never used, so every frame is identical
(static output).

1. Background `#0A0D0B`, then a full-canvas quad filled with a random palette colour at
   alpha 40 (lines 62-77) — this tints the dark background warm brown.
2. Perspective camera set with fov PI/3 (lines 81-84); scene translated to
   (width*0.5, height*0.7) with tiny random tilts (lines 88-96).
3. "Flower" spirals (lines 99-128): 100 walks, each of 100 steps, positioned at z=-2000
   (far away, so they appear small). Each step grows a dot from `pow(map(j,0,100,0.1,1),2)*ss`
   (line 116) along a slowly curving angle `ang += da` with damping `da *= ma` (lines 118-119),
   drawing an ellipse with colour drifting through the palette via `getColor(ic+dc*j)`
   (line 124). This produces the tight clusters and thin curved slivers.
4. Main dot field (lines 133-197): 900 points at random positions snapped to a 10-unit
   grid (lines 134-140). A 3D noise sample `noise(...)*4` (line 142) sets `type`, which
   picks the colour via `getColor(type)` (line 144) and the size `s=(type+1)*20` (line 146)
   — so colour and size are correlated, and both vary smoothly across the canvas.
   Each dot is drawn as two overlapping ellipses: a black one offset 1px down (lines 167-169)
   then the colour one on top (lines 170-171), giving the crescent "sphere" shading.
   `rotateX(PI*random(0.15, 0.3))` (line 154) flattens each disc; the commented-out
   `sub` spokes (lines 174-195) are disabled, so no radiating lines are drawn.

`getColor(float)` (lines 221-227) wraps its argument into the 4-colour palette and lerps
between adjacent entries, so a drifting scalar yields smooth colour walks.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count900_300 | `for (int i = 0; i < 900; i++)` -> `for (int i = 0; i < 300; i++)` | subtle | field about one-third as dense; same colour patches and spiral clumps, much more background visible | variants/count900_300/frame_00001.png |
| size20_40 | `float s = (type+1)*20;` -> `float s = (type+1)*40;` | moderate | every dot 2x in diameter; dots overlap into dense clumps, painted area ~3x the baseline | variants/size20_40/frame_00001.png |
| detType_0.002 | `float detType = random(0.01);` -> `float detType = random(0.002);` | subtle | dot size and colour become nearly uniform across the canvas (noise effectively constant); positions unchanged | variants/detType_0.002/frame_00001.png |
| palette_cool | `int colors[] = {#EB4313, #E9CA54, #684C61, #749AB2};` -> `int colors[] = {#89EBFF, #8FFF3F, #EF2F00, #3DFF53, #FCD200};` | moderate | identical dot layout recoloured bright green / red-orange / yellow-olive; background tint turns dark green (alpha-40 random palette quad) | variants/palette_cool/frame_00001.png |
| rotateX_0.6 | `rotateX(PI*random(0.15, 0.3));` -> `rotateX(PI*random(0.5, 0.7));` | subtle | dots flatten into thinner slivers; overall painted coverage drops (9.9% vs 14.9% of pixels) | variants/rotateX_0.6/frame_00001.png |

## Modularisation notes
- Generic: `getColor` palette-lerp (works for any int[] palette); the grid-snapped,
  noise-typed dot field (count, grid step, noise scale, size multiplier, shadow offset are
  all trivially parameterisable); the damped-angle "spiral walk" (step count, start size,
   angular velocity, damping) is a reusable scatter primitive.
- One-off art decisions: the specific 4-colour palette, the z=-2000 push for the spirals,
  the alpha-40 background tint, the 1px black crescent shading, the fov/camera setup.
- A clean parameter object: `{count, gridStep, noiseScale, sizeScale, palette, shadowDy,
  spiralCount, spiralSteps, spiralSize, spiralDamping}`.
