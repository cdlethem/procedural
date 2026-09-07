---
sketch: 2018/Generativos/seaa
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 2101
animated: false
techniques: [noise-field, grid, voronoi-delaunay, dots-stippling, curves]
primitives: [ellipse, shape]
palette:
  colors: ["#FACD00", "#FB4F00", "#F277C5", "#7D57C6", "#00B187", "#3DC1CD"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: 40, tried: [20], change: moderate, effect: "drives dot-grid density, web point count, planet count and walk grid; 20 = coarser/sparser dot grid, fewer larger planets, sparser web, coarser threads"}
  - {name: stippleCount, default: 300000, tried: [100000], change: moderate, effect: "lower-half stipple ~1/3 as dense; orange-red band shows through more, mottling less solid"}
  - {name: stippleSizeMax, default: 8, tried: [16], change: subtle, effect: "lower-half stipple dots slightly larger/coarser; overall similar"}
  - {name: planetSize, default: 6, tried: [10], change: subtle, effect: "planets/rings noticeably larger and more overlapping"}
  - {name: webEdgeAlpha, default: 20, tried: [60], change: none, effect: "no visible change; web edge lines stay equally faint"}
reusable_candidates:
  - {name: lerpPalette, signature: "lerpPalette(colors[], v) -> color", note: "index a palette list with a fractional noise value and lerp between the two nearest swatches (getColor, line 210)"}
  - {name: noiseStippleField, signature: "noiseStippleField(x0,y0,x1,y1,count,sizeMin,sizeMax,detail,alpha) -> void", note: "scatter noise-sized, noise-coloured ellipses over a region; size grows with a vertical amp ramp (line 52)"}
  - {name: gridOfNoiseDots, signature: "gridOfNoiseDots(cols,rows,size,detail,ringChance) -> void", note: "regular grid of noise-coloured dots, each with a dark offset shadow and a low-probability faint ring (line 67)"}
  - {name: noiseWalkThreads, signature: "noiseWalkThreads(cols,rows,steps,detail) -> void", note: "grid of seeds each running a 3-D-noise-angle random walk drawn as a fading coloured thread (line 100)"}
  - {name: delaunayWeb, signature: "delaunayWeb(pointCount,gridCell,triAlpha) -> void", note: "random grid-anchored points triangulated and drawn as translucent white triangles with thin edges (line 134)"}
  - {name: ringedPlanet, signature: "ringedPlanet(x,y,s,colors[],col) -> void", note: "concentric wedge-arc marker: coloured ring, dark core, tiny white center (line 161)"}
---

## What it draws
A layered full-bleed "landscape". The upper half is a smooth vertical gradient band (green/teal at top fading through to yellow); the lower half is a darker orange-to-red band that begins at a hard horizontal seam exactly at the mid-line. Over the lower half sits a dense stipple field of small coloured dots that grows coarser and larger toward the bottom, mottling into hazy purple/teal patches. A regular grid of tiny dots tiles the whole canvas, a faint web of thin lines and pale triangles connects scattered nodes, and dozens of "planets" — thick coloured rings with a dark centre dot and a small white core — are scattered across the surface.

## How the code works
Everything is drawn once in `generate()` (line 24); `draw()` is empty (line 13), so the sketch is static. `randomSeed(seed)` (line 26) makes it deterministic. Layers, in order:

1. **Background + gradient bands.** `background(rcol())` (line 25) is a solid random palette colour. Then two quads are drawn with per-vertex `fill(rcol())` — the top half `vertex(width,0)/(0,0)/(0,height/2)/(width,height/2)` (lines 29-36) and the bottom half `vertex(0,height/2)/(width,height/2)/(width,height)/(0,height)` (lines 43-50). The per-vertex colour fill interpolates across each quad, producing the smooth vertical gradient in each half and the hard seam at `height/2`.
2. **Stipple field (lower half only).** A loop of 300000 iterations (line 52) places `x` anywhere and `y` in the lower half (line 54). A vertical `amp` ramp maps `height/2 -> height` to `0.1 -> 1` (line 55), so dot size `s` from noise grows toward the bottom (line 56, range `1*amp`..`8*amp`). Each dot draws a faint dark offset shadow ellipse `fill(0,6)` (lines 57-58) then a noise-coloured ellipse `fill(getColor(noise(...)*20), 80)` (lines 59-60). This is the dense stipple that coarsens downward.
3. **Dot grid.** `cc=40` cells (line 63); each cell draws a dark shadow dot `fill(0,40)` (lines 71-73) and a noise-coloured dot `fill(getColor(noise(...)*30))` (lines 74-75), sized by `ss*amp` with `amp` in `~0.08-0.16` (line 66). With 15% probability a faint white ring is added at `ss*2` (lines 76-80) and 15% at `ss` (lines 81-85) — the sparse thin circles.
4. **Noise-walk threads.** `cc*=5` (line 95) -> a 200x200 grid; each point runs a random walk of up to `80*ampCC` steps (line 108) where the heading `ang` comes from 3-D noise (line 111), stroked with a noise-palette colour and alpha fading from 120 to 0 (lines 114-115). This makes the fine thread-like scribbles.
5. **Delaunay web.** 40 random grid-anchored points (lines 126-131) are triangulated with `Triangulate.triangulate` (line 134) and drawn as `TRIANGLES` with white fill at random alpha up to 40 and a thin `stroke(0,20)` edge (lines 135-146) — the faint web of lines and pale triangles.
6. **Planets.** For each of the 40 points (lines 149-173) a marker is drawn: a faint halo `fill(col,10)` (line 156), an outer coloured ring via `arc2(xx,yy,s,s*0.92,...,col,...)` (line 161) built from wedge-shaped quads, a small dark core `arc2(...,color(0),...)` (line 165), a coloured core (line 169) and a tiny white centre (line 172). `arc2` (line 177) approximates an annulus with many small filled quads, each shaded between two alphas.

**Colour.** `rcol()` (line 204) picks a random swatch from the 6-colour palette (line 203: yellow, orange, pink, purple, teal, cyan). `getColor(v)` (line 210) maps a noise value to a fractional palette index and lerps between the two neighbouring swatches, so most colours are noise-driven blends of the palette. No blend modes are set (default NORMAL); the layered translucent fills and strokes accumulate the look.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_20 | `int cc = 40;` -> `int cc = 20;` | moderate (0.071, 0.22 px) | dot grid visibly coarser/sparser (wider-spaced dots); planets fewer and larger; web has fewer, longer triangles; top-left threads coarser; stipple field unchanged | variants/cc_20/frame_00001.png |
| count_100000 | `for (int i = 0; i < 300000; i++)` -> `... i < 100000 ...` | moderate (0.095, 0.364 px) | lower-half stipple ~1/3 as dense; orange-red band shows through more, mottling less solid; grid/planets/web unchanged | variants/count_100000/frame_00001.png |
| stippleSize_16 | `float s = map(noise(...), 0, 1, 1*amp, 8*amp);` -> `... 16*amp);` | subtle (0.031, 0.099 px) | lower-half stipple dots slightly larger/coarser; overall very close to baseline | variants/stippleSize_16/frame_00001.png |
| planetSize_10 | `float s = ss*int(random(1, 6));` -> `... random(1, 10));` | subtle (0.043, 0.134 px) | planets/rings noticeably larger and more overlapping; everything else unchanged | variants/planetSize_10/frame_00001.png |
| webAlpha_60 | `stroke(0, 20);` -> `stroke(0, 60);` | none (0.003, 0.001 px) | no visible change; web edge lines stay equally faint despite 3x alpha | variants/webAlpha_60/frame_00001.png |

## Modularisation notes
The reusable core is the layering pipeline, each stage independently parameterisable:
- `lerpPalette` (line 210) is the generic colour engine — a clean library function.
- The **gradient bands** (lines 29-50) are a one-off art decision (two fixed half-canvas quads with per-vertex fill); a generic `verticalBand(y0,y1,colA,colB)` would cover it.
- `noiseStippleField` (line 52) is generic once the region, count, size ramp, noise detail and alpha are parameters; the `height/2 -> height` amp ramp (line 55) is a one-off artistic choice.
- `gridOfNoiseDots` (line 67) is generic; the ring probabilities (0.15, lines 76/81) and the two ring scales are one-off.
- `noiseWalkThreads` (line 100) is generic given grid resolution, step count, and the 3-D noise angle detail.
- `delaunayWeb` (line 134) wraps `Triangulate.triangulate` with point placement + translucent triangle styling.
- `ringedPlanet` (line 161) + `arc2` (line 177) form a self-contained marker; `arc2` is a generic annulus-from-wedges primitive.

A clean parameter object for this sketch would contain: palette list; band colours (top/bottom); stipple `{count, regionY, sizeMin, sizeMax, detail, alpha, shadowAlpha}`; dot-grid `{cols, dotSize, detail, ringChance}`; walk `{cols, maxSteps, angleDetail, colorDetail}`; web `{pointCount, triAlpha, edgeAlpha}`; planet `{count, sizeRange}`.
