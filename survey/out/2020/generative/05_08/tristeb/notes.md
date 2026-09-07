---
sketch: 2020/generative/05_08/tristeb
year: 2020
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 2233
animated: false
techniques: [noise-field, particles, polar, lines-hatching]
primitives: [ellipse, line, shape]
palette:
  colors: ["#FFFFFF", "#FFB0D0", "#F7DE20", "#245C0E", "#EB6117", "#F72C11", "#C6356B", "#953DC4", "#003399", "#02060D"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: 10, tried: [40], change: none, effect: "no visible change - the cc loop's only draw call is commented out"}
  - {name: background, default: "#FFB0D0", tried: ["#02060D"], change: moderate, effect: "ground turns near-black, every shape unchanged"}
  - {name: scatterCount, default: 1200, tried: [600], change: large, effect: "half the patches and strands; composition visibly sparser, more pink ground shows through"}
  - {name: blobSize, default: 24, tried: [48], change: large, effect: "patches, discs and strands all ~2x larger; denser, heavily overlapping composition"}
  - {name: strandChance, default: 0.1, tried: [0.3], change: large, effect: "3x more random-walk strands; top half packed with tentacles, more banded trunks"}
  - {name: formBands, default: 24, tried: [48], change: large, effect: "central fish form twice as many, finer stripes; more satellite eye dots"}
reusable_candidates:
  - {name: rcol, signature: "rcol(colors[]) -> int", note: "random pick from a fixed palette list"}
  - {name: getColor, signature: "getColor(v) -> int", note: "lerp between adjacent palette entries indexed by a continuous value"}
  - {name: hoja, signature: "hoja(x, y, s)", note: "irregular polar blob: vertices on a circle with 50% randomly skipped"}
  - {name: form, signature: "form(cx, cy, size)", note: "concentric band of random-palette ellipses with satellite 'eye' dots and spokes"}
---

## What it draws
Flat, fully saturated collage on a pink ground. A wide horizontally-striped
fish/seed form (alternating purple, orange, red, blue bands) dominates the
centre, ringed by big solid discs (yellow, red, purple, green) each carrying a
black dot, and a small vertically-striped seed in the middle. Thin multicolour
strands rise from the top edge like grass or tentacles, and soft banded
gradient "trunk" shapes stand up from the bottom. Small scattered dots and
thin white wire arcs appear throughout.

## How the code works
`setup()` -> `generate()` (tristeb.pde:20-21); P3D 960x960, `smooth(8)`
(settings:13-18). `background(#FFB0D0)` pink (line 46).

- Scatter loop, lines 53-90: 1200 iterations. `x = random(1)*width`;
  `y = height*(noise(x*detH)*0.2 + random(1.2)*random(1))` (line 56) so blobs
  sit mostly in the lower two thirds, with noise modulating the band.
  `s = 24*pow(vy,2.8)*random(0.8,1.8)` (line 58) makes shapes bigger toward
  the bottom. Each point gets a `hoja()` blob (lines 115-126): a closed
  shape whose vertices lie on a circle but 50% are randomly skipped
  (line 122), giving ragged circular patches in a random palette colour
  `rcol()` (lines 186-188: uniform pick from the 10-colour list at line 185).
- Strand random-walk, lines 63-89: for 10% of points (`random(1) < 0.1`) a
  walk of `rep = 1000-2000` steps (line 72). Angle starts from a noise field
  minus `HALF_PI*0.7` (line 65, i.e. roughly upward) with small noise jitter
  (line 76); position advances by `v` each step (lines 77-78). Each step draws
  a small rotated ellipse (lines 81-86) filled with `getColor(...)` (lines
  194-199: lerp between adjacent palette entries) and stroked white with
  alpha oscillating `cos(j*osc)` (line 80). `s *= 0.998` tapers the walk
  (line 87). These walks produce the top-edge strands and the banded gradient
  trunks; the white stroke + tight stepping produces the smooth banded look.
- Central form, lines 93-106: two `form()` calls (line 103: `ss*3`, line
  105: `ss*2`, `ss = width*0.3`), each pre-rotated by `HALF_PI` (lines
  102, 104) so the vertical ellipses become horizontal bands. `form()`
  (lines 129-175) draws `count = 24` ellipses from centre outward
  (line 139-147: `v1 = 1 - i/count`, `s = size*pow(1-v1, 0.8)`, width
  `s*v1*amp`, height `s`), each filled with a fresh `rcol()` and a
  semi-transparent white stroke (line 142) — the striped fish body. With 50%
  probability per band (line 150) it adds a satellite ellipse at the band
  rim with a tiny dot (line 159), a spoke line (line 168) and a black dot
  (line 172) — the big "eyes".
- The `cc = 10` loop (lines 108-112) is a no-op: its only draw call
  (ellipse, line 111) is commented out.
- Randomness: `randomSeed(seed)` / `noiseSeed(seed)` (lines 43-44); every
  `random()` call is the sole source of variation, `noise()` drives
  vertical placement and strand heading. The triangulate and toxi imports
  (lines 1-2) are unused in the code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_40 | `int cc = 10;` -> `int cc = 40;` | none | no visible change (loop's ellipse is commented out) | variants/cc_40/frame_00001.png |
| bg_02060D | `background(#FFB0D0);` -> `background(#02060D);` | moderate | ground near-black, all shapes identical | variants/bg_02060D/frame_00001.png |
| scatter_600 | `for (int i = 0; i < 1200; i++) {` -> `... 600 ...` | large | sparser: fewer/smaller discs, thinner fish, fewer strands; more pink visible | variants/scatter_600/frame_00001.png |
| blob_48 | `float s = 24*pow(vy, 2.8)*random(0.8, 1.8);` -> `48*...` | large | discs, patches and strands all much bigger; dense overlapping collage | variants/blob_48/frame_00001.png |
| strands_0.3 | `if (random(1) < 0.1) {` -> `< 0.3` | large | 3x strands: entire top half filled with tentacles, many more banded trunks | variants/strands_0.3/frame_00001.png |
| formCount_48 | `int count = 24;` -> `int count = 48;` | large | central form denser with finer stripes and more satellite eyes | variants/formCount_48/frame_00001.png |

## Modularisation notes
- Generic candidates: `rcol`/`getColor` (fixed-palette random pick and
  continuous lerp sampler) are reusable as-is. `hoja` (ragged polar patch)
  and `form` (concentric banded form with satellite dots) are self-contained
  drawing blocks; `form` would take `(cx, cy, size, bandCount, palette)` and
  the satellite-dot probability as parameters.
- The strand walk (lines 63-89) is a generic "noise-steered tapered random
  walk of ellipses": parameters would be start density (the 0.1 threshold),
  step count range, taper rate (0.998), stroke oscillation, and palette
  sampler.
- One-off art decisions: the pink background, the 10-colour list, the
  `vy^2.8` size falloff, the double `form()` placement/rotation at centre,
  and the dead `cc` loop (candidate for deletion).
