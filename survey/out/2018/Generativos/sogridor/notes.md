---
sketch: 2018/Generativos/sogridor
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1676
animated: false
techniques: [grid, 3d-mesh, distortion, pixel-ops]
primitives: [rect, pgraphics]
palette:
  colors: ["#000000", "#0D0D52", "#401972", "#FF55A7", "#F59CD4", "#4CFDC6"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: grid, default: "random(30,80)", tried: [20], change: large, effect: "fewer, larger cards; sparser composition"}
  - {name: sizeAmp, default: 40, tried: [10], change: large, effect: "smaller, more uniform cards; busier fine-grained texture"}
  - {name: cc, default: "random(2,25)", tried: [5], change: large, effect: "fewer stacked copies per card; flatter, less layered look"}
  - {name: alp, default: "random(40,80)*1.2", tried: [160], change: large, effect: "more opaque, bolder, more saturated card fills"}
  - {name: depth, default: "random(800)", tried: [200], change: moderate, effect: "less Z spread; cards cluster at similar depth, more uniform monochromatic field"}
reusable_candidates:
  - {name: shadowCard, signature: "shadowCard(xx, yy, ww, hh, bb, col, alp) -> void", note: "four trapezoid shadow shapes around a rect, drawn with per-vertex alpha fade"}
  - {name: depthStack, signature: "depthStack(xx, yy, ww, hh, copies, depth) -> void", note: "stack N copies of a shape along Z with per-copy offset"}
---

## What it draws
A full-bleed abstract of overlapping translucent card-like rectangles in magenta-pink, teal-cyan, and deep purple, layered at different 3-D depths. Each card casts soft fading "shadow" trapezoids on all four sides, giving a stacked-extrusion look. A fine grain texture covers the whole image (from the shader). A few small dark/black rectangles are scattered among the lighter cards.

## How the code works
`setup()` (L5) calls `generate()` once; `draw()` (L15) is empty, so the sketch is static.

- Background (L28): `lerpColor(white, rcol(), 0.3)` — a light tint of a random palette colour.
- Camera (L35-44): P3D perspective with `fov=PI/2`, centred, translated +500 in Z, with tiny random rotations (≤ ~0.13 rad) on all axes.
- Main loop (L77): runs `grid*8` times where `grid = int(random(30,80))` (L52) and cell size `gs = width*2/(grid*5)` (L53).
- Each iteration: random integer grid position (L82-83), noise-scaled size `ww/hh = gs*int(1+40*noise)` (L84-87), random palette colour (L88), alpha `random(40,80)*1.2` (L89), shadow thickness `bb = min(ww,hh)*random(1, random(3))` (L90).
- A bare `rect()` outline is drawn with `stroke(col,50)` 80% of the time (L94-95), `noFill`.
- The card is pushed back in Z by `random(800)` (L100), then `cc = int(random(2,25))` copies (L107) are stacked forward along Z (L110), each rotated 90° about Z (L111) and drawn via `plane()`.
- `plane()` (L137): four `beginShape` blocks, one per side of the rectangle; each quad has two vertices filled at alpha `alp` and two outer vertices at alpha 0, producing a soft trapezoid shadow that fades outward by `bb` pixels.
- Shader (L10, L49, L80, L103): `noiseShadowFrag.glsl` modulates per-pixel alpha by a hash of the fragment coordinate and a `displace` uniform, adding visible grain.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_20 | `int grid = int(random(30, 80));` -> `int grid = 20;` | large | fewer, much larger cards; sparse, bold composition | variants/grid_20/frame_00001.png |
| sizeAmp_10 | `int sizeAmp = 40;` -> `int sizeAmp = 10;` | large | smaller, more uniform cards; busy fine-grained mosaic | variants/sizeAmp_10/frame_00001.png |
| cc_5 | `int cc = int(random(2, 25));` -> `int cc = int(random(2, 5));` | large | fewer stacked copies; cards flatter, less depth layering | variants/cc_5/frame_00001.png |
| alp_160 | `float alp = random(40, 80)*1.2;` -> `float alp = 160;` | large | opaque, saturated solid blocks; less transparency | variants/alp_160/frame_00001.png |
| depth_200 | `translate(0, 0, -random(800));` -> `translate(0, 0, -random(200));` | moderate | less Z spread; near-uniform purple field, one pink card | variants/depth_200/frame_00001.png |

## Modularisation notes
- `plane()` is a generic "shadow-bordered card" primitive: given a rect, a shadow thickness `bb`, a colour, and an alpha, it draws four fading trapezoids. Reusable as `shadowCard`.
- The Z-stacking loop (L100-119) is a generic "depth-stack" pattern: replicate a shape N times, offsetting each copy along Z. Reusable as `depthStack`.
- The main loop (L77-120) is the art-specific driver: it combines grid positioning, noise-driven sizing, random palette, and depth stacking.
- A clean parameter object would contain: `grid` (card count), `sizeAmp` (noise size multiplier), `ccMax` (max stacked copies), `alp` (card alpha), `depthRange` (Z push range), `palette` (colour list), `bbFactor` (shadow thickness multiplier).
