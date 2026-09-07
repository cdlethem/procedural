---
sketch: 2020/generative/01_04/cirul
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2067
animated: false
techniques: [image-source, distortion, blend-modes, grid]
primitives: [image, pgraphics]
palette:
  colors: ["#2B349E", "#F57E15", "#ED491C", "#9B407D", "#B48DC0", "#E3E8EA"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc (stamp count), default: 600, tried: [200], change: large, effect: "fewer stamps -> distinct vertical bands, less blending"}
  - {name: stamp alpha, default: "random(260)", tried: ["random(80)"], change: large, effect: "lower alpha -> darker, lower-contrast, more muted image"}
  - {name: mask grid cc, default: "random(6, 16)", tried: ["random(12, 24)"], change: none, effect: "no visible change (mask blobs are huge; snapping shift negligible after 80 blur passes)"}
  - {name: blurAmp step, default: "0.0001+i*0.004", tried: ["0.0001+i*0.001"], change: subtle, effect: "weaker smear, brush texture more legible"}
  - {name: ac (palette step), default: "random(0.2, 1.2)", tried: ["random(0.01, 0.05)"], change: moderate, effect: "slower walk -> colour lingers in one palette region; yellow/gold/cream dominant"}
  - {name: palette, default: "6-colour warm set (blue, orange, red, plum, lavender, off-white)", tried: ["5-colour set {#B85807, #FAC440, #F4C8BF, #A0B9A6, #A1B2EA}"], change: moderate, effect: "hue shifts to lavender/pink/periwinkle with orange accents"}
reusable_candidates:
  - {name: anisotropicMaskBlur, signature: "anisotropicMaskBlur(PGraphics mask, int passes, float ampStep) -> void", note: "iterative 7-tap directional Gaussian in which the direction vector is scaled per channel by a mask image -> spatially varying anisotropic smear with chromatic fringes"}
  - {name: paletteCycle, signature: "paletteCycle(int i, float step, float offset) -> color", note: "walk a palette list at a constant step, lerpColor between adjacent entries (pow 0.6 easing), wrap around"}
  - {name: brushStampField, signature: "brushStampField(PImage[] brushes, int count, float yBias) -> void", note: "randomly translated/rotated/scaled brush-image stamps with tint and ADD/NORMAL blend, y position biased to one edge"}
---

## What it draws

Full-bleed 960x960 abstract texture on a black ground: soft, smeared vertical bands
and streaks in warm tones — orange, red, dusty pink — with patches of lavender/purple,
a couple of bright near-white hotspots (upper left and upper middle), and a dark,
almost black band along the bottom edge. The smear is strongly anisotropic, mostly
vertical, with slight red/blue colour fringing on the band edges, as if a painterly
canvas had been dragged and blurred. Faint thin vertical and horizontal grid lines are
visible inside the streaks.

## How the code works

- `settings()` (L18-23): 960x960 P2D, `smooth(8)`.
- `setup()` (L25-41): loads 4 brush PNGs (`brush/brush01..04.png`), `brush2.png`,
  and `blur.glsl`; calls `generate()` once. `draw()` (L43-45) is empty, so the image
  is a single static frame (baseline frames 10/60 are identical to frame 1).
- `generate()` part 1 — the mask (L70-113): a black `PGraphics` of canvas size.
  40 iterations (L75-101) stamp a random brush with a random RGB tint, snapped to a
  grid cell `ss = width/cc` where `cc = int(random(6, 16))` (L62-63, 78-79); plus a
  20% chance of a semi-transparent white horizontal bar and a 70% chance of a black
  vertical bar per iteration (L91-100). Then 10 guaranteed white horizontal bars
  (L102-106) and 100 black vertical bars (L108-112). The mask ends up as a patchwork
  of coloured brush blobs, white horizontal bands and black vertical bands.
  background, then `cc = 600` iterations. Each stamp is `brush2` or a random
  `brush01-04` (50/50, L142), placed at random x and y biased towards the bottom
  (`val = random(1)*random(0.6, 1)`, L125-126), randomly rotated, sized up to ~1.4x
  canvas width by ~0.5x canvas height with a lerp toward square (L129-134). Colour:
  `getColor(i*ac+ic)` (L140, 188-194) walks the 6-colour palette with a constant
  random step `ac = random(0.2, 1.2)` (L120) and random offset `ic` (L119), lerping
  between adjacent palette entries; alpha `random(260)` is near-opaque. Blend mode:
  ADD for 20% of stamps, NORMAL otherwise (L136-138) — the ADD stamps produce the
  bright white/pink hotspots.
- `generate()` part 3 — the shader pass (L152-164): `blur.glsl` is applied 80 times.
  Each pass is a 7-tap 1-D Gaussian (`blur13`, glsl L129-142) along a random
  direction `ang` with magnitude `0.0001 + i*0.004` (L159) — growing to ~0.32 in
  texture units, so later passes smear across most of the canvas (texture wrap
  makes the streaks). The direction is multiplied per RGB channel by the mask's
  colour (glsl L159-161): black mask -> no blur, white -> full blur, coloured ->
  each channel smears a different distance, which produces the chromatic fringing.
  The mask's vertical black bars keep vertical streaks intact while the white bands
  smear.
- Note: `blur.set("time", ...)` (L157) has no effect — the shader never reads
  `time` (its noise-displacement block is commented out, glsl L148-153), which is
  why stderr warns about the unused uniform. So `it`/`dt` (L154-155) do nothing.

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_200 | `cc = 600;` -> `cc = 200;` | large | distinct vertical bands, less blended; same warm palette, white hotspot upper left, dark bottom | variants/cc_200/frame_00001.png |
| alpha_80 | `tint(getColor(i*ac+ic), random(260));` -> `tint(getColor(i*ac+ic), random(80));` | large | overall darker and lower-contrast; muted orange/purple wash, banding similar | variants/alpha_80/frame_00001.png |
| maskGrid_12_24 | `int cc = int(random(6, 16));` -> `int cc = int(random(12, 24));` | none | no visible change | variants/maskGrid_12_24/frame_00001.png |
| blurAmp_0.001 | `float blurAmp = 0.0001+i*0.004;` -> `float blurAmp = 0.0001+i*0.001;` | subtle | subtle: smear weaker, brush clumps (orange, red, lavender) more legible, banding less dominant | variants/blurAmp_0.001/frame_00001.png |
| ac_0.03 | `float ac = random(0.2, 1.2);` -> `float ac = random(0.01, 0.05);` | moderate | palette walk slows: yellow/gold/cream/orange dominant, less red/plum; banding similar | variants/ac_0.03/frame_00001.png |
| palette_warm5 | `int colors[] = {#2B349E, ...};` -> `int colors[] = {#B85807, #FAC440, #F4C8BF, #A0B9A6, #A1B2EA};` (first attempt uncommented a duplicate field -> compile_error, fixed by editing the active line) | moderate | hue shifts to lavender/pink/periwinkle with orange at the bottom; banding and hotspots unchanged | variants/palette_warm5/frame_00001.png |

## Modularisation notes

- Generic / library candidates: the mask-modulated anisotropic blur (part 3) is the
  core effect and is fully decoupled from the content — `anisotropicMaskBlur(mask,
  passes, ampStep)` could take any PGraphics mask and any PGraphics/content. The
  palette-walk `getColor(v)` is a small self-contained colour function. The
  brush-stamp field (part 2) is a standard "stamp N randomised images with tint and
  blend" loop, parameterisable by count, size ranges, y-bias, alpha and ADD
  probability.
- One-off art decisions: the specific mask recipe (40 tinted brush blobs + 10 white
  bars + 100 black bars), the exact palette, the brush PNG assets, and the
  0.0001+i*0.004 amplitude ramp.
- A clean parameter object would contain: `{ stampCount, stampSizeRange, yBias,
  alpha, addProb, palette, paletteStep, maskGridCells, maskBlobs, maskWhiteBars,
  maskBlackBars, blurPasses, blurAmpStep }`.
