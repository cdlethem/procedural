---
sketch: 2019/generativos/bababa
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1701
animated: true
techniques: [noise-field, particles, curves]
primitives: [shape]
palette:
  colors: ["#B2354A", "#3A48A5", "#D69546", "#683910", "#46BCC9"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: particles, default: 900, tried: [300], change: large, effect: "sparser field: isolated worm-like curls, large black gaps"}
  - {name: steps, default: 600, tried: [150], change: large, effect: "shorter, stiffer squiggles; individual paths readable, less overlap density"}
  - {name: amp, default: "10-14 * 1.4", tried: [4.2], change: large, effect: "3x step: wider ribbon-like trails covering more area, coarser structure"}
  - {name: alp, default: "10-16 * 2.4", tried: [4.8], change: large, effect: "2x alpha: brighter opaque strokes, many white hotspots where trails cross"}
  - {name: velRot, default: "2-6", tried: [8-20], change: large, effect: "fast turning: tight scribble mesh, structure dissolves, dense web with white blotches"}
reusable_candidates:
  - {name: noiseFlowTrail, signature: "noiseFlowTrail(nPaths, steps, stepLen, noiseScale, turnGain, seed) -> paths", note: "particle trails whose heading is steered by sampled simplex noise (toxiclibs SimplexNoise)"}
  - {name: lerpColorRamp, signature: "getColor(v) -> color", note: "cyclic lerp between adjacent palette entries; index v drifts linearly along the path"}
---

## What it draws
A full-bleed field of glowing, meandering neon filaments on a black background. The
filaments twist into S-curves, hooks, loops and squarish vortices, densely packed and
overlapping. Dominant colours are gold/orange, teal-cyan, and magenta-pink, with blue
and brown accents; where filaments cross, the additive blend makes bright hotspots.
Later frames (10/60) show the identical line structure but rendered almost pure white —
a P3D/Xvfb additive-blend capture artifact, not animation (the code draws once in
`setup()` and `draw()` is empty).

## How the code works
`settings()` creates a 960x960 P3D window (lines 14-19). `setup()` calls `generate()`
once (line 23); `draw()` is empty (31-32).

`generate()` (34-71): black background (36), `blendMode(ADD)` (38). Spawns `900`
particles (line 49) at polar coordinates around the centre: radius `s*0.5*random(90)`
with `s = width*0.02`, i.e. up to ~864 px, so the field is full-bleed (50-53). Each
particle gets an alpha `random(10,16)*2.4` (50), a start colour index `ic` (58) and a
colour drift `dc = random(0.002,0.003)` (59).

Each particle walks `600` steps (62): its heading `aa` is rotated by
`(noise(x*det+seed, y*det+seed) - ia) * 2 - 1) * velRot`, i.e. the local simplex-noise
difference from the start value, scaled by `velRot` (2-6, randomly signed, 55-56), and
`det = random(0.008,0.01)*0.3` sets the noise field's scale (45). Position advances by
`amp = random(10,14)*1.4` per step (47, 66-67). Vertices are collected in one
`beginShape()/endShape()` per particle (61, 69).

Colour: `getColor(ic + dc*i)` (63) lerps between two adjacent entries of the 5-colour
palette `#B2354A, #3A48A5, #D69546, #683910, #46BCC9` (88), with the palette index
drifting slowly along the path, so each filament shifts hue as it travels (95-101).
`smooth(8)` + P3D + ADD blending produce the glowing, additive look (17, 38).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| particles_300 | `for (int j = 0; j < 900; j++) {` -> `... j < 300; ...` | large | sparser: isolated worm-like curls and small loops scattered over mostly black field | variants/particles_300/frame_00001.png |
| steps_150 | `for (int i = 0; i < 600; i++) {//...` -> `... i < 150; ...` | large | shorter stiffer squiggles, individual paths visible, more black between them | variants/steps_150/frame_00001.png |
| amp_4.2 | `float amp = random(10, 14)*1.4;` -> `*4.2;` | large | trails spread into wide ribbons, coarser larger-scale structure, less fine detail | variants/amp_4.2/frame_00001.png |
| alp_4.8 | `float alp = random(10, 16)*2.4;` -> `*4.8;` | large | much brighter: opaque strokes, whitish hotspots at crossings, glow less distinct | variants/alp_4.8/frame_00001.png |
| velRot_8_20 | `float velRot = random(2, 6);` -> `random(8, 20);` | large | high-frequency tight scribbles; flow-field structure dissolves into a dense mesh with white blotches | variants/velRot_8_20/frame_00001.png |

## Modularisation notes
- `generate()`'s particle-walk loop (49-70) is fully generic: a `noiseFlowTrail()`
  library function taking (nPaths, steps, stepLen, noiseScale, turnGain, alpha, seed,
  spawnCenter, spawnRadius) returning polylines.
- `getColor(v)` (95-101) is a reusable cyclic colour-ramp sampler, independent of the
  sketch; pair it with the 5-colour palette (88) as a named preset.
- One-off art decisions: the palette itself, the signed-random `velRot` range, the
  per-particle alpha range, ADD blend mode, and the spawn radius `s*0.5*random(90)`
  (which deliberately overfills the canvas).
- A clean parameter object: {nPaths, steps, stepLen, noiseScale, turnGain, alphaRange,
  spawnRadius, palette, colorDrift, blend}.
