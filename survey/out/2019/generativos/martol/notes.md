---
sketch: 2019/generativos/martol
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1623
animated: false
techniques: [grid, 3d-mesh, distortion, blend-modes]
primitives: [shape]
palette:
  colors: ["#F33F3E", "#0155AD", "#277143", "#F1F5F4"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
  - {name: wavyStripedPatch, signature: "wavyStripedPatch(x, y, cols, rows, cellW, cellH, waveFreq, waveAmp, palette, rowAlpha) -> void", note: "one perspective-warped grid of per-row-coloured stripes, z = cos(x*freq)*amp"}
---

## What it draws
On a black background, dozens of overlapping rectangular panels, each made of thin
horizontal stripes in red, blue, green and off-white. Every panel is a gently
undulating sheet (the stripes ripple like a sine wave across its width) and the
whole scene is viewed in perspective with a slight random tilt. Because of
additive blending, where panels overlap the stripes glow with mixed hues
(cyan, orange, magenta, pale yellow). Panel sizes vary widely: large panels are
~300 px, small ones dissolve into dense hairline stripe texture.

## How the code works
- `setup()` calls `generate()` once (line 23); `draw()` is empty (line 31), so the
  image is a single static pass — no animation, no time dependence.
- `generate()` (line 51): `randomSeed`/`noiseSeed` (53-54), `background(0)` (56),
  `blendMode(ADD)` (58). Perspective camera with fov = PI/8 (61-64), then small
  random tilts: `rotateX/Y(-0.2..0.2)`, `rotateZ(-0.4..0.4)` (66-68).
- Outer loop, 160 iterations (line 70), one panel each:
  - cell sizes `ww = 20/2^n`, `hh = 30/2^n`, `n = int(random(1,7))` (72-73),
    so cells range 10..0.3 px wide and 15..0.47 px tall — this is what creates
    both the bold stripes and the hairline texture;
  - `stroke(0, 70)` thin dark edge (74); placed at `random(width), random(height)`
    via `translate` (75); a "main" colour `rcol()` per panel (76).
  - Panel body is one `beginShape(QUADS)` (77): wave frequency `vo =
    random(0.04)`, amplitude `amp = random(30, 50)*0.6` (78-79). For each of 20
    rows `j` (80): row alpha `alp = random(200,240)*0.6` (81) and a per-row fill
    colour — 50% the panel's main colour, else a random palette colour, with a
    further 50% chance of being replaced by another random colour (82-83). For
    each of 30 columns `i` (85) a quad of four corners at
    `i*ww..i*ww+ww` x `j*hh..j*hh+hh`, every corner displaced in z by
    `cos(xx*vo)*amp` (88-101) — the cosine ripple warps the whole panel; colour
    is constant per row, so rows read as stripes.
- Palette: 11-entry `int colors[]` of red `#F33F3E`, blue `#0155AD`, green
  `#277143`, white `#F1F5F4` (red/blue/green each listed 3x, white 2x) (line
  150); `rcol()` picks uniformly (152). ADD blending on black makes overlaps
  brighter and shifts hue (red+blue -> magenta, green+blue -> cyan, etc.);
  per-row alpha ~120-144 keeps stripes semi-transparent.
- Dead code, never called: `Rect` class (41-49), `arc2` (131-148), `getColor`
  (154-163); the toxi/triangulate imports are unused (no `noise()` call either).
- Baseline note: `frame_00010.png`/`frame_00060.png` differ from frame 1 (54% of
  pixels, white/cyan corruption) even though the code is fully static — a
  headless P3D capture artifact on this display. Frame 1 matches the code
  (black background, ADD colour) and is the trustworthy render.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The generic, reusable block is the wavy striped panel itself: a cols x rows grid
of quads with per-row colour, per-row alpha, and a cosine z-displacement
(`wavyStripedPatch` above) — everything about it (cell sizes, wave freq/amp,
palette, alpha) is already parameterised by locals. The scatter loop (160 panels,
random placement, per-panel cell size from a power-of-two ladder) is a
reasonable generic "scatter N patches" wrapper. One-off art decisions: ADD blend
mode, the black background, the 3D tilt ranges and fov, and the specific
red/blue/green/white palette. A clean parameter object would be:
`{panels, cols, rows, cellW, cellH, waveFreq, waveAmp, rowAlpha, palette, tiltX, tiltY, tiltZ, fov}`.
