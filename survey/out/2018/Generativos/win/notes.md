---
sketch: 2018/Generativos/win
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1888
animated: false
techniques: [packing, noise-field]
primitives: [shape]
palette:
  colors: ["#40CECF", "#C8C8C0", "#EFA5A3", "#EF5B48"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: maxSizeFactor, default: 0.3, tried: [0.6], change: moderate, effect: "larger max blob size; fewer blobs kept, sparser field with bigger clear regions"}
  - {name: minDistFactor, default: 0.48, tried: [0.2], change: large, effect: "blobs may sit much closer; field becomes near-fully covered, blobs overlap"}
  - {name: attempts, default: 200000, tried: [20000], change: subtle, effect: "sparser scatter, fewer small specks; large blobs largely unchanged"}
  - {name: shadowStrength, default: 0.05, tried: [0.3], change: none, effect: "no visible change per diff; offset shadow slab reads marginally darker, below diff threshold"}
  - {name: noiseDetail, default: 100, tried: [10], change: subtle, effect: "subtle: blob edges marginally more regular/less wobbled; layout identical"}
  - {name: overlayAlpha, default: 80, tried: [200], change: subtle, effect: "subtle: diagonal two-tone overlay halves read more saturated (stronger reds/greens/blues)"}
reusable_candidates:
  - {name: poissonScatter, signature: "poissonScatter(width, height, attempts, maxSize, minDistFactor) -> PVector[]", note: "rejection-sampled random points that keep mutual distance > (a.z+b.z)*factor"}
  - {name: noisePoly, signature: "noisePoly(x, y, s, cc, det, col, alp1, alp2)", note: "closed cc-vertex shape whose vertex radius is modulated by 2-D noise (0.2 + noise*0.8); per-vertex alpha split in the coloured overload"}
---

## What it draws
A full-bleed scatter of small, rotated, squarish blobs over a dusty-pink field. Blob
sizes range from tiny specks to large (up to ~30% of the canvas width); most are
teal/cyan, some shift toward green or blue, and a few larger ones show a diagonal
two-tone split (e.g. cyan over blue). Each blob carries a faint lighter-pink shadow
offset a few pixels to one side. The field is dense in the middle and sparser where
large blobs claim space.

## How the code works
`setup()` (win.pde:3-9) sizes the canvas 960x960 P2D and calls `generate()` once;
background `back` and a different main colour `colo` from a 4-colour list
(109-113: teal, grey, pink, red-orange; here background = pink, main = teal), and a
shadow colour `shaw` = background lerped 5% toward black (24).

Point placement (30-43): 200000 attempts at random positions with radius
`s = width*random(0.3)*random(1)` — the product of two uniform randoms skews sizes
toward small. A point is kept only if its distance to every kept point exceeds
`(o.z+s)*0.48` (37), i.e. a pairwise-rejection packing that keeps blobs separated;
big blobs naturally carve out sparse regions.

Drawing (45-63): per kept point, a random rotation, then three stacked `noisePoly`
layers: a shadow copy at an offset of `dd = s*0.1` (50-52) in `shaw`, the main blob
in `colo`, and a third copy (61) filled with a random 2-bit RGB colour (65-70: one of
8 pure RGB colours) where the first half of vertices get alpha 80 and the rest alpha
0 — the per-vertex fill produces the diagonal two-tone split visible on some blobs.

`noisePoly` (72-102): `cc=4` vertices around the unit circle; each vertex radius is
`(0.2 + noise(des + p*det)*0.8) * r` (81) with `det = random(100)` per blob (56), so
each blob is a unique 4-lobed noise-wobbled quad.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| maxsize_0.6 | `float s = width*random(0.3)*random(1);` -> `...random(0.6)*random(1);` | moderate | fewer, larger blobs; sparser field, big clear regions | variants/maxsize_0.6/frame_00001.png |
| spacing_0.2 | `if (dist(x, y, o.x, o.y) < (o.z+s)*0.48) {` -> `... *0.2) {` | large | near-complete coverage, heavy overlap, pink only in gaps | variants/spacing_0.2/frame_00001.png |
| attempts_20000 | `for (int i = 0; i < 200000; i++) {` -> `... i < 20000 ...` | subtle | sparser scatter, fewer small specks | variants/attempts_20000/frame_00001.png |
| shadow_0.3 | `color shaw = lerpColor(back, color(0), 0.05);` -> `... 0.3);` | none | no visible change; shadow slab marginally darker | variants/shadow_0.3/frame_00001.png |
| noise_10 | `float det = random(100);` -> `float det = random(10);` | subtle | blob edges marginally more regular | variants/noise_10/frame_00001.png |
| overlayalpha_200 | `noisePoly(0, 0, s, 4, det, rgb(), 80, 0);` -> `... 200, 0);` | subtle | two-tone overlay halves more saturated | variants/overlayalpha_200/frame_00001.png |

## Modularisation notes
- **Generic:** `poissonScatter` (rejection-sampled mutual-distance packing with
  per-point radius) is reusable for any "scattered but non-overlapping" composition;
  `noisePoly` (noise-modulated-radius closed shape with optional per-vertex alpha
  split) is a reusable primitive for organic quads/blobs.
- **One-off art decisions:** the 4-colour list, the 5% shadow lerp, the 2-bit RGB
  overlay colour, the `0.48` min-distance factor, size distribution
  (`width*random(0.3)*random(1)`), and the two-layer (shadow + main + tint) stack
  order.
- **Parameter object:** `{width, height, attempts, maxSizeFactor, sizeSkew
  (product of N randoms), minDistFactor, vertexCount, noiseDetail, noiseScale,
  palette, shadowStrength, shadowOffset, overlayAlpha}`.
