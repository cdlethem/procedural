---
sketch: 2018/Generativos/bbballs
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1812
animated: false
techniques: [grid, polar]
primitives: [shape]
palette:
  colors: ["#DE552D", "#539670", "#E6832E", "#8CAB33", "#DC738A", "#EAB033", "#2690DC", "#EFEDEE", "#242E53", "#08080A"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: "random(10000)*random(0.1,1)", tried: ["random(10000)*random(0.1,0.25)"], change: large, effect: "far fewer circles; large sparsely scattered discs, lots of empty background"}
  - {name: sizeExponent, default: 0.8, tried: [2.0], change: large, effect: "circles much larger on average; canvas nearly fully covered, very few tiny dots"}
  - {name: sectorRoll, default: "random(5)", tried: ["random(2)"], change: large, effect: "only 2-sector (halved) and solid discs; no quartered discs"}
  - {name: haloAlpha, default: 8, tried: [30], change: subtle, effect: "faint grey halo behind each disc slightly more visible; otherwise same"}
  - {name: palette, default: "10-colour warm/mixed list", tried: ["5-colour cool list"], change: large, effect: "same composition, recoloured navy/steel/light-blue/off-white/red"}
reusable_candidates:
  - {name: pieDisc, signature: "pieDisc(x, y, s, sectors, palette) -> void", note: "circle split into N random-angle sectors, each a random palette colour"}
  - {name: softHalo, signature: "softHalo(x, y, innerR, outerR, alpha) -> void", note: "arc2(): low-alpha filled ring behind a disc, drawn as radial trapezoid quads"}
---

## What it draws
A dense full-bleed mosaic of flat circles in 10 saturated colours (orange, green, pink, navy,
yellow, red, blue, black, off-white) on a light off-white background. Most circles are split into
2–4 pie sectors of different colours; many sit half-hidden under larger neighbours. Each disc has a
very faint grey halo ring slightly larger than itself, giving a soft cut-paper depth. Circle sizes
range from ~240 px down to a few pixels, with many small ones.

## How the code works
`setup()` (lines 3–8) sizes the canvas 960×960 P2D, then calls `generate()` once; `draw()` is empty
(line 11) so the piece is static.

`generate()` (lines 22–60):
1. `background(rcol())` (line 23) — random palette colour as background.
2. `cc = int(random(10000)*random(0.1, 1))` (line 25) — circle count, ~100–9999.
3. Loop (lines 26–59): size `ss` is a power-of-two ladder, `width/2^k` with
   `k = round(map(pow(i/cc, 0.8), 0, 1, 2, 8))` (line 27), so early circles are large and later
   ones shrink. Position is `random(width*1.5)` snapped to the size grid (`xx -= xx%ss`, lines
   28–31), so circles align to their own size lattice and can stick out beyond the edges.
4. `arc2(...)` (line 33) draws the halo: a ring from radius `ss/2` to `ss*0.75` filled black at
   alpha 8 (`arc2` lines 62–80 tessellates the ring into trapezoid quads around the circle).
5. A random sector count `rnd = int(random(5))` (line 35) picks the look: `rnd==1` → horizontal
   halves, `rnd==2` → vertical halves, `rnd==3` → four quarters, `rnd==0/4` → solid disc (each
   sector gets a fresh `rcol()`, lines 36–58). Overlap order is draw order: later (smaller)
   circles paint on top.

Colour is `rcol()` (lines 91–93), uniform random from the 10-colour `colors[]` (line 90).
Randomness enters only via `random()` calls; the harness sets the seed, so output is deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_0.25 | `int cc = int(random(10000)*random(0.1, 1));` -> `...random(0.1, 0.25));` | large | sparser field: big discs stand out, much more empty off-white background, fewer small circles | variants/count_0.25/frame_00001.png |
| sizepow_2.0 | `...pow(map(i, 0, cc, 0, 1), 0.8)...` -> `...2.0...` | large | same density but discs much larger; canvas nearly covered, few tiny dots | variants/sizepow_2.0/frame_00001.png |
| sectors_2 | `int rnd = int(random(5));` -> `int(random(2));` | large | discs only whole or split in two (halved); no quartered discs | variants/sectors_2/frame_00001.png |
| halo_alpha_30 | `arc2(xx, yy, ss, ss*1.5, 0, TWO_PI, color(0), 8, 0);` -> `..., 30, 0);` | subtle | soft grey halo ring around each disc slightly more visible; no other change | variants/halo_alpha_30/frame_00001.png |
| palette_cool | `int colors[] = {#DE552D, ...10 colours...};` -> `{#1D3557, #457B9D, #A8DADC, #F1FAEE, #E63946};` | large | identical layout recoloured: navy, steel blue, pale blue, off-white, red; red discs dominate | variants/palette_cool/frame_00001.png |

## Modularisation notes

- `arc2` (lines 62–80) is a generic soft-ring/halo primitive: radial trapezoid tessellation of an
  annulus with per-side alpha; reusable for shadows/glows around any circular element.
- The sectorised-disc logic (lines 35–58) is a clean `pieDisc(x, y, s, nSectors, palette)` candidate;
  the four hard-coded angle splits (halves, vertical, quarters, whole) are the one-off art decisions
  worth parameterising (e.g. random cut angles instead of fixed ones).
- The power-ladder size + size-grid snapping (lines 27–31) is a compact "multi-scale grid scatter"
  generator: a parameter object would need `count`, `exponent`, `minK`, `maxK`, `oversize`
  (the 1.5× canvas margin), `haloAlpha`, and the palette.
- `getColor`/`getColor(float)` (lines 94–102, lerp-adjacent palette sampler) is unused in the
  baseline draw; keep or drop — only `rcol` is used.
