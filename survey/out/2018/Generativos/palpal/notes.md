---
sketch: 2018/Generativos/palpal
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 1521
animated: true
techniques: [3d-mesh, 3d-pointcloud, polar, lines-hatching, curves]
primitives: [shape, point, line, ellipse, arc]
palette:
  colors: ["#FEB63F", "#F29AAA", "#297CCA", "#003151", "#E1DBDB"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: polarQuadRing, signature: "polarQuadRing(count, segs, radius, thickness, color) -> void", note: "hollow ring of N thick quads around a circle at random 3D orientation; camera near/inside it reads as flat colour bands"}
  - {name: spherePointCloud, signature: "spherePointCloud(n, radius) -> void", note: "n points uniformly on a sphere via acos(random(-1,1)) (palpal.pde:91-98)"}
  - {name: rcol, signature: "rcol() -> int", note: "uniform pick from a fixed palette array (palpal.pde:183-185)"}
---

## What it draws
Frame 1 (seed 42): a huge flat mustard field fills most of the canvas, broken at the bottom by a
diagonal band of flat geometric shards in medium blue, pink, dark navy and off-white, with a few
thin white tick marks. The image is fully regenerated on every frame: by frame 60 the view has
swung to thick pink, grey and navy 3D bars crossing the mustard field, a blue ellipse at the top
edge, and a scattering of tiny white arcs. Dominant colours throughout: mustard yellow, medium
blue, dark navy; accents of pink and light grey.

## How the code works
- `setup()` (palpal.pde:3-11): 960x960 P3D, `smooth(8)`, `pixelDensity(2)`; `draw()` calls
  `generate()` **every frame** (line 15), so the whole scene is rebuilt continuously.
- `time = millis()*0.001*random(0.8, 4)` (line 30) drives all rotations; `mtime = time % 1`
  (line 31) is the per-second phase. This `millis()` term is why the render is not
  reproducible from the seed alone (`deterministic: false`).
- Background is one random palette colour per frame (line 33, `rcol()`).
- Camera: `ortho()`, centred, then `rotateX/Y/Z(time*random(-0.1,0.1))` (lines 35-40) — a slow
  tumbling of the whole scene.
- Ring of quads (lines 42-63): 30 iterations; each iteration adds another random time-based
  rotation, then draws `res = 120` closed quads around a circle of radius
  `r = width*random(1.8, 2)` (line 51) with thickness `amp = width*random(0.05)*random(1)`
  (line 50). The radius is 1.8-2x the canvas, i.e. the camera sits near/inside the ring wall, so
  the quads project as the enormous flat colour bands (the mustard field). One `fill(rcol())`
  per iteration (line 49) gives the flat band colour.
- Point cloud (lines 90-98): 200 white points on a sphere of radius `width*1.6` — mostly
  outside the frame, occasionally visible as tiny dots.
- Central shapes (lines 100-175): `cc = int(random(1, random(500)))` (line 101) primitives laid
  out along the Z axis at spacing `ss = width*2./cc` (line 102, 107). Each index i re-seeds with
  `randomSeed(seed+(i-val)*1000)` (line 105, `val = int(time)`), so each slot is stable across
  frames but the set shifts as time advances. Each slot draws one of: filled ellipse
  (rnd==0, line 129), two variants of segmented arcs (rnd 1/2, lines 130-151), radial spokes
  (rnd 3, lines 152-162), or 3D lines perpendicular to the view plane (rnd 4, lines 163-173).
  The first 4 slots additionally get a fading white stroked ellipse (lines 113-117) — these are
  the big pink/grey/navy bars — and most slots add a white line or point (lines 119-125), the
  thin tick marks. First 10 slots scale in over `mtime` (lines 109-111).
- Palette: 5 fixed hex colours (line 182); `rcol()` (183-185) picks uniformly at random.
  `getColor()` (189-195) is an unused lerp helper.
- Randomness: `randomSeed(seed)` at the top of `generate()` (line 28), but the `millis()`-based
  `time` makes successive frames different regardless of seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `polarQuadRing` (30-iteration nested rotation + quad ring, lines 42-63) and
  `spherePointCloud` (lines 90-98) are self-contained 3D generators; `rcol` is a trivial
  palette helper. The central slot loop (lines 100-175) is a per-slot random primitive picker
  (ellipse / arcs / spokes / 3D lines) — reusable if the per-slot `randomSeed(seed+i*1000)`
  pattern (stable slots, time-shuffled set) is kept.
- One-off art decisions: the exact palette, the 1.8-2x radius (camera-inside framing), the
  fading white ellipse "comet" heads (lines 113-117), the per-second `val`/`mtime` phase
  logic.
- Clean parameter object: `{seed, ringIters(30), ringSegs(120), ringRadiusMul(1.8-2),
  ringThickMul(0.05), slotCount(1..500), slotSizeMul(40), palette[5]}`.
