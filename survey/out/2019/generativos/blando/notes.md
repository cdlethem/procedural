---
sketch: 2019/generativos/blando
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1577
animated: false
techniques: [subdivision]
primitives: [rect, ellipse]
palette:
  colors: ["#000000", "#191E13", "#E83010", "#FFEE5B", "#647EEF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: 1400, tried: [700], change: large, effect: "halve the split count -> visibly larger, coarser cells; targets scale up too"}
  - {name: cc, default: "random(8,12)", tried: ["random(2,4)"], change: large, effect: "fewer rings -> small dot-like targets, flat cell colors dominate"}
  - {name: ringScale, default: 20, tried: [10], change: large, effect: "halo radius halved -> tighter, smaller targets; mosaic structure much more visible"}
  - {name: ringAlpha, default: 120, tried: [60], change: moderate, effect: "halos much paler/more transparent, flat-color tiling stands out"}
  - {name: cornerRadius, default: "random(0.5)", tried: ["random(1.0)"], change: none, effect: "no visible change (rounded inset only differs from flat rect at small corners)"}
reusable_candidates:
  - {name: splitRects, signature: "splitRects(x, y, w, h, splits, bias) -> Rect[]", note: "recursive binary bisection of a canvas rect into a non-overlapping tiling; index bias toward earlier rects keeps large cells"}
  - {name: targetStamp, signature: "targetStamp(cx, cy, baseSize, rings, alphaBase, scaleMax) -> void", note: "concentric semi-transparent ellipses fading out from center, white center dot; used as a repeating motif on each cell"}
---

## What it draws
Full-bleed, busy Mondrian-style mosaic: the canvas is tiled by a recursive
binary subdivision into hundreds of flat rectangles of very different sizes
(larger blocky cells on the left, finer vertical strips on the right). Inside
each cell sits a "target": a flat-color rounded rectangle, a set of soft
concentric semi-transparent rings in one palette color, and a small white dot
at the center. Dominant colors: black, dark olive, red-orange, bright yellow,
periwinkle blue. Static image, identical at frames 1/10/60.

## How the code works
- `settings()` (L14-19): P3D 960x960, `smooth(8)`, `pixelDensity(2)`.
- `generate()` (L51): `randomSeed`/`noiseSeed`; background is one random
  palette color (L59).
- Tiling (L64-86): start with one rect covering the canvas (L65); loop
  `sub` = 1400 times (L67). Each iteration picks a random existing rect with a
  bias toward low indices (L69: `int(rects.size()*random(0.5,1)*random(0.2))`
  — older, larger cells), splits it horizontally or vertically (50/50, L75) at
  a random cut 20-80% along the axis (L76/L80), appends both halves and
  removes the parent (L85). Ends with ~1401 rects tiling the canvas.
- Per-cell stamp (L89-119): inset 1 px (L92-95); flat fill `rcol()` rect
  (L97-98); a second rounded rect 2 px smaller with corner radius
  `bb = min(w,h)*0.5*random(0.5)` (L100-101) in a new random palette color —
  this produces the beveled/outline look around most cells; then the target:
  white ellipse of diameter `ss` = 5% of `max(w,h)` (or of `min(w,h)` half the
  time, L102-105); `cc` = 8-12 concentric rings (L108-115), ring j has
  radius `ss*20*amp` where `amp` maps j from 0.1 to 1.0 (L111), and alpha
  `120*(2-amp*2)` (L112) — small inner rings are nearly opaque, outer rings
  fade to 0, giving a soft halo; final tiny white dot at center (L117-118).
- Color: `rcol()` (L128-130) picks uniformly at random from the 5-color array
  at L127. `getColor()` lerp helpers exist but are unused (background call
  commented out at L58).
- `draw()` empty (L31-32); static; any key press reseeds and regenerates (L34-40).
- Imports of triangulate and toxi noise (L1-2) are unused in the code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_700 | `int sub = 1400;` -> `int sub = 700;` | large (mean 0.326, 0.861) | same layout style but cells clearly bigger and coarser (~half the splits); targets larger, fewer of them | variants/sub_700/frame_00001.png |
| cc_2 | `int cc = int(random(8, 12));` -> `int cc = int(random(2, 4));` | large (mean 0.1709, 0.599) | targets reduced to a small dot with 2-4 rings; flat cell colors dominate, mosaic structure much more legible | variants/cc_2/frame_00001.png |
| ringScale_10 | `...ss*20*amp, ss*20*amp);` -> `...ss*10*amp, ss*10*amp);` | large (mean 0.1606, 0.549) | halos half the radius: tighter, smaller targets; image reads as mosaic with small soft dots instead of big overlapping halos | variants/ringScale_10/frame_00001.png |
| ringAlpha_60 | `fill(col, 120*(2-amp*2));` -> `fill(col, 60*(2-amp*2));` | moderate (mean 0.0652, 0.287) | halos much paler and fainter; flat-color tiling stands out, targets become subtle glows | variants/ringAlpha_60/frame_00001.png |
| cornerRadius_1.0 | `...random(0.5);` -> `...random(1.0);` | none (mean 0.0035, 0.01) | no visible change: rounded inset only differs from the flat rect at small corners, and Processing clamps radius to min(w,h)/2 anyway | variants/cornerRadius_1.0/frame_00001.png |

## Modularisation notes
- **Generic**: the split-rect tiling (L64-86) is a reusable generator
  (`splitRects`); the target motif (L102-118) is a reusable stamp
  (`targetStamp`). Both are self-contained.
- **One-off art decisions**: the exact 5-color palette and its 50/50 per-cell
  re-draw (the two `fill(rcol())` rects per cell), the 1-px inset, the ring
  scale factor 20 and alpha falloff curve, the index bias in L69.
- **Clean parameter object**: `{size, splits, cutRange:[0.2,0.8],
  indexBias, inset, palette, cornerRadiusFrac, baseDotFrac, rings, ringScale,
  ringAlpha, centerDot}`.
- `getColor()` (L131-140) is dead code here but is a ready-made
  noise/position-driven palette lerp for the library.
