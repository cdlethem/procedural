---
sketch: 2018/Generativos/salchis
year: 2018
renderer: P2D
size: [2048, 2048]
libraries: []
deterministic: true
ms_first_frame: 1961
animated: false
techniques: [noise-field, flow-field, grid, typography, shader]
primitives: [rect, shape, text]
palette:
  colors: ["#181818", "#202020", "#FF823A", "#0017FF", "#FF5100", "#F8AD01", "#FB4240", "#E6ECF0", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: ribbonCount, default: 30, tried: [60], change: moderate, effect: "more ribbons; canvas fills up, same style"}
  - {name: ribbonSteps, default: 122, tried: [300], change: moderate, effect: "longer walks; ribbons span the canvas, more interwoven"}
  - {name: ribbonUnderWeight, default: 90, tried: [40], change: none, effect: "no visible change; underlayer hidden behind the 80px mid layer"}
  - {name: ribbonScale, default: "random(0.001, 0.006)", tried: ["random(0.001, 0.002)"], change: moderate, effect: "smoother noise field; strokes become short shallow arcs, less meandering, sparser"}
  - {name: wispCount, default: 60, tried: [240], change: subtle, effect: "more thin pale wisps visible as fine specks/dashes; overall look nearly the same"}
  - {name: cellSize, default: "random(180, 320)", tried: ["random(90, 160)"], change: subtle, effect: "smaller, denser letter grid; smaller glyphs"}
reusable_candidates:
  - {name: noiseWalk, signature: "noiseWalk(x, y, steps, stepLen, noiseScale, noiseOffset) -> PVector[]", note: "random-walk a point following a 2-D noise angle field"}
  - {name: grainShader, signature: "grainShader(vertSrc, fragSrc) -> PShader", note: "per-pixel rand() alpha modulation that turns flat fills/strokes into a dithered grain"}
  - {name: charGrid, signature: "charGrid(phrase, cellSize, sizeRange, font, shadowOffset) -> void", note: "grid of random letters from a phrase, each with a small dark offset shadow"}
---

## What it draws
Near-black canvas with a faint 8 px dot grid. Over it, roughly 30 thick
ribbon-like strokes (red, orange, amber, blue) with a grainy, dithered
texture meander across the whole canvas, layered so a dark under-copy and a
saturated top copy of the same path overlap. Scattered on top is a grid of
white letters (s, e, n, d, u) at varying sizes, each with a faint dark
offset shadow, plus a few very thin pale curved wisps barely visible on the
dark ground.

## How the code works
`setup()` (lines 6-18) sizes the canvas 2048x2048 P2D, loads the grain
shader `noiseShadowFrag.glsl`/`noiseShadowVert.glsl` and a Saira-Thin font
(falls back to a default font; see stderr), then calls `generate()` once;
`draw()` is empty, so the piece is static.

`generate()` (lines 31-161):
1. Dark ground + dot grid: `background(#181818)` (line 32); a 40 px grid of
   8 px rects filled `#202020` (lines 35-37) drawn through the grain shader,
   and `fill(255, 2)` 8 px dots (lines 39-44) give the faint visible grid.
2. Thick ribbons (lines 56-103): 30 walks, each starting at a random point
   (lines 61-63) and stepping 122 times (line 66) along
   `ang = noise(des + x*det, des + y*det) * TWO_PI * 2` with `det` in
   [0.001, 0.006] (line 59), step length 4 (lines 69-70) — a noise-driven
   flow-field walk. Each polyline is drawn three times on the same points:
   black `stroke(0, 8)` weight 90 through the grain shader (lines 73-82),
   solid `#FF823A` weight 80 (lines 84-91), and a random palette colour
   `rcol()` weight 80 through the grain shader (lines 93-102). The grain
   shader (noiseShadowFrag.glsl line 20) multiplies alpha by a per-pixel
   hash, producing the speckled texture.
3. Thin wisps (lines 105-140): 60 walks of ~16 single-pixel steps with a
   much higher noise scale `det` in [0.04, 0.12] (line 107), drawn black
   weight 2 through the shader and pale `#E6ECF0` weight 1 — barely visible
   on the dark ground.
4. Text grid (lines 142-160): a cell grid of size `ss` in [180, 320] px,
   centred, one random character from the phrase "send nudes" per cell
   (lines 149-150), size random in [0.2 ss, 0.8 ss] (line 151), drawn first
   in `fill(0, 20)` offset by (8, 5) as a shadow (lines 155-156) then in
   white (lines 157-158).
5. `rcol()` (lines 194-197) picks randomly from
   `{#0017FF, #FF5100, #F8AD01, #FB4240}`; `getColor()` (interpolating
   variant) is defined but unused. `drawLine()` (lines 163-184) is dead
   code, never called.

Note: `uses_shader` is true but the render ran on display `:2` (not xvfb),
and the grain effect is clearly present in the baseline image, so the
shader renders correctly here.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ribbonCount_60 | `for (int i = 0; i < 30; i++) {` -> `for (int i = 0; i < 60; i++) {` | moderate | canvas noticeably denser with twice as many ribbons; previously empty areas (top-left, right) now covered; style unchanged | variants/ribbonCount_60/frame_00001.png |
| ribbonSteps_300 | `for (int j = 0; j < 122; j++) {` -> `for (int j = 0; j < 300; j++) {` | moderate | longer, more sinuous ribbons that cross the whole canvas; composition more tangled and interconnected | variants/ribbonSteps_300/frame_00001.png |
| ribbonWeight_40 | `    strokeWeight(90);` -> `    strokeWeight(40);` | none | no visible change; the black underlayer (alpha 8) at 40px is fully covered by the 80px solid mid layer | variants/ribbonWeight_40/frame_00001.png |
| ribbonScale_0.002 | `float det = random(0.001, 0.006);` -> `float det = random(0.001, 0.002);` | moderate | lower noise scale = gentler field; strokes become short, shallow, near-straight arcs; canvas looks sparser and calmer | variants/ribbonScale_0.002/frame_00001.png |
| wispCount_240 | `for (int i = 0; i < 60; i++) {` -> `for (int i = 0; i < 240; i++) {` | subtle | fine pale specks and short dashes more evenly scattered across the dark ground; ribbons and text otherwise unchanged | variants/wispCount_240/frame_00001.png |
| cellSize_90 | `float ss = random(180, 320);` -> `float ss = random(90, 160);` | subtle | letter grid smaller and denser; glyphs noticeably smaller (size range scales with cell), ribbons unchanged | variants/cellSize_90/frame_00001.png |

## Modularisation notes
- `noiseWalk` (the two walk loops, lines 60-71 and 108-139) is the core
  generic primitive: parameterise steps, step length, noise scale, noise
  offset, and an optional per-step callback. The thick/thin difference is
  just parameter values (step length 4 vs 1, scale range, count).
- The triple-draw of one polyline (dark grainy underlayer, flat mid-layer,
  coloured grainy top) is a reusable "ribbon" style recipe:
  `drawRibbon(points, weight, underColor, midColor, topColor)`.
- `charGrid` is generic (phrase, cell size, size range, shadow offset); the
  specific phrase and the (8, 5) shadow are art decisions.
- The grain shader is a drop-in reusable effect for any 2D sketch; its only
  knob is the exponent/fraction of the alpha curve (line 20 of the frag).
- A clean parameter object: `{ribbonCount, ribbonSteps, ribbonStepLen,
  ribbonScale: [min, max], ribbonWeight, wispCount, wispSteps, wispScale,
  gridCell, textSizeRange, palette, phrase}`.
- One-off decisions: the "send nudes" phrase, Saira-Thin font, fixed
  `#FF823A` mid-layer, the 40 px dot grid, and the specific 4-colour
  palette.
