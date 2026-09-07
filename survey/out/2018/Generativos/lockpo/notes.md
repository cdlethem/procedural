---
sketch: 2018/Generativos/lockpo
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3314
animated: false
techniques: [flow-field, noise-field, particles, dots-stippling]
primitives: [line, ellipse]
palette:
  colors: ["#434E20", "#E8AF36", "#F56546", "#446E9A", "#F6EDDD"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: walkerCount, default: 1000, tried: [300], change: moderate, effect: "sparser web, more background showing, circles stand out more"}
  - {name: stepsPerWalker, default: 10000, tried: [3000], change: moderate, effect: "thinner web of shorter paths, blue background more visible"}
  - {name: noiseScale, default: "random(0.1)*random(0.1,1)", tried: ["random(0.02)*random(0.1,1)"], change: moderate, effect: "looser, larger-scale curls in the tangle"}
  - {name: circleCount, default: "int(random(-2,4))", tried: ["int(random(-2,8))"], change: moderate, effect: "far more circles, they nearly cover the web"}
  - {name: circleMaxSize, default: 80, tried: [30], change: subtle, effect: "smaller scattered dots, web essentially unchanged"}
  - {name: pathAlpha, default: 30, tried: [100], change: moderate, effect: "dark under-web much stronger, overall darker and more grey"}
  - {name: noiseWalker, signature: "noiseWalker(steps, noiseScale, phase, stepLen) -> PVector[]", note: "walk a point through 2-D noise; angle = noise(x*s, y*s) * TWO_PI * gain"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], v) -> color", note: "index a palette with a float, lerping between adjacent entries"}
---

## What it draws
A dense, full-bleed tangle of very thin lines covering the whole canvas, like a
silk web. The lines are mostly gold/orange and cream with strands of blue,
olive, and red-orange; a darker grey-brown haze sits underneath them. Scattered
across the tangle are soft semi-transparent circles of a few dozen pixels, in
the same muted palette (slate blue, orange, olive, cream, dusty red),
overlapping so that where they cross the colours blend.

## How the code works
`setup()` (lines 3-9) sizes the canvas 960x960 P2D and calls `generate()` once;
`draw()` is empty, so the image is static. `generate()` (lines 22-69) fills the
background with a random palette colour (`rcol()`, line 78), sets
`noiseDetail(1)`, then loops 1000 times (line 26). Each iteration seeds a
"walker": random start position, random noise phase `des`, and a random noise
scale `det` in roughly [0.001, 0.1] (line 30). The inner loop (line 32) walks
10000 steps: at each step the heading angle is
`noise(des + x*det, des + y*det) * TWO_PI * 20` (line 33) and the point moves
one pixel along it, so the path follows a 2-D Perlin flow field at a very
high gain, producing tight squiggly hairline curls. One path colour is chosen
per walker by `getColor(random(...))` (line 38), which lerps between two
adjacent palette entries (lines 84-90). The path is drawn twice: first as a
single `beginShape` with `stroke(0, 30)` (lines 39-46) - the dark translucent
under-web - and later with `stroke(col)` (lines 61-67). Before the coloured
pass, 0-3 circles are placed at random points of the path (lines 50-59):
each is drawn as a black `fill(0, 20)` ellipse offset by (1,1) (a faint
drop shadow) and then the same ellipse in the path colour, diameter up to 80.
Randomness enters at lines 27-30 (start/phase/scale), line 38 (colour),
lines 50-53 (circle count/placement/size). `translate(0,0,1)` (line 48) is a
no-op under P2D (3D-only call, see stderr).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| walkers_300 | `for (int i = 0; i < 1000; i++) {` -> `... i < 300 ...` | moderate (0.64 px) | noticeably sparser web; blue background shows through in patches; same circles but less crowded, so they read larger | variants/walkers_300/frame_00001.png |
| steps_3000 | `for (int j = 0; j < 10000; j++) {` -> `... j < 3000 ...` | moderate (0.372 px) | thinner web of shorter squiggly paths; bluish background visible in more places; circles unchanged in size but more prominent | variants/steps_3000/frame_00001.png |
| det_0.02 | `float det = random(0.1)*random(0.1, 1);` -> `random(0.02)*...` | moderate (0.604 px) | looser tangle with larger, smoother arcs; less tight micro-squiggle, more visible flow structure | variants/det_0.02/frame_00001.png |
| circles_8 | `int cc = int(random(-2, 4));` -> `int(random(-2, 8));` | moderate (0.654 px) | many more circles: a dense field of overlapping translucent discs that nearly buries the line web | variants/circles_8/frame_00001.png |
| circlesize_30 | `float ss = random(80);` -> `random(30);` | subtle (0.161 px) | circles shrink to small scattered dots; the line web looks essentially the same | variants/circlesize_30/frame_00001.png |
| strokealpha_100 | `stroke(0, 30);` -> `stroke(0, 100);` | moderate (0.415 px) | dark grey-brown under-web becomes dominant; whole image reads darker and more monochrome, coloured strands less bright | variants/strokealpha_100/frame_00001.png |

## Modularisation notes
The walker loop (lines 31-37) is fully generic: a flow-field particle that
integrates `noise(phase + pos*scale) * TWO_PI * gain` one pixel per step - a
good candidate as `noiseWalker(steps, scale, phase, gain)`. `getColor`
(lines 84-90) is a clean palette-lerp helper. One-off art decisions: the
double draw of every path (dark alpha web under a coloured web), the shadowed
circle stamps at random path points, and the specific 5-colour muted palette.
A clean parameter object would contain: walkerCount, stepsPerWalker,
noiseScale range, angleGain, pathAlpha, circleCountRange, circleMaxSize,
palette, background selection.
