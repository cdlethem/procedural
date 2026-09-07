---
sketch: 2018/Generativos/mantel
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 22521
animated: false
techniques: [flow-field, packing, dots-stippling, noise-field, curves]
primitives: [shape, ellipse, arc]
palette:
  colors: ["#D81D03", "#101A9D", "#1C7E4E", "#F6A402", "#EFD4BF", "#E2E0EF", "#050400"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: flowRibbon, signature: "flowRibbon(x, y, steps, det, offset, step) -> PVector[]", note: "advect a point 1px/step through a 2-D noise field, return the polyline"}
  - {name: packCircles, signature: "packCircles(attempts, minR, maxR, falloff) -> PVector[]", note: "rejection-sample non-overlapping circles with a radial size falloff"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, shd1, shd2)", note: "two-radius striped ring (candy-stripe shading) built from quads"}
  - {name: stippleDisk, signature: "stippleDisk(x, y, r, count, sizeRange) -> PVector[]", note: "collision-check dots inside a disk, each a black half-arc + coloured dot"}
---

## What it draws
A full-bleed, densely busy composition on a pale lavender-white ground. Long thin wavy ribbons in red, blue, green, yellow and black weave diagonally across the whole canvas. Scattered over this ribbon field are dozens of flat coloured "spheres" (disks) of varying sizes in the same palette; each disk is ringed by thin candy-stripe bands and is densely sprinkled with tiny coloured dots and small black arcs, giving a beaded, stippled texture. A few large near-black disks punctuate the field.

## How the code works
`setup` (L3-12) sizes a 3250x3250 P2D canvas, sets `strokeWeight(3)`, then calls `generate()` once; `draw()` is empty so the sketch is static (single frame).

- L26-27: background is a random palette colour (`rcol()`).
- L34-48 — flow-field ribbons: 3000 iterations. Each ribbon starts at a random point and, over ~338 steps (`width/9.6`, L40), advances 1px in the direction `noise(des + x*det, des + y*det) * TWO_PI` (L42), plotting a vertex per step and closing the shape (L47). Stroke and fill are random palette colours with alpha (L35-36). These are the long wavy ribbons.
- L51-72 — disk packing (rejection sampling): 80000 random candidates. A candidate circle of size `s` (L58-59, scaled by a radial factor `dis` that makes centre disks larger, times a noise term) is kept only if it does not overlap an already-kept point (L63-69). Produces the scattered non-overlapping disks.
- L74-93 — first pass over kept points: a soft, slightly darkened, wavy-edged blob (alpha 80, edge modulated at L87) plus a faint candy-stripe ring via `arc2` (L93).
- L98-105 — second pass: the solid palette-coloured disk (`ellipse`, L102) plus black and white candy-stripe rings (L103-105).
- L110-137 — per-disk stipple: pack up to 800 tiny dots inside radius `r*0.6` using the same rejection test (L119-126); each dot is drawn as a black upper-half `arc` (L131-132) plus a small coloured `ellipse` (L134-135). This is the beaded stippled fill.

Colour always comes from the 7-colour palette via `rcol()` (L193-196). Randomness enters through the seed (L1), the noise field offset/detail (`des`/`det`, L31-32), and every `random()` call.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic (library candidates):** (1) the flow-field walk (L41-46) is a reusable "advect a point through a 2-D noise field for N steps -> polyline". (2) The rejection-sampling circle packing (L53-71) is a reusable non-overlapping-circle packing routine. (3) `arc2` (L168-186) is a reusable two-radius striped-ring primitive; `noiseCircle` (L141-166) a noise-distorted ring. (4) The in-disk dot stipple (L112-136) is a reusable "stipple a disk with collision-checked dots".
- **One-off art decisions:** the specific 7-colour palette; the radial size falloff (L55-57); the candy-stripe ring styling and the black half-arc + coloured dot combo; the wavy blob edge modulation (L87).
- **Clean parameter object:** `{seed, canvas, ribbonCount, ribbonSteps, noiseDetail, noiseOffset, strokeWeight, strokeAlpha, fillAlpha, packAttempts, minSize, maxSize, sizeFalloff, dotCount, dotSizeRange, palette, background}`.
