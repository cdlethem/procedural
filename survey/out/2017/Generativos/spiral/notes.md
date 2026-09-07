---
sketch: 2017/Generativos/spiral
year: 2017
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1500
animated: false
techniques: [spiral, distortion]
primitives: [rect]
palette:
  colors: ["#12baa3", "#f7df0c", "#f4f4f4", "#154fef", "#eba5ff"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: rt, default: "random(-0.02, 0.02)", tried: [0.02], change: large, effect: "fixed max twist: rings rotate consistently, clear swirled spiral instead of loose wobble"}
  - {name: da, default: "random(-0.1, 0.1)", tried: ["random(-0.4, 0.4)"], change: subtle, effect: "subtle: wobble range widened but ring shapes and core position nearly unchanged at this seed"}
  - {name: dd, default: "random(1)", tried: ["random(5)"], change: large, effect: "stronger per-ring drift: core lands far off-center (upper right), big empty margin at lower left"}
  - {name: dc, default: "random(colors.length*2)*random(1)*random(1)", tried: ["random(colors.length*2)"], change: large, effect: "faster colour cycling: many more colour bands, denser rainbow effect around the rings"}
  - {name: smo, default: "map(j, 0, cc, 0, 0.5)*r.z", tried: ["map(j, 0, cc, 0, 0.9)*r.z"], change: moderate, effect: "inner rings much more rounded, softer blob-like core; outer rings already nearly maxed out"}
reusable_candidates:
  - {name: nestedRotatedRects, signature: "nestedRotatedRects(cx, cy, size, count, twist, wobble, drift, palette) -> void", note: "concentric rounded rects shrinking toward a drifting, progressively rotated centre"}
  - {name: lerpPalette, signature: "lerpPalette(palette, v) -> color", note: "cyclic index into palette with lerp between adjacent entries"}
---

## What it draws
One big stack of concentric, rounded-corner squares, each slightly smaller and slightly
rotated relative to the one outside it, so the edges read as a gently twisting, wobbling
spiral that converges on a small off-center core. The fill cycles through a 5-colour
palette (teal, yellow, off-white, blue, lilac) with smooth lerp between neighbours, so
adjacent rings are related colours rather than hard blocks. The background is a random
palette colour; with seed 42 it is yellow, the same as the outermost ring, so the square
sits edge-to-edge on a full-bleed canvas.

## How the code works
- `setup()` (spiral.pde:3) calls `generate()` once; `draw()` is empty, so the image is
- `generate()` (spiral.pde:28) fills the background with a random palette colour via
  `rcol()` (spiral.pde:75), which picks one of the 5 colours (spiral.pde:74) uniformly.
- A quadtree-subdivision loop (spiral.pde:31-42) is present but disabled: the loop bound
  is `i < 0`, so it never runs and `rects` always contains exactly one entry: the whole
  canvas as `PVector(0, 0, width)` (spiral.pde:32). The "spiral" is therefore produced by
  a single cell covering the full canvas.
- For each cell (only the one full-canvas cell) the inner loop (spiral.pde:58) draws `cc`
  nested rounded rects. `cc` = `int(r.z*random(0.1, 1)+1)` (spiral.pde:48), so 96-960
  squares. Size of square j is `map(j, 0, cc, r.z, 0)` (spiral.pde:59): full canvas size
  at j=0 down to 0 at the end.
- Spiral mechanics: `rt` (spiral.pde:51) is a constant rotation increment per ring
  (`random(-0.02, 0.02)`); each ring is drawn after `rotate(rt*j)` (spiral.pde:62-64),
  giving cumulative twist. The centre drifts each ring along a slowly turning direction:
  `ang` (spiral.pde:52) is a random start angle, `da` (spiral.pde:53) is the per-ring angle
  change, `dd` (spiral.pde:54) is the per-ring step length, applied at spiral.pde:67-68.
  This is what makes the inner rings wobble and the core land off-center.
- Corner radius: `smo = map(j, 0, cc, 0, 0.5)*r.z` (spiral.pde:60) — outer rings are very
  rounded, inner rings nearly sharp, passed as the 5th `rect()` arg (spiral.pde:65).
- Colour: starting index `ic` is random (spiral.pde:49); ring j gets
  `getColor(ic + dc*j)` where `dc` (spiral.pde:50) is a random cycle speed up to
  2x the palette length. `getColor` (spiral.pde:78) wraps the index cyclically and lerps
  between the two adjacent palette entries, so colour flows smoothly around the ring
  sequence.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| rt_0.02 | `float rt = random(-0.02, 0.02);` -> `float rt = 0.02;` | large | consistent strong twist: whole stack swirled, reads as a true spiral with the outer rings visibly rotated against the canvas | variants/rt_0.02/frame_00001.png |
| da_0.4 | `float da = random(-0.1, 0.1);` -> `float da = random(-0.4, 0.4);` | subtle | no visible change: ring wobble and core placement look almost identical to baseline | variants/da_0.4/frame_00001.png |
| dd_5 | `float dd = random(1);` -> `float dd = random(5);` | large | core drifts strongly to the upper right, leaving a wide empty yellow margin at the lower left; spiral visibly off-center | variants/dd_5/frame_00001.png |
| dc_full | `float dc = random(colors.length*2)*random(1)*random(1);` -> `float dc = random(colors.length*2);` | large | faster colour cycling: more, thinner colour bands — the rings cycle through the full palette several times instead of a few times | variants/dc_full/frame_00001.png |
| smo_0.9 | `float smo = map(j, 0, cc, 0, 0.5)*r.z;` -> `map(j, 0, cc, 0, 0.9)*r.z;` | moderate | inner rings much rounder (nearly circular core), outer rings slightly softer; overall gentler, less square-shaped | variants/smo_0.9/frame_00001.png |

## Modularisation notes
- Generic, reusable: `generate()`'s inner loop is a clean "nested rounded rects with
  cumulative rotation and drifting centre" primitive — the `nestedRotatedRects`
  candidate above. All randomness (twist, wobble, drift, colour index/speed, count) is
  already expressed as plain floats, so a parameter object
  `{count, size, twistPerRing, wobblePerRing, driftPerRing, driftAngle0, cornerFactor,
  colorIndex0, colorSpeed}` would make it fully deterministic and tunable.
- `lerpPalette` (`getColor`) is a standalone, generic cyclic lerp palette sampler.
- One-off art decisions: the 5-colour coolors.co palette (spiral.pde:73-74); the
  disabled quadtree subdivision (spiral.pde:31-42) is dead weight unless re-enabled —
  with a positive bound it would turn the single spiral into a grid of smaller spirals.
