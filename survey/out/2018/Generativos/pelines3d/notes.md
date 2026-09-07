---
sketch: 2018/Generativos/pelines3d
year: 2018
renderer: P3D
size: [960, 540]
libraries: [peasy]
deterministic: true
ms_first_frame: 1545
animated: false
techniques: [flow-field, particles, 3d-pointcloud, noise-field]
primitives: [line]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: 8, tried: [4], change: moderate, effect: "coarser 4x4x4 start grid: looser, wider-spreading bundles, bigger brighter center knot"}
  - {name: paths, default: 500, tried: [200], change: subtle, effect: "sparser: thinner knot, more black gaps, same field"}
  - {name: vel, default: 10, tried: [25], change: moderate, effect: "longer steps: longer, more stretched curves, bigger knot"}
  - {name: det, default: 0.001, tried: [0.004], change: moderate, effect: "finer noise: much wavier, more loops, convergence knot weakened and dispersed"}
  - {name: alpha, default: 80, tried: [200], change: none, effect: "no visible change: initial stroke alpha only sets the first vertex of each polyline, per-vertex getColor stroke overrides it"}
  - {name: steps, default: 100, tried: [40], change: subtle, effect: "shorter trajectories: smaller tighter knot, curves stop short of the edges"}
reusable_candidates:
  - {name: noiseFlowPath, signature: "noiseFlowPath(origin, stepLen, steps, detail, des1, des2) -> float[][]," note: "walk a point through a 3-D noise field using spherical angles from two decorrelated noise samples"}
  - {name: noisePaletteColor, signature: "noisePaletteColor(x, y, z, detail, palette[]) -> color", note: "lerp between adjacent palette entries driven by 3-D noise (getColor)"}
---

## What it draws
Full-bleed black canvas covered in hundreds of very thin, smooth curving filaments that
flow along a shared 3-D vector field. Most filaments are pale cyan or white; a minority
carry orange/red tones. They all appear to funnel into one dense, bright knot of tangled
curves slightly left of center, then splay outward toward the edges. With ADD blending the
overlapping strands in the knot burn out to near-white. Static image (frames 10/60
identical to frame 1).

## How the code works
`setup()` (pelines3d.pde:5-10): 960x540 P3D, `PeasyCam` at distance 400 (camera is never
manually moved, so it stays at the default front view of the centered cube). `draw()` is
fully re-seeded each frame (`randomSeed(seed)`, `noiseSeed(seed)`, line 14-15) which is why
the output is static: identical frames every draw.

- A virtual 8x8x8 grid spans the centered cube: `cc = 8`, cell `ss = width/cc = 120`,
  translated so the cube is centered (line 20-24).
- Noise field: two decorrelated 3-D noise fields offset by `des1`, `des2`
  (line 25-26) sampled at `xx*det, yy*det, zz*det` with `det = random(0.001)` (line 22).
  The two samples become spherical angles `a1`, `a2` scaled by `TAU*4` (line 58-59),
  giving a direction per point — the flow field.
- 500 trajectories (line 51): each starts at a random grid cell corner
  (`int(random(cc))*ss`, line 52-54) and walks 100 steps of length `vel = 10`
  (line 49, 60-62), emitting a `vertex()` per step inside one `beginShape()/endShape()`
  polyline (line 55-66).
- Colour: per-vertex `getColor(noise(xx*detColor, ...)*colors.length*2)`
  (line 63, 81-87) lerps between adjacent palette entries
  (#FF3D20, #FC9D43, #3998C2, #3E56A8, #090D0E), so hue follows a third noise field
  along the path. The initial `stroke(250, 20, 0, 80)` (line 48) only sets the first
  vertex; `blendMode(ADD)` (line 18) is what makes the dense knot glow.
- The commented block (line 27-45) is an earlier version drawing unit line segments
  at every grid point instead of flowing paths.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_4 | `int cc = 8;` -> `int cc = 4;` | moderate | looser, wider-spreading filament bundles; center knot bigger and brighter from more overlap; same palette (pale cyan/white, faint orange) | variants/cc_4/frame_00001.png |
| paths_200 | `for (int i = 0; i < 500; i++)` -> `i < 200` | subtle | clearly fewer filaments; knot thinner, more black gaps in the lower half; field shape unchanged | variants/paths_200/frame_00001.png |
| vel_25 | `float vel = 10;` -> `float vel = 25;` | moderate | longer, more stretched curves with larger radii; knot enlarged and more spread out | variants/vel_25/frame_00001.png |
| det_0.004 | `float det = random(0.001);` -> `random(0.004);` | moderate | direction changes much faster: wavy, loop-heavy filaments; the central convergence knot is weakened and the texture is busier/more uniform | variants/det_0.004/frame_00001.png |
| alpha_200 | `stroke(250, 20, 0, 80);` -> `stroke(250, 20, 0, 200);` | none | no visible change (score 0.0): the alpha only applies to the first vertex of each polyline, which is immediately overwritten by the per-vertex `getColor` stroke | variants/alpha_200/frame_00001.png |
| steps_40 | `for (int j = 0; j < 100; j++)` -> `j < 40` | subtle | shorter trajectories: knot smaller and tighter, curves stop short of the frame edges, more empty periphery | variants/steps_40/frame_00001.png |

## Modularisation notes
- Generic: the flow-walk itself (two decorrelated 3-D noise samples -> spherical
  direction -> fixed-length step, N iterations) is a self-contained
  `noiseFlowPath(origin, stepLen, steps, detail, offsets)`; the noise-driven palette
  lerp `getColor` is another small reusable.
- One-off art decisions: the 8x8x8 grid for start points, 500 paths x 100 steps,
  `vel = 10`, the specific 5-colour palette, ADD blending, black background, and the
  centered-cube translate.
- A clean parameter object: `{gridSize: 8, paths: 500, steps: 100, stepLen: 10,
  noiseDetail: 0.001, palette: [...], blend: 'add', background: 0}`. The per-frame
  re-seed should become a `seed` input rather than an internal reset.
- Experiment findings for the parameter object: `noiseDetail` (det) is the strongest
  look lever (convergence vs. turbulence); `cc` and `vel` scale the structure; `paths`
  and `steps` are density/length dials; the line-48 stroke alpha is dead code and
  should be dropped.
