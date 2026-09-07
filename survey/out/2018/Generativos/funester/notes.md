---
sketch: 2018/Generativos/funester
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1808
animated: false
techniques: [grid, dots-stippling, noise-field, symmetry]
primitives: [ellipse, rect, line, shape]
palette:
  colors: ["#FFAB6B", "#EFB1F1", "#FF0076", "#951BFF", "#5B01A8"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: dist, default: "random(3, 4.8)", tried: ["random(6, 8)"], change: moderate, effect: "fewer, more widely spaced scattered dots; faint rings around them become visible"}
  - {name: dotScale, default: 0.08, tried: [0.3], change: moderate, effect: "scattered dots ~4x larger with prominent rings; grid layer unchanged"}
  - {name: ccMult, default: 2, tried: [6], change: moderate, effect: "grid 3x finer (smaller cells, smaller motifs, finer center squares)"}
  - {name: amp, default: "random(0.1, 0.4)", tried: ["random(0.5, 0.8)"], change: moderate, effect: "corner dots/arcs 2-3x larger, motif circles nearly fill cells"}
  - {name: ringWeight, default: 0.05, tried: [0.2], change: none, effect: "no visible change; rings are 0.08-1.5 px strokes, sub-pixel at this size"}
  - {name: candidates, default: 10000, tried: [3000], change: moderate, effect: "shorter candidate loop shifts downstream random sequence: grid redrawn finer, large two-tone pie circles dominate; scattered layer nearly gone"}
reusable_candidates:
  - {name: scatteredDots, signature: "scatteredDots(candidates, sizeFn, minDistFn, seed) -> PVector[]", note: "relaxed random dot placement with per-dot distance threshold (funester.pde:26-42)"}
  - {name: arcBand, signature: "arcBand(x, y, r1, r2, a1, a2, col, shd1, shd2)", note: "tessellated annular-sector shape drawn as quads (funester.pde:134-152)"}
  - {name: noiseGridDoodle, signature: "noiseGridDoodle(cells, cellSize, detail, amp)", note: "per-cell random/noise-driven motif: quad, corner lines, arcs, dots (funester.pde:73-131)"}
---

## What it draws
Full-bleed 960x960 image on a mottled purple/violet background (soft noise patches in violet, magenta, blue-purple). Over it sits a regular grid of small round dots in hot pink, yellow-orange, white, violet and dark purple, each with a faint ring around some of them. Thin pale yellow and pink lines run horizontally and vertically along the grid, and cells carry small yellow squares and semicircle/arc doodles at their corners. Concentric squares and large faint circles are centered on the canvas. Static (single frame; `draw()` is empty).

## How the code works
`setup()` calls `generate()` once (funester.pde:2-9); `draw()` is empty so the piece is static.

1. **Background**: `background(rcol())` (l.23) — a solid colour from the 5-colour list `colors[]` (l.161); the mottled purple look comes from the translucent layers drawn over it, not a noise fill.
2. **Scattered dots** (l.26-42): up to 10000 random candidates; a candidate is kept only if its distance to every kept point exceeds `(s + other.s) * dist` with `dist = random(3, 4.8)` (l.27) — a relaxed Poisson-like scatter. Dot size `s = width*random(0.02,0.1)*0.08` (l.31).
3. **Dot + ring pass** (l.44-54): each kept dot is filled `rcol()`, plus an unfilled stroked ring at `1.6x` diameter with `strokeWeight(p.z*0.05)` (l.52-53).
4. **Concentric center shapes** (l.57-71): `cc = int(random(5, random(5,15)))*2` cells across; loop draws a stroked centered square of size `i*ss` (l.66) and a large ellipse of size `(cc-i)*ss` with fill alpha 8 / stroke alpha 20 (l.67-69) — the centered squares and faint circles.
5. **Grid doodle pass** (l.73-131): `ss = width/cc`; per cell: a 4- or 5-vertex quad (random corner dropped, l.86-103) filled with alpha `random(120)`; two 1px corner lines (top + left, l.105-108) — the thin cross-lines; then a noise-driven cluster at the cell corner: dot sized `ss*amp` where `amp = random(0.1,0.4)` (l.78,112-114), two very-low-alpha ellipses (l.115-118), two `arc2()` annular bands (l.119-120), a half-arc rotated by 2-D noise angle (l.121-123, `det = random(0.01)`), a tiny dot sized by noise (l.125), and a centered rect sized by noise (l.126-129).
6. **Colour**: everything picks `rcol()` = uniform random from `{#FFAB6B, #EFB1F1, #FF0076, #951BFF, #5B01A8}` (l.162-164); most fills use a random alpha (120 or 12) so colours layer into the purple wash.

Randomness enters at: scatter candidates (l.28-31), `dist` (l.27), `cc` (l.57), cell quad corner (l.86), all alphas, `arc2` band radii, and the noise offsets `des/sdes` and `det` (l.73-76).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| dist_6_8 | `float dist = random(3, 4.8);` -> `float dist = random(6, 8);` | moderate (mean 0.0958, 0.304) | scattered dots sparser and more spread out; thin rings visible around more dots; grid layer identical to baseline | variants/dist_6_8/frame_00001.png |
| s_0.3 | `float s = width*random(0.02, 0.1)*0.08;` -> `...*0.3;` | moderate (mean 0.0836, 0.238) | scattered dots ~4x larger, rings prominent; grid layer identical | variants/s_0.3/frame_00001.png |
| cc_x6 | `int cc = int(random(5, random(5, 15)))*2;` -> `...)*6;` | moderate (mean 0.1009, 0.355) | grid 3x finer: more, smaller cells; corner lines denser; center concentric squares finer; scattered dots relatively sparser | variants/cc_x6/frame_00001.png |
| amp_0.5_0.8 | `float amp = random(0.1, 0.4);` -> `float amp = random(0.5, 0.8);` | moderate (mean 0.108, 0.33) | corner dots/arcs ~2-3x larger, motif circles nearly fill each cell; yellow squares and corner lines more prominent | variants/amp_0.5_0.8/frame_00001.png |
| ring_sw_0.2 | `strokeWeight(p.z*0.05);` -> `strokeWeight(p.z*0.2);` | none (mean 0.0026, 0.006) | no visible change; ring stroke is 4x dot-size x 0.05-0.2 = 0.08-1.5 px, sub-pixel | variants/ring_sw_0.2/frame_00001.png |
| candidates_3000 | `for (int i = 0; i < 10000; i++) {` -> `for (int i = 0; i < 3000; i++) {` | moderate (mean 0.0959, 0.313) | scattered dot layer nearly gone; 7000 fewer random() calls shift every later draw, so the grid is redrawn with a different (finer) cc and the cell motifs appear as a dense field of large two-tone pie circles | variants/candidates_3000/frame_00001.png |

## Modularisation notes
- Generic: `scatteredDots` (relaxed scatter, l.26-42) and `arcBand` (l.134-152) are self-contained and reusable as-is.
- Generic with parameterisation: the grid doodle pass (l.73-131) is a "cell motif" generator; a clean parameter object would be `{cells, cellSize, detail, amp, alphaFill, motif: {quad, cornerLines, arc, dot, rect}}`.
- One-off art decisions: the specific 5-colour list, the concentric-square/circle overlay (l.57-71), the exact mix of motif elements per cell.
- Caveat: all layers share one global random stream, so changing any loop's iteration count (e.g. `candidates`) re-rolls every downstream layer, not just its own. A library version should seed per-layer or use independent PRNGs.
