---
sketch: 2019/generativos/arau
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 5574
animated: false
techniques: [particles, noise-field]
primitives: [ellipse, line]
palette:
  colors: ["#026AF7", "#429BD6", "#444C5D", "#EE3B25", "#24C230", "#FDCC26"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: 4400, tried: [1500], change: large, effect: "far fewer trees; sparse scene with black gaps between distinct, well-separated conifers"}
  - {name: v-exponent (line 62), default: 3.8, tried: [1.5], change: large, effect: "flattens perspective: trees much more evenly distributed top-to-bottom, top-row trees no longer tiny"}
  - {name: size factor (line 65), default: 0.26, tried: [0.13], change: large, effect: "half-size trees; whole field becomes fine texture, large bottom trees become thin vertical lines"}
  - {name: den (branch density, line 98), default: "random(1.5, 3)", tried: [0.5], change: large, effect: "long thin branch curves mostly gone; trees become compact, densely speckled, more saturated cones"}
  - {name: detCol (noise detail, line 58), default: "random(0.007,0.01)*0.18", tried: ["random(0.007,0.01)*0.54"], change: moderate, effect: "coarser noise field: much broader, smoother colour patches (large green/blue/red regions), tree colour within each region more uniform"}
reusable_candidates:
  - {name: ara, signature: "ara(x, y, size, colorIndex)", note: "recursive-looking conifer: vertical tapering spine of ellipses + outward curving branch strokes + ADD-blended tip dots"}
  - {name: getColor, signature: "getColor(float v) -> color", note: "cyclic palette: lerpColor between adjacent palette entries, index = v % len"}
  - {name: perspectiveScatter, signature: "perspectiveScatter(count, exp, yRange, sizeRange)", note: "place N items on canvas with y/size driven by pow(map(i,0,N,0,1), exp) to fake depth"}
---

## What it draws
A dense, full-bleed field of hundreds of conifer/pine-tree shapes on a near-black background, packed edge to edge. Trees are small at the top of the image and progressively larger toward the bottom, creating a fake one-point perspective (a forest floor receding to a horizon). Colour is patchy: broad noise-driven regions of blue, yellow-green, green and red-orange trees interleave, with bright blue dominating the mid field. Each tree is a fuzzy, hair-like cluster of thin vertical strokes fanning out from a trunk, with tiny glowing dots at branch tips.

## How the code works
- `setup()` calls `generate()` once (draw() is empty, so the image is static; keyPressed regenerates with a new seed). `background(4)` gives the near-black ground (line 49).
- `generate()` (line 44): sets `randomSeed`/`noiseSeed`. Picks a global noise offset `desCol` (line 57) and a tiny noise detail `detCol = random(0.007,0.01)*0.18` (line 58).
- Main loop (lines 60–72): `cc = 4400` trees. Each gets `v = pow(map(i,0,cc,0,1), 3.8)` — the 3.8 exponent pushes most trees toward the bottom (v→1), giving the perspective: `y = height*map(v,0,1,0.04,1.1)` and `size s = width*map(v,0,1,0.1,1)*0.26*random(0.6,1)`. x is uniform across ±10% of width. The per-tree colour index `ic = noise(desCol + x*detCol, desCol + y*detCol)*colors.length*2 + random(1)` samples 2-D value noise over the canvas, so nearby trees share a palette position → the broad colour patches. A small random rotation (line 69) tilts each tree slightly.
- `ara()` (line 76) draws one conifer:
  1. Spine (lines 86–96): `s` iterations, a column of small filled ellipses rising from the base (y goes from `y+s*0.1` to `y-s`), width tapering by `pow(v, 1.1)`; a `mov` jitter accumulator (decayed, random) wanders the spine horizontally. Colour drifts along the spine via `getColor(ic + dc*i)`.
  2. Branches (lines 98–143): `s*random(1.5,3)` iterations. Each computes a pseudo-random amplitude `amp` from a shaped `cos` of a pow'd random (lines 103–107) and a direction `ang` that is a half-right angle mirrored to the left half with 50% probability (lines 115–116). A 4-point `curve()` stroke (line 134) sweeps from the spine out to a tip, alpha 30–50, colour `getColor(ic+dc*i+random(1))`. Then `blendMode(ADD)` + a small filled ellipse at the tip (alpha 190) creates the glowing dots (lines 137–142).
- Palette (line 158): 6 fixed colours (blue, light blue, slate, red, green, yellow). `getColor(float v)` (line 165) wraps v modulo the palette and lerps between adjacent entries — so colour cycles continuously through the 6 colours as the noise field varies.
- The `triangulate` import is unused in the code; `pixelDensity(2)` fails headless (warning in stderr, no effect).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_1500 | `int cc = 4400;` -> `int cc = 1500;` | large (0.2378, 0.798) | much sparser: distinct, well-separated conifers with black gaps; individual trees clearly legible, perspective still visible | variants/cc_1500/frame_00001.png |
| exp_1.5 | `float v = pow(map(i, 0, cc, 0, 1), 3.8);` -> `... 1.5);` | large (0.1616, 0.674) | perspective flattened: trees distributed fairly evenly top to bottom, top-row trees no longer tiny; denser mid-field, red band at bottom | variants/exp_1.5/frame_00001.png |
| size_0.13 | `float s = width*map(v, 0, 1, 0.1, 1)*0.26*random(0.6, 1);` -> `*0.13*random(0.6, 1);` | large (0.2735, 0.845) | all trees half size; whole image becomes fine stipple texture, large bottom trees reduce to thin vertical lines with faint trunks | variants/size_0.13/frame_00001.png |
| den_0.5 | `float den = random(1.5, 3);` -> `float den = 0.5;` | large (0.2296, 0.823) | long thin branch curves mostly gone; trees become compact, densely speckled, more saturated cones; colour mixes look hotter (more red/green/yellow) | variants/den_0.5/frame_00001.png |
| detCol_0.54 | `float detCol = random(0.007, 0.01)*0.18;` -> `... *0.54;` | moderate (0.1365, 0.592) | coarser noise field: broad smooth colour regions (large green band left, blue fields, red at bottom); tree shapes softer/feathery, within-region colour more uniform | variants/detCol_0.54/frame_00001.png |

## Modularisation notes
- `ara(x, y, size, colorIndex)` is self-contained and generic: a "conifer" primitive with a tapering spine, curved branch strokes and additive tip dots. Its look is controlled by `pwrTron` (taper), the `den` branch-count range, the `ang`/`amp` shaping, stroke alpha (30–50) and tip-dot alpha (190).
- `getColor(v)` + the cyclic 6-colour palette is a reusable "cyclic palette lerp" utility (noise-driven colour selection).
- The main-loop scatter (`pow(map(i,0,N,0,1), exp)` driving both y position and size) is a generic "fake-perspective scatter" pattern; `exp` (3.8), `cc` (4400) and the 0.26 size factor are the main knobs.
- One-off art decisions: the specific 6-colour palette, the `desCol`/`detCol` noise-offset scheme, the 3.8 exponent, the mirrored-half angle choice, the ADD-blended tip dots.
- A clean parameter object would be: `{count, exponent, sizeScale, sizeJitter, noiseDetail, palette, spineAlpha, branchAlpha, tipAlpha, branchDensity, taper}`.
