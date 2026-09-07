---
sketch: 2015/Generativos/planets3d
year: 2015
renderer: P3D
size: [800, 600]
libraries: []
deterministic: false
ms_first_frame: 1694
animated: true
techniques: [noise-field, 3d-mesh, shader, distortion]
primitives: [shape, pgraphics, image]
palette:
  colors: ["#0A0A0A", "#FFFFFF", "#FF5050", "#CCCCCC", "#0E0E22"]
  selection: noise-driven
composition: centered
parameters:
  - {name: tam, default: "random(180, 280)", tried: [400], change: large, effect: "planet much bigger, fills most of the canvas height; lumpy silhouette clearly visible (different random palette this run)"}
  - {name: displaceStrength, default: 0.2, tried: [0.6], change: large, effect: "stronger vertex displacement: deep, spiky, exaggerated relief on the silhouette"}
  - {name: sphereDetail, default: 40, tried: [12], change: large, effect: "coarser mesh: chunky, low-poly bumps; bright green artifact background already at frame 1"}
  - {name: det, default: "random(0.01, 0.02)", tried: [0.05], change: large, effect: "larger, fewer, smoother continents (few big landmasses instead of many small ones); white/gray artifact background at frame 1"}
  - {name: pointLight color, default: "(255, 80, 80)", tried: ["(80, 80, 255)"], change: large, effect: "warm red upper-left glow replaced by cool blue/violet light on the highlands; lowest score of the set (0.175)"}
reusable_candidates:
  - {name: noisePlanetTexture, signature: "noisePlanetTexture(w, h, detail) -> {PImage color, PImage displacement}", note: "seamless horizontal equirectangular 2-D noise, height ramp mapped to a 3-colour HSB sea/land/highland scheme plus grayscale displacement map"}
  - {name: displaceSphere, signature: "displaceSphere(radius, detail, strength) -> PShape", note: "SPHERE PShape whose vertices are pushed along normals by a grayscale displacement map (GLSL TEXLIGHT shader)"}
---

## What it draws
Baseline frame 1 (seed 42): one small, lumpy planet floating in the centre of a near-black canvas. Its surface is bright teal/cyan continents on a dark maroon–purple ground, with a warm red glow on the upper-left limb (point light) and a soft dark vignette in the corners. The planet slowly rotates. By frame 60 a second, different planet has replaced it (dark green continents on near-black ground) and the canvas background is a flat bright cyan where it should be near-black — the planet was swapped in by an async thread, and the cyan background appears to be a GL-state artifact of that cross-thread swap (the post-shader vignette is still visible over it).

## How the code works
- `setup()` (planets3d.pde:5-16): 800×600 P3D, `smooth(8)`. Loads three GLSL shaders: `displace` (vertex shader pushes each vertex along its normal by `displacementMap` × `displaceStrength` (0.2), fragment = `colorMap` × per-vertex lighting — data/displaceVert.glsl:68-73, data/displaceFrag.glsl:15), `textureMix` (plain crossfade of two textures, used for morphing), and `post` (data/post.glsl: 3×3 weighted blur ÷15, `col*0.8 + blur*0.8`, faint time-oscillation, black vignette `mix(col, black, pow(dist(uv,0.5),1.2))`). Creates two `Planet`s and fires `thread("changePlanet")`, which asynchronously replaces the visible planet with the second one.
- `Planet.generateTexture(w,h)` (Planet.pde:65-103): `colorMode(HSB,256,256,256)`; random base hue `c` (line 68); three colours — `cwater` (hue c+128, high sat, mid bright) = deep sea, `c1` (hue c, high sat, bright) = low land, `c2` (hue c±20, mid sat, dark) = high land (lines 69-71). Re-seeds noise (`noiseSeed(int(random(9999999)))`, line 75) with `det = random(0.01, 0.02)` (line 76). Per-pixel `noise(i*det+100, j*det)`; the last 10% of the width is lerped toward `noise((i-w)*det)` so the texture wraps seamlessly horizontally (lines 80-83). Height `n = pow(n*2-1, 1.2)`: `n<0.01` → shallows, `lerpColor(cwater, c1, pow(n*100,1.5))` giving bright coastal fringes; `0.01–1` → land `lerpColor(c1, c2, n+0.1)`; `n≥1` → deep sea (n reset to 0, effectively `cwater`). Grayscale displacement map = `color(255*pow(n,1.2))` (line 100), so land is raised, deep sea is 0 → this is what makes the surface bumpy.
- `Planet.generate()` (50-58): `sphereDetail(40)`, radius `tam = random(180, 280)` (line 54), `createShape(SPHERE, 1)`, scaled, textured.
- `draw()` (planets3d.pde:19-38): `background(10)` (near black); warm red `pointLight(255,80,80)` at the mouse (headless: fixed upper-left); white `directionalLight` from the mouse direction; dim blue `ambientLight(14,14,34)`; then `shader(displace)`, translate to centre at z=-300, `rotateY(PI*frameCount/1000)` (very slow spin), `planet.update()`, and every frame `filter(post)`.
- `update()/show()` (13-48): when `time>0` (only after a key press) it crossfades `colorMap`/`displacementMap` between this and `nextPlanet` over `timeChange=10` frames and scales the sphere between the two radii (morph); otherwise it sets the maps directly and draws the shape.
- Randomness: hue `c`, the three HSB colours, `noiseSeed`, `det`, `tam` — all from `random()`. The harness seeds before setup, but the off-thread `new Planet()` (changePlanet, lines 44-50) consumes `random()` at varying wall-clock timing, so runs are not reproducible (`"deterministic": false` in result.json); compare only large changes.
| tam_400 | `tam = random(180, 280);` -> `tam = 400;` | large (mean 0.4967, 0.985) | planet clearly bigger, fills most of the canvas; dark maroon land / teal seas, lumpy silhouette on a black background | variants/tam_400/frame_00001.png |
| displaceStrength_0.6 | `displace.set("displaceStrength", 0.2);` -> `... 0.6);` | large (mean 0.6054, 0.958) | much more exaggerated relief: deep spiky silhouette, pronounced bumps (different random green/olive planet this run) | variants/displaceStrength_0.6/frame_00001.png |
| sphereDetail_12 | `sphereDetail(40);` -> `sphereDetail(12);` | large (mean 0.608, 0.965) | coarser mesh: chunky low-poly bumps on the silhouette; bright green artifact background (planet texture over full canvas) already at frame 1 | variants/sphereDetail_12/frame_00001.png |
| det_0.05 | `float det = random(0.01, 0.02);` -> `float det = 0.05;` | large (mean 0.3208, 0.966) | fewer, larger, smoother continents (a few big landmasses); white/gray artifact background at frame 1 | variants/det_0.05/frame_00001.png |
| pointLight_blue | `pointLight(255, 80, 80, ...)` -> `pointLight(80, 80, 255, ...)` | large (mean 0.175, 0.982) | red upper-left glow replaced by cool blue/violet light; magenta highlands lit blue; dark gray background; lowest score of the set | variants/pointLight_blue/frame_00001.png |
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic (library candidates): (1) `noisePlanetTexture` — the whole generateTexture loop: seamless equirectangular 2-D noise → height ramp → 3-colour HSB sea/low/high scheme + grayscale displacement map; parameterised by (w, h, noiseDetail, baseHue, ramp breakpoints). (2) The displace shader pair — vertex displacement of any textured sphere/shape by a grayscale height map with standard Processing lighting; reusable as a "displaced 3D mesh" primitive. (3) The post filter — blur + vignette + time flicker as a generic cinematic pass.
- One-off art decisions: the exact HSB ranges and ramp breakpoints (0.01 coastline threshold, `pow(...,1.2)`/`pow(...,1.5)` exponents, white-snow branch that is effectively dead code); the specific light rig (red point + white directional + blue ambient); the async planet swap and the 10-frame key-press crossfade morph (interaction design, not visual style).
- A clean parameter object: `{ radius, sphereDetail, noiseDetail, displaceStrength, baseHue, seaHueOffset, colorRamp: {deep, shallow, low, high}, lights: {point, directional, ambient}, post: {blur, vignette, flickerSpeed}, morph: {duration, scaleLerp} }`.
