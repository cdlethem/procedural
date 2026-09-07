---
sketch: 2019/generativos/crb
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 27432
animated: false
techniques: [image-source, noise-field, dots-stippling, packing]
primitives: [line]
palette:
  colors: ["#000000", "#FAF9F7"]
  selection: fixed
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: poissonScatter, signature: "poissonScatter(w, h, attempts, sizeFn, minDistFn) -> PVector[]", note: "rejection-sampled scatter where per-point size comes from noise and image brightness"}
  - {name: brightnessStops, signature: "brightnessStops(x, y, img, count, angle, angleJitter) -> n/a (draws lines)", note: "walk along an angle until brightness stops changing; draw a short line across the axis at the stop"}
---

## What it draws
A full-bleed, near-grayscale stippled portrait of a bearded man with glasses
(the source photo `quique.jpg`). The face is built from dense clusters of tiny
short black strokes on an off-white ground; dark hair and background are packed
with smaller, denser dashes, while the pale shirt and highlights dissolve into
sparse, larger gaps. The overall texture reads as a fuzzy, noise-modulated
halftone.

## How the code works
`settings()` loads `quique.jpg` and sizes the canvas to the image (scale 1) in
P2D (L16-23). `generate()` (L47) reseeds, paints the `#faf9f7` background,
then does a Poisson-disk-style scatter: 1,400,000 random candidate positions
(L56-77), each accepted only if it is `(s+o.z)*0.5` away from every already
accepted point (L68-74, O(n·m) rejection loop — this is what makes the first
frame take ~27 s). Point size `s` is `pow(noise(x*0.01, y*0.01), 2.2)*40+40`
(L59) so noise patches vary the dash size, then scaled by the source pixel
brightness: dark pixels get smaller dashes (0.07) and light ones larger
(0.12) (L62-65).

Each accepted point then draws up to three "spoke" line-groups at angles
`a`, `a±TAU/2/3`, where `a = noise(x*0.002, y*0.002)*TAU*2` (L93-122): a
smooth noise field orients the strokes. Spokes are gated by the source
brightness (L112, 116, 120: `bri < 250/240/230`) so the whitest regions get
fewer strokes. `lines()` (L125-159) draws `c = s/sep` parallel short lines
per point, each found by walking outward along its angle from the point until
the image brightness differs by ≤30 (L142-154) — i.e. each dash ends at an
edge in the photo — and offset perpendicularly (L155-157). Stroke is
`stroke(0, 140)`, black at ~55% alpha, so overlaps build up gray (L106).
`draw()` is empty; the whole image is one static render in `setup()`. The
`colors[]` palette and `rcol/getColor` (L171-189) are dead code — never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The scatter (L55-77) is generic: a rejection-sampled point set whose radius
is a function of position and an image — a candidate `poissonScatter(w, h,
attempts, radiusFn)` library primitive (needs a spatial hash to be usable at
these counts; the O(n·m) loop is one-off). `lines()` (L125-159) is a
one-off art decision (walk-to-brightness-stop + perpendicular fanning) but its
input signature (x, y, size, count, angle) is already clean. A parameter
object would be: `{image, attempts, noiseScale (detSca), sizeRange
[0.07, 0.12], angleScale (0.002), alpha (140), spokeCount (3), sepGain (4.5),
lineScale (1.8), brightnessGates [250, 240, 230]}`.
