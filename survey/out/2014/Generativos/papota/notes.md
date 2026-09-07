---
sketch: 2014/Generativos/papota
year: 2014
renderer: JAVA2D
size: [800, 200]
libraries: []
deterministic: true
ms_first_frame: 182
animated: false
techniques: [noise-field, polar, lines-hatching, pixel-ops]
primitives: [ellipse, rect, line, shape, pixels]
palette:
  colors: ["#EE84D5", "#FFC54A", "#65B4EC", "#F8F161", "#D33C63"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(-3,8)) (0 for seed 42)", tried: [0], change: subtle, effect: "scattered ring stacks removed; baseline had none, so only slight re-shaping of the central stack (RNG stream shift)"}
  - {name: cruces_cant, default: "int(random(90))", tried: [0], change: subtle, effect: "crosses gone; RNG stream shift spawns 4 scattered ring stacks"}
  - {name: centerCono_dim, default: "random(width*0.2, width*0.6)", tried: ["random(width*0.05, width*0.15)"], change: subtle, effect: "central stack shrinks to ~1/4 diameter, crosses and bands unchanged"}
  - {name: bandWidth, default: "random(20, 200)", tried: ["random(60, 350)"], change: subtle, effect: "background bands wider and more subtle; RNG stream shift spawns 2 scattered stacks"}
  - {name: degrade_alp, default: "random(0.1, 0.6)", tried: ["random(0.7, 1)"], change: subtle, effect: "near-opaque gradient wash hides bands and crosses, leaving flat background + central stack"}
reusable_candidates:
  - {name: cono, signature: "cono(x, y, dim, count, angle, spread, color)", note: "nested offset ellipses shrinking along a direction, forming a spiral/tunnel ring"}
  - {name: nnois, signature: "nnois(amount)", note: "per-pixel random saturation jitter over the whole canvas (grain)"}
  - {name: degrade, signature: "degrade(c1, c2, alpha)", note: "full-width horizontal lines lerping two colours, painted with partial alpha"}
  - {name: lineasFondo, signature: "lineasFondo(color)", note: "rotated stack of random-width full-diagonal bands tiling the canvas"}
---

## What it draws
A wide (800x200) full-bleed magenta/purple composition. A large spiral "tunnel" of concentric,
slightly offset elliptical rings dominates the centre, fading outwards. Behind it, thick diagonal
bands in near-identical magenta shades cross the canvas (visible as two broad tonal wedges).
Scattered small plus/cross marks sit on the surface, and the whole image is covered in fine grain
plus a faint horizontal colour gradient overlay.

## How the code works
`setup()` sizes the 800x200 window (line 13) and calls `generar()` once; `draw()` is empty
(lines 17-18) so the sketch is static — it regenerates only on `keyPressed` (lines 20-22).
`generar()` (lines 24-40) picks one random RGB `col` (line 25) — the `paleta[]` list is
commented out (lines 1-5), so the palette in the code is not actually used; every colour is an
HSB tweak of that single random colour via `hue`/`sat`/`bri` (lines 128-150).

Order of painting in `generar()`:
1. `lineasFondo()` (lines 109-123): rotates around the centre by a random angle, then walks a
   stack of random-width (20-200 px) full-diagonal `rect`s from `-diag/2` to `diag/2`, each
   filled with `col` jittered in brightness by ±40 — the diagonal tonal wedges.
2. `nnois(10)` (lines 94-100): per-pixel `get/set` loop adding random saturation ±10 — fine grain.
3. `cruces(...)` (lines 42-52): ~90 random positions, each a `cruz()` (lines 54-79) — a 10-vertex
   cross polygon built from two overlapping bars, arm thickness `random(0.05,0.2)` of half-size,
   random rotation, filled with a brightened/desaturated `col` at alpha 180-256 — the plus marks.
4. `degrade(c1, c2, random(0.1,0.6))` (lines 102-107): one horizontal `line` per scanline,
   `lerpColor` between two hue-shifted versions of `col`, at low alpha — the faint vertical
   gradient wash (c1/c2 from lines 29-30).
5. `cc = int(random(-3,8))` scattered `cono()` calls (lines 33-36) plus one always-present central
   `cono()` (line 37). `cono()` (lines 81-92) draws `cant` ellipses, each shrinking by `dim/cant`
   and offset along a random direction `ang` by a mapped amount `des*r` — the nested-offset ring
   stack that reads as a spiral/tunnel. Fills are brightness-jittered `col` at reduced saturation.
6. A second `nnois(10)` (line 39) re-grains everything on top.

Randomness: everything positional/size/colour is `random()`; no `noise()`. Determinism comes from
the harness seed.
Because every value is a positional `random()` draw, any substitution that changes the *number*
of draws shifts the whole downstream stream: the variant experiments below therefore also move
the scattered `cono` stacks, even when `cc` is untouched.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_0 | `int cc = int(random(-3, 8));` -> `int cc = 0;` | subtle | no visible change in composition: seed-42 baseline already had cc=0 (no scattered stacks); the one fewer random draw shifts the stream, so the central stack is slightly re-shaped (same size, different ring count/angle) | variants/cc_0/frame_00001.png |
| cruces_0 | `cruces(int(random(90)), random(4, 18), random(0.2, 1));` -> `cruces(0, ...)` | subtle | crosses are gone; removing ~630 random draws shifts the RNG stream, so 4 small scattered ring stacks (not in baseline) now appear around one large central stack | variants/cruces_0/frame_00001.png |
| centerCono_small | `cono(width/2, height/2, random(width*0.2, width*0.6), ...)` -> `random(width*0.05, width*0.15)` | subtle | central stack shrinks from ~400 px to ~120 px diameter (small central vortex); crosses and diagonal bands otherwise as in baseline | variants/centerCono_small/frame_00001.png |
| bands_wide | `float tt = random(20, 200);` -> `float tt = random(60, 350);` | subtle | background bands wider and less contrasty (near-uniform magenta ground); fewer band iterations shift the RNG stream, spawning 2 scattered stacks beside the central one | variants/bands_wide/frame_00001.png |
| degrade_strong | `degrade(c1, c2, random(0.1, 0.6));` -> `random(0.7, 1)` | subtle | near-opaque per-scanline gradient wash (painted over bands and crosses, under the cono) flattens the background: bands and crosses no longer visible, only the large central stack remains | variants/degrade_strong/frame_00001.png |

## Modularisation notes
- Generic library candidates: `cono` (spiral ring stack — the core visual, parameterised by
  size/count/spread/angle), `nnois` (grain pass), `degrade` (low-alpha colour gradient wash),
  `lineasFondo` (rotated band tiling), `cruz` (cross polygon primitive).
- One-off art decisions: the exact call order in `generar()` (background bands -> grain ->
  crosses -> gradient wash -> ring stacks -> grain), the single-random-colour HSB-jitter colour
  scheme (the hardcoded palette is dead code), the 800x200 wide canvas, and the fixed central
  `cono` at half-size 0.2-0.6 of width.
- A clean parameter object: `{ baseColor, bandCount/widthRange, crossCount, crossSize,
  crossThickness, gradientAlpha, ringScatterCount, ringCenterSize, ringCount, grainAmount,
  grainPasses, rotation }`.
