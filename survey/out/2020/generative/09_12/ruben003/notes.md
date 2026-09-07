---
sketch: 2020/generative/09_12/ruben003
year: 2020
renderer: P2D
size: [480, 640]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1608
animated: false
techniques: [grid, noise-field, particles, dots-stippling]
primitives: [line, ellipse, shape, pgraphics]
palette:
  colors: ["#251B19", "#7F2A17", "#995D38", "#FFD192", "#533632", "#2A201E"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: view, default: 1, tried: [4], change: error, effect: "runtime_error: NPE at ruben003.pde L162 (renderCol.pixels on P2D offscreen buffer is null); view-4 stipple render not observable headless"}
  - {name: gridDiv, default: 4, tried: [8], change: subtle, effect: "more faint division lines at eighth positions; lattice denser, same overall impression"}
  - {name: diagLineAlpha, default: 160, tried: [40], change: none, effect: "no visible change; the two main diagonals slightly dimmer"}
  - {name: dotColor, default: "250,90,0", tried: ["0,160,255"], change: none, effect: "no visible change; 4px dots too small to notice (pixels confirm they turned blue)"}
  - {name: dotSize, default: 4, tried: [14], change: none, effect: "no visible change at whole-image level; intersection dots slightly larger"}
  - {name: debugTextures, default: true, tried: [false], change: none, effect: "no visible change overall; top-left brown debug thumbnail removed (grey one was already near-invisible)"}
reusable_candidates:
  - {name: createPoints, signature: "createPoints(w, h) -> Point[]", note: "fixed set of 27 lattice points: border corners/edges, quarter, half and third divisions"}
  - {name: getColor, signature: "getColor(palette, v) -> int", note: "wrap-around lerp between adjacent palette colours, biased by pow(frac, 0.2)"}
  - {name: randomPointInTriangle, signature: "triangles(p1, p2, p3) -> PVector", note: "random point in a triangle via sqrt-transformed barycentrics"}
---

## What it draws
Black portrait canvas (480x640) covered by a white geometric line lattice: two full
diagonals, vertical and horizontal division lines at quarter positions, and lines running
from each corner to the centre, forming a diamond/triangle grid. Small orange dots mark
the lattice intersections. In the top-left corner are two small debug thumbnails: one of
brown/rust triangles, one of very dark grey triangles (nearly black).

## How the code works
`settings()` (ruben003.pde L16-21) sizes the window 480x640 (logical 960x1280 scaled by
0.5) with P2D. `setup()` calls `generate()` once (L23-24); `generated` is then false so
`draw()` never regenerates — the image is static (frames 10/60 dropped as identical).

`generate()` (L64-101) seeds, then:
- `createPoints()` (grid.pde L10-55): 27 fixed `Point`s at border, quarter/half/third
  fractions of the canvas (no randomness).
- `gradColor()` (L103-129): 50 random triangles of two palette colours each (via
  `getColor()`, L193-203, a wrap-around `lerpColor` between adjacent palette entries
  biased by `pow(frac, 0.2)`), rendered into offscreen `renderCol` PGraphics, occasional
  ADD blending.
- `gradSize()` (L131-156): 20 random black/white triangles into offscreen `renderSize`.
- With default `view == 1`, only `grid()` (grid.pde L57-89) is drawn onto the main
  canvas: white lines at alphas 160/60/180 (diagonals, division lines, corner-to-centre
  lines) and orange 4px ellipses at every lattice point (L84-88).
- `debugTextures == true` (L13) pastes the two offscreen triangle buffers as small
  thumbnails top-left (L95-100).

The heavy generative content — `render()` (L158-181) stamping 8000 palette-coloured
ellipses sampled from `renderCol`, plus `pointsss()` (points.pde L3-53) drawing up to
30 triangles of noise-sized, collision-rejected stippled dots coloured by a noise-driven
`getColor()` — is only reachable in view 4, but crashes headless: `renderCol.pixels`
(L162) is null on a P2D offscreen buffer without `readPixels()`, so view 4 could not be
surveyed (deterministic NPE, one attempt, not retried).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| view_4 | `int view = 1;` -> `int view = 4;` | runtime_error | NPE at ruben003.pde L162 (`renderCol.pixels` null on P2D offscreen); no image produced; view-4 stipple content not observable | (none) |
| div_8 | `int div = 4;` -> `int div = 8;` | subtle (mean 0.0121, 1.6% px) | more faint vertical/horizontal division lines at eighth positions; lattice visibly denser, same overall impression | variants/div_8/frame_00001.png |
| linealpha_40 | `stroke(255, 160);` -> `stroke(255, 40);` | none (mean 0.0013, 0.6% px) | no visible change; the two main corner-to-corner diagonals are slightly dimmer | variants/linealpha_40/frame_00001.png |
| dotcol_blue | `fill(250, 90, 0);` -> `fill(0, 160, 255);` | none (mean 0.0001, 0.0% px) | no visible change; the 4px dots are too small to notice (pixel check confirms they are now blue) | variants/dotcol_blue/frame_00001.png |
| dotsize_14 | `ellipse(p.x, p.y, 4, 4);` -> `ellipse(p.x, p.y, 14, 14);` | none (mean 0.0082, 2.0% px) | no visible change at whole-image level; intersection dots are slightly larger, lines unchanged | variants/dotsize_14/frame_00001.png |
| debugTextures_false | `boolean debugTextures = true;` -> `boolean debugTextures = false;` | none (mean 0.0013, 0.4% px) | no visible change overall; the brown top-left debug thumbnail is removed (pixel-verified; the grey thumbnail below was already near-black) | variants/debugTextures_false/frame_00001.png |

## Modularisation notes
- Generic: `createPoints` (parameterised lattice of fractions), `getColor` (palette
  lerp), `triangles` (random point in triangle), `gradColor`/`gradSize` (random triangle
  fills into a PGraphics buffer) and the ADD-blend stippling in `pointsss`.
- One-off art decisions: the hand-picked 27 lattice fractions, the warm 6-colour palette,
  the 4-view debug architecture, and the hard-coded line alphas in `grid()`.
- A clean parameter object would hold: palette[], lattice fractions, triangle count
  (gradColor 50 / gradSize 20), stipple count (8000 / 30*area*0.05), noise details
  (`detCol`, `detSiz`), dot size multiplier (`p.z*5`), and the view/debug flags.
- Porting note: view 4 (`render()`) is broken headless — `renderCol.pixels` (L162) needs
  `renderCol.readPixels()` first (P2D offscreen); without that the whole stipple pipeline
  is unreachable, so the library version should drop the `println` or call `readPixels()`.
