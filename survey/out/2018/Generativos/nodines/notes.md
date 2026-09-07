---
sketch: 2018/Generativos/nodines
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1589
animated: false
techniques: [voronoi-delaunay, packing, dots-stippling, grid, polar]
primitives: [line, ellipse, rect, shape]
palette:
  colors: ["#61C2C9", "#9AE32E", "#DEDFE3", "#FFFFFF"]
  selection: fixed
composition: radial
parameters:
  - {name: spikeCount, default: "random(5, 17)", tried: ["random(5, 35)"], change: none, effect: "denser spike rings per node; layout unchanged (seeded)"}
  - {name: pointSize, default: "width*random(0.02, 0.1)", tried: ["width*random(0.02, 0.2)"], change: subtle, effect: "far fewer, much larger circles (bigger candidates rejected by packing)"}
  - {name: greenFacetProb, default: 0.16, tried: [0.5], change: none, effect: "many more, larger lime facets (hue-only change; luminance score under-reads it)"}
  - {name: stippleCell, default: 5, tried: [10], change: none, effect: "coarser, more visible background noise dot field"}
  - {name: pointCandidates, default: 100, tried: [200], change: none, effect: "more, smaller packed nodes; two green facets"}
reusable_candidates:
  - {name: packPointsInDisk, signature: "packPointsInDisk(cx, cy, maxR, count, minSize, maxSize) -> PVector[] (z = size)", note: "random rejection packing with min-distance constraint, radial distribution biased by acos"}
  - {name: triangleFan, signature: "triangleFan(points, baseAlpha, accentColor, accentProb) -> void", note: "Delaunay triangulation, per-triangle random alpha, occasional accent-colour facet"}
  - {name: spikedCircle, signature: "spikedCircle(x, y, s, spikes, dotColor, bodyColor) -> void", note: "radial spike lines with tip dots, shadow arc, body ellipse, highlight arc, centre dot"}
  - {name: borderRing, signature: "borderRing(points, cx, cy, ss) -> void", note: "per-point spokes to a circle, tick marks, segmented arc rings (arc3) with random accent segments"}
  - {name: noiseStipple, signature: "noiseStipple(cell, detail, alpha) -> void", note: "grid of dots with size driven by pow(noise, 2)"}
---

## What it draws
A large turquoise disc fills the centre of a teal canvas, ringed by a soft
white glow and a segmented green/white border with radial tick marks. Inside
the disc, roughly a dozen pale lavender circles of very different sizes are
scattered, each wearing a starburst of thin white spokes ending in tiny dots
(asterisk/virus-like nodes); faint whitish triangular facets link the
circles, with one or two bright lime-green facets. The background carries a
fine grid texture and a soft field of tiny white noise dots, plus a few
scattered green specks.
## How the code works

`setup()` (L5-11) sizes 960x960 P2D, calls `generate()` once; `draw()` is
empty, so the piece is static. `generate()` (L24-61) seeds and layers:
- `background(#61C2C9)` (L30) sets the teal field.
- `grid(160,10)` + `grid(40,3)` (L32-38, helper L264-271): two faint square
  dot-grids (10px fill-white-10 on 160px pitch; 3px stroke-white-20 on 40px
  pitch) give the background texture.
- `back1()` (L273-293): 5px cell grid over the canvas, dot size =
  `5*pow(noise(x*det,y*det),2)`, white alpha 100 → the soft stippled noise
  field (detail 2, offset/density randomised per seed).
- `arc2` (L41-44, helper L296-314): two radial fan-rings of quads from the
  centre — green 0.8w→1.45w alpha 80→0 and white 0.804w→0.9w alpha 40→0 —
  producing the soft glow around the central disc.
- `rects(40,2)` (L46-48, helper L184-192): 100 random 2px green squares
  snapped to a 40px grid → sparse green specks.
- `circle(...)` (L51-53, helper L254-261): 256 and 64 hairline radial spokes
  just past 0.4w radius, white alpha 90 → the faint tick ring on the disc edge.
- `createPoints()` (L195-215): up to 100 candidates around the centre at
  random angle and distance `acos(random(random(1),1))*width*0.25` (bias
  toward the middle of a 0.25w-radius disc); each has size
  `width*random(0.02,0.1)` (19–96px) stored in `p.z`; a point is kept only if
  it doesn't overlap previously kept ones (`dis < s+p2.z`), so the circles
  never touch — the packing.
- `borderCircles(points)` (L63-110): for each point, a spoke from the ring
  radius 0.4w at the point's angle to the point (white alpha 40) plus a 4px
  white dot on the ring; ticks beyond the ring (L86-92); then per angular
  gap a double white `arc3` ring segment (ss*2.01→2.05, alpha fading ±60)
  and a 50%-chance lime `arc3` segment (ss*2.11→2.1, alpha ±220/-60) → the
  segmented green/white border with ticks.
- `circles(points)` (L112-180): `Triangulate.triangulate` over the points;
  each triangle filled white with alpha `random(70)`, or with 16% chance lime
  `#9AE32E` alpha 180 → faint facets + rare green facet. Then per point:
  `cc = int(random(5,17))` spokes (20% chance zero), white alpha 80, weight
  0.8, length `r*s` (r in 0.7–1.0), each tipped with a `#DEDFE3` dot of
  s*0.1; a dark offset shadow arc; the `#DEDFE3` body ellipse; a white
  highlight arc; a small centre dot (fill 200, stroke 140).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_35 | `int cc = int(random(5, 17));` -> `int cc = int(random(5, 35));` | none | no visible change at score level; node layouts identical, spike rings visibly denser (e.g. ~28 spokes on the large left node vs ~12) but the thin 0.8px lines move few pixels | variants/cc_35/frame_00001.png |
| size_0.2 | `float s = width*random(0.02, 0.1);` -> `float s = width*random(0.02, 0.2);` | subtle | fewer and much larger lavender circles (roughly 10 instead of 15) because bigger candidates fail the overlap test; one large green facet appears | variants/size_0.2/frame_00001.png |
| green_0.5 | `if (random(1) < 0.16) {` -> `if (random(1) < 0.5) {` | none | many more, much larger lime-green facets (score reads none because lime and teal are close in luminance; the change is purely chromatic) | variants/green_0.5/frame_00001.png |
| dotcell_10 | `float ss = 5;` -> `float ss = 10;` | none | background stipple field is coarser and more visible (double-sized dots at half the density); otherwise identical | variants/dotcell_10/frame_00001.png |
| points_200 | `for (int i = 0; i < 100; i++) {` (createPoints) -> `i < 200` | none | noticeably more nodes (~20), mostly small, denser central packing; two green facets instead of one | variants/points_200/frame_00001.png |

Note: `render.py`'s change score is a mean-luminance metric on a 512px thumbnail (label thresholds none<0.01, subtle<0.05). In this sketch's palette the most salient parameter (green-facet probability) changes only hue, so it scores "none" despite a large visual effect. Cross-checked with an independent PIL computation: identical means.

## Modularisation notes
- Generic (library candidates): the rejection packing in `createPoints`
  (`packPointsInDisk`), the Delaunay facet fill with accent probability
  (`triangleFan`), the spiked node glyph (`spikedCircle`), the segmented
  border ring (`borderRing`), and the noise-size stipple (`noiseStipple`).
  The `arc2`/`arc3` radial fan-ring helpers are also reusable.
- One-off art decisions: the layered background (two square grids + noise
  stipple + glow fan + green specks), the specific teal/lime/lavender
  palette, the 16% green-facet probability, and the per-node shadow +
  highlight arcs.
- A clean parameter object would hold: point count, point size range,
  disc radius fraction, spike count range, spike length fraction, facet
  alpha, accent colour + accent probability, border ring radii + segment
  accent probability, stipple cell/detail/alpha, and seed.
