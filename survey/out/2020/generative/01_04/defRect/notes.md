---
sketch: 2020/generative/01_04/defRect
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1584
animated: false
techniques: [grid, distortion, blend-modes, pixel-ops]
primitives: [shape]
palette:
  colors: ["#4E87C5", "#BA8FE7", "#F76A0B"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(8,15)", tried: [15, 8], change: TBD, effect: "TBD"}
  - {name: des, default: "ss*0.25", tried: [0.5], change: TBD, effect: "TBD"}
  - {name: blendMode, default: ADD, tried: [BLEND], change: TBD, effect: "TBD"}
  - {name: colors, default: "3-color list", tried: [5-color list], change: TBD, effect: "TBD"}
  - {name: iters, default: "cc*cc*0.3", tried: ["cc*cc"], change: TBD, effect: "TBD"}
reusable_candidates:
  - {name: distortedQuadGrid, signature: "distortedQuadGrid(cc, displacement, iterations) -> Quad[]", note: "build a cc x cc vertex lattice, then randomly push cell edges by a fixed amount"}
  - {name: grainAlphaShader, signature: "grainAlpha(displace) -> PShader", note: "per-pixel rand() modulation of vertex colour alpha, giving a stippled grain over flat quads"}
---

## What it draws
A full-bleed mosaic of irregular, jigsaw-like quadrilaterals on a black background, roughly a
7-8 cell grid. Each cell is a flat colour drawn from a three-colour palette (steel blue,
violet/lilac, orange) at a random alpha, so overlaps glow brighter under additive blending and
gaps let the black background show through. Every quad carries a fine grainy stipple texture,
giving the whole thing a noisy, printed look.

## How the code works
`setup()` -> `generate()` (line 87) builds the whole image once; `draw()` (line 37) is empty, so
the piece is static (a key press re-runs `generate()` with a new seed).

- `background(0); blendMode(ADD)` (lines 92-93): black base, additive compositing, so where
  translucent quads overlap the colours sum toward white.
- Grid: `cc = int(random(8,15))` (line 98) sets an `cc x cc` lattice of cell-centre vertices at
  `ss = width/cc` (lines 99-107); the `(cc-1) x (cc-1)` cells between them become `Quad`s
  (lines 109-118).
- Distortion: a loop runs `cc*cc*0.3` times (line 120), each time picking a random quad and
  shifting one of its horizontal or vertical edges by `des = ss*0.25` (lines 121-140). Shared
  vertices move together, so cells become irregular polygons, and large shifts open black gaps
  and create overlaps.
- Colour: each quad's fill is `rcol()` = a random pick from `colors[]` (lines 160, 162-164) at
  `random(255)` alpha (line 145); `Quad.show()` (lines 58-81) sets a slightly different random
  alpha on each of the four vertices, producing soft per-corner fades inside each quad.
- Grain: a fragment shader (`noiseShadowFrag.glsl`) multiplies vertex-colour alpha by a per-pixel
  `rand(gl_FragCoord.xy + displace)` (shader line 21), so flat quads come out stippled/grainy;
  `displace` is re-rolled per quad (line 146).
- Stroke: `stroke(0); strokeWeight(2)` (lines 142-143) draws a thin black edge around every quad.

`uses_shader` is true but `display` is a real X display (`:2`), so the grain renders correctly
(softer than the headless/xvfb failure mode). Frames 10/60 render blank in the baseline because
the harness clears the P2D buffer between snaps and `draw()` repaints nothing; the composition is
fully captured in frame 1.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic / reusable:**
  - `distortedQuadGrid(cc, displacement, iterations)`: build an `cc x cc` lattice of shared
    vertices, then for `iterations` steps pick a random cell and push one of its four edges by
    `displacement`. This is the core generative move and is independent of colour/shader.
  - `grainAlpha(displace)` shader: a drop-in post pass that stipple-grains any flat filled shape;
    useful on its own.
- **One-off art decisions:**
  - The three-colour palette (`#4E87C5 #BA8FE7 #F76A0B`) and the ADD-on-black glow.
  - Per-vertex random alpha (the soft corner fades) inside `Quad.show()`.
  - The black 2px stroke.
- **Clean parameter object:** `{ cc, displacement (fraction of cell), iterations (fraction of
  cc*cc), palette[], blendMode, grainStrength (displace), alphaRange, strokeWeight }`.
  `displacement`, `iterations`, `cc`, `blendMode` and `palette` are the levers that actually move
  the look.
