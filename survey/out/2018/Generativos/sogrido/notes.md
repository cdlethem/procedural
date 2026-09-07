---
sketch: 2018/Generativos/sogrido
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1823
animated: false
techniques: [shader, 3d-mesh, grid, noise-field]
primitives: [rect, shape]
palette:
  colors: ["#000000", "#0D0D52", "#401972", "#FF55A7", "#F59CD4", "#4CFDC6", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: grid, default: "random(100,300)", tried: [450], change: large, effect: "finer cells -> many small slabs, dense horizontal stripes, corridor look lost"}
  - {name: sizeAmp, default: 40, tried: [120], change: large, effect: "slabs 3x bigger, chunkier coarser masses with more overlap"}
  - {name: depthSpread, default: "random(800)", tried: [300], change: moderate, effect: "slabs concentrated near camera, flatter composition, crisp edges and white outlines stand out"}
  - {name: alp, default: "random(40,80)", tried: ["random(10,30)"], change: large, effect: "much more transparent slabs, paler ghostly image, background shows through"}
  - {name: cameraZ, default: 500, tried: [1000], change: large, effect: "viewpoint twice as far, slabs appear half size, dense small-slab mosaic fills canvas"}
reusable_candidates:
  - {name: noiseShadow, signature: "noiseShadow(displace) -> PShader", note: "fragment shader multiplying alpha by per-pixel hash noise (grain)"}
  - {name: shadowPlane, signature: "shadowPlane(x, y, w, h, blur, col, alpha)", note: "quad plus 4 trapezoids whose alpha fades to 0 (soft drop shadow)"}
  - {name: slabStack, signature: "slabStack(count, depth) -> void", note: "stacks rotated copies of a plane along -z"}
---

## What it draws
A 3D perspective view looking into a tilted canyon of translucent slabs: large flat
planes in mint/teal, magenta-pink and purple stacked at different depths, so they read
as a corridor receding into the distance. The background is a dark violet, the whole
image has a fine grainy noise texture, and edges look softly blurred (fake shadows).
Occasional thin near-white rectangle outlines sit on the field. Full-bleed, no margins.

## How the code works
- `setup()` (sogrido.pde:5-13) calls `generate()` once; `draw()` is empty, so the image
  is static (confirmed: baseline frames 10/60 identical).
- `generate()` sets the background to white lerped 30% toward a random palette colour
  (:28-30) — that is the dark violet ground. `noiseSeed`/`randomSeed` from `seed` (:32-33).
- A 90-degree perspective camera (:35-38) is translated to the centre at z=500 (:40)
  and given small random rotations (<= 0.1*TAU per axis, :42-44) — the overall tilt.
- Main loop, `grid*8` iterations (:77): a random grid cell (xx, yy) is picked on a
  grid of cell size `width*2/grid` (:52-53, :82-83); a 2-D Perlin noise sample scales
  the slab size by `int(1 + sizeAmp*no)` (:84-87), so high-noise areas get much larger
  slabs (clustered masses) and low-noise areas tiny ones.
- With 80% probability a thin stroked `rect` outline is drawn at the same cell
  (:94-95) — the white/pink rectangle outlines.
- Each slab is pushed back in z by `random(800)` (:100) and drawn by `plane()`
  (:122-172): one quad (random palette fill) plus four trapezoids whose far edge has
  alpha 0 — a fake soft shadow around the quad. A stack of `cc = random(2, 25)`
  rotated (HALF_PI) copies is extruded along z (:107-114), which produces the
  receding "corridor" look.
- Colours are uniform picks from the 6-colour list via `rcol()` (:217-221); slab alpha
  is `random(40, 80)` (:89), shadow trapezoids use the same alpha fading to 0.
- The custom shader (noiseShadowFrag.glsl:19-23) multiplies each pixel's alpha by
  `1 + pow(hash(fragCoord + displace), 0.8)`, a per-pixel hash noise; `displace` is
  re-randomised per slab (:79, :102). This gives the grainy, slightly blurred texture.
  (Display is `:2`, not xvfb, and the image is not flat, so the shader rendered.)

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_450 | `int grid = int(random(100, 300));...` -> `int grid = 450;` | large | dense field of small thin slabs stacked as near-horizontal stripes across the whole canvas; the receding corridor of the baseline is gone | variants/grid_450/frame_00001.png |
| sizeAmp_120 | `int sizeAmp = 40;` -> `int sizeAmp = 120;` | large | same layout but slabs ~3x larger: chunky, coarser masses, big flat regions, more overlap and occlusion | variants/sizeAmp_120/frame_00001.png |
| depth_300 | `translate(0, 0, -random(800));` -> `translate(0, 0, -random(300));` | moderate | slabs clustered close to the camera: flatter, fewer depth layers, crisp slab edges and white rect outlines clearly visible | variants/depth_300/frame_00001.png |
| alpha_10_30 | `float alp = random(40, 80)*1.;` -> `float alp = random(10, 30)*1.;` | large | same geometry, much fainter: slabs barely visible, pale washed-out version of the baseline | variants/alpha_10_30/frame_00001.png |
| camZ_1000 | `translate(width*0.5, height*0.5, 500);` -> `...1000);` | large | viewpoint twice as far: slabs render at half apparent size, so a dense mosaic of small slabs covers the whole frame with more background between them | variants/camZ_1000/frame_00001.png |

## Modularisation notes
- Generic: `noiseShadow` shader (grain-alpha filter, parameter `displace`); `plane()`
  shadow-quad builder (one quad + 4 fade trapezoids); the noise-driven grid placement
  (cell pick + noise-scaled size); the z-stacking loop.
- One-off art decisions: the 6-colour palette, the 90-degree FOV + z=500 framing, the
  0.8 white-outline probability, alpha 40-80, `sizeAmp` 40, depth spread 800, the
  0.1*TAU camera tilt.
- A clean parameter object: {grid, sizeAmp, ampDet, ampDes, depthSpread, alpha:[lo,hi],
  outlineProb, cameraZ, tilt, displaceSeed, palette}.
