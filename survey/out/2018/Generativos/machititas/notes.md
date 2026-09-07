---
sketch: 2018/Generativos/machititas
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1896
animated: false
techniques: [grid, noise-field, dots-stippling, distortion]
primitives: [shape, ellipse]
palette:
  colors: ["#92C8FA", "#0321A1", "#EFFF43", "#F94D21"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: "random(60,80)*1.4 (~84-112)", tried: [60], change: large, effect: "coarser grid: bigger grid dots, chunkier speckle, thicker white lines"}
  - {name: dotFraction, default: 0.38, tried: [0.8], change: moderate, effect: "dot lattice fills cells into big mottled blue/orange patches, hides yellow ground"}
  - {name: skipProb, default: 0.1, tried: [0.5], change: large, effect: "half of grid cells empty; also shifts RNG stream so blob/speckle placement changes"}
  - {name: speckleCount, default: 100000, tried: [30000], change: moderate, effect: "grainy speckle coat thins out; fine dot lattice and white grid become clearly visible"}
  - {name: blobCount, default: 100, tried: [30], change: moderate, effect: "fewer soft blobs; dot lattice and speckle texture dominate the field"}
  - {name: warpAmp, default: 4, tried: [12], change: moderate, effect: "strong cos wobble on x: dots stretched into vertical dashes, vertical banding, petal-shaped blobs"}
reusable_candidates:
  - {name: paletteLerp, signature: "getColor(colors[], v) -> color", note: "abs(v)%1 mapped across a palette with lerpColor between adjacent entries (machititas.pde:142-149)"}
  - {name: distortedCircle, signature: "distortedCircle(x, y, s, fx, fy, amp)", note: "segmented circle, per-vertex cos/sin wobble via desform (machititas.pde:95-105, 123-127)"}
  - {name: softBlob, signature: "softBlob(x, y, s, steps, colorFn)", note: "~33 concentric shrinking fills faking a radial gradient (machititas.pde:88-91)"}
  - {name: deformedLine, signature: "deformedLine(x1, y1, x2, y2, fx, fy, amp)", note: "lerped line vertices pushed through desform (machititas.pde:107-118)"}
---

## What it draws
Full-bleed bright chartreuse-yellow field. Over it: a faint wobbly white grid of vertical and
horizontal lines; a fine jittered grid of small dots in blue, orange-red and yellow; a dense
all-over speckle of tiny noise-coloured dots; and roughly a hundred large soft-edged blobs in
orange-red, yellow and blue, each with a hard core fading out in concentric rings. Four barely
visible translucent triangles tint the corners. Dominant colours: yellow (background),
orange-red and blue.
## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static
(machititas.pde:3-12). `generate()` (22-93):
- Background: `background(rcol())` picks one of the 4 palette colours at random (26, 135-138) —
  yellow here.
- Grid (31-37): `cc` cells across (random 84-112), white 50-alpha lines drawn by `l()`, which
  lerps vertices and pushes each through `desform()` — a cos/sin wobble of amplitude 4 with
  frequencies `defx`/`defy` ~0.08-0.12 (120-127) — giving the faintly warped grid.
- Dot grid (39-47): one `c()` circle at each cell centre, size `ss*0.38`, random palette fill,
  10% of cells skipped — the stippled blue/orange/yellow dot lattice.
- Corner triangles (49-66): four half-canvas triangles filled with random palette colour at
  alpha ~16-24 — the subtle corner tints.
- Speckle layer (68-77): 100,000 random-position ellipses, size `2*noise(...)`, colour from
  `getColor(noise(desc+x*detc, desc+y*detc))`. `getColor(v)` lerps between adjacent palette
  entries at `abs(v)%1` (142-149) — a noise-driven colour ramp across the whole field.
- Soft blobs (79-92): 100 blobs at grid intersections, radius from 1-D noise (87); each drawn
  by ~33 concentric shrinking circles (j -= 0.03) with fill `getColor(noise(...)+j*0.2)`,
  i.e. colour drifts along the palette as the ring shrinks — the radial fade.
- `c()` (95-105): polygon circle with `max(8, s*PI)` segments, vertices deformed by `desform()`.
Randomness enters only after `randomSeed(seed)` (24): background, palette indices, skips,
noise offsets `desc/desc`/`des/det`. No blend modes; P2D, `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_60 | `int cc = int(random(60, 80)*1.4);` -> `int cc = 60;` | large | coarser grid: grid dots and speckle dots visibly bigger and chunkier, white grid lines bolder; blob layer looks the same | variants/cc_60/frame_00001.png |
| dotSize_0.8 | `c((i+0.5)*ss, (j+0.5)*ss, ss*0.38);` -> `... ss*0.8);` | moderate | dot lattice grows into large mottled blue/orange/yellow patches covering most of the field; yellow ground mostly hidden | variants/dotSize_0.8/frame_00001.png |
| skip_0.5 | `if (random(1) < 0.1) continue;` -> `... < 0.5 ...` | large | half the grid cells left empty; RNG stream also shifts, so in this render the blob field looks denser and speckle colours differ | variants/skip_0.5/frame_00001.png |
| speckles_30000 | `for (int i = 0; i < 100000; i++) {` -> `i < 30000` | moderate | grainy speckle coat nearly gone; crisp blue/orange dot lattice and faint white grid stand out over the yellow ground | variants/speckles_30000/frame_00001.png |
| blobs_30 | `for (int i = 0; i < 100; i++) {` -> `i < 30` | moderate | only a handful of soft blobs left; dot lattice and speckle texture dominate the whole field | variants/blobs_30/frame_00001.png |
| warp_12 | `float dx = x+cos(x*defx)*4;` -> `*12;` | moderate | dots stretched into vertical dashes with strong vertical banding; grid lines wavier; blobs get petal-like stretched shapes | variants/warp_12/frame_00001.png |

## Modularisation notes
- Generic / reusable: `getColor` palette-lerp (pure function of a colour list + float),
  `desform` wobble (needs fx, fy, amp as parameters instead of globals), `c`/`l` deformed
  primitives, the soft-blob concentric-fill loop, the N-speckle noise-colour pass.
- One-off art decisions: the 4-colour palette, the yellow-background + 4-corner-triangle
  composition, blob count/placement on the grid, 10% cell skip.
- Clean parameter object: `{palette[], cellCount, dotFraction (0.38), skipProb (0.1),
  speckleCount (100000), blobCount (100), noiseFreq (0.01), wobbleAmp (4), wobbleFreq (0.08-0.12)}`.
