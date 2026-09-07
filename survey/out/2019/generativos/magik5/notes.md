---
sketch: 2019/generativos/magik5
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1622
animated: false
techniques: [noise-field, particles, lines-hatching]
primitives: [line, shape]
palette:
  colors: ["#01EEBA", "#E8E3B3", "#E94E6B", "#F08BB2", "#41BFF9", "#E4E6E4"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: streams, default: 40, tried: [12], change: moderate, effect: "fewer, thinner, more spread-out ribbons; background shows through more"}
  - {name: steps, default: "random(1000,10000)*random(1)*random(1)", tried: ["random(200,2000)*random(1)*random(1)"], change: moderate, effect: "shorter trails: fans collapse into a tangle of short straight hairlines"}
  - {name: vel, default: 0.071, tried: [0.35], change: moderate, effect: "walkers travel farther; fans are wider and more spread out"}
  - {name: amp, default: 1.0, tried: [3.0], change: moderate, effect: "stronger noise turning; fans grow larger, wavier, near-full-bleed"}
  - {name: trailAlpha, default: 20, tried: [80], change: none, effect: "no visible change (trail segments are ~0.1 px, subpixel)"}
  - {name: palette, default: "[#01EEBA,#E8E3B3,#E94E6B,#F08BB2,#41BFF9]", tried: ["[#FFB200,#FF6D24,#AC2239,#93B6E7,#866698]"], change: large, effect: "warm palette: orange/vermilion/maroon/periwinkle/mauve replace mint/pink/blue"}
reusable_candidates:
  - {name: flowRibbon, signature: "flowRibbon(x, y, steps, vel, noiseDetail, noiseAmp, palette, colorDrift) -> void", note: "walker advected by 2-D simplex noise drawing one line per step; pair two walkers to sweep a ribbon fan"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], v) -> color", note: "wraparound lerp between adjacent palette entries (getColor, L186-192)"}
---

## What it draws
A full-bleed chaotic composition on a pale grey-green background: large translucent
fan/wedge-shaped ribbons of fine parallel lines in mint-teal, coral-pink and blue,
crossed by a few thin straight hairlines. The ribbons have a fine striped texture and
fade from saturated palette colours toward dark/brown at their trailing edges.
Static: `draw()` is empty; frames 10/60 are identical to frame 1.

## How the code works
`setup()` sizes 960x960 P2D, loads an unused shader `post.glsl` (the `filter(post)`
call is commented out, L147-148), then calls `generate()`. `generate()` (L43-149)
seeds `randomSeed(seed)`, fills the background `#E4E6E4` (L46), and runs one pass of
40 streams (L77).

Each stream picks two start points (L80-83) that are pulled toward each other by
`smooth = random(1)*random(1)` (L76, L89-92), plus per-walker noise parameters:
detail `det1/det2 = random(0.2)*random(1)*random(1)` (L84, L86), noise domain
`des1/des2 = random(1000)` (L85, L87), amplitude `amp1/amp2 = random(10)*amp` with
`amp = random(1)` (L94-96), a slow palette-drift rate `dc1/dc2 ~ random(0.002)*...`
(L99, L101) and start colour index `ic1/ic2 = random(colors.length)` (L98, L100).

The inner loop runs `lar = random(1000, 10000)*random(1)*random(1)` steps (L107).
Per step: (1) draw a LINES segment between the two walkers (L111-116) stroked with
`lerpColor(getColor(ic+dc*i), black, cos(i*PI*0.1)*0.08+0.08)` — the cosine term
(0..0.16) makes visibility pulse periodically, producing the fine striped texture;
`getColor(v)` (L186-192) interpolates between adjacent palette entries so the colour
cycles slowly through the 5-colour palette as `i` grows. (2) advance each walker by
`vel = 0.071*random(0.8, 2)` px along a direction
`desAng + SimplexNoise.noise(des + pos*det)*TAU*amp` (L118-128) — a 2-D simplex
noise flow field. (3) draw faint trail segments behind each walker: white
`stroke(255,20)` at walker 1, black `stroke(0,30)` at walker 2 (L131-136), skipped
on the last two steps.

Because both walkers start close together and diverge, the per-step connecting lines
sweep out the large translucent fans. The `stars` ArrayList is never populated (L109),
so the `arc2` loop (L139-144) draws nothing; `arc2` (L156-174) is dead code here.
Only `SimplexNoise` (toxiclibs) is used; all randomness comes from Processing's
seeded `random()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| streams_12 | `for (int j = 0; j < 40; j++) {` -> `for (int j = 0; j < 12; j++) {` | moderate (0.1378, 0.541) | fewer, thinner, more spread-out ribbons; much more background visible | variants/streams_12/frame_00001.png |
| lar_2000 | `float lar = random(1000, 10000)*random(1)*random(1);` -> `float lar = random(200, 2000)*random(1)*random(1);` | moderate (0.1201, 0.478) | shorter trails: walkers barely diverge, so the big fans shrink into a dense tangle of short straight hairlines | variants/lar_2000/frame_00001.png |
| vel_0.35 | `float vel = 0.071*random(0.8, 2);` -> `float vel = 0.35*random(0.8, 2);` | moderate (0.1428, 0.529) | same structure, different layout: fans are wider and more spread out across the canvas | variants/vel_0.35/frame_00001.png |
| amp_3 | `float amp = random(1);` -> `float amp = random(3);` | moderate (0.0793, 0.268) | stronger noise turning: fans grow much larger with wavier edges, covering nearly the whole canvas | variants/amp_3/frame_00001.png |
| trail_80 | `stroke(255, 20);` -> `stroke(255, 80);` | none (0.0002, 0.0) | no visible change — trail segments are ~0.1 px per step (subpixel), so the alpha change is invisible | variants/trail_80/frame_00001.png |
| palette_warm | `int colors[] = {#01EEBA, #E8E3B3, #E94E6B, #F08BB2, #41BFF9};` -> `{#FFB200, #FF6D24, #AC2239, #93B6E7, #866698}` | large (0.1727, 0.598) | identical layout, recoloured: orange/vermilion/maroon/periwinkle/mauve replace mint/coral/blue | variants/palette_warm/frame_00001.png |

## Modularisation notes
- Generic: the two-walker noise-field trace (seed, step count, velocity, noise
  detail/amp, trail on/off) is a self-contained "dual flow-field ribbon" generator;
  `getColor(v)` (palette lerp with wraparound, L186-192) and the pulsing
  lerp-to-black stroke are reusable helpers.
- One-off art decisions: pulling start points together with a random `smooth` lerp,
  the `cos(i*PI*0.1)` visibility pulse, the fixed 5-colour palette, white/black
  trail asymmetry, 40 streams.
- Parameter object: {seed, streams, steps, vel, noiseDetail, noiseAmp,
  startCoupling, colorDrift, trailAlpha, palette}.
