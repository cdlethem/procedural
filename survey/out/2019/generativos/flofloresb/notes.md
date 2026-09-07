---
sketch: 2019/generativos/flofloresb
year: 2019
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2078
animated: false
techniques: [polar, lines-hatching, dots-stippling, blend-modes, scattered]
primitives: [line, ellipse, shape]
palette:
  colors: ["#EA449F", "#EFACDB", "#F2A63C", "#CC0A10", "#0F3D99"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 60, tried: [120], change: large, effect: "double the flowers; same big fan, more small/medium ones filling gaps"}
  - {name: sub, default: "PI*(s/2)^2*random(0.2)*random(0.6,1)", tried: ["PI*(s/2)^2*random(0.8)*random(0.6,1)"], change: large, effect: "4x spokes; fans become dense solid discs of hatching covering most of canvas"}
  - {name: spokeAlpha, default: "random(10,50)*random(1.2)", tried: ["random(40,90)"], change: large, effect: "spokes opaque; each fan becomes a solid filled fan, two giant fans dominate frame"}
  - {name: background, default: 10, tried: [210], change: large, effect: "light grey ground; fans read pale/washed, dark glow lost, discs pop against light bg"}
  - {name: amp2, default: "s*0.5", tried: ["s*0.9"], change: large, effect: "fans 1.8x longer; golden spokes fill whole canvas around unchanged discs"}
reusable_candidates:
  - {name: radialBurst, signature: "radialBurst(x, y, r1, r2, spokes, palette) -> void", note: "fan of radial lines from inner radius to outer radius with dots at outer ends"}
  - {name: lerpPalette, signature: "getColor(palette, v) -> color", note: "lerp between adjacent palette entries by squared fractional part"}
---

## What it draws
Near-black background (dark grey, value ~10) with dozens of scattered "flower" or "medusa" motifs of very
different sizes. Each motif is a soft central disc (pink, orange, red, or blue) with a small white centre
dot and a smaller coloured dot on top, surrounded by a dense fan of thin radial lines (hatching) that fade
outward, with tiny specks of dots at the line ends. One enormous motif dominates the upper-right half:
a huge golden-amber radial fan over a pale cream disc, with several smaller pink/red/blue flowers nested
inside it. The overall look is like a night-sky field of glowing sea anemones.

## How the code works
`setup()` -> `generate()` (flofloresb.pde L21-29, L52). Randomness: `randomSeed(seed)`, `noiseSeed(seed)`
(L54-55); `seed` is a `seed`-field the harness sets (L4). Background `background(10)` (L60).

Main loop (L64-119) places 60 flowers:
- **Size** (L66): `s = width*random(0.18,0.4)*random(0.9,1)*random(0.2,1)*6*random(1)^3` — the three
  `random(1)` multipliers make most flowers tiny and a few (like the big golden one) large; the heavy
  tail of this product is what creates the size hierarchy.
- **Position** (L68-72): random within `[b, width-b]` where `b = 0.4*s`, then snapped to a 10-px grid
  (`x -= x%10`).
- **Disc** (L86-87): `fill(getColor())` (lerp between two adjacent palette entries, L160-166),
  ellipse of diameter `1.8*amp1`, where `amp1 = s*random(0.1,0.4)` (L83).
- **Rim** (L88, L122-139): `arc2()` draws a full conical ring of ~100 quad slices from radius
  `0.6*amp1` to `0.9*amp1` with alpha ramping 0 -> 30 (a soft halo).
- **Spokes** (L90-108): `sub = int(PI*(s/2)^2 * random(0.2) * random(0.6,1))` lines (L82) — area-scaled
  count, so big flowers get far more spokes. Each iteration (L93-97) picks a blend mode: 50% NORMAL,
  25% SUBTRACT, 25% ADD. A line is drawn from radius `amp1` to `amp2 = 0.5*s` (L84, L104) in a random
  direction, stroked in a random palette colour at alpha ~10-50 (L103). A 0.5-2 px dot at the outer end
  (L107) is filled with the spoke colour lerped toward black (L106). The per-line blend modes plus the
  low alpha are what make the fans glow/gold where they overlap.
- **Centres** (L115-118): white ellipse `0.26*amp1` then a palette-coloured dot `0.2*amp1` at the centre.

Palette (L152): {#EA449F, #EFACDB, #F2A63C, #CC0A10, #0F3D99} (pinks, orange, red, blue); `rcol()`
(L154-156) picks a random entry. The toxiclibs/triangulate imports (L1-2) are unused. Renderer P2D with
`smooth(8)`, `pixelDensity(2)` (L17-18). Static: `draw()` empty (L31-32).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_120 | `for (int i = 0; i < 60; i++) {` -> `... i < 120 ...` | large (mean 0.2641, 78% px) | double the flowers; the same big golden fan stays in place, gaps filled with more small/medium blue, orange, red, pink flowers; composition denser | variants/count_120/frame_00001.png |
| sub_0.8 | `int sub = int(PI*pow(s*0.5, 2)*random(0.2)*random(0.6, 1));` -> `...random(0.8)...` | large (mean 0.2824, 74% px) | 4x spokes: fans turn from sparse hatching into dense solid fans (yellow, magenta, red, blue) that cover most of the canvas; discs remain visible | variants/sub_0.8/frame_00001.png |
| alpha_90 | `stroke(str, random(10, 50)*random(1.2));` -> `stroke(str, random(40, 90));` | large (mean 0.2768, 79% px) | spokes opaque: the two largest fans become solid filled fans (red left, gold right) filling the frame; small flowers barely visible | variants/alpha_90/frame_00001.png |
| bg_210 | `background(10);//random(255));` -> `background(210);//...` | large (mean 0.467, 68% px) | light grey background; big fan reads pale cream with faint golden hatching, discs pop in pink/red/orange/blue; night-glow character lost | variants/bg_210/frame_00001.png |
| amp2_0.9 | `float amp2 = s*0.5;` -> `float amp2 = s*0.9;` | large (mean 0.1845, 63% px) | spokes reach 0.9*s: fan halo 1.8x longer, long golden spokes fill the whole canvas behind the unchanged discs; same flower layout | variants/amp2_0.9/frame_00001.png |

## Modularisation notes
- **Generic**: `radialBurst()` — the spokes block (L90-108) is a self-contained "radial fan from r1 to
  r2 with N area-scaled lines, per-line random blend mode, dots at ends" and would make a clean library
  primitive. `arc2()` (L122-139) is a generic conical alpha-gradient ring. `getColor()` (L160-166) is a
  reusable adjacent-entry lerp palette sampler.
- **One-off art decisions**: the heavy-tailed size formula (L66, three `random(1)` multipliers), the
  10-px grid snap (L71-72), the specific blend-mode odds (50/25/25), background value 10, and the
  white-then-coloured centre dot pair (L115-118).
- **Parameter object**: {count, sizeBase, sizeTailExponents[], minRadiusFrac, gridSnap, amp1Frac,
  amp2Frac, spokeDensity, spokeAlphaRange, dotSizeRange, blendOdds{normal,subtract,add}, palette,
  backgroundColor}.
