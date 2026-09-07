---
sketch: 2017/Generativos/gusanos
year: 2017
renderer: JAVA2D
size: [720, 720]
libraries: []
deterministic: false
ms_first_frame: 261
animated: false
techniques: [noise-field, curves, distortion, symmetry]
primitives: [shape]
palette:
  colors: ["#DB7654", "#893D60", "#D6241E", "#F2AC2A", "#3D71B7", "#FFEEED", "#85749D", "#21232E", "#5FA25A", "#5D8EB4"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 8, tried: [16], change: large, effect: "more columns; ribbons flatten and hug the midline, big flat background masses (green/plum) dominate"}
  - {name: c, default: 10, tried: [4], change: large, effect: "fewer contour layers per column; ribbons keep full height but with thick simple bands, background colours show more"}
  - {name: det, default: "random(0.012)*random(1)", tried: [0.03], change: moderate, effect: "higher-frequency global warp; similar composition, somewhat tighter wobble (baseline non-deterministic, part is time noise)"}
  - {name: amp, default: "random(800)", tried: [200], change: moderate, effect: "less displacement; calmer edges, smoother boundaries on the big colour masses (partly time noise)"}
  - {name: dd, default: 10, tried: [25], change: moderate, effect: "coarser sampling; visually almost identical, curveVertex smooths the coarser steps"}
  - {name: det1, default: "random(0.02)", tried: [0.005], change: large, effect: "smoother, broader contour waves; ribbons become wide calm bands instead of fine ripples"}
reusable_candidates:
  - {name: noiseDisplace, signature: "noiseDisplace(x, y, scale, offset, amp) -> PVector", note: "polar displacement: angle = 2*2PI*noise, distance = pow(noise, 0.2)*amp; warps any point field"}
  - {name: contourRibbon, signature: "contourRibbon(cx, cy, width, step, detail, amp, power, j) -> shape", note: "closed ribbon: upper edge from noise(n1) - pow(noise(n2), pwr2), lower edge mirrored, both displaced"}
  - {name: randomPalette, signature: "randomPalette(colors[]) -> color", note: "uniform random pick from a fixed color list per shape"}
---

## What it draws
Full-bleed psychedelic composition on a lavender-purple ground with large amber masses top and green masses bottom. Along a horizontal midline, worm-like ribbons pinch to points on the line and bulge up and down in mirror pairs; each ribbon is built from stacked contour bands in random palette colors (red, orange, off-white, blue, green, dark navy, plum). A global noise field wobbles every edge, giving the whole thing an organic, liquid look.

## How the code works
- `setup()` (3-8): 720x720, `smooth(8)`, calls `generate()` once; `draw()` is empty (10-12) so the image is static; any key press regenerates with a new seed (14-20).
- `generate()` (22-90): seeds noise and random with `seed` (26-27); picks global warp scale `det = random(0.012)*random(1)`, offset `des`, and max displacement `amp = random(800)` (29-31); background is one random palette color (33).
- 8 worm columns `cc = 8` (35); each column `j` gets 10 layers `c = 10` (40). Per column: two noise details `det1/det2 = random(0.02)` and two **time-based** offsets `des1/des2 = millis()*0.001*random(-1,1)` (43-46) — this is why the baseline is non-deterministic. Per column: exponent pair `pwr1/pwr2` (51-52).
- Each layer: amplitude `amp = map(k, 0, c, 3, 0)` shrinks from 3 to 0 as k grows (54), so earlier (background) layers bulge highest; fill is a random palette color (55, 72).
- Shape (56-87): a full-width path sampled every `dd = 10` px (37, 57). Upper edge: `dy = noise(des1+i*det1, j)`, subtract `pow(noise(des2+i*det2, j), pwr2)`, clamp to [0,1], scale by `hh*amp`, raise to `pwr1` (63-66). Lower edge is the same curve negated (78-85), then `endShape(CLOSE)`. Every vertex (including the straight midline run at `yy+hh*0.5`) passes through `displace()`, so the ribbons share a wobbly midline and pinch to points wherever the noise difference is ~0.
- `displace()` (94-99): global warp field — `ang = noise(x*det+des, y*det+des)*2*TWO_PI`, `dis = pow(noise(...), 0.2)*amp`, returns `x + cos(ang)*dis, y + sin(ang)*dis`. The `pow(..., 0.2)` keeps distances large, so even small `amp` produces strong, gnarly wobble.
- Color: `rcol()` picks uniformly from the 10-color Coolors palette (107, 109-111); `getColor()` (112-118) exists but is unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_16 | `int cc = 8;//int(random(3, 17));` -> `int cc = 16;` | large (0.2462, 0.83) | 16 columns: ribbons are much flatter, mostly hugging the horizontal midline as thin wavy strips; one tall vertical ribbon in the centre; the canvas is dominated by flat green (top) and plum (bottom) background masses with yellow/blue patches — the layered-worm look is reduced to a horizon line | variants/cc_16/frame_00001.png |
| c_4 | `int c = 10;` -> `int c = 4;` | large (0.2216, 0.877) | only 4 layers per column: ribbons still span the full canvas height but each has only a few thick contour bands (red/orange/white/blue/green) instead of ~10 fine ones; big flat background masses (yellow, blue, off-white) show through much more | variants/c_4/frame_00001.png |
| det_0.03 | `det = random(0.012)*random(1);` -> `det = random(0.03)*random(1);` | moderate (0.083, 0.296) | composition essentially the same worm structure as baseline; warp frequency is higher so edges wobble a bit tighter. Baseline is non-deterministic (time-based des1/des2), so some of this score is render-time noise | variants/det_0.03/frame_00001.png |
| amp_200 | `amp = random(800)*random(1)*random(1);` -> `amp = random(200)*random(1)*random(1);` | moderate (0.0876, 0.311) | same composition; displacement is quartered, so edges are calmer and the boundaries of the big colour masses (purple/green/yellow) are noticeably smoother, less gnarled. Partly confounded by time-based non-determinism | variants/amp_200/frame_00001.png |
| dd_25 | `int dd = 10;` -> `int dd = 25;` | moderate (0.0726, 0.263) | visually almost identical to baseline — the 25 px sampling step is smoothed away by `curveVertex`; remaining differences are consistent with time-based noise rather than the substitution | variants/dd_25/frame_00001.png |
| det1_0.005 | `float det1 = random(0.02)*random(1);` -> `float det1 = random(0.005)*random(1);` | large (0.1741, 0.616) | upper-edge noise detail quartered: the worm ribbons lose their fine ripples and become wide, calm bands with long smooth waves; pinch points are fewer and the layered contour bands are broader | variants/det1_0.005/frame_00001.png |

## Modularisation notes
Generic: `displace()` is a reusable noise-field displacement (scale/offset/amplitude parameters); the per-layer ribbon builder (two-channel noise contour, mirrored, amplitude ramp, `dd` step) is a reusable "layered contour ribbon" primitive; `rcol()` is a trivial random-palette picker. One-off art decisions: the 8-column/10-layer structure, the `pow(noise, 0.2)` distance shaping, the time-based `des1/des2` (makes each regeneration unique but non-deterministic), and the specific palette. A clean parameter object: `{seed, cc, c, dd, det, des, amp, det1, det2, pwr1, pwr2, timeOffset, palette, bg}` with `timeOffset` fixed for determinism.
