---
sketch: 2015/Generativos/bolasPeludas
year: 2015
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 654
animated: false
techniques: [packing, polar, particles, lines-hatching]
primitives: [line]
palette:
  colors: ["#F0F0F0", "#000000"]
  selection: fixed
composition: scattered
parameters:
  - {name: nCandidates, default: 300, tried: [150], change: subtle, effect: "fewer balls kept, sparser layout"}
  - {name: hairCountMax, default: 40000, tried: [10000], change: moderate, effect: "1/4 the hairs -> balls clearly lighter, sparse spiky fringe"}
  - {name: hairLenScale, default: 120, tried: [40], change: subtle, effect: "shorter hairs -> slightly lighter, tighter fringe"}
  - {name: bgScratchN, default: 300000, tried: [100000], change: moderate, effect: "scratch field ~3x sparser; ball halos stand out more"}
  - {name: strokeAlpha, default: 30, tried: [100], change: moderate, effect: "hair strokes saturate -> balls much darker"}
reusable_candidates:
  - {name: poissonDisks, signature: "poissonDisks(n, margin, radiusFn, minDistFn) -> PVector[]", note: "rejection sampling of random points with a per-point exclusion radius (size-aware packing)"}
  - {name: hairyBall, signature: "hairyBall(x, y, radius, hairCount, hairLenMax, strokeAlpha) -> void", note: "dense fan of short random line segments around a centre; alpha accumulation gives a dark core and fuzzy rim"}
  - {name: edgeDenserScratch, signature: "scratchField(n, lenMin, lenMax, acceptFn, keepOutFn) -> void", note: "random short line segments with a position-dependent acceptance probability (denser at the edges) and keep-out circles"}
---

## What it draws
On a light-gray (240) ground, roughly three dozen fuzzy black "hairy balls" of very different sizes are scattered across the canvas, each with a dark dense core, a lighter middle, and a soft spiky fringe, surrounded by a thin white halo ring. A few of the balls are so small they read as solid black dots. The empty space between the balls is filled with a fine scratchy web of short random line segments that is visibly denser towards the edges and corners of the image.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static (bolasPeludas.pde#1-7). Everything is black `stroke(0, 30)` — thin, low-alpha lines whose visual weight comes purely from overplotting.

1. **Packing of ball centres** (lines 15-33): `background(240)`, then 300 candidate points are drawn uniformly in the central 80% of the canvas (`random(0.1, 0.9)` per axis, line 19-20). Each carries a size `z = random(0.4)*random(1)` (line 21) — a product of two uniforms, so heavily biased toward small balls. A candidate is kept only if its distance to every already-kept point exceeds `width*(a.z+p.z)*1.1` (line 26), i.e. a size-aware Poisson-disk-style exclusion: balls never overlap and big balls push small ones away.
2. **The hairs** (lines 34-50): for each kept point, `cc = PI * map(z, 0..0.4, 0..40000)` line segments are drawn (line 40) — up to ~125k for a full-size ball. Each hair starts at a radius `r = width*(z - random(z)*random(0.1,1))` from the centre (line 42, biased toward the rim), at a random angle `a` plus a `±0.3` rad jitter (lines 43-46), with length `l = random(z*120) * sin(map(r, 0..width*0.4, 0.1..1)*PI/2)` (line 47) — longest mid-radius, tapering at centre and rim, up to `z*120` px. Thousands of 30/255-alpha strokes overlap into the dark core; the sparsely overplotted rim is the fuzzy fringe. Balls with tiny `z` get very few, very short hairs and collapse into the solid black dots seen in the image.
3. **Scratchy background field** (lines 52-69): 300,000 random candidate points; each is skipped with probability `random(1 - d/(diag*0.5)) > 0.1` (line 57), so the acceptance probability grows linearly with distance from the centre — that is why the scratch texture is densest at the edges/corners and nearly absent behind the middle of the composition. Accepted scratches are short random lines of length 4-8 px (line 58) and are rejected if either end falls within `width*p.z*1.1 + 2` of any ball centre (line 63), which carves out the white halo rings around every ball.

No noise, no palette beyond black-on-gray, no transforms or blend modes; the whole look is accumulated alpha from `line()`. All three phases share one sequential random stream, so changing how many hairs are drawn also shifts the background's scratch realisation (visible but statistically similar in the hairCount variant).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| balls_150 | `for (int i = 0; i < 300; i++) {` -> `i < 150` | subtle | ~20 balls instead of ~35; sparser layout with larger clean spaces; each ball's style is unchanged | variants/balls_150/frame_00001.png |
| hairCount_10000 | `map(mr, 0, 0.4, 0, 40000)` -> `map(mr, 0, 0.4, 0, 10000)` | moderate | balls clearly lighter and looser (grey mean, 0=black: core 186->225, mid-ring 173->220); fringe sparse with white gaps between individual spikes; ball positions unchanged | variants/hairCount_10000/frame_00001.png |
| hairLen_40 | `random(mr*120)` -> `random(mr*40)` | subtle | balls slightly lighter (core 186->210); fringe shorter and tighter; overall silhouette similar | variants/hairLen_40/frame_00001.png |
| bgLines_100000 | `for (int i = 0; i < 300000; i++) {` -> `i < 100000` | moderate | background scratch field ~3x sparser (corner mean 165->212); large clean white spaces remain; ball halos stand out more; balls pixel-identical to baseline | variants/bgLines_100000/frame_00001.png |
| alpha_100 | first `stroke(0, 30);` (line 34) -> `stroke(0, 100);` | moderate | balls much darker (core 186->107, mid-ring 173->85, near-saturated dark annulus); background pixel-identical in clean regions (second stroke at line 52 not substituted) | variants/alpha_100/frame_00001.png |

## Modularisation notes
- **Generic**: the size-aware rejection packing (phase 1) is a parameterisable Poisson-disk variant usable for any scattered-blob composition; `hairyBall` (phase 2) is a self-contained "fuzzy disc" primitive parameterised by radius, hair count, hair-length curve and stroke alpha; the acceptance-probability scratch field (phase 3) is a generic texture layer whose `acceptFn` (edge-denser) and `keepOutFn` (halos) are the only sketch-specific parts.
- **One-off art decisions**: the `random(0.4)*random(1)` size distribution (chooses the dot-to-huge-ball range), the exact `*1.1` exclusion factor and `+2` halo margin, the `sin` length falloff, and the 30/255 alpha chosen so that overplotting, not colour, creates the greyscale.
- **Clean parameter object**: `{nCandidates, margin, sizeMax, sizeDist, exclusionFactor, hairCountScale, hairLenScale, lenFalloff, scratchN, scratchLenRange, edgeRamp, haloMargin, strokeAlpha}`.
