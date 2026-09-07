---
sketch: 2019/generativos/cirnoi
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2785
animated: false
techniques: [noise-field, polar, dots-stippling, symmetry, distortion]
primitives: [point]
palette:
  colors: ["#F20707", "#FC9F35", "#C5B7E8", "#544EE8", "#000000"]
  selection: noise-driven
composition: centered
parameters:
  - {name: pointCount, default: "PI*0.5*radius^2*5 (~1.47M)", tried: ["*10 (~2.9M)"], change: subtle, effect: "no visible change; low alpha keeps bands from saturating"}
  - {name: alphaRange, default: [20, 40], tried: [[20, 150]], change: subtle, effect: "slightly paler, softer dark bands; structure unchanged"}
  - {name: lobeSector, default: "PI/3 (6 lobes)", tried: ["PI/4 (8 lobes)"], change: subtle, effect: "no clearly visible change in render"}
  - {name: warpScale, default: 100, tried: [300], change: moderate, effect: "stronger noise warp: more torn, irregular rings; less circular boundary"}
  - {name: palette, default: "F20707/FC9F35/C5B7E8/544EE8/000000", tried: ["ED61DA/200C2B/0029BF/FFE760/DBD1CB"], change: subtle, effect: "colours shifted (pink/cream, soft blue, pale yellow, navy shadows) but mean pixel diff stays low; geometry identical"}
  - {name: twist, default: "[-0.02, 0.02]", tried: ["[-0.06, 0.06]"], change: moderate, effect: "tighter spiral of many thin concentric rings; 6-lobed pinwheel mostly lost"}
reusable_candidates:
  - {name: displaceFbm, signature: "displaceFbm(x, y, dirDetail, magDetail) -> PVector", note: "fbm-driven polar displacement field: direction = fbm(a)*PI*4, magnitude = fbm(b)*scale"}
  - {name: quantizedPolarScatter, signature: "quantizedPolarScatter(count, radius, lobeCount, bandSize) -> PVector[]", note: "uniform-disc points with angle snapped to N-fold lobes and radius snapped to concentric bands"}
---

## What it draws
A single centered pinwheel of ~1.47 million tiny semi-transparent dots on a near-white (252)
background. The dots form concentric ring-bands that spiral around the centre, grouped into
six soft lobes; the whole form is gently warped by a fractal-noise field so the rings wobble
and tear apart at the edges. Dominant colours are pale lavender/periwinkle with dark
indigo-blue shadow bands and small touches of warm orange near the core.

## How the code works
- `setup()` calls `generate()` once; `draw()` is empty, so the image is static
  (cirnoi.pde:21-32).
- `generate()` (cirnoi.pde:57-93) seeds random/noise, fills `background(252)`, then rolls all
  structural randomness from the seed: four tiny noise-field detail/offset values
  `detAng/desAng/detDes/desDes` in [0, 0.012) (line 64-67), two frequency terms `a1,a2` in
  [0, 0.04) (69-70), two amplitudes `amp1,amp2` in [0,1) (71-72), and a global twist
  `rot` in [-0.02, 0.02] (74).
- Point count `ccc = PI*0.5*radius^2*5` with `radius = width*0.45` gives ~1.47M points
  (line 76-77). Per point (79-91):
  - angle `ang = random(TAU)` is pulled toward one of six 60° sectors by
    `ang -= (ang%(PI/3))*random(random(0.3), 1)` (line 80) — the six-lobe symmetry;
  - radius is a uniform-disc sample `radius*sqrt(random(1))*random(0.8,1)` (line 81) then
    snapped into 80px concentric bands via `dis -= (dis%80)*random(1)*random(0.5,1)`
    (line 82) — the ring structure;
  - `dis += cos(ang*4)*8 + cos(ang*12)*4` (line 83) wobbles the bands into 4-fold/12-fold
    petals;
  - `ang += cos(dis*a1)*amp1 + cos(dis*a2)*amp2 + dis*rot` (line 84) adds a radius-dependent
    twist — the spiral;
  - the point is placed in polar coords about the centre (85-86), then warped by
    `dis(xx,yy)` (line 95-99): a custom 4-octave value-noise FBM (fbm.pde:27-38) supplies both
    a direction `fbm(...)*PI*4` and a magnitude `fbm(...)*100` — the fractal distortion.
- Colour (line 90): `getColor(noise(ang + dis*0.001, dis*0.004)*5)` maps 2-D Perlin noise to
  the 5-colour palette `{#F20707, #FC9F35, #C5B7E8, #544EE8, #000000}` (line 110), lerping
  between adjacent palette entries with a sqrt ease (121-127); stroke alpha is `random(20,40)`
  so density, not opacity, builds the colour.
- `toxi` and `triangulate` are imported (lines 1-2) but not actually used; the FBM here is the
  local `fbm.pde` value noise. `ridge`/`ridgedMF` (fbm.pde:40-65) are defined but never called.
- No blend modes; accumulation is purely alpha-blended overdraw.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| density_10 | `int ccc = int(PI*0.5*radius*radius*5);` -> `int ccc = int(PI*0.5*radius*radius*10);` | subtle | no visible change: same 6-lobed spiral, same colours and texture; doubling points does not saturate the bands at alpha 20-40 | variants/density_10/frame_00001.png |
| alpha_150 | `..., random(20, 40));` -> `..., random(20, 150));` | subtle | subtle: overall slightly paler; the dark indigo shadow bands soften a touch, structure and colour distribution otherwise the same | variants/alpha_150/frame_00001.png |
| lobes_PI4 | `ang -= (ang%(PI/3))*random(random(0.3), 1);` -> `(ang%(PI/4))*...` | subtle | no clearly visible change: the pinwheel still reads as the same 6-lobed spiral in the render | variants/lobes_PI4/frame_00001.png |
| warp_300 | `fbm(desDes+xx*detDes, desDes+yy*detDes)*100;` -> `... *300;` | moderate | stronger fractal warp: ring bands more torn and broken, outer boundary less circular, dark indigo fragments more scattered | variants/warp_300/frame_00001.png |
| palette_pink | `int colors[] = {#F20707, #FC9F35, #C5B7E8, #544EE8, #000000};` -> `{#ED61DA, #200C2B, #0029BF, #FFE760, #DBD1CB};` | subtle | subtle: colours shifted to pale pink/cream, soft blue and pale yellow with dark navy shadows (visible on inspection) but mean pixel change stays low because the image remains mostly light; geometry identical | variants/palette_pink/frame_00001.png |
| twist_0.06 | `float rot = random(-0.02, 0.02)*random(1);` -> `random(-0.06, 0.06)*random(1);` | moderate | much tighter spiral: the 6-lobed pinwheel becomes many thin concentric rings, orange tint near the core more visible | variants/twist_0.06/frame_00001.png |

## Modularisation notes
- Generic: the FBM displacement field `dis()` (direction + magnitude from two independent
  fbm samples) is a clean candidate `displaceFbm(x, y, ...)`.
- Generic: the polar scatter with angular quantisation (lobes), radial band snapping,
  cosine petal modulation, and radius-dependent twist is a self-contained
  "quantized polar scatter" generator; each knob (lobe count, band size, petal cosines,
  twist range, a1/a2/amp1/amp2) is an independent parameter.
- Generic: `getColor(v)` — noise-value -> lerp between adjacent palette colours with
  power easing — is a reusable palette sampler.
- One-off art decisions: the exact palette, the `PI*0.5*r^2*5` density constant, the
  80px band size, `cos(ang*4)*8 + cos(ang*12)*4` petal terms, and the four random
  detail/offset ranges.
- A clean parameter object: `{count, radius, lobeCount, bandSize, petalTerms[], twist,
  twistFreqs[], warpScale, warpDetail, palette, alphaRange, noiseColorScale}`.
