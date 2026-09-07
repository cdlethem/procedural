---
sketch: 2018/Generativos/pelines3d002
year: 2018
renderer: P3D
size: [960, 540]
libraries: [peasy]
deterministic: true
ms_first_frame: 9427
animated: true
techniques: [flow-field, particles, 3d-pointcloud]
primitives: [line]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: lerp-between
composition: radial
parameters: []
reusable_candidates:
  - {name: flowFieldLine, signature: "flowFieldLine(origin, fieldScale, offsets, speed, trailLen, life) -> Polyline", note: "integrate a short trail through two independent 3-D Perlin noise angle fields"}
  - {name: fogShader, signature: "fogShader(near, far) -> PShader", note: "PROCESSING_LINE_SHADER that fades line fragments to black by depth (data/fogLines.glsl)"}
---

## What it draws
A radial burst of thousands of short thin strokes on a black background, as if the camera sits
inside a 3-D cloud of drifting line segments. The center is dense with small red-orange dashes;
toward the edges the strokes grow longer, turn pale yellow then blue, and thin out until they
vanish into black. Between frames the whole cloud slowly swirls and the burst reorganizes
(frame 60 is a different swirl from frame 10), so it reads as a breathing starburst.

## How the code works
- setup (pelines3d002.pde:14-25): 960x540 P3D, PeasyCam at the origin, loads
  `data/fogLines.glsl` (fogNear 1000 / fogFar 3000), then `generate()` with the seeded RNG.
- generate (pelines3d002.pde:54-71): `randomSeed`/`noiseSeed` from `seed`; draws `det =
  random(0.001)` (noise field scale), two offsets `des1`/`des2`, and a random `fov` in
  (PI/3, PI/2]. No lines are created here; they are spawned lazily in `draw()`.
- draw (pelines3d002.pde:27-47): black background, `blendMode(ADD)`, recomputes `perspective()`
  each frame with the random fov; centers a `gridCount`^3 volume (cell = width/20, so 48 px) on
  the origin; updates and draws every `Line`; then tops the population back up to
  `linesCount` = 2000 with `addLine()`, which spawns each new line at a random integer grid
  position inside the volume (pelines3d002.pde:73-78).
- Line.update (Lines.pde:20-36): samples two independent 3-D Perlin noises at
  `(x,y,z)*det` with offsets `des1`/`des2`, multiplies by `TAU*4`, and integrates position by
  a spherical direction times `vel = random(4)`. Colour per step is
  `getColor(noise(x,y,z)*detColor*colors.length*2)` — `getColor` (pelines3d002.pde:89-95)
  lerps between two adjacent palette colours, so each stroke gets a noise-driven blend of the
  5-colour list. The trail keeps at most 10 points (`points.remove(0)`), so each line is a
  short curved dash. After `timeLife = random(6,8)` s the line is removed and replaced.
- Line.show (Lines.pde:38-47): `beginShape` over the trail points, per-vertex stroke colour at
  alpha 250; the fog shader then fades fragments whose depth exceeds fogNear toward black, and
  ADD blending stacks overlapping strokes into a brighter core.
- The radial look is emergent: the camera sits at the centre of the 3-D grid, so nearby
  segments are large and densely overlapping (ADD accumulation + bright core), while far
  segments are small and fogged out; perspective stretches near-far segments into the
  outward-pointing dashes.
- Note: `frame_00001.png` in the baseline is actually the promoted frame 10 (frames 1-2 were
  blank while lines accumulated).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the `Line`/`Point` pair is a reusable "flow-field trail" primitive (spawn point +
  two noise angle fields + speed + trail length + lifetime), the 5-colour lerp palette helper,
  and the depth-fog line shader. All three could ship as library functions with the signatures
  in `reusable_candidates`.
- One-off art decisions: the 20^3 spawn grid centred on the camera, ADD blend on black, the
  random fov re-drawn every frame, and the 6-8 s lifetime / 10-point trail pairing that gives
  the burst its density.
- A clean parameter object: `{count, volume (gridCount, cellSize), fieldScale (det),
  offsets (des1, des2), speed, trailLen, lifeMin, lifeMax, palette, blend, fog (near, far),
  fov, seed}`.
