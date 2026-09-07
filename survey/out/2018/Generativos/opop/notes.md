---
sketch: 2018/Generativos/opop
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1661
animated: false
techniques: [grid, polar]
primitives: [shape, ellipse, rect]
palette:
  colors: ["#E70012", "#D3A100", "#017160", "#00A0E9", "#072B45"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(2,20) even", tried: [12], change: large, effect: "finer grid: more, smaller cells and tiles"}
  - {name: amp1, default: "random(0.2,0.8)", tried: [0.5], change: subtle, effect: "centred inner square size; near-identical overall"}
  - {name: palette, default: "[#E70012,#D3A100,#017160,#00A0E9,#072B45]", tried: ["[#1A1A2E,#16213E,#0F3460,#533483,#E94560]"], change: large, effect: "recolours whole piece to cool darks + pink"}
  - {name: ring_alpha, default: 20, tried: [150], change: subtle, effect: "concentric rings around tiles become visible"}
  - {name: dot_scale, default: "ss*amp2*0.25", tried: ["ss*amp2*0.5"], change: none, effect: "no visible change (dots slightly larger)"}
reusable_candidates:
  - {name: splitQuad, signature: "splitQuad(x, y, w, h, c1, c2) -> void", note: "square split into two triangles (top/bottom) filled with two colours — fake vertical gradient"}
  - {name: radialRings, signature: "radialRings(x, y, r1, r2, a1, a2, col, alp1, alp2) -> void", note: "concentric ring drawn as a fan of small alpha-faded quads (arc2)"}
---

## What it draws

Full-bleed checkerboard of large red and gold squares, each square diagonally
split into two slightly different shades (a vertical two-triangle gradient).
At every grid intersection sits a dark navy square tile containing a small red
dot, a thin pale-yellow square outline, and a faint concentric ring of circles
radiating from the tile's centre. Seed 42 resolves the random palette to
red/gold dominant with navy accents; the whole image is static.

## How the code works

`setup()` (opop.pde:3-8) sets 960x960 P2D, `smooth(8)`, then calls
`generate()` once; `draw()` (line 10-12) is empty, so the piece is static
(unless a key is pressed, line 14-20).

`generate()` (line 22-86):
- `background(rcol())` — random palette colour (line 23).
- `cc` (line 25) = even random cell count in `[2,20]`; `ss = width/cc` is the
  cell size (line 26).
- Four random palette colours `c1..c4` (lines 28-32) plus per-cell colours
  `cc1..cc4` (lines 42-45); `amp1 = random(0.2, 0.8)`, `amp2 = 1-amp1`
  (lines 39-40) control inner-tile scale.
- Double loop `i,j` from `-1..cc` (lines 51-52); positions
  `xx = ss*(i+0.5)`, `yy = ss*(j+0.5)` (lines 53-54). Checkerboard parity
  `(i+j)%2` (line 55) swaps which palette colour is primary and tints the
  secondary by `lerpColor(..., 0.05)` (lines 56-69) — this produces the
  subtle two-tone diagonal look.
- Per cell it draws: a full-cell `quad()` (line 70) — the custom `quad()`
  (lines 88-99) fills the top triangle with `cc1` and bottom with `cc2`; a
  centred inner inverted quad of size `ss*amp1` (line 71); an offset quad at
  the cell's top-left corner `(xx-ss*0.5, yy-ss*0.5)` of size `ss*amp2` with
  inverted colours (line 73) and a smaller one of size `ss*amp2*0.5`
  (line 74) — these stacked corner quads form the dark navy tiles seen at
  intersections; a small filled dot `ellipse` of size `ss*amp2*0.25` at the
  same corner (line 77); a no-fill `rect` outline with `stroke(cc1)`
  (lines 79-81); and `arc2` (line 83) — a ring from radius 0 to `ss/2` drawn
  as a fan of tiny quads with alpha 20 (lines 102-120), producing the faint
  concentric rings.
- `rcol()` (lines 128-130) picks uniformly from the 5-colour palette
  (line 127). Randomness enters only via `random()` calls at generation time;
  the harness overrides the `seed` field.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_12 | `int cc = int(random(2, 10)*random(0.5, 1))*2;` -> `int cc = 12;` | large | finer grid: many more, smaller red/gold cells and navy tiles | variants/cc_12/frame_00001.png |
| amp1_0.5 | `float amp1 = random(0.2, 0.8);` -> `float amp1 = 0.5;` | subtle | centred inner square size shifts; overall pattern near-identical | variants/amp1_0.5/frame_00001.png |
| palette_cool | `int colors[] = {#E70012, #D3A100, #017160, #00A0E9, #072B45};` -> `{#1A1A2E, #16213E, #0F3460, #533483, #E94560};` | large | whole piece recoloured to dark navy background with pink/red tiles | variants/palette_cool/frame_00001.png |
| ring_alpha_150 | `arc2(..., c1, 20, 0);` -> `arc2(..., c1, 150, 0);` | subtle | faint concentric rings around each tile now clearly visible | variants/ring_alpha_150/frame_00001.png |
| dot_0.5 | `ellipse(..., ss*amp2*0.25, ss*amp2*0.25);` -> `...0.5, ss*amp2*0.5);` | none | no visible change (dots slightly larger) | variants/dot_0.5/frame_00001.png |

## Modularisation notes

- `splitQuad` (lines 88-99) is fully generic: any two-colour vertical
  two-triangle gradient tile.
- `radialRings`/`arc2` (lines 102-120) is generic: polar fan of alpha-faded
  quads; parameterisable by radius range, angle range, two alphas.
- The checkerboard colour swap (lines 55-69) plus the 0.05 lerp tint is a
  small generic "alternating two-colour grid with faint tint" block.
- Art-specific decisions: the fixed 0.05 lerp, the 0.5 corner offset, the
  `amp2*0.25` dot scale, and the exact 5-colour palette.
- Clean parameter object: `{cells, palette, amp1, ringAlpha, dotScale,
  tintLerp}` where `cells` (cc) and `amp1` are the main compositional knobs.
