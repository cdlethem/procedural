---
sketch: 2018/Generativos/lebo
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1553
animated: false
techniques: [grid, pixel-ops]
primitives: [rect, shape, ellipse]
palette:
  colors: ["#D9BADE", "#0B25A0", "#2EBF40", "#FCCB03", "#F84D1E", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: grid, default: "7 (int(960/pow(2, 7..8)) → 3 or 7; 7 for seed 42)", tried: [14], change: large, effect: "much finer 14x14 mosaic of small squares; subdivided patches and ghosts scale down with the cells"}
  - {name: subdivide_prob, default: 0.08, tried: [0.5], change: large, effect: "half the cells become dense 20x20 multicolour speckle patches; mottled texture dominates over flat areas"}
  - {name: ghost_alpha, default: "random(40,80)*0.8 (≈32-64/255)", tried: ["random(200,255)"], change: moderate, effect: "ghost shadows become near-opaque: thick saturated colour gradients wash over most of the canvas, base grid barely visible"}
  - {name: dot_size, default: "gs*0.1", tried: ["gs*0.5"], change: none, effect: "no visible change — the dot is drawn with fill(col,0) (alpha-0 fill state leaked from the last shadow quad, l.133), so it is invisible at any size"}
  - {name: palette_size, default: 6, tried: [2], change: large, effect: "with only #0B25A0 and #FCCB03 the image reduces to flat blue/yellow blocks plus blue/yellow shadows; grid structure reads as merged same-colour regions"}
  - {name: ghost_count, default: "grid*4 (28 for grid 7)", tried: ["grid*12"], change: moderate, effect: "3x more ghost squares: more outlines and one large multicolour speckle patch, canvas more covered, base grid still readable"}
reusable_candidates:
  - {name: grainShader, signature: "shader(fragOffset) -> void", note: "per-pixel alpha dither: a *= 1 + pow(hash(fragCoord + offset), 0.8) — grainy texture over everything drawn under it"}
  - {name: subdivideCell, signature: "subdivideCell(x, y, s, sub, amp) -> void", note: "20x20 sub-rects, keep each with probability amp, 1px inset"}
  - {name: boxShadow, signature: "boxShadow(x, y, s, color, alpha) -> void", note: "four trapezoids (near edge full alpha, far edge 0) make a soft fading shadow on all four sides of a square"}
---

## What it draws
Seed 42 shows a 7×7 grid of large flat squares in saturated colours (deep blue, yellow, green, white, orange-red) that fills the whole canvas; every surface has a fine speckled, grainy dither texture. On top of the grid sit a few overlapping "ghost" squares, some outlined, some with a soft shadow that fades away on one or two sides; a couple of grid cells are subdivided into finer mottled patches. (A centre dot is drawn for every ghost but is invisible: its fill state has leaked to alpha 0 — see Experiments.)

## How the code works
`setup()` (l.5–13) makes a 960×960 P2D window, loads the `noiseShadow` shader and calls `generate()` once; `draw()` is empty, so the piece is static (key press only regenerates).

- Shader (l.36–38, glsl l.19–24): the fragment shader multiplies alpha by `1 + pow(hash(fragCoord.xy + displace), 0.8)`, a per-pixel random alpha scatter that gives every flat colour its grainy dither look. `displace` just re-rolls the hash phase and is reset for each ghost (l.74).
- Grid (l.41–42): `grid = int(960 / pow(2, int(random(random(7,8), 9))))` → 960/128 = 7 or 960/256 = 3 (here 7); cell size `gs ≈ 137 px`.
- Cell fill (l.48–69): each cell is one rect in a random palette colour (`rcol`, l.186–188, six-colour list at l.185). With 8% chance (l.54) the cell is subdivided into a 20×20 sub-grid where each sub-rect is kept with probability `amp = random(1)*random(0.4,1)` (l.58) — the mottled patches.
- Ghosts (l.72–139): `grid*4` iterations. Position snapped to quarter-cell steps, may start slightly off-canvas (l.78–79). 80% get an outline (l.84); 8% get a white-stroked 20×20 sub-fill (l.88–99). Then four `beginShape` quads (l.101–136) build the box shadow: each quad has the near edge at `fill(col, alp)` and the far edge at `fill(col, 0)`, so the shadow fades to zero on all four sides. `alp = random(40,80)*0.8` (l.81). A small ellipse dot marks the centre (l.138).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_14 | `int grid = int(width*1./pow(2, int(random(random(7, 8), 9))));` -> `int grid = 14;` | large (mean 0.4113, 0.921 of pixels) | fine 14x14 mosaic; cells, speckle patches and ghosts all scale down, composition much busier | variants/grid_14/frame_00001.png |
| subprob_0.5 | `      if (random(1) < 0.08) {` -> `      if (random(1) < 0.5) {` | large (mean 0.2639, 0.761 of pixels) | about half the grid cells subdivided into dense 20x20 multicolour speckle patches; mottled texture dominates | variants/subprob_0.5/frame_00001.png |
| alpha_200_255 | `float alp = random(40, 80)*0.8;` -> `float alp = random(200, 255);` | moderate (mean 0.1376, 0.453 of pixels) | near-opaque ghost shadows: thick saturated colour gradients cover most of the canvas, base grid barely visible | variants/alpha_200_255/frame_00001.png |
| dot_0.5 | `ellipse(xx+gs*0.5, yy+gs*0.5, gs*0.1, gs*0.1);` -> `... gs*0.5, gs*0.5);` | none (mean 0.0, 0.0 of pixels) | no visible change; pixel-identical render. The centre dot is never visible: at l.138 the fill state is `fill(col, 0)` left over from the far edge of the last shadow quad (l.133), so the ellipse is transparent regardless of size | variants/dot_0.5/frame_00001.png |
| palette_2 | `int colors[] = {#D9BADE, #0B25A0, #2EBF40, #FCCB03, #F84D1E, #FFFFFF};` -> `int colors[] = {#0B25A0, #FCCB03};` | large (mean 0.1745, 0.572 of pixels) | image reduces to flat deep-blue and yellow blocks with blue/yellow soft shadows; same-colour cells merge into large regions | variants/palette_2/frame_00001.png |
| ghosts_12x | `for (int i = 0; i < grid*4; i++) {` -> `for (int i = 0; i < grid*12; i++) {` | moderate (mean 0.1215, 0.386 of pixels) | 3x more ghost squares: more outlined squares, one large multicolour speckle patch, more shadow coverage; base grid still readable | variants/ghosts_12x/frame_00001.png |

## Modularisation notes
Generic, library-worthy: (1) the grain shader — a uniform-offset per-pixel alpha dither, trivially reusable on any drawing; (2) `subdivideCell` — keep-probability sub-grid, a standard mottling primitive; (3) the four-trapezoid `boxShadow` — a cheap soft shadow for axis-aligned rects; (4) `rcol` palette sampling.

One-off art decisions: the grid size via `pow(2, random(7..9))` (constrains to 3 or 7 cells), the 8% subdivision chance, ghost placement on quarter-cell offsets, `grid*4` ghost count, and the specific six-colour palette.

A clean parameter object: `{seed, grid, subdivideProb, subdivideAmp, ghostCount, ghostAlpha, dotSize, palette, displace}`.
