---
sketch: 2018/Generativos/pelones
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1904
animated: false
techniques: [flow-field, noise-field, particles]
primitives: [line, ellipse, arc, shape, pgraphics]
palette:
  colors: ["#3991BF", "#416DA2", "#9C6F92", "#43A474", "#ADCEBE"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: ballCountMult, default: "random(20,120)*0.2", tried: ["*1.0"], change: moderate, effect: "~5x ball count; canvas fills with overlapping balls of all sizes"}
  - {name: ballMaxSize, default: "0.2*width", tried: ["0.4*width"], change: moderate, effect: "same count, 2x larger balls; several huge discs, dashed rings scale up"}
  - {name: blobCount, default: 120, tried: [300], change: moderate, effect: "2.5x cream circles merge into a bigger mass; top-left filament tangle spreads (larger white mask area)"}
  - {name: blobMaxSize, default: "0.4*width", tried: ["0.8*width"], change: moderate, effect: "circles up to 2x larger; top-left tangle grows and reads as long grey hair"}
  - {name: flowFillAlpha, default: 120, tried: [255], change: none, effect: "no visible change; dense line overlap already saturates the tangle"}
  - {name: grainMaxSize, default: "random(2)", tried: ["random(6)"], change: moderate, effect: "3x larger black speckles; grain clearly visible across the canvas"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, color, alp1, alp2)", note: "soft ring as filled wedges with radial alpha gradient"}
  - {name: maskedFlowField, signature: "maskedFlowField(mask, count, steps, detail, amplitude) -> shapes", note: "noise flow lines that break when entering dark pixels of an offscreen mask"}
  - {name: proximityWeb, signature: "proximityWeb(points, maxDist, color, alpha)", note: "tiny dots plus faint lines between nearby point pairs"}
---

## What it draws
Full-bleed composition on a muted green ground. A cluster of large soft cream circles dominates the centre and right; the top-left holds a dense tangle of curly hair-like filaments in teal, blue, green and off-white. Scattered over the canvas are circular "balls": off-white discs with a dashed dark ring, a small coloured centre dot (blue or green) and faint concentric ripples. A fine black speckle grain covers everything, and a faint web of thin white lines connects nearby points, most visible on the right where the cream circles are sparse.

## How the code works
Static one-shot: `setup()` (pelones.pde:3-9) sizes 960² P2D and calls `generate()` once; `draw()` is empty.
- `background(rcol())` (pelones.pde:27) picks one of 5 palette colours (105).
- Proximity web (pelones.pde:29-47): 1000 random points, each drawn as a tiny white dot; every pair closer than `maxDis=50` (33) gets a `stroke(255,30)` line (34) — the faint white web.
- Quad wash (pelones.pde:51-59): one closed 4-vertex shape covering the whole canvas with a different `rcol()` at `random(240)` alpha at opposite corners (53, 56); per-vertex fill blends two palette colours over the background.
- `olas()` (olas.pde): 120 random points, sizes up to `0.4*width` (4-6). An offscreen PGraphics (8-17) is a black mask with white ellipses at half position/size (top-left quadrant). 120 `#F0EEEB` ellipses at the original positions (28-32) form the big cream circles. 40000 flow lines (35-51) start at random points, step 1 px for up to 20 steps along an angle from `noise` (43-44, amplitude `pow(noise,4)*PI*8`), and `break` when they land on a dark mask pixel (47) — so the visible filaments are confined to the top-left where the white mask blobs are. Each line is filled `rcol()` at alpha 120 with `stroke(0,60)`. Finally `arc2` (56) overlays a fading white ring on each cream circle.
- `balls()` (balls.pde): `cc = int(random(20,120)*0.2)` → 4-23 balls (6). Per ball: two soft coloured `arc2` rings (19-20), a white inner ring (34), random dashed dark arc segments (37-45, `stroke(0,200)`), a small white ring (47), a coloured centre ellipse at alpha 240 (48-49), and 10 concentric white ripple ellipses fading outwards (53-58).
- Grain (pelones.pde:65-74): 40000 black dots, size `random(2)*noise(...)` (72) — the speckle over everything.
- `arc2` (pelones.pde:82-100) draws a ring as a strip of filled quads from radius s1 to s2 with alpha alp1→alp2 (soft radial fade).
- Colour: `rcol()` is a uniform random pick from the 5-colour list (106-108).
- `//pelos();` (pelones.pde:49) is commented out; the top-left filaments come from `olas()`, not `pelos()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ballcount_1.0 | `int cc = int(random(20, 120)*0.2);` -> `*1.0;` | moderate | ~5x more balls, spread across the whole canvas, many overlapping; top-left tangle and grain unchanged | variants/ballcount_1.0/frame_00001.png |
| ballsize_0.4 | `..., width*random(0.2)));` -> `width*random(0.4)` | moderate | same ball count but 2x bigger; a few huge off-white discs with big dashed rings and coloured centres | variants/ballsize_0.4/frame_00001.png |
| olacount_300 | `for (int i = 0; i < 120; i++) {` -> `i < 300` | moderate | 2.5x more cream circles merging into one large central mass; top-left filament tangle extends further right (bigger white mask) | variants/olacount_300/frame_00001.png |
| olassize_0.8 | `width*random(0.4)*random(1)` -> `width*random(0.8)*random(1)` | moderate | cream circles up to 2x larger; top-left tangle grows substantially and reads as long grey hair over the circles | variants/olassize_0.8/frame_00001.png |
| flowalpha_255 | `fill(rcol(), 120);` -> `fill(rcol(), 255);` | none | no visible change (tangle looks at most marginally more saturated; score says none) | variants/flowalpha_255/frame_00001.png |
| grainsize_6 | `float ss = random(2)*noise(...)` -> `random(6)*noise(...)` | moderate | 3x larger black speckles; grain becomes a prominent texture over every element | variants/grainsize_6/frame_00001.png |

## Modularisation notes
- `arc2` is fully generic: a "soft ring with radial alpha gradient" primitive, parameterised by radii, angle span, colour and endpoint alphas. Strong library candidate.
- The olas flow-field is a reusable pattern: flow lines that die on a mask (offscreen PGraphics, brightness threshold). The mask itself is one-off (random blobs at half scale in the top-left quadrant) and is the main art decision, as is the half-position placement.
- The proximity web and the grain pass are both generic and self-contained.
- `pelos()` is dead code (called nowhere) but is a second, independent flow-field variant (120 steps, `vel=4`, no mask) that could be kept as a library function.
- A clean parameter object: `{palette, ballCount, ballMaxSize, blobCount, blobMaxSize, flowLineCount, flowSteps, flowAlpha, grainCount, grainMaxSize, webPointCount, maxDis, maskScale}`.
