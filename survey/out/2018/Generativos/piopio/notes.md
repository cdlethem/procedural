---
sketch: 2018/Generativos/piopio
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2329
animated: false
techniques: [polar, symmetry, lines-hatching, distortion, shader]
primitives: [ellipse, line, shape]
palette:
  colors: ["#FE603C", "#242D3B", "#027ECB", "#E5B270", "#FD9EC8", "#FDD3C7"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: unit_count_cc, default: "random(120)*random(1)", tried: ["random(200)*random(1)"], change: large, effect: "many more, smaller overlapping units; dense multicolour field, background almost covered"}
  - {name: body_amp, default: 1.25, tried: [2.2], change: subtle, effect: "no visible change (0.1% of pixels); the squash is imperceptible at this scale"}
  - {name: star_segs_res, default: "random(18,60)", tried: ["random(4,10)"], change: subtle, effect: "star spikes coarsen into a few large blades on the collars and the giant right-side ring"}
  - {name: body_fill_alpha, default: 250, tried: [90], change: subtle, effect: "unit fills go translucent: gold disc paler, giant starburst softened, background shows through"}
  - {name: body_size_range, default: "random(1,14)", tried: ["random(1,6)"], change: large, effect: "body/star/centre shrink relative to the fixed halo disc; sparser look, more background visible"}
reusable_candidates:
  - {name: estrella, signature: "estrella(x, y, r1, r2, angle, seg, c1, c2)", note: "radial starburst ring of seg alternating 2-colour triangles between two radii"}
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, col, alp1, alp2)", note: "radial arc band of quads with alpha fading between the two radii"}
  - {name: squashedCircle, signature: "circle(x, y, s, ang, amp)", note: "4-segment bezier ellipse with one axis stretched by amp"}
  - {name: postFilter, signature: "filter(post.glsl)", note: "9-tap gaussian blend (50%), saturation/brightness/contrast boost, vignette, 4% grain, per-channel gamma"}
---

## What it draws
A flat, poster-like composition of two or three enormous "eye" motifs on a warm peach-to-pink
gradient. The most complete one sits bottom-left: a mustard-gold disc holding a cream squashed
ellipse with a black pupil, a thin black ring, a few small black dots, a fan of fine black radial
lines, and a collar of small alternating orange/blue star spikes. A second motif is zoomed so far
in that only its giant spike ring (cream and olive triangles) sweeps across the right edge, and a
third is reduced to a black dot with thin radiating lines at the top left. The whole image is
softened by a blur, gently vignetted at the corners and speckled with fine grain. Dominant colours:
peach/pink, mustard gold, cream.

## How the code works
`setup()` (piopio.pde:5) calls `generate()`; `draw()` is empty, so the image is static.
`generate()` (line 26):
- `cc = int(max(1, random(120)*random(1)))` (line 34) picks the unit count; with this seed it is
  very small, so `ss = width/cc` (line 35) makes each unit huge. The loop runs `cc*12` times
  (line 38) to overpaint the canvas.
- Per unit: random position `xx,yy` (39-40), random body size `s = ss*int(random(1,14))` (41),
  random rotation `a` quantised to 45 degrees (42), squash `amp = 1.25` (43).
- Layers, per unit: faint halo arc `arc2` at fixed radius `ss` (44); squashed body via `circle()`
  (121) — 4 bezier segments with kappa=4/3*(sqrt(2)-1), one axis stretched by `amp` — filled
  `rcol()` at alpha 250 (45-46); thin black outline arc (48-49); three `estrella()` star rings
  (102) at radii `s2+dd*j` with `res = int(random(18,60))` (53) spikes, each triangle alternating
  two random palette colours (57-58); cream centre ellipse `lerpColor(rcol(), 255, 0.5)` (60-61);
  fine white arc (63-64); inner detail loop `seg = int(random(7)*random(0.5,1))` (68) adding faint
  white ellipses, black dots (73, 77-79), small arcs and 40% chance of a fan of
  `ccc = int(random(2,10))` black radial lines (82-91); solid black pupil at fixed size `ss*0.3`
  (94-95).
- Colour: `rcol()` (261) picks uniformly from the 6-colour list (260); the `Fish` class (162-258)
  and its noise-driven `des/det` fields are dead code, never instantiated.
- Finish: `filter(post)` (98-99) — post.glsl blends a 9-tap gaussian at 50%, boosts
  saturation/brightness/contrast (`csb`, line 67), applies a radial vignette `dis` (line 65), adds
  4% per-pixel grain (line 68) and per-channel gamma r^1.1 / g^0.9 (lines 70-71).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_200 | `int cc = int(max(1, random(120)*random(1)));` -> `int cc = int(max(1, random(200)*random(1)));` | large | dense, busy field of many overlapping squashed units in pink, blue, orange and cream, each with a star collar and eye; background almost fully covered | variants/cc_200/frame_00001.png |
| amp_2.2 | `float amp = 1.25;` -> `float amp = 2.2;` | subtle | no visible change (only 0.1% of pixels differ; the stronger body squash is imperceptible) | variants/amp_2.2/frame_00001.png |
| res_4 | `int res = int(random(18, 60));` -> `int res = int(random(4, 10));` | subtle | star spikes coarsen: the bottom-left collar becomes a few large chunky orange/cream blades and the giant right-side ring becomes a few enormous olive/cream crescents | variants/res_4/frame_00001.png |
| alpha_90 | `fill(rcol(), 250);` -> `fill(rcol(), 90);` | subtle | unit fills go translucent: the gold disc is paler washed-out gold and the giant starburst is softer, with the pink background showing through the spikes | variants/alpha_90/frame_00001.png |
| size_6 | `float s = ss*int(random(1, 14));` -> `float s = ss*int(random(1, 6));` | large | body, star collars and centre details shrink relative to the fixed-radius halo discs; composition looks sparser with much more of the peach/blue background visible | variants/size_6/frame_00001.png |

Note: `data/post.glsl` is not a `.pde` tab, so `render.py --sub` cannot modify the post shader
(blur/vignette/grain strengths were left at their defaults).

## Modularisation notes
- Generic: `estrella` (alternating radial star ring), `arc2` (radial band with per-end alpha),
  `circle` (bezier squashed ellipse), `rcol`/`getColor` (random/lerped palette sampling),
  post.glsl (soften + saturate + vignette + grain post filter).
- One-off art decisions: the "eye" layer recipe (halo -> squashed body -> star collar -> cream
  centre -> white arc -> inner dots/line fan -> black pupil), and the `cc` count formula
  (`random(120)*random(1)`, whose product skews hard to very few, very large units — the defining
  look of this sketch, as the cc experiment confirms).
- Fixed-vs-scaled split matters: halo disc and pupil are sized from `ss` while body/star/centre are
  sized from `s = ss*int(random(...))`; the two ratios (unit count and size range) are the dominant
  parameters, while squash and fill alpha are nearly invisible at default scale.
- Clean parameter object: `{seed, unitCount, sizeRange (x*ss), bodyAmp, starRings, starSegRange,
  palette, fillAlpha, innerFanChance, background, post: {blurMix, satBoost, vignette, grain}}`.
