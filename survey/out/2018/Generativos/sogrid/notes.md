---
sketch: 2018/Generativos/sogrid
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1559
animated: false
techniques: [grid, 3d-mesh, noise-field, shader]
primitives: [rect, shape]
palette:
  colors: ["#000000", "#0D0D52", "#401972", "#FF55A7", "#F59CD4", "#4CFDC6"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: grid, default: "random(100, 300)", tried: ["random(100, 200)"], change: moderate, effect: "fewer, larger grid cells -> coarser, blockier composition"}
  - {name: sizeAmp, default: 40, tried: [20], change: moderate, effect: "smaller noise-driven rectangles, fewer huge blocks"}
  - {name: faceAlpha, default: "random(40, 80)", tried: ["random(160, 200)"], change: large, effect: "near-opaque faces, saturated colour patches, background mostly hidden"}
  - {name: extrudeDepth, default: "random(800)", tried: ["random(200)"], change: moderate, effect: "shallower extrusion, shorter shadow faces, flatter and softer surface"}
  - {name: fov, default: "PI/2.0", tried: ["PI/4.0"], change: moderate, effect: "narrower field of view, less perspective foreshortening, flatter grid"}
  - {name: outlineAlpha, default: 50, tried: [255], change: subtle, effect: "cell outlines become opaque hairlines; otherwise no visible change"}
reusable_candidates:
  - {name: noiseRectGrid, signature: "noiseRectGrid(grid, sizeAmp, noiseDetail) -> Rect[]", note: "grid-aligned rectangles whose scale comes from sampled 2-D Perlin noise"}
  - {name: extrudedFaces, signature: "extrudedFaces(rect, depth, spread, color) -> quad[]", note: "four trapezoidal side faces giving a rect a 3-D shadow/extrusion"}
  - {name: grainShader, signature: "grainShader(displace) -> PShader", note: "per-fragment hash noise multiplied into alpha (rand(gl_FragCoord+displace)*0.001) for a stippled grain"}
---

## What it draws
A full-bleed plane of overlapping translucent rectangles aligned to a fine grid, tilted slightly in
3-D perspective so the far end recedes toward the top. Dominant colours are pale pink and
lavender/purple with a large mint-green/teal patch upper-right, a dark navy patch mid-left, and a
few near-black cells. Most rectangles carry a faint trapezoidal "shadow" face that flares out from
one edge, giving a shallow-extrusion look. Thin pale outlines are visible on some cells, and the
whole surface has a fine stippled grain.

## How the code works
`setup()` (sogrid.pde:5-13): 960×960 P3D, loads the custom `noiseShadowFrag.glsl` shader, calls
`generate()` once; `draw()` is empty so the piece is static. `generate()`:

- Background: `lerpColor(color(255), rcol(), 0.3)` (line 28) — white blended 30% toward a random
  palette colour, giving the pale pink wash.
- Camera: perspective with `fov = PI/2` (line 35), scene translated to centre then rotated by small
  random angles (`random(TAU)*0.1`, lines 42-44) — the slight tilt of the whole grid.
- Main loop (lines 77-156), `grid*8` iterations with `grid = int(random(100,300))` (line 52):
  each iteration picks a random grid cell (`xx,yy = int(random(-1-grid,grid+1))*gs`, lines 82-83),
  samples 2-D Perlin noise (line 84) and sets the rect size `ww = hh = gs*int(1+sizeAmp*no)` with
  `sizeAmp = 40` (lines 85-87) — so noise decides how many cell-widths a rect spans; high-noise
  cells become the large blocks.
- Colour: `rcol()` (line 203) picks uniformly from the 6-colour `colors[]` array (line 201:
  black, navy, dark purple, pink, light pink, mint green); face alpha `alp = random(40,80)` (line 89).
- Outlines: 80% of cells get `stroke(col, 50)` (line 94) — the thin faint edges.
- Extrusion: `pushMatrix(); translate(0,0,-random(800))` (lines 98-100) pulls a copy back in Z;
  two quads with per-vertex colour fades (lines 105-133) and four trapezoids spread outward by
  `bb = min(ww,hh)*random(1, random(3))` (lines 115-151) form the flared shadow faces.
- Grain: the fragment shader multiplies alpha by `1+pow(rand((gl_FragCoord.xy+displace)*0.001),0.8)`
  (noiseShadowFrag.glsl:21) with a fresh random `displace` set per rect (lines 48, 79, 102) —
  the stippled texture.
- `arc`/`arc2` (lines 158-194) are defined but never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_100_200 | `int grid = int(random(100, 300));` -> `int grid = int(random(100, 200));` | moderate | fewer, larger grid cells; coarser, blockier composition, same palette and grain | variants/grid_100_200/frame_00001.png |
| sizeAmp_20 | `int sizeAmp = 40;` -> `int sizeAmp = 20;` | moderate | rectangles on average smaller; the huge noise-driven blocks shrink, texture reads finer | variants/sizeAmp_20/frame_00001.png |
| alp_160_200 | `float alp = random(40, 80)*1.;` -> `float alp = random(160, 200)*1.;` | large | faces nearly opaque; pale wash becomes strong saturated patches (deep purple, green, black), background barely visible | variants/alp_160_200/frame_00001.png |
| depth_200 | `translate(0, 0, -random(800));` -> `translate(0, 0, -random(200));` | moderate | extrusion shallower; flared shadow faces are shorter, surface looks flatter, softer, more blurred | variants/depth_200/frame_00001.png |
| fov_PI4 | `float fov = PI/2.0;` -> `float fov = PI/4.0;` | moderate | narrower field of view; perspective foreshortening reduced, grid looks flatter and less receding | variants/fov_PI4/frame_00001.png |
| stroke_255 | `if (random(1) < 0.8) stroke(col, 50);` -> `if (random(1) < 0.8) stroke(col, 255);` | subtle | thin cell outlines now fully opaque, visible as hairlines; overall look otherwise unchanged | variants/stroke_255/frame_00001.png |

## Modularisation notes
Generic blocks: the grid+noise sizing (a `noiseRectGrid` that yields cell-aligned rects scaled by
sampled noise), the 4-face extrusion builder, and the grain shader (pure GLSL, only needs a
`displace` uniform). One-off art decisions: the specific 6-colour palette, the 30%-toward-white
background, the random tiny scene rotation, the 80% outline probability, and the per-vertex fade
quads (which barely read in the image). A clean parameter object would be:
`{grid, sizeAmp, noiseDetail, faceAlpha, outlineAlpha, outlineProb, extrudeDepth, spread, fov,
displaceSeed}`.
