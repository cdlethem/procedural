---
sketch: 2019/generativos/floflores
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2433
animated: false
techniques: [polar, lines-hatching, dots-stippling, blend-modes]
primitives: [ellipse, line, shape]
palette:
  colors: ["#EA449F", "#EFACDB", "#F2D091", "#BF052A", "#214CA2"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 90, tried: [45, 180], change: large, effect: "45 -> sparser scene, more black space (moderate); 180 -> canvas fully covered, additive white-pink wash (large)"}
  - {name: amp2, default: "s*0.5", tried: ["s*1.0"], change: moderate, effect: "spokes extend twice as far: wide halo detached from small core disc"}
  - {name: sub, default: "random(0.2)", tried: ["random(0.05)"], change: large, effect: "fewer spokes per flower; also shifts the random stream, re-randomising most of the composition"}
  - {name: lineAlpha, default: "random(10,50)", tried: ["*0.2"], change: large, effect: "spokes ~5x fainter: fine dust of thin speckles, weaker additive washes; stream shift re-randomises spoke angles"}
  - {name: palette, default: "warm 5-colour", tried: ["cool 5-colour"], change: large, effect: "identical layout, colours swapped to blues/teal/pale cream on black"}
reusable_candidates:
  - {name: arcRing, signature: "arcRing(x, y, r1, r2, a1, a2, color, alphaIn, alphaOut, segs)", note: "conic-gradient ring as quad fan with per-vertex alpha (arc2, line 125)"}
  - {name: radialBurst, signature: "radialBurst(x, y, rInner, rOuter, nLines, lineAlpha, dotSize)", note: "random-angle spokes from rInner to rOuter with terminal dot, blend-mode randomised (loop lines 93-111)"}
---

## What it draws
About ninety flower-like bursts scattered over a near-black background. Each burst is a
semi-transparent coloured disc (pink/magenta, blue-purple, red, yellow) surrounded by a dense
radial starburst of very thin spokes running from the disc edge outward to a larger radius,
with a small bright dot at the exact centre. Spokes of overlapping bursts mix through add/subtract
blending, producing whitish and bluish halos where they cross. Sizes vary from large dominant
flowers (~40% of the canvas) to small specks, and the whole composition is randomly scattered
with positions snapped to a 10 px grid.

## How the code works
Static single-pass sketch: `setup()` calls `generate()` once; `draw()` is empty, so frames
1/10/60 are identical (result.json `dropped_frames`). `generate()` (line 52) seeds
`randomSeed`/`noiseSeed` from `seed`, paints `background(10)` (near-black), then loops `i < 90`
(line 64).

Per flower (lines 69-121):
- Radius `s` (line 69): product of several `random()` terms, roughly `width * (0.18..0.4) * small
  factors`, giving a heavy-tailed mix of large and tiny flowers.
- Position (lines 71-75): random inside a margin `b = s*0.2`, snapped to a 10 px grid
  (`x -= x%10`).
- Core disc (lines 89-90): filled ellipse of size `amp1*1.8`, `amp1 = s*random(0.1, 0.4)`,
  colour from `getColor()` — a `lerpColor` between two adjacent palette entries (line 162).
- Gradient ring (line 91, `arc2` line 125-142): a `beginShape(QUADS)` fan of ~`cc` segments
  sweeping the full TAU, vertices at radius `amp1*0.6` with alpha ~0-40 and radius `amp1*0.9`
  with a second alpha; this produces the soft semi-transparent halo/disc look.
- Spoke burst (lines 93-111): `sub = PI * (s/2)^2 * random(0.2)` iterations (area-scaled line
  count). Each iteration: random blend mode (NORMAL / SUBTRACT / ADD, lines 96-100), a thin
  line (alpha `random(10,50)`) from radius `amp1` to `amp2 = s*0.5` at a random angle
  (line 107), plus a tiny dot (size `random(2)`) at the outer end, colour lerped toward black
  (lines 109-110). Because angles are random but all spokes share the same two radii, the
  result is the dense circular starburst.
- Centre (lines 116-121): a small white disc and a smaller palette-coloured disc on top.

Palette (line 154) is a fixed 5-colour list, picked randomly by `rcol()` (line 156) or
lerped by `getColor()` (line 162). No noise field is actually sampled (toxi import is unused);
all randomness is `random()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_45 | `for (int i = 0; i < 90; i++)` -> `for (int i = 0; i < 45; i++)` | moderate | sparser scene: about half the flowers, more visible black background, each starburst reads separately | variants/count_45/frame_00001.png |
| count_180 | `for (int i = 0; i < 90; i++)` -> `for (int i = 0; i < 180; i++)` | large | canvas fully covered by overlapping bursts; ADD blending washes large areas into white/pink haze, individual flowers hard to separate | variants/count_180/frame_00001.png |
| amp2_1.0 | `float amp2 = s*0.5;` -> `float amp2 = s*1.0;` | moderate | spokes reach twice as far: bursts become wide halos detached from their small core discs, reading as big starbursts with tiny centres | variants/amp2_1.0/frame_00001.png |
| sub_0.05 | `int sub = int(PI*pow(s*0.5, 2)*random(0.2));` -> `...random(0.05));` | large | fewer spokes per flower; because the line count changes how many random draws each flower consumes, most of the composition is re-randomised and a fine web of thin lines covers most of the background | variants/sub_0.05/frame_00001.png |
| linealpha_0.2 | `stroke(str, random(10, 50)*random(1));` -> `stroke(str, random(10, 50)*0.2);` | large | spokes much fainter (alpha ~2-10 vs 10-50): bursts read as fine dust of thin speckles and the additive washes are weaker; removing one random(1) call per line shifts the random stream, so spoke angles and downstream flowers are re-randomised while the overall layout stays similar | variants/linealpha_0.2/frame_00001.png |
| palette_cool | `int colors[] = {#EA449F, #EFACDB, #F2D091, #BF052A, #214CA2};` -> `{#214CA2, #3080E9, #50E2C6, #F0C7C0, #F7D3C3};` | large | identical layout (palette touches no random draws); all colours swapped to blues/teal/pale cream on black — the style reads as "night sky" instead of warm flowers | variants/palette_cool/frame_00001.png |

## Modularisation notes
- `arc2()` is a clean, generic conic-gradient ring (quad fan with per-vertex alpha);
  parameterised by (center, r1, r2, a1, a2, colour, alpha1, alpha2, segments). Direct library
  candidate.
- The spoke-burst loop (lines 93-111) is the core visual: a `radialBurst` with area-scaled
  count, random per-line blend mode, and terminal dots is a self-contained generator worth
  extracting.
- The flower assembler (lines 69-121) is the one-off art decision: radius distribution
  (`s` product of randoms), grid snapping, core-disc/ring/burst/centre layering.
- A clean parameter object: `{ count, radiusRange, margin, ringAlpha, burstDensity, burstSpan,
  lineAlpha, centerDotScale, palette, blendModes }`.
- `import toxi.../triangulate` are vestigial; the sketch is plain 2D.
