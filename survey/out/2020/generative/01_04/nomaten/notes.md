---
sketch: 2020/generative/01_04/nomaten
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1520
animated: true
techniques: [polar, grid, shader, blend-modes]
primitives: [shape]
palette:
  colors: ["#4E87C5", "#BA8FE7", "#F76A0B"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: grid, default: 60, tried: [30], change: large, effect: "halves snap size and hub radii; hubs smaller, spokes marginally finer, composition otherwise similar (score inflated by baseline frame-1 artifact)"}
  - {name: hubCount, default: 3, tried: [6], change: large, effect: "six fans instead of three; denser crossings, more additive overlap, more black gaps"}
  - {name: alp, default: 255, tried: [128], change: moderate, effect: "all spokes visibly darker/more transparent; weaker additive buildup at overlaps"}
  - {name: outerDiameter, default: width*3, tried: [width*1.5], change: large, effect: "spokes stop at 720 px radius; fan boundaries visible as arcs, no full-bleed"}
  - {name: resFactor, default: 0.004, tried: [0.008], change: large, effect: "spoke count doubled (~54 per fan); visibly finer, busier, thinner spokes"}
  - {name: colors, default: "[#4E87C5,#BA8FE7,#F76A0B]", tried: ["[#354998,#D0302B,#F76684,#FCFAEF,#FDC400]"], change: moderate, effect: "deep red, cream, steel blue, pink; identical geometry"}
reusable_candidates:
  - {name: radialSpokes, signature: "radialSpokes(x, y, innerD, outerD, color, alpha) -> void", note: "fan of thin wedge quads between two radii; per-vertex alpha 0->full gives spokes that fade out toward the hub; quad count derived from outer radius"}
  - {name: noiseShadow, signature: "noiseShadow(displace) -> PShader", note: "drop-in PShader multiplying per-fragment alpha by (1 + pow(rand(pixel), 1.2)) for a salt-and-pepper speckle; 'displace' uniform re-seeds the grain"}
---

## What it draws

On a black field, three overlapping starbursts: fans of thin, translucent radial spokes
radiating from three off-centre hubs. Spokes are lavender/purple, burnt orange, and peach;
where fans overlap, additive blending brightens them toward pale pink/white. Each spoke
fades to transparent near its hub (small dark hole at each centre) and carries a fine
salt-and-pepper speckle across its fill. Full-bleed: spokes from each hub run off all edges.
Note: `frame_00001.png` looks like a first-frame capture artifact (white field, solid black
wedges); `frame_00010.png` and `frame_00060.png` are identical to each other and show the
stable output above (draw() is empty, so the sketch is static).

## How the code works

`setup()` (nomaten.pde:23) loads the GLSL shader and calls `generate()`; `draw()` (:37) is
empty, so nothing changes after setup.

`generate()` (:49):
- `randomSeed`/`noiseSeed` from `seed` (:51-52); `background(0)`; `grid = 60` (:56);
  `blendMode(ADD)` (:58).
- Loops 3 times (:65): picks a random point in `[grid, width]`, pulls it toward the canvas
  centre with `lerp(..., random(0.5))` (:68-69), snaps it to the 60-px grid
  (`x -= x%grid`, :70-71), and computes `s = int(random(3, random(20, 40))) * grid`
  (:72), i.e. 180-2340 px.
- Calls `circle(x, y, s*0.1, width*3, rcol())` (:76): inner radius `r1 = s*0.05`
  (9-117 px), outer radius `r2 = width*3/2 = 1440 px` (always off-canvas).

`circle()` (:81): `res = TAU * max(r1,r2) * PI * 0.004` (:85) ≈ 112 for r2=1440, floored to
a multiple of 4 (108); the loop steps `i += 4`, drawing 27 wedge quads, each ~3.3° wide.
Each quad's two inner vertices get `fill(col, 0)` and the two outer `fill(col, alp)` with
`alp = 255` (:87) — vertex-interpolated alpha makes each spoke transparent at the hub and
opaque at its tip, producing the dark hub holes and the tapered look. A random rotation
`ang = random(TAU)` (:88) orients each fan.

Colour: `rcol()` (:116) picks one of three fixed colours (`#4E87C5`, `#BA8FE7`, `#F76A0B`,
:114) per starburst — one colour per fan, not per spoke.

Shader: `noiseShadowFrag.glsl` multiplies the fragment alpha by
`(1 + pow(rand((gl_FragCoord.xy + displace)*0.001), 1.2))` — a per-pixel 1x-2x alpha
multiplier, i.e. the grainy speckle. `displace` (set per starburst, :61/:73) shifts the
grain pattern. The `fraction` uniform is declared but unused.

Blend: ADD on black, so intersecting spokes accumulate to brighter, whiter tones.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_30 | `int grid = 60;` -> `int grid = 30;` | large | three fans as baseline but smaller hub holes and marginally finer spokes; overall composition similar (score inflated by the baseline frame-1 artifact) | variants/grid_30/frame_00001.png |
| count_6 | `for (int i = 0; i < 3; i++)` -> `for (int i = 0; i < 6; i++)` | large | six starbursts; denser crossings, more pale additive overlap, more black gaps between spokes | variants/count_6/frame_00001.png |
| alp_128 | `float alp = 255;` -> `float alp = 128;` | moderate | same geometry, all spokes visibly darker/more transparent, weaker brightening at overlaps | variants/alp_128/frame_00001.png |
| s2_w1_5 | `circle(x, y, s*0.1, width*3, rcol());` -> `... width*1.5 ...` | large | spokes stop at 720 px radius; fan edges visible as arcs, large empty black areas, full-bleed look gone | variants/s2_w1_5/frame_00001.png |
| res_0.008 | `PI*0.004);` -> `PI*0.008);` | large | ~54 spokes per fan instead of 27; visibly finer, busier, thinner spokes | variants/res_0.008/frame_00001.png |
| palette_5 | `int colors[] = {#4E87C5, #BA8FE7, #F76A0B};` -> `int colors[] = {#354998, #D0302B, #F76684, #FCFAEF, #FDC400};` | moderate | deep red, cream, muted steel blue, pink tones; identical geometry | variants/palette_5/frame_00001.png |

Caveat: render.py scores variants against the baseline's `frame_00001.png`, which is a
capture artifact (white field, solid black wedges) while every variant's frame 1 shows the
stable black-field output. All scores are therefore inflated; treat the labels as lower
bounds, not precise magnitudes.

## Modularisation notes

- `circle()` is the core reusable primitive: a radial spoke fan with an alpha-gradient
  (transparent hub -> opaque rim), resolution auto-scaled to outer radius, random
  rotation. Generalised as `radialSpokes(x, y, innerD, outerD, color, alpha, steps)`.
- The placement logic (random point, pull-to-centre, grid snap, size from `random*grid`)
  is a generic scattered-hub composer, separable from the drawing.
- The GLSL grain is a self-contained PShader (one `displace` uniform) usable on any
  P2D sketch for stippled fills.
- One-off art decisions: the 3-colour palette, `blendMode(ADD)` on black, exactly 3 hubs,
  the `width*3` outer diameter (deliberate off-canvas bleed), and `alp = 255`
  (the commented `20*random(0.4,1)` shows a more transparent variant was intended).
- Clean parameter object: `{seed, hubCount, grid, innerFrac, outerDiameter, alpha,
  spokeDensity, palette, displace}`.
