---
sketch: 2018/Generativos/labios
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2199
animated: false
techniques: [noise-field, dots-stippling, curves]
primitives: [ellipse, shape]
palette:
  colors: ["#D5D3D4", "#CF78AF", "#DA3E0F", "#068146", "#424BC5", "#D5B307"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: dotCount, default: 1000, tried: [300], change: large, effect: "sparser background dust; also shifts the RNG stream, so spheres and ribbon web are re-laid out"}
  - {name: dotMaxDiameter, default: 5, tried: [25], change: none, effect: "no visible change; dots grow but stay negligible against the ribbon web"}
  - {name: ribbonPasses, default: 3, tried: [1], change: moderate, effect: "ribbon web ~3x sparser; more background and spheres show through"}
  - {name: vel, default: 2, tried: [8], change: subtle, effect: "longer step: smoother, more stretched strokes; tangle and feather clumps loosen but overall look holds"}
  - {name: det, default: "random(0.001, 0.008)", tried: ["random(0.0002, 0.0016)"], change: large, effect: "5x lower noise frequency: fine web collapses into a few wide, smooth rainbow bands"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, color, alphaInner, alphaOuter)", note: "two-alpha quad-strip ring that fakes radial shading (sphere look)"}
  - {name: flowRibbon, signature: "flowRibbon(center, passes, steps, vel, noiseScale, palette)", note: "polylines walked through a 2-D noise angle field, stroked with a cycling palette gradient"}
  - {name: dotField, signature: "dotField(count, maxRadius, palette, bg)", note: "random stipple of tiny filled ellipses over a random palette background"}
---

## What it draws
An indigo blue-purple field dusted with fine multicolored dots, with a handful of
large softly shaded spheres (gold, green, pink, gray) scattered across it. Over
everything runs a dense web of thin, wavy ribbon lines that twist like smoke; each
line's stroke shifts through the palette (red, gold, green, pink, blue) so the
network reads as iridescent, and where ribbons bunch up they form small feathery
swirls. The image is static (frames 1, 10, 60 identical).

## How the code works
`setup()` (labios.pde:3-9) sizes 960×960 P2D and calls `generate()` once; `draw()`
is empty, so the piece is static and re-rolls only on key press (labios.pde:14-20).
`seed` (labios.pde:1) is a harness-injected random seed; `randomSeed(seed)` at
labios.pde:24 makes every render deterministic.

`generate()` (labios.pde:22-72) draws three layers:

1. **Stipple layer** (labios.pde:26-33): background is one random palette color
   (`rcol()`, line 23 — indigo/blue #424BC5 under seed 42); then 1000 tiny filled
   ellipses at random positions with diameter `random(5)` (line 30) in random
   palette colors → the fine colored dust.
2. **Sphere layer** (labios.pde:35-49): 3 passes × 5 ellipses of diameter
   `width*random(0.1, 0.6)` (line 40), each filled with a random palette color and
   wrapped by `arc2()` calls (lines 42, 46-48). `arc2` (labios.pde:74-92) draws a
   shaded spheres. The outer black-alpha strip (line 42) adds a dark rim.
3. **Ribbon layer** (labios.pde:51-70): per pass, a random noise offset `des`
   (line 52) and scale `det = random(0.001, 0.008)` (line 53), then `sub = 1000`
   polylines (line 55). Each polyline starts at the canvas center (lines 57-58)
   and takes 2000 steps (line 63): heading `a = noise(des+x*det, des+y*det)*TWO_PI*10 + ang`
   (line 64) where `ang` is the polyline's index mapped over 0..TWO_PI (line 59) —
   so the 1000 lines fan out into a rotating spiral, all warped by the same noise
   field into the web-like tangle. `vel = 2` (line 60) sets step length. Stroke
   color comes from `getColor(map(ang, 0, TWO_PI, 0, colors.length*2))`
   (line 61), which lerps between adjacent palette colors around the ring
   (labios.pde:107-113) — that is the rainbow sheen. Overlapping, nearly
   coincident strands near the fan center create the feathered swirls.

Colour is always random-from-list (`rcol`, labios.pde:101-103) for dots/spheres
and a cyclic lerp (`getColor`, labios.pde:107-113) for ribbons. No blend modes,
no shaders; `smooth(8)` + `pixelDensity(2)` (failed on the harness display)
antialias.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| dotCount_300 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 300; i++) {` | large | background dust visibly sparser; because the dot loop feeds the same RNG, removing 700 dots shifts every later draw, so the spheres and the whole ribbon web are re-laid out in new positions | variants/dotCount_300/frame_00001.png |
| dotSize_25 | `float s = random(5)*random(1);` -> `float s = random(25)*random(1);` | none | no visible change; the dust dots are larger on inspection but remain negligible next to the ribbon web | variants/dotSize_25/frame_00001.png |
| ribbonPasses_1 | `for (int k = 0; k < 3; k++) {` -> `for (int k = 0; k < 1; k++) {` | moderate | ribbon web clearly sparser: fewer, thinner strands cross the canvas, so more of the indigo background and the spheres (gold, gray, pink, green, dark blue) show through | variants/ribbonPasses_1/frame_00001.png |
| vel_8 | `float vel = 2;` -> `float vel = 8;` | subtle | lines wander faster: strokes are longer, smoother and more stretched; the dense tangle and the feathered clumps loosen but the iridescent web still dominates | variants/vel_8/frame_00001.png |
| noiseScale_0.0002_0.0016 | `float det = random(0.001, 0.008);` -> `float det = random(0.0002, 0.0016);` | large | 5x lower noise frequency: the fine web collapses into a few very wide, smooth rainbow bands; the tangle and feathery texture disappear, sphere layout otherwise similar | variants/noiseScale_0.0002_0.0016/frame_00001.png |

## Modularisation notes
- `arc2` is fully generic: a two-alpha quad-strip ring; parameterising radii,
  angle span, and the two alphas gives a reusable "soft-shaded blob/sphere"
  primitive.
- The ribbon fan (lines 51-70) is a clean "noise flow fan" generator: center,
  number of strands, steps per strand, step velocity, noise scale, and a cyclic
  palette function are all independent knobs; the spiral phase `ang` and the
  `*TWO_PI*10` amplification are the artistic decisions that produce the tangle.
- The dot field (lines 26-33) is a trivial stipple utility (count, max diameter,
  palette, background color).
- The one-off art decisions: the fixed 6-color palette, 3×5 sphere count, the
  1000×2000 ribbon density, and the triple `arc2` wrapping of each sphere.
- A clean parameter object: `{seed, bgIndex, dotCount, dotMaxDiameter,
  spherePasses, spheresPerPass, sphereSizeRange, ribbonPasses, ribbonStrands,
  ribbonSteps, ribbonVelocity, noiseScale, noiseOctaves, palette}`.
