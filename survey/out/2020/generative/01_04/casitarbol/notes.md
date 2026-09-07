---
sketch: 2020/generative/01_04/casitarbol
year: 2020
renderer: P3D
size: [960, 960]
libraries: [triangulate, peasy, toxi]
deterministic: true
ms_first_frame: 1873
animated: false
techniques: [polar, grid, lines-hatching, noise-field, 3d-mesh]
primitives: [point, line, shape]
palette:
  colors: ["#FFB401", "#072457", "#EF4C02", "#ADC7C8", "#FE6567"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: res, default: "int(random(80,100)*2) ≈ 160–198", tried: ["int(random(30,40)*2) ≈ 60–80"], change: large, effect: "fewer points per ring: sparser, more open lacy hatching, weaker central rosette"}
  - {name: detCol, default: "random(0.002)", tried: [0.02], change: moderate, effect: "finer color-noise scale: grainier mottling, paler pinker background"}
  - {name: "ring step (i +=)", default: 0.025, tried: [0.1], change: large, effect: "10 rings instead of 40: sparse radial web with big gaps, small white flower at the center"}
  - {name: div, default: "int(random(5,10)) (8 at seed 42)", tried: [12], change: moderate, effect: "12×12 grid of smaller boxes covering most of the canvas; hatching unchanged"}
  - {name: "box size (siz*)", default: 0.1, tried: [0.3], change: large, effect: "3× larger boxes: nearly cover the hatching, rosette mostly hidden behind squares"}
  - {name: sub, default: 20, tried: [6], change: moderate, effect: "shorter spikes: finer, lighter hatching, smaller thinner central rosette"}
reusable_candidates:
  - {name: aro, signature: "aro(x, y, z, radius, res, col, detCol) -> void", note: "one polar ring: res points, each a shrinking radiating line spike; the spike loop (sub iterations, dd *= 0.84) is the reusable hatching primitive"}
  - {name: getColor, signature: "getColor(v) -> color", note: "noise-driven palette: v -> lerp between adjacent entries of a fixed 5-color list"}
---

## What it draws
Full-bleed warm orange radial texture: thousands of fine short lines radiate from the center in concentric rings, densest at the middle where they braid into a bright white starburst/rosette, fading to pale pink toward the corners. On top sits a slightly tilted 8×8 grid of small flat squares (rendered as shallow 3D boxes) in yellow, navy blue, salmon pink, teal-gray and orange-red, each in a random palette color, spaced over the whole canvas.

## How the code works
`setup()` -> `generate()` (line 49); `draw()` is empty so the image is static (confirmed: frames 1/10/60 md5-identical).
- Camera: `translate` to center with z=-200, then small random `rotateX`/`rotateY` (lines 58-60) — the whole composition, grid included, gets a slight 3D tilt.
- Rings (lines 73-78): `res = int(random(80,100)*2)` ≈ 160-198 points per ring; 40 rings from radius factor `i` = 0.02 to 1 in steps of 0.025, each ring radius `width*0.7*i` at depth `i*20`.
- `aro()` (line 97): for each of the `res` points on the ring (5% randomly skipped, line 106):
  - a stroke point colored by `getColor(noise(...) * 9)` — noise sampled at the point's position with scale `detCol = random(0.002)` (lines 101, 114) gives the mottled color field;
  - a spike (lines 126-144): `sub = 20` iterations, each a line from origin to `dd` along local x plus 8 tiny diagonal sub-lines, `dd *= 0.84` per step — these shrinking radiating spikes make the fine hatching; their length `dd` scales with ring radius and oscillates with `cos(v*TAU*10)` (line 116), so spikes are longer at some angles, producing the braided rosette at the center;
  - a white highlight point (lines 145-148) — the bright core.
- Grid (lines 81-94): `div = int(random(5,10))` (8 with seed 42), `siz = width*3.8/div` so the grid overflows the canvas edges; each cell gets a `box(siz*0.1)` filled `rcol()` at alpha 180 (line 90) — flat random palette squares, semi-transparent so the orange texture shows through.
- Palette: 5 fixed colors (line 163); `rcol()` picks one at random, `getColor(v)` lerps between two adjacent palette entries with a noise-driven `v` (lines 169-181).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| res_60 | `int res = int(random(80, 100)*2);` -> `int(random(30, 40)*2);` | large (0.156, 64%) | sparser point rings: coarser, more open lacy texture, ring structure visible, weaker central rosette; grid unchanged | variants/res_60/frame_00001.png |
| detCol_0.02 | `float detCol = random(0.002);` -> `random(0.02);` | moderate (0.086, 40%) | grainier, lighter color mottling; background reads paler/pinker with finer patch structure | variants/detCol_0.02/frame_00001.png |
| ringstep_0.1 | `i+=0.025` -> `i+=0.1` | large (0.205, 81%) | only 10 rings: sparse radial web with wide gaps, small white flower at the center, texture much lighter | variants/ringstep_0.1/frame_00001.png |
| div_12 | `int div = int(random(5, 10));` -> `int div = 12;` | moderate (0.060, 22%) | 12×12 grid of smaller boxes over most of the canvas; hatching underneath unchanged | variants/div_12/frame_00001.png |
| boxsize_0.3 | `box(siz*0.1);` -> `box(siz*0.3);` | large (0.174, 62%) | 3× larger boxes cover most of the hatching; rosette and texture mostly hidden behind the squares | variants/boxsize_0.3/frame_00001.png |
| sub_6 | `int sub = 20;` -> `int sub = 6;` | moderate (0.112, 39%) | shorter spikes: finer, lighter hatching overall, smaller and thinner central rosette | variants/sub_6/frame_00001.png |

## Modularisation notes
- Generic/reusable: the `aro()` ring-of-spikes primitive (parameterized by radius, point count, spike length `sub`, decay 0.84, and a color function) — a "radial hatch ring" for the library; `getColor(v)` noise-to-palette lerp; the `div`×`div` overflow grid of flat random-color boxes (composition layer, decoupled from the texture).
- One-off art decisions: the specific 5-color palette; the 3D tilt + z=-200 staging; the `time`-based oscillation baked into spike length (line 116) and ring depth `dz` (line 102), which makes each seed's rosette pattern unique; the 5% point dropout.
- Clean parameter object: `{ringCount, ringStep, pointsPerRing, noiseScale (detCol), spikeSteps (sub), spikeDecay, boxGridDiv, boxSizeFrac, boxAlpha, palette[], tilt}`.
