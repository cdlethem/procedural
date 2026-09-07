---
sketch: 2018/Generativos/circity2
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1563
animated: false
techniques: [grid, dots-stippling, lines-hatching]
primitives: [rect, ellipse, shape, line]
palette:
  colors: ["#A82A17", "#EDBA2F", "#0E9165", "#00244F", "#222126", "#E5E5E5"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "random(3, random(5, 40))", tried: [12], change: large, effect: "finer 12-division grid, smaller motifs, same Bauhaus field layout with reshuffled randoms"}
  - {name: ver, default: "random(0.8, 0.9)", tried: [0.3], change: large, effect: "white block shrinks to sliver; soft wash and big triangles dominate, large smooth gradient areas"}
  - {name: man, default: "ver-random(0.05, 0.1)", tried: ["ver+0.35"], change: large, effect: "coloured block outgrows and fully covers the white block + corner-cut triangle; cells become solid single-colour squares"}
  - {name: background, default: 30, tried: [235], change: none, effect: "no visible change; background fully covered by wash and shapes"}
  - {name: palette, default: "2018 bauhaus 6-colour set", tried: ["#1D3557 #457B9D #A8DADC #F1FAEE #E63946 #F1C40F"], change: large, effect: "same composition recoloured: yellow wash, coral reds, teal blues, cream"}
  - {name: washAlpha, default: "random(10)", tried: ["random(80)"], change: subtle, effect: "slightly stronger, more saturated soft colour washes; layout unchanged"}
reusable_candidates:
  - {name: linee, signature: "linee(x1, y1, x2, y2, div, amp) -> void", note: "dashed line: div short lerp segments, gap controlled by amp (amp<1 dashes, amp>1 overlap)"}
  - {name: rcol, signature: "rcol() -> int", note: "random pick from a fixed palette array"}
  - {name: gridMotif, signature: "gridMotif(sub, cellFn) -> void", note: "sub x sub cell grid calling a per-cell motif function at cell corners/centres"}
---

## What it draws
Bauhaus/constructivist "city" on a dark charcoal background (seed 42). A coarse grid of flat
blocks: off-white rounded squares (some with a corner cut into a white triangle), navy diamonds,
green circles, red and yellow squares stacked in rings. Two huge smooth colour fields dominate —
a teal-green right triangle sweeping diagonally across the centre and a large ochre-yellow
rectangle in the upper third. A fine dashed grid (light grey) runs across the whole canvas, a
faint lattice of tiny white dots sits on a finer sub-grid, and small dark dots mark the block
corners. Dominant colours: teal green, ochre yellow, navy; accents of brick red and off-white.

## How the code works
`setup()` -> `generate()` (circity2.pde L3-8); `draw()` is empty, so the image is static (L10-11).
Randomness enters through `random()` calls with a harness-injected seed.

- L22: `background(30)` charcoal ground.
- L26-27: `sub = int(random(3, random(5, 40)))` grid divisions (nested random -> biased low);
  `ss = width/sub` cell size.
- Pass 1 (L32-77): one `rnd = int(random(5))` per cell column-row pair draws at each cell
  *corner*: diamond (L38-46), circle (L47-50), diamond+inner diamond (L51-67), circle+inner
  circle (L69-74). These are the small stacked motifs (red square/diamond rings, circle pairs).
- L79-87: `stroke(160)` grid: sub+1 horizontal and vertical lines each drawn via `linee(...,
  sub*10, 0.4)` (L164-175) which emits `sub*10` short lerp segments with an amp 0.4 gap ->
  the dashed grey grid.
- Pass 2 (L89-154), at each cell *centre*: small two-tone dot top-left (rcol + grey 60,
  L95-98); off-white rounded rect `ss*ver` (L100-101, ver = random(0.8,0.9), L29); white
  corner-cut triangle (L102-108); coloured rounded rect `ss*man` (L109-110, man = ver -
  random(0.05,0.1), L30); then a giant faint ellipse `ss*2` with alpha random(10) (L113-114) —
  these many overlapping near-transparent ellipses accumulate into the soft colour washes;
  finally up to 6 random small motifs per cell (L116-152): circle, diamond, `man`-scaled
  diamond, and a large right triangle of radius `sqrt(2)*ss*0.5*sca` with sca up to 8 (L141-151)
  — these oversized triangles are the big green/teal diagonal field.
- L156-161: `fill(255, 16)` 2px dots on a `sub*2` grid -> faint white dot lattice.
- Palette: 6 fixed ints (L182), `rcol()` picks uniformly at random (L183-185). `getColor`
  (L186-194) is an unused lerp-between helper.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_12 | `int sub = int(random(3, random(5, 40)));` -> `int sub = 12;` | large (mean 0.2988, 0.885 of pixels) | same Bauhaus field layout reshuffled (random stream shifts when the sub draw is removed); grid visibly finer (12 divisions, denser dashed lines), motifs smaller; big yellow rect + green triangle fields, row of white/navy blocks along the bottom | variants/sub_12/frame_00001.png |
| ver_0.3 | `float ver = random(0.8, 0.9);` -> `float ver = 0.3;` | large (mean 0.1987, 0.69 of pixels) | white blocks shrink to slivers and coloured blocks to dots; the giant faint-ellipse washes become the dominant feature, producing large smooth gradient areas (grey band, green, blue); far less blocky | variants/ver_0.3/frame_00001.png |
| man_1.15 | `float man = ver-random(0.05, 0.1);` -> `float man = ver+0.35;` | large (mean 0.196, 0.698 of pixels) | coloured block now outgrows the white block and covers it plus the corner-cut triangle; cells read as solid single-colour rounded squares; wash/triangle layout identical to the ver_0.3 variant (same random stream, only sizes differ) | variants/man_1.15/frame_00001.png |
| bg_235 | `background(30);` -> `background(235);` | none (mean 0.0014, 0.002 of pixels) | no visible change: the wash and shapes cover essentially the whole canvas, so the ground colour is never seen | variants/bg_235/frame_00001.png |
| palette_alt | `int colors[] = {#a82a17, #EDBA2F, #0e9165, #00244f, #222126, #E5E5E5};` -> `int colors[] = {#1D3557, #457B9D, #A8DADC, #F1FAEE, #E63946, #F1C40F};` | large (mean 0.3473, 0.918 of pixels) | identical composition, fully recoloured: warm yellow/gold wash, coral-red triangles and squares, teal-steel blues, cream diamonds; same layout and soft gradients | variants/palette_alt/frame_00001.png |
| washAlpha_80 | `fill(rcol(), random(10));` -> `fill(rcol(), random(80));` | subtle (mean 0.0176, 0.046 of pixels) | same layout as baseline; the soft washes are slightly stronger and more saturated (green field and ochre area a touch deeper), edges of the big gradients a bit more present | variants/washAlpha_80/frame_00001.png |

## Modularisation notes
- Generic: `linee` (dashed line via segment gaps) is a clean standalone utility; `rcol`/palette
  array is the standard fixed-palette picker; the two passes over a `sub x sub` grid (corner
  motifs at L32-77, centre blocks at L89-154) are a "grid of motif slots" pattern.
- One-off art decisions: the specific motif set (diamond/circle/ring/corner-cut square), the
  `ver`/`man` size relationship (white block slightly larger than coloured block), the giant
  faint ellipse wash trick, the oversized-triangle overlay, and the 2018 Bauhaus palette.
- Clean parameter object: {sub (grid divisions), ver (white block fraction), man (colour block
  fraction), bg (background grey), palette (int[]), lineDiv (sub*10), lineAmp (0.4),
  washAlpha (random(10) cap), washRadius (ss*2), motifsPerCell (6), dotAlpha (16), dotScale (sub*2)}.
