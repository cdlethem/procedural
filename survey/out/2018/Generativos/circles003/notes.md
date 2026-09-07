---
sketch: 2018/Generativos/circles003
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1618
animated: false
techniques: [polar, grid]
primitives: [ellipse, rect, shape]
palette:
  colors: ["#191F5A", "#5252C1", "#9455F9", "#FFA1FB", "#FFFFFF", "#51C3C4", "#EE4764", "#E472E8", "#FFB452", "#FAFAFA"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cccc (element count), default: "random(80, random(120,200))", tried: [300], change: large, effect: "more elements = denser full-bleed collage, background almost gone"}
  - {name: element size s, default: "width*random(1)^3", tried: ["width*random(1)"], change: large, effect: "dropping the cube bias makes circles/fans full-canvas, few visible elements"}
  - {name: background, default: 250, tried: [20], change: large, effect: "same layout on near-black; translucent fans read deeper, shadow blobs vanish"}
  - {name: palette, default: "10-colour list", tried: ["[#100D93,#DF390C]"], change: large, effect: "duotone navy/red-orange, high-contrast bold fans"}
  - {name: arc() fan alpha1, default: 255, tried: [100], change: none, effect: "no visible change; these wedge fans are too small/sparse to matter"}
reusable_candidates:
  - {name: wedgeFan, signature: "wedgeFan(x, y, size, a1, a2, col, a1alpha, a2alpha)", note: "arc(): splits an arc into ~radius*span thin triangles (center + rim) = striped radial fan"}
  - {name: ringBand, signature: "ringBand(x, y, r1, r2, a1, a2, col, a1alpha, a2alpha)", note: "arc2(): annular arc split into thin quadrilaterals between two radii"}
  - {name: palettePick, signature: "palettePick(colors[]) -> color", note: "uniform random pick from a fixed list"}
---

## What it draws
Dense scatter of flat geometric elements on a near-white background. Dominant colours:
magenta/pink and purple large filled circles, a red circle, teal and orange accents. Many
elements are radial "fan" patterns: thin striped wedges radiating from a point (like a sliced
pie or sunburst), some in alternating dark/light stripes. Small clusters of 1–6×1–6 coloured
pixel squares are scattered around, plus thin concentric circle outlines and a few small dark
discs. The largest circles sit on soft grey shadow-like blobs slightly beneath them.

## How the code works
`setup()` (circles003.pde:5): P3D 960×960, `smooth(8)`, `pixelDensity(2)` (unavailable on the
display, see stderr), loads `noiseShadowFrag.glsl` into `noi` but never calls `shader(noi)`
— the GLSL noise-alpha pass is dead code; everything is drawn with the normal P3D pipeline.
`generate()` (line 26): `background(250)`, `noiseSeed/randomSeed(seed)`, then draws
`cccc = random(80, random(120, 200))` elements (line 32). Each element: random position,
`size s = width*random(1)^3` (line 36, heavily biased toward small), and a random branch
`rnd ∈ {0,1,2}` (line 38):

- `rnd==0` (line 40): two concentric filled `ellipse()`s in random palette colours, then
  1–5 wedge fans via `arc()` (line 108: splits the arc into `r*PI*span` thin triangles
  centre→rim, alpha 255→0) each drawn with 50% probability, plus `arc2()` annular bands
  (line 126: thin quads between two radii), then 2–60 `arc()` wedges tiling a random arc
  range (lines 60–68) — these produce the striped sunbursts.
- `rnd==1` (line 70): `s` shrunk by ~`random(0.12)*random(0.5,1)`, then a small `cw×ch`
  grid of filled `rect()`s (1–6 cells each axis) in palette colours — the pixel-square clusters.
- `rnd==2` (line 83): full-circle `arc2()` in black alpha 30 (line 88) under an optional
  palette-filled ellipse (line 93), then 2–60 `arc2()` bands (alpha 220→255) — the
  concentric ring segments and dark translucent discs.

Colour: `rcol()` (line 154) uniform random pick from the 10-colour list (line 153);
`getColor()` (line 157, lerp-between) is never used. `draw()` is empty; the piece is
generated once in `setup()` (static). The soft grey blobs under large circles are visible in
the baseline but have no obvious code source (possibly a P3D/pixelDensity display artifact).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cccc_300 | `int cccc = int(random(80, random(120, 200)));` -> `int cccc = 300;` | large | much denser: canvas fills with overlapping circles, fans and square clusters; almost no background left, full-bleed collage | variants/cccc_300/frame_00001.png |
| size_big | `float s = width*random(1)*random(1)*random(1);` -> `float s = width*random(1);` | large | circles and fans become full-canvas in size; only a handful of elements visible, background nearly covered | variants/size_big/frame_00001.png |
| bg_20 | `background(250);` -> `background(20);` | large | layout identical to baseline (45% of pixels = background only); near-black ground, translucent pink fans read deeper, soft grey shadow blobs no longer visible | variants/bg_20/frame_00001.png |
| palette_2 | 10-colour `colors[]` -> `{#100D93, #DF390C}` | large | same composition in navy + red-orange only; high-contrast duotone, wedge fans read as bold stripes | variants/palette_2/frame_00001.png |
| arcAlpha_100 | `arc(x, y, s, a1, a2, rcol(), 255, 0);` -> `..., 100, 0);` | none | no visible change | variants/arcAlpha_100/frame_00001.png |

## Modularisation notes
Generic, reusable: `arc()` (wedge fan) and `arc2()` (annular band) are clean primitives —
they turn an arc into a strip of thin triangles/quads with a two-stop alpha ramp; both would
serve as `wedgeFan` / `ringBand` library functions. `rcol()` is trivially reusable palette
sampling. The 3-branch element scatter (fans / square grids / ring stacks) is a generic
"stamped element" pattern: position + size + branch type, each branch a small composition
function. One-off art decisions: the `width*random(1)^3` size bias, the specific 10-colour
palette, the per-branch probability mix (rnd 0/1/2), the black alpha-30 underlay. A clean
parameter object: `{count, sizeBias, palette, background, elementMix:[p0,p1,p2], fanCountRange,
gridMaxCells, bandCountRange}`.
