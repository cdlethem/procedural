---
sketch: 2018/Generativos/escaleritas
title: "Escaleritas"
language: processing
year: "2018"
renderer: P3D
deterministic: true
static: true
techniques:
  - 3d-pointcloud
  - grid
  - symmetry
  - distortion
palette: [black, white]
parameters:
  - name: tower_count
    default: 300
    tried: [100, 800]
    effect: "Sparse scene: a few long radiating striped beams on a mostly black frame; changing the count also shifts downstream random draws, so the layout differs from baseline"
  - name: max_sub
    default: 1000
    tried: [300]
    effect: "Fewer, thicker slabs: chunky checker blocks and coarser, wider floor stripes instead of fine moire bands"
  - name: max_z
    default: 5760
    tried: [1920]
    effect: "Towers confined to a tighter band around the horizon: one dense fan from a single vanishing point, far fewer objects high above or below"
  - name: max_h
    default: 220
    tried: [60]
    effect: "Shorter slabs: towers read as thin dashed striped posts/lines rather than tall pillars"
  - name: max_amp
    default: 1.57
    tried: [0.79]
    effect: "Legs nearly closed (opening max 90 deg instead of 180 deg): scene reads as a dense radial burst of thin striped lines from the centre"
---

# What it draws

A static black-and-white 3D perspective scene. The lower third is a floor of long
horizontal black/white stripes receding to a vanishing point near the middle of the
canvas. From that point a dense forest of two-legged checkered "ladder" towers rises
and fans out in every direction; each tower is built of alternating black and white
slabs, so at distance they read as striped or checkered pillars, and some lean
sharply or fall toward the camera. Only pure black and white appear anywhere; the
overall feel is a vertiginous, infinite black-and-white stair city.

# How the code works

- **Renderer / static**: `size(960, 960, P3D)` + `smooth(8)`; `draw()` is empty and
  `generate()` runs once in `setup()`, so the image never animates (frames 1/10/60
  identical in baseline). `randomSeed(seed)` is applied before the object loop, and
  the harness injects `seed` (baseline seed 42), making it deterministic.
- **Perspective**: `fov = PI/random(1.0, 1.3)` gives a very wide angle (138-180 deg),
  with `perspective(fov, aspect, cameraZ/100, cameraZ*1000)`. The camera is centred,
  pushed forward `translate(..., 400)` and pitched `rotateX(-HALF_PI)` so the object
  plane is seen as a floor; a further random `rotateX`/`rotateY` in [-90 deg, 90 deg]
  tilts the whole scene (baseline: mostly level floor with a slight roll).
- **Towers (the "escaleritas")**: a loop of 300 objects. Each is lifted to a random
  vertical offset `z = random(-width*6, width*6)` (i.e. -5760..5760 after the
  rotate, so some towers sit far above/below the horizon) and calls
  `v(random(10000), random(4, 220), int(random(2, 1000)))`.
- **`v(s, h, sub)`**: two legs from the local origin in directions 270 deg +/-
  `amp` (`amp` random 18-90 deg, so the legs form a V whose opening angle is random).
  Each leg is `sub` slabs between radius 0 and `s`; each slab is a quad of half-height
  `mh = h/2` extruded perpendicular to the floor, filled white or black by slab index
  parity, and the opposite leg's parity is inverted, producing the two-legged
  checkered ladder look. `sub` up to 1000 explains the fine stripes that moire into
  grey bands at distance; `s` up to 10000 explains the huge towers that fill the frame.
- **Palette**: only `fill(255)` / `fill(0)` over `background(0)`; the 10-colour
  `colors[]` array and `rcol()`/`getColor()` are dead code, never called.

# Experiments

| variant | changed | diff score | observation |
|---|---|---|---|
| tower_count_100 | loop 300 to 100 | large (mean 0.4082, 0.527 of pixels) | Sparse scene: a handful of long radiating black/white striped beams on a mostly black frame, thin wireframe-like legs visible; far emptier than baseline |
| tower_count_800 | loop 300 to 800 | moderate (mean 0.0986, 0.188 of pixels) | Denser: the floor reads as one broad flat striped band across the middle with a tight fine-striped cluster at right; large blank white area top-left |
| max_sub_300 | sub 2-1000 to 2-300 | large (mean 0.3847, 0.491 of pixels) | Slabs visibly thicker and fewer: chunky checker blocks and bold wide floor stripes instead of fine moire bands |
| max_z_1920 | z offset +/-5760 to +/-1920 | large (mean 0.2524, 0.381 of pixels) | Towers confined near the horizon: one dense fan of checkered towers from a single central vanishing point, floor stripes compressed into the lower half |
| max_h_60 | h 4-220 to 4-60 | large (mean 0.2783, 0.415 of pixels) | Shorter slabs: towers read as thin dashed striped posts/lines rather than tall pillars; large flat striped floor remains |
| max_amp_0p79 | amp 18-90 deg to 18-45 deg | large (mean 0.5278, 0.652 of pixels) | Leg Vs nearly closed: dense radial burst of thin striped lines from the centre, less open checker structure |

# Modularisation notes

- Single tab, no libraries. The generative core is `generate()` + `v(s, h, sub)`,
  cleanly separable into: (1) camera setup (fov, perspective, translate/rotates),
  (2) tower placement (count, z-offset range), (3) tower geometry (s, h, sub, amp).
- `v()` is already a good primitive: a parameterised "checkered ladder" (two legs,
  alternating slabs, random opening angle) that could be exposed with explicit
  `startAngle`, `spread`, `slabs`, `length`, `thickness`.
- Dead code to drop in any port: `colors[]`, `rcol()`, `getColor()`, `saveImage()`
  (duplicated by `saveFrame`), `keyPressed` regeneration.
- The wide-fov + huge z-range combination is the trick: objects placed thousands of
  units away become the fine horizon stripes; a library wrapper should expose the
  z-range and fov as the primary "density/mood" knobs.
