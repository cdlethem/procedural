---
sketch: 2019/generativos/tesse/tesse006
year: 2019
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1520
animated: false
techniques: [grid, typography]
primitives: [shape, ellipse, text]
palette:
  colors: ["#E40833", "#FA1457", "#00137C", "#008050", "#E3CC24", "#F376B3"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sw, default: "random even 4-12", tried: [12], change: "", effect: ""}
  - {name: sh, default: "random even 4-12", tried: [12], change: "", effect: ""}
  - {name: aw, default: "random(0.9)", tried: [0.1], change: "", effect: ""}
  - {name: dotSize, default: 4, tried: [40], change: "", effect: ""}
  - {name: palette0, default: "#E40833", tried: ["#00137C"], change: "", effect: ""}
  - {name: res, default: 10, tried: [80], change: "", effect: ""}
reusable_candidates:
  - {name: createLine, signature: "createLine(x1, y1, x2, y2, res) -> ArrayList<PVector>", note: "noise-driven random-walk polyline normalized (rotated/scaled) to a segment; unused in current render"}
  - {name: grid, signature: "grid(x1,y1,x2,y2,x3,y3,x4,y4, subW, subH, c1, c2) -> void", note: "bilinear quad patch with (i+j)%2 checkerboard fills; commented out in drawForm"}
  - {name: getColor, signature: "getColor(v) -> color", note: "continuous palette sampler: index + lerpColor to next entry"}
---

## What it draws
A flat 960x960 canvas filled with a smooth vertical gradient from golden yellow-orange at the
top to red-crimson at the bottom (two random palette colors blended across the whole background).
Over it, a regular grid of small clusters (roughly 9 columns x 5 rows, including partly cut-off
edge cells): each cluster is four tiny (~4 px) white dots arranged near the corners of a cell,
each with a small black number 1-4 beside it, the number pattern alternating from cluster to
cluster. No other geometry is visible — the sketch's actual tessellation is commented out, so
the dots and numbers are leftover debug markers.

## How the code works
`setup()` calls `generate()` (line 48); `draw()` is empty, so everything is drawn once in
`setup()` and the image is static (frames 1/10/60 identical).

- Background: lines 57-64 build a full-canvas quad with `beginShape()` and call
  `fill(getColor())` twice mid-shape (lines 58, 61). Under P2D a fill change mid-shape applies
  per vertex, so the quad tessellates into two triangles carrying two random palette colors,
  interpolated across the canvas: that produces the yellow-orange (top) to red (bottom)
  gradient. With seed 42 the two colors are fixed.
- Grid: `sw`/`sh` (lines 67-70) are random even counts 4-12, giving cell size `ww`/`hh`.
  The double loop (lines 90-116) runs `i`,`j` from -3 to count+1 (margin cells spilling off
  canvas), placing each cell center at `((i+0.5)*ww, (j+0.5)*hh)`.
- Per cell, fills are set from a noise-driven palette sample (line 109, using `detCol` from
  line 85) and a grey with alpha 220 (line 111) — but nothing is drawn with them, because both
  `grid(...)` calls inside `drawForm` (lines 147, 152) are commented out. `s1`/`s2`/`sub`
  (lines 72-73, 108, 114) only feed those dead calls.
- What actually renders per cell: in `drawForm` (line 136), when `i` is odd (`i1`, line 161),
  four corner points are placed at offsets `dx = w*aw`, `dy = h*ah` (lines 140-141) and drawn
  by `drawPoint` (lines 166-174): a 4 px white ellipse (`fill(220)`, line 192-193) plus a
  black text label "1"-"4" offset by +5 px (line 195). `aw`/`ah` (lines 75-76, random 0-0.9)
  control how far the four dots spread around the cell center.
- `createLine` (lines 232-264) builds noise random-walk polylines (angle from `noise()`,
  resolution `res`, amplitude `amp`) normalized to the target segment, stored as `l1`/`l2`
  (lines 81-82); all their consumers (`vline`) are commented out, so they never render.
- Randomness: `randomSeed(seed)` (line 51) drives everything — background colors, `sw`/`sh`,
  `aw`/`ah`, the (unused) `detCol`/`desCol` noise offsets.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `createLine`: a generic "noise random-walk curve normalized to a segment" — reusable for
  organic edge lines, but dead code in the current state.
- `grid`: bilinear quad patch with checkerboard cell fills — a reusable tiling primitive,
  currently commented out at both call sites.
- `getColor(v)`: continuous palette sampler (index + lerp to next entry) — reusable as-is.
- The visible sketch is a WIP/debug state of a tessellation: the real tiling is commented out
  and only the gradient background and numbered point markers render. A clean parameter object
  would be {seed, gridW, gridH, cellSpread (aw/ah), dotSize, labelOffset, palette[],
  bgColors[2]}; the subdivision counts s1/s2/sub only matter once the grid() calls are
  re-enabled.
