---
sketch: 2018/Generativos/plasma004
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2423
animated: true
techniques: [noise-field, packing, particles, dots-stippling, blend-modes, lines-hatching]
primitives: [point, line, ellipse]
palette:
  colors: ["#000F29", "#FE0706", "#F85E8D", "#3E56A8", "#090D0E", "#06A5FF"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: sMax, default: 0.5, tried: [0.2], change: large, effect: "smaller max radius: many small/medium spheres, no giant blobs (score inflated by baseline frame-1 artifact)"}
  - {name: puffDensity, default: 0.0055, tried: [0.0015], change: moderate, effect: "sparser, more skeletal point clouds; rings and cores stand out"}
  - {name: puffAlpha, default: 140, tried: [250], change: subtle, effect: "no visible change in composition; blobs marginally brighter"}
  - {name: palette, default: "cool set (#000F29/#FE0706/#F85E8D/#3E56A8/#090D0E/#06A5FF)", tried: ["warm set (#1A0A00/#FFB347/#FF5E5B/#E8A838/#2B1B0E/#FFD700)"], change: moderate, effect: "identical geometry; yellow/gold/magenta on dark brown instead of cyan/red on blue"}
  - {name: desSize, default: "random(0.45,0.75)", tried: ["random(0.2,0.4)"], change: moderate, effect: "tighter, denser puffs; more distinct circular shells"}
reusable_candidates:
  - {name: packPoints, signature: "packPoints(w, h, attempts, rMin, rMax) -> PVector[]", note: "rejection-sampled non-overlapping circle packing (lines 42-58)"}
  - {name: noisePuff, signature: "noisePuff(center, radius, detail, offset, amp, n) -> points", note: "stippled sphere shell from 3-D Perlin-displaced unit directions (lines 73-86)"}
  - {name: lerpPalette, signature: "lerpPalette(int[] colors, float t) -> color", note: "lerp between adjacent palette entries, noise-driven t (getColor, lines 164-169)"}
  - {name: constellation, signature: "constellation(PVector[] pts, count, colors) -> lines", note: "random pair connector lines between packed points (lines 143-148)"}
---

## What it draws
Frame 1 (harness snapshot) is heavily over-saturated: big white and cyan blotches on deep
blue, faint thin lines crossing the canvas — the ADD-blended points are blown out toward
white. Frames 10 and 60 (identical to each other) show the settled image: dozens of glowing
sphere-like blobs of widely varying sizes on a near-black deep-blue ground; each blob is a
stippled cloud of red, pink and cyan points, many with a bright small core dot, some with thin
outline rings, spiral scribbles and small satellite spheres; thin coloured lines connect
distant spheres. Dominant colours: deep blue-black, cyan, red/pink.

## How the code works
- `setup()` (lines 3-9): 960x960 P2D, `smooth(8)`, calls `generate()` once. `draw()`
  (lines 11-12) is empty, so the image is fully built in setup; the sketch is logically
  static. The baseline's frame-1 snapshot is over-saturated relative to its own
  frame-10/60 image, while all variant runs' frame-1 snapshots show the normal dark
  settled composition — the blow-out is a per-run P2D snapshot artifact, not a
  deterministic property, and it inflates the change scores below.
- Line 24: loads `addfrag.glsl`/`addvert.glsl` from `data/`, but the `shader(add)` call at
  line 41 is commented out, so the shader is never applied.
- Lines 26-27: `randomSeed`/`noiseSeed` with `seed` (42). Line 29: background `#000F29`
  (deep blue). Line 31: `blendMode(ADD)` for everything that follows.
- Lines 33-38: 10000 random background points, random palette colour, alpha up to ~100 — a
  faint dust layer.
- Lines 42-58: rejection sampling: 10000 random positions, radius `width*random(0.04, 0.5)`
  (48-480 px), kept only if its distance to every kept point exceeds the mean radius — a
  non-overlapping packing of sphere centres.
- Lines 60-141, per packed point (10% skipped, line 61):
  - Puff: `cc = r^2 * PI * random(0.0055) * 8` samples (line 71); each sample places 20
    points (line 76) on a random 3-D unit direction whose radius is modulated by 3-D Perlin
    noise (line 80, detail ~ U(0,2)), scaled by `amp` U(0.4,1.2) and sphere radius `r`;
    colour is a noise-driven lerp through the palette (line 82), alpha `random(140)`
    (line 83) — the stippled, cloudy sphere shells.
  - Spikes: up to 100 short radial lines with a 3 px dot at the tip (lines 88-97).
  - Ring/scribble: up to 20000 points with slowly drifting angles (lines 100-111) — a thin
    orbit-like ring; 20% also get a 1000-point fast-spinning ring (lines 114-122).
  - 20% get a 4000-point rose-like loop with `cc`-fold angular snapping (lines 124-137).
  - A small filled ellipse core of diameter `r*0.1` (lines 139-140) — the bright centre dot.
- Lines 143-148: `points.size() * U(0.3, 0.4)` random pair-lines between distant spheres,
  alpha up to 256 — the web of thin connecting lines.
- ADD blending is what makes overlapping point clouds glow and what saturates dense areas
  toward white/cyan.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sphereSize_0.2 | `float s = width*random(0.04, 0.5);` -> `...random(0.04, 0.2);` | large | canvas densely filled with small/medium glowing spheres, no giant blobs; more, smaller spheres than the settled baseline composition (score partly inflated by the baseline frame-1 blow-out) | variants/sphereSize_0.2/frame_00001.png |
| puffDensity_0.0015 | `float cc = r*r*PI*random(0.0055)*8;` -> `...random(0.0015)*8;` | moderate | sparser, more skeletal clouds: shells read as thin point rings and wireframes with less solid puffiness; cores and connector lines stand out | variants/puffDensity_0.0015/frame_00001.png |
| puffAlpha_250 | `stroke(col, random(140));` -> `stroke(col, random(250));` | subtle | no visible change in composition; blobs only marginally brighter | variants/puffAlpha_250/frame_00001.png |
| palette_warm | `int colors[] = {#000F29, #FE0706, ...}` -> warm set `#1A0A00/#FFB347/#FF5E5B/#E8A838/#2B1B0E/#FFD700` | moderate | identical geometry (same seed); yellow/gold/magenta blobs on dark brown ground instead of cyan/red on deep blue | variants/palette_warm/frame_00001.png |
| desSize_0.4 | `float desSize = random(0.45, 0.75);` -> `random(0.2, 0.4);` | moderate | tighter puffs: denser compact cores, less diffuse spread, more distinct circular shells | variants/desSize_0.4/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: the rejection-sampling packing (lines 42-58) is a standalone
  random circle-packing function; the noise puff (lines 73-86) is a generic "stippled
  3-D-noise sphere" primitive; `getColor` (lines 164-169) is a generic palette-lerp utility;
  the random connector lines (lines 143-148) are a generic "constellation" connector.
- One-off art decisions: the per-sphere coin flips (10% skip, 20% second ring, 20% rose
  loop), the drifting-angle scribbles, the exact palette and the ADD + alpha values.
- A clean parameter object: seed; w/h; background colour; dust count; packing attempts;
  radius range (fraction of width); puff-count factor; points per puff; noise detail range;
  amplitude range; desSize range; alpha range; palette; spike max; ring counts;
  connector-line fraction.
