---
sketch: 2020/generative/01_04/fieldop
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1700
animated: false
techniques: [noise-field, distortion, grid]
primitives: [shape]
palette:
  colors: ["#000000", "#FFFFFF"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: sub, default: "random(60,140)*12", tried: ["random(60,140)*30"], change: large, effect: "strips ~3x thinner; whole field reads as fine hatching, same S-wave and void"}
  - {name: kkk, default: "random(0.0004,0.012)*0.4", tried: ["random(0.0004,0.012)*1.5"], change: large, effect: "higher twist frequency: multiple focal fans and concentric ripples instead of one S-wave"}
  - {name: twistGain, default: 12, tried: [4], change: large, effect: "weaker twist: single smooth S-curve, much straighter stripe bands"}
  - {name: coarseAmp, default: 120, tried: [240], change: large, effect: "double coarse warp: gentler/wider central wave, top and bottom bands compress into grey moire hatching"}
  - {name: step, default: 2, tried: [1], change: none, effect: "no visible change (2px sampling already below feature size)"}
reusable_candidates:
  - {name: noiseDisplace, signature: "noiseDisplace(x, y, twistFreq, twistGain, coarseFreq, coarseAmp, fineFreq, fineAmp, z) -> PVector", note: "simplex twist about y + two-octave Perlin offset of a point"}
  - {name: stripedField, signature: "stripedField(strips, width, step, displaceFn) -> void", note: "column quad strips with alternating fill, vertices warped by a displacement function"}
---

## What it draws
Full-bleed black-and-white op-art: a dense field of thin vertical black/white stripes,
alternating per column, bent by a smooth noise field into a large S-shaped wave. A
white void opens in the upper-left where the stripes bend away, the stripes converge
toward a vanishing point near the center, and they compress into very fine dense
hatching at the top and bottom edges.

## How the code works
- `settings()` (L14-19): 960x960 P3D window, `smooth(8)`, `pixelDensity(2)`
  (warned unavailable on the headless display). `generate()` runs once from
  `setup()`; `draw()` is empty, so the image is static.
- `generate()` (L44-84): seeds random/noise with `seed`; `noiseDetail(4)`; white
  background. Random field parameters: `detDes`/`detDes2` (Perlin frequency),
  `desDes` (noise offset), `kkk` (simplex frequency, `random(0.0004,0.012)*0.4`),
  `sub = random(60,140)*12` (720-1680 column strips), strip width
  `ss = width*1.4/sub`, camera z-offset `z = random(-200,200)`.
  black/white per strip; each strip is a `QUAD_STRIP` of vertices sampled along
  `j` from `-height/2-100` to `height/2+100` in steps of 2, at the strip's two
  x-edges. Every vertex is displaced by `def(x, y, z)`; the strip is drawn in 3D
  (translated to center, z=200), which is why the perspective converges the stripes.
- `def()` (L92-108) is the distortion: a 3D simplex noise value scaled to
  `c = 1+c*12` and a second simplex `s*0.1` build a rotation-like matrix
  `{c,-s,s,c}` applied in the x/z plane — a twist around the vertical axis that
  varies along the strip, producing the S-bend and the white void. Then two Perlin
  offsets: coarse (`detDes` frequency, amplitude 120, L102-103) and fine
  (`detDes2`, amplitude 30, L105-106) warp each point further.
- Colour: only the alternating 0/255 fill is used. The `colors[]` palette
  (L118, #F4EFA1 #E8E165 #DC4827 #5779A2 #031A01) and `rcol()`/`getColor()`
  (L122-134) are defined but never called in the draw path.
- Randomness enters only via the seed (L46-47); with a fixed seed the image is
  deterministic (confirmed in baseline result.json).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_30 | `int sub = int(random(60, 140))*12;` -> `... *30;` | large (0.296, 54%) | stripes ~3x thinner, field reads as fine hatching; S-wave and white void unchanged | variants/sub_30/frame_00001.png |
| kkk_1.5 | `kkk = random(0.0004, 0.012)*0.4;` -> `... *1.5;` | large (0.434, 80%) | completely different structure: several focal fans (starburst top-centre, concentric ripples bottom-centre) instead of one S-wave | variants/kkk_1.5/frame_00001.png |
| twist_4 | `c = 1+c*12;` -> `c = 1+c*4;` | large (0.389, 66%) | weaker twist: single smooth S-curve with a big round white void, stripe bands much straighter, less local waviness | variants/twist_4/frame_00001.png |
| amp_240 | `*2-1)*120;` (lines 102-103, 777/333) -> `*2-1)*240;` | large (0.395, 85%) | wider, gentler central wave; top and bottom stripe bands compress into dense grey moire hatching | variants/amp_240/frame_00001.png |
| step_1 | `j+=2` -> `j+=1` | none (0.009, 1%) | no visible change | variants/step_1/frame_00001.png |

## Modularisation notes
- `def()` is fully generic: a point-displacement function combining a simplex
  twist (frequency `kkk`, gain 12) with two Perlin octaves (frequency/amplitude
  pairs). This is the main reusable candidate — `noiseDisplace(x, y, z,
  twistFreq, twistGain, coarseFreq, coarseAmp, fineFreq, fineAmp)`.
- The column-strip loop is a generic "striped field" generator: strip count
  (`sub`), strip width (`ss`), vertical step (2), alternating fill, and any
  per-vertex displacement function.
- One-off art decisions: the specific random ranges (0.0004-0.012 frequency,
  amplitudes 120/30, z=200, the x1.4 width overscan), the strict black/white
  alternation, and the P3D perspective camera that creates the vanishing point.
- A clean parameter object: {strips, widthOverscan (1.4), step, twistFreq,
  twistGain (12), coarseFreq, coarseAmp (120), fineFreq, fineAmp (30),
  zOffset, seed}.
