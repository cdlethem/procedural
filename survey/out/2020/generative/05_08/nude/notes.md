---
sketch: 2020/generative/05_08/nude
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1731
animated: false
techniques: [curves, symmetry]
primitives: [ellipse, shape]
palette:
  colors: ["#FFFFFF", "#000000", "#E86710", "#4131FF", "#657451"]
  selection: random-from-list
composition: centered
parameters:
  - {name: cc, default: "random(1000, 4000)", tried: [1500], change: moderate, effect: "fewer crowd figures; bottom half visibly sparser, same distribution and colour mix"}
  - {name: "red stroke alpha", default: 180, tried: [255], change: none, effect: "no visible change; the fan is dense enough that full opacity reads the same as 180/255"}
  - {name: "funnel curve count", default: 30, tried: [60], change: subtle, effect: "red fan is denser and more finely divided, slightly less smooth"}
  - {name: "ring max size", default: 1.6, tried: [1.0], change: moderate, effect: "concentric ellipses stop at a smaller radius; outer half of canvas loses its rings"}
  - {name: "crowd figure size", default: 18, tried: [30], change: moderate, effect: "crowd figures ~1.7x bigger; bottom half reads as a thicker, more saturated mass"}
  - {name: "ring count", default: 30, tried: [8], change: moderate, effect: "only 8 small ellipses remain, clustered near the disc; the full-canvas ripple is gone"}
reusable_candidates:
  - {name: person, signature: "person(x, y, s, col)", note: "stylised figure: head, torso, two thin legs, white face dot, all scaled by s"}
  - {name: concentricRings, signature: "concentricRings(cx, cy, n, sizeRange, weightFn)", note: "30 ellipses at growing size/weight around a point"}
---

## What it draws

White background. A large black disc sits at top-centre with a tiny white dot near its middle; thin black concentric ellipses radiate outwards from it across the whole canvas. A fan of translucent red curves flows from the disc down to the bottom edge, thinning at the top and thickening at the bottom. Three chunky figures — orange, blue, olive — stand in the middle with long thin black legs, and the bottom third is packed with a dense crowd of tiny multicoloured figures, growing denser and larger toward the bottom edge.

## How the code works
`setup()` calls `generate()` once; `draw()` also calls it but the output is static (frames 1/10/60 identical). All randomness is seeded via `randomSeed(seed)`/`noiseSeed(seed)` (nude.pde:47-48), so the image is deterministic.

- White background (line 50).
- Red funnel: `stroke(255, 0, 0, 180)` semi-transparent, 30 `beginShape`/`curveVertex` curves (lines 60-76). Each curve runs from a top x interpolated over [0.38, 0.62]·width down to a bottom x interpolated over [0, 1]·width, so the fan spreads from the disc to the full bottom edge. `strokeWeight(pow((1-sin(v*PI)), 0.6)*5)` makes end curves thickest.
- Crowd: `cc = int(random(1000, 4000))` figures (line 81). Y position `height*lerp(0.5, 1, pow(i/cc, 0.4))` biases the crowd toward the bottom; x is uniform random; size `s = 18*(0.2+vy)` grows toward the bottom. Colour is `cols[int(random(3))]` from {#E86710, #4131FF, #657451} (orange, blue, olive).
- Concentric rings: 30 ellipses centred at (0.5w, 0.25h) with size `width*lerp(0.2, 1.6, pow(v, 2))` and weight `0.5 + pow(v, 1.4)*3` (lines 94-101) — fast quadratic growth gives the dense inner ring spacing.
- The black disc: `ss = width*0.24` ellipse at (0.5w, 0.25h) with a tiny white dot (lines 103-107).
- Three hero figures: `person()` at x = 0.35/0.5/0.65·width, sizes ≈ 0.29-0.32·height, colours orange/blue/olive (lines 109-111).
- `colors[]`/`rcol()`/`getColor()` (lines 141-156) are unused by `generate()` — dead code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_1500 | `  int cc = int(random(1000, 4000));` -> `  int cc = 1500;` | moderate | crowd visibly sparser in the bottom half; same layout, colours, and bottom bias | variants/cc_1500/frame_00001.png |
| alpha_255 | `  stroke(255, 0, 0, 180);` -> `  stroke(255, 0, 0, 255);` | none | no visible change; the 30-curve fan is dense enough that full opacity looks the same | variants/alpha_255/frame_00001.png |
| funnelCurves_60 | loop `i < 30` and `v = i*(1./(30-1))` -> 60 (both lines) | subtle | red fan denser and more finely divided; slightly less smooth | variants/funnelCurves_60/frame_00001.png |
| ringSize_1.0 | `float s = width*lerp(0.2, 1.6, pow(v, 2));` -> `... lerp(0.2, 1.0, ...)` | moderate | rings stop at a smaller radius; the outer half of the canvas loses all rings | variants/ringSize_1.0/frame_00001.png |
| crowdSize_30 | `float s = 18*(0.2+vy);` -> `float s = 30*(0.2+vy);` | moderate | crowd figures ~1.7x larger; bottom half reads as a thicker, more saturated mass | variants/crowdSize_30/frame_00001.png |
| rings_8 | ring loop `i < 30` -> `i < 8` | moderate | only 8 small ellipses remain, clustered near the disc; the full-canvas ripple is gone | variants/rings_8/frame_00001.png |

## Modularisation notes
- `person(x, y, s, col)` is a clean, fully parameterised figure generator — direct library candidate.
- The concentric-ring loop (size/weight as pow functions of i) and the red curve fan (two lerped endpoints + curveVertex) are both generic "radial fan" primitives; only the endpoint ranges and exponents are art decisions.
- The crowd is a scatter with a vertical bias function (`lerp(0.5, 1, pow(t, 0.4))`) and size gradient — a generic "crowd scatter" with parameters: count, size base, bias exponent, size gradient, colour list.
- A clean parameter object: {disc: {cx, cy, size, dotSize}, rings: {n, sizeRange, weightPow}, funnel: {n, topSpan, alpha, weight}, crowd: {count, yBiasPow, sizeBase, colors}, heroes: [{x, y, s, color}]}.
