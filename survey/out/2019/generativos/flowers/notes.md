---
sketch: 2019/generativos/flowers
year: 2019
renderer: P3D
size: [960, 960]
libraries: [peasy, triangulate, toxi]
deterministic: true
ms_first_frame: 1507
animated: false
techniques: [spiral, polar, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#EF3621", "#295166", "#C9E81E", "#0F190C", "#F5FFFF"]
  selection: lerp-between
composition: radial
parameters:
  - {name: turns, default: "random(5,9)", tried: ["random(12,14)"], change: subtle, effect: "tighter winding, but silhouette and colour unchanged (0.1% of pixels)"}
  - {name: div, default: 8, tried: [16], change: large, effect: "flatter, more concentric; outer band reaches canvas edge"}
  - {name: s, default: "width*0.4", tried: ["width*0.25"], change: moderate, effect: "smaller flower, more white margin"}
  - {name: sub, default: 300, tried: [600], change: large, effect: "finer winding; colour drift per point doubles -> saturated red instead of pale pink"}
  - {name: colors, default: ["#EF3621","#295166","#C9E81E","#0F190C","#F5FFFF"], tried: ["#333A95","#FFDC15","#FC9CE6","#31F5C2","#1E9BF3"], change: large, effect: "monochrome steel blue (lerp between the two blue neighbours dominates)"}
reusable_candidates:
  - {name: spiralStrip, signature: "spiralStrip(turns, sub, div, radius, zStep) -> void", note: "concentric quad-strip spiral coil with per-vertex radius decay and z stacking"}
  - {name: cyclingColor, signature: "getColor(float v) -> color", note: "maps a scalar to lerp-between adjacent palette entries, wrapping"}
---

## What it draws
A soft 3D spiral flower ("rose") centered in the frame, seen from a low camera angle so the coil recedes in depth. Dominant colours: pale salmon/pink outer bands, a slightly more saturated salmon-coral inner spiral, on a near-white very pale pink background. The spiral makes several turns, with each successive layer of the coil slightly larger in radius and stacked a step further in z, giving a shallow bowl/cone shape. No strokes; the form is built entirely from filled quads.

## How the code works
- `settings()` (lines 19-24): P3D canvas 960x960, `smooth(8)`. `setup()` (26-35) creates a `PeasyCam(this, 400)` (line 28) and calls `generate()`; `draw()` (37-39) calls `generate()` every frame, but since `randomSeed`/`noiseSeed` are reset from a fixed `seed` (51-52) every frame is identical (baseline frames 10/60 dropped as identical).
- `flower()` (62-95): `s = width*0.4`, `r = s*0.5` (radius of the biggest spiral), `turns = random(5,9)` (line 66), `sub = 300` spiral subdivisions (line 67), `div = 8` stacked layers (line 68). `da = TAU*turns/sub` is the angular step; `hh = s/div` the per-layer z step.
- Outer loop over `div` layers (78-94): each layer is one `beginShape(QUAD_STRIP)`. The layer's radial scale is `ddr = pow(map(j,0,div,0,1), 1.8)` (line 80), so layer j is a copy of the spiral scaled to `ddr` of full radius; its z offset is `hh*j` (lines 89-91, with a per-vertex 0.9-1.8-power easing in lines 85-86), stacking the coils into a shallow cone the camera views in perspective.
- Inner loop over `sub` points (82-92): radius profile `r1 = pow(map(i,sub,0,0,1),1.4)^2 * r * ddr1` (line 83) — the spiral starts tight at the center and unwinds to full radius; vertex position is polar `(cos(ang)*r1, sin(ang)*r1, z)` with `ang = da*i` (lines 87-91).
- Colour: `fill(getColor(ic1+dc1*i + ic2+dc2*j))` (line 88). `ic1`/`ic2` are random palette indices (72-73); `dc1`/`dc2` are small random drift rates (74-75) so the colour index moves along the spiral and across layers. `getColor(float)` (113-119) wraps `v` into the 5-colour palette and `lerpColor`s between adjacent entries with a quadratic ease, so visible colours are always blends of neighbouring palette neighbours (with seed 42 the lerp between #F5FFFF and #EF3621 dominates, producing the salmon/pink bands).
- `background(255)` (54) plus the near-white outer blends give the pale background.

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| turns_12 | `float turns = random(5, 9);` -> `float turns = random(12, 14);` | subtle | no visible change: same silhouette and pale-pink colour, winding marginally denser | variants/turns_12/frame_00001.png |
| div_16 | `int div = 8;` -> `int div = 16;` | large | flatter, more concentric rings; outer band now reaches the canvas edges, spiral centre shifted slightly up | variants/div_16/frame_00001.png |
| scale_0.25 | `float s = width*0.4;` -> `float s = width*0.25;` | moderate | smaller flower; outer band no longer touches the canvas edges, more white margin | variants/scale_0.25/frame_00001.png |
| sub_600 | `int sub = 300;` -> `int sub = 600;` | large | finer, denser winding with a small tight central coil; colour drift per point doubles so the palette cycles faster -> saturated red/salmon instead of pale pink | variants/sub_600/frame_00001.png |
| colors_alt | `int colors[] = {#EF3621, #295166, #C9E81E, #0F190C, #F5FFFF};` -> `int colors[] = {#333A95, #FFDC15, #FC9CE6, #31F5C2, #1E9BF3};` | large | monochrome steel-blue spiral on a blue ground; the lerp between the two blue palette neighbours dominates | variants/colors_alt/frame_00001.png |

## Modularisation notes
- Generic: the whole `flower()` is a parameterisable primitive — a "stacked spiral coil" (turns, subdivisions, layer count, radius, z step, per-vertex radius exponent 1.4 and layer-scale exponent 1.8). With `turns`/`div`/`s`/exponents as parameters it could render flowers, shells, or vortices.
- Generic: `getColor(float)` (cycling lerp-between palette sampler) is a standalone colour function; the commented palette variants (lines 102-106) show it is meant to be swapped freely.
- One-off art decisions: the specific palette, the exponent values (1.4/1.8/2) shaping the petal falloff, camera distance 400, and the seed-based regeneration-on-every-key behaviour.
- Clean parameter object: `{turns, sub, div, radius, zStep, radiusExponent, layerScaleExponent, palette, colorDrift1, colorDrift2, seed}`.
