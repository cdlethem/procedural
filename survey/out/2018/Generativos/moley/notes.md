---
sketch: 2018/Generativos/moley
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1464
animated: false
techniques: [polar, symmetry]
primitives: [shape]
palette:
  colors: ["#434E20", "#E8AF36", "#F56546", "#446E9A", "#F6EDDD"]
  selection: random-from-list
composition: radial
parameters:
  - {name: layers, default: 5, tried: [1], change: large, effect: "one clean ring of shards instead of five overlapping; background colour now visible"}
  - {name: div, default: "random(2,10)", tried: ["random(8,10)"], change: moderate, effect: "160-180 wedges per ring: finer, denser mesh of shards"}
  - {name: radiusFactor, default: 0.9, tried: [0.45], change: moderate, effect: "wedges fit inside the canvas: visible circular rosette rim instead of full-bleed streaks"}
  - {name: amp, default: "TWO_PI/cc*0.5", tried: ["TWO_PI/cc*1.5"], change: moderate, effect: "much of the canvas becomes a flat orange field with only sparse shard streaks"}
  - {name: seg, default: 20, tried: "random(20,40)", change: large, effect: "longer, varied scallop period: pinker overall tone, finer width rhythm"}
  - {name: palette, default: "olive/yellow/orange/blue/cream", tried: "teal/red/pink/amber/white", change: moderate, effect: "cream background, distinct red/blue/yellow stripes; rosette reads as striped fan"}
reusable_candidates:
  - {name: radialShardRings, signature: "radialShardRings(cx, cy, r, count, wobble, color1, color2)", note: "ring of center-anchored triangles whose half-angles oscillate sinusoidally with period seg"}
---

## What it draws
A full-bleed radial burst: dozens of layers of very thin wedge/shard triangles all anchored at a point
slightly off-centre and extending far past the canvas edges. The wedges overlap heavily, producing a
dense sunburst of orange (dominant, also the background) streaked with blue and yellow shards, with a
visible scalloped rhythm in the wedge widths.

## How the code works
`setup()` (m4-9) calls `generate()` once; `draw()` is empty, so the piece is static (frames 10/60
identical). `generate()` (m22-62):

- `randomSeed(seed)` (m23), then `background(rcol())` (m24) — background is one random pick from the
  5-colour palette (m73), which in the seed-42 baseline is the orange `#F56546`.
- 5 layers, `j = 0..4` (m26). Each layer picks a centre `(cx,cy)` random within the middle 30–70 % of
  the canvas (m27-28), so the burst centre drifts slightly per layer.
- `div = int(random(2,10))` (m30) and `seg = int(random(20,20))` (m31). Note `random(20,20)` always
  returns 20, so `seg` is fixed at 20. `cc = div*seg` (m35) is the number of wedges in the ring
  (40–180).
- All wedges sit at radius `r = width*0.9` (m32) — much larger than the canvas, so every wedge is a
  long sliver poking out past the edges, which is why the image looks like overlapping streaks rather
  than a closed rosette.
- Per wedge `i` (m49-60): `aa = sin(map(i%seg,0,seg,0,PI))*ap` (m50) with `ap = random(0.1,0.9)` (m48).
  `i%seg` makes the wedge half-width oscillate with period 20 wedges (half-sine, always ≥ 0), giving
  the visible scalloped/periodic width rhythm. `a1,a2 = a+da*i ∓ amp*aa` (m51-52) are the two outer
  angles, `amp = TWO_PI/cc*0.5` (m38). The wedge is a closed triangle `(cx,cy)`, two points on the
  circle of radius `r` (m53-59).
- Colour: `c1 = rcol()`, `c2 = lerpColor(rcol(), rcol(), 0.2)` (m44-46) — `c2` is pulled 80 % back
  toward `c1`, so each wedge is nearly single-colour with a faint tint toward the outer vertices.
  Per-vertex `fill(c1)` / `fill(c2)` (m54, m56) under P2D.
- `rcol()` (m74-76) picks a random palette entry; the palette (m73) is olive `#434E20`, yellow
  `#E8AF36`, orange `#F56546`, blue `#446E9A`, cream `#F6EDDD`. Two commented-out alternative
  palettes exist (m71-72).
- No noise, no blend modes; overlap of many translucent-looking layers is just z-order overpainting.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| layers_1 | `for (int j = 0; j < 5; j++) {` -> `for (int j = 0; j < 1; j++) {` | large | one clean radial ring of yellow/orange shards on the blue background; no layer overlap, single off-centre hub | variants/layers_1/frame_00001.png |
| div_8_10 | `int div = int(random(2, 10));` -> `int div = int(random(8, 10));` | moderate | denser, finer shard mesh (up to 180 wedges per ring); same overall burst, busier texture | variants/div_8_10/frame_00001.png |
| r_0.45 | `float r = width*0.9;` -> `float r = width*0.45;` | moderate | wedge tips now end inside the canvas: visible circular rosette boundary on blue, shard ends clearly readable | variants/r_0.45/frame_00001.png |
| amp_1.5 | `float amp = TWO_PI/(cc)*0.5;` -> `float amp = TWO_PI/(cc)*1.5;` | moderate | mostly flat orange field with sparse yellow/orange streaks; larger wobble collapses many wedges to near-zero width | variants/amp_1.5/frame_00001.png |
| seg_40 | `int seg = int(random(20, 20));` -> `int seg = int(random(20, 40));` | large | varied scallop period (20-40 wedges): pinker overall tone, finer width rhythm, busier mesh | variants/seg_40/frame_00001.png |
| palette_0aa899 | `int colors[] = {#434E20, ...};` -> `int colors[] = {#0AA899, #F0594F, #F48482, #FDBC3C, #FFFFFF};` | moderate | cream/white background with distinct red, blue and yellow stripes; reads as a striped radial fan | variants/palette_0aa899/frame_00001.png |

## Modularisation notes
The generic core is `radialShardRings(cx, cy, r, count, wobbleAmp, wobblePeriod, wobblePhase, c1, c2)`:
draw `count` center-anchored triangles at radius `r` whose outer half-angles follow a half-sine
oscillation of `wobbleAmp` with period `wobblePeriod`. One-off art decisions: 5 overlapping layers with
independently jittered centres, `r = width*0.9` (deliberate over-bleed), the fixed 20-wedge scallop
period, and the 5-colour flat palette with the 0.2-lerp c1→c2 trick. A clean parameter object would be:
`{layers, centerJitter, radiusFactor, wedgesPerRing(div, seg), wobble(ap, amp), palette, lerpMix}`.
`div*seg` as wedge count is redundant — a single `count` plus a `period` would cover it.
