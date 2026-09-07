---
sketch: 2015/Generativos/bolaParticulas
year: 2015
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 356
animated: false
techniques: [particles, polar, lines-hatching]
primitives: [line, ellipse, shape]
palette:
  colors: ["#FFE80F", "#D7EBF2", "#FA2157", "#52F097", "#FFC981"]
  selection: random-from-list
composition: radial
parameters:
  - {name: wormCount, default: 200, tried: [400], change: moderate, effect: "denser burst with more overlap, same extent"}
  - {name: wormSteps, default: "80-220", tried: ["80-400"], change: moderate, effect: "longer, thinner tails; tendrils reach further"}
  - {name: startSize, default: "20-60", tried: ["20-120"], change: subtle, effect: "fatter, chunkier worms, similar extent"}
  - {name: speed, default: "0.8-2", tried: ["0.8-4"], change: moderate, effect: "tendrils reach much further, more spread and stretched"}
  - {name: hatchSep, default: "10-32", tried: ["10-64"], change: none, effect: "no visible change; hatch stays faint"}
  - {name: markCount, default: 40, tried: [100], change: none, effect: "no visible change; small marks lost in the burst"}
reusable_candidates:
  - {name: tendril, signature: "tendril(cx, cy, angle0, size0, speed, steps, c1, c2) -> void", note: "random-walk angle, shrinking ellipse size, color lerp along the walk — one tapered squiggle"}
  - {name: hatchedBackground, signature: "hatchedBackground(sep, bg, lineColor) -> void", note: "parallel 45° lines covering the canvas, spacing and weight derived from sep"}
  - {name: pinwheelMark, signature: "pinwheelMark(x, y, size, ringColor) -> void", note: "gray disc + partial ring + crossed strokes, used as scattered accent glyphs"}
---

## What it draws
A dense radial burst of ~200 wavy, tapered "worm" strokes fanning out from the center in a roughly
circular shape. Dominant colours are yellow, green and pink-red with orange and pale blue accents,
on a light gray ground covered with faint 45° hatching lines. Around the center are ~40 small
gray disks each carrying a white X (a few with a partial white ring), like tiny pinwheels or
screws, denser near the middle.

## How the code works
`setup()` (bolaParticulas.pde:9) calls `generar()` once; `draw()` (line 14) is empty, so the piece
is static — it only regenerates on keypress (line 17-20).

- Background (line 23-29): `background(230)` light gray; `sep = int(random(10, 32))`; a loop from
  `i = -sep` to `width+height` step `sep` draws `line(-2, i, i, -2)` — equally spaced 45° hatch
  lines with `strokeWeight(sep/3)`, so denser spacing means thinner lines.
- Worms (line 31-50): 200 iterations. Each worm starts at the canvas center with a random angle
  `a`, starting size `t = random(20, 60)`, step speed `vel = random(0.8, 2)`, and a random length
  `cc = int(random(80, 220))`. Per segment the angle random-walks by `±0.1` rad (line 42) — this
  makes the squiggle — position advances by `vel` along `a` (lines 43-44), and `t *=
  random(0.98, 1)` shrinks the ellipse each step (line 45), producing the tapered, fading tail.
  Colour: two random palette entries (line 32-33, `rcol()` line 82) lerped by progress
  `i/cc` (line 46). `noStroke()` (line 39).
- Pinwheel marks (line 52-73): 40 iterations at a random angle and radius
  `ss = noise(i)*width/2*random(1)` — the `random(1)` factor pushes most marks to the inner half
  of the burst. Each draws a gray semi-transparent disc `fill(120, 200)` of size `tt*4`
  (line 60-62), a white partial ring `arc` (line 66-68), then two crossed white lines of
  weight `tt*0.7` (line 71-72) — the X.
- No noise-field, no blend modes, no shader; all randomness is Processing's seeded `random()`,
  so the output is deterministic per seed (baseline `deterministic: true`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| worms_400 | `for (int j = 0; j < 200; j++) {` -> `... j < 400 ...` | moderate (mean 0.0595, 0.211) | burst noticeably denser, more overlapping worms, roughly the same extent | variants/worms_400/frame_00001.png |
| cc_400 | `int cc = int(random(80, 220));` -> `int cc = int(random(80, 400));` | moderate (mean 0.0918, 0.32) | tendrils are longer and thinner with more wispy tails extending further out | variants/cc_400/frame_00001.png |
| t_120 | `float t = random(20, 60);` -> `float t = random(20, 120);` | subtle (mean 0.0359, 0.129) | subtle: worms are fatter and chunkier (thicker heads), similar overall extent | variants/t_120/frame_00001.png |
| vel_4 | `float vel = random(0.8, 2);` -> `float vel = random(0.8, 4);` | moderate (mean 0.1146, 0.428) | tendrils reach much further toward the edges, burst more spread and stretched, more sparse | variants/vel_4/frame_00001.png |
| sep_64 | `int sep = int(random(10, 32));` -> `int sep = int(random(10, 64));` | none (mean 0.0086, 0.0) | no visible change; the 45° hatch is very faint (stroke 236 on bg 230) so wider spacing is imperceptible | variants/sep_64/frame_00001.png |
| marks_100 | `for (int i = 0; i < 40; i++) {` -> `... i < 100 ...` | none (mean 0.0059, 0.022) | no visible change; the extra small gray X-marks are tiny (≤32 px) and lost inside the burst | variants/marks_100/frame_00001.png |

Note: the first `marks_100` run failed with `bad_sub` (wrong indentation in OLD); the re-run with the
exact 2-space-indented line succeeded. 7 render commands total (1 failure).

## Modularisation notes
- Generic blocks: `tendril` (tapered random-walk stroke with colour lerp) is a clean library
  function; the 200-worm loop is just N independent tendril calls with shared center.
  `hatchedBackground(sep)` is a reusable backdrop. `pinwheelMark` is a self-contained glyph.
- Art decisions: the 5-colour palette, the center-outward radial placement, the gray X-marks as
  accents, and the `random(1)` radius falloff for the marks are specific to this piece.
- A clean parameter object: `{wormCount: 200, steps: [80, 220], startSize: [20, 60], speed:
  [0.8, 2], angleWander: 0.1, palette: [...], hatchSep: [10, 32], markCount: 40, markSize: 8}`.
