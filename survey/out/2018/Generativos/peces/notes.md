---
sketch: 2018/Generativos/peces
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1804
animated: true
techniques: [flow-field, agents, particles, curves, shader]
primitives: [shape, ellipse]
palette:
  colors: ["#DDD3C9", "#EE9A02", "#EB526E", "#0169B3", "#024E2C"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: det, default: "random(0.004)", tried: [0.0005], change: none, effect: "no visible change at the frame-10 snapshot; fish are still sub-pixel specks this early"}
  - {name: spawnRate, default: "frameCount%1", tried: ["frameCount%3"], change: none, effect: "no visible change (a couple of faint specks instead of a few)"}
  - {name: fishSize, default: "random(80, 240)", tried: ["random(80, 500)"], change: none, effect: "no visible change at the frame-10 snapshot"}
  - {name: sv, default: 10, tried: [20], change: none, effect: "no visible change at the frame-10 snapshot"}
  - {name: bodyWidth, default: "s*0.2", tried: ["s*0.6"], change: none, effect: "no visible change at the frame-10 snapshot"}
reusable_candidates:
  - {name: flowFieldAngle, signature: "flowFieldAngle(x, y, offset, scale) -> float", note: "2-D noise sampled at offset+pos*scale, mapped to a TAU angle; drives both fish motion and spine tracing"}
  - {name: taperedTrail, signature: "taperedTrail(head, dirFn, steps, stepLen, widthProfile) -> shape", note: "walk backwards along a direction field, offset each point perpendicular by a width profile, close the outline; general fish/comet body"}
  - {name: cyclingPalette, signature: "cyclingPalette(colors, v) -> color", note: "float v walks the palette continuously, lerping between adjacent entries (getColor)"}
---

## What it draws

Baseline frame 10 (promoted to `frame_00001.png`; frames 1–2 were blank) is almost empty: a flat light-gray
canvas with a handful of tiny colored specks (teal, orange, pink). By frame 60 the canvas is scattered with
dozens of thin, curved, tapered shapes — comet- or fish-like trails — each a few pixels wide at the tail and
ending in a slightly fatter head dot. Colors seen: teal/dark green, blue, orange, pink-red, cream, over the
light-gray ground. Edges are soft, as if brushed with a soft pencil.

## How the code works

- `setup()` (peces.pde:7-13): 960×960 P2D, loads `data/blur.glsl`, calls `generate()` which seeds
  `randomSeed(seed)` (the harness-injected `seed` field), picks `des = random(1000)` (noise offset) and
  `det = random(0.004)` (noise scale), and clears the fish list.
- `draw()` (peces.pde:15-31): NO background clear — the `background(...)` line is commented out — so every
  frame accumulates on top of the last. `filter(blur)` (a 3×3 Gaussian-weight kernel in blur.glsl:38-40) is
  applied to the whole canvas each frame, which is why older trails get progressively softer and why the
  first frames (nothing drawn yet, or only one frame of it) come out blank/flat.
- One new `Fish` spawns per frame (line 21) at a random position ±100 px outside the canvas edge, size
  `random(80, 240)`.
- `Fish.update()` (58-123): direction `dir = noise(des+x*det, des+y*det)*TAU` (line 85) — the classic
  noise flow field — and the head moves `vel = s*random(0.01,0.04)` along it. Life is `timeLife = random(4,8)`
  seconds; `amp` fades in over the first 20% and out over the last 30% (lines 93-98) of life, scaling both
  spine length and body width to 0, so fish are born small, grow, and vanish. The spine is traced backwards:
  from the head, `cs = s/10` steps of length `sv = 10` along `-(noise angle)` (lines 106-116), re-sampling the
  same flow field at each step — that is what makes the trails follow the field as curves.
- `Fish.show()` (125-153): the body is a closed `beginShape()` polygon (no stroke): one loop offsets each
  spine point perpendicular to the local angle by `pow(val,0.7)*ss*0.5` on one side, the second loop mirrors
  it on the other side (`ss = s*0.2*amp`), so width tapers to a point at the tail; `fill(lerpColor(col1, col2,
  val))` (lines 139/147) shades the body between two colors. `col1/col2` are obtained from `getColor(c1/c2)`
  where `c1,c2` increment by random small amounts per frame (lines 75-91) — `getColor` (174-179) lerps
  between adjacent entries of the 5-color palette `colors[]` (line 167: cream, orange, pink-red, blue,
  dark green). A head dot `ellipse(xx, yy, ss, ss)` (line 152) caps the nose.
- Randomness enters via the injected `seed` (deterministic per run): spawn positions/sizes, velocity, life
  length, color walk rates, and the noise offset `des`.

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_0.0005 | `det = random(0.004);` -> `det = 0.0005;` | none | no visible change: frame 10 is still a flat gray canvas with a few 1-px specks (teal, orange, blue) | variants/det_0.0005/frame_00001.png |
| spawnRate_3 | `if (frameCount%1 == 0) fishes.add(...)` -> `frameCount%3` | none | no visible change: same near-empty gray field, only ~2 faint specks instead of a few | variants/spawnRate_3/frame_00001.png |
| fishSize_500 | `random(80, 240)` -> `random(80, 500)` (spawn line) | none | no visible change: same near-empty gray field with a few faint specks | variants/fishSize_500/frame_00001.png |
| sv_20 | `float sv = 10;` -> `float sv = 20;` | none | no visible change: a few faint 2-4px dashes (blue/green) on the right, still far too early for the longer spine to matter | variants/sv_20/frame_00001.png |
| bodyWidth_0.6 | `float ss = s*0.2*amp;` -> `float ss = s*0.6*amp;` | none | no visible change: same near-empty gray field with a few faint dashes | variants/bodyWidth_0.6/frame_00001.png |

All five scores are `none` because the compared image is the promoted frame 10: every fish there is 1–9 frames
old, so `amp` (the life-curve fade-in, peces.pde:93-98) keeps them at a few pixels at most. These parameters
act on the several-hundred-frame lifespan and the no-clear blur accumulation, so they only become visible in
later frames (cf. baseline frame_00060). The frame-10 snapshot is the wrong vantage point for this sketch.

## Modularisation notes

- Generic, library-worthy: the flow-field angle sampler (`noise(offset + pos*scale)*TAU`), the tapered-trail
  builder (walk a direction field backwards, offset both sides by a width profile, close the shape,
  per-vertex lerp fill), and the continuous cycling palette (`getColor`).
- One-off art decisions: no-clear + per-frame Gaussian `filter()` accumulation (the softening trail
  aesthetic), spawning one fish per frame from off-canvas, the `pow(val, 0.7)` width profile and `amp`
  fade-in/out, the 5-color palette itself, and the ±100 px off-screen spawn margin.
- A clean parameter object: `{seed, spawnInterval, sizeRange, velRange, lifeRange, noiseOffset, noiseScale,
  spineSteps, stepLen, widthFactor, palette}` — the sketch is essentially `agents + flowField + taperedTrail`
  with a `blurAccumulate` post effect.
