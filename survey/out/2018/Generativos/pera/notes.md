---
sketch: 2018/Generativos/pera
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1562
animated: false
techniques: [noise-field, particles, dots-stippling, grid]
primitives: [shape, line]
palette:
  colors: ["#F8F8F9", "#FE3B00", "#7233A6", "#0601FE", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: planets, default: 1200, tried: [400], change: moderate, effect: "fewer, sparser discs; the hidden grid becomes clearly visible"}
  - {name: det1, default: "random(0.01)", tried: ["random(0.002)"], change: moderate, effect: "coarser size field: disc density becomes a smooth large-scale gradient (sparse top, dense bottom) instead of mid-scale clusters"}
  - {name: "size scale (*820)", default: 820, tried: [400], change: moderate, effect: "all discs ~half size; field looks more diffuse with more background showing through"}
  - {name: "alpha ramp (map to 0..255)", default: 255, tried: [128], change: subtle, effect: "same structure, slightly lighter/more washed out; blue ground reads through the discs more"}
  - {name: "grid divisions (random(100))", default: "random(100)", tried: ["random(24)"], change: none, effect: "no visible change: the thin grid is already nearly covered by 1200 discs in the baseline"}
  - {name: "palette colors[]", default: "F8F8F9/FE3B00/7233A6/0601FE/000000", tried: ["F8F8F9/00B328/1D3557/E63946/000000"], change: large, effect: "identical structure in new colours: green discs on a red ground"}
reusable_candidates:
  - {name: noiseSizedBlobs, signature: "noiseSizedBlobs(count, sizeScale, noiseDetail, noiseOffset) -> List<Blob>", note: "random positions, sizes sampled from a 2-D noise field so blobs cluster"}
  - {name: radialTriangleDisc, signature: "radialTriangleDisc(x, y, r, segments, coreColor, edgeColor, alpha) -> void", note: "disc approximated by a triangle fan with per-slice colour lerp and soft edge"}
---

## What it draws
A full-bleed field of hundreds of overlapping translucent discs on a saturated blue background.
The discs are orange-red with a denser, more saturated core and a paler, bluer rim; sizes run
from tiny specks to large soft blobs, and large blobs tend to cluster in patches. A faint
orthogonal grid of thin lines is visible in a few regions. Later-drawn discs are more opaque,
so the field reads denser where the larger blobs sit.

## How the code works
`setup()` (lines 3-8) sizes the 960x960 P2D canvas and calls `generate()` once; `draw()` is
empty so the image is static. `generate()` (lines 21-101):

- Background and three accent colours are picked at random from the 5-colour list
  `colors[]` (line 110) via `rcol()` (lines 111-113): background `back`, accents
  `c1..c3` (lines 23, 40-42).
- `planets = 1200` discs are placed at random positions snapped to a 5 px grid
  (lines 46-63). Each disc's radius is not random per se: it is sampled from a 2-D
  Perlin noise field — `s = pow(noise(des1+x*det1, des1+y*det1), 2.2)*820` (line 65) —
  where `det1 ~ U(0,0.01)` sets the noise scale (line 30). The `^2.2` power compresses
  most samples toward zero, so most discs are small and only noise peaks give large
  blobs; this is why big blobs cluster.
- Each disc is a triangle fan of `cc = max(8, s*PI)` slices (line 67). The centre
  slice uses `col1 = lerpColor(back, c1, fog)` (line 70) with `fog = i/planets`, and
  the rim slices lerp between `col2` and `col3` (lines 71-72, 81-84), which are also
  lerps toward the background — so edges fade into the blue. Alpha ramps with index,
  `alp = map(i, 0, planets, 0, 255)` (line 74), so later discs are more opaque.
- At `i == planets/2` (line 48) a one-off grid is stroked: `cc = int(random(100))`
  equally spaced vertical and horizontal lines (lines 49-56) — the faint grid visible
  in the image.
- The `points` list (lines 92-100) is built but never used for anything visible.

## Experiments
| variant | substitution | change score | observation | image |
| planets_400 | `int planets = 1200;` -> `int planets = 400;` | moderate (0.091, 41.9%) | fewer, more separated discs; the thin blue grid now clearly shows through across the whole canvas because there are far fewer discs covering it | variants/planets_400/frame_00001.png |
| det1_0.002 | `float det1 = random(0.01);` -> `random(0.002);` | moderate (0.098, 41.4%) | size field becomes much smoother: instead of mid-scale clusters there is one large-scale gradient, sparse small discs at top dissolving into dense large discs at bottom | variants/det1_0.002/frame_00001.png |
| size_400 | `...*2.2)*820;` -> `...*2.2)*400;` | moderate (0.070, 31.9%) | every disc ~half size; field looks more diffuse and hazy, more blue ground visible between the now-medium blobs | variants/size_400/frame_00001.png |
| alpha_128 | `map(i, 0, planets, 0, 255)` -> `..., 0, 128)` | subtle (0.036, 10.2%) | same structure, slightly lighter/more washed out; discs a touch more transparent so the blue reads through a bit more | variants/alpha_128/frame_00001.png |
| grid_24 | `int cc = int(random(100));` -> `int(random(24));` | none (0.000, 0.0%) | no visible change: the one-shot grid is already nearly invisible under 1200 discs, so coarsening it changes nothing perceptible | variants/grid_24/frame_00001.png |
| palette_alt | `colors[] = {F8F8F9, FE3B00, 7233A6, 0601FE, 000000}` -> `{F8F8F9, 00B328, 1D3557, E63946, 000000}` | large (0.361, 100%) | identical disc layout recoloured: green discs on a red ground instead of orange on blue | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic: the noise-driven size field (positions random, radius from a 2-D noise sample)
  and the radial-triangle disc renderer (fan with per-slice colour/alpha) are both
  reusable, as described in `reusable_candidates`.
- One-off art decisions: the 5-colour list, the `fog`/alpha ramp tied to draw order, the
  one-shot mid-loop grid, and the 5 px position snapping.
- A clean parameter object would be: `count`, `sizeScale` (the *820), `sizePower` (2.2),
  `noiseDetail` (det1), `segmentsMin` (8), `alphaRamp` (0..255), `gridDivisions`
  (random(100)), `palette`, `background`.
