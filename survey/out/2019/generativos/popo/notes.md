---
sketch: 2019/generativos/popo
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1780
animated: false
techniques: [dots-stippling, polar, symmetry, grid]
primitives: [point, ellipse, arc, rect, line, shape]
palette:
  colors: ["#333A95", "#F6C806", "#F789CA", "#1E9BF3"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: characterCount, default: 400, tried: [150], change: large, effect: "fewer characters, sparser layout with black gaps between them"}
  - {name: rayCount, default: "random(28,65)", tried: ["random(60,120)"], change: large, effect: "denser busier sunburst per character, more of the canvas covered by rays"}
  - {name: maxSize, default: 520, tried: [200], change: large, effect: "no giant characters; more uniform small-to-medium field"}
  - {name: starCount, default: 10000, tried: [30000], change: large, effect: "denser starfield; also shifts the random stream so character placement/sizes change entirely"}
  - {name: palette, default: ["#333A95", "#F6C806", "#F789CA", "#1E9BF3"], tried: [["#E1E8E0", "#F5CE4B", "#FC5801", "#025DC4", "#02201A", "#489B4D"]], change: large, effect: "hue mix becomes orange/green/yellow/dark-green/gray; pink disappears"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "fan-shaped quad strip between two radii/angles with per-vertex alpha ramp — makes the ray bursts"}
  - {name: character, signature: "character(x, y, s, inv, palette)", note: "circle body + radial rays + face (eyes, smile, legs) + shadow; one 'character' composite"}
---

## What it draws
Full-bleed black canvas densely scattered with small colorful specks (a starfield) and
400 overlapping cartoon "characters": flat circles in pink, yellow, blue or indigo, each
ringed by a fan of translucent rays (a sunburst), with a dark inner circle bearing two
white eyes and a smile, thin legs, and a soft shadow underneath. Big characters overlap
smaller ones; some are inverted (light face on dark body).

## How the code works
`settings()` opens a 960x960 P2D window (popo.pde:14-19); `setup()` calls `generate()`
once and `draw()` is empty, so the piece is static (lines 21-32). Randomness is fully
seeded from `seed` (line 4, 44-45).

`generate()` (lines 42-161) proceeds in three layers:
1. **Starfield** (48-51): 10,000 `point()`s at random positions, `stroke(rcol(), random(200))`
   — random palette color at random alpha, on `background(0)`.
2. **Characters** (58-143): 400 iterations. Position snapped to a 5-px grid (`des`, line 56, 62-63).
   Size `s` is a product of several `random()` calls, heavily skewed small with a max of 520
   (line 61). For each character:
   - `arc2(...)` (line 71) draws `ddd` = random(28,65) wedge-shaped ray quads around the body
     (65-72); `arc2` (164-181) builds a fan of QUADs between radius `s` and `s*2`, with the
     alpha ramping from 200 at the inner edge to 0 at the tip — this is the sunburst.
   - Body: filled circle `s` (76), a faint thin arc ring (80), a full-circle translucent ring
     (95-103) giving a spiky star edge.
   - Face (106-141): inverted flag `inv` (50%); inner circle `s*0.4` in `rcol()`, then a
     black or white `s*0.32` circle; two small eye dots; a stroked half-arc smile or
     open mouth (128-132); a soft `fill(0,20)` shadow ellipse below (135-136); two thin
     leg lines (140-141).
3. **Barcode strips** (147-160): 100 small runs of up to 100 colored 4-px rects in a row,
   the tiny horizontal "dashes" visible across the image.

Color is always `rcol()` — uniform random from the 4-color palette (line 192-195); black
and white are used directly for face/eyes/mouth. P2D + `smooth(8)` antialiases everything.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_150 | `for (int i = 0; i < 400; i++)` -> `i < 150` | large | ~1/3 of the characters; clearly sparser, black gaps between figures, same look otherwise | variants/count_150/frame_00001.png |
| rays_60_120 | `int ddd = int(random(28, 65));` -> `random(60, 120)` | large | each character's sunburst has roughly double the rays; busier, more of the canvas filled with colored rays | variants/rays_60_120/frame_00001.png |
| size_200 | `float s = random(520)*...` -> `random(200)*...` | large | size capped near 200: no giant characters, field of uniform small-to-medium figures | variants/size_200/frame_00001.png |
| stars_30000 | `for (int i = 0; i < 10000; i++)` -> `i < 30000` | large | starfield ~3x denser; character layout is entirely different (star loop consumes the random stream) with larger black areas | variants/stars_30000/frame_00001.png |
| palette_alt | `int colors[] = {#333A95, #F6C806, #F789CA, #1E9BF3};` -> 6-color set | large | orange/green/yellow/dark-green/gray mix replaces pink/indigo; composition identical, hue family changed | variants/palette_alt/frame_00001.png |

## Modularisation notes
Two blocks are directly reusable: `arc2` (a generic radial-fan primitive with per-vertex
alpha) and the per-character routine (body + rays + face + shadow + legs), which could
become `character(x, y, size, inverted, palette)` with the ray count, ring count and
smile type as parameters. One-off art decisions: the specific palette, the 5-px position
grid, the starfield and barcode-strip layers, and the face geometry. A clean parameter
object would hold: `palette`, `characterCount`, `sizeRange`, `rayRange`, `ringCount`,
`inversionChance`, `starCount`, `gridSnap`.
