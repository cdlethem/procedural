---
sketch: 2015/Generativos/lutFirst
year: 2015
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 809
animated: false
techniques: [particles, pixel-ops]
primitives: [ellipse, shape, pixels]
palette:
  colors: ["#141414", "#FFFFFF", "#000000"]
  selection: random-from-list
composition: centered
parameters:
  - {name: frames, default: 16000, tried: [4000], change: moderate, effect: "fewer, shorter trails (walkers cover less ground); central target cluster largely unchanged"}
  - {name: grain (IPnoise), default: 0.05, tried: [0.2], change: subtle, effect: "no visible change; grain increase barely perceptible"}
  - {name: vignette (IPvignette), default: 0.6, tried: [0.2], change: subtle, effect: "corners slightly less dark; rest identical"}
  - {name: lutIntensity (lut.apply), default: 0.6, tried: [1.0], change: subtle, effect: "background tone marginally darker/warmer; LUT already dominates the look"}
  - {name: initialCount, default: 80, tried: [20], change: large, effect: "sparser trails, fewer and smaller motifs, one central cluster instead of a dense field"}
  - {name: blobProb, default: 0.003/partis.size(), tried: [0.01/partis.size()], change: large, effect: "many more nested-polygon targets and smiley faces; central cluster swells into a big mass"}
reusable_candidates:
  - {name: lut3dApply, signature: "lut3dApply(image, cubeLut, intensity) -> PImage", note: "32^3 .cube LUT with per-pixel trilinear interpolation, lerp'd by intensity"}
  - {name: vignette, signature: "vignette(image, strength, color) -> PImage", note: "radial falloff lerp toward a corner color"}
  - {name: grain, signature: "grain(image, amount, colorNoise) -> PImage", note: "lerp each pixel toward random white/gray noise"}
  - {name: randomWalkParticles, signature: "randomWalkParticles(count, steps, speedRange, spawnRule) -> PImage", note: "center-born random walkers that branch into big decorative blobs"}
---

## What it draws
Near-black canvas with a faint film-grain texture. Thin, squiggly white lines (random-walk trails)
scatter across the whole image, densest in the top-right. In the centre-left there is a cluster of
concentric nested-polygon "targets" (alternating black/white rings forming hexagons, pentagons and
triangles) in several sizes. A few soft glowing white dots are scattered around, and at the top a
large face-like motif: a black disc with two white eye dots and a white smile arc. Everything is
monochrome gray, tinted slightly warm/dark by the film LUT (Lomo-fi, randomly picked at runtime).

## How the code works
- `setup()` (lutFirst.pde:5) sets 800x800, builds a `LutFilter` (default Brannan.cube, immediately
  superseded), calls `generar()`. `draw()` is empty → single static image; `keyPressed` regenerates.
- `generar()` (lutFirst.pde:19): `background(20)` (dark gray, line 20); spawns 80 `Parti` at the
  centre (lines 22-26); runs `frames = 400*40` = 16000 steps (line 28) updating every particle and
  removing any that leave the canvas (lines 67-69).
- `Parti.update()` (line 62): `ang += random(-0.1, 0.1) + cos(lfo1)*sin(lfo2)*0.01` (line 63) —
  random walk with slow LFO wobble; moves by `vel = random(2)` (line 56). Each step calls `show()`.
- `Parti.show()` (line 71): normally a 1-2 px dot (line 72); with probability `0.003/partis.size()`
  it becomes a 10-80 px blob, which also spawns 2 child particles at its position (lines 74-75) —
  this self-similar branching builds the dense central cluster. For blobs >3 px, one of three motifs
  (lines 80-106): (a) nested regular polygons alternating `red(col)` and `255-red(col)` fills
  (lines 82-91) — the concentric "targets"; (b) a "face": black disc, two white eye dots, white smile
  arc (lines 92-99); (c) concentric shrinking ellipses (lines 101-104).
- Colour: particle color is a random gray `cc` with tiny blue offset and random alpha
  (lines 57-58); the motifs use that color plus white/black complements.
- Post-processing (lines 36-43): `IPnoise(0.05)` lerps 5% random gray grain into every pixel
  (ImageProcessor.pde:40-58); `IPvignette(0.6)` darkens corners via radial falloff (lines 72-92);
  then a random `.cube` LUT from `LUTs/` is loaded (line 42, seed 42 → Lomo-fi.cube) and applied at
  60% strength (line 43).
- `LutFilter.apply()` (LutFilter.pde:35): loads a 32^3 table from the .cube text file (lines 16-22),
  per pixel does trilinear interpolation between the 8 surrounding LUT entries (lines 53-61) and
  `lerpColor` by intensity (line 63).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| frames_10 | `int frames = 400*40;` -> `int frames = 400*10;` | moderate | trails shorter and sparser (less top-right coverage); central target cluster largely unchanged | variants/frames_10/frame_00001.png |
| noise_0.2 | `IPnoise(0.05);` -> `IPnoise(0.2);` | subtle | no visible change; grain increase barely perceptible | variants/noise_0.2/frame_00001.png |
| vignette_0.2 | `IPvignette(0.6);` -> `IPvignette(0.2);` | subtle | corners slightly less dark; otherwise identical | variants/vignette_0.2/frame_00001.png |
| lut_1.0 | `lut.apply(0.6);` -> `lut.apply(1.0);` | subtle | background tone marginally darker/warmer; overall look nearly the same (LUT already dark/desaturated) | variants/lut_1.0/frame_00001.png |
| count_20 | `for (int i = 0; i < 80; i++) {` -> `for (int i = 0; i < 20; i++) {` | large | fewer walkers: sparser trails, fewer motifs, single central cluster with one big target and one face | variants/count_20/frame_00001.png |
| blobprob_0.01 | `random(1) < 0.003/partis.size()` -> `random(1) < 0.01/partis.size()` | large | canvas filled with many nested-hex targets and smiley faces; central cluster swells into a large mass | variants/blobprob_0.01/frame_00001.png |

## Modularisation notes
- `LutFilter` is fully generic: .cube parser + 32^3 trilinear lookup + intensity lerp. Strong
  library candidate (`lut3dApply` above); only dependency is PImage.
- `IPnoise` and `IPvignette` (ImageProcessor.pde) are generic single-purpose pixel ops, ready as-is.
- The `Parti` class is the art core: center-born random walkers whose "big blob" event both decorates
  (three one-off motifs: nested-polygon target, face, shrinking rings) and branches (spawn 2 copies).
  The motifs are one-off art decisions; the walk + gated-event + self-similar-spawn skeleton is
  reusable.
- Clean parameter object: `{initialCount, steps, speedMax, blobProb, blobSizeRange, grain,
  vignette, lutPath, lutIntensity}` — everything else is derived.
