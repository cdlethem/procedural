---
sketch: 2017/Generativos/puntas
year: 2017
renderer: JAVA2D
size: [920, 920]
libraries: []
deterministic: true
ms_first_frame: 675
animated: false
techniques: [grid, curves]
primitives: [ellipse, rect]
palette:
  colors: ["#EBB858", "#EEA8C1", "#D0CBC3", "#87B6C4", "#EA4140", "#5A5787"]
  selection: lerp-between
composition: centered
parameters:
  - {name: clusterCount, default: 100, tried: [300], change: large, effect: "more ring clusters; at 300 they overlap densely and fill nearly the whole frame, black ground almost gone"}
  - {name: gridN, default: 8, tried: [12], change: moderate, effect: "finer grid, smaller cells (144 vs 64); same three cell types"}
  - {name: gridFrac, default: 0.9, tried: [0.6], change: moderate, effect: "smaller centered grid (60% width); wider black margin, ring field more visible around it"}
  - {name: ringDrift, default: 10, tried: [2], change: moderate, effect: "slower per-ring color shift; rings hold a hue over more rings before jumping; grid unchanged"}
  - {name: maxClusterFrac, default: 1.0, tried: [0.4], change: moderate, effect: "clusters capped at 0.4*width; smaller-scale ring circles, none as huge as baseline"}
reusable_candidates:
  - {name: concentricEllipses, signature: "concentricEllipses(cx, cy, maxR, rings, colorDrift, palette) -> void", note: "nested filled ellipses from maxR down to 0 with per-ring color lerp"}
  - {name: concentricRects, signature: "concentricRects(cx, cy, size, rings, colorDrift, palette) -> void", note: "nested filled squares (target motif)"}
  - {name: gridDispatch, signature: "gridDispatch(n, sizeFrac, cellRenderer) -> void", note: "centered n x n grid calling a per-cell primitive chooser"}
---

## What it draws
A centered 8x8 grid of colored squares fills ~90% of the 920x920 canvas on a black ground. Each grid cell is one of three types: a flat solid square, nested concentric squares ("target"), or a square with notched corners (quarter-circle arcs or corner triangles). Behind and around the grid, many large overlapping concentric-ring circles in the same pastel palette fill the corners and bleed to the edges. Dominant colors: red, gold/yellow, teal-blue, slate-purple, plus pink and gray.

## How the code works
`setup()` (line 3) sets `size(920,920)`, `smooth(8)`, then calls `generate()` once; `draw()` (line 10) is empty, so the piece is static — it only regenerates on keypress, which the render harness never triggers.

`generate()` (line 29): `background(0)` fills black.

- **Ring circles** (lines 32-46): `noStroke()`, loop 100x. Each iteration picks a random center `(x,y)`, a radius `s = random(width)*random(1)` (0..~width), and `cc` concentric ellipses (lines 41-45). Ring diameter `ss = map(j, 0, cc, s, 0)` shrinks from `s` to 0; fill uses `getColor(ic + dc*j)` (line 43) which lerps between adjacent palette entries with a per-ring drift `dc`. This produces the big thin concentric-ring circles.
- **Grid** (lines 48-89): centered 8x8 grid, `size = width*0.9`, offset by margin `(width-size)*0.5`, cell `ss = size/cc`. Each cell picks `rnd = int(random(3))`:
  - `rnd==0` -> flat colored rect (`rcol()`, a random palette entry).
  - `rnd==1` -> concentric-square "target": `ccc` nested rects shrinking from `ss` to 0, fill `getColor(ic + dc*k)` (lines 61-70).
  - `rnd==2` -> rect plus, if `random(1)<0.5`, 4 corner triangles, else 4 corner quarter-circle `arc`s (lines 71-87).
- **Color** (lines 122-133): palette of 6 hex entries; `rcol()` is random-from-list, `getColor(v)` takes `v % 6` and lerps between the two adjacent palette colors at the fractional part — a continuous color wheel over the palette.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| clusterCount_300 | `i < 100` -> `i < 300` | large | ring clusters triple; they overlap densely and fill nearly the whole frame, the black ground is almost gone, rings sit behind the grid everywhere | variants/clusterCount_300/frame_00001.png |
| gridN_12 | `int cc = 8;` -> `int cc = 12;` | moderate | finer 12x12 grid, cells visibly smaller (144 vs 64), same three cell types; background ring field unchanged | variants/gridN_12/frame_00001.png |
| gridFrac_0.6 | `float size = width*0.9;` -> `width*0.6;` | moderate | grid shrinks to 60% width and recenters; wider black margin exposes far more of the ring field around it | variants/gridFrac_0.6/frame_00001.png |
| ringDrift_2 | `float dc = random(10)*random(1)*random(1);` -> `random(2)*...` | moderate | slower per-ring color shift; rings hold a color over more rings (longer same-hue bands) before jumping; grid unchanged | variants/ringDrift_2/frame_00001.png |
| maxClusterFrac_0.4 | `float s = random(width)*random(1);` -> `random(width*0.4)*random(1);` | moderate | clusters capped at 0.4*width; ring circles all smaller-scale, none as huge as baseline, more fit per area | variants/maxClusterFrac_0.4/frame_00001.png |

## Modularisation notes
Generic / reusable: `concentricEllipses` (nested ellipses with per-ring color lerp) and `concentricRects` (target motif) are self-contained and depend only on a palette + drift value; `gridDispatch` (centered n x n grid calling a per-cell renderer) is a clean scaffold. One-off art decisions: the 3-way cell choice, the specific triangle/arc corner motif, the 6-color palette, and the 0.9 size / 5% margin. A clean parameter object would be: `{gridN, gridFrac, marginFrac, clusterCount, maxClusterFrac, ringDrift, targetDrift, palette}`.
