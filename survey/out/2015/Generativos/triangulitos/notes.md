---
sketch: 2015/Generativos/triangulitos
year: 2015
renderer: P2D
size: [640, 640]
libraries: []
deterministic: true
ms_first_frame: 1564
animated: false
techniques: [grid, symmetry]
primitives: [shape, ellipse]
palette:
  colors: ["#F7F7F7", "#6C6B6B", "#FFED4B", "#51D8A1"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: tt (grid cell size), default: "5, 20, 40, 80 (one picked at random)", tried: [5], change: none, effect: "no visible change — seed 42 already resolves tt=5, so forcing all cells to 5 is byte-identical to baseline"}
  - {name: pos (triangle-vs-cross threshold), default: "random(1)", tried: [0.0], change: moderate, effect: "0.0 makes random(1)<pos always false -> every shape is a 4-point cross, all gradient triangles vanish"}
  - {name: cc (shape count), default: "nested random(1,1000), small-biased", tried: [300], change: moderate, effect: "fixed 300 shapes -> much denser field, triangles and crosses fill most of the canvas"}
  - {name: dotAlpha (background dot fill alpha), default: 8, tried: [90], change: none, effect: "no visible change; 3px dots are too sparse to move the pixel diff (mean 0.0036)"}
  - {name: b (border / grid offset), default: 2, tried: [30], change: moderate, effect: "grows dx=dy=tt*b and shrinks cw/ch -> whole cluster shifts center-right with a large empty margin top-left"}
reusable_candidates:
  - {name: cross, signature: "cross(x, y, d, a, s) -> void", note: "4-armed star/cross polygon; d = arm length, a = base angle, s = waist spread (thinness)"}
  - {name: rcol, signature: "rcol() -> color", note: "lerpColor between two random palette colors at a random factor -> blends near palette hues"}
  - {name: cornerTriangle, signature: "cornerTriangle(x, y, nx, ny, cell) -> void", note: "right-angle triangle built from two perpendicular cell-grid legs; per-vertex fills give a smooth gradient"}
---

## What it draws
A pale-yellow full-bleed field with a loose cluster of flat geometric marks concentrated
center-left. Most marks are large right-angle triangles whose fills run as smooth two-color
gradients (teal-to-yellow, grey-green, pale blue-green); each triangle is rimmed by a faint
dark halo. Scattered among them are several 4-pointed star/cross shapes in solid green,
yellow and grey, of varying sizes. Faint near-invisible dots sit on a fine background grid.
The palette reads as muted yellow, seafoam green/teal and grey.

## How the code works
Everything is generated once in `generate()` (line 34), called from `setup()` (line 23); `draw()`
is empty (line 26) so the piece is static. Flow:

- `background(rcol())` (35) fills the canvas with a random lerp between two palette colors —
  here a pale yellow (blend of `#FFED4B` toward `#F7F7F7`).
- A grid resolution `tt` is picked from `ttt = {5, 20, 40, 80}` (36-39); `cw`/`ch` (41-42) are the
  cell counts and `dx`/`dy` (43-44) the border offset, so all geometry snaps to a cell grid.
- A faint dot grid: `fill(255, 8)` + 3px ellipse at every cell (45-51) — the barely-visible dots.
- `cc` (52) is the shape count, produced by a nested `random` that biases strongly toward small
  numbers; `pos` (53) is a per-run threshold that splits triangle vs cross.
- Per shape (54-90): a size `t` (55, cell count, small-biased), a grid position (56-57) and two
  leg directions `nx`,`ny` (58-59, each `+t` or `-t`).
  - If `random(1) < pos` (62): draw a right-angle **triangle** from the corner point (65-69).
    First a dark near-transparent outline is stroked 5 times with `strokeWeight` 5..1 (63-69) —
    the faint halo; then a filled triangle where **each of the 3 vertices gets its own `rcol()`**
    (71-78) — Processing interpolates between vertex colors, which is what produces the smooth
    gradient across each triangle.
  - Else (79-88): draw a **cross/star** via `cross()` (93) at the corner point, size `tt*t`,
    angle `PI/4`, waist spread `random(0.1,0.3)`, with the same 5-pass dark halo plus one solid
    `rcol()` fill.
- `rcol()` (117-119) does `lerpColor(colors[i], colors[j], random(1))` between two random palette
  entries — hence "lerp-between" selection and the muted blended tones.
- `post.glsl` is loaded (21-22) but `filter(post)` is commented out (89), so the shader is never
  applied; the P2D buffer is the final image.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ttt_5 | `5, 20, 40, 80` -> `5, 5, 5, 5` | none | no visible change — baseline already used the finest grid (tt=5), so forcing it is identical | variants/ttt_5/frame_00001.png |
| pos_0 | `float pos = random(1);` -> `float pos = 0.0;` | moderate | every mark becomes a 4-point cross; all gradient triangles disappear | variants/pos_0/frame_00001.png |
| cc_300 | `int cc = int(random(1, random(1, random(1, 1000))));` -> `int cc = 300;` | moderate | far denser field; gradient triangles and crosses cover most of the canvas | variants/cc_300/frame_00001.png |
| dotAlpha_90 | `fill(255, 8);` -> `fill(255, 90);` | none | no visible change; only a faint 3px background dot grid is perceptible on close inspection | variants/dotAlpha_90/frame_00001.png |
| b_30 | `int b = 2;` -> `int b = 30;` | moderate | same cluster shifted center-right, large empty margin top-left (grid offset grows, usable cells shrink) | variants/b_30/frame_00001.png |

## Modularisation notes
- Generic / reusable: `cross(x,y,d,a,s)` (line 93) is a self-contained 4-armed star builder with
  clean parameters (arm length, base angle, waist spread) — a good library primitive. `rcol()`
  (117) is a general "random palette blend" helper. The per-vertex-fill right-angle triangle
  (65-78) is a reusable "gradient corner triangle on a cell grid".
- Art-specific one-offs: the particular `ttt` grid set, the small-biased nested `random` for
  `cc`/`t`, and the 50/50 triangle-vs-cross split via `pos`.
- A clean parameter object: `{ cellSize: tt, count: cc, triangleProb: pos, outlinePasses: 5,
  outlineAlpha, dotAlpha, spread: [0.1,0.3], palette: [...] }`.
