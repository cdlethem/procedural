---
sketch: 2020/generative/01_04/girrol
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2004
animated: false
techniques: [noise-field, particles, image-source]
primitives: [image]
palette:
  colors: ["#25564F", "#4D7AAC", "#AAC1B9", "#FCCD02", "#100E14"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: detailCount, default: 200000, tried: [100000], change: moderate, effect: "thinner, sparser stroke texture; dark blot becomes smaller and less dense"}
  - {name: detAmp, default: 0.002, tried: [0.004], change: large, effect: "higher-frequency amplitude noise: many smaller dark blots each ringed in yellow instead of a few large blots"}
  - {name: colors, default: "[#25564F,#4D7AAC,#AAC1B9,#FCCD02,#100E14]", tried: ["[#7A2E1D,#C25E1B,#E8B04B,#3A2418,#F2E3C6]"], change: large, effect: "same composition in warm rust/orange/gold; blots read as dark brown with grey halos"}
  - {name: stampScale, default: "random(16,24)*1.4", tried: ["random(32,48)*1.4"], change: moderate, effect: "2x stamp size: looser, fluffier fibrous texture, larger softer blot edges"}
  - {name: underpaintCount, default: 100, tried: [50], change: large, effect: "mottled blue+gold ground nearly gone: smooth blue field dominates, yellow only in a band, blots barely visible"}
reusable_candidates:
  - {name: noiseStampField, signature: "noiseStampField(stamps[], count, warpScale, ampScale, palette) -> void", note: "random points displaced by 2-D noise, stamp size scaled by a third noise field, tint by palette index from two more noise fields"}
  - {name: noiseTint, signature: "noiseTint(palette[], n1, n2, amp) -> color", note: "lerp between adjacent palette colors at a noise-derived index with random alpha"}
---

## What it draws
A full-bleed abstract painting: a mottled wash of steel blue and mustard yellow made of
innumerable fine hair-like strokes, with three or four large dark teal-black organic blots
(upper right, center, lower right). The yellow concentrates in diagonal bands around the
dark blots; the whole surface reads as a soft, fibrous, airbrushed texture with no hard
edges.

## How the code works
`setup()` loads 4 brush stamps `brush01..04.png` (lines 26-29) and calls `generate()`
(line 33); `draw()` is empty so the image is static. `loadForms()` (line 41) is commented
out (line 31), so only the four brush PNGs are used.

`generate()` (lines 68-126):
1. Seeds `randomSeed`/`noiseSeed` with `seed` (lines 70-71), black background (line 72).
2. Underpaint: 100 large stamps (lines 77-87) — each a random-position, random-rotation
   brush at 0.5-1.2x canvas width (line 83), tinted from black toward one random palette
   color at low alpha (line 79). This lays the mottled blue/gold ground.
3. Detail pass: 200,000 small stamps (line 100). Per stamp:
   - position = random point plus a 2-D noise warp, 20 px amplitude (lines 101-106) —
     gives the fibrous, flow-like clumping;
   - `amp` from SimplexNoise at scale `detAmp` (line 108) multiplies the stamp size
     (line 120), so size/coverage follows a large-scale noise blob — this creates the
     dark dense blots where `amp` is high;
   - two more SimplexNoise fields `cn1`, `cn2` (lines 111-112) feed `getColor(float)`
     (lines 143-149), which lerps between adjacent palette colors at a noise-derived
     index — this produces the smooth blue-to-yellow banding;
   - tint uses that color with a random alpha (line 113) — the soft accumulation;
   - rotation around HALF_PI with a small noise-driven angular wobble (line 116) — the
     hair-like stroke orientation;
   - final scale = (3..4) * (16..24)*1.4 * amp (lines 118-120), applied to an
     anisotropic `ww`x`hh` rect (lines 103-104), so each stamp is a thin sliver.

Palette: 5 colors on line 134 (teal, blue, pale blue-green, yellow, near-black);
`rcol()` (line 135) picks one at random for the underpaint.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| strokeCount_100000 | `for (int i = 0; i < 200000; i++)` -> `... i < 100000 ...` | moderate | sparser, thinner stroke texture; smoother ground shows through; central dark blot smaller and less dense, same blue/gold/yellow layout | variants/strokeCount_100000/frame_00001.png |
| detAmp_0.004 | `float detAmp = random(0.002);` -> `random(0.004);` | large | amplitude noise at higher frequency: many smaller, distinct dark blots each ringed with yellow, instead of a few large blots; overall layout reorganised | variants/detAmp_0.004/frame_00001.png |
| palette_warm | `int colors[] = {#25564F, #4D7AAC, #AAC1B9, #FCCD02, #100E14};` -> warm rust/orange/gold set | large | same composition and blot layout, recoloured to warm rust, orange, gold; blots read as dark brown with grey halos | variants/palette_warm/frame_00001.png |
| stampScale_2x | `sca *= random(16, 24)*1.4;` -> `random(32, 48)*1.4;` | moderate | 2x stamp size: looser, fluffier fibrous texture with larger strokes; blot edges bigger and softer, fewer visible dark cores | variants/stampScale_2x/frame_00001.png |
| underpaint_50 | `for (int i = 0; i < 100; i++)` -> `... i < 50 ...` | large | mottled blue+gold ground nearly gone: smooth blue fibrous field dominates, yellow only in a lower band, dark blots barely visible | variants/underpaint_50/frame_00001.png |

## Modularisation notes
- Generic / reusable: the stamp-field loop (warp noise + amplitude noise + two
  noise-driven palette channels + alpha tint) is a self-contained function parameterised
  by stamp set, count, warp/amp/detail scales and palette — a good candidate for the
  library (`noiseStampField` above). `getColor(float)` (palette lerp by fractional
  index) is also reusable on its own.
- One-off art decisions: the specific 5-color palette (line 134), the 100-large-stamp
  underpaint pass, the brush PNGs themselves, the anisotropic sliver aspect ratios
  (lines 103-104), the rotation bias to HALF_PI (line 116).
- Clean parameter object: `{ stamps: PImage[], underpaintCount, detailCount,
  warpAmp, ampScale (detAmp), palette: int[], angleDetail (detAng), sizeBase,
  sizeRange, alpha }`.
