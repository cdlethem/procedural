---
sketch: 2018/Generativos/circir
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2345
animated: false
techniques: [dots-stippling]
primitives: [ellipse, shape]
palette:
  colors: ["#F6EDDD", "#D59D3D", "#D72B69", "#D85C3A", "#D1BEB5", "#358391", "#326692", "#CB326F", "#AFB835", "#3CBA6E", "#E2816F"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: 1000, tried: [500], change: moderate, effect: "fewer circles: olive ground shows between them, individual circles more distinct"}
  - {name: disk alpha, default: 120, tried: [255], change: moderate, effect: "opaque disks: flat unblended palette colours, muddy brown-green blending gone"}
  - {name: s (disk diameter), default: "random(120)", tried: ["random(60)", "random(200)"], change: moderate, effect: "smaller = finer sparse field, ground visible; larger = full coverage, soft big patches"}
  - {name: halo alpha, default: 20, tried: [80], change: moderate, effect: "faint halo rings become clearly visible around circles, field darkens"}
reusable_candidates:
  - {name: lerpPalette, signature: "lerpPalette(index: float) -> color", note: "continuous palette lookup, lerps between adjacent swatches"}
  - {name: arcRing, signature: "arcRing(x, y, r1, r2, a1, a2, col, shd1, shd2) -> void", note: "annular sector approximated by filled quads, two alpha bands"}
  - {name: scatterDisks, signature: "scatterDisks(count, sizeMax, alpha, haloScale, haloAlpha, palette) -> void", note: "uniform full-bleed scatter of translucent disks with optional faint halo ring"}
---

## What it draws
A dense, full-bleed field of roughly 1000 overlapping translucent circles of varying sizes (up to ~120 px) on a 960x960 canvas. The dominant hues are olive/moss green, terracotta orange, pink/magenta, with teal-blue and cream accents; heavy overlap produces muddy brown-green blended patches. Many circles carry a faint, barely-visible halo ring at twice their radius. The image is static — no structure, motion, or focal point.

## How the code works
- `setup()` (L3-9): `size(960, 960, P2D)`, calls `generate()` once. `draw()` (L11-12) is empty, so the image is static; `keyPressed()` (L14-20) regenerates with a new seed.
- `generate()` (L22-43): background is one random palette colour (L23). A loop of `cc = 1000` (L25) iterations:
  - position: `x = random(width)` (L28); `y` is first set by a power-gradient (L29) but immediately overwritten by `y = random(height)` (L30), so positions are uniform.
  - size: computed three times (L31-35) but the final value is `s = random(120)` (L36) — a uniform 0–120 px diameter, discarding all earlier logic.
  - colour: `getColor(random(colors.length))` (L32) — the `getColor(float)` overload (L78-84) lerps between two adjacent entries of the 11-colour palette (L71), giving smooth off-palette tones.
  - per disc: `fill(col, 120)` + `ellipse` (L37-38), then three full-circle `arc2` calls (L39-41): one re-fills the same disk at alpha 120 (redundant), one is effectively invisible (alphas 0/20 at r2=0), and one draws a faint halo ring from r=s/2 to r=s at alpha 20.
- `arc2` (L45-63): approximates an annular sector between radii r1 and r2 with `cc` filled quads, where the quad count scales with the arc length; inner band uses alpha `shd1`, outer band `shd2`.
- Randomness enters only through the `seed` field (L1, set by the harness) and `random()` for positions, sizes, colours, and background; the sketch is deterministic under a fixed seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_500 | `int cc = 1000;` -> `int cc = 500;` | moderate (mean 0.1337, 66% of pixels) | sparser field: olive ground shows in the gaps, individual circles more distinct, same overall palette | variants/cc_500/frame_00001.png |
| alpha_255 | `fill(col, 120);` -> `fill(col, 255);` | moderate (mean 0.0671, 20% of pixels) | top disks now opaque: flat unblended palette colours, the muddy brown-green blending disappears; ground reads as pure lime-olive, pale cream/beige disks look clean (verified: 11% of pixels near pure palette vs 1% in baseline) | variants/alpha_255/frame_00001.png |
| size_60 | `s = random(120);` -> `s = random(60);` | moderate (mean 0.1445, 70% of pixels) | all circles at most half as big: finer, sparser stipple field, olive ground clearly visible | variants/size_60/frame_00001.png |
| size_200 | `s = random(120);` -> `s = random(200);` | moderate (mean 0.1236, 57% of pixels) | big circles cover the whole canvas: ground almost invisible, large soft overlapping patches of pale translucent colour | variants/size_200/frame_00001.png |
| halo_80 | `arc2(x, y, s, s*2, 0, TWO_PI, 0, 20, 0);` -> `... 0, 80, 0);` | moderate (mean 0.1377, 64% of pixels) | faint halo rings become clearly visible as rings around many circles; field darkens and reads more structured | variants/halo_80/frame_00001.png |

## Modularisation notes
Generic, reusable: `lerpPalette` (continuous palette lookup by float index) and `arc2`/`arcRing` (annular sector from filled quads with two alpha bands). The whole scatter is a one-call `scatterDisks(count, sizeMax, alpha, haloScale, haloAlpha, palette)`.
One-off art decisions: the dead size/position code (L29, L31-35) that is immediately overwritten; the triple `arc2` call per disk where two of the three contribute almost nothing (one is a no-op at r2=0); the fixed alpha 120 and halo alpha 20; random background colour.
Clean parameter object: `{count, sizeMax, alpha, haloScale, haloAlpha, palette, backgroundMode}`.
