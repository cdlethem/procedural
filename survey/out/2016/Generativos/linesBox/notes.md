---
sketch: 2016/Generativos/linesBox
year: 2016
renderer: P3D
size: [1280, 720]
libraries: []
deterministic: true
ms_first_frame: 1470
animated: true
techniques: [particles, grid]
primitives: [line]
palette:
  colors: ["#121212", "#FFFFFF"]
  selection: fixed
composition: centered
parameters:
  - {name: particleCount, default: 200, tried: [400], change: none, effect: "no visible change at frame 1 (all particles still sub-pixel from the origin; count shapes the grid that develops over frames)"}
  - {name: stepSize, default: 40, tried: [120], change: none, effect: "no visible change at frame 1 (lattice spacing only matters once walks have grown)"}
  - {name: speedMax, default: 0.5, tried: [0.9], change: none, effect: "no visible change at frame 1 (faster easing only lengthens the central clump by a few pixels)"}
  - {name: trailAlpha, default: 20, tried: [100], change: none, effect: "no visible change at frame 1 (pixel-identical md5; the dim-trail loop is empty until a particle reaches its first target)"}
  - {name: cameraPosSpeed, default: 0.1, tried: [0.5], change: none, effect: "no visible change at frame 1 (one frame of drift is sub-pixel)"}
  - {name: axisProbX, default: 0.3333333333, tried: [0.6], change: none, effect: "no visible change at frame 1 (axis bias only matters as paths grow)"}
  - {name: background, default: 18, tried: [160], change: large, effect: "background becomes mid-gray; the central white asterisk is unchanged in size and shape"}
reusable_candidates:
  - {name: latticeWalker, signature: "latticeWalker(step, axisProbX, speedMin, speedMax) -> PVector path[]", note: "axis-aligned 3-D random walk on a uniform lattice, eased per frame"}
  - {name: trailAndHead, signature: "trailAndHead(path[], trailAlpha, headColor)", note: "draw recorded path faintly, last segment at full brightness"}
  - {name: driftCamera, signature: "driftCamera(posSpeed, rotSpeed, reseedFrames)", note: "slow 3-D camera with random position/rotation velocities, reseeded on a timer"}
---

## What it draws
Nearly black dark-gray canvas (seed 42). Frame 1 shows a tiny asterisk-like clump of thin white line
segments dead center. By frame 60 it has grown into a small wireframe-like 3-D grid of axis-aligned
line segments, still only a small fraction of the canvas, drawn in perspective: most segments are faint
gray (overlapping dim strokes), a few recent segments are bright white. The whole structure sits at
canvas center and is slowly rotated/drifting by the camera.

## How the code works
- setup (L5-15): P3D 1280x720, smooth(8); loads `post.glsl` but `filter(post)` is commented out (L30),
  so the shader is inert; spawns 200 `LineParticle`s, all at the origin.
- draw (L17-38): every 40 frames the camera re-randomizes its drift (L18); every 1200 frames
  `generate()` rebuilds the list with 120 particles (L19, L44-49); `background(18)` clears the frame
  each draw, so there is no temporal accumulation — the faint look comes from alpha, not history.
- `LineParticle` (L80-140): constructor eases speed `vel = random(0.001, 0.5)*random(1)` (L93).
  `newPos()` (L128-139) steps ±40 along one axis — 1/3 chance x, else 1/2 y, 1/2 z — so every path lies
  on the same 3-D lattice of spacing 40, which is why the image reads as an overlapping grid.
  `update()` (L96-111) moves `pos` toward `npos` by `vel` each frame and appends the point when reached.
- `show()` (L113-126): redraws the entire recorded path each frame with `stroke(255, 20)` (dim trail),
  then the newest segment with `stroke(255)` (bright head). With 200 particles sharing lattice edges,
  overlapping dim strokes add up to visible gray grid lines.
- Camera (L51-77): per-frame `translate`/`rotate` by slowly accumulating `vpos`/`vrot` (speeds 0.1 and
  0.001), reseeded every 40 frames; centered by `translate(width/2, height/2, 0)` (L62).
- Colour is fixed: background 18, white strokes; brightness is purely an overlap/alpha effect.
- Randomness enters via particle speeds, axis/direction choices, and camera drift/rotation.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_400 | `  for (int i = 0; i < 200; i++) {` -> `  for (int i = 0; i < 400; i++) {` | none | no visible change: same tiny white asterisk dead center | variants/count_400/frame_00001.png |
| step_120 | `    float ss = 40;` -> `    float ss = 120;` | none | no visible change: same tiny central asterisk | variants/step_120/frame_00001.png |
| vel_0.9 | `    vel = random(0.001, 0.5)*random(1);` -> `    vel = random(0.001, 0.9)*random(1);` | none | no visible change: central asterisk nearly identical (few pixels at arm tips) | variants/vel_0.9/frame_00001.png |
| alpha_100 | `    stroke(255, 20);` -> `    stroke(255, 100);` | none | no visible change: frame 1 is pixel-identical to baseline (same md5) | variants/alpha_100/frame_00001.png |
| drift_0.5 | `    float vp = 0.1;` -> `    float vp = 0.5;` | none | no visible change: same tiny central asterisk | variants/drift_0.5/frame_00001.png |
| axisX_0.6 | `    if (random(1) < 0.3333333333) {` -> `    if (random(1) < 0.6) {` | none | no visible change: same tiny central asterisk | variants/axisX_0.6/frame_00001.png |
| background_160 | `  background(18);` -> `  background(160);` | large | background is mid-gray; central white asterisk unchanged | variants/background_160/frame_00001.png |

All six structural parameters score `none` because the change score compares frame 1 to the baseline's
frame 1, and at frame 1 every particle is still within a sub-pixel of the origin (each has taken a
single eased step). The parameters do shape the result — only over time: the baseline's
`frame_00060.png` shows the small 3-D lattice grid that the walks grow into. The background-color
variant is the only one visible at frame 1, as expected. 7 renders total, all ok, none timed out.

## Modularisation notes
- Generic: the lattice random-walk particle (step size, axis weights, per-particle eased speed), the
  dim-trail/bright-head line rendering, and the drifting 3-D camera are all reusable as the
  `reusable_candidates` above.
- One-off art decisions: 200 particles all born at the origin, step 40, the 1/3-x axis bias, trail
  alpha 20, background 18, and the (inert) post shader.
- A clean parameter object: `{particleCount, stepSize, axisProbX, speedRange, trailAlpha,
  headColor, cameraPosSpeed, cameraRotSpeed, cameraReseedFrames, background}`.
