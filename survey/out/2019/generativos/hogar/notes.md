---
sketch: 2019/generativos/hogar
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1537
animated: false
techniques: [noise-field, packing]
primitives: [shape]
palette:
  colors: ["#F20707", "#FCCE4A", "#B7D6E8", "#342EE8"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: candidates, default: 50000, tried: [20000], change: large, effect: "sparser field, fewer houses, more white background showing"}
  - {name: det, default: "random(0.002, 0.003)*1.8", tried: ["random(0.002, 0.003)*3.6"], change: large, effect: "higher-frequency size field; mottled mix of large and small houses, new pale zone mid-right"}
  - {name: maxShapeSize, default: 0.2, tried: [0.08], change: large, effect: "all houses small; fine uniform texture, the big red/orange blobs disappear"}
  - {name: zScale, default: 2.2, tried: [4.4], change: large, effect: "heavier overlap; canvas nearly fully covered, white background barely visible"}
  - {name: drawProb, default: 0.5, tried: [0.1], change: large, effect: "noticeably sparser with many gaps; same layout and colours"}
  - {name: colorBias, default: 0.2, tried: [1.0], change: moderate, effect: "linear lerp shows mid-blend colours (purple, cream, muted blues); geometry unchanged"}
reusable_candidates:
  - {name: noisePackedShapes, signature: "noisePackedShapes(w, h, candidates, sizeField, minDist) -> PVector[]", note: "Poisson-style rejection sampling with noise-modulated radii"}
  - {name: biasedPaletteLerp, signature: "biasedPaletteLerp(colors, v, bias) -> color", note: "index by v, lerp adjacent palette entries with pow(v%1, bias) toward the second color"}
---

## What it draws
A full-bleed 960x960 field of small "house" shapes (a square with a pointed roof, i.e. 5-vertex pentagons) in flat colours with no outlines. Houses pack densely in most of the canvas in red, orange, saturated blue and pale blue, overlapping slightly; the upper-right area is much sparser, filled with tiny yellow and blue specks. The white background shows through the gaps everywhere.

## How the code works
- `settings()` (hogar.pde:14-19) creates a 960x960 P2D window; `setup()` (21-29) calls `generate()` once; `draw()` (31-32) is empty, so the piece is static (baseline frames 10/60 were dropped as identical).
- `generate()` (54-118) seeds random/noise from `seed`, clears to white (60), and builds two simplex-noise detail scales: `det = random(0.002, 0.003)*1.8` (62) and `det2 = ...*0.5` (63).
- Packing (68-86): 50000 random candidates. Each candidate gets a radius `s = width*map(noi*noi2, 0, 1, 0.002, 0.2)` (75), where `noi`/`noi2` are shaped simplex noise (pow 1.9/1.4, a `cos(noi*TAU*12)` banding and `abs()%1` on lines 71-73) — so the size field is noise-driven, with large houses in high-noise zones and tiny ones in low-noise zones (the sparse upper right). A candidate is kept only if it is not within `(s+o.z)*0.5` of any already-kept point (78-84): an O(n^2) Poisson-style rejection sample whose density follows the noise field.
- Shape (90-100): every kept point becomes a 5-vertex "house" polygon of radius `z*2.2` (94): four corners plus a roof apex at `(x, y-1.3z)` (99). The `triangulate` import is present but its only use (88) is commented out.
## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| candidates_20000 | `for (int i = 0; i < 50000; i++) {` -> `... i < 20000 ...` | large (mean 0.2263, 0.563) | sparser field, fewer houses, larger white gaps; big red/orange blobs in the lower half remain but are more isolated | variants/candidates_20000/frame_00001.png |
| detail_3.6 | `float det = random(0.002, 0.003)*1.8;` -> `*3.6;` | large (mean 0.318, 0.772) | finer, more mottled size field; large and small houses intermix in smaller patches, large pale-blue zone appears mid-right | variants/detail_3.6/frame_00001.png |
| maxsize_0.08 | `float s = width*map(noi*noi2, 0, 1, 0.002, 0.2);` -> `... 0.08);` | large (mean 0.3415, 0.804) | all houses small; fine, fairly uniform texture across the canvas, no large blobs (upper-right sparse zone still present) | variants/maxsize_0.08/frame_00001.png |
| zscale_4.4 | `p.z *= 2.2;` -> `p.z *= 4.4;` | large (mean 0.3462, 0.845) | houses overlap heavily; canvas almost fully covered, white background barely visible, large solid orange/red masses below | variants/zscale_4.4/frame_00001.png |
| drawprob_0.1 | `if (random(1) < 0.5) continue;` -> `< 0.1` | large (mean 0.1684, 0.441) | noticeably sparser, many gaps of white; same layout and colour distribution as baseline | variants/drawprob_0.1/frame_00001.png |
| colorbias_1.0 | `return lerpColor(c1, c2, pow(v%1, 0.2));` -> `pow(v%1, 1.0));` | moderate (mean 0.1137, 0.472) | mid-blend colours appear (purple, cream, muted blues); geometry and layout unchanged, saturated red/orange/blue reduced | variants/colorbias_1.0/frame_00001.png |

## Modularisation notes
The noise-modulated Poisson packing (lines 68-86) is the reusable core: a `candidates` count, a size field `s(x, y)` (here two simplex noises, pow-shaped), and a minimum-distance rule; it could be a library function returning the accepted points. The house outline (90-100) and the 0.5 draw-probability (105) are one-off art decisions, though both are trivially parameterizable. The size-indexed palette lerp with a `pow` bias (136-141) is a small reusable colour-ramp helper. A clean parameter object would be: `{w, h, seed, candidates=50000, det, det2, sizeRange=[0.002, 0.2], zScale=2.2, drawProb=0.5, palette=[#F20707, #FCCE4A, #B7D6E8, #342EE8], colorBias=0.2}`.
