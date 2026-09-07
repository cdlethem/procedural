---
sketch: 2020/generative/01_04/machitas
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1819
animated: false
techniques: [noise-field, distortion]
primitives: [image]
palette:
  colors: ["#6402F7", "#F7A4EF", "#F62C64", "#00DACA", "#FFFFFF"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: count, default: 2000, tried: [6000], change: large, effect: "denser, busier coverage; gaps fill in, strokes read finer"}
  - {name: detAng, default: "random(0.0001)", tried: ["random(0.001)"], change: moderate, effect: "coarser angle noise: strokes thinner, direction varies more locally, less smooth diagonal flow, more black showing"}
  - {name: detCol, default: "random(0.001)", tried: ["random(0.005)"], change: moderate, effect: "colour noise at coarser scale: hues form larger distinct patches instead of a smooth drift"}
  - {name: scale, default: 16, tried: [6], change: large, effect: "smaller stamps: strokes overlap more into a pale, soft, near-uniform lavender field"}
  - {name: angleGain, default: "TAU*10", tried: ["TAU*30"], change: moderate, effect: "rotation wraps many more times: aligned fur flow breaks up into a dark, sparse, multi-directional streaky texture"}
  - {name: palette, default: "purple/lilac/rose/teal", tried: ["blue/red/rose/cream"], change: moderate, effect: "same flow, warm blue-rose-cream tones replacing the purple-teal scheme"}
reusable_candidates:
  - {name: noiseBrushScatter, signature: "noiseBrushScatter(brushes, count, detAng, detCol, angleGain, scaleGain) -> void", note: "scatter tinted brush stamps whose rotation and colour come from 2-D simplex noise"}
  - {name: paletteRamp, signature: "paletteRamp(colors, v) -> color", note: "wrap v around a palette and lerp between adjacent entries with a pow curve"}
---

## What it draws
A full-bleed dark canvas densely covered with thousands of thin hair-like brush
strokes in purple, pale lilac, white-grey and a little teal. The strokes align
into broad diagonal flows running from upper-left to lower-right, with the
colour drifting smoothly between the palette hues so the whole field looks like
fur or wind-blown grass. No hard edges, no background visible in the centre.

## How the code works
`setup()` loads 4 brush PNGs (`machitas.pde:25-28`) and calls `generate()` once;
`draw()` is inert, so the piece is static (`machitas.pde:38-40`).

`generate()` (`machitas.pde:51-90`) does `background(0)` then a single loop of
2000 iterations (line 69). Per iteration:
- Position `xx,yy` is uniform random over the canvas (lines 70-71).
- Size: `ww = random(4,12)`, `hh = ww*random(0.1,0.3)` — long thin slivers
  (lines 72-74).
- Colour: 2-D simplex noise sampled at `detCol ≈ 0.001` scale (line 61) drives a
  wrap-around lerp between adjacent palette entries via `getColor(float)`
  (lines 122-127, palette line 107), then the colour is lerped toward white by
  `random(0.5,1)` (line 78) and the brush is `tint`ed with that colour at a
  random alpha (line 80).
- Rotation: noise at `detAng ≈ 0.0001` scale times `TAU*10` plus
  `brightness*8` (line 83) — this is what aligns the strokes into smooth
  directional flows.
- Scale: `(2+brightness+random(2))*16` (lines 85-86), so brighter strokes are
  larger.
- The brush is drawn with `image()` at the rotated, scaled position
  (lines 81-88).

Randomness enters only via `randomSeed(seed)`/`noiseSeed(seed)` (lines 53-54);
the harness overrides the `seed` field, so renders are deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_6000 | `for(int i = 0; i < 2000; i++){` -> `for(int i = 0; i < 6000; i++){` | large | denser, busier field; gaps fill, individual strokes read finer | variants/count_6000/frame_00001.png |
| detAng_0.001 | `float detAng = random(0.0001);` -> `random(0.001);` | moderate | strokes thinner and more comb-like; local direction varies more, less smooth diagonal flow, more black visible | variants/detAng_0.001/frame_00001.png |
| detCol_0.005 | `float detCol = random(0.001);` -> `random(0.005);` | moderate | hues group into larger distinct patches (purple/pink/teal zones) instead of a smooth drift | variants/detCol_0.005/frame_00001.png |
| scale_6 | `sca *= 16;` -> `sca *= 6;` | large | much smaller stamps; they overlap into a pale, soft, near-uniform lavender field with a faint diagonal flow | variants/scale_6/frame_00001.png |
| angleGain_30 | `*TAU*10+brig*8` -> `*TAU*30+brig*8` | moderate | rotation wraps many times; aligned fur breaks into a dark, sparse, multi-directional streaky texture | variants/angleGain_30/frame_00001.png |
| palette_warm | `int colors[] = {#6402F7, #F7A4EF, #F62C64, #00DACA};` -> `{#354998, #D0302B, #F76684, #FCFAEF};` | moderate | same diagonal flow, recoloured to blue, red-rose and cream | variants/palette_warm/frame_00001.png |

## Modularisation notes
Generic and reusable:
- `getColor(float v)` (lines 122-127): palette wrap + pow-curve lerp; depends
  only on a `colors[]` array — a clean `paletteRamp` library function.
- The noise-driven stamp loop (lines 69-89): a `noiseBrushScatter` taking a
  brush set, count, two noise detail scales, an angle gain and a scale gain.

One-off art decisions:
- The specific 4-colour palette (line 107) and the many commented-out
  alternates; the white-lerp amount (line 78); the `brig*8` rotation offset
  (line 83); the exact brush PNGs.

A clean parameter object: `{count, brushSet, detAng, detCol, angleGain,
scaleGain, whiteLerpRange, palette}`.
