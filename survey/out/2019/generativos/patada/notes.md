---
sketch: 2019/generativos/patada
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 2174
animated: true
techniques: [noise-field, lines-hatching, curves, blend-modes]
primitives: [shape]
palette:
  colors: ["#121428", "#6B0000", "#913F01", "#512643"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cccMultiplier, default: "*8 (9600-16000 lines)", tried: ["*4 (4800-8000)"], change: moderate, effect: "half the lines -> visibly sparser, thinner filaments, dimmer additive glow, gaps between lines appear"}
  - {name: strokeAlphaOffset, default: "+20 (alpha 10-30)", tried: ["+60 (alpha 50-70)"], change: moderate, effect: "higher alpha -> brighter, more solid filaments; more of the canvas covered in glow"}
  - {name: turnScale, default: 2.1, tried: [10], change: subtle, effect: "much sharper turning -> lines coil into tighter spirals/curls; overall composition unchanged"}
  - {name: palette, default: "#121428,#6B0000,#913F01,#512643 (dark)", tried: "#E65EC9,#5265E8,#F2F481,#81F498,#52D8E8 (bright)", change: large, effect: "completely different colours (cyan/green/magenta/yellow neons); same structure"}
  - {name: noiseDetail, default: "random(0.001)", tried: ["random(0.01)"], change: subtle, effect: "higher-frequency noise -> lines slightly rougher/wavier; overall composition unchanged"}
  - {name: ccMultiplier, default: "*3 (600-750 pts/line)", tried: ["*1 (200-250 pts/line)"], change: subtle, effect: "shorter lines -> more fragmented, less continuous filaments"}
reusable_candidates:
  - {name: wanderLine, signature: "wanderLine(x0, y0, steps, noiseSeed, detail, turnScale) -> PShape", note: "a path that walks by adding a noise-driven turning angle (cos/sin) each step; smooth low-detail noise = long gentle filaments"}
  - {name: additiveField, signature: "additiveField(count, startSpine, steps, palette, alpha) -> void", note: "draw `count` faint stroked wander-lines under blendMode(ADD) so overlaps sum to bright glow on black"}
  - {name: lerpPalette, signature: "lerpPalette(int[] colors, float t) -> color", note: "getColor: map t into the palette, lerpColor between the two neighbouring entries"}
---

## What it draws
On a black ground, thousands of extremely thin, faint filaments accumulate into a luminous
additive field of curved bands. The strokes read as hot reds, oranges and magenta/violet
glows (the palette is actually four *dark* colours that ADD-blend into bright ones), with a
dense knot of light in the centre-left and long sweeping curved sheets fanning out toward the
edges. The whole thing has a fine hatched, almost woven texture from the sheer number of
near-parallel lines.

> Note on frames: the sketch is **static** (`draw()` is empty, `generate()` runs once in
> `setup()`), so frame 1 is the artwork. `frame_00010`/`frame_00060` exist and differ from
> frame 1 (hence `animated: true` is set mechanically), but they are a blown-out near-white
> image — a P3D framebuffer read-back artefact from the `ADD` blend mode being re-read on
> later frames, not real animation. All experiment comparisons below use frame 1.

## How the code works
- `settings()` (14-19): `size(960, 960, P3D)`, `smooth(8)`, `pixelDensity(2)`.
- `setup()` (21-29): calls `generate()` once; `export=false` so the empty `draw()` just loops.
- `generate()` (34-67):
  - `background(0)` (36) — black base.
  - `det = random(0.001)` (38) — very low-frequency noise scale that drives how each line turns.
  - `detCol = random(0.0005)` (42) — noise scale for choosing colour along the stack.
  - `ampX = random(1, 6)` (44) — number of cosine cycles in the horizontal start spine.
  - `blendMode(ADD)` (46) — **key**: strokes accumulate additively, so dark low-alpha lines
    sum into bright glows on black.
  - `ccc = int(random(1200, 2000)*8)` (48) — 9600–16000 lines total.
  - Outer loop `i` (51-66), one line per `i`:
    - start `x = width*(0.5 + cos((i/ccc)*ampX*PI)*0.2)` (52) — lines originate on a spine that
      oscillates horizontally around the centre (±20% width), `ampX` full cycles top-to-bottom;
      this is the source of the fanning/oscillating structure.
    - start `y = map(i, 0, ccc, 0, height)` (53) — evenly distributed top to bottom.
    - `cc = int(random(200, 250)*3)` (54) — 600–750 vertices per line.
    - `stroke(getColor(noise(i*detCol)*colors.length*4), cos(ialp+valp*i)*10+20)` (55) — colour
      from a noise-driven palette position, alpha 10–30 (very thin/translucent).
    - inner loop `j` (59-64): `a = (noise(i*det, j*det) - ia)*2.1` (60) — a turning angle from
      smooth 1-D noise sampled along the line; `x += cos(a); y += sin(a)` (61-62) — a random
      walk that bends gently (smooth noise) so each line is a long meandering filament.
  - Result: ~10k–16k faint filaments; where they overlap, ADD blending drives the pixel toward
    white, producing the bright bands and the central knot.

Visual → code mapping:
- glowing filaments on black = `blendMode(ADD)` (46) + thin low-alpha strokes (55).
- red/orange/magenta/violet hues = the 4 dark palette colours (83) lerped by `getColor` (86-97)
  and stacked additively, so they appear as brighter versions of themselves.
- smooth long curves = low noise detail `det` (38) feeding the turning angle (60).
- horizontal fanning/oscillating layout = cosine start spine (52) with `ampX` cycles.
- fine hatched density = high `ccc` (48) × high per-line `cc` (54).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| lines_x4 | `int ccc = int(random(1200, 2000)*8);` -> `*4;` | moderate | half the lines: visibly sparser, thinner filaments, dimmer additive glow, gaps between lines | variants/lines_x4/frame_00001.png |
| alpha_60 | `cos(ialp+valp*i)*10+20` -> `*10+60` | moderate | brighter: more solid filaments, more canvas covered in red/orange glow | variants/alpha_60/frame_00001.png |
| turn_10 | `(noise(i*det, j*det)-ia)*2.1` -> `*10` | subtle | lines coil into tighter spirals/curls; overall composition unchanged | variants/turn_10/frame_00001.png |
| palette_bright | `int colors[] = {#121428,#6B0000,#913F01,#512643}` -> bright neon palette | large | completely different colours (cyan/green/magenta/yellow); same structure | variants/palette_bright/frame_00001.png |
| det_0.01 | `float det = random(0.001);` -> `random(0.01)` | subtle | lines slightly rougher/more wavy; overall composition unchanged | variants/det_0.01/frame_00001.png |
| pts_x1 | `int cc = int(random(200, 250)*3);` -> `*1;` | subtle | shorter lines: more fragmented, less continuous filaments | variants/pts_x1/frame_00001.png |

## Modularisation notes
- **Generic / reusable:** the per-line random walk (`wanderLine`, lines 57-65) is a clean,
  self-contained primitive — a path built by integrating a noise-driven heading. It is the
  single most reusable piece and only depends on `noise()`, a step count and a turn scale.
  `lerpPalette`/`getColor` (86-97) is a standard palette-interpolation helper. The additive
  stacking pattern (many faint stroked shapes under `blendMode(ADD)`) is a reusable "glow
  field" recipe.
- **One-off art decisions:** the exact 4-colour dark palette (83), the cosine start spine
  formula (52) and its `ampX`, the specific alpha range (55), the noise scales `det`/`detCol`
  (38/42) and the line-count multiplier (48). These are taste parameters, not logic.
- **Clean parameter object:** `{ count, stepsPerLine, turnScale (2.1), noiseDetail (det),
  colorNoiseDetail (detCol), ampX, alphaRange, palette, blendMode }`. Everything in
  `generate()` is expressible from this object; `wanderLine(start, steps, seed, detail,
  turnScale)` and `lerpPalette(colors, t)` would be the two library functions it reduces to.
