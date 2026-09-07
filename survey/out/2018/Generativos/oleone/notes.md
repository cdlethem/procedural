---
sketch: 2018/Generativos/oleone
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1924
animated: false
techniques: [flow-field, polar, noise-field]
primitives: [ellipse, shape]
palette:
  colors: ["#FB5D40", "#D48300", "#E5964B", "#008172", "#165253", "#1C1C1A", "#D8D8B9"]
  selection: random-from-list
composition: radial
parameters:
  - {name: cc, default: "int(random(20, 99))", tried: [25], change: large, effect: "fewer, sparser ribbons with much more white showing through"}
  - {name: steps, default: 1200, tried: [400], change: large, effect: "bands stop after ~1/3 of their length; shorter scalloped ribbons, same overall flow"}
  - {name: alpha, default: 40, tried: [120], change: large, effect: "bands ~3x more opaque; canvas almost fully covered, overlaps denser and more saturated"}
  - {name: max, default: "int(random(1, random(20)))", tried: [2], change: large, effect: "gentler steering: long, smooth, nearly parallel wood-grain bands instead of curled ribbons"}
  - {name: det, default: "random(0.01)", tried: [0.003], change: large, effect: "coarser noise scale: broader, slower undulations and a denser central swirl"}
reusable_candidates:
  - {name: noiseWalk, signature: "noiseWalk(x, y, steps, detail, offset, amplitude, startAngle) -> vertices", note: "per-step walker that steers by noise; initial heading blends out over ~10% of the walk"}
  - {name: ringSeeds, signature: "ringSeeds(cx, cy, radius, count) -> [x, y, angle][]"  , note: "points evenly placed on concentric rings as walker seeds"}
---

## What it draws
A full-bleed white canvas filled with long, flowing, semi-transparent bands of colour that all
originate from concentric rings around the canvas centre. Each band is a single thin black-outlined
stroke in one of seven muted colours (teals, oranges/tans, near-black, pale olive) at very low
opacity, so overlapping strokes build up into dense, wavy ribbons with a scalloped, layered texture.
Tiny hollow circles mark the start point of every band, arranged in neat circles, so the eye reads
the picture as radial: tight rings in the middle, long undulating ribbons sweeping diagonally to
the corners.

## How the code works
- `setup()` (oleone.pde:3) sizes 960×960 P2D, calls `generate()` once; `draw()` is empty, so the
  image is static. `keyPressed()` regenerates with a new seed (never used headless).
- `generate()` (oleone.pde:23): `randomSeed`/`noiseSeed(seed)`, white background, black stroke.
  All randomness enters here: `det = random(0.01)` (noise scale, :31), `des = random(1000)`
  (noise-space offset, :32), `cc = int(random(20, 99))` (points per ring, :34),
  `max = int(random(1, random(20)))` (noise amplitude multiplier, :36).
- Placement: outer loop `k = 1..7` makes 7 concentric rings of radius `ss = width*k*0.1`
  (:37-38); inner loop places `cc` points at equal angle `da*i` on the ring (:39-42).
- Each seed point gets a small filled circle `ellipse(xx, yy, ss*0.02, ss*0.02)` (:43) — the tiny
  hollow-looking dots visible along the rings (stroke 1px over a small fill).
- Band generation: per point, `dif = ang - (noise(...)*max) % TAU` (:46) gives an initial angular
  offset; then a 1200-step walker (:49-55) moves 1 px per step with heading
  `na = dd + noise(des+x*det, des+y*det)*max`, where `dd = dif*(1-constrain(j*0.01, 0, 1))`
  fades the initial offset to zero over the first 120 steps — so each ribbon starts roughly
  tangential to its ring and then drifts along the noise field, producing the long flowing curves.
- Colour: `fill(rcol(), 40)` (:47) picks a random colour from the 7-colour `colors[]` array
  (:68) with alpha 40/255; the `stroke(0)` at :29 gives the thin dark outline. The very low alpha
  is why bands look translucent and overlap builds the layered density. `getColor()`/`lerpColor`
  (:72-80) exist but are unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_25 | `int cc = int(random(20, 99));` -> `int cc = 25;` | large | sparser: far fewer ribbons per ring, lots of white, clear diagonal wave rows | variants/cc_25/frame_00001.png |
| steps_400 | `for (int j = 0; j < 1200; j++) {` -> `for (int j = 0; j < 400; j++) {` | large | bands are ~1/3 as long; short scalloped ribbons, same direction and density | variants/steps_400/frame_00001.png |
| alpha_120 | `fill(rcol(), 40);` -> `fill(rcol(), 120);` | large | ribbons much denser and more saturated; white background almost gone, heavy dark overlaps in the centre | variants/alpha_120/frame_00001.png |
| max_2 | `float max = int(random(1, random(20)));` -> `float max = 2;` | large | long, smooth, nearly parallel bands flowing corner to corner (wood-grain look); curls gone, teal/orange bands read solid | variants/max_2/frame_00001.png |
| det_0.003 | `float det = random(0.01);` -> `float det = 0.003;` | large | broader, slower undulations; wide smooth bands with a dense dark swirl in the centre | variants/det_0.003/frame_00001.png |

## Modularisation notes
- Generic: the per-seed noise walker (`dif` decay + per-step noise steering, :46-56) is a reusable
  `noiseWalk()` — parameterised by seed point, steps, noise detail/offset/amplitude and the
  fade-in length of the initial heading.
- Generic: even ring placement of seeds (`k` rings × `cc` points, :37-42) is a simple `ringSeeds()`.
- One-off art decisions: the fixed 7-colour muted palette, alpha 40, black 1px stroke, the
  `width*0.1` ring spacing, 1200-step length, and the `ss*0.02` seed dots.
- A clean parameter object: `{rings: 7, ringStep: 0.1, perRing: cc, steps: 1200, detail: det,
  offset: des, amplitude: max, palette, alpha: 40, seedDot: 0.02}`.
