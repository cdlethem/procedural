---
sketch: 2018/Generativos/process_02
year: 2018
renderer: P3D
size: [720, 720]
libraries: []
deterministic: false
ms_first_frame: 1532
animated: true
techniques: [subdivision, grid, noise-field, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#27B2F0", "#2D27A1", "#EA3C3B", "#F86404", "#F9AA08", "#06AA82", "#2CB4F2", "#E63B68", "#F0C6B6", "#D8D8D8"]
  selection: random-from-list
composition: centered
parameters:
  - {name: ss, default: "width*0.6", tried: ["width*0.9"], change: moderate, effect: "field is larger and fills much more of the canvas"}
  - {name: sub, default: "random(4, random(80))", tried: ["random(4, random(15))"], change: moderate, effect: "coarser subdivision: far fewer, much bigger tiles"}
  - {name: amp, default: "random(0.3, 0.5)", tried: ["random(0.0, 0.1)"], change: subtle, effect: "subtle: noise-gate holes in the field mostly fill in; most visible difference is the rotation angle (millis()-driven, deterministic: false)"}
  - {name: det, default: "random(0.1)", tried: ["random(0.02)"], change: moderate, effect: "smoother noise: field breaks into fewer clustered patches with large gaps"}
  - {name: rnd, default: "random(8)", tried: ["random(4)"], change: moderate, effect: "twice as many decorated tiles: many more stacks, towers and spheres"}
  - {name: lift, default: -80, tried: [-20], change: moderate, effect: "decorations sit much closer to the tile surface instead of floating above it"}
reusable_candidates:
  - {name: quincunxSubdivide, signature: "quincunxSubdivide(size, iterations, minSize) -> PVector[x,y,z] list", note: "recursively split a square into 4 sub-squares, stopping below minSize"}
  - {name: boxWithFaces, signature: "boxColors(w, h, d, rand) -> void", note: "six-face box where each face may get an independent fill colour"}
  - {name: roundedPrism, signature: "boxRound(w, h, d, roundness) -> void", note: "cylinder-like prism built from rounded-rect outline + side quads"}
---

## What it draws
Isometric-style view of a large square field lying on a plane, subdivided into a patchwork of
flat colored tiles (yellow, red, green, orange, blue, cream) of a few sizes. On some tiles sit
low 3D boxes with differently colored faces, a green sphere, a small stack of shrinking rounded
colored discs, and a cluster of tiny bars. The whole composition rotates slowly around its
vertical axis (frame 60 is the same scene at a different angle). Background is soft peach.

## How the code works
`setup()` (process_02.pde:7) loads `post.glsl`, then `generate()` (line 32), which `draw()`
re-runs every frame (line 20). Per frame: `randomSeed(seed)` (line 36) reseeds all randomness,
background from `backs[]` (line 37, baseline shows #F0C6B6 peach), then an ortho camera tilted
`rotateX(HALF_PI-atan(1/sqrt(2)))` (line 46) — a fixed isometric-ish angle — and rotating
`rotateZ(-HALF_PI*0.5 - time)` with `time = millis()*0.0002` (lines 34, 47), which is what
animates the scene.

- **Subdivision** (lines 52–68): a list starts with one square of side `ss = width*0.6`; `sub =
  int(random(4, random(80)))` times, one random square is split into 4 half-size squares
  (quincunx). Minimum side `minS = ss/128` (line 53) stops recursion.
- **Noise gate** (lines 71–77): each surviving square samples `noise(des+r.x*det, des+r.y*det)`;
  if the value is below `amp = random(0.3, 0.5)` the tile is skipped (visible gaps, e.g. the
  cream/white hole in the center of the baseline).
- **Tiles + decorations** (lines 74–142): kept tiles are drawn as flat boxes
  `boxColors(s, s, minS, true)` (line 87) — six faces, each face `rcol(colors)` random from the
  6-color list (line 279), which is why faces of one tile often differ. `rnd = int(random(8))`
  (line 89) picks a decoration type: 0 = stack of shrinking rounded prisms (`boxRound`,
  lines 91–100), 1 = sphere (lines 102–108), 2 = stack of small boxes (lines 110–119),
  3 = grid of tiny boxes (lines 121–139); 4–7 = nothing.
- **Shader** (lines 148–149): `filter(post)` applies `post.glsl` every frame (display is a real
  X display, not xvfb, so the render is trustworthy).
- `createNoise()` (line 294) builds a 512x512 random-noise PImage but its only use,
  `image(noise, 0, 0)` (line 152), is commented out — dead code.
- `boxColors` (line 167) and `boxRound` (line 234) are the primitive builders; `getColor`
  (line 286, lerp along the palette) is unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ss_0.9 | `float ss = width*0.6;` -> `float ss = width*0.9;` | moderate | field noticeably larger, fills most of the canvas; same patchwork look with a few large tiles and decorations | variants/ss_0.9/frame_00001.png |
| sub_15 | `int sub = int(random(4, random(80)));` -> `int sub = int(random(4, random(15)));` | moderate | much coarser subdivision: a handful of huge tiles (yellow/red/orange/cyan), decorations look large by comparison | variants/sub_15/frame_00001.png |
| amp_0.1 | `float amp = random(0.3, 0.5);` -> `float amp = random(0.0, 0.1);` | subtle | no strong visible change; field looks a bit more filled in, but most of the difference is the scene's rotation angle (time = millis(), deterministic: false) | variants/amp_0.1/frame_00001.png |
| det_0.02 | `float det = random(0.1);` -> `float det = random(0.02);` | moderate | noise varies more slowly: the field breaks into a few clustered patches with big empty gaps between them | variants/det_0.02/frame_00001.png |
| rnd_4 | `int rnd = int(random(8));` -> `int rnd = int(random(4));` | moderate | far more decorations: a tall tower of big boxes, several rounded-disc stacks, an orange sphere, many decorated tiles | variants/rnd_4/frame_00001.png |
| lift_-20 | `translate(r.x, r.y, -80);//r-r.z*0.5);` -> `translate(r.x, r.y, -20);//r-r.z*0.5);` | moderate | boxes and stacks sit almost on the tile surface instead of floating high above it (the two-box tower looks low and stubby) | variants/lift_-20/frame_00001.png |

Note: the scene rotates with `millis()` (not the frame number) and the render is non-deterministic,
so each variant was captured at a different rotation angle; part of every diff score is that
rotation, not the parameter change.

## Modularisation notes
- `quincunxSubdivide` (lines 52–68): fully generic recursive quad subdivision with a min-size
  cutoff; clean library candidate. Parameters: start size, iteration count, min size.
- `boxColors` (line 167): per-face colored box is generic; the `rand` flag (per-face random
  palette color vs two fixed colors) is the only art decision.
- `boxRound` (line 234): rounded-rect prism with a resolution derived from corner radius;
  generic, but the `rou` roundness factor is an art parameter.
- One-off art decisions: the isometric camera angles (lines 46–47), the noise threshold gate
  that punches holes in the field (lines 71–77), the 1-in-8 decoration lottery (line 89) and the
  specific decoration recipes, the two palettes (lines 278–279), and the `post.glsl` filter.
- Clean parameter object: `{ size, subdivisions, minSize, noiseDetail, noiseOffset, amp,
  decorationDensity (the 8 in random(8)), decorationTypes, boxLift (the -80 on line 79),
  palette, background, rotationSpeed }`.
