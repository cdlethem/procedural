---
sketch: 2019/generativos/dadatata
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 3616
animated: true
techniques: [3d-pointcloud, noise-field]
primitives: [point, ellipse]
palette:
  colors: ["#F73B3B", "#9DAAAB", "#6789AA", "#4F4873", "#3A3A3A"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: 400, tried: [1200], change: moderate, effect: "3x longer strands: denser, hairier tangle with long visible strokes; colour masses cover more of the frame"}
  - {name: maxAmp, default: "0-100 (random)", tried: ["0-400 (random)"], change: moderate, effect: "colour masses unchanged; points scatter further and far more elliptical rings become visible, especially in the red region"}
  - {name: detCol, default: "0-0.0005 (random)", tried: ["0-0.0025 (random)"], change: moderate, effect: "much coarser colour field: large purple-grey cells bounded by red vein-like lines instead of fine speckle"}
  - {name: alp, default: "50-100 (random)", tried: ["15-30 (random)"], change: moderate, effect: "lower alpha removes the ADD blow-out: smooth grainy red/pink and white/grey masses instead of blown-out white cores"}
  - {name: k, default: 22000, tried: [8000], change: moderate, effect: "sparser, airier tangle: same red/grey/blue regions with more black showing between strands"}
reusable_candidates:
  - {name: paletteLerpColor, signature: "paletteLerpColor(int[] colors, float v) -> int", note: "indexes v into the palette and lerpColors between the two adjacent entries with a pow-eased fraction (getColor, lines 133-139)"}
  - {name: simplexColorField, signature: "simplexColorField(float3 pos, float scale, int[] colors) -> int", note: "3D simplex noise sampled at a point position drives the palette colour (lines 76-77)"}
  - {name: noiseStrandOnSphere, signature: "noiseStrandOnSphere(radius, count, seedOffset, maxAmp) -> point[]", note: "one strand of points whose spherical angles follow 1-D noise, displaced by cos/sin/tan * noise (lines 69-88)"}
---

## What it draws
Frame 1 (captured right after the first `draw()`) looks overexposed: the left half is black with a dense field of fine white specks, the right half is a large blown-out white mass, and a couple of faint thin rings are visible in the middle. The stable image (frames 10 and 60, which are identical) is a tangle of fine point strands in 3D on a black background: a dominant red mass on the right, a pale grey-white region in the top right, a blue-white region in the bottom left, and scattered thin elliptical rings plus small white dots.

## How the code works
- `settings()` (dadatata.pde:14-19): 960x960 P3D, `smooth(8)`, `pixelDensity(2)` (unavailable on the headless display, falls back with a warning).
- `setup()` (21-29) calls `generate()` once; `draw()` (31-32) is empty, so the scene is static. Frame 10 and frame 60 have identical md5s and both differ from frame 1 — the frame-1 blow-out is a P3D first-flush capture artifact [INFERENCE], not sketch animation.
- `generate()` (34-108): `background(0)` (36). Random perspective camera: `fov = PI/random(1.6, 2.4)`, `cameraZ = (height/2)/tan(fov/2)` (38-41); translate to centre with a random z offset in [-800, 0] (43); three random rotations (45-47).
- `radius = 1000` (50); `detCol = random(0.001)*0.5` — a very fine 3D colour-noise scale (52). `blendMode(ADD)` (56): overlapping semi-transparent points add up and saturate, which is why dense areas blow out to white.
- Outer loop: 22000 strands (57). Per strand: random start colour `rcol()` (58), random 1-D noise offset `r1` (59), alpha `alp = random(100,200)*0.5` (64), `maxAmp = random(100)*random(1)` (67), length `cc = int(random(400))` points (68).
- Inner loop (69-88): spherical angles come from 1-D noise — `a1 = noise(i*0.0002, r1)*PI`, `a2 = noise(k, i*0.0002)*PI*2` (70-71) — so each strand is a smooth wandering path, not a uniform sphere shell. Position at radius 1000 (73-75). Colour: 3D `SimplexNoise.noise(detCol*x, ...)` at the point position, passed to `getColor(noiCol*5)` (76-77, 133-139) which lerps between adjacent palette entries — this produces the large red / grey / blue regions seen in the image.
- Displacement (79-83): `amp = cos(x)*sin(y)*tan(z)*maxAmp`; x, y, z are large values (up to ~1000) so `tan(z)` is wild, and `dx/dy/dz = noise(...)*amp` throws points far off the sphere — this is the long hair-like scattering visible everywhere. `strokeWeight` 1-2 (85), `point` (87).
- With probability 0.1 per strand (91-106): a stroked ellipse ring (diameter 20-100, random alpha) plus a small 3 px dot filled white at alpha 140, at the strand end — the rings and dots visible in the image.
- Palette is a fixed 5-colour list (125): red `#F73B3B`, grey `#9DAAAB`, blue `#6789AA`, dark blue `#4F4873`, dark grey `#3A3A3A`; `rcol()` picks randomly, `getColor(float)` is the noise-driven one.
- Unused helpers: `random2`/`noise2`/`fbm` (141-178) and `arc2` (180-195) are dead code in this sketch.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_1200 | `int cc = int(random(400));` -> `int cc = int(random(1200));` | moderate (mean 0.1459, 0.455 of pixels) | strands 3x longer: a denser, hairier tangle of long continuous strokes; the red, grey and blue masses fill more of the right side and long curved strands are individually visible | variants/cc_1200/frame_00001.png |
| maxAmp_400 | `float maxAmp = random(100)*random(1);` -> `float maxAmp = random(400)*random(1);` | moderate (mean 0.0571, 0.215 of pixels) | colour masses (red right, grey top-right, blue bottom-left) unchanged in position; points scatter further and many more thin elliptical rings are visible, densely packed in the red region | variants/maxAmp_400/frame_00001.png |
| detCol_0.005 | `float detCol = random(0.001)*0.5;` -> `float detCol = random(0.005)*0.5;` | moderate (mean 0.0708, 0.297 of pixels) | much coarser colour field: large purple-grey cells separated by red vein-like lines (voronoi-like network) on the right, instead of fine multicoloured speckle | variants/detCol_0.005/frame_00001.png |
| alp_0.15 | `float alp = random(100, 200)*0.5;` -> `float alp = random(100, 200)*0.15;` | moderate (mean 0.0944, 0.366 of pixels) | lower alpha stops the ADD saturation: the right side becomes a smooth grainy red/pink mass with a white/grey upper-right and a small blue patch bottom-left; no blown-out white cores, left half stays black | variants/alp_0.15/frame_00001.png |
| k_8000 | `for (int k = 0; k < 22000; k++) {` -> `for (int k = 0; k < 8000; k++) {` | moderate (mean 0.08, 0.308 of pixels) | sparser, airier version of the baseline: same red mass on the right, grey top-right and blue-white bottom-left, but with more black visible between the strands | variants/k_8000/frame_00001.png |

## Modularisation notes
- Generic, library-ready: `getColor(float v)` palette lerp (133-139); the simplex-noise colour field (76-77) as `simplexColorField(pos, scale, colors)`; the noise-strand-on-sphere generator (69-88) as a point-list generator parameterised by radius, count, seed offset, and displacement amplitude.
- One-off art decisions: the specific 5-colour palette; the random perspective camera and triple rotation (43-47); the `cos/sin/tan` displacement trick (79-83) — it only looks good because of ADD blending; the 10% ring + white-dot sprinkle (91-106).
- A clean parameter object would be: `{radius, strands, pointsPerStrand (min/max), alpha (min/max), displacementAmp, colorNoiseScale, fovRange, ringProbability, palette}`.
