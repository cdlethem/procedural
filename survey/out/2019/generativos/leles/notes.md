---
sketch: 2019/generativos/leles
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1510
animated: false
techniques: [grid, lines-hatching]
primitives: [line, shape]
palette:
  colors: ["#D4C8B8", "#E3DEDA", "#4C8E58", "#D00202", "#F7D20D", "#66B6CD"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "random(20,50)", tried: [30], change: moderate, effect: "coarser grid -> fewer, larger, more angular wedges"}
  - {name: fanCount, default: 200, tried: [400], change: moderate, effect: "denser canvas, larger saturated wedges, more overlap"}
  - {name: alpha, default: "random(40,180)", tried: ["random(120,255)"], change: subtle, effect: "fan lines read denser/more visible; composition unchanged"}
  - {name: lenFrac, default: "random(0.15,0.35)", tried: ["random(0.5,0.8)"], change: moderate, effect: "much longer fans, large sweeping wedges across the canvas"}
  - {name: gridAlpha, default: "random(20,40)*0.9", tried: [100], change: moderate, effect: "grid strongly visible, darkens and structures the whole composition"}
  - {name: colors, default: "{#4C8E58,#D00202,#F7D20D,#66B6CD}", tried: ["{#6789AA,#3A3A3A,#9DAAAB,#F7743B}"], change: moderate, effect: "cool blues/greys with orange accents, same wedge structure"}
reusable_candidates:
  - {name: gridFans, signature: "gridFans(cells, fanCount, maxLenFrac, alphaRange, palette) -> void", note: "bundles of parallel lines between random grid nodes, fanned to a point"}
  - {name: getColor, signature: "getColor(palette, v) -> color", note: "position in palette -> lerp between adjacent entries with pow-eased fraction"}
---

## What it draws
A full-bleed abstract composition on a warm beige background. A faint grey grid of thin vertical and horizontal lines covers the canvas with a small margin. On top, many semi-transparent colored "fans": bundles of fine parallel lines that converge to sharp points, forming triangle-like wedges and conical sweeps across the whole image. The dominant hues are red, yellow, green and cyan, plus the orange/brown blends where translucent wedges overlap. A few nearly invisible pale off-white rectangles sit between the grid and the fans.

## How the code works
`setup()` -> `generate()` (static; `draw()` is empty, L21-32).
1. `background(#D4C8B8)` (L36) sets the beige ground.
2. Grid: `cc = int(random(20, 50))` cells, `ss = width/cc` (L38-39). Loop L41-45 draws vertical and horizontal lines with `stroke(0, random(20,40)*0.9)` — the faint grey grid, inset by 2 cells.
3. Pale rectangles: loop L47-79 picks two random grid nodes (2..cc-2), builds the bounding box, and fills it with `#E3DEDA` at alpha 2 or 0 on alternating vertex pairs — nearly invisible soft patches.
4. Fans: loop L82-107, 200 times. Picks two random grid nodes (2..cc-1) per "strand pair", then `dis = int(maxDist * random(0.15, 0.35))` segments (L94-95). For each segment `j`, it lerps points along both strands (L99-102) and draws one `line(xx1,yy1, xx2,yy2)` with `stroke(getColor(ic+dc), alp)` where `alp = random(40,180)` (L93) — a fan of parallel lines whose endpoints walk along two straight paths, so the bundle tapers into a wedge. The `beginShape/endShape` around L96/106 is vestigial (no vertices).
5. Colour: `getColor(v)` (L159-165) takes a float position, wraps modulo 4, and lerps between adjacent entries of `colors = {#4C8E58, #D00202, #F7D20D, #66B6CD}` (L152) with `pow(frac, 10.8)` easing, so lines sit near palette entries and occasionally cross over to the next colour (red->yellow->cyan->green, producing orange/green blends at low alpha).
6. Randomness enters only via `random(...)` with the harness seed (42); `SimplexNoise` is imported (L1) but never used, and the `noise2`/`fbm`/`arc2` helpers (L167-221) are dead code. `keyPressed` regenerates with a new seed (L141-147).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_30 | `int cc = int(random(20, 50));` -> `int cc = 30;` | moderate | coarser grid; fewer, larger, more angular wedges, same palette | variants/cc_30/frame_00001.png |
| fans_400 | `for (int i = 0; i < 200; i++) {` -> `for (int i = 0; i < 400; i++) {` | moderate | twice as many fans; much denser, large saturated yellow/red/green wedges cover the canvas | variants/fans_400/frame_00001.png |
| alpha_120_255 | `float alp = random(40, 180);` -> `float alp = random(120, 255);` | subtle | same wedges, fan lines read denser and more visible, slightly more solid fills | variants/alpha_120_255/frame_00001.png |
| lenFrac_0.5_0.8 | `dis = int(dis*random(0.15, 0.35));` -> `dis = int(dis*random(0.5, 0.8));` | moderate | fans ~2x longer; large sweeping curved wedges crossing the whole canvas | variants/lenFrac_0.5_0.8/frame_00001.png |
| gridAlpha_100 | `stroke(0, random(20, 40)*0.9);` -> `stroke(0, 100);` | moderate | grid now strongly visible in dark grey; overall image darker, grid reads as structure over the fans | variants/gridAlpha_100/frame_00001.png |
| palette_cool | `int colors[] = {#4C8E58, #D00202, #F7D20D, #66B6CD};` -> `{#6789AA, #3A3A3A, #9DAAAB, #F7743B};` | moderate | same wedge structure in cool blue-grey/slate/orange instead of red/yellow/green/cyan | variants/palette_cool/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: the fan/wedge generator (loop L82-107) as `gridFans(cells, fanCount, maxLenFrac, alphaRange, palette)` — parameterized by cell count, bundle count, max length as a fraction of node distance, alpha range, and palette; and `getColor(palette, v)` (L159-165) as a palette-position color function (pow-eased lerp between adjacent entries).
- One-off art decisions: the exact 4-colour palette (L152), the 2-cell inset and grid alpha (L41-44), the near-invisible white rectangles (L47-79), and the `0.15..0.35` length fraction.
- A clean parameter object: `{cells (20-50), gridAlpha, rectCount, rectFill, fanCount (200), lenFrac (0.15-0.35), alphaRange (40-180), palette, seed}`. The dead helpers (`noise2`, `fbm`, `arc2`, `rcol`, `random2`) and the unused `SimplexNoise` import would be dropped.
