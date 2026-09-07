---
sketch: 2018/Generativos/noiseGrads
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1607
animated: false
techniques: [noise-field, lines-hatching]
primitives: [point, line, shape]
palette:
  colors: ["#1A1312", "#3C333B", "#A84257", "#D81D37", "#D81D6E"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: 60, tried: [30], change: moderate, effect: "fewer, wider bands; larger gentler waves, coarser comb texture"}
  - {name: walkSteps, default: 1100, tried: [3000], change: moderate, effect: "more meanders per row; finer, denser rippled texture"}
  - {name: det, default: 0.01, tried: [0.02], change: moderate, effect: "finer noise field; smaller, more frequent ripples in each band"}
  - {name: vc, default: 100, tried: [20], change: moderate, effect: "colour advances slower along x; more uniform hue per band, fewer dark bands"}
  - {name: dotAlpha, default: 120, tried: [0], change: none, effect: "no visible change; point grid is not visible in the render"}
reusable_candidates:
  - {name: noiseRibbon, signature: "noiseRibbon(y, steps, det, angleMin, angleMax, width) -> PVector[]", note: "1-D noise-steered random walk, reoriented so first->last vector is horizontal and stretched to width"}
  - {name: ribbonGradient, signature: "ribbonGradient(top, bottom, palette, offset, rate, alpha) -> quad strip", note: "fills quads between two polylines with a colour index that advances along the strip"}
---

## What it draws
A full-bleed 960x960 image of horizontal wavy bands in reds, magentas and dusty roses, with a
few dark near-black bands and one bright crimson band near the top. The bands have a fine
serrated, comb-like texture (a moire from the densely packed quad strips) and some bands carry
dark shadow stripes between them.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the sketch is static (key press
regenerates with a new seed). Flow in `generate()` (noiseGrads.pde):

- L23-25: seed `random`/`noise`, then background = random palette colour (`rcol()`).
- L27-39: `cc=60`, `cg=5`, grid step `gs = width/(cc*cg) = 3.2`; a loop of `point(i,j)` with
  `stroke(0,120)` paints a fine dark dot grid over the whole canvas. It is effectively invisible
  in the render (the dotAlpha_0 variant scores `none`); the visible comb texture is a moire
  artifact of the dense quad strips, not the dot grid.
- L45-84: 76 "mountains" (`cc+cor`, `cor=16`). For each row `i`: a translucent white rect
  underlay, then a random walk of 1100 unit steps whose heading is
  `map(noise(lx*det, ly*det), 0, 1, PI*1.5, PI*2.5)` (L62) — the walk drifts mostly
  down-right. `det` starts at `random(0.01)` and is multiplied by `random(0.99,1.01)` each
  row (L59), so noise scale varies slightly per row. Each walk is then rigidly transformed
  (L74-81): rotated so first->last vector is horizontal and scaled to span the canvas width,
  producing one wavy line per row.
- L86-112: between every pair of consecutive mountain lines, a `QUADS` shape fills the strip.
  The colour index advances along x: `fill(getColor(ic + vc*j))` where `ic` is a random palette
  offset, `vc` is a random rate in [0,100) (sometimes x10), and `getColor` lerps between
  adjacent palette entries (L128-133). That produces the red->magenta->dark banding and the
  bright/dark bands (a band whose index happens to sit near `#D81D37` or `#1A1312`).

Randomness enters via: seed (L1), `rcol()` background, per-row `det` jitter (L59), `ic`/`vc`
per strip (L90-92), and the walk itself through noise (deterministic given seed).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_30 | `int cc = 60;` -> `int cc = 30;` | moderate | fewer, wider bands; waves are larger and gentler, comb texture coarser | variants/cc_30/frame_00001.png |
| iter_3000 | `while (iter < 1100) {` -> `while (iter < 3000) {` | moderate | rows meander more before stretching; finer, denser ripple texture | variants/iter_3000/frame_00001.png |
| det_0.02 | `float det = random(0.01);` -> `float det = random(0.02);` | moderate | smaller, more frequent ripples in each band; colouring more uniform | variants/det_0.02/frame_00001.png |
| vc_20 | `float vc = random(1)*random(100);` -> `random(1)*random(20);` | moderate | colour changes more slowly along x; bands more uniform in hue, fewer dark bands | variants/vc_20/frame_00001.png |
| dotAlpha_0 | `stroke(0, 120);` -> `stroke(0, 0);` | none | no visible change; the point grid does not register at this scale | variants/dotAlpha_0/frame_00001.png |

## Modularisation notes
- Generic: the noise-steered walk + reorientation/stretch block (L57-83) is a reusable
  "ribbon" generator: given (y, steps, noise scale, angle range, target width) it yields a
  polyline; the strip-fill between two polylines with an advancing colour index (L96-112) is a
  second reusable piece. Both are independent of the palette.
- One-off art decisions: the 5-colour red/magenta palette, the 3.2 px dot-grid overlay
  (invisible in practice), the `random(0.01)` noise scale with per-row jitter, and the
  `vc *= random(10)` occasional boost.
- A clean parameter object: {rows, walkSteps, noiseScale, angleMin, angleMax, dotGridStep,
  dotAlpha, colorRate, palette} — everything else is derived (gs, ss, strip quads).
