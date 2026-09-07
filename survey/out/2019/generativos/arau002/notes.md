---
sketch: 2019/generativos/arau002
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 2811
animated: false
techniques: [noise-field, lines-hatching, dots-stippling, blend-modes]
primitives: [ellipse, line]
palette:
  colors: ["#F65DD9", "#F74432", "#F7B639", "#2B5B39", "#2D7AF1"]
  selection: noise-driven
composition: scattered
parameters:
  - {name: cc, default: 800, tried: [2500], change: large, effect: "denser forest: gaps filled, more overlap, bottom half crowded with large trees"}
  - {name: detCol, default: 0.18, tried: [0.55], change: moderate, effect: "coarser noise -> larger, smoother same-hue regions with broad diagonal colour bands"}
  - {name: pwrV, default: 3.8, tried: [1.5], change: large, effect: "flatter size/depth distribution: more mid-sized trees, less extreme perspective"}
  - {name: sScale, default: 0.26, tried: [0.13], change: large, effect: "half-size trees: sparser, thinner wireframe look, strokes more visible than dots"}
  - {name: dotScale, default: 0.004, tried: [0.02], change: moderate, effect: "larger glowing tips: foliage reads as bright bokeh beads, strokes less visible"}
  - {name: grain, default: 200000, tried: [5000], change: large, effect: "dark speckle underlay mostly gone: cleaner flat-black background between trees"}
reusable_candidates:
  - {name: getColor, signature: "getColor(v) -> color", note: "abs(v) mod palette length, lerp between adjacent entries by fractional part (pow 1.2)"}
  - {name: ara, signature: "ara(x, y, s, ic)", note: "one 'tree': tapered stem of drifting ellipses + fan of random-angle curve strokes with ADD-blended glow dots at the tips"}
  - {name: perspectiveForest, signature: "forest(count, sizePow, yRange, sizeRange, noiseDetail)", note: "scatter count figures, y and size coupled through pow(i/count, p) so top is far/small, bottom is near/large"}
---

## What it draws
A near-black field covered with a faint, dark grainy stipple. Scattered over it are
hundreds of small pine- or grass-like figures: each has a thin glowing vertical stem and a
fan of fine curved strokes tipped with bright dots. The figures are tiny and dense along the
top and grow much larger toward the bottom, like a forest in perspective. Colours are vivid
— magenta/pink, orange-red, yellow-orange, blue, purple and occasional dark green — and
neighbouring figures tend to share a similar hue.

## How the code works
`settings()` (13-18): P2D 960×960, `smooth(8)`. `generate()` (44-81), called once from
`setup()` (static output; `draw()` is empty).

1. `background(4)` (49) — near-black.
2. Grain loop (51-61): 200,000 tiny rotated ellipses, y biased to `random(0.04,1)*height`
   (line 53), size ~1-4 px (54), fill `lerpColor(getColor(), color(0), random(0.8))` with
   `stroke(0, 20)` (50, 55) — a very dark, faint stipple covering the whole canvas.
3. Tree loop (67-79): `cc = 800` figures. `v = pow(map(i,0,cc,0,1), 3.8)` (69) skews the
   distribution; `y = height*map(v,0,1,0.04,1.1)` (71) and
   `s = width*map(v,0,1,0.1,1)*0.26*random(0.6,1)` (72) couple y and size, so top of canvas
   = small/far, bottom = large/near. Colour index `ic = noise(desCol + x*detCol, desCol +
   y*detCol)*colors.length*2` (64-65, 73) — 2-D noise sampled at a fine detail (~0.0012-0.0018
   per pixel) so spatially adjacent trees get close palette indices.
4. `ara(x, y, s, ic)` (83-151) draws one figure:
   - stem (93-103): `s` small ellipses from just below (y+0.1s) up to y-s, width `s*0.04*v^1.1`
     (97, 99) with small random horizontal drift (`mov`, 101-102), alpha 230 (98) — a thin,
     slightly wavering bright line.
   - foliage (107-150): `s*den` iterations, `den = random(1.5,3)` (105). Each picks a random
     upward-biased direction (117-123), draws a `curve()` stroke (139-141) in the palette
     colour at alpha 20-40 (140), then an `ADD`-blended ellipse at the tip (144-148) —
     the bright glowing dots that dominate the look.
5. Colour (162, 166-178): 5-colour palette `#F65DD9, #F74432, #F7B639, #2B5B39, #2D7AF1`;
   `getColor(float)` wraps the index and lerps between adjacent entries, so figures blend
   smoothly between palette neighbours. Randomness enters via `random()`/`noise()` seeded
   from `seed` (46-47); `desCol` (64) is an unseeded-looking random offset that is actually
   produced after `randomSeed(seed)`, so the whole field is deterministic per seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_2500 | `int cc = 800;` -> `int cc = 2500;` | large | ~3x more trees; gaps filled, heavy overlap, crowded bottom | variants/cc_2500/frame_00001.png |
| detCol_0.55 | `float detCol = random(0.007, 0.01)*0.18;` -> `... *0.55;` | moderate | same layout; hues form larger smoother regions with broad diagonal colour bands | variants/detCol_0.55/frame_00001.png |
| pwrV_1.5 | `pow(map(i, 0, cc, 0, 1), 3.8)` -> `... , 1.5)` | large | size/depth spread flattens: more mid-sized trees mid-canvas, top less densely packed with tiny ones | variants/pwrV_1.5/frame_00001.png |
| sScale_0.13 | `*0.26*random(0.6, 1);` -> `*0.13*random(0.6, 1);` | large | all trees half size: sparser, thinner, wireframe-like; background shows through more | variants/sScale_0.13/frame_00001.png |
| dotScale_0.02 | `float ss = 0.8+s*0.004;` -> `float ss = 0.8+s*0.02;` | moderate | tips become large bright dots; foliage reads as bokeh beads, curve strokes fade into them | variants/dotScale_0.02/frame_00001.png |
| grain_5000 | `i < 200000` -> `i < 5000` | large | fine dark speckle underlay nearly gone; background between trees is cleaner flat black | variants/grain_5000/frame_00001.png |

## Modularisation notes
- Generic: `getColor(float)` (adjacent-lerp palette lookup) is a clean reusable palette
  helper; the stem+foliage `ara()` is a parameterised "glow tree/blade" primitive
  (s, colour index, den, pwrAmp, angle bias); the count/size/y coupling (69-72) is a
  reusable "perspective scatter" pattern.
- One-off art decisions: the 5-colour palette, the 3.8 size exponent, the 0.26 size scale,
  the 200,000-grain underlay, the exact angle/curve math in `ara`.
- Clean parameter object: `{count, sizePow, sizeScale, yMin, yMax, noiseDetail, palette,
  denRange, dotScale, grainCount, stemAlpha, dotAlpha}`.
