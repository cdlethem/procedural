---
sketch: 2019/generativos/finas
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1717
animated: false
techniques: [noise-field, dots-stippling, distortion, curves]
primitives: [ellipse]
palette:
  colors: ["#F8AE23", "#FF5721", "#161B55", "#015D87", "#EF67B4"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: lineCount, default: 80, tried: [40], change: subtle, effect: "fewer, sparser strands; more open background, same texture"}
  - {name: subMult, default: 8, tried: [16], change: moderate, effect: "denser dots; strands read more continuous, busier and more interwoven"}
  - {name: maxSize, default: "random(5,9)*random(0.5,1.2)", tried: ["random(5,9)*random(0.5,2.4)"], change: moderate, effect: "larger beads; chunkier dotted texture"}
  - {name: disAmp, default: 100, tried: [200], change: moderate, effect: "wider meanders; looser, more curved, more wandering strands"}
  - {name: detAng, default: "random(0.003,0.004)", tried: ["random(0.006,0.008)"], change: moderate, effect: "tighter, finer ripples and curls along the strands"}
  - {name: dotAlpha, default: 60, tried: [200], change: subtle, effect: "more opaque dots; strands more solid and colours stronger, layout unchanged"}
reusable_candidates:
  - {name: valueNoise2, signature: "valueNoise2(x, y) -> float", note: "hash-based 2-D value noise (noise2 in fbm.pde)"}
  - {name: fbm, signature: "fbm(x, y, octaves=4) -> float", note: "4-octave abs-fbm built on value noise, lacunarity 2.2/1.8"}
  - {name: ridgedMF, signature: "ridgedMF(x, y, octaves=4) -> float", note: "4-octave ridged multifractal with persistence gain 0.5, built on fbm"}
  - {name: flowDisplace, signature: "flowDisplace(x, y, angField, distField, angScale, distAmp) -> PVector", note: "angle from fbm, distance from ridgedMF (dis in finas.pde)"}
  - {name: dotStrand, signature: "dotStrand(x1, y1, x2, y2, samples, sizeRange, alpha, displace) -> void", note: "line of displaced, size-oscillating ellipses"}
  - {name: lerpPalette, signature: "lerpPalette(palette[], noiseValue, power=0.5) -> color", note: "getColor: lerp between adjacent palette entries"}
---

## What it draws
A full-bleed light grey field crossed by many thin, wavy, hair-like strands that run roughly
vertically from top to bottom. Each strand is made of small round dots (not solid strokes); where
dots are dense they merge into a continuous thread, where sparse they read as a dotted line. The
strand sizes oscillate along their length, giving a beaded look. Dominant colours are orange,
medium blue, and purple/magenta on the pale background; overlapping translucent dots create darker
blended patches in the dense central band.

## How the code works
- `settings()` (finas.pde:14) creates a 960x960 P2D canvas. `setup()` (21) calls `generate()` once;
  `draw()` (31) is empty, so the piece is static (frames 1/10/60 identical in baseline).
- `generate()` (57) reseeds `random`/`noise` with `seed` (59-60), fills background grey 236 (68),
  then loops 80 times (69).
- Each iteration picks a random top x (`x1`) and random bottom x (`x2`) (70-73): conceptually a
  straight vertical line from (x1, 0) to (x2, height).
- `sub = int(random(60, 200))*8` (81) gives 480-1600 samples per strand.
- Per sample (88-98): `v = j/(sub-1)`; position lerped along the line (89-91); dot diameter
  `ss = cos(v*j*0.2 + xx*0.2) * maxSize` (92) oscillates along the strand, with
  `maxSize = random(5,9)*random(0.5,1.2)` (87, range ~2.5-10.8 px).
- Colour (93): `noise(ic + dc*j)` sampled along the strand is scaled to the palette and passed to
  `getColor(float)` (129-135), which lerps between two adjacent palette entries
  (`lerpColor`, sqrt curve); alpha is fixed at 60. Palette (118): #F8AE23, #FF5721, #161B55,
  #015D87, #EF67B4. `ic`/`dc` (83-84) give each strand its own noise offset and drift, so each
  strand's colour changes slowly along its length.
- Every dot's position is displaced by `dis(xx, yy)` (102-106): angle =
  `fbm(...) * PI*6`, distance = `ridgedMF(...) * 100`. `fbm` (fbm.pde:27) is a 4-octave
  abs-value-noise; `ridgedMF` (fbm.pde:47) is a 4-octave ridged multifractal built on fbm.
  Frequencies come from `detAng` ~0.003-0.004 (62) for the angle field and `detDes`
  ~0.0006-0.0012 (64) for the distance field. This displacement is what turns the straight
  vertical lines into the wavy strands.
- The dotted appearance comes from the discrete ellipse sampling plus the cosine size oscillation;
  alpha 60 makes overlaps accumulate to darker tones.
- Note: `toxi`/`triangulate` are imported (lines 1-2) but never used; all noise is the
  self-contained `fbm.pde` implementation.

## Experiments
| variant | substitution | change score | observation | image |
| lineCount_40 | `  for (int i = 0; i < 80; i++) {` -> `  for (int i = 0; i < 40; i++) {` | subtle | subtle: half the strands; composition sparser with more bare background, same beaded-dotted texture and colours | variants/lineCount_40/frame_00001.png |
| subMult_16 | `    int sub = int(random(60, 200))*8;` -> `    int sub = int(random(60, 200))*16;` | moderate | dots much denser; strands read as near-continuous threads, busier tangle with more visible small loops | variants/subMult_16/frame_00001.png |
| maxSize_2_4 | `    float maxSize = random(5, 9)*random(0.5, 1.2);` -> `    float maxSize = random(5, 9)*random(0.5, 2.4);` | moderate | dots visibly larger; beaded, chunkier strands, the dot-by-dot structure stands out more | variants/maxSize_2_4/frame_00001.png |
| disAmp_200 | `  float des = ridgedMF(desDes+xx*detDes, seed+desDes+yy*detDes)*100;` -> `...*200;` | moderate | displacement doubled; strands meander in wider arcs, looser and more wandering, denser clumps where they cross | variants/disAmp_200/frame_00001.png |
| detAng_0.006 | `  detAng = random(0.003, 0.004);` -> `  detAng = random(0.006, 0.008);` | moderate | angle-field frequency doubled; finer, higher-frequency ripples and tight curls along the strands | variants/detAng_0.006/frame_00001.png |
| dotAlpha_200 | `      fill(getColor(noise(ic+dc*j)*colors.length*4), 60);` -> `..., 200);` | subtle | subtle: dots more opaque; strands look more solid with stronger, less washed-out colours, same layout | variants/dotAlpha_200/frame_00001.png |

## Modularisation notes
- Generic, library-ready: `noise2`/`fbm`/`ridgedMF` (fbm.pde) are self-contained 2-D noise
  primitives; `dis()` is a generic flow displacement (angle field + distance field);
  `getColor(float)` is a generic noise-driven lerp palette; the strand loop (69-99) is a
  "displaced dot line" primitive.
- One-off art decisions: 80 vertical strands with random top/bottom x; the `cos(v*j*0.2+xx*0.2)`
  size oscillation; the specific 5-colour warm/cool palette; alpha 60.
- A clean parameter object: `{strandCount, samplesRange, sizeRange, alpha, angleDetail,
  angleScale, distanceDetail, distanceAmp, palette}`.
