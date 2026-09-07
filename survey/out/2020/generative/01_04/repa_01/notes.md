---
sketch: 2020/generative/01_04/repa_01
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate, peasy]
deterministic: false
ms_first_frame: 1656
animated: false
techniques: [particles, noise-field, dots-stippling, pixel-ops]
primitives: [rect, pixels]
palette:
  colors: ["#FAFAFA", "#C8CBF4", "#EA77BA", "#EA0071", "#F71D04", "#301156", "#FFFF00"]
  selection: noise-driven
composition: radial
parameters:
  - {name: cc, default: 60000, tried: [20000], change: large, effect: "sparser, more blocky: individual squares visible, more black showing between blobs"}
  - {name: ringBand, default: "random(0.8, 1)", tried: ["random(0.2, 1)"], change: large, effect: "centre fills in: ring becomes a near-complete disc with a small off-centre hole"}
  - {name: displaceAmt, default: 300, tried: [0], change: large, effect: "ring collapses to the intersection of annulus and 0.42-width square: bright rounded-square border around a dark interior, grid streaks clearer"}
  - {name: alphaGain, default: 0.06, tried: [0.3], change: large, effect: "dense areas saturate to pure white; soft glow becomes hard, chunky masses"}
  - {name: gridGap, default: 50, tried: [off], change: subtle, effect: "no visible change"}
  - {name: palette, default: "6-colour pink/red/yellow set", tried: ["#072457 #EFA300 #CED1E2 #D66953"], change: large, effect: "same composition, hue shift to blue/amber/grey/salmon"}
reusable_candidates:
  - {name: radialScatter, signature: "radialScatter(count, innerFrac, outerFrac, gridGap, displaceField, displaceAmt) -> points", note: "area-uniform ring of points (d=sqrt(v)*R) with grid-line exclusion and 2-D noise displacement"}
  - {name: noisePaletteIndex, signature: "noisePaletteIndex(v, x, y, detail, offset) -> color", note: "index = v + noise(...)*len*5, lerp between adjacent palette entries with pow(frac, 0.3)"}
  - {name: subtractInvert, signature: "subtractInvert(drawFn)", note: "draw translucent marks with blendMode(SUBTRACT) on a light background, then filter(INVERT) for glowing-on-black"}
---

## What it draws
A black square filled with a rough ring of soft, blurred blobs made of thousands of small
overlapping rectangles. Dominant colours are hot magenta/pink and red, with bright yellow and
white clusters, plus a small olive-green patch lower-centre. The ring is broken and cloud-like,
with a dark hollow in the middle and faint linear streaks running through the blobs. The blobs
are densest in a mid-to-outer band, so the centre and corners stay black.

## How the code works
- `setup()` (line 24) calls `generate()` once; `draw()` is empty, so the piece is static
  (repeats on keypress only).
- `generate()` (line 60): `randomSeed(seed)`/`noiseSeed(seed)` (lines 68-69), off-white
  `background(250)` (line 71), translate to canvas centre (line 73). Note: `time = millis()*0.001`
  (line 62) leaks into `a = random(TAU)+time*0.01` (line 92), so renders are not fully
  deterministic even with a fixed seed.
- Loop of `cc = 60000` (line 82): `v = random(1)`, `d = sqrt(v)*width*0.5*random(0.8, 1)`
  (line 94) — sqrt makes points area-uniform, and the 0.8-1.0 factor pushes them into an annulus,
  giving the ring shape. Points outside a `width*0.42` square are dropped (line 102).
- Grid exclusion (line 104): any point within 1 px of a 50-px grid line is skipped, carving the
  faint dark linear streaks visible in the image.
- Noise displacement (lines 109-110): each point is offset by up to ±300 px along x and y by
  3-D simplex-ish `noise()` with detail `detDes ~ random(0.01)`, smearing the crisp ring into
  clouds.
- Size `ss = 2 + random(1.2)*v*60` (line 107): 2-62 px squares, drawn as `rect` inside a
  `beginShape(POINTS)` batched in 4096-vertex chunks (lines 87-91) for the P3D renderer.
- Colour (line 111): `getColor(v + noise(desCol + xx*detCol, desCol + yy*detCol)*colors.length*5)`
  picks a fractional index into the 6-colour palette (line 137) and lerps between two adjacent
  entries with `pow(v%1, 0.3)` (line 154) — noise-driven colour selection. Alpha is very low:
  `random(random(150), 260)*0.06` ≈ 0.01-0.16.
- `blendMode(SUBTRACT)` (line 86): translucent rectangles subtract from the light background,
  so dense overlap drives the canvas toward black while hue survives; final `filter(INVERT)`
  (line 118) inverts everything, producing the glowing-colours-on-black look.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_20000 | `int cc = 60000;` -> `int cc = 20000;` | large | sparser, more blocky: individual small squares clearly visible, more black between blobs, same ring shape | variants/cc_20000/frame_00001.png |
| ring_0.2 | `float d = sqrt(v)*width*0.5*random(0.8, 1);` -> `...random(0.2, 1);` | large | centre fills in: the blobs now cover a near-complete disc, the dark hollow shrinks to a small off-centre hole | variants/ring_0.2/frame_00001.png |
| displace_0 | both `*300` noise-displacement lines -> `*0` | large | the annulus is no longer smeared: a bright glowing rounded-square border (annulus clipped by the 0.42-width square) around a dark interior, with the 50-px grid streaks clearly visible | variants/displace_0/frame_00001.png |
| alpha_0.3 | `...260)*0.06);` -> `...260)*0.3);` | large | dense areas saturate to pure white; the soft glow becomes hard, chunky white masses with magenta/red/yellow rims | variants/alpha_0.3/frame_00001.png |
| grid_off | `if (abs(xx%50) < 1 || abs(yy%50) < 1) continue;` -> `if (false) continue;` | subtle | no visible change: same ring, same colours, same dark centre as baseline | variants/grid_off/frame_00001.png |
| palette_oil | `int colors[] = {#C8CBF4, #EA77BA, #EA0071, #F71D04, #301156, #ffff00};` -> `{#072457, #EFA300, #CED1E2, #D66953};` | large | identical composition; hues shift to deep blue, amber/yellow, light grey and salmon with white highlights | variants/palette_oil/frame_00001.png |

## Modularisation notes
- Generic: the radial-scatter + grid-exclusion + noise-displacement pipeline (lines 87-113) is a
  reusable "scattered stippled ring" generator; `getColor`/`getColor(float)` (lines 149-155) is a
  clean noise-driven palette-lerp; the SUBTRACT-then-INVERT trick is a one-line post-effect that
  converts any light-background stipple into glowing-on-black.
- One-off art decisions: the 50-px grid exclusion (invisible at default settings — see grid_off),
  the specific 6-colour palette (several commented-out alternates show it was iterated), the ±300
  displacement magnitude (the main driver of the cloud look), the 0.8-1.0 radius band, and the
  very low alpha.
- A clean parameter object would contain: `count`, `innerFrac`, `outerFrac` (ring band),
  `gridGap` (0 = off), `displaceDetail`, `displaceAmount`, `sizeMin`, `sizeMax`, `alphaGain`,
  `palette[]`, `detail`/`offset` for the colour noise.
