---
sketch: 2018/Generativos/griiiids
year: 2018
renderer: P2D
size: [960, 520]
libraries: []
deterministic: false
ms_first_frame: 2537
animated: true
techniques: [grid, noise-field, shader]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#DFC4E4", "#EE6054", "#2470CB", "#E9C639", "#ECF5CD", "#229E8E", "#13283C"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(100)*random(1)) (~3 at seed 42)", tried: [100], change: large, effect: "grid cell count; 100 turns a few giant shapes into a dense ~10k-tile mosaic with flow-like streaks"}
  - {name: amp, default: "random(random(0.8,1),1) in (0.64,1)", tried: [2.0], change: large, effect: "2.0 makes cell rects so huge they cover everything; image reduces to a few big soft gradient circles"}
  - {name: scatterCount, default: "cc*3", tried: ["cc*12"], change: large, effect: "4x more circles; composition becomes dominated by overlapping outlined target circles"}
  - {name: whiteTint, default: 0.2, tried: [0.6], change: large, effect: "fills washed toward white; coral rects read pink/peach, overall brighter and softer"}
  - {name: noiseOctaves, default: 2, tried: [5], change: moderate, effect: "no visible structural change (differences within animation-phase noise, deterministic:false)"}
  - {name: angScale, default: "TAU*4", tried: ["TAU"], change: moderate, effect: "no visible structural change; rects still strongly rotated, same composition (subtle, phase noise)"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "filled annular-sector band between two radii with per-vertex alpha gradient"}
  - {name: rcol, signature: "rcol() -> int", note: "uniform random pick from fixed 7-colour palette (colors[])"}
  - {name: postShader, signature: "filter(post.glsl)", note: "3x3 blur at 80% + radial vignette + dither + per-channel gamma + saturation boost"}
---

## What it draws

A full-bleed abstract composition of large flat-coloured shapes. Deep blue dominates, built from
overlapping rotated rectangles with thin black outlines that read as a faceted polygon field; large
black-outlined circles in coral/red (some with a pale lilac ring, some with a solid red centre,
target-like) sit on top; a teal/green region occupies the left edge. A soft orange/yellow glow sits
in the lower-left and the whole image has soft, glowing, saturated edges. Frame 60 reshuffles the
same vocabulary (different rect rotations, circle positions/sizes), so the piece animates by
regenerating the entire grid every frame.

## How the code works

- `setup()` (L4-10): P2D 960×520, `smooth(2)`, `pixelDensity(2)` (warns unavailable on this display),
  loads `post.glsl` (L9).
- `draw()` (L12-17): calls `generate()` **every frame** (L13) — the animation is time-driven
  regeneration, not incremental update; re-loads the shader every 20 frames (L15) and applies
  `filter(post)` (L16).
- `generate()` (L27-86): `time = millis()` (L29), `randomSeed(seed)` (L31), near-black
  `background(10)` (L32). `cc` (L34) = `int(random(100)*random(1))` — product of two uniforms,
  skewed low (≈3 at seed 42) → very large cells; `ss = width/cc` (L35). `amp` (L36) in (0.64,1);
  four 2-D noise domains for sizes/angles plus time offsets (L39-46), `noiseDetail(2)` (L48).
  - Grid loop (L50-67): at each of (cc+1)² cell centres (L52-53) draw one rect: w/h =
    `ss·pow(0.1+noise(2D),0.5)·4·amp·n` (L54-55,63) with `n = 1-pow(noise(3D,time),2)` (L57) so
    sizes pulse with time; rotation = `noise(3D,time)·TAU·4` (L56); fill = palette colour lerped
    20% toward white (L62), black stroke (L59). The overlapping rotated noise-sized rects form the
    faceted polygon field.
  - Scatter loop (L69-85): `cc·3` items snapped back onto cell centres (L73-74): an `arc2` full ring
    with pulsing outer radius `ss·(1+cos t)` and pulsing alpha (L77-79) → the translucent rings; a
    full-cell black-outlined circle (L81) → the big outlined circles; a noise-sized filled inner
    circle (L82-84) → the solid centres.
- `arc2` (L92-110): draws the ring as closed quads between radii r1/r2, vertex alpha lerped
  alp1→alp2 (L102,105) → soft radial alpha gradient.
- Colour: `colors[]` (L112) 7 colours; `rcol()` (L113-115) uniform random pick; `getColor`
  (L116-124) is a lerp-between variant, unused by `generate()`.
- `post.glsl`: 3×3 weighted blur mixed 80% with the sharp image, radial vignette (darker + more
  saturated edges), per-texel dither, per-channel gamma (r^0.86 / g^1.02 / b^1.05). Produces the
  soft glow and saturated edges. Display is an X server (`:2`), not xvfb, so the shader render is
  trustworthy.
- `deterministic: false` — time-driven noise plus `millis()` means any same-seed render differs from
  the baseline by animation phase as well as by the changed parameter; only large differences are
  meaningful.

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_100 | `int cc = int(random(100)*random(1));` -> `int cc = 100;` | large (mean 0.2911, 0.916 of pixels) | dense mosaic of ~10k small rotated rects in blue/teal/yellow/orange with diagonal flow-like streaks; tiny dark circles scattered; dramatic scale change | variants/cc_100/frame_00001.png |
| amp_2.0 | `float amp = random(random(0.8, 1), 1);` -> `float amp = 2.0;` | large (mean 0.3623, 0.923 of pixels) | cell rects become huge and overlap; image reduces to a few very soft gradient circles (teal, purple, yellow, blue), rect edges no longer readable | variants/amp_2.0/frame_00001.png |
| scatter_cc12 | `for (int i = 0; i < cc*3; i++) {` -> `for (int i = 0; i < cc*12; i++) {` | large (mean 0.2384, 0.784 of pixels) | four times as many circles; large outlined target circles (several with dark centres) dominate and overlap across the canvas; rect field pushed to background | variants/scatter_cc12/frame_00001.png |
| tint_0.6 | `fill(lerpColor(rcol(), color(255), 0.2));` -> `fill(lerpColor(rcol(), color(255), 0.6));` | large (mean 0.155, 0.563 of pixels) | overall lighter and softer; coral/pink rects clearly washed toward white (peach cast), colours less saturated | variants/tint_0.6/frame_00001.png |
| detail_5 | `noiseDetail(2);` -> `noiseDetail(5);` | moderate (mean 0.0544, 0.165 of pixels) | no visible structural change; same blue/red composition, only slight differences in rotation/edges (mostly animation-phase drift) | variants/detail_5/frame_00001.png |
| ang_TAU | `float ang = noise(...)*TAU*4;` -> `float ang = noise(...)*TAU;` | moderate (mean 0.0651, 0.199 of pixels) | no visible structural change; rects still strongly rotated, composition essentially unchanged (subtle, phase noise) | variants/ang_TAU/frame_00001.png |

Note: `deterministic: false` — each same-seed render differs from the baseline by animation phase
(time-driven noise from `millis()`) as well as by the changed parameter. The tint/detail/ang
variants were rendered seconds apart, so their layouts are near-identical to each other; only the
large-score variants (cc, amp, scatter) show clearly parameter-driven structure.

## Modularisation notes

- Generic: `arc2` is a clean reusable "annular sector with alpha gradient" primitive. The
  noise-sized/rotated grid of rects (L50-67) is a self-contained "noiseRectGrid(cells, amp,
  sizeDetail, rotDetail, rotScale, tintWhite)" field generator. `rcol`/`getColor` are standard
  palette sampling. The post shader is a standalone "soft glow" filter (blur + vignette + gamma +
  saturation) with tunable amounts.
- One-off art decisions: the `cc = random(100)*random(1)` count heuristic (intentionally skews to a
  few giant cells), the fixed 7-colour palette, scattering the circles onto the same grid, the
  magic pulse frequencies (`cos(time*random(0.1))`).
- Clean parameter object: `{cells, amp, sizeDetail, rotDetail, rotScale, tintWhite, scatterMul,
  ringPulse, palette, blurAmt, vignetteAmt, gamma}`.
