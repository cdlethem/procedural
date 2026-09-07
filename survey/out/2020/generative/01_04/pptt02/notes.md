---
sketch: 2020/generative/01_04/pptt02
year: 2020
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1634
animated: false
techniques: [grid, distortion]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#000000"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(20,60))*4", tried: [400], change: large, effect: "much finer stripes; the centre knot becomes a dense grey aliasing texture"}
  - {name: amp, default: "random(20,80)", tried: [150], change: large, effect: "wobble amplitude far larger; stripes undulate strongly across the whole field, centre knot kept"}
  - {name: rot, default: "random(10)*random(0.4,1)", tried: [0], change: large, effect: "pinwheel twist disappears; stripes nearly straight with only the sine wobble and a faint central pinch"}
  - {name: osc1, default: "int(random(1,30)*random(1))", tried: [3], change: large, effect: "vertical wobble much longer and smoother (about 3 waves per canvas height); large S-curves dominate, central knot smaller"}
  - {name: colors, default: ["#FFFFFF", "#000000"], tried: [["#FFFFFF", "#000000", "#FF0000"]], change: large, effect: "red bands inserted in the white/black alternation; geometry unchanged"}
reusable_candidates:
  - {name: radialSwirl, signature: "radialSwirl(x, y, cx, cy, radius, strength) -> PVector", note: "rotates points about the centre by an amount growing toward the middle, pulling them inward (pptt02.pde L124-132)"}
  - {name: sineWarp, signature: "sineWarp(x, y, oscX, oscY, amp) -> PVector", note: "offset by cos/sine of the perpendicular coordinate, TAU-scaled (L134-136)"}
  - {name: stripedBands, signature: "stripedBands(count, bandColor) -> void", note: "paints N full-height vertical bands as QUAD_STRIPS sampled at 0.5 px through a warp function (L102-112)"}
---

## What it draws
Full-bleed field of dense, alternating black and white vertical stripes on white. The
stripes wobble sinusoidally along their length, and the whole field is twisted into a
strong pinwheel: near the centre the stripes compress, fold and converge into a small
dense knot, then fan back out toward the edges.

## How the code works
- `generate()` seeds the RNG with `seed` (L87-88), fills white (L89), then picks all the
  randomness for the run: `cc = random(20,60)*4` bands (L91), band width `ss = width/cc`
  (L92), `osc1`/`osc2` wave counts (L94-95), wobble amplitude `amp` in 20-80 (L96), and
  swirl strength `rot` (L98).
- One loop over band index `i` from -40 to cc+40 (L102-112): each band is a QUAD_STRIP
  whose vertices are sampled every 0.5 px vertically (L105); the two vertices of each row
  are the warped positions of `(i*ss, j)` and `((i+1)*ss, j)` via `def()` (L106-107).
  Bands are overdrawn well past the canvas so the warp pulls in enough material.
- `def()` (L116-137) is the whole distortion: inside radius `width*0.4` a point is
  rotated about the centre by an angle proportional to the distance from centre
  (`ang + PI*v2*rot`, L127-128) and pulled inward (`dist*v1*v1`, L127-131) — this is the
  pinwheel. Outside/always: `x += cos(TAU*y/width*osc1)*amp`, `y += sin(TAU*x/height*osc2)*amp`
  (L134-136) — the long-wavelength wobble of the stripes.
- Colour: one fill per band, `getColor(i+10)` (L103). `getColor` lerps between two
  adjacent palette entries (L160-165); with the 2-colour palette `{#FFFFFF, #000000}`
  and integer `v` the lerp factor is 0, so bands come out pure white or pure black,
  alternating.
- All randomness enters through `randomSeed(seed)`; with the harness seed the output is
  deterministic (`deterministic: true`).
- Renderer is P2D with `smooth(8)` (L17); `pixelDensity(2)` is requested but unavailable
  on the headless display (harmless warning).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| amp_150 | `amp = random(20, 80);` -> `amp = 150;` | large | wobble much stronger: stripes undulate with visibly larger amplitude across the whole field; the central knot is still present | variants/amp_150/frame_00001.png |
| rot_0 | `rot = random(10)*random(0.4, 1);` -> `rot = 0;` | large | pinwheel gone: the central twist knot disappears, stripes run nearly straight with the sine wobble and only a faint central pinch | variants/rot_0/frame_00001.png |
| cc_400 | `int cc = int(random(20, 60))*4;` -> `int cc = 400;` | large | stripes far finer; the central knot turns into a dense grey/aliased texture, edges stay fine straight lines | variants/cc_400/frame_00001.png |
| osc1_3 | `osc1 = int(random(1, 30)*random(1));` -> `osc1 = 3;` | large | vertical wobble is now long and smooth (~3 waves per canvas height); big S-shaped curves dominate, central knot smaller | variants/osc1_3/frame_00001.png |
| colors_3 | `int colors[] = {#FFFFFF, #000000};//, #02B59E, #DCE404, #82023B};` -> `int colors[] = {#FFFFFF, #000000, #FF0000};` | large | red bands appear between the white and black ones (white/black/red alternation); geometry identical to baseline | variants/colors_3/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: `def()`'s two stages (radial swirl + sine warp) are
  composition-independent warp functions; `stripedBands` (N vertical QUAD_STRIP bands
  sampled through any warp) is a reusable renderer; `getColor`'s lerp-between-palette
  is a small palette helper.
- One-off art decisions: the band count range 20-60 (*4), the overdraw margins
  (-40..cc+40, j from -200 to height+200), the 0.5 px sampling step, and the exact
  2-colour palette.
- A clean parameter object: `{bandCount, swirlStrength (rot), swirlRadius (0.4*width),
  oscX, oscY, amp, palette}` — everything else follows from canvas size.
