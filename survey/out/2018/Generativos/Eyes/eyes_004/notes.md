---
sketch: 2018/Generativos/Eyes/eyes_004
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1592
animated: false
techniques: [grid, subdivision, symmetry, dots-stippling]
primitives: [rect, ellipse, arc, shape]
palette:
  colors: ["#D81D03", "#101A9D", "#1C7E4E", "#F6A402", "#EFD4BF", "#E2E0EF", "#050400", "#F0F0F0", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(100))", tried: [20], effect: "subdivision iterations; more = finer, busier mosaic of more, smaller eyes"}
  - {name: ss, default: "r.z*random(0.6, 0.8)", tried: [0.35], effect: "sclera size as a fraction of its cell; smaller = eye shrinks, larger empty margins"}
  - {name: s1, default: "ss*random(0.4, 0.8)", tried: [0.25], effect: "iris size as a fraction of the sclera; smaller = tiny iris, mostly-white eye"}
  - {name: grainCount, default: 4000, tried: [0], effect: "count of faint white speckle arcs scattered over the whole canvas; 0 = clean surfaces"}
  - {name: colors, default: "7-colour warm/cool mix", tried: ["cool 7-colour blues"], effect: "palette sampled per cell background, iris and background"}
reusable_candidates:
  - {name: quadtreeMosaic, signature: "quadtreeMosaic(size, iterations) -> Rect[]", note: "recursive random quad subdivision into a list of squares"}
  - {name: eye, signature: "eye(cx, cy, sclera, iris, pupil, irisColor) -> void", note: "concentric ellipse + soft arc-ring shading, white glint"}
  - {name: softRing, signature: "softRing(cx, cy, r1, r2, a1, a2, col, shd1, shd2) -> void", note: "arc2: ring approximated by filled quads between two radii with two shades"}
  - {name: grain, signature: "grain(count, color, alpha) -> void", note: "scattered short white arcs for film-grain texture"}
---

## What it draws
A full-bleed mosaic of squares of many sizes (a random quadtree subdivision of the 960×960 canvas),
each tile painted a solid random colour and holding a single cartoon eye centred in it. Every eye is a
stack of concentric circles — a big off-white sclera with a soft shaded rim, a coloured iris ring, a
black pupil, and a small white glint offset to the upper-left — so the whole image reads as a grid of
staring eyes at different scales. A faint white speckle/grain is scattered evenly across everything on top.

## How the code works
- `setup()` (L3–9) calls `generate()` once; `draw()` (L11–12) is empty, so the piece is static and
  regenerated only on a key press (`keyPressed`, L14–20).
- `generate()` (L22–84):
  - Background painted a random palette colour (`rcol()`, L23).
  - **Subdivision** (L25–37): starts with one square covering the full width in a list `rects`
    (stored as `PVector(x, y, size)`). Loops `sub = int(random(100))` times (L27); each pass picks a
    random square, removes it, and splits it into four half-size quadrants (L31–36). Each pass grows
    the list by 3, so the final number of tiles is `1 + 3*sub`. This produces the varied mosaic of
    large and small squares.
  - **Eyes** (L39–74): for each tile, fills it `rcol()` and draws a `rect` (L42–43). Sizes are derived
    as a fraction of the tile: `ss` sclera (L44, `0.6–0.8` of tile), `s1` iris (L45, `0.4–0.8` of
    sclera), `s2` pupil (L46, `0.5–1.0` of iris) — all random, so eye proportions vary per tile.
    `arc2` (L50–51, 55–56, 61, 63, 69–70, 73) draws soft shaded rings around the sclera/iris/pupil
    using two close shades to fake depth. A near-white `ellipse` (L54, fill 240) is the sclera,
    `rcol()` `ellipse` (L59) the iris, a thin dark `arc` (L61) its rim, black `ellipse` (L66) the
    pupil, and two white arcs (L69–70) the offset glint.
  - **Grain** (L76–83): 4000 iterations draw short white `arc` strokes at random positions with low,
    random alpha — the speckle seen over the whole image.
- `arc2` (L86–104): builds a ring between outer radius `r1` and inner radius `r2` over an angle range
  as a fan of small filled quads (`beginShape`/`vertex`), alternating two shades (`shd1`/`shd2`) for a
  soft banded look. Segment count `cc` scales with the arc length and radius (L91).
- **Colour**: `rcol()` (L112–114) picks uniformly at random from the 7-colour `colors[]` array
  (L111). `getColor`/`getColor(float)` (L115–124) lerp between neighbouring palette colours but are
  never called from `generate()` — only `rcol` is used.
- Randomness enters only through the seed (L1) and the many `random(...)` calls; with the same seed the
  layout, proportions, colours and grain are fully reproducible (deterministic: true).

## Experiments
| variant | substitution | observation | image |
|---|---|---|---|
| sub_20 | `  int sub = int(random(100));` -> `  int sub = 20;` | denser mosaic: more, smaller tiles and a busier composition of many small eyes | variants/sub_20/frame_00001.png |
| ss_0.35 | `    float ss = r.z*random(0.6, 0.8);` -> `    float ss = r.z*0.35;` | sclera shrinks to ~35% of its tile; eyes become small dots in large empty coloured squares | variants/ss_0.35/frame_00001.png |
| palette_cool | `int colors[] = {#D81D03, #101A9D, #1C7E4E, #F6A402, #EFD4BF, #E2E0EF, #050400};` -> cool 7-colour blues | identical cell layout, recoloured to a monochrome blue/white/black family | variants/palette_cool/frame_00001.png |
| grain_0 | `  for (int i = 0; i < 4000; i++) {` -> `  for (int i = 0; i < 0; i++) {` | speckle removed; tiles and sclera read as flat, clean surfaces | variants/grain_0/frame_00001.png |
| s1_0.25 | `    float s1 = ss*random(0.4, 0.8);` -> `    float s1 = ss*0.25;` | iris ring shrinks to a quarter of the sclera; eyes are mostly white with a tiny pupil | variants/s1_0.25/frame_00001.png |

## Modularisation notes
- **Generic / library-ready:**
  - `quadtreeMosaic(size, iterations)` — the L25–37 random quad subdivision is a clean, reusable
    generative-primitive (returns a list of non-overlapping squares).
  - `softRing`/`arc2` — the shaded ring built from two-radius quad fans is a reusable shading
    primitive (soft annulus with two tones).
  - `grain(count, ...)` — the L76–83 speckle pass is a standalone post-effect.
  - `rcol()` / palette lerp (`getColor(float)`) — a palette sampler, though the lerp version is
    currently dead code.
- **One-off art decisions:** the specific eye anatomy (sclera/iris/pupil/glint ratios, the `0.6–0.8`,
  `0.4–0.8`, `0.5–1.0` fractions, the offset glint, the 7-colour warm/cool palette) are the author's
  cartoon-eye look, not general utilities.
- **Clean parameter object** would carry: `size`, `iterations` (subdivision), `scleraRange`,
  `irisRange`, `pupilRange`, `palette[]`, `grainCount`, `grainAlpha`, `seed`. The eye itself could be
  a function `eye(x, y, cell, scleraFrac, irisFrac, pupilFrac, irisColor)` taking those ratios.
