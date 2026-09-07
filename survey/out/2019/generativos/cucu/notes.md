---
sketch: 2019/generativos/cucu
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2927
animated: true
techniques: [noise-field, flow-field, particles, packing, dots-stippling, blend-modes]
primitives: [ellipse]
palette:
  colors: ["#F20707", "#FC9F35", "#C5B7E8", "#544EE8", "#000000"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: pointCount, default: 40000, tried: [20000], change: moderate, effect: "same style; halving candidates shifts which points the rejection pass keeps, so composition changes (sparser strands, bigger dark gaps)"}
  - {name: maxSize, default: 0.09, tried: [0.03], change: large, effect: "dashes become much thinner; image turns fine and hairy with more white from additive overlap"}
  - {name: rotxFreq, default: 5, tried: [1.5], change: moderate, effect: "smoother orientation field: strands form longer coherent arcs, overall flow more diagonal"}
  - {name: detCol, default: 0.1, tried: [1.0], change: moderate, effect: "coarser colour field: red/orange/indigo spread as larger smooth patches, same swirl geometry"}
  - {name: alpha, default: light, tried: [255], change: large, effect: "fully opaque dashes: brighter, more saturated image, overlaps blow out to white, reds more vivid"}
reusable_candidates:
  - {name: noisePackedPoints, signature: "noisePackedPoints(count, w, h, det1, det2, sizeMin, sizeMax) -> PVector[]", note: "random candidates whose size is modulated by two simplex-noise fields, kept only if farther than (s+o.z)*0.2 from all kept points"}
  - {name: swirlDash, signature: "swirlDash(x, y, size, detRot, detCol, detLig, palette) -> void", note: "one ADD-blended elongated ellipse per point: noise-driven rotation, cos-noise squash, noise-driven palette index and alpha"}
---

## What it draws
A black canvas filled with thousands of small elongated dashes (squashed ellipses)
aligned into swirling, fluid-like vortices, like water currents seen from above.
Dominant colours are deep indigo/blue, with large patches of red, bright white, and
orange/gold. Overlapping dashes glow brighter (additive blending). The centre of the
image is a darker whirlpool where the strands spiral tightly.

## How the code works
- `setup()` (cucu.pde L21-29) calls `generate()` once; `draw()` (L31-32) is empty, so
  the sketch is structurally static. (The harness' frame 10/60 differ from frame 1 —
  they come out mostly white with the same swirl structure in black — which looks like
  a re-run/render artifact of the P2D harness, not animation.)
- `generate()` (L54): `background(0)` (L61), `blendMode(ADD)` (L66) — everything is
  added onto black, which produces the glow where many dashes overlap.
- Point field (L68-87): 40000 random candidates; each gets a size from two simplex
  noise fields (`det1` L63, `det2` L64) shaped by `pow(...,1.9)`, `cos(noi*TAU*4)`,
  `abs(noi)%1` (L72-75), mapped to 0.2%-9% of the width (L76). A pairwise rejection
  loop (L79-85) drops a point if it lies within `(s+o.z)*0.2` of an already kept
  point (simple O(n^2) packing).
- `Triangulate.triangulate(points)` (L96) is computed but its result is never drawn —
  dead code; only the commented-out block (L119-146) would have used the points.
- Per-point drawing (L99-118): colour index = `sqrt(p.z)*0.3 + noise(x*detCol, y*detCol)*colors.length`
  (L101), resolved by `getColor` (L165-171) which lerps between two adjacent palette
  entries; alpha = `lerp(20, 200, noise(x*detLig, y*detLig))*0.8` (L103). The point is
  rotated by `noise(...)*TAU*5` (L107, L109); `rotateY` (L110) is a no-op in P2D
  (warning on stderr). The dash shape comes from `hh = p.z*cos(roty)` (L112): the
  cosine of the noise rotation squashes the ellipse, so orientation and elongation
  both follow the noise — that is what makes the strands look like a flow field.
  Two ellipses are drawn per point (L113-114) plus, with 10% probability, a third in a
  random palette colour (L115-116).
- Palette (L158): red `#F20707`, orange `#FC9F35`, lavender `#C5B7E8`, indigo
  `#544EE8`, black `#000000`. Randomness enters via `random(width/height)` for
  positions (L70-71), the per-point jitter `random(0.8, 1)` (L72, L75) and the 10%
  recolour (L115).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_20000 | `for (int i = 0; i < 40000; i++) {` -> `for (int i = 0; i < 20000; i++) {` | moderate (0.347 of pixels) | same look and colour regions as baseline; fewer candidates change which points survive the rejection pass, so the layout shifts: strands slightly sparser, a larger dark gap on the right | variants/count_20000/frame_00001.png |
| maxSize_0.03 | `float s = width*map(noi*noi2, 0, 1, 0.002, 0.09);` -> `... 0.03);` | large (0.508 of pixels) | dashes become much thinner; the image reads as fine hair-like strands instead of fat dashes, with more white where they additively overlap; same swirl structure and palette | variants/maxSize_0.03/frame_00001.png |
| rotxFreq_1.5 | `float rotx = noise(p.x*detRotX, p.y*detRotX)*TAU*5;` -> `...TAU*1.5;` | moderate (0.363 of pixels) | smoother orientation field: strands curve into longer, more coherent arcs and the overall flow runs more diagonally; palette distribution unchanged | variants/rotxFreq_1.5/frame_00001.png |
| detCol_1.0 | `float detCol = random(0.005, 0.01)*0.1;` -> `*1.0;` | moderate (0.38 of pixels) | colour field becomes coarser: indigo, gold and dark red spread as large smooth patches (blue top-left, gold top-right) instead of the baseline's interleaved colour zones; swirl geometry identical | variants/detCol_1.0/frame_00001.png |
| alpha_255 | `fill(col, light);` -> `fill(col, 255);` | large (0.602 of pixels) | dashes fully opaque: image is brighter and more saturated, overlaps blow out to white and the reds/oranges read more vivid; structure unchanged | variants/alpha_255/frame_00001.png |

## Modularisation notes
- `noisePackedPoints` (L68-87) is generic: noise-modulated point sizes + pairwise
  rejection is a reusable "organic packing" primitive; the cos/pow shaping of the
  noise (L72-75) is the sketch-specific art decision and could be an optional
  `shapeFn`.
- `swirlDash` (L99-118) is generic given a palette: one ADD-blended ellipse per
  point with noise-driven rotation, squash, colour and alpha. The `*TAU*5`
  frequency constants and the 10% random-colour sprinkle are art decisions.
- The `Triangulate` call (L96) and the commented-out pentagon block (L119-146) are
  dead/unused and should be dropped in a clean version.
- A clean parameter object: `{size, seed, pointCount, det1, det2, sizeMin, sizeMax,
  rejectFactor (0.2), detRotX, detRotY, detCol, detLig, alphaRange, palette}`.
