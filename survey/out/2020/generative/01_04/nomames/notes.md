---
sketch: 2020/generative/01_04/nomames
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1626
animated: false
techniques: [shader, grid, polar]
primitives: [shape]
palette:
  colors: ["#4E87C5", "#BA8FE7", "#F76A0B"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: count, default: 280, tried: [100], change: moderate, effect: "sparser field, large black gaps; same colours and ring structure"}
  - {name: alpha, default: 50, tried: [180], change: large, effect: "rings far more visible; canvas washed in bright pink-purple haze with distinct orange/blue patterns"}
  - {name: sub, default: 10, tried: [3], change: large, effect: "only small dim dots and single faint rings; no large multi-ring blooms"}
  - {name: grid, default: 30, tried: [12], change: large, effect: "finer placement, clusters ~3x smaller (size scales with grid); small targets across canvas"}
  - {name: palette, default: "3 colours", tried: ["5 colours"], change: moderate, effect: "same structure; colours shift blue/purple/orange -> indigo/pink/yellow/red"}
reusable_candidates:
  - {name: softRing, signature: "softRing(x, y, rOuter, rInner, col, alpha, res) -> void", note: "annulus of quads with per-vertex alpha fade, drawn in polar coords"}
  - {name: hashDitherShader, signature: "loadShader('noiseShadowFrag.glsl') + set('displace', d) -> PShader", note: "per-fragment alpha modulation by hash noise for grainy eroded edges"}
  - {name: paletteCycle, signature: "getColor(idx) -> color", note: "index into palette with lerp between neighbours, pow easing"}
---

## What it draws

On a near-black background, ~280 scattered clusters of concentric soft rings, like
hazy ripples or targets. Each cluster is 1-9 nested rings with grainy, eroded edges,
in steel blue, lavender purple, and burnt orange, with dark muddy brown patches where
rings overlap. Cluster sizes range from a few pixels to very large blooms that cover
most of the canvas; the overall field reads as a diffuse bokeh-like texture.

## How the code works

- `setup()` (line 23) loads `noiseShadowFrag.glsl` (line 25) and calls `generate()`
  once; `draw()` (line 37) does nothing, so the image is static.
- `generate()` (line 49): re-seeds `random`/`noise` with `seed` (51-52), black
  background (54), `grid = 30` (56), sets shader uniform `displace` to `random(100)` (59).
- Loop `i` over 0..280 (line 63): random position in `[grid, width/height]` (64-65),
  snapped to the 30 px grid via `x -= x%grid` (68-69). Base size
  `s = int(random(3, random(4, 9))) * grid * 0.125` (70) gives 11.25-30 px.
  Alpha `alp = random(50)*random(1)` (71) is 0-50 out of 255, very low, which is why
  everything looks hazy.
- Colour: `ic = random(colors.length)` (73), `dc = random(colors.length)*random(1)`
  (74); per ring `col = getColor(ic + dc*k)` (78). `getColor(float)` (127-133) takes
  the index modulo the 3-colour palette and `lerpColor`s between the two neighbouring
  entries with `pow(v%1, 0.6)` easing, so successive rings in one cluster drift through
  the palette (blue -> purple -> orange and back).
- Ring count `sub = int(random(1, 10))` (76). For each `k` (77-83) two `circle()`
  calls draw an annulus pair: `circle(x, y, s*k, s*k*2)` = ring whose outer radius
  `s*k/2` carries the low alpha and fades to 0 at radius `s*k`;
  `circle(x, y, s*k, s*(k-1))` = ring fading inward to `s*(k-1)/2` (for k=1 a filled
  disc). Hence each cluster is a stack of concentric soft rings.
- `circle()` (88-107): approximates the annulus with `res` quads where `res` scales
  with radius (92); the outer edge vertices get `fill(col, alp)`, inner edge vertices
  `fill(col, 0)` (99-104), producing the radial alpha fade.
- Shader `noiseShadowFrag.glsl`: multiplies each fragment's alpha by
  `1 + pow(hash(gl_FragCoord + displace), 1.2)` (frag line 21) — a per-pixel hash
  grain that speckles and erodes every ring's edge. `displace` is re-randomised per
  ring (line 79). P3D renderer + `smooth(8)` (19) do the rest of the softness.
- Note: `toxi.math.noise.SimplexNoise` and triangulate are imported/jarred but unused
  in this file.

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_100 | `  for (int i = 0; i < 280; i++) {` -> `  for (int i = 0; i < 100; i++) {` | moderate | sparser field with large black gaps; same colours, same ring structure | variants/count_100/frame_00001.png |
| alpha_180 | `    float alp = random(50)*random(1);` -> `    float alp = random(180)*random(1);` | large | rings far more visible; whole canvas washed in bright pink-purple haze, distinct orange and blue ring patterns, grain stands out | variants/alpha_180/frame_00001.png |
| sub_3 | `    int sub = int(random(1, 10));` -> `    int sub = int(random(1, 3));` | large | only small dim dots and single faint rings; the large multi-ring blooms disappear | variants/sub_3/frame_00001.png |
| grid_12 | `  int grid = 30;` -> `  int grid = 12;` | large | finer placement and ~3x smaller clusters (size `s` scales with `grid`); canvas covered in small target rings | variants/grid_12/frame_00001.png |
| palette_alt | `int colors[] = {#4E87C5, #BA8FE7, #F76A0B};` -> `int colors[] = {#7D7FD8, #F7AA06, #EA79B7, #FF0739, #12315E};` | moderate | same structure and density; colours shift from blue/purple/orange to indigo, pink, yellow, red; only 6.5% of pixels differ | variants/palette_alt/frame_00001.png |

## Modularisation notes

- `circle()` (88-107) is a clean, generic primitive: parametric annulus with a radial
  alpha gradient. Library candidate `softRing(x, y, r1, r2, col, alpha, res)`.
- The `noiseShadow` shader pair (data/*.glsl) is a self-contained grain/dither shader
  with a single `displace` uniform; reusable on any P3D shape pass.
- `getColor(float)` (127-133) is a reusable palette-cycling colour function (index
  modulo palette length, lerp between neighbours, pow easing).
- One-off art decisions: the 280-iteration count, the 30 px grid snap, the
  `random(50)` low-alpha range, the specific 3-colour palette, and the two
  annulus-per-ring pattern (outward fade + inward fade) that creates the target look.
- A clean parameter object: `{count, grid, sizeRange, alphaMax, subRange, palette, displaceRange}`.
