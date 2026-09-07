---
sketch: 2019/generativos/dondon003
year: 2019
renderer: P3D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 2149
animated: false
techniques: [noise-field, grid, pixel-ops, distortion]
primitives: [rect, text, pgraphics]
palette:
  colors: ["#043387", "#0199DC", "#BAD474", "#FBE710", "#FFE032", "#EB8066", "#E7748C", "#DF438A", "#D9007E", "#6A0E80"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: 900, tried: [300], change: large, effect: "coarser grid cells; streaks are fixed-length in buffer pixels so they look much longer; field also re-rolled (non-deterministic)"}
  - {name: detCol, default: "random(0.02,0.026)*0.04 (~0.0009)", tried: ["*0.12 (~0.0027)"], change: large, effect: "colour blobs noticeably smaller and more fragmented/mottled; field re-rolled too"}
  - {name: streakCount, default: 400, tried: [10], change: large, effect: "dashes almost vanish (one visible); large score is mostly the field re-roll, not the parameter"}
  - {name: palette, default: "10-colour rainbow (#043387..#6A0E80)", tried: ["7-colour warm/dark (#121B4B..#F0D5CA)"], change: large, effect: "complete recolour: orange/pink/cream/dark navy instead of yellow/cyan/magenta"}
  - {name: rotZ, default: "HALF_PI*random(0.5,2)", tried: ["HALF_PI*random(0.01)"], change: large, effect: "grid and streaks become axis-aligned instead of rotated; field re-rolled too"}
reusable_candidates:
  - {name: noiseGridPixels, signature: "noiseGridPixels(cc, det, ampDetail, palette) -> PImage", note: "cc x cc pixel buffer where each pixel colour is palette-lerped by 3-D fbm sampled with an amplitude modulated by a second noise layer"}
  - {name: streakSpeckle, signature: "streakSpeckle(img, count, maxLen, palette)", note: "scatter short horizontal colour streaks at random pixel rows"}
---

## What it draws
A full-bleed field of large, soft-edged colour blobs: a dominant yellow region in the centre, cyan/blue masses and magenta/pink patches around the edges, all on a black background. Over the field there is a fine regular grid texture (the whole image looks made of tiny squares, slightly rotated), a scatter of small short coloured dashes running diagonally across the image, a few faint thin square outlines, and tiny illegible "ABC" text marks. The image is static (identical across frames).

## How the code works
`setup()` calls `generate()` once (dondon003.pde:25); `draw()` is empty. Everything happens in `generate()` (dondon003.pde:64-246):

1. `randomSeed(seed)`/`noiseSeed(seed)` (66-67) seed Processing's randoms, but the custom `DoubleNoise` class (NoiseDouble.pde) keeps its own unseeded `java.util.Random` (line 48) — hence the baseline is marked non-deterministic.
2. A black background (70), then the main view is rotated: `translate` to centre, `rotateX(HALF_PI*random(0.08))`, `rotateZ(HALF_PI*random(0.5, 2))` (72-83). This is why the grid texture looks slightly rotated and perspective-tilted.
3. Ten random points on a coarse 50-cell grid (95-99) become the "anchor" points: each gets a pixel mark and a tiny "ABC" text in the offscreen buffer (159-170), and in the main view a `box(1,1,20)` + 80x80 rect outline (198-209) — the faint square outlines visible in the image.
4. Core image: an offscreen `PGraphics` buffer of `cc x cc` = 900x900 (88, 101). Every pixel's colour is computed per-pixel (120-131): `dn.noise` (9-octave custom double Perlin) sampled at a low detail `detCol` (~0.0009, from `random(0.02,0.026)*0.04`, line 108) gives a base value, whose z is modulated by another noise lookup and multiplied by an amplitude `8 + 2.2*max(0, noise^9.4 - 0.4)` (125-126) — the high power of the amplitude noise makes it mostly flat with sparse spikes, creating the large smooth blobs with occasional darker inclusions. The value is mapped through `getColor()` (265-271), which lerps between two neighbouring palette entries (`colors[]`, line 257) — noise-driven palette selection.
5. 400 random horizontal streaks are drawn into the buffer (133-142): each starts at a random pixel with a random palette colour and extends up to 80 px with a slowly drifting colour — the small dashes visible in the render.
6. Faint horizontal/vertical lines: every 50th row/column is lerped 10% toward white (172-177) — barely visible.
7. 20 random "smear" passes shift a row or column by 1-5 px (179-193) — subtle pixel displacement.
8. The buffer is composited to screen (219-244): each of the cc² pixels becomes a P3D `rect` of size `ss*random(0.98,1)*noi`, where `noi` is a 0.8-1.0 noise modulation at `detSize` (~0.008, line 111). Drawn under `blendMode(ADD)` (215) on black, so colours add and the tiny per-rect size jitter + global rotation produce the fine grid texture. `colorsPixel` is false, so single-colour squares, not RGB-split bars.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_300 | `int cc = 900;` -> `int cc = 300;` | large | coarser square grid; the diagonal colour dashes are much longer (streak length is fixed in buffer pixels, buffer is now 3x smaller); overall field re-rolled, so composition differs too | variants/cc_300/frame_00001.png |
| detCol_0.003 | `float detCol = random(0.02, 0.026)*0.04;` -> `... *0.12;` | large | colour blobs are smaller and more fragmented/mottled with more visible boundaries between colour regions; field re-rolled as well | variants/detCol_0.003/frame_00001.png |
| streaks_10 | `for (int i = 0; i < 400; i++) {` -> `i < 10` | large | the scattered dashes are almost gone (one small blue dash visible); the large score is mostly the noise field being re-rolled (sketch is non-deterministic), the parameter's own effect is modest | variants/streaks_10/frame_00001.png |
| palette_dark | `int colors[] = {#043387, ...#6A0E80};` -> `int colors[] = {#121B4B, #028594, #016C40, #FBAF34, #CF3B13, #E55E7F, #F0D5CA};` | large | complete recolour: warm orange/red/pink with cream and dark navy/teal regions instead of yellow/cyan/magenta | variants/palette_dark/frame_00001.png |
| rotZ_0.01 | `rotateZ(HALF_PI*random(0.5, 2));` -> `rotateZ(HALF_PI*random(0.01));` | large | grid texture and streaks are axis-aligned (horizontal/vertical) instead of rotated; field re-rolled (cyan/magenta composition) | variants/rotZ_0.01/frame_00001.png |

## Modularisation notes
- **Generic blocks**: the per-pixel noise→palette mapping (120-131 + `getColor`) is a reusable "noise field into pixel buffer" function; the streak scattering (133-142), row/column smear (179-193) and the cc² rect compositing with per-cell noise-modulated size (219-244) are each independently reusable post-processing passes. The `DoubleNoise` tab is a self-contained 3-D Perlin implementation (unseeded `java.util.Random` is a bug relative to the sketch's seeding intent — a clean version would accept a seed).
- **One-off art decisions**: the 10 anchor points with boxes/labels (95-99, 159-170, 198-209); the specific palette (257); the amplitude `^9.4 - 0.4` shaping that produces sparse dark blobs (125); the exact rotation ranges (82-83).
- **Parameter object**: `{cc (grid resolution), detCol/detSize/detAmp (noise details), streakCount, palette[], rotX/rotZ ranges, seed, colorsPixel (RGB-split mode)}`. The `export` flag and `keyPressed` regeneration are sketch-harness concerns, not art parameters.
